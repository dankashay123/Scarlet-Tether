// Draws every sprite in code and exports PNG sheets + JSON frame maps to
// assets/sprites/. No dependencies: `node tools/sprites.mjs`.
// Pass --preview <dir> to also write 5x-scaled previews for review.
//
// Shading model: each part is lit from the top-left using a surface normal
// (sphere, cylinder or bevel), mapped onto a 5-step hue-shifted ramp with a
// light ordered dither. Characters get a 1 px dark outline; tiles do not.
// Every pixel is checked against the master palette on export.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RGB, IDX, PALETTE, FINE, ramp } from './palette.mjs';
import { setRes } from './sdf.mjs';
import { chunkify } from './chunky.mjs';
// Chunky pixels: every model renders on a 2x2 grid (see tools/chunky.mjs).
// The HUD sheet stays fine so buttons and icons read crisply.
const CHUNK = 2, FINE_SHEETS = new Set(['ui']);
setRes(CHUNK);
// v5: sculpted models (tools/sdf.mjs) replace hand-drawn animations by name.
const OVR = {};
for (const m of ['saint', 'common', 'rare', 'elite', 'town', 'townfolk', 'dungeon', 'floor', 'vfx', 'props', 'weapon', 'street']) {
  let set;
  try { set = (await import(`./models/${m}.mjs`)).default; } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') console.warn(`models/${m}.mjs failed to load: ${e.message}`); continue; }
  for (const [sh, anims] of Object.entries(set)) OVR[sh] = { ...OVR[sh], ...anims };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'sprites');

// Reverse map: palette index -> [rampName, step].
const STEP = {};
for (const [name, r] of Object.entries(FINE)) r.forEach((n, i) => { STEP[IDX[n]] = [name, i]; });

// Deterministic noise.
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => v / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

const LIGHT = (() => { const v = [-0.55, -0.7, 0.5]; const d = Math.hypot(...v); return v.map((c) => c / d); })();

// ---------------------------------------------------------------- frames ---

class Frame {
  constructor(w, h, oy = 0) { this.w = w; this.h = h; this.oy = oy; this.px = new Int16Array(w * h).fill(-1); }
  get(x, y) { y += this.oy; return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.px[y * this.w + x]; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y) + this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = typeof c === 'string' ? IDX[c] : c;
  }
  raw(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.px[y * this.w + x]; }
  // Paint a mask. shader(x, y) returns light 0..1 (1 = fully lit).
  paint(mask, rampName, shader = () => 0.5, { min = 0, max = 4, dither = 0.55 } = {}) {
    const r = ramp(rampName);
    for (const k of mask) {
      const [x, y] = k.split(',').map(Number);
      const t = Math.max(0, Math.min(1, shader(x, y)));
      // 9 fine steps; min/max are given in the 5 named steps.
      let i = Math.round((1 - t) * 8 + (bayer(x, y + this.oy) - 0.5) * dither * 1.6);
      i = Math.max(min * 2, Math.min(max * 2, i));
      this.set(x, y, r[i]);
    }
    return this;
  }
  // Shift already-painted pixels darker (+) or lighter (-) along their ramp.
  shift(mask, n) {
    for (const k of mask) {
      const [x, y] = k.split(',').map(Number);
      const c = this.get(x, y); if (c < 0 || !STEP[c]) continue;
      const [name, i] = STEP[c];
      this.set(x, y, FINE[name][Math.max(0, Math.min(8, i + n * 2))]);
    }
    return this;
  }
  outline(color = 'outline') {
    const o = IDX[color], add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.raw(x, y) !== -1) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = this.raw(x + dx, y + dy); if (c > -1 && c !== o) { add.push(y * this.w + x); break; } }
    }
    for (const i of add) this.px[i] = o;
    return this;
  }
  mirror() { const f = new Frame(this.w, this.h); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) f.px[y * this.w + x] = this.px[y * this.w + (this.w - 1 - x)]; return f; }
}

// Shaders.
const lit = (nx, ny, nz) => { const d = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]; return d * 0.5 + 0.5; };
const sphere = (cx, cy, rx, ry, bias = 0) => (x, y) => {
  const nx = (x - cx) / rx, ny = (y - cy) / ry, r2 = Math.min(1, nx * nx + ny * ny);
  return lit(nx, ny, Math.sqrt(1 - r2)) * 1.1 - 0.17 + bias;
};
const cyl = (cx, rx, bias = 0, tilt = -0.25) => (x) => {
  const nx = Math.max(-1, Math.min(1, (x - cx) / rx));
  return lit(nx, tilt, Math.sqrt(1 - nx * nx)) * 1.1 - 0.17 + bias;
};
const flat = (t) => () => t;
// Bevelled block: lit top/left rim, shadowed bottom/right rim.
const bevel = (mask, base = 0.5, hi = 0.95, lo = 0.12, w = 1) => (x, y) => {
  const out = (dx, dy) => !mask.has(`${x + dx},${y + dy}`);
  for (let i = 1; i <= w; i++) { if (out(0, -i) || out(-i, 0)) return hi; if (out(0, i) || out(i, 0)) return lo; }
  return base;
};
const vgrad = (y0, y1, t0, t1) => (x, y) => t0 + (t1 - t0) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0 || 1)));

// Masks (sets of "x,y").
const M = {
  ellipse(cx, cy, rx, ry) {
    const s = new Set();
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x - cx) / (rx + 0.4), dy = (y - cy) / (ry + 0.4);
        if (dx * dx + dy * dy <= 1) s.add(`${x},${y}`);
      }
    return s;
  },
  rect(x0, y0, w, h) { const s = new Set(); for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s.add(`${x},${y}`); return s; },
  poly(pts) {
    const s = new Set();
    const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        const yy = y + 0.5;
        if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + (yy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) s.add(`${x},${y}`);
    }
    return s;
  },
  line(x0, y0, x1, y1, t = 1) {
    const s = new Set(), n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      for (let a = 0; a < t; a++) for (let b = 0; b < t; b++) s.add(`${Math.round(x - (t - 1) / 2 + a)},${Math.round(y - (t - 1) / 2 + b)}`);
    }
    return s;
  },
  union(...ms) { const s = new Set(); for (const m of ms) for (const k of m) s.add(k); return s; },
  minus(a, ...bs) { const s = new Set(a); for (const b of bs) for (const k of b) s.delete(k); return s; },
  and(a, b) { const s = new Set(); for (const k of a) if (b.has(k)) s.add(k); return s; },
  edge(m, dx, dy) { const s = new Set(); for (const k of m) { const [x, y] = k.split(',').map(Number); if (!m.has(`${x + dx},${y + dy}`)) s.add(k); } return s; },
  pts(list) { return new Set(list.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`)); },
  rows(m, y0, y1) { const s = new Set(); for (const k of m) { const y = +k.split(',')[1]; if (y >= y0 && y <= y1) s.add(k); } return s; },
};
const P = (f, x, y, c) => f.set(x, y, c);

// ----------------------------------------------------------------- sheets ---

// Crop a frame to its pixels on even bounds; the anchor stays inside.
function trim(f) {
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return f;
  x0 = Math.min(x0, f.ax) & ~1; y0 = Math.min(y0, f.ay) & ~1;
  x1 = Math.max(x1, f.ax) + 1; y1 = Math.max(y1, f.ay) + 1;
  x1 = Math.min(f.w, x1 + ((x1 - x0) & 1)); y1 = Math.min(f.h, y1 + ((y1 - y0) & 1));
  const w = x1 - x0, h = y1 - y0, out = new Frame(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.px[y * w + x] = f.px[(y + y0) * f.w + x + x0];
  return Object.assign(out, { ax: f.ax - x0, ay: f.ay - y0 });
}

function sheet(name, anims, extra = {}) {
  if (process.argv.includes('--audit')) { const old = Object.keys(anims).filter((k) => !(OVR[name] && OVR[name][k])); if (old.length) console.log(`old art in ${name}: ${old.join(' ')}`); }
  setRes(FINE_SHEETS.has(name) ? 1 : CHUNK);
  if (OVR[name]) { anims = { ...anims }; for (const [a, fn] of Object.entries(OVR[name])) anims[a] = fn(); }
  // Snap every frame (models and the older hand-drawn art) to the chunky grid.
  if (!FINE_SHEETS.has(name)) for (const [a, fs] of Object.entries(anims)) for (const f of fs) chunkify(f, { outline: OVR[name] && OVR[name][a] ? false : 'auto' });
  // Monster frames are cropped to their pixels (on the 2x2 grid), keeping the feet anchor.
  if (name.startsWith('mon_')) for (const fs of Object.values(anims)) fs.forEach((f, i) => { if (f.ax !== undefined) fs[i] = trim(f); });
  // Each animation is a strip of cells as wide as its widest frame; strips
  // are packed onto shelves so no sheet grows too tall for phone GPUs.
  const rows = Object.entries(anims);
  const cellW = rows.map(([, fs]) => Math.max(...fs.map((f) => f.w)));
  const cellH = rows.map(([, fs]) => Math.max(...fs.map((f) => f.h)));
  const stripW = rows.map(([, fs], r) => fs.length * cellW[r]);
  const area = stripW.reduce((a, w, r) => a + w * cellH[r], 0);
  const W = Math.max(...stripW, Math.ceil(Math.sqrt(area) * 1.15 / 2) * 2);
  const at = []; let sx = 0, sy = 0, shelfH = 0;
  rows.forEach((_, r) => { if (sx + stripW[r] > W) { sx = 0; sy += shelfH; shelfH = 0; } at.push([sx, sy]); sx += stripW[r]; shelfH = Math.max(shelfH, cellH[r]); });
  const H = sy + shelfH;
  const big = new Frame(W, H);
  const json = { image: `${name}.png`, ...extra, anims: {} };
  rows.forEach(([anim, frames], r) => {
    const [ox, oy] = at[r];
    json.anims[anim] = frames.map((f, c) => {
      const x0 = ox + c * cellW[r];
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) big.px[(oy + y) * W + x0 + x] = f.px[y * f.w + x];
      return f.ax !== undefined ? { x: x0, y: oy, w: f.w, h: f.h, ax: f.ax, ay: f.ay } : { x: x0, y: oy, w: f.w, h: f.h };
    });
  });
  return { name, frame: big, json };
}

// ============================================================= the Saint ===
// 30x42 frame, facing right, feet at y 38. Crimson hood and mantle over a
// pale robe, gold stole, the hollow where a face should be, cracked halo.

function saint({ bob = 0, halo = 0, feet = [0, 0], hem = 0, cape = 0, lean = 0, tuck = 0, blink = false, aim = 0 }) {
  const f = new Frame(30, 44, 5);
  const B = bob, X = lean, G = 35 - tuck;

  // Cape behind the body.
  const capeM = M.poly([[9 + X, 13 + B], [20 + X, 13 + B], [22 + cape, G - 1], [17 + cape, G + 1], [11 + cape, G], [5 + cape, G - 1]]);
  f.paint(capeM, 'crimson', cyl(14 + X, 9, -0.35), { min: 2, dither: 0.3 });

  // Boots.
  for (const [fx, fo] of [[11, feet[0]], [17, feet[1]]]) f.paint(M.ellipse(fx + fo, G + 0.5, 2.4, 1.5), 'shroud', sphere(fx + fo - 1, G - 0.5, 3, 2), { min: 1 });

  // Robe with folds.
  const robe = M.poly([[10 + X, 15 + B], [20 + X, 15 + B], [22 + hem, G], [8 + hem, G]]);
  f.paint(robe, 'cloth', cyl(15 + X * 0.5 + hem * 0.3, 8.5, 0.05), { max: 3, dither: 0.25 });
  for (const fx of [11.5, 18.5]) f.shift(M.and(M.line(fx + X, 23 + B, fx + hem * 1.2, G - 1), robe), 1);
  f.shift(M.and(M.line(13.5 + X, 26 + B, 13.5 + hem, G - 1), robe), 1);
  // Hem: gold trim with a dried-blood stain.
  const hemM = M.and(M.union(M.rows(robe, G - 1, G)), robe);
  f.paint(hemM, 'gold', (x, y) => (y === G ? 0.35 : 0.75) - (x > 17 + hem ? 0.25 : 0));
  for (const [x, y] of [[9 + hem, G - 2], [10 + hem, G - 2], [10 + hem, G - 3], [20 + hem, G - 2]]) if (robe.has(`${x},${y}`)) P(f, x, y, 'blood3');

  // Gold stole down the front with crimson crosses.
  const stole = M.and(M.poly([[15 + X, 16 + B], [18 + X, 16 + B], [18 + hem * 0.6, G - 2], [15 + hem * 0.6, G - 2]]), robe);
  f.paint(stole, 'gold', cyl(16.5 + X * 0.6, 2.2));
  for (let y = 19 + B; y < G - 3; y += 5) { const cx = 16 + Math.round(X * 0.6 + (y - 16) / (G - 16) * hem * 0.6); P(f, cx + 0.5, y, 'crimson2'); P(f, cx + 0.5, y - 1, 'crimson3'); P(f, cx - 0.5, y, 'crimson3'); P(f, cx + 1.5, y, 'crimson3'); P(f, cx + 0.5, y + 1, 'crimson3'); }

  // Rope belt with a hanging knot.
  const belt = M.and(M.rect(9 + X, 22 + B, 13, 1), robe);
  f.paint(belt, 'gold', cyl(15 + X, 6), { min: 2 });
  f.paint(M.line(13 + X, 23 + B, 12.5 + X + hem * 0.5, 27 + B), 'gold', flat(0.35));

  // Mantle over the shoulders, with a gold clasp.
  const mantle = M.union(M.ellipse(15 + X, 15.5 + B, 7.2, 4), M.rect(9 + X, 13 + B, 12, 2));
  f.paint(mantle, 'crimson', sphere(13.5 + X, 13 + B, 8.5, 6));
  f.shift(M.edge(mantle, 0, 1), 1);
  f.paint(M.rect(18 + X, 16 + B, 2, 2), 'gold', (x, y) => (x === 18 + X && y === 16 + B ? 1 : 0.5));

  // Arm and the Nail Crossbow.
  const cy = 20 + B + aim;
  const sleeve = M.line(18 + X, 15 + B, 21 + X, cy, 3);
  f.paint(sleeve, 'crimson', sphere(18 + X, 15 + B, 5, 6, -0.05));
  const stock = M.rect(16 + X, cy, 11, 2);
  f.paint(stock, 'wood', (x, y) => (y === cy ? 0.8 : 0.35) - ((x * 7) % 5 === 0 ? 0.2 : 0));
  const prodPts = [];
  for (let y = cy - 6; y <= cy + 7; y++) prodPts.push([26 + X - Math.round(((y - cy - 0.5) / 6.5) ** 2 * 2), y]);
  f.paint(M.pts(prodPts), 'iron', (x, y) => 0.95 - (y - cy + 6) / 14 * 0.8, { dither: 0 });
  f.paint(M.union(M.line(24 + X, cy - 5, 20 + X, cy), M.line(24 + X, cy + 6, 20 + X, cy + 1)), 'bone', flat(0.4), { dither: 0 });
  P(f, 27 + X, cy, 'gold0'); P(f, 28 + X, cy, 'holy0');
  f.paint(M.rect(20 + X, cy, 2, 2), 'shroud', flat(0.5)); // gloved hand

  // Pointed hood.
  const hood = M.union(M.ellipse(14.5 + X, 9 + B, 5.8, 5.6), M.poly([[9 + X, 8 + B], [11 + X, 1 + B], [15 + X, 4 + B]]));
  f.paint(hood, 'crimson', sphere(13.5 + X, 7.5 + B, 7, 7));
  // The hollow face, its gilt rim, and the eyes.
  const face = M.ellipse(17 + X, 10 + B, 2.6, 3.1);
  for (const k of face) { const [x, y] = k.split(',').map(Number); if (hood.has(k)) P(f, x, y, y <= 8 + B ? 'ink2' : 'ink0'); }
  for (const k of face) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]) {
      const n = `${x + dx},${y + dy}`;
      if (hood.has(n) && !face.has(n)) P(f, x + dx, y + dy, dy < 0 || (dx < 0 && dy === 0 && y < 10 + B) ? 'gold1' : 'gold2');
    }
  }

  // Cracked halo, floating.
  const hy = -2 + halo + B;
  const ring = M.minus(M.ellipse(14.5 + X, hy, 6, 2.4), M.ellipse(14.5 + X, hy, 4.3, 1.1));
  const crack = M.pts([[17 + X, Math.round(hy) + 2], [18 + X, Math.round(hy) + 2]]);
  f.paint(M.minus(ring, crack), 'gold', (x, y) => 0.95 - (x - 8 - X) / 14 * 0.6 - (y > hy ? 0.25 : 0), { dither: 0.3 });

  f.outline();
  // Glowing eyes and the halo glint, after the outline.
  if (!blink) { P(f, 16 + X, 10 + B, 'flame0'); P(f, 18 + X, 10 + B, 'flame1'); P(f, 16 + X, 11 + B, 'flame3'); P(f, 18 + X, 11 + B, 'flame4'); }
  else { P(f, 16 + X, 10 + B, 'flame3'); P(f, 18 + X, 10 + B, 'flame3'); }
  P(f, 10 + X, Math.round(hy) - 1, 'white');
  return f;
}

function saintSheet() {
  const idle = [0, 1, 2, 3].map((i) => saint({ bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, 0, -1, -1][i], blink: i === 3 }));
  const run = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = Math.sin(i / 6 * Math.PI * 2);
    return saint({ bob: i % 3 === 0 ? 0 : -1, halo: i % 3 === 0 ? 1 : 0, feet: [Math.round(s * 2.5), Math.round(-s * 2.5)], hem: s > 0.3 ? -1 : 0, cape: -2 - (i % 3 === 1 ? 1 : 0), lean: 1 });
  });
  const dash = [
    saint({ lean: 2, hem: -2, cape: -4, tuck: 1, feet: [-2, 1], halo: 1 }),
    saint({ lean: 3, hem: -3, cape: -6, tuck: 2, feet: [-3, 0], halo: 2 }),
    saint({ lean: 1, hem: -1, cape: -3, tuck: 1, feet: [-1, 1], halo: 1 }),
  ];
  return sheet('saint', { idle, run, dash }, { anchorX: 15, anchorY: 40 });
}

function portrait() {
  const f = new Frame(26, 26);
  f.paint(M.rect(0, 0, 26, 26), 'ink', vgrad(0, 26, 0.35, 0.05));
  const hood = M.union(M.ellipse(12, 15, 10.5, 10.5), M.poly([[3, 12], [7, 1], [12, 5]]));
  f.paint(hood, 'crimson', sphere(9, 10, 13, 13));
  const face = M.ellipse(15, 16, 5, 6);
  for (const k of face) { const [x, y] = k.split(',').map(Number); P(f, x, y, y < 13 ? 'ink2' : y < 15 ? 'ink1' : 'ink0'); }
  for (const k of M.minus(M.ellipse(15, 16, 6.2, 7.2), face)) { const [x, y] = k.split(',').map(Number); if (hood.has(k) && x <= 20) P(f, x, y, y < 14 ? 'gold1' : 'gold2'); }
  for (const [x, c] of [[12, 'flame0'], [17, 'flame1']]) { P(f, x, 16, c); P(f, x + 1, 16, 'flame2'); P(f, x, 17, 'flame3'); P(f, x, 18, 'flame4'); }
  const ring = M.minus(M.ellipse(12, 2, 9, 2.6), M.ellipse(12, 2, 6.2, 1));
  f.paint(M.minus(ring, M.rect(17, 0, 2, 5)), 'gold', (x) => 1 - x / 24);
  return f;
}

// ============================================================= the Risen ===
// 24x28 fodder, facing right: a hunched corpse in grave cloth, ribs through
// a tear, jaw hanging, green pinprick eyes, arms reaching.

function risen({ bob = 0, legs = [0, 0], arms = 0, lean = 0, reach = 0 }) {
  const f = new Frame(24, 28);
  const B = bob, X = lean;
  // Back arm.
  f.paint(M.line(11 + X, 12 + B, 17 + X + reach, 14 + B + arms, 2), 'rot', flat(0.2), { min: 2 });
  // Legs.
  for (const [hx, l, s] of [[9, legs[0], -0.2], [13, legs[1], 0]]) {
    const leg = M.union(M.line(hx, 19 + B, hx - 1 + l, 23, 2), M.line(hx - 1 + l, 23, hx + l, 26, 2));
    f.paint(leg, 'rot', cyl(hx + l * 0.5, 2, s), { min: 1 });
    f.paint(M.rect(hx - 1 + l, 26, 3, 1), 'bone', flat(0.3));
  }
  // Torso in a ragged shroud.
  const torso = M.union(M.ellipse(11 + X * 0.5, 14 + B, 6, 5.5), M.poly([[5, 16 + B], [17, 16 + B], [16, 22 + B], [14, 20 + B], [12, 23 + B], [10, 20 + B], [7, 22 + B]]));
  f.paint(torso, 'shroud', sphere(9 + X * 0.5, 11 + B, 8, 8));
  // Tear with ribs.
  const tear = M.ellipse(9 + X * 0.5, 15 + B, 2, 2.2);
  f.paint(tear, 'shroud', flat(0.05));
  for (const [x, y] of [[8, 14], [10, 14], [9, 16]]) P(f, x + X * 0.5, y + B, 'bone2');
  P(f, 7, 12 + B, 'blood3'); P(f, 8, 12 + B, 'blood2'); P(f, 8, 13 + B, 'blood3');
  // Head, forward and low.
  const hx = 16 + X, hy = 8 + B;
  const head = M.ellipse(hx, hy, 3.8, 3.6);
  f.paint(head, 'rot', sphere(hx - 1.5, hy - 1.5, 4.5, 4.5));
  for (const [x, y] of [[hx - 2, hy - 4], [hx - 3, hy - 3], [hx - 1, hy - 4]]) P(f, x, y, 'ink3'); // hair wisps
  P(f, hx, hy, 'ink0'); P(f, hx + 2, hy, 'ink0'); P(f, hx + 1, hy - 1, 'rot3'); // sockets and brow
  P(f, hx + 3, hy + 1, 'ink1'); // nose hole
  const jaw = M.ellipse(hx + 1.5, hy + 3.5, 2, 1.2);
  f.paint(jaw, 'bone', sphere(hx + 1, hy + 3, 2.5, 2));
  P(f, hx + 1, hy + 2, 'ink0'); P(f, hx + 2, hy + 2, 'bone0'); P(f, hx + 3, hy + 2, 'ink0');
  // Front arm with claws.
  const ax = 19 + X + reach, ay = 13 + B + arms;
  f.paint(M.line(12 + X, 13 + B, ax, ay, 2), 'rot', sphere(12 + X, 11 + B, 8, 6));
  P(f, ax + 1, ay - 1, 'bone1'); P(f, ax + 2, ay, 'bone1'); P(f, ax + 1, ay + 1, 'bone2');
  f.outline();
  P(f, hx, hy, 'flame1'); P(f, hx + 2, hy, 'flame0');
  return f;
}

function risenSheet() {
  const walk = [risen({ legs: [-1, 1] }), risen({ bob: 1, arms: 1 }), risen({ legs: [1, -1] }), risen({ bob: 1, arms: -1 })];
  const attack = [risen({ lean: -1, arms: -5, reach: -2 }), risen({ lean: -2, arms: -6, reach: -3, bob: 1 }), risen({ lean: 2, arms: 1, reach: 4 }), risen({ lean: 1, reach: 1, bob: 1 })];
  return sheet('risen', { walk, attack }, { anchorX: 12, anchorY: 26 });
}

// ======================================================= the Gravewarden ===
// 36x38 elite: a skull in an iron crown behind a gilded tower shield.

function warden({ bob = 0, legs = [0, 0], shield = 0, raise = 0 }) {
  const f = new Frame(38, 38);
  const B = bob, R = raise;
  // Legs and sabatons.
  for (const [lx, l] of [[12, legs[0]], [18, legs[1]]]) {
    const leg = M.rect(lx + l, 25 + B, 4, 9 - B);
    f.paint(leg, 'iron', cyl(lx + l + 1.5, 2.5, -0.1), { min: 1 });
    f.paint(M.ellipse(lx + l + 2, 28 + B, 2.2, 1.6), 'iron', sphere(lx + l + 1, 27 + B, 3, 3));
    f.paint(M.rect(lx + l, 34, 5, 2), 'iron', flat(0.25));
  }
  // Tabard, torn at the hem.
  const tab = M.poly([[13, 19 + B], [21, 19 + B], [22, 31 + B], [20, 29 + B], [18, 32 + B], [16, 29 + B], [14, 31 + B], [12, 29 + B]]);
  f.paint(tab, 'crimson', cyl(17, 5, -0.05));
  f.paint(M.and(M.union(M.edge(tab, -1, 0), M.edge(tab, 1, 0)), M.rows(tab, 19 + B, 28 + B)), 'gold', flat(0.45));
  // Breastplate.
  const chest = M.ellipse(17, 17 + B, 6.2, 5.5);
  f.paint(chest, 'iron', sphere(15, 14 + B, 7, 7));
  f.paint(M.rows(M.edge(chest, 0, 1), 0, 99), 'gold', flat(0.4));
  // Rear pauldron.
  f.paint(M.ellipse(11.5, 14 + B, 4, 3.5), 'iron', sphere(10.5, 12.5 + B, 4.5, 4.5));
  // Skull helm with an iron crown.
  const hx = 18, hy = 8 + B - R;
  const skull = M.ellipse(hx, hy, 4.8, 4.8);
  f.paint(skull, 'bone', sphere(hx - 1.5, hy - 2, 5.5, 5.5));
  const crown = M.union(M.rect(hx - 5, hy - 4, 11, 2), ...[-4, -1, 2, 5].map((dx) => M.line(hx + dx, hy - 5, hx + dx, hy - 7)));
  f.paint(crown, 'iron', vgrad(hy - 7, hy - 2, 0.9, 0.25), { dither: 0 });
  f.paint(M.ellipse(hx + 1, hy + 0.5, 1.2, 1.3), 'ink', flat(1)); f.paint(M.ellipse(hx + 3.5, hy + 0.5, 1, 1.3), 'ink', flat(1));
  P(f, hx + 2, hy + 2, 'ink1');
  for (let x = hx; x <= hx + 4; x++) P(f, x, hy + 4, x % 2 ? 'ink1' : 'bone0');
  // Tower shield.
  const sx = 23 + shield, sy = 9 + B - R;
  const sh = M.union(M.rect(sx, sy + 1, 10, 22), M.rect(sx + 1, sy, 8, 1), M.rect(sx + 1, sy + 23, 8, 1));
  f.paint(sh, 'iron', bevel(sh, 0.45, 0.9, 0.1));
  const rim = M.minus(sh, M.rect(sx + 1, sy + 1, 8, 22));
  f.paint(rim, 'gold', (x, y) => (x <= sx || y <= sy + 1 ? 0.85 : 0.3));
  const cross = M.union(M.rect(sx + 4, sy + 4, 2, 16), M.rect(sx + 2, sy + 8, 6, 2));
  f.paint(cross, 'gold', bevel(cross, 0.55, 1, 0.2));
  for (const [x, y] of [[sx + 2, sy + 2], [sx + 7, sy + 2], [sx + 2, sy + 21], [sx + 7, sy + 21]]) P(f, x, y, 'iron0');
  f.shift(M.line(sx + 2, sy + 14, sx + 4, sy + 17), 2);
  f.outline();
  P(f, hx + 1, hy + 0.5, 'flame1'); P(f, hx + 3.5, hy + 0.5, 'flame0');
  return f;
}

function wardenSheet() {
  const walk = [warden({ legs: [-1, 1] }), warden({ bob: 1 }), warden({ legs: [1, -1] }), warden({ bob: 1 })];
  const attack = [warden({ shield: -2, raise: 1 }), warden({ shield: -3, raise: 2, bob: 1 }), warden({ shield: 3 }), warden({ shield: 1, bob: 1 })];
  return sheet('gravewarden', { walk, attack }, { anchorX: 17, anchorY: 35 });
}

// ================================================================ tiles ===
// 16x16, the Undercroft. No outlines on tiles.

function floorTile(v) {
  const f = new Frame(16, 16);
  const layouts = [
    [[0, 0, 16, 16]], [[0, 0, 16, 8], [0, 8, 16, 8]], [[0, 0, 8, 16], [8, 0, 8, 16]],
    [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]], [[0, 0, 10, 16], [10, 0, 6, 8], [10, 8, 6, 8]], [[0, 0, 16, 6], [0, 6, 9, 10], [9, 6, 7, 10]],
  ];
  const L = layouts[v % layouts.length];
  L.forEach(([x0, y0, w, h], si) => {
    const stone = M.rect(x0, y0, w - 1, h - 1);
    const tone = 0.42 + hash(v, si, 3) * 0.16;
    f.paint(stone, 'stone', (x, y) => {
      const b = bevel(stone, tone, tone + 0.18, tone - 0.18)(x, y);
      return b + (hash(x, y, v * 7 + si) - 0.5) * 0.08;
    }, { min: 1, max: 4, dither: 0.35 });
    for (let x = x0; x < x0 + w; x++) P(f, x, y0 + h - 1, 'ink3');
    for (let y = y0; y < y0 + h; y++) P(f, x0 + w - 1, y, 'ink3');
    if (hash(v, si, 9) < 0.3) P(f, x0 + w - 2, y0 + h - 2, 'ink3'); // chipped corner
  });
  if (v === 6) { let x = 3, y = 2; for (let i = 0; i < 12; i++) { P(f, x, y, 'ink2'); if (hash(i, v) < 0.5) x++; else y++; } } // crack
  return f;
}

function carpetTile(kind) {
  const f = new Frame(16, 16);
  f.paint(M.rect(0, 0, 16, 16), 'crimson', (x, y) => {
    const d = (Math.abs(((x + 4) % 8) - 4) + Math.abs(((y + 4) % 8) - 4));
    return (d === 4 ? 0.2 : 0.42) + (hash(x, y, 31) - 0.5) * 0.12;
  }, { min: 2, max: 4 });
  for (const [x, y] of [[4, 4], [12, 4], [4, 12], [12, 12]]) P(f, x, y, 'gold2');
  if (kind === 1 || kind === 2) { // gold border with fringe
    const xs = kind === 1 ? [0, 1, 2] : [13, 14, 15];
    for (let y = 0; y < 16; y++) {
      P(f, xs[0], y, kind === 1 ? (y % 2 ? 'gold3' : 'gold4') : 'gold2');
      P(f, xs[1], y, kind === 1 ? 'gold1' : 'gold2'); P(f, xs[2], y, kind === 1 ? 'gold2' : (y % 2 ? 'gold3' : 'gold4'));
    }
  }
  if (kind === 4 || kind === 5) { // top / bottom gold border
    const ys = kind === 4 ? [0, 1, 2] : [13, 14, 15];
    for (let x = 0; x < 16; x++) {
      P(f, x, ys[0], kind === 4 ? (x % 2 ? 'gold3' : 'gold4') : 'gold2');
      P(f, x, ys[1], kind === 4 ? 'gold1' : 'gold2'); P(f, x, ys[2], kind === 4 ? 'gold2' : (x % 2 ? 'gold3' : 'gold4'));
    }
  }
  if (kind === 3) for (const [x, y] of [[6, 7], [7, 7], [7, 8], [8, 8], [9, 8], [8, 9]]) P(f, x, y, 'stone3'); // worn hole
  return f;
}

function grate() {
  const f = floorTile(0);
  const g = M.rect(2, 3, 12, 10);
  f.paint(g, 'ink', flat(0.9));
  for (let x = 3; x < 14; x += 2) f.paint(M.rect(x, 3, 1, 10), 'iron', vgrad(3, 13, 0.6, 0.1), { min: 2 });
  f.paint(M.rect(2, 3, 12, 1), 'iron', flat(0.7), { min: 1 });
  return f;
}

// Walls are three tiles tall: a carved cornice cap, then upper and lower faces.
function wallTop() {
  const f = new Frame(16, 16);
  f.paint(M.rect(0, 0, 16, 16), 'ink', (x, y) => 0.3 + ((x + y * 3) % 11 === 0 ? 0.15 : 0), { min: 2, max: 3, dither: 0 });
  return f;
}
function wallCap() {
  const f = wallTop();
  f.paint(M.rect(0, 9, 16, 2), 'stone', flat(0.75), { dither: 0 });
  f.paint(M.rect(0, 11, 16, 3), 'stone', vgrad(11, 13, 0.55, 0.35));
  for (let x = 1; x < 16; x += 4) f.paint(M.rect(x, 14, 2, 2), 'stone', flat(0.4));
  for (let x = 0; x < 16; x += 4) { P(f, x + 3, 14, 'ink2'); P(f, x + 3, 15, 'ink2'); P(f, x, 14, 'ink3'); P(f, x, 15, 'ink3'); }
  return f;
}
function ashlar(f, y0, y1, seed) {
  for (let row = 0; y0 + row * 5 < y1; row++) {
    const yy = y0 + row * 5, off = row % 2 ? 5 : 0;
    for (let bx = -10; bx < 16; bx += 10) {
      const blk = M.and(M.rect(bx + off, yy, 9, 4), M.rect(0, y0, 16, y1 - y0));
      f.paint(blk, 'stone', (x, y) => bevel(blk, 0.3 + hash(bx, row, seed) * 0.12, 0.5, 0.12)(x, y) + (hash(x, y, seed) - 0.5) * 0.05, { min: 2, dither: 0.3 });
    }
  }
}
function wallUpper() { const f = new Frame(16, 16); f.paint(M.rect(0, 0, 16, 16), 'ink', flat(0.55)); ashlar(f, 0, 16, 5); return f; }
function wallLower() {
  const f = new Frame(16, 16);
  f.paint(M.rect(0, 0, 16, 16), 'ink', flat(0.55));
  ashlar(f, 0, 10, 8);
  f.paint(M.rect(0, 10, 16, 2), 'stone', flat(0.62), { dither: 0 });
  f.paint(M.rect(0, 12, 16, 3), 'stone', vgrad(12, 14, 0.4, 0.2), { min: 2 });
  f.paint(M.rect(0, 15, 16, 1), 'ink', flat(0.9));
  return f;
}

function tilesSheet() {
  // Only the carpet is still used (sculpted in models/dungeon.mjs); the old
  // floor and wall tiles were replaced by models/floor.mjs and the hall sheet.
  return sheet('tiles', { carpet: [0, 1, 2, 3, 4, 5].map(carpetTile) });
}

// ========================================================== wall decor ===
// 16x32 overlays covering the upper+lower face of one wall tile.

function alcove() {
  const f = new Frame(16, 32);
  const arch = M.union(M.rect(3, 9, 10, 12), M.ellipse(8, 9, 5, 4));
  f.paint(arch, 'ink', vgrad(5, 21, 0.75, 0.2));
  f.paint(M.minus(M.union(M.rect(2, 9, 12, 13), M.ellipse(8, 9, 6, 5)), arch), 'stone', bevel(arch, 0.5, 0.8, 0.2), { min: 1 });
  f.paint(M.rect(2, 21, 12, 2), 'stone', flat(0.6));
  // A skull on the sill.
  const s = M.ellipse(8, 18, 2.6, 2.3);
  f.paint(s, 'bone', sphere(7, 17, 3, 3));
  P(f, 7, 18, 'ink0'); P(f, 9, 18, 'ink0'); P(f, 8, 20, 'ink1');
  return f;
}
function banner() {
  const f = new Frame(16, 32);
  f.paint(M.rect(1, 1, 14, 2), 'wood', bevel(M.rect(1, 1, 14, 2), 0.5, 0.8, 0.2));
  const cloth = M.poly([[3, 3], [13, 3], [13, 24], [8, 28], [3, 24]]);
  f.paint(cloth, 'crimson', cyl(7, 6, 0.05));
  for (const x of [5, 10]) f.shift(M.and(M.line(x, 4, x, 26), cloth), 1);
  f.paint(M.and(M.union(M.edge(cloth, -1, 0), M.edge(cloth, 1, 0), M.edge(cloth, 0, 1), M.edge(cloth, -1, 1), M.edge(cloth, 1, 1)), cloth), 'gold', flat(0.45));
  // Sigil: a halo over a weeping eye.
  const halo = M.minus(M.ellipse(8, 10, 3.5, 1.3), M.ellipse(8, 10, 2, 0.3));
  f.paint(halo, 'gold', (x) => 1 - (x - 4) / 8);
  f.paint(M.ellipse(8, 15, 3, 1.6), 'gold', flat(0.7)); f.paint(M.ellipse(8, 15, 1, 1), 'ink', flat(1));
  f.paint(M.line(8, 17, 8, 20), 'gold', flat(0.5));
  return f.outline();
}
function sconce() {
  const f = new Frame(16, 32);
  f.paint(M.union(M.rect(7, 14, 2, 6), M.line(5, 18, 11, 18)), 'iron', flat(0.4), { min: 1 });
  f.paint(M.rect(5, 10, 6, 4), 'iron', bevel(M.rect(5, 10, 6, 4), 0.4, 0.8, 0.1));
  f.paint(M.rect(6, 6, 4, 5), 'bone', cyl(7, 2.5));
  P(f, 8, 5, 'ink0');
  f.outline();
  return f;
}
function crackDecor() {
  const f = new Frame(16, 32);
  let x = 9, y = 3;
  for (let i = 0; i < 22; i++) { P(f, x, y, 'ink1'); P(f, x + 1, y, 'stone4'); y++; if (hash(i, 3) < 0.3) x--; else if (hash(i, 5) < 0.3) x++; }
  for (const [mx, my] of [[3, 24], [4, 24], [4, 25], [5, 23], [11, 26], [12, 26]]) P(f, mx, my, 'moss2');
  P(f, 4, 23, 'moss1');
  return f;
}
function wallDecorSheet() { return sheet('walldecor', { decor: [alcove(), banner(), sconce(), crackDecor()] }); }

// ================================================================ props ===

function column() {
  const f = new Frame(22, 58);
  const shaft = M.rect(4, 10, 14, 40);
  f.paint(shaft, 'stone', cyl(9, 8.5), { min: 0 });
  for (const x of [7, 11, 15]) f.shift(M.and(M.rect(x, 12, 1, 36), shaft), 1);
  f.paint(M.rect(2, 4, 18, 3), 'stone', bevel(M.rect(2, 4, 18, 3), 0.65, 0.95, 0.25));
  f.paint(M.rect(3, 7, 16, 3), 'stone', cyl(9, 9, -0.05));
  f.paint(M.rect(1, 50, 20, 3), 'stone', bevel(M.rect(1, 50, 20, 3), 0.6, 0.95, 0.25));
  f.paint(M.rect(0, 53, 22, 4), 'stone', bevel(M.rect(0, 53, 22, 4), 0.45, 0.85, 0.15));
  f.paint(M.rect(2, 0, 18, 4), 'stone', vgrad(0, 4, 0.8, 0.5));
  for (const [x, y] of [[5, 30], [6, 31], [6, 32], [7, 33], [16, 20], [16, 21]]) P(f, x, y, 'ink2');
  for (const [x, y] of [[1, 52], [2, 52], [2, 51], [19, 52], [3, 9], [4, 9]]) P(f, x, y, 'moss2');
  P(f, 2, 51, 'moss1');
  return f.outline();
}

function statue() {
  const f = new Frame(28, 50);
  const ped = M.rect(3, 38, 22, 11);
  f.paint(ped, 'stone', bevel(ped, 0.5, 0.85, 0.2));
  f.paint(M.rect(5, 41, 18, 5), 'stone', bevel(M.rect(5, 41, 18, 5), 0.38, 0.2, 0.7));
  // Praying robed saint.
  const robe = M.poly([[9, 16], [19, 16], [22, 38], [6, 38]]);
  f.paint(robe, 'stone', cyl(13, 9));
  for (const x of [10, 14, 18]) f.shift(M.and(M.line(x, 22, x + (x - 14) * 0.2, 37), robe), 1);
  const head = M.union(M.ellipse(14, 11, 4.5, 5), M.poly([[10, 10], [12, 4], [15, 7]]));
  f.paint(head, 'stone', sphere(12.5, 9, 6, 6));
  f.paint(M.ellipse(15.5, 12, 1.8, 2.4), 'stone', flat(0.1), { min: 3 });
  f.paint(M.union(M.line(12, 18, 15, 23, 2), M.line(17, 18, 15, 23, 2)), 'stone', flat(0.75));
  const halo = M.minus(M.ellipse(13, 3, 6, 1.6), M.ellipse(13, 3, 4, 0.4));
  f.paint(halo, 'stone', (x) => 0.9 - x / 30);
  // Weathering: moss and a dark tear streak.
  f.shift(M.line(16, 13, 16, 26), 2);
  for (const [x, y] of [[4, 47], [5, 47], [5, 46], [22, 47], [23, 46], [7, 37], [8, 37]]) P(f, x, y, 'moss2');
  return f.outline();
}

function sarcophagus() {
  const f = new Frame(36, 28);
  const lid = M.rect(1, 1, 34, 18);
  f.paint(lid, 'stone', bevel(lid, 0.55, 0.85, 0.3));
  // Effigy relief on the lid.
  const body = M.union(M.ellipse(8, 10, 3.5, 3.2), M.poly([[11, 6], [30, 7], [31, 13], [11, 14]]));
  f.paint(body, 'stone', sphere(14, 8, 18, 6, 0.1), { max: 3 });
  f.paint(M.line(15, 10, 25, 10), 'stone', flat(0.25));
  f.paint(M.ellipse(14, 10, 1.5, 1.5), 'gold', flat(0.6));
  const front = M.rect(1, 19, 34, 8);
  f.paint(front, 'stone', bevel(front, 0.25, 0.4, 0.08), { min: 2 });
  for (let x = 5; x < 33; x += 7) f.paint(M.rect(x, 21, 4, 4), 'stone', bevel(M.rect(x, 21, 4, 4), 0.15, 0.05, 0.45), { min: 2 });
  for (const [x, y] of [[2, 18], [3, 18], [33, 2], [32, 2], [4, 26]]) P(f, x, y, 'moss2');
  return f.outline();
}

function urn() {
  const f = new Frame(14, 18);
  const body = M.union(M.ellipse(7, 10, 5, 5.5), M.rect(4, 2, 6, 3));
  f.paint(body, 'wood', sphere(5.5, 8, 6, 7));
  f.paint(M.rect(3, 2, 8, 1), 'wood', flat(0.8));
  f.paint(M.rect(2, 9, 10, 1), 'gold', (x) => 1 - x / 12);
  return f.outline();
}

function bonepile() {
  const f = new Frame(22, 14);
  const bones = [[3, 10, 10, 8], [8, 11, 18, 9], [5, 7, 12, 11], [12, 7, 19, 12]];
  for (const [a, b, c, d] of bones) f.paint(M.line(a, b, c, d, 2), 'bone', (x, y) => 0.75 - (y - 6) * 0.08);
  f.paint(M.ellipse(14, 6, 3, 2.6), 'bone', sphere(13, 5, 3.5, 3.5));
  P(f, 13, 6, 'ink0'); P(f, 15, 6, 'ink0'); P(f, 14, 8, 'ink1');
  f.paint(M.ellipse(5, 6, 2, 1.8), 'bone', sphere(4, 5, 2.5, 2.5));
  P(f, 5, 6, 'ink0');
  return f.outline();
}

function candelabra(flick) {
  const f = new Frame(18, 34);
  f.paint(M.union(M.rect(8, 10, 2, 20), M.line(2, 10, 16, 10), M.line(3, 10, 3, 7), M.line(15, 10, 15, 7)), 'iron', cyl(8.5, 5), { min: 1 });
  f.paint(M.poly([[4, 33], [14, 33], [11, 29], [7, 29]]), 'iron', bevel(M.poly([[4, 33], [14, 33], [11, 29], [7, 29]]), 0.45, 0.85, 0.1));
  for (const [x, h] of [[3, 4], [8.5, 6], [15, 4]]) f.paint(M.rect(Math.round(x) - 1, 7 - h + (x === 8.5 ? 1 : 0) + 2, 2, h), 'bone', cyl(x - 0.5, 1.5));
  f.outline();
  for (const [x, y] of [[3, 3], [9, 0], [15, 3]]) { P(f, x - 1, y + flick, 'flame1'); P(f, x - 1, y + 1, 'flame0'); P(f, x - 1, y + 2, 'flame2'); P(f, x - 2, y + 2, 'flame3'); }
  return f;
}

function floorCandles(flick) {
  const f = new Frame(16, 14);
  for (const [x, y, h] of [[3, 13, 6], [7, 12, 8], [11, 13, 5], [13, 12, 3]]) {
    f.paint(M.rect(x, y - h, 2, h), 'bone', cyl(x + 0.3, 1.4));
    P(f, x + 1, y - h, 'bone3');
  }
  f.paint(M.ellipse(8, 13, 7, 1), 'bone', flat(0.3));
  f.outline();
  for (const [x, y] of [[3, 13 - 6], [7, 12 - 8], [11, 13 - 5], [13, 12 - 3]]) { P(f, x, y - 1, 'flame1'); P(f, x, y - 2 + (flick && x % 2 ? 1 : 0), 'flame0'); }
  return f;
}

function propsSheet() {
  return sheet('props', {
    column: [column()], statue: [statue()], sarcophagus: [sarcophagus()],
    urn: [urn()], bonepile: [bonepile()],
    candelabra: [candelabra(0), candelabra(1), candelabra(0), candelabra(-1)],
    candles: [floorCandles(0), floorCandles(1)],
  });
}

// ================================================================== fx ===

function bolt() {
  const f = new Frame(15, 7);
  f.paint(M.rect(3, 3, 8, 1), 'iron', flat(0.75), { dither: 0 });
  f.paint(M.rect(3, 4, 8, 1), 'iron', flat(0.35), { dither: 0 });
  for (const [x, y] of [[1, 2], [2, 2], [1, 5], [2, 5], [3, 2], [3, 5]]) P(f, x, y, 'crimson1');
  f.paint(M.poly([[11, 1.5], [14.5, 3.5], [11, 5.5]]), 'gold', (x) => (x > 12 ? 1 : 0.6));
  P(f, 14, 3, 'white');
  return f.outline();
}

function impact(i) { // 8-point burst for hits
  const f = new Frame(19, 19);
  const c = 9, R = [8, 7, 5, 3][i], col = ['white', 'holy1', 'gold0', 'gold1'][i];
  if (i < 3) {
    for (let a = 0; a < 8; a++) {
      const ang = a * Math.PI / 4, len = a % 2 ? R * 0.6 : R;
      for (let t = i; t <= len; t++) P(f, c + Math.round(Math.cos(ang) * t), c + Math.round(Math.sin(ang) * t), t < len * 0.5 ? 'white' : col);
    }
    f.paint(M.ellipse(c, c, 2 - i * 0.6, 2 - i * 0.6), 'holy', flat(1), { dither: 0 });
  } else for (let a = 0; a < 8; a++) P(f, c + Math.round(Math.cos(a) * 6), c + Math.round(Math.sin(a) * 6), 'gold1');
  return f;
}

function bloodBurst(i) { // radial splash, 4 frames
  const f = new Frame(34, 26);
  const cx = 17, cy = 14, k = (i + 1) / 4;
  for (let n = 0; n < 26; n++) {
    const a = hash(n, 1) * Math.PI * 2, d = (4 + hash(n, 2) * 12) * k, r = (1 - k * 0.6) * (1 + hash(n, 3) * 2);
    f.paint(M.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.65, r, r * 0.8), 'blood', flat(0.75 - hash(n, 4) * 0.5), { dither: 0 });
  }
  if (i < 2) f.paint(M.ellipse(cx, cy, 5 - i * 2, 4 - i * 1.5), 'blood', sphere(cx - 1, cy - 1, 5, 4), { max: 2 });
  if (i === 0) { P(f, cx - 1, cy - 2, 'white'); }
  return f;
}

function splat(v) { // floor stain decal
  const f = new Frame(30, 20);
  const cx = 15, cy = 10;
  const m = M.union(M.ellipse(cx, cy, 6 + v, 4), ...Array.from({ length: 9 }, (_, n) => {
    const a = hash(n, v, 5) * Math.PI * 2, d = 6 + hash(n, v, 6) * 7;
    return M.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 0.6 + hash(n, v, 7) * 1.6, 0.6 + hash(n, v, 8));
  }));
  f.paint(m, 'blood', (x, y) => 0.3 - Math.hypot(x - cx, (y - cy) * 1.6) / 30 + hash(x, y, v) * 0.15, { min: 2, max: 4 });
  f.paint(M.and(M.edge(m, 0, -1), M.ellipse(cx, cy, 6 + v, 4)), 'blood', flat(0.5), { min: 2 });
  return f;
}

function smoke(i) {
  const f = new Frame(18, 18);
  const r = [3, 5, 6.5, 7][i];
  for (const [dx, dy, s] of [[0, 0, 1], [-3, 2, 0.7], [3, 1, 0.8], [0, -3, 0.6]]) {
    const m = M.ellipse(9 + dx * (i + 1) / 3, 10 + dy * (i + 1) / 3, r * s, r * s * 0.85);
    f.paint(m, 'violet', sphere(7, 7, r * 1.6, r * 1.6, -0.25 - i * 0.12), { min: 2 });
  }
  if (i === 3) for (const k of M.ellipse(9, 10, 7, 6)) { const [x, y] = k.split(',').map(Number); if (bayer(x, y) < 0.5) f.set(x, y, -1); }
  return f;
}

function mound(i) {
  const f = new Frame(20, 13);
  const m = M.ellipse(10, 8, 5 + i * 1.5, 2.5 + i * 0.6);
  f.paint(m, 'shroud', sphere(8, 6, 8, 5));
  if (i >= 1) { P(f, 6, 7, 'stone2'); P(f, 13, 8, 'bone2'); P(f, 9, 9, 'stone3'); }
  if (i === 2) { f.paint(M.line(10, 7, 11, 2, 2), 'rot', sphere(10, 3, 3, 4)); P(f, 12, 1, 'bone1'); P(f, 10, 1, 'bone1'); }
  return f.outline();
}

function candleSprite(flick) {
  const f = new Frame(8, 15);
  f.paint(M.rect(2, 7, 4, 7), 'bone', cyl(3, 2.5));
  P(f, 2, 8, 'bone0'); P(f, 2, 9, 'bone1'); P(f, 3, 6, 'ink0');
  f.paint(M.rect(1, 13, 6, 2), 'iron', flat(0.4));
  f.outline();
  for (const [x, y, c] of [[3, 1 + flick, 'flame0'], [3, 2, 'flame0'], [4, 2 + flick, 'flame1'], [3, 3, 'flame1'], [4, 3, 'flame1'], [3, 4, 'flame2'], [4, 4, 'flame2'], [3, 5, 'flame3'], [2, 4, 'flame3']]) P(f, x, y, c);
  return f;
}

function gib(kind, warden = false) {
  const f = new Frame(10, 10);
  if (!warden) {
    if (kind === 0) { f.paint(M.ellipse(5, 5, 3, 2.8), 'rot', sphere(4, 4, 3.5, 3.5)); P(f, 5, 5, 'ink0'); P(f, 7, 5, 'ink0'); P(f, 5, 8, 'blood1'); P(f, 6, 8, 'blood2'); }
    if (kind === 1) { f.paint(M.line(1, 6, 7, 3, 2), 'rot', sphere(3, 3, 6, 4)); P(f, 8, 3, 'blood0'); P(f, 8, 4, 'blood1'); P(f, 1, 7, 'bone1'); }
    if (kind === 2) { f.paint(M.line(3, 1, 5, 8, 2), 'rot', sphere(3, 2, 4, 6)); P(f, 3, 1, 'blood0'); P(f, 4, 1, 'blood1'); P(f, 6, 8, 'bone2'); }
    if (kind === 3) { f.paint(M.ellipse(5, 5, 3.4, 2.6), 'shroud', sphere(4, 4, 4, 4)); for (const y of [4, 6]) { P(f, 4, y, 'bone1'); P(f, 6, y, 'bone2'); } P(f, 5, 5, 'blood1'); }
  } else {
    if (kind === 0) { f.paint(M.ellipse(5, 5, 3.4, 3.4), 'bone', sphere(4, 4, 4, 4)); P(f, 5, 5, 'ink0'); P(f, 7, 5, 'ink0'); f.paint(M.rect(2, 1, 7, 1), 'iron', flat(0.7)); }
    if (kind === 1) { const s = M.rect(2, 1, 6, 8); f.paint(s, 'iron', bevel(s, 0.45, 0.9, 0.1)); f.paint(M.union(M.rect(4, 2, 2, 6), M.rect(3, 4, 4, 1)), 'gold', flat(0.7)); }
    if (kind === 2) { f.paint(M.line(1, 2, 8, 7, 2), 'iron', sphere(3, 2, 6, 5)); P(f, 8, 7, 'blood1'); }
    if (kind === 3) { const s = M.rect(2, 2, 6, 6); f.paint(s, 'crimson', bevel(s, 0.45, 0.8, 0.15)); P(f, 4, 4, 'gold1'); P(f, 5, 4, 'gold2'); }
  }
  return f.outline();
}

function dagger() {
  const f = new Frame(9, 15);
  f.paint(M.rect(4, 1, 1, 7), 'iron', vgrad(1, 8, 1, 0.5), { dither: 0 });
  f.paint(M.rect(3, 2, 1, 6), 'iron', flat(0.4), { dither: 0 });
  P(f, 4, 0, 'white');
  f.paint(M.rect(1, 8, 7, 1), 'gold', (x) => 1 - x / 8);
  f.paint(M.rect(3, 9, 3, 3), 'wood', flat(0.5));
  P(f, 4, 12, 'gold0');
  return f.outline();
}

function thurible(i) {
  const f = new Frame(14, 17);
  for (let y = 0; y < 4; y++) P(f, 7 + (i && y < 2 ? 1 : 0), y, y % 2 ? 'iron2' : 'iron1');
  f.paint(M.rect(5, 4, 5, 1), 'gold', flat(0.8));
  const body = M.ellipse(7, 9, 4.4, 4);
  f.paint(body, 'gold', sphere(5.5, 7.5, 5, 5));
  f.paint(M.rect(3, 9, 9, 1), 'gold', flat(0.25));
  for (const [x, y] of [[5, 8], [7, 7], [9, 8], [7, 11]]) { P(f, x, y, i ? 'ember0' : 'ember1'); }
  f.paint(M.rect(5, 13, 5, 1), 'gold', flat(0.3));
  return f.outline();
}

function flask() {
  const f = new Frame(10, 12);
  f.paint(M.rect(4, 0, 2, 2), 'wood', flat(0.6));
  f.paint(M.rect(4, 2, 2, 2), 'holy', flat(0.75));
  f.paint(M.ellipse(4.5, 7, 3.4, 3.4), 'holy', sphere(3.5, 6, 4, 4), { min: 1 });
  P(f, 3, 6, 'white'); P(f, 2, 7, 'holy0');
  f.paint(M.rect(2, 7, 6, 1), 'gold', flat(0.6));
  return f.outline();
}

function chainLink(i) {
  const f = new Frame(6, 4);
  if (i === 0) f.paint(M.minus(M.rect(0, 0, 6, 4), M.rect(1, 1, 4, 2)), 'iron', vgrad(0, 3, 0.95, 0.25), { dither: 0 });
  else { f.paint(M.rect(0, 1, 6, 2), 'iron', vgrad(1, 2, 0.9, 0.4), { dither: 0 }); }
  return f;
}

function hook() {
  const f = new Frame(10, 10);
  f.paint(M.union(M.line(0, 4, 6, 4, 2), M.line(6, 1, 9, 4), M.line(6, 8, 9, 5)), 'iron', (x, y) => 0.95 - y * 0.08, { dither: 0 });
  P(f, 9, 4, 'white');
  return f.outline();
}

function scourge(i) {
  const f = new Frame(12, 28);
  for (let y = 0; y < 27; y++) {
    const x = 5 + Math.round(Math.sin(y * 0.55 + i) * 1.6);
    P(f, x, y, y < 6 ? 'blood3' : y < 18 ? 'blood1' : 'blood0'); P(f, x + 1, y, y < 6 ? 'blood4' : 'blood2');
    if (y % 4 === 2) P(f, x + 2, y, 'bone1');
    if (y % 4 === 0) P(f, x - 1, y, 'bone2');
  }
  return f.outline();
}

function fxSheet() {
  return sheet('fx', {
    bolt: [bolt()], impact: [0, 1, 2, 3].map(impact), burst: [0, 1, 2, 3].map(bloodBurst),
    splat: [0, 1, 2].map(splat), smoke: [0, 1, 2, 3].map(smoke), mound: [0, 1, 2].map(mound),
    candle: [candleSprite(0), candleSprite(1), candleSprite(0), candleSprite(-1)],
    gib: [0, 1, 2, 3].map((k) => gib(k)), wardenGib: [0, 1, 2, 3].map((k) => gib(k, true)),
    dagger: [dagger()], thurible: [thurible(0), thurible(1)], flask: [flask()],
    link: [chainLink(0), chainLink(1)], hook: [hook()], scourge: [scourge(0), scourge(2)],
  });
}

// ================================================================== HUD ===
// Bold black-on-white circular skill buttons (Otherworld Legends style).

function button(size, glyph) {
  const f = new Frame(size, size), c = (size - 1) / 2, r = size / 2 - 1;
  f.paint(M.ellipse(c, c, r, r), 'ink', flat(1));                    // black ring
  f.paint(M.ellipse(c, c, r - 2, r - 2), 'cloth', (x, y) => 1 - Math.max(0, (y - c) / r) * 0.6, { max: 1 }); // white disc
  f.paint(M.minus(M.ellipse(c, c, r - 3, r - 3), M.ellipse(c, c, r - 4, r - 4)), 'cloth', flat(0.3), { min: 2, max: 2 });
  const g = glyph(size, c);
  for (const k of g) { const [x, y] = k.split(',').map(Number); P(f, x, y, 'ink0'); }
  return f;
}
const G = {
  dash: (s, c) => { const u = s / 32; const m = []; for (const ox of [-7, 0, 7]) m.push(M.line(c + ox * u - 3 * u, c - 6 * u, c + ox * u + 3 * u, c, Math.max(2, Math.round(3 * u))), M.line(c + ox * u + 3 * u, c, c + ox * u - 3 * u, c + 6 * u, Math.max(2, Math.round(3 * u)))); return M.union(...m); },
  flask: (s, c) => { const u = s / 32; return M.minus(M.union(M.rect(Math.round(c - 2 * u), Math.round(c - 9 * u), Math.round(5 * u), Math.round(5 * u)), M.ellipse(c, c + 3 * u, 7 * u, 6.5 * u)), M.ellipse(c - 2 * u, c + 1 * u, 1.5 * u, 2 * u)); },
  chain: (s, c) => { const u = s / 32; const m = []; for (const d of [-6, 0, 6]) m.push(M.minus(M.ellipse(c + d * u, c + d * u, 4 * u, 4 * u), M.ellipse(c + d * u, c + d * u, 1.8 * u, 1.8 * u))); return M.union(...m); },
  penance: (s, c) => { const u = s / 32; const m = [M.minus(M.ellipse(c, c, 5 * u, 5 * u), M.ellipse(c, c + 0.5, 2 * u, 1.2 * u))]; for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; m.push(M.line(c + Math.cos(ang) * 7 * u, c + Math.sin(ang) * 7 * u, c + Math.cos(ang) * 10 * u, c + Math.sin(ang) * 10 * u, Math.max(2, Math.round(2 * u)))); } m.push(M.line(c, c + 5 * u, c, c + 8 * u, 1)); return M.union(...m); },
  dagger: (s, c) => { const u = s / 32; return M.union(M.poly([[c, c - 11 * u], [c + 3 * u, c - 7 * u], [c + 3 * u, c + 2 * u], [c - 3 * u, c + 2 * u], [c - 3 * u, c - 7 * u]]), M.rect(Math.round(c - 6 * u), Math.round(c + 2 * u), Math.round(12 * u), Math.round(2.5 * u)), M.rect(Math.round(c - 1.5 * u), Math.round(c + 4 * u), Math.round(3 * u), Math.round(6 * u))); },
  talk: (s, c) => { const u = s / 32; return M.minus(M.union(M.ellipse(c, c - 1 * u, 9 * u, 6.5 * u), M.poly([[c - 5 * u, c + 3 * u], [c - 1 * u, c + 4 * u], [c - 7 * u, c + 9 * u]])), M.ellipse(c - 4 * u, c - 1 * u, 1.2 * u, 1.2 * u), M.ellipse(c, c - 1 * u, 1.2 * u, 1.2 * u), M.ellipse(c + 4 * u, c - 1 * u, 1.2 * u, 1.2 * u)); },
  descend: (s, c) => { const u = s / 32; return M.union(M.rect(Math.round(c - 2 * u), Math.round(c - 9 * u), Math.round(4 * u), Math.round(9 * u)), M.poly([[c - 7 * u, c], [c + 7 * u, c], [c, c + 7 * u]]), M.rect(Math.round(c - 9 * u), Math.round(c + 8 * u), Math.round(18 * u), Math.round(2 * u))); },
  pause: (s, c) => { const u = s / 32; return M.union(M.rect(Math.round(c - 6 * u), Math.round(c - 7 * u), Math.round(4 * u), Math.round(14 * u)), M.rect(Math.round(c + 2 * u), Math.round(c - 7 * u), Math.round(4 * u), Math.round(14 * u))); },
};

function joyRing() {
  const f = new Frame(78, 78), c = 38.5;
  f.paint(M.minus(M.ellipse(c, c, 37, 37), M.ellipse(c, c, 35.5, 35.5)), 'cloth', flat(0.8), { dither: 0 });
  for (let a = 0; a < 4; a++) {
    const ang = a * Math.PI / 2, x = c + Math.cos(ang) * 31, y = c + Math.sin(ang) * 31;
    const px = -Math.sin(ang), py = Math.cos(ang);
    f.paint(M.union(M.line(x - px * 3 - Math.cos(ang) * 2, y - py * 3 - Math.sin(ang) * 2, x, y), M.line(x + px * 3 - Math.cos(ang) * 2, y + py * 3 - Math.sin(ang) * 2, x, y)), 'cloth', flat(0.8), { dither: 0 });
  }
  return f;
}
function joyKnob() {
  const f = new Frame(32, 32), c = 15.5;
  f.paint(M.ellipse(c, c, 14.5, 14.5), 'ink', flat(1));
  f.paint(M.ellipse(c, c, 12.6, 12.6), 'cloth', (x, y) => 1 - Math.max(0, y - c) / 24, { max: 1 });
  for (const k of M.union(M.rect(13, 6, 6, 20), M.rect(6, 13, 20, 6))) { const [x, y] = k.split(',').map(Number); P(f, x, y, 'ink0'); }
  for (const k of M.rect(15, 15, 2, 2)) { const [x, y] = k.split(',').map(Number); P(f, x, y, 'cloth0'); }
  return f;
}

function uiSheet() {
  // v5: 1.3x for the 360 px view.
  const big = 50, small = 40;
  return sheet('ui', {
    dash: [button(big, G.dash)], flask: [button(small, G.flask)], chain: [button(small, G.chain)], penance: [button(44, G.penance)],
    dagger: [button(small, G.dagger)], pause: [button(28, G.pause)], talk: [button(big, G.talk)], descend: [button(big, G.descend)], ring: [joyRing()], knob: [joyKnob()], portrait: [portrait()],
  });
}

// ================================================================ town ===
// Vael: warm cobbles, building fronts, townsfolk, lamps and the fountain.

function cobble(v) {
  const f = new Frame(16, 16);
  f.paint(M.rect(0, 0, 16, 16), 'sand', flat(0.05), { min: 3, max: 4 });
  const stones = [[3, 3, 3.2, 2.6], [11, 3, 3.6, 2.6], [7, 8, 3.4, 2.4], [1, 9, 2, 2.4], [14, 9, 2.4, 2.4], [3, 13.5, 3.4, 2.2], [11, 13.5, 3.6, 2.2]];
  stones.forEach(([cx, cy, rx, ry], i) => {
    const m = M.ellipse(cx + (hash(v, i, 1) - 0.5), cy, rx, ry);
    const tone = (hash(v, i, 2) - 0.5) * 0.25;
    f.paint(M.and(m, M.rect(0, 0, 16, 16)), 'sand', sphere(cx - 1, cy - 1, rx + 1.5, ry + 1.5, tone - 0.05), { min: 1, max: 4, dither: 0.4 });
  });
  if (v === 3) for (const [x, y] of [[7, 11], [8, 11], [6, 6]]) P(f, x, y, 'moss2');
  return f;
}

function plaster(f, m, seed) { f.paint(m, 'sand', (x, y) => 0.55 + (hash(x, y, seed) - 0.5) * 0.1, { min: 1, max: 3, dither: 0.3 }); }
function shingles(f, x0, y0, w, h, seed) {
  for (let row = 0; row * 3 < h; row++) for (let x = x0 - (row % 2) * 3; x < x0 + w; x += 6) {
    const m = M.and(M.rect(x, y0 + row * 3, 6, 3), M.rect(x0, y0, w, h));
    f.paint(m, 'roof', bevel(m, 0.45 + hash(x, row, seed) * 0.15, 0.75, 0.15), { min: 0 });
  }
}
function window_(f, x, y, w, h) {
  const m = M.rect(x, y, w, h);
  f.paint(m, 'ember', (px, py) => 0.95 - (py - y) / h * 0.5, { dither: 0.5 });
  f.paint(M.union(M.rect(x + Math.floor(w / 2), y, 1, h), M.rect(x, y + Math.floor(h / 2), w, 1)), 'wood', flat(0.3));
  f.paint(M.minus(M.rect(x - 1, y - 1, w + 2, h + 2), m), 'wood', flat(0.4));
  f.paint(M.rect(x - 2, y + h + 1, w + 4, 1), 'wood', flat(0.7));
}

function vestry() {
  const f = new Frame(112, 96);
  const wall = M.rect(10, 26, 92, 70);
  f.paint(wall, 'stone', (x, y) => bevel(wall, 0.55, 0.7, 0.3)(x, y) + (hash(x, y, 3) - 0.5) * 0.06, { dither: 0.3 });
  for (let y = 30; y < 96; y += 6) for (let x = 10 + ((y / 6) % 2) * 6; x < 102; x += 12) P(f, x, y, 'stone3');
  for (let x = 10; x < 102; x++) for (let y = 31; y < 96; y += 6) P(f, x, y, 'stone2h');
  // Gable and roof.
  const gable = M.poly([[6, 30], [56, 2], [106, 30]]);
  f.paint(gable, 'stone', sphere(40, 8, 60, 40), { min: 1 });
  f.paint(M.minus(M.poly([[2, 32], [56, 0], [110, 32], [104, 32], [56, 6], [8, 32]]), gable), 'gold', (x) => 1 - x / 112);
  // Buttresses.
  for (const bx of [4, 98]) { const b = M.rect(bx, 34, 10, 62); f.paint(b, 'stone', cyl(bx + 4, 6)); f.paint(M.poly([[bx, 34], [bx + 5, 26], [bx + 10, 34]]), 'stone', flat(0.6)); }
  // Rose window.
  const rose = M.ellipse(56, 22, 10, 10);
  f.paint(rose, 'violet', sphere(52, 18, 12, 12, 0.1));
  for (let a = 0; a < 8; a++) f.paint(M.line(56, 22, 56 + Math.cos(a * Math.PI / 4) * 10, 22 + Math.sin(a * Math.PI / 4) * 10), 'gold', flat(0.6), { dither: 0 });
  f.paint(M.minus(M.ellipse(56, 22, 11.5, 11.5), rose), 'gold', (x, y) => (y < 22 ? 0.9 : 0.4));
  f.paint(M.ellipse(56, 22, 3, 3), 'holy', flat(0.9));
  // Great door.
  const arch = M.union(M.rect(42, 62, 28, 34), M.ellipse(56, 62, 14, 12));
  f.paint(M.union(M.rect(39, 60, 34, 36), M.ellipse(56, 60, 17, 15)), 'gold', bevel(M.union(M.rect(39, 60, 34, 36), M.ellipse(56, 60, 17, 15)), 0.5, 0.95, 0.2));
  f.paint(arch, 'wood', (x, y) => 0.5 - (y - 50) / 60 + (x === 56 ? -0.4 : 0), { min: 1 });
  for (const hx of [50, 62]) f.paint(M.rect(hx, 72, 2, 18), 'iron', flat(0.4));
  f.paint(M.ellipse(56, 78, 1.5, 1.5), 'gold', flat(0.9));
  // Saint niches.
  for (const nx of [22, 82]) { f.paint(M.union(M.rect(nx, 48, 10, 20), M.ellipse(nx + 5, 48, 5, 4)), 'ink', vgrad(44, 68, 0.6, 0.2)); f.paint(M.union(M.ellipse(nx + 5, 52, 2.5, 2.8), M.poly([[nx + 2, 55], [nx + 8, 55], [nx + 9, 67], [nx + 1, 67]])), 'stone', cyl(nx + 4, 4, 0.1)); P(f, nx + 5, 46, 'gold0'); }
  return f.outline();
}

function forge() {
  const f = new Frame(88, 80);
  const wall = M.rect(4, 24, 80, 56);
  f.paint(wall, 'slate', (x, y) => bevel(wall, 0.45, 0.6, 0.25)(x, y) + (hash(x, y, 8) - 0.5) * 0.1, { dither: 0.4 });
  for (let y = 28; y < 80; y += 7) for (let x = 4; x < 84; x++) if ((x + (y / 7 | 0) * 5) % 13 === 0 || y % 7 === 0) P(f, x, y, 'slate3');
  shingles(f, 0, 10, 88, 16, 4);
  f.paint(M.rect(0, 25, 88, 2), 'wood', flat(0.4));
  // Chimney.
  f.paint(M.rect(64, 0, 12, 14), 'slate', cyl(69, 7));
  f.paint(M.rect(62, 0, 16, 2), 'slate', flat(0.8));
  // Open hearth glowing.
  const hearth = M.union(M.rect(24, 50, 40, 30), M.ellipse(44, 50, 20, 12));
  f.paint(M.union(M.rect(21, 48, 46, 32), M.ellipse(44, 48, 23, 15)), 'slate', bevel(M.union(M.rect(21, 48, 46, 32), M.ellipse(44, 48, 23, 15)), 0.3, 0.6, 0.1), { min: 1 });
  f.paint(hearth, 'ember', (x, y) => 0.25 + Math.max(0, 1 - Math.hypot(x - 44, (y - 74) * 1.6) / 30) * 0.8, { dither: 0.8 });
  for (let i = 0; i < 6; i++) f.paint(M.ellipse(32 + i * 5, 76 - (i % 2) * 2, 2.5, 1.5), 'ember', flat(1));
  // Hammer sign.
  f.paint(M.rect(8, 30, 14, 12), 'wood', bevel(M.rect(8, 30, 14, 12), 0.5, 0.8, 0.2));
  f.paint(M.union(M.rect(11, 33, 8, 3), M.rect(14, 36, 2, 5)), 'iron', flat(0.7));
  window_(f, 70, 34, 8, 10);
  return f.outline();
}

function stall() {
  const f = new Frame(72, 64);
  const back = M.rect(4, 14, 64, 50);
  plaster(f, back, 6);
  f.paint(M.union(M.rect(4, 14, 3, 50), M.rect(65, 14, 3, 50)), 'wood', cyl(5, 2));
  // Striped awning with a scalloped edge.
  for (let x = 0; x < 72; x++) for (let y = 4; y < 18; y++) {
    if (y >= 15 && (x % 8 < 2 || x % 8 > 5)) continue;
    const stripe = Math.floor(x / 8) % 2;
    f.paint(M.pts([[x, y]]), stripe ? 'cloth' : 'crimson', flat(0.85 - (y - 4) / 14 * 0.6), { max: stripe ? 2 : 4 });
  }
  // Shelves of relics.
  f.paint(M.rect(8, 30, 56, 2), 'wood', flat(0.6));
  for (let i = 0; i < 6; i++) { const x = 11 + i * 9; f.paint(M.rect(x, 23, 5, 7), i % 2 ? 'holy' : 'flame', (px, py) => 0.85 - (py - 23) / 10, { min: 1 }); f.paint(M.rect(x, 22, 5, 1), 'wood', flat(0.5)); }
  // Counter with bones and a skull.
  const counter = M.rect(6, 46, 60, 18);
  f.paint(counter, 'wood', bevel(counter, 0.42, 0.75, 0.15));
  for (let x = 8; x < 64; x += 8) f.shift(M.rect(x, 48, 1, 15), 1);
  f.paint(M.ellipse(20, 43, 3.4, 3), 'bone', sphere(19, 42, 4, 4)); P(f, 19, 43, 'ink0'); P(f, 21, 43, 'ink0');
  for (const [a, b, c, d] of [[30, 45, 40, 43], [34, 44, 44, 45], [48, 44, 56, 44]]) f.paint(M.line(a, b, c, d, 2), 'bone', flat(0.7));
  f.paint(M.rect(56, 40, 6, 6), 'gold', bevel(M.rect(56, 40, 6, 6), 0.6, 1, 0.3));
  return f.outline();
}

function tavern() {
  const f = new Frame(104, 84);
  const wall = M.rect(6, 26, 92, 58);
  plaster(f, wall, 9);
  const beams = M.union(M.rect(6, 26, 92, 3), M.rect(6, 52, 92, 3), ...[6, 30, 72, 95].map((x) => M.rect(x, 26, 3, 58)), M.line(9, 52, 30, 29, 2), M.line(72, 29, 95, 52, 2));
  f.paint(beams, 'wood', bevel(beams, 0.35, 0.6, 0.15), { min: 1 });
  shingles(f, 0, 6, 104, 22, 11);
  f.paint(M.rect(0, 26, 104, 1), 'roof', flat(0.1));
  window_(f, 14, 58, 12, 12); window_(f, 78, 58, 12, 12); window_(f, 40, 33, 10, 10); window_(f, 56, 33, 10, 10);
  // Door.
  const door = M.union(M.rect(44, 62, 16, 22), M.ellipse(52, 62, 8, 5));
  f.paint(door, 'wood', (x, y) => 0.45 - (y - 57) / 50 + (x === 52 ? -0.35 : 0), { min: 1 });
  f.paint(M.rect(56, 72, 2, 2), 'gold', flat(0.9));
  // Hanging sign: the Gilded Lamb.
  f.paint(M.rect(76, 42, 20, 1), 'iron', flat(0.5));
  const sign = M.rect(80, 44, 14, 10);
  f.paint(sign, 'wood', bevel(sign, 0.4, 0.7, 0.15));
  f.paint(M.union(M.ellipse(87, 48, 4, 2.5), M.ellipse(91, 47, 1.8, 1.6)), 'gold', sphere(86, 46, 5, 4, 0.1));
  for (const lx of [84, 86, 88, 90]) P(f, lx, 51, 'gold2');
  return f.outline();
}

function house(v) {
  const f = new Frame(48, 72);
  const wall = M.rect(2, 22, 44, 50);
  plaster(f, wall, 20 + v);
  const beams = M.union(M.rect(2, 22, 44, 2), M.rect(2, 46, 44, 2), M.rect(2, 22, 2, 50), M.rect(44, 22, 2, 50));
  f.paint(beams, 'wood', flat(0.35), { min: 1 });
  shingles(f, 0, 4, 48, 20, 30 + v);
  window_(f, 10, 28, 8, 10); window_(f, 30, 28, 8, 10);
  if (v === 0) { const d = M.rect(18, 54, 12, 18); f.paint(d, 'wood', flat(0.3)); }
  else { window_(f, 18, 54, 12, 8); f.paint(M.rect(16, 64, 16, 3), 'moss', flat(0.5)); for (const x of [18, 22, 27]) P(f, x, 63, 'crimson1'); }
  return f.outline();
}

function npc({ robe, robeMin = 0, head = 'bald', apron = null, hat = null, beard = false, prop = null }, i) {
  const f = new Frame(22, 34);
  const B = i ? 1 : 0;
  // Body.
  const body = M.poly([[6, 14 + B], [16, 14 + B], [18, 31], [4, 31]]);
  f.paint(body, robe, cyl(10.5, 7.5), { min: robeMin });
  f.shift(M.and(M.line(8, 18 + B, 7, 30), body), 1); f.shift(M.and(M.line(14, 18 + B, 15, 30), body), 1);
  if (apron) { const a = M.and(M.poly([[8, 18 + B], [14, 18 + B], [15, 30], [7, 30]]), body); f.paint(a, apron, cyl(11, 4)); }
  const st = arguments[0].step || [0, 0];
  f.paint(M.rect(5 + st[0], 31, 4, 2), 'shroud', flat(0.2)); f.paint(M.rect(13 + st[1], 31, 4, 2), 'shroud', flat(0.2));
  // Arms.
  f.paint(M.line(6, 16 + B, 5, 23 + B, 2), robe, flat(0.3), { min: robeMin });
  f.paint(M.line(16, 16 + B, 17, 23 + B, 2), robe, flat(0.55), { min: robeMin });
  f.paint(M.rect(4, 24 + B, 2, 2), 'skin', flat(0.6)); f.paint(M.rect(17, 24 + B, 2, 2), 'skin', flat(0.6));
  // Head.
  const hy = 9 + B;
  f.paint(M.ellipse(11, hy, 4.4, 4.4), 'skin', sphere(9.5, hy - 1.5, 5.5, 5.5));
  if (head === 'nun') {
    f.paint(M.minus(M.union(M.ellipse(11, hy - 1, 6, 6), M.rect(5, hy, 12, 7)), M.ellipse(12, hy + 1, 3.4, 3.6)), 'slate', sphere(9, hy - 3, 7, 7), { min: 2 });
    f.paint(M.minus(M.ellipse(12, hy + 1, 4.4, 4.6), M.ellipse(12, hy + 1, 3.4, 3.6)), 'cloth', flat(0.8));
  }
  if (head === 'tonsure') f.paint(M.and(M.minus(M.ellipse(11, hy, 4.6, 4.6), M.ellipse(11, hy - 2.5, 3, 2.2)), M.rect(0, 0, 22, hy + 1)), 'wood', flat(0.25));
  if (head === 'hair') f.paint(M.and(M.ellipse(10.5, hy - 1, 4.8, 4.4), M.rect(0, 0, 22, hy - 1)), 'shroud', sphere(9, hy - 4, 5, 4));
  if (hat) { f.paint(M.rect(4, hy - 4, 14, 2), hat, flat(0.4)); f.paint(M.rect(7, hy - 9, 8, 5), hat, cyl(10, 4)); P(f, 14, hy - 8, 'gold0'); }
  if (beard) f.paint(M.ellipse(12, hy + 4, 3.4, 2.4), 'shroud', sphere(11, hy + 3, 4, 3));
  // Face: eyes and a mouth.
  P(f, 12, hy, 'ink0'); P(f, 14, hy, 'ink0');
  if (!beard) P(f, 13, hy + 2, 'skin3');
  if (prop === 'hammer') { f.paint(M.line(18, 22 + B, 18, 14 + B), 'wood', flat(0.5)); f.paint(M.rect(16, 11 + B, 5, 3), 'iron', bevel(M.rect(16, 11 + B, 5, 3), 0.5, 0.9, 0.2)); }
  if (prop === 'bell') { f.paint(M.line(17, 24 + B, 18, 18 + B), 'wood', flat(0.5)); f.paint(M.union(M.ellipse(18.5, 17 + B, 2.6, 2.4), M.rect(16, 18 + B, 6, 1)), 'gold', sphere(17.5, 16 + B, 3, 3)); }
  if (prop === 'spear') { f.paint(M.line(18, 30, 18, 2 + B), 'wood', flat(0.5)); f.paint(M.poly([[17, 3 + B], [19, 3 + B], [18, -1 + B]]), 'iron', flat(0.9)); }
  if (prop === 'whip') { for (let k = 0; k < 6; k++) P(f, 18 + k, 24 + B + Math.round(Math.sin(k + i) * 1.5), 'blood1'); P(f, 9, 18 + B, 'blood1'); P(f, 12, 20 + B, 'blood2'); }
  if (prop === 'mug') f.paint(M.rect(17, 21 + B, 3, 4), 'wood', bevel(M.rect(17, 21 + B, 3, 4), 0.5, 0.9, 0.2));
  if (prop === 'rosary') for (let y = 17; y < 26; y += 2) P(f, 11, y + B, y === 25 ? 'gold0' : 'bone1');
  return f.outline();
}

const NPCS = {
  odile: { robe: 'slate', robeMin: 1, head: 'nun', prop: 'rosary' },
  hollis: { robe: 'shroud', apron: 'wood', head: 'bald', beard: true, prop: 'hammer' },
  pell: { robe: 'wood', robeMin: 1, head: 'tonsure', prop: 'rosary' },
  barkeep: { robe: 'crimson', robeMin: 1, apron: 'cloth', head: 'hair', prop: 'mug' },
  crier: { robe: 'crimson', head: 'hair', hat: 'ink', prop: 'bell' },
};

function lamp(flick) {
  const f = new Frame(14, 46);
  f.paint(M.rect(6, 12, 2, 32), 'iron', cyl(6.5, 2));
  f.paint(M.rect(3, 42, 8, 3), 'iron', bevel(M.rect(3, 42, 8, 3), 0.4, 0.8, 0.1));
  f.paint(M.poly([[3, 4], [11, 4], [10, 12], [4, 12]]), 'iron', flat(0.35), { min: 1 });
  f.paint(M.rect(4, 5, 6, 6), 'ember', (x, y) => 1 - (y - 5) / 8 - (flick ? 0.1 : 0), { dither: 0.3 });
  f.paint(M.poly([[2, 4], [7, 0], [12, 4]]), 'iron', flat(0.5));
  return f.outline();
}

function fountain(i) {
  const f = new Frame(60, 50);
  const basin = M.ellipse(30, 38, 28, 10);
  f.paint(basin, 'stone', sphere(24, 32, 34, 14), { dither: 0.3 });
  const water = M.ellipse(30, 36, 24, 7);
  f.paint(water, 'holy', (x, y) => 0.55 + Math.sin(x * 0.5 + y + i * 2) * 0.12, { min: 1, max: 3, dither: 0.6 });
  f.paint(M.minus(M.ellipse(30, 36, 25, 8), water), 'stone', flat(0.8));
  // Central pillar and a small saint.
  f.paint(M.rect(27, 14, 6, 22), 'stone', cyl(29, 4));
  f.paint(M.poly([[26, 6], [34, 6], [35, 15], [25, 15]]), 'stone', cyl(29, 6, 0.05));
  f.paint(M.ellipse(30, 4, 2.6, 2.6), 'stone', sphere(29, 3, 3, 3));
  f.paint(M.minus(M.ellipse(30, 0.5, 4, 1.2), M.ellipse(30, 0.5, 2.5, 0.3)), 'gold', flat(0.8));
  for (const [x, y] of [[24, 18 + i], [36, 18 + (1 - i)], [22, 26], [38, 27]]) P(f, x, y, 'holy1');
  return f.outline();
}

function barrel() {
  const f = new Frame(14, 18);
  const m = M.union(M.ellipse(7, 9, 6, 8), M.rect(1, 3, 12, 12));
  f.paint(M.and(m, M.rect(1, 1, 12, 16)), 'wood', cyl(6, 6.5));
  for (const y of [4, 13]) f.paint(M.and(M.rect(0, y, 14, 1), m), 'iron', cyl(6, 6.5));
  f.paint(M.ellipse(7, 2, 5.5, 1.5), 'wood', flat(0.7));
  return f.outline();
}
function crate() {
  const f = new Frame(16, 16);
  const m = M.rect(1, 2, 14, 13);
  f.paint(m, 'wood', bevel(m, 0.45, 0.8, 0.15));
  f.paint(M.union(M.line(2, 3, 13, 13), M.rect(1, 2, 14, 2)), 'wood', flat(0.65));
  return f.outline();
}
function anvil() {
  const f = new Frame(20, 14);
  const m = M.union(M.poly([[1, 2], [18, 2], [15, 6], [5, 6]]), M.rect(7, 6, 6, 5), M.rect(4, 11, 12, 2));
  f.paint(m, 'iron', bevel(m, 0.4, 0.95, 0.1), { min: 1 });
  return f.outline();
}

function waystone(i) {
  const f = new Frame(28, 40);
  const m = M.poly([[8, 38], [20, 38], [22, 12], [16, 2], [9, 5], [6, 14]]);
  f.paint(m, 'slate', cyl(13, 9), { dither: 0.4 });
  f.paint(M.ellipse(14, 38, 11, 2), 'slate', flat(0.2));
  const glowT = [0.55, 0.75, 1, 0.75][i];
  for (const [x, y] of [[13, 10], [14, 11], [13, 12], [12, 16], [13, 17], [14, 17], [15, 16], [13, 22], [13, 23], [12, 24], [14, 24], [13, 29], [14, 30], [13, 31]]) f.paint(M.pts([[x, y]]), 'holy', flat(glowT), { dither: 0 });
  return f.outline();
}

function townSheet() {
  return sheet('town', {
    cobble: [0, 1, 2, 3].map(cobble),
    vestry: [vestry()], forge: [forge()], stall: [stall()], tavern: [tavern()], house: [house(0), house(1)],
    ...Object.fromEntries(Object.entries(NPCS).map(([k, v]) => [k, [npc(v, 0), npc(v, 1)]])),
    lamp: [lamp(0), lamp(1)], fountain: [fountain(0), fountain(1)], barrel: [barrel()], crate: [crate()], anvil: [anvil()],
    waystone: [0, 1, 2, 3].map(waystone),
  });
}

// ============================================================= monsters ===
// A parametric fiend builder: body + head + weapon + extras, scaled per tier,
// plus a few bespoke creatures. Each gets walk (4) and attack (2) frames.

function fiend(spec, pose = {}) {
  const s = spec.scale || 1;
  const ST = 1.3; // vertical stretch below the head
  const W = Math.ceil(32 * s) + 4, Hh = Math.ceil((12 + 24 * ST) * s) + 6;
  const f = new Frame(W, Hh);
  const ox = 2 + 3 * s, oy = 2;
  const B = (pose.bob || 0) + (spec.legs === 'float' ? Math.round(Math.sin((pose.t || 0) * Math.PI / 2) * 1.5) : 0);
  const lx = pose.lean || 0, arm = pose.arm || 0;
  const X = (v) => ox + v * s, Y = (v) => oy + (v <= 12 ? v : 12 + (v - 12) * ST) * s;
  const E = (cx, cy, rx, ry) => M.ellipse(X(cx), Y(cy), rx * s, ry * s * (cy > 12 ? ST : 1));
  const L = (a, b, c, d, t = 2) => M.line(X(a), Y(b), X(c), Y(d), Math.max(1, Math.round(t * s)));
  const Pg = (pts) => M.poly(pts.map(([a, b]) => [X(a), Y(b)]));
  const sph = (cx, cy, rx, ry, bias = 0) => sphere(X(cx), Y(cy), rx * s, ry * s, bias);
  const cy_ = (cx, rx, bias = 0) => cyl(X(cx), rx * s, bias);
  const R = spec.ramp || 'shroud', HR = spec.headRamp || 'bone';
  const ex = new Set(spec.extras || []);

  // Wings behind everything.
  if (ex.has('wings')) {
    const flap = pose.t % 2 ? -2 : 0;
    for (const side of [-1, 1]) {
      const wx = 13 + side * 2;
      const wing = Pg([[wx, 12 + B], [wx + side * 15, 2 + B + flap], [wx + side * 17, 12 + B + flap], [wx + side * 12, 20 + B], [wx + side * 4, 20 + B]]);
      f.paint(wing, spec.wingRamp || 'cloth', sph(wx + side * 6, 6, 14, 14, side < 0 ? -0.15 : 0), { min: side < 0 ? 1 : 0 });
      for (let k = 1; k < 4; k++) f.shift(M.and(L(wx, 13 + B, wx + side * (4 + k * 4), 4 + k * 3 + B + flap, 1), wing), 1);
    }
  }
  if (ex.has('spikes')) for (const [a, b] of [[8, 10], [6, 14], [7, 18]]) f.paint(L(a + 2, b + B + 2, a - 3, b + B - 3, 2), 'bone', flat(0.7));
  if (ex.has('tentacles')) for (const k of [0, 1, 2]) f.paint(L(9 + k * 4, 24 + B, 6 + k * 6 + (pose.t % 2 ? 1 : -1), 31, 2), 'rot', flat(0.35 + k * 0.1));

  // Legs.
  if (spec.legs !== 'robe' && spec.legs !== 'float' && spec.legs !== 'none') {
    const lg = spec.legRamp || 'rot', l = pose.legs || [0, 0];
    for (const [hx, li, side] of [[11, l[0], -0.2], [16, l[1], 0]]) {
      f.paint(M.union(L(hx, 21 + B, hx - 0.5 + li, 26), L(hx - 0.5 + li, 26, hx + li, 30)), lg, cy_(hx + li * 0.5, 2, side), { min: 1 });
      f.paint(M.rect(Math.round(X(hx - 1 + li)), Math.round(Y(30)), Math.round(3 * s), Math.max(1, Math.round(s))), 'shroud', flat(0.2));
    }
  }
  // Back arm.
  f.paint(L(10 + lx, 14 + B, 6 + lx, 20 + B - arm * 3, 2), spec.armRamp || R, flat(0.25), { min: 2 });

  // Body.
  const body = spec.body || 'robe';
  let torso;
  if (body === 'robe' || body === 'float') {
    const bottom = spec.legs === 'float' ? 27 : 30;
    torso = Pg([[9 + lx, 13 + B], [18 + lx, 13 + B], [21, bottom], [17, bottom - 2], [13, bottom + 1], [9, bottom - 2], [5, bottom]]);
    f.paint(torso, R, cy_(13.5 + lx * 0.5, 8));
    for (const fx of [10, 16]) f.shift(M.and(L(fx + lx, 18 + B, fx, bottom - 1, 1), torso), 1);
    if (spec.legs === 'float') f.paint(Pg([[9, 26], [17, 26], [13, 34]]), R, flat(0.15), { min: 2 });
  } else if (body === 'fat') {
    torso = E(13.5, 19 + B, 8.5, 8);
    f.paint(torso, R, sph(11, 15 + B, 10, 10));
    f.paint(E(14.5, 21 + B, 4, 3.5), spec.bellyRamp || 'rot', sph(13.5, 20 + B, 5, 5));
    for (const y of [18, 21, 24]) f.paint(M.pts([[X(14), Y(y + B)], [X(15), Y(y + B + 1)]]), 'ink', flat(0.6));
  } else if (body === 'armor') {
    torso = M.union(E(13.5, 17 + B, 6.5, 6), Pg([[9, 20 + B], [18, 20 + B], [19, 28 + B], [8, 28 + B]]));
    f.paint(torso, R, sph(11.5, 14 + B, 8, 8));
    f.paint(M.and(Pg([[11, 21 + B], [16, 21 + B], [17, 29 + B], [10, 29 + B]]), torso), spec.tabard || 'crimson', cy_(13.5, 3));
    f.paint(M.and(M.edge(E(13.5, 17 + B, 6.5, 6), 0, 1), torso), 'gold', flat(0.5));
    f.paint(E(8.5, 14 + B, 3.5, 3), R, sph(7.5, 13 + B, 4, 4));
  } else if (body === 'skeleton') {
    f.paint(L(13.5 + lx * 0.5, 13 + B, 13.5, 22 + B, 1), 'bone', flat(0.5));
    for (let i = 0; i < 4; i++) f.paint(M.union(L(13.5, 14 + i * 2 + B, 10 + i * 0.3, 15 + i * 2 + B, 1), L(13.5, 14 + i * 2 + B, 17 - i * 0.3, 15 + i * 2 + B, 1)), 'bone', flat(0.75 - i * 0.1), { dither: 0 });
    f.paint(E(13.5, 22.5 + B, 3.5, 1.6), 'bone', sph(12.5, 22 + B, 4, 2));
    torso = E(13.5, 18 + B, 4, 5);
    if (spec.robeOver) { const r = Pg([[10, 19 + B], [17, 19 + B], [20, 30], [7, 30]]); f.paint(r, R, cy_(13.5, 7)); }
  } else if (body === 'torso') {
    torso = E(13 + lx * 0.4, 17 + B, 5.5, 5.5);
    f.paint(torso, R, sph(11, 14 + B, 7, 7));
  }
  if (ex.has('chains')) for (const [a, b] of [[9, 16], [17, 18]]) for (let k = 0; k < 5; k++) P(f, X(a + k * 0.4), Y(b + k * 1.5 + B), k % 2 ? 'iron1' : 'iron3');
  if (ex.has('wound')) { P(f, X(11), Y(16 + B), 'blood2'); P(f, X(12), Y(16 + B), 'blood1'); P(f, X(11), Y(17 + B), 'blood3'); }

  // Head.
  const hx = 14 + lx + (spec.hunch || 0), hy = 8 + B + (spec.hunch ? 2 : 0), hk = spec.head || 'skull';
  const eyes = [];
  if (hk === 'skull' || hk === 'mitre' || hk === 'crown') {
    f.paint(E(hx, hy, 4.4, 4.4), HR, sph(hx - 1.5, hy - 1.5, 5, 5));
    f.paint(E(hx + 1, hy + 0.5, 1.2, 1.3), 'ink', flat(1)); f.paint(E(hx + 3.2, hy + 0.5, 1, 1.3), 'ink', flat(1));
    for (let k = 0; k < 4; k++) P(f, X(hx + k), Y(hy + 3.6), k % 2 ? 'ink1' : 'bone0');
    eyes.push([hx + 1, hy + 0.5], [hx + 3.2, hy + 0.5]);
    if (hk === 'mitre') { const m = Pg([[hx - 4, hy - 3], [hx + 4, hy - 3], [hx + 3, hy - 11], [hx, hy - 13], [hx - 3, hy - 11]]); f.paint(m, 'cloth', cy_(hx, 4)); f.paint(M.and(M.union(L(hx, hy - 12, hx, hy - 3, 1), L(hx - 3, hy - 8, hx + 3, hy - 8, 1)), m), 'gold', flat(0.7)); }
    if (hk === 'crown') f.paint(M.union(M.rect(Math.round(X(hx - 5)), Math.round(Y(hy - 4)), Math.round(10 * s), Math.max(2, Math.round(2 * s))), ...[-4, -1, 2, 5].map((d) => L(hx + d - 0.5, hy - 4, hx + d - 0.5, hy - 7, 1))), spec.crownRamp || 'gold', vgrad(Y(hy - 7), Y(hy - 2), 0.95, 0.3));
  } else if (hk === 'rot' || hk === 'horned') {
    f.paint(E(hx, hy, 4, 3.8), 'rot', sph(hx - 1.5, hy - 1.5, 5, 5));
    f.paint(E(hx + 1.5, hy + 3.4, 2.2, 1.2), 'bone', flat(0.6));
    eyes.push([hx + 0.5, hy], [hx + 2.5, hy]);
    if (hk === 'horned') for (const d of [-1, 1]) f.paint(L(hx + d * 2, hy - 3, hx + d * 4.5, hy - 8, 2), 'bone', (x, y) => 0.9 - (Y(hy) - y) * 0.02);
  } else if (hk === 'hood' || hk === 'sack') {
    const hood = M.union(E(hx, hy, 5, 5), Pg([[hx - 4, hy - 1], [hx - 2, hy - 7], [hx + 1, hy - 4]]));
    f.paint(hood, spec.hoodRamp || R, sph(hx - 2, hy - 2, 6, 6));
    if (hk === 'hood') { f.paint(E(hx + 2, hy + 1, 2.4, 2.8), 'ink', flat(1)); eyes.push([hx + 1.2, hy + 0.5], [hx + 3, hy + 0.5]); }
    else { for (const [a, b] of [[hx + 1, hy - 1], [hx + 3, hy - 1]]) eyes.push([a, b]); f.paint(L(hx - 1, hy + 2, hx + 4, hy + 3, 1), 'ink', flat(0.8)); }
  } else if (hk === 'helm') {
    const hm = E(hx, hy, 4.6, 4.6);
    f.paint(hm, spec.helmRamp || 'iron', sph(hx - 1.5, hy - 2, 5.5, 5.5));
    f.paint(M.rect(Math.round(X(hx - 1)), Math.round(Y(hy)), Math.round(6 * s), Math.max(1, Math.round(s))), 'ink', flat(1));
    eyes.push([hx + 1, hy], [hx + 3, hy]);
    if (ex.has('plume')) f.paint(L(hx - 2, hy - 4, hx - 6, hy - 9, 2), 'crimson', flat(0.7));
  } else if (hk === 'candle') {
    f.paint(M.rect(Math.round(X(hx - 3)), Math.round(Y(hy - 6)), Math.round(7 * s), Math.round(10 * s)), 'bone', cy_(hx, 3.5));
    for (const d of [-2, 0, 2]) f.paint(L(hx + d, hy - 5, hx + d, hy - 3 + Math.abs(d), 1), 'bone', flat(1), { dither: 0 });
    f.paint(E(hx + 1.5, hy + 0.5, 1.6, 2), 'ink', flat(1));
    eyes.push([hx + 1.5, hy + 0.5]);
  } else if (hk === 'mask') {
    f.paint(E(hx, hy, 4.4, 4.8), spec.maskRamp || 'cloth', sph(hx - 1.5, hy - 2, 5.5, 5.5), { max: 2 });
    for (const ee of [[hx + 0.5, hy], [hx + 3, hy]]) { f.paint(E(ee[0], ee[1], 0.9, 1.1), 'ink', flat(1)); f.paint(L(ee[0], ee[1] + 1, ee[0] - 0.3, ee[1] + 4, 1), 'ink', flat(0.6)); eyes.push(ee); }
    f.paint(E(hx + 1.8, hy + 3, 1.3, 0.9), 'ink', flat(1));
  } else if (hk === 'cherub') {
    f.paint(E(hx, hy, 4.4, 4.4), spec.headRamp || 'skin', sph(hx - 1.5, hy - 1.5, 5, 5));
    for (const ee of [[hx + 0.5, hy], [hx + 3, hy]]) { P(f, X(ee[0]), Y(ee[1]), 'ink0'); f.paint(L(ee[0], ee[1] + 1, ee[0], ee[1] + 4, 1), 'holy', flat(0.7), { dither: 0 }); }
  } else if (hk === 'eye') {
    f.paint(E(hx, hy, 4.6, 4.6), 'rot', sph(hx - 1.5, hy - 1.5, 5.5, 5.5));
    f.paint(E(hx + 1, hy, 2.6, 2.4), 'bone', flat(0.85)); f.paint(E(hx + 1.6, hy, 1.2, 1.4), 'blood', flat(0.4));
  }
  if (ex.has('halo')) { const r = M.minus(E(hx, hy - 7, 5.5, 1.8), E(hx, hy - 7, 3.6, 0.6)); f.paint(r, 'gold', (x) => 1 - (x - X(hx - 6)) / (12 * s)); }
  if (ex.has('candles')) for (const [a, b] of [[8, 11], [19, 11]]) { f.paint(M.rect(Math.round(X(a)), Math.round(Y(b + B)), Math.max(2, Math.round(2 * s)), Math.round(4 * s)), 'bone', flat(0.75)); }

  // Front arm and weapon.
  const ax = 18 + lx + (pose.reach || 0), ay = 18 + B - arm * 4;
  f.paint(L(15 + lx, 14 + B, ax, ay, 2), spec.armRamp || R, sph(14 + lx, 13 + B, 6, 6));
  const wpn = spec.weapon;
  const wa = pose.swing || 0; // 0 rest, 1 raised, 2 struck
  if (wpn === 'claws') { P(f, X(ax + 1), Y(ay - 1), 'bone1'); P(f, X(ax + 2), Y(ay), 'bone1'); P(f, X(ax + 1), Y(ay + 1), 'bone2'); }
  if (wpn === 'sword') { const tip = wa === 1 ? [ax - 3, ay - 14] : wa === 2 ? [ax + 13, ay + 4] : [ax + 3, ay - 12]; f.paint(L(ax, ay, tip[0], tip[1], 2), 'iron', flat(0.85), { dither: 0 }); f.paint(L(ax - 2, ay, ax + 2, ay, 1), 'gold', flat(0.7)); }
  if (wpn === 'scythe') { const top = [ax + 1, ay - 14 + (wa === 2 ? 8 : 0)]; f.paint(L(ax, ay + 6, top[0], top[1], 1), 'wood', flat(0.5)); f.paint(M.union(L(top[0], top[1], top[0] + 8, top[1] + 3, 2), L(top[0] + 8, top[1] + 3, top[0] + 9, top[1] + 6, 1)), 'iron', flat(0.85)); }
  if (wpn === 'censer') { const cx2 = ax + (wa === 2 ? 8 : 3), cy2 = ay + (wa === 1 ? -6 : 6); f.paint(L(ax, ay, cx2, cy2, 1), 'iron', flat(0.5)); f.paint(E(cx2, cy2 + 2, 2.6, 2.6), 'gold', sph(cx2 - 1, cy2 + 1, 3, 3)); P(f, X(cx2), Y(cy2 + 2), 'ember0'); }
  if (wpn === 'whip') { const pts = []; for (let k = 0; k < 10; k++) pts.push([ax + k * (wa === 2 ? 1.6 : 0.8), ay + Math.sin(k * 0.8 + (pose.t || 0)) * 2 + (wa === 1 ? -k : k * 0.5)]); f.paint(M.union(...pts.slice(1).map((p2, k) => L(pts[k][0], pts[k][1], p2[0], p2[1], 1))), 'blood', flat(0.55), { dither: 0 }); }
  if (wpn === 'staff') { f.paint(L(ax, ay + 8, ax + 1, ay - 12, 1), 'wood', flat(0.5)); f.paint(E(ax + 1, ay - 13, 2, 2), spec.orbRamp || 'flame', flat(0.95)); }
  if (wpn === 'shovel') { const t2 = wa === 2 ? [ax + 9, ay + 6] : [ax + 2, ay - 12]; f.paint(L(ax - 1, ay + 4, t2[0], t2[1], 1), 'wood', flat(0.5)); f.paint(E(t2[0], t2[1], 2.4, 3), 'iron', sph(t2[0] - 1, t2[1] - 1, 3, 3)); }
  if (wpn === 'lantern') { f.paint(L(ax, ay, ax + 1, ay + 4, 1), 'iron', flat(0.5)); f.paint(M.rect(Math.round(X(ax - 1)), Math.round(Y(ay + 4)), Math.max(3, Math.round(4 * s)), Math.max(4, Math.round(5 * s))), 'ember', flat(0.95)); }
  if (wpn === 'bell') { f.paint(L(ax, ay, ax + 1, ay - 3, 1), 'wood', flat(0.5)); f.paint(M.union(E(ax + 2, ay - 6, 3, 3), M.rect(Math.round(X(ax - 1.5)), Math.round(Y(ay - 4)), Math.round(7 * s), Math.max(1, Math.round(s)))), 'gold', sph(ax + 1, ay - 7, 3.5, 3.5)); }
  if (wpn === 'chain') { for (let k = 0; k < 6; k++) P(f, X(ax + k * 1.5), Y(ay + Math.sin(k) + (wa === 2 ? 0 : k * 0.8)), k % 2 ? 'iron0' : 'iron2'); f.paint(L(ax + 9, ay + 1, ax + 11, ay + 4, 1), 'iron', flat(0.9)); }
  if (wpn === 'shield') { const sx = ax - 1, sy = ay - 10; const sh = M.rect(Math.round(X(sx)), Math.round(Y(sy)), Math.round(7 * s), Math.round(15 * s)); f.paint(sh, 'iron', bevel(sh, 0.45, 0.9, 0.1)); f.paint(M.union(M.rect(Math.round(X(sx + 3)), Math.round(Y(sy + 2)), Math.max(1, Math.round(s)), Math.round(10 * s)), M.rect(Math.round(X(sx + 1)), Math.round(Y(sy + 5)), Math.round(5 * s), Math.max(1, Math.round(s)))), 'gold', flat(0.8)); }
  f.outline();
  // Glowing eyes and lit flames after the outline.
  const eye = spec.eye || 'flame';
  for (const [a, b] of eyes) { P(f, X(a), Y(b), `${eye}0`); if (s > 1.2) P(f, X(a) + 1, Y(b), `${eye}1`); }
  if (hk === 'candle') for (const [a, b, c] of [[hx, hy - 8, 'flame0'], [hx, hy - 9, 'flame1'], [hx + 1, hy - 8, 'flame2'], [hx, hy - 7, 'flame2']]) P(f, X(a), Y(b), spec.flame ? c.replace('flame', spec.flame) : c);
  if (ex.has('candles')) for (const [a, b] of [[8, 10], [19, 10]]) { P(f, X(a) + 1, Y(b + B), 'flame0'); P(f, X(a) + 1, Y(b + B) - 1, 'flame1'); }
  f.ax = Math.round(X(13)); f.ay = Math.round(Y(30));
  return f;
}

function fiendSet(spec) {
  const walk = [0, 1, 2, 3].map((t) => fiend(spec, { t, bob: t % 2, legs: [[-1, 1], [0, 0], [1, -1], [0, 0]][t], arm: t === 1 ? 0.3 : t === 3 ? -0.3 : 0 }));
  const attack = [fiend(spec, { t: 0, lean: -1, arm: 1.2, swing: 1, reach: -2 }), fiend(spec, { t: 1, lean: 2, arm: -0.3, swing: 2, reach: 3, bob: 1 })];
  return { walk, attack };
}

// Bespoke creatures.
function crawler(t, atk = 0) {
  const f = new Frame(30, 20), B = t % 2;
  const body = M.union(M.ellipse(12, 13 + B * 0.5, 7, 4.5), M.poly([[4, 14], [7, 10], [8, 17]]));
  f.paint(body, 'rot', sphere(10, 10, 9, 6));
  f.paint(M.poly([[3, 15], [7, 12], [9, 18], [5, 18]]), 'blood', flat(0.3), { min: 2 });
  for (const [a, k] of [[17, -1], [20, 1]]) { const reach = atk ? 6 : (t + (k > 0 ? 2 : 0)) % 4 < 2 ? 2 : 0; f.paint(M.line(a - 2, 12, a + 3 + reach, 16 - k, 2), 'rot', flat(0.5)); P(f, a + 4 + reach, 16 - k, 'bone1'); }
  const h = M.ellipse(21 + atk * 2, 9, 3.6, 3.4); f.paint(h, 'rot', sphere(20, 8, 4.5, 4.5));
  P(f, 22 + atk * 2, 9, 'ink0'); P(f, 24 + atk * 2, 9, 'ink0'); f.paint(M.rect(22 + atk * 2, 11, 3, 1), 'bone', flat(0.7));
  f.outline(); P(f, 22 + atk * 2, 9, 'flame0'); P(f, 24 + atk * 2, 9, 'flame1');
  f.ax = 13; f.ay = 18; return f;
}
function rat(t, atk = 0) {
  const f = new Frame(16, 10);
  f.paint(M.ellipse(7, 6, 4.4, 2.6), 'shroud', sphere(6, 5, 5, 3.5));
  f.paint(M.ellipse(11.5 + atk, 6, 2.2, 1.8), 'shroud', sphere(11, 5, 2.6, 2.6));
  P(f, 12 + atk, 5, 'blood0'); P(f, 14 + atk, 6, 'skin1');
  f.paint(M.line(2, 6, 0, 4 + (t % 2) * 2), 'skin', flat(0.4), { dither: 0 });
  for (const [a, d] of [[5, t % 2], [9, 1 - (t % 2)]]) { P(f, a - d, 9, 'ink1'); P(f, a + d, 9, 'ink1'); }
  f.outline(); P(f, 12 + atk, 5, 'blood0');
  f.ax = 7; f.ay = 9; return f;
}
function votary(t, atk = 0) {
  const sw = atk ? 1.5 : 0;
  const f = new Frame(30, 34), B = t % 2;
  for (const [hx, l] of [[11, t === 0 ? -1 : t === 2 ? 1 : 0], [17, t === 0 ? 1 : t === 2 ? -1 : 0]]) f.paint(M.line(hx, 25, hx + l, 31, 3), 'rot', cyl(hx, 2), { min: 1 });
  const belly = M.ellipse(14, 18 + B * 0.5, 9 + sw, 9 + sw);
  f.paint(belly, 'rot', sphere(11, 14, 11, 11));
  f.paint(M.ellipse(15, 20, 5 + sw, 4 + sw), atk ? 'blood' : 'moss', sphere(14, 19, 6, 6, atk ? 0.15 : 0));
  for (let y = 15; y < 26; y += 3) { P(f, 15, y, 'ink1'); P(f, 14, y + 1, 'bone2'); P(f, 16, y + 1, 'bone2'); }
  f.paint(M.ellipse(16, 7, 3.4, 3.2), 'rot', sphere(15, 6, 4, 4)); P(f, 16, 7, 'ink0'); P(f, 18, 7, 'ink0'); P(f, 17, 9, 'ink1');
  f.paint(M.line(21, 15, 24, 20, 2), 'rot', flat(0.5));
  f.outline(); P(f, 16, 7, 'flame1'); P(f, 18, 7, 'flame1');
  f.ax = 14; f.ay = 31; return f;
}
function wisp(t, atk = 0) {
  const f = new Frame(20, 26), B = Math.round(Math.sin(t * Math.PI / 2) * 1.5);
  const m = M.union(M.ellipse(10, 9 + B, 5, 5), M.poly([[5, 10 + B], [15, 10 + B], [12, 22 + B], [10, 25], [8, 21 + B]]));
  f.paint(m, 'holy', sphere(8, 6 + B, 7, 9, -0.1), { min: 1 });
  f.paint(M.ellipse(11, 9 + B, 2.6, 3), 'ink', flat(1));
  if (atk) f.paint(M.line(15, 12 + B, 19, 14 + B, 1), 'holy', flat(1), { dither: 0 });
  f.outline(); P(f, 10, 9 + B, 'holy0'); P(f, 12, 9 + B, 'holy0');
  f.ax = 10; f.ay = 25; return f;
}
function manymouthed(t, atk = 0) {
  const f = new Frame(64, 58), B = t % 2;
  const blob = M.union(M.ellipse(32, 32 + B, 24 + atk, 22 - B), M.ellipse(20, 20, 10, 9), M.ellipse(44, 22, 11, 10));
  f.paint(blob, 'skin', sphere(24, 20, 30, 28, -0.12), { min: 1 });
  const mouths = [[24, 26], [38, 22], [32, 38], [18, 38], [46, 36], [30, 14], [42, 46]];
  mouths.forEach(([x, y], i) => {
    const open = (atk || (t + i) % 3 === 0) ? 1.6 : 0.8;
    f.paint(M.ellipse(x, y, 3.4, open + 0.6), 'blood', flat(0.1), { min: 3 });
    for (let k = -2; k <= 2; k += 2) { P(f, x + k, Math.round(y - open), 'bone0'); P(f, x + k + 1, Math.round(y + open), 'bone1'); }
  });
  for (const [x, y] of [[14, 30], [50, 28], [28, 48]]) { f.paint(M.ellipse(x, y, 1.6, 1.6), 'bone', flat(0.9)); P(f, x, y, 'ink0'); }
  f.paint(M.rect(14, 52, 36, 3), 'skin', flat(0.15), { min: 3 });
  f.outline();
  f.ax = 32; f.ay = 54; return f;
}
function leviathan(t, atk = 0) {
  const f = new Frame(60, 50);
  const up = atk ? 6 : 0;
  for (let i = 4; i >= 0; i--) { const x = 10 + i * 8, y = 38 - Math.sin(i * 0.9 + t * 0.6) * 6 - (i === 0 ? up : 0); f.paint(M.ellipse(x, y, 7 - i * 0.4, 7 - i * 0.4), 'rot', sphere(x - 2, y - 3, 8, 8)); for (const d of [-3, 0, 3]) P(f, x + d, Math.round(y - 6 + i * 0.4), 'bone1'); }
  const hx = 10, hy = 30 - up;
  f.paint(M.ellipse(hx, hy, 9, 8), 'rot', sphere(hx - 3, hy - 3, 10, 10));
  f.paint(M.ellipse(hx + 1, hy + 3, 6, atk ? 4 : 2), 'blood', flat(0.15), { min: 3 });
  for (let k = -5; k <= 5; k += 2) { P(f, hx + k, hy + (atk ? 0 : 2), 'bone0'); P(f, hx + k + 1, hy + (atk ? 6 : 4), 'bone1'); }
  for (const d of [-4, 4]) P(f, hx + d, hy - 4, 'ink0');
  f.paint(M.ellipse(30, 46, 26, 3), 'shroud', flat(0.2), { min: 2 });
  f.outline(); for (const d of [-4, 4]) P(f, hx + d, hy - 4, 'ember0');
  f.ax = 24; f.ay = 46; return f;
}
function golem(t, atk = 0) {
  const f = new Frame(60, 64), B = t % 2;
  for (const [x, l] of [[20, t === 0 ? -2 : t === 2 ? 2 : 0], [38, t === 0 ? 2 : t === 2 ? -2 : 0]]) { const leg = M.rect(x - 4 + l, 44 + B, 9, 16 - B); f.paint(leg, 'wood', bevel(leg, 0.4, 0.75, 0.15)); f.paint(M.rect(x - 4 + l, 50, 9, 1), 'iron', flat(0.6)); }
  const coffin = M.poly([[18, 14 + B], [40, 14 + B], [44, 26 + B], [40, 48 + B], [18, 48 + B], [14, 26 + B]]);
  f.paint(coffin, 'wood', bevel(coffin, 0.42, 0.8, 0.15));
  f.paint(M.union(M.rect(28, 18 + B, 2, 26), M.rect(23, 25 + B, 12, 2)), 'gold', flat(0.7));
  for (const [x, y] of [[20, 30], [36, 34], [24, 40], [34, 20]]) { f.paint(M.ellipse(x, y + B, 2.4, 2.2), 'bone', sphere(x - 1, y - 1 + B, 3, 3)); P(f, x, y + B, 'ink0'); }
  for (const side of [-1, 1]) { const ax = 29 + side * 18, ay = 26 + B - (atk ? 10 : 0); f.paint(M.line(29 + side * 12, 20 + B, ax, ay + 10, 5), 'bone', sphere(ax, ay, 6, 10)); f.paint(M.ellipse(ax, ay + 14, 4, 4), 'bone', sphere(ax - 1, ay + 12, 5, 5)); }
  const hd = M.ellipse(29, 9 + B, 6, 6); f.paint(hd, 'bone', sphere(27, 6 + B, 7, 7));
  f.paint(M.rect(24, 3 + B, 11, 2), 'iron', flat(0.7));
  P(f, 27, 9 + B, 'ink0'); P(f, 31, 9 + B, 'ink0');
  f.outline(); P(f, 27, 9 + B, 'ember0'); P(f, 31, 9 + B, 'ember0');
  f.ax = 29; f.ay = 60; return f;
}
function bespokeSet(fn) { return { walk: [0, 1, 2, 3].map((t) => fn(t, 0)), attack: [fn(0, 1), fn(1, 1)] }; }

// The roster. Each monster gets its own two rows (walk, attack) in its tier sheet.
const ROSTER = {
  common: {
    crawler: () => bespokeSet(crawler),
    mourner: () => fiendSet({ scale: 0.9, ramp: 'shroud', head: 'candle', weapon: 'claws', legs: 'robe', extras: ['candles'] }),
    acolyte: () => fiendSet({ scale: 0.9, body: 'skeleton', robeOver: true, ramp: 'slate', head: 'skull', weapon: 'staff', orbRamp: 'flame', legRamp: 'bone' }),
    rat: () => bespokeSet(rat),
    votary: () => bespokeSet(votary),
    flagellant: () => fiendSet({ scale: 0.95, body: 'torso', ramp: 'skin', head: 'sack', hoodRamp: 'shroud', weapon: 'whip', legRamp: 'skin', extras: ['wound', 'chains'] }),
    cherub: () => fiendSet({ scale: 0.75, body: 'torso', ramp: 'stone', head: 'cherub', headRamp: 'stone', legs: 'float', weapon: 'claws', extras: ['wings', 'halo'], wingRamp: 'stone' }),
    wisp: () => bespokeSet(wisp),
  },
  rare: {
    knight: () => fiendSet({ scale: 1.35, body: 'armor', ramp: 'iron', tabard: 'violet', head: 'skull', weapon: 'sword', legRamp: 'iron', extras: ['crown'] }),
    collector: () => fiendSet({ scale: 1.35, body: 'fat', ramp: 'crimson', bellyRamp: 'gold', head: 'mitre', weapon: 'censer', legRamp: 'shroud' }),
    motherwax: () => fiendSet({ scale: 1.35, ramp: 'cloth', head: 'candle', legs: 'robe', weapon: 'claws', extras: ['candles', 'candles'], hunch: 1 }),
    bishop: () => fiendSet({ scale: 1.35, ramp: 'violet', head: 'mitre', legs: 'robe', weapon: 'staff', orbRamp: 'violet' }),
    jailer: () => fiendSet({ scale: 1.35, body: 'armor', ramp: 'slate', tabard: 'shroud', head: 'helm', helmRamp: 'iron', weapon: 'chain', legRamp: 'slate', extras: ['chains'] }),
    bellringer: () => fiendSet({ scale: 1.35, ramp: 'shroud', head: 'hood', hoodRamp: 'shroud', legs: 'robe', weapon: 'bell', hunch: 2, extras: ['spikes'] }),
    matron: () => fiendSet({ scale: 1.35, ramp: 'ink', head: 'mask', legs: 'robe', weapon: 'whip', extras: ['chains'] }),
    choirboy: () => fiendSet({ scale: 1.3, ramp: 'crimson', head: 'mask', maskRamp: 'bone', legs: 'robe', weapon: 'claws', extras: ['halo'] }),
    gravedigger: () => fiendSet({ scale: 1.4, body: 'torso', ramp: 'shroud', head: 'horned', weapon: 'shovel', legRamp: 'rot', hunch: 1, extras: ['wound'] }),
    lantern: () => fiendSet({ scale: 1.35, ramp: 'slate', head: 'hood', hoodRamp: 'ink', legs: 'float', body: 'float', weapon: 'lantern', eye: 'ember' }),
  },
  elite: {
    colossus: () => fiendSet({ scale: 2, body: 'fat', ramp: 'skin', bellyRamp: 'blood', head: 'sack', hoodRamp: 'shroud', weapon: 'claws', legRamp: 'skin', extras: ['chains', 'spikes', 'wound'] }),
    seraph: () => fiendSet({ scale: 1.7, ramp: 'cloth', head: 'mask', maskRamp: 'gold', legs: 'float', body: 'float', weapon: 'sword', extras: ['wings', 'halo'], wingRamp: 'ink', eye: 'holy' }),
    golem: () => bespokeSet(golem),
    thrice: () => fiendSet({ scale: 1.7, body: 'skeleton', ramp: 'bone', head: 'skull', weapon: 'scythe', legRamp: 'bone', extras: ['crown', 'tentacles'], crownRamp: 'iron', eye: 'violet' }),
    abbess: () => fiendSet({ scale: 1.7, ramp: 'moss', head: 'mask', maskRamp: 'cloth', legs: 'robe', weapon: 'staff', orbRamp: 'moss', extras: ['spikes', 'halo'] }),
    titan: () => fiendSet({ scale: 2, body: 'armor', ramp: 'gold', tabard: 'crimson', head: 'helm', helmRamp: 'gold', weapon: 'censer', legRamp: 'iron', extras: ['plume', 'candles'], eye: 'ember' }),
    manymouthed: () => bespokeSet(manymouthed),
    leviathan: () => bespokeSet(leviathan),
    inquisitor: () => fiendSet({ scale: 1.7, body: 'armor', ramp: 'ink', tabard: 'crimson', head: 'helm', helmRamp: 'ink', weapon: 'sword', legRamp: 'ink', extras: ['plume', 'chains'], eye: 'blood' }),
    effigy: () => fiendSet({ scale: 1.8, ramp: 'stone', head: 'mask', maskRamp: 'stone', legs: 'float', body: 'float', weapon: 'claws', extras: ['halo', 'wings'], wingRamp: 'stone', eye: 'holy' }),
  },
};

function monsterSheets() {
  return Object.entries(ROSTER).map(([tier, list]) => {
    const anims = {};
    for (const [id, make] of Object.entries(list)) { const set = make(); anims[`${id}_walk`] = set.walk; anims[`${id}_attack`] = set.attack; }
    return sheet(`mon_${tier}`, anims);
  }).concat([sheet('mon_warden', {})]); // the Wardens come only from models/elite.mjs
}

// Enemy projectiles and pickups.
function shotSprite(kind) {
  const f = new Frame(12, 12);
  if (kind === 'wax') { f.paint(M.ellipse(6, 6, 3.6, 3.4), 'ember', sphere(5, 5, 4, 4, 0.15)); P(f, 5, 4, 'white'); }
  if (kind === 'bone') { f.paint(M.line(2, 7, 9, 4, 2), 'bone', flat(0.85)); P(f, 9, 4, 'white'); }
  if (kind === 'tear') { f.paint(M.union(M.ellipse(6, 7, 2.6, 2.6), M.poly([[4, 6], [8, 6], [6, 1]])), 'holy', sphere(5, 6, 3, 3, 0.1)); }
  if (kind === 'feather') { f.paint(M.line(1, 8, 10, 3, 2), 'cloth', flat(0.8)); f.paint(M.line(1, 8, 10, 3, 1), 'ink', flat(0.6)); }
  if (kind === 'spit') { f.paint(M.ellipse(6, 6, 3.2, 3.2), 'moss', sphere(5, 5, 4, 4, 0.15)); P(f, 5, 5, 'moss0'); }
  if (kind === 'ember') { f.paint(M.ellipse(6, 6, 2.4, 2.4), 'ember', flat(0.95)); }
  if (kind === 'violet') { f.paint(M.ellipse(6, 6, 3.2, 3.2), 'violet', sphere(5, 5, 4, 4, 0.2)); P(f, 5, 5, 'white'); }
  if (kind === 'blood') { f.paint(M.ellipse(6, 6, 3.2, 3.2), 'blood', sphere(5, 5, 4, 4, 0.2)); P(f, 5, 5, 'blood0'); }
  if (kind === 'frost') { f.paint(M.ellipse(6, 6, 4.4, 4.4), 'holy', sphere(5, 5, 5, 5, 0.1), { min: 1 }); for (const [a, b] of [[6, 1], [6, 11], [1, 6], [11, 6]]) P(f, a, b, 'holy0'); }
  if (kind === 'bomb') { f.paint(M.ellipse(6, 7, 3.6, 3.6), 'ink', sphere(5, 6, 5, 5, 0.4), { max: 3 }); P(f, 7, 3, 'wood1'); P(f, 8, 2, 'ember0'); }
  if (kind === 'coffin') { const m = M.rect(3, 1, 6, 10); f.paint(m, 'wood', bevel(m, 0.45, 0.8, 0.2)); f.paint(M.rect(5, 3, 2, 5), 'gold', flat(0.6)); }
  return f.outline();
}
function coin(i) { const f = new Frame(6, 6); f.paint(M.ellipse(2.5, 2.5 + (i ? 0 : 0), i ? 1 : 2.2, 2.2), 'gold', sphere(2, 2, 3, 3, 0.1)); return f.outline(); }
function goldPile(n) {
  const f = new Frame(14, 10);
  for (let k = 0; k < n * 3; k++) { const x = 3 + (k * 37) % 8, y = 5 + (k * 13) % 3; f.paint(M.ellipse(x, y, 1.8, 1.2), 'gold', sphere(x - 1, y - 1, 2.5, 2, 0.1)); }
  return f.outline();
}
function globe(i) { const f = new Frame(12, 12); f.paint(M.ellipse(5.5, 5.5, 4.2 + i * 0.4, 4.2 + i * 0.4), 'blood', sphere(4, 4, 5, 5, 0.25)); P(f, 4, 3, 'white'); P(f, 3, 4, 'blood0'); return f.outline(); }
function itemIcon(kind) {
  const f = new Frame(14, 14);
  const g = { hood: () => f.paint(M.union(M.ellipse(7, 7, 4.5, 4.5), M.poly([[3, 6], [5, 1], [8, 4]])), 'cloth', sphere(5, 5, 6, 6)),
    mantle: () => f.paint(M.union(M.ellipse(7, 7, 6, 3.5), M.rect(2, 7, 10, 4)), 'cloth', sphere(5, 5, 7, 6)),
    gloves: () => f.paint(M.union(M.rect(4, 5, 6, 7), M.rect(3, 2, 2, 5), M.rect(6, 1, 2, 5), M.rect(9, 2, 2, 5)), 'cloth', sphere(5, 4, 7, 7)),
    girdle: () => { f.paint(M.rect(1, 5, 12, 4), 'cloth', bevel(M.rect(1, 5, 12, 4), 0.5, 0.9, 0.2)); f.paint(M.rect(6, 4, 3, 6), 'gold', flat(0.7)); },
    greaves: () => f.paint(M.union(M.rect(3, 1, 3, 11), M.rect(8, 1, 3, 11), M.rect(2, 11, 4, 2), M.rect(8, 11, 4, 2)), 'cloth', sphere(5, 4, 7, 9)),
    rosary: () => { for (let a = 0; a < 10; a++) P(f, 7 + Math.round(Math.cos(a * 0.63) * 4), 5 + Math.round(Math.sin(a * 0.63) * 3.5), 'cloth1'); f.paint(M.union(M.rect(6, 9, 2, 5), M.rect(4, 10, 6, 1)), 'gold', flat(0.8)); },
    seal: () => { f.paint(M.minus(M.ellipse(7, 8, 4.5, 4.5), M.ellipse(7, 8, 2.5, 2.5)), 'gold', sphere(5, 6, 6, 6)); f.paint(M.ellipse(7, 3, 2, 2), 'crimson', flat(0.8)); },
    relic: () => { f.paint(M.ellipse(7, 7, 4, 5), 'bone', sphere(5, 5, 5, 6)); P(f, 6, 7, 'ink0'); P(f, 8, 7, 'ink0'); },
  };
  g[kind](); return f.outline();
}
function gate() { // iron portcullis, 16x30
  const f = new Frame(16, 30);
  for (let x = 1; x < 16; x += 4) f.paint(M.rect(x, 2, 2, 26), 'iron', cyl(x + 0.5, 1.5), { min: 1 });
  for (const y of [4, 14, 24]) f.paint(M.rect(0, y, 16, 2), 'iron', vgrad(y, y + 2, 0.8, 0.3), { min: 1 });
  for (let x = 1; x < 16; x += 4) { P(f, x, 28, 'iron0'); P(f, x + 1, 29, 'iron2'); }
  f.paint(M.rect(0, 0, 16, 2), 'gold', flat(0.6));
  return f.outline();
}
function chest(open) {
  const f = new Frame(24, 20);
  const base = M.rect(2, 8, 20, 11); f.paint(base, 'wood', bevel(base, 0.42, 0.75, 0.15));
  if (!open) { const lid = M.union(M.rect(2, 3, 20, 6), M.ellipse(12, 4, 10, 2)); f.paint(lid, 'wood', bevel(lid, 0.55, 0.9, 0.25)); f.paint(M.rect(11, 6, 3, 5), 'gold', flat(0.9)); }
  else { f.paint(M.rect(2, 1, 20, 4), 'wood', flat(0.3)); f.paint(M.rect(4, 8, 16, 3), 'gold', (x) => 1 - (x - 4) / 20); }
  for (const x of [2, 20]) f.paint(M.rect(x, 3, 2, 16), 'gold', flat(0.5));
  return f.outline();
}
function shrine(kind) {
  const f = new Frame(26, 38);
  const ped = M.poly([[5, 37], [21, 37], [18, 22], [8, 22]]); f.paint(ped, 'stone', bevel(ped, 0.45, 0.8, 0.2));
  f.paint(M.rect(4, 19, 18, 4), 'stone', bevel(M.rect(4, 19, 18, 4), 0.6, 0.95, 0.25));
  const rmp = { fervor: 'crimson', haste: 'flame', warding: 'holy', plenty: 'gold' }[kind];
  f.paint(M.ellipse(13, 11, 6, 6), rmp, sphere(11, 9, 7, 7, 0.2), { min: 0 });
  f.paint(M.minus(M.ellipse(13, 11, 7.5, 7.5), M.ellipse(13, 11, 6, 6)), 'gold', flat(0.6));
  return f.outline();
}
function imp(t, atk = 0) {
  const f = new Frame(22, 24), B = t % 2;
  f.paint(M.ellipse(14, 12 + B, 6, 6), 'wood', sphere(12, 10, 7, 7)); // sack
  P(f, 14, 9 + B, 'gold0'); P(f, 15, 11 + B, 'gold1');
  f.paint(M.ellipse(8, 14 + B, 4, 4.5), 'crimson', sphere(7, 12, 5, 5));
  f.paint(M.ellipse(8, 8 + B, 3.6, 3.4), 'crimson', sphere(7, 7, 4, 4)); for (const d of [-2, 2]) f.paint(M.line(8 + d, 5 + B, 8 + d * 1.5, 2 + B), 'bone', flat(0.8));
  P(f, 9, 8 + B, 'ink0'); P(f, 7, 8 + B, 'ink0');
  for (const l of [-1, 1]) f.paint(M.line(8 + l * 2, 18, 8 + l * 2 + (t % 2 ? l : -l), 22), 'crimson', flat(0.4));
  f.paint(M.ellipse(4, 15 + B, 3, 1.2), 'gold', flat(0.8)); // the collection plate
  f.outline(); P(f, 9, 8 + B, 'gold0'); P(f, 7, 8 + B, 'gold0');
  f.ax = 10; f.ay = 22; return f;
}
function coffinProp(broken) {
  const f = new Frame(18, 28);
  const m = M.poly([[5, 1], [13, 1], [16, 8], [13, 27], [5, 27], [2, 8]]);
  f.paint(m, 'wood', bevel(m, 0.4, 0.75, 0.15));
  f.paint(M.union(M.rect(8, 4, 2, 16), M.rect(5, 8, 8, 2)), broken ? 'wood' : 'gold', flat(broken ? 0.1 : 0.6));
  return f.outline();
}
function pew() { const f = new Frame(34, 16); const m = M.rect(1, 3, 32, 6); f.paint(m, 'wood', bevel(m, 0.5, 0.85, 0.2)); f.paint(M.rect(1, 9, 32, 4), 'wood', flat(0.25)); for (const x of [2, 30]) f.paint(M.rect(x, 1, 2, 14), 'wood', flat(0.5)); return f.outline(); }
function altar() { const f = new Frame(36, 24); const top = M.rect(1, 2, 34, 8); f.paint(top, 'stone', bevel(top, 0.6, 0.9, 0.3)); f.paint(M.rect(3, 10, 30, 12), 'stone', flat(0.3)); f.paint(M.rect(4, 2, 28, 3), 'crimson', flat(0.55)); f.paint(M.ellipse(18, 6, 5, 2), 'blood', flat(0.3)); for (const x of [6, 30]) { f.paint(M.rect(x, -2 + 2, 2, 3), 'bone', flat(0.8)); } return f.outline(); }
function maiden() { const f = new Frame(20, 36); const m = M.union(M.ellipse(10, 8, 7, 7), M.rect(3, 8, 14, 26)); f.paint(m, 'iron', cyl(9, 8)); f.paint(M.ellipse(10, 8, 3.4, 3.4), 'iron', sphere(9, 7, 4, 4, 0.1)); P(f, 9, 8, 'ink0'); P(f, 11, 8, 'ink0'); f.paint(M.line(10, 14, 10, 33), 'ink', flat(0.8)); P(f, 11, 30, 'blood1'); P(f, 11, 31, 'blood2'); return f.outline(); }
function cage() { const f = new Frame(18, 34); f.paint(M.line(9, 0, 9, 5), 'iron', flat(0.5)); for (let x = 2; x <= 16; x += 3) f.paint(M.rect(x, 6, 1, 24), 'iron', flat(0.6), { dither: 0 }); f.paint(M.ellipse(9, 6, 7.5, 2), 'iron', flat(0.4)); f.paint(M.rect(1, 29, 17, 2), 'iron', flat(0.4)); f.paint(M.ellipse(9, 20, 3, 6), 'bone', sphere(8, 17, 4, 7, -0.1)); P(f, 8, 15, 'ink0'); return f.outline(); }
function hangChain() { const f = new Frame(6, 30); for (let y = 0; y < 26; y += 2) f.paint(M.rect(y % 4 ? 1 : 2, y, y % 4 ? 3 : 1, 2), 'iron', flat(0.6 - y * 0.01), { dither: 0 }); f.paint(M.line(3, 26, 5, 29), 'iron', flat(0.8)); return f; }
function web() { const f = new Frame(16, 16); for (let i = 0; i < 16; i++) { P(f, i, 0, 'cloth2'); P(f, 0, i, 'cloth2'); if (i < 12) P(f, i, Math.floor(i * 0.6), 'cloth2'); } for (const r of [5, 10]) for (let a = 0; a <= 8; a++) P(f, Math.round(Math.cos(a * Math.PI / 16) * r), Math.round(Math.sin(a * Math.PI / 16) * r), 'cloth3'); return f; }
function skullWall() { const f = new Frame(16, 32); f.paint(M.rect(0, 0, 16, 32), 'ink', flat(0.6)); for (let y = 2; y < 30; y += 5) for (let x = (y % 10 ? 2 : 5); x < 16; x += 6) { f.paint(M.ellipse(x, y, 2.6, 2.2), 'bone', sphere(x - 1, y - 1, 3, 3, -0.15)); P(f, x - 1, y, 'ink0'); P(f, x + 1, y, 'ink0'); } return f; }
function water(v) { const f = new Frame(16, 16); f.paint(M.rect(0, 0, 16, 16), 'holy', (x, y) => 0.12 + Math.sin(x * 0.7 + y * 0.4 + v * 2) * 0.05, { min: 3, max: 4, dither: 0.5 }); for (let i = 0; i < 3; i++) { const x = (v * 5 + i * 6) % 14, y = (v * 3 + i * 5) % 14; P(f, x, y, 'holy2'); P(f, x + 1, y, 'holy2'); } return f; }

function lootSheet() {
  return sheet('loot', {
    wax: [shotSprite('wax')], bone: [shotSprite('bone')], tear: [shotSprite('tear')], feather: [shotSprite('feather')], spit: [shotSprite('spit')],
    ember: [shotSprite('ember')], violet: [shotSprite('violet')], blood: [shotSprite('blood')], frost: [shotSprite('frost')], bomb: [shotSprite('bomb')], coffin: [shotSprite('coffin')],
    coin: [coin(0), coin(1)], gold: [goldPile(1), goldPile(2), goldPile(3)], globe: [globe(0), globe(1)],
    item: ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic'].map(itemIcon),
    gate: [gate()], chest: [chest(false), chest(true)], shrine: ['fervor', 'haste', 'warding', 'plenty'].map(shrine),
    imp: [0, 1, 2, 3].map((t) => imp(t)),
    coffin: [coffinProp(false), coffinProp(true)], pew: [pew()], altar: [altar()], maiden: [maiden()], cage: [cage()],
    hangchain: [hangChain()], web: [web()], skullwall: [skullWall()], water: [0, 1, 2, 3].map(water),
  });
}

// ============================================================ Vael v2 ===
// The long town: gate, market, tavern square, forge, graveyard, cathedral.

function stoneWall(f, m, seed, base = 0.45) {
  f.paint(m, 'stone', (x, y) => base + (hash(x, y, seed) - 0.5) * 0.07 + ((x + (Math.floor(y / 6) % 2) * 6) % 12 === 0 || y % 6 === 0 ? -0.18 : 0), { min: 1, dither: 0.3 });
}
function gothicWindow(f, x, y, w, h, ramp = 'violet', lit = true) {
  const m = M.union(M.rect(x, y + Math.floor(w / 2), w, h - Math.floor(w / 2)), M.ellipse(x + (w - 1) / 2, y + w / 2, (w - 1) / 2, w / 2));
  f.paint(M.union(M.rect(x - 1, y + Math.floor(w / 2), w + 2, h - Math.floor(w / 2) + 1), M.ellipse(x + (w - 1) / 2, y + w / 2, (w + 1) / 2, w / 2 + 1)), 'stone', flat(0.7), { dither: 0 });
  f.paint(m, lit ? ramp : 'ink', (px, py) => lit ? 0.85 - (py - y) / h * 0.5 + (hash(px, py, 77) - 0.5) * 0.3 : 0.6, { dither: 0.5 });
  if (w >= 5) f.paint(M.and(M.union(M.rect(x + Math.floor(w / 2), y + 2, 1, h), M.rect(x, y + Math.floor(h * 0.55), w, 1)), m), 'ink', flat(0.8));
}

function cathedral() {
  const f = new Frame(272, 200);
  const base = 199;
  // Towers with spires.
  for (const tx of [10, 214]) {
    const tw = M.rect(tx, 40, 48, 160); stoneWall(f, tw, tx, 0.4);
    f.paint(M.poly([[tx - 2, 42], [tx + 24, -2 + 0], [tx + 50, 42]]), 'slate', sphere(tx + 14, 10, 40, 40), { min: 1 });
    f.paint(M.line(tx + 24, 0, tx + 24, 4), 'gold', flat(0.9));
    for (let y = 60; y < 180; y += 40) gothicWindow(f, tx + 18, y, 12, 26, y < 100 ? 'crimson' : 'violet', hash(tx, y) < 0.7);
    f.paint(M.rect(tx - 2, 40, 52, 3), 'gold', flat(0.5));
  }
  // Nave front with gable.
  const nave = M.rect(56, 60, 160, 140); stoneWall(f, nave, 3, 0.48);
  f.paint(M.poly([[52, 62], [136, 6], [220, 62]]), 'stone', sphere(110, 20, 110, 80), { min: 1 });
  f.paint(M.minus(M.poly([[48, 64], [136, 2], [224, 64]]), M.poly([[54, 64], [136, 8], [218, 64]])), 'gold', (x) => 1 - x / 272);
  // Rose window.
  const rose = M.ellipse(136, 56, 22, 22);
  f.paint(M.ellipse(136, 56, 25, 25), 'gold', sphere(130, 50, 26, 26));
  f.paint(rose, 'violet', (x, y) => 0.7 + Math.sin(Math.atan2(y - 56, x - 136) * 6) * 0.15 + (Math.hypot(x - 136, y - 56) < 8 ? 0.3 : 0), { dither: 0.6 });
  for (let a = 0; a < 12; a++) f.paint(M.line(136 + Math.cos(a * Math.PI / 6) * 7, 56 + Math.sin(a * Math.PI / 6) * 7, 136 + Math.cos(a * Math.PI / 6) * 22, 56 + Math.sin(a * Math.PI / 6) * 22), 'gold', flat(0.6), { dither: 0 });
  f.paint(M.ellipse(136, 56, 6, 6), 'crimson', flat(0.85));
  // Great door: the Vestry.
  const arch = M.union(M.rect(116, 140, 40, 60), M.ellipse(136, 140, 20, 18));
  f.paint(M.union(M.rect(110, 136, 52, 64), M.ellipse(136, 136, 26, 24)), 'gold', bevel(M.union(M.rect(110, 136, 52, 64), M.ellipse(136, 136, 26, 24)), 0.45, 0.95, 0.2));
  for (let k = 1; k <= 3; k++) f.paint(M.minus(M.ellipse(136, 136, 26 - k * 2, 24 - k * 2), M.ellipse(136, 136, 25 - k * 2, 23 - k * 2)), 'stone', flat(0.4 + k * 0.1));
  f.paint(arch, 'wood', (x, y) => 0.4 - (y - 122) / 100 + (x === 136 ? -0.4 : 0) + ((x - 116) % 6 === 0 ? -0.1 : 0), { min: 1 });
  for (const hx of [126, 145]) for (let y = 150; y < 196; y += 10) f.paint(M.rect(hx, y, 4, 2), 'iron', flat(0.5));
  f.paint(M.ellipse(136, 172, 2, 2), 'gold', flat(1));
  // Statues in niches either side of the door and lancet windows above.
  for (const nx of [70, 186]) {
    f.paint(M.union(M.rect(nx, 120, 16, 50), M.ellipse(nx + 8, 120, 8, 7)), 'ink', vgrad(112, 170, 0.6, 0.15));
    f.paint(M.union(M.ellipse(nx + 8, 128, 3.4, 3.6), M.poly([[nx + 3, 133], [nx + 13, 133], [nx + 15, 168], [nx + 1, 168]])), 'stone', cyl(nx + 6, 7, 0.1));
    f.paint(M.minus(M.ellipse(nx + 8, 122, 5, 1.6), M.ellipse(nx + 8, 122, 3.2, 0.5)), 'gold', flat(0.8));
    gothicWindow(f, nx + 2, 84, 12, 28, 'crimson', true);
  }
  // Buttress fins and steps.
  for (const bx of [56, 208]) f.paint(M.rect(bx, 70, 8, 130), 'stone', cyl(bx + 3, 5));
  for (let k = 0; k < 3; k++) f.paint(M.rect(96 - k * 6, 194 + k * 2, 80 + k * 12, 2), 'stone', flat(0.75 - k * 0.15), { dither: 0 });
  // Grime and moss streaks.
  for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i, 1) * 272), y = 60 + Math.floor(hash(i, 2) * 130); if (f.get(x, y) >= 0) f.shift(M.line(x, y, x, y + 4 + Math.floor(hash(i, 3) * 10)), 1); }
  return f.outline();
}

function cityGate() {
  const f = new Frame(136, 160);
  for (const tx of [4, 92]) {
    const tw = M.rect(tx, 30, 40, 130); stoneWall(f, tw, tx + 5, 0.38);
    for (let x = tx; x < tx + 40; x += 8) f.paint(M.rect(x, 22, 5, 8), 'stone', bevel(M.rect(x, 22, 5, 8), 0.5, 0.8, 0.2));
    gothicWindow(f, tx + 15, 50, 9, 18, 'ember', true);
    f.paint(M.rect(tx + 4, 90, 32, 40), 'crimson', cyl(tx + 18, 16)); // banner
    f.paint(M.minus(M.ellipse(tx + 20, 102, 7, 2.5), M.ellipse(tx + 20, 102, 4.5, 0.8)), 'gold', flat(0.8));
  }
  const wall = M.rect(44, 52, 48, 108); stoneWall(f, wall, 9, 0.42);
  for (let x = 44; x < 92; x += 8) f.paint(M.rect(x, 44, 5, 8), 'stone', bevel(M.rect(x, 44, 5, 8), 0.5, 0.8, 0.2));
  const arch = M.union(M.rect(50, 100, 36, 60), M.ellipse(68, 100, 18, 16));
  f.paint(arch, 'ink', vgrad(84, 160, 0.7, 0.3));
  for (let x = 52; x < 86; x += 5) f.paint(M.and(M.rect(x, 84, 2, 34), arch), 'iron', vgrad(84, 118, 0.7, 0.3), { min: 1 });
  f.paint(M.and(M.rect(50, 116, 36, 2), arch), 'iron', flat(0.6));
  f.paint(M.minus(M.union(M.rect(47, 100, 42, 60), M.ellipse(68, 100, 21, 19)), arch), 'stone', flat(0.7), { dither: 0 });
  return f.outline();
}

function tallHouse(v) {
  const f = new Frame(68, 132);
  const plasterR = v % 2 ? 'sand' : 'stone';
  const floors = 3, fh = 30;
  for (let k = 0; k < floors; k++) {
    const y = 132 - (k + 1) * fh, inset = k * 2, wl = M.rect(4 - inset, y, 60 + inset * 2, fh);
    f.paint(wl, plasterR, (x, yy) => (plasterR === 'sand' ? 0.5 : 0.38) + (hash(x, yy, v + k) - 0.5) * 0.08 - k * 0.04, { min: 1, max: 3, dither: 0.3 });
    const beams = M.union(M.rect(4 - inset, y, 60 + inset * 2, 2), M.rect(4 - inset, y, 2, fh), M.rect(62 + inset, y, 2, fh), M.rect(33, y, 2, fh));
    f.paint(beams, 'wood', flat(0.3), { min: 1 });
    if (k > 0) f.paint(M.rect(4 - inset, y + fh - 2, 60 + inset * 2, 2), 'wood', flat(0.15));
    for (const wx of [12, 44]) { const lit = hash(v, k, wx) < 0.55; if (k === 0 && wx === 44 && v % 3 === 0) continue; const m = M.rect(wx - inset * 0 , y + 8, 10, 12); f.paint(m, lit ? 'ember' : 'ink', (px, py) => lit ? 0.95 - (py - y - 8) / 14 : 0.6, { dither: 0.4 }); f.paint(M.union(M.rect(wx + 4, y + 8, 1, 12), M.rect(wx, y + 13, 10, 1)), 'wood', flat(0.3)); f.paint(M.rect(wx - 1, y + 20, 12, 1), 'wood', flat(0.7)); }
    if (k === 0) { const d = M.union(M.rect(24, 132 - 24, 14, 24), M.ellipse(31, 132 - 24, 7, 4)); f.paint(d, 'wood', (x, yy) => 0.35 - (yy - 104) / 50, { min: 1 }); }
  }
  // Steep roof with a dormer and chimney.
  const ry = 132 - floors * fh;
  const roof = M.poly([[-2 + 2, ry + 1], [34, ry - 34], [70 - 2, ry + 1]]);
  for (let row = 0; row < 36; row += 3) for (let x = -2; x < 70; x += 6) { const m = M.and(M.rect(x - (row % 6 ? 3 : 0), ry - 34 + row, 6, 3), roof); f.paint(m, 'roof', bevel(m, 0.4 + hash(x, row, v) * 0.15, 0.7, 0.15)); }
  f.paint(M.rect(48, ry - 30, 8, 18), 'slate', cyl(51, 4)); f.paint(M.rect(47, ry - 32, 10, 2), 'slate', flat(0.8));
  const dorm = M.union(M.rect(28, ry - 16, 12, 10), M.poly([[26, ry - 16], [34, ry - 24], [42, ry - 16]]));
  f.paint(dorm, 'wood', bevel(dorm, 0.4, 0.7, 0.2)); f.paint(M.rect(31, ry - 14, 6, 6), hash(v, 9) < 0.5 ? 'ember' : 'ink', flat(0.8));
  // Hanging shop sign.
  if (v % 2 === 0) { f.paint(M.rect(62, 132 - 56, 8, 1), 'iron', flat(0.5)); const sg = M.rect(63, 132 - 54, 7, 9); f.paint(sg, 'wood', bevel(sg, 0.45, 0.8, 0.2)); P(f, 66, 132 - 50, v % 4 ? 'gold1' : 'crimson1'); }
  return f.outline();
}

function ruin() {
  const f = new Frame(72, 110);
  const wall = M.poly([[2, 110], [2, 40], [12, 30], [20, 46], [30, 22], [44, 50], [54, 36], [70, 60], [70, 110]]);
  stoneWall(f, wall, 21, 0.36);
  for (const [x, y] of [[14, 62], [44, 66]]) f.paint(M.union(M.rect(x, y, 12, 22), M.ellipse(x + 5.5, y, 6, 5)), 'ink', flat(0.7));
  f.paint(M.union(M.line(6, 40, 50, 14, 2), M.line(30, 22, 64, 6, 2)), 'wood', flat(0.25), { min: 2 });
  for (let i = 0; i < 30; i++) { const x = 2 + Math.floor(hash(i, 4) * 68), y = 40 + Math.floor(hash(i, 5) * 70); if (wall.has(`${x},${y}`)) P(f, x, y, hash(i, 6) < 0.5 ? 'moss2' : 'moss3'); }
  f.paint(M.rect(0, 100, 72, 10), 'stone', (x, y) => 0.3 + hash(x, y, 8) * 0.3, { min: 2 });
  return f.outline();
}

function mausoleum() {
  const f = new Frame(88, 104);
  const body = M.rect(10, 40, 68, 64); stoneWall(f, body, 31, 0.42);
  f.paint(M.poly([[4, 42], [44, 14], [84, 42]]), 'stone', sphere(36, 22, 50, 40), { min: 1 });
  f.paint(M.rect(4, 40, 80, 4), 'stone', bevel(M.rect(4, 40, 80, 4), 0.6, 0.9, 0.3));
  for (const cx2 of [16, 30, 58, 72]) f.paint(M.rect(cx2 - 3, 44, 6, 56), 'stone', cyl(cx2 - 1, 4, 0.05));
  const door = M.union(M.rect(36, 66, 16, 38), M.ellipse(44, 66, 8, 6));
  f.paint(door, 'iron', (x, y) => 0.3 - (y - 60) / 80 + ((x - 36) % 4 === 0 ? -0.15 : 0), { min: 1 });
  // A grieving angel on the roof.
  const angel = M.union(M.ellipse(44, 6, 3, 3), M.poly([[40, 9], [48, 9], [50, 18], [38, 18]]));
  f.paint(angel, 'stone', sphere(42, 5, 6, 8));
  for (const side of [-1, 1]) f.paint(M.poly([[44, 10], [44 + side * 12, 2], [44 + side * 10, 14]]), 'stone', flat(side < 0 ? 0.7 : 0.45));
  for (let i = 0; i < 24; i++) { const x = 10 + Math.floor(hash(i, 7) * 68), y = 60 + Math.floor(hash(i, 8) * 44); P(f, x, y, 'moss2'); }
  return f.outline();
}

function plushStall() {
  const f = new Frame(76, 70);
  const back = M.rect(4, 18, 68, 52); plaster(f, back, 41);
  f.paint(M.union(M.rect(4, 18, 3, 52), M.rect(69, 18, 3, 52)), 'wood', cyl(5, 2));
  for (let x = 0; x < 76; x++) for (let y = 6; y < 22; y++) { if (y >= 19 && (x % 8 < 2 || x % 8 > 5)) continue; const st = Math.floor(x / 8) % 2; f.paint(M.pts([[x, y]]), st ? 'gold' : 'violet', flat(0.85 - (y - 6) / 16 * 0.6), { max: 3 }); }
  // Shelves of plush Saints: little red hoods with halos.
  for (const sy of [30, 44]) { f.paint(M.rect(8, sy + 8, 60, 2), 'wood', flat(0.6)); for (let k = 0; k < 6; k++) { const x = 12 + k * 10; f.paint(M.ellipse(x, sy + 4, 3, 4), 'crimson', sphere(x - 1, sy + 3, 4, 4)); P(f, x + 1, sy + 4, 'ink0'); f.paint(M.minus(M.ellipse(x, sy - 1, 2.5, 0.9), M.ellipse(x, sy - 1, 1.3, 0.2)), 'gold', flat(0.9)); } }
  const counter = M.rect(6, 56, 64, 14); f.paint(counter, 'wood', bevel(counter, 0.42, 0.75, 0.15));
  f.paint(M.rect(26, 59, 24, 6), 'bone', bevel(M.rect(26, 59, 24, 6), 0.7, 0.9, 0.4)); for (let x = 28; x < 48; x += 3) P(f, x, 62, 'ink2');
  return f.outline();
}

function gallows(i) {
  const f = new Frame(56, 76);
  f.paint(M.rect(2, 62, 52, 6), 'wood', bevel(M.rect(2, 62, 52, 6), 0.45, 0.8, 0.15));
  for (const x of [4, 48]) f.paint(M.rect(x, 66, 4, 10), 'wood', flat(0.3));
  f.paint(M.rect(8, 6, 4, 56), 'wood', cyl(9, 3));
  f.paint(M.rect(8, 4, 40, 4), 'wood', bevel(M.rect(8, 4, 40, 4), 0.5, 0.85, 0.2));
  f.paint(M.line(12, 20, 24, 8, 2), 'wood', flat(0.4));
  const sw = i ? 2 : -1;
  f.paint(M.line(40, 8, 40 + sw, 22), 'wood', flat(0.6), { dither: 0 });
  const cx = 40 + sw, cy = 22;
  for (let x = cx - 7; x <= cx + 7; x += 3) f.paint(M.rect(x, cy, 1, 26), 'iron', flat(0.6), { dither: 0 });
  f.paint(M.ellipse(cx, cy, 7.5, 2), 'iron', flat(0.4)); f.paint(M.rect(cx - 8, cy + 25, 17, 2), 'iron', flat(0.4));
  f.paint(M.ellipse(cx, cy + 14, 3, 7), 'bone', sphere(cx - 1, cy + 10, 4, 8, -0.1)); P(f, cx - 1, cy + 9, 'ink0'); P(f, cx + 1, cy + 9, 'ink0');
  f.paint(M.ellipse(cx, cy + 13, 3.5, 4), 'shroud', flat(0.3), { min: 2 });
  return f.outline();
}

function cart() {
  const f = new Frame(52, 34);
  const bed = M.rect(4, 10, 40, 10); f.paint(bed, 'wood', bevel(bed, 0.42, 0.75, 0.15));
  for (let x = 6; x < 44; x += 6) f.shift(M.rect(x, 11, 1, 8), 1);
  f.paint(M.line(44, 15, 52, 20, 2), 'wood', flat(0.5));
  // Shrouded bodies piled in the cart.
  for (const [x, y] of [[14, 8], [26, 7], [36, 9]]) f.paint(M.ellipse(x, y, 7, 3.4), 'shroud', sphere(x - 2, y - 2, 8, 5));
  P(f, 9, 7, 'bone1'); P(f, 41, 8, 'rot1');
  const wheel = M.minus(M.ellipse(14, 24, 8, 8), M.ellipse(14, 24, 6, 6)); f.paint(wheel, 'wood', flat(0.4), { min: 1 });
  for (let a = 0; a < 6; a++) f.paint(M.line(14, 24, 14 + Math.cos(a) * 6, 24 + Math.sin(a) * 6), 'wood', flat(0.3), { dither: 0 });
  f.paint(M.rect(34, 20, 8, 10), 'wood', flat(0.3));
  return f.outline();
}
function brazier(i) {
  const f = new Frame(18, 30);
  f.paint(M.union(M.line(4, 29, 8, 16), M.line(13, 29, 9, 16), M.line(9, 29, 9, 16)), 'iron', flat(0.4), { dither: 0 });
  f.paint(M.ellipse(9, 15, 7, 3), 'iron', bevel(M.ellipse(9, 15, 7, 3), 0.4, 0.8, 0.15));
  f.outline();
  const fl = [[5, 11], [7, 7 - i], [9, 4 + i], [11, 8], [13, 11], [8, 11], [10, 10]];
  for (const [x, y] of fl) for (let yy = y; yy < 13; yy++) P(f, x, yy, yy < y + 2 ? 'ember0' : yy < y + 4 ? 'ember1' : 'ember2');
  return f;
}
function campfire(i) {
  const f = new Frame(28, 20);
  f.paint(M.union(M.line(3, 17, 24, 13, 2), M.line(4, 13, 24, 17, 2)), 'wood', flat(0.35), { min: 1 });
  for (let k = 0; k < 8; k++) f.paint(M.ellipse(4 + k * 2.8, 17 + (k % 2), 1.6, 1.2), 'stone', flat(0.5));
  f.outline();
  for (const [x, top] of [[10, 5 + i], [13, 2 - i + 1], [16, 6 - i], [12, 7], [15, 8]]) for (let y = top; y < 15; y++) P(f, x, y, y < top + 2 ? 'ember0' : y < top + 5 ? 'ember1' : 'ember2');
  return f;
}
function tombstone(v) {
  const f = new Frame(16, 22);
  let m;
  if (v === 0) m = M.union(M.rect(6, 2, 4, 18), M.rect(2, 6, 12, 4));
  else if (v === 1) m = M.union(M.rect(2, 8, 12, 12), M.ellipse(8, 8, 6, 6));
  else m = M.poly([[2, 20], [2, 9], [6, 5], [9, 8], [11, 4], [14, 9], [14, 20]]);
  f.paint(m, 'stone', bevel(m, 0.45, 0.8, 0.15), { dither: 0.3 });
  if (v === 1) { f.paint(M.rect(5, 10, 6, 1), 'stone', flat(0.2)); f.paint(M.rect(5, 13, 6, 1), 'stone', flat(0.2)); }
  P(f, 3, 19, 'moss2'); P(f, 4, 19, 'moss1'); P(f, 12, 18, 'moss2');
  return f.outline();
}
function deadTree() {
  const f = new Frame(64, 90);
  const limbs = [[32, 90, 32, 50, 5], [32, 60, 14, 34, 3], [32, 54, 52, 28, 3], [14, 34, 6, 18, 2], [14, 34, 22, 12, 2], [52, 28, 60, 14, 2], [44, 36, 50, 40, 1], [32, 50, 30, 20, 3], [30, 20, 38, 4, 2], [30, 24, 20, 6, 1]];
  for (const [a, b, c, d, t] of limbs) f.paint(M.line(a, b, c, d, t), 'shroud', cyl(a, t + 2, -0.2), { min: 2 });
  return f.outline();
}
function fence() {
  const f = new Frame(32, 26);
  for (const y of [8, 18]) f.paint(M.rect(0, y, 32, 2), 'iron', flat(0.4), { dither: 0 });
  for (let x = 1; x < 32; x += 5) { f.paint(M.rect(x, 4, 2, 22), 'iron', cyl(x, 1.5), { min: 1 }); P(f, x, 2, 'iron1'); P(f, x + 1, 3, 'iron2'); }
  return f.outline();
}
function crow(i) {
  const f = new Frame(12, 10);
  if (i < 2) { f.paint(M.ellipse(5, 6, 3.5, 2.5), 'ink', sphere(4, 5, 4, 4, 0.4), { max: 3 }); f.paint(M.ellipse(8 + i * 0.5, 4, 1.8, 1.6), 'ink', flat(0.6)); P(f, 10, 4, 'gold2'); P(f, 2, 7, 'ink2'); P(f, 9, 4, 'bone0'); }
  else { const up = i === 2; f.paint(M.ellipse(6, 5, 2.4, 1.6), 'ink', flat(0.6)); f.paint(M.union(M.line(6, 5, 1, up ? 1 : 8), M.line(6, 5, 11, up ? 1 : 8)), 'ink', flat(0.4)); }
  return f.outline();
}
function well() {
  const f = new Frame(36, 40);
  const ring = M.ellipse(18, 30, 15, 7); f.paint(ring, 'stone', sphere(14, 26, 18, 10), { dither: 0.3 });
  f.paint(M.ellipse(18, 28, 11, 4), 'ink', flat(0.9));
  for (const x of [4, 30]) f.paint(M.rect(x, 6, 3, 24), 'wood', cyl(x + 1, 2));
  f.paint(M.poly([[0, 8], [18, 0], [36, 8], [34, 10], [18, 3], [2, 10]]), 'roof', flat(0.45));
  f.paint(M.line(18, 6, 18, 18), 'shroud', flat(0.5)); f.paint(M.rect(16, 18, 5, 5), 'wood', bevel(M.rect(16, 18, 5, 5), 0.5, 0.8, 0.2));
  return f.outline();
}
function noticeBoard() {
  const f = new Frame(30, 40);
  for (const x of [3, 25]) f.paint(M.rect(x, 4, 2, 36), 'wood', flat(0.4));
  const b = M.rect(1, 4, 28, 22); f.paint(b, 'wood', bevel(b, 0.42, 0.75, 0.15));
  for (const [x, y, w, h] of [[4, 7, 8, 10], [14, 6, 10, 8], [15, 15, 9, 9], [5, 18, 7, 6]]) { f.paint(M.rect(x, y, w, h), 'bone', flat(0.75)); for (let yy = y + 2; yy < y + h - 1; yy += 2) f.paint(M.rect(x + 1, yy, w - 2, 1), 'bone', flat(0.25)); }
  // A wanted poster of the Saint.
  f.paint(M.ellipse(10, 11, 2.5, 2.8), 'crimson', flat(0.6)); P(f, 10, 11, 'ink0'); P(f, 11, 11, 'ink0');
  return f.outline();
}
function stocks() {
  const f = new Frame(36, 32);
  for (const x of [4, 30]) f.paint(M.rect(x, 10, 3, 22), 'wood', flat(0.4));
  const bd = M.rect(2, 10, 32, 7); f.paint(bd, 'wood', bevel(bd, 0.45, 0.8, 0.2));
  f.paint(M.ellipse(18, 9, 3.5, 3.4), 'skin', sphere(17, 8, 4, 4)); P(f, 18, 9, 'ink0'); P(f, 20, 9, 'ink0');
  f.paint(M.ellipse(18, 6, 3.6, 1.6), 'shroud', flat(0.3));
  for (const x of [9, 26]) f.paint(M.rect(x, 12, 3, 3), 'skin', flat(0.6));
  f.paint(M.poly([[12, 31], [24, 31], [22, 17], [14, 17]]), 'shroud', cyl(18, 6));
  P(f, 13, 22, 'blood2'); P(f, 21, 25, 'rot2');
  return f.outline();
}
function scryingPool(i) {
  const f = new Frame(80, 34);
  const ring = M.ellipse(40, 18, 38, 14); f.paint(ring, 'stone', sphere(34, 12, 44, 20), { dither: 0.3 });
  const water = M.ellipse(40, 16, 32, 10);
  f.paint(water, 'violet', (x, y) => 0.55 + Math.sin(x * 0.3 + y * 0.6 + i * 2) * 0.12 + Math.max(0, 0.4 - Math.hypot(x - 40, (y - 16) * 2) / 40), { dither: 0.6 });
  // The scrying image: a tiny red-hooded Saint, fighting.
  f.paint(M.ellipse(40 + i, 14, 3, 3.4), 'crimson', flat(0.8)); P(f, 41 + i, 14, 'flame0'); f.paint(M.ellipse(40 + i, 18, 3.2, 2), 'cloth', flat(0.7));
  for (const [x, y] of [[30, 13], [50, 17], [34, 20]]) P(f, x + i, y, 'rot1');
  f.paint(M.minus(M.ellipse(40, 16, 33, 11), water), 'gold', flat(0.55));
  return f.outline();
}
function child(t, v) {
  const f = new Frame(14, 20), B = t % 2;
  const robe = v ? 'moss' : 'crimson';
  f.paint(M.poly([[4, 8 + B], [10, 8 + B], [11, 17], [3, 17]]), robe, cyl(7, 4));
  const l = [[-1, 1], [0, 0], [1, -1], [0, 0]][t];
  P(f, 5 + l[0], 18, 'shroud1'); P(f, 9 + l[1], 18, 'shroud1'); P(f, 5 + l[0], 19, 'shroud2'); P(f, 9 + l[1], 19, 'shroud2');
  f.paint(M.ellipse(7, 5 + B, 3.4, 3.4), 'skin', sphere(6, 4 + B, 4, 4));
  f.paint(M.and(M.ellipse(7, 4 + B, 3.6, 3.4), M.rect(0, 0, 14, 4 + B)), v ? 'wood' : 'gold', flat(0.4));
  P(f, 8, 5 + B, 'ink0'); P(f, 10, 5 + B, 'ink0');
  if (!v) { // playing the Saint: a cardboard halo
    f.paint(M.minus(M.ellipse(7, 0.5 + B, 3.5, 1), M.ellipse(7, 0.5 + B, 2, 0.2)), 'gold', flat(0.9));
  } else f.paint(M.rect(11, 8 + B, 3, 4), 'gold', flat(0.7)); // the Bellwright's bell
  return f.outline();
}

// Walking townsfolk (4 frames) built on the NPC body.
function walker(spec) { return [0, 1, 2, 3].map((t) => npc({ ...spec, step: [[-1, 1], [0, 0], [1, -1], [0, 0]][t] }, t % 2)); }

function town2Sheet() {
  return sheet('town2', {
    cathedral: [cathedral()], gate: [cityGate()], tall: [0, 1, 2, 3, 4, 5].map(tallHouse), ruin: [ruin()], mausoleum: [mausoleum()], plush: [plushStall()],
    gallows: [gallows(0), gallows(1)], cart: [cart()], brazier: [brazier(0), brazier(1), brazier(2)], campfire: [campfire(0), campfire(1), campfire(2)],
    tomb: [0, 1, 2].map(tombstone), tree: [deadTree()], fence: [fence()], crow: [0, 1, 2, 3].map(crow), well: [well()], board: [noticeBoard()], stocks: [stocks()],
    pool: [scryingPool(0), scryingPool(1), scryingPool(2)],
    kid: [0, 1, 2, 3].map((t) => child(t, 0)), kid2: [0, 1, 2, 3].map((t) => child(t, 1)),
    peasant_walk: walker({ robe: 'shroud', head: 'hair' }), peasant2_walk: walker({ robe: 'violet', robeMin: 2, head: 'nun' }),
    guard_walk: walker({ robe: 'iron', robeMin: 1, apron: 'crimson', head: 'bald', hat: 'iron', prop: 'spear' }),
    penitent_walk: walker({ robe: 'skin', head: 'bald', prop: 'whip' }), priest_walk: walker({ robe: 'violet', robeMin: 1, apron: 'gold', head: 'tonsure', prop: 'rosary' }),
    plushseller: [npc({ robe: 'violet', head: 'hair', prop: 'mug' }, 0), npc({ robe: 'violet', head: 'hair', prop: 'mug' }, 1)],
    vane: [npc({ robe: 'cloth', robeMin: 1, apron: 'gold', head: 'bald', hat: 'gold', prop: 'rosary' }, 0), npc({ robe: 'cloth', robeMin: 1, apron: 'gold', head: 'bald', hat: 'gold', prop: 'rosary' }, 1)],
    beggar: [npc({ robe: 'shroud', robeMin: 2, head: 'hair', beard: true }, 0), npc({ robe: 'shroud', robeMin: 2, head: 'hair', beard: true }, 1)],
  });
}

// ============================================================ hall v4 ===
// Warm torch-lit halls in the Otherworld Legends manner: long flagstones,
// teal walls with a brick moulding, stained glass, statues and torches.

function slab(v) { // 32x16 running-bond flagstone
  const f = new Frame(32, 16);
  const m = M.rect(0, 0, 31, 15);
  const ramp = v === 6 ? 'pot' : 'flag';
  const tone = (ramp === 'brick' ? 0.5 : 0.46) + (hash(v, 1) - 0.5) * 0.14;
  f.paint(m, ramp, (x, y) => {
    let t = tone + (x / 31 - 0.5) * -0.06 + (hash(x, y, v * 13) - 0.5) * 0.05;
    if (y === 0) t += 0.2; else if (y === 1) t += 0.08;
    if (x === 0) t += 0.08;
    if (y === 14) t -= 0.22; if (x === 30) t -= 0.12;
    return t;
  }, { min: 1, max: 4, dither: 0.25 });
  for (let x = 0; x < 32; x++) P(f, x, 15, 'flag4');
  for (let y = 0; y < 16; y++) P(f, 31, y, 'flag4');
  if (v === 3) { let x = 6, y = 3; for (let i = 0; i < 10; i++) { P(f, x, y, 'flag4'); P(f, x + 1, y, 'flag3h'); if (hash(i, 9) < 0.5) x += 2; else y++; } }
  if (v === 4) { P(f, 29, 13, 'flag4'); P(f, 30, 13, 'flag4'); P(f, 30, 12, 'flag4'); P(f, 1, 1, 'flag3'); }
  if (v === 7) for (const [x, y] of [[3, 3], [27, 3], [3, 11], [27, 11]]) { P(f, x, y, 'iron1'); P(f, x + 1, y + 1, 'iron3'); P(f, x, y + 1, 'iron2'); }
  if (v === 5) for (let k = 0; k < 6; k++) P(f, 10 + k * 2, 8 + (k % 2), 'flag3');
  return f;
}

function hallUpper() { // teal ashlar, 16x16
  const f = new Frame(16, 16);
  for (let row = 0; row < 2; row++) {
    const y0 = row * 8, off = row ? 8 : 0;
    for (let bx = -16; bx < 16; bx += 16) {
      const blk = M.and(M.rect(bx + off, y0, 15, 7), M.rect(0, 0, 16, 16));
      f.paint(blk, 'teal', (x, y) => bevel(blk, 0.4 + hash(bx, row, 3) * 0.1, 0.62, 0.2)(x, y) + (hash(x, y, 5) - 0.5) * 0.05, { min: 1, dither: 0.25 });
    }
    for (let x = 0; x < 16; x++) P(f, x, y0 + 7, 'teal4');
    P(f, (off + 15) % 16, y0, 'teal4'); for (let y = y0; y < y0 + 7; y++) P(f, (off + 15) % 16, y, 'teal4');
  }
  return f;
}
function hallLower() { // ashlar with the brick moulding ledge
  const f = hallUpper();
  const ledge = M.rect(0, 8, 16, 6);
  f.paint(ledge, 'brick', (x, y) => (y === 8 ? 0.85 : y === 9 ? 0.6 : y === 13 ? 0.15 : 0.42) + ((x % 4 === 0 && y > 9 && y < 13) ? -0.2 : 0), { dither: 0.2 });
  f.paint(M.rect(0, 14, 16, 2), 'ink', vgrad(14, 15, 0.6, 0.9));
  return f;
}
function hallCap() {
  const f = new Frame(16, 16);
  f.paint(M.rect(0, 0, 16, 16), 'teal', flat(0.05), { min: 4, max: 4, dither: 0 });
  f.paint(M.rect(0, 10, 16, 3), 'teal', vgrad(10, 12, 0.75, 0.45), { dither: 0 });
  f.paint(M.rect(0, 13, 16, 3), 'brick', vgrad(13, 15, 0.7, 0.3), { dither: 0 });
  return f;
}
function hallTop() { const f = new Frame(16, 16); f.paint(M.rect(0, 0, 16, 16), 'teal', (x, y) => ((x * 7 + y * 3) % 13 === 0 ? 0.12 : 0.02), { min: 4, max: 4, dither: 0 }); f.paint(M.rect(0, 0, 16, 16), 'ink', flat(0.55), { min: 2, max: 2 }); return f; }

function stainedGlass() {
  const f = new Frame(16, 32);
  const win = M.union(M.rect(3, 8, 10, 18), M.ellipse(8, 8, 5, 5));
  f.paint(M.union(M.rect(2, 7, 12, 20), M.ellipse(8, 7.5, 6, 6)), 'stone', bevel(M.union(M.rect(2, 7, 12, 20), M.ellipse(8, 7.5, 6, 6)), 0.5, 0.85, 0.2));
  const panes = ['violet', 'crimson', 'gold', 'holy', 'moss'];
  for (const k of win) {
    const [x, y] = k.split(',').map(Number);
    const cell = Math.floor((x - 3) / 3) + Math.floor((y - 3) / 4) * 4;
    const rp = panes[Math.floor(hash(cell, 7) * panes.length)];
    f.paint(M.pts([[x, y]]), rp, flat(0.75 - (y - 3) / 40 + (hash(x, y, 2) - 0.5) * 0.2), { max: 3, dither: 0.4 });
  }
  for (const k of win) { const [x, y] = k.split(',').map(Number); if ((x - 3) % 3 === 2 || (y - 3) % 4 === 3) P(f, x, y, 'ink1'); }
  f.paint(M.rect(2, 26, 12, 2), 'stone', flat(0.7));
  return f.outline();
}
function swallowBanner() {
  const f = new Frame(16, 32);
  f.paint(M.rect(0, 1, 16, 2), 'gold', vgrad(1, 2, 0.95, 0.5));
  const cloth = M.poly([[1, 3], [15, 3], [15, 28], [8, 23], [1, 28]]);
  f.paint(cloth, 'crimson', cyl(6.5, 8, 0.05));
  for (const x of [4, 11]) f.shift(M.and(M.line(x, 4, x, 26), cloth), 1);
  f.paint(M.and(M.union(M.edge(cloth, -1, 0), M.edge(cloth, 1, 0), M.rows(cloth, 3, 4)), cloth), 'gold', flat(0.6));
  f.paint(M.and(M.union(M.edge(cloth, 0, 1), M.edge(cloth, -1, 1), M.edge(cloth, 1, 1)), cloth), 'gold', flat(0.45));
  // Sigil: a gold halo crowning a weeping eye.
  f.paint(M.minus(M.ellipse(8, 9, 4, 1.6), M.ellipse(8, 9, 2.4, 0.4)), 'gold', (x) => 1 - (x - 4) / 8);
  f.paint(M.ellipse(8, 14, 3.4, 2), 'gold', sphere(7, 13, 4, 3, 0.1)); f.paint(M.ellipse(8, 14, 1.2, 1.2), 'ink', flat(1));
  f.paint(M.line(8, 16, 8, 20), 'gold', flat(0.55));
  return f.outline();
}
function wallTorch() {
  const f = new Frame(16, 32);
  f.paint(M.union(M.rect(7, 16, 2, 8), M.line(4, 22, 11, 22)), 'iron', flat(0.4), { min: 1 });
  f.paint(M.poly([[4, 12], [12, 12], [10, 17], [6, 17]]), 'iron', bevel(M.poly([[4, 12], [12, 12], [10, 17], [6, 17]]), 0.45, 0.85, 0.1));
  return f.outline();
}
function torchStand(i) {
  const f = new Frame(18, 56);
  f.paint(M.union(M.line(9, 20, 9, 52), M.line(9, 48, 3, 55), M.line(9, 48, 15, 55)), 'iron', cyl(8.5, 3), { min: 1, dither: 0 });
  f.paint(M.ellipse(9, 34, 2, 1.4), 'gold', flat(0.7));
  const bowl = M.poly([[3, 15], [15, 15], [12, 21], [6, 21]]);
  f.paint(bowl, 'iron', bevel(bowl, 0.45, 0.9, 0.12));
  f.paint(M.rect(3, 15, 12, 1), 'gold', flat(0.7));
  f.outline();
  // A big, living flame.
  const sway = [0, 1, 0, -1][i], tall = [0, 2, 1, 3][i];
  const flameM = M.union(M.ellipse(9, 11, 4.4, 4), M.poly([[5, 11], [13, 11], [9 + sway, 1 - tall]]), M.poly([[6, 9], [9, 9], [6 - sway, 3 - tall]]));
  f.paint(flameM, 'ember', (x, y) => 0.25 + Math.max(0, 1 - Math.hypot(x - 9, y - 12) / 7) * 0.9, { dither: 0.6 });
  f.paint(M.ellipse(9, 12, 1.6, 2), 'ember', flat(1), { dither: 0 }); P(f, 9, 12, 'white');
  return f;
}
function pedestalStatue(kind) {
  const f = new Frame(30, 62);
  const ped = M.rect(4, 44, 22, 16);
  f.paint(ped, 'brick', bevel(ped, 0.32, 0.6, 0.12));
  f.paint(M.rect(3, 42, 24, 3), 'brick', bevel(M.rect(3, 42, 24, 3), 0.55, 0.85, 0.25));
  f.paint(M.rect(8, 48, 14, 8), 'brick', bevel(M.rect(8, 48, 14, 8), 0.2, 0.1, 0.5));
  f.paint(M.ellipse(15, 52, 2, 2), 'gold', sphere(14, 51, 3, 3, 0.1));
  if (kind === 'saint') {
    const robe = M.poly([[10, 18], [20, 18], [23, 42], [7, 42]]); f.paint(robe, 'pot', cyl(14, 9), { min: 1 });
    for (const x of [11, 15, 19]) f.shift(M.and(M.line(x, 24, x + (x - 15) * 0.2, 41), robe), 1);
    f.paint(M.union(M.ellipse(15, 13, 4.4, 4.8), M.poly([[11, 12], [13, 6], [16, 9]])), 'pot', sphere(13, 11, 6, 6));
    f.paint(M.line(21, 14, 21, 40, 2), 'iron', flat(0.75)); f.paint(M.line(18, 20, 24, 20), 'gold', flat(0.8));
    f.paint(M.minus(M.ellipse(14, 5, 6, 1.8), M.ellipse(14, 5, 4, 0.5)), 'gold', (x) => 1 - x / 30);
  } else if (kind === 'angel') {
    for (const side of [-1, 1]) f.paint(M.poly([[15, 20], [15 + side * 13, 6], [15 + side * 12, 26]]), 'pot', flat(side < 0 ? 0.72 : 0.42), { min: 1 });
    const robe = M.poly([[11, 20], [19, 20], [22, 42], [8, 42]]); f.paint(robe, 'pot', cyl(14, 8));
    f.paint(M.ellipse(15, 15, 4, 4.4), 'pot', sphere(13, 13, 5, 5));
    f.paint(M.union(M.line(12, 24, 15, 28, 2), M.line(18, 24, 15, 28, 2)), 'pot', flat(0.8));
  } else { // a mourning knight
    const body = M.union(M.ellipse(15, 26, 7, 8), M.rect(9, 30, 12, 12)); f.paint(body, 'pot', sphere(13, 22, 9, 10), { min: 1 });
    f.paint(M.ellipse(15, 15, 4.6, 4.6), 'pot', sphere(13, 13, 5, 5)); f.paint(M.rect(11, 14, 8, 1), 'pot', flat(0.1), { min: 3 });
    const sh = M.rect(4, 24, 8, 14); f.paint(sh, 'pot', bevel(sh, 0.5, 0.85, 0.2)); f.paint(M.union(M.rect(7, 26, 2, 10), M.rect(5, 29, 6, 2)), 'gold', flat(0.7));
  }
  for (const [x, y] of [[6, 59], [7, 59], [22, 58], [23, 59]]) P(f, x, y, 'moss2');
  return f.outline();
}
function skullCandle(i) {
  const f = new Frame(14, 18);
  f.paint(M.ellipse(7, 13, 4.4, 3.8), 'bone', sphere(6, 12, 5, 5)); P(f, 5, 13, 'ink0'); P(f, 8, 13, 'ink0'); P(f, 7, 15, 'ink1');
  f.paint(M.rect(5, 5, 4, 7), 'pot', cyl(6, 2.5)); f.paint(M.rect(4, 9, 2, 3), 'pot', flat(0.8));
  f.outline();
  for (const [x, y, c] of [[7, 1 + (i ? 1 : 0), 'ember0'], [7, 2, 'ember0'], [7, 3, 'ember1'], [6, 3, 'ember2'], [7, 4, 'ember1']]) P(f, x, y, c);
  return f;
}
function crate2() {
  const f = new Frame(26, 26);
  const top = M.poly([[1, 6], [25, 6], [25, 9], [1, 9]]);
  const front = M.rect(1, 9, 24, 15);
  f.paint(front, 'wood', bevel(front, 0.38, 0.7, 0.12));
  f.paint(top, 'wood', flat(0.78));
  for (let x = 1; x < 25; x += 6) f.shift(M.rect(x, 10, 1, 14), 1);
  f.paint(M.union(M.line(2, 10, 24, 22), M.line(24, 10, 2, 22)), 'wood', flat(0.55));
  for (const [x, y] of [[1, 9], [22, 9], [1, 21], [22, 21]]) f.paint(M.rect(x, y, 3, 3), 'iron', flat(0.6));
  return f.outline();
}
function urn2(v) {
  const f = new Frame(16, 20);
  const body = M.union(M.ellipse(8, 12, 6, 6.5), M.rect(5, 2, 6, 4));
  f.paint(body, 'pot', sphere(6, 9, 7, 8), { min: v ? 1 : 0 });
  f.paint(M.rect(4, 2, 8, 1), 'pot', flat(0.85)); f.paint(M.ellipse(8, 2.5, 2.5, 0.8), 'ink', flat(1));
  f.paint(M.rect(2, 10, 12, 2), v ? 'brick' : 'teal', (x) => 0.8 - x / 16);
  for (let x = 3; x < 13; x += 3) P(f, x, 14, 'pot3');
  return f.outline();
}

function hallSheet() {
  return sheet('hall', {
    slab: [0, 1, 2, 3, 4, 5, 6, 7].map(slab),
    wall: [hallTop(), hallCap(), hallUpper(), hallLower()],
    decor: [stainedGlass(), swallowBanner(), wallTorch()],
    torch: [0, 1, 2, 3].map(torchStand),
    statue_saint: [pedestalStatue('saint')], statue_angel: [pedestalStatue('angel')], statue_knight: [pedestalStatue('knight')],
    skullcandle: [skullCandle(0), skullCandle(1)], crate: [crate2()], urn: [urn2(0), urn2(1)],
  });
}

// ========================================================== Saint v2 ===
// Taller and less chibi: visible legs and boots, a doublet, a knee-length
// tabard, a long cape, the hollow hood and the cracked halo.
function saint2({ bob = 0, halo = 0, legs = [0, 0], lift = [0, 0], cape = 0, lean = 0, sway = 0, blink = false }) {
  const f = new Frame(34, 50, 3);
  const B = bob, X = lean;
  // Cape.
  const capeM = M.poly([[11 + X, 15 + B], [21 + X, 15 + B], [23 + cape, 40], [16 + cape, 42], [8 + cape, 41]]);
  f.paint(capeM, 'crimson', cyl(15 + X, 8, -0.3), { min: 2, dither: 0.3 });
  f.shift(M.and(M.line(13 + X, 20 + B, 11 + cape, 40), capeM), 1);
  // Legs and boots (back leg first).
  for (const [hx, l, up, back] of [[14, legs[0], lift[0], true], [18, legs[1], lift[1], false]]) {
    const knee = [hx + l * 0.5 + X * 0.3, 35 + B - up * 0.5], foot = [hx + l, 42 - up];
    const leg = M.union(M.line(hx + X * 0.5, 29 + B, knee[0], knee[1], 3), M.line(knee[0], knee[1], foot[0], foot[1], 3));
    f.paint(leg, 'shroud', cyl(hx + l * 0.5, 2.5, back ? -0.25 : 0), { min: 1 });
    const boot = M.union(M.rect(Math.round(foot[0]) - 1, Math.round(foot[1]) - 2, 4, 3), M.rect(Math.round(foot[0]) + 3, Math.round(foot[1]), 1, 1));
    f.paint(boot, 'wood', (x, y) => (y < foot[1] - 1 ? 0.55 : 0.25) - (back ? 0.2 : 0), { min: 2 });
  }
  // Back arm.
  f.paint(M.line(12 + X, 17 + B, 11 + X, 24 + B, 3), 'crimson', flat(0.2), { min: 2 });
  // Doublet.
  const torso = M.union(M.ellipse(16 + X, 20 + B, 5.5, 6), M.rect(11 + X, 21 + B, 11, 6));
  f.paint(torso, 'crimson', sphere(14 + X, 17 + B, 7, 8));
  // Tabard skirt with the gold stole and crosses.
  const tab = M.poly([[12 + X, 26 + B], [21 + X, 26 + B], [23 + sway, 37], [17 + sway, 38], [11 + sway, 37]]);
  f.paint(tab, 'cloth', cyl(16.5 + X * 0.5, 6), { max: 3, dither: 0.25 });
  const stole = M.and(M.poly([[15 + X, 15 + B], [18 + X, 15 + B], [18.5 + sway, 37], [15.5 + sway, 37]]), M.union(torso, tab));
  f.paint(stole, 'gold', cyl(16.5 + X * 0.6, 2.2));
  for (const y of [22, 31]) { const cx = 16.5 + X * 0.6 + (y > 26 ? sway * 0.6 : 0); P(f, cx, y + B, 'crimson2'); P(f, cx, y + B - 1, 'crimson3'); P(f, cx - 1, y + B, 'crimson3'); P(f, cx + 1, y + B, 'crimson3'); P(f, cx, y + B + 1, 'crimson3'); }
  f.paint(M.and(M.rows(tab, 36, 38), tab), 'gold', flat(0.55));
  // Belt with a buckle.
  f.paint(M.and(M.rect(10 + X, 26 + B, 13, 2), M.union(torso, tab)), 'wood', vgrad(26 + B, 27 + B, 0.6, 0.3));
  f.paint(M.rect(16 + X, 26 + B, 2, 2), 'gold', flat(0.9));
  // Mantle.
  const mantle = M.union(M.ellipse(16 + X, 16 + B, 7, 3.5), M.rect(10 + X, 15 + B, 13, 2));
  f.paint(mantle, 'crimson', sphere(14 + X, 14 + B, 8, 6, 0.05));
  f.paint(M.and(M.edge(mantle, 0, 1), mantle), 'gold', flat(0.5));
  // Front arm and the Nail Crossbow at the hip.
  const cy = 24 + B;
  f.paint(M.line(21 + X, 17 + B, 23 + X, cy - 1, 3), 'crimson', sphere(21 + X, 17 + B, 4, 6));
  f.paint(M.rect(20 + X, cy, 11, 2), 'wood', (x, y) => (y === cy ? 0.8 : 0.35) - ((x * 7) % 5 === 0 ? 0.15 : 0));
  const prod = []; for (let y = cy - 6; y <= cy + 7; y++) prod.push([30 + X - Math.round(((y - cy - 0.5) / 6.5) ** 2 * 2.5), y]);
  f.paint(M.pts(prod), 'iron', (x, y) => 0.95 - (y - cy + 6) / 14 * 0.7, { dither: 0 });
  f.paint(M.union(M.line(28 + X, cy - 5, 24 + X, cy), M.line(28 + X, cy + 6, 24 + X, cy + 1)), 'bone', flat(0.4), { dither: 0 });
  P(f, 31 + X, cy, 'gold0'); P(f, 32 + X, cy, 'white');
  f.paint(M.rect(23 + X, cy - 1, 2, 3), 'wood', flat(0.4));
  // Hood and the hollow face.
  const hx = 16 + X, hy = 9 + B;
  const hood = M.union(M.ellipse(hx, hy, 4.8, 4.8), M.poly([[hx - 5, hy - 1], [hx - 3, hy - 7], [hx, hy - 4]]));
  f.paint(hood, 'crimson', sphere(hx - 1.5, hy - 2, 6, 6));
  const face = M.ellipse(hx + 2, hy + 1, 2.2, 2.6);
  for (const k of face) { const [x, y] = k.split(',').map(Number); if (hood.has(k)) P(f, x, y, y <= hy ? 'ink2' : 'ink0'); }
  for (const k of face) { const [x, y] = k.split(',').map(Number); for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1]]) { const n = `${x + dx},${y + dy}`; if (hood.has(n) && !face.has(n)) P(f, x + dx, y + dy, dy < 0 ? 'gold1' : 'gold2'); } }
  // Halo.
  const ry = hy - 9 + halo;
  f.paint(M.minus(M.minus(M.ellipse(hx - 0.5, ry, 5.5, 2.1), M.ellipse(hx - 0.5, ry, 3.8, 0.9)), M.pts([[hx + 2, Math.round(ry) + 2], [hx + 3, Math.round(ry) + 2]])), 'gold', (x, y) => 0.95 - (x - hx + 6) / 12 * 0.6 - (y > ry ? 0.25 : 0), { dither: 0.3 });
  f.outline();
  if (!blink) { P(f, hx + 1, hy + 1, 'flame0'); P(f, hx + 3, hy + 1, 'flame1'); P(f, hx + 1, hy + 2, 'flame3'); P(f, hx + 3, hy + 2, 'flame4'); }
  else { P(f, hx + 1, hy + 1, 'flame3'); P(f, hx + 3, hy + 1, 'flame3'); }
  P(f, hx - 5, Math.round(ry) - 1, 'white');
  return f;
}
function saint2Sheet() {
  const idle = [0, 1, 2, 3].map((i) => saint2({ bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, -1, -1, 0][i], blink: i === 3 }));
  const run = [0, 1, 2, 3, 4, 5].map((i) => {
    const ph = i / 6 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
    return saint2({ bob: Math.abs(s) > 0.5 ? -1 : 0, halo: Math.abs(s) > 0.5 ? 0 : 1, legs: [Math.round(s * 4), Math.round(-s * 4)], lift: [c > 0.3 ? 2 : 0, c < -0.3 ? 2 : 0], cape: -3 - (Math.abs(s) > 0.5 ? 1 : 0), lean: 1, sway: s > 0 ? -1 : 0 });
  });
  const dash = [
    saint2({ lean: 2, legs: [-4, 3], lift: [1, 0], cape: -6, halo: 1, sway: -2 }),
    saint2({ lean: 3, legs: [-6, 4], lift: [2, 1], cape: -8, halo: 2, sway: -3 }),
    saint2({ lean: 1, legs: [-3, 2], lift: [0, 1], cape: -5, halo: 1, sway: -1 }),
  ];
  return sheet('saint', { idle, run, dash }, { anchorX: 17, anchorY: 45 });
}

// ================================================================= png ===

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(frame, scale = 1, bg = null) {
  const w = frame.w * scale, h = frame.h * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = frame.px[Math.floor(y / scale) * frame.w + Math.floor(x / scale)];
      const o = y * (w * 4 + 1) + 1 + x * 4;
      if (i < 0) { if (bg) { raw[o] = bg[0]; raw[o + 1] = bg[1]; raw[o + 2] = bg[2]; raw[o + 3] = 255; } continue; }
      const rgb = RGB[i];
      if (!rgb) throw new Error(`off-palette pixel index ${i}`);
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ================================================================ main ===

const sheets = [saint2Sheet(), hallSheet(), risenSheet(), wardenSheet(), tilesSheet(), wallDecorSheet(), propsSheet(), fxSheet(), uiSheet(), townSheet(), town2Sheet(), ...monsterSheets(), lootSheet()];
// Sheets that exist only in a model set (e.g. floor, vfx, icons).
for (const name of Object.keys(OVR)) if (!sheets.some((s) => s.name === name)) sheets.push(sheet(name, {}));
mkdirSync(OUT, { recursive: true });
const manifest = { palette: PALETTE };
for (const s of sheets) {
  writeFileSync(join(OUT, `${s.name}.png`), png(s.frame));
  manifest[s.name] = s.json;
}
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(manifest));

const pi = process.argv.indexOf('--preview');
if (pi > 0) {
  const dir = process.argv[pi + 1];
  mkdirSync(dir, { recursive: true });
  for (const s of sheets) writeFileSync(join(dir, `${s.name}@5x.png`), png(s.frame, 5, [58, 52, 70]));
}
console.log(`wrote ${sheets.length} sheets to assets/sprites/`);
