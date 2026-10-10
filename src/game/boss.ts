import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { BART, EAR } from '../art/creatures';
import { TILE } from '../art/environment';
import { DEPTH } from './config';
import { sfx } from './audio';
import { Enemy, type HitOpts } from './enemies';
import { hudState } from './controls';
import { MalicePool } from './hazards';
import { BOSS_LINES } from './lore';
import type { World } from './world';

type Move = 'wave' | 'globs' | 'grasp' | 'vomit';

/**
 * Bartholomew, The Swollen Ear. Slams send acid sludge rolling along the
 * floor; at half health the rosary bursts and he vomits malice that stays;
 * near death he tears off the ear, which must be destroyed before its
 * heartbeat empties the player's mind.
 */
export class Bartholomew extends Enemy {
  readonly kind = 'boss' as const;
  phase = 1;
  private moveName: Move = 'wave';
  private cooldown = 1.6;
  private pools: MalicePool[] = [];
  private ear: Ear | null = null;
  private transition = false;
  private tele: Phaser.GameObjects.Graphics;
  onPhase?: (phase: number) => void;
  onDefeat?: () => void;

  constructor(world: World, x: number, y: number) {
    super(world, x, y, 'bart', BART, 90, 190, 560, 170);
    this.hurtR = 44;
    this.tearValue = 60;
    this.knockResist = 0;
    this.face = -1;
    this.tele = world.sc.add.graphics().setDepth(DEPTH.hazard);
    // The booth is immovable and too tall to climb.
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    for (let dx = -2; dx <= 2; dx++) for (let dy = 1; dy <= 7; dy++) world.level.setSolid(tx + dx, ty - dy, true);
  }

  /** Strikes land on the bloated body, not the top of the booth. */
  get cy() {
    return this.y - 70;
  }

  get targetable() {
    return super.targetable && !this.ear && !this.transition;
  }

  takeHit(dmg: number, poiseDmg: number, fx: number, fy: number, o: HitOpts = {}) {
    super.takeHit(dmg, poiseDmg, fx, fy, { ...o, knock: 0 });
    this.body.vx = 0;
    this.body.vy = 0;
    hudState.bossHp = this.hp / this.maxHp;
    this.checkPhase();
  }

  /** A Rite of Absolution on him tears a chunk away rather than killing. */
  executed() {
    const w = this.world;
    this.beingExecuted = false;
    this.hp -= this.maxHp * 0.12;
    w.gore.gibs(this.x - 30, this.cy, 6, -80);
    w.gore.spray(this.x - 30, this.cy, Math.PI + 0.3, 50, 1.5);
    w.fx.text(this.x, this.y - 200, 'Absolved', P.blood0, 20, 1200);
    this.poise = this.maxPoise;
    this.setState('recover');
    this.play(this.phase >= 2 ? 'idle2' : 'idle');
    hudState.bossHp = this.hp / this.maxHp;
    this.checkPhase();
  }

  kill(executed: boolean, heavy = false) {
    if (this.phase < 3) {
      this.hp = 1;
      this.checkPhase();
      return;
    }
    if (this.ear && !this.ear.dead) return;
    this.tele.clear();
    super.kill(executed, heavy);
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
    w.fx.shake(700, 0.014);
    sfx(w.sc, 'boss_roar', { volume: 0.9 });
    this.onPhase?.(n);
    if (n === 2) {
      this.play('vomit');
      w.gore.bile(this.x - 20, this.y - 90, 40);
      w.fx.sparks(this.x - 20, this.y - 90, 14, P.bone0);
      w.sc.time.delayedCall(1400, () => {
        this.transition = false;
        this.play('idle2');
      });
    } else {
      this.play('earless');
      w.gore.fountain(this.x, this.y - 190, 2200, -Math.PI / 2 - 0.3);
      w.gore.burst(this.x, this.y - 180, 70, 1.5);
      w.sc.time.delayedCall(500, () => {
        this.ear = new Ear(w, this.x - 30, this.y - 170, this);
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
    w.fx.text(this.x, this.y - 210, BOSS_LINES.death, P.bone0, 10, 3200);
    for (const p of this.pools) p.destroy();
    this.pools = [];
    w.sc.time.delayedCall(900, () => {
      super.kill(false, true);
      w.gore.gibs(this.x, this.y - 100, 14);
      w.gore.burst(this.x, this.y - 100, 90, 1.6);
      this.play('dead');
      this.onDefeat?.();
    });
  }

  protected think(dt: number) {
    if (this.transition) return;
    const w = this.world;
    this.face = -1;
    this.body.vx = 0;
    this.cooldown -= dt;
    for (const p of this.pools) p.update(dt);
    if (this.phase === 3) {
      this.play('earless');
      return;
    }
    const speed = this.phase === 2 ? 1.25 : 1;
    const idle = this.phase >= 2 ? 'idle2' : 'idle';
    const dx = this.x - this.player.x;
    switch (this.state) {
      case 'idle':
      case 'wander':
      case 'hunt':
        this.play(idle);
        if (this.cooldown <= 0) {
          const r = Math.random();
          if (dx < 110) this.moveName = 'grasp';
          else if (this.phase === 2 && r < 0.3) this.moveName = 'vomit';
          else this.moveName = r < 0.6 ? 'wave' : 'globs';
          this.setState('windup');
          this.telegraph(700);
          this.play(this.moveName === 'vomit' ? 'vomit' : this.phase >= 2 ? 'windup2' : 'windup');
          if (this.moveName === 'vomit') sfx(w.sc, 'sludge', { rate: 0.6 });
        }
        break;
      case 'windup': {
        const dur = (this.moveName === 'grasp' ? 0.65 : this.moveName === 'vomit' ? 0.8 : 0.95) / speed;
        this.sprite.x = Math.round(this.x) + (Math.floor(this.stateT * 24) % 2 ? 1 : 0);
        if (this.moveName === 'grasp') {
          const k = this.stateT / dur;
          const x0 = this.x - 140;
          this.tele.clear().fillStyle(hexNum(P.blood2), 0.28 * k).fillRect(x0, this.y - 40, 110 * k, 40);
          this.tele.lineStyle(1, hexNum(P.blood1), 0.8).strokeRect(x0, this.y - 40, 110, 40);
        }
        if (this.stateT > dur) {
          this.tele.clear();
          this.release();
        }
        break;
      }
      case 'attack':
        if (this.moveName === 'grasp') this.strike(this.x - 85, this.y - 20, 55, 24);
        if (this.stateT > 0.35) {
          this.setState('recover');
          this.play(idle);
        }
        break;
      case 'recover':
        if (this.stateT > 0.6 / speed) {
          this.cooldown = (this.phase === 2 ? 0.8 : 1.2) + Math.random() * 0.5;
          this.setState('hunt');
        }
        break;
    }
  }

  private release() {
    const w = this.world;
    this.setState('attack');
    const mouthX = this.x - 30;
    const mouthY = this.y - 80;
    if (this.moveName === 'vomit') {
      this.play('vomit');
      sfx(w.sc, 'spit', { rate: 0.5 });
      for (let i = 0; i < 3; i++) {
        if (this.pools.length >= 7) break;
        const tx = i === 0 ? this.player.x : 60 + Math.random() * (this.x - 180);
        const t = 0.8;
        w.addProjectile({
          x: mouthX,
          y: mouthY,
          vx: (tx - mouthX) / t,
          vy: (this.y - 4 - mouthY - 0.5 * 600 * t * t) / t,
          r: 6,
          damage: 10,
          gravity: 600,
          key: 'proj-sludge',
          onEnd: (x) => {
            const fy = w.level.floorY(x, this.y - 40) ?? this.y;
            this.pools.push(new MalicePool(w, x, fy));
            w.gore.bile(x, fy - 4, 12);
            sfx(w.sc, 'sludge');
          },
        });
      }
      return;
    }
    this.play(this.phase >= 2 ? 'slam2' : 'slam');
    w.fx.shake(240, 0.014);
    sfx(w.sc, 'sludge');
    sfx(w.sc, 'hit_flesh', { rate: 0.5 });
    if (this.moveName === 'grasp') {
      w.gore.bile(this.x - 90, this.y - 6, 10);
      return;
    }
    if (this.moveName === 'wave') {
      // Acid waves rolling along the floor: jump them
      const waves = this.phase === 2 ? 2 : 1;
      for (let i = 0; i < waves; i++) {
        w.sc.time.delayedCall(i * 650, () => {
          if (this.dead) return;
          w.addProjectile({ x: this.x - 60, y: this.y - 10, vx: -175 - i * 25, vy: 0, r: 9, damage: 16, key: 'proj-wave', rolls: true, life: 6 });
        });
      }
    } else {
      // Lobbed globs raining around the heretic
      const n = this.phase === 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const tx = this.player.x + (i - (n - 1) / 2) * 46;
        const t = 0.9 + i * 0.08;
        w.addProjectile({ x: mouthX, y: mouthY - 30, vx: (tx - mouthX) / t, vy: (this.y - 10 - (mouthY - 30) - 0.5 * 600 * t * t) / t, r: 6, damage: 14, gravity: 600, key: 'proj-sludge', onEnd: (x, y) => w.gore.bile(x, y, 8) });
      }
    }
  }

  protected syncVisuals() {
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    this.sprite.setFlipX(true);
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
  private hopT = 0.6;

  constructor(
    world: World,
    x: number,
    y: number,
    private boss: Bartholomew,
  ) {
    super(world, x, y, 'ear', EAR, 22, 30, 90, 9999);
    this.hurtR = 18;
    this.tearValue = 0;
    this.knockResist = 0.2;
    this.body.vx = -120;
    this.body.vy = -200;
  }

  protected think(dt: number) {
    const w = this.world;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 0.9;
      sfx(w.sc, 'heartbeat', { volume: 1 });
      w.changeLucidity(-4.5, 'ear');
      w.fx.ring(this.x, this.cy, 34, P.flesh2, 300);
      this.sprite.setScale(1.15);
      w.sc.tweens.add({ targets: this.sprite, scale: 1, duration: 200 });
    }
    this.play('idle');
    if (this.body.onGround) {
      if (!this.body.wasGround) {
        w.gore.splat(this.x, this.y - 1, 0.8);
        w.gore.spray(this.x, this.y - 6, -Math.PI / 2, 6, 0.5, 2);
        sfx(w.sc, 'hit_flesh2', { rate: 0.7 });
        if (Math.abs(this.player.x - this.x) < 22 && Math.abs(this.player.y - this.y) < 30) w.hitPlayer({ damage: 16, x: this.x, y: this.cy, source: this });
      }
      this.body.vx *= 0.7;
      this.hopT -= dt;
      if (this.hopT <= 0) {
        this.hopT = 0.5 + Math.random() * 0.5;
        // Hop away from the heretic, mostly
        const away = this.player.x > this.x ? -1 : 1;
        const dir = Math.random() < 0.75 ? away : -away;
        this.body.vx = dir * (100 + Math.random() * 80);
        this.body.vy = -280 - Math.random() * 80;
      }
    }
  }

  kill(executed: boolean, heavy = false) {
    if (this.dead) return;
    super.kill(executed, heavy);
    this.boss.earDestroyed();
  }

  stagger() {
    /* the ear does not stagger */
  }
}
