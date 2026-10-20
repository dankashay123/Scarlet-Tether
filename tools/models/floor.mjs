// Floors in the Otherworld Legends manner: large, calm flagstones in mixed
// sizes. Each slab has a flat body with soft mottling, a lit top-left bevel,
// a shaded bottom-right bevel and a dark gap on its right and bottom edges.
// Sizes are in 16 px tiles; the game packs them at bake time.
import { noise3 } from '../sdf.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const fbm = (x, y, s = 0) => noise3(x, y, s) * 0.65 + noise3(x * 2.3, y * 2.3, s + 11) * 0.35;

// Per theme: ramp and the body step (0 light .. 8 dark).
export const FLOOR_THEMES = {
  crypt: { ramp: 'stone', body: 4.4 },
  chapel: { ramp: 'flag', body: 4.2 },
  ossuary: { ramp: 'sand', body: 4.4 },
  flooded: { ramp: 'slate', body: 2.6 },
  corridor: { ramp: 'stone', body: 5 },
  street: { ramp: 'stone', body: 4.8 },
};
export const SLAB_SIZES = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [2, 3], [3, 3]];

function slab(theme, tw, th, v) {
  const { ramp, body } = FLOOR_THEMES[theme];
  const w = tw * 16, h = th * 16, seed = v * 31 + tw * 7 + th * 3 + theme.length * 101;
  const px = new Int16Array(w * h).fill(-1);
  const R = FINE[ramp];
  const set = (x, y, s) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = IDX[R[clamp(Math.round(s), 0, 8)]]; };
  // The stone spans 0..w-2 x 0..h-2; the last row and column are the gap.
  const sw = w - 1, sh = h - 1;
  const tone = (hash(seed, 1) - 0.5) * 0.7;
  // Chipped corners.
  const chips = [[0, 0], [sw - 1, 0], [0, sh - 1], [sw - 1, sh - 1]].map(([cx, cy], i) => hash(seed, i, 5) < 0.35 ? [cx, cy, 1.5 + hash(seed, i, 6) * 2] : null).filter(Boolean);
  // One crack on some slabs: a jagged polyline from an edge inward.
  const cracks = [];
  if (hash(seed, 9) < 0.16 && w * h >= 512) {
    let x = hash(seed, 10) < 0.5 ? 1 : 3 + hash(seed, 11) * (sw - 6), y = x === 1 ? 3 + hash(seed, 12) * (sh - 6) : 1;
    const ang = x === 1 ? (hash(seed, 13) - 0.5) * 1.2 : Math.PI / 2 + (hash(seed, 13) - 0.5) * 1.2;
    const n = 3 + Math.floor(hash(seed, 14) * 3);
    const pts = [[x, y]];
    for (let i = 0; i < n; i++) { const a = ang + (hash(seed, 20 + i) - 0.5) * 1.4, L = 3 + hash(seed, 30 + i) * 4; x += Math.cos(a) * L; y += Math.sin(a) * L; pts.push([x, y]); }
    cracks.push(pts);
  }
  const crackD = (x, y) => { let d = 9; for (const pts of cracks) for (let i = 0; i + 1 < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const L = (bx - ax) ** 2 + (by - ay) ** 2 || 1; const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / L, 0, 1); d = Math.min(d, Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t)); } return d; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x >= sw || y >= sh) { set(x, y, 8); continue; }
    let chipped = false;
    for (const [cx, cy, r] of chips) if (Math.hypot(x - cx, y - cy) < r) chipped = true;
    if (chipped) { set(x, y, 8); continue; }
    // Bevels: lit top and left, shaded bottom and right.
    if (y === 0 || x === 0) { set(x, y, body - 1.6 + (x === 0 && y > 0 ? 0.4 : 0)); continue; }
    if (y === sh - 1 || x === sw - 1) { set(x, y, body + 1.6); continue; }
    // Body: broad mottling in two or three tones, never per-pixel noise.
    const m = fbm(x * 0.05 + seed, y * 0.06, seed * 0.1);
    let s = body + tone + (m > 0.55 ? -0.5 : 0);
    const cd = crackD(x, y);
    if (cd < 0.5) s = body + 2.8; else if (cd < 1.3 && hash(x, y, seed) < 0.6) s = body + 1.1;
    set(x, y, s);
  }
  // A few pits and flecks.
  const n = Math.floor(w * h / 220);
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash(seed, 40 + i) * (sw - 4)), y = 2 + Math.floor(hash(seed, 60 + i) * (sh - 4));
    set(x, y, body + 1.7); if (hash(seed, 80 + i) < 0.5) set(x - 1, y - 1, body - 0.9);
  }
  return { w, h, px };
}

const anims = {};
for (const theme of Object.keys(FLOOR_THEMES)) for (const [tw, th] of SLAB_SIZES) anims[`${theme}${tw}${th}`] = () => [0, 1, 2].map((v) => slab(theme, tw, th, v));

// Still, clear sea-green water: a flat body, short ripple glints and a rare sparkle.
function water(v) {
  const w = 16, h = 16, px = new Int16Array(w * h).fill(-1), R = FINE.sea;
  const set = (x, y, st) => { px[y * w + x] = IDX[R[st]]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, (y + v * 3) % 8 < 4 ? 5 : 6);
  for (let i = 0; i < 3; i++) {
    const y = (2 + i * 5 + v * 2) % 15, x0 = Math.floor(hash(v, i, 3) * 10), L = 2 + Math.floor(hash(v, i, 4) * 4);
    for (let x = x0; x < Math.min(16, x0 + L); x++) set(x, y, 3);
    if (x0 + L < 15) set(x0 + L, y, 4);
  }
  if (v === 2) set(11, 6, 1);
  return { w, h, px };
}
anims.water = () => [0, 1, 2, 3].map(water);

export default { floor: anims };
