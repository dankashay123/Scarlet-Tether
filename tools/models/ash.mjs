// The Ashfields (round 173, sheet 'ash'): the third outdoor region. Burnt farms, Ide's mill that still turns,
// charred trees, scarecrows, burnt stooks, the bell foundry's furnace, the abbey's crypt door (the way down to the Wall
// of Names), and flat bits (ash, stubble, embers) baked into the ground. Helpers are the fen's (tools/models/fen.mjs).
// Sizes follow the Saint (about 52 px head to feet).
import { Scene, sphere, ellipsoid, capsule, box, bumpy, folds, render, clip, noise3, dot, pline } from '../sdf.mjs';
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


const soot = (fr, seed, k = 0.3) => { // char: darken stone, wood and thatch in noisy patches
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const i = y * fr.w + x, q = stepOf(NAME[fr.px[i]]); if (!q || !/^(stone|wood|sand|rot|roof|brick)$/.test(q[0])) continue;
    const n = noise3(x * 0.12 + seed, y * 0.12, seed) * 0.5 + 0.5; if (n > 1 - k) fr.px[i] = IDX[step('ink', clamp(q[1] - 2, 3, 8))]; else if (n > 1 - k * 1.8) fr.px[i] = IDX[step(q[0], q[1] + 2)]; }
  return fr;
};
FM.char = { ramp: 'ink', spec: 0.05, bias: -0.1, min: 3 }; FM.ember = { ramp: 'ember', spec: 0.3, min: 0 }; FM.brick = { ramp: 'brick', spec: 0.03, bias: -0.1, min: 1 };
FM.cloth = { ramp: 'shroud', spec: 0.03, bias: -0.08, min: 2 }; FM.straw = { ramp: 'sand', spec: 0.04, bias: -0.06, min: 1 }; FM.sack = { ramp: 'sand', spec: 0.02, bias: -0.2, min: 2 };

// ========================================================= burnt farm ===
// A farmhouse after the fire: stone walls standing, the roof gone to black rafters, a chimney; v 1 a long barn.
function farm(v) {
  const W = v ? 150 : 124, H = 110, S = new View(), G = groundY(H, 16), cx = W / 2, hw = v ? 62 : 48;
  S.add(bumpy(box([cx, G - 24, 0], [hw, 26, 14], 0.8, 'stone'), 0.7, 0.35, v + 7), 0);
  S.sub(clip(box([cx, G - 44, 0], [hw + 2, 10, 16], 0.5, 'stone'), (x, y) => (G - 50 + Math.abs(Math.sin(x * 0.21 + v)) * 12) - y), 0); // broken wall tops
  S.sub(box([cx - hw * 0.45, G - 22, 14], [7, 10, 3], 0.6, 'hole'), 0); S.sub(box([cx + hw * 0.45, G - 22, 14], [7, 10, 3], 0.6, 'hole'), 0);
  S.sub(box([cx + (v ? 0 : 8), G - 14, 14], [v ? 14 : 8, 15, 3], 0.6, 'hole'), 0);
  for (let k = 0; k < (v ? 7 : 5); k++) { const x = cx - hw + 10 + k * ((hw * 2 - 20) / ((v ? 7 : 5) - 1)); S.add(rod([x, G - 46, 13], [x + (k % 2 ? 3 : -2), G - 74 + (k % 3) * 6, -2], 1.4, 'char'), 0.3); }
  S.add(rod([cx - hw + 6, G - 72, 0], [cx + hw - 20, G - 66, 0], 1.6, 'char'), 0.3);
  S.add(bumpy(box([cx + hw - 12, G - 58, -6], [6, 30, 6], 0.6, 'stone'), 0.5, 0.4, 3), 0.4);
  for (const [x, z, r] of [[cx - 20, 18, 5], [cx + 26, 17, 4], [cx - 40, 16, 4]]) S.add(lump([x, G - 2, z], [r, r * 0.5, r * 0.7], 'char', x, 0.6), 1);
  const fr = soot(weeds(R(S, W, H), v + 9, 0.08), v + 2, 0.32);
  for (let k = 0; k < 10; k++) { const x = Math.floor(hash(k, 3, v) * fr.w), y = fr.h - 2 - Math.floor(hash(k, 4, v) * 8); if (solidAt(fr, x, y)) px2(fr, x, y, hash(k, 5) < 0.5 ? 'ember1' : 'ember2'); }
  return fr;
}

// ================================================================ mill ===
// Ide's mill: a stone tower with a cap of boards and four sails (two frames turn them), a door and a lit window.
function mill(f) {
  const W = 150, H = 190, S = new View(), G = groundY(H, 14), cx = 70;
  S.add(bumpy({ mat: 'stone', bb: [cx - 30, G - 112, -24, cx + 30, G + 1, 24], f: (x, y, z) => { const t = clamp((G - y) / 110, 0, 1), r = 26 - t * 8; return Math.max(Math.hypot(x - cx, z) - r, G - 110 - y, y - G); } }, 0.5, 0.3, 2), 0);
  S.add({ mat: 'wood', bb: [cx - 24, G - 140, -20, cx + 24, G - 104, 20], f: (x, y, z) => { const t = clamp((G - 106 - y) / 32, 0, 1), r = 21 * (1 - t * 0.85); return Math.max(Math.hypot(x - cx, z) - r, G - 140 - y, y - (G - 106)) * 0.8; } }, 0.6);
  S.sub(box([cx, G - 14, 22], [8, 15, 4], 1, 'hole'), 0); S.sub(box([cx + 4, G - 64, 20], [4, 6, 4], 1, 'hole'), 0);
  const hub = [cx + 4, G - 118, 24]; S.add(sphere(hub, 3.4, 'iron'), 0.4);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + f * Math.PI / 4 + 0.35, e = [hub[0] + Math.cos(a) * 60, hub[1] + Math.sin(a) * 60, hub[2] + 2];
    S.add(rod(hub, e, 1.4, 'woodB'), 0.2);
    const m = [hub[0] + Math.cos(a) * 36, hub[1] + Math.sin(a) * 36, hub[2] + 2.6], px = -Math.sin(a), py = Math.cos(a);
    S.add({ mat: 'straw', bb: [m[0] - 28, m[1] - 28, m[2] - 2, m[0] + 28, m[1] + 28, m[2] + 2], f: (x, y, z) => { const dx = x - m[0], dy = y - m[1], u = dx * Math.cos(a) + dy * Math.sin(a), w = dx * px + dy * py; return Math.max(Math.abs(u) - 22, Math.abs(w - 5) - 5, Math.abs(z - m[2]) - 0.8); } }, 0); }
  const fr = weeds(R(S, W, H), 4, 0.1);
  const wy = Math.round(G - 64 + 20 * TILT); for (let y = wy - 5; y < wy + 5; y++) for (let x = cx + 1; x < cx + 8; x++) if (/^ink[34]/.test(NAME[fr.px[y * fr.w + x]] || '')) px2(fr, x, y, y < wy - 1 ? 'ember2' : 'ember3');
  return fr;
}

// ======================================================== charred tree ===
function chartree(v) {
  const W = 104, H = 132, S = new View(), G = groundY(H, 5), cx = 50;
  const grow = (a, ang, len, r, depth, seed) => { const b = [a[0] + Math.sin(ang) * len, a[1] - Math.cos(ang) * len, a[2] + (hash(seed, 1, v) - 0.5) * 6]; S.add(capsule(a, b, r, r * 0.62, 'char'), r > 2 ? 1.2 : 0.5); if (depth <= 0 || r < 0.8) return; for (let k = 0; k < 2; k++) grow(b, ang + (k ? 0.6 : -0.5) + (hash(seed, k + 2, v) - 0.5) * 0.5, len * 0.66, r * 0.6, depth - 1, seed * 3 + k + 1); };
  for (const [dx, dz] of [[-9, 3], [8, 2]]) S.add(capsule([cx, G - 8, 0], [cx + dx, G, dz], 3.4, 1.2, 'char'), 1.2);
  S.add(capsule([cx, G, 0], [cx - 2 + v * 3, G - 50, 0], 6.4, 4.4, 'char'), 2);
  grow([cx - 2 + v * 3, G - 50, 0], -0.4, 24, 4, 3, 5 + v); grow([cx - 2 + v * 3, G - 50, 0], 0.55, 22, 3.6, 3, 8 + v);
  const fr = R(S, W, H);
  for (let k = 0; k < 6; k++) { const x = Math.floor(fr.w * (0.35 + hash(k, 1, v) * 0.3)), y = Math.floor(fr.h * (0.45 + hash(k, 2, v) * 0.5)); if (solidAt(fr, x, y)) px2(fr, x, y, k % 2 ? 'ember2' : 'ember3'); }
  return fr;
}

// ============================================================ scarecrow ===
// A scarecrow on its pole: sacking head with stitched eyes, a ragged coat, straw at the cuffs. As tall as the Saint.
function scarecrow(v) {
  const W = 56, H = 70, S = new View(), G = groundY(H, 4), cx = 28;
  S.add(rod([cx, G, 0], [cx, G - 62, 0], 1.6, 'woodB'), 0.2);
  S.add(rod([cx - 18, G - 44, 0], [cx + 18, G - 44 + (v ? 3 : -2), 0], 1.4, 'woodB'), 0.2);
  S.add(bumpy(box([cx, G - 36, 0], [10, 12, 5], 2, 'cloth'), 0.6, 0.4, 2), 1.2);
  for (const s0 of [-1, 1]) S.add(capsule([cx + s0 * 6, G - 44, 0], [cx + s0 * 17, G - 43 + (v ? s0 * 2 : 0), 0], 3.4, 3, 'cloth'), 1.2);
  S.add(lump([cx, G - 53, 1], [6, 6.4, 5.4], 'sack', 3, 0.5), 1.4);
  S.add(box([cx, G - 61, 0], [8.5, 1.6, 7], 1, 'straw'), 0.6); S.add(box([cx, G - 64, 0], [5, 3, 4.6], 1.2, 'char'), 0.6);
  for (const s0 of [-1, 1]) S.add(lump([cx + s0 * 19, G - 43, 0], [2.6, 2.4, 2.4], 'straw', s0, 0.4), 0.8);
  S.add(lump([cx, G - 23, 0], [6, 3, 4], 'straw', 5, 0.5), 0.8);
  const fr = R(S, W, H);
  dot(fr, cx - 2, G - 55, 'ink2'); dot(fr, cx + 2, G - 55, 'ink2'); pline(fr, cx - 2, G - 50, cx + 3, G - 50, 'ink3');
  return fr;
}

// ============================================================== stooks ===
function stook(v) {
  const W = 40, H = 40, S = new View(), G = groundY(H, 6), cx = 20;
  S.add(bumpy({ mat: 'straw', bb: [cx - 14, G - 30, -12, cx + 14, G + 1, 12], f: (x, y, z) => { const t = clamp((G - y) / 28, 0, 1), r = 13 * (1 - t * 0.8); return Math.max(Math.hypot(x - cx, z) - r, G - 28 - y, y - G) * 0.8; } }, 0.7, 0.6, v), 0);
  S.add(box([cx, G - 14, 0], [12, 1.2, 12], 0.6, 'woodB'), 0.4);
  const fr = R(S, W, H); return v ? soot(fr, v + 4, 0.55) : fr;
}

// ============================================================= furnace ===
// The bell foundry's casting furnace: a brick dome with a glowing mouth, a chimney, a cracked bell mould beside it.
function furnace() {
  const W = 120, H = 120, S = new View(), G = groundY(H, 14), cx = 54;
  S.add(bumpy(ellipsoid([cx, G - 8, 0], [34, 40, 26], 'brick'), 0.6, 0.3, 2), 0);
  S.sub(box([cx, G - 10, 26], [12, 12, 8], 3, 'hole'), 0);
  S.add(bumpy(box([cx + 8, G - 66, -8], [7, 26, 7], 0.6, 'brick'), 0.4, 0.4, 4), 0.6);
  S.add({ mat: 'iron', bb: [cx + 30, G - 30, -4, cx + 58, G, 20], f: (x, y, z) => { const c = [cx + 44, G - 2, 8], t = clamp((G - 2 - y) / 24, 0, 1), r = 13 - t * t * 7; return Math.max(Math.hypot(x - c[0], z - c[2]) - r, G - 26 - y, y - G) * 0.8; } }, 0);
  const fr = soot(R(S, W, H), 3, 0.25);
  const my = Math.round(G - 10 + 26 * TILT); for (let y = my - 9; y < my + 10; y++) for (let x = cx - 10; x < cx + 11; x++) if (/^ink[34]/.test(NAME[fr.px[y * fr.w + x]] || '')) px2(fr, x, y, y > my + 3 ? 'ember1' : y > my - 3 ? 'ember2' : 'ember3');
  return fr;
}

// ============================================================ crypt door ===
// Under the burnt abbey: a sunken stair down into the ground, framed by two buttresses and a pointed arch with a
// lantern carved on the keystone.
function cryptdoor() {
  const W = 132, H = 104, S = new View(), G = groundY(H, 16), cx = 66;
  for (const s0 of [-1, 1]) S.add(bumpy(box([cx + s0 * 34, G - 30, 4], [10, 32, 10], 0.8, 'stone'), 0.6, 0.35, s0 + 2), 0);
  S.add({ mat: 'stone', bb: [cx - 30, G - 82, -2, cx + 30, G - 40, 12], f: (x, y, z) => { const r = Math.hypot(Math.abs(x - cx) + 14, y - (G - 46)) - 40; return Math.max(-(Math.hypot(Math.abs(x - cx) + 14, y - (G - 46)) - 32), r, Math.abs(z - 5) - 6, y - (G - 44)); } }, 0.6);
  S.add(box([cx, G - 26, -2], [24, 28, 4], 0.4, 'hole'), 0);
  for (let k = 0; k < 5; k++) S.add(box([cx, G - 4 - k * 4, 14 - k * 3.5], [22, 1.6, 2], 0.4, k % 2 ? 'stone' : 'stoneD'), 0.3);
  S.add(box([cx, G - 78, 11], [4, 5, 1.2], 0.6, 'bronze'), 0.3);
  const fr = soot(weeds(R(S, W, H), 6, 0.1), 7, 0.2);
  return fr;
}

// ================================================ flat bits for the ground ===
function ashpatch(v) { const W = 44, H = 20, fr = blank(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx + dy * dy + noise3(x * 0.25 + v, y * 0.25, v) * 0.5; if (d > 1) continue; fr.px[y * W + x] = IDX[d < 0.3 ? 'stone2h' : d < 0.7 ? 'stone3' : 'ink2h']; if (hash(x >> 1, y >> 1, v) < 0.03) fr.px[y * W + x] = IDX.ember2; } return fr; }
function stubble(v) { const W = 30, H = 14, fr = blank(W, H); for (let k = 0; k < 18; k++) { const x = 2 + Math.floor(hash(k, 1, v) * 26), y = 4 + Math.floor(hash(k, 2, v) * 9); dot(fr, x, y, 'sand2h'); dot(fr, x, y - 1, hash(k, 3, v) < 0.5 ? 'sand2' : 'rot2'); } return fr; }

export default {
  ash: {
    farm: () => [0, 1].map(farm),
    mill: () => [0, 1].map(mill),
    chartree: () => [0, 1].map(chartree),
    scarecrow: () => [0, 1].map(scarecrow),
    stook: () => [0, 1].map(stook),
    furnace: () => [furnace()],
    cryptdoor: () => [cryptdoor()],
    ashpatch: () => [0, 1].map(ashpatch),
    stubble: () => [0, 1].map(stubble),
  },
};
