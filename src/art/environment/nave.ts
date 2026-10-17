import { PixelCanvas, hash2 } from '../pixel';
import { type RGB, fbm, hex, inGothic, pnoise, smooth } from './paint';
import { EMPTY, type Glow, type PLight, type RMat, Relief, type ShadeOpts, ramp } from './relief';
import { snesLayer } from './snes-env';

/**
 * The Under-Nave backdrops (marble = the lie, rot = the truth), modelled on
 * the Andalusian cathedral halls of Blasphemous 2: horseshoe arches whose
 * intrados drip with muqarnas, slender marble columns with carved capitals,
 * star-lattice panels and jali windows, brass lanterns hanging on chains,
 * draped cloth and balustrades.
 *
 * Each layer's geometry is built once as a relief (height + material) and
 * shaded twice: as stone, and, after a flesh overgrowth pass, as rot. The two
 * versions share composition so the sanity crossfade reads as the same hall
 * revealing what it truly is.
 *
 * SNES layout: every layer is 512x224 (the 224 px screen, tileable in x), the
 * architecture drawn at about 0.6 of the old 360 px scale so it keeps its
 * proportion to the ~40 px hero, shaded in flat bands and quantised by
 * snesify (snes-env.ts).
 */

export const W = 512;
export const H = 224;
/** Shading dither for SNES bands (relief default is 0.6). */
export const DITHER = 0;
/** Colours per backdrop layer (then snesify-style quantised, despeckled). */
export const LAYER_COLORS = 16;
/** Relief shading for hand-pixelled bands: flat ramps of a few values, calm texture. */
export const SNES_SHADE = { dither: 0, bands: 5, texK: 0.3 } as const;

// --- Materials ------------------------------------------------------------------
export const M = {
  WALL: 1,
  TRIM: 2,
  DEEP: 3,
  BRASS: 4,
  GLASS: 5,
  CLOTH: 6,
  WOOD: 7,
  GOLD: 8,
  IRON: 9,
  LIT: 10,
  FLESH: 11,
  BLOOD: 12,
  BONE: 13,
  SINEW: 14,
  SHAFT: 15,
  IRIS: 16,
} as const;

type Theme = { mats: (RMat | undefined)[]; rot: boolean; lamp: RGB; door: RGB; amb: RGB; key: RGB; fog: RGB; haze: RGB };

function mats(def: Partial<Record<keyof typeof M, RMat>>): (RMat | undefined)[] {
  const out: (RMat | undefined)[] = [];
  for (const k of Object.keys(def) as (keyof typeof M)[]) out[M[k]] = def[k];
  return out;
}

const FLESH_R = ramp(['#0c0203', '#2a080c', '#521418', '#7e2a26', '#ae5040', '#d88a6c', '#f4c4a4'], 10);
const BLOOD_R = ramp(['#140103', '#3e050c', '#760c18', '#b01a24', '#e84a3a'], 7);
const BONE_R = ramp(['#1a120c', '#4a3824', '#86704c', '#bca274', '#ece0bc'], 8);
const SINEW_R = ramp(['#0a0205', '#22070c', '#3e1016', '#5e2020', '#86402e', '#a8644a'], 7);
const IRIS_R = ramp(['#2a0804', '#7a1c08', '#c85a14', '#f0b040'], 5);

const MARBLE: Theme = {
  rot: false,
  mats: mats({
    WALL: { ramp: ramp(['#08060b', '#1a1520', '#2e2632', '#4a3e46', '#6e5e5e', '#998474'], 10) },
    TRIM: { ramp: ramp(['#0a070b', '#211a22', '#3a2f34', '#5c4c4c', '#8a7466', '#bba184'], 10), spec: 0.08 },
    DEEP: { ramp: ramp(['#030204', '#0c080e', '#181218', '#262026'], 6) },
    SHAFT: { ramp: ramp(['#0a080c', '#241e28', '#43383e', '#6e5e5c', '#a08a7c', '#d8c4b0'], 11), spec: 0.35 },
    BRASS: { ramp: ramp(['#120a04', '#3a2410', '#76501c', '#b4842e', '#e8c060', '#fff0b0'], 8), spec: 0.6 },
    GOLD: { ramp: ramp(['#1e1206', '#5a3c12', '#9a7024', '#d4a440', '#fff1a8'], 7), spec: 0.6 },
    GLASS: { ramp: ramp(['#5a1c06', '#b4500e', '#f09a28', '#ffd468', '#fff8d8'], 7), emit: true },
    LIT: { ramp: ramp(['#2a1e16', '#5e4630', '#9c7c50', '#d2b47c', '#f6e8c4'], 8), emit: true },
    CLOTH: { ramp: ramp(['#080405', '#1e0c0e', '#381618', '#55241f', '#74382a', '#94543c'], 9), spec: 0.12, alb: 1.15 },
    WOOD: { ramp: ramp(['#060404', '#1a0f0b', '#2e1c13', '#48301e', '#664630'], 7) },
    IRON: { ramp: ramp(['#050506', '#141317', '#28252c', '#46424a', '#6a6470'], 6), spec: 0.4 },
    FLESH: { ramp: FLESH_R, spec: 0.9 },
    BLOOD: { ramp: BLOOD_R, spec: 1 },
    BONE: { ramp: BONE_R, spec: 0.3 },
    SINEW: { ramp: SINEW_R, spec: 0.5 },
    IRIS: { ramp: IRIS_R, spec: 0.8 },
  }),
  lamp: hex('#ffae58'),
  door: hex('#f0c890'),
  amb: hex('#7a6c9a'),
  key: hex('#c8b8d8'),
  fog: hex('#17121c'),
  haze: hex('#2a2230'),
};

const ROT: Theme = {
  rot: true,
  mats: mats({
    WALL: { ramp: ramp(['#050203', '#140809', '#24100f', '#381a16', '#52281e', '#704030'], 10) },
    TRIM: { ramp: ramp(['#0a0504', '#241410', '#422a1c', '#68462c', '#967044', '#c4a070'], 10), spec: 0.15 },
    DEEP: { ramp: ramp(['#030101', '#0e0304', '#1a0608', '#280a0c'], 6) },
    SHAFT: { ramp: ramp(['#0a0404', '#2a1210', '#4c2620', '#784436', '#a8705a', '#dcae8e'], 11), spec: 0.45 },
    BRASS: { ramp: ramp(['#100604', '#30180c', '#5e3a1c', '#8a6a3a', '#bca070', '#ece0bc'], 8), spec: 0.4 },
    GOLD: { ramp: BONE_R, spec: 0.3 },
    GLASS: { ramp: ramp(['#3a0206', '#80060e', '#c81a1c', '#ff5a36', '#ffc0a0'], 7), emit: true },
    LIT: { ramp: ramp(['#200204', '#4e080c', '#8a1414', '#cc3a22', '#ff9a6a'], 8), emit: true },
    CLOTH: { ramp: ramp(['#100304', '#3a0c12', '#6a2026', '#9a4840', '#c87a66'], 8), spec: 0.4 },
    WOOD: { ramp: ramp(['#060202', '#1e0a08', '#361610', '#52261a', '#703a26'], 7) },
    IRON: { ramp: ramp(['#060303', '#1a0d0c', '#301a16', '#4e2e24', '#704a36'], 6), spec: 0.4 },
    FLESH: { ramp: FLESH_R, spec: 0.9 },
    BLOOD: { ramp: BLOOD_R, spec: 1 },
    BONE: { ramp: BONE_R, spec: 0.3 },
    SINEW: { ramp: SINEW_R, spec: 0.6 },
    IRIS: { ramp: IRIS_R, spec: 0.8 },
  }),
  lamp: hex('#ff6a40'),
  door: hex('#ff6040'),
  amb: hex('#7a5a6a'),
  key: hex('#d8a0a0'),
  fog: hex('#1e080a'),
  haze: hex('#381214'),
};

// --- Shape helpers --------------------------------------------------------------

const wrapX = (x: number) => ((x % W) + W) % W;
const frac = (v: number) => v - Math.floor(v);

/** Output slot for the pattern helpers (avoids allocation in hot loops). */
export const hit = { h: 0, m: 0, t: 0 };

/** Ashlar masonry: bevelled blocks in running bond. Returns height, sets hit.t. */
export function ashlar(x: number, y: number, bw: number, bh: number, seed: number): number {
  const row = Math.floor(y / bh);
  const off = row & 1 ? bw >> 1 : 0;
  const xx = wrapX(x + off);
  const bx = xx % bw;
  const by = ((y % bh) + bh) % bh;
  const id = Math.floor(xx / bw);
  if (bx < 1 || by < 1) {
    hit.t = -0.12;
    return -1;
  }
  const e = Math.min(bx, bw - 1 - bx, by, bh - 1 - by);
  // tone per block only: chunky, no per-pixel grain
  hit.t = (hash2(id, row, seed) - 0.5) * 0.16;
  return Math.min(1, e * 0.5) * 0.8;
}

/** Eight-point-star lattice ("girih"). 0 field, 1 ridge, 2 centre boss. u,v in cells. */
export function star(u: number, v: number, w = 0.06): number {
  const px = frac(u) - 0.5;
  const py = frac(v) - 0.5;
  const ax = Math.abs(px);
  const ay = Math.abs(py);
  const sq = Math.max(ax, ay);
  const dm = (ax + ay) * 0.7071;
  const a = 0.29;
  const inS = sq < a || dm < a;
  if (inS) {
    if (!(sq < a - w || dm < a - w)) return 1;
    return sq < 0.09 && dm < 0.09 ? 2 : 0;
  }
  if (ax < w * 0.7 || ay < w * 0.7 || Math.abs(ax - ay) < w * 1.1) return 1;
  if (0.5 - sq < w * 0.55) return 1;
  return 0;
}

/**
 * Horseshoe arch whose intrados carries a muqarnas band of `B` px.
 * Returns 0 outside the band, 1 inside the band (hit filled), 2 in the opening.
 * `rr` (distance past the band) is left in hit.t for callers on return 0.
 */
function muqArch(x: number, y: number, cx: number, ys: number, r: number, B: number, cellPx: number, base: number, ky = 1): number {
  const dx = x + 0.5 - cx;
  const dy = (y + 0.5 - ys) * ky;
  let d: number;
  let a: number;
  if (dy < 0) {
    d = Math.sqrt(dx * dx + dy * dy);
    a = Math.atan2(-dy, dx);
  } else {
    d = Math.abs(dx);
    a = dx > 0 ? 0 : Math.PI;
  }
  const rr = d - r;
  if (rr >= B) {
    hit.t = rr - B;
    return 0;
  }
  if (dy >= 0) {
    if (rr < 0) return 2;
    hit.t = rr - B;
    return 0;
  }
  const nC = Math.max(4, Math.round((Math.PI * r) / cellPx));
  const cellArc = (Math.PI * r) / nC;
  const ua = (a / Math.PI) * nC;
  if (rr < 0) {
    // Pendant drops hanging from the cusps of the innermost tier
    const uc = frac(ua);
    const dc = Math.min(uc, 1 - uc) * cellArc;
    const len = Math.min(3.6, B * 0.25 + 0.8);
    const q = rr / len;
    const wdt = Math.min(1.5, cellArc * 0.28) * Math.sqrt(Math.max(0, 1 - q * q * q * q));
    if (rr > -len && dc < wdt) {
      hit.h = base + 4.2 - dc * 0.8;
      hit.m = M.TRIM;
      hit.t = 0.06;
      return 1;
    }
    return 2;
  }
  const tiers = B >= 10 ? 3 : B >= 6 ? 2 : 1;
  const tH = B / tiers;
  const k = Math.min(tiers - 1, Math.floor(rr / tH));
  const v = (rr - k * tH) / tH;
  const u = frac(ua + (k & 1) * 0.5);
  const p = (u - 0.5) * 2;
  if (k === 0 && v < 0.5 * (1 - p * p)) return 2; // lobed edge
  const tz = (tiers - 1 - k) * 1.5;
  if (Math.abs(p) < 0.7 && v > 0.12 && v < 0.9 - 0.4 * p * p) {
    hit.h = base + tz - 2.4 + v * 1.4;
    hit.m = M.WALL;
    hit.t = -0.04;
    // a tiny drop at the head of each niche
    if (k > 0 && Math.abs(p) < 0.16 && v < 0.35) {
      hit.h = base + tz;
      hit.m = M.TRIM;
    }
    return 1;
  }
  hit.h = base + tz + (v > 0.9 ? 0.4 : 0);
  hit.m = M.TRIM;
  hit.t = 0.02;
  return 1;
}

/** Straight muqarnas frieze (a cornice of hanging cells), y0..y0+hgt. */
function muqFrieze(x: number, y: number, y0: number, hgt: number, cell: number, base: number): boolean {
  const v = 1 - (y - y0) / hgt; // 0 at the hanging bottom edge
  const tiers = 2;
  const k = Math.min(tiers - 1, Math.floor(v * tiers));
  const vv = v * tiers - k;
  const u = frac(x / cell + k * 0.5);
  const p = (u - 0.5) * 2;
  if (k === 0 && vv < 0.4 * (1 - p * p)) return false;
  const tz = (tiers - 1 - k) * 1.4;
  if (Math.abs(p) < 0.68 && vv > 0.14 && vv < 0.88 - 0.4 * p * p) {
    hit.h = base + tz - 2 + vv;
    hit.m = M.WALL;
    hit.t = -0.04;
  } else {
    hit.h = base + tz;
    hit.m = M.TRIM;
    hit.t = 0.02;
  }
  return true;
}

/** A slender column: capital (abacus + carved bell), shaft with astragal, torus base and plinth. */
export function column(R: Relief, cx: number, top: number, bot: number, hw: number, z: number, opt: { shaft?: number; capH?: number } = {}) {
  const capH = opt.capH ?? Math.round(hw * 2.6);
  const baseH = Math.round(hw * 2.2);
  const shaft = opt.shaft ?? M.SHAFT;
  const ab = Math.round(hw * 0.55) + 1;
  R.box(cx - hw * 2, top, cx + hw * 2, bot, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    const ly = y - top;
    let half: number;
    let m: number = M.TRIM;
    let h: number;
    let t = 0;
    if (ly < ab) {
      // abacus block with a bevelled top edge
      half = hw * 1.7;
      if (ax > half) return;
      h = z + hw * 0.9 + (ly === 0 ? -0.6 : 0) - (ax > half - 1 ? 0.8 : 0);
      t = ly === ab - 1 ? -0.15 : 0.05;
    } else if (ly < capH) {
      // bell: tapers to the shaft, carved with leaves and a stalactite fringe
      const k = (ly - ab) / (capH - ab);
      half = hw * (1.55 - 0.45 * k * k);
      if (ax > half) return;
      const nx = dx / half;
      h = z + Math.sqrt(Math.max(0, 1 - nx * nx)) * hw * 0.9;
      const leaf = Math.sin(nx * Math.PI * 2.5 + 0.5) * 0.5 + 0.5;
      const ring = Math.abs(k - 0.3) < 0.08 || k > 0.9;
      if (ring) {
        h += 0.8;
        t = 0.06;
      } else if (k < 0.3) {
        h -= (1 - leaf) * 1.4;
        t = -0.04;
      } else {
        // pendant leaves curling down
        const lv = Math.abs(frac(nx * 2.2 + 0.25) - 0.5) * 2;
        if (lv > 0.55 + (k - 0.3) * 0.6) {
          h -= 1.6;
          t = -0.08;
        }
      }
    } else if (y < bot - baseH) {
      half = hw;
      if (ax > half) return;
      const nx = dx / half;
      m = shaft;
      h = z + Math.sqrt(Math.max(0, 1 - nx * nx)) * hw * 0.8;
      const sy = y - top - capH;
      if (sy < 2) {
        if (ax > hw + 0.4) return;
        h += 0.9;
        m = M.TRIM;
      }
      t = 0;
    } else {
      const k = (y - (bot - baseH)) / baseH;
      if (k < 0.18) half = hw + 0.8;
      else if (k < 0.45) half = hw * 1.35 * Math.sin(((k - 0.18) / 0.27) * Math.PI * 0.5 + 0.6);
      else if (k < 0.6) half = hw * 1.25;
      else half = hw * 1.6;
      if (ax > half) return;
      const nx = dx / half;
      h = z + (k < 0.6 ? Math.sqrt(Math.max(0, 1 - nx * nx)) * hw * 0.9 : hw * 0.9 - (ax > half - 1 ? 0.8 : 0));
      if (Math.abs(k - 0.6) < 0.05) h -= 0.8;
      t = k > 0.6 ? -0.05 : 0.04;
    }
    R.raise(i, h, m, t);
  });
}

/** Chain of alternating links from (x, y0) to (x, y1). */
export function chain(R: Relief, x: number, y0: number, y1: number, z: number) {
  for (let y = y0; y < y1; y += 4) {
    const odd = ((y - y0) >> 2) & 1;
    if (odd) R.tube(x, y, x, y + 4, 0.8, z, M.IRON, 0, true);
    else
      R.box(x - 2, y, x + 2, y + 4, (xx, yy, i) => {
        const nx = (xx + 0.5 - x) / 1.9;
        const ny = (yy + 0.5 - y - 2) / 2.6;
        const d = nx * nx + ny * ny;
        if (d <= 1 && d >= 0.3) R.put(i, z + 1, M.IRON, 0.1);
      });
  }
}

/** Moorish brass lantern, top-centre at (cx, y). Returns the light centre. */
export function lantern(R: Relief, cx: number, y: number, s: number, z: number): [number, number] {
  const fin = Math.round(3 * s);
  const cap = Math.round(5 * s);
  const body = Math.round(13 * s);
  const bot = Math.round(6 * s);
  const tot = fin + cap + body + bot;
  R.box(cx - 8 * s, y, cx + 8 * s, y + tot, (x, yy, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    const ly = yy - y;
    let half: number;
    if (ly < fin) {
      half = ly === fin - 1 ? 1.6 * s : 0.8 * s;
      if (ax > half) return;
      R.put(i, z + 2, M.BRASS, 0.1);
      return;
    }
    if (ly < fin + cap) {
      const k = (ly - fin) / cap;
      half = (1.5 + 5 * Math.sin(k * Math.PI * 0.5)) * s;
      if (ax > half) return;
      const nx = dx / half;
      R.put(i, z + Math.sqrt(1 - nx * nx) * 3 * s, M.BRASS, k > 0.85 ? -0.1 : 0);
      return;
    }
    if (ly < fin + cap + body) {
      const k = (ly - fin - cap) / body;
      half = (6.2 - 2.4 * k) * s;
      if (ax > half) return;
      const nx = dx / half;
      const strut = Math.abs(frac(nx * 1.5 + 0.5) - 0.5) < 0.12 || ax > half - 1 || k < 0.08 || k > 0.92;
      if (strut) {
        R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * 3 * s + 0.5, M.BRASS, 0);
        return;
      }
      // glowing glass, pierced with a small star pattern
      R.put(i, z + 2, M.GLASS, 0);
      R.emi[i] = 0.68 + (1 - Math.abs(nx)) * 0.25 - k * 0.1;
      return;
    }
    const k = (ly - fin - cap - body) / bot;
    half = (3.6 * (1 - k) + 0.6) * s;
    if (ax > half) return;
    const nx = dx / half;
    R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * 2 * s, M.BRASS, -0.05);
  });
  return [cx, y + fin + cap + body * 0.5];
}

/** Hanging curtain tied back to a column: attached along x=xa, spreading `w0` px. */
function curtain(R: Relief, xa: number, dir: 1 | -1, y0: number, yTie: number, yEnd: number, w0: number, z: number, seed: number, k = 0.62) {
  const w4 = 4 * k;
  R.box(Math.min(xa, xa + dir * (w0 + w4)), y0, Math.max(xa, xa + dir * (w0 + w4)), yEnd, (x, y, i) => {
    let wy: number;
    if (y < yTie) {
      const t = (y - y0) / (yTie - y0);
      wy = w0 * Math.pow(1 - t, 1.3) + w4;
    } else {
      const t = (y - yTie) / (yEnd - yTie);
      wy = w4 + (t * 7 - t * t * 5) * k;
    }
    const s = ((x + 0.5 - xa) * dir) / wy;
    if (s < 0 || s > 1) return;
    const t = (y - y0) / (yEnd - y0);
    const nF = y < yTie ? 5 : 3;
    const ph = s * nF + t * 0.8 + hash2(seed, 0, 1);
    const fold = Math.abs(Math.sin(ph * Math.PI)); // sharp creases, round crowns
    let h = z + 2 + fold * 4 + Math.sin(s * Math.PI) * 1.2;
    const tie = y > yTie - 2 && y < yTie + 1.5;
    if (tie) h += 2;
    const hem = s > 0.9 && y < yTie;
    R.raise(i, h, tie ? M.GOLD : M.CLOTH, hem ? 0.12 : fold < 0.25 ? -0.15 : 0);
  });
}

/** A cloth swag sagging between two points. */
function swag(R: Relief, x0: number, x1: number, y: number, sag: number, depth: number, z: number, er = 2) {
  R.box(x0, y - 2, x1, y + sag + depth + 4, (x, yy, i) => {
    const t = (x + 0.5 - x0) / (x1 - x0);
    if (t < 0 || t > 1) return;
    const st = Math.sin(t * Math.PI);
    const top = y + st * sag * 0.45;
    const bot = y + st * sag + depth * (0.35 + 0.65 * st) + Math.sin(t * 30) * 0.6;
    if (yy < top || yy > bot) return;
    const k = (yy - top) / Math.max(1, bot - top);
    // folds run along the sag: several stacked catenary bands
    const fold = Math.abs(Math.sin(k * Math.PI * 2.5));
    R.raise(i, z + 2 + fold * 3 + st * 2, M.CLOTH, yy > bot - 1.5 ? 0.1 : fold < 0.25 ? -0.15 : 0);
  });
  // gathered ends
  for (const ex of [x0, x1]) R.tube(ex, y - 2, ex, y + depth * 0.9, er, z + 3, M.CLOTH, -0.05);
}

/** Turned balusters between rails, a full balustrade y0..y1 across x0..x1. */
export function balustrade(R: Relief, x0: number, x1: number, y0: number, y1: number, period: number, z: number) {
  const rail = Math.max(3, Math.round((y1 - y0) * 0.14));
  const plinth = Math.max(3, Math.round((y1 - y0) * 0.12));
  R.box(x0, y0, x1, y1, (x, y, i) => {
    const ly = y - y0;
    if (ly < rail) {
      R.raise(i, z + 3 + (ly === 0 ? -0.5 : 0) - (ly === rail - 1 ? 0.8 : 0), M.TRIM, ly === 0 ? 0.1 : 0);
      return;
    }
    if (y >= y1 - plinth) {
      R.raise(i, z + 2 - (y === y1 - plinth ? 0.6 : 0), M.TRIM, -0.04);
      return;
    }
    const k = (ly - rail) / (y1 - y0 - rail - plinth);
    const u = (((x + 0.5) % period) + period) % period - period / 2;
    let prof: number;
    if (k < 0.08) prof = 0.34;
    else if (k < 0.13) prof = 0.22;
    else if (k < 0.4) prof = 0.12 + (k - 0.13) * 0.3;
    else if (k < 0.8) prof = 0.2 + 0.15 * Math.sin(((k - 0.4) / 0.4) * Math.PI * 0.85);
    else if (k < 0.87) prof = 0.24;
    else prof = 0.36;
    const half = period * prof;
    if (Math.abs(u) > half) return;
    const nx = u / half;
    const ring = k < 0.08 || (k >= 0.8 && k < 0.87) || k >= 0.87;
    R.raise(i, z + Math.sqrt(1 - nx * nx) * period * 0.22 + (ring ? 0.3 : 0), M.TRIM, (k > 0.06 && k < 0.09) || (k > 0.86 && k < 0.89) ? -0.12 : 0);
  });
}

// --- Rot overgrowth --------------------------------------------------------------

export interface RotSpec {
  seed: number;
  bias: (x: number, y: number, m: number) => number;
  sinews?: [number, number, number, number, number, number][]; // ax, ay, bx, by, sag, radius
  drips?: [number, number, number][];
  eyes?: [number, number, number][];
  /** Height offset for things drawn on top. */
  z?: number;
}

export function catenary(R: Relief, ax: number, ay: number, bx: number, by: number, sag: number, r: number, z: number) {
  const n = Math.max(4, Math.ceil(Math.abs(bx - ax) / 6));
  let px = ax;
  let py = ay;
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t + Math.sin(t * Math.PI) * sag;
    R.tube(px, py, x, y, r * (0.8 + 0.4 * Math.sin(t * Math.PI * 3) ** 2), z, M.SINEW, 0, true);
    px = x;
    py = y;
  }
}

export function rotify(R: Relief, s: RotSpec) {
  const z = s.z ?? 6;
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const m = R.mat[i];
    if (!m || m === M.GLASS || m === M.LIT || m === M.IRON) return;
    const g = fbm(x, y, 28, s.seed, W, 2) * 0.8 + pnoise(x, y, 6, s.seed + 3, W) * 0.2 + s.bias(x, y, m);
    if (g > 0.6) {
      const k = Math.min(1, (g - 0.6) / 0.22);
      const lump = pnoise(x, y, 5, s.seed + 7, W) - 0.5;
      R.hgt[i] += 11 * Math.pow(k, 0.6) + lump * 5 * Math.min(1, k * 3);
      const vein = Math.abs(pnoise(x, y, 5, s.seed + 9, W) - 0.5) < 0.034 && k > 0.2;
      R.mat[i] = k < 0.08 ? M.BLOOD : vein ? M.SINEW : M.FLESH;
      R.tex[i] = lump * 0.3 + (lump < -0.3 ? -0.25 : 0);
      if (k > 0.5 && hash2(x >> 1, y >> 1, s.seed) > 0.992) R.mat[i] = M.BONE; // teeth and bone shards
    } else if (g > 0.53) {
      R.tex[i] -= 0.2 * (g - 0.53) / 0.07; // bruised, wet stain around growth
    }
  });
  for (const [ax, ay, bx, by, sag, r] of s.sinews ?? []) catenary(R, ax, ay, bx, by, sag, r, z + 4);
  for (const [x, y, len] of s.drips ?? []) {
    const base = R.hgt[wrapX(Math.round(x)) + Math.max(0, Math.min(H - 1, Math.round(y))) * W];
    const hz = (base > EMPTY / 2 ? base : z) + 1.5;
    R.tube(x, y, x, y + len, 0.75, hz, M.BLOOD, 0, true);
    R.tube(x, y + len, x, y + len + 1, 1.3, hz, M.BLOOD, 0, true);
  }
  for (const [ex, ey, er] of s.eyes ?? []) {
    R.box(ex - er - 2, ey - er - 2, ex + er + 2, ey + er + 2, (x, y, i) => {
      const dx = x + 0.5 - ex;
      const dy = y + 0.5 - ey;
      const d = Math.sqrt((dx) ** 2 + (dy) ** 2);
      const base = R.hgt[i] > EMPTY / 2 ? R.hgt[i] : z;
      if (d > er + 1.2) return;
      if (d > er) {
        R.put(i, base + 1.5, M.FLESH, -0.15); // puckered lid
        return;
      }
      const sh = Math.sqrt(er * er - d * d);
      const ix = dx + er * 0.15;
      const di = Math.sqrt((ix) ** 2 + (dy) ** 2);
      const m = di < er * 0.25 ? M.DEEP : di < er * 0.58 ? M.IRIS : M.BONE;
      R.put(i, base + 2 + sh, m, m === M.BONE ? (d > er * 0.8 ? -0.2 : 0.05) : 0);
    });
  }
}

// --- Light shafts (post) -------------------------------------------------------------

export function shafts(pc: PixelCanvas, beams: [number, number, number, number][], c: RGB, y0: number, y1: number, seed: number) {
  const d = pc.data;
  for (let y = y0; y < y1; y++) {
    const k = (y - y0) / (y1 - y0);
    const fade = Math.min(1, k * 5) * (1 - k * 0.7);
    for (const [bx, slope, w, a] of beams) {
      const cx = bx + slope * (y - y0);
      const hw = w * (1 + k * 1.5);
      for (let xx = Math.floor(cx - hw); xx <= Math.ceil(cx + hw); xx++) {
        const q = Math.abs(xx + 0.5 - cx) / hw;
        if (q >= 1) continue;
        const x = wrapX(xx);
        const p = (y * W + x) * 4;
        if (d[p + 3] === 0) continue;
        const dust = 0.6 + 0.8 * pnoise(x - y * 0.6, y * 0.3, 7, seed, W);
        const amt = a * (1 - q * q) * (1 - q * q) * fade * dust;
        d[p] = Math.min(255, d[p] + c[0] * amt);
        d[p + 1] = Math.min(255, d[p + 1] + c[1] * amt);
        d[p + 2] = Math.min(255, d[p + 2] + c[2] * amt);
      }
    }
  }
}

// ===========================================================================
// FAR: vast hazy hall — vault coffers, gallery of lobed arches, great arcade
// ===========================================================================

interface Layer {
  R: Relief;
  lights: (t: Theme) => PLight[];
  glows: (t: Theme) => Glow[];
  opts: (t: Theme) => Partial<ShadeOpts>;
  rot: RotSpec;
  post?: (pc: PixelCanvas, t: Theme) => void;
}

/** Gallery bay (13 per layer) and arcade bay (6 per layer). */
const FG_P = W / 13;
const FA_P = W / 6;

function farLayer(): Layer {
  const R = new Relief(W, H);
  const VC = W / 26; // vault coffer cell
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    if (y < 35) {
      // coffered vault
      const cu = wrapX(x) % (VC * 2);
      const cv = (y + 3) % 12;
      const rib = cu < 2 || cv < 2;
      R.put(i, rib ? -3 : -5 - (cu < 4 || cv < 4 ? 0 : 1), rib ? M.TRIM : M.WALL, y < 12 ? -0.2 : 0);
      return;
    }
    if (y < 41) {
      if (y < 37) R.put(i, 2 - (y === 36 ? 1 : 0), M.TRIM, 0.05);
      else R.put(i, (Math.floor(x / 4) & 1) && y < 40 ? 0.5 : 1.2, M.TRIM, y === 37 ? 0.08 : -0.05);
      return;
    }
    if (y < 105) {
      // gallery: lobed horseshoe arches
      const u = wrapX(x) % FG_P;
      const cx = FG_P / 2;
      const res = muqArch(u, y, cx, 70, 13, 4.5, 4.4, 0);
      if (res === 1) R.put(i, hit.h, hit.m, hit.t);
      else if (res === 2) {
        if (inGothic(u, y, cx - 3.2, cx + 3.2, 79, 0.7) && y < 99) {
          R.put(i, -20, M.LIT, 0);
          R.emi[i] = 0.18 + 0.12 * (1 - (y - 70) / 31);
        } else R.put(i, -20, M.DEEP, 0);
      } else {
        const hgt = ashlar(x, y, 16, 7, 4);
        R.put(i, hgt * 0.6, M.WALL, hit.t);
      }
      return;
    }
    if (y < 115) {
      // a pierced balustrade along the gallery floor
      const PB = W / 96;
      const u = wrapX(x) % PB;
      if (y < 107 || y >= 113) R.put(i, 1.5, M.TRIM, y === 105 ? 0.1 : 0);
      else {
        const k = (y - 107) / 6;
        const half = 1 + Math.sin(k * Math.PI) * 0.6;
        if (Math.abs(u - PB / 2) < half) R.put(i, 1, M.TRIM, 0);
        else R.put(i, -12, M.DEEP, 0);
      }
      return;
    }
    if (y < 186) {
      const u = wrapX(x) % FA_P;
      const cx = FA_P / 2;
      const res = muqArch(u, y, cx, 138, 30, 7.5, 5.6, 0);
      if (res === 1) R.put(i, hit.h, hit.m, hit.t);
      else if (res === 2) {
        const glowY = smooth(143, 186, y);
        R.put(i, -30, M.LIT, 0);
        R.emi[i] = 0.06 + glowY * 0.22 * (1 - Math.abs(u - cx) / 31);
        if (inGothic(u, y, cx - 6.2, cx + 6.2, 155, 0.62)) R.emi[i] += 0.12;
      } else {
        const hgt = ashlar(x, y, 16, 9, 6);
        R.put(i, hgt * 0.6, M.WALL, hit.t);
      }
      return;
    }
    if (y < 189) R.put(i, 2, M.TRIM, y === 186 ? 0.15 : 0);
    else R.put(i, ashlar(x, y, 32, 9, 9) * 0.5, M.WALL, hit.t - 0.1);
  });
  // gallery colonnettes and arcade columns
  for (let k = 0; k < 13; k++) column(R, k * FG_P, 64, 105, 1.6, 1);
  for (let k = 0; k < 6; k++) {
    column(R, k * FA_P - 1.5, 129, 186, 2.2, 1);
    column(R, k * FA_P + 3.5, 129, 186, 2.2, 1.5);
  }
  const doors = [0, 1, 2, 3, 4, 5].map((k) => FA_P / 2 + k * FA_P);
  return {
    R,
    lights: (t) => [...doors.map((x) => ({ x, y: 174, z: 6, r: 56, c: t.door, k: 0.35 })), { x: 256, y: -25, z: 26, r: 200, c: t.lamp, k: 0.25 }],
    glows: (t) => doors.map((x) => ({ x, y: 177, r: 36, c: t.door, k: 0.12 })),
    opts: (t) => ({
      amb: 0.26,
      keyK: 0.3,
      fogC: t.haze,
      fog: (y) => 0.42 + 0.22 * smooth(87, 186, y) - 0.12 * smooth(186, 224, y),
      ao: 0.06,
      aoR: 3,
    }),
    rot: {
      seed: 41,
      bias: (x, y, m) => -0.2 + 0.26 * smooth(43, 12, y) + (m === M.TRIM ? 0.04 : 0) + 0.18 * smooth(155, 186, y),
      sinews: [0, 1, 2, 3, 4, 5].flatMap((k) => [
        [k * FA_P + 11, 122, k * FA_P + 74, 122, 17, 0.9] as [number, number, number, number, number, number],
        [k * FA_P + 22, 74, k * FA_P + 48, 74, 9, 0.6] as [number, number, number, number, number, number],
      ]),
      z: 2,
    },
    post: (pc, t) => shafts(pc, [[96, 0.55, 9, 0.07], [240, 0.5, 6, 0.05], [376, 0.6, 10, 0.06]], t.lamp, 37, 205, 3),
  };
}

// ===========================================================================
// MID: ornate arcade — muqarnas arches, columns, lattice, lit doorway, lantern
// ===========================================================================

const BAY = W / 3;
const MCX = BAY / 2;
const MYS = 93;
const MR = 53;
const MB = 11;

function midLayer(): Layer {
  const R = new Relief(W, H);
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const b = Math.floor(x / BAY);
    const u = x - b * BAY;
    const dx = u + 0.5 - MCX;
    const adx = Math.abs(dx);
    if (y < 7) {
      const rib = Math.abs((u % (BAY / 7)) - BAY / 14) < 1;
      R.put(i, rib ? -4 : -7, rib ? M.TRIM : M.WALL, -0.2);
      return;
    }
    if (y < 19) {
      if (y < 9) R.put(i, 2 - (y === 8 ? 0.8 : 0), M.TRIM, y === 7 ? 0.1 : 0);
      else if (y >= 17) R.put(i, 1.5 - (y === 18 ? 0.6 : 0), M.TRIM, 0);
      else if (muqFrieze(u, y, 9, 8, BAY / 28, 0)) R.put(i, hit.h, hit.m, hit.t);
      else R.put(i, -6, M.DEEP, 0);
      return;
    }
    if (y >= 186) {
      if (y < 188) R.put(i, 3 - (y === 187 ? 0.6 : 0), M.TRIM, y === 186 ? 0.15 : 0);
      else if (y < 190) R.put(i, 1, M.TRIM, -0.05);
      else {
        const PP = W / 20;
        const pu = wrapX(x) % PP;
        const inP = pu > 3 && pu < PP - 3 && y > 193 && y < 216;
        const hh = ashlar(x, y, 32, 10, 12) * 0.6;
        if (inP) {
          const edge = pu < 4 || pu > PP - 4 || y < 195 || y > 214;
          R.put(i, edge ? -1 : -2, M.WALL, -0.08);
        } else R.put(i, hh, M.WALL, hit.t - 0.04);
      }
      return;
    }
    const res = muqArch(u, y, MCX, MYS, MR, MB, 5.5, 3);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 0) {
      const past = hit.t; // px beyond the band
      if (y < MYS && past < 2.5) {
        R.put(i, 4.2 - (past > 1.5 ? 1 : 0) + (past < 0.7 ? 0.6 : 0), M.TRIM, past < 0.7 ? 0.08 : 0);
        return;
      }
      // spandrels and the pier between bays
      const px = u < MCX ? u : u - BAY;
      const apx = Math.abs(px);
      if (apx < 9 && y > 36 && y < 179) {
        // tall lattice panel in the pier
        const edge = apx > 7.5 || y < 38 || y > 177;
        if (edge) R.put(i, 1.6, M.TRIM, 0.04);
        else {
          // stacked recessed panels
          const pv = (y - 38) % 23;
          const ridge = pv < 2 || apx < 1.5;
          R.put(i, ridge ? -0.6 : -2.2, ridge ? M.TRIM : M.WALL, ridge ? 0.06 : -0.08);
        }
        return;
      }
      if (apx < 8 && y > 19 && y < 35) {
        const dd = Math.sqrt((px + 0.5) ** 2 + (y + 0.5 - 27) ** 2);
        if (dd < 6.6) {
          const ring = dd > 5.2;
          const ang = Math.atan2(y + 0.5 - 27, px + 0.5);
          const petal = Math.cos(ang * 6) * 0.5 + 0.5;
          R.put(i, ring ? 2 : 0.5 + petal * (1 - dd / 5.2) * 2, M.TRIM, ring ? 0 : -0.04 + petal * 0.08);
          return;
        }
      }
      if (y < MYS) {
        const hh = ashlar(x, y, 16, 8, 3);
        R.put(i, hh * 0.6 - 0.4, M.WALL, hit.t - 0.04);
        return;
      }
      const hh = ashlar(x, y, 16, 10, 5);
      R.put(i, hh * 0.7, M.WALL, hit.t);
      return;
    }
    // --- inside the arch: the alcove ---
    const back = -12;
    if (y < MYS + 2 && !inGothic(u, y, MCX - 35, MCX + 35, 124, 0.62)) {
      // the alcove is a screen wall open to the hall beyond: cornice and stepped merlons
      if (y >= 89) {
        R.put(i, back + 3 - (y === 94 ? 1 : 0) - (y === 91 ? 0.7 : 0), M.TRIM, y === 89 ? 0.12 : 0);
        return;
      }
      const mu = ((((u - MCX) % 8) + 8 + 4) % 8) - 4;
      const am = Math.abs(mu + 0.5);
      const top = am < 1 ? 80 : am < 2 ? 83 : am < 3 ? 86 : 999;
      if (y >= top) R.put(i, back + 2, M.TRIM, y === top ? 0.1 : 0);
      return;
    }
    if (inGothic(u, y, MCX - 12.5, MCX + 12.5, 140, 0.62)) {
      // lit doorway
      const k = smooth(93, 186, y);
      R.put(i, -40, M.LIT, 0);
      R.emi[i] = 0.25 + 0.55 * k * (1 - (adx / 12.5) ** 2) + (hash2(u | 0, y, 3) - 0.5) * 0.04;
      if (y > 177) R.emi[i] += 0.1;
      return;
    }
    if (inGothic(u, y, MCX - 16, MCX + 16, 139, 0.62)) {
      const inner = inGothic(u, y, MCX - 14.4, MCX + 14.4, 139.5, 0.62);
      R.put(i, back + (inner ? 1.5 : 3), M.TRIM, inner ? -0.05 : 0.06);
      return;
    }
    const big = inGothic(u, y, MCX - 35, MCX + 35, 124, 0.62);
    const bigIn = inGothic(u, y, MCX - 32, MCX + 32, 124.6, 0.62);
    if (big && !bigIn) {
      R.put(i, back + 3 - (inGothic(u, y, MCX - 33.5, MCX + 33.5, 124.3, 0.62) ? 1.2 : 0), M.TRIM, 0.05);
      return;
    }
    if (bigIn && y < 181) {
      const st = star((u + 0.5 - MCX) / 14 + 0.5, (y - 43) / 14, 0.13);
      R.put(i, back + (st ? 0.8 : -1), st ? M.TRIM : M.WALL, st === 2 ? 0.12 : st ? 0 : -0.1);
      return;
    }
    if (adx > 38 && adx < 50.5 && y > 131 && y < 186) {
      // side doors: carved frame, studded wooden leaves under a little jali
      const fx = Math.min(adx - 38, 50.5 - adx);
      if (fx < 1.6 || y < 133) {
        R.put(i, back + 2.2 - (fx < 0.8 ? 0.6 : 0), M.TRIM, 0.04);
        return;
      }
      const plank = (adx - 39.6) % 4 < 1;
      const band = Math.abs(y - 150) < 1 || Math.abs(y - 170) < 1;
      R.put(i, back - 1 + (band ? 0.8 : 0), band ? M.GOLD : M.WOOD, plank ? -0.15 : 0);
      return;
    }
    if (adx > 39 && adx < 49.5 && y > 104 && y < 129) {
      if (inGothic(adx, y, 40.5, 48, 113, 0.7)) {
        const mull = Math.abs(adx - 44.25) < 1;
        R.put(i, mull ? back + 0.5 : back - 8, mull ? M.TRIM : M.DEEP, 0);
        return;
      }
      if (inGothic(adx, y, 39, 49.5, 112, 0.7)) {
        R.put(i, back + 1.5, M.TRIM, 0.05);
        return;
      }
    }
    const hh = ashlar(x, y, 16, 7, 7);
    R.put(i, back + hh * 0.8, M.WALL, hit.t - 0.06);
  });
  const lamps: [number, number][] = [];
  for (let b = 0; b < 3; b++) {
    const ox = b * BAY;
    column(R, ox + MCX - MR - 5, MYS - 10, 186, 3.2, 5);
    column(R, ox + MCX + MR + 5, MYS - 10, 186, 3.2, 5);
    if (b === 0) curtain(R, ox + MCX - MR + 1, 1, 32, 126, 162, 24, 2, 1);
    else if (b === 2) curtain(R, ox + MCX + MR - 1, -1, 32, 126, 162, 24, 2, 2);
    const cl = b === 1 ? 64 : 73;
    chain(R, ox + MCX, 19, cl, 12);
    lamps.push(lantern(R, ox + MCX, cl, 0.78, 14));
  }
  return {
    R,
    lights: (t) => [
      ...lamps.map(([x, y]) => ({ x, y, z: 20, r: 110, c: t.lamp, k: 0.62 })),
      ...lamps.map(([x]) => ({ x, y: 166, z: 3, r: 75, c: t.door, k: 0.7 })),
    ],
    glows: (t) => [
      ...lamps.map(([x, y]) => ({ x, y, r: 25, c: t.lamp, k: 0.4 })),
      ...lamps.map(([x]) => ({ x, y: 167, r: 43, c: t.door, k: 0.16 })),
    ],
    opts: (t) => ({
      amb: 0.15,
      keyK: 0.24,
      fogC: t.fog,
      fog: (y) => 0.26 + 0.1 * smooth(186, 224, y),
      ao: 0.08,
      aoR: 3,
    }),
    rot: {
      seed: 77,
      bias: (x, y, m) => {
        const u = wrapX(x) % BAY;
        const d = Math.hypot(u - MCX, Math.min(0, y - MYS));
        const nearBand = y < MYS + 6 ? Math.max(0, 1 - Math.abs(d - MR - 5) / 13) : 0;
        return -0.2 + nearBand * 0.3 + 0.26 * smooth(37, 7, y) + 0.24 * smooth(162, 186, y) + (m === M.TRIM ? 0.04 : 0) + (m === M.SHAFT ? 0.02 : 0);
      },
      sinews: [0, 1, 2].flatMap((b) => {
        const ox = b * BAY;
        return [
          [ox + MCX - MR - 3.5, 90, ox + MCX + MR + 3.5, 90, 28, 1.1],
          [ox + MCX + 13, 40, ox + MCX + MR - 3, 69, 18, 0.8],
          [ox + MCX - MR - 5, 124, ox + MCX - 32, 93, 16, 0.7],
        ] as [number, number, number, number, number, number][];
      }),
      drips: [0, 1, 2].flatMap((b) =>
        [0.12, 0.2, 0.31, 0.4, 0.55, 0.66, 0.8, 0.9].map((a, k) => {
          const ang = a * Math.PI;
          return [b * BAY + MCX + Math.cos(ang) * (MR - 2), MYS - Math.sin(ang) * (MR - 2), 6 + hash2(k, b, 3) * 30] as [number, number, number];
        }),
      ),
      eyes: [
        [0, 107, 4],
        [BAY, 74, 3],
        [BAY - 21, 43, 2.2],
        [21, 56, 2.2],
        [MCX, 46, 2.2],
        [BAY + MCX - 18, 155, 2.2],
        [2 * BAY + MCX + 20, 60, 2.2],
      ],
      z: 8,
    },
    post: (pc, t) => shafts(pc, [[80, 0.35, 6, 0.05], [336, 0.4, 7, 0.05]], t.lamp, 19, 186, 9),
  };
}

// ===========================================================================
// NEAR: heavy columns and arch frames, drapes, hanging lanterns, balustrade
// ===========================================================================

const NBAY = W / 2;
const NC = [64, 64 + NBAY];
const NYS = 62;
const NR = 120;
const NB = 14;

function nearLayer(): Layer {
  const R = new Relief(W, H);
  // Arch frames (spandrels) across the top
  R.box(0, 0, W - 1, NYS + 3, (x, y, i) => {
    const xx = wrapX(x);
    const b = Math.floor(((xx - NC[0] + W) % W) / NBAY);
    const cx = wrapX(NC[0] + NBAY / 2 + b * NBAY);
    let u = xx - cx;
    if (u > W / 2) u -= W;
    if (u < -W / 2) u += W;
    const res = muqArch(u + 300, y, 300, NYS, NR, NB, 7, 10, 2.2);
    if (res === 1) R.put(i, hit.h, hit.m, hit.t);
    else if (res === 0 && y < NYS) {
      const past = hit.t;
      if (past < 3) R.put(i, 14 - (past > 2 ? 1.2 : 0) + (past < 1 ? 0.6 : 0), M.TRIM, past < 1 ? 0.06 : 0);
      else {
        const st = star((u + 0.5) / 24 + 0.5, y / 24 + 0.3, 0.1);
        R.put(i, st ? 10.5 : 9, st ? M.TRIM : M.WALL, st === 2 ? 0.12 : -0.05);
      }
    }
  });
  // Balustrade along the bottom, plinth below
  balustrade(R, 0, W - 1, 181, 212, W / 60, 8);
  R.box(0, 213, W - 1, H - 1, (x, y, i) => {
    const PP = W / 12;
    const pu = wrapX(x) % PP;
    const panel = pu > 3 && pu < PP - 3 && y > 215 && y < 222;
    R.raise(i, panel ? 8 : 9.5 - (y === 213 ? 0.6 : 0), M.WALL, panel ? -0.1 : hash2(x >> 2, y >> 2, 3) * 0.05);
  });
  for (const cx of NC) column(R, cx, NYS - 15, 207, 7.5, 14, { capH: 22 });
  // Drapes and lanterns
  curtain(R, NC[0] + 8, 1, 0, 104, 146, 36, 16, 4);
  swag(R, NC[1] + 10, NC[1] + NBAY - 10, 4, 21, 12, 16);
  curtain(R, NC[1] - 8, -1, 0, 93, 133, 25, 16, 6);
  const lamps: [number, number][] = [];
  chain(R, 196, 0, 90, 22);
  lamps.push(lantern(R, 196, 90, 1.05, 24));
  chain(R, 448, 0, 60, 22);
  lamps.push(lantern(R, 448, 60, 0.9, 24));
  return {
    R,
    lights: (t) => lamps.map(([x, y]) => ({ x, y, z: 26, r: 130, c: t.lamp, k: 1.05 })),
    glows: (t) => lamps.map(([x, y]) => ({ x, y, r: 28, c: t.lamp, k: 0.4 })),
    opts: (t) => ({
      amb: 0.09,
      keyK: 0.12,
      ao: 0.07,
      aoR: 3,
      outline: 0.65,
      fogC: t.fog,
      fog: () => 0.05,
    }),
    rot: {
      seed: 113,
      bias: (x, y, m) => -0.18 + 0.28 * smooth(56, 0, y) + 0.24 * smooth(180, 205, y) + (m === M.SHAFT ? 0.06 : 0) + (m === M.CLOTH ? -0.2 : 0),
      sinews: [
        [NC[0] + 7.5, 56, NC[0] + 110, 37, 31, 1.3],
        [NC[1] - 7.5, 68, NC[1] - 90, 31, 25, 1.2],
        [NC[1] + 7.5, 43, NC[1] + 220, 25, 43, 1.4],
      ],
      drips: [
        [NC[0] + 20, 43, 31],
        [NC[0] + 50, 19, 19],
        [NC[1] - 30, 37, 43],
        [NC[1] + 30, 25, 25],
        [NC[1] + 80, 14, 15],
        [NC[0] - 25, 40, 37],
        [144, 181, 12],
        [376, 181, 19],
        [488, 181, 10],
      ],
      eyes: [
        [NC[0], 12, 3.2],
        [NC[1] - 24, 19, 2.6],
        [NC[1] + 27, 9, 2.6],
        [NC[0] + 8, 143, 2.6],
      ],
      z: 14,
    },
  };
}

// ===========================================================================
// FG: sparse dark silhouettes at the top and bottom edges only
// ===========================================================================

function fgLayer(): Layer {
  const R = new Relief(W, H);
  // Hanging arch corners meeting over a pier at x = 0
  R.box(-93, 0, 93, 50, (x, y, i) => {
    const cx = x < 0 ? -99 : 99;
    const res = muqArch(x, y, cx, 25, 90, 14, 7.5, 20, 3.2);
    if (res === 1) R.put(i, hit.h, hit.m, hit.t);
    else if (res === 0 && y < 25) R.put(i, 20 - (hit.t < 2.5 ? 0 : 1), hit.t < 2.5 ? M.TRIM : M.WALL, 0);
  });
  column(R, 0, 21, 57, 5.6, 22, { capH: 16 });
  R.box(-12, 41, 12, 60, (x, y, i) => {
    // the shaft is broken off just below the capital
    if (R.mat[i] && y > 43 + Math.abs(Math.sin(x * 1.7)) * 4 + (x > 0 ? 2.5 : 0)) R.put(i, EMPTY, 0, 0);
  });
  swag(R, 270, 390, -4, 16, 11, 20);
  chain(R, 480, 0, 25, 22);
  // bottom: broken balustrade and rubble
  balustrade(R, 112, 212, 202, 231, 10, 20);
  R.box(104, 197, 220, H - 1, (x, y, i) => {
    if (R.mat[i] && y < 200 + Math.abs(Math.sin(x * 0.34) * 6 + Math.sin(x * 1.45) * 2)) R.put(i, EMPTY, 0, 0);
  });
  R.box(352, 205, 439, H - 1, (x, y, i) => {
    const n = fbm(x, y, 6, 5, W, 2);
    const top = 218 - Math.sin(((x - 352) / 87) * Math.PI) * 11 + (n - 0.5) * 7.5;
    if (y > top) R.put(i, 20 + n * 6, M.WALL, (n - 0.5) * 0.2);
  });
  return {
    R,
    lights: (t) => [
      { x: 256, y: 124, z: 40, r: 236, c: t.lamp, k: 0.16 },
      { x: 0, y: 87, z: 26, r: 124, c: t.lamp, k: 0.12 },
    ],
    glows: () => [],
    opts: () => ({ amb: 0.05, keyK: 0.08, ao: 0.05, aoR: 3, outline: 0.7 }),
    rot: {
      seed: 151,
      bias: (x, y) => 0.02 + 0.1 * smooth(205, 224, y),
      drips: [
        [32, 37, 19],
        [72, 25, 12],
        [320, 19, 16],
        [376, 25, 10],
      ],
      sinews: [[48, 25, 272, 4, 19, 1.6]],
      z: 22,
    },
  };
}

// --- Assembly -------------------------------------------------------------------------

function shadeLayer(L: Layer, t: Theme, R: Relief): PixelCanvas {
  const o = L.opts(t);
  const pc = R.shade({
    mats: t.mats,
    keyC: t.key,
    ambC: t.amb,
    lights: L.lights(t),
    glows: L.glows(t),
    tint: 0.75,
    ...SNES_SHADE,
    ...o,
  });
  L.post?.(pc, t);
  return snesLayer(pc, LAYER_COLORS);
}

type Layers = { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas };
let cache: Partial<Record<'marble' | 'rot', Layers>> = {};

/** Build both nave sets at once (geometry is shared); each set is handed out once and then dropped. */
export function drawNave(set: 'marble' | 'rot'): Layers {
  if (!cache[set]) {
    const marble = {} as Layers;
    const rot = {} as Layers;
    const layers: [keyof Layers, () => Layer][] = [
      ['far', farLayer],
      ['mid', midLayer],
      ['near', nearLayer],
      ['fg', fgLayer],
    ];
    for (const [k, make] of layers) {
      const L = make();
      marble[k] = shadeLayer(L, MARBLE, L.R);
      rotify(L.R, L.rot);
      rot[k] = shadeLayer(L, ROT, L.R);
    }
    cache = { marble, rot };
  }
  const r = cache[set]!;
  delete cache[set];
  return r;
}
