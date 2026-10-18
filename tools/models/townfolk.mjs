// Sculpted models for the townsfolk of Vael: the named NPCs, walkers,
// children, crows and the Saint's dialog portrait. Exports
// { sheetName: { animName: () => frames } }. Characters face right; each
// frame carries ax/ay at the feet.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, render, folds, bumpy, clip, dot, pline, under } from '../sdf.mjs';
import { MATS, torus } from './base.mjs';

const M = {
  ...MATS,
  hairDark: { ramp: 'shroud', bias: -0.18, min: 2 }, hairBrown: { ramp: 'wood', bias: -0.05, min: 1 }, hairGrey: { ramp: 'iron', bias: -0.1, min: 1 },
  hairGold: { ramp: 'gold', bias: -0.05, min: 1, max: 6 }, hairGinger: { ramp: 'ember', bias: -0.2, min: 2, max: 7, spec: 0.05 },
  skin: { ramp: 'skin', min: 1, bias: -0.04, spec: 0.06 }, skinPale: { ramp: 'skin', min: 1, bias: 0.02, spec: 0.06 }, skinRed: { ramp: 'skin', min: 1, bias: -0.1, spec: 0.1 }, skinOld: { ramp: 'sand', min: 1, spec: 0.04 },
  habit: { ramp: 'slate', bias: -0.04, min: 1 }, wimple: { ramp: 'cloth', max: 5, spec: 0.03 }, brownHabit: { ramp: 'wood', min: 1, bias: -0.04 },
  tunic: { ramp: 'shroud', min: 0 }, rags: { ramp: 'shroud', bias: -0.08, min: 1 }, dress: { ramp: 'violet', min: 1, bias: -0.06 }, purple: { ramp: 'violet', spec: 0.08 },
  red: { ramp: 'crimson', min: 1, spec: 0.06 }, mail: { ramp: 'iron', bias: -0.12, spec: 0.45, min: 1 }, steel: { ramp: 'iron', spec: 0.9 },
  apronLeather: { ramp: 'wood', bias: -0.1, spec: 0.2 }, apronCloth: { ramp: 'cloth', max: 6, min: 1 }, white: { ramp: 'cloth', max: 6, spec: 0.06 },
  hatInk: { ramp: 'ink', bias: 0.3, min: 0, max: 8 }, moss: { ramp: 'moss', min: 1 }, mossDark: { ramp: 'moss', min: 2, bias: -0.08 },
  skinFace: { ramp: 'skin', min: 1, bias: 0.16, spec: 0.05 }, skinPaleFace: { ramp: 'skin', min: 1, bias: 0.2, spec: 0.05 }, skinRedFace: { ramp: 'skin', min: 1, bias: 0.1, spec: 0.08 }, skinOldFace: { ramp: 'sand', min: 1, bias: 0.16 },
  cuffDark: { ramp: 'shroud', bias: -0.12, min: 2 },
  dimHalo: { ramp: 'gold', bias: -0.2, spec: 0.3, min: 2 },
};

const SKIN = { skin: 'skin', pale: 'skinPale', red: 'skinRed', old: 'skinOld' };

// ------------------------------------------------------------ the body ---
// One townsperson. Frame 40x56, feet on y 51, standing at x 18.
// sp: robe, sleeve, skirtLen ('long'|'tunic'|'none'), legs, apron, belly,
//     head ('bald'|'hair'|'tonsure'|'nun'|'scarf'|'hood'), hair, hat, beard,
//     prop, hunch, skin, stole, build
// pose: bob, step (-1..1), swing, raise, t
function person(sp, pose = {}) {
  const { bob = 0, step = 0, swing = 0, t = 0 } = pose;
  const W = 40, H = 56, G = 51, cx = 18 - (sp.hunch ? 1 : 0), B = bob;
  const S = new Scene();
  const robe = sp.robe, sleeve = sp.sleeve || robe, skin = SKIN[sp.skin || 'skin'];
  const hunch = sp.hunch || 0, wide = sp.build || 1;
  const lean = hunch * 1.4;
  const hairM = sp.hair || 'hairDark';
  // Legs and shoes.
  const legM = sp.legs || 'tunic';
  for (const side of [-1, 1]) {
    const hz = side * 1.7 * wide, sw = side * step * 3;
    const hip = [cx + 0.2, G - 15 + B, hz], knee = [cx + sw * 0.55 + 0.4, G - 8.6 + B * 0.5 - Math.max(0, sw) * 0.25, hz + 0.3], ankle = [cx + sw, G - 2.8 - Math.max(0, -sw * side) * 0, hz];
    S.add(capsule(hip, knee, 2.4 * wide, 2, legM), 0.8);
    S.add(capsule(knee, ankle, 2, 1.6, legM), 0.6);
    S.add(ellipsoid([ankle[0] + 1.2, G - 1.3, hz], [2.4, 1.4, 1.7], sp.shoe || 'leather'), 0.7);
  }
  // Torso, hips and shoulders.
  const ty = G - 23 + B, tx = cx + lean * 0.6;
  S.add(ellipsoid([tx, ty, 0], [4.8 * wide, 6, 3.7 * wide], robe), 0);
  if (sp.belly) S.add(ellipsoid([tx + 1.6, ty + 3, 0.4], [4.4, 4.6, 3.8 * wide], robe), 1.6);
  S.add(ellipsoid([cx, G - 16 + B, 0], [4.7 * wide, 3, 3.6 * wide], robe), 1.8);
  S.add(ellipsoid([tx + lean * 0.5, G - 28.4 + B + hunch * 0.6, 0], [5.7 * wide, 2.6, 3.8 * wide], robe), 1.8);
  // Skirt or tunic hem, with folds.
  if (sp.skirtLen !== 'none') {
    const y1 = sp.skirtLen === 'tunic' ? G - 10.5 + B * 0.5 : G - 2;
    const rb = sp.skirtLen === 'tunic' ? 5.6 * wide : 6.4 * wide;
    S.add(folds(skirt(cx + 0.3, G - 18 + B, y1, 4.7 * wide, rb, 0, 1, sp.skirt || robe), { cx: cx + 0.3, n: 7, amp: sp.skirtLen === 'tunic' ? 0.3 : 0.45, y0: G - 18, y1, phase: t * 0.7 }), 1.2);
  }
  // Apron over the front.
  if (sp.apron) {
    const ay0 = sp.apronHigh ? G - 28 : G - 21;
    S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (tx + 1.6)) - 3.2, ay0 + B - y, y - (G - 6), -z + 0.8), mat: sp.apron });
  }
  if (sp.stole) S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (tx + 1.4)) - 1.2, G - 29 + B - y, y - (G - 4), -z + 0.6), mat: sp.stole });
  if (sp.belt) S.paint({ f: (x, y) => Math.abs(y - (G - 17.5 + B)) - 0.7, mat: sp.belt });
  if (sp.tabard) S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (tx + 1)) - 3.4, G - 28 + B - y, y - (G - 11), -z + 0.4), mat: sp.tabard });
  // Arms: the back one swings, the front one holds the prop.
  const sh = G - 27.8 + B + hunch * 0.6;
  const bHand = [cx - 4 - swing * 2.2 + lean, G - 18.4 + B, -2.6];
  S.add(capsule([tx - 4.4, sh, -2.8], [tx - 5.2 - swing, G - 22.8 + B, -3], 2.2, 1.9, sleeve), 1);
  S.add(capsule([tx - 5.2 - swing, G - 22.8 + B, -3], bHand, 1.9, 1.8, sleeve), 0.6);
  S.add(sphere(bHand, 1.55, skin), 0.5);
  const hold = PROP_HAND[sp.prop] || ((T) => [T.cx + 4.2 + swing * 2.2 + lean, G - 18.4 + B, 2.8]);
  const fHand = hold({ cx: tx, G, B, swing });
  const elbow = [Math.min(fHand[0], tx + 5.4), (sh + fHand[1]) / 2 + 1, 4.6];
  fHand[2] = Math.max(fHand[2], 4.4);
  S.add(capsule([tx + 4.2, sh, 3], elbow, 2.2, 1.9, sleeve), 1);
  S.add(capsule(elbow, fHand, 1.9, 1.8, sleeve), 0.6);
  S.paint({ f: (x, y, z) => Math.max(Math.hypot(x - (fHand[0] - (fHand[0] - elbow[0]) * 0.3), y - (fHand[1] - (fHand[1] - elbow[1]) * 0.3), z - fHand[2]) - 1.7, -z + 2.5), mat: sp.cuff || (sp.sleeve === 'skinRed' || sp.sleeve === 'skinPale' ? sleeve : 'cuffDark') });
  S.add(sphere(fHand, 1.55, skin), 0.5);
  // Neck and head.
  const hx = cx + 0.8 + lean * 1.4, hy = G - 36.2 + B + hunch * 1.2;
  S.add(capsule([tx + lean * 0.6, G - 30 + B, 0], [hx - 0.4, hy + 2.5, 0.2], 2.6, 2.6, skin), 1);
  S.add(ellipsoid([tx + lean, G - 29.6 + B + hunch * 0.6, 0.3], [3.6 * wide, 1.6, 3.2 * wide], sp.collar || robe), 1);
  S.add(sphere([hx, hy, 0.3], 5, skin), 1.2);
  S.add(ellipsoid([hx + 1.8, hy + 2.6, 0.9], [3.2, 2.3, 3.1], skin), 1.2);
  S.add(sphere([hx + 4.9, hy + 0.8, 1.7], sp.bigNose ? 1.4 : 1.05, skin), 0.6);
  S.add(sphere([hx - 0.5, hy + 0.7, -4.4], 1.05, skin), 0.4);
  headwear(S, sp, hx, hy, G, B, hairM);
  // Fill light on the face so features read at game size.
  if (sp.head !== 'nun') S.paint({ f: (x, y, z) => Math.max(Math.hypot(x - hx, y - hy, z - 0.3) - 6.6, -(x - hx - 0.4), (hy - 1.5) - y, y - (sp.beard ? hy + 1.2 : hy + 4)), mat: skin + 'Face' });
  if (sp.beard) S.add(bumpy(ellipsoid([hx + 2, hy + 3.8, 1.2], [3.6, sp.beard === 'long' ? 4.2 : 3, 3.1], hairM), 0.35, 0.9, 3), 1);
  // Prop shapes.
  const post = [];
  (PROP[sp.prop] || (() => {}))(S, fHand, { G, B, t, post, cx: tx, bHand });
  if (sp.halo) S.add(torus([hx - 1, hy - 7.4, 0], 4, 0.65, 0.4, 'dimHalo'), 0), S.sub(sphere([hx + 3, hy - 7, 2.6], 1.2), 0), S.sub(sphere([hx - 4.4, hy - 7.6, -1], 1), 0);
  const fr = render(S, W, H, M, { ground: G, contourDepth: 3 });
  // Face: eyes, brows, mouth.
  const ey = hy - 0.1;
  if (sp.eyes !== false) {
    for (const ex of [hx + 1.8, hx + 4]) { dot(fr, ex, ey - 0.6, 'ink0'); dot(fr, ex, ey + 0.4, 'ink1'); }
    if (sp.brow) { dot(fr, hx + 1.4, ey - 1.8, sp.brow); dot(fr, hx + 4, ey - 2, sp.brow); }
    if (sp.blindEyes) { dot(fr, hx + 1.8, ey, 'cloth2'); dot(fr, hx + 4, ey, 'cloth2'); }
  }
  if (!sp.beard && sp.mouth !== false) dot(fr, hx + 3.6, hy + 2.9, sp.smile ? 'skin4' : 'skin3h');
  if (sp.scars) for (const [x0, y0] of [[tx - 2.6, G - 27], [tx - 3.2, G - 24.5], [tx - 2.4, G - 22]]) { pline(fr, x0, y0 + B, x0 + 2.4, y0 + 1.6 + B, 'blood2'); dot(fr, x0 + 1, y0 + 1.6 + B, 'blood1'); }
  for (const p of post) p(fr);
  fr.ax = 18; fr.ay = G;
  return fr;
}

function headwear(S, sp, hx, hy, G, B, hairM) {
  const h = sp.head;
  if (h === 'hair' || h === 'tonsure' || h === 'shaggy') {
    const hair = bumpy(sphere([hx - 0.7, hy - 0.9, -0.2], 5.35, hairM), 0.3, 1.1, 7);
    // Hairline slants low at the back, clear of the face at the front.
    S.add(clip(hair, (x, y, z) => (y - (hy - 1.4)) + Math.max(0, -(x - hx)) * 0.95 - (h === 'shaggy' ? 2.5 : 0) - Math.max(0, -(x - hx + 1)) * 0.6 * (h === 'shaggy' ? 1 : 0)), 0.4);
    if (h === 'tonsure') S.sub(sphere([hx - 0.4, hy - 6.2, 0], 3.4), 0.4), S.add(sphere([hx - 0.3, hy - 0.4, 0.2], 4.85, SKIN[sp.skin || 'skin']), 0.3);
  }
  if (h === 'nun' || h === 'scarf') {
    const veilM = sp.veil || 'habit';
    const veil = sphere([hx - 0.9, hy - 0.6, 0], 5.9, veilM);
    S.add(clip(veil, (x, y, z) => (x - hx) - 1.4 + (y - hy) * 0.15), 0.5);
    S.add(capsule([hx - 2.2, hy, -0.4], [hx - 3.8, G - 27.5 + B, -0.6], 4.8, h === 'nun' ? 4.4 : 3.2, veilM), 1.5);
    if (h === 'nun') {
      // The white wimple framing the face.
      // A white frame around the face: a shell over the head with an oval cut for the face.
      S.add(clip(sphere([hx, hy, 0.3], 5.45, 'wimple'), (x, y, z) => Math.max((x - hx) - 4.6, -(Math.hypot(x - (hx + 4), (y - (hy + 1)) / 1.3) - 2.9), -(x - hx) - 1.5)), 0.2);
      S.add(ellipsoid([hx + 0.5, hy + 4.6, 0.6], [3.6, 1.7, 3.2], 'wimple'), 1);
    }
  }
  if (h === 'hood') {
    const hood = sphere([hx - 0.4, hy - 0.4, 0], 5.8, sp.hoodM || 'rags');
    S.add(clip(hood, (x, y, z) => (x - hx) - 1.8 + (y - hy) * 0.3), 0.6);
    S.add(capsule([hx - 2, hy - 2, -0.5], [hx - 5.5, hy - 5.5, -1.8], 3.4, 0.8, sp.hoodM || 'rags'), 1.5);
  }
  if (sp.hat === 'tall') {
    S.add(ellipsoid([hx - 0.2, hy - 4, 0.2], [6.8, 0.9, 5.6], 'hatInk'), 0.3);
    S.add(capsule([hx - 0.4, hy - 4.6, 0.2], [hx - 0.8, hy - 9.8, 0], 4, 3.7, 'hatInk'), 0.8);
    S.paint({ f: (x, y, z) => Math.max(Math.abs(y - (hy - 5.4)) - 0.7, -z + 1), mat: 'red' });
    S.paint({ f: (x, y, z) => Math.hypot(x - (hx + 1.3), y - (hy - 5.4), z - 3.4) - 1.1, mat: 'gold' });
  }
  if (sp.hat === 'kettle') {
    S.add(clip(sphere([hx - 0.4, hy - 1, 0.2], 5.7, 'steel'), (x, y, z) => y - (hy - 1.4)), 0.3);
    S.add(torus([hx - 0.4, hy - 1.4, 0.2], 6.8, 0.8, 0, 'steel'), 0.5);
    S.add(sphere([hx - 0.4, hy - 6.2, 0.2], 0.9, 'steel'), 0.5);
  }
  if (sp.hat === 'mitre') {
    const m = ellipsoid([hx - 0.5, hy - 6.8, 0.2], [4.1, 6.2, 3.8], 'white');
    S.add(clip(m, (x, y) => y - (hy - 2.6)), 0.6);
    S.sub(box([hx - 0.5, hy - 12.6, 0.2], [0.5, 3, 4], 0, 'white'), 0.3);
    S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (hx + 0.4)) - 0.8, y - (hy - 2.6), -z), mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - (hy - 3)) - 0.75, mat: 'gold' });
  }
  if (sp.hat === 'cap') {
    S.add(clip(sphere([hx - 0.7, hy - 1.2, 0.1], 5.6, sp.capM || 'tunic'), (x, y, z) => y - (hy - 1.6) - Math.max(0, -(x - hx)) * 0.5), 0.5);
  }
}

// Where the front hand goes for each prop.
const PROP_HAND = {
  hammer: ({ cx, G, B, swing }) => [cx + 4.2 + swing, G - 18.4 + B, 2.8],
  bell: ({ cx, G, B }) => [cx + 6.8, G - 27.6 + B, 3.4],
  spear: ({ cx, G, B }) => [cx + 5.6, G - 21 + B, 3],
  whip: ({ cx, G, B, swing }) => [cx + 4.4 + swing, G - 18.6 + B, 2.8],
  mug: ({ cx, G, B }) => [cx + 6.4, G - 21.6 + B, 3.4],
  rosary: ({ cx, G, B }) => [cx + 4.6, G - 22.4 + B, 3.4],
  plush: ({ cx, G, B }) => [cx + 6.6, G - 21.8 + B, 3.4],
  bowl: ({ cx, G, B }) => [cx + 6.6, G - 19.6 + B, 3.2],
  book: ({ cx, G, B }) => [cx + 5.8, G - 22 + B, 3.4],
};
const PROP = {
  hammer(S, h, { post }) {
    S.add(capsule([h[0] + 0.3, h[1] - 1.4, h[2] + 0.4], [h[0] + 1.6, h[1] + 7.4, h[2] + 0.6], 0.7, 0.7, 'wood'), 0.2);
    S.add(box([h[0] + 1.6, h[1] + 8.4, h[2] + 0.6], [2.8, 1.4, 1.3], 0.35, 'steel'), 0.2);
  },
  bell(S, h, { post, t }) {
    S.add(capsule([h[0], h[1] - 2.6, h[2]], [h[0] + 0.3, h[1] + 1.4, h[2]], 0.75, 0.75, 'wood'), 0.3);
    const sk = skirt(h[0] + 0.6, h[1] + 1.4, h[1] + 6, 1.3, 3.4, h[2] + 0.4, 1, 'gold');
    S.add(rotZ(sk, [h[0] + 0.4, h[1] + 1.4], (t % 2 ? -0.25 : 0.2)), 0.6);
  },
  spear(S, h, { G }) {
    S.add(capsule([h[0] + 0.4, G - 1, h[2] + 0.6], [h[0] + 0.4, G - 47, h[2] + 0.6], 0.65, 0.6, 'wood'), 0.2);
    S.add(capsule([h[0] + 0.4, G - 47, h[2] + 0.6], [h[0] + 0.4, G - 52.6, h[2] + 0.6], 1.3, 0.1, 'steel'), 0.3);
    S.add(ellipsoid([h[0] + 0.4, G - 46.4, h[2] + 0.6], [1.6, 0.6, 1], 'steel'), 0.2);
  },
  whip(S, h, { post, t }) {
    S.add(capsule([h[0], h[1] - 1.2, h[2] + 0.3], [h[0] + 1.2, h[1] + 2.4, h[2] + 0.4], 0.75, 0.6, 'leather'), 0.2);
    post.push((fr) => { for (const k of [0, 1, 2]) { const ex = h[0] + 2 + k * 1.2 + (t % 2) * 0.8, ey = h[1] + 9 + k * 0.6; pline(fr, h[0] + 1.3, h[1] + 3, ex, ey, k === 1 ? 'wood3' : 'wood4'); dot(fr, ex, ey + 1, 'blood2'); } });
  },
  mug(S, h) {
    S.add(box([h[0] + 1.6, h[1] - 1, h[2] + 1], [1.6, 2, 1.5], 0.6, 'wood'), 0.3);
    S.paint({ f: (x, y) => Math.abs(y - (h[1] - 1.8)) - 0.45, mat: 'iron' });
    S.add(ellipsoid([h[0] + 1.6, h[1] - 3.3, h[2] + 1], [1.7, 0.75, 1.5], 'white'), 0.4);
  },
  rosary(S, h, { post, bHand, B }) {
    // Both hands clasped in prayer.
    S.add(sphere([h[0] + 0.4, h[1] + 0.6, h[2] - 0.6], 1.4, 'skin'), 0.6);
    post.push((fr) => { for (let k = 0; k < 4; k++) dot(fr, h[0] - 0.4 + (k % 2) * 0.6, h[1] + 2.4 + k * 1.2, k === 3 ? 'gold0' : 'bone1'); dot(fr, h[0] + 0.1, h[1] + 7.2, 'gold1'); dot(fr, h[0] - 0.9, h[1] + 7.2, 'gold1'); dot(fr, h[0] + 1.1, h[1] + 7.2, 'gold1'); dot(fr, h[0] + 0.1, h[1] + 8.2, 'gold2'); });
  },
  plush(S, h, { post }) {
    // A plush Saint: little red hood, gold halo, button eyes.
    const px = h[0] + 2.6, py = h[1] - 3.4, pz = h[2] + 1.6;
    S.add(skirt(px, py + 1.4, py + 7.4, 1.8, 3.2, pz, 1, 'red'), 0.3);
    S.add(sphere([px, py - 0.4, pz], 2.8, 'red'), 1);
    S.sub(sphere([px + 1.6, py, pz + 2.2], 1.7, 'void'), 0.3);
    S.add(torus([px - 0.3, py - 4.4, pz], 2.2, 0.5, 0.4, 'gold'), 0);
    post.push((fr) => { dot(fr, px + 1, py - 0.2, 'flame1'); dot(fr, px + 2.4, py - 0.2, 'flame1'); });
  },
  bowl(S, h) {
    S.add(clip(ellipsoid([h[0] + 1.6, h[1] - 0.8, h[2] + 1.2], [2.7, 1.6, 2.2], 'wood'), (x, y) => (h[1] - 1.4) - y), 0.3);
    S.sub(ellipsoid([h[0] + 1.6, h[1] - 1.6, h[2] + 1.2], [2, 1, 1.6], 'wood'), 0.2);
  },
  book(S, h) {
    S.add(box([h[0] + 1.6, h[1] - 1, h[2] + 1.2], [2.2, 2.6, 1], 0.3, 'red'), 0.2);
    S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (h[0] + 1.6)) - 0.4, Math.abs(y - (h[1] - 1.4)) - 1.4, -z + h[2] + 1.8), mat: 'gold' });
  },
};

// ------------------------------------------------------------ the cast ---
const CAST = {
  // Sister Odile: slate habit, white wimple, praying with a rosary.
  odile: { robe: 'habit', head: 'nun', prop: 'rosary', skin: 'pale', belt: 'leather' },
  // Hollis the smith: broad, bald, bearded, leather apron, hammer.
  hollis: { robe: 'tunic', skirtLen: 'tunic', legs: 'hairDark', build: 1.2, belly: true, apron: 'apronLeather', apronHigh: true, head: 'bald', beard: 'long', hair: 'hairGinger', prop: 'hammer', skin: 'red', bigNose: true, brow: 'skin4', sleeve: 'skinRed' },
  // Brother Pell: brown habit, tonsure, rope belt, rosary of "relics".
  pell: { robe: 'brownHabit', head: 'tonsure', hair: 'hairGrey', prop: 'book', belt: 'bone', belly: true, smile: true },
  // The Bookie: crimson waistcoat over a pale shirt, apron, mug.
  barkeep: { robe: 'red', sleeve: 'apronCloth', skirtLen: 'tunic', legs: 'hairDark', apron: 'apronCloth', head: 'hair', hair: 'hairDark', prop: 'mug', belly: true, brow: 'shroud3' },
  // The town crier: crimson coat, tall black hat, handbell.
  crier: { robe: 'red', skirtLen: 'tunic', legs: 'hatInk', head: 'hair', hair: 'hairGinger', hat: 'tall', prop: 'bell', belt: 'gold' },
  peasant: { robe: 'tunic', skirtLen: 'tunic', legs: 'rags', head: 'shaggy', hair: 'hairBrown', belt: 'leather', hunch: 1 },
  peasant2: { robe: 'dress', head: 'scarf', veil: 'tunic', apron: 'apronCloth' },
  guard: { robe: 'mail', skirtLen: 'tunic', legs: 'mail', tabard: 'red', head: 'bald', hat: 'kettle', prop: 'spear', belt: 'leather', brow: 'skin4', build: 1.08 },
  penitent: { robe: 'skinPale', sleeve: 'skinPale', skirtLen: 'tunic', skirt: 'rags', legs: 'skinPale', shoe: 'skinPale', head: 'hood', hoodM: 'rags', prop: 'whip', skin: 'pale', hunch: 1, scars: true, eyes: true },
  priest: { robe: 'purple', head: 'tonsure', hair: 'hairDark', stole: 'gold', prop: 'rosary', belly: true },
  plushseller: { robe: 'dress', skirtLen: 'long', head: 'hair', hair: 'hairGinger', apron: 'apronCloth', prop: 'plush', smile: true },
  vane: { robe: 'white', head: 'bald', hat: 'mitre', stole: 'gold', prop: 'rosary', skin: 'old', build: 0.92, brow: 'sand4' },
  beggar: { robe: 'rags', head: 'shaggy', hair: 'hairGrey', beard: 'long', prop: 'bowl', hunch: 2, skin: 'old', halo: true, legs: 'rags' },
};

function idle(id) {
  return [0, 1].map((i) => person(CAST[id], { bob: i, t: i }));
}
function walk(id) {
  const steps = [-1, 0, 1, 0];
  return [0, 1, 2, 3].map((i) => person(CAST[id], { step: steps[i], swing: steps[i] * 0.8, bob: i % 2 ? -1 : 0, t: i }));
}


// ---------------------------------------------------------- children ---
// Two children playing Saint and Bellwright. Frame 20x30, feet on y 27.
function child(t, v) {
  const S = new Scene(), G = 27, cx = 9, B = t % 2 ? -1 : 0;
  const robe = v ? 'moss' : 'red', steps = [-1, 0, 1, 0], st = steps[t];
  for (const side of [-1, 1]) {
    const sw = side * st * 2.2, hz = side * 1.1;
    S.add(capsule([cx, G - 8 + B, hz], [cx + sw, G - 2, hz], 1.4, 1.2, 'tunic'), 0.5);
    S.add(ellipsoid([cx + sw + 0.8, G - 0.9, hz], [1.6, 1, 1.2], 'leather'), 0.5);
  }
  S.add(ellipsoid([cx, G - 12 + B, 0], [2.8, 3.6, 2.3], robe), 0);
  S.add(folds(skirt(cx + 0.2, G - 11 + B, G - 5 + B * 0.5, 2.8, 3.8, 0, 1, robe), { cx: cx + 0.2, n: 6, amp: 0.35, y0: G - 11, y1: G - 5 }), 1);
  S.add(capsule([cx - 2.2, G - 14.6 + B, -1.6], [cx - 2.6 - st, G - 10 + B, -1.6], 1.2, 1, robe), 0.6);
  S.add(sphere([cx - 2.6 - st, G - 9.6 + B, -1.6], 0.95, 'skin'), 0.4);
  const fh = v ? [cx + 4.4, G - 14 + B, 2] : [cx + 2.6 + st, G - 10 + B, 1.8];
  S.add(capsule([cx + 2.2, G - 14.6 + B, 1.6], fh, 1.2, 1, robe), 0.6);
  S.add(sphere(fh, 0.95, 'skin'), 0.4);
  const hx = cx + 0.6, hy = G - 19.2 + B;
  S.add(sphere([hx, hy, 0.2], 3.6, 'skin'), 1);
  S.add(sphere([hx + 3.4, hy + 0.6, 1.2], 0.75, 'skin'), 0.4);
  const hair = bumpy(sphere([hx - 0.6, hy - 0.8, -0.2], 3.9, v ? 'hairDark' : 'hairBrown'), 0.25, 1.2, v * 5);
  S.paint({ f: (x, y, z) => Math.max(Math.hypot(x - hx, y - hy, z - 0.2) - 5, -(x - hx - 0.3), (hy - 1.1) - y), mat: 'skinFace' });
  S.add(clip(hair, (x, y) => (y - (hy - 1)) + Math.max(0, -(x - hx)) * 1.1), 0.3);
  if (!v) { // playing the Saint: a cardboard halo on a stick
    S.add(torus([hx - 0.8, hy - 5.8, 0], 3, 0.55, 0.45, 'gold'), 0);
  } else { // the Bellwright's bell
    S.add(skirt(fh[0] + 1, fh[1] + 0.4, fh[1] + 4, 0.9, 2.2, fh[2] + 0.4, 1, 'gold'), 0.4);
  }
  const fr = render(S, 20, 30, M, { ground: G });
  dot(fr, hx + 1.3, hy + 0.1, 'ink0'); dot(fr, hx + 3, hy + 0.1, 'ink0'); dot(fr, hx + 2.6, hy + 2, 'skin3h');
  fr.ax = 9; fr.ay = G;
  return fr;
}

// -------------------------------------------------------------- crows ---
// Frames 0-1 perched (1 pecks), 2-3 in flight (wings up, wings down). 16x13.
function crow(i) {
  const S = new Scene(), W = 16, H = 13;
  if (i < 2) {
    const peck = i === 1;
    S.add(ellipsoid([7, 8, 0], [3.6, 2.6, 2.4], 'ink'), 0);
    S.add(capsule([4, 8, 0], [1.2, 9.6, 0], 1.6, 0.5, 'ink'), 0.6);
    const hd = peck ? [11, 9, 0.4] : [10.2, 5, 0.4];
    S.add(sphere(hd, 1.8, 'ink'), 1);
    S.add(capsule([hd[0] + 1, hd[1] + 0.3, 0.4], [hd[0] + 3.4, hd[1] + (peck ? 1.6 : 0.8), 0.4], 0.75, 0.2, 'gold'), 0.2);
    const fr = render(S, W, H, { ...M, ink: { ramp: 'ink', bias: 0.12, min: 0, spec: 0.5 } }, { ground: 12 });
    dot(fr, hd[0] + 0.6, hd[1] - 0.5, 'bone0');
    pline(fr, 6, 11, 6, 12, 'ink2'); pline(fr, 8, 11, 8.6, 12, 'ink2');
    fr.ax = 7; fr.ay = 12;
    return fr;
  }
  const up = i === 2;
  S.add(ellipsoid([8, 7, 0], [3.4, 1.8, 1.8], 'ink'), 0);
  S.add(sphere([11.6, 6.4, 0.3], 1.6, 'ink'), 0.8);
  S.add(capsule([12.6, 6.6, 0.3], [14.6, 7, 0.3], 0.6, 0.15, 'gold'), 0.2);
  S.add(capsule([5, 7.2, 0], [2, 8, 0], 1.2, 0.4, 'ink'), 0.5);
  for (const z of [-1.5, 1.5]) S.add(capsule([8, 6.4, z], [up ? 4.6 : 5, up ? 1 : 11.6, z * 1.6], 1.2, 0.4, 'ink'), 0.8);
  const fr = render(S, W, H, { ...M, ink: { ramp: 'ink', bias: 0.12, min: 0, spec: 0.5 } }, { ground: 99 });
  dot(fr, 12.2, 6, 'bone0');
  fr.ax = 8; fr.ay = 9;
  return fr;
}

// ------------------------------------------------------ the portrait ---
// A bust of the Saint for the dialog box: hood, gilt-rimmed void, eyes. 34x34.
function portrait() {
  const S = new Scene(), cx = 16, hy = 16;
  // Shoulders and mantle, with the gold stole.
  S.add(ellipsoid([cx, 33, -1], [14, 7, 7], 'crimson'), 0);
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (cx + 3)) - 2.2, 27 - y, -z + 1), mat: 'gold' });
  S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - (cx + 3)) - 1.5, Math.abs(y - 31) - 0.55), Math.max(Math.abs(x - (cx + 3)) - 0.55, Math.abs(y - 31) - 1.8)) + (z < 1 ? 9 : 0), mat: 'crimson' });
  // The hood, its folds and the point falling back.
  const hood = ellipsoid([cx, hy, 0], [9.8, 9.4, 8.6], 'crimson');
  S.add(folds(hood, { cx, cz: 0, n: 7, amp: 0.3, y0: hy - 9, y1: hy + 9 }), 2.6);
  S.add(capsule([cx - 4, hy - 6, -2], [cx - 11, hy - 9, -5], 5, 1.4, 'crimson'), 2.6);
  // The hollow where a face should be, nearly facing us.
  const fc = [cx + 2.2, hy + 1.6, 7.6];
  const cut = ellipsoid(fc, [5, 6, 4.8], 'void');
  S.sub(cut, 1);
  S.paint({ f: (x, y, z) => Math.max(cut.f(x, y, z) - 1.4, -hood.f(x, y, z) - 1.2), mat: 'gold' });
  S.add(torus([cx - 0.6, hy - 11.6, 0], 7.4, 1.1, 0.42, 'halo'), 0);
  S.sub(sphere([cx + 5.4, hy - 11.4, 3.4], 1.6), 0);
  const fr = render(S, 34, 34, MATS, { ground: 99 });
  for (const ex of [fc[0] - 2.1, fc[0] + 1.9]) { dot(fr, ex, fc[1] - 1.2, 'flame0'); dot(fr, ex, fc[1] - 0.2, 'flame1'); dot(fr, ex, fc[1] + 0.8, 'flame3'); }
  return fr;
}

export default {
  town: { odile: () => idle('odile'), hollis: () => idle('hollis'), pell: () => idle('pell'), barkeep: () => idle('barkeep'), crier: () => idle('crier') },
  town2: {
    peasant_walk: () => walk('peasant'), peasant2_walk: () => walk('peasant2'), guard_walk: () => walk('guard'), penitent_walk: () => walk('penitent'), priest_walk: () => walk('priest'),
    plushseller: () => idle('plushseller'), vane: () => idle('vane'), beggar: () => idle('beggar'),
    kid: () => [0, 1, 2, 3].map((t) => child(t, 0)), kid2: () => [0, 1, 2, 3].map((t) => child(t, 1)),
    crow: () => [0, 1, 2, 3].map(crow),
  },
  ui: { portrait: () => [portrait()] },
};
