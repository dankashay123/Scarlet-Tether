import { PixelCanvas, hash2 } from '../pixel';
import { fbm, hex, pnoise, smooth } from './paint';
import { type RMat, Relief, type ShadeOpts, ramp } from './relief';
import { ashlar, chain, hit, lantern, shafts } from './nave';

/**
 * The Cistern (hub) backdrops: brick vaults and voussoir arches standing in
 * warm red water, ceiling grates pouring gold shafts, rusted pipes, chains and
 * caged lamps. Built with the same relief renderer as the nave so the hub and
 * the biome share one hand.
 */

const W = 640;
const H = 360;
const WATER_Y = 306;

// Material ids (BRASS / GLASS / IRON match the nave helpers)
const C = { BRICK: 1, STONE: 2, DEEP: 3, BRASS: 4, GLASS: 5, IRON: 9, LIT: 10, BLOOD: 12, MOSS: 17, RUST: 18, WATER: 19 } as const;

const mats: (RMat | undefined)[] = [];
mats[C.BRICK] = { ramp: ramp(['#060303', '#140908', '#24110d', '#381c14', '#50291b', '#6c3a24', '#8a5232'], 10) };
mats[C.STONE] = { ramp: ramp(['#080605', '#1a1310', '#2e221b', '#46362a', '#64503c', '#8a7254', '#b09676'], 10), spec: 0.12 };
mats[C.DEEP] = { ramp: ramp(['#020101', '#080404', '#100707', '#1a0b0a'], 5) };
mats[C.BRASS] = { ramp: ramp(['#120a04', '#3a2410', '#76501c', '#b4842e', '#e8c060', '#fff0b0'], 8), spec: 0.6 };
mats[C.GLASS] = { ramp: ramp(['#5a1c06', '#b4500e', '#f09a28', '#ffd468', '#fff8d8'], 7), emit: true };
mats[C.IRON] = { ramp: ramp(['#050404', '#141110', '#26201c', '#3e342c', '#5a4c40'], 6), spec: 0.4 };
mats[C.LIT] = { ramp: ramp(['#3a2408', '#7a5214', '#c08a2a', '#f0c860', '#fff4c0'], 7), emit: true };
mats[C.BLOOD] = { ramp: ramp(['#140103', '#3e050c', '#760c18', '#b01a24', '#e84a3a'], 7), spec: 1 };
mats[C.MOSS] = { ramp: ramp(['#060702', '#141a08', '#26300e', '#3e4a18', '#5c6a26'], 6), spec: 0.2 };
mats[C.RUST] = { ramp: ramp(['#120604', '#2e1208', '#50220e', '#7a3a16', '#a45a24'], 6), spec: 0.15 };
mats[C.WATER] = { ramp: ramp(['#120204', '#2a0509', '#460a10', '#6a1418', '#9a2a20', '#d0602e', '#ffb060'], 9), emit: true };

const LAMP = hex('#ffb050');
const GOLD = hex('#ffcc70');
const AMB = hex('#8a6050');
const KEY = hex('#d0a080');

const wrapX = (x: number) => ((x % W) + W) % W;

/** Round arch of radiating voussoirs (with keystone). 0 outside, 1 band, 2 opening. */
function vousArch(x: number, y: number, cx: number, ys: number, r: number, B: number, nV: number, base: number): number {
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - ys;
  if (dy >= 0) return Math.abs(dx) < r ? 2 : 0;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < r) return 2;
  if (d >= r + B) return 0;
  const a = Math.atan2(-dy, dx) / Math.PI; // 0..1
  const key = Math.abs(a - 0.5) < 0.5 / nV;
  const f = a * nV + 0.5;
  const u = f - Math.floor(f);
  const arc = (Math.PI * (r + B * 0.5)) / nV;
  const ju = Math.min(u, 1 - u) * arc;
  const rr = d - r;
  if (ju < 0.8 || rr < 0.8 || rr > B - 1) {
    hit.h = base - 1;
    hit.m = C.DEEP;
    hit.t = 0;
    return 1;
  }
  const e = Math.min(ju, rr, B - rr);
  hit.h = base + Math.min(1.4, e * 0.6) + (key ? 1 : 0);
  hit.m = C.STONE;
  hit.t = (hash2(Math.floor(f), 7, 3) - 0.5) * 0.2 + (key ? 0.08 : 0);
  return 1;
}

/** Brick masonry height with hit.t set. */
function brick(x: number, y: number, seed: number): number {
  return ashlar(x, y, 16, 6, seed);
}

/** Brick pier with stone quoins, impost and plinth. */
function pier(R: Relief, cx: number, hw: number, top: number, spring: number, bot: number, z: number) {
  R.box(cx - hw - 6, top, cx + hw + 6, bot, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    // impost block at the springing line
    if (y >= spring - 6 && y < spring) {
      if (ax > hw + 4) return;
      R.put(i, z + 3 - (y === spring - 1 ? 1 : 0) - (ax > hw + 3 ? 0.8 : 0), C.STONE, y === spring - 6 ? 0.12 : 0);
      return;
    }
    if (y >= bot - 14) {
      if (ax > hw + 3) return;
      R.put(i, z + 2 - (y === bot - 14 ? -0.6 : 0), C.STONE, -0.05);
      return;
    }
    if (ax > hw) return;
    // quoins: alternating long/short blocks on both arrises
    const row = Math.floor((y - top) / 10);
    const qw = row & 1 ? 9 : 5;
    const ly = (y - top) % 10;
    if (hw - ax < qw) {
      const edge = ly === 0 || hw - ax > qw - 1;
      R.put(i, z + (edge ? 0.6 : 1.8) - (hw - ax < 1 ? 0.8 : 0), edge ? C.DEEP : C.STONE, (hash2(row, cx | 0, 2) - 0.5) * 0.2);
      return;
    }
    const h = brick(x, y, 31);
    R.put(i, z + h, C.BRICK, hit.t);
  });
}

interface Layer {
  R: Relief;
  opts: Partial<ShadeOpts>;
  post?: (pc: PixelCanvas) => void;
}

// --- FAR: the long vault, ceiling grates, a colonnade of brick arches over the water
const GR = [80, 240, 400, 560];

function farLayer(): Layer {
  const R = new Relief(W, H);
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const u = wrapX(x) % 160;
    if (y < 60) {
      // ceiling with grates
      const g = Math.abs(u - 80) < 22 && y > 16 && y < 26;
      if (g) {
        const bar = (u & 3) === 0 || y === 17 || y === 25;
        R.put(i, bar ? -1 : -6, bar ? C.IRON : C.LIT, 0);
        if (!bar) R.emi[i] = 0.75 + (hash2(u, y, 1) - 0.5) * 0.2;
        return;
      }
      const rib = Math.abs(u - 80) < 26 && Math.abs(u - 80) > 23 && y > 12 && y < 30;
      R.put(i, rib ? 0 : brick(x, y, 3) * 0.6 - 2, rib ? C.STONE : C.BRICK, rib ? 0 : hit.t - 0.1);
      return;
    }
    if (y < 66) {
      R.put(i, 1.5 - (y === 65 ? 0.8 : 0), C.STONE, y === 60 ? 0.1 : 0);
      return;
    }
    if (y >= WATER_Y) {
      const rip = pnoise(x, y * 4, 10, 4, W);
      R.put(i, 0, C.WATER, 0);
      const k = 1 - (y - WATER_Y) / (H - WATER_Y);
      R.emi[i] = 0.22 + rip * 0.25 + 0.25 * Math.exp(-(((u - 80) / 30) ** 2)) * k;
      return;
    }
    const res = vousArch(u, y, 80, 150, 58, 12, 15, 0);
    if (res === 1) R.put(i, hit.h, hit.m, hit.t);
    else if (res === 2) {
      // deep tunnel with a faint glow at the water line
      R.put(i, -24, C.LIT, 0);
      R.emi[i] = 0.02 + 0.2 * smooth(200, WATER_Y, y) * (1 - Math.abs(u - 80) / 70);
      if (y > 276 && Math.abs(u - 80) < 56 && ((u >> 2) & 1) === 0 && y < 300) R.put(i, -20, C.IRON, 0); // sluice gate bars
    } else R.put(i, brick(x, y, 5) * 0.7, C.BRICK, hit.t + (y > 280 ? -0.15 : 0));
  });
  for (let k = 0; k < 4; k++) {
    R.box(k * 160 - 22, 92, k * 160 + 22, WATER_Y, (x, y, i) => {
      const ax = Math.abs(x + 0.5 - k * 160);
      if (y < 150 && ax < 20 && y > 140) R.put(i, 2.5, C.STONE, y === 141 ? 0.1 : 0);
      if (y > 296 && ax < 22 && R.mat[i] === C.BRICK) R.mat[i] = C.MOSS;
    });
  }
  return {
    R,
    opts: {
      amb: 0.18,
      keyK: 0.18,
      ao: 0.06,
      fogC: hex('#1e0c0a'),
      fog: (y) => 0.5 + 0.18 * smooth(160, WATER_Y, y) - 0.25 * smooth(WATER_Y, H, y),
      lights: GR.map((x) => ({ x, y: 40, z: 30, r: 230, c: GOLD, k: 0.55 })),
      glows: GR.map((x) => ({ x, y: 22, r: 40, c: GOLD, k: 0.35 })),
    },
    post: (pc) => shafts(pc, GR.map((x) => [x, 0.18, 12, 0.13] as [number, number, number, number]), GOLD, 22, WATER_Y, 5),
  };
}

// --- MID: great brick vaults on quoined piers, pipes and caged lamps
const MP = [0, 320];

function midLayer(): Layer {
  const R = new Relief(W, H);
  const SPR = 112;
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const xx = wrapX(x);
    const cx = Math.floor(xx / 320) * 320 + 160;
    const res = vousArch(xx, y, cx, SPR, 128, 18, 27, 4);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 0 && y < SPR) {
      const h = brick(x, y, 9);
      R.put(i, h + 2, C.BRICK, hit.t - (y < 30 ? 0.12 : 0));
    }
  });
  for (const px of MP) {
    pier(R, px, 26, SPR - 6, SPR, 340, 6);
    pier(R, px + W, 26, SPR - 6, SPR, 340, 6);
  }
  // water line moss and staining on the piers
  R.box(0, 270, W - 1, H - 1, (x, y, i) => {
    if (R.mat[i] === C.BRICK || R.mat[i] === C.STONE) {
      const n = fbm(x, y, 8, 3, W, 2);
      if (y > 300 - n * 20) R.mat[i] = C.MOSS;
      else R.tex[i] -= 0.15 * smooth(270, 300, y);
    }
  });
  // a long rusted pipe with flanges, and an outlet pouring blood
  R.box(0, 156, W - 1, 168, (x, y, i) => {
    const ax = Math.abs(y + 0.5 - 162);
    const fl = wrapX(x) % 80 < 4;
    const rr = fl ? 6.5 : 5;
    if (ax > rr) return;
    R.raise(i, 10 + Math.sqrt(rr * rr - ax * ax), fl ? C.IRON : C.RUST, (hash2(x >> 1, y, 4) - 0.5) * 0.2);
  });
  for (const ox of [96, 416]) {
    R.tube(ox, 166, ox, 182, 4.5, 10, C.RUST, 0, true);
    R.tube(ox - 6, 182, ox + 6, 182, 3, 12, C.IRON, 0, true);
    R.tube(ox, 184, ox + Math.sin(1) * 2, H, 2.2, 8, C.BLOOD, 0.05, true);
  }
  // chains and hooks swinging in the vaults
  for (const [cx, len] of [
    [200, 120],
    [236, 70],
    [520, 100],
  ] as [number, number][]) {
    chain(R, cx, 0, len, 14);
    R.box(cx - 5, len, cx + 5, len + 10, (x, y, i) => {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - len - 4;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 4.2 && d > 2.6 && (dy > -1 || dx < 0)) R.put(i, 15, C.IRON, 0.1);
    });
  }
  // caged lamps on the piers
  const lamps: [number, number][] = [];
  for (const px of MP) lamps.push(lantern(R, px, 206, 1.15, 12));
  return {
    R,
    opts: {
      amb: 0.13,
      keyK: 0.2,
      ao: 0.08,
      outline: 0.6,
      fogC: hex('#160806'),
      fog: () => 0.22,
      lights: [...lamps.map(([x, y]) => ({ x, y, z: 30, r: 170, c: LAMP, k: 0.85 })), ...GR.map((x) => ({ x, y: -30, z: 50, r: 200, c: GOLD, k: 0.35 }))],
      glows: lamps.map(([x, y]) => ({ x, y, r: 36, c: LAMP, k: 0.4 })),
    },
  };
}

// --- NEAR: a gantry of iron, a heavy pipe with a valve wheel, hanging chains
function nearLayer(): Layer {
  const R = new Relief(W, H);
  // big pipe along the bottom
  R.box(0, 286, W - 1, 312, (x, y, i) => {
    const ax = Math.abs(y + 0.5 - 299);
    const u = wrapX(x) % 160;
    const fl = u < 6;
    const rr = fl ? 13 : 11;
    if (ax > rr) return;
    const bolt = fl && (y === 290 || y === 308) && (u === 1 || u === 4);
    R.put(i, 20 + Math.sqrt(rr * rr - ax * ax), bolt ? C.BRASS : fl ? C.IRON : C.RUST, (pnoise(x, y, 4, 7, W) - 0.5) * 0.3);
  });
  // supports and a railing
  for (let k = 0; k < 8; k++) {
    const sx = k * 80 + 40;
    R.tube(sx, 312, sx, H, 3, 14, C.IRON, 0, true);
    R.tube(sx, 250, sx, 286, 1.6, 22, C.IRON, 0, true);
  }
  R.tube(-10, 250, W + 10, 250, 1.8, 22, C.IRON, 0, true);
  R.tube(-10, 266, W + 10, 266, 1.3, 22, C.IRON, 0, true);
  // valve wheel
  R.box(200, 260, 240, 300, (x, y, i) => {
    const dx = x + 0.5 - 220;
    const dy = y + 0.5 - 280;
    const d = Math.sqrt(dx * dx + dy * dy);
    const spoke = Math.abs(dx) < 1.2 || Math.abs(dy) < 1.2 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 1.2;
    if ((d < 16 && d > 12.5) || (d < 13 && spoke) || d < 3) R.put(i, 36 + (d < 3 ? 2 : 0), d < 3 ? C.BRASS : C.IRON, 0.05);
  });
  // brick pillar stub with a caged lamp
  R.box(430, 150, 482, H - 1, (x, y, i) => {
    const ax = Math.abs(x + 0.5 - 456);
    const top = 160 + Math.abs(Math.sin(x * 0.9)) * 6 + Math.sin(x * 0.27) * 4;
    if (ax > 24 || y < top) return;
    const h = brick(x, y, 41);
    R.put(i, 14 + h, y > 290 ? C.MOSS : C.BRICK, hit.t + (y < top + 2 ? 0.1 : 0));
  });
  const lamps: [number, number][] = [lantern(R, 456, 200, 1.4, 30)];
  // chains
  chain(R, 120, 0, 150, 24);
  chain(R, 136, 0, 110, 24);
  chain(R, 330, 0, 60, 24);
  return {
    R,
    opts: {
      amb: 0.1,
      keyK: 0.16,
      ao: 0.06,
      outline: 0.7,
      lights: [...lamps.map(([x, y]) => ({ x, y, z: 50, r: 200, c: LAMP, k: 1.1 })), { x: 320, y: -40, z: 60, r: 300, c: GOLD, k: 0.3 }],
      glows: lamps.map(([x, y]) => ({ x, y, r: 44, c: LAMP, k: 0.4 })),
    },
  };
}

// --- FG: dripping chain silhouettes above, rubble and a broken railing below
function fgLayer(): Layer {
  const R = new Relief(W, H);
  chain(R, 60, 0, 48, 30);
  chain(R, 470, 0, 30, 30);
  R.box(0, 0, W - 1, 22, (x, y, i) => {
    // a ragged vault lip across the top edge, interrupted
    const u = wrapX(x);
    if (u > 240 && u < 420) return;
    const lip = 6 + Math.abs(Math.sin(u * 0.13)) * 6 + Math.sin(u * 0.041) * 4;
    if (y < lip) R.put(i, 30 + brick(x, y, 51), C.BRICK, hit.t);
  });
  R.box(20, 330, 200, H - 1, (x, y, i) => {
    const n = fbm(x, y, 9, 5, W, 2);
    const top = 352 - Math.sin(((x - 20) / 180) * Math.PI) * 20 + (n - 0.5) * 12;
    if (y > top) R.put(i, 30 + n * 6, n > 0.6 ? C.MOSS : C.BRICK, (n - 0.5) * 0.2);
  });
  for (let k = 0; k < 6; k++) R.tube(400 + k * 14, 336 + (k % 2) * 4, 400 + k * 14 + (k === 3 ? 6 : 0), H, 1.3, 30, C.IRON, 0, true);
  R.tube(392, 338, 480, 342, 1.5, 32, C.IRON, 0, true);
  return {
    R,
    opts: { amb: 0.05, keyK: 0.1, ao: 0.04, outline: 0.7, lights: [{ x: 320, y: 200, z: 80, r: 400, c: LAMP, k: 0.16 }] },
  };
}

export function drawCistern(): { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas } {
  const shade = (L: Layer) => {
    const pc = L.R.shade({ mats, keyC: KEY, ambC: AMB, tint: 0.7, ...L.opts });
    L.post?.(pc);
    return pc;
  };
  return { far: shade(farLayer()), mid: shade(midLayer()), near: shade(nearLayer()), fg: shade(fgLayer()) };
}
