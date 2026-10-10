import { PixelCanvas, bayer } from '../pixel';
import type { RGB } from './paint';

/**
 * Relief renderer for environment art: the architectural counterpart of the
 * volumetric `Figure` renderer used for characters.
 *
 * Geometry is authored as a height field plus a material id per pixel
 * (carved panels are lower, mouldings and columns higher). Shading derives
 * normals from the height field, lights them with a directional key, warm
 * point lights (lanterns, doorways) and cavity occlusion, then quantises onto
 * each material's hand-picked colour ramp with ordered dithering. The result
 * is crisp, carved-looking pixel art at a fraction of the cost of painting
 * every moulding by hand.
 *
 * Buffers wrap horizontally when `wrap` is set so parallax layers tile.
 */

export const EMPTY = -1e4;

export interface RMat {
  /** Ramp from deepest shadow to brightest highlight. */
  ramp: RGB[];
  /** Specular strength (wet flesh, brass, polished stone). */
  spec?: number;
  /** Emissive: colour comes from the `emi` channel along the ramp, unlit. */
  emit?: boolean;
  /** Multiplies the light value before the ramp lookup (albedo). */
  alb?: number;
}

export interface PLight {
  x: number;
  y: number;
  z: number;
  r: number;
  c: RGB;
  k: number;
}

export interface Glow {
  x: number;
  y: number;
  r: number;
  c: RGB;
  k: number;
  pow?: number;
}

export interface ShadeOpts {
  mats: (RMat | undefined)[];
  /** Direction towards the key light (screen space, y down, z out). */
  key?: [number, number, number];
  keyK?: number;
  keyC?: RGB;
  amb?: number;
  ambC?: RGB;
  lights?: PLight[];
  /** Cavity occlusion strength and blur radius. */
  ao?: number;
  aoR?: number;
  /** Gradient clamp (higher = harsher bevels). */
  grad?: number;
  /** Per-row fog amount 0..1 and its colour. */
  fogC?: RGB;
  fog?: (y: number) => number;
  /** Darken silhouette edges of transparent layers (0 = none, 1 = black). */
  outline?: number;
  outlineC?: RGB;
  /** How strongly coloured lights tint the ramp colour (0..1). */
  tint?: number;
  /** Additive halos drawn last (also into empty pixels, as haze). */
  glows?: Glow[];
  /** Channel posterisation levels (0 = off). */
  levels?: number;
}

const pow24 = (v: number) => {
  const a = v * v;
  const b = a * a;
  const c = b * b;
  return c * c * c;
};

export class Relief {
  readonly n: number;
  readonly hgt: Float32Array;
  readonly mat: Uint8Array;
  readonly tex: Float32Array;
  readonly emi: Float32Array;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly wrap = true,
  ) {
    this.n = w * h;
    this.hgt = new Float32Array(this.n).fill(EMPTY);
    this.mat = new Uint8Array(this.n);
    this.tex = new Float32Array(this.n);
    this.emi = new Float32Array(this.n);
  }

  clone(): Relief {
    const r = new Relief(this.w, this.h, this.wrap);
    r.hgt.set(this.hgt);
    r.mat.set(this.mat);
    r.tex.set(this.tex);
    r.emi.set(this.emi);
    return r;
  }

  /** Visit integer pixels of a box; `x` is unwrapped, `i` the buffer index. */
  box(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number, i: number) => void) {
    const W = this.w;
    const ix0 = Math.floor(x0);
    const ix1 = Math.ceil(x1);
    const iy0 = Math.max(0, Math.floor(y0));
    const iy1 = Math.min(this.h - 1, Math.ceil(y1));
    for (let y = iy0; y <= iy1; y++) {
      const row = y * W;
      for (let x = ix0; x <= ix1; x++) {
        let u = x;
        if (u < 0 || u >= W) {
          if (!this.wrap) continue;
          u = ((u % W) + W) % W;
        }
        fn(x, y, row + u);
      }
    }
  }

  put(i: number, h: number, m: number, t = 0) {
    this.hgt[i] = h;
    this.mat[i] = m;
    this.tex[i] = t;
  }

  /** Write only if higher than what is there. */
  raise(i: number, h: number, m: number, t = 0) {
    if (h > this.hgt[i]) {
      this.hgt[i] = h;
      this.mat[i] = m;
      this.tex[i] = t;
    }
  }

  /** Horizontal-ish cylinder (rope, chain, sinew) from a to b. */
  tube(ax: number, ay: number, bx: number, by: number, r: number, h: number, m: number, t = 0, top = false) {
    const dx = bx - ax;
    const dy = by - ay;
    const L2 = dx * dx + dy * dy || 1;
    this.box(Math.min(ax, bx) - r - 1, Math.min(ay, by) - r - 1, Math.max(ax, bx) + r + 1, Math.max(ay, by) + r + 1, (x, y, i) => {
      const px = x + 0.5;
      const py = y + 0.5;
      let k = ((px - ax) * dx + (py - ay) * dy) / L2;
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const d2 = (px - ax - dx * k) ** 2 + (py - ay - dy * k) ** 2;
      if (d2 > r * r) return;
      const hh = h + Math.sqrt(r * r - d2);
      if (top) this.put(i, hh, m, t);
      else this.raise(i, hh, m, t);
    });
  }

  /** Box blur of the height field (horizontal wrap), used for cavity AO. */
  private blur(R: number): Float32Array {
    const { w: W, h: H } = this;
    const src = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) src[i] = this.hgt[i] < EMPTY / 2 ? -14 : this.hgt[i];
    const tmp = new Float32Array(this.n);
    const out = new Float32Array(this.n);
    const k = 1 / (2 * R + 1);
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let s = 0;
      for (let x = -R; x <= R; x++) s += src[row + (this.wrap ? ((x % W) + W) % W : Math.max(0, Math.min(W - 1, x)))];
      // (R < W, so a single +-W folds the window ends; same sums as a modulo)
      const wrap = this.wrap;
      for (let x = 0; x < W; x++) {
        tmp[row + x] = s * k;
        const xa = x - R;
        const xb = x + R + 1;
        s -= src[row + (xa >= 0 ? xa : wrap ? xa + W : 0)];
        s += src[row + (xb < W ? xb : wrap ? xb - W : W - 1)];
      }
    }
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let y = -R; y <= R; y++) s += tmp[Math.max(0, Math.min(H - 1, y)) * W + x];
      for (let y = 0; y < H; y++) {
        out[y * W + x] = s * k;
        s -= tmp[Math.max(0, y - R) * W + x];
        s += tmp[Math.min(H - 1, y + R + 1) * W + x];
      }
    }
    return out;
  }

  shade(o: ShadeOpts): PixelCanvas {
    const { w: W, h: H, hgt, mat, tex, emi } = this;
    const pc = new PixelCanvas(W, H);
    const d = pc.data;
    let [kx, ky, kz] = o.key ?? [-0.45, -0.75, 0.5];
    const kl = Math.hypot(kx, ky, kz);
    kx /= kl;
    ky /= kl;
    kz /= kl;
    const keyK = o.keyK ?? 0.6;
    const keyC = o.keyC ?? [255, 255, 255];
    const amb = o.amb ?? 0.25;
    const ambC = o.ambC ?? [255, 255, 255];
    const lights = o.lights ?? [];
    const G = o.grad ?? 2.5;
    const aoK = o.ao ?? 0.08;
    const blur = aoK > 0 ? this.blur(o.aoR ?? 4) : null;
    const tintK = o.tint ?? 0.7;
    const fogC = o.fogC ?? [0, 0, 0];
    const outl = o.outline ?? 0;
    const outC = o.outlineC ?? [8, 4, 6];
    const hx = kx;
    const hy = ky;
    const hz = kz + 1;
    const hl = Math.hypot(hx, hy, hz);
    const fogRow = new Float32Array(H);
    for (let y = 0; y < H; y++) fogRow[y] = o.fog ? o.fog(y) : 0;
    const wrap = this.wrap;
    const nl = lights.length;
    const LX = new Float64Array(nl);
    const LY = new Float64Array(nl);
    const LZ = new Float64Array(nl);
    const LR = new Float64Array(nl);
    const LK = new Float64Array(nl);
    const LC = new Float64Array(nl * 3);
    lights.forEach((l, k) => {
      LX[k] = l.x;
      LY[k] = l.y;
      LZ[k] = l.z;
      LR[k] = l.r;
      LK[k] = l.k;
      LC[k * 3] = l.c[0];
      LC[k * 3 + 1] = l.c[1];
      LC[k * 3 + 2] = l.c[2];
    });
    // Flatten materials into typed tables (keeps the hot loop monomorphic)
    const MS = new Float64Array(256);
    const MA = new Float64Array(256);
    const ME = new Uint8Array(256);
    const MN = new Int32Array(256);
    const MO = new Int32Array(256);
    const RAMP: number[] = [];
    o.mats.forEach((mm, k) => {
      if (!mm) return;
      MS[k] = mm.spec ?? 0;
      MA[k] = mm.alb ?? 1;
      ME[k] = mm.emit ? 1 : 0;
      MN[k] = mm.ramp.length;
      MO[k] = RAMP.length;
      for (const c of mm.ramp) RAMP.push(c[0], c[1], c[2]);
    });
    const RP = new Float64Array(RAMP);
    // Height with empty neighbours replaced by the pixel's own height
    for (let y = 0; y < H; y++) {
      const fg = fogRow[y];
      const row = y * W;
      const up = y > 0 ? row - W : row;
      const dn = y < H - 1 ? row + W : row;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const m = mat[i];
        if (!m) continue;
        const rn = MN[m];
        if (!rn) continue;
        const ro = MO[m];
        const th = 0.5 + (bayer(x, y) - 0.5) * 0.6; // narrow dither bands: cleaner clusters
        const xl = x > 0 ? x - 1 : wrap ? W - 1 : x;
        const xr = x < W - 1 ? x + 1 : wrap ? 0 : x;
        let r: number;
        let g: number;
        let b: number;
        if (ME[m]) {
          let f = emi[i] + tex[i];
          f = (f < 0 ? 0 : f > 1 ? 1 : f) * (rn - 1) * 0.9999;
          let ix = Math.floor(f);
          if (f - ix > th) ix++;
          const c = ro + (ix < rn ? ix : rn - 1) * 3;
          r = RP[c];
          g = RP[c + 1];
          b = RP[c + 2];
        } else {
          const h0 = hgt[i];
          let hr = hgt[row + xr];
          let hl2 = hgt[row + xl];
          let hu = hgt[up + x];
          let hd = hgt[dn + x];
          if (hr < -5000) hr = h0;
          if (hl2 < -5000) hl2 = h0;
          if (hu < -5000) hu = h0;
          if (hd < -5000) hd = h0;
          let gx = (hr - hl2) * 0.5;
          let gy = (hd - hu) * 0.5;
          gx = gx > G ? G : gx < -G ? -G : gx;
          gy = gy > G ? G : gy < -G ? -G : gy;
          const ln = Math.sqrt(gx * gx + gy * gy + 1);
          const nx = -gx / ln;
          const ny = -gy / ln;
          const nz = 1 / ln;
          const ndk = nx * kx + ny * ky + nz * kz;
          const kd = ndk > 0 ? ndk * keyK : 0;
          let lum = amb + kd;
          let cr = ambC[0] * amb + keyC[0] * kd;
          let cg = ambC[1] * amb + keyC[1] * kd;
          let cb = ambC[2] * amb + keyC[2] * kd;
          let spec = 0;
          const sp = MS[m];
          if (sp > 0) {
            const nh = (nx * hx + ny * hy + nz * hz) / hl;
            if (nh > 0) spec += pow24(nh) * sp * keyK;
          }
          for (let k = 0; k < nl; k++) {
            let dx = LX[k] - x;
            if (wrap) {
              if (dx > W / 2) dx -= W;
              else if (dx < -W / 2) dx += W;
            }
            const dy = LY[k] - y;
            const rr = LR[k];
            if (dx > rr || dx < -rr || dy > rr || dy < -rr) continue;
            const dz = LZ[k] - h0;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= rr * rr) continue;
            const dist = Math.sqrt(d2);
            const a = 1 - dist / rr;
            const att = a * a * LK[k];
            const ndl = (nx * dx + ny * dy + nz * dz) / dist;
            const c = att * (0.25 + 0.75 * (ndl > 0 ? ndl : 0));
            lum += c;
            cr += LC[k * 3] * c;
            cg += LC[k * 3 + 1] * c;
            cb += LC[k * 3 + 2] * c;
            if (sp > 0 && ndl > 0) {
              // Blinn half-vector towards a viewer straight ahead
              const qx = dx / dist;
              const qy = dy / dist;
              const qz = dz / dist + 1;
              const ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
              const nh = (nx * qx + ny * qy + nz * qz) / ql;
              if (nh > 0) spec += pow24(nh) * sp * att * 1.5;
            }
          }
          if (blur) {
            let cav = (h0 - blur[i]) * aoK;
            cav = cav > 0.35 ? 0.35 : cav < -0.55 ? -0.55 : cav;
            lum *= 1 + cav;
          }
          const v = lum * MA[m] * (1 + tex[i]) + spec;
          const f = (v < 0 ? 0 : v > 1 ? 1 : v) * (rn - 1) * 0.9999;
          let ix = Math.floor(f);
          if (f - ix > th) ix++;
          const c = ro + (ix < rn ? ix : rn - 1) * 3;
          // Coloured light: tint the ramp colour by the light's chroma
          const cl = (cr + cg + cb) / 3 || 1;
          r = RP[c] * (1 + (cr / cl - 1) * tintK);
          g = RP[c + 1] * (1 + (cg / cl - 1) * tintK);
          b = RP[c + 2] * (1 + (cb / cl - 1) * tintK);
          if (spec > 0.25) {
            const s = Math.min(1, spec - 0.25) * 0.6;
            r += (255 - r) * s;
            g += (240 - g) * s;
            b += (210 - b) * s;
          }
        }
        if (outl > 0 && (!mat[row + xl] || !mat[row + xr] || (y > 0 && !mat[up + x]) || (y < H - 1 && !mat[dn + x]))) {
          r += (outC[0] - r) * outl;
          g += (outC[1] - g) * outl;
          b += (outC[2] - b) * outl;
        }
        if (fg > 0) {
          r += (fogC[0] - r) * fg;
          g += (fogC[1] - g) * fg;
          b += (fogC[2] - b) * fg;
        }
        const p = i * 4;
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
        d[p + 3] = 255;
      }
    }
    if (o.glows) for (const gl of o.glows) addGlow(pc, gl, this.wrap);
    if (o.levels) posterize(pc, o.levels);
    return pc;
  }
}

/** Additive radial halo; on transparent pixels it lays down glowing haze. */
export function addGlow(pc: PixelCanvas, gl: Glow, wrap = true) {
  const W = pc.w;
  const d = pc.data;
  const pow = gl.pow ?? 2;
  const x0 = Math.floor(gl.x - gl.r);
  const x1 = Math.ceil(gl.x + gl.r);
  const y0 = Math.max(0, Math.floor(gl.y - gl.r));
  const y1 = Math.min(pc.h - 1, Math.ceil(gl.y + gl.r));
  for (let y = y0; y <= y1; y++)
    for (let xx = x0; xx <= x1; xx++) {
      let x = xx;
      if (x < 0 || x >= W) {
        if (!wrap) continue;
        x = ((x % W) + W) % W;
      }
      const ex = xx + 0.5 - gl.x;
      const ey = y + 0.5 - gl.y;
      const dd = Math.sqrt(ex * ex + ey * ey) / gl.r;
      if (dd >= 1) continue;
      const amt = gl.k * Math.pow(1 - dd, pow);
      const p = (y * W + x) * 4;
      const a0 = d[p + 3] / 255;
      const A = Math.min(1, a0 + amt * (1 - a0));
      if (A <= 0) continue;
      d[p] = Math.min(255, (d[p] * a0 + gl.c[0] * amt) / A);
      d[p + 1] = Math.min(255, (d[p + 1] * a0 + gl.c[1] * amt) / A);
      d[p + 2] = Math.min(255, (d[p + 2] * a0 + gl.c[2] * amt) / A);
      d[p + 3] = A * 255;
    }
}

/** Ordered-dither posterisation (shared threshold keeps hues coherent). */
export function posterize(pc: PixelCanvas, levels: number) {
  const d = pc.data;
  const q = 255 / levels;
  for (let y = 0; y < pc.h; y++)
    for (let x = 0; x < pc.w; x++) {
      const p = (y * pc.w + x) * 4;
      if (d[p + 3] === 0) continue;
      const t = bayer(x, y);
      for (let c = 0; c < 3; c++) {
        const f = d[p + c] / q;
        const n = Math.floor(f);
        d[p + c] = Math.min(255, Math.round((f - n > t ? n + 1 : n) * q));
      }
    }
}

/** Build a ramp by interpolating key colours (hex) to `n` steps. */
export function ramp(keys: string[], n: number): RGB[] {
  const ks = keys.map((c) => {
    const v = parseInt(c.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as RGB;
  });
  const out: RGB[] = [];
  for (let i = 0; i < n; i++) {
    const f = (i / (n - 1)) * (ks.length - 1);
    const a = Math.min(ks.length - 2, Math.floor(f));
    const t = f - a;
    const A = ks[a];
    const B = ks[a + 1];
    out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
  }
  return out;
}
