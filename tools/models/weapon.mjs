// The Nail Crossbow, floating: a gilded reliquary crossbow that hovers beside
// the Saint and turns to aim. Rendered at 16 angles (22.5 degrees apart) so
// it stays crisp pixel art at every heading; frames aiming left are modelled
// mirrored so the stock never hangs upside down.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, dot } from '../sdf.mjs';
import { MATS, torus, SKINS, PSY } from './base.mjs';

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
// Round 117: the premium skins' crossbows. `orb` puts a glowing bead on each limb tip; `rainbow` bands the whole bow.
Object.assign(XSKIN, {
  enlightened: { mats: { stock: 'void', limb: 'wing', gem: 'shardGlow', rune: 'violetGlow', runeHot: 'violetGlow', steel: 'wingDark' }, orb: 'shardGlow' },
  void: { mats: { stock: 'void', limb: 'limb', gem: 'roseGlow', rune: 'roseGlow', runeHot: 'roseGlow', steel: 'void' }, orb: 'roseGlow' },
  psychedelic: { mats: { stock: 'psyViolet', limb: 'psyGold', gem: 'psyBlue', rune: 'roseGlow', runeHot: 'roseGlow', steel: 'psyRose' }, rainbow: true },
  dread: { mats: { stock: 'void', limb: 'silver', gem: 'vial', rune: 'vial', runeHot: 'vial', steel: 'steel' }, orb: 'vial' },
  radiant: { mats: { stock: 'violetRobe', limb: 'limb', gem: 'roseGlow', rune: 'tealGlow', runeHot: 'gem', steel: 'limb' }, orb: 'roseGlow' },
  divine: { mats: { stock: 'white', limb: 'limb', gem: 'tealGlow', rune: 'tealGlow', runeHot: 'gem', steel: 'silver' }, orb: 'tealGlow' },
  demonic: { mats: { stock: 'charredBow', limb: 'crimsonDark', gem: 'emberHot', rune: 'ember', runeHot: 'emberHot', steel: 'horn' }, extra: 'flames' },
});
Object.assign(M, { charredBow: { ramp: 'shroud', bias: -0.3, spec: 0.12, min: 3 }, charred: { ramp: 'shroud', bias: -0.15, spec: 0.15 }, emberHot: { ramp: 'ember', glow: 0 }, violetGlow: { ramp: 'violet', glow: 1 } });

// Round 123: each premium skin's crossbow is its own build, not a recolour. A builder adds its parts with
// add(shape) in the crossbow's own frame (P(x, y, z): x along the aim, y across) and returns the limb tips the
// string runs from, and the string's colour.
Object.assign(M, { sunGlow: { ramp: 'gold', glow: 1 }, lime: { ramp: 'flame', glow: 1 }, boneW: { ramp: 'bone', spec: 0.35 } });
const ring = (add, P, c, R, r, mat, n = 16) => { for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; add(capsule(P(c[0] + Math.cos(a0) * R, c[1] + Math.sin(a0) * R, c[2] || 0), P(c[0] + Math.cos(a1) * R, c[1] + Math.sin(a1) * R, c[2] || 0), r * K, r * K, mat), 0.2); } };
const PXBOW = {
  // Enlightened: a slim black stock through a gold halo, wings of lilac feathers for limbs.
  enlightened: (add, P) => {
    add(capsule(P(-13, 0.8), P(7, 0.4), 1.4 * K, 1.1 * K, 'void'), 0); ring(add, P, [-4, 0.5, 0.5], 3.2, 0.7, 'halo');
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) add(capsule(P(7 - k * 0.6, s * 1.6), P(5 - k * 2.4, s * (5.5 + k * 1.9)), (1.5 - k * 0.15) * K, 0.6 * K, k % 2 ? 'wingDark' : 'wing'), 0.5);
    add(capsule(P(-2, -1.4, 0.6), P(15, -1.4, 0.6), 0.75 * K, 0.4 * K, 'shardGlow'), 0);
    return { tips: [[-2.2, -11.2], [-2.2, 11.2]], str: 'violet1' };
  },
  // The Void: an angular black stock, the prod a gold lattice, rose rings round it, a crown of spikes at the front.
  void: (add, P) => {
    add(box(P(-3, 0.5), [10 * K, 1.8 * K, 1.4 * K], 0.2, 'void'), 0); add(box(P(-12.5, 1.8), [2.4 * K, 2.8 * K, 1.6 * K], 0.2, 'void'), 0.5);
    for (const s of [-1, 1]) { add(capsule(P(7, s * 1.5), P(4, s * 11), 0.8 * K, 0.6 * K, 'limb'), 0.2); add(capsule(P(4, s * 11), P(-0.5, s * 5.5), 0.7 * K, 0.6 * K, 'limb'), 0.2); add(capsule(P(-0.5, s * 5.5), P(7, s * 1.5), 0.7 * K, 0.7 * K, 'limb'), 0.2); ring(add, P, [3.5, s * 7, 1.2], 1.8, 0.5, 'roseGlow', 10); }
    for (const dy of [-1.8, 0, 1.8]) add(capsule(P(8, dy), P(11 + (dy ? 0 : 1.5), dy * 1.4), 0.7 * K, 0.2 * K, 'limb'), 0.2);
    add(capsule(P(-2, -1.4, 0.6), P(14, -1.4, 0.6), 0.7 * K, 0.4 * K, 'roseGlow'), 0);
    return { tips: [[4, -11], [4, 11]], str: 'rose1' };
  },
  // Psychedelic: a rainbow for a prod, beads of every colour down the stock, a star at the butt.
  psychedelic: (add, P) => {
    for (let k = 0; k < 7; k++) add(capsule(P(-13 + k * 2.8, 0.6), P(-10.2 + k * 2.8, 0.6), 1.9 * K, 1.9 * K, PSY[k]), 0.3);
    for (let k = 0; k < 14; k++) { const a0 = -1.35 + k / 14 * 2.7, a1 = -1.35 + (k + 1) / 14 * 2.7; add(capsule(P(1.5 + Math.cos(a0) * 9.5, Math.sin(a0) * 11), P(1.5 + Math.cos(a1) * 9.5, Math.sin(a1) * 11), 1.8 * K, 1.8 * K, PSY[k % 7]), 0.2); }
    for (const [x, y] of [[-15.5, 0.6], [-14, -1.8], [-14, 3], [-17, 0.6]]) add(sphere(P(x, y), 1.3 * K, 'psyGold'), 0.4);
    add(capsule(P(-2, -1.4, 0.6), P(14, -1.4, 0.6), 0.7 * K, 0.4 * K, 'psyRose'), 0);
    return { tips: [[3.4, -10.7], [3.4, 10.7]], str: 'rose1' };
  },
  // The Dread: a bone stock ending in a skull, ribs for limbs, a scythe blade along the top, green lights.
  dread: (add, P) => {
    add(capsule(P(-11, 0.8), P(7, 0.4), 1.3 * K, 1.1 * K, 'boneW'), 0); add(sphere(P(-12.8, 0.8), 2.6 * K, 'boneW'), 0.5);
    for (const dy of [-0.4, 1.9]) add(sphere(P(-13.6, dy, 1.6), 0.7 * K, 'lime'), 0);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const x0 = 7 - k * 2.2; add(capsule(P(x0, s * 1.4), P(x0 - 1.5, s * (6 + k)), 0.8 * K, 0.6 * K, 'boneW'), 0.3); add(capsule(P(x0 - 1.5, s * (6 + k)), P(x0 - 4.5, s * (9.5 + k * 0.6)), 0.6 * K, 0.4 * K, 'boneW'), 0.3); }
    const sc = [0, 1, 2, 3, 4].map((k) => P(-6 + k * 4.2, -3 - k * k * 0.42, 1.4)); for (let k = 0; k < 4; k++) add(capsule(sc[k], sc[k + 1], (1.2 - k * 0.2) * K, (1 - k * 0.2) * K, 'steel'), 0.3);
    add(capsule(P(-2, -1.4, 0.6), P(14, -1.4, 0.6), 0.7 * K, 0.4 * K, 'lime'), 0);
    return { tips: [[-2.5, -10.7], [-2.5, 10.7]], str: 'flame1' };
  },
  // The Radiant: a violet stock, straight gold limbs, a sunburst blazing behind the prod.
  radiant: (add, P) => {
    add(box(P(-3, 0.5), [9 * K, 1.5 * K, 1.4 * K], 0.7, 'violetRobe'), 0); add(box(P(-11.5, 1.6), [2.2 * K, 2.4 * K, 1.6 * K], 0.8, 'violetRobe'), 1);
    add(sphere(P(6, 0, -1.5), 3.6 * K, 'sunGlow'), 0); for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; add(capsule(P(6 + Math.cos(a) * 3, Math.sin(a) * 3, -2), P(6 + Math.cos(a) * (k % 2 ? 8 : 10.5), Math.sin(a) * (k % 2 ? 8 : 10.5), -2), 0.7 * K, 0.3 * K, 'sunGlow'), 0.2); }
    for (const s of [-1, 1]) add(capsule(P(7, s * 1.4), P(4.5, s * 11.5), 1.2 * K, 0.8 * K, 'limb'), 0.4);
    add(capsule(P(-2, -1.4, 0.6), P(15, -1.4, 0.6), 0.7 * K, 0.4 * K, 'limb'), 0);
    return { tips: [[4.5, -11.5], [4.5, 11.5]], str: 'gold1' };
  },
  // The Divine: a white stock, and for a prod a great gold ring set with teal stones.
  divine: (add, P) => {
    add(box(P(-3, 0.5), [9 * K, 1.5 * K, 1.4 * K], 0.7, 'white'), 0); add(box(P(-11.5, 1.6), [2.2 * K, 2.4 * K, 1.6 * K], 0.8, 'white'), 1); add(box(P(-13.6, 1.6), [0.8 * K, 2.8 * K, 1.8 * K], 0.3, 'limb'), 0);
    ring(add, P, [4.5, 0, 0.5], 10, 1.1, 'limb', 20); for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) add(sphere(P(4.5 + Math.cos(a) * 10, Math.sin(a) * 10, 1.6), 1.5 * K, 'tealGlow'), 0);
    add(capsule(P(-2, -1.4, 0.6), P(15, -1.4, 0.6), 0.7 * K, 0.4 * K, 'tealGlow'), 0);
    return { tips: [[4.5, -10], [4.5, 10]], str: 'teal1' };
  },
  // Demonic: a charred stock with a molten eye, horns curling back for limbs.
  demonic: (add, P) => {
    add(box(P(-3, 0.5), [9.5 * K, 1.7 * K, 1.4 * K], 0.4, 'charredBow'), 0); add(box(P(-11.8, 1.8), [2.4 * K, 2.8 * K, 1.6 * K], 0.4, 'charredBow'), 0.6); add(ellipsoid(P(-4.5, 0.4, 1.6), [1.8 * K, 1.2 * K, 1 * K], 'emberHot'), 0);
    for (const s of [-1, 1]) { const h = [[7, 1.4], [6, 5.5], [3, 9], [-1, 10.5], [-3.5, 9]].map(([x, y]) => P(x, s * y)); for (let k = 0; k < 4; k++) add(capsule(h[k], h[k + 1], (1.7 - k * 0.32) * K, (1.4 - k * 0.32) * K, 'horn'), 0.5); }
    add(capsule(P(-2, -1.4, 0.6), P(14, -1.4, 0.6), 0.7 * K, 0.4 * K, 'emberHot'), 0);
    return { tips: [[-1, -10.5], [-1, 10.5]], str: 'ember1' };
  },
};
// Build the crossbow pointing right, centred on (C, C); my = 1 or -1 mirrors it.
function crossbow(ang, my, skin = null) {
  if (skin && PXBOW[skin]) return pcrossbow(ang, my, skin);
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
  if (X && X.orb) for (const s of [-1, 1]) add(sphere(P(2.4, s * 12.4, 0.6), 1.7 * K, X.orb), 0);
  if (X && X.rainbow) { const c = Math.cos(ang), sn = Math.sin(ang); PSY.forEach((m, i) => S.paint({ f: (x, y) => { const u = (x - C) * c + (y - C) * sn, v = (((u / (2.6 * K)) % 7) + 7) % 7; return Math.abs(v - i - 0.5) - 0.5; }, mat: m })); }
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

function pcrossbow(ang, my, skin) {
  // rotZ bounds a part by its own size round the pivot; these parts sit far out, so give each the whole frame.
  const S = new Scene(), P = (x, y, z = 0) => [C + x * K, C + y * K * my, z * K], add = (p, k = 0) => { const q = rotZ(p, [C, C], ang); q.bb = [0, 0, q.bb[2], S0, S0, q.bb[5]]; S.add(q, k * K); };
  const { tips, str } = PXBOW[skin](add, P);
  const f = render(S, S0, S0, M, { contrast: 1.35 });
  const rot = ([x, y]) => { const dx = x - C, dy = y - C, c = Math.cos(ang), sn = Math.sin(ang); return [C + dx * c - dy * sn, C + dx * sn + dy * c]; };
  for (const [tx, ty] of tips) { const [ax, ay] = rot(P(tx, ty)), [bx, by] = rot(P(-1.5, -1.4)), n = Math.ceil(Math.hypot(bx - ax, by - ay)); for (let i = 1; i < n; i++) dot(f, ax + (bx - ax) * i / n, ay + (by - ay) * i / n, str); }
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

// The Vesper's two daggers, crossed points up (round 118; the Mendicant's mace
// until then, and the anim keeps the name 'mace'): the icon for the class's
// weapon Wounds, where the Saint's show the crossbow.
function mace() {
  const S = new Scene();
  const P = (x, y, z = 0) => [C + x * K, C + y * K, z * K];
  for (const [ang, z] of [[-0.8, 0], [-Math.PI + 0.8, 1.2]]) {
    const add = (p, k = 0) => S.add(rotZ(p, [C, C], ang), k * K);
    add(sphere(P(-12.5, 0, z), 1.7 * K, 'limb'), 0.3);                          // pommel
    add(capsule(P(-11.5, 0, z), P(-6.5, 0, z), 1.4 * K, 1.4 * K, 'stock'), 0.3); // grip
    add(box(P(-5.5, 0, z), [0.9 * K, 3.2 * K, 1.3 * K], 0.4, 'limb'), 0.3);      // guard
    add(capsule(P(-5, 0, z), P(12, 0, z), 2 * K, 0.5 * K, 'steel'), 0.2);         // blade
  }
  return render(S, S0, S0, M, { contrast: 1.35 });
}

export default {
  weapon: {
    mace: () => [mace()],
    ...Object.fromEntries(Object.keys(QUIVER).map((k) => [k === 'null' ? 'quiver' : `quiver_${k}`, () => [quiver(k)]])),
    xbow: () => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return crossbow(a, Math.cos(a) < -0.01 ? -1 : 1); }),
    ...Object.fromEntries(Object.keys(XSKIN).map((k) => [`xbow_${k}`, () => Array.from({ length: 16 }, (_, i) => { const a = i * Math.PI / 8; return crossbow(a, Math.cos(a) < -0.01 ? -1 : 1, k); })])),
  },
};
