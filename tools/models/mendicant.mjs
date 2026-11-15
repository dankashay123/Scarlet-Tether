// The Vesper's animation set (round 118; the sheet keeps the id 'mendicant'): the
// assassin, built on the Saint's body (saintModel with hero 'mendicant'), a
// blade in each hand. swing cuts with the front blade, then the back one.
import { saintModel, posedFrame, SKINS } from './base.mjs';

const H = 'mendicant', REST = 0.75, REST2 = 2.1;
const A = (f) => Object.assign(f, { ax: 30, ay: 62 });
const anims = (skin) => { const M = (o) => saintModel({ hero: H, skin, swing: REST, swing2: REST2, aim: 6, reach: -0.2, ...o }); return {
  // An 8-frame idle: breath, the cape stirring, the blades turning a little in the hands.
  idle: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => A(M({ bob: [0, 0, 1, 1, 1, 1, 0, 0][i], halo: [0, -1, -1, -2, -2, -1, -1, 0][i], cape: Math.sin(i / 8 * Math.PI * 2) * 1.2 - 0.4, swing: REST + [0, 0, 0.06, 0.12, 0.12, 0.06, 0, 0][i], swing2: REST2 - [0, 0, 0.05, 0.1, 0.1, 0.05, 0, 0][i], blink: i === 6 }))),
  // The same 8-frame walk as the Saint: planted feet, a 2 px bob, blades held low and back.
  run: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const t = i / 8, AMP = 6.5, HT = 3.6;
    const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: HT * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
    const b = leg(t + 0.5), f = leg(t);
    return A(M({ bob: i % 4 < 2 ? 2 : 0, legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -4, lean: 1.5, swing: 1.2, swing2: 2.5 }));
  }),
  // Two quick cuts, one per blade (round 118). Six frames: front blade raised,
  // its cut, the back blade raised as the front follows through, its cut, the
  // follow-through, settle.
  swing: () => [
    A(M({ lean: -0.6, aim: -2, reach: -0.3, swing: -2.3, legs: [-1, 1], cape: -1 })),
    A(M({ lean: 1.8, aim: 3, reach: 1.1, swing: 0.5, legs: [-3, 3], cape: -4, halo: 1 })),
    A(M({ lean: 0.4, aim: 6, reach: 0.4, swing: 1.3, back: [-1, -8, 0], swing2: -2.4, legs: [-2, 2], cape: -2 })),
    A(M({ lean: 2, aim: 7, reach: -0.2, swing: 1.6, back: [11, -5, 5], swing2: 0.1, legs: [-4, 3], cape: -5, halo: 1 })),
    A(M({ lean: 1.2, aim: 6, reach: 0, swing: 1.3, back: [8, -1, 4], swing2: 0.9, legs: [-3, 2], cape: -3 })),
    A(M({ bob: 2, bend: [1, 1], lean: 0.4, swing: REST, legs: [-2, 2], cape: -2, halo: 1 })),
  ],
  // A 4-frame cast: gather, raise the front blade high, thrust it, settle.
  cast: () => [
    A(M({ lean: -1, reach: -0.6, aim: 2, cape: -1, halo: -1, swing: -0.4 })),
    A(M({ lean: -1.6, reach: -0.3, aim: -5, legs: [-1, 1], cape: 0, halo: -2, swing: -1.9, back: [-1, -6, 0], swing2: -2 })),
    A(M({ lean: 1.5, reach: 1, legs: [-3, 2], cape: -4, halo: 1, swing: 0.2, back: [9, -3, 4], swing2: 0.4 })),
    A(M({ lean: 0.6, reach: 0.4, aim: 3, legs: [-2, 1], cape: -2, halo: 0 })),
  ],
  // A 3-frame flinch.
  hit: () => [
    A(M({ lean: -2.5, aim: 1, legs: [-2, 1], cape: 2, halo: -2, blink: true, swing: -0.6, swing2: 2.6 })),
    A(M({ lean: -1.6, aim: 3, legs: [-1, 1], cape: 2, halo: -2, swing: 0 })),
    A(M({ lean: -1, aim: 5, cape: 1, halo: -1 })),
  ],
  die: () => {
    const kneel = () => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 9, blink: true, haloAt: [9, -6], swing: 1.5, swing2: 1.7 });
    return [
      A(M({ lean: -2.5, aim: 1, legs: [-3, 1], cape: 3, halo: -3, blink: true, swing: -0.6, swing2: 2.6 })),
      A(M({ bob: 4, bend: [2, 2], legs: [-2, 2], lean: -1, cape: 2, aim: 7, blink: true, haloAt: [6, -14], swing: 1.2 })),
      A(kneel()),
      posedFrame(() => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 9, blink: true, haloAt: [80, 0], swing: 1.5, swing2: 1.7 }), A(kneel()), { rot: 1.4, dx: 4, dy: 2 }),
    ];
  },
  dash: () => [
    A(M({ lean: 2.5, legs: -4, lift: [1, 0], cape: -6, halo: 1, swing: 2.4, swing2: 2.8 })),
    A(M({ lean: 3.5, legs: -6, lift: [2, 1], cape: -9, halo: 2, swing: 2.6, swing2: 2.9 })),
    A(M({ lean: 2, legs: -3, lift: [0, 1], cape: -5, halo: 1, swing: 2.4, swing2: 2.8 })),
  ],
}; };
// One sheet per vestment set (round 50), like the Saint's: mendicant_nails and so on.
export default { mendicant: anims(null), ...Object.fromEntries(Object.keys(SKINS).filter((k) => !SKINS[k].hero || SKINS[k].hero === 'mendicant').map((k) => [`mendicant_${k}`, anims(k)])) };
