import { hash2 } from '../pixel';
import { fbm, hex, inRound, pnoise, smooth } from './paint';
import { EMPTY, Relief, ramp } from './relief';
import { M, ashlar, balustrade, hit } from './nave';
import { BONE_R, H, type Layers, type Look, type TLayer, W, X, blob, buildPair, cageLantern, fleshMats, halfField, matTable, mist, rubble, vous, wrapX } from './crypt';

/**
 * The bridge into Sanctum, the sinless city, at sunset: an exterior. A sky of
 * layered rose and gold clouds over a hazy skyline of gilded domes and
 * spires; nearer, an aqueduct and bell towers in silhouette; and along the
 * bridge itself a stone balustrade with saints on plinths and wrought-iron
 * lamp posts, kept low in the frame behind the walkway.
 *
 * In rot the sky bleeds, the sun opens into an eye hung on sinews, and the
 * saints and the balustrade sprout flesh.
 */

const SX = 404; // the sun
const SY = 206;

const dxw = (x: number, cx: number) => {
  let d = x - cx;
  if (d > W / 2) d -= W;
  else if (d < -W / 2) d += W;
  return d;
};

const SANCTUM: Look = {
  mats: matTable({
    [M.WALL]: { ramp: ramp(['#0e080c', '#22141c', '#382028', '#523034', '#6e4440', '#8e5c4e', '#b07c62'], 10) },
    [M.TRIM]: { ramp: ramp(['#120a0e', '#2a1a20', '#44292e', '#623e3c', '#86584c', '#ab7a62', '#d0a282'], 10), spec: 0.12 },
    [M.DEEP]: { ramp: ramp(['#050204', '#0e0609', '#180b0e', '#221114'], 6) },
    [M.SHAFT]: { ramp: ramp(['#120c12', '#281c26', '#402e38', '#5c4448', '#7e5e5a', '#a27e70', '#c8a48c', '#e8ccac'], 11), spec: 0.25 },
    [M.GLASS]: { ramp: ramp(['#5a1c06', '#b4500e', '#f09a28', '#ffd468', '#fff8d8'], 7), emit: true },
    [M.IRON]: { ramp: ramp(['#060405', '#140d10', '#24181c', '#3a282a', '#563c38'], 6), spec: 0.45 },
    [M.GOLD]: { ramp: ramp(['#1e1206', '#5a3c12', '#9a7024', '#d4a440', '#fff1a8'], 7), spec: 0.6 },
    [M.BONE]: { ramp: BONE_R, spec: 0.3 },
    [M.WOOD]: { ramp: ramp(['#0a0608', '#1c1014', '#2e1c1e', '#442a28', '#5e3c34'], 7) },
    [X.SKY]: {
      ramp: ramp(['#2a1426', '#47202e', '#6a2c36', '#8e3c3c', '#b25444', '#cc6e4c', '#e08c58', '#eeac6c', '#f6ca88', '#fde6b0', '#fff6dc'], 16),
      emit: true,
    },
    [X.CITY]: { ramp: ramp(['#3a2030', '#54303c', '#704046', '#8e5650', '#ae6e5c', '#cc8a6a', '#e6aa80'], 9), spec: 0.1 },
    [X.CITYGOLD]: { ramp: ramp(['#4a2a1a', '#7a4a20', '#b07a30', '#e0aa50', '#ffe090', '#fff8d0'], 8), spec: 0.8 },
    [X.MOSS]: { ramp: ramp(['#0a0806', '#1c180e', '#302a16', '#48401e', '#625a2c'], 6) },
    ...fleshMats(),
  }),
  lamp: hex('#ffb060'),
  candle: hex('#ffb060'),
  cold: hex('#ffd8a0'),
  amb: hex('#b08898'),
  key: hex('#ffc890'),
  keyDir: [0.45, -0.6, 0.4],
  fog: hex('#3a2230'),
  haze: hex('#d48a68'),
  mist: hex('#e0a080'),
  web: hex('#ffffff'),
};

const SANCTUM_ROT: Look = {
  mats: matTable({
    [M.WALL]: { ramp: ramp(['#080203', '#1a0708', '#2c0e0e', '#421614', '#5a221a', '#763424', '#964a32'], 10) },
    [M.TRIM]: { ramp: ramp(['#0a0303', '#200a0a', '#381412', '#56221c', '#7a3828', '#a0543a', '#c47a56'], 10), spec: 0.2 },
    [M.DEEP]: { ramp: ramp(['#030101', '#0c0304', '#160506', '#220909'], 6) },
    [M.SHAFT]: { ramp: ramp(['#0c0304', '#220a0c', '#3a1414', '#58221e', '#7c362a', '#a2523c', '#c87a5a', '#eab092'], 11), spec: 0.4 },
    [M.GLASS]: { ramp: ramp(['#3a0206', '#80060e', '#c81a1c', '#ff5a36', '#ffc0a0'], 7), emit: true },
    [M.IRON]: { ramp: ramp(['#060202', '#180909', '#2a1210', '#441e18', '#602e22'], 6), spec: 0.45 },
    [M.GOLD]: { ramp: BONE_R, spec: 0.3 },
    [M.BONE]: { ramp: BONE_R, spec: 0.35 },
    [M.WOOD]: { ramp: ramp(['#080202', '#1a0808', '#2c100e', '#421a16', '#5a2a20'], 7) },
    [X.SKY]: {
      ramp: ramp(['#0e0206', '#22060c', '#3a0a12', '#560e16', '#76141a', '#98201c', '#b8321e', '#d24e26', '#e87634', '#f6a456', '#ffd494'], 16),
      emit: true,
    },
    [X.CITY]: { ramp: ramp(['#1a0608', '#2e0c0e', '#461414', '#601e1a', '#7e2c22', '#9e402c', '#c05c3a'], 9), spec: 0.2 },
    [X.CITYGOLD]: { ramp: BONE_R, spec: 0.6 },
    [X.MOSS]: { ramp: ramp(['#0a0203', '#200608', '#3a0c10', '#58181a', '#7a2a26'], 6), spec: 0.5 },
    ...fleshMats(),
  }),
  lamp: hex('#ff5a3a'),
  candle: hex('#ff5a3a'),
  cold: hex('#ff8060'),
  amb: hex('#a06070'),
  key: hex('#ff9070'),
  keyDir: [0.45, -0.6, 0.4],
  fog: hex('#2a080c'),
  haze: hex('#a83020'),
  mist: hex('#b04030'),
  web: hex('#ffffff'),
};

const noSky = (m: number) => (m === X.SKY ? -9 : 0);

// ============================================================================
// FAR: sunset sky, layered clouds, the hazy gilded skyline of Sanctum
// ============================================================================

/** Cloud noise fields (half-res, shared by the sky and its reflection). */
function skyFields() {
  // stratus: noise stretched horizontally
  const n = halfField((x, y) => fbm(x, y * 3.4, 130, 11, W, 4));
  // higher, darker cloud masses towards the top; low wisps near the horizon
  const hi = halfField((x, y) => (y < 160 ? fbm(x + 37, y * 2.2, 90, 23, W, 3) : 0));
  const wisp = halfField((x, y) => (y > 150 && y < 310 ? pnoise(x, y * 6, 60, 31, W) : 0));
  return { n, hi, wisp };
}

/** Sky brightness (0..1 along the sky ramp) at x, y. */
function skyAt(F: ReturnType<typeof skyFields>, x: number, y: number): number {
  x = wrapX(Math.round(x));
  y = Math.max(0, Math.min(H - 5, Math.round(y)));
  const i = y * W + x;
  const dx = dxw(x + 0.5, SX);
  const dy = y + 0.5 - SY;
  const dd = Math.sqrt(dx * dx + dy * dy * 2.2);
  const sun = Math.exp(-((dd / 150) ** 2)) * 0.28 + Math.exp(-((dd / 46) ** 2)) * 0.22;
  const base = 0.12 + 0.62 * Math.pow(smooth(-30, 290, y), 1.1);
  const near = Math.exp(-((dd / 200) ** 2));
  const band = 0.35 + 0.65 * smooth(250, 120, y);
  const D = smooth(0.44, 0.64, F.n[i]) * band;
  const D1 = smooth(0.44, 0.64, F.n[i + 4 * W]) * band; // a few px lower: lit undersides
  const rim = Math.max(0, D - D1);
  const top = smooth(0.5, 0.7, F.hi[i]) * smooth(150, 10, y);
  const wisp = smooth(0.62, 0.72, F.wisp[i]) * smooth(160, 240, y) * smooth(300, 250, y);
  return base + sun - D * (0.3 - near * 0.12) + rim * (0.25 + near * 0.6) - top * 0.16 + wisp * 0.12;
}

function dome(R: Relief, cx: number, base: number, r: number, drum: number, z: number, gold: boolean) {
  const top = base - drum - r;
  R.box(cx - r - 3, top - r * 0.9, cx + r + 3, base, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    const ly = y + 0.5;
    if (ly > base - drum) {
      // drum with pilasters and dark windows
      if (ax > r * 0.92) return;
      const nx = dx / (r * 0.92);
      const u = ((nx + 1) * 5) % 1;
      const win = u > 0.35 && u < 0.65 && ly > base - drum * 0.8 && ly < base - drum * 0.3;
      R.put(i, z + Math.sqrt(Math.max(0, 1 - nx * nx)) * r * 0.6, win ? M.DEEP : X.CITY, ly < base - drum + 1.5 ? 0.12 : 0);
      return;
    }
    // ribbed dome
    const dy = (ly - (base - drum)) / (r * 1.1);
    const dd = (dx / r) ** 2 + dy * dy;
    if (dd <= 1) {
      const nx = dx / (r * Math.sqrt(Math.max(0.01, 1 - dy * dy)));
      const rib = Math.abs(((nx + 1) * 4) % 1 - 0.5) < 0.09;
      R.put(i, z + Math.sqrt(1 - dd) * r, gold ? X.CITYGOLD : X.CITY, rib ? 0.1 : 0);
      return;
    }
    // lantern + spire
    const lt = base - drum - r * 1.1;
    if (ly > lt - r * 0.35 && ax < Math.max(1.2, r * 0.13)) {
      R.put(i, z + r * 0.9, X.CITY, 0);
      return;
    }
    if (ly > lt - r * 0.45 && ly <= lt - r * 0.35 && ax < r * 0.17) {
      R.put(i, z + r * 0.9, gold ? X.CITYGOLD : X.CITY, 0.1);
      return;
    }
    if (ly <= lt - r * 0.45 && ly > lt - r * 0.8 && ax < 0.8) R.put(i, z + r * 0.9, X.CITYGOLD, 0.1);
  });
}

function spireTower(R: Relief, cx: number, base: number, w: number, hgt: number, spire: number, z: number, cap: 'spire' | 'dome' = 'spire') {
  const top = base - hgt;
  R.box(cx - w - 2, top - spire, cx + w + 2, base, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    const ly = y + 0.5;
    if (ly >= top) {
      const k = (ly - top) / hgt;
      const stage = k < 0.25 ? 0.72 : k < 0.6 ? 0.86 : 1;
      const half = w * stage;
      if (ax > half) return;
      const ledge = Math.abs(k - 0.25) < 0.02 || Math.abs(k - 0.6) < 0.015;
      const win = k < 0.22 && k > 0.06 && Math.abs(Math.abs(dx) - half * 0.45) < Math.max(0.6, half * 0.18);
      R.put(i, z + (ledge ? 1.5 : 0.6) + Math.sqrt(Math.max(0, 1 - (dx / half) ** 2)) * 1.5, win ? M.DEEP : X.CITY, ledge ? 0.1 : 0);
      return;
    }
    const k = (top - ly) / spire;
    if (cap === 'spire') {
      const half = w * 0.72 * (1 - k);
      if (ax > half + 0.3) return;
      R.put(i, z + 1 + (1 - k) * 2 - ax * 0.4, X.CITY, ax < 0.6 ? 0.08 : 0);
      if (k > 0.92 && ax < 0.6) R.put(i, z + 2, X.CITYGOLD, 0.2);
    } else {
      const r = w * 0.72;
      const dd = (dx / r) ** 2 + ((top - ly) / (r * 1.2)) ** 2;
      if (dd <= 1) R.put(i, z + Math.sqrt(1 - dd) * r, X.CITYGOLD, 0);
      else if (ax < 0.7 && top - ly < r * 2) R.put(i, z + 1, X.CITYGOLD, 0.1);
    }
  });
}

function bridgeFar(): TLayer {
  const R = new Relief(W, H);
  const HZ = 304;
  const F = skyFields();
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    R.put(i, -100, X.SKY, 0);
    if (y < HZ) R.emi[i] = skyAt(F, x, y);
    else {
      // the river: a dimmed, rippled reflection of the sky
      const ry = HZ - (y - HZ) * 1.6;
      const rip = pnoise(x, y * 5, 14, 41, W);
      R.emi[i] = skyAt(F, x + (rip - 0.5) * 8, ry) * 0.72 + (rip - 0.5) * 0.06;
    }
  });
  // low rooftops of the lower city
  R.box(0, 262, W - 1, HZ - 1, (x, y, i) => {
    const u = wrapX(x);
    const bi = Math.floor(u / 10);
    const roof = 284 - Math.floor(hash2(bi, 0, 51) * 14) + (hash2(bi, 1, 51) > 0.7 ? -Math.max(0, 4 - Math.abs((u % 10) - 5)) : 0);
    if (y < roof) return;
    const win = (u % 5) === 2 && y > roof + 3 && (y - roof) % 6 === 2 && hash2(u, y, 7) > 0.8;
    R.put(i, -4 + (y === roof ? 0.6 : 0), win ? M.GLASS : X.CITY, -0.05);
    if (win) R.emi[i] = 0.6;
  });
  // mid-rise blocks: palaces and churches with pitched roofs and lit windows
  R.box(0, 236, W - 1, 290, (x, y, i) => {
    const u = wrapX(x);
    const bi = Math.floor(u / 20);
    const bu = u % 20;
    if (hash2(bi, 2, 53) < 0.25) return;
    const top = 262 - Math.floor(hash2(bi, 3, 53) * 22);
    const pitch = hash2(bi, 4, 53) > 0.5 ? Math.max(0, 7 - Math.abs(bu - 9.5)) : 0;
    if (y < top - pitch || bu > 18) return;
    const win = bu % 4 === 2 && (y - top) % 7 === 3 && hash2(u, y, 9) > 0.7;
    R.put(i, -6 + (y < top ? 0.8 : 0), win ? M.GLASS : X.CITY, y === top ? 0.1 : -0.04);
    if (win) R.emi[i] = 0.5;
  });
  // the skyline: domes and towers
  spireTower(R, 96, 282, 7, 64, 34, 0);
  spireTower(R, 206, 282, 7, 60, 30, 0);
  dome(R, 150, 282, 38, 22, 0, true);
  spireTower(R, 262, 290, 4, 34, 18, 0, 'dome');
  dome(R, 306, 288, 16, 12, 0, false);
  spireTower(R, 356, 290, 8, 92, 44, 0);
  spireTower(R, 418, 286, 5, 52, 18, 0, 'dome');
  spireTower(R, 494, 286, 5, 48, 18, 0, 'dome');
  dome(R, 456, 286, 28, 16, 0, true);
  dome(R, 562, 290, 14, 12, 0, false);
  spireTower(R, 612, 290, 6, 70, 36, 0);
  spireTower(R, 30, 292, 5, 40, 14, 0, 'dome');
  spireTower(R, 530, 292, 3, 30, 16, 0);
  return {
    R,
    lights: (t) => [{ x: SX, y: SY, z: -60, r: 260, c: t.key, k: 0.5 }],
    glows: () => [
      { x: SX, y: SY, r: 70, c: [255, 236, 190], k: 0.35, pow: 2.5 },
      { x: SX, y: SY, r: 200, c: [255, 190, 130], k: 0.12 },
    ],
    opts: (t) => ({
      amb: 0.42,
      keyK: 0.4,
      key: [0.0, -0.5, -0.6],
      ao: 0.03,
    }),
    post: (pc, t) => {
      // aerial haze over the city only (the sky is left untouched)
      const d = pc.data;
      for (let y = 120; y < H; y++) {
        const f = 0.42 + 0.22 * smooth(230, 300, y);
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const m = R.mat[i];
          if (m === X.SKY || m === M.GLASS) continue;
          const p = i * 4;
          d[p] += (t.haze[0] - d[p]) * f;
          d[p + 1] += (t.haze[1] - d[p + 1]) * f;
          d[p + 2] += (t.haze[2] - d[p + 2]) * f;
        }
      }
    },
    rot: {
      seed: 311,
      bias: (x, y, m) => -0.32 + 0.14 * smooth(260, 300, y) + noSky(m),
      eyes: [[SX, SY, 17]],
      sinews: (
        [
          [-2.2, 70, 10],
          [-1.7, 96, -14],
          [-1.25, 60, 8],
          [-0.8, 84, 12],
          [-0.35, 110, -16],
          [-2.75, 104, 18],
          [0.25, 76, 10],
          [2.9, 70, -10],
        ] as [number, number, number][]
      ).flatMap(([a, len, sag]) => {
        const x0 = SX + Math.cos(a) * 15;
        const y0 = SY + Math.sin(a) * 15;
        const x1 = SX + Math.cos(a) * len;
        const y1 = SY + Math.sin(a) * len;
        const x2 = x1 + Math.cos(a + sag / 30) * len * 0.45;
        const y2 = y1 + Math.sin(a + sag / 30) * len * 0.45;
        return [
          [x0, y0, x1, y1, sag, 1.5],
          [x1, y1, x2, y2, -sag * 0.6, 0.9],
        ] as [number, number, number, number, number, number][];
      }),
      z: -60,
    },
  };
}

// ============================================================================
// MID: an aqueduct of round arches, a domed bell tower, a ruined tower and a
// gilded chapel dome, all in haze
// ============================================================================

const AQ_TOP = 226;
const AQ_P = 64;
const AQ_YS = 262;
const AQ_R = 22;
const AQ_X0 = 436;
const AQ_LEN = 300;

function belltower(R: Relief, cx: number, top: number, z: number) {
  const hw = 18;
  R.box(cx - hw - 6, top - 60, cx + hw + 6, H - 1, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    if (y >= top) {
      const ledge = y === top || y === top + 1 || y === top + 52 || y === top + 53 || y === top + 120 || y === top + 121;
      const half = ledge ? hw + 3 : hw;
      if (ax > half) return;
      // belfry: two arched openings onto the sky
      if (y > top + 8 && y < top + 48 && (inRound(ax, y, 3, 14, top + 18) ? true : false)) {
        if (inRound(ax, y, 4.5, 12.5, top + 18)) return;
        R.put(i, z + 1, M.TRIM, 0.05);
        return;
      }
      if (y > top + 66 && y < top + 92 && inRound(ax, y, 0, 5, top + 70)) {
        R.put(i, z - 2, M.DEEP, 0);
        return;
      }
      const hh = ashlar(x, y, 16, 8, 61);
      R.put(i, z + 2 + hh * 0.8 - (ax > half - 1 ? 0.8 : 0) + (ledge ? 1.5 : 0), ledge ? M.TRIM : M.WALL, hit.t);
      return;
    }
    // octagonal drum + onion-ish dome + lantern + cross
    const ly = top - y;
    if (ly < 12) {
      if (ax > hw - 4) return;
      const u = Math.abs(((dx + 30) % 6) - 3);
      R.put(i, z + 3 + Math.sqrt(Math.max(0, 1 - (dx / (hw - 4)) ** 2)) * 4, u < 1 ? M.TRIM : M.WALL, u < 1 ? 0.08 : 0);
      return;
    }
    const dyy = (ly - 12) / 24;
    const half = (hw - 3) * Math.sqrt(Math.max(0, 1 - dyy * dyy)) * (1 + 0.15 * Math.sin(dyy * Math.PI));
    if (dyy <= 1 && ax <= half) {
      const nx = dx / Math.max(1, half);
      R.put(i, z + 3 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 9, M.GOLD, Math.abs(((nx + 1) * 3) % 1 - 0.5) < 0.1 ? -0.12 : 0);
      return;
    }
    if (ly >= 36 && ly < 46 && ax < 3) {
      R.put(i, z + 4, M.TRIM, 0);
      return;
    }
    if (ly >= 46 && ly < 58 && (ax < 0.8 || (ly > 51 && ly < 54 && ax < 3.2))) R.put(i, z + 4, M.GOLD, 0.15);
  });
}

function bridgeMid(): TLayer {
  const R = new Relief(W, H);
  // aqueduct
  R.box(0, AQ_TOP - 40, W - 1, H - 1, (x, y, i) => {
    const xx = wrapX(x);
    const a = (xx - AQ_X0 + W) % W;
    if (a >= AQ_LEN) return;
    // the aqueduct is broken off at both ends
    const end = Math.min(a, AQ_LEN - 1 - a);
    if (end < 30) {
      const brk = AQ_TOP - 6 + (30 - end) * 2.2 + Math.abs(Math.sin(xx * 0.9)) * 5 + (hash2(xx >> 1, 0, 9) - 0.5) * 6;
      if (y < brk) return;
    }
    const u = xx % AQ_P;
    if (y < AQ_TOP) {
      // a low parapet with a coping
      if (y < AQ_TOP - 6) return;
      R.put(i, 2 + (y === AQ_TOP - 6 ? 0.5 : 0) - (y === AQ_TOP - 4 ? 0.8 : 0), M.TRIM, y === AQ_TOP - 6 ? 0.1 : 0);
      return;
    }
    if (y < AQ_TOP + 5) {
      R.put(i, 3 - (y === AQ_TOP + 4 ? 1 : 0), M.TRIM, y === AQ_TOP ? 0.12 : 0);
      return;
    }
    const res = vous(u, y, AQ_P / 2, AQ_YS, AQ_R, 5, 11, 2);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 2) return;
    const hh = ashlar(x, y, 16, 8, 63);
    const imp = y >= AQ_YS - 3 && y < AQ_YS;
    R.put(i, imp ? 3 : 1 + hh * 0.7, imp ? M.TRIM : M.WALL, imp ? 0.1 : hit.t);
  });
  // gilded chapel dome rising behind the aqueduct
  R.box(220, 150, 300, AQ_TOP - 6, (x, y, i) => {
    const cx = 260;
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    if (y > 196) {
      if (ax > 26) return;
      const u = ((dx + 26) % 9) / 9;
      const win = u > 0.35 && u < 0.65 && y > 201 && y < 214;
      R.put(i, -3 + Math.sqrt(1 - (dx / 26) ** 2) * 6, win ? M.DEEP : M.WALL, y === 197 ? 0.12 : 0);
      return;
    }
    const dy = (196 - y) / 30;
    const dd = (dx / 24) ** 2 + dy * dy;
    if (dd <= 1) {
      const nx = dx / (24 * Math.sqrt(Math.max(0.01, 1 - dy * dy)));
      R.put(i, -3 + Math.sqrt(1 - dd) * 20, M.GOLD, Math.abs(((nx + 1) * 4) % 1 - 0.5) < 0.08 ? -0.15 : 0);
      return;
    }
    if (y > 158 && ax < 2.5) R.put(i, 14, M.TRIM, 0);
    else if (y <= 158 && ax < 0.8) R.put(i, 14, M.GOLD, 0.1);
  });
  R.box(222, 218, 298, H - 1, (x, y, i) => {
    // the chapel: cornice, pilasters and tall arched windows
    const dx = x + 0.5 - 260;
    const ax = Math.abs(dx);
    if (y < 224) {
      if (ax > 37) return;
      R.put(i, 2 - (y === 223 ? 1 : 0), M.TRIM, y === 218 ? 0.12 : 0);
      return;
    }
    if (ax > 34) return;
    const pil = Math.abs(((dx + 34) % 17) - 8.5) > 6.5;
    const wcx = Math.round((dx + 34 - 8.5) / 17) * 17 - 34 + 8.5;
    const win = !pil && inRound(dx, y, wcx - 3.5, wcx + 3.5, 244) && y < 280;
    R.put(i, win ? -4 : pil ? 2 : 0.5 + ashlar(x, y, 16, 8, 67) * 0.4, win ? M.DEEP : pil ? M.TRIM : M.WALL, pil ? 0.04 : hit.t);
  });
  belltower(R, 96, 92, 6);
  // ruined tower, its top broken off and a dead tree on it
  R.box(400, 100, 452, H - 1, (x, y, i) => {
    const cx = 426;
    const ax = Math.abs(x + 0.5 - cx);
    const brk = 120 + Math.abs(Math.sin(x * 0.7)) * 8 + (x - 400) * 0.5 + (hash2(x >> 2, 0, 3) - 0.5) * 8;
    if (ax > 20 || y < brk) return;
    const slit = ax < 1.5 && ((y > 150 && y < 166) || (y > 200 && y < 214));
    const hh = ashlar(x, y, 16, 8, 65);
    R.put(i, slit ? 0 : 3 + hh * 0.8 - (ax > 19 ? 0.8 : 0), slit ? M.DEEP : M.WALL, hit.t);
  });
  for (const [ax, ay, bx, by, r] of [
    [410, 124, 404, 92, 1.4],
    [406, 104, 390, 84, 0.9],
    [405, 100, 420, 78, 0.9],
    [397, 90, 392, 76, 0.6],
    [416, 84, 426, 74, 0.6],
  ] as [number, number, number, number, number][])
    R.tube(ax, ay, bx, by, r, 6, M.WOOD, 0, true);
  return {
    R,
    lights: (t) => [{ x: SX, y: SY - 20, z: -40, r: 260, c: t.key, k: 0.45 }],
    glows: () => [],
    opts: (t) => ({
      amb: 0.3,
      keyK: 0.45,
      key: [0.1, -0.45, -0.5],
      ao: 0.05,
      fogC: t.haze,
      fog: (y) => 0.34 + 0.22 * smooth(120, 320, y),
      outline: 0.15,
      outlineC: t.fog,
    }),
    rot: {
      seed: 333,
      bias: (x, y, m) => -0.2 + 0.16 * smooth(AQ_TOP + 14, AQ_TOP - 4, y) * (y < AQ_TOP + 16 ? 1 : 0) + (m === M.GOLD ? 0.06 : 0),
      sinews: [
        [484, AQ_TOP + 16, 548, AQ_TOP + 16, 20, 1.2],
        [612, AQ_TOP + 16, 676, AQ_TOP + 16, 16, 1],
        [114, 160, 226, 222, 30, 1],
        [294, 222, 406, 140, 26, 1],
      ],
      drips: [
        [500, AQ_TOP + 34, 30],
        [244, 224, 20],
        [590, AQ_TOP + 34, 26],
      ],
      eyes: [
        [96, 180, 4],
        [426, 180, 4],
      ],
      z: 6,
    },
    post: (pc, t) => mist(pc, 230, 330, t.mist, 0.3, 21),
  };
}

// ============================================================================
// NEAR: the bridge — balustrade, saints on plinths, iron lamp posts
// ============================================================================

const BAL_TOP = 244;
const BAL_BOT = 292;
const PL = [0, 160, 320, 480];
const PLW = 16;
const PL_TOP = 222;

type Pose = 'spear' | 'veil' | 'broken' | 'book';

/** A draped saint, feet at (cx, base), about `h` px tall. */
function statue(R: Relief, cx: number, base: number, h: number, z: number, pose: Pose, seed: number) {
  const top = base - h;
  const sh = top + h * 0.2; // shoulders
  const m = M.SHAFT;
  // a small pedestal block
  R.box(cx - 11, base - 4, cx + 11, base - 1, (x, y, i) => R.put(i, z + 4 - (y === base - 4 ? 0 : 0.5), M.TRIM, y === base - 4 ? 0.12 : 0));
  // the robe
  R.box(cx - 13, sh - 2, cx + 13, base - 5, (x, y, i) => {
    const t = (y - sh) / (base - 5 - sh);
    const half = t < 0.35 ? 8 - t * 3 : 7 + (t - 0.35) * 6;
    const lean = (pose === 'veil' ? -1 : 1) * t * 1.5;
    const dx = x + 0.5 - cx - lean;
    if (Math.abs(dx) > half) return;
    const nx = dx / half;
    const fold = Math.sin(nx * Math.PI * 2.4 + t * 2.4 + seed);
    const fold2 = t > 0.4 ? Math.sin(nx * Math.PI * 4 - t * 3 + seed * 2) * (t - 0.4) : 0;
    const sash = Math.abs(y - (sh + h * 0.22 + nx * 7)) < 1.6 && t < 0.6;
    const hem = t > 0.96;
    R.raise(i, z + 6 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 6 + fold * 1.2 + fold2 * 2 + (sash ? 1.4 : 0), m, sash ? 0.06 : hem ? -0.1 : fold < -0.6 ? -0.08 : 0);
  });
  // shoulders
  blob(R, cx, sh + 2, 8.5, 3.5, z + 8, 3, m);
  if (pose !== 'broken') {
    const hx = cx + (pose === 'veil' ? -1 : 0.5);
    blob(R, hx, sh - 2, 1.8, 2, z + 9, 2, m);
    blob(R, hx, top + h * 0.1, 4, 5, z + 9, 4, m, 0.04);
    if (pose === 'veil' || pose === 'book') {
      // veil over the head falling onto the shoulders
      R.box(hx - 7, top - 2, hx + 7, sh + 8, (x, y, i) => {
        const dx = x + 0.5 - hx;
        const t = (y - top + 1) / (sh + 8 - top + 1);
        const half = 4.8 + t * 3.4;
        if (Math.abs(dx) > half || (Math.abs(dx) < half - 2.2 && y > top + 4 && y < sh)) return;
        R.raise(i, z + 12 + Math.sqrt(Math.max(0, 1 - (dx / half) ** 2)) * 2, m, -0.02);
      });
    }
  } else {
    // broken neck stump
    R.box(cx - 3, sh - 3, cx + 3, sh, (x, y, i) => R.raise(i, z + 10, m, y === sh - 3 ? 0.1 : 0));
  }
  // arms
  if (pose === 'spear') {
    R.tube(cx + 7, sh + 2, cx + 10, sh + 12, 2, z + 9, m);
    R.tube(cx + 10, sh + 12, cx + 12, sh + 4, 1.8, z + 10, m);
    R.tube(cx + 12.5, base - 8, cx + 12.5, top - 18, 0.8, z + 12, m, 0.05, true);
    R.box(cx + 9, top - 28, cx + 16, top - 17, (x, y, i) => {
      const k = (y - (top - 28)) / 11;
      const half = k < 0.7 ? k * 3.2 : (1 - k) * 7.5;
      if (Math.abs(x + 0.5 - cx - 13) < half) R.put(i, z + 13, m, 0.1);
    });
    R.tube(cx - 7, sh + 2, cx - 6, sh + 22, 2, z + 8, m);
  } else if (pose === 'veil') {
    R.tube(cx - 7, sh + 2, cx - 2, sh + 13, 2, z + 9, m);
    R.tube(cx + 7, sh + 2, cx + 1, sh + 12, 2, z + 9, m);
    blob(R, cx - 0.5, sh + 12, 2.5, 2.5, z + 11, 2, m, 0.05);
  } else if (pose === 'book') {
    R.tube(cx + 7, sh + 2, cx + 4, sh + 14, 2, z + 9, m);
    R.tube(cx - 7, sh + 2, cx - 3, sh + 15, 2, z + 9, m);
    R.box(cx - 5, sh + 11, cx + 6, sh + 18, (x, y, i) => R.put(i, z + 13 + (y === sh + 11 ? 0.5 : 0), m, x === cx + 6 ? -0.1 : 0.06));
  } else {
    R.tube(cx - 7, sh + 2, cx - 8, sh + 9, 2, z + 8, m);
    R.tube(cx + 7, sh + 2, cx + 9, sh + 18, 2, z + 9, m);
    R.box(cx - 10, sh - 4, cx + 10, sh + 12, (x, y, i) => {
      // a jagged break across the upper body
      if (R.mat[i] && y < sh + 1 + Math.abs(Math.sin(x * 1.3)) * 3 - (x - cx) * 0.3) R.put(i, EMPTY, 0, 0);
    });
  }
}

function plinth(R: Relief, cx: number, z: number) {
  R.box(cx - PLW - 4, PL_TOP, cx + PLW + 4, BAL_BOT + 6, (x, y, i) => {
    const ax = Math.abs(x + 0.5 - cx);
    if (y < PL_TOP + 6) {
      const half = PLW + 3 - (y < PL_TOP + 2 ? 0 : 1);
      if (ax > half) return;
      R.put(i, z + 6 - (y === PL_TOP + 5 ? 1 : 0) - (ax > half - 1 ? 0.8 : 0), M.TRIM, y === PL_TOP ? 0.14 : 0);
      return;
    }
    if (y >= BAL_BOT - 6) {
      const half = PLW + 3;
      if (ax > half) return;
      R.put(i, z + 5 - (ax > half - 1 ? 0.8 : 0), M.TRIM, y === BAL_BOT - 6 ? 0.1 : -0.04);
      return;
    }
    if (ax > PLW) return;
    const panel = ax < PLW - 4 && y > PL_TOP + 10 && y < BAL_BOT - 10;
    const edge = panel && (ax > PLW - 5.5 || y < PL_TOP + 11.5 || y > BAL_BOT - 11.5);
    R.put(i, z + (panel ? (edge ? 2.6 : 3.2) : 4) - (ax > PLW - 1 ? 0.8 : 0), M.TRIM, panel ? -0.06 : (hash2(x >> 2, y >> 2, 5) - 0.5) * 0.06);
  });
}

/** Wrought-iron lamp post on the deck; returns the light centre. */
function lampPost(R: Relief, cx: number, base: number, top: number, z: number): [number, number] {
  const L = cageLantern(R, cx, top, 1.25, z + 4);
  const lanternBot = top + Math.round(4 * 1.25) + Math.round(6 * 1.25) + Math.round(13 * 1.25) + Math.round(6 * 1.25) + Math.round(4 * 1.25);
  R.tube(cx, lanternBot - 2, cx, base - 10, 1.6, z, M.IRON, 0, true);
  // collars
  for (const cy of [lanternBot + 4, lanternBot + 34, base - 30]) R.tube(cx - 3, cy, cx + 3, cy, 1.4, z + 1, M.IRON, 0.1, true);
  // scroll brackets under the lantern
  for (const s of [-1, 1]) {
    let px = cx;
    let py = lanternBot + 12;
    for (let k = 1; k <= 12; k++) {
      const a = (k / 12) * Math.PI * 1.4;
      const x = cx + s * (Math.sin(a) * 7);
      const y = lanternBot + 12 - (1 - Math.cos(a)) * 5;
      R.tube(px, py, x, y, 0.8, z + 1, M.IRON, 0, true);
      px = x;
      py = y;
    }
  }
  // fluted base
  R.box(cx - 6, base - 12, cx + 6, base - 1, (x, y, i) => {
    const k = (y - (base - 12)) / 12;
    const half = 2 + k * k * 4;
    const dx = x + 0.5 - cx;
    if (Math.abs(dx) > half) return;
    R.put(i, z + 1 + Math.sqrt(Math.max(0, 1 - (dx / half) ** 2)) * 2, M.IRON, y === base - 12 ? 0.1 : 0);
  });
  return L;
}

function bridgeNear(): TLayer {
  const R = new Relief(W, H);
  const Z = 10;
  // deck side below the balustrade: cornice and a dark arcade
  R.box(0, BAL_BOT, W - 1, H - 1, (x, y, i) => {
    const u = wrapX(x) % 160;
    if (y < BAL_BOT + 8) {
      R.put(i, Z + 6 - (y === BAL_BOT + 7 ? 1 : 0) - (y === BAL_BOT + 3 ? 0.6 : 0), M.TRIM, y === BAL_BOT ? 0.14 : 0);
      return;
    }
    const res = vous(u, y, 80, 352, 56, 10, 15, Z + 2);
    if (res === 1) R.put(i, hit.h, hit.m, hit.t);
    else if (res === 2) R.put(i, Z - 20, M.DEEP, 0);
    else R.put(i, Z + 1 + ashlar(x, y, 20, 9, 81) * 0.8, M.WALL, hit.t - 0.06);
  });
  // balustrade segments between the plinths; one has a broken gap
  for (const p of PL) {
    const x0 = p + PLW + 1;
    const x1 = p + 160 - PLW - 1;
    balustrade(R, x0, x1, BAL_TOP, BAL_BOT, 640 / 48, Z);
  }
  R.box(352, BAL_TOP, 404, BAL_BOT - 1, (x, y, i) => {
    const gap = BAL_TOP + 4 + Math.abs(Math.sin(x * 0.31)) * 10 + Math.max(0, 14 - Math.abs(x - 378)) * 2.6;
    if (y < gap && R.mat[i]) R.put(i, EMPTY, 0, 0);
  });
  rubble(R, 356, 400, BAL_BOT, 9, Z + 4, 5, M.TRIM);
  for (const p of PL) plinth(R, p, Z);
  statue(R, 0, PL_TOP, 74, Z + 4, 'spear', 1);
  statue(R, 160, PL_TOP, 70, Z + 4, 'veil', 2);
  statue(R, 320, PL_TOP, 72, Z + 4, 'broken', 3);
  statue(R, 480, PL_TOP, 72, Z + 4, 'book', 4);
  const lamps = [lampPost(R, 80, BAL_BOT + 8, 150, Z + 14), lampPost(R, 560, BAL_BOT + 8, 158, Z + 14), lampPost(R, 248, BAL_BOT + 8, 168, Z + 14)];
  // moss in the joints of the balustrade foot
  R.box(0, BAL_BOT - 8, W - 1, BAL_BOT + 2, (x, y, i) => {
    if (R.mat[i] === M.TRIM && pnoise(x, y, 4, 7, W) > 0.72) R.mat[i] = X.MOSS;
  });
  return {
    R,
    lights: (t) => [
      ...lamps.map(([x, y]) => ({ x, y, z: 40, r: 120, c: t.lamp, k: 0.75 })),
      { x: SX, y: 120, z: -30, r: 330, c: t.key, k: 0.35 },
    ],
    glows: (t) => lamps.map(([x, y]) => ({ x, y, r: 26, c: t.lamp, k: 0.4 })),
    opts: (t) => ({ amb: 0.3, keyK: 0.45, ao: 0.07, outline: 0.45, outlineC: [24, 10, 18], fogC: t.haze, fog: () => 0.08 }),
    rot: {
      seed: 351,
      bias: (x, y, m) => -0.2 + 0.24 * smooth(BAL_BOT - 14, BAL_BOT + 10, y) + (m === M.SHAFT ? 0.12 : 0) + (m === M.IRON ? -9 : 0),
      sinews: [
        [80, 196, 160, 190, 14, 1.4],
        [160, 186, 248, 214, 16, 1.2],
        [248, 214, 320, 180, 18, 1.4],
        [480, 186, 560, 200, 22, 1.6],
        [0, 190, 80, 196, 10, 1.2],
        [PL[1] + PLW, BAL_TOP + 2, PL[2] - PLW, BAL_TOP + 2, 12, 1.2],
      ],
      drips: [
        [12, 200, 30],
        [150, 194, 28],
        [322, 186, 40],
        [488, 190, 34],
        [100, 246, 20],
        [430, 246, 26],
        [600, 246, 16],
      ],
      eyes: [
        [0, 256, 5],
        [160, 160, 3],
        [320, 252, 5],
        [480, 260, 4],
        [214, 270, 3],
      ],
      z: 18,
    },
  };
}

// ============================================================================
// FG: dead branches reaching in at the top; rubble and a fallen saint's head
// ============================================================================

function branch(R: Relief, x: number, y: number, ang: number, len: number, r: number, z: number, depth: number, seed: number) {
  const ex = x + Math.cos(ang) * len;
  const ey = y + Math.sin(ang) * len;
  R.tube(x, y, ex, ey, r, z, M.WOOD, 0, true);
  if (depth <= 0 || r < 0.7) return;
  const n = 2;
  for (let k = 0; k < n; k++) {
    const da = (k === 0 ? -1 : 1) * (0.35 + hash2(depth, k, seed) * 0.5);
    branch(R, ex, ey, ang + da, len * (0.6 + hash2(k, depth, seed + 1) * 0.25), r * 0.66, z, depth - 1, seed + k * 7 + 1);
  }
}

function bridgeFg(): TLayer {
  const R = new Relief(W, H);
  branch(R, 330, -6, 1.25, 34, 3.2, 30, 4, 3);
  branch(R, 372, -6, 1.9, 22, 2.2, 30, 3, 9);
  rubble(R, 40, 230, H + 4, 28, 26, 13, M.TRIM);
  blob(R, 132, H - 30, 11, 12, 34, 9, M.SHAFT, 0.02); // a fallen stone head
  blob(R, 126, H - 40, 9, 5, 36, 5, M.SHAFT, -0.05);
  balustrade(R, 446, 530, 322, 368, 12, 28);
  R.box(440, 316, 540, H - 1, (x, y, i) => {
    if (R.mat[i] && y < 326 + Math.abs(Math.sin(x * 0.23) * 10 + Math.sin(x * 0.8) * 3)) R.put(i, EMPTY, 0, 0);
  });
  rubble(R, 420, 600, H + 6, 18, 28, 17, M.TRIM);
  return {
    R,
    lights: (t) => [{ x: SX, y: 200, z: 40, r: 420, c: t.key, k: 0.16 }],
    glows: () => [],
    opts: () => ({ amb: 0.07, keyK: 0.1, ao: 0, outline: 0.7, outlineC: [10, 4, 8] }),
    rot: {
      seed: 371,
      bias: (x, y) => 0.02 + 0.1 * smooth(330, 360, y),
      drips: [
        [356, 30, 24],
        [344, 18, 14],
      ],
      sinews: [[320, 4, 470, 2, 18, 1.8]],
      z: 30,
    },
  };
}

export function drawBridge(): { plain: Layers; rot: Layers } {
  return buildPair({ far: bridgeFar, mid: bridgeMid, near: bridgeNear, fg: bridgeFg }, SANCTUM, SANCTUM_ROT);
}

