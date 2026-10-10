import { P, darken } from './palette';
import { PixelCanvas, bayer, hash2, registerImage } from './pixel';
import { SheetBuilder } from './sheet';

function confessionalBooth(rot: boolean, open: boolean): PixelCanvas {
  const pc = new PixelCanvas(40, 56);
  const w0 = rot ? P.rot0 : P.wood0;
  const w1 = rot ? P.rot1 : P.wood1;
  const w2 = rot ? P.rot2 : P.wood2;
  // Spire
  pc.poly(
    [
      [4, 16],
      [20, 2],
      [36, 16],
    ],
    w1,
  );
  pc.poly(
    [
      [20, 2],
      [36, 16],
      [20, 16],
    ],
    w2,
  );
  pc.line(20, 0, 20, 6, rot ? P.bone1 : P.gold1);
  pc.line(18, 2, 22, 2, rot ? P.bone1 : P.gold1);
  // Body
  pc.rect(4, 16, 32, 38, w1);
  pc.rect(4, 16, 3, 38, w0);
  pc.rect(33, 16, 3, 38, w2);
  pc.rect(4, 16, 32, 2, w0);
  pc.rect(4, 52, 32, 2, w2);
  // Curtained doorway
  pc.rect(10, 22, 20, 30, P.ink);
  pc.ellipse(20, 22, 10, 4, P.ink);
  if (!open) {
    for (let x = 10; x < 30; x++) {
      for (let y = 20; y < 52; y++) {
        const nx = (x - 20) / 10.5;
        if (y < 22 && nx * nx + ((y - 22) / 4.5) ** 2 > 1) continue;
        const fold = x % 4;
        pc.px(x, y, fold === 0 ? P.blood3 : fold === 3 ? P.blood2 : P.blood1);
      }
    }
    // Curtain hem soaked
    for (let x = 10; x < 30; x++) if (hash2(x, 1, 3) < 0.5) pc.px(x, 52, P.blood3);
  } else {
    // A single candle inside, and the grille
    pc.px(20, 40, P.candle);
    pc.px(20, 41, P.bone0);
    pc.px(20, 42, P.bone0);
    for (let y = 26; y < 36; y++) for (let x = 24; x < 30; x++) if ((x + y) % 2 === 0) pc.px(x, y, w2);
  }
  if (rot) {
    // Flesh growing through the wood
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(hash2(i, 0, 21) * 36) + 2;
      const y = Math.floor(hash2(i, 1, 21) * 40) + 14;
      if (pc.alphaAt(x, y)) pc.ellipse(x, y, 1, 1, hash2(i, 2, 21) < 0.5 ? P.flesh2 : P.flesh3);
    }
  }
  pc.outline(P.ink);
  return pc;
}

function door(open: number, emblem: boolean): PixelCanvas {
  // A gothic archway with an iron portcullis; `open` 0..1 raises the bars.
  const pc = new PixelCanvas(32, 40);
  pc.rect(0, 6, 5, 34, P.wood2);
  pc.rect(27, 6, 5, 34, P.wood2);
  pc.rect(1, 6, 3, 34, P.wood1);
  pc.rect(28, 6, 3, 34, P.wood1);
  pc.poly(
    [
      [0, 10],
      [16, 0],
      [32, 10],
      [27, 10],
      [16, 4],
      [5, 10],
    ],
    P.wood0,
  );
  pc.rect(5, 10, 22, 30, P.ink);
  pc.poly(
    [
      [5, 10],
      [16, 4],
      [27, 10],
    ],
    P.ink,
  );
  const lift = Math.round(open * 28);
  for (let x = 7; x <= 25; x += 3) {
    for (let y = 6; y < 40 - lift; y++) pc.px(x, y, y > 38 - lift ? P.iron0 : P.iron1);
    pc.px(x, 39 - lift, P.iron0);
  }
  for (let y = 14 - lift; y < 40 - lift; y += 8) if (y > 5) pc.rect(6, y, 21, 1, P.iron2);
  if (emblem) pc.ellipse(16, 4, 2, 2, P.gold1);
  pc.outline(P.ink);
  return pc;
}

/** Small emblems shown above doors telling which room lies beyond. */
function emblem(kind: string): PixelCanvas {
  const pc = new PixelCanvas(13, 13);
  pc.ellipse(6, 6, 6, 6, P.ink);
  pc.ellipse(6, 6, 5, 5, P.shadow2);
  switch (kind) {
    case 'combat': // a skull
      pc.ellipse(6, 5, 3, 3, P.bone0);
      pc.rect(4, 8, 5, 2, P.bone0);
      pc.px(5, 5, P.ink);
      pc.px(7, 5, P.ink);
      pc.px(6, 9, P.ink);
      break;
    case 'elite': // a skull with a crown of thorns
      pc.ellipse(6, 6, 3, 3, P.bone0);
      pc.rect(4, 9, 5, 1, P.bone0);
      pc.px(5, 6, P.blood1);
      pc.px(7, 6, P.blood1);
      for (let x = 3; x <= 9; x += 2) pc.px(x, 2, P.blood1);
      pc.line(3, 3, 9, 3, P.blood2);
      break;
    case 'confessional': // a booth
      pc.poly(
        [
          [3, 5],
          [6, 2],
          [9, 5],
        ],
        P.wood0,
      );
      pc.rect(3, 5, 7, 6, P.wood1);
      pc.rect(5, 6, 3, 5, P.blood1);
      break;
    case 'votive': // a candle
      pc.rect(5, 5, 3, 6, P.bone0);
      pc.px(6, 3, P.candle);
      pc.px(6, 4, P.gold1);
      break;
    case 'cache': // a tear
      pc.ellipse(6, 7, 3, 3, P.tear1);
      pc.px(6, 3, P.tear1);
      pc.px(6, 4, P.tear1);
      pc.px(5, 6, P.tear0);
      break;
    case 'boss': // an ear
      pc.ellipse(6, 6, 3, 4, P.flesh1);
      pc.ellipse(6, 6, 1, 2, P.flesh3);
      pc.px(7, 4, P.blood1);
      break;
    case 'ascend': // a gate upward
      pc.rect(4, 3, 5, 8, P.gold1);
      pc.rect(5, 4, 3, 7, P.ink);
      break;
  }
  return pc;
}

function tearPickup(f: number): PixelCanvas {
  const pc = new PixelCanvas(9, 12);
  pc.ellipse(4, 7, 3, 3, P.tear1);
  pc.px(4, 2, P.tear1);
  pc.px(4, 3, P.tear1);
  pc.px(3, 4, P.tear1);
  pc.px(5, 4, P.tear1);
  pc.px(5, 8, P.tear2);
  pc.px(4, 9, P.tear2);
  pc.px(3, 6, f ? P.white : P.tear0);
  if (f) pc.px(2, 5, P.white);
  pc.outline(P.ink);
  return pc;
}

function vertebra(): PixelCanvas {
  const pc = new PixelCanvas(12, 10);
  pc.ellipse(6, 5, 3, 2, P.bone0);
  pc.rect(1, 4, 10, 2, P.bone1);
  pc.rect(5, 1, 2, 3, P.bone1);
  pc.ellipse(6, 5, 1, 1, P.bone3);
  pc.outline(P.ink);
  return pc;
}

function censerPendulum(): PixelCanvas {
  const pc = new PixelCanvas(20, 20);
  pc.poly(
    [
      [6, 5],
      [14, 5],
      [16, 12],
      [4, 12],
    ],
    P.brass1,
  );
  pc.rect(6, 5, 3, 7, P.brass0);
  pc.ellipse(10, 13, 6, 3, P.brass1);
  pc.rect(4, 12, 13, 1, P.brass2);
  pc.ellipse(10, 4, 3, 2, P.brass0);
  pc.px(10, 1, P.iron0);
  pc.px(10, 2, P.iron0);
  // Embers through the piercings
  pc.px(8, 9, P.candle);
  pc.px(12, 9, P.candle);
  pc.px(10, 10, P.blood0);
  pc.ellipse(10, 17, 3, 2, P.brass2);
  pc.outline(P.ink);
  return pc;
}

function candle(f: number): PixelCanvas {
  const pc = new PixelCanvas(7, 14);
  pc.rect(2, 7, 3, 6, P.bone0);
  pc.rect(4, 7, 1, 6, P.bone1);
  pc.px(2, 8, P.bone0);
  pc.px(1, 10, P.bone0); // drip
  pc.px(3, 6, P.ink);
  pc.px(3, 5 - f, P.gold1);
  pc.px(3, 4 - f, P.candle);
  pc.px(3 + (f ? 1 : -1), 3, P.candle);
  pc.outline(P.ink);
  return pc;
}

function votive(lit: boolean): PixelCanvas {
  const pc = new PixelCanvas(40, 36);
  // Stone altar with a weeping marble saint
  pc.rect(6, 22, 28, 12, P.marble2);
  pc.rect(6, 22, 28, 2, P.marble0);
  pc.rect(30, 24, 4, 10, P.marble3);
  pc.ellipse(20, 9, 4, 4, P.marble0);
  pc.poly(
    [
      [14, 22],
      [17, 13],
      [23, 13],
      [26, 22],
    ],
    P.marble1,
  );
  pc.px(19, 9, P.marble3);
  pc.px(21, 9, P.marble3);
  pc.px(19, 10, P.blood1);
  pc.px(19, 11, P.blood1);
  pc.px(21, 10, P.blood1);
  pc.line(20, 2, 20, 4, P.gold1);
  for (let i = 0; i < 5; i++) {
    const x = 9 + i * 5;
    pc.rect(x, 18 + (i % 2), 2, 4, P.bone0);
    if (lit) {
      pc.px(x, 16 + (i % 2), P.candle);
      pc.px(x, 17 + (i % 2), P.gold1);
    }
  }
  pc.outline(P.ink);
  return pc;
}

function cache(open: boolean): PixelCanvas {
  const pc = new PixelCanvas(26, 22);
  // A small reliquary casket
  pc.rect(2, 9, 22, 11, P.wood1);
  pc.rect(2, 9, 22, 2, P.gold2);
  pc.rect(2, 18, 22, 2, P.wood2);
  pc.rect(11, 11, 4, 4, P.gold1);
  if (open) {
    pc.rect(2, 3, 22, 4, P.wood2);
    pc.rect(4, 7, 18, 3, P.ink);
    pc.px(9, 8, P.tear0);
    pc.px(14, 8, P.tear1);
    pc.px(17, 8, P.tear0);
  } else {
    pc.poly(
      [
        [2, 9],
        [5, 4],
        [21, 4],
        [24, 9],
      ],
      P.wood0,
    );
    pc.rect(12, 4, 2, 5, P.gold1);
  }
  pc.outline(P.ink);
  return pc;
}

function thorns(up: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  // Iron thorns hidden in the floor
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 3;
    const y = 4 + (i % 2) * 6;
    if (up) {
      pc.line(x, y + 5, x, y, P.iron0);
      pc.px(x, y - 1, P.blood1);
      pc.px(x + 1, y + 5, P.iron2);
    } else pc.px(x, y + 4, P.iron2);
  }
  return pc;
}

function shadow(w: number, h: number): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  pc.ellipse((w - 1) / 2, (h - 1) / 2, (w - 1) / 2, (h - 1) / 2, (x, y, nx, ny) =>
    nx * nx + ny * ny < 0.55 || bayer(x, y) < 0.5 ? P.ink : null,
  );
  return pc;
}

function bloodDecal(seed: number): PixelCanvas {
  const pc = new PixelCanvas(24, 16);
  for (let i = 0; i < 9; i++) {
    const x = 12 + (hash2(i, seed, 1) - 0.5) * 16;
    const y = 8 + (hash2(seed, i, 2) - 0.5) * 9;
    const r = 1 + hash2(i, i, seed) * 2.5;
    pc.ellipse(x, y, r, r * 0.7, i % 3 ? P.blood2 : P.blood1);
  }
  pc.ellipse(12, 8, 4, 3, P.blood2);
  pc.px(11, 7, P.blood1);
  return pc;
}

function malicePool(f: number): PixelCanvas {
  // Bartholomew's vomited malice: a pool with screaming faces surfacing
  const pc = new PixelCanvas(36, 24);
  pc.ellipse(18, 12, 17, 10, (x, y) => (hash2(x, y, f + 3) < 0.15 ? P.bile1 : (x + y + f) % 7 === 0 ? P.bile0 : P.bile2));
  const faces = f ? [[10, 10], [24, 14]] : [[14, 13], [22, 8]];
  for (const [x, y] of faces) {
    pc.ellipse(x, y, 3, 3, P.bone1);
    pc.px(x - 1, y - 1, P.ink);
    pc.px(x + 1, y - 1, P.ink);
    pc.ellipse(x, y + 1, 1, 1 + f, P.ink);
  }
  return pc;
}

function projectile(kind: 'bile' | 'sludge' | 'ash'): PixelCanvas {
  const s = kind === 'sludge' ? 12 : 8;
  const pc = new PixelCanvas(s, s);
  const c0 = kind === 'bile' ? P.bile0 : kind === 'sludge' ? P.bile1 : P.smoke1;
  const c1 = kind === 'bile' ? P.bile1 : kind === 'sludge' ? P.bile2 : P.iron2;
  pc.ellipse((s - 1) / 2, (s - 1) / 2, s / 2 - 1, s / 2 - 1, (x, y) => (x + y < s - 2 ? c0 : c1));
  pc.px(s / 2 - 2, s / 2 - 2, P.white);
  pc.outline(P.ink);
  return pc;
}

function chainLink(): PixelCanvas {
  const pc = new PixelCanvas(4, 4);
  pc.rect(0, 1, 4, 2, P.iron1);
  pc.px(1, 1, P.iron0);
  pc.px(1, 0, P.iron1);
  pc.px(2, 3, P.iron2);
  return pc;
}

function chainHead(): PixelCanvas {
  // The Severed Tether's end: a rusted shackle grafted with vertebrae
  const pc = new PixelCanvas(12, 12);
  pc.ellipse(6, 6, 5, 5, (x, y) => (x + y < 10 ? P.iron0 : x + y > 14 ? P.iron2 : P.iron1));
  pc.ellipse(6, 6, 2, 2, P.ink);
  pc.px(3, 3, '#a85a3a');
  pc.px(8, 9, '#7a3a20');
  pc.px(9, 4, P.bone0);
  pc.px(2, 8, P.bone0);
  pc.outline(P.ink);
  return pc;
}

function softDot(r: number, color: string): PixelCanvas {
  const pc = new PixelCanvas(r * 2 + 1, r * 2 + 1);
  pc.ellipse(r, r, r, r, (x, y, nx, ny) => (nx * nx + ny * ny < 0.4 || bayer(x, y) < 0.5 ? color : null));
  return pc;
}

function light(r: number): PixelCanvas {
  // Radial glow used additively for candles and holy light.
  const pc = new PixelCanvas(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) {
    for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
      if (d < 1) pc.px(x, y, '#ffffff', Math.pow(1 - d, 2));
    }
  }
  return pc;
}

function grateLight(): PixelCanvas {
  // A dusty golden shaft falling from a street grate above.
  const pc = new PixelCanvas(40, 120);
  for (let y = 0; y < 120; y++) {
    const spread = 8 + y * 0.12;
    for (let x = 0; x < 40; x++) {
      const d = Math.abs(x - 20) / spread;
      if (d < 1) {
        const bars = Math.floor((x - 20 + spread) / 3) % 2 === 0 ? 1 : 0.55;
        pc.px(x, y, P.gold0, (1 - d) * 0.5 * (1 - y / 140) * bars);
      }
    }
  }
  return pc;
}

function bigEar(f: number): PixelCanvas {
  // Bartholomew's severed ear (phase three), pulsing with a heartbeat.
  const pc = new PixelCanvas(28, 30);
  const s = f ? 1 : 0;
  pc.ellipse(14, 15, 11 + s, 13 + s, (x, y, nx) => (nx > 0.3 ? P.flesh2 : P.flesh1));
  pc.ellipse(15, 15, 6, 8, P.flesh3);
  pc.ellipse(16, 16, 3, 5, P.flesh4);
  pc.ellipse(16, 18, 1, 2, P.ink);
  pc.line(6, 8, 10, 4, P.flesh0);
  // Torn root, gushing
  pc.rect(10, 26, 8, 3, P.blood1);
  pc.px(12, 29, P.blood2);
  pc.px(16, 29, P.blood2);
  pc.outline(P.ink);
  return pc;
}

function lectern(): PixelCanvas {
  // The Lineage: a book bound in skin on a bone lectern
  const pc = new PixelCanvas(24, 30);
  pc.rect(10, 14, 4, 14, P.bone1);
  pc.rect(6, 27, 12, 2, P.bone2);
  pc.poly(
    [
      [2, 8],
      [22, 8],
      [20, 15],
      [4, 15],
    ],
    '#7a4a40',
  );
  pc.rect(4, 9, 7, 5, '#e8dccb');
  pc.rect(13, 9, 7, 5, '#e8dccb');
  for (let y = 10; y < 14; y += 2) {
    pc.line(5, y, 9, y, P.marble3);
    pc.line(14, y, 18, y, P.marble3);
  }
  pc.line(12, 8, 12, 15, P.blood2);
  pc.px(12, 16, P.blood1);
  pc.px(12, 18, P.blood1);
  pc.outline(P.ink);
  return pc;
}

function decorBones(): PixelCanvas {
  const pc = new PixelCanvas(16, 10);
  pc.line(2, 7, 11, 4, P.bone1);
  pc.line(2, 8, 11, 5, P.bone2);
  pc.ellipse(2, 7, 1, 1, P.bone0);
  pc.ellipse(11, 4, 1, 1, P.bone0);
  pc.line(6, 8, 13, 8, P.bone1);
  pc.ellipse(13, 7, 2, 2, P.bone0);
  pc.px(12, 7, P.ink);
  pc.outline(P.ink);
  return pc;
}

function decorSkull(): PixelCanvas {
  const pc = new PixelCanvas(10, 9);
  pc.ellipse(5, 4, 3, 3, P.bone0);
  pc.rect(3, 6, 5, 2, P.bone1);
  pc.px(4, 4, P.ink);
  pc.px(6, 4, P.ink);
  pc.px(5, 7, P.ink);
  pc.outline(P.ink);
  return pc;
}

function decorRosary(): PixelCanvas {
  const pc = new PixelCanvas(16, 10);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 1.7;
    pc.px(8 + Math.round(Math.cos(a) * 6), 4 + Math.round(Math.sin(a) * 3), i % 4 ? P.bone1 : P.blood1);
  }
  pc.line(14, 5, 14, 9, P.gold2);
  pc.line(13, 7, 15, 7, P.gold2);
  return pc;
}

function decorScraps(): PixelCanvas {
  // Torn confession slips
  const pc = new PixelCanvas(16, 10);
  pc.poly(
    [
      [1, 3],
      [7, 1],
      [8, 6],
      [2, 8],
    ],
    '#e8dccb',
  );
  pc.poly(
    [
      [8, 5],
      [14, 4],
      [15, 9],
      [9, 9],
    ],
    '#d8cbb4',
  );
  pc.line(3, 4, 6, 3, P.marble3);
  pc.line(3, 6, 6, 5, P.marble3);
  pc.line(10, 6, 13, 6, P.marble3);
  pc.px(12, 8, P.blood2);
  pc.outline(P.ink);
  return pc;
}

function decorCandles(): PixelCanvas {
  const pc = new PixelCanvas(14, 12);
  for (const [x, h] of [
    [2, 6],
    [6, 8],
    [10, 5],
  ]) {
    pc.rect(x, 11 - h, 2, h, P.bone0);
    pc.px(x, 11 - h - 1, P.candle);
  }
  pc.rect(1, 10, 12, 2, P.bone1);
  pc.outline(P.ink);
  return pc;
}

export function buildProps(scene: Phaser.Scene) {
  registerImage(scene, 'decor-bones', decorBones());
  registerImage(scene, 'decor-skull', decorSkull());
  registerImage(scene, 'decor-rosary', decorRosary());
  registerImage(scene, 'decor-scraps', decorScraps());
  registerImage(scene, 'decor-candles', decorCandles());
  registerImage(scene, 'lectern', lectern());
  registerImage(scene, 'booth', confessionalBooth(false, false));
  registerImage(scene, 'booth-open', confessionalBooth(false, true));
  registerImage(scene, 'booth-rot', confessionalBooth(true, false));
  new SheetBuilder('door')
    .add('closed', [door(0, true)], 1, 0)
    .add('open', [0.25, 0.5, 0.75, 1].map((o) => door(o, true)), 12, 0)
    .build(scene);
  for (const k of ['combat', 'elite', 'confessional', 'votive', 'cache', 'boss', 'ascend']) {
    registerImage(scene, `emblem-${k}`, emblem(k));
  }
  new SheetBuilder('tear').add('spin', [tearPickup(0), tearPickup(1)], 3).build(scene);
  registerImage(scene, 'vertebra', vertebra());
  registerImage(scene, 'censer', censerPendulum());
  new SheetBuilder('candle').add('flicker', [candle(0), candle(1)], 6).build(scene);
  registerImage(scene, 'votive', votive(true));
  registerImage(scene, 'votive-spent', votive(false));
  registerImage(scene, 'cache', cache(false));
  registerImage(scene, 'cache-open', cache(true));
  registerImage(scene, 'thorns-down', thorns(false));
  registerImage(scene, 'thorns-up', thorns(true));
  registerImage(scene, 'shadow', shadow(16, 6));
  registerImage(scene, 'shadow-lg', shadow(32, 10));
  registerImage(scene, 'shadow-xl', shadow(72, 18));
  for (let i = 0; i < 4; i++) registerImage(scene, `blood-${i}`, bloodDecal(i + 1));
  new SheetBuilder('malice').add('boil', [malicePool(0), malicePool(1)], 4).build(scene);
  registerImage(scene, 'proj-bile', projectile('bile'));
  registerImage(scene, 'proj-sludge', projectile('sludge'));
  registerImage(scene, 'chain-link', chainLink());
  registerImage(scene, 'chain-head', chainHead());
  registerImage(scene, 'smoke', softDot(4, P.smoke0));
  registerImage(scene, 'dot-blood', softDot(1, P.blood1));
  registerImage(scene, 'light-sm', light(16));
  registerImage(scene, 'light-lg', light(48));
  registerImage(scene, 'grate-light', grateLight());
  const earDead = new PixelCanvas(28, 30);
  earDead.ellipse(14, 24, 12, 4, P.flesh2);
  earDead.ellipse(15, 24, 5, 2, P.flesh4);
  earDead.outline(P.ink);
  new SheetBuilder('ear').add('idle', [bigEar(0), bigEar(1)], 2).add('dead', [earDead], 1, 0).build(scene);
  const px = new PixelCanvas(2, 2);
  px.rect(0, 0, 2, 2, '#ffffff');
  registerImage(scene, 'px', px);
  const px1 = new PixelCanvas(1, 1);
  px1.px(0, 0, '#ffffff');
  registerImage(scene, 'px1', px1);
  void darken;
}
