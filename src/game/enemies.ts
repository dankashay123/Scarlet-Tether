import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { BLIND, CHERUB, GOSSIP, PENITENT } from '../art/creatures';
import { DEPTH } from './config';
import { sfx } from './audio';
import { currentRun, hasSacrament } from './state';
import { rotLevel } from './lucidity';
import { Body } from './physics';
import type { Corpse, World } from './world';

export type EnemyKind = 'blind' | 'gossip' | 'penitent' | 'cherub' | 'boss' | 'ear';

export interface HitOpts {
  knock?: number;
  crit?: boolean;
  toxin?: boolean;
  bleed?: number;
  heavy?: boolean;
}

type EState = 'spawn' | 'idle' | 'wander' | 'hunt' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead';

/** Shared behaviour for every creature of the Under-Naves. */
export abstract class Enemy {
  /** Set when the body becomes a corpse the player can devour. */
  corpse: Corpse | null = null;
  private restT = 0;
  abstract readonly kind: EnemyKind;
  body: Body;
  hurtR = 12;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  state: EState = 'spawn';
  stateT = 0;
  sprite: Phaser.GameObjects.Sprite;
  protected mark: Phaser.GameObjects.BitmapText;
  private alert: Phaser.GameObjects.BitmapText;
  private warnT = 0;
  protected skins: [string, string] | null = null;
  protected skin: string;
  protected face = 1;
  protected poiseRegenT = 0;
  protected attackHit = false;
  protected tearValue = 3;
  protected flying = false;
  protected knockResist = 1;
  protected baseTint: number | null = null;
  beingExecuted = false;
  elite = false;
  private toxinT = 0;
  private bleedT = 0;
  private bleedLvl = 0;
  private dotAcc = 0;
  private footY: number;

  constructor(
    protected world: World,
    x: number,
    y: number,
    tex: string,
    size: { w: number; h: number; footY?: number },
    bodyW: number,
    bodyH: number,
    hp: number,
    poise: number,
  ) {
    const s = world.sc;
    this.body = new Body(x, y, bodyW, bodyH);
    this.hp = this.maxHp = hp;
    this.poise = this.maxPoise = poise;
    this.skin = tex;
    this.footY = size.footY ?? size.h / 2;
    this.sprite = s.add.sprite(x, y, tex).setOrigin(0.5, this.footY / size.h).setDepth(DEPTH.enemy);
    this.sprite.play(`${tex}:${tex === 'cherub' ? 'fly' : 'idle'}`);
    this.mark = s.add.bitmapText(x, y, FONT_OUTLINE, '✞').setOrigin(0.5).setTint(hexNum(P.blood0)).setScale(1.5).setVisible(false).setDepth(DEPTH.overlay - 2);
    this.alert = s.add.bitmapText(x, y, FONT_OUTLINE, '!').setOrigin(0.5).setTint(hexNum(P.blood0)).setScale(2).setVisible(false).setDepth(DEPTH.overlay - 2);
    // Rise out of a welling of blood
    this.sprite.setAlpha(0);
    s.tweens.add({ targets: this.sprite, alpha: 1, duration: 600 });
    world.gore.pool(x, y, 1);
  }

  get x() {
    return this.body.x;
  }
  get y() {
    return this.body.y;
  }
  get cy() {
    return this.body.cy;
  }
  get dead() {
    return this.state === 'dead';
  }
  get targetable() {
    return this.state !== 'dead' && this.state !== 'spawn' && !this.beingExecuted;
  }
  get executable() {
    return this.state === 'stagger' && !this.beingExecuted;
  }
  protected get player() {
    return this.world.player;
  }
  protected dxToPlayer() {
    return this.player.x - this.x;
  }
  protected distToPlayer() {
    return Phaser.Math.Distance.Between(this.x, this.cy, this.player.x, this.player.cy);
  }

  protected setState(s: EState) {
    if (this.state === 'windup' && s !== 'windup') this.sprite.setScale(1); // windup throbs the sprite
    this.state = s;
    this.stateT = 0;
    this.attackHit = false;
  }

  protected play(name: string) {
    const k = `${this.skin}:${name}`;
    if (this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k, true);
  }

  protected telegraph(ms = 450) {
    this.warnT = ms / 1000;
    this.alert.setVisible(true).setScale(2.8);
    this.world.sc.tweens.add({ targets: this.alert, scale: 2, duration: 140 });
  }

  private updateSkin() {
    if (!this.skins) return;
    const want = rotLevel(currentRun().lucidity) < 0.3 ? this.skins[0] : this.skins[1];
    if (want === this.skin) return;
    const cur = this.sprite.anims.currentAnim?.key.split(':')[1] ?? 'idle';
    this.skin = want;
    this.sprite.play(`${want}:${cur}`, true);
  }

  breakPoise(frac: number) {
    if (this.dead) return;
    this.poise -= this.maxPoise * frac;
    if (this.poise <= 0) this.stagger();
  }

  stagger() {
    this.poise = 0;
    this.setState('stagger');
    this.play('stagger');
    this.world.fx.text(this.x, this.body.top - 8, 'Staggered', P.blood0, 10, 700);
  }

  takeHit(dmg: number, poiseDmg: number, fromX: number, fromY: number, o: HitOpts = {}) {
    if (!this.targetable) return;
    const w = this.world;
    const mult = this.state === 'stagger' ? 1.5 : 1;
    this.hp -= dmg * mult;
    this.poiseRegenT = 2;
    const dir = this.x >= fromX ? 1 : -1;
    const k = (o.knock ?? 120) * this.knockResist;
    this.body.vx = dir * k;
    if (!this.flying) this.body.vy = Math.min(this.body.vy, -k * 0.35);
    // Arterial spray away from the blow
    const a = Math.atan2(this.cy - fromY, (this.x - fromX) || dir);
    w.gore.spray(this.x, this.cy, a, o.crit || o.heavy ? 50 : 26, o.heavy ? 1.4 : 1.1);
    if (o.heavy || o.crit || Math.random() < 0.3) w.gore.gibs(this.x, this.cy, o.heavy ? 2 : 1, dir * 60);
    if (o.heavy && Math.random() < 0.4) w.gore.entrail(this.x, this.cy, 0.7);
    w.fx.text(this.x, this.body.top - 4, o.crit ? `${Math.round(dmg * mult)}!` : `${Math.round(dmg * mult)}`, o.crit ? P.gold0 : P.bone0);
    this.sprite.setTintFill(0xffffff);
    w.sc.time.delayedCall(60, () => !this.dead && this.restoreTint());
    if (o.toxin) {
      this.toxinT = 4;
      w.fx.text(this.x, this.body.top - 14, 'Toxin', P.bile0);
    }
    if (o.bleed) {
      this.bleedT = 4;
      this.bleedLvl = o.bleed;
    }
    this.onHurt();
    if (this.hp <= 0) {
      this.kill(false, o.heavy);
      return;
    }
    if (this.state !== 'stagger') {
      this.poise -= poiseDmg;
      if (this.poise <= 0) this.stagger();
    }
  }

  protected restoreTint() {
    if (this.baseTint !== null) this.sprite.setTint(this.baseTint);
    else this.sprite.clearTint();
  }

  protected onHurt() {}

  /** A Rite of Absolution: the body comes apart. */
  executed() {
    const w = this.world;
    const top = this.body.top + 6;
    w.gore.explode(this.x, this.cy, 1.6, -this.face);
    w.gore.gibs(this.x, top, 6, this.face * -40);
    w.gore.fountain(this.x, top + 4, 1800);
    this.kill(true, true);
  }

  kill(executed: boolean, heavy = false) {
    if (this.dead) return;
    const w = this.world;
    this.setState('dead');
    this.beingExecuted = false;
    this.mark.setVisible(false);
    this.alert.setVisible(false);
    this.play('dead');
    this.sprite.clearTint().setAlpha(1).setDepth(DEPTH.corpse);
    sfx(w.sc, 'death_enemy', { volume: 0.7 });
    if (!executed) w.gore.explode(this.x, this.cy, heavy ? 1.3 : 1, Math.sign(this.x - w.player.x) || 1);
    w.onEnemyKilled(this, executed);
  }

  get tears() {
    let n = this.tearValue + Math.floor(Math.random() * 3);
    if (hasSacrament('ledger')) n = Math.round(n * 1.5);
    if (hasSacrament('debt')) n = Math.max(1, Math.round(n * 0.5));
    return n;
  }

  /** Test a circular strike area against the player. */
  protected strike(cx: number, cy: number, radius: number, damage: number, choke = false) {
    if (this.attackHit) return;
    const p = this.player;
    const px = p.x;
    const py = p.cy;
    const dx = Math.max(Math.abs(px - cx) - 6, 0);
    const dy = Math.max(Math.abs(py - cy) - (p.state === 'dodge' ? 8 : 20), 0);
    if (dx * dx + dy * dy > radius * radius) return;
    const res = this.world.hitPlayer({ damage, x: this.x, y: this.cy, choke, source: this });
    if (res !== 'ignored') this.attackHit = true;
  }

  protected faceTo(x: number) {
    if (Math.abs(x - this.x) > 3) this.face = x >= this.x ? 1 : -1;
  }

  /** Walk in a direction without stepping off ledges or into walls. */
  protected walk(dir: number, speed: number) {
    const b = this.body;
    if (b.onGround && (!b.floorAhead(this.world.level, dir) || b.wallAhead(this.world.level, dir))) {
      b.vx = 0;
      return false;
    }
    b.vx = dir * speed;
    return true;
  }

  update(dt: number) {
    this.stateT += dt;
    if (this.warnT > 0) {
      this.warnT -= dt;
      this.alert.setPosition(Math.round(this.x), Math.round(this.body.top - 10));
      if (this.warnT <= 0 || this.state === 'stagger' || this.state === 'dead') {
        this.alert.setVisible(false);
        this.warnT = 0;
      }
    }
    if (!this.sprite.active) return; // eaten
    this.updateSkin();
    if (this.state === 'dead') {
      if (this.restT > 1) return; // settled: nothing left to simulate
      if (!this.flying || this.body.onGround) this.body.vx *= 0.85;
      this.body.step(this.world.level, dt);
      this.restT = this.body.onGround && Math.abs(this.body.vx) < 2 && this.world.level.solidPx(this.x, this.y + 2) ? this.restT + dt : 0;
      if (this.corpse) {
        this.corpse.x = this.x;
        this.corpse.y = this.y;
      }
      this.syncVisuals();
      return;
    }
    if (this.toxinT > 0 || this.bleedT > 0) {
      this.toxinT -= dt;
      this.bleedT -= dt;
      this.dotAcc += ((this.toxinT > 0 ? 4 : 0) + (this.bleedT > 0 ? 3 * this.bleedLvl : 0)) * dt;
      if (this.dotAcc >= 3) {
        this.hp -= this.dotAcc;
        this.world.fx.text(this.x, this.body.top, `${Math.round(this.dotAcc)}`, this.toxinT > 0 ? P.bile0 : P.blood1, 10, 500);
        this.dotAcc = 0;
        if (this.toxinT > 0) this.world.gore.bile(this.x, this.cy, 3);
        else this.world.gore.spray(this.x, this.cy, -Math.PI / 2, 3, 0.5, 2);
        if (this.hp <= 0) {
          this.kill(false);
          return;
        }
      }
    }
    if (this.state === 'spawn') {
      if (this.stateT > 0.7) this.setState('idle');
    } else if (this.state === 'stagger') {
      this.mark.setVisible(!this.beingExecuted).setPosition(this.x, this.body.top - 14 + Math.sin(this.stateT * 8) * 2);
      if (!this.flying) this.body.vx *= 0.9;
      if (!this.beingExecuted && this.stateT > 2.4) {
        this.poise = this.maxPoise;
        this.mark.setVisible(false);
        this.setState('recover');
      }
    } else {
      this.mark.setVisible(false);
      this.poiseRegenT -= dt;
      if (this.poiseRegenT <= 0) this.poise = Math.min(this.maxPoise, this.poise + this.maxPoise * 0.3 * dt);
      if (!this.beingExecuted) this.think(dt);
    }
    if (this.beingExecuted) this.body.vx *= 0.8;
    this.body.step(this.world.level, dt, this.flying && !this.dead);
    if (this.flying) {
      this.body.vx *= Math.pow(0.4, dt);
      this.body.vy *= Math.pow(0.4, dt);
    }
    this.syncVisuals();
  }

  protected syncVisuals() {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    this.sprite.setFlipX(this.face < 0);
  }

  protected abstract think(dt: number): void;

  destroy() {
    this.sprite.destroy();
    this.mark.destroy();
    this.alert.destroy();
  }
}

// ---------------------------------------------------------------------------

/** Former Severed who gouged their eyes. They hunt by sound alone. */
export class Blind extends Enemy {
  readonly kind = 'blind';
  private heardX = 0;
  private alertT = 0;
  private wanderDir = Math.random() < 0.5 ? -1 : 1;
  private cooldown = 0.6;

  constructor(world: World, x: number, y: number, elite = false) {
    super(world, x, y, 'blind', BLIND, 14, 44, elite ? 70 : 42, elite ? 40 : 26);
    this.skins = ['blind-saint', 'blind'];
    this.elite = elite;
    this.tearValue = elite ? 6 : 3;
    if (elite) this.sprite.setTint((this.baseTint = hexNum('#ffb0b0')));
  }

  hear(x: number) {
    if (this.alertT <= 0 && this.targetable && this.state !== 'stagger') this.world.fx.text(this.x, this.body.top - 6, '?', P.bone0, 8, 500);
    this.heardX = x;
    this.alertT = 3.5;
  }

  protected onHurt() {
    this.hear(this.player.x);
  }

  protected think(dt: number) {
    this.alertT -= dt;
    this.cooldown -= dt;
    const dx = this.dxToPlayer();
    const near = Math.abs(dx) < 30 && Math.abs(this.player.y - this.y) < 40;
    if (near) this.hear(this.player.x);
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        if (this.alertT > 0) {
          const hd = this.heardX - this.x;
          this.faceTo(this.heardX);
          if (Math.abs(dx) < 70 && Math.abs(this.player.y - this.y) < 30 && this.cooldown <= 0 && Math.abs(this.heardX - this.player.x) < 40) {
            this.faceTo(this.player.x);
            this.setState('windup');
            this.play('windup');
            this.telegraph(500);
            sfx(this.world.sc, 'whisper', { volume: 0.4, rate: 1.3 });
            this.body.vx = 0;
            break;
          }
          if (Math.abs(hd) > 6 && this.walk(Math.sign(hd), this.elite ? 95 : 82)) this.play('walk');
          else this.play('idle');
        } else {
          if (this.stateT > 1.8) {
            this.wanderDir = Math.random() < 0.5 ? -1 : 1;
            this.setState(Math.random() < 0.55 ? 'wander' : 'idle');
          }
          if (this.state === 'wander') {
            this.face = this.wanderDir;
            if (this.walk(this.wanderDir, 24)) this.play('walk');
            else {
              this.wanderDir *= -1;
              this.play('idle');
            }
          } else {
            this.body.vx = 0;
            this.play('idle');
          }
        }
        break;
      }
      case 'windup':
        this.body.vx = 0;
        if (this.stateT > (this.elite ? 0.42 : 0.5)) {
          this.setState('attack');
          this.play('attack');
          this.body.vx = this.face * 230;
          this.body.vy = -170;
        }
        break;
      case 'attack':
        this.strike(this.x + this.face * 14, this.cy, 14, this.elite ? 22 : 18);
        if (this.stateT > 0.2 && this.body.onGround) {
          this.setState('recover');
          this.play('idle');
          this.body.vx = 0;
        }
        break;
      case 'recover':
        this.body.vx *= 0.8;
        if (this.stateT > 0.7) {
          this.cooldown = 0.4 + Math.random() * 0.6;
          this.setState('hunt');
        }
        break;
    }
  }
}

// ---------------------------------------------------------------------------

/** A bloated, many-mouthed gossip spitting arcs of bile. */
export class Gossip extends Enemy {
  readonly kind = 'gossip';
  private cooldown = 1.2 + Math.random();

  constructor(world: World, x: number, y: number, elite = false) {
    super(world, x, y, 'gossip', GOSSIP, 22, 34, elite ? 60 : 32, elite ? 34 : 18);
    this.elite = elite;
    this.tearValue = elite ? 6 : 3;
    this.hurtR = 15;
    if (elite) this.sprite.setTint((this.baseTint = hexNum('#d0ffa0')));
  }

  protected think(dt: number) {
    const dx = this.dxToPlayer();
    const adx = Math.abs(dx);
    this.cooldown -= dt;
    this.faceTo(this.player.x);
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        let dir = 0;
        if (adx > 170) dir = Math.sign(dx);
        else if (adx < 80) dir = -Math.sign(dx);
        if (dir && this.walk(dir, 34)) this.play('walk');
        else {
          this.body.vx = 0;
          this.play('idle');
        }
        if (this.cooldown <= 0 && adx < 230 && Math.abs(this.player.y - this.y) < 120) {
          this.setState('windup');
          this.play('windup');
          this.telegraph(550);
          this.body.vx = 0;
        }
        break;
      }
      case 'windup':
        this.sprite.setScale(1 + Math.sin(this.stateT * 30) * 0.04);
        if (this.stateT > 0.55) {
          this.sprite.setScale(1);
          this.setState('attack');
          this.play('attack');
          this.spit();
        }
        break;
      case 'attack':
        if (this.stateT > 0.35) {
          this.setState('recover');
          this.play('idle');
        }
        break;
      case 'recover':
        if (this.stateT > 0.6) {
          this.cooldown = this.elite ? 1.6 : 2.4;
          this.setState('hunt');
        }
        break;
    }
  }

  private spit() {
    const w = this.world;
    sfx(w.sc, 'spit');
    const ox = this.x + this.face * 12;
    const oy = this.y - 26;
    const g = 600;
    const shots = this.elite ? [-0.12, 0, 0.12] : [0];
    for (const s of shots) {
      const tx = this.player.x + this.player.body.vx * 0.3;
      const ty = this.player.cy;
      const t = Math.max(0.45, Math.abs(tx - ox) / 170) * (1 + s);
      const vx = (tx - ox) / t;
      const vy = (ty - oy - 0.5 * g * t * t) / t;
      w.addProjectile({ x: ox, y: oy, vx, vy, r: 5, damage: 12, key: 'proj-bile', gravity: g, onEnd: (x, y) => w.gore.bile(x, y, 8) });
    }
  }
}

// ---------------------------------------------------------------------------

/** A brute in a confessional booth, swinging a brass censer. */
export class Penitent extends Enemy {
  readonly kind = 'penitent';
  private cooldown = 1;
  private move: 'slam' | 'sweep' = 'slam';
  private tele: Phaser.GameObjects.Graphics;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 'penitent', PENITENT, 30, 80, 160, 70);
    this.elite = true;
    this.tearValue = 10;
    this.hurtR = 22;
    this.knockResist = 0.25;
    this.tele = world.sc.add.graphics().setDepth(DEPTH.hazard);
  }

  protected think(_dt: number) {
    const dx = this.dxToPlayer();
    const adx = Math.abs(dx);
    this.cooldown -= _dt;
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt':
        this.faceTo(this.player.x);
        if (adx > 34 && this.walk(Math.sign(dx), 36)) this.play('walk');
        else {
          this.body.vx = 0;
          this.play('idle');
        }
        if (this.cooldown <= 0 && adx < 90 && Math.abs(this.player.y - this.y) < 60) {
          this.move = adx < 46 ? 'sweep' : 'slam';
          this.setState('windup');
          this.play(this.move === 'slam' ? 'windup' : 'sweep-windup');
          this.telegraph(this.move === 'slam' ? 850 : 550);
          this.body.vx = 0;
        }
        break;
      case 'windup': {
        const dur = this.move === 'slam' ? 0.85 : 0.55;
        const k = this.stateT / dur;
        const cx = this.x + this.face * (this.move === 'slam' ? 46 : 30);
        const r = this.move === 'slam' ? 34 : 48;
        this.tele.clear();
        this.tele.fillStyle(hexNum(P.blood2), 0.25 * k).fillRect(cx - r, this.y - 6, r * 2 * k, 6);
        this.tele.lineStyle(1, hexNum(P.blood1), 0.8).strokeRect(cx - r, this.y - 6, r * 2, 6);
        if (this.stateT > dur) {
          this.tele.clear();
          this.setState('attack');
          this.play(this.move === 'slam' ? 'attack' : 'sweep');
          const w = this.world;
          w.fx.shake(200, 0.012);
          sfx(w.sc, 'hit_flesh', { rate: 0.6 });
          if (this.move === 'slam') {
            w.fx.smoke(cx, this.y - 4, 10);
            w.addSmoke(cx, this.y - 20, 30, 2400);
          }
        }
        break;
      }
      case 'attack': {
        const cx = this.x + this.face * (this.move === 'slam' ? 46 : 30);
        if (this.move === 'slam') this.strike(cx, this.y - 16, 30, 28);
        else this.strike(cx, this.y - 34, 40, 20);
        if (this.stateT > 0.25) {
          this.setState('recover');
          this.play('idle');
        }
        break;
      }
      case 'recover':
        if (this.stateT > 0.9) {
          this.cooldown = 0.8 + Math.random() * 0.8;
          this.setState('hunt');
        }
        break;
    }
  }

  stagger() {
    this.tele.clear();
    super.stagger();
  }

  kill(executed: boolean, heavy = false) {
    this.tele.clear();
    super.kill(executed, heavy);
  }

  destroy() {
    this.tele.destroy();
    super.destroy();
  }
}

// ---------------------------------------------------------------------------

/** A swollen infant cherub with a sewn mouth, diving from above. */
export class Cherub extends Enemy {
  readonly kind = 'cherub';
  private homeY: number;
  private cooldown = 1.5 + Math.random();
  private diveVx = 0;
  private diveVy = 0;
  private t = Math.random() * 10;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 'cherub', CHERUB, 22, 26, 26, 14);
    this.flying = true;
    this.homeY = y;
    this.tearValue = 3;
    this.hurtR = 14;
    this.body.y = y + 13;
    // Never start with feet buried in a floor below the marker
    const fy = world.level.floorY(x, y);
    if (fy !== null && this.body.y > fy) this.body.y = fy;
  }

  protected think(dt: number) {
    this.t += dt;
    const dx = this.dxToPlayer();
    this.cooldown -= dt;
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        this.faceTo(this.player.x);
        this.play('fly');
        // Hover at a distance, bobbing
        const want = Math.abs(dx) > 110 ? Math.sign(dx) * 70 : Math.abs(dx) < 60 ? -Math.sign(dx) * 40 : 0;
        this.body.vx += (want - this.body.vx) * Math.min(1, dt * 3);
        const ty = Math.min(this.homeY, this.player.y - 80) + Math.sin(this.t * 2.4) * 10;
        this.body.vy += ((ty - this.y) * 2 - this.body.vy) * Math.min(1, dt * 3);
        if (this.cooldown <= 0 && Math.abs(dx) < 180 && this.world.level.lineClear(this.x, this.cy, this.player.x, this.player.cy)) {
          this.setState('windup');
          this.play('windup');
          this.telegraph(500);
        }
        break;
      }
      case 'windup':
        this.body.vx *= 0.8;
        this.body.vy = -20;
        if (this.stateT > 0.5) {
          const a = Math.atan2(this.player.cy - this.cy, this.player.x - this.x);
          this.diveVx = Math.cos(a) * 260;
          this.diveVy = Math.sin(a) * 260;
          this.setState('attack');
          this.play('dive');
        }
        break;
      case 'attack':
        this.body.vx = this.diveVx;
        this.body.vy = this.diveVy;
        this.strike(this.x, this.cy, 12, 14);
        if (this.stateT > 0.6 || this.body.onGround || this.body.hitWall) {
          this.setState('recover');
          this.play('fly');
        }
        break;
      case 'recover':
        this.body.vy = -60;
        this.body.vx *= 0.9;
        if (this.stateT > 0.9) {
          this.cooldown = 1.8 + Math.random();
          this.setState('hunt');
        }
        break;
    }
  }

  kill(executed: boolean, heavy = false) {
    this.flying = false;
    this.body.gravity = 1;
    super.kill(executed, heavy);
    // The dead frame lies at the bottom of the canvas, its pool on the floor line
    this.sprite.setOrigin(0.5, 62 / 64);
  }
}
