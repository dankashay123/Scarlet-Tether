import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { FOOT_Y, FH, FW, heroMeta } from '../art/hero';
import { DEPTH } from './config';
import { controls } from './controls';
import { currentRun, hasSacrament, meta, rite } from './state';
import { sfx } from './audio';
import { Body } from './physics';
import type { Enemy } from './enemies';
import type { World } from './world';
import { CRIME_VISIONS, DEVOUR_VISIONS } from './lore';

type PState = 'move' | 'dodge' | 'execute' | 'devour' | 'weep' | 'hurt' | 'dead' | 'locked' | 'climb' | 'hang' | 'mantle';

/** Eight ways to point the Tether Cannon, as on a SNES pad. */
export type Aim = 'fwd' | 'up' | 'diag-up' | 'diag-down' | 'down';
const AIM_ANGLE: Record<Aim, number> = { fwd: 0, 'diag-up': -Math.PI / 4, up: -Math.PI / 2, 'diag-down': Math.PI / 4, down: Math.PI / 2 };

export type Weapon = 'bolt' | 'shell';

export const DODGE_TIME = 0.42;
export const DODGE_IFRAMES = 0.3;
export const PERFECT_WINDOW = 0.15;
const RUN = 112;
const SNEAK = 46;
const JUMP_V = 440; // apex ~5.25 tiles: rooms are built for 5-row hops
const CLIMB_SPEED = 84;
const BODY_H = 38;
const CROUCH_H = 26;
const FIRE_COOLDOWN = 0.16;
const CHARGE_TIME = 0.9; // hold fire this long for a charged bolt
const BOLT_SPEED = 420;
export const EXECUTE_RANGE = 34;
export const TEAR_COST = 6;
export const DEVOUR_RANGE = 28;
const ORIGIN_X = 29; // the hip in the hero frame

export class Player {
  body: Body;
  state: PState = 'move';
  stateT = 0;
  face = 1;
  aim: Aim = 'fwd';
  crouching = false;
  weapon: Weapon = 'bolt';
  sprite: Phaser.GameObjects.Sprite;
  private tether: Phaser.GameObjects.Graphics;
  private rope: { x: number; y: number; px: number; py: number }[] = [];
  private chargeGlow: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image;

  private fireCd = 0;
  private chargeT = 0;
  private ghostT = 0;
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
    this.body = new Body(x, y, 12, BODY_H);
    this.tether = s.add.graphics().setDepth(DEPTH.player - 2);
    this.sprite = s.add.sprite(x, y, 'player').setOrigin(ORIGIN_X / FW, FOOT_Y / FH).setDepth(DEPTH.player);
    this.sprite.play('player:idle');
    this.chargeGlow = s.add.image(x, y, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.blood0)).setAlpha(0).setDepth(DEPTH.light);
    this.flash = s.add.image(x, y, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.blood0)).setAlpha(0).setScale(0.5).setDepth(DEPTH.light);
    for (let i = 0; i < 7; i++) this.rope.push({ x, y: y - 30 + i * 2, px: x, py: y - 30 + i * 2 });
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
  get cy() {
    return this.body.cy;
  }
  get dodging() {
    return this.state === 'dodge';
  }
  get dead() {
    return this.state === 'dead';
  }
  get invulnerable() {
    return this.hurtInvuln > 0 || this.state === 'execute' || this.state === 'dead' || (this.state === 'dodge' && this.dodgeAge < DODGE_IFRAMES);
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

  private lockAnim = 'idle';
  /** Freeze the Severed in place (cutscenes, altars), optionally in a pose. */
  lock(v: boolean, anim = 'idle') {
    this.lockAnim = anim;
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
      this.world.fx.text(this.x, this.y - 48, 'Choking', P.smoke0);
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
    this.world.fx.text(this.x, this.y - 48, 'Choked', P.smoke0);
  }

  private play(key: string) {
    const k = `player:${key}`;
    if (this.sprite.anims.currentAnim?.key === k) return;
    if (this.sprite.scene.anims.exists(k)) this.sprite.play(k, true);
  }

  // -------------------------------------------------------------------------
  // The Tether Cannon
  // -------------------------------------------------------------------------

  /** Read the stick as an aim, SNES-style. Holding Aim plants the feet. */
  private readAim() {
    const mx = controls.moveX;
    const my = controls.moveY;
    const g = this.body.onGround;
    this.crouching = false;
    if (my < -0.55 && Math.abs(mx) < 0.4) this.aim = 'up';
    else if (my < -0.3 && Math.abs(mx) >= 0.4) this.aim = 'diag-up';
    else if (my > 0.3 && Math.abs(mx) >= 0.4) this.aim = 'diag-down';
    else if (my > 0.55 && Math.abs(mx) < 0.4) {
      if (g) {
        this.crouching = true;
        this.aim = 'fwd';
      } else this.aim = 'down';
    } else this.aim = 'fwd';
    if (g && this.aim === 'diag-down' && controls.isHeld('aim')) this.crouching = false;
  }

  /** The muzzle in world space, from the current frame's anchor. */
  private muzzle(): [number, number] {
    const frame = Number(this.sprite.frame.name);
    const m = (heroMeta as { muzzle?: [number, number, number][] }).muzzle?.[frame];
    if (m) return [this.x + (m[0] - ORIGIN_X) * this.face, this.y + (m[1] - FOOT_Y)];
    const a = AIM_ANGLE[this.aim];
    const h = this.crouching ? 14 : 24;
    return [this.x + Math.cos(a) * 14 * this.face, this.y - h + Math.sin(a) * 12];
  }

  private fire(charged: boolean) {
    const w = this.world;
    const run = currentRun();
    const a = AIM_ANGLE[this.aim];
    const dx = Math.cos(a) * this.face;
    const dy = Math.sin(a);
    const [mx, my] = this.muzzle();
    let weapon = this.weapon;
    if (weapon === 'shell' && (run.shells ?? 0) <= 0) weapon = 'bolt';
    if (weapon === 'shell') {
      run.shells--;
      w.firePlayerShot({ x: mx, y: my, vx: dx * 300, vy: dy * 300, kind: 'shell', dmg: 30, poise: 40, radius: 4 });
      sfx(w.sc, 'sludge', { volume: 0.7, rate: 1.5 });
      w.fx.shake(80, 0.004);
      this.body.vx -= dx * 30;
    } else {
      const dmg = (charged ? 26 : 7) * (1 + meta().weapon.weight * 0.15) * (hasSacrament('debt') ? 1.25 : 1);
      w.firePlayerShot({ x: mx, y: my, vx: dx * BOLT_SPEED, vy: dy * BOLT_SPEED, kind: charged ? 'charged' : 'bolt', dmg, poise: charged ? 30 : 6, radius: charged ? 5 : 2, pierce: charged });
      sfx(w.sc, 'spit', { volume: charged ? 0.8 : 0.4, rate: charged ? 0.9 : 1.7 });
    }
    this.flash.setPosition(mx, my).setAlpha(0.9).setScale(charged || weapon === 'shell' ? 0.9 : 0.45);
    w.noise(this.x, this.y, 150, 'combat');
    this.fireCd = weapon === 'shell' ? 0.3 : FIRE_COOLDOWN;
  }

  /** Fire, charge and weapon switching; runs alongside movement, as in Super Metroid. */
  private updateGun(dt: number) {
    this.fireCd -= dt;
    if (controls.take('weapon')) {
      const owns = (currentRun().shellsMax ?? 0) > 0;
      this.weapon = this.weapon === 'bolt' && owns ? 'shell' : 'bolt';
      sfx(this.world.sc, 'ui_select', { volume: 0.5 });
    }
    if (controls.take('attack') && this.fireCd <= 0) {
      this.fire(false);
      this.chargeT = 0;
    }
    // Holding fire gathers blood in the cannon for a charged bolt
    if (controls.attackHeld && this.weapon === 'bolt') {
      this.chargeT += dt;
      const k = Math.min(1, Math.max(0, (this.chargeT - 0.25) / (CHARGE_TIME - 0.25)));
      const [mx, my] = this.muzzle();
      this.chargeGlow.setPosition(mx, my).setAlpha(k > 0 ? 0.3 + 0.3 * k + 0.15 * Math.sin(this.stateT * 30) : 0).setScale(0.3 + k * 0.4);
    } else {
      if (this.chargeT >= CHARGE_TIME) this.fire(true);
      this.chargeT = 0;
      this.chargeGlow.setAlpha(0);
    }
    this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 10));
  }

  get charging() {
    return this.chargeT > 0.25;
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
    this.ghostT = 0;
    // Kick off: a burst of grit where the lunge starts
    if (this.grounded) this.world.fx.smoke(this.x - this.face * 6, this.y - 2, 4, P.smoke1);
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
    w.fx.text(this.x, this.y - 52, 'Perfect', P.gold0);
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
    dmg *= 1 - rite('iron') * 0.15;
    if (hasSacrament('lamb') && !this.lambUsed) {
      this.lambUsed = true;
      w.fx.text(this.x, this.y - 48, 'Forgiven', P.holy);
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
    return this.state === 'move' ? !!this.nearestStaggered() : false;
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
    this.play('aim-diag-down');
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
    const heal = Math.round(run.maxHp * (0.3 + rite('bloodrite') * 0.1) * (hasSacrament('glutton') ? 2 : 1));
    run.hp = Math.min(run.maxHp, run.hp + heal);
    run.executions++;
    run.sin++;
    w.fx.text(this.x, this.y - 54, `+${heal}`, P.blood0);
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
    this.world.fx.text(this.x, this.y - 52, '+32', P.tear0);
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
    this.world.fx.text(this.x, this.y - 52, '+24', P.blood0);
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

  /** Grab a ledge corner near the hands while airborne (stone corners and the ends of ledges). */
  private tryLedge(): boolean {
    const b = this.body;
    const L = this.world.level;
    if (b.onGround || b.vy < -220 || this.ledgeCd > 0) return false;
    const dir = Math.abs(controls.moveX) > 0.3 ? Math.sign(controls.moveX) : this.face;
    const hands = b.top + 4;
    const bx = Math.floor(b.x / 16);
    // Ledge assist: rising through (or hovering just under) a one-way ledge with the
    // feet a little short of its top: haul up onto it instead of falling back
    if (b.vy > -160 && controls.moveY < 0.5) {
      const ty = Math.floor((b.y - 1) / 16);
      const topY = ty * 16;
      if (b.y - topY > 2 && b.y - topY <= 22) {
        for (const ox of [0, -4, 4]) {
          const tx = Math.floor((b.x + ox) / 16);
          if (L.ch(tx, ty) !== '=' && L.ch(tx, ty) !== '%') continue;
          if (L.solidAt(tx, ty - 1) || L.solidAt(tx, ty - 2) || L.solidAt(bx, ty - 3)) continue;
          this.mantleFrom = { x: b.x, y: b.y };
          this.mantleTo = { x: b.x, y: topY };
          b.vx = 0;
          b.vy = 0;
          this.setState('mantle');
          this.play('mantle');
          return true;
        }
      }
    }
    // Reach a little: the stick on a phone rarely holds you flush to the wall
    for (const reach of [3, 9]) {
      const tx = Math.floor((b.x + dir * (b.w / 2 + reach)) / 16);
      if (tx === bx) continue;
      for (let ty = Math.floor((hands - 14) / 16); ty <= Math.floor((hands + 22) / 16); ty++) {
        const cornerY = ty * 16;
        if (cornerY < hands - 14 || cornerY > hands + 22) continue;
        const stone = L.solidAt(tx, ty);
        const ledgeEnd = !stone && L.ch(tx, ty) === '=' && !L.oneWayAt(tx - dir, ty) && !L.solidAt(tx - dir, ty);
        if (!stone && !ledgeEnd) continue;
        if (L.solidAt(tx, ty - 1) || L.solidAt(tx, ty - 2) || L.solidAt(tx, ty - 3)) continue;
        // Our own column must be open beside the ledge
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
      if (Math.random() < dt * 6) w.fx.smoke(this.x, this.y - 40, 1);
      if (this.chokeT <= 0) run.stamina = Math.max(run.stamina, run.maxStamina * 0.35);
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0) run.stamina = Math.min(run.maxStamina, run.stamina + 36 * (hasSacrament('glutton') ? 0.6 : 1) * dt);
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
        this.play(this.lockAnim);
        break;
      case 'move': {
        this.readAim();
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
        // Ladders and chains (not while planting the feet to aim)
        if (!controls.isHeld('aim')) {
          const L = w.level;
          const up = controls.moveY < -0.55 && Math.abs(controls.moveX) < 0.4 && (L.climbablePx(this.x, this.body.cy) || L.climbablePx(this.x, this.body.top + 6));
          const below = L.climbablePx(this.x, this.y + 4) || (L.oneWayAt(Math.floor(this.x / 16), Math.floor((this.y + 4) / 16)) && L.climbablePx(this.x, this.y + 20));
          const down = controls.moveY > 0.55 && Math.abs(controls.moveX) < 0.4 && ((b.onGround && below) || (!b.onGround && L.climbablePx(this.x, this.body.cy)));
          if (up || down) {
            this.startClimb();
            break;
          }
        }
        this.updateGun(dt);
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
            this.crouching = false;
            sfx(w.sc, 'dodge', { volume: 0.35, rate: 1.4 });
          }
        }
        if (!controls.isHeld('jump') && b.vy < -150) b.vy = -150;
        const mx = controls.moveX;
        const planted = controls.isHeld('aim') || this.crouching;
        if (Math.abs(mx) > 0.15) {
          this.face = mx > 0 ? 1 : -1;
          if (!planted) {
            const sneaking = Math.abs(mx) < 0.55 && b.onGround;
            targetVx = this.face * (sneaking ? SNEAK : RUN * Math.min(1, Math.abs(mx) * 1.25)) * speedMul;
            if (b.onGround) {
              this.stepT -= dt;
              if (this.stepT <= 0 && !sneaking) {
                this.stepT = 0.28;
                sfx(w.sc, 'footstep_wet', { volume: wet ? 1 : 0.4 });
                w.noise(this.x, this.y, wet ? 120 : 85, 'step');
              }
            }
          }
        }
        this.pickMoveAnim(Math.abs(targetVx) > 1);
        break;
      }
      case 'dodge': {
        // A long lunge: full speed for most of it, then a skidding ease-out
        const t = this.stateT / DODGE_TIME;
        const k = t < 0.6 ? 1 : Math.max(0.15, 1 - (t - 0.6) / 0.4);
        targetVx = this.face * 360 * (1 + rite('lunge') * 0.15) * k * (wet ? 0.7 : 1);
        accel = 9000;
        // Crimson afterimages streaming behind
        this.ghostT -= dt;
        if (this.ghostT <= 0 && t < 0.8) {
          this.ghostT = 0.035;
          const g = w.sc.add
            .image(this.sprite.x, this.sprite.y, this.sprite.texture.key, this.sprite.frame.name)
            .setOrigin(this.sprite.originX, this.sprite.originY)
            .setFlipX(this.sprite.flipX)
            .setTint(hexNum(P.blood1))
            .setAlpha(0.55)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDepth(DEPTH.player - 1);
          w.sc.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
        }
        if (t > 0.75 && b.onGround && Math.random() < 0.6) w.fx.smoke(this.x + this.face * 6, this.y - 2, 1, P.smoke1);
        if (!b.onGround && this.stateT < 0.22) {
          gravityOn = false;
          b.vy = 0;
        }
        if (this.stateT >= DODGE_TIME) this.setState('move');
        break;
      }
      case 'execute': {
        const e = this.target;
        if (e) {
          const d = e.x - this.x;
          if (Math.abs(d) > 18) targetVx = Math.sign(d) * 180;
          accel = 3000;
        }
        if (this.stateT > 0.3 && this.target) this.finishExecute();
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
        this.updateGun(dt);
        if (this.stateT > 0.3 && b.onGround) this.setState('move');
        if (this.stateT > 0.8) this.setState('move');
        break;
    }

    // Horizontal velocity eases toward its target
    const dv = targetVx - b.vx;
    const maxDv = accel * dt;
    b.vx += Phaser.Math.Clamp(dv, -maxDv, maxDv);
    const wantH = this.state === 'dodge' ? 18 : this.crouching ? CROUCH_H : BODY_H;
    // Stand up only if there is headroom
    if (wantH > b.h && w.level.solidPx(b.x, b.y - wantH + 1)) {
      this.crouching = true;
    } else b.h = wantH;
    b.gravity = gravityOn ? 1 : 0;
    const wasAir = !b.onGround;
    const fallV = b.vy;
    b.step(w.level, dt);
    if (wasAir && b.onGround && fallV > 300) {
      this.landT = 0.12;
      sfx(w.sc, 'footstep_wet', { volume: 0.9, rate: 0.8 });
      w.noise(this.x, this.y, 120, 'step');
      w.fx.smoke(this.x, this.y - 2, 3, P.smoke1);
    }
    this.landT -= dt;
    if (b.onGround) w.level.standOn(this.x, this.y + 2);
    if (this.state === 'move' && !b.onGround) this.tryLedge();
    this.syncVisuals(dt);
  }

  /** Pick the animation for standing, running, crouching or flying, with the cannon's aim. */
  private pickMoveAnim(running: boolean) {
    const b = this.body;
    if (!b.onGround) {
      if (this.aim === 'fwd') this.play(this.fireCd > 0 || this.charging ? 'air-fwd' : b.vy < 0 ? 'jump' : 'fall');
      else this.play(`air-${this.aim}`);
      return;
    }
    if (this.crouching) {
      this.play(this.aim === 'diag-up' ? 'crouch-diag-up' : 'crouch');
      return;
    }
    if (running) {
      this.play(this.aim === 'diag-up' ? 'run-diag-up' : this.aim === 'diag-down' ? 'run-diag-down' : 'run');
      return;
    }
    if (this.landT > 0 && this.aim === 'fwd') this.play('crouch');
    else if (this.aim === 'fwd') this.play('idle');
    else if (this.aim === 'down') this.play('crouch');
    else this.play(`aim-${this.aim}`);
  }

  // -------------------------------------------------------------------------
  // Visuals: sprite, muzzle glow, the snapped tether
  // -------------------------------------------------------------------------

  private syncVisuals(dt: number) {
    const s = this.sprite;
    s.setFlipX(this.face < 0);
    s.setOrigin(this.face > 0 ? ORIGIN_X / FW : 1 - ORIGIN_X / FW, FOOT_Y / FH);
    s.setPosition(Math.round(this.x), Math.round(this.y));

    // The snapped scarlet tether streaming from the nape (verlet rope)
    const ax = this.x - this.face * 3;
    const ay = this.y - (this.state === 'dodge' ? 14 : this.crouching ? 24 : 36);
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
        const diff = (d - 2.5) / d;
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
        g.fillStyle(i % 3 === 2 ? hexNum(P.blood2) : hexNum(P.blood1), 1);
        g.fillRect(Math.round(a.x), Math.round(a.y), 1, 2);
      }
    }
  }

  destroy() {
    this.sprite.destroy();
    this.tether.destroy();
    this.chargeGlow.destroy();
    this.flash.destroy();
  }
}
