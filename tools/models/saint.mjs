// The Saint's animation set, sculpted (see base.mjs for the model).
import { saintModel } from './base.mjs';

const A = (f) => Object.assign(f, { ax: 22, ay: 62 });
export default {
  saint: {
    idle: () => [0, 1, 2, 3].map((i) => A(saintModel({ bob: i >= 2 ? 1 : 0, halo: [0, -1, -1, 0][i], cape: [0, -1, -1, 0][i], blink: i === 3 }))),
    run: () => [0, 1, 2, 3, 4, 5].map((i) => {
      const ph = i / 6 * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph);
      return A(saintModel({ bob: Math.abs(s) > 0.5 ? -1 : 0, halo: Math.abs(s) > 0.5 ? 0 : 1, legs: s * 4.5, lift: [c > 0.3 ? 2.2 * c : 0, c < -0.3 ? -2.2 * c : 0], cape: -3 - Math.abs(s) * 1.5, lean: 1 }));
    }),
    dash: () => [
      A(saintModel({ lean: 2, legs: -4, lift: [1, 0], cape: -6, halo: 1 })),
      A(saintModel({ lean: 3, legs: -6, lift: [2, 1], cape: -9, halo: 2 })),
      A(saintModel({ lean: 1.5, legs: -3, lift: [0, 1], cape: -5, halo: 1 })),
    ],
  },
};
