// Effects and small objects in the sculpted style, at the v5 size.
// Solid things (bolt, thurible, flask, chain, hook, dagger) are SDF models.
// Soft things (impacts, blood bursts, smoke, orbs) are 2D metaball forms lit
// from the top-left and banded onto palette ramps, with no dithering.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, bumpy, dot, pline, LIGHT } from '../sdf.mjs';
import { MATS, torus } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const frame = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const put = (f, x, y, name) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.px[y * f.w + x] = IDX[name]; };
const get = (f, x, y) => (x >= 0 && y >= 0 && x < f.w && y < f.h ? f.px[y * f.w + x] : -1);
const sh = (ramp, s) => FINE[ramp][clamp(Math.round(s), 0, 8)];

// --------------------------------------------------------- metaball forms ---
// balls: [x, y, r]. Lit as a soft dome; `outline` 'ramp' darkens the rim on
// the shaded side, 'ink' adds the usual dark outline, null leaves it bare.
export function blobs(w, h, balls, { ramp, min = 0, max = 8, outline = 'ramp', bias = 0, k = 1.6, f = frame(w, h) } = {}) {
  // Height = smooth union of sphere caps, so lobes melt together without dimples.
  const Hh = (x, y) => { let acc = 0; for (const [bx, by, r] of balls) { const d2 = (x - bx) ** 2 + (y - by) ** 2; if (d2 < r * r) acc += Math.exp(Math.sqrt(r * r - d2) * k); } return acc > 0 ? Math.log(acc) / k : -1; };
  const drawn = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x + 0.5, sy = y + 0.5, hc = Hh(sx, sy); if (hc < 0) continue;
    const hx = (a, b) => { const v = Hh(a, b); return v < 0 ? 0 : v; };
    const dx = (hx(sx + 0.5, sy) - hx(sx - 0.5, sy)), dy = (hx(sx, sy + 0.5) - hx(sx, sy - 0.5));
    const nl = Math.hypot(dx, dy, 1), n = [-dx / nl, -dy / nl, 1 / nl];
    const ndl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    const v = clamp((ndl + 0.25) / 1.25 + bias, 0, 1);
    put(f, x, y, sh(ramp, clamp(Math.round((1 - v) * 8), min, max)));
    drawn[y * w + x] = 1;
  }
  if (outline) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (drawn[y * w + x]) continue;
      let nb = false, lit = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && drawn[yy * w + xx]) { nb = true; if (dx > 0 || dy > 0) lit = true; } }
      if (nb && get(f, x, y) < 0) add.push([x, y, lit]);
    }
    for (const [x, y, lit] of add) put(f, x, y, outline === 'ink' ? (lit ? sh(ramp, 8) : 'outline') : sh(ramp, lit ? Math.min(8, max + 1) : 8));
  }
  return f;
}

// ---------------------------------------------------------------- energy ---
// A hit flash: white-hot core, gold rays, ember fringe.
function impact(i) {
  const S = 30, c = S / 2, f = frame(S, S);
  const core = [3.5, 5.5, 4.5, 0][i], ring = [0, 0, 7, 10][i], rayL = [9, 14, 13, 0][i], rayW = [2.2, 2.6, 1.6, 0][i];
  const n = 8, rot = i * 0.18;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let v = 0;
    if (core) v = Math.max(v, 1 - r / core);
    if (rayL) { const sec = ((a - rot) / (Math.PI * 2 / n) % 1 + 1) % 1, ad = Math.abs(sec - 0.5) * 2; const long = Math.round((a - rot) / (Math.PI * 2 / n)) % 2 === 0 ? 1 : 0.6; const along = 1 - r / (rayL * long); const across = 1 - (1 - ad) * r * 0.9 / rayW; if (along > 0) v = Math.max(v, Math.min(along * 1.2, across)); }
    if (ring) { const d = Math.abs(r - ring); v = Math.max(v, (1 - d / (i === 3 ? 1.1 : 1.6)) * (i === 3 ? 0.55 : 0.8)); }
    if (v <= 0.08) continue;
    put(f, x, y, v > 0.72 ? 'white' : v > 0.5 ? 'gold0' : v > 0.3 ? 'gold1' : v > 0.16 ? 'ember1' : 'ember2');
  }
  if (i >= 2) for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.4, r = i === 2 ? 11 : 13; put(f, c + Math.cos(a) * r, c + Math.sin(a) * r, i === 2 ? 'gold0' : 'ember1'); }
  return f;
}
// A blood burst: a lit splash that throws droplets.
function burst(i) {
  const W = 44, H = 36, cx = 22, cy = 18, balls = [];
  if (i === 0) balls.push([cx, cy, 6], [cx - 3, cy - 2, 4], [cx + 4, cy + 1, 4]);
  else {
    const spread = [0, 7, 13, 16][i], r = [0, 4.6, 3, 2.2][i];
    if (i === 1) balls.push([cx, cy, 5]);
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + hash(k, 1) * 0.5, d = spread * (0.6 + hash(k, 2) * 0.6); balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.6 + hash(k, 3) * 0.6)]); }
  }
  const f = blobs(W, H, balls, { ramp: 'blood', min: 0, max: 6, outline: 'ramp', bias: 0.08 });
  if (i < 2) { put(f, cx - 3, cy - 3, 'white'); put(f, cx - 2, cy - 3, 'blood0'); }
  return f;
}
// Smoke: soft grey puffs that swell and break apart.
function smoke(i) {
  const S = 26, c = 13, balls = [];
  const spread = [2, 5, 7, 9][i], r = [5, 5, 4, 2.6][i], n = [3, 5, 6, 6][i];
  for (let k = 0; k < n; k++) { const a = k * (Math.PI * 2 / n) + 0.3, d = spread * (0.7 + hash(k, 5) * 0.4); balls.push([c + Math.cos(a) * d, c + Math.sin(a) * d * 0.85 - i, r * (0.8 + hash(k, 6) * 0.35)]); }
  if (i < 2) balls.push([c, c - i, r + 1]);
  return blobs(S, S, balls, { ramp: 'stone', min: 0, max: 6, outline: i < 3 ? 'ramp' : null, bias: 0.16, k: 0.9 });
}
// Enemy shots: glowing orbs with a lit face and a bright glint.
function orb(ramp, { r = 4.2, tail = false } = {}) {
  const f = frame(16, 16), balls = [[8, 8, r]];
  if (tail) balls.push([5, 9, r * 0.6], [3, 10, r * 0.35]);
  blobs(16, 16, balls, { ramp, min: 0, max: 6, outline: 'ink', bias: 0.12, f });
  put(f, 7, 6, 'white'); put(f, 6, 7, sh(ramp, 0));
  return f;
}

// --------------------------------------------------------------- objects ---
const A = (f, ax, ay) => Object.assign(f, { ax, ay });
// The nail bolt, flying right: a forged iron nail with a gilt collar.
// Set bolts (docs/SETS.md): shaft, collar and point per vestment set.
const BOLTS = {
  nails: ['gold', 'crimson', 'gold0'], stride: ['emberLit', 'ember', 'ember0'], font: ['holy', 'iron', 'holy0'],
  confessor: ['slate', 'iron', 'violet0'], choir: ['gold', 'cloth', 'ember0'],
};
function bolt(skin = null) {
  const [shaft, collar, tip] = skin ? BOLTS[skin] : ['iron', 'gold', 'gold0'];
  const S = new Scene();
  S.add(capsule([4, 4.5, 2], [17, 4.5, 2], 1.1, 1.1, shaft), 0);
  S.add(capsule([17, 4.5, 2], [21.5, 4.5, 2], 1.1, 0.2, shaft), 0.6);
  S.add(ellipsoid([3, 4.5, 2], [1.2, 2.6, 2.4], shaft), 0.5);
  S.paint({ f: (x) => Math.abs(x - 7.5) - 0.9, mat: collar });
  const f = render(S, 23, 9, MATS, { contrast: 1.5 });
  put(f, 20, 4, 'white'); put(f, 19, 4, tip);
  return f;
}
// The thurible: a pierced brass censer on its chain, embers glowing inside.
function thurible(i) {
  const S = new Scene(), cx = 10;
  S.add(sphere([cx, 14, 2], 6, 'gold'), 0);
  S.add(ellipsoid([cx, 9, 2], [4.6, 2.6, 4], 'gold'), 1.2);
  S.add(capsule([cx, 6.5, 2], [cx, 4, 2], 1.4, 0.9, 'gold'), 0.8);
  S.add(torus([cx, 2.4, 2], 1.6, 0.55, 0, 'iron'), 0);
  S.add(box([cx, 19.6, 2], [2.4, 0.8, 2], 0.4, 'gold'), 0.6);
  S.paint({ f: (x, y) => Math.abs(y - 11.2) - 0.5, mat: 'leather' });
  const f = render(S, 20, 22, MATS, { contrast: 1.35 });
  // Pierced holes with ember light, flickering between frames.
  const holes = [[cx - 3, 14], [cx, 13], [cx + 3, 14], [cx - 1.5, 16.5], [cx + 1.5, 16.5]];
  holes.forEach(([x, y], k) => { put(f, x, y, (k + i) % 2 ? 'ember0' : 'ember1'); put(f, x, y + 1, 'ember2'); });
  if (i === 1) put(f, cx, 13, 'white');
  return f;
}
// Holy water: a round glass flask with a cork.
function flask() {
  const S = new Scene();
  S.add(sphere([8, 11, 2], 5, 'holy'), 0);
  S.add(capsule([8, 6.5, 2], [8, 3.5, 2], 1.8, 1.6, 'holy'), 1);
  S.add(capsule([8, 3.2, 2.2], [8, 1.4, 2.2], 1.7, 1.7, 'wood'), 0);
  S.paint({ f: (x, y) => Math.abs(y - 5.6) - 0.5, mat: 'gold' });
  const f = render(S, 16, 17, MATS, { contrast: 1.4 });
  put(f, 6, 9, 'white'); put(f, 6, 10, 'holy0'); put(f, 7, 8, 'holy0');
  return f;
}
// Chain links: one face-on, one edge-on, so a run of links alternates.
function link(i) {
  const S = new Scene();
  if (i === 0) S.add(torus([5, 3.5, 2], 2.6, 0.95, Math.PI / 2, 'iron'), 0);
  else S.add(capsule([1.8, 3.5, 2], [8.2, 3.5, 2], 1.05, 1.05, 'iron'), 0);
  return render(S, 10, 7, MATS, { contrast: 1.4 });
}
// The chain's hook, pointing right.
function hook() {
  const S = new Scene();
  S.add(torus([5, 7, 2], 1.6, 0.7, Math.PI / 2, 'iron'), 0);
  S.add(capsule([6.5, 7, 2], [11, 7, 2], 1.2, 1.1, 'iron'), 0.6);
  S.add(capsule([11, 7, 2], [14, 3.5, 2], 1.1, 0.4, 'iron'), 0.8);
  S.add(capsule([11, 7, 2], [14, 10.5, 2], 1.1, 0.4, 'iron'), 0.8);
  const f = render(S, 16, 14, MATS, { contrast: 1.5 });
  put(f, 14, 3, 'white');
  return f;
}
// The execution dagger that hovers over a staggered foe, point down.
function dagger() {
  const S = new Scene();
  S.add(box([6, 15, 2], [1.4, 5, 0.6], 0.2, 'iron'), 0);
  S.add(capsule([6, 19.5, 2], [6, 22, 2], 1.4, 0.1, 'iron'), 0.6);
  S.add(box([6, 9, 2.5], [4, 0.9, 1], 0.5, 'gold'), 0);
  S.add(capsule([6, 8, 2], [6, 3.5, 2], 1.1, 1.1, 'leather'), 0);
  S.add(sphere([6, 2.4, 2.2], 1.6, 'gold'), 0);
  const f = render(S, 12, 24, MATS, { contrast: 1.4 });
  pline(f, 5, 11, 5, 19, 'iron0');
  return A(f, 6, 23);
}
// Penance lash: a falling crimson scourge of light.
function scourge(i) {
  const W = 14, H = 32, f = frame(W, H);
  for (let y = 0; y < H; y++) {
    const x = 7 + Math.round(Math.sin(y * 0.55 + i * 1.6) * 2.2), w = y > H - 6 ? 1 : 2;
    for (let dx = -w; dx <= w; dx++) put(f, x + dx, y, Math.abs(dx) === w ? 'blood2' : Math.abs(dx) === w - 1 ? 'crimson1' : 'crimson0');
    if (y % 3 === 0) put(f, x, y, 'white');
  }
  return A(f, 7, 31);
}

// ------------------------------------------------------------ item icons ---
// 24x24, three-quarter view, outlined, lit from the top-left.
function icon(fn, size = 24) { const S = new Scene(); fn(S); return render(S, size, size, MATS, { contrast: 1.35 }); }
const ICONS = {
  // The crossbow, aimed up-right: wood stock, gilt prod, iron nail.
  bow: () => { const f = icon((S) => {
    S.add(capsule([4.5, 19.5, 2], [17.5, 6.5, 2], 1.7, 1.4, 'wood'), 0);
    S.add(capsule([4, 20, 2], [6.5, 21.5, 2], 2.2, 2.2, 'wood'), 1);
    S.add(capsule([17.5, 6.5, 2.5], [11.5, 3, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([17.5, 6.5, 2.5], [21, 12.5, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([9, 15, 3.6], [20, 4, 3.6], 0.6, 0.6, 'iron'), 0);
  }); pline(f, 11.5, 3, 13, 10.5, 'bone1'); pline(f, 21, 12.5, 13, 10.5, 'bone1'); return f; },
  // The quiver: a leather case, gilt bands, nail heads showing.
  quiver: () => icon((S) => {
    S.add(rotZ(capsule([12, 8, 2], [12, 20, 2], 3.6, 3.2, 'leather'), [12, 14], 0.35), 0);
    S.paint({ f: (x, y) => Math.abs(y - 10.5 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 18 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    for (const dx of [-1.8, 0.4, 2.4]) S.add(capsule([12.5 + dx, 6, 2.5], [14.2 + dx, 1.8, 2.5], 0.8, 0.8, 'iron'), 0.3);
  }),
  hood: () => { const f = icon((S) => {
    S.add(ellipsoid([12, 11, 2], [7, 7.5, 6], 'crimson'), 0);
    S.add(capsule([9, 6, 0], [5, 2.5, -2], 3, 1, 'crimson'), 2);
    S.add(ellipsoid([12, 19, 2], [8.5, 3, 5], 'crimson'), 2);
    S.sub(ellipsoid([14.5, 12.5, 7], [3.8, 4.6, 5], 'void'), 0.6);
    S.paint({ f: (x, y, z) => Math.abs(y - 20.5) - 0.7, mat: 'gold' });
  }); return f; },
  mantle: () => icon((S) => {
    // A cloak hung from its shoulders: a wide drape with deep folds and a gilt clasp.
    S.add(ellipsoid([12, 7, 2], [7.5, 3, 4], 'violet'), 0);
    for (let k = -2; k <= 2; k++) S.add(capsule([12 + k * 2.6, 7, 2 + Math.abs(k) * -0.4], [12 + k * 3.6, 20.5, 2.5 - Math.abs(k) * 0.6], 2, 2.3, 'violet'), 1.4);
    S.sub(ellipsoid([12, 5.4, 4], [2.4, 1.6, 4]), 0.5);
    S.paint({ f: (x, y) => Math.abs(y - 21) - 0.9, mat: 'gold' });
    S.add(sphere([12, 8.4, 5.6], 1.5, 'gold'), 0);
  }),
  gloves: () => icon((S) => {
    S.add(ellipsoid([11, 13, 2], [5, 5.5, 3], 'leather'), 0);
    for (let k = 0; k < 4; k++) S.add(capsule([8 + k * 2.2, 9, 2.5], [8.4 + k * 2.4, 3.5 + Math.abs(k - 1.5), 2.5], 1.1, 1, 'leather'), 0.8);
    S.add(capsule([15.5, 12, 2.5], [19, 9, 2.5], 1.3, 1.1, 'leather'), 0.8);
    S.add(box([11, 19.5, 2], [5.2, 2, 3], 0.8, 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 18.4) - 0.6, mat: 'gold' });
  }),
  girdle: () => icon((S) => {
    S.add(torus([12, 12, 2], 8, 1.7, 1.15, 'leather'), 0);
    S.add(box([12, 15, 4.5], [3, 2.6, 1], 0.6, 'gold'), 0);
    S.sub(box([12, 15, 6], [1.5, 1.1, 1.5], 0.3), 0);
    S.add(capsule([14, 16.5, 4], [16, 22, 3], 1, 0.8, 'leather'), 0.5);
  }),
  greaves: () => icon((S) => {
    S.add(capsule([10, 4, 2], [10, 15, 2], 3.6, 3, 'iron'), 0);
    S.add(ellipsoid([12, 18.5, 2], [5.5, 2.6, 3.4], 'iron'), 1.5);
    S.add(ellipsoid([10, 10, 3.2], [3.4, 2.4, 2], 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 5) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 15.6) - 0.6, mat: 'gold' });
  }),
  rosary: () => { const f = icon((S) => {
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; S.add(sphere([12 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 5, 2], 1.5, k % 4 === 0 ? 'gold' : 'blood'), 0); }
    S.add(capsule([12, 14.5, 2], [12, 16.5, 2], 0.7, 0.7, 'gold'), 0);
    S.add(box([12, 19.5, 2.5], [0.9, 3.4, 0.8], 0.3, 'gold'), 0);
    S.add(box([12, 18.5, 2.5], [2.6, 0.9, 0.8], 0.3, 'gold'), 0);
  }); return f; },
  seal: () => { const f = icon((S) => {
    S.add(torus([12, 13, 2], 5.8, 1.6, 1.05, 'gold'), 0);
    S.add(ellipsoid([12, 8, 3], [3.8, 2.6, 3], 'gold'), 0.8);
    S.add(ellipsoid([12, 7.4, 5], [2.4, 1.6, 1.4], 'blood'), 0);
  }); dot(f, 11, 6, 'white'); return f; },
  relic: () => { const f = icon((S) => {
    S.add(bumpy(capsule([8, 16, 2], [16, 8, 2], 2.4, 2, 'bone'), 0.4, 0.6), 0);
    S.add(sphere([6.5, 17.5, 2], 3, 'bone'), 1.2);
    S.add(sphere([17.5, 6.5, 2], 3, 'bone'), 1.2);
    S.add(box([12, 12, 2.5], [3.2, 1.2, 2.6], 0.5, 'gold'), 0);
  }); return f; },
};

// -------------------------------------------------------------- loot bits ---
function coin(i) {
  const S = new Scene();
  S.add(ellipsoid([5.5, 5.5, 2], [i ? 1.6 : 4.2, 4.2, 1.2], 'gold'), 0);
  const f = render(S, 11, 11, MATS, { contrast: 1.4 });
  if (!i) { put(f, 4, 3, 'white'); pline(f, 5, 4, 5, 7, 'gold2'); }
  return f;
}
function goldPile(n) {
  const S = new Scene(), pts = [[11, 12], [7, 13], [15, 13], [9, 10], [13, 10], [11, 8], [5, 11], [17, 11], [11, 14]].slice(0, [3, 6, 9][n]);
  for (const [x, y] of pts) S.add(ellipsoid([x, y, 2], [3.4, 1.6, 3], 'gold'), 0);
  const f = render(S, 22, 17, MATS, { contrast: 1.35 });
  for (const [x, y] of pts.slice(0, 3)) put(f, x - 1, y - 1, 'white');
  return f;
}
function globe(i) {
  const f = frame(18, 18);
  blobs(18, 18, [[9, 9, 6 + i * 0.4]], { ramp: 'blood', min: 0, max: 7, outline: 'ink', bias: 0.1, f });
  put(f, 6, 6, 'white'); put(f, 7, 6, 'blood0'); put(f, 6, 7, 'blood0');
  return f;
}

// Sound toggle for the HUD: a pale disc like the pause button, with a speaker.
function soundIcon(on) {
  const S = new Scene();
  S.add(ellipsoid([12, 12, 0], [10.5, 10.5, 3], 'cloth'), 0);
  const f = render(S, 24, 24, MATS, { contrast: 1.2 });
  const ink = (x, y) => put(f, x, y, 'ink1');
  for (let y = 10; y <= 14; y++) for (let x = 6; x <= 8; x++) ink(x, y);
  for (let x = 9; x <= 12; x++) for (let y = 12 - (x - 8) - 1; y <= 12 + (x - 8) + 1; y++) ink(x, y);
  if (on) { for (let y = 10; y <= 14; y++) ink(14, y); for (let y = 8; y <= 16; y++) ink(17, y); put(f, 15, 9, 'ink1'); put(f, 15, 15, 'ink1'); put(f, 16, 7, 'ink1'); put(f, 16, 17, 'ink1'); }
  else for (let k = 0; k < 6; k++) { ink(14 + k, 9 + k); ink(19 - k, 9 + k); ink(15 + k, 9 + k); ink(20 - k, 9 + k); }
  return f;
}

export default {
  ui: { sound: () => [soundIcon(true)], muted: () => [soundIcon(false)] },
  fx: {
    bolt: () => [bolt()], ...Object.fromEntries(Object.keys(BOLTS).map((k) => [`bolt_${k}`, () => [bolt(k)]])),
    impact: () => [0, 1, 2, 3].map(impact),
    burst: () => [0, 1, 2, 3].map(burst),
    smoke: () => [0, 1, 2, 3].map(smoke),
    thurible: () => [0, 1].map(thurible),
    flask: () => [flask()],
    link: () => [0, 1].map(link),
    hook: () => [hook()],
    dagger: () => [dagger()],
    scourge: () => [0, 1].map(scourge),
  },
  loot: {
    item: () => ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'].map((k) => ICONS[k]()),
    coin: () => [0, 1].map(coin),
    gold: () => [0, 1, 2].map(goldPile),
    globe: () => [0, 1].map(globe),
    wax: () => [orb('pot', { tail: true })], bone: () => [orb('bone', { r: 3.6 })], tear: () => [orb('holy', { tail: true })],
    feather: () => [orb('cloth', { r: 3.4, tail: true })], spit: () => [orb('rot', { tail: true })], ember: () => [orb('ember', { tail: true })],
    violet: () => [orb('violet')], blood: () => [orb('blood', { tail: true })], frost: () => [orb('holy', { r: 4.6 })], bomb: () => [orb('ink', { r: 4.8 })],
  },
};
