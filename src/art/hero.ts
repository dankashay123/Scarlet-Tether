import { Figure, KEY_LIGHT, folds, grain, ramp, type Material } from './render';
import { PixelCanvas, hash2, valueNoise } from './pixel';
import { mixPose, runCycle, solve, type Pose, type Proportions } from './rig';
import { SheetBuilder } from './sheet';

// ---------------------------------------------------------------------------
// The Severed: a citizen of Sanctum in torn ivory, soaked to the knee.
// ---------------------------------------------------------------------------

export interface CitizenLook {
  skin: string;
  hair: string;
  hairStyle: number; // 0 short, 1 long, 2 shorn, 3 tied
  robe: string;
  trim: string;
  maw: boolean;
  helix: boolean;
}

export const FW = 112;
export const FH = 96;
export const FOOT_Y = 90;
const K = 1.25; // body scale

const PR: Proportions = { torso: 17 * K, neck: 4 * K, thigh: 12 * K, shin: 12 * K, upperArm: 10 * K, foreArm: 10 * K, shoulderBack: 1 };

const SKIN_RAMPS: Record<string, string[]> = {};
function skinMat(base: string): Material {
  const r =
    SKIN_RAMPS[base] ??
    (SKIN_RAMPS[base] = ramp(['#140709', shade(base, -0.6), shade(base, -0.35), shade(base, -0.12), base, shade(base, 0.2)], 7));
  return { ramp: r, spec: 0.3, tex: grain(1.5, 0.05, 3) };
}

export function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (t < 0) {
    // Shadows go cooler and toward bruise-red, not grey
    r = r * (1 + t) + 30 * -t;
    g = g * (1 + t * 1.15);
    b = b * (1 + t * 0.9) + 14 * -t;
  } else {
    r = r + (255 - r) * t;
    g = g + (245 - g) * t;
    b = b + (225 - b) * t;
  }
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export const BLOOD: Material = { ramp: ['#2a0208', '#4e0815', '#7a0c1c', '#a8122a', '#d0262f', '#ff5a4a'], spec: 0.9, round: 0.4 };
export const OLD_BLOOD: Material = { ramp: ['#1e070a', '#34090f', '#4e1018', '#6a1a1e', '#83292a'], spec: 0.15, round: 0.3 };

function robeMat(base: string, t: number): Material {
  return { ramp: ramp(['#18100f', shade(base, -0.66), shade(base, -0.45), shade(base, -0.26), shade(base, -0.1), base, shade(base, 0.2)], 8), tex: folds(2.4, 0.22, 4, t * Math.PI * 2), round: 0.7 };
}

const ROPE: Material = { ramp: ['#1a0e08', '#3b2414', '#5e3a1e', '#7d5530', '#9a7048'], tex: (x, y) => ((x + y) % 3 === 0 ? -0.18 : 0.05) };
const WRAP: Material = { ramp: ['#1a1210', '#3a2e28', '#6a5a4a', '#8f7c66', '#b0a088'], tex: (x, y) => ((x * 2 + y) % 4 === 0 ? -0.2 : 0.04), round: 0.8 };

function trimMat(c: string): Material {
  return { ramp: ramp(['#1a1206', shade(c, -0.6), shade(c, -0.3), c, shade(c, 0.45)], 5), spec: 0.8, round: 0.3 };
}

function hairMat(c: string): Material {
  return { ramp: ramp(['#0b0507', shade(c, -0.6), shade(c, -0.35), shade(c, -0.1), c, shade(c, 0.3)], 6), tex: (x, y) => Math.sin(x * 1.7 + y * 0.5) * 0.14, round: 0.7 };
}

export const IRON: Material = { ramp: ['#0e0d10', '#26252b', '#3d3c44', '#5b5a63', '#87868f', '#c4c3c8'], spec: 0.9, tex: grain(1.5, 0.12, 7), round: 0.9 };
export const RUST: Material = { ramp: ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22', '#b06a36'], spec: 0.2, tex: grain(1.5, 0.15, 9) };

interface HeroOpts {
  look: CitizenLook;
  pose: Pose;
  hurt?: boolean;
}

/** Draw one frame of the Severed. Returns the canvas and the front hand position. */
export function drawHero(o: HeroOpts): { pc: PixelCanvas; hand: [number, number] } {
  const f = new Figure(FW, FH);
  const { look, pose } = o;
  const j = solve(pose, PR);
  const skin = skinMat(look.skin);
  const skinBack: Material = { ...skin, ramp: skin.ramp.map((c) => shade(c, -0.3)) };
  const robe = robeMat(look.robe, pose.t);
  const robeBack: Material = { ...robe, ramp: robe.ramp.map((c) => shade(c, -0.35)) };
  const cape: Material = { ...robeMat(shade(look.robe, -0.35), pose.t + 0.3) };
  const trim = trimMat(look.trim);
  const hair = hairMat(look.hair);
  const wave = Math.sin(pose.t * Math.PI * 2);

  // --- Tattered shoulder cape streaming behind ------------------------------
  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  const capeLen = 24 * K;
  // Cape: a wide ragged sheet hanging from both shoulders, streaming back
  const capeTop: [number, number][] = [
    [sx + 3, sy - 2],
    [sx - 6, sy - 1],
  ];
  const capeBack: [number, number][] = [];
  const capeTail = 7;
  for (let i = 0; i <= capeTail; i++) {
    const t = i / capeTail;
    const drift = t * (6 + Math.max(0, pose.lean) * 14) + wave * 2.5 * t;
    capeBack.push([sx - 7 - drift - t * 3, sy + t * capeLen]);
  }
  const capeHem: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    const last = capeBack[capeBack.length - 1];
    capeHem.push([last[0] + t * 9, last[1] + (i % 2 ? 4 : -2) + hash2(i, 9, 2) * 3]);
  }
  f.poly([...capeTop, ...capeBack, ...capeHem, [sx - 1, sy + capeLen * 0.55]], cape, 0.5);

  // --- Back arm & leg ---------------------------------------------------------
  f.capsule(sx, sy, j.elbowB[0], j.elbowB[1], 3.2, 2.7, robeBack, 1);
  f.capsule(j.elbowB[0], j.elbowB[1], j.handB[0], j.handB[1], 2.4, 2.0, skinBack, 1);
  f.ellipse(j.handB[0], j.handB[1], 2.7, 2.9, skinBack, 1);
  f.capsule(hx, hy, j.kneeB[0], j.kneeB[1], 4.4, 3.4, skinBack, 2);
  f.capsule(j.kneeB[0], j.kneeB[1], j.footB[0], j.footB[1], 3.2, 2.3, skinBack, 2);
  f.capsule(j.footB[0] - 1, j.footB[1], j.footB[0] + 5, j.footB[1] + 0.5, 2.1, 1.7, skinBack, 2);
  f.capsule(j.kneeB[0] + (j.footB[0] - j.kneeB[0]) * 0.55, j.kneeB[1] + (j.footB[1] - j.kneeB[1]) * 0.55, j.footB[0], j.footB[1] - 1, 3.0, 2.6, { ...WRAP, ramp: WRAP.ramp.map((c) => shade(c, -0.3)) }, 2.1);

  // --- Robe -------------------------------------------------------------------
  const kneeMidX = (j.kneeF[0] + j.kneeB[0]) / 2;
  const hemY = Math.max(j.kneeF[1], j.kneeB[1]) + 7;
  const sway = wave * 2;
  const front = Math.max(j.kneeF[0], j.kneeB[0]) + 5;
  const back = Math.min(j.kneeF[0], j.kneeB[0]) - 6 + sway;
  const hem: [number, number][] = [];
  const teeth = 9;
  for (let i = 0; i <= teeth; i++) {
    const t = i / teeth;
    const x = front + (back - front) * t;
    const rag = (hash2(i, 3, 11) - 0.3) * 7 + (i % 2) * 3;
    hem.push([x, hemY + rag - (t * 2 - 1) * 2]);
  }
  const robePts: [number, number][] = [
    [sx + 6, sy + 1],
    [hx + 7.5, hy - 3],
    [Math.max(hx + 8.5, kneeMidX + 3), hy + 7],
    ...hem,
    [Math.min(hx - 8.5, back + 1), hy + 5],
    [hx - 8.5, hy - 5],
    [sx - 6, sy + 2],
    [sx - 2.5, sy - 2],
    [sx + 2.5, sy - 2],
  ];
  f.poly(robePts, robe, 4);
  f.capsule(hx - 8, hy - 4, hx + 8, hy - 4.5, 1.6, 1.6, ROPE, 4.5);
  f.capsule(hx + 4, hy - 4, hx + 6.5, hy + 8 + sway, 1.1, 0.8, ROPE, 4.6);
  f.ellipse(hx + 6.5, hy + 9 + sway, 1.4, 1.6, ROPE, 4.6);
  f.capsule(sx - 4, sy - 0.5, sx + 4.5, sy + 1, 1.5, 1.5, trim, 4.4);
  // Gold embroidered cross on the breast (Sanctum's sigil, half-drowned in blood)
  f.capsule(sx + 3, sy + 4, sx + 3, sy + 11, 0.8, 0.8, trim, 4.42);
  f.capsule(sx + 0.5, sy + 6.5, sx + 5.5, sy + 6.5, 0.8, 0.8, trim, 4.42);

  if (look.maw) {
    const cx = sx + 3;
    const cy = sy + 9;
    f.ellipse(cx, cy, 3.2, 4.4, { ramp: ['#120204', '#3a0610', '#7a1020', '#b8302a', '#c8e05a', '#f0ff9a'], round: -1 }, 4.7);
    f.ellipse(cx, cy, 1.3, 2.3, { ramp: ['#000000', '#1a0306'], round: 0 }, 4.8);
    for (let i = 0; i < 5; i++) f.ellipse(cx - 2.6 + i * 1.3, cy - 3.6 + (i % 2) * 7.2, 0.6, 0.9, { ramp: ['#5f4e35', '#cdb889', '#efe3bf'] }, 4.85);
  }

  // --- Front leg ----------------------------------------------------------------
  f.capsule(j.kneeF[0], j.kneeF[1], j.footF[0], j.footF[1], 3.4, 2.4, skin, 5);
  f.capsule(j.footF[0] - 1, j.footF[1], j.footF[0] + 5.5, j.footF[1] + 0.5, 2.2, 1.8, skin, 5);
  f.capsule(j.kneeF[0] + (j.footF[0] - j.kneeF[0]) * 0.55, j.kneeF[1] + (j.footF[1] - j.kneeF[1]) * 0.55, j.footF[0], j.footF[1] - 1, 3.2, 2.8, WRAP, 5.1);

  // --- Head -------------------------------------------------------------------------
  const [nx, ny] = j.neck;
  const [hdx0, hdy0] = j.head;
  const hdx = hdx0 + 1;
  const hdy = hdy0 - 1.5;
  f.capsule(nx, ny + 3, nx + 0.5, ny - 1, 2.6, 2.4, skin, 6);
  f.ellipse(hdx, hdy, 6.4, 7.4, skin, 7, pose.head * 0.6);
  f.ellipse(hdx + 3.2, hdy + 4.0, 3.2, 2.7, skin, 7.1);
  f.ellipse(hdx + 6.3, hdy + 0.6, 1.3, 1.8, skin, 7.2);
  f.ellipse(hdx - 1.0, hdy + 0.8, 1.6, 2.2, { ...skin, ramp: skin.ramp.map((c) => shade(c, -0.15)) }, 7.15);
  const hs = look.hairStyle;
  if (hs !== 2) {
    f.ellipse(hdx - 1.4, hdy - 2.6, 6.6, 5.6, hair, 7.5);
    if (hs === 1) f.poly([[hdx - 6.8, hdy - 2.5], [hdx - 1.2, hdy - 2.5], [hdx - 2.5, hdy + 13 + wave * 2], [hdx - 8, hdy + 11]], hair, 6.9);
    if (hs === 3) f.ellipse(hdx - 7, hdy - 2, 2.8, 2.8, hair, 7.6);
    if (hs === 0) f.ellipse(hdx - 4.2, hdy + 2, 3, 4, hair, 7.4);
  } else {
    f.ellipse(hdx - 1.8, hdy - 4, 5.4, 3.2, { ...hair, ramp: hair.ramp.map((c) => shade(c, -0.25)) }, 7.3);
  }
  // Hollow eye, weeping blood down the cheek; thin mouth
  f.stain((x, y) => Math.abs(x - (hdx + 3.4)) < 1.4 && Math.abs(y - (hdy - 0.4)) < 1.0, { ramp: ['#0b0507', '#2a0a0e'] }, [skin]);
  f.stain((x, y) => Math.abs(x - (hdx + 3.3)) < 0.75 && y > hdy + 0.4 && y < hdy + 7, BLOOD, [skin]);
  f.stain((x, y) => Math.abs(y - (hdy + 4.6)) < 0.5 && x > hdx + 3.6 && x < hdx + 6, { ramp: ['#2a0a0e', '#4a1a1a'] }, [skin]);

  // --- Front arm ----------------------------------------------------------------------
  f.capsule(sx, sy, j.elbowF[0], j.elbowF[1], 3.5, 2.9, robe, 9);
  f.capsule(j.elbowF[0], j.elbowF[1], j.handF[0], j.handF[1], 2.5, 2.1, skin, 9);
  f.ellipse(j.handF[0], j.handF[1], 2.9, 3.1, skin, 9.2);
  // An iron shackle at the wrist: the Severed Tether is bolted on
  const wx = j.elbowF[0] + (j.handF[0] - j.elbowF[0]) * 0.78;
  const wy = j.elbowF[1] + (j.handF[1] - j.elbowF[1]) * 0.78;
  f.ellipse(wx, wy, 3.0, 3.0, IRON, 9.4);
  f.ellipse(wx, wy, 1.4, 1.4, RUST, 9.45);
  // Forearm wrappings
  f.capsule(j.elbowF[0] + (j.handF[0] - j.elbowF[0]) * 0.15, j.elbowF[1] + (j.handF[1] - j.elbowF[1]) * 0.15, j.elbowF[0] + (j.handF[0] - j.elbowF[0]) * 0.55, j.elbowF[1] + (j.handF[1] - j.elbowF[1]) * 0.55, 2.8, 2.5, WRAP, 9.3);
  if (look.helix) {
    const ex = j.elbowF[0] + (j.handF[0] - j.elbowF[0]) * 0.4;
    const ey = j.elbowF[1] + (j.handF[1] - j.elbowF[1]) * 0.4;
    f.ellipse(ex, ey - 1, 3.2, 4.0, { ramp: ['#2a0a10', '#6a2030', '#a8505a', '#d8908a', '#f2c0b0'], spec: 0.5 }, 9.5);
    f.ellipse(ex + 0.5, ey - 0.8, 1.4, 2.1, { ramp: ['#0b0507', '#3a0a12'], round: 0 }, 9.6);
  }

  // --- Gore ---------------------------------------------------------------------------
  f.stain((x, y) => y > hemY - 11 + valueNoise(x, 0, 3, 5) * 8, OLD_BLOOD, [robe, robeBack, cape]);
  f.stain((x, y) => y > hemY - 4 + valueNoise(x, 1, 2, 6) * 4, BLOOD, [robe, robeBack, cape]);
  f.stain((x, y) => valueNoise(x, y, 2.2, 21) > 0.76 && y < hemY - 10, OLD_BLOOD, [robe, robeBack, cape]);
  f.stain((x, y) => valueNoise(x, y, 1.6, 33) > 0.84, BLOOD, [robe]);
  f.stain((x, y) => Math.hypot(x - j.handF[0], y - j.handF[1]) < 2.6 && hash2(x | 0, y | 0, 4) < 0.65, BLOOD, [skin]);
  f.stain((x, y) => y > FOOT_Y - 3 && hash2(x | 0, y | 0, 8) < 0.5, BLOOD, [skin, skinBack, WRAP]);
  f.stain((x, y) => valueNoise(x, y, 1.5, 51) > 0.7, OLD_BLOOD, [WRAP]);
  if (o.hurt) f.stain((x, y) => valueNoise(x, y, 2, 40) > 0.6, BLOOD);

  const pc = f.render({ ...KEY_LIGHT, ambient: 0.12, rim: 0.7 });
  return { pc, hand: [Math.round(j.handF[0]), Math.round(j.handF[1])] };
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

const HX = 52;
const HY = FOOT_Y - 30;
export const STAND: Pose = {
  x: HX,
  y: HY,
  lean: 0.04,
  head: 0.05,
  armF: { a: 0.15, b: 0.35 },
  armB: { a: -0.1, b: 0.3 },
  legF: { a: 0.12, b: 0.08 },
  legB: { a: -0.12, b: 0.1 },
  t: 0,
};

function idle(i: number): Pose {
  const b = Math.sin((i / 4) * Math.PI * 2);
  return { ...STAND, y: HY + (b > 0 ? 0 : 1), lean: 0.06 + b * 0.02, head: 0.1 + b * 0.04, armF: { a: 0.18 + b * 0.04, b: 0.4 }, t: i / 4 };
}

/** Attack keyframes: arm sweeps for the chain (the chain itself is drawn live). */
const ATTACK_POSES: Record<string, Pose[]> = {
  a1: [
    { ...STAND, lean: -0.12, armF: { a: -2.2, b: -0.4 }, armB: { a: 0.4, b: 0.4 }, legF: { a: 0.45, b: 0.2 }, legB: { a: -0.35, b: 0.2 } },
    { ...STAND, lean: 0.3, armF: { a: 1.4, b: 0.15 }, armB: { a: -0.5, b: 0.5 }, legF: { a: 0.55, b: 0.35 }, legB: { a: -0.45, b: 0.25 } },
    { ...STAND, lean: 0.22, armF: { a: 0.9, b: 0.5 }, armB: { a: -0.3, b: 0.4 }, legF: { a: 0.45, b: 0.3 }, legB: { a: -0.4, b: 0.2 } },
  ],
  a2: [
    { ...STAND, lean: 0.25, armF: { a: 1.6, b: 0.6 }, armB: { a: -0.6, b: 0.3 }, legF: { a: 0.45, b: 0.3 }, legB: { a: -0.4, b: 0.2 } },
    { ...STAND, lean: -0.05, armF: { a: -1.0, b: -0.6 }, armB: { a: 0.6, b: 0.5 }, legF: { a: 0.3, b: 0.2 }, legB: { a: -0.5, b: 0.3 } },
    { ...STAND, lean: 0.05, armF: { a: -0.6, b: -0.3 }, armB: { a: 0.4, b: 0.4 }, legF: { a: 0.3, b: 0.15 }, legB: { a: -0.4, b: 0.2 } },
  ],
  a3: [
    { ...STAND, y: HY + 2, lean: -0.25, armF: { a: -2.9, b: 0.1 }, armB: { a: -2.6, b: 0.2 }, legF: { a: 0.35, b: 0.4 }, legB: { a: -0.45, b: 0.4 } },
    { ...STAND, y: HY + 4, lean: 0.55, armF: { a: 1.2, b: 0.2 }, armB: { a: 1.0, b: 0.3 }, legF: { a: 0.7, b: 0.7 }, legB: { a: -0.5, b: 0.2 } },
    { ...STAND, y: HY + 4, lean: 0.5, armF: { a: 0.6, b: 0.4 }, armB: { a: 0.5, b: 0.4 }, legF: { a: 0.65, b: 0.65 }, legB: { a: -0.5, b: 0.25 } },
  ],
  up: [
    { ...STAND, lean: 0.1, armF: { a: 0.6, b: 0.4 }, legF: { a: 0.3, b: 0.2 }, legB: { a: -0.3, b: 0.2 } },
    { ...STAND, lean: -0.2, armF: { a: -2.9, b: -0.1 }, armB: { a: 0.3, b: 0.4 }, legF: { a: 0.2, b: 0.1 }, legB: { a: -0.3, b: 0.1 } },
  ],
  charge: [{ ...STAND, y: HY + 3, lean: -0.3, armF: { a: -2.5, b: -0.5 }, armB: { a: -2.2, b: -0.3 }, legF: { a: 0.55, b: 0.6 }, legB: { a: -0.55, b: 0.4 } }],
};

function slide(i: number): Pose {
  // A low, desperate dive-roll
  const t = i / 4;
  return {
    ...STAND,
    y: HY + 12 - Math.sin(t * Math.PI) * 2,
    lean: 1.2 - t * 0.2,
    head: 0.3,
    armF: { a: 1.6, b: 0.6 },
    armB: { a: 1.2, b: 0.8 },
    legF: { a: -0.2 - t * 0.4, b: 1.3 },
    legB: { a: -0.9, b: 1.2 },
    t,
  };
}

function jumpPose(kind: 'up' | 'fall', i: number): Pose {
  if (kind === 'up')
    return { ...STAND, y: HY - 1, lean: 0.12, armF: { a: -0.6, b: 0.8 }, armB: { a: 0.9, b: 0.4 }, legF: { a: 0.7, b: 1.2 }, legB: { a: -0.2, b: 0.4 }, t: i * 0.3 };
  return { ...STAND, y: HY - 1, lean: 0.05, armF: { a: -1.3 - i * 0.2, b: -0.3 }, armB: { a: -1.0, b: -0.2 }, legF: { a: 0.35, b: 0.5 }, legB: { a: -0.25, b: 0.3 }, t: 0.5 + i * 0.3 };
}

function deathPose(i: number): Pose {
  const t = i / 3;
  return {
    ...STAND,
    y: HY + t * 18,
    lean: -0.2 - t * 1.25,
    head: -0.4 * t,
    armF: { a: -0.6 - t, b: 0.4 },
    armB: { a: -1.0 - t, b: 0.2 },
    legF: { a: 0.3 + t * 1.2, b: 0.8 - t * 0.6 },
    legB: { a: 0.1 + t, b: 0.5 },
    t,
  };
}

const HURT: Pose = { ...STAND, lean: -0.35, head: -0.35, armF: { a: -0.6, b: 0.9 }, armB: { a: -0.9, b: 0.6 }, legF: { a: 0.4, b: 0.3 }, legB: { a: -0.2, b: 0.3 }, t: 0.2 };
const KNEEL: Pose = { ...STAND, y: HY + 9, lean: 0.35, head: 0.45, armF: { a: 0.9, b: 1.6 }, armB: { a: 0.7, b: 1.6 }, legF: { a: 1.5, b: 1.5 }, legB: { a: -0.3, b: 1.9 }, t: 0.3 };

export interface HeroMeta {
  /** Front hand position per frame index, for the live-drawn chain. */
  hands: [number, number][];
}

export const heroMeta: HeroMeta = { hands: [] };

export function buildHeroSheet(scene: Phaser.Scene, look: CitizenLook, key = 'player') {
  const sb = new SheetBuilder(key);
  const hands: [number, number][] = [];
  const add = (name: string, poses: Pose[], fps: number, repeat = -1, hurt = false) => {
    const frames = poses.map((p) => {
      const r = drawHero({ look, pose: p, hurt });
      hands.push(r.hand);
      return r.pc;
    });
    sb.add(name, frames, fps, repeat);
  };
  add('idle', [0, 1, 2, 3].map(idle), 5);
  add('run', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => runCycle(STAND, i / 8, 0.62, 0.95)), 13);
  add('sneak', [0, 1, 2, 3, 4, 5].map((i) => ({ ...runCycle({ ...STAND, y: HY + 4 }, i / 6, 0.45, 0.6), lean: 0.4, head: 0.3 })), 8);
  add('jump', [jumpPose('up', 0), jumpPose('up', 1)], 8);
  add('fall', [jumpPose('fall', 0), jumpPose('fall', 1)], 8);
  for (const k of ['a1', 'a2', 'a3', 'up'] as const) {
    ATTACK_POSES[k].forEach((p, i) => add(`${k}-${i}`, [p], 1, 0));
  }
  add('charge', ATTACK_POSES.charge, 1, 0);
  add('slide', [0, 1, 2, 3].map(slide), 14, 0);
  add('hurt', [HURT], 1, 0, true);
  add('kneel', [KNEEL], 1, 0);
  add('raise', [{ ...STAND, lean: -0.15, head: -0.3, armF: { a: -2.8, b: 0 }, armB: { a: -2.5, b: 0.1 }, t: 0.1 }], 1, 0);
  add('die', [0, 1, 2, 3].map(deathPose), 7, 0, true);
  add('air-attack', [mixPose(jumpPose('fall', 0), ATTACK_POSES.a3[1], 0.6)], 1, 0);
  sb.build(scene);
  heroMeta.hands = hands;
}

/** Interpolated preview of a pose for debug galleries. */
export { mixPose };
