import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { FOOT_Y, FW, heroMeta } from '../art/hero';
import { DEPTH } from './config';
import { controls } from './controls';
import { currentRun, hasSacrament, meta } from './state';
import { sfx } from './audio';
import { Body } from './physics';
import type { Enemy } from './enemies';
import type { World } from './world';
import { CRIME_VISIONS, DEVOUR_VISIONS } from './lore';

type PState = 'move' | 'windup' | 'active' | 'recover' | 'charge' | 'dodge' | 'execute' | 'devour' | 'weep' | 'hurt' | 'dead' | 'locked' | 'climb' | 'hang' | 'mantle';

interface Swing {
  key: 'a1' | 'a2' | 'a3' | 'up';
  windup: number;
  active: number;
  recover: number;
  from: number; // start angle (deg; 0 = forward, + = down)
  to: number; // end angle
  reach: number;
  dmg: number;
  poise: number;
  stam: number;
  heavy?: boolean;
  lunge?: number;
}

const COMBO: Swing[] = [
  { key: 'a1', windup: 0.13, active: 0.1, recover: 0.22, from: -110, to: 35, reach: 74, dmg: 12, poise: 12, stam: 12, lunge: 50 },
  { key: 'a2', windup: 0.12, active: 0.1, recover: 0.24, from: 45, to: -80, reach: 74, dmg: 14, poise: 12, stam: 12, lunge: 50 },
  { key: 'a3', windup: 0.26, active: 0.16, recover: 0.4, from: -165, to: 70, reach: 84, dmg: 24, poise: 30, stam: 20, lunge: 90 },
];
const UP: Swing = { key: 'up', windup: 0.12, active: 0.12, recover: 0.26, from: 10, to: -190, reach: 72, dmg: 14, poise: 14, stam: 14 };
const AIR: Swing = { key: 'a3', windup: 0.08, active: 0.14, recover: 0.2, from: -60, to: 120, reach: 70, dmg: 14, poise: 16, stam: 12 };
const HEAVY: Swing = { key: 'a3', windup: 0.08, active: 0.18, recover: 0.42, from: -175, to: 80, reach: 100, dmg: 40, poise: 50, stam: 28, heavy: true, lunge: 120 };

export const DODGE_TIME = 0.34;
export const DODGE_IFRAMES = 0.26;
export const PERFECT_WINDOW = 0.15;
const CHARGE_MS = 380;
const RUN = 128;
const SNEAK = 52;
const JUMP_V = 440; // apex ~5.25 tiles: one-way ledges 5 rows up; stone ledges higher via ledge grab
const CLIMB_SPEED = 92;
const LINKS = 18; // enough links that a full-length lash never shows gaps
export const EXECUTE_RANGE = 44;
export const TEAR_COST = 6;
export const DEVOUR_RANGE = 34;
const ORIGIN_X = 52; // hip x in the hero frame

export class Player {
  body: Body;
  state: PState = 'move';
  stateT = 0;
  face = 1;
  sprite: Phaser.GameObjects.Sprite;
  private links: Phaser.GameObjects.Image[] = [];
  private head: Phaser.GameObjects.Image;
  private headPos = new Phaser.Math.Vector2();
  private headVel = new Phaser.Math.Vector2();
  private tether: Phaser.GameObjects.Graphics;
  private rope: { x: number; y: number; px: number; py: number }[] = [];
  private chargeGlow: Phaser.GameObjects.Image;

  private combo = 0;
  private swing: Swing = COMBO[0];
  private hitThisSwing = new Set<Enemy>();
  private queued = false;
  private strikes = 0;
  private perfectUsed = false;
  private airDashed = false;
  dodgeAge = 99;
  private hurtInvuln = 0;
  private staminaDelay = 0;
  chokeT = 0;
  private stepT = 0;
  private coyote = 0;
  private target: Enemy | null = null;
  private lambUsed = false;
  private landT = 0;
  private ledgeCd = 0;
  private mantleFrom = { x: 0, y: 0 };
  private mantleTo = { x: 0, y: 0 };

  constructor(
    private world: World,
    x: number,
    y: number,
  ) {
    const s = world.sc;
    this.body = new Body(x, y, 12, 46);
    this.tether = s.add.graphics().setDepth(DEPTH.player - 2);
    for (let i = 0; i < LINKS; i++) this.links.push(s.add.image(x, y, 'chain-link').setDepth(DEPTH.player + 1));
    this.head = s.add.image(x, y, 'chain-head').setDepth(DEPTH.player + 2);
    this.sprite = s.add.sprite(x, y, 'player').setOrigin(ORIGIN_X / FW, FOOT_Y / 96).setDepth(DEPTH.player);
    this.sprite.play('player:idle');
    this.chargeGlow = s.add.image(x, y, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.blood0)).setAlpha(0).setDepth(DEPTH.light);
    this.headPos.set(x + 10, y);
    for (let i = 0; i < 9; i++) this.rope.push({ x, y: y - 40 + i * 2, px: x, py: y - 40 + i * 2 });
  }

  get x() {
    return this.body.x;
  }
  set x(v: number) {
    this.body.x = v;
  }
  get y() {
    return this.body.y;
  }
  set y(v: number) {
    this.body.y = v;
  }
  /** Centre of mass, for enemies to aim at. */
  get cy() {
    return this.body.y - (this.state === 'dodge' ? 12 : 24);
  }
  get dodging() {
    return this.state === 'dodge' && this.dodgeAge < DODGE_IFRAMES;
  }
  get dead() {
    return this.state === 'dead';
  }
  get invulnerable() {
    return this.hurtInvuln > 0 || this.state === 'execute';
  }
  get busy() {
    return this.state !== 'move';
  }
  get choking() {
    return this.chokeT > 0;
  }
  get grounded() {
    return this.body.onGround;
  }

  newRoom() {
    this.lambUsed = false;
    if (hasSacrament('lamb')) {
      const run = currentRun();
      run.stamina = Math.min(run.stamina, run.maxStamina / 2);
    }
  }

  lock(v: boolean) {
    if (v) this.setState('locked');
    else if (this.state === 'locked') this.setState('move');
  }

  private setState(s: PState) {
    this.state = s;
    this.stateT = 0;
  }

  private spend(n: number) {
    const run = currentRun();
    run.stamina = Math.max(0, run.stamina - n);
    this.staminaDelay = 0.5;
    if (run.stamina <= 0 && this.chokeT <= 0) {
      this.chokeT = 2.2;
      sfx(this.world.sc, 'choke');
      this.world.fx.text(this.x, this.y - 64, 'Choking', P.smoke0);
    }
  }

  drainStamina(n: number) {
    const run = currentRun();
    run.stamina = Math.max(0, run.stamina - n);
    this.staminaDelay = 0.5;
    if (run.stamina <= 0 && this.chokeT <= 0) {
      this.chokeT = 2.2;
      sfx(this.world.sc, 'choke');
    }
  }

  choke() {
    currentRun().stamina = 0;
    this.chokeT = 2.4;
    sfx(this.world.sc, 'choke');
    this.world.fx.text(this.x, this.y - 64, 'Choked', P.smoke0);
  }

  private play(key: string) {
    const k = `player:${key}`;
    if (this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k, true);
  }

  // -------------------------------------------------------------------------
  // Combat
  // -------------------------------------------------------------------------

  private startSwing(s: Swing) {
    this.swing = s;
    this.hitThisSwing.clear();
    // Turn to face the nearest foe in reach, so taps always connect
    const t = this.nearestFoe(90);
    if (t && Math.abs(t.x - this.x) > 4) this.face = t.x > this.x ? 1 : -1;
    else if (Math.abs(controls.moveX) > 0.3) this.face = Math.sign(controls.moveX);
    this.target = t;
    this.spend(s.stam);
    this.setState('windup');
    this.play(s.heavy ? 'charge' : `${s.key}-0`);
  }

  private nearestFoe(range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.world.enemies) {
      if (!e.targetable) continue;
      const d = Math.abs(e.x - this.x) + Math.abs(e.cy - this.cy) * 0.6;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private reach() {
    return this.swing.reach + meta().weapon.length * 6;
  }

  private damageFor(s: Swing): { dmg: number; crit: boolean } {
    let dmg = s.dmg * (1 + meta().weapon.weight * 0.15);
    if (hasSacrament('debt')) dmg *= 1.25;
    if (hasSacrament('knife')) dmg *= s.heavy ? 1.6 : 0.8;
    const crit = Math.random() < (hasSacrament('blindeye') ? 0.35 : 0.05);
    if (crit) dmg *= 2;
    return { dmg: Math.round(dmg), crit };
  }

  /** Swing pivot: the shoulder. */
  private pivot(): [number, number] {
    return [this.x + this.face * 2, this.y - 36];
  }

  private angleAt(prog: number) {
    const s = this.swing;
    const a = Phaser.Math.DegToRad(s.from + (s.to - s.from) * prog);
    // Mirror for facing left
    return this.face > 0 ? a : Math.PI - a;
  }

  private checkHits() {
    const w = this.world;
    const s = this.swing;
    const reach = this.reach();
    const prog = Math.min(1, this.stateT / s.active);
    const [px, py] = this.pivot();
    const a0 = Phaser.Math.DegToRad(s.from);
    const a1 = Phaser.Math.DegToRad(s.from + (s.to - s.from) * prog);
    const lo = Math.min(a0, a1) - 0.25;
    const hi = Math.max(a0, a1) + 0.25;
    for (const e of w.enemies) {
      if (!e.targetable || this.hitThisSwing.has(e)) continue;
      const dx = e.x - px;
      const dy = e.cy - py;
      const d = Math.hypot(dx, dy);
      if (d > reach + e.hurtR) continue;
      // Angle relative to facing (0 = forward)
      let a = Math.atan2(dy, dx * this.face);
      // Bring into the swing's range (-pi..pi with wrap for overhead arcs)
      if (a < lo - 0.1) a += Math.PI * 2;
      if (a > hi + 0.1) a -= Math.PI * 2;
      // Point-blank always connects (the up-swing's arc passes above a foe in front)
      const close = d < e.hurtR + (s.key === 'up' ? 24 : 10);
      // The chain can't lash through stone
      if (!close && !w.level.lineClear(px, py, e.x, e.cy)) continue;
      if ((a >= lo && a <= hi) || close) {
        this.hitThisSwing.add(e);
        const { dmg, crit } = this.damageFor(s);
        this.strikes++;
        const toxin = hasSacrament('tongue') && this.strikes % 3 === 0;
        const bleed = s.heavy && meta().weapon.marrow > 0;
        e.takeHit(dmg, s.poise, this.x, this.cy, { knock: s.heavy ? 220 : 120, crit, toxin, bleed: bleed ? meta().weapon.marrow : 0, heavy: !!s.heavy });
        w.hitstop(s.heavy ? 120 : crit ? 90 : 60);
        w.fx.shake(s.heavy ? 180 : 90, s.heavy ? 0.012 : 0.005);
        sfx(w.sc, Math.random() < 0.5 ? 'hit_flesh' : 'hit_flesh2');
      }
    }
    // The chain also finds the hollow places in the walls
    const aw = this.angleAt(prog);
    for (const k of [0.15, 0.3, 0.55, 0.8, 1]) {
      const broken = w.level.strike(px + Math.cos(aw) * reach * k, py + Math.sin(aw) * reach * k, 6);
      if (!broken.length) continue;
      for (const [bx, by] of broken) w.fx.rubble(bx, by, 6);
      w.fx.shake(220, 0.01);
      w.hitstop(80);
      sfx(w.sc, 'door_open', { volume: 0.9, rate: 0.7 });
      sfx(w.sc, 'hit_flesh2', { volume: 0.6, rate: 0.5 });
      w.fx.text(broken[0][0], broken[0][1] - 20, 'A hollow wall', P.bone1, 16, 1400);
      break;
    }
  }

  private canDodge() {
    return !this.choking && currentRun().stamina > 0 && (this.grounded || !this.airDashed);
  }

  private startDodge() {
    if (Math.abs(controls.moveX) > 0.25) this.face = Math.sign(controls.moveX);
    if (!this.grounded) this.airDashed = true;
    this.spend(hasSacrament('promise') ? 12 : 22);
    this.dodgeAge = 0;
    this.perfectUsed = false;
    this.setState('dodge');
    this.play('slide');
    sfx(this.world.sc, 'dodge', { volume: 0.8 });
    this.world.noise(this.x, this.y, 110, 'combat');
  }

  perfectDodge(source: Enemy | null) {
    if (this.perfectUsed) return;
    this.perfectUsed = true;
    const w = this.world;
    const run = currentRun();
    sfx(w.sc, 'perfect_dodge');
    run.stamina = Math.min(run.maxStamina, run.stamina + 24);
    w.slowEnemies(900, 0.25);
    w.fx.ring(this.x, this.cy, 40, P.holy, 350);
    w.fx.text(this.x, this.y - 70, 'Perfect', P.gold0);
    w.sc.cameras.main.flash(90, 255, 248, 220, false);
    if (source && !source.dead) source.breakPoise(0.6);
    if (hasSacrament('promise')) w.changeLucidity(-3, 'promise');
    if (meta().equipped.includes('helix')) this.shriek();
  }

  /** The Flayed Helix screams what it has heard. */
  private shriek() {
    const w = this.world;
    w.fx.ring(this.x, this.cy, 86, P.flesh1, 420);
    w.fx.ring(this.x, this.cy, 62, P.blood0, 300);
    w.fx.shake(160, 0.008);
    sfx(w.sc, 'whisper', { rate: 1.6, volume: 0.9 });
    for (const e of w.enemies) {
      if (!e.targetable) continue;
      if (Phaser.Math.Distance.Between(this.x, this.cy, e.x, e.cy) < 90) e.takeHit(10, 60, this.x, this.cy, { knock: 200 });
    }
    w.changeLucidity(-5, 'helix');
  }

  hurt(dmg: number, fromX: number, _fromY: number, choke: boolean): boolean {
    const w = this.world;
    const run = currentRun();
    if (hasSacrament('lamb') && !this.lambUsed) {
      this.lambUsed = true;
      w.fx.text(this.x, this.y - 64, 'Forgiven', P.holy);
      this.hurtInvuln = 0.6;
      return false;
    }
    run.hp = Math.max(0, run.hp - dmg);
    this.hurtInvuln = 0.8;
    const dir = this.x >= fromX ? 1 : -1;
    this.body.vx = dir * 170;
    this.body.vy = -160;
    w.gore.spray(this.x, this.cy, dir > 0 ? -0.4 : Math.PI + 0.4, 16, 1);
    w.fx.shake(150, 0.009);
    w.hitstop(70);
    sfx(w.sc, 'hit_player');
    this.sprite.setTintFill(0xffffff);
    w.sc.time.delayedCall(70, () => this.sprite.clearTint());
    if (choke) this.choke();
    if (run.hp <= 0) {
      this.die();
      return true;
    }
    this.setState('hurt');
    this.play('hurt');
    return true;
  }

  private die() {
    this.setState('dead');
    this.play('die');
    this.head.setVisible(false);
    this.links.forEach((l) => l.setVisible(false));
    this.world.gore.explode(this.x, this.cy, 0.9, -this.face);
    this.world.gore.fountain(this.x, this.y - 30, 1800);
    this.world.gore.pool(this.x, this.y, 2);
    sfx(this.world.sc, 'death_player');
  }

  private nearestStaggered(): Enemy | null {
    let best: Enemy | null = null;
    let bd = EXECUTE_RANGE;
    for (const e of this.world.enemies) {
      if (!e.executable) continue;
      const d = Math.abs(e.x - this.x);
      if (d < bd + e.hurtR && Math.abs(e.y - this.y) < 40) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  canExecute() {
    return this.state === 'move' || this.state === 'recover' ? !!this.nearestStaggered() : false;
  }

  nearestCorpse() {
    let best = null;
    let bd = DEVOUR_RANGE;
    for (const c of this.world.corpses) {
      if (c.eaten) continue;
      const d = Math.abs(this.x - c.x) + Math.abs(this.y - c.y);
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }

  private startExecute(e: Enemy) {
    const w = this.world;
    this.setState('execute');
    this.target = e;
    e.beingExecuted = true;
    this.face = e.x >= this.x ? 1 : -1;
    this.play('raise');
    w.sc.cameras.main.zoomTo(1.4, 220, 'Cubic.easeOut');
    w.slowEnemies(800, 0);
  }

  private finishExecute() {
    const w = this.world;
    const e = this.target;
    const run = currentRun();
    w.sc.cameras.main.zoomTo(1, 320, 'Cubic.easeInOut');
    if (!e) return;
    sfx(w.sc, 'execute');
    w.hitstop(240);
    w.fx.shake(300, 0.016);
    e.executed();
    const heal = Math.round(run.maxHp * 0.3 * (hasSacrament('glutton') ? 2 : 1));
    run.hp = Math.min(run.maxHp, run.hp + heal);
    run.executions++;
    run.sin++;
    w.fx.text(this.x, this.y - 72, `+${heal}`, P.blood0);
    w.changeLucidity(-8, 'execute');
    this.target = null;
  }

  private startWeep() {
    const run = currentRun();
    if (run.tears < TEAR_COST || run.hp >= run.maxHp || !this.grounded) return;
    run.tears -= TEAR_COST;
    this.setState('weep');
    this.play('kneel');
    sfx(this.world.sc, 'heal', { volume: 0.7 });
  }

  private finishWeep() {
    const run = currentRun();
    run.hp = Math.min(run.maxHp, run.hp + 32);
    this.world.fx.text(this.x, this.y - 70, '+32', P.tear0);
    this.world.changeLucidity(-12, 'tears');
    this.world.vision(Phaser.Utils.Array.GetRandom(CRIME_VISIONS));
  }

  private startDevour() {
    const c = this.nearestCorpse();
    if (!c || !this.grounded) return;
    c.eaten = true;
    this.setState('devour');
    this.face = c.x >= this.x ? 1 : -1;
    this.play('kneel');
    sfx(this.world.sc, 'devour');
    const w = this.world;
    w.sc.tweens.add({ targets: c.sprite, alpha: 0, scaleY: 0.4, duration: 800, onComplete: () => c.sprite.setVisible(false).setActive(false) });
    for (let i = 0; i < 6; i++) w.sc.time.delayedCall(i * 140, () => w.gore.spray(c.x, c.y - 6, -Math.PI / 2, 5, 0.6, 1.2));
  }

  private finishDevour() {
    const run = currentRun();
    run.hp = Math.min(run.maxHp, run.hp + 24);
    run.devoured++;
    run.sin++;
    this.world.fx.text(this.x, this.y - 70, '+24', P.blood0);
    this.world.changeLucidity(-10, 'devour');
    this.world.vision(Phaser.Utils.Array.GetRandom(DEVOUR_VISIONS));
  }

  // -------------------------------------------------------------------------
  // Climbing: ladders, chains, ledges
  // -------------------------------------------------------------------------

  private startClimb() {
    const L = this.world.level;
    this.setState('climb');
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.x = Math.floor(this.x / 16) * 16 + 8;
    if (L.climbablePx(this.x, this.y + 4) && !L.climbablePx(this.x, this.y - 4)) this.body.y += 4; // stepping down onto the top rung
    else if (!L.climbablePx(this.x, this.y + 4) && L.climbablePx(this.x, this.y + 20)) this.body.y += 20; // down through a ledge onto the ladder beneath it
  }

  /** Grab a ledge corner near the hands while airborne. */
  private tryLedge(): boolean {
    const b = this.body;
    const L = this.world.level;
    if (b.onGround || b.vy < -60 || this.ledgeCd > 0) return false;
    const dir = Math.abs(controls.moveX) > 0.3 ? Math.sign(controls.moveX) : this.face;
    const tx = Math.floor((b.x + dir * (b.w / 2 + 3)) / 16);
    const hands = b.top + 4;
    for (let ty = Math.floor((hands - 10) / 16); ty <= Math.floor((hands + 14) / 16); ty++) {
      const cornerY = ty * 16;
      if (cornerY < hands - 10 || cornerY > hands + 14) continue;
      if (!L.solidAt(tx, ty) || L.solidAt(tx, ty - 1) || L.solidAt(tx, ty - 2) || L.solidAt(tx, ty - 3)) continue;
      // Our own column must be open beside the ledge
      const bx = Math.floor(b.x / 16);
      if (L.solidAt(bx, ty - 1) || L.solidAt(bx, ty)) continue;
      this.face = dir;
      b.x = dir > 0 ? tx * 16 - b.w / 2 - 0.5 : (tx + 1) * 16 + b.w / 2 + 0.5;
      b.y = cornerY + b.h - 8;
      b.vx = 0;
      b.vy = 0;
      this.mantleTo = { x: tx * 16 + 8, y: cornerY };
      this.setState('hang');
      this.play('hang');
      sfx(this.world.sc, 'footstep_wet', { volume: 0.5, rate: 1.3 });
      return true;
    }
    return false;
  }

  private updateClimb(dt: number): boolean {
    const b = this.body;
    const L = this.world.level;
    if (this.state === 'climb') {
      if (controls.take('jump')) {
        this.setState('move');
        b.vy = -JUMP_V * 0.6;
        b.vx = Math.abs(controls.moveX) > 0.3 ? Math.sign(controls.moveX) * 110 : 0;
        if (b.vx) this.face = Math.sign(b.vx);
        this.ledgeCd = 0.25;
        return false;
      }
      const my = Math.abs(controls.moveY) > 0.25 ? Math.sign(controls.moveY) : 0;
      b.vx = 0;
      b.vy = my * CLIMB_SPEED;
      b.dropThrough = 0.1;
      b.x += (Math.floor(b.x / 16) * 16 + 8 - b.x) * Math.min(1, dt * 12);
      if (my) this.play('climb');
      this.sprite.anims.timeScale = my ? 1 : 0;
      b.step(L, dt, true);
      // Off the top: step onto the ledge or the ladder's top rung
      if (my < 0 && !L.climbablePx(b.x, b.y - 2) && !L.climbablePx(b.x, b.cy)) {
        const top = Math.ceil((b.y - 2) / 16) * 16;
        const tx = Math.floor(b.x / 16);
        if (!L.oneWayAt(tx, top / 16) && !L.solidAt(tx, top / 16) && !L.oneWayAt(tx, top / 16 - 1)) {
          // A chain hanging in open air: nothing to stand on, so hold at the top
          b.y = Math.max(b.y, top + 6);
          b.vy = 0;
          this.sprite.anims.timeScale = 0;
          this.syncVisuals(dt);
          return true;
        }
        b.y = top;
        b.vy = 0;
        b.dropThrough = 0; // we were passing through ledges while climbing; now stand on the top rung
        // A ledge right above the top rung: step up onto it rather than standing inside it
        if (L.oneWayAt(Math.floor(b.x / 16), b.y / 16 - 1) && !L.solidAt(Math.floor(b.x / 16), b.y / 16 - 4)) b.y -= 16;
        this.sprite.anims.timeScale = 1;
        this.setState('move');
      } else if (my > 0 && (b.onGround || !L.climbablePx(b.x, b.y - 4))) {
        // Down past the last rung (by the feet, not the waist: starting down
        // from the top the waist is still above the ladder)
        this.sprite.anims.timeScale = 1;
        this.setState('move');
      }
      this.syncVisuals(dt);
      return true;
    }
    if (this.state === 'hang') {
      b.vx = 0;
      b.vy = 0;
      if (controls.take('jump') || controls.moveY < -0.5 || (Math.abs(controls.moveX) > 0.5 && Math.sign(controls.moveX) === this.face && this.stateT > 0.18)) {
        this.mantleFrom = { x: b.x, y: b.y };
        this.setState('mantle');
        this.play('mantle');
      } else if (controls.moveY > 0.6 || (Math.abs(controls.moveX) > 0.5 && Math.sign(controls.moveX) === -this.face)) {
        this.ledgeCd = 0.35;
        this.setState('move');
      }
      this.syncVisuals(dt);
      return true;
    }
    if (this.state === 'mantle') {
      const k = Math.min(1, this.stateT / 0.24);
      const e = k * k * (3 - 2 * k);
      // Up first, then over
      b.x = Phaser.Math.Linear(this.mantleFrom.x, this.mantleTo.x, Math.max(0, (e - 0.4) / 0.6));
      b.y = Phaser.Math.Linear(this.mantleFrom.y, this.mantleTo.y, Math.min(1, e / 0.7));
      if (k >= 1) {
        b.vy = 0;
        b.onGround = true;
        this.setState('move');
      }
      this.syncVisuals(dt);
      return true;
    }
    return false;
  }

  update(dt: number) {
    const run = currentRun();
    const w = this.world;
    const b = this.body;
    this.stateT += dt;
    this.dodgeAge += dt;
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);
    this.sprite.setAlpha(this.hurtInvuln > 0 && this.state !== 'dead' && Math.floor(this.hurtInvuln * 20) % 2 ? 0.45 : 1);

    // Censer: choking and regeneration
    if (this.chokeT > 0) {
      this.chokeT -= dt;
      if (Math.random() < dt * 6) w.fx.smoke(this.x, this.y - 56, 1);
      if (this.chokeT <= 0) run.stamina = Math.max(run.stamina, run.maxStamina * 0.35);
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0 && this.state !== 'charge') {
        run.stamina = Math.min(run.maxStamina, run.stamina + 36 * (hasSacrament('glutton') ? 0.6 : 1) * dt);
      }
    }
    w.sc.registry.set('choking', this.chokeT > 0);

    if (b.onGround) {
      this.coyote = 0.1;
      this.airDashed = false;
    } else this.coyote -= dt;

    this.ledgeCd = Math.max(0, this.ledgeCd - dt);
    if (this.updateClimb(dt)) return;

    const wet = w.level.inLiquid(this.x, this.y);
    const speedMul = (wet ? 0.55 : 1) * (this.choking ? 0.5 : 1);
    let targetVx = 0;
    let accel = b.onGround ? 1400 : 900;
    let gravityOn = true;

    switch (this.state) {
      case 'dead':
        b.vx *= 0.9;
        b.step(w.level, dt);
        this.syncVisuals(dt);
        return;
      case 'locked':
        this.play('idle');
        break;
      case 'move': {
        if (controls.take('dodge') && this.canDodge()) {
          this.startDodge();
          break;
        }
        if (controls.take('execute')) {
          const e = this.nearestStaggered();
          if (e) {
            this.startExecute(e);
            break;
          }
        }
        if (controls.take('stigma') && meta().equipped.includes('maw') && this.nearestCorpse()) {
          this.startDevour();
          break;
        }
        if (controls.take('tear')) {
          this.startWeep();
          if ((this.state as PState) === 'weep') break;
        }
        // Ladders and chains
        {
          const L = w.level;
          const up = controls.moveY < -0.55 && (L.climbablePx(this.x, this.body.cy) || L.climbablePx(this.x, this.body.top + 6));
          const below = L.climbablePx(this.x, this.y + 4) || (L.oneWayAt(Math.floor(this.x / 16), Math.floor((this.y + 4) / 16)) && L.climbablePx(this.x, this.y + 20));
          const down = controls.moveY > 0.55 && ((b.onGround && below) || (!b.onGround && L.climbablePx(this.x, this.body.cy)));
          if (up || down) {
            this.startClimb();
            break;
          }
        }
        if (controls.take('attack')) {
          if (!b.onGround) this.startSwing(AIR);
          else if (controls.moveY < -0.55) this.startSwing(UP);
          else this.setState('charge');
          break;
        }
        // Jump / drop through ledges
        if (controls.peek('jump')) {
          const standingOnLedge = b.onGround && w.level.oneWayAt(Math.floor(this.x / 16), Math.floor(this.y / 16));
          if (controls.moveY > 0.55 && standingOnLedge) {
            controls.take('jump');
            b.dropThrough = 0.25;
            b.y += 1;
          } else if (this.coyote > 0) {
            controls.take('jump');
            b.vy = -JUMP_V * (wet ? 0.8 : 1);
            this.coyote = 0;
            sfx(w.sc, 'dodge', { volume: 0.35, rate: 1.4 });
          }
        }
        if (!controls.isHeld('jump') && b.vy < -160) b.vy = -160;
        const mx = controls.moveX;
        if (Math.abs(mx) > 0.15) {
          this.face = mx > 0 ? 1 : -1;
          const sneaking = Math.abs(mx) < 0.55 && b.onGround;
          targetVx = this.face * (sneaking ? SNEAK : RUN * Math.min(1, Math.abs(mx) * 1.25)) * speedMul;
          if (b.onGround) {
            this.play(sneaking ? 'sneak' : 'run');
            this.stepT -= dt;
            if (this.stepT <= 0 && !sneaking) {
              this.stepT = 0.3;
              sfx(w.sc, 'footstep_wet', { volume: wet ? 1 : 0.45 });
              w.noise(this.x, this.y, wet ? 130 : 95, 'step');
            }
          }
        } else if (b.onGround) this.play(this.landT > 0 ? 'kneel' : 'idle');
        if (!b.onGround) this.play(b.vy < 0 ? 'jump' : 'fall');
        break;
      }
      case 'charge': {
        const held = controls.heldMs('attack');
        if (!controls.attackHeld) {
          if (this.stateT < CHARGE_MS / 1000) this.startSwing(COMBO[(this.combo = 0)]);
          else this.startSwing(HEAVY);
          this.chargeGlow.setAlpha(0);
          break;
        }
        if (held > CHARGE_MS) {
          const k = Math.min(1, (held - CHARGE_MS) / 300);
          this.chargeGlow.setAlpha(0.35 + 0.25 * Math.sin(this.stateT * 20) * k).setScale(0.7 + k * 0.5);
          this.play('charge');
          if (Math.abs(controls.moveX) > 0.15) {
            this.face = Math.sign(controls.moveX);
            targetVx = this.face * SNEAK * 0.6;
          }
        }
        break;
      }
      case 'windup':
        if (this.target && !this.target.dead && Math.abs(this.target.x - this.x) > 6) this.face = this.target.x > this.x ? 1 : -1;
        if (this.stateT >= this.swing.windup) {
          this.setState('active');
          sfx(w.sc, this.swing.heavy || this.swing.key === 'a3' ? 'chain_swing_heavy' : 'chain_swing');
          w.noise(this.x, this.y, 170, 'combat');
          this.play(this.swing.heavy ? 'a3-1' : `${this.swing.key}-1`);
          if (this.swing.lunge && b.onGround) b.vx = this.face * this.swing.lunge;
          const [px, py] = this.pivot();
          const a0 = this.angleAt(0);
          const a1 = this.angleAt(1);
          w.fx.swoosh(px, py, this.reach() - 4, a0, a1, this.swing.heavy ? P.blood0 : P.bone1);
        }
        accel = 300;
        targetVx = b.vx * 0.9;
        break;
      case 'active':
        this.checkHits();
        accel = 400;
        targetVx = b.vx;
        if (this.stateT >= this.swing.active) {
          this.setState('recover');
          this.queued = false;
          // (the up-swing has only two poses)
          const rec = `${this.swing.key}-2`;
          this.play(this.sprite.scene.anims.exists(`player:${rec}`) ? rec : `${this.swing.key}-1`);
        }
        break;
      case 'recover':
        if (controls.take('attack')) this.queued = true;
        if (controls.peek('dodge') && this.canDodge() && this.stateT > 0.05) {
          controls.take('dodge');
          this.combo = 0;
          this.startDodge();
          break;
        }
        if (controls.peek('jump') && b.onGround && this.stateT > 0.08) {
          this.combo = 0;
          this.setState('move');
          break;
        }
        if (controls.take('execute')) {
          const e = this.nearestStaggered();
          if (e) {
            this.startExecute(e);
            break;
          }
        }
        if (this.queued && this.stateT > this.swing.recover * 0.35 && !this.swing.heavy && this.swing.key !== 'up' && this.combo < COMBO.length - 1 && b.onGround) {
          this.combo++;
          this.startSwing(COMBO[this.combo]);
          break;
        }
        if (this.stateT >= this.swing.recover) {
          this.combo = 0;
          this.setState('move');
        }
        accel = 900;
        break;
      case 'dodge': {
        const k = 1 - this.stateT / DODGE_TIME;
        targetVx = this.face * 320 * Math.max(0.2, k) * (wet ? 0.7 : 1);
        accel = 5000;
        if (!b.onGround && this.stateT < 0.22) {
          gravityOn = false;
          b.vy = 0;
        }
        if (Math.random() < 0.5) w.fx.smoke(this.x - this.face * 8, this.y - 4, 1, P.smoke1);
        if (this.stateT >= DODGE_TIME) this.setState('move');
        break;
      }
      case 'execute': {
        const e = this.target;
        if (e) {
          const d = e.x - this.x;
          if (Math.abs(d) > 22) targetVx = Math.sign(d) * 200;
          accel = 3000;
        }
        if (this.stateT > 0.3 && this.target) {
          this.play('a3-1');
          this.finishExecute();
        }
        if (this.stateT > 0.7) this.setState('move');
        break;
      }
      case 'devour':
        if (this.stateT > 0.9) {
          this.finishDevour();
          this.setState('move');
        }
        break;
      case 'weep':
        if (this.stateT > 0.6) {
          this.finishWeep();
          this.setState('move');
        }
        break;
      case 'hurt':
        accel = 200;
        targetVx = b.vx;
        if (this.stateT > 0.3 && b.onGround) this.setState('move');
        if (this.stateT > 0.8) this.setState('move');
        break;
    }

    // Horizontal velocity eases toward its target
    const dv = targetVx - b.vx;
    const maxDv = accel * dt;
    b.vx += Phaser.Math.Clamp(dv, -maxDv, maxDv);
    b.h = this.state === 'dodge' ? 22 : 46;
    b.gravity = gravityOn ? 1 : 0;
    const wasAir = !b.onGround;
    const fallV = b.vy;
    b.step(w.level, dt);
    if (wasAir && b.onGround && fallV > 300) {
      this.landT = 0.12;
      sfx(w.sc, 'footstep_wet', { volume: 0.9, rate: 0.8 });
      w.noise(this.x, this.y, 140, 'step');
      w.fx.smoke(this.x, this.y - 2, 3, P.smoke1);
    }
    this.landT -= dt;
    if (b.onGround) w.level.standOn(this.x, this.y + 2);
    if (this.state === 'move' && !b.onGround) this.tryLedge();
    this.syncVisuals(dt);
  }

  // -------------------------------------------------------------------------
  // Visuals: sprite, chain, tether
  // -------------------------------------------------------------------------

  private handPos(): [number, number] {
    const frame = Number(this.sprite.frame.name);
    const h = heroMeta.hands[frame] ?? [ORIGIN_X + 8, FOOT_Y - 30];
    return [this.x + (h[0] - ORIGIN_X) * this.face, this.y + (h[1] - FOOT_Y)];
  }

  private syncVisuals(dt: number) {
    const s = this.sprite;
    s.setFlipX(this.face < 0);
    s.setOrigin(this.face > 0 ? ORIGIN_X / FW : 1 - ORIGIN_X / FW, FOOT_Y / 96);
    s.setPosition(Math.round(this.x), Math.round(this.y) + 0);
    this.chargeGlow.setPosition(this.x, this.y - 40);
    const [hx, hy] = this.handPos();

    // Chain head target
    let tx: number;
    let ty: number;
    let snap = false;
    const reach = this.reach();
    const [px, py] = this.pivot();
    if (this.state === 'windup' || (this.state === 'charge' && controls.heldMs('attack') > CHARGE_MS)) {
      const a = this.state === 'charge' ? this.stateT * 14 : this.angleAt(0) + Math.PI * 0.15 * -this.face;
      const r = this.state === 'charge' ? 18 : reach * 0.5;
      tx = px + Math.cos(a) * r;
      ty = py + Math.sin(a) * r;
    } else if (this.state === 'active') {
      const a = this.angleAt(Math.min(1, this.stateT / this.swing.active));
      tx = px + Math.cos(a) * reach;
      ty = py + Math.sin(a) * reach;
      snap = true;
    } else {
      // Dragging behind along the floor
      tx = this.x - this.face * 16;
      ty = this.y - 4;
    }
    if (snap) {
      this.headPos.set(tx, ty);
      this.headVel.set(0, 0);
    } else {
      const k = 70;
      const damp = 10;
      this.headVel.x += ((tx - this.headPos.x) * k - this.headVel.x * damp) * dt;
      this.headVel.y += ((ty - this.headPos.y) * k - this.headVel.y * damp + 300) * dt;
      this.headPos.x += this.headVel.x * dt;
      this.headPos.y += this.headVel.y * dt;
      // The shackle rests on the floor, never in it
      const fy = this.world.level.floorY(this.headPos.x, this.headPos.y - 6);
      if (fy !== null && this.headPos.y > fy - 4) {
        this.headPos.y = fy - 4;
        this.headVel.y = 0;
        this.headVel.x *= 0.8;
      }
    }
    this.head.setPosition(Math.round(this.headPos.x), Math.round(this.headPos.y));
    const dist = Phaser.Math.Distance.Between(hx, hy, this.headPos.x, this.headPos.y);
    const sag = this.state === 'active' ? 0 : Math.max(0, 30 - dist) * 0.4 + 3;
    for (let i = 0; i < LINKS; i++) {
      const t = (i + 1) / (LINKS + 1);
      const lx = hx + (this.headPos.x - hx) * t;
      const ly = hy + (this.headPos.y - hy) * t + Math.sin(t * Math.PI) * sag;
      this.links[i].setPosition(Math.round(lx), Math.round(ly)).setRotation(Math.atan2(this.headPos.y - hy, this.headPos.x - hx));
    }

    // The snapped scarlet tether streaming from the nape (verlet rope)
    const ax = this.x - this.face * 3;
    const ay = this.y - (this.state === 'dodge' ? 18 : 56);
    this.rope[0].x = ax;
    this.rope[0].y = ay;
    for (let i = 1; i < this.rope.length; i++) {
      const p = this.rope[i];
      const nx = p.x + (p.x - p.px) * 0.88;
      const ny = p.y + (p.y - p.py) * 0.88 + 900 * dt * dt;
      p.px = p.x;
      p.py = p.y;
      p.x = nx;
      p.y = Math.min(ny, this.y);
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < this.rope.length; i++) {
        const a = this.rope[i - 1];
        const b2 = this.rope[i];
        const dx = b2.x - a.x;
        const dy = b2.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - 3) / d;
        if (i === 1) {
          b2.x -= dx * diff;
          b2.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b2.x -= dx * diff * 0.5;
          b2.y -= dy * diff * 0.5;
        }
      }
    }
    const g = this.tether;
    g.clear();
    if (this.state !== 'dead') {
      for (let i = 0; i < this.rope.length - 1; i++) {
        const a = this.rope[i];
        const c = this.rope[i + 1];
        g.fillStyle(i % 3 === 2 ? hexNum(P.blood2) : hexNum(P.blood1), 1);
        g.fillRect(Math.round(a.x), Math.round(a.y), 2, 2);
        g.fillRect(Math.round((a.x + c.x) / 2), Math.round((a.y + c.y) / 2), 1, 1);
      }
      const end = this.rope[this.rope.length - 1];
      g.fillStyle(hexNum(P.blood0), 1).fillRect(Math.round(end.x), Math.round(end.y), 1, 2);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.head.destroy();
    this.links.forEach((l) => l.destroy());
    this.tether.destroy();
    this.chargeGlow.destroy();
  }
}
