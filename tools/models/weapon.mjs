// The Nail Crossbow, floating: a gilded reliquary crossbow that hovers beside
// the Saint and turns to aim. Rendered at 16 angles (22.5 degrees apart) so
// it stays crisp pixel art at every heading; frames aiming left are modelled
// mirrored so the stock never hangs upside down.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, dot } from '../sdf.mjs';
import { MATS, torus } from './base.mjs';

const S0 = 48, C = S0 / 2, K = 1.3; // frame size, pivot at the centre, model scale
const M = {
  ...MATS,
  stock: { ramp: 'wood', spec: 0.2, bias: -0.08 },
  limb: { ramp: 'gold', spec: 0.7, bias: -0.04 },
  steel: { ramp: 'iron', spec: 0.9 },
  gem: { ramp: 'holy', spec: 1, bias: 0.1, min: 0 },
  rune: { ramp: 'holy', glow: 1 },
  runeHot: { ramp: 'holy', glow: 0 },
};

// Build the crossbow pointing right, centred on (C, C); my = 1 or -1 mirrors it.
function crossbow(ang, my) {
  const S = new Scene();
  const P = (x, y, z = 0) => [C + x * K, C + y * K * my, z * K];
  const add = (p, k = 0) => S.add(rotZ(p, [C, C], ang), k * K);
  // Stock: dark wood with a gilt butt and a holy gem set in a gold bezel.
  add(box(P(-3, 0.5), [9 * K, 1.5 * K, 1.4 * K], 0.7, 'stock'), 0);
  add(box(P(-11.5, 1.6), [2.2 * K, 2.4 * K, 1.6 * K], 0.8, 'stock'), 1);
  add(box(P(-13.6, 1.6), [0.8 * K, 2.8 * K, 1.8 * K], 0.3, 'limb'), 0);
  add(ellipsoid(P(-4.5, 0.4, 1.4), [2.4 * K, 1.8 * K, 1.2 * K], 'limb'), 0.4);
  add(ellipsoid(P(-4.5, 0.4, 2.2), [1.6 * K, 1.2 * K, 0.9 * K], 'gem'), 0);
  // A gilt crosspiece where the prod meets the stock.
  add(box(P(6.6, 0), [1.2 * K, 2.6 * K, 1.8 * K], 0.4, 'limb'), 0.5);
  // The recurved prod: gilded limbs sweeping back to iron tips, runes glowing.
  for (const s of [-1, 1]) {
    add(capsule(P(7, s * 1.5), P(6.2, s * 6.5), 1.5 * K, 1.2 * K, 'limb'), 0.8);
    add(capsule(P(6.2, s * 6.5), P(3, s * 11), 1.2 * K, 0.8 * K, 'limb'), 0.6);
    add(sphere(P(2.8, s * 11.2), 1.1 * K, 'steel'), 0.3);
    add(ellipsoid(P(6.8, s * 5, 1.1), [0.55 * K, 1.6 * K, 0.4 * K], 'rune'), 0);
  }
  // The loaded nail with a white-hot point.
  add(capsule(P(-2, -1.4, 0.6), P(12, -1.4, 0.6), 0.7 * K, 0.7 * K, 'steel'), 0);
  add(capsule(P(12, -1.4, 0.6), P(15.5, -1.4, 0.6), 0.7 * K, 0.15 * K, 'steel'), 0.3);
  add(sphere(P(15.6, -1.4, 0.6), 1 * K, 'runeHot'), 0);
  add(box(P(-1.5, -1.4, 0.6), [0.6 * K, 1.2 * K, 0.8 * K], 0.2, 'limb'), 0);
  const f = render(S, S0, S0, M, { contrast: 1.35 });
  const rot = ([x, y]) => { const dx = x - C, dy = y - C, c = Math.cos(ang), sn = Math.sin(ang); return [C + dx * c - dy * sn, C + dx * sn + dy * c]; };
  // The string, from each limb tip back to the nock.
  for (const s of [-1, 1]) {
    const [ax, ay] = rot(P(2.8, s * 11.2)), [bx, by] = rot(P(-1.5, -1.4));
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let i = 1; i < n; i++) dot(f, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, 'bone1');
  }
  // A glint on the gem.
  const g = rot(P(-5.2, -0.4)); dot(f, g[0], g[1], 'white');
  return f;
}

export default {
  weapon: {
    xbow: () => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return crossbow(a, Math.cos(a) < -0.01 ? -1 : 1); }),
  },
};
