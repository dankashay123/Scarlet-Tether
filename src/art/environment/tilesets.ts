import { PixelCanvas, hash2 } from '../pixel';
import { pick, tnoise } from './paint';

export const TILE = 16;

/** Tile indices beyond the 16 autotiled solids (0..15 = neighbour mask). */
export const ET = { PLAT_L: 16, PLAT_M: 17, PLAT_R: 18, LIQUID_TOP: 19, LIQUID: 20, GRATE: 21, THORNS: 22, COUNT: 23 } as const;

export type EnvSet = 'marble' | 'rot' | 'cistern';

interface Flags {
  N: boolean;
  E: boolean;
  S: boolean;
  W: boolean;
}

const INK = '#0b0507';

// --- Ramps -------------------------------------------------------------------
const STONE = ['#0a0607', '#120c0d', '#1a1213', '#231819', '#2e1f1f', '#3b2927'];
const MARBLE = ['#2e2826', '#5e564d', '#8c8273', '#b9ae9a', '#ddd5c4', '#f4efe4'];
const GOLD = ['#2e1d06', '#7a5418', '#b98a2e', '#e8c25a', '#fff1a8'];
const WOOD = ['#140706', '#2a110d', '#46201a', '#6a3022', '#8f4a30', '#b46a44'];
const BRASS = ['#1e1206', '#5a3c16', '#a87a35', '#e0b468', '#fff0b0'];
const IRONR = ['#0c0b0d', '#1f1e23', '#36353c', '#55545c', '#8a8990'];
const RUSTR = ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22'];
const FLESH = ['#24080d', '#4d1f2b', '#7a3540', '#b05a55', '#d98f7a', '#f2c3a8'];
const BONE_D = ['#0b0605', '#170e0b', '#241711', '#332218', '#462f21', '#5c412c'];
const BONE = ['#2a2014', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf'];
const BRICK = ['#080505', '#120a0a', '#1b0f0e', '#261412', '#331b16', '#43241c'];
const WETSTONE = ['#140c0b', '#2a1c18', '#3e2c26', '#574036', '#76584a', '#a88470'];
const BLOODR = ['#2a0208', '#4e0815', '#7a0c1c', '#a8122a', '#d0262f', '#ff5a4a'];

// --- Solid tiles ---------------------------------------------------------------

type SolidFn = (x: number, y: number, f: Flags, mask: number) => string | null;

function stoneBond(x: number, y: number, seed: number): number {
  const course = y < 8 ? 0 : 1;
  const bx = (x + course * 8) % 16;
  const by = y % 8;
  if (bx === 0 || by === 7) return -1;
  let v = 0.42 + (hash2(course, 0, seed) - 0.5) * 0.16;
  v += (tnoise(x, y, 8, seed) - 0.5) * 0.22 + (tnoise(x, y, 4, seed + 3) - 0.5) * 0.18;
  if (by === 0) v += 0.14;
  if (bx === 1) v += 0.06;
  if (by === 6) v -= 0.08;
  if (hash2(x, y, seed + 9) > 0.95) v -= 0.25;
  return v;
}

const marbleSolid: SolidFn = (x, y, f, mask) => {
  // Walkable floor: a polished marble slab lip with a gold inlay.
  if (f.N && y < 7) {
    if (f.W && x === 0) return y === 0 ? null : INK;
    if (f.E && x === 15) return y === 0 ? null : INK;
    const vein = Math.abs(tnoise(x, y * 2, 4, 31) - 0.5) < 0.05;
    switch (y) {
      case 0:
        return hash2(x, mask, 4) > 0.82 ? '#fffaf0' : MARBLE[5];
      case 1:
        return pick(MARBLE, 0.82 + (tnoise(x, 1, 8, 2) - 0.5) * 0.2, x, y);
      case 2:
      case 3:
        return vein ? '#c9b48a' : pick(MARBLE, 0.6 - (y - 2) * 0.08 + (tnoise(x, y, 8, 5) - 0.5) * 0.25, x, y);
      case 4:
        return x % 4 === 1 ? GOLD[4] : x % 4 === 3 ? GOLD[2] : GOLD[3];
      case 5:
        return pick(MARBLE, 0.3, x, y);
      default:
        return INK;
    }
  }
  if (f.W && x <= 3) return [INK, MARBLE[3], MARBLE[2], STONE[0]][x];
  if (f.E && x >= 12) return [STONE[0], MARBLE[1], MARBLE[0], INK][x - 12];
  if (f.S && y >= 12) {
    if (y === 15) return INK;
    if (y === 14) return x % 4 < 2 ? MARBLE[2] : STONE[0];
    if (y === 13) return x % 2 ? GOLD[2] : GOLD[1];
    return STONE[0];
  }
  let v = stoneBond(x, y, 7);
  if (v < 0) return STONE[0];
  if (f.N) v -= Math.max(0, 11 - y) * 0.035; // shadow beneath the slab
  // Old blood seeping down from the floor lip
  if (f.N && y >= 7 && y < 7 + Math.floor(hash2(mask, 3, 1) * 5) && x === 3 + (mask % 9)) return '#3a0a12';
  return pick(STONE, v, x, y);
};

const rotSolid: SolidFn = (x, y, f, mask) => {
  if (f.N && y < 7) {
    const top = Math.sin((x / 8) * Math.PI * 2) > 0.3 ? 1 : 0;
    const tooth = (x === 3 || x === 4 || x === 11) && y <= 2;
    if (tooth && !((f.W && x < 2) || (f.E && x > 13))) return y === 0 ? (x === 4 ? BONE[3] : BONE[4]) : BONE[x === 4 ? 2 : 3];
    if (y < top) return null;
    if (f.W && x === 0) return y <= top ? null : INK;
    if (f.E && x === 15) return y <= top ? null : INK;
    if (y === 6) return FLESH[0];
    if (y === 5) return FLESH[1];
    if (y === top) return hash2(x, mask, 8) > 0.55 ? FLESH[5] : FLESH[4];
    if (Math.abs(tnoise(x, y * 2, 4, 9) - 0.5) < 0.06) return FLESH[1];
    return pick(FLESH, 0.78 - (y - top) * 0.1 + (tnoise(x, y, 8, 3) - 0.5) * 0.25, x, y);
  }
  if (f.W && x <= 3) return [INK, FLESH[2], FLESH[1], BONE_D[0]][x];
  if (f.E && x >= 12) return [BONE_D[0], FLESH[1], FLESH[0], INK][x - 12];
  if (f.S && y >= 12) {
    const drip = hash2(x, 5, mask) < 0.3;
    if (y === 15) return x === 6 || x === 7 ? BONE[3] : drip ? FLESH[2] : null;
    if (y === 14) return x === 6 ? BONE[4] : x === 7 ? BONE[3] : x % 5 === 0 ? FLESH[1] : FLESH[2];
    if (y === 13) return FLESH[1];
    return FLESH[0];
  }
  // Porous bone and gristle
  const p = tnoise(x, y, 8, 77);
  if (p > 0.7) return BONE_D[0];
  if (p > 0.64) return tnoise(x, y - 1, 8, 77) > 0.7 ? BONE_D[1] : BONE_D[2];
  if (Math.abs(tnoise(x, y, 4, 5) - 0.5) < 0.04) return hash2(x, y, 2) > 0.5 ? '#5a1a22' : '#3e1018';
  let v = 0.35 + (tnoise(x, y, 4, 12) - 0.5) * 0.45 + (tnoise(x, y, 16, 13) - 0.5) * 0.2;
  if (f.N) v -= Math.max(0, 11 - y) * 0.03;
  return pick(BONE_D, v, x, y);
};

const cisternSolid: SolidFn = (x, y, f, mask) => {
  if (f.N && y < 5) {
    if (f.W && x === 0) return y === 0 ? null : INK;
    if (f.E && x === 15) return y === 0 ? null : INK;
    if (y === 4) return INK;
    const moss = tnoise(x, 0, 4, 21 + (mask & 3)) > 0.62;
    if (moss && y <= 1) return y === 0 ? '#5a6a2e' : '#33401a';
    if ((x === 6 && y >= 2) || (x === 13 && y === 3)) return '#8a1020';
    if (y === 0) return hash2(x, mask, 3) > 0.72 ? '#d0aa84' : WETSTONE[4];
    const joint = (x + 4) % 8 === 0;
    if (joint && y > 0) return WETSTONE[0];
    return pick(WETSTONE, 0.62 - y * 0.1 + (tnoise(x, y, 8, 6) - 0.5) * 0.25, x, y);
  }
  if (f.W && x <= 2) return [INK, WETSTONE[2], BRICK[0]][x];
  if (f.E && x >= 13) return [BRICK[0], WETSTONE[1], INK][x - 13];
  if (f.S && y >= 13) {
    if (y === 15) return hash2(x, 9, mask) < 0.15 ? '#4a1018' : null;
    if (y === 14) return INK;
    return WETSTONE[1];
  }
  const course = y >> 2;
  const bx = (x + (course % 2) * 4) % 8;
  const by = y % 4;
  if (f.N && y < 8 && x === 6) return '#5a0c16';
  if (bx === 0 || by === 3) return BRICK[0];
  const id = ((x + (course % 2) * 4) >> 3) % 2;
  let v = 0.45 + (hash2(id, course, 3) - 0.5) * 0.3 + (tnoise(x, y, 8, 4) - 0.5) * 0.2;
  if (by === 0 && bx <= 2 && hash2(id, course, 8) > 0.45) v += 0.3;
  if (f.N) v -= Math.max(0, 9 - y) * 0.04;
  return pick(BRICK, v, x, y);
};

// --- Platforms -----------------------------------------------------------------

function platform(set: EnvSet, x: number, y: number, kind: 0 | 1 | 2): string | null {
  const endL = kind === 0;
  const endR = kind === 2;
  if (set === 'rot') {
    // A bone ledge with knuckled ends, gristle and dripping blood beneath
    const knob = (endL && x < 3) || (endR && x > 12);
    const top = knob ? 0 : 1;
    if (y < top) return null;
    if (y <= 4) {
      if ((endL && x === 0) || (endR && x === 15)) return y === 0 || y === 4 ? null : INK;
      if (y === top) return BONE[4];
      if (y === 4) return '#5a1a22';
      return pick(BONE, 0.7 - (y - top) * 0.16 + (tnoise(x, y, 8, 2) - 0.5) * 0.3, x, y);
    }
    if (y === 5) return x % 3 === 0 ? '#3e1018' : FLESH[1];
    if (y <= 8 && x === (kind === 1 ? 9 : 7) && y < 5 + kind + 2) return BLOODR[2];
    return null;
  }
  if (set === 'cistern') {
    // A rotten plank lashed with rusted iron bands
    if (y > 5) return null;
    if ((endL && x === 0) || (endR && x === 15)) return y === 0 || y === 5 ? null : INK;
    if (y === 5) return INK;
    const band = (endL && x >= 2 && x <= 3) || (endR && x >= 12 && x <= 13) || (kind === 1 && x >= 7 && x <= 8);
    if (band) return pick(RUSTR, 0.8 - y * 0.15, x, y);
    if (y === 0) return WOOD[4];
    const grain = Math.sin(x * 0.6 + y * 2.3 + tnoise(x, y, 4, 9) * 4);
    return pick(WOOD, 0.5 - y * 0.06 + grain * 0.12, x, y);
  }
  // Marble set: a carved mahogany beam with gilded end caps and corbels
  if (y <= 4) {
    if ((endL && x === 0) || (endR && x === 15)) return y === 0 ? null : INK;
    if ((endL && x <= 2) || (endR && x >= 13)) return pick(GOLD, 0.85 - y * 0.15, x, y);
    if (y === 0) return x % 5 === 2 ? WOOD[5] : WOOD[4];
    if (y === 4) return INK;
    const grain = Math.sin(x * 0.55 + y * 1.9 + tnoise(x, y, 4, 3) * 5);
    if (kind === 1 && (x === 7 || x === 8) && y === 2) return GOLD[3];
    return pick(WOOD, 0.62 - y * 0.08 + grain * 0.14, x, y);
  }
  // Corbel brackets beneath the ends
  if (endL || endR) {
    const lx = endL ? x - 2 : 13 - x;
    const w = 4 - (y - 5) * 0.7;
    if (y <= 9 && lx >= 0 && lx < w) return lx < 1 ? INK : y === 9 || lx >= w - 1 ? WOOD[0] : WOOD[2];
  }
  return null;
}

// --- Liquids ---------------------------------------------------------------------

interface LiquidStyle {
  body: string[];
  surf: string[];
  glint: string;
  alpha: number;
}
const LIQ: Record<EnvSet, LiquidStyle> = {
  marble: { body: ['#0e1416', '#141c1f', '#1c2427', '#253033', '#2f3c40'], surf: ['#2f3c40', '#4a5a5e', '#6f8487', '#a8bcbc'], glint: '#e4f0ec', alpha: 0.84 },
  rot: { body: ['#1e0206', '#2e0409', '#3e060e', '#4e0815', '#62101c'], surf: ['#4e0815', '#8a1020', '#c01a2c', '#e8343a'], glint: '#ff9a82', alpha: 0.95 },
  cistern: { body: ['#1c0306', '#2a050a', '#3a080f', '#4c0c14', '#5e121a'], surf: ['#5e121a', '#8a1a20', '#b8402a', '#e09048'], glint: '#ffe0a0', alpha: 0.86 },
};

function liquid(pc: PixelCanvas, ox: number, set: EnvSet, top: boolean) {
  const L = LIQ[set];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = tnoise(x, y, 4, 61) * 0.6 + tnoise(x, y, 8, 62) * 0.4;
      if (top) {
        const wave = Math.round(Math.sin((x / 16) * Math.PI * 4) * 0.8 + 1);
        if (y < wave) {
          if (y === wave - 1 && set === 'rot' && hash2(x, 2, 6) > 0.8) pc.px(ox + x, y, L.surf[1], 0.9);
          continue;
        }
        if (y === wave) {
          pc.px(ox + x, y, hash2(x, 1, 7) > 0.8 ? L.glint : pick(L.surf, 0.7 + n * 0.3, x, y), 0.92);
          continue;
        }
        if (y <= wave + 2) {
          pc.px(ox + x, y, pick(L.surf, 0.25 + n * 0.4 - (y - wave) * 0.1, x, y), Math.max(L.alpha, 0.88));
          continue;
        }
      }
      let v = 0.35 + (n - 0.5) * 0.5 - (top ? 0 : 0.1);
      if (set === 'rot' && tnoise(x, y, 4, 71) > 0.72) v -= 0.3; // clots
      let c = pick(L.body, v, x, y);
      // Slow drifting highlights
      if (Math.abs(tnoise(x, y * 3, 4, 64) - 0.5) < 0.03) c = L.surf[1];
      pc.px(ox + x, y, c, L.alpha);
    }
}

// --- Grate & thorns ----------------------------------------------------------------

function grate(pc: PixelCanvas, ox: number, set: EnvSet, solid: SolidFn) {
  const f: Flags = { N: false, E: false, S: false, W: false };
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let c: string | null = null;
      if (y >= 10) c = solid(x, y, f, 14);
      else if (set === 'rot') {
        // Two mouths set into a gum frame
        const mx = x < 8 ? 3.5 : 11.5;
        const dx = (x - mx) / 3.6;
        const dy = (y - 4.5) / 3.2;
        const d = dx * dx + dy * dy;
        if (y === 9) c = FLESH[0];
        else if (d < 0.45) {
          const teeth = (y === 3 || y === 6) && x % 2 === 0;
          c = teeth ? BONE[4] : y < 4 ? '#0a0204' : '#2a0308';
        } else if (d < 1.0) c = y < 4 ? FLESH[4] : d > 0.8 ? FLESH[1] : FLESH[3];
        else c = y === 0 ? FLESH[5] : pick(FLESH, 0.65 - y * 0.05, x, y);
      } else {
        const R = set === 'marble' ? BRASS : IRONR;
        if (y <= 1 || y === 9) c = y === 0 ? R[4] : y === 9 ? R[0] : R[3];
        else {
          const m = x % 4;
          if (m === 0 || m === 1) c = pick(R, m === 0 ? 0.75 - y * 0.04 : 0.45 - y * 0.03, x, y);
          else c = y === 8 ? '#3a0a0e' : y === 7 ? '#1a0306' : '#050203';
          if (set === 'cistern' && m <= 1 && hash2(x, y, 5) > 0.7) c = RUSTR[2];
        }
        if (x === 0 || x === 15) c = R[0];
      }
      if (c) pc.px(ox + x, y, c);
    }
}

function thorns(pc: PixelCanvas, ox: number, set: EnvSet) {
  const R = set === 'rot' ? BONE : set === 'cistern' ? [...RUSTR, '#b06a36'] : IRONR;
  const spikes = [
    [1.5, 9],
    [4.5, 13],
    [7.5, 8],
    [10.5, 14],
    [13.5, 10],
  ];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let c: string | null = null;
      if (y >= 13) {
        if (set === 'rot') c = y === 13 ? FLESH[4] : y === 14 ? FLESH[2] : FLESH[1];
        else c = y === 13 ? R[3] : y === 14 ? R[1] : R[0];
      } else {
        for (const [sx, h] of spikes) {
          const t = (16 - y) / h; // 0 at base .. 1 at tip
          if (t > 1) continue;
          const half = 1.6 * (1 - t) + 0.3;
          const dx = x + 0.5 - sx;
          if (Math.abs(dx) <= half) {
            const tip = t > 0.72;
            if (tip && set !== 'rot') c = t > 0.86 ? BLOODR[4] : BLOODR[2];
            else if (tip && set === 'rot' && t > 0.85) c = BLOODR[3];
            else c = dx < -0.3 ? R[R.length - 1] : dx > 0.5 ? R[1] : R[2];
            if (Math.abs(dx) > half - 0.6 && Math.abs(dx) <= half) c = dx > 0 ? R[0] : c;
          }
        }
      }
      if (c) pc.px(ox + x, y, c);
    }
}

// --- Assembly ------------------------------------------------------------------------

const SOLIDS: Record<EnvSet, SolidFn> = { marble: marbleSolid, rot: rotSolid, cistern: cisternSolid };

export function drawTileset(set: EnvSet): PixelCanvas {
  const pc = new PixelCanvas(TILE * ET.COUNT, TILE);
  const solid = SOLIDS[set];
  for (let m = 0; m < 16; m++) {
    const f: Flags = { N: !(m & 1), E: !(m & 2), S: !(m & 4), W: !(m & 8) };
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const c = solid(x, y, f, m);
        if (c) pc.px(m * 16 + x, y, c);
      }
  }
  for (const [i, k] of [
    [ET.PLAT_L, 0],
    [ET.PLAT_M, 1],
    [ET.PLAT_R, 2],
  ] as const) {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const c = platform(set, x, y, k);
        if (c) pc.px(i * 16 + x, y, c);
      }
  }
  liquid(pc, ET.LIQUID_TOP * 16, set, true);
  liquid(pc, ET.LIQUID * 16, set, false);
  grate(pc, ET.GRATE * 16, set, solid);
  thorns(pc, ET.THORNS * 16, set);
  return pc;
}
