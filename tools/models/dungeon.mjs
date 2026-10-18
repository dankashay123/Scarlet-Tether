// The Undercroft: floors, walls, wall decor and props, sculpted and lit.
// Floors and walls are height fields (relief lit per pixel); props are SDF
// models (tools/sdf.mjs). Everything is sized for the v5 360 px view.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, render, folds, bumpy, clip, noise3, dot, pline, LIGHT } from '../sdf.mjs';
import { MATS, torus } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const fbm = (x, y, s = 0) => noise3(x, y, s) * 0.7 + noise3(x * 2.1, y * 2.1, s + 7) * 0.3;
const frame = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const put = (f, x, y, name) => { if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.px[y * f.w + x] = IDX[name]; };
const shade = (ramp, s) => FINE[ramp][clamp(Math.round(s), 0, 8)];

// ------------------------------------------------------- height fields ---
// field(x, y) -> { h, ramp, tone, min, max } or null (transparent).
// Light comes from the same top-left as the SDF models; tone shifts the band.
function relief(w, h, field, { k = 1.4, contrast = 1.25 } = {}) {
  const f = frame(w, h);
  const H = (x, y) => { const c = field(x, y); return c && c.h !== undefined ? c.h : 0; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = field(x + 0.5, y + 0.5); if (!c) continue;
    if (c.name) { f.px[y * w + x] = IDX[c.name]; continue; }
    const dx = (H(x + 1, y + 0.5) - H(x, y + 0.5)) * k, dy = (H(x + 0.5, y + 1) - H(x + 0.5, y)) * k;
    const nl = Math.hypot(dx, dy, 1), n = [-dx / nl, -dy / nl, 1 / nl];
    const ndl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    let v = clamp((ndl + 0.2) / 1.2, 0, 1);
    v = 0.5 + (v - 0.5) * contrast + (c.tone || 0);
    const s = clamp(Math.round((1 - v) * 8), c.min ?? 0, c.max ?? 8);
    f.px[y * w + x] = IDX[shade(c.ramp, s)];
  }
  return f;
}

// Flagstone, 32x16, laid in running bond. The gap sits on the right and bottom.
function slab(v) {
  const ramp = v === 6 ? 'pot' : 'flag', tone = (hash(v, 1) - 0.5) * 0.12 - 0.07;
  // Chipped corners and a crack in some variants.
  const chips = [[0, 0], [31, 0], [0, 15], [31, 15]].filter((_, i) => hash(v, i, 4) < 0.45);
  const crack = v === 3 ? [[7, 4], [10, 5], [13, 5], [16, 7], [19, 8]] : null;
  const segD = (x, y) => { if (!crack) return 9; let d = 9; for (let i = 0; i + 1 < crack.length; i++) { const [ax, ay] = crack[i], [bx, by] = crack[i + 1]; const t = clamp(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1); d = Math.min(d, Math.hypot(x - ax - (bx - ax) * t, y - ay - (by - ay) * t)); } return d; };
  return relief(32, 16, (x, y) => {
    if (x > 31 || y > 15) return { name: shade(ramp, 8) };
    // Distance in from the slab's edge (the slab spans 0..31 x 0..15).
    let d = Math.min(x, y, 31 - x, 15 - y);
    for (const [cx, cy] of chips) d = Math.min(d, Math.hypot(x - cx, y - cy) - 2.6 - hash(v, cx, cy) * 1.2);
    if (d < 0) return { name: shade(ramp, 7) };
    let hh = 2.2 * sstep(0, 1.8, d) + fbm(x * 0.18 + v * 5, y * 0.25) * 0.5;
    const cd = segD(x, y);
    if (cd < 0.45) return { name: shade(ramp, 6) };
    hh -= Math.max(0, 1 - cd) * 0.5;
    // Gentle worn dip in the middle of busy slabs.
    hh -= v === 2 ? 0.4 * Math.exp(-((x - 16) ** 2 + (y - 8) ** 2) / 40) : 0;
    const t = tone + fbm(x * 0.09 + v, y * 0.12 + 3) * 0.1;
    return { h: hh, ramp, tone: t, min: 1, max: 6 };
  }, { k: 1.3 });
}
// Iron studs on the seventh variant, blood on none: keep the floor calm.
function slabSet() { const s = [0, 1, 2, 3, 4, 5, 6, 7].map(slab); for (const [x, y] of [[4, 4], [26, 4], [4, 11], [26, 11]]) { put(s[7], x, y, 'iron1'); put(s[7], x + 1, y, 'iron2'); put(s[7], x, y + 1, 'iron3'); put(s[7], x + 1, y + 1, 'iron4'); } return s; }

// The back wall: a 16x64 column cut into cap / upper / mid / lower tiles.
// Teal ashlar in courses of 8 px, a brick moulding at the foot.
function wallColumn() {
  return relief(16, 64, (x, y) => {
    if (y < 16) { // the wall's top seen from above, with a brick lip at the front
      if (y >= 11) { const t = Math.floor(y - 11); return { h: 4 - t * 0.5 + fbm(x * 0.3, y) * 0.2, ramp: 'brick', tone: t === 0 ? 0.25 : t < 3 ? 0 : -0.2, min: 1, max: 7 }; }
      return { h: fbm(x * 0.2, y * 0.2) * 0.4, ramp: 'teal', tone: -0.28, min: 5, max: 8 };
    }
    const fy = y - 16;
    if (fy >= 40) { // moulding ledge then the floor shadow
      if (fy >= 46) return { name: fy >= 47 ? 'ink2' : 'ink3' };
      const t = Math.floor(fy - 40); return { h: [3, 2.6, 2, 1.4, 0.8, 0.2][t] + fbm(x * 0.4, fy) * 0.15, ramp: 'brick', tone: [0.32, 0.12, 0, -0.08, -0.18, -0.32][t] + ((x & 3) === 0 && t > 1 && t < 5 ? -0.12 : 0), min: 1, max: 8 };
    }
    const course = Math.floor(fy / 8), off = course % 2 ? 8 : 0, bx = ((x + off) % 16 + 16) % 16, by = fy % 8;
    if (by >= 7 || bx >= 15) return { name: 'teal4' };
    const d = Math.min(bx, by, 14 - bx, 6 - by);
    const id = Math.floor((x + off) / 16) * 7 + course;
    const hh = 1.6 * sstep(0, 1.4, d) + fbm(x * 0.35 + id, fy * 0.35) * 0.45 - (hash(id, 3) < 0.18 && bx > 9 && by < 3 ? 0.9 : 0);
    return { h: hh, ramp: 'teal', tone: (hash(id, 1) - 0.5) * 0.12 - fy * 0.004, min: 1, max: 7 };
  }, { k: 1.2 });
}
function wallTiles() {
  const col = wallColumn(), cut = (y0) => { const f = frame(16, 16); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) f.px[y * 16 + x] = col.px[(y0 + y) * 16 + x]; return f; };
  const top = relief(16, 16, (x, y) => ({ h: fbm(x * 0.25, y * 0.25, 9) * 0.6, ramp: 'ink', tone: -0.1, min: 4, max: 6 }));
  // [top, cap, upper, lower, mid] (index 4 was added for the taller v5 wall)
  return [top, cut(0), cut(16), cut(48), cut(32)];
}

// ------------------------------------------------------------ wall decor ---
// 32x48 pieces that hang on the three-tile wall face.
function stainedGlass() {
  const S = new Scene();
  // Stone surround: a pointed arch with a sill.
  const arch = (x, y, z) => { const qx = Math.abs(x - 16); const body = Math.max(qx - 9, y - 40, 14 - y); const top = Math.max(Math.hypot(qx + 5, y - 15) - 14, y - 15); return Math.max(Math.min(body, top), -z - 1); };
  S.add({ mat: 'stone', bb: [4, 0, -2, 28, 42, 3], f: (x, y, z) => Math.max(arch(x, y, z), z - 2) }, 0);
  S.add(box([16, 41, 1], [11, 1.2, 2.2], 0.5, 'stone'), 0);
  const fr = render(S, 32, 48, MATS, { inkOnly: true });
  // Glass panes, lit from behind: a radiant halo over a weeping figure.
  const inside = (x, y) => { const qx = Math.abs(x - 16); return (qx < 6.5 && y > 14 && y < 38.5) || (y <= 15 && Math.hypot(qx + 5, y - 15) < 11.5); };
  for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) {
    const px = x + 0.5, py = y + 0.5; if (!inside(px, py)) continue;
    const lead = (Math.abs(px - 16) < 0.6 && py > 18) || (Math.abs(py - 26) < 0.6) || (Math.abs(py - 18) < 0.6 && Math.abs(px - 16) < 6.5) || Math.abs(Math.hypot(px - 16, py - 12) - 4) < 0.55;
    if (lead) { put(fr, x, y, 'ink2'); continue; }
    const halo = Math.hypot(px - 16, py - 12) < 4;
    const ramp = halo ? 'gold' : py < 18 ? 'violet' : py < 26 ? (px < 16 ? 'crimson' : 'holy') : (px < 16 ? 'holy' : 'crimson');
    const s = halo ? 1 + (py > 12 ? 1 : 0) : 2 + Math.round((py / 40) * 3 + (hash(x >> 1, y >> 1) - 0.5) * 1.2);
    put(fr, x, y, shade(ramp, s));
  }
  for (const [x, y] of [[13, 20], [18, 29], [12, 32]]) put(fr, x, y, 'white');
  return fr;
}
function banner() {
  const S = new Scene();
  S.add(capsule([3, 4, 1], [29, 4, 1], 1.1, 1.1, 'gold'), 0);
  S.add(sphere([3, 4, 1], 1.6, 'gold'), 0); S.add(sphere([29, 4, 1], 1.6, 'gold'), 0);
  // Cloth with deep vertical folds and a swallow-tail cut.
  const cloth = { mat: 'crimson', bb: [6, 4, -1, 26, 46, 3], f: (x, y, z) => {
    const qx = Math.abs(x - 16), notch = y - (38 + qx * 0.9);
    const wave = Math.sin((x - 6) * 0.75) * 0.9;
    return Math.max(qx - 9.5, 5 - y, -notch - 0 > 0 ? -notch : notch, Math.abs(z - wave) - 0.9) * 0.8;
  } };
  S.add({ ...cloth, f: (x, y, z) => { const qx = Math.abs(x - 16); const tail = y - (44 - qx * 0.7); const wave = Math.sin((x - 6) * 0.75) * 0.9; return Math.max(qx - 9.5, 5 - y, Math.max(tail, y - 46), Math.abs(z - wave) - 0.9) * 0.8; } }, 0);
  S.paint({ f: (x, y) => Math.min(Math.abs(Math.abs(x - 16) - 8.2) - 0.75, Math.abs(y - 7) - 0.9), mat: 'gold' });
  // The sigil: a halo over an eye that weeps.
  S.paint({ f: (x, y) => Math.abs(Math.hypot((x - 16) / 1.6, y - 15) - 2.6) - 0.55, mat: 'gold' });
  S.paint({ f: (x, y) => Math.hypot((x - 16) / 1.3, y - 23) - 2.4, mat: 'gold' });
  S.paint({ f: (x, y) => Math.max(Math.abs(x - 16) - 0.6, Math.abs(y - 30) - 4), mat: 'gold' });
  const fr = render(S, 32, 48, MATS, {});
  dot(fr, 16, 23, 'ink1'); dot(fr, 15, 23, 'ink2');
  return fr;
}
function sconce() {
  const S = new Scene();
  S.add(box([16, 30, -0.5], [3, 5, 0.8], 0.6, 'iron'), 0);
  S.add(capsule([16, 30, 0.5], [16, 22, 3.5], 1, 0.9, 'iron'), 0.6);
  S.add(skirt(16, 18, 22.5, 4.2, 2.4, 3.5, 1, 'iron'), 0.6);
  S.add(torus([16, 18.2, 3.5], 4.1, 0.6, 1.2, 'gold'), 0);
  return render(S, 32, 48, MATS, {});
}
function alcove() {
  const S = new Scene();
  const niche = (x, y, z) => { const qx = Math.abs(x - 16); const a = Math.min(Math.max(qx - 7, y - 40, 18 - y), Math.max(Math.hypot(qx, y - 18) - 7, y - 18)); return a; };
  S.add({ mat: 'stone', bb: [5, 8, -3, 27, 44, 2], f: (x, y, z) => Math.max(Math.min(Math.max(Math.abs(x - 16) - 10, y - 43, 9 - y), Math.max(Math.hypot(Math.abs(x - 16), y - 18) - 10, y - 18)), z - 1, -z - 3) }, 0);
  S.sub({ mat: 'ink', bb: [8, 10, -4, 24, 42, 3], f: (x, y, z) => Math.max(niche(x, y, z), -z - 1.5) }, 0);
  // A skull and a stub of candle on the shelf.
  S.add(bumpy(sphere([13, 37, -0.6], 2.7, 'bone'), 0.2, 0.9), 0.4);
  S.add(capsule([19.5, 39.5, -0.5], [19.5, 34, -0.5], 1.2, 1.1, 'cloth'), 0);
  const fr = render(S, 32, 48, { ...MATS, ink: { ramp: 'ink', bias: -0.3, min: 5 } }, { inkOnly: true });
  dot(fr, 12, 37, 'ink0'); dot(fr, 14, 37, 'ink0'); dot(fr, 13, 39, 'ink1');
  for (const [y, c] of [[31, 'ember0'], [32, 'ember1'], [33, 'ember2']]) dot(fr, 19, y, c);
  return fr;
}
function skullWall() {
  const S = new Scene();
  S.add(box([8, 24, -2], [8, 24, 1], 0, 'ink'), 0);
  for (let y = 4; y < 46; y += 7) for (let x = (y % 14 === 4 ? 3 : 7); x < 18; x += 8) S.add(bumpy(ellipsoid([x, y, 0], [3.4, 3, 2.4], 'bone'), 0.25, 0.8, x + y), 0.6);
  const fr = render(S, 16, 48, { ...MATS, ink: { ramp: 'ink', min: 6 } }, { noOutline: true });
  for (let y = 4; y < 46; y += 7) for (let x = (y % 14 === 4 ? 3 : 7); x < 18; x += 8) { dot(fr, x - 1.2, y, 'ink0'); dot(fr, x + 1.2, y, 'ink0'); dot(fr, x, y + 1.7, 'ink1'); }
  return fr;
}

// ---------------------------------------------------------------- props ---
const FLAME = { flameCore: { ramp: 'ember', glow: 0 }, flameMid: { ramp: 'ember', glow: 2 }, flameOut: { ramp: 'ember', glow: 4 }, flameEdge: { ramp: 'ember', glow: 6 } };
export const MM = { ...MATS, ...FLAME, statue: { ramp: 'pot', spec: 0.06 }, statueDark: { ramp: 'pot', bias: -0.1 }, plinth: { ramp: 'brick', spec: 0.04 }, wax: { ramp: 'cloth', min: 1, max: 6, spec: 0.2 }, darkIron: { ramp: 'iron', bias: -0.25, spec: 0.5 } };
// A tongue of fire rising from (x, y): layered glow shells, swaying.
// Flames are painted by hand after rendering: a teardrop in four bands.
export function flame(S, x, y, z, size, sway, tall) { (S.flames ||= []).push([x, y, size, sway, tall]); }
function flame2D(fr, x, y, size, sway, tall) {
  const H = size * 2.6 + tall;
  for (let py = Math.floor(y - H - 1); py <= Math.ceil(y + size); py++) for (let px = Math.floor(x - size - 2); px <= Math.ceil(x + size + 2); px++) {
    const cy = py + 0.5, t = clamp((y - cy) / H, 0, 1), cx = x + sway * t * t;
    const r = cy > y ? Math.sqrt(Math.max(0, size * size - (cy - y) ** 2)) : size * Math.pow(1 - t, 0.85) * (1 + 0.15 * Math.sin(t * 3));
    const q = Math.abs(px + 0.5 - cx) / Math.max(r, 0.01);
    if (q > 1 || r < 0.35) continue;
    const k = q * 0.7 + t * 0.55;
    put(fr, px, py, k < 0.3 ? 'ember0' : k < 0.5 ? 'gold0' : k < 0.72 ? 'ember1' : k < 0.9 ? 'ember2' : 'ember3');
  }
}
export const R = (S, w, h, M, o) => { const fr = render(S, w, h, M, o); for (const fl of S.flames || []) flame2D(fr, ...fl); return fr; };

function torchStand(i) {
  const S = new Scene(), cx = 12, sway = [0, 1, 0.3, -1][i], tall = [0, 2, 1, 3][i];
  for (const [dx, dz] of [[-6, 1.5], [6, 1.5], [0, -3]]) S.add(capsule([cx, 60, 0], [cx + dx, 70, dz], 1.1, 0.9, 'darkIron'), 0.6);
  S.add(capsule([cx, 62, 0], [cx, 26, 0], 1.3, 1.1, 'darkIron'), 0.8);
  S.add(sphere([cx, 44, 0], 1.9, 'gold'), 0.5);
  S.add(skirt(cx, 20, 27, 6.4, 2.4, 0, 1, 'darkIron'), 0.8);
  S.add(torus([cx, 20.4, 0], 6.1, 0.8, 1.15, 'gold'), 0);
  S.add(bumpy(ellipsoid([cx, 20, 0], [5.2, 1.6, 4.6], 'ink'), 0.4, 1.2), 0);
  flame(S, cx, 19, 1.5, 4.2, sway, tall);
  return R(S, 24, 72, MM, { ground: 70 });
}

function pedestal(S, cx, top) {
  S.add(box([cx, top + 11, 0], [11, 9.5, 6], 0.8, 'plinth'), 0);
  S.add(box([cx, top + 1.4, 0.5], [12.5, 1.6, 7], 0.7, 'plinth'), 0.4);
  S.add(box([cx, top + 20.5, 0.5], [12.5, 1.4, 7], 0.6, 'plinth'), 0.3);
  S.sub(box([cx, top + 11, 6.4], [6.5, 5.5, 1], 0.6, 'plinth'), 0.4);
  S.paint({ f: (x, y, z) => Math.hypot(x - cx, y - (top + 11), z - 5.6) - 2.2, mat: 'gold' });
}
function statue(kind) {
  const S = new Scene(), cx = 20, top = 56; // the figure stands on the plinth top
  pedestal(S, cx, top);
  if (kind === 'saint') {
    // A hooded saint with a planted sword and a stone halo.
    S.add(folds(skirt(cx, 32, top, 4.5, 7.6, 0, 0.8, 'statue'), { cx, n: 7, amp: 0.55, y0: 33, y1: top }), 1.2);
    S.add(ellipsoid([cx, 30, 0], [6.2, 4.6, 4.2], 'statue'), 1.8);
    S.add(ellipsoid([cx, 21, 0.4], [5, 5.2, 4.6], 'statue'), 1.6);
    S.sub(ellipsoid([cx + 0.5, 22.5, 4.3], [2.6, 3.2, 2.4], 'statueDark'), 0.5);
    S.add(capsule([cx - 5, 30, 2], [cx - 1, 37, 4.5], 1.8, 1.6, 'statue'), 1);
    S.add(capsule([cx + 5, 30, 2], [cx + 1, 37, 4.5], 1.8, 1.6, 'statue'), 1);
    S.add(box([cx, 44, 6], [0.9, 10, 0.7], 0.3, 'darkIron'), 0);
    S.add(box([cx, 37.5, 6], [4, 0.8, 0.8], 0.3, 'gold'), 0);
    S.add(sphere([cx, 36, 6], 1.1, 'gold'), 0);
    S.add(torus([cx, 13.5, -1], 5.4, 0.85, 0.5, 'statue'), 0);
  } else if (kind === 'angel') {
    for (const side of [-1, 1]) {
      const w = rotZ(ellipsoid([cx + side * 9, 25, -3], [5.5, 13, 1.6], 'statue'), [cx + side * 3, 30], side * 0.42);
      S.add({ ...w, f: (x, y, z) => w.f(x, y, z) + 0.3 * Math.sin((y + Math.abs(x - cx) * 0.6) * 1.15) }, 1.4);
    }
    S.add(folds(skirt(cx, 32, top, 3.8, 6.8, 0, 0.8, 'statue'), { cx, n: 8, amp: 0.5, y0: 33, y1: top }), 1.2);
    S.add(ellipsoid([cx, 30, 0], [5, 4.4, 3.8], 'statue'), 1.6);
    S.add(sphere([cx, 21, 0.6], 4.2, 'statue'), 1.4);
    S.add(capsule([cx - 4, 29.5, 2], [cx, 34, 4], 1.5, 1.3, 'statue'), 1);
    S.add(capsule([cx + 4, 29.5, 2], [cx, 34, 4], 1.5, 1.3, 'statue'), 1);
    S.add(torus([cx, 15, 0], 4.2, 0.7, 0.5, 'gold'), 0);
  } else {
    // A knight at rest, hands folded on a planted sword.
    for (const side of [-1, 1]) {
      S.add(capsule([cx + side * 2.6, 42, side], [cx + side * 2.8, top - 1, side * 1.2], 2.4, 2.1, 'statue'), 1);
      S.add(ellipsoid([cx + side * 2.8 + 1, top - 1, side * 1.2 + 0.5], [2.6, 1.4, 2], 'statue'), 0.8);
    }
    S.add(folds(skirt(cx, 36, 50, 5, 6.4, 0, 0.75, 'statue'), { cx, n: 6, amp: 0.45, y0: 37, y1: 50 }), 1);
    S.add(ellipsoid([cx, 32, 0], [6.4, 7, 4.6], 'statue'), 1.4);
    for (const side of [-1, 1]) S.add(ellipsoid([cx + side * 6.4, 26.5, 0], [3.6, 2.6, 3.6], 'statue'), 1.2);
    S.add(capsule([cx - 6.5, 28, 1], [cx - 2, 36, 5], 1.9, 1.7, 'statue'), 1);
    S.add(capsule([cx + 6.5, 28, 1], [cx + 2, 36, 5], 1.9, 1.7, 'statue'), 1);
    S.add(ellipsoid([cx, 19.5, 0.5], [4.2, 5, 4.2], 'statue'), 1);
    S.add(box([cx, 14.5, 0], [0.7, 2.2, 3.4], 0.5, 'statue'), 0.6);
    S.add(box([cx, 20, 4.2], [3.2, 0.45, 0.6], 0.2, 'statueDark'), 0);
    S.add(box([cx, 46, 6.2], [1.1, 9.5, 0.7], 0.3, 'darkIron'), 0);
    S.add(box([cx, 36.2, 6.2], [4.4, 0.85, 0.9], 0.3, 'gold'), 0);
    S.add(sphere([cx, 34.6, 6.2], 1.2, 'gold'), 0);
    S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 1.6, Math.abs(y - 31) - 3.2, -z + 3), mat: 'crimson' });
  }
  const fr = R(S, 40, 80, MM, { ground: 79, tilt: 0.3, tiltY: 79, tiltLift: 2 });
  if (kind === 'saint') { dot(fr, cx + 0.3, 22.5, 'flame2'); dot(fr, cx + 2.2, 22.5, 'flame2'); }
  for (const [x, y] of [[9, 78], [10, 78], [30, 77], [31, 78], [10, 56], [29, 57]]) if (fr.px[y * 40 + x] >= 0) put(fr, x, y, 'moss2');
  return fr;
}

function skullCandle(i) {
  const S = new Scene();
  S.add(bumpy(ellipsoid([9, 18.5, 0], [5.6, 4.6, 4.6], 'bone'), 0.25, 0.7), 0);
  S.add(ellipsoid([10, 21.5, 1.5], [3.4, 1.8, 2.8], 'bone'), 0.8);
  S.add(capsule([8.5, 15, 0], [8.5, 8, 0], 2.3, 2, 'wax'), 0.6);
  S.add(ellipsoid([6.5, 13.4, 1.5], [1, 2.5, 1], 'wax'), 0.6);
  flame(S, 8.5, 7.5, 0, 1.6, i ? 0.6 : -0.3, i ? 1 : 0);
  const fr = R(S, 18, 25, MM, {});
  dot(fr, 8, 19, 'ink0'); dot(fr, 11, 19, 'ink0'); dot(fr, 12, 19, 'ink1'); dot(fr, 9, 21, 'ink1');
  return fr;
}
function crate() {
  const S = new Scene();
  S.add(box([17, 21, 0], [14, 10, 10], 0.8, 'wood'), 0);
  for (const x of [8.5, 17, 25.5]) S.sub(box([x, 21, 10.4], [0.35, 10.5, 1], 0, 'wood'), 0);
  for (const y of [12.5, 29.5]) S.add(box([17, y, 10.2], [14.2, 1.5, 0.8], 0.4, 'wood'), 0.2);
  for (const x of [4, 30]) for (const y of [12.5, 29.5]) S.add(box([x, y, 10.6], [2, 2, 0.8], 0.3, 'darkIron'), 0);
  const fr = R(S, 34, 34, MM, { ground: 33 });
  for (const x of [4, 30]) for (const y of [12, 29]) dot(fr, x, y, 'iron1');
  return fr;
}
function urn(v) {
  const S = new Scene(), cx = 10.5;
  S.add({ mat: 'pot', bb: [2, 4, -8, 19, 26, 8], f: (x, y, z) => { const t = (y - 4) / 21; const r = 2.8 + Math.sin(clamp(t, 0, 1) * Math.PI * 0.95) * 5.4 - (t > 0.9 ? 1 : 0); return Math.max(Math.hypot(x - cx, z) - r, 5 - y, y - 25.5) * 0.8; } }, 0);
  S.add(torus([cx, 5, 0], 3.1, 0.9, 1.3, 'pot'), 0.4);
  S.sub(ellipsoid([cx, 4.4, 0], [2.4, 1.2, 2.4], 'ink'), 0.2);
  S.paint({ f: (x, y) => Math.abs(y - 13) - 1.1, mat: v ? 'brick' : 'teal' });
  S.paint({ f: (x, y, z) => Math.abs(y - 17.5 - Math.sin(x * 1.5) * 0.6) - 0.5 + (z < 0 ? 9 : 0), mat: v ? 'brick' : 'teal' });
  return R(S, 21, 26, { ...MM, ink: { ramp: 'ink', bias: -0.4, min: 6 } }, { ground: 25, tilt: 0.4, tiltY: 25, tiltLift: 3 });
}

// Props sheet: columns, sarcophagi, candelabra and floor candles.
function column() {
  const S = new Scene(), cx = 14.5;
  S.add(box([cx, 70, 0], [11, 3.5, 7], 0.8, 'stone'), 0);
  S.add(box([cx, 65, 0], [9.5, 2, 6], 0.8, 'stone'), 0.4);
  S.add({ mat: 'stone', bb: [cx - 8, 10, -7, cx + 8, 64, 7], f: (x, y, z) => { const a = Math.atan2(z, x - cx); return Math.max(Math.hypot(x - cx, z) - 6.3 - Math.abs(Math.sin(a * 4)) * 0.6, 11 - y, y - 63.5) * 0.8; } }, 0.6);
  S.add(box([cx, 9, 0], [10, 2.5, 6.5], 0.8, 'stone'), 0.6);
  S.add(box([cx, 4, 0], [11.5, 2.6, 7.5], 0.6, 'stone'), 0.3);
  const fr = R(S, 29, 76, MM, { ground: 75, tilt: 0.3, tiltY: 75, tiltLift: 2.2 });
  for (const [x, y] of [[6, 72], [7, 73], [22, 70], [11, 8]]) if (fr.px[y * 29 + x] >= 0) put(fr, x, y, 'moss2');
  return fr;
}
function sarcophagus() {
  const S = new Scene();
  S.add(box([23.5, 25, 0], [19, 6.5, 8], 1.2, 'stone'), 0);
  S.add(box([23.5, 15, 0], [20.5, 2.6, 9.4], 1.2, 'stone'), 0.6);
  // The effigy carved on the lid.
  S.add(ellipsoid([10, 11.5, 0], [3.4, 2.8, 3], 'statue'), 1);
  S.add(folds(ellipsoid([25, 12, 0], [12.5, 2.6, 5], 'statue'), { cx: 25, n: 6, amp: 0.4, y0: 9, y1: 14 }), 1.2);
  S.add(capsule([18, 9.5, 2], [21, 8.5, 3.5], 1.3, 1.2, 'statue'), 0.8);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - 25) - 2.2, Math.abs(((x + 1.5) % 9) - 4.5) - 2.6, -z + 7.5), mat: 'statueDark' });
  return R(S, 47, 36, MM, { ground: 35 });
}
function candelabra(flick) {
  const S = new Scene(), cx = 12;
  for (const [dx, dz] of [[-5, 1.5], [5, 1.5], [0, -2.5]]) S.add(capsule([cx, 38, 0], [cx + dx, 43.5, dz], 0.9, 0.8, 'gold'), 0.6);
  S.add(capsule([cx, 40, 0], [cx, 16, 0], 1.1, 0.9, 'gold'), 0.6);
  S.add(sphere([cx, 30, 0], 1.6, 'gold'), 0.4);
  S.add(torus([cx, 17, 0], 6, 0.7, 1.45, 'gold'), 0.3);
  S.add(capsule([cx - 6, 17, 0], [cx - 6.5, 13, 0], 0.8, 0.8, 'gold'), 0.3); S.add(capsule([cx + 6, 17, 0], [cx + 6.5, 13, 0], 0.8, 0.8, 'gold'), 0.3);
  for (const [x, h] of [[cx - 6.5, 4], [cx, 6], [cx + 6.5, 4]]) { S.add(capsule([x, 13 - (x === cx ? 1 : 0), 0], [x, 13 - h, 0], 1.3, 1.2, 'wax'), 0); flame(S, x, 12.5 - h, 0.5, 1.4, flick * 0.6 + (x - cx) * 0.03, flick > 0 ? 1 : 0); }
  return R(S, 24, 44, MM, { ground: 43 });
}
function floorCandles(f) {
  const S = new Scene();
  for (const [x, z, h] of [[5, 1, 7], [11, -1, 10], [16.5, 1.5, 5]]) { S.add(capsule([x, 17, z], [x, 17 - h, z], 1.7, 1.5, 'wax'), 0.5); S.add(ellipsoid([x + 1, 16.5, z + 1], [2.6, 1, 2], 'wax'), 0.8); flame(S, x, 16.5 - h, z, 1.2, f ? 0.5 : -0.4, f); }
  return R(S, 21, 18, MM, {});
}
function bonepile() {
  const S = new Scene();
  S.add(bumpy(ellipsoid([12, 14, 0], [7, 2.6, 4], 'bone'), 0.4, 0.8), 0.4);
  S.add(rotZ(capsule([5, 14, 2], [17, 12, 2], 1, 1, 'bone'), [11, 13], 0.1), 0.3);
  S.add(sphere([5, 13.5, 2], 1.6, 'bone'), 0.3); S.add(sphere([17, 11.5, 2], 1.6, 'bone'), 0.3);
  S.add(rotZ(capsule([12, 16, 3], [25, 15, 2], 0.9, 0.9, 'bone'), [18, 15], -0.25), 0.3);
  S.add(bumpy(ellipsoid([21, 11, 1], [3.6, 3.2, 3.2], 'bone'), 0.2, 1), 0.4);
  const fr = R(S, 29, 18, MM, {});
  dot(fr, 21, 11, 'ink0'); dot(fr, 23, 11, 'ink0');
  return fr;
}


// ------------------------------------------------- loot-sheet furniture ---
function gate() { // one tile of iron portcullis, 16x40, spikes at the foot
  const S = new Scene();
  for (const x of [2, 6, 10, 14]) { S.add(capsule([x, 3, 0], [x, 35, 0], 1.05, 1.05, 'darkIron'), 0); S.add(capsule([x, 35, 0], [x, 38.5, 0], 1.05, 0.2, 'iron'), 0.3); }
  for (const y of [6, 18, 30]) S.add(box([8, y, 1.2], [8.5, 1, 0.8], 0.4, 'darkIron'), 0.4);
  S.add(box([8, 1.5, 0], [8.5, 1.5, 1.6], 0.4, 'gold'), 0);
  const fr = R(S, 16, 40, MM, { inkOnly: true });
  for (const y of [6, 18, 30]) for (const x of [2, 6, 10, 14]) dot(fr, x - 0.5, y - 0.5, 'iron0');
  return fr;
}
function chest(open) {
  const S = new Scene(), cx = 15.5;
  S.add(box([cx, 23, 0], [13, 6, 7], 0.8, 'wood'), 0);
  if (!open) {
    S.add({ mat: 'wood', bb: [1, 6, -8, 30, 18, 8], f: (x, y, z) => Math.max(Math.hypot(y - 17, z) - 7.5, Math.abs(x - cx) - 13.2) }, 0.4);
    S.add(box([cx, 17.4, 7.3], [2.4, 3, 0.8], 0.4, 'gold'), 0);
  } else {
    S.add(box([cx, 9, -6.5], [13.2, 6, 1.4], 0.6, 'wood'), 0);
    S.add(bumpy(ellipsoid([cx, 15.6, 0], [11.5, 2.8, 5.5], 'gold'), 0.6, 0.9), 0);
  }
  for (const x of [cx - 9, cx + 9]) S.add(box([x, 20, 0], [1.4, 9.2, 7.6], 0.4, 'gold'), 0.2);
  const fr = R(S, 31, 31, MM, { ground: 30 });
  if (!open) { dot(fr, cx, 18, 'ink1'); dot(fr, cx, 19, 'ink2'); }
  else for (const [x, y] of [[cx - 4, 15], [cx + 3, 16], [cx + 7, 15]]) dot(fr, x, y, 'white');
  return fr;
}
function shrine(kind) {
  const S = new Scene(), cx = 17, rmp = { fervor: 'crimson', haste: 'flame', warding: 'holy', plenty: 'gold' }[kind];
  S.add(box([cx, 47, 0], [12, 2, 7], 0.8, 'stone'), 0);
  S.add({ mat: 'stone', bb: [cx - 10, 26, -7, cx + 10, 46, 7], f: (x, y, z) => { const t = (y - 26) / 20; return Math.max(Math.hypot(x - cx, z) - (5 + t * 4) , 27 - y, y - 45.5) * 0.85; } }, 0.8);
  S.add(box([cx, 25.5, 0], [10, 2, 6.5], 0.8, 'stone'), 0.5);
  S.add(torus([cx, 14, 0], 9.6, 1.2, 0, 'gold'), 0);
  const orb = { ...MM, orb: { ramp: rmp === 'flame' ? 'flame' : rmp, spec: 0.9, bias: 0.15, min: 0 } };
  S.add(sphere([cx, 14, 0], 7.4, 'orb'), 0);
  for (const a of [0.5, 2.6]) S.add(capsule([cx + Math.cos(a) * 9.6, 14 + Math.sin(a) * 9.6, 0], [cx + Math.cos(a) * 7, 24, 0], 1, 1, 'gold'), 0.4);
  const fr = R(S, 34, 50, orb, { ground: 49 });
  dot(fr, cx - 3, 10, 'white'); dot(fr, cx - 2, 10, 'white'); dot(fr, cx - 3, 11, 'white');
  return fr;
}
function coffin(broken) {
  const S = new Scene(), cx = 11.5;
  const shape = (x, y, z) => { const t = (y - 2) / 33; const w = t < 0.27 ? 5 + t / 0.27 * 4.5 : 9.5 - (t - 0.27) / 0.73 * 4; return Math.max(Math.abs(x - cx) - w, Math.abs(z) - 3.4, 2 - y, y - 35) ; };
  S.add({ mat: 'wood', bb: [0, 1, -5, 23, 36, 5], f: (x, y, z) => shape(x, y, z) - 0.6 }, 0);
  if (!broken) { S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - cx) - 0.9, Math.abs(y - 15) - 7.5), Math.max(Math.abs(x - cx) - 4, Math.abs(y - 11.5) - 0.9)) + (z < 2 ? 9 : 0), mat: 'gold' }); }
  else S.sub(bumpy(ellipsoid([cx + 2, 17, 4], [5, 8, 3], 'ink'), 1.2, 0.7), 0.3);
  return R(S, 23, 37, { ...MM, ink: { ramp: 'ink', bias: -0.4, min: 6 } }, { ground: 36 });
}
function pew() {
  const S = new Scene();
  S.add(box([22, 10.5, 0], [19.5, 1.6, 4], 0.6, 'wood'), 0);
  S.add(box([22, 6, -3.6], [19.5, 4.5, 0.9], 0.5, 'wood'), 0.3);
  for (const x of [3, 41]) S.add(box([x, 11, 0], [1.4, 9, 4.6], 0.6, 'wood'), 0.3);
  for (const x of [3, 41]) S.add(sphere([x, 1.4, 0], 1.7, 'wood'), 0.4);
  return R(S, 44, 21, MM, { ground: 20 });
}
function altar() {
  const S = new Scene(), cx = 23.5;
  S.add(box([cx, 20, 0], [20, 8.5, 7], 1, 'stone'), 0);
  S.add(box([cx, 11, 0.5], [22, 2, 8], 0.8, 'stone'), 0.4);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 9, y - 21 + Math.abs(Math.sin(x * 0.7)) * 1.2, 9 - y) + (z < 6 ? 9 : 0), mat: 'crimson' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 9, Math.abs(y - 9.8) - 0.9) + (z < 6 ? 9 : 0), mat: 'gold' });
  for (const x of [cx - 15, cx + 15]) { S.add(capsule([x, 8.5, 0], [x, 2, 0], 1.6, 1.4, 'wax'), 0); flame(S, x, 1.6, 0, 1.2, 0.3, 0); }
  S.add(bumpy(ellipsoid([cx, 8.4, 0], [5.4, 1.1, 3.5], 'blood'), 0.3, 0.8), 0.3);
  return R(S, 47, 31, MM, { ground: 30 });
}
function maiden() {
  const S = new Scene(), cx = 13;
  S.add({ mat: 'darkIron', bb: [1, 1, -8, 25, 47, 8], f: (x, y, z) => { const t = (y - 10) / 36; const r = y < 10 ? 0 : 6.2 + Math.sin(clamp(t, 0, 1) * 2.4) * 2.6; return Math.max(Math.hypot(x - cx, z * 1.2) - r, 10 - y, y - 46) * 0.85; } }, 0);
  S.add(ellipsoid([cx, 8.5, 0], [5.8, 6.5, 5], 'darkIron'), 2);
  S.add(ellipsoid([cx + 0.5, 9, 3.4], [3.3, 4, 2], 'iron'), 0.8);
  S.paint({ f: (x, y, z) => Math.abs(x - cx - 0.3) - 0.45 + (y < 17 || z < 3 ? 9 : 0), mat: 'ink' });
  const fr = R(S, 26, 47, MM, { ground: 46 });
  dot(fr, cx - 0.8, 8.5, 'ink0'); dot(fr, cx + 1.8, 8.5, 'ink0'); dot(fr, cx + 0.5, 11, 'ink1');
  for (const [x, y] of [[cx + 1, 30], [cx + 1, 31], [cx + 1, 33], [cx + 1, 38]]) dot(fr, x, y, y > 32 ? 'blood2' : 'blood1');
  return fr;
}
function cage() {
  const S = new Scene(), cx = 11.5;
  S.add(capsule([cx, 0, 0], [cx, 6, 0], 0.7, 0.7, 'darkIron'), 0);
  S.add(ellipsoid([cx, 8, 0], [9, 2.2, 6], 'darkIron'), 0);
  S.add(bumpy(ellipsoid([cx - 0.5, 26, -1], [3.6, 9, 3], 'bone'), 0.3, 0.8), 0.6);
  S.add(sphere([cx, 15.5, 0], 3, 'bone'), 0.8);
  for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, x = cx + Math.cos(ang) * 8.4, z = Math.sin(ang) * 5.6; S.add(capsule([x, 8, z], [x, 39, z], 0.6, 0.6, 'darkIron'), 0); }
  S.add(box([cx, 40, 0], [9.6, 1.2, 6.2], 0.5, 'darkIron'), 0);
  const fr = R(S, 23, 44, MM, {});
  dot(fr, cx - 1, 15.5, 'ink0'); dot(fr, cx + 1.2, 15.5, 'ink0');
  return fr;
}
function hangChain() {
  const S = new Scene();
  for (let k = 0; k < 9; k++) S.add(torus([4, 2 + k * 4, 0], 1.8, 0.55, k % 2 ? 0 : Math.PI / 2, 'darkIron'), 0);
  S.add(capsule([4, 37, 0], [6, 38.5, 0], 0.8, 0.5, 'iron'), 0.4);
  return R(S, 8, 40, MM, {});
}
function carpet(kind) { // 16x16 woven runner tiles: 0 centre, 1 left edge, 2 right edge, 3 centre with the sigil
  return relief(16, 16, (x, y) => {
    const edge = kind === 1 ? x < 4 : kind === 2 ? x > 12 : false, trim = kind === 1 ? x >= 2 && x < 3.4 : kind === 2 ? x > 12.6 && x <= 14 : false;
    if (kind === 1 && x < 1.2) return { name: 'gold3' };
    if (kind === 2 && x > 14.8) return { name: 'gold3' };
    const weave = (Math.floor(y) % 2) * 0.12 + (Math.floor(x) % 4 === 0 ? -0.06 : 0);
    if (trim) return { h: 1 + weave, ramp: 'gold', tone: -0.05, min: 2, max: 6 };
    const diamond = kind === 3 && Math.abs(x - 8) + Math.abs(y - 8) < 5 && Math.abs(x - 8) + Math.abs(y - 8) > 3.4;
    return { h: weave, ramp: diamond ? 'gold' : 'crimson', tone: (edge ? -0.12 : -0.04) + noise3(x * 0.2, y * 0.2, kind) * 0.04, min: 2, max: 7 };
  });
}


// ------------------------------------------------------ pickups and shots ---
function water(v) { // 16x16, tiles seamlessly; ripples drift with v
  const T = Math.PI * 2 / 16;
  return relief(16, 16, (x, y) => {
    const h = Math.sin(x * T + v * 1.57) * Math.sin(y * T * 2 - v * 1.57) * 0.5 + Math.sin((x - y) * T + v * 1.57) * 0.15;
    if (h > 0.42) return { name: h > 0.48 ? 'teal1' : 'teal2' };
    return { h, ramp: 'teal', tone: -0.3, min: 4, max: 8 };
  }, { k: 1.2, contrast: 1.2 });
}
function coin(i) {
  const S = new Scene();
  S.add(i ? box([4, 4, 0], [0.9, 3, 3], 0.6, 'gold') : { mat: 'gold', bb: [0, 0, -2, 8, 8, 2], f: (x, y, z) => Math.max(Math.hypot(x - 4, y - 4) - 3.2, Math.abs(z) - 0.9) - 0.4 }, 0);
  return R(S, 8, 8, MM, {});
}
function goldPile(n) {
  const S = new Scene();
  for (let k = 0; k < n * 3; k++) { const x = 4 + (k * 37) % 10, y = 7 + (k * 13) % 4 - (k > 4 ? 2 : 0); S.add({ mat: 'gold', bb: [x - 3, y - 3, -3, x + 3, y + 3, 3], f: (px, py, pz) => Math.max(Math.hypot(px - x, (pz - k * 0.3) * 1.1) - 2.2, Math.abs(py - y) - 0.5) - 0.3 }, 0); }
  const fr = R(S, 18, 13, MM, {});
  dot(fr, 6, 5, 'white');
  return fr;
}
function globe(i) {
  const S = new Scene();
  S.add(sphere([8, 8, 0], 5.4 + i * 0.5, 'blood'), 0);
  const fr = R(S, 16, 16, { ...MM, blood: { ramp: 'blood', spec: 0.9, bias: 0.1 } }, {});
  dot(fr, 6, 5, 'white'); dot(fr, 5, 6, 'blood0');
  return fr;
}
function shot(kind) {
  const S = new Scene(), M2 = { ...MM, glowE: { ramp: 'ember', glow: 1 }, glowV: { ramp: 'violet', glow: 1 }, glowB: { ramp: 'blood', glow: 1 }, glowM: { ramp: 'moss', glow: 1 } };
  const c = [8, 8, 0];
  if (kind === 'wax') { S.add(bumpy(sphere(c, 4.4, 'emberLit'), 0.4, 1), 0); }
  if (kind === 'bone') S.add(rotZ(capsule([3, 8, 0], [13, 8, 0], 1.3, 0.6, 'bone'), c, -0.4), 0);
  if (kind === 'tear') { S.add(capsule([8, 3, 0], [8, 9, 0], 0.4, 3.2, 'holy'), 0.4); }
  if (kind === 'feather') { S.add(rotZ(ellipsoid(c, [6, 1.6, 0.8], 'cloth'), c, -0.5), 0); S.add(rotZ(capsule([2, 8, 1], [13, 8, 1], 0.4, 0.3, 'ink'), c, -0.5), 0); }
  if (kind === 'spit') S.add(bumpy(sphere(c, 3.8, 'rot'), 0.4, 1.1), 0);
  if (kind === 'ember') S.add(sphere(c, 3, 'glowE'), 0);
  if (kind === 'violet') S.add(sphere(c, 4, 'violet'), 0);
  if (kind === 'blood') S.add(sphere(c, 4, 'blood'), 0);
  if (kind === 'frost') { S.add(sphere(c, 4.8, 'holy'), 0); for (const a of [0, 1.57, 3.14, 4.71]) S.add(capsule(c, [8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 0], 1.1, 0.3, 'holy'), 0.4); }
  if (kind === 'bomb') { S.add(sphere([8, 9, 0], 4.6, 'darkIron'), 0); S.add(capsule([10, 5, 0], [11.5, 3, 0], 0.7, 0.6, 'wood'), 0.3); }
  if (kind === 'coffin') S.add(box(c, [3, 6.5, 1.6], 0.6, 'wood'), 0);
  const fr = R(S, 16, 16, M2, {});
  if (['wax', 'violet', 'blood', 'frost'].includes(kind)) dot(fr, 6, 6, 'white');
  if (kind === 'bomb') dot(fr, 12, 2, 'ember0');
  return fr;
}

export default {
  hall: {
    slab: slabSet,
    wall: wallTiles,
    decor: () => [stainedGlass(), banner(), sconce()],
    torch: () => [0, 1, 2, 3].map(torchStand),
    statue_saint: () => [statue('saint')], statue_angel: () => [statue('angel')], statue_knight: () => [statue('knight')],
    skullcandle: () => [skullCandle(0), skullCandle(1)], crate: () => [crate()], urn: () => [urn(0), urn(1)],
  },
  walldecor: { decor: () => [alcove(), banner(), sconce(), alcove()] },
  props: {
    column: () => [column()], sarcophagus: () => [sarcophagus()], urn: () => [urn(1)], bonepile: () => [bonepile()],
    candelabra: () => [0, 1, 0, -1].map(candelabra), candles: () => [floorCandles(0), floorCandles(1)],
  },
  loot: {
    skullwall: () => [skullWall()], gate: () => [gate()], chest: () => [chest(false), chest(true)], shrine: () => ['fervor', 'haste', 'warding', 'plenty'].map(shrine),
    coffin: () => [coffin(false), coffin(true)], water: () => [0, 1, 2, 3].map(water), coin: () => [coin(0), coin(1)], gold: () => [goldPile(1), goldPile(2), goldPile(3)], globe: () => [globe(0), globe(1)],
    ...Object.fromEntries(['wax', 'bone', 'tear', 'feather', 'spit', 'ember', 'violet', 'blood', 'frost', 'bomb'].map((k) => [k, () => [shot(k)]])), pew: () => [pew()], altar: () => [altar()], maiden: () => [maiden()], cage: () => [cage()], hangchain: () => [hangChain()],
  },
  tiles: { carpet: () => [carpet(0), carpet(1), carpet(2), carpet(3), carpet(0), carpet(3)] },
};
