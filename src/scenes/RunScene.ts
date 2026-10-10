import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from '../game/config';
import { Level } from '../game/level';
import { Fx } from '../game/fx';
import { Gore } from '../game/gore';
import { Backdrop } from '../game/backdrop';
import { Player, PERFECT_WINDOW, TEAR_COST } from '../game/player';
import { Blind, Cherub, Enemy, Gossip, Penitent } from '../game/enemies';
import { Bartholomew } from '../game/boss';
import { Pendulum, SmokeCloud, Thorns, type Hazard } from '../game/hazards';
import { LucidityFx } from '../game/lucidity';
import { controls, hudState } from '../game/controls';
import { currentRun, hasSacrament, meta, newRun, save } from '../game/state';
import { loop, sfx, stopLoop } from '../game/audio';
import { EMBLEM, plan, ROOM_TITLES, type RoomNode, type RoomType } from '../game/run';
import { BOSS_LINES, GRATE_WHISPERS, ROOM_CLEAR_LINES, SACRAMENTS, STIGMA_TEXT } from '../game/lore';
import { hud } from './HudScene';
import { pauseMenu } from '../ui/menus';
import type { Corpse, HitResult, PlayerHit, ProjectileSpec, World } from '../game/world';

interface Projectile extends ProjectileSpec {
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  life: number;
}

interface Door {
  x: number;
  y: number;
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
  needsClear?: boolean;
  act: () => Promise<void> | void;
}

interface Pickup {
  img: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  kind: 'tear' | 'vertebra';
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  rest: boolean;
}

export class RunScene extends Phaser.Scene implements World {
  level!: Level;
  fx!: Fx;
  gore!: Gore;
  player!: Player;
  enemies: Enemy[] = [];
  corpses: Corpse[] = [];
  enemyTimeScale = 1;
  private node!: RoomNode;
  private backdrop!: Backdrop;
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];
  private smokes: SmokeCloud[] = [];
  private doors: Door[] = [];
  private interactables: Interactable[] = [];
  private pickups: Pickup[] = [];
  private lucid!: LucidityFx;
  private swaps: { img: Phaser.GameObjects.Image; lie: string; truth: string }[] = [];
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
    this.swaps = [];
    this.waves = [];
    this.cleared = false;
    this.leaving = false;
    this.dying = false;
    this.boss = null;
    this.hitstopT = 0;
    this.slowT = 0;
    this.enemyTimeScale = 1;
    this.busyInteract = false;
    this.pausing = false;
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
    this.backdrop = new Backdrop(this, 'marble');
    this.level = new Level(this, node.layout, 'marble');
    this.gore = new Gore(this, this.level);
    this.fx = new Fx(this);
    const spawn = this.level.find('S')[0];
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.newRoom();

    this.buildProps();
    this.setupCamera();
    this.lucid = new LucidityFx(this);
    this.lucid.onRot = (rot) => {
      this.backdrop.setRot(rot);
      for (const s of this.swaps) if (!s.img.getData('spent')) s.img.setTexture(rot > 0.5 ? s.truth : s.lie);
    };

    hudState.inRun = true;
    hudState.bossVisible = false;
    hudState.depth = node.type === 'boss' ? 9 : node.type === 'ante' ? 8 : Math.min(node.depth, 7);
    hudState.totalDepth = 10;
    const onHidden = () => {
      if (!this.pausing && !hud(this).modal && !this.dying && !this.leaving) {
        this.pausing = true;
        pauseMenu(this, true).then(() => (this.pausing = false));
      }
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));

    loop(this, 'amb_drip', 'amb');
    if (node.type !== 'boss') stopLoop(this, 'music');

    const title = node.type === 'combat' || node.type === 'elite' ? node.layout.name : ROOM_TITLES[node.type];
    if (node.depth === 0) hud(this).banner('The Sunken Confessionals', `${meta().citizen.name} descends`);
    else hud(this).banner(title, node.type === 'elite' ? 'A heavier sin awaits' : '');

    this.cameras.main.fadeIn(500, 11, 5, 7);
    if (node.type === 'combat' || node.type === 'elite') this.prepareWaves();
    else if (node.type === 'boss') this.time.delayedCall(700, () => this.bossIntro());
    else this.clearRoom(true);

    if (node.depth === 0 && !meta().flags.tutorialSide) this.tutorial();
    this.events.once('shutdown', () => this.cleanup());
    this.events.once('abandon', () => {
      this.dying = true;
      hudState.inRun = false;
      this.cameras.main.fadeOut(600, 11, 5, 7);
      this.time.delayedCall(620, () => this.scene.start('Succession', { cause: 'retreat, abandoning the descent' }));
    });
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  private setupCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width;
    const H = this.scale.height;
    const bw = Math.max(this.level.pxW, W);
    const bh = Math.max(this.level.pxH, H);
    cam.setBounds((this.level.pxW - bw) / 2, (this.level.pxH - bh) / 2, bw, bh);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 40);
    cam.setDeadzone(40, 30);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0b0507');
  }

  private swap(img: Phaser.GameObjects.Image, lie: string, truth: string) {
    this.swaps.push({ img, lie, truth });
    return img;
  }

  private addLight(x: number, y: number, key: string, color: string, alpha: number) {
    const l = this.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(color)).setAlpha(alpha).setDepth(DEPTH.light);
    this.tweens.add({ targets: l, alpha: alpha * 0.7, duration: 180 + Math.random() * 200, yoyo: true, repeat: -1 });
    return l;
  }

  private buildProps() {
    const L = this.level;
    for (const m of L.markers) {
      switch (m.ch) {
        case 'B':
          this.swap(this.add.image(m.x, m.y, 'prop-booth').setOrigin(0.5, 1).setDepth(DEPTH.props), 'prop-booth', 'prop-booth-rot');
          break;
        case 's':
          this.swap(this.add.image(m.x, m.y, 'prop-saint').setOrigin(0.5, 1).setDepth(DEPTH.props), 'prop-saint', 'prop-saint-rot');
          break;
        case 'c':
          this.add.sprite(m.x, m.y, 'candelabra').setOrigin(0.5, 1).play('candelabra:flicker').setDepth(DEPTH.props + 1);
          this.addLight(m.x, m.y - 40, 'light-lg', P.candle, 0.4);
          break;
        case 'k':
          this.add.image(m.x, m.y, 'prop-cage').setOrigin(0.5, 0).setDepth(DEPTH.props);
          break;
        case 'P':
          this.hazards.push(new Pendulum(this, m.x, m.y));
          break;
        case '^':
          this.hazards.push(new Thorns(this, m.x, m.ty * 16 + 16));
          break;
        case 'D':
          this.addDoor(m.x, m.y);
          break;
        case 'X':
          this.buildFeature(m.x, m.y);
          break;
        case 'V':
          this.buildVotive(m.x, m.y);
          break;
        case 'b':
          this.boss = new Bartholomew(this, m.x, m.y);
          this.boss.onPhase = (n) => this.bossPhase(n);
          this.boss.onDefeat = () => this.bossDefeated();
          break;
      }
    }
    const dests = plan.choices(this.doors.length);
    this.doors.forEach((d, i) => {
      d.dest = dests[i];
      d.emblem = this.add.image(d.x, d.y - 80, `emblem-${EMBLEM[d.dest]}`).setDepth(DEPTH.props + 2).setAlpha(0.35);
    });
    this.scatterDecor();
  }

  private addDoor(x: number, y: number) {
    const sprite = this.add.sprite(x, y, 'door').setOrigin(0.5, 1).setDepth(DEPTH.props + 1);
    sprite.play('door:closed');
    this.doors.push({ x, y, sprite, emblem: null, dest: 'combat', open: false });
  }

  private buildFeature(x: number, y: number) {
    const type = this.node.type;
    if (type === 'confessional') {
      const b = this.swap(this.add.image(x, y, 'prop-booth').setOrigin(0.5, 1).setDepth(DEPTH.props + 2), 'prop-booth', 'prop-booth-rot');
      this.addLight(x, y - 40, 'light-lg', P.blood0, 0.25);
      this.interactables.push({
        x,
        y,
        label: 'Kneel and listen',
        used: false,
        act: async () => {
          await this.confess();
          b.setData('spent', true).setTexture('prop-booth-open');
        },
      });
    } else if (type === 'votive') this.buildVotive(x, y);
    else if (type === 'cache') {
      const c = this.add.image(x, y, 'prop-cache').setOrigin(0.5, 1).setDepth(DEPTH.props + 2);
      this.addLight(x, y - 12, 'light-sm', P.gold1, 0.4);
      this.interactables.push({
        x,
        y,
        label: 'Open the casket',
        used: false,
        act: () => {
          c.setTexture('prop-cache-open');
          sfx(this, 'door_open', { rate: 1.6, volume: 0.6 });
          this.spawnTears(x, y - 14, 12 + Math.floor(Math.random() * 9));
          if (Math.random() < 0.5) this.spawnVertebra(x, y - 14);
          if (currentRun().lucidity < 30) this.fx.text(x, y - 40, 'it is full of teeth', P.blood0, 14, 1800);
        },
      });
    }
  }

  private buildVotive(x: number, y: number) {
    const v = this.add.image(x, y, 'prop-votive').setOrigin(0.5, 1).setDepth(DEPTH.props + 2);
    this.addLight(x, y - 30, 'light-lg', P.candle, 0.45);
    const it: Interactable = {
      x,
      y,
      label: 'Approach the saint',
      used: false,
      act: async () => {
        const ok = await this.votive();
        if (ok) v.setTexture('prop-votive-spent');
        else it.used = false;
      },
    };
    this.interactables.push(it);
  }

  /** Bones and blood already in the room before you arrive. */
  private scatterDecor() {
    const L = this.level;
    const rnd = new Phaser.Math.RandomDataGenerator([String(this.node.seed)]);
    for (let tx = 1; tx < L.w - 1; tx++) {
      for (let ty = 1; ty < L.h - 1; ty++) {
        const floor = L.ch(tx, ty) === '#' && L.ch(tx, ty - 1) !== '#' && L.ch(tx, ty - 1) !== '~';
        if (!floor) continue;
        const x = tx * 16 + rnd.between(2, 14);
        const y = ty * 16;
        const r = rnd.frac();
        if (r < 0.08) this.gore.splat(x, y - 1, 0.6 + rnd.frac() * 0.6, rnd.frac() < 0.5 ? P.blood2 : P.blood3);
        else if (r < 0.1) this.add.image(x, y + 1, 'gib', rnd.between(0, 9)).setOrigin(0.5, 1).setDepth(DEPTH.corpse);
      }
    }
    // Blood weeping from the ceiling
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        const v = this.cameras.main.worldView;
        const x = v.x + Math.random() * v.width;
        let ty = 1;
        while (ty < L.h && L.solidAt(Math.floor(x / 16), ty)) ty++;
        if (ty >= L.h - 2 || Math.random() > 0.5) return;
        const d = this.add.image(x, ty * 16, 'px1').setTint(hexNum(P.blood1)).setDepth(DEPTH.fx);
        const fy = L.floorY(x, ty * 16 + 4) ?? ty * 16 + 200;
        this.tweens.add({ targets: d, y: fy - 1, duration: Math.sqrt(fy - ty * 16) * 45, ease: 'Quad.In', onComplete: () => d.destroy() });
      },
    });
    // Dust and incense ash drifting through the candlelight
    for (let i = 0; i < 30; i++) {
      const m = this.add
        .image(Phaser.Math.Between(16, L.pxW - 16), Phaser.Math.Between(40, L.pxH - 40), 'px1')
        .setTint(hexNum(P.gold0))
        .setAlpha(0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(DEPTH.light);
      this.tweens.add({ targets: m, alpha: { from: 0, to: 0.55 }, x: m.x + Phaser.Math.Between(-30, 30), y: m.y - Phaser.Math.Between(10, 50), duration: Phaser.Math.Between(3000, 6000), delay: Phaser.Math.Between(0, 4000), yoyo: true, repeat: -1 });
    }
  }

  // -------------------------------------------------------------------------
  // Waves
  // -------------------------------------------------------------------------

  private prepareWaves() {
    const d = this.node.depth;
    const elite = this.node.type === 'elite';
    const ground = this.level.find('e').map((m) => ({ x: m.x, y: m.y }));
    const air = this.level.find('f').map((m) => ({ x: m.x, y: m.y }));
    const eliteSpots = this.level.find('E').map((m) => ({ x: m.x, y: m.y }));
    const budget = 2.8 + d * 0.9;
    const nWaves = budget > 5 ? 2 : 1;
    const waves: string[][] = [];
    for (let w = 0; w < nWaves; w++) {
      const list: string[] = [];
      let b = budget / nWaves;
      if (elite && w === nWaves - 1) {
        list.push('penitent');
        b -= 2.4;
      }
      while (b > 0.5) {
        const r = Math.random();
        let k = 'blind';
        if (d >= 1 && r < 0.32) k = 'gossip';
        else if (d >= 2 && r < 0.5 && air.length) k = 'cherub';
        if (d >= 5 && r > 0.86) k = 'blind+';
        if (d >= 6 && r > 0.94) k = 'gossip+';
        list.push(k);
        b -= k.endsWith('+') ? 1.8 : k === 'gossip' ? 1.2 : 1;
      }
      waves.push(list);
    }
    this.waves = waves.map((list) => () => {
      const usedG = new Set<number>();
      const usedA = new Set<number>();
      for (const k of list) {
        const pool = k === 'cherub' ? air : k === 'penitent' && eliteSpots.length ? eliteSpots : ground;
        const used = k === 'cherub' ? usedA : usedG;
        let pos: { x: number; y: number } | null = null;
        const order = Phaser.Utils.Array.Shuffle([...pool.keys()]);
        for (const i of order) {
          if (used.has(i)) continue;
          if (Math.abs(pool[i].x - this.player.x) > 90) {
            used.add(i);
            pos = pool[i];
            break;
          }
        }
        pos ??= pool[order[0]] ?? { x: this.level.pxW * 0.6, y: this.player.y };
        this.spawnEnemy(k, pos.x + (Math.random() - 0.5) * 20, pos.y);
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
    else if (kind === 'cherub') e = new Cherub(this, x, y);
    else if (kind.startsWith('gossip')) e = new Gossip(this, x, y, kind.endsWith('+'));
    else e = new Blind(this, x, y, kind.endsWith('+'));
    this.enemies.push(e);
  }

  // -------------------------------------------------------------------------
  // World interface
  // -------------------------------------------------------------------------

  noise(x: number, y: number, radius: number, kind: 'step' | 'combat') {
    if (kind === 'step' && hasSacrament('neighbour')) return;
    for (const e of this.enemies) if (e instanceof Blind && e.targetable && Phaser.Math.Distance.Between(x, y, e.x, e.y) < radius) e.hear(x);
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

  addProjectile(o: ProjectileSpec) {
    const img = o.key === 'proj-wave' ? this.add.sprite(o.x, o.y, 'wave').play('wave:roll').setOrigin(0.5, 1) : this.add.image(o.x, o.y, o.key);
    img.setDepth(DEPTH.projectile);
    this.projectiles.push({ ...o, img, life: o.life ?? 4 });
  }

  spawnTears(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const img = this.add.sprite(x, y, 'tear').play('tear:spin').setDepth(DEPTH.fx - 2);
      this.pickups.push({ img, kind: 'tear', x, y, vx: (Math.random() - 0.5) * 140, vy: -120 - Math.random() * 120, age: 0, rest: false });
    }
  }

  private spawnVertebra(x: number, y: number) {
    const img = this.add.image(x, y, 'vertebra').setDepth(DEPTH.fx - 2);
    this.pickups.push({ img, kind: 'vertebra', x, y, vx: (Math.random() - 0.5) * 80, vy: -160, age: 0, rest: false });
  }

  onEnemyKilled(e: Enemy, executed: boolean) {
    const run = currentRun();
    run.kills++;
    if (e.kind !== 'boss' && e.kind !== 'ear') {
      this.spawnTears(e.x, e.cy, e.tears);
      if (e.kind === 'penitent') {
        this.spawnVertebra(e.x, e.cy);
        if (Math.random() < 0.5) this.spawnVertebra(e.x + 6, e.cy);
      } else if (e.elite && Math.random() < 0.35) this.spawnVertebra(e.x, e.cy);
      this.corpses.push({ x: e.x, y: e.y, sprite: e.sprite, eaten: false });
    }
    if (executed) this.fx.text(e.x, e.y - 70, 'Absolved', P.blood0, 16, 1100);
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
    if (Math.abs(d) >= 3) this.fx.text(this.player.x + 18, this.player.y - 60, `${d > 0 ? '+' : ''}${d} Lucidity`, d > 0 ? P.lucid0 : P.lucid1, 14, 1000);
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
    cam.pan(b.x - 120, b.y - 140, 1000, 'Sine.easeInOut');
    sfx(this, 'boss_roar');
    this.fx.shake(900, 0.012);
    await new Promise((r) => this.time.delayedCall(1200, r));
    await hud(this).dialog('Bartholomew, The Swollen Ear', [BOSS_LINES.intro]);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 40);
    loop(this, 'music_boss', 'music');
    hudState.bossVisible = true;
    hudState.bossName = 'Bartholomew, The Swollen Ear';
    hudState.bossHp = 1;
    this.enemies.push(b);
    this.player.lock(false);
  }

  private bossPhase(n: number) {
    const line = n === 2 ? BOSS_LINES.phase2 : BOSS_LINES.phase3;
    this.fx.text(this.boss!.x - 80, this.boss!.y - 230, line, P.flesh0, 8, 3200).setMaxWidth(260).setCenterAlign();
    if (n === 3) hud(this).toast('Destroy the Ear before its heartbeat empties thy mind', P.blood0);
  }

  private async bossDefeated() {
    const m = meta();
    const run = currentRun();
    hudState.bossVisible = false;
    stopLoop(this, 'music');
    this.player.lock(true);
    this.spawnTears(this.boss!.x - 40, this.boss!.y - 60, 40);
    for (let i = 0; i < 4; i++) this.spawnVertebra(this.boss!.x - 60 + i * 12, this.boss!.y - 60);
    await new Promise((r) => this.time.delayedCall(2000, r));
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
        ['From the torn root of the Ear, something crawls onto thy forearm and fuses there.', `STIGMA UNLOCKED: ${STIGMA_TEXT.helix.name}`, `${STIGMA_TEXT.helix.boon}`, 'Mother Magdalene can sew it into thee.'],
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
      this.spawnTears(this.player.x, this.player.y - 40, 3 + this.node.depth);
    }
    this.time.delayedCall(silent ? 200 : 700, () => {
      for (const d of this.doors) {
        d.open = true;
        d.sprite.play('door:open');
        d.emblem?.setAlpha(1);
        this.tweens.add({ targets: d.emblem, y: d.emblem!.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      }
      if (this.doors.length) sfx(this, 'door_open', { volume: 0.7 });
    });
  }

  private leave(d: Door) {
    if (this.leaving) return;
    this.leaving = true;
    this.player.lock(true);
    for (const p of this.pickups) this.collect(p);
    this.pickups = [];
    plan.advance(d.dest);
    sfx(this, 'door_open', { volume: 0.5, rate: 0.8 });
    this.cameras.main.fadeOut(400, 11, 5, 7);
    this.time.delayedCall(420, () => this.scene.restart({}));
  }

  private onPlayerDeath() {
    if (this.dying) return;
    this.dying = true;
    hudState.bossVisible = false;
    stopLoop(this, 'music');
    this.cameras.main.zoomTo(1.5, 1800, 'Cubic.easeOut');
    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(900, 40, 0, 0);
      this.time.delayedCall(950, () => {
        hudState.inRun = false;
        const cause = this.node.type === 'boss' ? 'the Grand Confessional' : this.node.type === 'combat' || this.node.type === 'elite' ? this.node.layout.name : ROOM_TITLES[this.node.type];
        this.scene.start('Succession', { cause });
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
      'Left thumb: run. Push lightly to creep — the Blind hunt by sound.',
      'Jump with the wing button. Hold down and jump to drop through a ledge.',
      'Chain: tap to combo, hold then release for a heavy blow. Push up to strike above.',
      'Dodge just before a blow lands: a Perfect Dodge slows the world.',
      'Break a foe and a ✞ appears. Execute them to heal — violence costs Lucidity.',
      `The Tear button spends ${TEAR_COST} Tears to heal. Tears also buy upgrades above.`,
    ];
    tips.forEach((t, i) => this.time.delayedCall(1500 + i * 5000, () => hud(this).toast(t, P.bone0)));
    meta().flags.tutorialSide = true;
    save();
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  update(_t: number, deltaMs: number) {
    const h = hud(this);
    this.backdrop.update();
    if (!h || h.modal) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    if (controls.take('pause') && !this.pausing) {
      this.pausing = true;
      pauseMenu(this, true).then(() => (this.pausing = false));
      return;
    }
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
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
    this.gore.update(dt);
    this.lucid.update(dt);
    this.updateTiles(dt);

    const living = this.enemies.filter((e) => !e.dead);
    if (!this.cleared && (this.node.type === 'combat' || this.node.type === 'elite') && living.length === 0 && this.enemies.length > 0) {
      if (this.waves.length) {
        this.enemies = [];
        this.time.delayedCall(700, () => this.nextWave());
      } else this.clearRoom();
    }
    if (living.length === 0) {
      this.regenT += dt;
      if (this.regenT > 1 && run.lucidity < run.maxLucidity * 0.5) {
        this.regenT = 0;
        run.lucidity = Math.min(run.maxLucidity * 0.5, run.lucidity + 0.6);
      }
    }

    // Contextual interaction: doors and shrines
    const p = this.player;
    hudState.canExecute = p.canExecute();
    let label = '';
    let action: (() => void) | null = null;
    for (const d of this.doors) {
      if (d.open && Math.abs(p.x - d.x) < 22 && Math.abs(p.y - d.y) < 20) {
        label = `Enter: ${ROOM_TITLES[d.dest] || 'the next nave'}`;
        action = () => this.leave(d);
      }
    }
    const near = this.interactables.find((i) => !i.used && Math.abs(i.x - p.x) < 34 && Math.abs(i.y - p.y) < 30);
    if (near && this.cleared && living.length === 0) {
      label = near.label;
      action = () => {
        near.used = true;
        this.busyInteract = true;
        Promise.resolve(near.act()).finally(() => (this.busyInteract = false));
      };
    }
    hudState.interact = label;
    hudState.stigmaReady = !!p.nearestCorpse();
    hudState.tearReady = run.tears >= TEAR_COST && run.hp < run.maxHp;
    if (action && !this.busyInteract && (controls.take('speak') || (controls.moveY < -0.7 && label.startsWith('Enter')))) action();
    controls.take('speak');
  }

  private updateTiles(dt: number) {
    const p = this.player;
    if (p.dead || !p.grounded) return;
    if (this.level.tileAt(p.x, p.y + 2) === 'g') {
      const rate = hasSacrament('neighbour') ? 12 : 6;
      const run = currentRun();
      let d = -rate * dt;
      if (hasSacrament('mirror')) d *= 0.5;
      run.lucidity = Phaser.Math.Clamp(run.lucidity + d, 0, run.maxLucidity);
      this.grateT -= dt;
      if (this.grateT <= 0) {
        this.grateT = 1.4;
        sfx(this, 'whisper', { volume: 0.5 });
        this.fx.whisper(p.x, p.y - 70, Phaser.Utils.Array.GetRandom(GRATE_WHISPERS), P.bone1);
      }
    }
  }

  private updateProjectiles(dt: number) {
    const L = this.level;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.gravity) pr.vy += pr.gravity * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      let end = pr.life <= 0;
      if (pr.rolls) {
        // Sludge waves hug the floor and break on walls
        const fy = L.floorY(pr.x, pr.y - 8);
        if (fy !== null) pr.y = fy;
        if (L.solidPx(pr.x + Math.sign(pr.vx) * 10, pr.y - 6)) end = true;
        if (Math.random() < dt * 20) this.gore.bile(pr.x, pr.y - 6, 1);
      } else if (L.solidPx(pr.x, pr.y)) end = true;
      pr.img.setPosition(Math.round(pr.x), Math.round(pr.y)).setFlipX(pr.vx > 0);
      if (!end && pr.r > 0) {
        const p = this.player;
        const hh = pr.rolls ? 14 : pr.r + (p.state === 'dodge' ? 8 : 22);
        if (Math.abs(p.x - pr.x) < pr.r + 6 && Math.abs(p.cy - (pr.rolls ? pr.y - 10 : pr.y)) < hh) {
          const res = this.hitPlayer({ damage: pr.damage, x: pr.x - pr.vx * 0.1, y: pr.y });
          if (res === 'hit' && !pr.rolls) end = true;
        }
      }
      if (end) {
        pr.onEnd?.(pr.x, pr.y);
        if (!pr.onEnd) this.gore.bile(pr.x, pr.y, 5);
        pr.img.destroy();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePickups(dt: number) {
    const p = this.player;
    const L = this.level;
    this.tearSfxT -= dt;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.age += dt;
      if (!k.rest) {
        k.vy += 700 * dt;
        const nx = k.x + k.vx * dt;
        if (!L.solidPx(nx, k.y)) k.x = nx;
        else k.vx *= -0.5;
        const ny = k.y + k.vy * dt;
        if (L.solidPx(k.x, ny + 4) || L.oneWayAt(Math.floor(k.x / 16), Math.floor((ny + 4) / 16))) {
          k.vy *= -0.3;
          k.vx *= 0.7;
          if (Math.abs(k.vy) < 30) k.rest = true;
        } else k.y = ny;
      }
      const d = Phaser.Math.Distance.Between(k.x, k.y, p.x, p.cy);
      if (k.age > 0.4 && d < 56 && !p.dead) {
        k.rest = true;
        const a = Math.atan2(p.cy - k.y, p.x - k.x);
        const sp = 180 + (56 - d) * 6;
        k.x += Math.cos(a) * sp * dt;
        k.y += Math.sin(a) * sp * dt;
        if (d < 10) {
          this.collect(k);
          this.pickups.splice(i, 1);
          if (this.tearSfxT <= 0) {
            this.tearSfxT = 0.06;
            sfx(this, 'pickup_tear', { volume: 0.5, rate: 0.9 + Math.random() * 0.3 });
          }
          continue;
        }
      }
      k.img.setPosition(Math.round(k.x), Math.round(k.y));
    }
  }

  private cleanup() {
    this.lucid?.destroy();
    this.gore?.destroy();
    for (const e of this.enemies) e.destroy();
    for (const h of this.hazards) h.destroy();
    this.level?.destroy();
    this.backdrop?.destroy();
    this.player?.destroy();
    this.tweens.killAll();
    hudState.canExecute = false;
    hudState.interact = '';
  }
}
