import type { PixelCanvas } from './pixel';

/**
 * SNES look for generated art: snap every colour to the console's 15-bit
 * colour space (5 bits per channel), reduce a sprite to at most `colors`
 * colours (a SNES sprite palette holds 15 plus transparency), and clean out
 * the checkerboard dithering the painterly renderers produce, so surfaces
 * read as flat bands of colour like hand-pixelled 16-bit art.
 *
 *   snesify(canvas)                 sprites: 15 colours
 *   snesify(canvas, { colors: 48 }) backdrops/tiles: several palettes' worth
 */
export interface SnesOptions {
  /** Maximum colours (excluding transparency). */
  colors?: number;
  /** Replace isolated single pixels with their surroundings (kills dithering). */
  dedither?: boolean;
  /** Pixels below this alpha become transparent; above become opaque. */
  alphaCut?: number;
}

const to5 = (v: number) => {
  const q = Math.round((v / 255) * 31);
  return (q << 3) | (q >> 2);
};

interface Box {
  px: number[]; // packed rgb ints
}

function split(box: Box): [Box, Box] {
  let rmin = 255,
    rmax = 0,
    gmin = 255,
    gmax = 0,
    bmin = 255,
    bmax = 0;
  for (const c of box.px) {
    const r = c >> 16,
      g = (c >> 8) & 255,
      b = c & 255;
    if (r < rmin) rmin = r;
    if (r > rmax) rmax = r;
    if (g < gmin) gmin = g;
    if (g > gmax) gmax = g;
    if (b < bmin) bmin = b;
    if (b > bmax) bmax = b;
  }
  // Weight green a little (the eye is most sensitive to it)
  const rr = (rmax - rmin) * 0.9,
    gg = (gmax - gmin) * 1.1,
    bb = (bmax - bmin) * 0.8;
  const shift = rr >= gg && rr >= bb ? 16 : gg >= bb ? 8 : 0;
  const sorted = box.px.slice().sort((a, b) => ((a >> shift) & 255) - ((b >> shift) & 255));
  const mid = sorted.length >> 1;
  return [{ px: sorted.slice(0, mid) }, { px: sorted.slice(mid) }];
}

function spread(box: Box) {
  let lo = [255, 255, 255],
    hi = [0, 0, 0];
  for (const c of box.px) {
    const v = [c >> 16, (c >> 8) & 255, c & 255];
    for (let i = 0; i < 3; i++) {
      if (v[i] < lo[i]) lo[i] = v[i];
      if (v[i] > hi[i]) hi[i] = v[i];
    }
  }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * Math.sqrt(box.px.length);
}

function mean(box: Box): [number, number, number] {
  let r = 0,
    g = 0,
    b = 0;
  for (const c of box.px) {
    r += c >> 16;
    g += (c >> 8) & 255;
    b += c & 255;
  }
  const n = Math.max(1, box.px.length);
  return [to5(r / n), to5(g / n), to5(b / n)];
}

/** Quantize a canvas in place to an SNES-like palette. Returns the palette. */
export function snesify(pc: PixelCanvas, opts: SnesOptions = {}): [number, number, number][] {
  const colors = opts.colors ?? 15;
  const cut = opts.alphaCut ?? 110;
  const d = pc.data;
  const n = pc.w * pc.h;
  const px: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    if (a < cut) {
      d[i * 4 + 3] = 0;
      continue;
    }
    d[i * 4 + 3] = 255;
    px.push((to5(d[i * 4]) << 16) | (to5(d[i * 4 + 1]) << 8) | to5(d[i * 4 + 2]));
  }
  if (!px.length) return [];
  // Median cut
  const boxes: Box[] = [{ px }];
  while (boxes.length < colors) {
    let bi = -1,
      bs = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].px.length < 2) continue;
      const s = spread(boxes[i]);
      if (s > bs) ((bs = s), (bi = i));
    }
    if (bi < 0 || bs <= 0) break;
    const [a, b] = split(boxes[bi]);
    boxes.splice(bi, 1, a, b);
  }
  const pal = boxes.map(mean);
  // Map each pixel to its nearest palette entry (cached per colour)
  const cache = new Map<number, number>();
  const idx = new Int16Array(n).fill(-1);
  const near = (c: number) => {
    let k = cache.get(c);
    if (k !== undefined) return k;
    const r = c >> 16,
      g = (c >> 8) & 255,
      b = c & 255;
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const dr = r - pal[i][0],
        dg = g - pal[i][1],
        db = b - pal[i][2];
      const dd = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
      if (dd < bd) ((bd = dd), (best = i));
    }
    cache.set(c, best);
    return best;
  };
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] === 0) continue;
    idx[i] = near((to5(d[i * 4]) << 16) | (to5(d[i * 4 + 1]) << 8) | to5(d[i * 4 + 2]));
  }
  // Dedither: a pixel unlike all four neighbours, which agree, joins them
  if (opts.dedither ?? true) {
    const w = pc.w;
    const src = idx.slice();
    for (let y = 1; y < pc.h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const c = src[i];
        if (c < 0) continue;
        const l = src[i - 1],
          r = src[i + 1],
          u = src[i - w],
          dn = src[i + w];
        if (l >= 0 && l === r && l === u && l === dn && l !== c) idx[i] = l;
        else if (l >= 0 && l === r && l !== c && u !== c && dn !== c && (u === l || dn === l)) idx[i] = l;
      }
  }
  for (let i = 0; i < n; i++) {
    const k = idx[i];
    if (k < 0) continue;
    d[i * 4] = pal[k][0];
    d[i * 4 + 1] = pal[k][1];
    d[i * 4 + 2] = pal[k][2];
  }
  return pal;
}
