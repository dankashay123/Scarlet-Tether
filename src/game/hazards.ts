import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { sfx } from './audio';
import type { World } from './world';

export interface Hazard {
  update(dt: number, lucidity: number): void;
  destroy(): void;
}

/** A brass censer swinging on a long chain from the vault: huge damage, Choked. */
export class Pendulum implements Hazard {
  private censer: Phaser.GameObjects.Image;
  private chain: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Image;
  private t: number;
  private hitCd = 0;
  private len: number;
  cx = 0;
  cy = 0;

  constructor(
    private world: World,
    private ax: number,
    private ay: number,
    private amp = 0.95,
    private period = 2.8,
  ) {
    const s = world.sc;
    this.t = Math.random() * period;
    const floor = world.level.floorY(ax, ay + 8) ?? ay + 200;
    this.len = Math.max(40, floor - ay - 34);
    // Never swing through the walls: fit the arc to the open space at the bob's height
    const L = world.level;
    const by = ay + this.len * 0.75;
    let free = 0;
    while (free < this.len && !L.solidPx(ax - free - 14, by) && !L.solidPx(ax + free + 14, by)) free += 4;
    this.amp = Math.min(this.amp, Math.asin(Math.min(0.99, free / this.len)));
    this.chain = s.add.graphics().setDepth(DEPTH.hazard);
    this.censer = s.add.image(ax, ay, 'prop-censer').setDepth(DEPTH.hazard + 1);
    this.glow = s.add.image(ax, ay, 'light-sm').setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum(P.candle)).setAlpha(0.45).setDepth(DEPTH.light);
  }

  update(dt: number) {
    const w = this.world;
    this.t += dt * w.enemyTimeScale;
    const th = Math.sin((this.t / this.period) * Math.PI * 2) * this.amp;
    this.cx = this.ax + Math.sin(th) * this.len;
    this.cy = this.ay + Math.cos(th) * this.len;
    this.censer.setPosition(Math.round(this.cx), Math.round(this.cy)).setRotation(-th);
    this.glow.setPosition(this.cx, this.cy);
    this.chain.clear();
    const n = Math.ceil(this.len / 3);
    for (let i = 0; i < n; i++) {
      const k = i / n;
      this.chain.fillStyle(i % 2 ? hexNum(P.iron0) : hexNum(P.iron1), 1).fillRect(Math.round(this.ax + (this.cx - this.ax) * k), Math.round(this.ay + (this.cy - this.ay) * k), 2, 2);
    }
    if (Math.random() < dt * 10) w.fx.smoke(this.cx, this.cy - 4, 1);
    this.hitCd -= dt;
    if (this.hitCd > 0) return;
    const p = w.player;
    if (Math.abs(p.x - this.cx) < 14 && Math.abs(p.cy - this.cy) < 26) {
      const r = w.hitPlayer({ damage: 22, x: this.cx - Math.sign(Math.cos(th)) * 30, y: this.cy, choke: true });
      if (r !== 'ignored') this.hitCd = 0.8;
    }
    for (const e of w.enemies) {
      if (!e.targetable || e.kind === 'boss') continue;
      if (Math.abs(e.x - this.cx) < 16 && Math.abs(e.cy - this.cy) < 26) {
        e.takeHit(25, 30, this.cx, this.cy, { knock: 240 });
        this.hitCd = 0.5;
        sfx(w.sc, 'hit_flesh', { rate: 0.8 });
      }
    }
  }

  destroy() {
    this.censer.destroy();
    this.chain.destroy();
    this.glow.destroy();
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
    private y: number, // floor surface
  ) {
    this.img = world.sc.add.image(x, y, 'thorns-down').setOrigin(0.5, 1).setDepth(DEPTH.hazard);
    this.glint = world.sc.add.image(x + 3, y - 2, 'px1').setDepth(DEPTH.hazard + 1).setAlpha(0);
    this.t = Math.random() * 2.6;
  }

  update(dt: number, lucidity: number) {
    this.t = (this.t + dt * this.world.enemyTimeScale) % 2.6;
    const wasUp = this.up;
    this.up = this.t > 1.9;
    this.img.setTexture(this.up ? 'thorns-up' : 'thorns-down');
    const vis = Phaser.Math.Clamp((62 - lucidity) / 27, 0, 1);
    this.img.setAlpha(this.up ? Math.max(0.2, vis) : vis * 0.9);
    this.glint.setAlpha(this.t > 1.5 && this.t < 1.6 ? 0.9 : 0);
    if (this.up && !wasUp && vis > 0.3) sfx(this.world.sc, 'hit_flesh2', { volume: 0.2, rate: 1.6 });
    this.hitCd -= dt;
    if (this.up && this.hitCd <= 0) {
      const p = this.world.player;
      if (Math.abs(p.x - this.x) < 10 && Math.abs(p.y - this.y) < 6) {
        const r = this.world.hitPlayer({ damage: 14, x: this.x, y: this.y });
        if (r !== 'ignored') {
          this.hitCd = 0.7;
          this.world.gore.spray(p.x, p.y - 4, -Math.PI / 2, 10, 0.7);
        }
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
      this.world.fx.smoke(this.x + (Math.random() - 0.5) * this.r * 2, this.y + (Math.random() - 0.5) * this.r, 1);
    }
    const p = this.world.player;
    if (Math.abs(p.x - this.x) < this.r && Math.abs(p.cy - this.y) < this.r && !p.dodging) p.drainStamina(55 * dt);
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
    this.img = world.sc.add.sprite(x, y, 'malice').setOrigin(0.5, 1).setDepth(DEPTH.hazard).setScale(0.2, 0.2);
    this.img.play('malice:boil');
  }

  update(dt: number) {
    this.growT = Math.min(1, this.growT + dt * 2);
    this.img.setScale(0.2 + this.growT * 0.8);
    if (this.growT < 1) return;
    this.tickT -= dt;
    const p = this.world.player;
    if (Math.abs(p.x - this.x) < 20 && Math.abs(p.y - this.y) < 8 && this.tickT <= 0 && !p.dodging) {
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
