// Sculpted buildings and props for Vael (sheets 'town' and 'town2').
//
// Everything is modelled in 3D and seen in a slight top-down 3/4 view: the
// scene is sheared so surfaces facing up (roofs, ledges, steps) catch the
// light, as in Otherworld Legends. Stone gets carved mortar courses and
// chipped edges; windows, flames and small glints are placed by hand after
// rendering.
//
// World axes: x right, y down, z toward the viewer. A building's street face
// sits at z = 0 and its foot on the frame's bottom row.
import { rotZ } from '../sdf.mjs';
import { Scene, sphere, ellipsoid, capsule, box, skirt, folds, render, clip, noise3, dot, pline, under } from '../sdf.mjs';
import { MATS } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const TILT = 0.38;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

// ------------------------------------------------------------ materials ---
const TM = {
  ...MATS,
  stone: { ramp: 'stone', spec: 0.04, min: 1, bias: -0.08 }, stoneB: { ramp: 'stone', bias: -0.15, min: 1 }, stoneC: { ramp: 'stone', bias: -0.02, min: 1 },
  stoneDark: { ramp: 'stone', bias: -0.2, min: 2 }, slab: { ramp: 'flag', min: 1 },
  slate: { ramp: 'slate', spec: 0.15, min: 0 }, slateB: { ramp: 'slate', bias: -0.08 },
  tile: { ramp: 'roof', spec: 0.08, bias: -0.1 }, tileB: { ramp: 'roof', bias: -0.18 }, tileC: { ramp: 'roof', bias: -0.02 },
  plaster: { ramp: 'sand', min: 2, max: 7, bias: -0.14 }, plasterB: { ramp: 'sand', bias: -0.2, min: 2, max: 7 }, plasterG: { ramp: 'stone', bias: 0.02, min: 1 },
  timber: { ramp: 'wood', bias: -0.12, min: 2 }, wood: { ramp: 'wood', spec: 0.08 }, woodB: { ramp: 'wood', bias: -0.07 },
  iron: { ramp: 'iron', spec: 0.7, bias: -0.12, min: 1 }, ironDark: { ramp: 'iron', spec: 0.5, bias: -0.3, min: 3 },
  gold: { ramp: 'gold', spec: 0.6 }, goldDim: { ramp: 'gold', spec: 0.5, bias: -0.14 }, brick: { ramp: 'brick', spec: 0.03 }, brickB: { ramp: 'brick', bias: -0.08 },
  hole: { ramp: 'ink', bias: -0.5, min: 5 }, moss: { ramp: 'moss', min: 2, bias: -0.2 }, bark: { ramp: 'shroud', spec: 0.05, min: 1 },
  cloth: { ramp: 'cloth', max: 6 }, canvasR: { ramp: 'crimson', spec: 0.04 }, canvasV: { ramp: 'violet', spec: 0.04 }, canvasG: { ramp: 'gold', spec: 0.04 }, canvasT: { ramp: 'teal', spec: 0.04 }, canvasM: { ramp: 'moss', spec: 0.04 }, canvasI: { ramp: 'ink', spec: 0.04, min: 2 }, canvasS: { ramp: 'sand', spec: 0.04, min: 1 }, drape: { ramp: 'violet', bias: -0.15, min: 2 },
  bannerR: { ramp: 'crimson', spec: 0.05, bias: -0.05 }, bone: { ramp: 'bone', spec: 0.2 }, shroud: { ramp: 'shroud' },
  water: { ramp: 'violet', spec: 0.9, bias: 0.05 }, rose: { ramp: 'rose', spec: 0.3 }, roseDeep: { ramp: 'rose', bias: -0.2, min: 2 },
  ...Object.fromEntries(['bone', 'pot', 'cloth', 'blood', 'stone', 'teal', 'moss', 'sand', 'rot', 'shroud'].map((r) => [`halo_${r}`, { ramp: r, spec: 0.7, min: 0 }])),
  glass_flame: { ramp: 'flame', spec: 0.9 }, glass_holy: { ramp: 'holy', spec: 0.9, min: 1 }, glass_crimson: { ramp: 'crimson', spec: 0.9 }, glass_violet: { ramp: 'violet', spec: 0.9 }, coal: { ramp: 'ink', bias: -0.1, min: 2 },
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
// Screen y of a world point.
const sy = (y, z = 0) => y + z * TILT;

// ---------------------------------------------------------------- shapes ---
// A convex solid from planes: each [nx, ny, nz, d] keeps n.p <= d.
function planes(list, bb, mat) {
  const ps = list.map(([nx, ny, nz, d]) => { const l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l, d / l]; });
  return { mat, bb, f: (x, y, z) => { let m = -1e9; for (const [a, b, c, d] of ps) { const v = a * x + b * y + c * z - d; if (v > m) m = v; } return m; } };
}
// A roof prism, ridge along x. Eaves at y = ye (front z = zf, back z = zb), ridge at y = yr.
// hip > 0 slopes the gable ends in by that much (a hipped roof).
function roofPrism(x0, x1, zb, zf, ye, yr, mat, hip = 0) {
  const zc = (zb + zf) / 2, rise = ye - yr;
  const P = [
    [0, -(zf - zc), rise, -(zf - zc) * yr + rise * zc],   // front slope
    [0, (zb - zc), -rise, (zb - zc) * yr - rise * zc],    // back slope
    [0, 1, 0, ye],
  ];
  if (hip > 0) { P.push([-rise, -hip, 0, -rise * x0 - hip * ye]); P.push([rise, -hip, 0, rise * x1 - hip * ye]); }
  else { P.push([-1, 0, 0, -x0]); P.push([1, 0, 0, x1]); }
  return planes(P, [x0, yr, zb, x1, ye, zf], mat);
}

// Stone courses: carved mortar joints and chipped arrises.
function ashlar(p, { ch = 6, bw = 12, depth = 0.45, chip = 0.35, seed = 1 } = {}) {
  const f = p.f;
  return { ...p, f: (x, y, z) => {
    const d = f(x, y, z);
    if (d > 2) return d;
    const row = Math.floor(y / ch), fy = y - row * ch, off = (hash(row, 3, seed) * 0.6 + (row & 1) * 0.5) * bw;
    const fx = (((x + off) % bw) + bw) % bw;
    const g = Math.min(fy, ch - fy, fx, bw - fx);
    let dd = d + (g < 0.7 ? depth * (1 - g / 0.7) : 0);
    dd += chip * Math.max(0, noise3(x * 0.45 + seed, y * 0.45, z * 0.45) - 0.25);
    return dd;
  } };
}
// Per-block colour variation for an ashlar wall: paints on the wall's surface only.
function blockTones(S, p, { ch = 6, bw = 12, seed = 1, mats = ['stoneB', 'stoneC'], frac = 0.35 } = {}) {
  const f = p.f;
  for (let m = 0; m < mats.length; m++) S.paint({ mat: mats[m], bb: p.bb, f: (x, y, z) => {
    if (Math.abs(f(x, y, z)) > 0.9) return 1;
    const row = Math.floor(y / ch), off = (hash(row, 3, seed) * 0.6 + (row & 1) * 0.5) * bw, col = Math.floor((x + off) / bw);
    const h = hash(col, row, seed + 7);
    return h > m * frac / mats.length + (1 - frac) && h <= (m + 1) * frac / mats.length + (1 - frac) ? -1 : 1;
  } });
}
// Clay roof tiles: overlapping courses that each catch the light.
function tiled(p, { ch = 3.4, bw = 5, amp = 0.55, seed = 2 } = {}) {
  const f = p.f;
  return { ...p, f: (x, y, z) => {
    const d = f(x, y, z);
    if (d > 2) return d;
    const yy = y - z * 0.7, row = Math.floor(yy / ch), fy = (yy - row * ch) / ch, off = (row & 1) * bw / 2;
    const fx = (((x + off) % bw) + bw) % bw / bw;
    return d - amp * fy + 0.08 * noise3(x * 0.4, y * 0.4 + seed, z * 0.4);
  } };
}
function tileTones(S, p, { ch = 3.4, bw = 5, seed = 2, mats = ['tileB', 'tileC'] } = {}) {
  const f = p.f;
  mats.forEach((mat, m) => S.paint({ mat, bb: p.bb, f: (x, y, z) => {
    if (Math.abs(f(x, y, z)) > 1.2) return 1;
    const yy = y - z * 0.7, row = Math.floor(yy / ch), off = (row & 1) * bw / 2, col = Math.floor((x + off) / bw);
    const h = hash(col, row, seed);
    return (m === 0 ? h < 0.18 : h > 0.88) ? -1 : 1;
  } }));
}
// Planks: grooves running vertically every w px.
function planked(p, w = 4, depth = 0.35, seed = 3) {
  const f = p.f;
  return { ...p, f: (x, y, z) => { const d = f(x, y, z); if (d > 2) return d; const fx = ((x % w) + w) % w; return d + (Math.min(fx, w - fx) < 0.6 ? depth : 0) + 0.06 * noise3(x * 0.3 + seed, y * 0.4, z); } };
}
// A box with the near face at z = zf, the far one at zf - depth.
const slabBox = (x0, y0, x1, y1, zf, depth, mat, round = 0.3) => box([(x0 + x1) / 2, (y0 + y1) / 2, zf - depth / 2], [(x1 - x0) / 2 - round, (y1 - y0) / 2 - round, depth / 2 - round], round, mat);
// A round-topped (or pointed) arch prism through z, for doors, windows and niches.
function archPrism(cx, yTop, w, yBot, z0, z1, mat, pointed = false) {
  const r = w / 2, ys = yTop + r, zc = (z0 + z1) / 2, hz = (z1 - z0) / 2;
  return { mat, bb: [cx - r, yTop, z0, cx + r, yBot, z1], f: (x, y, z) => {
    const dz = Math.abs(z - zc) - hz;
    let d2;
    if (y > ys) d2 = Math.max(Math.abs(x - cx) - r, y - yBot);
    else if (pointed) { const dx = Math.abs(x - cx); d2 = Math.hypot(dx + r * 0.6, y - ys) - r * 1.6; }
    else d2 = Math.hypot(x - cx, y - ys) - r;
    return Math.max(d2, dz);
  } };
}
// A tiny screen-space mask helper for arches.
const inArch = (x, y, cx, yTop, w, yBot, pointed = false) => {
  const r = w / 2, ys = yTop + r;
  if (y > yBot || Math.abs(x - cx) > r) return false;
  if (y >= ys) return true;
  if (pointed) return Math.hypot(Math.abs(x - cx) + r * 0.6, y - ys) <= r * 1.6;
  return Math.hypot(x - cx, y - ys) <= r;
};

// ----------------------------------------------------------- pixel touches ---
const C = (ramp, s) => FINE[ramp][clamp(Math.round(s), 0, 8)];
function fill(fr, mask, colour) {
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) if (mask(x, y)) { const c = colour(x, y); if (c) fr.px[y * fr.w + x] = IDX[c]; }
}
// A candle-lit window: hot near the sill, cooling upward, with mullions.
function litWindow(fr, mask, x0, y0, x1, y1, { ramp = 'ember', lit = true, mull = 'wood', crossY = 0.5, cols = 2, frame = true } = {}) {
  const w = x1 - x0, h = y1 - y0, mx = Math.round(x0 + w / 2 - 0.5);
  fill(fr, (x, y) => mask(x, y), (x, y) => {
    if (!lit) return C('ink', 6 + (y - y0) / h * 2);
    const t = (y - y0) / h, u = Math.abs((x - x0) / w - 0.5) * 2;
    let s = 4.6 - t * 3.6 + u * 1.4 + (hash(x, y, 5) - 0.5) * 0.6;
    if (ramp === 'violet' || ramp === 'crimson' || ramp === 'holy') s = 3.4 - t * 1.6 + u * 1.5 + (hash(x >> 1, y >> 1, 9) - 0.5) * 2.4;
    return C(ramp, s);
  });
  if (frame) fill(fr, (x, y) => mask(x, y) && ((cols >= 2 && x === mx) || (crossY && y === Math.round(y0 + h * crossY))), () => C(mull === 'wood' ? 'wood' : mull, mull === 'wood' ? 6 : 6));
}
// Moss and grime: a few hand-placed clumps on the top-facing parts of stone.
function moss(fr, seed, n, region = null) {
  n = Math.round(n * 0.35);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, 1, seed) * fr.w), y = Math.floor(hash(i, 2, seed) * fr.h);
    if (region && !region(x, y)) continue;
    const c = under(fr, x, y); if (c < 0 || c === IDX.outline) continue;
    const nm = Object.keys(IDX).find((k) => IDX[k] === c);
    if (!nm || !/^stone|^flag|^slate/.test(nm)) continue;
    // A small clump: lit on top, dark beneath.
    const w = 2 + Math.floor(hash(i, 3, seed) * 3);
    for (let k = 0; k < w; k++) { if (under(fr, x + k, y) < 0 || under(fr, x + k, y) === IDX.outline) break; dot(fr, x + k, y, k === 0 ? 'moss2' : 'moss3'); if (k > 0 && k < w - 1) { dot(fr, x + k, y - 1, 'moss1h'); if (under(fr, x + k, y + 1) >= 0) dot(fr, x + k, y + 1, 'moss4'); } }
  }
}
// Hanging grime streaks below sills.
function streak(fr, x, y, len, seed = 0) {
  for (let k = 0; k < len; k++) { const c = under(fr, x, y + k); if (c < 0) return; const nm = NAME[c]; if (!nm) return; const m = nm.match(/^([a-z]+)(\d)(h?)$/); if (!m || !FINE[m[1]]) return; const i = FINE[m[1]].indexOf(nm); if (hash(x, k, seed) < 0.8) dot(fr, x, y + k, FINE[m[1]][Math.min(8, i + 1)]); }
}
// Roof courses drawn in screen space over the lit roof form: a shadow line
// under each tile lip, a lit lip above it, staggered joints, a few odd tiles.
function tilePass(fr, { ch = 4, bw = 6, seed = 1, test = isRoof, y0 = 0 } = {}) {
  const src = new Int16Array(fr.px);
  const step = (x, y, by) => { const nm = NAME[src[y * fr.w + x]]; const m = nm && nm.match(/^([a-z]+)\d/); if (!m) return; const i = FINE[m[1]].indexOf(nm); fr.px[y * fr.w + x] = IDX[FINE[m[1]][clamp(i + by, 0, 8)]]; };
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    if (!test(fr, x, y, src)) continue;
    const yy = y - y0, row = Math.floor(yy / ch), fy = ((yy % ch) + ch) % ch, off = (row & 1) * Math.floor(bw / 2), fx = (((x + off) % bw) + bw) % bw, col = Math.floor((x + off) / bw);
    const h = hash(col, row, seed);
    if (fy === ch - 1) step(x, y, 2);
    else if (fy === 0) step(x, y, -1);
    else if (fx === 0) step(x, y, 1);
    else if (h < 0.12) step(x, y, 1);
    else if (h > 0.93) step(x, y, -1);
  }
}
const isRoof = (fr, x, y, src = fr.px) => /^roof/.test(NAME[src[y * fr.w + x]] || '');
const NAME = Object.fromEntries(Object.entries(IDX).map(([k, v]) => [v, k]));
// Shift a ramp step on existing pixels inside a mask (shade or lighten in place).
function shade(fr, mask, by) {
  fill(fr, (x, y) => mask(x, y) && fr.px[y * fr.w + x] >= 0, (x, y) => {
    const nm = NAME[fr.px[y * fr.w + x]]; const m = nm && nm.match(/^([a-z]+)\d/); if (!m || !FINE[m[1]]) return null;
    const i = FINE[m[1]].indexOf(nm); return i < 0 ? null : FINE[m[1]][clamp(i + by, 0, 8)];
  });
}
// Grime rising from the street: stone and plaster darken near the foot.
function grime(fr, h = 26, seed = 0) {
  const src = new Int16Array(fr.px);
  for (let y = fr.h - h; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, nm = NAME[src[i]], m = nm && nm.match(/^(stone|sand|flag|brick|slate|pot)\d/); if (!m) continue;
    const t = (y - (fr.h - h)) / h + (hash(x, y >> 1, seed) - 0.5) * 0.5;
    if (t > 0.45) { const k = FINE[m[1]].indexOf(nm); fr.px[i] = IDX[FINE[m[1]][clamp(k + (t > 0.85 ? 2 : 1), 0, 8)]]; }
  }
}
// Draw one frame on top of another (for composites).
function stamp(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const v = src.px[y * src.w + x]; if (v < 0) continue; const X = x + ox, Y = y + oy; if (X >= 0 && Y >= 0 && X < dst.w && Y < dst.h) dst.px[Y * dst.w + X] = v; }
  return dst;
}
const blank = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
// Cast shadows from the depth map: march toward the light in screen space;
// if something nearer the viewer rises above the light ray, the pixel is in shadow.
function castShadow(fr, { by = 3, maxT = 60, bias = 0.6, elev = 0.45 } = {}) {
  const d = fr.depth; if (!d) return fr;
  const L = [-0.49, -0.67, 0.55], lxy = Math.hypot(L[0], L[1]), ux = L[0] / lxy, uy = L[1] / lxy, slope = elev;
  const out = new Int16Array(fr.px);
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = y * fr.w + x, z = d[i]; if (z < -1e8 || fr.px[i] < 0 || fr.px[i] === IDX.outline) continue;
    let hit = false;
    for (let t = 1.5; t < maxT; t += 1) {
      const qx = Math.round(x + ux * t), qy = Math.round(y + uy * t); if (qx < 0 || qy < 0 || qx >= fr.w || qy >= fr.h) break;
      const zq = d[qy * fr.w + qx]; if (zq > z + t * slope + bias) { hit = true; break; }
    }
    if (!hit) continue;
    const nm = NAME[fr.px[i]], m = nm && nm.match(/^([a-z]+)\d/); if (!m || !FINE[m[1]]) continue;
    const k = FINE[m[1]].indexOf(nm); out[i] = IDX[FINE[m[1]][clamp(k + by, 0, 8)]];
  }
  fr.px = out; return fr;
}
const R = (S, w, h, o = {}) => castShadow(render(S, w, h, TM, { zmin: -120, zmax: 80, contrast: 1.25, contourDepth: 6, ...o }), o.shadow);

// =============================================================== houses ===
// Tall timber-framed townhouse, 88x172: stone ground floor, two jettied
// plaster floors, a steep hipped tile roof with a dormer and a chimney.
function tallHouse(v) {
  const W = 88, H = 172, S = new View(), G = H - 1 - 0.5; // street line
  const D = 18, plasterMat = v % 3 === 1 ? 'plasterG' : 'plaster';
  const fh = 36, gy0 = G - fh; // ground floor top
  // Ground floor: ashlar stone.
  const ground = ashlar(slabBox(6, gy0, 82, G, 0, D, 'stone'), { ch: 6, bw: 11, seed: v + 1 });
  S.add(ground); blockTones(S, ground, { ch: 6, bw: 11, seed: v + 1 });
  // Door: recessed arch with planks.
  const dx = v % 2 ? 30 : 56;
  S.sub(archPrism(dx, G - 27, 13, G + 1, -3, 2, 'woodB'), 0);
  S.add(planked(slabBox(dx - 6.5, G - 27, dx + 6.5, G, -2.2, 2, 'woodB', 0.1), 3.2), 0);
  // Upper floors: jettied plaster with timber framing.
  for (let k = 1; k <= 2; k++) {
    const y0 = G - fh * (k + 1), y1 = G - fh * k, jz = k * 1.6, ins = -k * 1.2;
    const wall = slabBox(6 + ins, y0, 82 - ins, y1, jz, D + jz, plasterMat, 0.2);
    S.add({ ...wall, f: (x, y, z) => wall.f(x, y, z) + 0.18 * noise3(x * 0.5, y * 0.5 + k * 9, z * 0.5) });
    // Beams: sill, posts, braces.
    S.add(slabBox(5 + ins, y1 - 3, 83 - ins, y1 + 0.5, jz + 1, 3, 'timber', 0.4), 0.3);
    S.add(slabBox(5 + ins, y0, 83 - ins, y0 + 2.2, jz + 0.8, 3, 'timber', 0.4), 0.3);
    for (const px of [7 + ins, 43, 81 - ins]) S.add(slabBox(px - 1.4, y0, px + 1.4, y1, jz + 0.8, 2, 'timber', 0.4), 0.3);
    // Diagonal braces in the lower corners of each bay.
    for (const [ax, bx] of [[8 + ins, 18], [80 - ins, 70]]) {
      S.add(capsule([ax, y1 - 3, jz + 0.4], [bx, y0 + 4, jz + 0.4], 1.1, 1.1, 'timber'), 0.2);
    }
    // Windows: recessed, with a sill.
    for (const wx of [25, 61]) {
      S.sub(slabBox(wx - 6, y0 + 9, wx + 6, y0 + 25, jz + 2, 2.6, 'timber', 0.1), 0);
      S.add(slabBox(wx - 7.5, y0 + 24.5, wx + 7.5, y0 + 27, jz + 1.8, 3, 'timber', 0.4), 0.2);
    }
    // Jetty corbels.
    for (const px of [10, 43, 78]) S.add(capsule([px, y1 + 0.5, jz - 0.5], [px, y1 + 3, jz - 2.5], 1.3, 0.8, 'timber'), 0.4);
  }
  // Roof: steep and tiled. Hipped with a dormer, or gable-fronted with bargeboards.
  const ry = G - fh * 3, gable = v % 2 === 1;
  if (!gable) {
    S.add(roofPrism(1, 87, -D - 2, 7.5, ry + 1, ry - 40, 'tile', 22), 0);
    const dmx = v === 4 ? 30 : 44;
    S.add(slabBox(dmx - 8, ry - 22, dmx + 8, ry - 6, 1, 9, plasterMat, 0.3), 0.4);
    S.add(roofPrism(dmx - 10, dmx + 10, -9, 3, ry - 20, ry - 30, 'tile', 0), 0);
    S.sub(slabBox(dmx - 4, ry - 19, dmx + 4, ry - 9, 2.5, 2.5, 'timber', 0.1), 0);
  } else {
    const tri = (cx, hw, ya, yb, z0, z1, mat) => { const rise = yb - ya; return planes([[-rise, -hw, 0, -rise * (cx - hw) - hw * yb], [rise, -hw, 0, rise * (cx + hw) - hw * yb], [0, 1, 0, yb], [0, 0, 1, z1], [0, 0, -1, -z0]], [cx - hw, ya, z0, cx + hw, yb, z1], mat); };
    S.add(tri(44, 45, ry - 46, ry + 2, -D - 2, 6.5, 'tile'), 0);
    S.sub(tri(44, 38, ry - 39.5, ry + 3, 3.4, 9, 'tile'), 0);
    S.add(tri(44, 38, ry - 39.5, ry + 0.5, -D, 3.6, plasterMat), 0);
    S.paint({ f: (x, y, z) => (z > 5.6 && y < ry + 3 ? -1 : 1), mat: 'timber' });
    // Gable framing: king post, collar, a little round window.
    S.add(slabBox(42.6, ry - 33, 45.4, ry, 4.4, 1.5, 'timber', 0.4), 0.2);
    S.add(slabBox(16, ry - 3, 72, ry - 0.5, 4.4, 1.5, 'timber', 0.4), 0.2);
    S.add(capsule([20, ry - 2, 4], [42, ry - 24, 4], 1.1, 1.1, 'timber'), 0.2);
    S.add(capsule([68, ry - 2, 4], [46, ry - 24, 4], 1.1, 1.1, 'timber'), 0.2);
    S.sub(sphere([44, ry - 15, 5], 4.2, 'timber'), 0.3);
  }
  // A cloth awning over a shop front.
  if (v === 2 || v === 5) {
    const ax0 = v === 2 ? 8 : 44, ax1 = ax0 + 34, ay = G - 31;
    const aw = planes([[0, -9, 6, -9 * ay + 6 * 1], [0, 1, 0, ay + 9], [0, -1, 0, -ay], [-1, 0, 0, -ax0], [1, 0, 0, ax1], [0, 0, -1, 1]], [ax0, ay, -1, ax1, ay + 9, 8], v === 2 ? 'canvasR' : 'canvasV');
    S.add(aw, 0);
    S.paint({ bb: [ax0, ay, -1, ax1, ay + 7, 9], f: (x, y, z) => (z > 0 && y > ay - 1 && y < ay + 8 && x > ax0 - 1 && x < ax1 + 1 && Math.floor((x - ax0) / 4) % 2 ? -1 : 1), mat: 'cloth' });
  }
  // Chimney (behind the ridge, so the engine's smoke at x 68 / y -166 still lines up).
  const chim = ashlar(slabBox(62, ry - 46, 72, ry - 18, -6, 7, 'brick', 0.4), { ch: 3, bw: 5, depth: 0.35, chip: 0.2, seed: 4 });
  S.add(chim, 0);
  S.add(slabBox(60.5, ry - 49, 73.5, ry - 46, -5.5, 8, 'stoneDark', 0.4), 0);
  // Shop sign on alternate houses.
  if (v % 2 === 0) {
    S.add(capsule([82, G - 50, 3], [91, G - 50, 3], 0.6, 0.6, 'iron'), 0);
    S.add(slabBox(83, G - 48.5, 90, G - 38, 3.6, 1.2, 'wood', 0.3), 0);
  }
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { seed: v });
  // Shadows under the eaves and each jetty.
  { const t = Math.round(sy(ry, 3.2)); shade(fr, (x, y) => y >= t && y < t + 3 && x > 4 && x < 84 && !isRoof(fr, x, y), 2); shade(fr, (x, y) => y >= t + 3 && y < t + 6 && x > 4 && x < 84 && !isRoof(fr, x, y), 1); }
  for (let k = 1; k <= 2; k++) { const t = Math.round(sy(G - fh * k + 1, (k - 1) * 1.6)); shade(fr, (x, y) => y >= t && y < t + 2 && x > 4 && x < 84, 1); }
  // Windows, by hand.
  for (let k = 1; k <= 2; k++) {
    const y0 = G - fh * (k + 1), jz = k * 1.6;
    for (const wx of [25, 61]) {
      const lit = hash(v, k, wx) < 0.62, a = Math.round(wx - 5), b = Math.round(wx + 5), t = Math.round(sy(y0 + 10, jz)), bt = Math.round(sy(y0 + 24, jz));
      litWindow(fr, (x, y) => x >= a && x < b && y >= t && y < bt, a, t, b, bt, { lit, mull: 'wood' });
      if (lit) for (const xx of [a + 1, b - 2]) dot(fr, xx, bt - 1, 'ember0');
    }
  }
  // Dormer or gable window.
  if (!gable) { const dmx = v === 4 ? 30 : 44, t = Math.round(sy(ry - 18, 2.5)), b = Math.round(sy(ry - 10, 2.5)); litWindow(fr, (x, y) => x >= dmx - 3 && x < dmx + 3 && y >= t && y < b, dmx - 3, t, dmx + 3, b, { lit: hash(v, 9) < 0.5, cols: 0, crossY: 0 }); }
  else { const cy = Math.round(sy(ry - 15, 4.6)); litWindow(fr, (x, y) => Math.hypot(x + 0.5 - 44, y + 0.5 - cy) < 3.1, 41, cy - 3, 47, cy + 3, { lit: v !== 3, cols: 2, crossY: 0.5 }); }
  {
    const wx = v % 2 ? 62 : 22, t = Math.round(G - 25), b = Math.round(G - 12), lit = v % 3 !== 0;
    fill(fr, (x, y) => x >= wx - 7 && x <= wx + 7 && y >= t - 1 && y <= b + 1, () => C('stone', 2));
    litWindow(fr, (x, y) => x >= wx - 6 && x <= wx + 6 && y >= t && y <= b, wx - 6, t, wx + 7, b + 1, { lit, cols: 2, crossY: 0.45 });
    fill(fr, (x, y) => x >= wx - 7 && x <= wx + 7 && y === b + 2, () => C('stone', 1));
  }
  // Door ring and hinges, a candle glint, the shop sign's emblem.
  dot(fr, dx + 3, G - 12, 'gold1'); dot(fr, dx + 3, G - 11, 'gold3');
  for (const yy of [G - 20, G - 7]) pline(fr, dx - 6, yy, dx - 2, yy, 'iron4');
  if (v % 2 === 0) { dot(fr, 86, Math.round(sy(G - 44, 3.6)), v % 4 ? 'gold1' : 'crimson1'); dot(fr, 87, Math.round(sy(G - 44, 3.6)), v % 4 ? 'gold2' : 'crimson2'); }
  grime(fr, 22, v);
  moss(fr, v + 40, 40, (x, y) => y > H - 40);
  for (let i = 0; i < 5; i++) streak(fr, 10 + Math.floor(hash(i, 8, v) * 68), Math.round(G - fh + 1), 3 + Math.floor(hash(i, 9, v) * 5), v);
  return fr;
}

// Pyramid spire: apex (cx, ya, zc), square base of half-width hw at y = yb.
function pyramid(cx, ya, zc, hw, yb, mat) {
  const r = yb - ya;
  return planes([[-r, -hw, 0, -r * (cx - hw) - hw * yb], [r, -hw, 0, r * (cx + hw) - hw * yb], [0, -hw, r, r * (zc + hw) - hw * yb], [0, -hw, -r, -r * (zc - hw) - hw * yb], [0, 1, 0, yb]], [cx - hw, ya, zc - hw, cx + hw, yb, zc + hw], mat);
}
const tri = (cx, hw, ya, yb, z0, z1, mat) => { const rise = yb - ya; return planes([[-rise, -hw, 0, -rise * (cx - hw) - hw * yb], [rise, -hw, 0, rise * (cx + hw) - hw * yb], [0, 1, 0, yb], [0, 0, 1, z1], [0, 0, -1, -z0]], [cx - hw, ya, z0, cx + hw, yb, z1], mat); };
const ringXY = (c, Rr, r, mat) => ({ mat, bb: [c[0] - Rr - r, c[1] - Rr - r, c[2] - r, c[0] + Rr + r, c[1] + Rr + r, c[2] + r], f: (x, y, z) => Math.hypot(Math.hypot(x - c[0], y - c[1]) - Rr, z - c[2]) - r });
const disc = (cx, cy, r, z0, z1, mat) => ({ mat, bb: [cx - r, cy - r, z0, cx + r, cy + r, z1], f: (x, y, z) => Math.max(Math.hypot(x - cx, y - cy) - r, Math.abs(z - (z0 + z1) / 2) - (z1 - z0) / 2) });
const torusY = (c, Rr, r, mat) => ({ mat, bb: [c[0] - Rr - r, c[1] - r, c[2] - Rr - r, c[0] + Rr + r, c[1] + r, c[2] + Rr + r], f: (x, y, z) => Math.hypot(Math.hypot(x - c[0], z - c[2]) - Rr, y - c[1]) - r });
const slateTest = (fr, x, y, src) => /^slate/.test(NAME[src[y * fr.w + x]] || '');

// A gothic lancet: recess carved in a wall, glass painted after rendering.
function lancetCut(S, cx, yTop, w, yBot, zf) {
  S.sub(archPrism(cx, yTop - 1.5, w + 3, yBot + 1.5, zf - 1.2, zf + 3, 'stoneDark', true), 0);
  S.add(slabBox(cx - w / 2 - 2.5, yBot + 1.5, cx + w / 2 + 2.5, yBot + 3.5, zf + 1.2, 3, 'stoneC', 0.4), 0.2);
}
function lancetGlass(fr, cx, yTop, w, yBot, zf, ramp) {
  const t = Math.round(sy(yTop, zf - 1)), b = Math.round(sy(yBot, zf - 1)), x0 = Math.round(cx - w / 2), x1 = Math.round(cx + w / 2);
  const m = (x, y) => inArch(x + 0.5, y + 0.5 - (sy(0, zf - 1)), cx, yTop, w, yBot, true);
  litWindow(fr, m, x0, t, x1, b, { ramp, mull: 'stone', crossY: 0.55, cols: w >= 6 ? 2 : 0 });
  // Leading: a diamond lattice in the lower half.
  if (w >= 8) fill(fr, (x, y) => m(x, y) && y > (t + b) / 2 && (x + y) % 4 === 0, () => C(ramp, 6));
}

function cathedral() {
  const W = 354, H = 260, S = new View(), G = H - 0.5, cx = 177;
  // Towers.
  const towers = [[44, 'crimson'], [310, 'violet']];
  for (const [tx] of towers) {
    const tw = ashlar(slabBox(tx - 31, 80, tx + 31, G, 5, 34, 'stone', 0.5), { ch: 8, bw: 15, seed: tx });
    S.add(tw, 0); blockTones(S, tw, { ch: 8, bw: 15, seed: tx });
    // Corner buttresses stepping out at the base.
    for (const bx of [tx - 29, tx + 29]) {
      S.add(ashlar(slabBox(bx - 4, 118, bx + 4, G, 9, 8, 'stoneC', 0.6), { ch: 8, bw: 8, seed: bx }), 0.5);
      S.add(pyramid(bx, 104, 5, 4, 119, 'stoneC'), 0);
    }
    // Gold-banded cornice and a parapet with corner pinnacles.
    S.add(slabBox(tx - 34, 78, tx + 34, 84, 7, 38, 'gold', 0.6), 0);
    S.add(ashlar(slabBox(tx - 32, 68, tx + 32, 78, 6, 36, 'stoneC', 0.5), { ch: 5, bw: 8, seed: tx + 3 }), 0);
    for (let k = -3; k <= 3; k++) S.sub(slabBox(tx + k * 8.6 - 2.2, 67, tx + k * 8.6 + 2.2, 73, 7, 3, 'stoneDark', 0.2), 0);
    for (const px of [tx - 30, tx + 30]) S.add(pyramid(px, 48, 3, 4.5, 69, 'stone'), 0);
    // The spire, slate-hung, with a gold finial.
    S.add(pyramid(tx, 4, -12, 25, 70, 'slate'), 0);
    S.add(capsule([tx, 3, -2], [tx, 9, -2], 0.8, 0.9, 'gold'), 0);
    S.add(sphere([tx, 1.5, -2], 1.5, 'gold'), 0);
    // Spire lucarne.
    S.add(slabBox(tx - 5, 48, tx + 5, 64, 6, 8, 'stone', 0.4), 0.3);
    S.add(tri(tx, 7, 40, 49, -2, 7.5, 'slate'), 0);
    S.sub(archPrism(tx, 51, 5, 62, 5, 9, 'hole', true), 0);
    // Lancets down the tower face.
    lancetCut(S, tx, 96, 14, 128, 5);
    lancetCut(S, tx, 146, 14, 178, 5);
    lancetCut(S, tx, 190, 10, 222, 5);
  }
  // Nave front.
  const nave = ashlar(slabBox(74, 76, 280, G, 0, 40, 'stone', 0.4), { ch: 7, bw: 14, seed: 3 });
  S.add(nave, 0); blockTones(S, nave, { ch: 7, bw: 14, seed: 3 });
  S.add(tri(cx, 110, 6, 80, -60, -3, 'slate'), 0);
  const gab = ashlar(tri(cx, 106, 8, 78, -4, 0, 'stone'), { ch: 7, bw: 14, seed: 4 });
  S.add(gab, 0); blockTones(S, gab, { ch: 7, bw: 14, seed: 4 });
  // Gilt coping along the gable, and a cross at the apex.
  { const o = tri(cx, 112, 3, 79, -5, 2.4, 'goldDim'), i = tri(cx, 106, 7.5, 81, -7, 4, 'gold'); S.add({ ...o, f: (x, y, z) => Math.max(o.f(x, y, z), -i.f(x, y, z)) }, 0); }
  S.add(slabBox(cx - 1.5, -8, cx + 1.5, 6, 1, 3, 'gold', 0.4), 0);
  S.add(slabBox(cx - 5, -4, cx + 5, -1, 1, 3, 'gold', 0.4), 0);
  // Rose window: carved disc, gilt rim.
  S.sub(disc(cx, 73, 27, -3, 4, 'stoneDark'), 0.3);
  S.add(ringXY([cx, 73, 0.4], 28.5, 2.6, 'gold'), 0);
  S.add(ringXY([cx, 73, -1.4], 25, 1.2, 'stoneC'), 0);
  // String course across the nave.
  S.add(slabBox(74, 112, 280, 116, 2.4, 6, 'stoneC', 0.6), 0.3);
  // Buttresses flanking the nave.
  for (const bx of [82, 272]) {
    S.add(ashlar(slabBox(bx - 6, 96, bx + 6, G, 7, 10, 'stoneC', 0.6), { ch: 7, bw: 12, seed: bx }), 0.4);
    S.add(pyramid(bx, 70, 2, 6, 97, 'stone'), 0);
  }
  // Niches with saints, lancets above.
  for (const nx of [116, 238]) {
    S.sub(archPrism(nx, 152, 20, 222, -5, 3, 'stoneDark', false), 0.3);
    S.add(slabBox(nx - 11, 222, nx + 11, 226, 1.5, 6, 'stoneC', 0.5), 0.2);
    // The statue: robed, hands folded in prayer, hooded head bowed.
    const st = 'stoneC';
    S.add(folds(skirt(nx, 182, 221, 4.6, 7.6, -1.5, 0.75, st), { cx: nx, cz: -1.5, n: 6, amp: 0.55, y0: 185, y1: 221 }), 0);
    S.add(ellipsoid([nx, 178, -1.5], [6, 7, 3.6], st), 2);
    S.add(sphere([nx + 0.6, 167, -0.5], 3.8, st), 1.2);
    S.add(sphere([nx + 0.6, 165.5, -2], 4.2, st), 1);
    S.sub(ellipsoid([nx + 1, 168.5, 3.2], [2.4, 2.8, 1.6], 'stoneDark'), 0.4);
    S.add(capsule([nx - 4.5, 175, 0.5], [nx - 0.6, 183, 3.2], 1.8, 1.6, st), 0.8);
    S.add(capsule([nx + 4.5, 175, 0.5], [nx + 0.6, 183, 3.2], 1.8, 1.6, st), 0.8);
    S.add(capsule([nx, 179, 3.4], [nx, 183.5, 3.6], 1, 1.2, st), 0.5);
    lancetCut(S, nx, 120, 14, 144, 0);
  }
  // The great door: three receding pointed archivolts, gilt outer order.
  const dt = 150, dw = 56;
  S.add(archPrism(cx, dt - 8, dw + 16, G, -1, 4.5, 'gold', true), 0.4);
  S.sub(archPrism(cx, dt - 3, dw + 6, G + 2, -1, 6, 'stone', true), 0.2);
  S.add(archPrism(cx, dt - 3, dw + 6, G, -6, -1, 'stoneC', true), 0);
  S.sub(archPrism(cx, dt + 2, dw - 4, G + 2, -5, 0, 'stone', true), 0.2);
  S.add(archPrism(cx, dt + 2, dw - 4, G, -10, -4.5, 'stone', true), 0);
  S.sub(archPrism(cx, dt + 7, dw - 14, G + 2, -9.5, -3, 'woodB', true), 0.2);
  S.add(planked(archPrism(cx, dt + 7, dw - 14, G, -14, -9, 'woodB', true), 5), 0);
  // Steps.
  for (let k = 0; k < 3; k++) S.add(slabBox(cx - 44 - k * 7, G - 9 + k * 3, cx + 44 + k * 7, G - 6 + k * 3 + (k === 2 ? 1 : 0), 4 + k * 4, 6 + k * 4, 'slab', 0.4), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { ch: 3, bw: 4, seed: 11, test: slateTest });
  // Hand-painted glass.
  for (const [tx, ramp] of towers) {
    lancetGlass(fr, tx, 96, 14, 128, 5, ramp === 'crimson' ? 'crimson' : 'violet');
    lancetGlass(fr, tx, 146, 14, 178, 5, ramp === 'crimson' ? 'violet' : 'crimson');
    lancetGlass(fr, tx, 190, 10, 222, 5, 'ember');
    // Lucarne glow.
    fill(fr, (x, y) => inArch(x + 0.5, y + 0.5 - sy(0, 6), tx, 52, 3, 61, true), (x, y) => C('ember', 1.5 - (y - 60) * 0.25));
  }
  for (const nx of [116, 238]) lancetGlass(fr, nx, 120, 14, 144, 0, 'crimson');
  // The rose: twelve petals of violet and crimson glass round a blood-red heart, gilt tracery.
  const rc = sy(73, -2);
  fill(fr, (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - rc) < 24, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - rc, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), seg = ((a / (Math.PI * 2) * 12) % 1 + 1) % 1;
    if (r < 6) return C('blood', r < 3 ? 0 : 1);
    if (r < 7.3 || Math.abs(seg - 0.5) > 0.42 || (r > 15.5 && r < 16.8)) return C('gold', 2 + (dy > 0 ? 1 : 0) + (dx > 0 ? 1 : 0));
    const petal = Math.floor((a / (Math.PI * 2) * 12 + 12)) % 2;
    const lift = r < 16 ? 1.2 : 2.8;
    return C(petal ? 'violet' : 'crimson', lift + (dy / 24) * 1.4 + Math.abs(seg - 0.5) * 2 + (hash(x >> 1, y >> 1, 3) - 0.5) * 1.2);
  });
  // Door: iron straps, gilt ring, a sliver of warm light at the seam.
  const dTop = Math.round(sy(dt + 7, -9)), dB = H - 10;
  for (let y = dTop + 14; y < dB; y += 15) { pline(fr, cx - 18, y, cx - 3, y, 'iron4'); pline(fr, cx + 2, y, cx + 17, y, 'iron4'); pline(fr, cx - 18, y + 1, cx - 3, y + 1, 'iron6'.replace('6', '3')); }
  pline(fr, cx - 0.5, dTop + 6, cx - 0.5, dB, 'ember2');
  for (const d of [-4, 3]) { dot(fr, cx + d, dB - 30, 'gold1'); dot(fr, cx + d, dB - 29, 'gold3'); }
  // Halos on the niche saints.
  for (const nx of [116, 238]) { const hy = Math.round(sy(160, -1.5)); pline(fr, nx - 3, hy, nx + 4, hy, 'gold1'); dot(fr, nx - 4, hy + 1, 'gold3'); dot(fr, nx + 5, hy + 1, 'gold3'); }
  // Weathering.
  grime(fr, 34, 5);
  moss(fr, 77, 260, (x, y) => y > 90);
  for (let i = 0; i < 26; i++) streak(fr, 20 + Math.floor(hash(i, 4, 7) * 314), 60 + Math.floor(hash(i, 5, 7) * 150), 4 + Math.floor(hash(i, 6, 7) * 10), i);
  return fr;
}

// ------------------------------------------------------------ more shapes ---
// Flat-ended cylinder between a and b.
function rod(a, b, r, mat) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L = Math.hypot(bx, by, bz), ux = bx / L, uy = by / L, uz = bz / L;
  return { mat, bb: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
    f: (x, y, z) => { const px = x - a[0], py = y - a[1], pz = z - a[2], t = px * ux + py * uy + pz * uz; const q = Math.hypot(px - ux * t, py - uy * t, pz - uz * t) - r; const e = Math.abs(t - L / 2) - L / 2; return Math.max(q, e) < 0 ? Math.max(q, e) : Math.hypot(Math.max(q, 0), Math.max(e, 0)); } };
}
// Hanging cloth: a thin slab that ripples in z.
function wavy(p, amp = 0.8, freq = 0.7, ph = 0) { const f = p.f; return { ...p, bb: [p.bb[0], p.bb[1], p.bb[2] - amp, p.bb[3], p.bb[4], p.bb[5] + amp], f: (x, y, z) => f(x, y, z - amp * Math.sin(x * freq + ph) * clamp((y - p.bb[1]) / 6, 0.3, 1)) * 0.8 }; }
// A jagged top edge: keep below ytop(x).
const jagged = (p, ytop) => clip(p, (x, y) => ytop(x) - y);
// Lumpy rock or rubble.
const lump = (c, r, mat, seed = 0, amp = 0.8) => { const s0 = sphere(c, r, mat); return { ...s0, bb: s0.bb.map((v, i) => v + (i < 3 ? -amp : amp)), f: (x, y, z) => s0.f(x, y, z) + amp * noise3(x * 0.5 + seed, y * 0.5, z * 0.5) }; };

// Flames by hand: tongues of fire, white-hot at the root.
function flame(fr, cx, baseY, h, w, ph = 0) {
  for (let k = 0; k < 5; k++) {
    const off = (k - 2) * w / 4, hh = h * (1 - Math.abs(k - 2) * 0.22) * (0.8 + 0.25 * Math.sin(ph * 2.1 + k * 1.7)), sway = Math.sin(ph + k) * 1.2;
    for (let y = 0; y < hh; y++) {
      const t = y / hh, half = (w / 4 + 0.6) * (1 - t * t), x0 = cx + off + sway * t;
      for (let x = Math.round(x0 - half); x <= Math.round(x0 + half); x++) {
        const core = Math.abs(x - x0) < half * 0.45 && t < 0.55;
        const s = core ? (t < 0.3 ? 0 : 1) : t < 0.45 ? 1.5 : t < 0.75 ? 2.5 : 3.5;
        const cur = under(fr, x, baseY - y);
        const nm = NAME[cur] || '';
        if (/^ember/.test(nm) && FINE.ember.indexOf(nm) <= Math.round(s)) continue;
        dot(fr, x, baseY - y, C('ember', s));
      }
    }
  }
}
// Re-outline a frame (after hand-painting outside the silhouette).
function outlineAll(fr, colour = 'outline') {
  const out = new Int16Array(fr.px);
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    if (fr.px[y * fr.w + x] >= 0) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < fr.w && yy < fr.h && fr.px[yy * fr.w + xx] >= 0 && fr.px[yy * fr.w + xx] !== IDX.outline) { out[y * fr.w + x] = IDX[colour]; break; } }
  }
  fr.px = out; return fr;
}

// ============================================================ the gate ===
function cityGate() {
  const W = 177, H = 208, S = new View(), G = H - 0.5, cx = 88.5;
  for (const tx of [31, 146]) {
    const tw = ashlar(slabBox(tx - 26, 40, tx + 26, G, 6, 30, 'stone', 0.5), { ch: 7, bw: 13, seed: tx });
    S.add(tw); blockTones(S, tw, { ch: 7, bw: 13, seed: tx });
    S.add(slabBox(tx - 28, 36, tx + 28, 42, 8, 34, 'stoneC', 0.5), 0);
    for (let k = -2; k <= 2; k++) S.add(ashlar(slabBox(tx + k * 11 - 3.5, 25, tx + k * 11 + 3.5, 37, 8, 7, 'stoneC', 0.5), { ch: 6, bw: 7, seed: k + tx }), 0);
    // Arrow-slit window with a warm light, and a long crimson banner.
    S.sub(archPrism(tx, 58, 8, 82, 3, 9, 'stoneDark', true), 0);
    S.add(rod([tx - 17, 104, 7.5], [tx + 17, 104, 7.5], 1, 'iron'), 0);
    S.add(wavy(slabBox(tx - 15, 105, tx + 15, 166, 7.6, 1.2, 'bannerR', 0.3), 0.7, 0.55, tx), 0);
    S.paint({ f: (x, y, z) => (y > 160 && y < 166 && Math.abs(x - tx) < 15.5 && z > 5 ? -1 : 1), mat: 'goldDim' });
  }
  // The curtain wall and its crenels.
  const wall = ashlar(slabBox(56, 68, 121, G, 0, 26, 'stone', 0.4), { ch: 7, bw: 13, seed: 9 });
  S.add(wall); blockTones(S, wall, { ch: 7, bw: 13, seed: 9 });
  S.add(slabBox(54, 64, 123, 69, 2, 28, 'stoneC', 0.4), 0);
  for (let k = 0; k < 6; k++) S.add(slabBox(58 + k * 11, 54, 64 + k * 11, 65, 2, 6, 'stoneC', 0.5), 0);
  // The gate arch with its voussoirs, the portcullis half raised, darkness beyond.
  S.sub(archPrism(cx, 110, 46, G + 2, -20, 4, 'hole', false), 0);
  S.add(archPrism(cx, 106, 54, G, -2, 1.6, 'stoneC', false), 0);
  S.sub(archPrism(cx, 110, 46, G + 2, -4, 4, 'hole', false), 0);
  S.add(slabBox(cx - 23, G - 0.5, cx + 23, G, -20, 20, 'hole', 0), 0);
  for (let x = cx - 20; x <= cx + 20; x += 5) S.add(rod([x, 108, -3], [x, 176, -3], 0.95, 'iron'), 0);
  for (const y of [120, 136, 152, 168]) S.add(rod([cx - 23, y, -3.2], [cx + 23, y, -3.2], 0.8, 'iron'), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  // Clip the portcullis to the arch, sharpen the spikes.
  fill(fr, (x, y) => /^iron/.test(NAME[fr.px[y * W + x]] || '') && !inArch(x + 0.5, y + 0.5 + 1, cx, 110, 46, G + 2), () => null);
  for (let x = cx - 20; x <= cx + 20; x += 5) { const yy = Math.round(sy(176, -3)); dot(fr, x, yy + 1, 'iron3'); dot(fr, x, yy + 2, 'iron5'); }
  for (const tx of [31, 146]) {
    const t = Math.round(sy(60, 3)), b = Math.round(sy(82, 3));
    litWindow(fr, (x, y) => inArch(x + 0.5, y + 0.5 - sy(0, 3), tx, 60, 5, 82, true), tx - 3, t, tx + 3, b, { cols: 0, crossY: 0 });
    // The Wound's sigil on each banner: a gilt eye.
    const by = Math.round(sy(126, 7.6));
    for (let a = 0; a < 40; a++) { const ang = a / 40 * Math.PI * 2; dot(fr, tx + Math.cos(ang) * 7, by + Math.sin(ang) * 3.4, 'gold2'); }
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (dx * dx + dy * dy <= 5) dot(fr, tx + dx, by + dy, dx * dx + dy * dy <= 1 ? 'blood0' : 'blood2');
    pline(fr, tx, by + 6, tx, by + 14, 'gold3');
  }
  grime(fr, 30, 3); moss(fr, 12, 160, (x, y) => y > 40);
  for (let i = 0; i < 14; i++) streak(fr, 8 + Math.floor(hash(i, 4, 3) * 160), 44 + Math.floor(hash(i, 5, 3) * 130), 4 + Math.floor(hash(i, 6, 3) * 8), i);
  return fr;
}

// ============================================================== the ruin ===
function ruin() {
  const W = 94, H = 143, S = new View(), G = H - 0.5;
  const top = (x) => 52 + 22 * Math.sin(x * 0.11 + 0.5) + 10 * Math.sin(x * 0.37) + (x > 60 ? (x - 60) * 0.5 : 0) - (x > 30 && x < 46 ? 18 : 0);
  const wall = jagged(ashlar(slabBox(3, 20, 91, G, 0, 10, 'stone', 0.4), { ch: 7, bw: 12, seed: 21, chip: 0.6 }), top);
  S.add(wall); blockTones(S, wall, { ch: 7, bw: 12, seed: 21 });
  for (const wx of [24, 66]) S.sub(archPrism(wx, 78, 15, 112, -12, 3, 'stoneDark', true), 0);
  // Fallen roof beams and a heap of rubble at the foot.
  S.add(rod([8, 70, 3], [62, 30, -3], 1.6, 'timber'), 0.3);
  S.add(rod([40, 44, 4], [88, 18 + 22, -2], 1.4, 'timber'), 0.3);
  for (let k = 0; k < 9; k++) S.add(lump([8 + k * 9.5 + hash(k, 1) * 4, G - 3 - hash(k, 2) * 3, 4 + hash(k, 3) * 6], 3.5 + hash(k, 4) * 2.5, k % 3 ? 'stoneC' : 'stoneB', k, 0.9), 1.2);
  const fr = R(S, W, H, { ground: H - 1 });
  for (const wx of [24, 66]) fill(fr, (x, y) => inArch(x + 0.5, y + 0.5, wx, 80, 11, 112, true) && fr.px[y * W + x] >= 0 && /^stone/.test(NAME[fr.px[y * W + x]]) === false, () => null);
  // Ivy creeping over the broken top.
  for (let i = 0; i < 70; i++) { const x = 4 + Math.floor(hash(i, 7, 2) * 86); let y = 0; while (y < H && under(fr, x, y) < 0) y++; if (y >= H - 4) continue; const len = 3 + Math.floor(hash(i, 8, 2) * 18); for (let k = 0; k < len; k++) if (under(fr, x + Math.round(Math.sin(k * 0.6 + i) * 0.7), y + k) >= 0 && under(fr, x, y + k) !== IDX.outline) dot(fr, x + Math.round(Math.sin(k * 0.6 + i) * 0.7), y + k, k % 3 === 0 ? 'moss1' : k % 3 === 1 ? 'moss2' : 'moss3'); }
  grime(fr, 26, 7); moss(fr, 33, 120);
  return fr;
}

// ========================================================= the mausoleum ===
function mausoleum() {
  const W = 114, H = 135, S = new View(), G = H - 0.5, cx = 57;
  S.add(slabBox(4, G - 6, 110, G, 6, 40, 'slab', 0.5), 0);
  S.add(slabBox(8, G - 10, 106, G - 5, 3, 36, 'stoneC', 0.5), 0);
  const body = ashlar(slabBox(14, 54, 100, G - 9, -2, 30, 'stone', 0.4), { ch: 7, bw: 12, seed: 31 });
  S.add(body); blockTones(S, body, { ch: 7, bw: 12, seed: 31 });
  // Entablature and pediment.
  S.add(slabBox(6, 50, 108, 57, 5, 38, 'stoneC', 0.5), 0);
  S.add(slabBox(8, 46, 106, 51, 4, 36, 'stone', 0.4), 0);
  S.add(tri(cx, 52, 20, 47, -30, 3.5, 'stone'), 0);
  S.sub(tri(cx, 42, 26, 46, 1.5, 6, 'stoneDark'), 0);
  // Four columns with capitals and bases.
  for (const px of [21, 39, 75, 93]) {
    S.add(rod([px, 60, 3], [px, G - 10, 3], 3.4, 'stoneC'), 0);
    S.add(slabBox(px - 5, 56, px + 5, 60.5, 5.5, 9, 'stoneC', 0.6), 0.4);
    S.add(slabBox(px - 5, G - 13, px + 5, G - 9.5, 5.5, 9, 'stoneC', 0.6), 0.4);
  }
  // Iron door in a deep reveal.
  S.sub(archPrism(cx, 78, 24, G - 9, -6, 1, 'stoneDark', false), 0);
  S.add(planked(archPrism(cx, 78, 22, G - 9, -9, -4, 'ironDark', false), 4, 0.4), 0);
  // A grieving angel kneels on the ridge, wings folded about her.
  const ax = cx, ay = 13;
  S.add(folds(skirt(ax, ay + 2, ay + 12, 3.2, 6.4, 0, 0.9, 'stoneC'), { cx: ax, cz: 0, n: 7, amp: 0.4, y0: ay + 2, y1: ay + 12 }), 0);
  S.add(ellipsoid([ax, ay, 0], [3.4, 4.6, 3], 'stoneC'), 1.4);
  S.add(sphere([ax + 1, ay - 5.8, 1], 2.7, 'stoneC'), 1);
  S.add(capsule([ax + 2.4, ay - 1.2, 2], [ax + 1.8, ay - 4.2, 3.4], 1.1, 1, 'stoneC'), 0.8);
  for (const side of [-1, 1]) S.add(rotZ(ellipsoid([ax + side * 5.5, ay + 1, -2.5], [3, 10, 1.5], 'stoneB'), [ax + side * 5.5, ay - 8], side * -0.18), 1.2);
  const fr = R(S, W, H, { ground: H - 1 });
  grime(fr, 30, 9); moss(fr, 41, 150, (x, y) => y > 40);
  for (let i = 0; i < 10; i++) streak(fr, 16 + Math.floor(hash(i, 4, 9) * 82), 58, 6 + Math.floor(hash(i, 6, 9) * 16), i);
  return fr;
}

// ============================================================ street props ===
// Small props stand on a ground line; their front-most z sits on the bottom row.
const groundY = (H, zf) => H - 0.5 - zf * TILT;

function plushStall() {
  const W = 99, H = 91, S = new View(), G = groundY(H, 7);
  S.add(slabBox(5, 22, 94, G, -6, 6, 'plaster', 0.4), 0);
  for (const px of [6, 93]) S.add(rod([px, 14, 4], [px, G, 4], 2.2, 'wood'), 0);
  // Striped awning sloping out over the counter.
  const ay = 10, aw = planes([[0, -10, 12, -10 * ay + 12 * -4], [0, 1, 0, ay + 12], [0, -1, 0, -ay], [-1, 0, 0, -1], [1, 0, 0, 98], [0, 0, -1, 6]], [1, ay, -6, 98, ay + 12, 10], 'canvasV');
  S.add(aw, 0);
  S.paint({ f: (x, y, z) => (y < ay + 13 && y > ay - 1 && Math.floor((x - 1) / 8) % 2 ? -1 : 1), mat: 'canvasG' });
  // Two shelves of plush Saints.
  for (const sy0 of [40, 58]) {
    S.add(slabBox(8, sy0 + 6, 91, sy0 + 8.5, -1, 5, 'woodB', 0.4), 0);
    for (let k = 0; k < 7; k++) {
      const x = 15 + k * 11.5, z = -3;
      S.add(skirt(x, sy0 - 1, sy0 + 6, 2.2, 3.8, z, 0.8, 'crimson'), 0.6);
      S.add(sphere([x + 0.4, sy0 - 2.6, z + 0.4], 3, 'crimson'), 1);
      S.add(capsule([x - 1, sy0 - 4.5, z - 1], [x - 3, sy0 - 7, z - 2], 1.6, 0.5, 'crimson'), 0.8);
    }
  }
  // The counter, with a ledger.
  S.add(planked(slabBox(7, 68, 92, G, 7, 9, 'wood', 0.5), 6), 0);
  S.add(slabBox(5, 66, 94, 69.5, 8, 11, 'woodB', 0.5), 0);
  S.add(slabBox(36, 63.5, 60, 66.5, 4.5, 6, 'bone', 0.5), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  for (const sy0 of [40, 58]) for (let k = 0; k < 7; k++) {
    const x = Math.round(15 + k * 11.5 + 1.6), y = Math.round(sy(sy0 - 2.6, -3));
    dot(fr, x, y, 'ink1'); dot(fr, x + 1, y, 'ink1'); dot(fr, x, y + 1, 'ink1'); dot(fr, x + 1, y + 1, 'ink2');
    dot(fr, x, y, 'flame1'); dot(fr, x + 1, y, k % 3 ? 'flame1' : 'ink1');
    const hy = Math.round(sy(sy0 - 7.5, -3)); pline(fr, x - 3, hy, x + 1, hy, 'gold1'); dot(fr, x - 4, hy + 1, 'gold3'); dot(fr, x + 2, hy + 1, 'gold3');
  }
  { const y = Math.round(sy(65, 6)); for (let x = 39; x < 58; x += 3) dot(fr, x, y, 'ink4'); dot(fr, 54, y - 1, 'crimson2'); }
  return fr;
}

function gallows(i) {
  const W = 73, H = 99, S = new View(), G = groundY(H, 9);
  S.add(planked(slabBox(2, G - 16, 71, G - 9, 9, 18, 'wood', 0.5), 6), 0);
  for (const x of [6, 67]) for (const z of [6, -6]) S.add(rod([x, G - 10, z], [x, G, z], 1.8, 'timber'), 0);
  S.add(rod([12, 6, 0], [12, G - 16, 0], 2.6, 'timber'), 0);
  S.add(rod([8, 6, 0], [60, 6, 0], 2.4, 'timber'), 0.3);
  S.add(rod([13, 26, 0], [30, 7, 0], 1.5, 'timber'), 0.3);
  const sw = i ? 2.5 : -1.5, cx = 52 + sw, cy = 28;
  // The gibbet cage with its occupant.
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; S.add(rod([cx + Math.cos(a) * 7, cy, Math.sin(a) * 7], [cx + Math.cos(a) * 7, cy + 34, Math.sin(a) * 7], 0.6, 'ironDark'), 0); }
  for (const yy of [cy, cy + 17, cy + 34]) S.add({ ...torusY([cx, yy, 0], 7.2, 0.8, 'ironDark') }, 0);
  S.add(rod([cx, cy - 1, 0], [cx, cy - 3, 0], 2, 'ironDark'), 0);
  S.add(rod([cx, cy + 34, 0], [cx, cy + 35.5, 0], 7.6, 'ironDark'), 0);
  S.add(sphere([cx + 0.5, cy + 9, 1], 3.2, 'bone'), 0.5);
  S.sub(sphere([cx + 2, cy + 9.6, 4], 1.1, 'hole'), 0.3);
  S.add(folds(skirt(cx, cy + 12, cy + 30, 3, 5, 0, 0.9, 'shroud'), { cx, n: 5, amp: 0.4, y0: cy + 12, y1: cy + 30 }), 0.8);
  const fr = R(S, W, H, { ground: H - 1 });
  pline(fr, 52, 8, cx, cy - 7, 'shroud3');
  dot(fr, cx + 1, Math.round(cy + 9), 'ink0'); dot(fr, cx + 3, Math.round(cy + 9), 'ink0');
  return fr;
}

function cart() {
  const W = 68, H = 44, S = new View(), G = groundY(H, 8);
  S.add(planked(slabBox(5, 14, 56, 25, 7, 16, 'wood', 0.5), 5), 0);
  S.add(rod([56, 20, 4], [68, 27, 4], 1.2, 'woodB'), 0);
  S.add(rod([56, 20, -6], [68, 27, -6], 1.2, 'woodB'), 0);
  for (const [x, y, z] of [[17, 12, 2], [33, 11, -1], [46, 13, 3]]) S.add(folds(ellipsoid([x, y, z], [9, 4.2, 5], 'shroud'), { cx: x, cz: z, n: 10, amp: 0.35, y0: y - 4, y1: y + 4 }), 1.4);
  S.add(sphere([8, 10.5, 3], 2.3, 'bone'), 0.5);
  // The wheel: rim, spokes, hub.
  const wc = [18, G - 9, 8];
  S.add(ringXY(wc, 8.4, 1.3, 'woodB'), 0);
  for (let a = 0; a < 8; a++) S.add(rod(wc, [wc[0] + Math.cos(a * Math.PI / 4) * 8, wc[1] + Math.sin(a * Math.PI / 4) * 8, wc[2]], 0.6, 'woodB'), 0);
  S.add(sphere(wc, 1.8, 'iron'), 0);
  return R(S, W, H, { ground: H - 1 });
}

function brazier(i) {
  const W = 23, H = 39, S = new View(), G = groundY(H, 3);
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 + 0.5; S.add(rod([11.5 + Math.cos(a) * 6, G, Math.sin(a) * 3.5], [11.5 + Math.cos(a) * 2, 20, Math.sin(a) * 1.5], 0.9, 'iron'), 0.4); }
  S.add(clip(sphere([11.5, 14, 0], 8, 'iron'), (x, y) => 15.5 - y), 0);
  S.add(clip(sphere([11.5, 14, 0], 6.5, 'iron'), (x, y) => 15.5 - y), 0, 'sub');
  S.add(lump([11.5, 16.5, 0], 5.6, 'coal', 3, 0.7), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  flame(fr, 11.5, Math.round(sy(15, 2)), 13, 11, i * 2.1);
  for (let k = 0; k < 4; k++) dot(fr, 6 + Math.floor(hash(k, i, 4) * 11), Math.round(sy(15.5, 2)) + (k & 1), k % 2 ? 'ember2' : 'ember1');
  return outlineAll(fr);
}

function campfire(i) {
  const W = 36, H = 26, S = new View(), G = groundY(H, 7);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; S.add(lump([18 + Math.cos(a) * 12, G - 2, Math.sin(a) * 6], 2.4, k % 2 ? 'stoneC' : 'stoneB', k, 0.6), 0.6); }
  S.add(rod([7, G - 3, 2], [29, G - 6, -2], 1.8, 'woodB'), 0.3);
  S.add(rod([8, G - 6, -3], [28, G - 3, 2], 1.8, 'wood'), 0.3);
  const fr = R(S, W, H, { ground: H - 1 });
  flame(fr, 18, Math.round(G - 4), 15 + (i === 1 ? 2 : 0), 12, i * 2.3);
  return outlineAll(fr);
}

function tombstone(v) {
  const W = 21, H = 29, S = new View(), G = groundY(H, 3);
  let p;
  if (v === 0) { S.add(bumpy2(slabBox(8, 3, 13, G, 2, 4, 'stone', 0.6), v)); S.add(bumpy2(slabBox(3, 8, 18, 13, 2, 4, 'stone', 0.6), v + 1), 0.4); }
  else if (v === 1) { p = archPrism(10.5, 6, 15, G, -2, 2, 'stone'); S.add(bumpy2(p, v)); }
  else { p = jagged(slabBox(3, 6, 18, G, 2, 4, 'stone', 0.4), (x) => 9 + Math.abs(Math.sin(x * 0.9)) * 4 + (x > 12 ? 3 : 0)); S.add(bumpy2(p, v)); }
  S.add(lump([10.5, G, 0], 7, 'moss', v, 1), 1);
  S.add(clip(sphere([10.5, G + 3, 0], 9, 'bark'), (x, y) => (G - 1) - y), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  if (v === 1) for (const y of [12, 15, 18]) pline(fr, 7, Math.round(sy(y, 2)), 14, Math.round(sy(y, 2)), 'stone5');
  return fr;
}
function bumpy2(p, seed) { const f = p.f; return { ...p, f: (x, y, z) => f(x, y, z) + 0.35 * noise3(x * 0.6 + seed * 7, y * 0.6, z * 0.6) }; }

function deadTree() {
  const W = 83, H = 117, S = new View(), G = groundY(H, 5);
  const grow = (a, ang, len, r, depth, seed) => {
    const b = [a[0] + Math.sin(ang) * len, a[1] - Math.cos(ang) * len, a[2] + (hash(seed, 1) - 0.5) * 4];
    S.add(capsule(a, b, r, r * 0.68, 'bark'), r > 2 ? 1.6 : 0.8);
    if (depth <= 0 || r < 0.7) return;
    const n = depth > 2 ? 2 : 2 + (hash(seed, 2) < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) grow(b, ang + (k - (n - 1) / 2) * (0.6 + hash(seed, k + 3) * 0.4) + (hash(seed, 9) - 0.5) * 0.3, len * (0.62 + hash(seed, k + 5) * 0.2), r * 0.66, depth - 1, seed * 3 + k + 1);
  };
  // Roots, trunk with a twist, then branches.
  for (const [dx, dz] of [[-9, 2], [8, 3], [2, -4], [-3, 5]]) S.add(capsule([41.5, G - 7, 0], [41.5 + dx, G, dz], 3.4, 1.2, 'bark'), 1.5);
  S.add(capsule([41.5, G, 0], [40, G - 34, 0], 5.6, 4.2, 'bark'), 2);
  S.sub(ellipsoid([42.5, G - 20, 4], [1.8, 3.4, 2], 'hole'), 0.5);
  grow([40, G - 34, 0], -0.15, 30, 4.2, 4, 7);
  grow([40.5, G - 42, 0], 0.95, 18, 2.8, 3, 11);
  grow([40, G - 28, 0], -1.1, 16, 2.6, 3, 13);
  const bark = { ...S }; void bark;
  const fr = R(S, W, H, { ground: H - 1 });
  return fr;
}

function fence() {
  const W = 42, H = 34, S = new View(), G = groundY(H, 1);
  for (const y of [10, 22]) S.add(rod([0, y, 0], [42, y, 0], 0.9, 'iron'), 0);
  for (let k = 0; k < 6; k++) { const x = 3.5 + k * 7; S.add(rod([x, 6, 0], [x, G, 0], 1, 'iron'), 0); S.add(pyramid(x, 0.5, 0, 1.6, 6.5, 'iron'), 0); }
  const fr = R(S, W, H, { ground: H - 1, noOutline: true });
  return outlineAll(fr);
}

function well() {
  const W = 47, H = 52, S = new View(), G = groundY(H, 12);
  const ring = ashlar({ ...rod([23.5, 34, 0], [23.5, G, 0], 12, 'stone'), mat: 'stone' }, { ch: 4.5, bw: 6, seed: 8, chip: 0.4 });
  S.add({ ...ring, f: (x, y, z) => Math.max(ring.f(x, y, z), -(Math.hypot(x - 23.5, z) - 9.5)) }, 0);
  S.add({ ...rod([23.5, 36, 0], [23.5, G, 0], 9.6, 'hole') }, 0);
  for (const x of [8, 39]) S.add(rod([x, 6, 0], [x, 36, 0], 1.6, 'timber'), 0);
  S.add(rod([6, 12, 0], [41, 12, 0], 1.3, 'timber'), 0);
  S.add(tri(23.5, 22, 0, 7, -8, 8, 'tile'), 0);
  S.add(slabBox(20, 22, 27, 28, 2, 5, 'wood', 0.6), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { ch: 3, bw: 4, seed: 4 });
  pline(fr, 23, Math.round(sy(12, 0)) + 1, 23, Math.round(sy(22, 2)) - 1, 'shroud3');
  return fr;
}

// The Ashen Altar: a stepped stone altar under a crimson cloth with a gold
// cross, two tall candles, and an iron bowl of ash and embers where
// Hallowed pieces are burned. Three frames of fire.
function ashAltar(i) {
  const W = 64, H = 62, S = new View(), G = groundY(H, 8);
  S.add(slabBox(2, G - 3, 62, G, 8, 16, 'stoneB', 0.4), 0);
  S.add(slabBox(6, G - 6, 58, G - 3, 6.5, 13, 'stoneC', 0.4), 0);
  S.add(ashlar(slabBox(10, G - 26, 54, G - 6, 5, 10, 'stone', 0.5), { ch: 5, bw: 9, seed: 5, chip: 0.4 }), 0);
  for (const x of [13, 47]) S.add(slabBox(x, G - 22, x + 4, G - 9, 5.2, 1.2, 'stoneDark', 0.3), 0, 'sub');
  S.add(slabBox(7, G - 30, 57, G - 26, 6.5, 13.5, 'stoneC', 0.6), 0);
  // The cloth over the top and down the front, gold-hemmed, with a cross.
  S.add(slabBox(18, G - 31.2, 46, G - 29.6, 6.9, 13.8, 'bannerR', 0.2), 0);
  S.add(slabBox(18, G - 30, 46, G - 12, 7.1, 0.8, 'bannerR', 0.2), 0);
  S.add(slabBox(18, G - 14, 46, G - 12, 7.6, 0.8, 'gold', 0.2), 0);
  S.add(slabBox(31, G - 27, 33, G - 16, 7.7, 0.7, 'gold', 0.2), 0);
  S.add(slabBox(28, G - 24.5, 36, G - 22.5, 7.7, 0.7, 'gold', 0.2), 0);
  // The ash bowl on a short iron foot.
  const yc = G - 41;
  S.add(rod([32, G - 31, 0], [32, yc + 6, 0], 2.2, 'iron'), 0.5);
  S.add(ellipsoid([32, G - 31.5, 0], [4.5, 1.2, 3], 'iron'), 0.6);
  S.add(clip(sphere([32, yc, 0], 9, 'iron'), (x, y) => (yc + 0.5) - y), 0);
  S.add(clip(sphere([32, yc, 0], 7.6, 'iron'), (x, y) => (yc + 0.5) - y), 0, 'sub');
  S.add(lump([32, yc + 2.2, 0], 6.6, 'stoneC', 7, 0.9), 0);
  // Candlesticks at the two ends.
  for (const x of [11.5, 52.5]) { S.add(rod([x, G - 30, -2], [x, G - 33, -2], 1.8, 'gold'), 0.4); S.add(rod([x, G - 33, -2], [x, G - 42, -2], 1.4, 'bone'), 0.3); }
  const fr = R(S, W, H, { ground: H - 1 });
  flame(fr, 32, Math.round(sy(yc, 0)), 6 + (i % 2) * 2, 7, i * 2.1);
  for (let k = 0; k < 6; k++) dot(fr, 26 + Math.floor(hash(k, i, 9) * 13), Math.round(sy(yc + 1, 3)) + (k & 1), k % 2 ? 'ember2' : 'ember1');
  for (const x of [11.5, 52.5]) flame(fr, x, Math.round(sy(G - 42.5, -2)), 5 + ((i + (x > 30 ? 1 : 0)) % 2), 3, i * 1.7 + x);
  return outlineAll(fr);
}

// The Canonry's lectern: a stone pedestal with a gilt cross, a reading desk
// and the open Book of Virtues, a candle burning beside it.
function lectern(i) {
  const W = 38, H = 56, S = new View(), G = groundY(H, 6);
  S.add(slabBox(6, G - 4, 32, G, 6, 12, 'stoneB', 0.4), 0);
  S.add(ashlar(slabBox(12, G - 28, 26, G - 4, 4, 7, 'stone', 0.5), { ch: 5, bw: 7, seed: 3, chip: 0.3 }), 0);
  S.add(slabBox(18, G - 24, 20, G - 10, 4.6, 0.6, 'gold', 0.2), 0);
  S.add(slabBox(15, G - 20, 23, G - 18, 4.6, 0.6, 'gold', 0.2), 0);
  S.add(slabBox(5, G - 33, 33, G - 28, 5, 11, 'wood', 0.5), 0);
  S.add(slabBox(6, G - 35, 32, G - 33, 4.6, 9.4, 'bannerR', 0.3), 0);
  S.add(slabBox(7.5, G - 38, 18.6, G - 35, 4.2, 8.4, 'bone', 0.5), 0);
  S.add(slabBox(19.4, G - 38, 30.5, G - 35, 4.2, 8.4, 'bone', 0.5), 0);
  S.add(slabBox(18.5, G - 36, 19.5, G - 30, 4.9, 0.6, 'bannerR', 0.1), 0);
  S.add(rod([33.5, G - 4, -2], [33.5, G - 26, -2], 1.1, 'iron'), 0.3);
  S.add(rod([33.5, G - 26, -2], [33.5, G - 33, -2], 1.4, 'bone'), 0.3);
  const fr = R(S, W, H, { ground: H - 1 });
  for (let r = 0; r < 3; r++) { const y = Math.round(sy(G - 37 + r, 4.2)); pline(fr, 9, y, 16, y, 'bone3'); pline(fr, 21, y, 28, y, 'bone3'); }
  flame(fr, 33.5, Math.round(sy(G - 33.5, -2)), 5 + (i % 2), 3, i * 1.9);
  return outlineAll(fr);
}

// The Enchanter's table: a heavy dark-wood table in 3/4 view with a violet
// rune circle cut into its top, an open book, a crystal on an iron stand,
// candles and reagent pouches. Three frames: the runes pulse, flames flicker.
function enchanter(i) {
  const W = 48, H = 60, S = new View(), zf = 14, D = 38, G = groundY(H, zf), top = G - 17, cx = 24, cz = zf - D / 2;
  // Legs, a low stretcher, a planked apron and the thick top.
  for (const [x, z] of [[6, zf - 3], [42, zf - 3], [6, zf - D + 3], [42, zf - D + 3]]) S.add(slabBox(x - 2.6, top + 3, x + 2.6, G, z + 2.6, 5.2, 'timber', 0.6), 0);
  S.add(slabBox(7, G - 5, 41, G - 3, zf - 1.5, 3, 'timber', 0.4), 0);
  S.add(planked(slabBox(5, top + 2, 43, top + 6, zf - 1.5, D - 3, 'woodB', 0.4), 6), 0);
  S.add(slabBox(2, top - 1, 46, top + 2.4, zf, D, 'timber', 0.7), 0);
  // A violet runner down the front, gilt-hemmed.
  S.add(wavy(slabBox(18, top + 1, 30, top + 10, zf + 0.6, 0.8, 'canvasV', 0.2), 0.4, 0.9), 0);
  S.add(slabBox(18, top + 9, 30, top + 10.6, zf + 1, 0.8, 'gold', 0.2), 0);
  // The open book, back left.
  const by = top - 1, bz = zf - D + 13;
  S.add(slabBox(3.5, by - 1.4, 18.5, by, bz, 10, 'bark', 0.3), 0);
  S.add(slabBox(4.5, by - 2.6, 10.6, by - 1.2, bz - 0.6, 8.6, 'bone', 0.5), 0);
  S.add(slabBox(10.3, by - 2.2, 11.7, by - 1, bz - 0.6, 8.6, 'bannerR', 0.2), 0);
  S.add(slabBox(11.4, by - 2.6, 17.5, by - 1.2, bz - 0.6, 8.6, 'bone', 0.5), 0);
  // The crystal on a small iron stand, back right.
  const kx = 37, kz = zf - D + 7;
  S.add(slabBox(kx - 3.5, by - 1.5, kx + 3.5, by, kz + 3.5, 7, 'iron', 0.4), 0);
  S.add(rod([kx, by - 1, kz], [kx, by - 6, kz], 0.9, 'iron'), 0.4);
  S.add(torusY([kx, by - 6.5, kz], 2.4, 0.8, 'iron'), 0.3);
  S.add(capsule([kx, by - 8, kz], [kx, by - 18, kz], 3.2, 0.5, 'glass_violet'), 0);
  S.add(capsule([kx, by - 8, kz], [kx, by - 5.5, kz], 3.2, 1, 'glass_violet'), 0);
  // Candles at the corners.
  const candles = [[4.5, zf - D + 4, 8], [44, zf - D + 5, 6], [4.5, zf - 4, 5]];
  for (const [x, z, h] of candles) S.add(rod([x, by, z], [x, by - h, z], 1.4, 'bone'), 0.3);
  // Reagent pouches, front right.
  S.add(lump([40, by - 2.6, zf - 6], 3, 'bark', 4, 0.4), 0.6);
  S.add(capsule([40, by - 5.2, zf - 6], [40, by - 6.8, zf - 6], 1, 1.5, 'bark'), 0.6);
  S.add(lump([44, by - 2, zf - 2], 2.4, 'shroud', 9, 0.3), 0.6);
  const fr = R(S, W, H, { ground: H - 1 });
  // The rune circle, cut into the bare wood of the top.
  const ty = (z) => sy(by, z), ex = cx, ey = ty(cz), rx = 12.5, ry = (ty(zf) - ty(zf - D)) * 0.36;
  const onTop = (x, y) => /^wood/.test(NAME[under(fr, x, y)] || '');
  const glow = (s) => C('violet', s + [1.2, 0, 0.6][i]);
  const mark = (x, y, s) => { if (onTop(x, y)) dot(fr, x, y, glow(s)); };
  for (let k = 0; k < 80; k++) { const a = k / 80 * Math.PI * 2; mark(ex + Math.cos(a) * rx, ey + Math.sin(a) * ry, 2); }
  // Three spokes and a hot heart.
  for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2 - Math.PI / 2; for (let t = 0.2; t < 0.8; t += 0.1) mark(ex + Math.cos(a) * rx * t, ey + Math.sin(a) * ry * t, 3); }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + i * 0.5; mark(ex + Math.cos(a) * rx * 0.9, ey + Math.sin(a) * ry * 0.9 - 1, 1); }
  mark(ex, ey, 0); mark(ex + 1, ey, 0);
  // Lines on the book's pages.
  for (let r = 0; r < 2; r++) { const y = Math.round(sy(by - 2.6, bz - 2 - r * 3)); pline(fr, 6, y, 9, y, 'bone3'); pline(fr, 13, y, 16, y, 'bone3'); }
  // The crystal's inner light and a glint.
  const kyy = Math.round(sy(by - 11, kz));
  dot(fr, kx, kyy, i === 1 ? 'white' : 'violet0'); dot(fr, kx - 2, kyy - 4, 'violet0');
  if (i !== 2) dot(fr, kx + 4 + i * 2, kyy - 9 + i * 3, 'violet1');
  for (const [x, z, h] of candles) flame(fr, x, Math.round(sy(by - h - 0.5, z)), 4 + ((i + Math.round(x)) % 2), 2, i * 1.8 + x);
  return outlineAll(fr);
}
// Martyrdom's stake: a charred post with a crossbar and iron chains, on a
// heap of kindling ringed with stones, embers still alive at its foot.
function stake(i) {
  const W = 44, H = 66, S = new View(), G = groundY(H, 8);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; S.add(lump([22 + Math.cos(a) * 15, G - 2, Math.sin(a) * 6], 2.6, k % 2 ? 'stoneC' : 'stoneB', k + 3, 0.6), 0.5); }
  for (const [x0, z0, x1, z1] of [[9, 4, 33, -3], [11, -4, 35, 3], [14, 5, 28, -5], [16, -5, 31, 5]]) S.add(rod([x0, G - 4, z0], [x1, G - 7, z1], 1.7, 'woodB'), 0.4);
  S.add(rod([22, G - 6, 0], [22, 6, 0], 2.4, 'timber'), 0.3);
  S.add(rod([12, 15, 0], [32, 15, 0], 1.8, 'timber'), 0.3);
  for (let k = 0; k < 4; k++) S.add(torusY([22, 26 + k * 3.2, 0], 3.4, 0.9, 'iron'), 0.2);
  S.add(rod([25, 32, 1], [28, 40, 2], 0.7, 'iron'), 0.2);
  const fr = R(S, W, H, { ground: H - 1 });
  for (let k = 0; k < 7; k++) dot(fr, 12 + Math.floor(hash(k, i, 5) * 21), Math.round(sy(G - 5, 2)) + (k & 1), k % 3 ? 'ember2' : 'ember1');
  flame(fr, 20 + (i % 3), Math.round(sy(G - 6, 4)), 4 + (i % 2) * 2, 5, i * 2.7);
  return outlineAll(fr);
}

// The Pilgrim Road's waymark: a stone milestone with a carved arrow and a
// lantern hung from an iron arm.
function waymark(i) {
  const W = 34, H = 60, S = new View(), G = groundY(H, 5);
  S.add(slabBox(5, G - 4, 25, G, 5, 10, 'stoneB', 0.4), 0);
  S.add(bumpy2(slabBox(8, G - 34, 22, G - 4, 3.5, 7, 'stone', 0.8), 2), 0);
  S.add(slabBox(6, G - 38, 24, G - 34, 4.5, 9, 'stoneC', 0.6), 0);
  S.add(rod([22, G - 33, 0], [30, G - 33, 0], 0.9, 'iron'), 0.3);
  S.add(rod([29.5, G - 33, 0], [29.5, G - 30, 0], 0.6, 'iron'), 0.2);
  S.add(slabBox(26.5, G - 30, 32.5, G - 22, 1.5, 3, 'iron', 0.5), 0);
  S.add(slabBox(27.5, G - 29, 31.5, G - 23, 1.7, 0.6, 'hole', 0.2), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  // A gilt pilgrim's cross painted on the face.
  const fy = (y) => Math.round(sy(y, 3.5));
  for (let y = G - 30; y <= G - 12; y++) { dot(fr, 14, fy(y), 'gold1'); dot(fr, 15, fy(y), 'gold2'); }
  for (let x = 11; x <= 18; x++) { dot(fr, x, fy(G - 25), 'gold1'); dot(fr, x, fy(G - 24), 'gold2'); }
  const lx = 29, ly = Math.round(sy(G - 26, 1.7));
  for (const [dx, dy, c] of [[0, 0, i % 2 ? 'ember1' : 'ember0'], [1, 0, 'ember1'], [0, -1, 'gold0'], [1, -1, i % 2 ? 'gold0' : 'ember0'], [0, 1, 'ember2'], [1, 1, 'ember2']]) dot(fr, lx + dx, ly + dy, c);
  return outlineAll(fr);
}

// The Vigil Roll: a tall stele by the cathedral where the best kept Vigils
// are cut, a bloodrose carved at its crown, candles burning at its feet.
function vigilRoll(i) {
  const W = 48, H = 74, S = new View(), G = groundY(H, 6);
  S.add(slabBox(4, G - 5, 44, G, 6, 12, 'stoneB', 0.4), 0);
  const face = ashlar(slabBox(9, G - 50, 39, G - 5, 3.5, 7, 'stone', 0.6), { ch: 9, bw: 15, seed: 7, chip: 0.25 });
  S.add(face, 0);
  S.add(disc(24, G - 50, 15, -3.5, 3.5, 'stone'), 1.5);
  S.add(slabBox(7, G - 9, 41, G - 5, 4.2, 9, 'stoneC', 0.5), 0);
  // The bloodrose at its crown.
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; S.add(sphere([24 + Math.cos(a) * 3, G - 53 + Math.sin(a) * 3, 3.6], 2.6, 'rose'), 1); }
  S.add(sphere([24, G - 53, 4.6], 2, 'roseDeep'), 0.6);
  // Candles in iron cups at its feet.
  for (const x of [7.5, 40.5]) { S.add(rod([x, G - 6, 4], [x, G - 13, 4], 1.3, 'bone'), 0.2); S.add(slabBox(x - 2, G - 7, x + 2, G - 5, 4, 4, 'iron', 0.4), 0); }
  const fr = R(S, W, H, { ground: H - 1 });
  // Lines cut into the face: the names of the kept Vigils, gilt.
  for (let r = 0; r < 5; r++) { const y = Math.round(sy(G - 42 + r * 6, 3.5)), w = [20, 16, 18, 14, 17][r]; pline(fr, 24 - w / 2, y, 24 + w / 2, y, r === 0 ? 'gold1' : 'stone3'); pline(fr, 24 - w / 2, y + 1, 24 + w / 2, y + 1, r === 0 ? 'gold2' : 'stone4'); }
  for (const x of [7.5, 40.5]) flame(fr, x, Math.round(sy(G - 13.5, 4)), 4 + ((i + (x > 20 ? 1 : 0)) % 2), 2, i * 1.9 + x);
  return outlineAll(fr);
}
// A little stand for an earned halo: a stone post with a red cushion. Frame 0
// stands empty; frames 1-10 hold each earned halo (its palette ramp): 9 the
// Ossuarch's, 10 the Ash Widow's (Stratum III).
const STAND_HALOS = ['bone', 'pot', 'cloth', 'blood', 'stone', 'teal', 'moss', 'sand', 'rot', 'shroud'];
function haloStand(i) {
  const W = 24, H = 44, S = new View(), G = groundY(H, 4);
  S.add(slabBox(5, G - 4, 19, G, 4, 8, 'stoneB', 0.4), 0);
  S.add(bumpy2(slabBox(8, G - 18, 16, G - 4, 3, 5, 'stone', 0.5), 4), 1);
  S.add(slabBox(6, G - 20, 18, G - 18, 3.5, 7, 'stoneC', 0.4), 1);
  S.add(ellipsoid([12, G - 21.5, 3], [5, 2, 3.5], 'bannerR'), 1);
  const ramp = STAND_HALOS[i - 1];
  if (ramp) S.add(ringXY([12, G - 32, 3], 6.4, 1.6, `halo_${ramp}`), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  // The cracked halo: a gap knocked out of its right side.
  if (ramp === 'sand') { const y0 = Math.round(sy(G - 36, 3)) & ~1; for (let y = y0; y < y0 + 4; y++) for (let x = 16; x < 22; x++) fr.px[y * fr.w + x] = -1; }
  return outlineAll(fr);
}

function noticeBoard() {
  const W = 39, H = 52, S = new View(), G = groundY(H, 2);
  for (const x of [5, 34]) S.add(rod([x, 4, 0], [x, G, 0], 1.6, 'timber'), 0);
  S.add(planked(slabBox(1, 6, 38, 33, 1.5, 3, 'wood', 0.5), 5), 0);
  S.add(tri(19.5, 21, -2, 6, -3, 3, 'tile'), 0);
  const papers = [[8, 10, 11, 9, 0.08], [20, 9, 9, 12, -0.06], [10, 21, 12, 9, -0.04], [24, 22, 9, 8, 0.1]];
  for (const [x, y, w, h, a] of papers) S.add(rotZ(slabBox(x, y, x + w, y + h, 2.6, 0.8, 'bone', 0.1), [x + w / 2, y + h / 2], a), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { ch: 3, bw: 4, seed: 2 });
  for (const [x, y, w, h] of papers) for (let r = y + 2; r < y + h - 1; r += 2) pline(fr, x + 1.5, Math.round(sy(r, 2.6)), x + w - 2, Math.round(sy(r, 2.6)), 'bone4');
  dot(fr, 13, Math.round(sy(16, 2.6)), 'crimson1'); dot(fr, 14, Math.round(sy(16, 2.6)), 'crimson2');
  dot(fr, 28, Math.round(sy(27, 2.6)), 'crimson1');
  return fr;
}

function stocks() {
  const W = 47, H = 42, S = new View(), G = groundY(H, 6);
  S.add(planked(slabBox(2, G - 5, 45, G, 6, 12, 'woodB', 0.5), 6), 0);
  for (const x of [6, 41]) S.add(rod([x, 6, 0], [x, G - 4, 0], 2, 'timber'), 0);
  S.add(slabBox(4, 12, 43, 18, 2, 4, 'wood', 0.5), 0);
  S.add(slabBox(4, 18.4, 43, 24, 2, 4, 'wood', 0.5), 0);
  for (const [x, r] of [[14, 2], [23.5, 3.1], [33, 2]]) S.sub(rod([x, 18.2, -3], [x, 18.2, 4], r, 'hole'), 0);
  S.add(rod([2, 7, 1], [45, 7, 1], 1.2, 'iron'), 0);
  return R(S, W, H, { ground: H - 1 });
}

function pool(i) {
  const W = 104, H = 44, S = new View(), cx = 52, zr = 24, G = groundY(H, zr + 1);
  const rim = ashlar({ ...rod([cx, G - 6, 0], [cx, G, 0], 1, 'stone'), bb: [cx - 50, G - 6, -zr, cx + 50, G, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 50, z / zr) * zr - zr, Math.abs(y - (G - 3)) - 3) }, { ch: 3, bw: 7, seed: 5, chip: 0.4 });
  S.add({ ...rim, mat: 'stoneC' }, 0);
  S.sub({ mat: 'hole', bb: [cx - 44, G - 8, -zr, cx + 44, G + 1, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 44, z / (zr - 5)) * (zr - 5) - (zr - 5), Math.abs(y - (G - 5)) - 2.5) }, 0.4);
  S.add({ mat: 'water', bb: [cx - 44, G - 4.5, -zr, cx + 44, G - 2, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 44, z / (zr - 5)) * (zr - 5) - (zr - 5), Math.abs(y - (G - 3.2)) - 0.6) }, 0);
  const fr = R(S, W, H, { ground: H - 1 });
  // Shimmer on the scrying water and the drowned eye at its heart.
  const wy = sy(G - 3.8, 0);
  fill(fr, (x, y) => /^violet/.test(NAME[fr.px[y * W + x]] || ''), (x, y) => {
    const dx = (x + 0.5 - cx) / 44, dz = (y + 0.5 - wy) / ((zr - 5) * TILT), r = Math.hypot(dx, dz);
    const wave = Math.sin(r * 18 - i * 2.1) * 0.5 + 0.5;
    if (r < 0.1) return C('blood', r < 0.05 ? 0 : 1);
    if (r < 0.14) return C('violet', 5);
    return C('violet', 2.2 + r * 3 + (wave > 0.82 ? -1.6 : 0) + (dz < 0 ? 0.6 : 0));
  });
  for (let k = 0; k < 6; k++) { const a = k + i * 0.7; dot(fr, Math.round(cx + Math.cos(a) * 30), Math.round(wy + Math.sin(a * 1.7) * 5), 'holy1'); }
  return fr;
}

// ============================================================ town sheet ===
// Cobbles, 16x16. Every variant shares the same stones along its borders so
// they tile seamlessly in any order; variants differ by cracks, moss and wet.
function cobble(v) {
  const N = 16, pts = [];
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) pts.push([(gx + 0.5 + (hash(gx, gy, 71) - 0.5) * 0.5 + (gy % 2) * 0.5) * N / 3, (gy + 0.5 + (hash(gx, gy, 72) - 0.5) * 0.4) * N / 3]);
  const cell = (x, y) => { let d1 = 1e9, d2 = 1e9, id = -1; for (const [i, [px, py]] of pts.entries()) for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { const d = Math.hypot(x - px - ox, (y - py - oy) * 1.15); if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d; } return [d2 - d1, id]; };
  const hgt = (x, y) => { const [e] = cell(x, y); return Math.sqrt(clamp(e / 2.6, 0, 1)) * 2; };
  const fr = { w: N, h: N, px: new Int16Array(N * N) };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const X = x + 0.5, Y = y + 0.5, [e, id] = cell(X, Y);
    if (e < 0.9) { fr.px[y * N + x] = IDX[C('stone', 7.4 + (e < 0.45 ? 0.6 : 0))]; continue; }
    const gx = hgt(X + 0.5, Y) - hgt(X - 0.5, Y), gy = hgt(X, Y + 0.5) - hgt(X, Y - 0.5);
    const lit = clamp(0.5 - gx * 0.5 - gy * 0.6, 0, 1);
    const tone = hash(id, 9, 77) * 1.2 - 0.3;
    let ramp = 'stone', st = 6.2 - lit * 4.4 + tone;
    if (v === 2 && Math.hypot(X - 8, Y - 8) < 5.2) { ramp = 'slate'; st -= 0.6; if ((x + y * 3) % 7 === 0) st = 1; } // a puddle catching the sky
    fr.px[y * N + x] = IDX[C(ramp, st)];
  }
  if (v === 1) for (const [x, y] of [[5, 6], [6, 7], [7, 7], [8, 8], [9, 8]]) dot(fr, x, y, 'ink3');
  if (v === 3) for (let k = 0; k < 9; k++) { const x = Math.floor(hash(k, 3, 5) * 16), y = Math.floor(hash(k, 4, 5) * 16); if (NAME[fr.px[y * N + x]].startsWith('stone4') || NAME[fr.px[y * N + x]].startsWith('stone3h')) dot(fr, x, y, k % 2 ? 'moss3' : 'moss4'); }
  return fr;
}

// The Vestry: a small chapel with a lift down into the Wound.
function vestry() {
  const W = 146, H = 125, S = new View(), G = H - 0.5, cx = 73;
  const body = ashlar(slabBox(12, 46, 134, G, 0, 30, 'stone', 0.4), { ch: 6, bw: 12, seed: 51 });
  S.add(body); blockTones(S, body, { ch: 6, bw: 12, seed: 51 });
  S.add(tri(cx, 76, 6, 48, -40, -2, 'slate'), 0);
  const gab = ashlar(tri(cx, 70, 10, 47, -4, 0, 'stone'), { ch: 6, bw: 12, seed: 52 }); S.add(gab, 0);
  { const o = tri(cx, 75, 5, 48, -5, 2, 'goldDim'), i = tri(cx, 70, 8.5, 50, -7, 4, 'gold'); S.add({ ...o, f: (x, y, z) => Math.max(o.f(x, y, z), -i.f(x, y, z)) }, 0); }
  S.sub(disc(cx, 34, 10, -3, 4, 'stoneDark'), 0.3);
  S.add(ringXY([cx, 34, 0.4], 11, 1.6, 'gold'), 0);
  for (const bx of [16, 130]) { S.add(ashlar(slabBox(bx - 5, 52, bx + 5, G, 6, 9, 'stoneC', 0.5), { ch: 6, bw: 10, seed: bx }), 0.4); S.add(pyramid(bx, 34, 1, 5, 53, 'stone'), 0); }
  for (const lx of [36, 110]) lancetCut(S, lx, 62, 12, 92, 0);
  const dt = 70, dw = 34;
  S.add(archPrism(cx, dt - 6, dw + 12, G, -1, 4, 'gold', true), 0.4);
  S.sub(archPrism(cx, dt - 2, dw + 4, G + 2, -1, 6, 'stone', true), 0.2);
  S.add(archPrism(cx, dt - 2, dw + 4, G, -6, -1, 'stoneC', true), 0);
  S.sub(archPrism(cx, dt + 3, dw - 6, G + 2, -5.5, 0, 'woodB', true), 0.2);
  S.add(planked(archPrism(cx, dt + 3, dw - 6, G, -10, -5, 'woodB', true), 4), 0);
  for (let k = 0; k < 2; k++) S.add(slabBox(cx - 26 - k * 6, G - 5 + k * 3, cx + 26 + k * 6, G - 2 + k * 3, 4 + k * 4, 6 + k * 4, 'slab', 0.4), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { ch: 3, bw: 4, seed: 6, test: slateTest });
  for (const lx of [36, 110]) lancetGlass(fr, lx, 62, 12, 92, 0, 'violet');
  const rc = sy(34, -2);
  fill(fr, (x, y) => Math.hypot(x + 0.5 - cx, y + 0.5 - rc) < 9, (x, y) => { const dx = x + 0.5 - cx, dy = y + 0.5 - rc, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), seg = ((a / (Math.PI * 2) * 8) % 1 + 1) % 1; if (r < 2.5) return C('blood', 1); if (Math.abs(seg - 0.5) > 0.4) return C('gold', 3); return C(Math.floor(a / Math.PI * 4 + 8) % 2 ? 'violet' : 'crimson', 2.2 + dy / 9); });
  const dTop = Math.round(sy(dt + 3, -10));
  for (let y = dTop + 10; y < H - 6; y += 12) { pline(fr, cx - 12, y, cx - 2, y, 'iron4'); pline(fr, cx + 1, y, cx + 11, y, 'iron4'); }
  pline(fr, cx - 0.5, dTop + 4, cx - 0.5, H - 6, 'holy3');
  grime(fr, 22, 51); moss(fr, 52, 120, (x, y) => y > 40);
  return fr;
}

// The Forge of Penance: a sooty brick smithy with a roaring hearth.
function forge() {
  const W = 114, H = 104, S = new View(), G = H - 0.5;
  const body = ashlar(slabBox(6, 38, 108, G, 0, 22, 'brick', 0.4), { ch: 4, bw: 8, depth: 0.4, chip: 0.25, seed: 61 });
  S.add(body); blockTones(S, body, { ch: 4, bw: 8, seed: 61, mats: ['brickB', 'stoneB'], frac: 0.25 });
  S.add(roofPrism(0, 114, -26, 7, 40, 14, 'tile', 0), 0);
  // The chimney stack rising from the ridge.
  S.add(ashlar(slabBox(78, 0, 96, 30, -8, 12, 'stone', 0.5), { ch: 5, bw: 9, seed: 62 }), 0);
  S.add(slabBox(76, -2, 98, 3, -6, 15, 'stoneDark', 0.4), 0);
  // The hearth arch: deep, round, glowing.
  S.sub(archPrism(52, 56, 54, G + 2, -14, 4, 'coal', false), 0);
  S.add(archPrism(52, 52, 62, G, -1, 1.8, 'stoneC', false), 0);
  S.sub(archPrism(52, 56, 54, G + 2, -14, 4, 'coal', false), 0);
  S.add(slabBox(26, G - 6, 78, G, -6, 10, 'coal', 0.5), 0);
  // Window and a hammer sign.
  S.sub(slabBox(88, 50, 100, 64, 2, 3, 'timber', 0.2), 0);
  S.add(slabBox(86.5, 63.5, 101.5, 66, 1.6, 3, 'stoneC', 0.4), 0);
  S.add(slabBox(8, 46, 22, 58, 2.2, 1.6, 'wood', 0.4), 0);
  S.add(rod([12, 54.5, 3.4], [18, 49, 3.4], 0.8, 'woodB'), 0);
  S.add(slabBox(14, 47, 21, 51, 3.6, 1.6, 'iron', 0.4), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { ch: 4, bw: 6, seed: 3 });
  // Fire inside: white-hot coals, flame tongues, light spilling on the reveal.
  const top = Math.round(sy(56, -12));
  fill(fr, (x, y) => inArch(x + 0.5, y + 0.5 - sy(0, -12), 52, 56, 50, G - 4) && fr.px[y * W + x] >= 0 && /^ink/.test(NAME[fr.px[y * W + x]]), (x, y) => C('ember', 7.6 - Math.pow((y - top) / (G - top), 1.6) * 6.2 + (hash(x >> 1, y >> 1, 3) - 0.5) * 0.8));
  for (let k = 0; k < 4; k++) flame(fr, 34 + k * 12, H - 6, 12 + (k % 2) * 6, 10, k * 1.9);
  for (let x = 28; x < 77; x++) dot(fr, x, H - 4 - (x % 3 === 0 ? 1 : 0), hash(x, 1, 2) < 0.5 ? 'ember0' : 'ember1');
  shade(fr, (x, y) => (Math.abs(x - 52) > 25 && Math.abs(x - 52) < 33 && y > 54), -1);
  litWindow(fr, (x, y) => x >= 89 && x < 99 && y >= 51 && y < 63, 89, 51, 99, 63, {});
  grime(fr, 20, 62);
  return fr;
}

// A market stall with potions, bones and a gold ingot.
function stall() {
  const W = 94, H = 83, S = new View(), G = groundY(H, 7);
  S.add(planked(slabBox(5, 18, 89, G, -6, 4, 'woodB', 0.4), 6), 0);
  for (const px of [6, 88]) S.add(rod([px, 10, 4], [px, G, 4], 2, 'wood'), 0);
  const ay = 6, aw = planes([[0, -10, 12, -10 * ay + 12 * -4], [0, 1, 0, ay + 13], [0, -1, 0, -ay], [-1, 0, 0, -1], [1, 0, 0, 93], [0, 0, -1, 6]], [1, ay, -6, 93, ay + 13, 11], 'canvasR');
  S.add(wavy(aw, 0.4, 0.8), 0);
  S.paint({ f: (x, y, z) => (y < ay + 14 && y > ay - 2 && Math.floor((x - 1) / 9) % 2 ? -1 : 1), mat: 'cloth' });
  S.add(slabBox(8, 38, 86, 40.5, -1, 5, 'wood', 0.4), 0);
  const pot = [['flame', 18], ['holy', 30], ['flame', 42], ['crimson', 54], ['holy', 66], ['violet', 78]];
  for (const [m, x] of pot) { S.add(sphere([x, 33, -2], 3.4, 'glass_' + m), 0.6); S.add(rod([x, 26.5, -2], [x, 30.5, -2], 1.3, 'glass_' + m), 0.5); S.add(rod([x, 25, -2], [x, 27, -2], 1.5, 'wood'), 0); }
  S.add(planked(slabBox(7, 58, 87, G, 7, 9, 'wood', 0.5), 6), 0);
  S.add(slabBox(5, 56, 89, 59.5, 8, 11, 'woodB', 0.5), 0);
  S.add(sphere([24, 52.5, 3], 4, 'bone'), 0.5); S.sub(sphere([26.5, 53, 6.6], 1.2, 'hole'), 0.3); S.sub(sphere([22.5, 53, 6.6], 1.2, 'hole'), 0.3);
  S.add(rod([38, 54.5, 4], [56, 52.5, 3], 1.3, 'bone'), 0.3); S.add(sphere([38, 54.5, 4], 1.9, 'bone'), 0.5); S.add(sphere([56, 52.5, 3], 1.9, 'bone'), 0.5);
  S.add(slabBox(66, 51, 78, 55.5, 4, 6, 'gold', 0.6), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  for (const [, x] of pot) { dot(fr, x - 1.5, Math.round(sy(31.5, -2)), 'white'); }
  return fr;
}

// Round 42: every vendor in Vael has its own stall on the upper street, built
// like Pell's: a planked back, two posts, a striped awning (stripes a and b),
// a shelf and a counter. goods(S) adds the wares; after(fr) paints details.
function vendorStall({ a, b, back = 'woodB', goods, after, shelf = true }) {
  const W = 96, H = 84, S = new View(), G = groundY(H, 7);
  S.add(planked(slabBox(5, 18, 91, G, -6, 4, back, 0.4), 6), 0);
  for (const px of [6, 90]) S.add(rod([px, 10, 4], [px, G, 4], 2, 'wood'), 0);
  const ay = 6, aw = planes([[0, -10, 12, -10 * ay + 12 * -4], [0, 1, 0, ay + 13], [0, -1, 0, -ay], [-1, 0, 0, -1], [1, 0, 0, 95], [0, 0, -1, 6]], [1, ay, -6, 95, ay + 13, 11], a);
  S.add(wavy(aw, 0.4, 0.8), 0);
  S.paint({ f: (x, y, z) => (y < ay + 14 && y > ay - 2 && Math.floor((x - 1) / 9) % 2 ? -1 : 1), mat: b });
  if (shelf) S.add(slabBox(8, 38, 88, 40.5, -1, 5, 'wood', 0.4), 0);
  S.add(planked(slabBox(7, 58, 89, G, 7, 9, 'wood', 0.5), 6), 0);
  S.add(slabBox(5, 56, 91, 59.5, 8, 11, 'woodB', 0.5), 0);
  goods(S);
  const fr = R(S, W, H, { ground: H - 1 });
  if (after) after(fr);
  return fr;
}
// The Bounty Board's stall: green and sand awning, notices pinned to the back
// (one a red WANTED with a skull), a coin pouch and a ledger on the counter.
function bountyStall() {
  const notes = [[16, 22, 12, 13, 'canvasS'], [32, 21, 11, 15, 'bone'], [48, 23, 14, 12, 'canvasS'], [66, 21, 12, 14, 'bone'], [22, 42, 12, 12, 'bone'], [40, 43, 15, 11, 'canvasS'], [60, 42, 13, 12, 'canvasS']];
  return vendorStall({ a: 'canvasM', b: 'canvasS', shelf: false,
    goods: (S) => {
      for (const [x, y, w, h, m] of notes) S.add(slabBox(x, y, x + w, y + h, 4, 5, m, 0.2), 0);
      S.add(slabBox(76, 36, 86, 50, 4, 5.2, 'bannerR', 0.2), 0);
      S.add(sphere([28, 52.5, 4], 3.6, 'woodB'), 0.6); S.add(rod([28, 48.5, 4], [28, 50, 4], 1.2, 'gold'), 0.4);
      S.add(slabBox(46, 51.5, 64, 55.5, 4, 6.5, 'bone', 0.4), 0); S.add(slabBox(54.6, 51, 55.4, 55.8, 4, 6.6, 'woodB', 0.1), 0);
      for (const x of [72, 76]) S.add(sphere([x, 54, 5], 1.9, 'gold'), 0.4);
    },
    after: (fr) => {
      for (const [x, y, w, h] of notes) for (let ly = y + 3; ly < y + h - 2; ly += 3) pline(fr, x + 2, Math.round(sy(ly, 5)), x + w - 3, Math.round(sy(ly, 5)), 'ink3');
      for (const [x, y] of notes) { dot(fr, x + 5, Math.round(sy(y + 1, 5.2)), 'crimson1'); }
      const wy = Math.round(sy(41, 5.4)); dot(fr, 80, wy, 'bone0'); dot(fr, 81, wy, 'bone0'); dot(fr, 82, wy, 'bone0'); dot(fr, 80, wy + 1, 'ink0'); dot(fr, 82, wy + 1, 'ink0'); dot(fr, 81, wy + 2, 'bone1');
    } });
}
// The Scrying Pool's booth: violet and ink awning, a starry drape behind, a
// stone basin of glowing water with candles either side.
function seerStall() {
  return vendorStall({ a: 'canvasV', b: 'canvasI', back: 'drape', shelf: false,
    goods: (S) => {
      S.add(ellipsoid([48, 50, 2], [15, 5, 7], 'stone'), 0.8); S.sub(ellipsoid([48, 47.5, 2], [12.5, 3.5, 5.5], 0), 0.4);
      S.add(ellipsoid([48, 48.6, 2], [12, 1.4, 5.2], 'water'), 0);
      for (const x of [26, 70]) { S.add(capsule([x, 55.5, 5], [x, 47, 5], 1.7, 1.6, 'bone'), 0.4); }
    },
    after: (fr) => {
      for (let k = 0; k < 14; k++) { const x = 12 + Math.floor(hash(k, 3) * 72), y = Math.round(sy(22 + hash(k, 5) * 30, -6)); if (y > 0) dot(fr, x, y, k % 3 ? 'gold1' : 'holy0'); }
      for (const x of [26, 70]) { const y = Math.round(sy(45, 5)); flame(fr, x, y, 4, 1.4, x); }
      const wy = Math.round(sy(48.6, 5)); for (let x = 41; x < 56; x += 3) dot(fr, x, wy, 'holy0');
    } });
}
// The Enchanter's stall: teal and gold awning, jars of ingredients on the
// shelf, an open book of glowing runes and a crystal on the counter.
function enchStall() {
  const jars = [[16, 'glass_holy'], [27, 'glass_violet'], [38, 'glass_crimson'], [58, 'glass_holy'], [69, 'glass_flame'], [80, 'glass_violet']];
  return vendorStall({ a: 'canvasT', b: 'canvasG',
    goods: (S) => {
      for (const [x, m] of jars) { S.add(capsule([x, 36.5, -1], [x, 31, -1], 3.2, 3, m), 0.6); S.add(rod([x, 27.5, -1], [x, 29.5, -1], 2.4, 'wood'), 0); }
      S.add(slabBox(20, 53, 34, 55.5, 4, 7, 'bone', 0.3), 0); S.add(slabBox(34, 53, 48, 55.5, 4, 7, 'bone', 0.3), 0); S.add(slabBox(33.4, 52.5, 34.6, 56, 4, 7.2, 'bannerR', 0.1), 0);
      S.add(capsule([64, 55.5, 5], [66, 46, 5], 2.6, 0.8, 'glass_violet'), 0.5); S.add(capsule([68, 55.5, 5], [70, 50, 5], 1.6, 0.6, 'glass_holy'), 0.4);
    },
    after: (fr) => {
      const y = Math.round(sy(53.5, 6)); for (const x of [23, 26, 29, 37, 40, 44]) { dot(fr, x, y, 'holy0'); dot(fr, x, y - 1, 'holy1'); }
      for (const [x] of jars) dot(fr, x - 1.5, Math.round(sy(32, -1)), 'white');
    } });
}

// The Gilded Lamb: a broad timbered inn with a gilt sign.
function tavern() {
  const W = 135, H = 109, S = new View(), G = H - 0.5, D = 22;
  const gw = ashlar(slabBox(6, 64, 129, G, 0, D, 'stone', 0.4), { ch: 6, bw: 11, seed: 71 });
  S.add(gw); blockTones(S, gw, { ch: 6, bw: 11, seed: 71 });
  const up = slabBox(4, 30, 131, 64, 2, D + 2, 'plaster', 0.2);
  S.add({ ...up, f: (x, y, z) => up.f(x, y, z) + 0.18 * noise3(x * 0.5, y * 0.5, z * 0.5) });
  S.add(slabBox(3, 61, 132, 65, 3, 4, 'timber', 0.4), 0.3);
  S.add(slabBox(3, 30, 132, 32.5, 2.8, 4, 'timber', 0.4), 0.3);
  for (const px of [5, 36, 67.5, 99, 130]) S.add(slabBox(px - 1.5, 30, px + 1.5, 64, 2.8, 2, 'timber', 0.4), 0.3);
  for (const [a, b] of [[7, 34], [34, 7], [101, 128], [128, 101]]) S.add(capsule([a, 62, 2.6], [b, 34, 2.6], 1.1, 1.1, 'timber'), 0.2);
  for (const wx of [51, 83]) { S.sub(slabBox(wx - 7, 38, wx + 7, 55, 4, 2.6, 'timber', 0.1), 0); S.add(slabBox(wx - 8.5, 54.5, wx + 8.5, 57, 3.8, 3, 'timber', 0.4), 0.2); }
  S.add(roofPrism(0, 135, -D - 4, 8, 31, 4, 'tile', 26), 0);
  for (const dmx of [40, 95]) { S.add(slabBox(dmx - 7, 12, dmx + 7, 26, 0, 8, 'plaster', 0.3), 0.4); S.add(roofPrism(dmx - 9, dmx + 9, -8, 2.5, 14, 5, 'tile', 0), 0); S.sub(slabBox(dmx - 3.5, 15, dmx + 3.5, 24, 1.5, 2.5, 'timber', 0.1), 0); }
  // Door and the bay of the common room.
  S.sub(archPrism(67.5, 78, 16, G + 1, -3, 2, 'woodB'), 0);
  S.add(planked(slabBox(59.5, 78, 75.5, G, -2.2, 2, 'woodB', 0.1), 3.2), 0);
  for (const wx of [26, 109]) S.sub(slabBox(wx - 12, 76, wx + 12, 96, 2, 3, 'timber', 0.1), 0);
  // The sign of the Gilded Lamb.
  S.add(rod([96, 70, 4], [118, 70, 4], 0.7, 'iron'), 0);
  S.add(slabBox(104, 71.5, 118, 82, 4.4, 1.4, 'wood', 0.4), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { seed: 5 });
  for (const wx of [51, 83]) litWindow(fr, (x, y) => x >= wx - 6 && x < wx + 6 && y >= Math.round(sy(39, 4)) && y < Math.round(sy(54, 4)), wx - 6, Math.round(sy(39, 4)), wx + 6, Math.round(sy(54, 4)), {});
  for (const dmx of [40, 95]) litWindow(fr, (x, y) => x >= dmx - 3 && x < dmx + 3 && y >= Math.round(sy(15.5, 1)) && y < Math.round(sy(23.5, 1)), dmx - 3, Math.round(sy(15.5, 1)), dmx + 3, Math.round(sy(23.5, 1)), { cols: 0, crossY: 0, lit: dmx === 40 });
  for (const wx of [26, 109]) litWindow(fr, (x, y) => x >= wx - 11 && x < wx + 11 && y >= Math.round(sy(77, 1)) && y < Math.round(sy(95, 1)), wx - 11, Math.round(sy(77, 1)), wx + 11, Math.round(sy(95, 1)), { cols: 4, crossY: 0.45 });
  for (const wx of [26, 109]) for (const xx of [wx - 6, wx + 5]) pline(fr, xx, Math.round(sy(77, 1)), xx, Math.round(sy(95, 1)) - 1, 'wood6'.replace('6', '4'));
  // A little golden lamb on the sign.
  const ly = Math.round(sy(76, 4.4));
  for (const [x, y, c] of [[108, 0, 'gold1'], [109, 0, 'gold1'], [110, 0, 'gold1'], [111, 0, 'gold2'], [112, 0, 'gold2'], [107, 1, 'gold2'], [108, 1, 'gold1'], [109, 1, 'gold1'], [110, 1, 'gold2'], [111, 1, 'gold2'], [112, 1, 'gold3'], [113, -1, 'gold1'], [114, -1, 'gold2'], [113, -2, 'gold2'], [108, 2, 'gold3'], [112, 2, 'gold3'], [108, 3, 'gold4'], [112, 3, 'gold4']]) dot(fr, x, ly + y, c);
  dot(fr, 68 + 4, H - 14, 'gold1');
  grime(fr, 20, 72); moss(fr, 73, 60, (x, y) => y > 70);
  return fr;
}

function smallHouse(v) {
  const W = 62, H = 94, S = new View(), G = H - 0.5, D = 14;
  const gw = ashlar(slabBox(5, 58, 57, G, 0, D, 'stone', 0.4), { ch: 6, bw: 10, seed: 81 + v });
  S.add(gw); blockTones(S, gw, { ch: 6, bw: 10, seed: 81 + v });
  const up = slabBox(4, 30, 58, 58, 1.6, D + 1.6, v ? 'plasterG' : 'plaster', 0.2);
  S.add({ ...up, f: (x, y, z) => up.f(x, y, z) + 0.18 * noise3(x * 0.5, y * 0.5 + v, z * 0.5) });
  S.add(slabBox(3, 55, 59, 58.5, 2.6, 3, 'timber', 0.4), 0.3);
  for (const px of [5, 31, 57]) S.add(slabBox(px - 1.4, 30, px + 1.4, 58, 2.4, 2, 'timber', 0.4), 0.3);
  for (const wx of [18, 44]) { S.sub(slabBox(wx - 5, 36, wx + 5, 50, 3.6, 2.6, 'timber', 0.1), 0); S.add(slabBox(wx - 6.5, 49.5, wx + 6.5, 52, 3.4, 3, 'timber', 0.4), 0.2); }
  S.add(roofPrism(0, 62, -D - 3, 7, 31, 2, 'tile', v ? 0 : 16), 0);
  if (v) S.add(slabBox(46, -2, 54, 16, -6, 6, 'brick', 0.4), 0);
  const dx = v ? 42 : 20;
  S.sub(archPrism(dx, 68, 12, G + 1, -3, 2, 'woodB'), 0);
  S.add(planked(slabBox(dx - 6, 68, dx + 6, G, -2.2, 2, 'woodB', 0.1), 3), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  tilePass(fr, { seed: v + 7 });
  for (const wx of [18, 44]) { const t = Math.round(sy(37, 3.6)), b = Math.round(sy(49, 3.6)); litWindow(fr, (x, y) => x >= wx - 4 && x < wx + 4 && y >= t && y < b, wx - 4, t, wx + 4, b, { lit: hash(v, wx) < 0.6 }); }
  { const wx = v ? 18 : 44, t = H - 28, b = H - 16; litWindow(fr, (x, y) => x >= wx - 5 && x < wx + 5 && y >= t && y < b, wx - 5, t, wx + 5, b, { lit: v === 0 }); }
  grime(fr, 18, v); moss(fr, 90 + v, 30, (x, y) => y > 50);
  return fr;
}

function lamp(i) {
  const W = 18, H = 60, S = new View(), G = groundY(H, 3);
  S.add(rod([9, G - 4, 0], [9, G, 0], 3, 'ironDark'), 0);
  S.add(rod([9, 16, 0], [9, G - 3, 0], 1.2, 'ironDark'), 0);
  S.add(rod([9, 15, 0], [9, 16.5, 0], 3.6, 'ironDark'), 0);
  for (const [dx, dz] of [[-3.4, 2.4], [3.4, 2.4], [-3.4, -2.4], [3.4, -2.4]]) S.add(rod([9 + dx, 5, dz], [9 + dx * 0.8, 15, dz * 0.8], 0.55, 'ironDark'), 0);
  S.add(pyramid(9, -0.5, 0, 5, 5, 'ironDark'), 0);
  S.add(sphere([9, -1, 0], 1.1, 'ironDark'), 0);
  const fr = R(S, W, H, { ground: H - 1 });
  // The lantern's glass and flame.
  const top = Math.round(sy(5, 2.4)), bot = Math.round(sy(15, 2.4));
  for (let y = top + 1; y < bot; y++) for (let x = 6; x <= 12; x++) { const c = NAME[fr.px[y * W + x]] || ''; if (/^iron/.test(c) && (x === 6 || x === 12)) continue; const t = (y - top) / (bot - top), u = Math.abs(x - 9) / 3.5; dot(fr, x, y, C('ember', (i ? 1.2 : 0.8) + u * 2 + Math.abs(t - 0.6) * 3)); }
  dot(fr, 9, Math.round((top + bot) / 2) + 1, 'ember0'); dot(fr, 9, Math.round((top + bot) / 2), i ? 'ember0' : 'white');
  return outlineAll(fr);
}

function fountain(i) {
  const W = 78, H = 65, S = new View(), cx = 39, zr = 16, G = groundY(H, zr + 1);
  const basin = ashlar({ mat: 'stoneC', bb: [cx - 38, G - 9, -zr, cx + 38, G, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 38, z / zr) * zr - zr, Math.abs(y - (G - 4.5)) - 4.5) }, { ch: 4.5, bw: 7, seed: 9, chip: 0.4 });
  S.add(basin, 0);
  S.sub({ mat: 'hole', bb: [cx - 34, G - 11, -zr, cx + 34, G, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 34, z / (zr - 3)) * (zr - 3) - (zr - 3), Math.abs(y - (G - 8)) - 3) }, 0.4);
  S.add({ mat: 'water', bb: [cx - 34, G - 6.5, -zr, cx + 34, G - 4, zr], f: (x, y, z) => Math.max(Math.hypot((x - cx) / 34, z / (zr - 3)) * (zr - 3) - (zr - 3), Math.abs(y - (G - 5.4)) - 0.6) }, 0);
  // Central column and a small weeping saint holding a bowl.
  S.add(rod([cx, 34, 0], [cx, G - 5, 0], 4.4, 'stoneC'), 0);
  S.add(rod([cx, 32, 0], [cx, 35, 0], 6.4, 'stoneC'), 0.6);
  // A hooded saint with a bowl held out before her.
  S.add(folds(skirt(cx, 17, 34, 3.4, 6.4, 0, 0.9, 'stoneC'), { cx, n: 7, amp: 0.5, y0: 17, y1: 34 }), 0);
  S.add(ellipsoid([cx, 16, 0], [4.6, 5.4, 3.4], 'stoneC'), 1.6);
  S.add(sphere([cx + 1, 8.6, 0.8], 3.2, 'stoneC'), 1.2);
  S.add(capsule([cx - 1, 7.5, -1.5], [cx - 2.5, 12, -2.8], 3.6, 2.6, 'stoneC'), 1.4);
  S.sub(ellipsoid([cx + 2.6, 9.6, 3.6], [1.6, 2.2, 1.4], 'stoneDark'), 0.4);
  for (const side of [-1, 1]) S.add(capsule([cx + side * 4, 14, 0.5], [cx + side * 1.6, 19, 4], 1.5, 1.3, 'stoneC'), 0.8);
  S.add(clip(ellipsoid([cx, 19.5, 5], [5.4, 3, 3.4], 'stoneC'), (x, y) => 19 - y), 0.6);
  const fr = R(S, W, H, { ground: H - 1 });
  const wy = sy(G - 5.6, 0);
  fill(fr, (x, y) => /^violet/.test(NAME[fr.px[y * W + x]] || ''), (x, y) => { const dx = (x + 0.5 - cx) / 34, dz = (y + 0.5 - wy) / ((zr - 3) * TILT), r = Math.hypot(dx, dz); return C('holy', 2.4 + r * 1.8 + (Math.sin(r * 16 - i * 3) > 0.7 ? -1.2 : 0) + (dz < 0 ? 0.5 : 0)); });
  // Water trickling from the bowl.
  for (const side of [-1, 1]) for (let k = 0; k < 12; k++) { const t = k / 11, x = cx + side * (5 + t * 9), y = 20 + t * t * 19 + (i && k % 3 === 0 ? 1 : 0); dot(fr, x, Math.round(sy(y, 3)), k % 2 ? 'holy2' : 'holy1'); }
  pline(fr, cx - 2, Math.round(sy(4, 0.5)), cx + 4, Math.round(sy(4, 0.5)), 'gold1'); dot(fr, cx - 3, Math.round(sy(4, 0.5)) + 1, 'gold3'); dot(fr, cx + 5, Math.round(sy(4, 0.5)) + 1, 'gold3');
  return fr;
}

function barrel() {
  const W = 18, H = 23, S = new View(), G = groundY(H, 7);
  const st = { mat: 'wood', bb: [2, 3, -7, 16, G, 7], f: (x, y, z) => { const t = (y - (G + 3) / 2) / ((G - 3) / 2); const r = 7 - t * t * 1.4; return Math.max(Math.hypot(x - 9, z) - r, Math.abs(y - (G + 3) / 2) - (G - 3) / 2); } };
  S.add(planked(st, 3, 0.25), 0);
  for (const y of [6, G - 3]) S.add(torusY([9, y, 0], 6.6 - (y > 10 ? 0.2 : 0), 0.7, 'iron'), 0);
  return R(S, W, H, { ground: H - 1 });
}
function crate() {
  const W = 21, H = 21, S = new View(), G = groundY(H, 6);
  S.add(planked(slabBox(2, 6, 19, G, 6, 12, 'wood', 0.4), 4.25), 0);
  S.add(rotZ(slabBox(1, 12, 20, 14.5, 6.6, 1, 'woodB', 0.3), [10.5, 12], 0.72), 0);
  for (const y of [6, G - 2]) S.add(slabBox(1.5, y - 0.5, 19.5, y + 2, 6.8, 1.2, 'woodB', 0.3), 0);
  return R(S, W, H, { ground: H - 1 });
}
function anvil() {
  const W = 26, H = 18, S = new View(), G = groundY(H, 4);
  S.add(slabBox(5, G - 4, 21, G, 4, 8, 'iron', 0.5), 0);
  S.add(slabBox(9, 7, 17, G - 3.5, 2.5, 5, 'iron', 0.5), 0.6);
  S.add(slabBox(4, 2, 21, 7.5, 3, 6, 'iron', 0.6), 0.5);
  S.add(capsule([21, 4, 0], [25.5, 3.5, 0], 2.6, 0.6, 'iron'), 1);
  return R(S, W, H, { ground: H - 1 });
}
function waystone(i) {
  const W = 36, H = 52, S = new View(), G = groundY(H, 5);
  const st = { mat: 'slate', bb: [8, 2, -6, 28, G, 6], f: (x, y, z) => { const t = (y - 2) / (G - 2), hw = 5 + t * 4, top = Math.hypot((x - 18) / hw, (y - 10) / 8); const body = Math.max(Math.abs(x - 18 + t * 0.5) - hw, Math.abs(z) - 4.2 - t, y - G, 2 - y); return y < 10 ? Math.max(Math.max(top - 1, Math.abs(z) - 4.2) * 3, body) : body; } };
  S.add(bumpy2(st, 4), 0);
  for (let k = 0; k < 6; k++) S.add(lump([7 + k * 4.4, G - 1, 4 + (k % 2) * 2], 2.2, k % 2 ? 'stoneB' : 'moss', k, 0.5), 0.8);
  const fr = R(S, W, H, { ground: H - 1 });
  // Runes, pulsing with the Wound's light, and a faint halo round the stone.
  const glow = [2.4, 1.4, 0.4, 1.4][i];
  const runes = [[18, 12], [17, 13], [19, 13], [18, 14], [18, 18], [16, 19], [17, 19], [18, 19], [19, 19], [20, 19], [18, 20], [17, 25], [18, 24], [19, 25], [18, 26], [18, 27], [16, 31], [17, 32], [18, 31], [19, 32], [20, 31], [18, 36], [17, 37], [19, 37]];
  for (const [x, y] of runes) dot(fr, x, Math.round(sy(y, 4.2)), C('holy', glow));
  for (const [x, y] of runes) { const yy = Math.round(sy(y, 4.2)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nm = NAME[under(fr, x + dx, yy + dy)] || ''; if (/^slate/.test(nm)) dot(fr, x + dx, yy + dy, C('holy', glow + 3.5)); } }
  if (i === 2) for (let k = 0; k < 6; k++) dot(fr, 8 + Math.floor(hash(k, 1, i) * 20), 4 + Math.floor(hash(k, 2, i) * 30), 'holy1');
  return fr;
}

export default {
  town: {
    cobble: () => [0, 1, 2, 3].map(cobble),
    vestry: () => [vestry()],
    forge: () => [forge()],
    stall: () => [stall()],
    tavern: () => [tavern()],
    house: () => [smallHouse(0), smallHouse(1)],
    lamp: () => [lamp(0), lamp(1)],
    fountain: () => [fountain(0), fountain(1)],
    barrel: () => [barrel()],
    crate: () => [crate()],
    anvil: () => [anvil()],
    waystone: () => [0, 1, 2, 3].map(waystone),
  },
  town2: {
    cathedral: () => [cathedral()],
    gate: () => [cityGate()],
    ruin: () => [ruin()],
    mausoleum: () => [mausoleum()],
    plush: () => [plushStall()],
    gallows: () => [gallows(0), gallows(1)],
    cart: () => [cart()],
    brazier: () => [0, 1, 2].map(brazier),
    campfire: () => [0, 1, 2].map(campfire),
    tomb: () => [0, 1, 2].map(tombstone),
    tree: () => [deadTree()],
    fence: () => [fence()],
    well: () => [well()],
    ashaltar: () => [0, 1, 2].map(ashAltar),
    lectern: () => [0, 1, 2].map(lectern),
    waymark: () => [0, 1].map(waymark),
    stake: () => [0, 1, 2].map(stake),
    enchanter: () => [0, 1, 2].map(enchanter),
    board: () => [noticeBoard()],
    stall_board: () => [bountyStall()], stall_pool: () => [seerStall()], stall_ench: () => [enchStall()],
    vigilroll: () => [0, 1, 2].map(vigilRoll),
    halostand: () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(haloStand),
    stocks: () => [stocks()],
    pool: () => [0, 1, 2].map(pool),
    tall: () => [0, 1, 2, 3, 4, 5].map(tallHouse),
  },
};
