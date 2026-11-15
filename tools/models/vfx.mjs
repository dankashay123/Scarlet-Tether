// Effects and small objects in the sculpted style, at the v5 size.
// Solid things (bolt, thurible, flask, chain, hook) are SDF models.
// Soft things (impacts, blood bursts, smoke, orbs) are 2D metaball forms lit
// from the top-left and banded onto palette ramps, with no dithering.
import { Scene, sphere, ellipsoid, capsule, box, rotZ, render, bumpy, clip, dot, pline, LIGHT } from '../sdf.mjs';
import { MATS, torus, PSY } from './base.mjs';
import { IDX, FINE } from '../palette.mjs';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const frame = (w, h) => ({ w, h, px: new Int16Array(w * h).fill(-1) });
const put = (f, x, y, name) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.px[y * f.w + x] = IDX[name]; };
const get = (f, x, y) => (x >= 0 && y >= 0 && x < f.w && y < f.h ? f.px[y * f.w + x] : -1);
const sh = (ramp, s) => FINE[ramp][clamp(Math.round(s), 0, 8)];

// --------------------------------------------------------- metaball forms ---
// balls: [x, y, r]. Lit as a soft dome; `outline` 'ramp' darkens the rim on
// the shaded side, 'ink' adds the usual dark outline, null leaves it bare.
export function blobs(w, h, balls, { ramp, min = 0, max = 8, outline = 'ramp', bias = 0, k = 1.6, f = frame(w, h) } = {}) {
  // Height = smooth union of sphere caps, so lobes melt together without dimples.
  const Hh = (x, y) => { let acc = 0; for (const [bx, by, r] of balls) { const d2 = (x - bx) ** 2 + (y - by) ** 2; if (d2 < r * r) acc += Math.exp(Math.sqrt(r * r - d2) * k); } return acc > 0 ? Math.log(acc) / k : -1; };
  const drawn = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x + 0.5, sy = y + 0.5, hc = Hh(sx, sy); if (hc < 0) continue;
    const hx = (a, b) => { const v = Hh(a, b); return v < 0 ? 0 : v; };
    const dx = (hx(sx + 0.5, sy) - hx(sx - 0.5, sy)), dy = (hx(sx, sy + 0.5) - hx(sx, sy - 0.5));
    const nl = Math.hypot(dx, dy, 1), n = [-dx / nl, -dy / nl, 1 / nl];
    const ndl = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    const v = clamp((ndl + 0.25) / 1.25 + bias, 0, 1);
    put(f, x, y, sh(ramp, clamp(Math.round((1 - v) * 8), min, max)));
    drawn[y * w + x] = 1;
  }
  if (outline) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (drawn[y * w + x]) continue;
      let nb = false, lit = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && drawn[yy * w + xx]) { nb = true; if (dx > 0 || dy > 0) lit = true; } }
      if (nb && get(f, x, y) < 0) add.push([x, y, lit]);
    }
    for (const [x, y, lit] of add) put(f, x, y, outline === 'ink' ? (lit ? sh(ramp, 8) : 'outline') : sh(ramp, lit ? Math.min(8, max + 1) : 8));
  }
  return f;
}

// ---------------------------------------------------------------- energy ---
// A hit flash: white-hot core, gold rays, ember fringe.
function impact(i) {
  const S = 30, c = S / 2, f = frame(S, S);
  const core = [3.5, 5.5, 4.5, 0][i], ring = [0, 0, 7, 10][i], rayL = [9, 14, 13, 0][i], rayW = [2.2, 2.6, 1.6, 0][i];
  const n = 8, rot = i * 0.18;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    let v = 0;
    if (core) v = Math.max(v, 1 - r / core);
    if (rayL) { const sec = ((a - rot) / (Math.PI * 2 / n) % 1 + 1) % 1, ad = Math.abs(sec - 0.5) * 2; const long = Math.round((a - rot) / (Math.PI * 2 / n)) % 2 === 0 ? 1 : 0.6; const along = 1 - r / (rayL * long); const across = 1 - (1 - ad) * r * 0.9 / rayW; if (along > 0) v = Math.max(v, Math.min(along * 1.2, across)); }
    if (ring) { const d = Math.abs(r - ring); v = Math.max(v, (1 - d / (i === 3 ? 1.1 : 1.6)) * (i === 3 ? 0.55 : 0.8)); }
    if (v <= 0.08) continue;
    put(f, x, y, v > 0.72 ? 'white' : v > 0.5 ? 'gold0' : v > 0.3 ? 'gold1' : v > 0.16 ? 'ember1' : 'ember2');
  }
  if (i >= 2) for (let k = 0; k < 8; k++) { const a = k * 0.785 + 0.4, r = i === 2 ? 11 : 13; put(f, c + Math.cos(a) * r, c + Math.sin(a) * r, i === 2 ? 'gold0' : 'ember1'); }
  return f;
}
// A blood burst: a lit splash that throws droplets.
function burst(i) {
  const W = 44, H = 36, cx = 22, cy = 18, balls = [];
  if (i === 0) balls.push([cx, cy, 6], [cx - 3, cy - 2, 4], [cx + 4, cy + 1, 4]);
  else {
    const spread = [0, 7, 13, 16][i], r = [0, 4.6, 3, 2.2][i];
    if (i === 1) balls.push([cx, cy, 5]);
    for (let k = 0; k < 9; k++) { const a = k * 0.7 + hash(k, 1) * 0.5, d = spread * (0.6 + hash(k, 2) * 0.6); balls.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, r * (0.6 + hash(k, 3) * 0.6)]); }
  }
  const f = blobs(W, H, balls, { ramp: 'blood', min: 0, max: 6, outline: 'ramp', bias: 0.08 });
  if (i < 2) { put(f, cx - 3, cy - 3, 'white'); put(f, cx - 2, cy - 3, 'blood0'); }
  return f;
}
// Smoke: soft grey puffs that swell and break apart.
function smoke(i) {
  const S = 26, c = 13, balls = [];
  const spread = [2, 5, 7, 9][i], r = [5, 5, 4, 2.6][i], n = [3, 5, 6, 6][i];
  for (let k = 0; k < n; k++) { const a = k * (Math.PI * 2 / n) + 0.3, d = spread * (0.7 + hash(k, 5) * 0.4); balls.push([c + Math.cos(a) * d, c + Math.sin(a) * d * 0.85 - i, r * (0.8 + hash(k, 6) * 0.35)]); }
  if (i < 2) balls.push([c, c - i, r + 1]);
  return blobs(S, S, balls, { ramp: 'stone', min: 0, max: 6, outline: i < 3 ? 'ramp' : null, bias: 0.16, k: 0.9 });
}
// Enemy shots: glowing orbs with a lit face and a bright glint.
function orb(ramp, { r = 4.2, tail = false } = {}) {
  const f = frame(16, 16), balls = [[8, 8, r]];
  if (tail) balls.push([5, 9, r * 0.6], [3, 10, r * 0.35]);
  blobs(16, 16, balls, { ramp, min: 0, max: 6, outline: 'ink', bias: 0.12, f });
  put(f, 7, 6, 'white'); put(f, 6, 7, sh(ramp, 0));
  return f;
}

// --------------------------------------------------------------- objects ---
const A = (f, ax, ay) => Object.assign(f, { ax, ay });
// The nail bolt, flying right: a forged iron nail with a gilt collar.
// Set bolts (docs/SETS.md): shaft, collar and point per vestment set.
const BOLTS = {
  nails: ['gold', 'crimson', 'gold0'], stride: ['emberLit', 'ember', 'ember0'], font: ['holy', 'iron', 'holy0'],
  confessor: ['slate', 'iron', 'violet0'], choir: ['gold', 'cloth', 'ember0'],
  // Round 117: the premium skins' bolts.
  enlightened: ['wing', 'shardGlow', 'violet0'], void: ['void', 'gold', 'rose0'], psychedelic: ['psyRose', 'lime', 'holy0'], dread: ['slate', 'vial', 'flame0'],
  radiant: ['gold', 'roseGlow', 'gold0'], divine: ['white', 'gold', 'teal0'], demonic: ['molten', 'crimson', 'ember0'],
};
function bolt(skin = null) {
  if (skin && PBOLT[skin]) return pbolt(skin);
  const [shaft, collar, tip] = skin ? BOLTS[skin] : ['iron', 'gold', 'gold0'];
  const S = new Scene();
  S.add(capsule([4, 4.5, 2], [17, 4.5, 2], 1.1, 1.1, shaft), 0);
  S.add(capsule([17, 4.5, 2], [21.5, 4.5, 2], 1.1, 0.2, shaft), 0.6);
  S.add(ellipsoid([3, 4.5, 2], [1.2, 2.6, 2.4], shaft), 0.5);
  S.paint({ f: (x) => Math.abs(x - 7.5) - 0.9, mat: collar });
  const f = render(S, 23, 9, MATS, { contrast: 1.5 });
  put(f, 20, 4, 'white'); put(f, 19, 4, tip);
  return f;
}
// The Anchoress's reliquary shards (round 71): a violet crystal splinter in a
// gilt cap, turning as it orbits (4 frames), and the splinter it fires.
function shard(i) {
  const S = new Scene(), a = [0, 0.5, 0, -0.5][i], w = [1, 0.62, 0.3, 0.62][i];
  S.add(rotZ(ellipsoid([7, 9, 2], [2.6 * w + 0.6, 5.2, 2], 'shardGlow'), [7, 9], a * 0.3), 0);
  S.add(rotZ(capsule([7, 3.6, 2], [7, 2, 2], 1.6 * w + 0.5, 0.6, 'gold'), [7, 9], a * 0.3), 0.3);
  const f = render(S, 14, 16, MATS, { contrast: 1.5, rich: IRICH });
  if (i !== 2) dot(f, 6, 7, 'white');
  return f;
}
// Round 73: the Anchoress's shards as ice-blue crystal blades, 16 headings
// (frame i points at angle i / 16 of a turn, seen from above at a slant so
// shards pointing at or away from the camera look shorter). Two facets: the
// upper one pale and lit, the lower one deep blue.
const CM = { ...MATS, ice: { ramp: 'holy', spec: 0.9, bias: 0.12, max: 4 }, iceDark: { ramp: 'holy', bias: -0.18, min: 2, max: 6 } };
// Round 76: `slim` is the same blade thinner and a little shorter, for shards in flight (`crystalbolt`).
// Round 117: the premium skins' shards: [lit facet ramp, dark facet ramp] (psychedelic bands the blade instead).
export const CRYSTALS = { enlightened: ['violet', 'violet'], void: ['rose', 'ink'], psychedelic: null, dread: ['flame', 'ink'], radiant: ['gold', 'rose'], divine: ['cloth', 'gold'], demonic: ['ember', 'crimson'] };
for (const [k, v] of Object.entries(CRYSTALS)) if (v) { CM[`ice_${k}`] = { ramp: v[0], spec: 0.9, bias: 0.12, max: 4 }; CM[`iceDark_${k}`] = { ramp: v[1], bias: -0.18, min: 2, max: 6 }; }
function crystal(i, slim = false, skin = null) {
  if (skin && PCRY[skin]) return pweapon('cry', i, skin, 34, PCRY_LEN * (slim ? 0.85 : 1));
  const a = i / 16 * Math.PI * 2, dx0 = Math.cos(a), dy0 = Math.sin(a) * 0.55, dl = Math.hypot(dx0, dy0), dx = dx0 / dl, dy = dy0 / dl;
  const L = (15 + 9 * Math.abs(Math.cos(a))) * (slim ? 0.95 : 1), c = [17, 17], S = new Scene(), R0 = slim ? 3.9 : 4.8;
  const at = (t) => [c[0] + dx * t, c[1] + dy * t, 3];
  const ice = skin && CRYSTALS[skin] ? `ice_${skin}` : 'ice', iceDark = skin && CRYSTALS[skin] ? `iceDark_${skin}` : 'iceDark';
  S.add(capsule(at(-L * 0.18), at(L * 0.6), R0, 0.35, ice), 0);
  S.add(capsule(at(-L * 0.18), at(-L * 0.34), R0, slim ? 1.2 : 1.6, ice), 0.4);
  const nx = -dy, ny = dx, down = ny > 0 || (ny === 0 && nx < 0) ? 1 : -1;
  S.paint({ f: (x, y) => -((x - c[0]) * nx + (y - c[1]) * ny) * down, mat: iceDark });
  if (skin === 'psychedelic') PSY.forEach((m, k) => S.paint({ f: (x, y) => { const u = (x - c[0]) * dx + (y - c[1]) * dy, v = (((u / 3) % 7) + 7) % 7; return Math.abs(v - k - 0.5) - 0.5; }, mat: m }));
  const f = render(S, 34, 34, CM, { contrast: 1.2 });
  put(f, c[0] - nx * down * (slim ? 1 : 1.5) + dx * 1, c[1] - ny * down * (slim ? 1 : 1.5) + dy * 1, 'white');
  return f;
}
// Round 119: the Vesper's two floating daggers, 16 headings (frame i points at
// angle i / 16 of a turn, seen from above at a slant like the crystals). Each
// look is [blade ramp, guard ramp, grip ramp]: plain, each premium skin, each of
// his sets. The blade has a lit and a dark facet and a glint by the point.
export const DAGGERS = { plain: ['iron', 'gold', 'crimson'], enlightened: ['violet', 'violet', 'ink'], void: ['rose', 'gold', 'ink'], psychedelic: ['iron', 'gold', 'violet'], dread: ['flame', 'ink', 'ink'], radiant: ['gold', 'rose', 'gold'], divine: ['cloth', 'gold', 'gold'], demonic: ['ember', 'crimson', 'ink'],
  rags: ['iron', 'wood', 'wood'], iron: ['iron', 'iron', 'ink'], road: ['iron', 'sand', 'wood'], alms: ['moss', 'gold', 'moss'], gaol: ['blood', 'iron', 'brick'], bell: ['teal', 'gold', 'teal'] };
const DM = { ...MATS };
for (const [k, [b, g, h]] of Object.entries(DAGGERS)) { DM[`db_${k}`] = { ramp: b, spec: 0.9, bias: 0.15, max: 4 }; DM[`dd_${k}`] = { ramp: b, bias: -0.15, min: 2, max: 6 }; DM[`dg_${k}`] = { ramp: g, spec: 0.6, max: 5 }; DM[`dh_${k}`] = { ramp: h, bias: -0.1, min: 2 }; }
function vdagger(i, k = 'plain') {
  if (PDAG[k]) return pweapon('dag', i, k, 34, PDAG_LEN);
  const a = i / 16 * Math.PI * 2, dx0 = Math.cos(a), dy0 = Math.sin(a) * 0.55, dl = Math.hypot(dx0, dy0), dx = dx0 / dl, dy = dy0 / dl;
  const L = 11 + 6 * Math.abs(Math.cos(a)), c = [16, 16], S = new Scene(), at = (t, z = 3) => [c[0] + dx * t, c[1] + dy * t, z], nx = -dy, ny = dx;
  S.add(capsule(at(-1), at(L), 2.6, 0.45, `db_${k}`), 0);                                                      // the blade
  S.add(capsule([c[0] - dx + nx * 3.4, c[1] - dy + ny * 3.4, 3], [c[0] - dx - nx * 3.4, c[1] - dy - ny * 3.4, 3], 1.1, 1.1, `dg_${k}`), 0.3); // the guard
  S.add(capsule(at(-2), at(-5.6), 1.3, 1.2, `dh_${k}`), 0.3);                                                  // the grip
  S.add(sphere(at(-6.8), 1.5, `dg_${k}`), 0.3);                                                                // the pommel
  const down = ny > 0 || (ny === 0 && nx < 0) ? 1 : -1;
  S.paint({ f: (x, y) => Math.max(-((x - c[0]) * nx + (y - c[1]) * ny) * down, -((x - c[0]) * dx + (y - c[1]) * dy) - 0.5), mat: `dd_${k}` });
  if (k === 'psychedelic') PSY.forEach((m, j) => S.paint({ f: (x, y) => { const u = (x - c[0]) * dx + (y - c[1]) * dy, v = (((u / 2.5) % 7) + 7) % 7; return Math.max(Math.abs(v - j - 0.5) - 0.5, -u); }, mat: m }));
  const f = render(S, 32, 32, DM, { contrast: 1.25 });
  put(f, c[0] + dx * L * 0.6 - nx * down, c[1] + dy * L * 0.6 - ny * down, 'white');
  return f;
}
// Round 123: every premium skin's daggers and shards have their own shape, not a recolour. A model is built
// along its heading: F.at(u, v, z) is a point u along the axis (from the grip toward the point) and v across it
// in the screen; F.L is the length (shorter when the heading points at or away from the camera).
const PM = { ...MATS, pw_violet: { ramp: 'violet', spec: 0.8, bias: 0.15 }, pw_violetGlow: { ramp: 'violet', glow: 1 }, pw_ink: { ramp: 'ink', bias: 0.2, min: 1, spec: 0.5 }, pw_gold: { ramp: 'gold', spec: 0.9, bias: 0.05 },
  pw_rose: { ramp: 'rose', glow: 1 }, pw_lime: { ramp: 'flame', glow: 1 }, pw_bone: { ramp: 'bone', spec: 0.4 }, pw_sun: { ramp: 'gold', glow: 1 }, pw_white: { ramp: 'cloth', spec: 0.5, bias: 0.15 }, pw_teal: { ramp: 'teal', glow: 1 },
  pw_ember: { ramp: 'ember', glow: 1 }, pw_horn: { ramp: 'bone', bias: -0.3, spec: 0.4 }, pw_char: { ramp: 'shroud', bias: -0.3, spec: 0.2, min: 3 }, pw_steel: { ramp: 'iron', spec: 0.9, bias: 0.1 } };
for (const m of PSY) PM[m] = MATS[m];
function axisF(i, size, len) {
  const a = i / 16 * Math.PI * 2, dx0 = Math.cos(a), dy0 = Math.sin(a) * 0.55, dl = Math.hypot(dx0, dy0), dx = dx0 / dl, dy = dy0 / dl, nx = -dy, ny = dx, c = [size / 2, size / 2];
  const L = len * (0.62 + 0.38 * Math.abs(Math.cos(a)));
  return { L, dx, dy, nx, ny, c, at: (u, v = 0, z = 3) => [c[0] + dx * u + nx * v, c[1] + dy * u + ny * v, z], down: ny > 0 || (ny === 0 && nx < 0) ? 1 : -1 };
}
const band = (S, F, mats, step) => mats.forEach((m, k) => S.paint({ f: (x, y) => { const u = (x - F.c[0]) * F.dx + (y - F.c[1]) * F.dy, w = (((u / step) % mats.length) + mats.length) % mats.length; return Math.abs(w - k - 0.5) - 0.5; }, mat: m }));
// The daggers (blade from u = 0 to the point at u = L; grip below 0).
const PDAG = {
  // Enlightened: a feather of violet light for a blade, a little halo for a guard.
  enlightened: (S, F) => { const L = F.L; for (let k = 0; k < 5; k++) { const u = (k + 0.5) * L / 5; S.add(ellipsoid(F.at(u, 0), [2.2, 2.2, 1.2].map((r, j) => j < 2 ? 0.7 + 2.3 * Math.sin(Math.PI * (k + 0.6) / 5.6) : r), 'pw_violet'), 0.9); }
    S.add(capsule(F.at(-1), F.at(L * 0.95), 0.5, 0.3, 'pw_violetGlow'), 0); S.add(torus(F.at(-0.6, 0, 4), 2.6, 0.7, Math.PI / 2, 'pw_gold'), 0); S.add(capsule(F.at(-1.5), F.at(-5.5), 1, 1, 'pw_ink'), 0.3); },
  // The Void: a wavy black blade edged in gold, a rose ring for a pommel.
  void: (S, F) => { const L = F.L, pts = [0, 1, 2, 3, 4].map((k) => F.at(k * L / 4.4, k % 2 ? 1.3 : -1.3)); pts.push(F.at(L, 0)); for (let k = 0; k < pts.length - 1; k++) S.add(capsule(pts[k], pts[k + 1], 2.5 - k * 0.3, 2.1 - k * 0.3, 'pw_ink'), 0.8); S.paint({ f: (x, y) => 1.5 - Math.abs((x - F.c[0]) * F.nx + (y - F.c[1]) * F.ny) + ((x - F.c[0]) * F.dx + (y - F.c[1]) * F.dy < 0.5 ? 9 : 0), mat: 'pw_gold' });
    S.add(capsule(F.at(-0.3, -3.2), F.at(-0.3, 3.2), 0.9, 0.9, 'pw_gold'), 0.2); S.add(capsule(F.at(-1), F.at(-4.5), 1, 1, 'pw_ink'), 0.3); S.add(torus(F.at(-6.4, 0, 3.5), 1.8, 0.65, Math.PI / 2, 'pw_rose'), 0); },
  // Psychedelic: a lightning bolt of every colour, a star for a pommel.
  psychedelic: (S, F) => { const L = F.L, pts = [F.at(0, 0), F.at(L * 0.35, 2.2), F.at(L * 0.55, -1.6), F.at(L, 1)]; for (let k = 0; k < 3; k++) S.add(capsule(pts[k], pts[k + 1], 2.2 - k * 0.45, 1.8 - k * 0.5, 'psyGold'), 0.5); band(S, F, PSY, 2);
    S.add(capsule(F.at(-1), F.at(-4.5), 1, 1, 'pw_ink'), 0.3); for (const [u, v] of [[-6.5, 0], [-5.5, 1.6], [-5.5, -1.6], [-7.8, 0]]) S.add(sphere(F.at(u, v), 0.9, 'psyRose'), 0.6); },
  // The Dread: a sickle, its edge burning green, on a bone grip.
  dread: (S, F) => { const L = F.L, pts = [0, 1, 2, 3, 4, 5].map((k) => { const t = k / 5; return F.at(t * L * 0.85, (t * t) * 6 * F.down); }); for (let k = 0; k < 5; k++) S.add(capsule(pts[k], pts[k + 1], 2.4 - k * 0.38, 2.05 - k * 0.38, 'pw_steel'), 0.5);
    for (let k = 2; k < 6; k++) S.add(sphere([pts[k][0], pts[k][1], 4.2], 0.6, 'pw_lime'), 0); S.add(capsule(F.at(-0.5), F.at(-5.5), 1.1, 0.9, 'pw_bone'), 0.4); S.add(sphere(F.at(-6.4), 1.4, 'pw_bone'), 0.4); },
  // The Radiant: a gold blade rising out of a sunburst.
  radiant: (S, F) => { const L = F.L; S.add(capsule(F.at(0), F.at(L), 2.3, 0.4, 'pw_gold'), 0); for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; S.add(capsule(F.at(0, 0, 4), F.at(Math.cos(t) * 3.4, Math.sin(t) * 3.4, 4), 0.55, 0.3, 'pw_sun'), 0.2); }
    S.add(sphere(F.at(0, 0, 4.5), 1.4, 'pw_sun'), 0.3); S.add(capsule(F.at(-1.5), F.at(-5), 1, 1, 'violetRobe'), 0.3); },
  // The Divine: a broad white blade through a gold ring set with a teal stone.
  divine: (S, F) => { const L = F.L; S.add(capsule(F.at(0), F.at(L), 2.4, 0.5, 'pw_white'), 0.2); S.add(torus(F.at(-0.6, 0, 3.5), 3, 0.8, Math.PI / 2, 'pw_gold'), 0); S.add(sphere(F.at(-0.6, 0, 4.4), 1.2, 'pw_teal'), 0);
    S.add(capsule(F.at(-2.5), F.at(-5.5), 0.9, 0.9, 'pw_gold'), 0.3); },
  // Demonic: a jagged blade with teeth along one edge and horns for a guard.
  demonic: (S, F) => { const L = F.L, d = F.down; S.add(capsule(F.at(0), F.at(L), 2.6, 0.45, 'pw_char'), 0.2); for (let k = 1; k <= 3; k++) S.add(capsule(F.at(k * L / 4.2, -d * 1.8), F.at(k * L / 4.2 - 2.4, -d * 4), 1.2, 0.35, 'pw_char'), 0.3);
    S.paint({ f: (x, y) => Math.abs((x - F.c[0]) * F.nx + (y - F.c[1]) * F.ny) - 0.6 + ((x - F.c[0]) * F.dx + (y - F.c[1]) * F.dy < 1 ? 9 : 0), mat: 'pw_ember' });
    for (const s of [-1, 1]) { S.add(capsule(F.at(-0.5, s * 1), F.at(-1, s * 3.6), 0.9, 0.7, 'pw_horn'), 0.3); S.add(capsule(F.at(-1, s * 3.6), F.at(-3.4, s * 4.6), 0.7, 0.3, 'pw_horn'), 0.3); } S.add(capsule(F.at(-1), F.at(-5), 1, 1, 'pw_char'), 0.3); },
};
// The shards (hovering crystals; slim for flight), centred on the frame.
const PCRY = {
  enlightened: (S, F) => { const L = F.L; for (let k = 0; k < 6; k++) { const u = -L * 0.4 + (k + 0.5) * L / 6; S.add(ellipsoid(F.at(u, 0), [0.8 + 2.6 * Math.sin(Math.PI * (k + 0.7) / 6.4), 0.8 + 2.6 * Math.sin(Math.PI * (k + 0.7) / 6.4), 1.3], 'pw_violet'), 1); } S.add(capsule(F.at(-L * 0.5), F.at(L * 0.6), 0.55, 0.3, 'pw_violetGlow'), 0); },
  void: (S, F) => { const L = F.L; S.add(sphere(F.at(0), 4.2, 'pw_ink'), 0); for (const [u, v] of [[L * 0.6, 0], [-L * 0.5, 0], [0, 6], [0, -6]]) S.add(capsule(F.at(0), F.at(u, v), 2.8, 0.4, 'pw_ink'), 0.4); S.add(torus(F.at(0, 0, 4.5), 4.4, 0.85, Math.PI / 2, 'pw_gold'), 0); S.add(sphere(F.at(0, 0, 6), 1.6, 'pw_rose'), 0); },
  psychedelic: (S, F) => { const L = F.L; S.add(capsule(F.at(-L * 0.45), F.at(L * 0.55), 2.6, 0.3, 'psyGold'), 0.4); S.add(capsule(F.at(0, -5), F.at(0, 5), 2, 0.3, 'psyGold'), 0.4); band(S, F, PSY, 1.8); S.add(sphere(F.at(0, 0, 5), 1.2, 'pw_white'), 0); },
  dread: (S, F) => { const L = F.L; S.add(capsule(F.at(-L * 0.45), F.at(L * 0.55), 2.4, 0.5, 'pw_bone'), 0.3); for (const u of [-L * 0.2, 0, L * 0.2]) S.add(capsule(F.at(u, -2.6), F.at(u, 2.6), 0.6, 0.6, 'pw_bone'), 0.3); S.add(sphere(F.at(L * 0.55), 1.6, 'pw_lime'), 0); },
  radiant: (S, F) => { const L = F.L; S.add(capsule(F.at(-L * 0.5), F.at(L * 0.6), 1.2, 0.3, 'pw_gold'), 0); S.add(sphere(F.at(L * 0.1, 0, 4), 2.6, 'pw_sun'), 0.3); for (let k = 0; k < 6; k++) { const t = k / 6 * Math.PI * 2 + 0.5; S.add(capsule(F.at(L * 0.1, 0, 4), F.at(L * 0.1 + Math.cos(t) * 4.6, Math.sin(t) * 4.6, 4), 0.5, 0.3, 'pw_sun'), 0.2); } },
  divine: (S, F) => { const L = F.L; for (const s of [-1, 1]) S.add(capsule(F.at(0), F.at(s * L * (s > 0 ? 0.55 : 0.4)), 3, 0.4, 'pw_teal'), 0.4); S.add(torus(F.at(0, 0, 3.5), 4.2, 0.8, Math.PI / 2, 'pw_gold'), 0); for (const v of [-4.2, 4.2]) S.add(sphere(F.at(0, v, 4), 0.9, 'pw_white'), 0); },
  demonic: (S, F) => { const L = F.L, d = F.down, pts = [0, 1, 2, 3, 4].map((k) => { const t = k / 4; return F.at(-L * 0.45 + t * L, -d * Math.sin(t * Math.PI * 0.8) * 3.5); }); for (let k = 0; k < 4; k++) S.add(capsule(pts[k], pts[k + 1], 2.6 - k * 0.55, 2.1 - k * 0.55, k < 2 ? 'pw_horn' : 'pw_char'), 0.6); S.add(sphere(pts[4], 1.3, 'pw_ember'), 0); },
};
const PDAG_LEN = 17, PCRY_LEN = 21;
function pweapon(kind, i, skin, size, len) {
  const F = axisF(i, size, len), S = new Scene(); (kind === 'dag' ? PDAG : PCRY)[skin](S, F);
  const f = render(S, size, size, PM, { contrast: 1.25 });
  put(f, F.at(F.L * (kind === 'dag' ? 0.62 : 0.2))[0] - F.nx * F.down, F.at(F.L * (kind === 'dag' ? 0.62 : 0.2))[1] - F.ny * F.down, 'white');
  return f;
}
// Round 125: each premium skin's crossbow bolt has its own shape to match its crossbow (PXBOW in weapon.mjs),
// flying right like the plain bolt: the point near x = 25, the tail near x = 3, the axis at y = 6.5.
const PK = 1.35, R = (r) => r * PK, PB = (u, v = 0, z = 3) => [2 + u * PK, 8.5 + v * PK, z];
const PBOLT = {
  // Enlightened: a shaft of violet light, a gold point and three feathers for fletching.
  enlightened: (S) => { S.add(capsule(PB(5), PB(21), R(1.1), R(1.1), 'pw_violetGlow'), 0); S.add(capsule(PB(20), PB(25.5), R(1.6), R(0.25), 'pw_gold'), 0.4);
    for (const v of [-1, 1]) S.add(rotZ(ellipsoid(PB(5, v * 3), [R(3.6), R(1.5), R(1.2)], 'pw_violet'), PB(5, v * 3), v * 0.45), 0.15); S.add(torus(PB(10, 0, 3), R(1.6), R(0.6), Math.PI / 2, 'pw_gold'), 0); },
  // The Void: a black shaft, a gold spearhead with two barbs and a rose ring behind it.
  void: (S) => { S.add(capsule(PB(4), PB(19), R(1), R(1), 'pw_ink'), 0); S.add(capsule(PB(18), PB(25.5), R(2), R(0.25), 'pw_gold'), 0.4);
    for (const s of [-1, 1]) S.add(capsule(PB(19, s * 1.2), PB(16.5, s * 3.3), R(0.8), R(0.3), 'pw_gold'), 0.3); S.add(torus(PB(14, 0, 3), R(1.9), R(0.7), Math.PI / 2, 'pw_rose'), 0); S.add(sphere(PB(4), R(1.5), 'pw_gold'), 0.4); },
  // Psychedelic: a bolt of lightning in every colour with a star at the tail.
  psychedelic: (S) => { const pts = [PB(7, 0), PB(12, 2), PB(16, -1.6), PB(25, 0.6)]; for (let k = 0; k < 3; k++) S.add(capsule(pts[k], pts[k + 1], R(1.5 - k * 0.25), R(1.3 - k * 0.45), 'psyGold'), 0.5);
    PSY.forEach((m, k) => S.paint({ f: (x) => { const w = ((((x - 2) / PK / 2.2) % PSY.length) + PSY.length) % PSY.length; return Math.abs(w - k - 0.5) - 0.5 + (x < 2 + 8 * PK ? 9 : 0); }, mat: m }));
    for (const [u, v] of [[4.5, 0], [6.4, 0], [3, 0], [4.5, 1.9], [4.5, -1.9]]) S.add(sphere(PB(u, v), R(1.1), 'psyRose'), 0.7); },
  // The Dread: a bone shaft with rib barbs and a little scythe for a head, its edge burning green.
  dread: (S) => { S.add(capsule(PB(4), PB(19), R(1), R(1), 'pw_bone'), 0); for (const u of [7, 10.5, 14]) S.add(capsule(PB(u, -2.4), PB(u - 1.2, 2.4), R(0.85), R(0.85), 'pw_bone'), 0.3);
    const pts = [0, 1, 2, 3, 4].map((k) => { const t = k / 4; return PB(18 + t * 7, -t * t * 3.6); }); for (let k = 0; k < 4; k++) S.add(capsule(pts[k], pts[k + 1], R(1.9 - k * 0.35), R(1.55 - k * 0.35), 'pw_steel'), 0.5);
    for (let k = 1; k < 5; k++) S.add(sphere([pts[k][0], pts[k][1] + R(0.7), 4], R(0.8), 'pw_lime'), 0); },
  // The Radiant: a gold shaft carrying a small sun at its point.
  radiant: (S) => { S.add(capsule(PB(4), PB(20), R(1), R(0.9), 'pw_gold'), 0); S.add(sphere(PB(21.5, 0, 4), R(2.2), 'pw_sun'), 0.3);
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; S.add(capsule(PB(21.5, 0, 4), PB(21.5 + Math.cos(t) * 4, Math.sin(t) * 4, 4), R(0.7), R(0.45), 'pw_sun'), 0.2); } S.add(capsule(PB(4, -1.5), PB(6.5, 0), R(0.6), R(0.5), 'pw_gold'), 0.3); S.add(capsule(PB(4, 1.5), PB(6.5, 0), R(0.6), R(0.5), 'pw_gold'), 0.3); },
  // The Divine: a white shaft through a gold ring, a teal stone for a point.
  divine: (S) => { S.add(capsule(PB(4), PB(20), R(1), R(1), 'pw_white'), 0); S.add(torus(PB(11, 0, 3), R(2.6), R(0.75), Math.PI / 2, 'pw_gold'), 0);
    S.add(capsule(PB(19), PB(25.5), R(2), R(0.3), 'pw_teal'), 0.3); S.add(capsule(PB(18.6, -2.2), PB(18.6, 2.2), R(0.7), R(0.7), 'pw_gold'), 0.2); S.add(sphere(PB(4), R(1.4), 'pw_gold'), 0.4); },
  // Demonic: a charred shaft with curled horns for fletching and a molten point.
  demonic: (S) => { S.add(capsule(PB(5), PB(20), R(1.1), R(1), 'pw_char'), 0); S.add(capsule(PB(19), PB(25.5), R(2), R(0.3), 'pw_ember'), 0.4);
    for (const s of [-1, 1]) { S.add(capsule(PB(8, s * 0.8), PB(5, s * 3), R(0.9), R(0.7), 'pw_horn'), 0.3); S.add(capsule(PB(5, s * 3), PB(2.6, s * 2), R(0.7), R(0.3), 'pw_horn'), 0.3); }
    for (const u of [11, 15]) S.add(capsule(PB(u, -1), PB(u - 2, -2.8), R(0.8), R(0.3), 'pw_char'), 0.3); },
};
function pbolt(skin) {
  const S = new Scene(); PBOLT[skin](S);
  const f = render(S, 37, 18, PM, { contrast: 1.25 });
  put(f, 33, 8, 'white');
  return f;
}
function shardBolt() {
  const S = new Scene();
  S.add(capsule([4, 4.5, 2], [20, 4.5, 2], 2.4, 0.4, 'ice'), 0);
  S.paint({ f: (x, y) => 4.5 - y, mat: 'iceDark' });
  const f = render(S, 23, 9, CM, { contrast: 1.3 });
  put(f, 17, 4, 'white');
  return f;
}
// The thurible: a pierced brass censer on its chain, embers glowing inside.
function thurible(i) {
  const S = new Scene(), cx = 10;
  S.add(sphere([cx, 14, 2], 6, 'gold'), 0);
  S.add(ellipsoid([cx, 9, 2], [4.6, 2.6, 4], 'gold'), 1.2);
  S.add(capsule([cx, 6.5, 2], [cx, 4, 2], 1.4, 0.9, 'gold'), 0.8);
  S.add(torus([cx, 2.4, 2], 1.6, 0.55, 0, 'iron'), 0);
  S.add(box([cx, 19.6, 2], [2.4, 0.8, 2], 0.4, 'gold'), 0.6);
  S.paint({ f: (x, y) => Math.abs(y - 11.2) - 0.5, mat: 'leather' });
  const f = render(S, 20, 22, MATS, { contrast: 1.35, rich: IRICH });
  // Pierced holes with ember light, flickering between frames.
  const holes = [[cx - 3, 14], [cx, 13], [cx + 3, 14], [cx - 1.5, 16.5], [cx + 1.5, 16.5]];
  holes.forEach(([x, y], k) => { put(f, x, y, (k + i) % 2 ? 'ember0' : 'ember1'); put(f, x, y + 1, 'ember2'); });
  if (i === 1) put(f, cx, 13, 'white');
  return f;
}
// Round 126: each premium skin's censer has its own shape, to go with its crossbow, daggers and shards.
// Built on the plain one's frame (20 x 22, the bowl at [10, 14], the hanging ring at the top), holes glowing
// in the skin's own light: [hole ramp]. `body(S)` adds the shape; holes are [x, y] lit between frames.
const PTHUR = {
  // Enlightened: a violet glass orb in a gold cage, feathers folded under it, a little halo for the ring.
  enlightened: { glow: 'violet', holes: [[7, 14], [10, 13], [13, 14]], body: (S) => { S.add(sphere([10, 13.5, 2], 5.6, 'pw_violet'), 0); S.add(torus([10, 13.5, 2], 5.4, 0.7, Math.PI / 2, 'pw_gold'), 0);
    for (const s of [-1, 1]) S.add(rotZ(ellipsoid([10 + s * 4, 19.5, 2], [3.6, 1.4, 1.4], 'pw_violet'), [10 + s * 4, 19.5], s * 0.5), 0.4); S.add(capsule([10, 7.5, 2], [10, 5, 2], 1.2, 0.8, 'pw_gold'), 0.6); S.add(torus([10, 2.6, 2], 2, 0.6, 0, 'pw_gold'), 0); } },
  // The Void: a black orb latticed in gold under a crown of spikes, a rose ring round its middle.
  void: { glow: 'rose', holes: [[7, 15], [10, 16], [13, 15]], body: (S) => { S.add(sphere([10, 14, 2], 5.8, 'pw_ink'), 0); for (const a of [-0.6, 0.6]) S.add(rotZ(torus([10, 14, 2], 5.6, 0.45, Math.PI / 2, 'pw_gold'), [10, 14], a), 0);
    for (const x of [6, 8, 10, 12, 14]) S.add(capsule([x, 9.5, 2], [x + (x - 10) * 0.25, x === 10 ? 5 : 6.5, 2], 0.9, 0.3, 'pw_gold'), 0.3); S.add(torus([10, 15, 3.5], 7, 0.6, Math.PI / 2.4, 'pw_rose'), 0); S.add(torus([10, 2.6, 2], 1.6, 0.55, 0, 'pw_gold'), 0);
    S.add(torus([10, 14, 3.2], 6.1, 0.8, Math.PI / 2, 'pw_gold'), 0); } }, // round 128: a gold rim, so the orb shows on dark floors
  // Psychedelic: a bowl in running bands of colour, a star on the lid.
  psychedelic: { glow: 'gold', holes: [[7, 14], [10, 13], [13, 14], [8.5, 16.5], [11.5, 16.5]], body: (S) => { S.add(sphere([10, 14, 2], 6, 'psyGold'), 0); S.add(ellipsoid([10, 9, 2], [4.6, 2.6, 4], 'psyGold'), 1.2);
    PSY.forEach((m, k) => S.paint({ f: (x, y) => { const w = (((y / 1.6) % PSY.length) + PSY.length) % PSY.length; return Math.abs(w - k - 0.5) - 0.5 + (y < 7 ? 9 : 0); }, mat: m }));
    for (const [x, y] of [[10, 5.2], [8.2, 5.2], [11.8, 5.2], [10, 3.6], [10, 6.8]]) S.add(sphere([x, y, 3], 1, 'psyRose'), 0.6); S.add(torus([10, 1.6, 2], 1.4, 0.5, 0, 'pw_gold'), 0); } },
  // The Dread: a skull hung by its crown, green fire in its eyes and teeth.
  dread: { glow: 'flame', holes: [[7, 13], [12, 13], [10, 17]], body: (S) => { S.add(sphere([10, 12.5, 2], 5.6, 'pw_bone'), 0); S.add(ellipsoid([10, 17, 2], [3.6, 2.6, 3.4], 'pw_bone'), 1);
    for (const x of [7.5, 12.5]) S.add(sphere([x, 13, 6.5], 2, 'pw_char'), 0); S.add(capsule([10, 7, 2], [10, 4.5, 2], 1, 0.8, 'pw_horn'), 0.5); S.add(torus([10, 2.6, 2], 1.6, 0.55, 0, 'pw_horn'), 0);
    for (const [x, y, r] of [[6.5, 8, 1.5], [13.5, 8, 1.5], [10, 6.8, 1.3]]) S.add(sphere([x, y, 3], r, 'pw_lime'), 0.4); } }, // round 128: green flames over the crown
  // The Radiant: a gold orb that is a small sun, its rays all round.
  radiant: { glow: 'gold', holes: [[8, 13], [12, 13], [10, 16]], body: (S) => { S.add(sphere([10, 14, 2], 5, 'pw_gold'), 0); for (let k = 0; k < 10; k++) { const t = k / 10 * Math.PI * 2; S.add(capsule([10, 14, 3], [10 + Math.cos(t) * 8.5, 14 + Math.sin(t) * 7, 3], 0.8, 0.3, 'pw_sun'), 0.3); }
    S.add(capsule([10, 9, 2], [10, 4.5, 2], 1, 0.8, 'pw_gold'), 0.5); S.add(torus([10, 2.6, 2], 1.6, 0.55, 0, 'pw_gold'), 0); } },
  // The Divine: a white bowl through a great gold ring set with teal stones.
  divine: { glow: 'teal', holes: [[7.5, 15], [10, 14], [12.5, 15]], body: (S) => { S.add(sphere([10, 14, 2], 5.4, 'pw_white'), 0); S.add(ellipsoid([10, 9.5, 2], [4, 2.2, 3.6], 'pw_white'), 1); S.add(torus([10, 13, 2], 7.4, 0.8, 0, 'pw_gold'), 0);
    for (const [x, y] of [[2.6, 13], [17.4, 13], [10, 5.6]]) S.add(sphere([x, y, 3], 1.2, 'pw_teal'), 0); S.add(torus([10, 2.4, 2], 1.6, 0.55, 0, 'pw_gold'), 0); } },
  // Demonic: a charred bowl with molten cracks and two curled horns.
  demonic: { glow: 'ember', holes: [[7, 14], [10, 15], [13, 14], [10, 12]], body: (S) => { S.add(sphere([10, 14, 2], 5.8, 'pw_char'), 0); S.add(ellipsoid([10, 9, 2], [4.4, 2.4, 4], 'pw_char'), 1.2);
    S.paint({ f: (x, y) => Math.abs(y - 15 - Math.sin(x * 1.3) * 1.2) - 0.45, mat: 'pw_ember' });
    for (const s of [-1, 1]) { S.add(capsule([10 + s * 3, 9, 2], [10 + s * 7, 6, 2], 1.1, 0.8, 'pw_horn'), 0.3); S.add(capsule([10 + s * 7, 6, 2], [10 + s * 7.5, 9, 2], 0.8, 0.3, 'pw_horn'), 0.3); }
    S.add(capsule([10, 7, 2], [10, 4.5, 2], 1, 0.8, 'pw_char'), 0.5); S.add(torus([10, 2.6, 2], 1.6, 0.55, 0, 'iron'), 0); } },
};
function pthurible(skin, i) {
  const P = PTHUR[skin], S = new Scene(); P.body(S);
  const f = render(S, 20, 22, PM, { contrast: 1.3 });
  P.holes.forEach(([x, y], k) => dot(f, x, y, `${P.glow}${(k + i) % 2 ? 0 : 2}`)); // 2x2 dots, so the light survives the chunky grid
  return f;
}
// Holy water: a round glass flask with a cork.
function flask(mat = 'holy') {
  const S = new Scene();
  S.add(sphere([8, 11, 2], 5, mat), 0);
  S.add(capsule([8, 6.5, 2], [8, 3.5, 2], 1.8, 1.6, mat), 1);
  S.add(capsule([8, 3.2, 2.2], [8, 1.4, 2.2], 1.7, 1.7, 'wood'), 0);
  S.paint({ f: (x, y) => Math.abs(y - 5.6) - 0.5, mat: 'gold' });
  const f = render(S, 16, 17, MATS, { contrast: 1.4, rich: IRICH });
  put(f, 6, 9, 'white'); put(f, 6, 10, `${mat}0`); put(f, 7, 8, `${mat}0`);
  return f;
}
// Chain links: one face-on, one edge-on, so a run of links alternates.
function link(i) {
  const S = new Scene();
  if (i === 0) S.add(torus([5, 3.5, 2], 2.6, 0.95, Math.PI / 2, 'iron'), 0);
  else S.add(capsule([1.8, 3.5, 2], [8.2, 3.5, 2], 1.05, 1.05, 'iron'), 0);
  return render(S, 10, 7, MATS, { contrast: 1.4 });
}
// The chain's hook, pointing right.
function hook() {
  const S = new Scene();
  S.add(torus([5, 7, 2], 1.6, 0.7, Math.PI / 2, 'iron'), 0);
  S.add(capsule([6.5, 7, 2], [11, 7, 2], 1.2, 1.1, 'iron'), 0.6);
  S.add(capsule([11, 7, 2], [14, 3.5, 2], 1.1, 0.4, 'iron'), 0.8);
  S.add(capsule([11, 7, 2], [14, 10.5, 2], 1.1, 0.4, 'iron'), 0.8);
  const f = render(S, 16, 14, MATS, { contrast: 1.5, rich: IRICH });
  put(f, 14, 3, 'white');
  return f;
}
// Penance lash: a falling crimson scourge of light.
function scourge(i) {
  const W = 14, H = 32, f = frame(W, H);
  for (let y = 0; y < H; y++) {
    const x = 7 + Math.round(Math.sin(y * 0.55 + i * 1.6) * 2.2), w = y > H - 6 ? 1 : 2;
    for (let dx = -w; dx <= w; dx++) put(f, x + dx, y, Math.abs(dx) === w ? 'blood2' : Math.abs(dx) === w - 1 ? 'crimson1' : 'crimson0');
    if (y % 3 === 0) put(f, x, y, 'white');
  }
  return A(f, 7, 31);
}

// -------------------------------------------- big moments (round 64) ---
// Hand-built pixel sheets for the largest moments, drawn on whole pixels
// (no dithering) and kept off the near-white top of each ramp.
// A Reckoning's sigil on the floor: rings open out, spokes and four runes
// turn, a star flares at the centre, then it all thins and fades. 12 frames,
// seen in perspective (squashed to 0.55).
const SIGIL_RAMP = { enlightened: 'violet', void: 'rose', psychedelic: 'rose', dread: 'flame', radiant: 'gold', divine: 'teal', demonic: 'ember', gold: 'gold', font: 'holy', nails: 'gold', stride: 'ember', confessor: 'violet', choir: 'crimson', reliquary: 'violet', iron: 'iron', road: 'sand', alms: 'moss', gaol: 'blood', bell: 'teal', glass: 'holy', psalter: 'crimson', lantern: 'ember', thorn: 'rot' };
function sigil(i, set) {
  const W = 112, H = 64, f = frame(W, H), cx = W / 2, cy = H / 2, n = 12, t = i / (n - 1), R = SIGIL_RAMP[set] || 'gold';
  const sq = 0.55, ease = 1 - (1 - Math.min(1, t * 1.8)) ** 3, fade = t < 0.6 ? 0 : (t - 0.6) / 0.4;
  const col = (k) => `${R}${Math.min(4, Math.max(1, Math.round(1 + k + fade * 2)))}`;
  const dot = (x, y, c) => { if (y * 0 === 0) put(f, x, y, c); };
  const ring = (r, c, dash = 0, rot = 0) => { const m = Math.max(16, Math.floor(r * 3)); for (let k = 0; k < m; k++) { if (dash && Math.floor(k / dash) % 2) continue; const a = k / m * Math.PI * 2 + rot; dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq, c); } };
  const r1 = 10 + ease * 42, r2 = r1 * 0.72, r3 = r1 * 0.42, spin = t * 1.2;
  if (fade < 0.95) { ring(r1, col(0)); ring(r1 - 1, col(1)); }
  if (fade < 0.8) ring(r2, col(1), 3, spin);
  if (fade < 0.6) ring(r3, col(0), 2, -spin * 1.5);
  // Spokes between the inner and outer rings.
  if (fade < 0.7) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + spin; for (let r = r3 + 2; r < r2; r += 1) dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq, col(k % 2 ? 2 : 1)); }
  // Four runes on the outer ring: small diamonds.
  if (fade < 0.85) for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 - spin * 0.6 + Math.PI / 4, x = cx + Math.cos(a) * r1, y = cy + Math.sin(a) * r1 * sq; for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2], [0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) dot(x + dx, y + dy, col(dx === 0 && dy === 0 ? 0 : 1)); }
  // The central star, early on.
  if (t < 0.45) { const L = 14 * (1 - t / 0.45); for (let d = -L; d <= L; d++) { dot(cx + d, cy, col(Math.abs(d) < L * 0.4 ? 0 : 2)); dot(cx, cy + d * sq, col(Math.abs(d) < L * 0.4 ? 0 : 2)); } }
  return A(f, Math.round(cx), Math.round(cy));
}
// A Warden's fall: a column of gold drops onto it, bursts in rays along the
// floor and sends sparks up, then narrows away. 12 frames, anchored at the foot.
function wardenFall(i) {
  const W = 96, H = 176, f = frame(W, H), cx = W / 2, base = H - 18, n = 12, t = i / (n - 1);
  const w = t < 0.25 ? 3 + t / 0.25 * 9 : 12 * (1 - (t - 0.25) / 0.75) + 1, top = t < 0.15 ? base - (base) * (t / 0.15) : 0;
  for (let y = Math.round(top); y < base; y++) for (let x = -Math.round(w); x <= Math.round(w); x++) { const u = Math.abs(x) / Math.max(1, w); put(f, cx + x, y, u < 0.3 ? 'gold1' : u < 0.7 ? 'gold2' : 'gold3'); }
  // Rays along the floor.
  if (t > 0.12 && t < 0.8) { const L = 40 * Math.sin(Math.min(1, (t - 0.12) / 0.5) * Math.PI); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; for (let d = 4; d < L * (k % 2 ? 0.6 : 1); d++) put(f, cx + Math.cos(a) * d, base + Math.sin(a) * d * 0.5, d < L * 0.4 ? 'gold1' : 'gold3'); } }
  // A ring widening on the floor.
  if (t > 0.2) { const r = 8 + (t - 0.2) * 48; for (let k = 0; k < 80; k++) { const a = k / 80 * Math.PI * 2; put(f, cx + Math.cos(a) * r, base + Math.sin(a) * r * 0.5, t > 0.7 ? 'gold4' : 'gold2'); } }
  // Sparks rising on fixed paths.
  for (let k = 0; k < 9; k++) { const sx = cx + Math.sin(k * 2.3) * 22, sy = base - (t - k * 0.04) * 150 - 6; if (t > k * 0.04 + 0.1 && sy > 4) { put(f, sx + Math.sin(t * 9 + k) * 2, sy, k % 3 ? 'ember1' : 'gold1'); put(f, sx + Math.sin(t * 9 + k) * 2, sy + 1, 'ember2'); } }
  return A(f, cx, base);
}

// ------------------------------------------------------------ item icons ---
// 24x24, three-quarter view, outlined, lit from the top-left.
// Round 82: icons shade like the models (soft cast shadows, creases); gentle numbers, they are small.
const IRICH = process.env.NORICH ? false : { melt: 1.1, meltAdd: 0.1, detail: 0.5, fall: 0.06, reach: 8, shadow: 0.36 };
function icon(fn, size = 24) { const S = new Scene(); fn(S); return render(S, size, size, MATS, { contrast: 1.35, rich: IRICH }); }
// Slot icons: a body (the sculpt) and an optional post pass (hand-placed pixels).
const BODY = {
  // The crossbow, aimed up-right: wood stock, gilt prod, iron nail.
  bow: (S) => {
    S.add(capsule([4.5, 19.5, 2], [17.5, 6.5, 2], 1.7, 1.4, 'wood'), 0);
    S.add(capsule([4, 20, 2], [6.5, 21.5, 2], 2.2, 2.2, 'wood'), 1);
    S.add(capsule([17.5, 6.5, 2.5], [11.5, 3, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([17.5, 6.5, 2.5], [21, 12.5, 2.5], 1.4, 0.9, 'gold'), 0.8);
    S.add(capsule([9, 15, 3.6], [20, 4, 3.6], 0.6, 0.6, 'iron'), 0);
  },
  // The Vesper's arms (round 118; the key stays 'mace'): two daggers crossed, points up.
  mace: (S) => {
    for (const k of [1, -1]) {
      const X = (x) => (k > 0 ? x : 24 - x);
      S.add(sphere([X(3.6), 21.4, 2], 1.5, 'gold'), 0.3);                               // pommel
      S.add(capsule([X(4.4), 20.6, 2], [X(7.4), 17.6, 2], 1.2, 1.2, 'wood'), 0.3);       // grip
      S.add(capsule([X(6.2), 15.2, 2.6], [X(10.2), 19.2, 2.6], 1, 1, 'gold'), 0.3);     // guard
      S.add(capsule([X(8.6), 16.4, 2 + k * 0.6], [X(19.6), 5.4, 2 + k * 0.6], 1.9, 0.45, 'iron'), 0.2); // blade
    }
  },
  // His satchel of nails: a leather bag, a gilt clasp on the flap, nail heads at the top.
  satchel: (S) => {
    S.add(capsule([13, 8, 2], [17, 2.5, 2], 0.9, 0.9, 'iron'), 0); // one nail poking out
    S.add(ellipsoid([12, 16.5, 3], [7.5, 6, 4], 'leather'), 0); // the pouch
    S.add(capsule([9.5, 9.5, 3], [14.5, 9.5, 3], 1.6, 1.6, 'leather'), 1); // the gathered neck
    S.add(box([12, 11, 4.5], [4.5, 0.8, 1], 0.4, 'gold'), 0); // drawstring
    S.add(capsule([12, 11.5, 4.5], [9, 15, 4.5], 0.6, 0.5, 'gold'), 0);
    S.paint({ f: (x, y) => Math.abs(y - 18) - 0.7, mat: 'crimson' }); // a stitched band
  },
  // The quiver: a leather case, gilt bands, nail heads showing.
  quiver: (S) => {
    S.add(rotZ(capsule([12, 8, 2], [12, 20, 2], 3.6, 3.2, 'leather'), [12, 14], 0.35), 0);
    S.paint({ f: (x, y) => Math.abs(y - 10.5 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 18 + (x - 12) * 0.35) - 0.7, mat: 'gold' });
    for (const dx of [-1.8, 0.4, 2.4]) S.add(capsule([12.5 + dx, 6, 2.5], [14.2 + dx, 1.8, 2.5], 0.8, 0.8, 'iron'), 0.3);
  },
  hood: (S) => {
    S.add(ellipsoid([12, 11, 2], [7, 7.5, 6], 'crimson'), 0);
    S.add(capsule([9, 6, 0], [5, 2.5, -2], 3, 1, 'crimson'), 2);
    S.add(ellipsoid([12, 19, 2], [8.5, 3, 5], 'crimson'), 2);
    S.sub(ellipsoid([14.5, 12.5, 7], [3.8, 4.6, 5], 'void'), 0.6);
    S.paint({ f: (x, y, z) => Math.abs(y - 20.5) - 0.7, mat: 'gold' });
  },
  // A cloak hung from its shoulders: a wide drape with deep folds and a gilt clasp.
  mantle: (S) => {
    S.add(ellipsoid([12, 7, 2], [7.5, 3, 4], 'violet'), 0);
    for (let k = -2; k <= 2; k++) S.add(capsule([12 + k * 2.6, 7, 2 + Math.abs(k) * -0.4], [12 + k * 3.6, 20.5, 2.5 - Math.abs(k) * 0.6], 2, 2.3, 'violet'), 1.4);
    S.sub(ellipsoid([12, 5.4, 4], [2.4, 1.6, 4]), 0.5);
    S.paint({ f: (x, y) => Math.abs(y - 21) - 0.9, mat: 'gold' });
    S.add(sphere([12, 8.4, 5.6], 1.5, 'gold'), 0);
  },
  gloves: (S) => {
    S.add(ellipsoid([11, 13, 2], [5, 5.5, 3], 'leather'), 0);
    for (let k = 0; k < 4; k++) S.add(capsule([8 + k * 2.2, 9, 2.5], [8.4 + k * 2.4, 3.5 + Math.abs(k - 1.5), 2.5], 1.1, 1, 'leather'), 0.8);
    S.add(capsule([15.5, 12, 2.5], [19, 9, 2.5], 1.3, 1.1, 'leather'), 0.8);
    S.add(box([11, 19.5, 2], [5.2, 2, 3], 0.8, 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 18.4) - 0.6, mat: 'gold' });
  },
  girdle: (S) => {
    S.add(torus([12, 12, 2], 8, 1.7, 1.15, 'leather'), 0);
    S.add(box([12, 15, 4.5], [3, 2.6, 1], 0.6, 'gold'), 0);
    S.sub(box([12, 15, 6], [1.5, 1.1, 1.5], 0.3), 0);
    S.add(capsule([14, 16.5, 4], [16, 22, 3], 1, 0.8, 'leather'), 0.5);
  },
  greaves: (S) => {
    S.add(capsule([10, 4, 2], [10, 15, 2], 3.6, 3, 'iron'), 0);
    S.add(ellipsoid([12, 18.5, 2], [5.5, 2.6, 3.4], 'iron'), 1.5);
    S.add(ellipsoid([10, 10, 3.2], [3.4, 2.4, 2], 'iron'), 0.8);
    S.paint({ f: (x, y) => Math.abs(y - 5) - 0.7, mat: 'gold' });
    S.paint({ f: (x, y) => Math.abs(y - 15.6) - 0.6, mat: 'gold' });
  },
  rosary: (S) => {
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; S.add(sphere([12 + Math.cos(a) * 6.5, 9 + Math.sin(a) * 5, 2], 1.5, k % 4 === 0 ? 'gold' : 'blood'), 0); }
    S.add(capsule([12, 14.5, 2], [12, 16.5, 2], 0.7, 0.7, 'gold'), 0);
    S.add(box([12, 19.5, 2.5], [0.9, 3.4, 0.8], 0.3, 'gold'), 0);
    S.add(box([12, 18.5, 2.5], [2.6, 0.9, 0.8], 0.3, 'gold'), 0);
  },
  seal: (S) => {
    S.add(torus([12, 13, 2], 5.8, 1.6, 1.05, 'gold'), 0);
    S.add(ellipsoid([12, 8, 3], [3.8, 2.6, 3], 'gold'), 0.8);
    S.add(ellipsoid([12, 7.4, 5], [2.4, 1.6, 1.4], 'blood'), 0);
  },
  // The Anchoress's arms (round 71). The reliquary: a gilt house-shaped box with a violet window and a cross.
  reliquary: (S) => {
    S.add(box([12, 14, 2], [6.5, 5.5, 4], 0.8, 'gold'), 0);
    S.add(rotZ(box([12, 7, 2], [5.4, 2.6, 3.6], 0.6, 'gold'), [12, 7], 0), 0.8);
    S.add(box([12, 14.5, 4.6], [3.6, 3.2, 1], 0.6, 'shardGlow'), 0);
    S.add(box([12, 2.6, 2], [0.8, 2.4, 0.8], 0.2, 'gold'), 0); S.add(box([12, 2.4, 2], [2, 0.8, 0.8], 0.2, 'gold'), 0);
    for (const x of [6.5, 17.5]) S.add(sphere([x, 20.5, 2], 1.4, 'gold'), 0.3);
  },
  // The phylactery: a small glass vial in a silver cage, shards inside.
  phylactery: (S) => {
    S.add(capsule([12, 6, 2], [12, 19, 2], 4.4, 4.4, 'shardGlow'), 0);
    for (const y of [6, 12.5, 19]) S.add(torus([12, y, 2], 4.6, 0.8, 1.35, 'silver'), 0);
    S.add(capsule([12, 1.5, 2], [12, 4, 2], 2.4, 2.4, 'silver'), 0.4);
    for (const [x, y] of [[10.5, 10], [13.5, 15]]) S.add(ellipsoid([x, y, 5], [0.9, 2, 0.9], 'cloth'), 0);
  },
  relic: (S) => {
    S.add(bumpy(capsule([8, 16, 2], [16, 8, 2], 2.4, 2, 'bone'), 0.4, 0.6), 0);
    S.add(sphere([6.5, 17.5, 2], 3, 'bone'), 1.2);
    S.add(sphere([17.5, 6.5, 2], 3, 'bone'), 1.2);
    S.add(box([12, 12, 2.5], [3.2, 1.2, 2.6], 0.5, 'gold'), 0);
  },
};
const POST = {
  bow: (f) => { pline(f, 11.5, 3, 13, 10.5, 'bone1'); pline(f, 21, 12.5, 13, 10.5, 'bone1'); },
  seal: (f) => { dot(f, 11, 6, 'white'); },
};
const ICONS = Object.fromEntries(Object.keys(BODY).map((k) => [k, () => { const f = icon(BODY[k]); if (POST[k]) POST[k](f); return f; }]));

// Hallowed pieces: each keeps its slot's shape but swaps materials (remap)
// and adds its own mark, so the thirty read apart at a glance. Order
// follows LEGENDS in index.html (the loot sheet's 'legend' frames).
function remapScene(S, map) {
  const m = (p) => (p && p.mat && map[p.mat] ? { ...p, mat: map[p.mat] } : p);
  return { add: (p, k, op) => S.add(m(p), k, op), sub: (p, k) => S.sub(p, k), paint: (p) => S.paint(m(p)) };
}
function legendIcon(slot, map, extra, post) {
  const f = icon((S) => { BODY[slot](remapScene(S, map)); if (extra) extra(S); });
  if (POST[slot] && !map.noPost) POST[slot](f);
  if (post) post(f);
  return f;
}
const flames = (S, pts, r = 1.4) => { for (const [x, y] of pts) S.add(ellipsoid([x, y, 4], [r, r * 1.5, r], 'ember'), 0.6); };
const LEGEND_ICONS = [
  // 0 Hood of Ash-Choir: an ash-grey hood, embers inside.
  () => legendIcon('hood', { crimson: 'stone', gold: 'ink' }, (S) => S.add(sphere([14.5, 13, 3], 1.6, 'ember'), 0)),
  // 1 Mantle of the Ninth Wound: a crimson mantle split by a bleeding wound.
  () => legendIcon('mantle', { violet: 'crimson' }, (S) => S.add(rotZ(capsule([8, 12, 4.5], [16, 17, 4.5], 0.9, 0.9, 'blood'), [12, 14], 0), 0)),
  // 2 Hands That Counted Coins: gilt gloves over a stack of coins.
  () => legendIcon('gloves', { leather: 'gold', iron: 'wood' }, (S) => { for (let k = 0; k < 3; k++) S.add(ellipsoid([19, 20 - k * 2, 3], [3, 1, 2.6], 'gold'), 0.3); }),
  // 3 Girdle of the Unfed: a cord of bone, ribs hanging from it.
  () => legendIcon('girdle', { leather: 'bone', gold: 'iron' }, (S) => { for (const x of [8, 12, 16]) S.add(capsule([x, 18, 3], [x - 1, 22, 3], 0.8, 0.6, 'bone'), 0.3); }),
  // 4 The Long Descent: tall slate greaves.
  () => legendIcon('greaves', { iron: 'slate', gold: 'iron' }, (S) => S.add(capsule([10, 1.5, 2], [10, 5, 2], 3, 3, 'slate'), 1)),
  // 5 Locket of Unsaid Words: a silver chain, a violet heart locket.
  () => legendIcon('rosary', { blood: 'iron', gold: 'iron' }, (S) => S.add(ellipsoid([12, 19.5, 3.5], [3.4, 3, 2], 'violet'), 0)),
  // 6 Seal of the First Tithe: a ring crowned with a great coin.
  () => legendIcon('seal', { blood: 'gold' }, (S) => S.add(ellipsoid([12, 6.5, 5], [4.6, 4.6, 1.2], 'gold'), 0), (f) => { pline(f, 12, 4, 12, 9, 'gold3'); }),
  // 7 The Weeping Knuckle: a bone that weeps blue tears.
  () => legendIcon('relic', { gold: 'holy' }, (S) => { for (const [x, y] of [[9, 20], [14, 21], [19, 13]]) S.add(ellipsoid([x, y, 3], [1.2, 1.8, 1.2], 'holy'), 0); }),
  // 8 The Silent Arbalest: a black crossbow with a violet nail.
  () => legendIcon('bow', { wood: 'ink', gold: 'slate', iron: 'violet', noPost: true }, null, (f) => { pline(f, 11.5, 3, 13, 10.5, 'violet2'); pline(f, 21, 12.5, 13, 10.5, 'violet2'); }),
  // 9 The Bottomless Case: a quiver whose mouth is a violet void.
  () => legendIcon('quiver', { leather: 'violet', iron: 'void' }, (S) => S.add(ellipsoid([14, 5, 4], [3.6, 2, 1], 'eyeHoly'), 0)),
  // 10 The Lesser Vow: a plain iron band with a green set-stone.
  () => legendIcon('seal', { gold: 'iron', blood: 'flame' }),
  // 11 The Crown of Thorns: a ring of thorny briar.
  () => icon((S) => {
    S.add(torus([12, 13, 2], 7, 1.8, 1.25, 'shroud'), 0);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; S.add(capsule([12 + Math.cos(a) * 7, 13 + Math.sin(a) * 4, 2], [12 + Math.cos(a) * 9.5, 13 + Math.sin(a) * 4 - 3, 2], 0.9, 0.3, 'wood'), 0.3); }
    for (const [x, y] of [[6, 16], [17, 17]]) S.add(sphere([x, y, 4], 1.2, 'blood'), 0);
  }),
  // 12 Veil of the Still Water: a blue veil with a single drop.
  () => legendIcon('hood', { crimson: 'holy', gold: 'iron' }, (S) => S.add(ellipsoid([9, 21.5, 4], [1.4, 2, 1.4], 'holy'), 0)),
  // 13 Mantle of Falling Ash: a soot mantle, embers at its hem.
  () => legendIcon('mantle', { violet: 'ink', gold: 'ember' }, (S) => flames(S, [[7, 20], [12, 21], [17, 20]], 1.1)),
  // 14 The Pall of Seven Wards: a white pall with a gilt cross.
  () => legendIcon('mantle', { violet: 'cloth' }, (S) => { S.add(box([12, 14, 5], [0.9, 4, 0.6], 0.3, 'gold'), 0); S.add(box([12, 12.5, 5], [3, 0.9, 0.6], 0.3, 'gold'), 0); }),
  // 15 Hands of the Jailer: an iron gauntlet hung with chain.
  () => legendIcon('gloves', { leather: 'iron', gold: 'slate' }, (S) => { for (let k = 0; k < 3; k++) S.add(torus([19, 14 + k * 3, 3], 1.4, 0.6, k % 2 ? 0 : Math.PI / 2, 'iron'), 0); }),
  // 16 The Stormwright's Gloves: nails bristling from the fingers.
  () => legendIcon('gloves', { leather: 'wood' }, (S) => { for (let k = 0; k < 4; k++) S.add(capsule([8.4 + k * 2.4, 3.5 + Math.abs(k - 1.5), 3], [8.4 + k * 3, 0.5, 3], 0.7, 0.4, 'iron'), 0); }),
  // 17 Cincture of Embers: a belt of glowing coals.
  () => legendIcon('girdle', { leather: 'emberLit', gold: 'iron' }, (S) => flames(S, [[6, 9], [18, 9], [12, 6]], 1.2)),
  // 18 The Tithe-Belt: a coin purse hung from the belt.
  () => legendIcon('girdle', { leather: 'wood' }, (S) => { S.add(ellipsoid([16, 20, 3], [3.4, 3, 2.6], 'leather'), 0); S.add(ellipsoid([16, 17, 4.5], [2, 1, 1], 'gold'), 0); }),
  // 19 Sabatons of the Ember Step: iron greaves with fire at the heel.
  () => legendIcon('greaves', { gold: 'ember' }, (S) => flames(S, [[6, 19], [17.5, 18]], 1.6)),
  // 20 The Pilgrim's Sandals: a wooden sole and leather straps.
  () => icon((S) => {
    S.add(ellipsoid([12, 19, 2], [7.5, 2.2, 3.6], 'wood'), 0);
    for (const y of [11, 15]) S.add(torus([12, y, 2], 4.6, 0.9, 1.2, 'leather'), 0);
    S.add(capsule([12, 6, 3], [12, 18, 3], 0.9, 0.9, 'leather'), 0);
    S.add(ellipsoid([12, 5, 3.5], [2.4, 2, 1.2], 'bone'), 0);
  }),
  // 21 Locket of the Last Hymn: a gold chain, a white flame-lit oval.
  () => legendIcon('rosary', { blood: 'gold' }, (S) => S.add(ellipsoid([12, 19.5, 3.5], [2.8, 3.4, 1.6], 'eyeHoly'), 0)),
  // 22 The Censer-Bearer's Chain: a little thurible on its chain.
  () => legendIcon('rosary', { blood: 'iron' }, (S) => { S.add(sphere([12, 19.5, 3], 3.4, 'gold'), 0); S.add(ellipsoid([12, 18.5, 5.5], [2, 1.2, 1], 'ember'), 0); }),
  // 23 Seal of Judgement: a ring with a pillar of light for a stone.
  () => legendIcon('seal', { blood: 'eyeHoly' }, (S) => S.add(box([12, 4, 4], [1.4, 3.6, 1], 0.4, 'holy'), 0)),
  // 24 The Gambler's Knucklebone: a bone die, pips and all.
  () => { const f = icon((S) => { S.add(box([12, 12, 2], [6.5, 6.5, 6.5], 1.6, 'bone'), 0); }, 24); for (const [x, y] of [[8, 8], [12, 12], [16, 16], [16, 8], [8, 16]]) dot(f, x, y, x === 12 ? 'blood0' : 'ink1'); return f; },
  // 25 The Saint's Molar: a molar with a gilt halo.
  () => icon((S) => {
    S.add(ellipsoid([12, 12, 2], [6, 5, 4], 'bone'), 0);
    for (const x of [8.5, 15.5]) S.add(capsule([x, 15, 2], [x + (x < 12 ? -1 : 1), 21, 2], 2, 1.2, 'bone'), 1.2);
    S.add(torus([12, 4.5, 2], 4.5, 1, 1.25, 'halo'), 0);
  }),
  // 26 The Longway Arbalest: pale wood, a long gilt bolt.
  () => legendIcon('bow', { wood: 'sand', iron: 'gold' }, (S) => S.add(capsule([4, 22, 3.6], [22, 2, 3.6], 0.6, 0.6, 'gold'), 0)),
  // 27 The Penitent's Prod: a heavy crimson crossbow, spiked.
  () => legendIcon('bow', { wood: 'crimsonDark', gold: 'iron' }, (S) => { for (const [x, y] of [[9, 13], [13, 9]]) S.add(capsule([x, y, 2], [x - 2, y - 2, 2], 0.9, 0.3, 'iron'), 0); }),
  // 28 The Brazier Quiver: a quiver burning at the mouth.
  () => legendIcon('quiver', { leather: 'iron', iron: 'ember' }, (S) => flames(S, [[13, 3], [16, 4], [11, 5]], 1.4)),
  // 29 The Quiver of No Mercy: black leather bound in chain.
  () => legendIcon('quiver', { leather: 'ink', gold: 'iron', iron: 'blood' }, (S) => { for (let k = 0; k < 3; k++) S.add(torus([9 + k * 3, 14 + k * 1.2, 4], 1.3, 0.6, k % 2 ? 0 : Math.PI / 2, 'iron'), 0); }),
  // The Vesper's (round 51; redrawn for his rites in round 121), in LEGENDS order after the thirty.
  // The Venom-Stained Gloves: dark gloves, green venom on the fingers.
  () => legendIcon('gloves', { leather: 'slateDark', iron: 'leather' }, (S) => { for (const [x, y] of [[17, 7], [20, 10], [15, 11]]) S.add(ellipsoid([x, y, 4.5], [1.3, 1.8, 1], 'vial'), 0); }),
  // The Whirler's Sash: a teal mantle with a knife tucked in it.
  () => legendIcon('mantle', { violet: 'tealRobe', crimson: 'tealRobe', gold: 'bronze' }, (S) => { S.add(capsule([8, 20, 5.5], [17, 10, 5.5], 1.2, 0.4, 'silver'), 0.2); S.add(capsule([6.5, 21.5, 5.5], [8.5, 19.5, 5.5], 1.1, 1.1, 'leather'), 0.2); }),
  // Boots of the Shadow Rush: black greaves trailing shadow.
  () => legendIcon('greaves', { iron: 'inkRobe', gold: 'slate' }, (S) => { for (const [x, y] of [[5, 19], [3, 21]]) S.add(ellipsoid([x, y, 2], [2, 1, 1], 'slateDark'), 0.6); }),
  // The Knife-Maker's Beads: a rosary hung with three small knives.
  () => legendIcon('rosary', { blood: 'iron', gold: 'slate' }, (S) => { for (const x of [9, 12, 15]) { S.add(capsule([x, 17.5, 3.5], [x, 19.5, 3.5], 0.6, 0.6, 'leather'), 0.2); S.add(capsule([x, 19.8, 3.5], [x, 24, 3.5], 0.9, 0.3, 'silver'), 0.2); } }),
  // Seal of the Shadow Cloak: a dark ring with a violet stone.
  () => legendIcon('seal', { gold: 'slate', blood: 'violet' }),
  // The Serpent's Cord: a green cord dripping venom.
  () => legendIcon('girdle', { leather: 'mossRobe', gold: 'iron' }, (S) => { for (const [x, y] of [[8, 20], [13, 22], [18, 20]]) S.add(ellipsoid([x, y, 3], [1.1, 1.7, 1.1], 'vial'), 0); }),
  // The Seventh Falling Blade: a relic with a dagger plunged in, point down.
  () => legendIcon('relic', { gold: 'iron' }, (S) => { S.add(capsule([16, 3, 4.5], [16, 7, 4.5], 1, 1, 'leather'), 0.2); S.add(capsule([13.5, 7.5, 4.5], [18.5, 7.5, 4.5], 0.8, 0.8, 'gold'), 0.2); S.add(capsule([16, 8, 4.5], [16, 16, 4.5], 1.4, 0.4, 'silver'), 0.2); }),
  // The Anchoress's (round 71), after the Mendicant's.
  // The Crown of Splinters: a violet hood ringed by floating shards.
  () => legendIcon('hood', { crimson: 'violetDark', gold: 'silver' }, (S) => { for (const [x, y] of [[5, 6], [12, 2.5], [19, 6]]) S.add(ellipsoid([x, y, 4], [1.2, 2.4, 1], 'shardGlow'), 0); }),
  // Mantle of the Walled Cell: a grey stone-coloured mantle with a barred window.
  () => legendIcon('mantle', { violet: 'stone', gold: 'iron' }, (S) => { S.add(box([12, 13, 5], [3.4, 3.4, 0.6], 0.3, 'shardGlow'), 0); for (const x of [10.6, 13.4]) S.add(box([x, 13, 5.8], [0.5, 3.4, 0.4], 0.1, 'iron'), 0); }),
  // Seal of the Anchorhold: a silver ring set with a violet shard.
  () => legendIcon('seal', { gold: 'silver', blood: 'shardGlow' }, (S) => S.add(ellipsoid([12, 5, 5], [1.6, 3.4, 1.4], 'shardGlow'), 0)),
  // The Splintered Finger: a finger-bone relic sprouting shards.
  () => legendIcon('relic', { gold: 'violet' }, (S) => { for (const [x, y] of [[9, 9], [17, 15]]) S.add(rotZ(ellipsoid([x, y, 4], [1, 2.6, 1], 'shardGlow'), [x, y], 0.6), 0); }),
  // The Anchorhold Reliquary: a great dark reliquary, its window blazing.
  () => legendIcon('reliquary', { gold: 'iron', shardGlow: 'eyeHoly' }, (S) => S.add(sphere([12, 14.5, 5.5], 1.4, 'cloth'), 0)),
  // The Votive Phylactery: a gilt-caged vial of candles' light.
  () => legendIcon('phylactery', { silver: 'gold', shardGlow: 'ember' }),
  // Round 124, fifteen more (LEGENDS order). The Feasting Cord: a crimson belt hung with red drops.
  () => legendIcon('girdle', { leather: 'crimsonDark', gold: 'gold' }, (S) => { for (const [x, y] of [[8, 20], [12, 22], [16, 20]]) S.add(ellipsoid([x, y, 3], [1.2, 1.8, 1.1], 'blood'), 0); }),
  // The Still Cloak: a pale blue mantle with a ring of light at its clasp.
  () => legendIcon('mantle', { violet: 'blueRobe', crimson: 'blueRobe', gold: 'silver' }, (S) => S.add(torus([12, 9, 5], 3.2, 0.9, Math.PI / 2, 'holy'), 0)),
  // Beads of Fervour: ember beads with a flame rising from the cross.
  () => legendIcon('rosary', { blood: 'ember', gold: 'gold' }, (S) => flames(S, [[12, 4], [10, 6], [14, 6]], 1.3)),
  // The Ricochet Arbalest: a dark crossbow with a gold zigzag across it.
  () => legendIcon('bow', { wood: 'slateDark', gold: 'iron' }, (S) => { const z = [[4, 6], [9, 11], [13, 5], [18, 11], [21, 6]]; for (let k = 0; k < 4; k++) S.add(capsule([...z[k], 4], [...z[k + 1], 4], 0.7, 0.7, 'gold'), 0); }),
  // The Quiver of the Long Hunt: a green quiver, its bolts fletched green.
  () => legendIcon('quiver', { leather: 'mossDark', gold: 'gold' }, (S) => { for (const dx of [-1.8, 0.4, 2.4]) S.add(sphere([13.8 + dx, 2.6, 3], 1.1, 'vial'), 0); }),
  // The Baptist's Hood: a blue hood with a drop of holy water.
  () => legendIcon('hood', { crimson: 'blueRobe', gold: 'silver' }, (S) => S.add(sphere([18, 18, 5], 2.2, 'holy'), 0)),
  // The Mantle of Answers: a cream mantle with nails flying out from it.
  () => legendIcon('mantle', { violet: 'cream', crimson: 'cream' }, (S) => { for (let k = 0; k < 4; k++) { const a = -0.4 + k * 0.6; S.add(capsule([12 + Math.cos(a) * 6, 6 + Math.sin(a) * 3, 5], [12 + Math.cos(a) * 10, 4 + Math.sin(a) * 4, 5], 0.6, 0.4, 'iron'), 0); } }),
  // The Third Hand: dark gloves and three small blades fanned above.
  () => legendIcon('gloves', { leather: 'inkRobe', iron: 'silver' }, (S) => { for (const a of [-0.5, 0, 0.5]) S.add(capsule([17, 12, 5], [17 + Math.sin(a) * 6, 12 - Math.cos(a) * 9, 5], 1, 0.3, 'silver'), 0); }),
  // Boots of the Long Leap: black greaves with speed lines behind.
  () => legendIcon('greaves', { iron: 'inkRobe', gold: 'crimson' }, (S) => { for (const y of [10, 14, 18]) S.add(capsule([1, y, 2], [5, y, 2], 0.6, 0.6, 'slate'), 0); }),
  // The Storm-Glass: a relic holding a little glass of whirling blades.
  () => legendIcon('relic', { gold: 'iron' }, (S) => { S.add(sphere([12, 12, 5], 3.6, 'holy'), 0); for (const a of [0, 2.1, 4.2]) S.add(capsule([12, 12, 7], [12 + Math.cos(a) * 3, 12 + Math.sin(a) * 3, 7], 0.6, 0.3, 'silver'), 0); }),
  // Beads of the Vesper Hour: crimson beads hung with a small dagger.
  () => legendIcon('rosary', { blood: 'crimson', gold: 'slate' }, (S) => { S.add(capsule([12, 16, 4], [12, 23, 4], 1, 0.3, 'silver'), 0); S.add(capsule([10, 16, 4], [14, 16, 4], 0.6, 0.6, 'gold'), 0); }),
  // The Echoing Hands: violet gloves with a shard leaving them.
  () => legendIcon('gloves', { leather: 'violetDark', iron: 'silver' }, (S) => { S.add(ellipsoid([19, 6, 5], [1.4, 3, 1.2], 'shardGlow'), 0); S.add(ellipsoid([14, 4, 5], [0.9, 2, 0.8], 'shardGlow'), 0); }),
  // The Glass Steps: glassy greaves with shards at the heel.
  () => legendIcon('greaves', { iron: 'glassRobe', gold: 'silver' }, (S) => { for (const [x, y] of [[5, 20], [8, 22]]) S.add(ellipsoid([x, y, 3], [1, 2.2, 0.9], 'shardGlow'), 0); }),
  // The Reliquary Girdle: a violet belt with a shard set in its buckle.
  () => legendIcon('girdle', { leather: 'violetDark', gold: 'silver' }, (S) => S.add(ellipsoid([12, 13, 5], [1.6, 2.8, 1.2], 'shardGlow'), 0)),
  // The Pulsing Heart: a silver relic round a glowing violet heart.
  () => legendIcon('relic', { gold: 'silver' }, (S) => { S.add(sphere([10.6, 11, 5], 2.4, 'shardGlow'), 0); S.add(sphere([13.4, 11, 5], 2.4, 'shardGlow'), 0); S.add(capsule([12, 15.5, 5], [12, 12, 5], 0.5, 2.4, 'shardGlow'), 0); }),
];

// Set pieces: every slot in a set's own colours (taken from its Saint skin)
// with the set's mark in the lower right. Frame = set * 10 + slot, sets in
// SET_ICONS order, slots in index.html's ICON_OF order.
const SLOT_ORDER = ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'];
const SET_LOOK = {
  // Odile's Habit: brown homespun, cream trim, a wooden cross.
  habit: { map: { crimson: 'shroud', violet: 'shroud', leather: 'shroud', iron: 'leather', gold: 'cream', blood: 'wood', wood: 'wood' },
    mark: (S) => { S.add(box([18.5, 18.5, 7], [1.2, 4.4, 1], 0.3, 'cream'), 0); S.add(box([18.5, 17, 7], [3.4, 1.2, 1], 0.3, 'cream'), 0); } },
  // The Hundred Nails: steel, gilt edges, a gold nail driven through.
  nails: { map: { crimson: 'steel', violet: 'steel', leather: 'slate', blood: 'iron', wood: 'slate', bone: 'steel' },
    mark: (S) => { S.add(capsule([14.5, 14.5, 7], [22, 22, 7], 1.2, 0.8, 'gold'), 0); S.add(ellipsoid([14.5, 14.5, 7.5], [2.6, 2.6, 1], 'gold'), 0.4); } },
  // The Penitent's Stride: cream and smouldering umber, a flame.
  stride: { map: { crimson: 'cream', violet: 'cream', leather: 'smoulder', iron: 'smoulder', blood: 'ember', wood: 'smoulder' },
    mark: (S) => { S.add(ellipsoid([18.5, 18.5, 7], [3.4, 4.6, 2], 'ember'), 0.6); S.add(ellipsoid([18.5, 20, 9], [1.8, 2.6, 1], 'emberLit'), 0.3); } },
  // The Drowned Font: deep blue and silver, a drop of holy water.
  font: { map: { crimson: 'blueRobe', violet: 'blueRobe', leather: 'blueDark', iron: 'silver', gold: 'silver', blood: 'vial', wood: 'blueDark', bone: 'silver' },
    mark: (S) => { S.add(sphere([18.5, 19.5, 7], 3.2, 'vial'), 0); S.add(capsule([18.5, 18, 7], [18.5, 13.5, 7], 2.2, 0.5, 'vial'), 1.2); } },
  // The Last Confessor: slate and cream, two links of chain.
  confessor: { map: { crimson: 'slateRobe', violet: 'slateRobe', leather: 'slateDark', gold: 'cream', blood: 'slateDark', wood: 'slateDark', bone: 'cream' },
    mark: (S) => { S.add(torus([16, 16.5, 7], 3, 1.1, Math.PI / 2, 'cream'), 0); S.add(torus([20.5, 20.5, 7], 2.8, 1.1, 0.25, 'cream'), 0.2); } },
  // The Burning Choir: white and crimson, gilt, a lit candle.
  choir: { map: { crimson: 'cloth', violet: 'cloth', leather: 'crimson', iron: 'gold', blood: 'crimson', wood: 'crimson', bone: 'wax' },
    mark: (S) => { S.add(capsule([18.5, 22.5, 7], [18.5, 16, 7], 2, 2, 'wax'), 0); },
    post: (f) => { dot(f, 18, 14, 'ember1'); dot(f, 18, 12, 'ember0'); dot(f, 20, 14, 'ember2'); } },
};
  // The Shattered Reliquary (round 71, the Anchoress's set): violet and gold, a violet shard.
SET_LOOK.reliquary = { map: { crimson: 'violetRobe', violet: 'violetRobe', leather: 'violetDark', iron: 'silver', blood: 'shardGlow', wood: 'violetDark', bone: 'silver' },
  mark: (S) => { S.add(rotZ(ellipsoid([18.5, 18.5, 7], [1.8, 4.2, 1.5], 'shardGlow'), [18.5, 18.5], 0.5), 0); S.add(sphere([16.4, 15.2, 7.5], 1.1, 'gold'), 0); },
  post: (f) => dot(f, 18, 16, 'white') };
// Round 72: the Mendicant's and the Anchoress's own sets (keep this order: index.html's SET_ICONS matches it).
const ring = (S, x, y, r, mat) => S.add(torus([x, y, 7], r, 1, Math.PI / 2, mat), 0);
Object.assign(SET_LOOK, {
  rags: { map: { crimson: 'flag', violet: 'flag', leather: 'stone', iron: 'stone', gold: 'wood', blood: 'wood', wood: 'wood', bone: 'flag' },
    mark: (S) => { S.add(box([18.5, 18.5, 7], [3.6, 3.6, 1], 0.5, 'leather'), 0); S.paint({ f: (x, y) => Math.abs(x - y) - 0.6, mat: 'wood' }); } },
  // Round 119: the Vesper's sets as an assassin's (ids kept): crossed blades, a dusk moon, a vial of venom, a hooked knife, a whirl.
  iron: { map: { crimson: 'inkRobe', violet: 'inkRobe', leather: 'slateDark', gold: 'silver', blood: 'slateDark', wood: 'slateDark', bone: 'steel' },
    mark: (S) => { for (const k of [1, -1]) S.add(capsule([18.5 - k * 3.4, 22, 7], [18.5 + k * 3.4, 15, 7], 1.1, 0.4, 'silver'), 0.2); S.add(box([18.5, 20.4, 7.5], [3.2, 0.7, 0.8], 0.2, 'leather'), 0.2); } },
  road: { map: { crimson: 'sandRobe', violet: 'sandRobe', leather: 'leather', iron: 'leather', gold: 'wood', blood: 'crimson', wood: 'leather', bone: 'cream' },
    mark: (S) => { S.add(sphere([18.5, 18.5, 7], 3.6, 'gold'), 0); S.sub(sphere([20.3, 17.4, 8], 3.2), 0.2); } },
  alms: { map: { crimson: 'mossRobe', violet: 'mossRobe', leather: 'mossDark', iron: 'leather', gold: 'leather', blood: 'mossDark', wood: 'wood', bone: 'cream' },
    mark: (S) => { S.add(ellipsoid([18.5, 19.6, 7], [2.6, 2.8, 2], 'vial'), 0.4); S.add(capsule([18.5, 16.6, 7], [18.5, 15, 7], 1, 1, 'wood'), 0.2); } },
  gaol: { map: { crimson: 'brickRobe', violet: 'brickRobe', leather: 'roofDark', gold: 'iron', blood: 'roofDark', wood: 'roofDark', bone: 'steel' },
    mark: (S) => { S.add(capsule([16.5, 22.5, 7], [19.5, 16, 7], 1, 0.6, 'steel'), 0.2); S.add(torus([20.8, 15.6, 7], 1.6, 0.6, 0.2, 'steel'), 0.2); S.add(capsule([15.5, 23.5, 7], [16.6, 21.6, 7], 1, 1, 'crimson'), 0.2); } },
  bell: { map: { crimson: 'tealRobe', violet: 'tealRobe', leather: 'tealDark', iron: 'bronze', gold: 'bronze', blood: 'bronze', wood: 'tealDark', bone: 'cream' },
    mark: (S) => { S.add(torus([18.5, 18.5, 7], 3.2, 0.9, 0.25, 'bronze'), 0); for (let k = 0; k < 3; k++) { const a = k * 2.1; S.add(capsule([18.5 + Math.cos(a) * 3.2, 18.5 + Math.sin(a) * 3.2, 7.5], [18.5 + Math.cos(a + 0.9) * 4.8, 18.5 + Math.sin(a + 0.9) * 4.8, 7.5], 0.8, 0.4, 'silver'), 0.2); } } },
  shroud: { map: { crimson: 'cream', violet: 'cream', leather: 'creamDark', iron: 'creamDark', gold: 'wood', blood: 'wood', wood: 'wood', bone: 'cream' },
    mark: (S) => { S.add(box([18.5, 18.5, 7], [1.1, 4.2, 1], 0.3, 'wood'), 0); S.add(box([18.5, 17, 7], [3, 1.1, 1], 0.3, 'wood'), 0); } },
  glass: { map: { crimson: 'glassRobe', violet: 'glassRobe', leather: 'blueDark', iron: 'silver', gold: 'silver', blood: 'glassGlow', wood: 'blueDark', bone: 'silver' },
    mark: (S) => { for (const [x, a] of [[16, -0.4], [19, 0], [22, 0.4]]) S.add(rotZ(ellipsoid([x, 18.5, 7], [1.1, 3.6, 1.1], 'glassGlow'), [x, 18.5], a), 0); } },
  psalter: { map: { crimson: 'crimson', violet: 'cream', leather: 'crimsonDark', iron: 'gold', blood: 'crimson', wood: 'crimsonDark', bone: 'cream' },
    mark: (S) => { S.add(box([18.5, 18.5, 7], [3.6, 4.4, 1.4], 0.4, 'crimson'), 0); S.add(box([18.5, 18.5, 8.4], [0.8, 4.4, 0.4], 0.1, 'gold'), 0); } },
  lantern: { map: { crimson: 'inkRobe', violet: 'inkRobe', leather: 'void', iron: 'bronze', gold: 'bronze', blood: 'ember', wood: 'inkRobe', bone: 'slateRobe' },
    mark: (S) => { S.add(box([18.5, 19.5, 7], [3, 3.6, 2], 0.4, 'bronze'), 0); S.add(ellipsoid([18.5, 19.5, 9], [1.6, 2.2, 1], 'ember'), 0); S.add(capsule([18.5, 15.8, 7], [18.5, 14.2, 7], 0.8, 0.8, 'bronze'), 0); } },
  thorn: { map: { crimson: 'rotRobe', violet: 'rotRobe', leather: 'mossDark', iron: 'wood', gold: 'wood', blood: 'crimson', wood: 'wood', bone: 'cream' },
    mark: (S) => { S.add(torus([18.5, 18.5, 7], 3.6, 1, 0.3, 'wood'), 0.3); for (let k = 0; k < 5; k++) { const a = k * 1.256; S.add(capsule([18.5 + Math.cos(a) * 3.6, 18.5 + Math.sin(a) * 3.6, 7], [18.5 + Math.cos(a) * 5.6, 18.5 + Math.sin(a) * 5.6, 7], 0.8, 0.3, 'wood'), 0.1); } } },
});
const SET_ICONS = Object.keys(SET_LOOK);
const setIcon = (set, slot) => { const L = SET_LOOK[set]; return legendIcon(slot, L.map, L.mark, L.post); };

// -------------------------------------------------------------- loot bits ---
function coin(i) {
  const S = new Scene();
  S.add(ellipsoid([5.5, 5.5, 2], [i ? 1.6 : 4.2, 4.2, 1.2], 'gold'), 0);
  const f = render(S, 11, 11, MATS, { contrast: 1.4, rich: IRICH });
  if (!i) { put(f, 4, 3, 'white'); pline(f, 5, 4, 5, 7, 'gold2'); }
  return f;
}
function goldPile(n) {
  const S = new Scene(), pts = [[11, 12], [7, 13], [15, 13], [9, 10], [13, 10], [11, 8], [5, 11], [17, 11], [11, 14]].slice(0, [3, 6, 9][n]);
  for (const [x, y] of pts) S.add(ellipsoid([x, y, 2], [3.4, 1.6, 3], 'gold'), 0);
  const f = render(S, 22, 17, MATS, { contrast: 1.35, rich: IRICH });
  for (const [x, y] of pts.slice(0, 3)) put(f, x - 1, y - 1, 'white');
  return f;
}
function globe(i) {
  const f = frame(18, 18);
  blobs(18, 18, [[9, 9, 6 + i * 0.4]], { ramp: 'blood', min: 0, max: 7, outline: 'ink', bias: 0.1, f });
  put(f, 6, 6, 'white'); put(f, 7, 6, 'blood0'); put(f, 6, 7, 'blood0');
  return f;
}

// The Bloodrose Key that opens the Bleeding Vigil: a gilt ring round a
// rose, on a pink shaft.
function roseKey() {
  const S = new Scene();
  S.add(torus([10, 8, 2], 5.4, 1.8, Math.PI / 2, 'gold'), 0);
  S.add(sphere([10, 8, 2.6], 2.6, 'rose'), 0);
  S.add(capsule([10, 15, 2], [10, 26, 2], 2, 1.9, 'rose'), 0.6);
  S.add(box([14, 21, 2], [2.4, 1.3, 1.4], 0.3, 'rose'), 0.4);
  S.add(box([14, 25, 2], [2.4, 1.3, 1.4], 0.3, 'rose'), 0.4);
  const f = render(S, 20, 29, MATS, { contrast: 1.4, rich: IRICH });
  put(f, 8, 6, 'white'); put(f, 9, 6, 'white');
  return f;
}
// Sound toggle for the HUD: a pale disc like the pause button, with a speaker.
function soundIcon(on) {
  const S = new Scene();
  S.add(ellipsoid([12, 12, 0], [10.5, 10.5, 3], 'cloth'), 0);
  const f = render(S, 24, 24, MATS, { contrast: 1.2, rich: IRICH });
  const ink = (x, y) => put(f, x, y, 'ink1');
  for (let y = 10; y <= 14; y++) for (let x = 6; x <= 8; x++) ink(x, y);
  for (let x = 9; x <= 12; x++) for (let y = 12 - (x - 8) - 1; y <= 12 + (x - 8) + 1; y++) ink(x, y);
  if (on) { for (let y = 10; y <= 14; y++) ink(14, y); for (let y = 8; y <= 16; y++) ink(17, y); put(f, 15, 9, 'ink1'); put(f, 15, 15, 'ink1'); put(f, 16, 7, 'ink1'); put(f, 16, 17, 'ink1'); }
  else for (let k = 0; k < 6; k++) { ink(14 + k, 9 + k); ink(19 - k, 9 + k); ink(15 + k, 9 + k); ink(20 - k, 9 + k); }
  return f;
}

// ---------------------------------------------------------- forge stuff ---
// The Ember Forge's reforge material: a rough dark stone split by glowing
// cracks, with a hot core showing through.
const FM = {
  ...MATS,
  rock: { ramp: 'stone', bias: -0.28, min: 3, spec: 0.05 },
  crack: { ramp: 'ember', glow: 2 }, crackHot: { ramp: 'ember', glow: 0 },
};
function emberstone() {
  const S = new Scene();
  S.add(bumpy(ellipsoid([9, 10.5, 2], [7.4, 5.8, 5], 'rock'), 0.7, 0.55, 3), 0);
  S.add(bumpy(sphere([6.5, 8.5, 3], 4.4, 'rock'), 0.5, 0.6, 7), 1.5);
  // Cracks: thin glowing seams over the surface, widening into the core.
  const seg = (ax, ay, bx, by, w) => (x, y) => { const dx = bx - ax, dy = by - ay, t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(x - ax - dx * t, y - ay - dy * t) - w; };
  const cracks = [seg(3, 7, 6, 8, 1), seg(6, 8, 9, 10.5, 1.1), seg(9, 10.5, 12, 7, 1), seg(12, 7, 15, 6.5, 0.9), seg(9, 10.5, 7, 15, 1), seg(9, 10.5, 14, 13, 0.9)];
  S.paint({ f: (x, y) => Math.min(...cracks.map((c) => c(x, y))), mat: 'crack' });
  S.paint({ f: (x, y) => Math.hypot(x - 9, y - 10.5) - 2.2, mat: 'crackHot' });
  const f = render(S, 18, 18, FM, { contrast: 1.4, rich: IRICH });
  dot(f, 9, 10, 'white');
  dot(f, 5, 4, 'stone1');
  return f;
}

// The Reliquary Tear (round 71): a crimson drop of glass with a hot core, the
// rare stuff Beatified affixes need.
const TM = { ...MATS, tearGlass: { ramp: 'crimson', bias: -0.05, spec: 0.5 }, tearCore: { ramp: 'rose', glow: 1 } };
function relTear() {
  const S = new Scene();
  S.add(sphere([9, 11.5, 3], 4.8, 'tearGlass'), 0);
  S.add(sphere([9, 6.5, 3], 2.6, 'tearGlass'), 3.5);
  S.add(sphere([9, 3, 3], 1.3, 'tearGlass'), 2.5);
  S.paint({ f: (x, y) => Math.hypot(x - 9.5, y - 12) - 2.2, mat: 'tearCore' });
  const f = render(S, 18, 18, TM, { contrast: 1.35, rich: IRICH });
  dot(f, 7, 9, 'white'); dot(f, 8, 5, 'rose1');
  return f;
}

// --------------------------------------------------------- ingredients ---
// 18x18 reagents for the Enchanter, one shape per icon, tinted by ramp.
// Frame = enchant * 3 + k; see INGR below for the order.
const INGR_RAMPS = ['ember', 'holy', 'blood', 'iron', 'rose', 'bone', 'moss', 'crimson', 'wood', 'sea', 'gold', 'flame', 'violet', 'teal', 'sand', 'slate'];
const IM = {
  ...MATS,
  ...Object.fromEntries(INGR_RAMPS.flatMap((r) => [[`g_${r}`, { ramp: r, spec: 0.7, min: 0 }], [`m_${r}`, { ramp: r, spec: 0.15, min: 0 }]])),
  sack: { ramp: 'shroud', spec: 0.05, min: 1 }, cord: { ramp: 'gold', bias: -0.1 }, corkW: { ramp: 'wood', spec: 0.1, bias: 0.05 },
  glass: { ramp: 'holy', spec: 0.8, min: 1, max: 5, bias: 0.1 }, spool: { ramp: 'wood', spec: 0.1, bias: -0.05 }, spoolI: { ramp: 'iron', spec: 0.5, bias: -0.1 },
};
// A convex solid from planes [nx, ny, nz, d] (keep n.p <= d), for cut gems.
function facets(list, bb, mat) {
  const ps = list.map(([nx, ny, nz, d]) => { const l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l, d / l]; });
  return { mat, bb, f: (x, y, z) => { let m = -1e9; for (const [a, b, c, d] of ps) { const v = a * x + b * y + c * z - d; if (v > m) m = v; } return m; } };
}
const ingrRender = (S) => A(render(S, 18, 18, IM, { contrast: 1.45, rich: IRICH }), 9, 9);
const lit = (r, s) => FINE[r][s];
const INGR_SHAPES = {
  // A tied sack with a heap of coloured dust spilling out in front.
  dust: (r) => {
    const S = new Scene();
    S.add(ellipsoid([6.5, 9.5, 0], [4, 4.4, 3.4], 'sack'), 0);
    S.add(capsule([6.5, 5.6, 0], [6.5, 3, 0], 1.4, 2.2, 'sack'), 1.2);
    S.paint({ f: (x, y) => Math.abs(y - 5.4) - 0.8, mat: 'cord' });
    S.add(ellipsoid([11.5, 13.5, 3], [5, 2.4, 3], `m_${r}`), 1);
    S.add(sphere([12, 12, 3], 2.4, `m_${r}`), 1.2);
    const f = ingrRender(S);
    dot(f, 11, 11, lit(r, 0)); dot(f, 15, 13, lit(r, 2));
    return f;
  },
  // A squat candle stub with a drip and a small flame.
  wax: (r) => {
    const S = new Scene();
    S.add(box([9, 12, 0], [3.6, 3.2, 3.6], 0.8, `m_${r}`), 0);
    S.add(capsule([5.4, 9.5, 3.4], [5.4, 13, 3.6], 1.2, 1.3, `m_${r}`), 0.6);
    S.add(ellipsoid([9, 16, 0], [6, 1.2, 4.6], 'iron'), 0.4);
    const f = ingrRender(S);
    dot(f, 9, 7, 'ink2');
    dot(f, 9, 5, 'ember1'); dot(f, 9, 3, 'ember0'); dot(f, 9, 1, 'ember2');
    dot(f, 7, 10, lit(r, 0));
    return f;
  },
  // A faceted gem: a hexagonal bipyramid with a crown table.
  stone: (r) => {
    const S = new Scene(), c = [9, 7.5, 0], P = [];
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.3, nx = Math.cos(a), nz = Math.sin(a) * 0.9;
      P.push([nx, -0.9, nz, nx * c[0] - 0.9 * c[1] + nz * c[2] + 5.2]);   // crown facets
      P.push([nx, 0.75, nz, nx * c[0] + 0.75 * c[1] + nz * c[2] + 5.4]); }    // pavilion facets
    P.push([0, -1, 0, -(c[1] - 3.2)]);
    S.add(facets(P, [2, 3, -7, 16, 17, 7], `g_${r}`), 0);
    const f = ingrRender(S);
    dot(f, 6, 6, 'white'); dot(f, 8, 4, lit(r, 0));
    return f;
  },
  // A slim glass vial with a cork, liquid in the lower part.
  vial: (r) => {
    const S = new Scene();
    S.add(capsule([9, 13.2, 0], [9, 9.5, 0], 4.2, 4, `g_${r}`), 0);
    S.add(capsule([9, 8, 0], [9, 4.5, 0], 2.6, 1.7, 'glass'), 1.4);
    S.add(capsule([9, 3.4, 0.4], [9, 1, 0.4], 2, 2, 'corkW'), 0);
    const f = ingrRender(S);
    dot(f, 7, 10, 'white'); dot(f, 7, 12, lit(r, 1));
    return f;
  },
  // A wooden spool wound with thick cord, a loose end trailing.
  thread: (r) => {
    const S = new Scene(), sp = r === 'wood' || r === 'sand' ? 'spoolI' : 'spool';
    S.add(box([8, 3.4, 0], [5.6, 1, 4], 0.6, sp), 0);
    S.add(box([8, 14, 0], [5.6, 1, 4], 0.6, sp), 0);
    S.add(capsule([8, 5.5, 0], [8, 12, 0], 4, 4, `m_${r}`), 0);
    S.add(capsule([11.4, 9.5, 2.6], [15.6, 16, 1.4], 1.2, 1.2, `m_${r}`), 0.6);
    const f = ingrRender(S);
    for (const y of [8]) pline(f, 5, y, 10, y, lit(r, 6));
    dot(f, 5, 6, lit(r, 0));
    return f;
  },
  // A gnawed bone, lying across the icon: a bowed shaft with knobbed ends, tinted toward the ramp.
  bone: (r) => {
    const S = new Scene(), m = `m_${r}`;
    S.add(capsule([5, 12.5, 0], [9.5, 9.6, 0.5], 1.7, 1.5, m), 0);
    S.add(capsule([9.5, 9.6, 0.5], [13, 5.5, 0], 1.5, 1.7, m), 1);
    for (const [x, y] of [[3, 12.2], [5.2, 14.6], [12.8, 3.4], [15, 5.8]]) S.add(sphere([x, y, 0], 2.1, m), 1.2);
    const f = ingrRender(S);
    dot(f, 12, 2, lit(r, 0)); dot(f, 8, 9, lit(r, 1)); dot(f, 6, 14, lit(r, 6));
    return f;
  },
};
// Each enchant's three reagents, in frame order.
const INGR = [
  ['ember', 'dust', 'wax', 'stone'], ['holy', 'vial', 'thread', 'stone'], ['blood', 'bone', 'vial', 'dust'], ['iron', 'stone', 'thread', 'bone'],
  ['rose', 'vial', 'wax', 'thread'], ['bone', 'bone', 'stone', 'dust'], ['moss', 'bone', 'thread', 'vial'], ['crimson', 'vial', 'wax', 'bone'],
  ['wood', 'bone', 'dust', 'thread'], ['sea', 'vial', 'stone', 'dust'], ['gold', 'wax', 'stone', 'bone'], ['flame', 'wax', 'vial', 'dust'],
  ['violet', 'thread', 'dust', 'stone'], ['teal', 'thread', 'bone', 'vial'], ['sand', 'dust', 'wax', 'stone'], ['slate', 'thread', 'vial', 'bone'],
  // Round 102, the class enchants: Twin String, Still Water (Saint), Weighted Head, Long Haft (Mendicant), Spare Relic, Prism (Anchoress).
  ['gold', 'thread', 'bone', 'wax'], ['sea', 'dust', 'stone', 'vial'], ['iron', 'dust', 'stone', 'bone'], ['wood', 'bone', 'wax', 'thread'], ['violet', 'dust', 'bone', 'stone'], ['rose', 'stone', 'thread', 'vial'],
];

// Round 81: the nine mythic Wounds' emblems (24 px, drawn at 2x on the level-up card), in
// MYTHIC_ICONS order: halo, fury, zeal, nailstorm heart, eye of heaven, giant's blades,
// earthbreaker, choir of glass, prism heart. Each sits on a rose-lit ground.
const MM = { ...MATS, rose: { ramp: 'blood', spec: 0.5, bias: 0.12 }, roseDark: { ramp: 'blood', bias: -0.15, min: 2 }, glass: { ramp: 'holy', spec: 0.9, bias: 0.1 } };
const micon = (fn) => { const S = new Scene(); fn(S); return render(S, 24, 24, MM, { contrast: 1.35, rich: IRICH }); };
const octa = (c, r, mat) => ({ mat, bb: [c[0] - r, c[1] - r, c[2] - r, c[0] + r, c[1] + r, c[2] + r], f: (x, y, z) => (Math.abs(x - c[0]) + Math.abs((y - c[1]) * 0.8) + Math.abs(z - c[2]) - r) * 0.577 });
const heart = (S, cx, cy, r, mat) => { S.add(sphere([cx - r * 0.5, cy - r * 0.25, 2], r * 0.62, mat), 0); S.add(sphere([cx + r * 0.5, cy - r * 0.25, 2], r * 0.62, mat), 0.8); S.add(capsule([cx, cy + r * 0.9, 2], [cx, cy + r * 0.1, 2], 0.6, r * 0.75, mat), 1.4); };
const MYTHIC_ICONS = [
  // The Unbroken Halo: a thick gilt ring, face on, round a rose light.
  () => micon((S) => { S.add(torus([12, 12, 3], 7.2, 2.4, Math.PI / 2, 'halo'), 0); S.add(sphere([12, 12, 1], 2.4, 'rose'), 0); }),
  // Martyr's Fury: a bleeding heart crowned with flame.
  () => micon((S) => { heart(S, 12, 14, 7, 'rose'); for (const [x, h] of [[8, 5], [12, 7], [16, 5]]) S.add(capsule([x, 8, 4], [x + (x - 12) * 0.15, 8 - h, 4], 1.7, 0.4, 'emberLit'), 0.6); }),
  // Endless Zeal: a sun of embers with eight rays.
  () => micon((S) => { S.add(sphere([12, 12, 3], 4.8, 'emberLit'), 0); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; S.add(capsule([12 + Math.cos(a) * 5, 12 + Math.sin(a) * 5, 3], [12 + Math.cos(a) * 10.5, 12 + Math.sin(a) * 10.5, 3], 1.6, 0.5, k % 2 ? 'rose' : 'gold'), 0.4); } }),
  // The Nailstorm Heart: three nails fanned through a rose heart.
  () => micon((S) => { heart(S, 12, 18.5, 4.2, 'rose'); for (const a of [-0.9, 0, 0.9]) { const dx = Math.sin(a), dy = -Math.cos(a); S.add(capsule([12 + dx * 5, 17 + dy * 5, 3], [12 + dx * 12, 17 + dy * 12, 3], 1.2, 0.7, 'iron'), 0); S.add(sphere([12 + dx * 12.5, 17 + dy * 12.5, 3], 1.7, 'gold'), 0.2); } }),
  // Eye of Heaven: an open eye with a holy iris, rays above.
  () => micon((S) => { S.add(ellipsoid([12, 13, 2], [9, 4.6, 2.6], 'bone'), 0); S.add(sphere([12, 13, 3.2], 3.8, 'glass'), 0.2); S.add(sphere([12, 13, 6.4], 1.8, 'rose'), 0); for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) S.add(capsule([12 + Math.sin(a) * 7, 13 - Math.cos(a) * 7, 2], [12 + Math.sin(a) * 10.5, 13 - Math.cos(a) * 10.5, 2], 0.9, 0.5, 'gold'), 0); }),
  // The Giant's Blades (the Giant's Mace until round 118): two great glass blades crossed, rose grips.
  () => micon((S) => { for (const k of [1, -1]) { const X = (x) => (k > 0 ? x : 24 - x); S.add(capsule([X(3.5), 21, 2], [X(7.5), 17, 2], 1.4, 1.4, 'roseDark'), 0.3); S.add(capsule([X(5.5), 14.5, 2.6], [X(10.5), 19.5, 2.6], 1.2, 1.2, 'gold'), 0.3); S.add(capsule([X(8.5), 16, 2 + k], [X(21), 3, 2 + k], 2.4, 0.5, 'glass'), 0.2); } }),
  // Earthbreaker: a split slab of stone with fire in the crack.
  () => micon((S) => { S.add(bumpy(box([12, 14, 2], [9, 6, 3], 1.2, 'stone'), 0.4, 0.5, 3), 0); S.sub(rotZ(box([12, 14, 4], [1.2, 8, 3], 0.3, 'void'), [12, 14], 0.35), 0.3); S.add(rotZ(box([12, 14, 1.5], [0.9, 6.5, 1], 0.2, 'ember'), [12, 14], 0.35), 0); }),
  // Choir of Glass: five ice crystals in a ring round a rose light.
  () => micon((S) => { S.add(sphere([12, 12, 2], 2.4, 'rose'), 0); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 - Math.PI / 2; S.add(rotZ(ellipsoid([12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 3], [1.6, 3.2, 1.6], 'glass'), [12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5], a + Math.PI / 2), 0); } }),
  // Prism Heart: a cut gem, rose at its heart, glass at its rim.
  () => micon((S) => { S.add(octa([12, 12, 3], 8.5, 'glass'), 0); S.paint({ mat: 'rose', f: (x, y) => Math.abs(x - 12) + Math.abs(y - 12) * 0.8 - 3.6 }); }),
];
export default {
  ui: { sound: () => [soundIcon(true)], muted: () => [soundIcon(false)] },
  fx: {
    bolt: () => [bolt()], ...Object.fromEntries(Object.keys(BOLTS).map((k) => [`bolt_${k}`, () => [bolt(k)]])),
    impact: () => [0, 1, 2, 3].map(impact),
    ...Object.fromEntries(['gold', 'font', 'nails', 'stride', 'confessor', 'choir', 'reliquary', 'iron', 'road', 'alms', 'gaol', 'bell', 'glass', 'psalter', 'lantern', 'thorn', 'enlightened', 'void', 'psychedelic', 'dread', 'radiant', 'divine', 'demonic'].map((k) => [`sigil_${k}`, () => Array.from({ length: 12 }, (_, i) => sigil(i, k))])),
    wardenfall: () => Array.from({ length: 12 }, (_, i) => wardenFall(i)),
    burst: () => [0, 1, 2, 3].map(burst),
    smoke: () => [0, 1, 2, 3].map(smoke),
    thurible: () => [0, 1].map(thurible), ...Object.fromEntries(Object.keys(PTHUR).map((k) => [`thurible_${k}`, () => [0, 1].map((i) => pthurible(k, i))])),
    shard: () => [0, 1, 2, 3].map(shard), shardbolt: () => [shardBolt()], crystal: () => Array.from({ length: 16 }, (_, i) => crystal(i)), ...Object.fromEntries(Object.keys(CRYSTALS).flatMap((k) => [[`crystal_${k}`, () => Array.from({ length: 16 }, (_, i) => crystal(i, false, k))], [`crystalbolt_${k}`, () => Array.from({ length: 16 }, (_, i) => crystal(i, true, k))]])), crystalbolt: () => Array.from({ length: 16 }, (_, i) => crystal(i, true)), vdagger: () => Array.from({ length: 16 }, (_, i) => vdagger(i)), ...Object.fromEntries(Object.keys(DAGGERS).filter((k) => k !== 'plain').map((k) => [`vdagger_${k}`, () => Array.from({ length: 16 }, (_, i) => vdagger(i, k))])),
    flask: () => [flask()],
    link: () => [0, 1].map(link),
    hook: () => [hook()],
    scourge: () => [0, 1].map(scourge),
  },
  loot: {
    item: () => ['hood', 'mantle', 'gloves', 'girdle', 'greaves', 'rosary', 'seal', 'relic', 'bow', 'quiver'].map((k) => ICONS[k]()),
    legend: () => LEGEND_ICONS.map((f) => f()),
    mythic: () => MYTHIC_ICONS.map((f) => f()),
    setitem: () => SET_ICONS.flatMap((k) => SLOT_ORDER.map((slot) => setIcon(k, slot))),
    // The Mendicant's arms: [mace, satchel] plain, then per set (set * 2 + k), then the Penitent's Prod as a mace.
    marms: () => [ICONS.mace(), ICONS.satchel(), ...SET_ICONS.flatMap((k) => [setIcon(k, 'mace'), setIcon(k, 'satchel')]),
      legendIcon('mace', { wood: 'crimsonDark', gold: 'iron' }, (S) => { for (const [x, y] of [[9, 15], [12, 12]]) S.add(capsule([x, y, 2], [x - 2.5, y - 2.5, 2], 0.9, 0.3, 'iron'), 0); })],
    // The Anchoress's arms (round 71): [reliquary, phylactery] plain, then per set (set * 2 + k).
    aarms: () => [ICONS.reliquary(), ICONS.phylactery(), ...SET_ICONS.flatMap((k) => [setIcon(k, 'reliquary'), setIcon(k, 'phylactery')])],
    coin: () => [0, 1].map(coin),
    gold: () => [0, 1, 2].map(goldPile),
    globe: () => [0, 1].map(globe),
    vkey: () => [roseKey()],
    // Chrism vials by kind: common, blessed, consecrated, Hallowed.
    chrism: () => ['cloth', 'holy', 'gold', 'ember'].map((m) => flask(m)),
    emberstone: () => [emberstone()],
    rtear: () => [relTear()],
    // 48 reagents: frame = enchant * 3 + k (INGR).
    ingr: () => INGR.flatMap(([r, ...shapes]) => shapes.map((s) => INGR_SHAPES[s](r))),
    wax: () => [orb('pot', { tail: true })], bone: () => [orb('bone', { r: 3.6 })], tear: () => [orb('holy', { tail: true })],
    feather: () => [orb('cloth', { r: 3.4, tail: true })], spit: () => [orb('rot', { tail: true })], ember: () => [orb('ember', { tail: true })],
    violet: () => [orb('violet')], blood: () => [orb('blood', { tail: true })], frost: () => [orb('holy', { r: 4.6 })], bomb: () => [orb('ink', { r: 4.8 })],
  },
};
