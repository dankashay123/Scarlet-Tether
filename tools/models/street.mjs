// Street dressing for Vael (sheet 'street'): market booths, benches, hay,
// sacks, planters, a signpost, a trough, firewood, pots, a roadside shrine,
// pennant poles, crate stacks, plus flat ground bits (weeds, leaves, grates).
//
// Same 3/4 view as tools/models/town.mjs: the scene is sheared so tops catch
// the light. World axes: x right, y down, z toward the viewer; each prop's
// front foot sits on the frame's bottom row.
import { Scene, sphere, ellipsoid, capsule, box, folds, bumpy, render, clip, noise3, dot, pline } from '../sdf.mjs';
import { MATS } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const TILT = 0.38;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const NAME = Object.fromEntries(Object.entries(IDX).map(([k, v]) => [v, k]));

const SM = {
  ...MATS,
  stone: { ramp: 'stone', spec: 0.04, min: 1, bias: -0.08 }, stoneB: { ramp: 'stone', bias: -0.15, min: 1 },
  wood: { ramp: 'wood', spec: 0.08 }, woodB: { ramp: 'wood', bias: -0.08 }, woodL: { ramp: 'wood', bias: 0.06, min: 1 },
  bark: { ramp: 'shroud', spec: 0.05, min: 1 }, ring: { ramp: 'sand', min: 1, max: 6 },
  iron: { ramp: 'iron', spec: 0.6, bias: -0.12, min: 1 }, ironDark: { ramp: 'iron', spec: 0.4, bias: -0.3, min: 3 },
  hay: { ramp: 'sand', spec: 0.05, bias: 0.04, min: 1 }, hayB: { ramp: 'sand', bias: -0.1, min: 1 },
  sack: { ramp: 'bone', spec: 0.03, bias: -0.12, min: 1 }, sackB: { ramp: 'bone', bias: -0.2, min: 2 },
  cream: { ramp: 'cloth', spec: 0.04, min: 0, max: 6 }, red: { ramp: 'crimson', spec: 0.05 }, blue: { ramp: 'slate', spec: 0.05, bias: -0.04 },
  leaf: { ramp: 'moss', spec: 0.05, min: 1 }, leafB: { ramp: 'moss', bias: -0.12, min: 1 },
  clay: { ramp: 'pot', spec: 0.15 }, clayB: { ramp: 'pot', bias: -0.1 },
  water: { ramp: 'teal', spec: 0.9, bias: 0.06 }, gold: { ramp: 'gold', spec: 0.6 }, bone: { ramp: 'bone', spec: 0.2 },
  hole: { ramp: 'ink', bias: -0.5, min: 5 }, apple: { ramp: 'crimson', spec: 0.5, bias: 0.05 }, cabbage: { ramp: 'moss', spec: 0.2, bias: 0.08 },
};

// ------------------------------------------------------------- 3/4 view ---
function oblique(p) {
  const f = p.f;
  if (!p.bb) return { ...p, f: (x, y, z) => f(x, y - z * TILT, z) };
  const [x0, y0, z0, x1, y1, z1] = p.bb;
  return { ...p, bb: [x0, y0 + Math.min(z0, z1) * TILT, z0, x1, y1 + Math.max(z0, z1) * TILT, z1], f: (x, y, z) => f(x, y - z * TILT, z) };
}
class View extends Scene {
  add(p, k = 0, op = 'add') { return super.add(oblique(p), k, op); }
  paint(p) { return super.paint(oblique(p)); }
}
const sy = (y, z = 0) => y + z * TILT;
const groundY = (H, zf) => H - 0.5 - zf * TILT;
const slabBox = (x0, y0, x1, y1, zf, depth, mat, round = 0.3) => box([(x0 + x1) / 2, (y0 + y1) / 2, zf - depth / 2], [(x1 - x0) / 2 - round, (y1 - y0) / 2 - round, depth / 2 - round], round, mat);
function planked(p, w = 4, depth = 0.35, seed = 3) {
  const f = p.f;
  return { ...p, f: (x, y, z) => { const d = f(x, y, z); if (d > 2) return d; const fx = ((x % w) + w) % w; return d + (Math.min(fx, w - fx) < 0.6 ? depth : 0) + 0.06 * noise3(x * 0.3 + seed, y * 0.4, z); } };
}
function rod(a, b, r, mat) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L = Math.hypot(bx, by, bz), ux = bx / L, uy = by / L, uz = bz / L;
  return { mat, bb: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
    f: (x, y, z) => { const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * ux + py * uy + pz * uz; const q = Math.hypot(px - ux * t, py - uy * t, pz - uz * t) - r; const e = Math.abs(t - L / 2) - L / 2; return Math.max(q, e) < 0 ? Math.max(q, e) : Math.hypot(Math.max(q, 0), Math.max(e, 0)); } };
}
// A log lying along z (end grain toward the viewer).
const logZ = (x, y, z0, z1, r, mat) => rod([x, y, z0], [x, y, z1], r, mat);
const lump = (c, r, mat, seed = 0, amp = 0.8) => { const s0 = sphere(c, r, mat); return { ...s0, bb: s0.bb.map((v, i) => v + (i < 3 ? -amp : amp)), f: (x, y, z) => s0.f(x, y, z) + amp * noise3(x * 0.5 + seed, y * 0.5, z * 0.5) }; };

// Cast shadows from the depth map toward the bottom-right (light from the top-left).
function castShadow(fr, { by = 3, maxT = 40, bias = 0.6, elev = 0.45 } = {}) {
  const d = fr.depth; if (!d) return fr;
  const L = [-0.49, -0.67, 0.55], lxy = Math.hypot(L[0], L[1]), ux = L[0] / lxy, uy = L[1] / lxy;
  const out = new Int16Array(fr.px);
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, z = d[i]; if (z < -1e8 || fr.px[i] < 0 || fr.px[i] === IDX.outline) continue;
    let hit = false;
    for (let t = 1.5; t < maxT; t += 1) {
      const qx = Math.round(x + ux * t), qy = Math.round(y + uy * t); if (qx < 0 || qy < 0 || qx >= fr.w || qy >= fr.h) break;
      const zq = d[qy * fr.w + qx]; if (zq > z + t * elev + bias) { hit = true; break; }
    }
    if (!hit) continue;
    const nm = NAME[fr.px[i]], m = nm && nm.match(/^([a-z]+)\d/); if (!m || !FINE[m[1]]) continue;
    const k = FINE[m[1]].indexOf(nm); out[i] = IDX[FINE[m[1]][clamp(k + by, 0, 8)]];
  }
  fr.px = out; return fr;
}
const R = (S, w, h, o = {}) => castShadow(render(S, w, h, SM, { zmin: -80, zmax: 60, contrast: 1.25, contourDepth: 6, ground: h - 1, ...o }), o.shadow);
function outlineAll(fr, colour = 'outline') {
  const out = new Int16Array(fr.px);
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    if (fr.px[y * fr.w + x] >= 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < fr.w && yy < fr.h && fr.px[yy * fr.w + xx] >= 0 && fr.px[yy * fr.w + xx] !== IDX.outline) { out[y * fr.w + x] = IDX[colour]; break; } }
  }
  fr.px = out; return fr;
}
const blank = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });

// ======================================================= market booth ===
// A small street booth: two posts, a striped awning sloping toward the
// viewer, and a counter laid with produce. v 0 red/cream, v 1 blue/cream.
function stallAwning(v) {
  const W = 64, H = 56, S = new View(), G = groundY(H, 8);
  const stripe = v ? 'blue' : 'red';
  // Back board and posts.
  S.add(planked(slabBox(6, 16, 58, G - 10, -6, 3, 'woodB', 0.4), 5), 0);
  for (const x of [7, 57]) S.add(rod([x, 10, -6], [x, G, -6], 1.6, 'wood'), 0);
  // The counter, with a lip and planked front.
  S.add(planked(slabBox(6, 32, 58, G, 7.5, 13, 'wood', 0.5), 5), 0);
  S.add(slabBox(4, 30, 60, 33, 8.5, 15, 'woodL', 0.5), 0.3);
  // Goods: a crate of apples, cabbages, a basket of loaves.
  S.add(slabBox(10, 25, 24, 30.5, 3, 7, 'woodB', 0.3), 0);
  for (let k = 0; k < 6; k++) S.add(sphere([12 + (k % 3) * 4.5, 24.5 - (k > 2 ? 1 : 0), 1 - (k > 2 ? 3 : 0)], 2, 'apple'), 0.8);
  for (const [x, z] of [[33, 2], [39, 0], [36, -3]]) S.add(bumpy(sphere([x, 27, z], 3.2, 'cabbage'), 0.35, 0.9, x), 1);
  S.add(clip(ellipsoid([51, 28.5, 1], [6, 3, 4], 'wood'), (x, y) => 27 - y), 0);
  for (const x of [48, 52]) S.add(capsule([x, 26, 0], [x + 2.5, 25.5, 2], 1.6, 1.4, 'hay'), 0.6);
  // The awning: a slab tilted toward the viewer, with a scalloped valance.
  const ay = 6, z0 = -9, z1 = 1;
  S.add({ mat: 'cream', bb: [1, ay - 3, z0, 63, ay + 8, z1 + 1], f: (x, y, z) => { const t = (z - z0) / (z1 - z0), yy = ay + t * 5; return Math.max(Math.abs(y - yy) - 1.1, Math.abs(x - 32) - 31, Math.max(z0 - z, z - z1)); } }, 0);
  S.add({ mat: 'cream', bb: [1, ay + 3, z1 - 1, 63, ay + 11, z1 + 1], f: (x, y, z) => Math.max(Math.abs(z - z1) - 0.8, Math.abs(x - 32) - 31, y - (ay + 8.5 + 1.6 * Math.abs(Math.sin((x - 1) * Math.PI / 8))), (ay + 4.5) - y) }, 0.5);
  S.paint({ f: (x, y, z) => (y - z * TILT < ay + 11 && z < z1 + 1.2 && Math.floor((x - 1) / 8) % 2 ? -1 : 1), mat: stripe });
  for (const x of [7, 57]) S.add(rod([x, ay + 5, z1], [x, 30, z1], 1.3, 'woodB'), 0);
  const fr = R(S, W, H);
  // Seams between apples and a price slate.
  dot(fr, 44, Math.round(sy(31, 8.5)) - 1, 'ink2'); dot(fr, 45, Math.round(sy(31, 8.5)) - 1, 'ink2');
  for (let k = 0; k < 3; k++) dot(fr, 12 + k * 4.5, Math.round(sy(23.4, 1)), 'crimson0');
  return fr;
}

// ============================================================ bench ===
function bench() {
  const W = 36, H = 22, S = new View(), G = groundY(H, 4);
  S.add(planked(slabBox(2, 9, 34, 11.5, 4, 8, 'wood', 0.4), 5.5), 0);
  S.add(slabBox(3, 2, 33, 5, -4, 1.6, 'woodB', 0.4), 0);
  for (const x of [5, 31]) { S.add(slabBox(x - 1.2, 11, x + 1.2, G, 3.2, 1.8, 'woodB', 0.3), 0); S.add(slabBox(x - 1.2, 2, x + 1.2, G, -3.6, 1.6, 'woodB', 0.3), 0); }
  S.add(rod([4, 15, 0], [32, 15, 0], 0.7, 'woodB'), 0);
  return R(S, W, H);
}

// ============================================================== hay ===
function hayBale() {
  const W = 28, H = 22, S = new View(), G = groundY(H, 6);
  const bale = box([14, G - 6, 0], [10.5, 5.2, 5.2], 3, 'hay');
  S.add({ ...bale, f: (x, y, z) => bale.f(x, y, z) + 0.35 * noise3(x * 0.4, y * 1.6, z * 1.6) }, 0);
  const fr = R(S, W, H);
  // Straw streaks run along the bale; two dark cords bind it.
  for (let k = 0; k < 18; k++) { const x = 4 + Math.floor(hash(k, 3) * 18), y = 5 + Math.floor(hash(k, 5) * 13), L = 2 + Math.floor(hash(k, 9) * 3); for (let d = 0; d < L; d++) { const i = y * W + x + d; if (fr.px[i] >= 0 && fr.px[i] !== IDX.outline) fr.px[i] = IDX[hash(k, 7) < 0.5 ? 'sand1' : 'sand4']; } }
  for (const x of [9, 19]) for (let y = 0; y < H; y++) { const i = y * W + x; if (fr.px[i] >= 0 && fr.px[i] !== IDX.outline) fr.px[i] = IDX[/sand[0-3]/.test(NAME[fr.px[i]]) ? 'wood4' : 'wood6']; }
  for (const [x, y, c] of [[2, H - 2, 'sand3'], [25, H - 3, 'sand2'], [4, H - 1, 'sand3'], [26, H - 1, 'sand4']]) dot(fr, x, y, c);
  return fr;
}

// ============================================================ sacks ===
function sacks() {
  const W = 30, H = 22, S = new View(), G = groundY(H, 6);
  const sack = (x, y, z, rx, ry, mat, tilt = 0) => {
    S.add(folds(ellipsoid([x, y, z], [rx, ry, rx * 0.8], mat), { cx: x, cz: z, n: 6, amp: 0.3, y0: y - ry, y1: y + ry }), 1.2);
    S.add(capsule([x + tilt, y - ry + 0.5, z], [x + tilt * 1.6, y - ry - 2.6, z], 1.6, 1, mat), 1);
  };
  sack(9, G - 6, 1, 6.5, 6, 'sack', -0.6);
  sack(21, G - 5.5, 2, 6, 5.5, 'sackB', 0.5);
  sack(15, G - 12, -3, 5.5, 5, 'sack', 0.2);
  const fr = R(S, W, H);
  // Ties and a stencilled mark; a spill of grain.
  for (const [x, y] of [[8, 6], [22, 10], [16, 1]]) { dot(fr, x, y, 'wood4'); dot(fr, x + 1, y, 'wood4'); }
  pline(fr, 18, 14, 22, 14, 'crimson3'); dot(fr, 20, 13, 'crimson3'); dot(fr, 20, 15, 'crimson3');
  for (const [x, y] of [[26, H - 1], [27, H - 2], [24, H - 1]]) dot(fr, x, y, 'sand2');
  return outlineAll(fr);
}

// ========================================================== planter ===
function planter(v) {
  const W = 30, H = 28, S = new View(), G = groundY(H, 6);
  const tub = slabBox(3, G - 10, 27, G, 6, 12, 'stone', 0.7);
  S.add({ ...tub, f: (x, y, z) => tub.f(x, y, z) + 0.25 * noise3(x * 0.6, y * 0.6, z * 0.6) }, 0);
  S.add(slabBox(2, G - 11.5, 28, G - 8.5, 7, 14, 'stoneB', 0.6), 0.3);
  S.add(clip(lump([15, G - 10, 0], 9, 'bark', v, 0.4), (x, y) => (G - 10.5) - y), 0);
  // A shrub (v 0) or a row of flowers (v 1).
  if (v === 0) {
    S.add(bumpy(sphere([15, G - 16, 0], 7, 'leaf'), 0.9, 0.7, 2), 1.5);
    S.add(bumpy(sphere([10, G - 13, 2], 4.5, 'leafB'), 0.8, 0.8, 5), 1.5);
    S.add(bumpy(sphere([20, G - 13, 2], 4.5, 'leafB'), 0.8, 0.8, 7), 1.5);
  } else {
    for (let k = 0; k < 5; k++) { const x = 6 + k * 4.5, z = (k % 2) * 3 - 1.5; S.add(rod([x, G - 10, z], [x + (k - 2) * 0.4, G - 15 - (k % 2) * 2, z], 0.6, 'leafB'), 0.4); S.add(bumpy(sphere([x, G - 13, z], 2.4, 'leaf'), 0.5, 1, k), 0.8); }
  }
  const fr = R(S, W, H);
  if (v === 1) for (let k = 0; k < 5; k++) { const x = Math.round(6 + k * 4.5 + (k - 2) * 0.4), y = Math.round(sy(G - 15.5 - (k % 2) * 2, (k % 2) * 3 - 1.5)); const c = ['crimson1', 'gold1', 'violet1', 'crimson1', 'bone0'][k]; dot(fr, x, y, c); dot(fr, x + 1, y, c); dot(fr, x, y - 1, c); dot(fr, x + 1, y + 1, c.replace(/\d$/, '3')); }
  else for (const [x, y] of [[12, 6], [18, 9], [9, 11], [21, 12]]) dot(fr, x, y, 'moss0');
  return outlineAll(fr);
}

// ========================================================= signpost ===
function signpost() {
  const W = 26, H = 46, S = new View(), G = groundY(H, 2);
  S.add(rod([13, 3, 0], [13, G, 0], 1.6, 'wood'), 0);
  S.add(rod([13, 1.5, 0], [13, 3.5, 0], 2.1, 'woodB'), 0);
  // Two arrow boards pointing opposite ways.
  const arrow = (y, dir, mat) => ({ mat, bb: [0, y - 4, -1.5, 26, y + 4, 1.5], f: (x, yy, z) => { const tip = dir > 0 ? 24 : 2, base = dir > 0 ? 3 : 23; const along = (x - base) * dir, L = Math.abs(tip - base); const half = along > L - 4 ? 3.2 * (L - along) / 4 : 3.2; return Math.max(Math.abs(yy - y) - half, -along, along - L, Math.abs(z) - 1) - 0.2; } });
  S.add(planked(arrow(10, 1, 'woodL'), 30), 0.2);
  S.add(planked(arrow(18, -1, 'woodB'), 30), 0.2);
  S.add(lump([13, G, 0], 3, 'stoneB', 2, 0.5), 0.6);
  const fr = R(S, W, H);
  // Painted letters on the boards.
  for (let x = 6; x < 18; x += 2) dot(fr, x, Math.round(sy(10, 1)), 'ink3');
  for (let x = 10; x < 21; x += 2) dot(fr, x, Math.round(sy(18, 1)), 'ink3');
  return fr;
}

// =========================================================== trough ===
function trough() {
  const W = 40, H = 22, S = new View(), G = groundY(H, 6);
  const t0 = slabBox(2, G - 8, 38, G, 6, 18, 'stone', 0.8), cut = slabBox(4.5, G - 12, 35.5, G - 3, 3.5, 13, 'stone', 0.4);
  S.add({ ...t0, f: (x, y, z) => Math.max(t0.f(x, y, z), -cut.f(x, y, z)) + 0.2 * noise3(x * 0.5, y * 0.5, z * 0.5) }, 0);
  S.add(slabBox(4.5, G - 6.5, 35.5, G - 5, 3.5, 13, 'water', 0.2), 0);
  const fr = R(S, W, H);
  // Ripples and a glint on the water; moss at the foot.
  const wy = Math.round(sy(G - 6.5, -2));
  for (const [x, l] of [[9, 4], [22, 5], [15, 3]]) pline(fr, x, wy + (x % 3), x + l, wy + (x % 3), 'teal2');
  dot(fr, 28, wy + 1, 'white');
  for (const x of [3, 4, 36]) dot(fr, x, H - 2, 'moss3');
  return fr;
}

// ========================================================= woodpile ===
function woodpile() {
  const W = 32, H = 22, S = new View(), G = groundY(H, 7);
  const ends = [];
  const rows = [[5, 4.4, [6, 13, 20, 27]], [4, 11.5, [9.5, 16.5, 23.5]], [3, 18, [13, 20]]];
  for (const [, dy, xs] of rows) for (const x of xs) { const y = G - dy, r = 3.4; S.add(logZ(x, y, -6, 6, r, 'bark'), 0.2); ends.push([x, y, r]); }
  const fr = R(S, W, H);
  // End grain with rings, by hand, on the near caps.
  for (const [x, y, r] of ends) {
    const cy = sy(y, 6);
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const d = Math.hypot(xx, yy); if (d > r - 0.5) continue; const X = Math.round(x + xx), Y = Math.round(cy + yy); const c = d < 0.9 ? 'wood5' : d < 1.9 ? 'sand3' : d < 2.6 ? 'sand2' : 'wood3'; dot(fr, X, Y, (xx < 0 && yy < 0 && d > 1.9) ? 'sand1' : c); }
  }
  return outlineAll(fr);
}

// ===================================================== bucket, pot ===
function bucket() {
  const W = 12, H = 14, S = new View(), G = groundY(H, 4);
  const b0 = { mat: 'wood', bb: [1, 3, -5, 11, G + 1, 5], f: (x, y, z) => { const r = 4.6 - (y - 4) * 0.08; return Math.max(Math.hypot(x - 6, z) - r, 4 - y, y - G); } };
  S.add(planked(b0, 2.2, 0.25), 0);
  S.add(clip(rod([6, 4, 0], [6, 4.6, 0], 4, 'water'), () => -1), 0);
  for (const y of [6, G - 1.5]) S.add({ mat: 'iron', bb: [0, y - 1, -6, 12, y + 1, 6], f: (x, yy, z) => Math.max(Math.abs(Math.hypot(x - 6, z) - (4.7 - (y - 4) * 0.08)) - 0.5, Math.abs(yy - y) - 0.6) }, 0);
  const fr = R(S, W, H);
  pline(fr, 1, 4, 3, 1, 'iron3'); pline(fr, 3, 1, 8, 1, 'iron3'); pline(fr, 8, 1, 10, 4, 'iron3');
  dot(fr, 5, 4, 'white');
  return outlineAll(fr);
}
function pot() {
  const W = 14, H = 16, S = new View(), G = groundY(H, 5);
  S.add(bumpy(ellipsoid([7, G - 5, 0], [5.4, 5, 5], 'clay'), 0.12, 1.2), 0);
  S.add(rod([7, G - 11, 0], [7, G - 9, 0], 3, 'clay'), 1.2);
  S.add(rod([7, G - 12, 0], [7, G - 11, 0], 3.6, 'clayB'), 0.4);
  S.add(rod([7, G - 12.4, 0], [7, G - 11.4, 0], 2.4, 'hole'), 0, 'sub');
  const fr = R(S, W, H);
  dot(fr, 4, Math.round(G - 7), 'pot1'); dot(fr, 4, Math.round(G - 6), 'pot2');
  return fr;
}

// ===================================================== roadside shrine ===
function shrineSmall() {
  const W = 22, H = 44, S = new View(), G = groundY(H, 4);
  S.add(rod([11, 20, 0], [11, G, 0], 2, 'stone'), 0);
  S.add(bumpy(slabBox(5, G - 3, 17, G, 4, 8, 'stoneB', 0.6), 0.25, 0.6), 0);
  // A little house-shaped niche with a pitched cap.
  const niche = slabBox(4, 7, 18, 21, 3.5, 7, 'stone', 0.6);
  const hole = { mat: 'hole', bb: [6, 9, -2, 16, 20, 6], f: (x, y, z) => Math.max(Math.abs(x - 11) - 4, Math.max(y - 19.5, 13 - y < 0 ? Math.hypot(x - 11, y - 13) - 4 : -1), -(z - 1.5)) };
  S.add({ ...niche, f: (x, y, z) => Math.max(niche.f(x, y, z), -hole.f(x, y, z)) }, 0);
  S.add({ mat: 'woodB', bb: [1, 0, -2, 21, 9, 6], f: (x, y, z) => Math.max(Math.abs(x - 11) * 0.62 + (y - 8.5) * 0.9 - 0.2, 4.5 - y, Math.abs(z - 2) - 4) }, 0.3);
  // A tiny saint figure and a candle inside.
  S.add(capsule([11, 18.5, 1], [11, 14.5, 1], 1.8, 1.2, 'bone'), 0.6);
  S.add(sphere([11, 13, 1], 1.5, 'bone'), 0.4);
  const fr = R(S, W, H);
  // Halo, candle and its flame.
  const hy = Math.round(sy(11, 1));
  dot(fr, 10, hy, 'gold1'); dot(fr, 11, hy - 1, 'gold0'); dot(fr, 12, hy, 'gold1');
  const cy = Math.round(sy(19.5, 3.5));
  for (const x of [7, 15]) { dot(fr, x, cy, 'bone1'); dot(fr, x, cy - 1, 'bone0'); dot(fr, x, cy - 2, 'flame1'); dot(fr, x, cy - 3, 'flame0'); }
  for (const [x, y] of [[8, H - 2], [14, H - 1]]) dot(fr, x, y, 'moss2');
  return fr;
}

// ======================================================= pennant pole ===
function buntingPole(v = 0) {
  const W = 16, H = 56, S = new View(), G = groundY(H, 2);
  S.add(rod([4, 3, 0], [4, G, 0], 1.1, 'wood'), 0);
  S.add(sphere([4, 2.4, 0], 1.6, 'gold'), 0);
  S.add(lump([4, G, 0], 2.6, 'stoneB', 4, 0.4), 0.6);
  // A swallow-tailed pennant rippling to the right.
  const flag = { mat: v ? 'blue' : 'red', bb: [4, 3, -2, 16, 15, 2], f: (x, y, z) => { const t = (x - 5) / 10, top = 4.5 + t * 1.5 + Math.sin(t * 5) * 0.8, bot = 13 - t * 1.5 + Math.sin(t * 5) * 0.8; const notch = t > 0.75 ? 1.6 - Math.abs(y - (top + bot) / 2) * 0.9 : -9; return Math.max(top - y, y - bot, 5 - x, x - 15, Math.abs(z - Math.sin(t * 6) * 0.6) - 0.6, -notch < 0 ? 1 : -9); } };
  S.add(flag, 0);
  const fr = R(S, W, H);
  // A gold sigil on the pennant.
  dot(fr, 9, 9, 'gold1'); dot(fr, 9, 10, 'gold1'); dot(fr, 8, 9, 'gold2'); dot(fr, 10, 9, 'gold2');
  return fr;
}

// ======================================================== crate stack ===
function crateBox(S, cx, by, z, s, mat) {
  // A cube with a raised frame round every face and a diagonal brace.
  S.add(planked(box([cx, by - s, z], [s, s, s], 0.4, mat), 3), 0);
  const e = 1.1;
  for (const [dx, dy] of [[-1, 0], [1, 0]]) S.add(slabBox(cx + dx * (s - e / 2) - e / 2, by - 2 * s, cx + dx * (s - e / 2) + e / 2, by, z + s + 0.3, 2 * s + 0.6, 'woodB', 0.2), 0);
  for (const yy of [by - 2 * s + e / 2, by - e / 2]) S.add(slabBox(cx - s, yy - e / 2, cx + s, yy + e / 2, z + s + 0.3, 2 * s + 0.6, 'woodB', 0.2), 0);
  S.add(rod([cx - s + 1.2, by - 1.2, z + s + 0.25], [cx + s - 1.2, by - 2 * s + 1.2, z + s + 0.25], 0.55, 'woodB'), 0);
}
function crateStack() {
  const W = 30, H = 36, S = new View(), G = groundY(H, 6);
  crateBox(S, 9, G, 0, 6, 'wood');
  crateBox(S, 21.5, G, -1, 5.6, 'woodL');
  crateBox(S, 14.5, G - 12, -1.5, 5.6, 'wood');
  const fr = R(S, W, H);
  // Iron corner nails.
  for (const [x, y] of [[4, 21], [14, 21], [10, 9], [19, 9]]) dot(fr, x, y, 'wood5');
  return fr;
}

// ===================================================== ground details ===
// Flat bits drawn on the ground under everything: no shading, no outline.
function weeds(v) {
  const W = 16, H = 10, fr = blank(W, H);
  const blades = [[[3, 9, -1, 6], [5, 9, 0, 7], [6, 9, 1, 5], [8, 9, 2, 4]], [[4, 9, 1, 5], [7, 9, -1, 8], [9, 9, 1, 6], [11, 9, 2, 4], [13, 9, 1, 3]], [[2, 9, 0, 4], [6, 9, -2, 6], [8, 9, 0, 9], [10, 9, 2, 6], [12, 9, 1, 3]]][v];
  for (const [x, y, lean, h] of blades) {
    for (let k = 0; k < h; k++) dot(fr, x + lean * k / h, y - k, k < 2 ? 'moss4' : k < h - 2 ? 'moss3' : 'moss2');
    dot(fr, x + lean, y - h, 'moss1');
  }
  for (let x = 2; x < 14; x++) if (fr.px[9 * W + x] < 0 && hash(x, v) < 0.5) dot(fr, x, 9, 'moss5');
  if (v === 2) { dot(fr, 8, 0, 'gold1'); dot(fr, 7, 1, 'gold2'); dot(fr, 9, 1, 'gold2'); }
  return fr;
}
function leaves(v) {
  const W = 20, H = 10, fr = blank(W, H);
  const cols = [['ember2', 'ember3'], ['sand2', 'sand3'], ['wood2', 'wood4']][v];
  for (let k = 0; k < 7; k++) {
    const x = 1 + Math.floor(hash(k, v, 1) * 17), y = 1 + Math.floor(hash(k, v, 2) * 8), c = cols[k % 2];
    if (v === 1) { pline(fr, x, y, x + 3, y + (k % 2 ? 1 : -1), c); continue; } // straw
    dot(fr, x, y, c); dot(fr, x + 1, y, c); dot(fr, x + 1, y + 1, cols[1]);
    if (k % 3 === 0) dot(fr, x + 2, y + 1, cols[1]);
  }
  return fr;
}
function grate() {
  const W = 24, H = 14, fr = blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1, frame = x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2;
    if (edge) dot(fr, x, y, 'outline');
    else if (frame) dot(fr, x, y, y <= 1 || x <= 1 ? 'iron3' : 'iron5');
    else if ((x - 2) % 3 === 2) dot(fr, x, y, x < 8 && y < 5 ? 'iron3' : 'iron4');
    else dot(fr, x, y, y < 4 ? 'ink1' : 'ink0');
  }
  dot(fr, 1, 1, 'iron1'); dot(fr, 20, 4, 'teal4'); dot(fr, 21, 5, 'teal4');
  return fr;
}

export default {
  street: {
    stall_awning: () => [0, 1].map(stallAwning),
    bench: () => [bench()],
    hay: () => [hayBale()],
    sacks: () => [sacks()],
    planter: () => [0, 1].map(planter),
    signpost: () => [signpost()],
    trough: () => [trough()],
    woodpile: () => [woodpile()],
    bucket: () => [bucket()],
    pot: () => [pot()],
    shrine_small: () => [shrineSmall()],
    bunting_pole: () => [0, 1].map(buntingPole),
    crate_stack: () => [crateStack()],
    weeds: () => [0, 1, 2].map(weeds),
    leaves: () => [0, 1, 2].map(leaves),
    grate: () => [grate()],
  },
};
