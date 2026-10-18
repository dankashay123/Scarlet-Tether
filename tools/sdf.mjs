// Sculpted pixel art. Characters and props are modelled as signed-distance
// shapes that melt into each other (smooth union), lit as one 3D form, then
// banded onto the palette ramps with hand-drawn conventions: coloured
// outlines, soft inner contours where a limb passes in front of the body,
// and a cleanup pass that removes stray pixels.
//
// Axes: x right, y down, z toward the viewer. Units are frame pixels.
import { IDX, FINE } from './palette.mjs';

const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ------------------------------------------------------------- shapes ---
export function sphere(c, r, mat, o = {}) {
  return { ...o, mat, bb: [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r], f: (x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r };
}
export function ellipsoid(c, r, mat, o = {}) {
  const [rx, ry, rz] = r, m = Math.min(rx, ry, rz);
  return { ...o, mat, bb: [c[0] - rx, c[1] - ry, c[2] - rz, c[0] + rx, c[1] + ry, c[2] + rz], f: (x, y, z) => (len3((x - c[0]) / rx, (y - c[1]) / ry, (z - c[2]) / rz) - 1) * m };
}
// A capsule whose radius tapers from ra (at a) to rb (at b).
export function capsule(a, b, ra, rb, mat, o = {}) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], L2 = bx * bx + by * by + bz * bz || 1, R = Math.max(ra, rb);
  return { ...o, mat, bb: [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.min(a[2], b[2]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, Math.max(a[2], b[2]) + R],
    f: (x, y, z) => { const px = x - a[0], py = y - a[1], pz = z - a[2]; const t = clamp((px * bx + py * by + pz * bz) / L2, 0, 1); return len3(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t); } };
}
export function box(c, h, round, mat, o = {}) {
  return { ...o, mat, bb: [c[0] - h[0] - round, c[1] - h[1] - round, c[2] - h[2] - round, c[0] + h[0] + round, c[1] + h[1] + round, c[2] + h[2] + round],
    f: (x, y, z) => { const qx = Math.abs(x - c[0]) - h[0], qy = Math.abs(y - c[1]) - h[1], qz = Math.abs(z - c[2]) - h[2]; return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round; } };
}
// A cone-like skirt: radius at top ra, bottom rb, between y0 and y1, flattened in z by zs.
export function skirt(cx, y0, y1, ra, rb, cz, zs, mat, o = {}) {
  const R = Math.max(ra, rb);
  return { ...o, mat, bb: [cx - R, y0 - 1, cz - R * zs, cx + R, y1 + 1, cz + R * zs],
    f: (x, y, z) => { const t = clamp((y - y0) / (y1 - y0), 0, 1); const r = ra + (rb - ra) * t; const d = Math.hypot(x - cx, (z - cz) / zs) - r; const dy = Math.max(y0 - y, y - y1, 0); return Math.max(d, -Math.min(y - y0, y1 - y)) * 0.8 + dy * 0.2; } };
}
// Rotate a shape about the z axis around a pivot (for tilted limbs and blades).
export function rotZ(prim, pivot, ang) {
  const c = Math.cos(-ang), s = Math.sin(-ang), f = prim.f;
  const r = Math.max(prim.bb[3] - prim.bb[0], prim.bb[4] - prim.bb[1]);
  return { ...prim, bb: [pivot[0] - r * 1.5, pivot[1] - r * 1.5, prim.bb[2], pivot[0] + r * 1.5, pivot[1] + r * 1.5, prim.bb[5]], f: (x, y, z) => { const dx = x - pivot[0], dy = y - pivot[1]; return f(pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c, z); } };
}

// Cloth folds: ripples around a vertical axis that deepen toward the hem.
export function folds(prim, { cx, cz = 0, n = 7, amp = 0.45, y0, y1, phase = 0 }) {
  const f = prim.f;
  return { ...prim, bb: prim.bb.map((v, i) => v + (i < 3 ? -amp : amp)), f: (x, y, z) => { const t = clamp((y - y0) / (y1 - y0), 0, 1); return f(x, y, z) + amp * (0.35 + 0.65 * t) * Math.sin(n * Math.atan2(z - cz, x - cx) + phase + y * 0.08); } };
}
// Lumpy organic surfaces (rotten flesh, rock, bark).
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w) * 2 - 1;
}
export function bumpy(prim, amp = 0.5, freq = 0.5, seed = 0) {
  const f = prim.f;
  return { ...prim, bb: prim.bb.map((v, i) => v + (i < 3 ? -amp : amp)), f: (x, y, z) => f(x, y, z) + amp * noise3(x * freq + seed, y * freq, z * freq) };
}
// Clip a shape by a half-space: keep where fn(x,y,z) <= 0.
export function clip(prim, fn) { const f = prim.f; return { ...prim, f: (x, y, z) => Math.max(f(x, y, z), fn(x, y, z)) }; }

// --------------------------------------------------------- pixel touch-ups ---
// Hand-placed pixels drawn after rendering (eyes, strings, glints).
export function dot(fr, x, y, name) {
  if (POSE && fr.posed) [x, y] = poseXY(x, y);
  x = Math.round(x); y = Math.round(y);
  // On the chunky grid a hand-placed pixel fills its whole block.
  if (RES > 1) { const bx = Math.floor(x / RES) * RES, by = Math.floor(y / RES) * RES; for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const xx = bx + i, yy = by + j; if (xx >= 0 && yy >= 0 && xx < fr.w && yy < fr.h) fr.px[yy * fr.w + xx] = IDX[name]; } return; }
  if (x >= 0 && y >= 0 && x < fr.w && y < fr.h) fr.px[y * fr.w + x] = IDX[name];
}
export function pline(fr, x0, y0, x1, y1, name) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) dot(fr, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, name); }
export function under(fr, x, y) { if (POSE && fr.posed) [x, y] = poseXY(x, y); x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < fr.w && y < fr.h ? fr.px[y * fr.w + x] : -1; }

// ------------------------------------------------------------- scenes ---
// Each shape joins the scene with:
//   k     smooth-union radius (0 = hard union)
//   op    'sub' carves it out (smoothly with k)
//   paint true: recolours the surface where it lies, without adding shape
export class Scene {
  constructor() { this.prims = []; this.paints = []; }
  add(p, k = 0, op = 'add') { p.k = k; p.op = op; this.prims.push(p); return this; }
  sub(p, k = 0) { return this.add(p, k, 'sub'); }
  paint(p) { this.paints.push(p); return this; }
}
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }
function smax(a, b, k) { return -smin(-a, -b, k); }

function evalScene(prims, x, y, z) {
  let d = 1e9, mat = null;
  for (const p of prims) {
    const dp = p.f(x, y, z);
    if (p.op === 'sub') { d = smax(d, -dp, p.k); if (-dp > d - 0.01 && p.mat) mat = p.mat; continue; }
    if (dp < d) mat = p.mat;
    d = smin(d, dp, p.k);
  }
  return [d, mat];
}

// --------------------------------------------------------------- render ---
// MATS maps a material name to { ramp, min, max (in 9 fine steps), spec, glow, flat }.
export const LIGHT = (() => { const v = [-0.55, -0.75, 0.62]; const d = len3(...v); return v.map((c) => c / d); })();
// 3/4 view: tilt a shape back about the x axis around the ground line, so its
// top faces turn toward the viewer (Otherworld Legends props show their tops).
export function tiltX(prim, py, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), f = prim.f;
  if (!prim.bb) return { ...prim, f: (x, y, z) => f(x, py + (y - py) * c - z * s, (y - py) * s + z * c) };
  const [x0, y0, z0, x1, y1, z1] = prim.bb;
  let lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const y of [y0, y1]) for (const z of [z0, z1]) { const yc = py + (y - py) * c + z * s, zc = -(y - py) * s + z * c; lo = [Math.min(lo[0], yc), Math.min(lo[1], zc)]; hi = [Math.max(hi[0], yc), Math.max(hi[1], zc)]; }
  return { ...prim, bb: [x0, lo[0], lo[1], x1, hi[0], hi[1]], f: (x, y, z) => f(x, py + (y - py) * c - z * s, (y - py) * s + z * c) };
}
// Pixel size of the art. At 2 every model renders on a 2x2 grid (chunky
// pixels, the Otherworld Legends look) and the frame keeps its size.
let RES = 1;
export function setRes(k) { RES = k; }
export const getRes = () => RES;
// Whole-figure pose for hit reactions and deaths. While set, render()
// rotates the finished model by `rot` about `pivot` (its feet; negative tips
// it backwards), moves it by dx, dy and grows the frame by `pad` on every
// side. dot() and under() follow the same mapping, so hand-placed eyes stay
// put. pad, dx and dy must be even to keep the 2x2 grid.
let POSE = null;
export function setPose(p) { POSE = p; }
function poseXY(x, y) {
  const { rot = 0, pivot: [px, py], dx = 0, dy = 0, pad = 0 } = POSE, c = Math.cos(rot), s = Math.sin(rot);
  const u = x - px, v = y - py;
  return [px + u * c - v * s + dx + pad, py + u * s + v * c + dy + pad];
}
function poseScene(scene) {
  const { rot = 0, pivot: [px, py], dx = 0, dy = 0, pad = 0 } = POSE, c = Math.cos(rot), s = Math.sin(rot);
  const ox = px + dx + pad, oy = py + dy + pad;
  const t = (p) => {
    const f = p.f, out = { ...p, f: (x, y, z) => { const u = x - ox, v = y - oy; return f(px + u * c + v * s, py - u * s + v * c, z); } };
    if (p.bb) {
      const [x0, y0, z0, x1, y1, z1] = p.bb, xs = [], ys = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) { const [a, b] = poseXY(x, y); xs.push(a); ys.push(b); }
      out.bb = [Math.min(...xs), Math.min(...ys), z0, Math.max(...xs), Math.max(...ys), z1];
    }
    return out;
  };
  const S2 = new Scene(); S2.prims = scene.prims.map((p) => ({ ...t(p), k: p.k, op: p.op })); S2.paints = scene.paints.map(t);
  return S2;
}
export function render(scene, w, h, MATS, opts = {}) {
  if (POSE) {
    const pad = POSE.pad || 0;
    scene = poseScene(scene); w += pad * 2; h += pad * 2;
    if (opts.ground) opts = { ...opts, ground: opts.ground + pad + (POSE.dy || 0) };
    const f = renderAt(scene, w, h, MATS, opts); f.posed = true; return f;
  }
  return renderAt(scene, w, h, MATS, opts);
}
function renderAt(scene, w, h, MATS, opts) {
  if (RES > 1 && !opts.fine) {
    const k = RES, w2 = Math.ceil(w / k), h2 = Math.ceil(h / k);
    const r = renderGrid(scene, w2, h2, MATS, opts, k), px = new Int16Array(w * h), dep = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const j = Math.floor(y / k) * w2 + Math.floor(x / k); px[y * w + x] = r.px[j]; dep[y * w + x] = r.depth[j]; }
    return { w, h, px, depth: dep };
  }
  return renderGrid(scene, w, h, MATS, opts, 1);
}
function renderGrid(scene, w, h, MATS, opts, k) {
  if (opts.tilt) {
    const lift = opts.tiltLift || 0, t0 = (p) => tiltX(p, opts.tiltY ?? h, opts.tilt);
    // tiltLift raises the image so a deep base's front edge stays on the frame floor.
    const t = (p) => { const q = t0(p), f = q.f; return { ...q, bb: q.bb && [q.bb[0], q.bb[1] - lift, q.bb[2], q.bb[3], q.bb[4] - lift, q.bb[5]], f: (x, y, z) => f(x, y + lift, z) }; };
    const S2 = new Scene(); S2.prims = scene.prims.map((p) => ({ ...t(p), k: p.k, op: p.op })); S2.paints = scene.paints.map(t); scene = S2;
  }
  const zmax = opts.zmax ?? 60, zmin = opts.zmin ?? -60;
  const px = new Int16Array(w * h).fill(-1), dep = new Float32Array(w * h).fill(-1e9), mid = new Int16Array(w * h).fill(-1), step = new Int8Array(w * h).fill(-1);
  const matNames = [];
  const matIndex = (m) => { let i = matNames.indexOf(m); if (i < 0) { matNames.push(m); i = matNames.length - 1; } return i; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = (x + 0.5) * k, sy = (y + 0.5) * k;
    const prims = scene.prims.filter((p) => sx >= p.bb[0] - p.k - 1 && sx <= p.bb[3] + p.k + 1 && sy >= p.bb[1] - p.k - 1 && sy <= p.bb[4] + p.k + 1);
    if (!prims.some((p) => p.op !== 'sub')) continue;
    let z = Math.min(zmax, Math.max(...prims.map((p) => p.bb[5] + p.k + 1))), hit = false, d, mat;
    for (let i = 0; i < 90 && z > zmin; i++) {
      [d, mat] = evalScene(prims, sx, sy, z);
      if (d < 0.04) { hit = true; break; }
      z -= Math.max(d * 0.85, 0.06);
    }
    if (!hit) continue;
    // Normal from the gradient.
    const e = 0.35 * k;
    const nx = evalScene(prims, sx + e, sy, z)[0] - evalScene(prims, sx - e, sy, z)[0];
    const ny = evalScene(prims, sx, sy + e, z)[0] - evalScene(prims, sx, sy - e, z)[0];
    const nz = evalScene(prims, sx, sy, z + e)[0] - evalScene(prims, sx, sy, z - e)[0];
    const nl = len3(nx, ny, nz) || 1, n = [nx / nl, ny / nl, nz / nl];
    // Paint overrides (trims, stripes, emblems, eyes).
    for (const pt of scene.paints) if (pt.f(sx, sy, z) < 0) mat = pt.mat;
    const M = MATS[mat] || MATS.default;
    let v;
    if (M.glow !== undefined) v = null;
    else {
      const ndl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
      const diff = clamp((ndl + 0.3) / 1.3, 0, 1);
      const aoD = evalScene(prims, sx + n[0] * 3, sy + n[1] * 3, z + n[2] * 3)[0];
      const ao = clamp(aoD / 3, 0, 1);
      const rim = Math.pow(clamp(1 - n[2], 0, 1), 3) * clamp(n[0] * 0.8 - n[1] * 0.2, 0, 1) * 0.35;
      const rz = 2 * ndl * n[2] - LIGHT[2];
      const spec = (M.spec || 0) * Math.pow(clamp(rz, 0, 1), 18);
      const groundAO = opts.ground ? clamp((sy - (opts.ground - 6)) / 6, 0, 1) * 0.12 : 0;
      v = 0.04 + 0.98 * diff * (0.55 + 0.45 * ao) + rim - groundAO;
      v = clamp(0.5 + (v - 0.5) * (opts.contrast ?? 1.3) + spec + (M.bias || 0), 0, 1);
    }
    const i = y * w + x;
    let s = M.glow !== undefined ? M.glow : Math.round((1 - v) * 8);
    s = clamp(s, M.min ?? 0, M.max ?? 8);
    step[i] = s; dep[i] = z; mid[i] = matIndex(mat);
  }
  // Cleanup: a lone pixel whose neighbours on both sides agree takes their shade.
  for (let pass = 0; pass < 2; pass++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (step[i] < 0) continue;
    const L = i - 1, R = i + 1, U = i - w, D = i + w;
    if (mid[L] === mid[i] && mid[R] === mid[i] && step[L] === step[R] && step[L] >= 0 && step[L] !== step[i] && Math.abs(step[L] - step[i]) === 1 && (step[U] !== step[i] || step[D] !== step[i])) step[i] = step[L];
    else if (mid[U] === mid[i] && mid[D] === mid[i] && step[U] === step[D] && step[U] >= 0 && step[U] !== step[i] && Math.abs(step[U] - step[i]) === 1 && (step[L] !== step[i] || step[R] !== step[i])) step[i] = step[U];
  }
  // Soft inner contours where a nearer form overlaps a farther one.
  const contour = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (step[i] < 0) continue;
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j < 0 || j >= w * h || step[j] < 0) continue;
      if (dep[j] - dep[i] > (opts.contourDepth ?? 5)) { contour[i] = 1; break; }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (step[i] < 0) continue;
    const M = MATS[matNames[mid[i]]] || MATS.default;
    let s = step[i];
    if (contour[i] && M.glow === undefined) s = Math.min(8, s + 3);
    px[i] = IDX[FINE[M.ramp][s]];
  }
  // Outline: dark ink, softened to the ramp's darkest tone on the lit top-left.
  const out = new Int16Array(px);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (px[i] >= 0) continue;
    let nb = -1, lit = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = yy * w + xx; if (px[j] >= 0) { nb = j; if (dx === 1 || dy === 1) lit = true; }
    }
    if (nb < 0) continue;
    const M = MATS[matNames[mid[nb]]] || MATS.default;
    out[i] = opts.noOutline ? -1 : lit && step[nb] <= 3 && M.glow === undefined && !opts.inkOnly ? IDX[FINE[M.ramp][8]] : IDX.outline;
  }
  return { w, h, px: out, depth: dep };
}
