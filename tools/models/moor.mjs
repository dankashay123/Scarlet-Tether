// The Hollow Moor (round 170, sheet 'moor'): the first outdoor region. Standing stones, a barrow with a stone
// doorway, a cairn, gorse, boulders, a dry-stone wall, a gibbet, a shepherd's tent, and flat ground bits (heather,
// grass tufts, a mud patch) that are baked into the ground.
//
// Same 3/4 view as the town (tools/models/street.mjs): the scene is sheared so tops catch the light. World axes:
// x right, y down, z toward the viewer; each prop's front foot sits on the frame's bottom row.
import { Scene, sphere, ellipsoid, capsule, box, bumpy, render, clip, noise3, dot, pline } from '../sdf.mjs';
import { MATS } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const TILT = 0.38;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const NAME = Object.fromEntries(Object.entries(IDX).map(([k, v]) => [v, k]));

const MM = {
  ...MATS,
  stone: { ramp: 'stone', spec: 0.05, min: 1, bias: -0.06 }, stoneD: { ramp: 'stone', bias: -0.2, min: 2 },
  lichen: { ramp: 'moss', spec: 0.02, bias: -0.08, min: 2 }, lichenY: { ramp: 'sand', bias: -0.05, min: 2 },
  turf: { ramp: 'moss', spec: 0.02, bias: -0.24, min: 3 }, turfD: { ramp: 'moss', bias: -0.36, min: 4 }, turfO: { ramp: 'rot', bias: -0.28, min: 3 },
  heath: { ramp: 'violet', spec: 0.03, bias: -0.2, min: 3 }, heathD: { ramp: 'violet', bias: -0.38, min: 4 },
  gorse: { ramp: 'moss', spec: 0.04, bias: -0.22, min: 3 }, gorseL: { ramp: 'moss', bias: -0.08, min: 2 },
  wood: { ramp: 'wood', spec: 0.08 }, woodB: { ramp: 'wood', bias: -0.12, min: 2 },
  iron: { ramp: 'iron', spec: 0.5, bias: -0.15, min: 2 }, bone: { ramp: 'bone', spec: 0.2, bias: -0.05 },
  hole: { ramp: 'ink', bias: -0.5, min: 6 }, canvas: { ramp: 'sand', spec: 0.03, bias: -0.04, min: 1 }, canvasD: { ramp: 'sand', bias: -0.2, min: 2 },
  mud: { ramp: 'shroud', bias: -0.1, min: 2 },
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
const R = (S, w, h, o = {}) => castShadow(render(S, w, h, MM, { zmin: -80, zmax: 60, contrast: 1.25, contourDepth: 6, ground: h - 1, ...o }), o.shadow);
const blank = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const solidAt = (fr, x, y) => x >= 0 && y >= 0 && x < fr.w && y < fr.h && fr.px[y * fr.w + x] >= 0 && fr.px[y * fr.w + x] !== IDX.outline;
// Lichen and moss: recolour a few stone pixels (only on stone) near the base and on the lit top.
function lichen(fr, seed, low = 0.55, k = 0.22) {
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, nm = NAME[fr.px[i]]; if (!nm || !/^stone\d/.test(nm)) continue;
    const step = +nm.slice(5), n = noise3(x * 0.18 + seed, y * 0.18, seed) * 0.5 + 0.5, base = y / fr.h > low;
    if (n > 1 - k * (base ? 1.6 : 0.6)) fr.px[i] = IDX[`moss${clamp(step + 1, 2, 7)}`];
    else if (n < k * 0.35 && hash(x >> 1, y >> 1, seed) < 0.5) fr.px[i] = IDX[`sand${clamp(step, 2, 6)}`];
  }
  return fr;
}

// ======================================================= standing stone ===
// v 0 a tall slab, v 1 leaning, v 2 short and broad.
function menhir(v) {
  const W = [30, 34, 36][v], H = [62, 56, 40][v], S = new View(), G = groundY(H, 4), cx = W / 2;
  const hgt = [52, 46, 28][v], wd = [8.5, 8, 12][v], lean = [0, 0.16, -0.05][v];
  const slab = box([cx, G - hgt / 2, 0], [wd, hgt / 2 - 3, 4.2], 3, 'stone');
  const tapered = { ...slab, f: (x, y, z) => { const t = clamp((G - y) / hgt, 0, 1), sx = cx + (x - cx) / (1 - t * 0.28) - (G - y) * lean; return slab.f(sx, y, z / (1 - t * 0.2)); } };
  tapered.bb = [cx - wd - 14, G - hgt - 4, -8, cx + wd + 14, G + 1, 8];
  S.add(bumpy(tapered, 1.1, 0.32, v * 5 + 1), 0);
  // A few stones fallen at its foot and a turf skirt.
  S.add(lump([cx - wd - 2, G - 2, 3], [3.5, 2.4, 3], 'stoneD', v + 2), 1.2);
  S.add(clip(ellipsoid([cx, G, 0], [wd + 8, 3, 7], 'turf'), (x, y) => G - 1.2 - y), 1.5);
  const fr = lichen(R(S, W, H), v * 3 + 2, 0.6, 0.2);
  return fr;
}

// ============================================================ barrow ===
// A long grassy mound with a stone doorway facing the viewer: two uprights, a lintel and a dark way in.
function barrow(v) {
  const W = 132, H = 78, S = new View(), G = groundY(H, 18), cx = W / 2;
  const mound = ellipsoid([cx, G - 2, 0], [60, 34, 26], 'turf');
  S.add(bumpy(clip(mound, (x, y) => y - G), 1.6, 0.16, 3 + v), 0);
  // The doorway is a stone facade set into a recess cut in the mound's front: two uprights, a lintel, a dark way in.
  const dz = 23, dx = cx + (v ? 14 : -6);
  S.sub(box([dx, G - 17, dz + 6], [17, 18, 7], 3, 'turfD'), 2);
  S.sub(box([dx, G - 12, dz - 4], [5.6, 12, 10], 0.8, 'hole'), 0);
  for (const s0 of [-1, 1]) S.add(bumpy(box([dx + s0 * 9.5, G - 13, dz], [3.6, 13, 3.6], 1.2, 'stone'), 0.6, 0.4, s0 * 3), 0.6);
  S.add(bumpy(box([dx, G - 28.5, dz + 0.5], [15, 3.2, 4.4], 1.2, 'stone'), 0.6, 0.4, 7), 0.6);
  S.add(bumpy(box([dx, G - 1, dz + 3], [12, 1.4, 3], 0.6, 'stoneD'), 0.4, 0.5, 9), 0.4);
  // Kerb stones along the mound's front.
  for (let k = 0; k < 7; k++) { const a = -0.95 + k * 0.32, x = cx + Math.sin(a) * 56, z = Math.cos(a) * 22; if (Math.abs(x - dx) < 22) continue; S.add(lump([x, G - 3, z], [3.6, 3.2, 3], 'stoneD', k + v), 0.8); }
  // Heather in dark patches on the mound, kept off the doorway.
  S.paint({ mat: 'heathD', f: (x, y, z) => (noise3(x * 0.09 + v, y * 0.12, z * 0.09) > 0.4 && y < G - 10 && Math.abs(x - dx) > 20 ? -1 : 1) });
  S.paint({ mat: 'turfO', f: (x, y, z) => (noise3(x * 0.07 + 9 + v, y * 0.1, z * 0.07) > 0.3 && Math.abs(x - dx) > 20 ? -1 : 1) });
  const fr = lichen(R(S, W, H), 11 + v, 0.5, 0.18);
  // Grass tufts on the crest.
  for (let k = 0; k < 18; k++) { const x = 18 + Math.floor(hash(k, 4, v) * (W - 36)); for (let y = 0; y < H; y++) if (solidAt(fr, x, y)) { dot(fr, x, y - 1, hash(k, 6) < 0.5 ? 'sand5' : 'rot4'); break; } }
  return fr;
}

// ============================================================= cairn ===
function cairn() {
  const W = 30, H = 34, S = new View(), G = groundY(H, 6), cx = 15;
  const rows = [[[-7, 0], [0, 1], [7, -1], [-3, -5], [4, 5]], [[-4, 0], [3, 1]], [[0, 0]]];
  rows.forEach((r, j) => r.forEach(([dx, dz], k) => S.add(lump([cx + dx * (1 - j * 0.2), G - 3.5 - j * 6.5, dz], [4.6 - j * 0.5, 3.6, 3.6], k % 2 ? 'stoneD' : 'stone', j * 7 + k, 0.7), 1.2)));
  return lichen(R(S, W, H), 21, 0.6, 0.18);
}

// ============================================================ gorse ===
// A spiky dark bush with yellow flowers.
function gorse(v) {
  const W = [38, 30][v], H = [28, 24][v], S = new View(), G = groundY(H, 6), cx = W / 2;
  const blobs = v ? [[0, -8, 0, 9], [-7, -5, 2, 6], [7, -5, 1, 6]] : [[0, -10, 0, 10], [-10, -6, 2, 7], [10, -6, 1, 7.5], [-3, -14, -2, 6]];
  blobs.forEach(([dx, dy, dz, r], k) => S.add(bumpy(ellipsoid([cx + dx, G + dy, dz], [r, r * 0.8, r * 0.8], k % 2 ? 'gorse' : 'gorseL'), 1, 0.7, k + v * 5), 2.4));
  const fr = R(S, W, H);
  // Spines: short dark strokes on the edge; flowers: gold dots on the lit side.
  for (let k = 0; k < 26; k++) { const x = Math.floor(hash(k, 1, v) * W), y = Math.floor(hash(k, 2, v) * (H - 4)); if (!solidAt(fr, x, y)) continue; dot(fr, x, y, hash(k, 3) < 0.45 ? (x < W * 0.55 && y < H * 0.55 ? 'gold2' : 'gold4') : 'moss7'); }
  return fr;
}

// =========================================================== boulder ===
function boulder(v) {
  const W = [34, 24][v], H = [26, 18][v], S = new View(), G = groundY(H, 6), cx = W / 2;
  S.add(lump([cx, G - H * 0.36, 0], [W * 0.4, H * 0.42, 7], 'stone', v * 9 + 4, 1.4), 0);
  if (!v) S.add(lump([cx + 10, G - 3, 4], [5, 3.6, 3.6], 'stoneD', 13, 0.8), 1.4);
  S.add(clip(ellipsoid([cx, G, 0], [W * 0.46, 2.4, 8], 'turf'), (x, y) => G - 1 - y), 1.2);
  return lichen(R(S, W, H), v * 5 + 30, 0.5, 0.24);
}

// ======================================================= dry-stone wall ===
// One length of a low wall of piled stones, made to repeat side by side.
function drywall(v) {
  const W = 48, H = 26, S = new View(), G = groundY(H, 5);
  for (let row = 0; row < 3; row++) for (let k = -1; k < 7; k++) {
    const x = k * 7.4 + (row % 2) * 3.7 + 2, y = G - 3.5 - row * 5.2, r = 3.8 + hash(k, row, v) * 1.3;
    S.add(lump([x, y, 0], [r, 2.8, 3.2], hash(k, row + 5, v) < 0.4 ? 'stoneD' : 'stone', k * 3 + row + v * 11, 0.6), 0.5);
  }
  return lichen(R(S, W, H), 40 + v, 0.55, 0.22);
}

// ============================================================ gibbet ===
// A post with an arm, a chain and an iron cage holding old bones.
function gibbet() {
  const W = 44, H = 82, S = new View(), G = groundY(H, 4), x0 = 12;
  S.add(bumpy(rod([x0, G, 0], [x0, 8, 0], 2.4, 'wood'), 0.25, 0.8, 1), 0);
  S.add(rod([x0 - 1, 10, 0], [36, 10, 0], 1.8, 'woodB'), 0.6);
  S.add(rod([x0 + 1, 22, 0], [x0 + 10, 11, 0], 1.2, 'woodB'), 0.6);
  for (const [dx, dz] of [[-4, 2], [4, -1], [0, 4]]) S.add(rod([x0, G - 5, 0], [x0 + dx, G, dz], 1.4, 'woodB'), 0.8);
  // The cage: four bars, two hoops; a skull and ribs inside.
  const cx = 33, top = 26, bot = 50;
  S.add(rod([cx, 11, 0], [cx, top, 0], 0.6, 'iron'), 0);
  for (const [dx, dz] of [[-5, 0], [5, 0], [0, -4], [0, 4]]) S.add(rod([cx + dx * 0.6, top, dz * 0.6], [cx + dx, bot, dz], 0.55, 'iron'), 0.4);
  for (const y of [top + 2, bot - 2]) S.add({ mat: 'iron', bb: [cx - 7, y - 1, -6, cx + 7, y + 1, 6], f: (x, yy, z) => { const r = y < 35 ? 3.4 : 5.2; return Math.hypot(Math.hypot(x - cx, z) - r, yy - y) - 0.6; } }, 0.3);
  S.add(sphere([cx, bot - 8, 0], 2.8, 'bone'), 0.5);
  S.add(capsule([cx - 2, bot - 4, 0], [cx + 2, bot - 4, 0], 1, 1, 'bone'), 0.6);
  const fr = R(S, W, H);
  dot(fr, cx - 1, bot - 8, 'ink1'); dot(fr, cx + 1, bot - 8, 'ink1');
  return fr;
}

// ============================================================== tent ===
// A shepherd's ridge tent of patched canvas, its flap tied back.
function tent() {
  const W = 60, H = 46, S = new View(), G = groundY(H, 12), cx = 30;
  const ridge = G - 30;
  S.add({ mat: 'canvas', bb: [cx - 26, ridge - 2, -14, cx + 26, G + 1, 14], f: (x, y, z) => { const t = clamp((y - ridge) / (G - ridge), 0, 1), hw = 3 + t * 21; return Math.max(Math.abs(x - cx) - hw, Math.abs(z) - 12, ridge - y, y - G); } }, 0);
  S.add(box([cx, ridge + 15, 12.5], [6, 13, 0.6], 0.3, 'hole'), 0, 'sub');
  S.paint({ mat: 'canvasD', f: (x, y, z) => (noise3(x * 0.2, y * 0.2, z * 0.2) > 0.45 ? -1 : 1) });
  for (const z of [-12, 12]) S.add(rod([cx, ridge - 4, z], [cx, G, z], 1.1, 'wood'), 0.3);
  const fr = R(S, W, H);
  pline(fr, 4, H - 2, cx - 20, Math.round(ridge + 12), 'wood5'); pline(fr, W - 4, H - 2, cx + 20, Math.round(ridge + 12), 'wood5');
  return fr;
}

// ============================================= ground bits (baked flat) ===
// Heather: a small clump of purple flowers on dark stems.
function heather(v) {
  const W = 18, H = 12, fr = blank(W, H);
  for (let k = 0; k < 22; k++) {
    const a = hash(k, 1, v) * Math.PI * 2, r = Math.sqrt(hash(k, 2, v)) * 7, x = Math.round(9 + Math.cos(a) * r), y = Math.round(7 + Math.sin(a) * r * 0.55);
    const c = y < 5 ? 'violet2' : hash(k, 3, v) < 0.5 ? 'violet3' : 'rose3';
    dot(fr, x, y, c); dot(fr, x, y + 1, 'moss6');
  }
  return fr;
}
// Grass: tall moor grass in a tuft.
function tuft(v) {
  const W = 14, H = 12, fr = blank(W, H);
  for (let k = 0; k < 7; k++) { const x = 3 + Math.floor(hash(k, 1, v) * 8), h = 4 + Math.floor(hash(k, 2, v) * 6), lean = hash(k, 3, v) < 0.5 ? -1 : 1; for (let d = 0; d < h; d++) dot(fr, x + (d > h * 0.6 ? lean : 0), H - 1 - d, d > h - 2 ? 'sand4' : d > h * 0.5 ? 'moss4' : 'moss5'); }
  return fr;
}
// A flat patch of peat mud with a puddle.
function mudpatch(v) {
  const W = 36, H = 18, fr = blank(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx + dy * dy + noise3(x * 0.25 + v, y * 0.25, v) * 0.35;
    if (d > 1) continue; fr.px[y * W + x] = IDX[d < 0.25 ? (y < H / 2 ? 'sea4' : 'sea5') : d < 0.7 ? 'shroud5' : 'shroud4'];
  }
  return fr;
}

export default {
  moor: {
    menhir: () => [0, 1, 2].map(menhir),
    barrow: () => [0, 1].map(barrow),
    cairn: () => [cairn()],
    gorse: () => [0, 1].map(gorse),
    boulder: () => [0, 1].map(boulder),
    drywall: () => [0, 1].map(drywall),
    gibbet: () => [gibbet()],
    tent: () => [tent()],
    heather: () => [0, 1, 2].map(heather),
    tuft: () => [0, 1, 2].map(tuft),
    mudpatch: () => [0, 1].map(mudpatch),
  },
};
