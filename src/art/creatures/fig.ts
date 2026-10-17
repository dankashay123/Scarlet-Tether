// Creature renderer: the volumetric `Figure` (render.ts) tuned for small,
// SNES-style anatomical sprites.
//
// Same API as render.ts's Figure (masks inflated into height fields, lit and
// quantised onto ramps), plus:
//  - design scale: every coordinate, radius and bounding box passed in is in
//    "design" units; the figure rasterises them at `s` output pixels per unit.
//    Geometry is re-solved at the small size (masks are sampled at each output
//    pixel, with sub-pixel samples so thin parts stay continuous, and parts
//    never shrink below one pixel), so a creature authored at the old 360-px
//    scale draws cleanly at the 224-px one;
//  - relief: a per-pixel bump layer that bends normals, so ribs, tendons and
//    folds catch light (`relief()`, Material.bump); detail too fine for the
//    output size is dropped instead of turning into noise;
//  - cast shadows: a nearer part darkens what lies just beneath it on the
//    side away from the key light, which separates limbs from bodies;
//  - SNES shading: each material is cut to a few clean colour bands (little
//    or no dithering, quiet textures), wrap lighting on soft materials, crisp
//    specular glints on wet and polished ones (Material.glint);
//  - selective outlines: near-black on the shadow side, a dark shade of the
//    material on the side the key light hits.
import type { Light, Material as BaseMaterial } from '../render';
import { PixelCanvas } from '../pixel';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
import { rgba } from '../palette';

export interface Material extends BaseMaterial {
  /** Height texture (bends normals): >0 raised, <0 recessed. */
  bump?: (x: number, y: number) => number;
  /** Dither strength 0 (posterised) .. 1 (full ordered dither). Default 0.55. */
  dither?: number;
  /** Diffuse wrap: soft materials (skin, cloth) light past the terminator. */
  wrap?: number;
  /** Colour painted where the specular peak is strongest. */
  glint?: string;
  /** Specular exponent (default 24). */
  shine?: number;
}

type Mask = (x: number, y: number) => boolean;
/** Inline shapes (k 0: capsule, k 1: ellipse) in output pixels — rasterised without a closure call per pixel. */
interface Shape { k: 0 | 1; ax: number; ay: number; dx: number; dy: number; iL2: number; ra: number; dr: number }
type BBox = [number, number, number, number];

/** Thinnest part radius, in output pixels (keeps 1-px strands continuous). */
const MIN_R = 0.55;
/** Most shade bands per material (SNES sprites use 3–5 per material). */
const BANDS = 5;

const OUT_RGB = rgba('#080306');
let scratch = new Float32Array(4096);
interface Buffers { mat: Int16Array; part: Int16Array; z: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; bmp: Float32Array }
const pool = new Map<number, Buffers[]>();
const bandCache = new Map<string[], string[]>();

/** A ramp cut down to at most BANDS shades, darkest and lightest kept. */
function bands(r: string[]): string[] {
  if (r.length <= BANDS) return r;
  let b = bandCache.get(r);
  if (!b) {
    b = [];
    for (let i = 0; i < BANDS; i++) b.push(r[Math.round((i * (r.length - 1)) / (BANDS - 1))]);
    bandCache.set(r, b);
  }
  return b;
}

export class Figure {
  /** Output size in pixels. */
  readonly w: number;
  readonly h: number;
  /** Output pixels per design unit. */
  readonly s: number;
  private readonly is: number;
  // design → pixel: px = x * A + ox (A is s, times any local zoom)
  private A: number;
  private ox = 0;
  private oy = 0;
  private mat: Int16Array;
  private part: Int16Array;
  private z: Float32Array;
  private nx: Float32Array;
  private ny: Float32Array;
  private nz: Float32Array;
  private bmp: Float32Array;
  private mats: Material[] = [];
  private matIndex = new Map<Material, number>();
  private parts = 0;
  /** Pixels each part won (small parts — eyes, teeth, lips — get no inner line). */
  private area: number[] = [];
  // bounds of everything drawn so far, in pixels (whole-canvas passes only walk this)
  private fx0 = 1e9;
  private fy0 = 1e9;
  private fx1 = -1;
  private fy1 = -1;

  /** `w`×`h` output pixels; coordinates passed to the drawing calls are scaled by `s`. */
  constructor(w: number, h: number, s = 1) {
    this.w = w;
    this.h = h;
    this.s = s;
    this.is = 1 / s;
    this.A = s;
    const n = w * h;
    // buffers are recycled between frames (a sheet renders dozens of same-size figures)
    const b = pool.get(n)?.pop();
    if (b) {
      this.mat = b.mat.fill(-1);
      this.part = b.part.fill(-1);
      this.z = b.z.fill(-1e9);
      this.nx = b.nx;
      this.ny = b.ny;
      this.nz = b.nz;
      this.bmp = b.bmp;
    } else {
      this.mat = new Int16Array(n).fill(-1);
      this.part = new Int16Array(n).fill(-1);
      this.z = new Float32Array(n).fill(-1e9);
      this.nx = new Float32Array(n);
      this.ny = new Float32Array(n);
      this.nz = new Float32Array(n);
      this.bmp = new Float32Array(n);
    }
  }

  /** Hand the buffers back for the next figure (the figure is unusable after). */
  private release() {
    const n = this.w * this.h;
    let list = pool.get(n);
    if (!list) pool.set(n, (list = []));
    if (list.length < 4) list.push({ mat: this.mat, part: this.part, z: this.z, nx: this.nx, ny: this.ny, nz: this.nz, bmp: this.bmp });
  }

  private mi(m: Material) {
    let i = this.matIndex.get(m);
    if (i === undefined) {
      i = this.mats.length;
      this.mats.push(m);
      this.matIndex.set(m, i);
    }
    return i;
  }

  /**
   * Draw what follows `k` times larger about the design point (cx, cy), so a
   * feature that must read at sprite size (a face, a fist) can be exaggerated
   * the way pixel artists do. `zoom()` with no arguments resets it.
   */
  zoom(cx = 0, cy = 0, k = 1) {
    this.A = this.s * k;
    this.ox = cx * this.s * (1 - k);
    this.oy = cy * this.s * (1 - k);
  }

  /** Is anything drawn at this design-space point? */
  has(x: number, y: number) {
    x = (x * this.A + this.ox) | 0;
    y = (y * this.A + this.oy) | 0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] >= 0;
  }

  /**
   * Coverage test of a design-space mask at output pixel (px, py): the pixel
   * centre, or at least two of four quarter-pixel samples (so strands thinner
   * than a pixel still draw as an unbroken line).
   */
  private hit(mask: Mask, px: number, py: number) {
    const iA = 1 / this.A;
    const cx = (px + 0.5 - this.ox) * iA;
    const cy = (py + 0.5 - this.oy) * iA;
    if (mask(cx, cy)) return true;
    if (iA <= 1) return false;
    const q = 0.27 * iA;
    let n = 0;
    if (mask(cx - q, cy - q)) n++;
    if (mask(cx + q, cy + q)) n++;
    if (n === 2) return true;
    if (mask(cx + q, cy - q)) n++;
    if (n === 2) return true;
    if (n === 0) return false;
    return mask(cx - q, cy + q);
  }

  /** Add a part from a design-space mask (bbox in design units). */
  add(mask: Mask, m: Material, layer: number, bbox?: BBox) {
    const { A, ox, oy } = this;
    this.addPx(mask, m, layer, bbox ? [bbox[0] * A + ox, bbox[1] * A + oy, bbox[2] * A + ox, bbox[3] * A + oy] : undefined, true);
  }

  private addPx(mask: Mask | Shape, m: Material, layer: number, bbox: BBox | undefined, design: boolean) {
    const [x0, y0, x1, y1] = bbox ?? [0, 0, this.w - 1, this.h - 1];
    // one pixel of air around the part so the distance transform sees an edge
    const bx0 = Math.max(0, Math.floor(x0) - 1) - 1;
    const by0 = Math.max(0, Math.floor(y0) - 1) - 1;
    const bx1 = Math.min(this.w - 1, Math.ceil(x1) + 1) + 1;
    const by1 = Math.min(this.h - 1, Math.ceil(y1) + 1) + 1;
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    if (bw <= 2 || bh <= 2) return;
    const n = bw * bh;
    if (scratch.length < n) scratch = new Float32Array(n * 2);
    const d = scratch;
    const INF = 1e6;
    let any = false;
    const W0 = this.w;
    const H0 = this.h;
    for (let y = 0; y < bh; y++) {
      const yy = by0 + y;
      const py = yy + 0.5;
      const edgeY = y === 0 || y === bh - 1 || yy < 0 || yy >= H0;
      for (let x = 0; x < bw; x++) {
        const xx = bx0 + x;
        let inside = false;
        if (!(edgeY || x === 0 || x === bw - 1 || xx < 0 || xx >= W0)) {
          const px = xx + 0.5;
          if (typeof mask === 'function') inside = design ? this.hit(mask, xx, yy) : mask(px, py);
          else if (mask.k === 0) {
            // capsule
            let t = ((px - mask.ax) * mask.dx + (py - mask.ay) * mask.dy) * mask.iL2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = px - mask.ax - mask.dx * t;
            const ey = py - mask.ay - mask.dy * t;
            const r = mask.ra + mask.dr * t;
            inside = ex * ex + ey * ey <= r * r;
          } else {
            // rotated ellipse
            const dx = px - mask.ax;
            const dy = py - mask.ay;
            const u = dx * mask.dx - dy * mask.dy;
            const v = dx * mask.dy + dy * mask.dx;
            inside = u * u * mask.iL2 + v * v * mask.ra <= 1;
          }
        }
        if (inside) {
          d[y * bw + x] = INF;
          any = true;
        } else d[y * bw + x] = 0;
      }
    }
    if (!any) return;
    // chamfer distance to the nearest outside pixel (border is always outside)
    for (let y = 1; y < bh - 1; y++)
      for (let x = 1; x < bw - 1; x++) {
        const i = y * bw + x;
        let v = d[i];
        if (v === 0) continue;
        const a = d[i - 1] + 1;
        const b = d[i - bw] + 1;
        const c = d[i - bw - 1] + 1.414;
        const e = d[i - bw + 1] + 1.414;
        if (a < v) v = a;
        if (b < v) v = b;
        if (c < v) v = c;
        if (e < v) v = e;
        d[i] = v;
      }
    let maxD = 0;
    for (let y = bh - 2; y >= 1; y--)
      for (let x = bw - 2; x >= 1; x--) {
        const i = y * bw + x;
        let v = d[i];
        if (v === 0) continue;
        const a = d[i + 1] + 1;
        const b = d[i + bw] + 1;
        const c = d[i + bw + 1] + 1.414;
        const e = d[i + bw - 1] + 1.414;
        if (a < v) v = a;
        if (b < v) v = b;
        if (c < v) v = c;
        if (e < v) v = e;
        d[i] = v;
        if (v > maxD) maxD = v;
      }
    const R = Math.max(1, maxD);
    const iR = 1 / R;
    // convert distance into a rounded height, in place
    for (let i = 0; i < n; i++) {
      const v = d[i];
      if (v <= 0) continue;
      const t = 1 - Math.min(1, v * iR);
      d[i] = Math.sqrt(1 - t * t) * R;
    }
    const round = m.round ?? 1;
    const pid = this.parts++;
    let won = 0;
    const mid = this.mi(m);
    const bump = m.bump;
    const W = this.w;
    const { A, ox, oy } = this;
    const iA = 1 / A;
    if (bx0 + 1 < this.fx0) this.fx0 = Math.max(0, bx0 + 1);
    if (by0 + 1 < this.fy0) this.fy0 = Math.max(0, by0 + 1);
    if (bx1 - 1 > this.fx1) this.fx1 = Math.min(this.w - 1, bx1 - 1);
    if (by1 - 1 > this.fy1) this.fy1 = Math.min(this.h - 1, by1 - 1);
    for (let y = 1; y < bh - 1; y++)
      for (let x = 1; x < bw - 1; x++) {
        const i = y * bw + x;
        const hv = d[i];
        if (hv <= 0) continue;
        const zz = layer * 1000 + hv * round;
        const o = (by0 + y) * W + bx0 + x;
        if (zz < this.z[o]) continue;
        const gx = (d[i + 1] - d[i - 1]) * 0.5 * round;
        const gy = (d[i + bw] - d[i - bw]) * 0.5 * round;
        const l = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        this.z[o] = zz;
        this.mat[o] = mid;
        this.part[o] = pid;
        this.nx[o] = -gx * l;
        this.ny[o] = -gy * l;
        this.nz[o] = l;
        // bump heights scale with the figure so slopes keep their angle
        this.bmp[o] = bump ? bump((bx0 + x + 0.5 - ox) * iA, (by0 + y + 0.5 - oy) * iA) * A : 0;
        won++;
      }
    this.area[pid] = won;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material, layer: number, rot = 0) {
    const { A, ox, oy } = this;
    cx = cx * A + ox;
    cy = cy * A + oy;
    rx = Math.max(MIN_R, rx * A);
    ry = Math.max(MIN_R, ry * A);
    const r = Math.max(rx, ry);
    this.addPx({ k: 1, ax: cx, ay: cy, dx: Math.cos(-rot), dy: Math.sin(-rot), iL2: 1 / (rx * rx), ra: 1 / (ry * ry), dr: 0 }, m, layer, [cx - r, cy - r, cx + r, cy + r], false);
  }

  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, m: Material, layer: number) {
    const { A, ox, oy } = this;
    ax = ax * A + ox;
    ay = ay * A + oy;
    bx = bx * A + ox;
    by = by * A + oy;
    ra = Math.max(MIN_R, ra * A);
    rb = Math.max(MIN_R, rb * A);
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const R = Math.max(ra, rb);
    this.addPx({ k: 0, ax, ay, dx, dy, iL2: 1 / L2, ra, dr: rb - ra }, m, layer, [Math.min(ax, bx) - R, Math.min(ay, by) - R, Math.max(ax, bx) + R, Math.max(ay, by) + R], false);
  }

  poly(pts0: [number, number][], m: Material, layer: number) {
    // rasterised directly at the output size
    const { A, ox: zx, oy: zy } = this;
    const pts = pts0.map(([x, y]) => [x * A + zx, y * A + zy] as [number, number]);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    // scanline-rasterise once, then the mask is a lookup
    const ox = Math.floor(x0) - 1;
    const oy = Math.floor(y0) - 1;
    const pw = Math.ceil(x1) - ox + 2;
    const ph = Math.ceil(y1) - oy + 2;
    const buf = new Uint8Array(pw * ph);
    const xs: number[] = [];
    for (let r = 0; r < ph; r++) {
      const yy = oy + r + 0.5;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > yy !== yj > yy) xs.push(((xj - xi) * (yy - yi)) / (yj - yi) + xi);
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        // pixel centres x+0.5 strictly left of the right crossing, at/after the left
        const a = Math.max(0, Math.ceil(xs[k] - 0.5 - ox));
        const b = Math.min(pw - 1, Math.ceil(xs[k + 1] - 0.5 - ox) - 1);
        for (let c = a; c <= b; c++) buf[r * pw + c] = 1;
      }
    }
    this.addPx(
      (x, y) => {
        const c = Math.floor(x) - ox;
        const r = Math.floor(y) - oy;
        return c >= 0 && r >= 0 && c < pw && r < ph && buf[r * pw + c] === 1;
      },
      m,
      layer,
      [x0, y0, x1, y1],
      false,
    );
  }

  /** Pixel region of a design-space bbox, clipped to what has been drawn. */
  private region(bbox: BBox | undefined): [number, number, number, number] {
    if (!bbox) return [this.fx0, this.fy0, this.fx1, this.fy1];
    const { A, ox, oy } = this;
    return [Math.max(this.fx0, Math.floor(bbox[0] * A + ox) - 1), Math.max(this.fy0, Math.floor(bbox[1] * A + oy) - 1), Math.min(this.fx1, Math.ceil(bbox[2] * A + ox) + 1), Math.min(this.fy1, Math.ceil(bbox[3] * A + oy) + 1)];
  }

  /** Repaint existing pixels (keeps their shape and relief). Mask and bbox in design units. */
  stain(mask: Mask, m: Material, only?: Material[], bbox?: BBox) {
    const mid = this.mi(m);
    const allow = only ? only.map((x) => this.matIndex.get(x)).filter((x): x is number => x !== undefined) : null;
    if (allow && !allow.length) return;
    const [x0, y0, x1, y1] = this.region(bbox);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const o = y * this.w + x;
        const k = this.mat[o];
        if (k < 0) continue;
        if (allow && allow.indexOf(k) < 0) continue;
        if (this.hit(mask, x, y)) this.mat[o] = mid;
      }
  }

  /**
   * Add relief (height) to existing pixels: `fn` (design units) returns the
   * height to add (0 for none). Raised ridges catch the key light on their
   * upper-left side and fall into shadow on the other, like real anatomy.
   */
  relief(fn: (x: number, y: number) => number, bbox?: BBox, only?: Material[]) {
    const allow = only ? only.map((x) => this.matIndex.get(x)).filter((x): x is number => x !== undefined) : null;
    if (allow && !allow.length) return;
    const [x0, y0, x1, y1] = this.region(bbox);
    const { A, ox, oy } = this;
    const iA = 1 / A;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const o = y * this.w + x;
        const k = this.mat[o];
        if (k < 0 || (allow && allow.indexOf(k) < 0)) continue;
        const v = fn((x + 0.5 - ox) * iA, (y + 0.5 - oy) * iA);
        if (v) this.bmp[o] += v * A;
      }
  }

  /**
   * Stains (bruises, spatter, grime) leave lone pixels at sprite size: a pixel
   * whose material differs from its neighbours within the same part, where
   * those neighbours agree, takes their material. Separate parts (an eye, a
   * tooth) are never touched, so deliberate 1-px details survive.
   */
  private despeckle() {
    const { w: W, mat, part } = this;
    const src = mat.slice();
    for (let y = Math.max(1, this.fy0); y <= Math.min(this.h - 2, this.fy1); y++)
      for (let x = Math.max(1, this.fx0); x <= Math.min(W - 2, this.fx1); x++) {
        const o = y * W + x;
        const c = src[o];
        if (c < 0) continue;
        const p = part[o];
        let m = -1;
        let same = 0;
        let n = 0;
        for (let j = 0; j < 4; j++) {
          const q = j === 0 ? o - 1 : j === 1 ? o + 1 : j === 2 ? o - W : o + W;
          if (part[q] !== p) continue;
          n++;
          const k = src[q];
          if (k === c) same++;
          else if (m === -1) m = k;
          else if (k !== m) m = -2;
        }
        // isolated (no same-material neighbour) or a 1-px nub poking out
        if (m >= 0 && n >= 3 && same === 0) mat[o] = m;
      }
  }

  render(light: Light, outline = '#080306'): PixelCanvas {
    const { w: W, h: H } = this;
    const pc = new PixelCanvas(W, H);
    if (this.fx1 < 0) return pc;
    const data = pc.data;
    const small = this.s < 1;
    let lx = light.x;
    let ly = light.y;
    let lz = light.z;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll;
    ly /= ll;
    lz /= ll;
    let hx = lx;
    let hy = ly;
    let hz = lz + 1;
    const hl = Math.hypot(hx, hy, hz);
    hx /= hl;
    hy /= hl;
    hz /= hl;
    // screen-space direction toward the light (for cast shadows)
    const l2 = Math.hypot(lx, ly) || 1;
    const sx = lx / l2;
    const sy = ly / l2;
    const PN = small ? Math.max(2, Math.round(5 * this.s)) : 5;
    const pdx = new Int32Array(PN);
    const pdy = new Int32Array(PN);
    const pk = new Float32Array(PN);
    for (let t = 1; t <= PN; t++) {
      pdx[t - 1] = Math.round(sx * t);
      pdy[t - 1] = Math.round(sy * t);
      pk[t - 1] = 0.24 * (1 - ((t - 1) / PN) * 0.8);
    }
    if (small) this.despeckle();
    const mats = this.mats;
    // SNES: few clean bands per material, almost no dither, quiet textures
    const rgbs = mats.map((m) => (small ? bands(m.ramp) : m.ramp).map((c) => rgba(c)));
    const glints = mats.map((m) => (m.glint ? rgba(m.glint) : null));
    const wraps = mats.map((m) => m.wrap ?? 0.15);
    const dths = mats.map((m) => (m.dither ?? 0.55) * (small ? 0.12 : 1));
    const specs = mats.map((m) => m.spec ?? 0);
    const shines = mats.map((m) => m.shine ?? 24);
    const texs = mats.map((m) => m.tex ?? null);
    const texK = small ? 0.35 : 1;
    const is = this.is;
    const { mat, part, z, nx: NX, ny: NY, nz: NZ, bmp } = this;
    const put = (o: number, c: readonly number[]) => {
      const i = o * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    };
    // sprite size: lift the shadows a little and calm fine relief, so the
    // forms read as a few clean bands rather than a field of creases
    const ambient = light.ambient + (small ? 0.12 : 0);
    const bK = small ? 0.3 : 1;
    const rimK = light.rim;
    const X0 = this.fx0;
    const Y0 = this.fy0;
    const X1 = this.fx1;
    const Y1 = this.fy1;
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        const o = y * W + x;
        const mi = mat[o];
        if (mi < 0) continue;
        const p = part[o];
        // relief gradient within the same part
        const b0 = bmp[o];
        const bl = x > 0 && part[o - 1] === p ? bmp[o - 1] : b0;
        const br = x < W - 1 && part[o + 1] === p ? bmp[o + 1] : b0;
        const bu = y > 0 && part[o - W] === p ? bmp[o - W] : b0;
        const bd = y < H - 1 && part[o + W] === p ? bmp[o + W] : b0;
        let nx = NX[o] - (br - bl) * 0.5 * bK;
        let ny = NY[o] - (bd - bu) * 0.5 * bK;
        let nz = NZ[o];
        const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
        nx *= nl;
        ny *= nl;
        nz *= nl;
        const wrap = wraps[mi];
        const nd = nx * lx + ny * ly + nz * lz;
        const dif = nd + wrap > 0 ? (nd + wrap) / (1 + wrap) : 0;
        const e = 1 - nz;
        const rf = -nx * lx + ny * 0.1;
        const rim = rf > 0 ? e * e * Math.sqrt(e) * rf * rimK : 0;
        let sp = 0;
        const spk = specs[mi];
        if (spk > 0) {
          const hd = nx * hx + ny * hy + nz * hz;
          if (hd > 0.5) sp = Math.pow(hd, shines[mi]) * spk;
        }
        // cast shadow from a nearer part toward the light
        let sh = 0;
        const zo = z[o] + 140;
        for (let k = 0; k < PN; k++) {
          const xx = x + pdx[k];
          const yy = y + pdy[k];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
          const q = yy * W + xx;
          if (mat[q] >= 0 && part[q] !== p && z[q] > zo) {
            sh = pk[k];
            break;
          }
        }
        const g = glints[mi];
        if (g !== null && sp > 0.55 && sh === 0) {
          put(o, g);
          continue;
        }
        // relief also self-shadows a little in its own creases
        let v = ambient + dif * 0.82 + rim + sp - sh + (b0 < 0 ? b0 * 0.05 : 0);
        const tx = texs[mi];
        if (tx !== null) v += tx((x + 0.5) * is, (y + 0.5) * is) * texK;
        v = v < 0 ? 0 : v > 0.999 ? 0.999 : v;
        const ramp = rgbs[mi];
        const n = ramp.length;
        const f = v * (n - 1);
        let idx = f | 0;
        if (f - idx > 0.5 + (BAYER[((y & 3) << 2) | (x & 3)] - 0.5) * dths[mi]) idx++;
        if (idx > n - 1) idx = n - 1;
        put(o, ramp[idx]);
      }
    }
    // inner lines: where a nearer part overlaps, darken the far side
    const lines = mats.map((m) => rgba(m.line ?? m.ramp[0]));
    // at sprite size only sizeable parts cut a dark line into what lies behind
    const minA = small ? 8 : 0;
    const area = this.area;
    const big = (q: number) => area[part[q]] >= minA;
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        const o = y * W + x;
        const mi = mat[o];
        if (mi < 0) continue;
        const zo = z[o] + 200;
        const p = part[o];
        if (
          (x < W - 1 && mat[o + 1] >= 0 && part[o + 1] !== p && z[o + 1] > zo && big(o + 1)) ||
          (x > 0 && mat[o - 1] >= 0 && part[o - 1] !== p && z[o - 1] > zo && big(o - 1)) ||
          (y < H - 1 && mat[o + W] >= 0 && part[o + W] !== p && z[o + W] > zo && big(o + W)) ||
          (y > 0 && mat[o - W] >= 0 && part[o - W] !== p && z[o - W] > zo && big(o - W))
        )
          put(o, lines[mi]);
      }
    }
    // outer outline: near-black tinted toward the material it wraps on the
    // shadow side; on the lit (upper-left) side a dark shade of the material
    const oc = outline === '#080306' ? OUT_RGB : rgba(outline);
    const tint = rgbs.map((r) => [(oc[0] * 2 + r[0][0]) / 3, (oc[1] * 2 + r[0][1]) / 3, (oc[2] * 2 + r[0][2]) / 3]);
    const lit = small ? rgbs.map((r) => {
      const a = r[0];
      const b = r[Math.min(r.length - 1, 1)];
      return [(a[0] + b[0] * 2) / 3, (a[1] + b[1] * 2) / 3, (a[2] + b[2] * 2) / 3];
    }) : tint;
    for (let y = Math.max(0, Y0 - 1); y <= Math.min(H - 1, Y1 + 1); y++)
      for (let x = Math.max(0, X0 - 1); x <= Math.min(W - 1, X1 + 1); x++) {
        const o = y * W + x;
        if (mat[o] >= 0) continue;
        // body to the right or below: this outline pixel faces the key light
        if (x < W - 1 && mat[o + 1] >= 0) put(o, lit[mat[o + 1]]);
        else if (y < H - 1 && mat[o + W] >= 0) put(o, lit[mat[o + W]]);
        else if (x > 0 && mat[o - 1] >= 0) put(o, tint[mat[o - 1]]);
        else if (y > 0 && mat[o - W] >= 0) put(o, tint[mat[o - W]]);
      }
    this.release();
    return pc;
  }
}
