// The Blissful Blind: a former Severed who gouged out their own eyes and
// smiles at the dark. And the saint the city insists it is.
import { solve, type Pose, type Proportions, type Joints } from '../rig';
import {
  BLOOD, OLD_BLOOD, NAIL, TEETH, MOUTH, VOID, MARBLE, HOLY, GOLD, BONE, RAW,
  CATGUT, anim, scaled, back, clothMat, dome, drip, lineMask, loc, pool, renderFig, ridge, ring, skinMat, stitches, toLocal, tube,
  vn, hash2, shade, frame, folds, wrinkleBump, type AnimDef, type Material, type V2,
} from './common';

/** Design canvas (the drawing code's units) and its scale to output pixels. */
const D = { w: 96, h: 80, footY: 74 };
const S = 0.5;
const HEAD_ZOOM = 1.4;
const HAND_ZOOM = 1.2;
export const BLIND = scaled(D, S);

const PR: Proportions = { torso: 23, neck: 4, thigh: 14, shin: 14, upperArm: 15, foreArm: 15, shoulderBack: 1 };

interface BlindOpts {
  saint: boolean;
  pose: Pose;
  /** Mouth opening 0..1 (attack shriek). */
  gape?: number;
  /** Claws/hand spread 0..1. */
  spread?: number;
  /** Finger curl 0 (straight) .. 1 (hooked). */
  curl?: number;
  /** Breath: ribcage swell -1..1. */
  breath?: number;
  /** Claw smear arc 0..1 (attack). */
  smear?: number;
  dead?: boolean;
  hurt?: boolean;
}

/** Shift a pose so its lowest point (feet, knees, hands when falling) touches the floor. */
function ground(p: Pose, footY: number, all = false): Pose {
  const j = solve(p, PR);
  let low = Math.max(j.footF[1], j.footB[1]);
  if (all) low = Math.max(low, j.kneeF[1] - 1, j.kneeB[1] - 1, j.handF[1] - 1, j.handB[1] - 1);
  return { ...p, y: p.y + (footY - 2 - low) };
}

const SKIN = '#a48e80';
const SKIN_M = skinMat(SKIN, 0.32);
// sagging, crepe-paper skin: crossing creases bend the light
const SKIN_W: Material = { ...SKIN_M, bump: wrinkleBump(3.2, 0.35, 5) };
const SKIN_B = back(SKIN_W, 0.3);
const SKIN_D = back(SKIN_W, 0.5);
const RAG = clothMat('#6e2622', 0, 7);
const ROPE: Material = { ramp: ['#120a06', '#2e2014', '#4e3a22', '#6e5636', '#8e7650'], tex: (x, y) => (((x + y) | 0) % 3 === 0 ? -0.14 : 0.04), round: 0.8, dither: 0.2 };
const HAIR: Material = { ramp: ['#0b0507', '#1c1410', '#30241c', '#46362a', '#5e4a38'], tex: (x) => Math.sin(x * 2.1) * 0.12, round: 0.5, spec: 0.4, shine: 16, dither: 0.2 };
const SAINT_RAG: Material = { ...clothMat('#e6dfd0', 0, 9), ramp: ['#1e1a18', '#3a342e', '#5a5248', '#7a7064', '#988e7e', '#b4aa98', '#cec4b0', '#e2dac8', '#f4efe2'], dither: 0.35 };
const SAINT_SKIN: Material = { ...MARBLE, wrap: 0.2, dither: 0.3, glint: '#ffffff', shine: 30 };

function drawBlind(o: BlindOpts) {
  const { w, h, footY } = D;
  const f = frame(w, h, S);
  const p = o.pose;
  const j: Joints = solve(p, PR);
  const saint = o.saint;
  const skin: Material = saint ? SAINT_SKIN : SKIN_W;
  const skinB = saint ? back(SAINT_SKIN, 0.25) : SKIN_B;
  const skinDeep = saint ? back(SAINT_SKIN, 0.45) : SKIN_D;
  const ph = p.t * Math.PI * 2;
  const rag: Material = saint ? { ...SAINT_RAG, bump: (x, y) => Math.sin((x + Math.sin(y * 0.13 + ph) * 2.2) / 1.9 + 9) * 0.9 } : { ...RAG, bump: (x, y) => Math.sin((x + Math.sin(y * 0.13 + ph) * 2.2) / 1.9 + 7) * 0.9 + (vn(x, y, 3, 14) - 0.5) * 0.8 };
  const ragB = back(rag, saint ? 0.12 : 0.3);
  const nail = saint ? SAINT_SKIN : NAIL;
  const [hx, hy] = j.hip;
  const [sx, sy] = j.shoulder;
  const spine = Math.atan2(sx - hx, hy - sy);
  const T = (u: number, v: number) => loc([hx, hy], spine, u, v); // torso frame
  const breath = o.breath ?? 0;
  const spread = o.spread ?? 0;
  const curl = o.curl ?? 0.4;

  // ---- limbs ---------------------------------------------------------------
  const hand = (e: V2, hd: V2, m: Material, layer: number) => {
    f.zoom(hd[0], hd[1], HAND_ZOOM); // claws a touch larger, so they read
    const ang = Math.atan2(hd[0] - e[0], hd[1] - e[1]); // direction of the forearm
    // palm: a bony wedge, knuckles forward
    f.ellipse(hd[0], hd[1], 1.7, 2.4, m, layer, -ang);
    const kn: V2 = [hd[0] + Math.sin(ang) * 2.2, hd[1] + Math.cos(ang) * 2.2];
    // long, jointed fingers ending in hooked nails
    for (let k = 0; k < 4; k++) {
      const fa = ang + (k - 1.5) * (0.22 + spread * 0.24);
      const L = saint ? 3.2 : 4.4 - Math.abs(k - 1.6) * 0.5;
      const c = (saint ? 0.3 : curl) * (0.6 + k * 0.1);
      const base: V2 = [kn[0] + Math.sin(fa + Math.PI / 2) * (k - 1.5) * 0.7, kn[1] + Math.cos(fa + Math.PI / 2) * (k - 1.5) * 0.7];
      const j1: V2 = [base[0] + Math.sin(fa) * L, base[1] + Math.cos(fa) * L];
      const j2: V2 = [j1[0] + Math.sin(fa + 0.6 * c + 0.1) * L * 0.85, j1[1] + Math.cos(fa + 0.6 * c + 0.1) * L * 0.85];
      f.capsule(base[0], base[1], j1[0], j1[1], 0.7, 0.6, m, layer + 0.1 + k * 0.001);
      f.ellipse(j1[0], j1[1], 0.75, 0.75, m, layer + 0.11);
      if (saint) {
        f.capsule(j1[0], j1[1], j2[0], j2[1], 0.75, 0.55, m, layer + 0.1);
      } else {
        f.capsule(j1[0], j1[1], j2[0], j2[1], 0.6, 0.5, m, layer + 0.1);
        const tip: V2 = [j2[0] + Math.sin(fa + 1.3 * c + 0.4) * 2.2, j2[1] + Math.cos(fa + 1.3 * c + 0.4) * 2.2];
        f.capsule(j2[0], j2[1], tip[0], tip[1], 0.55, 0.2, nail, layer + 0.2);
      }
    }
    // thumb
    const ta = ang - 0.9 - spread * 0.3;
    const t1: V2 = [hd[0] + Math.sin(ta) * 3.4, hd[1] + Math.cos(ta) * 3.4];
    f.capsule(hd[0], hd[1], t1[0], t1[1], 1.0, 0.7, m, layer + 0.09);
    f.zoom();
  };
  const arm = (sh: V2, el: V2, hd: V2, m: Material, layer: number, sleeve: Material | null) => {
    if (sleeve) {
      f.capsule(sh[0], sh[1], el[0], el[1], 3.8, 3.3, sleeve, layer);
      f.capsule(el[0], el[1], hd[0], hd[1], 3.3, 2.9, sleeve, layer);
      hand(el, hd, m, layer + 0.15);
      return;
    }
    // deltoid, a stringy biceps and a knotted elbow; the forearm thins to a stick wrist
    f.ellipse(sh[0], sh[1] + 0.5, 3.2, 3.0, m, layer + 0.02);
    const mid: V2 = [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2];
    f.capsule(sh[0], sh[1], el[0], el[1], 2.5, 1.6, m, layer);
    f.ellipse(el[0], el[1], 1.8, 1.8, m, layer + 0.05);
    const fm: V2 = [el[0] + (hd[0] - el[0]) * 0.3, el[1] + (hd[1] - el[1]) * 0.3];
    f.capsule(el[0], el[1], fm[0], fm[1], 1.6, 1.8, m, layer);
    f.capsule(fm[0], fm[1], hd[0], hd[1], 1.8, 1.0, m, layer);
    dome(f, mid[0], mid[1], 1.8, 3.5, 1.2, Math.atan2(el[0] - sh[0], el[1] - sh[1]), [m]);
    ridge(f, [fm, [hd[0] - (hd[0] - el[0]) * 0.1, hd[1] - (hd[1] - el[1]) * 0.1]], 0.8, 0.9, [m]); // tendon
    hand(el, hd, m, layer + 0.1);
  };
  const leg = (kn: V2, ft: V2, m: Material, layer: number) => {
    const ta = Math.atan2(kn[0] - hx, kn[1] - hy);
    const sa = Math.atan2(ft[0] - kn[0], ft[1] - kn[1]);
    f.capsule(hx, hy, kn[0], kn[1], 3.4, 2.2, m, layer);
    dome(f, (hx + kn[0]) / 2 + 0.6, (hy + kn[1]) / 2, 2.6, 4.5, 1.2, ta, [m]); // quadriceps
    // kneecap and the bony knot of the knee
    f.ellipse(kn[0] + Math.cos(ta) * 0.8, kn[1] - Math.sin(ta) * 0.8, 2.2, 2.1, m, layer + 0.05);
    // shin with the calf hanging off the back of it
    f.capsule(kn[0], kn[1], ft[0], ft[1], 2.0, 1.2, m, layer);
    const calf: V2 = [kn[0] + Math.sin(sa) * 4.5 - Math.cos(sa) * 1.4, kn[1] + Math.cos(sa) * 4.5 + Math.sin(sa) * 1.4];
    f.ellipse(calf[0], calf[1], 1.9, 3.4, m, layer + 0.01, -sa);
    ridge(f, [[kn[0] + Math.cos(sa) * 1.5, kn[1] - Math.sin(sa) * 1.5], [ft[0] + Math.cos(sa) * 0.8, ft[1] - Math.sin(sa) * 0.8]], 0.7, 1.0, [m]); // shin bone
    // ankle knob, heel and a long splayed foot
    f.ellipse(ft[0], ft[1], 1.7, 1.7, m, layer + 0.06);
    f.ellipse(ft[0] - 1.2, ft[1] + 1.2, 1.9, 1.4, m, layer + 0.07);
    f.capsule(ft[0] - 1, ft[1] + 0.9, ft[0] + 5, ft[1] + 1.3, 1.6, 1.15, m, layer + 0.08);
    for (let k = 0; k < 3; k++) f.capsule(ft[0] + 4.6, ft[1] + 0.8 + k * 0.45, ft[0] + 6.6 - k * 0.5, ft[1] + 1.4 + k * 0.4, 0.75, 0.55, m, layer + 0.09);
    if (!saint) f.capsule(ft[0] + 6.4, ft[1] + 1.3, ft[0] + 7.6, ft[1] + 2, 0.5, 0.3, nail, layer + 0.15);
  };

  arm([sx - 1, sy + 1], j.elbowB, j.handB, skinB, 1, saint ? ragB : null);
  if (!saint) leg(j.kneeB, j.footB, skinB, 2);

  // ---- torso: a starved rib cage hunched over a sunken belly --------------
  const chest = T(1.6, 15.5);
  f.ellipse(...T(0, 2), 6.6, 5.2, skin, 4, spine); // pelvis
  f.capsule(...T(0.6, 2.5), ...T(1.4, 11), 5.4, 5.2, skin, 4); // waist
  f.ellipse(chest[0], chest[1], 7.0 + breath * 0.4, 9.0, skin, 4.1, spine);
  f.ellipse(...T(-3.6, 19.5), 5.4, 5.6, skin, 4.12, spine); // shoulder blades / hump
  // spine knuckles along the curved back
  for (let k = 0; k < 8; k++) {
    const v = 3 + k * 2.6;
    const u = -6.2 - Math.sin((k / 7) * Math.PI) * 2.4;
    const q = T(u, v);
    f.ellipse(q[0], q[1], 1.35, 1.15, skin, 4.2);
  }
  if (!saint) {
    // ribs: real ridges sweeping down from the spine toward the sternum
    for (let k = 0; k < 6; k++) {
      const v0 = 9.5 + k * 2.35 + breath * 0.3;
      ridge(f, [T(-6.2, v0 + 2.2), T(-2.5, v0 + 1.4), T(1.5, v0 - 0.2), T(4.6 - k * 0.3, v0 - 2.0)], 1.05, 0.75, [skin]);
    }
    ridge(f, [T(-5.5, 20.5), T(-1.5, 17.5), T(-3, 13.5)], 0.9, 1.4, [skin]); // scapula edge
    dome(f, ...T(3.4, 5.8), 3.6, 3.2, -2.4, spine, [skin]); // sunken belly
    ridge(f, [T(-4, 4), T(1, 5.6), T(5, 4.4)], 0.9, 1.3, [skin]); // iliac crest
    ridge(f, [T(2.5, 22.5), T(6, 21)], 0.7, 1.1, [skin]); // collarbone
  }

  // ---- loincloth -------------------------------------------------------------
  const hipL = T(-7, 3.5);
  const hipR = T(7, 3.5);
  if (saint) {
    // a long robe falling over both legs
    const hem: V2[] = [];
    const fx = Math.max(j.footF[0], j.footB[0]) + 4;
    const bx = Math.min(j.footF[0], j.footB[0]) - 6;
    for (let i = 0; i <= 8; i++) hem.push([fx + (bx - fx) * (i / 8), footY - 1 + (i % 2) * 1.2]);
    f.poly([T(6, 24), T(8, 2), [j.kneeF[0] + 5, j.kneeF[1]], ...hem, [j.kneeB[0] - 6, j.kneeB[1] - 2], T(-9, 4), T(-7, 25)], rag, 5);
    f.capsule(...T(-7, 3), ...T(7.5, 3), 1.4, 1.4, GOLD, 5.2);
    // deep folds falling from the cord to the hem
    for (let k = 0; k < 5; k++) {
      const top = T(-6 + k * 3.2, 2);
      const bot: V2 = [bx + (fx - bx) * (0.1 + k * 0.2) + Math.sin(ph + k) * 1.2, footY - 2];
      ridge(f, [top, [(top[0] + bot[0]) / 2 + Math.sin(ph + k * 1.7) * 1.2, (top[1] + bot[1]) / 2], bot], 1.6, k % 2 ? 2.2 : -2.0, [rag]);
    }
  } else {
    // rags knotted at the hip: front flap, back flap and torn tails, swaying
    const lc: V2[] = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const bxy: V2 = [hipR[0] + (hipL[0] - hipR[0]) * t, hipR[1] + (hipL[1] - hipR[1]) * t];
      const tail = (i % 3 === 1 ? 4.5 : i % 3 === 2 ? 1.5 : 3) + hash2(i, 2, 5) * 3;
      const sway = Math.sin(ph + i * 0.7) * 1.1 - Math.sin(spine) * t * 2;
      lc.push([bxy[0] + sway, bxy[1] + 8 + tail]);
    }
    f.poly([T(-7.6, 5.4), T(7.6, 5.4), ...lc], rag, 5);
    // a hanging tail on the back hip
    const tl = T(-6.5, 3);
    tube(f, [tl, [tl[0] - 1 + Math.sin(ph) * 1.5, tl[1] + 7], [tl[0] - 2 + Math.sin(ph + 0.8) * 2.5, tl[1] + 14]], 1.8, 0.7, ragB, 4.95);
    // rope belt and knot
    f.capsule(...T(-7.2, 5), ...T(7.6, 5), 1.15, 1.15, ROPE, 5.1);
    const kt = T(5.5, 4.6);
    f.ellipse(kt[0], kt[1], 1.6, 1.5, ROPE, 5.15);
    tube(f, [kt, [kt[0] + 0.8 + Math.sin(ph + 1) * 0.8, kt[1] + 4], [kt[0] + 0.4 + Math.sin(ph + 1.4) * 1.4, kt[1] + 8]], 0.7, 0.5, ROPE, 5.16);
    // fold creases gathered at the belt
    for (let k = 0; k < 5; k++) ridge(f, [T(-6 + k * 3, 4.5), lc[1 + k * 2 > n ? n : 1 + k * 2]], 0.7, -1.2, [rag]);
  }

  // ---- head -----------------------------------------------------------------
  const th = p.head + spine * 0.15;
  const neckTop = loc([sx, sy], spine, 5.6, 1.6);
  const hc = loc(neckTop, th, 3.4, 2.8);
  const H = (u: number, v: number) => loc(hc, th, u, v);
  // stringy neck: tendons stand out of it
  f.capsule(sx + 0.5, sy + 1.5, neckTop[0], neckTop[1], 3.2, 2.4, skin, 6);
  // at sprite size the face is what reads: draw the head larger than life
  f.zoom(neckTop[0], neckTop[1], HEAD_ZOOM);
  if (!saint) {
    ridge(f, [[sx + 2.5, sy + 1], H(-0.5, -3)], 0.7, 1.2, [skin]);
    ridge(f, [[sx - 0.5, sy], H(-2.5, -1.5)], 0.6, 0.8, [skin]);
  }
  const gape = o.gape ?? 0;
  f.ellipse(...H(-1.2, 1.2), 6.0, 6.2, skin, 7, th); // cranium
  f.ellipse(...H(3.2, -1.2), 3.7, 4.4, skin, 7.02, th); // face
  // jaw hinges open from below the ear
  const ja = gape * 0.55;
  const hinge = H(-0.4, -2.6);
  const chin: V2 = loc(hinge, th + ja, 5.6, -3.2);
  f.capsule(hinge[0], hinge[1], chin[0], chin[1], 2.5, 2.0, skin, 7.04);
  f.ellipse(...H(4.6, 1.7), 2.3, 1.2, skin, 7.06, th); // brow ridge
  f.capsule(...H(5.6, 1.2), ...H(7.0, -1.5), 1.0, 1.3, skin, 7.1); // hooked nose
  f.ellipse(...H(-1.8, -0.2), 1.4, 2.3, back(skin, 0.12), 7.08, th); // ear
  if (!saint) {
    dome(f, ...H(3.6, -1.6), 2.0, 1.6, 1.3, th, [skin]); // cheekbone
    dome(f, ...H(3.2, -3.4), 2.0, 1.4, -1.6, th, [skin]); // hollow cheek
    dome(f, ...H(1.2, 1.4), 2.0, 2.0, -1.0, th, [skin]); // sunken temple
    dome(f, ...H(-1.8, -0.2), 0.8, 1.4, -1.2, th, [back(skin, 0.12)]); // ear hole
  }
  const sock = H(4.0, 0.3);

  if (saint) {
    // serene closed eye, faint smile, a veil and the gilt halo
    f.stain(lineMask([loc(sock, th, -1.6, 0.3), loc(sock, th, 0, -0.6), loc(sock, th, 1.6, 0.2)], 0.6), back(skin, 0.7), [skin]);
    f.stain(lineMask([loc(sock, th, -1.2, 1.6), loc(sock, th, 1.4, 1.9)], 0.45), back(skin, 0.45), [skin]);
    f.stain(lineMask([H(3.4, -3.8), H(5.4, -4.0)], 0.4), back(skin, 0.4), [skin]);
    const hood = { ...rag, ramp: rag.ramp };
    f.ellipse(...H(-1.6, 1.8), 6.6, 6.4, hood, 7.4, th);
    f.poly([H(-6.5, 1), H(1, 4.5), H(-3, -12), H(-9, -10)], rag, 6.5);
    const halo = H(-2.5, 4.5);
    ring(f, halo[0], halo[1], 9, 9.5, 0.9, HOLY, 3, 0);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      f.ellipse(halo[0] + Math.cos(a) * 9.2, halo[1] + Math.sin(a) * 9.6, 0.8, 0.8, GOLD, 3.1);
    }
    // a single tear of blood the faithful do not see
    f.stain((x, y) => Math.abs(x - sock[0] - 0.4) < 0.5 && y > sock[1] + 1 && y < sock[1] + 5, BLOOD, [skin]);
  } else {
    // stringy, thinning hair plastered to the skull and hanging lank
    for (let k = 0; k < 3; k++) {
      const r0 = H(-5.4 + k * 1.1, 5.0 - k * 0.4);
      const sway = Math.sin(ph + k * 0.9) * 0.9;
      const mid = H(-6.4 + k * 0.3, 2.5 - k * 0.3);
      tube(f, [r0, mid, [mid[0] - 1.2 + sway, mid[1] + 3 + (k % 3) * 1.5]], 0.4, 0.25, HAIR, 7.5);
    }
    // the sockets: gouged, ragged, streaming
    f.stain((x, y) => {
      const [u, v] = toLocal(sock, th, x, y);
      return (u * u) / 5.5 + (v * v) / 3.2 <= 1;
    }, VOID, [skin], [sock[0] - 4, sock[1] - 4, sock[0] + 4, sock[1] + 4]);
    f.stain((x, y) => {
      const [u, v] = toLocal(sock, th, x, y);
      const d = (u * u) / 5.5 + (v * v) / 3.2;
      return d > 1 && d <= 1.8 + vn(x, y, 1, 3) * 0.6;
    }, RAW, [skin], [sock[0] - 5, sock[1] - 5, sock[0] + 5, sock[1] + 5]);
    f.ellipse(sock[0] - 0.4, sock[1] + 0.8, 0.9, 0.6, BLOOD, 7.3);
    // blood streaming down the face, neck and chest (gravity: straight down)
    const bx = sock[0];
    const by = sock[1];
    f.stain((x, y) => y > by && Math.abs(x - bx - Math.sin(y * 0.4) * 0.5) < 0.85 + (y - by) * 0.02 && y < by + 28, BLOOD, [skin, skinB], [bx - 4, by, bx + 4, by + 30]);
    f.stain((x, y) => y > by + 1 && Math.abs(x - bx + 1.8 - Math.sin(y * 0.3 + 1) * 0.6) < 0.55 && y < by + 15, BLOOD, [skin], [bx - 5, by, bx + 2, by + 16]);
    f.stain((x, y) => Math.abs(x - (bx - 1)) < 4.5 && y > by + 7 && y < by + 30 && vn(x, y, 2, 61) > 0.6, OLD_BLOOD, [skin], [bx - 6, by + 6, bx + 5, by + 31]);
    // the smile: a too-wide crescent from the chin back toward the ear, crammed with teeth
    const lipU = (u: number): number => -3.0 + (u - 3) * (u - 3) * 0.06 + 0.5;
    f.stain((x, y) => {
      const [u, v] = toLocal(hc, th, x, y);
      if (u < -0.2 || u > 6.8) return false;
      const c = lipU(u);
      const lo = c - 1.0 - gape * (1 + u * 0.55);
      return v < c + 0.6 && v > lo;
    }, MOUTH, [skin], [hc[0] - 10, hc[1] - 10, hc[0] + 12, hc[1] + 6]);
    for (let k = 0; k < 7; k++) {
      const u = 0.6 + k * 0.9;
      const c = lipU(u);
      const tu = H(u, c + 0.2);
      const tl = H(u + 0.35, c - 1.0 - gape * (1 + u * 0.55) + 0.3);
      f.ellipse(tu[0], tu[1], 0.45, 0.6 + (k % 3 === 1 ? 0.3 : 0), TEETH, 7.35);
      if (gape > 0.2 || k % 2) f.ellipse(tl[0], tl[1], 0.45, 0.5 + (k % 2) * 0.3, TEETH, 7.35);
    }
    // grin creases at the mouth corner
    ridge(f, [H(-0.2, -1.6), H(0.2, -3.6), H(1.2, -5.4)], 0.6, -1.4, [skin]);
    // blood drool from the grin
    const cn = H(5.4, -4.8 - gape * 3.5);
    drip(f, cn[0], cn[1], 2.5 + ((p.t * 10) % 3), BLOOD, 7.4, 0.55);
  }

  f.zoom();

  // ---- near limbs --------------------------------------------------------------
  if (saint) {
    f.capsule(j.footF[0] - 1, j.footF[1] + 1, j.footF[0] + 4.5, j.footF[1] + 1.5, 1.8, 1.3, skin, 5.5);
  } else leg(j.kneeF, j.footF, skin, 6);
  arm([sx + 1, sy], j.elbowF, j.handF, skin, 9, saint ? rag : null);

  // ---- claw smear: a pale arc torn through the air ------------------------------
  if (o.smear && !saint) {
    const c0 = j.shoulder;
    const R = Math.hypot(j.handF[0] - c0[0], j.handF[1] - c0[1]) + 3;
    const aEnd = Math.atan2(j.handF[1] - c0[1], j.handF[0] - c0[0]);
    const SM: Material = { ramp: ['#5a1c22', '#a04a46', '#d89a86', '#f4dcc8'], round: 0.2, dither: 0 };
    f.add((x, y) => {
      const d = Math.hypot(x - c0[0], y - c0[1]);
      let a = Math.atan2(y - c0[1], x - c0[0]) - aEnd;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      const k = -a / (1.3 * o.smear!); // 0 at the hand, 1 at the tail of the arc
      if (k < 0 || k > 1) return false;
      const wdt = 1.7 * (1 - k) * Math.min(1, k * 6);
      return Math.abs(d - R) < wdt && Math.abs(d - R + 1.2) < wdt + 0.5;
    }, SM, 0.5, [c0[0] - R - 4, c0[1] - R - 4, c0[0] + R + 4, c0[1] + R + 4]);
  }

  // ---- gore ----------------------------------------------------------------------
  if (!saint) {
    // bloodied claws and fingers (they did the gouging)
    for (const hd of [j.handF, j.handB])
      f.stain((x, y) => Math.hypot(x - hd[0], y - hd[1]) < 6 && Math.hypot(x - hd[0], y - hd[1]) > 2.5 && vn(x, y, 1.5, 9) > 0.55, BLOOD, [skin, skinB], [hd[0] - 6, hd[1] - 6, hd[0] + 6, hd[1] + 6]);
    for (const hd of [j.handF]) f.stain((x, y) => Math.hypot(x - hd[0], y - hd[1]) < 8 && Math.hypot(x - hd[0], y - hd[1]) > 3 && vn(x, y, 1.2, 19) > 0.7, OLD_BLOOD, [skin], [hd[0] - 9, hd[1] - 9, hd[0] + 9, hd[1] + 9]);
    f.stain((x, y) => vn(x, y, 2, 13) > 0.7, OLD_BLOOD, [rag, ragB]);
    f.stain((x, y) => y > footY - 4 && hash2(x | 0, y | 0, 8) < 0.55, BLOOD, [skin, skinB], [0, footY - 5, w, footY + 2]);
    f.stain((x, y) => vn(x, y, 3, 19) > 0.72, skinDeep, [skin]); // mottled bruising
    // a self-inflicted gash across the flank, crudely sewn shut
    const g0 = T(-5.5, 9);
    const g1 = T(-2, 13);
    f.stain(lineMask([g0, g1], 0.55), RAW, [skin]);
    stitches(f, g0, g1, 3, 1.1, 4.5, CATGUT);
    f.stain((x, y) => Math.abs(x - g1[0] + 1) < 0.5 && y > g1[1] && y < g1[1] + 6, BLOOD, [skin], [g1[0] - 2, g1[1], g1[0] + 1, g1[1] + 7]);
    if (o.hurt) f.stain((x, y) => vn(x, y, 2.6, 40) > 0.74, BLOOD, [skin, skinB, rag]);
  }
  if (o.dead) {
    f.stain((x, y) => vn(x, y, 2, 71) > 0.7, BLOOD, [skin, skinB, rag]);
    // the back split open: raw meat and the white of ribs
    const mid = T(-2, 13);
    f.stain(ellMaskL(mid, spine, 6, 9), RAW, [skin]);
    f.stain((x, y) => ellMaskL(mid, spine, 5, 8)(x, y) && Math.abs(((toLocal(mid, spine, x, y)[1] + 40) % 3.4) - 1.7) < 0.6, BONE, [RAW]);
  }
  return renderFig(f);
}

const ellMaskL = (c: V2, th: number, ru: number, rv: number) => (x: number, y: number) => {
  const [u, v] = toLocal(c, th, x, y);
  return (u * u) / (ru * ru) + (v * v) / (rv * rv) <= 1;
};

const STAND: Pose = {
  x: 38, y: 48, lean: 0.72, head: 0.25,
  armF: { a: 0.45, b: 0.25 }, armB: { a: 0.2, b: 0.35 },
  legF: { a: 0.45, b: 0.6 }, legB: { a: 0.0, b: 0.5 }, t: 0,
};
const TAU = Math.PI * 2;

type Key = { p: Pose; o?: Partial<BlindOpts> };

function idle(i: number): Key {
  // breathing, and the head turning to listen; the hands drift a beat behind
  const a = (i / 6) * TAU;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const p = ground({
    ...STAND,
    lean: 0.72 + s * 0.04,
    head: 0.18 + Math.sin(a - 0.9) * 0.2,
    armF: { a: 0.45 + Math.sin(a - 0.8) * 0.08, b: 0.25 + Math.sin(a - 1.6) * 0.1 },
    armB: { a: 0.2 + Math.sin(a - 1.2) * 0.06, b: 0.35 + Math.sin(a - 2) * 0.06 },
    legF: { a: 0.45, b: 0.6 + s * 0.04 },
    legB: { a: 0.0, b: 0.5 + s * 0.04 },
    t: i / 6,
  }, D.footY);
  return { p, o: { breath: s, curl: 0.45 + c * 0.15, spread: 0.1 + Math.max(0, Math.sin(a * 2)) * 0.15 } };
}

function walk(i: number): Key {
  // a shuffling, listening shamble: short strides, the head pecking forward
  const ph = i / 8;
  const a = ph * TAU;
  const s = Math.sin(a);
  const c = Math.cos(a);
  const p = ground({
    ...STAND,
    lean: 0.8 + Math.abs(c) * 0.06,
    head: 0.22 + Math.sin(a * 2 + 0.6) * 0.1,
    legF: { a: 0.25 + s * 0.5, b: 0.5 + Math.max(0, c) * 0.85 },
    legB: { a: 0.25 - s * 0.5, b: 0.5 + Math.max(0, -c) * 0.85 },
    armF: { a: 0.42 - Math.sin(a - 0.7) * 0.36, b: 0.28 + Math.max(0, Math.sin(a - 1.6)) * 0.3 },
    armB: { a: 0.42 + Math.sin(a - 0.7) * 0.36, b: 0.3 + Math.max(0, -Math.sin(a - 1.6)) * 0.3 },
    t: ph,
  }, D.footY);
  return { p, o: { curl: 0.5, breath: Math.sin(a * 2) * 0.5 } };
}

const W0 = ground({ ...STAND, x: 39, lean: 0.95, head: 0.45, armF: { a: -0.25, b: 0.9 }, armB: { a: -0.45, b: 0.8 }, legF: { a: 0.75, b: 1.25 }, legB: { a: 0.15, b: 1.05 }, t: 0.1 }, D.footY);
const W1 = ground({ ...STAND, x: 37, lean: 0.4, head: -0.1, armF: { a: 1.5, b: -0.2 }, armB: { a: 1.2, b: -0.1 }, legF: { a: 0.65, b: 1.0 }, legB: { a: -0.05, b: 0.85 }, t: 0.25 }, D.footY);
const W2 = ground({ ...STAND, x: 35, lean: -0.05, head: -0.45, armF: { a: 2.45, b: -0.5 }, armB: { a: 2.2, b: -0.35 }, legF: { a: 0.8, b: 1.3 }, legB: { a: -0.2, b: 1.0 }, t: 0.4 }, D.footY);
const W3 = ground({ ...W2, x: 34, lean: -0.12, head: -0.55, armF: { a: 2.6, b: -0.55 }, armB: { a: 2.35, b: -0.45 }, t: 0.5 }, D.footY);
const WINDUP: Key[] = [
  { p: W0, o: { gape: 0.15, curl: 0.8, spread: 0.2 } },
  { p: W1, o: { gape: 0.45, curl: 0.5, spread: 0.6 } },
  { p: W2, o: { gape: 0.85, curl: 0.3, spread: 1 } },
  { p: W3, o: { gape: 1, curl: 0.2, spread: 1 } },
];
const ATTACK: Key[] = [
  // launch: arms still high, the body stretched out in the air
  { p: { ...STAND, x: 35, y: 42, lean: 1.2, head: -0.25, armF: { a: 2.15, b: -0.25 }, armB: { a: 1.95, b: -0.15 }, legF: { a: 0.9, b: 1.5 }, legB: { a: -0.85, b: 0.25 }, t: 0.6 }, o: { gape: 1, spread: 1, curl: 0.2 } },
  // the rake: claws tear down through the arc
  { p: { ...STAND, x: 35, y: 44, lean: 1.3, head: -0.15, armF: { a: 1.35, b: 0.05 }, armB: { a: 1.15, b: 0.15 }, legF: { a: 0.7, b: 1.3 }, legB: { a: -0.9, b: 0.35 }, t: 0.7 }, o: { gape: 1, spread: 0.9, curl: 0.6, smear: 1 } },
  // follow-through: arms swept low and behind, landing
  { p: ground({ ...STAND, x: 42, lean: 1.15, head: 0.05, armF: { a: 0.35, b: 0.55 }, armB: { a: 0.15, b: 0.6 }, legF: { a: 0.95, b: 1.25 }, legB: { a: -0.7, b: 0.25 }, t: 0.8 }, D.footY), o: { gape: 0.7, spread: 0.5, curl: 0.9 } },
  // crouched recovery
  { p: ground({ ...STAND, x: 42, lean: 0.95, head: 0.3, armF: { a: 0.5, b: 0.35 }, armB: { a: 0.3, b: 0.45 }, legF: { a: 0.85, b: 1.3 }, legB: { a: -0.3, b: 0.8 }, t: 0.9 }, D.footY), o: { gape: 0.4, curl: 0.6 } },
];
const STAGGER: Key[] = [
  { p: ground({ ...STAND, x: 36, lean: 0.05, head: -0.8, armF: { a: -0.6, b: 0.6 }, armB: { a: -0.95, b: 0.4 }, legF: { a: 0.5, b: 0.4 }, legB: { a: -0.2, b: 0.3 }, t: 0.1 }, D.footY), o: { hurt: true, gape: 0.8, spread: 1, curl: 0.1 } },
  { p: ground({ ...STAND, x: 35, lean: -0.15, head: 0.9, armF: { a: -0.2, b: 0.9 }, armB: { a: -1.2, b: 0.2 }, legF: { a: 0.6, b: 0.5 }, legB: { a: -0.35, b: 0.35 }, t: 0.3 }, D.footY), o: { hurt: true, gape: 0.5, spread: 0.6 } },
  { p: ground({ ...STAND, x: 36, lean: 0.45, head: 0.65, armF: { a: 0.15, b: 0.5 }, armB: { a: -0.35, b: 0.4 }, legF: { a: 0.55, b: 0.75 }, legB: { a: -0.25, b: 0.6 }, t: 0.45 }, D.footY), o: { hurt: true, gape: 0.3, curl: 0.7 } },
];
// Lying face-down, sprawled toward the right
const DEAD: Pose = { ...STAND, x: 36, y: D.footY - 8, lean: 1.5, head: 1.25, armF: { a: 1.45, b: 0.3 }, armB: { a: -1.3, b: 0.3 }, legF: { a: -1.4, b: 0.25 }, legB: { a: -1.6, b: 0.6 }, t: 0.5 };
const FALL: Key[] = [
  // knees buckle
  { p: ground({ ...STAND, x: 37, lean: 0.55, head: -0.5, armF: { a: -0.1, b: 0.4 }, armB: { a: -0.4, b: 0.3 }, legF: { a: 1.0, b: 1.9 }, legB: { a: 0.6, b: 2.0 }, t: 0.2 }, D.footY, true), o: { gape: 0.9, hurt: true, spread: 0.8 } },
  // pitching forward onto the knees
  { p: ground({ ...STAND, x: 37, lean: 1.05, head: 0.6, armF: { a: 1.0, b: 0.2 }, armB: { a: 0.3, b: 0.3 }, legF: { a: 1.2, b: 2.5 }, legB: { a: 1.0, b: 2.6 }, t: 0.35 }, D.footY, true), o: { gape: 0.6, hurt: true, spread: 0.6 } },
  // the chest hits the floor
  { p: ground({ ...STAND, x: 36, lean: 1.38, head: 1.1, armF: { a: 1.4, b: 0.3 }, armB: { a: -0.6, b: 0.4 }, legF: { a: 0.2, b: 1.6 }, legB: { a: -0.1, b: 1.4 }, t: 0.45 }, D.footY, true), o: { gape: 0.3, hurt: true, spread: 0.6 } },
];

function deadWithPool(saint: boolean) {
  const body = drawBlind({ saint, pose: DEAD, dead: !saint, spread: 0.6, curl: 0.7 });
  if (saint) return body;
  const f = frame(D.w, D.h, S);
  pool(f, 46, D.footY - 0.5, 30, BLOOD, 4);
  pool(f, 64, D.footY, 12, OLD_BLOOD, 5, 0.5);
  f.ellipse(78, D.footY - 1, 1.6, 1.4, { ...BONE, ramp: ['#3a0a10', '#c8c0b0', '#f4f0e8'] }, 2); // a stray eye
  const under = renderFig(f);
  under.blit(body, 0, 0);
  return under;
}

export function blindAnims(saint: boolean): AnimDef[] {
  const d = (k: Key) => drawBlind({ saint, pose: k.p, ...k.o });
  // The saint is the city's lie: stiller, fewer in-betweens (and half the build cost).
  const pick = <T,>(a: T[], idx: number[]) => (saint ? idx.map((i) => a[i]) : a);
  const idleN = saint ? 4 : 6;
  const walkN = saint ? 6 : 8;
  const idleK = Array.from({ length: idleN }, (_, i) => idle((i * 6) / idleN));
  const walkK = Array.from({ length: walkN }, (_, i) => walk((i * 8) / walkN));
  return [
    anim('idle', idleK.map(d), saint ? 4 : 6),
    anim('walk', walkK.map(d), saint ? 8 : 11),
    anim('windup', pick(WINDUP, [0, 2, 3]).map(d), saint ? 6 : 8, 0),
    anim('attack', pick(ATTACK, [0, 1, 3]).map(d), saint ? 10 : 14, 0),
    anim('stagger', [STAGGER[0], STAGGER[2]].map(d), 6, 0),
    anim('dead', [...pick(FALL, [1]).map(d), deadWithPool(saint)], saint ? 8 : 12, 0),
  ];
}

export { shade, folds };
