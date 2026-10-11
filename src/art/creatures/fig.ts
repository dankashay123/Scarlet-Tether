// Creature renderer: the volumetric `Figure` (render.ts) tuned for painted,
// anatomical sprites.
//
// Same API as render.ts's Figure (masks inflated into height fields, lit and
// quantised onto ramps), plus:
//  - relief: a per-pixel bump layer that bends normals, so wrinkles, ribs,
//    tendons, veins and cloth folds catch light and cast a lit/shadow edge
//    instead of being flat value stains (`relief()`, Material.bump);
//  - cast shadows: a nearer part darkens what lies just beneath it on the
//    side away from the key light, which separates limbs from bodies;
//  - wrap lighting and per-material dithering (soft skin, clean metal), so
//    surfaces read as painted clusters instead of noisy checkerboards;
//  - crisp specular glints on wet and polished materials (Material.glint);
//  - selective outlines tinted by the material they surround.
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
/** Inline shapes (k 0: capsule, k 1: ellipse) — rasterised without a closure call per pixel. */
interface Shape { k: 0 | 1; ax: number; ay: number; dx: number; dy: number; iL2: number; ra: number; dr: number }
type BBox = [number, number, number, number];


const OUT_RGB = rgba('#080306');
let scratch = new Float32Array(4096);
interface Buffers { mat: Int16Array; part: Int16Array; z: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; bmp: Float32Array }
const pool = new Map<number, Buffers[]>();

export class Figure {
  readonly w: number;
  readonly h: number;
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
  // bounds of everything drawn so far (whole-canvas passes only walk this)
  private fx0 = 1e9;
  private fy0 = 1e9;
  private fx1 = -1;
  private fy1 = -1;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
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

  /** Pixel material (for callers that need to sample the figure). */
  has(x: number, y: number) {
    x |= 0;
    y |= 0;
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.mat[y * this.w + x] >= 0;
  }

  add(mask: Mask | Shape, m: Material, layer: number, bbox?: BBox) {
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
          if (typeof mask === 'function') inside = mask(px, py);
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
    const mid = this.mi(m);
    const bump = m.bump;
    const W = this.w;
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
        this.bmp[o] = bump ? bump(bx0 + x, by0 + y) : 0;
      }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material, layer: number, rot = 0) {
    const r = Math.max(rx, ry);
    this.add({ k: 1, ax: cx, ay: cy, dx: Math.cos(-rot), dy: Math.sin(-rot), iL2: 1 / (rx * rx), ra: 1 / (ry * ry), dr: 0 }, m, layer, [cx - r, cy - r, cx + r, cy + r]);
  }

  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, m: Material, layer: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    const R = Math.max(ra, rb);
    this.add({ k: 0, ax, ay, dx, dy, iL2: 1 / L2, ra, dr: rb - ra }, m, layer, [Math.min(ax, bx) - R, Math.min(ay, by) - R, Math.max(ax, bx) + R, Math.max(ay, by) + R]);
  }

  poly(pts: [number, number][], m: Material, layer: number) {
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
    this.add(
      (x, y) => {
        const c = Math.floor(x) - ox;
        const r = Math.floor(y) - oy;
        return c >= 0 && r >= 0 && c < pw && r < ph && buf[r * pw + c] === 1;
      },
      m,
      layer,
      [x0, y0, x1, y1],
    );
  }

  private region(bbox: BBox | undefined): [number, number, number, number] {
    if (!bbox) return [this.fx0, this.fy0, this.fx1, this.fy1];
    return [Math.max(this.fx0, Math.floor(bbox[0]) - 1), Math.max(this.fy0, Math.floor(bbox[1]) - 1), Math.min(this.fx1, Math.ceil(bbox[2]) + 1), Math.min(this.fy1, Math.ceil(bbox[3]) + 1)];
  }

  /** Repaint existing pixels (keeps their shape and relief). */
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
        if (mask(x + 0.5, y + 0.5)) this.mat[o] = mid;
      }
  }

  /**
   * Add relief (height) to existing pixels: `fn` returns the height to add
   * (0 for none). Raised ridges catch the key light on their upper-left side
   * and fall into shadow on the other, like real anatomy.
   */
  relief(fn: (x: number, y: number) => number, bbox?: BBox, only?: Material[]) {
    const allow = only ? only.map((x) => this.matIndex.get(x)).filter((x): x is number => x !== undefined) : null;
    if (allow && !allow.length) return;
    const [x0, y0, x1, y1] = this.region(bbox);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const o = y * this.w + x;
        const k = this.mat[o];
        if (k < 0 || (allow && allow.indexOf(k) < 0)) continue;
        const v = fn(x + 0.5, y + 0.5);
        if (v) this.bmp[o] += v;
      }
  }

  render(light: Light, outline = '#080306'): PixelCanvas {
    const { w: W, h: H } = this;
    const pc = new PixelCanvas(W, H);
    if (this.fx1 < 0) return pc;
    const data = pc.data;
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
    const PN = 5;
    const pdx = new Int32Array(PN);
    const pdy = new Int32Array(PN);
    const pk = new Float32Array(PN);
    for (let t = 1; t <= PN; t++) {
      pdx[t - 1] = Math.round(sx * t);
      pdy[t - 1] = Math.round(sy * t);
      pk[t - 1] = 0.24 * (1 - (t - 1) * 0.16);
    }
    const mats = this.mats;
    const rgbs = mats.map((m) => m.ramp.map((c) => rgba(c)));
    const glints = mats.map((m) => (m.glint ? rgba(m.glint) : null));
    const wraps = mats.map((m) => m.wrap ?? 0.15);
    const dths = mats.map((m) => m.dither ?? 0.55);
    const specs = mats.map((m) => m.spec ?? 0);
    const shines = mats.map((m) => m.shine ?? 24);
    const texs = mats.map((m) => m.tex ?? null);
    const { mat, part, z, nx: NX, ny: NY, nz: NZ, bmp } = this;
    const put = (o: number, c: readonly number[]) => {
      const i = o * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    };
    const ambient = light.ambient;
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
        let nx = NX[o] - (br - bl) * 0.5;
        let ny = NY[o] - (bd - bu) * 0.5;
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
        if (tx !== null) v += tx(x, y);
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
    for (let y = Y0; y <= Y1; y++) {
      for (let x = X0; x <= X1; x++) {
        const o = y * W + x;
        const mi = mat[o];
        if (mi < 0) continue;
        const zo = z[o] + 200;
        const p = part[o];
        if (
          (x < W - 1 && mat[o + 1] >= 0 && part[o + 1] !== p && z[o + 1] > zo) ||
          (x > 0 && mat[o - 1] >= 0 && part[o - 1] !== p && z[o - 1] > zo) ||
          (y < H - 1 && mat[o + W] >= 0 && part[o + W] !== p && z[o + W] > zo) ||
          (y > 0 && mat[o - W] >= 0 && part[o - W] !== p && z[o - W] > zo)
        )
          put(o, lines[mi]);
      }
    }
    // outer outline, tinted toward the material it wraps
    const oc = outline === '#080306' ? OUT_RGB : rgba(outline);
    const tint = rgbs.map((r) => [(oc[0] * 2 + r[0][0]) / 3, (oc[1] * 2 + r[0][1]) / 3, (oc[2] * 2 + r[0][2]) / 3]);
    for (let y = Math.max(0, Y0 - 1); y <= Math.min(H - 1, Y1 + 1); y++)
      for (let x = Math.max(0, X0 - 1); x <= Math.min(W - 1, X1 + 1); x++) {
        const o = y * W + x;
        if (mat[o] >= 0) continue;
        let q = -1;
        if (x < W - 1 && mat[o + 1] >= 0) q = o + 1;
        else if (x > 0 && mat[o - 1] >= 0) q = o - 1;
        else if (y < H - 1 && mat[o + W] >= 0) q = o + W;
        else if (y > 0 && mat[o - W] >= 0) q = o - W;
        if (q >= 0) put(o, tint[mat[q]]);
      }
    this.release();
    return pc;
  }
}

