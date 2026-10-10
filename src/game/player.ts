import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { controls } from './controls';
import { currentRun, hasSacrament, meta } from './state';
import { sfx } from './audio';
import type { Enemy } from './enemies';
import type { World } from './world';
import { CRIME_VISIONS, DEVOUR_VISIONS } from './lore';

type PState =
  | 'move'
  | 'windup'
  | 'active'
  | 'recover'
  | 'charge'
  | 'dodge'
  | 'execute'
  | 'devour'
  | 'weep'
  | 'hurt'
  | 'dead'
  | 'locked';

interface Swing {
  windup: number;
  active: number;
  recover: number;
  arc: number; // degrees
  reach: number;
  dmg: number;
  poise: number;
  stam: number;
  sweep: 1 | -1;
  heavy?: boolean;
}

const COMBO: Swing[] = [
  { windup: 0.14, active: 0.1, recover: 0.22, arc: 150, reach: 34, dmg: 12, poise: 12, stam: 12, sweep: 1 },
  { windup: 0.15, active: 0.1, recover: 0.24, arc: 150, reach: 34, dmg: 14, poise: 12, stam: 12, sweep: -1 },
  { windup: 0.26, active: 0.18, recover: 0.4, arc: 360, reach: 40, dmg: 22, poise: 28, stam: 20, sweep: 1 },
];
const HEAVY: Swing = { windup: 0.1, active: 0.18, recover: 0.42, arc: 220, reach: 46, dmg: 38, poise: 45, stam: 28, sweep: 1, heavy: true };

export const DODGE_TIME = 0.28;
export const DODGE_IFRAMES = 0.22;
export const PERFECT_WINDOW = 0.14;
const CHARGE_MS = 380;
const SPEED = 96;
const SNEAK = 46;
const LINKS = 9;
export const EXECUTE_RANGE = 34;
export const TEAR_COST = 6;
export const DEVOUR_RANGE = 30;

export class Player {
  x: number;
  y: number;
  readonly r = 5;
  state: PState = 'move';
  stateT = 0;
  facing = Math.PI / 2; // radians, 0 = right
  sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private links: Phaser.GameObjects.Image[] = [];
  private head: Phaser.GameObjects.Image;
  private headPos = new Phaser.Math.Vector2();
  private headVel = new Phaser.Math.Vector2();
  private tether: Phaser.GameObjects.Graphics;
  private rope: { x: number; y: number; px: number; py: number }[] = [];
  private chargeGlow: Phaser.GameObjects.Image;

  private combo = 0;
  private swing: Swing = COMBO[0];
  private aim = 0;
  private hitThisSwing = new Set<Enemy>();
  private queued = false;
  private strikes = 0;
  private dodgeDir = new Phaser.Math.Vector2();
  private perfectUsed = false;
  dodgeAge = 99;
  private hurtInvuln = 0;
  private staminaDelay = 0;
  chokeT = 0;
  private stepT = 0;
  private target: Enemy | null = null;
  private lambUsed = false;
  vx = 0;
  vy = 0;

  constructor(
    private world: World,
    x: number,
    y: number,
  ) {
    const s = world.sc;
    this.x = x;
    this.y = y;
    this.shadow = s.add.image(x, y, 'shadow').setDepth(DEPTH.shadow).setAlpha(0.5);
    this.tether = s.add.graphics();
    for (let i = 0; i < LINKS; i++) this.links.push(s.add.image(x, y, 'chain-link'));
    this.head = s.add.image(x, y, 'chain-head');
    this.sprite = s.add.sprite(x, y, 'player').setOrigin(0.5, 0.92);
    this.sprite.play('player:idle-down');
    this.chargeGlow = s.add.image(x, y, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.blood0)).setAlpha(0).setDepth(DEPTH.light);
    this.headPos.set(x + 6, y + 4);
    for (let i = 0; i < 8; i++) this.rope.push({ x, y: y - 14 + i * 2, px: x, py: y - 14 + i * 2 });
    this.lambUsed = false;
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
      this.world.fx.text(this.x, this.y - 34, 'Choking', P.smoke0);
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
    const run = currentRun();
    run.stamina = 0;
    this.chokeT = 2.4;
    sfx(this.world.sc, 'choke');
    this.world.fx.text(this.x, this.y - 34, 'Choked', P.smoke0);
  }

  private dirName(): 'down' | 'up' | 'side' {
    const a = Phaser.Math.Angle.Wrap(this.facing);
    if (a > Math.PI * 0.25 && a < Math.PI * 0.75) return 'down';
    if (a < -Math.PI * 0.25 && a > -Math.PI * 0.75) return 'up';
    return 'side';
  }

  private anim(base: string) {
    const d = this.dirName();
    this.sprite.setFlipX(d === 'side' && Math.cos(this.facing) < 0);
    const key = base === 'roll' || base === 'dead' ? `player:${base}` : `player:${base}-${d}`;
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key, true);
  }

  private chooseTarget(): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = Infinity;
    const inputA = controls.mag > 0.2 ? Math.atan2(controls.moveY, controls.moveX) : this.facing;
    for (const e of this.world.enemies) {
      if (!e.targetable) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d > 86) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(a - inputA));
      if (diff > Math.PI * 0.6 && d > 30) continue;
      const score = d + diff * 40;
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private startSwing(s: Swing) {
    this.swing = s;
    this.hitThisSwing.clear();
    this.target = this.chooseTarget();
    if (this.target) this.aim = Math.atan2(this.target.y - this.y, this.target.x - this.x);
    else this.aim = controls.mag > 0.2 ? Math.atan2(controls.moveY, controls.moveX) : this.facing;
    this.facing = this.aim;
    this.spend(s.stam);
    this.setState('windup');
    this.anim('windup');
  }

  private reach() {
    return this.swing.reach + meta().weapon.length * 5;
  }

  private damageFor(s: Swing): { dmg: number; crit: boolean } {
    let dmg = s.dmg * (1 + meta().weapon.weight * 0.15);
    if (hasSacrament('debt')) dmg *= 1.25;
    if (hasSacrament('knife')) dmg *= s.heavy ? 1.6 : 0.8;
    const critChance = hasSacrament('blindeye') ? 0.35 : 0.05;
    const crit = Math.random() < critChance;
    if (crit) dmg *= 2;
    return { dmg: Math.round(dmg), crit };
  }

  private canDodge() {
    return !this.choking && currentRun().stamina > 0;
  }

  private startDodge() {
    const mx = controls.moveX;
    const my = controls.moveY;
    if (controls.mag > 0.2) this.dodgeDir.set(mx, my).normalize();
    else this.dodgeDir.set(Math.cos(this.facing), Math.sin(this.facing));
    this.facing = Math.atan2(this.dodgeDir.y, this.dodgeDir.x);
    this.spend(hasSacrament('promise') ? 12 : 24);
    this.dodgeAge = 0;
    this.perfectUsed = false;
    this.setState('dodge');
    this.anim('roll');
    sfx(this.world.sc, 'dodge', { volume: 0.7 });
    this.world.noise(this.x, this.y, 110, 'combat');
  }

  /** Called by the world when an attack lands inside the perfect window. */
  perfectDodge(source: Enemy | null) {
    if (this.perfectUsed) return;
    this.perfectUsed = true;
    const w = this.world;
    const run = currentRun();
    sfx(w.sc, 'perfect_dodge');
    run.stamina = Math.min(run.maxStamina, run.stamina + 24);
    w.slowEnemies(900, 0.25);
    w.fx.ring(this.x, this.y - 8, 34, P.holy, 350);
    w.fx.text(this.x, this.y - 36, 'Perfect', P.gold0);
    w.sc.cameras.main.flash(90, 255, 248, 220, false);
    if (source && !source.dead) source.breakPoise(0.6);
    if (hasSacrament('promise')) w.changeLucidity(-3, 'promise');
    if (meta().equipped.includes('helix')) this.shriek();
  }

  /** The Flayed Helix screams what it has heard. */
  private shriek() {
    const w = this.world;
    w.fx.ring(this.x, this.y - 8, 74, P.flesh1, 420);
    w.fx.ring(this.x, this.y - 8, 54, P.blood0, 300);
    w.fx.shake(160, 0.008);
    sfx(w.sc, 'whisper', { rate: 1.6, volume: 0.9 });
    for (const e of w.enemies) {
      if (!e.targetable) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < 76) {
        e.takeHit(10, 60, this.x, this.y, { knock: 160 });
      }
    }
    w.changeLucidity(-5, 'helix');
  }

  hurt(dmg: number, fromX: number, fromY: number, choke: boolean): boolean {
    const w = this.world;
    const run = currentRun();
    if (hasSacrament('lamb') && !this.lambUsed) {
      this.lambUsed = true;
      w.fx.text(this.x, this.y - 34, 'Forgiven', P.holy);
      this.hurtInvuln = 0.6;
      return false;
    }
    run.hp = Math.max(0, run.hp - dmg);
    this.hurtInvuln = 0.75;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    this.vx = Math.cos(a) * 150;
    this.vy = Math.sin(a) * 150;
    w.fx.blood(this.x, this.y - 10, 10, Math.cos(a), Math.sin(a));
    w.fx.decal(this.x, this.y + 2, 0.7);
    w.fx.shake(140, 0.008);
    w.hitstop(60);
    sfx(w.sc, 'hit_player');
    this.sprite.setTintFill(0xffffff);
    w.sc.time.delayedCall(70, () => this.sprite.clearTint());
    if (choke) this.choke();
    if (run.hp <= 0) {
      this.die();
      return true;
    }
    this.setState('hurt');
    return true;
  }

  private die() {
    this.setState('dead');
    this.sprite.play('player:dead');
    this.sprite.setFlipX(false);
    this.head.setVisible(false);
    this.links.forEach((l) => l.setVisible(false));
    this.world.fx.blood(this.x, this.y - 6, 30);
    this.world.fx.decal(this.x, this.y + 4, 1.4);
    sfx(this.world.sc, 'death_player');
  }

  private nearestStaggered(): Enemy | null {
    let best: Enemy | null = null;
    let bd = EXECUTE_RANGE;
    for (const e of this.world.enemies) {
      if (!e.executable) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
      if (d < bd) {
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
      const d = Phaser.Math.Distance.Between(this.x, this.y, c.x, c.y);
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
    this.facing = Math.atan2(e.y - this.y, e.x - this.x);
    this.anim('raise');
    const cam = w.sc.cameras.main;
    cam.zoomTo(1.35, 220, 'Cubic.easeOut');
    w.slowEnemies(700, 0);
  }

  private finishExecute() {
    const w = this.world;
    const e = this.target;
    const run = currentRun();
    w.sc.cameras.main.zoomTo(1, 300, 'Cubic.easeInOut');
    if (!e) return;
    sfx(w.sc, 'execute');
    w.hitstop(220);
    w.fx.shake(260, 0.014);
    w.fx.blood(e.x, e.y - 12, 46, 0, -1, 1.4);
    w.fx.decal(e.x, e.y + 2, 1.6);
    w.fx.decal(e.x + 8, e.y - 4, 1);
    e.executed();
    const heal = Math.round(run.maxHp * 0.3 * (hasSacrament('glutton') ? 2 : 1));
    run.hp = Math.min(run.maxHp, run.hp + heal);
    run.executions++;
    run.sin++;
    w.fx.text(this.x, this.y - 36, `+${heal}`, P.blood0);
    w.changeLucidity(-8, 'execute');
    this.target = null;
  }

  private startWeep() {
    const run = currentRun();
    if (run.tears < TEAR_COST || run.hp >= run.maxHp) return;
    run.tears -= TEAR_COST;
    this.setState('weep');
    this.anim('raise');
    sfx(this.world.sc, 'heal', { volume: 0.7 });
  }

  private finishWeep() {
    const run = currentRun();
    const heal = 32;
    run.hp = Math.min(run.maxHp, run.hp + heal);
    this.world.fx.text(this.x, this.y - 36, `+${heal}`, P.tear0);
    this.world.changeLucidity(-12, 'tears');
    this.world.vision(Phaser.Utils.Array.GetRandom(CRIME_VISIONS));
  }

  private startDevour() {
    const c = this.nearestCorpse();
    if (!c) return;
    c.eaten = true;
    this.setState('devour');
    this.target = null;
    this.facing = Math.atan2(c.y - this.y, c.x - this.x);
    this.anim('strike');
    sfx(this.world.sc, 'devour');
    const w = this.world;
    w.sc.tweens.add({ targets: c.sprite, alpha: 0, scaleY: 0.3, duration: 800, onComplete: () => c.sprite.destroy() });
    for (let i = 0; i < 5; i++) w.sc.time.delayedCall(i * 150, () => w.fx.blood(c.x, c.y - 4, 4));
  }

  private finishDevour() {
    const run = currentRun();
    run.hp = Math.min(run.maxHp, run.hp + 24);
    run.devoured++;
    run.sin++;
    this.world.fx.text(this.x, this.y - 36, '+24', P.blood0);
    this.world.changeLucidity(-10, 'devour');
    this.world.vision(Phaser.Utils.Array.GetRandom(DEVOUR_VISIONS));
  }

  // -------------------------------------------------------------------------

  update(dt: number) {
    const run = currentRun();
    const w = this.world;
    this.stateT += dt;
    this.dodgeAge += dt;
    this.hurtInvuln = Math.max(0, this.hurtInvuln - dt);
    if (this.hurtInvuln > 0 && this.state !== 'dead') this.sprite.setAlpha(Math.floor(this.hurtInvuln * 20) % 2 ? 0.4 : 1);
    else this.sprite.setAlpha(1);

    // Censer: choking, regeneration
    if (this.chokeT > 0) {
      this.chokeT -= dt;
      if (Math.random() < dt * 6) w.fx.smoke(this.x, this.y - 18, 1);
      if (this.chokeT <= 0) run.stamina = Math.max(run.stamina, run.maxStamina * 0.35);
    } else {
      this.staminaDelay -= dt;
      if (this.staminaDelay <= 0 && this.state !== 'charge') {
        const rate = 36 * (hasSacrament('glutton') ? 0.6 : 1);
        run.stamina = Math.min(run.maxStamina, run.stamina + rate * dt);
      }
    }
    w.sc.registry.set('choking', this.chokeT > 0);

    let moveSpeed = 0;
    let mvx = 0;
    let mvy = 0;

    switch (this.state) {
      case 'dead':
        this.updateVisuals(dt);
        return;
      case 'locked':
        this.anim('idle');
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
        if (controls.take('attack')) {
          // Wait to see if this becomes a held charge
          this.setState('charge');
          break;
        }
        const m = controls.mag;
        if (m > 0.15) {
          this.facing = Math.atan2(controls.moveY, controls.moveX);
          const sneaking = m < 0.55;
          moveSpeed = sneaking ? SNEAK : SPEED * Math.min(1, m * 1.2);
          mvx = Math.cos(this.facing);
          mvy = Math.sin(this.facing);
          this.anim('walk');
          this.sprite.anims.timeScale = sneaking ? 0.55 : 1;
          this.stepT -= dt;
          if (this.stepT <= 0 && !sneaking) {
            this.stepT = 0.32;
            const wet = w.room.tileAtPx(this.x, this.y) === '~' || w.room.tileAtPx(this.x, this.y) === ',';
            sfx(w.sc, 'footstep_wet', { volume: wet ? 1 : 0.5 });
            w.noise(this.x, this.y, wet ? 120 : 85, 'step');
          }
        } else {
          this.anim('idle');
          this.sprite.anims.timeScale = 1;
        }
        break;
      }
      case 'charge': {
        // Tap = light combo; hold = charged heavy swing
        const held = controls.heldMs();
        if (!controls.attackHeld) {
          if (this.stateT < CHARGE_MS / 1000) this.startSwing(COMBO[(this.combo = 0)]);
          else this.startSwing(HEAVY);
          this.chargeGlow.setAlpha(0);
          break;
        }
        if (held > CHARGE_MS) {
          const k = Math.min(1, (held - CHARGE_MS) / 300);
          this.chargeGlow.setAlpha(0.35 + 0.25 * Math.sin(this.stateT * 20) * k).setScale(0.6 + k * 0.4);
          this.anim('windup');
          if (controls.mag > 0.15) {
            this.facing = Math.atan2(controls.moveY, controls.moveX);
            moveSpeed = SPEED * 0.4;
            mvx = Math.cos(this.facing);
            mvy = Math.sin(this.facing);
          }
        }
        break;
      }
      case 'windup':
        if (this.target && !this.target.dead) this.aim = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        if (this.stateT >= this.swing.windup) {
          this.setState('active');
          sfx(w.sc, this.swing.heavy || this.swing.arc >= 360 ? 'chain_swing_heavy' : 'chain_swing');
          w.noise(this.x, this.y, 170, 'combat');
          this.anim('strike');
        }
        break;
      case 'active': {
        // Lunge a little into the swing
        moveSpeed = this.swing.heavy ? 60 : 40;
        mvx = Math.cos(this.aim);
        mvy = Math.sin(this.aim);
        this.checkHits();
        if (this.stateT >= this.swing.active) {
          this.setState('recover');
          this.queued = false;
        }
        break;
      }
      case 'recover':
        if (controls.take('attack')) this.queued = true;
        if (controls.peek('dodge') && this.canDodge() && this.stateT > 0.06) {
          controls.take('dodge');
          this.combo = 0;
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
        if (this.queued && this.stateT > this.swing.recover * 0.35 && !this.swing.heavy && this.combo < COMBO.length - 1) {
          this.combo++;
          this.startSwing(COMBO[this.combo]);
          break;
        }
        if (this.stateT >= this.swing.recover) {
          this.combo = 0;
          this.setState('move');
        }
        break;
      case 'dodge': {
        const k = 1 - this.stateT / DODGE_TIME;
        moveSpeed = 300 * Math.max(0.15, k);
        mvx = this.dodgeDir.x;
        mvy = this.dodgeDir.y;
        if (Math.random() < 0.5) w.fx.smoke(this.x, this.y - 2, 1, P.smoke1);
        if (this.stateT >= DODGE_TIME) this.setState('move');
        break;
      }
      case 'execute': {
        const e = this.target;
        if (e) {
          // Close the distance to the victim
          const d = Phaser.Math.Distance.Between(this.x, this.y, e.x, e.y);
          if (d > 14) {
            moveSpeed = 160;
            mvx = (e.x - this.x) / d;
            mvy = (e.y - this.y) / d;
          }
        }
        if (this.stateT > 0.28 && this.target) {
          this.anim('strike');
          this.finishExecute();
        }
        if (this.stateT > 0.65) this.setState('move');
        break;
      }
      case 'devour':
        if (this.stateT > 0.9) {
          this.finishDevour();
          this.setState('move');
        }
        break;
      case 'weep':
        if (this.stateT > 0.5) {
          this.finishWeep();
          this.setState('move');
        }
        break;
      case 'hurt':
        if (this.stateT > 0.22) this.setState('move');
        break;
    }

    // Movement
    let speedMul = 1;
    const tile = w.room.tileAtPx(this.x, this.y);
    if (tile === '~' && this.state !== 'dodge') speedMul *= 0.5;
    if (this.choking) speedMul *= 0.5;
    const dx = (mvx * moveSpeed * speedMul + this.vx) * dt;
    const dy = (mvy * moveSpeed * speedMul + this.vy) * dt;
    this.vx *= Math.pow(0.0005, dt);
    this.vy *= Math.pow(0.0005, dt);
    const res = w.room.move(this.x, this.y, this.r, dx, dy);
    this.x = res.x;
    this.y = res.y;
    this.updateVisuals(dt);
  }

  private checkHits() {
    const w = this.world;
    const s = this.swing;
    const reach = this.reach();
    const arc = Phaser.Math.DegToRad(s.arc);
    const prog = Math.min(1, this.stateT / s.active);
    const start = this.aim - (arc / 2) * s.sweep;
    for (const e of w.enemies) {
      if (!e.targetable || this.hitThisSwing.has(e)) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y - 6, e.x, e.y - 6);
      if (d > reach + e.hurtR) continue;
      const a = Math.atan2(e.y - this.y, e.x - this.x);
      let rel = Phaser.Math.Angle.Wrap((a - start) * s.sweep);
      if (rel < 0) rel += Math.PI * 2;
      const tol = Math.atan2(e.hurtR, Math.max(d, 1));
      if (rel <= prog * arc + tol || (s.arc >= 360 && prog > 0.9) || d < 12) {
        this.hitThisSwing.add(e);
        const { dmg, crit } = this.damageFor(s);
        this.strikes++;
        const toxin = hasSacrament('tongue') && this.strikes % 3 === 0;
        const bleed = s.heavy && meta().weapon.marrow > 0;
        e.takeHit(dmg, s.poise, this.x, this.y, {
          knock: s.heavy ? 170 : 90,
          crit,
          toxin,
          bleed: bleed ? meta().weapon.marrow : 0,
        });
        w.hitstop(s.heavy ? 110 : crit ? 90 : 55);
        w.fx.shake(s.heavy ? 160 : 80, s.heavy ? 0.01 : 0.004);
        sfx(w.sc, Math.random() < 0.5 ? 'hit_flesh' : 'hit_flesh2');
      }
    }
  }

  /** Chain, tether, shadow, depth. */
  private updateVisuals(dt: number) {
    const s = this.sprite;
    s.setPosition(Math.round(this.x), Math.round(this.y));
    s.setDepth(DEPTH.actorBase + this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    this.chargeGlow.setPosition(this.x, this.y - 12);

    // Hand position
    const side = Math.cos(this.facing) >= 0 ? 1 : -1;
    const hx = this.x + side * 7;
    const hy = this.y - 9;

    // Where does the chain head want to be?
    let tx: number;
    let ty: number;
    let snap = false;
    const reach = this.reach();
    if (this.state === 'windup' || (this.state === 'charge' && this.stateT * 1000 > CHARGE_MS)) {
      const back = this.aim + Math.PI + (this.swing.sweep * Math.PI) / 4;
      const a = this.state === 'charge' ? this.facing + Math.PI + this.stateT * 14 : back;
      const r = this.state === 'charge' ? 16 : reach * 0.45;
      tx = this.x + Math.cos(a) * r;
      ty = this.y - 6 + Math.sin(a) * r * 0.7;
    } else if (this.state === 'active') {
      const arc = Phaser.Math.DegToRad(this.swing.arc);
      const prog = Math.min(1, this.stateT / this.swing.active);
      const a = this.aim - (arc / 2) * this.swing.sweep + arc * prog * this.swing.sweep;
      tx = this.x + Math.cos(a) * reach;
      ty = this.y - 6 + Math.sin(a) * reach * 0.8;
      snap = true;
    } else if (this.state === 'dead') {
      tx = this.x + 10;
      ty = this.y + 4;
    } else {
      // Dragging behind
      tx = this.x - Math.cos(this.facing) * 12 + side * 2;
      ty = this.y + 3 - Math.sin(this.facing) * 6;
    }
    if (snap) {
      this.headPos.set(tx, ty);
      this.headVel.set(0, 0);
    } else {
      // Spring the head towards its target so the chain has weight
      const k = 60;
      const damp = 9;
      this.headVel.x += ((tx - this.headPos.x) * k - this.headVel.x * damp) * dt;
      this.headVel.y += ((ty - this.headPos.y) * k - this.headVel.y * damp) * dt;
      this.headPos.x += this.headVel.x * dt;
      this.headPos.y += this.headVel.y * dt;
    }
    const behind = Math.sin(this.facing) < -0.3; // facing up: chain behind body
    const baseDepth = DEPTH.actorBase + this.y + (behind ? -1 : 1);
    this.head.setPosition(Math.round(this.headPos.x), Math.round(this.headPos.y)).setDepth(baseDepth + (this.state === 'active' ? 2 : 0));
    const dist = Phaser.Math.Distance.Between(hx, hy, this.headPos.x, this.headPos.y);
    const sag = Math.max(0, 22 - dist) * 0.5 + (this.state === 'active' ? 0 : 3);
    for (let i = 0; i < LINKS; i++) {
      const t = (i + 1) / (LINKS + 1);
      const lx = hx + (this.headPos.x - hx) * t;
      const ly = hy + (this.headPos.y - hy) * t + Math.sin(t * Math.PI) * sag;
      this.links[i].setPosition(Math.round(lx), Math.round(ly)).setDepth(baseDepth);
    }

    // The snapped scarlet tether trailing from the nape (verlet rope)
    const ax = this.x - Math.cos(this.facing) * 2;
    const ay = this.y - 15;
    this.rope[0].x = ax;
    this.rope[0].y = ay;
    for (let i = 1; i < this.rope.length; i++) {
      const p = this.rope[i];
      const nx = p.x + (p.x - p.px) * 0.86;
      const ny = p.y + (p.y - p.py) * 0.86 + 40 * dt * dt * 60;
      p.px = p.x;
      p.py = p.y;
      p.x = nx;
      p.y = Math.min(ny, this.y + 1);
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 1; i < this.rope.length; i++) {
        const a = this.rope[i - 1];
        const b = this.rope[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const diff = (d - 2.4) / d;
        if (i === 1) {
          b.x -= dx * diff;
          b.y -= dy * diff;
        } else {
          a.x += dx * diff * 0.5;
          a.y += dy * diff * 0.5;
          b.x -= dx * diff * 0.5;
          b.y -= dy * diff * 0.5;
        }
      }
    }
    const g = this.tether;
    g.clear();
    g.setDepth(DEPTH.actorBase + this.y + (Math.sin(this.facing) > 0.3 ? -2 : 2));
    if (this.state !== 'dead') {
      for (let i = 0; i < this.rope.length - 1; i++) {
        const a = this.rope[i];
        const b = this.rope[i + 1];
        g.fillStyle(i % 3 === 2 ? hexNum(P.blood2) : hexNum(P.blood1), 1);
        g.fillRect(Math.round(a.x), Math.round(a.y), 1, 1);
        g.fillRect(Math.round((a.x + b.x) / 2), Math.round((a.y + b.y) / 2), 1, 1);
      }
      const end = this.rope[this.rope.length - 1];
      g.fillStyle(hexNum(P.blood0), 1).fillRect(Math.round(end.x), Math.round(end.y), 1, 1);
    }
  }

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.head.destroy();
    this.links.forEach((l) => l.destroy());
    this.tether.destroy();
    this.chargeGlow.destroy();
  }
}
