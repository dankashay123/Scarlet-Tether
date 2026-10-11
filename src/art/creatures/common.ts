// Shared materials and drawing helpers for the generated creature sprites.
import { KEY_LIGHT, folds, grain, ramp, type Light } from '../render';
import { Figure, type Material } from './fig';
import { PixelCanvas, hash2, valueNoise } from '../pixel';
import { mix } from '../palette';
import { BLOOD as BLOOD0, OLD_BLOOD as OLD_BLOOD0, IRON as IRON0, RUST as RUST0, shade } from '../hero';
import { SheetBuilder } from '../sheet';

export { shade, hash2, valueNoise, Figure, folds, grain, ramp, mix };

// Wet and polished materials get a crisp specular glint in the creature renderer.
export const BLOOD: Material = { ...BLOOD0, ramp: ['#1c0105', '#3a0410', '#5e0818', '#860e22', '#a8162a', '#cc2832', '#ee5046'], glint: '#ffb4a0', shine: 30, dither: 0.3, wrap: 0 };
export const OLD_BLOOD: Material = { ...OLD_BLOOD0, dither: 0.35 };
export const IRON: Material = { ...IRON0, tex: fgrain(1.5, 0.12, 7), glint: '#e4e2ea', shine: 40, dither: 0.25, wrap: 0 };
export const RUST: Material = { ...RUST0, tex: fgrain(1.5, 0.15, 9), dither: 0.45 };
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

export const LIGHT: Light = { ...KEY_LIGHT, z: 0.42, ambient: 0.1, rim: 0.6 };
export const renderFig = (f: Figure) => f.render(LIGHT);

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cached noise: every sprite samples the same few noise fields thousands of
// times per frame, so they are baked once into grids.
// ---------------------------------------------------------------------------
const VN_W = 128;
const VN_H = 112;
const vnCache = new Map<number, Float32Array>();
function vnField(scale: number, seed: number) {
  const key = scale * 100003 + seed;
  let a = vnCache.get(key);
  if (!a) {
    a = new Float32Array(VN_W * VN_H);
    for (let yy = 0; yy < VN_H; yy++) for (let xx = 0; xx < VN_W; xx++) a[yy * VN_W + xx] = valueNoise(xx + 0.5, yy + 0.5, scale, seed);
    vnCache.set(key, a);
  }
  return a;
}
let lastKey = NaN;
let lastField: Float32Array | null = null;
/** valueNoise(x, y, scale, seed), looked up from a baked grid when in range. */
export function vn(x: number, y: number, scale: number, seed: number) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= VN_W || yi >= VN_H) return valueNoise(x, y, scale, seed);
  const key = scale * 100003 + seed;
  if (key !== lastKey) {
    lastKey = key;
    lastField = vnField(scale, seed);
  }
  return lastField![yi * VN_W + xi];
}
/** A baked noise lookup bound to one field (fastest for per-pixel textures). */
export function vnOf(scale: number, seed: number) {
  let a: Float32Array | null = null;
  return (x: number, y: number) => {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= VN_W || yi >= VN_H) return valueNoise(x, y, scale, seed);
    if (!a) a = vnField(scale, seed);
    return a[yi * VN_W + xi];
  };
}
/** Fast grain texture (value offset) from a baked noise field. */
export function fgrain(scale = 2, amount = 0.15, seed = 0) {
  const n = vnOf(scale, seed);
  return (x: number, y: number) => (n(x, y) - 0.5) * amount * 2;
}

const skinCache = new Map<string, string[]>();
/** Hue-shifted flesh ramp: shadows sink into bruise-crimson, lights warm to ivory. */
export function fleshRamp(base: string, n = 9) {
  return ramp(['#0d0408', mix(base, '#1e0610', 0.84), mix(base, '#34101c', 0.64), mix(base, '#4c1a26', 0.44), mix(base, '#623038', 0.24), base, mix(base, '#ffe2bc', 0.2), mix(base, '#fff4e0', 0.42)], n);
}
const pores = fgrain(1.2, 0.05, 3);
export function skinMat(base: string, spec = 0.3, tex = pores): Material {
  let r = skinCache.get(base);
  if (!r) {
    r = fleshRamp(base);
    skinCache.set(base, r);
  }
  return { ramp: r, spec, tex, wrap: 0.25, dither: 0.45, shine: 40, glint: spec >= 0.45 ? mix(base, '#fff8ee', 0.7) : undefined };
}

/** A darker, deeper copy of a material (for limbs on the far side). */
export function back(m: Material, t = 0.3): Material {
  return { ...m, ramp: m.ramp.map((c) => shade(c, -t)) };
}

export function clothMat(base: string, phase = 0, seed = 4): Material {
  const ph = phase * Math.PI * 2;
  return {
    ramp: ramp(['#0c0708', shade(base, -0.7), shade(base, -0.5), shade(base, -0.3), shade(base, -0.12), base, shade(base, 0.16)], 9),
    tex: (x, y) => (vn(x, y, 2.2, seed + 3) - 0.5) * 0.1 + (hash2(x | 0, y | 0, seed) > 0.94 ? -0.08 : 0),
    // hanging folds: sinuous vertical ridges that sway with the phase
    bump: (x, y) => Math.sin((x + Math.sin(y * 0.13 + ph) * 2.2) / 1.9 + seed) * 0.9 + (vn(x, y, 3, seed + 7) - 0.5) * 0.8,
    round: 0.7,
    wrap: 0.25,
    dither: 0.45,
  };
}

export function flat(colors: string[], round = 0): Material {
  return { ramp: colors, round };
}

export const VOID: Material = { ramp: ['#050203', '#0f0507', '#1e0a0d'], round: -0.6 };
export const MOUTH: Material = { ramp: ['#0a0204', '#2a0609', '#5a0f18', '#8a2030', '#b04050'], round: -1, spec: 0.6, glint: '#e88890', dither: 0.3 };
export const TEETH: Material = { ramp: ['#2e2216', '#5e4e34', '#8e7c58', '#b8a67c', '#d8cca4', '#f2ead0'], spec: 0.6, round: 0.6, glint: '#fffaf0', dither: 0.2, wrap: 0.1 };
export const NAIL: Material = { ramp: ['#1a120a', '#3e2e1c', '#64523a', '#8e7a56', '#b4a07a', '#dccca2'], spec: 0.7, glint: '#fff4d8', dither: 0.25, shine: 30 };
export const BONE: Material = { ramp: ['#1e160e', '#3e3222', '#5e4e36', '#7e6c4e', '#a08c68', '#c4b08a', '#e2d4ae', '#f6eed4'], spec: 0.25, tex: fgrain(1.5, 0.06, 17), dither: 0.35 };
/** Waxed gut thread: reads as stitching, not as a hole, at sprite scale. */
export const CATGUT: Material = { ramp: ['#1a0c08', '#38200f', '#5a3a1e', '#7e5a34'], round: 0.4, spec: 0.4, dither: 0 };
export const THREAD: Material = { ramp: ['#020102', '#0e0a0c', '#262024'], round: 0.2 };
export const GOLD: Material = { ramp: ['#1e1004', '#42280a', '#6c4614', '#946a22', '#bb8e30', '#e0b84e', '#fbe08a'], spec: 1, round: 0.5, glint: '#fffbe0', dither: 0.2, wrap: 0, shine: 30 };
export const BRASS: Material = { ramp: ['#160d05', '#34210c', '#563a16', '#7e5824', '#a87a35', '#cc9c4c', '#ecca7c'], spec: 1, tex: fgrain(1.5, 0.08, 23), round: 0.9, glint: '#fff6d0', dither: 0.25, wrap: 0, shine: 32 };
export const BILE: Material = { ramp: ['#161404', '#2e2c0a', '#4c4812', '#6e6a20', '#948e30', '#b8b244', '#d6d264', '#eeec9c'], spec: 0.9, round: 0.5, glint: '#fcffd8', dither: 0.3, shine: 28 };
export const MALICE: Material = { ramp: ['#0e1a06', '#22360c', '#3e5814', '#62801e', '#8eaa30', '#bcd456', '#e8f49a'], spec: 0.9, round: 0.6 };
export const GLOW: Material = { ramp: ['#c25a10', '#ff9a30', '#ffd060', '#fff0b0'], round: 0.2 };
export const SMOKE: Material = { ramp: ['#2e2a28', '#4a4440', '#6e6660', '#948a7e', '#bdb3a4', '#d8d0c2'], round: 0.9, tex: fgrain(2.5, 0.12, 31) };
export const MARBLE: Material = { ramp: ['#3a3630', '#6e665a', '#9a9284', '#c2baa8', '#ddd5c4', '#efe9dc', '#fbf8f0'], spec: 0.35, tex: (x, y) => (Math.abs(vn(x, y, 6, 77) - 0.5) < 0.03 ? -0.12 : 0) };
export const HOLY: Material = { ramp: ['#8a6220', '#e8c25a', '#fff1a8', '#fffbe0'], round: 0.3, spec: 1 };
export const VEIN: Material = { ramp: ['#1a0a1e', '#36163a', '#58284e', '#7a3a5e'], round: 0.3 };
export const RAW: Material = { ramp: ['#1e040b', '#3e0a16', '#621222', '#88202e', '#ac3a42', '#cc5c5a', '#e8867c'], spec: 0.8, tex: fgrain(1.2, 0.08, 41), bump: (x, y) => (vn(x, y, 1.6, 43) - 0.5) * 1.6, glint: '#ffd0c0', dither: 0.35, shine: 26 };
export const GLASS: Material = { ramp: ['#1a2a34', '#2f4a5a', '#4e7486', '#7aa4b4', '#b4d8e4', '#effcff'], spec: 1, round: 0.8 };
export const TEAR: Material = { ramp: ['#1c3a5e', '#336b9e', '#6fb3e0', '#bfe6ff'], spec: 1, round: 0.6 };

export function woodMat(base = '#6e2e1c', seed = 5): Material {
  return {
    ramp: ramp(['#0e0504', shade(base, -0.68), shade(base, -0.46), shade(base, -0.24), base, shade(base, 0.16), shade(base, 0.34)], 9),
    spec: 0.4,
    shine: 30,
    round: 0.35,
    wrap: 0,
    dither: 0.3,
    tex: (x, y) => Math.sin(x * 1.3 + vn(x, y, 5, seed) * 6) * 0.06 + (hash2(x, y >> 2, seed) > 0.93 ? -0.1 : 0),
    bump: (x, y) => Math.sin(x * 1.1 + vn(x, y, 6, seed) * 5) * 0.35,
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
export const blotch = (scale: number, thr: number, seed: number) => (x: number, y: number) => vn(x, y, scale, seed) > thr;
/** Thin branching veins: the zero-crossing ridge of a noise field. */
export const veins = (scale: number, w: number, seed: number) => (x: number, y: number) => Math.abs(vn(x, y, scale, seed) - 0.5) < w;

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

// ---------------------------------------------------------------------------
// Relief (bends normals: anatomy, wrinkles, seams)
// ---------------------------------------------------------------------------

function ptsBox(pts: V2[], w: number): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0 - w, y0 - w, x1 + w, y1 + w];
}

/** A raised (h>0) or sunken (h<0) ridge of half-width w along a polyline. */
export function ridge(f: Figure, pts: V2[], w: number, h: number, only?: Material[]) {
  const n = pts.length - 1;
  if (n < 1) return;
  const ax = new Float64Array(n), ay = new Float64Array(n), dx = new Float64Array(n), dy = new Float64Array(n), il = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    ax[i] = pts[i][0];
    ay[i] = pts[i][1];
    dx[i] = pts[i + 1][0] - ax[i];
    dy[i] = pts[i + 1][1] - ay[i];
    il[i] = 1 / (dx[i] * dx[i] + dy[i] * dy[i] || 1);
  }
  const w2 = w * w;
  const k = (Math.PI * 0.5) / w;
  f.relief((x, y) => {
    let d2 = w2;
    for (let i = 0; i < n; i++) {
      let t = ((x - ax[i]) * dx[i] + (y - ay[i]) * dy[i]) * il[i];
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - ax[i] - dx[i] * t;
      const ey = y - ay[i] - dy[i] * t;
      const e = ex * ex + ey * ey;
      if (e < d2) d2 = e;
    }
    if (d2 >= w2) return 0;
    const c = Math.cos(Math.sqrt(d2) * k);
    return h * c * c;
  }, ptsBox(pts, w), only);
}

/** A smooth bulge (muscle, knuckle, swelling) or dent (h<0). */
export function dome(f: Figure, cx: number, cy: number, rx: number, ry: number, h: number, rot = 0, only?: Material[]) {
  const c = Math.cos(-rot);
  const s = Math.sin(-rot);
  const r = Math.max(rx, ry);
  f.relief((x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const u = (dx * c - dy * s) / rx;
    const v = (dx * s + dy * c) / ry;
    const d = u * u + v * v;
    return d >= 1 ? 0 : h * (1 - d) * (1 - d);
  }, [cx - r, cy - r, cx + r, cy + r], only);
}

/** Bump texture: fine crisscross wrinkles (old, loose or dried skin). */
export const wrinkleBump = (scale: number, amt: number, seed: number) => (x: number, y: number) => {
  const n = vn(x, y, scale, seed);
  return (Math.abs(n - 0.5) < 0.06 ? -amt : 0) + (vn(x, y, scale * 0.45, seed + 1) - 0.5) * amt * 0.5;
};
