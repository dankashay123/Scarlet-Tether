import { Figure, KEY_LIGHT, folds, grain, ramp, type Material } from './render';
import { PixelCanvas, hash2, valueNoise } from './pixel';
import { mixPose, solve, type Joints, type Limb, type Pose, type Proportions } from './rig';
import { SheetBuilder } from './sheet';

// ---------------------------------------------------------------------------
// The Severed: a penitent knight of Sanctum. Crimson cowl with a tall
// capirote point bound by an iron crown of thorns, a blind iron mask, a
// blackened breastplate under a ragged mantle, a spiked pauldron, gauntlets
// and greaves, and a long tattered cloak dragged through blood.
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

const TRIM_CACHE = new Map<string, Material>();
function trimMat(c: string): Material {
  let m = TRIM_CACHE.get(c);
  if (!m) TRIM_CACHE.set(c, (m = { ramp: ramp(['#1a1206', shade(c, -0.6), shade(c, -0.3), c, shade(c, 0.45)], 5), spec: 0.8, round: 0.3 }));
  return m;
}

function hairMat(c: string): Material {
  return { ramp: ramp(['#0b0507', shade(c, -0.6), shade(c, -0.35), shade(c, -0.1), c, shade(c, 0.3)], 6), tex: (x, y) => Math.sin(x * 1.7 + y * 0.5) * 0.14, round: 0.7 };
}

export const IRON: Material = { ramp: ['#0e0d10', '#26252b', '#3d3c44', '#5b5a63', '#87868f', '#c4c3c8'], spec: 0.9, tex: grain(1.5, 0.12, 7), round: 0.9 };
export const RUST: Material = { ramp: ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22', '#b06a36'], spec: 0.2, tex: grain(1.5, 0.15, 9) };

// --- The penitent's armour: blackened, pitted steel with hard highlights -----
const STEEL_RAMP = ['#060609', '#0c0c11', '#13141a', '#1b1c24', '#24252f', '#2e303b', '#3a3c49', '#4a4d5b', '#646776', '#9093a2', '#cfd1da'];
const pitted = grain(3, 0.035, 4);
const STEEL: Material = { ramp: STEEL_RAMP, spec: 0.7, round: 1, tex: pitted, line: '#030305' };
/** Flatter plates (breastplate, faulds) so the highlight runs in a band. */
const PLATE: Material = { ramp: STEEL_RAMP.slice(0, 10), spec: 0.6, round: 0.6, tex: pitted, line: '#030305' };
const STEEL_BACK: Material = { ramp: STEEL_RAMP.slice(0, 8), spec: 0.5, round: 1, tex: pitted, line: '#030305' };
/** The blind mask, deep inside the cowl: mostly shadow, one cold glint. */
const MASK: Material = { ramp: ['#030304', '#07070a', '#0d0d12', '#15151c', '#23242e', '#4a4c58'], spec: 0.6, round: 1 };
const LEATHER: Material = { ramp: ['#0b0605', '#170e0b', '#241712', '#33221a', '#463025', '#5c4030'], spec: 0.25, round: 0.6, tex: grain(1.2, 0.08, 31) };
const EYE_GLINT: Material = { ramp: ['#7a1410', '#c83a22', '#ff9a5a'], round: 0 };
const SMEAR: Material = { ramp: ['#2a1a1e', '#4a3438', '#6e5458', '#94787a', '#b89c9a'], round: 0.25, line: '#0b0507' };
const STREAK: Material = { ramp: ['#1a080c', '#2e0f16', '#45161e'], round: 0 };
const OLD_BONE: Material = { ramp: ['#2a2018', '#5f4e35', '#a8946a', '#d8c8a0'], spec: 0.4 };

const UNDER_RAMP = ['#07060a', '#0e0b10', '#151116', '#1d171d', '#261e25', '#31262e', '#3e3039'];

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
  skinShade: Material;
  robe: Material;
  cloak: Material;
  hood: Material;
  hoodIn: Material;
  tabard: Material;
  under: Material;
  underBack: Material;
  hair: Material;
  trim: Material;
}

const PAL_CACHE = new Map<string, HeroPalette>();

function heroPalette(look: CitizenLook): HeroPalette {
  const key = look.skin + look.robe + look.hair + look.trim;
  const hit = PAL_CACHE.get(key);
  if (hit) return hit;
  const skin = skinMat(look.skin);
  const base = cloakTone(look.robe);
  const crimson = ramp(['#0e0408', shade(base, -0.75), shade(base, -0.55), shade(base, -0.34), shade(base, -0.14), base, shade(base, 0.14)], 8);
  const cloakR = crimson.map((c) => shade(c, -0.22));
  const shadeR = ramp(['#060204', shade(look.skin, -0.85), shade(look.skin, -0.7)], 4);
  const pal: HeroPalette = {
    skin,
    skinShade: { ramp: shadeR, round: 0.6 },
    robe: { ramp: crimson, tex: folds(2.4, 0.2, 4), round: 0.75 },
    cloak: { ramp: cloakR, tex: folds(2.2, 0.3, 7), round: 0.55 },
    hood: { ramp: crimson, tex: folds(3.2, 0.12, 5), round: 0.9 },
    hoodIn: { ramp: ['#020102', '#070304', '#10060a', shade(base, -0.8)], round: 0.2 },
    tabard: { ramp: crimson.map((c) => shade(c, -0.1)), tex: folds(1.6, 0.22, 9), round: 0.5 },
    under: { ramp: UNDER_RAMP, tex: folds(2.6, 0.16, 2), round: 0.7 },
    underBack: { ramp: UNDER_RAMP.map((c) => shade(c, -0.35)), round: 0.7 },
    hair: hairMat(shade(look.hair, -0.55)),
    trim: trimMat(look.trim),
  };
  PAL_CACHE.set(key, pal);
  return pal;
}

type Mask = (x: number, y: number) => boolean;
type Op =
  | { k: 'a'; mask: Mask; m: Material; layer: number; box: [number, number, number, number] }
  | { k: 'e'; cx: number; cy: number; rx: number; ry: number; m: Material; layer: number; rot: number }
  | { k: 'c'; ax: number; ay: number; bx: number; by: number; ra: number; rb: number; m: Material; layer: number }
  | { k: 's'; mask: Mask; m: Material; only?: Material[] };

/**
 * Records a frame's parts, then replays them onto a Figure cropped to the
 * parts' bounds: lighting and outlining cost scale with canvas area, and the
 * figure fills well under half of the frame.
 */
class Rec {
  private ops: Op[] = [];
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  private grow(x0: number, y0: number, x1: number, y1: number) {
    this.x0 = Math.min(this.x0, x0);
    this.y0 = Math.min(this.y0, y0);
    this.x1 = Math.max(this.x1, x1);
    this.y1 = Math.max(this.y1, y1);
  }
  add(mask: Mask, m: Material, layer: number, box: [number, number, number, number]) {
    this.grow(...box);
    this.ops.push({ k: 'a', mask, m, layer, box });
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material, layer: number, rot = 0) {
    const r = Math.max(rx, ry);
    this.grow(cx - r, cy - r, cx + r, cy + r);
    this.ops.push({ k: 'e', cx, cy, rx, ry, m, layer, rot });
  }
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, m: Material, layer: number) {
    const r = Math.max(ra, rb);
    this.grow(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r);
    this.ops.push({ k: 'c', ax, ay, bx, by, ra, rb, m, layer });
  }
  stain(mask: Mask, m: Material, only?: Material[]) {
    this.ops.push({ k: 's', mask, m, only });
  }
  /** Render into a full FW x FH frame. */
  render(light: Parameters<Figure['render']>[0]): PixelCanvas {
    // Offsets snap to 8px so ordered dithering and textures stay put between frames
    const ox = Math.max(0, Math.floor((this.x0 - 3) / 8) * 8);
    const oy = Math.max(0, Math.floor((this.y0 - 3) / 8) * 8);
    const w = Math.min(FW, Math.ceil(this.x1 + 3)) - ox;
    const h = Math.min(FH, Math.ceil(this.y1 + 3)) - oy;
    const out = new PixelCanvas(FW, FH);
    if (w <= 0 || h <= 0) return out;
    const f = new Figure(w, h);
    const mats = new Map<Material, Material>();
    const M = (m: Material) => {
      let r = mats.get(m);
      if (!r) {
        const tex = m.tex;
        mats.set(m, (r = tex ? { ...m, tex: (x, y) => tex(x + ox, y + oy) } : m));
      }
      return r;
    };
    for (const o of this.ops) {
      if (o.k === 'a') f.add((x, y) => o.mask(x + ox, y + oy), M(o.m), o.layer, [o.box[0] - ox, o.box[1] - oy, o.box[2] - ox, o.box[3] - oy]);
      else if (o.k === 'e') f.ellipse(o.cx - ox, o.cy - oy, o.rx, o.ry, M(o.m), o.layer, o.rot);
      else if (o.k === 'c') f.capsule(o.ax - ox, o.ay - oy, o.bx - ox, o.by - oy, o.ra, o.rb, M(o.m), o.layer);
      else f.stain((x, y) => o.mask(x + ox, y + oy), M(o.m), o.only?.map(M));
    }
    out.blit(f.render(light), ox, oy);
    return out;
  }
}

/**
 * Polygon part with a scanline mask: crossings are computed once per row
 * instead of testing every edge for every pixel (Figure.poly), which keeps
 * the big cloth shapes cheap.
 */
function fillPoly(f: Rec, pts: [number, number][], m: Material, layer: number) {
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

/**
 * Hero pose: the rig pose plus secondary-motion and effect controls.
 * - wind: cloak stream (0 hanging, 1 flat behind, 2 billowing up-behind, <0 swung forward)
 * - smear: previous front-arm angle; draws a motion smear from there to the current arm
 * - streak: dash speed lines behind the body (0..1)
 */
export interface HeroPose extends Pose {
  wind?: number;
  smear?: number;
  streak?: number;
}

interface HeroOpts {
  look: CitizenLook;
  pose: HeroPose;
  hurt?: boolean;
}

type V = [number, number];
const lerp2 = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const seg = (p: V, ang: number, len: number): V => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];

/** Draw one frame of the Severed. Returns the canvas and the front hand position. */
export function drawHero(o: HeroOpts): { pc: PixelCanvas; hand: [number, number] } {
  const f = new Rec();
  const { look, pose } = o;
  const j = solve(pose, PR);
  const pal = heroPalette(look);
  const { robe, cloak, hood, hoodIn, under, underBack, hair, trim, tabard } = pal;
  const wave = Math.sin(pose.t * Math.PI * 2);
  const wave2 = Math.cos(pose.t * Math.PI * 2);
  const wind = pose.wind ?? 0.15;

  const [sx, sy] = j.shoulder;
  const [hx, hy] = j.hip;
  const [nx, ny] = j.neck;
  // Body-space offsets: ox along "forward", oy along "down the spine"
  const cl = Math.cos(pose.lean);
  const sl = Math.sin(pose.lean);
  const T = (ox: number, oy: number): V => [sx + cl * ox - sl * oy, sy + sl * ox + cl * oy];
  const ha = pose.lean + pose.head * 0.6;
  const ch = Math.cos(ha);
  const shh = Math.sin(ha);
  const hdx = j.head[0] + 0.5;
  const hdy = j.head[1] - 1;
  const H = (ox: number, oy: number): V => [hdx + ch * ox - shh * oy, hdy + shh * ox + ch * oy];
  const floor = (p: V): V => (p[1] > FOOT_Y - 1 ? [p[0] - (p[1] - FOOT_Y + 1) * 0.8, FOOT_Y - 1] : p);

  // --- Dash speed lines --------------------------------------------------------
  if (pose.streak) {
    for (let i = 0; i < 4; i++) {
      const y = hy - 14 + i * 6 + hash2(i, 1, 3) * 3;
      const x1 = hx - 12 - hash2(i, 2, 3) * 6;
      const len = (14 + hash2(i, 3, 3) * 16) * pose.streak;
      f.capsule(x1 - len, y, x1, y, 0.4, 0.7, STREAK, 0.3);
    }
  }

  // --- Crimson cloak streaming behind, tattered and blood-heavy at the hem -----
  const theta0 = 0.08 + wind * 1.3 + Math.max(0, pose.lean - 0.6) * 0.7 + wave2 * 0.04;
  const bend = -0.35 * Math.min(1, Math.max(0, wind));
  const cLen = 40 + Math.min(1, Math.abs(wind)) * 6 - Math.max(0, wind - 1) * 12;
  const amp = 1.0 + Math.min(1.5, Math.abs(wind)) * 1.6;
  const c0 = T(-5.5, -2.5);
  const back: V[] = [];
  const front: V[] = [];
  const N = 9;
  let cx = c0[0];
  let cy = c0[1];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const th = theta0 + bend * t;
    if (i > 0) {
      cx += -Math.sin(th) * (cLen / N);
      cy += Math.cos(th) * (cLen / N);
    }
    const ripple = Math.sin(t * 5.5 - pose.t * Math.PI * 2) * amp * t;
    const bx = cx + Math.cos(th) * ripple;
    const by = cy + Math.sin(th) * ripple;
    const w = 6.5 + t * 11;
    back.push(floor([bx, by]));
    front.push(floor([bx + Math.cos(th) * w, by + Math.sin(th) * w * (wind > 0.5 ? 1 : 0.45)]));
  }
  const bb = back[N];
  const fb = front[N];
  const thE = theta0 + bend;
  const hem: V[] = [];
  const TEETH = 9;
  for (let i = 1; i < TEETH; i++) {
    const t = i / TEETH;
    const deep = (i % 2 ? 5.5 : 0.5) + hash2(i, 5, 17) * 3.5 + Math.sin(pose.t * 6.28 + i) * 0.8;
    hem.push(floor([bb[0] + (fb[0] - bb[0]) * t - Math.sin(thE) * deep, bb[1] + (fb[1] - bb[1]) * t + Math.cos(thE) * deep]));
  }
  // The cloak's near side wraps the back of the body, leaving the armour at the front
  fillPoly(f, [...back, ...hem, ...front.slice().reverse().slice(0, N - 2), T(-3, PR.torso + 4), T(-2.5, PR.torso - 3), T(-1, 3), T(0, -2)], cloak, 4.7);
  const hemX0 = Math.min(bb[0], fb[0]) - 6;
  const hemX1 = Math.max(bb[0], fb[0]) + 6;
  const cloakHemY = (x: number) => bb[1] + (fb[1] - bb[1]) * Math.max(0, Math.min(1, (x - bb[0]) / (fb[0] - bb[0] || 1)));

  // --- Back arm: dark sleeve, blackened vambrace and gauntlet --------------------
  f.capsule(sx, sy, j.elbowB[0], j.elbowB[1], 2.9, 2.3, underBack, 1);
  const wB = lerp2(j.elbowB, j.handB, 0.82);
  f.capsule(j.elbowB[0], j.elbowB[1], wB[0], wB[1], 2.3, 2.1, STEEL_BACK, 1.25);
  f.ellipse(j.handB[0], j.handB[1], 2.3, 2.5, STEEL_BACK, 1.5);

  // --- Legs live under the robe: armoured shins and pointed sabatons ----------
  const leg = (knee: V, foot: V, limb: Limb, back: boolean, layer: number) => {
    const shinA = limb.a - limb.b;
    const grounded = foot[1] >= FOOT_Y - 4;
    const toeDown = grounded ? 0 : Math.max(-0.4, Math.min(1.25, -shinA * 0.8 + 0.15));
    const m = back ? STEEL_BACK : STEEL;
    const thigh = lerp2(knee, j.hip, 0.15);
    f.capsule(thigh[0], thigh[1], knee[0], knee[1], 3.4, 3.0, back ? underBack : under, layer - 0.3);
    const ankle = lerp2(knee, foot, 0.92);
    f.capsule(knee[0], knee[1], ankle[0], ankle[1], 3.0, 2.3, m, layer);
    // Knee cop with a short spike
    f.ellipse(knee[0] + Math.cos(limb.a) * 1.2, knee[1] - Math.sin(limb.a) * 0.6, 2.7, 2.5, m, layer + 0.3);
    // Sabaton: heel to pointed toe, following the foot's angle in the air
    const tx = Math.cos(toeDown);
    const ty = Math.sin(toeDown);
    f.capsule(foot[0] - tx * 1.5, foot[1] - ty * 1.5 + 0.3, foot[0] + tx * 6, foot[1] + ty * 6 + 0.9, 2.3, 1.1, m, layer + 0.25);
  };
  leg(j.kneeB, j.footB, pose.legB, true, 2);
  leg(j.kneeF, j.footF, pose.legF, false, 3);

  // --- Dark under-robe, hem below the knee ----------------------------------------
  const kneeMidX = (j.kneeF[0] + j.kneeB[0]) / 2;
  const kneeY = Math.max(j.kneeF[1], j.kneeB[1]);
  const hemY = Math.max(kneeY + 4, Math.min(kneeY + 9, Math.max(j.footF[1], j.footB[1]) - 9));
  const sway = wave * 2 - wind * 2.5;
  const rf = Math.max(j.kneeF[0], j.kneeB[0]) + 4;
  const rb = Math.min(j.kneeF[0], j.kneeB[0], j.kneeB[0] + (j.footB[0] - j.kneeB[0]) * 0.4) - 6 + sway;
  const rhem: V[] = [];
  const RT = 8;
  for (let i = 0; i <= RT; i++) {
    const t = i / RT;
    rhem.push([rf + (rb - rf) * t, hemY + (hash2(i, 3, 11) - 0.3) * 5 + (i % 2) * 2.5 - (t * 2 - 1) * 1.5]);
  }
  fillPoly(f, [T(5.5, 13), [hx + 6, hy - 3], [Math.max(hx + 7, kneeMidX + 2.5), hy + 7], ...rhem, [Math.min(hx - 7, rb + 1), hy + 5], [hx - 6.5, hy - 5], T(-6, 13)], under, 4);

  // --- Crimson tabard hanging from the belt, between the legs --------------------
  {
    const botX = hx + 3 + (j.kneeF[0] - hx) * 0.45 + sway * 0.4;
    const by = hemY + 3;
    fillPoly(f, [T(0.5, 19.5), T(6.3, 19.8), [botX + 3.4, by - 1], [botX + 1.6, by + 2.5], [botX - 0.3, by - 0.5], [botX - 2.2, by + 3], [botX - 3.2, by]], tabard, 4.2);
  }

  // --- Faulds: two steel lames over the hips -------------------------------------
  fillPoly(f, [T(-5.4, 21.6), T(7.0, 22), T(7.6, 25.6), T(-5.8, 25.0)], PLATE, 4.35);
  fillPoly(f, [T(-5.8, 19.2), T(6.6, 19.6), T(7.2, 22.6), T(-6.2, 22.2)], PLATE, 4.55);

  // --- Breastplate -----------------------------------------------------------------
  fillPoly(f, [T(-4.5, 0), T(2.5, -0.5), T(5.6, 3), T(6.7, 8), T(6.1, 13), T(4.6, 17.5), T(-4.6, 18.2), T(-5.9, 10)], PLATE, 5);
  // Plackart lip, riveted
  f.capsule(...T(-4.6, 14), ...T(5.4, 14.4), 1.2, 1.2, PLATE, 5.25);

  // --- Belt with buckle, a dangling rosary and reliquary ----------------------
  f.capsule(...T(-5.8, 19.2), ...T(6.4, 19.6), 1.6, 1.6, LEATHER, 5.45);
  {
    const [bx, by] = T(4.4, 19.4);
    f.ellipse(bx, by, 1.6, 1.8, trim, 5.65);
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) / 4;
      const px = bx - 1 + t * 2 + sway * 0.5 * t;
      const py = by + 1 + Math.sin(t * Math.PI) * 5 + t * 3;
      f.ellipse(px, py, 0.9, 0.9, i % 2 ? trim : OLD_BONE, 5.6);
    }
    const rx = bx + 0.8 + sway * 0.5;
    const ry = by + 10;
    f.capsule(rx, ry - 1.5, rx, ry + 3.5, 0.7, 0.7, trim, 5.62);
    f.capsule(rx - 1.6, ry, rx + 1.6, ry, 0.7, 0.7, trim, 5.62);
  }
  // Leather baldric across the plate
  f.capsule(...T(5, 1.5), ...T(-5, 17), 1.1, 1.1, LEATHER, 5.35);

  if (look.maw) {
    const [mx, my] = T(3.5, 10);
    f.ellipse(mx, my, 3.2, 4.2, { ramp: ['#120204', '#3a0610', '#7a1020', '#b8302a', '#c8e05a', '#f0ff9a'], round: -1 }, 5.7);
    f.ellipse(mx, my, 1.3, 2.2, { ramp: ['#000000', '#1a0306'], round: 0 }, 5.8);
    for (let i = 0; i < 5; i++) f.ellipse(mx - 2.6 + i * 1.3, my - 3.4 + (i % 2) * 6.8, 0.6, 0.9, { ramp: ['#5f4e35', '#cdb889', '#efe3bf'] }, 5.85);
  }

  // --- Shoulder mantle: crimson capelet with a ragged edge ----------------------
  const mHem: V[] = [];
  const MT = 7;
  for (let i = 0; i <= MT; i++) {
    const t = i / MT;
    mHem.push(T(5.5 - t * 13 - wind * t * 2, 3.5 + (i % 2 ? 2.4 : 0) + hash2(i, 7, 23) * 1.5 + t * 2.5 - wave * t));
  }
  fillPoly(f, [T(3, -4), T(5.6, -0.5), ...mHem, T(-7.5, 0), T(-5, -4.5)], robe, 5.9);

  // --- Hooded head ------------------------------------------------------------------
  // Cowl drape over the neck
  fillPoly(f, [H(-6.5, 1), H(3, 4.5), [nx + 4, ny + 3], T(4, -1), T(-6, -1)], hood, 7.4);
  // The cowl's point: stiff, swept up and back, raked further by speed
  const sw = Math.max(-0.4, Math.min(1.1, wind)) + wave * 0.12;
  // At speed the point trails in world space instead of following the head's pitch
  const hp = ha * (1 - 0.85 * Math.max(0, Math.min(1, wind)));
  const Hp = (ox: number, oy: number): V => [hdx + Math.cos(hp) * ox - Math.sin(hp) * oy, hdy + Math.sin(hp) * ox + Math.cos(hp) * oy];
  fillPoly(
    f,
    [H(-6.5, -1.5), H(-6.6, -5.6), Hp(-8.2 - sw * 1.4, -10.4 + sw * 1.1), Hp(-11.5 - sw * 3.2, -17 + sw * 4.2), Hp(-5.0 - sw * 1.2, -12 + sw * 1.0), H(-1.0, -7.4), H(1.5, -6.4)],
    hood,
    7.55,
  );
  // Hood shell
  f.ellipse(...H(-0.8, -0.6), 6.4, 6.8, hood, 7.6, ha);
  // Shadowed interior of the cowl
  {
    const [ix, iy] = H(3.4, 1);
    f.stain((x, y) => ((x - ix) / 4.6) ** 2 + ((y - iy) / 6.4) ** 2 < 1, hoodIn, [hood]);
  }
  const hs = look.hairStyle;
  if (hs === 1) fillPoly(f, [H(-0.5, 2), H(2, 3.5), H(1.5, 9.5 + wave), H(-1.5, 8)], hair, 7.7);
  // Chin, lost in shadow below the mask
  f.ellipse(...H(3.4, 4.4), 2.0, 1.5, pal.skinShade, 7.75);
  // Blind iron mask: a glint of an eye through the slit, a weeping streak
  const [fx, fy] = H(3.7, 0.9);
  f.ellipse(fx, fy, 2.6, 3.9, MASK, 7.8, ha);
  f.ellipse(...H(5.6, 0.6), 0.9, 2.2, MASK, 7.82, ha);
  {
    const [ex, ey] = H(4.7, -0.7);
    f.capsule(ex - 1, ey, ex + 0.6, ey, 0.5, 0.5, EYE_GLINT, 7.84);
    const [bx, by] = H(4.3, 1.2);
    f.capsule(bx, by, bx - shh * 3.5, by + ch * 3.5, 0.45, 0.35, BLOOD, 7.84);
  }
  if (hs === 0 || hs === 3) f.ellipse(...H(1.6, -3.4), 1.8, 1.1, hair, 7.88, ha);
  // Brim of the hood overhanging the brow
  f.capsule(...H(-0.5, -6.4), ...H(5.6, -3.6), 1.8, 1.4, hood, 7.9);
  // --- Front arm: sleeve, spiked pauldron, vambrace, gauntlet -------------------------
  f.capsule(sx, sy, j.elbowF[0], j.elbowF[1], 3.4, 2.8, under, 7.95);
  {
    const phi = pose.armF.a * 0.4 + pose.lean * 0.5;
    const ux = Math.sin(phi);
    const uy = Math.cos(phi);
    const P = (a: number, d: number): V => [sx + 0.6 + ux * (d + 2.4) + uy * a, sy + uy * (d + 2.4) - ux * a];
        // Spikes first, so their roots sink into the dome
    const spikes: [number, number, number][] = [
      [-2.8, -0.8, 3.6],
      [-0.4, -0.4, 4.8],
      [2.0, -0.05, 3.2],
    ];
    for (const [a, tilt, len] of spikes) {
      const base = P(a, -2.6);
      const ang = phi + Math.PI + tilt; // pointing up out of the dome, raked back
      const tip = seg(base, ang, len);
      const px = Math.cos(ang) * 1.3;
      const py = -Math.sin(ang) * 1.3;
      fillPoly(f, [[base[0] - px, base[1] - py], tip, [base[0] + px, base[1] + py]], STEEL, 8.3);
    }
    const plate = (pts: V[], layer: number) => fillPoly(f, pts.map(([a, d]) => P(a, d)), PLATE, layer);
    plate([[-4.4, 4.4], [4.6, 4.4], [4.0, 7.2], [0.2, 8.0], [-3.8, 7.0]], 8.0);
    plate([[-5.2, 1.8], [5.4, 1.8], [5.0, 4.9], [0.2, 5.7], [-4.8, 4.8]], 8.2);
    const dome: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * Math.PI;
      dome.push([-Math.cos(t) * 5.8, 1.4 - Math.sin(t) * 4.4]);
    }
    plate([...dome, [4.8, 2.8], [0.2, 3.4], [-4.8, 2.8]], 8.4);
    // Rivets
    for (const [a, d] of [
      [-3.4, 0.8],
      [3.4, 0.8],
    ] as V[])
      f.ellipse(...P(a, d), 0.65, 0.65, trim, 8.6);
  }
  // Motion smear: a crescent trailing the gauntlet along its arc
  if (pose.smear !== undefined && Math.abs(pose.smear - pose.armF.a) > 0.2) {
    const outer: V[] = [];
    const inner: V[] = [];
    const S = 8;
    for (let i = 0; i <= S; i++) {
      const k = i / S;
      const a = pose.smear + (pose.armF.a - pose.smear) * k;
      const e = seg(j.shoulder, a, PR.upperArm);
      const hnd = seg(e, a + pose.armF.b, PR.foreArm + 2.5);
      outer.push(hnd);
      // thin at the tail, full width at the hand
      inner.push(lerp2(hnd, j.shoulder, 0.08 + 0.42 * k * k));
    }
    fillPoly(f, [...outer, ...inner.reverse()], SMEAR, 8.75);
  }
  {
    const wF = lerp2(j.elbowF, j.handF, 0.8);
    const fa = Math.atan2(j.handF[0] - j.elbowF[0], j.handF[1] - j.elbowF[1]);
    // Couter
    f.ellipse(j.elbowF[0], j.elbowF[1], 2.6, 2.6, STEEL, 9.22);
    f.capsule(j.elbowF[0], j.elbowF[1], wF[0], wF[1], 2.9, 2.6, STEEL, 9.0);
    // Leather straps on the vambrace
    for (const t of [0.45]) {
      const [qx, qy] = lerp2(j.elbowF, j.handF, t);
      const ex = Math.sin(fa);
      const ey = Math.cos(fa);
      f.capsule(qx - ey * 2.9, qy + ex * 2.9, qx + ey * 2.9, qy - ex * 2.9, 0.75, 0.75, LEATHER, 9.25);
    }
    // Chain links hanging from the bracer
    const [cx0, cy0] = lerp2(j.elbowF, j.handF, 0.5);
    for (let k = 0; k < 2; k++) {
      const swing = Math.sin(pose.t * Math.PI * 2 + k) * 0.5 * k - wind * 0.9 * k;
      f.ellipse(cx0 + swing, cy0 + 2.6 + k * 2, k % 2 ? 0.7 : 1.1, k % 2 ? 1.2 : 0.9, IRON, 9.3 + k * 0.01);
    }
    // Gauntlet: flared cuff, plated hand
    f.ellipse(wF[0], wF[1], 3.0, 3.0, STEEL, 9.45, -fa);
    f.ellipse(j.handF[0], j.handF[1], 2.7, 3.0, STEEL, 9.7, -fa);
    // The shackle that holds the Tether
    const [wx, wy] = lerp2(j.elbowF, j.handF, 0.74);
    f.ellipse(wx, wy, 3.1, 3.1, IRON, 9.9);
    f.ellipse(wx, wy, 1.3, 1.3, RUST, 9.95);
  }
  if (look.helix) {
    const [hxx, hyy] = lerp2(j.elbowF, j.handF, 0.38);
    f.ellipse(hxx, hyy - 1, 3.2, 4.0, { ramp: ['#2a0a10', '#6a2030', '#a8505a', '#d8908a', '#f2c0b0'], spec: 0.5 }, 10);
    f.ellipse(hxx + 0.5, hyy - 0.8, 1.4, 2.1, { ramp: ['#0b0507', '#3a0a12'], round: 0 }, 10.1);
  }

  // --- Gore ----------------------------------------------------------------------
  f.stain((x, y) => {
    const n = valueNoise(x, y, 2.5, 21);
    if (y > hemY - 6 + n * 6) return true; // robe hem soaked
    if (n > 0.82) return true; // old spatter, dried on cloth and steel
    if (x < hemX0 || x > hemX1) return false;
    const d = y - cloakHemY(x);
    return d > -9 + valueNoise(x, 0, 2, 5) * 7 && d < 10; // cloak hem dragged through blood
  }, OLD_BLOOD, [under, cloak, tabard, PLATE]);
  const [gx, gy] = j.handF;
  f.stain(
    (x, y) => y > hemY - 1 + valueNoise(x, 1, 2, 6) * 3 || valueNoise(x, y, 1.6, 33) > 0.93 || ((x - gx) ** 2 + (y - gy) ** 2 < 8 && hash2(x | 0, y | 0, 4) < 0.5),
    BLOOD,
    [under, robe, hood, tabard],
  );
  if (o.hurt) f.stain((x, y) => valueNoise(x, y, 2, 40) > 0.6, BLOOD);

  const pc = f.render({ ...KEY_LIGHT, ambient: 0.1, rim: 0.75 });
  return { pc, hand: [Math.round(j.handF[0]), Math.round(j.handF[1])] };
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

const HX = 52;
const HY = FOOT_Y - 30;
export const STAND: HeroPose = {
  x: HX,
  y: HY,
  lean: 0.06,
  head: 0.06,
  armF: { a: 0.22, b: 0.5 },
  armB: { a: -0.14, b: 0.35 },
  legF: { a: 0.2, b: 0.12 },
  legB: { a: -0.16, b: 0.12 },
  t: 0,
  wind: 0.1,
};

type PP = Partial<Omit<HeroPose, 'armF' | 'armB' | 'legF' | 'legB'>> & { armF?: [number, number]; armB?: [number, number]; legF?: [number, number]; legB?: [number, number] };
/** Shorthand pose: limbs as [a, b] pairs over STAND. */
function P(o: PP): HeroPose {
  const l = (v: [number, number] | undefined, d: Limb): Limb => (v ? { a: v[0], b: v[1] } : d);
  return { ...STAND, ...o, armF: l(o.armF, STAND.armF), armB: l(o.armB, STAND.armB), legF: l(o.legF, STAND.legF), legB: l(o.legB, STAND.legB) } as HeroPose;
}

/** Plant the lowest point of the body on the floor (then lift by `air`). */
function ground(p: HeroPose, air = 0): HeroPose {
  const j: Joints = solve(p, PR);
  const low = Math.max(j.footF[1] + 2.4, j.footB[1] + 2.4, j.kneeF[1] + 2.8, j.kneeB[1] + 2.8, j.hip[1] + 5, j.shoulder[1] + 5, j.head[1] + 6);
  return { ...p, y: p.y + (FOOT_Y + 0.4 - low) - air };
}

function idle(i: number, n: number): HeroPose {
  const ph = (i / n) * Math.PI * 2;
  const b = Math.sin(ph); // breath
  const c = Math.cos(ph);
  return ground(
    P({
      lean: 0.06 + b * 0.025,
      head: 0.08 + b * 0.05,
      armF: [0.22 + b * 0.05, 0.5 + b * 0.06],
      armB: [-0.14 - b * 0.04, 0.35 + b * 0.05],
      legF: [0.2, 0.12 + Math.max(0, -b) * 0.06],
      legB: [-0.16, 0.12 + Math.max(0, -b) * 0.06],
      wind: 0.12 + c * 0.08,
      t: i / n,
    }),
  );
}

/** Run with contact, down, passing and up positions; body bob comes from planting the stance foot. */
function run(i: number, n: number, crouch = 0): HeroPose {
  const ph = i / n;
  const s = Math.sin(ph * Math.PI * 2);
  const c = Math.cos(ph * Math.PI * 2);
  const stride = crouch ? 0.5 : 0.78;
  const lift = crouch ? 0.9 : 1.3;
  // knee folds hardest while the leg swings through (thigh moving forward)
  const knee = (cc: number, ss: number) => 0.22 + Math.max(0, cc) ** 0.8 * lift + Math.max(0, -ss) * 0.25;
  const p = P({
    lean: (crouch ? 0.48 : 0.3) + Math.abs(c) * 0.03,
    head: crouch ? 0.25 : 0.0 - Math.abs(c) * 0.03,
    legF: [s * stride + 0.1, knee(c, s)],
    legB: [-s * stride + 0.1, knee(-c, -s)],
    armF: [crouch ? 0.3 - s * 0.15 : -0.35 - s * 0.3, crouch ? 0.65 : 0.45 + Math.max(0, s) * 0.3],
    armB: [crouch ? -0.2 + s * 0.2 : -0.15 + s * 0.45, crouch ? 0.9 : 0.9 + s * 0.15],
    wind: crouch ? 0.35 + c * 0.05 : 0.75 + Math.abs(s) * 0.1,
    t: ph * 2,
  });
  // airborne just after each push-off
  const air = crouch ? 0 : Math.max(0, Math.sin(ph * Math.PI * 4 - 0.9)) * 1.6;
  return ground(p, air);
}

const JUMP: HeroPose[] = [
  // take-off: stretched long, back leg still pushing, arms thrown up
  P({ y: HY - 2, lean: 0.12, head: -0.15, armF: [2.1, 0.3], armB: [-0.9, 0.3], legF: [0.55, 1.0], legB: [-0.45, 0.05], wind: -0.05, t: 0.1 }),
  // rising: knees drawing up
  P({ y: HY - 2, lean: 0.14, head: -0.08, armF: [1.5, 0.6], armB: [-0.4, 0.6], legF: [1.0, 1.6], legB: [-0.05, 0.9], wind: -0.02, t: 0.3 }),
  P({ y: HY - 3, lean: 0.2, head: 0.0, armF: [1.0, 0.9], armB: [0.1, 0.9], legF: [1.25, 1.95], legB: [0.35, 1.6], wind: 0.15, t: 0.5 }),
  // apex: tucked, cloak starting to float
  P({ y: HY - 4, lean: 0.24, head: 0.08, armF: [0.8, 1.1], armB: [0.3, 1.0], legF: [1.35, 2.15], legB: [0.6, 1.95], wind: 0.55, t: 0.7 }),
];

function fall(i: number, n: number): HeroPose {
  const s = Math.sin((i / n) * Math.PI * 2);
  return P({
    y: HY - 3,
    lean: 0.0 + s * 0.02,
    head: -0.12,
    // arms flung up for balance, legs reaching for the ground
    armF: [1.95 + s * 0.08, 0.55],
    armB: [-1.7 - s * 0.08, 0.35],
    legF: [0.55 + s * 0.04, 0.9],
    legB: [-0.25 - s * 0.04, 0.35],
    wind: 1.55 + s * 0.12,
    t: i / n,
  });
}

// Attack phases. Arm angle `a`: 0 hangs down, +PI/2 points forward, PI points up.
// The live chain swings from swing.from to swing.to (degrees, y down), so the
// hand leads the arc: cocked at `from`, follows through past `to`.
const A = (o: PP) => ground(P(o));
/** Shared last recovery frame: back to guard, weight settling. */
const SETTLE = A({ lean: 0.1, head: 0.06, armF: [0.25, 0.5], armB: [-0.16, 0.38], legF: [0.3, 0.18], legB: [-0.24, 0.14], wind: 0.15, t: 0.9 });
const ATTACKS: Record<string, HeroPose[][]> = {
  // a1: overhead diagonal lash (-110 -> 35)
  a1: [
    [
      A({ lean: -0.04, head: 0.02, armF: [-1.4, 1.2], armB: [0.35, 1.3], legF: [0.42, 0.35], legB: [-0.32, 0.25], wind: 0.05, t: 0.1 }),
      A({ lean: -0.18, head: -0.08, armF: [-2.45, 0.35], armB: [0.6, 1.3], legF: [0.5, 0.4], legB: [-0.42, 0.3], wind: -0.1, t: 0.2 }),
    ],
    [
      A({ lean: 0.05, head: -0.05, armF: [3.1, -0.1], armB: [0.3, 0.6], legF: [0.62, 0.35], legB: [-0.5, 0.15], smear: 3.85, wind: 0.1, t: 0.3 }),
      A({ lean: 0.24, head: 0.05, armF: [1.75, 0.05], armB: [-0.4, 0.5], legF: [0.75, 0.45], legB: [-0.62, 0.1], smear: 3.1, wind: 0.45, t: 0.4 }),
      A({ lean: 0.36, head: 0.12, armF: [0.95, 0.15], armB: [-0.75, 0.4], legF: [0.82, 0.55], legB: [-0.66, 0.08], smear: 1.75, wind: 0.65, t: 0.5 }),
    ],
    [
      A({ lean: 0.4, head: 0.15, armF: [0.6, 0.3], armB: [-0.8, 0.45], legF: [0.82, 0.6], legB: [-0.66, 0.1], wind: 0.6, t: 0.6 }),
      A({ lean: 0.3, head: 0.12, armF: [0.45, 0.5], armB: [-0.5, 0.45], legF: [0.62, 0.45], legB: [-0.5, 0.15], wind: 0.35, t: 0.7 }),
      SETTLE,
    ],
  ],
  // a2: rising backhand (45 -> -80)
  a2: [
    [
      A({ lean: 0.28, head: 0.12, armF: [0.55, 1.4], armB: [-0.6, 0.6], legF: [0.55, 0.55], legB: [-0.45, 0.35], wind: 0.35, t: 0.1 }),
      A({ lean: 0.36, head: 0.16, armF: [0.15, 1.8], armB: [-0.9, 0.5], legF: [0.62, 0.75], legB: [-0.5, 0.45], wind: 0.45, t: 0.2 }),
    ],
    [
      A({ lean: 0.22, head: 0.05, armF: [1.3, 0.35], armB: [-0.8, 0.4], legF: [0.6, 0.45], legB: [-0.55, 0.15], smear: 0.3, wind: 0.4, t: 0.3 }),
      A({ lean: 0.02, head: -0.08, armF: [2.3, 0.05], armB: [-0.5, 0.4], legF: [0.55, 0.3], legB: [-0.55, 0.1], smear: 1.3, wind: 0.2, t: 0.4 }),
      A({ lean: -0.14, head: -0.18, armF: [2.95, -0.15], armB: [-0.2, 0.4], legF: [0.5, 0.25], legB: [-0.5, 0.08], smear: 2.3, wind: 0.05, t: 0.5 }),
    ],
    [
      A({ lean: -0.18, head: -0.2, armF: [3.2, -0.25], armB: [-0.1, 0.5], legF: [0.5, 0.25], legB: [-0.5, 0.1], wind: -0.05, t: 0.6 }),
      A({ lean: -0.06, head: -0.06, armF: [2.4, 0.3], armB: [-0.15, 0.45], legF: [0.42, 0.25], legB: [-0.38, 0.12], wind: 0.05, t: 0.7 }),
      SETTLE,
    ],
  ],
  // a3: two-handed overhead slam (-165 -> 70)
  a3: [
    [
      A({ lean: -0.1, head: -0.05, armF: [-1.7, 0.1], armB: [-1.5, 0.2], legF: [0.55, 0.6], legB: [-0.5, 0.4], wind: 0.05, t: 0.15 }),
      A({ lean: -0.3, head: -0.12, armF: [-2.55, -0.2], armB: [-2.35, -0.1], legF: [0.62, 0.7], legB: [-0.6, 0.5], wind: -0.15, t: 0.25 }),
      A({ lean: -0.34, head: -0.14, armF: [-2.65, -0.25], armB: [-2.45, -0.15], legF: [0.64, 0.74], legB: [-0.62, 0.52], wind: -0.2, t: 0.3 }),
    ],
    [
      A({ lean: -0.08, head: -0.1, armF: [3.0, -0.1], armB: [3.2, -0.1], legF: [0.75, 0.55], legB: [-0.6, 0.3], smear: 3.63, wind: 0.1, t: 0.4 }),
      A({ lean: 0.3, head: 0.05, armF: [1.95, 0.0], armB: [2.1, 0.05], legF: [0.95, 0.85], legB: [-0.72, 0.15], smear: 3.0, wind: 0.5, t: 0.5 }),
      A({ lean: 0.55, head: 0.15, armF: [1.0, 0.1], armB: [1.1, 0.15], legF: [1.1, 1.2], legB: [-0.8, 0.1], smear: 1.95, wind: 0.85, t: 0.6 }),
      A({ lean: 0.62, head: 0.2, armF: [0.45, 0.2], armB: [0.55, 0.25], legF: [1.15, 1.35], legB: [-0.82, 0.08], smear: 1.0, wind: 0.9, t: 0.7 }),
    ],
    [
      A({ lean: 0.64, head: 0.22, armF: [0.35, 0.25], armB: [0.45, 0.3], legF: [1.15, 1.4], legB: [-0.82, 0.08], wind: 0.7, t: 0.8 }),
      A({ lean: 0.52, head: 0.2, armF: [0.35, 0.4], armB: [0.3, 0.4], legF: [1.0, 1.2], legB: [-0.72, 0.12], wind: 0.4, t: 0.9 }),
      A({ lean: 0.34, head: 0.14, armF: [0.3, 0.5], armB: [0.0, 0.4], legF: [0.72, 0.75], legB: [-0.55, 0.15], wind: 0.2, t: 1.0 }),
      SETTLE,
    ],
  ],
  // up: forward, over the head, to behind (10 -> -190)
  up: [
    [
      A({ lean: 0.2, head: 0.1, armF: [1.1, 0.7], armB: [-0.4, 0.5], legF: [0.5, 0.65], legB: [-0.4, 0.5], wind: 0.25, t: 0.1 }),
      A({ lean: 0.26, head: 0.14, armF: [0.9, 1.0], armB: [-0.6, 0.5], legF: [0.62, 0.95], legB: [-0.45, 0.75], wind: 0.3, t: 0.2 }),
    ],
    [
      A({ lean: 0.0, head: -0.25, armF: [2.2, 0.1], armB: [-0.6, 0.4], legF: [0.35, 0.2], legB: [-0.3, 0.05], smear: 1.0, wind: 0.0, t: 0.3 }),
      A({ lean: -0.2, head: -0.45, armF: [3.25, -0.05], armB: [-0.4, 0.4], legF: [0.3, 0.12], legB: [-0.28, 0.05], smear: 2.2, wind: -0.1, t: 0.4 }),
      A({ lean: -0.3, head: -0.4, armF: [4.35, -0.1], armB: [-0.1, 0.5], legF: [0.32, 0.12], legB: [-0.3, 0.06], smear: 3.25, wind: -0.15, t: 0.5 }),
    ],
    [
      A({ lean: -0.26, head: -0.3, armF: [4.5, 0.0], armB: [0.0, 0.5], legF: [0.35, 0.18], legB: [-0.32, 0.1], wind: -0.1, t: 0.6 }),
      A({ lean: -0.1, head: -0.1, armF: [3.6, 0.5], armB: [-0.1, 0.45], legF: [0.3, 0.16], legB: [-0.26, 0.12], wind: 0.0, t: 0.7 }),
      SETTLE,
    ],
  ],
};

/** Heavy charge: the a3 wind-up held, trembling with strain. */
function charge(i: number): HeroPose {
  const w = ATTACKS.a3[0];
  const b = w[w.length - 1];
  if (i === 0) return b;
  const q = i === 1 ? 1 : -1;
  return { ...b, x: b.x + q * 0.6, armF: { a: b.armF.a + q * 0.06, b: b.armF.b }, armB: { a: b.armB.a - q * 0.05, b: b.armB.b }, wind: (b.wind ?? 0) + 0.15 + q * 0.12, t: i / 3 };
}

/** The dash: coil, explode into a low lunge with the cloak streaming, brake, rise. */
const SLIDE: HeroPose[] = [
  A({ lean: 0.55, head: 0.1, armF: [-0.7, 0.8], armB: [-0.3, 1.3], legF: [1.0, 1.4], legB: [-0.45, 1.0], wind: 0.4, t: 0.0 }),
  A({ lean: 1.0, head: -0.2, armF: [-1.5, 0.3], armB: [-1.1, 0.4], legF: [1.35, 1.9], legB: [-1.25, 0.05], wind: 1.0, streak: 0.6, t: 0.15 }),
  A({ lean: 1.08, head: -0.28, armF: [-1.65, 0.2], armB: [-1.3, 0.3], legF: [1.45, 2.05], legB: [-1.35, 0.0], wind: 1.15, streak: 1, t: 0.3 }),
  A({ lean: 1.08, head: -0.28, armF: [-1.6, 0.25], armB: [-1.25, 0.3], legF: [1.45, 2.05], legB: [-1.35, 0.0], wind: 1.1, streak: 0.9, t: 0.45 }),
  A({ lean: 0.92, head: -0.2, armF: [-1.3, 0.4], armB: [-1.0, 0.5], legF: [1.35, 1.9], legB: [-1.2, 0.15], wind: 0.95, streak: 0.5, t: 0.6 }),
  A({ lean: 0.7, head: -0.05, armF: [0.2, 1.0], armB: [-0.6, 0.7], legF: [1.15, 1.7], legB: [-0.8, 0.6], wind: 0.6, t: 0.75 }),
  A({ lean: 0.4, head: 0.05, armF: [0.3, 0.8], armB: [-0.3, 0.5], legF: [0.75, 0.95], legB: [-0.45, 0.5], wind: 0.35, t: 0.9 }),
];

const HURT: HeroPose[] = [
  A({ lean: -0.45, head: -0.55, armF: [-0.9, 1.1], armB: [-1.3, 0.6], legF: [0.5, 0.35], legB: [-0.15, 0.3], wind: 0.6, t: 0.2 }),
  A({ lean: -0.3, head: -0.3, armF: [-0.4, 1.0], armB: [-0.9, 0.7], legF: [0.55, 0.6], legB: [-0.3, 0.5], wind: 0.35, t: 0.35 }),
  A({ lean: 0.1, head: 0.2, armF: [0.3, 0.9], armB: [-0.3, 0.6], legF: [0.5, 0.7], legB: [-0.35, 0.55], wind: 0.1, t: 0.5 }),
];

const KNEEL: HeroPose[] = [
  // landing squat: weight dropped, arms out
  A({ lean: 0.4, head: 0.15, armF: [0.9, 0.7], armB: [-0.6, 0.5], legF: [1.25, 1.75], legB: [-0.2, 1.55], wind: -0.15, t: 0.1 }),
  A({ lean: 0.42, head: 0.35, armF: [0.8, 1.2], armB: [0.2, 1.2], legF: [1.4, 1.9], legB: [-0.05, 2.05], wind: 0.0, t: 0.2 }),
  // knelt, head bowed
  A({ lean: 0.3, head: 0.5, armF: [0.85, 1.6], armB: [0.65, 1.6], legF: [1.5, 1.6], legB: [-0.3, 2.3], wind: 0.05, t: 0.3 }),
];

const RAISE: HeroPose[] = [
  A({ lean: 0.2, head: 0.1, armF: [-0.4, 0.6], armB: [-0.6, 0.6], legF: [0.45, 0.45], legB: [-0.4, 0.35], wind: 0.2, t: 0.1 }),
  A({ lean: -0.05, head: -0.15, armF: [-1.9, 0.2], armB: [-1.7, 0.2], legF: [0.42, 0.3], legB: [-0.38, 0.22], wind: 0.1, t: 0.2 }),
  A({ lean: -0.16, head: -0.32, armF: [-2.8, 0.0], armB: [-2.55, 0.1], legF: [0.4, 0.25], legB: [-0.36, 0.2], wind: 0.05, t: 0.3 }),
];

const DIE: HeroPose[] = [
  A({ lean: -0.45, head: -0.6, armF: [-0.8, 1.0], armB: [-1.3, 0.5], legF: [0.5, 0.3], legB: [-0.1, 0.3], wind: 0.5, t: 0.0 }),
  A({ lean: -0.25, head: -0.4, armF: [-0.4, 0.7], armB: [-0.8, 0.5], legF: [0.6, 0.9], legB: [-0.2, 0.9], wind: 0.3, t: 0.15 }),
  // to the knees
  A({ lean: 0.05, head: -0.2, armF: [0.0, 0.4], armB: [-0.2, 0.4], legF: [1.45, 1.7], legB: [0.0, 2.3], wind: 0.05, t: 0.3 }),
  A({ lean: 0.2, head: 0.4, armF: [0.2, 0.3], armB: [0.1, 0.3], legF: [1.5, 1.6], legB: [0.05, 2.35], wind: 0.0, t: 0.4 }),
  // topple forward
  A({ lean: 0.75, head: 0.5, armF: [0.9, 0.6], armB: [0.7, 0.7], legF: [1.6, 1.7], legB: [0.3, 2.2], wind: -0.1, t: 0.5 }),
  A({ lean: 1.2, head: 0.3, armF: [1.5, 0.5], armB: [1.3, 0.7], legF: [-0.5, 0.9], legB: [-0.3, 1.3], wind: 0.25, t: 0.6 }),
  A({ lean: 1.52, head: 0.2, armF: [1.7, 0.2], armB: [1.5, 0.3], legF: [-1.25, 0.35], legB: [-1.15, 0.6], wind: 0.35, t: 0.7 }),
  A({ lean: 1.58, head: 0.12, armF: [1.62, 0.1], armB: [1.45, 0.2], legF: [-1.45, 0.12], legB: [-1.5, 0.28], wind: 0.3, t: 0.75 }),
];

function climb(i: number, n: number): HeroPose {
  const ph = (i / n) * Math.PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return P({
    y: HY + Math.abs(c) * 1.2,
    lean: -0.04,
    head: -0.25,
    armF: [-2.75 + s * 0.4, -0.25 - Math.max(0, -s) * 0.6],
    armB: [-2.75 - s * 0.4, -0.25 - Math.max(0, s) * 0.6],
    legF: [0.45 + s * 0.4, 0.8 + s * 0.5],
    legB: [0.45 - s * 0.4, 0.8 - s * 0.5],
    wind: 0.0,
    t: i / n,
  });
}

function hang(i: number, n: number): HeroPose {
  const s = Math.sin((i / n) * Math.PI * 2);
  return P({ lean: -0.1 + s * 0.03, head: -0.38, armF: [-3.0, 0.05], armB: [-2.9, 0.05], legF: [0.2 + s * 0.08, 0.25], legB: [-0.05 + s * 0.06, 0.45], wind: -0.05 + s * 0.06, t: i / n });
}

const MANTLE: HeroPose[] = [
  P({ y: HY + 2, lean: 0.1, head: -0.2, armF: [-2.4, -1.4], armB: [-2.3, -1.3], legF: [0.7, 1.2], legB: [0.2, 0.9], wind: 0, t: 0.1 }),
  P({ y: HY + 4, lean: 0.6, head: 0.1, armF: [0.2, 1.4], armB: [0.0, 1.5], legF: [1.3, 1.9], legB: [0.3, 1.6], wind: 0.2, t: 0.3 }),
  P({ y: HY + 6, lean: 0.75, head: 0.25, armF: [0.6, 1.0], armB: [0.4, 1.2], legF: [1.6, 2.1], legB: [-0.2, 1.4], wind: 0.35, t: 0.5 }),
  P({ y: HY + 3, lean: 0.4, head: 0.15, armF: [0.4, 0.8], armB: [0.0, 0.7], legF: [0.9, 1.2], legB: [-0.35, 0.8], wind: 0.25, t: 0.7 }),
];

export interface HeroMeta {
  /** Front hand position per frame index, for the live-drawn chain. */
  hands: [number, number][];
}

export const heroMeta: HeroMeta = { hands: [] };

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

export function buildHeroSheet(scene: Phaser.Scene, look: CitizenLook, key = 'player') {
  const sb = new SheetBuilder(key);
  const hands: [number, number][] = [];
  // Identical poses (shared settle / hold frames) are drawn once
  const cache = new Map<string, { pc: PixelCanvas; hand: [number, number] }>();
  const add = (name: string, poses: HeroPose[], fps: number, repeat = -1, hurt = false) => {
    const frames = poses.map((p, i) => {
      const h = hurt && i === 0;
      const key = JSON.stringify(p) + h;
      let r = cache.get(key);
      if (!r) cache.set(key, (r = drawHero({ look, pose: p, hurt: h })));
      hands.push(r.hand);
      return r.pc;
    });
    sb.add(name, frames, fps, repeat);
  };
  add('idle', seq(8).map((i) => idle(i, 8)), 7);
  add('run', seq(10).map((i) => run(i, 10)), 16);
  add('sneak', seq(6).map((i) => run(i, 6, 1)), 8);
  add('jump', JUMP, 11, 0);
  add('fall', seq(4).map((i) => fall(i, 4)), 10);
  // Attack phases: windup, active (smear frames, finished inside swing.active), recover
  const fps: Record<string, [number, number, number]> = { a1: [16, 30, 14], a2: [17, 30, 13], a3: [12, 25, 10], up: [17, 25, 12] };
  for (const k of ['a1', 'a2', 'a3', 'up'] as const) {
    ATTACKS[k].forEach((poses, i) => add(`${k}-${i}`, poses, fps[k][i], 0));
  }
  add('charge', seq(3).map(charge), 12);
  add('slide', SLIDE, 17, 0);
  add('hurt', HURT, 12, 0, true);
  add('kneel', KNEEL, 12, 0);
  add('raise', RAISE, 12, 0);
  add('die', DIE, 10, 0, true);
  add('climb', seq(6).map((i) => climb(i, 6)), 9);
  add('hang', seq(2).map((i) => hang(i, 2)), 2.5);
  add('mantle', MANTLE, 16, 0);
  add('air-attack', [ATTACKS.a3[1][1], ATTACKS.a3[1][3]], 14, 0);
  sb.build(scene);
  heroMeta.hands = hands;
}

/** Interpolated preview of a pose for debug galleries. */
export { mixPose };
