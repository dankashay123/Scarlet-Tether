// Sculpted models for the ten common monsters. Each model is built from
// smooth-joined shapes (tools/sdf.mjs), lit as one form, then finished with
// hand-placed eyes and glints. Everything faces right; frames carry ax/ay at
// the ground contact point.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, render, folds, bumpy, clip, noise3, dot, pline, under } from '../sdf.mjs';
import { MATS, torus, stride, odd, cyc, HALF, reactions, bobAt } from './base.mjs';

const MM = {
  ...MATS,
  flesh: { ramp: 'rot', spec: 0.12, bias: -0.08 }, fleshDark: { ramp: 'rot', bias: -0.16, min: 2 }, gum: { ramp: 'blood', bias: -0.1, min: 2 },
  rag: { ramp: 'shroud', spec: 0.03 }, mourn: { ramp: 'stone', spec: 0.05, bias: -0.22, min: 3 }, mournDark: { ramp: 'stone', bias: -0.34, min: 5 }, veil: { ramp: 'violet', bias: -0.2, min: 5, spec: 0.1 }, ragDark: { ramp: 'shroud', bias: -0.14, min: 2 },
  wax: { ramp: 'bone', spec: 0.3, bias: -0.02 }, waxDark: { ramp: 'bone', spec: 0.2, bias: -0.2, min: 3 },
  robeSlate: { ramp: 'slate', spec: 0.04 }, robeSlateDark: { ramp: 'slate', bias: -0.14, min: 2 },
  bone: { ramp: 'bone', spec: 0.25 }, boneDark: { ramp: 'bone', bias: -0.18, min: 3 },
  plate: { ramp: 'iron', spec: 0.7, max: 7 }, plateDark: { ramp: 'iron', spec: 0.5, bias: -0.15, min: 3 },
  red: { ramp: 'crimson', spec: 0.06 }, redDark: { ramp: 'crimson', bias: -0.14, min: 2 },
  fur: { ramp: 'shroud', spec: 0.05, bias: 0.05 }, pink: { ramp: 'skin', spec: 0.2, bias: -0.05 },
  bare: { ramp: 'skin', spec: 0.14 }, wing: { ramp: 'stone', spec: 0.15, bias: 0.15 }, wingDark: { ramp: 'stone', bias: -0.15, min: 3 }, bloat: { ramp: 'rot', spec: 0.35, bias: -0.16 }, shieldFace: { ramp: 'iron', spec: 0.4, bias: -0.22, min: 3 }, wound: { ramp: 'blood', spec: 0.5, min: 1 }, lash: { ramp: 'blood', spec: 0.3, bias: -0.1, min: 2, max: 5 },
  sack: { ramp: 'shroud', bias: -0.05 }, rope: { ramp: 'wood', spec: 0.1, bias: 0.1 },
  marble: { ramp: 'bone', spec: 0.15, bias: -0.1 }, marbleDark: { ramp: 'bone', bias: -0.25, min: 3 },
  spirit: { ramp: 'holy', spec: 0.4, bias: -0.02, min: 1, max: 7 }, spiritDeep: { ramp: 'holy', bias: -0.05, min: 2 },
  hollow: { ramp: 'ink', bias: -0.5, min: 5 },
  silt: { ramp: 'teal', spec: 0.25, bias: -0.08 }, weed: { ramp: 'moss', spec: 0.15, bias: -0.15, min: 1 }, eel: { ramp: 'slate', spec: 0.6, bias: 0.05 }, eelDark: { ramp: 'teal', spec: 0.4, bias: -0.2, min: 2 }, belly: { ramp: 'moss', spec: 0.25 }, bellyHot: { ramp: 'blood', spec: 0.55, bias: 0.05 },
};

const A = (f, ax, ay) => Object.assign(f, { ax, ay });
const R = (S, w, h, ground, o = {}) => render(S, w, h, MM, { ground, ...o });
const sin = Math.sin, cos = Math.cos, PI = Math.PI;
// A two-pixel glowing eye (bright over dim).
const D = (f, x, y, c) => dot(f, Math.floor(x), Math.floor(y), c);
const eye = (f, x, y, a = 'ember0', b = 'ember2') => { D(f, x, y, a); if (b) D(f, x, y + 1, b); };
// Ragged hem: clip a shape below a jittered line.
const ragged = (p, y, amp = 1.4, freq = 0.9, seed = 0) => clip(p, (x, yy, z) => yy - (y + amp * noise3(x * freq + seed, 0.5, z * freq)));
// One limb in two segments, smooth-joined.
function limb(S, a, b, c, ra, rb, rc, mat, k = 0.8, matB = mat) {
  S.add(capsule(a, b, ra, rb, mat), k);
  S.add(capsule(b, c, rb, rc, matB), k * 0.8);
}
// Four-frame walk phase helpers.
const ph = (t) => (t / 4) * PI * 2;
// Planted-foot legs for a 4-step cycle: [back, front] foot offsets and lifts.
const gaitL = (t, amp, H = 1.6) => { const b = stride(t / 4 + 0.5, amp, H), f = stride(t / 4, amp, H); return [b, f]; };

// ================================================================ risen ===
// A hunched, rotting corpse in burial rags, arms out, shambling.
function risen(t = 0, atk = -1) {
  const S = new Scene(), w = 40, h = 42, gy = 39, cx = 18;
  const s = sin(ph(t)), c = cos(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  const lean = atk === 0 ? -2 : atk === 1 ? 3 : 0;
  // Legs: thin, bent, dragging.
  const G = gaitL(t, 3, 1.4);
  for (const [side, sw, up] of [[-1, atk >= 0 ? -2 : G[0].x, atk >= 0 ? 0 : G[0].up], [1, atk >= 0 ? 2.5 : G[1].x, atk >= 0 ? 0 : G[1].up]]) {
    const z = side * 1.8, hip = [cx + side * 0.3, 27 + B, z];
    const knee = [cx + sw * 0.6 + 1 + up * 0.4, 32.5 - up * 0.5, z + 0.5], foot = [cx + sw, gy - 1.2 - up, z];
    limb(S, hip, knee, foot, 2.1, 1.7, 1.5, 'flesh', 0.9);
    S.add(ellipsoid([foot[0] + 1.2, gy - 0.9 - up, z], [2.3, 1.1, 1.5], 'fleshDark'), 0.7);
  }
  // Torso: a hunched barrel tipping forward, with a spine hump.
  const tx = cx + 1 + lean * 0.6, ty = 20 + B;
  S.add(bumpy(rotZ(ellipsoid([tx, ty, 0], [5.2, 6.8, 4], 'flesh'), [tx, ty + 5], 0.45 + lean * 0.06), 0.35, 0.6, 3), 0);
  S.add(sphere([tx - 2, ty - 3, -0.6], 3.4, 'flesh'), 2.6);
  // Burial rags round the hips and over one shoulder.
  S.add(ragged(folds(skirt(cx + 0.5, 22 + B, 31, 5, 6.4, 0, 0.9, 'rag'), { cx: cx + 0.5, n: 6, amp: 0.5, y0: 23, y1: 31 }), 29.5, 1.5, 0.8, 4), 1);
  S.paint({ f: (x, y, z) => Math.abs((x - tx) * 0.8 + (y - ty) * 0.6 + 1) - 1.6 + (z < -1 ? 9 : 0), mat: 'rag' });
  // Arms reaching forward (strike: a raking claw).
  const sh = [tx + 2, ty - 3.5, 2.6], shB = [tx - 1.5, ty - 3.8, -2.6];
  const reachF = atk === 0 ? [[tx + 1, ty - 9, 3.4], [tx - 2, ty - 13, 3.6]] : atk === 1 ? [[tx + 7, ty, 3.4], [tx + 12, ty + 4, 3.4]] : [[tx + 6, ty - 1 + s, 3.2], [tx + 11, ty + 0.5 + s * 1.2, 3.2]];
  limb(S, sh, reachF[0], reachF[1], 1.9, 1.5, 1.3, 'flesh', 1.1);
  S.add(sphere(reachF[1], 1.6, 'flesh'), 0.6);
  const reachB = atk === 0 ? [[tx - 3, ty - 8, -3], [tx - 4, ty - 12, -3]] : [[tx + 4, ty + 1 - s, -3], [tx + 9, ty + 2 - s, -3]];
  limb(S, shB, reachB[0], reachB[1], 1.7, 1.4, 1.2, 'fleshDark', 1);
  // Head thrust forward and low on the neck, slack jaw.
  const hx = tx + 6 + lean * 0.4, hy = ty - 6.5 + (atk === 1 ? 2 : 0);
  S.add(capsule([tx + 2, ty - 4, 0], [hx - 1, hy + 1, 0.6], 2.4, 2.2, 'flesh'), 1.4);
  S.add(bumpy(sphere([hx, hy, 0.8], 4.1, 'flesh'), 0.3, 0.8, 9), 1.2);
  S.add(ellipsoid([hx + 1.8, hy + 3.1, 1], [2.6, 1.6, 2.3], 'flesh'), 1);
  S.sub(ellipsoid([hx + 3.6, hy + 2.4, 2], [1.5, atk === 1 ? 1.4 : 0.8, 2], 'gum'), 0.4);
  S.sub(sphere([hx + 2.3, hy - 0.6, 3.6], 1.2, 'hollow'), 0.4);
  S.sub(sphere([hx + 4.4, hy - 0.3, 2.6], 1, 'hollow'), 0.3);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.3, hy - 0.8, 'ember0', 'ember2'); D(f, hx + 4.3, hy - 0.4, 'ember1');
  // A chipped tooth or two.
  D(f, hx + 3.2, hy + 2, 'bone1'); D(f, hx + 4.2, hy + 2.1, 'bone2');
  return A(f, cx, gy);
}

// ============================================================== crawler ===
// A legless penitent in a rag cowl, dragging itself along on long arms;
// bandaged stumps trail behind.
function crawler(t = 0, atk = -1) {
  const S = new Scene(), w = 42, h = 28, gy = 25;
  const rear = atk === 0 ? 4 : atk === 1 ? 1.5 : 0, fw = atk === 1 ? 5 : 0;
  const heave = atk >= 0 ? 0 : bobAt(t) - 2;
  // Body lies along the floor, chest lifted on the arms.
  const bx = 17 + fw * 0.5, by = gy - 5.2 - rear * 0.5 + heave;
  S.add(bumpy(rotZ(ellipsoid([bx, by, 0], [8.6, 4.2, 4.6], 'flesh'), [bx, by], -0.2 - rear * 0.07), 0.3, 0.6, 1), 0);
  S.add(sphere([bx + 5, by - 2.2 - rear * 0.6, 0], 4.2, 'flesh'), 2.2);
  // A shroud draped over the back and down the flanks.
  const shroud = clip(folds(ellipsoid([bx - 0.5, by - 1.4 - rear * 0.3, 0], [8.4, 4, 5.2], 'rag'), { cx: bx, cz: 0, n: 9, amp: 0.45, y0: by - 6, y1: by + 3 }), (x, y, z) => y - (by + 1.6 + 0.9 * noise3(x * 0.8, 1, z)) + (x - bx) * 0.12);
  S.add(rotZ(shroud, [bx, by], -0.2 - rear * 0.07), 1);
  // Stumps, bound in rags, one dragging.
  S.add(capsule([bx - 6.5, by + 1, -1.8], [bx - 11, by + 2.4, -2], 2.6, 2.2, 'rag'), 1.4);
  S.add(capsule([bx - 6.5, by + 1.4, 1.8], [bx - 10.4, by + 3.4, 2.1], 2.6, 2.3, 'rag'), 1.4);
  S.paint({ f: (x, y, z) => Math.abs(x - (bx - 8.6)) - 0.45 + (y < by - 2 ? 9 : 0), mat: 'ragDark' });
  S.paint({ f: (x, y, z) => x - (bx - 11.6) + (z < 1 ? 0.6 : 0), mat: 'wound' });
  // Long arms hauling, alternating; on the strike both claw forward.
  for (const [side, phase] of [[1, 0], [-1, PI]]) {
    const z = side * 3.2, sh = [bx + 6.5, by - 1.8 - rear * 0.6, z * 0.8];
    const p = atk >= 0 ? (atk === 0 ? 0.1 : 1) : (sin(ph(t) + phase) + 1) / 2;
    const hand = atk === 1 ? [bx + 15.5, gy - 3.4 - (side > 0 ? 1.2 : 0), z] : [bx + 9 + p * 5, gy - 1.2 - (atk === 0 ? 3.6 : 0), z];
    const elbow = [(sh[0] + hand[0]) / 2 + 0.6, Math.min(sh[1], hand[1]) - 2.8, z * 1.1];
    const m = side > 0 ? 'flesh' : 'fleshDark';
    limb(S, sh, elbow, hand, 2, 1.6, 1.3, m, 1);
    S.add(ellipsoid([hand[0] + 0.9, hand[1] + 0.2, z], [1.9, 1, 1.5], m), 0.6);
  }
  // Head inside the cowl, craning up.
  const hx = bx + 11 + fw * 0.3, hy = by - 5 - rear * 0.9;
  S.add(capsule([bx + 6, by - 2.4, 0], [hx - 1, hy + 1, 0.4], 2.4, 2.2, 'flesh'), 1.3);
  S.add(bumpy(sphere([hx, hy, 0.6], 3.6, 'flesh'), 0.25, 0.8, 5), 1.2);
  S.add(ellipsoid([hx + 1.7, hy + 2.3, 0.8], [2.3, 1.4, 2], 'flesh'), 1);
  S.sub(ellipsoid([hx + 3.3, hy + 2, 1.6], [1.4, atk === 1 ? 1.4 : 0.7, 1.8], 'gum'), 0.4);
  S.sub(sphere([hx + 2.1, hy - 0.6, 3.3], 1.05, 'hollow'), 0.4);
  // The cowl: a rag hood open at the front.
  const hood = clip(sphere([hx - 1.2, hy - 0.9, 0], 4.3, 'rag'), (x, y, z) => (x - (hx - 0.4)) + (y - hy) * 0.5);
  S.add(hood, 0.8);
  S.add(capsule([hx - 3, hy - 2, 0], [bx + 4, by - 3.4, 0], 3.6, 4, 'rag'), 1.4);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.1, hy - 0.8, 'flame0', 'flame2');
  D(f, hx + 3.2, hy + 1.4, 'bone1');
  return A(f, 18, gy);
}

// ============================================================== mourner ===
// A black-veiled mourner whose head is a guttering church candle; wax has
// run down over its shoulders.
function mourner(t = 0, atk = -1) {
  const S = new Scene(), w = 40, h = 54, gy = 51, cx = 19;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  const sway = atk >= 0 ? (atk === 1 ? 1 : -1) : s;
  // Long mourning robe, sweeping as it glides.
  S.add(rotZ(ragged(folds(skirt(cx, 25 + B, gy - 0.5, 4, 8.6, 0, 0.85, 'mourn'), { cx, n: 9, amp: 0.6, y0: 26, y1: gy, phase: t }), gy - 1.2, 1.2, 0.9, 2), [cx, 25], sway * 0.04), 0);
  // Narrow shoulders and a veil hanging from the candle's base.
  S.add(ellipsoid([cx, 27 + B, 0], [5, 3.6, 3.8], 'mourn'), 2);
  S.add(folds(skirt(cx + 0.6, 21.5 + B, 30 + B, 3.6, 6, 0.3, 0.9, 'veil'), { cx: cx + 0.6, n: 8, amp: 0.4, y0: 22, y1: 30 }), 1);
  // The candle-head: a thick wax stub, one hollow eye, a cratered top.
  const kx = cx + 1, ky0 = 10 + B, ky1 = 22 + B;
  S.add(capsule([kx, ky1, 0.5], [kx, ky0 + 2.2, 0.5], 3.6, 3.3, 'wax'), 0.8);
  S.add(torus([kx, ky0 + 1.9, 0.5], 2.6, 1, 1.45, 'wax'), 0.8);
  S.sub(ellipsoid([kx, ky0 + 1.2, 0.5], [1.9, 1.1, 1.9], 'waxDark'), 0.5);
  for (const [dx, len, z] of [[-2, 3.4, 2.6], [1.4, 6, 3.1], [3.1, 2.6, 1.6], [-0.4, 8, 3.4]]) S.add(capsule([kx + dx, ky0 + 2.4, z], [kx + dx, ky0 + 2.4 + len, z + 0.15], 0.75, 1.05, 'wax'), 0.6);
  // Wax runs over the shoulders.
  S.paint({ f: (x, y, z) => (y < 24.6 + B + 1.3 * noise3(x * 0.9, 3, z * 0.9) && y > 21 + B && Math.abs(x - cx) < 4.2 ? -1 : 1), mat: 'wax' });
  S.sub(ellipsoid([kx + 2, ky0 + 5.2, 3.4], [1.5, 1.9, 1.7], 'hollow'), 0.4);
  // Sleeves; the throwing hand holds a glob of burning wax.
  const hand = atk === 0 ? [cx - 5.5, 18 + B, -2] : atk === 1 ? [cx + 11, 26, 3.5] : [cx + 6.4, 33 + B + s * 0.5, 3.4];
  const elbow = atk === 0 ? [cx - 3.5, 23, -0.5] : atk === 1 ? [cx + 7, 25.5, 3.4] : [cx + 5.2, 29.5 + B, 3.2];
  limb(S, [cx + 3.4, 26 + B, 2.2], elbow, hand, 1.9, 1.8, 2, 'mourn', 1.2);
  S.add(sphere(hand, 1.4, 'waxDark'), 0.5);
  if (atk >= 0) S.add(sphere([hand[0] + (atk ? 1.6 : 0), hand[1] - 2, hand[2]], 2.1, 'ember'), 0);
  limb(S, [cx - 3, 26 + B, -2.2], [cx - 4.4, 31 + B, -2.4], [cx - 2.4, 34 + B, -1.4], 1.8, 1.8, 1.9, 'mournDark', 1);
  // Green candle flame on its wick.
  const fl = -0.4 + odd(t);
  S.add(ellipsoid([kx + 0.2, ky0 - 1.8 + fl * 0.3, 0.5], [1.4, 2.5 + fl * 0.3, 1.3], 'flame'), 0);
  const f = R(S, w, h, gy);
  D(f, kx, ky0, 'ink2');
  D(f, kx, ky0 - 3.2 + fl, 'flame0'); D(f, kx, ky0 - 2.2, 'flame0');
  eye(f, kx + 2.2, ky0 + 4.8, 'flame0', 'flame2');
  return A(f, cx, gy);
}

// ============================================================== acolyte ===
// A robed skeleton with a ribcage laid bare, a skull, and a staff whose
// green flame fires bone shards.
function acolyte(t = 0, atk = -1) {
  const S = new Scene(), w = 40, h = 52, gy = 49, cx = 18;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  // Robe from the waist down.
  S.add(ragged(folds(skirt(cx, 29 + B, gy - 0.5, 4.4, 7.6, 0, 0.85, 'robeSlate'), { cx, n: 7, amp: 0.55, y0: 30, y1: gy, phase: t * 0.7 }), gy - 1.2, 1.2, 0.9, 7), 0);
  // Cowled mantle draped over the shoulders, open at the chest.
  S.add(folds(skirt(cx, 19 + B, 30 + B, 4.4, 6.4, 0, 0.8, 'robeSlate'), { cx, n: 6, amp: 0.4, y0: 20, y1: 30 }), 1);
  S.sub(ellipsoid([cx + 3.4, 25 + B, 4], [2.6, 5, 3], 'hollow'), 0.8);
  // Ribcage and spine in the opening.
  for (let i = 0; i < 4; i++) S.add(capsule([cx + 1, 21.6 + i * 1.6 + B, 1.4], [cx + 4.6 - i * 0.2, 22.4 + i * 1.6 + B, 3.3], 0.5, 0.5, 'bone'), 0.3);
  // Arms: bone forearms out of the sleeves.
  const staffHand = atk === 0 ? [cx + 5, 17 + B, 3.6] : atk === 1 ? [cx + 9, 23, 3.6] : [cx + 6, 28 + B, 3.6];
  limb(S, [cx + 3.6, 20.5 + B, 2.6], [cx + 5, 24.5 + B, 3.2], [staffHand[0] - 1.6, staffHand[1] + 0.5, 3.3], 2.1, 1.9, 1.6, 'robeSlate', 1.2);
  S.add(capsule([staffHand[0] - 1.6, staffHand[1] + 0.5, 3.3], staffHand, 0.7, 0.65, 'bone'), 0.5);
  S.add(sphere(staffHand, 1.1, 'bone'), 0.4);
  limb(S, [cx - 3.2, 20.5 + B, -2.4], [cx - 4.4, 25.5 + B, -2.6], [cx - 3.6, 29 + B, -2], 2, 1.8, 1.6, 'robeSlateDark', 1);
  // The staff: crooked wood with a bone crook holding the flame.
  const tilt = atk === 1 ? 0.5 : atk === 0 ? -0.1 : 0.06 * s;
  const top = [staffHand[0] + sin(tilt) * 13, staffHand[1] - cos(tilt) * 13, 3.8], bot = [staffHand[0] - sin(tilt) * 13, Math.min(gy - 1, staffHand[1] + cos(tilt) * 13), 3.8];
  S.add(capsule(bot, top, 0.75, 0.8, 'wood'), 0);
  S.add(torus([top[0], top[1] - 1.8, 3.8], 1.8, 0.55, 1.57, 'bone'), 0.4);
  const orb = [top[0], top[1] - 2, 3.8];
  S.add(sphere(orb, atk === 0 ? 2.1 : 1.5, 'flame'), 0);
  // Skull.
  const hx = cx + 1.4, hy = 14 + B + (atk === 1 ? 1 : 0);
  S.add(capsule([cx, 20 + B, 0], [hx, hy + 2, 0.4], 1.4, 1.2, 'bone'), 0.6);
  S.add(sphere([hx, hy - 0.4, 0.5], 4.3, 'bone'), 0.5);
  S.add(ellipsoid([hx + 1.8, hy + 2.8, 1], [2.4, 1.6, 2.4], 'bone'), 0.9);
  S.sub(sphere([hx + 2.4, hy - 0.2, 3.9], 1.5, 'hollow'), 0.5);
  S.sub(sphere([hx + 4.5, hy, 2.4], 1.2, 'hollow'), 0.4);
  // Hood framing the skull from behind.
  S.add(clip(sphere([hx - 0.8, hy - 0.8, -0.2], 5.2, 'robeSlateDark'), (x, y, z) => -(-z - 0.8 + (x - hx) * 0.5)), 0.8);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.4, hy - 0.4, 'flame0', 'flame2'); D(f, hx + 4.4, hy - 0.2, 'flame1');
  for (let k = 0; k < 3; k++) D(f, hx + 1.4 + k * 1.2, hy + 3.4, k % 2 ? 'bone4' : 'bone1');
  D(f, orb[0], orb[1] - (atk === 0 ? 2.6 : 2), 'flame0');
  return A(f, cx, gy);
}

// ========================================================== gravewarden ===
// A squat crypt guard in battered plate under a crimson tabard, behind a
// tall tower shield with a gilt cross.
function gravewarden(t = 0, atk = -1) {
  const S = new Scene(), w = 50, h = 52, gy = 49, cx = 20;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  const lean = atk === 0 ? -2 : atk === 1 ? 3.5 : 0, push = atk === 1 ? 5 : atk === 0 ? -1.5 : 0;
  // Armoured legs: thigh plate, greave, sabaton.
  const G = gaitL(t, 3, 1.8);
  for (const [side, sw, up] of [[-1, atk >= 0 ? (atk ? -3 : -1) : G[0].x, atk >= 0 ? 0 : G[0].up], [1, atk >= 0 ? (atk ? 3 : 1) : G[1].x, atk >= 0 ? 0 : G[1].up]]) {
    const z = side * 2.6, hip = [cx + side * 0.4, 35 + B, z];
    const knee = [cx + sw * 0.55 + 0.8 + up * 0.4, 41 + B * 0.5 - up * 0.5, z + 0.6], foot = [cx + sw, gy - 1.6 - up, z];
    limb(S, hip, knee, foot, 2.9, 2.6, 2.3, 'plate', 0.9, 'plateDark');
    S.add(sphere(knee, 2.5, 'plate'), 0.6);
    S.add(ellipsoid([foot[0] + 1.5, gy - 1.2 - up, z], [3.3, 1.5, 2.4], 'plateDark'), 0.6);
  }
  // Torso: a barrel breastplate and the tabard.
  const tx = cx + lean * 0.5, ty = 27 + B;
  S.add(rotZ(ellipsoid([tx, ty, 0], [6.4, 7, 4.8], 'plate'), [tx, ty + 6], lean * 0.04), 0);
  S.add(ragged(folds(skirt(tx + 0.3, 32 + B, 41.5 + B, 6, 7, 0, 1, 'red'), { cx: tx, n: 7, amp: 0.45, y0: 33, y1: 42 }), 40.5 + B, 1, 1.1, 3), 1.2);
  S.paint({ f: (x, y, z) => Math.abs(y - (32.4 + B)) - 0.9 + (z > 5.2 ? 9 : 0), mat: 'leather' });
  // Pauldrons.
  S.add(ellipsoid([tx - 4.4, ty - 4.4, -1.6], [3.6, 3, 3.4], 'plate'), 1.2);
  S.add(ellipsoid([tx + 4.4, ty - 4.4, 1.8], [3.6, 3, 3.4], 'plate'), 1.2);
  // Back arm with a short mace held low.
  limb(S, [tx - 5, ty - 3, -2.6], [tx - 6.6, ty + 2, -3], [tx - 5.6, ty + 6, -2.6], 2.2, 2, 1.9, 'plateDark', 1);
  // Helm: a great bucket helm with a crenellated crest and a visor slit.
  const hx = tx + 1.4 + lean * 0.3, hy = ty - 11;
  S.add(capsule([hx, hy + 3.4, 0.4], [hx, hy - 0.6, 0.4], 4.6, 4.5, 'plate'), 1.4);
  S.add(ellipsoid([hx, hy - 1.6, 0.4], [5, 1.5, 4.7], 'plate'), 0.5);
  for (const dx of [-3.4, 0.1, 3.6]) S.add(box([hx + dx, hy - 4.2, 0.4 + dx * 0.25], [0.95, 1.8, 0.95], 0.2, 'plate'), 0.2);
  S.sub(box([hx + 3.2, hy + 0.8, 3.4], [2.6, 0.55, 2.2], 0.2, 'hollow'), 0.3);
  S.sub(box([hx + 4.4, hy + 2.6, 3.4], [0.4, 1.4, 2.2], 0.2, 'hollow'), 0.2);
  S.paint({ f: (x, y, z) => Math.abs(y - (hy + 3.6)) - 0.5 + (z < 0 ? 9 : 0), mat: 'gold' });
  // Shield arm and the tower shield, carried in front.
  const shX = tx + 9.5 + push, shY = ty + 4;
  limb(S, [tx + 5, ty - 3, 2.6], [tx + 6.5, ty + 1.5, 4], [shX - 2, shY - 2, 5], 2.2, 2, 1.8, 'plate', 1);
  // Slightly convex face: a box intersected with a big sphere.
  const sb = box([shX, shY, 6.6], [4.8, 12.4, 1.6], 0.7, 'shieldFace'), bulge = [shX - 14, shY, 6.6 - 2];
  const shield = rotZ({ ...sb, f: (x, y, z) => Math.max(sb.f(x, y, z), Math.hypot(x - bulge[0], (y - bulge[1]) * 0.35, z - bulge[2]) - 18.6) }, [shX, shY], lean * 0.035);
  S.add(shield, 0);
  const onFace = (x, y, z) => z > 6.2 && shield.f(x, y, z) < 0.4;
  S.paint({ f: (x, y, z) => (onFace(x, y, z) && (Math.abs(x - shX) > 3.8 || Math.abs(y - shY) > 11.3) ? -1 : 1), mat: 'gold' });
  S.paint({ f: (x, y, z) => (onFace(x, y, z) ? Math.min(Math.max(Math.abs(x - shX - 0.5) - 1, Math.abs(y - shY + 0.5) - 7.6), Math.max(Math.abs(x - shX - 0.5) - 3.4, Math.abs(y - shY + 3.6) - 1)) : 1), mat: 'gold' });
  const f = R(S, w, h, gy);
  // Two embers behind the visor; rivets on the shield rim.
  eye(f, hx + 2.2, hy + 0.2, 'ember0', null); D(f, hx + 4, hy + 0.2, 'ember1');
  for (const dy of [-9.6, 9.6]) for (const dx of [-2.4, 3.2]) D(f, shX + dx, shY + dy, 'iron0');
  return A(f, cx, gy);
}

// ================================================================= rat ===
function rat(t = 0, atk = -1) {
  const S = new Scene(), w = 22, h = 14, gy = 12;
  const s = sin(ph(t)), B = 0, lunge = atk === 1 ? 2.5 : atk === 0 ? -1 : 0;
  const bx = 9 + lunge * 0.4, by = 8 + B;
  S.add(bumpy(ellipsoid([bx, by, 0], [4.9, 2.9, 2.8], 'fur'), 0.2, 1, 2), 0);
  S.add(sphere([bx - 2.5, by - 0.6, 0], 2.6, 'fur'), 1.4);
  // Head: a pointed snout.
  const hx = bx + 4.4 + lunge * 0.6, hy = by - 0.6 - (atk === 0 ? 1 : 0);
  S.add(capsule([hx - 1, hy, 0.3], [hx + 2.6, hy + 0.9, 0.3], 2.1, 0.9, 'fur'), 1.2);
  S.add(sphere([hx + 3.1, hy + 1, 0.3], 0.7, 'pink'), 0.3);
  S.add(ellipsoid([hx - 0.8, hy - 2.1, -0.4], [1.1, 1.3, 0.6], 'pink'), 0.4);
  // Legs: little scrabbling paws.
  for (const [lx, p] of [[bx - 2.6, 0], [bx + 2.6, PI]]) for (const z of [-1.4, 1.4]) {
    const o = atk >= 0 ? 0 : sin(ph(t) + p + (z > 0 ? PI : 0)) * 1.2;
    S.add(capsule([lx, by + 1.6, z], [lx + o, gy - 0.5, z], 0.8, 0.55, z > 0 ? 'fur' : 'ragDark'), 0.5);
  }
  const f = R(S, w, h, gy);
  // Tail as a curling line.
  const tw = atk >= 0 ? 0 : s;
  pline(f, bx - 5, by + 0.5, bx - 7, by + 1 + tw, 'skin2'); pline(f, bx - 7, by + 1 + tw, bx - 9, by - 0.5 + tw, 'skin3');
  D(f, hx + 0.6, hy - 0.4, 'blood0');
  if (atk === 1) { D(f, hx + 2.4, hy + 2, 'bone0'); }
  return A(f, 9, gy);
}

// ============================================================== votary ===
// A swollen cultist in a sackcloth cowl, its stitched belly glowing; on the
// attack it swells and the wound burns red.
function votary(t = 0, atk = -1) {
  const S = new Scene(), w = 44, h = 48, gy = 45, cx = 20;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2, sw = atk === 0 ? 1.3 : atk === 1 ? 2.6 : 0;
  const roll = atk >= 0 ? 0 : s * 0.06;
  // Stubby legs.
  const G = gaitL(t, 2, 1.2);
  for (const [side, o, up] of [[-1, atk >= 0 ? 0 : G[0].x, atk >= 0 ? 0 : G[0].up], [1, atk >= 0 ? 0 : G[1].x, atk >= 0 ? 0 : G[1].up]]) {
    const z = side * 3.4;
    S.add(capsule([cx + side * 1.2, 35, z], [cx + side * 1.6 + o, gy - 1.6 - up, z], 3, 2.5, side > 0 ? 'bloat' : 'fleshDark'), 1);
    S.add(ellipsoid([cx + side * 1.6 + o + 1, gy - 1.1 - up, z], [2.7, 1.3, 2.1], 'fleshDark'), 0.8);
  }
  // The belly: one huge mass with a sagging lower fold.
  const bx = cx + 0.5, by = 29 + B;
  S.add(bumpy(rotZ(ellipsoid([bx, by, 0], [10 + sw, 9.2 + sw, 8.6 + sw], 'bloat'), [bx, by], roll), 0.35, 0.45, 11), 0);
  S.add(ellipsoid([bx + 1, by + 7 + sw * 0.4, 1.8], [8 + sw * 0.6, 3.4, 6.4], 'bloat'), 1.6);
  // The wound: a stitched seam, swollen and glowing.
  const wx = bx + 4.2 + sw * 0.4, wz = 7;
  S.paint({ f: (x, y, z) => (z > 4 ? Math.hypot((x - wx) / (2 + sw * 0.5), (y - by) / (5 + sw * 0.5)) - 1 : 1), mat: atk >= 0 ? 'bellyHot' : 'belly' });
  S.paint({ f: (x, y, z) => (z > 4 ? Math.hypot((x - wx) / (1 + sw * 0.3), (y - by) / (4.2 + sw * 0.4)) - 1 : 1), mat: atk >= 0 ? 'ember' : 'flame' });
  // Rope belt cutting into the gut.
  S.paint({ f: (x, y, z) => Math.abs(y - (by + 5.4 + (x - bx) * 0.1)) - 0.6 + (z < 0 ? 9 : 0), mat: 'rope' });
  // Arms hanging off the sides.
  limb(S, [bx + 5.5, by - 6.5, 4], [bx + 9.4 + sw, by - 1.5, 5], [bx + 9 + sw, by + 3.6 + s * 0.6, 5.4], 2.4, 2.1, 1.9, 'bloat', 1.2);
  S.add(sphere([bx + 9 + sw, by + 4.4 + s * 0.6, 5.4], 2, 'bloat'), 0.6);
  limb(S, [bx - 6, by - 6, -4], [bx - 9.4 - sw, by - 1, -4.6], [bx - 8.4 - sw, by + 4, -4.4], 2.2, 2, 1.8, 'fleshDark', 1);
  // Head: small, jowly, pushed forward on the shoulders, under a cowl.
  const hx = bx + 4, hy = by - 13.2 - sw * 0.5;
  S.add(bumpy(sphere([hx, hy + 0.4, 1.2], 4, 'bloat'), 0.25, 0.9, 4), 1.6);
  S.add(ellipsoid([hx + 1.2, hy + 3.4, 1.6], [3.6, 1.8, 3.2], 'bloat'), 1.2);
  S.sub(sphere([hx + 2.4, hy - 0.1, 4.4], 1, 'hollow'), 0.3);
  S.sub(sphere([hx + 4.1, hy + 0.1, 2.8], 0.85, 'hollow'), 0.3);
  S.sub(ellipsoid([hx + 3, hy + 2.6, 3.6], [1.3, atk >= 0 ? 1.1 : 0.5, 1.5], 'gum'), 0.3);
  const cowl = clip(sphere([hx - 1, hy - 0.8, 0.4], 4.9, 'sack'), (x, y, z) => (x - (hx + 0.2)) + (y - hy) * 0.4);
  S.add(cowl, 0.8);
  S.add(folds(ellipsoid([bx + 0.5, by - 8.2 - sw * 0.5, 0], [7.6, 3, 6.4], 'sack'), { cx: bx, n: 9, amp: 0.4, y0: by - 11, y1: by - 5 }), 1.4);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.4, hy - 0.4, 'flame0', null); eye(f, hx + 4, hy - 0.2, 'flame1', null);
  // Stitches across the wound.
  for (let k = -2; k <= 2; k++) { const y = by + k * 2.1; D(f, wx - 1.5, y, 'ink1'); D(f, wx + 1.2, y + 0.5, 'ink1'); D(f, wx - 0.5, y + 0.3, 'bone1'); D(f, wx + 0.4, y + 0.4, 'bone1'); }
  if (atk === 1) for (const [dx, dy] of [[-4, -6], [7, -2], [-6, 4], [6, 7]]) D(f, bx + dx, by + dy, 'blood0');
  return A(f, cx, gy);
}

// =========================================================== flagellant ===
// A gaunt bare penitent in a sack hood, back raw from the scourge.
function flagellant(t = 0, atk = -1) {
  const S = new Scene(), w = 48, h = 54, gy = 51, cx = 18;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  const lean = atk === 0 ? -1.5 : atk === 1 ? 2.5 : 1;
  // Legs: bare, sinewy.
  const G = gaitL(t, 3.4, 1.8);
  for (const [side, sw, up] of [[-1, atk >= 0 ? -2.5 : G[0].x, atk >= 0 ? 0 : G[0].up], [1, atk >= 0 ? 3 : G[1].x, atk >= 0 ? 0 : G[1].up]]) {
    const z = side * 1.7, hip = [cx + side * 0.3, 34 + B, z];
    const knee = [cx + sw * 0.6 + 1 + up * 0.4, 41.5 - up * 0.5, z + 0.5], foot = [cx + sw, gy - 1.3 - up, z];
    limb(S, hip, knee, foot, 2.1, 1.7, 1.4, side > 0 ? 'bare' : 'skin', 0.9);
    S.add(ellipsoid([foot[0] + 1.3, gy - 0.9 - up, z], [2.3, 1, 1.4], 'bare'), 0.6);
  }
  // Loincloth.
  S.add(ragged(folds(skirt(cx + 0.3, 31 + B, 38 + B, 3.8, 4.8, 0, 0.9, 'rag'), { cx, n: 5, amp: 0.4, y0: 31, y1: 38 }), 37 + B, 1.2, 1, 6), 1);
  // Gaunt torso, ribs showing, tipping forward.
  const tx = cx + lean * 0.5, ty = 25 + B;
  S.add(rotZ(ellipsoid([tx, ty, 0], [4.2, 6.6, 3.2], 'bare'), [tx, ty + 6], 0.1 + lean * 0.04), 0);
  S.add(ellipsoid([tx - 0.4, ty - 4, 0], [5.2, 2.6, 3.4], 'bare'), 1.6);
  // Wounds: lash marks across the back and side.
  for (let i = 0; i < 3; i++) S.paint({ f: (x, y, z) => (x < tx - 0.5 ? Math.abs((y - (ty - 3 + i * 3.2)) + (x - tx) * 0.55) - 0.75 : 1), mat: 'lash' });
  // Chain wound round the waist.
  S.paint({ f: (x, y) => Math.abs(y - (31 + B)) - 0.6, mat: 'iron' });
  // Arms: the scourge hand and the back hand.
  const hand = atk === 0 ? [tx - 4, ty - 12, 2.6] : atk === 1 ? [tx + 11, ty + 1, 3.2] : [tx + 5.5, ty + 5 + s * 0.6, 3];
  const elbow = atk === 0 ? [tx + 1, ty - 9, 3] : atk === 1 ? [tx + 6.5, ty - 2, 3.2] : [tx + 4.6, ty + 0.6, 3];
  limb(S, [tx + 3, ty - 4.4, 2.4], elbow, hand, 1.7, 1.4, 1.2, 'bare', 1);
  S.add(sphere(hand, 1.4, 'bare'), 0.5);
  limb(S, [tx - 3, ty - 4.4, -2.4], [tx - 4.6, ty + 0.5, -2.6], [tx - 2.6, ty + 4.6, -1.6], 1.6, 1.3, 1.2, 'skin', 1);
  // Sack hood with eye holes, cinched with rope.
  const hx = tx + 2 + lean * 0.3, hy = ty - 10;
  S.add(capsule([tx + 0.6, ty - 5, 0], [hx - 0.6, hy + 2, 0.4], 2, 2.2, 'bare'), 1.2);
  S.add(bumpy(ellipsoid([hx, hy - 0.4, 0.5], [4.3, 4.8, 4.1], 'sack'), 0.3, 0.7, 2), 1);
  S.add(capsule([hx - 1, hy - 4, -0.4], [hx - 3.4, hy - 7, -1.4], 2.4, 0.9, 'sack'), 1.4);
  S.paint({ f: (x, y) => Math.abs(y - (hy + 3.4)) - 0.55, mat: 'rope' });
  S.sub(sphere([hx + 2.4, hy - 0.4, 3.9], 1.05, 'hollow'), 0.3);
  S.sub(sphere([hx + 3.9, hy - 0.2, 2.6], 0.9, 'hollow'), 0.3);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.4, hy - 0.6, 'bone0', null); D(f, hx + 3.9, hy - 0.4, 'bone2');
  // The scourge: three knotted cords.
  const cords = atk === 0 ? [[-3, -6], [-5, -3], [-6, 1]] : atk === 1 ? [[9, 4], [10, 6.5], [8, 8.5]] : [[0, 8], [1.5, 9], [-1.5, 8.5]];
  for (const [dx, dy] of cords) { const ex = hand[0] + dx, ey = hand[1] + dy; pline(f, hand[0] + 0.5, hand[1] + 0.5, ex, ey, 'crimson3'); D(f, ex, ey, 'blood1'); D(f, (hand[0] + ex) / 2, (hand[1] + ey) / 2, 'blood2'); }
  return A(f, cx, gy);
}
MM.skin = { ramp: 'skin', spec: 0.08, bias: -0.1 };

// =============================================================== cherub ===
// A weeping stone cherub borne on pale marble wings, cracked gilt halo,
// tears of light running from blind eyes.
function cherub(t = 0, atk = -1) {
  const S = new Scene(), w = 50, h = 46, gy = 44, cx = 24;
  const flap = atk >= 0 ? (atk === 0 ? -1 : 0.5) : cyc([-1, -0.2, 1, -0.2], t), B = atk >= 0 ? 0 : (cyc([0, 0.5, 1, 0.5], t) > 0.5 ? 2 : 0);
  // Wings: broad flattened fans behind the shoulders, scalloped edge.
  for (const side of [-1, 1]) {
    const z = side > 0 ? -1 : -3.4, root = [cx - 1 + side * 1.6, 17.5 + B, z];
    const up = -0.7 - flap * 0.45;
    const tipA = [root[0] + side * 9.5, root[1] - 7 * -up + -6, z - 0.4], mat = side > 0 ? 'wing' : 'wingDark';
    const tip = [root[0] + side * 10, root[1] + up * 7 - 2, z - 0.6];
    S.add(capsule(root, tip, 2.4, 1.6, mat), 1);
    for (let k = 0; k < 4; k++) {
      const a = [tip[0] - side * k * 1.6, tip[1] + 1 + k * 0.4, z - 0.6], b = [root[0] + side * (5.4 - k * 1.1), root[1] + 6.5 + k * 0.6 - flap * 1.2, z - 0.8];
      S.add(capsule(a, b, 1.7, 1.1, mat), 0.9);
    }
    void tipA;
  }
  // Plump body, little legs tucked up.
  const bx = cx, by = 24 + B;
  S.add(ellipsoid([bx, by, 0], [4.5, 5, 3.9], 'marble'), 0);
  S.add(ellipsoid([bx + 0.3, by + 4, 0.2], [4.3, 3.1, 3.6], 'marble'), 1.6);
  S.add(capsule([bx + 1.6, by + 6, 2.2], [bx + 4.4, by + 8.6, 2], 1.9, 1.5, 'marble'), 1);
  S.add(capsule([bx - 0.8, by + 6.4, -2], [bx + 1.2, by + 9.2, -2], 1.8, 1.4, 'marbleDark'), 1);
  // Arms: hands raised to the face (weeping), flung out to cast.
  const handF = atk === 1 ? [bx + 8.6, by - 1.4, 3] : atk === 0 ? [bx + 2.6, by - 7, 4.4] : [bx + 4, by - 5.4, 4.6];
  limb(S, [bx + 3, by - 2.6, 2.4], [bx + 5.2, by + 0.4, 3.4], handF, 1.7, 1.5, 1.4, 'marble', 1);
  S.add(sphere(handF, 1.45, 'marble'), 0.5);
  // Big infant head on a short neck crease.
  const hx = bx + 1.2, hy = by - 10.2;
  S.add(sphere([hx, hy, 0.5], 5.6, 'marble'), 0.9);
  S.add(sphere([hx + 3.4, hy + 2.4, 2.8], 2.1, 'marble'), 1);
  for (const [dx, dy] of [[-3.4, -3.6], [-0.4, -5.2], [-4.6, -0.4], [2.4, -4.4]]) S.add(sphere([hx + dx, hy + dy, 0.4], 1.9, 'marble'), 0.5);
  S.sub(sphere([hx + 2.6, hy - 0.4, 5.6], 1.35, 'hollow'), 0.3);
  S.sub(sphere([hx + 5.4, hy - 0.2, 2.8], 1.1, 'hollow'), 0.3);
  S.add(sphere([hx + 5.4, hy + 1.6, 2.6], 1, 'marble'), 0.5);
  if (atk >= 0) S.sub(ellipsoid([hx + 4.2, hy + 3, 3.6], [1.1, atk ? 1.4 : 0.8, 1.6], 'hollow'), 0.3);
  // Cracked gilt halo.
  S.add(torus([hx - 0.8, hy - 8.4, 0], 4, 0.75, 0.42, 'halo'), 0);
  S.sub(sphere([hx + 2.8, hy - 8.4, 1.8], 0.9), 0);
  const f = R(S, w, h, gy, { contourDepth: 4, contrast: 1.6 });
  D(f, hx + 2.6, hy - 0.4, 'holy0'); D(f, hx + 5.2, hy - 0.2, 'holy1');
  // Tear tracks running down the cheeks.
  for (let k = 1; k <= (atk >= 0 ? 5 : 4); k++) D(f, hx + 2.6 + (k > 3 ? 0.6 : 0), hy + k - 0.3, k % 2 ? 'holy1' : 'holy3');
  D(f, hx + 5, hy + 1.2, 'holy2');
  return A(f, cx, gy);
}

// ================================================================= wisp ===
// A blue choir-spirit: a guttering soul-flame with hollow eyes and a mouth
// open in an endless note.
function wisp(t = 0, atk = -1) {
  const S = new Scene(), w = 32, h = 40, gy = 37, cx = 15;
  const bob = atk >= 0 ? 0 : Math.round(sin(ph(t))) * 2, stretch = atk === 1 ? 5 : atk === 0 ? -1.5 : 0;
  const hx = cx + 1 + stretch * 0.6, hy = 14 + bob;
  // Bulb and a tail that whips behind it.
  S.add(sphere([hx, hy, 0], 6.2, 'spirit'), 0);
  const sway = atk >= 0 ? -stretch * 0.6 : sin(ph(t) + 1) * 2;
  const tail = [[hx - 1.6, hy + 6.5, 0], [hx - 4 + sway * 0.5, hy + 12, -0.5], [hx - 2.5 + sway, hy + 18, -1]];
  S.add(capsule([hx, hy + 2, 0], tail[0], 4.6, 3.6, 'spirit'), 1.6);
  S.add(capsule(tail[0], tail[1], 3.6, 2.2, 'spiritDeep'), 1.4);
  S.add(capsule(tail[1], tail[2], 2.4, 0.5, 'spiritDeep'), 1);
  // Flame licks streaming off the crown.
  const lick = odd(t) * 0.8;
  for (const [dx, L, z] of [[-3.8, 4 + lick, -1], [-1, 6.5 - lick, 0.5], [1.8, 4 + lick, 1]]) S.add(capsule([hx + dx, hy - 3.4, z], [hx + dx - 3.6 - stretch * 0.4, hy - 3.4 - L, z], 1.9, 0.4, 'spirit'), 1.2);
  // Face: two sunken eyes and a round singing mouth.
  S.sub(ellipsoid([hx + 1.6, hy - 0.6, 5.6], [1.3, 1.7, 1.6], 'hollow'), 0.5);
  S.sub(ellipsoid([hx + 4.6, hy - 0.4, 3.8], [1.1, 1.6, 1.6], 'hollow'), 0.5);
  S.sub(ellipsoid([hx + 3.4, hy + 3.2, 5], [1.1, atk === 1 ? 1.9 : 1.3, 1.6], 'hollow'), 0.5);
  const f = R(S, w, h, gy, { contourDepth: 7 });
  D(f, hx + 1.6, hy - 0.8, 'holy0'); D(f, hx + 4.6, hy - 0.6, 'holy1');
  // Sparks shed from the tail.
  if (atk < 0) { D(f, tail[2][0] - 2 + t, tail[2][1] - 4 + odd(t), 'holy1'); D(f, tail[1][0] - 4, tail[1][1] + Math.floor(t) % 3, 'holy2'); }
  return A(f, cx, gy);
}

// ========================================================== silt wretch ===
// (Stratum II) A drowned penitent crawled up out of the flooded nave, hair and
// rags gone to waterweed, skin gone grey-green; it drags itself on long arms.
function siltWretch(t = 0, atk = -1) {
  const S = new Scene(), w = 44, h = 44, gy = 41, cx = 18;
  const s = sin(ph(t)), B = atk >= 0 ? 0 : bobAt(t) - 2;
  const lean = atk === 0 ? -2 : atk === 1 ? 4 : 1;
  const G = gaitL(t, 2.6, 1.4);
  for (const [side, sw, up] of [[-1, atk >= 0 ? -2 : G[0].x, atk >= 0 ? 0 : G[0].up], [1, atk >= 0 ? 2 : G[1].x, atk >= 0 ? 0 : G[1].up]]) {
    const z = side * 2, hip = [cx + side * 0.4, 29 + B, z];
    limb(S, hip, [cx + sw * 0.6 + 1.5, 35 - up * 0.5, z + 0.5], [cx + sw, gy - 1.3 - up, z], 2, 1.6, 1.4, 'fleshDark', 0.9);
    S.add(ellipsoid([cx + sw + 1.2, gy - 0.9 - up, z], [2.4, 1.1, 1.6], 'fleshDark'), 0.7);
  }
  // A hunched, waterlogged trunk.
  const tx = cx + 1.5 + lean * 0.6, ty = 22 + B;
  S.add(bumpy(rotZ(ellipsoid([tx, ty, 0], [5.4, 7.2, 4.4], 'silt'), [tx, ty + 5], 0.5 + lean * 0.05), 0.4, 0.6, 7), 0);
  // Waterweed hanging from the shoulders and head in long strands.
  for (let k = 0; k < 7; k++) { const a = -1.2 + k * 0.4, x0 = tx + Math.sin(a) * 4.6, z0 = Math.cos(a) * 3.6; S.add(capsule([x0, ty - 5, z0], [x0 - 0.8 + (k % 2), ty + 7 + (k % 3) * 2, z0 + 0.4], 1.3, 0.7, 'weed'), 0.6); }
  // Long arms reaching (strike: a lunging grab).
  const reach = atk === 0 ? [[tx - 2, ty - 8, 3.4], [tx - 5, ty - 12, 3.6]] : atk === 1 ? [[tx + 8, ty + 1, 3.4], [tx + 15, ty + 3, 3.4]] : [[tx + 7, ty + 1 + s, 3.2], [tx + 12, ty + 4 + s, 3.2]];
  limb(S, [tx + 2, ty - 4, 2.6], reach[0], reach[1], 1.9, 1.5, 1.3, 'silt', 1.1);
  for (let k = 0; k < 3; k++) S.add(capsule(reach[1], [reach[1][0] + 2.4 - k * 0.6, reach[1][1] + 1.8 + k * 0.8, 3.4], 0.6, 0.3, 'boneDark'), 0.4);
  limb(S, [tx - 2, ty - 4, -2.6], [tx + 4, ty + 2 - s, -3], [tx + 8, ty + 5 - s, -3], 1.7, 1.4, 1.2, 'fleshDark', 1);
  // The head, slumped low and veiled in weed; one eye shows.
  const hx = tx + 5.5 + lean * 0.4, hy = ty - 6 + (atk === 1 ? 2 : 0);
  S.add(capsule([tx + 2, ty - 4, 0], [hx - 1, hy + 1, 0.6], 2.4, 2.2, 'silt'), 1.4);
  S.add(bumpy(sphere([hx, hy, 0.8], 4, 'silt'), 0.3, 0.8, 4), 1.2);
  S.add(clip(sphere([hx - 1, hy - 1, 0], 4.6, 'weed'), (x, y, z) => (x - (hx + 1.6)) + (y - hy) * 0.2), 0.8);
  S.sub(ellipsoid([hx + 3.4, hy + 2.4, 2], [1.4, atk === 1 ? 1.4 : 0.8, 2], 'gum'), 0.4);
  const f = R(S, w, h, gy);
  eye(f, hx + 2.6, hy - 0.6, 'holy0', 'holy2');
  // Drips off the weed.
  if (atk < 0) { D(f, tx - 3, ty + 10 + Math.floor(t * 2) % 3, 'holy2'); D(f, tx + 4, ty + 12 + Math.floor(t * 2 + 1) % 3, 'holy3'); }
  return A(f, cx, gy);
}

// ============================================================= nave eel ===
// (Stratum II) A blind eel as long as a pew that swims the flooded aisles; it
// rears its head before it strikes.
function naveEel(t = 0, atk = -1) {
  const S = new Scene(), w = 50, h = 34, gy = 31;
  const rear = atk === 0 ? 7 : atk === 1 ? 2 : 0, lunge = atk === 1 ? 6 : 0;
  // The body: a chain of segments on a travelling wave.
  const segs = [];
  for (let i = 0; i < 9; i++) { const u = i / 8, x = 34 - u * 30 + lunge * (1 - u), y = gy - 4 - (atk >= 0 ? rear * Math.max(0, 1 - u * 2.5) : 0) + sin(u * 6 - ph(t) * 2) * (1.6 * u + 0.4), z = cos(u * 5 - ph(t)) * 1.5; segs.push([x, y - 1, z, 5 - u * 3]); }
  for (let i = 0; i < segs.length - 1; i++) S.add(capsule(segs[i], segs[i + 1], segs[i][3], segs[i + 1][3], i % 2 ? 'eel' : 'eelDark'), 1.2);
  // Pale belly and a ragged fin along the back.
  S.paint({ mat: 'wax', f: (x, y, z) => -(y - (gy - 3.6)) + (z < 0 ? 9 : 0) });
  for (let i = 1; i < 7; i++) { const [x, y, z, r] = segs[i]; S.add(capsule([x, y - r + 0.5, z], [x - 1.8, y - r - 3, z], 1.2, 0.4, 'eelDark'), 0.4); }
  // The head: a blunt wedge with a long underslung jaw.
  const [hx, hy] = segs[0], open = atk === 1 ? 3 : atk === 0 ? 1.4 : 0.6;
  S.add(ellipsoid([hx + 4, hy - 0.6, 0.4], [6.4, 4.4, 4], 'eel'), 1.2);
  S.add(ellipsoid([hx + 5, hy + 2.6 + open * 0.6, 0.4], [5.4, 1.8, 3.2], 'eelDark'), 0.8);
  S.sub(ellipsoid([hx + 8, hy + 1.4 + open * 0.3, 1.6], [3, open * 0.7 + 0.5, 2.4], 'gum'), 0.4);
  const f = R(S, w, h, gy);
  // Pale blind eyes and needle teeth.
  D(f, hx + 5, hy - 2.4, 'bone0');
  if (open > 1) for (let k = 0; k < 3; k++) D(f, hx + 6 + k * 2, hy + 1, 'bone1');
  return A(f, 22, gy);
}

// ================================================================ export ===
const walk = (fn) => () => HALF.map((t) => fn(t));
const attack = (fn) => () => [fn(0, 0), fn(0, 1)];
const MODELS = { risen, crawler, mourner, acolyte, gravewarden, rat, votary, flagellant, cherub, wisp, siltWretch, naveEel };
const mon = {};
for (const [id, fn] of Object.entries(MODELS)) {
  const r = reactions(() => fn(0), 0, id === 'rat' || id === 'crawler' || id === 'naveEel');
  mon[`${id}_walk`] = walk(fn); mon[`${id}_attack`] = attack(fn); mon[`${id}_hit`] = r.hit; mon[`${id}_die`] = r.die;
}
export default {
  mon_common: mon,
  risen: { walk: walk(risen), attack: attack(risen), ...reactions(() => risen(0)) },
  gravewarden: { walk: walk(gravewarden), attack: attack(gravewarden), ...reactions(() => gravewarden(0)) },
};
