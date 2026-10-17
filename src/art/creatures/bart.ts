// BARTHOLOMEW, THE SWOLLEN EAR. A confessor who heard too much and swelled to
// hold it: bloat-fused into his booth, his head become one vast listening ear.
import {
  BLOOD, OLD_BLOOD, IRON, GOLD, MALICE, MOUTH, TEETH, VOID, VEIN, RAW, BONE, BILE, THREAD,
  anim, scaled, back, bez, drip, ellMask, ellT, lineMask, loc, pool, renderFig, skinMat, toLocal, tube, veins, blotch, valueNoise, hash2,
  woodMat, clothMat, frame, grain, ramp, noiseField,
  type AnimDef, type Material, type V2,
} from './common';

/** Design canvases (the drawing code's units) and their scale to output pixels. */
const DB = { w: 240, h: 240, footY: 234 };
const DE = { w: 56, h: 60, footY: 56 };
const SB = 0.6;
const SE = 0.64;
export const BART = scaled(DB, SB);
export const EAR = scaled(DE, SE);

const SKIN = '#b48e7e';
const WOOD = woodMat('#6a2a1a', 8);
const WOOD_D = back(WOOD, 0.35);
const WOOD_L: Material = { ...WOOD, ramp: WOOD.ramp.map((_, i, a) => a[Math.min(a.length - 1, i + 1)]) };
const STOLE: Material = { ramp: ramp(['#0e0610', '#24102e', '#3e1a4c', '#5a2a6a', '#7a4088', '#9a62a4'], 7), tex: grain(1.5, 0.08, 61), round: 0.5 };
const LIP: Material = { ramp: ['#1a0608', '#4a1418', '#7a2a34', '#a24a54', '#c47070', '#dc9890'], spec: 0.6, tex: grain(1, 0.06, 9) };
const EARSKIN = skinMat('#d49a8c', 0.6, grain(1.4, 0.06, 13));
const CONCHA: Material = { ...skinMat('#a87064', 0.6), round: -0.8 };
const WAX: Material = { ramp: ['#1e1206', '#4a300e', '#7a5418', '#a8781e', '#d0a030', '#f0d070'], spec: 0.9, round: 0.6 };
const NV = noiseField(240, 240, 12, 21);
const NB = noiseField(240, 240, 9, 5);
const NS = noiseField(240, 240, 6, 22);
const MALICE_T: Material = { ...MALICE, tex: grain(2, 0.14, 88) };
const BEAD: Material = { ramp: ['#120a08', '#3a2014', '#6a3c22', '#9a6034', '#c88a4e', '#f0c080'], spec: 1, round: 1 };

type Arms = 'rest' | 'up' | 'down';
type MouthState = 'sewn' | 'open' | 'vomit';

interface BP {
  arms: Arms;
  mouth: MouthState;
  ear: boolean;
  twitch: number; // -1..1
  breath: number; // 0..1
  gush?: number; // stump gush phase
  t: number;
}

type F = ReturnType<typeof frame>;

function arm(f: F, sh: V2, el: V2, hd: V2, m: Material, layer: number, rosary = false) {
  f.ellipse(sh[0], sh[1], 17, 15, m, layer);
  f.capsule(sh[0], sh[1], el[0], el[1], 16, 13, m, layer);
  f.ellipse(el[0], el[1], 12.5, 12, m, layer + 0.05);
  f.capsule(el[0], el[1], hd[0], hd[1], 13, 11, m, layer);
  // a swollen fist with fat knuckles
  const ang = Math.atan2(hd[0] - el[0], hd[1] - el[1]);
  f.ellipse(hd[0], hd[1], 14, 13, m, layer + 0.1, -ang);
  for (let k = 0; k < 4; k++) {
    const a = ang + (k - 1.5) * 0.42;
    f.ellipse(hd[0] + Math.sin(a) * 11, hd[1] + Math.cos(a) * 11, 4.2, 4.2, m, layer + 0.12);
  }
  // fat creases at the wrist and elbow
  const wq: V2 = [el[0] + (hd[0] - el[0]) * 0.72, el[1] + (hd[1] - el[1]) * 0.72];
  f.stain((x, y) => Math.abs(Math.hypot(x - wq[0], y - wq[1]) - 11) < 0.9 && Math.hypot(x - wq[0], y - wq[1]) < 12, back(m, 0.45), [m]);
  if (rosary) {
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const r = 11.5;
      f.ellipse(wq[0] + Math.cos(a) * r * 0.5, wq[1] + Math.sin(a) * r, 1.8, 1.8, BEAD, layer + (Math.cos(a) > 0 ? 0.3 : -0.01));
    }
    tube(f, [[wq[0] + 2, wq[1] + 11], [wq[0] + 3, wq[1] + 17], [wq[0] + 2, wq[1] + 21]], 0.5, 0.5, THREAD, layer + 0.3);
    f.capsule(wq[0] + 2, wq[1] + 21, wq[0] + 2, wq[1] + 28, 1, 1, GOLD, layer + 0.31);
    f.capsule(wq[0] - 1, wq[1] + 23.5, wq[0] + 5, wq[1] + 23.5, 0.9, 0.9, GOLD, layer + 0.31);
  }
}

function booth(f: F, broken: boolean) {
  f.poly([[40, 104], [182, 104], [188, 234], [34, 234]], WOOD, 3);
  // posts
  f.capsule(40, 104, 36, 232, 5, 5, WOOD_L, 3.2);
  f.capsule(182, 104, 186, 232, 5, 5, WOOD_D, 3.2);
  // the door torn open: a black interior the flesh pours out of
  f.add((x, y) => x > 76 && x < 172 && y > 114 && y < 224 && (y > 136 || (x - 124) ** 2 / 48 ** 2 + (y - 136) ** 2 / 22 ** 2 < 1), VOID, 3.4, [76, 112, 172, 226]);
  tube(f, [[74, 224], [74, 136], [86, 120], [104, 112], [124, 110], [144, 112], [162, 120], [174, 136], [174, 224]], 2.4, 2.4, GOLD, 3.5);
  // the ripped door hanging off its hinge
  f.poly([[186, 130], [204, 140], [206, 222], [188, 220]], WOOD_L, 3.6);
  f.stain((x, y) => x > 189 && x < 203 && y > 146 && y < 176 && (Math.abs(((x + y + 400) % 5) - 2.5) < 0.8 || Math.abs(((x - y + 400) % 5) - 2.5) < 0.8), WOOD_D, [WOOD_L]);
  // cornice and plinth with gilt mouldings
  f.capsule(32, 104, 190, 104, 4.5, 4.5, WOOD_L, 3.3);
  f.capsule(34, 112, 188, 112, 1.2, 1.2, GOLD, 3.31);
  f.capsule(30, 229, 192, 229, 5, 5, WOOD_D, 3.3);
  f.capsule(32, 222, 190, 222, 1.2, 1.2, GOLD, 3.31);
  for (const x of [40, 182]) f.ellipse(x, 96, 3, 4, GOLD, 3.35);
  // carved side panels
  const x0 = 46;
  const x1 = 70;
  f.stain((x, y) => {
    if (x < x0 || x > x1 || y < 122 || y > 214) return false;
    const cx = (x0 + x1) / 2;
    if (!(x > x0 + 3 && x < x1 - 3 && y > 125 && y < 211)) return true;
    return Math.abs(Math.hypot(x - cx, y - 134) - 6) < 0.8;
  }, WOOD_D, [WOOD]);
  f.stain((x, y) => (Math.abs(x - (x0 + x1) / 2) < 1.4 && y > 146 && y < 200) || (Math.abs(y - 160) < 1.4 && Math.abs(x - (x0 + x1) / 2) < 7), WOOD_L, [WOOD]);
  // the roof, burst apart by the swelling within
  if (broken) {
    f.poly([[38, 106], [92, 106], [80, 86], [60, 70]], WOOD_D, 2.5);
    f.capsule(38, 106, 60, 70, 2, 2, WOOD_L, 2.6);
    f.capsule(62, 72, 52, 52, 1.5, 1.5, GOLD, 2.7);
    f.capsule(50, 60, 62, 63, 1.4, 1.4, GOLD, 2.7);
    f.poly([[140, 106], [184, 106], [164, 76], [150, 86]], WOOD_D, 2.5);
    f.capsule(184, 106, 164, 76, 2, 2, WOOD_L, 2.6);
    for (let k = 0; k < 4; k++) f.poly([[80 + k * 3, 86 + k], [84 + k * 3, 88], [82 + k * 2, 74 + k * 2]], WOOD_L, 2.55);
  }
  // shingles
  f.stain((x, y) => y < 104 && ((y + 300) % 4 < 1 || Math.abs(((x + (Math.floor(y / 4) % 2) * 3 + 300) % 6) - 3) < 0.5), back(WOOD, 0.55), [WOOD_D]);
  // blood weeping from the seams of the booth
  f.stain((x, y) => y > 112 && (Math.abs(x - 56 - Math.sin(y * 0.2)) < 0.8 || Math.abs(x - 166 + Math.sin(y * 0.15)) < 0.9) && valueNoise(x, y, 6, 3) > 0.35, BLOOD, [WOOD, WOOD_L, WOOD_D]);
  f.stain((x, y) => y > 196 + valueNoise(x, 0, 5, 7) * 20, OLD_BLOOD, [WOOD, WOOD_L, WOOD_D]);
}

function body(f: F, p: BP, skin: Material) {
  const b = p.breath;
  // neck/shoulder mass bulging out of the top of the booth
  ellT(f, 112, 116 - b, 56, 28, skin, 4);
  f.ellipse(112, 92 - b, 26, 22, skin, 4.05);
  // flesh oozing over the cornice
  for (const [x, r] of [[60, 9], [76, 7], [150, 8], [166, 10]] as const) f.ellipse(x, 110, r, r * 0.8, skin, 4.06);
  // the belly, out through the door
  f.ellipse(124, 172 - b, 45 + b * 2, 46 + b, skin, 5);
  ellT(f, 124, 210, 44 + b, 18, skin, 5.05);
  ellT(f, 86, 196, 14, 18, skin, 5.02);
  // the stole draped over the gut
  const left = bez([92, 92 - b], [80, 150], [90, 212], 8);
  const right = bez([134, 92 - b], [166, 140], [158, 206], 8);
  tube(f, left, 7.5, 6.5, STOLE, 5.6);
  tube(f, right, 7.5, 6.5, back(STOLE, 0.1), 5.6);
  for (const line of [left, right]) {
    // gold borders, embroidered crosses, fringe
    const end = line[line.length - 1];
    f.stain((x, y) => {
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const c = line[i];
        const dx = c[0] - a[0];
        const dy = c[1] - a[1];
        const L2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
        const d = Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
        if (d > 5.6 && d < 7.6) return true;
      }
      return false;
    }, GOLD, [STOLE, back(STOLE, 0.1)]);
    for (const k of [3, 6]) {
      const [cx, cy] = line[k];
      f.stain((x, y) => (Math.abs(x - cx) < 1 && Math.abs(y - cy) < 4.5) || (Math.abs(y - cy + 1.5) < 1 && Math.abs(x - cx) < 3), GOLD, [STOLE, back(STOLE, 0.1)]);
    }
    for (let k = 0; k < 6; k++) f.capsule(end[0] - 6 + k * 2.4, end[1] + 5, end[0] - 6 + k * 2.4 + 0.5, end[1] + 11 + (k % 2) * 2, 0.6, 0.6, GOLD, 5.7);
  }
  // surface: stretch marks, veins, bruising, sores, pins through the flesh
  f.stain((x, y) => NB(x, y) > 0.68, back(skin, 0.16), [skin]);
  f.stain((x, y) => Math.abs(NV(x, y) - 0.5) < 0.012, VEIN, [skin]);
  f.stain((x, y) => y > 140 && Math.abs(((x * 0.4 + y * 0.9 + 600) % 11) - 5.5) < 0.6 && NS(x, y) > 0.55, back(skin, 0.38), [skin]);
  for (const [x, y] of [[84, 150], [100, 200], [150, 132], [176, 196]] as const) {
    f.stain(ellMask(x, y, 3.4, 2.6), RAW, [skin]);
    f.stain((xx, yy) => Math.abs(xx - x) < 0.8 && yy > y && yy < y + 10, BLOOD, [skin]);
  }
  for (const [x, y] of [[62, 118], [168, 122], [74, 110], [152, 108]] as const) {
    f.ellipse(x, y, 1.8, 1.8, IRON, 6);
    f.stain((xx, yy) => Math.abs(xx - x) < 0.7 && yy > y && yy < y + 8, BLOOD, [skin, WOOD]);
  }
}

function belly(f: F, p: BP, skin: Material) {
  const c: V2 = [136, 172 - p.breath];
  if (p.mouth === 'sewn') {
    f.capsule(c[0] - 18, c[1] - 2.5, c[0] + 18, c[1] - 1.5, 4.5, 4, LIP, 6);
    f.capsule(c[0] - 17, c[1] + 4, c[0] + 17, c[1] + 3.5, 5, 4.4, LIP, 6.01);
    f.capsule(c[0] - 18, c[1] + 0.8, c[0] + 18, c[1] + 1, 0.8, 0.8, MOUTH, 6.05);
    // laced shut with a rosary: beads zig-zag across the lips
    const n = 9;
    for (let k = 0; k <= n * 2; k++) {
      const x = c[0] - 17 + (k / (n * 2)) * 34;
      const y = c[1] + (k % 2 ? 6 : -4.5);
      f.ellipse(x, y, 1.9, 1.9, BEAD, 6.2);
      f.stain(ellMask(x, y + 1.5, 1.4, 2.6), BLOOD, [LIP, skin]);
    }
    f.add(lineMask(Array.from({ length: n * 2 + 1 }, (_, k) => [c[0] - 17 + (k / (n * 2)) * 34, c[1] + (k % 2 ? 6 : -4.5)] as V2), 0.5), THREAD, 6.15);
    // the crucifix hanging from the last stitch
    tube(f, [[c[0] + 17, c[1] + 6], [c[0] + 18, c[1] + 12], [c[0] + 17, c[1] + 16]], 0.5, 0.5, THREAD, 6.2);
    f.capsule(c[0] + 17, c[1] + 16, c[0] + 17, c[1] + 26, 1.4, 1.4, GOLD, 6.3);
    f.capsule(c[0] + 13.5, c[1] + 19, c[0] + 20.5, c[1] + 19, 1.2, 1.2, GOLD, 6.3);
    drip(f, c[0] - 6, c[1] + 9, 7, MALICE, 6.4, 1);
    drip(f, c[0] + 6, c[1] + 9, 4, BLOOD, 6.4, 0.9);
    return;
  }
  const vomit = p.mouth === 'vomit';
  const rx = vomit ? 25 : 21;
  const ry = vomit ? 21 : 16;
  f.ellipse(c[0], c[1], rx + 5, ry + 5, LIP, 6);
  // torn corners
  f.capsule(c[0] - rx - 4, c[1], c[0] - rx - 12, c[1] - 3, 2, 0.8, RAW, 6.02);
  f.capsule(c[0] + rx + 3, c[1] + 2, c[0] + rx + 9, c[1] + 6, 2, 0.8, RAW, 6.02);
  f.ellipse(c[0], c[1], rx, ry, MOUTH, 6.05);
  f.ellipse(c[0] + 2, c[1] + 4, rx * 0.4, ry * 0.4, VOID, 6.06);
  // rows of yellowed teeth, pushed in all directions
  for (let k = 0; k < 13; k++) {
    const a = Math.PI + (k / 12) * Math.PI;
    const x = c[0] + Math.cos(a) * rx * 0.92;
    const y = c[1] + Math.sin(a) * ry * 0.92;
    const L = 4 + (k % 3) * 1.5;
    f.capsule(x, y, x - Math.cos(a) * L * 0.5, y - Math.sin(a) * L, 1.5, 0.5, TEETH, 6.1);
    const xb = c[0] + Math.cos(a) * rx * 0.9;
    const yb = c[1] - Math.sin(a) * ry * 0.9;
    f.capsule(xb, yb, xb - Math.cos(a) * L * 0.4, yb + Math.sin(a) * L * 0.9, 1.4, 0.5, TEETH, 6.1);
  }
  // tongue
  if (!vomit) f.ellipse(c[0] + 4, c[1] + ry * 0.55, rx * 0.55, ry * 0.32, RAW, 6.08);
  // snapped rosary dangling from the corners
  for (const [sx, sy, len, sw] of [[c[0] - rx - 2, c[1] - 4, 9, -1], [c[0] + rx + 1, c[1] - 2, 12, 1], [c[0] - 6, c[1] + ry + 4, 7, 0.5]] as const) {
    for (let k = 0; k < len; k++) {
      const t = k / len;
      f.ellipse(sx + Math.sin(t * 3 + p.t * 6) * 2 * sw, sy + k * 3.4, 1.8, 1.8, BEAD, 6.4);
    }
    if (len > 10) {
      f.capsule(sx + 1, sy + len * 3.4, sx + 1, sy + len * 3.4 + 10, 1.4, 1.4, GOLD, 6.45);
      f.capsule(sx - 2.5, sy + len * 3.4 + 3, sx + 4.5, sy + len * 3.4 + 3, 1.2, 1.2, GOLD, 6.45);
    }
  }
  drip(f, c[0] - 8, c[1] + ry + 4, 9, MALICE, 6.5, 1.3);
  drip(f, c[0] + 10, c[1] + ry + 3, 6, BLOOD, 6.5, 1);
  if (vomit) {
    // a torrent of malice arcing to the floor
    const s = bez([c[0] + 6, c[1] + 2], [c[0] + 70, c[1] - 10], [c[0] + 96, 232], 10);
    tube(f, s, ry * 0.7, 9, MALICE_T, 9);
    const s2 = bez([c[0] + 4, c[1] + 6], [c[0] + 48, c[1] + 4], [c[0] + 70, 232], 8);
    tube(f, s2, ry * 0.45, 5, back(MALICE_T, 0.1), 8.9);
    for (let k = 0; k < 18; k++) {
      const x = c[0] + 40 + hash2(k, 1, 4) * 64;
      const y = c[1] - 20 + hash2(k, 2, 4) * 70;
      f.ellipse(x, y, 1.2 + hash2(k, 3, 4) * 2.4, 1 + hash2(k, 5, 4) * 2, MALICE, 9.1);
    }
    pool(f, 210, 233, 32, MALICE, 4, 8.8);
    for (let k = 0; k < 6; k++) f.ellipse(186 + k * 9, 226 - (k % 3) * 4, 3, 4, MALICE, 9.2);
    f.stain((x, y) => valueNoise(x, y, 3, 9) > 0.7, BILE, [MALICE, MALICE_T]);
  }
}

/** The ear, drawn in a frame rotated around its root. */
function ear(f: F, root: V2, rot: number, s: number, layer: number, bleed = 0.5) {
  const E = (u: number, v: number): V2 => loc(root, rot, u * s, v * s);
  const L = layer;
  // base shape and lobe
  f.add((x, y) => {
    const [u, v] = toLocal(root, rot, x, y);
    const uu = u / s;
    const vv = v / s;
    const cy = 38;
    const ry = vv > cy ? 30 : 34;
    return ((uu - 1) / 23) ** 2 + ((vv - cy) / ry) ** 2 <= 1;
  }, EARSKIN, L, [root[0] - 30 * s, root[1] - 80 * s, root[0] + 30 * s, root[1] + 6 * s]);
  f.ellipse(...E(-5, 10), 11 * s, 11 * s, EARSKIN, L + 0.01);
  // concha bowl: a deep concave hollow
  f.ellipse(...E(5, 32), 12 * s, 15 * s, CONCHA, L + 0.1, rot);
  // canal: black, crusted with wax
  f.ellipse(...E(10, 30), 4.5 * s, 6 * s, VOID, L + 0.2, rot);
  f.ellipse(...E(8, 26), 2.2 * s, 1.6 * s, WAX, L + 0.25);
  f.ellipse(...E(12, 35), 2.4 * s, 2 * s, WAX, L + 0.25);
  drip(f, ...E(9, 23), 7 * s, WAX, L + 0.26, 1.1 * s);
  // tragus and antitragus
  f.ellipse(...E(19, 30), 4.2 * s, 6 * s, EARSKIN, L + 0.3, rot);
  f.ellipse(...E(2, 16), 5 * s, 3.5 * s, EARSKIN, L + 0.3, rot);
  // antihelix: a raised Y-shaped ridge
  tube(f, [E(-6, 16), E(-10, 30), E(-9, 46), E(-2, 56)], 3.6 * s, 3 * s, EARSKIN, L + 0.35);
  tube(f, [E(-2, 56), E(10, 62)], 3 * s, 2.4 * s, EARSKIN, L + 0.35);
  tube(f, [E(-6, 50), E(-14, 60)], 2.6 * s, 2 * s, EARSKIN, L + 0.35);
  // helix: the thick curled rim along the top and back
  tube(f, [E(18, 56), E(12, 68), E(-2, 72), E(-16, 64), E(-22, 46), E(-21, 26), E(-15, 14)], 5 * s, 5.5 * s, EARSKIN, L + 0.5);
  tube(f, [E(-15, 14), E(-12, 5)], 5.5 * s, 4 * s, EARSKIN, L + 0.5);
  // scapha groove between helix and antihelix
  f.stain((x, y) => {
    const [u, v] = toLocal(root, rot, x, y);
    const uu = u / s;
    const vv = v / s;
    return vv > 20 && vv < 64 && Math.abs(uu - (-15 + (vv - 42) ** 2 * 0.004)) < 2.2;
  }, back(EARSKIN, 0.4), [EARSKIN]);
  // veins, flush, hair from the canal
  f.stain(veins(9 * s, 0.018, 31), VEIN, [EARSKIN]);
  f.stain(blotch(6 * s, 0.7, 33), back(EARSKIN, 0.15), [EARSKIN]);
  for (let k = 0; k < 5; k++) tube(f, [E(10, 30), E(13 + k, 34 + k * 2), E(17 + k * 1.5, 36 + k * 3)], 0.5, 0.35, THREAD, L + 0.4);
  // bleeding from the canal, and from the torn piercings of the lobe
  if (bleed > 0) {
    f.stain((x, y) => {
      const [u, v] = toLocal(root, rot, x, y);
      return Math.abs(u / s - 9 - Math.sin(v * 0.4) * 0.6) < 1.2 && v / s < 26 && v / s > 6;
    }, BLOOD, [EARSKIN, CONCHA]);
    f.ellipse(...E(-6, 6), 1.6 * s, 1.6 * s, GOLD, L + 0.6);
    f.stain((x, y) => {
      const [u, v] = toLocal(root, rot, x, y);
      return Math.abs(u / s + 6) < 1 && v / s < 6;
    }, BLOOD, [EARSKIN]);
  }
}

function stump(f: F, p: BP, skin: Material) {
  const g = p.gush ?? 0;
  f.ellipse(112, 74, 20, 10, RAW, 4.2);
  f.ellipse(112, 72, 13, 6, back(RAW, 0.2), 4.25);
  // cartilage and torn skin flaps
  for (let k = 0; k < 6; k++) {
    const x = 94 + k * 7;
    f.poly([[x, 76], [x + 5, 76], [x + 2 + (k % 2) * 3, 64 - (k % 3) * 3]], skin, 4.3);
  }
  f.ellipse(106, 70, 2.5, 3.5, BONE, 4.4);
  f.ellipse(120, 69, 2, 3, BONE, 4.4);
  // the fountain
  const h = 42 + g * 14;
  const arcs: [number, number][] = [[-1, 1], [1, 1.2], [-0.4, 0.8], [0.6, 0.7]];
  arcs.forEach(([dir, k], i) => {
    const top: V2 = [112 + dir * 10, 70 - h * k];
    const end: V2 = [112 + dir * (40 + g * 10 + i * 6), 90 + i * 12];
    tube(f, bez([112 + dir * 3, 70], top, end, 10), 4 - i * 0.6, 1.2, BLOOD, 7 + i * 0.01);
  });
  for (let k = 0; k < 16; k++) {
    const a = hash2(k, 1, (g * 10) | 0) * Math.PI;
    const r = 26 + hash2(k, 2, 3) * 40;
    f.ellipse(112 - Math.cos(a) * r, 64 - Math.sin(a) * r * 0.9 + g * 6, 1.4 + hash2(k, 3, 1) * 1.6, 1.6 + hash2(k, 4, 1) * 2, BLOOD, 7.1);
  }
  // sheets of blood down the neck and chest
  f.stain((x, y) => y > 74 && y < 74 + 40 + valueNoise(x, 0, 3, 2) * 50 && Math.abs(x - 112) < 34, BLOOD, [skin, STOLE]);
}

function drawBart(p: BP) {
  const { w, h } = DB;
  const f = frame(w, h, SB);
  const skin = skinMat(SKIN, 0.4);
  const skinB = back(skin, 0.3);
  // ---- arms: shoulder, elbow, fist for each state --------------------------
  const ARMS: Record<Arms, { f: [V2, V2, V2]; b: [V2, V2, V2] }> = {
    rest: { f: [[156, 112], [196, 150], [204, 214]], b: [[70, 112], [34, 152], [30, 214]] },
    up: { f: [[156, 108], [188, 70], [184, 22]], b: [[70, 108], [42, 70], [50, 24]] },
    down: { f: [[156, 116], [204, 150], [216, 216]], b: [[70, 116], [40, 160], [30, 218]] },
  };
  const A = ARMS[p.arms];
  arm(f, A.b[0], A.b[1], A.b[2], skinB, 1);
  booth(f, true);
  body(f, p, skin);
  belly(f, p, skin);
  if (p.ear) ear(f, [110, 84], p.twitch * 0.07, 1, 4.1);
  else stump(f, p, skin);
  arm(f, A.f[0], A.f[1], A.f[2], skin, 7, true);
  if (p.arms === 'down') {
    // impact: blood and splinters thrown up from the floor
    for (let k = 0; k < 10; k++) {
      const a = Math.PI + 0.2 + (k / 9) * (Math.PI - 0.4);
      const r = 18 + (k % 3) * 6;
      f.ellipse(216 + Math.cos(a) * r, 226 + Math.sin(a) * r * 0.6, 2 + (k % 2), 1.6, k % 3 ? BLOOD : back(BONE, 0.2), 7.5);
    }
    pool(f, 210, 233, 30, BLOOD, 6, 0.5);
  }
  f.stain((x, y) => y > 220 && valueNoise(x, y, 2, 4) > 0.45, BLOOD, [skin, skinB]);
  // grime and bruising, blood running from every crease
  f.stain((x, y) => NB(x + 40, y) > 0.66, back(skin, 0.14), [skin, skinB]);
  f.stain((x, y) => NS(x, y + 30) > 0.78, OLD_BLOOD, [skin, skinB, STOLE]);
  f.stain((x, y) => Math.abs(((x * 0.13 + 300) % 9) - 4.5) < 0.5 && NS(x, 0) > 0.55 && y > 140 + NB(x, 0) * 60, BLOOD, [skin]);
  return renderFig(f);
}

function drawDead() {
  const { w, h, footY } = DB;
  const f = frame(w, h, SB);
  const skin = skinMat(SKIN, 0.4);
  const skinB = back(skin, 0.3);
  pool(f, 120, footY - 1, 110, BLOOD, 3);
  pool(f, 150, footY, 50, MALICE, 4, 0.2);
  // the booth split in two, halves fallen apart
  f.poly([[18, 234], [64, 234], [90, 120], [56, 108]], WOOD, 2);
  f.capsule(56, 108, 18, 232, 4.5, 4.5, WOOD_L, 2.1);
  f.capsule(90, 120, 64, 232, 3, 3, WOOD_D, 2.1);
  f.poly([[168, 234], [222, 234], [194, 110], [160, 124]], WOOD_D, 2);
  f.capsule(194, 110, 222, 232, 4.5, 4.5, WOOD, 2.1);
  for (let k = 0; k < 6; k++) f.poly([[86 + k * 1.5, 120 + k * 8], [92 - k, 124 + k * 8], [96 + k * 2, 116 + k * 9]], WOOD_L, 2.2);
  f.stain((x, y) => (Math.abs(((x * 0.3 + y + 300) % 22) - 11) < 2) && !(y > 200), WOOD_D, [WOOD]);
  f.capsule(48, 170, 76, 168, 1.2, 1.2, GOLD, 2.3);
  // the cross, fallen
  f.capsule(26, 232, 50, 224, 1.6, 1.6, GOLD, 2.4);
  f.capsule(34, 222, 38, 234, 1.4, 1.4, GOLD, 2.4);
  // the deflated bulk sagging between
  f.add((x, y) => {
    const dx = (x - 124) / 74;
    const top = footY - 6 - 42 * Math.sqrt(Math.max(0, 1 - dx * dx)) * (0.8 + valueNoise(x, 0, 12, 3) * 0.4);
    return Math.abs(dx) <= 1 && y >= top && y <= footY - 2;
  }, skin, 4, [48, footY - 60, 200, footY]);
  f.stain((x, y) => Math.abs(((x + Math.sin(y * 0.3) * 4 + 300) % 10) - 5) < 0.9 && y > footY - 40, back(skin, 0.4), [skin]);
  f.stain(veins(12, 0.012, 21), VEIN, [skin]);
  // the stole, slack
  tube(f, [[96, footY - 40], [104, footY - 20], [96, footY - 4]], 6.5, 6.5, STOLE, 4.5);
  tube(f, [[144, footY - 42], [150, footY - 22], [164, footY - 6]], 6.5, 6.5, STOLE, 4.5);
  // the ruined mouth, gaping slack, beads scattered
  f.ellipse(132, footY - 22, 16, 8, LIP, 5);
  f.ellipse(132, footY - 22, 12, 5, MOUTH, 5.1);
  for (let k = 0; k < 9; k++) f.capsule(122 + k * 2.6, footY - 26, 122 + k * 2.6, footY - 22.5, 1, 0.4, TEETH, 5.2);
  for (let k = 0; k < 14; k++) f.ellipse(100 + hash2(k, 1, 2) * 100, footY - 2 - hash2(k, 2, 2) * 4, 1.8, 1.8, BEAD, 5.3);
  drip(f, 128, footY - 18, 6, MALICE, 5.3, 1.4);
  // the ear-stump, flopped forward
  f.ellipse(112, footY - 46, 14, 7, RAW, 4.6);
  f.ellipse(112, footY - 47, 8, 3.5, back(RAW, 0.3), 4.7);
  // arms limp on the floor
  f.capsule(66, footY - 30, 36, footY - 12, 15, 12, skinB, 3);
  f.ellipse(24, footY - 11, 13, 10, skinB, 3.1);
  f.capsule(178, footY - 32, 200, footY - 12, 15, 12, skin, 6);
  f.ellipse(214, footY - 11, 13, 10, skin, 6.1);
  for (let k = 0; k < 10; k++) f.ellipse(200 + Math.cos(k * 0.63) * 6, footY - 26 + Math.sin(k * 0.63) * 11, 1.8, 1.8, BEAD, 6.2);
  f.stain((x, y) => valueNoise(x, y, 4, 17) > 0.72, BLOOD, [skin, skinB]);
  f.stain((x, y) => valueNoise(x, y, 5, 19) > 0.8, MALICE, [skin]);
  return renderFig(f);
}

// ---------------------------------------------------------------------------
// The torn-off ear: a separate enemy that keeps listening.
// ---------------------------------------------------------------------------
function drawEar(i: number, dead: boolean) {
  const { w, h, footY } = DE;
  const f = frame(w, h, SE);
  if (dead) {
    pool(f, 28, footY - 0.5, 24, BLOOD, 3);
    ear(f, [8, footY - 6], Math.PI / 2 - 0.15, 0.62, 2, 1);
    f.ellipse(9, footY - 6, 4, 5, RAW, 3);
    f.stain((x, y) => valueNoise(x, y, 1.6, 5) > 0.66, OLD_BLOOD, [EARSKIN]);
    return renderFig(f);
  }
  const s = 0.62 + i * 0.03;
  const root: V2 = [26, footY - 4];
  pool(f, 26, footY - 0.5, 14 + i * 3, BLOOD, 7);
  ear(f, root, (i ? -0.06 : 0.05), s, 2, 1);
  // the torn root: meat, cartilage, a pumping vessel
  f.ellipse(root[0], root[1], 9, 4.5, RAW, 3);
  f.ellipse(root[0] - 3, root[1] - 1, 2, 2.5, BONE, 3.1);
  const gh = 8 + i * 6;
  tube(f, bez([root[0] + 2, root[1] - 2], [root[0] + 10, root[1] - gh - 6], [root[0] + 18, footY - 2], 7), 2.2, 0.9, BLOOD, 4);
  tube(f, bez([root[0] - 3, root[1] - 2], [root[0] - 9, root[1] - gh], [root[0] - 15, footY - 1], 6), 1.6, 0.8, BLOOD, 4);
  for (let k = 0; k < 4; k++) f.ellipse(root[0] - 8 + k * 6, root[1] - 10 - gh - (k % 2) * 3, 0.9, 1.2, BLOOD, 4.1);
  f.stain((x, y) => y > root[1] - 14 && valueNoise(x, y, 1.6, 9) > 0.55, BLOOD, [EARSKIN]);
  return renderFig(f);
}

export function earAnims(): AnimDef[] {
  return [anim('idle', [drawEar(0, false), drawEar(1, false)], 5), anim('dead', [drawEar(0, true)], 1, 0)];
}

export function bartAnims(): AnimDef[] {
  const P = (o: Partial<BP>): BP => ({ arms: 'rest', mouth: 'sewn', ear: true, twitch: 0, breath: 0, t: 0, ...o });
  return [
    anim('idle', [drawBart(P({ twitch: -1 })), drawBart(P({ twitch: 1, breath: 2, t: 0.5 }))], 3),
    anim('windup', [drawBart(P({ arms: 'up', twitch: 0.5, breath: 3 }))], 1, 0),
    anim('slam', [drawBart(P({ arms: 'down', twitch: -1.5 }))], 1, 0),
    anim('idle2', [drawBart(P({ mouth: 'open', twitch: -1 })), drawBart(P({ mouth: 'open', twitch: 1, breath: 2, t: 0.5 }))], 4),
    anim('windup2', [drawBart(P({ mouth: 'open', arms: 'up', breath: 3, twitch: 1 }))], 1, 0),
    anim('slam2', [drawBart(P({ mouth: 'open', arms: 'down', twitch: -1.5 }))], 1, 0),
    anim('vomit', [drawBart(P({ mouth: 'vomit', twitch: 2, breath: 1 }))], 1, 0),
    anim('earless', [drawBart(P({ mouth: 'open', ear: false, gush: 0, t: 0.2 })), drawBart(P({ mouth: 'open', ear: false, gush: 1, breath: 2, t: 0.7 }))], 6),
    anim('dead', [drawDead()], 1, 0),
  ];
}

void clothMat;
