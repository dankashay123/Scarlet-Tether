// Sculpted models for the 'rare' set. Exports { sheetName: { animName: () => frames } }.
// Each frame is a render() result with ax/ay set (the feet anchor).
//
// Rares stand about 60 px tall (1.3x the old sprites) in a 76x80 frame,
// feet at y 74, facing right. Every model is one smooth-unioned form; eyes,
// strings, chains and whips are placed by hand after rendering.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, folds, bumpy, clip, render, dot, pline, under } from '../sdf.mjs';
import { MATS, torus, stride, odd, cyc, HALF, reactions, bobAt } from './base.mjs';

const W = 76, H = 80, GY = 74, CX = 32;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const MM = {
  ...MATS,
  plate: { ramp: 'iron', spec: 0.7, bias: -0.06 }, helm: { ramp: 'iron', spec: 0.6, bias: -0.22, min: 1 }, plateDark: { ramp: 'iron', spec: 0.5, bias: -0.2, min: 2 },
  slateArmor: { ramp: 'slate', spec: 0.55, bias: 0.06 }, slateDark: { ramp: 'slate', bias: -0.1, min: 2 },
  violetDark: { ramp: 'violet', bias: -0.14, min: 2, spec: 0.05 }, violetDeep: { ramp: 'violet', bias: -0.3, min: 4 }, widow: { ramp: 'violet', bias: -0.5, min: 5, spec: 0.15 }, widowLit: { ramp: 'violet', bias: -0.35, min: 4 },
  bronze: { ramp: 'gold', spec: 0.65, bias: -0.3, min: 2 }, bronzeIn: { ramp: 'gold', bias: -0.5, min: 5 },
  wax: { ramp: 'bone', spec: 0.35, bias: -0.06 }, waxDrip: { ramp: 'cloth', spec: 0.5, bias: 0.05, max: 6 },
  crimsonDeep: { ramp: 'crimson', bias: -0.22, min: 3 }, bloodWet: { ramp: 'blood', spec: 0.7, bias: -0.05 },
  shroudDark: { ramp: 'shroud', bias: -0.12, min: 2 }, rotDark: { ramp: 'rot', bias: -0.15, min: 2, spec: 0.1 },
  skullBone: { ramp: 'bone', bias: -0.1, spec: 0.25 },
  rotFlesh: { ramp: 'rot', bias: -0.2, spec: 0.15, min: 1 },
  boneDark: { ramp: 'bone', bias: -0.15, spec: 0.15 }, mask: { ramp: 'bone', spec: 0.35, bias: 0.05 },
  sootCloth: { ramp: 'slate', bias: -0.18, min: 3 }, ash: { ramp: 'stone', bias: -0.05 },
  lanternGlass: { ramp: 'ember', glow: 2 }, lanternCore: { ramp: 'ember', glow: 0 },
};

// ---------------------------------------------------------------- helpers ---
const frame = (S, o = {}) => Object.assign(render(S, W, H, MM, { ground: GY, ...o }), { ax: CX, ay: GY - 1 });
// Pixel coordinates for hand-placed touches (model x 30.5 is pixel 30).
const px = (f, x, y, c) => dot(f, Math.floor(x), Math.floor(y), c);
const eye = (f, x, y, top, bot) => { px(f, x, y, top); if (bot) px(f, x, y + 1, bot); };
// A tapered flat blade from a to b (xy plane), w wide at the base, t thick.
function blade(a, b, w, t, mat, tip = 0.15) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, zc = a[2];
  const R = Math.max(w, t) + 1;
  return { mat, bb: [Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, zc - t - 1, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, zc + t + 1],
    f: (x, y, z) => { const px = x - a[0], py = y - a[1]; const u = px * ux + py * uy, v = -px * uy + py * ux; const k = clamp(u / L, 0, 1); const hw = w / 2 * (1 - (1 - tip) * Math.pow(k, 3)); return Math.max(Math.abs(u - L / 2) - L / 2, Math.abs(v) - hw, Math.abs(z - zc) - t / 2) - 0.15; } };
}
// Walk phase: t in 0..3. s swings legs, lift raises the passing foot.
// Planted feet: sw is the front foot, swB the back foot (half a cycle behind).
const gait = (t, amp = 4) => { const a = t * Math.PI / 2, s = Math.sin(a), c = Math.cos(a), f = stride(t / 4, amp, 2.4), b = stride(t / 4 + 0.5, amp, 2.4); return { s, c, sw: f.x, swB: b.x, lift: [b.up, f.up], bob: bobAt(t) }; };
// A two-segment leg ending in a boot. side -1 = far leg.
function leg(S, { x, hipY, z, sw, up, mats = ['shroud', 'leather', 'leather'], r = [3.2, 2.7, 2.4], foot = [3.6, 2, 2.6], k = 1, kneeF = 1.2 }) {
  const knee = [x + sw * 0.55 + kneeF, (hipY + GY) / 2 + 0.5 - up * 0.6, z + 0.5], ankle = [x + sw, GY - 2.2 - up, z];
  S.add(capsule([x, hipY, z], knee, r[0], r[1], mats[0]), k);
  S.add(capsule(knee, ankle, r[1], r[2], mats[1]), 0.8);
  S.add(ellipsoid([ankle[0] + foot[0] * 0.45, ankle[1] + 0.8, z], foot, mats[2]), 0.8);
  return { knee, ankle };
}
// A two-segment arm.
function arm(S, sh, el, hd, r, mat, k = 1.2, handMat = null, handR = 0) {
  S.add(capsule(sh, el, r[0], r[1], mat), k);
  S.add(capsule(el, hd, r[1], r[2], mat), 0.8);
  if (handMat) S.add(sphere(hd, handR, handMat), 0.6);
}
const band = (y0, y1, mat, extra = () => -1) => ({ f: (x, y, z) => Math.max(y0 - y, y - y1, extra(x, y, z)), mat });
// Curved line through control points (quadratic), for chains, whips, cords.
function curve(p0, p1, p2, n) { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; out.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]); } return out; }
function outlineDot(f, x, y) { if (under(f, x, y) < 0) dot(f, x, y, 'outline'); }
// An iron chain drawn pixel by pixel with its own dark outline.
function chain(f, pts, light = 'iron1', dark = 'iron5') {
  const cells = []; let last = null;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) || 1; for (let j = 0; j <= n; j++) { const x = Math.round(x0 + (x1 - x0) * j / n), y = Math.round(y0 + (y1 - y0) * j / n); const key = x + ',' + y; if (key !== last) { cells.push([x, y]); last = key; } } }
  for (const [x, y] of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) outlineDot(f, x + dx, y + dy);
  cells.forEach(([x, y], i) => dot(f, x, y, i % 3 === 2 ? dark : i % 3 === 0 ? light : 'iron2'));
}
function cord(f, pts, cols) {
  const cells = []; let last = null;
  for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5) || 1; for (let j = 0; j <= n; j++) { const x = Math.round(x0 + (x1 - x0) * j / n), y = Math.round(y0 + (y1 - y0) * j / n); const key = x + ',' + y; if (key !== last) { cells.push([x, y]); last = key; } } }
  for (const [x, y] of cells) for (const [dx, dy] of [[0, 1], [0, -1]]) outlineDot(f, x + dx, y + dy);
  cells.forEach(([x, y], i) => dot(f, x, y, cols[Math.min(cols.length - 1, Math.floor(i / cells.length * cols.length))]));
}
// A swing smear: a crescent that thickens toward its leading end.
function smear(f, ox, oy, r, a0, a1, sy = 1, cols = ['holy0', 'holy1', 'holy2', 'holy3']) {
  const n = Math.ceil(Math.abs(a1 - a0) * r * 1.6);
  for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + (a1 - a0) * t, th = 0.5 + t * 2.6;
    for (let d = 0; d < th; d += 0.5) { const rr = r - d; const x = Math.round(ox + Math.cos(a) * rr), y = Math.round(oy + Math.sin(a) * rr * sy); if (under(f, x, y) < 0 || d > 0) { if (under(f, x, y) >= 0 && d > 0.6) continue; dot(f, x, y, cols[Math.min(cols.length - 1, Math.floor(d / th * cols.length))]); } } }
}
const walkSet = (fn) => () => HALF.map((t) => fn({ t, ...gait(t) }));
const atkSet = (fn, n = 2) => () => Array.from({ length: n }, (_, i) => fn(i, n));

// A skull head: cranium, cheekbones and jaw melted together, with sockets.
function skull(S, c, r, mat = 'bone') {
  S.add(sphere(c, r, mat), 0);
  S.add(ellipsoid([c[0] + r * 0.35, c[1] + r * 0.62, c[2] + r * 0.15], [r * 0.62, r * 0.42, r * 0.7], mat), r * 0.35);
  const E = [[0.3, 0.75], [0.8, 0.32]];
  for (const [ex, ez] of E) S.sub(sphere([c[0] + r * ex, c[1] + r * 0.12, c[2] + r * ez], r * 0.36, 'void'), 0.35);
  S.sub(ellipsoid([c[0] + r * 0.72, c[1] + r * 0.45, c[2] + r * 0.6], [r * 0.12, r * 0.16, r * 0.3], 'void'), 0.2);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (c[1] + r * 0.82)) - 0.4, c[0] + r * 0.05 - x, -z + c[2]), mat: 'boneDark' });
  return { eyes: E.map(([ex, ez]) => [c[0] + r * ex, c[1] + r * 0.12]) };
}
// A crown band with spikes.
function crown(S, c, R, mat = 'gold', n = 5, h = 3.5) {
  S.add(torus(c, R, 0.9, 0.35, mat), 0);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.4, x = c[0] + Math.cos(a) * R, z = c[2] + Math.sin(a) * R; if (z < -R * 0.5) continue; S.add(capsule([x, c[1] - 0.3 + Math.sin(a) * 0.3, z], [x + 0.2, c[1] - h, z], 0.9, 0.3, mat), 0.4); }
}

// ============================================================ the knight ===
// Ossuary Knight: a crowned skeleton in plate and a violet tabard, with a
// greatsword. Attack: raise the blade overhead, then a wide cleave.
function knight({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], pose = 'walk', p = 0 }) {
  const S = new Scene(), cx = CX, B = bob, hipY = 51 + B;
  const lean = pose === 'strike' ? 2.5 : pose === 'windup' ? -1.5 : 0, X = lean;
  // Legs in greaves.
  for (const [side, s, up] of [[-1, swB, lift[0]], [1, sw, lift[1]]]) leg(S, { x: cx + side * 0.6 + X * 0.3, hipY, z: side * 2.3, sw: s, up, mats: ['plateDark', 'plate', 'plate'], r: [3.1, 2.8, 2.7], foot: [4, 2.2, 2.8] });
  for (const [side, s] of [[-1, swB], [1, sw]]) S.paint({ f: (x, y, z) => Math.hypot(x - (cx + side * 0.6 + s * 0.55 + 1.2), y - ((hipY + GY) / 2 + 0.5), z - (side * 2.3 + 2.6)) - 1.7, mat: 'gold' });
  // Breastplate, faulds and the tabard.
  S.add(ellipsoid([cx + X, 39 + B, 0], [7, 8.6, 5.2], 'plate'), 0);
  S.add(ellipsoid([cx + X * 0.6, 47 + B, 0], [6.4, 3.4, 4.6], 'plateDark'), 1.5);
  S.add(folds(skirt(cx + X * 0.4 + 0.5, 45 + B, 62 + B * 0.5, 6, 8, 0, 1.0, 'violet'), { cx: cx + 0.5, n: 6, amp: 0.55, y0: 46, y1: 62 }), 1);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (cx + X * 0.7 + 1)) - 3, 32 + B - y, y - 47 - B, -z + 1.5), mat: 'violet' });
  S.paint({ f: (x, y) => Math.abs(y - (60.6 + B * 0.5)) - 0.75, mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (46.4 + B)) - 0.9, -z + 1.5), mat: 'leather' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (46.4 + B)) - 1.2, Math.abs(x - (cx + X * 0.6 + 1)) - 1.3, -z + 3), mat: 'gold' });
  // A bone cross sigil on the tabard.
  const tx = cx + X * 0.7 + 1;
  S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - tx) - 0.6, Math.abs(y - 39 - B) - 3), Math.max(Math.abs(x - tx) - 2, Math.abs(y - 37.6 - B) - 0.6)) + (z < 2 ? 9 : 0), mat: 'bone' });
  // Pauldrons, rolled at the edge.
  for (const [side, z] of [[-1, -3.4], [1, 3.4]]) {
    S.add(ellipsoid([cx + side * 6.2 + X, 32 + B, z], [4.6, 3.8, 3.9], side < 0 ? 'plateDark' : 'plate'), 1.6);
    S.paint({ f: (x, y, zz) => Math.max(Math.abs(y - (34.6 + B)) - 0.6, Math.hypot(x - (cx + side * 6.2 + X), zz - z) - 5), mat: 'gold' });
  }
  // Arms and the greatsword.
  let hand, tip;
  if (pose === 'windup') { hand = [cx + 5 + X, 15 + B, 4.5]; tip = [hand[0] - 15, hand[1] - 16]; }
  else if (pose === 'strike') { hand = [cx + 13 + X, 41 + B, 5]; tip = [hand[0] + 24, hand[1] + 9]; }
  else { hand = [cx + 9 + X, 46 + B, 5]; tip = [hand[0] + 17, hand[1] + 19]; }
  const el = pose === 'windup' ? [cx + 9 + X, 24 + B, 4.4] : pose === 'strike' ? [cx + 10 + X, 36 + B, 4.4] : [cx + 9.2 + X, 39 + B, 4.4];
  arm(S, [cx + 6 + X, 33 + B, 3.6], el, hand, [2.8, 2.5, 2.4], 'plate', 1.4, 'plateDark', 2.6);
  const bel = pose === 'windup' ? [cx - 2 + X, 22 + B, -3] : [cx - 7 + X, 40 + B, -3.4];
  arm(S, [cx - 6 + X, 33 + B, -3.4], bel, pose === 'windup' ? [hand[0] - 1.5, hand[1] + 1.5, 1] : [cx - 6 + X, 46 + B, -2.4], [2.6, 2.3, 2.2], 'plateDark', 1.2, 'plateDark', 2.2);
  const dx = tip[0] - hand[0], dy = tip[1] - hand[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const g0 = [hand[0] + ux * 2.6, hand[1] + uy * 2.6, 6];
  S.add(blade(g0, [tip[0], tip[1], 6], 3.4, 0.9, 'iron', 0.1), 0);
  S.add(blade([g0[0] - uy * 4.4, g0[1] + ux * 4.4, 6], [g0[0] + uy * 4.4, g0[1] - ux * 4.4, 6], 1.6, 1.4, 'gold', 0.8), 0);
  S.add(capsule([hand[0] - ux * 3.4, hand[1] - uy * 3.4, 6], g0, 0.9, 0.9, 'leather'), 0);
  S.add(sphere([hand[0] - ux * 4.2, hand[1] - uy * 4.2, 6], 1.3, 'gold'), 0);
  S.paint({ f: (x, y, z) => { const px = x - g0[0], py = y - g0[1]; const v = -px * uy + py * ux, u = px * ux + py * uy; return Math.max(Math.abs(v) - 0.35, -u, u - L * 0.7, Math.abs(z - 6) - 0.7); }, mat: 'plateDark' });
  // Gorget, skull and crown.
  const hx = cx + 1.5 + X * 1.2, hy = 24 + B + (pose === 'strike' ? 2 : 0);
  S.add(capsule([cx + X, 32 + B, 0], [hx - 0.5, hy + 4, 0], 3.6, 3, 'plateDark'), 1.4);
  const sk = skull(S, [hx, hy, 0.5], 5.8, 'skullBone');
  crown(S, [hx - 0.6, hy - 5.2, 0.2], 3.7, 'gold', 5, 2.8);
  if (pose === 'windup') S.paint({ f: (x, y, z) => Math.hypot(x - tip[0], y - tip[1], z - 6) - 3, mat: 'holy' });
  const f = frame(S);
  for (const [ex, ey] of sk.eyes) eye(f, ex, ey, 'holy0', 'holy2');
  if (pose === 'strike') { // the arc of the cleave
    smear(f, cx + 4, 42, 31, -1.15, 0.55, 0.85);
  }
  return f;
}

// --------------------------------------------------------- robe helpers ---
// A floor-length robe with folds and a hem trim; boots peek out when walking.
function robe(S, { cx, top, bot = GY - 1, ra, rb, mat, n = 8, amp = 0.6, zs = 0.9, hem = null, k = 1.2, phase = 0, sway = 0 }) {
  S.add(rotZ(folds(skirt(cx, top, bot, ra, rb, 0, zs, mat), { cx, n, amp, y0: top, y1: bot, phase }), [cx, top], sway * 0.04), k);
  if (hem) S.paint({ f: (x, y) => bot - 1.4 - y, mat: hem });
}
function boots(S, cx, [swB, sw], lift, mat = 'leather', z = 2) {
  for (const [side, s, up] of [[-1, swB, lift[0]], [1, sw, lift[1]]]) S.add(ellipsoid([cx + 2 + s * 0.8, GY - 1.8 - up * 0.7, side * z], [3.2, 1.9, 2.1], mat), 0.6);
}
// A hood with a dark face hollow. Returns the face centre (for eyes).
function hood(S, c, r, mat, { fz = 0.7, fx = 0.55, cut = 0.62, point = null, rim = null } = {}) {
  const h = ellipsoid(c, [r * 1.05, r, r], mat);
  S.add(h, 1.6);
  if (point) S.add(capsule([c[0] - r * 0.4, c[1] - r * 0.5, c[2] - 0.5], point, r * 0.6, 0.8, mat), 1.6);
  const fc = [c[0] + r * fx, c[1] + r * 0.2, c[2] + r * fz];
  const cutE = ellipsoid(fc, [r * cut * 0.85, r * cut, r * cut * 0.9], 'void');
  S.sub(cutE, 0.6);
  if (rim) S.paint({ f: (x, y, z) => Math.max(cutE.f(x, y, z) - 0.9, -h.f(x, y, z) - 0.7), mat: rim });
  return fc;
}
// Sparks and motes scattered by hand.
function sparks(f, pts, cols) { pts.forEach(([x, y], i) => { if (under(f, x, y) < 0) dot(f, x, y, cols[i % cols.length]); }); }

// ======================================================= tithe collector ===
// A fat priest in crimson and gold under a tall mitre, swinging a censer of
// embers on a chain. Attack: censer swung high, then flung round in a ring.
function collector({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 2, B = bob;
  boots(S, cx, [swB, sw], lift, 'leather', 3);
  robe(S, { cx: cx + 1, top: 50 + B, ra: 8.4, rb: 9.6, mat: 'crimsonDeep', n: 9, amp: 0.6, hem: 'gold', sway: -sw * 0.3 });
  // The great belly, a gilded orphrey band down the front.
  S.add(ellipsoid([cx + 3.5, 43 + B, 1.5], [10.6, 10.4, 9], 'crimson'), 2);
  S.add(ellipsoid([cx, 32 + B, 0], [7.6, 5.6, 6], 'crimson'), 2.4);
  const ob = (y) => cx + 6.5 + Math.max(0, 6 - Math.abs(y - 43 - B)) * 0.55;
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - ob(y)) - 2.2, 28 + B - y, -z + 3), mat: 'gold' });
  for (const yy of [36, 46]) S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - ob(y)) - 0.5, Math.abs(y - yy - B) - 1.7), Math.max(Math.abs(x - ob(y)) - 1.5, Math.abs(y - yy + 0.6 - B) - 0.5)) + (z < 3 ? 9 : 0), mat: 'crimsonDark' });
  // A coin purse at the belt.
  S.add(ellipsoid([cx - 4, 50 + B, 7], [2.6, 3, 2], 'leather'), 0.8);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (47.6 + B)) - 0.6, Math.hypot(x - (cx - 4), z - 7) - 2.8), mat: 'gold' });
  // Arms: the back one on the belly, the front one holding the chain.
  arm(S, [cx - 6, 32 + B, -4], [cx - 9, 39 + B, -4], [cx - 6, 44 + B, 4], [3.2, 2.8, 2.6], 'crimsonDark', 1.4, 'skin', 2.1);
  let hand, cen;
  const swing = pose === 'walk' ? Math.sin(t * Math.PI / 2) * 0.35 : 0;
  if (pose === 'windup') { hand = [cx + 11, 21 + B, 6]; cen = [cx - 9, 9 + B]; }
  else if (pose === 'strike') { hand = [cx + 16, 34 + B, 6]; cen = [cx + 31, 30 + B]; }
  else { hand = [cx + 12, 42 + B, 6]; cen = [hand[0] + 1 + Math.sin(swing) * 12, hand[1] + Math.cos(swing) * 13]; }
  const el = pose === 'windup' ? [cx + 11, 31 + B, 5] : [cx + 11, 36 + B, 5];
  arm(S, [cx + 6, 32 + B, 4], el, hand, [3.2, 2.8, 2.4], 'crimson', 1.4, 'skin', 2.2);
  S.paint({ f: (x, y, z) => Math.hypot(x - (hand[0] - 2), y - (hand[1] - 0.6 * (pose === 'windup' ? -1 : 1)), z - (hand[2] - 0.5)) - 2.8, mat: 'gold' });
  // The censer: a pierced bronze globe with a lid and finial.
  const C = [cen[0], cen[1], 7];
  S.add(sphere(C, 3.6, 'bronze'), 0);
  S.add(ellipsoid([C[0], C[1] - 3, C[2]], [2.2, 1.3, 2.2], 'bronze'), 0.8);
  S.add(sphere([C[0], C[1] - 4.8, C[2]], 0.9, 'gold'), 0.3);
  for (const [a, b] of [[-1.2, 0.6], [0.4, 0.8], [1.6, 0.2], [-0.4, -0.6]]) S.sub(sphere([C[0] + a * 1.6, C[1] + b * 1.6, C[2] + 3.1], 0.8, 'lanternGlass'), 0);
  // Fleshy jowled face under a tall mitre.
  const hx = cx + 3.5, hy = 23.5 + B;
  S.add(capsule([cx + 1, 29 + B, 0], [hx, hy + 2, 0.5], 4.4, 4, 'skin'), 1.4);
  S.add(sphere([hx, hy, 1], 5, 'skin'), 1.4);
  S.add(ellipsoid([hx + 1.2, hy + 3.6, 1.8], [4.4, 2.6, 4], 'skin'), 1.2);
  S.add(sphere([hx + 4.2, hy + 0.6, 2.4], 1.1, 'skin'), 0.6);
  const mit = clip(ellipsoid([hx - 0.5, hy - 7.5, 0.5], [5, 8.4, 3.8], 'cloth'), (x, y) => y - (hy - 3));
  S.add(mit, 0.5);
  S.paint({ f: (x, y) => Math.abs(y - (hy - 3.4)) - 1, mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (hx + 0.5)) - 0.9, y - (hy - 3) , -z + 2), mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (hy - 9)) - 0.8, Math.abs(x - (hx + 0.5)) - 2.2, -z + 2), mat: 'gold' });
  const f = frame(S);
  px(f, hx + 2.2, hy - 0.2, 'ink0'); px(f, hx + 4.3, hy - 0.3, 'ink0'); px(f, hx + 1.9, hy - 1.2, 'skin4'); px(f, hx + 4.2, hy - 1.3, 'skin4');
  pline(f, Math.floor(hx + 2), Math.floor(hy + 3), Math.floor(hx + 4.5), Math.floor(hy + 2.4), 'skin4');
  chain(f, curve([hand[0] + 0.5, hand[1] - 1], [(hand[0] + C[0]) / 2, (hand[1] + C[1]) / 2 + (pose === 'walk' ? 2 : -2)], [C[0], C[1] - 5.5], 10), 'gold1', 'gold4');
  const sp = pose === 'strike' ? [[C[0] + 5, C[1] - 3], [C[0] + 7, C[1] + 2], [C[0] + 3, C[1] + 6], [C[0] + 8, C[1] - 6], [C[0] - 3, C[1] - 6], [C[0] + 10, C[1] + 1]] : pose === 'windup' ? [[C[0] - 4, C[1] + 3], [C[0] + 3, C[1] - 5]] : [[C[0] + (odd(t) * 3 - 1), C[1] - 6 - (Math.floor(t) % 3)]];
  sparks(f, sp, ['ember0', 'ember1', 'ember2']);
  return f;
}

// A candle flame by hand: a teardrop h pixels tall, outlined.
function flame(f, x, y, h, big = false) {
  x = Math.floor(x); y = Math.floor(y);
  const rows = big ? [[0, 0], [0, 0], [-1, 1], [-1, 1], [-1, 1], [-1, 1], [0, 0]].slice(0, h) : [[0, 0], [0, 0], [-1, 0], [-1, 1], [0, 0]].slice(0, h);
  const pts = [];
  rows.forEach(([a, b], i) => { for (let dx = a; dx <= b; dx++) pts.push([x + dx, y - (h - 1) + i, i, dx]); });
  for (const [px_, py] of pts) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) outlineDot(f, px_ + dx, py + dy);
  for (const [px_, py, i, dx] of pts) dot(f, px_, py, i < 2 ? 'ember2' : i >= h - 2 && dx === 0 ? 'ember0' : dx < 0 ? 'ember1' : 'ember0h');
}

// ============================================================ mother wax ===
// A hunched matron poured from candle wax under a sooty shawl, a lit candle
// for a head and more burning in her back. Attack: lifts a lit wax bomb, then
// hurls it.
function motherwax({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 3, B = bob;
  boots(S, cx + 1, [swB, sw], lift, 'wax', 3);
  robe(S, { cx, top: 46 + B, ra: 8.4, rb: 9.8, mat: 'wax', n: 7, amp: 0.9, sway: -sw * 0.3 });
  // The hunched, poured body leaning forward.
  S.add(bumpy(ellipsoid([cx, 43 + B, 0], [9.6, 9.6, 7.6], 'wax'), 0.6, 0.38, 3), 2);
  S.add(bumpy(ellipsoid([cx + 2.5, 35 + B, 0], [10.4, 7.6, 7.6], 'sootCloth'), 0.35, 0.5, 7), 2);
  // Shawl fringe.
  // Candles in her back and shoulders.
  const cands = [[cx - 5, 29 + B, -3, 6], [cx - 1, 26 + B, -4.5, 5], [cx - 8.5, 34 + B, -1, 4], [cx + 3, 27 + B, -3, 3.5]];
  for (const [x, y, z, h] of cands) S.add(capsule([x, y + 3, z], [x - 0.6, y - h, z], 1.5, 1.35, 'waxDrip'), 1);
  // Arms: thin, waxen; the front one holds a wax bomb.
  let hand;
  if (pose === 'windup') hand = [cx + 6, 15 + B, 5];
  else if (pose === 'strike') hand = [cx + 20, 34 + B, 5];
  else hand = [cx + 13, 46 + B + odd(t) * 0.5, 5];
  const el = pose === 'windup' ? [cx + 12, 26 + B, 5] : pose === 'strike' ? [cx + 14, 33 + B, 5] : [cx + 12, 40 + B, 5];
  arm(S, [cx + 8, 35 + B, 4], el, hand, [2.6, 2.2, 2], 'wax', 1.6, 'wax', 2.2);
  arm(S, [cx - 4, 36 + B, -3.5], [cx - 7, 43 + B, -2], [cx - 4, 49 + B, 2], [2.4, 2, 1.8], 'wax', 1.4, 'wax', 1.9);
  const bomb = pose === 'strike' ? [hand[0] + 6, hand[1] - 3, 6] : [hand[0] + 1, hand[1] - 3.6, 6];
  if (pose !== 'strike') { S.add(bumpy(sphere(bomb, 3.1, 'waxDrip'), 0.3, 0.9, 4), 1); S.add(capsule([bomb[0], bomb[1] - 2.4, 6], [bomb[0] + 0.5, bomb[1] - 4, 6], 0.4, 0.4, 'ink'), 0); }
  // The candle head, thrust forward, with a melted, drooping rim.
  const hx = cx + 9, hy = 27 + B;
  S.add(capsule([hx - 1.5, hy + 7, 1], [hx, hy - 4, 1.5], 4.4, 4, 'wax'), 1.6);
  S.add(torus([hx, hy - 4, 1.5], 3.7, 1.2, 0.3, 'waxDrip'), 0.8);
  S.sub(ellipsoid([hx, hy - 5.4, 1.5], [2.6, 1.4, 2.6], 'waxDrip'), 0.5);
  // A shawl hood around the candle's base.
  S.add(ellipsoid([hx - 3, hy + 4.5, 0], [5.4, 4, 5], 'sootCloth'), 1.4);
  // Drips down the body.
  for (const [x0, y0, len] of [[hx + 3, hy - 4, 5], [hx - 1.5, hy - 4, 3], [hx + 1.4, hy - 4, 7], [cx + 6, 41, 9], [cx - 2, 41, 14], [cx + 2, 42, 6], [cx + 8, 42, 4]]) S.paint({ f: (x, y, z) => Math.max(Math.abs(x - x0) - 0.75, (y0 + B) - y, y - (y0 + B + len), -z + 1), mat: 'waxDrip' });
  const f = frame(S);
  flame(f, hx + 0.3, hy - 6.4, 7 - odd(t), true);
  for (const [x, y, , h] of cands) flame(f, x - 0.6, y - h - 1.2, 4 + ((t + Math.round(x)) % 2));
  if (pose !== 'strike') flame(f, bomb[0] + 0.5, bomb[1] - 4.6, 4);
  else { for (const [x, y] of [[bomb[0], bomb[1]], [bomb[0] + 1, bomb[1]], [bomb[0], bomb[1] + 1], [bomb[0] + 1, bomb[1] + 1]]) dot(f, x, y, 'ember0'); sparks(f, [[bomb[0] - 3, bomb[1] + 2], [bomb[0] - 6, bomb[1] + 3], [bomb[0] + 3, bomb[1] - 2], [bomb[0] - 9, bomb[1] + 3]], ['ember1', 'ember2']); }
  // A melted face: sunken eyes weeping wax, a sagging mouth.
  for (const ex of [hx + 1, hx + 3.3]) { px(f, ex, hy + 0.2, 'ember1'); px(f, ex, hy + 1.2, 'cloth5'); }
  px(f, hx + 1.6, hy + 3.7, 'shroud3'); px(f, hx + 2.6, hy + 3.9, 'shroud3'); px(f, hx + 3.5, hy + 3.6, 'shroud3');
  return f;
}

// ========================================================= hollow bishop ===
// A gaunt bishop in violet with a towering mitre and a hollow where his face
// was. Attack: raises the crook as its orb swells, then thrusts it forward.
function bishop({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 2, B = bob;
  boots(S, cx, [swB, sw], lift, 'leather', 2.4);
  robe(S, { cx, top: 36 + B, ra: 6.2, rb: 9.6, mat: 'violetDeep', n: 8, amp: 0.65, hem: 'gold', sway: -sw * 0.3 });
  S.add(ellipsoid([cx, 37 + B, 0], [6.4, 8, 4.8], 'violet'), 1.5);
  // Chasuble over the robe, edged in gold, with a white pallium.
  S.add(folds(skirt(cx + 0.5, 30 + B, 56 + B, 6.4, 8.4, 0, 0.95, 'violet'), { cx, n: 6, amp: 0.4, y0: 32, y1: 56 }), 1);
  S.paint({ f: (x, y) => Math.abs(y - (55 + B)) - 0.8, mat: 'gold' });
  const sx = cx + 3.2;
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - sx) - 1.5, 29 + B - y, y - 60 - B, -z + 1), mat: 'cloth' });
  for (const yy of [40, 50]) S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - sx) - 1.1, Math.abs(y - yy - B) - 0.45), Math.max(Math.abs(x - sx) - 0.45, Math.abs(y - yy - B) - 1.4)) + (z < 1 ? 9 : 0), mat: 'crimson' });
  // Mantle at the shoulders.
  S.add(ellipsoid([cx, 29.5 + B, 0], [7.4, 3.4, 5], 'violet'), 1.8);
  S.paint({ f: (x, y) => Math.abs(y - (32.4 + B)) - 0.6, mat: 'gold' });
  // Arms and the crook.
  let hand, top;
  if (pose === 'windup') { hand = [cx + 8, 20 + B, 5.5]; top = [hand[0] + 1, 3 + B]; }
  else if (pose === 'strike') { hand = [cx + 13, 33 + B, 5.5]; top = [hand[0] + 16, hand[1] - 9]; }
  else { hand = [cx + 9, 40 + B, 5.5]; top = [hand[0] + 1.5, 14 + B]; }
  const el = pose === 'windup' ? [cx + 10, 28 + B, 5] : [cx + 9, 34 + B, 5];
  arm(S, [cx + 5.5, 30 + B, 3.6], el, hand, [2.5, 2.2, 2.2], 'violet', 1.3, 'bone', 1.8);
  arm(S, [cx - 5.5, 30 + B, -3.6], [cx - 7.5, 38 + B, -3], [cx - 5, 43 + B, 2], [2.4, 2.1, 2], 'violetDark', 1.2, 'bone', 1.6);
  const dx = top[0] - hand[0], dy = top[1] - hand[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const bot = [hand[0] - ux * 22, hand[1] - uy * 22, 6.5];
  S.add(capsule(bot, [top[0], top[1], 6.5], 0.9, 0.9, 'gold'), 0);
  const orb = [top[0] + ux * 3, top[1] + uy * 3, 6.5];
  const pr = [-uy, ux], R = 3.6, cc = [top[0] + pr[0] * R, top[1] + pr[1] * R];
  let prev = [top[0], top[1], 6.5];
  for (let k = 1; k <= 12; k++) { const th = k / 12 * Math.PI * 1.55; const p = [cc[0] - pr[0] * R * Math.cos(th) + ux * R * Math.sin(th), cc[1] - pr[1] * R * Math.cos(th) + uy * R * Math.sin(th), 6.5]; S.add(capsule(prev, p, 0.95 - k * 0.03, 0.95 - k * 0.03, 'gold'), 0.3); prev = p; }
  const orbR = pose === 'walk' ? 2.1 : 2.7;
  orb[0] = cc[0]; orb[1] = cc[1];
  S.add(sphere([cc[0], cc[1], 6.5], orbR, 'eyeViolet'), 0);
  // The hollow cowl and towering mitre.
  const hx = cx + 1.6, hy = 22 + B;
  S.add(capsule([cx, 29 + B, 0], [hx, hy + 2, 0], 3.2, 3.2, 'violetDark'), 1.4);
  const fc = hood(S, [hx, hy, 0.5], 5.2, 'violetDark', { rim: 'gold', fx: 0.42, fz: 0.82, cut: 0.7 });
  const mit = clip(ellipsoid([hx - 0.8, hy - 8.4, 0.5], [4.4, 8.6, 3.2], 'cloth'), (x, y) => y - (hy - 3.2));
  S.add(mit, 0.5);
  S.paint({ f: (x, y) => Math.abs(y - (hy - 4)) - 1, mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - hx) - 0.9, y - (hy - 3.5), -z + 2), mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (hy - 10.5)) - 0.8, Math.abs(x - hx) - 2.4, -z + 2), mat: 'gold' });
  // Lappets hang behind.
  S.add(box([hx - 4.6, hy + 4, -2.5], [0.9, 4.5, 0.4], 0.3, 'cloth'), 1);
  const f = frame(S);
  eye(f, fc[0] - 1.2, fc[1] - 0.5, 'violet0', 'violet2'); eye(f, fc[0] + 1, fc[1] - 0.5, 'violet0', 'violet2');
  if (pose !== 'walk') sparks(f, [[orb[0] - 5, orb[1] - 2], [orb[0] + 5, orb[1] + 1], [orb[0], orb[1] - 6], [orb[0] + 3, orb[1] + 5], [orb[0] - 3, orb[1] + 5]], ['violet0', 'violet1', 'holy1']);
  else sparks(f, [[orb[0] + (odd(t) * 6 - 3), orb[1] - 3 - Math.floor(t)]], ['violet1']);
  return f;
}

// =========================================================== chain jailer ===
// A brute in slate plate and a bucket helm, chains wound about him and a
// hooked chain in hand. Attack: whirls it overhead, then casts it straight.
function jailer({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 2, B = bob, hipY = 50 + B;
  for (const [side, s, up] of [[-1, swB, lift[0]], [1, sw, lift[1]]]) leg(S, { x: cx + side * 0.5, hipY, z: side * 3.2, sw: s, up, mats: ['shroudDark', 'slateArmor', 'slateArmor'], r: [3.8, 3.3, 3], foot: [4.4, 2.4, 3] });
  // A barrel chest and gut, belted, with a shroud tabard.
  S.add(ellipsoid([cx + 1, 38 + B, 0], [9.6, 10, 7], 'slateArmor'), 0);
  S.add(ellipsoid([cx + 1.5, 46 + B, 0.5], [8.4, 5.4, 6.4], 'shroud'), 1.6);
  S.add(folds(skirt(cx + 1, 46 + B, 60 + B * 0.5, 7, 8.4, 0, 0.95, 'shroud'), { cx, n: 6, amp: 0.6, y0: 47, y1: 60 }), 1);
  S.paint({ f: (x, y) => Math.abs(y - (47 + B)) - 1.1, mat: 'leather' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (47 + B)) - 1.5, Math.abs(x - (cx + 4)) - 1.6, -z + 3), mat: 'iron' });
  // Plate ridges and rivets.
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (36 + B) + (x - cx) * 0.2) - 0.45, -z + 3), mat: 'slateDark' });
  // Huge pauldrons.
  for (const [side, z] of [[-1, -4.4], [1, 4.2]]) S.add(bumpy(ellipsoid([cx + side * 8 + 1, 30 + B, z], [5.4, 4.4, 4.6], side < 0 ? 'slateDark' : 'slateArmor'), 0.25, 0.8, side + 2), 1.8);
  // Arms.
  let hand;
  if (pose === 'windup') hand = [cx + 6, 15 + B, 5.5];
  else if (pose === 'strike') hand = [cx + 18, 35 + B, 5.5];
  else hand = [cx + 11, 45 + B, 5.5];
  const el = pose === 'windup' ? [cx + 12, 24 + B, 5] : pose === 'strike' ? [cx + 14, 32 + B, 5] : [cx + 11, 38 + B, 5];
  arm(S, [cx + 8, 32 + B, 4.4], el, hand, [3.6, 3.2, 3], 'slateArmor', 1.5, 'iron', 3);
  arm(S, [cx - 7, 32 + B, -4.4], [cx - 10, 40 + B, -4], [cx - 8, 47 + B, -1], [3.4, 3, 2.8], 'slateDark', 1.3, 'iron', 2.7);
  // Bucket helm with an eye slit and a crest ridge.
  const hx = cx + 2.4, hy = 22.5 + B;
  S.add(capsule([hx - 0.4, hy + 4, 0.5], [hx, hy - 3.6, 0.5], 5.9, 5.6, 'helm'), 1.2);
  S.add(ellipsoid([hx, hy - 4.4, 0.5], [5.6, 2.6, 5.6], 'helm'), 1);
  S.add(capsule([hx - 5, hy - 6.6, 0.5], [hx + 5, hy - 6.6, 0.5], 0.8, 0.8, 'plateDark'), 0.6);
  S.sub(box([hx + 2, hy - 0.4, 6], [3.4, 0.65, 2], 0.2, 'void'), 0.3);
  S.sub(box([hx + 2.6, hy + 2.6, 6], [0.55, 1.8, 2], 0.2, 'void'), 0.2);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (hy + 4.2)) - 0.7, -z + 1), mat: 'slateDark' });
  const f = frame(S);
  eye(f, hx + 0.6, hy - 0.4, 'ember0'); eye(f, hx + 3.4, hy - 0.4, 'ember1');
  for (const [x, y] of [[hx - 1.4, hy + 2.4], [hx + 4.6, hy + 2.6], [hx - 2.4, hy - 2.6]]) px(f, x, y, 'iron0');
  // Chains: one slung over the chest, one in hand.
  chain(f, curve([cx - 7, 30 + B], [cx + 2, 43 + B], [cx + 10, 33 + B], 12));
  let pts;
  if (pose === 'windup') { pts = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 1.7 + 0.2; pts.push([hand[0] - 3 + Math.cos(a) * 11, hand[1] - 5 + Math.sin(a) * 4]); } pts.unshift([hand[0], hand[1] - 1]); }
  else if (pose === 'strike') pts = curve([hand[0] + 1, hand[1]], [hand[0] + 14, hand[1] + 2], [W - 4, hand[1] + 1], 14);
  else pts = curve([hand[0] + 1, hand[1] + 1], [hand[0] + 6, GY - 4], [hand[0] - 2 + odd(t), GY - 1], 10);
  chain(f, pts);
  const end = pts[pts.length - 1];
  // The hook, three pixels of curved iron.
  for (const [dx, dy] of [[0, 0], [1, 0], [2, -1], [2, -2], [1, -3]]) dot(f, Math.round(end[0]) + dx, Math.round(end[1]) + dy, dx === 2 ? 'iron3' : 'iron1');
  return f;
}

// ============================================================ bell ringer ===
// A hunched, hooded ringer with spines down his back, hauling a great bronze
// bell. Attack: heaves the bell overhead, then brings it down to toll.
function bellringer({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 4, B = bob;
  boots(S, cx, [swB, sw], lift, 'leather', 3);
  robe(S, { cx, top: 44 + B, ra: 7.6, rb: 9.6, mat: 'shroud', n: 8, amp: 0.7, sway: -sw * 0.3 });
  // The hunched back, a heavy hump with bone spines.
  S.add(ellipsoid([cx - 2, 38 + B, 0], [9, 10, 7], 'shroud'), 2);
  S.add(ellipsoid([cx - 4, 30 + B, -1], [8, 7, 6.4], 'shroud'), 2);
  for (const [x, y, ex, ey, z] of [[-9, 25, -13, 19, -1], [-5, 22, -7, 14, -1.5], [-11, 31, -16, 27, -1], [-1, 23, 0, 16, -2]]) S.add(capsule([cx + x, y + B, z], [cx + ex, ey + B, z - 0.5], 1.6, 0.35, 'bone'), 0.8);
  // Rope belt.
  S.paint({ f: (x, y) => Math.abs(y - (45 + B) + (x - cx) * 0.15) - 0.8, mat: 'sand' });
  // Arms and the bell.
  let bell, hands;
  if (pose === 'windup') { bell = [cx + 6, 6 + B]; hands = [[cx + 9, 10 + B, 5], [cx + 2, 9 + B, -3]]; }
  else if (pose === 'strike') { bell = [cx + 15, GY - 15]; hands = [[cx + 17, GY - 18, 5], [cx + 12, GY - 18, -3]]; }
  else { bell = [cx + 11, 42 + B + odd(t) * 0.6]; hands = [[cx + 13, 38 + B, 5], [cx + 8, 38 + B, -3]]; }
  arm(S, [cx + 3, 31 + B, 4], [cx + 8, (31 + hands[0][1]) / 2 + 2 + B, 5], hands[0], [3, 2.6, 2.3], 'shroud', 1.5, 'skin', 2.1);
  arm(S, [cx - 3, 31 + B, -3.4], [cx + 1, (31 + hands[1][1]) / 2 + 2 + B, -3], hands[1], [2.8, 2.4, 2.1], 'shroudDark', 1.3, 'skin', 1.9);
  const Bc = [bell[0], bell[1], 4];
  S.add(skirt(Bc[0], Bc[1], Bc[1] + 13, 3.6, 7.4, Bc[2], 1, 'bronze'), 0.8);
  S.add(sphere([Bc[0], Bc[1] + 0.4, Bc[2]], 3.8, 'bronze'), 1.5);
  S.add(torus([Bc[0], Bc[1] + 12.6, Bc[2]], 7, 0.9, 0.35, 'bronze'), 0.6);
  S.sub(skirt(Bc[0], Bc[1] + 6, Bc[1] + 14, 2.6, 6.4, Bc[2] + 0.5, 1, 'bronzeIn'), 0.5);
  S.add(torus([Bc[0], Bc[1] - 3.4, Bc[2]], 1.7, 0.6, 1.5708, 'iron'), 0);
  S.paint({ f: (x, y) => Math.abs(y - (Bc[1] + 8)) - 0.5, mat: 'gold' });
  // The hood.
  const hx = cx + 3, hy = 30 + B;
  const fc = hood(S, [hx, hy, 1], 5.8, 'shroudDark', { point: [hx - 8, hy - 4, -2], fx: 0.5, fz: 0.8, cut: 0.66 });
  const f = frame(S);
  eye(f, fc[0] - 1, fc[1] - 0.3, 'ember0', 'ember2'); eye(f, fc[0] + 1.2, fc[1] - 0.2, 'ember1');
  // The clapper.
  const cy = Math.round(Bc[1] + 12);
  dot(f, Bc[0], cy, 'iron3'); dot(f, Bc[0], cy + 1, 'iron4');
  if (pose === 'strike') { // the toll: a flattened ring at the bell's lip
    for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; for (const [rr, c] of [[17, 'gold0'], [16, 'gold1'], [18, 'gold2']]) { const x = Math.round(Bc[0] + Math.cos(a) * rr), y = Math.round(GY - 2 + Math.sin(a) * rr * 0.3); if (under(f, x, y) < 0) dot(f, x, y, c); } }
    sparks(f, [[Bc[0] - 10, Bc[1] - 2], [Bc[0] + 11, Bc[1] - 1], [Bc[0] - 8, Bc[1] - 6], [Bc[0] + 9, Bc[1] - 7]], ['gold0', 'gold1']);
  }
  return f;
}

// ======================================================== scourge matron ===
// A tall widow in black-violet with a bone mask and veil, chains at her waist,
// a long scourge. Attack: draws the whip back high, then lashes forward.
function matron({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 4, B = bob;
  boots(S, cx, [swB, sw], lift, 'leather', 2.2);
  robe(S, { cx, top: 40 + B, ra: 5.4, rb: 9.6, mat: 'widow', n: 9, amp: 0.6, sway: -sw * 0.3, hem: 'crimsonDeep' });
  // Corseted bodice and narrow waist.
  S.add(ellipsoid([cx + 0.5, 34 + B, 0], [5.4, 7.6, 4], 'widow'), 0);
  S.add(ellipsoid([cx + 0.5, 41 + B, 0], [4.4, 3, 3.4], 'widowLit'), 1.4);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (cx + 2)) - 2 + (y - 34 - B) * 0.12, 30 + B - y, y - 42 - B, -z + 2), mat: 'crimsonDeep' });
  for (const yy of [33, 35.5, 38]) S.paint({ f: (x, y, z) => Math.max(Math.abs(y - yy - B) - 0.35, Math.abs(x - (cx + 2)) - 1.6, -z + 2.5), mat: 'bone' });
  // Shoulders and a high collar.
  S.add(ellipsoid([cx, 27.5 + B, 0], [6.6, 3, 4.2], 'widow'), 1.6);
  S.add(skirt(cx + 0.5, 21 + B, 27 + B, 4.6, 3.6, 0, 1, 'widowLit'), 0.8);
  // Arms.
  let hand;
  if (pose === 'windup') hand = [cx - 4, 16 + B, 4];
  else if (pose === 'strike') hand = [cx + 15, 31 + B, 5];
  else hand = [cx + 8, 42 + B, 5];
  const el = pose === 'windup' ? [cx + 3, 21 + B, 4] : pose === 'strike' ? [cx + 10, 30 + B, 5] : [cx + 7.4, 35 + B, 4.6];
  arm(S, [cx + 4.6, 28.5 + B, 3.4], el, hand, [2.2, 1.9, 1.7], 'widow', 1.2, 'mask', 1.5);
  arm(S, [cx - 4.6, 28.5 + B, -3.4], [cx - 6.5, 36 + B, -3], [cx - 4.5, 41 + B, 0], [2.1, 1.8, 1.6], 'widow', 1.2, 'mask', 1.4);
  // A bone mask under a veil and tall cornette.
  const hx = cx + 1.2, hy = 17 + B;
  S.add(ellipsoid([hx - 0.6, hy, 0], [5, 5.4, 4.6], 'widow'), 1.2);
  S.add(ellipsoid([hx + 2.2, hy + 0.8, 2.8], [3.4, 4.6, 2.8], 'mask'), 0.4);
  S.add(capsule([hx - 2, hy - 3, -0.5], [hx - 7, hy + 14, -3.5], 4, 3, 'widow'), 2);
  S.add(clip(ellipsoid([hx - 1.4, hy - 6, 0], [5.4, 5.4, 3.6], 'widow'), (x, y) => y - (hy - 3)), 1);
  for (const [ex, ey] of [[hx + 1.2, hy - 0.4], [hx + 3.6, hy - 0.4]]) S.sub(ellipsoid([ex, ey, 5], [0.9, 0.6, 1.6], 'void'), 0.2);
  const f = frame(S);
  eye(f, hx + 1.2, hy - 0.4, 'blood0'); eye(f, hx + 3.6, hy - 0.4, 'blood1');
  pline(f, Math.floor(hx + 1.5), Math.floor(hy + 3), Math.floor(hx + 4.2), Math.floor(hy + 3), 'bone4');
  for (let x = Math.floor(hx + 1.5); x <= hx + 4; x += 1.5) px(f, x, hy + 3.6, 'bone4');
  // Chains at the waist.
  chain(f, curve([cx - 4, 42 + B], [cx + 1, 47 + B], [cx + 5, 42 + B], 8), 'iron2', 'iron5');
  chain(f, curve([cx - 2, 43 + B], [cx - 2, 50 + B], [cx + 1, 54 + B], 6), 'iron2', 'iron5');
  // The scourge.
  let w;
  if (pose === 'windup') w = curve([hand[0], hand[1]], [hand[0] - 14, hand[1] - 14], [hand[0] - 20, hand[1] + 6], 14);
  else if (pose === 'strike') w = curve([hand[0] + 1, hand[1]], [hand[0] + 16, hand[1] - 8], [W - 3, hand[1] + 6], 16);
  else w = curve([hand[0] + 1, hand[1] + 1], [hand[0] + 9, GY - 6 + odd(t) * 2], [hand[0] + 3 - odd(t) * 3, GY - 1], 12);
  cord(f, w, ['wood1', 'wood2', 'wood3', 'blood2']);
  if (pose === 'strike') { const e = w[w.length - 1]; sparks(f, [[e[0] - 1, e[1] - 2], [e[0] + 1, e[1] - 3], [e[0] - 2, e[1] + 1], [e[0], e[1] + 2]], ['blood0', 'cloth0']); }
  return f;
}

// ====================================================== carrion choirboy ===
// A crimson cassock and lace surplice, a cracked rotten halo, a screaming bone
// mask and long clawed hands. Attack: rears back, then screams.
function choirboy({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 2, B = bob, X = pose === 'strike' ? 3 : pose === 'windup' ? -2 : 1.5;
  boots(S, cx, [swB, sw], lift, 'leather', 2.4);
  robe(S, { cx, top: 42 + B, ra: 6, rb: 9, mat: 'crimson', n: 8, amp: 0.55, sway: -sw * 0.3 });
  // Surplice: white, lace-edged, falling to the knees.
  S.add(folds(skirt(cx + X * 0.3 + 0.5, 32 + B, 58 + B * 0.5, 5.6, 9, 0, 1, 'cloth'), { cx, n: 9, amp: 0.55, y0: 34, y1: 58 }), 1.4);
  S.paint({ f: (x, y) => { const sc = Math.abs(((x * 0.9) % 2.4) - 1.2); return Math.abs(y - (57.2 + B * 0.5 + sc * 0.6)) - 0.7; }, mat: 'bone' });
  S.add(ellipsoid([cx + X * 0.6, 32 + B, 0], [5.6, 6, 4.2], 'cloth'), 1.5);
  S.add(ellipsoid([cx + X * 0.8, 27 + B, 0], [5.6, 2.6, 4], 'crimson'), 1.4);
  // Long arms with bone claws.
  let hand, hand2;
  if (pose === 'windup') { hand = [cx + 4, 21 + B, 6]; hand2 = [cx - 9, 22 + B, -2]; }
  else if (pose === 'strike') { hand = [cx + 16, 38 + B, 6]; hand2 = [cx + 13, 44 + B, -2]; }
  else { hand = [cx + 9, 45 + B + odd(t), 5]; hand2 = [cx - 6, 46 + B, 1]; }
  arm(S, [cx + 4.4 + X, 28 + B, 3.4], [(cx + 4 + X + hand[0]) / 2 + 1.5, (28 + B + hand[1]) / 2 + 1, 5], hand, [2.4, 2.1, 1.9], 'crimson', 1.2, 'bone', 1.7);
  arm(S, [cx - 4.4 + X, 28 + B, -3.4], [(cx - 4 + hand2[0]) / 2 - 1.5, (28 + B + hand2[1]) / 2 + 1, -2.4], hand2, [2.2, 1.9, 1.7], 'crimsonDark', 1.2, 'bone', 1.6);
  for (const H of [hand, hand2]) S.paint({ f: (x, y, z) => Math.hypot(x - H[0] + 1.8, y - H[1] + 1, z - H[2]) - 2.3, mat: 'cloth' });
  for (const H of [hand, hand2]) for (let k = 0; k < 3; k++) S.add(capsule(H, [H[0] + 3.2 - k * 0.4, H[1] + 2.2 + k * 1.4, H[2]], 0.6, 0.25, 'boneDark'), 0.5);
  // The mask.
  const hx = cx + 2 + X * 1.6, hy = 20 + B + (pose === 'windup' ? -1 : 0);
  S.add(capsule([cx + X, 27 + B, 0], [hx - 0.6, hy + 3, 0], 2.6, 2.6, 'skin'), 1);
  S.add(ellipsoid([hx, hy, 0.6], [5.6, 6, 5.2], 'mask'), 0.8);
  S.add(ellipsoid([hx - 2.2, hy - 1, -0.8], [4.8, 5.6, 4.8], 'crimsonDark'), 1);
  const open = pose === 'strike' ? 2.6 : pose === 'windup' ? 1.2 : 1.6;
  S.sub(ellipsoid([hx + 2, hy + 3, 5.4], [1.6, open + 0.4, 2.2], 'void'), 0.4);
  for (const ex of [hx + 0.4, hx + 3.2]) S.sub(ellipsoid([ex, hy - 1, 5.4], [1.1, 1.5, 1.8], 'void'), 0.3);
  // The rotten halo.
  S.add(torus([hx - 1.2, hy - 9 + (pose === 'windup' ? -1 : 0), 0], 4.6, 0.8, 0.38, 'bronze'), 0);
  S.sub(sphere([hx + 2, hy - 8.6, 3], 1.1), 0);
  const f = frame(S);
  eye(f, hx + 0.4, hy - 1.2, 'ember0', 'ember2'); eye(f, hx + 3.2, hy - 1.2, 'ember1');
  // A crack down the mask.
  pline(f, Math.floor(hx + 2.6), Math.floor(hy - 4.2), Math.floor(hx + 2), Math.floor(hy - 2.6), 'bone4');
  if (pose === 'strike') for (const [r, c] of [[8, 'rot0'], [14, 'rot1'], [20, 'rot2']]) for (let a = -0.45; a <= 0.45; a += 0.6 / r) { const x = Math.round(hx + 3 + Math.cos(a) * r), y = Math.round(hy + 2.8 + Math.sin(a) * r); if (under(f, x, y) < 0) dot(f, x, y, c); }
  return f;
}

// =========================================================== gravedigger ===
// A hunched brute of rotting flesh with ram's horns, rope-belted breeches and
// a spade. Attack: raises the spade overhead, then slams it into the earth.
function gravedigger({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 3, B = bob, hipY = 51 + B;
  for (const [side, s, up] of [[-1, swB, lift[0]], [1, sw, lift[1]]]) leg(S, { x: cx + side * 0.6, hipY, z: side * 3.6, sw: s, up, mats: ['shroud', 'shroudDark', 'leather'], r: [4.6, 3.9, 3.1], foot: [4.4, 2.4, 3] });
  // Breeches and belly.
  S.add(ellipsoid([cx + 1, 49 + B, 0], [8.2, 5, 6.4], 'shroud'), 1.6);
  S.add(bumpy(ellipsoid([cx + 2, 41 + B, 1], [9, 8, 7], 'rotFlesh'), 0.5, 0.45, 2), 1.4);
  // Hunched, massive shoulders.
  S.add(bumpy(ellipsoid([cx - 1, 32 + B, 0], [10.5, 7.4, 7.4], 'rotFlesh'), 0.55, 0.42, 5), 2);
  S.paint({ f: (x, y) => Math.abs(y - (47.4 + B)) - 1, mat: 'sand' });
  // Wounds and stitched gashes.
  const gash = (x, y, z, r) => Math.max(Math.hypot((x - (cx + 5)) / 1.9, (y - (42 + B) + (x - cx - 5) * 0.5) / 0.8) - r, -z + 3);
  S.paint({ f: (x, y, z) => gash(x, y, z, 1.8), mat: 'rotDark' });
  S.paint({ f: (x, y, z) => gash(x, y, z, 1.1), mat: 'bloodWet' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (cx - 3) - (y - 33) * 0.6) - 0.5, Math.abs(y - (35 + B)) - 3, -z + 4), mat: 'rotDark' });
  // Arms.
  let h1, h2, shaftA, shaftB;
  if (pose === 'windup') { h1 = [cx + 5, 14 + B, 5]; h2 = [cx + 1, 18 + B, -3]; shaftA = [cx - 6, 24 + B]; shaftB = [cx + 10, 4 + B]; }
  else if (pose === 'strike') { h1 = [cx + 15, 42 + B, 5]; h2 = [cx + 9, 38 + B, -3]; shaftA = [cx + 4, 32 + B]; shaftB = [cx + 22, GY - 6]; }
  else { h1 = [cx + 9, 32 + B, 5]; h2 = [cx - 4, 41 + B, -3]; shaftA = [cx + 15, 44 + B]; shaftB = [cx - 13, 19 + B]; }
  arm(S, [cx + 6.5, 30 + B, 4.4], [cx + 11, (30 + h1[1]) / 2 + 3 + B, 5], h1, [3.8, 3.3, 3], 'rotFlesh', 1.6, 'rotDark', 3);
  arm(S, [cx - 7, 30 + B, -4.4], [cx - 9, (30 + h2[1]) / 2 + 3 + B, -3], h2, [3.6, 3, 2.8], 'rotDark', 1.4, 'rotDark', 2.8);
  S.add(capsule([shaftA[0], shaftA[1], 6], [shaftB[0], shaftB[1], 6], 1, 1, 'wood'), 0);
  // Spade blade at shaftB end.
  const dx = shaftB[0] - shaftA[0], dy = shaftB[1] - shaftA[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  S.add(blade([shaftB[0] - ux * 1, shaftB[1] - uy * 1, 6.2], [shaftB[0] + ux * 9, shaftB[1] + uy * 9, 6.2], 7, 1, 'iron', 0.55), 0.4);
  S.add(capsule([shaftA[0] - ux * 1.5 - uy * 2, shaftA[1] - uy * 1.5 + ux * 2, 6], [shaftA[0] - ux * 1.5 + uy * 2, shaftA[1] - uy * 1.5 - ux * 2, 6], 0.8, 0.8, 'wood'), 0.5);
  // The head, low between the shoulders, with curling horns.
  const hx = cx + 9, hy = 28.5 + B;
  S.add(bumpy(ellipsoid([hx, hy, 2], [5, 5, 4.6], 'rotFlesh'), 0.3, 0.7, 9), 1.6);
  S.add(ellipsoid([hx + 3.4, hy + 2.6, 3], [3, 2.3, 3], 'rotFlesh'), 1);
  for (const [ox, oy, z, s] of [[-1.2, -1, -1.6, 'boneDark'], [0, 0, 4, 'bone']]) {
    const P = [[hx - 0.5 + ox, hy - 4.2 + oy], [hx - 4.4 + ox, hy - 6 + oy], [hx - 7 + ox, hy - 2.4 + oy], [hx - 5.6 + ox, hy + 1.4 + oy], [hx - 3 + ox, hy + 1.6 + oy]];
    const R = [2.3, 2, 1.6, 1.1, 0.5];
    for (let i = 0; i < 4; i++) S.add(capsule([P[i][0], P[i][1], z + i * 0.3], [P[i + 1][0], P[i + 1][1], z + (i + 1) * 0.3], R[i], R[i + 1], s), i ? 0.3 : 0.6);
  }
  const f = frame(S);
  eye(f, hx + 1.8, hy - 0.4, 'flame0', 'flame2'); eye(f, hx + 3.8, hy - 0.4, 'flame1');
  for (let x = Math.floor(hx + 2); x <= hx + 5; x++) px(f, x, hy + 3.4, x % 2 ? 'bone1' : 'ink1');
  if (pose === 'strike') sparks(f, [[shaftB[0] + 6, GY - 5], [shaftB[0] + 9, GY - 8], [shaftB[0] + 2, GY - 9], [shaftB[0] + 11, GY - 3], [shaftB[0] - 2, GY - 4], [shaftB[0] + 5, GY - 11]], ['shroud1', 'shroud2', 'stone2']);
  return f;
}

// ========================================================== lantern shade ===
// A drifting hooded wraith with tattered tails and a burning lantern. It
// floats (the engine lifts it). Attack: raises the lantern, then aims a beam.
function lantern({ bob = 0, t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 3, B = bob - 5;
  // Body tapering to tattered tails.
  const body = folds(skirt(cx, 28 + B, GY - 2, 6, 9.4, 0, 0.9, 'slate'), { cx, n: 7, amp: 0.8, y0: 30, y1: GY - 2, phase: t * 0.6 });
  S.add(clip(body, (x, y, z) => y - (GY - 12 + B * 0.4 + 7 * Math.abs(Math.sin((x - cx) * 0.55 + t * 0.7)))), 0);
  S.add(ellipsoid([cx, 31 + B, 0], [6.4, 6, 4.6], 'slate'), 1.6);
  S.add(ellipsoid([cx, 25.5 + B, 0], [6.6, 2.8, 4.4], 'slateDark'), 1.6);
  // Long thin arms.
  let hand;
  if (pose === 'windup') hand = [cx + 7, 10 + B, 5];
  else if (pose === 'strike') hand = [cx + 17, 26 + B, 5];
  else hand = [cx + 11, 34 + B + odd(t) * 0.6, 5];
  const el = pose === 'windup' ? [cx + 10, 20 + B, 4.6] : pose === 'strike' ? [cx + 11, 25 + B, 4.6] : [cx + 9, 31 + B, 4.6];
  arm(S, [cx + 4.6, 27 + B, 3.4], el, hand, [2, 1.7, 1.4], 'slate', 1.2, 'sootCloth', 1.4);
  arm(S, [cx - 4.6, 27 + B, -3.4], [cx - 8, 33 + B, -3], [cx - 7, 39 + B, -1], [1.9, 1.6, 1.3], 'slateDark', 1.2, 'sootCloth', 1.3);
  // The lantern, hanging from its ring.
  const Lc = [hand[0] + 0.5, hand[1] + 8, 6];
  S.add(box(Lc, [2.6, 3.4, 2.6], 0.4, 'lanternGlass'), 0);
  for (const [dx, dz] of [[-2.6, 2.6], [2.6, 2.6], [-2.6, -2.6], [2.6, -2.6]]) S.add(box([Lc[0] + dx, Lc[1], Lc[2] + dz], [0.45, 3.6, 0.45], 0.1, 'helm'), 0);
  S.add(box([Lc[0], Lc[1] - 3.9, Lc[2]], [3.2, 0.7, 3.2], 0.3, 'helm'), 0);
  S.add(ellipsoid([Lc[0], Lc[1] - 5.2, Lc[2]], [2, 1.2, 2], 'helm'), 0.5);
  S.add(box([Lc[0], Lc[1] + 3.9, Lc[2]], [3, 0.6, 3], 0.3, 'helm'), 0);
  // The hood.
  const hx = cx + 1.5, hy = 19 + B;
  const fc = hood(S, [hx, hy, 0.5], 5.4, 'slateDark', { point: [hx - 7, hy - 7, -2], fx: 0.55, cut: 0.66 });
  const f = frame(S);
  eye(f, fc[0] - 1.2, fc[1] - 0.5, 'ember0', 'ember2'); eye(f, fc[0] + 1, fc[1] - 0.5, 'ember0', 'ember2');
  pline(f, Math.floor(hand[0] + 0.5), Math.floor(hand[1] + 1), Math.floor(Lc[0]), Math.floor(Lc[1] - 6), 'iron3');
  // Light: the core and a few motes.
  for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [0, 1], [1, -1]]) px(f, Lc[0] + dx, Lc[1] + dy, dx || dy > 0 ? 'ember1' : 'ember0');
  if (pose === 'windup') sparks(f, [[Lc[0] - 5, Lc[1] - 2], [Lc[0] + 5, Lc[1] - 3], [Lc[0] - 4, Lc[1] + 4], [Lc[0] + 5, Lc[1] + 4], [Lc[0], Lc[1] - 9]], ['ember0', 'ember1']);
  if (pose === 'strike') { for (let x = Math.round(Lc[0] + 4); x < W - 1; x++) { dot(f, x, Math.round(Lc[1]), 'ember0'); if (under(f, x, Math.round(Lc[1]) - 1) < 0) dot(f, x, Math.round(Lc[1]) - 1, x % 3 ? 'ember1' : 'ember2'); if (under(f, x, Math.round(Lc[1]) + 1) < 0) dot(f, x, Math.round(Lc[1]) + 1, 'ember2'); } }
  return f;
}

const std = (fn) => ({ walk: walkSet((g) => fn({ bob: g.bob, sw: g.sw, swB: g.swB, lift: g.lift, t: g.t })), attack: () => [fn({ pose: 'windup' }), fn({ pose: 'windup', bob: -1 }), fn({ pose: 'strike', bob: 1 })] });
const SETS = { collector, motherwax, bishop, jailer, bellringer, matron, choirboy, gravedigger };
const extra = {};
const react = (id, make) => { const r = reactions(make, 0.3); extra[`${id}_hit`] = r.hit; extra[`${id}_die`] = r.die; };
for (const [id, fn] of Object.entries(SETS)) { const s = std(fn); extra[`${id}_walk`] = s.walk; extra[`${id}_attack`] = s.attack; react(id, () => fn({})); }
extra.lantern_walk = () => HALF.map((t) => lantern({ t, bob: Math.round(cyc([0, -1, -2, -1], t) / 2) * 2 }));
react('lantern', () => lantern({}));
react('knight', () => knight({}));
extra.lantern_attack = () => [lantern({ pose: 'windup' }), lantern({ pose: 'windup', bob: -1 }), lantern({ pose: 'strike', bob: 0 })];

export default {
  mon_rare: {
    knight_walk: walkSet((g) => knight({ bob: g.bob, sw: g.sw, swB: g.swB, lift: g.lift })),
    knight_attack: () => [knight({ pose: 'windup' }), knight({ pose: 'windup', bob: -1 }), knight({ pose: 'strike', bob: 1, sw: 3 })],
    ...extra,
  },
};
