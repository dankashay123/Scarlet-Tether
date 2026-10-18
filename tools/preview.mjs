// Preview a model set without rebuilding the game's sheets:
//   node tools/preview.mjs tools/models/common.mjs out.png [scale] [filter]
// Draws each animation as a row of frames on a dark backdrop, with a tick
// at each frame's anchor.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { png } from './png.mjs';
import { IDX } from './palette.mjs';

const [file, out, sc = '4', filter = ''] = process.argv.slice(2);
const set = (await import(pathToFileURL(resolve(file)).href)).default;
const rows = [];
const t0 = Date.now();
for (const [sheetName, anims] of Object.entries(set)) for (const [anim, fn] of Object.entries(anims)) {
  if (filter && !anim.includes(filter)) continue;
  rows.push({ name: `${sheetName}.${anim}`, frames: fn() });
}
const gap = 6, W = Math.max(...rows.map((r) => r.frames.reduce((a, f) => a + f.w + gap, gap))), H = rows.reduce((a, r) => a + Math.max(...r.frames.map((f) => f.h)) + gap, gap);
const big = { w: W, h: H, px: new Int16Array(W * H).fill(-1) };
let oy = gap;
for (const r of rows) {
  let ox = gap;
  for (const f of r.frames) {
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) { const v = f.px[y * f.w + x]; if (v >= 0) big.px[(oy + y) * W + ox + x] = v; }
    if (f.ax !== undefined) for (const [dx, dy] of [[-2, 0], [2, 0], [0, 1]]) { const x = ox + f.ax + dx, y = oy + f.ay + dy; if (big.px[y * W + x] < 0) big.px[y * W + x] = IDX.ember1; }
    ox += f.w + gap;
  }
  console.log(`${r.name}: ${r.frames.length} frames ${r.frames.map((f) => `${f.w}x${f.h}`).join(' ')}`);
  oy += Math.max(...r.frames.map((f) => f.h)) + gap;
}
writeFileSync(out, png(big, +sc, [46, 40, 56]));
console.log(`rendered in ${Date.now() - t0} ms -> ${out}`);
