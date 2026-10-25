// Effects and small objects in the sculpted style, at the v5 size.
// Solid things (bolt, thurible, flask, chain, hook, dagger) are SDF models.
// Soft things (impacts, blood bursts, smoke, orbs) are 2D metaball forms lit
// from the top-left and banded onto palette ramps, with no dithering.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, bumpy, clip, dot, pline, LIGHT } from '../sdf.mjs';
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
function flask(mat = 'holy') {
  const S = new Scene();
  S.add(sphere([8, 11, 2], 5, mat), 0);
  S.add(capsule([8, 6.5, 2], [8, 3.5, 2], 1.8, 1.6, mat), 1);
  S.add(capsule([8, 3.2, 2.2], [8, 1.4, 2.2], 1.7, 1.7, 'wood'), 0);
  S.paint({ f: (x, y) => Math.abs(y - 5.6) - 0.5, mat: 'gold' });
  const f = render(S, 16, 17, MATS, { contrast: 1.4 });
  put(f, 6, 9, 'white'); put(f, 6, 10, `${mat}0`); put(f, 7, 8, `${mat}0`);
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
// Slot icons: a body (the sculpt) and an optional post pass (hand-placed pixels).
const BODY = {
  // The crossbow, aimed up-right: wood stock, gilt prod, iron nail.
  bow: (S) => {
    S.add(capsule([4.5, 19.5, 2], [17.5, 6.5, 2], 1.7, 1.4, 'wood'), 0);
    S.add(capsule([4, 20, 2], [6.5, 21.5, 2], 2.2, 2.2, 'wood'), 1);
    S.add(capsule([17.5, 6.5, 2.5], [11.5, 3, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([17.5, 6.5, 2.5], [21, 12.5, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([9, 15, 3.6], [20, 4, 3.6], 0.6, 0.6, 'iron'), 0);
  },
  // The quiver: a leather case, gilt bands, nail heads showing.
  quiver: (S) => {
    S.add(rotZ(capsule([12, 8, 2], [12, 20, 2], 3.6, 3.2, 'leather'), [12, 14], 0.35), 0);
    S.paint({ f: (x, y) => Math.abs(y - 10.5 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 18 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    for (const dx of [-1.8, 0.4, 2.4]) S.add(capsule([12.5 + dx, 6, 2.5], [14.2 + dx, 1.8, 2.5], 0.8, 0.8, 'iron'), 0.3);
  },
  hood: (S) => {
    S.add(ellipsoid([12, 11, 2], [7, 7.5, 6], 'crimson'), 0);
    S.add(capsule([9, 6, 0], [5, 2.5, -2], 3, 1, 'crimson'), 2);
    S.add(ellipsoid([12, 19, 2], [8.5, 3, 5], 'crimson'), 2);
    S.sub(ellipsoid([14.5, 12.5, 7], [3.8, 4.6, 5], 'void'), 0.6);
    S.paint({ f: (x, y, z) => Math.abs(y - 20.5) - 0.7, mat: 'gold' });
  },
  // A cloak hung from its shoulders: a wide drape with deep folds and a gilt clasp.
  mantle: (S) => {
    S.add(ellipsoid([12, 7, 2], [7.5, 3, 4], 'violet'), 0);
    for (let k = -2; k <= 2; k++) S.add(capsule([12 + k * 2.6, 7, 2 + Math.abs(k) * -0.4], [12 + k * 3.6, 20.5, 2.5 - Math.abs(k) * 0.6], 2, 2.3, 'violet'), 1.4);
    S.sub(ellipsoid([12, 5.4, 4], [2.4, 1.6, 4]), 0.5);
    S.paint({ f: (x, y) => Math.abs(y - 21) - 0.9, mat: 'gold' });
    S.add(sphere([12, 8.4, 5.6], 1.5, 'gold'), 0);
  },
  gloves: (S) => {
    S.add(ellipsoid([11, 13, 2], [5, 5.5, 3], 'leather'), 0);
    for (let k = 0; k < 4; k++) S.add(capsule([8 + k * 2.2, 9, 2.5], [8.4 + k * 2.4, 3.5 + Math.abs(k - 1.5), 2.5], 1.1, 1, 'leather'), 0.8);
    S.add(capsule([15.5, 12, 2.5], [19, 9, 2.5], 1.3, 1.1, 'leather'), 0.8);
    S.add(box([11, 19.5, 2], [5.2, 2, 3], 0.8, 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 18.4) - 0.6, mat: 'gold' });
  },
  girdle: (S) => {
    S.add(torus([12, 12, 2], 8, 1.7, 1.15, 'leather'), 0);
    S.add(box([12, 15, 4.5], [3, 2.6, 1], 0.6, 'gold'), 0);
    S.sub(box([12, 15, 6], [1.5, 1.1, 1.5], 0.3), 0);
    S.add(capsule([14, 16.5, 4], [16, 22, 3], 1, 0.8, 'leather'), 0.5);
  },
  greaves: (S) => {
    S.add(capsule([10, 4, 2], [10, 15, 2], 3.6, 3, 'iron'), 0);
    S.add(ellipsoid([12, 18.5, 2], [5.5, 2.6, 3.4], 'iron'), 1.5);
    S.add(ellipsoid([10, 10, 3.2], [3.4, 2.4, 2], 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 5) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 15.6) - 0.6, mat: 'gold' });
  },
  rosary: (S) => {
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; S.add(sphere([12 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 5, 2], 1.5, k % 4 === 0 ? 'gold' : 'blood'), 0); }
    S.add(capsule([12, 14.5, 2], [12, 16.5, 2], 0.7, 0.7, 'gold'), 0);
    S.add(box([12, 19.5, 2.5], [0.9, 3.4, 0.8], 0.3, 'gold'), 0);
    S.add(box([12, 18.5, 2.5], [2.6, 0.9, 0.8], 0.3, 'gold'), 0);
  },
  seal: (S) => {
    S.add(torus([12, 13, 2], 5.8, 1.6, 1.05, 'gold'), 0);
    S.add(ellipsoid([12, 8, 3], [3.8, 2.6, 3], 'gold'), 0.8);
    S.add(ellipsoid([12, 7.4, 5], [2.4, 1.6, 1.4], 'blood'), 0);
  },
  relic: (S) => {
    S.add(bumpy(capsule([8, 16, 2], [16, 8, 2], 2.4, 2, 'bone'), 0.4, 0.6), 0);
    S.add(sphere([6.5, 17.5, 2], 3, 'bone'), 1.2);
    S.add(sphere([17.5, 6.5, 2], 3, 'bone'), 1.2);
    S.add(box([12, 12, 2.5], [3.2, 1.2, 2.6], 0.5, 'gold'), 0);
  },
};
const POST = {
  bow: (f) => { pline(f, 11.5, 3, 13, 10.5, 'bone1'); pline(f, 21, 12.5, 13, 10.5, 'bone1'); },
  seal: (f) => { dot(f, 11, 6, 'white'); },
};
const ICONS = Object.fromEntries(Object.keys(BODY).map((k) => [k, () => { const f = icon(BODY[k]); if (POST[k]) POST[k](f); return f; }]));

// Hallowed pieces: each keeps its slot's shape but swaps materials (remap)
// and adds its own mark, so the thirty read apart at a glance. Order
// follows LEGENDS in index.html (the loot sheet's 'legend' frames).
function remapScene(S, map) {
  const m = (p) => (p && p.mat && map[p.mat] ? { ...p, mat: map[p.mat] } : p);
  return { add: (p, k, op) => S.add(m(p), k, op), sub: (p, k) => S.sub(p, k), paint: (p) => S.paint(m(p)) };
}
function legendIcon(slot, map, extra, post) {
  const f = icon((S) => { BODY[slot](remapScene(S, map)); if (extra) extra(S); });
  if (POST[slot] && !map.noPost) POST[slot](f);
  if (post) post(f);
  return f;
}
const flames = (S, pts, r = 1.4) => { for (const [x, y] of pts) S.add(ellipsoid([x, y, 4], [r, r * 1.5, r], 'ember'), 0.6); };
const LEGEND_ICONS = [
  // 0 Hood of Ash-Choir: an ash-grey hood, embers inside.
  () => legendIcon('hood', { crimson: 'stone', gold: 'ink' }, (S) => S.add(sphere([14.5, 13, 3], 1.6, 'ember'), 0)),
  // 1 Mantle of the Ninth Wound: a crimson mantle split by a bleeding wound.
  () => legendIcon('mantle', { violet: 'crimson' }, (S) => S.add(rotZ(capsule([8, 12, 4.5], [16, 17, 4.5], 0.9, 0.9, 'blood'), [12, 14], 0), 0)),
  // 2 Hands That Counted Coins: gilt gloves over a stack of coins.
  () => legendIcon('gloves', { leather: 'gold', iron: 'wood' }, (S) => { for (let k = 0; k < 3; k++) S.add(ellipsoid([19, 20 - k * 2, 3], [3, 1, 2.6], 'gold'), 0.3); }),
  // 3 Girdle of the Unfed: a cord of bone, ribs hanging from it.
  () => legendIcon('girdle', { leather: 'bone', gold: 'iron' }, (S) => { for (const x of [8, 12, 16]) S.add(capsule([x, 18, 3], [x - 1, 22, 3], 0.8, 0.6, 'bone'), 0.3); }),
  // 4 The Long Descent: tall slate greaves.
  () => legendIcon('greaves', { iron: 'slate', gold: 'iron' }, (S) => S.add(capsule([10, 1.5, 2], [10, 5, 2], 3, 3, 'slate'), 1)),
  // 5 Locket of Unsaid Words: a silver chain, a violet heart locket.
  () => legendIcon('rosary', { blood: 'iron', gold: 'iron' }, (S) => S.add(ellipsoid([12, 19.5, 3.5], [3.4, 3, 2], 'violet'), 0)),
  // 6 Seal of the First Tithe: a ring crowned with a great coin.
  () => legendIcon('seal', { blood: 'gold' }, (S) => S.add(ellipsoid([12, 6.5, 5], [4.6, 4.6, 1.2], 'gold'), 0), (f) => { pline(f, 12, 4, 12, 9, 'gold3'); }),
  // 7 The Weeping Knuckle: a bone that weeps blue tears.
  () => legendIcon('relic', { gold: 'holy' }, (S) => { for (const [x, y] of [[9, 20], [14, 21], [19, 13]]) S.add(ellipsoid([x, y, 3], [1.2, 1.8, 1.2], 'holy'), 0); }),
  // 8 The Silent Arbalest: a black crossbow with a violet nail.
  () => legendIcon('bow', { wood: 'ink', gold: 'slate', iron: 'violet', noPost: true }, null, (f) => { pline(f, 11.5, 3, 13, 10.5, 'violet2'); pline(f, 21, 12.5, 13, 10.5, 'violet2'); }),
  // 9 The Bottomless Case: a quiver whose mouth is a violet void.
  () => legendIcon('quiver', { leather: 'violet', iron: 'void' }, (S) => S.add(ellipsoid([14, 5, 4], [3.6, 2, 1], 'eyeHoly'), 0)),
  // 10 The Lesser Vow: a plain iron band with a green set-stone.
  () => legendIcon('seal', { gold: 'iron', blood: 'flame' }),
  // 11 The Crown of Thorns: a ring of thorny briar.
  () => icon((S) => {
    S.add(torus([12, 13, 2], 7, 1.8, 1.25, 'shroud'), 0);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; S.add(capsule([12 + Math.cos(a) * 7, 13 + Math.sin(a) * 4, 2], [12 + Math.cos(a) * 9.5, 13 + Math.sin(a) * 4 - 3, 2], 0.9, 0.3, 'wood'), 0.3); }
    for (const [x, y] of [[6, 16], [17, 17]]) S.add(sphere([x, y, 4], 1.2, 'blood'), 0);
  }),
  // 12 Veil of the Still Water: a blue veil with a single drop.
  () => legendIcon('hood', { crimson: 'holy', gold: 'iron' }, (S) => S.add(ellipsoid([9, 21.5, 4], [1.4, 2, 1.4], 'holy'), 0)),
  // 13 Mantle of Falling Ash: a soot mantle, embers at its hem.
  () => legendIcon('mantle', { violet: 'ink', gold: 'ember' }, (S) => flames(S, [[7, 20], [12, 21], [17, 20]], 1.1)),
  // 14 The Pall of Seven Wards: a white pall with a gilt cross.
  () => legendIcon('mantle', { violet: 'cloth' }, (S) => { S.add(box([12, 14, 5], [0.9, 4, 0.6], 0.3, 'gold'), 0); S.add(box([12, 12.5, 5], [3, 0.9, 0.6], 0.3, 'gold'), 0); }),
  // 15 Hands of the Jailer: an iron gauntlet hung with chain.
  () => legendIcon('gloves', { leather: 'iron', gold: 'slate' }, (S) => { for (let k = 0; k < 3; k++) S.add(torus([19, 14 + k * 3, 3], 1.4, 0.6, k % 2 ? 0 : Math.PI / 2, 'iron'), 0); }),
  // 16 The Stormwright's Gloves: nails bristling from the fingers.
  () => legendIcon('gloves', { leather: 'wood' }, (S) => { for (let k = 0; k < 4; k++) S.add(capsule([8.4 + k * 2.4, 3.5 + Math.abs(k - 1.5), 3], [8.4 + k * 3, 0.5, 3], 0.7, 0.4, 'iron'), 0); }),
  // 17 Cincture of Embers: a belt of glowing coals.
  () => legendIcon('girdle', { leather: 'emberLit', gold: 'iron' }, (S) => flames(S, [[6, 9], [18, 9], [12, 6]], 1.2)),
  // 18 The Tithe-Belt: a coin purse hung from the belt.
  () => legendIcon('girdle', { leather: 'wood' }, (S) => { S.add(ellipsoid([16, 20, 3], [3.4, 3, 2.6], 'leather'), 0); S.add(ellipsoid([16, 17, 4.5], [2, 1, 1], 'gold'), 0); }),
  // 19 Sabatons of the Ember Step: iron greaves with fire at the heel.
  () => legendIcon('greaves', { gold: 'ember' }, (S) => flames(S, [[6, 19], [17.5, 18]], 1.6)),
  // 20 The Pilgrim's Sandals: a wooden sole and leather straps.
  () => icon((S) => {
    S.add(ellipsoid([12, 19, 2], [7.5, 2.2, 3.6], 'wood'), 0);
    for (const y of [11, 15]) S.add(torus([12, y, 2], 4.6, 0.9, 1.2, 'leather'), 0);
    S.add(capsule([12, 6, 3], [12, 18, 3], 0.9, 0.9, 'leather'), 0);
    S.add(ellipsoid([12, 5, 3.5], [2.4, 2, 1.2], 'bone'), 0);
  }),
  // 21 Locket of the Last Hymn: a gold chain, a white flame-lit oval.
  () => legendIcon('rosary', { blood: 'gold' }, (S) => S.add(ellipsoid([12, 19.5, 3.5], [2.8, 3.4, 1.6], 'eyeHoly'), 0)),
  // 22 The Censer-Bearer's Chain: a little thurible on its chain.
  () => legendIcon('rosary', { blood: 'iron' }, (S) => { S.add(sphere([12, 19.5, 3], 3.4, 'gold'), 0); S.add(ellipsoid([12, 18.5, 5.5], [2, 1.2, 1], 'ember'), 0); }),
  // 23 Seal of Judgement: a ring with a pillar of light for a stone.
  () => legendIcon('seal', { blood: 'eyeHoly' }, (S) => S.add(box([12, 4, 4], [1.4, 3.6, 1], 0.4, 'holy'), 0)),
  // 24 The Gambler's Knucklebone: a bone die, pips and all.
  () => { const f = icon((S) => { S.add(box([12, 12, 2], [6.5, 6.5, 6.5], 1.6, 'bone'), 0); }, 24); for (const [x, y] of [[8, 8], [12, 12], [16, 16], [16, 8], [8, 16]]) dot(f, x, y, x === 12 ? 'blood0' : 'ink1'); return f; },
  // 25 The Saint's Molar: a molar with a gilt halo.
  () => icon((S) => {
    S.add(ellipsoid([12, 12, 2], [6, 5, 4], 'bone'), 0);
    for (const x of [8.5, 15.5]) S.add(capsule([x, 15, 2], [x + (x < 12 ? -1 : 1), 21, 2], 2, 1.2, 'bone'), 1.2);
    S.add(torus([12, 4.5, 2], 4.5, 1, 1.25, 'halo'), 0);
  }),
  // 26 The Longway Arbalest: pale wood, a long gilt bolt.
  () => legendIcon('bow', { wood: 'sand', iron: 'gold' }, (S) => S.add(capsule([4, 22, 3.6], [22, 2, 3.6], 0.6, 0.6, 'gold'), 0)),
  // 27 The Penitent's Prod: a heavy crimson crossbow, spiked.
  () => legendIcon('bow', { wood: 'crimsonDark', gold: 'iron' }, (S) => { for (const [x, y] of [[9, 13], [13, 9]]) S.add(capsule([x, y, 2], [x - 2, y - 2, 2], 0.9, 0.3, 'iron'), 0); }),
  // 28 The Brazier Quiver: a quiver burning at the mouth.
  () => legendIcon('quiver', { leather: 'iron', iron: 'ember' }, (S) => flames(S, [[13, 3], [16, 4], [11, 5]], 1.4)),
  // 29 The Quiver of No Mercy: black leather bound in chain.
  () => legendIcon('quiver', { leather: 'ink', gold: 'iron', iron: 'blood' }, (S) => { for (let k = 0; k < 3; k++) S.add(torus([9 + k * 3, 14 + k * 1.2, 4], 1.3, 0.6, k % 2 ? 0 : Math.PI / 2, 'iron'), 0); }),
  // The Mendicant's (round 51), in LEGENDS order after the thirty.
  // The Penitent's Gauntlets: iron gloves gripping a mace head.
  () => legendIcon('gloves', { leather: 'iron', iron: 'gold' }, (S) => { S.add(sphere([19, 8, 4], 3.2, 'iron'), 0.5); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; S.add(sphere([19 + Math.cos(a) * 3, 8 + Math.sin(a) * 3, 4], 1.4, 'iron'), 0.4); } }),
  // The Bellringer's Stole: a gold-hemmed mantle with a small bell.
  () => legendIcon('mantle', { violet: 'gold' }, (S) => { S.add(ellipsoid([12, 17, 5], [3, 3.4, 2], 'gold'), 0.5); S.add(sphere([12, 20.5, 5.5], 1.1, 'iron'), 0); }),
  // Sabatons of the Charge: dark greaves trailing embers.
  () => legendIcon('greaves', { iron: 'wood', gold: 'ember' }, (S) => flames(S, [[6, 20], [9, 22]], 1.2)),
  // Beads of Iron Shards: a rosary of iron beads hung with nail shards.
  () => legendIcon('rosary', { blood: 'iron', gold: 'slate' }, (S) => { for (const x of [9, 12, 15]) S.add(capsule([x, 18, 3.5], [x, 23, 3.5], 0.8, 0.3, 'iron'), 0.2); }),
  // Seal of the Iron Vow: an iron ring with an ember stone.
  () => legendIcon('seal', { gold: 'iron', blood: 'ember' }),
  // The Undertow Cord: a sea-blue cord dripping water.
  () => legendIcon('girdle', { leather: 'holy', gold: 'iron' }, (S) => { for (const [x, y] of [[8, 20], [13, 22], [18, 20]]) S.add(ellipsoid([x, y, 3], [1.1, 1.7, 1.1], 'holy'), 0); }),
  // The Seventh Bell-Hammer: a relic crossed by a small gold hammer.
  () => legendIcon('relic', { gold: 'iron' }, (S) => { S.add(capsule([7, 20, 4], [17, 8, 4], 0.9, 0.9, 'wood'), 0.2); S.add(box([17.5, 7.5, 4], [3.2, 1.6, 1.6], 0.6, 'gold'), 0.3); }),
];

// Set pieces: every slot in a set's own colours (taken from its Saint skin)
// with the set's mark in the lower right. Frame = set * 10 + slot, sets in
// SET_ICONS order, slots in index.html's ICON_OF order.
const SLOT_ORDER = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
const SET_LOOK = {
  // Odile's Habit: brown homespun, cream trim, a wooden cross.
  habit: { map: { crimson: 'shroud', violet: 'shroud', leather: 'shroud', iron: 'leather', gold: 'cream', blood: 'wood', wood: 'wood' },
    mark: (S) => { S.add(box([18.5, 18.5, 7], [1.2, 4.4, 1], 0.3, 'cream'), 0); S.add(box([18.5, 17, 7], [3.4, 1.2, 1], 0.3, 'cream'), 0); } },
  // The Hundred Nails: steel, gilt edges, a gold nail driven through.
  nails: { map: { crimson: 'steel', violet: 'steel', leather: 'slate', blood: 'iron', wood: 'slate', bone: 'steel' },
    mark: (S) => { S.add(capsule([14.5, 14.5, 7], [22, 22, 7], 1.2, 0.8, 'gold'), 0); S.add(ellipsoid([14.5, 14.5, 7.5], [2.6, 2.6, 1], 'gold'), 0.4); } },
  // The Penitent's Stride: cream and smouldering umber, a flame.
  stride: { map: { crimson: 'cream', violet: 'cream', leather: 'smoulder', iron: 'smoulder', blood: 'ember', wood: 'smoulder' },
    mark: (S) => { S.add(ellipsoid([18.5, 18.5, 7], [3.4, 4.6, 2], 'ember'), 0.6); S.add(ellipsoid([18.5, 20, 9], [1.8, 2.6, 1], 'emberLit'), 0.3); } },
  // The Drowned Font: deep blue and silver, a drop of holy water.
  font: { map: { crimson: 'blueRobe', violet: 'blueRobe', leather: 'blueDark', iron: 'silver', gold: 'silver', blood: 'vial', wood: 'blueDark', bone: 'silver' },
    mark: (S) => { S.add(sphere([18.5, 19.5, 7], 3.2, 'vial'), 0); S.add(capsule([18.5, 18, 7], [18.5, 13.5, 7], 2.2, 0.5, 'vial'), 1.2); } },
  // The Last Confessor: slate and cream, two links of chain.
  confessor: { map: { crimson: 'slateRobe', violet: 'slateRobe', leather: 'slateDark', gold: 'cream', blood: 'slateDark', wood: 'slateDark', bone: 'cream' },
    mark: (S) => { S.add(torus([16, 16.5, 7], 3, 1.1, Math.PI / 2, 'cream'), 0); S.add(torus([20.5, 20.5, 7], 2.8, 1.1, 0.25, 'cream'), 0.2); } },
  // The Burning Choir: white and crimson, gilt, a lit candle.
  choir: { map: { crimson: 'cloth', violet: 'cloth', leather: 'crimson', iron: 'gold', blood: 'crimson', wood: 'crimson', bone: 'wax' },
    mark: (S) => { S.add(capsule([18.5, 22.5, 7], [18.5, 16, 7], 2, 2, 'wax'), 0); },
    post: (f) => { dot(f, 18, 14, 'ember1'); dot(f, 18, 12, 'ember0'); dot(f, 20, 14, 'ember2'); } },
};
const SET_ICONS = Object.keys(SET_LOOK);
const setIcon = (set, slot) => { const L = SET_LOOK[set]; return legendIcon(slot, L.map, L.mark, L.post); };

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

// The Bloodrose Key that opens the Bleeding Vigil: a gilt ring round a
// rose, on a pink shaft.
function roseKey() {
  const S = new Scene();
  S.add(torus([10, 8, 2], 5.4, 1.8, Math.PI / 2, 'gold'), 0);
  S.add(sphere([10, 8, 2.6], 2.6, 'rose'), 0);
  S.add(capsule([10, 15, 2], [10, 26, 2], 2, 1.9, 'rose'), 0.6);
  S.add(box([14, 21, 2], [2.4, 1.3, 1.4], 0.3, 'rose'), 0.4);
  S.add(box([14, 25, 2], [2.4, 1.3, 1.4], 0.3, 'rose'), 0.4);
  const f = render(S, 20, 29, MATS, { contrast: 1.4 });
  put(f, 8, 6, 'white'); put(f, 9, 6, 'white');
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

// ---------------------------------------------------------- forge stuff ---
// The Ember Forge's reforge material: a rough dark stone split by glowing
// cracks, with a hot core showing through.
const FM = {
  ...MATS,
  rock: { ramp: 'stone', bias: -0.28, min: 3, spec: 0.05 },
  crack: { ramp: 'ember', glow: 2 }, crackHot: { ramp: 'ember', glow: 0 },
};
function emberstone() {
  const S = new Scene();
  S.add(bumpy(ellipsoid([9, 10.5, 2], [7.4, 5.8, 5], 'rock'), 0.7, 0.55, 3), 0);
  S.add(bumpy(sphere([6.5, 8.5, 3], 4.4, 'rock'), 0.5, 0.6, 7), 1.5);
  // Cracks: thin glowing seams over the surface, widening into the core.
  const seg = (ax, ay, bx, by, w) => (x, y) => { const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t) - w; };
  const cracks = [seg(3, 7, 6, 8, 1), seg(6, 8, 9, 10.5, 1.1), seg(9, 10.5, 12, 7, 1), seg(12, 7, 15, 6.5, 0.9), seg(9, 10.5, 7, 15, 1), seg(9, 10.5, 14, 13, 0.9)];
  S.paint({ f: (x, y) => Math.min(...cracks.map((c) => c(x, y))), mat: 'crack' });
  S.paint({ f: (x, y) => Math.hypot(x - 9, y - 10.5) - 2.2, mat: 'crackHot' });
  const f = render(S, 18, 18, FM, { contrast: 1.4 });
  dot(f, 9, 10, 'white');
  dot(f, 5, 4, 'stone1');
  return f;
}

// --------------------------------------------------------- ingredients ---
// 18x18 reagents for the Enchanter, one shape per icon, tinted by ramp.
// Frame = enchant * 3 + k; see INGR below for the order.
const INGR_RAMPS = ['ember', 'holy', 'blood', 'iron', 'rose', 'bone', 'moss', 'crimson', 'wood', 'sea', 'gold', 'flame', 'violet', 'teal', 'sand', 'slate'];
const IM = {
  ...MATS,
  ...Object.fromEntries(INGR_RAMPS.flatMap((r) => [[`g_${r}`, { ramp: r, spec: 0.7, min: 0 }], [`m_${r}`, { ramp: r, spec: 0.15, min: 0 }]])),
  sack: { ramp: 'shroud', spec: 0.05, min: 1 }, cord: { ramp: 'gold', bias: -0.1 }, corkW: { ramp: 'wood', spec: 0.1, bias: 0.05 },
  glass: { ramp: 'holy', spec: 0.8, min: 1, max: 5, bias: 0.1 }, spool: { ramp: 'wood', spec: 0.1, bias: -0.05 }, spoolI: { ramp: 'iron', spec: 0.5, bias: -0.1 },
};
// A convex solid from planes [nx, ny, nz, d] (keep n.p <= d), for cut gems.
function facets(list, bb, mat) {
  const ps = list.map(([nx, ny, nz, d]) => { const l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l, d / l]; });
  return { mat, bb, f: (x, y, z) => { let m = -1e9; for (const [a, b, c, d] of ps) { const v = a * x + b * y + c * z - d; if (v > m) m = v; } return m; } };
}
const ingrRender = (S) => A(render(S, 18, 18, IM, { contrast: 1.45 }), 9, 9);
const lit = (r, s) => FINE[r][s];
const INGR_SHAPES = {
  // A tied sack with a heap of coloured dust spilling out in front.
  dust: (r) => {
    const S = new Scene();
    S.add(ellipsoid([6.5, 9.5, 0], [4, 4.4, 3.4], 'sack'), 0);
    S.add(capsule([6.5, 5.6, 0], [6.5, 3, 0], 1.4, 2.2, 'sack'), 1.2);
    S.paint({ f: (x, y) => Math.abs(y - 5.4) - 0.8, mat: 'cord' });
    S.add(ellipsoid([11.5, 13.5, 3], [5, 2.4, 3], `m_${r}`), 1);
    S.add(sphere([12, 12, 3], 2.4, `m_${r}`), 1.2);
    const f = ingrRender(S);
    dot(f, 11, 11, lit(r, 0)); dot(f, 15, 13, lit(r, 2));
    return f;
  },
  // A squat candle stub with a drip and a small flame.
  wax: (r) => {
    const S = new Scene();
    S.add(box([9, 12, 0], [3.6, 3.2, 3.6], 0.8, `m_${r}`), 0);
    S.add(capsule([5.4, 9.5, 3.4], [5.4, 13, 3.6], 1.2, 1.3, `m_${r}`), 0.6);
    S.add(ellipsoid([9, 16, 0], [6, 1.2, 4.6], 'iron'), 0.4);
    const f = ingrRender(S);
    dot(f, 9, 7, 'ink2');
    dot(f, 9, 5, 'ember1'); dot(f, 9, 3, 'ember0'); dot(f, 9, 1, 'ember2');
    dot(f, 7, 10, lit(r, 0));
    return f;
  },
  // A faceted gem: a hexagonal bipyramid with a crown table.
  stone: (r) => {
    const S = new Scene(), c = [9, 7.5, 0], P = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, nx = Math.cos(a), nz = Math.sin(a) * 0.9;
      P.push([nx, -0.9, nz, nx * c[0] - 0.9 * c[1] + nz * c[2] + 5.2]);   // crown facets
      P.push([nx, 0.75, nz, nx * c[0] + 0.75 * c[1] + nz * c[2] + 5.4]); }    // pavilion facets
    P.push([0, -1, 0, -(c[1] - 3.2)]);
    S.add(facets(P, [2, 3, -7, 16, 17, 7], `g_${r}`), 0);
    const f = ingrRender(S);
    dot(f, 6, 6, 'white'); dot(f, 8, 4, lit(r, 0));
    return f;
  },
  // A slim glass vial with a cork, liquid in the lower part.
  vial: (r) => {
    const S = new Scene();
    S.add(capsule([9, 13.2, 0], [9, 9.5, 0], 4.2, 4, `g_${r}`), 0);
    S.add(capsule([9, 8, 0], [9, 4.5, 0], 2.6, 1.7, 'glass'), 1.4);
    S.add(capsule([9, 3.4, 0.4], [9, 1, 0.4], 2, 2, 'corkW'), 0);
    const f = ingrRender(S);
    dot(f, 7, 10, 'white'); dot(f, 7, 12, lit(r, 1));
    return f;
  },
  // A wooden spool wound with thick cord, a loose end trailing.
  thread: (r) => {
    const S = new Scene(), sp = r === 'wood' || r === 'sand' ? 'spoolI' : 'spool';
    S.add(box([8, 3.4, 0], [5.6, 1, 4], 0.6, sp), 0);
    S.add(box([8, 14, 0], [5.6, 1, 4], 0.6, sp), 0);
    S.add(capsule([8, 5.5, 0], [8, 12, 0], 4, 4, `m_${r}`), 0);
    S.add(capsule([11.4, 9.5, 2.6], [15.6, 16, 1.4], 1.2, 1.2, `m_${r}`), 0.6);
    const f = ingrRender(S);
    for (const y of [8]) pline(f, 5, y, 10, y, lit(r, 6));
    dot(f, 5, 6, lit(r, 0));
    return f;
  },
  // A gnawed bone, lying across the icon: a bowed shaft with knobbed ends, tinted toward the ramp.
  bone: (r) => {
    const S = new Scene(), m = `m_${r}`;
    S.add(capsule([5, 12.5, 0], [9.5, 9.6, 0.5], 1.7, 1.5, m), 0);
    S.add(capsule([9.5, 9.6, 0.5], [13, 5.5, 0], 1.5, 1.7, m), 1);
    for (const [x, y] of [[3, 12.2], [5.2, 14.6], [12.8, 3.4], [15, 5.8]]) S.add(sphere([x, y, 0], 2.1, m), 1.2);
    const f = ingrRender(S);
    dot(f, 12, 2, lit(r, 0)); dot(f, 8, 9, lit(r, 1)); dot(f, 6, 14, lit(r, 6));
    return f;
  },
};
// Each enchant's three reagents, in frame order.
const INGR = [
  ['ember', 'dust', 'wax', 'stone'], ['holy', 'vial', 'thread', 'stone'], ['blood', 'bone', 'vial', 'dust'], ['iron', 'stone', 'thread', 'bone'],
  ['rose', 'vial', 'wax', 'thread'], ['bone', 'bone', 'stone', 'dust'], ['moss', 'bone', 'thread', 'vial'], ['crimson', 'vial', 'wax', 'bone'],
  ['wood', 'bone', 'dust', 'thread'], ['sea', 'vial', 'stone', 'dust'], ['gold', 'wax', 'stone', 'bone'], ['flame', 'wax', 'vial', 'dust'],
  ['violet', 'thread', 'dust', 'stone'], ['teal', 'thread', 'bone', 'vial'], ['sand', 'dust', 'wax', 'stone'], ['slate', 'thread', 'vial', 'bone'],
];

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
    legend: () => LEGEND_ICONS.map((f) => f()),
    setitem: () => SET_ICONS.flatMap((k) => SLOT_ORDER.map((slot) => setIcon(k, slot))),
    coin: () => [0, 1].map(coin),
    gold: () => [0, 1, 2].map(goldPile),
    globe: () => [0, 1].map(globe),
    vkey: () => [roseKey()],
    // Chrism vials by kind: common, blessed, consecrated, Hallowed.
    chrism: () => ['cloth', 'holy', 'gold', 'ember'].map((m) => flask(m)),
    emberstone: () => [emberstone()],
    // 48 reagents: frame = enchant * 3 + k (INGR).
    ingr: () => INGR.flatMap(([r, ...shapes]) => shapes.map((s) => INGR_SHAPES[s](r))),
    wax: () => [orb('pot', { tail: true })], bone: () => [orb('bone', { r: 3.6 })], tear: () => [orb('holy', { tail: true })],
    feather: () => [orb('cloth', { r: 3.4, tail: true })], spit: () => [orb('rot', { tail: true })], ember: () => [orb('ember', { tail: true })],
    violet: () => [orb('violet')], blood: () => [orb('blood', { tail: true })], frost: () => [orb('holy', { r: 4.6 })], bomb: () => [orb('ink', { r: 4.8 })],
  },
};
