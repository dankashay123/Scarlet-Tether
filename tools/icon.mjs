// The app icon: the Saint's hooded bust under its halo, in a lit gothic arch.
//   node tools/icon.mjs            writes assets/icons/ (home screen, favicon, manifest sizes)
//   node tools/icon.mjs out.png 6  also writes one preview at that scale
// Drawn on a 64x64 palette grid in the game's 2x2 chunky pixels, so every size
// is a whole-number scale: 32 (x0.5), 180 (the middle 60 x3), 192 (x3), 512 (x8).
import { writeFileSync, mkdirSync } from 'node:fs';
import { png } from './png.mjs';
import { IDX } from './palette.mjs';
import { chunkify } from './chunky.mjs';
import { Scene, sphere, ellipsoid, capsule, render, folds, dot, setRes } from './sdf.mjs';
import { MATS, torus } from './models/base.mjs';

const N = 64;
// The Saint, as the HUD portrait but sculpted at 1.15x: crimson hood, gilt rim, a void with two green eyes.
function bust() {
  const k = 1.15, S = new Scene(), cx = 31, hy = 38, P = (x, y, z) => [cx + x * k, hy + y * k, z * k];
  S.add(ellipsoid(P(0, 17, -1), [14 * k, 7.5 * k, 7 * k], 'crimson'), 0); // shoulders
  S.paint({ f: (x, y, z) => Math.max(Math.abs(x - (cx + 3 * k)) - 2.2 * k, hy + 11 * k - y, -z + 1), mat: 'gold' }); // the stole
  S.paint({ f: (x, y, z) => Math.min(Math.max(Math.abs(x - (cx + 3 * k)) - 1.5 * k, Math.abs(y - (hy + 15 * k)) - 0.55 * k), Math.max(Math.abs(x - (cx + 3 * k)) - 0.55 * k, Math.abs(y - (hy + 15 * k)) - 1.8 * k)) + (z < 1 ? 9 : 0), mat: 'crimson' });
  const hood = ellipsoid(P(0, 0, 0), [9.8 * k, 9.4 * k, 8.6 * k], 'crimson');
  S.add(folds(hood, { cx, cz: 0, n: 7, amp: 0.45, y0: hy - 9 * k, y1: hy + 9 * k }), 2.6 * k);
  S.add(capsule(P(-4, -6, -2), P(-11, -9, -5), 5 * k, 1.4 * k, 'crimson'), 2.6 * k); // the hood's point
  S.add(capsule(P(0, -5, -1), P(-1, -12, -2), 6 * k, 1.6 * k, 'crimson'), 3 * k); // the cowl's soft peak under the halo
  const fc = P(2.2, 1.6, 7.6), cut = ellipsoid(fc, [5.6 * k, 6.4 * k, 5 * k], 'void');
  S.sub(cut, 1.5);
  S.paint({ f: (x, y, z) => Math.max(cut.f(x, y, z) - 1.4 * k, -hood.f(x, y, z) - 1.2 * k), mat: 'gold' });
  S.add(torus(P(-0.6, -17.5, 0), 7.6 * k, 1.3 * k, 0.42, 'halo'), 0);
  const fr = render(S, N, N, MATS, { ground: 99 });
  chunkify(fr);
  // Eyes placed by hand on the 2x2 grid: two green flames.
  for (const ex of [fc[0] - 4, fc[0] + 2]) for (const [dy, c] of [[-2, 'flame0'], [0, 'flame1'], [2, 'flame3']]) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) dot(fr, Math.floor(ex / 2) * 2 + ox, Math.floor((fc[1] + dy - 2) / 2) * 2 + oy, c);
  return fr;
}

// The backdrop: night ink, a stone arch whose window glows warm behind the halo in hard bands (no dithering).
function backdrop() {
  const px = new Int16Array(N * N).fill(IDX.ink1), set = (x, y, n) => { px[y * N + x] = IDX[n]; };
  const ax = 32, top = 8, half = 21, base = 64;
  const archD = (x, y) => { // distance outside the arch window (negative inside): straight sides, pointed top
    const dx = Math.abs(x - ax);
    if (y >= top + half) return dx - half;
    const c1 = Math.hypot(x - (ax - half * 0.55), y - (top + half)), c2 = Math.hypot(x - (ax + half * 0.55), y - (top + half));
    return Math.max(x < ax ? c2 : c1, 0) - half * 1.55;
  };
  const glowAt = [32, 18];
  for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
    const cx = x + 1, cy = y + 1, d = archD(cx, cy);
    let n = 'ink1';
    if (d < -2) { const r = Math.hypot(cx - glowAt[0], (cy - glowAt[1]) * 0.85); n = r < 9 ? 'violet2' : r < 15 ? 'violet3' : r < 22 ? 'violet4' : 'ink3'; }
    else if (d < 2) n = 'stone3';
    else if (d < 4) n = 'stone4';
    else if (cy > base - 6) n = 'ink0';
    for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + ox, y + oy, n);
  }
  // Mortar lines in the arch's stones.
  for (let y = 4; y < N - 6; y += 8) for (let x = 0; x < N; x += 2) { const d = archD(x + 1, y + 1); if (d >= -2 && d < 4) for (const ox of [0, 1]) set(x + ox, y, 'ink2'); }
  // The arch's lit edge on the top-left.
  for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) { const d = archD(x + 1, y + 1); if (d >= 0 && d < 2 && x < ax && y < top + half + 4) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + ox, y + oy, 'stone2'); }
  return { w: N, h: N, px };
}

const art = backdrop();
setRes(2);
const b = bust();
for (let i = 0; i < N * N; i++) if (b.px[i] >= 0) art.px[i] = b.px[i];
const crop = (f, m) => { const w = f.w - 2 * m, px = new Int16Array(w * w); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) px[y * w + x] = f.px[(y + m) * f.w + x + m]; return { w, h: w, px }; };
const half = { w: 32, h: 32, px: new Int16Array(32 * 32).map((_, i) => art.px[(Math.floor(i / 32) * 2) * N + (i % 32) * 2]) };

const [out, sc] = process.argv.slice(2);
if (out) writeFileSync(out, png(art, +(sc || 6)));
else {
  mkdirSync('assets/icons', { recursive: true });
  writeFileSync('assets/icons/icon-180.png', png(crop(art, 2), 3)); // apple-touch-icon
  writeFileSync('assets/icons/icon-192.png', png(art, 3));
  writeFileSync('assets/icons/icon-512.png', png(art, 8));
  writeFileSync('assets/icons/favicon-32.png', png(half, 1));
  console.log('wrote assets/icons: icon-180, icon-192, icon-512, favicon-32');
}
