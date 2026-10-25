// The Mendicant's animation set (round 49): the second playable saint, built
// on the Saint's body (saintModel with hero 'mendicant'). The mace rests on
// the shoulder; swing winds it up behind the head, strikes and follows through.
import { saintModel, posedFrame } from './base.mjs';

const H = 'mendicant', REST = -1.3;
const A = (f) => Object.assign(f, { ax: 30, ay: 62 });
const M = (o) => saintModel({ hero: H, swing: REST, aim: 3, ...o });
export default { mendicant: {
  idle: () => [0, 1, 2, 3].map((i) => A(M({ bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, -1, -1, 0][i], blink: i === 3 }))),
  // The same 8-frame walk as the Saint: planted feet, a 2 px bob.
  run: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const t = i / 8, AMP = 6.5, HT = 3.6;
    const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: HT * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
    const b = leg(t + 0.5), f = leg(t);
    return A(M({ bob: i % 4 < 2 ? 2 : 0, legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -4, lean: 1 }));
  }),
  // The blow: wind up over the head, strike forward and down, follow through.
  swing: () => [
    A(M({ lean: -1.2, aim: -7, reach: -0.2, swing: -1.95, legs: [-2, 2], cape: -1, halo: -1 })),
    A(M({ lean: 2, aim: 1, reach: 1.1, swing: 0.15, legs: [-4, 4], cape: -5, halo: 1 })),
    A(M({ lean: 1.5, aim: 4, reach: 0.7, swing: 0.95, legs: [-3, 3], cape: -3 })),
  ],
  cast: () => [
    A(M({ lean: -1, reach: -0.6, aim: 2, cape: -1, halo: -1 })),
    A(M({ lean: 1.5, reach: 1, legs: [-3, 2], cape: -4, halo: 1, swing: -1.6 })),
  ],
  hit: () => [
    A(M({ lean: -2.5, aim: -1, legs: [-2, 1], cape: 2, halo: -2, blink: true, swing: -1.5 })),
    A(M({ lean: -1, aim: 1, cape: 1, halo: -1 })),
  ],
  die: () => {
    const kneel = () => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 7, blink: true, haloAt: [9, -6], swing: 1.4 });
    return [
      A(M({ lean: -2.5, aim: -1, legs: [-3, 1], cape: 3, halo: -3, blink: true, swing: -1.6 })),
      A(M({ bob: 4, bend: [2, 2], legs: [-2, 2], lean: -1, cape: 2, aim: 4, blink: true, haloAt: [6, -14], swing: 0.6 })),
      A(kneel()),
      posedFrame(() => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 7, blink: true, haloAt: [80, 0], swing: 1.4 }), A(kneel()), { rot: 1.4, dx: 4, dy: 2 }),
    ];
  },
  dash: () => [
    A(M({ lean: 2, legs: -4, lift: [1, 0], cape: -6, halo: 1, swing: -1.5 })),
    A(M({ lean: 3, legs: -6, lift: [2, 1], cape: -9, halo: 2, swing: -1.6 })),
    A(M({ lean: 1.5, legs: -3, lift: [0, 1], cape: -5, halo: 1, swing: -1.5 })),
  ],
} };
