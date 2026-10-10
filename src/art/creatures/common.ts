// Shared materials and drawing helpers for the generated creature sprites.
import { Figure, KEY_LIGHT, folds, grain, ramp, type Light, type Material } from '../render';
import { PixelCanvas, hash2, valueNoise } from '../pixel';
import { BLOOD, OLD_BLOOD, IRON, RUST, shade } from '../hero';
import { SheetBuilder } from '../sheet';

export { BLOOD, OLD_BLOOD, IRON, RUST, shade, hash2, valueNoise, Figure, folds, grain, ramp };
export type { Material };

export type V2 = [number, number];

export interface AnimDef {
  name: string;
  frames: PixelCanvas[];
  fps: number;
  repeat: number;
}

export const anim = (name: string, frames: PixelCanvas[], fps = 8, repeat = -1): AnimDef => ({ name, frames, fps, repeat });

export function registerAnims(scene: Phaser.Scene, key: string, anims: AnimDef[]) {
  const sb = new SheetBuilder(key);
  for (const a of anims) sb.add(a.name, a.frames, a.fps, a.repeat);
  sb.build(scene);
}

export const LIGHT: Light = { ...KEY_LIGHT, ambient: 0.12, rim: 0.7 };
export const renderFig = (f: Figure) => f.render(LIGHT);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const skinCache = new Map<string, string[]>();
export function skinMat(base: string, spec = 0.3, tex = grain(1.5, 0.06, 3)): Material {
  let r = skinCache.get(base);
  if (!r) {
    r = ramp(['#140709', shade(base, -0.62), shade(base, -0.38), shade(base, -0.15), base, shade(base, 0.22)], 7);
    skinCache.set(base, r);
  }
  return { ramp: r, spec, tex };
}

/** A darker, deeper copy of a material (for limbs on the far side). */
export function back(m: Material, t = 0.3): Material {
  return { ...m, ramp: m.ramp.map((c) => shade(c, -t)) };
}

export function clothMat(base: string, phase = 0, seed = 4): Material {
  return {
    ramp: ramp(['#120b0c', shade(base, -0.66), shade(base, -0.45), shade(base, -0.26), shade(base, -0.1), base, shade(base, 0.2)], 8),
    tex: folds(2.4, 0.22, seed, phase * Math.PI * 2),
    round: 0.7,
  };
}

export function flat(colors: string[], round = 0): Material {
  return { ramp: colors, round };
}

export const VOID: Material = { ramp: ['#050203', '#0f0507', '#1e0a0d'], round: -0.6 };
export const MOUTH: Material = { ramp: ['#0a0204', '#2a0609', '#5a0f18', '#8a2030', '#b04050'], round: -1, spec: 0.6 };
export const TEETH: Material = { ramp: ['#3a2c1c', '#7a6844', '#b8a476', '#ddd0a8', '#f4ecd0'], spec: 0.6, round: 0.6 };
export const NAIL: Material = { ramp: ['#1a120a', '#4a3a22', '#7e6a44', '#a8946a', '#d4c49a'], spec: 0.7 };
export const BONE: Material = { ramp: ['#1e160e', '#4a3c28', '#7c6a4a', '#a8946c', '#cfbd92', '#efe3bf'], spec: 0.25, tex: grain(1.5, 0.08, 17) };
export const THREAD: Material = { ramp: ['#020102', '#0e0a0c', '#262024'], round: 0.2 };
export const GOLD: Material = { ramp: ['#2a1a06', '#5a3c10', '#8a6220', '#b98a2e', '#e8c25a', '#fff1a8'], spec: 1, round: 0.5 };
export const BRASS: Material = { ramp: ['#1e1206', '#3e2810', '#6a4a1e', '#a87a35', '#d0a050', '#f4d890'], spec: 1, tex: grain(1.5, 0.1, 23), round: 0.9 };
export const BILE: Material = { ramp: ['#1e1c06', '#3a380e', '#5e5a18', '#8d8a2e', '#b6b244', '#d8d66a', '#f4f4a8'], spec: 0.9, round: 0.5 };
export const MALICE: Material = { ramp: ['#0e1a06', '#22360c', '#3e5814', '#62801e', '#8eaa30', '#bcd456', '#e8f49a'], spec: 0.9, round: 0.6 };
export const GLOW: Material = { ramp: ['#c25a10', '#ff9a30', '#ffd060', '#fff0b0'], round: 0.2 };
export const SMOKE: Material = { ramp: ['#2e2a28', '#4a4440', '#6e6660', '#948a7e', '#bdb3a4', '#d8d0c2'], round: 0.9, tex: grain(2.5, 0.12, 31) };
export const MARBLE: Material = { ramp: ['#3a3630', '#6e665a', '#9a9284', '#c2baa8', '#ddd5c4', '#efe9dc', '#fbf8f0'], spec: 0.35, tex: (x, y) => (Math.abs(valueNoise(x, y, 6, 77) - 0.5) < 0.03 ? -0.12 : 0) };
export const HOLY: Material = { ramp: ['#8a6220', '#e8c25a', '#fff1a8', '#fffbe0'], round: 0.3, spec: 1 };
export const VEIN: Material = { ramp: ['#1a0a1e', '#36163a', '#58284e', '#7a3a5e'], round: 0.3 };
export const RAW: Material = { ramp: ['#2a0610', '#5a1020', '#8a2030', '#b8404a', '#d86a6a', '#f4a0a0'], spec: 0.8, tex: grain(1.2, 0.1, 41) };
export const GLASS: Material = { ramp: ['#1a2a34', '#2f4a5a', '#4e7486', '#7aa4b4', '#b4d8e4', '#effcff'], spec: 1, round: 0.8 };
export const TEAR: Material = { ramp: ['#1c3a5e', '#336b9e', '#6fb3e0', '#bfe6ff'], spec: 1, round: 0.6 };

export function woodMat(base = '#6e2e1c', seed = 5): Material {
  return {
    ramp: ramp(['#120705', shade(base, -0.65), shade(base, -0.42), shade(base, -0.2), base, shade(base, 0.18), shade(base, 0.36)], 7),
    spec: 0.35,
    round: 0.35,
    tex: (x, y) => Math.sin(x * 1.3 + valueNoise(x, y, 5, seed) * 6) * 0.07 + (hash2(x, y >> 2, seed) > 0.92 ? -0.12 : 0),
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const at = (a: V2, b: V2, t: number): V2 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

/** A point in a rotated frame: `u` along `forward`, `v` along `up`; θ tilts the frame forward. */
export function loc(c: V2, th: number, u: number, v: number): V2 {
  return [c[0] + Math.cos(th) * u + Math.sin(th) * v, c[1] + Math.sin(th) * u - Math.cos(th) * v];
}

/** Inverse of `loc`: screen → local (u forward, v up). */
export function toLocal(c: V2, th: number, x: number, y: number): V2 {
  const dx = x - c[0];
  const dy = y - c[1];
  return [dx * Math.cos(th) + dy * Math.sin(th), dx * Math.sin(th) - dy * Math.cos(th)];
}

export function segDist(x: number, y: number, a: V2, b: V2) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy || 1;
  let t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
}

/** Mask for a polyline of width w. */
export function lineMask(pts: V2[], w: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return (x: number, y: number) => {
    if (x < x0 - w || x > x1 + w || y < y0 - w || y > y1 + w) return false;
    for (let i = 1; i < pts.length; i++) if (segDist(x, y, pts[i - 1], pts[i]) <= w) return true;
    return false;
  };
}

export const circleMask = (cx: number, cy: number, r: number) => (x: number, y: number) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
export const ellMask = (cx: number, cy: number, rx: number, ry: number) => (x: number, y: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** A chain of tapered capsules through points. */
export function tube(f: Figure, pts: V2[], r0: number, r1: number, m: Material, layer: number) {
  for (let i = 1; i < pts.length; i++) {
    const ra = lerp(r0, r1, (i - 1) / (pts.length - 1));
    const rb = lerp(r0, r1, i / (pts.length - 1));
    f.capsule(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], ra, rb, m, layer);
  }
}

/** Quadratic bezier sampled into n+1 points. */
export function bez(a: V2, c: V2, b: V2, n = 6): V2[] {
  const out: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** A hanging drip of liquid: a thin tapering stream with a bead at the end. */
export function drip(f: Figure, x: number, y: number, len: number, m: Material = BLOOD, layer = 20, w = 0.7) {
  f.capsule(x, y, x + 0.2, y + len, w, w * 0.6, m, layer);
  f.ellipse(x + 0.2, y + len + 0.6, w + 0.4, w + 0.7, m, layer);
}

/** A flat pool of liquid on the floor. */
export function pool(f: Figure, cx: number, y: number, rx: number, m: Material = BLOOD, seed = 1, layer = 0) {
  f.add(
    (x, yy) => {
      const dx = (x - cx) / rx;
      const wob = 1 + (valueNoise(x, 0, 4, seed) - 0.5) * 0.5;
      const ry = 2.2 * wob;
      return dx * dx + ((yy - y) / ry) ** 2 <= 1;
    },
    { ...m, round: 0.15 },
    layer,
    [cx - rx, y - 4, cx + rx, y + 4],
  );
}

/** Axis-aligned ellipse with a tight bounding box (cheaper than Figure.ellipse for wide shapes). */
export function ellT(f: Figure, cx: number, cy: number, rx: number, ry: number, m: Material, layer: number) {
  f.add((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, m, layer, [cx - rx, cy - ry, cx + rx, cy + ry]);
}

/** Annulus (rings, halos). */
export function ring(f: Figure, cx: number, cy: number, rx: number, ry: number, w: number, m: Material, layer: number, rot = 0) {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  f.add(
    (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * c - dy * s;
      const v = dx * s + dy * c;
      const d = Math.sqrt((u * u) / (rx * rx) + (v * v) / (ry * ry));
      return Math.abs(d - 1) * Math.min(rx, ry) <= w;
    },
    m,
    layer,
    [cx - rx - w - 1, cy - rx - w - 1, cx + rx + w + 1, cy + rx + w + 1],
  );
}

/** Black cross-stitches along a seam (a sewn mouth, a sutured wound). */
export function stitches(f: Figure, a: V2, b: V2, n: number, h: number, layer: number, m: Material = THREAD) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const px = -dy / L;
  const py = dx / L;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const cx = a[0] + dx * t;
    const cy = a[1] + dy * t;
    const sk = (dx / L) * h * 0.4;
    f.capsule(cx - px * h - sk, cy - py * h, cx + px * h + sk, cy + py * h, 0.45, 0.45, m, layer);
  }
}

/** Noisy blotches (bruising, gold leaf, mould) as a stain mask. */
export const blotch = (scale: number, thr: number, seed: number) => (x: number, y: number) => valueNoise(x, y, scale, seed) > thr;
/** Thin branching veins: the zero-crossing ridge of a noise field. */
export const veins = (scale: number, w: number, seed: number) => (x: number, y: number) => Math.abs(valueNoise(x, y, scale, seed) - 0.5) < w;

const fieldCache = new Map<string, Float32Array>();
/** valueNoise sampled once into a cached grid: cheap for big repeated stains. */
export function noiseField(w: number, h: number, scale: number, seed: number) {
  const key = `${w}x${h}:${scale}:${seed}`;
  let a = fieldCache.get(key);
  if (!a) {
    a = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = valueNoise(x + 0.5, y + 0.5, scale, seed);
    fieldCache.set(key, a);
  }
  const arr = a;
  return (x: number, y: number) => arr[Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0))];
}

export function frame(w: number, h: number) {
  return new Figure(w, h);
}
