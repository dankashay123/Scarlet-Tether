// Round 103: the twenty pets and the Indulgence (the premium currency's writ).
// One builder makes every pet from a few parts (body, head, ears, wings, tail, legs), so they share a size and a
// look: small, round, facing right, feet at (12, 22) on a 24x24 frame. Four frames: fliers bob in whole 2 px steps and
// beat their wings; walkers swap their legs. The game draws the pet that follows the hero from the `pets` sheet.
import { Scene, sphere, ellipsoid, capsule, box, render, dot } from '../sdf.mjs';
import { MATS, torus } from './base.mjs';

const PM = { ...MATS, glassWing: { ramp: 'holy', spec: 0.8, bias: 0.1 }, roseWing: { ramp: 'rose', spec: 0.5, bias: 0.05 }, coal: { ramp: 'ink', bias: 0.05, min: 2 }, fur: { ramp: 'wood', bias: 0.08 }, grey: { ramp: 'slate', bias: 0.05 },
  shell: { ramp: 'sand', spec: 0.3 }, wart: { ramp: 'moss', bias: 0.05, spec: 0.2 }, page: { ramp: 'cloth', max: 6 }, wisp: { ramp: 'violet', glow: 1 }, seal: { ramp: 'blood', spec: 0.5 } };
// Round 105: every pet is modelled on the old 24 px grid (feet at 12, 22) and drawn half as big again: K scales each
// shape about the feet onto a 36 px frame (feet at 18, 33), so ears, wings and tails get whole chunky pixels.
const K = 1.5, FW = 36, AX = 18, AY = 33;
const A = (f) => Object.assign(f, { ax: AX, ay: AY });
const up = (p) => ({ ...p, bb: [(p.bb[0] - 12) * K + AX, (p.bb[1] - 22) * K + AY, p.bb[2] * K, (p.bb[3] - 12) * K + AX, (p.bb[4] - 22) * K + AY, p.bb[5] * K], f: (x, y, z) => p.f((x - AX) / K + 12, (y - AY) / K + 22, z / K) * K });
class Big extends Scene { add(p, k = 0, op = 'add') { return super.add(up(p), k * K, op); } }
const bx = (x) => Math.round((x - 12) * K + AX), by = (y) => Math.round((y - 22) * K + AY);
// An eye: two chunky pixels wide so it survives the 2x2 grid.
const eye = (f, x, y, c) => { dot(f, bx(x), by(y), c); dot(f, bx(x) + 1, by(y), c); dot(f, bx(x), by(y) + 1, c); dot(f, bx(x) + 1, by(y) + 1, c); };
function pet(o, i) {
  const S = new Big(), fly = !!o.fly, bob = fly && (i === 1 || i === 2) ? 2 : 0, cy = (fly ? 12 : 22 - (o.leg ?? 3) - (o.bh ?? 3.5)) - bob, bw = o.bw ?? 4.5, bh = o.bh ?? 3.5, hx = 12 + (o.hx ?? 3.5), hy = cy - (o.hy ?? 2.5), hr = o.hr ?? 3;
  const hm = o.head || o.mat, step = i % 2;
  if (o.tail === 'long') S.add(capsule([12 - bw + 1, cy + 1, 0], [12 - bw - 4, cy - 2 + step, 0], 1, 0.6, o.tailMat || o.mat), 0);
  if (o.tail === 'up') S.add(capsule([12 - bw + 1, cy, 0], [12 - bw - 1, cy - 6 + step, 0], 1.1, 0.8, o.tailMat || o.mat), 0.6);
  if (o.tail === 'bushy') { S.add(capsule([12 - bw + 1, cy, 0], [12 - bw - 3, cy - 2, 0], 1.6, 2.4, o.mat), 0.8); S.add(sphere([12 - bw - 4, cy - 3, 0], 1.6, o.tip || 'cloth'), 0.6); }
  if (o.tail === 'fan') S.add(capsule([12 - bw + 1, cy, 0], [12 - bw - 4, cy + 1, 0], 1.4, 1.8, o.tailMat || o.mat), 0.5);
  if (!fly && o.leg !== 0) for (const [lx, fwd] of [[-2, step ? 1 : -1], [2.5, step ? -1 : 1]]) S.add(capsule([12 + lx, cy + bh - 1, 1], [12 + lx + fwd, 21.2, 1], 1.1, 0.9, o.legMat || o.mat), 0.4);
  S.add(ellipsoid([12, cy, 0], [bw, bh, 3.2], o.mat), 0);
  if (o.belly) S.add(ellipsoid([12.5, cy + 1.2, 1.6], [bw - 1.4, bh - 1.4, 2.2], o.belly), 1);
  if (o.shell) { S.add(sphere([11, cy - 2.5, 0.5], 4, 'shell'), 0.6); S.add(torus([11, cy - 2.5, 2.6], 1.8, 0.7, Math.PI / 2, 'fur'), 0); }
  if (o.hr !== 0) S.add(sphere([hx, hy, 0.6], hr, hm), o.neck ?? 1.4);
  if (o.ears === 'point') for (const ex of [-1.6, 1.4]) S.add(capsule([hx + ex, hy - hr + 1, 0.4], [hx + ex * 1.3, hy - hr - 2.2, 0.4], 1.2, 0.4, hm), 0.5);
  if (o.ears === 'long') for (const ex of [-1.2, 1]) S.add(capsule([hx + ex, hy - hr + 1, 0.4], [hx + ex - 1.5, hy - hr - 5 + step, 0.4], 1.1, 0.8, hm), 0.5);
  if (o.ears === 'round') for (const ex of [-2, 1.6]) S.add(sphere([hx + ex, hy - hr + 0.4, 0.2], 1.7, o.earMat || hm), 0.4);
  if (o.ears === 'flop') S.add(capsule([hx - 1.5, hy - 1, 2], [hx - 2.5, hy + 3, 2], 1.3, 1.1, o.earMat || hm), 0.4);
  if (o.ears === 'horn') for (const ex of [-1.6, 1.4]) S.add(capsule([hx + ex, hy - hr + 1, 0.4], [hx + ex * 1.6, hy - hr - 2, 0.4], 0.9, 0.3, 'bone'), 0);
  if (o.beak) S.add(capsule([hx + hr - 0.6, hy + 0.4, 0.8], [hx + hr + 2, hy + 1, 0.8], 1, 0.3, o.beak), 0);
  if (o.snout) S.add(capsule([hx + hr - 1, hy + 0.8, 0.8], [hx + hr + 1.6, hy + 1.2, 0.8], 1.4, 0.9, o.snoutMat || hm), 0.6);
  if (o.wing) { const up = step ? -1 : 1, w = o.wingW ?? 4; S.add(ellipsoid([10.5, cy - 2 - up * 2, -1], [w, 2 + (up > 0 ? 1.5 : 0), 1.2], o.wing), 0.4); if (o.wing2) S.add(ellipsoid([9.5, cy + 1 + up, -1.2], [w - 1, 1.6, 1], o.wing), 0.4); }
  if (o.fold) S.add(ellipsoid([10.5, cy + 0.2, 2.4], [3.4, 2.4, 1.2], o.fold), 0.5);
  if (o.halo) S.add(torus([hx, hy - hr - 1.6, 0.6], 2.2, 0.8, 1.15, 'halo'), 0);
  if (o.extra) o.extra(S, { cy, hx, hy, hr, bw, bh, step, i });
  const f = render(S, FW, FW, PM, { contrast: 1.4 });
  if (o.eye !== null && o.hr !== 0) eye(f, hx + (o.ex ?? 1.2), hy - 0.4, o.eye || 'ink2');
  if (o.after) o.after(f, { cy, hx, hy, hr, step });
  return A(f);
}
const anim = (o) => () => [0, 1, 2, 3].map((i) => pet(o, i));
// Wisp: a core of light with a trailing tail, no body parts.
const wisp = () => [0, 1, 2, 3].map((i) => { const S = new Big(), b = i === 1 || i === 2 ? 2 : 0; S.add(sphere([13, 11 - b, 0], 3.6, 'wisp'), 0); S.add(sphere([9.5, 13 - b + (i % 2), 0], 2.2, 'wisp'), 1.6); S.add(sphere([7, 15.5 - b, 0], 1.3, 'wisp'), 1.2);
  const f = render(S, FW, FW, PM, { contrast: 1.3 }); eye(f, 14.4, 10 - b, 'white'); eye(f, 12, 10 - b, 'white'); return A(f); });
// Bookworm: a fat segmented grub on an open book.
const bookworm = () => [0, 1, 2, 3].map((i) => { const S = new Big(), s = i % 2; S.add(box([12, 20, 0], [7, 1.2, 3], 0.4, 'violet'), 0); S.add(box([12, 18.6, 0.6], [6.2, 0.6, 2.6], 0.3, 'page'), 0);
  [[8, 16.5], [10.5, 15.6 - s], [13, 16.2 + s * 0.4]].forEach(([x, y]) => S.add(sphere([x, y, 1], 2.2, 'flame'), 1.2)); S.add(sphere([15.6, 14.6 - s, 1.2], 2.5, 'flame'), 1.2);
  const f = render(S, FW, FW, PM, { contrast: 1.4 }); eye(f, 16.6, 14 - s, 'ink2'); return A(f); });
// The Indulgence: a rolled writ with a red wax seal (16x16, the currency icon).
const indul = () => { const S = new Scene(); S.add(box([8, 8, 0], [5, 3.6, 1.2], 0.6, 'page'), 0); S.add(capsule([3, 4.4, 0.4], [13, 4.4, 0.4], 1.3, 1.3, 'page'), 0.6); S.add(capsule([3, 11.6, 0.4], [13, 11.6, 0.4], 1.3, 1.3, 'page'), 0.6); S.add(sphere([10.5, 9.4, 1.6], 2.4, 'seal'), 0);
  const f = render(S, 16, 16, PM, { contrast: 1.4 }); dot(f, 5, 7, 'stone2'); dot(f, 6, 7, 'stone2'); dot(f, 7, 7, 'stone2'); dot(f, 5, 9, 'stone2'); dot(f, 6, 9, 'stone2'); return Object.assign(f, { ax: 8, ay: 8 }); };

export default { pets: {
  // Battle pets.
  nailfinch: anim({ fly: 1, mat: 'gold', belly: 'cloth', bw: 3.6, bh: 3, hr: 2.6, beak: 'iron', wing: 'emberLit', tail: 'fan' }),
  censermouse: anim({ mat: 'grey', belly: 'cloth', bw: 3.8, bh: 3, leg: 2, hr: 2.6, ears: 'round', earMat: 'rose', tail: 'long', tailMat: 'rose', snout: 1, extra: (S, q) => { S.add(sphere([9, q.cy - 4.5, 0], 1.8, 'gold'), 0); S.add(sphere([9, q.cy - 6.6 - q.step, 0], 1, 'ember'), 0); } }),
  almshound: anim({ mat: 'fur', belly: 'sand', bw: 5, bh: 3.4, leg: 4, hr: 3, ears: 'flop', earMat: 'leather', tail: 'up', snout: 1, extra: (S, q) => S.add(torus([q.hx - 2.4, q.hy + 2, 0.6], 2, 0.7, 0.4, 'iron'), 0) }),
  bellcrow: anim({ fly: 1, mat: 'coal', bw: 4, bh: 3.2, hr: 2.8, beak: 'bone', wing: 'slate', wingW: 4.6, tail: 'fan', eye: 'gold1', extra: (S, q) => S.add(sphere([12.5, q.cy + 4.4, 1], 1.6, 'gold'), 0) }),
  glassmoth: anim({ fly: 1, mat: 'violet', bw: 2.4, bh: 3.4, hr: 2, hx: 0.5, hy: 4, wing: 'glassWing', wing2: 1, wingW: 5.4, eye: 'holy0', ex: 0.6 }),
  votivewisp: wisp,
  lamb: anim({ mat: 'cloth', bw: 5, bh: 4, leg: 3, legMat: 'coal', hr: 2.6, head: 'coal', ears: 'flop', earMat: 'coal', eye: 'cloth0', extra: (S, q) => { for (const [x, y] of [[9, q.cy - 3], [13, q.cy - 3.4], [11, q.cy - 4]]) S.add(sphere([x, y, 0.4], 2, 'cloth'), 1); } }),
  cherub: anim({ fly: 1, mat: 'stone', bw: 3.4, bh: 3.4, hr: 3.2, hx: 1.4, hy: 4.6, wing: 'bone', wingW: 4, halo: 1, eye: 'ink2' }),
  emberimp: anim({ mat: 'emberLit', belly: 'ember', bw: 3.6, bh: 3.6, leg: 3, hr: 3, hx: 2, hy: 4.4, ears: 'horn', tail: 'long', tailMat: 'blood', eye: 'white' }),
  hare: anim({ mat: 'sand', belly: 'cloth', bw: 4.4, bh: 3.4, leg: 3, hr: 2.8, ears: 'long', tail: 'bushy', tip: 'cloth' }),
  // Drop pets.
  magpie: anim({ fly: 1, mat: 'coal', belly: 'cloth', bw: 4, bh: 3.2, hr: 2.8, beak: 'gold', wing: 'teal', wingW: 4.6, tail: 'fan', extra: (S, q) => S.add(sphere([q.hx + q.hr + 2.2, q.hy + 1.6, 0.8], 1.1, 'halo'), 0) }),
  relicrat: anim({ mat: 'slate', belly: 'stone', bw: 4.4, bh: 3, leg: 2, hr: 2.8, ears: 'round', tail: 'long', tailMat: 'skin', snout: 1, eye: 'blood1' }),
  emberfox: anim({ mat: 'emberLit', belly: 'cloth', bw: 4.6, bh: 3.2, leg: 3.5, legMat: 'coal', hr: 2.9, ears: 'point', tail: 'bushy', tip: 'cloth', snout: 1 }),
  herbmole: anim({ mat: 'coal', bw: 5, bh: 3.6, leg: 1.5, legMat: 'skin', hr: 0, extra: (S, q) => { S.add(capsule([15, q.cy + 0.6, 0.8], [18.4, q.cy + 1.4, 0.8], 2, 1, 'skin'), 1); S.add(sphere([9, q.cy - 4, 0], 1.6, 'moss'), 0); S.add(sphere([11, q.cy - 4.6, 0], 1.3, 'flame'), 0.4); }, after: (f, q) => eye(f, 15, q.cy - 1, 'cloth0') }),
  rubricowl: anim({ fly: 1, mat: 'fur', belly: 'sand', bw: 4, bh: 4, hr: 3.4, hx: 1, hy: 4.6, ears: 'point', beak: 'gold', wing: 'leather', wingW: 4.4, eye: 'gold1', ex: 1.6 }),
  rosemoth: anim({ fly: 1, mat: 'blood', bw: 2.4, bh: 3.4, hr: 2, hx: 0.5, hy: 4, wing: 'roseWing', wing2: 1, wingW: 5.4, eye: 'white', ex: 0.6 }),
  chrismsnail: anim({ mat: 'skin', bw: 5, bh: 1.8, leg: 0, hr: 2, hx: 5, hy: 2.4, shell: 1, extra: (S, q) => { for (const ex of [0, 1.6]) S.add(capsule([q.hx + ex, q.hy - 1.4, 0.4], [q.hx + ex + 0.6, q.hy - 4.4 + q.step, 0.4], 0.5, 0.7, 'skin'), 0); } }),
  orbtoad: anim({ mat: 'wart', belly: 'flame', bw: 5.4, bh: 3.6, leg: 1.6, hr: 3, hx: 3, hy: 2.2, eye: 'gold1', extra: (S, q) => S.add(sphere([q.hx - 0.4, q.hy - 2.6, 1.4], 1.5, 'wart'), 0.4) }),
  bookworm,
  tithecat: anim({ mat: 'coal', belly: 'slate', bw: 4.4, bh: 3.4, leg: 3.4, hr: 3, ears: 'point', tail: 'up', eye: 'gold1', extra: (S, q) => S.add(sphere([q.hx - 1.6, q.hy + 3, 2], 1.3, 'halo'), 0) }),
  indul: () => [indul()],
} };
