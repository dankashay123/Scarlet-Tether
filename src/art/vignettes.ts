import { P, darken, lighten, mix } from './palette';
import { PixelCanvas, bayer, hash2, registerImage, valueNoise } from './pixel';
import { Paint, type RGB, clamp01, fbm, hex, inGothic, mixc, mulc, pnoise, smooth } from './environment/paint';
import { Figure, grain, ramp, type Light, type Material } from './render';

// ===========================================================================
// Shared helpers
// ===========================================================================

const R = (cs: string[]) => cs.map(hex);

/** Dithered pick from an RGB ramp (integer pixel coordinates). */
function pk(rmp: RGB[], v: number, x: number, y: number): RGB {
  const n = rmp.length;
  const f = clamp01(v) * (n - 1) * 0.9999;
  let i = Math.floor(f);
  if (f - i > bayer(x | 0, y | 0)) i++;
  return rmp[Math.min(n - 1, i)];
}

const frac = (v: number) => v - Math.floor(v);

// Sun: upper right, slightly in front of the city.
const LX = 0.6;
const LY = -0.48;
const LZ = 0.64;
const HL = Math.hypot(LX, LY, LZ + 1);
const HX = LX / HL;
const HY = LY / HL;
const HZ = (LZ + 1) / HL;

const SKY = R(['#9c6a32', '#b07c3c', '#c4924a', '#d6a95c', '#e3bd72', '#edcf8c', '#f5dea6', '#fae9c0', '#fdf2d8', '#fff9ec']);
const MARBLE = R(['#7c6650', '#957e64', '#ae977a', '#c6b192', '#dbc9a9', '#ebddc2', '#f6eedb', '#fdf8ec', '#ffffff']);
const GOLD = R(['#3e240a', '#62400f', '#8a6018', '#b08024', '#d4a238', '#ecc65a', '#f8e08e', '#fff2c4', '#ffffff']);
const ROOF = R(['#6a5a48', '#857260', '#a08c74', '#bba68a', '#d4c2a2', '#e8dabe', '#f6ecd6']);
const WIN_DARK = hex('#8a6a3c');
const WIN_LIT = hex('#ffe6a0');
const WIN_HOT = hex('#fff8e0');
const GLARE = hex('#fff2c8');

interface Mat {
  ramp: RGB[];
  spec: number;
  /** 0 = smooth round, 1 = flat front, 2 = square seen corner-on, 3+ = polygonal. */
  facets: number;
  tex: number;
}
const M_MARBLE: Mat = { ramp: MARBLE, spec: 0.08, facets: 2, tex: 0.08 };
const M_FACADE: Mat = { ramp: MARBLE, spec: 0, facets: 1, tex: 0.08 };
const M_DRUM: Mat = { ramp: MARBLE, spec: 0.1, facets: 0, tex: 0.06 };
const M_GOLD: Mat = { ramp: GOLD, spec: 0.75, facets: 0, tex: 0.04 };
const M_GOLDF: Mat = { ramp: GOLD, spec: 0.5, facets: 2, tex: 0.04 };
const M_ROOF: Mat = { ramp: ROOF, spec: 0, facets: 2, tex: 0.1 };

/** Painting context for one depth layer of the city. */
interface Ctx {
  p: Paint;
  sky: Float32Array;
  w: number;
  horizon: number;
  u: number;
  fog: number;
  mist: number;
}

function skyAt(c: Ctx, x: number, y: number): RGB {
  const i = (Math.max(0, Math.min(c.p.fh - 1, y | 0)) * c.w + Math.max(0, Math.min(c.w - 1, x | 0))) * 3;
  return [c.sky[i], c.sky[i + 1], c.sky[i + 2]];
}

/** Atmospheric perspective: blend toward the sky behind, thicker in the low mist. */
function put(c: Ctx, x: number, y: number, col: RGB, al = 1) {
  const f = clamp01(c.fog + c.mist * smooth(c.horizon - 64 * c.u, c.horizon + 2, y));
  c.p.plot(x, y, f > 0 ? mixc(col, skyAt(c, x, y), f) : col, al);
}

type Deco = (x: number, y: number, nr: number, ly: number) => number | RGB | null;

/**
 * Surface of revolution around a vertical axis. r(y) gives the radius per
 * scanline; normals come from the radial offset and the profile slope.
 */
function lathe(c: Ctx, cx: number, y0: number, y1: number, r: (y: number) => number, m: Mat, deco?: Deco) {
  const p = c.p;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    if (y < 0 || y >= p.fh) continue;
    const yc = y + 0.5;
    const rr = r(yc);
    if (!(rr > 0.25)) continue;
    const dr = r(yc + 0.5) - r(yc - 0.5);
    const a = 1 / Math.sqrt(1 + dr * dr);
    const ext = Math.max(rr, 0.5);
    for (let x = Math.floor(cx - ext); x <= Math.ceil(cx + ext); x++) {
      if (x < 0 || x >= p.fw) continue;
      const off = x + 0.5 - cx;
      if (Math.abs(off) > ext) continue;
      const nr = Math.max(-1, Math.min(1, off / rr));
      const f = m.facets;
      const nq = f ? ((Math.min(f - 1, Math.floor(((nr + 1) / 2) * f)) + 0.5) / f) * 2 - 1 : nr;
      const nz = Math.sqrt(Math.max(0, 1 - nq * nq));
      const Nx = nq * a;
      const Ny = -dr * a;
      const Nz = nz * a;
      const dif = Math.max(0, Nx * LX + Ny * LY + Nz * LZ);
      let v = 0.16 + dif * 0.74;
      if (m.spec) v += Math.pow(Math.max(0, Nx * HX + Ny * HY + Nz * HZ), 22) * m.spec;
      const edge = Math.pow(Math.abs(nr), 8);
      v += edge * (nr > 0 ? 0.3 : 0.08);
      if (m.tex) v += (pnoise(x, y, 2.2, 7) - 0.5) * m.tex;
      if (off < -rr + 1 && rr > 2) v -= 0.16;
      let col: RGB | null = null;
      if (deco) {
        const d = deco(x + 0.5, yc, nr, yc - y0);
        if (d !== null) {
          if (typeof d === 'number') v += d;
          else col = d;
        }
      }
      put(c, x, y, col ?? pk(m.ramp, v, x, y));
    }
  }
}

const flat = (r: number) => () => r;
const cone = (apex: number, base: number, r: number) => (y: number) => (r * (y - apex)) / (base - apex);

/** Gothic lancet window test in local coords: dx from axis, ky from window top. */
function lancet(dx: number, ky: number, hw: number, hgt: number): number {
  if (ky < 0 || ky > hgt || Math.abs(dx) > hw) return 0;
  const arch = hw * 1.6;
  if (ky < arch && Math.abs(dx) > hw * (ky / arch) ** 0.6) return 0;
  return ky > hgt * 0.42 ? 2 : 1;
}

function finial(c: Ctx, x: number, y: number, s: number, flag: boolean, seed: number) {
  const pole = 6 * s;
  for (let k = 0; k < pole; k++) put(c, x, y - k, pk(GOLD, 0.65 - k * 0.02, x, y - k));
  lathe(c, x, y - pole - 1.6 * s, y - pole + 1.6 * s, (yy) => Math.sqrt(Math.max(0, (1.4 * s) ** 2 - (yy - (y - pole)) ** 2)), M_GOLD);
  if (!flag || s < 0.72) {
    put(c, x, y - pole - 2 * s, GOLD[7]);
    return;
  }
  // A white pennant, every one streaming the same way in the same breeze.
  const L = 13 * s;
  const ph = hash2(seed, 3, 4) * 6;
  for (let i = 0; i < L; i++) {
    const t = i / L;
    const wv = Math.sin(t * 5 + ph) * 1.2 * s;
    const dw = Math.cos(t * 5 + ph);
    const th = Math.max(0.6, (1 - t) * 2.4 * s);
    const xx = x - 1 - i;
    for (let k = 0; k < th; k++) {
      const yy = y - pole + 1 + wv + k;
      const v = 0.62 + dw * 0.22 - (k / th) * 0.15;
      put(c, xx, yy, k === 0 && i % 3 === 0 ? GOLD[5] : pk(MARBLE, v, xx, yy | 0));
    }
  }
}

/** Distant doves in an immaculate V. */
function birds(c: Ctx, x0: number, y0: number, n: number, s: number) {
  const col = hex('#8a6e48');
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.ceil(i / 2);
    const bx = Math.round(x0 + k * 7 * s);
    const by = Math.round(y0 + side * k * 4 * s);
    const up = (i + 1) % 3 === 0;
    const pts = up
      ? [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]]
      : [[-2, 0], [-1, -1], [0, 0], [1, -1], [2, 0]];
    for (const [dx, dy] of pts) c.p.plot(bx + dx, by + dy, col, 0.75);
    c.p.plot(bx, by + 1, col, 0.5);
  }
}

// ===========================================================================
// Buildings
// ===========================================================================

function tower(c: Ctx, cx: number, base: number, s: number, H: number, seed: number, gold = false) {
  const hw = (4.2 + 3 * hash2(seed, 1, 3)) * s;
  const top = base - H;
  const detail = s > 0.5;
  const band = 17 * s;
  lathe(c, cx, top, base, flat(hw), M_MARBLE, (x, y, nr) => {
    const k = (y - top) % band;
    if (k < 1.2 * s) return 0.2;
    if (k < 2.2 * s) return -0.2;
    if (!detail) return (k > band * 0.5 && k < band * 0.85 && Math.abs(Math.abs(nr) - 0.5) < 0.18) ? WIN_DARK : null;
    const fx = cx + (nr < 0 ? -0.5 : 0.5) * hw;
    const wn = lancet(x - fx, k - 4 * s, Math.max(0.7, 1.1 * s), 10 * s);
    if (wn === 2) return WIN_LIT;
    if (wn === 1) return WIN_DARK;
    if (Math.abs(Math.abs(nr) - 0.0) < 0.06) return 0.12; // corner arris catches the light
    return null;
  });
  // Cornice
  lathe(c, cx, top - 2 * s, top, flat(hw + 1.2 * s), M_MARBLE, (x) => (Math.floor(x / Math.max(1, 1.5 * s)) % 2 ? -0.12 : 0.06));
  // Belfry
  const bt = top - 2 * s - 15 * s;
  const bhw = hw * 0.82;
  lathe(c, cx, bt, top - 2 * s, flat(bhw), M_MARBLE, (x, y, nr) => {
    const fx = cx + (nr < 0 ? -0.5 : 0.5) * bhw;
    const wn = lancet(x - fx, y - bt - 3 * s, Math.max(0.7, bhw * 0.28), 10 * s);
    if (wn) return wn === 2 ? WIN_HOT : WIN_DARK;
    return null;
  });
  // Corner pinnacles
  for (const sd of [-1, 1]) {
    const px = cx + sd * (hw - 0.4 * s);
    const ph = 9 * s;
    lathe(c, px, top - 2 * s - ph, top - 2 * s, cone(top - 2 * s - ph, top - 2 * s, 1.5 * s), M_MARBLE);
    if (detail) put(c, px, top - 3 * s - ph, GOLD[6]);
  }
  // Spire
  const sb = bt - 1.5 * s;
  lathe(c, cx, bt - 1.5 * s, bt, flat(bhw + 0.8 * s), M_GOLDF);
  const sh = hw * (3.6 + 2.6 * hash2(seed, 2, 3));
  const apex = sb - sh;
  lathe(c, cx, apex, sb, cone(apex, sb, bhw * 0.95), gold ? M_GOLDF : M_MARBLE, (_x, y, nr) => {
    if (gold) return null;
    const k = (sb - y) % (7 * s);
    if (k < 1.1 * s) return GOLD[5];
    if (Math.abs(nr) > 0.7 && k < 3 * s) return 0.15; // crockets
    return null;
  });
  finial(c, cx, apex, s, hash2(seed, 5, 3) < 0.55, seed);
}

function domed(c: Ctx, cx: number, base: number, s: number, H: number, seed: number) {
  const bw = (12 + 5 * hash2(seed, 1, 9)) * s;
  const bh = Math.max(14 * s, H * 0.36);
  const bt = base - bh;
  // Base block with a round-headed arcade
  lathe(c, cx, bt, base, flat(bw), M_MARBLE, (x, y, nr) => {
    const k = y - bt;
    if (k < 1.5 * s) return 0.18;
    if (k < 2.5 * s) return -0.18;
    if (s < 0.5) return null;
    const pitch = 5 * s;
    const fx = (frac((x - cx) / pitch) - 0.5) * pitch;
    if (Math.abs(nr) > 0.93) return null;
    const wn = lancet(fx, k - 5 * s, 1.2 * s, Math.min(bh * 0.5, 11 * s));
    if (wn) return wn === 2 ? WIN_LIT : WIN_DARK;
    return null;
  });
  lathe(c, cx, bt - 2 * s, bt, flat(bw + 1 * s), M_MARBLE, (x) => (Math.floor(x / Math.max(1, 1.5 * s)) % 2 ? -0.14 : 0.05));
  // Colonnaded drum
  const drw = bw * 0.64;
  const dh = 12 * s;
  const dt = bt - 2 * s - dh;
  lathe(c, cx, dt, bt - 2 * s, flat(drw), M_DRUM, (_x, _y, nr, ly) => {
    const ph = frac((Math.asin(nr) / Math.PI) * 10 + 0.25);
    if (ph < 0.28) return 0.16;
    if (ly > 3 * s && ly < dh - 1.5 * s && ph > 0.42 && ph < 0.86) return ly > dh * 0.5 ? WIN_LIT : WIN_DARK;
    return null;
  });
  lathe(c, cx, dt - 1.5 * s, dt, flat(drw + 1 * s), M_GOLD);
  // Gilded dome, ribbed
  const Rr = drw * 1.02;
  const Rh = Rr * 1.08;
  const db = dt - 1.5 * s;
  lathe(c, cx, db - Rh, db, (y) => Rr * Math.sqrt(Math.max(0, 1 - ((db - y) / Rh) ** 2)), M_GOLD, (_x, _y, nr) => {
    const ph = frac((Math.asin(nr) / Math.PI) * 8 + 0.5);
    if (ph < 0.1) return 0.2;
    if (ph < 0.2) return -0.14;
    return null;
  });
  // Lantern
  const lw = Rr * 0.2;
  const lt = db - Rh - 7 * s;
  lathe(c, cx, lt, db - Rh + 1, flat(lw), M_DRUM, (_x, _y, nr, ly) => (Math.abs(nr) < 0.35 && ly > 2 * s ? WIN_HOT : null));
  lathe(c, cx, lt - lw, lt, (y) => lw * 1.1 * Math.sqrt(Math.max(0, 1 - ((lt - y) / lw) ** 2)), M_GOLD);
  finial(c, cx, lt - lw, s, false, seed);
}

function needle(c: Ctx, cx: number, base: number, s: number, H: number, seed: number) {
  const hw = 2.3 * s;
  const top = base - H;
  lathe(c, cx, top, base, flat(hw), M_MARBLE, (_x, y) => ((y - top) % (12 * s) < 1.2 * s ? GOLD[4] : null));
  lathe(c, cx, top - 1.5 * s, top, flat(hw + 0.8 * s), M_GOLDF);
  const ph = 7 * s;
  lathe(c, cx, top - 1.5 * s - ph, top - 1.5 * s, cone(top - 1.5 * s - ph, top - 1.5 * s, hw), M_GOLDF);
  finial(c, cx, top - 1.5 * s - ph, s, hash2(seed, 7, 1) < 0.5, seed);
}

function hall(c: Ctx, cx: number, base: number, s: number, H: number, seed: number) {
  const bw = (10 + 8 * hash2(seed, 1, 6)) * s;
  const bh = Math.max(10 * s, H * 0.32);
  const bt = base - bh;
  lathe(c, cx, bt, base, flat(bw), M_FACADE, (x, y) => {
    const k = y - bt;
    if (k < 1.5 * s) return 0.16;
    if (s < 0.5) return null;
    const pitch = 4.5 * s;
    const fx = (frac((x - cx) / pitch) - 0.5) * pitch;
    if (Math.abs(x - cx) > bw - 2 * s) return -0.05;
    const wn = lancet(fx, ((k - 4 * s) % (14 * s)), 0.9 * s, 9 * s);
    if (wn) return wn === 2 ? WIN_LIT : WIN_DARK;
    return null;
  });
  const rh = bw * 0.55;
  lathe(c, cx, bt - rh, bt, cone(bt - rh, bt, bw * 0.96), M_ROOF, (_x, y) => (Math.floor(y / Math.max(1, 2 * s)) % 2 ? -0.06 : 0));
  // Ridge pinnacles at the eaves and apex
  for (const sd of [-1, 1]) {
    const px = cx + sd * (bw - 1 * s);
    lathe(c, px, bt - 7 * s, bt, cone(bt - 7 * s, bt, 1.2 * s), M_MARBLE);
  }
  if (s > 0.5) put(c, cx, bt - rh - 1, GOLD[6]);
}

function buttress(c: Ctx, x0: number, y0: number, x1: number, y1: number, base: number, s: number) {
  // Pier with pinnacle
  lathe(c, x1, y1, base, flat(2 * s), M_MARBLE);
  lathe(c, x1, y1 - 9 * s, y1, cone(y1 - 9 * s, y1, 2 * s), M_MARBLE);
  put(c, x1, y1 - 10 * s, GOLD[6]);
  // Flyer: a straight sloped coping over a quarter-arch springing from the pier
  const span = x1 - x0;
  const ry = y1 - y0;
  const dw = ry * 0.55;
  const th = 2 * s;
  const xa = Math.min(x0, x1);
  const xb = Math.max(x0, x1);
  for (let x = Math.floor(xa); x <= Math.ceil(xb); x++) {
    const t = clamp01((x + 0.5 - x0) / span);
    const topY = y0 + t * (ry - 2 * s);
    const botY = Math.max(topY + th, y0 + dw + (ry - dw) * (1 - Math.sqrt(Math.max(0, 1 - t * t))));
    for (let y = Math.floor(topY); y < botY; y++) {
      const depth = y + 0.5 - topY;
      const v = depth < 1.2 ? 0.95 : botY - y < 1.5 ? 0.3 : 0.6 - depth * 0.02;
      put(c, x, y, pk(MARBLE, v, x, y));
    }
  }
}

function rose(c: Ctx, cx: number, cy: number, r: number) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++)
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy) / r;
      if (d > 1.15) continue;
      const ang = Math.atan2(dy, dx);
      let col: RGB;
      if (d > 0.95) col = pk(MARBLE, dy < 0 ? 0.35 : 0.85, x, y);
      else {
        const seg = frac((ang / (Math.PI * 2)) * 12 + 0.5);
        const lead = Math.abs(d - 0.34) < 0.07 || Math.abs(d - 0.7) < 0.06 || (d > 0.34 && Math.abs(seg - 0.5) < 0.09);
        if (lead) col = pk(MARBLE, 0.7, x, y);
        else {
          const ring = d < 0.34 ? 0 : d < 0.7 ? 1 : 2;
          const par = Math.floor(frac((ang / (Math.PI * 2)) * (ring === 2 ? 24 : 12) + 1) * 2);
          col = ring === 0 ? WIN_HOT : pk(GOLD, (par ? 0.8 : 0.62) + (1 - d) * 0.1, x, y);
        }
      }
      put(c, x, y, col);
    }
}

/** The grand west front: twin spires, flyers, rose window, gilded portals. */
function cathedral(c: Ctx, cx: number, base: number, s: number) {
  const fw = 20 * s;
  const fh = 66 * s;
  const ft = base - fh;
  const tx = fw + 8 * s;
  for (const sd of [-1, 1]) buttress(c, cx + sd * (tx + 4 * s), base - 70 * s, cx + sd * (tx + 26 * s), base - 36 * s, base, s);
  for (const sd of [-1, 1]) tower(c, cx + sd * tx, base, s * 1.15, 104 * s, 900 + sd);
  // Gable
  const gh = 22 * s;
  lathe(c, cx, ft - gh, ft, cone(ft - gh, ft, fw * 0.95), M_FACADE, (x, y) => {
    const k = ft - y;
    if (k < 2 * s) return 0.15;
    const r2 = cone(ft - gh, ft, fw * 0.95)(y);
    if (Math.abs(x - cx) > r2 - 1.6 * s) return 0.2;
    return lancet(x - cx, y - (ft - gh + 7 * s), 1.6 * s, 9 * s) ? WIN_DARK : null;
  });
  finial(c, cx, ft - gh, s, true, 77);
  lathe(c, cx, ft, base, flat(fw), M_FACADE, (x, y) => {
    const k = y - ft;
    const dx = x - cx;
    if (k < 2 * s) return 0.16;
    if (k < 3 * s) return -0.16;
    // Gallery of kings: identical niches
    if (k > 4 * s && k < 13 * s) {
      const fx = (frac(dx / (4 * s)) - 0.5) * 4 * s;
      const wn = lancet(fx, k - 4.5 * s, 1.1 * s, 8 * s);
      if (wn) return wn === 2 ? pk(MARBLE, 0.95, x, y) : WIN_DARK;
      return null;
    }
    // Portals: deep stepped arches with gilded doors
    for (const [px, pw, ph] of [
      [0, 6.5 * s, 28 * s],
      [-13.5 * s, 4 * s, 20 * s],
      [13.5 * s, 4 * s, 20 * s],
    ]) {
      const top = fh - ph;
      if (inGothic(x, y, cx + px - pw, cx + px + pw, base - ph + pw * 1.2, 0.62) && k > top) {
        if (inGothic(x, y, cx + px - pw * 0.55, cx + px + pw * 0.55, base - ph + pw * 1.4, 0.62)) {
          const g = 0.55 + (y - (base - ph)) / ph * 0.4 + (Math.abs(x - cx - px) < 0.6 ? -0.3 : 0);
          return pk(GOLD, g, x, y);
        }
        const ring = Math.floor(((x - cx - px) + pw * 2) / Math.max(1, 1.2 * s)) % 2;
        return ring ? -0.24 : -0.08;
      }
    }
    if (Math.abs(dx) > fw - 2.2 * s) return 0.18; // lit pilaster edge
    return null;
  });
  rose(c, cx, base - 45 * s, 11.5 * s);
}

/** A colonnade running the length of the city's edge, every arch lit. */
function colonnade(c: Ctx, base: number, s: number) {
  const h = 11 * s;
  const top = base - h;
  const pitch = 7 * s;
  for (let y = Math.floor(top - 4 * s); y < base; y++)
    for (let x = 0; x < c.w; x++) {
      const k = y + 0.5 - top;
      const fx = (frac((x + 0.5) / pitch) - 0.5) * pitch;
      let col: RGB;
      if (k < 0) {
        // Balustrade
        const bx = frac((x + 0.5) / (2.2 * s));
        if (k < -3 * s) col = pk(MARBLE, 0.95, x, y);
        else if (k > -1 * s) col = pk(MARBLE, 0.7, x, y);
        else if (bx < 0.5) col = pk(MARBLE, 0.55 + bx * 0.6, x, y);
        else continue;
      } else if (k < 2 * s) col = pk(MARBLE, k < 1 ? 0.95 : 0.5, x, y);
      else if (inGothic(fx, y + 0.5, -pitch * 0.34, pitch * 0.34, top + 2 * s + pitch * 0.45, 0.6)) {
        const depth = (y - top) / h;
        col = pk(GOLD, 0.22 + depth * depth * 0.6, x, y);
        if (Math.abs(fx) > pitch * 0.26) col = mulc(col, 0.85);
      } else {
        const nr = fx / (pitch * 0.5);
        col = pk(MARBLE, 0.6 + (Math.abs(nr) > 0.68 ? (nr > 0 ? -0.12 : 0.22) : 0) + (pnoise(x, y, 2, 4) - 0.5) * 0.08, x, y);
      }
      put(c, x, y, col);
    }
}

interface LayerSpec {
  s: number;
  fog: number;
  mist: number;
  hmin: number;
  hmax: number;
  seed: number;
}

function skyline(c: Ctx, L: LayerSpec, base: number) {
  let x = -10 - hash2(L.seed, 0, 1) * 20;
  let i = 0;
  while (x < c.w + 20) {
    const r = hash2(L.seed, i, 11);
    const H = (L.hmin + (L.hmax - L.hmin) * hash2(L.seed, i, 12)) * c.horizon;
    const sd = L.seed * 100 + i;
    if (r < 0.42) {
      tower(c, x, base, L.s, H * 0.62, sd, hash2(sd, 9, 9) < 0.2);
      x += (13 + hash2(L.seed, i, 13) * 12) * L.s;
    } else if (r < 0.62) {
      domed(c, x + 8 * L.s, base, L.s, H, sd);
      x += (34 + hash2(L.seed, i, 13) * 10) * L.s;
    } else if (r < 0.78) {
      needle(c, x, base, L.s, H * 0.9, sd);
      x += (8 + hash2(L.seed, i, 13) * 8) * L.s;
    } else {
      hall(c, x + 6 * L.s, base, L.s, H, sd);
      x += (24 + hash2(L.seed, i, 13) * 12) * L.s;
    }
    i++;
  }
}

// ===========================================================================
// Below the line: the rot Sanctum stands on
// ===========================================================================

const BLOOD = R(['#22030a', '#3e0612', '#640a1a', '#8e1022', '#bc1628', '#e0262e', '#ff5048', '#ffb0a0']);
const ROOT = R(['#140909', '#22100e', '#341a14', '#4a281c', '#623a28', '#7c5034', '#966a44']);
const IRON = R(['#0a0708', '#151012', '#211a1c', '#302628', '#433636', '#5a4a46', '#7a6458']);
const ROCK = R(['#0b0506', '#160a0b', '#22100f', '#301714', '#40201a', '#522a20', '#683828', '#7e4630']);

interface UCtx {
  p: Paint;
  top: number;
  h: number;
  u: number;
}

/** Darkness thickens with depth. */
function uput(c: UCtx, x: number, y: number, col: RGB, al = 1) {
  const k = smooth(c.top, c.h + 30 * c.u, y) * 0.55;
  c.p.plot(x, y, mixc(col, hex('#080304'), k), al);
}

/** Shaded tube along a polyline; points are [x, y, radius]. */
function tube(c: UCtx, pts: [number, number, number][], rmp: RGB[], spec: number, amb = 0.12) {
  // Light from above (the city glow through the grates)
  const lx = 0.35;
  const ly = -0.75;
  const lz = 0.56;
  for (let s = 0; s + 1 < pts.length; s++) {
    const [ax, ay, ra] = pts[s];
    const [bx, by, rb] = pts[s + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const Ln = Math.sqrt(L2);
    const rm = Math.max(ra, rb, 0.5) + 1;
    for (let y = Math.floor(Math.min(ay, by) - rm); y <= Math.ceil(Math.max(ay, by) + rm); y++)
      for (let x = Math.floor(Math.min(ax, bx) - rm); x <= Math.ceil(Math.max(ax, bx) + rm); x++) {
        const qx = x + 0.5;
        const qy = y + 0.5;
        let t = ((qx - ax) * dx + (qy - ay) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = ra + (rb - ra) * t;
        const sd = ((qx - ax - dx * t) * -dy + (qy - ay - dy * t) * dx) / Ln;
        const dist = Math.hypot(qx - ax - dx * t, qy - ay - dy * t);
        if (dist > Math.max(r, 0.5)) continue;
        const off = r > 0.5 ? Math.max(-1, Math.min(1, sd / r)) : 0;
        const nx = (-dy / Ln) * off;
        const ny = (dx / Ln) * off;
        const nz = Math.sqrt(Math.max(0, 1 - off * off));
        const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
        let v = amb + dif * 0.62;
        if (spec) v += Math.pow(Math.max(0, nx * 0.2 + ny * -0.45 + nz * 0.87), 18) * spec;
        if (r > 1.2 && Math.abs(off) > 0.8) v -= 0.12;
        uput(c, x, y, pk(rmp, v, x, y));
      }
  }
}

function wiggle(x0: number, y0: number, len: number, r0: number, r1: number, sway: number, seed: number, step: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const n = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = y0 + len * t;
    const x = x0 + (fbm(y - y0, seed * 13.7, 22, 31, 0, 2) - 0.5) * sway * 2.4 * Math.min(1, t * 4);
    pts.push([x, y, r0 + (r1 - r0) * t]);
  }
  return pts;
}

function underside(p: Paint, w: number, h: number, horizon: number, u: number, sunX: number) {
  const D = h - horizon;
  const U = Math.min(1, D / 190);
  const c: UCtx = { p, top: horizon, h, u };
  // --- The void ---
  const V0 = hex('#2e0e12');
  const V1 = hex('#1c0809');
  const V2 = hex('#090304');
  p.each(0, horizon, w - 1, h - 1, (x, y, i) => {
    const t = (y - horizon) / D;
    let col = t < 0.35 ? mixc(V0, V1, t / 0.35) : mixc(V1, V2, smooth(0.35, 1, t));
    col = mulc(col, 0.85 + pnoise(x, y * 1.6, 30 * U + 8, 41) * 0.3);
    // Distant sewer vaults, barely there
    if (D > 80) {
      const pitch = 92 * u;
      const fx = (frac(x / pitch) - 0.5) * pitch;
      const vt = horizon + D * 0.42;
      if (y > vt && !inGothic(fx, y, -pitch * 0.38, pitch * 0.38, vt + pitch * 0.4, 0.62)) col = mulc(col, 0.72);
      else if (y > vt && Math.abs(Math.abs(fx) - pitch * 0.38) < 1.2) col = mulc(col, 1.15);
    }
    p.putI(i, col, 1);
  });
  // Red haze where the tethers pool
  for (let k = 0; k < 5; k++) p.glow(hash2(k, 1, 91) * w, horizon + D * (0.4 + hash2(k, 2, 91) * 0.4), 90 * u, hex('#8a1020'), 0.14, 2);

  // --- The plate's gilded rim (mirror-bright) ---
  const rim = Math.max(3, Math.round(5 * u));
  const fascia = Math.max(2, Math.round(4 * u));
  for (let y = horizon; y < horizon + rim + fascia; y++)
    for (let x = 0; x < w; x++) {
      const k = y - horizon;
      let col: RGB;
      if (k === 0) col = hex('#fffbea');
      else if (k < rim) {
        // Reflection of the sky, gilded
        const glint = Math.exp(-(((x - sunX) / (26 * u)) ** 2));
        const wave = pnoise(x, k * 6, 9, 13) * 0.18;
        col = pk(GOLD, 0.82 - (k / rim) * 0.32 + glint * 0.4 + wave, x, y);
      } else {
        const kk = k - rim;
        const dent = Math.floor(x / Math.max(2, 3 * u)) % 2 === 0;
        col = pk(GOLD, kk === 0 ? 0.3 : dent ? 0.55 - kk * 0.08 : 0.38 - kk * 0.08, x, y);
      }
      p.plot(x, y, col);
    }
  const yP = horizon + rim + fascia;
  // Corbel table: little hanging arches of gold going dark
  const cp = Math.max(5, 9 * u);
  const ch = Math.max(2, 5 * u);
  for (let y = yP; y < yP + ch; y++)
    for (let x = 0; x < w; x++) {
      const fx = frac(x / cp);
      const k = (y - yP) / ch;
      const arch = Math.abs(fx - 0.5) * 2;
      if (k > Math.sqrt(Math.max(0, 1 - arch * arch)) && arch > 0.3) continue;
      if (arch < 0.3 && k > 0.9) continue;
      p.plot(x, y, pk(GOLD, 0.34 - k * 0.3 + (fx < 0.5 ? -0.05 : 0.08), x, y));
    }

  // --- The rotten mass Sanctum is built on ---
  const maxRock = Math.max(3, D * 0.3);
  const rockBot = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let d = (10 + 20 * fbm(x, 0, 36, 61, 0, 3)) * U + 2;
    const spike = Math.max(0, pnoise(x, 0, 5 * u + 1, 62) - 0.55) / 0.45;
    d += spike * spike * 22 * U;
    rockBot[x] = yP + Math.min(maxRock, d);
  }
  const RIM_RED = hex('#a0202a');
  for (let x = 0; x < w; x++)
    for (let y = yP; y < rockBot[x]; y++) {
      const fromBot = rockBot[x] - y;
      let v = 0.3 + (fbm(x, y, 7, 63, 0, 3) - 0.5) * 0.55 + (1 - Math.min(1, fromBot / (8 * U + 2))) * 0.35;
      // overhead shelf in deep shadow just under the gold
      if (y - yP < 2) v -= 0.2;
      let col = pk(ROCK, v, x, y);
      if (Math.abs(fbm(x, y, 9, 64, 0, 2) - 0.5) < 0.022) col = BLOOD[2]; // capillaries
      if (fromBot < 1.2) col = mixc(col, RIM_RED, 0.55);
      else if (fromBot < 2.2) col = mixc(col, RIM_RED, 0.22);
      uput(c, x, y, col);
    }
  // Grates: Sanctum's light leaks down through them
  const ng = Math.max(2, Math.round(w / 140));
  for (let g = 0; g < ng; g++) {
    const gx = ((g + 0.5) / ng) * w + (hash2(g, 1, 71) - 0.5) * 50 * u;
    const gw = Math.round(9 * u + 3);
    const gy = yP + 1;
    const gh = Math.max(3, Math.round(6 * u));
    for (let y = gy; y < gy + gh; y++)
      for (let x = Math.round(gx - gw); x <= gx + gw; x++) {
        const bar = (x - Math.round(gx - gw)) % 3 === 0 || y === gy || y === gy + gh - 1;
        p.plot(x, y, bar ? IRON[2] : pk(GOLD, 0.8 - ((y - gy) / gh) * 0.4, x, y));
      }
    // Dusty shaft of light
    const sb = Math.min(h, gy + D * 0.75);
    p.each(gx - gw * 3, gy + gh, gx + gw * 3, sb, (x, y, i) => {
      const t = (y - gy) / (sb - gy);
      const hw = gw * (1 + t * 1.6);
      const d = Math.abs(x - gx - t * 10 * u) / hw;
      if (d >= 1) return;
      const bars = 0.7 + 0.3 * Math.cos(((x - gx) / 3) * Math.PI * 2);
      const dust = 0.7 + 0.6 * pnoise(x, y * 0.3, 5, 70 + g);
      p.addI(i, hex('#e8b060'), 0.2 * (1 - d * d) * (1 - t) * bars * dust);
    });
  }

  // --- Hanging things ---
  const rockAt = (x: number) => rockBot[Math.max(0, Math.min(w - 1, Math.round(x)))] - 1;
  // Roots
  const nRoots = Math.round(w / 22);
  for (let k = 0; k < nRoots; k++) {
    const x0 = hash2(k, 1, 81) * w;
    const len = (0.12 + hash2(k, 2, 81) * 0.35) * D;
    const r0 = (1 + hash2(k, 3, 81) * 2) * u;
    const pts = wiggle(x0, rockAt(x0), len, r0, 0.3, 5 * u, k + 0.3, 3);
    tube(c, pts, ROOT, 0.1);
    if (hash2(k, 4, 81) < 0.6 && pts.length > 4) {
      const j = Math.floor(pts.length * 0.4);
      const [bx, by] = pts[j];
      tube(c, wiggle(bx, by, len * 0.4, r0 * 0.5, 0.3, 4 * u, k + 7.1, 3), ROOT, 0.1);
    }
  }
  // Pipes
  const nPipes = Math.max(2, Math.round(w / 90));
  for (let k = 0; k < nPipes; k++) {
    const x0 = ((k + 0.3 + hash2(k, 1, 83) * 0.4) / nPipes) * w;
    const y0 = rockAt(x0) - 2;
    const r = (2.2 + hash2(k, 2, 83) * 1.6) * u;
    const l1 = (0.15 + hash2(k, 3, 83) * 0.3) * D;
    const bend = (hash2(k, 4, 83) < 0.5 ? -1 : 1) * (12 + hash2(k, 5, 83) * 20) * u;
    const l2 = (0.1 + hash2(k, 6, 83) * 0.3) * D;
    const pts: [number, number, number][] = [
      [x0, y0, r],
      [x0, y0 + l1, r],
      [x0 + bend, y0 + l1 + Math.abs(bend), r],
      [x0 + bend, y0 + l1 + Math.abs(bend) + l2, r],
    ];
    tube(c, pts, IRON, 0.35, 0.14);
    // Flanges
    for (const [fx, fy] of [
      [x0, y0 + l1 * 0.5],
      [x0 + bend, y0 + l1 + Math.abs(bend) + l2 * 0.5],
    ])
      tube(c, [[fx, fy - u, r + 1.2 * u], [fx, fy + u, r + 1.2 * u]], IRON, 0.3, 0.2);
    // Broken mouth, leaking
    const ex = x0 + bend;
    const ey = y0 + l1 + Math.abs(bend) + l2;
    for (let x = Math.round(ex - r); x <= ex + r; x++) uput(c, x, Math.round(ey), IRON[0]);
    tube(c, wiggle(ex, ey, Math.min(h - ey, D * 0.25), r * 0.45, 0.4, 1.5 * u, k + 3.7, 4), BLOOD, 0.8, 0.2);
  }
  // Blood tethers: one from every home, all the way down
  const nVeins = Math.round(w / 24);
  for (let k = 0; k < nVeins; k++) {
    const x0 = ((k + hash2(k, 1, 87)) / nVeins) * w;
    const full = hash2(k, 2, 87) < 0.45;
    const len = full ? h - horizon - rim : (0.2 + hash2(k, 3, 87) * 0.55) * D;
    const r0 = ((full ? 1.4 : 0.8) + hash2(k, 4, 87) * 1.2) * u;
    const y0 = horizon + rim + fascia - 1;
    p.glow(x0, y0 + len * 0.4, 14 * u + 4, hex('#c0182a'), 0.05, 2);
    const pts = wiggle(x0, y0, len, r0, full ? r0 * 0.7 : 0.35, 9 * u, k + 0.77, 3);
    tube(c, pts, BLOOD, 0.9, 0.22);
    if (!full) {
      // A drop gathering at the end, and one falling
      const [ex, ey] = pts[pts.length - 1];
      tube(c, [[ex, ey, 0.6 * u + 0.4], [ex, ey + 1.5 * u, 1.1 * u + 0.4]], BLOOD, 0.9, 0.25);
      const fy = ey + (6 + hash2(k, 5, 87) * 30) * u;
      if (fy < h - 2) tube(c, [[ex, fy, 0.5], [ex, fy + 2 * u, 0.8 * u]], BLOOD, 0.9, 0.3);
    }
    if (hash2(k, 6, 87) < 0.5 && pts.length > 5) {
      const j = Math.floor(pts.length * (0.2 + hash2(k, 7, 87) * 0.3));
      const [bx, by] = pts[j];
      tube(c, wiggle(bx, by, len * 0.3, r0 * 0.5, 0.3, 5 * u, k + 9.9, 3), BLOOD, 0.8, 0.2);
    }
  }
}

// ===========================================================================
// Sanctum
// ===========================================================================

/**
 * Key art: Sanctum, golden and sinless, above; the red tethers running down
 * from every home into the dark beneath.
 */
function sanctum(w: number, h: number, horizon: number): PixelCanvas {
  const p = new Paint(w, h, 1, false);
  const u = horizon / 168;
  const sun = { x: w * 0.72, y: horizon * 0.3, r: 12 * u + 2 };

  // --- Sky: dithered gold, cirrus, rays ---
  p.each(0, 0, w - 1, horizon, (x, y, i) => {
    const t = y / horizon;
    const ds = Math.hypot(x - sun.x, (y - sun.y) * 1.25) / (w * 0.5);
    const near = Math.exp(-ds * ds * 3);
    let v = 0.06 + 0.66 * Math.pow(t, 0.85) + 0.5 * near;
    v += (fbm(x * 0.3, y * 2.4, 34, 11, 0, 2) - 0.5) * 0.22 * (1 - t * 0.6);
    const ang = Math.atan2(y - sun.y, x - sun.x);
    v += (pnoise(ang * 22, 0.5, 1, 23) - 0.5) * 0.2 * Math.exp(-ds * 1.2);
    p.putI(i, pk(SKY, v, x, y), 1);
    // The eternal sun bleeds into everything around it
    const g = 1 - ds;
    if (g > 0) p.addI(i, GLARE, 0.3 * g * g * g);
  });
  // The sun and its perfect rings
  p.glow(sun.x, sun.y, sun.r * 4, hex('#ffffff'), 0.6, 2);
  p.each(sun.x - sun.r * 4, sun.y - sun.r * 4, sun.x + sun.r * 4, sun.y + sun.r * 4, (x, y, i) => {
    const d = Math.hypot(x - sun.x, y - sun.y) / sun.r;
    if (d <= 1) p.putI(i, hex('#ffffff'), 1);
    else if (Math.abs(d - 1.9) < 0.07 || Math.abs(d - 2.9) < 0.05) p.addI(i, hex('#ffffff'), 0.45);
    else if (Math.abs(d - 3.8) < 0.04) p.addI(i, hex('#fff4d0'), 0.25);
  });
  const sky = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    sky[i * 3] = p.r[i];
    sky[i * 3 + 1] = p.g[i];
    sky[i * 3 + 2] = p.b[i];
  }
  const ctx = (fog: number, mist: number): Ctx => ({ p, sky, w, horizon, u, fog, mist });
  birds(ctx(0, 0), w * 0.18, horizon * 0.22, 9, u);
  birds(ctx(0, 0), w * 0.42, horizon * 0.12, 5, u * 0.7);

  // --- The city, layer by layer into the haze ---
  const layers: LayerSpec[] = [
    { s: 0.42 * u, fog: 0.8, mist: 0.15, hmin: 0.4, hmax: 0.95, seed: 3 },
    { s: 0.58 * u, fog: 0.62, mist: 0.25, hmin: 0.3, hmax: 0.75, seed: 5 },
    { s: 0.78 * u, fog: 0.4, mist: 0.35, hmin: 0.22, hmax: 0.55, seed: 8 },
    { s: 1.0 * u, fog: 0.16, mist: 0.4, hmin: 0.14, hmax: 0.42, seed: 13 },
  ];
  for (const L of layers) skyline(ctx(L.fog, L.mist), L, horizon - 6 * u);
  // Heroes of the nearest rank
  const near = ctx(0.08, 0.32);
  domed(near, w * 0.6, horizon, 1.45 * u, 70 * u, 51);
  tower(near, w * 0.79, horizon, 0.9 * u, 108 * u, 52, true);
  cathedral(near, w * 0.3, horizon, u);
  colonnade(ctx(0.04, 0.12), horizon, u);

  // --- Glare: the light is too much ---
  p.each(0, 0, w - 1, horizon, (x, y, i) => {
    const d = Math.hypot(x - sun.x, y - sun.y);
    const g = Math.exp(-((d / (70 * u)) ** 2)) * 0.32 + Math.exp(-(((y - sun.y) / (2.2 * u)) ** 2)) * Math.exp(-(((x - sun.x) / (w * 0.35)) ** 2)) * 0.35;
    if (g > 0.01) p.addI(i, hex('#fffbea'), g);
  });

  underside(p, w, h, horizon, u, sun.x);
  return p.toPixelCanvas(40);
}

// ===========================================================================
// Portrait
// ===========================================================================

const PORTRAIT_LIGHT: Light = { x: 0.55, y: -0.7, z: 0.6, ambient: 0.2, rim: 0.5 };

/** A single citizen in close-up for the succession card: smiling, then not. */
function portrait(skin: string, hair: string, weeping: boolean): PixelCanvas {
  const S = 64;
  const fig = new Figure(S, S);
  const skinR = ramp([darken(skin, 0.7), darken(skin, 0.42), darken(skin, 0.15), skin, lighten(skin, 0.3), lighten(skin, 0.62)], 7);
  const skinM: Material = { ramp: skinR, spec: 0.22, tex: grain(2, 0.03, 5), line: darken(skin, 0.78) };
  const hairR = ramp([darken(hair, 0.75), darken(hair, 0.4), hair, lighten(hair, 0.3), lighten(hair, 0.55)], 6);
  const hairM: Material = {
    ramp: hairR,
    spec: 0.35,
    tex: (x, y) => Math.sin(x * 1.25 + Math.sin(y * 0.3) * 1.5) * 0.08 + (valueNoise(x, y, 1.5, 9) - 0.5) * 0.08,
    line: darken(hair, 0.85),
  };
  const robeM: Material = { ramp: ['#3e362e', '#5e564b', '#857a6a', '#aa9e8a', '#cdc2ac', '#e8dfcc', '#f8f2e4'], tex: grain(3, 0.06, 2), line: '#2a221c' };
  const goldM: Material = { ramp: [P.gold3, '#9a6e22', P.gold2, P.gold1, P.gold0, '#ffffff'], spec: 0.8, line: '#3e240a' };

  const cx = 32;
  // Hair volume behind the head
  fig.ellipse(cx, 25, 16, 16, hairM, 0);
  fig.capsule(cx - 13, 24, cx - 13, 41, 4.5, 3.5, hairM, 0);
  fig.capsule(cx + 13, 24, cx + 13, 41, 4.5, 3.5, hairM, 0);
  // Neck and chest
  fig.capsule(cx, 40, cx, 60, 6, 9, skinM, 1);
  // Robe with a V neck
  fig.add(
    (x, y) => {
      if (y < 48) return false;
      const sh = 48 + Math.abs(x - cx) * 0.18;
      if (y < sh) return false;
      const half = 10 + (y - 48) * 1.6;
      if (Math.abs(x - cx) > Math.min(30, half)) return false;
      return Math.abs(x - cx) > Math.max(0, 7 - (y - 48) * 0.55);
    },
    robeM,
    2,
    [0, 46, S - 1, S - 1],
  );
  // Ears
  fig.ellipse(cx - 13, 29, 2.6, 4, skinM, 2);
  fig.ellipse(cx + 13, 29, 2.6, 4, skinM, 2);
  // Head: cranium + jaw
  fig.add(
    (x, y) => {
      const a = ((x - cx) / 12.5) ** 2 + ((y - 25) / 14) ** 2 <= 1;
      const b = ((x - cx) / 9.5) ** 2 + ((y - 35) / 8.5) ** 2 <= 1;
      return a || b;
    },
    skinM,
    3,
    [cx - 13, 10, cx + 13, 44],
  );
  // Hair cap, neatly parted down the middle
  fig.add(
    (x, y) => {
      if (((x - cx) / 13.6) ** 2 + ((y - 23) / 14.5) ** 2 > 1) return false;
      const dx = Math.abs(x - cx);
      const line = 16.5 + dx * 0.32 - (dx > 9 ? (dx - 9) * 1.4 : 0) + Math.sin(dx * 0.9) * 0.6;
      if (dx > 10.5 && y < 30) return true;
      return y < line;
    },
    hairM,
    4,
    [cx - 14, 8, cx + 14, 32],
  );
  // Gold collar trim along the neckline
  fig.stain((x, y) => y >= 48 && Math.abs(Math.abs(x - cx) - Math.max(0, 7 - (y - 48) * 0.55)) < 1.6 && y < 58, goldM, [robeM]);
  fig.stain((x, y) => y >= 47 && y < 50 && Math.abs(x - cx) > 7 && Math.abs(x - cx) < 18, goldM, [robeM]);

  const body = fig.render(PORTRAIT_LIGHT);
  const pc = new PixelCanvas(S, S);

  // Halo behind the head
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - 24;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - 22) > 1.3) continue;
      const ang = Math.atan2(dy, dx);
      if (weeping && Math.abs(ang + 0.9) < 0.12) continue; // cracked
      let v = 0.5 + Math.cos(ang + 0.9) * 0.4 + (d < 22 ? 0.1 : -0.1);
      if (weeping) v -= 0.3;
      const n = goldM.ramp.length;
      const f = clamp01(v) * (n - 1) * 0.999;
      let k = Math.floor(f);
      if (f - k > bayer(x, y)) k++;
      pc.px(x, y, goldM.ramp[Math.min(n - 1, k)]);
    }
  pc.blit(body, 0, 0);

  // --- Face, painted by hand over the shaded head ---
  const k = (i: number) => skinR[Math.max(0, Math.min(skinR.length - 1, i))];
  const ink = darken(skin, 0.85);
  const dot = (x: number, y: number, c: string) => pc.px(x, y, c);
  const shade = (x: number, y: number, t: number) => {
    const i = (y * S + x) * 4;
    if (pc.data[i + 3] === 0) return;
    const hx = '#' + [pc.data[i], pc.data[i + 1], pc.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    pc.px(x, y, mix(hx, P.ink, t));
  };
  // Eye sockets & brow shadow
  for (const ex of [cx - 5, cx + 5])
    for (let y = 25; y <= 31; y++)
      for (let x = ex - 4; x <= ex + 4; x++) {
        const d = ((x - ex) / 4.2) ** 2 + ((y - 28) / 3) ** 2;
        if (d < 1 && bayer(x, y) < (1 - d) * 0.9) shade(x, y, 0.14);
      }
  // Nose: lit ridge, shadowed underside and the side away from the sun
  for (let y = 27; y <= 33; y++) dot(cx + 1, y, k(5));
  dot(cx + 2, 32, k(6));
  dot(cx - 1, 31, k(2));
  dot(cx - 1, 32, k(2));
  dot(cx - 2, 33, k(1));
  dot(cx - 1, 34, k(1));
  dot(cx, 34, k(1));
  dot(cx + 1, 34, k(2));
  dot(cx + 2, 34, k(1));
  dot(cx - 2, 34, ink);
  dot(cx + 3, 33, k(2));

  if (!weeping) {
    // Brows lifted in rapture
    for (const [ex, sd] of [
      [cx - 5, -1],
      [cx + 5, 1],
    ] as const)
      for (let i = -3; i <= 3; i++) dot(ex + i, 22 - Math.round(Math.cos((i / 3) * 1.3) * 1.5) + (i * sd > 2 ? 1 : 0), darken(hair, 0.35));
    // Eyes squeezed into joyful crescents
    for (const ex of [cx - 5, cx + 5]) {
      for (let i = -3; i <= 3; i++) dot(ex + i, 28 - (Math.abs(i) < 2 ? 1 : 0) + (Math.abs(i) === 3 ? 1 : 0), ink);
      for (let i = -2; i <= 2; i++) dot(ex + i, 30, k(5)); // swollen cheek below
      dot(ex + 1, 31, k(6));
    }
    // Blush, waxy and even
    for (const bx of [cx - 7, cx + 7])
      for (let y = 31; y <= 34; y++)
        for (let x = bx - 2; x <= bx + 2; x++) if (bayer(x, y) < 0.55 && ((x - bx) / 2.5) ** 2 + ((y - 32.5) / 1.8) ** 2 < 1) dot(x, y, mix(skin, P.flesh2, 0.45));
    dot(cx + 8, 31, lighten(skin, 0.75));
    dot(cx - 6, 31, lighten(skin, 0.5));
    // Smile lines carved deep
    for (const sd of [-1, 1]) {
      dot(cx + sd * 4, 34, k(1));
      dot(cx + sd * 5, 35, k(1));
      dot(cx + sd * 6, 36, k(1));
      dot(cx + sd * 6, 37, k(2));
    }
    // A smile far too wide, every tooth identical
    for (let x = cx - 6; x <= cx + 6; x++) {
      const dx = Math.abs(x - cx);
      const up = dx > 4 ? dx - 4 : 0;
      const yTop = 37 - up;
      const yBot = 40 - Math.floor(up * 1.2) - (dx > 5 ? 0 : 0);
      dot(x, yTop - 1, k(1)); // upper lip shadow
      dot(x, yTop, ink);
      for (let y = yTop + 1; y < yBot; y++) dot(x, y, (x - cx) % 2 === 0 && y === yTop + 1 ? '#cdbfa6' : y === yBot - 1 ? '#b3a68e' : '#f4efe2');
      dot(x, yBot, ink);
      if (dx < 5) dot(x, yBot + 1, dx < 3 ? k(5) : k(4)); // lower lip catching light
    }
    dot(cx - 7, 35, ink);
    dot(cx + 7, 35, ink);
    dot(cx + 1, 42, k(5));
  } else {
    // Brows torn upward in the middle
    for (const [ex, sd] of [
      [cx - 5, -1],
      [cx + 5, 1],
    ] as const)
      for (let i = -3; i <= 3; i++) dot(ex + i, 23 + Math.round((i * sd) / 2.2), darken(hair, 0.35));
    // Eyes open too wide: veined whites, pinprick pupils
    for (const ex of [cx - 5, cx + 5]) {
      for (let y = 26; y <= 30; y++)
        for (let x = ex - 3; x <= ex + 3; x++) {
          const d = ((x - ex) / 3.3) ** 2 + ((y - 28) / 2.1) ** 2;
          if (d > 1) continue;
          dot(x, y, d > 0.6 && hash2(x, y, 4) < 0.5 ? '#e0a8a0' : y <= 26 ? '#c8bcae' : '#f2ece0');
        }
      for (let x = ex - 3; x <= ex + 3; x++) dot(x, 25 + (Math.abs(x - ex) === 3 ? 1 : 0), ink);
      dot(ex, 28, P.blood3);
      dot(ex + 1, 28, P.blood2);
      dot(ex, 27, P.blood2);
      dot(ex - 1, 28, P.blood2);
      dot(ex, 29, P.blood2);
      dot(ex, 28, P.ink);
      dot(ex + 1, 27, P.white);
      for (let x = ex - 3; x <= ex + 3; x++) dot(x, 31, P.blood2); // lower lid brimming
    }
    // Tears of blood down both cheeks, to the jaw and beyond
    const tear = (x0: number, len: number, sway: number) => {
      let x = x0;
      for (let y = 31; y < 31 + len; y++) {
        if (hash2(x0, y, 21) < sway) x += hash2(x0, y, 22) < 0.5 ? -1 : 1;
        dot(x, y, y % 5 === 0 ? P.blood0 : P.blood1);
        dot(x + 1, y, P.blood3);
      }
      const ey = 31 + len;
      dot(x, ey, P.blood1);
      dot(x - 1, ey, P.blood2);
      dot(x + 1, ey, P.blood2);
      dot(x, ey + 1, P.blood2);
      dot(x - 1, ey - 1, P.blood0);
    };
    tear(cx - 7, 14, 0.18);
    tear(cx - 3, 3, 0.1);
    tear(cx + 4, 4, 0.12);
    tear(cx + 7, 17, 0.22);
    // Mouth fallen open
    for (let y = 37; y <= 41; y++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        const d = ((x - cx) / 4.2) ** 2 + ((y - 39) / 2.3) ** 2;
        if (d > 1) continue;
        dot(x, y, y === 37 && Math.abs(x - cx) < 3 ? '#b3a68e' : d > 0.6 ? P.ink2 : P.ink);
      }
    dot(cx - 5, 40, ink);
    dot(cx + 5, 40, ink);
    for (let x = cx - 3; x <= cx + 3; x++) dot(x, 42, k(5));
    dot(cx - 4, 41, P.blood1);
    dot(cx - 4, 42, P.blood2);
    dot(cx - 4, 43, P.blood1);
  }
  return pc;
}

export function buildVignettes(scene: Phaser.Scene) {
  registerImage(scene, 'sanctum', sanctum(640, 360, 168));
  registerImage(scene, 'sanctum-wide', sanctum(420, 140, 120));
}

export function buildPortraits(scene: Phaser.Scene, skin: string, hair: string) {
  registerImage(scene, 'portrait-smile', portrait(skin, hair, false));
  registerImage(scene, 'portrait-weep', portrait(skin, hair, true));
}
