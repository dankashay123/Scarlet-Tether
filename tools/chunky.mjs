// Chunky pixels, the Otherworld Legends look: every frame is rebuilt on a
// 2x2 grid so each art pixel shows as a clear square block on screen.
// Each block takes the most common colour in it, internal contour lines are
// kept, and outlined sprites get a fresh 1-block outline round the
// silhouette. Small bright accents (eyes, glints) survive. The frame keeps
// its size, so the engine needs no change.
import { RGB, IDX } from './palette.mjs';

const OUT = IDX.outline;
const lum = (i) => { const c = RGB[i]; return c ? (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255 : 0; };

export function chunkify(f, { outline = 'auto' } = {}) {
  const { w, h, px } = f, cw = Math.ceil(w / 2), ch = Math.ceil(h / 2);
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : px[y * w + x]);
  // Is this an outlined sprite? Look at its silhouette edge.
  let edge = 0, edgeOut = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x, y); if (i < 0) continue;
    if (at(x - 1, y) < 0 || at(x + 1, y) < 0 || at(x, y - 1) < 0 || at(x, y + 1) < 0) { edge++; if (i === OUT || lum(i) < 0.12) edgeOut++; }
  }
  const outlined = outline === 'auto' ? edge > 0 && edgeOut / edge > 0.5 : !!outline;
  const c = new Int16Array(cw * ch).fill(-1);
  for (let by = 0; by < ch; by++) for (let bx = 0; bx < cw; bx++) {
    const cnt = new Map(); let n = 0, oc = 0, accent = -1, acL = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = at(bx * 2 + dx, by * 2 + dy); if (i < 0) continue;
      n++; if (i === OUT) { oc++; continue; }
      cnt.set(i, (cnt.get(i) || 0) + 1);
    }
    if (n < 2 && !(n === 1 && cnt.size)) continue;
    let best = -1, bc = 0, bl = 9;
    for (const [i, k] of cnt) { const l = lum(i); if (k > bc || (k === bc && l < bl)) { best = i; bc = k; bl = l; } }
    // A lone bright pixel much lighter than its block is an accent (an eye, a glint).
    for (const [i] of cnt) { const l = lum(i); if (best >= 0 && l - lum(best) > 0.38 && l > acL) { accent = i; acL = l; } }
    if (n === 1) { if (accent >= 0 || (best >= 0 && lum(best) > 0.7)) c[by * cw + bx] = accent >= 0 ? accent : best; continue; }
    if (oc >= 3 || best < 0) c[by * cw + bx] = OUT;
    else if (oc === 2 && bc <= 1) c[by * cw + bx] = OUT;
    else c[by * cw + bx] = accent >= 0 && bc <= 2 ? accent : best;
  }
  // Fresh outline round the silhouette, one block thick, drawn inside it.
  if (outlined) {
    const cat = (x, y) => (x < 0 || y < 0 || x >= cw || y >= ch ? -1 : c[y * cw + x]);
    const edgeCells = [];
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (cat(x, y) >= 0 && (cat(x - 1, y) < 0 || cat(x + 1, y) < 0 || cat(x, y - 1) < 0 || cat(x, y + 1) < 0)) edgeCells.push(y * cw + x);
    for (const k of edgeCells) if (lum(c[k]) < 0.75 || c[k] === OUT) c[k] = OUT;
  }
  const out = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = c[(y >> 1) * cw + (x >> 1)];
  f.px = out;
  return f;
}
