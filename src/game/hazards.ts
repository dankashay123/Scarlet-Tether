import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { sfx } from './audio';
import type { World } from './world';

export interface Hazard {
  update(dt: number, lucidity: number): void;
  destroy(): void;
}

/** Swinging incense burners: massive damage and the Choked state. */
export class Pendulum implements Hazard {
  private censer: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private chain: Phaser.GameObjects.Graphics;
  private t: number;
  private hitCd = 0;
  cx = 0;
  cy = 0;

  constructor(
    private world: World,
    private ax: number,
    private ay: number,
    private axis: 'x' | 'y',
    private amp = 46,
    private period = 2.6,
  ) {
    const s = world.sc;
    this.t = Math.random() * period;
    this.shadow = s.add.image(ax, ay, 'shadow').setDepth(DEPTH.shadow).setAlpha(0.45);
    this.chain = s.add.graphics();
    this.censer = s.add.image(ax, ay, 'censer').setOrigin(0.5, 0.8);
  }

  update(dt: number) {
    const w = this.world;
    this.t += dt * w.enemyTimeScale;
    const ph = Math.sin((this.t / this.period) * Math.PI * 2);
    const off = ph * this.amp;
    this.cx = this.ax + (this.axis === 'x' ? off : 0);
    this.cy = this.ay + (this.axis === 'y' ? off : 0);
    // Height: lowest at the centre of the swing, as a real pendulum
    const lift = Math.abs(ph) * 8;
    const ry = this.cy - 6 - lift;
    this.censer.setPosition(Math.round(this.cx), Math.round(ry)).setDepth(DEPTH.actorBase + this.cy + 4);
    this.shadow.setPosition(Math.round(this.cx), Math.round(this.cy)).setScale(1 - lift / 20);
    this.chain.clear().setDepth(DEPTH.actorBase + this.cy + 3);
    // The chain climbs to a pivot far above (off the top of the screen)
    const topX = this.ax;
    const topY = this.ay - 140;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const k = i / n;
      const x = topX + (this.cx - topX) * k;
      const y = topY + (ry - 10 - topY) * k;
      this.chain.fillStyle(i % 2 ? hexNum(P.iron0) : hexNum(P.iron1), 1).fillRect(Math.round(x), Math.round(y), 1, 2);
    }
    if (Math.random() < dt * 8) w.fx.smoke(this.cx, ry - 4, 1);
    this.hitCd -= dt;
    if (lift < 6 && this.hitCd <= 0) {
      const p = w.player;
      if (Phaser.Math.Distance.Between(p.x, p.y, this.cx, this.cy) < 11) {
        const r = w.hitPlayer({ damage: 22, x: this.cx, y: this.cy, choke: true });
        if (r !== 'ignored') this.hitCd = 0.8;
      }
      for (const e of w.enemies) {
        if (!e.targetable) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, this.cx, this.cy) < 12) {
          e.takeHit(25, 30, this.cx, this.cy, { knock: 200 });
          this.hitCd = 0.5;
          sfx(w.sc, 'hit_flesh', { rate: 0.8 });
        }
      }
    }
  }

  destroy() {
    this.censer.destroy();
    this.shadow.destroy();
    this.chain.destroy();
  }
}

/** Thorns of Penance: invisible while the mind is whole. */
export class Thorns implements Hazard {
  private img: Phaser.GameObjects.Image;
  private glint: Phaser.GameObjects.Image;
  private t: number;
  private up = false;
  private hitCd = 0;

  constructor(
    private world: World,
    private x: number,
    private y: number,
  ) {
    this.img = world.sc.add.image(x, y, 'thorns-down').setDepth(DEPTH.hazard);
    this.glint = world.sc.add.image(x + 3, y - 2, 'px1').setDepth(DEPTH.hazard + 1).setAlpha(0);
    this.t = Math.random() * 2.6;
  }

  update(dt: number, lucidity: number) {
    this.t = (this.t + dt * this.world.enemyTimeScale) % 2.6;
    const wasUp = this.up;
    this.up = this.t > 1.9;
    this.img.setTexture(this.up ? 'thorns-up' : 'thorns-down');
    // Reveal as Lucidity falls; fully visible below 35
    const vis = Phaser.Math.Clamp((62 - lucidity) / 27, 0, 1);
    this.img.setAlpha(this.up ? Math.max(0.15, vis) : vis * 0.9);
    // A faint glint gives the attentive a chance even when sane
    this.glint.setAlpha(this.t > 1.5 && this.t < 1.6 ? 0.9 : 0);
    if (this.up && !wasUp && vis > 0.3) sfx(this.world.sc, 'hit_flesh2', { volume: 0.2, rate: 1.6 });
    this.hitCd -= dt;
    if (this.up && this.hitCd <= 0) {
      const p = this.world.player;
      if (Math.abs(p.x - this.x) < 8 && Math.abs(p.y - this.y) < 8) {
        const r = this.world.hitPlayer({ damage: 14, x: this.x, y: this.y - 10 });
        if (r !== 'ignored') this.hitCd = 0.7;
      }
    }
  }

  destroy() {
    this.img.destroy();
    this.glint.destroy();
  }
}

/** A cloud of censer smoke: choking incense. */
export class SmokeCloud implements Hazard {
  private life: number;
  private puffT = 0;
  done = false;

  constructor(
    private world: World,
    private x: number,
    private y: number,
    private r: number,
    ms: number,
  ) {
    this.life = ms / 1000;
  }

  update(dt: number) {
    this.life -= dt;
    if (this.life <= 0) {
      this.done = true;
      return;
    }
    this.puffT -= dt;
    if (this.puffT <= 0) {
      this.puffT = 0.12;
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * this.r;
      this.world.fx.smoke(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d * 0.7, 1);
    }
    const p = this.world.player;
    if (Phaser.Math.Distance.Between(p.x, p.y, this.x, this.y) < this.r && !p.dodging) {
      p.drainStamina(55 * dt);
    }
  }

  destroy() {}
}

/** Bartholomew's vomited malice: permanent, screaming, corrosive. */
export class MalicePool implements Hazard {
  private img: Phaser.GameObjects.Sprite;
  private tickT = 0;
  private growT = 0;

  constructor(
    private world: World,
    private x: number,
    private y: number,
  ) {
    this.img = world.sc.add.sprite(x, y, 'malice').setDepth(DEPTH.hazard).setScale(0.2);
    this.img.play('malice:boil');
  }

  update(dt: number) {
    this.growT = Math.min(1, this.growT + dt * 2);
    this.img.setScale(0.2 + this.growT * 0.8);
    if (this.growT < 1) return;
    this.tickT -= dt;
    const p = this.world.player;
    const dx = (p.x - this.x) / 17;
    const dy = (p.y - this.y) / 10;
    if (dx * dx + dy * dy < 1 && this.tickT <= 0 && !p.dodging) {
      this.tickT = 0.5;
      this.world.hitPlayer({ damage: 6, x: this.x, y: this.y });
      this.world.changeLucidity(-3, 'malice');
      if (Math.random() < 0.4) sfx(this.world.sc, 'whisper', { volume: 0.4, rate: 0.7 });
    }
  }

  destroy() {
    this.img.destroy();
  }
}
