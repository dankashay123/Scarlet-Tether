import Phaser from 'phaser';
import { addSnesPost } from '../game/snespost';
import { P, hexNum } from '../art/palette';
import { DEPTH } from '../game/config';
import { Level } from '../game/level';
import { Fx } from '../game/fx';
import { Gore } from '../game/gore';
import { Backdrop } from '../game/backdrop';
import { Dressing } from '../game/dressing';
import { Player, PERFECT_WINDOW, TEAR_COST } from '../game/player';
import { Blind, Cherub, Enemy, Gossip, Penitent } from '../game/enemies';
import { Bartholomew } from '../game/boss';
import { Pendulum, SmokeCloud, Thorns, type Hazard } from '../game/hazards';
import { LucidityFx } from '../game/lucidity';
import { controls, hudState } from '../game/controls';
import { currentRun, hasSacrament, meta, newRun, save } from '../game/state';
import { loop, sfx, stopLoop } from '../game/audio';
import { descent, ROLE_TITLES } from '../game/run';
import { BOSS_LAYOUT } from '../game/layouts';
import { CH, CW } from '../game/rooms';
import type { PlacedRoom } from '../game/mapgen';
import { BOSS_LINES, GRATE_WHISPERS, ROOM_CLEAR_LINES, SACRAMENTS, STIGMA_TEXT } from '../game/lore';
import { hud } from './HudScene';
import { pauseMenu } from '../ui/menus';
import type { Corpse, HitResult, PlayerHit, PlayerShotSpec, ProjectileSpec, World } from '../game/world';
import { buildWorld } from '../game/worldmap';
import { CW as CELL_W, CH as CELL_H, SIDE_ROWS } from '../game/rooms';

interface Projectile extends ProjectileSpec {
  img: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  life: number;
}

interface Door {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
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
  kind: 'tear' | 'vertebra' | 'shard' | 'mark' | 'launcher' | 'shells';
  /** Persistent pickups: once taken, gone from this save for good. */
  key?: string;
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
  private stage: 'map' | 'boss' = 'map';
  private rooms: PlacedRoom[] = [];
  private roomEnemies = new Map<number, Enemy[]>();
  private curRoom = -1;
  private backdrop!: Backdrop;
  private dressing: Dressing | null = null;
  private projectiles: Projectile[] = [];
  private hazards: Hazard[] = [];
  private smokes: SmokeCloud[] = [];
  private doors: Door[] = [];
  private interactables: Interactable[] = [];
  private pickups: Pickup[] = [];
  private playerShots: (PlayerShotSpec & { img: Phaser.GameObjects.Image; life: number; hit: Set<Enemy> })[] = [];
  private lucid!: LucidityFx;
  private swaps: { img: Phaser.GameObjects.Image; lie: string; truth: string }[] = [];
  private hitstopT = 0;
  private slowT = 0;
  private slowScale = 1;
  private leaving = false;
  private dying = false;
  private cherubCage: { x: number; y: number; cage: Phaser.GameObjects.Image; inmate: Phaser.GameObjects.Sprite; freed: boolean } | null = null;
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
    this.playerShots = [];
    this.swaps = [];
    this.roomEnemies = new Map();
    this.curRoom = -1;
    this.leaving = false;
    this.dying = false;
    this.cherubCage = null;
    this.boss = null;
    this.hitstopT = 0;
    this.slowT = 0;
    this.enemyTimeScale = 1;
    this.busyInteract = false;
    this.pausing = false;
    if (data.fresh || data.debug || !descent.active) {
      newRun();
      descent.start();
    }
    if (data.boss) descent.stage = 'boss';
    this.stage = descent.stage;
  }

  create() {
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    const map = descent.map!;
    this.rooms = this.stage === 'map' ? map.rooms : [];
    const themes = [...new Set(this.rooms.map((r) => r.theme))];
    this.backdrop = new Backdrop(this, 'marble', themes);
    const layout = this.stage === 'map' ? { name: 'The Sunken Confessionals', kind: 'combat' as const, rows: map.rows } : BOSS_LAYOUT;
    this.level = new Level(this, layout, 'marble');
    this.level.onCrumble = (x, y, fall) => {
      if (!fall) {
        sfx(this, 'footstep_wet', { volume: 0.6, rate: 0.5 });
        this.fx.smoke(x, y, 2, '#4a403a');
      } else {
        // The tile is gone: whatever lay on it falls with it
        this.gore.unsettle(x - 8, y - 12, 16, 12);
        for (const p of this.pickups) if (p.rest && Math.abs(p.x - x) < 12 && p.y >= y - 20 && p.y <= y) ((p.rest = false), (p.vy = 0));
        for (const e of this.enemies) if (Math.abs(e.x - x) < 40 && Math.abs(e.y - (y - 8)) < 24) e.wake();
        if (Math.random() < 0.5) {
          this.fx.rubble(x, y, 4);
          sfx(this, 'door_open', { volume: 0.4, rate: 1.4 });
        }
      }
    };
    this.gore = new Gore(this, this.level);
    this.fx = new Fx(this);
    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.newRoom();

    this.buildHatches();
    this.buildProps();
    this.setupCamera();
    this.lucid = new LucidityFx(this);
    addSnesPost(this);
    this.lucid.onRot = (rot) => {
      this.backdrop.setRot(rot);
      for (const s of this.swaps) if (!s.img.getData('spent')) s.img.setTexture(rot > 0.5 ? s.truth : s.lie);
    };

    hudState.inRun = true;
    hudState.bossVisible = false;
    hudState.depth = -1;
    const onHidden = () => {
      if (!this.pausing && !hud(this).modal && !this.dying && !this.leaving) {
        this.pausing = true;
        pauseMenu(this, true).then(() => (this.pausing = false));
      }
    };
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once('shutdown', () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));

    loop(this, 'amb_drip', 'amb');
    if (this.stage === 'map') {
      stopLoop(this, 'music');
      hud(this).banner('The Sunken Confessionals', meta().world.explored.length ? 'The Severed wakes at the altar' : 'The Severed descends');
      if (!meta().flags.tutorialSide) this.tutorial();
    } else this.time.delayedCall(700, () => this.bossIntro());
    this.cameras.main.fadeIn(500, 11, 5, 7);
    this.events.once('shutdown', () => this.cleanup());
    this.events.off('abandon');
    this.events.once('abandon', () => {
      this.dying = true;
      hudState.inRun = false;
      this.cameras.main.fadeOut(600, 11, 5, 7);
      descent.reset();
      this.time.delayedCall(620, () => this.scene.start('Hub', { arrival: 'chute' }));
    });
  }

  // -------------------------------------------------------------------------
  // Construction
  // -------------------------------------------------------------------------

  /** The last save altar knelt at (or the Chute's Foot). */
  private spawnPoint(): { x: number; y: number } {
    const L = this.level;
    if (this.stage === 'map') {
      const r = this.rooms.find((x) => x.id === meta().world.save);
      const altar = r && L.markers.find((m) => m.ch === 'X' && m.tx >= r.x0 && m.tx <= r.x1 && m.ty >= r.y0 && m.ty <= r.y1);
      if (altar) return { x: altar.x - 24, y: altar.y };
    }
    return L.find('S')[0];
  }

  private setupCamera() {
    const cam = this.cameras.main;
    const W = this.scale.width;
    const H = this.scale.height;
    const bw = Math.max(this.level.pxW, W);
    const bh = Math.max(this.level.pxH, H);
    cam.setBounds((this.level.pxW - bw) / 2, (this.level.pxH - bh) / 2, bw, bh);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 18);
    cam.setDeadzone(28, 20);
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
    const cages: { x: number; y: number; img: Phaser.GameObjects.Image; room: PlacedRoom | null }[] = [];
    let niche = 0;
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
          this.addLight(m.x, m.y - 25, 'light-lg', P.candle, 0.4);
          break;
        case 'k':
          cages.push({ x: m.x, y: m.y, img: this.add.image(m.x, m.y, 'prop-cage').setOrigin(0.5, 0).setDepth(DEPTH.props), room: this.roomAtTile(m.tx, m.ty) });
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
        case 'X': {
          const r = this.roomAtTile(m.tx, m.ty);
          if (r && this.stage === 'map' && buildWorld().items.has(r.id)) break; // placed below
          this.buildFeature(m.x, m.y, r?.role ?? 'cache');
          break;
        }
        case 'V':
          this.buildVotive(m.x, m.y);
          break;
        case 'K':
          // Secrets behind false walls: the first holds a Reliquary Shard, the next a Mark
          if (niche === 0) this.placeRelic(m.x, m.y - 8, 'shard', `niche:${m.tx},${m.ty}`);
          else if (niche === 1) this.placeRelic(m.x, m.y - 8, 'mark', `niche:${m.tx},${m.ty}`);
          else this.buildFeature(m.x, m.y, 'cache');
          niche++;
          break;
        case 'b':
          this.boss = new Bartholomew(this, m.x, m.y);
          this.boss.onPhase = (n) => this.bossPhase(n);
          this.boss.onDefeat = () => this.bossDefeated();
          break;
      }
    }
    for (const d of this.doors) {
      const e = this.add.image(d.x, d.y - 52, 'emblem-boss').setDepth(DEPTH.props + 2);
      this.tweens.add({ targets: e, y: e.y - 3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    if (this.stage === 'map') {
      this.placeCherub(cages);
      this.placeTreasures();
    }
    this.scatterDecor();
    this.dressing = new Dressing(
      this,
      L,
      this.stage === 'map' ? this.rooms.map((r) => ({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, theme: r.theme })) : [{ x0: 0, y0: 0, x1: L.w - 1, y1: L.h - 1, theme: 'marble' }],
      descent.seed,
      {
        swap: (img, lie, truth) => this.swap(img, lie, truth),
        light: (x, y) => this.addLight(x, y, 'light-sm', P.candle, 0.35),
        blocked: (() => {
          // Keep the floor clear around doors, shrines, booths and features
          const busy = new Set<number>();
          for (const m of L.markers) if ('DXVKBCsSb'.includes(m.ch)) for (let dx = -3; dx <= 3; dx++) busy.add(m.ty * L.w + m.tx + dx);
          return (tx: number, ty: number) => busy.has(ty * L.w + tx) || busy.has((ty - 1) * L.w + tx) || busy.has((ty + 1) * L.w + tx);
        })(),
      },
    );
  }

  private addDoor(x: number, y: number) {
    const sprite = this.add.sprite(x, y, 'door').setOrigin(0.5, 1).setDepth(DEPTH.props + 1);
    sprite.play('door:open');
    this.doors.push({ x, y, sprite });
  }

  private roomAtTile(tx: number, ty: number): PlacedRoom | null {
    for (const r of this.rooms) if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
    return null;
  }

  private buildFeature(x: number, y: number, type: string) {
    if (type === 'confessional') {
      const b = this.swap(this.add.image(x, y, 'prop-booth').setOrigin(0.5, 1).setDepth(DEPTH.props + 2), 'prop-booth', 'prop-booth-rot');
      this.addLight(x, y - 25, 'light-lg', P.blood0, 0.25);
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
      this.addLight(x, y - 8, 'light-sm', P.gold1, 0.4);
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
    this.addLight(x, y - 19, 'light-lg', P.candle, 0.45);
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
    const rnd = new Phaser.Math.RandomDataGenerator([String(descent.seed)]);
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
    const motes = Math.min(220, Math.round(((L.pxW * L.pxH) / (640 * 360)) * 18));
    for (let i = 0; i < motes; i++) {
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
  // Rooms wake when entered
  // -------------------------------------------------------------------------

  private wakeRoom(r: PlacedRoom) {
    if (this.roomEnemies.has(r.id)) return;
    const list: Enemy[] = [];
    this.roomEnemies.set(r.id, list);
    if (r.role === 'start' || r.role === 'ante' || ['confessional', 'votive', 'cache'].includes(r.role)) return;
    const depth = r.depth;
    const spots = this.level.markers.filter((m) => (m.ch === 'e' || m.ch === 'f' || m.ch === 'E') && m.tx >= r.x0 && m.tx <= r.x1 && m.ty >= r.y0 && m.ty <= r.y1);
    // Deeper rooms fill more of their spawn points
    const fill = Math.min(1, 0.55 + depth * 0.07);
    Phaser.Utils.Array.Shuffle(spots);
    const n = Math.max(1, Math.round(spots.length * fill));
    for (const m of spots.slice(0, n)) {
      let kind = 'blind';
      const roll = Math.random();
      if (m.ch === 'E' && r.role === 'elite') kind = 'penitent';
      else if (m.ch === 'f') kind = depth >= 1 ? 'cherub' : 'blind';
      else if (depth >= 1 && roll < 0.35) kind = 'gossip';
      if (kind === 'blind' && depth >= 6 && roll > 0.8) kind = 'blind+';
      if (kind === 'gossip' && depth >= 7 && roll < 0.08) kind = 'gossip+';
      if (kind === 'blind' && m.ch === 'f') {
        // flyer spot early on: put a Blind on the floor beneath instead
        const fy = this.level.floorY(m.x, m.y);
        if (fy === null) continue;
        this.spawnEnemy(kind, m.x, fy);
      } else this.spawnEnemy(kind, m.x, m.y);
      list.push(this.enemies[this.enemies.length - 1]);
    }
    if (list.length) sfx(this, 'bell_distant', { volume: 0.35, rate: 0.9 });
  }

  private enterRoom(r: PlacedRoom) {
    this.curRoom = r.id;
    this.backdrop.setTheme(r.theme);
    const first = !descent.explored.has(r.id);
    descent.explored.add(r.id);
    if (first) meta().world.explored = [...descent.explored];
    this.wakeRoom(r);
    if (first) {
      const title = r.role === 'combat' ? r.tpl.name : ROLE_TITLES[r.role] ?? r.tpl.name;
      if (r.role !== 'start') hud(this).banner(title, r.role === 'elite' ? 'A heavier sin awaits' : '');
    }
  }

  /** When every foe in a room is dead: a small mercy. */
  private checkRoomCleared() {
    for (const [id, list] of this.roomEnemies) {
      if (descent.cleared.has(id) || !list.length) continue;
      if (list.every((e) => e.dead)) {
        descent.cleared.add(id);
        currentRun().room++;
        this.changeLucidity(6);
        hud(this).toast(Phaser.Utils.Array.GetRandom(ROOM_CLEAR_LINES), P.bone1);
      }
    }
  }

  private publishMap() {
    const p = this.player;
    const m = descent.map;
    if (!m || this.stage !== 'map') return;
    hudState.map = {
      gw: m.gw,
      gh: m.gh,
      current: this.curRoom,
      px: p.x / 16 / CW,
      py: (p.y - 20) / 16 / CH,
      rooms: this.rooms.map((r) => ({
        x: r.gx,
        y: r.gy,
        w: r.tpl.cw,
        h: r.tpl.ch,
        role: r.role,
        theme: r.theme,
        explored: descent.explored.has(r.id),
        seen: descent.explored.has(r.id) || r.links.some((l) => descent.explored.has(l.to)),
        links: r.links.map((l) => [l.exit.cx, l.exit.cy, l.exit.dir] as [number, number, string]),
      })),
    };
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

  // -------------------------------------------------------------------------
  // The Tether Cannon's shots
  // -------------------------------------------------------------------------

  firePlayerShot(s: PlayerShotSpec) {
    const key = s.kind === 'bolt' ? 'shot-bolt' : s.kind === 'charged' ? 'shot-charged' : 'shot-shell';
    const img = this.add.image(s.x, s.y, key).setDepth(DEPTH.projectile).setRotation(Math.atan2(s.vy, s.vx));
    this.playerShots.push({ ...s, img, life: s.kind === 'shell' ? 1.6 : 0.9, hit: new Set() });
  }

  private updatePlayerShots(dt: number) {
    const L = this.level;
    for (let i = this.playerShots.length - 1; i >= 0; i--) {
      const s = this.playerShots[i];
      s.life -= dt;
      const steps = 3;
      let done = s.life <= 0;
      for (let k = 0; k < steps && !done; k++) {
        s.x += (s.vx * dt) / steps;
        s.y += (s.vy * dt) / steps;
        // Foes
        for (const e of this.enemies) {
          if (!e.targetable || s.hit.has(e)) continue;
          if (Math.hypot(e.x - s.x, e.cy - s.y) > e.hurtR + s.radius) continue;
          s.hit.add(e);
          if (s.kind === 'shell') {
            done = true;
            break;
          }
          e.takeHit(s.dmg, s.poise, s.x - Math.sign(s.vx || 1) * 10, s.y, { knock: s.kind === 'charged' ? 160 : 50, heavy: s.kind === 'charged' });
          this.hitstop(s.kind === 'charged' ? 70 : 20);
          if (!s.pierce) {
            done = true;
            break;
          }
        }
        // The Captive Hymn's cage
        if (!done && this.strikeAt(s.x, s.y)) done = true;
        // Stone, hatches and cracked walls
        if (!done && L.solidPx(s.x, s.y)) {
          const h = L.hatchAt(s.x, s.y);
          if (h && s.kind === 'shell') this.blowHatch(h);
          else if (h) this.fx.text(s.x - Math.sign(s.vx) * 10, s.y - 12, 'Sealed: a Censer Shell', P.blood0, 10, 900);
          if (s.kind === 'shell') {
            const broken = L.strike(s.x, s.y, 10);
            for (const [bx, by] of broken) this.fx.rubble(bx, by, 6);
            if (broken.length) sfx(this, 'door_open', { volume: 0.9, rate: 0.7 });
          } else if (L.ch(Math.floor(s.x / 16), Math.floor(s.y / 16)) === 'w') this.fx.text(s.x, s.y - 10, 'It sounds hollow', P.bone1, 10, 900);
          done = true;
        }
      }
      if (done || s.x < 0 || s.y < 0 || s.x > L.pxW || s.y > L.pxH) {
        this.shotImpact(s);
        s.img.destroy();
        this.playerShots.splice(i, 1);
        continue;
      }
      s.img.setPosition(Math.round(s.x), Math.round(s.y));
      if (s.kind !== 'bolt' && Math.random() < 0.6) this.fx.smoke(s.x - s.vx * 0.02, s.y - s.vy * 0.02, 1, s.kind === 'shell' ? '#5a4030' : P.blood2);
    }
  }

  /** Sparks, blood or a censer's blast where a shot ends. */
  private shotImpact(s: { x: number; y: number; vx: number; vy: number; kind: PlayerShotSpec['kind']; dmg: number; poise: number }) {
    if (s.kind === 'shell') {
      this.fx.ring(s.x, s.y, 26, '#ffb040', 260);
      this.fx.smoke(s.x, s.y, 5, '#4a3a30');
      this.fx.shake(140, 0.008);
      sfx(this, 'hit_flesh2', { volume: 0.8, rate: 0.6 });
      for (const e of this.enemies) {
        if (!e.targetable) continue;
        const d = Math.hypot(e.x - s.x, e.cy - s.y);
        if (d < 28 + e.hurtR) e.takeHit(s.dmg, s.poise, s.x, s.y, { knock: 200, heavy: true });
      }
    } else this.fx.sparks(s.x, s.y, s.kind === 'charged' ? 10 : 4, s.kind === 'charged' ? P.blood0 : '#ffb0a0');
  }

  private blowHatch(h: import('../game/level').Hatch) {
    this.level.openHatch(h);
    const m = meta();
    if (!m.world.hatches.includes(h.key)) m.world.hatches.push(h.key);
    save();
    this.fx.rubble(h.tx * 16 + 8, (h.ty0 + h.ty1) * 8 + 8, 14);
    sfx(this, 'door_open', { volume: 1, rate: 0.8 });
    this.fx.shake(200, 0.01);
  }

  /** Crimson hatches between rooms, unless already blown open in this save. */
  private buildHatches() {
    if (this.stage !== 'map') return;
    const w = buildWorld();
    for (const h of w.hatches) {
      const key = `${h.a}-${h.b}`;
      if (meta().world.hatches.includes(key)) continue;
      const a = this.rooms[h.a];
      const link = a?.links.find((l) => l.to === h.b);
      if (!link) continue;
      const e = link.exit;
      const tx = e.dir === 'E' ? a.x0 + (e.cx + 1) * CELL_W - 1 : a.x0 + e.cx * CELL_W;
      const ty0 = a.y0 + e.cy * CELL_H + SIDE_ROWS[0];
      this.level.addHatch(key, tx, ty0, ty0 + SIDE_ROWS.length - 1, 'crimson');
    }
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

  /** A collectible waiting in a secret: bobbing, glowing, picked up by walking into it. */
  private placeRelic(x: number, y: number, kind: 'shard' | 'mark' | 'launcher' | 'shells', key?: string) {
    if (key && meta().world.taken.includes(key)) return;
    const tex = { shard: 'relic-shard', mark: 'mark-seal', launcher: 'item-launcher', shells: 'item-shells' }[kind];
    const img = this.add.image(x, y, tex).setDepth(DEPTH.fx - 2);
    this.tweens.add({ targets: img, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.addLight(x, y, 'light-sm', kind === 'mark' ? P.blood0 : P.gold1, 0.5);
    this.pickups.push({ img, kind, key, x, y, vx: 0, vy: 0, age: 1, rest: true });
  }

  /** The world's fixed treasures and save altars, on each room's 'X' spot. */
  private placeTreasures() {
    const L = this.level;
    for (const [id, item] of buildWorld().items) {
      const r = this.rooms.find((x) => x.id === id);
      if (!r) continue;
      const inRoom = (m: { tx: number; ty: number }) => m.tx >= r.x0 && m.tx <= r.x1 && m.ty >= r.y0 && m.ty <= r.y1;
      let spot = L.markers.find((m) => m.ch === 'X' && inRoom(m));
      if (!spot) {
        // The Chute's Foot has no feature spot: raise the altar beside the landing
        const s = L.markers.find((m) => m.ch === 'S' && inRoom(m));
        if (!s) continue;
        const x = s.x + 56;
        spot = { ...s, x, y: L.floorY(x, s.y - 8) ?? s.y };
      }
      if (item === 'save') this.buildAltar(spot.x, spot.y, r);
      else this.placeRelic(spot.x, spot.y - 14, item === 'shard' ? 'shard' : item, `${id}:${item}`);
    }
  }

  /** Kneel to save, heal and refill shells; death returns you here. */
  private buildAltar(x: number, y: number, r: PlacedRoom) {
    this.add.image(x, y, 'prop-votive').setOrigin(0.5, 1).setDepth(DEPTH.props + 2);
    this.addLight(x, y - 19, 'light-lg', P.holy, 0.4);
    const it: Interactable = {
      x,
      y,
      label: 'Kneel at the altar',
      used: false,
      act: () => {
        const run = currentRun();
        const m = meta();
        m.world.save = r.id;
        m.world.explored = [...descent.explored];
        save();
        run.hp = run.maxHp;
        run.shells = run.shellsMax;
        run.lucidity = Math.max(run.lucidity, run.maxLucidity * 0.75);
        this.player.lock(true, 'kneel');
        this.time.delayedCall(1100, () => this.player.lock(false));
        sfx(this, 'heal', { volume: 0.9 });
        sfx(this, 'bell_distant', { volume: 0.6 });
        this.fx.ring(x, y - 20, 50, P.holy, 600);
        hud(this).banner('The altar remembers you', 'Your progress is kept. Health and shells restored.');
        this.time.delayedCall(1500, () => (it.used = false));
      },
    };
    this.interactables.push(it);
  }

  spawnMark(x: number, y: number) {
    const img = this.add.image(x, y, 'mark-seal').setDepth(DEPTH.fx - 2);
    this.pickups.push({ img, kind: 'mark', x, y, vx: (Math.random() - 0.5) * 60, vy: -200, age: 0, rest: false });
  }

  /** One cage per descent holds a living cherub. Smash it with the chain to free it. */
  private placeCherub(cages: { x: number; y: number; img: Phaser.GameObjects.Image; room: PlacedRoom | null }[]) {
    const rnd = new Phaser.Math.RandomDataGenerator([`cherub-${descent.seed}`]);
    const far = cages.filter((c) => c.room && c.room.role !== 'start' && c.room.depth >= 3);
    const pick = far.length ? rnd.pick(far) : cages.length ? rnd.pick(cages) : null;
    if (!pick) return;
    // Lower it on a long chain so the Tether can reach it from the floor below
    const fy = this.level.floorY(pick.x, pick.y + 44);
    if (fy !== null) {
      const top = Math.max(pick.y, fy - 76);
      if (top > pick.y + 8) {
        this.add.tileSprite(pick.x, pick.y, 16, top - pick.y, 'hang-chain').setOrigin(0.5, 0).setDepth(DEPTH.props - 1);
        pick.img.setY(top);
        pick.y = top;
      }
    }
    const inmate = this.add.sprite(pick.x, pick.y + 24, 'cherub').play('cherub:fly').setScale(0.75).setDepth(DEPTH.props - 1);
    this.tweens.add({ targets: inmate, y: inmate.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.addLight(pick.x, pick.y + 24, 'light-sm', P.holy, 0.35);
    this.cherubCage = { x: pick.x, y: pick.y, cage: pick.img, inmate, freed: false };
  }

  strikeAt(x: number, y: number) {
    const c = this.cherubCage;
    if (!c || c.freed || Math.abs(x - c.x) > 11 || y < c.y + 5 || y > c.y + 40) return false;
    c.freed = true;
    const m = meta();
    m.cherubs = (m.cherubs ?? 0) + 1;
    save();
    sfx(this, 'door_open', { rate: 1.5 });
    sfx(this, 'bell_distant', { volume: 0.8, rate: 1.3 });
    this.fx.rubble(c.x, c.y + 22, 10);
    this.fx.ring(c.x, c.y + 24, 28, P.holy, 500);
    this.hitstop(90);
    c.cage.destroy();
    this.tweens.add({ targets: c.inmate, y: c.y - 120, alpha: 0, angle: 360, duration: 1400, ease: 'Cubic.In', onComplete: () => c.inmate.destroy() });
    const n = m.cherubs;
    const next = 3 - (n % 3);
    hud(this).banner('A Captive Hymn is freed', n % 3 === 0 ? `${n} Hymns freed. Their song grants thee +10 Lucidity, forever.` : `${n} Hymns freed. ${next} more and they will sing for thee.`);
    if (n % 3 === 0) {
      const run = currentRun();
      run.maxLucidity += 10;
      this.changeLucidity(10);
    }
    return true;
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
      // A heavier sin, a heavier reward: elites always leave an Iron Brand
      if (e.elite) this.spawnMark(e.x, e.cy);
      e.corpse = { x: e.x, y: e.y, sprite: e.sprite, eaten: false };
      this.corpses.push(e.corpse);
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
    cam.startFollow(this.player.sprite, true, 0.12, 0.12, 0, 30);
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

  /**
   * Phone framing: feet sit low (about 64% down) so the thumbs never cover
   * the fight, the view leads the way the penitent faces, and it drops to
   * show the landing during a long fall.
   */
  private frameCamera(dt: number) {
    if (this.stage !== 'map') return;
    const cam = this.cameras.main;
    const p = this.player;
    const k = Math.min(1, dt * 2.5);
    const lookX = -p.face * 40;
    const lookY = p.body.vy > 300 ? 4 : 26;
    cam.followOffset.x += (lookX - cam.followOffset.x) * k;
    cam.followOffset.y += (lookY - cam.followOffset.y) * Math.min(1, dt * (p.body.vy > 300 ? 4 : 2));
  }

  private async bossDefeated() {
    if (this.dying) return;
    const m = meta();
    const run = currentRun();
    hudState.bossVisible = false;
    stopLoop(this, 'music');
    this.player.lock(true);
    this.spawnTears(this.boss!.x - 40, this.boss!.y - 60, 40);
    for (let i = 0; i < 4; i++) this.spawnVertebra(this.boss!.x - 60 + i * 12, this.boss!.y - 60);
    this.spawnMark(this.boss!.x - 30, this.boss!.y - 60);
    this.spawnMark(this.boss!.x - 50, this.boss!.y - 60);
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
    descent.reset();
    this.cameras.main.fadeOut(900, 11, 5, 7);
    this.time.delayedCall(950, () => {
      hudState.inRun = false;
      this.scene.start('Ending');
    });
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  private enterBoss() {
    if (this.leaving) return;
    this.leaving = true;
    this.player.lock(true);
    for (const p of this.pickups) this.collect(p);
    this.pickups = [];
    descent.stage = 'boss';
    sfx(this, 'door_open', { volume: 0.6, rate: 0.7 });
    this.cameras.main.fadeOut(600, 11, 5, 7);
    this.time.delayedCall(620, () => this.scene.restart({ boss: true }));
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
        // Death is not the end here: wake at the last altar, whole again.
        // Items taken stay taken; Tears carried are halved; foes return.
        const run = currentRun();
        const m = meta();
        m.deaths++;
        save();
        run.hp = run.maxHp;
        run.shells = run.shellsMax;
        run.lucidity = Math.max(run.lucidity, run.maxLucidity * 0.5);
        run.tears = Math.floor(run.tears / 2);
        descent.stage = 'map';
        this.scene.restart({ respawn: true });
      });
    });
  }

  private collect(p: Pickup) {
    const run = currentRun();
    if (p.key) {
      const w = meta().world;
      if (!w.taken.includes(p.key)) w.taken.push(p.key);
      save();
    }
    if (p.kind === 'tear') run.tears++;
    else if (p.kind === 'launcher' || p.kind === 'shells') {
      const m = meta();
      m.shellsMax += 5;
      if (p.kind === 'launcher') m.flags.launcher = true;
      run.shellsMax = m.flags.launcher ? m.shellsMax : 0;
      run.shells = run.shellsMax;
      save();
      sfx(this, 'bell_distant', { volume: 1, rate: 0.8 });
      this.fx.ring(p.x, p.y, 60, P.gold1, 700);
      if (p.kind === 'launcher') hud(this).banner('The Censer Launcher', 'Switch to shells with the censer button. They break cracked stone and crimson hatches.');
      else hud(this).banner('Censer Shells', m.flags.launcher ? `+5 shells (${m.shellsMax} carried)` : 'Five shells, and nothing yet to fire them.');
    }
    else if (p.kind === 'shard') {
      // Permanent, like the reliquary it was broken from
      const m = meta();
      m.shards = (m.shards ?? 0) + 1;
      save();
      sfx(this, 'heal', { volume: 0.8 });
      const n = m.shards;
      if (n % 3 === 0) {
        run.maxHp += 15;
        run.hp = Math.min(run.maxHp, run.hp + 15);
      }
      hud(this).banner('A Reliquary Shard', n % 3 === 0 ? `The reliquary is whole again: +15 Health, forever. (${n} shards)` : `${3 - (n % 3)} more to make it whole. (${n} shards)`);
    } else if (p.kind === 'mark') {
      const m = meta();
      m.marks = (m.marks ?? 0) + 1;
      save();
      sfx(this, 'execute', { volume: 0.5, rate: 1.4 });
      this.fx.text(p.x, p.y - 12, 'Iron Brand', P.blood0, 18, 1400);
    } else {
      run.vertebrae++;
      this.fx.text(p.x, p.y - 10, 'Vertebra', P.bone0);
    }
    p.img.destroy();
  }

  private tutorial() {
    const tips = [
      'Left thumb: run, and aim the Tether Cannon in eight directions.',
      'Hold the sight button to plant your feet and aim without moving.',
      'Tap the bolt button to fire. Hold it, then let go, for a charged bolt.',
      'Jump with the wing button. Hold down and jump to drop through a ledge.',
      'Dash through danger. Break a foe and a ✞ appears: execute them to heal.',
      `The Tear button spends ${TEAR_COST} Tears to heal. Kneel at altars to keep your progress.`,
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
    this.dressing?.update();
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
    this.frameCamera(dt);
    for (const e of this.enemies) e.update(edt);
    for (const hz of this.hazards) hz.update(dt, run.lucidity);
    this.level.update(dt);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      this.smokes[i].update(dt);
      if (this.smokes[i].done) this.smokes.splice(i, 1);
    }
    this.updateProjectiles(edt);
    this.updatePlayerShots(dt);
    this.updatePickups(dt);
    this.gore.update(dt);
    this.lucid.update(dt);
    this.updateTiles(dt);

    // Which room are we in?
    const p = this.player;
    if (this.stage === 'map') {
      const r = this.roomAtTile(Math.floor(p.x / 16), Math.floor((p.y - 20) / 16));
      if (r && r.id !== this.curRoom) this.enterRoom(r);
      // Wake neighbours just before they scroll into view
      for (const l of r?.links ?? []) {
        const n = this.rooms[l.to];
        if (n && !this.roomEnemies.has(n.id) && Math.abs(p.x / 16 - (n.x0 + n.x1) / 2) < (n.x1 - n.x0) / 2 + 28 && Math.abs(p.y / 16 - (n.y0 + n.y1) / 2) < (n.y1 - n.y0) / 2 + 14) this.wakeRoom(n);
      }
      this.checkRoomCleared();
      this.publishMap();
    }
    const living = this.enemies.filter((e) => !e.dead);
    if (living.length === 0) {
      this.regenT += dt;
      if (this.regenT > 1 && run.lucidity < run.maxLucidity * 0.5) {
        this.regenT = 0;
        run.lucidity = Math.min(run.maxLucidity * 0.5, run.lucidity + 0.6);
      }
    }

    // Contextual interaction: the boss door and shrines
    hudState.canExecute = p.canExecute();
    let label = '';
    let action: (() => void) | null = null;
    for (const d of this.doors) {
      if (Math.abs(p.x - d.x) < 22 && Math.abs(p.y - d.y) < 20) {
        label = 'Enter: The Grand Confessional';
        action = () => this.enterBoss();
      }
    }
    const near = this.interactables.find((i) => !i.used && Math.abs(i.x - p.x) < 24 && Math.abs(i.y - p.y) < 24);
    if (near) {
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
    hudState.shells = run.shells;
    hudState.shellsMax = run.shellsMax;
    hudState.shellArmed = this.player.weapon === 'shell';
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
    this.dressing?.destroy();
    this.dressing = null;
    this.player?.destroy();
    this.tweens.killAll();
    hudState.canExecute = false;
    hudState.interact = '';
    hudState.map = null;
  }
}
