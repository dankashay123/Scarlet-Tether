import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { PixelCanvas, registerImage } from '../art/pixel';
import { TILE } from '../art/environment';
import { DEPTH } from './config';
import type { Level } from './level';

interface Drop {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  big: boolean;
}

interface Gib {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  rest: boolean;
  trail: number;
}

const MAX_DROPS = 420;
const MAX_GIBS = 60;
const CHUNK = 512;
const BLOODS = [P.blood0, P.blood1, P.blood1, P.blood2, P.blood2, P.blood3];

function ensureStamps(scene: Phaser.Scene) {
  if (scene.textures.exists('splat-0')) return;
  for (let k = 0; k < 4; k++) {
    const s = 10 + k * 3;
    const pc = new PixelCanvas(s, s);
    const c = (s - 1) / 2;
    for (let i = 0; i < 7 + k * 2; i++) {
      const a = (i * 2.4 + k) % (Math.PI * 2);
      const d = (i % 3) * (s / 7);
      const r = 1 + ((i * 7 + k) % 3);
      pc.ellipse(c + Math.cos(a) * d, c + Math.sin(a) * d * 0.6, r, r * 0.8, '#ffffff');
    }
    registerImage(scene, `splat-${k}`, pc);
  }
  const drip = new PixelCanvas(2, 6);
  drip.rect(0, 0, 2, 5, '#ffffff');
  drip.px(0, 5, '#ffffff');
  registerImage(scene, 'drip', drip);
}

/**
 * The world remembers violence: blood arcs, splashes and stays on the
 * stone; bodies come apart into pieces that bounce and settle. Blood is
 * painted into 512px chunks created on demand, so huge maps stay cheap.
 */
export class Gore {
  private drops: Drop[] = [];
  private gibList: Gib[] = [];
  private chunks = new Map<string, Phaser.GameObjects.RenderTexture>();
  private stamp: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
  ) {
    ensureStamps(scene);
    this.stamp = scene.make.image({ key: 'splat-0', add: false });
  }

  private chunk(x: number, y: number) {
    const cx = Math.floor(x / CHUNK);
    const cy = Math.floor(y / CHUNK);
    const k = `${cx},${cy}`;
    let rt = this.chunks.get(k);
    if (!rt) {
      rt = this.scene.add.renderTexture(cx * CHUNK, cy * CHUNK, CHUNK, CHUNK).setOrigin(0).setDepth(DEPTH.gore);
      this.chunks.set(k, rt);
    }
    return rt;
  }

  private drop(x: number, y: number, vx: number, vy: number, big: boolean, color?: string) {
    if (this.drops.length >= MAX_DROPS) this.drops.shift()!.img.destroy();
    const img = this.scene.add
      .image(x, y, big ? 'px' : 'px1')
      .setTint(hexNum(color ?? BLOODS[(Math.random() * BLOODS.length) | 0]))
      .setDepth(DEPTH.fx);
    this.drops.push({ img, x, y, vx, vy, life: 3, big });
  }

  spray(x: number, y: number, angle: number, n: number, force = 1, spread = 0.7) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const sp = (90 + Math.random() * 200) * force;
      this.drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, Math.random() < 0.35);
    }
  }

  burst(x: number, y: number, n: number, force = 1) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.6;
      const sp = (60 + Math.random() * 220) * force;
      this.drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp, Math.random() < 0.4);
    }
  }

  fountain(x: number, y: number, ms = 900, dir = -Math.PI / 2) {
    return this.scene.time.addEvent({ delay: 30, repeat: Math.floor(ms / 30), callback: () => this.spray(x, y, dir, 3, 0.9, 0.5) });
  }

  bile(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = 40 + Math.random() * 120;
      this.drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp, false, Math.random() < 0.5 ? P.bile0 : P.bile1);
    }
  }

  gibs(x: number, y: number, n: number, pushX = 0) {
    for (let i = 0; i < n; i++) {
      if (this.gibList.length >= MAX_GIBS) this.gibList.shift()!.img.destroy();
      const img = this.scene.add.image(x, y, 'gib', (Math.random() * 10) | 0).setDepth(DEPTH.corpse + 1);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 120 + Math.random() * 220;
      this.gibList.push({ img, x, y, vx: Math.cos(a) * sp + pushX, vy: Math.sin(a) * sp, spin: (Math.random() - 0.5) * 20, rest: false, trail: 0 });
    }
  }

  splat(x: number, y: number, scale = 1, color: string = P.blood2) {
    const k = (Math.random() * 4) | 0;
    const rt = this.chunk(x, y);
    this.stamp.setTexture(`splat-${k}`).setTint(hexNum(color)).setScale(scale, scale * (0.5 + Math.random() * 0.5)).setAlpha(0.95);
    rt.draw(this.stamp, Math.round(x - rt.x - (5 + k * 1.5) * scale), Math.round(y - rt.y - (5 + k * 1.5) * scale * 0.5));
  }

  pool(x: number, floorY: number, width = 1) {
    for (let i = 0; i < 4; i++) this.splat(x + (Math.random() - 0.5) * 18 * width, floorY - 1, 0.8 + width * 0.5, i % 2 ? P.blood2 : P.blood3);
  }

  update(dt: number) {
    const L = this.level;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.vy += 700 * dt;
      const nx = d.x + d.vx * dt;
      const ny = d.y + d.vy * dt;
      let hit = false;
      if (L.solidPx(nx, ny)) {
        hit = true;
        const tx = Math.floor(nx / TILE);
        const ty = Math.floor(ny / TILE);
        let px = nx;
        let py = ny;
        if (Math.floor(d.y / TILE) < ty && !L.solidPx(d.x, d.y)) py = ty * TILE + 1;
        else if (d.vx > 0) px = tx * TILE + 1;
        else if (d.vx < 0) px = (tx + 1) * TILE - 1;
        this.splat(px, py, d.big ? 0.45 : 0.25, P.blood2);
        if (d.big && Math.abs(d.vx) > Math.abs(d.vy) && Math.random() < 0.35) this.wallDrip(px, py);
      }
      if (hit || d.life <= 0 || ny > L.pxH) {
        d.img.destroy();
        this.drops.splice(i, 1);
        continue;
      }
      d.x = nx;
      d.y = ny;
      d.img.setPosition(Math.round(d.x), Math.round(d.y));
    }
    for (const g of this.gibList) {
      if (g.rest) continue;
      g.vy += 800 * dt;
      let nx = g.x + g.vx * dt;
      let ny = g.y + g.vy * dt;
      if (L.solidPx(nx, g.y)) {
        g.vx *= -0.4;
        nx = g.x;
      }
      if (L.solidPx(nx, ny + 3)) {
        if (g.vy > 0) {
          ny = Math.floor((ny + 3) / TILE) * TILE - 3;
          if (Math.abs(g.vy) > 60) this.splat(nx, ny + 3, 0.4);
          g.vy *= -0.32;
          g.vx *= 0.6;
          g.spin *= 0.5;
          if (Math.abs(g.vy) < 30 && Math.abs(g.vx) < 12) {
            g.rest = true;
            this.splat(nx, ny + 3, 0.6);
          }
        } else g.vy = 0;
      }
      g.trail -= dt;
      if (g.trail <= 0 && !g.rest) {
        g.trail = 0.05;
        this.drop(g.x, g.y, g.vx * 0.2, g.vy * 0.2, false);
      }
      g.x = nx;
      g.y = ny;
      g.img.setPosition(Math.round(g.x), Math.round(g.y)).setRotation(g.img.rotation + g.spin * dt);
    }
  }

  private wallDrip(x: number, y: number) {
    const d = this.scene.add.image(x, y, 'drip').setTint(hexNum(P.blood2)).setDepth(DEPTH.gore + 1).setOrigin(0.5, 0);
    this.scene.tweens.add({ targets: d, y: y + 6 + Math.random() * 14, scaleY: 2 + Math.random() * 2, duration: 2500 + Math.random() * 2500, ease: 'Sine.Out' });
  }

  destroy() {
    this.drops.forEach((d) => d.img.destroy());
    this.gibList.forEach((g) => g.img.destroy());
    this.chunks.forEach((c) => c.destroy());
    this.stamp.destroy();
  }
}
