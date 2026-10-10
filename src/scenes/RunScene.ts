import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from '../game/config';
import { Room } from '../game/room';
import { Fx } from '../game/fx';
import { Player, PERFECT_WINDOW, TEAR_COST } from '../game/player';
import { Blind, Enemy, Gossip, Penitent } from '../game/enemies';
import { Bartholomew } from '../game/boss';
import { Pendulum, SmokeCloud, Thorns, type Hazard } from '../game/hazards';
import { LucidityFx, rotLevel } from '../game/lucidity';
import { controls, hudState } from '../game/controls';
import { currentRun, hasSacrament, meta, newRun, save } from '../game/state';
import { loop, sfx, stopLoop } from '../game/audio';
import { EMBLEM, plan, ROOM_TITLES, type RoomNode, type RoomType } from '../game/run';
import { BOSS_LINES, GRATE_WHISPERS, ROOM_CLEAR_LINES, SACRAMENTS, STIGMA_TEXT } from '../game/lore';
import { hud } from './HudScene';
import { pauseMenu } from '../ui/menus';
import type { Corpse, HitResult, PlayerHit, World } from '../game/world';

interface Projectile {
  img: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  life: number;
  onEnd?: (x: number, y: number) => void;
}

interface Door {
  x: number;
  y: number;
  tx: number;
  ty: number;
  sprite: Phaser.GameObjects.Sprite;
  emblem: Phaser.GameObjects.Image | null;
  dest: RoomType;
  open: boolean;
}

interface Interactable {
  x: number;
  y: number;
  label: string;
  used: boolean;
  act: () => Promise<void> | void;
}

interface Pickup {
  img: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  kind: 'tear' | 'vertebra';
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  age: number;
}

export class RunScene extends Phaser.Scene implements World {
  room!: Room;
  fx!: Fx;
  player!: Player;
  enemies: Enemy[] = [];
  corpses: Corpse[] = [];
  enemyTimeScale = 1;
  private node!: RoomNode;
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];
  private smokes: SmokeCloud[] = [];
  private doors: Door[] = [];
  private interactables: Interactable[] = [];
  private pickups: Pickup[] = [];
  private lucid!: LucidityFx;
  private booths: Phaser.GameObjects.Image[] = [];
  private hitstopT = 0;
  private slowT = 0;
  private slowScale = 1;
  private waves: (() => void)[] = [];
  private cleared = false;
  private leaving = false;
  private dying = false;
  private grateT = 0;
  private regenT = 0;
  private boss: Bartholomew | null = null;
  private tearSfxT = 0;
  private busyInteract = false;
  private pausing = false;

  constructor() {
    super('Run');
  }

  /** Entities add their objects through this (Phaser's `scene` is the plugin). */
  get sc(): Phaser.Scene {
    return this;
  }

  init(data: { fresh?: boolean; debug?: boolean; boss?: boolean }) {
    this.enemies = [];
    this.corpses = [];
    this.projectiles = [];
    this.hazards = [];
    this.smokes = [];
    this.doors = [];
    this.interactables = [];
    this.pickups = [];
    this.booths = [];
    this.waves = [];
    this.cleared = false;
    this.leaving = false;
    this.dying = false;
    this.boss = null;
    this.hitstopT = 0;
    this.slowT = 0;
    this.enemyTimeScale = 1;
    this.busyInteract = false;
    if (data.fresh || data.debug || !plan.current) {
      newRun();
      plan.start();
      if (data.boss) plan.current = plan.make('boss', 9);
    }
    this.node = plan.current!;
  }

  create() {
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    const node = this.node;
    this.room = new Room(this, node.layout, 'biome');
    this.fx = new Fx(this);
    const spawn = this.room.find('S')[0];
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.newRoom();

    this.buildProps();
    this.setupCamera();
    this.lucid = new LucidityFx(this);
    this.lucid.onRot = (rot) => this.booths.forEach((b) => b.setTexture(b.getData('spent') ? 'booth-open' : rot > 0.5 ? 'booth-rot' : 'booth'));

    hudState.inRun = true;
    hudState.bossVisible = false;
    loop(this, 'amb_drip', 'amb');
    if (node.type !== 'boss') stopLoop(this, 'music');

    const title = node.type === 'combat' ? node.layout.name : ROOM_TITLES[node.type];
    if (node.depth === 0) hud(this).banner('The Sunken Confessionals', `${meta().citizen.name} descends`);
    else hud(this).banner(title, '');

    this.cameras.main.fadeIn(500, 11, 5, 7);
    if (node.type === 'combat' || node.type === 'elite') this.prepareWaves();
    else if (node.type === 'boss') this.time.delayedCall(700, () => this.bossIntro());
    else this.clearRoom(true);

    if (node.depth === 0 && !meta().flags.tutorial) this.tutorial();
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('abandon', () => {
      this.dying = true;
      hudState.inRun = false;
      this.cameras.main.fadeOut(600, 11, 5, 7);
      this.time.delayedCall(620, () => this.scene.start('Succession', { cause: 'retreat, abandoning the descent' }));
    });
  }

  // -------------------------------------------------------------------------
  // Room construction
  // -------------------------------------------------------------------------

  private setupCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width;
    const H = this.scale.height;
    const pad = 0;
    const bw = Math.max(this.room.pxW, W);
    const bh = Math.max(this.room.pxH, H);
    cam.setBounds((this.room.pxW - bw) / 2 - pad, (this.room.pxH - bh) / 2 - pad, bw + pad * 2, bh + pad * 2);
    cam.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 12);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0b0507');
  }

  private buildProps() {
    const r = this.room;
    for (const m of r.markers) {
      switch (m.ch) {
        case 'B': {
          const b = this.add.image(m.x, m.y + 8, 'booth').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + m.y + 4);
          this.booths.push(b);
          r.setSolid(m.tx, m.ty, true);
          r.setSolid(m.tx - 1, m.ty, true);
          r.setSolid(m.tx + 1, m.ty, true);
          break;
        }
        case 'c': {
          this.add.sprite(m.x, m.y + 6, 'candle').setOrigin(0.5, 1).play('candle:flicker').setDepth(DEPTH.actorBase + m.y);
          this.addLight(m.x, m.y - 2, 'light-sm', P.candle, 0.5);
          break;
        }
        case 'P':
        case 'p':
          this.hazards.push(new Pendulum(this, m.x, m.y, m.ch === 'P' ? 'x' : 'y'));
          break;
        case 't':
          this.hazards.push(new Thorns(this, m.x, m.y));
          break;
        case 'D':
          this.addDoor(m.tx, m.ty);
          break;
        case 'X':
          this.buildFeature(m.x, m.y);
          break;
        case 'V':
          this.buildVotive(m.x, m.y);
          break;
        case 'b':
          this.boss = new Bartholomew(this, m.x, m.y + 8);
          this.boss.onPhase = (n) => this.bossPhase(n);
          this.boss.onDefeat = () => this.bossDefeated();
          break;
      }
    }
    // Choose destinations for the doors now so emblems show from the start.
    const dests = plan.choices(this.doors.length);
    this.doors.forEach((d, i) => {
      d.dest = dests[i];
      d.emblem = this.add.image(d.x, d.y - 46, `emblem-${EMBLEM[d.dest]}`).setDepth(DEPTH.actorBase + d.y + 1).setAlpha(0.35);
    });
  }

  private addLight(x: number, y: number, key: string, color: string, alpha: number) {
    const l = this.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(color)).setAlpha(alpha).setDepth(DEPTH.light);
    this.tweens.add({ targets: l, alpha: alpha * 0.7, duration: 180 + Math.random() * 200, yoyo: true, repeat: -1 });
    return l;
  }

  private addDoor(tx: number, ty: number) {
    const x = tx * 16 + 8;
    const y = ty * 16 + 16;
    const sprite = this.add.sprite(x, y, 'door').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + y - 16);
    sprite.play('door:closed');
    this.doors.push({ x, y, tx, ty, sprite, emblem: null, dest: 'combat', open: false });
  }

  private buildFeature(x: number, y: number) {
    const type = this.node.type;
    if (type === 'confessional') {
      const b = this.add.image(x, y + 10, 'booth').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + y + 4);
      this.booths.push(b);
      this.addLight(x, y - 20, 'light-sm', P.blood0, 0.25);
      this.room.setSolid(Math.floor(x / 16), Math.floor(y / 16), true);
      this.room.setSolid(Math.floor(x / 16) - 1, Math.floor(y / 16), true);
      this.room.setSolid(Math.floor(x / 16) + 1, Math.floor(y / 16), true);
      this.interactables.push({
        x,
        y: y + 16,
        label: 'Kneel and listen',
        used: false,
        act: async () => {
          await this.confess();
          b.setData('spent', true).setTexture('booth-open');
        },
      });
    } else if (type === 'votive') {
      this.buildVotive(x, y);
    } else if (type === 'cache') {
      const c = this.add.image(x, y + 6, 'cache').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + y);
      this.addLight(x, y - 4, 'light-sm', P.gold1, 0.35);
      this.room.setSolid(Math.floor(x / 16), Math.floor(y / 16), true);
      this.interactables.push({
        x,
        y: y + 14,
        label: 'Open the casket',
        used: false,
        act: () => {
          c.setTexture('cache-open');
          sfx(this, 'door_open', { rate: 1.6, volume: 0.6 });
          const n = 12 + Math.floor(Math.random() * 9);
          this.spawnTears(x, y, n);
          if (Math.random() < 0.5) this.spawnVertebra(x, y);
          if (currentRun().lucidity < 30) this.fx.text(x, y - 30, 'it is full of teeth', P.blood0, 14, 1800);
        },
      });
    }
  }

  private buildVotive(x: number, y: number) {
    const v = this.add.image(x, y + 8, 'votive').setOrigin(0.5, 1).setDepth(DEPTH.actorBase + y);
    this.addLight(x, y - 12, 'light-lg', P.candle, 0.35);
    this.room.setSolid(Math.floor(x / 16), Math.floor(y / 16), true);
    this.room.setSolid(Math.floor(x / 16) - 1, Math.floor(y / 16), true);
    this.room.setSolid(Math.floor(x / 16) + 1, Math.floor(y / 16), true);
    this.interactables.push({
      x,
      y: y + 14,
      label: 'Approach the saint',
      used: false,
      act: async () => {
        const ok = await this.votive();
        if (ok) v.setTexture('votive-spent');
        else this.interactables.find((i) => i.x === x && i.y === y + 14)!.used = false;
      },
    });
  }

  // -------------------------------------------------------------------------
  // Waves
  // -------------------------------------------------------------------------

  private prepareWaves() {
    const d = this.node.depth;
    const elite = this.node.type === 'elite';
    let budget = 2.6 + d * 0.85;
    const rand = Math.random;
    const markers = this.room.find('e').map((m) => ({ x: m.x, y: m.y }));
    const waves: { kind: string }[][] = [];
    const nWaves = budget > 5 ? 2 : 1;
    for (let w = 0; w < nWaves; w++) {
      const list: { kind: string }[] = [];
      let b = budget / nWaves;
      if (elite && w === nWaves - 1) {
        list.push({ kind: 'penitent' });
        b -= 2.4;
      }
      while (b > 0.5) {
        const r = rand();
        let k = 'blind';
        if (d >= 1 && r < 0.38) k = 'gossip';
        if (d >= 5 && r > 0.85) k = 'blind+';
        if (d >= 6 && r > 0.93) k = 'gossip+';
        list.push({ kind: k });
        b -= k.endsWith('+') ? 1.8 : k === 'gossip' ? 1.2 : 1;
      }
      waves.push(list);
    }
    budget = 0;
    this.waves = waves.map((list) => () => {
      const used = new Set<number>();
      for (const s of list) {
        let pos: { x: number; y: number } | null = null;
        for (let tries = 0; tries < 6 && !pos; tries++) {
          const i = Math.floor(rand() * markers.length);
          if (markers.length && !used.has(i)) {
            const m = markers[i];
            if (Phaser.Math.Distance.Between(m.x, m.y, this.player.x, this.player.y) > 70) {
              used.add(i);
              pos = m;
            }
          }
        }
        pos ??= this.room.randomFloor(rand, this.player.x, this.player.y, 90);
        this.spawnEnemy(s.kind, pos.x, pos.y);
      }
    });
    this.time.delayedCall(900, () => this.nextWave());
  }

  private nextWave() {
    const w = this.waves.shift();
    if (w) {
      w();
      sfx(this, 'bell_distant', { volume: 0.4, rate: 0.9 });
    }
  }

  private spawnEnemy(kind: string, x: number, y: number) {
    let e: Enemy;
    if (kind === 'penitent') e = new Penitent(this, x, y);
    else if (kind.startsWith('gossip')) e = new Gossip(this, x, y, kind.endsWith('+'));
    else e = new Blind(this, x, y, kind.endsWith('+'));
    this.enemies.push(e);
  }

  // -------------------------------------------------------------------------
  // World interface
  // -------------------------------------------------------------------------

  noise(x: number, y: number, radius: number, kind: 'step' | 'combat') {
    if (kind === 'step' && hasSacrament('neighbour')) return;
    for (const e of this.enemies) {
      if (e instanceof Blind && e.targetable && Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) e.hear(x, y);
    }
  }

  hitPlayer(hit: PlayerHit): HitResult {
    const p = this.player;
    if (p.dead || p.state === 'locked' || this.leaving) return 'ignored';
    if (p.dodging) {
      if (p.dodgeAge < PERFECT_WINDOW) {
        p.perfectDodge(hit.source ?? null);
        return 'perfect';
      }
      return 'dodged';
    }
    if (p.invulnerable) return 'ignored';
    p.hurt(hit.damage, hit.x, hit.y, !!hit.choke);
    if (hit.lucidity) this.changeLucidity(-hit.lucidity);
    if (p.dead) this.onPlayerDeath();
    return 'hit';
  }

  addProjectile(o: { x: number; y: number; vx: number; vy: number; r: number; damage: number; key: string; life?: number; onEnd?: (x: number, y: number) => void }) {
    const img = this.add.image(o.x, o.y, o.key).setDepth(DEPTH.fx - 1);
    const shadow = this.add.image(o.x, o.y + 10, 'shadow').setDepth(DEPTH.shadow).setScale(0.5).setAlpha(0.4);
    this.projectiles.push({ img, shadow, x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: o.r, damage: o.damage, life: o.life ?? 3, onEnd: o.onEnd });
  }

  spawnTears(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 50;
      const img = this.add.sprite(x, y, 'tear').play('tear:spin').setDepth(DEPTH.fx - 2);
      this.pickups.push({ img, kind: 'tear', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, z: 6, vz: 50 + Math.random() * 50, age: 0 });
    }
  }

  private spawnVertebra(x: number, y: number) {
    const img = this.add.image(x, y, 'vertebra').setDepth(DEPTH.fx - 2);
    this.pickups.push({ img, kind: 'vertebra', x, y, vx: (Math.random() - 0.5) * 40, vy: 10, z: 8, vz: 70, age: 0 });
  }

  onEnemyKilled(e: Enemy, executed: boolean) {
    const run = currentRun();
    run.kills++;
    if (e.kind !== 'boss' && e.kind !== 'ear') {
      this.spawnTears(e.x, e.y - 4, e.tears);
      if (e.kind === 'penitent') {
        this.spawnVertebra(e.x, e.y);
        if (Math.random() < 0.5) this.spawnVertebra(e.x + 6, e.y);
      } else if (e.elite && Math.random() < 0.35) this.spawnVertebra(e.x, e.y);
      this.corpses.push({ x: e.x, y: e.y, sprite: e.sprite, eaten: false });
    }
    if (executed) this.fx.text(e.x, e.y - 40, 'Absolved', P.blood0, 16, 1100);
  }

  hitstop(ms: number) {
    this.hitstopT = Math.max(this.hitstopT, ms / 1000);
  }

  slowEnemies(ms: number, scale: number) {
    this.slowT = Math.max(this.slowT, ms / 1000);
    this.slowScale = scale;
  }

  changeLucidity(delta: number, _reason?: string) {
    const run = currentRun();
    if (delta < 0 && hasSacrament('mirror')) delta *= 0.5;
    const before = run.lucidity;
    run.lucidity = Phaser.Math.Clamp(run.lucidity + delta, 0, run.maxLucidity);
    const d = Math.round(run.lucidity - before);
    if (Math.abs(d) >= 3) this.fx.text(this.player.x + 14, this.player.y - 26, `${d > 0 ? '+' : ''}${d} Lucidity`, d > 0 ? P.lucid0 : P.lucid1, 14, 1000);
  }

  addSmoke(x: number, y: number, r: number, ms: number) {
    this.smokes.push(new SmokeCloud(this, x, y, r, ms));
  }

  vision(text: string) {
    hud(this).visionFlash(text);
  }

  // -------------------------------------------------------------------------
  // Interactions
  // -------------------------------------------------------------------------

  private async confess() {
    const run = currentRun();
    const pool = SACRAMENTS.filter((s) => !run.sacraments.includes(s.id));
    Phaser.Utils.Array.Shuffle(pool);
    const offer = pool.slice(0, 3);
    if (offer.length === 0) {
      await hud(this).dialog('The Confessional', ['The grille is silent. Thou hast heard every sin it holds.']);
      return;
    }
    this.player.lock(true);
    sfx(this, 'whisper', { volume: 0.8, rate: 0.8 });
    await hud(this).vision(['The curtain falls behind thee. The world goes black.', 'Through the grille, voices from the city above. Each wants to be forgiven.', 'Choose whose sin thou wilt carry.'], P.bone1);
    const i = await hud(this).menu({
      title: 'Draft a Sacrament',
      options: offer.map((s) => ({ label: s.name, desc: `“${s.confession}”  ${s.boon}  Toll: ${s.toll}` })),
      width: 440,
    });
    const s = offer[Math.max(0, i)];
    run.sacraments.push(s.id);
    run.confessionsHeard.push(s.confession);
    if (s.id === 'tongue') run.maxHp -= 10;
    if (s.id === 'ledger') run.maxHp -= 15;
    run.hp = Math.min(run.hp, run.maxHp);
    sfx(this, 'bell_distant', { volume: 0.6 });
    hud(this).toast(`Sacrament: ${s.name}`, P.gold1);
    this.player.lock(false);
  }

  private async votive(): Promise<boolean> {
    const run = currentRun();
    this.player.lock(true);
    const canAtone = run.sin > 0 && run.tears >= 8;
    const i = await hud(this).menu({
      title: 'The Weeping Saint',
      body: 'A marble saint weeps blood into a basin. The candles have not gone out in a century. One offering, and it will look away.',
      options: [
        { label: 'Pray', desc: 'Restore 40 Lucidity.' },
        { label: 'Anoint thy wounds', desc: 'Restore half thy flesh. Lose 10 Lucidity.' },
        { label: 'Atone (8 Tears)', desc: `Lighten this descent’s sin by 3 (now ${run.sin}).`, disabled: !canAtone },
      ],
      cancel: 'Leave it be',
    });
    this.player.lock(false);
    if (i < 0) return false;
    if (i === 0) this.changeLucidity(40);
    if (i === 1) {
      run.hp = Math.min(run.maxHp, run.hp + run.maxHp * 0.5);
      this.changeLucidity(-10);
    }
    if (i === 2) {
      run.tears -= 8;
      run.sin = Math.max(0, run.sin - 3);
    }
    sfx(this, 'heal');
    return true;
  }

  // -------------------------------------------------------------------------
  // Boss
  // -------------------------------------------------------------------------

  private async bossIntro() {
    const b = this.boss;
    if (!b) return;
    this.player.lock(true);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(b.x, b.y - 30, 900, 'Sine.easeInOut');
    sfx(this, 'boss_roar');
    this.fx.shake(800, 0.01);
    await new Promise((r) => this.time.delayedCall(1100, r));
    await hud(this).dialog('Bartholomew, The Swollen Ear', [BOSS_LINES.intro]);
    cam.startFollow(this.player.sprite, true, 0.14, 0.14, 0, 12);
    loop(this, 'music_boss', 'music');
    hudState.bossVisible = true;
    hudState.bossName = 'Bartholomew, The Swollen Ear';
    hudState.bossHp = 1;
    this.enemies.push(b);
    this.player.lock(false);
  }

  private bossPhase(n: number) {
    const line = n === 2 ? BOSS_LINES.phase2 : BOSS_LINES.phase3;
    this.fx.text(this.boss!.x, this.boss!.y - 100, line, P.flesh0, 8, 3000).setMaxWidth(260).setCenterAlign();
    if (n === 3) hud(this).toast('Destroy the Ear before its heartbeat empties thy mind', P.blood0);
  }

  private async bossDefeated() {
    const m = meta();
    const run = currentRun();
    hudState.bossVisible = false;
    stopLoop(this, 'music');
    this.player.lock(true);
    this.spawnTears(this.boss!.x, this.boss!.y - 10, 40);
    for (let i = 0; i < 4; i++) this.spawnVertebra(this.boss!.x + (i - 1.5) * 10, this.boss!.y);
    await new Promise((r) => this.time.delayedCall(1800, r));
    // Hoover up the spoils
    for (const p of this.pickups) this.collect(p);
    this.pickups = [];
    m.bossKills++;
    const first = !m.unlocked.includes('helix');
    if (first) m.unlocked.push('helix');
    m.tears += run.tears;
    m.vertebrae += run.vertebrae;
    m.bestRoom = Math.max(m.bestRoom, run.room + 1);
    save();
    if (first) {
      await hud(this).vision(
        [
          'From the torn root of the Ear, something crawls onto thy forearm and fuses there.',
          `STIGMA UNLOCKED: ${STIGMA_TEXT.helix.name}`,
          `${STIGMA_TEXT.helix.boon}`,
          'Mother Magdalene can sew it into thee.',
        ],
        P.flesh0,
      );
    }
    this.cameras.main.fadeOut(900, 11, 5, 7);
    this.time.delayedCall(950, () => {
      hudState.inRun = false;
      this.scene.start('Ending');
    });
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  private clearRoom(silent = false) {
    if (this.cleared) return;
    this.cleared = true;
    const run = currentRun();
    if (!silent) {
      run.room++;
      this.changeLucidity(6);
      hud(this).toast(Phaser.Utils.Array.GetRandom(ROOM_CLEAR_LINES), P.bone1);
      this.spawnTears(this.player.x, this.player.y - 10, 3 + this.node.depth);
    }
    this.time.delayedCall(silent ? 200 : 700, () => {
      for (const d of this.doors) {
        d.open = true;
        d.sprite.play('door:open');
        d.emblem?.setAlpha(1);
        this.room.setSolid(d.tx, d.ty, false);
        this.tweens.add({ targets: d.emblem, y: d.emblem!.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      if (this.doors.length) sfx(this, 'door_open', { volume: 0.7 });
    });
  }

  private leave(d: Door) {
    if (this.leaving) return;
    this.leaving = true;
    this.player.lock(true);
    // Hoover up what's left
    for (const p of this.pickups) this.collect(p);
    this.pickups = [];
    plan.advance(d.dest);
    this.cameras.main.fadeOut(400, 11, 5, 7);
    this.time.delayedCall(420, () => this.scene.restart({}));
  }

  private onPlayerDeath() {
    if (this.dying) return;
    this.dying = true;
    hudState.bossVisible = false;
    stopLoop(this, 'music');
    this.cameras.main.zoomTo(1.4, 1600, 'Cubic.easeOut');
    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(900, 40, 0, 0);
      this.time.delayedCall(950, () => {
        hudState.inRun = false;
        this.scene.start('Succession', { cause: this.node.type === 'boss' ? 'the Grand Confessional' : this.node.type === 'combat' ? this.node.layout.name : ROOM_TITLES[this.node.type] });
      });
    });
  }

  private collect(p: Pickup) {
    const run = currentRun();
    if (p.kind === 'tear') run.tears++;
    else {
      run.vertebrae++;
      this.fx.text(p.x, p.y - 10, 'Vertebra', P.bone0);
    }
    p.img.destroy();
  }

  private tutorial() {
    const tips = [
      'Left thumb: move. Move lightly to sneak — the Blind hunt by sound.',
      'Chain button: tap to swing, keep tapping to combo. Hold, then release, for a heavy blow.',
      'Dodge at the last instant before a blow lands: a Perfect Dodge slows the world.',
      'Break a foe’s poise and a ✞ appears. Execute them to heal — but violence costs Lucidity.',
      `The Tear button spends ${TEAR_COST} Tears to heal. Tears also buy upgrades above. Choose.`,
    ];
    tips.forEach((t, i) => this.time.delayedCall(1500 + i * 5200, () => hud(this).toast(t, P.bone0)));
    meta().flags.tutorial = true;
    save();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  update(_t: number, deltaMs: number) {
    const h = hud(this);
    if (!h || h.modal) return;
    let dt = Math.min(deltaMs, 50) / 1000;
    if (controls.take('pause') && !this.pausing) {
      this.pausing = true;
      pauseMenu(this, true).then(() => (this.pausing = false));
      return;
    }
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      this.fx.update(dt * 0.2);
      return;
    }
    if (this.slowT > 0) {
      this.slowT -= dt;
      this.enemyTimeScale = this.slowScale;
      if (this.slowT <= 0) this.enemyTimeScale = 1;
    }
    const edt = dt * this.enemyTimeScale;
    const run = currentRun();

    this.player.update(dt);
    for (const e of this.enemies) e.update(edt);
    for (const hz of this.hazards) hz.update(dt, run.lucidity);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].update(dt);
      if (this.smokes[i].done) this.smokes.splice(i, 1);
    }
    this.updateProjectiles(edt);
    this.updatePickups(dt);
    this.fx.update(dt);
    this.lucid.update(dt);
    this.updateTiles(dt);

    // Remove destroyed enemies from the active list (corpses remain drawn)
    const living = this.enemies.filter((e) => !e.dead);
    if (!this.cleared && (this.node.type === 'combat' || this.node.type === 'elite') && living.length === 0 && this.enemies.length > 0) {
      if (this.waves.length) {
        this.enemies = [];
        this.time.delayedCall(700, () => this.nextWave());
      } else this.clearRoom();
    }
    if (living.length === 0) {
      // The silence soothes: slow recovery up to half
      this.regenT += dt;
      if (this.regenT > 1 && run.lucidity < run.maxLucidity * 0.5) {
        this.regenT = 0;
        run.lucidity = Math.min(run.maxLucidity * 0.5, run.lucidity + 0.6);
      }
    }

    // Doors
    if (!this.player.busy || this.player.state === 'move') {
      for (const d of this.doors) {
        if (!d.open) continue;
        if (Math.abs(this.player.x - d.x) < 12 && this.player.y < d.y + 10) this.leave(d);
      }
    }

    // Contextual HUD
    hudState.canExecute = this.player.canExecute();
    const near = this.interactables.find((i) => !i.used && Phaser.Math.Distance.Between(i.x, i.y, this.player.x, this.player.y) < 30);
    hudState.interact = near && this.cleared && living.length === 0 ? near.label : '';
    hudState.stigmaReady = !!this.player.nearestCorpse();
    hudState.tearReady = run.tears >= TEAR_COST && run.hp < run.maxHp;
    if (near && hudState.interact && controls.take('speak') && !this.busyInteract) {
      near.used = true;
      this.busyInteract = true;
      Promise.resolve(near.act()).finally(() => (this.busyInteract = false));
    }
    controls.take('speak');
  }

  private updateTiles(dt: number) {
    const p = this.player;
    if (p.dead) return;
    const t = this.room.tileAtPx(p.x, p.y);
    if (t === 'g') {
      // Whispering Grate: petty sins pour into the ear
      const rate = hasSacrament('neighbour') ? 12 : 6;
      this.changeLuciditySilent(-rate * dt);
      this.grateT -= dt;
      if (this.grateT <= 0) {
        this.grateT = 1.4;
        sfx(this, 'whisper', { volume: 0.5 });
        this.fx.whisper(p.x, p.y - 30, Phaser.Utils.Array.GetRandom(GRATE_WHISPERS), P.bone1);
      }
    }
  }

  private changeLuciditySilent(delta: number) {
    const run = currentRun();
    if (delta < 0 && hasSacrament('mirror')) delta *= 0.5;
    run.lucidity = Phaser.Math.Clamp(run.lucidity + delta, 0, run.maxLucidity);
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      pr.img.setPosition(Math.round(pr.x), Math.round(pr.y)).setDepth(DEPTH.actorBase + pr.y + 10);
      pr.shadow.setPosition(Math.round(pr.x), Math.round(pr.y + 10));
      let end = pr.life <= 0;
      if (pr.r > 0 && this.room.solidPx(pr.x, pr.y + 8)) end = true;
      if (!end && pr.r > 0) {
        const p = this.player;
        if (Math.abs(p.x - pr.x) < pr.r + 5 && Math.abs(p.y - 8 - pr.y) < pr.r + 7) {
          const res = this.hitPlayer({ damage: pr.damage, x: pr.x - pr.vx, y: pr.y - pr.vy });
          if (res === 'hit') end = true;
        }
      }
      if (end) {
        pr.onEnd?.(pr.x, pr.y + 8);
        if (pr.r > 0) this.fx.bile(pr.x, pr.y + 6, 4);
        pr.img.destroy();
        pr.shadow.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    this.tearSfxT -= dt;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.age += dt;
      if (k.z > 0 || k.vz > 0) {
        k.vz -= 260 * dt;
        k.z = Math.max(0, k.z + k.vz * dt);
        if (k.z === 0) k.vz = 0;
        const r = this.room.move(k.x, k.y, 2, k.vx * dt, k.vy * dt);
        k.x = r.x;
        k.y = r.y;
      } else {
        k.vx *= 0.9;
        k.vy *= 0.9;
      }
      const d = Phaser.Math.Distance.Between(k.x, k.y, p.x, p.y - 4);
      if (k.age > 0.4 && d < 48 && !p.dead) {
        const a = Math.atan2(p.y - 4 - k.y, p.x - k.x);
        const sp = 160 + (48 - d) * 6;
        k.x += Math.cos(a) * sp * dt;
        k.y += Math.sin(a) * sp * dt;
        if (d < 8) {
          this.collect(k);
          this.pickups.splice(i, 1);
          if (this.tearSfxT <= 0) {
            this.tearSfxT = 0.06;
            sfx(this, 'pickup_tear', { volume: 0.5, rate: 0.9 + Math.random() * 0.3 });
          }
          continue;
        }
      }
      k.img.setPosition(Math.round(k.x), Math.round(k.y - k.z - 3)).setDepth(DEPTH.actorBase + k.y);
    }
  }

  private cleanup() {
    this.lucid?.destroy();
    this.fx?.destroy();
    for (const e of this.enemies) e.destroy();
    for (const h of this.hazards) h.destroy();
    this.room?.destroy();
    this.player?.destroy();
    this.tweens.killAll();
    hudState.canExecute = false;
    hudState.interact = '';
    void rotLevel;
  }
}
