// The three who still speak: Mother Magdalene, Deacon Vivisect, Brother Hollow.
import {
  BLOOD, OLD_BLOOD, IRON, RUST, GOLD, BONE, VOID, RAW, NAIL, GLASS, TEAR, THREAD, TEETH,
  anim, back, bez, clothMat, drip, ridge, loc, pool, renderFig, skinMat, stitches, tube, vn, hash2, woodMat, frame, ramp, grain,
  type AnimDef, type Material, type V2,
} from './common';

export const NPC_SIZES = {
  magdalene: { w: 128, h: 112, footY: 106 },
  vivisect: { w: 80, h: 96, footY: 90 },
  hollow: { w: 80, h: 96, footY: 90 },
};

type F = ReturnType<typeof frame>;
const HAIR: Material = { ramp: ['#060304', '#140b0c', '#24161a', '#382428', '#4e3438'], tex: (x) => Math.sin(x * 2.4) * 0.12, round: 0.4 };
const VEIL: Material = { ramp: ramp(['#08040a', '#160c1a', '#24162a', '#3a2a3a', '#544458', '#6e5e70'], 7), tex: (x, y) => Math.sin(y * 0.9 + Math.sin(x * 0.3) * 2) * 0.08 + (vn(x, y, 2, 4) - 0.5) * 0.1, round: 0.6 };

// ---------------------------------------------------------------------------
// Mother Magdalene, the Weaver
// ---------------------------------------------------------------------------
function drawMagdalene(i: number) {
  const { w, h, footY } = NPC_SIZES.magdalene;
  const f = frame(w, h);
  const ph = (i / 4) * Math.PI * 2;
  const wood = woodMat('#4a2416', 3);
  const woodD = back(wood, 0.3);
  const skin = skinMat('#c8bcb0', 0.4);
  const skinB = back(skin, 0.32);
  const robe = clothMat('#3a2a3a', i / 4, 5);

  // ---- the loom ------------------------------------------------------------
  f.capsule(72, 12, 72, footY, 2.6, 3, woodD, 0.5);
  f.capsule(122, 12, 122, footY, 2.6, 3, wood, 0.6);
  f.capsule(66, 14, 126, 14, 3, 3, wood, 0.7);
  f.capsule(70, 84, 124, 84, 3.2, 3.2, wood, 2.5);
  f.capsule(118, footY - 2, 126, footY - 2, 3, 3, woodD, 0.6);
  f.capsule(68, footY - 2, 78, footY - 2, 3, 3, woodD, 0.6);
  f.ellipse(72, 10, 2.6, 2.6, GOLD, 0.8);
  f.ellipse(122, 10, 2.6, 2.6, GOLD, 0.8);
  // warp of long dark hair, pulled by the hands
  for (let k = 0; k < 13; k++) {
    const x = 76 + k * 3.6;
    const pull = Math.sin(ph + k * 0.7) * 1.2;
    tube(f, [[x, 16], [x + pull, 44], [x, 70]], 0.55, 0.55, HAIR, 1);
  }
  // the woven cloth: hair, braided tight, with a pale pattern of finger-bones
  f.poly([[74, 66], [120, 66], [121, 82], [73, 82]], { ...HAIR, tex: (x, y) => ((x + y) % 4 < 2 ? 0.1 : -0.08) + ((x * 3 + y) % 7 === 0 ? 0.25 : 0) }, 1.2);
  for (let k = 0; k < 5; k++) f.capsule(80 + k * 9, 70, 82 + k * 9, 77, 0.6, 0.6, BONE, 1.3);
  // scalps knotted to the top beam, still wet
  for (const x of [84, 98, 112]) {
    f.ellipse(x, 18, 3.5, 2.4, RAW, 1.4);
    f.ellipse(x, 17, 3, 1.6, HAIR, 1.45);
    drip(f, x + 1, 20, 4 + (x % 3), BLOOD, 1.5, 0.5);
  }
  // hair spilling down from the loom to the floor
  for (let k = 0; k < 5; k++) tube(f, [[118 + k, 16], [124 + k * 0.6, 50], [120 + k * 1.5, footY - 1]], 0.7, 0.9, HAIR, 0.55);

  // ---- far arms (three) ---------------------------------------------------------
  const sh: V2[] = [[50, 42], [49, 50], [48, 58]];
  const reach: V2[] = [
    [84 + Math.sin(ph) * 5, 28 + Math.cos(ph) * 4],
    [90 + Math.sin(ph + 2.1) * 5, 46 + Math.cos(ph + 2.1) * 3],
    [86 + Math.sin(ph + 4.2) * 4, 62 + Math.cos(ph + 4.2) * 2],
  ];
  const armTo = (s: V2, hd: V2, m: Material, layer: number, k: number) => {
    const mid: V2 = [(s[0] + hd[0]) / 2 - 2, (s[1] + hd[1]) / 2 + 6 - k * 2];
    f.capsule(s[0], s[1], mid[0], mid[1], 2.4, 1.7, m, layer);
    f.ellipse(mid[0], mid[1], 1.9, 1.9, m, layer + 0.02); // knobbed elbow
    f.capsule(mid[0], mid[1], hd[0], hd[1], 1.8, 1.2, m, layer);
    ridge(f, [[mid[0] + 1, mid[1] - 1], [hd[0] - 1, hd[1] - 1]], 0.7, 1.0, [m]); // a tendon drawn taut
    ridge(f, [[s[0] + 1, s[1]], [mid[0], mid[1] - 1.5]], 0.8, -0.9, [m]);
    f.ellipse(hd[0], hd[1], 2, 2.2, m, layer + 0.05);
    for (let q = 0; q < 3; q++) f.capsule(hd[0], hd[1], hd[0] + 4, hd[1] - 2 + q * 1.8, 0.6, 0.4, m, layer + 0.06);
    f.ellipse(hd[0] + 4.3, hd[1] - 2, 0.6, 0.6, NAIL, layer + 0.07);
    // a thread drawn from the warp, cutting the fingers
    f.capsule(hd[0] + 3, hd[1], hd[0] + 9, hd[1] - 6 + k * 3, 0.35, 0.35, HAIR, layer + 0.08);
    f.stain((x, y) => Math.hypot(x - hd[0] - 1, y - hd[1]) < 3 && hash2(x | 0, y | 0, k) < 0.5, BLOOD, [m]);
  };
  const reachB: V2[] = [
    [100 + Math.sin(ph + 3.1) * 5, 20 + Math.cos(ph + 3.1) * 3],
    [106 + Math.sin(ph + 5.2) * 4, 38 + Math.cos(ph + 5.2) * 3],
    [100 + Math.sin(ph + 1.0) * 5, 56 + Math.cos(ph + 1.0) * 3],
  ];
  sh.forEach((s, k) => armTo([s[0] - 2, s[1] - 2], reachB[k], skinB, 1.8, k));

  // ---- body: a vast robe fused into the loom's footing ----------------------------
  const hem: V2[] = [];
  for (let k = 0; k <= 10; k++) hem.push([10 + k * 8, footY - (k % 2) * 1.5 + Math.sin(ph + k) * 0.6]);
  f.poly([[44, 36], [56, 38], [62, 60], [66, 80], ...hem.slice().reverse(), [14, 92], [30, 64], [38, 44]], robe, 3);
  // the robe's hem unravels into the warp
  for (let k = 0; k < 6; k++) tube(f, [[60 + k * 2, footY - 4 - k], [68 + k * 2, footY - 12 - k * 2], [76 + k * 4, 82]], 0.6, 0.5, HAIR, 3.1);
  // gold-thread hem and cincture
  f.capsule(12, footY - 2, 86, footY - 2, 0.9, 0.9, GOLD, 3.2);
  f.capsule(40, 62, 62, 60, 1.2, 1.2, GOLD, 3.2);
  // ---- veiled head ---------------------------------------------------------------------
  f.ellipse(52, 30, 7, 8, skin, 4);
  f.poly([[44, 22], [52, 18], [60, 22], [61, 34], [58, 40], [62, 46], [30, 74], [36, 44]], VEIL, 4.5);
  f.ellipse(52, 26, 8.5, 8.5, VEIL, 4.4);
  // chin and sewn lips just below the veil's edge
  f.ellipse(57.5, 38.5, 3, 2.2, skin, 4.6);
  stitches(f, [56, 38.5], [60, 38.5], 3, 1.2, 4.7);
  f.stain((x, y) => Math.abs(x - 58.5) < 0.5 && y > 39 && y < 46, BLOOD, [skin, VEIL]);
  // a crown of needles
  for (let k = 0; k < 7; k++) {
    const a = -2.6 + k * 0.38;
    f.capsule(52 + Math.cos(a) * 8, 26 + Math.sin(a) * 8, 52 + Math.cos(a) * 13, 26 + Math.sin(a) * 13, 0.45, 0.3, IRON, 4.8);
  }
  f.capsule(44, 21, 60, 21, 0.8, 0.8, GOLD, 4.75);
  // ---- near arms (three), sewn on at the shoulder ------------------------------------
  sh.forEach((s, k) => armTo(s, reach[k], skin, 6, k));
  stitches(f, [48, 40], [50, 62], 6, 2, 6.3);
  // a bone shuttle in the middle hand
  f.capsule(reach[1][0] + 1, reach[1][1] + 2, reach[1][0] + 7, reach[1][1] - 1, 1.2, 0.8, BONE, 6.4);
  f.stain((x, y) => vn(x, y, 2, 31) > 0.74, OLD_BLOOD, [robe]);
  void pool;
  return renderFig(f);
}

// ---------------------------------------------------------------------------
// Deacon Vivisect
// ---------------------------------------------------------------------------
function barbs(f: F, pts: V2[], layer: number) {
  f.add((x, y) => {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < 0.55) return true;
    }
    return false;
  }, IRON, layer);
  for (let i = 1; i < pts.length; i += 2) {
    const [x, y] = pts[i];
    f.capsule(x - 1.2, y - 1.2, x + 1.2, y + 1.2, 0.35, 0.35, IRON, layer + 0.01);
    f.capsule(x - 1.2, y + 1.2, x + 1.2, y - 1.2, 0.35, 0.35, IRON, layer + 0.01);
  }
}

function drawVivisect(i: number) {
  const { w, h, footY } = NPC_SIZES.vivisect;
  const f = frame(w, h);
  const skin = skinMat('#b8a89a', 0.35);
  const skinB = back(skin, 0.32);
  const smock = clothMat('#c4bca6', i * 0.25, 7);
  const smockB = back(smock, 0.3);
  const trousers = clothMat('#3a3236', 0, 3);
  // breathing: a slow sub-pixel rise and fall over four frames
  const b = (1 - Math.cos((i / 4) * Math.PI * 2)) / 2;
  // legs
  f.capsule(34, 58, 31, 74, 4, 3.5, back(trousers, 0.3), 1);
  f.capsule(31, 74, 30, footY - 2, 3.4, 3, back(trousers, 0.3), 1);
  f.capsule(29, footY - 2, 36, footY - 1, 2.4, 2, back(IRON, 0.3), 1.1);
  f.capsule(40, 58, 42, 74, 4.2, 3.6, trousers, 4);
  f.capsule(42, 74, 42, footY - 2, 3.5, 3, trousers, 4);
  f.capsule(41, footY - 2, 49, footY - 1, 2.6, 2.2, IRON, 4.1);
  // far arm
  tube(f, [[33, 26 + b * 0.5], [28, 42], [30, 54]], 3, 2.4, smockB, 1.5);
  f.ellipse(30, 56, 2.4, 2.8, skinB, 1.6);
  // torso in a long butcher's smock
  f.poly([[30, 22 + b * 0.5], [46, 22 + b * 0.5], [50, 40], [52, 76], [48, 78], [40, 80], [32, 77], [26, 76], [27, 44]], smock, 3);
  // apron straps
  f.capsule(32, 23, 38, 50, 0.9, 0.9, back(smock, 0.45), 3.1);
  // barbed wire wound around the body
  const wire: V2[] = [];
  for (let k = 0; k <= 22; k++) {
    const t = k / 22;
    const y = 26 + t * 44;
    const side = Math.sin(t * Math.PI * 7);
    wire.push([39 + side * 12, y + side * 2]);
  }
  barbs(f, wire.filter((p, k) => Math.cos((k / 22) * Math.PI * 7) > -0.2), 3.5);
  // head: bald, stitched, caged in a wire mask
  const hb = b * 0.5;
  f.capsule(40, 24 + hb, 42, 18 + hb, 2.6, 2.4, skin, 5);
  f.ellipse(43, 12 + hb, 6.2, 7, skin, 5.5);
  f.ellipse(47.5, 16 + hb, 3, 2.6, skin, 5.55);
  f.stain((x, y) => Math.abs(x - 41 + (y - 8) * 0.3) < 0.5 && y > 5 + hb && y < 12 + hb, RAW, [skin]);
  stitches(f, [41.5, 5 + hb], [39.5, 12 + hb], 3, 1.1, 5.6);
  // the cage
  f.add((x, y) => {
    const dx = (x - 46) / 5.2;
    const dy = (y - 13 - hb) / 7;
    if (dx * dx + dy * dy > 1 || x < 41.5) return false;
    return Math.abs(((x + y + 100) % 3) - 1.5) < 0.6 || Math.abs(((x - y + 100) % 3) - 1.5) < 0.6;
  }, IRON, 5.8, [38, 4, 52, 22]);
  f.ellipse(46.5, 11 + hb, 0.9, 0.7, { ramp: ['#ff6040', '#ffd0a0'], round: 0 }, 5.9);
  f.stain((x, y) => x > 44 && y > 14 + hb && y < 24 + hb && hash2(x | 0, y | 0, 7) < 0.45, BLOOD, [skin]);
  // near arm, holding the bone saw low and forward
  tube(f, [[43, 26 + b * 0.5], [46, 42], [54, 50]], 3.2, 2.6, smock, 6);
  barbs(f, [[42, 30], [47, 34], [44, 38], [48, 42], [47, 46], [52, 48]], 6.2);
  f.ellipse(55, 51, 2.6, 2.6, skin, 6.3);
  // the saw: bone handle, long toothed blade, dripping
  f.capsule(54, 48, 57, 55, 1.6, 1.4, BONE, 6.4);
  f.poly([[56, 52], [60, 50], [74, 70], [70, 73]], IRON, 6.5);
  for (let k = 0; k < 8; k++) {
    const t = k / 7;
    const x = 58 + t * 12;
    const y = 54 + t * 18;
    f.poly([[x, y], [x - 1.6, y + 0.8], [x - 0.4, y + 2]], IRON, 6.55);
  }
  f.stain((x, y) => y > 58 && vn(x, y, 1.6, 3) > 0.45, BLOOD, [IRON]);
  drip(f, 71, 73, 2 + ((i * 1.5) % 4), BLOOD, 6.6, 0.6);
  drip(f, 66, 68, 2 + (((i + 2) * 1.3) % 3), BLOOD, 6.6, 0.5);
  pool(f, 66, footY - 0.5, 8, BLOOD, 3, 0.2);
  // the smock: the record of every patient
  f.stain((x, y) => y > 62 + vn(x, 0, 3, 5) * 10, OLD_BLOOD, [smock, smockB]);
  f.stain((x, y) => vn(x, y, 2.5, 12) > 0.74, OLD_BLOOD, [smock, smockB]);
  f.stain((x, y) => vn(x, y, 1.8, 13) > 0.8, BLOOD, [smock, smockB]);
  f.stain((x, y) => Math.abs(((x * 1.2 + 200) % 7) - 3.5) < 0.5 && y > 46 && y < 66 + vn(x, 1, 2, 3) * 10 && vn(x, 0, 2, 3) > 0.5, BLOOD, [smock]);
  f.stain((x, y) => vn(x, y, 1.5, 21) > 0.7, RUST, [IRON]);
  return renderFig(f);
}

// ---------------------------------------------------------------------------
// Brother Hollow
// ---------------------------------------------------------------------------
function drawHollow(i: number) {
  const { w, h, footY } = NPC_SIZES.hollow;
  const f = frame(w, h);
  const robe = clothMat('#4a3a2c', i * 0.25, 9);
  const robeB = back(robe, 0.3);
  const wood = woodMat('#5a3a22', 7);
  const s = (1 - Math.cos((i / 4) * Math.PI * 2)) / 2;
  // the crook: a tall staff with a shepherd's hook
  f.capsule(56, 20, 58, footY - 1, 1.6, 1.8, wood, 1);
  tube(f, bez([56, 20], [56, 6], [64, 8], 5), 1.6, 1.4, wood, 1);
  tube(f, bez([64, 8], [70, 10], [66, 18], 4), 1.4, 1.1, wood, 1);
  // vials of tears on strings
  const vials: [number, number, number][] = [[66, 18, 7], [60, 24, 11], [53, 30, 6], [60, 36, 9]];
  vials.forEach(([x, y, len], k) => {
    const sw = Math.sin((i / 4) * Math.PI * 2 + k * 1.3) * 1.3;
    const bx = x + sw;
    const by = y + len;
    f.capsule(x, y, bx, by, 0.3, 0.3, THREAD, 1.1);
    f.capsule(bx, by + 1, bx, by + 6, 1.6, 1.8, GLASS, 1.2);
    f.ellipse(bx, by + 5.5, 1.3, 1.4, TEAR, 1.3);
    f.ellipse(bx, by + 0.6, 1.0, 0.7, back(wood, 0.2), 1.25);
  });
  // body: a hooded robe leaning onto the staff
  const hem: V2[] = [];
  for (let k = 0; k <= 8; k++) hem.push([50 - k * 4, footY - (k % 2) * 3 - hash2(k, 1, 3) * 2]);
  f.poly([[34, 22 + s], [44, 20 + s], [50, 32], [52, 60], ...hem, [20, 70], [26, 40]], robeB, 2);
  f.poly([[36, 26 + s], [48, 28 + s], [50, 60], [52, footY - 2], [36, footY - 1], [34, 60]], robe, 3);
  // the open chest: a cage of ribs over nothing
  f.ellipse(43, 40 + s, 5.5, 9, VOID, 3.5);
  for (let k = 0; k < 5; k++) {
    const y = 34 + k * 3 + s;
    tube(f, [[39, y - 1], [44, y], [48, y + 1.5]], 0.8, 0.6, BONE, 3.6);
  }
  f.capsule(39, 32 + s, 40, 50 + s, 1, 1, BONE, 3.65);
  f.ellipse(44, 46 + s, 1.6, 2, RAW, 3.55);
  // hood and skull
  f.ellipse(42, 15 + s, 9, 10, robe, 4);
  f.ellipse(45, 16 + s, 5.5, 6.5, VOID, 4.2);
  f.ellipse(46, 15.5 + s, 4.4, 5.2, BONE, 4.3);
  f.ellipse(48.5, 19 + s, 2.2, 1.8, BONE, 4.35);
  f.ellipse(47.5, 14 + s, 1.3, 1.5, VOID, 4.4);
  f.ellipse(47.6, 14.2 + s, 0.45, 0.45, TEAR, 4.45);
  for (let k = 0; k < 4; k++) f.capsule(46.6 + k * 0.9, 19.4 + s, 46.6 + k * 0.9, 20.9 + s, 0.38, 0.3, TEETH, 4.45);
  f.stain((x, y) => Math.abs(x - 47.6) < 0.45 && y > 15.5 + s && y < 21 + s, TEAR, [BONE]);
  f.poly([[34, 10 + s], [44, 4 + s], [52, 10 + s], [50, 8 + s], [42, 7 + s]], robe, 4.5);
  // skeletal hand on the staff
  tube(f, [[44, 26 + s], [50, 34], [55, 30]], 2.6, 2.2, robe, 5);
  for (let k = 0; k < 4; k++) f.capsule(55, 28 + k * 1.4, 58.5, 28.5 + k * 1.4, 0.55, 0.45, BONE, 5.2);
  f.ellipse(55, 29.5, 1.8, 2.2, BONE, 5.1);
  // rope belt with a reliquary
  f.capsule(34, 56, 51, 56, 1.1, 1.1, clothMat('#7a5a38', 0, 2), 3.7);
  f.ellipse(50, 61, 1.6, 2.2, GOLD, 3.8);
  f.stain((x, y) => y > footY - 10 + vn(x, 0, 2, 4) * 5, OLD_BLOOD, [robe, robeB]);
  f.stain((x, y) => vn(x, y, 2.5, 8) > 0.75, back(robe, 0.3), [robe]);
  void RUST;
  return renderFig(f);
}

export function npcAnims() {
  return {
    magdalene: [anim('idle', [0, 1, 2, 3].map(drawMagdalene), 5)] as AnimDef[],
    vivisect: [anim('idle', [0, 1, 2, 3].map(drawVivisect), 4)] as AnimDef[],
    hollow: [anim('idle', [0, 1, 2, 3].map(drawHollow), 4)] as AnimDef[],
  };
}

void loc; void grain;
