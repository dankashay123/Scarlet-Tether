import { rgba } from './palette';
import { PixelCanvas, bayer, hash2, valueNoise } from './pixel';

/**
 * Volumetric pixel renderer.
 *
 * Every body part is drawn as a flat mask, then "inflated" with a distance
 * transform into a rounded height field. The height field gives per-pixel
 * normals, which are lit (key light, ambient, rim light), quantised onto a
 * hand-picked colour ramp with ordered dithering, and finished with dark
 * outlines between overlapping parts. The result reads as painted, shaded
 * pixel art rather than flat shapes.
 */

export interface Material {
  /** Colour ramp from deepest shadow to brightest highlight. */
  ramp: string[];
  /** Glossiness 0..1 (wet flesh, metal, blood). */
  spec?: number;
  /** Per-pixel value offset (-0.5..0.5) for texture: folds, grain, rust. */
  tex?: (x: number, y: number) => number;
  /** How round the part is (0 flat, 1 fully inflated). */
  round?: number;
  /** Colour used to outline this material (defaults to near-black of ramp). */
  line?: string;
}

export interface Light {
  x: number;
  y: number;
  z: number;
  ambient: number;
  rim: number;
  rimColor?: string;
}

export const KEY_LIGHT: Light = { x: -0.55, y: -0.75, z: 0.55, ambient: 0.16, rim: 0.55 };

type Mask = (x: number, y: number) => boolean;

export class Figure {
  readonly w: number;
  readonly h: number;
  private mat: Int16Array;
  private part: Int16Array;
  private z: Float32Array;
  private nx: Float32Array;
  private ny: Float32Array;
  private nz: Float32Array;
  private mats: Material[] = [];
  private matIndex = new Map<Material, number>();
  private parts = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.mat = new Int16Array(n).fill(-1);
    this.part = new Int16Array(n).fill(-1);
    this.z = new Float32Array(n).fill(-1e9);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.nz = new Float32Array(n);
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
   * Add a part from an arbitrary mask. `layer` orders parts front-to-back
   * (higher is nearer the viewer); within a layer, the inflated height
   * decides, so limbs blend into bodies naturally.
   */
  add(mask: Mask, m: Material, layer: number, bbox?: [number, number, number, number]) {
    const [x0, y0, x1, y1] = bbox ?? [0, 0, this.w - 1, this.h - 1];
    const bx0 = Math.max(0, Math.floor(x0) - 1);
    const by0 = Math.max(0, Math.floor(y0) - 1);
    const bx1 = Math.min(this.w - 1, Math.ceil(x1) + 1);
    const by1 = Math.min(this.h - 1, Math.ceil(y1) + 1);
    const bw = bx1 - bx0 + 1;
    const bh = by1 - by0 + 1;
    if (bw <= 0 || bh <= 0) return;
    const inside = new Uint8Array(bw * bh);
    let any = false;
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++)
        if (mask(bx0 + x + 0.5, by0 + y + 0.5)) {
          inside[y * bw + x] = 1;
          any = true;
        }
    if (!any) return;
    // Chamfer distance to the nearest outside pixel
    const INF = 1e6;
    const d = new Float32Array(bw * bh);
    for (let i = 0; i < d.length; i++) d[i] = inside[i] ? INF : 0;
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= bw || y >= bh ? 0 : d[y * bw + x]);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (!inside[i]) continue;
        d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
      }
    let maxD = 0;
    for (let y = bh - 1; y >= 0; y--)
      for (let x = bw - 1; x >= 0; x--) {
        const i = y * bw + x;
        if (!inside[i]) continue;
        d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
        if (d[i] > maxD) maxD = d[i];
      }
    const R = Math.max(1, maxD);
    const round = m.round ?? 1;
    const hgt = (x: number, y: number) => {
      const v = at(x, y);
      if (v <= 0) return 0;
      const t = Math.min(1, v / R);
      return Math.sqrt(1 - (1 - t) * (1 - t)) * R;
    };
    const pid = this.parts++;
    const mid = this.mi(m);
    for (let y = 0; y < bh; y++)
      for (let x = 0; x < bw; x++) {
        const i = y * bw + x;
        if (!inside[i]) continue;
        const gx = (hgt(x + 1, y) - hgt(x - 1, y)) * 0.5 * round;
        const gy = (hgt(x, y + 1) - hgt(x, y - 1)) * 0.5 * round;
        let nx = -gx;
        let ny = -gy;
        let nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l;
        ny /= l;
        nz /= l;
        const zz = layer * 1000 + hgt(x, y) * round;
        const o = (by0 + y) * this.w + bx0 + x;
        if (zz >= this.z[o]) {
          this.z[o] = zz;
          this.mat[o] = mid;
          this.part[o] = pid;
          this.nx[o] = nx;
          this.ny[o] = ny;
          this.nz[o] = nz;
        }
      }
  }

  // --- Shape helpers -------------------------------------------------------

  ellipse(cx: number, cy: number, rx: number, ry: number, m: Material, layer: number, rot = 0) {
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
      [cx - r, cy - r, cx + r, cy + r],
    );
  }

  /** Tapered capsule from (ax,ay) radius ra to (bx,by) radius rb. */
  capsule(ax: number, ay: number, bx: number, by: number, ra: number, rb: number, m: Material, layer: number) {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    this.add(
      (x, y) => {
        let t = ((x - ax) * dx + (y - ay) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        const px = ax + dx * t;
        const py = ay + dy * t;
        const r = ra + (rb - ra) * t;
        return (x - px) ** 2 + (y - py) ** 2 <= r * r;
      },
      m,
      layer,
      [Math.min(ax, bx) - Math.max(ra, rb), Math.min(ay, by) - Math.max(ra, rb), Math.max(ax, bx) + Math.max(ra, rb), Math.max(ay, by) + Math.max(ra, rb)],
    );
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
    this.add(
      (x, y) => {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i];
          const [xj, yj] = pts[j];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      },
      m,
      layer,
      [x0, y0, x1, y1],
    );
  }

  /**
   * Paint a stain (blood, rust) onto existing pixels, keeping their shape.
   * `only` limits it to pixels of the given materials.
   */
  stain(mask: Mask, m: Material, only?: Material[]) {
    const mid = this.mi(m);
    const allow = only ? new Set(only.map((x) => this.matIndex.get(x)).filter((x) => x !== undefined)) : null;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const o = y * this.w + x;
        if (this.mat[o] < 0) continue;
        if (allow && !allow.has(this.mat[o])) continue;
        if (mask(x + 0.5, y + 0.5)) this.mat[o] = mid;
      }
  }

  // --- Lighting ------------------------------------------------------------

  render(light: Light = KEY_LIGHT, outline = '#0b0507'): PixelCanvas {
    const pc = new PixelCanvas(this.w, this.h);
    let lx = light.x;
    let ly = light.y;
    let lz = light.z;
    const ll = Math.hypot(lx, ly, lz);
    lx /= ll;
    ly /= ll;
    lz /= ll;
    // Half-vector for specular (viewer straight on)
    let hx = lx;
    let hy = ly;
    let hz = lz + 1;
    const hl = Math.hypot(hx, hy, hz);
    hx /= hl;
    hy /= hl;
    hz /= hl;
    const rimDir = { x: -lx, y: 0.1 };
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const o = y * this.w + x;
        const mi = this.mat[o];
        if (mi < 0) continue;
        const m = this.mats[mi];
        const nx = this.nx[o];
        const ny = this.ny[o];
        const nz = this.nz[o];
        const dif = Math.max(0, nx * lx + ny * ly + nz * lz);
        const rim = Math.pow(1 - nz, 2.5) * Math.max(0, nx * rimDir.x + ny * rimDir.y) * light.rim;
        const spec = m.spec ? Math.pow(Math.max(0, nx * hx + ny * hy + nz * hz), 24) * m.spec : 0;
        // Ambient occlusion: darker where a nearer part overlaps just above
        let ao = 0;
        const above = o - this.w * 2;
        if (above >= 0 && this.part[above] !== this.part[o] && this.z[above] > this.z[o] + 300) ao = 0.22;
        let v = light.ambient + dif * 0.78 + rim + spec - ao + (m.tex ? m.tex(x, y) : 0);
        v = Math.max(0, Math.min(0.999, v));
        const n = m.ramp.length;
        const f = v * (n - 1);
        let idx = Math.floor(f);
        if (f - idx > bayer(x, y)) idx++;
        idx = Math.max(0, Math.min(n - 1, idx));
        pc.px(x, y, m.ramp[idx]);
      }
    }
    // Inner lines: where a part sits in front of another, darken the far side.
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const o = y * this.w + x;
        if (this.mat[o] < 0) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
          const q = yy * this.w + xx;
          if (this.mat[q] < 0 || this.part[q] === this.part[o]) continue;
          if (this.z[q] > this.z[o] + 200) {
            const m = this.mats[this.mat[o]];
            pc.px(x, y, m.line ?? m.ramp[0]);
            break;
          }
        }
      }
    }
    // Outer outline, tinted by the neighbouring material ("selout").
    const marks: [number, number, string][] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.mat[y * this.w + x] >= 0) continue;
        let best = -1;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) continue;
          const q = yy * this.w + xx;
          if (this.mat[q] >= 0) best = q;
        }
        if (best >= 0) marks.push([x, y, outline]);
      }
    }
    for (const [x, y, c] of marks) pc.px(x, y, c);
    return pc;
  }
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------

/** Vertical cloth folds that sway with `phase`. */
export function folds(scale = 3, amount = 0.18, seed = 0, phase = 0) {
  return (x: number, y: number) => {
    const n = Math.sin((x + Math.sin(y * 0.15 + phase) * 2) / scale + seed) * 0.5;
    return n * amount + (valueNoise(x, y, 2.5, seed + 3) - 0.5) * amount * 0.6;
  };
}

export function grain(scale = 2, amount = 0.15, seed = 0) {
  return (x: number, y: number) => (valueNoise(x, y, scale, seed) - 0.5) * amount * 2;
}

export function scratches(amount = 0.25, seed = 0) {
  return (x: number, y: number) => {
    const h = hash2(x, y, seed);
    return h > 0.93 ? amount : h < 0.05 ? -amount : (valueNoise(x, y, 3, seed) - 0.5) * amount * 0.5;
  };
}

/** Blend a ramp from two colours with n steps, through a mid tone. */
export function ramp(stops: string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (stops.length - 1);
    const a = Math.floor(t);
    const b = Math.min(stops.length - 1, a + 1);
    const k = t - a;
    const [r1, g1, b1] = rgba(stops[a]);
    const [r2, g2, b2] = rgba(stops[b]);
    const f = (p: number, q: number) => Math.round(p + (q - p) * k).toString(16).padStart(2, '0');
    out.push('#' + f(r1, r2) + f(g1, g2) + f(b1, b2));
  }
  return out;
}
