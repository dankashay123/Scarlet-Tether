// The Bile Gossip: a bloated sack of flesh with too many mouths. The one that
// spoke is sewn shut; the one in its belly never learned to stop.
import {
  BILE, BLOOD, OLD_BLOOD, MOUTH, TEETH, THREAD, VEIN, RAW, NAIL,
  anim, back, blotch, drip, ellMask, pool, renderFig, skinMat, stitches, tube, veins, valueNoise, frame, grain,
  type AnimDef, type Material, type V2,
} from './common';

export const GOSSIP = { w: 96, h: 80, footY: 74 };

const SKIN = '#c2a084';
const LIP: Material = { ramp: ['#1a0608', '#4a1418', '#7a2a30', '#a24a4c', '#c27068', '#e09a88'], spec: 0.6, tex: grain(1, 0.08, 5) };

interface GP {
  swell: number; // 0..1
  bob: number;
  step: number; // walk phase (radians); NaN = standing
  open: number; // belly mouth 0..1
  spit: number; // bile spray 0..1
  lean: number;
  hurt?: boolean;
  t: number;
}

function drawGossip(p: GP) {
  const { w, h, footY } = GOSSIP;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.55, grain(1.6, 0.08, 12));
  const skinB = back(skin, 0.3);
  const sw = p.swell;
  const cx = 42 + p.lean * 4;
  const cy = 44 + p.bob - sw * 2;
  const rx = 24 + sw * 4;
  const ry = 21 + sw * 4;
  // ---- stubby legs ---------------------------------------------------------
  const st = isNaN(p.step) ? 0 : p.step;
  const leg = (hx: number, ph: number, m: Material, layer: number) => {
    const sw2 = isNaN(p.step) ? 0 : Math.sin(st + ph) * 5;
    const lift = isNaN(p.step) ? 0 : Math.max(0, Math.cos(st + ph)) * 3;
    const hip: V2 = [hx, footY - 12];
    const foot: V2 = [hx + sw2, footY - 3 - lift];
    f.capsule(hip[0], hip[1], foot[0] - 1, foot[1] - 2, 5.2, 4.2, m, layer);
    f.ellipse(foot[0] + 1.5, foot[1], 5.2, 3.0, m, layer + 0.1);
    for (let k = 0; k < 3; k++) f.ellipse(foot[0] + 5.5 + k * 0.3, foot[1] - 1.5 + k * 1.3, 1.4, 1.1, NAIL, layer + 0.2);
  };
  leg(cx - 8, Math.PI, skinB, 1);

  // ---- the sack ----------------------------------------------------------------
  f.ellipse(cx, cy, rx, ry, skin, 3);
  // sagging belly rolls and a hanging dewlap
  f.ellipse(cx + 3, cy + ry - 8, rx * 1.02, 11 + sw * 2, skin, 3.05);
  f.ellipse(cx - 13, cy + ry - 13, 10, 9, skin, 3.04);
  // the old head: a swollen hump at the top-front of the sack
  const hd: V2 = [cx + 17 + sw * 2, cy - ry + 9];
  f.ellipse(hd[0], hd[1], 11, 9.5, skin, 3.2, 0.25);
  f.ellipse(hd[0] + 7, hd[1] + 5, 6, 5, skin, 3.25);
  // a deep fold where the head drowned in the body
  f.stain((x, y) => Math.abs(Math.hypot((x - hd[0] + 2) * 0.9, y - hd[1] + 1) - 11.5) < 0.8 && x < hd[0] + 6 && y > hd[1] - 6, back(skin, 0.5), [skin]);
  // ---- surface: mottling, veins, stretch marks -------------------------------
  f.stain(blotch(4, 0.7, 31), back(skin, 0.18), [skin]);
  f.stain((x, y) => blotch(3, 0.78, 37)(x, y) && y > cy, skinMat('#8e6a72', 0.4), [skin]);
  f.stain(veins(6 - sw * 1.5, 0.022 + sw * 0.01, 7), VEIN, [skin]);
  for (let k = 0; k < 5; k++) {
    const a = -0.6 + k * 0.32;
    const x0 = cx + Math.cos(a) * rx * 0.55;
    const y0 = cy + Math.sin(a) * ry * 0.55 + 6;
    f.stain((x, y) => Math.abs((x - x0) * 0.8 + (y - y0) * 0.6) < 0.5 && Math.hypot(x - x0, y - y0) < 5, back(skin, 0.4), [skin]);
  }

  // ---- the sewn upper mouth ------------------------------------------------------
  const um: V2 = [hd[0] + 6, hd[1] + 5];
  f.capsule(um[0] - 6, um[1] - 1.6, um[0] + 4, um[1] - 1, 2.0, 1.8, LIP, 3.4);
  f.capsule(um[0] - 5.5, um[1] + 1.6, um[0] + 3.5, um[1] + 1.4, 2.2, 1.9, LIP, 3.41);
  f.capsule(um[0] - 6, um[1] + 0.1, um[0] + 4, um[1] + 0.3, 0.5, 0.5, MOUTH, 3.45);
  stitches(f, [um[0] - 6, um[1]], [um[0] + 4, um[1] + 0.3], 5, 3.2, 3.5);
  f.stain((x, y) => Math.hypot(x - um[0], y - um[1]) < 5 && valueNoise(x, y, 1, 3) > 0.62, BLOOD, [LIP]);
  drip(f, um[0] + 3.5, um[1] + 2.5, 4 + p.t * 3, BILE, 3.6, 0.7);
  drip(f, um[0] - 4, um[1] + 3, 2.5, BILE, 3.6, 0.55);

  // ---- tiny weeping eyes, all over -----------------------------------------------
  const eyes: [number, number, number][] = [
    [hd[0] + 4, hd[1] - 2.5, 1.8],
    [hd[0] - 2.5, hd[1] - 4.5, 1.4],
    [hd[0] + 9, hd[1] + 0.5, 1.1],
    [cx - 8, cy - 9, 1.3],
    [cx - 18, cy + 1, 1.0],
  ];
  const SCLERA: Material = { ramp: ['#3a2a20', '#8a7a58', '#c8b88a', '#e8dcb8', '#f8f0d8'], spec: 0.9 };
  const IRIS: Material = { ramp: ['#000000', '#1a1408', '#3a3010'], round: 0.3 };
  eyes.forEach(([ex, ey, r], i) => {
    f.ellipse(ex, ey, r + 1.3, r + 0.9, back(skin, 0.15), 3.55); // puffy lid
    f.ellipse(ex + 0.3, ey, r, r * 0.8, SCLERA, 3.6);
    f.ellipse(ex + 0.3 + r * 0.3, ey + 0.1, r * 0.45, r * 0.55, IRIS, 3.65);
    f.stain((x, y) => Math.abs(Math.hypot(x - ex - 0.3, (y - ey) * 1.2) - r - 0.6) < 0.6, RAW, [skin]);
    // tears: yellowed and bloody
    const tear = i % 2 ? BILE : BLOOD;
    f.stain((x, y) => Math.abs(x - ex - 0.3 - Math.sin(y * 0.5) * 0.3) < 0.55 && y > ey + r && y < ey + r + 5 + i, tear, [skin]);
  });


  // ---- the belly mouth ---------------------------------------------------------------
  const bm: V2 = [cx + rx - 6, cy + 10];
  const op = p.open;
  const bry = 1.8 + op * 7;
  const brx = 6.5 + op * 1.5;
  f.ellipse(bm[0] - 0.5, bm[1], brx + 2.6, bry + 2.6, LIP, 3.8);
  f.ellipse(bm[0], bm[1], brx, bry, MOUTH, 3.85);
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
    f.ellipse(bm[0] - 1, bm[1] + bry * 0.4, brx * 0.7, bry * 0.35, RAW, 3.86); // tongue
    // torn corners of the mouth
    f.stain((x, y) => Math.abs(y - bm[1]) < 0.8 && x > bm[0] - brx - 4 && x < bm[0] - brx + 1, BLOOD, [skin, LIP]);
  }
  // bile drool hanging from the belly mouth
  drip(f, bm[0] + 2, bm[1] + bry + 2.5, 5 + op * 3, BILE, 4, 0.9);
  drip(f, bm[0] - 3, bm[1] + bry + 2.5, 3, BILE, 4, 0.6);
  // ---- the spray --------------------------------------------------------------------
  if (p.spit > 0) {
    const sp = p.spit;
    // a fan of bile jets breaking into droplets
    for (let jt = 0; jt < 3; jt++) {
      const pts: V2[] = [];
      const reach = 18 + sp * 14 - jt * 4;
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        pts.push([bm[0] + 2 + t * reach, bm[1] - 1 + (jt - 1) * t * 6 + t * t * (4 + jt * 3)]);
      }
      tube(f, pts, bry * 0.45 - jt * 0.4, 0.8, BILE, 6 + jt * 0.01);
    }
    for (let k = 0; k < 12; k++) {
      const t = 0.35 + k * 0.06;
      const x = bm[0] + t * (30 + sp * 14) + (k % 3) * 2;
      const y = bm[1] - 7 + t * t * 16 + ((k * 7) % 9) - 3;
      f.ellipse(x, y, 0.8 + (k % 3) * 0.5, 0.7 + (k % 2) * 0.5, BILE, 6.1);
    }
  }

  // ---- front leg -----------------------------------------------------------------
  leg(cx + 8, 0, skin, 5);

  // ---- grime ---------------------------------------------------------------------
  f.stain((x, y) => y > footY - 5 && valueNoise(x, y, 1.5, 3) > 0.4, OLD_BLOOD, [skin, skinB]);
  f.stain((x, y) => valueNoise(x, y, 2, 77) > 0.8 && y > cy + 4, BILE, [skin]);
  // weeping sores
  for (const [sx2, sy2, sr] of [[cx - 12, cy - 12, 2.2], [cx - 2, cy + 8, 1.8], [cx - 20, cy + 12, 1.6], [cx + 6, cy - 14, 1.4]] as const) {
    f.stain(ellMask(sx2, sy2, sr + 0.8, sr + 0.6), RAW, [skin]);
    f.stain(ellMask(sx2, sy2, sr * 0.5, sr * 0.5), BLOOD, [RAW]);
    f.stain((x, y) => Math.abs(x - sx2) < 0.6 && y > sy2 && y < sy2 + 4 + sr * 2, BLOOD, [skin]);
  }
  if (p.hurt) f.stain((x, y) => valueNoise(x, y, 1.6, 40) > 0.74, BLOOD, [skin, skinB]);
  return renderFig(f);
}

function drawDead() {
  const { w, h, footY } = GOSSIP;
  const f = frame(w, h);
  const skin = skinMat(SKIN, 0.55, grain(1.6, 0.08, 12));
  pool(f, 48, footY - 0.5, 40, BILE, 9);
  pool(f, 40, footY, 20, BLOOD, 10, 0.3);
  // limp stubby legs sticking out
  f.capsule(22, footY - 6, 10, footY - 4, 5, 4, back(skin, 0.3), 1);
  f.capsule(64, footY - 5, 76, footY - 3, 5, 4, skin, 4);
  f.ellipse(78, footY - 3, 4.5, 3, skin, 4.1);
  // the deflated sack: a puddled hide with a burst crater
  f.add((x, y) => {
    const dx = (x - 46) / 32;
    const top = footY - 3 - 13 * Math.sqrt(Math.max(0, 1 - dx * dx)) * (0.75 + valueNoise(x, 0, 5, 3) * 0.5);
    return Math.abs(dx) <= 1 && y >= top && y <= footY - 1;
  }, skin, 3, [12, footY - 22, 80, footY]);
  // wrinkles of empty skin
  f.stain((x, y) => Math.abs(((x + Math.sin(y * 0.6) * 2) % 5) - 2.5) < 0.6 && y > footY - 14, back(skin, 0.35), [skin]);
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
  f.stain((x, y) => valueNoise(x, y, 1.8, 5) > 0.6, BILE, [skin]);
  f.stain((x, y) => valueNoise(x, y, 1.8, 6) > 0.75, BLOOD, [skin]);
  f.stain(ellMask(40, footY - 12, 14, 7), BLOOD, [skin]);
  void THREAD;
  return renderFig(f);
}

export function gossipAnims(): AnimDef[] {
  const base: GP = { swell: 0, bob: 0, step: NaN, open: 0, spit: 0, lean: 0, t: 0 };
  return [
    anim('idle', [0, 1].map((i) => drawGossip({ ...base, bob: i, swell: i * 0.15, t: i })), 3),
    anim('walk', [0, 1, 2, 3].map((i) => drawGossip({ ...base, step: (i / 4) * Math.PI * 2, bob: i % 2 ? 1.5 : 0, lean: 0.4, t: (i % 2) * 0.6 })), 7),
    anim('windup', [drawGossip({ ...base, swell: 0.6, bob: -1, open: 0.05, lean: -0.6 }), drawGossip({ ...base, swell: 1, bob: -2, open: 0.15, lean: -1 })], 5, 0),
    anim('attack', [drawGossip({ ...base, swell: 0.3, open: 1, spit: 0.5, lean: 1 }), drawGossip({ ...base, swell: 0.1, open: 0.9, spit: 1, lean: 1.2, t: 1 })], 8, 0),
    anim('stagger', [drawGossip({ ...base, swell: -0.2, bob: 2, open: 0.4, lean: -1.4, hurt: true })], 1, 0),
    anim('dead', [drawDead()], 1, 0),
  ];
}
