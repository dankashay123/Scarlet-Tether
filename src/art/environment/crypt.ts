import { PixelCanvas, bayer, hash2 } from '../pixel';
import { type RGB, fbm, hex, inRound, pnoise, smooth } from './paint';
import { EMPTY, type Glow, type PLight, type RMat, Relief, type ShadeOpts, ramp } from './relief';
import { M, type RotSpec, ashlar, catenary, chain, hit, shafts } from './nave';

/**
 * The crypt backdrops: a cold catacomb of blue-green-grey stone. Round
 * voussoir arches on heavy piers, burial niches lit by stubs of candle,
 * ossuary walls of skulls, sarcophagi and rubble, and everywhere ice:
 * icicles off every lip, wet drip streaks down the pillars, cobwebs in the
 * corners and a low mist over the floor.
 *
 * Like the nave, each layer's relief is built once and shaded twice: as cold
 * stone, then (after the shared flesh overgrowth pass) as its rot twin.
 *
 * The small helpers here (icicles, niches, candles, cage lanterns, skulls,
 * rubble, mist, cobwebs and the plain/rot assembly) are shared with bridge.ts.
 */

export const W = 640;
export const H = 360;

/** Material ids beyond the nave's (which rotify() and the nave helpers use). */
export const X = { ICE: 17, MOSS: 18, WAX: 19, FLAME: 20, SKY: 21, CITY: 22, CITYGOLD: 23, CLOUD: 24 } as const;

export const wrapX = (x: number) => ((x % W) + W) % W;

export interface Look {
  mats: (RMat | undefined)[];
  lamp: RGB;
  candle: RGB;
  cold: RGB;
  amb: RGB;
  key: RGB;
  keyDir?: [number, number, number];
  fog: RGB;
  haze: RGB;
  mist: RGB;
  web: RGB;
}

export interface TLayer {
  R: Relief;
  lights: (t: Look) => PLight[];
  glows: (t: Look) => Glow[];
  opts: (t: Look) => Partial<ShadeOpts>;
  rot: RotSpec;
  post?: (pc: PixelCanvas, t: Look) => void;
}

export type Layers = { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas };

export function matTable(def: Record<number, RMat>): (RMat | undefined)[] {
  const out: (RMat | undefined)[] = [];
  for (const k of Object.keys(def)) out[Number(k)] = def[Number(k)];
  return out;
}

// Shared flesh ramps (same as the nave's so every rot reads as one body)
export const FLESH_R = ramp(['#0c0203', '#2a080c', '#521418', '#7e2a26', '#ae5040', '#d88a6c', '#f4c4a4'], 10);
export const BLOOD_R = ramp(['#140103', '#3e050c', '#760c18', '#b01a24', '#e84a3a'], 7);
export const BONE_R = ramp(['#1a120c', '#4a3824', '#86704c', '#bca274', '#ece0bc'], 8);
export const SINEW_R = ramp(['#0a0205', '#22070c', '#3e1016', '#5e2020', '#86402e', '#a8644a'], 7);
export const IRIS_R = ramp(['#2a0804', '#7a1c08', '#c85a14', '#f0b040'], 5);

export const fleshMats = (): Record<number, RMat> => ({
  [M.FLESH]: { ramp: FLESH_R, spec: 0.9 },
  [M.BLOOD]: { ramp: BLOOD_R, spec: 1 },
  [M.SINEW]: { ramp: SINEW_R, spec: 0.6 },
  [M.IRIS]: { ramp: IRIS_R, spec: 0.8 },
});

/** Shade every layer plain, overgrow it, shade it again as rot. */
export function buildPair(makers: Record<keyof Layers, () => TLayer>, plain: Look, rot: Look): { plain: Layers; rot: Layers } {
  const a = {} as Layers;
  const b = {} as Layers;
  for (const k of ['far', 'mid', 'near', 'fg'] as (keyof Layers)[]) {
    const L = makers[k]();
    a[k] = shadeT(L, plain);
    overgrow(L.R, L.rot);
    b[k] = shadeT(L, rot);
  }
  return { plain: a, rot: b };
}

// --- Rot overgrowth ------------------------------------------------------------------

/**
 * The nave's flesh pass (same look and rules as nave.ts rotify), but its noise
 * fields are computed once and shared by every crypt and bridge layer: each
 * layer reads them at its own horizontal offset (and mirrored for odd seeds),
 * which keeps boot cheap on phones.
 */
let FIELD: { g: Float32Array; lump: Float32Array; vein: Float32Array } | null = null;

/**
 * Evaluate `fn` on a half-resolution grid and upsample bilinearly to a full
 * W x H field (wrapping in x). The noises sampled this way are all much
 * coarser than 2 px, so this is visually identical at a quarter of the cost.
 */
export function halfField(fn: (x: number, y: number) => number): Float32Array {
  const GW = W / 2;
  const GH = H / 2 + 1;
  const grid = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) grid[gy * GW + gx] = fn(gx * 2, gy * 2);
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const gy = y >> 1;
    const fy = (y & 1) * 0.5;
    const r0 = gy * GW;
    const r1 = Math.min(GH - 1, gy + 1) * GW;
    for (let x = 0; x < W; x++) {
      const gx = x >> 1;
      const gx1 = gx + 1 === GW ? 0 : gx + 1;
      const fx = (x & 1) * 0.5;
      const a = grid[r0 + gx] + (grid[r0 + gx1] - grid[r0 + gx]) * fx;
      const b = grid[r1 + gx] + (grid[r1 + gx1] - grid[r1 + gx]) * fx;
      out[y * W + x] = a + (b - a) * fy;
    }
  }
  return out;
}

function field() {
  if (!FIELD)
    FIELD = {
      g: halfField((x, y) => fbm(x, y, 44, 301, W, 2) * 0.8 + pnoise(x, y, 9, 304, W) * 0.2),
      lump: halfField((x, y) => pnoise(x, y, 7, 308, W) - 0.5),
      vein: halfField((x, y) => Math.abs(pnoise(x, y, 8, 310, W) - 0.5)),
    };
  return FIELD;
}

export function overgrow(R: Relief, s: RotSpec) {
  const z = s.z ?? 6;
  const F = field();
  const off = Math.floor(hash2(s.seed, 1, 2) * W);
  const flip = s.seed & 1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const m = R.mat[i];
      if (!m || m === M.GLASS || m === M.LIT || m === M.IRON) continue;
      const fx = (flip ? W - 1 - x : x) + off;
      const j = y * W + (fx >= W ? fx - W : fx);
      const g = F.g[j] + s.bias(x, y, m);
      if (g > 0.6) {
        const k = Math.min(1, (g - 0.6) / 0.22);
        const lump = F.lump[j];
        R.hgt[i] += 16 * Math.pow(k, 0.6) + lump * 8 * Math.min(1, k * 3);
        R.mat[i] = k < 0.08 ? M.BLOOD : F.vein[j] < 0.028 && k > 0.2 ? M.SINEW : M.FLESH;
        R.tex[i] = lump * 0.3 + (lump < -0.3 ? -0.25 : 0);
        if (k > 0.5 && hash2(x >> 1, y >> 1, s.seed) > 0.992) R.mat[i] = M.BONE;
      } else if (g > 0.53) R.tex[i] -= (0.2 * (g - 0.53)) / 0.07;
    }
  for (const [ax, ay, bx, by, sag, r] of s.sinews ?? []) catenary(R, ax, ay, bx, by, sag, r, z + 4);
  for (const [x, y, len] of s.drips ?? []) {
    const base = R.hgt[wrapX(Math.round(x)) + Math.max(0, Math.min(H - 1, Math.round(y))) * W];
    const hz = (base > EMPTY / 2 ? base : z) + 1.5;
    R.tube(x, y, x, y + len, 0.9, hz, M.BLOOD, 0, true);
    R.tube(x, y + len, x, y + len + 1, 1.6, hz, M.BLOOD, 0, true);
  }
  for (const [ex, ey, er] of s.eyes ?? []) {
    R.box(ex - er - 2, ey - er - 2, ex + er + 2, ey + er + 2, (x, y, i) => {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      const d = Math.sqrt(dx * dx + dy * dy);
      const base = R.hgt[i] > EMPTY / 2 ? R.hgt[i] : z;
      if (d > er + 1.6) return;
      if (d > er) {
        R.put(i, base + 1.5, M.FLESH, -0.15);
        return;
      }
      const sh = Math.sqrt(er * er - d * d);
      const di = Math.sqrt((dx + er * 0.15) ** 2 + dy * dy);
      const mm = di < er * 0.25 ? M.DEEP : di < er * 0.58 ? M.IRIS : M.BONE;
      R.put(i, base + 2 + sh, mm, mm === M.BONE ? (d > er * 0.8 ? -0.2 : 0.05) : 0);
    });
  }
}

function shadeT(L: TLayer, t: Look): PixelCanvas {
  const pc = L.R.shade({ mats: t.mats, keyC: t.key, key: t.keyDir, ambC: t.amb, lights: L.lights(t), glows: L.glows(t), tint: 0.75, ...L.opts(t) });
  L.post?.(pc, t);
  return pc;
}

// --- Shared shape helpers ---------------------------------------------------------

/** Round arch of radiating voussoirs. 0 outside, 1 band (hit filled), 2 opening. */
export function vous(x: number, y: number, cx: number, ys: number, r: number, B: number, nV: number, base: number, moss = 0): number {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - ys;
  if (dy >= 0) return Math.abs(dx) < r ? 2 : 0;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < r) return 2;
  if (d >= r + B) return 0;
  const a = Math.atan2(-dy, dx) / Math.PI;
  const key = Math.abs(a - 0.5) < 0.5 / nV;
  const f = a * nV + 0.5;
  const u = f - Math.floor(f);
  const arc = (Math.PI * (r + B * 0.5)) / nV;
  const ju = Math.min(u, 1 - u) * arc;
  const rr = d - r;
  if (ju < 0.8 || rr < 0.7 || rr > B - 0.8) {
    hit.h = base - 1;
    hit.m = M.DEEP;
    hit.t = 0;
    return 1;
  }
  const e = Math.min(ju, rr, B - rr);
  const vi = Math.floor(f);
  hit.h = base + Math.min(1.5, e * 0.6) + (key ? 1.2 : 0) + (hash2(vi, 3, 9) - 0.5) * 0.8;
  hit.m = moss > 0 && rr > B * 0.55 && pnoise(x, y, 5, vi, W) < moss * (0.5 + a * 0) ? X.MOSS : M.TRIM;
  hit.t = (hash2(vi, 7, 3) - 0.5) * 0.22 + (key ? 0.08 : 0) + (pnoise(x, y, 3, 2, W) - 0.5) * 0.1;
  return 1;
}

/** Tapered icicles hanging from `top(x)` across x0..x1. */
export function icicles(R: Relief, x0: number, x1: number, top: (x: number) => number, z: number, seed: number, dens: number, maxLen: number, minLen = 2) {
  for (let x = Math.floor(x0); x <= x1; x++) {
    const hsh = hash2(x, seed, 11);
    if (hsh > dens) continue;
    const q = hash2(x, seed, 12);
    const len = minLen + q * q * (maxLen - minLen);
    const w = Math.min(2.6, 0.7 + len * 0.07);
    const tp = top(x);
    if (tp < 0) continue;
    const y0 = Math.floor(tp) - 1;
    const cx = x + 0.5 + (hash2(x, seed, 13) - 0.5);
    R.box(cx - w - 1, y0, cx + w + 1, y0 + len + 3, (xx, yy, i) => {
      const k = (yy - y0) / len;
      const dx = xx + 0.5 - cx;
      if (k <= 1) {
        const half = w * Math.pow(1 - k, 0.9) + 0.2;
        if (Math.abs(dx) > half) return;
        R.put(i, z + 1 + Math.sqrt(Math.max(0, 1 - (dx / (half + 0.3)) ** 2)) * w * 0.9, X.ICE, k > 0.8 ? 0.12 : Math.abs(dx) < 0.6 ? 0.08 : -0.04);
      } else if (len > 12 && hash2(x, seed, 14) < 0.25 && Math.abs(dx) < 0.5 && yy === Math.floor(y0 + len + 2)) {
        R.put(i, z + 1, X.ICE, 0.2); // a falling drop
      }
    });
  }
}

/** Round-topped wall niche (recess) with a sill; returns flame positions of its candles. */
export function niche(R: Relief, cx: number, top: number, w: number, h: number, z: number, nCandles: number, seed: number, mat: number = M.TRIM): [number, number][] {
  const xl = cx - w / 2;
  const xr = cx + w / 2;
  const ys = top + w / 2;
  const bot = top + h;
  R.box(xl - 2, top - 2, xr + 2, bot + 3, (x, y, i) => {
    const xx = x + 0.5;
    const yy = y + 0.5;
    if (y >= bot && y < bot + 3) {
      // projecting sill
      R.put(i, z + 2.5 - (y === bot + 2 ? 1 : 0), mat, y === bot ? 0.12 : 0);
      return;
    }
    if (inRound(xx, yy, xl, xr, ys) && y < bot) {
      const back = inRound(xx, yy, xl + 1.5, xr - 1.5, ys + 1);
      R.put(i, back ? z - 5 : z - 2, back ? M.DEEP : mat, back ? -0.1 : -0.05);
      return;
    }
    if (inRound(xx, yy, xl - 2, xr + 2, ys) && y < bot) R.put(i, z + 1.2, mat, 0.06);
  });
  const flames: [number, number][] = [];
  for (let k = 0; k < nCandles; k++) {
    const fx = Math.round(cx + (k - (nCandles - 1) / 2) * Math.max(3, (w - 4) / Math.max(1, nCandles)));
    const ch = 2 + Math.floor(hash2(k, seed, 5) * Math.min(7, h * 0.35));
    flames.push(candle(R, fx, bot, ch, z - 3, w > 10 ? 2 : 1));
  }
  return flames;
}

/** A wax candle standing on y = base; returns its flame position. */
export function candle(R: Relief, x: number, base: number, hgt: number, z: number, cw = 2): [number, number] {
  const top = base - hgt;
  R.box(x - 1, top - 4, x + cw, base - 1, (xx, yy, i) => {
    const lx = xx - x;
    if (yy >= top) {
      if (lx < 0 || lx >= cw) {
        if (lx === -1 && yy > top + 1 && yy < top + 3 && hash2(x, yy, 3) > 0.5) R.put(i, z + 1, X.WAX, 0.05); // drip
        return;
      }
      R.put(i, z + 1.5 + (lx === 0 ? 0.3 : 0), X.WAX, yy === top ? 0.15 : 0);
      return;
    }
    // flame: 1-2 px wide, 3 tall
    const fy = top - 1 - yy;
    if (cw === 2 ? (fy < 2 && lx >= 0 && lx < 2) || (fy === 2 && lx === 0) : fy < 2 && lx === 0) {
      R.put(i, z + 2, X.FLAME, 0);
      R.emi[i] = fy === 0 ? 0.95 : fy === 1 ? 0.7 : 0.4;
    }
  });
  return [x + cw / 2, top - 2];
}

/** Hexagonal iron cage lantern hanging from (cx, y). Returns its light centre. */
export function cageLantern(R: Relief, cx: number, y: number, s: number, z: number): [number, number] {
  const ring = Math.round(4 * s);
  const cap = Math.round(6 * s);
  const body = Math.round(13 * s);
  const base = Math.round(6 * s);
  const fin = Math.round(4 * s);
  const tot = ring + cap + body + base + fin;
  R.box(cx - 9 * s, y, cx + 9 * s, y + tot, (x, yy, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    let ly = yy - y;
    if (ly < ring) {
      const d = Math.hypot(dx, ly + 0.5 - ring / 2);
      if (d < 1.9 * s && d > 0.9 * s) R.put(i, z + 2, M.IRON, 0.1);
      return;
    }
    ly -= ring;
    if (ly < cap) {
      const k = ly / cap;
      const half = (1 + 6.6 * k) * s + (ly === cap - 1 ? s : 0);
      if (ax > half) return;
      const nx = dx / half;
      R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * 3 * s + 1, M.IRON, ly === cap - 1 ? 0.12 : Math.abs(nx) < 0.15 ? 0.1 : 0);
      return;
    }
    ly -= cap;
    if (ly < body) {
      const k = ly / body;
      const half = 6.2 * s;
      if (ax > half) return;
      const nx = dx / half;
      const bar = ax > half - 1 || Math.abs(Math.abs(nx) - 0.42) < 0.11 || ly < 1 || ly >= body - 1 || Math.abs(k - 0.5) < 0.03;
      if (bar) {
        R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * 3 * s + 1.5, M.IRON, 0);
        return;
      }
      R.put(i, z + 2, M.GLASS, 0);
      const core = ax < 1.4 * s && k > 0.3 && k < 0.75;
      R.emi[i] = core ? 0.98 : 0.42 + 0.32 * (1 - Math.abs(nx)) - Math.abs(k - 0.55) * 0.3;
      return;
    }
    ly -= body;
    if (ly < base) {
      const k = ly / base;
      const half = (6.4 * (1 - k) + 0.8) * s;
      if (ax > half) return;
      const nx = dx / half;
      R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * 2.5 * s + 1, M.IRON, ly === 0 ? 0.12 : -0.04);
      return;
    }
    ly -= base;
    if (ax < (ly === Math.floor(fin / 2) ? 1.5 : 0.7) * s) R.put(i, z + 1.5, M.IRON, 0.05);
  });
  return [cx, y + ring + cap + body * 0.55];
}

/** Ellipsoid lump (heads, skulls, statue parts). */
export function blob(R: Relief, cx: number, cy: number, rx: number, ry: number, z: number, depth: number, m: number, t = 0) {
  R.box(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y, i) => {
    const nx = (x + 0.5 - cx) / rx;
    const ny = (y + 0.5 - cy) / ry;
    const d = nx * nx + ny * ny;
    if (d > 1) return;
    R.raise(i, z + Math.sqrt(1 - d) * depth, m, t);
  });
}

/** Side-on skull, ~6s px wide. */
export function skull(R: Relief, cx: number, cy: number, s: number, z: number) {
  blob(R, cx, cy, 3.2 * s, 2.8 * s, z, 3 * s, M.BONE, 0.02);
  blob(R, cx + 0.2 * s, cy + 2.6 * s, 2.2 * s, 1.4 * s, z, 2 * s, M.BONE, -0.04);
  R.box(cx - 3 * s, cy - 1, cx + 3 * s, cy + 4 * s, (x, y, i) => {
    const lx = x + 0.5 - cx;
    const ly = y + 0.5 - cy;
    const eye = Math.hypot(Math.abs(lx) - 1.3 * s, ly - 0.7 * s) < 0.85 * s;
    const nose = Math.abs(lx) < 0.5 * s + 0.2 && ly > 1.6 * s && ly < 2.4 * s;
    const teeth = ly > 2.9 * s && ly < 3.3 * s + 0.3 && Math.abs(lx) < 1.6 * s && (Math.floor(lx + 10) & 1) === 0;
    if (eye || nose || teeth) R.put(i, z + 0.5, M.DEEP, 0);
  });
}

/** Chunky rubble mound with a sin profile; blocks with dark joints. */
export function rubble(R: Relief, x0: number, x1: number, yBase: number, hMax: number, z: number, seed: number, m: number = M.WALL) {
  R.box(x0, yBase - hMax - 4, x1, yBase, (x, y, i) => {
    const k = (x + 0.5 - x0) / (x1 - x0);
    const n = fbm(x, 0, 14, seed, W, 2);
    const top = yBase - hMax * Math.pow(Math.sin(k * Math.PI), 0.7) * (0.55 + 0.6 * n);
    if (y < top) return;
    const hh = ashlar(x + seed * 7, y, 9 + Math.floor(hash2(Math.floor(y / 6), seed, 1) * 6), 6, seed);
    const ty = hit.t;
    R.raise(i, z + 4 + hh * 2.5 + n * 3 - (y - top) * 0.05, hash2(Math.floor((x + seed * 7) / 9), Math.floor(y / 6), seed + 3) > 0.8 ? M.TRIM : m, ty + (y < top + 1.5 ? 0.12 : 0));
  });
}

/** Stone sarcophagus seen from the side. */
export function sarcophagus(R: Relief, x0: number, x1: number, yTop: number, yBot: number, z: number) {
  const lid = 6;
  R.box(x0 - 3, yTop, x1 + 3, yBot, (x, y, i) => {
    const ly = y - yTop;
    if (ly < lid) {
      const inset = (lid - ly) * 0.6;
      if (x < x0 - 2 + inset || x > x1 + 2 - inset) return;
      R.put(i, z + 4 - (ly === lid - 1 ? 1 : 0) + (ly < 2 ? -0.5 : 0), M.TRIM, ly === 0 ? 0.12 : 0);
      return;
    }
    if (y >= yBot - 3) {
      if (x < x0 - 2 || x > x1 + 2) return;
      R.put(i, z + 3, M.TRIM, y === yBot - 3 ? 0.1 : -0.05);
      return;
    }
    if (x < x0 || x > x1) return;
    const px = x - x0;
    const pw = x1 - x0;
    const inPanel = px > 4 && px < pw - 4 && ly > lid + 3 && y < yBot - 6;
    const cxp = pw / 2;
    const cross = (Math.abs(px - cxp) < 1.5 && ly > lid + 4 && y < yBot - 7) || (Math.abs(ly - lid - 8) < 1.2 && Math.abs(px - cxp) < 5);
    if (inPanel) R.put(i, z + (cross ? 2.6 : 1.2), M.TRIM, cross ? 0.08 : -0.08);
    else R.put(i, z + 2.6 - (px < 1 || px > pw - 1 ? 0.8 : 0), M.TRIM, 0);
  });
}

/** Wet drip streaks: darken stone along vertical streaks and add icy glints. */
export function streaks(R: Relief, x0: number, x1: number, y0: number, y1: number, seed: number, mats: number[]) {
  R.box(x0, y0, x1, y1, (x, y, i) => {
    if (!mats.includes(R.mat[i])) return;
    const s = pnoise(x, y * 0.06, 2.2, seed, W);
    if (s > 0.68 && pnoise(x, y, 40, seed + 1, W) > 0.35) {
      R.tex[i] -= 0.14 * Math.min(1, (s - 0.68) * 8);
    }
  });
}

// --- Post passes -------------------------------------------------------------------

let MIST: Float32Array | null = null;
const MIST_Y = 200;

/** Low wisps of mist; on empty pixels (fill) it lays translucent mist down. The noise is computed once and shared. */
export function mist(pc: PixelCanvas, y0: number, y1: number, c: RGB, k: number, seed: number, fill = false) {
  if (!MIST) MIST = halfField((x, y) => (y < MIST_Y - 2 ? 0 : fbm(x + y * 0.4, y * 3, 70, 5, W, 3)));
  const d = pc.data;
  const off = Math.floor(hash2(seed, 5, 5) * W);
  for (let y = Math.max(MIST_Y, y0); y < Math.min(H, y1 + 40); y++) {
    const f = smooth(y0, y1, y) * k;
    if (f <= 0) continue;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const xo = x + off;
      const n = MIST[row + (xo >= W ? xo - W : xo)];
      let a = f * (0.25 + 1.1 * n * n);
      a = Math.round((a + (bayer(x, y) - 0.5) * 0.1) * 8) / 8;
      if (a <= 0) continue;
      if (a > 0.9) a = 0.9;
      const p = (row + x) * 4;
      if (d[p + 3] === 0) {
        if (!fill) continue;
        d[p] = c[0];
        d[p + 1] = c[1];
        d[p + 2] = c[2];
        d[p + 3] = a * 200;
        continue;
      }
      d[p] += (c[0] - d[p]) * a;
      d[p + 1] += (c[1] - d[p + 1]) * a;
      d[p + 2] += (c[2] - d[p + 2]) * a;
    }
  }
}

function plotA(pc: PixelCanvas, x: number, y: number, c: RGB, a: number, mask: Uint8Array) {
  const xi = wrapX(Math.round(x));
  const yi = Math.round(y);
  if (yi < 0 || yi >= H) return;
  const j = yi * W + xi;
  if (mask[j]) return;
  mask[j] = 1;
  WEB_HIT.push(j);
  const d = pc.data;
  const p = j * 4;
  const a0 = d[p + 3] / 255;
  if (a0 === 0) {
    d[p] = c[0];
    d[p + 1] = c[1];
    d[p + 2] = c[2];
    d[p + 3] = a * 255;
    return;
  }
  d[p] += (c[0] - d[p]) * a;
  d[p + 1] += (c[1] - d[p + 1]) * a;
  d[p + 2] += (c[2] - d[p + 2]) * a;
  d[p + 3] = Math.max(d[p + 3], a * 255);
}

function lineA(pc: PixelCanvas, ax: number, ay: number, bx: number, by: number, sag: number, c: RGB, a: number, mask: Uint8Array) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 1.2) + 1;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const s = Math.sin(t * Math.PI) * sag;
    plotA(pc, ax + (bx - ax) * t, ay + (by - ay) * t + s, c, a, mask);
  }
}

/** Corner cobweb anchored at (ax, ay), opening towards (sx, sy) = (+-1, +-1). */
const WEB_MASK = new Uint8Array(W * H);
const WEB_HIT: number[] = [];

export function cobweb(pc: PixelCanvas, ax: number, ay: number, sx: number, sy: number, size: number, c: RGB, a: number, seed: number) {
  const mask = WEB_MASK;
  const nR = 5;
  const pts: [number, number][][] = [];
  for (let j = 0; j < nR; j++) {
    const th = (j / (nR - 1)) * Math.PI * 0.5;
    const L = size * (0.75 + 0.35 * hash2(j, seed, 1));
    const ex = ax + sx * Math.cos(th) * L;
    const ey = ay + sy * Math.sin(th) * L;
    lineA(pc, ax, ay, ex, ey, 0, c, a * 0.9, mask);
    const ring: [number, number][] = [];
    for (let r = 1; r <= 4; r++) {
      const f = (r / 4.4) * (0.9 + 0.2 * hash2(j, r, seed));
      ring.push([ax + (ex - ax) * f, ay + (ey - ay) * f]);
    }
    pts.push(ring);
  }
  for (let j = 0; j < nR - 1; j++)
    for (let r = 0; r < 4; r++) {
      const [x0, y0] = pts[j][r];
      const [x1, y1] = pts[j + 1][r];
      // threads sag towards the corner
      lineA(pc, x0, y0, x1, y1, -sy * (1 + r * 0.6) * 0.6, c, a * (0.55 + 0.1 * r), mask);
    }
  // a few loose strands hanging down
  for (let k = 0; k < 2; k++) {
    const [x0, y0] = pts[1 + k * 2][3];
    lineA(pc, x0, y0, x0 + sx * 2, y0 + 6 + hash2(k, seed, 9) * 10, 0, c, a * 0.5, mask);
  }
  for (const j of WEB_HIT) mask[j] = 0;
  WEB_HIT.length = 0;
}

// ============================================================================
// Looks
// ============================================================================

const CRYPT: Look = {
  mats: matTable({
    [M.WALL]: { ramp: ramp(['#04070a', '#0b1216', '#141f24', '#1f2e32', '#2e403f', '#43574f', '#5e7264'], 10) },
    [M.TRIM]: { ramp: ramp(['#060a0b', '#121b1c', '#22302e', '#364640', '#536456', '#7a8a70', '#a8b28e'], 10), spec: 0.1 },
    [M.DEEP]: { ramp: ramp(['#010203', '#04080a', '#08100f', '#0e1816'], 6) },
    [M.SHAFT]: { ramp: ramp(['#030506', '#0a1012', '#141e21', '#203032', '#30443f', '#4a5e54', '#66786a'], 9), spec: 0.2 },
    [M.GLASS]: { ramp: ramp(['#3a1606', '#7c3a0e', '#c4701e', '#f0aa48', '#ffe2a0'], 7), emit: true },
    [M.LIT]: { ramp: ramp(['#060c0e', '#0e1e20', '#1a3634', '#2c5650', '#4e8478', '#86bca8'], 8), emit: true },
    [M.WOOD]: { ramp: ramp(['#050404', '#120d0b', '#211813', '#33251b', '#4a3626'], 7) },
    [M.IRON]: { ramp: ramp(['#030405', '#0c0f11', '#191e21', '#2b3236', '#454e52'], 6), spec: 0.45 },
    [M.GOLD]: { ramp: ramp(['#1e1206', '#5a3c12', '#9a7024', '#d4a440', '#fff1a8'], 7), spec: 0.6 },
    [M.BONE]: { ramp: ramp(['#0c0e0c', '#2a2c26', '#4e4e40', '#7c7a62', '#aaa688', '#d8d4b4'], 8), spec: 0.25 },
    [X.ICE]: { ramp: ramp(['#08100f', '#16282a', '#2a4a4c', '#4a7474', '#80aaa4', '#c8e4dc'], 8), spec: 1.1, alb: 1.05 },
    [X.MOSS]: { ramp: ramp(['#050803', '#0e1608', '#1a280e', '#2c3e16', '#465a22', '#68783a'], 8), spec: 0.08 },
    [X.WAX]: { ramp: ramp(['#2a2418', '#5a4e38', '#98886a', '#d0c4a0', '#f4ecd0'], 6), spec: 0.3, alb: 1.3 },
    [X.FLAME]: { ramp: ramp(['#7a2a06', '#e07018', '#ffc050', '#fff8d0'], 5), emit: true },
    ...fleshMats(),
  }),
  lamp: hex('#ffa850'),
  candle: hex('#ffb860'),
  cold: hex('#6ad8c4'),
  amb: hex('#5a8494'),
  key: hex('#a8d8d0'),
  keyDir: [-0.35, -0.8, 0.5],
  fog: hex('#0a1214'),
  haze: hex('#16262a'),
  mist: hex('#5a7c80'),
  web: hex('#a8bcb8'),
};

const CRYPT_ROT: Look = {
  mats: matTable({
    [M.WALL]: { ramp: ramp(['#050203', '#120708', '#200e0e', '#301614', '#44201a', '#5c3024', '#784434'], 10) },
    [M.TRIM]: { ramp: ramp(['#080404', '#1c0e0c', '#341a16', '#52302a', '#7a4c3e', '#a6725a', '#cc9c80'], 10), spec: 0.2 },
    [M.DEEP]: { ramp: ramp(['#020101', '#0a0304', '#140607', '#200a0b'], 6) },
    [M.SHAFT]: { ramp: ramp(['#040202', '#100607', '#1c0c0c', '#2c1414', '#40201c', '#583026'], 9), spec: 0.4 },
    [M.GLASS]: { ramp: ramp(['#3a0206', '#80060e', '#c81a1c', '#ff5a36', '#ffc0a0'], 7), emit: true },
    [M.LIT]: { ramp: ramp(['#0c0304', '#220608', '#3e0c0e', '#661616', '#9a2a20', '#d0603a'], 8), emit: true },
    [M.WOOD]: { ramp: ramp(['#060202', '#1a0a08', '#2e1410', '#46221a', '#603226'], 7) },
    [M.IRON]: { ramp: ramp(['#060303', '#160b0a', '#281614', '#42261e', '#5e3a2c'], 6), spec: 0.45 },
    [M.GOLD]: { ramp: BONE_R, spec: 0.3 },
    [M.BONE]: { ramp: BONE_R, spec: 0.35 },
    [X.ICE]: { ramp: ramp(['#120204', '#3a060c', '#700e16', '#a8201e', '#e05a3a', '#ffb090'], 8), spec: 1.3, alb: 1.2 },
    [X.MOSS]: { ramp: ramp(['#0a0203', '#200608', '#3a0c10', '#58181a', '#7a2a26', '#9a4436'], 8), spec: 0.5 },
    [X.WAX]: { ramp: ramp(['#2a1412', '#5a2e26', '#986050', '#d0a08a', '#f4d4c4'], 6), spec: 0.6, alb: 1.3 },
    [X.FLAME]: { ramp: ramp(['#5a0a04', '#c02010', '#ff6a30', '#ffd8b0'], 5), emit: true },
    ...fleshMats(),
  }),
  lamp: hex('#ff6040'),
  candle: hex('#ff7a4a'),
  cold: hex('#d03a30'),
  amb: hex('#7a4a52'),
  key: hex('#d89090'),
  keyDir: [-0.35, -0.8, 0.5],
  fog: hex('#160606'),
  haze: hex('#2a0e10'),
  mist: hex('#6a2a2c'),
  web: hex('#c88a80'),
};

const noFlame = (m: number) => (m === X.FLAME || m === X.WAX ? -9 : 0);

// ============================================================================
// FAR: a long catacomb gallery — barrel vault, arcade of round arches into
// darkness, loculi in the piers, mist on the floor
// ============================================================================

function cryptFar(): TLayer {
  const R = new Relief(W, H);
  const P = 160;
  const CX = 80;
  const YS = 160;
  const RA = 50;
  const B = 11;
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const u = wrapX(x) % P;
    const pu = u < P / 2 ? u : u - P; // -80..80 around the pier
    if (y < 34) {
      // barrel vault soffit with transverse ribs over the piers
      if (Math.abs(pu + 0.5) < 8) {
        R.put(i, -2 - (Math.abs(pu + 0.5) > 6.5 ? 1 : 0), M.TRIM, -0.1 - (34 - y) * 0.006);
        return;
      }
      const hh = ashlar(x, y, 20, 8, 3);
      R.put(i, -5 + hh * 0.6, M.WALL, hit.t - 0.12 - (34 - y) * 0.008);
      return;
    }
    if (y < 40) {
      R.put(i, -1 + (y === 34 ? 0.6 : 0) - (y === 39 ? 0.8 : 0), M.TRIM, y === 34 ? 0.1 : 0);
      return;
    }
    if (y >= 302) {
      if (y < 306) R.put(i, 1.5 - (y === 305 ? 0.6 : 0), M.TRIM, y === 302 ? 0.12 : 0);
      else R.put(i, ashlar(x, y, 32, 10, 9) * 0.4 - 1, M.WALL, hit.t - 0.12);
      return;
    }
    // impost blocks at the springing line
    const adx = Math.abs(u + 0.5 - CX);
    if (y >= YS - 5 && y < YS && adx > RA - 2 && adx < RA + B + 3) {
      R.put(i, 2 - (y === YS - 1 ? 0.8 : 0), M.TRIM, y === YS - 5 ? 0.12 : 0);
      return;
    }
    const res = vous(u, y, CX, YS, RA, B, 13, 0, 0.3);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 2) {
      // a second, receding arch deeper in the dark
      const r2 = vous(u, y, CX, YS + 18, RA - 16, 7, 9, -16);
      if (r2 === 1) R.put(i, hit.h, hit.m, hit.t - 0.1);
      else if (r2 === 2) {
        R.put(i, -40, M.LIT, 0);
        R.emi[i] = 0.04 + 0.32 * smooth(YS - 20, 300, y) * Math.max(0, 1 - Math.abs(u + 0.5 - CX) / 40) + (hash2(u, y, 4) - 0.5) * 0.03;
      } else R.put(i, -12 + ashlar(x, y, 16, 7, 21) * 0.5, M.WALL, hit.t - 0.18);
      return;
    }
    // wall and piers
    const hh = ashlar(x, y, 20, 9, 7);
    R.put(i, hh * 0.6, M.WALL, hit.t + (y > 270 ? -0.06 : 0));
  });
  // loculi stacked in each pier, a few with candles
  const flames: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const px = k * P;
    flames.push(...niche(R, px, 74, 12, 18, 0, k & 1 ? 0 : 1, k * 3 + 1));
    flames.push(...niche(R, px, 182, 14, 22, 0, k === 2 ? 0 : 2, k * 3 + 2));
    flames.push(...niche(R, px, 234, 14, 22, 0, k === 1 ? 2 : 1, k * 3 + 3));
  }
  for (let k = 0; k < 4; k++) {
    const cx = k * P + CX;
    icicles(R, cx - RA + 3, cx + RA - 3, (x) => YS - Math.sqrt(Math.max(0, RA * RA - (x + 0.5 - cx) ** 2)), 1, 30 + k, 0.22, 10);
  }
  icicles(R, 0, W - 1, () => 40, 1, 7, 0.12, 7);
  return {
    R,
    lights: (t) => [
      ...[0, 1, 2, 3].map((k) => ({ x: k * P + CX, y: 270, z: -10, r: 110, c: t.cold, k: 0.45 })),
      { x: 120, y: -60, z: 60, r: 300, c: t.cold, k: 0.2 },
    ],
    glows: (t) => [
      ...[0, 1, 2, 3].map((k) => ({ x: k * P + CX, y: 285, r: 50, c: t.cold, k: 0.08 })),
      ...flames.map(([x, y]) => ({ x, y, r: 9, c: t.candle, k: 0.4 })),
    ],
    opts: (t) => ({
      amb: 0.3,
      keyK: 0.3,
      fogC: t.haze,
      fog: (y) => 0.38 + 0.14 * smooth(150, 320, y),
      ao: 0.06,
    }),
    rot: {
      seed: 211,
      bias: (x, y, m) => -0.22 + 0.24 * smooth(60, 10, y) + 0.2 * smooth(260, 310, y) + (m === M.TRIM ? 0.04 : 0) + (m === M.LIT ? -9 : 0) + noFlame(m),
      sinews: [0, 1, 2, 3].map((k) => [k * P + CX - RA + 2, YS - 6, k * P + CX + RA - 2, YS - 6, 22, 1] as [number, number, number, number, number, number]),
      drips: [0, 1, 2, 3].flatMap((k) => [
        [k * P + 30, 40, 18],
        [k * P + 120, 40, 30],
      ] as [number, number, number][]),
      z: 2,
    },
    post: (pc, t) => {
      shafts(pc, [[60, 0.3, 9, 0.05], [350, 0.35, 12, 0.05]], t.cold, 40, 300, 13);
      mist(pc, 240, 330, t.mist, 0.45, 5);
    },
  };
}

// ============================================================================
// MID: great round arches on heavy pilastered piers; ossuary parapet and
// sarcophagus, candle niches, iron lanterns, icicles, cobwebs
// ============================================================================

const MP = 320;
const MCX = 160;
const MYS = 176;
const MRA = 100;
const MB = 20;
const PARA = 254;

function cryptMid(): TLayer {
  const R = new Relief(W, H);
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const b = Math.floor(wrapX(x) / MP);
    const u = wrapX(x) - b * MP;
    const pu = u < MCX ? u : u - MP; // -160..160 around the pier at u = 0
    const apu = Math.abs(pu + 0.5);
    if (y < 10) {
      R.put(i, -2 + ashlar(x, y, 32, 10, 2) * 0.5, M.WALL, hit.t - 0.2);
      return;
    }
    if (y < 17) {
      R.put(i, 2.5 - (y === 16 ? 1 : 0) + (y === 10 ? -0.5 : 0), M.TRIM, y === 11 ? 0.12 : 0);
      return;
    }
    if (y >= 300) {
      if (y < 305) R.put(i, 4 - (y === 304 ? 0.8 : 0), M.TRIM, y === 300 ? 0.14 : 0);
      else R.put(i, ashlar(x, y, 40, 12, 12) * 0.6, M.WALL, hit.t - 0.1);
      return;
    }
    // pier pilaster: a flat projecting face with chamfers, impost band and base
    if (apu < 30) {
      if (y >= MYS - 9 && y < MYS - 1) {
        R.put(i, 9 - (y === MYS - 2 ? 1 : 0) - (apu > 28.5 ? 0.8 : 0), M.TRIM, y === MYS - 9 ? 0.14 : 0);
        return;
      }
      if (y >= 284) {
        R.put(i, 8 - (y === 284 ? 0.6 : 0) - (apu > 28.5 ? 0.8 : 0), M.TRIM, y === 284 ? 0.12 : -0.04);
        return;
      }
      if (apu < 24) {
        const ch = apu > 22 ? (24 - apu) * 0.8 : 1.6;
        R.put(i, 5 + ch + ashlar(x, y, 40, 14, 31) * 0.3, M.SHAFT, hit.t * 0.6);
        return;
      }
    }
    const res = vous(u, y, MCX, MYS, MRA, MB, 25, 4, 0.35);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 0) {
      const hh = ashlar(x, y, 32, 12, 5);
      R.put(i, hh * 0.8 + 2, M.WALL, hit.t + (y < 40 ? -0.1 : 0));
      return;
    }
    // inside the opening
    const du = u + 0.5 - MCX;
    if (y < PARA) {
      // a jamb return just inside the arch
      if (Math.abs(du) > MRA - 4 && y > MYS - 2) R.put(i, 1 - (Math.abs(du) > MRA - 1 ? 0 : 0.8), M.TRIM, -0.1);
      return; // open to the far gallery
    }
    if (y < PARA + 5) {
      R.put(i, 3 - (y === PARA + 4 ? 1 : 0), M.TRIM, y === PARA ? 0.14 : 0);
      return;
    }
    if (y >= 292) {
      R.put(i, 2, M.TRIM, -0.04);
      return;
    }
    if (b === 0) {
      // ossuary: rows of skulls with a course of long bones
      const ly = y - PARA - 5;
      if (ly >= 12 && ly < 16) {
        const bu = (u + 2) % 22;
        const knob = bu < 3 || bu > 18;
        R.put(i, knob ? 2.5 : 1.8 - Math.abs(ly - 13.5) * 0.4, M.BONE, ly === 12 ? 0.05 : -0.05);
        return;
      }
      const row = ly < 12 ? 0 : 1;
      const ry = ly < 12 ? ly : ly - 16;
      const cu = (u + (row ? 4 : 0)) % 8;
      const nx = (cu + 0.5 - 4) / 3.4;
      const ny = (ry + 0.5 - 4.5) / 3.6;
      const d = nx * nx + ny * ny;
      if (d < 1) {
        const eye = ry >= 4 && ry <= 5 && (cu === 2 || cu === 5);
        R.put(i, eye ? 0 : 1 + Math.sqrt(1 - d) * 2.2, eye ? M.DEEP : M.BONE, (hash2(Math.floor((u + (row ? 4 : 0)) / 8), row, 5) - 0.5) * 0.2);
      } else R.put(i, -3, M.DEEP, 0);
      return;
    }
    R.put(i, ashlar(x, y, 20, 9, 14) * 0.5, M.WALL, hit.t - 0.08);
  });
  // sarcophagus before the parapet in the second bay
  sarcophagus(R, MP + MCX - 42, MP + MCX + 42, 270, 300, 6);
  // a pair of skulls on the parapet ledge
  skull(R, MCX + 60, PARA - 4, 1, 6);
  skull(R, MP + MCX - 70, PARA - 4, 1, 6);
  // niches in the pilasters
  const flames: [number, number][] = [];
  const nicheLights: [number, number][] = [];
  for (let b = 0; b < 2; b++) {
    const px = b * MP;
    flames.push(...niche(R, px, 196, 22, 34, 7, 3, 40 + b, M.TRIM));
    nicheLights.push([px, 222]);
    niche(R, px, 92, 16, 22, 7, 0, 50 + b, M.TRIM);
    skull(R, px, 109, 1, 4);
  }
  for (let b = 0; b < 2; b++) streaks(R, b * MP - 34, b * MP + 34, 20, 300, 61, [M.SHAFT, M.WALL, M.TRIM]);
  // icicles: intrados, impost bands, cornice
  for (let b = 0; b < 2; b++) {
    const cx = b * MP + MCX;
    icicles(R, cx - MRA + 4, cx + MRA - 4, (x) => MYS - Math.sqrt(Math.max(0, MRA * MRA - (x + 0.5 - cx) ** 2)), 6, 70 + b, 0.3, 20);
    icicles(R, b * MP - 30, b * MP + 30, () => MYS - 1, 10, 80 + b, 0.35, 12);
  }
  icicles(R, 0, W - 1, () => 17, 4, 90, 0.08, 12);
  const lamps: [number, number][] = [];
  for (let b = 0; b < 2; b++) {
    const cx = b * MP + MCX;
    const len = b ? 74 : 104;
    chain(R, cx, 17, 17 + len, 12);
    lamps.push(cageLantern(R, cx, 17 + len, 1.1, 14));
  }
  return {
    R,
    lights: (t) => [
      ...lamps.map(([x, y]) => ({ x, y, z: 30, r: 150, c: t.lamp, k: 0.7 })),
      ...nicheLights.map(([x, y]) => ({ x, y, z: 12, r: 50, c: t.candle, k: 1.1 })),
      ...[0, 1].map((b) => ({ x: b * MP + MCX, y: 230, z: -60, r: 200, c: t.cold, k: 0.35 })),
    ],
    glows: (t) => [...lamps.map(([x, y]) => ({ x, y, r: 30, c: t.lamp, k: 0.35 })), ...flames.map(([x, y]) => ({ x, y, r: 12, c: t.candle, k: 0.3 }))],
    opts: (t) => ({
      amb: 0.2,
      keyK: 0.28,
      fogC: t.fog,
      fog: (y) => 0.22 + 0.12 * smooth(280, 360, y),
      ao: 0.08,
      outline: 0.5,
      outlineC: [4, 6, 8],
    }),
    rot: {
      seed: 233,
      bias: (x, y, m) => {
        const u = wrapX(x) % MP;
        const d = Math.hypot(u - MCX, Math.min(0, y - MYS));
        const band = y < MYS + 10 ? Math.max(0, 1 - Math.abs(d - MRA - 10) / 24) : 0;
        return -0.2 + band * 0.3 + 0.26 * smooth(50, 10, y) + 0.22 * smooth(270, 300, y) + (m === M.BONE ? 0.08 : 0) + (m === X.ICE ? -0.1 : 0) + noFlame(m);
      },
      sinews: [0, 1].flatMap((b) => {
        const ox = b * MP;
        return [
          [ox + MCX - MRA - 4, MYS - 4, ox + MCX + MRA + 4, MYS - 4, 50, 1.6],
          [ox + 26, 120, ox + MCX - 60, 40, 30, 1.2],
        ] as [number, number, number, number, number, number][];
      }),
      drips: [0, 1].flatMap((b) =>
        [0.15, 0.27, 0.42, 0.6, 0.74, 0.86].map((a, k) => {
          const ang = a * Math.PI;
          return [b * MP + MCX + Math.cos(ang) * (MRA + 2), MYS - Math.sin(ang) * (MRA + 2), 12 + hash2(k, b, 3) * 40] as [number, number, number];
        }),
      ),
      eyes: [
        [MP, 150, 5],
        [0, 60, 4],
        [MCX + 130, 40, 3],
        [MP + MCX, 284, 4],
      ],
      z: 8,
    },
    post: (pc, t) => {
      cobweb(pc, MCX - MRA + 1, PARA - 1, 1, -1, 24, t.web, 0.5, 1);
      cobweb(pc, MP + MCX + MRA - 1, PARA - 1, -1, -1, 30, t.web, 0.5, 2);
      cobweb(pc, MCX + 34, 17, 1, 1, 22, t.web, 0.45, 3);
      cobweb(pc, MP + MCX - MRA - 18, 17, -1, 1, 28, t.web, 0.4, 4);
      mist(pc, 250, 340, t.mist, 0.35, 7, true);
    },
  };
}

// ============================================================================
// NEAR: ragged mossy slab ceiling dripping ice, dark heavy pillars, lanterns,
// rubble, skulls and a toppled coffin at the bottom
// ============================================================================

const NPX = [120, 440];
const NPW = 22;

function slabBottom(x: number): number {
  const xx = wrapX(x);
  const bi = Math.floor(xx / 20);
  return 12 + Math.floor(hash2(bi, 0, 71) * 14) + (hash2(bi, 1, 71) > 0.8 ? 8 : 0);
}

function cryptNear(): TLayer {
  const R = new Relief(W, H);
  // the slab lip across the top
  R.box(0, 0, W - 1, 40, (x, y, i) => {
    const bot = slabBottom(x);
    if (y >= bot) return;
    const hh = ashlar(x, y, 20, 9, 72);
    const lowest = y >= bot - 2;
    R.put(i, 16 + hh * 1.4, hash2(x >> 1, y >> 1, 3) > 0.85 && y > 8 ? X.MOSS : M.TRIM, hit.t + (lowest ? 0.22 : 0.08));
  });
  // heavy square pillars
  for (const px of NPX) {
    R.box(px - NPW - 8, 0, px + NPW + 8, H - 1, (x, y, i) => {
      const ax = Math.abs(x + 0.5 - px);
      const capTop = 20;
      if (y >= capTop && y < capTop + 14) {
        const k = (y - capTop) / 14;
        const half = NPW + 7 - k * 5;
        if (ax > half) return;
        R.put(i, 22 + (k < 0.3 ? 1 : 0) - (ax > half - 1 ? 1 : 0), M.TRIM, y === capTop ? 0.12 : k > 0.9 ? -0.1 : 0);
        return;
      }
      if (y >= 312) {
        const half = NPW + 6 - (y < 316 ? 3 : 0);
        if (ax > half) return;
        R.put(i, 22 - (ax > half - 1 ? 1 : 0), M.TRIM, y === 312 ? 0.1 : -0.04);
        return;
      }
      if (y < capTop) {
        if (ax > NPW + 2) return;
        R.put(i, 20, M.TRIM, -0.1);
        return;
      }
      if (ax > NPW) return;
      const ch = ax > NPW - 3 ? (NPW - ax) * 0.7 : 2.1;
      const hh = ashlar(x + px, y, 40, 16, 74 + px);
      R.put(i, 18 + ch + hh * 1.1, y > 290 - pnoise(x, 0, 6, 3, W) * 20 ? X.MOSS : M.SHAFT, hit.t * 0.7);
    });
    icicles(R, px - NPW - 6, px + NPW + 6, () => 34, 22, 100 + px, 0.4, 16);
  }
  for (const px of NPX) streaks(R, px - NPW, px + NPW, 30, 300, 103, [M.SHAFT]);
  // icicles off the slab, and two big ice stalactites
  icicles(R, 0, W - 1, slabBottom, 18, 104, 0.35, 26, 3);
  for (const [sx, len] of [
    [262, 64],
    [574, 46],
  ] as [number, number][]) {
    const top = slabBottom(sx);
    R.box(sx - 8, top - 2, sx + 8, top + len, (x, y, i) => {
      const k = (y - top) / len;
      const wob = Math.sin(y * 0.4 + sx) * 0.8;
      const half = 6 * Math.pow(1 - k, 1.4) + 0.3;
      const dx = x + 0.5 - sx - wob * k;
      if (Math.abs(dx) > half) return;
      const rib = Math.abs(Math.sin(dx * 1.3 + y * 0.05)) < 0.3;
      R.put(i, 20 + Math.sqrt(Math.max(0, 1 - (dx / (half + 0.3)) ** 2)) * 4, X.ICE, rib ? 0.1 : -0.02);
    });
  }
  // lanterns
  const lamps: [number, number][] = [];
  chain(R, 300, 0, 140, 24);
  lamps.push(cageLantern(R, 300, 140, 1.5, 26));
  chain(R, 600, 0, 66, 24);
  lamps.push(cageLantern(R, 600, 66, 1.2, 26));
  // bottom: rubble, skull pile, coffin lid leaning on a pillar, sarcophagus
  rubble(R, 176, 300, H, 44, 16, 3);
  rubble(R, 480, 560, H, 26, 16, 7);
  for (const [sx, sy] of [
    [470, 352],
    [478, 349],
    [486, 353],
    [474, 344],
    [482, 342],
  ] as [number, number][])
    skull(R, sx, sy, 1, 24);
  R.box(140, 290, 190, H - 1, (x, y, i) => {
    // a wooden coffin lid propped at an angle against the left pillar
    const t = (y - 296) / 64;
    const cx = 146 + t * 28;
    const half = 7 + Math.min(t, 1 - t) * 6;
    const dx = x + 0.5 - cx;
    if (y < 296 || Math.abs(dx) > half) return;
    const plank = Math.abs(dx) % 5 < 0.8;
    const band = Math.abs(t - 0.25) < 0.02 || Math.abs(t - 0.7) < 0.02;
    R.put(i, 26 + (band ? 1.2 : 0) - (Math.abs(dx) > half - 1 ? 0.8 : 0), band ? M.IRON : M.WOOD, plank ? -0.15 : (hash2(x, y >> 2, 5) - 0.5) * 0.1);
  });
  sarcophagus(R, 330, 410, 318, 352, 18);
  R.box(320, 352, 420, H - 1, (x, y, i) => R.put(i, 18, M.TRIM, -0.1));
  return {
    R,
    lights: (t) => [
      ...lamps.map(([x, y]) => ({ x, y, z: 46, r: 200, c: t.lamp, k: 0.95 })),
      { x: 280, y: -80, z: 80, r: 360, c: t.cold, k: 0.28 },
      ...NPX.map((px) => ({ x: px + 70, y: 200, z: 10, r: 120, c: t.cold, k: 0.3 })),
    ],
    glows: (t) => lamps.map(([x, y]) => ({ x, y, r: 40, c: t.lamp, k: 0.36 })),
    opts: (t) => ({ amb: 0.16, keyK: 0.24, ao: 0.07, outline: 0.55, outlineC: [3, 5, 6], fogC: t.fog, fog: () => 0.06 }),
    rot: {
      seed: 251,
      bias: (x, y, m) => -0.18 + 0.3 * smooth(50, 0, y) + 0.22 * smooth(300, 340, y) + (m === M.SHAFT ? 0.06 : 0) + (m === M.WOOD ? 0.05 : 0) + noFlame(m),
      sinews: [
        [NPX[0] + NPW, 60, NPX[0] + 150, 22, 40, 2],
        [NPX[1] - NPW, 90, NPX[1] - 110, 26, 46, 1.8],
        [NPX[1] + NPW, 50, NPX[1] + 200, 24, 60, 2.2],
      ],
      drips: [
        [NPX[0] - 10, 34, 50],
        [NPX[0] + 14, 34, 26],
        [NPX[1] + 4, 34, 60],
        [210, 24, 40],
        [380, 22, 30],
        [520, 30, 20],
      ],
      eyes: [
        [NPX[0], 160, 5],
        [NPX[1] + 4, 230, 4],
        [60, 14, 4],
        [250, 336, 4],
      ],
      z: 20,
    },
    post: (pc, t) => {
      cobweb(pc, NPX[0] + NPW + 7, 33, 1, 1, 34, t.web, 0.55, 11);
      cobweb(pc, NPX[1] - NPW - 7, 33, -1, 1, 26, t.web, 0.5, 12);
      cobweb(pc, NPX[1] + NPW + 7, 33, 1, 1, 18, t.web, 0.45, 13);
      mist(pc, 300, 360, t.mist, 0.3, 9);
    },
  };
}

// ============================================================================
// FG: dark ragged ceiling fragments with icicles above, rubble below
// ============================================================================

function cryptFg(): TLayer {
  const R = new Relief(W, H);
  const fragBot = (x: number) => {
    const xx = wrapX(x);
    const inA = xx < 120 || xx > 600;
    const inB = xx > 380 && xx < 470;
    if (!inA && !inB) return -1;
    const k = inA ? Math.sin(((xx + 40) % W) / 160 * Math.PI) : Math.sin(((xx - 380) / 90) * Math.PI);
    return 4 + Math.max(0, k) * 26 + (hash2(xx >> 3, 0, 5) - 0.5) * 8;
  };
  R.box(0, 0, W - 1, 44, (x, y, i) => {
    const b = fragBot(x);
    if (b < 0 || y >= b) return;
    const hh = ashlar(x, y, 16, 8, 120);
    R.put(i, 30 + hh, M.TRIM, hit.t - 0.08);
  });
  icicles(R, 0, W - 1, fragBot, 30, 121, 0.4, 24, 3);
  chain(R, 300, 0, 34, 30);
  rubble(R, 120, 270, H + 6, 30, 26, 11);
  skull(R, 196, H - 26, 1.4, 34);
  R.box(470, 320, 620, H - 1, (x, y, i) => {
    // a broken coffin box, its lid fallen askew
    const lx = x - 480;
    const top = 336 + lx * 0.04;
    if (lx >= 0 && lx < 120 && y >= top) {
      R.put(i, 28 + (y < top + 2 ? 1 : 0), M.WOOD, lx % 12 < 1 ? -0.2 : 0);
      return;
    }
    const t = (x - 470) / 70;
    const ly = 330 - t * 14;
    if (t >= 0 && t <= 1 && y >= ly && y < ly + 5) R.put(i, 31, M.WOOD, y === Math.floor(ly) ? 0.1 : 0);
  });
  return {
    R,
    lights: (t) => [
      { x: 320, y: 200, z: 70, r: 400, c: t.cold, k: 0.15 },
      { x: 300, y: 140, z: 60, r: 220, c: t.lamp, k: 0.14 },
    ],
    glows: () => [],
    opts: () => ({ amb: 0.06, keyK: 0.1, ao: 0.05, outline: 0.7, outlineC: [2, 3, 4] }),
    rot: {
      seed: 271,
      bias: (x, y) => 0.02 + 0.1 * smooth(330, 360, y),
      drips: [
        [40, 20, 30],
        [90, 26, 22],
        [420, 26, 26],
        [620, 10, 18],
      ],
      sinews: [[40, 24, 300, 10, 26, 2.2]],
      z: 30,
    },
  };
}

export function drawCrypt(): { plain: Layers; rot: Layers } {
  return buildPair({ far: cryptFar, mid: cryptMid, near: cryptNear, fg: cryptFg }, CRYPT, CRYPT_ROT);
}
