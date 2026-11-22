// Gore (round 180, sheet 'gore'): gibs by material, floor splats and burst animations for the eleven deaths in
// index.html (GORE_KINDS). Everything is drawn at half size ("lo") as lit metaball forms (blobs from vfx.mjs) and
// doubled, so it sits on the 2x2 chunky grid exactly. Gibs come in four quarter turns so they tumble in flight.
// Splats are flat and wet: a dark core, a lit rim on the top-left and a glint, never dithered.
import { blobs } from './vfx.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const frame = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const put = (f, x, y, name) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < f.w && y < f.h && IDX[name] !== undefined) f.px[y * f.w + x] = IDX[name]; };
const get = (f, x, y) => (x >= 0 && y >= 0 && x < f.w && y < f.h ? f.px[y * f.w + x] : -1);
const sh = (ramp, s) => FINE[ramp][clamp(Math.round(s), 0, 8)];
// Double a lo frame onto the chunky grid, centred anchor.
const up = (f) => { const w = f.w * 2, h = f.h * 2, px = new Int16Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = f.px[(y >> 1) * f.w + (x >> 1)]; return { w, h, px, ax: f.w, ay: f.h }; };
// A quarter turn of a lo frame (square frames keep their size).
const rot = (f, k) => { let g = f; for (let i = 0; i < k; i++) { const n = frame(g.h, g.w); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) n.px[x * n.w + (g.h - 1 - y)] = g.px[y * g.w + x]; g = n; } return g; };
const outline = (f, name = 'outline') => { const add = []; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { if (get(f, x, y) >= 0) continue; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => get(f, x + a, y + b) >= 0)) add.push([x, y]); } for (const [x, y] of add) put(f, x, y, name); return f; };

// ------------------------------------------------------------------ gibs ---
// Each gib is a small lit form on a 9x9 lo grid; four turns each.
function gibLo(mat, k) {
  const f = frame(9, 9), B = (balls, ramp, o = {}) => blobs(9, 9, balls, { ramp, outline: null, f, ...o });
  if (mat === 'flesh') {
    if (k === 0) { B([[4.5, 4.6, 2.8], [3, 3.6, 1.8], [6, 5.4, 1.7]], 'blood', { min: 1, max: 6, bias: 0.05 }); put(f, 3, 3, 'blood0'); put(f, 5, 6, 'blood4'); }
    if (k === 1) { B([[4.5, 4.8, 3.1], [2.4, 5, 1.5]], 'blood', { min: 2, max: 6 }); for (const x of [2, 4, 6]) { put(f, x, 3, 'bone1'); put(f, x, 4, 'bone2'); put(f, x, 5, 'bone3'); } }
    if (k === 2) { B([[2.2, 6, 1.7], [4, 4.5, 1.6], [5.6, 3.2, 1.5]], 'rot', { min: 1, max: 6 }); put(f, 7, 2, 'bone1'); put(f, 7, 1, 'bone0'); put(f, 6, 2, 'blood1'); put(f, 1, 7, 'blood2'); }
    if (k === 3) { B([[3, 3, 1.7], [5.2, 3.6, 1.6], [6, 5.6, 1.6], [3.6, 6, 1.6]], 'blood', { min: 2, max: 7, bias: -0.05 }); put(f, 4, 4, 'ink2'); put(f, 3, 2, 'rose2'); put(f, 5, 3, 'rose3'); }
    if (k === 4) { B([[3.4, 4, 2.4], [5.8, 5, 2.2]], 'shroud', { min: 1, max: 6 }); put(f, 4, 4, 'blood1'); put(f, 5, 4, 'blood2'); put(f, 5, 5, 'blood3'); put(f, 2, 3, 'shroud0'); }
    if (k === 5) { B([[4.5, 4.5, 2], [5.8, 5.6, 1.2]], 'blood', { min: 1, max: 6 }); put(f, 4, 3, 'blood0'); }
  } else if (mat === 'bone') {
    if (k === 0) { B([[4.5, 3.8, 3.1], [4.5, 6, 2]], 'bone', { min: 0, max: 6, bias: 0.05 }); put(f, 3, 4, 'ink1'); put(f, 6, 4, 'ink1'); put(f, 3, 5, 'ink2'); put(f, 6, 5, 'ink2'); put(f, 4, 6, 'ink2'); put(f, 4, 7, 'bone3'); put(f, 5, 7, 'bone3'); }
    if (k === 1) { B([[1.8, 2, 1.3], [7.2, 7, 1.3], [2.8, 2.8, 0.9], [3.8, 3.8, 0.9], [4.8, 4.8, 0.9], [5.8, 5.8, 0.9], [6.4, 6.4, 0.9]], 'bone', { min: 0, max: 6, k: 2.4 }); }
    if (k === 2) { for (let a = 0; a < 7; a++) { const t = 0.4 + a * 0.38, x = 4.5 + Math.cos(t + 1.4) * 3.4, y = 5.5 - Math.sin(t + 1.4) * 3.2; B([[x, y, 1]], 'bone', { min: 0, max: 5 }); } }
    if (k === 3) { B([[4.5, 4.5, 2.2], [2, 4.5, 1], [7, 4.5, 1], [4.5, 2, 1]], 'bone', { min: 0, max: 6 }); put(f, 4, 5, 'bone4'); }
    if (k === 4) { B([[2, 3, 1.3], [3.2, 5, 1.2], [5, 5.8, 1.2], [6.8, 5, 1.2], [7.4, 3, 1.1]], 'bone', { min: 0, max: 6 }); for (const x of [3, 4, 5, 6]) put(f, x, 4, 'bone0'); }
    if (k === 5) { B([[3.5, 5, 1.6], [5.4, 3.6, 1.4]], 'bone', { min: 1, max: 6 }); put(f, 6, 2, 'bone0'); }
  } else if (mat === 'bile') {
    if (k === 0) { B([[4.5, 4.5, 2.8], [3, 3.4, 1.6]], 'moss', { min: 1, max: 6, bias: 0.05 }); put(f, 3, 3, 'moss0'); put(f, 5, 6, 'sand2'); }
    if (k === 1) { B([[3.4, 4.6, 2.2], [5.8, 4, 2]], 'sand', { min: 2, max: 7 }); put(f, 3, 4, 'moss2'); put(f, 6, 3, 'moss3'); }
    if (k === 2) { B([[4.5, 4.5, 2.2], [6.4, 6, 1.3]], 'moss', { min: 2, max: 7 }); put(f, 4, 3, 'moss0'); }
  } else if (mat === 'iron') {
    if (k === 0) { B([[4.5, 4.8, 3.2]], 'iron', { min: 0, max: 6, bias: 0.05 }); for (let x = 2; x < 8; x++) put(f, x, 6, 'iron4'); put(f, 3, 4, 'ink1'); put(f, 6, 4, 'ink1'); }
    if (k === 1) { for (let y = 2; y < 8; y++) for (let x = 2; x < 7; x++) put(f, x, y, sh('iron', 1 + (x - 2) * 0.6 + (y - 2) * 0.4)); put(f, 2, 2, 'iron0'); put(f, 4, 4, 'gold1'); }
    if (k === 2) { for (let a = 0; a < 3; a++) B([[2.5 + a * 2, 3 + a * 1.4, 1.2]], 'iron', { min: 1, max: 5 }); put(f, 7, 7, 'blood1'); }
  }
  outline(f);
  return f;
}
const GIB_N = { flesh: 6, bone: 6, bile: 3, iron: 3 };
const gibs = (mat) => { const out = []; for (let k = 0; k < GIB_N[mat]; k++) { const g = gibLo(mat, k); for (let r = 0; r < 4; r++) out.push(up(rot(g, r))); } return out; };

// ----------------------------------------------------------------- splats ---
// A flat wet stain from a metaball field: depth 0 at the rim to 1 at the core. Lit on its top-left rim and given a
// glint, dark at the core; one ramp (blood, moss, violet...).
function stain(w, h, balls, { ramp = 'blood', core = 6, rim = 3, glint = true, dry = false, seed = 0 } = {}) {
  const f = frame(w, h), F = (x, y) => { let s = 0; for (const [bx, by, r] of balls) { const d2 = ((x - bx) ** 2 + (y - by) ** 2) / (r * r); if (d2 < 1.6) s += Math.exp(-d2 * 2.2); } return s; };
  const T = 0.32;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = F(x + 0.5, y + 0.5); if (v < T) continue;
    const dl = F(x - 0.5, y - 0.5), lit = dl < T; // the edge facing the light
    const deep = clamp((v - T) / 1.1, 0, 1);
    let s = dry ? core - deep * 1.5 : lit ? rim : core + 1 - deep * 1.6;
    if (!lit && F(x + 1.5, y + 1.5) < T) s = core + 2; // the shadowed far rim
    put(f, x, y, sh(ramp, s));
  }
  if (glint && !dry) { let best = null, bv = 0; for (const [bx, by, r] of balls) if (r > bv) { bv = r; best = [bx, by]; } if (best && bv > 1.6) { put(f, best[0] - bv * 0.35, best[1] - bv * 0.4, sh(ramp, 0)); put(f, best[0] - bv * 0.35 + 1, best[1] - bv * 0.4, sh(ramp, 1)); } }
  return f;
}
const drops = (cx, cy, n, R, seed, k = 0.6, rmin = 0.6, rmax = 1.3) => Array.from({ length: n }, (_, i) => { const a = hash(i, seed, 1) * Math.PI * 2, d = R * (0.75 + hash(i, seed, 2) * 0.6); return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * k, rmin + hash(i, seed, 3) * (rmax - rmin)]; });
function splatLo(v, ramp = 'blood', o = {}) {
  const w = 20, h = 13, cx = 10, cy = 6.5, R = 3 + hash(v, 1) * 1.6;
  const balls = [[cx, cy, R], [cx + (hash(v, 2) - 0.5) * 4, cy + (hash(v, 3) - 0.5) * 2, R * 0.75], ...drops(cx, cy, 5 + (v % 3), R + 3, v + 11), ...drops(cx, cy, 3, R + 1.4, v + 31, 0.6, 1, 1.6)];
  return stain(w, h, balls, { ramp, ...o });
}
// A streak thrown to the right: a tapering smear with drops flung past its end.
function streakLo(v, ramp = 'blood') {
  const w = 28, h = 11, cy = 5.5, balls = [];
  for (let i = 0; i < 10; i++) { const t = i / 9, x = 3 + t * 17, r = 2.6 * (1 - t * 0.7) + 0.4; balls.push([x, cy + Math.sin(t * 3 + v) * 0.8, r]); }
  for (let i = 0; i < 5; i++) balls.push([21 + i * 1.5 + hash(i, v) * 2, cy + (hash(i, v, 2) - 0.5) * 5, 0.5 + hash(i, v, 3) * 0.6]);
  balls.push([4, cy + 2.5, 1.2], [6, cy - 2.4, 0.9]);
  return stain(w, h, balls, { ramp });
}
// A body flattened: spokes thrown out all round a pool.
function radialLo(v, ramp = 'blood') {
  const w = 30, h = 20, cx = 15, cy = 10, balls = [[cx, cy, 4.2], [cx + 1.5, cy + 0.6, 3.4]];
  const n = 9 + (v % 3);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + hash(i, v) * 0.4, L = 7 + hash(i, v, 2) * 6; for (let s = 0; s <= 4; s++) { const d = 3 + (L - 3) * s / 4; balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.62, 1.3 * (1 - s / 5) + 0.35]); } balls.push([cx + Math.cos(a) * (L + 2), cy + Math.sin(a) * (L + 2) * 0.62, 0.7]); }
  return stain(w, h, balls, { ramp });
}
// A pool spreading under a body, in six sizes.
function poolLo(i) { const w = 24, h = 12, k = (i + 1) / 6; return stain(w, h, [[12, 6.5, 2 + 5.5 * k], [9 - k * 2, 6, 1.5 + 3.5 * k], [15 + k * 2, 7, 1.5 + 3 * k], [12, 5, 1 + 2 * k]], { ramp: 'blood', core: 5, rim: 3 }); }
function scorchLo(v) {
  const f = stain(20, 13, [[10, 6.5, 4.4], [7, 6, 3], [13, 7, 3], ...drops(10, 6.5, 6, 6, v + 50, 0.6, 0.6, 1.1)], { ramp: 'ink', core: 3, rim: 5, glint: false, dry: true });
  for (let i = 0; i < 5; i++) { const x = 6 + hash(i, v, 7) * 8, y = 4 + hash(i, v, 8) * 5; if (get(f, Math.round(x), Math.round(y)) >= 0) put(f, x, y, i % 2 ? 'ember2' : 'ember3'); }
  for (let i = 0; i < 4; i++) { const x = 5 + hash(i, v, 9) * 10, y = 3 + hash(i, v, 10) * 7; if (get(f, Math.round(x), Math.round(y)) >= 0) put(f, x, y, 'stone4'); }
  return f;
}
const dustLo = (v) => stain(20, 13, [[10, 6.5, 3.6], ...drops(10, 6.5, 7, 5, v + 70, 0.6, 0.6, 1.4)], { ramp: 'bone', core: 3, rim: 2, dry: true, glint: false });

// ------------------------------------------------------------ bursts ---
// Six frames: a wet core that throws lobes and droplets, then breaks into flying drops.
function burstLo(i, ramp, { n = 10, seed = 0, R = 11, max = 6 } = {}) {
  const w = 30, h = 24, cx = 15, cy = 13, k = (i + 1) / 6, balls = [];
  if (i < 3) balls.push([cx, cy, 4.6 - i * 0.9], [cx - 2, cy - 1.5, 3 - i * 0.6], [cx + 2.4, cy + 0.6, 3 - i * 0.6]);
  for (let j = 0; j < n; j++) {
    const a = j * (Math.PI * 2 / n) + hash(j, seed) * 0.6, d = R * k * (0.55 + hash(j, seed, 2) * 0.6), r = (2.2 - k * 1.5) * (0.7 + hash(j, seed, 3) * 0.6);
    if (r < 0.45) continue;
    balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.78 - (i > 2 ? (i - 2) * -0.8 : 0), r]);
    if (i >= 1 && i <= 3) balls.push([cx + Math.cos(a) * d * 0.6, cy + Math.sin(a) * d * 0.47, r * 0.7]); // the lobe's neck back to the core
  }
  const f = frame(w, h); blobs(w, h, balls, { ramp, min: 0, max, outline: 'ramp', bias: 0.06, f });
  if (i < 2) { put(f, cx - 2, cy - 3, sh(ramp, 0)); put(f, cx - 1, cy - 3, sh(ramp, 1)); }
  return f;
}
// Ectoplasm: a pale wet core that lifts and frays into wisps.
function ectoLo(i) {
  const w = 30, h = 26, cx = 15, cy = 16, k = i / 5, balls = [];
  balls.push([cx, cy - k * 4, 4.5 - k * 3]);
  for (let j = 0; j < 7; j++) { const a = j * 0.9 + 0.3, d = 3 + k * 8; balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.5 - k * (6 + j % 3 * 2), 2.2 - k * 1.5]); }
  return blobs(w, h, balls.filter((b) => b[2] > 0.4), { ramp: 'violet', min: 0, max: 5, outline: 'ramp', bias: 0.12 });
}
// Dust and bone grit: a grey puff that swells and thins.
function dustBurstLo(i) {
  const w = 30, h = 22, cx = 15, cy = 14, k = (i + 1) / 5, balls = [];
  for (let j = 0; j < 8; j++) { const a = j * 0.785 + 0.2, d = 3 + k * 8; balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.55 - k * 2, (3.2 - k * 1.6) * (0.8 + hash(j, 4) * 0.4)]); }
  balls.push([cx, cy - 1, 4 - k * 2.4]);
  const f = blobs(w, h, balls.filter((b) => b[2] > 0.4), { ramp: 'stone', min: 0, max: 5, outline: i < 3 ? 'ramp' : null, bias: 0.15, k: 1 });
  for (let j = 0; j < 6; j++) put(f, cx + Math.cos(j * 1.1) * (4 + k * 10), cy + Math.sin(j * 1.1) * (3 + k * 5), j % 2 ? 'bone1' : 'bone2');
  return f;
}
// Ash: a black heap that lifts as flakes with live embers in it.
function ashLo(i) {
  const w = 24, h = 22, cx = 12, cy = 16, k = i / 4, balls = [];
  for (let j = 0; j < 9; j++) { const a = j * 0.7, d = 2 + k * 7; balls.push([cx + Math.cos(a) * d * 0.8, cy - Math.abs(Math.sin(a)) * d * 0.4 - k * (4 + j % 4 * 2), 2.4 - k * 1.7]); }
  balls.push([cx, cy, 3.4 - k * 1.5]);
  const f = blobs(w, h, balls.filter((b) => b[2] > 0.4), { ramp: 'ink', min: 1, max: 6, outline: null, bias: 0.25 });
  for (let j = 0; j < 7; j++) { const x = cx + (hash(j, i, 3) - 0.5) * (6 + k * 12), y = cy - hash(j, i, 4) * (4 + k * 12); put(f, x, y, j % 3 ? 'ember1' : 'gold1'); }
  return f;
}

const many = (n, fn) => Array.from({ length: n }, (_, i) => up(fn(i)));
export default {
  gore: {
    g_flesh: () => gibs('flesh'), g_bone: () => gibs('bone'), g_bile: () => gibs('bile'), g_iron: () => gibs('iron'),
    s_blood: () => many(8, (v) => splatLo(v)), s_streak: () => many(4, (v) => streakLo(v)), s_streakv: () => many(4, (v) => rot(streakLo(v), 1)),
    s_radial: () => many(3, (v) => radialLo(v)), s_pool: () => many(6, poolLo),
    s_bile: () => many(4, (v) => splatLo(v + 20, 'moss', { core: 4, rim: 1 })), s_ecto: () => many(4, (v) => splatLo(v + 40, 'violet', { core: 3, rim: 1 })),
    s_scorch: () => many(3, scorchLo), s_dust: () => many(3, dustLo),
    b_blood: () => many(6, (i) => burstLo(i, 'blood', { seed: 1 })), b_bile: () => many(6, (i) => burstLo(i, 'moss', { seed: 7, n: 8, max: 5 })),
    b_ecto: () => many(6, ectoLo), b_dust: () => many(5, dustBurstLo), b_ash: () => many(5, ashLo),
  },
};
