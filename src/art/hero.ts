import { KEY_LIGHT, type Material } from './render';
import { PixelCanvas, hash2 } from './pixel';
import { rgba } from './palette';
import { mixPose, solve, type Joints, type Limb, type Pose, type Proportions } from './rig';
import { SheetBuilder } from './sheet';
import { snesify } from './snes';

// ---------------------------------------------------------------------------
// The Severed, SNES scale: a penitent gunner about 40 px tall. Crimson cowl
// with a tall point, an iron mask with an ember eye slit, blackened steel
// pauldron and greaves, a dark robe under a tattered crimson cloak, and the
// Tether Cannon (a ribbed bone-and-iron arm-cannon with a glowing core) where
// the front forearm should be.
//
// Frames are drawn at 1x by a small cel renderer (inflated part masks lit by
// the key light, quantised into flat bands with no dithering, inner lines and
// a selective outline) and finished with snesify() to a 15-colour palette.
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

export const FW = 64;
export const FH = 56;
export const FOOT_Y = 52;

const PR: Proportions = { torso: 10.5, neck: 2.2, thigh: 9.2, shin: 9.2, upperArm: 6.5, foreArm: 5, shoulderBack: 0.5 };
/** Elbow to muzzle tip along the cannon. */
const CANNON = 13;

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

// Shared materials for other painters (props, gore)
export const BLOOD: Material = { ramp: ['#2a0208', '#4e0815', '#7a0c1c', '#a8122a', '#d0262f', '#ff5a4a'], spec: 0.9, round: 0.4 };
export const OLD_BLOOD: Material = { ramp: ['#1e070a', '#34090f', '#4e1018', '#6a1a1e', '#83292a'], spec: 0.15, round: 0.3 };
export const IRON: Material = { ramp: ['#0e0d10', '#26252b', '#3d3c44', '#5b5a63', '#87868f', '#c4c3c8'], spec: 0.9, round: 0.9 };
export const RUST: Material = { ramp: ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22', '#b06a36'], spec: 0.2 };

// ---------------------------------------------------------------------------
// Palette: 15 colours in all, chosen by hand so snesify() keeps them.
// ---------------------------------------------------------------------------

/** Cel material: a short ramp of flat bands. */
interface Mat {
  ramp: [number, number, number][];
  round: number;
  spec: number;
  bias: number;
  /** Colour for inner lines and the lit-side outline. */
  line: [number, number, number];
}

const to5 = (v: number) => {
  const q = Math.round((v / 255) * 31);
  return (q << 3) | (q >> 2);
};
/** Colour in the SNES 15-bit space. */
const C = (h: string): [number, number, number] => {
  const [r, g, b] = rgba(h);
  return [to5(r), to5(g), to5(b)];
};

/**
 * Quantise a frame with snesify(), then restore the frame's own hand-picked
 * colours: the frame is already within 15 colours of 15-bit space, so all
 * that should change is the dedithering. Where the median cut merged two bands
 * the original band is kept; a pixel snesify cleaned up takes the colour of
 * the neighbour it joined. Every frame so shares one sprite palette.
 */
function snesFrame(pc: PixelCanvas) {
  const d = pc.data;
  const n = pc.w * pc.h;
  const orig = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (d[i * 4 + 3]) orig[i] = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
  snesify(pc);
  const out = new Int32Array(n).fill(-1);
  const votes = new Map<number, Map<number, number>>();
  for (let i = 0; i < n; i++) {
    if (!d[i * 4 + 3]) continue;
    out[i] = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
    let m = votes.get(orig[i]);
    if (!m) votes.set(orig[i], (m = new Map()));
    m.set(out[i], (m.get(out[i]) ?? 0) + 1);
  }
  const usual = new Map<number, number>();
  for (const [k, m] of votes) {
    let best = -1;
    let bn = -1;
    for (const [c, cnt] of m) if (cnt > bn) ((bn = cnt), (best = c));
    usual.set(k, best);
  }
  const w = pc.w;
  for (let i = 0; i < n; i++) {
    if (out[i] < 0) continue;
    let c = orig[i];
    if (usual.get(c) !== out[i]) {
      // Cleaned up: join the neighbour snesify matched it to
      for (const q of [i - 1, i + 1, i - w, i + w])
        if (q >= 0 && q < n && out[q] === out[i] && usual.get(orig[q]) === out[q]) {
          c = orig[q];
          break;
        }
    }
    d[i * 4] = c >> 16;
    d[i * 4 + 1] = (c >> 8) & 255;
    d[i * 4 + 2] = c & 255;
  }
}
const INK = C('#0c0609');
const STEEL_R = ['#1d1d29', '#363a4c', '#5d6478', '#a3abc0'];
const ROBE_R = ['#190f18', '#36242f'];
const BONE_R = ['#6a573a', '#b29f74', '#e8dfbd'];
const HOT = '#ffdc9c';

function mat(r: string[], o: Partial<Omit<Mat, 'ramp' | 'line'>> & { line?: string } = {}): Mat {
  return { ramp: r.map(C), round: o.round ?? 1, spec: o.spec ?? 0, bias: o.bias ?? 0, line: o.line ? C(o.line) : INK };
}

const STEEL = mat(STEEL_R, { spec: 0.55 });
const PLATE = mat(STEEL_R, { spec: 0.45, round: 0.7 });
const STEEL_BACK = mat(STEEL_R.slice(0, 3), { round: 0.8, bias: -0.12 });
const ROBE = mat(ROBE_R, { round: 0.7, bias: 0.05 });
const ROBE_BACK = mat(ROBE_R, { round: 0.6, bias: -0.25 });
const BONE = mat(BONE_R, { round: 1, spec: 0.25, bias: -0.08 });
const VOID = mat([ROBE_R[0]], { round: 0 });

interface Pal {
  cloak: Mat;
  cloth: Mat; // cowl, mantle, tabard
  glow: Mat;
  ember: Mat;
}
const PAL_CACHE = new Map<string, Pal>();

/** The concept's crimson: a light or grey robe tone is pulled back toward it. */
function cloakTone(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r > 90 && r > g * 2 && r > b * 1.6 ? hex : '#9a1626';
}

function palette(look: CitizenLook): Pal {
  const base = cloakTone(look.robe);
  let p = PAL_CACHE.get(base);
  if (p) return p;
  // Four crimson bands keyed off the look's robe (canonical #9a1626)
  const cr = [shade(base, -0.62), shade(base, -0.32), shade(base, 0.04), shade(base, 0.34)];
  p = {
    cloak: mat(cr, { round: 0.55, bias: -0.04, line: cr[0] }),
    cloth: mat(cr, { round: 0.85, bias: 0.04, line: cr[0] }),
    glow: mat([cr[1], cr[2], cr[3]], { round: 0.6, bias: 0.3 }),
    ember: mat([cr[3], HOT], { round: 0, bias: 0.45 }),
  };
  PAL_CACHE.set(base, p);
  return p;
}

// ---------------------------------------------------------------------------
// Cel renderer
// ---------------------------------------------------------------------------

type Mask = (x: number, y: number) => boolean;
type V = [number, number];

const LN = Math.hypot(KEY_LIGHT.x, KEY_LIGHT.y, KEY_LIGHT.z);
const LX = KEY_LIGHT.x / LN;
const LY = KEY_LIGHT.y / LN;
const LZ = KEY_LIGHT.z / LN;
const HL = Math.hypot(LX, LY, LZ + 1);
const HX_ = LX / HL;
const HY_ = LY / HL;
const HZ_ = (LZ + 1) / HL;

class Cel {
  readonly n = FW * FH;
  mat = new Int16Array(this.n).fill(-1);
  part = new Int16Array(this.n).fill(-1);
  z = new Float32Array(this.n).fill(-1e9);
  v = new Float32Array(this.n);
  mats: Mat[] = [];
  private mi = new Map<Mat, number>();
  private parts = 0;
  // scratch
  private ins = new Uint8Array(this.n);
  private d = new Float32Array(this.n);

  private idx(m: Mat) {
    let i = this.mi.get(m);
    if (i === undefined) {
      i = this.mats.length;
      this.mats.push(m);
      this.mi.set(m, i);
    }
    return i;
  }

  add(mask: Mask, m: Mat, layer: number, x0: number, y0: number, x1: number, y1: number) {
    const bx0 = Math.max(0, Math.floor(x0) - 1);
    const by0 = Math.max(0, Math.floor(y0) - 1);
    const bx1 = Math.min(FW - 1, Math.ceil(x1) + 1);
    const by1 = Math.min(FH - 1, Math.ceil(y1) + 1);
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    if (bw <= 0 || bh <= 0) return;
    const ins = this.ins;
    const d = this.d;
    let any = false;
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const k = mask(bx0 + x + 0.5, by0 + y + 0.5);
        ins[y * bw + x] = k ? 1 : 0;
        d[y * bw + x] = k ? 1e6 : 0;
        if (k) any = true;
      }
    if (!any) return;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : d[y * bw + x]);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (ins[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
      }
    let maxD = 0;
    for (let y = bh - 1; y >= 0; y--)
      for (let x = bw - 1; x >= 0; x--) {
        const i = y * bw + x;
        if (!ins[i]) continue;
        d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
        if (d[i] > maxD) maxD = d[i];
      }
    const R = Math.max(1, maxD);
    const hgt = (x: number, y: number) => {
      const t = Math.min(1, at(x, y) / R);
      return t <= 0 ? 0 : Math.sqrt(1 - (1 - t) * (1 - t)) * R;
    };
    const pid = this.parts++;
    const mid = this.idx(m);
    const round = m.round;
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (!ins[i]) continue;
        const h = hgt(x, y);
        const zz = layer * 1000 + h * round;
        const o = (by0 + y) * FW + bx0 + x;
        if (zz < this.z[o]) continue;
        let nx = -(hgt(x + 1, y) - hgt(x - 1, y)) * 0.5 * round;
        let ny = -(hgt(x, y + 1) - hgt(x, y - 1)) * 0.5 * round;
        let nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        const dif = Math.max(0, nx * LX + ny * LY + nz * LZ);
        const rim = (1 - nz) * (1 - nz) * Math.max(0, nx * 0.9 + ny * 0.2) * 0.55;
        const spec = m.spec ? Math.pow(Math.max(0, nx * HX_ + ny * HY_ + nz * HZ_), 14) * m.spec : 0;
        this.z[o] = zz;
        this.mat[o] = mid;
        this.part[o] = pid;
        this.v[o] = 0.12 + dif * 0.9 + rim + spec + m.bias;
      }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, m: Mat, layer: number, rot = 0) {
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const r = Math.max(rx, ry);
    this.add(
      (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const u = dx * c - dy * s;
        const v = dx * s + dy * c;
        return (u * u) / (rx * rx) + (v * v) / (ry * ry) <= 1;
      },
      m,
      layer,
      cx - r,
      cy - r,
      cx + r,
      cy + r,
    );
  }

  capsule(a: V, b: V, ra: number, rb: number, m: Mat, layer: number) {
    const [ax, ay] = a;
    const [bx, by] = b;
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const r = Math.max(ra, rb);
    this.add(
      (x, y) => {
        let t = ((x - ax) * dx + (y - ay) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + dx * t - x;
        const py = ay + dy * t - y;
        const rr = ra + (rb - ra) * t;
        return px * px + py * py <= rr * rr;
      },
      m,
      layer,
      Math.min(ax, bx) - r,
      Math.min(ay, by) - r,
      Math.max(ax, bx) + r,
      Math.max(ay, by) + r,
    );
  }

  /** Polygon with a per-row crossing cache. */
  poly(pts: V[], m: Mat, layer: number) {
    const n = pts.length;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    const cross = new Float64Array(n);
    let nc = 0;
    let rowY = NaN;
    this.add(
      (x, y) => {
        if (y !== rowY) {
          rowY = y;
          nc = 0;
          for (let i = 0, k = n - 1; i < n; k = i++) {
            const yi = pts[i][1];
            const yk = pts[k][1];
            if (yi > y !== yk > y) cross[nc++] = ((pts[k][0] - pts[i][0]) * (y - yi)) / (yk - yi) + pts[i][0];
          }
        }
        let inside = false;
        for (let i = 0; i < nc; i++) if (x < cross[i]) inside = !inside;
        return inside;
      },
      m,
      layer,
      x0,
      y0,
      x1,
      y1,
    );
  }

  /** Seam: darkest band where lit, ink where already in shadow. */
  seam(mask: Mask, only: Mat) {
    const om = this.mi.get(only);
    if (om === undefined) return;
    for (let o = 0; o < this.n; o++) {
      if (this.mat[o] !== om) continue;
      if (mask((o % FW) + 0.5, ((o / FW) | 0) + 0.5)) this.v[o] = this.v[o] * only.ramp.length < 1.05 ? -9 : -1;
    }
  }

  /** Shift the lighting of existing pixels (bands, ribs, folds). */
  tone(mask: Mask, dv: number, only?: Mat) {
    const om = only ? this.mi.get(only) : undefined;
    if (only && om === undefined) return;
    for (let o = 0; o < this.n; o++) {
      if (this.mat[o] < 0 || (om !== undefined && this.mat[o] !== om)) continue;
      if (mask((o % FW) + 0.5, ((o / FW) | 0) + 0.5)) this.v[o] += dv;
    }
  }

  render(): PixelCanvas {
    const pc = new PixelCanvas(FW, FH);
    const D = pc.data;
    const put = (o: number, c: [number, number, number]) => {
      D[o * 4] = c[0];
      D[o * 4 + 1] = c[1];
      D[o * 4 + 2] = c[2];
      D[o * 4 + 3] = 255;
    };
    const { mat, part, z, v } = this;
    for (let o = 0; o < this.n; o++) {
      const mi = mat[o];
      if (mi < 0) continue;
      const m = this.mats[mi];
      let val = v[o];
      // Contact shadow under a nearer part
      for (const up of [FW, FW * 2]) {
        const a = o - up;
        if (a >= 0 && mat[a] >= 0 && part[a] !== part[o] && z[a] > z[o] + 400) {
          val -= up === FW ? 0.3 : 0.15;
          break;
        }
      }
      if (val < -5) {
        put(o, INK);
        continue;
      }
      const r = m.ramp;
      const k = Math.max(0, Math.min(r.length - 1, Math.floor(val * r.length)));
      put(o, r[k]);
    }
    // Inner lines where a part sits well in front of another
    for (let o = 0; o < this.n; o++) {
      if (mat[o] < 0) continue;
      const x = o % FW;
      for (const q of [x < FW - 1 ? o + 1 : -1, x > 0 ? o - 1 : -1, o + FW, o - FW]) {
        if (q < 0 || q >= this.n || mat[q] < 0 || part[q] === part[o]) continue;
        if (z[q] > z[o] + 450) {
          put(o, this.mats[mat[o]].line);
          break;
        }
      }
    }
    // Outer outline: ink, softened to the material's own dark on the lit (upper-left) side
    const marks: [number, [number, number, number]][] = [];
    for (let o = 0; o < this.n; o++) {
      if (mat[o] >= 0) continue;
      const x = o % FW;
      const r = x < FW - 1 ? o + 1 : -1;
      const l = x > 0 ? o - 1 : -1;
      const dn = o + FW < this.n ? o + FW : -1;
      const up = o - FW;
      const has = (q: number) => q >= 0 && mat[q] >= 0;
      if (!(has(r) || has(l) || has(dn) || has(up))) continue;
      const lit = (has(r) || has(dn)) && !has(l) && !has(up);
      const q = has(r) ? r : has(dn) ? dn : has(l) ? l : up;
      const m = this.mats[mat[q]];
      marks.push([o, lit && m.line !== INK ? m.line : lit ? m.ramp[0] : INK]);
    }
    for (const [o, c] of marks) put(o, c);
    return pc;
  }
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

/**
 * Hero pose: the rig pose plus the gun and the cloth.
 * - aim: cannon direction in rig angles (0 down, PI/2 forward, PI up). When
 *   set, the front arm is solved to hold the cannon on that line.
 * - brace: the back hand supports the cannon from below.
 * - cloak: cloak direction (0 hangs, PI/2 streams flat behind, more lifts it)
 * - flap: ripple amplitude; streak: dash speed lines (0..1)
 */
export interface HeroPose extends Pose {
  aim?: number;
  brace?: boolean;
  cloak?: number;
  flap?: number;
  streak?: number;
}

const PI = Math.PI;
const FWD = PI / 2;
const DUP = (3 * PI) / 4;
const DDN = PI / 4;
const UP = PI;
const DOWN = 0;

/** Upper-arm angle that holds the cannon on a given aim. */
function upperFor(aim: number) {
  const ys = [0.55, 0.3, 0.6, 1.2, 1.75];
  const t = Math.max(0, Math.min(3.999, (aim / PI) * 4));
  const i = Math.floor(t);
  return ys[i] + (ys[i + 1] - ys[i]) * (t - i);
}

const lerp2 = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const seg = (p: V, ang: number, len: number): V => [p[0] + Math.sin(ang) * len, p[1] + Math.cos(ang) * len];

/** Two-bone IK in rig angles; the elbow bends below the reach line. */
function ik(s: V, t: V, l1: number, l2: number): Limb {
  const dx = t[0] - s[0];
  const dy = t[1] - s[1];
  const D = Math.max(0.01, Math.min(l1 + l2 - 0.01, Math.hypot(dx, dy)));
  const phi = Math.atan2(dx, dy);
  const al = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))));
  const a = phi - al;
  const e = seg(s, a, l1);
  const b = Math.atan2(s[0] + dx - e[0], s[1] + dy - e[1]) - a;
  return { a, b };
}

const HX = 29;
const HY = FOOT_Y - 20;

export const STAND: HeroPose = {
  x: HX,
  y: HY,
  lean: 0.05,
  head: 0.05,
  armF: { a: 0.55, b: 1.0 },
  armB: { a: -0.1, b: 0.3 },
  legF: { a: 0.3, b: 0.2 },
  legB: { a: -0.24, b: 0.12 },
  t: 0,
  aim: FWD,
  brace: true,
  cloak: 0.3,
  flap: 0.5,
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
  const low = Math.max(j.footF[1] + 1.7, j.footB[1] + 1.7, j.kneeF[1] + 2, j.kneeB[1] + 2, j.hip[1] + 3, j.shoulder[1] + 3.5, j.neck[1] + 7);
  return { ...p, y: p.y + (FOOT_Y - low) - air };
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

interface Drawn {
  pc: PixelCanvas;
  hand: [number, number];
  muzzle: [number, number, number];
}

/** Draw one frame of the Severed. */
export function drawHero(o: { look: CitizenLook; pose: HeroPose; hurt?: boolean }): Drawn {
  const { pose } = o;
  const pal = palette(o.look);
  const f = new Cel();
  // The cannon arm holds its aim
  let armF = pose.armF;
  if (pose.aim !== undefined) {
    const a = upperFor(pose.aim);
    armF = { a, b: pose.aim - a };
  }
  const p: Pose = { ...pose, armF };
  const j = solve(p, PR);
  const ph = pose.t * PI * 2;

  const [sx, sy] = j.shoulder;
  const cl = Math.cos(pose.lean);
  const sl = Math.sin(pose.lean);
  /** Body space: ox forward, oy down the spine from the shoulder. */
  const T = (ox: number, oy: number): V => [sx + cl * ox - sl * oy, sy + sl * ox + cl * oy];
  const ha = pose.lean + pose.head;
  const ch = Math.cos(ha);
  const shh = Math.sin(ha);
  const hc = seg(j.neck, PI - ha, 3.4);
  const H = (ox: number, oy: number): V => [hc[0] + ch * ox - shh * oy, hc[1] + shh * ox + ch * oy];
  const floorY = FOOT_Y - 1;
  const floor = (q: V): V => (q[1] > floorY ? [q[0] - (q[1] - floorY) * 0.7, floorY] : q);

  // --- Dash speed lines ------------------------------------------------------
  if (pose.streak) {
    for (let i = 0; i < 3; i++) {
      const y = j.hip[1] - 9 + i * 5 + hash2(i, 1, 3) * 2;
      const x1 = j.hip[0] - 14 - hash2(i, 2, 3) * 4;
      const len = (8 + hash2(i, 3, 3) * 10) * pose.streak;
      f.capsule([x1 - len, y], [x1, y], 0.3, 0.55, pal.cloak, 0.2);
    }
  }

  // --- Cloak: from the back of the shoulders, tattered at the hem -------------
  {
    const ang = pose.cloak ?? 0.12;
    const amp = pose.flap ?? 0.6;
    const N = 8;
    const L = 21 - Math.max(0, ang - 1.2) * 3;
    const bend = ang > 1.3 ? -0.55 : ang > 0.4 ? -0.25 : 0.05;
    let [cx, cy] = T(-3.6, -1.6);
    const back: V[] = [];
    const front: V[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const th = ang + bend * t;
      if (i > 0) {
        cx -= Math.sin(th) * (L / N);
        cy += Math.cos(th) * (L / N);
      }
      const rip = Math.sin(t * 4.6 - ph) * amp * t;
      const bx = cx + Math.cos(th) * rip;
      const by = cy + Math.sin(th) * rip;
      const w = 5.5 + t * 4.5;
      back.push(floor([bx, by]));
      front.push(floor([bx + Math.cos(th) * w, by + Math.sin(th) * w]));
    }
    const bb = back[N];
    const fb = front[N];
    const thE = ang + bend;
    const hem: V[] = [];
    const TEETH = 7;
    for (let i = 1; i < TEETH; i++) {
      const t = i / TEETH;
      const deep = (i % 2 ? 3.4 : 0.2) + hash2(i, 5, 17) * 1.6 + Math.sin(ph + i) * 0.6;
      hem.push(floor([bb[0] + (fb[0] - bb[0]) * t - Math.sin(thE) * deep, bb[1] + (fb[1] - bb[1]) * t + Math.cos(thE) * deep]));
    }
    f.poly([...back, ...hem, ...front.slice().reverse(), T(0, 8), T(0.5, -1)], pal.cloak, 1);
    // A fold down the cloak
    const fold = back.map((q, i) => lerp2(q, front[i], 0.5));
    f.tone((x, y) => {
      for (let i = 2; i < N; i++) {
        const q = fold[i];
        if (Math.abs(x - q[0]) < 0.7 && Math.abs(y - q[1]) < L / N / 1.6) return true;
      }
      return false;
    }, -0.22, pal.cloak);
  }

  // --- Back arm --------------------------------------------------------------
  const sB: V = [sx - 1.4, sy + 0.6];
  let armB = pose.armB;
  const dir: V = [Math.sin(armF.a + armF.b), Math.cos(armF.a + armF.b)];
  const below: V = [-dir[1], dir[0]];
  if (pose.brace) armB = ik(sB, [j.elbowF[0] + dir[0] * 3 + below[0] * 2.4, j.elbowF[1] + dir[1] * 3 + below[1] * 2.4], PR.upperArm, PR.foreArm);
  const eB = seg(sB, armB.a, PR.upperArm);
  const hB = seg(eB, armB.a + armB.b, PR.foreArm);
  f.capsule(sB, eB, 1.7, 1.5, ROBE_BACK, 2);
  f.capsule(eB, hB, 1.5, 1.4, STEEL_BACK, 2.1);
  f.ellipse(hB[0], hB[1], 1.5, 1.5, STEEL_BACK, pose.brace ? 8.6 : 2.2);

  // --- Legs: dark thighs, steel greaves, pointed sabatons ------------------------
  const leg = (knee: V, foot: V, limb: Limb, back: boolean, layer: number) => {
    const shinA = limb.a - limb.b;
    const grounded = foot[1] >= FOOT_Y - 3;
    const toe = grounded ? 0 : Math.max(-0.4, Math.min(1.2, -shinA * 0.8 + 0.2));
    const m = back ? STEEL_BACK : STEEL;
    f.capsule(lerp2(j.hip, knee, 0.1), knee, 2.4, 2.0, back ? ROBE_BACK : ROBE, layer);
    f.capsule(knee, lerp2(knee, foot, 0.95), 1.9, 1.5, m, layer + 0.2);
    f.ellipse(knee[0] + 0.5, knee[1] - 0.2, 1.8, 1.7, m, layer + 0.25);
    const tx = Math.cos(toe);
    const ty = Math.sin(toe);
    f.capsule([foot[0] - tx * 1.2, foot[1] - ty * 1.2 + 0.3], [foot[0] + tx * 4.2, foot[1] + ty * 4.2 + 0.7], 1.5, 0.8, m, layer + 0.3);
  };
  leg(j.kneeB, j.footB, pose.legB, true, 3);

  // --- Dark robe skirt over the thighs -----------------------------------------
  const [hx, hy] = j.hip;
  {
    const kneeY = Math.max(j.kneeF[1], j.kneeB[1]);
    const hemY = Math.min(kneeY - 1.5, hy + 6);
    const front = Math.max(hx + 4, j.kneeF[0] - 1, j.kneeB[0] - 1);
    const back = Math.min(hx - 4.5, j.kneeB[0] - 1.5, j.kneeF[0] - 1.5) + Math.sin(ph) * 0.6;
    const pts: V[] = [T(4, 9.5), [hx + 4, hy], [front + 0.5, hemY - 1]];
    const R = 4;
    for (let i = 0; i <= R; i++) {
      const t = i / R;
      pts.push([front + (back - front) * t, hemY + (i % 2) * 2 + hash2(i, 3, 11) * 1.2 - t * 1.5]);
    }
    pts.push([back - 0.5, hy + 1], T(-4, 9));
    f.poly(pts, ROBE, 4);
  }
  leg(j.kneeF, j.footF, pose.legF, false, 4.4);

  // --- Torso: breastplate, crimson sash and tabard ------------------------------
  f.poly([T(-3.4, -0.6), T(2.2, -1), T(4.2, 2), T(4.6, 5.5), T(3.6, 9.4), T(-3.4, 9.8), T(-4.2, 4.5)], PLATE, 6);
  f.capsule(T(-3.8, 9.4), T(4.2, 9.6), 1.1, 1.1, pal.cloth, 6.3);
  {
    const kx = (j.kneeF[0] - hx) * 0.35 + Math.sin(ph) * 0.3;
    const a = T(1.2, 10);
    const b = T(4.4, 10.2);
    const by = Math.min(j.kneeF[1], hy + 8) + 0.5;
    f.poly([a, b, [b[0] + kx + 0.3, by - 0.5], [b[0] + kx - 1.2, by + 1.2], [a[0] + kx + 1, by - 0.2], [a[0] + kx, by + 1]], pal.cloth, 6.2);
  }

  // --- Mantle: crimson capelet with a ragged edge -------------------------------
  {
    const hem: V[] = [];
    const MT = 4;
    for (let i = 0; i <= MT; i++) {
      const t = i / MT;
      hem.push(T(3.4 - t * 8.6 - (pose.cloak ?? 0) * t * 1.2, 2.6 + (i % 2 ? 1.6 : 0) + t * 1.6 + Math.sin(ph + t * 3) * 0.3 * t));
    }
    f.poly([T(2, -2.6), T(3.8, 0), ...hem, T(-5.4, -0.5), T(-3.8, -2.8)], pal.cloth, 6.5);
  }

  // --- Head: cowl with its tall point, iron mask, ember eye -----------------------
  {
    const cloak = pose.cloak ?? 0;
    const sw = Math.max(-0.3, Math.min(1.2, cloak * 0.7)) + Math.sin(ph) * 0.08;
    // The point trails in world space at speed
    const hp = (pose.lean + Math.max(0, pose.head) * 0.6) * (1 - 0.7 * Math.max(0, Math.min(1, cloak / 1.4)));
    const Hp = (ox: number, oy: number): V => [hc[0] + Math.cos(hp) * ox - Math.sin(hp) * oy, hc[1] + Math.sin(hp) * ox + Math.cos(hp) * oy];
    // drape over the neck
    f.poly([H(-4, 1), H(2.4, 3.2), T(3, -0.8), T(-4, -0.6)], pal.cloth, 7);
    f.poly([H(-3.6, -1), H(-4.2, -3.2), Hp(-5.4 - sw * 1.2, -6.4 + sw * 0.8), Hp(-7.6 - sw * 2.6, -10.4 + sw * 3.2), Hp(-3.2 - sw * 0.8, -7.6 + sw * 0.8), H(-0.4, -4.4), H(1.2, -3.8)], pal.cloth, 7.1);
    f.ellipse(...H(-0.4, -0.2), 4.1, 4.3, pal.cloth, 7.2, ha);
    // dark opening of the cowl
    f.ellipse(...H(2.4, 0.6), 2.2, 2.9, VOID, 7.4, ha);
    // iron mask and its ember slit
    f.ellipse(...H(2.9, 0.9), 1.3, 2.3, STEEL, 7.5, ha);
    f.capsule(H(2.6, -0.1), H(4.1, -0.1), 0.55, 0.55, pal.ember, 7.6);
    // brim over the brow
    f.capsule(H(-0.6, -3.6), H(3.4, -2.2), 1.2, 0.9, pal.cloth, 7.7);
  }

  // --- Front arm: spiked pauldron and the Tether Cannon ----------------------------
  const e = j.elbowF;
  const at = (t: number, n = 0): V => [e[0] + dir[0] * t + below[0] * n, e[1] + dir[1] * t + below[1] * n];
  // Sleeve (mostly under the pauldron)
  f.capsule(j.shoulder, e, 2.0, 1.8, ROBE, 7.8);
  {
    const phi = armF.a * 0.35 + pose.lean * 0.5;
    const ux = Math.sin(phi);
    const uy = Math.cos(phi);
    const Q = (a: number, d: number): V => [sx + 0.4 + ux * d + uy * a, sy + 0.8 + uy * d - ux * a];
    // spike, raked back
    const sb = Q(-1, -2.4);
    const sa = phi + PI + 0.5;
    f.poly([[sb[0] - 1, sb[1]], seg(sb, sa, 3.4), [sb[0] + 1, sb[1] + 0.4]], STEEL, 8.1);
    const dome: V[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = (i / 6) * PI;
      dome.push(Q(-Math.cos(t) * 3.9, 0.6 - Math.sin(t) * 3.2));
    }
    f.poly([...dome, Q(3.3, 2.4), Q(0, 3.1), Q(-3.3, 2.4)], STEEL, 8.2);
    f.poly([Q(-3.1, 2.2), Q(3.3, 2.2), Q(2.8, 4.4), Q(0, 4.9), Q(-2.7, 4.2)], PLATE, 8.15);
  }
  // Cannon: iron housing over the forearm, ribbed bone barrel, banded, glowing core and muzzle
  f.ellipse(e[0], e[1], 1.9, 1.9, STEEL, 9);
  f.capsule(at(-0.4), at(3.2), 2.6, 2.5, STEEL, 9.1);
  f.capsule(at(3), at(11.2), 2.4, 2.7, BONE, 9.2);
  // ribs: dark vertebra seams across the bone
  // vertebra ridges ringing the barrel
  for (const t of [5.4, 9.6]) f.capsule(at(t, -2.75), at(t, 2.75), 0.75, 0.75, BONE, 9.7);
  f.capsule(at(3.4, -2.4), at(3.4, 2.4), 0.7, 0.7, STEEL, 9.4);
  // core: a crimson window glowing in the barrel
  f.ellipse(...at(7.6, -0.4), 1.5, 1.3, pal.glow, 9.3, -Math.atan2(dir[1], dir[0]));
  f.ellipse(...at(7.6, -0.7), 0.55, 0.5, pal.ember, 9.35);
  // muzzle: iron collar, glowing mouth
  f.capsule(at(11, -2.7), at(11, 2.7), 0.9, 0.9, STEEL, 9.4);
  f.ellipse(...at(12.3), 1.1, 1.9, pal.glow, 9.5, -Math.atan2(dir[1], dir[0]));
  f.ellipse(...at(12.6), 0.5, 0.9, pal.ember, 9.6, -Math.atan2(dir[1], dir[0]));

  // Hurt: the steel flares hot for a frame
  if (o.hurt) f.tone(() => true, 0.22, STEEL);

  const pc = f.render();
  snesFrame(pc);
  const tip = at(CANNON);
  const aim = armF.a + armF.b;
  const r1 = (v: number) => Math.round(v * 2) / 2;
  return {
    pc,
    hand: [Math.round(tip[0]), Math.round(tip[1])],
    muzzle: [r1(tip[0]), r1(tip[1]), Math.round(Math.atan2(Math.cos(aim), Math.sin(aim)) * 1000) / 1000],
  };
}

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

function idle(i: number, n: number): HeroPose {
  const b = Math.sin((i / n) * PI * 2); // breath
  return ground(P({ lean: 0.05 + b * 0.02, head: 0.05 + b * 0.04, legF: [0.3, 0.2 + Math.max(0, -b) * 0.05], legB: [-0.24, 0.12 + Math.max(0, -b) * 0.05], cloak: 0.3 + b * 0.05, flap: 0.5, t: i / n }));
}

function aim(a: number, o: PP = {}): HeroPose {
  return ground(P({ aim: a, brace: a > DDN && a < UP - 0.1, ...(a > DUP ? { head: -0.08, lean: -0.03 } : {}), ...o }));
}

/** Run: two strides per cycle; body bob comes from planting the stance foot. */
function run(i: number, n: number, a: number): HeroPose {
  const ph = i / n;
  const s = Math.sin(ph * PI * 2);
  const c = Math.cos(ph * PI * 2);
  const knee = (cc: number, ss: number) => 0.2 + Math.max(0, cc) ** 0.8 * 1.35 + Math.max(0, -ss) * 0.25;
  const p = P({
    lean: 0.24 + Math.abs(c) * 0.03,
    head: -0.08,
    legF: [s * 0.8 + 0.12, knee(c, s)],
    legB: [-s * 0.8 + 0.12, knee(-c, -s)],
    aim: a,
    brace: false,
    armB: [-s * 0.85 + 0.15, 0.7 + Math.max(0, -s) * 0.5],
    cloak: 0.95 + Math.abs(s) * 0.12,
    flap: 1.1,
    t: ph * 2,
  });
  const air = Math.max(0, Math.sin(ph * PI * 4 - 0.9)) * 1.3;
  return ground(p, air);
}

function crouch(a: number): HeroPose {
  return ground(P({ lean: 0.22, head: 0.0, legF: [1.45, 2.1], legB: [0.3, 1.85], aim: a, brace: a < UP - 0.1, cloak: 0.2, t: 0.2 }));
}

const AIR_LEGS: PP = { legF: [1.15, 1.6], legB: [0.25, 1.4] };
function air(a: number, o: PP = {}): HeroPose {
  return P({ y: HY - 2, lean: 0.12, head: 0.0, ...AIR_LEGS, aim: a, brace: false, armB: [-0.6, 0.8], cloak: 1.2, flap: 1.0, t: 0.4, ...o });
}

const JUMP: HeroPose[] = [
  // take-off: stretched long, back leg still pushing
  P({ y: HY - 1, lean: 0.12, head: -0.12, legF: [0.6, 1.0], legB: [-0.45, 0.08], aim: FWD, brace: false, armB: [-0.9, 0.4], cloak: 0.05, flap: 0.4, t: 0.1 }),
  // rising: knees drawing up, cloak dragged below
  P({ y: HY - 2, lean: 0.14, head: -0.06, legF: [1.0, 1.6], legB: [0.0, 1.1], aim: FWD, brace: false, armB: [-0.6, 0.6], cloak: 0.25, flap: 0.6, t: 0.3 }),
  // apex hold: tucked, cloak starting to float
  P({ y: HY - 2, ...AIR_LEGS, lean: 0.14, aim: FWD, brace: false, armB: [-0.4, 0.8], cloak: 0.9, flap: 0.8, t: 0.6 }),
];

function fall(i: number, n: number): HeroPose {
  const s = Math.sin((i / n) * PI * 2 + 0.6);
  return P({ y: HY - 2, lean: 0.04, head: -0.1, legF: [0.6 + s * 0.05, 0.9], legB: [-0.2 - s * 0.05, 0.45], aim: FWD, brace: false, armB: [-1.4 - s * 0.1, 0.4], cloak: 1.75 + s * 0.1, flap: 1.3, t: i / n });
}

/** The dash: coil, explode into a low lunge with the cloak streaming, brake. */
const SLIDE: HeroPose[] = [
  ground(P({ lean: 0.5, head: -0.1, legF: [1.0, 1.4], legB: [-0.45, 1.0], aim: FWD, brace: false, armB: [-0.6, 0.8], cloak: 0.6, flap: 0.6, t: 0.0 })),
  ground(P({ lean: 0.8, head: -0.4, legF: [1.4, 1.85], legB: [-1.15, 0.05], aim: FWD, brace: false, armB: [-1.2, 0.4], cloak: 1.45, flap: 1, streak: 0.6, t: 0.17 })),
  ground(P({ lean: 0.86, head: -0.45, legF: [1.5, 2.0], legB: [-1.3, 0.0], aim: FWD, brace: false, armB: [-1.3, 0.3], cloak: 1.6, flap: 1.1, streak: 1, t: 0.34 })),
  ground(P({ lean: 0.86, head: -0.45, legF: [1.5, 2.0], legB: [-1.3, 0.0], aim: FWD, brace: false, armB: [-1.25, 0.35], cloak: 1.55, flap: 1.1, streak: 0.9, t: 0.5 })),
  ground(P({ lean: 0.7, head: -0.3, legF: [1.4, 1.9], legB: [-1.1, 0.25], aim: FWD, brace: false, armB: [-1.0, 0.5], cloak: 1.3, flap: 0.9, streak: 0.4, t: 0.67 })),
  ground(P({ lean: 0.42, head: -0.05, legF: [1.0, 1.4], legB: [-0.6, 0.7], aim: FWD, brace: false, armB: [-0.5, 0.6], cloak: 0.7, flap: 0.7, t: 0.84 })),
];

const HURT: HeroPose[] = [
  ground(P({ lean: -0.4, head: -0.5, aim: undefined, armF: [1.3, 1.0], armB: [-1.3, 0.6], brace: false, legF: [0.5, 0.35], legB: [-0.15, 0.3], cloak: 0.7, flap: 1, t: 0.2 })),
  ground(P({ lean: -0.22, head: -0.25, aim: undefined, armF: [1.0, 0.8], armB: [-0.9, 0.7], brace: false, legF: [0.55, 0.6], legB: [-0.3, 0.5], cloak: 0.4, flap: 0.8, t: 0.4 })),
];

const DIE: HeroPose[] = [
  ground(P({ lean: -0.45, head: -0.6, aim: undefined, armF: [1.2, 1.0], armB: [-1.3, 0.5], brace: false, legF: [0.5, 0.3], legB: [-0.1, 0.3], cloak: 0.6, t: 0.0 })),
  ground(P({ lean: -0.25, head: -0.4, aim: undefined, armF: [0.6, 0.6], armB: [-0.8, 0.5], brace: false, legF: [0.6, 0.9], legB: [-0.2, 0.9], cloak: 0.35, t: 0.15 })),
  // to the knees
  ground(P({ lean: 0.05, head: -0.2, aim: undefined, armF: [0.15, 0.3], armB: [-0.2, 0.4], brace: false, legF: [1.45, 1.7], legB: [0.0, 2.3], cloak: 0.08, t: 0.3 })),
  ground(P({ lean: 0.2, head: 0.45, aim: undefined, armF: [0.2, 0.2], armB: [0.1, 0.3], brace: false, legF: [1.5, 1.6], legB: [0.05, 2.35], cloak: 0.0, t: 0.4 })),
  // topple forward
  ground(P({ lean: 0.75, head: 0.5, aim: undefined, armF: [0.9, 0.5], armB: [0.7, 0.7], brace: false, legF: [1.6, 1.7], legB: [0.3, 2.2], cloak: 0.1, t: 0.5 })),
  ground(P({ lean: 1.2, head: 0.3, aim: undefined, armF: [1.5, 0.3], armB: [1.3, 0.7], brace: false, legF: [-0.5, 0.9], legB: [-0.3, 1.3], cloak: 0.5, t: 0.6 })),
  ground(P({ lean: 1.52, head: 0.2, aim: undefined, armF: [1.7, 0.1], armB: [1.5, 0.3], brace: false, legF: [-1.25, 0.35], legB: [-1.15, 0.6], cloak: 1.3, flap: 0.3, t: 0.7 })),
  ground(P({ lean: 1.58, head: 0.12, aim: undefined, armF: [1.62, 0.0], armB: [1.45, 0.2], brace: false, legF: [-1.45, 0.12], legB: [-1.5, 0.28], cloak: 1.45, flap: 0.2, t: 0.75 })),
];

function climb(i: number, n: number): HeroPose {
  const ph = (i / n) * PI * 2;
  const s = Math.sin(ph);
  const c = Math.cos(ph);
  return P({
    y: HY + Math.abs(c) * 1,
    lean: -0.04,
    head: -0.25,
    aim: undefined,
    brace: false,
    // hand over hand; the cannon stays pointed up, out of the way
    armF: [2.45 + s * 0.45, PI - 2.45 - s * 0.45 + 0.05],
    armB: [2.45 - s * 0.45, PI - 2.45 + s * 0.45 - 0.2],
    legF: [0.45 + s * 0.4, 0.8 + s * 0.5],
    legB: [0.45 - s * 0.4, 0.8 - s * 0.5],
    cloak: 0.05,
    flap: 0.4,
    t: i / n,
  });
}

function hang(i: number, n: number): HeroPose {
  const s = Math.sin((i / n) * PI * 2);
  return P({ lean: -0.08 + s * 0.03, head: -0.35, aim: undefined, brace: false, armF: [2.85, 0.2], armB: [-2.9, 0.05], legF: [0.2 + s * 0.08, 0.25], legB: [-0.05 + s * 0.06, 0.45], cloak: 0.02 + s * 0.04, flap: 0.3, t: i / n });
}

const MANTLE: HeroPose[] = [
  P({ y: HY + 1, lean: 0.1, head: -0.2, aim: undefined, brace: false, armF: [2.5, 0.5], armB: [-2.3, -1.3], legF: [0.7, 1.2], legB: [0.2, 0.9], cloak: 0, t: 0.1 }),
  P({ y: HY + 3, lean: 0.6, head: 0.1, aim: undefined, brace: false, armF: [0.6, 1.2], armB: [0.0, 1.5], legF: [1.3, 1.9], legB: [0.3, 1.6], cloak: 0.25, t: 0.3 }),
  P({ y: HY + 4, lean: 0.75, head: 0.25, aim: undefined, brace: false, armF: [0.7, 0.9], armB: [0.4, 1.2], legF: [1.6, 2.1], legB: [-0.2, 1.4], cloak: 0.4, t: 0.5 }),
  P({ y: HY + 2, lean: 0.4, head: 0.15, aim: undefined, brace: false, armF: [0.6, 0.7], armB: [0.0, 0.7], legF: [0.9, 1.2], legB: [-0.35, 0.8], cloak: 0.25, t: 0.7 }),
];

const KNEEL: HeroPose[] = [
  ground(P({ lean: 0.35, head: 0.15, aim: DDN, brace: false, armB: [-0.6, 0.5], legF: [1.25, 1.75], legB: [-0.2, 1.55], cloak: 0.2, t: 0.1 })),
  ground(P({ lean: 0.38, head: 0.35, aim: 0.5, brace: false, armB: [0.2, 1.2], legF: [1.4, 1.9], legB: [-0.05, 2.05], cloak: 0.1, t: 0.2 })),
  // knelt, head bowed, the cannon grounded before the altar
  ground(P({ lean: 0.28, head: 0.55, aim: 0.35, brace: false, armB: [0.65, 1.4], legF: [1.5, 1.6], legB: [-0.3, 2.3], cloak: 0.05, t: 0.3 })),
];

// ---------------------------------------------------------------------------
// Sheet
// ---------------------------------------------------------------------------

export interface HeroMeta {
  /** Muzzle tip [x, y, angleRad] per sheet frame (facing right; 0 = forward, -PI/2 = up). */
  muzzle: [number, number, number][];
  /** Front "hand" (the muzzle tip, rounded) per sheet frame. */
  hands: [number, number][];
}

export const heroMeta: HeroMeta = { muzzle: [], hands: [] };

export interface HeroAnim {
  name: string;
  frames: PixelCanvas[];
  fps: number;
  repeat: number;
}

const seq = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Draw every animation (no Phaser needed); fills heroMeta as a side effect. */
export function drawHeroAnims(look: CitizenLook): HeroAnim[] {
  const out: HeroAnim[] = [];
  const muzzle: [number, number, number][] = [];
  const hands: [number, number][] = [];
  const cache = new Map<string, Drawn>();
  const add = (name: string, poses: HeroPose[], fps: number, repeat = -1, hurt = false) => {
    const frames = poses.map((p, i) => {
      const h = hurt && i === 0;
      const k = JSON.stringify(p) + h;
      let r = cache.get(k);
      if (!r) cache.set(k, (r = drawHero({ look, pose: p, hurt: h })));
      muzzle.push(r.muzzle);
      hands.push(r.hand);
      return r.pc;
    });
    out.push({ name, frames, fps, repeat });
  };
  add('idle', seq(4).map((i) => idle(i, 4)), 4);
  add('aim-up', [aim(UP)], 1);
  add('aim-diag-up', [aim(DUP)], 1);
  add('aim-diag-down', [aim(DDN)], 1);
  add('run', seq(10).map((i) => run(i, 10, FWD)), 18);
  add('run-diag-up', seq(10).map((i) => run(i, 10, DUP)), 18);
  add('run-diag-down', seq(10).map((i) => run(i, 10, DDN)), 18);
  add('crouch', [crouch(FWD)], 1);
  add('crouch-diag-up', [crouch(DUP)], 1);
  add('jump', JUMP, 12, 0);
  add('fall', seq(2).map((i) => fall(i, 2)), 8);
  add('air-fwd', [air(FWD)], 1);
  add('air-up', [air(UP)], 1);
  add('air-diag-up', [air(DUP)], 1);
  add('air-diag-down', [air(DDN)], 1);
  add('air-down', [air(DOWN, { legF: [0.9, 1.5], legB: [-0.1, 1.2] })], 1);
  add('slide', SLIDE, 14, 0);
  add('hurt', HURT, 10, 0, true);
  add('die', DIE, 10, 0);
  add('climb', seq(6).map((i) => climb(i, 6)), 9);
  add('hang', seq(2).map((i) => hang(i, 2)), 2.5);
  add('mantle', MANTLE, 14, 0);
  add('kneel', KNEEL, 10, 0);
  heroMeta.muzzle = muzzle;
  heroMeta.hands = hands;
  return out;
}

export function buildHeroSheet(scene: Phaser.Scene, look: CitizenLook, key = 'player') {
  const sb = new SheetBuilder(key);
  for (const a of drawHeroAnims(look)) sb.add(a.name, a.frames, a.fps, a.repeat);
  sb.build(scene);
}

/** Interpolated preview of a pose for debug galleries. */
export { mixPose };
