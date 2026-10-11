// The Bile Gossip: a bloated sack of flesh with too many mouths. The one that
// spoke is sewn shut; the one in its belly never learned to stop.
import {
  BILE, BLOOD, OLD_BLOOD, MOUTH, TEETH, VEIN, RAW, NAIL,
  anim, back, blotch, lineMask, dome, drip, ellMask, pool, renderFig, ridge, skinMat, stitches, tube, veins, vn, vnOf, frame, fgrain,
  type AnimDef, type Material, type V2,
} from './common';

export const GOSSIP = { w: 96, h: 80, footY: 74 };

const SKIN = '#bc9a80';
const LIP: Material = { ramp: ['#1a0608', '#3e1014', '#62202a', '#84343c', '#a24a4c', '#c06a62', '#dc9282'], spec: 0.7, tex: fgrain(1, 0.06, 5), glint: '#ffd8c8', shine: 22, dither: 0.3 };
const SCLERA: Material = { ramp: ['#3a2a20', '#6a5a40', '#a89870', '#d4c8a0', '#efe6c8'], spec: 0.9, glint: '#ffffff', shine: 20, dither: 0 };
const IRIS: Material = { ramp: ['#000000', '#140e06', '#2e2610'], round: 0.3, dither: 0 };
const BRUISE = skinMat('#8a6670', 0.4);
const mottle = vnOf(4, 31);
const BILE_HI: Material = { ...BILE, ramp: BILE.ramp.slice(3) };

interface GP {
  swell: number; // inhale 0..1 (negative: emptied)
  bob: number;
  step: number; // walk phase (radians); NaN = standing
  open: number; // belly mouth 0..1
  spit: number; // bile spray 0..1
  lean: number;
  /** Horizontal squash on footfall (+ wider, shorter). */
  squash?: number;
  /** Arm swing phase. */
  arm?: number;
  /** Eyes shut 0..1. */
  blink?: number;
  /** Deflation while dying 0..1. */
  sag?: number;
  hurt?: boolean;
  t: number;
}

function drawGossip(p: GP) {
  const { w, h, footY } = GOSSIP;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.55, fgrain(1.6, 0.06, 12));
  const skinB = back(skin, 0.3);
  const sw = p.swell;
  const sq = p.squash ?? 0;
  const sag = p.sag ?? 0;
  const rx = (24 + sw * 4) * (1 + sq * 0.05 + sag * 0.08);
  const ry = (21 + sw * 4) * (1 - sq * 0.05 - sag * 0.4);
  const cx = 42 + p.lean * 4;
  const cy = footY - 30 - ry + 21 + p.bob - sw * 2 + sag * 4;
  // ---- stubby legs ---------------------------------------------------------
  const walking = !isNaN(p.step);
  const st = walking ? p.step : 0;
  const leg = (hx: number, ph: number, m: Material, layer: number) => {
    const sw2 = walking ? Math.sin(st + ph) * 5 : 0;
    const lift = walking ? Math.max(0, Math.cos(st + ph)) * 3 : 0;
    const hip: V2 = [hx, footY - 13 + sag * 4];
    const foot: V2 = [hx + sw2, footY - 3 - lift];
    f.capsule(hip[0], hip[1], foot[0] - 1, foot[1] - 2, 5.6, 4.4, m, layer);
    // fat ring at the ankle and a broad, padded foot
    f.ellipse(foot[0] - 0.5, foot[1] - 2.2, 5.0, 2.6, m, layer + 0.05);
    f.ellipse(foot[0] + 1.5, foot[1], 5.4, 3.0, m, layer + 0.1);
    ridge(f, [[foot[0] - 5, foot[1] - 3.6], [foot[0] + 4, foot[1] - 3.2]], 0.8, -1.6, [m]);
    for (let k = 0; k < 3; k++) f.ellipse(foot[0] + 5.8 + k * 0.2, foot[1] - 1.4 + k * 1.3, 1.3, 1.0, NAIL, layer + 0.2);
  };
  leg(cx - 8, Math.PI, skinB, 1);

  // ---- the sack: one continuous body, so it inflates as a single mass -------------
  const hd: V2 = [cx + 17 + sw * 2, cy - ry + 9 + sag * 3];
  const belly: [number, number, number, number] = [cx + 3, cy + ry - 8 + sag * 2, rx * 1.02, 11 + sw * 2 - sag * 3];
  const rump: [number, number, number, number] = [cx - 13, cy + ry - 13, 10, 9];
  const inE = (x: number, y: number, ex: number, ey: number, erx: number, ery: number) => ((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2 <= 1;
  const hc = Math.cos(-0.25);
  const hs = Math.sin(-0.25);
  f.add(
    (x, y) => {
      if (inE(x, y, cx, cy, rx, ry) || inE(x, y, ...belly) || inE(x, y, ...rump) || inE(x, y, hd[0] + 7, hd[1] + 5, 6, 5)) return true;
      const dx = x - hd[0];
      const dy = y - hd[1];
      const u = dx * hc - dy * hs;
      const v = dx * hs + dy * hc;
      return (u * u) / 121 + (v * v) / 90 <= 1;
    },
    skin,
    3,
    [cx - rx - 2, hd[1] - 12, Math.max(cx + rx, hd[0] + 13) + 1, belly[1] + belly[3] + 1],
  );
  // the old head swells out of the top-front of the sack
  dome(f, hd[0] + 1, hd[1], 11, 9.5, 4.5, 0.25, [skin]);
  dome(f, hd[0] + 7, hd[1] + 5, 6, 5, 2.5, 0, [skin]); // jowl
  dome(f, belly[0] + 2, belly[1] - 1, belly[2] * 0.85, belly[3] * 0.9, 3.5, 0, [skin]); // hanging belly
  dome(f, rump[0], rump[1], rump[2], rump[3], 2.5, 0, [skin]);
  // ---- relief: rolls of fat, the drowned neck, stretch marks ---------------------
  const arc = (r: number, a0: number, a1: number, ox = 0, oy = 0): V2[] => {
    const out: V2[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = a0 + ((a1 - a0) * k) / 8;
      out.push([cx + ox + Math.cos(a) * rx * r, cy + oy + Math.sin(a) * ry * r]);
    }
    return out;
  };
  ridge(f, arc(0.78, 0.35, 2.6, 2, 6), 1.5, -2.6, [skin]); // belly roll crease
  ridge(f, arc(0.9, 0.6, 2.2, 2, 2), 1.1, -1.8, [skin]);
  ridge(f, arc(0.6, 1.9, 3.1, -8, 6), 1.3, -2.0, [skin]); // back-fat crease
  // a deep fold where the head drowned in the body
  const fold: V2[] = [];
  for (let k = 0; k <= 8; k++) {
    const a = 2.4 + k * 0.22;
    fold.push([hd[0] - 1 + Math.cos(a) * 11.5, hd[1] + 1 + Math.sin(a) * 10.5]);
  }
  ridge(f, fold, 1.6, -3.2, [skin]);
  dome(f, hd[0] + 1, hd[1] - 1, 9, 7, 1.5, 0.25, [skin]); // brow mass
  for (let k = 0; k < 6; k++) {
    const a = -0.5 + k * 0.28;
    const x0 = cx + Math.cos(a) * rx * 0.55 - 4;
    const y0 = cy + Math.sin(a) * ry * 0.55 + 7;
    ridge(f, [[x0, y0], [x0 + 3.2, y0 + 2.4 + (k % 2)]], 0.6, -1.1, [skin]);
  }
  // ---- surface: mottling and veins standing proud of the skin ---------------------
  f.stain((x, y) => mottle(x, y) > 0.7, back(skin, 0.16), [skin]);
  f.stain((x, y) => blotch(3, 0.78, 37)(x, y) && y > cy, BRUISE, [skin]);
  const vm = veins(6 - sw * 1.5, 0.017 + sw * 0.01, 7);
  f.relief((x, y) => (vm(x, y) ? 0.9 : 0), [cx - rx, cy - ry, cx + rx, cy + ry], [skin, BRUISE]);
  f.stain(vm, VEIN, [skin, BRUISE]);

  // ---- the sewn upper mouth ------------------------------------------------------
  const um: V2 = [hd[0] + 6, hd[1] + 5];
  f.capsule(um[0] - 6, um[1] - 1.6, um[0] + 4, um[1] - 1, 2.0, 1.8, LIP, 3.4);
  f.capsule(um[0] - 5.5, um[1] + 1.6, um[0] + 3.5, um[1] + 1.4, 2.2, 1.9, LIP, 3.41);
  f.capsule(um[0] - 6, um[1] + 0.1, um[0] + 4, um[1] + 0.3, 0.5, 0.5, MOUTH, 3.45);
  stitches(f, [um[0] - 6, um[1]], [um[0] + 4, um[1] + 0.3], 5, 3.0, 3.5);
  // the pull of the thread puckers the lips
  for (let k = 0; k < 5; k++) dome(f, um[0] - 5 + k * 2, um[1], 1, 2.6, -1.2, 0, [LIP]);
  f.stain((x, y) => Math.hypot(x - um[0], y - um[1]) < 5 && vn(x, y, 1, 3) > 0.62, BLOOD, [LIP]);
  drip(f, um[0] + 3.5, um[1] + 2.5, 4 + Math.sin(p.t * 6.28) * 1.5 + 1.5, BILE, 3.6, 0.7);
  drip(f, um[0] - 4, um[1] + 3, 2.5, BILE, 3.6, 0.55);

  // ---- tiny weeping eyes, all over -----------------------------------------------
  const eyes: [number, number, number][] = [
    [hd[0] + 4, hd[1] - 2.5, 1.8],
    [hd[0] - 2.5, hd[1] - 4.5, 1.4],
    [hd[0] + 9, hd[1] + 0.5, 1.1],
    [cx - 8, cy - 9, 1.3],
    [cx - 18, cy + 1, 1.0],
  ];
  const blink = p.blink ?? 0;
  eyes.forEach(([ex, ey, r], i) => {
    const lid = back(skin, 0.12);
    f.ellipse(ex, ey, r + 1.4, r + 1.0, lid, 3.55); // puffy lid
    dome(f, ex, ey - r * 0.6, r + 1.2, r * 0.7, 1.4, 0, [lid]);
    const shut = i % 2 ? blink : blink * 0.7;
    if (shut < 0.8) {
      const ry2 = r * 0.8 * (1 - shut);
      f.ellipse(ex + 0.3, ey, r, Math.max(0.5, ry2), SCLERA, 3.6);
      f.ellipse(ex + 0.3 + r * 0.3, ey + 0.1, r * 0.45, Math.min(r * 0.55, Math.max(0.4, ry2)), IRIS, 3.65);
    } else {
      ridge(f, [[ex - r, ey], [ex + r, ey + 0.3]], 0.6, -1.6, [lid]);
    }
    f.stain((x, y) => Math.abs(Math.hypot(x - ex - 0.3, (y - ey) * 1.2) - r - 0.5) < 0.4, LIP, [skin, lid], [ex - r - 3, ey - r - 3, ex + r + 3, ey + r + 3]);
    // tears: yellowed and bloody
    const tear = i % 2 ? BILE : BLOOD;
    f.stain((x, y) => Math.abs(x - ex - 0.3 - Math.sin(y * 0.5) * 0.3) < 0.55 && y > ey + r && y < ey + r + 5 + i, tear, [skin], [ex - 2, ey, ex + 3, ey + r + 7 + i]);
  });

  // ---- the belly mouth ---------------------------------------------------------------
  const bm: V2 = [cx + rx - 6, cy + 10];
  const op = p.open;
  const bry = 1.8 + op * 7;
  const brx = 6.5 + op * 1.5;
  f.ellipse(bm[0] - 0.5, bm[1], brx + 2.6, bry + 2.6, LIP, 3.8);
  ridge(f, [[bm[0] - brx - 2, bm[1] - bry - 1.6], [bm[0] + brx, bm[1] - bry - 1.8]], 1, 1.2, [LIP]);
  f.ellipse(bm[0], bm[1], brx, bry, MOUTH, 3.85);
  // throat dark at the back, gullet glistening
  if (op > 0.25) f.ellipse(bm[0] + 1, bm[1] - bry * 0.1, brx * 0.55, bry * 0.55, { ramp: ['#020001', '#0a0204', '#1a0508'], round: -1, dither: 0 }, 3.86);
  const nT = 7;
  for (let k = 0; k < nT; k++) {
    const t = (k + 0.5) / nT;
    const x = bm[0] - brx + t * brx * 2;
    const yy = Math.sqrt(Math.max(0, 1 - ((x - bm[0]) / brx) ** 2)) * bry;
    const L = 1.4 + (k % 2) * 0.8 + op;
    f.capsule(x, bm[1] - yy - 0.3, x + 0.3, bm[1] - yy + L, 0.7, 0.3, TEETH, 3.9);
    f.capsule(x + 0.5, bm[1] + yy + 0.3, x + 0.4, bm[1] + yy - L, 0.7, 0.3, TEETH, 3.9);
  }
  if (op > 0.3) {
    f.ellipse(bm[0] - 1, bm[1] + bry * 0.45, brx * 0.7, bry * 0.32, RAW, 3.87); // tongue
    ridge(f, [[bm[0] - brx * 0.6, bm[1] + bry * 0.45], [bm[0] + brx * 0.4, bm[1] + bry * 0.4]], 0.5, -1, [RAW]);
    f.stain((x, y) => Math.abs(y - bm[1]) < 0.8 && x > bm[0] - brx - 4 && x < bm[0] - brx + 1, BLOOD, [skin, LIP], [bm[0] - brx - 5, bm[1] - 2, bm[0] - brx + 2, bm[1] + 2]);
    // strings of spit across the gape
    if (op < 0.95) tube(f, [[bm[0] - brx * 0.5, bm[1] - bry * 0.8], [bm[0] - brx * 0.3, bm[1] + 0.5], [bm[0] - brx * 0.2, bm[1] + bry * 0.7]], 0.35, 0.35, BILE, 3.95);
  }
  // bile drool hanging from the belly mouth
  drip(f, bm[0] + 2, bm[1] + bry + 2.5, 5 + op * 3 + Math.sin(p.t * 6.28 + 1) * 1.2, BILE, 4, 0.9);
  drip(f, bm[0] - 3, bm[1] + bry + 2.5, 3 + Math.sin(p.t * 6.28 + 2.5), BILE, 4, 0.6);

  // ---- withered little arms, clutching at the belly -----------------------------------
  const ap = p.arm ?? 0;
  const sh: V2 = [cx + rx * 0.62, cy - ry * 0.25];
  const el: V2 = [sh[0] + 3 + Math.sin(ap) * 1.2, sh[1] + 6 + Math.cos(ap) * 0.8];
  const hn: V2 = [el[0] + 4 + Math.sin(ap - 0.6) * 1.5, el[1] + 3.5];
  f.capsule(sh[0], sh[1], el[0], el[1], 1.7, 1.3, skin, 4.5);
  f.capsule(el[0], el[1], hn[0], hn[1], 1.3, 1.0, skin, 4.5);
  for (let k = 0; k < 3; k++) f.capsule(hn[0], hn[1], hn[0] + 1.6 + k * 0.2, hn[1] + 1.2 + k * 0.7, 0.55, 0.4, skin, 4.6);

  // ---- the spray --------------------------------------------------------------------
  if (p.spit > 0) {
    const sp = p.spit;
    // a gout of bile: a thick arcing jet with thinner streams peeling off it
    const reach = 14 + sp * 14;
    const jet = (dy: number, curve: number, r0: number, r1: number, len: number, layer: number) => {
      const pts: V2[] = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push([bm[0] + 1 + t * len, bm[1] + dy * t + t * t * curve]);
      }
      tube(f, pts, r0, r1, BILE, layer);
      return pts;
    };
    jet(-5, 3, 1.1, 0.6, reach * 0.8, 5.9);
    jet(5, 6, 1.2, 0.6, reach * 0.85, 5.9);
    const core = jet(0, 4, Math.max(1.5, bry * 0.55), 1.4, reach, 6);
    // a hot, glossy core running down the jet
    f.stain(lineMask(core.slice(0, 5), 0.6), BILE_HI, [BILE]);
    for (let k = 0; k < 10; k++) {
      const t = 0.45 + k * 0.06;
      const x = Math.min(93, bm[0] + t * (reach + 6) + (k % 3) * 1.5);
      const y = bm[1] - 6 + t * t * 12 + ((k * 7) % 9) - 1;
      f.ellipse(x, y, 0.7 + (k % 3) * 0.4, 0.7 + (k % 2) * 0.4, BILE, 6.1);
    }
  }

  // ---- front leg -----------------------------------------------------------------
  leg(cx + 8, 0, skin, 5);

  // ---- grime ---------------------------------------------------------------------
  f.stain((x, y) => y > footY - 5 && vn(x, y, 1.5, 3) > 0.4, OLD_BLOOD, [skin, skinB], [0, footY - 6, w, footY + 1]);
  // weeping sores, swollen around the rim
  for (const [sx2, sy2, sr] of [[cx - 12, cy - 12, 2.2], [cx - 2, cy + 8, 1.8], [cx - 20, cy + 12, 1.6], [cx + 6, cy - 14, 1.4]] as const) {
    dome(f, sx2, sy2, sr + 2.2, sr + 2, 1.6, 0, [skin]);
    f.stain(ellMask(sx2, sy2, sr + 0.8, sr + 0.6), RAW, [skin], [sx2 - 4, sy2 - 4, sx2 + 4, sy2 + 4]);
    f.stain(ellMask(sx2, sy2, sr * 0.5, sr * 0.5), BLOOD, [RAW], [sx2 - 3, sy2 - 3, sx2 + 3, sy2 + 3]);
    f.stain((x, y) => Math.abs(x - sx2) < 0.6 && y > sy2 && y < sy2 + 4 + sr * 2, BLOOD, [skin], [sx2 - 1, sy2, sx2 + 1, sy2 + 5 + sr * 2]);
  }
  if (p.hurt) f.stain((x, y) => vn(x, y, 2.6, 40) > 0.72, BLOOD, [skin, skinB]);
  return renderFig(f);
}

function drawDead() {
  const { w, h, footY } = GOSSIP;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.55, fgrain(1.6, 0.06, 12));
  pool(f, 48, footY - 0.5, 40, BILE, 9);
  pool(f, 40, footY, 20, BLOOD, 10, 0.3);
  // limp stubby legs sticking out
  f.capsule(22, footY - 6, 10, footY - 4, 5, 4, back(skin, 0.3), 1);
  f.capsule(64, footY - 5, 76, footY - 3, 5, 4, skin, 4);
  f.ellipse(78, footY - 3, 4.5, 3, skin, 4.1);
  for (let k = 0; k < 3; k++) f.ellipse(82.5, footY - 4.5 + k * 1.3, 1.2, 0.9, NAIL, 4.2);
  // the deflated sack: a puddled hide with a burst crater
  f.add((x, y) => {
    const dx = (x - 46) / 32;
    const top = footY - 3 - 13 * Math.sqrt(Math.max(0, 1 - dx * dx)) * (0.75 + vn(x, 0, 5, 3) * 0.5);
    return Math.abs(dx) <= 1 && y >= top && y <= footY - 1;
  }, skin, 3, [12, footY - 22, 80, footY]);
  // wrinkles of empty skin: real folds
  for (let k = 0; k < 9; k++) {
    const x0 = 18 + k * 6 + (k % 2) * 2;
    ridge(f, [[x0, footY - 16], [x0 + 2 + Math.sin(k) * 2, footY - 9], [x0 + 1, footY - 2]], 1.1, k % 2 ? 1.6 : -1.6, [skin]);
  }
  f.stain(veins(5, 0.025, 7), VEIN, [skin]);
  // the burst: ragged hole with flaps, spilled innards
  f.ellipse(40, footY - 12, 10, 4, MOUTH, 3.5);
  for (let k = 0; k < 5; k++) f.poly([[30 + k * 5, footY - 12], [34 + k * 5, footY - 13], [31 + k * 5 + (k % 2) * 3, footY - 19 - (k % 3) * 2]], back(skin, 0.15), 3.6);
  f.ellipse(36, footY - 10, 4, 2.5, RAW, 3.7);
  f.ellipse(44, footY - 11, 3, 2, { ...RAW, ramp: ['#1a0a10', '#4a1a28', '#6a2a3a', '#8a4050'] }, 3.7);
  tube(f, [[42, footY - 9], [50, footY - 6], [56, footY - 7], [60, footY - 3]], 1.6, 1.4, RAW, 3.8);
  // the sewn mouth, still sewn
  f.capsule(62, footY - 9, 70, footY - 8, 1.8, 1.6, LIP, 3.9);
  stitches(f, [62, footY - 8.5], [70, footY - 8], 4, 2.4, 4);
  // the belly mouth, slack, tongue lolling into the bile
  f.ellipse(24, footY - 7, 5, 2.4, MOUTH, 3.9);
  for (let k = 0; k < 5; k++) f.ellipse(20 + k * 2, footY - 9, 0.6, 0.9, TEETH, 4);
  f.capsule(22, footY - 6, 16, footY - 2, 1.6, 1.2, RAW, 4.1);
  f.stain((x, y) => vn(x, y, 1.8, 5) > 0.6, BILE, [skin]);
  f.stain((x, y) => vn(x, y, 1.8, 6) > 0.75, BLOOD, [skin]);
  f.stain(ellMask(40, footY - 12, 14, 7), BLOOD, [skin]);
  return renderFig(f);
}

export function gossipAnims(): AnimDef[] {
  const base: GP = { swell: 0, bob: 0, step: NaN, open: 0, spit: 0, lean: 0, t: 0 };
  const TAU = Math.PI * 2;
  const idle = (i: number): GP => {
    const a = (i / 4) * TAU;
    return { ...base, bob: Math.sin(a) * 0.8 + 0.4, swell: 0.08 + Math.sin(a) * 0.08, open: 0.08 + Math.max(0, Math.sin(a * 2 + 0.8)) * 0.14, arm: a, blink: i === 3 ? 1 : 0, t: i / 4 };
  };
  const walk = (i: number): GP => {
    const a = (i / 8) * TAU;
    // a waddle: the sack lands on each footfall and rolls from side to side
    const land = Math.abs(Math.cos(a));
    return { ...base, step: a, bob: (1 - land) * -1.6 + 1.2, squash: land * 0.8 - 0.3, lean: 0.4 + Math.sin(a) * 0.35, open: 0.1, arm: a * 1 + 1, t: i / 8 };
  };
  const up = [0, 0.4, 0.8, 1];
  return [
    anim('idle', [0, 1, 2, 3].map((i) => drawGossip(idle(i))), 5),
    anim('walk', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => drawGossip(walk(i))), 10),
    // inhale: the sack swells, rears back, and the belly mouth clamps shut
    anim('windup', up.map((k, i) => drawGossip({ ...base, swell: 0.15 + k * 0.85, bob: -k * 2 + (i === 3 ? 0.6 : 0), open: 0.12 - k * 0.1, lean: -k, squash: -k * 0.5, arm: 2 + k, blink: k > 0.5 ? 1 : 0, t: k * 0.4 })), 7, 0),
    anim('attack', [
      drawGossip({ ...base, swell: 0.4, open: 1, spit: 0.4, lean: 0.8, squash: 0.6, arm: 3, t: 0.2 }),
      drawGossip({ ...base, swell: 0.1, open: 1, spit: 1, lean: 1.2, squash: 0.4, arm: 3.4, t: 0.5 }),
      drawGossip({ ...base, swell: 0, open: 0.9, spit: 0.7, lean: 1, squash: 0.2, arm: 3.8, t: 0.7 }),
      drawGossip({ ...base, swell: -0.1, open: 0.6, spit: 0.2, lean: 0.6, arm: 4.2, t: 0.9 }),
    ], 12, 0),
    anim('stagger', [
      drawGossip({ ...base, swell: -0.2, bob: 2, open: 0.5, lean: -1.4, squash: 0.8, hurt: true, blink: 1, arm: 5 }),
      drawGossip({ ...base, swell: -0.15, bob: 1, open: 0.3, lean: -0.6, squash: 0.2, hurt: true, arm: 6, t: 0.5 }),
    ], 6, 0),
    anim('dead', [
      drawGossip({ ...base, swell: -0.3, sag: 0.45, open: 0.6, lean: -0.3, hurt: true, blink: 1, t: 0.4 }),
      drawDead(),
    ], 8, 0),
  ];
}
