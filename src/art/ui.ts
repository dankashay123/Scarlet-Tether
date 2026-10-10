import { P, darken } from './palette';
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

function reliquaryFrame(w: number): PixelCanvas {
  // The Sanguine Reliquary: a long glass vial in gilt caps.
  const pc = new PixelCanvas(w, 14);
  pc.rect(6, 3, w - 12, 8, '#2a1a20');
  pc.rect(6, 3, w - 12, 1, '#6a5a64');
  pc.rect(6, 10, w - 12, 1, '#1a0d10');
  for (const x of [0, w - 7]) {
    pc.rect(x, 1, 7, 12, P.gold2);
    pc.rect(x + 1, 2, 5, 10, P.gold1);
    pc.rect(x + 2, 3, 1, 8, P.gold0);
    pc.px(x + 3, 0, P.gold2);
    pc.px(x + 3, 13, P.gold2);
  }
  pc.outline(P.ink);
  return pc;
}

function cracks(w: number): PixelCanvas {
  const pc = new PixelCanvas(w, 14);
  let x = 10;
  while (x < w - 10) {
    let y = 3;
    let cx = x;
    while (y < 11) {
      pc.px(cx, y, P.white, 0.7);
      y++;
      cx += hash2(cx, y, 2) < 0.5 ? -1 : 1;
    }
    x += 9 + Math.floor(hash2(x, 0, 4) * 14);
  }
  return pc;
}

function barFrame(w: number, rim: string): PixelCanvas {
  const pc = new PixelCanvas(w, 8);
  pc.rect(1, 1, w - 2, 6, '#1a0d10');
  pc.strokeRect(0, 0, w, 8, rim);
  pc.outline(P.ink);
  return pc;
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

/** Skin-bound book panel, generated at any size. */
export function makePanel(scene: Phaser.Scene, key: string, w: number, h: number) {
  if (scene.textures.exists(key)) return key;
  const pc = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x >> 1, y >> 1, 5);
      pc.px(x, y, n < 0.1 ? '#4a2a28' : n > 0.92 ? '#7a4a40' : bayer(x, y) < 0.5 ? '#5e3732' : '#603934');
    }
  }
  // Inner page
  pc.rect(6, 6, w - 12, h - 12, '#1a0f10');
  pc.rect(7, 7, w - 14, h - 14, '#24161a');
  // Stitching
  for (let x = 4; x < w - 4; x += 4) {
    pc.px(x, 3, P.bone1);
    pc.px(x + 1, 3, P.bone2);
    pc.px(x, h - 4, P.bone1);
    pc.px(x + 1, h - 4, P.bone2);
  }
  for (let y = 4; y < h - 4; y += 4) {
    pc.px(3, y, P.bone1);
    pc.px(3, y + 1, P.bone2);
    pc.px(w - 4, y, P.bone1);
    pc.px(w - 4, y + 1, P.bone2);
  }
  // Gilt corners
  for (const [cx, cy] of [
    [0, 0],
    [w - 6, 0],
    [0, h - 6],
    [w - 6, h - 6],
  ]) {
    pc.rect(cx, cy, 6, 6, P.gold2);
    pc.rect(cx + 1, cy + 1, 4, 4, P.gold1);
    pc.px(cx + 2, cy + 2, P.gold0);
  }
  pc.strokeRect(0, 0, w, h, P.ink);
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
    dodge: P.smoke1,
    execute: P.blood1,
    maw: P.flesh2,
    helix: P.flesh2,
    tear: P.tear1,
    speak: P.gold1,
    pause: P.bone2,
  };
  for (const [k, icon] of Object.entries(ICONS)) {
    const r = k === 'attack' ? 24 : k === 'pause' ? 10 : 18;
    registerImage(scene, `btn-${k}`, button(r, rims[k], icon));
    registerImage(scene, `btn-${k}-down`, button(r, rims[k], icon, true));
  }
  registerImage(scene, 'reliquary', reliquaryFrame(120));
  registerImage(scene, 'reliquary-cracks', cracks(120));
  registerImage(scene, 'bar-censer', barFrame(84, P.brass1));
  registerImage(scene, 'bar-lucid', barFrame(84, P.lucid2));
  registerImage(scene, 'icon-eye', eyeIcon());
  registerImage(scene, 'icon-censer', censerIcon());
  registerImage(scene, 'icon-tear', tearIcon());
  registerImage(scene, 'icon-vertebra', vertebraIcon());
  registerImage(scene, 'icon-sin', sinIcon());
}
