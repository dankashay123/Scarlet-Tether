// Draws every sprite in code and exports PNG sheets + JSON frame maps to
// assets/sprites/. No dependencies: `node tools/sprites.mjs`.
// Pass --preview <dir> to also write 6x-scaled previews for review.
//
// Rules (GDD, Sprite production): light from the top-left, 1 px dark outline
// on characters/enemies/loot (none on tiles), at most 3 shades per material,
// and every pixel on the master palette (enforced in writePng).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RGB, IDX, RAMP, PALETTE } from './palette.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'sprites');

// ---------------------------------------------------------------- frames ---

class Frame {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = new Int16Array(w * h).fill(-1); // palette index, -1 = clear
  }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? -1 : this.px[y * this.w + x]; }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = typeof c === 'string' ? IDX[c] : c;
  }
  // Fill a mask with a 3-shade ramp: top/left edges light, bottom/right dark.
  shade(mask, ramp, { flat = false } = {}) {
    const [hi, mid, lo] = ramp;
    for (const k of mask) {
      const [x, y] = k.split(',').map(Number);
      let c = mid;
      if (!flat) {
        const out = (dx, dy) => !mask.has(`${x + dx},${y + dy}`);
        if (out(0, -1) || out(-1, 0)) c = hi;
        else if (out(0, 1) || out(1, 0)) c = lo;
      }
      this.set(x, y, c);
    }
  }
  outline(color = 'outline') {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y) !== -1) continue;
      if (this.get(x - 1, y) > -1 && this.get(x - 1, y) !== IDX[color] ||
          this.get(x + 1, y) > -1 && this.get(x + 1, y) !== IDX[color] ||
          this.get(x, y - 1) > -1 && this.get(x, y - 1) !== IDX[color] ||
          this.get(x, y + 1) > -1 && this.get(x, y + 1) !== IDX[color]) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, color);
    return this;
  }
}

// Mask builders (sets of "x,y").
const M = {
  ellipse(cx, cy, rx, ry) {
    const s = new Set();
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.35), dy = (y - cy) / (ry + 0.35);
        if (dx * dx + dy * dy <= 1) s.add(`${x},${y}`);
      }
    return s;
  },
  rect(x0, y0, w, h) {
    const s = new Set();
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) s.add(`${x},${y}`);
    return s;
  },
  // Trapezoid: top row from xa0..xa1 at y0, bottom xb0..xb1 at y1.
  trap(y0, xa0, xa1, y1, xb0, xb1) {
    const s = new Set();
    for (let y = y0; y <= y1; y++) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      const l = Math.round(xa0 + (xb0 - xa0) * t), r = Math.round(xa1 + (xb1 - xa1) * t);
      for (let x = l; x <= r; x++) s.add(`${x},${y}`);
    }
    return s;
  },
  line(x0, y0, x1, y1, thick = 1) {
    const s = new Set();
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
      for (let t = 0; t < thick; t++) s.add(`${x},${y + t}`);
    }
    return s;
  },
  union(...ms) { const s = new Set(); for (const m of ms) for (const k of m) s.add(k); return s; },
  minus(a, b) { const s = new Set(a); for (const k of b) s.delete(k); return s; },
};

const dot = (f, x, y, c) => f.set(x, y, c);

// ----------------------------------------------------------------- sheets ---

// A sheet packs named animations as rows of equal-sized frames.
function sheet(name, fw, fh, anims, extra = {}) {
  const rows = Object.entries(anims);
  const cols = Math.max(...rows.map(([, fs]) => fs.length));
  const W = cols * fw, H = rows.length * fh;
  const big = new Frame(W, H);
  const json = { image: `${name}.png`, frameW: fw, frameH: fh, ...extra, anims: {} };
  rows.forEach(([anim, frames], r) => {
    json.anims[anim] = frames.map((f, c) => {
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) big.px[(r * fh + y) * W + c * fw + x] = f.get(x, y);
      return { x: c * fw, y: r * fh, w: f.w, h: f.h };
    });
  });
  return { name, frame: big, json };
}

// ------------------------------------------------------------- the Saint ---
// 24x32, facing right. A hollow-faced Saint: crimson hood and mantle, pale
// robe, cracked gold halo, Nail Crossbow held at the chest.

function saint({ bob = 0, halo = 0, feet = [0, 0], hem = 0, lean = 0, tuck = 0, blink = false }) {
  const f = new Frame(24, 32);
  const by = bob;           // body vertical offset
  const lx = lean;          // forward lean for the upper body

  // Feet (dark boots).
  const fy = 29 - tuck;
  f.shade(M.rect(8 + feet[0], fy, 3, 2), ['stone2', 'stone3', 'void']);
  f.shade(M.rect(13 + feet[1], fy, 3, 2), ['stone2', 'stone3', 'void']);

  // Robe.
  const robe = M.trap(14 + by, 8 + lx, 15 + lx, 28 - tuck, 5 + hem, 18 + hem);
  f.shade(robe, RAMP.cloth);
  // Gold hem and a gold stole down the front.
  for (let x = 5 + hem; x <= 18 + hem; x++) if (robe.has(`${x},${28 - tuck}`)) dot(f, x, 28 - tuck, (x + hem) % 3 ? 'gold1' : 'gold2');
  f.shade(M.rect(13 + lx, 15 + by, 2, 12 - tuck), RAMP.gold);

  // Mantle over the shoulders.
  f.shade(M.trap(11 + by, 8 + lx, 16 + lx, 16 + by, 6 + lx, 18 + lx), RAMP.crimson);

  // Crossbow: stock, iron prod, string, hand.
  const cy = 17 + by;
  f.shade(M.rect(13 + lx, cy, 8, 2), RAMP.wood);
  f.shade(M.line(20 + lx, cy - 4, 20 + lx, cy + 5), RAMP.iron, { flat: true });
  dot(f, 21 + lx, cy - 4, 'iron1'); dot(f, 21 + lx, cy + 5, 'iron1');
  dot(f, 19 + lx, cy - 3, 'bone2'); dot(f, 19 + lx, cy + 4, 'bone2');
  dot(f, 22 + lx, cy, 'gold0'); // nail tip
  f.shade(M.rect(14 + lx, cy, 2, 2), RAMP.bone);

  // Hood with a point, and the hollow where a face should be.
  const hood = M.union(M.ellipse(12 + lx, 8 + by, 4.6, 4.6), M.rect(11 + lx, 3 + by, 2, 1), M.rect(10 + lx, 4 + by, 3, 1));
  f.shade(hood, RAMP.crimson);
  const face = M.ellipse(14 + lx, 9 + by, 2.2, 2.6);
  for (const k of face) { const [x, y] = k.split(',').map(Number); if (hood.has(k)) f.set(x, y, 'outline'); }
  // Gold trim round the face.
  for (const k of face) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[-1, 0], [0, -1], [0, 1]]) {
      const n = `${x + dx},${y + dy}`;
      if (hood.has(n) && !face.has(n)) f.set(x + dx, y + dy, 'gold1');
    }
  }
  if (!blink) { dot(f, 13 + lx, 9 + by, 'candle0'); dot(f, 15 + lx, 9 + by, 'candle0'); }
  else { dot(f, 13 + lx, 9 + by, 'candle2'); dot(f, 15 + lx, 9 + by, 'candle2'); }

  f.outline();

  // Cracked halo floats above (drawn after the outline so it reads as light).
  const hy = 1 + halo + by;
  for (let x = 8; x <= 16; x++) {
    if (x === 14) continue; // the crack
    const edge = x === 8 || x === 16;
    dot(f, x + lx, hy + (edge ? 1 : 0), x < 12 ? 'gold0' : 'gold1');
    if (!edge) dot(f, x + lx, hy + 2, 'gold2');
  }
  dot(f, 7 + lx, hy + 1, 'gold2'); dot(f, 17 + lx, hy + 1, 'gold2');
  return f;
}

function saintSheet() {
  const idle = [
    saint({ halo: 0 }), saint({ halo: -1 }), saint({ bob: 1, halo: -1 }), saint({ bob: 1, halo: 0, blink: true }),
  ];
  const run = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = Math.sin(i / 6 * Math.PI * 2);
    return saint({
      bob: i % 3 === 0 ? 0 : -1, halo: i % 3 === 0 ? 1 : 0,
      feet: [Math.round(s * 2), Math.round(-s * 2)], hem: s > 0.3 ? -1 : 0, lean: 1,
    });
  });
  const dash = [
    saint({ lean: 2, hem: -2, tuck: 1, feet: [-2, 1], halo: 1 }),
    saint({ lean: 3, hem: -3, tuck: 2, feet: [-3, 0], halo: 2 }),
    saint({ lean: 1, hem: -1, tuck: 1, feet: [-1, 1], halo: 1 }),
  ];
  return sheet('saint', 24, 32, { idle, run, dash }, { anchorX: 12, anchorY: 30, fps: 10 });
}

// ------------------------------------------------------------- the Risen ---
// 20x22 fodder, facing right: a hunched corpse in grave cloth, ribs showing,
// arms out, green pinprick eyes.

function risen({ bob = 0, legs = [0, 0], arms = 0, lean = 0, reach = 0 }) {
  const f = new Frame(20, 22);
  const lx = lean;
  // Legs.
  f.shade(M.line(7 + legs[0], 15 + bob, 6 + legs[0], 19, 2), RAMP.rot, { flat: true });
  f.shade(M.line(11 + legs[1], 15 + bob, 12 + legs[1], 19, 2), RAMP.rot, { flat: true });
  dot(f, 5 + legs[0], 20, 'rot2'); dot(f, 6 + legs[0], 20, 'rot2');
  dot(f, 12 + legs[1], 20, 'rot2'); dot(f, 13 + legs[1], 20, 'rot2');
  // Back arm.
  f.shade(M.line(9 + lx, 10 + bob, 14 + lx + reach, 11 + bob + arms, 2), ['rot1', 'rot2', 'rot2']);
  // Torso in a torn shroud.
  const torso = M.ellipse(9 + lx * 0.5, 11 + bob, 4.5, 4.5);
  f.shade(torso, RAMP.shroud);
  // Ribs through the tears.
  for (const y of [10, 12]) for (const x of [9, 11]) dot(f, x + lx * 0.5, y + bob, 'bone1');
  dot(f, 6, 15 + bob, 'shroud1'); dot(f, 8, 16 + bob, 'shroud1'); dot(f, 11, 16 + bob, 'shroud1');
  // Head, forward and low.
  const head = M.ellipse(13 + lx, 6 + bob, 3, 3);
  f.shade(head, RAMP.rot);
  dot(f, 14 + lx, 6 + bob, 'outline'); dot(f, 16 + lx, 6 + bob, 'outline');
  dot(f, 14 + lx, 6 + bob, 'candle1'); dot(f, 16 + lx, 6 + bob, 'candle0');
  dot(f, 15 + lx, 8 + bob, 'outline'); dot(f, 16 + lx, 8 + bob, 'bone1'); // jaw
  // Front arm with claw.
  const ax = 15 + lx + reach, ay = 11 + bob + arms;
  f.shade(M.line(10 + lx, 11 + bob, ax, ay, 2), RAMP.rot);
  dot(f, ax + 1, ay, 'bone1'); dot(f, ax + 1, ay + 1, 'bone2');
  return f.outline();
}

function risenSheet() {
  const walk = [
    risen({ legs: [-1, 1], arms: 0 }), risen({ bob: 1, legs: [0, 0], arms: 1 }),
    risen({ legs: [1, -1], arms: 0 }), risen({ bob: 1, legs: [0, 0], arms: -1 }),
  ];
  const attack = [
    risen({ lean: -1, arms: -4, reach: -2 }), risen({ lean: -2, arms: -5, reach: -3, bob: 1 }),
    risen({ lean: 2, arms: 1, reach: 3 }), risen({ lean: 1, arms: 0, reach: 1, bob: 1 }),
  ];
  return sheet('risen', 20, 22, { walk, attack }, { anchorX: 10, anchorY: 20, fps: 8 });
}

// ------------------------------------------------------- the Gravewarden ---
// 32x32 elite: a skull-helmed knight behind a gilded tower shield.

function warden({ bob = 0, legs = [0, 0], shield = 0, raise = 0 }) {
  const f = new Frame(32, 32);
  // Legs.
  f.shade(M.rect(11 + legs[0], 22 + bob, 3, 7 - bob), RAMP.iron);
  f.shade(M.rect(16 + legs[1], 22 + bob, 3, 7 - bob), RAMP.iron);
  // Body armor and tabard.
  f.shade(M.trap(11 + bob, 9, 19, 24 + bob, 8, 20), RAMP.iron);
  f.shade(M.rect(13, 15 + bob, 4, 10), RAMP.crimson);
  // Pauldron.
  f.shade(M.ellipse(11, 12 + bob, 3.5, 2.5), RAMP.iron);
  // Skull helm.
  const helm = M.ellipse(15, 7 + bob - raise, 4.5, 4.5);
  f.shade(helm, RAMP.bone);
  f.shade(M.rect(11, 3 + bob - raise, 9, 2), RAMP.iron, { flat: true });
  dot(f, 16, 7 + bob - raise, 'outline'); dot(f, 18, 7 + bob - raise, 'outline');
  dot(f, 16, 7 + bob - raise, 'candle0'); dot(f, 18, 7 + bob - raise, 'candle1');
  dot(f, 17, 10 + bob - raise, 'outline'); dot(f, 15, 10 + bob - raise, 'outline');
  // Tower shield held forward.
  const sx = 20 + shield, sy = 8 + bob - raise;
  const sh = M.union(M.rect(sx, sy, 7, 20), M.rect(sx + 1, sy + 20, 5, 1));
  f.shade(sh, RAMP.iron);
  for (let y = sy + 1; y < sy + 20; y++) dot(f, sx, y, 'gold1');
  f.shade(M.union(M.rect(sx + 3, sy + 3, 1, 12), M.rect(sx + 1, sy + 6, 5, 1)), RAMP.gold, { flat: true });
  dot(f, sx + 3, sy + 3, 'gold0');
  return f.outline();
}

function wardenSheet() {
  const walk = [
    warden({ legs: [-1, 1] }), warden({ bob: 1, legs: [0, 0] }),
    warden({ legs: [1, -1] }), warden({ bob: 1, legs: [0, 0] }),
  ];
  const attack = [
    warden({ shield: -2, raise: 1 }), warden({ shield: -3, raise: 2, bob: 1 }),
    warden({ shield: 3 }), warden({ shield: 1, bob: 1 }),
  ];
  return sheet('gravewarden', 32, 32, { walk, attack }, { anchorX: 15, anchorY: 29, fps: 6 });
}

// --------------------------------------------------------------- tiles ---
// 16x16, Undercroft: cold grey flagstones, brick walls. No outlines.

function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

function floorTile(variant) {
  const f = new Frame(16, 16);
  // Two flagstones per tile, offset by variant.
  const split = variant % 2 ? 7 : 9;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = hash(x, y, variant);
    let c = n < 0.08 ? 'stone2' : n > 0.93 ? 'stone4' : 'stone3';
    if (y === 15 || x === 15 || (x === split && y < 8) || (y === 7 && true) || (x === 15 - split + 3 && y > 7)) c = 'void';
    else if (y === 0 || y === 8 || x === 0 || (x === split + 1 && y < 8) || (x === 15 - split + 4 && y > 7)) c = 'stone2';
    f.set(x, y, c);
  }
  if (variant === 1) for (const [x, y] of [[3, 3], [4, 4], [4, 5], [5, 6], [11, 11], [12, 12]]) f.set(x, y, 'void');
  if (variant === 2) { f.set(4, 11, 'bone2'); f.set(5, 11, 'bone1'); f.set(6, 12, 'bone2'); f.set(11, 4, 'bone3'); }
  if (variant === 3) for (const [x, y] of [[2, 13], [3, 13], [3, 12], [12, 2], [13, 2], [13, 3], [14, 3]]) f.set(x, y, 'candle3');
  return f;
}

function wallFace() {
  const f = new Frame(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const row = Math.floor(y / 4), off = row % 2 ? 4 : 0;
    const bx = (x + off) % 8;
    let c = hash(x, y, 9) < 0.15 ? 'stone2' : 'stone3';
    if (y % 4 === 3 || bx === 7) c = 'void';
    else if (y % 4 === 0 || bx === 0) c = 'stone1';
    if (y >= 13) c = y === 15 ? 'void' : 'stone4'; // shadowed base
    f.set(x, y, c);
  }
  return f;
}

function wallTop() {
  const f = new Frame(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) f.set(x, y, hash(x, y, 4) < 0.1 ? 'dusk' : 'void');
  return f;
}

function wallCap() { // top edge where a wall meets its face
  const f = wallTop();
  for (let x = 0; x < 16; x++) { f.set(x, 14, 'stone2'); f.set(x, 15, 'stone1'); }
  return f;
}

function tilesSheet() {
  return sheet('tiles', 16, 16, {
    floor: [0, 1, 2, 3].map(floorTile),
    wall: [wallTop(), wallCap(), wallFace()],
  });
}

// ----------------------------------------------------------------- fx ---

function bolt() {
  const f = new Frame(12, 5);
  for (let x = 2; x <= 8; x++) f.set(x, 2, x < 4 ? 'bone1' : 'iron0');
  f.set(1, 1, 'bone2'); f.set(1, 3, 'bone2'); f.set(2, 1, 'bone1'); f.set(2, 3, 'bone1');
  f.set(9, 2, 'gold0'); f.set(10, 2, 'holy0'); f.set(9, 1, 'gold1'); f.set(9, 3, 'gold1');
  return f.outline();
}

function candle(flick) {
  const f = new Frame(8, 14);
  f.shade(M.rect(2, 7, 4, 6), RAMP.bone);
  f.set(2, 7, 'bone0'); f.set(4, 6, 'bone1'); // wax drip
  f.set(3, 6, 'outline'); // wick
  f.outline();
  const fl = [[3, 1 + flick], [3, 2], [4, 2 + flick], [3, 3], [4, 3], [3, 4], [4, 4], [3, 5]];
  for (const [x, y] of fl) f.set(x, y, y < 3 ? 'candle0' : 'candle1');
  f.set(2, 4, 'candle2'); f.set(5, 4 - flick, 'candle2');
  return f;
}

function mound(i) {
  const f = new Frame(16, 10);
  const m = M.ellipse(8, 6, 6 - (i === 0 ? 2 : 0), 3 - (i === 0 ? 1 : 0));
  f.shade(m, ['shroud0', 'shroud1', 'void']);
  if (i >= 1) { f.set(6, 4, 'stone2'); f.set(10, 5, 'bone2'); }
  if (i === 2) { f.set(8, 2, 'rot1'); f.set(9, 2, 'rot1'); f.set(8, 1, 'rot0'); } // a hand breaks through
  return f.outline();
}

function gib(kind) {
  const f = new Frame(8, 8);
  if (kind === 0) { f.shade(M.ellipse(4, 4, 2.4, 2.4), RAMP.rot); f.set(5, 4, 'outline'); f.set(3, 4, 'outline'); f.set(4, 6, 'blood1'); }
  if (kind === 1) { f.shade(M.line(1, 5, 6, 3, 2), RAMP.rot); f.set(6, 3, 'blood0'); f.set(6, 4, 'blood1'); f.set(1, 6, 'bone1'); }
  if (kind === 2) { f.shade(M.line(2, 1, 4, 6, 2), RAMP.rot); f.set(2, 1, 'blood0'); f.set(5, 6, 'rot2'); }
  if (kind === 3) { f.shade(M.ellipse(4, 4, 2.5, 2), RAMP.shroud); f.set(3, 3, 'bone1'); f.set(5, 3, 'bone1'); f.set(3, 5, 'blood1'); f.set(4, 4, 'bone2'); }
  return f.outline();
}

function wardenGib(kind) {
  const f = new Frame(8, 8);
  if (kind === 0) { f.shade(M.ellipse(4, 4, 2.6, 2.6), RAMP.bone); f.set(5, 4, 'outline'); f.set(3, 4, 'outline'); }
  if (kind === 1) { f.shade(M.rect(2, 1, 4, 6), RAMP.iron); f.set(4, 3, 'gold1'); f.set(4, 4, 'gold1'); f.set(3, 4, 'gold1'); f.set(5, 4, 'gold1'); }
  if (kind === 2) { f.shade(M.line(1, 2, 6, 5, 2), RAMP.iron); f.set(6, 5, 'blood1'); }
  if (kind === 3) { f.shade(M.rect(2, 2, 4, 4), RAMP.crimson); f.set(3, 3, 'gold1'); }
  return f.outline();
}

function shard() { // execution prompt marker: a small gilded dagger
  const f = new Frame(8, 12);
  for (let y = 1; y <= 6; y++) f.set(4, y, y < 3 ? 'holy0' : 'iron0');
  f.set(3, 7, 'gold1'); f.set(4, 7, 'gold0'); f.set(5, 7, 'gold1'); f.set(2, 7, 'gold2'); f.set(6, 7, 'gold2');
  f.set(4, 8, 'wood0'); f.set(4, 9, 'wood1'); f.set(4, 10, 'gold1');
  return f.outline();
}

function fxSheet() {
  return sheet('fx', 16, 16, {
    bolt: [bolt()],
    candle: [candle(0), candle(1), candle(0), candle(-1)].map((c) => c),
    mound: [mound(0), mound(1), mound(2)],
    gib: [0, 1, 2, 3].map(gib),
    wardenGib: [0, 1, 2, 3].map(wardenGib),
    dagger: [shard()],
  }, { fps: 8 });
}

// --------------------------------------------------------- HUD icons ---
// Bold black-and-white circular skill glyphs (GDD HUD style), 16x16 white.

function icon(draw) { const f = new Frame(16, 16); draw(f); return f; }
const W = 'bone0';
const icons = {
  dash: icon((f) => { // three chevrons
    for (const ox of [2, 6, 10]) for (let i = 0; i < 4; i++) { f.set(ox + i, 4 + i, W); f.set(ox + i, 11 - i, W); f.set(ox + i + 1, 4 + i, W); f.set(ox + i + 1, 11 - i, W); }
  }),
  flask: icon((f) => { // Holy Water Flask
    f.shade(M.rect(6, 2, 4, 4), [W, W, W], { flat: true });
    f.shade(M.ellipse(8, 10, 4.5, 4), [W, W, W], { flat: true });
    f.set(7, 9, 'outline'); f.set(8, 9, 'outline'); f.set(8, 8, 'outline'); f.set(8, 10, 'outline'); f.set(9, 9, 'outline');
  }),
  chain: icon((f) => { // Chain of Penitence
    for (const [cx, cy] of [[4, 4], [8, 8], [12, 12]]) for (const k of M.minus(M.ellipse(cx, cy, 2.6, 2.6), M.ellipse(cx, cy, 1.1, 1.1))) { const [x, y] = k.split(',').map(Number); f.set(x, y, W); }
  }),
  penance: icon((f) => { // a weeping sun
    for (const k of M.ellipse(8, 8, 3.2, 3.2)) { const [x, y] = k.split(',').map(Number); f.set(x, y, W); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; f.set(8 + Math.round(Math.cos(a) * 6), 8 + Math.round(Math.sin(a) * 6), W); f.set(8 + Math.round(Math.cos(a) * 5.5), 8 + Math.round(Math.sin(a) * 5.5), W); }
    f.set(7, 9, 'outline'); f.set(9, 9, 'outline');
  }),
  lock: icon((f) => {
    for (const k of M.minus(M.ellipse(8, 6, 3, 3), M.ellipse(8, 6, 1.5, 1.5))) { const [x, y] = k.split(',').map(Number); if (y <= 7) f.set(x, y, W); }
    for (const k of M.rect(4, 7, 9, 7)) { const [x, y] = k.split(',').map(Number); f.set(x, y, W); }
    f.set(8, 10, 'outline'); f.set(8, 11, 'outline');
  }),
  pause: icon((f) => { for (const k of M.union(M.rect(4, 3, 3, 10), M.rect(9, 3, 3, 10))) { const [x, y] = k.split(',').map(Number); f.set(x, y, W); } }),
};

function iconSheet() {
  return sheet('icons', 16, 16, Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, [v]])));
}

// ----------------------------------------------------------------- png ---

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
      if (i < 0 && bg) { raw[o] = bg[0]; raw[o + 1] = bg[1]; raw[o + 2] = bg[2]; raw[o + 3] = 255; continue; }
      if (i < 0) { raw[o + 3] = 0; continue; }
      const rgb = RGB[i];
      if (!rgb) throw new Error(`off-palette pixel index ${i}`);
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- main ---

const sheets = [saintSheet(), risenSheet(), wardenSheet(), tilesSheet(), fxSheet(), iconSheet()];
mkdirSync(OUT, { recursive: true });
const manifest = { palette: PALETTE };
for (const s of sheets) {
  writeFileSync(join(OUT, `${s.name}.png`), png(s.frame));
  writeFileSync(join(OUT, `${s.name}.json`), JSON.stringify(s.json, null, 1));
  manifest[s.name] = s.json;
}
// One combined manifest so the game needs a single fetch.
writeFileSync(join(OUT, 'sprites.json'), JSON.stringify(manifest));

const pi = process.argv.indexOf('--preview');
if (pi > 0) {
  const dir = process.argv[pi + 1];
  mkdirSync(dir, { recursive: true });
  for (const s of sheets) writeFileSync(join(dir, `${s.name}@6x.png`), png(s.frame, 6, [70, 60, 80]));
}
console.log(`wrote ${sheets.length} sheets to assets/sprites/`);
