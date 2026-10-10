// The Hushed Cherub: a swollen infant gilded for the cathedral ceiling, its
// mouth sewn so it cannot cry. The leaf is peeling.
import {
  BLOOD, OLD_BLOOD, GOLD, RAW, BONE, MOUTH,
  anim, back, loc, pool, renderFig, skinMat, stitches, toLocal, tube, valueNoise, hash2, frame, grain,
  type AnimDef, type Material, type V2,
} from './common';

// footY puts the sprite centre on the body's centre (13px above its feet)
export const CHERUB = { w: 64, h: 64, footY: 45 };

const SKIN = '#cfa898';
const LIP: Material = { ramp: ['#1a0608', '#4a1418', '#7a2a34', '#a24a54', '#c87878'], spec: 0.5 };
const CORD: Material = { ramp: ['#1a0a14', '#3e1a2e', '#6a3048', '#8e4a60', '#b4707e', '#d8a0a4'], spec: 0.8, tex: (x, y) => (((x + y * 2) % 4) < 1 ? -0.15 : 0.03) };
const PLUCKED: Material = { ramp: ['#200810', '#4a1622', '#783040', '#a04a58', '#c46e74', '#e09a94'], spec: 0.5, tex: (x, y) => (hash2(x, y, 71) > 0.8 ? 0.18 : 0) + (valueNoise(x, y, 2, 72) - 0.5) * 0.1, round: 0.4 };

interface CP {
  c: V2;
  th: number;
  wing: number; // wing elevation (radians, 0 = straight back)
  wingB?: number;
  cord: number; // cord sway phase
  cordDir?: V2; // cord fall direction (default down)
  hurt?: boolean;
  dead?: boolean;
  t: number;
}

function wing(f: ReturnType<typeof frame>, root: V2, a: number, len: number, m: Material, bone: Material, layer: number, crumple = 0) {
  const dir = (ang: number): V2 => [-Math.cos(ang), -Math.sin(ang)];
  const d0 = dir(a);
  const elbow: V2 = [root[0] + d0[0] * len * 0.45, root[1] + d0[1] * len * 0.45];
  const tips: V2[] = [];
  for (let k = 0; k < 4; k++) {
    const ang = a + 0.1 - k * (0.4 - crumple * 0.25) + crumple * 0.8;
    const dk = dir(ang);
    const L = len * (0.7 - k * 0.08);
    tips.push([elbow[0] + dk[0] * L, elbow[1] + dk[1] * L]);
  }
  // membrane: torn, plucked skin stretched between the finger-bones
  const mem: V2[] = [root, elbow, tips[0]];
  for (let k = 1; k < tips.length; k++) {
    const p = tips[k - 1];
    const q = tips[k];
    mem.push([(p[0] + q[0]) / 2 + (elbow[0] - (p[0] + q[0]) / 2) * 0.35, (p[1] + q[1]) / 2 + (elbow[1] - (p[1] + q[1]) / 2) * 0.35]);
    mem.push(q);
  }
  mem.push([root[0] + 1, root[1] + 3]);
  f.poly(mem, m, layer);
  f.capsule(root[0], root[1], elbow[0], elbow[1], 1.5, 1.1, bone, layer + 0.1);
  for (const tp of tips) f.capsule(elbow[0], elbow[1], tp[0], tp[1], 0.75, 0.35, bone, layer + 0.1);
  f.ellipse(elbow[0], elbow[1], 1.4, 1.4, bone, layer + 0.12);
  // quill stubs where feathers were pulled
  for (let k = 0; k < 4; k++) {
    const p = tips[k];
    const q: V2 = [(p[0] + elbow[0]) / 2, (p[1] + elbow[1]) / 2];
    f.ellipse(q[0], q[1] + 1, 0.5, 0.5, BLOOD, layer + 0.15);
  }
}

function drawCherub(p: CP) {
  const { w, h } = CHERUB;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.45, grain(1.5, 0.05, 2));
  const skinB = back(skin, 0.3);
  const { c, th } = p;
  const P = (u: number, v: number) => loc(c, th, u, v);
  const boneM: Material = { ...BONE, ramp: ['#2a1a14', '#5a4438', '#8a7464', '#b8a48e', '#e0d2bc'] };

  // ---- far wing ------------------------------------------------------------------
  const wroot = P(-5, -4);
  wing(f, [wroot[0] + 2, wroot[1] - 1], (p.wingB ?? p.wing) + th * 0.2 + 0.15, 19, back(PLUCKED, 0.3), back(boneM, 0.25), 1, p.dead ? 1 : 0);

  // ---- umbilical cord ---------------------------------------------------------------
  const navel = P(0, -16);
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

  // ---- torso: pot belly, tiny limbs ------------------------------------------------
  const belly = P(-1, -11);
  f.ellipse(belly[0], belly[1], 7.5, 8.2, skin, 3, th);
  f.ellipse(...P(2, -14), 5.2, 4.2, skin, 3.05, th);
  // a stump where the legs should be, puckered and stitched
  const stump = P(-2, -18);
  f.ellipse(stump[0], stump[1], 4.6, 2.8, skin, 3.02, th);
  f.stain((x, y) => {
    const [u, v] = toLocal(stump, th, x, y);
    return (u * u) / 14 + (v * v) / 4 < 1 && v < 0.2;
  }, RAW, [skin]);
  stitches(f, P(-5.5, -18.5), P(1.5, -18.5), 4, 1.3, 3.2);
  // the navel the cord leaves from
  f.ellipse(navel[0], navel[1] + 0.5, 1.6, 1.3, RAW, 3.3);
  // tiny back arm
  f.capsule(...P(-2, -6), ...P(1, -12), 1.7, 1.4, skinB, 2.5);
  f.ellipse(...P(2, -13), 1.6, 1.5, skinB, 2.55);

  // ---- the head --------------------------------------------------------------------------
  const hc = P(2, 4);
  f.ellipse(hc[0], hc[1], 12, 11, skin, 5, th);
  f.ellipse(...P(-3.5, 8), 9.5, 8.5, skin, 5.05, th); // swollen cranium
  f.ellipse(...P(-2, 10), 2.2, 1.5, back(skin, 0.18), 5.1, th); // fontanelle bulge
  // fat cheek, brow, nose, ear
  f.ellipse(...P(8, -1.5), 5.2, 4.6, skin, 5.2, th);
  f.ellipse(...P(8.6, 4.2), 3.5, 2.2, skin, 5.15, th);
  f.ellipse(...P(12.2, 1), 1.3, 1.6, skin, 5.25, th);
  f.ellipse(...P(-1.5, 2.5), 2.4, 3.2, back(skin, 0.15), 5.12, th);
  f.stain((x, y) => {
    const [u, v] = toLocal(P(-1.5, 2.5), th, x, y);
    return u * u + (v * v) / 2 < 1.4;
  }, back(skin, 0.5), [skin]);
  // swollen, gummed eye, weeping blood
  const eye = P(8.5, 2.6);
  f.ellipse(eye[0], eye[1], 2.8, 1.9, skin, 5.3, th);
  f.stain((x, y) => {
    const [u, v] = toLocal(eye, th, x, y);
    return Math.abs(v + u * u * 0.06 + 0.2) < 0.45 && Math.abs(u) < 2.4;
  }, { ramp: ['#0b0507', '#2a0a10', '#4a1018'], round: 0 }, [skin]);
  f.stain((x, y) => Math.abs(x - eye[0] - 0.8 - Math.sin(y * 0.7) * 0.3) < 0.6 && y > eye[1] + 0.8 && y < eye[1] + 8, BLOOD, [skin]);
  // the sewn mouth
  const m = P(9.5, -4);
  f.capsule(...P(6.5, -3.5), ...P(11.6, -3.4), 1.4, 1.1, LIP, 5.4);
  f.capsule(...P(6.6, -5), ...P(11.2, -5), 1.4, 1.2, LIP, 5.38);
  f.capsule(...P(6.4, -4.2), ...P(11.8, -4.2), 0.35, 0.35, MOUTH, 5.45);
  stitches(f, P(6.5, -4.2), P(11.5, -4.2), 4, 2, 5.5);
  f.stain((x, y) => Math.hypot(x - m[0], y - m[1]) < 4 && valueNoise(x, y, 1, 7) > 0.6, BLOOD, [LIP, skin]);

  // ---- front arm: a tiny fist clutching nothing ------------------------------------
  tube(f, [P(3, -6), P(6, -10), P(7.5, -13)], 1.9, 1.5, skin, 6);
  f.ellipse(...P(8, -14), 1.9, 1.8, skin, 6.1);

  // ---- gold leaf, peeling ------------------------------------------------------------
  const leaf = (x: number, y: number) => valueNoise(x, y, 3.2, 91);
  f.stain((x, y) => leaf(x, y) > 0.62, GOLD, [skin, skinB]);
  f.stain((x, y) => {
    const n = leaf(x, y);
    return n > 0.56 && n <= 0.62;
  }, back(skin, 0.42), [skin, skinB]);
  // raw skin where flakes have torn away
  f.stain((x, y) => valueNoise(x, y, 2.5, 93) > 0.8, RAW, [skin]);
  // curled flakes lifting off the skin
  for (let k = 0; k < 3; k++) {
    const a = k * 2.1 + p.t * 2;
    const r = 15 + (k % 2) * 3;
    const q: V2 = [c[0] - 4 + Math.cos(a) * r, c[1] + Math.sin(a) * r * 0.8];
    f.poly([[q[0], q[1]], [q[0] + 2, q[1] - 0.6], [q[0] + 1.2, q[1] + 1.6]], GOLD, 7);
  }

  // ---- near wing -------------------------------------------------------------------------
  wing(f, wroot, p.wing + th * 0.2, 22, PLUCKED, boneM, 8, p.dead ? 1.2 : 0);

  if (p.hurt) f.stain((x, y) => valueNoise(x, y, 1.6, 44) > 0.7, BLOOD, [skin, skinB, PLUCKED, GOLD]);
  if (p.dead) {
    f.stain((x, y) => valueNoise(x, y, 1.8, 45) > 0.66, OLD_BLOOD, [skin, skinB, GOLD]);
  }
  return renderFig(f);
}

function drawDead() {
  const { w, h } = CHERUB;
  const body = drawCherub({ c: [30, 52], th: -Math.PI / 2 + 0.15, wing: 2.6, wingB: 2.2, cord: 1, cordDir: [1, 0.08], dead: true, t: 0.4 });
  const f = frame(w, h);
  pool(f, 32, h - 2.5, 24, BLOOD, 3);
  const under = renderFig(f);
  under.blit(body, 0, 0);
  return under;
}

export function cherubAnims(): AnimDef[] {
  const C: V2 = [33, 30];
  const flaps = [1.15, 0.45, -0.55, 0.3];
  return [
    anim('fly', flaps.map((wg, i) => drawCherub({ c: [C[0], C[1] + (i === 2 ? -2 : i === 0 ? 1 : 0)], th: 0.1, wing: wg, cord: i * 1.6, t: i / 4 })), 10),
    anim('windup', [drawCherub({ c: [C[0] - 3, C[1] - 2], th: -0.45, wing: 1.35, cord: 0.5, cordDir: [0.25, 1], t: 0.2 })], 1, 0),
    anim('dive', [0, 1].map((i) => drawCherub({ c: [C[0] + 1, C[1] + 1], th: 0.85 + i * 0.2, wing: 0.15 - i * 0.12, cord: i * 2, cordDir: [-0.7, 0.7], t: 0.5 + i * 0.2 })), 12),
    anim('stagger', [drawCherub({ c: [C[0] - 2, C[1]], th: -0.75, wing: -0.3, wingB: 1.0, cord: 3, cordDir: [0.5, 1], hurt: true, t: 0.7 })], 1, 0),
    anim('dead', [drawDead()], 1, 0),
  ];
}
