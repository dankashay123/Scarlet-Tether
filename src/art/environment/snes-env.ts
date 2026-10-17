import { PixelCanvas } from '../pixel';
import { snesify } from '../snes';

/**
 * SNES finishing passes for environment art (see docs/SNES_PIVOT.md).
 *
 *  - snesLayer: backdrops. Quantise to a few palettes' worth of 15-bit colour;
 *    translucent pixels (haze, mist, webs) keep a single 50% level, like the
 *    console's colour-math half transparency.
 *  - snesStrip: tile strips. One palette for the strip, dedithered tile by tile
 *    so nothing bleeds across tile seams.
 *  - Sprite props are drawn at 2x and reduced (`reduce2`), which resolves the
 *    renderer's ordered dither into flat bands, then outlined and quantised to a
 *    sprite palette (`finishSprite`).
 */

/** Alpha levels: below `lo` transparent, below `hi` half, else opaque. */
function alphaLevels(pc: PixelCanvas, lo: number, hi: number): Uint8Array {
  const d = pc.data;
  const n = pc.w * pc.h;
  const A = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    A[i] = a < lo ? 0 : a < hi ? 128 : 255;
    d[i * 4 + 3] = A[i] ? 255 : 0;
  }
  return A;
}

const x5 = (q: number) => (q << 3) | (q >> 2);
const q5 = (v: number) => Math.round((v / 255) * 31);

/**
 * The same quantiser as snesify (15-bit snap, weighted median cut, nearest
 * colour with snesify's channel weights) run on a 15-bit histogram, so a
 * 512x224 layer costs a few ms instead of ~100. Opaque pixels only
 * (alpha >= 128); no dedither (see `dedither`).
 */
export function quantize(pc: PixelCanvas, colors: number): [number, number, number][] {
  const d = pc.data;
  const n = pc.w * pc.h;
  const cnt = new Uint32Array(32768);
  const key = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (d[i * 4 + 3] < 128) continue;
    const k = (q5(d[i * 4]) << 10) | (q5(d[i * 4 + 1]) << 5) | q5(d[i * 4 + 2]);
    key[i] = k;
    cnt[k]++;
  }
  const uniq: number[] = [];
  for (let k = 0; k < 32768; k++) if (cnt[k]) uniq.push(k);
  if (!uniq.length) return [];
  const ch = (k: number, c: number) => x5((k >> (10 - c * 5)) & 31);
  type Box = { keys: number[]; w: number };
  const boxes: Box[] = [{ keys: uniq, w: n }];
  const spread = (b: Box) => {
    const lo = [255, 255, 255];
    const hi = [0, 0, 0];
    for (const k of b.keys)
      for (let c = 0; c < 3; c++) {
        const v = ch(k, c);
        if (v < lo[c]) lo[c] = v;
        if (v > hi[c]) hi[c] = v;
      }
    return { s: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) * Math.sqrt(b.w), lo, hi };
  };
  for (const b of boxes) {
    let w = 0;
    for (const k of b.keys) w += cnt[k];
    b.w = w;
  }
  while (boxes.length < colors) {
    let bi = -1;
    let bs = 0;
    let info: ReturnType<typeof spread> | null = null;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].keys.length < 2) continue;
      const sp = spread(boxes[i]);
      if (sp.s > bs) ((bs = sp.s), (bi = i), (info = sp));
    }
    if (bi < 0 || !info) break;
    const b = boxes[bi];
    const rr = (info.hi[0] - info.lo[0]) * 0.9;
    const gg = (info.hi[1] - info.lo[1]) * 1.1;
    const bb = (info.hi[2] - info.lo[2]) * 0.8;
    const c = rr >= gg && rr >= bb ? 0 : gg >= bb ? 1 : 2;
    const sorted = b.keys.slice().sort((p, q) => ch(p, c) - ch(q, c));
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += cnt[sorted[i]];
      cut = i + 1;
      if (acc >= b.w / 2) break;
    }
    const A = sorted.slice(0, cut);
    const B = sorted.slice(cut);
    let wa = 0;
    for (const k of A) wa += cnt[k];
    boxes.splice(bi, 1, { keys: A, w: wa }, { keys: B, w: b.w - wa });
  }
  const pal = boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const k of b.keys) {
      r += ch(k, 0) * cnt[k];
      g += ch(k, 1) * cnt[k];
      bl += ch(k, 2) * cnt[k];
    }
    const w = Math.max(1, b.w);
    return [x5(q5(r / w)), x5(q5(g / w)), x5(q5(bl / w))] as [number, number, number];
  });
  const lut = new Int16Array(32768).fill(-1);
  for (const k of uniq) {
    const r = ch(k, 0);
    const g = ch(k, 1);
    const b = ch(k, 2);
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const dr = r - pal[i][0];
      const dg = g - pal[i][1];
      const db = b - pal[i][2];
      const dd = dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.7;
      if (dd < bd) ((bd = dd), (best = i));
    }
    lut[k] = best;
  }
  for (let i = 0; i < n; i++) {
    if (key[i] < 0) continue;
    const p = pal[lut[key[i]]];
    d[i * 4] = p[0];
    d[i * 4 + 1] = p[1];
    d[i * 4 + 2] = p[2];
  }
  return pal;
}

export function snesLayer(pc: PixelCanvas, colors = 48): PixelCanvas {
  const A = alphaLevels(pc, 48, 176);
  quantize(pc, colors);
  dedither(pc);
  despeckle(pc);
  const d = pc.data;
  for (let i = 0; i < A.length; i++) d[i * 4 + 3] = A[i];
  return pc;
}

/**
 * Remove isolated dither pixels (same rule as snesify's dedither) without
 * looking across cell borders of size `cw` x `ch`.
 */
export function dedither(pc: PixelCanvas, cw = pc.w, ch = pc.h) {
  const { w, h } = pc;
  const d = pc.data;
  const n = w * h;
  const src = new Int32Array(n);
  for (let i = 0; i < n; i++) src[i] = d[i * 4 + 3] < 128 ? -1 : (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
  for (let y = 0; y < h; y++) {
    const ly = y % ch;
    if (ly === 0 || ly === ch - 1) continue;
    for (let x = 0; x < w; x++) {
      const lx = x % cw;
      if (lx === 0 || lx === cw - 1) continue;
      const i = y * w + x;
      const c = src[i];
      if (c < 0) continue;
      const l = src[i - 1];
      const r = src[i + 1];
      const u = src[i - w];
      const dn = src[i + w];
      let to = -1;
      if (l >= 0 && l === r && l === u && l === dn && l !== c) to = l;
      else if (l >= 0 && l === r && l !== c && u !== c && dn !== c && (u === l || dn === l)) to = l;
      if (to >= 0) {
        d[i * 4] = to >> 16;
        d[i * 4 + 1] = (to >> 8) & 255;
        d[i * 4 + 2] = to & 255;
      }
    }
  }
}

/**
 * Remove speckle: an opaque pixel with no same-coloured pixel among its 8
 * neighbours takes the most common neighbour colour. Runs inside cells of
 * cw x ch (tile strips) so nothing crosses a seam. Lines survive (each line
 * pixel has same-coloured neighbours); lone noise pixels do not.
 */
export function despeckle(pc: PixelCanvas, cw = pc.w, ch = pc.h, passes = 2) {
  const { w, h } = pc;
  const d = pc.data;
  const n = w * h;
  const src = new Int32Array(n);
  const nb = new Int32Array(8);
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < n; i++) src[i] = d[i * 4 + 3] < 128 ? -1 : (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
    let changed = 0;
    for (let y = 0; y < h; y++) {
      const cy0 = y - (y % ch);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = src[i];
        if (c < 0) continue;
        const cx0 = x - (x % cw);
        let k = 0;
        let same = false;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            if (xx < cx0 || yy < cy0 || xx >= Math.min(w, cx0 + cw) || yy >= Math.min(h, cy0 + ch)) continue;
            const q = src[yy * w + xx];
            if (q < 0) continue;
            if (q === c) same = true;
            nb[k++] = q;
          }
        if (same || k < 5) continue;
        let best = -1;
        let bc = 0;
        for (let a = 0; a < k; a++) {
          let m = 0;
          for (let b = 0; b < k; b++) if (nb[b] === nb[a]) m++;
          if (m > bc) ((bc = m), (best = nb[a]));
        }
        if (best < 0 || bc < 2) continue;
        // only noise: a lone pixel close in value to its surroundings (keeps thin bars, glints, eyes)
        const lum = (v: number) => (v >> 16) * 0.3 + ((v >> 8) & 255) * 0.55 + (v & 255) * 0.15;
        if (Math.abs(lum(c) - lum(best)) > 34) continue;
        d[i * 4] = best >> 16;
        d[i * 4 + 1] = (best >> 8) & 255;
        d[i * 4 + 2] = best & 255;
        changed++;
      }
    }
    if (!changed) break;
  }
}

/** Quantise a tile strip to one palette, keeping translucency and tile seams. */
export function snesStrip(pc: PixelCanvas, colors = 32, tile = 16): PixelCanvas {
  const d = pc.data;
  const n = pc.w * pc.h;
  const A = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    A[i] = d[i * 4 + 3];
    d[i * 4 + 3] = A[i] ? 255 : 0;
  }
  quantize(pc, colors);
  dedither(pc, tile, tile);
  despeckle(pc, tile, tile);
  for (let i = 0; i < n; i++) {
    const a = A[i];
    // liquids are translucent: keep a few coarse levels
    d[i * 4 + 3] = a === 0 ? 0 : a > 240 ? 255 : Math.round(a / 32) * 32;
  }
  return pc;
}

/** Halve a canvas: 2x2 box filter, alpha weighted (resolves ordered dither into flat tone). */
export function reduce2(src: PixelCanvas, w = Math.ceil(src.w / 2), h = Math.ceil(src.h / 2)): PixelCanvas {
  const pc = new PixelCanvas(w, h);
  const s = src.data;
  const d = pc.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = 0; k < 4; k++) {
        const sx = x * 2 + (k & 1);
        const sy = y * 2 + (k >> 1);
        if (sx >= src.w || sy >= src.h) continue;
        const o = (sy * src.w + sx) * 4;
        const al = s[o + 3];
        r += s[o] * al;
        g += s[o + 1] * al;
        b += s[o + 2] * al;
        a += al;
      }
      if (a <= 0) continue;
      const o = (y * w + x) * 4;
      d[o] = r / a;
      d[o + 1] = g / a;
      d[o + 2] = b / a;
      d[o + 3] = a / 4;
    }
  return pc;
}

/**
 * Selective outline in the SNES manner: near-black where the sprite turns away
 * from the key light (upper left), a darkened shade of the sprite's own colour
 * on its lit top/left edges. Pixels below `cut` alpha are treated as empty.
 */
export function selout(pc: PixelCanvas, ink: [number, number, number] = [11, 5, 7], cut = 110) {
  const { w, h } = pc;
  const d = pc.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] >= cut;
  const marks: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      // lit side: the sprite lies to the right of or below this empty pixel
      const litN = solid(x + 1, y) ? (y * w + x + 1) : solid(x, y + 1) ? ((y + 1) * w + x) : -1;
      const any = litN >= 0 || solid(x - 1, y) || solid(x, y - 1);
      if (!any) continue;
      const shadowSide = solid(x - 1, y) || solid(x, y - 1);
      marks.push(x, y, shadowSide ? -1 : litN);
    }
  for (let k = 0; k < marks.length; k += 3) {
    const o = (marks[k + 1] * w + marks[k]) * 4;
    const src = marks[k + 2];
    if (src < 0) {
      d[o] = ink[0];
      d[o + 1] = ink[1];
      d[o + 2] = ink[2];
    } else {
      d[o] = d[src * 4] * 0.28 + ink[0] * 0.5;
      d[o + 1] = d[src * 4 + 1] * 0.24 + ink[1] * 0.5;
      d[o + 2] = d[src * 4 + 2] * 0.28 + ink[2] * 0.5;
    }
    d[o + 3] = 255;
  }
}

/**
 * Outline (optional), quantise a sprite to an SNES sprite palette (15 colours
 * by default), then paint unoutlined extras (flames, drips) in reserved slots. `keepAlpha`
 * preserves translucent pixels (in a few coarse levels) instead of cutting them.
 */
export function finishSprite(pc: PixelCanvas, opts: { outline?: boolean; colors?: number; paint?: (pc: PixelCanvas) => void; keepAlpha?: boolean } = {}): PixelCanvas {
  if (opts.outline ?? true) selout(pc);
  if (!opts.keepAlpha) {
    // extras (flames, glints) are painted after quantising, from a reserve of 4 palette slots
    snesify(pc, { colors: (opts.colors ?? 15) - (opts.paint ? 4 : 0) });
    despeckle(pc);
    opts.paint?.(pc);
    return pc;
  }
  opts.paint?.(pc);
  const d = pc.data;
  const n = pc.w * pc.h;
  const A = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3];
    A[i] = a < 24 ? 0 : a > 232 ? 255 : Math.round(a / 64) * 64;
    d[i * 4 + 3] = A[i] ? 255 : 0;
  }
  snesify(pc, { colors: opts.colors ?? 15, alphaCut: 1 });
  despeckle(pc);
  for (let i = 0; i < n; i++) d[i * 4 + 3] = A[i];
  return pc;
}
