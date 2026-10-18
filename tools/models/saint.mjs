// The Saint's animation set, sculpted (see base.mjs for the model).
import { saintModel } from './base.mjs';

const A = (f) => Object.assign(f, { ax: 22, ay: 62 });
export default {
  saint: {
    idle: () => [0, 1, 2, 3].map((i) => A(saintModel({ bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, -1, -1, 0][i], blink: i === 3 }))),
    // An 8-frame walk: the planted foot slides back along the ground while
    // the other swings forward in an arc, knee bent; the body is lowest just
    // after each contact and highest as the legs pass.
    run: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const t = i / 8, AMP = 6.5, H = 3.6;
      const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: H * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
      const b = leg(t + 0.5), f = leg(t);
      // Bob a whole chunky pixel (2 px) through contact and recoil; a 1 px bob
      // re-cuts the 2x2 blocks and the Saint shimmers.
      return A(saintModel({ bob: i % 4 < 2 ? 2 : 0, legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -4, lean: 1 }));
    }),
    dash: () => [
      A(saintModel({ lean: 2, legs: -4, lift: [1, 0], cape: -6, halo: 1 })),
      A(saintModel({ lean: 3, legs: -6, lift: [2, 1], cape: -9, halo: 2 })),
      A(saintModel({ lean: 1.5, legs: -3, lift: [0, 1], cape: -5, halo: 1 })),
    ],
  },
};
