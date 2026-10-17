import { PixelCanvas, hash2 } from '../pixel';
import { fbm, hex, pnoise, smooth } from './paint';
import { type RMat, Relief, type ShadeOpts, ramp } from './relief';
import { H, LAYER_COLORS, SNES_SHADE, W, ashlar, chain, hit, lantern, shafts } from './nave';
import { snesLayer } from './snes-env';

/**
 * The Cistern (hub) backdrops: brick vaults and voussoir arches standing in
 * warm red water, ceiling grates pouring gold shafts, rusted pipes, chains and
 * caged lamps. Built with the same relief renderer as the nave so the hub and
 * the biome share one hand. 512x224 SNES layers like the nave.
 */

const WATER_Y = 190;

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
  return ashlar(x, y, 8, 4, seed);
}

/** Brick pier with stone quoins, impost and plinth. */
function pier(R: Relief, cx: number, hw: number, top: number, spring: number, bot: number, z: number) {
  R.box(cx - hw - 4, top, cx + hw + 4, bot, (x, y, i) => {
    const dx = x + 0.5 - cx;
    const ax = Math.abs(dx);
    // impost block at the springing line
    if (y >= spring - 4 && y < spring) {
      if (ax > hw + 2.5) return;
      R.put(i, z + 3 - (y === spring - 1 ? 1 : 0) - (ax > hw + 1.8 ? 0.8 : 0), C.STONE, y === spring - 4 ? 0.12 : 0);
      return;
    }
    if (y >= bot - 9) {
      if (ax > hw + 2) return;
      R.put(i, z + 2 - (y === bot - 9 ? -0.6 : 0), C.STONE, -0.05);
      return;
    }
    if (ax > hw) return;
    // quoins: alternating long/short blocks on both arrises
    const row = Math.floor((y - top) / 6);
    const qw = row & 1 ? 6 : 3;
    const ly = (y - top) % 6;
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
const GP = W / 4;
const GR = [0, 1, 2, 3].map((k) => GP / 2 + k * GP);

function farLayer(): Layer {
  const R = new Relief(W, H);
  const cx = GP / 2;
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const u = wrapX(x) % GP;
    if (y < 37) {
      // ceiling with grates
      const g = Math.abs(u - cx) < 14 && y > 10 && y < 16;
      if (g) {
        const bar = (Math.floor(u) & 3) === 0 || y === 11 || y === 15;
        R.put(i, bar ? -1 : -6, bar ? C.IRON : C.LIT, 0);
        if (!bar) R.emi[i] = 0.75 + (hash2(u | 0, y, 1) - 0.5) * 0.2;
        return;
      }
      const rib = Math.abs(u - cx) < 16.5 && Math.abs(u - cx) > 14.5 && y > 7 && y < 19;
      R.put(i, rib ? 0 : brick(x, y, 3) * 0.6 - 2, rib ? C.STONE : C.BRICK, rib ? 0 : hit.t - 0.1);
      return;
    }
    if (y < 41) {
      R.put(i, 1.5 - (y === 40 ? 0.8 : 0), C.STONE, y === 37 ? 0.1 : 0);
      return;
    }
    if (y >= WATER_Y) {
      const rip = pnoise(x, y * 4, 7, 4, W);
      R.put(i, 0, C.WATER, 0);
      const k = 1 - (y - WATER_Y) / (H - WATER_Y);
      R.emi[i] = 0.22 + rip * 0.25 + 0.25 * Math.exp(-(((u - cx) / 19) ** 2)) * k;
      return;
    }
    const res = vousArch(u, y, cx, 93, 36, 7.5, 13, 0);
    if (res === 1) R.put(i, hit.h, hit.m, hit.t);
    else if (res === 2) {
      // deep tunnel with a faint glow at the water line
      R.put(i, -24, C.LIT, 0);
      R.emi[i] = 0.02 + 0.2 * smooth(124, WATER_Y, y) * (1 - Math.abs(u - cx) / 43);
      if (y > 171 && Math.abs(u - cx) < 35 && ((Math.floor(u) >> 1) & 1) === 0 && y < 186) R.put(i, -20, C.IRON, 0); // sluice gate bars
    } else R.put(i, brick(x, y, 5) * 0.7, C.BRICK, hit.t + (y > 174 ? -0.15 : 0));
  });
  for (let k = 0; k < 4; k++) {
    R.box(k * GP - 14, 57, k * GP + 14, WATER_Y, (x, y, i) => {
      const ax = Math.abs(x + 0.5 - k * GP);
      if (y < 93 && ax < 12.5 && y > 87) R.put(i, 2.5, C.STONE, y === 88 ? 0.1 : 0);
      if (y > 184 && ax < 14 && R.mat[i] === C.BRICK) R.mat[i] = C.MOSS;
    });
  }
  return {
    R,
    opts: {
      amb: 0.18,
      keyK: 0.18,
      ao: 0.06,
      fogC: hex('#1e0c0a'),
      fog: (y) => 0.5 + 0.18 * smooth(99, WATER_Y, y) - 0.25 * smooth(WATER_Y, H, y),
      lights: GR.map((x) => ({ x, y: 25, z: 19, r: 143, c: GOLD, k: 0.55 })),
      glows: GR.map((x) => ({ x, y: 14, r: 25, c: GOLD, k: 0.35 })),
    },
    post: (pc) => shafts(pc, GR.map((x) => [x, 0.18, 7.5, 0.13] as [number, number, number, number]), GOLD, 14, WATER_Y, 5),
  };
}

// --- MID: great brick vaults on quoined piers, pipes and caged lamps
const MBAY = W / 3;
const MP = [0, MBAY, 2 * MBAY];

function midLayer(): Layer {
  const R = new Relief(W, H);
  const SPR = 69;
  R.box(0, 0, W - 1, H - 1, (x, y, i) => {
    const xx = wrapX(x);
    const cx = Math.floor(xx / MBAY) * MBAY + MBAY / 2;
    const res = vousArch(xx, y, cx, SPR, 69, 11, 21, 4);
    if (res === 1) {
      R.put(i, hit.h, hit.m, hit.t);
      return;
    }
    if (res === 0 && y < SPR) {
      const h = brick(x, y, 9);
      R.put(i, h + 2, C.BRICK, hit.t - (y < 19 ? 0.12 : 0));
    }
  });
  for (const px of MP) pier(R, px, 16, SPR - 4, SPR, 211, 6);
  // water line moss and staining on the piers
  R.box(0, 167, W - 1, H - 1, (x, y, i) => {
    if (R.mat[i] === C.BRICK || R.mat[i] === C.STONE) {
      const n = fbm(x, y, 5, 3, W, 2);
      if (y > 186 - n * 12) R.mat[i] = C.MOSS;
      else R.tex[i] -= 0.15 * smooth(167, 186, y);
    }
  });
  // a long rusted pipe with flanges, and an outlet pouring blood
  R.box(0, 96, W - 1, 105, (x, y, i) => {
    const ax = Math.abs(y + 0.5 - 100.5);
    const fl = wrapX(x) % (W / 8) < 3;
    const rr = fl ? 4 : 3.2;
    if (ax > rr) return;
    R.raise(i, 10 + Math.sqrt(rr * rr - ax * ax), fl ? C.IRON : C.RUST, (hash2(x >> 1, y, 4) - 0.5) * 0.2);
  });
  for (const ox of [77, 333]) {
    R.tube(ox, 103, ox, 113, 2.8, 10, C.RUST, 0, true);
    R.tube(ox - 4, 113, ox + 4, 113, 2, 12, C.IRON, 0, true);
    R.tube(ox, 114, ox + 1.2, H, 1.4, 8, C.BLOOD, 0.05, true);
  }
  // chains and hooks swinging in the vaults
  for (const [cx, len] of [
    [160, 74],
    [189, 43],
    [416, 62],
  ] as [number, number][]) {
    chain(R, cx, 0, len, 14);
    R.box(cx - 3, len, cx + 3, len + 6, (x, y, i) => {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - len - 2.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2.7 && d > 1.6 && (dy > -0.6 || dx < 0)) R.put(i, 15, C.IRON, 0.1);
    });
  }
  // caged lamps on the piers
  const lamps: [number, number][] = [];
  for (const px of MP) lamps.push(lantern(R, px, 128, 0.72, 12));
  return {
    R,
    opts: {
      amb: 0.13,
      keyK: 0.2,
      ao: 0.08,
      aoR: 3,
      outline: 0.6,
      fogC: hex('#160806'),
      fog: () => 0.22,
      lights: [...lamps.map(([x, y]) => ({ x, y, z: 19, r: 105, c: LAMP, k: 0.85 })), ...GR.map((x) => ({ x, y: -19, z: 31, r: 124, c: GOLD, k: 0.35 }))],
      glows: lamps.map(([x, y]) => ({ x, y, r: 22, c: LAMP, k: 0.4 })),
    },
  };
}

// --- NEAR: a gantry of iron, a heavy pipe with a valve wheel, hanging chains
function nearLayer(): Layer {
  const R = new Relief(W, H);
  // big pipe along the bottom
  R.box(0, 177, W - 1, 194, (x, y, i) => {
    const ax = Math.abs(y + 0.5 - 185.5);
    const u = wrapX(x) % 128;
    const fl = u < 4;
    const rr = fl ? 8 : 7;
    if (ax > rr) return;
    const bolt = fl && (y === 180 || y === 191) && (u === 1 || u === 2);
    R.put(i, 20 + Math.sqrt(rr * rr - ax * ax), bolt ? C.BRASS : fl ? C.IRON : C.RUST, (pnoise(x, y, 3, 7, W) - 0.5) * 0.3);
  });
  // supports and a railing
  for (let k = 0; k < 8; k++) {
    const sx = k * 64 + 32;
    R.tube(sx, 193, sx, H, 2, 14, C.IRON, 0, true);
    R.tube(sx, 155, sx, 177, 1.1, 22, C.IRON, 0, true);
  }
  R.tube(-10, 155, W + 10, 155, 1.2, 22, C.IRON, 0, true);
  R.tube(-10, 165, W + 10, 165, 0.9, 22, C.IRON, 0, true);
  // valve wheel
  R.box(162, 160, 190, 188, (x, y, i) => {
    const dx = x + 0.5 - 176;
    const dy = y + 0.5 - 174;
    const d = Math.sqrt(dx * dx + dy * dy);
    const spoke = Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 0.8;
    if ((d < 10 && d > 7.8) || (d < 8 && spoke) || d < 2) R.put(i, 36 + (d < 2 ? 2 : 0), d < 2 ? C.BRASS : C.IRON, 0.05);
  });
  // brick pillar stub with a caged lamp
  R.box(344, 93, 386, H - 1, (x, y, i) => {
    const ax = Math.abs(x + 0.5 - 365);
    const top = 99 + Math.abs(Math.sin(x * 0.9)) * 4 + Math.sin(x * 0.27) * 2.5;
    if (ax > 15 || y < top) return;
    const h = brick(x, y, 41);
    R.put(i, 14 + h, y > 180 ? C.MOSS : C.BRICK, hit.t + (y < top + 1.5 ? 0.1 : 0));
  });
  const lamps: [number, number][] = [lantern(R, 365, 124, 0.9, 30)];
  // chains
  chain(R, 96, 0, 93, 24);
  chain(R, 109, 0, 68, 24);
  chain(R, 264, 0, 37, 24);
  return {
    R,
    opts: {
      amb: 0.1,
      keyK: 0.16,
      ao: 0.06,
      aoR: 3,
      outline: 0.7,
      lights: [...lamps.map(([x, y]) => ({ x, y, z: 31, r: 124, c: LAMP, k: 1.1 })), { x: 256, y: -25, z: 37, r: 186, c: GOLD, k: 0.3 }],
      glows: lamps.map(([x, y]) => ({ x, y, r: 27, c: LAMP, k: 0.4 })),
    },
  };
}

// --- FG: dripping chain silhouettes above, rubble and a broken railing below
function fgLayer(): Layer {
  const R = new Relief(W, H);
  chain(R, 48, 0, 30, 30);
  chain(R, 376, 0, 19, 30);
  R.box(0, 0, W - 1, 14, (x, y, i) => {
    // a ragged vault lip across the top edge, interrupted
    const u = wrapX(x);
    if (u > 192 && u < 336) return;
    const lip = 4 + Math.abs(Math.sin(u * 0.13)) * 4 + Math.sin(u * 0.041) * 2.5;
    if (y < lip) R.put(i, 30 + brick(x, y, 51), C.BRICK, hit.t);
  });
  R.box(16, 205, 160, H - 1, (x, y, i) => {
    const n = fbm(x, y, 6, 5, W, 2);
    const top = 218 - Math.sin(((x - 16) / 144) * Math.PI) * 12 + (n - 0.5) * 7.5;
    if (y > top) R.put(i, 30 + n * 6, n > 0.6 ? C.MOSS : C.BRICK, (n - 0.5) * 0.2);
  });
  for (let k = 0; k < 6; k++) R.tube(320 + k * 9, 208 + (k % 2) * 2.5, 320 + k * 9 + (k === 3 ? 4 : 0), H, 0.9, 30, C.IRON, 0, true);
  R.tube(314, 209, 384, 212, 1, 32, C.IRON, 0, true);
  return {
    R,
    opts: { amb: 0.05, keyK: 0.1, ao: 0.04, aoR: 3, outline: 0.7, lights: [{ x: 256, y: 124, z: 50, r: 248, c: LAMP, k: 0.16 }] },
  };
}

export function drawCistern(): { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas } {
  const shade = (L: Layer) => {
    const pc = L.R.shade({ mats, keyC: KEY, ambC: AMB, tint: 0.7, ...SNES_SHADE, aoR: 3, ...L.opts });
    L.post?.(pc);
    return snesLayer(pc, LAYER_COLORS);
  };
  return { far: shade(farLayer()), mid: shade(midLayer()), near: shade(nearLayer()), fg: shade(fgLayer()) };
}
