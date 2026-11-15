// The Vesper's animation set (round 118; arms posed by hand targets since round 122; the sheet keeps
// the id 'mendicant'): the assassin, built on the Saint's body (saintModel with hero 'mendicant'), a
// blade in each hand. swing cuts with the front blade, then the back one.
import { saintModel, posedFrame, SKINS } from './base.mjs';

const H = 'mendicant';
const A = (f) => Object.assign(f, { ax: 30, ay: 62 });
// Round 122: hands are placed with fh / bh (relative to each shoulder: forward, down, toward the camera) and
// the elbows bend to reach them, so every cut moves the whole arm. The stance: the front blade low and
// forward, the back hand across the chest holding its blade point up (a reverse grip).
const STANCE = { fh: [7, 9, 2.5], swing: 0.55, bh: [6.5, 5, 5.2], swing2: -2.1 };
const anims = (skin) => { const M = (o) => saintModel({ hero: H, skin, ...STANCE, ...o }); return {
  // An 8-frame idle: knees a little bent, breath, the blades shifting in the hands.
  idle: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const k = Math.sin(i / 8 * Math.PI * 2); return A(M({ bob: [0, 0, 1, 1, 1, 1, 0, 0][i], bend: [0.6, 0.6], legs: [-2, 2], halo: [0, -1, -1, -2, -2, -1, -1, 0][i], cape: k * 1.2 - 0.4, fh: [7 + k * 0.6, 9 - k * 0.6, 2.5], swing: 0.55 + k * 0.08, bh: [6.5, 5 + k * 0.5, 5.2], swing2: -2.1 - k * 0.06, blink: i === 6 })); }),
  // The 8-frame walk with the arms pumping against the legs, blades held low and trailing.
  run: () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const t = i / 8, AMP = 6.5, HT = 3.6, w = Math.sin(t * Math.PI * 2);
    const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: HT * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
    const b = leg(t + 0.5), f = leg(t);
    return A(M({ bob: i % 4 < 2 ? 2 : 0, legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -4, lean: 1.6, fh: [3 + w * 5, 9 - Math.abs(w) * 1.5, 2.5], swing: 2.3 + w * 0.2, bh: [3 - w * 5, 8 - Math.abs(w) * 1.5, -1 - w * 2], swing2: 2.5 - w * 0.2 }));
  }),
  // Two cuts per attack (eight frames): the front blade raised behind the head, its cut across, its
  // follow-through low while the back hand cocks; the back blade's backhand cut across the chest,
  // its follow-through high, then back to the stance.
  swing: () => [
    A(M({ lean: -1.2, legs: [-2, 2], bend: [1, 1], fh: [-3, -11, 1], swing: -2.6, bh: [7, 4, 5], swing2: -0.6, cape: -1 })),
    A(M({ lean: 1.6, legs: [-3, 3], fh: [12.5, -2, 3], swing: 0.15, bh: [5, 6, 4], swing2: -1.2, cape: -4, halo: 1 })),
    A(M({ lean: 1.9, legs: [-4, 3], fh: [8, 10, 4], swing: 1.45, bh: [-3, 3, -1], swing2: -2.5, cape: -4 })),
    A(M({ lean: 0.8, legs: [-3, 3], fh: [7, 9, 3], swing: 1.2, bh: [-6, -6, -2], swing2: -2.9, cape: -3 })),
    A(M({ lean: 2.3, legs: [-4, 4], fh: [3, 8, 2], swing: 1.0, bh: [13, 0, 4.5], swing2: 0, cape: -5, halo: 1 })),
    A(M({ lean: 1.7, legs: [-3, 3], fh: [4, 9, 2], swing: 0.9, bh: [11, -7, 4.5], swing2: -0.8, cape: -3 })),
    A(M({ lean: 0.8, legs: [-2, 2], fh: [6, 9, 2.5], swing: 0.7, bh: [8, 0, 5], swing2: -1.6, cape: -2 })),
    A(M({ bob: 2, bend: [1, 1], lean: 0.3, legs: [-2, 2], cape: -1, halo: 1 })),
  ],
  // A whirl (the Whirlwind, Cinder Whirl, Wire Sweep, whirls): arms flung wide, the blades
  // going round the body. Eight frames make one turn; the game turns him to the other side halfway.
  spin: () => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const th = k / 8 * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
    return A(M({ bob: k % 2 ? 2 : 0, bend: [1.2, 1.2], legs: [-3 - sn, 3 + sn], lean: c * 0.6, cape: sn * 7 - 2, halo: k % 2 ? -1 : 0,
      fh: [c * 12 + 2, -1 + sn * 1.5, 2 + sn * 5], swing: c >= 0 ? 0.1 - sn * 0.25 : Math.PI - 0.1 + sn * 0.25, bh: [-c * 11 + 4, -0.5 - sn * 1.5, -sn * 5 + 1], swing2: c >= 0 ? Math.PI - 0.1 - sn * 0.25 : 0.1 + sn * 0.25 })); }),
  // A throw (Fan of Knives, Knife Belt): the front arm cocked behind the head, flung forward, followed through.
  throw: () => [
    A(M({ lean: -1.4, legs: [-2, 2], bend: [1, 1], fh: [-5, -8, 0], swing: -2.5, bh: [8, 2, 5], swing2: -0.4, cape: -1 })),
    A(M({ lean: 1.8, legs: [-4, 3], fh: [13, -4, 3], swing: -0.25, bh: [2, 6, 3], swing2: -2, cape: -4, halo: 1 })),
    A(M({ lean: 1.5, legs: [-3, 3], fh: [11, 5, 3], swing: 0.8, bh: [3, 6, 3], swing2: -2, cape: -3 })),
    A(M({ lean: 0.6, legs: [-2, 2], cape: -2 })),
  ],
  // Blades struck together over the head (Steel Chime), then thrown apart.
  clash: () => [
    A(M({ lean: -0.8, legs: [-2, 2], bend: [1, 1], fh: [3, -10, 3], swing: -2.2, bh: [9, -9, 4.5], swing2: -0.9, cape: -1, halo: -1 })),
    A(M({ lean: 0, legs: [-2, 2], fh: [5.5, -12, 3.5], swing: -1.3, bh: [6, -12, 4.5], swing2: -1.8, cape: -1, halo: -2 })),
    A(M({ bob: 2, bend: [1.5, 1.5], legs: [-4, 4], fh: [12, -3, 3], swing: -0.2, bh: [-7, -4, -2], swing2: -2.9, cape: 2 })),
    A(M({ lean: 0.4, legs: [-2, 2], cape: -1 })),
  ],
  // A rite cast: a great cross cut, both blades from high to low.
  cast: () => [
    A(M({ lean: -1.2, legs: [-1, 1], fh: [-2, -11, 1], swing: -2.4, bh: [-4, -9, -1], swing2: -2.6, cape: -1, halo: -1 })),
    A(M({ lean: 0.6, legs: [-2, 2], fh: [10, -6, 3], swing: -0.6, bh: [10, -5, 4.5], swing2: -0.9, cape: -2 })),
    A(M({ lean: 2, legs: [-4, 3], fh: [9, 10, 4], swing: 1.3, bh: [11, 8, 4.5], swing2: 1.0, cape: -4, halo: 1 })),
    A(M({ lean: 0.8, legs: [-2, 2], cape: -2 })),
  ],
  // A 3-frame flinch: arms thrown up and out.
  hit: () => [
    A(M({ lean: -2.5, legs: [-2, 1], cape: 2, halo: -2, blink: true, fh: [2, -4, 2], swing: -0.9, bh: [-5, -3, -1], swing2: 2.8 })),
    A(M({ lean: -1.6, legs: [-1, 1], cape: 2, halo: -2, fh: [4, 2, 2], swing: -0.2, bh: [-2, 2, 1], swing2: 2.4 })),
    A(M({ lean: -1, cape: 1, halo: -1 })),
  ],
  die: () => {
    const kneel = () => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, blink: true, haloAt: [9, -6], fh: [6, 13, 3], swing: 1.5, bh: [2, 12, 1], swing2: 1.7 });
    return [
      A(M({ lean: -2.5, legs: [-3, 1], cape: 3, halo: -3, blink: true, fh: [2, -4, 2], swing: -0.9, bh: [-5, -3, -1], swing2: 2.8 })),
      A(M({ bob: 4, bend: [2, 2], legs: [-2, 2], lean: -1, cape: 2, blink: true, haloAt: [6, -14], fh: [6, 10, 3], swing: 1.2, bh: [0, 9, 1], swing2: 1.4 })),
      A(kneel()),
      posedFrame(() => M({ bob: 6, bend: [3, 3], legs: [-2, 3], lean: 1.5, cape: 2, blink: true, haloAt: [80, 0], fh: [6, 13, 3], swing: 1.5, bh: [2, 12, 1], swing2: 1.7 }), A(kneel()), { rot: 1.4, dx: 4, dy: 2 }),
    ];
  },
  // The dash: bent low, both blades trailing behind.
  dash: () => [
    A(M({ lean: 2.5, legs: -4, lift: [1, 0], cape: -6, halo: 1, fh: [-4, 7, 1], swing: 2.7, bh: [-7, 5, -3], swing2: 2.9 })),
    A(M({ lean: 3.5, bob: 2, legs: -6, lift: [2, 1], cape: -9, halo: 2, fh: [-6, 6, 1], swing: 2.9, bh: [-9, 4, -3], swing2: 3.0 })),
    A(M({ lean: 2, legs: -3, lift: [0, 1], cape: -5, halo: 1, fh: [-3, 8, 1], swing: 2.6, bh: [-6, 6, -3], swing2: 2.8 })),
  ],
}; };
// One sheet per vestment set (round 50), like the Saint's: mendicant_nails and so on.
export default { mendicant: anims(null), ...Object.fromEntries(Object.keys(SKINS).filter((k) => !SKINS[k].hero || SKINS[k].hero === 'mendicant').map((k) => [`mendicant_${k}`, anims(k)])) };
