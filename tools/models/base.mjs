// Sculpted models for the sprite renderer (tools/sdf.mjs).
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, render, folds, bumpy, clip, dot, pline, setPose } from '../sdf.mjs';

export function torus(c, R, r, tilt, mat, o = {}) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  return { ...o, mat, bb: [c[0] - R - r, c[1] - R - r, c[2] - R - r, c[0] + R + r, c[1] + R + r, c[2] + R + r],
    f: (x, y, z) => { const px = x - c[0], py = y - c[1], pz = z - c[2]; const ry = py * ct - pz * st, rz = py * st + pz * ct; const q = Math.hypot(px, rz) - R; return Math.hypot(q, ry) - r; } };
}

// ------------------------------------------------------------ motion ---
// One leg of a planted-foot walk. p runs 0..1 over a full cycle: for the
// first half the foot is planted and slides back from +amp to -amp; for the
// second it swings forward in an arc, lifted by up to H, knee bent.
export function stride(p, amp, H) {
  p = ((p % 1) + 1) % 1;
  if (p < 0.5) return { x: amp - 4 * amp * p, up: 0, bend: 0 };
  const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u);
  return { x: -amp + 2 * amp * e, up: H * Math.sin(Math.PI * u), bend: Math.sin(Math.PI * u) };
}
// A smooth stand-in for `t % 2` (0 at even t, 1 at odd), so 8-frame walks
// built from half steps ease between the old 4-frame poses.
export const odd = (t) => (1 - Math.cos(t * Math.PI)) / 2;
// Read a looping 4-step table at a fractional step.
export const cyc = (arr, t) => { const n = arr.length, i = Math.floor(t) % n, f = t - Math.floor(t); return arr[i] + (arr[(i + 1) % n] - arr[i]) * f; };
// Body bob for a 4-step walk: 2 (one chunky art pixel, down) through each
// contact and recoil, 0 as the legs pass. Bobs must move whole 2x2 blocks:
// a 1 px or fractional shift re-cuts every block and the sprite shimmers.
export const bobAt = (t) => (Math.floor(t * 2) % 4 < 2 ? 2 : 0);
// Walk frames from half steps: t = 0, 0.5, ... 3.5.
export const HALF = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

// Hit reactions and deaths for any model. make() draws the model at rest;
// the same scene is re-rendered tipped back about its feet, so lighting and
// outlines stay right. Frames are cropped to their pixels, anchor at the feet.
function posedFrame(make, ref, { rot = 0, dx = 0, dy = 0, mid = false }) {
  const pad = Math.ceil(Math.max(ref.w, ref.h) / 4) * 2;
  // mid: turn about the middle of the body instead of the feet.
  let top = ref.ay; if (mid) for (let i = 0; i < ref.px.length; i++) if (ref.px[i] >= 0) { top = Math.floor(i / ref.w); break; }
  setPose({ rot, pivot: [ref.ax, ref.ay - (ref.ay - top) / 2], dx, dy, pad });
  let f;
  try { f = make(); } finally { setPose(null); }
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.px[y * f.w + x] >= 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const ax = ref.ax + pad, ay = ref.ay + pad;
  x0 = Math.min(x0, ax) & ~1; y0 = Math.min(y0, ay) & ~1;
  x1 = Math.max(x1, ax) + 1; y1 = Math.max(y1, ay) + 1; x1 += (x1 - x0) & 1; y1 += (y1 - y0) & 1;
  const w = x1 - x0, h = y1 - y0, px = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x + x0, sy = y + y0; if (sx < f.w && sy < f.h) px[y * w + x] = f.px[sy * f.w + sx]; }
  return { w, h, px, ax: ax - x0, ay: ay - y0 };
}
// heavy: 0 (light, thrown about) .. 1 (an elite that barely rocks).
// flat: a creature already low to the ground rolls belly-up instead.
export function reactions(make, heavy = 0, flat = false) {
  const k = 1 - heavy * 0.55;
  return {
    hit: () => { const ref = make(); return [posedFrame(make, ref, { rot: -0.26 * k, dx: -2 }), posedFrame(make, ref, { rot: -0.12 * k, dx: -2 })]; },
    // Struck, buckling, then flat on its back.
    die: () => { const ref = make(); return flat ? [
      posedFrame(make, ref, { rot: -0.6, dx: -2, mid: true }),
      posedFrame(make, ref, { rot: -1.9, dx: -2, mid: true }),
      posedFrame(make, ref, { rot: -Math.PI, dx: -2, mid: true }),
    ] : [
      posedFrame(make, ref, { rot: -0.4, dx: -2 }),
      posedFrame(make, ref, { rot: -0.95, dx: -4 }),
      posedFrame(make, ref, { rot: -1.45, dx: -6, dy: 2 }),
    ]; },
  };
}

// Materials shared by every model: ramp, clamps (in 9 fine steps), shine.
export const MATS = {
  default: { ramp: 'stone' },
  crimson: { ramp: 'crimson', spec: 0.08 }, crimsonDark: { ramp: 'crimson', bias: -0.14, min: 2 },
  cloth: { ramp: 'cloth', max: 6, spec: 0.05 }, shroud: { ramp: 'shroud' }, leather: { ramp: 'wood', bias: -0.12, spec: 0.15 },
  gold: { ramp: 'gold', spec: 0.55, min: 0 }, iron: { ramp: 'iron', spec: 0.8 }, wood: { ramp: 'wood', spec: 0.1 },
  void: { ramp: 'ink', bias: -0.45, min: 4 }, eyeGreen: { ramp: 'flame', glow: 1 }, eyeEmber: { ramp: 'ember', glow: 1 }, eyeHoly: { ramp: 'holy', glow: 1 }, eyeBlood: { ramp: 'blood', glow: 0 }, eyeViolet: { ramp: 'violet', glow: 0 },
  halo: { ramp: 'gold', spec: 0.9, bias: 0.15 },
  skin: { ramp: 'skin', spec: 0.1 }, rot: { ramp: 'rot', spec: 0.12 }, bone: { ramp: 'bone', spec: 0.2 }, stone: { ramp: 'stone', spec: 0.05 }, pot: { ramp: 'pot', spec: 0.15 },
  slate: { ramp: 'slate', spec: 0.1 }, violet: { ramp: 'violet', spec: 0.1 }, moss: { ramp: 'moss' }, ink: { ramp: 'ink', bias: -0.1, min: 2 }, teal: { ramp: 'teal' },
  blood: { ramp: 'blood', spec: 0.4 }, holy: { ramp: 'holy', spec: 0.5 }, flame: { ramp: 'flame', glow: 1 }, ember: { ramp: 'ember', glow: 1 }, emberLit: { ramp: 'ember', spec: 0.3, bias: 0.2 },
  brick: { ramp: 'brick' }, flag: { ramp: 'flag' }, sand: { ramp: 'sand' }, roof: { ramp: 'roof' },
};

// ---------------------------------------------------------- the Saint ---
// 48x68 frame, feet at y 62, facing right.
export function saintModel(pose = {}) {
  const { bob = 0, legs = 0, lift = [0, 0], bend = [0, 0], cape = 0, lean = 0, aim = 0, blink = false, halo = 0 } = pose;
  // legs: one number (mirrored swing) or [back leg, front leg] foot offsets.
  const legX = Array.isArray(legs) ? legs : [-legs, legs];
  const S = new Scene(), cx = 22, B = bob, X = lean;
  const hipY = 45 + B, kneeY = 53, footY = 61;
  // Cape behind, flowing back as the Saint moves, with folds.
  const capeSheet = folds(skirt(cx - 1.2, 27 + B, 54, 4.4, 7.6, -2.4, 0.45, 'crimsonDark'), { cx: cx - 1.2, cz: -2.4, n: 9, amp: 0.55, y0: 30, y1: 54 });
  S.add(rotZ(clip(capeSheet, (x, y, z) => z + 1.2), [cx - 1, 27 + B], cape * 0.05), 0);
  S.paint({ f: (x, y, z) => (y > 52.4 + cape * 0.3 && z < -1 ? -1 : 1), mat: 'gold' });
  // Legs: thighs, shins and boots.
  for (const [side, sw, up, kb] of [[-1, legX[0], lift[0], bend[0]], [1, legX[1], lift[1], bend[1]]]) {
    const hz = side * 1.9, hx = cx + side * 0.4;
    // The knee sits ahead of the hip-ankle line, more so when the leg is lifted.
    const ankle = [hx + sw, footY - 1.6 - up, hz];
    const knee = [(hx + ankle[0]) / 2 + 0.8 + kb + X * 0.4, kneeY + B * 0.5 - up * 0.45, hz + 0.6];
    S.add(capsule([hx, hipY, hz], knee, 2.6, 2.2, 'shroud'), 1);
    S.add(capsule(knee, ankle, 2.3, 1.9, 'leather'), 0.8);
    S.add(ellipsoid([ankle[0] + 1.5, ankle[1] + 0.9, hz], [3, 1.7, 2.2], 'leather'), 0.8);
    S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (ankle[1] - 1.6)) - 0.5, Math.hypot(x - ankle[0], z - hz) - 3), mat: 'gold' });
  }
  // Doublet torso and the knee-length tabard with folds.
  S.add(ellipsoid([cx + X, 35 + B, 0], [4.7, 6.6, 3.6], 'crimson'), 0);
  S.add(ellipsoid([cx + X * 0.5, 43 + B, 0], [4.6, 3, 3.3], 'cloth'), 2);
  S.add(folds(skirt(cx + 0.5 + X * 0.3, 42 + B, 51.5 + B * 0.4, 4.7, 6.3, 0, 1.0, 'cloth'), { cx: cx + 0.5, n: 7, amp: 0.5, y0: 43, y1: 51.5, phase: 0.6 }), 1.2);
  // The cowl: hood, mantle and shoulders as one drape.
  S.add(ellipsoid([cx + X, 28.4 + B, 0], [6.6, 3.2, 4.2], 'crimson'), 1.8);
  // Back arm, half hidden.
  S.add(capsule([cx - 4 + X, 29.5 + B, -2.6], [cx - 5.6 + X, 35 + B, -2.8], 2.1, 1.8, 'crimsonDark'), 1);
  S.add(capsule([cx - 5.6 + X, 35 + B, -2.8], [cx - 4.6 + X, 39.4 + B, -2], 1.8, 1.6, 'crimsonDark'), 0.6);
  S.add(sphere([cx - 4.6 + X, 40 + B, -2], 1.55, 'leather'), 0.5);
  // Front arm raised in a casting gesture: the crossbow floats, guided by this hand.
  const hand = [cx + 8.4 + X, 31.6 + B + aim, 5.8], elbow = [cx + 6.6 + X, 37 + B, 4.6];
  S.add(capsule([cx + 4.4 + X, 29.6 + B, 2.4], elbow, 2.5, 2.1, 'crimson'), 1.3);
  S.add(capsule(elbow, [hand[0] - 0.4, hand[1] + 1.8, hand[2] - 0.3], 2.1, 2.3, 'crimson'), 0.7);
  S.paint({ f: (x, y, z) => Math.hypot(x - (hand[0] - 0.4), y - (hand[1] + 2.2), z - (hand[2] - 0.3)) - 2.45, mat: 'gold' });
  S.add(ellipsoid(hand, [1.5, 2, 1.6], 'leather'), 0.6);
  S.add(capsule([hand[0] + 0.6, hand[1] - 1, hand[2]], [hand[0] + 1.4, hand[1] - 3, hand[2]], 0.6, 0.5, 'leather'), 0.4);
  S.paint({ f: (x, y, z) => Math.hypot(x - (cx + 4.2 + X), y - (29.2 + B), z - 3.4) - 1.4, mat: 'gold' });
  // Neck, the hood and its point.
  const hx = cx + 1.2 + X, hy = 19.4 + B;
  S.add(capsule([cx + X, 27 + B, 0], [hx, hy + 3, 0.3], 3, 3.6, 'crimson'), 1.6);
  const hood = ellipsoid([hx, hy, 0.5], [6.1, 5.5, 5.4], 'crimson');
  S.add(hood, 1.8);
  S.add(capsule([hx - 2.6, hy - 3.2, -1.3], [hx - 7, hy - 6, -3.2], 3.3, 0.9, 'crimson'), 2);
  // The hollow where a face should be, rimmed in gilt.
  const fc = [hx + 2.4, hy + 1.2, 4.6], hoodD = hood.f;
  const cut = ellipsoid(fc, [2.8, 3.4, 3], 'void');
  S.sub(cut, 0.6);
  S.paint({ f: (x, y, z) => { const e = cut.f(x, y, z); return Math.max(e - 0.95, -hoodD(x, y, z) - 0.7); }, mat: 'gold' });
  // Gold stole with crimson crosses, belt and hem.
  const sx = cx + 1.1 + X * 0.6;
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - sx) - 1.4, 28 + B - y, y - 51.5, -z + 0.5), mat: 'gold' });
  for (const yy of [35, 48]) S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - sx) - 1.1, Math.abs(y - yy - B) - 0.45), Math.max(Math.abs(x - sx) - 0.45, Math.abs(y - yy - B) - 1.4)) + (z < 0 ? 9 : 0), mat: 'crimson' });
  S.paint({ f: (x, y) => Math.abs(y - (41.4 + B)) - 0.85, mat: 'leather' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (41.4 + B)) - 1.1, Math.abs(x - sx) - 1.1, -z + 2), mat: 'gold' });
  S.paint({ f: (x, y) => Math.abs(y - (50.8 + B * 0.4)) - 0.8, mat: 'gold' });
  // The cracked halo, seen from just above.
  // Tipped up enough that its hole still shows on the chunky 2x2 grid.
  S.add(torus([hx - 1, hy - 12 + halo, 0], 4.8, 1.05, 0.55, 'halo'), 0);
  const f = render(S, 48, 68, MATS, { ground: 62 });
  // Hand-placed touches: the two green eyes, the crossbow string.
  if (!blink) for (const ex of [fc[0] - 1.3, fc[0] + 1]) { dot(f, ex, fc[1] - 0.6, 'flame0'); dot(f, ex, fc[1] + 0.4, 'flame2'); }
  else for (const ex of [fc[0] - 1.3, fc[0] + 1]) dot(f, ex, fc[1] + 0.2, 'flame3');
  // A holy light cupped in the raised palm.
  dot(f, hand[0] + 1.4, hand[1] - 1, 'holy1'); dot(f, hand[0] + 2.2, hand[1] - 2, 'white'); dot(f, hand[0] + 1.6, hand[1] - 2.6, 'holy2');
  return f;
}
