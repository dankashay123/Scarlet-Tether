// Stratum III, the Ossuary Spire: three monsters and two Wardens.
//   mon_common: gleaner (Bone Gleaner), cinderMoth (Cinder Moth)
//   mon_rare:   abbot (Marrow Abbot)
//   mon_warden: ossuarch (the Ossuarch), ashWidow (the Ash Widow)
// Same conventions as common.mjs, rare.mjs and elite.mjs: smooth-joined
// forms, lit from the top-left, eyes placed by hand, facing right, ax/ay at
// the feet.
import { Scene, sphere, ellipsoid, capsule, box, skirt, rotZ, render, folds, bumpy, clip, noise3, dot, under } from '../sdf.mjs';
import { MATS, torus, stride, odd, cyc, HALF, reactions, bobAt } from './base.mjs';

const PI = Math.PI, sin = Math.sin, cos = Math.cos;
const MM = {
  ...MATS,
  // Ash-grey flesh, rags gone to soot, a burlap sack.
  ash: { ramp: 'stone', spec: 0.1, bias: 0.02 }, ashDark: { ramp: 'stone', bias: -0.14, min: 2 },
  rag: { ramp: 'shroud', spec: 0.03, bias: -0.04 }, ragDark: { ramp: 'shroud', bias: -0.18, min: 3 },
  sack: { ramp: 'sand', spec: 0.04, bias: -0.06, min: 1 }, rope: { ramp: 'wood', spec: 0.1, bias: 0.1 },
  bone: { ramp: 'bone', spec: 0.25 }, boneDark: { ramp: 'bone', bias: -0.16, spec: 0.15, min: 2 }, boneDeep: { ramp: 'bone', bias: -0.3, min: 4 },
  hollow: { ramp: 'ink', bias: -0.5, min: 5 },
  // The moth: pale ash wings rimmed with live embers.
  wingAsh: { ramp: 'cloth', spec: 0.1, bias: -0.08, min: 1, max: 7 }, wingDark: { ramp: 'stone', bias: -0.05, min: 2 },
  fur: { ramp: 'stone', spec: 0.05, bias: 0.12 }, furDark: { ramp: 'shroud', bias: -0.05, min: 2 },
  emberEdge: { ramp: 'ember', glow: 3 }, emberHot: { ramp: 'ember', glow: 1 },
  // The abbot: bone-white habit, ash scapular.
  habit: { ramp: 'bone', spec: 0.06, bias: 0.04, max: 7 }, habitDark: { ramp: 'bone', bias: -0.12, min: 2 },
  ashCloth: { ramp: 'slate', spec: 0.05, bias: 0.05, min: 1 }, ashClothDark: { ramp: 'slate', bias: -0.1, min: 3 },
  candle: { ramp: 'flame', glow: 1 },
  // The Ash Widow: black lace (cold dark slate), iron censers.
  lace: { ramp: 'slate', bias: -0.25, min: 3, spec: 0.12 }, laceLit: { ramp: 'stone', bias: -0.12, min: 3 }, veil: { ramp: 'slate', bias: -0.5, min: 6, spec: 0.2 },
  censer: { ramp: 'iron', spec: 0.6, bias: -0.18, min: 2 }, brass: { ramp: 'gold', spec: 0.6, bias: -0.25, min: 2 },
  goldDark: { ramp: 'gold', bias: -0.22, spec: 0.6, min: 2 },
};
const A = (f, ax, ay) => Object.assign(f, { ax, ay });
const D = (f, x, y, c) => dot(f, Math.floor(x), Math.floor(y), c);
const eye = (f, x, y, a, b) => { D(f, x, y, a); if (b) D(f, x, y + 1, b); };
const free = (f, x, y, c) => { if (under(f, Math.floor(x), Math.floor(y)) < 0) D(f, x, y, c); };
function limb(S, a, b, c, ra, rb, rc, mat, k = 0.8, matB = mat) { S.add(capsule(a, b, ra, rb, mat), k); S.add(capsule(b, c, rb, rc, matB), k * 0.8); }
const ph = (t) => (t / 4) * PI * 2;
const gaitL = (t, amp, H = 1.6) => [stride(t / 4 + 0.5, amp, H), stride(t / 4, amp, H)];
// A long bone with a knob at each end (femurs, crown spikes).
function femur(S, a, b, r, mat = 'bone', k = 0.4) {
  S.add(capsule(a, b, r, r * 0.85, mat), k);
  const d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d) || 1, n = [-d[1] / L, d[0] / L];
  for (const e of [a, b]) for (const s of [-1, 1]) S.add(sphere([e[0] + n[0] * r * 0.8 * s, e[1] + n[1] * r * 0.8 * s, e[2]], r * 1.15, mat), 0.5);
}
// A skull facing right and toward the viewer: sockets and nose carved out.
function skull(S, c, r, mat = 'bone', k = 1, face = 0.6) {
  S.add(sphere(c, r, mat), k);
  S.add(ellipsoid([c[0] + r * 0.3, c[1] + r * 0.62, c[2] + r * 0.2], [r * 0.6, r * 0.42, r * 0.7], mat), r * 0.3);
  const fx = face, fz = Math.sqrt(1 - face * face);
  const eyes = [];
  for (const s of [-1, 1]) {
    const ex = c[0] + r * (fx * 0.78 - fz * 0.38 * s), ez = c[2] + r * (fz * 0.78 + fx * 0.38 * s);
    S.sub(sphere([ex, c[1] + r * 0.08, ez], r * 0.37, 'hollow'), 0.3);
    eyes.push([ex, c[1] + r * 0.08]);
  }
  S.sub(ellipsoid([c[0] + r * fx * 0.92, c[1] + r * 0.46, c[2] + r * fz * 0.92], [r * 0.14, r * 0.18, r * 0.3], 'hollow'), 0.2);
  return eyes;
}

// ========================================================= bone gleaner ===
// A hunched scavenger in sooty rags, dragging a sack of bones behind it on
// a rope. It scuttles, then lunges with a hooked hand.
function gleaner(t = 0, atk = -1) {
  const S = new Scene(), w = 48, h = 44, gy = 41, cx = 22;
  const B = atk >= 0 ? 0 : bobAt(t) - 2, lean = atk === 0 ? -2.5 : atk === 1 ? 5 : 1.5;
  const G = gaitL(t, 2.8, 1.8);
  // Short bent legs, quick steps.
  for (const [side, g] of [[-1, G[0]], [1, G[1]]]) {
    const sw = atk === 0 ? side * 1.5 - 1 : atk === 1 ? side * 3.5 : g.x, up = atk >= 0 ? 0 : g.up, z = side * 2.2;
    const hip = [cx + side * 0.3 + lean * 0.2, 31 + B, z];
    limb(S, hip, [cx + sw * 0.5 + 2.6, 35.5 - up * 0.5 + B * 0.5, z + 0.4], [cx + sw, gy - 1.6 - up, z], 2, 1.6, 1.3, side < 0 ? 'ashDark' : 'ash', 0.9);
    S.add(ellipsoid([cx + sw + 1.3, gy - 1 - up, z], [2.4, 1.1, 1.6], 'ashDark'), 0.7);
  }
  // The sack of bones, dragged behind on the ground.
  const sx = cx - 13 + (atk >= 0 ? 0 : odd(t) * 0.6), sy = gy - 6;
  S.add(bumpy(ellipsoid([sx, sy, -1.5], [7, 5.6, 5], 'sack'), 0.5, 0.5, 3), 0);
  S.add(capsule([sx + 2.5, sy - 4.4, -1], [sx + 4.5, sy - 7.5, -1], 2.4, 1.3, 'sack'), 1);
  S.paint({ mat: 'rope', f: (x, y) => Math.abs(y - (sy - 6.2) + (x - sx) * 0.5) - 0.8 + (Math.abs(x - (sx + 3.4)) > 3 ? 9 : 0) });
  femur(S, [sx - 2, sy - 3, 2], [sx - 6, sy - 10, 1], 0.9);
  femur(S, [sx + 1, sy - 4, 1], [sx + 1, sy - 11, 0], 0.9);
  skull(S, [sx - 3, sy + 0.5, 4.2], 2.6, 'bone', 0.4, 0.2);
  // Hunched trunk under a ragged hooded mantle.
  const tx = cx + 1 + lean * 0.6, ty = 25 + B;
  S.add(rotZ(ellipsoid([tx, ty, 0], [6.4, 7.4, 5], 'ash'), [tx, ty + 6], 0.55 + lean * 0.05), 0);
  const mantle = clip(rotZ(ellipsoid([tx - 0.5, ty - 1, 0], [7.6, 7.8, 5.8], 'rag'), [tx, ty + 6], 0.6 + lean * 0.05), (x, y, z) => y - (ty + 4.5 + 1.5 * noise3(x * 0.9, 0.5, z * 0.9)));
  S.add(folds(mantle, { cx: tx, n: 7, amp: 0.45, y0: ty - 6, y1: ty + 5 }), 1.4);
  // Back arm hauling the sack's rope.
  limb(S, [tx - 2, ty - 3, -2.6], [tx - 6, ty + 2, -3], [sx + 5.5, sy - 7.5, -1.5], 1.7, 1.4, 1.2, 'ashDark', 1);
  // Front arm: long, ending in a hooked bone claw.
  const hand = atk === 0 ? [tx - 1, ty - 11, 3.4] : atk === 1 ? [tx + 15, ty + 3, 3.4] : [tx + 8, ty + 4 + sin(ph(t)) * 0.8, 3.2];
  const elbow = atk === 0 ? [tx + 3, ty - 6, 3] : atk === 1 ? [tx + 8, ty - 1, 3.2] : [tx + 5, ty - 1, 3];
  limb(S, [tx + 2, ty - 3.5, 2.6], elbow, hand, 2.2, 1.8, 1.6, 'ash', 1);
  const hk = atk === 1 ? [1, 0.2] : atk === 0 ? [0.6, -1] : [0.7, 0.7];
  S.add(capsule(hand, [hand[0] + hk[0] * 3.5, hand[1] + hk[1] * 3.5, hand[2] + 0.3], 1.4, 1.1, 'bone'), 0.5);
  S.add(capsule([hand[0] + hk[0] * 3.5, hand[1] + hk[1] * 3.5, hand[2] + 0.3], [hand[0] + hk[0] * 3.5 + hk[1] * 2.2, hand[1] + hk[1] * 3.5 - hk[0] * 2.2 + 0.6, hand[2] + 0.3], 1.1, 0.6, 'bone'), 0.3);
  // The hooded head, thrust forward, two ember eyes in the dark.
  const hx = tx + 5.5 + lean * 0.5, hy = ty - 6 + (atk === 1 ? 2 : 0);
  S.add(capsule([tx + 1.5, ty - 4, 0], [hx - 1, hy + 1, 0.4], 2.6, 2.4, 'rag'), 1.4);
  S.add(ellipsoid([hx, hy, 0.6], [4.6, 4.2, 4.2], 'rag'), 1.2);
  S.add(capsule([hx - 2, hy - 2.4, -0.6], [hx - 6, hy - 4.6, -1.4], 2.6, 0.8, 'rag'), 1.4);
  S.sub(ellipsoid([hx + 2.8, hy + 0.8, 3.4], [2.6, 2.8, 3], 'hollow'), 0.5);
  S.add(ellipsoid([hx + 3.2, hy + 2.8, 2.6], [1.4, 0.9, 1.2], 'ashDark'), 0.4);
  const f = render(S, w, h, MM, { ground: gy });
  eye(f, hx + 2, hy, 'ember0', 'ember2'); eye(f, hx + 4.2, hy + 0.4, 'ember1');
  // Drag marks in the dust behind the sack.
  if (atk < 0) { free(f, sx - 8 - odd(t) * 2, gy - 1, 'stone4'); free(f, sx - 11, gy - 2, 'stone5'); }
  return A(f, cx, gy);
}

// =========================================================== cinder moth ===
// A moth of grey ash as wide as a hand, its wing edges still burning. It
// flutters low over the floor and darts in.
// Seen from above, as the camera sees it: the body points right, the far
// wings spread up the screen, the near wings down. spread 1 = open, 0.3 = beat
// shut. Each wing is a thin plate with a burning rim and a dark eye-spot.
function wings(S, bx, by, spread, side) {
  const z = side > 0 ? 1.6 : -1.6, mat = side > 0 ? 'wingAsh' : 'wingDark', inside = [];
  for (const [k, ox, L, Wd, rot] of [[0, 1.5, 8.6, 5.8, -0.45], [1, -3, 6, 4.8, 0.6]]) {
    const ry = L * spread, c = [bx + ox - Math.sin(rot) * ry * 0.9, by + side * Math.cos(rot) * ry * 0.9, z - k * 0.3];
    const plate = rotZ(ellipsoid(c, [Wd, Math.max(ry, 1.6), 0.9], mat), c, rot * side);
    const inner = rotZ(ellipsoid(c, [Wd - 1.3, Math.max(ry, 1.6) - 1.3, 4], mat), c, rot * side);
    S.add(plate, 0.8);
    S.paint({ mat: 'emberEdge', f: (x, y, zz) => Math.max(plate.f(x, y, zz) - 0.6, Math.abs(zz - c[2]) - 1.6) });
    inside.push({ inner, plate, c, ry, k });
  }
  // Interiors last, so one wing's rim never paints over the other wing.
  for (const { inner, plate, c, ry, k } of inside) {
    S.paint({ mat, f: (x, y, zz) => Math.max(inner.f(x, y, zz), plate.f(x, y, zz) - 0.6, Math.abs(zz - c[2]) - 1.6) });
    if (!k) S.paint({ mat: 'furDark', f: (x, y, zz) => Math.max(Math.hypot(x - c[0], y - (c[1] + (side > 0 ? 1 : -1) * ry * 0.15)) - 1.5, Math.abs(zz - c[2]) - 1.6) });
  }
}
function cinderMoth(t = 0, atk = -1) {
  const S = new Scene(), w = 40, h = 44, gy = 41, cx = 18;
  const spread = atk === 0 ? 1.1 : atk === 1 ? 0.45 : cyc([1, 0.7, 0.35, 0.7], t);
  const bob = atk >= 0 ? 0 : (cyc([0, 1, 1, 0], t) > 0.5 ? 2 : 0);
  const dx = atk === 1 ? 6 : atk === 0 ? -2 : 0, dy = atk === 1 ? 4 : atk === 0 ? -2 : 0;
  const bx = cx + dx, by = 20 - bob + dy;
  wings(S, bx, by, spread, -1);
  // Body: fuzzy thorax, ringed abdomen trailing back, round head, feathered antennae.
  S.add(bumpy(ellipsoid([bx + 0.5, by, 3], [3.4, 2.6, 2.6], 'fur'), 0.35, 1.2, 2), 0);
  S.add(capsule([bx - 1.5, by + 0.3, 3], [bx - 10, by + 0.8, 2.6], 2.6, 1.3, 'fur'), 1.2);
  for (let k = 0; k < 3; k++) S.paint({ mat: 'furDark', f: (x, y, z) => Math.abs(x - (bx - 3.6 - k * 1.7)) - 0.5 + (z < 3.5 ? 9 : 0) });
  S.add(sphere([bx + 4, by + 0.2, 3.4], 2.1, 'furDark'), 0.8);
  for (const s of [-1, 1]) {
    S.add(capsule([bx + 5, by + s * 0.8, 4], [bx + 9.5, by + s * 3.4, 4], 1.1, 0.9, 'furDark'), 0.3);
  }
  wings(S, bx, by, spread, 1);
  const f = render(S, w, h, MM, { ground: gy, contourDepth: 2.5 });
  eye(f, bx + 5, by - 1, 'ember0');
  // Sparks shed from the burning wings.
  if (atk < 0) { free(f, bx - 10 - (t % 2) * 2, by + 2 + Math.floor(t) % 3, 'ember1'); free(f, bx - 6, by + 10 + Math.floor(t * 2) % 3, 'ember2'); }
  else if (atk === 1) { free(f, bx - 12, by - 2, 'ember1'); free(f, bx - 15, by + 1, 'ember2'); free(f, bx - 10, by + 4, 'ember3'); }
  return A(f, cx, gy);
}

// ========================================================= marrow abbot ===
// A tall abbot in a bone-white habit and an ash scapular, hood drawn low.
// He leans on a crozier of vertebrae crowned with a skull and a sick green
// candle; to cast he raises it high, then thrusts it forward.
const RW = 76, RH = 80, GY = 74, CX = 32;
const gait = (t, amp = 4) => { const f = stride(t / 4, amp, 2.4), b = stride(t / 4 + 0.5, amp, 2.4); return { sw: f.x, swB: b.x, lift: [b.up, f.up], bob: bobAt(t) }; };
function vertebrae(S, a, b, n, r, mat = 'bone') {
  for (let i = 0; i <= n; i++) {
    const u = i / n, c = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    S.add(sphere(c, r * (i % 2 ? 0.78 : 1), i % 2 ? 'boneDark' : mat), 0.25);
  }
}
function abbot({ bob = 0, sw = 0, swB = -sw, lift = [0, 0], t = 0, pose = 'walk' }) {
  const S = new Scene(), cx = CX - 1, B = bob, X = pose === 'strike' ? 3 : pose === 'windup' ? -2 : 0.5;
  for (const [side, s, up] of [[-1, swB, lift[0]], [1, sw, lift[1]]]) S.add(ellipsoid([cx + 2 + s * 0.8, GY - 1.8 - up * 0.7, side * 2.6], [3.2, 1.9, 2.1], 'ashClothDark'), 0.6);
  // The habit: floor-length, folded, with an ash hem.
  const top = 36 + B, bot = GY - 1;
  S.add(rotZ(folds(skirt(cx, top, bot, 6.4, 10.4, 0, 0.9, 'habit'), { cx, n: 9, amp: 0.7, y0: top, y1: bot }), [cx, top], -sw * 0.012), 1.2);
  S.paint({ mat: 'ashCloth', f: (x, y) => bot - 2 - y });
  S.add(ellipsoid([cx + X * 0.6, 32 + B, 0], [6.6, 7.6, 4.8], 'habit'), 1.5);
  // Ash scapular down the front and an ash cape on the shoulders.
  S.paint({ mat: 'ashCloth', f: (x, y, z) => Math.max(Math.abs(x - (cx + 2.4 + X * 0.6)) - 2.6, 27 + B - y, y - (bot - 3), -z + 1.5) });
  S.add(ellipsoid([cx + X * 0.7, 27.5 + B, 0], [8, 4, 5.4], 'ashCloth'), 1.8);
  S.paint({ mat: 'boneDark', f: (x, y, z) => Math.max(Math.abs(y - (bot - 6) + sin(x * 0.9) * 0.4) - 0.6, -z + 2) });
  // The crozier hand and the vertebra staff.
  const hand = pose === 'strike' ? [cx + 14, 30 + B, 6] : pose === 'windup' ? [cx + 7, 22 + B, 6] : [cx + 14, 41 + B + odd(t) * 0.5, 6];
  const dir = pose === 'strike' ? [0.8, -0.6] : [0.08, -1], L = Math.hypot(...dir), ux = dir[0] / L, uy = dir[1] / L;
  const len = pose === 'strike' ? 22 : 28;
  const head = [hand[0] + ux * (pose === 'walk' ? 30 : len - 10), hand[1] + uy * (pose === 'walk' ? 30 : len - 10), 6.5];
  const foot = pose === 'walk' ? [hand[0] + 0.6, GY - 1, 6.5] : [hand[0] - ux * 12, hand[1] - uy * 12, 6.5];
  vertebrae(S, foot, head, Math.round(Math.hypot(head[0] - foot[0], head[1] - foot[1]) / 2.6), 1.6);
  // The crook: a curl of shrinking vertebrae round a little skull.
  const nx = -uy, ny = ux; // perpendicular, toward the front
  const curl = [];
  for (let k = 0; k <= 7; k++) { const a = PI - k * PI / 5.2, rr = 5 - k * 0.2; curl.push([head[0] + nx * 4.4 + (nx * cos(a) - ux * sin(a)) * rr * -1, head[1] + ny * 4.4 + (ny * cos(a) - uy * sin(a)) * rr * -1, 6.5]); }
  curl.forEach((c, k) => S.add(sphere(c, 1.7 - k * 0.08, k % 2 ? 'boneDark' : 'bone'), 0.3));
  const sk = [head[0] + nx * 4.4 + ux * 1, head[1] + ny * 4.4 + uy * 1, 7];
  const skEyes = skull(S, sk, 3, 'bone', 0.5, 0.5);
  S.add(capsule([sk[0], sk[1] - 2.2, 7], [sk[0], sk[1] - 5, 7], 1.1, 1.1, 'habit'), 0.3);
  arm2(S, [cx + 4.4 + X, 29 + B, 3.4], [cx + 8 + X, 36 + B, 5], [hand[0] - 1, hand[1] + 1, 5.5], 'habit');
  S.add(ellipsoid(hand, [1.7, 2, 1.6], 'ash'), 0.6);
  // Far arm, tucked into the sleeve; it rises with the crozier on a cast.
  const far = pose === 'walk' ? [cx + 4 + X, 41 + B, 2] : [cx + 8 + X, 27 + B, 3];
  arm2(S, [cx - 4.4 + X, 29 + B, -3], [cx - 1 + X, 36 + B, 1], far, 'habitDark');
  // The tall cowl, drawn low over a gaunt grey face.
  const hx = cx + 1.6 + X * 1.4, hy = 17 + B;
  S.add(capsule([cx + X, 27 + B, 0], [hx - 0.4, hy + 3, 0], 3, 3, 'ashCloth'), 1);
  const hood = ellipsoid([hx, hy, 0.4], [5.6, 6.4, 5.2], 'ashCloth');
  S.add(hood, 1.6);
  S.add(capsule([hx - 2, hy - 3.6, -0.6], [hx - 5.2, hy - 9.4, -1.8], 3.4, 1, 'ashCloth'), 1.6);
  const fc = [hx + 3.2, hy + 1.4, 3.8], cut = ellipsoid(fc, [2.9, 3.6, 3.2], 'hollow');
  S.sub(cut, 0.6);
  S.paint({ mat: 'habit', f: (x, y, z) => Math.max(cut.f(x, y, z) - 0.9, -hood.f(x, y, z) - 0.7) });
  S.add(ellipsoid([fc[0] + 0.6, fc[1] + 1.6, fc[2] - 1.2], [1.8, 2.2, 1.6], 'ashDark'), 0.6);
  const f = Object.assign(render(S, RW, RH, MM, { ground: GY }), { ax: CX, ay: GY - 1 });
  eye(f, fc[0] - 0.6, fc[1] - 0.8, 'flame0', 'flame2'); eye(f, fc[0] + 1.8, fc[1] - 0.6, 'flame1');
  // The candle on the skull's crown and the skull's lit sockets.
  const cn = [sk[0], sk[1] - 7];
  eye(f, cn[0], cn[1], 'flame0', 'flame1'); free(f, cn[0], cn[1] - 2, pose === 'walk' ? 'flame2' : 'flame0');
  for (const [ex, ey] of skEyes) D(f, ex, ey, 'flame1');
  if (pose !== 'walk') for (const [a, r, c] of [[0.3, 6, 'flame1'], [1.9, 7, 'flame2'], [3.6, 6.5, 'flame0'], [5.0, 8, 'flame2']]) free(f, cn[0] + cos(a) * r, cn[1] + sin(a) * r, c);
  if (pose === 'strike') for (let k = 0; k < 4; k++) free(f, cn[0] + 6 + k * 3, cn[1] + 2 - k * 2 + (k % 2) * 2, k % 2 ? 'flame2' : 'flame0');
  return f;
}
function arm2(S, sh, el, hd, mat) { S.add(capsule(sh, el, 2.4, 2.1, mat), 1.2); S.add(capsule(el, hd, 2.1, 2.4, mat), 0.8); }

// ============================================================ the Wardens ===
// Frames 150x160, feet at 154, modelled at 1/1.25 scale (as in elite.mjs).
const WFRAME = { w: 150, h: 160, s: 1.25, gy: 110, ax: 70, ay: 154 };
function wshoot(S, gx) {
  const { w, h, s, gy, ax, ay } = WFRAME, dx = ax - gx * s, dy = ay - gy * s, T = new Scene();
  for (const p of S.prims) { const f = p.f, b = p.bb; T.prims.push({ ...p, k: p.k * s, bb: [b[0] * s + dx, b[1] * s + dy, b[2] * s, b[3] * s + dx, b[4] * s + dy, b[5] * s], f: (x, y, z) => s * f((x - dx) / s, (y - dy) / s, z / s) }); }
  for (const p of S.paints) { const f = p.f; T.paints.push({ mat: p.mat, f: (x, y, z) => f((x - dx) / s, (y - dy) / s, z / s) }); }
  const fr = render(T, w, h, MM, { ground: ay });
  fr.ax = ax; fr.ay = ay;
  const P = (x, y) => [x * s + dx, y * s + dy];
  return { f: fr, P, dot: (x, y, c) => dot(fr, ...P(x, y), c), free: (x, y, c) => { const [a, b] = P(x, y); if (under(fr, Math.floor(a), Math.floor(b)) < 0) dot(fr, a, b, c); } };
}

// The Ossuarch: a hunched giant built of skulls packed in bone, a crown of
// femurs on its great skull, arms so long it walks on its knuckles. It
// raises both fists and slams the floor.
const hsh = (k, s) => { let h = Math.imul(k * 374761393 + s * 668265263, 1274126177); h ^= h >>> 13; return ((Math.imul(h, 1103515245) >>> 0) % 1000) / 1000; };
function ossuarch(t = 0, atk = 0) {
  const S = new Scene(), cx = 54, B = atk ? 0 : bobAt(t) / 1.25;
  const L = atk === 1 ? -4 : atk === 2 ? -6 : atk === 3 ? 8 : 2;
  // The cairn it drags: a low heap of bone under the body.
  S.add(bumpy(skirt(cx - 2, 74 + B, 110, 14, 21, -1, 0.7, 'ashDark'), 1, 0.3, 5), 0);
  // A hunched trunk: broad round shoulders over a narrower belly.
  S.add(bumpy(ellipsoid([cx + L * 0.4, 70 + B, 0], [15, 14, 11], 'boneDeep'), 0.8, 0.3, 2), 3);
  S.add(bumpy(ellipsoid([cx + 2 + L * 0.8, 50 + B, 0], [21, 15, 13], 'boneDeep'), 0.8, 0.3, 4), 4);
  // Skulls packed into it, large and few, each turned its own way.
  const lit = [];
  const spots = [[-12, 44, 6.4], [-1, 41, 7], [11, 46, 6.2], [-7, 58, 6.8], [6, 59, 6], [17, 58, 5], [-14, 72, 6.2], [-2, 74, 6.6], [10, 76, 5.6], [-10, 92, 6.4], [3, 93, 6.2], [14, 96, 5.4], [-18, 102, 5.4]];
  spots.forEach(([dx, y, r], k) => {
    const up = y < 80 ? 1 : 0, lx = L * (y < 66 ? 0.8 : 0.4) * up;
    const R = y < 66 ? 13 : y < 85 ? 11 : 15, a = Math.asin(Math.max(-0.95, Math.min(0.95, dx / (R + 6))));
    const c = [cx + 2 * up + lx + dx, y + B * (y < 100 ? 1 : 0), cos(a) * (R - 1)];
    const e = skull(S, c, r, k % 3 ? 'bone' : 'boneDark', 1.4, Math.max(0.15, Math.min(0.85, 0.45 + hsh(k, 3) * 0.4 + sin(a) * 0.3)));
    if (hsh(k, 7) > 0.55) lit.push(...e);
  });
  // Loose long bones jutting from the heap.
  for (const [a0, a1] of [[[cx - 16, 86, 6], [cx - 25, 78, 4]], [[cx + 13, 88, 8], [cx + 22, 83, 9]], [[cx - 6, 104, 14], [cx + 4, 106, 16]]]) femur(S, a0, a1, 1.6, 'bone', 0.6);
  // Arms: a thick humerus, paired forearm bones, a fist of knuckle bones.
  const sh = [cx + 14 + L, 42 + B, 8], shB = [cx - 12 + L, 41 + B, -8];
  const g = stride(t / 4, 6, 4), gB = stride(t / 4 + 0.5, 6, 4);
  const fist = atk === 1 ? [cx + 4, -2, 10] : atk === 2 ? [cx - 2, -7, 10] : atk === 3 ? [cx + 40, 103, 12] : [cx + 30 + g.x, 103 - g.up, 12];
  const fistB = atk === 1 ? [cx - 12, 2, -6] : atk === 2 ? [cx - 16, -3, -6] : atk === 3 ? [cx + 30, 104, -4] : [cx - 2 + gB.x, 104 - gB.up, -10];
  for (const [s, f, near] of [[shB, fistB, false], [sh, fist, true]]) {
    const m = near ? 'bone' : 'boneDark';
    const up = atk === 1 || atk === 2;
    const el = [(s[0] + f[0]) / 2 + (up ? 14 : atk === 3 ? 2 : 9), (s[1] + f[1]) / 2 + (up ? 2 : -4), (s[2] + f[2]) / 2];
    S.add(bumpy(sphere(s, 8, m), 0.6, 0.4, near ? 3 : 4), 3);
    S.add(capsule(s, el, 5, 4, m), 1.5);
    S.add(sphere(el, 4.6, m), 1);
    for (const o of [-2, 2]) S.add(capsule([el[0], el[1], el[2] + o], [f[0], f[1], f[2] + o * 0.8], 2.8, 2.5, m), 0.8);
    S.add(bumpy(sphere(f, 6.4, m), 0.7, 0.6, near ? 1 : 2), 1.6);
    for (let k = 0; k < 4; k++) S.add(sphere([f[0] + 4.4, f[1] - 3.6 + k * 2.6, f[2] + 3.6 - k * 0.5], 2.2, m), 0.8);
  }
  // The great skull, low between the shoulders, jaw hanging; a crown of femurs.
  const hx = cx + 20 + L * 1.3, hy = 34 + B + (atk === 3 ? 8 : atk ? -2 : 0);
  S.add(capsule([cx + 6 + L, 46 + B, 0], [hx - 5, hy + 8, 0], 7, 5, 'boneDeep'), 3);
  S.add(ellipsoid([hx - 1, hy - 2.5, 5], [13.5, 10.5, 12], 'bone'), 1.5);
  const eyesH = skull(S, [hx, hy, 5], 12, 'bone', 1, 0.42);
  S.add(bumpy(ellipsoid([hx + 4, hy + 12 + (atk ? 2 : 0), 4], [7.4, 3, 7], 'boneDark'), 0.3, 0.8, 1), 1);
  S.sub(ellipsoid([hx + 8.5, hy + 9.6 + (atk ? 1 : 0), 6], [4, 1 + (atk ? 1.2 : 0), 3.4], 'hollow'), 0.4);
  for (let k = 0; k < 5; k++) S.paint({ mat: 'boneDeep', f: (x, y, z) => Math.max(Math.abs(x - (hx + 3 + k * 2.2)) - 0.45, Math.abs(y - (hy + 8.6)) - 1.6, -z + 8) });
  S.add(torus([hx - 1, hy - 9.6, 4], 10.6, 2.2, 0.35, 'goldDark'), 0.8);
  for (let k = 0; k < 7; k++) {
    const a = -1.45 + k * 0.48, bx = hx - 1 + sin(a) * 10.6, bz = 4 + cos(a) * 10.6, lean2 = sin(a) * 2.6;
    femur(S, [bx, hy - 10, bz], [bx + lean2, hy - 22 - (k % 2) * 4 + Math.abs(a) * 1.6, bz], 1.5, k % 2 ? 'boneDark' : 'bone', 0.5);
  }
  const o = wshoot(S, cx);
  for (const [ex, ey] of eyesH) { o.dot(ex, ey - 0.5, 'flame0'); o.dot(ex + 0.8, ey - 0.5, 'flame1'); o.dot(ex, ey + 0.6, 'flame2'); }
  for (const [ex, ey] of lit.slice(0, 6)) o.dot(ex, ey, 'flame2');
  if (atk === 3) for (let k = 0; k < 11; k++) { const a = PI + k * PI / 10; o.free(fist[0] + cos(a) * (12 + (k % 2) * 5), 108 + sin(a) * 6 - (k % 3), k % 2 ? 'bone2' : 'bone1'); }
  return o.f;
}

// The Ash Widow: a mourner as tall as a door in black lace, a high comb
// under her veil, swinging two censers on long chains. Ash trails behind.
function ashWidow(t = 0, atk = 0) {
  const S = new Scene(), cx = 58, B = atk ? 0 : Math.round(sin(t * PI / 2)) * 2 / 1.25;
  const lean = atk === 1 ? -3 : atk === 2 ? -1 : atk === 3 ? 4 : 0;
  // Gown: a long bell of lace with a scalloped, lighter hem.
  const top = 40 + B, hem = 110;
  S.add(rotZ(folds(skirt(cx, top, hem, 8, 23, 0, 0.75, 'lace'), { cx, n: 12, amp: 0.9, y0: top, y1: hem }), [cx, top], lean * 0.006), 1.2);
  S.add(folds(skirt(cx - 5, top + 6, hem, 6, 18, -6, 0.5, 'lace'), { cx: cx - 5, cz: -6, n: 8, amp: 0.8, y0: top, y1: hem }), 1.4);
  // Lace in two tiers: a scalloped band pierced with a row of round holes.
  const holes = (x, y, y0) => Math.hypot(((x + 4.5) % 9 + 9) % 9 - 4.5, y - y0) - 2.2;
  S.paint({ mat: 'laceLit', f: (x, y, z) => Math.max(95 + 2.4 * Math.abs(sin(x * PI / 8)) - y, -holes(x, y, 101.5), -z + 3) });
  // A narrow bodice and high shoulders.
  S.add(ellipsoid([cx + lean * 0.5, 34 + B, 0], [6.6, 10, 5], 'lace'), 2);
  S.add(ellipsoid([cx + lean * 0.7, 27 + B, 0], [9, 3.4, 5.6], 'lace'), 1.6);
  // Censers on chains: pendulums swung by the arms. Walking, the near one
  // hangs in front of her skirt and the far one behind it.
  const sw = atk ? 0 : sin(ph(t)) * 0.3;
  const arms = atk === 1 ? [[cx - 12, 40, 12], [cx - 16, 42, -9]] : atk === 2 ? [[cx - 2, 10, 10], [cx - 8, 12, -8]] : atk === 3 ? [[cx + 22, 44, 12], [cx + 18, 48, -8]] : [[cx + 15 + lean, 56 + B, 12], [cx - 13 + lean, 56 + B, -10]];
  const swingA = atk === 1 ? [2.35, 2.55] : atk === 2 ? [-1.95, -1.65] : atk === 3 ? [-0.25, -0.05] : [sw - 0.15, -sw + 0.25];
  const chainL = atk ? 24 : 22, cens = [];
  arms.forEach((hand, i) => {
    const near = i === 0, sh = [cx + (near ? 7 : -7) + lean, 28 + B, near ? 4 : -4];
    const el = [(sh[0] + hand[0]) / 2 + (atk === 2 ? 6 : near ? 3 : -1), (sh[1] + hand[1]) / 2 + (atk === 2 ? 0 : 2), (sh[2] + hand[2]) / 2 + 2];
    limb(S, sh, el, hand, 2.6, 2.6, 3.4, near ? 'lace' : 'veil', 1.2);
    S.paint({ mat: 'laceLit', f: (x, y, z) => Math.hypot(x - hand[0], y - hand[1], z - hand[2]) - 3.6 });
    S.add(sphere([hand[0] + 0.8, hand[1] + 1.6, hand[2]], 1.8, 'ash'), 0.6);
    // The chain, link by link, then the censer: a pierced iron ball, brass bands.
    const a = PI / 2 + swingA[i], start = [hand[0] + 0.8, hand[1] + 2.4, hand[2]], end = [start[0] + cos(a) * chainL, start[1] + sin(a) * chainL, hand[2]];
    const n = Math.round(chainL / 2.2);
    for (let k = 0; k < n; k++) { const u0 = k / n, u1 = (k + 1) / n; S.add(capsule([start[0] + (end[0] - start[0]) * u0, start[1] + (end[1] - start[1]) * u0, hand[2]], [start[0] + (end[0] - start[0]) * u1, start[1] + (end[1] - start[1]) * u1, hand[2]], k % 2 ? 0.8 : 1.05, k % 2 ? 0.8 : 1.05, k % 2 ? 'brass' : 'censer'), 0); }
    const cc = [end[0] + cos(a) * 4.6, end[1] + sin(a) * 4.6, hand[2]];
    S.add(sphere(cc, 5, 'censer'), 0);
    S.add(capsule([cc[0] - cos(a) * 4.6, cc[1] - sin(a) * 4.6, cc[2]], [cc[0] - cos(a) * 6.6, cc[1] - sin(a) * 6.6, cc[2]], 2, 1, 'brass'), 0.4);
    S.paint({ mat: 'brass', f: (x, y, z) => Math.max(Math.abs((x - cc[0]) * cos(a) + (y - cc[1]) * sin(a)) - 0.9, Math.hypot(x - cc[0], y - cc[1], z - cc[2]) - 5.6) });
    for (const s of [-1, 1]) S.sub(sphere([cc[0] - sin(a) * 2.4 * s + cos(a) * 1.6, cc[1] + cos(a) * 2.4 * s + sin(a) * 1.6, cc[2] + 4.2], 1.3, 'hollow'), 0.3);
    cens.push({ cc, a });
  });
  // Head: small under a tall comb and a veil that falls past the waist.
  const hx = cx + 2 + lean * 1.2, hy = 18 + B;
  S.add(capsule([cx + lean, 28 + B, 0], [hx, hy + 4, 0.5], 2.6, 2.8, 'lace'), 1.2);
  S.add(ellipsoid([hx + 0.6, hy, 1], [4.6, 5.4, 4.4], 'veil'), 1);
  // A lace shawl over the shoulders.
  S.add(folds(skirt(cx + lean * 0.7, 25 + B, 36 + B, 6, 11, 0, 0.8, 'lace'), { cx, n: 10, amp: 0.5, y0: 25, y1: 36 }), 1.2);
  S.paint({ mat: 'laceLit', f: (x, y, z) => Math.max(Math.abs(y - (34.4 + B) - 1.2 * Math.abs(sin(x * 0.7))) - 1.2, -z + 1) });
  S.add(rotZ(ellipsoid([hx - 1.6, hy - 9, -1.5], [6.4, 6, 1.4], 'brass'), [hx - 1.6, hy - 9], -0.1), 1.2);
  S.add(clip(folds(skirt(hx - 1.2, hy - 15, 64 + B, 5.4, 15, -1, 0.9, 'veil'), { cx: hx - 1.2, cz: -1, n: 9, amp: 0.6, y0: hy - 8, y1: 64 }), (x, y, z) => z - 2.6 + (y < hy + 6 ? 0 : -1) + (x > hx + 3 && y < hy + 8 ? 9 : 0)), 1.2);
  const o = wshoot(S, cx);
  // Two pale points behind the veil; embers in the censers, ash trailing behind.
  o.dot(hx + 2.6, hy - 0.4, 'cloth1'); o.dot(hx + 5, hy - 0.2, 'cloth2');
  cens.forEach(({ cc, a }, i) => {
    for (const s of [-1, 1]) o.dot(cc[0] - sin(a) * 2.4 * s + cos(a) * 1.6, cc[1] + cos(a) * 2.4 * s + sin(a) * 1.6, 'ember1');
    const back = atk === 3 ? -1 : 1;
    for (let k = 0; k < 6; k++) o.free(cc[0] - back * (5 + k * 2.6), cc[1] - 3 - k * 1.6 + ((k + i + Math.floor(t)) % 2) * 1.6, k < 2 ? 'ember2' : k % 2 ? 'stone2' : 'stone3');
  });
  return o.f;
}

// ================================================================ export ===
const mon_common = {}, mon_rare = {}, mon_warden = {};
for (const [id, fn, flat] of [['gleaner', gleaner, false], ['cinderMoth', cinderMoth, true]]) {
  const r = reactions(() => fn(0), 0, flat);
  mon_common[`${id}_walk`] = () => HALF.map((t) => fn(t));
  mon_common[`${id}_attack`] = () => [fn(0, 0), fn(0, 1)];
  mon_common[`${id}_hit`] = r.hit; mon_common[`${id}_die`] = r.die;
}
{
  const r = reactions(() => abbot({}), 0.3);
  mon_rare.abbot_walk = () => HALF.map((t) => { const g = gait(t); return abbot({ t, bob: g.bob, sw: g.sw, swB: g.swB, lift: g.lift }); });
  mon_rare.abbot_attack = () => [abbot({ pose: 'windup' }), abbot({ pose: 'windup', bob: -2 }), abbot({ pose: 'strike', bob: 0 })];
  mon_rare.abbot_hit = r.hit; mon_rare.abbot_die = r.die;
}
for (const [id, fn] of [['ossuarch', ossuarch], ['ashWidow', ashWidow]]) {
  const r = reactions(() => fn(0, 0), 0.8);
  mon_warden[`${id}_walk`] = () => HALF.map((t) => fn(t, 0));
  mon_warden[`${id}_attack`] = () => [1, 2, 3].map((a) => fn(0, a));
  mon_warden[`${id}_hit`] = r.hit; mon_warden[`${id}_die`] = r.die;
}
export default { mon_common, mon_rare, mon_warden };
