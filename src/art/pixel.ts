import { rgba } from './palette';

/** Deterministic PRNG so generated art is identical on every launch. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash-based 2D value noise in [0,1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function valueNoise(x: number, y: number, scale: number, seed = 0): number {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Ordered-dither threshold (4x4 Bayer) in [0,1). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

/**
 * A tiny RGBA framebuffer with pixel-art drawing primitives. Every sprite,
 * tile and UI element in the game is painted through this.
 */
export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  px(x: number, y: number, color: string, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y) || color === 'transparent') return;
    const [r, g, b] = rgba(color);
    const i = (y * this.w + x) * 4;
    if (alpha >= 1) {
      this.data[i] = r;
      this.data[i + 1] = g;
      this.data[i + 2] = b;
      this.data[i + 3] = 255;
    } else {
      const a0 = this.data[i + 3] / 255;
      const out = alpha + a0 * (1 - alpha);
      if (out <= 0) return;
      this.data[i] = (r * alpha + this.data[i] * a0 * (1 - alpha)) / out;
      this.data[i + 1] = (g * alpha + this.data[i + 1] * a0 * (1 - alpha)) / out;
      this.data[i + 2] = (b * alpha + this.data[i + 2] * a0 * (1 - alpha)) / out;
      this.data[i + 3] = out * 255;
    }
  }

  erase(x: number, y: number) {
    if (!this.inside(x, y)) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  alphaAt(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, color: string) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
  }

  strokeRect(x: number, y: number, w: number, h: number, color: string) {
    for (let i = 0; i < w; i++) {
      this.px(x + i, y, color);
      this.px(x + i, y + h - 1, color);
    }
    for (let j = 0; j < h; j++) {
      this.px(x, y + j, color);
      this.px(x + w - 1, y + j, color);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string | ((x: number, y: number, nx: number, ny: number) => string | null)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) {
          const c = typeof color === 'function' ? color(x, y, nx, ny) : color;
          if (c) this.px(x, y, c);
        }
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, color: string) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Thick line made of discs. */
  thickLine(x0: number, y0: number, x1: number, y1: number, r: number, color: string) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, color);
    }
  }

  /** Filled polygon (even-odd scanline). */
  poly(points: [number, number][], color: string) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) {
          xs.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, color);
      }
    }
  }

  /** Recolour every opaque pixel through fn (for shading passes). */
  map(fn: (x: number, y: number, r: number, g: number, b: number, a: number) => string | null) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const c = fn(x, y, this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]);
        if (c) this.px(x, y, c);
      }
    }
  }

  /** 1px outline around all opaque pixels (8-neighbour by default). */
  outline(color: string, diagonal = false) {
    const marks: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) > 0) continue;
        const n =
          this.alphaAt(x - 1, y) > 0 ||
          this.alphaAt(x + 1, y) > 0 ||
          this.alphaAt(x, y - 1) > 0 ||
          this.alphaAt(x, y + 1) > 0 ||
          (diagonal &&
            (this.alphaAt(x - 1, y - 1) > 0 ||
              this.alphaAt(x + 1, y - 1) > 0 ||
              this.alphaAt(x - 1, y + 1) > 0 ||
              this.alphaAt(x + 1, y + 1) > 0));
        if (n) marks.push(x, y);
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i], marks[i + 1], color);
  }

  /** Copy another canvas onto this one (opaque pixels only, optional flip). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        const a = src.data[i + 3];
        if (a === 0) continue;
        const tx = dx + (flipX ? src.w - 1 - x : x);
        const ty = dy + y;
        if (!this.inside(tx, ty)) continue;
        const o = (ty * this.w + tx) * 4;
        if (a === 255) {
          this.data[o] = src.data[i];
          this.data[o + 1] = src.data[i + 1];
          this.data[o + 2] = src.data[i + 2];
          this.data[o + 3] = 255;
        } else {
          const hex =
            '#' +
            [src.data[i], src.data[i + 1], src.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
          this.px(tx, ty, hex, a / 255);
        }
      }
    }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

/**
 * Packs frames into a single texture strip and registers numbered frames,
 * so Phaser animations can address them as frame 0..n-1.
 */
export function registerSheet(
  scene: Phaser.Scene,
  key: string,
  frames: PixelCanvas[],
) {
  if (frames.length === 0) return;
  const fw = frames[0].w;
  const fh = frames[0].h;
  const cols = Math.min(frames.length, Math.max(1, Math.floor(2048 / fw)));
  const rows = Math.ceil(frames.length / cols);
  const sheet = new PixelCanvas(fw * cols, fh * rows);
  frames.forEach((f, i) => sheet.blit(f, (i % cols) * fw, Math.floor(i / cols) * fh));
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, sheet.toCanvas())!;
  frames.forEach((_, i) => tex.add(i, 0, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
}

export function registerImage(scene: Phaser.Scene, key: string, pc: PixelCanvas) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
}
