// The Nail Crossbow, floating: a gilded reliquary crossbow that hovers beside
// the Saint and turns to aim. Rendered at 16 angles (22.5 degrees apart) so
// it stays crisp pixel art at every heading; frames aiming left are modelled
// mirrored so the stock never hangs upside down.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, dot } from '../sdf.mjs';
import { MATS, torus, SKINS } from './base.mjs';

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
// Each vestment set skin has its own crossbow: materials swapped (stock,
// limb, gem, rune, runeHot, steel) and one detail added.
const XSKIN = {
  nails: { mats: { stock: 'crimsonDark', gem: 'blood', rune: 'ember', runeHot: 'emberHot' }, extra: 'nails' },
  stride: { mats: { stock: 'charred', limb: 'emberLit', rune: 'ember', runeHot: 'emberHot', gem: 'emberLit' }, extra: 'flames' },
  font: { mats: { stock: 'silver', limb: 'blueRobe', gem: 'gem', rune: 'rune', steel: 'silver' }, extra: 'vial' },
  confessor: { mats: { stock: 'slateDark', limb: 'steel', gem: 'bone', rune: 'violetGlow', runeHot: 'violetGlow' }, extra: 'chain' },
  choir: { mats: { stock: 'cream', limb: 'limb', gem: 'emberLit', rune: 'ember', runeHot: 'emberHot' }, extra: 'candles' },
};
Object.assign(M, { charred: { ramp: 'shroud', bias: -0.15, spec: 0.15 }, emberHot: { ramp: 'ember', glow: 0 }, violetGlow: { ramp: 'violet', glow: 1 } });

// Build the crossbow pointing right, centred on (C, C); my = 1 or -1 mirrors it.
function crossbow(ang, my, skin = null) {
  const S = new Scene(), X = skin ? XSKIN[skin] : null;
  const mt = (m) => (X && X.mats[m]) || m;
  const P = (x, y, z = 0) => [C + x * K, C + y * K * my, z * K];
  const add = (p, k = 0) => S.add(rotZ(p, [C, C], ang), k * K);
  // Stock: dark wood with a gilt butt and a holy gem set in a gold bezel.
  add(box(P(-3, 0.5), [9 * K, 1.5 * K, 1.4 * K], 0.7, mt('stock')), 0);
  add(box(P(-11.5, 1.6), [2.2 * K, 2.4 * K, 1.6 * K], 0.8, mt('stock')), 1);
  add(box(P(-13.6, 1.6), [0.8 * K, 2.8 * K, 1.8 * K], 0.3, mt('limb')), 0);
  add(ellipsoid(P(-4.5, 0.4, 1.4), [2.4 * K, 1.8 * K, 1.2 * K], mt('limb')), 0.4);
  add(ellipsoid(P(-4.5, 0.4, 2.2), [1.6 * K, 1.2 * K, 0.9 * K], mt('gem')), 0);
  // A gilt crosspiece where the prod meets the stock.
  add(box(P(6.6, 0), [1.2 * K, 2.6 * K, 1.8 * K], 0.4, mt('limb')), 0.5);
  // The recurved prod: gilded limbs sweeping back to iron tips, runes glowing.
  for (const s of [-1, 1]) {
    add(capsule(P(7, s * 1.5), P(6.2, s * 6.5), 1.5 * K, 1.2 * K, mt('limb')), 0.8);
    add(capsule(P(6.2, s * 6.5), P(3, s * 11), 1.2 * K, 0.8 * K, mt('limb')), 0.6);
    add(sphere(P(2.8, s * 11.2), 1.1 * K, mt('steel')), 0.3);
    add(ellipsoid(P(6.8, s * 5, 1.1), [0.55 * K, 1.6 * K, 0.4 * K], mt('rune')), 0);
  }
  // The loaded nail with a white-hot point.
  add(capsule(P(-2, -1.4, 0.6), P(12, -1.4, 0.6), 0.7 * K, 0.7 * K, mt('steel')), 0);
  add(capsule(P(12, -1.4, 0.6), P(15.5, -1.4, 0.6), 0.7 * K, 0.15 * K, mt('steel')), 0.3);
  add(sphere(P(15.6, -1.4, 0.6), 1 * K, mt('runeHot')), 0);
  add(box(P(-1.5, -1.4, 0.6), [0.6 * K, 1.2 * K, 0.8 * K], 0.2, mt('limb')), 0);
  // The set's detail.
  if (X && X.extra === 'nails') for (const dy of [-3.4, 1.2]) { add(capsule(P(-1, dy, 2), P(12, dy, 2), 0.8 * K, 0.8 * K, 'steel'), 0); add(sphere(P(13, dy, 2), 1 * K, 'emberHot'), 0); }
  if (X && X.extra === 'flames') for (const s of [-1, 1]) add(ellipsoid(P(2.2, s * 13), [1.8 * K, 2.2 * K, 1.6 * K], 'emberHot'), 0);
  if (X && X.extra === 'vial') { add(sphere(P(-8, -1.6, 1.4), 1.9 * K, 'vial'), 0); add(capsule(P(-8, -3.4, 1.4), P(-8, -4.6, 1.4), 0.7 * K, 0.7 * K, 'silver'), 0); }
  if (X && X.extra === 'chain') for (let i = 0; i < 4; i++) add(torus(P(-10 + i * 2.8, 3 + (i % 2) * 1.2, 2), 1.5 * K, 0.7 * K, i % 2 ? 1.5 : 0.2, 'iron'), 0);
  if (X && X.extra === 'candles') for (const s of [-1, 1]) { add(capsule(P(4, s * 11.4, 1), P(0.6, s * 11.4, 1), 1.1 * K, 1.1 * K, 'wax'), 0); add(ellipsoid(P(-1.2, s * 11.4, 1), [1.6 * K, 1.2 * K, 1.2 * K], 'emberHot'), 0); }
  const f = render(S, S0, S0, M, { contrast: 1.35 });
  const rot = ([x, y]) => { const dx = x - C, dy = y - C, c = Math.cos(ang), sn = Math.sin(ang); return [C + dx * c - dy * sn, C + dx * sn + dy * c]; };
  // The string, from each limb tip back to the nock.
  for (const s of [-1, 1]) {
    const [ax, ay] = rot(P(2.8, s * 11.2)), [bx, by] = rot(P(-1.5, -1.4));
    const n = Math.ceil(Math.hypot(bx - ax, by - ay));
    for (let i = 1; i < n; i++) dot(f, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, skin === 'stride' || skin === 'choir' ? 'ember1' : skin === 'font' ? 'holy1' : 'bone1');
  }
  // A glint on the gem.
  const g = rot(P(-5.2, -0.4)); dot(f, g[0], g[1], 'white');
  return f;
}

// The quiver worn on the Saint's back (drawn behind the Saint, facing right):
// a leather case with nail heads, banded in its set's colours.
const QUIVER = { null: ['leather', 'gold'], nails: ['crimsonDark', 'gold'], stride: ['charred', 'emberHot'], font: ['silver', 'blueRobe'], confessor: ['slateDark', 'steel'], choir: ['cream', 'limb'] };
function quiver(skin) {
  const [body, band] = QUIVER[skin], S = new Scene();
  S.add(capsule([9, 6, 0], [6, 20, 0], 2.6, 2.4, body), 0);
  for (const y of [9, 17]) S.paint({ f: (x, yy) => Math.abs(yy - y + (x - 7.5) * 0.2) - 0.9, mat: band });
  for (const dx of [-1.6, 0.6, 2.6]) S.add(capsule([9 + dx, 6, 0.5], [10.6 + dx, 1.6, 0.5], 0.8, 0.8, 'steel'), 0.3);
  return Object.assign(render(S, 18, 24, M, { contrast: 1.35 }), { ax: 9, ay: 23 });
}

// The Mendicant's flanged mace, laid on a slant (round 55): the icon for his
// weapon Wounds, where the Saint's show the crossbow.
function mace() {
  const S = new Scene(), ang = -0.75;
  const P = (x, y, z = 0) => [C + x * K, C + y * K, z * K];
  const add = (p, k = 0) => S.add(rotZ(p, [C, C], ang), k * K);
  add(capsule(P(-13, 0), P(3, 0), 1.5 * K, 1.5 * K, 'stock'), 0); // haft
  add(sphere(P(-14, 0), 1.8 * K, 'limb'), 0.4); // pommel
  for (const x of [-9, -5]) add(box(P(x, 0), [0.7 * K, 1.9 * K, 1.9 * K], 0.3, 'limb'), 0.3); // grip bands
  add(box(P(3.5, 0), [1 * K, 2.4 * K, 2.4 * K], 0.4, 'limb'), 0.4); // collar
  add(sphere(P(9, 0), 4.2 * K, 'iron'), 0); // head
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; add(sphere(P(9 + Math.cos(a) * 4.7, Math.sin(a) * 4.7, 0.6), 1.7 * K, 'steel'), 0); } // studs
  add(sphere(P(9, 0, 4), 1.6 * K, 'steel'), 0);
  const f = render(S, S0, S0, M, { contrast: 1.35 });
  const rot = ([x, y]) => { const dx = x - C, dy = y - C, c = Math.cos(ang), sn = Math.sin(ang); return [C + dx * c - dy * sn, C + dx * sn + dy * c]; };
  const g = rot(P(7.5, -2)); dot(f, g[0], g[1], 'white');
  for (const [x, y] of [[9, 2.6], [11.6, 0.4], [6.6, 0.8], [9.4, -1]]) { const q = rot(P(x, y)); dot(f, q[0], q[1], 'iron2'); } // stud shadows, placed by hand
  return f;
}

export default {
  weapon: {
    mace: () => [mace()],
    ...Object.fromEntries(Object.keys(QUIVER).map((k) => [k === 'null' ? 'quiver' : `quiver_${k}`, () => [quiver(k)]])),
    xbow: () => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return crossbow(a, Math.cos(a) < -0.01 ? -1 : 1); }),
    ...Object.fromEntries(Object.keys(XSKIN).map((k) => [`xbow_${k}`, () => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return crossbow(a, Math.cos(a) < -0.01 ? -1 : 1, k); })])),
  },
};
