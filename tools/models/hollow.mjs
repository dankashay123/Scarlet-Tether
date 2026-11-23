// Round 186: Stratum IV, the Hollow Below. Everything here is built on the Saint's own body (saintModel in
// base.mjs): the Wound sent the same child down again and again, and what is left of those Saints walks here.
//   mon_common: husk (the Husk: an earlier Saint's empty robe, faded to grey, clawing)
//   mon_rare:   lostSaint (a Lost Saint: dull crimson, a guttering light in the palm it throws)
//   mon_warden: hollowSaint (the Hollow Saint: the part of the Saint that stayed below; ink-black cloth with violet
//               cracks and a dark halo; rendered at model scale 2 through MODEL_K in tools/sprites.mjs)
// Same conventions as the other sets: facing right, ax/ay at the feet, eyes hand-placed (saintModel does that).
import { deathFrames } from '../deaths.mjs';
import { capsule, dot, mk } from '../sdf.mjs';
import { MATS, HEROES, saintModel, reactions, rear } from './base.mjs';

Object.assign(MATS, {
  husk: { ramp: 'stone', bias: -0.08, spec: 0.03 }, huskDark: { ramp: 'stone', bias: -0.3, min: 3 }, huskTrim: { ramp: 'bone', bias: -0.3, spec: 0.05, min: 2 },
  lostRobe: { ramp: 'brick', bias: -0.25, spec: 0.04, min: 2 }, lostDark: { ramp: 'roof', bias: -0.3, min: 3 }, lostTrim: { ramp: 'gold', bias: -0.35, spec: 0.2, min: 2 },
  hollowRobe: { ramp: 'ink', bias: 0.1, spec: 0.12, min: 1 }, hollowDark: { ramp: 'ink', bias: -0.25, min: 3 }, hollowTrim: { ramp: 'violet', bias: -0.15, spec: 0.3 },
  hollowCrack: { ramp: 'violet', glow: 1 },
});
// Body set-ups for saintModel: materials, eye colours and a few sculpted touches.
HEROES.husk = {
  w: 48, ox: 0, point: true, noHalo: true, eyes: ['stone1', 'stone2', 'stone3'],
  mats: { robe: 'husk', robeDark: 'huskDark', hood: 'huskDark', cowl: 'husk', cape: 'huskDark', capeHem: 'huskTrim', tabard: 'huskDark', trim: 'huskTrim', cross: 'huskDark', hose: 'huskDark', boot: 'huskDark' },
  // Torn strips hanging from the sleeves and the hem.
  add: (S, { cx, B, X }) => { for (const [dx, y0, l] of [[-5, 44, 9], [-1, 46, 8], [4, 45, 10], [7, 40, 7]]) S.add(capsule([cx + dx + X, y0 + B, 2.6], [cx + dx + X + 0.8, y0 + l + B, 2.8], 0.9, 0.5, 'huskDark'), 0.4); },
};
HEROES.lostSaint = {
  w: 48, ox: 0, point: true, halo: 'lostTrim', eyes: ['ember0', 'ember1', 'ember3'],
  mats: { robe: 'lostRobe', robeDark: 'lostDark', hood: 'lostRobe', cowl: 'lostRobe', cape: 'lostDark', capeHem: 'lostTrim', tabard: 'huskDark', trim: 'lostTrim', cross: 'lostDark', hose: 'lostDark', boot: 'leather' },
  add: () => {},
  // A guttering ember light in the palm, where the Saint holds a holy one.
  dots: (f, { hand }) => { dot2(f, hand[0] + 1.4, hand[1] - 1.4, 'ember1'); dot2(f, hand[0] + 2, hand[1] - 2.6, 'ember0'); },
};
HEROES.hollowSaint = {
  w: 56, ox: 4, point: true, halo: 'hollowTrim', eyes: ['violet0', 'violet1', 'violet3'],
  mats: { robe: 'hollowRobe', robeDark: 'hollowDark', hood: 'hollowDark', cowl: 'hollowRobe', cape: 'hollowDark', capeHem: 'hollowTrim', tabard: 'hollowDark', trim: 'hollowTrim', cross: 'hollowCrack', hose: 'hollowDark', boot: 'hollowDark' },
  // Violet cracks running down the robe and the cape, as if the cloth were glass with light behind it.
  add: (S, { cx, B, X, bh }) => {
    for (const [x0, y0, x1, y1] of [[1.5, 31, -0.5, 38], [-0.5, 38, 1.8, 44], [-2.4, 44, -1, 50], [3.2, 46, 4.4, 51]]) S.paint({ mat: 'hollowCrack', f: (x, y, z) => { const ax = cx + x0 + X, ay = y0 + B, bx = cx + x1 + X, by = y1 + B, vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy))); return Math.max(Math.hypot(x - ax - vx * t, y - ay - vy * t) - 0.55, -z + 1.5); } });
    // A shard of dark light in the back hand.
    S.add(capsule([bh[0], bh[1] + 0.5, bh[2] - 0.5], [bh[0] - 1.2, bh[1] + 6, bh[2] - 0.5], 0.9, 0.3, 'hollowCrack'), 0.3);
  },
  dots: (f, { hand }) => { dot2(f, hand[0] + 1.4, hand[1] - 1, 'violet1'); dot2(f, hand[0] + 2.2, hand[1] - 2, 'violet0'); dot2(f, hand[0] + 1.6, hand[1] - 2.6, 'violet2'); },
};
const dot2 = (f, x, y, c) => dot(f, x, y, c);

const A = (f) => Object.assign(f, { ax: mk(22) + mk(HEROES[f._h]?.ox || 0), ay: mk(62) });
const body = (h, o) => { const f = saintModel({ hero: h, ...o }); f._h = h; return A(f); };
// The Saint's walk (saint.mjs), on another body.
function walk(h, extra = {}) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const t = i / 8, AMP = extra.amp ?? 6.5, H = extra.lift ?? 3.6;
    const leg = (p) => { p = ((p % 1) + 1) % 1; if (p < 0.5) return { x: AMP - 4 * AMP * p, up: 0, bend: 0 }; const u = (p - 0.5) * 2, e = u * u * (3 - 2 * u); return { x: -AMP + 2 * AMP * e, up: H * Math.sin(Math.PI * u), bend: 1.6 * Math.sin(Math.PI * u) }; };
    const b = leg(t + 0.5), f = leg(t);
    return body(h, { bob: (i % 4 < 2 ? 2 : 0) + (extra.bob || 0), legs: [b.x, f.x], lift: [b.up, f.up], bend: [b.bend, f.bend], cape: -3, lean: extra.lean ?? 1, aim: extra.aim || 0, halo: extra.halo || 0 });
  });
}
// The Husk walks bent and slow, the halo long gone dark; it claws down with the front hand.
const husk = (o) => body('husk', { lean: 2.4, bob: 2, aim: 4, halo: 4, ...o });
// The Lost Saint and the Hollow Saint cast like the Saint (a gathered hand, then a thrust).
const caster = (h) => [body(h, { lean: -1, reach: -0.6, aim: 2, cape: -1, halo: -1 }), body(h, { lean: -1.6, reach: -0.3, aim: -5, legs: [-1, 1], halo: -2 }), body(h, { lean: 1.5, reach: 1, legs: [-3, 2], cape: -4, halo: 1 })];

const mon_common = {}, mon_rare = {}, mon_warden = {};
{
  const r = reactions(() => husk({}), 0);
  mon_common.husk_walk = () => walk('husk', { amp: 4.5, lift: 2.2, lean: 2.4, aim: 4, halo: 4 });
  mon_common.husk_attack = () => [husk({ aim: -6, reach: -0.4 }), rear(() => husk({ aim: -6, reach: -0.4 })), husk({ aim: 8, reach: 1, lean: 3.4, legs: [-3, 3] })];
  mon_common.husk_hit = r.hit; mon_common.husk_die = r.die;
}
{
  const r = reactions(() => body('lostSaint', {}), 0.2);
  mon_rare.lostSaint_walk = () => walk('lostSaint', { lean: 0.5 });
  mon_rare.lostSaint_attack = () => caster('lostSaint');
  mon_rare.lostSaint_hit = r.hit; mon_rare.lostSaint_die = r.die;
}
{
  const r = reactions(() => body('hollowSaint', {}), 0.8);
  mon_warden.hollowSaint_walk = () => walk('hollowSaint', { lean: 1.4 });
  mon_warden.hollowSaint_attack = () => caster('hollowSaint');
  mon_warden.hollowSaint_hit = r.hit; mon_warden.hollowSaint_die = () => deathFrames('hollowSaint', body('hollowSaint', {}));
}
export default { mon_common, mon_rare, mon_warden };
