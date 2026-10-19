// Sculpted elites (and the Collection Imp) for the mon_elite and loot sheets.
// Every model faces right; ax/ay mark where the feet meet the ground.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, folds, bumpy, clip, render, dot, pline, under } from '../sdf.mjs';
import { MATS, torus, stride, odd, cyc, HALF, reactions, bobAt } from './base.mjs';
import { NAMES } from '../palette.mjs';
// Hand-placed pixel only where the sculpt shows a dark cavity (mouths).
const inMaw = (fr, x, y) => { const v = under(fr, x, y); return v >= 0 && /^(ink|blood)/.test(NAMES[v]); };

const PI = Math.PI;
const MM = {
  ...MATS,
  skinDark: { ramp: 'skin', bias: -0.16, min: 1, spec: 0.06 },
  wound: { ramp: 'blood', spec: 0.5, min: 1, bias: -0.05 },
  sack: { ramp: 'shroud', bias: 0.1, spec: 0.03 },
  ash: { ramp: 'slate', bias: -0.12, min: 1, spec: 0.15 },
  ashLight: { ramp: 'stone', bias: -0.18, min: 2, spec: 0.05 },
  black: { ramp: 'slate', bias: -0.22, min: 2, spec: 0.9 },
  blackCloth: { ramp: 'slate', bias: -0.3, min: 3, spec: 0.05 },
  habit: { ramp: 'moss', bias: -0.3, min: 3, spec: 0.04 },
  habitDark: { ramp: 'moss', bias: -0.4, min: 4 },
  steel: { ramp: 'iron', spec: 0.9, bias: -0.04 },
  goldDark: { ramp: 'gold', bias: -0.22, spec: 0.6, min: 2 },
  plateGold: { ramp: 'gold', bias: -0.1, spec: 0.75, min: 1 },
  mossDark: { ramp: 'moss', bias: -0.15, min: 1 },
  thorn: { ramp: 'wood', bias: -0.05, spec: 0.2 },
  mask: { ramp: 'cloth', bias: 0.05, max: 6, spec: 0.3 },
  maskGold: { ramp: 'gold', spec: 0.7, bias: 0.05 },
  statue: { ramp: 'stone', spec: 0.08, bias: 0.04 },
  statueDark: { ramp: 'stone', spec: 0.05, bias: -0.12, min: 1 },
  flesh: { ramp: 'skin', spec: 0.2, bias: -0.2, min: 1 },
  fleshMound: { ramp: 'skin', spec: 0.3, bias: -0.3, min: 2 },
  fleshDark: { ramp: 'skin', spec: 0.1, bias: -0.32, min: 2 },
  hoodRed: { ramp: 'blood', bias: -0.32, min: 4, spec: 0.04 },
  ironDark: { ramp: 'iron', spec: 0.6, bias: -0.25, min: 2 },
  gum: { ramp: 'blood', spec: 0.35, bias: -0.1, min: 1 },
  maw: { ramp: 'ink', bias: -0.4, min: 3 },
  worm: { ramp: 'rot', spec: 0.35, bias: -0.1, min: 1 },
  wormBelly: { ramp: 'bone', spec: 0.2, bias: -0.08, min: 1 },
  dirt: { ramp: 'shroud', spec: 0, bias: -0.04 },
  boneDark: { ramp: 'bone', bias: -0.14, spec: 0.15, min: 1 },
  wax: { ramp: 'bone', spec: 0.35, bias: 0.02 }, waxDark: { ramp: 'bone', spec: 0.25, bias: -0.16, min: 2 },
  impSkin: { ramp: 'crimson', spec: 0.25 },
  coin: { ramp: 'gold', spec: 0.8, bias: 0.12 },
};
const fin = (f, ax, ay) => Object.assign(f, { ax, ay });
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Paint a band across a limb: the slab between two planes perpendicular to a->b at fraction t.
function cuff(S, a, b, t, half, r, mat) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(...d), n = d.map((v) => v / L), c = lerp3(a, b, t);
  S.paint({ mat, f: (x, y, z) => Math.max(Math.abs((x - c[0]) * n[0] + (y - c[1]) * n[1] + (z - c[2]) * n[2]) - half, Math.hypot(x - c[0], y - c[1], z - c[2]) - r) });
}
// Two-segment limb with a joint bulge, blended into what it hangs from.
function limb(S, a, j, b, r0, r1, r2, mat, k = 1, mat2 = mat) {
  S.add(capsule(a, j, r0, r1, mat), k);
  S.add(capsule(j, b, r1, r2, mat2), k * 0.7);
}
// Walking legs: side -1 is the far leg, +1 the near one.
const step = stride;
function legs(S, { x, hipY, footY, z = 3, thigh = 3, shin = 2.6, mt = 'shroud', ms = mt, mf = 'leather', foot = [3.5, 2, 2.5], t = 0, stride = 4, lift = 2, k = 1, knee = 1.2, xs = 0.4, spread = 0 }) {
  const out = [];
  for (const side of [-1, 1]) {
    const g = step(t / 4 + (side > 0 ? 0 : 0.5), stride, lift), sw = g.x, up = g.up;
    const hip = [x + side * xs, hipY, side * z];
    const ankle = [x + side * spread + sw, footY - foot[1] - up, side * z];
    const kn = [(hip[0] + ankle[0]) / 2 + knee, (hip[1] + ankle[1]) / 2 - up * 0.3, side * z + 0.3];
    S.add(capsule(hip, kn, thigh, thigh * 0.82, mt), k);
    S.add(capsule(kn, ankle, thigh * 0.8, shin, ms), k * 0.8);
    S.add(ellipsoid([ankle[0] + foot[0] * 0.4, ankle[1] + foot[1] * 0.55, side * z], foot, mf), k * 0.7);
    out.push({ hip, knee: kn, ankle });
  }
  return out;
}
// A chain of links laid along a path of points.
function chain(S, pts, r = 1.1, mat = 'steel', alt = 'ironDark') {
  for (let i = 0; i < pts.length - 1; i++) S.add(capsule(pts[i], pts[i + 1], i % 2 ? r * 0.75 : r, i % 2 ? r * 0.75 : r, i % 2 ? alt : mat), 0);
}
// Render a scene modelled in its own units, scaled by s, with model point
// (gx, gy) landing on frame pixel (ax, ay). Returns the frame and a mapper.
function shoot(S, { w, h, s = 1, gx, gy, ax, ay, ...opts }) {
  const dx = ax - gx * s, dy = ay - gy * s, T = new Scene();
  for (const p of S.prims) {
    const f = p.f, b = p.bb;
    T.prims.push({ ...p, k: p.k * s, bb: [b[0] * s + dx, b[1] * s + dy, b[2] * s, b[3] * s + dx, b[4] * s + dy, b[5] * s], f: (x, y, z) => s * f((x - dx) / s, (y - dy) / s, z / s) });
  }
  for (const p of S.paints) { const f = p.f; T.paints.push({ mat: p.mat, f: (x, y, z) => f((x - dx) / s, (y - dy) / s, z / s) }); }
  const fr = render(T, w, h, MM, { ground: ay, ...opts });
  fr.ax = ax; fr.ay = ay;
  const P = (x, y) => [x * s + dx, y * s + dy];
  return { f: fr, P, dot: (x, y, c) => dot(fr, ...P(x, y), c), line: (x0, y0, x1, y1, c) => pline(fr, ...P(x0, y0), ...P(x1, y1), c) };
}
const eyes = (f, list, ramp, big = false) => { for (const [x, y] of list) { dot(f, x, y, `${ramp}0`); if (big) { dot(f, x + 1, y, `${ramp}1`); dot(f, x, y + 1, `${ramp}2`); } } };

// ================================================ Penitent Colossus ===
// A mountain of scourged flesh under a sackcloth hood, chained and spiked,
// fists like millstones. 104x112, feet at 106.
function colossus(t = 0, atk = 0) {
  const S = new Scene(), B = atk ? 0 : bobAt(t) / 1.24, cx = 50;
  const lean = atk === 1 ? -4 : atk === 2 ? 5 : 0;
  legs(S, { x: cx - 2, hipY: 81 + B, footY: 106, z: 8, thigh: 7, shin: 5.6, mt: 'flesh', ms: 'fleshDark', mf: 'sack', foot: [6, 3, 5], t: atk ? 0.5 : t, stride: atk ? 2 : 5, lift: 2.5, k: 3, knee: 2 });
  // Belly and the great hunched back.
  const bel = [cx + 3 + lean * 0.4, 66 + B, 1];
  S.add(bumpy(ellipsoid(bel, [20, 18, 15], 'flesh'), 0.18, 0.25, 3), 0);
  S.add(bumpy(ellipsoid([cx - 3 + lean * 0.7, 47 + B, -1], [19, 13, 13], 'flesh'), 0.2, 0.3, 9), 7);
  // Pectoral and belly-fold creases.
  S.sub(capsule([cx - 6 + lean * 0.5, 58 + B, 16], [cx + 18 + lean * 0.5, 61 + B, 14], 0.9, 0.9), 1.2);
  S.sub(capsule([cx - 4 + lean * 0.4, 76 + B, 14], [cx + 16 + lean * 0.4, 75 + B, 12], 0.8, 0.8), 1.2);
  S.add(ellipsoid([cx - 9 + lean * 0.6, 42 + B, -3], [11, 9, 10], 'flesh'), 5);
  // Bone spikes driven through the back.
  for (const [sx, sy, dx, dy, r] of [[-14, 36, -8, -9, 1.9], [-18, 44, -10, -5, 1.7], [-6, 33, -3, -11, 2], [-19, 54, -9, 0, 1.5]]) {
    const a = [cx + sx + lean * 0.6, sy + B, -4];
    S.add(capsule(a, [a[0] + dx, a[1] + dy, -5], r, 0.3, 'bone'), 1);
  }
  // Loincloth of sackcloth.
  S.add(folds(skirt(cx + 3, 77 + B, 88, 19.5, 18.5, 1, 0.85, 'sack'), { cx: cx + 2, cz: 1, n: 6, amp: 0.5, y0: 77, y1: 88 }), 1.5);
  S.add(folds(skirt(cx + 7, 80 + B, 96, 6.5, 5.5, 10, 0.5, 'sack'), { cx: cx + 7, cz: 10, n: 3, amp: 0.4, y0: 82, y1: 96 }), 1);
  S.paint({ mat: 'leather', f: (x, y) => Math.abs(y - (78.5 + B)) - 1.3 });
  // Arms.
  const sh = atk === 1 ? -14 : 0;
  const bArm = atk === 1 ? [[cx - 12, 44, -10], [cx - 12, 28, -8], [cx + 2, 18, -2]] : atk === 2 ? [[cx - 10, 46, -10], [cx + 4, 60, -8], [cx + 20, 92, -4]] : [[cx - 13, 47 + B, -10], [cx - 19, 64 + B, -11], [cx - 15 + (odd(t) * 2 - 1), 81 + B, -10]];
  limb(S, bArm[0], bArm[1], bArm[2], 6.5, 5.5, 5, 'fleshDark', 3);
  S.add(bumpy(sphere(bArm[2], 6.6, 'fleshDark'), 0.4, 0.5, 4), 2);
  const fArm = atk === 1 ? [[cx + 8, 44, 9], [cx + 13, 28, 10], [cx + 7, 17, 6]] : atk === 2 ? [[cx + 10, 47, 9], [cx + 24, 64, 11], [cx + 30, 94, 8]] : [[cx + 9 + lean, 47 + B, 10], [cx + 19, 62 + B, 13], [cx + 20 + (1 - odd(t) * 2), 79 + B, 13]];
  limb(S, fArm[0], fArm[1], fArm[2], 7.2, 6, 5.6, 'flesh', 3);
  S.add(bumpy(sphere(fArm[2], 7.4, 'flesh'), 0.45, 0.5, 8), 2.2);
  // Shackles on the wrists.
  cuff(S, fArm[1], fArm[2], 0.62, 1.6, 7.6, 'steel');
  cuff(S, bArm[1], bArm[2], 0.62, 1.6, 7, 'steel');
  // The sack-hooded head, sunk low between the shoulders.
  const hx = cx + 15 + lean * 1.3 + (atk === 1 ? -2 : 0), hy = 35 + B + (atk === 2 ? 6 : 0) + (atk === 1 ? 3 : 0);
  S.add(bumpy(ellipsoid([hx, hy, 4], [9.6, 10, 9.5], 'sack'), 0.4, 0.55, 2), 3.5);
  S.add(capsule([hx - 3, hy - 7, 1], [hx - 9, hy - 15, -1], 3.6, 1, 'sack'), 2.2);
  S.paint({ mat: 'leather', f: (x, y, z) => Math.max(Math.abs(Math.hypot(x - (hx - 4.4), z - 0) - 3.2) - 1.4, Math.abs(y - (hy - 8.6)) - 0.9) });
  // Chain wound across the chest, lying on the skin.
  const pts = [];
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, x = cx - 10 + u * 30 + lean * 0.5, y = 46 + u * 28 + B;
    const qx = (x - bel[0]) / 20, qy = (y - bel[1]) / 18;
    const zb = bel[2] + 15 * Math.sqrt(Math.max(0, 1 - qx * qx - qy * qy));
    pts.push([x, y, Math.max(zb, 9) + 0.6]);
  }
  chain(S, pts, 1.5, 'iron');
  // Lash wounds and old blood.
  for (const [wx, wy, wz, r] of [[cx + 12, 58, 12, 2.4], [cx - 2, 70, 15, 2], [cx + 16, 72, 10, 1.7], [cx - 8, 54, 10, 1.8]]) S.paint(sphere([wx + lean * 0.4, wy + B, wz], r, 'wound'));
  for (const [x0, y0] of [[cx - 16, 40], [cx - 18, 47], [cx - 15, 55]]) S.paint({ mat: 'wound', f: (x, y, z) => Math.max(Math.abs((y - y0 - B) - (x - x0) * 0.5) - 0.6, Math.abs(x - x0 - 3) - 4, -z) });
  const o = shoot(S, { w: 112, h: 128, s: 1.24, gx: cx, gy: 106, ax: 54, ay: 123 });
  // Ember eyes cut in the sackcloth, and a stitched mouth.
  for (const ex of [hx + 4, hx + 8.5]) { o.dot(ex, hy - 1.2, 'ember0'); o.dot(ex + 0.8, hy - 1.2, 'ember1'); o.dot(ex, hy - 0.4, 'ember3'); }
  o.line(hx + 2, hy + 4.6, hx + 9, hy + 5, 'shroud6');
  for (let k = 0; k < 4; k++) o.dot(hx + 2.6 + k * 1.9, hy + 4, 'bone3');
  return o.f;
}

// ================================================== armoured knights ===
// Shared by the Censer Titan and the Inquisitor. Model units; ground y 100.
function knight(S, o) {
  const { t = 0, atk = 0, cx = 40, plate = 'gold', plateDark = 'goldDark', trim = 'goldDark', tabard = 'crimson', bulk = 1, B = 0, lean = 0 } = o;
  const k = bulk;
  legs(S, { x: cx - 1, hipY: 70 + B, footY: 100, z: 4.6 * k, thigh: 4.4 * k, shin: 3.6 * k, mt: plateDark, ms: plate, mf: 'steel', foot: [5 * k, 2.4, 3.4 * k], t: atk ? 0.4 : t, stride: atk ? 3 : 4.5, lift: 2, k: 1.4, knee: 1.6 });
  // Knee cops.
  // Fauld (plate skirt) and the tabard over it.
  S.add(folds(skirt(cx + lean * 0.3, 63 + B, 75 + B, 8.6 * k, 10 * k, 0, 0.85, plate), { cx, n: 6, amp: 0.45, y0: 64, y1: 75 }), 1.5);
  const tz = 4.6 * k + 3.6 * k - 0.4;
  S.add(folds(skirt(cx + 1.6 + lean * 0.4, 61 + B, 87 + B * 0.5, 4.2 * k, 5.2 * k, tz, 0.5, tabard), { cx: cx + 1.6, cz: tz, n: 5, amp: 0.4, y0: 66, y1: 87, phase: 0.4 }), 0.6);
  // Breastplate, ridge, and the belt.
  const ch = [cx + lean, 50 + B, 0.5];
  S.add(ellipsoid(ch, [9.4 * k, 11, 7 * k], plate), 0);
  S.add(ellipsoid([cx + lean * 0.7, 61 + B, 0], [7.6 * k, 4.6, 5.8 * k], plateDark), 2.4);
  S.paint({ mat: trim, f: (x, y, z) => Math.max(Math.abs(x - (ch[0] + 2.2)) - 0.6, -z + 3, Math.abs(y - (ch[1] + 1)) - 9) });
  S.paint({ mat: trim, f: (x, y, z) => Math.max(Math.abs(y - (ch[1] + 6.5)) - 0.55, -z + 2) });
  S.paint({ mat: 'leather', f: (x, y) => Math.abs(y - (63.2 + B)) - 1.1 });
  S.paint({ mat: 'gold', f: (x, y, z) => Math.max(Math.abs(y - (63.2 + B)) - 1.4, Math.abs(x - (cx + 2.4 + lean * 0.5)) - 1.6, -z + 3) });
  // Neck ring (gorget).
  S.add(ellipsoid([cx + 1 + lean, 39.5 + B, 0.5], [5.4 * k, 2.4, 4.6 * k], plateDark), 1.2);
  return { ch };
}
// Layered pauldron: a dome over a second plate, with a trimmed rim.
function pauldron(S, c, r, plate, trim) {
  S.add(ellipsoid([c[0] - 0.6, c[1] + r * 0.45, c[2]], [r * 0.95, r * 0.6, r * 0.9], plate), 1);
  S.add(ellipsoid(c, [r, r * 0.8, r * 0.95], plate), 1);
  S.paint({ mat: trim, f: (x, y, z) => Math.max(Math.abs(Math.hypot((x - c[0]) / r, (z - c[2]) / (r * 0.95)) - 0.92) * r - 0.7, y - c[1] - r * 0.5, c[1] - y - 0.6) });
}

// ===================================================== Censer Titan ===
// A gilded war-saint the size of a door, plumed, candles burning on its
// shoulders, swinging a censer of coals. 112x128.
function titan(t = 0, atk = 0) {
  const S = new Scene(), B = atk ? 0 : bobAt(t) / 1.33, cx = 40, k = 1.25;
  const lean = atk === 1 ? -2 : atk === 2 ? 3 : 0;
  knight(S, { t, atk, cx, bulk: k, B, lean, plate: 'plateGold' });
  // Pauldrons with candles.
  const lp = [cx - 9 + lean, 41 + B, -5], rp = [cx + 10 + lean, 42 + B, 5.5];
  pauldron(S, lp, 6.4, 'goldDark', 'gold');
  // Back arm hanging, gauntlet.
  limb(S, [lp[0], lp[1] + 3, lp[2]], [cx - 13 + lean, 56 + B, -6], [cx - 11 + lean, 66 + B, -5], 3.8, 3.4, 3.2, 'goldDark', 1.4);
  S.add(sphere([cx - 11 + lean, 67.5 + B, -5], 3.4, 'steel'), 1);
  // Front arm: the censer arm.
  const hand = atk === 1 ? [cx - 4, 30, 6] : atk === 2 ? [cx + 22, 52, 8] : [cx + 14 + lean, 63 + B, 8];
  const elbow = atk === 1 ? [cx + 6, 34, 8] : atk === 2 ? [cx + 18, 48, 9] : [cx + 15 + lean, 53 + B, 8];
  limb(S, [rp[0], rp[1] + 2, rp[2]], elbow, hand, 4, 3.6, 3.3, 'plateGold', 1.4);
  S.add(sphere(hand, 3.6, 'steel'), 1);
  pauldron(S, rp, 7, 'plateGold', 'goldDark');
  // Candles on the shoulders.
  const candles = [[lp[0] - 1, lp[1] - 5, lp[2]], [rp[0] - 1.5, rp[1] - 5.5, rp[2] - 1], [rp[0] + 2.5, rp[1] - 4.6, rp[2] + 1]];
  for (const [x, y, z] of candles) S.add(capsule([x, y + 3, z], [x, y - 2.4, z], 1.3, 1.3, 'bone'), 0.4);
  // Censer on a short chain.
  const cz = hand[2] + 1, swing = atk === 2 ? [12, 2] : atk === 1 ? [-6, -6] : [2 * (odd(t) * 2 - 1), 13];
  const cs = [hand[0] + swing[0], hand[1] + swing[1], cz];
  const cpts = []; for (let i = 0; i <= 6; i++) cpts.push(lerp3([hand[0], hand[1] + 2, cz], [cs[0], cs[1] - 4, cz], i / 6));
  chain(S, cpts, 0.8, 'steel');
  S.add(sphere(cs, 4.4, 'gold'), 0);
  S.add(capsule([cs[0], cs[1] - 5, cz], [cs[0], cs[1] - 3.6, cz], 1.6, 2.6, 'goldDark'), 0.6);
  S.paint({ mat: 'goldDark', f: (x, y) => Math.abs(y - cs[1] - 0.4) - 1.1 });
  // Great helm with a plume.
  const hx = cx + 2.2 + lean * 1.2, hy = 32 + B;
  S.add(capsule([hx, hy + 2.5, 0.6], [hx, hy - 2.6, 0.6], 6, 5.8, 'plateGold'), 1.2);
  S.add(sphere([hx - 0.3, hy - 3, 0.4], 5.7, 'plateGold'), 1.6);
  S.sub(box([hx + 4, hy - 0.4, 4.6], [3.4, 0.7, 2.6], 0.2, 'void'), 0.3);
  S.sub(box([hx + 4.4, hy + 3.2, 4.8], [0.5, 2.2, 2.2], 0.1, 'void'), 0.3);
  S.paint({ mat: 'goldDark', f: (x, y, z) => Math.max(Math.abs(x - (hx + 1.6)) - 0.6, y - (hy - 1.4), -z + 2.5) });
  S.paint({ mat: 'goldDark', f: (x, y) => Math.abs(y - (hy + 6.6)) - 0.8 });
  const sw = atk ? -1 : Math.sin(t * PI / 2) * 0.8;
  for (let i = 0; i < 6; i++) { const u = i / 5; S.add(sphere([hx - 1 - u * 10 + sw * u, hy - 8.6 - Math.sin(u * 2.4) * 4 + u * u * 6, -0.4], 3 - u * 1.2, 'crimson'), 1.4); }
  const o = shoot(S, { w: 112, h: 128, s: 1.33, gx: cx, gy: 100, ax: 54, ay: 123 });
  // Ember eyes in the visor; flames on the candles; coals in the censer.
  o.dot(hx + 3.2, hy - 0.4, 'ember0'); o.dot(hx + 5.8, hy - 0.4, 'ember0'); o.dot(hx + 4.4, hy - 0.4, 'ember2');
  for (const [x, y] of candles) { o.dot(x, y - 3.4, 'flame1'); o.dot(x, y - 4.4, 'flame0'); o.dot(x, y - 5.2, 'flame2'); }
  for (const dx of [-2.6, 0, 2.6]) { o.dot(cs[0] + dx, cs[1] + 0.4, dx > 0 ? 'ember1' : 'ember0'); }
  return o.f;
}

// ======================================================= Inquisitor ===
// Black plate, a crimson capirote over the helm, a long execution blade.
function inquisitor(t = 0, atk = 0) {
  const S = new Scene(), B = atk ? 0 : bobAt(t) / 1.3, cx = 40;
  const lean = atk === 1 ? -3 : atk === 2 ? 5 : 1;
  // Cape behind.
  const cape = folds(skirt(cx - 2 + lean * 0.4, 40 + B, 90, 6, 12, -2.5, 0.42, 'crimsonDark'), { cx: cx - 2, cz: -2.5, n: 9, amp: 0.6, y0: 44, y1: 90 });
  S.add(rotZ(clip(cape, (x, y, z) => z + 1.4), [cx - 2, 40 + B], atk === 2 ? -0.35 : -0.08 - odd(t) * 0.04), 0);
  knight(S, { t, atk, cx, plate: 'black', plateDark: 'black', trim: 'steel', tabard: 'crimson', bulk: 0.95, B, lean });
  const lp = [cx - 7.5 + lean, 41 + B, -4.5], rp = [cx + 8 + lean, 42 + B, 4.6];
  pauldron(S, lp, 5, 'black', 'steel');
  limb(S, [lp[0], lp[1] + 3, lp[2]], [cx - 10 + lean, 54 + B, -5], [cx - 7 + lean, 63 + B, -4], 3, 2.7, 2.6, 'black', 1.3);
  // Sword arm and the blade.
  const hand = atk === 1 ? [cx - 6, 60, 6] : atk === 2 ? [cx + 22, 50, 8] : [cx + 12 + lean, 62 + B, 7];
  const elbow = atk === 1 ? [cx + 2, 56, 7] : atk === 2 ? [cx + 16, 47, 7] : [cx + 13 + lean, 53 + B, 7];
  limb(S, [rp[0], rp[1] + 2, rp[2]], elbow, hand, 3.2, 2.9, 2.8, 'black', 1.3);
  S.add(sphere(hand, 2.9, 'leather'), 0.8);
  pauldron(S, rp, 5.6, 'black', 'steel');
  const dir = atk === 1 ? [-0.9, 0.42] : atk === 2 ? [1, -0.06] : [0.55, -0.83], bl = 30;
  const n = Math.hypot(...dir), d = [dir[0] / n, dir[1] / n];
  const hz = hand[2] + 1;
  const gp = [hand[0] + d[0] * 2, hand[1] + d[1] * 2, hz], tip = [hand[0] + d[0] * bl, hand[1] + d[1] * bl, hz];
  S.add(capsule([hand[0] - d[0] * 4, hand[1] - d[1] * 4, hz], gp, 0.9, 0.9, 'leather'), 0);
  S.add(sphere([hand[0] - d[0] * 4.6, hand[1] - d[1] * 4.6, hz], 1.4, 'gold'), 0);
  S.add(capsule([gp[0] - d[1] * 4, gp[1] + d[0] * 4, hz], [gp[0] + d[1] * 4, gp[1] - d[0] * 4, hz], 1, 1, 'gold'), 0);
  S.add(capsule(gp, tip, 1.6, 0.4, 'steel'), 0);
  // Chains at the waist.
  const wpts = []; for (let i = 0; i <= 10; i++) { const a = -0.3 + i * 0.22; wpts.push([cx + Math.sin(a) * 9.6, 65 + B + Math.sin(i * 0.7) * 1.4 + i * 0.5, Math.cos(a) * 7.2]); }
  chain(S, wpts, 0.85, 'steel');
  // Helm under a tall crimson hood.
  const hx = cx + 2 + lean * 1.2, hy = 32 + B;
  S.add(sphere([hx, hy, 0.6], 5.2, 'black'), 1.4);
  S.add(capsule([hx - 0.4, hy - 2, 0.2], [hx - 1.6, hy - 9, -0.3], 5, 3, 'hoodRed'), 1);
  S.add(capsule([hx - 1.6, hy - 9, -0.3], [hx - 4.4, hy - 15.5, -0.6], 3, 0.5, 'hoodRed'), 1.2);
  S.add(folds(skirt(hx - 0.2, hy - 1, hy + 8, 5.4, 8.4, 0.2, 1, 'hoodRed'), { cx: hx, cz: 0.2, n: 7, amp: 0.45, y0: hy, y1: hy + 8 }), 1.5);
  S.sub(ellipsoid([hx + 4.6, hy - 0.6, 3.2], [2.6, 1.3, 2.4], 'maw'), 0.5);
  const o = shoot(S, { w: 112, h: 120, s: 1.3, gx: cx, gy: 100, ax: 50, ay: 115 });
  for (const ex of [hx + 3.4, hx + 5.9]) { o.dot(ex, hy - 0.8, 'ember1'); o.dot(ex + 0.8, hy - 0.8, 'blood0'); }
  // A gleam on the blade.
  o.dot(gp[0] + d[0] * 12, gp[1] + d[1] * 12 - 0.6, 'white');
  return o.f;
}

// ============================================================ wings ===
// One sculpted wing in side view: a thick leading edge running from the
// root to the tip, primaries hanging below it with a scalloped trailing
// edge, cupped in depth. a is the wing's angle in the picture (radians).
function wing(S, root, { a = -2.4, L = 30, Wl = 3.4, Wt = 12, n = 6, thick = 1.6, z = 0, cup = 3, mat = 'ash', mat2 = mat }) {
  const c = Math.cos(a), sn = Math.sin(a);
  const local = (x, y) => { const dx = x - root[0], dy = y - root[1]; return [dx * c + dy * sn, -dx * sn + dy * c]; };
  const shape = (x, y, z0) => {
    const [u, v] = local(x, y), q = Math.max(0, Math.min(1, u / L));
    const top = Wl * Math.pow(Math.sin(PI * Math.min(1, q * 1.1 + 0.08)), 0.6) + 1;
    const fe = L / n, ph = ((u % fe) + fe) % fe / fe;
    const bot = -(Wt * (1 - 0.62 * q) + 1) + 2.2 * (1 - Math.sin(PI * ph)) * (q > 0.05 ? 1 : 0);
    const d2 = Math.max(v - top, bot - v, -u - 2, u - L - 1);
    const zc = z + cup * q * q - 0.6 * (v / Wt);
    return [Math.max(d2 * 0.7, Math.abs(z0 - zc) - thick * (1 - 0.45 * q)), u, v, bot, ph, q];
  };
  const R = L + Wt + 2;
  S.add({ mat, bb: [root[0] - R, root[1] - R, z - thick - 2, root[0] + R, root[1] + R, z + thick + cup + 2], f: (x, y, zz) => shape(x, y, zz)[0] }, 1.6);
  // Primary separations and a lighter row of coverts along the leading edge.
  S.paint({ mat: mat2, f: (x, y, zz) => { const [, u, v, bot, ph, q] = shape(x, y, zz); return (ph < 0.16 || ph > 0.94) && v < bot * 0.25 && q > 0.06 ? -1 : 1; } });
}
// A floating robe: torso, a skirt tapering to a point or a hem.
function robeBody(S, { cx, top, waist, hem, rTop, rHem, mat, tip = false, B = 0, n = 8, amp = 0.6, lean = 0, zs = 0.85 }) {
  S.add(ellipsoid([cx + lean, top + (waist - top) * 0.5 + B, 0], [rTop, (waist - top) * 0.6, rTop * 0.8], mat), 0);
  const sk = folds(skirt(cx + lean * 0.5, waist + B, hem, rTop * 0.95, rHem, 0, zs, mat), { cx, n, amp, y0: waist, y1: hem });
  S.add(sk, 2);
  if (tip) S.add(capsule([cx + lean * 0.3, hem - 2, 0], [cx - 2, hem + 9, -1], rHem * 0.9, 0.5, mat), 3);
}

// ===================================================== Seraph of Ash ===
// A gilt-masked angel in pale robes on black, smouldering wings.
function seraph(t = 0, atk = 0) {
  const S = new Scene(), cx = 44, B = Math.round(Math.sin(t * PI / 2)) * 2 / 1.24;
  const flap = atk === 1 ? 1.6 : atk === 2 ? -0.6 : cyc([0, 0.8, 1.4, 0.6], t);
  const lean = atk === 2 ? 3 : 0;
  wing(S, [cx - 3, 44 + B, -4], { z: -5, a: -2.15 - flap * 0.25, L: 30, Wt: 12, mat: 'ash', mat2: 'blackCloth', cup: -2 });
  robeBody(S, { cx, top: 40, waist: 56, hem: 84, rTop: 6.4, rHem: 8, mat: 'cloth', tip: true, B, lean, n: 9 });
  S.paint({ mat: 'gold', f: (x, y) => Math.max(Math.abs(y - (57 + B)) - 0.9, Math.abs(x - cx) - 10) });
  S.paint({ mat: 'gold', f: (x, y, z) => Math.max(Math.abs(x - (cx + 1.4 + lean * 0.5)) - 1.3, y - 92, 57 + B - y, -z + 2) });
  // Shoulders, arms, sword.
  S.add(ellipsoid([cx + lean, 41.5 + B, 0], [7.6, 3, 5], 'cloth'), 1.6);
  limb(S, [cx - 5 + lean, 42 + B, -3.4], [cx - 6.5 + lean, 49 + B, -3.8], [cx - 4 + lean, 55 + B, -3], 2.4, 2.1, 1.9, 'cloth', 1);
  const hand = atk === 1 ? [cx + 2, 34, 6] : atk === 2 ? [cx + 18, 50, 7] : [cx + 10 + lean, 54 + B, 6];
  const elbow = atk === 1 ? [cx + 7, 40, 6] : atk === 2 ? [cx + 13, 46, 6] : [cx + 8 + lean, 48 + B, 5.5];
  limb(S, [cx + 5 + lean, 42 + B, 3.4], elbow, hand, 2.5, 2.2, 2, 'cloth', 1);
  S.add(sphere(hand, 1.9, 'maskGold'), 0.6);
  const dir = atk === 1 ? [0.3, -1] : atk === 2 ? [1, 0.25] : [0.45, -0.9], dl = Math.hypot(...dir), d = [dir[0] / dl, dir[1] / dl];
  const hz = hand[2] + 1, gp = [hand[0] + d[0] * 2, hand[1] + d[1] * 2, hz];
  S.add(capsule([gp[0] - d[1] * 3.6, gp[1] + d[0] * 3.6, hz], [gp[0] + d[1] * 3.6, gp[1] - d[0] * 3.6, hz], 0.9, 0.9, 'gold'), 0);
  S.add(capsule(gp, [hand[0] + d[0] * 26, hand[1] + d[1] * 26, hz], 1.5, 0.4, 'holy'), 0);
  // Head: hood of the robe, gold mask.
  const hx = cx + 1.6 + lean * 1.2, hy = 33 + B;
  S.add(sphere([hx - 0.6, hy - 0.4, -0.4], 5.3, 'cloth'), 1.6);
  S.add(ellipsoid([hx + 1.8, hy + 0.6, 2.4], [3.6, 4.6, 3.6], 'maskGold'), 0.4);
  S.paint({ mat: 'goldDark', f: (x, y, z) => Math.max(Math.abs(y - (hy + 4.4)) - 0.6, Math.abs(x - hx - 2) - 3.5) });
  // Near wing over the body.
  wing(S, [cx - 4, 44 + B, 2], { z: 2, a: -2.45 - flap * 0.25, L: 32, Wt: 13, mat: 'ash', mat2: 'blackCloth', cup: 2.5 });
  S.add(torus([hx - 0.8, hy - 8.6, -0.4], 5, 0.75, 0.38, 'halo'), 0);
  const o = shoot(S, { w: 104, h: 116, s: 1.24, gx: cx, gy: 100, ax: 54, ay: 112 });
  for (const ex of [hx + 1.2, hx + 3.8]) { o.dot(ex, hy, 'holy0'); o.dot(ex, hy + 0.9, 'holy2'); }
  // Embers drifting off the wings.
  for (const [x, y] of [[cx - 22, 24 + flap * 4], [cx - 14, 14 + flap * 3], [cx - 26, 34]]) o.dot(x, y + B, 'ember1');
  return o.f;
}

// ==================================================== Weeping Effigy ===
// A cathedral angel come loose from its plinth, weeping light.
function effigy(t = 0, atk = 0) {
  const S = new Scene(), cx = 44, B = Math.round(Math.sin(t * PI / 2)) * 2 / 1.26;
  const flap = atk === 1 ? 0.8 : atk === 2 ? -0.4 : cyc([0, 0.3, 0.5, 0.2], t);
  wing(S, [cx - 3, 44 + B, -4], { z: -5, a: -1.95 - flap * 0.2, L: 30, Wt: 11, mat: 'statueDark', cup: -2 });
  robeBody(S, { cx, top: 40, waist: 56, hem: 86, rTop: 6.8, rHem: 9.4, mat: 'statue', B, n: 7, amp: 0.8 });
  // Broken hem: jagged stone where the plinth snapped.
  for (const [dx, dz, r] of [[-6, 2, 2.4], [-1, 4, 2.8], [5, 2, 2.2], [2, -3, 2.5]]) S.sub(sphere([cx + dx, 87.5 + B, dz], r), 0.4);
  S.add(bumpy(ellipsoid([cx + 1, 95 + B * 0.5, 0], [5, 2.6, 4], 'statueDark'), 0.8, 0.5, 3), 0);
  // Arms raised, hands near the face as if weeping.
  S.add(ellipsoid([cx, 41.5 + B, 0], [7.8, 3.2, 5.2], 'statue'), 1.6);
  const raise = atk === 1 ? -5 : atk === 2 ? 3 : 0;
  limb(S, [cx - 5, 42 + B, -3.2], [cx - 4, 50 + B, -4], [cx + 1, 40 + B + raise, -1], 2.4, 2.2, 2, 'statue', 1);
  const fh = atk === 2 ? [cx + 16, 42 + B, 6] : [cx + 6, 37 + B + raise, 4.5];
  limb(S, [cx + 5, 42 + B, 3.4], [cx + 7, 50 + B, 5], fh, 2.6, 2.3, 2.1, 'statue', 1);
  const hx = cx + 1.4, hy = 32 + B;
  S.add(sphere([hx - 0.4, hy, 0], 5.2, 'statue'), 1.4);
  S.add(ellipsoid([hx + 1.6, hy + 0.8, 2.4], [3.4, 4.4, 3.2], 'statue'), 0.8);
  // Veil.
  S.add(folds(skirt(hx - 1, hy - 3, hy + 8, 5.4, 7.6, -0.6, 0.95, 'statueDark'), { cx: hx - 1, cz: -0.6, n: 7, amp: 0.4, y0: hy - 2, y1: hy + 8 }), 1);
  // Cracks and moss.
  S.sub(capsule([cx - 2, 60 + B, 9], [cx + 3, 70 + B, 9.4], 0.45, 0.35), 0.2);
  S.sub(capsule([cx + 3, 70 + B, 9.4], [cx + 1, 78 + B, 9.6], 0.4, 0.3), 0.2);
  S.paint(bumpy(sphere([cx - 5, 82 + B, 7], 2.6, 'mossDark'), 1.2, 0.8, 4));
  S.paint(bumpy(sphere([cx + 6, 86 + B, 6], 2, 'mossDark'), 1, 0.8, 7));
  wing(S, [cx - 4, 44 + B, 1.5], { z: 1.5, a: -2.2 - flap * 0.2, L: 32, Wt: 12, mat: 'statue', mat2: 'statueDark', cup: 2 });
  S.add(torus([hx - 0.6, hy - 8.6, -0.4], 5.2, 0.8, 0.38, 'gold'), 0);
  S.sub(sphere([hx + 4.4, hy - 8.4, 2], 1.2), 0);
  const o = shoot(S, { w: 104, h: 120, s: 1.26, gx: cx, gy: 102, ax: 54, ay: 116 });
  // Eyes and the tears of light.
  for (const ex of [hx + 1.2, hx + 3.6]) {
    o.dot(ex, hy + 0.2, 'holy0');
    for (let k = 1; k < 7; k++) o.dot(ex - (k > 4 ? 0.4 : 0), hy + 0.2 + k * 0.8, k < 3 ? 'holy1' : k < 5 ? 'holy2' : 'holy3');
  }
  return o.f;
}

// ================================================== Abbess of Thorns ===
// Moss-green habit, porcelain mask, a crown of thorns and a living staff.
function thornVine(S, pts, r = 0.9, seed = 1) {
  for (let i = 0; i < pts.length - 1; i++) {
    S.add(capsule(pts[i], pts[i + 1], r, r, 'thorn'), 0.3);
    if (i % 2 === 0) { const p = pts[i], dx = Math.sin(i * 2.3 + seed) * 2.6, dy = -1.8; S.add(capsule(p, [p[0] + dx, p[1] + dy, p[2] + 1.2], 0.6, 0.1, 'thorn'), 0.2); }
  }
}
function abbess(t = 0, atk = 0) {
  const S = new Scene(), cx = 42, B = bobAt(t) / 1.22;
  const lean = atk === 1 ? -2 : atk === 2 ? 3 : 0;
  robeBody(S, { cx, top: 42, waist: 56, hem: 100, rTop: 7, rHem: 15, mat: 'habit', B, n: 11, amp: 0.8, lean, zs: 0.8 });
  // Scapular (front panel) and cord.
  S.add(folds(skirt(cx + 1.5 + lean * 0.5, 46 + B, 97, 3.4, 4.6, 7.6, 0.5, 'habitDark'), { cx: cx + 1.5, cz: 7.6, n: 4, amp: 0.35, y0: 50, y1: 96 }), 0.8);
  S.paint({ mat: 'leather', f: (x, y) => Math.abs(y - (58.4 + B)) - 0.8 });
  // Thorn vines wrapping the habit.
  const vine = []; for (let i = 0; i <= 16; i++) { const a = i * 0.55 - 1, y = 62 + i * 2.2 + B; const r = 7.6 + (y - 58) * 0.12; vine.push([cx + Math.sin(a) * r, y, Math.cos(a) * r * 0.85 + 0.6]); }
  thornVine(S, vine.filter((p) => p[2] > -1), 0.85, 2);
  // Shoulders, arms (sleeves), staff.
  S.add(ellipsoid([cx + lean, 43 + B, 0], [8, 3.4, 5.4], 'habit'), 1.6);
  limb(S, [cx - 5 + lean, 44 + B, -3.4], [cx - 7 + lean, 52 + B, -4], [cx - 5 + lean, 59 + B, -3], 2.6, 2.6, 3.4, 'habit', 1);
  const hand = atk === 1 ? [cx + 8, 44, 6] : atk === 2 ? [cx + 17, 50, 7] : [cx + 11 + lean, 56 + B, 6.5];
  limb(S, [cx + 5 + lean, 44 + B, 3.6], [cx + 9 + lean, 51 + B, 5.4], hand, 2.6, 2.8, 3.4, 'habit', 1);
  S.add(sphere(hand, 1.7, 'mask'), 0.6);
  const top = atk === 1 ? [hand[0] - 2, hand[1] - 30, hand[2] + 1] : atk === 2 ? [hand[0] + 9, hand[1] - 22, hand[2] + 1] : [hand[0] + 1, hand[1] - 30, hand[2] + 1];
  const bot = [hand[0] + (hand[0] - top[0]) * 0.55, hand[1] + (hand[1] - top[1]) * 0.55, hand[2] + 1];
  S.add(capsule(bot, top, 0.9, 0.9, 'thorn'), 0);
  const orb = [top[0], top[1] - 2.4, top[2]];
  const prongs = []; for (let i = 0; i < 4; i++) { const a = i * PI / 2 + 0.5; S.add(capsule(top, [orb[0] + Math.cos(a) * 2.8, orb[1] - 3, orb[2] + Math.sin(a) * 2.8], 0.55, 0.2, 'thorn'), 0.3); }
  S.add(sphere(orb, 2.2, 'flame'), 0);
  // Head: wimple, veil, porcelain mask.
  const hx = cx + 1.8 + lean * 1.2, hy = 34 + B;
  S.add(folds(skirt(hx - 2, hy - 5, hy + 12, 6, 10, -1, 0.95, 'habitDark'), { cx: hx - 2, cz: -1, n: 8, amp: 0.45, y0: hy - 3, y1: hy + 12 }), 1.2);
  S.add(sphere([hx - 0.8, hy - 0.6, -0.2], 6.4, 'habitDark'), 1.2);
  S.add(ellipsoid([hx + 1.4, hy + 1.2, 2.6], [4.6, 6, 4], 'cloth'), 0.6);
  S.add(ellipsoid([hx + 1.6, hy + 7, 2.4], [5.4, 2.6, 4.2], 'cloth'), 1.2);
  S.add(ellipsoid([hx + 2.6, hy + 0.6, 4.4], [3, 3.8, 2.4], 'mask'), 0.4);
  // Crown of thorns over the veil.
  const crown = []; for (let i = 0; i <= 10; i++) { const a = i / 10 * PI * 2; crown.push([hx - 0.8 + Math.cos(a) * 6.4, hy - 4.6 + Math.sin(a) * 0.7, Math.sin(a) * 6.2]); }
  thornVine(S, crown, 0.7, 5);
  S.add(torus([hx - 1, hy - 10.6, -0.4], 5.4, 0.75, 0.38, 'halo'), 0);
  const o = shoot(S, { w: 104, h: 122, s: 1.22, gx: cx, gy: 100, ax: 50, ay: 118 });
  for (const ex of [hx + 1.8, hx + 4]) { o.dot(ex, hy - 0.2, 'flame0'); o.dot(ex, hy + 0.8, 'flame3'); }
  o.line(hx + 2, hy + 2.8, hx + 3.6, hy + 2.8, 'cloth4');
  o.dot(orb[0] - 0.6, orb[1] - 0.8, 'flame0');
  return o.f;
}

// =================================================== Reliquary Golem ===
// A walking reliquary: a coffin for a chest, studded with saints' skulls,
// arms of fused bone ending in grave-stone fists.
function golem(t = 0, atk = 0) {
  const S = new Scene(), B = atk ? 0 : bobAt(t) / 1.22, cx = 42;
  legs(S, { x: cx, hipY: 72 + B, footY: 100, z: 6.5, thigh: 5.4, shin: 5, mt: 'statueDark', ms: 'statue', mf: 'statueDark', foot: [5.6, 3, 4.4], t: atk ? 0.3 : t, stride: atk ? 1.5 : 2.6, lift: 3, k: 1.2, knee: 0.6, xs: 6, spread: 6.5 });
  // Coffin chest: a tapered hexagonal casket.
  const top = 36 + B, bot = 74 + B, mid = 46 + B;
  S.add({ mat: 'wood', bb: [cx - 14, top - 1, -9, cx + 14, bot + 1, 9], f: (x, y, z) => {
    const w = y < mid ? 9 + (y - top) / (mid - top) * 4 : 13 - (y - mid) / (bot - mid) * 4;
    const qx = Math.abs(x - cx) - w, qy = Math.max(top - y, y - bot), qz = Math.abs(z) - 6.6;
    return Math.min(Math.max(qx, qy, qz), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) - 1.4; } }, 0);
  // Iron corner straps and a gold cross on the lid.
  S.paint({ mat: 'ironDark', f: (x, y) => Math.min(Math.abs(y - (top + 3)), Math.abs(y - (bot - 3))) - 1 });
  S.paint({ mat: 'gold', f: (x, y, z) => Math.max(Math.min(Math.max(Math.abs(x - cx - 1) - 1.3, Math.abs(y - (mid + 6)) - 15), Math.max(Math.abs(x - cx - 1) - 7, Math.abs(y - (mid - 1)) - 1.3)), -z + 5) });
  // Reliquary skulls set into the wood.
  for (const [sx, sy, sz] of [[-8, 58, 6], [8, 64, 6], [-6, 42, 6.4]]) S.add(sphere([cx + sx, sy + B, sz], 2.8, 'bone'), 0.6);
  // Shoulders of piled bone.
  const lift = atk === 1 ? -22 : atk === 2 ? -4 : 0;
  for (const side of [-1, 1]) {
    const shz = side * 8, sh = [cx + side * 12, 40 + B, shz];
    S.add(bumpy(sphere(sh, 6, side < 0 ? 'boneDark' : 'bone'), 0.5, 0.5, side + 3), 2);
    const swing = atk ? 0 : Math.sin(t * PI / 2 + (side > 0 ? 0 : PI)) * 3;
    const fist = atk === 1 ? [cx + side * 6, 22, shz] : atk === 2 ? [cx + 20 + side * 2, 52, shz + 2] : [cx + side * 16 + swing, 70 + B, shz];
    const el = atk === 1 ? [cx + side * 14, 28, shz] : atk === 2 ? [cx + 16 + side * 3, 44, shz] : [cx + side * 17 + swing * 0.3, 55 + B, shz];
    limb(S, sh, el, fist, 4.4, 3.8, 4.2, side < 0 ? 'boneDark' : 'bone', 1.5);
    S.add(bumpy(box(fist, [4, 4.4, 4], 1.6, side < 0 ? 'statueDark' : 'statue'), 0.5, 0.6, side * 5), 1.6);
  }
  // The coffin it hurls, held overhead on the windup.
  if (atk === 1) {
    S.add(box([cx, 14, 0], [13, 4, 4.6], 1, 'wood'), 0);
    S.paint({ mat: 'gold', f: (x, y, z) => Math.max(Math.abs(x - cx) - 0.9, Math.abs(y - 14) - 5, -z + 4) });
  }
  // A skull for a head under an iron band.
  const hx = cx + 2, hy = 30 + B;
  S.add(sphere([hx, hy, 1], 5.2, 'bone'), 1.4);
  S.add(ellipsoid([hx + 2, hy + 4.6, 2], [3.4, 2, 3], 'bone'), 0.8);
  for (const ex of [hx + 1, hx + 4.4]) S.sub(sphere([ex, hy + 0.4, 5.4], 1.5, 'maw'), 0.4);
  S.paint({ mat: 'ironDark', f: (x, y) => Math.abs(y - (hy - 3)) - 1.2 });
  const o = shoot(S, { w: 100, h: 112, s: 1.22, gx: cx, gy: 100, ax: 50, ay: 108 });
  for (const ex of [hx + 1, hx + 4.4]) o.dot(ex, hy + 0.4, 'ember0');
  for (const [sx, sy] of [[-8, 58], [8, 64], [-6, 42]]) { o.dot(cx + sx - 0.8, sy + B, 'ink0'); o.dot(cx + sx + 0.9, sy + B, 'ink0'); }
  return o.f;
}

// ================================================= The Thrice-Buried ===
// A crowned skeleton in grave-rags, rot crawling from its ribs, a scythe.
function thrice(t = 0, atk = 0) {
  const S = new Scene(), B = atk ? 0 : bobAt(t) / 1.24, cx = 42;
  const lean = atk === 1 ? -3 : atk === 2 ? 4 : 1;
  // Grave-rag cape with a torn hem.
  const rag = folds(skirt(cx - 2 + lean * 0.4, 40 + B, 88, 5.4, 10, -2.4, 0.5, 'shroud'), { cx: cx - 2, cz: -2.4, n: 9, amp: 0.7, y0: 44, y1: 88 });
  S.add(clip(rag, (x, y, z) => z + 1.6), 0);
  for (let k = 0; k < 6; k++) S.sub(ellipsoid([cx - 10 + k * 3.6, 89 + (k % 2) * 3, -3], [1.4, 4 + (k % 3), 4]), 0.5);
  legs(S, { x: cx, hipY: 66 + B, footY: 100, z: 3.2, thigh: 1.8, shin: 1.5, mt: 'bone', ms: 'bone', mf: 'boneDark', foot: [3.4, 1.4, 1.8], t: atk ? 0.5 : t, stride: atk ? 3 : 4.5, lift: 2, k: 0.6, knee: 1.8 });
  // Pelvis, spine and ribcage.
  S.add(ellipsoid([cx + lean * 0.3, 65 + B, 0], [5.4, 2.8, 3.6], 'bone'), 0.8);
  for (let i = 0; i < 4; i++) S.add(sphere([cx + lean * (0.3 + i * 0.15), 61 - i * 2.2 + B, -1.6], 1.5, 'boneDark'), 0.6);
  const rc = [cx + lean * 0.8, 48 + B, 0.2];
  S.add(ellipsoid(rc, [6.6, 8.6, 5.4], 'bone'), 1);
  S.sub(ellipsoid([rc[0], rc[1] + 1.4, rc[2] + 0.6], [5.2, 7.6, 4.2], 'maw'), 0.3);
  for (let i = 0; i < 4; i++) S.sub(box([rc[0] + 2.5, rc[1] - 4 + i * 3.4, 5], [5, 0.35, 2.6], 0.15, 'maw'), 0.3);
  // Rot tentacles spilling from the ribcage.
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let i = 0; i <= 7; i++) { const u = i / 7; pts.push([rc[0] - 2 + k * 2.2 + Math.sin(u * 4 + t + k) * 2.4 + u * (k - 1) * 4, rc[1] + 5 + u * 26, 1 + k - u * 2]); }
    for (let i = 0; i < pts.length - 1; i++) S.add(capsule(pts[i], pts[i + 1], 1.8 - i * 0.18, 1.6 - i * 0.18, 'worm'), 0.8);
  }
  // Arms and the scythe.
  limb(S, [cx - 5 + lean, 41 + B, -3.4], [cx - 7 + lean, 50 + B, -3.8], [cx - 4 + lean, 58 + B, -3], 1.6, 1.3, 1.2, 'boneDark', 0.6);
  const hand = atk === 1 ? [cx - 2, 34, 6] : atk === 2 ? [cx + 18, 58, 7] : [cx + 9 + lean, 56 + B, 6];
  const elbow = atk === 1 ? [cx + 4, 38, 6] : atk === 2 ? [cx + 13, 48, 6] : [cx + 10 + lean, 48 + B, 5];
  limb(S, [cx + 5 + lean, 41 + B, 3.4], elbow, hand, 1.7, 1.4, 1.3, 'bone', 0.6);
  S.add(sphere([cx + 5 + lean, 40.6 + B, 3.4], 2.4, 'bone'), 0.8);
  S.add(sphere([cx - 5 + lean, 40.6 + B, -3.4], 2.2, 'boneDark'), 0.8);
  const ang = atk === 1 ? -2.3 : atk === 2 ? 0.55 : -1.45;
  const d = [Math.cos(ang), Math.sin(ang)], hz = hand[2] + 1;
  const butt = [hand[0] - d[0] * 14, hand[1] - d[1] * 14, hz], head = [hand[0] + d[0] * 26, hand[1] + d[1] * 26, hz];
  S.add(capsule(butt, head, 0.9, 0.9, 'wood'), 0);
  // Curved blade sweeping from the head.
  const sideA = ang + PI / 2 * (atk === 2 ? 1 : 1), bl = [];
  for (let i = 0; i <= 8; i++) { const u = i / 8, a = sideA + u * 0.9; bl.push([head[0] + Math.cos(a) * u * 22 - d[0] * u * u * 6, head[1] + Math.sin(a) * u * 22 - d[1] * u * u * 6, hz]); }
  for (let i = 0; i < bl.length - 1; i++) S.add(capsule(bl[i], bl[i + 1], 2.2 * (1 - i / 9) + 0.3, 2.2 * (1 - (i + 1) / 9) + 0.3, 'steel'), 0.5);
  // Skull, jaw and the iron crown.
  const hx = cx + 2 + lean * 1.2, hy = 32 + B;
  S.add(sphere([hx, hy, 0.5], 5, 'bone'), 1);
  S.add(ellipsoid([hx + 2.6, hy + 4.2, 1.6], [3.2, 1.8, 2.8], 'bone'), 0.6);
  for (const ex of [hx + 1.4, hx + 4.6]) S.sub(sphere([ex, hy + 0.6, 4.6], 1.6, 'maw'), 0.4);
  S.sub(box([hx + 3.6, hy + 3.3, 4], [2.2, 0.35, 2], 0.1, 'maw'), 0.2);
  S.add(skirt(hx - 0.3, hy - 7.6, hy - 3.2, 5.6, 5, 0.5, 1, 'iron'), 0.6);
  for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.62; S.add(capsule([hx - 0.3 + Math.cos(a) * 5.4, hy - 7, 0.5 + Math.sin(a) * 5.4], [hx - 0.3 + Math.cos(a) * 5.8, hy - 11, 0.5 + Math.sin(a) * 5.8], 1, 0.2, 'iron'), 0.3); }
  const o = shoot(S, { w: 112, h: 120, s: 1.24, gx: cx, gy: 100, ax: 52, ay: 116 });
  for (const ex of [hx + 1.4, hx + 4.6]) { o.dot(ex, hy + 0.6, 'violet0'); o.dot(ex, hy + 1.5, 'violet2'); }
  o.dot(hx + 6.4, hy - 9, 'violet1');
  return o.f;
}

// ================================================= The Many-Mouthed ===
// A heaving mound of flesh, every mouth singing. 4-frame pulse.
function manymouthed(t = 0, atk = 0) {
  const S = new Scene(), cx = 48, sq = atk ? 1.06 : 1 + Math.sin(t * PI / 2) * 0.035;
  const open = atk === 1 ? 1.6 : atk === 2 ? 2.4 : 1 + odd(t) * 0.3;
  const body = [cx, 76 - 22 * sq, 0];
  S.add(bumpy(ellipsoid(body, [30 / Math.sqrt(sq), 24 * sq, 22 / Math.sqrt(sq)], 'fleshMound'), 1.1, 0.16, 2), 0);
  S.add(bumpy(ellipsoid([cx - 12, 62, -4], [14, 14, 13], 'fleshDark'), 0.8, 0.2, 6), 6);
  S.add(bumpy(ellipsoid([cx + 10, 40 * sq + 18 * (1 - sq), 2], [13, 12, 12], 'fleshMound'), 0.7, 0.22, 9), 6);
  S.add(ellipsoid([cx, 77, 0], [28, 3.4, 20], 'fleshDark'), 4);
  const mouths = [[cx + 14, 50, 13, 6, 1], [cx - 4, 62, 19, 5, 0.85], [cx + 18, 68, 13, 4.4, 0.8], [cx - 18, 46, 10, 3.8, 0.7], [cx + 2, 36, 14, 3.4, 0.7]];
  for (const [mx, my, mz, w, k] of mouths) {
    const h = w * 0.36 * open * k;
    S.sub(ellipsoid([mx, my, mz], [w, h, 5], 'maw'), 1);
    S.paint({ mat: 'gum', f: (x, y, z) => ellipsoid([mx, my, mz], [w + 1.8, h + 1.8, 6.5]).f(x, y, z) });
  }
  const eyesAt = [[cx + 4, 46, 17], [cx - 12, 54, 17], [cx + 22, 58, 9], [cx - 6, 36, 14]];
  for (const [ex, ey, ez] of eyesAt) S.add(sphere([ex, ey, ez], 2.4, 'bone'), 0.8);
  const o = shoot(S, { w: 96, h: 86, s: 1.26, gx: cx, gy: 78, ax: 48, ay: 82 });
  for (const [mx, my, mz, w, k] of mouths) {
    const h = w * 0.36 * open * k;
    for (let x = -w + 1.2; x <= w - 1.2; x += 1.8) for (const [yy, c] of [[my - h + 0.8, 'bone1'], [my + h - 0.8, 'bone3']]) { const q = o.P(mx + x, yy); if (inMaw(o.f, ...q)) dot(o.f, ...q, c); }
  }
  for (const [ex, ey] of eyesAt) { o.dot(ex + 0.6, ey, 'blood1'); o.dot(ex + 0.6, ey + 0.8, 'ink0'); }
  return o.f;
}

// =================================================== Grave Leviathan ===
// A bone-ridged grave worm arching out of churned earth.
function leviathan(t = 0, atk = 0) {
  const S = new Scene(), cx = 34;
  const up = atk === 1 ? 12 : atk === 2 ? 18 : 0, gape = atk ? (atk === 2 ? 4.6 : 3.4) : 2;
  S.add(bumpy(ellipsoid([cx + 6, 49, 0], [30, 4, 12], 'dirt'), 1, 0.35, 3), 0);
  const segs = [];
  for (let i = 0; i < 7; i++) {
    const u = i / 6, x = cx + 28 - u * 44;
    const arch = Math.sin(u * PI * 1.15 + 0.2) * 14 + Math.sin(u * 6 + t * PI / 2) * 1.8;
    segs.push([x - (1 - u) * (1 - u) * up * 0.35, 46 - arch - (1 - u) * up * (1 - u), 0, 7.4 - u * 2.6]);
  }
  for (let i = 0; i < segs.length; i++) {
    const [x, y, z, r] = segs[i];
    S.add(sphere([x, y, z], r, 'worm'), 2.2);
    S.paint({ mat: 'wormBelly', f: (px, py, pz) => (py > y + r * 0.6 && Math.hypot(px - x, py - y) < r + 1 ? -1 : 1) });
    S.add(capsule([x + 1, y - r + 0.6, 0], [x - 2, y - r - 3.4, 0], 1.4, 0.3, 'bone'), 0.4);
    S.sub(box([x - r * 0.62, y, z], [0.5, r + 1, r + 1], 0.2), 0.6);
  }
  // Head with jaws, at the front (right) end, rearing on the attack.
  const [hx0, hy0] = [segs[0][0], segs[0][1]];
  const hx = hx0 + 4, hy = hy0 - 6 - up * 0.4;
  S.add(bumpy(ellipsoid([hx, hy, 0], [8, 7, 7], 'worm'), 0.4, 0.5, 1), 2);
  S.sub(ellipsoid([hx + 7.4, hy + 1.6, 1], [5.4, gape, 7], 'maw'), 0.6);
  S.paint({ mat: 'gum', f: (x, y, z) => ellipsoid([hx + 7.4, hy + 1.6, 1], [6.8, gape + 1.2, 8]).f(x, y, z) });
  S.add(capsule([hx + 1, hy - 6, -2], [hx - 4, hy - 11, -3], 1.6, 0.3, 'bone'), 0.4);
  S.add(capsule([hx + 3, hy - 6, 2], [hx - 1, hy - 11.5, 2.5], 1.6, 0.3, 'bone'), 0.4);
  const o = shoot(S, { w: 88, h: 62, s: 1.2, gx: cx + 6, gy: 49, ax: 42, ay: 56 });
  for (let k = 0; k < 5; k++) for (const [xx, yy, c] of [[hx + 3.4 + k * 1.4, hy + 1.6 - gape + 0.7, 'bone1'], [hx + 4 + k * 1.4, hy + 1.6 + gape - 0.7, 'bone2']]) { const q = o.P(xx, yy); if (inMaw(o.f, ...q)) dot(o.f, ...q, c); }
  o.dot(hx + 2, hy - 3, 'ember0'); o.dot(hx - 1, hy - 3.4, 'ember1');
  return o.f;
}

// =================================================== Collection Imp ===
// A crimson imp in a gilt collar, bent under a sack of coin, collection
// plate held out like an accusation. 30x32, feet at 29.
function imp(t = 0) {
  const S = new Scene(), cx = 13, B = t % 2 ? -1 : 0;
  legs(S, { x: cx, hipY: 21 + B, footY: 29, z: 1.6, thigh: 1.5, shin: 1.1, mt: 'impSkin', mf: 'crimsonDark', foot: [1.8, 0.9, 1.2], t, stride: 3, lift: 1.6, k: 0.6, knee: 0.8 });
  // The sack slung over its back.
  S.add(bumpy(sphere([cx + 5, 15 + B, -2], 6.4, 'leather'), 0.5, 0.6, 2), 0.4);
  S.add(capsule([cx + 3, 10 + B, -1], [cx + 1, 7.6 + B, 0], 1.8, 1, 'leather'), 0.6);
  S.paint({ mat: 'ironDark', f: (x, y) => Math.abs(y - (10.2 + B)) - 0.6 });
  // Body leaning forward.
  S.add(ellipsoid([cx - 1, 18 + B, 0.6], [3.4, 4, 2.8], 'impSkin'), 0.8);
  S.add(ellipsoid([cx - 2, 13.4 + B, 0.8], [2.8, 1.4, 2.4], 'gold'), 0.6);
  // Arm with the plate.
  limb(S, [cx - 3, 14.6 + B, 2], [cx - 6, 17 + B, 2.4], [cx - 8, 15.6 + B, 2.6], 1, 0.9, 0.8, 'impSkin', 0.4);
  S.add(ellipsoid([cx - 10, 15 + B, 2.6], [3, 0.6, 2.4], 'gold'), 0.2);
  // Head, horns, ears.
  const hx = cx - 3.4, hy = 9 + B;
  S.add(sphere([hx, hy, 0.8], 3.6, 'impSkin'), 0.8);
  S.add(capsule([hx + 1, hy - 2.4, 0], [hx + 3.4, hy - 5.6, -0.6], 1, 0.2, 'bone'), 0.3);
  S.add(capsule([hx - 1, hy - 2.6, 1.4], [hx - 0.4, hy - 6, 1.2], 1, 0.2, 'bone'), 0.3);
  S.add(ellipsoid([hx - 3.2, hy + 0.6, 2.2], [1.6, 1.4, 1.4], 'impSkin'), 0.4);
  const fr = render(S, 30, 32, MM, { ground: 29 });
  dot(fr, hx - 1.4, hy - 0.2, 'gold0'); dot(fr, hx - 3.2, hy, 'gold0'); dot(fr, hx - 2.2, hy + 2, 'ink0');
  dot(fr, cx + 4, 12 + B, 'gold0'); dot(fr, cx + 6, 14 + B, 'gold1'); dot(fr, cx - 10, 14 + B, 'gold0');
  return fin(fr, 13, 29);
}

// ===================================================== the Wardens ===
// The five Wardens of the Stations: one comes when the Toll is full. They
// stand taller than any elite (frames 150x160, feet at 154).
const WFRAME = { w: 150, h: 160, s: 1.25, gy: 110, ax: 70, ay: 154 };
const wshoot = (S, cx) => shoot(S, { ...WFRAME, gx: cx });

// The Bellwright: a hunched giant in sackcloth who carries the cathedral's
// cracked bell on his back and rings it with a great iron hammer.
function bellwright(t = 0, atk = 0) {
  const S = new Scene(), cx = 56, B = atk ? 0 : bobAt(t) / 1.25;
  const lean = atk === 1 ? -4 : atk === 2 ? 6 : 1;
  legs(S, { x: cx, hipY: 84 + B, footY: 110, z: 8, thigh: 6.4, shin: 5.4, mt: 'sack', ms: 'fleshDark', mf: 'leather', foot: [6, 3, 5], t: atk ? 0.5 : t, stride: atk ? 2 : 5, lift: 2.5, k: 2.6, knee: 2 });
  // The bell on his back, mouth down, its rim catching the light.
  const bx = cx - 14 + lean * 0.4, by = 46 + B;
  S.add(skirt(bx, by - 18, by + 12, 8, 16, -8, 0.9, 'goldDark'), 0);
  S.add(sphere([bx, by - 19, -8], 8.5, 'goldDark'), 2);
  S.add(torus([bx, by + 12, -8], 15.5, 2.2, 1.35, 'gold'), 0.6);
  S.paint({ mat: 'gold', f: (x, y) => Math.abs(y - (by - 4)) - 1.1 });
  S.sub(capsule([bx - 6, by - 10, 5], [bx + 3, by + 4, 7], 0.8, 0.6, 'void'), 0.5);
  // Hunched torso and sack robe.
  S.add(bumpy(ellipsoid([cx + 2 + lean * 0.6, 58 + B, 1], [17, 18, 13], 'sack'), 0.3, 0.3, 4), 3);
  S.add(folds(skirt(cx + 2, 70 + B, 96, 16, 18, 1, 0.85, 'sack'), { cx: cx + 2, n: 9, amp: 0.7, y0: 72, y1: 96 }), 2);
  chain(S, [[cx - 12, 40 + B, 10], [cx - 2, 52 + B, 14], [cx + 8, 62 + B, 13], [cx + 16, 72 + B, 9]], 1.4, 'iron');
  // The hammer arm: raised overhead on the windup, brought down on the strike.
  const hand = atk === 1 ? [cx + 4, 20, 10] : atk === 2 ? [cx + 30, 82, 12] : [cx + 20 + lean, 72 + B, 12];
  limb(S, [cx + 10 + lean, 46 + B, 9], atk === 1 ? [cx + 16, 32, 12] : [cx + 22 + lean, 58 + B, 13], hand, 6.4, 5.6, 5, 'fleshDark', 2.5);
  S.add(sphere(hand, 5.6, 'fleshDark'), 1.5);
  const dir = atk === 1 ? [-0.4, -1] : atk === 2 ? [1, 0.25] : [0.15, 1];
  const L = Math.hypot(...dir), ux = dir[0] / L, uy = dir[1] / L, head = [hand[0] + ux * 26, hand[1] + uy * 26, 13];
  S.add(capsule([hand[0] - ux * 6, hand[1] - uy * 6, 13], head, 1.7, 1.7, 'wood'), 0);
  S.add(box(head, [7, 5, 5], 1.2, 'ironDark'), 0);
  S.paint({ mat: 'iron', f: (x, y, z) => Math.max(Math.abs(x - head[0]) - 7.5, Math.abs(y - head[1]) - 5.5, Math.abs(z - head[2]) - 5.5, -(Math.abs(x - head[0]) - 5.6)) });
  limb(S, [cx - 8, 46 + B, -8], [cx - 14, 62 + B, -9], [cx - 10, 76 + B, -8], 5.6, 4.8, 4.6, 'fleshDark', 2);
  // Head: a hood stitched shut, the face a cracked bronze bell-mask.
  const hx = cx + 16 + lean * 1.2, hy = 38 + B + (atk === 2 ? 5 : 0);
  S.add(bumpy(ellipsoid([hx - 2, hy - 1, 3], [10, 10.5, 9], 'sack'), 0.35, 0.5, 2), 3);
  S.add(skirt(hx + 3, hy - 6, hy + 7, 4, 7, 6, 0.75, 'goldDark'), 1.2);
  const o = wshoot(S, cx);
  for (const ex of [hx + 2, hx + 6]) { o.dot(ex, hy - 1, 'ember0'); o.dot(ex, hy, 'ember2'); }
  o.line(hx + 1, hy + 4, hx + 7, hy + 4, 'ink2');
  return o.f;
}

// Mother Candlemass: a towering matron of melted wax, a crown of lit candles
// on her head and more on her shoulders, a candelabrum in her hands.
function candlemass(t = 0, atk = 0) {
  const S = new Scene(), cx = 60, B = atk ? 0 : bobAt(t) / 1.25;
  const lean = atk === 1 ? -3 : atk === 2 ? 4 : 0;
  robeBody(S, { cx, top: 40, waist: 62, hem: 110, rTop: 11, rHem: 21, mat: 'wax', B, n: 12, amp: 1.1, lean, zs: 0.8 });
  // Drips frozen down the skirt.
  for (let k = 0; k < 9; k++) { const a = -1.2 + k * 0.32, x = cx + Math.sin(a) * 17, z = Math.cos(a) * 14; S.add(capsule([x, 70 + (k % 3) * 4 + B, z], [x + 0.5, 92 + (k % 4) * 4 + B, z + 1], 1.8, 1.2, 'wax'), 1.2); }
  S.add(ellipsoid([cx + lean, 42 + B, 0], [14, 5, 9], 'wax'), 2);
  // Shoulder candles.
  const flames = [];
  for (const [dx, h, z] of [[-11, 9, -2], [-6, 12, 4], [8, 10, 3], [12, 7, -3]]) { const b = [cx + dx + lean, 38 + B, z]; S.add(capsule(b, [b[0], b[1] - h, z], 1.9, 1.7, 'waxDark'), 0.6); flames.push([b[0], b[1] - h - 2.5, z]); }
  // Arms raising the candelabrum.
  const hand = atk === 1 ? [cx + 6, 26, 9] : atk === 2 ? [cx + 24, 46, 10] : [cx + 14 + lean, 58 + B, 10];
  limb(S, [cx + 10 + lean, 44 + B, 6], [cx + 14 + lean, 52 + B, 9], hand, 4, 3.6, 3.2, 'wax', 1.6);
  limb(S, [cx - 10 + lean, 44 + B, 6], [cx - 6 + lean, 54 + B, 10], [hand[0] - 5, hand[1] + 3, hand[2]], 4, 3.6, 3.2, 'wax', 1.6);
  const top = [hand[0] + (atk === 2 ? 10 : 2), hand[1] - (atk === 2 ? 14 : 22), hand[2] + 1];
  S.add(capsule([hand[0] - (top[0] - hand[0]) * 0.3, hand[1] + 8, hand[2]], top, 1.3, 1.1, 'gold'), 0);
  for (const dx of [-7, 0, 7]) { const c = [top[0] + dx, top[1] - (dx ? 2 : 4), top[2]]; S.add(capsule(top, c, 0.9, 0.9, 'gold'), 0.3); S.add(capsule(c, [c[0], c[1] - 5, c[2]], 1.4, 1.3, 'waxDark'), 0.3); flames.push([c[0], c[1] - 7, c[2]]); }
  // Head: a smooth wax face, eyes melted shut, a crown of candles.
  const hx = cx + 3 + lean * 1.2, hy = 28 + B;
  S.add(capsule([cx + lean, 40 + B, 0], [hx, hy + 4, 1], 5, 5.4, 'wax'), 2);
  S.add(ellipsoid([hx, hy, 1.5], [7, 8, 6.4], 'wax'), 2);
  S.add(capsule([hx + 3, hy + 2, 6], [hx + 3.4, hy + 9, 6.4], 1, 0.7, 'wax'), 0.8);
  for (let k = 0; k < 5; k++) { const a = -0.9 + k * 0.45, b = [hx + Math.sin(a) * 6, hy - 6, Math.cos(a) * 5 + 1]; S.add(capsule(b, [b[0], b[1] - 6 - (k % 2) * 3, b[2]], 1.4, 1.3, 'waxDark'), 0.6); flames.push([b[0], b[1] - 8.5 - (k % 2) * 3, b[2]]); }
  for (const f of flames) S.add(ellipsoid(f, [1.7, 2.8, 1.7], 'ember'), 0);
  const o = wshoot(S, cx);
  o.line(hx + 1, hy - 0.5, hx + 3, hy - 0.5, 'bone4'); o.line(hx + 4.5, hy - 0.5, hx + 6, hy - 0.5, 'bone4');
  o.dot(hx + 4, hy + 4, 'ember1');
  for (const f of flames) o.dot(f[0], f[1] - 1, 'ember0');
  return o.f;
}

// The Hollow Cardinal: crimson robes with no one inside, floating above
// the floor; a gold mitre over an empty hood, a crozier of gold.
function cardinal(t = 0, atk = 0) {
  const S = new Scene(), cx = 60, B = atk ? -2 : Math.round(Math.sin(t * PI / 2)) * 2 / 1.25 - 4;
  const lean = atk === 1 ? -3 : atk === 2 ? 4 : 0;
  robeBody(S, { cx, top: 40, waist: 58, hem: 98, rTop: 10, rHem: 17, mat: 'crimson', tip: true, B, n: 10, amp: 0.9, lean, zs: 0.8 });
  S.add(folds(skirt(cx - 4, 40 + B, 100, 9, 20, -6, 0.6, 'crimsonDark'), { cx: cx - 4, cz: -6, n: 8, amp: 0.8, y0: 44, y1: 100 }), 1.5);
  // Ermine cape and a gold pectoral cross.
  S.add(ellipsoid([cx + lean, 44 + B, 0], [14, 6, 10], 'cloth'), 2);
  for (let k = 0; k < 6; k++) S.paint(sphere([cx - 10 + k * 4 + lean, 47 + B, 8 - Math.abs(k - 2.5)], 0.9, 'ink'));
  S.paint({ mat: 'gold', f: (x, y, z) => Math.min(Math.max(Math.abs(x - (cx + 2 + lean)) - 1, Math.abs(y - (60 + B)) - 6), Math.max(Math.abs(x - (cx + 2 + lean)) - 4, Math.abs(y - (57 + B)) - 1)) + (z < 4 ? 9 : 0) });
  // Sleeves; the hands are not there, only gloves.
  const hand = atk === 1 ? [cx + 10, 30, 9] : atk === 2 ? [cx + 26, 50, 10] : [cx + 16 + lean, 60 + B, 9];
  limb(S, [cx + 9 + lean, 45 + B, 5], [cx + 15 + lean, 53 + B, 8], hand, 4.6, 4.4, 4.8, 'crimson', 1.6);
  S.add(sphere(hand, 2.6, 'cloth'), 0.6);
  limb(S, [cx - 9 + lean, 45 + B, -5], [cx - 13 + lean, 56 + B, -6], [cx - 9 + lean, 64 + B, -4], 4.4, 4.2, 4.6, 'crimsonDark', 1.4);
  // The crozier.
  const top = atk === 1 ? [hand[0] - 2, hand[1] - 34, hand[2] + 1] : atk === 2 ? [hand[0] + 22, hand[1] - 22, hand[2] + 1] : [hand[0] + 2, hand[1] - 36, hand[2] + 1];
  const bot = [hand[0] + (hand[0] - top[0]) * 0.5, hand[1] + (hand[1] - top[1]) * 0.5, hand[2] + 1];
  S.add(capsule(bot, top, 1.2, 1.2, 'gold'), 0);
  const crook = []; for (let k = 0; k <= 8; k++) { const a = PI * 0.5 - k * PI / 7; crook.push([top[0] + 3 + Math.cos(a) * 4, top[1] - 4 + Math.sin(a) * -4, top[2]]); }
  for (let k = 0; k < crook.length - 1; k++) S.add(capsule(crook[k], crook[k + 1], 1.2, 1.2, 'gold'), 0.3);
  // Hood with nothing in it, mitre above.
  const hx = cx + 2 + lean * 1.2, hy = 30 + B;
  S.add(sphere([hx - 1, hy, 0], 8, 'crimson'), 2);
  const cut = ellipsoid([hx + 4, hy + 1.5, 5.5], [4.2, 5.4, 4], 'void'); S.sub(cut, 0.8);
  S.add(skirt(hx - 1, hy - 18, hy - 5, 2.5, 7, 0, 0.6, 'cloth'), 1);
  S.paint({ mat: 'gold', f: (x, y, z) => Math.min(Math.abs(x - (hx - 1)) - 0.9, Math.abs(y - (hy - 6)) - 0.9) + (z < 1 ? 9 : 0) });
  const o = wshoot(S, cx);
  for (const ex of [hx + 3, hx + 6]) { o.dot(ex, hy + 0.5, 'holy0'); o.dot(ex, hy + 1.5, 'holy2'); }
  return o.f;
}

// The Charnel King: a giant of fused bones under a crown of skulls, with a
// rotten royal cloak and a sceptre made from a thigh bone.
function charnelKing(t = 0, atk = 0) {
  const S = new Scene(), cx = 58, B = atk ? 0 : bobAt(t) / 1.25;
  const lean = atk === 1 ? -4 : atk === 2 ? 6 : 1;
  legs(S, { x: cx, hipY: 76 + B, footY: 110, z: 6, thigh: 3.4, shin: 2.8, mt: 'bone', ms: 'bone', mf: 'boneDark', foot: [5, 2.2, 3], t: atk ? 0.5 : t, stride: atk ? 3 : 5.5, lift: 3, k: 0.8, knee: 2.2 });
  // Cloak behind.
  S.add(clip(folds(skirt(cx - 3, 36 + B, 104, 10, 22, -7, 0.55, 'hoodRed'), { cx: cx - 3, cz: -7, n: 9, amp: 0.8, y0: 40, y1: 104 }), (x, y, z) => y - (100 + 4 * Math.sin(x * 0.6))), 0);
  // Pelvis, spine and a cage of ribs.
  S.add(ellipsoid([cx + lean * 0.3, 76 + B, 0], [8, 4, 6], 'bone'), 1);
  for (let k = 0; k < 7; k++) S.add(sphere([cx + lean * (0.3 + k * 0.08), 72 - k * 4 + B, -2], 2.2, 'boneDark'), 0.6);
  for (let k = 0; k < 5; k++) { const y = 46 + k * 4.6 + B, r = 13 - Math.abs(k - 1.5) * 1.4; const ribs = []; for (let i = 0; i <= 8; i++) { const a = -PI * 0.9 + i * PI * 0.225; ribs.push([cx + lean * 0.6 + Math.cos(a) * r, y + Math.sin(a) * 1.5 + i * 0.2, Math.sin(a + PI / 2) * r * 0.75]); } for (let i = 0; i < ribs.length - 1; i++) if (ribs[i][2] > -3) S.add(capsule(ribs[i], ribs[i + 1], 1.3, 1.3, 'bone'), 0.4); }
  S.add(ellipsoid([cx + lean * 0.6, 42 + B, 0], [15, 4, 9], 'bone'), 1.2);
  // Arms: the sceptre arm swings it overhead, then down.
  const hand = atk === 1 ? [cx + 6, 22, 10] : atk === 2 ? [cx + 30, 76, 11] : [cx + 18 + lean, 70 + B, 10];
  limb(S, [cx + 12 + lean, 43 + B, 6], atk === 1 ? [cx + 16, 30, 10] : [cx + 18 + lean, 56 + B, 9], hand, 2.4, 2.2, 2, 'bone', 0.8);
  S.add(sphere(hand, 2.6, 'boneDark'), 0.5);
  const dir = atk === 1 ? [-0.3, -1] : atk === 2 ? [1, 0.4] : [0.2, -1];
  const L = Math.hypot(...dir), ux = dir[0] / L, uy = dir[1] / L, tip = [hand[0] + ux * 24, hand[1] + uy * 24, 11];
  S.add(capsule([hand[0] - ux * 4, hand[1] - uy * 4, 11], tip, 1.6, 1.6, 'bone'), 0);
  S.add(sphere(tip, 3.4, 'bone'), 1); S.add(sphere([tip[0] - uy * 2.6, tip[1] + ux * 2.6, 11], 3, 'bone'), 1);
  limb(S, [cx - 12 + lean, 43 + B, -6], [cx - 16 + lean, 58 + B, -7], [cx - 12 + lean, 70 + B, -6], 2.4, 2.2, 2, 'boneDark', 0.8);
  // Skull and crown.
  const hx = cx + 6 + lean * 1.3, hy = 30 + B + (atk === 2 ? 4 : 0);
  S.add(sphere([hx, hy, 1], 7.6, 'bone'), 0);
  S.add(ellipsoid([hx + 3, hy + 6, 2], [5, 3, 5], 'bone'), 2);
  for (const [ex, ez] of [[2.5, 5], [6, 2.5]]) S.sub(sphere([hx + ex, hy + 0.5, ez + 1], 2.5, 'void'), 0.5);
  S.sub(ellipsoid([hx + 6, hy + 4, 4], [0.9, 1.4, 2], 'void'), 0.3);
  S.add(skirt(hx - 0.5, hy - 12, hy - 5, 7.8, 7.4, 1, 1, 'goldDark'), 0.5);
  for (let k = 0; k < 5; k++) { const a = -1 + k * 0.5; S.add(capsule([hx - 0.5 + Math.sin(a) * 7.6, hy - 11, 1 + Math.cos(a) * 7.6], [hx - 0.5 + Math.sin(a) * 8, hy - 16, 1 + Math.cos(a) * 8], 1.3, 0.4, 'gold'), 0.3); }
  const o = wshoot(S, cx);
  for (const ex of [hx + 2.5, hx + 6]) o.dot(ex, hy + 0.5, 'flame0');
  o.line(hx + 2, hy + 7, hx + 7, hy + 7, 'boneDark' in MM ? 'bone4' : 'bone4');
  return o.f;
}

// Our Lady of Nails: a hollow iron statue of a saint, hands folded, robed in
// riveted plates, a halo of long nails; she glides, she does not walk.
function ladyOfNails(t = 0, atk = 0) {
  const S = new Scene(), cx = 60, B = atk ? 0 : Math.round(Math.sin(t * PI / 2)) * 2 / 1.25;
  const lean = atk === 1 ? -2 : atk === 2 ? 3 : 0, open = atk === 2 ? 4 : atk === 1 ? 1.5 : 0;
  robeBody(S, { cx, top: 38, waist: 58, hem: 110, rTop: 10, rHem: 19, mat: 'ironDark', B, n: 8, amp: 0.4, lean, zs: 0.8 });
  // Rust weeping down the plates.
  for (const [a, y0, len] of [[-0.6, 66, 22], [0.3, 72, 18], [0.9, 64, 26]]) S.paint({ mat: 'blood', f: (x, y, z) => Math.max(Math.abs(Math.atan2(x - cx, z) - a) * 14 - 0.9, y0 + B - y, y - (y0 + len + B), -z) });
  // Rivets and plate seams.
  for (let row = 0; row < 5; row++) for (let k = 0; k < 6; k++) { const a = -1.1 + k * 0.45, y = 66 + row * 9 + B, r = 11 + (y - 58) * 0.17; S.paint(sphere([cx + Math.sin(a) * r, y, Math.cos(a) * r * 0.8], 1, 'steel')); }
  // The front opens on the strike: a dark seam with nails inside.
  if (open) S.sub(box([cx + 3, 76 + B, 15], [open, 26, 5], 0.6, 'void'), 0.8);
  // Folded hands; on the windup they part.
  const hand = atk === 1 ? [cx + 16, 44, 9] : atk === 2 ? [cx + 20, 52, 10] : [cx + 6 + lean, 54 + B, 11];
  limb(S, [cx + 9 + lean, 42 + B, 5], [cx + 12 + lean, 50 + B, 9], hand, 3.6, 3.2, 2.6, 'steel', 1.2);
  limb(S, [cx - 9 + lean, 42 + B, 5], [cx - 4 + lean, 51 + B, 10], atk ? [cx - 12, 52, 8] : [hand[0] - 2, hand[1] + 1, hand[2] - 1], 3.6, 3.2, 2.6, 'steel', 1.2);
  // Veiled head with a calm iron face.
  const hx = cx + 2 + lean * 1.2, hy = 28 + B;
  S.add(capsule([cx + lean, 40 + B, 0], [hx, hy + 4, 0], 4.6, 5, 'steel'), 1.6);
  S.add(folds(skirt(hx - 2, hy - 6, hy + 14, 6, 11, -1, 0.95, 'ironDark'), { cx: hx - 2, cz: -1, n: 7, amp: 0.4, y0: hy - 3, y1: hy + 14 }), 1.2);
  S.add(ellipsoid([hx + 2.5, hy + 1, 3], [4.4, 5.6, 3.6], 'steel'), 0.6);
  // The halo of nails, fanned behind the head.
  for (let k = 0; k < 9; k++) { const a = -PI * 0.95 + k * PI * 0.237; S.add(capsule([hx - 1 + Math.cos(a) * 8, hy - 1 + Math.sin(a) * 8, -4], [hx - 1 + Math.cos(a) * 20, hy - 1 + Math.sin(a) * 20, -4.5], 1.5, 0.5, 'steel'), 0); }
  S.add(torus([hx - 1, hy - 1, -5], 8.5, 1.6, PI / 2, 'gold'), 0);
  const o = wshoot(S, cx);
  // Closed eyes and a tear of rust.
  o.line(hx + 2, hy, hx + 4, hy, 'iron4'); o.line(hx + 5.5, hy, hx + 7, hy, 'iron4');
  o.dot(hx + 3, hy + 2, 'blood1'); o.dot(hx + 3, hy + 4, 'blood2');
  if (open) for (let k = 0; k < 5; k++) o.dot(cx + 3, 64 + k * 6 + B, 'iron1');
  return o.f;
}
const WARDENS = { bellwright, candlemass, cardinal, charnelKing, ladyOfNails };

const set = (fn, walk = HALF, atk = [1, 2]) => ({ walk: () => walk.map((t) => fn(t, 0)), attack: () => atk.map((a) => fn(0, a)), ...reactions(() => fn(0, 0), 0.8) });
const R = { colossus: set(colossus), titan: set(titan), inquisitor: set(inquisitor), seraph: set(seraph), effigy: set(effigy), abbess: set(abbess), golem: set(golem), thrice: set(thrice), manymouthed: set(manymouthed), leviathan: set(leviathan) };
const mon_elite = {};
for (const [id, s] of Object.entries(R)) { mon_elite[`${id}_walk`] = s.walk; mon_elite[`${id}_attack`] = s.attack; mon_elite[`${id}_hit`] = s.hit; mon_elite[`${id}_die`] = s.die; }
const mon_warden = {};
for (const [id, fn] of Object.entries(WARDENS)) { const w = set(fn); mon_warden[`${id}_walk`] = w.walk; mon_warden[`${id}_attack`] = w.attack; mon_warden[`${id}_hit`] = w.hit; mon_warden[`${id}_die`] = w.die; }
export default { mon_elite, mon_warden, loot: { imp: () => [0, 1, 2, 3].map((t) => imp(t)) } };
