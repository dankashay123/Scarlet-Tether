import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { sfx } from './audio';
import { Enemy } from './enemies';
import { hudState } from './controls';
import { MalicePool } from './hazards';
import { BOSS_LINES } from './lore';
import type { World } from './world';

type Move = 'ring' | 'fan' | 'grasp' | 'vomit';

/**
 * Bartholomew, The Swollen Ear. Slams acidic sludge; at half health the
 * rosary bursts and he vomits malice; near death he tears off the ear,
 * which must be destroyed before its heartbeat empties the player's mind.
 */
export class Bartholomew extends Enemy {
  readonly kind = 'boss' as const;
  phase = 1;
  private moveName: Move = 'ring';
  private cooldown = 1.6;
  private pools: MalicePool[] = [];
  private ear: Ear | null = null;
  private transition = false;
  private tele: Phaser.GameObjects.Graphics;
  onPhase?: (phase: number) => void;
  onDefeat?: () => void;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 'bart', 520, 160, 'shadow-xl');
    this.r = 30;
    this.hurtR = 32;
    this.tearValue = 60;
    this.sprite.setOrigin(0.5, 0.96);
    this.tele = world.sc.add.graphics().setDepth(DEPTH.hazard);
    // The booth is immovable: wall off its footprint
    const tx = Math.floor(x / 16);
    const ty = Math.floor(y / 16);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 0; dy++) world.room.setSolid(tx + dx, ty + dy, true);
  }

  get targetable() {
    return super.targetable && !this.ear && !this.transition;
  }

  takeHit(dmg: number, poiseDmg: number, fx: number, fy: number, o = {}) {
    super.takeHit(dmg, poiseDmg, fx, fy, { ...o, knock: 0 });
    this.vx = 0;
    this.vy = 0;
    hudState.bossHp = this.hp / this.maxHp;
    this.checkPhase();
  }

  /** A Rite of Absolution on the boss tears a chunk away rather than killing. */
  executed() {
    const w = this.world;
    this.beingExecuted = false;
    this.hp -= this.maxHp * 0.12;
    w.fx.text(this.x, this.y - 70, 'Absolved', P.blood0, 20, 1200);
    this.poise = this.maxPoise;
    this.setState('recover');
    this.play(this.phase >= 2 ? 'idle2' : 'idle');
    hudState.bossHp = this.hp / this.maxHp;
    this.checkPhase();
  }

  kill(executed: boolean) {
    // He only truly dies through the ear.
    if (this.phase < 3) {
      this.hp = 1;
      this.checkPhase();
      return;
    }
    if (this.ear && !this.ear.dead) return;
    this.tele.clear();
    super.kill(executed);
  }

  private checkPhase() {
    const f = this.hp / this.maxHp;
    if (this.phase === 1 && f <= 0.5) this.enterPhase(2);
    else if (this.phase === 2 && f <= 0.15) this.enterPhase(3);
  }

  private enterPhase(n: number) {
    const w = this.world;
    this.phase = n;
    this.transition = true;
    this.tele.clear();
    this.setState('recover');
    w.fx.shake(600, 0.012);
    sfx(w.sc, 'boss_roar', { volume: 0.9 });
    this.onPhase?.(n);
    if (n === 2) {
      this.play('vomit');
      w.fx.text(this.x, this.y - 90, 'The rosary snaps.', P.bone0, 10, 2000);
      for (let i = 0; i < 12; i++) w.fx.sparks(this.x + (Math.random() - 0.5) * 30, this.y - 30, 1, P.bone0);
      w.sc.time.delayedCall(1400, () => {
        this.transition = false;
        this.play('idle2');
      });
    } else {
      this.play('earless');
      w.fx.blood(this.x, this.y - 64, 60, 0, -1, 1.6);
      w.sc.time.delayedCall(500, () => {
        this.ear = new Ear(w, this.x, this.y - 40, this);
        w.enemies.push(this.ear);
        this.transition = false;
      });
    }
  }

  earDestroyed() {
    const w = this.world;
    this.ear = null;
    this.hp = 0;
    hudState.bossHp = 0;
    w.fx.text(this.x, this.y - 80, BOSS_LINES.death, P.bone0, 10, 3200);
    for (const p of this.pools) p.destroy();
    this.pools = [];
    w.sc.time.delayedCall(900, () => {
      super.kill(false);
      this.play('dead');
      this.onDefeat?.();
    });
  }

  protected think(dt: number) {
    if (this.transition) return;
    const w = this.world;
    this.cooldown -= dt;
    for (const p of this.pools) p.update(dt);
    if (this.phase === 3) {
      this.play('earless');
      return;
    }
    const speed = this.phase === 2 ? 1.25 : 1;
    const idle = this.phase >= 2 ? 'idle2' : 'idle';
    const d = this.distToPlayer();
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt':
        this.play(idle);
        if (this.cooldown <= 0) {
          const roll = Math.random();
          if (d < 64 && this.py > this.y - 10) this.moveName = 'grasp';
          else if (this.phase === 2 && roll < 0.35) this.moveName = 'vomit';
          else this.moveName = roll < 0.6 ? 'ring' : 'fan';
          this.setState('windup');
          this.play(this.moveName === 'vomit' ? 'vomit' : this.phase >= 2 ? 'windup2' : 'windup');
          if (this.moveName === 'vomit') sfx(w.sc, 'sludge', { rate: 0.6 });
        }
        break;
      case 'windup': {
        const dur = (this.moveName === 'grasp' ? 0.6 : this.moveName === 'vomit' ? 0.8 : 0.95) / speed;
        this.sprite.x = Math.round(this.x) + (Math.floor(this.stateT * 24) % 2 ? 1 : 0);
        if (this.moveName === 'grasp') {
          const k = this.stateT / dur;
          this.tele.clear().fillStyle(hexNum(P.blood2), 0.25 * k).fillEllipse(this.x, this.y + 14, 120 * k, 50 * k);
          this.tele.lineStyle(1, hexNum(P.blood1), 0.8).strokeEllipse(this.x, this.y + 14, 120, 50);
        }
        if (this.stateT > dur) {
          this.tele.clear();
          this.release();
        }
        break;
      }
      case 'attack':
        if (this.moveName === 'grasp') this.strike(this.x, this.y + 14, 52, 22);
        if (this.stateT > 0.35) {
          this.setState('recover');
          this.play(idle);
        }
        break;
      case 'recover':
        if (this.stateT > 0.6 / speed) {
          this.cooldown = (this.phase === 2 ? 0.7 : 1.1) + Math.random() * 0.5;
          this.setState('hunt');
        }
        break;
    }
  }

  private release() {
    const w = this.world;
    this.setState('attack');
    const ox = this.x;
    const oy = this.y - 6;
    if (this.moveName === 'vomit') {
      this.play('vomit');
      sfx(w.sc, 'spit', { rate: 0.5 });
      const targets = [
        { x: this.px, y: this.py },
        w.room.randomFloor(Math.random, this.x, this.y, 60),
        w.room.randomFloor(Math.random, this.x, this.y, 60),
      ];
      for (const t of targets) {
        if (this.pools.length >= 9) break;
        w.addProjectile({
          x: ox,
          y: oy - 20,
          vx: (t.x - ox) / 0.7,
          vy: (t.y - oy) / 0.7,
          r: 0,
          damage: 0,
          key: 'proj-sludge',
          life: 0.7,
          onEnd: (x, y) => {
            this.pools.push(new MalicePool(w, x, y));
            w.fx.bile(x, y, 12);
            sfx(w.sc, 'sludge');
          },
        });
      }
      return;
    }
    this.play(this.phase >= 2 ? 'slam2' : 'slam');
    w.fx.shake(220, 0.012);
    sfx(w.sc, 'sludge');
    sfx(w.sc, 'hit_flesh', { rate: 0.5 });
    if (this.moveName === 'grasp') return;
    if (this.moveName === 'ring') {
      // An expanding ring of acid with gaps to slip through
      const n = this.phase === 2 ? 22 : 18;
      const gap = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const diff = Math.abs(Phaser.Math.Angle.Wrap(a - gap));
        if (diff < 0.45 || Math.abs(Phaser.Math.Angle.Wrap(a - gap - Math.PI)) < 0.3) continue;
        w.addProjectile({ x: ox, y: oy, vx: Math.cos(a) * 88, vy: Math.sin(a) * 66, r: 5, damage: 14, key: 'proj-sludge', life: 4 });
      }
    } else {
      // Waves rolling toward the heretic
      const base = Math.atan2(this.py - oy, this.px - ox);
      const waves = this.phase === 2 ? 3 : 2;
      for (let wv = 0; wv < waves; wv++) {
        w.sc.time.delayedCall(wv * 260, () => {
          if (this.dead) return;
          for (let i = -2; i <= 2; i++) {
            const a = base + i * 0.16 + (wv % 2 ? 0.08 : 0);
            w.addProjectile({ x: ox, y: oy, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, r: 5, damage: 14, key: 'proj-sludge', life: 4 });
          }
        });
      }
    }
  }

  destroy() {
    this.tele.destroy();
    for (const p of this.pools) p.destroy();
    super.destroy();
  }
}

/** The torn-off ear. Its heartbeat drains Lucidity until it is destroyed. */
export class Ear extends Enemy {
  readonly kind = 'ear' as const;
  private beatT = 0;
  private hopT = 0.8;
  private hopFrom = { x: 0, y: 0 };
  private hopTo = { x: 0, y: 0 };
  private hopping = false;
  private z = 0;

  constructor(
    world: World,
    x: number,
    y: number,
    private boss: Bartholomew,
  ) {
    super(world, x, y, 'ear', 90, 9999, 'shadow');
    this.sprite.setOrigin(0.5, 0.9);
    this.r = 8;
    this.hurtR = 14;
    this.tearValue = 0;
    this.hopFrom = { x, y };
    this.hopTo = { x, y: y + 40 };
    this.hopping = true;
    this.hopT = 0;
  }

  protected think(dt: number) {
    const w = this.world;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 0.9;
      sfx(w.sc, 'heartbeat', { volume: 1 });
      w.changeLucidity(-4.5, 'ear');
      w.fx.ring(this.x, this.y - 10, 30, P.flesh2, 300);
      this.sprite.setScale(1.15);
      w.sc.tweens.add({ targets: this.sprite, scale: 1, duration: 200 });
    }
    if (this.hopping) {
      this.hopT += dt / 0.55;
      const k = Math.min(1, this.hopT);
      this.x = Phaser.Math.Linear(this.hopFrom.x, this.hopTo.x, k);
      this.y = Phaser.Math.Linear(this.hopFrom.y, this.hopTo.y, k);
      this.z = Math.sin(k * Math.PI) * 26;
      if (k >= 1) {
        this.hopping = false;
        this.z = 0;
        this.hopT = 0.5 + Math.random() * 0.5;
        w.fx.blood(this.x, this.y, 8);
        w.fx.decal(this.x, this.y, 0.6);
        sfx(w.sc, 'hit_flesh2', { rate: 0.7 });
        // Landing crushes
        if (this.distToPlayer() < 16) this.world.hitPlayer({ damage: 16, x: this.x, y: this.y, source: this });
      }
    } else {
      this.hopT -= dt;
      if (this.hopT <= 0) {
        this.hopFrom = { x: this.x, y: this.y };
        // Hop away from the heretic, mostly
        const t = w.room.randomFloor(Math.random, this.px, this.py, 70);
        const k = Math.min(1, 80 / Math.max(1, Phaser.Math.Distance.Between(this.x, this.y, t.x, t.y)));
        this.hopTo = { x: this.x + (t.x - this.x) * k, y: this.y + (t.y - this.y) * k };
        this.hopping = true;
        this.hopT = 0;
      }
    }
  }

  protected syncVisuals() {
    super.syncVisuals();
    this.sprite.setY(Math.round(this.y - this.z));
  }

  kill(executed: boolean) {
    if (this.dead) return;
    super.kill(executed);
    this.boss.earDestroyed();
  }

  stagger() {
    /* the ear does not stagger */
  }
}
