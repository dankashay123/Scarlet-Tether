import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { sfx } from './audio';
import { hasSacrament } from './state';
import type { World } from './world';

export type EnemyKind = 'blind' | 'gossip' | 'penitent' | 'boss' | 'ear';

export interface HitOpts {
  knock?: number;
  crit?: boolean;
  toxin?: boolean;
  bleed?: number;
}

type EState = 'spawn' | 'idle' | 'wander' | 'hunt' | 'windup' | 'attack' | 'recover' | 'stagger' | 'dead';

/** Shared behaviour for every creature of the Under-Naves. */
export abstract class Enemy {
  abstract readonly kind: EnemyKind;
  x: number;
  y: number;
  r = 6;
  hurtR = 10;
  hp: number;
  maxHp: number;
  poise: number;
  maxPoise: number;
  state: EState = 'spawn';
  stateT = 0;
  sprite: Phaser.GameObjects.Sprite;
  protected shadow: Phaser.GameObjects.Image;
  protected mark: Phaser.GameObjects.BitmapText;
  protected vx = 0;
  protected vy = 0;
  protected face = 1;
  protected poiseRegenT = 0;
  protected attackHit = false;
  protected tearValue = 3;
  beingExecuted = false;
  elite = false;
  protected baseTint: number | null = null;
  private toxinT = 0;
  private bleedT = 0;
  private bleedLvl = 0;
  private dotAcc = 0;

  constructor(
    protected world: World,
    x: number,
    y: number,
    tex: string,
    hp: number,
    poise: number,
    shadowKey = 'shadow',
  ) {
    const s = world.sc;
    this.x = x;
    this.y = y;
    this.hp = this.maxHp = hp;
    this.poise = this.maxPoise = poise;
    this.shadow = s.add.image(x, y, shadowKey).setDepth(DEPTH.shadow).setAlpha(0.5);
    this.sprite = s.add.sprite(x, y, tex).setOrigin(0.5, 0.9);
    this.sprite.play(`${tex}:idle`);
    this.mark = s.add.bitmapText(x, y, FONT_OUTLINE, '✞').setOrigin(0.5).setTint(hexNum(P.blood0)).setVisible(false).setDepth(DEPTH.overlay - 2);
    // Rise from a pool of blood
    this.sprite.setAlpha(0);
    world.fx.decal(x, y, 0.8);
    s.tweens.add({ targets: this.sprite, alpha: 1, duration: 600 });
    this.sprite.y += 6;
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
  protected get px() {
    return this.world.player.x;
  }
  protected get py() {
    return this.world.player.y;
  }
  protected distToPlayer() {
    return Phaser.Math.Distance.Between(this.x, this.y, this.px, this.py);
  }

  protected setState(s: EState) {
    this.state = s;
    this.stateT = 0;
    this.attackHit = false;
  }

  protected play(name: string) {
    const k = `${this.sprite.texture.key}:${name}`;
    if (this.sprite.anims.currentAnim?.key !== k) this.sprite.play(k, true);
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
    this.world.fx.text(this.x, this.y - 30, 'Staggered', P.blood0, 10, 700);
  }

  takeHit(dmg: number, poiseDmg: number, fromX: number, fromY: number, o: HitOpts = {}) {
    if (!this.targetable) return;
    const w = this.world;
    const mult = this.state === 'stagger' ? 1.5 : 1;
    this.hp -= dmg * mult;
    this.poiseRegenT = 2;
    const a = Math.atan2(this.y - fromY, this.x - fromX);
    const k = (o.knock ?? 90) * (this.kind === 'penitent' ? 0.35 : 1);
    this.vx += Math.cos(a) * k;
    this.vy += Math.sin(a) * k;
    w.fx.blood(this.x, this.y - 10, o.crit ? 16 : 8, Math.cos(a), Math.sin(a));
    if (Math.random() < 0.4) w.fx.decal(this.x + Math.cos(a) * 8, this.y + Math.sin(a) * 6, 0.6);
    w.fx.text(this.x, this.y - 26, o.crit ? `${Math.round(dmg * mult)}!` : `${Math.round(dmg * mult)}`, o.crit ? P.gold0 : P.bone0);
    this.sprite.setTintFill(0xffffff);
    w.sc.time.delayedCall(60, () => !this.dead && this.restoreTint());
    if (o.toxin) {
      this.toxinT = 4;
      w.fx.text(this.x, this.y - 36, 'Toxin', P.bile0);
    }
    if (o.bleed) {
      this.bleedT = 4;
      this.bleedLvl = o.bleed;
    }
    this.onHurt();
    if (this.hp <= 0) {
      this.kill(false);
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

  /** A Rite of Absolution performed on this creature. */
  executed() {
    this.kill(true);
  }

  kill(executed: boolean) {
    if (this.dead) return;
    this.setState('dead');
    this.beingExecuted = false;
    this.mark.setVisible(false);
    this.play('dead');
    this.sprite.clearTint().setAlpha(1);
    this.sprite.setDepth(DEPTH.decal + 1);
    this.shadow.setVisible(false);
    sfx(this.world.sc, 'death_enemy', { volume: 0.7 });
    this.world.fx.blood(this.x, this.y - 8, 18);
    this.world.fx.decal(this.x, this.y + 2, 1.2);
    this.world.onEnemyKilled(this, executed);
  }

  get tears() {
    let n = this.tearValue + Math.floor(Math.random() * 3);
    if (hasSacrament('ledger')) n = Math.round(n * 1.5);
    if (hasSacrament('debt')) n = Math.max(1, Math.round(n * 0.5));
    return n;
  }

  /** Swept circle test against the player for an active attack. */
  protected strike(cx: number, cy: number, radius: number, damage: number, choke = false) {
    if (this.attackHit) return;
    const d = Phaser.Math.Distance.Between(cx, cy, this.px, this.py);
    if (d > radius + 5) return;
    const res = this.world.hitPlayer({ damage, x: this.x, y: this.y, choke, source: this });
    if (res !== 'ignored') this.attackHit = true;
  }

  protected moveBy(dx: number, dy: number) {
    const res = this.world.room.move(this.x, this.y, this.r, dx, dy);
    this.x = res.x;
    this.y = res.y;
    return res;
  }

  protected faceTo(x: number) {
    this.face = x >= this.x ? 1 : -1;
  }

  update(dt: number) {
    this.stateT += dt;
    if (this.state === 'dead') return;
    // Damage over time
    if (this.toxinT > 0 || this.bleedT > 0) {
      this.toxinT -= dt;
      this.bleedT -= dt;
      this.dotAcc += ((this.toxinT > 0 ? 4 : 0) + (this.bleedT > 0 ? 3 * this.bleedLvl : 0)) * dt;
      if (this.dotAcc >= 3) {
        this.hp -= this.dotAcc;
        this.world.fx.text(this.x, this.y - 22, `${Math.round(this.dotAcc)}`, this.toxinT > 0 ? P.bile0 : P.blood1, 10, 500);
        this.dotAcc = 0;
        if (this.toxinT > 0) this.world.fx.bile(this.x, this.y - 8, 2);
        else this.world.fx.blood(this.x, this.y - 8, 2);
        if (this.hp <= 0) {
          this.kill(false);
          return;
        }
      }
    }
    if (this.state === 'spawn') {
      this.sprite.y = this.y + 6 * (1 - Math.min(1, this.stateT / 0.6));
      if (this.stateT > 0.7) this.setState('idle');
      this.syncVisuals();
      return;
    }
    if (this.state === 'stagger') {
      this.mark.setVisible(!this.beingExecuted).setPosition(this.x, this.y - 34 + Math.sin(this.stateT * 8) * 2);
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
    // Knockback & separation
    for (const o of this.world.enemies) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x;
      const dy = this.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < this.r + o.r + 2) {
        this.vx += (dx / d) * 40;
        this.vy += (dy / d) * 40;
      }
    }
    this.moveBy(this.vx * dt, this.vy * dt);
    this.vx *= Math.pow(0.002, dt);
    this.vy *= Math.pow(0.002, dt);
    this.syncVisuals();
  }

  protected syncVisuals() {
    this.sprite.setPosition(Math.round(this.x), this.state === 'spawn' ? this.sprite.y : Math.round(this.y));
    this.sprite.setFlipX(this.face < 0);
    this.sprite.setDepth(DEPTH.actorBase + this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
  }

  protected abstract think(dt: number): void;

  destroy() {
    this.sprite.destroy();
    this.shadow.destroy();
    this.mark.destroy();
  }
}

// ---------------------------------------------------------------------------

/** Former Severed who gouged their eyes. They hunt by sound alone. */
export class Blind extends Enemy {
  readonly kind = 'blind';
  private heardX = 0;
  private heardY = 0;
  private alertT = 0;
  private wanderA = Math.random() * Math.PI * 2;
  private lungeA = 0;
  private cooldown = 0.6;

  constructor(world: World, x: number, y: number, elite = false) {
    super(world, x, y, 'blind', elite ? 70 : 42, elite ? 40 : 26);
    this.elite = elite;
    this.tearValue = elite ? 6 : 3;
    if (elite) this.sprite.setTint((this.baseTint = hexNum('#ffb8b8')));
  }

  hear(x: number, y: number) {
    this.heardX = x;
    this.heardY = y;
    if (this.alertT <= 0 && this.targetable && this.state !== 'stagger') {
      this.world.fx.text(this.x, this.y - 30, '?', P.bone0, 8, 500);
    }
    this.alertT = 3.5;
  }

  protected onHurt() {
    this.hear(this.px, this.py);
  }

  protected think(dt: number) {
    this.alertT -= dt;
    this.cooldown -= dt;
    const d = this.distToPlayer();
    if (d < 26) this.hear(this.px, this.py); // close enough to smell
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        if (this.alertT > 0) {
          this.play('walk');
          const hd = Phaser.Math.Distance.Between(this.x, this.y, this.heardX, this.heardY);
          if (d < 48 && this.cooldown <= 0 && this.distToHeardPlayer() < 30) {
            this.faceTo(this.px);
            this.setState('windup');
            this.play('windup');
            sfx(this.world.sc, 'whisper', { volume: 0.4, rate: 1.3 });
            break;
          }
          if (hd > 6) {
            const a = Math.atan2(this.heardY - this.y, this.heardX - this.x);
            this.faceTo(this.heardX);
            this.moveBy(Math.cos(a) * 80 * dt, Math.sin(a) * 80 * dt);
          } else this.play('idle');
        } else {
          // Shuffle aimlessly, listening
          if (this.stateT > 1.6) {
            this.wanderA = Math.random() * Math.PI * 2;
            this.setState(Math.random() < 0.5 ? 'wander' : 'idle');
          }
          if (this.state === 'wander') {
            this.play('walk');
            this.face = Math.cos(this.wanderA) >= 0 ? 1 : -1;
            const r = this.moveBy(Math.cos(this.wanderA) * 20 * dt, Math.sin(this.wanderA) * 20 * dt);
            if (r.hitX || r.hitY) this.wanderA += Math.PI;
          } else this.play('idle');
        }
        break;
      }
      case 'windup':
        // The telegraph: a shuddering, head-cocked pause
        this.sprite.x = Math.round(this.x) + (Math.floor(this.stateT * 30) % 2 ? 1 : -1);
        if (this.stateT > (this.elite ? 0.42 : 0.5)) {
          this.lungeA = Math.atan2(this.heardY - this.y, this.heardX - this.x);
          this.faceTo(this.heardX);
          this.setState('attack');
          this.play('attack');
        }
        return;
      case 'attack': {
        const sp = 190;
        this.moveBy(Math.cos(this.lungeA) * sp * dt, Math.sin(this.lungeA) * sp * dt);
        this.strike(this.x + Math.cos(this.lungeA) * 8, this.y + Math.sin(this.lungeA) * 6, 12, this.elite ? 22 : 18);
        if (this.stateT > 0.24) {
          this.setState('recover');
          this.play('idle');
        }
        break;
      }
      case 'recover':
        if (this.stateT > 0.75) {
          this.cooldown = 0.4 + Math.random() * 0.6;
          this.setState('hunt');
        }
        break;
    }
  }

  private distToHeardPlayer() {
    return Phaser.Math.Distance.Between(this.heardX, this.heardY, this.px, this.py);
  }
}

// ---------------------------------------------------------------------------

/** A bloated, many-mouthed gossip spitting bile at range. */
export class Gossip extends Enemy {
  readonly kind = 'gossip';
  private cooldown = 1.2 + Math.random();
  private strafe = Math.random() < 0.5 ? 1 : -1;

  constructor(world: World, x: number, y: number, elite = false) {
    super(world, x, y, 'gossip', elite ? 60 : 32, elite ? 34 : 18);
    this.elite = elite;
    this.tearValue = elite ? 6 : 3;
    this.r = 7;
    this.hurtR = 11;
    if (elite) this.sprite.setTint((this.baseTint = hexNum('#d0ffa0')));
  }

  protected think(dt: number) {
    const d = this.distToPlayer();
    this.cooldown -= dt;
    this.faceTo(this.px);
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        const a = Math.atan2(this.py - this.y, this.px - this.x);
        let mx = 0;
        let my = 0;
        const sight = this.world.room.lineClear(this.x, this.y - 8, this.px, this.py - 8);
        if (d > 130 || !sight) {
          mx = Math.cos(a);
          my = Math.sin(a);
        } else if (d < 75) {
          mx = -Math.cos(a);
          my = -Math.sin(a);
        } else {
          mx = Math.cos(a + (Math.PI / 2) * this.strafe) * 0.6;
          my = Math.sin(a + (Math.PI / 2) * this.strafe) * 0.6;
        }
        const r = this.moveBy(mx * 36 * dt, my * 36 * dt);
        if (r.hitX || r.hitY) this.strafe *= -1;
        this.play(mx || my ? 'walk' : 'idle');
        if (this.cooldown <= 0 && sight && d < 190) {
          this.setState('windup');
          this.play('windup');
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
        if (this.stateT > 0.3) {
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
    const a = Math.atan2(this.py - (this.y - 8), this.px - this.x);
    const spread = this.elite ? [-0.25, 0, 0.25] : [0];
    for (const s of spread) {
      w.addProjectile({
        x: this.x + Math.cos(a) * 8,
        y: this.y - 8,
        vx: Math.cos(a + s) * 125,
        vy: Math.sin(a + s) * 125,
        r: 4,
        damage: 12,
        key: 'proj-bile',
        onEnd: (x, y) => w.fx.bile(x, y, 6),
      });
    }
  }
}

// ---------------------------------------------------------------------------

/** A brute in a confessional booth, swinging a brass censer. */
export class Penitent extends Enemy {
  readonly kind = 'penitent';
  private cooldown = 1;
  private move: 'slam' | 'sweep' = 'slam';
  private tx = 0;
  private ty = 0;
  private tele: Phaser.GameObjects.Graphics;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 'penitent', 150, 70, 'shadow-lg');
    this.elite = true;
    this.tearValue = 10;
    this.r = 9;
    this.hurtR = 14;
    this.tele = world.sc.add.graphics().setDepth(DEPTH.hazard);
  }

  protected think(dt: number) {
    const d = this.distToPlayer();
    this.cooldown -= dt;
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt': {
        this.faceTo(this.px);
        const a = Math.atan2(this.py - this.y, this.px - this.x);
        if (d > 30) {
          this.moveBy(Math.cos(a) * 34 * dt, Math.sin(a) * 34 * dt);
          this.play('walk');
        } else this.play('idle');
        if (this.cooldown <= 0 && d < 70) {
          this.move = d < 36 ? 'sweep' : 'slam';
          this.tx = this.x + Math.cos(a) * Math.min(d, 34);
          this.ty = this.y + Math.sin(a) * Math.min(d, 34);
          this.setState('windup');
          this.play('windup');
        }
        break;
      }
      case 'windup': {
        const dur = this.move === 'slam' ? 0.85 : 0.55;
        const k = this.stateT / dur;
        this.tele.clear();
        const r = this.move === 'slam' ? 30 : 40;
        const cx = this.move === 'slam' ? this.tx : this.x;
        const cy = this.move === 'slam' ? this.ty : this.y;
        this.tele.lineStyle(1, hexNum(P.blood1), 0.4 + k * 0.5).strokeEllipse(cx, cy, r * 2, r * 1.4);
        this.tele.fillStyle(hexNum(P.blood2), 0.25 * k).fillEllipse(cx, cy, r * 2 * k, r * 1.4 * k);
        if (this.stateT > dur) {
          this.tele.clear();
          this.setState('attack');
          this.play('attack');
          const w = this.world;
          w.fx.shake(180, 0.01);
          sfx(w.sc, 'hit_flesh', { rate: 0.6 });
          if (this.move === 'slam') {
            w.fx.smoke(this.tx, this.ty, 8);
            w.addSmoke(this.tx, this.ty, 26, 2400);
          }
        }
        break;
      }
      case 'attack':
        if (this.move === 'slam') this.strike(this.tx, this.ty, 30, 26);
        else this.strike(this.x, this.y, 40, 20);
        if (this.stateT > 0.2) {
          this.setState('recover');
          this.play('idle');
        }
        break;
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

  kill(executed: boolean) {
    this.tele.clear();
    super.kill(executed);
  }

  destroy() {
    this.tele.destroy();
    super.destroy();
  }
}
