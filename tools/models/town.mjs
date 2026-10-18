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
  hole: { ramp: 'ink', bias: -0.5, min: 5 }, moss: { ramp: 'moss', min: 1 }, bark: { ramp: 'shroud', spec: 0.05, min: 1 },
  cloth: { ramp: 'cloth', max: 6 }, canvasR: { ramp: 'crimson', spec: 0.04 }, canvasV: { ramp: 'violet', spec: 0.04 }, canvasG: { ramp: 'gold', spec: 0.04 },
  bannerR: { ramp: 'crimson', spec: 0.05, bias: -0.05 }, bone: { ramp: 'bone', spec: 0.2 }, shroud: { ramp: 'shroud' },
  water: { ramp: 'violet', spec: 0.9, bias: 0.05 }, coal: { ramp: 'ink', bias: -0.1, min: 2 },
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
  return { ...p, f: (x, y, z) => { const d = f(x, y, z); if (d > 2) return d; const fx = ((x % w) + w) % w; return d + (Math.min(fx, w - fx) < 0.6 ? depth : 0) + 0.15 * noise3(x * 0.3 + seed, y * 1.2, z); } };
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
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i, 1, seed) * fr.w), y = Math.floor(hash(i, 2, seed) * fr.h);
    if (region && !region(x, y)) continue;
    const c = under(fr, x, y); if (c < 0 || c === IDX.outline) continue;
    const nm = Object.keys(IDX).find((k) => IDX[k] === c);
    if (!nm || !/^stone|^flag|^slate/.test(nm)) continue;
    dot(fr, x, y, 'moss3'); if (hash(i, 3, seed) < 0.6 && under(fr, x + 1, y) >= 0) dot(fr, x + 1, y, 'moss2'); if (hash(i, 4, seed) < 0.4 && under(fr, x, y + 1) >= 0) dot(fr, x, y + 1, 'moss4');
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
  const ax = cx, ay = 20;
  S.add(folds(skirt(ax, ay + 2, ay + 13, 3.2, 6.2, -10, 0.9, 'stoneC'), { cx: ax, cz: -10, n: 7, amp: 0.4, y0: ay + 2, y1: ay + 13 }), 0);
  S.add(ellipsoid([ax, ay, -10], [3.4, 4.6, 3], 'stoneC'), 1.4);
  S.add(sphere([ax + 0.8, ay - 6.2, -9], 2.8, 'stoneC'), 1);
  S.add(capsule([ax + 2.4, ay - 1.5, -8], [ax + 1.6, ay - 4.6, -6.6], 1.1, 1, 'stoneC'), 0.8);
  for (const side of [-1, 1]) {
    S.add(ellipsoid([ax + side * 6.5, ay - 1, -12], [4.2, 9, 1.6], 'stoneB'), 1.2);
    S.add(capsule([ax + side * 4, ay - 8, -12], [ax + side * 10, ay - 12, -12.5], 2, 1, 'stoneB'), 1.6);
  }
  const fr = R(S, W, H, { ground: H - 1 });
  grime(fr, 30, 9); moss(fr, 41, 150, (x, y) => y > 40);
  for (let i = 0; i < 10; i++) streak(fr, 16 + Math.floor(hash(i, 4, 9) * 82), 58, 6 + Math.floor(hash(i, 6, 9) * 16), i);
  return fr;
}

export default {
  town2: {
    cathedral: () => [cathedral()],
    gate: () => [cityGate()],
    ruin: () => [ruin()],
    mausoleum: () => [mausoleum()],
    tall: () => [0, 1, 2, 3, 4, 5].map(tallHouse),
  },
};
