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

interface Splat {
  x: number;
  y: number;
  scale: number;
  color: string;
  k: number;
  sy: number;
}

interface Entrail {
  g: Phaser.GameObjects.Graphics;
  px: Float32Array; // node positions
  py: Float32Array;
  ox: Float32Array; // previous positions (verlet)
  oy: Float32Array;
  t: number;
  rest: boolean;
  thick: number;
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

const MAX_DROPS = 1000;
const MAX_GIBS = 120;
const MAX_ENTRAILS = 18;
const SEG = 3.2;
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
  // A dithered white puff for the red mist (tinted at use)
  const mist = new PixelCanvas(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4) / 4.5;
      if (d < 1 && (d < 0.55 || (x + y * 3) % 4 < 2)) mist.px(x, y, '#ffffff');
    }
  registerImage(scene, 'mist', mist);
  // Chunky clots of blood
  const clot = new PixelCanvas(4, 4);
  clot.rect(1, 0, 2, 4, '#ffffff');
  clot.rect(0, 1, 4, 2, '#ffffff');
  registerImage(scene, 'clot', clot);
}

/**
 * The world remembers violence: blood arcs, splashes and stays on the
 * stone; bodies come apart into pieces that bounce and settle. Blood is
 * painted into 512px chunks created on demand, so huge maps stay cheap.
 */
export class Gore {
  private drops: Drop[] = [];
  private entrails: Entrail[] = [];
  private pending: Splat[] = [];
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

  private drop(x: number, y: number, vx: number, vy: number, big: boolean, color?: string, clot = false) {
    if (this.drops.length >= MAX_DROPS) this.drops.shift()!.img.destroy();
    const img = this.scene.add
      .image(x, y, clot ? 'clot' : big ? 'px' : 'px1')
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
      this.drop(x, y, Math.cos(a) * sp, Math.sin(a) * sp, Math.random() < 0.4, undefined, Math.random() < 0.18);
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

  /**
   * A body bursting: a ring of blood, a red mist, a storm of meat and bone,
   * ropes of gut slithering out, and the nearby stone painted red.
   */
  explode(x: number, y: number, power = 1, dir = 0) {
    this.burst(x, y, Math.round(130 * power), 1.5 * Math.sqrt(power));
    for (let i = 0; i < 360; i += 30) this.spray(x, y, (i * Math.PI) / 180, Math.round(4 * power), 1.3, 0.4);
    if (dir) this.spray(x, y, dir > 0 ? -0.35 : Math.PI + 0.35, Math.round(45 * power), 1.6, 0.6);
    this.gibs(x, y, Math.round(11 * power), dir * 90);
    const guts = 2 + Math.round(power * 1.5);
    for (let i = 0; i < guts; i++) this.entrail(x + (Math.random() - 0.5) * 8, y + 4, power);
    this.mist(x, y, power);
    this.wallSplash(x, y, 90 * power);
    // Spatter on the wall behind: the room remembers every death
    for (let i = 0; i < 26 * power; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.7) * 46 * power;
      const k = 1 - d / (46 * power);
      this.splat(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 0.25 + k * 0.9, Math.random() < 0.55 ? P.blood3 : P.blood2);
    }
    this.fountain(x, y - 6, 900 * power, -Math.PI / 2 - 0.5);
    this.fountain(x, y - 6, 700 * power, -Math.PI / 2 + 0.5);
    const fy = this.level.floorY(x, y);
    if (fy !== null && fy - y < 80) this.pool(x, fy, 2.5 * power);
  }

  /** A slick red haze hanging where the body was. */
  mist(x: number, y: number, power = 1) {
    // The pop: a bright wet blast that swells and is gone in a blink
    const pop = this.scene.add.image(x, y, 'mist').setTint(hexNum(P.blood0)).setScale(1).setAlpha(0.95).setDepth(DEPTH.fx);
    this.scene.tweens.add({ targets: pop, scale: 6 * power, alpha: 0, duration: 200, ease: 'Quad.Out', onComplete: () => pop.destroy() });
    for (let i = 0; i < 7 * power; i++) {
      const m = this.scene.add
        .image(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 16, 'mist')
        .setTint(hexNum(i % 3 ? P.blood2 : P.blood1))
        .setAlpha(0.8)
        .setScale(1)
        .setDepth(DEPTH.fx - 1);
      this.scene.tweens.add({
        targets: m,
        scale: 3 + Math.random() * 3 * power,
        alpha: 0,
        x: m.x + (Math.random() - 0.5) * 50,
        y: m.y - 10 - Math.random() * 20,
        duration: 700 + Math.random() * 700,
        ease: 'Cubic.Out',
        onComplete: () => m.destroy(),
      });
    }
  }

  /** Paint the surrounding walls, floor and ceiling as if hit by the blast. */
  wallSplash(x: number, y: number, radius: number) {
    const L = this.level;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const reach = radius * (0.5 + Math.random() * 0.5);
      for (let d = 6; d < reach; d += 4) {
        const px = x + ca * d;
        const py = y + sa * d;
        if (L.solidPx(px, py)) {
          const k = 1 - d / reach;
          this.splat(px - ca * 2, py - sa * 2, 0.5 + k * 0.9, Math.random() < 0.6 ? P.blood2 : P.blood1);
          if (Math.abs(sa) < 0.45 && Math.random() < 0.6) this.wallDrip(px - ca * 2, py);
          break;
        }
        // A spattered trail along the ray, thinning out
        if (Math.random() < 0.08) this.splat(px, py, 0.2, P.blood3);
      }
    }
  }

  /** A rope of intestine: a little verlet chain that tumbles and drapes. */
  entrail(x: number, y: number, power = 1) {
    if (this.entrails.length >= MAX_ENTRAILS) this.entrails.shift()!.g.destroy();
    const n = 10 + ((Math.random() * 8) | 0);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const sp = (110 + Math.random() * 160) * Math.sqrt(power);
    const vx = (Math.cos(a) * sp) / 60;
    const vy = (Math.sin(a) * sp) / 60;
    const e: Entrail = {
      g: this.scene.add.graphics().setDepth(DEPTH.corpse + 1),
      px: new Float32Array(n),
      py: new Float32Array(n),
      ox: new Float32Array(n),
      oy: new Float32Array(n),
      t: 0,
      rest: false,
      thick: 3 + Math.random() * 1.5,
    };
    for (let i = 0; i < n; i++) {
      // Leading node flies fastest; the rest unspool behind it
      // Coiled to start, each loop flung a little differently so it writhes
      const k = 1 - (i / n) * 0.7;
      const ca = i * 1.3 + Math.random();
      e.px[i] = x + Math.cos(ca) * 3;
      e.py[i] = y + Math.sin(ca) * 3;
      e.ox[i] = e.px[i] - vx * k - (Math.random() - 0.5) * 2.2;
      e.oy[i] = e.py[i] - vy * k - (Math.random() - 0.5) * 2.2;
    }
    this.entrails.push(e);
  }

  private updateEntrail(e: Entrail, dt: number) {
    const L = this.level;
    const n = e.px.length;
    const g = 700 * dt * dt;
    let motion = 0;
    for (let i = 0; i < n; i++) {
      const vx = (e.px[i] - e.ox[i]) * 0.985;
      const vy = (e.py[i] - e.oy[i]) * 0.985;
      e.ox[i] = e.px[i];
      e.oy[i] = e.py[i];
      let nx = e.px[i] + vx;
      let ny = e.py[i] + vy + g;
      if (L.solidPx(nx, ny)) {
        if (!L.solidPx(e.px[i], ny)) nx = e.px[i];
        else if (!L.solidPx(nx, e.py[i])) ny = e.py[i];
        else ((nx = e.px[i]), (ny = e.py[i]));
        e.ox[i] = nx - vx * 0.3; // friction
        e.oy[i] = ny;
        if (Math.abs(vy) > 1.5) this.splat(nx, ny, 0.3, P.blood2);
      }
      e.px[i] = nx;
      e.py[i] = ny;
      motion += Math.abs(vx) + Math.abs(vy);
    }
    for (let it = 0; it < 3; it++) {
      for (let i = 0; i < n - 1; i++) {
        const dx = e.px[i + 1] - e.px[i];
        const dy = e.py[i + 1] - e.py[i];
        const d = Math.hypot(dx, dy) || 0.001;
        const off = ((d - SEG) / d) * 0.5;
        e.px[i] += dx * off;
        e.py[i] += dy * off;
        e.px[i + 1] -= dx * off;
        e.py[i + 1] -= dy * off;
      }
    }
    e.t += dt;
    if (e.t > 0.15 && Math.random() < 0.3) this.drop(e.px[n - 1], e.py[n - 1], 0, 10, false);
    if ((e.t > 1 && motion < n * 0.08) || e.t > 6) e.rest = true;
    this.drawEntrail(e);
  }

  private drawEntrail(e: Entrail) {
    const g = e.g.clear();
    const n = e.px.length;
    const path = (w: number, col: string, oy = 0) => {
      g.lineStyle(w, hexNum(col), 1).beginPath();
      g.moveTo(Math.round(e.px[0]), Math.round(e.py[0] + oy));
      for (let i = 1; i < n; i++) g.lineTo(Math.round(e.px[i]), Math.round(e.py[i] + oy));
      g.strokePath();
    };
    path(e.thick + 2, '#1a040a');
    path(e.thick, '#8a3a44');
    path(Math.max(1, e.thick - 1.6), '#c06a70', -0.6);
    // Glistening highlights and dark creases
    for (let i = 1; i < n; i += 2) {
      g.fillStyle(hexNum('#ecb4a8'), 1).fillRect(Math.round(e.px[i]) - 0.5, Math.round(e.py[i] - e.thick * 0.4), 1, 1);
      g.fillStyle(hexNum('#3e0a16'), 1).fillRect(Math.round((e.px[i] + e.px[i + 1 < n ? i + 1 : i]) / 2), Math.round(e.py[i]), 1, 1);
    }
  }

  splat(x: number, y: number, scale = 1, color: string = P.blood2) {
    // Queued and drawn in one batch per chunk each frame (render-texture
    // draws are expensive one at a time)
    this.pending.push({ x, y, scale, color, k: (Math.random() * 4) | 0, sy: 0.5 + Math.random() * 0.5 });
    if (this.pending.length > 400) this.flush();
  }

  private flush() {
    if (!this.pending.length) return;
    const byChunk = new Map<Phaser.GameObjects.RenderTexture, Splat[]>();
    for (const p of this.pending) {
      const rt = this.chunk(p.x, p.y);
      let l = byChunk.get(rt);
      if (!l) byChunk.set(rt, (l = []));
      l.push(p);
    }
    this.pending.length = 0;
    for (const [rt, list] of byChunk) {
      rt.beginDraw();
      for (const p of list) {
        this.stamp.setTexture(`splat-${p.k}`).setTint(hexNum(p.color)).setScale(p.scale, p.scale * p.sy).setAlpha(0.95);
        rt.batchDraw(this.stamp, Math.round(p.x - rt.x - (5 + p.k * 1.5) * p.scale), Math.round(p.y - rt.y - (5 + p.k * 1.5) * p.scale * 0.5));
      }
      rt.endDraw();
    }
  }

  pool(x: number, floorY: number, width = 1) {
    for (let i = 0; i < 4; i++) this.splat(x + (Math.random() - 0.5) * 18 * width, floorY - 1, 0.8 + width * 0.5, i % 2 ? P.blood2 : P.blood3);
  }

  update(dt: number) {
    const L = this.level;
    for (const e of this.entrails) if (!e.rest) this.updateEntrail(e, Math.min(dt, 1 / 30));
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
        this.splat(px, py, d.img.texture.key === 'clot' ? 0.8 : d.big ? 0.45 : 0.25, P.blood2);
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
    this.flush();
  }

  private wallDrip(x: number, y: number) {
    const d = this.scene.add.image(x, y, 'drip').setTint(hexNum(P.blood2)).setDepth(DEPTH.gore + 1).setOrigin(0.5, 0);
    this.scene.tweens.add({ targets: d, y: y + 6 + Math.random() * 14, scaleY: 2 + Math.random() * 2, duration: 2500 + Math.random() * 2500, ease: 'Sine.Out' });
  }

  destroy() {
    this.drops.forEach((d) => d.img.destroy());
    this.gibList.forEach((g) => g.img.destroy());
    this.entrails.forEach((e) => e.g.destroy());
    this.chunks.forEach((c) => c.destroy());
    this.stamp.destroy();
  }
}
