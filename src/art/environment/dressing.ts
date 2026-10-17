import { PixelCanvas, bayer, hash2, mulberry32, registerImage, valueNoise } from '../pixel';
import { KEY_LIGHT, folds, grain, type Light, type Material } from '../render';
import { BLOOD, BONE, BRASS, FLESH, GOLD, IRON, MARBLE, OLD_BLOOD, SC, SF, VOID, WAX, flame } from './props';
import { finishSprite, reduce2, selout } from './snes-env';
import { addGlow } from './relief';
import { pnoise } from './paint';

/**
 * Level dressing: decals the level generator scatters along floors, ceilings
 * and corners so the 16px grid stops reading as a grid.
 *
 * Conventions (all keys registered by `buildDressing`):
 *  - 'cap-{marble|rot|crypt|cistern}-{0..3}'  48x16 floor caps. Walk line at
 *    y = 4; rows 0..3 are stone tops poking above it, rows 4..15 the front faces
 *    fading out into the tile beneath. Every variant has a mortar joint at x = 0
 *    and a stone ending at x = 47, so any variants butt together edge to edge.
 *    marble and rot share silhouettes exactly (crossfade).
 *  - Standing decals 'deco-*' (origin 0.5, 1): bottom opaque row = ground.
 *  - Hanging decals 'drips-*', 'deco-lantern', 'deco-censer-hang',
 *    'deco-stalactites' (origin 0.5, 0): top row = attachment line.
 *  - 'web-l' (origin 0, 0) and 'web-r' (origin 1, 0): 15x15 corner cobwebs.
 *  - 'ink-top' / 'ink-bottom' 512x18 and 'ink-side' 18x224: torn ink-brush
 *    frame, horizontally (resp. vertically) tileable; flip ink-side for the right.
 *
 * Lighting matches the characters: KEY_LIGHT from the upper left, rim light
 * and selective dark outlines.
 *
 * SNES pass: decals are authored in their old 360 px coordinates and drawn at
 * SC (0.625) of that size, rasterised at 2x and reduced, then quantised to a
 * 15-colour sprite palette. Caps keep their 48x16 size. The ink frame strips
 * are 512x18 / 18x224.
 */

/** Quantise a decal to a sprite palette, keeping translucent pixels. */
const snesifyKeep = (pc: PixelCanvas) => finishSprite(pc, { outline: false, keepAlpha: true });

/** Source coordinate to final decal pixel. */
const P = (v: number) => Math.round(v * SC);

type V3 = [number, number, number];
type Mask = (x: number, y: number) => boolean;
const INK = '#0b0507';

// =============================================================================
// Facet renderer: like `Figure`, but every part carries explicit normals, so
// chunky cut stone, slabs and rock spikes get crisp planes instead of pillows.
// =============================================================================

class Facets {
  /** Internal (2x) size; the rendered canvas is fw x fh. */
  readonly w: number;
  readonly h: number;
  readonly fw: number;
  readonly fh: number;
  /** Source units to internal pixels. */
  private readonly k: number;
  readonly mat: Int16Array;
  readonly grp: Int16Array;
  readonly z: Float32Array;
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly bias: Float32Array;
  private mats: Material[] = [];
  private mIdx = new Map<Material, number>();
  private seq = 0;
  private groups = 0;

  constructor(sw: number, sh: number, scale = SC) {
    this.fw = Math.round(sw * scale);
    this.fh = Math.round(sh * scale);
    this.w = this.fw * 2;
    this.h = this.fh * 2;
    this.k = scale * 2;
    const w = this.w;
    const h = this.h;
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.grp = new Int16Array(n).fill(-1);
    this.z = new Float32Array(n).fill(-1e9);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
    this.bias = new Float32Array(n);
  }

  private mi(m: Material) {
    let i = this.mIdx.get(m);
    if (i === undefined) {
      i = this.mats.length;
      this.mats.push(m);
      this.mIdx.set(m, i);
    }
    return i;
  }

  group() {
    return this.groups++;
  }

  /** Fill a mask with a material and normal (constant or per pixel). */
  add(mask: Mask, normal: V3 | ((x: number, y: number) => V3), m: Material, layer: number, bb?: [number, number, number, number], group = this.group(), bias?: (x: number, y: number) => number) {
    const K = this.k;
    const [x0, y0, x1, y1] = bb ? [bb[0] * K, bb[1] * K, bb[2] * K + K, bb[3] * K + K] : [0, 0, this.w - 1, this.h - 1];
    const bx0 = Math.max(0, Math.floor(x0) - 1);
    const by0 = Math.max(0, Math.floor(y0) - 1);
    const bx1 = Math.min(this.w - 1, Math.ceil(x1) + 1);
    const by1 = Math.min(this.h - 1, Math.ceil(y1) + 1);
    const mid = this.mi(m);
    const zz = layer * 1000 + this.seq++ * 0.01;
    const fn = typeof normal === 'function' ? normal : null;
    let cx = 0;
    let cy = 0;
    let cz = 1;
    if (typeof normal !== 'function') {
      const l = Math.hypot(normal[0], normal[1], normal[2]);
      cx = normal[0] / l;
      cy = normal[1] / l;
      cz = normal[2] / l;
    }
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const sx = (x + 0.5) / K;
        const sy = (y + 0.5) / K;
        if (!mask(sx, sy)) continue;
        const o = y * this.w + x;
        if (zz < this.z[o]) continue;
        let nx = cx;
        let ny = cy;
        let nz = cz;
        if (fn) {
          const n = fn(Math.floor(sx), Math.floor(sy));
          const l = Math.hypot(n[0], n[1], n[2]) || 1;
          nx = n[0] / l;
          ny = n[1] / l;
          nz = n[2] / l;
        }
        this.z[o] = zz;
        this.mat[o] = mid;
        this.grp[o] = group;
        this.nx[o] = nx;
        this.ny[o] = ny;
        this.nz[o] = nz;
        this.bias[o] = bias ? bias(Math.floor(sx), Math.floor(sy)) : 0;
      }
    return group;
  }

  facet(pts: [number, number][], n: V3 | ((x: number, y: number) => V3), m: Material, layer: number, group?: number, bias?: (x: number, y: number) => number) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return this.add((x, y) => inPoly(pts, x, y), n, m, layer, [x0, y0, x1, y1], group, bias);
  }

  /** Repaint existing pixels (keeps normals). */
  stain(mask: Mask, m: Material, only?: Material[], bias = 0) {
    const mid = this.mi(m);
    const allow = only ? new Set(only.map((x) => this.mIdx.get(x)).filter((x) => x !== undefined)) : null;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const o = y * this.w + x;
        if (this.mat[o] < 0 || (allow && !allow.has(this.mat[o]))) continue;
        if (mask((x + 0.5) / this.k, (y + 0.5) / this.k)) {
          this.mat[o] = mid;
          this.bias[o] += bias;
        }
      }
  }

  /** Shade at 2x, reduce to fw x fh, then outline (selectively, when `outline` is set). */
  render(light: Light = KEY_LIGHT, outline: string | null = INK, lip = 0.16): PixelCanvas {
    const pc = reduce2(this.renderRaw(light, lip), this.fw, this.fh);
    if (outline) selout(pc, rgbOf(outline));
    return pc;
  }

  private renderRaw(light: Light, lip: number): PixelCanvas {
    const { w: W, h: H } = this;
    const pc = new PixelCanvas(W, H);
    let lx = light.x;
    let ly = light.y;
    let lz = light.z;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll;
    ly /= ll;
    lz /= ll;
    let hx = lx;
    let hy = ly;
    let hz = lz + 1;
    const hl = Math.hypot(hx, hy, hz);
    hx /= hl;
    hy /= hl;
    hz /= hl;
    const idx = new Int16Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        const mi = this.mat[o];
        if (mi < 0) continue;
        const m = this.mats[mi];
        const nx = this.nx[o];
        const ny = this.ny[o];
        const nz = this.nz[o];
        const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
        const rim = Math.pow(Math.max(0, 1 - nz), 2.5) * Math.max(0, -nx * lx + ny * 0.1) * light.rim;
        const spec = m.spec ? Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 24) * m.spec : 0;
        let v = light.ambient + dif * 0.78 + rim + spec + (m.tex ? m.tex(x, y) * 0.3 : 0) + this.bias[o];
        // A bright lip where an upward face meets the air or a farther part
        if (lip && ny < -0.15) {
          const up = y > 0 ? o - W : -1;
          if (up < 0 || this.mat[up] < 0 || (this.grp[up] !== this.grp[o] && this.z[up] < this.z[o])) v += lip;
        }
        v = Math.max(0, Math.min(0.999, v));
        const n = m.ramp.length;
        const f = v * (n - 1);
        let k = Math.floor(f);
        if (f - k > bayer(x, y)) k++;
        k = Math.max(0, Math.min(n - 1, k));
        idx[o] = k;
        pc.px(x, y, m.ramp[k]);
      }
    // Inner lines where a nearer group overlaps a farther one
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const o = y * W + x;
        if (this.mat[o] < 0) continue;
        for (const [dx, dy] of DIRS) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const q = yy * W + xx;
          if (this.mat[q] < 0 || this.grp[q] === this.grp[o]) continue;
          if (this.z[q] > this.z[o] + 200) {
            const m = this.mats[this.mat[o]];
            pc.px(x, y, m.line ?? m.ramp[0]);
            break;
          }
        }
      }
    return pc;
  }
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function inPoly(pts: [number, number][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Composite b over a (same size). */
function over(a: PixelCanvas, b: PixelCanvas, dx = 0, dy = 0) {
  a.blit(b, dx, dy);
  return a;
}

const rgbOf = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Soft warm haze that stays inside the canvas (no clipped halo edges). */
function haze(pc: PixelCanvas, x: number, y: number, r: number, c: string, k: number) {
  const rr = Math.min(r, x, pc.w - x, y + r, pc.h - y);
  addGlow(pc, { x, y, r: Math.max(2, rr), c: rgbOf(c), k, pow: 2 }, false);
}

const rnd = (seed: number) => {
  const r = mulberry32(seed);
  return { f: r, range: (a: number, b: number) => a + r() * (b - a), int: (a: number, b: number) => a + Math.floor(r() * (b - a + 1)) };
};

// =============================================================================
// Materials
// =============================================================================

const noiseTex = (amt: number, sc: number, seed: number, pit = 0.94) => (x: number, y: number) =>
  (valueNoise(x, y, sc, seed) - 0.5) * amt + (hash2(x, y, seed) > pit ? -0.14 : 0);

// Cold grey-violet rubble stone (works in nave and crypt)
const RUBBLE: Material = { ramp: ['#08070a', '#141218', '#221e26', '#322c36', '#463e48', '#5c525c', '#766a72', '#928488', '#b0a2a2', '#cabcb4'], tex: (x, y) => 0.08 + noiseTex(0.16, 2.5, 3)(x, y), spec: 0.08 };
const RUBBLE_D: Material = { ...RUBBLE, ramp: RUBBLE.ramp.slice(0, 8) };
// Cut marble for coffins / plinths
const SLAB: Material = { ramp: ['#0e0b0f', '#211b22', '#342b33', '#4a3e45', '#64555a', '#807074', '#9e8e8c', '#bcaea6', '#d8ccc0'], tex: noiseTex(0.12, 3, 11, 0.96), spec: 0.15 };
const SLAB_MARBLE: Material = { ramp: ['#2a2026', '#4e4248', '#76686a', '#9e8e8a', '#c4b4a6', '#e4d8c8', '#fbf4e8'], tex: (x, y) => (Math.abs(valueNoise(x, y, 5, 13) - 0.5) < 0.03 ? -0.12 : 0) + (valueNoise(x, y, 2, 1) - 0.5) * 0.06, spec: 0.3 };
const RECESS: Material = { ramp: ['#050304', '#0e0a0d', '#181217', '#221a20'] };
const MOSS: Material = { ramp: ['#0e1208', '#222c10', '#3a4a18', '#5a6c26', '#7e9034', '#a8b448', '#d0d478'], tex: noiseTex(0.2, 1.6, 41, 0.9), spec: 0.05 };
const ICE: Material = { ramp: ['#08141a', '#14303a', '#245058', '#3a7480', '#5e9aa4', '#8cc4cc', '#c4e8ec', '#f0feff'], spec: 1, tex: (x, y) => (hash2(x, y, 71) > 0.93 ? 0.12 : 0) };
const VERDIGRIS: Material = { ramp: ['#061210', '#0e2420', '#1a3a32', '#285446', '#3a705a', '#5a9076', '#8ab49a'], spec: 0.5, round: 0.9, tex: grain(1.3, 0.1, 17) };
const GLASS: Material = { ramp: ['#7a2e0e', '#c0601a', '#ec9a30', '#ffcf70', '#fff0c0'], round: 0.3, tex: (x, y) => 0.5 + (valueNoise(x, y, 2, 3) - 0.5) * 0.15 };
const EMBER: Material = { ramp: ['#2a0804', '#7a1c06', '#d24c10', '#ffa040', '#ffe8a0'], round: 0.6, tex: (x, y) => 0.25 + (valueNoise(x, y, 1.5, 9) - 0.5) * 0.6 };
const FLESH_LUMP: Material = { ...FLESH, tex: grain(1.2, 0.16, 23) };
const WAX_PALE: Material = { ramp: ['#3a2e28', '#6e6058', '#a89a8c', '#d2c6b4', '#eee6d6', '#fffaf0'], round: 0.9, spec: 0.35, tex: grain(2, 0.05, 31) };

// --- Cap materials per set ---------------------------------------------------
interface CapMats {
  top: Material;
  front: Material;
  low: Material;
  mortar: Material;
  accent: Material;
}
const CAP_MATS: Record<CapSet, CapMats> = {
  marble: {
    top: { ramp: ['#1e171d', '#3a2f37', '#5a4c52', '#7e6e70', '#a4948e', '#c4b6ac', '#ddd2c4', '#f2eadc'], spec: 0.3, tex: (x, y) => (Math.abs(valueNoise(x, y, 4, 13) - 0.5) < 0.035 ? -0.1 : 0) + (valueNoise(x, y, 2, 1) - 0.5) * 0.08 },
    front: { ramp: ['#0a070b', '#1a141c', '#2a2129', '#3c2f36', '#544249', '#6e5a5c', '#8a7470', '#a69088'], spec: 0.1, tex: noiseTex(0.12, 2.5, 5) },
    low: { ramp: ['#060407', '#100b11', '#1a131b', '#261c25', '#342731', '#44343c'], tex: noiseTex(0.1, 2, 7) },
    mortar: { ramp: ['#030203', '#0a070a', '#120c11', '#1a1218'] },
    accent: GOLD,
  },
  rot: {
    top: { ramp: ['#160406', '#3a0e14', '#642024', '#903a34', '#ba6450', '#dc9a80', '#f6d0b8'], spec: 0.6, tex: (x, y) => (valueNoise(x, y, 2.2, 41) - 0.5) * 0.3 },
    front: { ramp: ['#050202', '#120707', '#1e0c0c', '#2c1412', '#3e1e19', '#542a20', '#6c3a2a', '#8a4a34'], spec: 0.2, tex: (x, y) => (Math.abs(valueNoise(x, y, 3, 77) - 0.5) < 0.05 ? 0.18 : 0) + (valueNoise(x, y, 2, 79) - 0.5) * 0.14 },
    low: { ramp: ['#040101', '#0c0404', '#160808', '#200c0b', '#2c1210', '#3a1a16'], tex: noiseTex(0.12, 2, 81) },
    mortar: { ramp: ['#120103', '#36040b', '#640a16', '#9a1420', '#d0302c'], spec: 1 },
    accent: BONE,
  },
  crypt: {
    top: MOSS,
    front: { ramp: ['#06080a', '#0e1416', '#18201f', '#24302c', '#34423a', '#4a584c', '#62705e', '#7e8a72'], spec: 0.1, tex: noiseTex(0.16, 2.2, 13, 0.92) },
    low: { ramp: ['#030405', '#080b0c', '#0e1413', '#151d1b', '#1e2824', '#28342e'], tex: noiseTex(0.12, 2, 17) },
    mortar: { ramp: ['#020303', '#060807', '#0a0e0c', '#0e1411'] },
    accent: { ramp: ['#1a2014', '#3a4430', '#5c6a50', '#808e70', '#a8b494', '#ccd6b8'], spec: 0.15, tex: noiseTex(0.14, 2, 19) },
  },
  cistern: {
    top: { ramp: ['#120c0b', '#2a1e1a', '#43322a', '#5e4838', '#82664e', '#ae8e70', '#d8bc98', '#f4e0c0'], spec: 0.75, tex: noiseTex(0.14, 2, 23) },
    front: { ramp: ['#080404', '#160a09', '#24120f', '#341b16', '#47261d', '#5e3426', '#7a4630', '#9a5c3c'], spec: 0.6, tex: noiseTex(0.14, 2, 29) },
    low: { ramp: ['#050202', '#0e0606', '#180b09', '#22100d', '#2e1712', '#3c1f17'], spec: 0.4, tex: noiseTex(0.1, 2, 31) },
    mortar: { ramp: ['#030202', '#0a0505', '#120808', '#1a0c0b'] },
    accent: { ramp: ['#0e1006', '#24300e', '#3c4c18', '#5a6a28', '#7e8a3a', '#a2ac52'], tex: noiseTex(0.2, 1.5, 37) },
  },
};

// =============================================================================
// A) Floor caps
// =============================================================================

export type CapSet = 'marble' | 'rot' | 'crypt' | 'cistern';
export const CAP_SETS: CapSet[] = ['marble', 'rot', 'crypt', 'cistern'];
export const CAP_VARIANTS = 4;

interface CapStyle {
  w: [number, number];
  poke: [number, number];
  topH: [number, number];
  bot: [number, number];
  tilt: number;
  chip: number;
  low: [number, number];
  seed: number;
}

const CAP_STYLE: Record<'cut' | 'crypt' | 'brick', CapStyle> = {
  cut: { w: [6, 17], poke: [1, 3], topH: [2, 3], bot: [9, 11], tilt: 1.6, chip: 0.35, low: [6, 11], seed: 1100 },
  crypt: { w: [5, 15], poke: [1, 3], topH: [2, 3], bot: [8, 11], tilt: 2.4, chip: 0.55, low: [5, 9], seed: 3300 },
  brick: { w: [7, 9], poke: [2, 3], topH: [2, 2], bot: [8, 9], tilt: 0.4, chip: 0.15, low: [7, 8], seed: 5500 },
};

interface CapStone {
  x0: number;
  x1: number;
  top: number[];
  lip: number[];
  bot: number;
  accent: boolean;
  id: number;
  tone: number;
}

function capLayout(st: CapStyle, variant: number) {
  const R = rnd(st.seed + variant * 977);
  const stones: CapStone[] = [];
  let x = 1;
  let id = 0;
  while (x <= 47) {
    let x1 = x + R.int(st.w[0], st.w[1]) - 1;
    if (47 - x1 - 1 < st.w[0] || x1 > 47) x1 = 47;
    const w = x1 - x + 1;
    const poke = R.int(st.poke[0], st.poke[1]);
    const tilt = (R.f() - 0.5) * st.tilt;
    const th = R.int(st.topH[0], st.topH[1]);
    const chipAt = R.f() < st.chip ? R.int(1, w - 2) : -9;
    const chipL = R.f() < st.chip;
    const chipR = R.f() < st.chip;
    const top: number[] = [];
    const lip: number[] = [];
    for (let i = 0; i < w; i++) {
      const u = w > 1 ? i / (w - 1) : 0.5;
      let t = Math.round(poke + tilt * (u - 0.5));
      if (i === 0 || i === w - 1) t += 1;
      if ((i === 1 && chipL) || (i === w - 2 && chipR)) t += 1;
      if ((i === 0 && chipL) || (i === w - 1 && chipR)) t += 1;
      if (w > 4 && (i === 0 || i === w - 1) && R.f() < 0.5) t += 1;
      if (Math.abs(i - chipAt) <= (st === CAP_STYLE.crypt ? 1 : 0)) t += 1;
      t = Math.max(0, Math.min(4, t));
      top.push(t);
      const l = Math.max(t + 1, Math.round(poke + th + tilt * (u - 0.5) * 0.5) + (i === 0 || i === w - 1 ? 1 : 0));
      lip.push(Math.min(7, l));
    }
    stones.push({ x0: x, x1, top, lip, bot: R.int(st.bot[0], st.bot[1]), accent: R.f() < 0.3, id: id++, tone: R.range(-0.09, 0.06) });
    x = x1 + 2;
  }
  // Second course: smaller, sunk stones under the joint line
  const low: number[] = [];
  let lx = R.int(-3, 0);
  while (lx < 48) {
    low.push(lx);
    lx += R.int(st.low[0], st.low[1]) + 1;
  }
  low.push(99);
  return { stones, low, R };
}

function drawCap(set: CapSet, variant: number): PixelCanvas {
  const style = set === 'crypt' ? CAP_STYLE.crypt : set === 'cistern' ? CAP_STYLE.brick : CAP_STYLE.cut;
  const M = CAP_MATS[set];
  const { stones, low } = capLayout(style, variant);
  const fb = new Facets(48, 16, 1);
  const seed = style.seed + variant * 31;
  const botAt = new Int8Array(48).fill(10);
  for (const s of stones) for (let x = s.x0; x <= s.x1; x++) botAt[x] = s.bot;
  for (let x = 0; x < 48; x++) {
    const l = stones.find((s) => s.x1 === x - 1);
    const r = stones.find((s) => s.x0 === x + 1);
    if (x === 0 || (l && r)) botAt[x] = Math.max(l?.bot ?? botAt[1], r?.bot ?? 0);
  }
  for (const s of stones) {
    const w = s.x1 - s.x0 + 1;
    const g = fb.group();
    const sideN = (x: number) => {
      const i = x - s.x0;
      if (i === 0) return -0.75;
      if (i === 1) return -0.3;
      if (x === s.x1) return 0.75;
      if (x === s.x1 - 1) return 0.3;
      return (valueNoise(x, s.id, 3, seed) - 0.5) * 0.3;
    };
    const topAt = (x: number) => s.top[Math.max(0, Math.min(w - 1, Math.floor(x) - s.x0))];
    const lipAt = (x: number) => s.lip[Math.max(0, Math.min(w - 1, Math.floor(x) - s.x0))];
    // top face (seen from slightly above), lit
    fb.add(
      (x, y) => x >= s.x0 && x < s.x1 + 1 && y >= topAt(x) && y < lipAt(x),
      (x, y) => [sideN(x) * 0.7 + (y - topAt(x)) * -0.05, -0.95, 0.45],
      M.top,
      2,
      [s.x0, 0, s.x1, 8],
      g,
      (x, y) => s.tone + (y === topAt(x) ? 0.05 : 0) - ((y - topAt(x)) / Math.max(1, lipAt(x) - topAt(x))) * 0.1 + (valueNoise(x, y, 3, seed + 5) - 0.5) * 0.16 + (hash2(x, y, seed + 2) > 0.9 ? -0.12 : 0),
    );
    // lip row: rounded arris between top and front
    fb.add(
      (x, y) => x >= s.x0 && x < s.x1 + 1 && Math.floor(y) === lipAt(x),
      (x) => [sideN(x), -0.45, 0.9],
      M.top,
      2,
      [s.x0, 0, s.x1, 8],
      g,
      () => s.tone - 0.04,
    );
    // front face, curving away towards its foot
    fb.add(
      (x, y) => x >= s.x0 && x < s.x1 + 1 && y > lipAt(x) + 1 && y < s.bot + 1,
      (x, y) => {
        const k = (y - lipAt(x)) / Math.max(1, s.bot - lipAt(x));
        return [sideN(x), -0.05 + k * k * 0.55, 1];
      },
      M.front,
      2,
      [s.x0, 0, s.x1, 15],
      g,
      (x, y) => s.tone - 0.04 - ((y - lipAt(x)) / 8) * 0.12 + (hash2(x, y, seed + 9) > 0.93 ? -0.18 : 0),
    );
  }
  // Mortar: joints between stones (below their lips) and the course line
  fb.add(
    (x, y) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      if (yi === botAt[xi] + 1) return true;
      const inStone = stones.some((s) => xi >= s.x0 && xi <= s.x1);
      if (inStone || yi > botAt[xi]) return false;
      const l = stones.find((s) => s.x1 === xi - 1);
      const r = stones.find((s) => s.x0 === xi + 1);
      const lipL = l ? l.lip[l.lip.length - 1] : 9;
      const lipR = r ? r.lip[0] : 9;
      return yi >= Math.min(lipL, lipR) + 1;
    },
    [0, 0, 1],
    M.mortar,
    1,
    [0, 0, 47, 15],
  );
  // Second course, sunk in shadow
  for (let k = 0; k + 1 < low.length; k++) {
    const a = low[k];
    const b = low[k + 1] - 1;
    const g = fb.group();
    fb.add(
      (x, y) => x >= a && x < b && y > botAt[Math.floor(x)] + 1,
      (x, y) => [x < a + 1 ? -0.6 : x >= b - 1 ? 0.6 : 0, (y - botAt[Math.floor(x)] - 2) * 0.12 - 0.25, 1],
      M.low,
      1.5,
      [Math.max(0, a), 8, Math.min(47, b), 15],
      g,
      (x, y) => (y === botAt[Math.floor(x)] + 2 ? 0.08 : -0.05),
    );
    if (b < 48) fb.add((x, y) => Math.floor(x) === b && y > botAt[b] + 1, [0, 0, 1], M.mortar, 1, [b, 8, b, 15]);
  }
  // Set-specific dressing
  const N = (x: number, y: number, sc: number, s2: number) => valueNoise(x, y, sc, seed + s2);
  const topMask = (x: number, y: number) => {
    const s = stones.find((q) => x >= q.x0 && x < q.x1 + 1);
    return !!s && y < s.lip[Math.floor(x) - s.x0] + 1;
  };
  if (set === 'marble' || set === 'rot') {
    // gilt inlay (rot: a row of teeth) along the front of some stones
    for (const s of stones) {
      if (!s.accent) continue;
      const yy = Math.max(...s.lip) + 2;
      fb.stain((x, y) => x > s.x0 + 2 && x < s.x1 - 1 && Math.floor(y) === yy && (set === 'marble' || Math.floor(x) % 2 === 0), M.accent, [M.front], set === 'rot' ? 0.1 : 0.05);
    }
    if (set === 'marble') fb.stain((x, y) => hash2(Math.floor(x), Math.floor(y), seed) > 0.8, GOLD, [M.mortar], -0.2);
    if (set === 'rot') {
      // blood weeping from the lip down the front
      fb.stain((x, y) => {
        const xi = Math.floor(x);
        if (hash2(xi, 0, seed + 3) < 0.84) return false;
        return y < 6 + hash2(xi, 1, seed) * 7;
      }, BLOOD, [M.front, M.top], 0.05);
    }
  } else if (set === 'crypt') {
    // bare stone patches on the mossy tops, moss creeping down the faces
    fb.stain((x, y) => topMask(x, y) && N(x, y, 3, 11) < 0.3, M.accent, [M.top]);
    fb.stain((x, y) => {
      const s = stones.find((q) => x >= q.x0 && x < q.x1 + 1);
      if (!s) return false;
      const l = s.lip[Math.floor(x) - s.x0];
      return y < l + 1 + Math.max(0, (N(x, 0, 1.5, 13) - 0.7) * 14);
    }, MOSS, [M.front], -0.05);
    fb.stain((x, y) => N(x, y, 2, 15) > 0.8, MOSS, [M.low], -0.15);
  } else {
    // cistern: brick front with a mid course joint, moss on some kerbs
    for (const s of stones) {
      const yj = Math.round((Math.max(...s.lip) + s.bot) / 2) + 1;
      if (s.bot - Math.max(...s.lip) >= 4) fb.stain((x, y) => x > s.x0 && x < s.x1 && Math.floor(y) === yj, M.mortar, [M.front]);
    }
    fb.stain((x, y) => topMask(x, y) && N(x, y, 3, 21) > 0.62, M.accent, [M.top]);
  }
  const pc = fb.render({ ...KEY_LIGHT, ambient: 0.14 }, INK, 0.14);
  fadeDown(pc, 11, 16);
  return finishSprite(pc, { outline: false, keepAlpha: true });
}

/** Darken and dissolve rows y0..y1 so the cap melts into the tile below. */
function fadeDown(pc: PixelCanvas, y0: number, y1: number) {
  const d = pc.data;
  for (let y = y0; y < pc.h; y++) {
    const t = Math.min(1, (y - y0 + 1) / (y1 - y0 + 1));
    for (let x = 0; x < pc.w; x++) {
      const p = (y * pc.w + x) * 4;
      if (!d[p + 3]) continue;
      const k = 1 - t * 0.55;
      d[p] *= k;
      d[p + 1] *= k;
      d[p + 2] *= k;
      d[p + 3] *= 1 - t * t * 0.95;
    }
  }
}

// =============================================================================
// B) Standing decals
// =============================================================================

/** A chunky rock: front plane, lit top plane, shadowed right flank. */
function rock(fb: Facets, cx: number, base: number, w: number, h: number, layer: number, seed: number, m = RUBBLE) {
  const R = rnd(seed);
  const td = Math.max(2, h * R.range(0.35, 0.5)); // visible top depth
  const tilt = R.range(-0.25, 0.25);
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const sk = R.range(-1, 1);
  const yt = base - h;
  const rot = (pts: [number, number][]) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(tilt) - (y - base) * Math.sin(tilt), base + (x - cx) * Math.sin(tilt) + (y - base) * Math.cos(tilt)] as [number, number]);
  const chip = R.range(0.5, 2);
  const flank = R.range(1.5, Math.max(2, w * 0.25));
  const g = fb.group();
  const bias = (x: number, y: number) => (hash2(Math.floor(x), Math.floor(y), seed) > 0.92 ? -0.15 : 0);
  // front
  fb.facet(rot([[x0, base], [x0 + sk, yt + td], [x1 - flank + sk, yt + td], [x1 - flank, base]]), [R.range(-0.15, 0.1), 0.05, 1], m, layer, g, bias);
  // top
  fb.facet(rot([[x0 + sk, yt + td + 0.5], [x0 + sk + chip, yt], [x1 - chip * 0.5 + sk, yt + R.range(-0.5, 1)], [x1 - flank + sk, yt + td + 0.5]]), [R.range(-0.2, 0.2), -0.95, 0.45], m, layer, g, bias);
  // right flank (away from the light)
  fb.facet(rot([[x1 - flank, base], [x1 - flank + sk, yt + td], [x1 - chip * 0.5 + sk, yt + R.range(-0.5, 1)], [x1, base - h * 0.3]]), [0.8, -0.1, 0.6], m, layer, g, bias);
}

function drawRubble(variant: number): PixelCanvas {
  const W = [24, 36, 48][variant];
  const H = [12, 16, 20][variant];
  const fb = new Facets(W, H);
  const R = rnd(700 + variant * 13);
  const n = [4, 7, 10][variant];
  // back row of big blocks, then smaller ones in front, pebbles last
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const big = i % 3 === 0;
    const w = big ? R.range(8, 12) : R.range(5, 8);
    const h = big ? R.range(5, H - 4) : R.range(3, 6);
    const cx = 3 + w / 2 + t * (W - 6 - w) + R.range(-2, 2);
    const mid = 1 - Math.abs(t - 0.5) * 2;
    const base = H - 1 - (big ? 0 : R.range(0, 2)) - mid * (big ? 0 : 1);
    rock(fb, cx, base, w, h * (0.6 + mid * 0.5), big ? 1 : 2 + R.f(), 700 + variant * 31 + i, big ? RUBBLE : RUBBLE_D);
  }
  for (let i = 0; i < n + 2; i++) {
    const cx = R.range(2, W - 2);
    rock(fb, cx, H - 0.5, R.range(2, 4), R.range(1.5, 2.6), 4, 900 + i * 7 + variant, RUBBLE);
  }
  return finishSprite(fb.render({ ...KEY_LIGHT, ambient: 0.15 }), { outline: false });
}

/** Skull facing left (look=-1) or right (1), roughly 2.2r wide. */
function skull(s: SF, cx: number, cy: number, r: number, layer: number, look = -1, tiltY = 0) {
  s.ellipse(cx, cy, r, r * 0.88, BONE, layer);
  s.ellipse(cx + look * r * 0.2, cy + r * 0.72 + tiltY, r * 0.66, r * 0.42, BONE, layer + 0.05);
  const ex = cx + look * r * 0.18;
  const er = Math.max(0.75, r * 0.26);
  s.ellipse(ex - r * 0.42, cy + r * 0.18, er, er * 1.05, VOID, layer + 0.1);
  s.ellipse(ex + r * 0.42, cy + r * 0.18, er, er * 1.05, VOID, layer + 0.1);
  if (r >= 3) s.ellipse(ex, cy + r * 0.62, 0.55, 0.7, VOID, layer + 0.1);
}

function bone(s: SF, ax: number, ay: number, bx: number, by: number, r: number, layer: number) {
  s.capsule(ax, ay, bx, by, r, r, BONE, layer);
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const px = -uy * r * 0.85;
  const py = ux * r * 0.85;
  for (const [x, y, sg] of [
    [ax, ay, -1],
    [bx, by, 1],
  ] as const) {
    s.ellipse(x + px + ux * sg * 0.3, y + py + uy * sg * 0.3, r * 1.15, r * 1.15, BONE, layer + 0.02);
    s.ellipse(x - px + ux * sg * 0.3, y - py + uy * sg * 0.3, r * 1.05, r * 1.05, BONE, layer + 0.02);
  }
}

function drawSkulls(variant: number): PixelCanvas {
  const W = variant ? 32 : 24;
  const H = variant ? 18 : 14;
  const s = new SF(W, H);
  const R = rnd(1300 + variant * 7);
  // bones underneath
  for (let i = 0; i < (variant ? 5 : 3); i++) {
    const y = H - 2 - R.range(0, 3);
    const x = R.range(4, W - 10);
    bone(s, x, y, x + R.range(6, 10), y + R.range(-2, 1.5), 0.8, 1 + i * 0.01);
  }
  // pyramid of skulls
  const rows = variant ? [4, 3, 1] : [3, 2];
  const r = variant ? 3.7 : 3.4;
  rows.forEach((cnt, row) => {
    const y = H - 1 - r * 1.25 - row * r * 1.55;
    for (let i = 0; i < cnt; i++) {
      const x = W / 2 + (i - (cnt - 1) / 2) * r * 2.05 + R.range(-0.8, 0.8);
      skull(s, x, y, r * R.range(0.92, 1.06), 2 + row + R.f() * 0.5, R.f() < 0.5 ? -1 : 1);
    }
  });
  // one skull tumbled to the side
  skull(s, variant ? W - 4.5 : 3.8, H - 3.7, 2.9, 6, 1);
  s.stain((x, y) => y > H - 3 && valueNoise(x, y, 2, 3) > 0.6, OLD_BLOOD, [BONE]);
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.16 }));
}

function drawBones(): PixelCanvas {
  const s = new SF(28, 7);
  bone(s, 3, 5, 12, 4.4, 0.85, 1);
  bone(s, 14, 5.5, 21, 3.8, 0.7, 1.2);
  // ribs
  for (let i = 0; i < 3; i++) s.capsule(17 + i * 2, 5.6, 19 + i * 2.2, 2.8, 0.5, 0.45, BONE, 0.9);
  skull(s, 24.6, 3.6, 2.6, 2, -1);
  bone(s, 9, 6, 13, 5.2, 0.55, 1.4);
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.16 }));
}

function drawCoffin(open: boolean): PixelCanvas {
  const W = 48;
  const H = 22;
  const fb = new Facets(W, H);
  const S = SLAB;
  const Sd: Material = { ...SLAB, ramp: SLAB.ramp.slice(0, 7) };
  const up: V3 = [0, -0.95, 0.4];
  const fr: V3 = [0, 0.02, 1];
  // plinth
  let g = fb.group();
  fb.facet([[1, 21.5], [1, 19], [47, 19], [47, 21.5]], fr, Sd, 1, g);
  fb.facet([[1.5, 19], [2.5, 17.5], [45.5, 17.5], [46.5, 19]], up, Sd, 1, g);
  // body: front with a carved panel and cross
  const bx0 = open ? 3 : 4;
  const bx1 = open ? 36 : 44;
  g = fb.group();
  fb.facet([[bx0, 18], [bx0, 9], [bx1, 9], [bx1, 18]], fr, S, 2, g);
  fb.facet([[bx0, 10], [bx0, 18], [bx0 + 1, 18], [bx0 + 1, 10]], [-0.7, 0, 0.7], S, 2.01, g);
  fb.facet([[bx1 - 1, 10], [bx1 - 1, 18], [bx1, 18], [bx1, 10]], [0.7, 0, 0.7], S, 2.01, g);
  const px0 = bx0 + 4;
  const px1 = bx1 - 4;
  fb.add((x, y) => x > px0 && x < px1 && y > 11 && y < 16.5, (x, y) => [x < px0 + 1.5 ? 0.6 : x > px1 - 1.5 ? -0.6 : 0, y < 12.5 ? 0.6 : y > 15.5 ? -0.6 : 0, 1], S, 2.1, [px0, 11, px1, 17], g, () => -0.12);
  const ccx = (px0 + px1) / 2;
  fb.add((x, y) => (Math.abs(x - ccx) < 1 && y > 12 && y < 16) || (Math.abs(y - 13.5) < 0.6 && Math.abs(x - ccx) < 2.6), [0, 0, 1], RECESS, 2.2, [ccx - 3, 12, ccx + 3, 16], g);
  // band moulding at the top of the body
  fb.facet([[bx0 - 0.5, 9.8], [bx0 - 0.5, 8.5], [bx1 + 0.5, 8.5], [bx1 + 0.5, 9.8]], [0, -0.35, 0.95], S, 2.3, g);
  if (!open) {
    // lid: thick slab with a low ridge
    g = fb.group();
    fb.facet([[2, 8.6], [2, 6], [46, 6], [46, 8.6]], fr, S, 3, g);
    fb.facet([[2.5, 6], [4, 3], [44, 3], [45.5, 6]], up, S, 3, g);
    fb.facet([[6, 3.4], [8, 1.6], [40, 1.6], [42, 3.4]], [0, -0.7, 0.7], S, 3.1, g);
    fb.stain((x, y) => y > 6 && y < 8 && hash2(Math.floor(x), 0, 5) > 0.8, RECESS, [S]);
  } else {
    // dark cavity seen from above
    fb.facet([[bx0 + 0.5, 8.6], [bx0 + 1.5, 6.6], [bx1 - 1.5, 6.6], [bx1 - 0.5, 8.6]], up, S, 2.4, g);
    fb.facet([[bx0 + 2, 8.4], [bx0 + 2.6, 7.4], [bx1 - 2.6, 7.4], [bx1 - 2, 8.4]], [0, 0, 1], RECESS, 2.5, g);
    // lid slid aside, resting tilted on the far end and the floor
    g = fb.group();
    const a = 0.2;
    const lid = (pts: [number, number][]) => pts.map(([x, y]) => [30 + (x - 30) * Math.cos(a) - (y - 6) * Math.sin(a), 6 + (x - 30) * Math.sin(a) + (y - 6) * Math.cos(a)] as [number, number]);
    fb.facet(lid([[22, 8.6], [22, 5.6], [49, 5.6], [49, 8.6]]), fr, S, 4, g);
    fb.facet(lid([[22.5, 5.6], [24, 3], [47.5, 3], [49, 5.6]]), up, S, 4, g);
  }
  // cracks and grime
  fb.stain((x, y) => Math.abs(valueNoise(x, y, 4, 61) - 0.5) < 0.025 && y > 9, RECESS, [S]);
  fb.stain((x, y) => y > 15 && valueNoise(x, y, 3, 63) > 0.62, MOSS, [S, Sd], -0.25);
  let pc = fb.render({ ...KEY_LIGHT, ambient: 0.15 }, null);
  if (open) {
    // the occupant: a skull at the head end, an arm hanging over the rim
    const s = new SF(W, H);
    skull(s, bx0 + 6, 6.2, 2.8, 2, 1, -0.3);
    bone(s, bx0 + 13, 7.5, bx0 + 16, 9.5, 0.7, 3);
    bone(s, bx0 + 16, 9.5, bx0 + 15.4, 14.5, 0.6, 3.1);
    for (let i = 0; i < 4; i++) s.capsule(bx0 + 14 + i * 0.8, 14.8, bx0 + 13.6 + i * 0.9, 17 - (i % 2) * 0.5, 0.42, 0.38, BONE, 3.2);
    s.capsule(bx0 + 10, 7.6, bx0 + 13, 7.4, 1.2, 1, { ...OLD_BLOOD, ramp: ['#120a08', '#2a1e16', '#43342a', '#5e4c3c'] }, 2.6);
    pc = over(pc, s.render({ ...KEY_LIGHT, ambient: 0.16 }));
  }
  return finishSprite(pc);
}

/** Fluted cylinder normal at x for a shaft centred on cx with radius r. */
const cyl = (cx: number, r: number, flutes = 0) => (x: number): V3 => {
  let u = (x + 0.5 - cx) / r;
  u = Math.max(-0.97, Math.min(0.97, u));
  if (flutes) u += Math.sin((x + 0.5 - cx) * flutes) * 0.35;
  return [u, 0, Math.sqrt(Math.max(0.05, 1 - u * u))];
};

function drawBrokenColumn(): PixelCanvas {
  const W = 24;
  const H = 48;
  const fb = new Facets(W, H);
  const S = SLAB;
  const cx = 10;
  // plinth and torus
  let g = fb.group();
  fb.facet([[1, 47.5], [1, 43], [20, 43], [20, 47.5]], [0, 0.02, 1], S, 1, g);
  fb.facet([[1.5, 43], [2.5, 41.5], [18.5, 41.5], [19.5, 43]], [0, -0.95, 0.4], S, 1, g);
  fb.add((x, y) => Math.abs(x - cx - 0.5) < 7.5 && y > 38.5 && y < 41.8, (x, y) => { const n = cyl(cx + 0.5, 7.5)(x); return [n[0], (y - 40.2) * 0.45, n[2]]; }, S, 1.5, [2, 38, 19, 42], g);
  // shaft with a broken, jagged top
  const topY = (x: number) => 11 + Math.abs(x - 7) * 0.9 + (hash2(Math.floor(x), 0, 9) - 0.5) * 3 + (x > 12 ? 5 : 0);
  g = fb.group();
  fb.add((x, y) => Math.abs(x - cx - 0.5) < 5.6 && y > topY(x) + 2 && y < 39, cyl(cx + 0.5, 5.6), S, 2, [4, 8, 17, 39], g);
  fb.add((x, y) => Math.abs(x - cx - 0.5) < 5.6 && y > topY(x) && y <= topY(x) + 2, (x) => [cyl(cx + 0.5, 5.6)(x)[0] * 0.5, -0.9, 0.5], S, 2, [4, 6, 17, 22], g, () => 0.05);
  fb.stain((x, y) => y > topY(x) + 2.5 && y < 38.5 && [6, 9, 12, 15].includes(Math.floor(x)), { ...S, ramp: S.ramp.slice(0, 5) }, [S], -0.08);
  fb.stain((x, y) => y > 30 && valueNoise(x, y, 2.5, 5) > 0.58, MOSS, [S], -0.2);
  fb.stain((x, y) => Math.abs(valueNoise(x, y, 4, 8) - 0.5) < 0.03, RECESS, [S]);
  // fallen capital chunk at the foot, plus fragments
  g = fb.group();
  fb.facet([[13, 47.5], [13.5, 41.5], [22, 40.5], [23.5, 47.5]], [0.1, 0.02, 1], S, 3, g);
  fb.facet([[13.5, 41.6], [15, 39], [22.5, 38.6], [22, 40.6]], [-0.1, -0.95, 0.4], S, 3, g);
  fb.stain((x, y) => x > 14 && x < 23 && y > 42.5 && y < 44 && Math.floor(x) % 3 !== 0, RECESS, [S]);
  fb.stain((x, y) => x > 15 && x < 22 && Math.floor(y) === 45 && Math.floor(x) % 2 === 0, RECESS, [S]);
  rock(fb, 4, 47.5, 4, 2.5, 4, 77, RUBBLE);
  rock(fb, 12.5, 47.5, 3, 2, 4, 78, RUBBLE);
  return finishSprite(fb.render({ ...KEY_LIGHT, ambient: 0.15 }), { outline: false });
}

function drawStatue(): PixelCanvas {
  const W = 32;
  const H = 80;
  const fb = new Facets(W, H);
  const up: V3 = [0, -0.95, 0.4];
  // plinth: base step, die with a recessed panel, cornice
  let g = fb.group();
  fb.facet([[1, 79.5], [1, 75], [31, 75], [31, 79.5]], [0, 0.02, 1], SLAB_MARBLE, 1, g);
  fb.facet([[1.5, 75], [2.5, 73.6], [29.5, 73.6], [30.5, 75]], up, SLAB_MARBLE, 1, g);
  g = fb.group();
  fb.facet([[4, 74], [4, 63], [28, 63], [28, 74]], [0, 0.02, 1], SLAB_MARBLE, 2, g);
  fb.add((x, y) => x > 7 && x < 25 && y > 64.5 && y < 72, (x, y) => [x < 8.5 ? 0.6 : x > 23.5 ? -0.6 : 0, y < 65.5 ? 0.6 : y > 71 ? -0.6 : 0, 1], SLAB_MARBLE, 2.1, [7, 64, 25, 72], g, () => -0.1);
  fb.add((x, y) => Math.hypot(x - 16, y - 68.2) < 2.6 && Math.hypot(x - 16, y - 68.2) > 1.2, [0, 0, 1], GOLD, 2.2, [13, 65, 19, 71], g);
  g = fb.group();
  fb.facet([[2.5, 63], [2.5, 60.5], [29.5, 60.5], [29.5, 63]], [0, -0.3, 0.95], SLAB_MARBLE, 3, g);
  fb.facet([[3, 60.5], [4.5, 58.8], [27.5, 58.8], [29, 60.5]], up, SLAB_MARBLE, 3, g);
  fb.stain((x, y) => y > 70 && valueNoise(x, y, 3, 4) > 0.6, MOSS, [SLAB_MARBLE], -0.2);
  const base = fb.render({ ...KEY_LIGHT, ambient: 0.15 }, null);
  // the hooded penitent, carved in marble
  const s = new SF(W, H);
  const robe: Material = { ...MARBLE, tex: (x, y) => folds(1.7, 0.36, 7)(x, y) + (MARBLE.tex ? MARBLE.tex(x, y) : 0), round: 0.7 };
  const hood: Material = { ...MARBLE, tex: folds(1.6, 0.16, 3), round: 0.85 };
  s.poly([[9, 26], [23, 26], [26, 44], [27.5, 59.5], [4.5, 59.5], [6, 44]], robe, 2);
  // trailing hem folds on the plinth
  s.ellipse(16, 59, 11.8, 1.8, robe, 2.1);
  // hood: tall cowl falling over the shoulders, head bowed to the left
  s.poly([[14, 2.5], [18.5, 8], [23.5, 17], [25, 30], [7, 30], [8.5, 17], [11, 8]], hood, 3);
  s.ellipse(15, 15, 5.4, 6, hood, 3.2, -0.15);
  s.poly([[12.2, 12], [15.2, 12.6], [15.4, 21], [11.2, 21.5], [10.6, 16]], VOID, 3.4);
  s.ellipse(13.4, 20.2, 1.5, 1, { ...MARBLE, ramp: MARBLE.ramp.slice(1, 5) }, 3.45);
  // arms folded over a book held at the chest
  s.capsule(9.5, 31, 14, 38, 2.6, 2.3, robe, 4);
  s.capsule(22.5, 31, 18, 38, 2.6, 2.3, robe, 4);
  s.poly([[12, 36], [20, 35], [21, 41], [13, 42]], { ...MARBLE, ramp: MARBLE.ramp.slice(1) }, 4.5);
  s.capsule(13, 39, 19.5, 38.2, 1.4, 1.4, MARBLE, 4.6);
  s.capsule(16, 41, 16, 47, 0.6, 0.6, GOLD, 4.7);
  s.capsule(14.2, 43, 17.8, 43, 0.55, 0.55, GOLD, 4.7);
  // deep vertical folds in the robe
  for (const [xa, xb] of [[10, 8.5], [13.2, 12.5], [18.8, 19.5], [22, 23.5]] as const)
    s.stain((x, y) => y > 44 && y < 59 && Math.abs(x - (xa + ((xb - xa) * (y - 44)) / 15)) < 0.55, { ...MARBLE, ramp: MARBLE.ramp.slice(0, 4) }, [robe]);
  // grime and weeping stains
  s.stain((x, y) => y > 46 && valueNoise(x, y, 2.5, 21) > 0.68, { ...MARBLE, ramp: MARBLE.ramp.slice(0, 5) }, [robe]);
  s.stain((x, y) => Math.abs(x - 12.4 - Math.sin(y * 0.6) * 0.4) < 0.6 && y > 18 && y < 30, OLD_BLOOD, [hood, MARBLE]);
  return finishSprite(over(base, s.render({ ...KEY_LIGHT, ambient: 0.2 })));
}

function chain(s: SF, x: number, y0: number, y1: number, layer: number) {
  const LINK: Material = { ...IRON, round: 1 };
  let k = 0;
  for (let y = y0; y < y1 - 1; y += 2.5, k++) {
    if (k % 2 === 0) s.add((px, py) => { const d = ((px - x) / 1.3) ** 2 + ((py - y - 1.5) / 1.9) ** 2; return d <= 1 && d >= 0.25; }, LINK, layer, [x - 2, y, x + 2, y + 4]);
    else s.capsule(x, y + 0.2, x, y + 2.8, 0.55, 0.55, LINK, layer + 0.1);
  }
}

function drawLamppost(): PixelCanvas {
  const W = 16;
  const H = 64;
  const s = new SF(W, H);
  const I: Material = { ...IRON, spec: 0.6 };
  // stepped base
  s.rect(3, 59, 13, 64, I, 1);
  s.rect(4.5, 56, 11.5, 59.5, I, 1.2);
  s.ellipse(8, 55.5, 3.8, 1.2, I, 1.4);
  // shaft with collars
  s.capsule(8, 55, 8, 14, 1.25, 0.95, I, 2);
  for (const y of [46, 34, 22]) s.ellipse(8, y, 2.1, 0.9, I, 2.2);
  // scroll brackets under the lamp
  for (const sg of [-1, 1]) {
    s.capsule(8, 22, 8 + sg * 4, 18, 0.55, 0.55, I, 2.1);
    s.capsule(8 + sg * 4, 18, 8 + sg * 5, 15, 0.55, 0.55, I, 2.1);
    s.ellipse(8 + sg * 4.4, 15.2, 1, 1, I, 2.1);
  }
  // lamp head: collar, glass, roof, finial
  s.ellipse(8, 13.6, 3.2, 1, I, 3);
  s.poly([[5, 13], [4.2, 6.5], [11.8, 6.5], [11, 13]], GLASS, 2.8);
  for (const x of [4.6, 8, 11.4]) s.capsule(x, 6.6, x + (x < 8 ? 0.4 : x > 8 ? -0.4 : 0), 13, 0.45, 0.45, I, 3);
  s.poly([[3, 6.8], [8, 2.6], [13, 6.8]], I, 3.1);
  s.capsule(8, 3, 8, 0.6, 0.6, 0.5, I, 3.2);
  const pc = s.render({ ...KEY_LIGHT, ambient: 0.16 });
  haze(pc, P(8), P(10), 5, '#ffb050', 0.42);
  return finishSprite(pc, { paint: (pc) => flame(pc, P(8), P(11), 2, 0, false) });
}

function drawUrn(): PixelCanvas {
  const s = new SF(16, 20);
  const V = VERDIGRIS;
  s.ellipse(8, 18.4, 3.6, 1.4, V, 1);
  s.capsule(8, 17.2, 8, 15.8, 1.4, 1.6, V, 1.1);
  s.ellipse(8, 11.4, 5.6, 4.8, V, 2);
  s.capsule(8, 7, 8, 5.6, 2.2, 2.6, V, 2.1);
  s.ellipse(8, 5, 3.6, 1.1, GOLD, 2.3);
  s.ellipse(8, 3.6, 2.4, 1.4, V, 2.2);
  s.ellipse(8, 1.6, 0.9, 0.9, GOLD, 2.4);
  // handles
  for (const sg of [-1, 1]) s.add((x, y) => { const d = Math.hypot((x - 8 - sg * 5.6) / 1.6, (y - 9.6) / 2.1); return d < 1 && d > 0.45; }, GOLD, 1.9, [8 + sg * 5.6 - 2, 7, 8 + sg * 5.6 + 2, 12.5]);
  // gilt band and studs
  s.stain((x, y) => Math.abs(y - 11.6) < 0.7, GOLD, [V]);
  s.stain((x, y) => Math.abs(y - 14) < 0.5 && Math.floor(x) % 2 === 0, GOLD, [V]);
  s.stain((x, y) => Math.hypot(x - 8, y - 9.2) < 1, { ...BLOOD, ramp: ['#1a0206', '#5a0a16', '#b0182a', '#ff6a50'] }, [V]);
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.16 }));
}

function drawCandles(): PixelCanvas {
  const W = 20;
  const H = 16;
  const s = new SF(W, H);
  s.ellipse(10, 14.6, 9.2, 1.6, WAX_PALE, 1);
  const C: [number, number, number][] = [
    [3.5, 10.5, 1],
    [6.5, 6, 1.25],
    [10, 8.5, 1.15],
    [13.2, 4.5, 1.35],
    [16.5, 9.5, 1.05],
  ];
  C.forEach(([x, top, r], i) => {
    s.capsule(x, 14.2, x, top, r * 1.2, r, WAX_PALE, 2 + (i % 2) * 0.2);
    s.ellipse(x + 0.4, 14.3, r * 1.8, 0.9, WAX_PALE, 1.5);
  });
  s.stain((x, y) => hash2(Math.floor(x), 3, 4) > 0.55 && y > 7 && y < 7 + hash2(Math.floor(x), 5, 4) * 6 && valueNoise(x, y, 1.5, 3) > 0.4, WAX, [WAX_PALE]);
  const pc = s.render({ ...KEY_LIGHT, ambient: 0.2 });
  haze(pc, P(10), P(5), 6, '#ffb050', 0.3);
  return finishSprite(pc, {
    paint: (pc) =>
      C.forEach(([x, top], i) => {
        if (i === 4) return; // one guttered out
        flame(pc, P(x), P(top) - 1, 2, i, false);
      }),
  });
}

function drawBloodPool(): PixelCanvas {
  const W = 25;
  const H = 3;
  const pc = new PixelCanvas(W, H);
  const RAMP = ['#140104', '#2a0208', '#3e0610', '#560a16', '#7a0c1c'];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const ex = (x + 0.5 - W / 2) / (W / 2 - 0.5 - (valueNoise(x, y, 2.5, 3) - 0.5) * 4);
      const ey = (y + 0.5 - H + 0.3) / (H - 0.4 + (valueNoise(x, 0, 2, 5) - 0.5) * 1.2);
      const d = ex * ex + ey * ey;
      if (d > 1 && !(y === H - 1 && Math.abs(ex) < 1.08)) continue;
      const v = 0.25 + (1 - d) * 0.5;
      pc.px(x, y, RAMP[Math.max(1, Math.min(4, Math.round(v * 4)))]);
    }
  // wet highlights catching the key light
  for (const [x, y] of [[8, 1], [9, 1], [15, 1], [16, 1]] as const) if (pc.alphaAt(x, y)) pc.px(x, y, '#c43a3a');
  pc.px(9, 1, '#ff8a70');
  return pc;
}

// =============================================================================
// C) Hanging decals
// =============================================================================

/** A two-faced spike hanging from (x, y0) down to y0 + len (lit left face). */
function spike(fb: Facets, x: number, y0: number, w: number, len: number, m: Material, layer: number, bend = 0) {
  const g = fb.group();
  const tip: [number, number] = [x + bend, y0 + len];
  fb.facet([[x - w / 2, y0], [x, y0], tip], [-0.65, 0.15, 0.75], m, layer, g);
  fb.facet([[x, y0], [x + w / 2, y0], tip], [0.65, 0.15, 0.75], m, layer, g, () => -0.05);
}

function drawIcicles(variant: number): PixelCanvas {
  const W = [16, 24, 32][variant];
  const H = [14, 22, 28][variant];
  const fb = new Facets(W, H);
  const R = rnd(2100 + variant * 17);
  // frost crust along the attachment line
  fb.add((x, y) => y < 2 + valueNoise(x, 0, 2, 2100 + variant) * 2.2, (x, y) => [0, y < 1 ? -0.2 : 0.5, 1], ICE, 1, [0, 0, W - 1, 4], undefined, () => -0.08);
  const n = [3, 5, 6][variant];
  for (let i = 0; i < n; i++) {
    const x = 2 + ((i + 0.5) / n) * (W - 4) + R.range(-1.2, 1.2);
    const big = i === Math.floor(n / 2) || R.f() < 0.3;
    const len = big ? R.range(H * 0.7, H - 2) : R.range(H * 0.3, H * 0.6);
    spike(fb, x, 1, big ? R.range(3.5, 5) : R.range(2.2, 3.4), len, ICE, 2 + R.f(), R.range(-0.6, 0.6));
  }
  const pc = fb.render({ ...KEY_LIGHT, ambient: 0.2 }, '#06080c', 0);
  snesifyKeep(pc);
  // translucent ice: let the deepest tones show what's behind (half transparency)
  const d = pc.data;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] && d[i] + d[i + 1] + d[i + 2] < 150) d[i + 3] = 192;
  // a falling drop under the tallest spike
  const dx = Math.round(pc.w / 2);
  const ph = pc.h;
  if (H > 16 && !pc.alphaAt(dx, ph - 2)) {
    pc.px(dx, ph - 2, '#8cc4cc');
  }
  return pc;
}

function drawWaxDrips(variant: number): PixelCanvas {
  const W = [16, 24, 32][variant];
  const H = [10, 14, 18][variant];
  const s = new SF(W, H);
  const R = rnd(2500 + variant * 11);
  const M: Material = { ...WAX_PALE, ramp: ['#2a2224', '#4a4044', '#6e6266', '#948884', '#b8aca2', '#d4c8ba'], spec: 0.45 };
  s.capsule(0.5, 0.8, W - 0.5, 0.8, 1.1, 1.1, M, 1);
  for (let x = 1.5; x < W - 1; x += R.range(3, 6)) {
    const len = R.f() < 0.3 ? R.range(H * 0.6, H - 2.5) : R.range(2, H * 0.5);
    const r = R.range(0.5, 0.8);
    s.capsule(x, 1, x, len, r * 1.2, r * 0.8, M, 2);
    s.ellipse(x, len + 0.5, r * 1.15, r * 1.3, M, 2.1);
  }
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.15 }));
}

function drawBloodDrips(variant: number): PixelCanvas {
  const W = [16, 24, 32][variant];
  const H = [16, 22, 28][variant];
  const s = new SF(W, H);
  const R = rnd(2900 + variant * 13);
  // lumpy flesh crust
  for (let x = 1; x < W; x += R.range(2.5, 4)) s.ellipse(x, 1.2, R.range(1.8, 2.8), R.range(1.4, 2.4), FLESH_LUMP, 1);
  // a sagging sinew strand
  if (variant > 0) {
    const a = 3;
    const b = W - 5;
    const sag = H * 0.45;
    for (let i = 0; i < 12; i++) {
      const t0 = i / 12;
      const t1 = (i + 1) / 12;
      const y = (t: number) => 2 + Math.sin(t * Math.PI) * sag;
      s.capsule(a + (b - a) * t0, y(t0), a + (b - a) * t1, y(t1), 0.6, 0.6, { ...FLESH, ramp: FLESH.ramp.slice(0, 5) }, 1.5);
    }
  }
  // blood drips with heavy beads
  for (let x = 2; x < W - 1; x += R.range(3, 6)) {
    const len = R.range(3, H - 3);
    s.capsule(x, 1.5, x + R.range(-0.4, 0.4), len, 0.75, 0.55, BLOOD, 2);
    s.ellipse(x, len + 0.8, 1.05, 1.3, BLOOD, 2.1);
  }
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.16 }), {
    paint: (pc) => {
      const dx = Math.round(pc.w * 0.6);
      if (!pc.alphaAt(dx, pc.h - 1)) pc.px(dx, pc.h - 1, '#a8122a');
    },
  });
}

function drawLantern(): PixelCanvas {
  const W = 16;
  const H = 48;
  const s = new SF(W, H);
  const I: Material = { ...IRON, spec: 0.6 };
  chain(s, 8, 0, 25, 1);
  s.ellipse(8, 25.8, 1.6, 1.2, I, 2);
  // roof
  s.poly([[3.5, 31], [8, 26.5], [12.5, 31]], I, 2.5);
  s.capsule(3, 31.2, 13, 31.2, 0.9, 0.9, I, 2.6);
  // glass body with iron frame
  s.poly([[4, 32], [12, 32], [11.2, 41], [4.8, 41]], GLASS, 2);
  for (const x of [4.3, 8, 11.7]) s.capsule(x, 32, x + (x < 8 ? 0.4 : x > 8 ? -0.4 : 0), 41, 0.45, 0.45, I, 2.7);
  s.capsule(4.4, 41.4, 11.6, 41.4, 0.9, 0.9, I, 2.6);
  s.poly([[5, 42], [11, 42], [8, 46]], I, 2.5);
  s.ellipse(8, 46.6, 0.9, 0.9, BRASS, 2.6);
  const pc = s.render({ ...KEY_LIGHT, ambient: 0.16 });
  haze(pc, P(8), P(37), 5, '#ffb050', 0.45);
  return finishSprite(pc, { paint: (pc) => flame(pc, P(8), P(39), 2, 1, false) });
}

function drawCenserHang(): PixelCanvas {
  const W = 20;
  const H = 40;
  const s = new SF(W, H);
  const I: Material = { ...IRON, spec: 0.6 };
  chain(s, 10, 0, 16, 1);
  s.ellipse(10, 16.5, 1.5, 1.1, I, 2);
  // three-strand bridle down to the rim
  for (const ex of [3.5, 10, 16.5]) s.capsule(10, 17, ex, 24, 0.4, 0.4, I, 1.5);
  s.capsule(3, 24.5, 17, 24.5, 1, 1, I, 2.5);
  // pierced cage bowl with embers glowing through
  s.ellipse(10, 29.5, 6.6, 5.6, EMBER, 1.8);
  s.add((x, y) => {
    const d = Math.hypot((x - 10) / 6.8, (y - 29.5) / 5.8);
    if (d > 1 || y < 25) return false;
    const a = Math.atan2(y - 29.5, x - 10);
    return Math.abs(Math.sin(a * 4 + 0.4)) > 0.78 || y > 33.2 || Math.abs(y - 28.4) < 0.7;
  }, I, 2.2, [3, 24, 17, 36]);
  s.poly([[8, 35], [12, 35], [10, 38.5]], I, 2.3);
  s.ellipse(10, 39, 0.9, 0.9, BRASS, 2.4);
  const pc = s.render({ ...KEY_LIGHT, ambient: 0.16 });
  haze(pc, P(10), P(29), 6, '#ff8a3a', 0.32);
  return finishSprite(pc, {
    paint: (pc) => {
      // smoke curling out of the top
      for (let i = 0; i < 5; i++) {
        const xx = P(10) + Math.round(Math.sin(i * 1.1) * 1);
        if (hash2(i, 3, 11) < 0.75 && !pc.alphaAt(xx, P(23) - i)) pc.px(xx, P(23) - i, '#8f877c');
      }
    },
  });
}

function drawStalactites(): PixelCanvas {
  const W = 32;
  const H = 24;
  const fb = new Facets(W, H);
  const R = rnd(3700);
  const ROCK: Material = { ...RUBBLE, ramp: ['#08070a', '#16131a', '#26212a', '#383038', '#4e444a', '#685c60', '#887a78', '#a89a8e', '#ccbea6'] };
  // rocky band along the ceiling
  fb.add((x, y) => y < 4 + valueNoise(x, 0, 3, 37) * 3, (x, y) => [(valueNoise(x, y, 2, 3) - 0.5) * 1.2, 0.5, 1], ROCK, 1, [0, 0, W - 1, 6], undefined, () => -0.12);
  const spikes: [number, number, number][] = [
    [3.5, 6, 13],
    [8.5, 4.5, 8],
    [14.5, 8, 21],
    [20.5, 6, 15],
    [25, 4, 9],
    [29, 5.5, 12],
  ];
  for (const [x, w, len] of spikes) spike(fb, x + R.range(-0.5, 0.5), 2.5, w, len + R.range(-1, 1), ROCK, 2 + R.f(), R.range(-0.8, 0.8));
  // pale mineral tips
  fb.stain((x, y) => y > 7 + valueNoise(x, 0, 2, 5) * 5, { ...ROCK, ramp: ['#1a1610', '#3e3626', '#6a5e44', '#9a8c66', '#c8b88a', '#ece0b6'] }, [ROCK], 0.06);
  return finishSprite(fb.render({ ...KEY_LIGHT, ambient: 0.22 }), { outline: false });
}

// =============================================================================
// D) Corner cobwebs
// =============================================================================

function lineA0(pc: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: string, a: number) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  let lx = -99;
  let ly = -99;
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n);
    const y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (x === lx && y === ly) continue;
    lx = x;
    ly = y;
    if (pc.alphaAt(x, y) < a * 255) pc.px(x, y, c, a);
  }
}

function drawWeb(): PixelCanvas {
  // authored on the old 24 px grid, plotted at SC (15x15)
  const S = 15;
  const pc = new PixelCanvas(S, S);
  const lineA = (p: PixelCanvas, x0: number, y0: number, x1: number, y1: number, c: string, a: number) => lineA0(p, x0 * SC, y0 * SC, x1 * SC, y1 * SC, c, Math.min(0.6, a * 1.25));
  const R = rnd(4100);
  const angs = [0.1, 0.45, 0.82, 1.15, 1.47].map((a) => a + R.range(-0.06, 0.06));
  const lens = angs.map((_, i) => (i === 0 || i === angs.length - 1 ? 23.5 : R.range(17, 23)));
  const C = '#c8c0bc';
  // concentric sagging spiral threads
  for (const r of [4.5, 9, 13.5, 18.5]) {
    for (let i = 0; i + 1 < angs.length; i++) {
      const ra = Math.min(r * R.range(0.92, 1.08), lens[i]);
      const rb = Math.min(r * R.range(0.92, 1.08), lens[i + 1]);
      if (ra > lens[i] - 0.5 || rb > lens[i + 1] - 0.5) continue;
      const ax = Math.cos(angs[i]) * ra;
      const ay = Math.sin(angs[i]) * ra;
      const bx = Math.cos(angs[i + 1]) * rb;
      const by = Math.sin(angs[i + 1]) * rb;
      const sag = r * 0.12;
      const steps = 6;
      for (let k = 0; k < steps; k++) {
        const t0 = k / steps;
        const t1 = (k + 1) / steps;
        const p = (t: number): [number, number] => [ax + (bx - ax) * t + Math.sin(t * Math.PI) * sag * 0.4, ay + (by - ay) * t + Math.sin(t * Math.PI) * sag];
        const [x0, y0] = p(t0);
        const [x1, y1] = p(t1);
        lineA(pc, x0, y0, x1, y1, C, 0.22 + (1 - r / 24) * 0.18);
      }
    }
  }
  // radial anchor threads
  angs.forEach((a, i) => lineA(pc, 0, 0, Math.cos(a) * lens[i], Math.sin(a) * lens[i], '#ddd6d0', 0.42));
  // a torn strand hanging free, and dust packed into the corner
  lineA(pc, 13, 8, 13.5, 16, C, 0.28);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x + y < 3 && hash2(x, y, 9) > 0.4) pc.px(x, y, '#a8a09a', 0.3);
  return pc;
}

function mirror(src: PixelCanvas): PixelCanvas {
  const pc = new PixelCanvas(src.w, src.h);
  pc.blit(src, 0, 0, true);
  return pc;
}

// =============================================================================
// E) Ink-brush frame
// =============================================================================

const INK_FRAME = '#070304';

/**
 * Torn dry-brush edge along the top of an L x D strip (outer edge at y = 0),
 * periodic in x with period L.
 */
function inkStrip(L: number, D: number, seed: number): PixelCanvas {
  const pc = new PixelCanvas(L, D);
  const R = rnd(seed);
  const edge = new Float32Array(L);
  for (let x = 0; x < L; x++)
    edge[x] = 5 + pnoise(x, 0, 70, seed, L) * 5 + pnoise(x, 3, 15, seed + 1, L) * 3.2 + (pnoise(x, 7, 4, seed + 2, L) - 0.5) * 1.6;
  const solid = new Uint8Array(L * D);
  for (let y = 0; y < D; y++)
    for (let x = 0; x < L; x++) if (y < edge[x] + (pnoise(x, y, 2, seed + 9, L) - 0.5) * 1.6) solid[y * L + x] = 1;
  // dry-brush bristle streaks dragged along the edge, breaking up as they run dry
  const strokes = Math.round(L / 8);
  for (let s = 0; s < strokes; s++) {
    const xs = R.int(0, L - 1);
    const len = R.range(12, 84) * (R.f() < 0.25 ? 1.6 : 1);
    const dir = R.f() < 0.5 ? -1 : 1;
    const y0 = edge[xs] + R.range(-1.3, 3);
    const slope = R.range(-0.035, 0.035);
    const th = R.f() < 0.3 ? 2 : 1;
    const bristle = R.range(0, 100);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = (((xs + dir * i) % L) + L) % L;
      const yy = y0 + slope * i + Math.sin(i * 0.08 + bristle) * 0.6;
      for (let k = 0; k < th; k++) {
        const y = Math.round(yy + k);
        if (y < 0 || y >= D) continue;
        // bristle gaps get longer towards the tail
        if (pnoise(i, (y + bristle) * 7, 9, seed + 5) < t * 0.8 + 0.08) continue;
        solid[y * L + x] = 1;
      }
    }
  }
  // flecks and spatter
  for (let s = 0; s < L / 14; s++) {
    const x = R.int(0, L - 1);
    const y = Math.round(edge[x] + R.range(1, 8));
    if (y >= D) continue;
    solid[y * L + x] = 1;
    if (R.f() < 0.4) solid[y * L + ((x + 1) % L)] = 1;
  }
  const [r, g, b] = rgbOf(INK_FRAME);
  const d = pc.data;
  for (let i = 0; i < L * D; i++) {
    if (!solid[i]) continue;
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  return pc;
}

function flipV(src: PixelCanvas): PixelCanvas {
  const pc = new PixelCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) pc.data.set(src.data.subarray((src.h - 1 - y) * src.w * 4, (src.h - y) * src.w * 4), y * src.w * 4);
  return pc;
}

function transpose(src: PixelCanvas): PixelCanvas {
  const pc = new PixelCanvas(src.h, src.w);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const o = (x * pc.w + y) * 4;
      pc.data[o] = src.data[i];
      pc.data[o + 1] = src.data[i + 1];
      pc.data[o + 2] = src.data[i + 2];
      pc.data[o + 3] = src.data[i + 3];
    }
  return pc;
}

// =============================================================================
// Registration
// =============================================================================

/** Every dressing texture by key (exposed for the art labs). */
export function drawDressing(): Map<string, PixelCanvas> {
  const out = new Map<string, PixelCanvas>();
  for (const set of CAP_SETS) for (let i = 0; i < CAP_VARIANTS; i++) out.set(`cap-${set}-${i}`, drawCap(set, i));
  for (let i = 0; i < 3; i++) out.set(`deco-rubble-${i}`, drawRubble(i));
  out.set('deco-skulls-0', drawSkulls(0));
  out.set('deco-skulls-1', drawSkulls(1));
  out.set('deco-bones', drawBones());
  out.set('deco-coffin', drawCoffin(false));
  out.set('deco-coffin-open', drawCoffin(true));
  out.set('deco-column-broken', drawBrokenColumn());
  out.set('deco-statue', drawStatue());
  out.set('deco-lamppost', drawLamppost());
  out.set('deco-urn', drawUrn());
  out.set('deco-candles', drawCandles());
  out.set('deco-bloodpool', drawBloodPool());
  for (let i = 0; i < 3; i++) {
    out.set(`drips-crypt-${i}`, drawIcicles(i));
    out.set(`drips-marble-${i}`, drawWaxDrips(i));
    out.set(`drips-rot-${i}`, drawBloodDrips(i));
  }
  out.set('deco-lantern', drawLantern());
  out.set('deco-censer-hang', drawCenserHang());
  out.set('deco-stalactites', drawStalactites());
  const web = drawWeb();
  out.set('web-l', web);
  out.set('web-r', mirror(web));
  out.set('ink-top', inkStrip(512, 18, 5100));
  out.set('ink-bottom', flipV(inkStrip(512, 18, 5200)));
  out.set('ink-side', transpose(inkStrip(224, 18, 5300)));
  return out;
}

export function buildDressing(scene: Phaser.Scene) {
  for (const [key, pc] of drawDressing()) registerImage(scene, key, pc);
}
