import { P, darken, mix } from './palette';
import { PixelCanvas, bayer, hash2, registerImage } from './pixel';

function ring(r: number, thickness: number, color: string, fill?: string): PixelCanvas {
  const s = r * 2 + 1;
  const pc = new PixelCanvas(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - r, y - r);
      if (d <= r && d > r - thickness) pc.px(x, y, color);
      else if (d <= r - thickness && fill) pc.px(x, y, fill, 0.55);
    }
  }
  return pc;
}

function button(r: number, rim: string, icon: (pc: PixelCanvas, c: number) => void, pressed = false): PixelCanvas {
  const s = r * 2 + 1;
  const pc = new PixelCanvas(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot(x - r, y - r);
      if (d > r) continue;
      if (d > r - 1) pc.px(x, y, P.ink);
      else if (d > r - 3) pc.px(x, y, y < r ? rim : darken(rim, 0.35));
      else pc.px(x, y, pressed ? '#3a1218' : bayer(x, y) < 0.5 ? '#1e0e12' : '#24121a', 0.82);
    }
  }
  icon(pc, r);
  return pc;
}

const ICONS: Record<string, (pc: PixelCanvas, c: number) => void> = {
  jump: (pc, c) => {
    // A pair of plucked wings lifting a red tether
    pc.poly(
      [
        [c - 10, c + 2],
        [c - 2, c - 8],
        [c - 1, c + 4],
      ],
      P.bone1,
    );
    pc.poly(
      [
        [c + 10, c + 2],
        [c + 2, c - 8],
        [c + 1, c + 4],
      ],
      P.bone1,
    );
    for (let i = -8; i <= 8; i += 3) pc.px(c + i, c + 1 - Math.abs(i) * 0.6, P.bone2);
    pc.line(c, c - 6, c, c + 9, P.blood1);
    pc.px(c, c - 7, P.blood0);
  },
  attack: (pc, c) => {
    // Chain swinging to a shackle
    for (let i = 0; i < 5; i++) pc.rect(c - 8 + i * 3, c + 6 - i * 3, 2, 2, i % 2 ? P.iron0 : P.iron1);
    pc.ellipse(c + 6, c - 6, 4, 4, P.iron0);
    pc.ellipse(c + 6, c - 6, 1, 1, P.ink);
    pc.px(c + 4, c - 8, P.bone0);
  },
  dodge: (pc, c) => {
    // Three wind-streaks and a footprint
    for (let i = 0; i < 3; i++) pc.line(c - 9, c - 5 + i * 5, c + 1 - i * 2, c - 5 + i * 5, P.smoke0);
    pc.ellipse(c + 5, c + 1, 3, 4, P.flesh1);
    pc.px(c + 4, c - 4, P.flesh1);
    pc.px(c + 6, c - 4, P.flesh1);
  },
  execute: (pc, c) => {
    // A misericorde dagger dripping
    pc.line(c - 7, c + 7, c + 6, c - 6, P.iron0);
    pc.line(c - 6, c + 7, c + 7, c - 6, P.iron1);
    pc.line(c - 9, c + 3, c - 3, c + 9, P.gold1);
    pc.rect(c - 10, c + 8, 3, 3, P.wood1);
    pc.px(c + 2, c - 1, P.blood1);
    pc.px(c + 3, c + 1, P.blood1);
    pc.px(c + 3, c + 3, P.blood2);
  },
  maw: (pc, c) => {
    pc.ellipse(c, c, 7, 5, P.flesh2);
    pc.ellipse(c, c, 5, 3, P.ink);
    for (let x = c - 4; x <= c + 4; x += 2) {
      pc.px(x, c - 3, P.bone0);
      pc.px(x + 1, c + 3, P.bone0);
    }
    pc.px(c, c, P.bile0);
  },
  helix: (pc, c) => {
    pc.ellipse(c, c, 6, 8, P.flesh1);
    pc.ellipse(c + 1, c, 3, 5, P.flesh3);
    pc.ellipse(c + 1, c + 1, 1, 2, P.ink);
    pc.px(c - 3, c - 5, P.flesh0);
  },
  tear: (pc, c) => {
    pc.ellipse(c, c + 2, 5, 5, P.tear1);
    pc.poly(
      [
        [c - 4, c],
        [c, c - 9],
        [c + 4, c],
      ],
      P.tear1,
    );
    pc.px(c - 2, c, P.white);
    pc.px(c - 2, c + 1, P.tear0);
    pc.px(c + 2, c + 5, P.tear2);
  },
  speak: (pc, c) => {
    // An ear/mouth glyph: lips
    pc.ellipse(c, c, 7, 3, P.blood1);
    pc.line(c - 6, c, c + 6, c, P.ink);
    pc.px(c - 2, c - 3, P.blood0);
  },
  pause: (pc, c) => {
    pc.rect(c - 3, c - 3, 2, 7, P.bone0);
    pc.rect(c + 2, c - 3, 2, 7, P.bone0);
  },
};

// ---------------------------------------------------------------------------
// Run HUD: antique gilt, warmer and duller than the palette's leaf gold
const G0 = '#f2dc9c';
const G1 = '#d0a654';
const G2 = '#9c7432';
const G3 = '#5e4217';
// Run HUD: a portrait medallion in gilt filigree with three vials beside it
// ---------------------------------------------------------------------------

/** Gold shaded by light from the upper left (l in -1..1). */
function gilt(l: number) {
  return l > 0.55 ? G0 : l > 0.0 ? G1 : l > -0.55 ? G2 : G3;
}

/** Quantised blend, so generated gradients don't flood the colour cache. */
function qmix(a: string, b: string, t: number) {
  return mix(a, b, Math.round(Math.max(0, Math.min(1, t)) * 40) / 40);
}

/** A spiral scroll of gold pixels (filigree). */
function curl(pc: PixelCanvas, ox: number, oy: number, rad: number, a0: number, a1: number, col: string) {
  for (let a = a0; a1 > a0 ? a <= a1 : a >= a1; a += a1 > a0 ? 0.07 : -0.07) {
    const k = rad * (1 - (Math.abs(a - a0) / Math.abs(a1 - a0)) * 0.6);
    pc.px(ox + Math.cos(a) * k, oy + Math.sin(a) * k, col);
  }
}

export const MEDAL = { w: 48, h: 50, cx: 22, cy: 26, r: 18 };
const GLASS_R = MEDAL.r - 5;

function medallion(): PixelCanvas {
  const { w, h, cx, cy, r } = MEDAL;
  const pc = new PixelCanvas(w, h);
  // Behind the ring: a scroll curling off the lower right, a smaller one lower left
  curl(pc, cx + 17, cy + 15, 6, -Math.PI * 0.9, Math.PI * 1.1, G2);
  curl(pc, cx + 17, cy + 14, 6, -Math.PI * 0.9, Math.PI * 1.1, G1);
  pc.thickLine(cx + 10, cy + 15, cx + 16, cy + 20, 1, G2);
  pc.px(cx + 23, cy + 12, G0);
  curl(pc, cx - 15, cy + 15, 4, Math.PI * 1.9, -Math.PI * 0.1, G2);
  curl(pc, cx - 15, cy + 14, 4, Math.PI * 1.9, -Math.PI * 0.1, G1);
  // Pendant below
  pc.poly([[cx - 2, cy + r], [cx + 3, cy + r], [cx, cy + r + 5]], G2);
  pc.px(cx, cy + r + 2, P.blood1);
  pc.px(cx, cy + r + 3, P.blood2);
  // Crest: a gilt finial with two beads
  const ty = cy - r;
  pc.line(cx - 6, ty + 1, cx + 6, ty + 1, G2);
  pc.rect(cx - 7, ty - 1, 2, 2, G1);
  pc.rect(cx + 6, ty - 1, 2, 2, G2);
  pc.poly([[cx, ty - 8], [cx + 3, ty - 3], [cx, ty + 2], [cx - 3, ty - 3]], G2);
  pc.line(cx, ty - 7, cx - 2, ty - 3, G0);
  pc.line(cx - 2, ty - 3, cx, ty + 1, G1);
  pc.px(cx, ty - 3, P.blood0);
  // Beads around the rim (left and below; the vials attach on the right)
  for (const a of [Math.PI * 0.62, Math.PI * 0.85, Math.PI, Math.PI * 1.15, Math.PI * 1.38]) {
    const bx = cx + Math.cos(a) * (r + 1);
    const by = cy + Math.sin(a) * (r + 1);
    pc.ellipse(bx, by, 1, 1, G2);
    pc.px(bx - 0.4, by - 0.4, G0);
  }
  // Ring and glass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d > r + 0.5) continue;
      const l = d > 0 ? (-dx - dy) / (d * 1.414) : 0;
      if (d > r - 0.5) pc.px(x, y, P.ink);
      else if (d > r - 4) {
        // Ring segmented into filigree links
        const a = Math.atan2(dy, dx) + Math.PI;
        const seg = (a / (Math.PI / 10)) % 1;
        const mid = d > r - 2.8 && d < r - 1.2;
        let c = gilt(l + (d > r - 1.5 ? 0.25 : d < r - 3 ? -0.35 : 0));
        if (seg < 0.16) c = G3;
        else if (mid && seg > 0.45 && seg < 0.6) c = l > -0.2 ? G0 : G1;
        pc.px(x, y, c);
      } else if (d > r - 5) pc.px(x, y, P.ink);
      else {
        // Dark glass, faintly violet, deepening to the rim
        const t = d / GLASS_R;
        let c = qmix('#3a3056', '#06050b', Math.pow(t, 1.15));
        if (bayer(x, y) < 0.3 && t > 0.5) c = qmix(c, '#000000', 0.3);
        pc.px(x, y, c);
        // A rim of cold light low on the right
        if (t > 0.86 && dx > 0 && dy > 0) pc.px(x, y, P.lucid2, 0.55);
      }
    }
  }
  // Inner rim hairline
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const x = cx + Math.cos(a) * (r - 4.5);
    const y = cy + Math.sin(a) * (r - 4.5);
    pc.px(x, y, Math.sin(a) < -0.2 || Math.cos(a) < -0.6 ? G3 : '#3a2a14');
  }
  // The chain-flail: gilt grip lower left, links arcing to a spiked head
  pc.line(cx - 9, cy + 9, cx - 4, cy + 4, P.brass1);
  pc.line(cx - 8, cy + 9, cx - 4, cy + 5, P.brass2);
  pc.line(cx - 9, cy + 8, cx - 5, cy + 4, P.brass0);
  pc.line(cx - 7, cy + 2, cx - 2, cy + 7, G2);
  pc.px(cx - 10, cy + 10, G1);
  pc.px(cx - 11, cy + 11, G2);
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const bx = (1 - t) * (1 - t) * (cx - 3) + 2 * (1 - t) * t * (cx + 7) + t * t * (cx + 5);
    const by = (1 - t) * (1 - t) * (cy + 3) + 2 * (1 - t) * t * (cy + 7) + t * t * (cy - 3);
    if (i % 2) {
      pc.rect(bx - 1, by - 1, 2, 2, P.iron1);
      pc.px(bx - 1, by - 1, P.iron0);
    } else pc.px(bx, by, P.iron0);
  }
  const hx = cx + 5;
  const hy = cy - 6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.2;
    pc.line(hx + Math.cos(a) * 3, hy + Math.sin(a) * 3, hx + Math.cos(a) * 5.4, hy + Math.sin(a) * 5.4, k < 4 ? P.iron1 : P.iron0);
  }
  pc.ellipse(hx, hy, 3, 3, (x, y) => (x - hx + (y - hy) < -1 ? P.iron0 : x - hx + (y - hy) > 2 ? P.iron2 : P.iron1));
  pc.px(hx - 1, hy - 2, P.bone0);
  pc.px(hx + 2, hy + 1, P.blood1);
  pc.px(hx + 2, hy + 3, P.blood2);
  // Glass highlights
  for (let y = cy - GLASS_R; y <= cy; y++) {
    for (let x = cx - GLASS_R; x <= cx; x++) {
      if (Math.hypot(x - cx, y - cy) < GLASS_R - 1.5 && Math.hypot(x - cx - 2, y - cy - 2) > GLASS_R - 2.5) pc.px(x, y, P.white, 0.14);
    }
  }
  pc.px(cx - 7, cy - 8, P.white, 0.85);
  pc.px(cx - 6, cy - 9, P.white, 0.45);
  pc.px(cx - 8, cy - 7, P.white, 0.45);
  pc.outline(P.ink);
  return pc;
}

/** Fractures across the glass as Lucidity fails. */
function medallionCracks(): PixelCanvas {
  const { w, h, cx, cy } = MEDAL;
  const pc = new PixelCanvas(w, h);
  const inGlass = (x: number, y: number) => Math.hypot(x - cx, y - cy) < GLASS_R - 0.5;
  for (let s = 0; s < 6; s++) {
    const a = s * 1.1 + 0.4;
    let x = cx + Math.cos(a) * (GLASS_R - 1);
    let y = cy + Math.sin(a) * (GLASS_R - 1);
    let dir = a + Math.PI;
    for (let k = 0; k < 9 + s; k++) {
      if (!inGlass(x, y)) break;
      pc.px(x, y, P.white, 0.8);
      if (k % 3 === 2) pc.px(x + Math.cos(dir + 1.4) * 1.5, y + Math.sin(dir + 1.4) * 1.5, P.white, 0.5);
      dir += (hash2(s, k, 9) - 0.5) * 1.1;
      x += Math.cos(dir);
      y += Math.sin(dir);
    }
  }
  return pc;
}

/** Blood weeping down the inside of the glass as the body fails. */
function medallionBlood(): PixelCanvas {
  const { w, h, cx, cy } = MEDAL;
  const pc = new PixelCanvas(w, h);
  for (let x = cx - GLASS_R + 1; x < cx + GLASS_R; x++) {
    const top = cy - Math.sqrt(Math.max(0, GLASS_R * GLASS_R - (x - cx) * (x - cx)));
    const len = 1 + Math.floor(hash2(x, 3, 4) * (hash2(x, 7, 2) < 0.35 ? 14 : 4));
    for (let k = 0; k < len; k++) pc.px(x, top + 1 + k, k === len - 1 ? P.blood0 : P.blood1, 0.85);
    pc.px(x, top + 0.5, P.blood2, 0.9);
  }
  return pc;
}

export const BAR_CAP = 9;
/** Rows above the fill inside a bar frame. */
export const BAR_FILL_Y = 5;
/** Vial key, frame width, fill height. */
export const HUD_BARS: [string, number, number][] = [
  ['hp', 160, 5],
  ['censer', 128, 3],
  ['lucid', 114, 3],
];
const FILLS: Record<string, string[]> = {
  hp: ['#ff8a76', P.blood0, P.blood1, P.blood2],
  censer: ['#fff0b8', '#f6c25a', '#dc9632', '#94581c'],
  lucid: [P.tear0, '#a596f2', '#7a66d4', P.lucid2],
};

/** A thin dark vial between gilt rails, ending in a gold spear-tip cap. */
function barFrame(w: number, fh: number): PixelCanvas {
  const h = fh + 10;
  const pc = new PixelCanvas(w, h);
  const top = 3;
  const x0 = w - BAR_CAP;
  for (let x = 0; x <= x0 + 1; x++) {
    pc.px(x, top, P.ink);
    pc.px(x, top + 1, x % 8 === 3 ? G1 : x % 8 === 4 ? G2 : G3);
    for (let j = 0; j < fh; j++) pc.px(x, top + 2 + j, j === 0 ? '#1c1420' : '#0b080e');
    pc.px(x, top + 2 + fh, '#3a2a10');
    pc.px(x, top + 3 + fh, P.ink);
  }
  // Collar and spear tip
  const mid = top + 2 + (fh - 1) / 2;
  pc.rect(x0, 1, 1, h - 2, G1);
  pc.rect(x0 + 1, 1, 1, h - 2, G2);
  pc.px(x0, 0, G2);
  pc.px(x0, h - 1, G3);
  pc.poly([[x0 + 2, mid - 3.5], [w - 1, mid], [x0 + 2, mid + 3.5]], G2);
  pc.line(x0 + 2, Math.round(mid - 2), w - 3, Math.round(mid), G0);
  pc.line(x0 + 2, Math.round(mid + 2), w - 3, Math.round(mid), G3);
  pc.px(x0 + 3, Math.round(mid), P.blood1);
  // Hooked curls off the collar
  pc.px(x0 - 1, 1, G2);
  pc.px(x0 - 2, 2, G2);
  pc.px(x0 - 1, h - 2, G3);
  pc.px(x0 - 2, h - 3, G3);
  pc.outline(P.ink);
  return pc;
}

function barFill(w: number, fh: number, cols: string[]): PixelCanvas {
  const pc = new PixelCanvas(w, fh);
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < w; x++) {
      let c = y === 0 ? cols[0] : y === fh - 1 ? cols[3] : y === 1 && fh > 3 ? cols[1] : cols[2];
      if (y > 0 && y < fh - 1 && bayer(x, y) < 0.2) c = cols[1];
      pc.px(x, y, c);
    }
  }
  return pc;
}

/** A round gilt counter coin bearing a glyph. */
function coin(kind: 'tear' | 'vert'): PixelCanvas {
  const pc = new PixelCanvas(15, 15);
  const c = 7;
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
      const dx = x - c;
      const dy = y - c;
      const d = Math.hypot(dx, dy);
      if (d > 6.6) continue;
      if (d > 4.6) pc.px(x, y, gilt(d > 0 ? (-dx - dy) / (d * 1.414) : 0));
      else if (d > 3.9) pc.px(x, y, P.ink);
      else pc.px(x, y, qmix('#2a2236', '#0d0a12', d / 4));
    }
  }
  if (kind === 'tear') {
    pc.ellipse(7, 8, 1.6, 1.6, P.tear1);
    pc.px(7, 5, P.tear1);
    pc.px(7, 6, P.tear1);
    pc.px(6, 7, P.tear0);
    pc.px(8, 9, P.tear2);
  } else {
    pc.rect(5, 7, 5, 1, P.bone1);
    pc.px(7, 7, P.bone0);
    pc.px(7, 5, P.bone1);
    pc.px(7, 6, P.bone0);
    pc.px(7, 8, P.bone2);
    pc.px(7, 9, P.bone2);
  }
  pc.outline(P.ink);
  return pc;
}

/** Minimap viewport, in game pixels. */
export const MINI_W = 72;
export const MINI_H = 28;

/** Double gilt rule around the minimap with jewelled corners. */
function miniFrame(vw: number, vh: number): PixelCanvas {
  const w = vw + 10;
  const h = vh + 10;
  const pc = new PixelCanvas(w, h);
  const ring = (i: number, f: (x: number, y: number) => string) => {
    for (let x = i; x < w - i; x++) {
      pc.px(x, i, f(x, i));
      pc.px(x, h - 1 - i, f(x, h - 1 - i));
    }
    for (let y = i; y < h - i; y++) {
      pc.px(i, y, f(i, y));
      pc.px(w - 1 - i, y, f(w - 1 - i, y));
    }
  };
  ring(1, (x, y) => (y === 1 || x === 1 ? G1 : G2));
  ring(2, () => P.ink);
  ring(3, (x, y) => (y === 3 || x === 3 ? G2 : G3));
  ring(4, () => P.ink);
  for (const [jx, jy] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m <= 3) pc.px(jx + dx, jy + dy, m <= 1 ? (dx + dy < 0 ? G0 : G1) : G2);
      }
    pc.px(jx, jy, P.blood1);
  }
  // Pendant diamond beneath
  const mx = Math.floor(w / 2);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) pc.px(mx + dx, h - 2 + dy, Math.abs(dx) + Math.abs(dy) <= 1 ? G0 : G2);
  pc.outline(P.ink);
  return pc;
}

// ---------------------------------------------------------------------------
// Boss bar: a long thin vial between gilt filigree end pieces
// ---------------------------------------------------------------------------

export const BOSS_END = 16;
export const BOSS_FILL_Y = 7;
export const BOSS_FH = 4;

function bossFrame(w: number): PixelCanvas {
  const h = 18;
  const E = BOSS_END;
  const pc = new PixelCanvas(w, h);
  const fh = BOSS_FH;
  const fy = BOSS_FILL_Y;
  for (let x = E - 2; x < w - E + 2; x++) {
    pc.px(x, fy - 2, P.ink);
    pc.px(x, fy - 1, x % 8 === 3 ? G1 : G2);
    for (let j = 0; j < fh; j++) pc.px(x, fy + j, j === 0 ? '#1c1420' : '#0b080e');
    pc.px(x, fy + fh, G3);
    pc.px(x, fy + fh + 1, P.ink);
    // Outer hairlines, fading toward the middle
    const t = Math.abs(x - w / 2) / (w / 2 - E);
    if (t > 0.35) {
      pc.px(x, fy - 4, G3, (t - 0.35) * 1.5);
      pc.px(x, fy + fh + 3, G3, (t - 0.35) * 1.5);
    }
  }
  const fw = w - 2 * E;
  // Diamond notches on the rails
  for (const k of [0.25, 0.5, 0.75]) {
    const nx = Math.round(E + fw * k);
    const big = k === 0.5 ? 3 : 2;
    for (const ny of [fy - 1, fy + fh]) {
      for (let dy = -big; dy <= big; dy++)
        for (let dx = -big; dx <= big; dx++) {
          const m = Math.abs(dx) + Math.abs(dy);
          if (m > big) continue;
          const yy = ny + dy;
          if (yy >= fy && yy < fy + fh) continue; // never over the blood
          pc.px(nx + dx, yy, m <= 1 ? G0 : G1);
        }
    }
  }
  // End pieces, mirrored
  for (const s of [1, -1]) {
    const X = (x: number) => (s > 0 ? x : w - 1 - x);
    const mid = fy + (fh - 1) / 2;
    for (let y = 1; y < h - 1; y++) {
      pc.px(X(E - 3), y, G1);
      pc.px(X(E - 2), y, G2);
    }
    pc.px(X(E - 3), 0, G2);
    pc.px(X(E - 3), h - 1, G3);
    // Spear tip outward
    for (let x = 1; x <= E - 4; x++) {
      const half = ((x - 1) / (E - 5)) * 3.5;
      for (let y = Math.ceil(mid - half); y <= Math.floor(mid + half); y++) pc.px(X(x), y, y < mid - half + 1 ? G0 : y > mid + half - 1 ? G3 : G2);
    }
    pc.px(X(E - 6), Math.round(mid), P.blood1);
    pc.px(X(E - 7), Math.round(mid), P.blood0);
    // Scrolls above and below the collar
    for (const [cy0, a0, a1] of [[3, Math.PI * 0.5, Math.PI * 2.2], [h - 4, -Math.PI * 0.5, -Math.PI * 2.2]] as [number, number, number][]) {
      for (let a = a0; Math.abs(a - a0) <= Math.abs(a1 - a0); a += a1 > a0 ? 0.08 : -0.08) {
        const k = 3 * (1 - (Math.abs(a - a0) / Math.abs(a1 - a0)) * 0.6);
        const xx = E - 7 + Math.cos(a) * k * 1.4;
        pc.px(X(Math.round(xx)), Math.round(cy0 + Math.sin(a) * k * 0.8), G1);
      }
    }
  }
  pc.outline(P.ink);
  return pc;
}

/** Build (once per width) the boss bar's frame, fill and trail. */
export function makeBossBar(scene: Phaser.Scene, w: number) {
  const k = `boss-frame-${w}`;
  if (!scene.textures.exists(k)) {
    registerImage(scene, k, bossFrame(w));
    registerImage(scene, `boss-fill-${w}`, barFill(w - 2 * BOSS_END, BOSS_FH, FILLS.hp));
    registerImage(scene, `boss-trail-${w}`, barFill(w - 2 * BOSS_END, BOSS_FH, ['#fff4e8', '#f0d8c8', '#e8d0c0', '#c8a898']));
  }
  return { frame: k, fill: `boss-fill-${w}`, trail: `boss-trail-${w}` };
}

// ---------------------------------------------------------------------------
// Menu furniture: ornamental rule, selected-row bar
// ---------------------------------------------------------------------------

/** A gilt rule tapering from a central diamond (beneath headings). */
export function makeRule(scene: Phaser.Scene, w: number) {
  const key = `ui-rule-${w}`;
  if (scene.textures.exists(key)) return key;
  const h = 9;
  const pc = new PixelCanvas(w, h);
  const c = Math.floor(w / 2);
  for (let x = 0; x < w; x++) {
    const dx = Math.abs(x - c);
    const f = 1 - dx / (w / 2);
    if (f <= 0) continue;
    pc.px(x, 4, G2, Math.min(1, Math.pow(f, 0.8) * 1.1));
    if (dx > 5 && dx < w * 0.2) {
      const g = 1 - dx / (w * 0.2);
      pc.px(x, 2, G3, g);
      pc.px(x, 6, G3, g);
    }
  }
  for (const s of [-1, 1]) {
    const dx = c + s * 11;
    pc.px(dx, 3, G1);
    pc.px(dx, 5, G1);
    pc.px(dx - 1, 4, G1);
    pc.px(dx + 1, 4, G1);
    pc.px(dx, 4, G0);
  }
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const m = Math.abs(dx) + Math.abs(dy);
      if (m === 4) pc.px(c + dx, 4 + dy, P.ink);
      else if (m < 4) pc.px(c + dx, 4 + dy, m <= 1 ? G0 : dx + dy < 0 ? G1 : G2);
    }
  pc.px(c, 4, P.blood1);
  registerImage(scene, key, pc);
  return key;
}

/** The selected row: a soft band of gold bleeding into crimson. */
export function makeSelBar(scene: Phaser.Scene, w: number, h: number) {
  const key = `ui-sel-${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    const ny = (y - (h - 1) / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const col = t < 0.45 ? qmix(G2, P.blood2, t / 0.45) : qmix(P.blood2, P.blood3, (t - 0.45) / 0.55);
      const a = (0.5 * Math.pow(1 - t, 0.9) + 0.08) * (1 - 0.5 * ny * ny);
      if (y === 0 || y === h - 1) pc.px(x, y, G1, 0.85 * Math.pow(1 - t, 1.4));
      else pc.px(x, y, col, a);
    }
  }
  // Cursor jewel
  const my = Math.floor((h - 1) / 2);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const m = Math.abs(dx) + Math.abs(dy);
    if (m <= 2) pc.px(3 + dx, my + dy, m === 0 ? G0 : m === 1 ? G1 : G2);
  }
  registerImage(scene, key, pc);
  return key;
}

function eyeIcon(): PixelCanvas {
  const pc = new PixelCanvas(15, 11);
  pc.ellipse(7, 5, 6, 3, P.marble0);
  pc.ellipse(7, 5, 2, 2, P.lucid1);
  pc.px(7, 5, P.ink);
  pc.px(6, 4, P.white);
  pc.line(1, 5, 4, 2, P.ink);
  pc.line(13, 5, 10, 2, P.ink);
  pc.outline(P.ink);
  return pc;
}

function censerIcon(): PixelCanvas {
  const pc = new PixelCanvas(13, 14);
  pc.line(6, 0, 6, 3, P.iron0);
  pc.ellipse(6, 4, 2, 1, P.brass0);
  pc.poly(
    [
      [2, 5],
      [10, 5],
      [11, 10],
      [1, 10],
    ],
    P.brass1,
  );
  pc.rect(3, 5, 2, 5, P.brass0);
  pc.ellipse(6, 11, 5, 2, P.brass2);
  pc.px(5, 8, P.candle);
  pc.px(8, 8, P.candle);
  pc.outline(P.ink);
  return pc;
}

function tearIcon(): PixelCanvas {
  const pc = new PixelCanvas(9, 12);
  pc.ellipse(4, 7, 3, 3, P.tear1);
  pc.px(4, 2, P.tear1);
  pc.px(4, 3, P.tear1);
  pc.px(3, 4, P.tear1);
  pc.px(5, 4, P.tear1);
  pc.px(3, 6, P.white);
  pc.outline(P.ink);
  return pc;
}

function vertebraIcon(): PixelCanvas {
  const pc = new PixelCanvas(12, 10);
  pc.ellipse(6, 5, 3, 2, P.bone0);
  pc.rect(1, 4, 10, 2, P.bone1);
  pc.rect(5, 1, 2, 3, P.bone1);
  pc.ellipse(6, 5, 1, 1, P.bone3);
  pc.outline(P.ink);
  return pc;
}

function sinIcon(): PixelCanvas {
  // Weight of Sin: a millstone with a red cord
  const pc = new PixelCanvas(13, 13);
  pc.ellipse(6, 7, 5, 5, P.iron1);
  pc.ellipse(6, 7, 1, 1, P.ink);
  pc.line(6, 0, 6, 5, P.blood1);
  pc.px(3, 5, P.iron0);
  pc.outline(P.ink);
  return pc;
}

/**
 * Deep navy-slate panel in a thin double gilt rule, with jewelled filigree
 * corners and a soft inner vignette. Generated once per size.
 */
export function makePanel(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / (w / 2);
      const ny = (y - cy) / (h / 2);
      // Vignette: darker toward the rule, darkest in the corners
      const ex = Math.max(0, 1 - Math.min(x, w - 1 - x) / 26);
      const ey = Math.max(0, 1 - Math.min(y, h - 1 - y) / 22);
      const e = Math.min(1, (nx * nx * 0.35 + ny * ny * 0.45) * 0.55 + Math.max(ex, ey) * 0.55 + ex * ey * 0.3);
      let c = qmix('#1d2638', '#080b13', e);
      const n = hash2(x >> 1, y >> 1, 11);
      if (n > 0.94) c = qmix(c, '#2c364c', 0.45);
      else if (n < 0.05) c = qmix(c, '#04060b', 0.5);
      pc.px(x, y, c);
    }
  }
  const ring = (i: number, f: (x: number, y: number) => string | null) => {
    const put = (x: number, y: number) => {
      const c = f(x, y);
      if (c) pc.px(x, y, c);
    };
    for (let x = i; x < w - i; x++) {
      put(x, i);
      put(x, h - 1 - i);
    }
    for (let y = i; y < h - i; y++) {
      put(i, y);
      put(w - 1 - i, y);
    }
  };
  ring(0, () => P.ink);
  ring(1, (x, y) => (y === 1 || x === 1 ? G1 : G2));
  ring(2, () => '#05070c');
  ring(4, (x, y) => (y === 4 || x === 4 ? G2 : G3));
  // Filigree corners
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const ox = sx > 0 ? 0 : w - 1;
    const oy = sy > 0 ? 0 : h - 1;
    const put = (dx: number, dy: number, c: string, a = 1) => pc.px(ox + sx * dx, oy + sy * dy, c, a);
    // Spurs along the inner rule
    for (let k = 9; k < 22; k++) {
      put(k, 4, k < 15 ? G1 : G2);
      put(4, k, k < 15 ? G1 : G2);
    }
    for (const k of [17, 20]) {
      put(k, 5, G1);
      put(5, k, G1);
    }
    // A bracket arc curving inside the corner
    for (let a = 0; a <= Math.PI / 2; a += 0.05) {
      put(Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), G2);
    }
    put(13, 8, G1);
    put(8, 13, G1);
    put(10, 10, G0);
    put(11, 11, G2);
    // Corner jewel over the rules
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        const X = 4 + dx;
        const Y = 4 + dy;
        if (X < 0 || Y < 0) continue;
        if (m === 4) put(X, Y, P.ink);
        else if (m < 4) put(X, Y, m <= 1 ? G0 : dx * sx + dy * sy < 0 ? G1 : G2);
      }
    put(4, 4, P.blood1);
  }
  // Crowning ornament on the top and bottom rules
  for (const [yy, s] of [[1, 1], [h - 2, -1]] as [number, number][]) {
    const mx = Math.floor(w / 2);
    for (let dx = -18; dx <= 18; dx++) {
      const f = 1 - Math.abs(dx) / 18;
      pc.px(mx + dx, yy + s * 3, G2, f);
    }
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const m = Math.abs(dx) + Math.abs(dy);
        if (m <= 3) pc.px(mx + dx, yy + s * 1 + dy, m <= 1 ? G0 : G1);
      }
    pc.px(mx, yy + s, P.blood1);
  }
  registerImage(scene, key, pc);
  return key;
}

export function buildUi(scene: Phaser.Scene) {
  registerImage(scene, 'stick-base', ring(30, 2, P.bone2, '#1a0d10'));
  const knob = new PixelCanvas(25, 25);
  knob.ellipse(12, 12, 11, 11, (x, y) => (x + y < 20 ? P.bone1 : P.bone2));
  knob.ellipse(12, 12, 6, 6, P.blood2);
  knob.ellipse(11, 11, 2, 2, P.blood1);
  knob.outline(P.ink);
  registerImage(scene, 'stick-knob', knob);

  const rims: Record<string, string> = {
    attack: P.iron0,
    jump: P.bone2,
    dodge: P.smoke1,
    execute: P.blood1,
    maw: P.flesh2,
    helix: P.flesh2,
    tear: P.tear1,
    speak: G1,
    pause: P.bone2,
  };
  for (const [k, icon] of Object.entries(ICONS)) {
    const r = k === 'attack' ? 24 : k === 'jump' ? 22 : k === 'pause' ? 10 : 18;
    registerImage(scene, `btn-${k}`, button(r, rims[k], icon));
    registerImage(scene, `btn-${k}-down`, button(r, rims[k], icon, true));
  }
  // Run HUD: the portrait medallion and its three vials
  registerImage(scene, 'hud-medallion', medallion());
  registerImage(scene, 'hud-medallion-cracks', medallionCracks());
  registerImage(scene, 'hud-medallion-blood', medallionBlood());
  for (const [k, w, fh] of HUD_BARS) {
    registerImage(scene, `hud-bar-${k}`, barFrame(w, fh));
    registerImage(scene, `hud-fill-${k}`, barFill(w - BAR_CAP, fh, FILLS[k]));
  }
  registerImage(scene, 'hud-fill-trail', barFill(HUD_BARS[0][1] - BAR_CAP, HUD_BARS[0][2], ['#fff4e8', '#f0d8c8', '#e8d0c0', '#c8a898']));
  registerImage(scene, 'hud-fill-veil', barFill(HUD_BARS[0][1] - BAR_CAP, HUD_BARS[0][2], [P.veil0, P.veil0, P.veil1, P.veil1]));
  registerImage(scene, 'hud-coin-tear', coin('tear'));
  registerImage(scene, 'hud-coin-vert', coin('vert'));
  registerImage(scene, 'hud-mini-frame', miniFrame(MINI_W, MINI_H));
  registerImage(scene, 'icon-eye', eyeIcon());
  registerImage(scene, 'icon-censer', censerIcon());
  registerImage(scene, 'icon-tear', tearIcon());
  registerImage(scene, 'icon-vertebra', vertebraIcon());
  registerImage(scene, 'icon-sin', sinIcon());
}

/** A 1px gilt hairline fading out at both ends (row separators). */
export function makeSep(scene: Phaser.Scene, w: number) {
  const key = `ui-sep-${w}`;
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, 1);
  for (let x = 0; x < w; x++) pc.px(x, 0, G2, Math.pow(Math.sin((x / (w - 1)) * Math.PI), 0.7));
  registerImage(scene, key, pc);
  return key;
}
