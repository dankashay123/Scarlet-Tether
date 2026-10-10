import { P, darken } from './palette';
import { PixelCanvas, hash2 } from './pixel';
import { SheetBuilder } from './sheet';

// Bartholomew, The Swollen Ear: a cleric bloat-fused into a confessional
// booth, his head become one vast twitching ear.

interface BPose {
  twitch: number; // ear twitch 0/1
  arms: 'rest' | 'up' | 'down';
  mouth: 'sewn' | 'open' | 'torn';
  ear: boolean;
  slump: number;
}

const W = 104;
const H = 112;

function drawBartholomew(p: BPose): PixelCanvas {
  const pc = new PixelCanvas(W, H);
  const s = p.slump;
  // --- The booth ---
  const bx = 22;
  const by = 46 + s;
  const bw = 60;
  const bh = 62 - s;
  pc.rect(bx, by, bw, bh, P.wood1);
  pc.rect(bx, by, 4, bh, P.wood0);
  pc.rect(bx + bw - 4, by, 4, bh, P.wood2);
  pc.rect(bx, by, bw, 3, P.wood0);
  pc.rect(bx, by + bh - 3, bw, 3, P.wood3);
  // Carved trefoils
  for (const ox of [bx + 6, bx + bw - 14]) {
    pc.strokeRect(ox, by + 8, 8, 20, P.wood2);
    pc.ellipse(ox + 4, by + 8, 3, 3, P.wood2);
    pc.strokeRect(ox, by + 34, 8, bh - 42, P.wood2);
  }
  // Gilt trim
  for (let x = bx; x < bx + bw; x += 3) pc.px(x, by + 3, P.gold2);
  // --- The bloated body bulging out of the booth door ---
  const cx = 52;
  const cy = 76 + s;
  pc.ellipse(cx, cy, 20, 24, (x, y, nx, ny) => {
    if (nx > 0.45 || ny > 0.6) return P.flesh2;
    if (nx < -0.5 && ny < -0.2) return P.flesh0;
    return hash2(x, y, 6) < 0.05 ? P.flesh3 : P.flesh1;
  });
  // Stretch marks and veins
  pc.line(38, 62 + s, 44, 80 + s, P.flesh3);
  pc.line(64, 60 + s, 62, 74 + s, P.flesh3);
  pc.line(46, 90 + s, 58, 92 + s, P.flesh3);
  // Vestment scraps: a torn purple stole
  pc.poly(
    [
      [40, 54 + s],
      [46, 54 + s],
      [44, 98 + s],
      [38, 98 + s],
    ],
    '#4a2a5a',
  );
  pc.poly(
    [
      [58, 54 + s],
      [64, 54 + s],
      [66, 98 + s],
      [60, 98 + s],
    ],
    '#4a2a5a',
  );
  for (let y = 58; y < 98; y += 8) {
    pc.px(42, y + s, P.gold1);
    pc.px(62, y + s, P.gold1);
  }
  // The mouth, at the belly — sewn shut with a rosary
  const my = 80 + s;
  if (p.mouth === 'sewn') {
    pc.rect(42, my, 20, 2, P.flesh4);
    for (let x = 43; x <= 61; x += 3) {
      pc.px(x, my - 2, P.bone0);
      pc.px(x, my - 1, P.ink);
      pc.px(x, my + 2, P.ink);
      pc.px(x, my + 3, P.bone0);
    }
    pc.px(52, my + 5, P.gold1);
    pc.line(52, my + 4, 52, my + 8, P.bone0);
    pc.line(50, my + 6, 54, my + 6, P.bone0);
  } else {
    pc.ellipse(52, my + 2, 11, p.mouth === 'open' ? 8 : 6, P.ink);
    pc.ellipse(52, my + 4, 7, 4, P.bile1);
    pc.px(52, my + 3, P.bile0);
    for (let x = 43; x <= 61; x += 3) {
      pc.px(x, my - 5, P.bone0);
      pc.px(x + 1, my + 8, P.bone0);
    }
    // Snapped rosary beads dangling
    for (let i = 0; i < 5; i++) pc.px(40 - i, my + i * 2, P.bone0);
    for (let i = 0; i < 4; i++) pc.px(64 + i, my + i * 2, P.bone0);
  }
  // --- Arms ---
  const arm = (side: -1 | 1) => {
    const sx = cx + side * 18;
    const sy = 64 + s;
    let hx = cx + side * 34;
    let hy = 90 + s;
    if (p.arms === 'up') {
      hx = cx + side * 30;
      hy = 22 + s;
    } else if (p.arms === 'down') {
      hx = cx + side * 36;
      hy = 102;
    }
    pc.thickLine(sx, sy, (sx + hx) / 2 + side * 6, (sy + hy) / 2, 4, P.flesh1);
    pc.thickLine((sx + hx) / 2 + side * 6, (sy + hy) / 2, hx, hy, 4, P.flesh2);
    pc.ellipse(hx, hy, 6, 5, P.flesh1);
    for (let f = -2; f <= 2; f++) pc.thickLine(hx + f * 2, hy, hx + f * 3, hy + 6, 0.8, P.flesh2);
    pc.px(hx - side * 2, hy - 2, P.flesh0);
  };
  arm(-1);
  arm(1);
  // --- The Swollen Ear (head) ---
  if (p.ear) {
    const ex = 52 + (p.twitch ? 2 : 0);
    const ey = 28 + s;
    pc.ellipse(ex, ey, 18, 24, (x, y, nx) => (nx > 0.35 ? P.flesh2 : nx < -0.5 ? P.flesh0 : P.flesh1));
    pc.ellipse(ex + 3, ey, 11, 16, P.flesh3);
    pc.ellipse(ex + 5, ey + 2, 6, 10, P.flesh4);
    pc.ellipse(ex + 6, ey + 6, 2, 4, P.ink);
    // Helix rim fold
    pc.line(ex - 12, ey - 14, ex - 2, ey - 22, P.flesh0);
    pc.line(ex - 15, ey - 4, ex - 14, ey + 10, P.flesh0);
    // Lobe
    pc.ellipse(ex - 2, ey + 22, 6, 5, P.flesh1);
    // Wax and blood
    pc.px(ex + 7, ey + 9, P.bile0);
    pc.px(ex + 6, ey + 11, P.blood1);
    // Neck stalk into the booth
    pc.rect(44, 46 + s, 16, 6, P.flesh2);
  } else {
    // Torn stump, gushing
    pc.ellipse(52, 48 + s, 10, 5, P.blood2);
    pc.ellipse(52, 47 + s, 7, 3, P.blood1);
    pc.ellipse(52, 46 + s, 3, 1, P.blood0);
    for (let i = 0; i < 6; i++) pc.px(44 + i * 3, 52 + s + (i % 2), P.blood1);
  }
  pc.outline(P.ink);
  return pc;
}

function drawCorpse(): PixelCanvas {
  const pc = new PixelCanvas(W, H);
  // The booth split open, the body deflated across the floor
  pc.rect(22, 70, 60, 38, darken(P.wood1, 0.2));
  pc.rect(22, 70, 60, 3, P.wood0);
  pc.ellipse(52, 96, 34, 10, (x, y) => (y > 98 ? P.flesh2 : P.flesh1));
  pc.ellipse(52, 96, 10, 4, P.ink);
  pc.ellipse(80, 100, 12, 4, P.blood2);
  for (let i = 0; i < 9; i++) pc.px(30 + i * 5, 106, P.bone0);
  pc.outline(P.ink);
  return pc;
}

export function buildBossSheet(scene: Phaser.Scene) {
  const base: BPose = { twitch: 0, arms: 'rest', mouth: 'sewn', ear: true, slump: 0 };
  new SheetBuilder('bart')
    .add('idle', [drawBartholomew(base), drawBartholomew({ ...base, twitch: 1, slump: 1 })], 3)
    .add('windup', [drawBartholomew({ ...base, arms: 'up' })], 1, 0)
    .add('slam', [drawBartholomew({ ...base, arms: 'down', slump: 2 })], 1, 0)
    .add('idle2', [drawBartholomew({ ...base, mouth: 'torn' }), drawBartholomew({ ...base, mouth: 'torn', twitch: 1, slump: 1 })], 3)
    .add('windup2', [drawBartholomew({ ...base, mouth: 'torn', arms: 'up' })], 1, 0)
    .add('slam2', [drawBartholomew({ ...base, mouth: 'torn', arms: 'down', slump: 2 })], 1, 0)
    .add('vomit', [drawBartholomew({ ...base, mouth: 'open', slump: 2 })], 1, 0)
    .add('earless', [drawBartholomew({ ...base, mouth: 'torn', ear: false, slump: 4 }), drawBartholomew({ ...base, mouth: 'open', ear: false, slump: 5 })], 2)
    .add('dead', [drawCorpse()], 1, 0)
    .build(scene);
}
