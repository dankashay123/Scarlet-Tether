// The Sallow Fen (round 172, sheet 'fen'): the second outdoor region. Old Tobe's punt-house on stilts, drowned
// cottages, a bell tower standing in the water, the Choir's sluice (the way down), reeds, a drowned willow, a punt,
// mooring posts, and flat bits for the water (lily pads, scum) that are baked into the ground.
//
// Same 3/4 view as the moor (tools/models/moor.mjs). Sizes follow the Saint (about 52 px head to feet): a door
// about 1.2x, the bell tower about 3.5x. Everything that stands in water has its waterline on the frame's bottom row.
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

// ===================================================== the punt-house ===
// Old Tobe's hut on stilts: a plank platform over the water, a board hut with a reed-thatched roof, a ladder down
// to the water and a lantern by the door.
function stilthouse() {
  const W = 132, H = 136, S = new View(), G = groundY(H, 14), cx = 64, P = G - 30;
  for (const [x, z] of [[cx - 44, 10], [cx + 44, 10], [cx - 44, -14], [cx + 44, -14], [cx, 12]]) S.add(rod([x, P, z], [x + (z > 0 ? 1 : -1), G + 2, z], 2.2, 'woodW'), 0.5);
  for (const z of [10, -14]) S.add(rod([cx - 44, P + 6, z], [cx + 44, G - 6, z], 1.1, 'woodB'), 0.2);
  S.add(box([cx, P, -2], [50, 2, 16], 0.6, 'wood'), 0);
  for (let k = -5; k <= 5; k++) S.add(box([cx + k * 9.5, P - 1.8, 14.5], [0.4, 0.4, 0.4], 0, 'hole'), 0, 'sub');
  // The hut: plank walls with a door and a window.
  const hut = box([cx - 2, P - 22, -4], [34, 20, 12], 0.8, 'woodB');
  S.add({ ...hut, f: (x, y, z) => hut.f(x, y, z) + 0.25 * Math.abs(Math.sin(x * 0.85)) }, 0);
  S.sub(box([cx + 14, P - 15, 8], [6, 14, 3], 0.5, 'hole'), 0);
  S.sub(box([cx - 16, P - 26, 8], [6, 5, 3], 0.5, 'hole'), 0);
  S.add(roof(cx - 40, cx + 36, -22, 13, P - 38, P - 64, 'thatch'), 0.6);
  S.paint({ mat: 'thatchD', f: (x, y, z) => (noise3(x * 0.2, y * 0.5, z * 0.2) > 0.25 ? -1 : 1) });
  // Ladder down to the water at the front, a lantern post by the door, a coil of rope.
  for (const x of [cx - 28, cx - 20]) S.add(rod([x, P, 15], [x - 2, G, 22], 0.8, 'wood'), 0.2);
  for (let k = 1; k < 5; k++) S.add(rod([cx - 28 - k * 0.4, P + k * 6, 15 + k * 1.4], [cx - 20 - k * 0.4, P + k * 6, 15 + k * 1.4], 0.6, 'wood'), 0.1);
  S.add(rod([cx + 30, P, 12], [cx + 30, P - 26, 12], 0.9, 'wood'), 0.2);
  S.add(ellipsoid([cx - 10, P - 2.6, 12], [4, 1.4, 3], 'thatch'), 0.6);
  const fr = waterline(R(S, W, H), 10, 3);
  // Warm light in the window and doorway, the lantern on its post.
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) if (/^ink[34]/.test(NAME[fr.px[y * fr.w + x]] || '')) { if (y < P - 20 && x < cx) fr.px[y * fr.w + x] = IDX[y < P - 28 ? 'ember2' : 'ember3']; }
  dot(fr, cx + 30, P - 27, 'ember1'); dot(fr, cx + 30, P - 25, 'gold1'); dot(fr, cx + 31, P - 26, 'ember2');
  return fr;
}

// ======================================================= drowned house ===
// A cottage standing in the flood: the water at its upper windows, the thatch rotten. v 1 has lost half its roof.
function sunkhouse(v) {
  const W = 118, H = 96, S = new View(), G = groundY(H, 16), cx = 58;
  S.add(bumpy(box([cx, G - 18, 0], [42, 20, 14], 0.8, 'stone'), 0.7, 0.35, v + 2), 0);
  S.sub(box([cx - 18, G - 20, 14], [6, 7, 3], 0.6, 'hole'), 0);
  S.sub(box([cx + 18, G - 20, 14], [6, 7, 3], 0.6, 'hole'), 0);
  if (!v) S.add(roof(cx - 48, cx + 48, -18, 18, G - 36, G - 70, 'thatch'), 0.6);
  else { S.add(clip(roof(cx - 48, cx + 48, -18, 18, G - 36, G - 70, 'thatch'), (x) => x - cx - 4), 0.6); for (let k = 0; k < 4; k++) S.add(rod([cx + 6 + k * 9, G - 38, 14], [cx + 2 + k * 9, G - 62, -6], 1.1, 'woodB'), 0.3); }
  S.paint({ mat: 'thatchD', f: (x, y, z) => (noise3(x * 0.18 + v, y * 0.4, z * 0.18) > 0.15 ? -1 : 1) });
  S.add(box([cx + 30, G - 62, -8], [5, 10, 5], 0.6, 'stoneD'), 0.4);
  const fr = waterline(weeds(R(S, W, H), v + 5, 0.16), 16, v);
  for (const wx of [cx - 18, cx + 18]) for (let k = 0; k < 3; k++) px2(fr, wx - 4 + k * 4, Math.round(G - 14 + 14 * TILT), 'sea3');
  return fr;
}

// ========================================================== bell tower ===
// The drowned parish's bell tower, standing up out of the water: stone with a belfry of four arches, a bronze bell,
// a slate spire, a lit window halfway up where Sister Marl lives.
function belltower() {
  const W = 92, H = 200, S = new View(), G = groundY(H, 14), cx = 46, top = G - 128;
  S.add(bumpy(box([cx, G - 60, 0], [22, 62, 14], 0.8, 'stone'), 0.6, 0.35, 4), 0);
  S.add(box([cx, top + 2, 0], [24, 3, 16], 0.8, 'stoneD'), 0.4);
  // The belfry: four posts and the bell between them.
  for (const [dx, dz] of [[-19, 12], [19, 12], [-19, -12], [19, -12]]) S.add(box([cx + dx, top - 15, dz], [3.4, 15, 3], 0.6, 'stone'), 0.4);
  S.add(box([cx, top - 31, 0], [24, 3, 16], 0.8, 'stoneD'), 0.4);
  S.add({ mat: 'bronze', bb: [cx - 11, top - 28, -11, cx + 11, top - 2, 11], f: (x, y, z) => { const t = clamp((y - (top - 26)) / 22, 0, 1), r = 4 + t * t * 6.5; return Math.max(Math.hypot(x - cx, z) - r, top - 26 - y, y - (top - 5)); } }, 1);
  // The spire.
  S.add({ mat: 'slate', bb: [cx - 26, top - 76, -18, cx + 26, top - 32, 18], f: (x, y, z) => { const t = clamp((top - 33 - y) / 42, 0, 1), hw = 25 * (1 - t); return Math.max(Math.abs(x - cx) - hw, Math.abs(z) - hw * 0.66, y - (top - 33), top - 76 - y) * 0.7; } }, 0);
  S.add(rod([cx, top - 76, 0], [cx, top - 88, 0], 0.8, 'iron'), 0.2);
  S.add(rod([cx - 4, top - 84, 0], [cx + 4, top - 84, 0], 0.7, 'iron'), 0.2);
  // A window halfway up and a door half under the water.
  S.sub(box([cx, G - 82, 14], [4.5, 8, 3], 1, 'hole'), 0);
  S.sub(box([cx, G - 8, 14], [8, 14, 3], 1, 'hole'), 0);
  const fr = waterline(weeds(R(S, W, H), 7, 0.14), 26, 2);
  const wy = Math.round(G - 82 + 14 * TILT);
  for (let y = wy - 6; y < wy + 6; y++) for (let x = cx - 4; x < cx + 4; x++) if (fr.px[y * fr.w + x] >= 0 && /^ink/.test(NAME[fr.px[y * fr.w + x]] || '')) px2(fr, x, y, y < wy - 2 ? 'ember2' : 'ember3');
  return fr;
}

// ============================================================== sluice ===
// The Choir's sluice: a stone dam wall with a timber gate in the middle, a winding wheel above it, iron bands, and
// water leaking under the gate. Its gate is the way down into the Drowned Way.
function sluice() {
  const W = 168, H = 112, S = new View(), G = groundY(H, 12), cx = 84;
  for (const s0 of [-1, 1]) S.add(bumpy(box([cx + s0 * 52, G - 30, 0], [30, 32, 12], 0.8, 'stone'), 0.7, 0.35, s0 + 3), 0);
  for (const s0 of [-1, 1]) S.add(box([cx + s0 * 24, G - 38, 2], [5, 40, 13], 0.8, 'stoneD'), 0.4);
  // The gate: vertical planks with iron bands.
  const gate = box([cx, G - 26, 6], [19, 26, 3], 0.4, 'woodB');
  S.add({ ...gate, f: (x, y, z) => gate.f(x, y, z) + 0.3 * Math.abs(Math.sin((x - cx) * 0.62)) }, 0);
  for (const y of [G - 44, G - 26, G - 8]) S.add(box([cx, y, 9.2], [19.5, 1.4, 0.6], 0.3, 'iron'), 0.2);
  // The beam across the top and the winding wheel on it.
  S.add(box([cx, G - 80, 4], [32, 3, 4], 0.6, 'wood'), 0.4);
  for (const s0 of [-1, 1]) S.add(rod([cx + s0 * 24, G - 78, 4], [cx + s0 * 24, G - 64, 4], 1.6, 'wood'), 0.3);
  S.add({ mat: 'iron', bb: [cx - 12, G - 104, 0, cx + 12, G - 80, 10], f: (x, y, z) => Math.hypot(Math.hypot(x - cx, y - (G - 92)) - 10, z - 6) - 1.2 }, 0);
  for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; S.add(rod([cx, G - 92, 6], [cx + Math.cos(a) * 10, G - 92 + Math.sin(a) * 10, 6], 0.6, 'iron'), 0.2); }
  S.add(rod([cx, G - 82, 6], [cx, G - 54, 6], 1.1, 'iron'), 0.2);
  // A Choir plaque on the left wall.
  S.add(box([cx - 52, G - 40, 12.6], [9, 6, 0.6], 0.3, 'bronze'), 0.2);
  const fr = waterline(weeds(R(S, W, H), 9, 0.15), 16, 5);
  // Water leaking under the gate.
  for (let x = cx - 18; x < cx + 18; x += 2) for (let k = 0; k < 4; k++) if (hash(x, k, 3) < 0.7) px2(fr, x, H - 4 - k * 2, k < 2 ? 'sea2' : 'sea3');
  return fr;
}

// =============================================================== reeds ===
// A clump of reeds a little taller than the Saint, with brown heads; v picks the spread.
function reeds(v) {
  const W = 40, H = 70, fr = blank(W, H), n = 16 + v * 4;
  for (let k = 0; k < n; k++) {
    const x0 = 6 + Math.floor(hash(k, 1, v) * 28), h = 34 + Math.floor(hash(k, 2, v) * 30), lean = (hash(k, 3, v) - 0.5) * 0.5;
    for (let d = 0; d < h; d++) { const x = Math.round(x0 + lean * d * d / h), y = H - 1 - d; dot(fr, x, y, d < 6 ? 'moss3h' : d > h * 0.7 ? (x0 & 2 ? 'sand2h' : 'moss2') : x0 & 2 ? 'moss2h' : 'moss3'); }
    if (hash(k, 4, v) < 0.45) { const x = Math.round(x0 + lean * h), y = H - 1 - h; for (let j = 0; j < 6; j++) dot(fr, x, y + j, j < 2 ? 'rot1h' : 'rot2h'); }
  }
  return fr;
}

// ======================================================= drowned willow ===
// A dead willow up to its knees in the flood, with grey strands of weed hanging from its branches.
function willow(v) {
  const W = 120, H = 140, S = new View(), G = groundY(H, 6), cx = 54;
  const tips = [];
  const grow = (a, ang, len, r, depth, seed) => {
    const b = [a[0] + Math.sin(ang) * len, a[1] - Math.cos(ang) * len, a[2] + (hash(seed, 1, v) - 0.5) * 6];
    S.add(capsule(a, b, r, r * 0.66, 'bark'), r > 2 ? 1.4 : 0.6);
    if (depth <= 0 || r < 0.8) { tips.push(b); return; }
    for (let k = 0; k < 2; k++) grow(b, ang + (k ? 0.55 : -0.55) + (hash(seed, k, v) - 0.5) * 0.4, len * 0.7, r * 0.62, depth - 1, seed * 3 + k + 1);
  };
  for (const [dx, dz] of [[-10, 3], [9, 2], [0, -5]]) S.add(capsule([cx, G - 8, 0], [cx + dx, G, dz], 3.6, 1.4, 'bark'), 1.4);
  S.add(capsule([cx, G, 0], [cx + 3, G - 52, 0], 7, 5, 'bark'), 2);
  grow([cx + 3, G - 52, 0], -0.55, 26, 4.4, 3, 3 + v); grow([cx + 3, G - 52, 0], 0.6, 28, 4.4, 3, 9 + v);
  const fr = waterline(R(S, W, H), 8, v);
  // Hanging weed from each twig tip, swaying a little.
  tips.forEach(([x, y, z], k) => { const sy = Math.round(y + z * TILT), len = 14 + Math.floor(hash(k, 5, v) * 20); for (let d = 0; d < len; d++) dot(fr, Math.round(x + Math.sin(d * 0.25 + k) * 1.2), sy + d, d % 5 === 4 ? 'moss3h' : hash(k, 6) < 0.5 ? 'moss2h' : 'stone2h'); });
  return fr;
}

// ================================================================ punt ===
function punt() {
  const W = 84, H = 30, S = new View(), G = groundY(H, 12), cx = 40;
  const hull = box([cx, G - 4, 0], [32, 3.5, 10], 1.5, 'wood');
  S.add({ ...hull, f: (x, y, z) => hull.f(x, y, z) + clamp((Math.abs(x - cx) - 26) * 0.4, 0, 4) * (y < G - 4 ? 0 : 1) }, 0);
  S.sub(box([cx, G - 6.5, 0], [29, 3, 8], 1, 'woodB'), 1);
  S.add(box([cx + 8, G - 5, 0], [2, 1, 8], 0.4, 'wood'), 0.3);
  S.add(rod([cx - 34, G - 3, 4], [cx + 40, G - 8, -6], 0.8, 'wood'), 0.2);
  return waterline(R(S, W, H), 4, 1);
}

// ======================================================= mooring post ===
function post(v) {
  const W = 16, H = 44, S = new View(), G = groundY(H, 4), cx = 8;
  S.add(bumpy(capsule([cx, G, 0], [cx + (v ? 1.5 : -1), G - (v ? 30 : 38), 0], 3.2, 2.8, 'woodW'), 0.4, 0.5, v), 0);
  S.add(ellipsoid([cx, G - 18, 0], [3.8, 1.6, 3.8], 'thatch'), 0.6);
  return waterline(R(S, W, H), 10, v);
}

// ================================================ flat bits on the water ===
function lily(v) {
  const W = 22, H = 12, fr = blank(W, H);
  for (let k = 0; k < 3 + v; k++) { const cx = 5 + Math.floor(hash(k, 1, v) * 12), cy = 3 + Math.floor(hash(k, 2, v) * 6), r = 2.5 + hash(k, 3, v) * 1.5;
    for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) { const d = Math.hypot(x / r, y / (r * 0.6)); if (d <= 1 && !(x > 0 && Math.abs(y) < 1)) dot(fr, cx + x, cy + y, d < 0.5 ? 'moss2' : 'moss3'); }
    if (hash(k, 4, v) < 0.35) dot(fr, cx, cy - 1, 'rose2'); }
  return fr;
}
function scum(v) {
  const W = 40, H = 18, fr = blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx + dy * dy + noise3(x * 0.3 + v, y * 0.3, v) * 0.5; if (d > 1 || hash(x >> 1, y >> 1, v) < 0.3) continue; fr.px[y * W + x] = IDX[d < 0.4 ? 'moss2h' : 'moss3']; }
  return fr;
}

export default {
  fen: {
    stilthouse: () => [stilthouse()],
    sunkhouse: () => [0, 1].map(sunkhouse),
    belltower: () => [belltower()],
    sluice: () => [sluice()],
    reeds: () => [0, 1, 2].map(reeds),
    willow: () => [0, 1].map(willow),
    punt: () => [punt()],
    post: () => [0, 1].map(post),
    lily: () => [0, 1].map(lily),
    scum: () => [0, 1].map(scum),
  },
};
