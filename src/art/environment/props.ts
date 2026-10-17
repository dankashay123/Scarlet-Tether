import { PixelCanvas, hash2, valueNoise } from '../pixel';
import { Figure, KEY_LIGHT, folds, grain, type Light, type Material } from '../render';
import { inGothic } from './paint';
import { finishSprite, reduce2 } from './snes-env';

/**
 * Props for the SNES screen (224 px tall, ~40 px hero): every prop is authored
 * in its old 360 px coordinates and drawn at SC = 0.625 of that size. Shapes
 * are rasterised at twice the target resolution and box-reduced (which turns
 * the renderer's ordered dither into flat tone), then given a selective
 * outline and quantised to a 15-colour SNES sprite palette.
 */
export const SC = 0.625;

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

const vgrain = (amt: number, seed: number) => (x: number, y: number) =>
  (valueNoise(x * 3, y * 0.4, 2, seed) - 0.5) * amt + (Math.sin(x * 1.3 + valueNoise(x, y, 6, seed + 1) * 4) * amt) / 3;

export const MAHOGANY: Material = { ramp: ['#120605', '#2a110c', '#46201a', '#6a3022', '#8f4a30', '#b46a44'], tex: vgrain(0.22, 3), round: 0.45, spec: 0.25 };
export const MAHOGANY_D: Material = { ...MAHOGANY, ramp: ['#0c0403', '#1e0b08', '#321610', '#4a2118', '#643020', '#804430'] };
export const ROTWOOD: Material = { ramp: ['#0c0805', '#1c150c', '#2e2616', '#433a22', '#5f5636', '#7c7048'], tex: grain(1.6, 0.2, 11), round: 0.45 };
export const ROTWOOD_D: Material = { ...ROTWOOD, ramp: ['#080503', '#140e08', '#221a10', '#302818', '#433a22', '#564c30'] };
export const GOLD: Material = { ramp: ['#1e1204', '#4a3010', '#7a5418', '#b98a2e', '#e8c25a', '#fff1a8'], spec: 0.85, round: 0.5, tex: grain(1.2, 0.06, 2) };
export const TARNISH: Material = { ramp: ['#0e0a06', '#2a2214', '#4a3e22', '#6e5e34', '#8f7c48'], spec: 0.3, round: 0.5, tex: grain(1.2, 0.12, 6) };
export const BRASS: Material = { ramp: ['#1e1206', '#3e2a10', '#6a4a1e', '#a87a35', '#e0b468', '#fff0b0'], spec: 0.8, round: 0.8, tex: grain(1.5, 0.08, 5) };
export const CURTAIN: Material = { ramp: ['#1a0205', '#36050d', '#5a0a16', '#861220', '#b0222a', '#d84a40'], tex: folds(1.8, 0.32, 3), round: 0.55, spec: 0.15 };
export const FLESH: Material = { ramp: ['#1e060b', '#4d1f2b', '#7a3540', '#b05a55', '#d98f7a', '#f2c3a8'], spec: 0.55, tex: grain(1.4, 0.12, 8), round: 0.9 };
export const FLESH_CURTAIN: Material = { ...FLESH, tex: (x, y) => folds(1.8, 0.25, 6)(x, y) + (Math.abs(valueNoise(x, y, 3, 4) - 0.5) < 0.05 ? -0.35 : 0), round: 0.55 };
export const BONE: Material = { ramp: ['#1e160c', '#3e3220', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf'], spec: 0.25, tex: grain(1.3, 0.1, 4), round: 0.9 };
export const MARBLE: Material = {
  ramp: ['#1e1a1a', '#3e3834', '#5e564d', '#8c8273', '#b9ae9a', '#ddd5c4', '#f4efe4'],
  spec: 0.35,
  round: 0.8,
  tex: (x, y) => (Math.abs(valueNoise(x, y, 5, 13) - 0.5) < 0.03 ? -0.15 : 0) + (valueNoise(x, y, 2, 1) - 0.5) * 0.06,
};
export const STONE: Material = {
  ramp: ['#0c0809', '#1a1315', '#2a2023', '#3c3032', '#524346', '#6c5a58', '#8a7670'],
  round: 0.35,
  tex: (x, y) => (valueNoise(x, y, 3, 7) - 0.5) * 0.18 + (hash2(x, y, 3) > 0.94 ? -0.15 : 0),
};
export const WAX: Material = { ramp: ['#3a2a1a', '#8a7458', '#cdb889', '#efe3bf', '#fff8e8'], round: 0.9, spec: 0.3 };
export const VOID: Material = { ramp: ['#050203', '#0b0507', '#140a0c'], round: 0.2 };
export const RUBY: Material = { ramp: ['#2a0208', '#6a0a18', '#b0182a', '#ff4a4a', '#ffd0c0'], spec: 1, round: 1 };
export const DRIED: Material = { ramp: ['#1a100c', '#3a2a1e', '#5a4430', '#7e6446', '#a08660', '#c4ac84'], tex: grain(1.2, 0.15, 14), round: 0.8 };
export const PAGE: Material = { ramp: ['#3a2e20', '#8a7a5a', '#c8b88e', '#e8dcb8'], round: 0.2, tex: (x, y) => (y % 2 === 0 && hash2(x, y, 2) > 0.5 ? -0.18 : 0) };
// Shared with the hero's look (copied so the environment does not depend on hero.ts)
export const BLOOD: Material = { ramp: ['#2a0208', '#4e0815', '#7a0c1c', '#a8122a', '#d0262f', '#ff5a4a'], spec: 0.9, round: 0.4 };
export const OLD_BLOOD: Material = { ramp: ['#1e070a', '#34090f', '#4e1018', '#6a1a1e', '#83292a'], spec: 0.15, round: 0.3 };
export const IRON: Material = { ramp: ['#0e0d10', '#26252b', '#3d3c44', '#5b5a63', '#87868f', '#c4c3c8'], spec: 0.9, tex: grain(1.5, 0.12, 7), round: 0.9 };
export const RUST: Material = { ramp: ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22', '#b06a36'], spec: 0.2, tex: grain(1.5, 0.15, 9) };

/**
 * Figure in old-scale coordinates, drawn at `k` x SC: the canvas is W x H
 * (= round(w * k * SC) x round(h * k * SC)); shapes are rasterised at 2x that
 * and reduced on render. Radii never drop below half a final pixel.
 */
export class SF {
  readonly f: Figure;
  readonly W: number;
  readonly H: number;
  /** Source units to final pixels. */
  readonly q: number;
  private readonly k: number;
  constructor(
    readonly w: number,
    readonly h: number,
    k = 1,
    scale = SC,
  ) {
    this.q = k * scale;
    this.W = Math.round(w * this.q);
    this.H = Math.round(h * this.q);
    this.k = this.q * 2;
    this.f = new Figure(this.W * 2, this.H * 2);
  }
  private r(v: number) {
    return Math.max(1, v * this.k);
  }
  /** Source coordinate to final pixel. */
  P(v: number) {
    return Math.round(v * this.q);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material, l: number, rot = 0) {
    const k = this.k;
    this.f.ellipse(cx * k, cy * k, this.r(rx), this.r(ry), m, l, rot);
  }
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, m: Material, l: number) {
    const k = this.k;
    this.f.capsule(ax * k, ay * k, bx * k, by * k, this.r(ra), this.r(rb), m, l);
  }
  poly(pts: [number, number][], m: Material, l: number) {
    this.f.poly(
      pts.map(([x, y]) => [x * this.k, y * this.k] as [number, number]),
      m,
      l,
    );
  }
  rect(x0: number, y0: number, x1: number, y1: number, m: Material, l: number) {
    this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], m, l);
  }
  add(mask: (x: number, y: number) => boolean, m: Material, l: number, bb: [number, number, number, number]) {
    const k = this.k;
    this.f.add((x, y) => mask(x / k, y / k), m, l, [bb[0] * k, bb[1] * k, bb[2] * k, bb[3] * k]);
  }
  stain(mask: (x: number, y: number) => boolean, m: Material, only?: Material[]) {
    const k = this.k;
    this.f.stain((x, y) => mask(x / k, y / k), m, only);
  }
  /** Shade at 2x and reduce to W x H (no outline yet: see finishSprite). */
  render(light: Light = KEY_LIGHT) {
    return reduce2(this.f.render(light, 'transparent'), this.W, this.H);
  }
}

// ---------------------------------------------------------------------------
// Flames & glows painted after shading
// ---------------------------------------------------------------------------

const FLAME = ['#a8301a', '#e8742a', '#ffb050', '#ffe08a', '#fff8dc'];

/** Candle flame with its base at (x, y). `f` is the flicker frame. */
export function flame(pc: PixelCanvas, x: number, y: number, h = 4, f = 0, halo = true) {
  const sway = [0, 1, -1, 0][f % 4];
  const hh = h + [0, 1, -1, 0][(f + 1) % 4];
  if (halo)
    for (let dy = -hh - 3; dy <= 3; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, (dy + hh / 2) * 0.8) / 5;
        if (d < 1 && pc.alphaAt(x + dx, y + dy) === 0) pc.px(x + dx, y + dy, '#ffb050', (1 - d) * 0.28);
      }
  for (let i = 0; i < hh; i++) {
    const t = i / hh; // 0 base .. 1 tip
    const cx = x + Math.round(sway * t);
    const w = t < 0.6 ? 1 : 0;
    // small SNES flames: warm bands (a white core would read as wax)
    const core = hh <= 3 ? [3, 2, 1][Math.min(2, i)] : t < 0.45 ? 4 : t < 0.7 ? 3 : t < 0.9 ? 2 : 1;
    pc.px(cx, y - i, FLAME[core]);
    if (w && hh > 3) {
      pc.px(cx - 1, y - i, FLAME[Math.max(1, core - 2)]);
      pc.px(cx + 1, y - i, FLAME[Math.max(1, core - 2)]);
    }
  }
  pc.px(x, y + 1, '#2a1a10'); // wick
}

function smoke(pc: PixelCanvas, x: number, y: number, h: number, seed: number) {
  for (let i = 0; i < h; i++) {
    const xx = x + Math.round(Math.sin(i * 0.5 + seed) * 1.5);
    if (hash2(i, seed, 3) < 0.7) pc.px(xx, y - i, '#8f877c', 0.5 * (1 - i / h));
  }
}

// ---------------------------------------------------------------------------
// Confessional booth (64x96 source units; 40x60 at k=1)
// ---------------------------------------------------------------------------

export function drawBooth(rot: boolean, open: boolean, k = 1, f = 0): PixelCanvas {
  const s = new SF(64, 96, k);
  const W = rot ? ROTWOOD : MAHOGANY;
  const WD = rot ? ROTWOOD_D : MAHOGANY_D;
  const G = rot ? TARNISH : GOLD;
  // Plinth and body
  s.rect(1, 87, 63, 96, WD, 1);
  s.capsule(1.5, 87.5, 62.5, 87.5, 1.6, 1.6, G, 1.5);
  s.rect(5, 34, 59, 87, W, 2);
  // Penitents' screens either side: lattice in recessed panels
  for (const px of [9, 45]) {
    s.rect(px, 44, px + 10, 84, WD, 2.4);
    s.poly([[px, 44], [px + 5, 39], [px + 10, 44]], WD, 2.4);
  }
  // Pilasters with gilded capitals
  for (const x of [6.5, 21, 43, 57.5]) {
    s.capsule(x, 38, x, 86, 2.2, 2.4, W, 3);
    s.ellipse(x, 38, 3, 1.6, G, 3.2);
  }
  // Doorway (gothic arch) — interior void, curtain on top
  const door = (x: number, y: number) => inGothic(x, y, 24, 40, 54, 0.75) && y < 86;
  s.add(door, VOID, 2.6, [24, 40, 40, 86]);
  if (!open) {
    s.add((x, y) => inGothic(x, y, 25, 39, 55, 0.75) && y < 86 + (hash2(Math.floor(x), 0, 3) > 0.5 ? 1 : 0), rot ? FLESH_CURTAIN : CURTAIN, 2.7, [25, 42, 39, 87]);
  } else {
    // Curtain drawn aside, bunched at the jambs
    s.capsule(25.5, 50, 26, 86, 1.6, 2.4, rot ? FLESH_CURTAIN : CURTAIN, 2.7);
    s.capsule(38.5, 50, 38, 86, 1.6, 2.4, rot ? FLESH_CURTAIN : CURTAIN, 2.7);
    s.capsule(26, 50, 38, 50, 1.2, 1.2, rot ? FLESH_CURTAIN : CURTAIN, 2.75);
    // The kneeler and a candle
    s.rect(28, 82, 36, 86, WD, 2.65);
    s.capsule(32, 81, 32, 76, 1.1, 1.1, WAX, 2.7);
  }
  // Gilded archivolt
  const archPts: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const xl = 23;
    const xr = 41;
    const r = (xr - xl) * 0.75;
    const xx = xl + (xr - xl) * t;
    const cx = t <= 0.5 ? xl + r : xr - r;
    const yy = 54 - Math.sqrt(Math.max(0, r * r - (xx - cx) ** 2));
    archPts.push([xx, yy]);
  }
  for (let i = 0; i + 1 < archPts.length; i++) s.capsule(archPts[i][0], archPts[i][1], archPts[i + 1][0], archPts[i + 1][1], 1.1, 1.1, G, 3.1);
  s.capsule(23, 54, 23, 86, 1.1, 1.1, G, 3.1);
  s.capsule(41, 54, 41, 86, 1.1, 1.1, G, 3.1);
  // Cornice
  s.capsule(2, 34, 62, 34, 2.6, 2.6, W, 4);
  s.capsule(2, 31, 62, 31, 1.2, 1.2, G, 4.1);
  // Peaked roof with gable and oculus
  s.poly([[3, 30], [32, 7], [61, 30]], W, 3.5);
  s.poly([[11, 29], [32, 13], [53, 29]], WD, 3.6);
  s.ellipse(32, 23, 4.5, 4.5, G, 3.7);
  s.ellipse(32, 23, 2.8, 2.8, rot ? FLESH : RUBY, 3.8);
  // Crockets along the roof
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    s.ellipse(3 + 29 * t, 30 - 23 * t - 1.5, 1.4, 1.4, G, 3.9);
    s.ellipse(61 - 29 * t, 30 - 23 * t - 1.5, 1.4, 1.4, G, 3.9);
  }
  // Pinnacles
  for (const x of [5, 59]) {
    s.capsule(x, 32, x, 16, 2.4, 0.9, W, 4.2);
    s.ellipse(x, 15, 1.5, 1.5, G, 4.3);
  }
  // Cross
  s.capsule(32, 0.8, 32, 10, 1.15, 1.15, G, 5);
  s.capsule(29, 3.6, 35, 3.6, 1.1, 1.1, G, 5);
  // Lattice on the screens
  const lat = (x: number, y: number) => ((Math.floor(x / 1.6) + Math.floor(y / 1.6)) % 4 + 4) % 4;
  const lat2 = (x: number, y: number) => ((Math.floor(x / 1.6) - Math.floor(y / 1.6)) % 4 + 4) % 4;
  s.stain((x, y) => ((x > 10 && x < 18) || (x > 46 && x < 54)) && y > 46 && y < 82 && (lat(x, y) === 0 || lat2(x, y) === 0), G, [WD]);
  s.stain((x, y) => ((x > 10 && x < 18) || (x > 46 && x < 54)) && y > 46 && y < 82 && lat(x, y) === 2 && lat2(x, y) === 2, VOID, [WD]);
  // Gore: soaked hem, blood seeping beneath the curtain
  s.stain((x, y) => y > 80 + valueNoise(x, 0, 3, 5) * 6, OLD_BLOOD, [W, WD, CURTAIN]);
  s.stain((x, y) => x > 22 && x < 42 && y > 84, BLOOD, [W, WD, CURTAIN, G]);
  s.stain((x, y) => valueNoise(x, y, 2, 31) > 0.8 && y > 40, OLD_BLOOD, [W]);
  if (rot) {
    // Flesh growing through the wood: tumours, veins, a mouth of teeth in the gable
    for (let i = 0; i < 9; i++) {
      const x = 8 + hash2(i, 1, 41) * 48;
      const y = 40 + hash2(i, 2, 41) * 42;
      if (x > 22 && x < 42 && y > 44) continue;
      s.ellipse(x, y, 2 + hash2(i, 3, 41) * 3, 1.6 + hash2(i, 4, 41) * 2.4, FLESH, 3.4);
    }
    s.ellipse(20, 33, 6, 2.6, FLESH, 4.15);
    s.ellipse(48, 32, 4, 2, FLESH, 4.15);
    s.stain((x, y) => Math.abs(valueNoise(x, y, 4, 9) - 0.5) < 0.035 && y > 20, { ramp: ['#24080d', '#4d1f2b', '#6a2030'] }, [W, WD]);
    s.stain((x, y) => Math.hypot(x - 32, y - 23) < 1.2, VOID, [FLESH]);
  }
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.14 }), {
    paint: (pc) => {
      if (open) flame(pc, s.P(32), s.P(75), Math.max(2, s.P(4)), f, false);
    },
  });
}

// ---------------------------------------------------------------------------
// Candelabra (24x48 source; 15x30)
// ---------------------------------------------------------------------------

export function drawCandelabra(f: number, rot = false, k = 1, lit = true): PixelCanvas {
  const s = new SF(24, 48, k);
  const M = rot ? BONE : BRASS;
  s.ellipse(12, 45, 7, 2.2, M, 1);
  s.capsule(4, 47.5, 10, 42, 1.2, 1.6, M, 1.5);
  s.capsule(20, 47.5, 14, 42, 1.2, 1.6, M, 1.5);
  s.capsule(12, 43, 12, 14, 1.7, 1.1, M, 2);
  for (const y of [38, 30, 22]) s.ellipse(12, y, 2.4, 1.4, M, 2.2);
  s.capsule(12, 22, 7, 20, 1.1, 1.1, M, 2.1);
  s.capsule(7, 20, 4, 15, 1.1, 1.0, M, 2.1);
  s.capsule(12, 22, 17, 20, 1.1, 1.1, M, 2.1);
  s.capsule(17, 20, 20, 15, 1.1, 1.0, M, 2.1);
  for (const [x, y] of [[4, 14], [12, 12], [20, 14]] as const) s.ellipse(x, y, 2.6, 1.2, M, 2.3);
  s.capsule(4, 13, 4, 8, 1.1, 1.1, WAX, 2.4);
  s.capsule(12, 11, 12, 5, 1.2, 1.2, WAX, 2.4);
  s.capsule(20, 13, 20, 8.5, 1.1, 1.1, WAX, 2.4);
  // Wax tears over the cups; blood on the base
  s.stain((x, y) => (Math.abs(x - 5) < 0.6 && y > 13 && y < 17) || (Math.abs(x - 11) < 0.6 && y > 11 && y < 15), WAX, [M]);
  s.stain((x, y) => y > 43 && valueNoise(x, y, 2, 3) > 0.55, rot ? FLESH : OLD_BLOOD, [M]);
  if (rot) s.stain((x, y) => Math.abs(y - 26) < 1.4 || Math.abs(y - 34) < 1, FLESH, [M]);
  return finishSprite(s.render(), {
    paint: (pc) => {
      if (!lit) return;
      flame(pc, s.P(4), s.P(8), Math.max(2, s.P(3)), f, false);
      flame(pc, s.P(12), s.P(5), Math.max(2, s.P(4)), f + 1, false);
      flame(pc, s.P(20), s.P(8), Math.max(2, s.P(3)), f + 2, false);
    },
  });
}

// ---------------------------------------------------------------------------
// Weeping saint (48x96 source; 30x60 at k=1)
// ---------------------------------------------------------------------------

export function drawSaint(rot: boolean, k = 1): PixelCanvas {
  const s = new SF(48, 96, k);
  const M = MARBLE;
  const robe: Material = { ...MARBLE, tex: (x, y) => folds(2.2, 0.2, 2)(x, y) + (MARBLE.tex ? MARBLE.tex(x, y) : 0), round: 0.7 };
  // Pedestal
  s.rect(9, 80, 39, 96, M, 1);
  s.capsule(6.5, 80, 41.5, 80, 2.2, 2.2, M, 1.4);
  s.capsule(8, 93.5, 40, 93.5, 1.8, 1.8, M, 1.4);
  s.capsule(10, 86, 38, 86, 0.8, 0.8, rot ? TARNISH : GOLD, 1.5);
  // Halo behind the head
  if (rot) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      s.capsule(24 + Math.cos(a) * 7, 22 + Math.sin(a) * 7, 24 + Math.cos(a) * 11, 22 + Math.sin(a) * 11, 1.3, 0.4, BONE, 1.6);
    }
  } else s.add((x, y) => { const d = Math.hypot(x - 24, y - 22); return d > 8.2 && d < 10.6; }, GOLD, 1.6, [13, 11, 35, 33]);
  // Robe and veil
  s.poly([[15, 40], [33, 40], [36, 60], [39, 79], [9, 79], [12, 60]], robe, 2);
  s.poly([[16, 23], [24, 14.5], [32, 23], [35, 46], [13, 46]], { ...robe, ramp: robe.ramp.slice(0, -1) }, 3);
  s.ellipse(24, 26, 5.2, 6.4, M, 4, 0.1);
  // Praying hands and forearms
  s.capsule(16, 51, 22.5, 45, 2.6, 2.2, robe, 4.5);
  s.capsule(32, 51, 25.5, 45, 2.6, 2.2, robe, 4.5);
  s.capsule(24, 46, 24, 38.5, 2.4, 1.6, M, 5);
  // Hollow eyes, bloody tears
  s.stain((x, y) => (Math.abs(x - 21.5) < 1.2 || Math.abs(x - 26.5) < 1.2) && Math.abs(y - 25.5) < 0.9, VOID, [M]);
  s.stain((x, y) => {
    for (const ex of [21.5, 26.5]) {
      const wob = Math.sin(y * 0.7 + ex) * 0.5;
      if (Math.abs(x - ex - wob) < 0.65 && y > 26 && y < 31 + (ex > 24 ? 22 : 14)) return true;
    }
    return false;
  }, BLOOD);
  s.stain((x, y) => y > 76 && y < 82 && valueNoise(x, 0, 3, 7) > 0.35, BLOOD, [M, robe]);
  s.stain((x, y) => y > 82 && Math.abs(x - 27 - Math.sin(y) * 0.4) < 0.7, BLOOD, [M]);
  s.stain((x, y) => y > 60 && y < 79 && valueNoise(x, y, 2.5, 19) > 0.72, OLD_BLOOD, [robe]);
  if (rot) {
    // Marble splitting open to raw flesh; a gaping mouth
    s.stain((x, y) => valueNoise(x, y, 4, 23) > 0.6, FLESH, [M, robe]);
    s.stain((x, y) => Math.abs(valueNoise(x, y, 3, 29) - 0.5) < 0.03, VOID, [M, robe]);
    s.stain((x, y) => Math.hypot((x - 24) / 1.8, (y - 30) / 2.4) < 1, VOID, [M]);
    s.stain((x, y) => Math.abs(y - 28.6) < 0.5 && Math.abs(x - 24) < 1.6 && Math.floor(x) % 2 === 0, BONE, [M]);
    for (let i = 0; i < 5; i++) s.capsule(13 + i * 5.5, 78, 12 + i * 5.8 + hash2(i, 0, 3) * 3, 84 + hash2(i, 1, 3) * 6, 1.6, 0.6, FLESH, 2.1);
  }
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.18 }));
}

// ---------------------------------------------------------------------------
// Hanging cage with a corpse (32x64 source; 20x40, top-anchored)
// ---------------------------------------------------------------------------

export function drawCage(rot = false, k = 1): PixelCanvas {
  const s = new SF(32, 64, k);
  const BAR: Material = { ...IRON, round: 1 };
  const BARB: Material = { ...IRON, ramp: IRON.ramp.map((_, i) => IRON.ramp[Math.max(0, i - 2)]) };
  for (let y = 0; y < 12; y += 3) {
    if ((y / 3) % 2 === 0) s.ellipse(16, y + 1.5, 1.4, 2, BAR, 6);
    else s.capsule(16, y, 16, y + 3, 0.6, 0.6, BAR, 6);
  }
  s.ellipse(16, 13, 2.2, 1.5, BAR, 6);
  // Back bars
  for (const x of [8.5, 13, 19, 23.5]) s.capsule(x, 19, x, 58, 0.7, 0.7, BARB, 1);
  // Corpse: slumped, one arm through the bars
  const C = rot ? FLESH : DRIED;
  s.capsule(15, 34, 17, 47, 4.4, 3.6, C, 3);
  s.ellipse(13.5, 30, 3.6, 3.9, rot ? FLESH : BONE, 3.4, 0.4);
  s.capsule(18, 36, 24, 44, 1.5, 1.3, C, 3.2);
  s.capsule(24, 44, 27.5, 57, 1.3, 1.1, C, 3.2);
  s.ellipse(27.8, 59, 1.4, 1.8, C, 3.2);
  s.capsule(16, 47, 9, 53, 2.6, 2, C, 3.1);
  s.capsule(9, 53, 14, 56.5, 2, 1.6, C, 3.1);
  s.capsule(18, 47, 22, 55, 2.4, 1.8, C, 3.05);
  s.stain((x, y) => x > 12 && x < 19 && y > 35 && y < 45 && Math.floor(y) % 2 === 0, rot ? BLOOD : BONE, [C]);
  s.stain((x, y) => Math.hypot(x - 12.4, y - 29.6) < 1 || Math.hypot(x - 15, y - 30.5) < 0.9, VOID, [BONE, FLESH]);
  s.stain((x, y) => y > 44 && valueNoise(x, y, 2, 5) > 0.5, OLD_BLOOD, [C]);
  // Dome, rims and front bars
  s.add((x, y) => { const d = Math.hypot((x - 16) / 11, (y - 20) / 7.5); return y < 20 && d < 1 && d > 0.78; }, BAR, 5, [4, 12, 28, 21]);
  s.capsule(5.5, 20, 26.5, 20, 1.1, 1.1, BAR, 5.1);
  for (const x of [6, 10.5, 16, 21.5, 26]) s.capsule(x, 20, x, 58.5, 0.85, 0.85, BAR, 5);
  s.ellipse(16, 59.5, 11.5, 2.4, BAR, 5.2);
  s.capsule(5, 59.5, 27, 59.5, 1.2, 1.2, RUST, 5.3);
  s.stain((x, y) => valueNoise(x, y, 2, 77) > 0.66, RUST, [BAR]);
  return finishSprite(s.render(), {
    paint: (pc) => {
      // Blood dripping from the floor of the cage
      for (const [x, l] of [[12, 3], [18, 2], [28, 3]] as const) {
        const n = Math.max(1, s.P(l));
        for (let i = 0; i < n; i++) pc.px(s.P(x), s.P(61) + 1 + i, i === n - 1 ? '#d0262f' : '#7a0c1c');
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Gothic doorway with portcullis (48x72 source; 30x45)
// ---------------------------------------------------------------------------

const DOOR_IN = (x: number, y: number) => inGothic(x, y, 9, 39, 26, 0.72);

function doorFrame(): PixelCanvas {
  const s = new SF(48, 72);
  s.add((x, y) => inGothic(x, y, 0, 48, 26, 0.72) && !DOOR_IN(x, y) && y < 72, STONE, 2, [0, 0, 48, 72]);
  // Archivolt and jamb mouldings
  s.add((x, y) => inGothic(x, y, 6, 42, 26, 0.72) && !inGothic(x, y, 9.5, 38.5, 26, 0.72) && y < 72, { ...STONE, round: 0.9 }, 2.5, [6, 0, 42, 72]);
  s.add((x, y) => inGothic(x, y, 8, 40, 26, 0.72) && !inGothic(x, y, 9.2, 38.8, 26, 0.72) && y < 66, GOLD, 2.6, [8, 0, 40, 66]);
  // Keystone
  s.poly([[21, 2], [27, 2], [26, 10], [22, 10]], STONE, 3);
  s.ellipse(24, 5.5, 1.5, 1.5, GOLD, 3.1);
  // Bases
  s.rect(0, 64, 9, 72, STONE, 3);
  s.rect(39, 64, 48, 72, STONE, 3);
  s.capsule(0.5, 64, 8.5, 64, 1.2, 1.2, STONE, 3.1);
  s.capsule(39.5, 64, 47.5, 64, 1.2, 1.2, STONE, 3.1);
  // Ashlar joints
  s.stain((x, y) => !inGothic(x, y, 6, 42, 26, 0.72) && y > 24 && Math.floor(y) % 10 === 0, { ramp: ['#0b0507', '#140c0e'] }, [STONE]);
  s.stain((x, y) => y < 26 && !inGothic(x, y, 6, 42, 26, 0.72) && Math.abs(Math.atan2(y - 26, x - 24) * 4) % 1 < 0.08, { ramp: ['#0b0507', '#140c0e'] }, [STONE]);
  s.stain((x, y) => y > 60 && valueNoise(x, y, 2, 4) > 0.55, OLD_BLOOD, [STONE]);
  s.stain((x, y) => valueNoise(x, y, 3, 8) > 0.78, { ...STONE, ramp: ['#141c12', '#24301a', '#344220'] }, [STONE]);
  return s.render({ ...KEY_LIGHT, ambient: 0.16 });
}

function portcullis(): PixelCanvas {
  const s = new SF(48, 72);
  for (let x = 11.5; x <= 37; x += 4.2) {
    s.capsule(x, 0, x, 68, 0.95, 0.95, IRON, 2);
    s.poly([[x - 1.3, 67], [x + 1.3, 67], [x, 71.5]], IRON, 2.1);
  }
  for (let y = 8; y < 66; y += 9) s.capsule(9.5, y, 38.5, y, 0.9, 0.9, IRON, 3);
  s.stain((x, y) => valueNoise(x, y, 2, 21) > 0.6, RUST);
  s.stain((x, y) => y > 66 && valueNoise(x, y, 1, 2) > 0.3, BLOOD);
  return s.render();
}

export function drawDoorFrames(): PixelCanvas[] {
  const frame = doorFrame();
  const bars = portcullis();
  const DW = frame.w;
  const DH = frame.h;
  const inside = (x: number, y: number) => DOOR_IN((x + 0.5) / SC, (y + 0.5) / SC);
  const out: PixelCanvas[] = [];
  for (const lift of [0, 0.22, 0.48, 0.74, 1]) {
    const pc = new PixelCanvas(DW, DH);
    // Interior darkness with a dim red glow from beyond (flat bands)
    for (let y = 0; y < DH; y++)
      for (let x = 0; x < DW; x++) {
        if (!inside(x, y)) continue;
        const g = Math.max(0, (y / SC - 26) / 46) * 3;
        pc.px(x, y, ['#0b0507', '#1a0609', '#2a0a0e'][Math.min(2, Math.floor(g))]);
      }
    const dy = -Math.round(lift * 64 * SC);
    for (let y = 0; y < DH; y++)
      for (let x = 0; x < DW; x++) {
        const sy = y - dy;
        if (sy < 0 || sy >= DH || !inside(x, y)) continue;
        const o = (sy * DW + x) * 4;
        if (bars.data[o + 3] < 110) continue;
        const c = '#' + [bars.data[o], bars.data[o + 1], bars.data[o + 2]].map((v) => (v | 0).toString(16).padStart(2, '0')).join('');
        pc.px(x, y, c);
      }
    pc.blit(frame, 0, 0);
    out.push(finishSprite(pc));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Votive altar (64x64 source; 40x40)
// ---------------------------------------------------------------------------

export function drawVotive(spent: boolean): PixelCanvas {
  const s = new SF(64, 64);
  s.rect(7, 41, 57, 64, STONE, 1);
  s.capsule(4, 41, 60, 41, 2.4, 2.4, MARBLE, 2);
  s.rect(11, 44, 53, 61, CURTAIN, 1.5);
  s.stain((x, y) => x > 11 && x < 53 && y > 44 && y < 61 && (x < 13 || x > 51 || y > 59 || (Math.abs(x - 32) < 1 && y > 46 && y < 58) || (Math.abs(y - 50) < 0.8 && Math.abs(x - 32) < 4)), GOLD, [CURTAIN]);
  // Small weeping saint
  s.add((x, y) => { const d = Math.hypot(x - 32, y - 12); return d > 5.6 && d < 7.2; }, GOLD, 2.2, [24, 4, 40, 20]);
  s.poly([[27, 22], [37, 22], [40, 39], [24, 39]], MARBLE, 2.5);
  s.poly([[28, 14], [32, 9], [36, 14], [37, 26], [27, 26]], MARBLE, 2.6);
  s.ellipse(32, 15, 3.4, 4.2, MARBLE, 3);
  s.capsule(32, 30, 32, 24, 1.6, 1.2, MARBLE, 3.2);
  s.stain((x, y) => (Math.abs(x - 30.6) < 0.7 || Math.abs(x - 33.4) < 0.7) && Math.abs(y - 15) < 0.7, VOID, [MARBLE]);
  s.stain((x, y) => (Math.abs(x - 30.6) < 0.6 || Math.abs(x - 33.4) < 0.6) && y > 15.5 && y < (x < 32 ? 24 : 34), spent ? OLD_BLOOD : BLOOD);
  s.stain((x, y) => y > 37 && y < 43 && Math.abs(x - 32) < 9 && valueNoise(x, 0, 2, 3) > 0.4, spent ? OLD_BLOOD : BLOOD, [MARBLE]);
  // Candles
  const candles: [number, number][] = [[9, 11], [13.5, 15], [18, 8], [46, 8], [50.5, 15], [55, 11], [22, 5], [42, 5]];
  for (const [x, h] of candles) {
    const hh = spent ? Math.max(2, h * 0.35) : h;
    s.capsule(x, 39, x, 39 - hh, 1.3, 1.3, WAX, 2.8);
  }
  s.stain((x, y) => y > 40 && y < 47 && candles.some(([cx]) => Math.abs(x - cx - 0.6) < 0.7 && y < 41 + hash2(cx, 1, 2) * 6), WAX);
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.18 }), {
    paint: (pc) =>
      candles.forEach(([x, h], i) => {
        const hh = spent ? Math.max(2, h * 0.35) : h;
        if (!spent) flame(pc, s.P(x), s.P(38.5 - hh), 2 + (i % 2), i, false);
        else smoke(pc, s.P(x), s.P(37 - hh), 5, i);
      }),
  });
}

// ---------------------------------------------------------------------------
// Reliquary cache (32x28 source; 20x18)
// ---------------------------------------------------------------------------

export function drawCache(open: boolean): PixelCanvas {
  const s = new SF(32, 28);
  const GD: Material = { ...GOLD, ramp: GOLD.ramp.slice(0, 4) };
  if (open) s.poly([[5, 13], [7, 1], [25, 1], [27, 13]], GD, 1);
  s.capsule(3, 26.5, 29, 26.5, 1.4, 1.4, GOLD, 2);
  s.rect(4.5, 13, 27.5, 26, GOLD, 2.2);
  for (const x of [5, 27]) s.capsule(x, 13, x, 26, 1.3, 1.3, GOLD, 2.5);
  s.ellipse(16, 19.5, 2.4, 2.6, RUBY, 2.8);
  for (const x of [10, 22]) s.ellipse(x, 19.5, 1.2, 1.2, RUBY, 2.7);
  s.stain((x, y) => y > 14 && y < 25 && (Math.abs(y - 15) < 0.5 || Math.abs(y - 24) < 0.5) && x > 6 && x < 26, GD, [GOLD]);
  if (!open) {
    s.poly([[3, 13.5], [16, 4], [29, 13.5]], GOLD, 3);
    s.capsule(3, 13.5, 29, 13.5, 1.1, 1.1, GOLD, 3.1);
    s.capsule(16, 0.6, 16, 5, 0.9, 0.9, GOLD, 3.2);
    s.capsule(14, 2.2, 18, 2.2, 0.8, 0.8, GOLD, 3.2);
  } else {
    s.capsule(4, 13, 28, 13, 1.1, 1.1, GOLD, 3.1);
    s.ellipse(16, 12.5, 6, 1.6, VOID, 3.05);
  }
  s.stain((x, y) => y > 23 && valueNoise(x, y, 1.5, 3) > 0.6, OLD_BLOOD, [GOLD]);
  const pc = finishSprite(s.render(), {
    paint: (pc) => {
      if (open) for (let x = s.P(12); x < s.P(21); x++) pc.px(x, s.P(12), x % 2 ? '#fff8dc' : '#ffe08a');
    },
  });
  if (open) {
    // Holy light spilling out (half-transparent bands over the empty pixels)
    const top = s.P(12);
    for (let y = 0; y < top; y++)
      for (let x = s.P(4); x < s.P(28); x++) {
        const t = 1 - y / top;
        const d = Math.abs(x + 0.5 - s.P(16)) / ((6 + (13 - y / SC) * 0.6) * SC);
        const a = (1 - d) * t * 0.6;
        if (d < 1 && a > 0.12 && pc.alphaAt(x, y) === 0) pc.px(x, y, '#fff1a8', a > 0.3 ? 0.5 : 0.25);
      }
  }
  return pc;
}

// ---------------------------------------------------------------------------
// Censer (24x24 source; 15x15)
// ---------------------------------------------------------------------------

export function drawCenser(rot = false, k = 1): PixelCanvas {
  const s = new SF(24, 24, k);
  const M = rot ? FLESH : BRASS;
  s.ellipse(12, 10.5, 6, 4, M, 2);
  s.ellipse(12, 6.5, 1.3, 1.6, M, 2.1);
  s.ellipse(12, 15, 8, 4.6, M, 3);
  s.capsule(4, 13, 20, 13, 1.1, 1.1, rot ? BONE : GOLD, 3.2);
  s.ellipse(12, 20.5, 3, 1.4, M, 2.5);
  const K = (v: number) => s.P(v);
  return finishSprite(s.render(), {
    paint: (pc) => {
      for (const [ax, ay] of [[6, 9], [18, 9], [12, 5]]) pc.line(K(12), 0, K(ax), K(ay), rot ? '#7a3540' : '#a87a35');
      pc.px(K(12), 0, '#e0b468');
      // Pierced holes glowing with embers
      for (const [x, y] of [[8, 15], [16, 15], [12, 10], [12, 16]]) pc.px(K(x), K(y), '#ffb050');
      for (let i = 0; i < 4; i++) {
        const x = K(5 + hash2(i, 1, 9) * 14);
        const y = K(20 + hash2(i, 2, 9) * 3);
        if (pc.alphaAt(x, y) === 0) pc.px(x, y, i % 2 ? '#ffe08a' : '#e8742a');
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Bone lectern with a skin-bound book (32x48 source; 20x30)
// ---------------------------------------------------------------------------

export function drawLectern(): PixelCanvas {
  const s = new SF(32, 48);
  s.ellipse(16, 45, 9.5, 2.8, BONE, 1);
  s.capsule(5, 47.5, 12, 40, 1.6, 2.2, BONE, 1.5);
  s.capsule(27, 47.5, 20, 40, 1.6, 2.2, BONE, 1.5);
  s.ellipse(4.5, 47, 2, 1.3, BONE, 1.6);
  s.ellipse(27.5, 47, 2, 1.3, BONE, 1.6);
  for (let y = 41; y > 20; y -= 3.4) {
    s.ellipse(16, y, 3.3, 1.7, BONE, 2);
    s.capsule(12.8, y, 19.2, y, 0.5, 0.5, BONE, 2.05);
  }
  s.stain((x, y) => y > 20 && y < 42 && Math.abs(x - 16) < 3 && ((y - 20) % 3.4) > 2.6, FLESH, [BONE]);
  s.capsule(16, 21, 5, 16, 1.4, 1, BONE, 2.2);
  s.capsule(16, 21, 27, 14, 1.4, 1, BONE, 2.2);
  // Book: skin covers, pale pages, a blood ribbon
  s.poly([[1, 15], [16, 12], [31, 9], [31, 13.5], [16, 17], [2, 20]], FLESH, 3);
  s.ellipse(9.5, 12.6, 7.2, 3.4, PAGE, 3.3, -0.2);
  s.ellipse(22.5, 10, 7.2, 3.4, PAGE, 3.3, -0.2);
  s.stain((x, y) => Math.abs(x - 16 - (y - 12) * 0.2) < 0.6 && y > 8 && y < 16, { ramp: ['#3a2e20', '#5f4e35'] }, [PAGE]);
  s.capsule(16.5, 14, 18, 25, 0.7, 0.6, BLOOD, 3.5);
  s.stain((x, y) => Math.abs(valueNoise(x, y, 2, 5) - 0.5) < 0.05, { ramp: ['#24080d', '#4d1f2b'] }, [FLESH]);
  s.stain((x, y) => y > 42 && valueNoise(x, y, 2, 9) > 0.5, OLD_BLOOD, [BONE]);
  return finishSprite(s.render({ ...KEY_LIGHT, ambient: 0.16 }));
}

// ---------------------------------------------------------------------------
// Golden light shaft (40x125), for additive blending
// ---------------------------------------------------------------------------

export function drawLightShaft(): PixelCanvas {
  const W = 40;
  const H = 125;
  const pc = new PixelCanvas(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const cx = 20 + (y - 62) * 0.05;
      const hw = 7.5 + y * 0.09;
      const dx = (x + 0.5 - cx) / hw;
      if (Math.abs(dx) >= 1) continue;
      let f = 1 - dx * dx;
      f *= f;
      const bars = 0.6 + 0.4 * Math.abs(Math.cos(dx * Math.PI * 2.5));
      const along = Math.min(1, y / 8) * Math.pow(1 - y / H, 1.2);
      const dust = 0.85 + valueNoise(x, y * 0.5, 4, 3) * 0.3;
      // SNES colour math: a few flat translucency bands
      let a = Math.round(f * bars * along * dust * 0.8 * 6) / 6;
      let c = y < 25 ? '#ffe2a0' : '#ffc860';
      if (hash2(x, y, 7) > 0.993 && f > 0.2) {
        a = Math.min(1, a + 0.5);
        c = '#fff8dc';
      }
      if (a > 0.01) pc.px(x, y, c, a);
    }
  return pc;
}

// ---------------------------------------------------------------------------
// Door emblems (9x9, hand-pixelled for the SNES door)
// ---------------------------------------------------------------------------

const EMBLEM_ART: Record<string, string[]> = {
  combat: ['.........', '.........', '...bbb...', '..bbbbb..', '..k.b.k..', '..bbbbd..', '...bdb...', '....r....', '.........'],
  elite: ['...g.g...', '...ggg...', '...bbb...', '..bbbbb..', '..k.b.k..', '..bbbbd..', '...bdb...', '.........', '.........'],
  confessional: ['....g....', '....w....', '...wwW...', '..wwwWW..', '..ww.WW..', '..wwrWW..', '..wwrWW..', '.........', '.........'],
  votive: ['....o....', '...ofo...', '....f....', '....i....', '...bbB...', '...bbB...', '...bbB...', '..ggggg..', '.........'],
  cache: ['....t....', '....t....', '...ltT...', '...ltT...', '..lttTT..', '..ttwTT..', '...TTT...', '.........', '.........'],
  boss: ['.........', '...ppp...', '..pqqqp..', '..pqmqp..', '...pmqp..', '....qp...', '...rp....', '..rr.....', '.........'],
};
const EMBLEM_INK: Record<string, string> = {
  b: '#efe3bf', d: '#9a845a', k: '#0b0507', r: '#d0262f', g: '#e8c25a', w: '#8f4a30', W: '#6a3022',
  o: '#e8742a', f: '#ffe08a', i: '#2a1a10', B: '#cdb889', t: '#6fb3e0', T: '#336b9e', l: '#bfe6ff',
  p: '#d98f7a', q: '#b05a55', m: '#4d1f2b',
};

export function drawEmblem(kind: string): PixelCanvas {
  const pc = new PixelCanvas(9, 9);
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const d = Math.hypot(x - 4, y - 4);
      if (d <= 4.5) pc.px(x, y, d > 3.6 ? (x + y < 8 ? '#e8c25a' : '#7a5418') : '#2a1418');
    }
  const art = EMBLEM_ART[kind];
  if (art)
    art.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch !== '.' && EMBLEM_INK[ch]) pc.px(x, y, EMBLEM_INK[ch]);
      }),
    );
  return pc;
}
