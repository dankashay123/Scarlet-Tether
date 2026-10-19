// The Saint's animation set, sculpted (see base.mjs for the model).
import { saintModel, SKINS, posedFrame } from './base.mjs';

const A = (f) => Object.assign(f, { ax: 22, ay: 62 });
const anims = (skin) => ({
    idle: () => [0, 1, 2, 3].map((i) => A(saintModel({ skin, bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, -1, -1, 0][i], blink: i === 3 }))),
    // An 8-frame walk: the planted foot slides back along the ground while
    // the other swings forward in an arc, knee bent; the body is lowest just
    // after each contact and highest as the legs pass.
    run: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const t = i / 8, AMP = 6.5, H = 3.6;
      const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: H * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
      const b = leg(t + 0.5), f = leg(t);
      // Bob a whole chunky pixel (2 px) through contact and recoil; a 1 px bob
      // re-cuts the 2x2 blocks and the Saint shimmers.
      return A(saintModel({ skin, bob: i % 4 < 2 ? 2 : 0, legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -4, lean: 1 }));
    }),
    // Hand-posed reactions. cast: wind up, then thrust the palm (rites);
    // hit: recoil with the arm up; die: stagger, kneel, fall forward, the
    // halo knocked loose and rolling to the floor.
    cast: () => [
      A(saintModel({ skin, lean: -1, reach: -0.6, aim: 2, cape: -1, halo: -1 })),
      A(saintModel({ skin, lean: 1.5, reach: 1, legs: [-3, 2], cape: -4, halo: 1 })),
    ],
    hit: () => [
      A(saintModel({ skin, lean: -2.5, aim: -3, legs: [-2, 1], cape: 2, halo: -2, blink: true })),
      A(saintModel({ skin, lean: -1, aim: -1, cape: 1, halo: -1 })),
    ],
    die: () => {
      const kneel = () => saintModel({ skin, bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 6, blink: true, haloAt: [9, -6] });
      return [
        A(saintModel({ skin, lean: -2.5, aim: -2, legs: [-3, 1], cape: 3, halo: -3, blink: true })),
        A(saintModel({ skin, bob: 4, bend: [2, 2], legs: [-2, 2], lean: -1, cape: 2, aim: 3, blink: true, haloAt: [6, -14] })),
        A(kneel()),
        posedFrame(() => saintModel({ skin, bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, aim: 6, blink: true, haloAt: [80, 0] }), A(kneel()), { rot: 1.4, dx: 4, dy: 2 }), // keeps its own feet anchor
      ];
    },
    dash: () => [
      A(saintModel({ skin,  lean: 2, legs: -4, lift: [1, 0], cape: -6, halo: 1 })),
      A(saintModel({ skin,  lean: 3, legs: -6, lift: [2, 1], cape: -9, halo: 2 })),
      A(saintModel({ skin,  lean: 1.5, legs: -3, lift: [0, 1], cape: -5, halo: 1 })),
    ],
});
// One sheet per vestment set skin: saint_nails, saint_font and so on.
export default { saint: anims(null), ...Object.fromEntries(Object.keys(SKINS).map((k) => [`saint_${k}`, anims(k)])) };
