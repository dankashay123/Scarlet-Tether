// The Hushed Cherub: a swollen infant gilded for the cathedral ceiling, its
// mouth sewn so it cannot cry. The leaf is peeling, the feathers plucked.
import {
  BLOOD, OLD_BLOOD, GOLD, RAW, BONE, MOUTH, CATGUT,
  anim, scaled, back, dome, loc, pool, renderFig, ridge, skinMat, stitches, toLocal, tube, vn, vnOf, frame, fgrain,
  type AnimDef, type Material, type V2,
} from './common';

// footY puts the sprite centre on the body's centre (13px above its feet)
/** Design canvas (the drawing code's units) and its scale to output pixels. */
const D = { w: 64, h: 64, footY: 45 };
const S = 0.4;
export const CHERUB = scaled(D, S);

const SKIN = '#d4aa98';
const LIP: Material = { ramp: ['#1a0608', '#4a1418', '#7a2a34', '#a24a54', '#c87878'], spec: 0.6, glint: '#ffd8d0', dither: 0.2 };
const CORD: Material = { ramp: ['#1a0a14', '#3e1a2e', '#6a3048', '#8e4a60', '#b4707e', '#d8a0a4'], spec: 0.8, glint: '#ffe0e8', shine: 24, dither: 0.3, bump: (x, y) => (((x + y * 2) % 4) < 1.2 ? -1 : 0.3) };
const PLUCKED: Material = { ramp: ['#200810', '#4a1622', '#783040', '#a04a58', '#c46e74', '#e09a94'], spec: 0.5, tex: (x, y) => (vn(x, y, 2, 72) - 0.5) * 0.1, bump: (x, y) => (vn(x, y, 1.3, 71) > 0.72 ? 0.9 : 0), round: 0.4, dither: 0.35 };
const FEATHER: Material = { ramp: ['#2a2218', '#5a4c3a', '#8a7c64', '#b4a688', '#d6caae', '#f0e8d4'], round: 0.35, dither: 0.25, wrap: 0.3, tex: fgrain(1.4, 0.05, 81) };
const boneM: Material = { ...BONE, ramp: ['#2a1a14', '#5a4438', '#8a7464', '#b8a48e', '#e0d2bc'] };
const leafN = vnOf(3.4, 91);
const GILT: Material = { ...GOLD, ramp: ['#1a0e04', '#3a240a', '#5e3e12', '#86601e', '#ad842c', '#cfa648', '#ecca76'], shine: 70 };
const LEAF_EDGE = back(skinMat(SKIN, 0.45), 0.45);

interface CP {
  c: V2;
  th: number;
  wing: number; // wing elevation (radians, 0 = straight back)
  wingB?: number;
  /** Wingtip lag behind the arm (follow-through), radians. */
  lag?: number;
  cord: number; // cord sway phase
  cordDir?: V2; // cord fall direction (default down)
  hurt?: boolean;
  dead?: boolean;
  t: number;
}

type F = ReturnType<typeof frame>;

/** A plucked angel's wing: bony arm, a few surviving primaries, bloody quills where the rest were. */
function wing(f: F, root: V2, a: number, len: number, lag: number, m: Material, fe: Material, bone: Material, layer: number, crumple = 0) {
  const dir = (ang: number): V2 => [-Math.cos(ang), -Math.sin(ang)];
  const d0 = dir(a);
  const elbow: V2 = [root[0] + d0[0] * len * 0.38, root[1] + d0[1] * len * 0.38];
  const d1 = dir(a - 0.5 - crumple * 0.6 + lag * 0.4);
  const wrist: V2 = [elbow[0] + d1[0] * len * 0.32, elbow[1] + d1[1] * len * 0.32];
  // bare, plucked skin webbing the arm
  f.poly([root, elbow, wrist, [wrist[0] + (root[0] - wrist[0]) * 0.3, wrist[1] + 3.5], [root[0] + 1, root[1] + 3]], m, layer);
  f.capsule(root[0], root[1], elbow[0], elbow[1], 1.6, 1.2, bone, layer + 0.1);
  f.capsule(elbow[0], elbow[1], wrist[0], wrist[1], 1.2, 0.9, bone, layer + 0.1);
  f.ellipse(elbow[0], elbow[1], 1.5, 1.5, bone, layer + 0.12);
  // primaries: long feathers fanning from the wrist and forearm; some torn out
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    const base: V2 = [wrist[0] + (elbow[0] - wrist[0]) * t * 0.9, wrist[1] + (elbow[1] - wrist[1]) * t * 0.9];
    const fa = a - 0.1 - k * (0.24 - crumple * 0.14) + crumple * 0.9 - lag * (1 - t);
    const L = len * (0.66 - k * 0.055);
    const tip: V2 = [base[0] + dir(fa)[0] * L, base[1] + dir(fa)[1] * L];
    if (k === 2 || k === 5) {
      // plucked: a bloody quill stub
      const q: V2 = [base[0] + dir(fa)[0] * 2.5, base[1] + dir(fa)[1] * 2.5];
      f.capsule(base[0], base[1], q[0], q[1], 0.5, 0.35, fe, layer + 0.05);
      f.ellipse(base[0], base[1] + 0.6, 0.7, 0.8, BLOOD, layer + 0.15);
      continue;
    }
    const mid: V2 = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2 + 0.6];
    // a broad vane narrowing to a ragged tip; each overlaps the one behind it
    tube(f, [base, mid, tip], 2.3 - k * 0.1, 0.6, fe, layer - 0.05 - k * 0.004);
    ridge(f, [base, mid, tip], 0.45, -0.9, [fe]); // the shaft groove
  }
  // ragged coverts along the arm
  for (let k = 0; k < 3; k++) {
    const q: V2 = [root[0] + (elbow[0] - root[0]) * (0.35 + k * 0.3), root[1] + (elbow[1] - root[1]) * (0.35 + k * 0.3)];
    f.ellipse(q[0] + 0.5, q[1] + 1.4, 1.8, 1.2, fe, layer + 0.08, a);
  }
}

function drawCherub(p: CP) {
  const { w, h } = D;
  const f = frame(w, h, S);
  const skin = skinMat(SKIN, 0.45, fgrain(1.5, 0.04, 2));
  const skinB = back(skin, 0.3);
  const { c, th } = p;
  const P = (u: number, v: number) => loc(c, th, u, v);
  const lag = p.lag ?? 0;

  // ---- far wing ------------------------------------------------------------------
  const wroot = P(-5, -3);
  wing(f, [wroot[0] + 2, wroot[1] - 1], (p.wingB ?? p.wing) + th * 0.2 + 0.15, 19, lag, back(PLUCKED, 0.3), back(FEATHER, 0.3), back(boneM, 0.25), 1, p.dead ? 1 : 0);

  // ---- umbilical cord ---------------------------------------------------------------
  const navel = P(1, -11);
  const cd = p.cordDir ?? [0, 1];
  const cord: V2[] = [navel];
  for (let k = 1; k <= 7; k++) {
    const t = k / 7;
    const sway = Math.sin(p.cord + k * 0.9) * (1.5 + t * 3);
    cord.push([navel[0] + cd[0] * t * 17 - cd[1] * sway, navel[1] + cd[1] * t * 17 + cd[0] * sway]);
  }
  tube(f, cord, 1.6, 1.0, CORD, 2);
  const end = cord[cord.length - 1];
  f.ellipse(end[0], end[1], 1.8, 1.5, RAW, 2.1);
  f.ellipse(end[0] + cd[0] * 1.5, end[1] + cd[1] * 1.5 + 1, 0.8, 1.2, BLOOD, 2.2);

  // ---- body: pot belly, a stump where the legs should be ---------------------------
  const belly = P(-1, -9);
  f.ellipse(belly[0], belly[1], 6.8, 7.6, skin, 3, th);
  f.ellipse(...P(1.5, -12), 4.6, 3.6, skin, 3.05, th);
  dome(f, ...P(1.5, -10), 4.5, 5, 2, th, [skin]); // round belly
  ridge(f, [P(-4, -4.5), P(0, -3.8), P(4, -4.6)], 0.8, -1.2, [skin]); // fat crease under the chin
  const stump = P(-2, -16);
  f.ellipse(stump[0], stump[1], 4.4, 2.8, skin, 3.02, th);
  f.stain((x, y) => {
    const [u, v] = toLocal(stump, th, x, y);
    return (u * u) / 14 + (v * v) / 4 < 1 && v < 0.2;
  }, RAW, [skin], [stump[0] - 6, stump[1] - 6, stump[0] + 6, stump[1] + 6]);
  stitches(f, P(-5.5, -16.5), P(1.5, -16.5), 4, 1.2, 3.2, CATGUT);
  f.ellipse(navel[0], navel[1] + 0.5, 1.5, 1.2, RAW, 3.3);
  // tiny back arm
  f.capsule(...P(-1.5, -5), ...P(1.5, -10), 1.6, 1.3, skinB, 2.5);
  f.ellipse(...P(2.5, -11), 1.6, 1.5, skinB, 2.55);

  // ---- the head: an infant's swollen skull (drawn larger, so the face reads) -----------
  const neck = P(3, -4);
  f.zoom(neck[0], neck[1], 1.25);
  f.ellipse(...P(-1, 6.5), 10, 9.4, skin, 5, th); // cranium
  f.ellipse(...P(4.5, 1.5), 7, 7, skin, 5.02, th); // face
  f.ellipse(...P(7.5, -2), 4.4, 3.8, skin, 5.1, th); // fat cheek
  f.ellipse(...P(6.5, -5.2), 3.4, 2.4, skin, 5.08, th); // chin
  f.ellipse(...P(11.2, 1.2), 1.3, 1.5, skin, 5.2, th); // button nose
  dome(f, ...P(7.6, -2), 3.6, 3.2, 1.8, th, [skin]);
  dome(f, ...P(7.5, 4.6), 3.6, 2.2, 1.6, th, [skin]); // brow
  dome(f, ...P(-2.5, 13), 2.4, 1.6, -1.4, th, [skin]); // fontanelle
  ridge(f, [P(3.5, -5), P(6.5, -7.2), P(9.5, -6.4)], 0.8, -1.3, [skin]); // double chin
  // ear
  const ear = P(-0.5, 2.5);
  f.ellipse(ear[0], ear[1], 2.1, 2.8, back(skin, 0.12), 5.12, th);
  dome(f, ear[0], ear[1], 1.1, 1.6, -1.6, th, [back(skin, 0.12)]);
  // a swollen, gummed-shut eye, weeping blood
  const eye = P(8, 2.8);
  f.ellipse(eye[0], eye[1], 2.6, 1.8, skin, 5.14, th);
  dome(f, eye[0], eye[1], 2.4, 1.6, 1.4, th, [skin]);
  f.stain((x, y) => {
    const [u, v] = toLocal(eye, th, x, y);
    return Math.abs(v + u * u * 0.08 + 0.1) < 0.42 && Math.abs(u) < 2.3;
  }, { ramp: ['#0b0507', '#2a0a10', '#4a1018'], round: 0 }, [skin], [eye[0] - 4, eye[1] - 4, eye[0] + 4, eye[1] + 4]);
  f.stain((x, y) => Math.abs(x - eye[0] - 0.8 - Math.sin(y * 0.7) * 0.3) < 0.55 && y > eye[1] + 0.8 && y < eye[1] + 8, BLOOD, [skin], [eye[0] - 2, eye[1], eye[0] + 3, eye[1] + 9]);
  // the sewn mouth: pursed lips stitched together, crusted
  const m = P(9.6, -3.6);
  f.capsule(...P(8.2, -3.1), ...P(11.4, -3.1), 1.1, 0.9, LIP, 5.16);
  f.capsule(...P(8.3, -4.5), ...P(11, -4.4), 1.1, 0.95, LIP, 5.15);
  f.capsule(...P(7.2, -3.8), ...P(11.6, -3.8), 0.35, 0.35, MOUTH, 5.17);
  stitches(f, P(8.2, -3.8), P(11.4, -3.8), 3, 1.7, 5.2);
  f.stain((x, y) => Math.hypot(x - m[0], y - m[1]) < 3.2 && vn(x, y, 1, 7) > 0.7, BLOOD, [LIP, skin], [m[0] - 4, m[1] - 4, m[0] + 4, m[1] + 4]);

  f.zoom();

  // ---- front arm: a tiny fist clutching nothing ------------------------------------
  tube(f, [P(3, -5), P(6, -9), P(7.5, -12)], 1.8, 1.4, skin, 6);
  f.ellipse(...P(8, -13), 1.9, 1.8, skin, 6.1);
  dome(f, ...P(8, -13), 1.5, 1.5, 1, 0, [skin]);

  // ---- gold leaf over the crown and back, peeling at the edges ----------------------------
  const hc = P(-1, 6.5);
  const gilt = (x: number, y: number) => {
    const [u, v] = toLocal(hc, th, x, y);
    // the gilder worked from the back of the skull forward; the face was left bare
    return v * 0.35 - u * 0.6 + 1.2 + (leafN(x, y) - 0.5) * 7;
  };
  f.stain((x, y) => gilt(x, y) > 0.6, GILT, [skin, skinB]);
  f.stain((x, y) => {
    const g = gilt(x, y);
    return g > -0.4 && g <= 0.6;
  }, LEAF_EDGE, [skin, skinB]);
  // raw skin where flakes have torn away, inside the gilt
  f.stain((x, y) => gilt(x, y) > 1 && vn(x, y, 2.2, 93) > 0.76, RAW, [GILT]);
  // the leaf has a thickness: its lifted edges catch the light
  f.relief((x, y) => {
    const g = gilt(x, y);
    return g > 0.6 && g < 1.6 ? 0.9 : 0;
  }, undefined, [GILT]);
  // curled flakes drifting off
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + p.t * 2;
    const r = 15 + (k % 2) * 3;
    const q: V2 = [c[0] - 4 + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.8];
    if (!f.has(q[0], q[1]) && !f.has(q[0] + 2, q[1]) && !f.has(q[0] + 1, q[1] + 2)) f.poly([[q[0], q[1]], [q[0] + 2, q[1] - 0.6], [q[0] + 1.2, q[1] + 1.6]], GOLD, 7);
  }

  // ---- near wing -------------------------------------------------------------------------
  wing(f, wroot, p.wing + th * 0.2, 22, lag, PLUCKED, FEATHER, boneM, 8, p.dead ? 1.2 : 0);

  if (p.hurt) f.stain((x, y) => vn(x, y, 2.4, 44) > 0.72, BLOOD, [skin, skinB, PLUCKED, GILT]);
  if (p.dead) f.stain((x, y) => vn(x, y, 1.8, 45) > 0.66, OLD_BLOOD, [skin, skinB, GILT]);
  return renderFig(f);
}

function drawDead() {
  const { w, h } = D;
  const body = drawCherub({ c: [30, 52], th: -Math.PI / 2 + 0.15, wing: 2.6, wingB: 2.2, cord: 1, cordDir: [1, 0.08], dead: true, t: 0.4 });
  const f = frame(w, h, S);
  pool(f, 32, h - 2.5, 24, BLOOD, 3);
  const under = renderFig(f);
  under.blit(body, 0, 0);
  return under;
}

export function cherubAnims(): AnimDef[] {
  const C: V2 = [33, 30];
  // one wingbeat: a fast downstroke, a slower recovery; the body lifts on the downstroke
  const beat = [
    { wing: 1.25, lag: -0.25, dy: 1 },
    { wing: 0.75, lag: 0.15, dy: 0.5 },
    { wing: 0.05, lag: 0.45, dy: -1 },
    { wing: -0.55, lag: 0.25, dy: -2 },
    { wing: -0.2, lag: -0.3, dy: -1 },
    { wing: 0.6, lag: -0.45, dy: 0.5 },
  ];
  return [
    anim('fly', beat.map((b, i) => drawCherub({ c: [C[0], C[1] + b.dy], th: 0.1 + b.dy * 0.02, wing: b.wing, lag: b.lag, cord: i * 1.05, t: i / 6 })), 12),
    // rears back, wings high, the cord whipping under it
    anim('windup', [
      drawCherub({ c: [C[0] - 1, C[1]], th: -0.15, wing: 0.9, lag: -0.2, cord: 0.2, cordDir: [0.1, 1], t: 0.1 }),
      drawCherub({ c: [C[0] - 2, C[1] - 1], th: -0.35, wing: 1.25, lag: -0.3, cord: 0.4, cordDir: [0.2, 1], t: 0.15 }),
      drawCherub({ c: [C[0] - 3, C[1] - 2], th: -0.48, wing: 1.4, lag: -0.1, cord: 0.6, cordDir: [0.3, 1], t: 0.2 }),
    ], 6, 0),
    // the dive: wings swept back, a shiver of the tips
    anim('dive', [0, 1, 2].map((i) => drawCherub({ c: [C[0] + 1, C[1] + 1], th: 0.85 + i * 0.1, wing: 0.2 - i * 0.12, lag: 0.3 - i * 0.25, cord: i * 2, cordDir: [-0.7, 0.7], t: 0.5 + i * 0.15 })), 12),
    anim('stagger', [
      drawCherub({ c: [C[0] - 2, C[1]], th: -0.75, wing: -0.3, wingB: 1.0, lag: 0.4, cord: 3, cordDir: [0.5, 1], hurt: true, t: 0.7 }),
      drawCherub({ c: [C[0] - 3, C[1] + 1], th: -0.55, wing: 0.4, wingB: 1.2, lag: -0.3, cord: 3.8, cordDir: [0.4, 1], hurt: true, t: 0.8 }),
      drawCherub({ c: [C[0] - 2, C[1] + 1], th: -0.3, wing: 1.0, lag: -0.2, cord: 4.6, cordDir: [0.2, 1], hurt: true, t: 0.9 }),
    ], 8, 0),
    // falling: it tumbles, then lies on its back in the blood
    anim('dead', [
      drawCherub({ c: [32, 44], th: 0.9, wing: 1.8, wingB: 1.4, lag: 0.6, cord: 1, cordDir: [-0.5, -0.8], hurt: true, t: 0.2 }),
      drawCherub({ c: [31, 49], th: -0.7, wing: 2.4, wingB: 2.0, lag: 0.3, cord: 2, cordDir: [0.8, -0.3], hurt: true, dead: true, t: 0.3 }),
      drawDead(),
    ], 10, 0),
  ];
}
