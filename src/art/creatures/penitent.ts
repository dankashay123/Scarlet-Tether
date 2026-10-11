// The Lacquered Penitent: a brute who climbed into a confessional and never
// came out. It swings its censer the way it once swung its fists.
import {
  BLOOD, OLD_BLOOD, IRON, RUST, GOLD, BRASS, GLOW, SMOKE, VOID, RAW, THREAD, NAIL,
  CATGUT, anim, back, bez, clothMat, dome, drip, lineMask, ridge, loc, pool, renderFig, skinMat, stitches, toLocal, tube, vn, hash2, woodMat, frame,
  type AnimDef, type Material, type V2,
} from './common';

export const PENITENT = { w: 128, h: 112, footY: 104 };

const WOOD = woodMat('#6a2a1a', 5);
const WOOD_D = back(WOOD, 0.35);
const WOOD_L: Material = { ...WOOD, ramp: WOOD.ramp.map((_, i, a) => a[Math.min(a.length - 1, i + 1)]) };
const SKIN = '#a88672';
const SMEAR: Material = { ramp: ['#2a160c', '#4e2c14', '#7a4a20', '#a8702e', '#d09a48'], round: 0.3, dither: 0.8 };

interface Limb { a: number; b: number }
interface PP {
  x: number;
  lean: number;
  armF: Limb;
  armB: Limb;
  legF: Limb;
  legB: Limb;
  /** Censer position; if omitted it hangs below the hand. */
  censer?: V2;
  swing?: number;
  smoke?: number; // ground smoke burst 0..1
  smear?: number; // motion trail
  /** Chain angle from straight down (+ forward) when the censer hangs free. */
  chainA?: number;
  /** Where the censer was a moment ago (smear arc through these). */
  trail?: V2[];
  hurt?: boolean;
  t: number;
  hipY?: number;
}

const seg = (p: V2, ang: number, len: number): V2 => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];
const THIGH = 17;
const SHIN = 17;
const UA = 17;
const FA = 16;

function legEnds(hip: V2, l: Limb) {
  const k = seg(hip, l.a, THIGH);
  return { knee: k, foot: seg(k, l.a - l.b, SHIN) };
}

function drawCenser(f: Figure2, c: V2, hand: V2, layer: number, swing: number, smoke: number, t: number) {
  // chain: sagging links from fist to the censer's crown
  const top: V2 = [c[0], c[1] - 8];
  const d = Math.hypot(top[0] - hand[0], top[1] - hand[1]);
  const sag = Math.max(0, 26 - d) * 0.5 + 2;
  const mid: V2 = [(hand[0] + top[0]) / 2, (hand[1] + top[1]) / 2 + sag];
  const pts = bez(hand, mid, top, Math.max(6, Math.round(d / 2.2)));
  pts.forEach(([x, y], i) => {
    if (i % 2) f.ellipse(x, y, 1.1, 0.7, IRON, layer);
    else f.ellipse(x, y, 0.7, 1.1, back(IRON, 0.2), layer - 0.01);
  });
  // the censer: lidded brass bowl, pierced, glowing
  const r = (a: number) => [Math.cos(a), Math.sin(a)];
  void r;
  f.ellipse(c[0], c[1] + 1, 7, 5.5, BRASS, layer);
  f.ellipse(c[0], c[1] - 3.5, 5.2, 4, BRASS, layer + 0.05);
  f.capsule(c[0] - 7, c[1] - 0.5, c[0] + 7, c[1] - 0.5, 1, 1, back(BRASS, 0.2), layer + 0.06);
  f.ellipse(c[0], c[1] - 7.5, 1.6, 1.6, BRASS, layer + 0.07);
  f.capsule(c[0], c[1] - 9, c[0], c[1] - 13, 0.6, 0.6, GOLD, layer + 0.08);
  f.capsule(c[0] - 1.6, c[1] - 11.5, c[0] + 1.6, c[1] - 11.5, 0.5, 0.5, GOLD, layer + 0.08);
  f.capsule(c[0] - 3, c[1] + 6, c[0] + 3, c[1] + 6, 1.2, 1.2, back(BRASS, 0.25), layer + 0.04);
  // pierced holes leaking ember-light
  for (let k = 0; k < 5; k++) {
    const x = c[0] - 4 + k * 2;
    f.stain((xx, yy) => Math.abs(xx - x) < 0.6 && Math.abs(yy - c[1] + 3.5) < 1, GLOW, [BRASS], [x - 1, c[1] - 5, x + 1, c[1] - 2]);
    if (k % 2 === 0) f.stain((xx, yy) => Math.abs(xx - x - 0.5) < 0.6 && Math.abs(yy - c[1] - 2) < 0.8, GLOW, [BRASS], [x - 1, c[1] + 1, x + 2, c[1] + 3]);
  }
  // blood crusted on the bowl
  f.stain((x, y) => Math.hypot(x - c[0], y - c[1] - 2) < 7 && vn(x, y, 1.5, 33) > 0.66, BLOOD, [BRASS], [c[0] - 8, c[1] - 6, c[0] + 8, c[1] + 10]);
  // incense smoke curling up from the lid
  for (let k = 0; k < 4; k++) {
    const sx = c[0] - k * 2.5 - swing * k * 1.5 + Math.sin(t * 6 + k) * 1.2;
    const sy = c[1] - 10 - k * 4.5;
    f.ellipse(sx, sy, 1.8 + k * 0.6, 1.6 + k * 0.5, SMOKE, 1.5);
  }
  if (smoke > 0) {
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      const rr = 8 + smoke * 9 + (k % 3) * 2;
      f.ellipse(c[0] + Math.cos(a) * rr * 1.2, c[1] + 4 + Math.sin(a) * rr * 0.55, 3 + (k % 3) * 1.3, 2.6 + (k % 2), SMOKE, layer + 0.5 + (k % 2) * 0.2);
    }
    for (let k = 0; k < 6; k++) f.ellipse(c[0] - 10 + k * 4, c[1] - 8 - ((k * 5) % 7) * 2, 0.7, 0.7, GLOW, layer + 1);
  }
}

type Figure2 = ReturnType<typeof frame>;

function drawPenitent(p: PP) {
  const { w, h, footY } = PENITENT;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.35);
  const skinB = back(skin, 0.33);
  const L = p.lean;
  // hip height from the lower foot
  let hip: V2 = [p.x, 0];
  if (p.hipY !== undefined) hip = [p.x, p.hipY];
  else {
    const a = legEnds([p.x, 0], p.legF).foot[1];
    const b = legEnds([p.x, 0], p.legB).foot[1];
    hip = [p.x, footY - 3 - Math.max(a, b)];
  }
  const B = (u: number, v: number) => loc(hip, L, u, v);
  /** Screen bbox of a rectangle in booth space (so stains only walk that patch). */
  const BB = (u0: number, v0: number, u1: number, v1: number): [number, number, number, number] => {
    const q = [B(u0, v0), B(u1, v0), B(u0, v1), B(u1, v1)];
    return [Math.min(...q.map((a) => a[0])), Math.min(...q.map((a) => a[1])), Math.max(...q.map((a) => a[0])), Math.max(...q.map((a) => a[1]))];
  };
  const shoulder = B(14, 29);
  const lF = legEnds(hip, p.legF);
  const lB = legEnds(hip, p.legB);
  const eF = seg(shoulder, p.armF.a, UA);
  const hF = seg(eF, p.armF.a + p.armF.b, FA);
  const eB = seg(shoulder, p.armB.a, UA);
  const hB = seg(eB, p.armB.a + p.armB.b, FA);

  const perp = (a: V2, b: V2, k: number): V2 => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [((b[1] - a[1]) / L) * k, (-(b[0] - a[0]) / L) * k];
  };
  const along = (a: V2, b: V2, t: number, off = 0): V2 => {
    const q = perp(a, b, off);
    return [a[0] + (b[0] - a[0]) * t + q[0], a[1] + (b[1] - a[1]) * t + q[1]];
  };
  const wrap = clothMat('#6a5a46', p.t, 3);
  const leg = (k: V2, ft: V2, m: Material, layer: number) => {
    const ta = Math.atan2(k[0] - hip[0], k[1] - hip[1]);
    const sa = Math.atan2(ft[0] - k[0], ft[1] - k[1]);
    f.capsule(hip[0], hip[1], k[0], k[1], 7.8, 5.6, m, layer);
    dome(f, ...along(hip, k, 0.45, 2), 4.5, 7, 2.6, -ta, [m]); // quadriceps
    dome(f, ...along(hip, k, 0.85, 1.5), 3, 2.5, 1.6, -ta, [m]); // teardrop over the knee
    f.ellipse(k[0] + 1, k[1], 5, 4.6, m, layer + 0.05);
    f.capsule(k[0], k[1], ft[0], ft[1], 5.4, 3.8, m, layer);
    // the calf: a slab of muscle hanging off the back of the shin
    const calf = along(k, ft, 0.35, -3.2);
    f.ellipse(calf[0], calf[1], 3.8, 6, m, layer + 0.01, -sa);
    ridge(f, [along(k, ft, 0.1, 2.6), along(k, ft, 0.9, 1.8)], 1.1, 1.2, [m]); // shin bone
    f.capsule(ft[0] - 2, ft[1] + 0.5, ft[0] + 7, ft[1] + 1.5, 3.4, 2.6, m, layer + 0.1);
    for (let t = 0; t < 4; t++) f.ellipse(ft[0] + 7.6, ft[1] - 0.2 + t * 1.2, 1.3, 0.9, m, layer + 0.11); // toes
    // filthy rag wrappings round the foot and ankle
    f.capsule(ft[0] - 1, ft[1] - 3, ft[0] + 1.5, ft[1] + 1, 4.4, 3.8, wrap, layer + 0.12);
    for (let t = 0; t < 3; t++) ridge(f, [[ft[0] - 4.5, ft[1] - 4 + t * 2.2], [ft[0] + 5, ft[1] - 2.6 + t * 2.2]], 0.7, -1.6, [wrap]);
  };
  const arm = (e: V2, hd: V2, m: Material, layer: number) => {
    const ua = Math.atan2(e[0] - shoulder[0], e[1] - shoulder[1]);
    const fa = Math.atan2(hd[0] - e[0], hd[1] - e[1]);
    f.ellipse(shoulder[0], shoulder[1] + 1, 7.2, 6.6, m, layer + 0.02); // deltoid
    f.capsule(shoulder[0], shoulder[1], e[0], e[1], 6.4, 4.6, m, layer);
    dome(f, ...along(shoulder, e, 0.55, 2.4), 3.6, 6, 2.4, -ua, [m]); // biceps
    dome(f, ...along(shoulder, e, 0.5, -2.8), 3.4, 6, 1.8, -ua, [m]); // triceps
    ridge(f, [along(shoulder, e, 0.15, 0), along(shoulder, e, 0.95, 0.5)], 0.9, -1.2, [m]); // the split between them
    f.ellipse(e[0], e[1], 4.4, 4.4, m, layer + 0.05);
    // forearm: thick at the elbow, the wrist roped with tendon
    const fm = along(e, hd, 0.3);
    f.capsule(e[0], e[1], fm[0], fm[1], 4.6, 5.0, m, layer);
    f.capsule(fm[0], fm[1], hd[0], hd[1], 5.0, 3.6, m, layer);
    dome(f, ...along(e, hd, 0.3, 1.6), 3.4, 5, 2, -fa, [m]);
    ridge(f, [along(e, hd, 0.15, -1.4), along(e, hd, 0.5, -0.8), along(e, hd, 0.85, 1.2)], 0.8, 1.1, [m]); // a fat vein
    // the fist: heavy, knuckles like walnuts
    f.ellipse(hd[0], hd[1], 4.8, 4.6, m, layer + 0.1);
    for (let k = 0; k < 4; k++) {
      const q = seg(hd, fa + (k - 1.5) * 0.42, 3.8);
      f.ellipse(q[0], q[1], 1.6, 1.5, m, layer + 0.12);
      dome(f, q[0], q[1], 1.4, 1.4, 1.2, 0, [m]);
    }
    const th = seg(hd, fa - 1.3, 3.6); // thumb across the front
    f.capsule(hd[0], hd[1], th[0], th[1], 1.8, 1.5, m, layer + 0.13);
    // iron manacle: a cuff round the wrist, rivets and a broken chain
    const wq = along(e, hd, 0.68);
    const cq = perp(e, hd, 5.4);
    const cu = [Math.sin(fa) * 1.6, Math.cos(fa) * 1.6];
    f.capsule(wq[0] - cq[0], wq[1] - cq[1], wq[0] + cq[0], wq[1] + cq[1], 2.4, 2.4, IRON, layer + 0.2);
    f.capsule(wq[0] - cq[0] + cu[0], wq[1] - cq[1] + cu[1], wq[0] + cq[0] + cu[0], wq[1] + cq[1] + cu[1], 1.0, 1.0, RUST, layer + 0.21);
    f.ellipse(wq[0] + cq[0] * 0.2, wq[1] + cq[1] * 0.2, 0.9, 0.9, IRON, layer + 0.22);
    const lk: V2 = [wq[0] + cq[0] * 0.6, wq[1] + cq[1] * 0.6 + 3];
    f.ellipse(lk[0], lk[1], 1.0, 1.6, IRON, layer + 0.19);
    f.ellipse(lk[0] + 0.5, lk[1] + 2.6, 1.5, 1.0, back(IRON, 0.2), layer + 0.18);
  };

  // ---- far limbs ---------------------------------------------------------
  arm(eB, hB, skinB, 1);
  leg(lB.knee, lB.foot, skinB, 1.5);

  // ---- sackcloth skirt and the gut sagging out from under the booth -----------
  const skirt = clothMat('#5a4a3a', p.t, 6);
  const sk: V2[] = [B(-15, -2), B(15, -2)];
  for (let i = 0; i <= 6; i++) {
    const u = 15 - i * 5;
    sk.push(B(u + Math.sin(p.t * 6 + i) * 1, -14 - (i % 2) * 4 - hash2(i, 1, 4) * 3));
  }
  f.poly(sk, skirt, 2.5);
  const gut = B(2, -6);
  f.ellipse(gut[0], gut[1], 14, 6.5, skin, 2.8, L);

  // ---- the confessional carapace ---------------------------------------------------
  f.poly([B(-17, -7), B(17, -7), B(18.5, 40), B(-18.5, 40)], WOOD, 4);
  f.poly([B(-21.5, 39), B(21.5, 39), B(0, 53)], WOOD_D, 4.02);
  f.capsule(...B(-22, 39), ...B(22, 39), 2.6, 2.6, WOOD_L, 4.3);
  f.capsule(...B(-20, -7), ...B(20, -7), 2.4, 2.4, WOOD_D, 4.3);
  f.capsule(...B(-21, 40.5), ...B(0, 54), 1.4, 1.4, WOOD_L, 4.31);
  f.capsule(...B(21, 40.5), ...B(0, 54), 1.4, 1.4, WOOD_L, 4.31);
  // corner posts with turned finials
  for (const u of [-17, 17]) {
    f.capsule(...B(u, -6), ...B(u * 1.06, 38), 2.2, 2.2, u > 0 ? WOOD_L : WOOD_D, 4.2);
    f.ellipse(...B(u * 1.2, 43), 1.8, 2.2, GOLD, 4.35);
  }
  // gold cross on the peak
  f.capsule(...B(0, 53), ...B(0, 63), 1.2, 1.2, GOLD, 4.4);
  f.capsule(...B(-3.5, 59.5), ...B(3.5, 59.5), 1.1, 1.1, GOLD, 4.4);
  // gilt moulding
  f.capsule(...B(-16, 36.5), ...B(16, 36.5), 0.7, 0.7, GOLD, 4.32);
  f.capsule(...B(-15, 18), ...B(15, 18), 0.6, 0.6, GOLD, 4.32);
  // shingles on the roof
  f.stain((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return v > 40 && v < 53 && ((v + 40) % 3.2 < 0.8 || Math.abs(((u + (Math.floor(v / 3.2) % 2) * 2 + 40) % 4) - 2) < 0.4);
  }, back(WOOD, 0.55), [WOOD_D], BB(-23, 39, 23, 54));
  // carved lower panel: a sunken field with a raised cross; vertical planks above
  const pb = BB(-14, -4, 14, 16);
  f.relief((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    if (Math.abs(u) < 13 && v > -3 && v < 15) {
      if (Math.abs(u) < 11 && v > -1 && v < 13) return (Math.abs(u) < 1.3 && v > 1 && v < 11) || (Math.abs(v - 7.5) < 1.3 && Math.abs(u) < 5) ? 0.6 : -1.6;
      return 0.4;
    }
    return 0;
  }, pb, [WOOD]);
  f.stain((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return (Math.abs(u) < 1.3 && v > 1 && v < 11) || (Math.abs(v - 7.5) < 1.3 && Math.abs(u) < 5);
  }, WOOD_L, [WOOD], pb);
  f.relief((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return v > 16 && Math.abs(((u + 40) % 5.5) - 2.75) < 0.5 ? -1.2 : 0;
  }, BB(-18, 15, 18, 40), [WOOD]);
  // the grille: dark cell, two candle-flame eyes, a carved lattice
  const gc = B(5, 27);
  f.add((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return u > -2 && u < 12 && v > 20 && (v < 30 || (u - 5) ** 2 + (v - 30) ** 2 < 49);
  }, VOID, 4.5, [gc[0] - 12, gc[1] - 14, gc[0] + 12, gc[1] + 12]);
  const flick = Math.sin(p.t * 9) * 0.3;
  f.ellipse(...B(3.5, 28), 1.7, 1.3 + flick * 0.5, GLOW, 4.55);
  f.ellipse(...B(8.5, 28.5), 1.6, 1.2, GLOW, 4.55);
  f.stain((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return Math.abs(((u + v + 80) % 4) - 2) < 0.55 || Math.abs(((u - v + 80) % 4) - 2) < 0.55;
  }, WOOD_L, [VOID, GLOW], BB(-3, 19, 13, 38));
  // grille frame
  tube(f, [B(-2.5, 19.5), B(12.5, 19.5), B(12.5, 30), B(10, 35.5), B(5, 37.5), B(0, 35.5), B(-2.5, 30), B(-2.5, 19.5)], 0.8, 0.8, GOLD, 4.6);
  // tears of wax and blood weeping from under the grille
  f.stain((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return v < 19 && v > 4 + (u % 3) * 2 && (Math.abs(u - 2) < 0.6 || Math.abs(u - 9) < 0.7);
  }, BLOOD, [WOOD], BB(0, 3, 11, 20));
  // nails driven through the booth into the meat beneath
  for (const [u, v] of [[-14, 2], [14, 4], [-14, 33], [14, 34], [-6, -4], [8, -4]] as const) {
    f.ellipse(...B(u, v), 1.2, 1.2, IRON, 4.7);
    f.stain((x, y) => {
      const [uu, vv] = toLocal(hip, L, x, y);
      return Math.abs(uu - u) < 0.6 && vv < v && vv > v - 5 - Math.abs(u) * 0.1;
    }, BLOOD, [WOOD], BB(u - 1, v - 7, u + 1, v));
  }
  // old blood soaking the base of the booth
  f.stain((x, y) => {
    const [, v] = toLocal(hip, L, x, y);
    return v < 2 + vn(x, 0, 2, 9) * 6;
  }, OLD_BLOOD, [WOOD, WOOD_L], BB(-23, -9, 23, 9));
  // flesh bulging out of a split seam on the back
  const bulge = B(-18, 12);
  f.ellipse(bulge[0], bulge[1], 3, 8, skin, 4.25, L);
  stitches(f, B(-19.5, 6), B(-19.5, 18), 4, 1.8, 4.26);

  // ---- near leg ----------------------------------------------------------------------
  leg(lF.knee, lF.foot, skin, 5);

  // ---- censer (behind the front arm when held behind) -------------------------------
  const ca = p.chainA ?? (p.swing ?? 0) * 0.27;
  const cpos: V2 = p.censer ?? [hF[0] + Math.sin(ca) * 22, hF[1] + Math.cos(ca) * 22];
  const behind = cpos[0] < hip[0] - 10;
  drawCenser(f, cpos, hF, behind ? 0.8 : 7, p.swing ?? 0, p.smoke ?? 0, p.t);
  if (p.smear && p.trail) {
    // a smear of brass and ember light along the censer's arc
    const pts = [...p.trail, cpos];
    const n = pts.length - 1;
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      f.capsule(a[0], a[1], b[0], b[1], 0.6 + ((i - 1) / n) * 3.2, 0.6 + (i / n) * 3.2, SMEAR, 0.5);
    }
  }

  // ---- near arm ----------------------------------------------------------------------
  arm(eF, hF, skin, 8);

  // ---- scars: raised whip welts, a sewn gash, blood -------------------------------------
  const lash = (x: number, y: number) => {
    const d = Math.abs(((x * 0.7 + y + 400) % 9) - 4.5);
    return d < 1.2 && vn(x, y, 3, 14) > 0.55 ? 1.2 - d : 0;
  };
  f.relief((x, y) => lash(x, y) * 1.4, undefined, [skin, skinB]);
  f.stain((x, y) => lash(x, y) > 0.75, RAW, [skin, skinB]);
  f.stain((x, y) => vn(x, y, 2.4, 15) > 0.82, BLOOD, [skin, skinB, RAW]);
  f.stain((x, y) => y > footY - 6 && hash2(x | 0, y | 0, 5) < 0.5, BLOOD, [skin, skinB], [0, footY - 7, w, footY + 1]);
  const g0 = along(shoulder, eF, 0.3, 1);
  const g1 = along(shoulder, eF, 0.75, -1.5);
  f.stain(lineMask([g0, g1], 0.55), RAW, [skin]);
  stitches(f, g0, g1, 4, 1.5, 8.3, CATGUT);
  stitches(f, [lF.knee[0] - 3, lF.knee[1] - 3], [lF.knee[0] + 3, lF.knee[1] + 3], 3, 1.4, 5.3);
  if (p.hurt) f.stain((x, y) => vn(x, y, 2.6, 41) > 0.72, BLOOD, [skin, skinB, WOOD]);
  void THREAD; void NAIL; void drip;
  return renderFig(f);
}

function drawDead() {
  const { w, h, footY } = PENITENT;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.35);
  const skinB = back(skin, 0.33);
  pool(f, 64, footY - 0.5, 50, BLOOD, 13);
  pool(f, 80, footY, 22, OLD_BLOOD, 14, 0.2);
  // booth on its back, roof snapped off and lying beyond
  const hip: V2 = [84, footY - 12];
  const L = -Math.PI / 2 + 0.06;
  const B = (u: number, v: number) => loc(hip, L, u, v);
  // splayed legs (to the right), arms flung out
  f.capsule(hip[0], hip[1], 100, footY - 18, 7, 5.5, skinB, 1);
  f.capsule(100, footY - 18, 116, footY - 6, 5.5, 4, skinB, 1);
  f.capsule(114, footY - 6, 122, footY - 10, 3.4, 2.6, skinB, 1.1);
  f.capsule(hip[0], hip[1] + 2, 104, footY - 4, 7.5, 6, skin, 5);
  f.capsule(104, footY - 4, 120, footY - 3, 6, 4.5, skin, 5);
  f.capsule(119, footY - 4, 124, footY - 12, 3.4, 2.6, skin, 5.1);
  // the booth
  f.poly([B(-14, -7), B(14, -7), B(15, 40), B(-15, 40)], WOOD, 4);
  f.capsule(...B(-16, -7), ...B(16, -7), 2.4, 2.4, WOOD_D, 4.2);
  f.capsule(...B(-17, 40), ...B(17, 40), 2.6, 2.6, WOOD_L, 4.2);
  for (const u of [-14, 14]) f.capsule(...B(u, -6), ...B(u, 39), 2, 2, u > 0 ? WOOD_D : WOOD_L, 4.1);
  // the split: a jagged crack spilling meat
  const crack: V2[] = [B(-15, 18), B(-6, 22), B(-1, 16), B(5, 24), B(15, 20)];
  f.stain((x, y) => {
    for (let i = 1; i < crack.length; i++) {
      const a = crack[i - 1];
      const b = crack[i];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (y - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2)));
      if (Math.hypot(x - a[0] - (b[0] - a[0]) * t, y - a[1] - (b[1] - a[1]) * t) < 2.2) return true;
    }
    return false;
  }, RAW, [WOOD]);
  f.ellipse(...B(0, 20), 6, 3, RAW, 4.5);
  // the grille knocked loose, the candles out
  f.poly([B(-11, 24), B(-1, 24), B(-1, 36), B(-11, 36)], VOID, 4.3);
  f.stain((x, y) => {
    const [u, v] = toLocal(hip, L, x, y);
    return Math.abs(((u + v + 80) % 4) - 2) < 0.55 || Math.abs(((u - v + 80) % 4) - 2) < 0.55;
  }, WOOD_L, [VOID]);
  f.stain((x, y) => vn(x, y, 2, 4) > 0.6, OLD_BLOOD, [WOOD, WOOD_L, WOOD_D]);
  // flung arms
  f.capsule(...B(-3, 34), 50, footY - 30, 6.5, 5.2, skinB, 3.8);
  f.capsule(50, footY - 30, 40, footY - 44, 5, 4.2, skinB, 3.8);
  f.ellipse(39, footY - 46, 4.6, 4.4, skinB, 3.9);
  f.capsule(...B(3, 32), 54, footY - 4, 6.6, 5.2, skin, 6);
  f.capsule(54, footY - 4, 36, footY - 3, 5, 4.3, skin, 6);
  f.ellipse(34, footY - 4, 4.8, 4.2, skin, 6.1);
  f.ellipse(44, footY - 4, 4.5, 4.5, IRON, 6.2);
  // the roof, broken off
  f.poly([[8, footY - 2], [26, footY - 3], [14, footY - 16]], WOOD_D, 2);
  f.capsule(14, footY - 16, 12, footY - 26, 1.2, 1.2, GOLD, 2.1);
  f.capsule(9, footY - 22, 15, footY - 22.5, 1.1, 1.1, GOLD, 2.1);
  // splinters
  for (let k = 0; k < 5; k++) f.capsule(28 + k * 6, footY - 1, 31 + k * 6, footY - 3 - (k % 2) * 2, 0.8, 0.5, WOOD_L, 2.2);
  // the censer, toppled and spilling embers
  f.ellipse(112, footY - 22, 6.5, 5, BRASS, 0.8);
  f.ellipse(106, footY - 24, 4, 3, BRASS, 0.85);
  for (let k = 0; k < 5; k++) f.ellipse(100 - k * 2.5, footY - 3 - (k % 2), 0.8, 0.7, GLOW, 0.9);
  for (let k = 0; k < 4; k++) f.ellipse(108 - k * 3, footY - 30 - k * 4, 2 + k * 0.7, 1.8 + k * 0.5, SMOKE, 0.3);
  f.stain((x, y) => vn(x, y, 1.7, 41) > 0.68, BLOOD, [skin, skinB]);
  f.stain((x, y) => Math.abs(((x * 0.7 + y + 400) % 7) - 3.5) < 0.45 && vn(x, y, 3, 14) > 0.45, RAW, [skin, skinB]);
  return renderFig(f);
}

const BASE: PP = {
  x: 52, lean: 0.06,
  armF: { a: 0.35, b: 0.3 }, armB: { a: -0.15, b: 0.35 },
  legF: { a: 0.25, b: 0.2 }, legB: { a: -0.2, b: 0.15 }, t: 0,
};

export function penitentAnims(): AnimDef[] {
  const TAU = Math.PI * 2;
  const F = PENITENT.footY;
  const idle = (i: number): PP => {
    const a = (i / 4) * TAU;
    // a heavy heave of breath; the censer swings a beat behind the fist
    return { ...BASE, lean: 0.07 + Math.sin(a) * 0.025, armF: { a: 0.35 + Math.sin(a - 0.5) * 0.05, b: 0.3 + Math.sin(a - 1) * 0.04 }, armB: { a: -0.15 + Math.sin(a - 0.8) * 0.04, b: 0.35 }, chainA: Math.sin(a - 1.2) * 0.16, t: i / 4 };
  };
  const walk = (i: number): PP => {
    const ph = (i / 8) * TAU;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    return {
      ...BASE,
      lean: 0.12 + Math.abs(c) * 0.035,
      legF: { a: s * 0.45, b: 0.2 + Math.max(0, c) * 0.75 },
      legB: { a: -s * 0.45, b: 0.2 + Math.max(0, -c) * 0.75 },
      armF: { a: 0.35 - s * 0.22, b: 0.35 + Math.max(0, -s) * 0.1 },
      armB: { a: -0.1 + s * 0.28, b: 0.4 },
      chainA: -Math.sin(ph - 0.9) * 0.42,
      swing: -Math.sin(ph - 0.9),
      t: i / 8,
    };
  };
  const SLAM_UP: PP[] = [
    // anticipation: sinks, the fist drops back, the censer swings behind
    { ...BASE, x: 53, lean: 0.2, armF: { a: -0.35, b: 0.45 }, armB: { a: -0.4, b: 0.4 }, legF: { a: 0.35, b: 0.45 }, legB: { a: -0.3, b: 0.35 }, chainA: -0.7, t: 0.1 },
    { ...BASE, x: 55, lean: 0.0, armF: { a: 1.2, b: 0.35 }, armB: { a: 0.9, b: 0.4 }, legF: { a: 0.4, b: 0.35 }, legB: { a: -0.35, b: 0.2 }, censer: [38, 52], t: 0.15 },
    { ...BASE, x: 56, lean: -0.12, armF: { a: 2.2, b: 0.3 }, armB: { a: 2.0, b: 0.4 }, legF: { a: 0.45, b: 0.35 }, legB: { a: -0.35, b: 0.2 }, censer: [26, 30], t: 0.2 },
    { ...BASE, x: 56, lean: -0.18, armF: { a: 2.55, b: 0.25 }, armB: { a: 2.35, b: 0.4 }, legF: { a: 0.45, b: 0.35 }, legB: { a: -0.35, b: 0.2 }, censer: [22, 18], t: 0.25 },
  ];
  const slamPose: PP = { ...BASE, x: 46, lean: 0.42, armF: { a: 1.25, b: 0.15 }, armB: { a: 1.0, b: 0.3 }, legF: { a: 0.55, b: 0.6 }, legB: { a: -0.5, b: 0.15 } };
  const SLAM: PP[] = [
    { ...slamPose, x: 50, lean: 0.25, armF: { a: 1.9, b: 0.1 }, armB: { a: 1.6, b: 0.3 }, censer: [86, 22], smear: 1, trail: [[22, 18], [44, 9], [68, 11]], t: 0.35 },
    { ...slamPose, censer: [112, F - 8], smoke: 1, smear: 1, trail: [[86, 22], [104, 44], [112, 70]], t: 0.4 },
    { ...slamPose, x: 47, lean: 0.38, armF: { a: 1.3, b: 0.2 }, censer: [108, F - 12], smoke: 1.4, t: 0.5 },
  ];
  const SWEEP_UP: PP[] = [
    { ...BASE, x: 54, lean: 0.04, armF: { a: -0.1, b: 0.25 }, armB: { a: -0.2, b: 0.3 }, legF: { a: 0.35, b: 0.25 }, legB: { a: -0.3, b: 0.15 }, chainA: -0.6, t: 0.5 },
    { ...BASE, x: 60, lean: -0.05, armF: { a: -0.75, b: 0.2 }, armB: { a: -0.4, b: 0.3 }, legF: { a: 0.45, b: 0.3 }, legB: { a: -0.35, b: 0.15 }, censer: [12, F - 14], t: 0.6 },
  ];
  const sweepPose: PP = { ...BASE, x: 46, lean: 0.25, armF: { a: 1.6, b: -0.05 }, armB: { a: 1.2, b: 0.3 }, legF: { a: 0.5, b: 0.4 }, legB: { a: -0.45, b: 0.15 } };
  const SWEEP: PP[] = [
    { ...sweepPose, x: 52, lean: 0.12, armF: { a: 0.6, b: 0.05 }, armB: { a: 0.5, b: 0.3 }, censer: [76, F - 8], smear: 1, trail: [[12, F - 14], [34, F - 4], [56, F - 2]], t: 0.7 },
    { ...sweepPose, censer: [116, 50], smear: 1, trail: [[76, F - 8], [100, F - 26], [112, 64]], t: 0.8 },
    { ...sweepPose, x: 47, lean: 0.3, armF: { a: 2.1, b: -0.1 }, armB: { a: 1.4, b: 0.3 }, censer: [104, 27], smear: 1, trail: [[116, 50], [114, 36]], t: 0.9 },
  ];
  const STAG: PP[] = [
    { ...BASE, x: 50, lean: -0.3, armF: { a: -0.3, b: 0.5 }, armB: { a: -0.7, b: 0.3 }, legF: { a: 0.45, b: 0.25 }, legB: { a: -0.1, b: 0.3 }, chainA: -0.9, hurt: true, t: 0.3 },
    { ...BASE, x: 50, lean: -0.08, armF: { a: 0.15, b: 0.5 }, armB: { a: -0.3, b: 0.35 }, legF: { a: 0.35, b: 0.3 }, legB: { a: -0.2, b: 0.25 }, chainA: 0.5, hurt: true, t: 0.5 },
  ];
  const FALL: PP[] = [
    { ...BASE, x: 74, hipY: F - 22, lean: -0.85, armF: { a: -1.4, b: 0.5 }, armB: { a: -1.7, b: 0.3 }, legF: { a: 1.0, b: 0.6 }, legB: { a: 0.7, b: 0.5 }, chainA: 0.3, hurt: true, t: 0.4 },
  ];
  return [
    anim('idle', [0, 1, 2, 3].map((i) => drawPenitent(idle(i))), 4),
    anim('walk', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => drawPenitent(walk(i))), 9),
    anim('windup', SLAM_UP.map(drawPenitent), 5, 0),
    anim('attack', SLAM.map(drawPenitent), 12, 0),
    anim('sweep-windup', SWEEP_UP.map(drawPenitent), 4, 0),
    anim('sweep', SWEEP.map(drawPenitent), 12, 0),
    anim('stagger', STAG.map(drawPenitent), 5, 0),
    anim('dead', [...FALL.map(drawPenitent), drawDead()], 6, 0),
  ];
}
