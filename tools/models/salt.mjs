// The Saltreach (round 174, sheet 'salt'): the fourth region, the coast. The Lantern Chapel on its cliff (the way
// down to Our Lady of Nails), fishers' huts, boats and a wreck, net racks, sea stacks, salt pans, marram grass. Also
// the belfry's bell frames (chapter 5), Vael's gate towers, and two small creatures (a frog for the fen, a gull for the
// coast). Helpers are the fen's (tools/models/fen.mjs). Sizes follow the Saint (about 52 px head to feet).
import { Scene, sphere, ellipsoid, capsule, box, bumpy, render, clip, noise3, dot, pline } from '../sdf.mjs';
import { MATS } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const TILT = 0.38;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const NAME = Object.fromEntries(Object.entries(IDX).map(([k, v]) => [v, k]));
// A palette name by ramp and step (0 light to 8 dark), and the step of a name.
const step = (ramp, i) => FINE[ramp][clamp(Math.round(i), 0, 8)];
const stepOf = (nm) => { const m = nm && nm.match(/^([a-z]+)\d/); return m && FINE[m[1]] ? [m[1], FINE[m[1]].indexOf(nm)] : null; };

const FM = {
  ...MATS,
  stone: { ramp: 'stone', spec: 0.05, min: 1, bias: -0.08 }, stoneD: { ramp: 'stone', bias: -0.22, min: 2 }, stoneG: { ramp: 'moss', bias: -0.3, min: 3 },
  wood: { ramp: 'wood', spec: 0.08, bias: -0.04 }, woodB: { ramp: 'wood', bias: -0.16, min: 2 }, woodW: { ramp: 'shroud', spec: 0.05, bias: -0.06, min: 2 },
  thatch: { ramp: 'sand', spec: 0.03, bias: -0.18, min: 2 }, thatchD: { ramp: 'rot', bias: -0.2, min: 3 },
  slate: { ramp: 'slate', spec: 0.15, min: 1, bias: -0.06 }, iron: { ramp: 'iron', spec: 0.5, bias: -0.15, min: 2 }, bronze: { ramp: 'gold', spec: 0.5, bias: -0.25, min: 2 },
  hole: { ramp: 'ink', bias: -0.5, min: 6 }, weed: { ramp: 'moss', spec: 0.04, bias: -0.28, min: 3 }, weedL: { ramp: 'moss', bias: -0.1, min: 2 }, bark: { ramp: 'shroud', spec: 0.05, bias: -0.1, min: 2 },
  plaster: { ramp: 'sand', bias: -0.24, min: 3, max: 7 }, cloth: { ramp: 'cloth', bias: -0.1, min: 2 },
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
const groundY = (H, zf) => H - 0.5 - zf * TILT;
function rod(a, b, r, mat) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L = Math.hypot(bx, by, bz), ux = bx / L, uy = by / L, uz = bz / L;
  return { mat, bb: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
    f: (x, y, z) => { const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * ux + py * uy + pz * uz; const q = Math.hypot(px - ux * t, py - uy * t, pz - uz * t) - r; const e = Math.abs(t - L / 2) - L / 2; return Math.max(q, e) < 0 ? Math.max(q, e) : Math.hypot(Math.max(q, 0), Math.max(e, 0)); } };
}
const lump = (c, r, mat, seed = 0, amp = 0.8) => { const s0 = ellipsoid(c, r, mat); return { ...s0, bb: s0.bb.map((v, i) => v + (i < 3 ? -amp : amp)), f: (x, y, z) => s0.f(x, y, z) + amp * noise3(x * 0.45 + seed, y * 0.45, z * 0.45) }; };
// A roof prism along x: eaves at y = ye (front z = zf, back z = zb), ridge at y = yr.
function roof(x0, x1, zb, zf, ye, yr, mat) {
  const zm = (zb + zf) / 2, hz = (zf - zb) / 2, rise = ye - yr;
  return { mat, bb: [x0, yr - 1, zb - 1, x1, ye + 1, zf + 1], f: (x, y, z) => Math.max(x0 - x, x - x1, yr + (Math.abs(z - zm) / hz) * rise - y, y - ye) * 0.6 };
}
function castShadow(fr, { by = 3, maxT = 50, bias = 0.6, elev = 0.45 } = {}) {
  const d = fr.depth; if (!d) return fr;
  const L = [-0.49, -0.67, 0.55], lxy = Math.hypot(L[0], L[1]), ux = L[0] / lxy, uy = L[1] / lxy;
  const out = new Int16Array(fr.px);
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, z = d[i]; if (z < -1e8 || fr.px[i] < 0 || fr.px[i] === IDX.outline) continue;
    let hit = false;
    for (let t = 1.5; t < maxT; t += 1) { const qx = Math.round(x + ux * t), qy = Math.round(y + uy * t); if (qx < 0 || qy < 0 || qx >= fr.w || qy >= fr.h) break; if (d[qy * fr.w + qx] > z + t * elev + bias) { hit = true; break; } }
    if (!hit) continue;
    const q = stepOf(NAME[fr.px[i]]); if (!q) continue;
    out[i] = IDX[step(q[0], q[1] + by)];
  }
  fr.px = out; return fr;
}
const R = (S, w, h, o = {}) => castShadow(render(S, w, h, FM, { zmin: -90, zmax: 70, contrast: 1.25, contourDepth: 6, ground: h - 1, ...o }), o.shadow);
const blank = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const px2 = (fr, x, y, name) => { x = Math.floor(x / 2) * 2; y = Math.floor(y / 2) * 2; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) if (x + i >= 0 && y + j >= 0 && x + i < fr.w && y + j < fr.h) fr.px[(y + j) * fr.w + x + i] = IDX[name]; };
const solidAt = (fr, x, y) => x >= 0 && y >= 0 && x < fr.w && y < fr.h && fr.px[y * fr.w + x] >= 0 && fr.px[y * fr.w + x] !== IDX.outline;
// The tide line: anything near the foot of a frame that stood in water goes dark and green with weed.
function waterline(fr, h = 10, seed = 0) {
  for (let y = fr.h - h; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, q = stepOf(NAME[fr.px[i]]); if (!q) continue;
    const t = (y - (fr.h - h)) / h + (hash(x >> 1, y >> 1, seed) - 0.5) * 0.5;
    if (t > 0.55) fr.px[i] = IDX[step('moss', clamp(q[1] + 2, 5, 8))]; else if (t > 0.2) fr.px[i] = IDX[step(q[0], q[1] + 1)];
  }
  return fr;
}
// Weed and moss on stone and wood (recolours a few pixels).
function weeds(fr, seed, k = 0.2) {
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, nm = NAME[fr.px[i]]; if (!nm || !/^(stone|wood|slate)\d/.test(nm)) continue;
    const n = noise3(x * 0.16 + seed, y * 0.16, seed) * 0.5 + 0.5; if (n > 1 - k) fr.px[i] = IDX[step('moss', clamp(stepOf(nm)[1] + 1, 3, 7))];
  }
  return fr;
}


FM.chalk = { ramp: 'bone', spec: 0.03, bias: -0.1, min: 1 }; FM.chalkD = { ramp: 'stone', bias: -0.05, min: 1 }; FM.turfS = { ramp: 'moss', spec: 0.02, bias: -0.2, min: 2 };
FM.hull = { ramp: 'wood', spec: 0.05, bias: -0.14, min: 2 }; FM.pitch = { ramp: 'ink', spec: 0.1, bias: 0, min: 3 }; FM.net = { ramp: 'sand', bias: -0.2, min: 2 };
FM.lamp = { ramp: 'gold', spec: 0.6, min: 0 }; FM.frog = { ramp: 'moss', spec: 0.3, bias: 0.05, min: 1 }; FM.gull = { ramp: 'bone', spec: 0.2, min: 0 };

// ======================================================= lantern chapel ===
// A small whitewashed chapel on the cliff with a lantern tower: an open lamp room at the top, always lit. Its door is
// the way down.
function chapel() {
  const W = 176, H = 196, S = new View(), G = groundY(H, 16), cx = 80;
  S.add(bumpy(box([cx, G - 30, 0], [44, 32, 16], 0.8, 'chalk'), 0.5, 0.3, 3), 0);
  S.add(roof(cx - 50, cx + 50, -20, 20, G - 60, G - 96, 'slate'), 0.6);
  S.sub(box([cx - 10, G - 18, 16], [9, 19, 3], 1, 'hole'), 0);
  S.sub(box([cx + 24, G - 34, 16], [5, 9, 3], 1, 'hole'), 0);
  const tx = cx + 52; S.add(bumpy(box([tx, G - 70, -4], [14, 72, 14], 0.8, 'chalk'), 0.5, 0.3, 5), 0);
  for (const [dx, dz] of [[-12, 12], [12, 12], [-12, -12], [12, -12]]) S.add(box([tx + dx, G - 152, dz - 4], [2.2, 10, 2.2], 0.4, 'iron'), 0.2);
  S.add(box([tx, G - 143, -4], [15, 2, 15], 0.6, 'chalkD'), 0.3); S.add(box([tx, G - 163, -4], [15, 2, 15], 0.6, 'chalkD'), 0.3);
  S.add({ mat: 'slate', bb: [tx - 16, G - 186, -20, tx + 16, G - 164, 12], f: (x, y, z) => { const t = clamp((G - 165 - y) / 20, 0, 1), r = 15 * (1 - t); return Math.max(Math.abs(x - tx) - r, Math.abs(z + 4) - r, y - (G - 165), G - 186 - y) * 0.8; } }, 0);
  S.add(sphere([tx, G - 152, -4], 6, 'lamp'), 0);
  const fr = weeds(R(S, W, H), 4, 0.06);
  const wy = Math.round(G - 34 + 16 * TILT); for (let y = wy - 8; y < wy + 9; y++) for (let x = cx + 20; x < cx + 30; x++) if (/^ink[34]/.test(NAME[fr.px[y * fr.w + x]] || '')) px2(fr, x, y, y < wy - 2 ? 'gold1' : 'ember2');
  return fr;
}

// ============================================================ fisher hut ===
function hut(v) {
  const W = 120, H = 104, S = new View(), G = groundY(H, 14), cx = 58;
  S.add(bumpy(box([cx, G - 22, 0], [40, 24, 14], 0.8, 'stone'), 0.6, 0.35, v + 2), 0);
  S.add(bumpy(roof(cx - 46, cx + 46, -18, 18, G - 44, G - 76, 'turfS'), 0.8, 0.3, v), 0.6);
  S.sub(box([cx + (v ? -16 : 14), G - 15, 14], [7, 16, 3], 0.8, 'hole'), 0); S.sub(box([cx + (v ? 16 : -16), G - 24, 14], [6, 6, 3], 0.6, 'hole'), 0);
  for (const s0 of [-1, 1]) S.add(lump([cx + s0 * 30, G - 64, 0], [5, 2, 16], 'stoneD', s0 + v, 0.4), 0.6); // stones weighting the turf
  const fr = weeds(R(S, W, H), v + 3, 0.1);
  if (!v) { const wy = Math.round(G - 24 + 14 * TILT); for (let y = wy - 5; y < wy + 6; y++) for (let x = cx - 21; x < cx - 10; x++) if (/^ink[34]/.test(NAME[fr.px[y * fr.w + x]] || '')) px2(fr, x, y, 'ember2'); }
  return fr;
}

// ================================================================ boats ===
// v 0 a boat upturned on the shingle; v 1 the ribs of a wreck.
function boat(v) {
  const W = 120, H = 60, S = new View(), G = groundY(H, 14), cx = 58;
  if (!v) { const hull = ellipsoid([cx, G - 4, 0], [44, 16, 14], 'hull'); S.add(bumpy(clip(hull, (x, y) => y - G + 2), 0.4, 0.5, 2), 0); S.paint({ mat: 'pitch', f: (x, y, z) => (Math.abs(((x - cx) * 0.5) % 4) < 0.5 ? -1 : 1) }); }
  else { S.add(rod([cx - 46, G - 4, 0], [cx + 46, G - 6, 0], 2.2, 'hull'), 0.3); for (let k = 0; k < 7; k++) { const x = cx - 36 + k * 12, h = 26 - Math.abs(k - 3) * 3; for (const s0 of [-1, 1]) S.add(capsule([x, G - 4, 0], [x + 2, G - h, s0 * 12], 1.4, 1, 'hull'), 0.4); } S.add(rod([cx + 40, G - 6, 0], [cx + 52, G - 40, 0], 1.6, 'hull'), 0.3); }
  return weeds(R(S, W, H), v + 7, 0.12);
}

// ============================================================ net rack ===
function netrack() {
  const W = 92, H = 70, S = new View(), G = groundY(H, 8), cx = 44;
  for (const x of [cx - 34, cx + 34]) S.add(rod([x, G, 0], [x, G - 58, 0], 1.6, 'woodB'), 0.2);
  S.add(rod([cx - 36, G - 56, 0], [cx + 36, G - 56, 0], 1.2, 'woodB'), 0.2);
  const fr = R(S, W, H);
  for (let k = 0; k <= 12; k++) { const x = cx - 32 + k * 5.4; pline(fr, x, G - 55, x + (k % 2 ? 2 : -2), G - 18 - Math.sin(k) * 4, 'sand3'); }
  for (let j = 0; j < 6; j++) { const y = G - 52 + j * 6; pline(fr, cx - 32, y + (j > 3 ? 3 : 0), cx + 32, y, 'sand3h'); }
  for (let k = 0; k < 4; k++) dot(fr, cx - 20 + k * 13, G - 30 + (k % 2) * 6, 'stone2');
  return fr;
}

// =========================================================== sea stack ===
function stack(v) {
  const W = [70, 96][v], H = [110, 84][v], S = new View(), G = groundY(H, 10), cx = W / 2;
  S.add(bumpy({ mat: 'chalk', bb: [cx - 40, G - H, -24, cx + 40, G + 1, 24], f: (x, y, z) => { const t = clamp((G - y) / (H - 14), 0, 1), r = (v ? 40 : 28) * (1 - t * 0.55); return Math.max(Math.hypot((x - cx) * (v ? 0.9 : 1.1), z) - r, G - (H - 10) - y, y - G) * 0.8; } }, 1.6, 0.22, v + 4), 0);
  S.paint({ mat: 'chalkD', f: (x, y, z) => (noise3(x * 0.15 + v, y * 0.35, z * 0.15) > 0.25 ? -1 : 1) });
  S.add(clip(ellipsoid([cx, G - H + 14, 0], [v ? 26 : 18, 6, v ? 18 : 12], 'turfS'), (x, y) => y - (G - H + 16)), 1.2);
  return R(S, W, H);
}

// ========================================================== bell frame ===
// The belfry's bells (chapter 5): a heavy timber frame with a bronze bell; v 1 is silenced, wrapped in cloth.
function bellframe(v) {
  const W = 64, H = 80, S = new View(), G = groundY(H, 8), cx = 32;
  for (const x of [cx - 24, cx + 24]) S.add(box([x, G - 34, 0], [3, 34, 3], 0.6, 'woodB'), 0.3);
  S.add(box([cx, G - 68, 0], [28, 3, 4], 0.6, 'wood'), 0.3);
  S.add({ mat: 'bronze', bb: [cx - 16, G - 66, -16, cx + 16, G - 24, 16], f: (x, y, z) => { const t = clamp((y - (G - 64)) / 38, 0, 1), r = 6 + t * t * 11; return Math.max(Math.hypot(x - cx, z) - r, G - 64 - y, y - (G - 26)) * 0.8; } }, 1);
  if (v) { S.paint({ mat: 'cloth', f: (x, y, z) => (y > G - 54 && y < G - 32 ? -1 : 1) }); for (let k = 0; k < 3; k++) S.add(rod([cx - 18, G - 50 + k * 7, 10], [cx + 18, G - 46 + k * 7, 10], 0.6, 'net'), 0.2); }
  return R(S, W, H);
}

// ========================================================== gate tower ===
// Vael's gate towers (one each side of a gate in the town wall): a square stone tower with a crenellated top, an arrow
// slit and a brazier bracket.
function gatetower() {
  const W = 64, H = 150, S = new View(), G = groundY(H, 14), cx = 32;
  S.add(bumpy(box([cx, G - 58, 0], [24, 60, 16], 0.8, 'stone'), 0.6, 0.35, 6), 0);
  for (let k = 0; k < 4; k++) S.add(box([cx - 18 + k * 12, G - 124, 12], [3.6, 6, 4], 0.4, 'stone'), 0.3);
  S.add(box([cx, G - 117, 0], [26, 3, 18], 0.6, 'stoneD'), 0.4);
  S.sub(box([cx, G - 80, 16], [2, 9, 3], 0.4, 'hole'), 0);
  S.add(rod([cx + 18, G - 52, 16], [cx + 26, G - 52, 22], 1, 'iron'), 0.2); S.add(sphere([cx + 26, G - 54, 22], 3, 'iron'), 0.4);
  const fr = weeds(R(S, W, H), 8, 0.08); dot(fr, cx + 26, G - 60 + 22 * TILT, 'ember1'); dot(fr, cx + 26, G - 62 + 22 * TILT, 'gold1');
  return fr;
}

// ============================================================ creatures ===
function frog(f) { const W = 16, H = 12, S = new View(), G = groundY(H, 2), cx = 8, j = f ? 3 : 0;
  S.add(ellipsoid([cx, G - 3 - j, 0], [5, 3, 4], 'frog'), 0); S.add(ellipsoid([cx + 3, G - 5 - j, 0], [2.6, 2.2, 2.6], 'frog'), 1);
  for (const s0 of [-1, 1]) S.add(capsule([cx - 3, G - 2 - j, s0 * 3], [cx - 1 - (f ? 4 : 0), G - (f ? 1 : 0), s0 * 4], 1.1, 0.9, 'frog'), 0.6);
  const fr = R(S, W, H); dot(fr, cx + 4, G - 7 - j, 'ink2'); return fr; }
function gull(f) { const W = 24, H = 16, S = new View(), G = groundY(H, 2), cx = 12, up = f ? -1 : 1;
  S.add(ellipsoid([cx, G - 8, 0], [5, 2.6, 2.6], 'gull'), 0); S.add(sphere([cx + 5, G - 9.5, 0], 2, 'gull'), 1);
  for (const s0 of [-1, 1]) S.add(capsule([cx, G - 8, s0 * 2], [cx - 3, G - 8 - up * 5, s0 * 10], 1, 0.6, 'gull'), 0.6);
  const fr = R(S, W, H); dot(fr, cx + 7, G - 9.5, 'gold2'); return fr; }

FM.crab = { ramp: 'crimson', spec: 0.3, bias: -0.05, min: 1 };
function crab(f) { const W = 18, H = 12, S = new View(), G = groundY(H, 2), cx = 9;
  S.add(ellipsoid([cx, G - 3, 0], [5, 2.4, 3.6], 'crab'), 0);
  for (const s0 of [-1, 1]) { S.add(sphere([cx + s0 * 6, G - 4 - (f && s0 > 0 ? 1 : 0), 1.5], 1.8, 'crab'), 0.6); for (let k = 0; k < 2; k++) S.add(capsule([cx + s0 * 3, G - 2, -1 + k * 2], [cx + s0 * (6 + (f ? 1 : 0)), G, -2 + k * 3], 0.7, 0.6, 'crab'), 0.3); }
  const fr = R(S, W, H); dot(fr, cx - 1, G - 5, 'ink2'); dot(fr, cx + 1, G - 5, 'ink2'); return fr; }

// ======================================================== flat bits ===
function saltpan(v) { const W = 48, H = 26, fr = blank(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const e = x < 2 || y < 2 || x >= W - 2 || y >= H - 2 || x === 24 || x === 25; fr.px[y * W + x] = IDX[e ? 'stone3' : noise3(x * 0.3 + v, y * 0.3, v) > 0.25 ? 'bone1' : 'bone0']; } return fr; }
function marram(v) { const W = 18, H = 16, fr = blank(W, H); for (let k = 0; k < 9; k++) { const x = 3 + Math.floor(hash(k, 1, v) * 12), h = 6 + Math.floor(hash(k, 2, v) * 8), l = hash(k, 3, v) < 0.5 ? -1 : 1; for (let d = 0; d < h; d++) dot(fr, x + (d > h * 0.6 ? l : 0), H - 1 - d, d > h - 3 ? 'sand1h' : d > h * 0.4 ? 'sand2h' : 'moss2h'); } return fr; }

export default {
  salt: {
    chapel: () => [chapel()],
    hut: () => [0, 1].map(hut),
    boat: () => [0, 1].map(boat),
    netrack: () => [netrack()],
    stack: () => [0, 1].map(stack),
    bellframe: () => [0, 1].map(bellframe),
    gatetower: () => [gatetower()],
    frog: () => [0, 1].map(frog),
    gull: () => [0, 1].map(gull),
    crab: () => [0, 1].map(crab),
    saltpan: () => [0, 1].map(saltpan),
    marram: () => [0, 1].map(marram),
  },
};
