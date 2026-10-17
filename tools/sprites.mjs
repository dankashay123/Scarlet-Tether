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
import { RGB, IDX, PALETTE, RAMPS, ramp } from './palette.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'sprites');

// Reverse map: palette index -> [rampName, step].
const STEP = {};
for (const [name, r] of Object.entries(RAMPS)) r.forEach((_, i) => { STEP[IDX[`${name}${i}`]] = [name, i]; });

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
      let i = Math.round((1 - t) * 4 + (bayer(x, y + this.oy) - 0.5) * dither);
      i = Math.max(min, Math.min(max, i));
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
      this.set(x, y, `${name}${Math.max(0, Math.min(4, i + n))}`);
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

function sheet(name, anims, extra = {}) {
  const rows = Object.entries(anims);
  const cellW = Math.max(...rows.flatMap(([, fs]) => fs.map((f) => f.w)));
  const cellH = rows.map(([, fs]) => Math.max(...fs.map((f) => f.h)));
  const cols = Math.max(...rows.map(([, fs]) => fs.length));
  const W = cols * cellW, H = cellH.reduce((a, b) => a + b, 0);
  const big = new Frame(W, H);
  const json = { image: `${name}.png`, ...extra, anims: {} };
  let oy = 0;
  rows.forEach(([anim, frames], r) => {
    json.anims[anim] = frames.map((f, c) => {
      for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) big.px[(oy + y) * W + c * cellW + x] = f.px[y * f.w + x];
      return { x: c * cellW, y: oy, w: f.w, h: f.h };
    });
    oy += cellH[r];
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
  return sheet('tiles', {
    floor: [0, 1, 2, 3, 4, 5, 6, 7].map(floorTile),
    carpet: [0, 1, 2, 3, 4, 5].map(carpetTile),
    misc: [grate()],
    wall: [wallTop(), wallCap(), wallUpper(), wallLower()],
  });
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
  pause: (s, c) => { const u = s / 32; return M.union(M.rect(Math.round(c - 6 * u), Math.round(c - 7 * u), Math.round(4 * u), Math.round(14 * u)), M.rect(Math.round(c + 2 * u), Math.round(c - 7 * u), Math.round(4 * u), Math.round(14 * u))); },
};

function joyRing() {
  const f = new Frame(60, 60), c = 29.5;
  f.paint(M.minus(M.ellipse(c, c, 28, 28), M.ellipse(c, c, 26.5, 26.5)), 'cloth', flat(0.8), { dither: 0 });
  for (let a = 0; a < 4; a++) {
    const ang = a * Math.PI / 2, x = c + Math.cos(ang) * 23, y = c + Math.sin(ang) * 23;
    const px = -Math.sin(ang), py = Math.cos(ang);
    f.paint(M.union(M.line(x - px * 3 - Math.cos(ang) * 2, y - py * 3 - Math.sin(ang) * 2, x, y), M.line(x + px * 3 - Math.cos(ang) * 2, y + py * 3 - Math.sin(ang) * 2, x, y)), 'cloth', flat(0.8), { dither: 0 });
  }
  return f;
}
function joyKnob() {
  const f = new Frame(24, 24), c = 11.5;
  f.paint(M.ellipse(c, c, 10.5, 10.5), 'ink', flat(1));
  f.paint(M.ellipse(c, c, 9, 9), 'cloth', (x, y) => 1 - Math.max(0, y - c) / 18, { max: 1 });
  for (const k of M.union(M.rect(10, 5, 4, 14), M.rect(5, 10, 14, 4))) { const [x, y] = k.split(',').map(Number); P(f, x, y, 'ink0'); }
  for (const k of M.rect(11, 11, 2, 2)) { const [x, y] = k.split(',').map(Number); P(f, x, y, 'cloth0'); }
  return f;
}

function uiSheet() {
  const big = 38, small = 30;
  return sheet('ui', {
    dash: [button(big, G.dash)], flask: [button(small, G.flask)], chain: [button(small, G.chain)], penance: [button(big - 4, G.penance)],
    dagger: [button(small, G.dagger)], pause: [button(22, G.pause)], ring: [joyRing()], knob: [joyKnob()], portrait: [portrait()],
  });
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

const sheets = [saintSheet(), risenSheet(), wardenSheet(), tilesSheet(), wallDecorSheet(), propsSheet(), fxSheet(), uiSheet()];
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
