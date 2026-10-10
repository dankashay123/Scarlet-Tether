import { PixelCanvas, bayer, hash2 } from '../pixel';

/**
 * Float RGBA painting buffer for large, painterly environment art.
 *
 * Coordinates passed to every method are in FULL-RESOLUTION units; the buffer
 * itself may be stored at 1/s resolution (s = 2 for distant layers, which are
 * then output as 2x2 blocks). Horizontal wrapping makes every layer tile
 * seamlessly: shapes that cross the right edge reappear on the left.
 */
export type RGB = [number, number, number];

export function hex(c: string): RGB {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixc(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function mulc(a: RGB, k: number): RGB {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Value noise, optionally periodic in x with the given period (pixels). */
export function pnoise(x: number, y: number, scale: number, seed = 0, period = 0): number {
  let cells = 0;
  let sc = scale;
  if (period > 0) {
    cells = Math.max(1, Math.round(period / scale));
    sc = period / cells;
  }
  const fx = x / sc;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  let xa = x0;
  let xb = x0 + 1;
  if (cells) {
    xa = ((xa % cells) + cells) % cells;
    xb = ((xb % cells) + cells) % cells;
  }
  const a = hash2(xa, y0, seed);
  const b = hash2(xb, y0, seed);
  const c = hash2(xa, y0 + 1, seed);
  const d = hash2(xb, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, scale: number, seed = 0, period = 0, oct = 3): number {
  let v = 0;
  let amp = 0.5;
  let tot = 0;
  let s = scale;
  for (let o = 0; o < oct; o++) {
    v += pnoise(x, y, s, seed + o * 17, period) * amp;
    tot += amp;
    amp *= 0.5;
    s *= 0.5;
    if (s < 1) break;
  }
  return v / tot;
}

/** Value noise periodic in BOTH axes with period 16 (tile textures). `cells` must divide 16. */
export function tnoise(x: number, y: number, cells: number, seed = 0): number {
  const sc = 16 / cells;
  const fx = x / sc;
  const fy = y / sc;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const m = (v: number) => ((v % cells) + cells) % cells;
  const a = hash2(m(x0), m(y0), seed);
  const b = hash2(m(x0 + 1), m(y0), seed);
  const c = hash2(m(x0), m(y0 + 1), seed);
  const d = hash2(m(x0 + 1), m(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Pointed (gothic) arch opening test. ys = springing line, r = arc radius factor of the span (>= 0.5). */
export function inGothic(x: number, y: number, xl: number, xr: number, ys: number, rf = 0.62): boolean {
  if (x < xl || x > xr) return false;
  if (y >= ys) return true;
  const span = xr - xl;
  const r = span * rf;
  const mid = (xl + xr) / 2;
  const cx = x <= mid ? xl + r : xr - r;
  return (x - cx) ** 2 + (y - ys) ** 2 <= r * r;
}

/** Round (Roman) arch opening test. */
export function inRound(x: number, y: number, xl: number, xr: number, ys: number): boolean {
  if (x < xl || x > xr) return false;
  if (y >= ys) return true;
  const r = (xr - xl) / 2;
  const cx = xl + r;
  return (x - cx) ** 2 + (y - ys) ** 2 <= r * r;
}

export class Paint {
  readonly W: number;
  readonly H: number;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;
  readonly a: Float32Array;

  constructor(
    readonly fw: number,
    readonly fh: number,
    readonly s = 1,
    readonly wrap = true,
  ) {
    this.W = Math.round(fw / s);
    this.H = Math.round(fh / s);
    const n = this.W * this.H;
    this.r = new Float32Array(n);
    this.g = new Float32Array(n);
    this.b = new Float32Array(n);
    this.a = new Float32Array(n);
  }

  /** Internal index for a full-res coordinate, or -1. */
  idx(x: number, y: number): number {
    let i = Math.floor(x / this.s);
    const j = Math.floor(y / this.s);
    if (j < 0 || j >= this.H) return -1;
    if (this.wrap) i = ((i % this.W) + this.W) % this.W;
    else if (i < 0 || i >= this.W) return -1;
    return j * this.W + i;
  }

  putI(i: number, c: RGB, al: number) {
    if (al <= 0 || i < 0) return;
    if (al >= 1) {
      this.r[i] = c[0];
      this.g[i] = c[1];
      this.b[i] = c[2];
      this.a[i] = 1;
      return;
    }
    const a0 = this.a[i];
    const ao = al + a0 * (1 - al);
    const k0 = (a0 * (1 - al)) / ao;
    const k1 = al / ao;
    this.r[i] = c[0] * k1 + this.r[i] * k0;
    this.g[i] = c[1] * k1 + this.g[i] * k0;
    this.b[i] = c[2] * k1 + this.b[i] * k0;
    this.a[i] = ao;
  }

  /** Additive light. On transparent pixels it lays down glowing haze. */
  addI(i: number, c: RGB, amt: number) {
    if (amt <= 0 || i < 0) return;
    const a0 = this.a[i];
    const A = Math.min(1, a0 + amt * (1 - a0));
    this.r[i] = Math.min(255, (this.r[i] * a0 + c[0] * amt) / A);
    this.g[i] = Math.min(255, (this.g[i] * a0 + c[1] * amt) / A);
    this.b[i] = Math.min(255, (this.b[i] * a0 + c[2] * amt) / A);
    this.a[i] = A;
  }

  plot(x: number, y: number, c: RGB, al = 1) {
    this.putI(this.idx(x, y), c, al);
  }

  /**
   * Iterate internal pixels covering a full-res box. `fn` receives the
   * (unwrapped) full-res coordinate of the pixel and its buffer index.
   */
  each(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, i: number) => void) {
    const s = this.s;
    const i0 = Math.floor(x0 / s);
    const i1 = Math.ceil(x1 / s);
    const j0 = Math.max(0, Math.floor(y0 / s));
    const j1 = Math.min(this.H - 1, Math.ceil(y1 / s));
    for (let j = j0; j <= j1; j++) {
      const y = j * s + s * 0.5;
      for (let ii = i0; ii <= i1; ii++) {
        let i = ii;
        if (this.wrap) i = ((i % this.W) + this.W) % this.W;
        else if (i < 0 || i >= this.W) continue;
        fn(ii * s + s * 0.5, y, j * this.W + i);
      }
    }
  }

  all(fn: (x: number, y: number, i: number) => void) {
    this.each(0, 0, this.fw - 1, this.fh - 1, fn);
  }

  rect(x0: number, y0: number, x1: number, y1: number, c: RGB, al = 1) {
    this.each(x0, y0, x1, y1, (x, y, i) => {
      if (x >= x0 && x < x1 && y >= y0 && y < y1) this.putI(i, c, al);
    });
  }

  disc(cx: number, cy: number, r: number, c: RGB, al = 1) {
    this.each(cx - r, cy - r, cx + r, cy + r, (x, y, i) => {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.putI(i, c, al);
    });
  }

  /** Soft radial additive glow. */
  glow(cx: number, cy: number, r: number, c: RGB, amt: number, pow = 2) {
    this.each(cx - r, cy - r, cx + r, cy + r, (x, y, i) => {
      const d = Math.hypot(x - cx, y - cy) / r;
      if (d < 1) this.addI(i, c, amt * Math.pow(1 - d, pow));
    });
  }

  /** Line of discs. */
  stroke(x0: number, y0: number, x1: number, y1: number, rad: number, c: RGB, al = 1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const L2 = dx * dx + dy * dy || 1;
    this.each(Math.min(x0, x1) - rad, Math.min(y0, y1) - rad, Math.max(x0, x1) + rad, Math.max(y0, y1) + rad, (x, y, i) => {
      let t = ((x - x0) * dx + (y - y0) * dy) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      if ((x - x0 - dx * t) ** 2 + (y - y0 - dy * t) ** 2 <= rad * rad) this.putI(i, c, al);
    });
  }

  /** Composite a PixelCanvas (full-res buffers only), optionally recolouring. */
  blit(pc: PixelCanvas, dx: number, dy: number, tint?: (c: RGB, x: number, y: number) => RGB, alpha = 1) {
    for (let y = 0; y < pc.h; y++)
      for (let x = 0; x < pc.w; x++) {
        const o = (y * pc.w + x) * 4;
        const al = pc.data[o + 3] / 255;
        if (al <= 0) continue;
        let c: RGB = [pc.data[o], pc.data[o + 1], pc.data[o + 2]];
        if (tint) c = tint(c, dx + x, dy + y);
        this.plot(dx + x, dy + y, c, al * alpha);
      }
  }

  /**
   * Quantise to a pixel-art image: channels are posterised to `levels` steps
   * with ordered dithering (shared threshold so hues stay coherent).
   */
  toPixelCanvas(levels = 24, ditherAlpha = false): PixelCanvas {
    const s = this.s;
    const pc = new PixelCanvas(this.fw, this.fh);
    const d = pc.data;
    const q = 255 / levels;
    for (let j = 0; j < this.H; j++)
      for (let i = 0; i < this.W; i++) {
        const k = j * this.W + i;
        let al = this.a[k];
        if (al < 0.03) continue;
        const t = bayer(i, j);
        let f = this.r[k] / q;
        let n = Math.floor(f);
        const R = Math.min(255, Math.round((f - n > t ? n + 1 : n) * q));
        f = this.g[k] / q;
        n = Math.floor(f);
        const G = Math.min(255, Math.round((f - n > t ? n + 1 : n) * q));
        f = this.b[k] / q;
        n = Math.floor(f);
        const B = Math.min(255, Math.round((f - n > t ? n + 1 : n) * q));
        if (ditherAlpha) {
          f = al * 4;
          n = Math.floor(f);
          if (f - n > t) n++;
          al = n / 4;
          if (al <= 0) continue;
        }
        const A = Math.round(al * 255);
        for (let yy = 0; yy < s; yy++)
          for (let xx = 0; xx < s; xx++) {
            const X = i * s + xx;
            const Y = j * s + yy;
            if (X >= this.fw || Y >= this.fh) continue;
            const o = (Y * this.fw + X) * 4;
            d[o] = R;
            d[o + 1] = G;
            d[o + 2] = B;
            d[o + 3] = A;
          }
      }
    return pc;
  }
}

/** Pick from a colour ramp with ordered dithering (crisp pixel-art shading). */
export function pick(ramp: string[], v: number, x: number, y: number): string {
  const n = ramp.length;
  const f = clamp01(v) * (n - 1) * 0.9999;
  let i = Math.floor(f);
  if (f - i > bayer(x, y)) i++;
  return ramp[Math.max(0, Math.min(n - 1, i))];
}
