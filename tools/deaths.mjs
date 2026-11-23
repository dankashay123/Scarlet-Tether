// Round 158: each Warden's own death, played on its standing sprite. The frame is snapped to the chunky grid,
// read as 2x2 cells, and a small simulation moves those cells: a melt into a pool, a collapse into a heap,
// ash blown away, a fire burning upward, a statue shattering, a sinking into black water, an empty robe falling.
// Output frames are already blocky (f.fine skips the chunky pass) and use palette indices only.
import { chunkify } from './chunky.mjs';
import { RGB, IDX, ramp } from './palette.mjs';

const OUT = IDX.outline, N = 16, PADX = 24, PADT = 6, PADB = 2;
const lum = (i) => { const c = RGB[i]; return c ? (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255 : 0; };
const RAMPS = Object.fromEntries(['bone', 'sea', 'stone', 'ember', 'ink', 'holy', 'shroud', 'iron', 'crimson'].map((r) => [r, ramp(r)]));
// A colour moved onto another ramp at about the same lightness (index 0 = light).
const onto = (i, r, shift = 0) => { const R = RAMPS[r]; return R[Math.max(0, Math.min(R.length - 1, Math.round((1 - lum(i)) * (R.length - 1) + shift)))]; };
const isOf = (names) => { const s = new Set(); for (const n of names) for (const i of ramp(n)) s.add(i); return (i) => s.has(i); };
const ease = (t) => t * t * (3 - 2 * t);
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2246822519) >>> 0; h = ((h ^ (h >>> 13)) * 1274126177) >>> 0; return (h & 0xffff) / 65536; };

// The standing frame as cells on a padded canvas, with its ground row.
function cells(ref) {
  const c = { w: ref.w, h: ref.h, px: Int16Array.from(ref.px), ax: ref.ax, ay: ref.ay };
  chunkify(c);
  const W = Math.ceil(c.w / 2), H = Math.ceil(c.h / 2), OW = W + PADX * 2, OH = H + PADT + PADB, list = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = c.px[2 * y * c.w + 2 * x]; if (i >= 0) list.push({ x: x + PADX, y: y + PADT, c: i, ox: x + PADX, oy: y + PADT }); }
  const ground = Math.floor((c.ay - 1) / 2) + PADT, cx = Math.floor(c.ax / 2) + PADX;
  let top = ground; for (const p of list) top = Math.min(top, p.y);
  return { list, OW, OH, ground, cx, top, Hgt: ground - top + 1, ax: c.ax + PADX * 2, ay: c.ay + PADT * 2 };
}
// Cells to a 2x drawn frame, with a fresh outline round whatever is left.
function frame(G, grid, outline = true) {
  const { OW, OH } = G, at = (x, y) => (x < 0 || y < 0 || x >= OW || y >= OH ? -1 : grid[y * OW + x]);
  const g2 = Int16Array.from(grid);
  if (outline) for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) if (at(x, y) < 0 && (at(x - 1, y) >= 0 && at(x - 1, y) !== OUT || at(x + 1, y) >= 0 && at(x + 1, y) !== OUT || at(x, y - 1) >= 0 && at(x, y - 1) !== OUT || at(x, y + 1) >= 0 && at(x, y + 1) !== OUT)) g2[y * OW + x] = -2;
  const w = OW * 2, h = OH * 2, px = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) { let v = g2[y * OW + x]; if (v === -1) continue; if (v === -2) v = OUT; for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) px[(2 * y + b) * w + 2 * x + a] = v; }
  return { w, h, px, ax: G.ax, ay: G.ay, fine: true };
}
const blank = (G) => new Int16Array(G.OW * G.OH).fill(-1);
const put = (G, g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < G.OW && y < G.OH && y <= G.ground) g[y * G.OW + x] = c; };
const putAny = (G, g, x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < G.OW && y < G.OH) g[y * G.OW + x] = c; };
// A flat pool on the ground, half width hw, in a ramp, lit along its top edge.
function pool(G, g, hw, r, rows = 2, cx = G.cx) {
  const R = RAMPS[r];
  for (let dy = 0; dy < rows; dy++) { const w = Math.round(hw * (1 - dy * 0.0) - (rows - 1 - dy) * 2); for (let x = -w; x <= w; x++) { const edge = Math.abs(x) > w - 2; put(G, g, cx + x, G.ground - dy, dy === rows - 1 ? R[edge ? 5 : 3] : R[edge ? 7 : 5]); } }
  for (let x = -Math.round(hw * 0.5); x <= Math.round(hw * 0.2); x += 3) put(G, g, cx + x, G.ground - rows + 1, R[1]);
}

// ---- the kinds ----
// melt: columns sink into a spreading pool; cells take the pool's colour as they go. keep: colours that ride the
// top of their column (candle flames, a mitre), put out at keepOut (then a thread of smoke).
function melt(G, { pool: pr, keep, keepOut = 2, recolour = true, rows = 2 }) {
  const cols = new Map(); for (const p of G.list) { if (!cols.has(p.x)) cols.set(p.x, []); cols.get(p.x).push(p); }
  let x0 = 1e9, x1 = -1e9; for (const p of G.list) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
  const half = (x1 - x0) / 2, out = [];
  // smooth per-column delay (no stripes): a sum of two slow waves
  const dly = (x) => 0.12 + 0.1 * Math.sin(x * 0.31) + 0.06 * Math.sin(x * 0.83 + 1);
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G), kept = [], spread = 1 + ease(t) * 0.35;
    for (let X = x0 - Math.ceil(half); X <= x1 + Math.ceil(half); X++) {
      const sx = Math.round(G.cx + (X - G.cx) / spread), ps = cols.get(sx); if (!ps) continue;
      const d = dly(sx), tt = ease(Math.max(0, Math.min(1, (t - d) / (1 - d)))), k = 1 - tt * 0.8;
      for (const p of ps) {
        const h = G.ground - p.y, ny = G.ground - Math.round(h * k);
        if (keep && keep(p.c)) { if (X === Math.round(G.cx + (p.x - G.cx) * spread)) kept.push({ x: X, y: ny, c: p.c }); continue; }
        put(G, g, X, ny, recolour && hash(p.x, p.y, 1) < tt * 1.3 ? onto(p.c, pr) : p.c);
      }
    }
    pool(G, g, Math.round(half * (0.6 + ease(t) * 1.0)), pr, rows);
    if (keep && t < keepOut) for (const p of kept) putAny(G, g, p.x, Math.min(p.y, G.ground - rows), p.c);
    else if (keep) { const s2 = (t - keepOut) / (1 - keepOut); for (const p of kept) if (hash(p.x, p.y, 4) < 0.35) { const rise = Math.round(s2 * 10 + hash(p.x, p.y) * 3), sx = Math.round(Math.sin(rise * 0.7 + p.x) * 1.2); if (s2 < 0.9) putAny(G, g, p.x + sx, Math.min(p.y, G.ground - rows) - rise, RAMPS.stone[s2 < 0.5 ? 2 : 4]); } }
    out.push(frame(G, g));
  }
  return out;
}
// crumble: everything falls, the top first and farthest, and piles up into a heap (sand rule).
function crumble(G, { spread = 0.5, seed = 5 } = {}) {
  const r = rnd(seed), ps = G.list.map((p) => ({ ...p, vx: (p.x - G.cx) * 0.012 * spread + (r() - 0.5) * 0.35 * spread, vy: 0, d: (G.ground - p.y) / G.Hgt * 0.12 + r() * 0.06, done: false, fy: p.y }));
  ps.sort((a, b) => b.y - a.y);
  const hgt = new Map(), H = (x) => (hgt.has(x) ? hgt.get(x) : G.ground);
  const out = [], steps = 6;
  for (let f = 0; f < N; f++) {
    for (let s = 0; s < steps; s++) {
      const t = (f * steps + s) / ((N - 1) * steps);
      for (const p of ps) {
        if (p.done || t < p.d) continue;
        p.vy += 0.09; p.fy += p.vy; p.x += p.vx;
        const cx = Math.round(p.x);
        if (p.fy >= H(cx)) {
          let x = cx; for (let k = 0; k < 10; k++) { const L = H(x - 1), R = H(x + 1), M = H(x); if (L > M && R <= L) x--; else if (R > M) x++; else break; }
          p.x = x; p.fy = H(x); p.done = true; if (hash(p.ox, p.oy, 6) < 0.45) { p.gone = true; continue; } hgt.set(x, H(x) - 1);
        }
      }
    }
    const g = blank(G); for (const p of ps) if (!p.gone) put(G, g, p.x, Math.round(p.fy), p.c);
    out.push(frame(G, g));
  }
  return out;
}
// ash: from the top down, cells grey, lift off and blow away; the feet leave a small heap of ash.
function ash(G, { wind = 1, r = 'stone', light = 0 } = {}) {
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G);
    for (const p of G.list) {
      const h = G.ground - p.y, low = h < 3;
      const td = 0.08 + 0.62 * (1 - h / G.Hgt) + hash(p.x, p.y) * 0.12;
      if (low) { put(G, g, p.x + Math.round((p.x - G.cx) * ease(t) * 0.3), p.y, t > 0.3 ? onto(p.c, r, 1) : p.c); continue; }
      if (t < td - 0.14) { put(G, g, p.x, p.y, p.c); continue; }
      if (t < td) { put(G, g, p.x, p.y, onto(p.c, r, light)); continue; }
      const a = (t - td) * N, life = 3 + hash(p.x, p.y, 2) * 4;
      if (a > life) continue;
      putAny(G, g, p.x + a * wind * (0.6 + hash(p.x, p.y, 3)), p.y - a * (0.3 + hash(p.x, p.y, 5) * 0.6), hash(p.x, p.y, 8) < 0.12 && a < 3 ? RAMPS.ember[2] : onto(p.c, r, light + (a > life * 0.6 ? 2 : 0)));
    }
    // the heap grows from what fell
    for (let x = -4; x <= 4; x++) if (t > 0.4) put(G, g, G.cx + x * 2 + (x & 1), G.ground - (Math.abs(x) < 2 && t > 0.7 ? 1 : 0), RAMPS[r][4 + (x & 1)]);
    out.push(frame(G, g));
  }
  return out;
}
// burn: a band of fire climbs from the feet; above it the body stands, inside it glows, below it is charred and
// falls into a black heap.
function burn(G) {
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G), L = ease(t) * (G.Hgt + 2), sinkBy = Math.max(0, L - 4);
    for (const p of G.list) {
      const h0 = G.ground - p.y, h = h0 - sinkBy + hash(p.x, 1) * 2;
      if (h < 1) continue;
      const y = p.y + Math.round(sinkBy);
      if (h > 6) put(G, g, p.x, y, p.c);
      else put(G, g, p.x, y, RAMPS.ember[Math.max(0, Math.min(8, Math.round(h * 1.3) + (hash(p.x, p.y, f) < 0.3 ? 1 : 0)))]);
    }
    // a heap of char and embers that grows as it burns down
    const hw = Math.round(4 + ease(t) * 10);
    for (let x = -hw; x <= hw; x++) { const hh = t > 0.2 ? Math.max(1, Math.round((1 - Math.abs(x) / (hw + 1)) * (1 + ease(t) * 3))) : 0; for (let y = 0; y < hh; y++) put(G, g, G.cx + x, G.ground - y, hash(x, y, f) < 0.18 ? RAMPS.ember[t > 0.9 ? 6 : 3] : RAMPS.ink[3 + ((x + y) & 1)]); }
    out.push(frame(G, g));
  }
  return out;
}
// heap: the body breaks into bone-sized chunks that drop and stack on one another into a pile.
function heap(G, { pieces = 46, seed = 13, spread = 0.5 } = {}) {
  const r = rnd(seed), seeds = []; for (let k = 0; k < pieces; k++) { const p = G.list[Math.floor(r() * G.list.length)]; seeds.push({ x: p.x, y: p.y }); }
  const own = G.list.map((p) => { let b = 0, bd = 1e9; seeds.forEach((q, k) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 * 1.4; if (d < bd) { bd = d; b = k; } }); return b; });
  const P = seeds.map(() => ({ cells: [], x: 0, y: 0, vx: 0, vy: 0, rest: false }));
  G.list.forEach((p, i) => P[own[i]].cells.push(p));
  for (const q of P) { if (!q.cells.length) { q.rest = true; continue; } const mx = q.cells.reduce((a, c) => a + c.x, 0) / q.cells.length, my = q.cells.reduce((a, c) => a + c.y, 0) / q.cells.length; q.vx = ((mx - G.cx) * 0.015 + (r() - 0.5) * 0.3) * spread; q.d = (my - (G.ground - G.Hgt)) / G.Hgt * 0.15 + r() * 0.05; q.bot = Math.max(...q.cells.map((c) => c.y)); }
  const hgt = new Map(), H = (x) => (hgt.has(x) ? hgt.get(x) : G.ground + 1);
  const order = P.filter((q) => q.cells.length).sort((a, b) => b.bot - a.bot);
  // Plan where each piece lands: lowest first, higher pieces thrown wider, each dropped onto the heap below it.
  for (const q of order) {
    const mx = q.cells.reduce((a, c) => a + c.x, 0) / q.cells.length, up = (G.ground - q.bot) / G.Hgt;
    q.tx = Math.round((mx - G.cx) * 0.35 * spread + (r() - 0.5) * G.Hgt * 0.9 * up * spread);
    const rest = (dx) => { let ty = 1e9; for (const c of q.cells) ty = Math.min(ty, H(c.x + dx) - 1 - c.y); return ty; };
    const side = q.tx === 0 ? (r() < 0.5 ? -1 : 1) : Math.sign(q.tx);
    // roll outward while that lets it rest at least 2 cells lower (or while it would sit above where it started)
    for (let k = 0; k < 30; k++) { const here = rest(q.tx), next = rest(q.tx + side * 2); if (next >= here + 2 || here < 0) q.tx += side * 2; else break; }
    q.ty = rest(q.tx);
    for (const c of q.cells) { const X = c.x + q.tx, Y = c.y + q.ty; hgt.set(X, Math.min(H(X), Y)); }
    q.d = r() * 0.12 + (1 - up) * 0.08;
  }
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G);
    for (const q of order) { const u = Math.max(0, Math.min(1, (t - q.d) / 0.6)); for (const c of q.cells) put(G, g, c.x + q.tx * u, c.y + q.ty * u * u, c.c); }
    out.push(frame(G, g));
  }
  return out;
}
// shatter: cracks first, then pieces fly (force) and come to rest on the ground.
function shatter(G, { force = 1, pieces = 16, seed = 9, crackR = 'ink' } = {}) {
  const r = rnd(seed), seeds = []; for (let k = 0; k < pieces; k++) { const p = G.list[Math.floor(r() * G.list.length)]; seeds.push({ x: p.x, y: p.y }); }
  const own = G.list.map((p) => { let b = 0, bd = 1e9; seeds.forEach((s, k) => { const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2; if (d < bd) { bd = d; b = k; } }); return b; });
  const P = seeds.map(() => ({ n: 0, sx: 0, sy: 0, maxY: -1e9 }));
  G.list.forEach((p, i) => { const q = P[own[i]]; q.n++; q.sx += p.x; q.sy += p.y; q.maxY = Math.max(q.maxY, p.y); });
  const midY = G.ground - G.Hgt / 2;
  P.forEach((q) => { q.cx = q.sx / Math.max(1, q.n); q.cy = q.sy / Math.max(1, q.n); q.vx = ((q.cx - G.cx) * 0.06 + (r() - 0.5) * 0.6) * force; q.vy = (-0.5 - r() * 0.6 - (midY - q.cy) * 0.01) * force; q.x = 0; q.y = 0; q.rest = false; });
  const out = [], border = G.list.map((p, i) => G.list.some((o, j) => own[j] !== own[i] && Math.abs(o.x - p.x) + Math.abs(o.y - p.y) === 1));
  for (let f = 0; f < N; f++) {
    const g = blank(G);
    if (f < 3) { G.list.forEach((p, i) => put(G, g, p.x, p.y, border[i] && f > 0 && hash(p.x, p.y) < 0.5 + f * 0.2 ? RAMPS[crackR][7] : p.c)); out.push(frame(G, g)); continue; }
    for (let s = 0; s < 4; s++) for (const q of P) { if (q.rest) continue; q.vy += 0.12; q.x += q.vx; q.y += q.vy; if (Math.abs(q.x) > PADX - 4) { q.x = Math.sign(q.x) * (PADX - 4); q.vx *= -0.3; } if (q.maxY + q.y >= G.ground) { q.y = G.ground - q.maxY; if (Math.abs(q.vy) < 0.6) { q.rest = true; q.vy = 0; q.vx = 0; } else { q.vy *= -0.3; q.vx *= 0.6; } } }
    G.list.forEach((p, i) => { const q = P[own[i]]; put(G, g, p.x + q.x, p.y + q.y, p.c); });
    out.push(frame(G, g));
  }
  return out;
}
// sink: down into a black pool that opens under it, bubbles, then closes.
function sink(G, { r = 'sea' } = {}) {
  let x0 = 1e9, x1 = -1e9; for (const p of G.list) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); }
  const half = (x1 - x0) / 2, out = [], R = RAMPS[r];
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G), dn = Math.round(ease(Math.min(1, t * 1.25)) * (G.Hgt + 2)), open = Math.sin(Math.PI * Math.min(1, t * 1.05)), hw = Math.round(half * (0.5 + 0.6 * open));
    for (const p of G.list) { const y = p.y + dn; if (y <= G.ground - 1) put(G, g, p.x, y, hash(p.x, p.y) < t * 0.8 ? onto(p.c, r, 2) : p.c); }
    if (hw > 1) { for (let x = -hw; x <= hw; x++) { put(G, g, G.cx + x, G.ground, R[Math.abs(x) > hw - 2 ? 4 : 8]); put(G, g, G.cx + x, G.ground - 1, Math.abs(x) > hw - 3 ? R[3] : -1); } }
    if (t > 0.6 && t < 0.95) for (let k = 0; k < 3; k++) { const bx = G.cx + Math.round((hash(k, f) - 0.5) * hw * 1.4); put(G, g, bx, G.ground - 1 - Math.round(hash(k, f, 2) * 3), R[1]); }
    out.push(frame(G, g));
  }
  return out;
}
// hollow: the empty robe falls in on itself while light leaves it upward; keep (a mitre) rides down onto the heap.
function hollow(G, { keep, r = 'holy' } = {}) {
  const out = [];
  for (let f = 0; f < N; f++) {
    const t = f / (N - 1), g = blank(G), k = 1 - ease(t) * 0.82, kept = [];
    for (const p of G.list) {
      const h = G.ground - p.y, ny = G.ground - Math.round(h * k), up = h / G.Hgt;
      if (keep && keep(p.c)) { kept.push({ x: p.x + Math.round((p.x - G.cx) * ease(t) * 0.35), y: ny, c: p.c }); continue; }
      const leave = up > 0.55 && hash(p.x, p.y) < (t - 0.15) * 1.6 * (up - 0.4);
      if (leave) { const a = (t - 0.15) * N * (0.5 + hash(p.x, p.y, 2)); if (a < 6) putAny(G, g, p.x + Math.sin(a + p.x) * 1.5, ny - a * 1.4, RAMPS[r][a < 3 ? 2 : 4]); continue; }
      put(G, g, p.x + Math.round((p.x - G.cx) * ease(t) * 0.35), ny, p.c);
    }
    for (const q of kept) putAny(G, g, q.x, q.y, q.c);
    out.push(frame(G, g));
  }
  return out;
}

export const DEATH = {
  candlemass: (G) => melt(G, { pool: 'bone', keep: isOf(['flame', 'ember']), keepOut: 0.72, rows: 2 }),
  tideBishop: (G) => melt(G, { pool: 'sea', rows: 3 }),
  ossuarch: (G) => heap(G, { spread: 0.8 }),
  ashWidow: (G) => ash(G, { wind: 1.1, light: -3 }),
  charnelKing: (G) => burn(G),
  ladyOfNails: (G) => shatter(G, { force: 1.1, pieces: 22, crackR: 'ink' }),
  bellwright: (G) => shatter(G, { force: 0.45, pieces: 10, seed: 3, crackR: 'ember' }),
  organist: (G) => sink(G, { r: 'sea' }),
  cardinal: (G) => hollow(G, { keep: isOf(['gold']) }),
  hollowSaint: (G) => ash(G, { wind: 0.8, light: -2 }), // round 186: the shadow blows away like smoke
  doorkeeper: (G) => shatter(G, { force: 0.8, pieces: 16, seed: 5, crackR: 'ember' }), // round 182: the stone breaks; light leaks from the cracks
};
// The death frames for one Warden from its standing frame.
export const deathFrames = (id, ref) => DEATH[id](cells(ref));
