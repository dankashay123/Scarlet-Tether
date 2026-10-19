// Props in 3/4 view, the Otherworld Legends way: every piece of furniture is
// tilted back so its lit top shows above a darker front face. Models are
// built with the ground at y = G and their depth centred on z = 0; render()
// tilts them about the ground line and lifts them so the front edge sits on
// the frame floor. Also the leftovers from the old hand-drawn art: floor
// splats, spawn mounds, candles, gibs, cobwebs and the HUD buttons.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, folds, bumpy, clip, dot, pline } from '../sdf.mjs';
import { torus } from './base.mjs';
import { MM, R, flame } from './dungeon.mjs';
import { blobs } from './vfx.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const put = (f, x, y, name) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.px[y * f.w + x] = IDX[name]; };
const has = (f, x, y) => { x = Math.round(x); y = Math.round(y); return x >= 0 && y >= 0 && x < f.w && y < f.h && f.px[y * f.w + x] >= 0; };

const M = {
  ...MM,
  wood: { ramp: 'wood', spec: 0.12, bias: 0.02, min: 1 },
  woodDark: { ramp: 'wood', spec: 0.08, bias: -0.16, min: 2 },
  plank: { ramp: 'wood', spec: 0.1, bias: -0.02, min: 2 },
  groove: { ramp: 'wood', bias: -0.5, min: 6 },
  stone: { ramp: 'stone', spec: 0.06, bias: 0.0, min: 1 },
  stoneDark: { ramp: 'stone', bias: -0.18, min: 2 },
  carve: { ramp: 'stone', bias: -0.45, min: 5 },
  marble: { ramp: 'bone', spec: 0.15, bias: -0.12, min: 1 },
  velvet: { ramp: 'crimson', spec: 0.05, bias: -0.22, min: 2 },
  velvetDark: { ramp: 'crimson', bias: -0.3, min: 3 },
  hole: { ramp: 'ink', bias: -0.5, min: 7 },
  dirt: { ramp: 'shroud', spec: 0.05 },
};
// Tilt settings: the angle, and helpers to place hand pixels on the tilted image.
const A = 0.6, C = Math.cos(A), Sn = Math.sin(A);
const view = (G, d, a = A) => ({ tilt: a, tiltY: G, tiltLift: d * Math.sin(a), ground: G });
const proj = (G, d, a = A) => (x, y, z) => [x, G + (y - G) * Math.cos(a) + z * Math.sin(a) - d * Math.sin(a)];
// Flames sit in model space; move them onto the tilted image before drawing.
function flameAt(S, P, x, y, z, size, sway, tall) { const [px, py] = P(x, y, z); flame(S, px, py, 0, size, sway, tall); }

// ----------------------------------------------------------------- crate ---
function crate() {
  const S = new Scene(), G = 33, cx = 16, d = 9, hy = 9;
  S.add(box([cx, G - hy, 0], [12, hy, d], 0.7, 'plank'), 0);
  // Frame boards proud of the front face and the top.
  for (const x of [cx - 10.6, cx + 10.6]) S.add(box([x, G - hy, d - 0.2], [1.6, hy, 0.8], 0.4, 'wood'), 0.2);
  for (const y of [G - 1.6, G - 2 * hy + 1.6]) S.add(box([cx, y, d - 0.2], [12, 1.6, 0.8], 0.4, 'wood'), 0.2);
  S.add(rotZ(box([cx, G - hy, d - 0.1], [12.5, 1.2, 0.7], 0.3, 'wood'), [cx, G - hy], -0.62), 0.2);
  for (const x of [cx - 10.6, cx + 10.6]) S.add(box([x, G - 2 * hy, 0], [1.6, 0.6, d], 0.3, 'wood'), 0.2);
  // Plank seams on the top.
  for (const z of [-4.5, 0, 4.5]) S.sub(box([cx, G - 2 * hy - 0.6, z], [9, 0.8, 0.45], 0), 0);
  S.sub(box([cx - 3, G - 2 * hy - 0.4, 2], [1.5, 0.5, 0.5], 0.2), 0.3);
  // Iron corner caps.
  for (const x of [cx - 11.4, cx + 11.4]) for (const y of [G - 1.4, G - 2 * hy + 1.4]) S.add(box([x, y, d], [1.4, 1.4, 1.3], 0.3, 'darkIron'), 0);
  const fr = R(S, 32, 34, M, view(G, d));
  const P = proj(G, d);
  for (const x of [cx - 11.4, cx + 11.4]) for (const y of [G - 1.4, G - 2 * hy + 1.4]) put(fr, ...P(x, y, d + 1), 'iron1');
  return fr;
}

// ---------------------------------------------------------------- pillar ---
// A free-standing square pillar, Otherworld Legends style: a wide plinth, a
// plain square shaft with a few cracks and a capital whose lit top shows.
// About 2.5 tiles tall, so the floor around it stays readable.
function pillar(v) {
  // Pale marble shaft between darker stone plinth and capital: brighter than
  // the walls and well clear of them, so it reads as a pillar.
  const S = new Scene(), G = 60, cx = 12, d = 5, T0 = 0.38;
  S.add(box([cx, G - 2.5, 0], [9.6, 2.5, d + 2.8], 0.6, 'stone'), 0);
  S.add(box([cx, G - 5.8, 0], [8, 1.2, d + 1.6], 0.5, 'marble'), 0.3);
  S.add(box([cx, G - 25, 0], [6, 18, d], 0.4, 'marble'), 0.4);
  for (const x of [cx - 4.4, cx + 4.4]) S.sub(box([x, G - 25, d + 0.1], [0.5, 17, 0.7], 0), 0);
  S.add(box([cx, G - 44.2, 0], [8, 1.2, d + 1.6], 0.5, 'marble'), 0.3);
  S.add(box([cx, G - 47.4, 0], [9.6, 2.2, d + 2.8], 0.5, 'stone'), 0.3);
  if (v === 1) S.sub(box([cx + 7, G - 48.6, d + 2.6], [2.2, 1.6, 2], 0.6), 0.6);
  const fr = R(S, 24, 62, M, view(G, d + 3, T0));
  const P = proj(G, d + 3, T0);
  for (const [x, z] of [[cx - 9, d + 3], [cx - 8, d + 3], [cx + 9, d + 3]]) { const [px, py] = P(x, G - 0.5, z); if (has(fr, px, py)) put(fr, px, py, 'moss2'); }
  return fr;
}

// ----------------------------------------------------------------- chest ---
function chest(open) {
  const S = new Scene(), G = 33, cx = 16, d = 7, top = G - 11;
  S.add(box([cx, G - 5.5, 0], [12.5, 5.5, d], 0.7, 'plank'), 0);
  for (const y of [G - 4, G - 8]) S.sub(box([cx, y, d + 0.1], [12, 0.3, 0.4], 0), 0);
  if (!open) {
    // A barrel lid, banded in gold, with a lock plate on the seam.
    S.add({ mat: 'plank', bb: [cx - 13, top - 8, -8, cx + 13, top + 1, 8], f: (x, y, z) => Math.max(Math.hypot(y - top, z) - 7.2, y - top, Math.abs(x - cx) - 12.7) - 0.4 }, 0.5);
    for (const x of [cx - 8.5, cx + 8.5]) {
      S.add({ mat: 'gold', bb: [x - 2, top - 9, -9, x + 2, G, 9], f: (xx, y, z) => Math.max(Math.min(Math.max(Math.hypot(y - top, z) - 7.9, y - top), Math.max(Math.abs(z) - d - 0.6, top - y, y - G)), Math.abs(xx - x) - 1.3) - 0.2 }, 0);
    }
    S.add(box([cx, top + 1, d + 0.5], [2.6, 3, 0.8], 0.5, 'gold'), 0);
  } else {
    S.add(rotZ(box([cx, top - 6, -d - 1], [12.7, 6.5, 1.4], 0.5, 'plank'), [cx, top], 0), 0);
    S.add(bumpy(ellipsoid([cx, top + 0.5, 0], [11.2, 3.2, 6], 'gold'), 0.7, 0.9, 3), 0);
    for (const x of [cx - 8.5, cx + 8.5]) S.add(box([x, G - 5.5, 0], [1.3, 5.7, d + 0.5], 0.2, 'gold'), 0);
  }
  for (const x of [cx - 12.6, cx + 12.6]) S.add(box([x, G - 2, d], [1.2, 1.4, 1], 0.3, 'darkIron'), 0);
  const fr = R(S, 32, 36, M, view(G, d));
  const P = proj(G, d);
  if (!open) { put(fr, ...P(cx, top + 1, d + 2), 'ink0'); put(fr, ...P(cx, top + 2.2, d + 2), 'ink1'); put(fr, ...P(cx - 1.6, top - 0.8, d + 2), 'white'); }
  else for (const [x, z] of [[-6, 2], [1, -1], [6, 3], [-2, 4]]) put(fr, ...P(cx + x, top - 2, z), 'white');
  for (const x of [cx - 8.5, cx + 8.5]) put(fr, ...P(x - 0.6, open ? G - 9 : top - 6, open ? d : 3), 'gold0');
  return fr;
}

// ------------------------------------------------------------------- pew ---
function pew() {
  const S = new Scene(), G = 30, cx = 23, d = 5;
  S.add(box([cx, G - 9, 0.5], [20, 1.3, 4.2], 0.6, 'wood'), 0);
  S.add(box([cx, G - 15, -4.2], [20, 5, 0.9], 0.5, 'plank'), 0.3);
  S.add(capsule([cx - 20, G - 20.5, -4.2], [cx + 20, G - 20.5, -4.2], 1.3, 1.3, 'wood'), 0.4);
  for (const x of [cx - 13, cx, cx + 13]) S.sub(box([x, G - 15, -3.2], [0.35, 4, 0.4], 0), 0);
  for (const x of [cx - 20.5, cx + 20.5]) {
    S.add(box([x, G - 10, -0.2], [1.5, 10, 4.8], 0.6, 'woodDark'), 0.3);
    S.add(sphere([x, G - 21, -3.4], 2, 'woodDark'), 0.6);
  }
  for (const x of [cx - 10, cx + 10]) S.add(box([x, G - 4, 2.6], [0.9, 4, 0.9], 0.3, 'woodDark'), 0);
  return R(S, 46, 32, M, view(G, d));
}

// ----------------------------------------------------------------- altar ---
function altar() {
  const S = new Scene(), G = 41, cx = 24, d = 8, P = proj(G, d);
  S.add(box([cx, G - 8.5, 0], [19, 8.5, d], 1, 'stone'), 0);
  S.add(box([cx, G - 18, 0], [21.5, 1.6, d + 1.2], 0.7, 'stone'), 0.3);
  S.add(box([cx, G - 0.8, 0.4], [20.5, 0.9, d + 0.6], 0.5, 'stoneDark'), 0);
  // A crimson altar cloth over the top and down the front, gold-hemmed.
  S.add({ mat: 'velvet', bb: [cx - 11, G - 20, -d - 2, cx + 11, G - 2, d + 3], f: (x, y, z) => {
    const onTop = Math.max(Math.abs(x - cx) - 10, Math.abs(y - (G - 19.8)) - 0.5, Math.abs(z) - d - 1.4);
    const front = Math.max(Math.abs(x - cx) - 10, (G - 19.6) - y, y - (G - 5 - Math.abs(Math.sin((x - cx) * 0.5)) * 1.6), Math.abs(z - d - 1.6) - 0.5);
    return Math.min(onTop, front) - 0.15; } }, 0.6);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 10.4, Math.abs(y - (G - 5.6 - Math.abs(Math.sin((x - cx) * 0.5)) * 1.6)) - 0.8, d - z), mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 1, Math.abs(y - (G - 12)) - 4, d - z), mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - cx) - 3, Math.abs(y - (G - 13)) - 1, d - z), mat: 'gold' });
  // Carved panels either side of the cloth.
  for (const x of [cx - 15, cx + 15]) S.sub(box([x, G - 9, d + 0.6], [2.6, 4.5, 0.6], 0.5), 0.4);
  // Candles and a chalice on top.
  for (const x of [cx - 17, cx + 17]) { S.add(capsule([x, G - 19.5, -4], [x, G - 27, -4], 1.5, 1.4, 'wax'), 0.3); flameAt(S, P, x, G - 27.6, -4, 1.2, 0.3, 0); }
  S.add(capsule([cx, G - 20, -3], [cx, G - 24, -3], 0.8, 0.6, 'gold'), 0.3);
  S.add(ellipsoid([cx, G - 25.5, -3], [2.4, 1.8, 2.4], 'gold'), 0.4);
  S.add(bumpy(ellipsoid([cx - 9, G - 20.4, 3], [3.6, 0.8, 2.4], 'blood'), 0.3, 0.8), 0.3);
  const fr = R(S, 48, 44, M, view(G, d));
  put(fr, ...P(cx - 1, G - 26, -1), 'white');
  return fr;
}

// ---------------------------------------------------------- sarcophagus ---
function sarcophagus() {
  const S = new Scene(), G = 39, cx = 24, d = 9, P = proj(G, d);
  S.add(box([cx, G - 6, 0], [19, 6, d], 1, 'stone'), 0);
  S.add(box([cx, G - 0.8, 0], [20, 0.9, d + 0.8], 0.5, 'stoneDark'), 0);
  S.add(box([cx, G - 13.5, 0], [20.5, 1.8, d + 1.2], 1, 'stone'), 0.4);
  // Carved arches on the front.
  for (const x of [cx - 12, cx - 4, cx + 4, cx + 12]) { S.sub(box([x, G - 5, d + 0.7], [2.4, 3, 0.7], 0.3), 0.3); S.sub(sphere([x, G - 8, d + 0.6], 2.4), 0.3); }
  // The effigy lying on the lid: head on a cushion, robed body, hands on a sword.
  const ly = G - 16.2;
  S.add(box([cx - 13, ly + 0.8, 0], [3.4, 0.9, 4.6], 0.8, 'stoneDark'), 0.4);
  S.add(sphere([cx - 12.5, ly - 1.4, 0], 2.8, 'marble'), 0.6);
  S.add(ellipsoid([cx - 7.5, ly - 0.6, 0], [3, 1.8, 4.6], 'marble'), 1.2);
  S.add(folds(capsule([cx - 5, ly - 0.2, 0], [cx + 11, ly + 0.2, 0], 3.6, 2.6, 'marble'), { cx: cx + 3, n: 6, amp: 0.35, y0: ly - 3, y1: ly + 2 }), 1.2);
  for (const z of [-1.6, 1.6]) S.add(ellipsoid([cx + 13.4, ly - 0.6, z], [1.6, 1.8, 1.3], 'marble'), 0.6);
  S.add(box([cx + 1, ly - 3.2, 0], [7.5, 0.35, 0.45], 0.2, 'darkIron'), 0);
  S.add(box([cx - 6.2, ly - 3.2, 0], [0.5, 0.5, 2], 0.2, 'gold'), 0);
  S.add(ellipsoid([cx - 4.6, ly - 3, 0], [1.6, 0.9, 2.2], 'marble'), 0.5);
  const fr = R(S, 48, 40, M, view(G, d));
  for (const [x, z] of [[-16, 6], [15, -7], [-17, -6]]) if (has(fr, ...P(cx + x, G - 15.4, z))) put(fr, ...P(cx + x, G - 15.4, z), 'moss2');
  return fr;
}

// ---------------------------------------------------------------- coffin ---
function coffin(broken) {
  const S = new Scene(), G = 39, cx = 12, d = 3.4, a = 0.22, P = proj(G, d, a);
  const hexw = (y) => { const t = (y - (G - 35)) / 35; return t < 0.27 ? 5 + t / 0.27 * 4.5 : 9.5 - (t - 0.27) / 0.73 * 4; };
  S.add({ mat: 'plank', bb: [0, G - 36, -5, 24, G + 1, 5], f: (x, y, z) => Math.max(Math.abs(x - cx) - hexw(y), Math.abs(z) - d, (G - 35) - y, y - G) - 0.6 }, 0);
  S.add({ mat: 'woodDark', bb: [0, G - 36, d - 1, 24, G + 1, d + 2], f: (x, y, z) => Math.max(Math.abs(x - cx) - hexw(y) - 0.3, Math.abs(z - d - 0.3) - 0.6, (G - 35.4) - y, y - G - 0.4, -(Math.abs(x - cx) - hexw(y) + 1.4)) }, 0);
  for (const y of [G - 26, G - 14]) S.sub(box([cx, y, d + 0.6], [9, 0.3, 0.5], 0), 0);
  if (!broken) S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - cx) - 0.9, Math.abs(y - (G - 20)) - 8), Math.max(Math.abs(x - cx) - 4.2, Math.abs(y - (G - 24)) - 0.9)) + (z < d - 0.5 ? 9 : 0), mat: 'gold' });
  else S.sub(bumpy(ellipsoid([cx + 2, G - 19, d + 1], [5, 8, 3], 'hole'), 1.2, 0.7), 0.3);
  for (const [x, y] of [[cx - 8.5, G - 27], [cx + 8.5, G - 27], [cx - 5, G - 2], [cx + 5, G - 2]]) S.add(box([x, y, d], [1, 1, 0.8], 0.3, 'darkIron'), 0);
  const fr = R(S, 24, 40, M, view(G, d, a));
  if (broken) for (const [x, y] of [[cx + 1, G - 21], [cx + 3, G - 17]]) put(fr, ...P(x, y, d + 1), 'bone2');
  return fr;
}

// ---------------------------------------------------------------- shrine ---
function shrine(kind) {
  const S = new Scene(), G = 52, cx = 18, d = 9, a = 0.45, P = proj(G, d, a);
  const rmp = { fervor: 'crimson', haste: 'flame', warding: 'holy', plenty: 'gold' }[kind];
  // Two round steps, a fluted stem and a bowl.
  S.add({ mat: 'stone', bb: [cx - 14, G - 4, -12, cx + 14, G, 12], f: (x, y, z) => Math.max(Math.hypot(x - cx, z * 1.15) - 12.5, (G - 3.4) - y, y - G) - 0.4 }, 0);
  S.add({ mat: 'stoneDark', bb: [cx - 12, G - 8, -10, cx + 12, G - 3, 10], f: (x, y, z) => Math.max(Math.hypot(x - cx, z * 1.15) - 10, (G - 7) - y, y - (G - 3)) - 0.4 }, 0.4);
  S.add({ mat: 'stone', bb: [cx - 8, G - 26, -8, cx + 8, G - 6, 8], f: (x, y, z) => { const t = (y - (G - 26)) / 20, an = Math.atan2(z, x - cx); return Math.max(Math.hypot(x - cx, z) - (4.2 + t * 2.2) - Math.abs(Math.sin(an * 4)) * 0.5, (G - 26) - y, y - (G - 7)) * 0.85; } }, 0.6);
  S.add({ mat: 'stone', bb: [cx - 10, G - 31, -10, cx + 10, G - 25, 10], f: (x, y, z) => Math.max(Math.hypot(x - cx, z) - (6 + (y - (G - 31)) * -0.6 + 3), (G - 30.5) - y, y - (G - 25.5)) - 0.3 }, 0.6);
  S.add(ellipsoid([cx, G - 30.6, 0], [7.5, 0.6, 7.5], 'hole'), 0);
  // The floating orb in a gold cradle.
  const orb = { ...M, orb: { ramp: rmp, spec: 0.9, bias: 0.15, min: 0 } };
  S.add(sphere([cx, G - 40, 0], 6.6, 'orb'), 0);
  S.add(torus([cx, G - 40, 0], 8.6, 0.9, 1.25, 'gold'), 0);
  for (const s of [-1, 1]) S.add(capsule([cx + s * 7.6, G - 37, 0], [cx + s * 4.5, G - 31, 0], 0.8, 0.8, 'gold'), 0.4);
  // Runes cut into the stem.
  for (const y of [G - 20, G - 14]) S.paint({ f: (x, yy, z) => Math.max(Math.abs(x - cx) - 1.6, Math.abs(yy - y) - 0.5, 4 - z), mat: 'carve' });
  const fr = R(S, 36, 56, orb, view(G, d, a));
  const [ox, oy] = P(cx, G - 40, 0);
  put(fr, ox - 3, oy - 3, 'white'); put(fr, ox - 2, oy - 3, 'white'); put(fr, ox - 3, oy - 2, 'white');
  return fr;
}

// ------------------------------------------------------- start statue ---
// A weeping saint on a stepped plinth, at the head of the Vestibule.
function weepingSaint() {
  const S = new Scene(), G = 70, cx = 18, d = 8, a = 0.32, P = proj(G, d, a);
  S.add(box([cx, G - 2, 0], [14, 2, d + 1], 0.7, 'stone'), 0);
  S.add(box([cx, G - 6, 0], [11.5, 2.2, d - 0.5], 0.7, 'stone'), 0.3);
  S.add(box([cx, G - 13, 0], [9, 5, d - 2], 0.8, 'stoneDark'), 0.3);
  S.paint({ f: (x, y, z) => Math.hypot(x - cx, y - (G - 13), z - (d - 2)) - 2, mat: 'gold' });
  const top = G - 18;
  S.add(folds(skirt(cx, top - 24, top, 4.4, 8, 0, 0.8, 'marble'), { cx, n: 8, amp: 0.55, y0: top - 22, y1: top }), 1.2);
  S.add(ellipsoid([cx, top - 25, 0], [6, 4.6, 4.2], 'marble'), 1.8);
  S.add(ellipsoid([cx + 0.5, top - 32, 1], [4.6, 5, 4.4], 'marble'), 1.6);
  S.add(capsule([cx - 1.5, top - 35, -1], [cx - 4, top - 39, -2], 2.6, 0.8, 'marble'), 1.4);
  S.add(capsule([cx - 4.5, top - 25, 2], [cx, top - 30, 5], 1.6, 1.4, 'marble'), 1);
  S.add(capsule([cx + 4.5, top - 25, 2], [cx + 1.5, top - 30, 5], 1.6, 1.4, 'marble'), 1);
  S.add(torus([cx - 1, top - 40, -1], 5, 0.8, 0.45, 'gold'), 0);
  const fr = R(S, 36, 76, M, view(G, d, a));
  // Blood tears.
  const [ex, ey] = P(cx + 2, top - 31, 5);
  for (let k = 0; k < 4; k++) put(fr, ex, ey + k, k < 2 ? 'blood1' : 'blood2');
  put(fr, ex - 2, ey, 'blood1'); put(fr, ex - 2, ey + 1, 'blood2');
  return fr;
}

// --------------------------------------------------------- iron maiden ---
function maiden() {
  const S = new Scene(), G = 47, cx = 13, d = 6, a = 0.2;
  S.add({ mat: 'darkIron', bb: [1, 1, -9, 25, G, 9], f: (x, y, z) => { const t = (y - 10) / 36; const r = y < 10 ? 0 : 6.6 + Math.sin(clamp(t, 0, 1) * 2.4) * 2.6; return Math.max(Math.hypot(x - cx, z * 1.25) - r, 10 - y, y - (G - 1)) * 0.85; } }, 0);
  S.add(ellipsoid([cx, 8.5, 0], [6, 6.6, 5], 'darkIron'), 2);
  S.add(ellipsoid([cx + 0.5, 9.5, 3.6], [3.4, 4.2, 2], 'iron'), 0.8);
  for (const y of [18, 30, 41]) S.add({ mat: 'gold', bb: [0, y - 1, -9, 26, y + 1, 9], f: (x, yy, z) => { const t = (yy - 10) / 36, r = 6.6 + Math.sin(clamp(t, 0, 1) * 2.4) * 2.6; return Math.max(Math.abs(Math.hypot(x - cx, z * 1.25) - r - 0.2) - 0.5, Math.abs(yy - y) - 0.8); } }, 0);
  S.paint({ f: (x, y, z) => Math.abs(x - cx - 0.3) - 0.45 + (y < 17 || z < 3 ? 9 : 0), mat: 'hole' });
  const fr = R(S, 26, 48, M, view(G, d, a));
  const P = proj(G, d, a);
  put(fr, ...P(cx - 0.8, 8.5, 5), 'ink0'); put(fr, ...P(cx + 1.8, 8.5, 5), 'ink0'); put(fr, ...P(cx + 0.5, 11.2, 5.5), 'ink1');
  for (const y of [32, 33, 35, 39]) put(fr, ...P(cx + 1, y, 8), y > 34 ? 'blood2' : 'blood1');
  return fr;
}

// --------------------------------------------------------------- cage ---
function cage() {
  const S = new Scene(), G = 45, cx = 12, d = 6, a = 0.3, P = proj(G, d, a);
  S.add({ mat: 'darkIron', bb: [cx - 11, G - 4, -8, cx + 11, G, 8], f: (x, y, z) => Math.max(Math.hypot(x - cx, z * 1.3) - 9.6, (G - 3) - y, y - G) - 0.3 }, 0);
  S.add(ellipsoid([cx, G - 36, 0], [9.4, 2.6, 7], 'darkIron'), 0);
  S.add(capsule([cx, G - 44, 0], [cx, G - 37.5, 0], 0.8, 0.8, 'darkIron'), 0);
  S.add(torus([cx, G - 44.5, 0], 1.6, 0.6, 0, 'iron'), 0);
  // The prisoner, long dead.
  S.add(bumpy(ellipsoid([cx - 0.5, G - 15, -1], [3.6, 9, 3], 'bone'), 0.3, 0.8), 0.6);
  S.add(sphere([cx, G - 27, 0], 3, 'bone'), 0.8);
  S.add(capsule([cx - 3, G - 20, 0], [cx - 5.5, G - 13, 2], 0.9, 0.7, 'bone'), 0.5);
  for (let k = 0; k < 9; k++) { const an = k / 9 * Math.PI * 2, x = cx + Math.cos(an) * 8.6, z = Math.sin(an) * 6.4; S.add(capsule([x, G - 36, z], [x, G - 3, z], 0.6, 0.6, 'darkIron'), 0); }
  S.add({ mat: 'gold', bb: [cx - 11, G - 22, -9, cx + 11, G - 20, 9], f: (x, y, z) => Math.max(Math.abs(Math.hypot(x - cx, z * 1.34) - 8.9) - 0.5, Math.abs(y - (G - 21)) - 0.6) }, 0);
  const fr = R(S, 24, 50, M, view(G, d, a));
  put(fr, ...P(cx - 1, G - 27, 3), 'ink0'); put(fr, ...P(cx + 1.2, G - 27, 3), 'ink0');
  return fr;
}

// ---------------------------------------------------------- floor bits ---
// Blood pooled on the floor, lit as a wet dome.
function splat(i) {
  const W = 34, H = 22, balls = [];
  const n = [5, 7, 9][i];
  for (let k = 0; k < n; k++) { const an = hash(i, k) * 6.3, dd = k === 0 ? 0 : 3 + hash(k, i, 2) * 9; balls.push([17 + Math.cos(an) * dd * 1.3, 11 + Math.sin(an) * dd * 0.6, k === 0 ? 5 : 1.6 + hash(k, 3, i) * 2.4]); }
  const f = blobs(W, H, balls, { ramp: 'blood', min: 3, max: 8, outline: null, bias: -0.35, k: 0.6 });
  put(f, 15, 9, 'blood0'); put(f, 16, 9, 'blood1');
  return f;
}
// The earth a buried thing claws out of.
function mound(i) {
  const W = 24, H = 15, balls = [[12, 10, [4, 6, 7][i]], [8, 11, [2.5, 4, 5][i]], [16, 11, [2.5, 4, 4.6][i]]];
  const f = blobs(W, H, balls, { ramp: 'dirt' in FINE ? 'dirt' : 'shroud', min: 1, max: 7, outline: 'ink', bias: 0.05, k: 1 });
  for (let k = 0; k < 3 + i * 2; k++) put(f, 5 + hash(k, i) * 14, 6 + hash(i, k) * 7, hash(k, 9) < 0.5 ? 'stone2' : 'bone3');
  if (i === 2) for (const [x, y] of [[11, 4], [12, 3], [13, 4]]) put(f, x, y, 'rot2');
  return f;
}
// A lone candle, four flicker frames.
function candle(i) {
  const S = new Scene();
  S.add(capsule([5, 18, 0], [5, 9, 0], 2, 1.8, 'wax'), 0.4);
  S.add(ellipsoid([6.2, 17.6, 1], [3, 1, 2], 'wax'), 0.6);
  S.add(ellipsoid([3.6, 12, 1.4], [0.8, 2, 0.8], 'wax'), 0.4);
  flame(S, 5, 8.6, 0, 1.5, [0, 0.6, 0.2, -0.5][i], [0, 1, 0, 2][i]);
  return R(S, 10, 19, M, {});
}
// Body bits thrown by a kill: skull, ribs, a forearm, a scrap of shroud.
function gib(i, warden) {
  const S = new Scene(), c = 6;
  const flesh = warden ? 'rot' : 'bone';
  if (i === 0) { S.add(bumpy(sphere([c, c, 0], 3.4, 'bone'), 0.15, 1), 0); S.add(ellipsoid([c + 1, c + 2.4, 1], [2, 1.2, 1.8], 'bone'), 0.6); }
  if (i === 1) for (let k = 0; k < 3; k++) S.add(torus([c, c - 2 + k * 2, 0], 3.4 - k * 0.5, 0.55, 1.35, flesh), 0.3);
  if (i === 2) { S.add(capsule([c - 4, c + 2, 0], [c + 3, c - 2, 0], 1.1, 1, flesh), 0.4); S.add(sphere([c + 3.6, c - 2.4, 0], 1.6, warden ? 'rot' : 'skin'), 0.6); S.add(sphere([c - 4.4, c + 2.2, 0], 1.5, 'blood'), 0.3); }
  if (i === 3) S.add(folds(ellipsoid([c, c, 0], [4.4, 2.6, 1.6], warden ? 'slate' : 'shroud'), { cx: c, n: 5, amp: 0.4, y0: c - 3, y1: c + 3 }), 0);
  const fr = R(S, 12, 12, M, {});
  if (i === 0) { put(fr, c - 1, c, 'ink0'); put(fr, c + 1.4, c, 'ink0'); }
  return fr;
}
// Cobweb for a room corner: threads radiating from the corner, sagging rings.
function web() {
  const f = { w: 18, h: 18, px: new Int16Array(18 * 18).fill(-1) };
  const rays = [0.08, 0.45, 0.85, 1.25, 1.5];
  for (const a of rays) for (let r = 0; r < 18; r += 0.5) put(f, Math.cos(a) * r, Math.sin(a) * r, r < 10 ? 'cloth2' : 'cloth3');
  for (const R0 of [5, 9, 13]) for (let k = 0; k < rays.length - 1; k++) {
    const a0 = rays[k], a1 = rays[k + 1];
    for (let t = 0; t <= 1; t += 0.04) { const a = a0 + (a1 - a0) * t, sag = Math.sin(t * Math.PI) * R0 * 0.12, r = R0 - sag; put(f, Math.cos(a) * r, Math.sin(a) * r, R0 < 10 ? 'cloth1' : 'cloth3'); }
  }
  put(f, 6, 4, 'ink1'); put(f, 6, 5, 'ink2');
  return f;
}

// ---------------------------------------------------------- HUD buttons ---
// Pale discs with a lit rim and a bold ink glyph, like Otherworld Legends.
function button(size, glyph) {
  const S = new Scene(), r = size / 2 - 1.6, c = size / 2;
  S.add(ellipsoid([c, c, 0], [r, r, r * 0.32], 'cloth'), 0);
  const f = R(S, size, size, { ...M, cloth: { ramp: 'cloth', max: 5, spec: 0.2 } }, { contrast: 1.15 });
  // Inner rim shade on the lower right.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d < r - 0.5 && d > r - 2.2 && dx + dy > r * 0.4) put(f, x, y, 'cloth3');
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const u = (x + 0.5 - c) / r, v = (y + 0.5 - c) / r; if (glyph(u, v)) put(f, x, y, 'ink1'); }
  // A heavy ink rim.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d >= r - 0.6 && d < r + 1.4) put(f, x, y, 'outline'); }
  return f;
}
const seg = (u, v, ax, ay, bx, by, w) => { const dx = bx - ax, dy = by - ay, t = clamp(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(u - ax - dx * t, v - ay - dy * t) < w; };
const GLYPH = {
  dash: (u, v) => [-0.42, -0.02, 0.38].some((o) => seg(u, v, o - 0.2, -0.36, o + 0.12, 0, 0.12) || seg(u, v, o + 0.12, 0, o - 0.2, 0.36, 0.12)),
  flask: (u, v) => Math.hypot(u, v - 0.18) < 0.42 || (Math.abs(u) < 0.14 && v > -0.48 && v < 0) || (Math.abs(u) < 0.22 && v > -0.6 && v < -0.46),
  chain: (u, v) => [[-0.38, 0.32], [0, 0], [0.38, -0.32]].some(([x, y]) => { const d = Math.hypot(u - x, v - y); return d < 0.24 && d > 0.1; }) || seg(u, v, -0.38, 0.32, 0.38, -0.32, 0.07),
  penance: (u, v) => Math.hypot(u, v) < 0.24 || [0, 1, 2, 3, 4, 5, 6, 7].some((k) => { const a = k * Math.PI / 4; return seg(u, v, Math.cos(a) * 0.36, Math.sin(a) * 0.36, Math.cos(a) * 0.6, Math.sin(a) * 0.6, k % 2 ? 0.06 : 0.1); }),
  dagger: (u, v) => (Math.abs(u) < 0.12 && v > -0.62 && v < 0.2 && Math.abs(u) < 0.12 + (v + 0.62) * 0.02) || (Math.abs(v - 0.22) < 0.08 && Math.abs(u) < 0.4) || (Math.abs(u) < 0.08 && v > 0.2 && v < 0.55) || Math.hypot(u, v - 0.6) < 0.1,
  pause: (u, v) => (Math.abs(Math.abs(u) - 0.22) < 0.1) && Math.abs(v) < 0.4,
  talk: (u, v) => (Math.hypot(u / 1.25, v + 0.06) < 0.5 && !([-0.26, 0, 0.26].some((x) => Math.hypot(u - x, v + 0.06) < 0.09))) || seg(u, v, -0.3, 0.3, -0.48, 0.6, 0.09),
  descend: (u, v) => (Math.abs(u) < 0.1 && v > -0.55 && v < 0.15) || (v > -0.05 && v < 0.35 && Math.abs(u) < (0.35 - v) * 1.1) || (Math.abs(v - 0.52) < 0.07 && Math.abs(u) < 0.48),
  bag: (u, v) => (Math.hypot(u / 1.05, v - 0.16) < 0.46 && v > -0.18) || (Math.abs(u) < 0.2 && v > -0.42 && v < -0.1) || (Math.abs(v + 0.34) < 0.07 && Math.abs(u) < 0.34),
  close: (u, v) => seg(u, v, -0.38, -0.38, 0.38, 0.38, 0.13) || seg(u, v, -0.38, 0.38, 0.38, -0.38, 0.13),
  knob: (u, v) => (Math.abs(u) < 0.13 && Math.abs(v) < 0.5) || (Math.abs(v) < 0.13 && Math.abs(u) < 0.5),
};
// Map badges for the town map: a small coloured disc, lit from the top-left,
// with a pale glyph and a heavy outline. Order matches MAP_BADGES in index.html.
export const MAP_BADGES = [
  ['gate', 'stone'], ['market', 'gold'], ['plush', 'crimson'], ['tavern', 'wood'], ['forge', 'ember'], ['acre', 'moss'], ['descend', 'violet'],
  ['rift', 'blood'], ['lock', 'iron'], ['npc', 'teal'], ['board', 'sand'], ['relic', 'slate'], ['pool', 'violet'], ['saint', 'crimson'],
];
const BADGE_GLYPH = {
  gate: (u, v) => Math.abs(u) < 0.55 && v > -0.45 && v < 0.55 && !(Math.abs(u) < 0.28 && (v > 0 || Math.hypot(u, v) < 0.28)),
  market: (u, v) => Math.hypot(u, v) < 0.54 && !(Math.abs(u) < 0.13 && Math.abs(v) < 0.13),
  plush: (u, v) => Math.hypot(u + 0.22, v + 0.12) < 0.27 || Math.hypot(u - 0.22, v + 0.12) < 0.27 || (v > -0.12 && v < 0.55 && Math.abs(u) < (0.55 - v) * 0.95),
  tavern: (u, v) => (Math.abs(u + 0.1) < 0.34 && v > -0.4 && v < 0.5) || (Math.hypot(u - 0.36, v - 0.05) < 0.24 && Math.hypot(u - 0.36, v - 0.05) > 0.1),
  forge: (u, v) => (Math.abs(v + 0.05) < 0.14 && Math.abs(u) < 0.55) || (Math.abs(u + 0.15) < 0.24 && v > -0.05 && v < 0.35) || (Math.abs(v - 0.45) < 0.1 && Math.abs(u + 0.15) < 0.4) || (Math.abs(v + 0.24) < 0.08 && u > 0.1 && u < 0.6),
  acre: (u, v) => (Math.abs(u) < 0.36 && v > -0.2 && v < 0.5) || (Math.hypot(u, v + 0.2) < 0.36 && v < -0.2) || (Math.abs(v - 0.52) < 0.07 && Math.abs(u) < 0.55),
  descend: (u, v) => (Math.abs(u) < 0.12 && v > -0.55 && v < 0.1) || (v > -0.08 && v < 0.5 && Math.abs(u) < (0.5 - v) * 1.05),
  rift: (u, v) => { const d = Math.hypot(u * 0.85, v); return (d < 0.56 && d > 0.38) || d < 0.14 || (d < 0.42 && d > 0.3 && Math.atan2(v, u) > 0.4 && Math.atan2(v, u) < 2.4); },
  lock: (u, v) => (Math.abs(u) < 0.46 && v > -0.08 && v < 0.56 && !(Math.abs(u) < 0.09 && v > 0.1 && v < 0.36)) || (v < -0.02 && Math.hypot(u, v + 0.08) < 0.42 && Math.hypot(u, v + 0.08) > 0.2),
  npc: (u, v) => (Math.hypot(u / 1.2, v + 0.08) < 0.48 && ![-0.24, 0, 0.24].some((x) => Math.hypot(u - x, v + 0.08) < 0.08)) || seg(u, v, -0.25, 0.3, -0.42, 0.58, 0.09),
  board: (u, v) => (Math.abs(u) < 0.42 && Math.abs(v) < 0.52) && !([-0.18, 0.18].some((y) => Math.abs(v - y) < 0.06 && Math.abs(u) < 0.24)),
  relic: (u, v) => (Math.abs(u) < 0.11 && Math.abs(v) < 0.56) || (Math.abs(v + 0.16) < 0.11 && Math.abs(u) < 0.42),
  pool: (u, v) => { const d = Math.hypot(u, v * 1.8); return (d < 0.55 && d > 0.36) || (Math.abs(v + 0.02) < 0.05 && Math.abs(u) < 0.2); },
  saint: (u, v) => (Math.abs(Math.hypot(u / 1.6, v + 0.5) - 0.2) < 0.08) || Math.hypot(u, v + 0.12) < 0.2 || (v > 0.08 && v < 0.58 && Math.abs(u) < 0.1 + (v - 0.08) * 0.75),
};
// Vestment set badges (docs/SETS.md).
Object.assign(BADGE_GLYPH, {
  nails: (u, v) => [-0.32, 0, 0.32].some((x) => (Math.abs(u - x) < 0.08 && v > -0.38 && v < 0.5 - Math.abs(u - x) * 0) || (Math.abs(u - x) < 0.17 && Math.abs(v + 0.42) < 0.08)),
  stride: (u, v) => (v > 0 && Math.hypot(u, v - 0.18) < 0.36) || (v <= 0 && v > -0.62 && Math.abs(u - Math.sin((v + 0.62) * 5) * 0.08) < (v + 0.62) * 0.58),
  font: (u, v) => (v < 0.02 && v > -0.5 && Math.hypot(u / 1.3, v + 0.5) < 0.6 && Math.hypot(u / 1.3, v + 0.5) > 0.0 && v > -0.5 + 0.0 && Math.hypot(u / 1.3, v + 0.62) > 0.32 ? true : false) || (Math.abs(u) < 0.09 && v >= 0 && v < 0.4) || (Math.abs(v - 0.46) < 0.09 && Math.abs(u) < 0.34),
  confessor: (u, v) => [[-0.34, 0.3], [0, 0], [0.34, -0.3]].some(([x, y]) => { const d = Math.hypot(u - x, (v - y) * 1.2); return d < 0.26 && d > 0.11; }),
  choir: (u, v) => [-0.36, 0, 0.36].some((x) => (Math.abs(u - x) < 0.11 && v > 0 && v < 0.55) || Math.hypot((u - x) / 0.14, (v + 0.3) / 0.22) < 1),
});
const SET_BADGES = [['nails', 'crimson'], ['stride', 'ember'], ['font', 'holy'], ['confessor', 'slate'], ['choir', 'gold']];
function badge(size, ramp, glyph) {
  const S = new Scene(), r = size / 2 - 1.2, c = size / 2;
  S.add(ellipsoid([c, c, 0], [r, r, r * 0.5], 'disc'), 0);
  const f = R(S, size, size, { disc: { ramp, spec: 0.3, min: 2, max: 6 } }, { contrast: 1.2 });
  const g = BADGE_GLYPH[glyph];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const u = (x + 0.5 - c) / (r - 0.6), v = (y + 0.5 - c) / (r - 0.6); if (g(u, v)) { put(f, x, y, 'bone0'); if (!g((x + 1.5 - c) / (r - 0.6), (y + 1.5 - c) / (r - 0.6))) put(f, x + 1, y + 1, 'ink2'); } }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d >= r - 0.3 && d < r + 1.2) put(f, x, y, 'outline'); }
  return f;
}

// The joystick ring: a thin pale circle with four direction ticks.
function ring() {
  const S = 78, f = { w: S, h: S, px: new Int16Array(S * S).fill(-1) }, c = S / 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (Math.abs(d - 36) < 0.75) put(f, x, y, 'cloth2'); else if (Math.abs(d - 37.4) < 0.6) put(f, x, y, 'ink2'); }
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) for (let k = -2; k <= 2; k++) { const bx = c + dx * 30, by = c + dy * 30; put(f, bx + (dx ? -dx * Math.abs(k) : k), by + (dy ? -dy * Math.abs(k) : k), 'cloth1'); }
  return f;
}

// A stone pilaster set into the back wall: base, fluted shaft, capital.
function pilaster() {
  const S = new Scene(), cx = 8;
  S.add(box([cx, 60, 1.5], [8, 3.5, 2.5], 0.6, 'stone'), 0);
  S.add(box([cx, 55.5, 1], [7, 1.4, 2], 0.5, 'stone'), 0.3);
  S.add({ mat: 'stone', bb: [cx - 6, 14, -2, cx + 6, 54, 4], f: (x, y, z) => Math.max(Math.abs(x - cx) - 5.2 + (Math.abs(Math.sin((x - cx) * 1.1)) * 0.5), y < 14 ? 14 - y : y - 54, Math.abs(z - 0.5) - 1.6) - 0.3 }, 0.5);
  S.add(box([cx, 12.5, 1], [7, 1.6, 2], 0.5, 'stone'), 0.3);
  S.add(box([cx, 8.5, 1.5], [8, 2.6, 2.6], 0.6, 'stone'), 0.3);
  S.add(box([cx, 3, 0.5], [8, 3, 1.6], 0.5, 'stoneDark'), 0);
  const fr = R(S, 16, 64, M, {});
  for (const [x, y] of [[3, 60], [12, 57], [4, 30]]) if (has(fr, x, y)) put(fr, x, y, 'moss2');
  return fr;
}

export default {
  hall: { crate: () => [crate()], pilaster: () => [pilaster()], pillar: () => [0, 1].map(pillar) },
  props: { sarcophagus: () => [sarcophagus()], statue: () => [weepingSaint()] },
  loot: {
    chest: () => [chest(false), chest(true)], pew: () => [pew()], altar: () => [altar()],
    shrine: () => ['fervor', 'haste', 'warding', 'plenty'].map(shrine), coffin: () => [coffin(false), coffin(true)],
    maiden: () => [maiden()], cage: () => [cage()], web: () => [web()],
  },
  fx: {
    splat: () => [0, 1, 2].map(splat), mound: () => [0, 1, 2].map(mound), candle: () => [0, 1, 2, 3].map(candle),
    gib: () => [0, 1, 2, 3].map((i) => gib(i, false)), wardenGib: () => [0, 1, 2, 3].map((i) => gib(i, true)),
  },
  ui: {
    dash: () => [button(50, GLYPH.dash)], flask: () => [button(40, GLYPH.flask)], chain: () => [button(40, GLYPH.chain)], penance: () => [button(44, GLYPH.penance)],
    dagger: () => [button(40, GLYPH.dagger)], pause: () => [button(28, GLYPH.pause)], talk: () => [button(50, GLYPH.talk)], descend: () => [button(50, GLYPH.descend)],
    lock: () => [button(50, BADGE_GLYPH.lock)], map: () => [button(26, BADGE_GLYPH.board)],
    badge: () => MAP_BADGES.map(([g, ramp]) => badge(15, ramp, g)), badgeBig: () => MAP_BADGES.map(([g, ramp]) => badge(21, ramp, g)),
    ...Object.fromEntries(SET_BADGES.map(([g, ramp]) => [`set_${g}`, () => [badge(21, ramp, g)]])),
    ring: () => [ring()], knob: () => [button(32, GLYPH.knob)], bag: () => [button(26, GLYPH.bag)], close: () => [button(22, GLYPH.close)],
  },
};
