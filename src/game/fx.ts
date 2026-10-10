import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { meta } from './state';

interface Particle {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  ground: boolean;
  stain: boolean;
}

const MAX_PARTICLES = 260;
const MAX_DECALS = 70;

/** Blood, smoke, floating words, screen shake. */
export class Fx {
  private parts: Particle[] = [];
  private decals: Phaser.GameObjects.Image[] = [];

  constructor(private scene: Phaser.Scene) {}

  blood(x: number, y: number, n: number, dirX = 0, dirY = 0, force = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * (dirX || dirY ? 1.6 : Math.PI * 2);
      const sp = (30 + Math.random() * 90) * force;
      const big = Math.random() < 0.3;
      this.spawn({
        key: big ? 'px' : 'px1',
        color: Math.random() < 0.5 ? P.blood1 : Math.random() < 0.5 ? P.blood0 : P.blood2,
        x,
        y,
        z: 8 + Math.random() * 6,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.7,
        vz: 40 + Math.random() * 70,
        life: 6 + Math.random() * 4,
        stain: true,
      });
    }
  }

  bile(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 60;
      this.spawn({ key: 'px1', color: Math.random() < 0.5 ? P.bile0 : P.bile1, x, y, z: 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: 50 + Math.random() * 40, life: 2, stain: false });
    }
  }

  sparks(x: number, y: number, n: number, color: string = P.candle) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this.spawn({ key: 'px1', color, x, y, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: 30 + Math.random() * 60, life: 0.5 + Math.random() * 0.4, stain: false });
    }
  }

  smoke(x: number, y: number, n = 3, color: string = P.smoke0) {
    for (let i = 0; i < n; i++) {
      const img = this.scene.add
        .image(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6, 'smoke')
        .setTint(hexNum(color))
        .setAlpha(0.7)
        .setDepth(DEPTH.fx);
      this.scene.tweens.add({
        targets: img,
        y: img.y - 14 - Math.random() * 10,
        x: img.x + (Math.random() - 0.5) * 12,
        alpha: 0,
        scale: 1.8,
        duration: 700 + Math.random() * 500,
        onComplete: () => img.destroy(),
      });
    }
  }

  private spawn(o: { key: string; color: string; x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; stain: boolean }) {
    if (this.parts.length >= MAX_PARTICLES) {
      const old = this.parts.shift()!;
      old.img.destroy();
    }
    const img = this.scene.add.image(o.x, o.y - o.z, o.key).setTint(hexNum(o.color)).setDepth(DEPTH.fx);
    this.parts.push({ img, x: o.x, y: o.y, z: o.z, vx: o.vx, vy: o.vy, vz: o.vz, life: o.life, ground: false, stain: o.stain });
  }

  decal(x: number, y: number, scale = 1) {
    const d = this.scene.add
      .image(x, y, `blood-${Math.floor(Math.random() * 4)}`)
      .setDepth(DEPTH.decal)
      .setScale(scale)
      .setFlipX(Math.random() < 0.5)
      .setAlpha(0.9);
    this.decals.push(d);
    if (this.decals.length > MAX_DECALS) this.decals.shift()!.destroy();
  }

  text(x: number, y: number, s: string, color: string = P.bone0, rise = 18, ms = 900) {
    const t = this.scene.add.bitmapText(x, y, FONT_OUTLINE, s).setOrigin(0.5).setTint(hexNum(color)).setDepth(DEPTH.overlay - 1);
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: { from: 1, to: 0 }, duration: ms, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    return t;
  }

  /** Lingering, drifting whisper text. */
  whisper(x: number, y: number, s: string, color: string = P.lucid0) {
    const t = this.scene.add.bitmapText(x, y, FONT_OUTLINE, s).setOrigin(0.5).setTint(hexNum(color)).setDepth(DEPTH.overlay - 1).setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 0.85, duration: 600, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
    this.scene.tweens.add({ targets: t, x: x + (Math.random() - 0.5) * 30, y: y - 12, duration: 2800 });
  }

  shake(ms = 120, intensity = 0.006) {
    if (!meta().settings.shake) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  ring(x: number, y: number, radius: number, color: string, ms = 300) {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx);
    const o = { r: 4, a: 1 };
    this.scene.tweens.add({
      targets: o,
      r: radius,
      a: 0,
      duration: ms,
      onUpdate: () => {
        g.clear();
        g.lineStyle(2, hexNum(color), o.a);
        g.strokeEllipse(x, y, o.r * 2, o.r * 1.4);
      },
      onComplete: () => g.destroy(),
    });
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (!p.ground) {
        p.vz -= 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.ground = true;
          if (!p.stain) p.life = Math.min(p.life, 0.3);
          p.img.setDepth(DEPTH.decal);
        }
        p.img.setPosition(Math.round(p.x), Math.round(p.y - p.z));
      }
      if (p.life <= 0) {
        p.img.destroy();
        this.parts.splice(i, 1);
      } else if (p.life < 1) p.img.setAlpha(p.life);
    }
  }

  destroy() {
    for (const p of this.parts) p.img.destroy();
    this.parts = [];
    this.decals = [];
  }
}
