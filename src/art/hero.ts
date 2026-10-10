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

const ROPE: Material = { ramp: ['#1a0e08', '#3b2414', '#5e3a1e', '#7d5530', '#9a7048'], tex: (x, y) => ((x + y) % 3 === 0 ? -0.18 : 0.05) };

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

const OLD_BONE: Material = { ramp: ['#2a2018', '#5f4e35', '#a8946a', '#d8c8a0'], spec: 0.4 };
const EYE_GLINT: Material = { ramp: ['#3a0a0e', '#8a1a1a', '#d84a3a'], round: 0 };

/** Bandage strips with diagonal bindings. */
function wrapMat(r: string[]): Material {
  return { ramp: r, tex: (x, y) => ((x + y * 2) % 5 === 0 ? -0.28 : (x * 3 + y) % 7 === 0 ? 0.08 : 0), round: 0.85 };
}
const WRAP_RAMP = ['#0e0a0a', '#221a1a', '#3a2e2a', '#54453c', '#706052', '#8c7a66'];
const UNDER_RAMP = ['#0b080a', '#151013', '#1f171b', '#2a1f24', '#372830', '#46323a', '#5a4048'];

/** The concept's crimson: a light or grey robe tone is pulled back toward it. */
function cloakTone(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r > 90 && r > g * 2 && r > b * 1.6 ? hex : '#9a1626';
}

interface HeroPalette {
  skin: Material;
  skinBack: Material;
  skinShade: Material;
  robe: Material;
  cloak: Material;
  hood: Material;
  hoodIn: Material;
  under: Material;
  underBack: Material;
  wrap: Material;
  wrapBack: Material;
  hair: Material;
}

const RAMP_CACHE = new Map<string, string[]>();
const cachedRamp = (key: string, make: () => string[]) => {
  let r = RAMP_CACHE.get(key);
  if (!r) RAMP_CACHE.set(key, (r = make()));
  return r;
};

function heroPalette(look: CitizenLook): HeroPalette {
  const skin = skinMat(look.skin);
  const base = cloakTone(look.robe);
  const crimson = cachedRamp('c' + base, () => ramp(['#12060a', shade(base, -0.7), shade(base, -0.5), shade(base, -0.3), shade(base, -0.12), base, shade(base, 0.18)], 8));
  const cloakR = cachedRamp('k' + base, () => crimson.map((c) => shade(c, -0.16)));
  const shadeR = cachedRamp('s' + look.skin, () => ramp(['#0b0507', shade(look.skin, -0.78), shade(look.skin, -0.62)], 4));
  const clothTex = folds(2.4, 0.2, 4);
  return {
    skin,
    skinBack: { ...skin, ramp: cachedRamp('b' + look.skin, () => skin.ramp.map((c) => shade(c, -0.3))) },
    skinShade: { ramp: shadeR, round: 0.6 },
    robe: { ramp: crimson, tex: clothTex, round: 0.75 },
    cloak: { ramp: cloakR, tex: folds(2.2, 0.26, 7), round: 0.55 },
    hood: { ramp: crimson, tex: grain(2, 0.06, 5), round: 0.9 },
    hoodIn: { ramp: ['#060203', '#12060a', '#1e0a10', shade(base, -0.72)], round: 0.2 },
    under: { ramp: UNDER_RAMP, tex: folds(2.6, 0.16, 2), round: 0.7 },
    underBack: { ramp: cachedRamp('ub', () => UNDER_RAMP.map((c) => shade(c, -0.3))), round: 0.7 },
    wrap: wrapMat(WRAP_RAMP),
    wrapBack: wrapMat(cachedRamp('wb', () => WRAP_RAMP.map((c) => shade(c, -0.35)))),
    hair: hairMat(look.hair),
  };
}

/**
 * Polygon part with a scanline mask: crossings are computed once per row
 * instead of testing every edge for every pixel (Figure.poly), which keeps
 * the big cloth shapes cheap.
 */
function fillPoly(f: Figure, pts: [number, number][], m: Material, layer: number) {
  const n = pts.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    xs[i] = pts[i][0];
    ys[i] = pts[i][1];
    x0 = Math.min(x0, xs[i]);
    y0 = Math.min(y0, ys[i]);
    x1 = Math.max(x1, xs[i]);
    y1 = Math.max(y1, ys[i]);
  }
  const cross = new Float64Array(n);
  let nc = 0;
  let rowY = NaN;
  f.add(
    (x, y) => {
      if (y !== rowY) {
        rowY = y;
        nc = 0;
        for (let i = 0, k = n - 1; i < n; k = i++) {
          const yi = ys[i];
          const yk = ys[k];
          if (yi > y !== yk > y) cross[nc++] = ((xs[k] - xs[i]) * (y - yi)) / (yk - yi) + xs[i];
        }
      }
      let inside = false;
      for (let i = 0; i < nc; i++) if (x < cross[i]) inside = !inside;
      return inside;
    },
    m,
    layer,
    [x0, y0, x1, y1],
  );
}

/** Draw one frame of the Severed. Returns the canvas and the front hand position. */
export function drawHero(o: HeroOpts): { pc: PixelCanvas; hand: [number, number] } {
  const f = new Figure(FW, FH);
  const { look, pose } = o;
  const j = solve(pose, PR);
  const pal = heroPalette(look);
  const { skin, skinBack, robe, cloak, hood, hoodIn, under, underBack, wrap, wrapBack, hair } = pal;
  const trim = trimMat(look.trim);
  const wave = Math.sin(pose.t * Math.PI * 2);
  const wave2 = Math.cos(pose.t * Math.PI * 2);

  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  const [nx, ny] = j.neck;
  // Body-space offsets: ox along "forward", oy along "down the spine"
  const cl = Math.cos(pose.lean);
  const sl = Math.sin(pose.lean);
  const T = (ox: number, oy: number): [number, number] => [sx + cl * ox - sl * oy, sy + sl * ox + cl * oy];
  const ha = pose.lean + pose.head * 0.6;
  const ch = Math.cos(ha);
  const shh = Math.sin(ha);
  const hdx = j.head[0] + 0.5;
  const hdy = j.head[1] - 1;
  const H = (ox: number, oy: number): [number, number] => [hdx + ch * ox - shh * oy, hdy + shh * ox + ch * oy];
  const floor = (p: [number, number]): [number, number] => (p[1] > FOOT_Y - 1 ? [p[0] - (p[1] - FOOT_Y + 1) * 0.8, FOOT_Y - 1] : p);

  // --- Crimson cloak streaming behind, tattered and blood-heavy at the hem -----
  const lean = Math.min(0.45, Math.max(0, pose.lean));
  // Diving or bowed low, the cloak lies along the back instead of hanging
  const theta = 0.16 + lean * 0.9 + Math.max(0, pose.lean - 0.45) * 0.9 + wave2 * 0.05;
  const cLen = 42;
  const c0 = T(-5.5, -2.5);
  const back: [number, number][] = [];
  const front: [number, number][] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const ripple = Math.sin(t * 5 - pose.t * Math.PI * 2) * 1.6 * t;
    const bx = c0[0] - t * cLen * Math.sin(theta) - t * t * (3 + lean * 14) + ripple;
    const by = c0[1] + t * cLen * Math.cos(theta);
    const w = 6 + t * 10;
    back.push(floor([bx, by]));
    front.push(floor([bx + Math.cos(theta) * w, by + Math.sin(theta) * w * 0.4]));
  }
  const bb = back[N];
  const fb = front[N];
  const hem: [number, number][] = [];
  const TEETH = 7;
  for (let i = 1; i < TEETH; i++) {
    const t = i / TEETH;
    const deep = (i % 2 ? 4.5 : 0.5) + hash2(i, 5, 17) * 3;
    hem.push(floor([bb[0] + (fb[0] - bb[0]) * t - Math.sin(theta) * deep, bb[1] + (fb[1] - bb[1]) * t + Math.cos(theta) * deep]));
  }
  // The cloak's near side wraps the back of the body, leaving the dark robe at the front
  fillPoly(f, [...back, ...hem, fb, T(-3, PR.torso + 4), T(-2.5, PR.torso - 3), T(-1, 3), T(0, -2)], cloak, 4.7);
  const cloakHemY = (x: number) => bb[1] + (fb[1] - bb[1]) * Math.max(0, Math.min(1, (x - bb[0]) / (fb[0] - bb[0] || 1)));

  // --- Back arm: dark sleeve, bound forearm ------------------------------------
  const lerp2 = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  f.capsule(sx, sy, j.elbowB[0], j.elbowB[1], 3.2, 2.7, underBack, 1);
  const wB = lerp2(j.elbowB, j.handB, 0.85);
  f.capsule(j.elbowB[0], j.elbowB[1], wB[0], wB[1], 2.5, 2.2, wrapBack, 1);
  f.ellipse(j.handB[0], j.handB[1], 2.5, 2.7, skinBack, 1.1);

  // --- Legs live under the robe: only wrapped shins and bare feet show ----------
  const lowB = lerp2(j.kneeB, j.footB, 0.3);
  f.capsule(j.footB[0] - 1, j.footB[1], j.footB[0] + 5, j.footB[1] + 0.5, 2.1, 1.7, skinBack, 2);
  f.capsule(lowB[0], lowB[1], j.footB[0], j.footB[1] - 0.5, 2.9, 2.5, wrapBack, 2.1);
  const lowF = lerp2(j.kneeF, j.footF, 0.3);
  f.capsule(j.footF[0] - 1, j.footF[1], j.footF[0] + 5.5, j.footF[1] + 0.5, 2.2, 1.8, skin, 3);
  f.capsule(lowF[0], lowF[1], j.footF[0], j.footF[1] - 0.5, 3.1, 2.6, wrap, 3.1);

  // --- Dark under-robe, hem at the knee -------------------------------------------
  const kneeMidX = (j.kneeF[0] + j.kneeB[0]) / 2;
  const kneeY = Math.max(j.kneeF[1], j.kneeB[1]);
  const hemY = Math.max(kneeY + 5, Math.min(kneeY + 11, Math.max(j.footF[1], j.footB[1]) - 8));
  const sway = wave * 2;
  const rf = Math.max(j.kneeF[0], j.kneeB[0]) + 4;
  const rb = Math.min(j.kneeF[0], j.kneeB[0], j.kneeB[0] + (j.footB[0] - j.kneeB[0]) * 0.4) - 6 + sway;
  const rhem: [number, number][] = [];
  const RT = 8;
  for (let i = 0; i <= RT; i++) {
    const t = i / RT;
    rhem.push([rf + (rb - rf) * t, hemY + (hash2(i, 3, 11) - 0.3) * 5 + (i % 2) * 2.5 - (t * 2 - 1) * 1.5]);
  }
  fillPoly(f, 
    [T(4.5, 1), [hx + 6, hy - 3], [Math.max(hx + 7, kneeMidX + 2.5), hy + 7], ...rhem, [Math.min(hx - 7, rb + 1), hy + 5], [hx - 6.5, hy - 5], T(-5.5, 2), T(-2, -2), T(2.5, -2)],
    under,
    4,
  );

  // --- Rope belt, knotted, with a dangling rosary and reliquary ----------------
  f.capsule(hx - 7.5, hy - 4, hx + 7.5, hy - 4.5, 1.5, 1.5, ROPE, 4.5);
  f.ellipse(hx + 5, hy - 4, 1.8, 1.6, ROPE, 4.55);
  f.capsule(hx + 5, hy - 3, hx + 6 + sway * 0.4, hy + 6, 0.9, 0.7, ROPE, 4.6);
  const bead = trimMat(look.trim);
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const bx = hx + 2.5 + t * 2 + sway * 0.5 * t;
    const by = hy - 3 + Math.sin(t * Math.PI) * 6 + t * 3;
    f.ellipse(bx, by, 0.9, 0.9, i % 2 ? bead : OLD_BONE, 4.62);
  }
  const rx = hx + 4.8 + sway * 0.5;
  const ry = hy + 6;
  f.capsule(rx, ry - 1.5, rx, ry + 3.5, 0.7, 0.7, trim, 4.65);
  f.capsule(rx - 1.6, ry, rx + 1.6, ry, 0.7, 0.7, trim, 4.65);

  if (look.maw) {
    const [cx, cy] = T(3.5, 11);
    f.ellipse(cx, cy, 3.2, 4.2, { ramp: ['#120204', '#3a0610', '#7a1020', '#b8302a', '#c8e05a', '#f0ff9a'], round: -1 }, 5.7);
    f.ellipse(cx, cy, 1.3, 2.2, { ramp: ['#000000', '#1a0306'], round: 0 }, 5.8);
    for (let i = 0; i < 5; i++) f.ellipse(cx - 2.6 + i * 1.3, cy - 3.4 + (i % 2) * 6.8, 0.6, 0.9, { ramp: ['#5f4e35', '#cdb889', '#efe3bf'] }, 5.85);
  }

  // --- Front upper arm (dark sleeve, tucked under the mantle) ----------------
  f.capsule(sx, sy, j.elbowF[0], j.elbowF[1], 3.4, 2.8, under, 5.2);

  // --- Shoulder mantle: crimson capelet with a ragged edge ----------------------
  const mHem: [number, number][] = [];
  const MT = 7;
  for (let i = 0; i <= MT; i++) {
    const t = i / MT;
    mHem.push(T(6.5 - t * 13.5, 5 + (i % 2 ? 2.2 : 0) + hash2(i, 7, 23) * 1.5 + t * 1.5 - wave * t));
  }
  fillPoly(f, [T(3.5, -4), T(6, 0), ...mHem, T(-7.5, 0), T(-5, -4.5)], robe, 5.5);

  // --- Hooded head ----------------------------------------------------------------
  // Cowl drape over the neck
  fillPoly(f, [H(-6.5, 1), H(3, 4.5), [nx + 4, ny + 3], T(4, -1), T(-6, -1)], hood, 7.4);
  // Hood shell, with a soft point at the back
  f.ellipse(...H(-0.8, -0.4), 6.9, 7.4, hood, 7.6, ha);
  fillPoly(f, [H(-1.5, -7), H(-7.5, -9.5), H(-9.5, -2), H(-6.5, 3)], hood, 7.55);
  // Shadowed interior of the cowl
  {
    const [ix, iy] = H(3.4, 0.8);
    f.stain((x, y) => ((x - ix) / 4.6) ** 2 + ((y - iy) / 6.4) ** 2 < 1, hoodIn, [hood]);
  }
  // Long hair spilling out of the cowl over the chest
  const hs = look.hairStyle;
  if (hs === 1) fillPoly(f, [H(-0.5, 1), H(2, 3), H(1.5, 9.5 + wave), H(-1.5, 8)], hair, 7.7);
  // Face: mostly lost in the hood's shadow, only the jaw and nose catch light
  const [fx, fy] = H(3.6, 1.5);
  f.ellipse(fx, fy, 3.2, 4.4, skin, 7.8, ha);
  f.ellipse(...H(5.6, 1.6), 1.0, 1.4, skin, 7.85);
  f.stain((x, y) => (y - fy) * ch - (x - fx) * shh < -2.1 + (x - fx) * 0.35, pal.skinShade, [skin]);
  // A hollow eye glinting in the dark, weeping blood
  const [ex, ey] = H(4.4, -0.6);
  f.stain((x, y) => Math.abs(x - ex) < 0.9 && Math.abs(y - ey) < 0.6, EYE_GLINT, [pal.skinShade]);
  f.stain((x, y) => Math.abs(x - ex) < 0.6 && y > ey + 0.6 && y < ey + 5.5, BLOOD, [skin, pal.skinShade]);
  // Hair peeking from under the brim
  if (hs !== 2) f.ellipse(...H(2.2, -3.4), hs === 1 ? 2.6 : 2.0, 1.4, hair, 7.88, ha);
  // Brim of the hood overhanging the brow
  f.capsule(...H(0, -6.6), ...H(5.4, -3.4), 1.7, 1.4, hood, 7.9);

  // --- Front forearm: bound in strips, shackled to the Tether -----------------------
  const wF = lerp2(j.elbowF, j.handF, 0.85);
  f.capsule(j.elbowF[0], j.elbowF[1], wF[0], wF[1], 2.7, 2.3, wrap, 9);
  f.ellipse(j.handF[0], j.handF[1], 2.8, 3.0, skin, 9.2);
  const [wx, wy] = lerp2(j.elbowF, j.handF, 0.74);
  f.ellipse(wx, wy, 2.9, 2.9, IRON, 9.4);
  f.ellipse(wx, wy, 1.3, 1.3, RUST, 9.45);
  if (look.helix) {
    const [hxx, hyy] = lerp2(j.elbowF, j.handF, 0.38);
    f.ellipse(hxx, hyy - 1, 3.2, 4.0, { ramp: ['#2a0a10', '#6a2030', '#a8505a', '#d8908a', '#f2c0b0'], spec: 0.5 }, 9.5);
    f.ellipse(hxx + 0.5, hyy - 0.8, 1.4, 2.1, { ramp: ['#0b0507', '#3a0a12'], round: 0 }, 9.6);
  }

  // --- Gore ----------------------------------------------------------------------
  f.stain((x, y) => {
    const n = valueNoise(x, y, 2.5, 21);
    if (y > hemY - 7 + n * 6) return true; // robe hem soaked
    return y > cloakHemY(x) - 9 + valueNoise(x, 0, 2, 5) * 7; // cloak hem dragged through blood
  }, OLD_BLOOD, [under, cloak, robe]);
  f.stain((x, y) => y > hemY - 2 + valueNoise(x, 1, 2, 6) * 3 || valueNoise(x, y, 1.6, 33) > 0.92, BLOOD, [under, robe, hood]);
  f.stain((x, y) => (Math.hypot(x - j.handF[0], y - j.handF[1]) < 2.6 && hash2(x | 0, y | 0, 4) < 0.6) || (y > FOOT_Y - 2 && hash2(x | 0, y | 0, 8) < 0.3), BLOOD, [skin, skinBack, wrap, wrapBack]);
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
  add(
    'climb',
    [0, 1, 2, 3].map((i) => {
      const s = Math.sin((i / 4) * Math.PI * 2);
      return { ...STAND, lean: -0.05, head: -0.2, armF: { a: -2.6 + s * 0.35, b: -0.2 }, armB: { a: -2.6 - s * 0.35, b: -0.2 }, legF: { a: 0.35 + s * 0.3, b: 0.7 + s * 0.4 }, legB: { a: 0.35 - s * 0.3, b: 0.7 - s * 0.4 }, t: i / 4 };
    }),
    7,
  );
  add('hang', [{ ...STAND, lean: -0.1, head: -0.35, armF: { a: -3.0, b: 0 }, armB: { a: -2.9, b: 0 }, legF: { a: 0.15, b: 0.15 }, legB: { a: -0.1, b: 0.25 }, t: 0.4 }], 1, 0);
  add('mantle', [{ ...STAND, y: HY + 6, lean: 0.7, head: 0.3, armF: { a: 0.6, b: 1.0 }, armB: { a: 0.4, b: 1.2 }, legF: { a: 1.2, b: 1.6 }, legB: { a: -0.2, b: 1.4 }, t: 0.6 }], 1, 0);
  add('air-attack', [mixPose(jumpPose('fall', 0), ATTACK_POSES.a3[1], 0.6)], 1, 0);
  sb.build(scene);
  heroMeta.hands = hands;
}

/** Interpolated preview of a pose for debug galleries. */
export { mixPose };
