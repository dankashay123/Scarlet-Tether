import { PixelCanvas, bayer, hash2 } from '../pixel';
import { Paint, type RGB, clamp01, fbm, hex, inGothic, inRound, mixc, mulc, pnoise, smooth } from './paint';
import { drawBooth, drawCandelabra, drawSaint } from './props';

/**
 * Parallax backdrops. Every layer is 640x360 and wraps horizontally (all
 * noise is periodic over 640 px and every shape is drawn with wrapping).
 *
 * The marble and rot versions of each layer share one geometry function, so
 * silhouettes line up when the game crossfades between the lie and the truth.
 */

const W = 640;
const H = 360;

const R = (cs: string[]) => cs.map(hex);

function pk(p: Paint, ramp: RGB[], v: number, x: number, y: number): RGB {
  const n = ramp.length;
  const f = clamp01(v) * (n - 1) * 0.9999;
  let i = Math.floor(f);
  if (f - i > bayer(Math.floor(x / p.s), Math.floor(y / p.s))) i++;
  return ramp[Math.min(n - 1, i)];
}

/** Wrapped horizontal distance. */
const wd = (a: number, b: number) => {
  let d = (((a - b) % W) + W) % W;
  if (d > W / 2) d -= W;
  return d;
};

interface NaveTheme {
  rot: boolean;
  sky: RGB;
  fog: RGB;
  haze: RGB;
  floor: RGB;
  far: RGB[];
  frame: RGB[];
  glow: RGB;
  glow2: RGB;
  candle: RGB;
  pillar: RGB[];
  accent: RGB[];
  membrane: RGB[];
  dark: RGB;
}

const MARBLE_T: NaveTheme = {
  rot: false,
  sky: hex('#050307'),
  fog: hex('#2a2226'),
  haze: hex('#5e4a40'),
  floor: hex('#0d090b'),
  far: R(['#141014', '#1b161a', '#241e22', '#2f282b', '#3c3336', '#4c4040']),
  frame: R(['#0b0709', '#110c0e', '#181214', '#20181a', '#2a2022', '#382a2a', '#4a3832', '#64503c']),
  glow: hex('#ffb45a'),
  glow2: hex('#c8282a'),
  candle: hex('#ffbe6a'),
  pillar: R(['#0a0708', '#120d0e', '#1a1415', '#241b1c', '#302425', '#40302e', '#544036', '#6e5640', '#8c7050']),
  accent: R(['#2e1d06', '#5a3c12', '#8a6420', '#b98a2e', '#e8c25a']),
  membrane: R(['#1a0c10', '#2a1418', '#3a1c20']),
  dark: hex('#0a0608'),
};

const ROT_T: NaveTheme = {
  rot: true,
  sky: hex('#070102'),
  fog: hex('#2e0c10'),
  haze: hex('#62201c'),
  floor: hex('#0e0305'),
  far: R(['#1a080b', '#220b0e', '#2c1012', '#381616', '#461d1b', '#562620']),
  frame: R(['#0c0304', '#140608', '#1e090c', '#2a0e11', '#381416', '#4a1c1a', '#60281f', '#7a3a28']),
  glow: hex('#ff6040'),
  glow2: hex('#ff2030'),
  candle: hex('#ff8a50'),
  pillar: R(['#0c0605', '#150c09', '#20140e', '#2e1d14', '#3e2a1c', '#523824', '#6a4a30', '#86623e', '#a27e52']),
  accent: R(['#3e3220', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf']),
  membrane: R(['#2a060c', '#4a0e18', '#6a1a22', '#8a2a2c', '#b04038']),
  dark: hex('#0c0304'),
};

// ===========================================================================
// FAR: the vast nave, rose window, light shafts, distant arcades
// ===========================================================================

const ROSE = { x: 320, y: 88, r: 50 };
const FRAME_P = [160, 480];
const FRAME_HW = 24;

function frameSolid(x: number, y: number): boolean {
  if (y >= 318) return false;
  const u = ((x % W) + W) % W;
  // openings between the two frame pillars
  if (inGothic(u, y, FRAME_P[0] + FRAME_HW, FRAME_P[1] - FRAME_HW, 128, 0.6)) return false;
  const u2 = u < FRAME_P[0] ? u + W : u;
  if (inGothic(u2, y, FRAME_P[1] + FRAME_HW, FRAME_P[0] + W - FRAME_HW, 128, 0.6)) return false;
  return true;
}

function arcadeSolid(x: number, y: number, rot: boolean): boolean {
  if (y < 150 || y >= 318) return false;
  let u = ((x % 64) + 64) % 64;
  if (rot) u = (u + Math.sin(((y - 150) / 168) * Math.PI) * 3 + 64) % 64;
  if (y < 186) return !(inRound(u, y, 12, 28, 166) || inRound(u, y, 36, 52, 166));
  if (y < 196) return true;
  return !inGothic(u, y, 7, 57, 226, 0.62);
}

function drawRose(p: Paint, t: NaveTheme) {
  const { x: cx, y: cy, r } = ROSE;
  p.glow(cx, cy, 230, t.glow, 0.32, 2.2);
  p.glow(cx, cy, 90, t.glow2, 0.25, 1.5);
  p.each(cx - r - 6, cy - r - 6, cx + r + 6, cy + r + 6, (x, y, i) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy) / r;
    if (d > 1.1) return;
    const ang = Math.atan2(dy, dx);
    if (d > 0.94) {
      p.putI(i, pk(p, t.frame, 0.45 + (dy < 0 ? 0.15 : 0), x, y), 1);
      return;
    }
    if (!t.rot) {
      const seg = ((ang / (Math.PI * 2)) * 12 + 12.5) % 1;
      const seg2 = ((ang / (Math.PI * 2)) * 24 + 24) % 1;
      const lead =
        Math.abs(d - 0.32) < 0.035 || Math.abs(d - 0.66) < 0.035 || (d > 0.32 && Math.abs(seg - 0.5) < 0.07) || (d > 0.66 && Math.abs(seg2 - 0.5) < 0.09);
      if (lead) {
        p.putI(i, mulc(t.frame[2], 1.2), 1);
        return;
      }
      const ring = d < 0.32 ? 0 : d < 0.66 ? 1 : 2;
      const parity = Math.floor(((ang / (Math.PI * 2)) * (ring === 2 ? 24 : 12) + 48) % 2);
      let c: RGB = ring === 0 ? hex('#ffe08a') : ring === 1 ? (parity ? hex('#e8a040') : hex('#b8202a')) : parity ? hex('#a01828') : hex('#d88a3a');
      const k = 0.75 + 0.35 * pnoise(x, y, 6, 4) - d * 0.2;
      c = mulc(c, k);
      p.putI(i, c, 1);
    } else {
      // An enormous eye: striated iris, black pupil, puckered lids
      const str = 0.5 + 0.5 * Math.sin(ang * 46 + pnoise(x, y, 5, 3) * 6);
      if (d < 0.26) {
        p.putI(i, d > 0.2 ? hex('#5a0a10') : hex('#050102'), 1);
        return;
      }
      let c: RGB;
      if (d < 0.8) c = mixc(hex('#ffcc60'), hex('#c0202a'), smooth(0.26, 0.8, d));
      else c = mixc(hex('#7a2a30'), hex('#3a0e14'), (d - 0.8) / 0.14);
      c = mulc(c, 0.65 + str * 0.45);
      if (Math.abs(pnoise(x, y, 9, 8) - 0.5) < 0.03 && d > 0.5) c = hex('#3a0610');
      p.putI(i, c, 1);
    }
  });
  // A thin gold/bone tracery cross over the window
  if (!t.rot) p.rect(cx - 1, cy - r, cx + 1, cy + r, mulc(t.frame[3], 1), 0.6);
}

function shafts(p: Paint, sx: number, sy: number, beams: [number, number, number][], c: RGB, yEnd: number, seed: number, fadeK = 0.65, dustK = 0.8, grow = 2.2) {
  for (const [slope, w0, amt] of beams) {
    const x0 = Math.min(sx, sx + slope * (yEnd - sy)) - 120;
    const x1 = Math.max(sx, sx + slope * (yEnd - sy)) + 120;
    p.each(x0, sy, x1, yEnd, (x, y, i) => {
      const k = (y - sy) / (yEnd - sy);
      const ax = sx + slope * (y - sy);
      const hw = w0 + k * w0 * grow;
      const d = Math.abs(x - ax) / hw;
      if (d >= 1) return;
      const f = (1 - d * d) ** 2;
      const dust = 1 - dustK / 2 + dustK * pnoise(x - slope * y, y * 0.25, 8, seed, W);
      const fade = Math.min(1, k * 6) * (1 - k * fadeK);
      p.addI(i, c, amt * f * dust * fade);
    });
  }
}

function farNave(t: NaveTheme): PixelCanvas {
  const p = new Paint(W, H, 2);
  // Base gradient: black vaults fading into warm incense fog
  p.all((x, y, i) => {
    let c = y < 250 ? mixc(t.sky, t.fog, Math.pow(y / 250, 1.25)) : mixc(t.fog, t.haze, smooth(250, 318, y));
    c = mulc(c, 0.82 + fbm(x, y, 48, 3, W, 3) * 0.36);
    p.putI(i, c, 1);
  });
  // Back wall: faint ashlar or membrane, clerestory lancets
  p.each(0, 0, W - 1, 150, (x, y, i) => {
    const k = 0.92 + 0.12 * pnoise(x, y, 20, 5, W);
    let c: RGB = [p.r[i] * k, p.g[i] * k, p.b[i] * k];
    if (!t.rot) {
      const row = Math.floor(y / 22);
      if (y % 22 < 2 || (x + row * 18) % 36 < 2) c = mulc(c, 0.84);
    } else if (Math.abs(fbm(x, y, 30, 9, W, 2) - 0.5) < 0.02) c = mulc(c, 0.6);
    p.putI(i, c, 1);
  });
  for (let k = 0; k < 10; k++) {
    const cx = 32 + k * 64;
    if (Math.abs(cx - ROSE.x) < 100) continue;
    p.each(cx - 8, 60, cx + 8, 140, (x, y, i) => {
      if (!inGothic(x, y, cx - 5, cx + 5, 78, 0.7) || y > 136) return;
      const v = 0.35 + 0.25 * (1 - (y - 60) / 80);
      p.putI(i, mixc(mixc(t.glow2, t.glow, 0.35), t.fog, 0.45), v + 0.25);
    });
    p.glow(cx, 100, 28, t.glow2, 0.08);
  }
  drawRose(p, t);
  // Distant arcade, softened by fog
  p.each(0, 148, W - 1, 318, (x, y, i) => {
    const glowK = Math.exp(-((wd(x, ROSE.x) / 190) ** 2));
    if (arcadeSolid(x, y, t.rot)) {
      let v = 0.32 + glowK * 0.3 + (pnoise(x, y, 6, 2, W) - 0.5) * 0.2;
      const dir = wd(ROSE.x, x) > 0 ? 1 : -1;
      if (!arcadeSolid(x + dir * 2, y, t.rot)) v += 0.18 * (0.4 + glowK);
      if (y >= 186 && y < 189) v += 0.15;
      const c = mixc(pk(p, t.far, v, x, y), t.fog, 0.25 + 0.3 * smooth(200, 318, y));
      p.putI(i, c, 1);
    } else {
      let c: RGB = mulc([p.r[i], p.g[i], p.b[i]], 0.62);
      if (t.rot && y > 196) {
        c = mixc(c, t.membrane[2], 0.3);
        if (Math.abs(pnoise(x, y, 12, 4, W) - 0.5) < 0.025) c = t.membrane[0];
      }
      p.putI(i, c, 1);
    }
  });
  // Distant candles crowding the arcade floor
  for (let k = 0; k < 10; k++)
    for (let j = 0; j < 4; j++) {
      const x = k * 64 + 14 + hash2(k, j, 5) * 36;
      const y = 296 + hash2(k, j, 6) * 14;
      p.glow(x, y - 2, 18, t.candle, 0.32);
      p.rect(x - 1, y - 3, x + 1, y + 1, mixc(t.candle, hex('#fff8dc'), 0.5), 0.9);
    }
  // Light shafts from the rose window
  shafts(p, ROSE.x, ROSE.y + 20, [[-0.75, 16, 0.2], [-0.25, 12, 0.16], [0.35, 14, 0.18], [0.85, 10, 0.12]], t.glow, 318, 7);
  // Great frame arches, nearest structure of this layer
  p.each(0, 0, W - 1, 318, (x, y, i) => {
    if (!frameSolid(x, y)) return;
    let pc = FRAME_P[0];
    let dx = wd(x, FRAME_P[0]);
    if (Math.abs(wd(x, FRAME_P[1])) < Math.abs(dx)) {
      pc = FRAME_P[1];
      dx = wd(x, FRAME_P[1]);
    }
    const facing = wd(ROSE.x, pc) > 0 ? 1 : -1;
    let v = 0.24 + (fbm(x, y, 12, 21, W, 2) - 0.5) * 0.18;
    if (Math.abs(dx) < FRAME_HW && y > 128) {
      const nx = dx / FRAME_HW;
      v += Math.max(0, nx * facing) * 0.35;
      if (Math.abs((Math.abs(nx) * 3) % 1 - 0.5) < 0.1) v -= 0.12; // fluting
      if (!t.rot && y % 26 === 0) v -= 0.1;
      if (t.rot && y % 22 < 5) v -= 0.16;
    } else if (!frameSolid(x + 7 * Math.sign(-dx || 1), y + 5) || !frameSolid(x, y + 7)) {
      // archivolt moulding facing into the opening
      v += 0.2 + (t.rot ? 0.15 : 0);
      if (t.rot) {
        const c = pk(p, t.accent, 0.3 + Math.max(0, -y / 400 + 0.4), x, y);
        p.putI(i, mixc(c, t.fog, 0.4), 1);
        return;
      }
    }
    if (t.rot && valueHole(x, y)) v -= 0.18;
    const c = mixc(pk(p, t.frame, v, x, y), t.fog, 0.12 + 0.4 * smooth(180, 318, y));
    p.putI(i, c, 1);
  });
  // Floor with wet reflections
  p.each(0, 318, W - 1, H, (x, y, i) => {
    let c = mixc(t.haze, t.floor, smooth(318, 345, y));
    const ripple = pnoise(x, y * 6, 14, 3, W);
    const refl = Math.exp(-((wd(x, ROSE.x) / 46) ** 2)) * (0.3 + ripple * 0.5) * (1 - (y - 318) / 50);
    c = mixc(c, t.glow, refl * 0.4);
    p.putI(i, c, 1);
  });
  // Low incense fog
  p.each(0, 190, W - 1, H, (x, y, i) => {
    const amt = smooth(190, 300, y) * (1 - smooth(330, 360, y) * 0.6) * (0.25 + 0.75 * pnoise(x, y * 5, 90, 11, W));
    p.putI(i, t.haze, amt * 0.45);
  });
  p.each(0, 0, W - 1, 80, (x, y, i) => {
    const k = 0.45 + 0.55 * (y / 80);
    p.r[i] *= k;
    p.g[i] *= k;
    p.b[i] *= k;
    void x;
  });
  return p.toPixelCanvas(28);
}

function valueHole(x: number, y: number) {
  return pnoise(x, y, 5, 33, W) > 0.74;
}

// ===========================================================================
// MID: colossal clustered pillars, arches, hanging cages and censers, fog
// ===========================================================================

const MID_P = [110, 430];
const ABACUS = 96;


/** Distance (0..) into the solid spandrel from the arch opening edge, or -1 if inside opening. */
function midArchDepth(x: number, y: number): number {
  const u = ((x % W) + W) % W;
  let best = 99;
  for (const [xl, xr] of [
    [MID_P[0] + 40, MID_P[1] - 40],
    [MID_P[1] + 40, MID_P[0] + W - 40],
  ]) {
    for (const uu of [u, u + W]) {
      if (uu < xl - 30 || uu > xr + 30) continue;
      const r = (xr - xl) * 0.55;
      const c = uu <= (xl + xr) / 2 ? xl + r : xr - r;
      const d = y >= ABACUS ? Math.max(xl - uu, uu - xr) : Math.hypot(uu - c, y - ABACUS) - r;
      if (d < 0 && uu >= xl && uu <= xr) return -1;
      if (d < best) best = d;
    }
  }
  return best;
}

interface PillarHit {
  part: 'shaft' | 'cap' | 'abacus' | 'base' | 'plinth';
  dx: number;
  cx: number;
}

function pillarAt(x: number, y: number, rot: boolean): PillarHit | null {
  for (const cx of MID_P) {
    const dx = wd(x, cx);
    if (Math.abs(dx) > 60) continue;
    if (y >= ABACUS - 6 && y < ABACUS && Math.abs(dx) < 46) return { part: 'abacus', dx, cx };
    if (y >= ABACUS && y < 120) {
      const hw = 24 + ((120 - y) / 24) * 18 + (pnoise(x, y, 4, 3, W) - 0.5) * (rot ? 7 : 4);
      if (Math.abs(dx) < hw) return { part: 'cap', dx, cx };
    }
    if (y >= 120 && y < 300) {
      let hw = 26;
      if (rot) {
        const t = (y - 120) % 26;
        hw = t < 6 ? 19 : 25 + Math.sin(((t - 6) / 20) * Math.PI) * 3;
        if (t > 11 && t < 15 && Math.abs(dx) < 36) return { part: 'shaft', dx, cx };
      }
      if (Math.abs(dx) < hw) return { part: 'shaft', dx, cx };
    }
    if (y >= 300 && y < 320 && Math.abs(dx) < 31 - Math.abs(y - 310) * 0.3) return { part: 'base', dx, cx };
    if (y >= 320 && Math.abs(dx) < 38) return { part: 'plinth', dx, cx };
  }
  return null;
}

function midNave(t: NaveTheme): PixelCanvas {
  const p = new Paint(W, H, 1);
  const fogMix = 0.22;
  p.all((x, y, i) => {
    const hit = pillarAt(x, y, t.rot);
    if (hit) {
      const { part, dx } = hit;
      let v = 0.3;
      if (part === 'shaft') {
        // Three clustered shafts, lit from upper left with a red rim on the right
        let best = -1;
        let nx = 0;
        for (const [ox, hw] of [[-17, 9], [0, 16], [17, 9]] as const) {
          const n = (dx - ox) / hw;
          if (Math.abs(n) >= 1) continue;
          const h = Math.sqrt(1 - n * n) * hw + (ox === 0 ? 4 : 0);
          if (h > best) {
            best = h;
            nx = n;
          }
        }
        if (best < 0) nx = Math.sign(dx);
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx));
        v = 0.12 + Math.max(0, -nx * 0.65 + nz * 0.45) * 0.6 + Math.pow(Math.max(0, nx), 6) * 0.3;
        if (best < 0) v *= 0.4;
        if (t.rot) {
          const tt = (y - 120) % 26;
          if (tt < 6) {
            const c = pk(p, t.membrane, 0.3 + v, x, y);
            p.putI(i, mixc(c, t.fog, fogMix), 1);
            return;
          }
          if (tt > 11 && tt < 15 && Math.abs(dx) > 25) v = 0.35 + (tt === 12 ? 0.2 : 0);
          if (tt === 6 || tt === 25) v -= 0.15;
        } else if ((y - 120) % 28 === 0) v -= 0.12;
        v += (fbm(x, y, 8, 5, W, 2) - 0.5) * 0.22;
      } else if (part === 'cap') {
        // Carved foliage: rows of curling leaves, gilded tips (ribbed bone fan for the truth)
        const row = Math.floor((y - ABACUS) / 8);
        const ly = (y - ABACUS) % 8;
        const lobe = Math.sin(dx * 0.42 + row * 1.7);
        v = 0.24 - dx / 110 + (lobe > 0.2 ? 0.16 : -0.06) + (ly === 0 ? -0.16 : ly === 1 ? 0.1 : 0);
        if (!t.rot && lobe > 0.8 && ly >= 1 && ly < 4) {
          p.putI(i, mixc(pk(p, t.accent, 0.75 - dx / 90 - ly * 0.1, x, y), t.fog, fogMix), 1);
          return;
        }
        if (t.rot) v = 0.3 - dx / 110 + (Math.abs((dx / 7) % 1) < 0.25 ? -0.2 : 0.05) + (ly === 0 ? -0.1 : 0);
      } else if (part === 'abacus') {
        v = y === ABACUS - 6 ? 0.6 : 0.35;
        if (!t.rot && y === ABACUS - 3) {
          p.putI(i, mixc(t.accent[3], t.fog, fogMix), 1);
          return;
        }
      } else if (part === 'base') {
        const ny = (y - 310) / 10;
        v = 0.3 - ny * 0.25 - dx / 120;
        if (!t.rot && Math.abs(y - 305) < 1) {
          p.putI(i, mixc(t.accent[3], t.fog, fogMix), 1);
          return;
        }
      } else {
        v = y === 320 ? 0.5 : 0.2 - dx / 200;
      }
      // Blood running from the capitals / veins crawling the spine
      if (part === 'shaft' || part === 'base') {
        if (!t.rot) {
          const s = pnoise(x, 0, 2.5, 13, W);
          if (s > 0.8 && y < 120 + (s - 0.8) * 900) {
            p.putI(i, mixc(hex(y % 7 === 0 ? '#5a0a14' : '#3a0610'), t.fog, fogMix), 1);
            return;
          }
        } else {
          const vx = Math.abs(dx - 12 * Math.sin(y * 0.045 + hit.cx)) < 1.3 || Math.abs(dx + 9 - 6 * Math.sin(y * 0.07)) < 1;
          if (vx) {
            p.putI(i, mixc(hex('#4a0a14'), t.fog, fogMix), 1);
            return;
          }
        }
      }
      p.putI(i, mixc(pk(p, t.pillar, v, x, y), t.fog, fogMix), 1);
      return;
    }
    if (y < ABACUS) {
      const d = midArchDepth(x, y);
      if (d < 0) return;
      let c: RGB;
      if (d < 6) c = t.rot ? pk(p, t.accent, 0.75 - d * 0.08, x, y) : pk(p, t.pillar, 0.6 - d * 0.04, x, y);
      else if (d < 8) c = t.pillar[0];
      else if (d < 14) c = t.rot ? pk(p, t.accent, 0.45, x, y) : pk(p, t.pillar, 0.38, x, y);
      else if (d < 16) c = t.pillar[0];
      else if (t.rot) {
        c = pk(p, t.membrane, 0.2 + fbm(x, y, 10, 3, W, 2) * 0.6, x, y);
        if (Math.abs(pnoise(x, y, 16, 7, W) - 0.5) < 0.03) c = hex('#1a0306');
      } else c = pk(p, t.pillar, 0.15 + fbm(x, y, 10, 3, W, 2) * 0.25, x, y);
      p.putI(i, mixc(c, t.fog, fogMix), 1);
    }
  });
  // Hanging things
  hangers(p, t);
  // Soft shafts slanting through the arches
  shafts(p, 230, 0, [[0.55, 14, 0.1]], t.glow, 320, 3);
  shafts(p, 560, 0, [[0.5, 10, 0.08]], t.glow, 300, 4);
  // Fog band
  p.each(0, 220, W - 1, H, (x, y, i) => {
    const bell = smooth(220, 285, y) * (1 - smooth(310, 345, y));
    const amt = bell * (0.3 + 0.9 * pnoise(x, y * 6, 80, 14, W)) * 0.34;
    p.putI(i, t.haze, amt);
  });
  return p.toPixelCanvas(28);
}

function hangers(p: Paint, t: NaveTheme) {
  const items: [number, number, 'cage' | 'censer' | 'chain'][] = [
    [232, 150, 'cage'],
    [300, 118, 'censer'],
    [268, 70, 'chain'],
    [566, 172, 'cage'],
    [620, 96, 'chain'],
    [506, 60, 'chain'],
  ];
  const dark = t.rot ? hex('#1c0a0c') : hex('#121014');
  const lit = t.rot ? hex('#5a2a2a') : hex('#3c3436');
  for (const [x, y1, kind] of items) {
    // chain / umbilical cord from the top edge
    for (let y = 0; y < y1; y++) {
      if (t.rot) {
        const sw = Math.sin(y * 0.03 + x) * 2;
        const tw = Math.sin(y * 0.45);
        for (let dx = -2; dx <= 2; dx++) {
          const c = dx === -2 ? hex('#6a2a30') : dx === 2 || Math.abs(dx - tw * 1.5) < 0.6 ? hex('#2a080e') : hex('#4a1820');
          p.plot(x + sw + dx, y, mixc(c, t.fog, 0.2), 1);
        }
      } else {
        const link = Math.floor(y / 5) % 2;
        if (link === 0) {
          const ly = y % 5;
          if (ly === 0 || ly === 4) p.plot(x, y, dark);
          else {
            p.plot(x - 1, y, lit);
            p.plot(x + 1, y, dark);
          }
        } else p.plot(x, y, y % 5 === 2 ? lit : dark);
      }
    }
    if (kind === 'cage') {
      if (t.rot) {
        // A hanging womb-sac with a curled shape inside
        p.each(x - 14, y1, x + 14, y1 + 46, (xx, yy, i) => {
          const d = Math.hypot((xx - x) / 12, (yy - y1 - 22) / 22);
          if (d > 1) return;
          const inner = Math.hypot((xx - x - 1) / 6, (yy - y1 - 24) / 9) < 1;
          let c = d > 0.86 ? (xx < x ? hex('#8a3a3a') : hex('#3a0e14')) : inner ? hex('#24060a') : hex('#5a1a22');
          if (Math.abs(pnoise(xx, yy, 6, 9) - 0.5) < 0.04) c = hex('#2a060c');
          p.putI(i, mixc(c, t.fog, 0.18), 1);
        });
      } else {
        const cw = 14;
        const ch = 50;
        p.each(x - cw - 1, y1, x + cw + 1, y1 + ch + 4, (xx, yy, i) => {
          const dx = xx - x;
          const ly = yy - y1;
          let on = false;
          let hl = false;
          if (ly < 8) {
            const d = Math.hypot(dx / cw, (ly - 8) / 8);
            on = Math.abs(d - 0.92) < 0.12;
          } else if (ly < ch) {
            on = Math.abs(dx) <= cw && Math.round(dx + cw) % 5 === 0;
            hl = on && dx < 0;
            // corpse silhouette slumped inside
            if (!on && Math.hypot((dx + 2) / 6, (ly - 22) / 11) < 1) on = true;
            if (!on && Math.hypot((dx + 3) / 4.5, (ly - 11) / 4.5) < 1) on = true;
          } else if (ly < ch + 3) on = Math.abs(dx) <= cw;
          if (ly >= 26 && ly < ch + 14 && Math.abs(dx - 11 - (ly - 26) * 0.15) < 1.3) on = true; // dangling arm
          if (on) p.putI(i, hl ? lit : dark, 1);
        });
      }
    } else if (kind === 'censer') {
      p.each(x - 8, y1, x + 8, y1 + 14, (xx, yy, i) => {
        const d = Math.hypot((xx - x) / 7, (yy - y1 - 7) / 6);
        if (d < 1) p.putI(i, xx < x - 2 ? (t.rot ? hex('#7a3030') : hex('#6a4a22')) : t.rot ? hex('#3a1014') : hex('#2a1c10'), 1);
      });
      for (const [ex, ey] of [[-3, 8], [0, 9], [3, 8]]) p.plot(x + ex, y1 + ey, hex('#ffb050'));
      p.glow(x, y1 + 8, 26, t.rot ? hex('#ff4a30') : hex('#ff9a40'), 0.3);
      for (let k = 0; k < 40; k++) p.plot(x + Math.sin(k * 0.3) * 3 + k * 0.2, y1 - k, hex('#8f877c'), 0.25 * (1 - k / 40));
    }
  }
}

// ===========================================================================
// NEAR: confessional booths, candelabras, a saint, the rail
// ===========================================================================

function nearNave(t: NaveTheme): PixelCanvas {
  const p = new Paint(W, H, 1);
  const GROUND = 338;
  const tint = (amt: number) => (c: RGB, x: number, y: number): RGB => {
    const d = mixc(c, t.dark, amt);
    // a little red bounce from below, darker toward the top
    const k = 0.75 + 0.25 * smooth(150, 330, y) + bayer(x, y) * 0.02;
    return mulc(d, k);
  };
  const flames: [number, number, number][] = [];
  const booth = drawBooth(t.rot, false, 1.5);
  const cand = drawCandelabra(0, t.rot, 1.8, false);
  const saint = drawSaint(t.rot, 1.35);
  for (const bx of [60, 240, 500]) p.blit(booth, bx - booth.w / 2, GROUND - booth.h + 2, tint(0.64));
  p.blit(saint, 345 - saint.w / 2, GROUND - saint.h + 2, tint(0.6));
  for (const cx of [150, 420, 590]) {
    const ox = Math.round(cx - cand.w / 2);
    const oy = GROUND - cand.h + 1;
    p.blit(cand, ox, oy, tint(0.5));
    for (const [fx, fy] of [[4, 7], [12, 4], [20, 7.5]]) flames.push([ox + fx * 1.8, oy + fy * 1.8, 1]);
  }
  // Candle glows and flames
  for (const [x, y] of flames) {
    p.glow(x, y, 54, t.candle, 0.13, 2);
    p.glow(x, y, 16, t.candle, 0.4, 2);
  }
  for (const [x, y] of flames) {
    p.rect(x - 1, y - 6, x + 2, y + 1, hex('#ffb050'));
    p.rect(x, y - 8, x + 1, y - 5, hex('#ffe08a'));
    p.rect(x, y - 4, x + 1, y, hex('#fff8dc'));
  }
  // Rail / balustrade (bone rail for the truth)
  const railTop = 298;
  p.each(0, railTop - 4, W - 1, H, (x, y, i) => {
    let on = false;
    let v = 0.3;
    const u = ((x % 16) + 16) % 16;
    const post = ((x % 128) + 128) % 128;
    if (y >= railTop && y < railTop + 6) {
      on = true;
      v = y === railTop ? 0.75 : 0.45 - (y - railTop) * 0.05;
    } else if (y >= GROUND - 6 && y < GROUND) {
      on = true;
      v = y === GROUND - 6 ? 0.55 : 0.25;
    } else if (y >= railTop + 6 && y < GROUND - 6) {
      const ty = (y - railTop - 6) / (GROUND - railTop - 12);
      const prof = t.rot ? 1.6 + Math.abs(Math.sin(ty * Math.PI * 3)) * 1.3 : 1.5 + Math.sin(ty * Math.PI) * 2.6 - (ty > 0.15 && ty < 0.22 ? 1 : 0);
      if (Math.abs(u - 8) < prof) {
        on = true;
        v = 0.25 + (8 - u) / 10;
      }
    }
    if (post < 10 && y >= railTop - 4 && y < GROUND) {
      on = true;
      v = 0.3 + (5 - post) / 14;
    }
    if (post >= 2 && post < 8 && y >= railTop - 10 && y < railTop - 4) {
      const d = Math.hypot(post - 5, y - (railTop - 7));
      if (d < 3) {
        on = true;
        v = 0.5 - d * 0.1;
      }
    }
    if (y >= GROUND) {
      on = true;
      v = 0.15 + (pnoise(x, y, 8, 3, W) - 0.5) * 0.2;
    }
    if (!on) return;
    const ramp = t.rot && y < GROUND ? t.accent : t.pillar;
    let c = pk(p, ramp, v, x, y);
    c = mixc(c, t.dark, t.rot && y < GROUND ? 0.62 : 0.4);
    if (!t.rot && y === railTop) c = mixc(t.accent[3], t.dark, 0.45);
    p.putI(i, c, 1);
  });
  // Haze lit by the candles near the ground
  p.each(0, 250, W - 1, GROUND, (x, y, i) => {
    const amt = smooth(250, 330, y) * 0.1 * (0.5 + pnoise(x, y * 4, 60, 9, W));
    p.addI(i, mixc(t.candle, t.haze, 0.6), amt);
  });
  return p.toPixelCanvas(32);
}

// ===========================================================================
// FG: dark framing silhouettes at the top & bottom edges
// ===========================================================================

function fgNave(t: NaveTheme): PixelCanvas {
  const p = new Paint(W, H, 1);
  const BASE = t.rot ? hex('#0a0203') : hex('#060304');
  const RIM = t.rot ? hex('#3a1014') : hex('#2a1a16');
  const mask = (x: number, y: number): boolean => {
    const u = ((x % W) + W) % W;
    // A stone rib curving down from the top edge, with a pendant boss
    if (y < 60) {
      const d = Math.hypot(wd(u, 560), y + 70);
      if (Math.abs(d - 112) < (t.rot ? 5 : 6) && wd(u, 560) > 0 && wd(u, 560) < 96) return true;
      if (Math.hypot(wd(u, 616), y - 44) < 5) return true;
    }
    // Hanging chains / sinew with hooks
    for (const [cx, len] of [[96, 74], [118, 40], [380, 56]] as const) {
      const sw = Math.abs(wd(u, cx));
      if (y < len && sw < (t.rot ? 2.5 : 2.2 + (Math.floor(y / 6) % 2 ? -1 : 0.6))) return true;
      if (Math.hypot(wd(u, cx + 3), y - len - 3) < 4.5 && Math.hypot(wd(u, cx + 5), y - len - 1) > 2.5 && y > len) return true;
    }
    // Torn banner (a flayed skin for the truth), V-shaped tattered hem
    const bd = wd(u, 250);
    if (Math.abs(bd) < 17) {
      const hem = 58 - Math.abs(bd) * 1.3 + (pnoise(u, 0, 2.5, 3, W) - 0.5) * 16;
      if (y < hem && pnoise(u, y, 5, 8, W) < 0.78) return true;
    }
    if (Math.abs(wd(u, 250)) < 22 && y < 4) return true;
    // Bottom: rubble mound, skulls / bones
    if (y > H - 40) {
      const m1 = 30 - Math.abs(wd(u, 190)) * 0.35 + pnoise(u, 0, 6, 9, W) * 8;
      if (y > H - m1) return true;
      const m2 = 16 - Math.abs(wd(u, 540)) * 0.25 + pnoise(u, 1, 5, 4, W) * 6;
      if (y > H - m2) return true;
      // Iron grille (rib spikes for the truth)
      const g = wd(u, 420);
      if (Math.abs(g) < 44) {
        const gx = ((g + 44) % 11 + 11) % 11;
        const tip = t.rot ? Math.abs(g) * 0.3 + 8 : 6;
        if (gx < 2.4 && y > H - 40 + tip - (gx < 1.2 ? 4 : 0)) return true;
        if (Math.abs(y - (H - 18)) < 1.5) return true;
      }
    }
    return false;
  };
  const shade = (x: number, y: number, i: number) => {
    if (!mask(x, y)) return;
    const edge = !mask(x - 1, y - 1) || !mask(x - 2, y - 1);
    let c = edge ? RIM : BASE;
    if (edge && !t.rot && hash2(Math.floor(x), Math.floor(y), 3) > 0.9) c = hex('#5a4020');
    if (!edge && Math.abs(wd(x, 250)) < 17 && y < 62) c = t.rot ? hex('#1a0608') : hex('#12040a');
    p.putI(i, c, 1);
  };
  p.each(0, 0, W - 1, 82, shade);
  p.each(0, H - 42, W - 1, H - 1, shade);
  return p.toPixelCanvas(32);
}

// ===========================================================================
// CISTERN (hub): wet brick vaults, ceiling grates, golden shafts, red water
// ===========================================================================

const C = {
  sky: hex('#040203'),
  fog: hex('#24100e'),
  haze: hex('#5a1812'),
  brick: R(['#0a0606', '#120a09', '#1a0f0d', '#241512', '#2f1c17', '#3c241c', '#4c2e22', '#5e3a2a']),
  gold: hex('#ffc860'),
  gold2: hex('#ffe8a8'),
  water: R(['#160204', '#220407', '#30060a', '#420a0e', '#5a1014', '#7a1a18']),
  iron: R(['#0a0909', '#161415', '#221e1f', '#302a29', '#433a36']),
  rust: R(['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22']),
  dark: hex('#070304'),
};
const GRATES = [107, 320, 533];
const WATER = 306;

/** How strongly the slanting shafts from the ceiling grates light a point. */
function grateLight(x: number, y: number, slope: number, w: number): number {
  let m = 0;
  for (const g of GRATES) {
    const d = wd(x, g + y * slope) / w;
    const v = Math.exp(-d * d);
    if (v > m) m = v;
  }
  return m;
}

function brickV(x: number, y: number, bw: number, bh: number, seed: number): number {
  const row = Math.floor(y / bh);
  const off = (row % 2) * (bw / 2);
  const bx = (((x + off) % bw) + bw) % bw;
  const by = ((y % bh) + bh) % bh;
  if (bx < 1.5 || by < 1.5) return -1;
  const id = Math.floor((x + off) / bw);
  let v = 0.4 + (hash2(((id % 1000) + 1000) % 1000, row, seed) - 0.5) * 0.3;
  if (by < 3) v += 0.08;
  return v;
}

function farCistern(): PixelCanvas {
  const p = new Paint(W, H, 2);
  p.all((x, y, i) => {
    let c = y < 260 ? mixc(C.sky, C.fog, Math.pow(y / 260, 1.1)) : mixc(C.fog, C.haze, smooth(260, WATER, y));
    c = mulc(c, 0.85 + fbm(x, y, 40, 5, W, 3) * 0.3);
    p.putI(i, c, 1);
  });
  // Back wall of brick with deep round-arched tunnels
  const PER = W / 6;
  p.each(0, 0, W - 1, WATER, (x, y, i) => {
    const u = ((x % PER) + PER) % PER;
    const inArch = y > 120 && inRound(u, y, 18, PER - 18, 190);
    const lightK = grateLight(x, y - 40, 0.12, 60) * smooth(40, 200, y);
    if (inArch) {
      const inner = inRound(u, y, 30, PER - 30, 206);
      let c: RGB = mulc([p.r[i], p.g[i], p.b[i]], inner ? 0.16 : 0.34);
      if (!inner) {
        const bv = brickV(x * 0.7, y, 10, 6, 4);
        c = mixc(c, pk(p, C.brick, bv < 0 ? 0 : bv * 0.45, x, y), 0.5);
      } else {
        const far = Math.exp(-(((u - PER / 2) / 14) ** 2 + ((y - 280) / 26) ** 2));
        c = mixc(c, C.haze, far * 0.3);
      }
      p.putI(i, c, 1);
      return;
    }
    const bv = brickV(x, y, 20, 8, 3);
    let v = bv < 0 ? 0.03 : bv * 0.62;
    v += lightK * 0.4 + (fbm(x, y, 16, 8, W, 2) - 0.5) * 0.2 - (1 - lightK) * 0.06;
    if (y < 64) v *= 0.55;
    if (y >= 62 && y < 68) v = y === 62 ? 0.6 : 0.3; // cornice
    // Arch voussoirs
    if (y > 100 && inRound(u, y, 10, PER - 10, 190)) v = (Math.floor(Math.atan2(y - 190, u - PER / 2) * 9) % 2 ? 0.35 : 0.48) + lightK * 0.3;
    const c = mixc(pk(p, C.brick, v, x, y), C.fog, 0.18 + 0.35 * smooth(150, WATER, y));
    p.putI(i, c, 1);
  });
  // Pipes along the back wall
  p.each(0, 140, W - 1, 156, (x, y, i) => {
    const v = 0.5 - Math.abs(y - 146) / 10 + (wd(x, 0) % 80 === 0 ? 0.2 : 0);
    const flange = ((x % 80) + 80) % 80 < 4;
    p.putI(i, mixc(pk(p, flange ? C.rust : C.iron, v + (flange ? 0.2 : 0), x, y), C.fog, 0.25), 1);
  });
  for (const px of [60, 262, 470]) {
    p.each(px - 4, 156, px + 4, WATER, (x, y, i) => {
      const d = (x - px) / 4;
      p.putI(i, mixc(pk(p, C.iron, 0.45 - d * 0.35, x, y), C.fog, 0.2 + 0.3 * smooth(150, WATER, y)), 1);
    });
  }
  // Ceiling grates blazing with the city's light
  for (const g of GRATES) {
    p.each(g - 30, 24, g + 30, 40, (x, y, i) => {
      const dx = x - g;
      if (Math.abs(dx) > 28 || y < 26 || y > 38) return;
      const bar = ((Math.floor(dx + 28) % 7) + 7) % 7 < 2 || y < 28 || y > 36;
      p.putI(i, bar ? C.iron[1] : mixc(C.gold2, C.gold, Math.abs(dx) / 28), 1);
    });
    p.glow(g, 32, 90, C.gold, 0.35, 2);
    shafts(p, g, 36, [[0.12, 22, 0.42]], C.gold, WATER, g, 0.3, 0.45, 1.6);
    p.glow(g + (WATER - 36) * 0.12, WATER, 70, C.gold, 0.18, 2);
  }
  // Blood-red water with golden reflections
  p.each(0, WATER, W - 1, H, (x, y, i) => {
    const ripple = pnoise(x, y * 7, 18, 5, W);
    let v = 0.25 + (ripple - 0.5) * 0.3 + (y - WATER) / 200;
    let c = pk(p, C.water, v, x, y);
    const refl = grateLight(x, WATER - 36, 0.12, 30);
    if (refl > 0.1 && ripple > 0.5) c = mixc(c, C.gold, refl * 0.45 * (ripple - 0.3));
    if (y === WATER) c = mixc(c, C.gold, 0.25 + refl * 0.4);
    p.putI(i, c, 1);
    v = 0;
  });
  // Red mist hanging over the water
  p.each(0, 220, W - 1, H, (x, y, i) => {
    const amt = smooth(220, WATER, y) * (1 - smooth(WATER + 10, H, y) * 0.6) * (0.3 + 0.7 * pnoise(x, y * 5, 70, 21, W));
    p.putI(i, C.haze, amt * 0.45);
  });
  return p.toPixelCanvas(28);
}

const PIERS = [130, 450];

function midCistern(): PixelCanvas {
  const p = new Paint(W, H, 1);
  const SPRING = 92;
  const bays: [number, number][] = [
    [PIERS[0] + 32, PIERS[1] - 32],
    [PIERS[1] + 32, PIERS[0] + W - 32],
  ];
  p.all((x, y, i) => {
    const u = ((x % W) + W) % W;
    let pier = -1;
    let dx = 0;
    for (const c of PIERS) {
      const d = wd(u, c);
      if (Math.abs(d) < 32) {
        pier = c;
        dx = d;
      }
    }
    if (pier < 0 && y >= SPRING) return;
    const lightK = grateLight(x, y, 0.12, 70);
    if (pier >= 0 && y >= SPRING - 10) {
      const nx = dx / 32;
      const bv = brickV(x, y, 16, 8, 7);
      let v = bv < 0 ? 0.06 : bv - 0.05;
      v += (nx < -0.8 ? 0.25 : nx > 0.8 ? -0.15 : 0) + lightK * 0.3 * (nx < 0 ? 1 : 0.4);
      if (y > 300) v -= ((y - 300) / 60) * 0.3; // waterline damp
      if (Math.abs(dx - 22) < 3.5 && y > SPRING) {
        // drain pipe down the pier
        const pv = 0.55 - Math.abs(dx - 21) / 4;
        p.putI(i, pk(p, (y >> 3) % 6 === 0 ? C.rust : C.iron, pv, x, y), 1);
        return;
      }
      if (y < SPRING - 4 && Math.abs(dx) < 36) v = 0.55;
      p.putI(i, mixc(pk(p, C.brick, v, x, y), C.fog, 0.18), 1);
      return;
    }
    if (y < SPRING) {
      let inside = false;
      let ring = 99;
      for (const [xl, xr] of bays)
        for (const uu of [u, u + W]) {
          if (uu < xl - 20 || uu > xr + 20) continue;
          const d = Math.hypot(uu - (xl + xr) / 2, y - SPRING) - (xr - xl) / 2;
          if (d <= 0) inside = true;
          else if (d <= 16) ring = Math.min(ring, Math.ceil(d / 2) * 2);
        }
      if (inside) return;
      let v: number;
      if (ring <= 14) {
        const ang = Math.atan2(y - SPRING, (u % 320) - 160);
        v = (Math.floor(ang * 16) % 2 ? 0.42 : 0.5) - ring * 0.012 + lightK * 0.2;
        if (ring === 14) v = 0.08;
      } else {
        const bv = brickV(x, y, 16, 8, 9);
        v = (bv < 0 ? 0.05 : bv * 0.8) + lightK * 0.15;
      }
      p.putI(i, mixc(pk(p, C.brick, v, x, y), C.fog, 0.18), 1);
    }
  });
  // Grates in the vault spandrels, spilling light
  for (const g of [GRATES[1] - 30, GRATES[2] + 70]) {
    p.each(g - 14, 10, g + 14, 22, (x, y, i) => {
      const bar = ((Math.floor(x - g + 14) % 5) + 5) % 5 < 1 || y < 12 || y > 20;
      p.putI(i, bar ? C.iron[2] : C.gold2, 1);
    });
    p.glow(g, 16, 40, C.gold, 0.3);
    shafts(p, g, 22, [[0.12, 9, 0.13]], C.gold, 340, g + 1, 0.5, 0.4, 1.8);
  }
  // A broken pipe vomiting blood
  const bx = 300;
  p.each(bx - 10, 40, bx + 10, 56, (x, y, i) => p.putI(i, pk(p, C.iron, 0.6 - Math.abs(y - 48) / 9, x, y), 1));
  p.each(bx + 6, 50, bx + 22, H, (x, y, i) => {
    const cx = bx + 12 + Math.sin(y * 0.05) * 1.5 + Math.min(4, (y - 50) * 0.08);
    const w = 3 + (y - 50) * 0.012;
    const d = (x - cx) / w;
    if (Math.abs(d) > 1) return;
    const streak = pnoise(x * 3, y * 0.3 - x, 4, 3);
    p.putI(i, pk(p, C.water, 0.45 + streak * 0.5 - d * 0.2, x, y), 0.95);
  });
  // Chains
  for (const [x, len] of [[250, 140], [590, 110], [620, 60]] as const) {
    for (let y = 0; y < len; y++) {
      const link = Math.floor(y / 5) % 2;
      const c = y % 5 === 2 ? C.iron[3] : C.iron[1];
      if (link === 0) {
        if (y % 5 === 0 || y % 5 === 4) p.plot(x, y, c);
        else {
          p.plot(x - 1, y, C.iron[3]);
          p.plot(x + 1, y, C.iron[0]);
        }
      } else p.plot(x, y, c);
    }
    // hook
    p.each(x - 4, len, x + 4, len + 8, (xx, yy, i) => {
      const d = Math.hypot(xx - x - 1, yy - len - 3);
      if (d > 2 && d < 3.6 && !(yy < len + 3 && xx > x + 1)) p.putI(i, C.iron[2], 1);
    });
  }
  // Red fog band
  p.each(0, 230, W - 1, H, (x, y, i) => {
    const bell = smooth(230, 300, y) * (1 - smooth(330, 360, y) * 0.5);
    p.putI(i, C.haze, bell * (0.3 + 0.8 * pnoise(x, y * 6, 80, 31, W)) * 0.32);
  });
  return p.toPixelCanvas(28);
}

function nearCistern(): PixelCanvas {
  const p = new Paint(W, H, 1);
  const GROUND = 336;
  const pipeY = 262;
  p.all((x, y, i) => {
    const u = ((x % W) + W) % W;
    // Great sewer pipe across the view, with flanges and rivets
    if (y >= pipeY && y < pipeY + 14) {
      const t = (y - pipeY) / 14;
      const fl = ((u % 120) + 120) % 120 < 8;
      let v = 0.15 + Math.sin(t * Math.PI) * 0.35 - t * 0.15 + (fl ? 0.12 : 0);
      if (fl && (y === pipeY + 3 || y === pipeY + 10) && u % 4 === 1) v = 0.8;
      const rust = pnoise(x, y, 6, 9, W) > 0.6;
      p.putI(i, mixc(pk(p, rust ? C.rust : C.iron, v, x, y), C.dark, 0.5), 1);
      return;
    }
    // Supports beneath the pipe
    const sup = ((u - 60) % 240 + 240) % 240;
    if (y >= pipeY + 14 && y < GROUND && sup < 10) {
      const v = 0.3 + (5 - sup) / 18;
      p.putI(i, mixc(pk(p, C.iron, v, x, y), C.dark, 0.35), 1);
      return;
    }
    // Broken wall stubs with a glowing grate window
    const wl = wd(u, 190);
    if (Math.abs(wl) < 40 && y > 210 + Math.abs(wl) * 0.4 + pnoise(u, 0, 5, 3, W) * 10) {
      const win = Math.abs(wl) < 12 && y > 262 && y < 292;
      if (win) {
        const bar = ((Math.floor(wl + 12) % 6) + 6) % 6 < 2;
        p.putI(i, bar ? C.iron[0] : mixc(C.gold2, C.gold, (y - 262) / 30), 1);
        return;
      }
      const bv = brickV(x, y, 14, 7, 12);
      p.putI(i, mixc(pk(p, C.brick, bv < 0 ? 0.04 : bv, x, y), C.dark, 0.35), 1);
      return;
    }
    // Iron fence
    const f = wd(u, 470);
    if (Math.abs(f) < 60 && y < GROUND && y > 280) {
      const fx = ((f + 60) % 10 + 10) % 10;
      if ((fx < 2 && y > 280 + (fx < 1 ? 0 : 2)) || Math.abs(y - 296) < 1.5 || Math.abs(y - 324) < 1.5) {
        p.putI(i, mixc(pk(p, C.iron, fx < 1 ? 0.6 : 0.3, x, y), C.dark, 0.3), 1);
        return;
      }
    }
    // Rubble along the ground
    const m = 12 + pnoise(u, 0, 14, 4, W) * 24 + (Math.abs(wd(u, 330)) < 50 ? 14 - Math.abs(wd(u, 330)) * 0.28 : 0);
    if (y > GROUND - m + 10 || y >= GROUND) {
      const bv = brickV(x + y * 0.3, y, 9, 5, 15);
      let c = pk(p, C.brick, bv < 0 ? 0.05 : bv * 0.8, x, y);
      if (hash2(Math.floor(x / 4), Math.floor(y / 4), 8) > 0.92) c = hex('#4a3a2a');
      p.putI(i, mixc(c, C.dark, 0.35), 1);
    }
  });
  // Outlet pouring blood into the cistern
  const ox = 60;
  const oy = 270;
  p.each(ox - 26, oy - 26, ox + 26, oy + 26, (x, y, i) => {
    const d = Math.hypot(x - ox, y - oy);
    if (d < 18) p.putI(i, C.dark, 1);
    else if (d < 25) p.putI(i, mixc(pk(p, C.brick, 0.5 - (y - oy) / 60, x, y), C.dark, 0.3), 1);
  });
  p.each(ox - 14, oy + 6, ox + 14, H, (x, y, i) => {
    const w = 11 - Math.min(5, (y - oy) * 0.05);
    const d = (x - ox) / w;
    if (Math.abs(d) > 1) return;
    const s = pnoise(x * 2, y * 0.25 - x * 0.5, 4, 8);
    p.putI(i, pk(p, C.water, 0.4 + s * 0.6 - Math.abs(d) * 0.2, x, y), 0.96);
  });
  // Golden spill from the grate window
  p.glow(190, 277, 50, C.gold, 0.25);
  // Drips from the pipe
  for (let k = 0; k < 9; k++) {
    const x = hash2(k, 1, 4) * W;
    const len = 4 + hash2(k, 2, 4) * 10;
    for (let y = 0; y < len; y++) p.plot(x, pipeY + 14 + y + (y > len - 2 ? 6 : 0), hex(k % 3 ? '#5a1014' : '#8a1a20'), 0.9);
  }
  return p.toPixelCanvas(32);
}

function fgCistern(): PixelCanvas {
  const p = new Paint(W, H, 1);
  const BASE = hex('#050203');
  const RIM = hex('#2a1610');
  const mask = (x: number, y: number) => {
    const u = ((x % W) + W) % W;
    // Brick lintel fragment and a dripping pipe end, top
    if (y < 26 && Math.abs(wd(u, 40)) < 80 && y < 26 - Math.abs(wd(u, 40)) * 0.15 + pnoise(u, 0, 5, 2, W) * 6) return true;
    if (Math.abs(wd(u, 300)) < 7 && y < 50) return true;
    if (Math.abs(wd(u, 300)) < 10 && y >= 44 && y < 52) return true;
    for (const [cx, len] of [[470, 60], [490, 34]] as const) if (Math.abs(wd(u, cx)) < 2 + (Math.floor(y / 6) % 2 ? -0.8 : 0.4) && y < len) return true;
    // Bottom: bones and bricks
    if (y > H - 36) {
      const m = 22 - Math.abs(wd(u, 120)) * 0.3 + pnoise(u, 0, 6, 7, W) * 8;
      if (y > H - m) return true;
      const m2 = 14 - Math.abs(wd(u, 560)) * 0.2 + pnoise(u, 1, 4, 8, W) * 5;
      if (y > H - m2) return true;
      const r = wd(u, 380);
      if (Math.abs(r) < 30 && ((r + 30) % 8 < 2) && y > H - 30 + Math.abs(r) * 0.3) return true;
    }
    return false;
  };
  const shade = (x: number, y: number, i: number) => {
    if (!mask(x, y)) return;
    const edge = !mask(x - 1, y - 1) || !mask(x - 2, y - 1);
    p.putI(i, edge ? RIM : BASE, 1);
  };
  p.each(0, 0, W - 1, 62, shade);
  p.each(0, H - 38, W - 1, H - 1, shade);
  for (let k = 0; k < 4; k++) p.plot(301, 56 + k * 7, hex('#7a1a18'));
  return p.toPixelCanvas(32);
}

// ===========================================================================

export type BackdropSet = 'marble' | 'rot' | 'cistern';

export function drawBackdrops(set: BackdropSet): { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas } {
  if (set === 'cistern') return { far: farCistern(), mid: midCistern(), near: nearCistern(), fg: fgCistern() };
  const t = set === 'rot' ? ROT_T : MARBLE_T;
  return { far: farNave(t), mid: midNave(t), near: nearNave(t), fg: fgNave(t) };
}
export const _debug = { farNave, midNave, nearNave, fgNave, farCistern, midCistern, nearCistern, fgCistern, MARBLE_T, ROT_T };
