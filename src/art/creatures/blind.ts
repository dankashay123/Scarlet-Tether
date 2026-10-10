// The Blissful Blind: a former Severed who gouged out their own eyes and
// smiles at the dark. And the saint the city insists it is.
import { solve, type Pose, type Proportions, type Joints } from '../rig';
import {
  BLOOD, OLD_BLOOD, NAIL, TEETH, MOUTH, VOID, MARBLE, HOLY, GOLD, BONE, RAW,
  anim, back, clothMat, drip, lineMask, loc, pool, renderFig, ring, skinMat, toLocal, tube,
  valueNoise, hash2, shade, frame, ramp, folds, type AnimDef, type Material, type V2,
} from './common';

export const BLIND = { w: 96, h: 80, footY: 74 };

const PR: Proportions = { torso: 23, neck: 4, thigh: 14, shin: 14, upperArm: 15, foreArm: 15, shoulderBack: 1 };

interface BlindOpts {
  saint: boolean;
  pose: Pose;
  /** Mouth opening 0..1 (attack shriek). */
  gape?: number;
  /** Claws/hand spread. */
  spread?: number;
  dead?: boolean;
  hurt?: boolean;
}

function ground(p: Pose, footY: number): Pose {
  const j = solve(p, PR);
  const low = Math.max(j.footF[1], j.footB[1]);
  return { ...p, y: p.y + (footY - 2 - low) };
}

const SKIN = '#a89a7c';

function drawBlind(o: BlindOpts) {
  const { w, h, footY } = BLIND;
  const f = frame(w, h);
  const p = o.pose;
  const j: Joints = solve(p, PR);
  const saint = o.saint;
  const skin: Material = saint ? MARBLE : skinMat(SKIN, 0.35);
  const skinB = back(skin, 0.32);
  const skinDeep = back(skin, 0.45);
  const rag = saint ? { ...clothMat('#e6dfd0', p.t, 9), ramp: ramp(['#4a443c', '#8c8476', '#b8b0a0', '#d8d0c0', '#efe9dc', '#fbf8f0'], 7) } : clothMat('#7a6a4a', p.t, 7);
  const ragB = back(rag, saint ? 0.12 : 0.3);
  const nail = saint ? MARBLE : NAIL;
  const [hx, hy] = j.hip;
  const [sx, sy] = j.shoulder;
  const spine = Math.atan2(sx - hx, hy - sy); // tilt of torso from vertical

  // ---- far limbs -----------------------------------------------------------
  const hand = (e: V2, hd: V2, m: Material, layer: number, spread: number) => {
    const ang = Math.atan2(hd[0] - e[0], hd[1] - e[1]);
    f.ellipse(hd[0], hd[1], 2.4, 2.8, m, layer, -ang);
    // long fingers ending in hooked nails
    for (let k = 0; k < 4; k++) {
      const a = ang + (k - 1.5) * (0.22 + spread * 0.2);
      const L = saint ? 4 : 6.5 - Math.abs(k - 1.5);
      const m1: V2 = [hd[0] + Math.sin(a) * L * 0.6, hd[1] + Math.cos(a) * L * 0.6];
      const tip: V2 = [hd[0] + Math.sin(a + 0.35) * L, hd[1] + Math.cos(a + 0.35) * L];
      f.capsule(hd[0], hd[1], m1[0], m1[1], 1.0, 0.8, m, layer + 0.1);
      if (saint) f.capsule(m1[0], m1[1], tip[0], tip[1], 0.8, 0.6, m, layer + 0.1);
      else {
        f.capsule(m1[0], m1[1], tip[0], tip[1], 0.9, 0.35, nail, layer + 0.2);
        const hook: V2 = [tip[0] + Math.sin(a + 1.4) * 1.6, tip[1] + Math.cos(a + 1.4) * 1.6];
        f.capsule(tip[0], tip[1], hook[0], hook[1], 0.45, 0.2, nail, layer + 0.2);
      }
    }
  };
  const arm = (sh: V2, el: V2, hd: V2, m: Material, layer: number, sleeve: Material) => {
    const sm = saint ? sleeve : m;
    f.capsule(sh[0], sh[1], el[0], el[1], saint ? 3.6 : 3.2, saint ? 3.2 : 2.3, sm, layer);
    f.ellipse(el[0], el[1], saint ? 3.2 : 2.5, saint ? 3.2 : 2.5, sm, layer + 0.05); // knobby elbow
    f.capsule(el[0], el[1], hd[0], hd[1], saint ? 3.2 : 2.3, saint ? 2.6 : 1.7, sm, layer);
    hand(el, hd, m, layer + 0.1, o.spread ?? 0);
  };
  const leg = (kn: V2, ft: V2, m: Material, layer: number) => {
    f.capsule(hx, hy, kn[0], kn[1], 4.2, 3.0, m, layer);
    f.ellipse(kn[0] + 0.5, kn[1], 2.9, 2.7, m, layer + 0.05);
    f.capsule(kn[0], kn[1], ft[0], ft[1], 2.8, 1.8, m, layer);
    // long splayed toes
    f.capsule(ft[0] - 1.5, ft[1], ft[0] + 5, ft[1] + 0.8, 1.9, 1.3, m, layer + 0.1);
    if (!saint) f.capsule(ft[0] + 5, ft[1] + 0.8, ft[0] + 7, ft[1] + 1.2, 0.7, 0.4, nail, layer + 0.15);
  };

  arm([sx - 1, sy + 1], j.elbowB, j.handB, skinB, 1, ragB);
  if (!saint) leg(j.kneeB, j.footB, skinB, 2);

  // ---- torso: a starved rib cage hunched over a sunken belly --------------
  const chest = loc([sx, sy], spine, 1.5, -7);
  f.capsule(hx, hy, chest[0], chest[1], 6.5, 8.0, skin, 4);
  f.ellipse(chest[0] + 0.5, chest[1] - 0.5, 8.5, 9.5, skin, 4.1, spine);
  // shoulder hump and spine knuckles along the back
  f.ellipse(sx - 2, sy + 1, 5.2, 4.6, skin, 4.15);
  for (let k = 0; k < 7; k++) {
    const pnt = loc([hx, hy], spine, -6.6 - Math.sin((k / 6) * Math.PI) * 2.5, 2 + k * 3.4);
    f.ellipse(pnt[0], pnt[1], 1.5, 1.3, skin, 4.2);
  }
  // ribs: grooves across the chest
  f.stain((x, y) => {
    const [u, v] = toLocal(chest, spine, x, y);
    if (u * u / 81 + v * v / 110 > 1 || v > 6) return false;
    const r = (v + u * u * 0.06 + 40) % 3.2;
    return r < 1.0;
  }, skinDeep, [skin]);
  // sunken belly and hip bones
  f.stain((x, y) => {
    const [u, v] = toLocal([hx, hy], spine, x, y);
    return u > 0 && u < 6 && v > 2 && v < 9 && hash2(x | 0, y | 0, 3) < 0.6;
  }, skinB, [skin]);
  // ---- loincloth -------------------------------------------------------------
  const lc: V2[] = [];
  const lcN = 7;
  const hipL = loc([hx, hy], spine, -7, 3);
  const hipR = loc([hx, hy], spine, 7, 3);
  for (let i = 0; i <= lcN; i++) {
    const t = i / lcN;
    const base = [lerpN(hipR[0], hipL[0], t), lerpN(hipR[1], hipL[1], t)];
    lc.push([base[0] + Math.sin(p.t * 6.28 + i) * 0.8, base[1] + 9 + (i % 2 ? 4 : 0) + hash2(i, 2, 5) * 4 + (saint ? 14 : 0)]);
  }
  if (saint) {
    // a long robe falling over both legs
    const hem: V2[] = [];
    const fx = Math.max(j.footF[0], j.footB[0]) + 4;
    const bx = Math.min(j.footF[0], j.footB[0]) - 6;
    for (let i = 0; i <= 8; i++) hem.push([lerpN(fx, bx, i / 8), footY - 1 + (i % 2) * 1.2]);
    f.poly([loc([sx, sy], spine, 6, 1), loc([hx, hy], spine, 8, 2), [j.kneeF[0] + 5, j.kneeF[1]], ...hem, [j.kneeB[0] - 6, j.kneeB[1] - 2], loc([hx, hy], spine, -9, 4), loc([sx, sy], spine, -7, 2)], rag, 5);
    f.capsule(...loc([hx, hy], spine, -7, 3), ...loc([hx, hy], spine, 7.5, 3), 1.4, 1.4, GOLD, 5.2);
  } else {
    f.poly([loc([hx, hy], spine, -7.5, 5), loc([hx, hy], spine, 7.5, 5), ...lc], rag, 5);
    f.capsule(...loc([hx, hy], spine, -7, 4.5), ...loc([hx, hy], spine, 7.5, 4.5), 1.3, 1.3, back(rag, 0.4), 5.1);
  }

  // ---- head -----------------------------------------------------------------
  const th = p.head; // face frame tilt (the neck cranes the face forward)
  const neckTop = loc([sx, sy], spine, 6, 1.5);
  const hc = loc(neckTop, th, 3.5, 2.5);
  f.capsule(sx + 1, sy + 1, neckTop[0], neckTop[1], 3.4, 2.6, skin, 6);
  f.ellipse(hc[0], hc[1], 6.6, 7.2, skin, 7, th);
  const jaw = loc(hc, th, 3.2, -4.8);
  const gape = o.gape ?? 0;
  f.ellipse(jaw[0], jaw[1] + gape * 1.5, 4.6, 2.8 + gape, skin, 7.05, th);
  const brow = loc(hc, th, 4.6, 0.8);
  f.ellipse(brow[0], brow[1], 2.4, 1.8, skin, 7.1, th);
  const nose = loc(hc, th, 6.4, -1.6);
  f.ellipse(nose[0], nose[1], 1.3, 1.8, skin, 7.15, th);
  const ear = loc(hc, th, -1.6, 0);
  f.ellipse(ear[0], ear[1], 1.6, 2.4, back(skin, 0.12), 7.12, th);
  const sock = loc(hc, th, 3.6, -0.7);

  if (saint) {
    // serene closed eye, faint smile, a veil of hair and the gilt halo
    f.stain(lineMask([loc(sock, th, -1.4, 0.2), loc(sock, th, 0, -0.5), loc(sock, th, 1.4, 0.1)], 0.45), back(skin, 0.5), [skin]);
    f.stain(lineMask([loc(hc, th, 3.6, -4.3), loc(hc, th, 5.3, -4.6)], 0.4), back(skin, 0.4), [skin]);
    const hood = clothMat('#ddd5c4', p.t, 11);
    f.ellipse(...loc(hc, th, -1.5, 1.6), 6.6, 6.4, { ...hood, ramp: rag.ramp }, 7.4, th);
    f.poly([loc(hc, th, -6.5, 1), loc(hc, th, 1, 4.5), loc(hc, th, -3, -12), loc(hc, th, -9, -10)], rag, 6.5);
    const halo = loc(hc, th, -2.5, 4.5);
    ring(f, halo[0], halo[1], 9, 9.5, 0.9, HOLY, 3, 0);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      f.ellipse(halo[0] + Math.cos(a) * 9.2, halo[1] + Math.sin(a) * 9.6, 0.8, 0.8, GOLD, 3.1);
    }
  } else {
    // stringy, thinning hair
    const hairM: Material = { ramp: ['#0b0507', '#241a14', '#3e2e22', '#5a4632'], tex: (x) => Math.sin(x * 2.1) * 0.15, round: 0.5 };
    for (let k = 0; k < 6; k++) {
      const r0 = loc(hc, th, -5.5 + k * 0.9, 5.4 - Math.abs(k - 3) * 0.5);
      const sway = Math.sin(p.t * 6.28 + k) * 1.2;
      tube(f, [r0, loc(hc, th, -5 - k * 0.3 + sway, 1 - k * 0.6), [r0[0] - 4 - k * 0.3 + sway, r0[1] + 9 + k * 1.1]], 0.7, 0.35, hairM, 7.5);
    }
    // the sockets: gouged, ragged, streaming
    f.stain((x, y) => {
      const [u, v] = toLocal(sock, th, x, y);
      return (u * u) / 6 + (v * v) / 3.4 <= 1;
    }, VOID, [skin]);
    f.stain((x, y) => {
      const [u, v] = toLocal(sock, th, x, y);
      const d = (u * u) / 6 + (v * v) / 3.4;
      return d > 1 && d <= 1.7;
    }, RAW, [skin]);
    f.ellipse(sock[0] - 0.6, sock[1] + 0.8, 0.9, 0.6, BLOOD, 7.3);
    // blood streaming down the face, neck and chest (gravity: straight down)
    const bx = sock[0];
    f.stain((x, y) => y > sock[1] && Math.abs(x - bx - Math.sin(y * 0.4) * 0.5) < 0.9 + (y - sock[1]) * 0.02 && y < sock[1] + 26, BLOOD, [skin]);
    f.stain((x, y) => y > sock[1] && Math.abs(x - bx + 1.8 - Math.sin(y * 0.3 + 1) * 0.6) < 0.6 && y < sock[1] + 14, BLOOD, [skin]);
    f.stain((x, y) => Math.abs(x - (bx - 1)) < 4.5 && y > sock[1] + 6 && y < sock[1] + 30 && valueNoise(x, y, 2, 61) > 0.58, OLD_BLOOD, [skin]);
    // the smile: a too-wide crescent from the chin back toward the ear, crammed with teeth
    const smile = (u: number) => -3.2 - (u - 2.5) * (u - 2.5) * -0.09 + 0.6;
    f.stain((x, y) => {
      const [u, v] = toLocal(hc, th, x, y);
      if (u < -0.5 || u > 7) return false;
      const c = smile(u) - gape * 1.4;
      return v < c + 0.7 && v > c - 0.9 - gape * 2.6;
    }, MOUTH, [skin]);
    for (let k = 0; k < 9; k++) {
      const u = -0.2 + k * 0.85;
      const c = smile(u) - gape * 1.4;
      const tu = loc(hc, th, u, c + 0.5);
      const tl = loc(hc, th, u + 0.4, c - 0.9 - gape * 2.6);
      f.ellipse(tu[0], tu[1], 0.55, 0.85 + (k % 3 === 1 ? 0.3 : 0), TEETH, 7.35);
      f.ellipse(tl[0], tl[1], 0.55, 0.7 + (k % 2) * 0.3, TEETH, 7.35);
    }
    // drool of blood from the grin
    const chin = loc(hc, th, 5.5, -5.5);
    drip(f, chin[0], chin[1], 3 + (p.t * 10) % 3, BLOOD, 7.4, 0.55);
  }

  // ---- near limbs --------------------------------------------------------------
  if (saint) {
    // feet peeking under the robe
    f.capsule(j.footF[0] - 1, j.footF[1], j.footF[0] + 4.5, j.footF[1] + 0.6, 1.8, 1.3, skin, 5.5);
  } else leg(j.kneeF, j.footF, skin, 6);
  arm([sx + 1, sy], j.elbowF, j.handF, skin, 9, rag);

  // ---- gore ----------------------------------------------------------------------
  if (!saint) {
    // bloodied claws and fingers (they did the gouging)
    for (const hd of [j.handF, j.handB])
      f.stain((x, y) => Math.hypot(x - hd[0], y - hd[1]) < 5 && valueNoise(x, y, 1.5, 9) > 0.5, BLOOD, [skin, skinB]);
    f.stain((x, y) => valueNoise(x, y, 2, 13) > 0.72, OLD_BLOOD, [rag, ragB]);
    f.stain((x, y) => y > footY - 4 && hash2(x | 0, y | 0, 8) < 0.55, BLOOD, [skin, skinB]);
    f.stain((x, y) => valueNoise(x, y, 3, 19) > 0.74, back(skin, 0.18), [skin]); // mottling
    // weeping self-inflicted gashes
    f.stain(lineMask([loc([hx, hy], spine, 2, 9), loc([hx, hy], spine, 6, 15)], 0.5), BLOOD, [skin]);
    if (o.hurt) f.stain((x, y) => valueNoise(x, y, 1.6, 40) > 0.8, BLOOD, [skin, skinB, rag]);
  }
  if (o.dead) {
    f.stain((x, y) => valueNoise(x, y, 2, 71) > 0.7, BLOOD, [skin, skinB, rag]);
    // the back split open: raw meat and the white of ribs
    const mid = loc([hx, hy], spine, -2, 13);
    f.stain(ellMaskL(mid, spine, 6, 9), RAW, [skin]);
    f.stain((x, y) => ellMaskL(mid, spine, 5, 8)(x, y) && Math.abs(((toLocal(mid, spine, x, y)[1] + 40) % 3.4) - 1.7) < 0.6, BONE, [RAW]);
  }
  return renderFig(f);
}

const ellMaskL = (c: V2, th: number, ru: number, rv: number) => (x: number, y: number) => {
  const [u, v] = toLocal(c, th, x, y);
  return (u * u) / (ru * ru) + (v * v) / (rv * rv) <= 1;
};
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

const STAND: Pose = {
  x: 38, y: 48, lean: 0.7, head: 0.25,
  armF: { a: 0.45, b: 0.25 }, armB: { a: 0.2, b: 0.35 },
  legF: { a: 0.45, b: 0.6 }, legB: { a: 0.0, b: 0.5 }, t: 0,
};

function idle(i: number): Pose {
  const s = Math.sin((i / 4) * Math.PI * 2);
  const c = Math.cos((i / 4) * Math.PI * 2);
  return ground({ ...STAND, lean: 0.7 + s * 0.05, head: 0.15 + c * 0.22, armF: { a: 0.45 + s * 0.1, b: 0.25 + c * 0.1 }, armB: { a: 0.2 - s * 0.08, b: 0.35 }, t: i / 4 }, BLIND.footY);
}

function walk(i: number): Pose {
  const ph = i / 6;
  const s = Math.sin(ph * Math.PI * 2);
  const c = Math.cos(ph * Math.PI * 2);
  return ground({
    ...STAND,
    lean: 0.78 + Math.abs(s) * 0.06,
    head: 0.2 + c * 0.12,
    legF: { a: 0.25 + s * 0.55, b: 0.55 + Math.max(0, -c) * 0.7 },
    legB: { a: 0.25 - s * 0.55, b: 0.55 + Math.max(0, c) * 0.7 },
    armF: { a: 0.4 - s * 0.45, b: 0.3 },
    armB: { a: 0.4 + s * 0.45, b: 0.3 },
    t: ph,
  }, BLIND.footY);
}

const WINDUP: Pose[] = [
  ground({ ...STAND, x: 36, lean: 0.25, head: -0.3, armF: { a: 2.4, b: -0.6 }, armB: { a: 2.1, b: -0.4 }, legF: { a: 0.7, b: 1.1 }, legB: { a: -0.1, b: 0.9 }, t: 0.2 }, BLIND.footY),
  ground({ ...STAND, x: 34, lean: -0.1, head: -0.5, armF: { a: 2.7, b: -0.55 }, armB: { a: 2.45, b: -0.4 }, legF: { a: 0.8, b: 1.3 }, legB: { a: -0.2, b: 1.0 }, t: 0.4 }, BLIND.footY),
];
const ATTACK: Pose[] = [
  { ...STAND, x: 40, y: 44, lean: 1.25, head: -0.2, armF: { a: 1.75, b: -0.1 }, armB: { a: 1.55, b: 0.0 }, legF: { a: 0.4, b: 1.2 }, legB: { a: -0.9, b: 0.4 }, t: 0.6 },
  ground({ ...STAND, x: 44, lean: 1.05, head: 0.0, armF: { a: 1.35, b: 0.4 }, armB: { a: 1.1, b: 0.5 }, legF: { a: 0.9, b: 1.1 }, legB: { a: -0.75, b: 0.2 }, t: 0.8 }, BLIND.footY),
];
const STAGGER: Pose[] = [
  ground({ ...STAND, x: 36, lean: 0.05, head: -0.75, armF: { a: -0.5, b: 0.6 }, armB: { a: -0.9, b: 0.4 }, legF: { a: 0.5, b: 0.4 }, legB: { a: -0.2, b: 0.3 }, t: 0.1 }, BLIND.footY),
  ground({ ...STAND, x: 35, lean: -0.15, head: 0.9, armF: { a: -0.2, b: 0.9 }, armB: { a: -1.2, b: 0.2 }, legF: { a: 0.6, b: 0.5 }, legB: { a: -0.35, b: 0.35 }, t: 0.3 }, BLIND.footY),
];
// Lying face-down, sprawled toward the right
const DEAD: Pose = { ...STAND, x: 36, y: BLIND.footY - 8, lean: 1.5, head: 1.25, armF: { a: 1.45, b: 0.3 }, armB: { a: -1.3, b: 0.3 }, legF: { a: -1.4, b: 0.25 }, legB: { a: -1.6, b: 0.6 }, t: 0.5 };

function deadFrame(saint: boolean) {
  const pc = drawBlind({ saint, pose: DEAD, dead: !saint, spread: 0.6 });
  if (saint) return pc;
  return pc;
}

export function blindAnims(saint: boolean): AnimDef[] {
  const d = (pose: Pose, extra: Partial<BlindOpts> = {}) => drawBlind({ saint, pose, ...extra });
  return [
    anim('idle', [0, 1, 2, 3].map((i) => d(idle(i))), 4),
    anim('walk', [0, 1, 2, 3, 4, 5].map((i) => d(walk(i))), 9),
    anim('windup', WINDUP.map((p, i) => d(p, { spread: 1, gape: 0.4 + i * 0.4 })), 6, 0),
    anim('attack', ATTACK.map((p) => d(p, { spread: 0.8, gape: 1 })), 10, 0),
    anim('stagger', STAGGER.map((p) => d(p, { hurt: true, gape: 0.5 })), 6, 0),
    anim('dead', [deadWithPool(saint)], 1, 0),
  ];
}

function deadWithPool(saint: boolean) {
  // Draw the corpse, then add a pool underneath by compositing a second figure.
  const body = deadFrame(saint);
  if (saint) {
    return body;
  }
  const f = frame(BLIND.w, BLIND.h);
  pool(f, 46, BLIND.footY - 0.5, 30, BLOOD, 4);
  pool(f, 64, BLIND.footY, 12, OLD_BLOOD, 5, 0.5);
  f.ellipse(78, BLIND.footY - 1, 1.6, 1.4, { ...BONE, ramp: ['#3a0a10', '#c8c0b0', '#f4f0e8'] }, 2); // a stray eye
  const under = renderFig(f);
  under.blit(body, 0, 0);
  return under;
}

export { shade, folds };
