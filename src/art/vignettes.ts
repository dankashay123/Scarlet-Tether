import { P, mix } from './palette';
import { PixelCanvas, bayer, hash2, registerImage } from './pixel';

/**
 * Key art: Sanctum, golden and sinless, above; the red tethers running down
 * from every home into the dark beneath.
 */
function sanctum(w: number, h: number, horizon: number): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  // Sky: dithered gradient from pale gold to cream
  for (let y = 0; y < horizon; y++) {
    const t = y / horizon;
    for (let x = 0; x < w; x++) {
      const c = t + (bayer(x, y) - 0.5) * 0.18;
      pc.px(x, y, c < 0.33 ? '#f6e7b8' : c < 0.66 ? '#f2d98e' : P.gold1);
    }
  }
  // The eternal sun
  pc.ellipse(w * 0.7, horizon * 0.35, 14, 14, P.holy);
  pc.ellipse(w * 0.7, horizon * 0.35, 18, 18, (x, y, nx, ny) => (nx * nx + ny * ny > 0.75 && bayer(x, y) < 0.5 ? P.gold0 : null));
  // Spires and domes
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 10 + Math.floor(hash2(i, 0, 5) * 18);
    const bh = 18 + Math.floor(hash2(i, 1, 5) * (horizon * 0.55));
    const top = horizon - bh;
    pc.rect(x, top, bw, bh, P.marble0);
    pc.rect(x + bw - 3, top, 3, bh, P.marble2);
    pc.rect(x, top, 1, bh, P.white);
    // Windows, all lit, all identical
    for (let wy = top + 4; wy < horizon - 3; wy += 6) for (let wx = x + 3; wx < x + bw - 4; wx += 4) pc.rect(wx, wy, 1, 2, P.gold1);
    const roof = hash2(i, 2, 5);
    if (roof < 0.45) {
      pc.ellipse(x + bw / 2, top, bw / 2, bw / 3, P.gold1);
      pc.ellipse(x + bw / 2 - 1, top - 1, bw / 4, bw / 6, P.gold0);
      pc.line(x + bw / 2, top - bw / 3 - 6, x + bw / 2, top - bw / 3, P.gold2);
    } else if (roof < 0.8) {
      pc.poly(
        [
          [x, top],
          [x + bw / 2, top - bw],
          [x + bw, top],
        ],
        P.marble1,
      );
      pc.line(x + bw / 2, top - bw - 4, x + bw / 2, top - bw, P.gold1);
    }
    x += bw + Math.floor(hash2(i, 3, 5) * 3);
    i++;
  }
  // The gilded street
  pc.rect(0, horizon, w, 4, P.gold2);
  pc.rect(0, horizon, w, 1, P.gold0);
  // Below: the dark, and the tethers
  for (let y = horizon + 4; y < h; y++) {
    const t = (y - horizon) / (h - horizon);
    for (let xx = 0; xx < w; xx++) {
      const c = t + (bayer(xx, y) - 0.5) * 0.2;
      pc.px(xx, y, c < 0.25 ? '#3a1a18' : c < 0.55 ? P.shadow : P.ink);
    }
  }
  for (let k = 0; k < 26; k++) {
    let tx = 6 + Math.floor(hash2(k, 4, 6) * (w - 12));
    for (let y = horizon + 4; y < h; y++) {
      if (hash2(k, y, 7) < 0.08) tx += hash2(k, y, 8) < 0.5 ? -1 : 1;
      pc.px(tx, y, mix(P.blood1, P.blood3, (y - horizon) / (h - horizon)));
    }
  }
  return pc;
}

/** A single citizen in close-up for the succession card: smiling, then not. */
function portrait(skin: string, hair: string, weeping: boolean): PixelCanvas {
  const pc = new PixelCanvas(48, 48);
  pc.ellipse(24, 26, 14, 16, skin);
  pc.ellipse(24, 14, 15, 9, hair);
  pc.rect(9, 14, 4, 16, hair);
  pc.rect(35, 14, 4, 16, hair);
  pc.rect(18, 26, 3, 2, P.ink);
  pc.rect(28, 26, 3, 2, P.ink);
  if (weeping) {
    pc.line(19, 28, 19, 40, P.blood1);
    pc.line(29, 28, 30, 42, P.blood1);
    pc.ellipse(24, 36, 3, 2, P.ink);
  } else {
    pc.line(19, 34, 21, 36, P.ink);
    pc.line(21, 36, 27, 36, P.ink);
    pc.line(27, 36, 29, 34, P.ink);
  }
  pc.rect(16, 42, 16, 6, P.cloth0);
  pc.outline(P.ink);
  return pc;
}

export function buildVignettes(scene: Phaser.Scene) {
  registerImage(scene, 'sanctum', sanctum(420, 236, 110));
  registerImage(scene, 'sanctum-wide', sanctum(420, 140, 120));
}

export function buildPortraits(scene: Phaser.Scene, skin: string, hair: string) {
  registerImage(scene, 'portrait-smile', portrait(skin, hair, false));
  registerImage(scene, 'portrait-weep', portrait(skin, hair, true));
}
