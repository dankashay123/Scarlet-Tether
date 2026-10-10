import { PixelCanvas, bayer, hash2 } from '../pixel';
import { type RGB } from './paint';
import { pick, tnoise } from './paint';
import { ramp } from './relief';

export const TILE = 16;

/** Tile indices beyond the 16 autotiled solids (0..15 = neighbour mask). */
export const ET = { PLAT_L: 16, PLAT_M: 17, PLAT_R: 18, LIQUID_TOP: 19, LIQUID: 20, GRATE: 21, THORNS: 22, COUNT: 23 } as const;

export type EnvSet = 'marble' | 'rot' | 'cistern';

/** Which sides of the tile are exposed (no solid neighbour). */
interface Flags {
  N: boolean;
  E: boolean;
  S: boolean;
  W: boolean;
}

const INK = '#0b0507';

// --- Ramps (string ramps are used by liquids, grates and thorns) ---------------
const WOOD = ['#140706', '#2a110d', '#46201a', '#6a3022', '#8f4a30', '#b46a44'];
const BRASS = ['#1e1206', '#5a3c16', '#a87a35', '#e0b468', '#fff0b0'];
const IRONR = ['#0c0b0d', '#1f1e23', '#36353c', '#55545c', '#8a8990'];
const RUSTR = ['#1a0a06', '#3a170c', '#5e2a12', '#8a4a22'];
const FLESH = ['#24080d', '#4d1f2b', '#7a3540', '#b05a55', '#d98f7a', '#f2c3a8'];
const BONE = ['#2a2014', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf'];
const BLOODR = ['#2a0208', '#4e0815', '#7a0c1c', '#a8122a', '#d0262f', '#ff5a4a'];

// =================================================================================
// Solid masonry, lit like the characters: each tile is authored as a small height
// field + material map, normals are derived from it, lit by the shared upper-left
// key light, and quantised onto per-material ramps with ordered dithering.
// =================================================================================

/** Layout parts shared by every set so marble and rot silhouettes match exactly. */
const P = {
  EMPTY: 0,
  BODY: 1,
  MORTAR: 2,
  STRIP: 3,
  GROOVE: 4,
  CAP: 5,
  FILLET: 6,
  UNDERCUT: 7,
  FASCIA: 8,
  DENTIL: 9,
  GAP: 10,
  PILASTER: 11,
  NICHE: 12,
  SILL: 13,
  CRACK: 14,
} as const;

interface Px {
  h: number;
  p: number;
  t: number;
  /** material index into the set's ramp table */
  m: number;
  /** local coordinates handed to the material pass */
  lx: number;
  ly: number;
}

/** Big ashlar blocks in running bond (two 8px courses), bevelled, chipped and cracked. */
function body(x: number, y: number, o: Px) {
  const course = y < 8 ? 0 : 1;
  const by = y - course * 8;
  const jx = course ? 11 : 3;
  const bx = (x - jx + 16) % 16;
  o.lx = bx;
  o.ly = by;
  if (by === 7 || bx === 0) {
    o.p = P.MORTAR;
    o.h = -1;
    o.t = 0;
    return;
  }
  const e = Math.min(bx - 1, 15 - bx, by, 6 - by);
  o.p = P.BODY;
  o.h = Math.min(1, e * 0.55) * 1.3 + (tnoise(x, y, 8, 11 + course) - 0.5) * 0.9 + (tnoise(x, y, 16, 5) - 0.5) * 0.35;
  o.t = (course ? -0.04 : 0.05) + (tnoise(x, y, 4, 21) - 0.5) * 0.12;
  // chipped arrises
  if ((course === 0 && bx >= 1 && bx <= 2 && by === 0) || (course === 1 && bx === 14 && by >= 5)) {
    o.h -= 1;
    o.t -= 0.1;
  }
  // a hairline crack
  if (course === 1 && by >= 2 && by <= 5 && x === 6 + (by >> 1)) {
    o.p = P.CRACK;
    o.h -= 0.6;
  }
}

/** The masonry layout for a tile with the given exposure. `frieze` adds the carved arcade under top caps. */
function layout(x: number, y: number, f: Flags, frieze: boolean, o: Px) {
  o.t = 0;
  o.lx = x;
  o.ly = y;
  if ((f.N && f.W && x === 0 && y === 0) || (f.N && f.E && x === 15 && y === 0) || (f.S && f.W && x === 0 && y === 15) || (f.S && f.E && x === 15 && y === 15)) {
    o.p = P.EMPTY;
    return;
  }
  // Exposed top: polished cap slab, gilt fillet, shadowed undercut
  if (f.N && y < 6) {
    const edgeW = f.W && x === 0;
    const edgeE = f.E && x === 15;
    const side = edgeW || edgeE ? -0.9 : 0;
    o.lx = x;
    if (y < 4) {
      o.p = P.CAP;
      o.h = [3.5, 4.3, 4.3, 3.6][y] + side;
      o.t = (tnoise(x, y * 4, 4, 31) - 0.5) * 0.12 + (x === 7 && y > 0 ? -0.25 : 0);
    } else if (y === 4) {
      o.p = P.FILLET;
      o.h = 3.1 + side;
    } else {
      o.p = P.UNDERCUT;
      o.h = 0.3;
    }
    return;
  }
  // Exposed underside: fascia and a row of dentils
  if (f.S && y >= 11) {
    if (y === 11) {
      o.p = P.GROOVE;
      o.h = 0.1;
    } else if (y <= 13) {
      o.p = P.FASCIA;
      o.h = y === 12 ? 2.6 : 2.4;
    } else if ((x & 3) < 2) {
      o.p = P.DENTIL;
      o.h = y === 14 ? 2.2 : 1.6;
      o.lx = x & 3;
    } else {
      o.p = P.GAP;
      o.h = -0.4;
    }
    if ((f.W && x === 0) || (f.E && x === 15)) o.h -= 0.8;
    return;
  }
  // Exposed sides: a pilaster strip framed by a groove
  const sx = f.W && x <= 3 ? x : f.E && x >= 12 ? 15 - x : -1;
  if (sx >= 0) {
    if (sx === 3) {
      o.p = P.GROOVE;
      o.h = 0;
      return;
    }
    o.p = P.STRIP;
    o.h = [2.4, 3.5, 3.1][sx] - (y === 7 || y === 15 ? 0.9 : 0);
    o.t = sx === 1 ? 0.05 : 0;
    o.lx = sx;
    return;
  }
  // Under a top cap: a small carved arcade (two niches per tile)
  if (frieze && f.N && y >= 6) {
    if (y === 15) {
      o.p = P.MORTAR;
      o.h = -1;
      return;
    }
    const lx = x & 7;
    o.lx = lx;
    o.ly = y;
    if (y === 14) {
      o.p = P.SILL;
      o.h = 2.5;
      return;
    }
    if (lx <= 1 || y === 6) {
      o.p = P.PILASTER;
      o.h = y === 6 ? 2.8 : lx === 0 ? 2.6 : 2.2;
      o.t = 0.12;
      if (y === 7) o.t = 0;
      return;
    }
    const inArch = y >= 10 || (lx + 0.5 - 5) ** 2 + (y + 0.5 - 10.5) ** 2 <= 10.5;
    if (!inArch) {
      o.p = P.PILASTER;
      o.h = 2.2;
      return;
    }
    o.p = P.NICHE;
    o.h = -1.2 + (y - 7) * 0.1;
    o.t = -0.25 + (y - 7) * 0.03;
    return;
  }
  body(x, y, o);
}

type MatFn = (x: number, y: number, f: Flags, o: Px) => void;

const R = (keys: string[], n: number) => ramp(keys, n);

// Material tables per set: index -> [ramp, spec]
interface TileMats {
  ramps: RGB[][];
  spec: number[];
}

// marble (the lie): violet-grey ashlar, pale polished caps, gilt fillets
const MB = { STONE: 0, TRIM: 1, CAP: 2, GOLD: 3, DARK: 4 };
const MARBLE_M: TileMats = {
  ramps: [
    R(['#0a070b', '#1a141c', '#2a2129', '#3c2f36', '#544249', '#6e5a5c', '#8a7470'], 9),
    R(['#0c080c', '#211920', '#352a31', '#4c3d42', '#685556', '#88716c', '#a88e82'], 9),
    R(['#2a2026', '#4e4248', '#76686a', '#9e8e8a', '#c4b4a6', '#e4d8c8', '#fbf4e8'], 10),
    R(['#2e1d06', '#6a4a16', '#a87a2a', '#dcae48', '#fff1a8'], 7),
    R(['#030203', '#0a070a', '#120c11', '#1a1218', '#241a20'], 6),
  ],
  spec: [0.05, 0.08, 0.35, 0.7, 0],
};

const marbleMat: MatFn = (x, y, f, o) => {
  switch (o.p) {
    case P.BODY:
      o.m = MB.STONE;
      break;
    case P.NICHE:
      o.m = MB.DARK;
      o.t += 0.5;
      break;
    case P.CRACK:
    case P.MORTAR:
    case P.UNDERCUT:
    case P.GAP:
    case P.GROOVE:
      o.m = MB.DARK;
      break;
    case P.CAP:
      o.m = MB.CAP;
      break;
    case P.FILLET:
      o.m = MB.GOLD;
      o.t = (x & 3) === 1 ? 0.15 : 0;
      break;
    default:
      o.m = MB.TRIM;
  }
  // A thread of old blood seeping from one joint under the lip
  if (f.N && o.p === P.MORTAR && x === 3) o.t -= 0.2;
};

// rot (the truth): the same masonry, but meat, teeth, sinew and eyes
const RT = { MEAT: 0, SINEW: 1, FLESH: 2, BONE: 3, BLOOD: 4, DARK: 5, IRIS: 6 };
const ROT_M: TileMats = {
  ramps: [
    R(['#050202', '#120707', '#1e0c0c', '#2c1412', '#3e1e19', '#542a20', '#6c3a2a'], 9),
    R(['#0e0306', '#2a0a10', '#4a1a1e', '#6e2e2a', '#94483a', '#b4664e'], 8),
    R(['#160406', '#3a0e14', '#642024', '#903a34', '#ba6450', '#dc9a80', '#f6d0b8'], 10),
    R(['#1e140c', '#4a3824', '#86704c', '#bca274', '#ece0bc'], 7),
    R(['#120103', '#36040b', '#640a16', '#9a1420', '#d0302c'], 7),
    R(['#030101', '#0c0304', '#160608', '#20090b'], 5),
    R(['#2a0204', '#70080e', '#b81a1a', '#f05a36'], 5),
  ],
  spec: [0.15, 0.5, 0.8, 0.35, 1, 0, 0.9],
};

const rotMat: MatFn = (x, y, f, o) => {
  switch (o.p) {
    case P.BODY: {
      o.m = RT.MEAT;
      const v = tnoise(x, y, 4, 77);
      if (Math.abs(v - 0.5) < 0.045) {
        o.m = RT.SINEW;
        o.h += 0.7;
      }
      if (tnoise(x, y, 8, 79) > 0.72) o.t -= 0.15;
      break;
    }
    case P.CRACK:
    case P.MORTAR:
    case P.GROOVE:
    case P.UNDERCUT:
    case P.GAP:
      o.m = RT.BLOOD;
      o.t -= 0.2;
      break;
    case P.STRIP:
      o.m = RT.SINEW;
      o.t += Math.sin(y * 1.4 + o.lx) * 0.12;
      break;
    case P.CAP: {
      o.m = RT.FLESH;
      const lump = tnoise(x, y * 2, 8, 41) - 0.5;
      o.h += lump * 1.6;
      o.t += lump * 0.3 + (y === 0 ? 0.1 : 0);
      break;
    }
    case P.FILLET:
      if (x % 3 !== 2 && !((f.W && x === 0) || (f.E && x === 15))) {
        o.m = RT.BONE;
        o.h += 0.6;
        o.t = x % 3 === 0 ? 0.1 : -0.05;
      } else o.m = RT.BLOOD;
      break;
    case P.FASCIA:
      o.m = RT.FLESH;
      o.t -= 0.18;
      break;
    case P.DENTIL:
      o.m = RT.BONE;
      o.h += y === 15 ? -0.3 : 0;
      break;
    case P.PILASTER:
      o.m = RT.BONE;
      o.t -= 0.12;
      break;
    case P.SILL:
      o.m = RT.FLESH;
      o.t -= 0.1;
      break;
    case P.NICHE: {
      // every niche holds a wet eye
      const dx = o.lx + 0.5 - 4.5;
      const dy = y + 0.5 - 10.6;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 2.6) {
        o.h = 1.2 + Math.sqrt(6.76 - d * d);
        const ix = Math.sqrt((dx - 0.4) ** 2 + dy * dy);
        o.m = ix < 0.8 ? RT.DARK : ix < 1.6 ? RT.IRIS : RT.BONE;
      } else o.m = d < 3.4 ? RT.FLESH : RT.BLOOD;
      break;
    }
  }
  // blood running from the cap down the face below
  if (f.N && y >= 6 && y <= 6 + ((x * 7) % 5) + 2 && (x === 2 || x === 9 || x === 13) && o.p !== P.NICHE) {
    o.m = RT.BLOOD;
    o.h += 0.6;
    o.t = 0.1;
  }
};

// cistern: wet brick, granite kerbs, moss, rust weeping
const CS = { BRICK: 0, KERB: 1, MOSS: 2, DARK: 3, RUST: 4 };
const CIS_M: TileMats = {
  ramps: [
    R(['#080404', '#160a09', '#24120f', '#341b16', '#47261d', '#5e3426'], 8),
    R(['#120c0b', '#2a1e1a', '#43322a', '#5e4838', '#82664e', '#ae8e70', '#d8bc98'], 9),
    R(['#0e1006', '#24300e', '#3c4c18', '#5a6a28', '#7e8a3a'], 6),
    R(['#030202', '#0a0505', '#120808', '#1a0c0b'], 5),
    R(['#1a0806', '#3a140a', '#5e2410', '#8a3c18'], 5),
  ],
  spec: [0.25, 0.4, 0.3, 0, 0.2],
};

/** Smaller bricks for the sewer (8x4, running bond). */
function brick(x: number, y: number, o: Px) {
  const row = y >> 2;
  const bx = (x + (row & 1) * 4) & 7;
  const by = y & 3;
  if (bx === 0 || by === 3) {
    o.p = P.MORTAR;
    o.h = -0.9;
    return;
  }
  o.p = P.BODY;
  const e = Math.min(bx - 1, 7 - bx, by, 2 - by);
  const id = ((x + (row & 1) * 4) >> 3) & 1;
  o.h = Math.min(1, e * 0.7) + (tnoise(x, y, 8, 61) - 0.5) * 0.6;
  o.t = (hash2(id, row, 3) - 0.5) * 0.2 + (by === 0 ? 0.04 : 0);
}

const cisternMat: MatFn = (x, y, f, o) => {
  switch (o.p) {
    case P.BODY:
    case P.CRACK:
    case P.MORTAR:
      brick(x, y, o);
      o.m = o.p === P.MORTAR ? CS.DARK : CS.BRICK;
      // rust weeping from above
      if (f.N && x === 6 && y < 12) {
        o.m = CS.RUST;
        o.t = 0.05;
      }
      break;
    case P.CAP:
      o.m = y === 0 && tnoise(x, 0, 4, 21) > 0.52 ? CS.MOSS : CS.KERB;
      if (x === 8 && y > 0) o.t -= 0.3;
      break;
    case P.FILLET:
      o.m = CS.KERB;
      o.t = -0.2;
      break;
    case P.STRIP:
    case P.FASCIA:
    case P.DENTIL:
      o.m = CS.KERB;
      o.t -= 0.15;
      break;
    default:
      o.m = CS.DARK;
  }
  if (f.S && y >= 14 && o.p === P.GAP && tnoise(x, y, 4, 33) > 0.5) o.m = CS.MOSS;
};

const SETS: Record<EnvSet, { mats: TileMats; fn: MatFn; frieze: boolean }> = {
  marble: { mats: MARBLE_M, fn: marbleMat, frieze: true },
  rot: { mats: ROT_M, fn: rotMat, frieze: true },
  cistern: { mats: CIS_M, fn: cisternMat, frieze: false },
};

// Key light: upper left, slightly in front (matches the character renderer)
const KX = -0.45;
const KY = -0.8;
const KZ = 0.55;
const KL = Math.sqrt(KX * KX + KY * KY + KZ * KZ);
const DEPTH_DARK = 0.7;

/**
 * Render one 16x16 tile from a per-pixel description. Pixels just outside the
 * tile are sampled from the same description (with the shared sides closed)
 * so lighting is continuous across tile seams.
 */
function renderTile(pc: PixelCanvas, ox: number, desc: (x: number, y: number, f: Flags, o: Px) => void, f: Flags, mats: TileMats, depthFade = true) {
  const S = 18;
  const hh = new Float32Array(S * S);
  const pp = new Uint8Array(S * S);
  const mm = new Uint8Array(S * S);
  const tt = new Float32Array(S * S);
  const o: Px = { h: 0, p: 0, t: 0, m: 0, lx: 0, ly: 0 };
  for (let y = -1; y <= 16; y++)
    for (let x = -1; x <= 16; x++) {
      const k = (y + 1) * S + x + 1;
      const outX = x < 0 || x > 15;
      const outY = y < 0 || y > 15;
      if ((x < 0 && f.W) || (x > 15 && f.E) || (y < 0 && f.N) || (y > 15 && f.S)) continue;
      let ff = f;
      if (outX || outY) ff = { N: outY ? false : f.N, S: outY ? false : f.S, E: outX ? false : f.E, W: outX ? false : f.W };
      o.h = 0;
      o.p = 0;
      desc((x + 16) & 15, (y + 16) & 15, ff, o);
      if (!o.p) continue;
      hh[k] = o.h;
      pp[k] = o.p;
      mm[k] = o.m;
      tt[k] = o.t;
    }
  const d = pc.data;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const k = (y + 1) * S + x + 1;
      if (!pp[k]) continue;
      const h0 = hh[k];
      const at = (j: number) => (pp[j] ? hh[j] : h0);
      let gx = (at(k + 1) - at(k - 1)) * 0.5;
      let gy = (at(k + S) - at(k - S)) * 0.5;
      gx = Math.max(-2, Math.min(2, gx));
      gy = Math.max(-2, Math.min(2, gy));
      const ln = Math.sqrt(gx * gx + gy * gy + 1);
      const nx = -gx / ln;
      const ny = -gy / ln;
      const nz = 1 / ln;
      const ndl = (nx * KX + ny * KY + nz * KZ) / KL;
      const m = mm[k];
      let v = 0.2 + Math.max(0, ndl) * 0.72;
      // height itself reads as light: raised parts catch more of it
      v *= 0.78 + Math.max(-2, Math.min(4, h0)) * 0.06;
      v *= 1 + tt[k];
      // Depth falloff: masonry far from any exposed face sinks into darkness,
      // so solid masses read as heavy and the lit edges carry the detail.
      let dep = 16;
      if (f.N) dep = Math.min(dep, y < 7 ? 0 : y - 4);
      if (f.S) dep = Math.min(dep, 15 - y);
      if (f.W) dep = Math.min(dep, x);
      if (f.E) dep = Math.min(dep, 15 - x);
      const dk = !depthFade ? 0 : dep >= 15 ? 1 : dep <= 3 ? 0 : (dep - 3) / 12;
      v *= 1 - dk * DEPTH_DARK;
      v += (0.14 - v) * dk * 0.5; // and loses contrast
      const sp = mats.spec[m];
      if (sp > 0) {
        const hx = KX / KL;
        const hy = KY / KL;
        const hz = KZ / KL + 1;
        const hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
        const nh = (nx * hx + ny * hy + nz * hz) / hl;
        if (nh > 0) v += nh ** 20 * sp * 0.6 * (1 - dk);
      }
      const rmp = mats.ramps[m];
      const n = rmp.length;
      const fq = Math.max(0, Math.min(1, v)) * (n - 1) * 0.9999;
      let i = Math.floor(fq);
      if (fq - i > 0.5 + (bayer(x, y) - 0.5) * 0.7) i++;
      let [r, g, b] = rmp[Math.min(n - 1, i)];
      // outline the silhouette (sides and underside) like the characters
      const openW = !pp[k - 1];
      const openE = !pp[k + 1];
      const openS = !pp[k + S];
      if (openW || openE || openS) {
        r *= 0.4;
        g *= 0.35;
        b *= 0.4;
      }
      const o4 = (y * pc.w + ox + x) * 4;
      d[o4] = r;
      d[o4 + 1] = g;
      d[o4 + 2] = b;
      d[o4 + 3] = 255;
    }
}

// --- Platforms (one-way ledges) ---------------------------------------------------

/** Shared ledge silhouette and heights: a moulded slab on scrolled corbels. */
function ledge(x: number, y: number, kind: 0 | 1 | 2, o: Px) {
  const endL = kind === 0;
  const endR = kind === 2;
  o.t = 0;
  o.lx = x;
  o.ly = y;
  // rounded slab ends
  if ((endL && x === 0 && (y === 0 || y >= 5)) || (endR && x === 15 && (y === 0 || y >= 5))) {
    o.p = P.EMPTY;
    return;
  }
  if (y <= 5) {
    const side = (endL && x <= 1) || (endR && x >= 14) ? -0.7 : 0;
    if (y < 3) {
      o.p = P.CAP;
      o.h = [3.4, 4.2, 3.9][y] + side;
      o.t = (tnoise(x, y * 4, 4, 9) - 0.5) * 0.1;
    } else if (y === 3) {
      o.p = P.FILLET;
      o.h = 3.2 + side;
    } else {
      o.p = P.FASCIA;
      o.h = (y === 4 ? 2.8 : 2) + side;
    }
    return;
  }
  // under-moulding
  if (y === 6) {
    if ((endL && x < 2) || (endR && x > 13)) {
      o.p = P.EMPTY;
      return;
    }
    o.p = P.STRIP;
    o.h = 1.4;
    return;
  }
  // corbels
  let cx = -1;
  let w = 0;
  if (endL || endR) {
    // scrolled bracket: wide at top, curling to a knob
    const lx = endL ? x - 2 : 13 - x;
    const yy = y - 7;
    w = 6 - yy * 0.85;
    if (yy <= 6 && lx >= 0 && lx < w) {
      o.p = P.PILASTER;
      const nx = lx / Math.max(1, w);
      o.h = 2.4 * Math.sin(Math.PI * (0.15 + nx * 0.85)) + (yy === 6 ? -0.5 : 0);
      o.lx = lx;
      o.t = lx === 0 ? 0.05 : 0;
      return;
    }
    if (yy === 7 && lx >= 0 && lx < 2) {
      o.p = P.PILASTER;
      o.h = 1;
      return;
    }
  } else {
    cx = 7.5;
    w = 2.6 - (y - 7) * 0.45;
    if (y <= 11 && Math.abs(x + 0.5 - 8) < w) {
      o.p = P.PILASTER;
      o.h = 2 - Math.abs(x + 0.5 - 8) * 0.5;
      return;
    }
  }
  void cx;
  o.p = P.EMPTY;
}

function ledgeMat(set: EnvSet, x: number, y: number, kind: 0 | 1 | 2, o: Px) {
  if (set === 'rot') {
    switch (o.p) {
      case P.CAP: {
        o.m = RT.FLESH;
        const lump = tnoise(x, y * 3, 8, 13) - 0.5;
        o.h += lump * 1.2;
        o.t += lump * 0.3;
        break;
      }
      case P.FILLET:
        o.m = x % 3 === 1 ? RT.BLOOD : RT.BONE;
        break;
      case P.FASCIA:
        o.m = RT.SINEW;
        break;
      case P.STRIP:
        o.m = RT.BLOOD;
        break;
      default:
        // corbels become knuckled bone with blood pooling at the tips
        o.m = RT.BONE;
        if (y >= 12 || (kind === 1 && y >= 10)) o.m = RT.BLOOD;
    }
    return;
  }
  switch (o.p) {
    case P.CAP:
      o.m = MB.CAP;
      break;
    case P.FILLET:
      o.m = MB.GOLD;
      o.t = (x & 3) === 1 ? 0.15 : 0;
      break;
    case P.FASCIA:
      o.m = MB.TRIM;
      break;
    case P.STRIP:
      o.m = MB.DARK;
      break;
    default:
      o.m = MB.TRIM;
  }
}

/** Cistern ledge: a rotten plank lashed with rusted iron bands (pixel-drawn). */
function plank(x: number, y: number, kind: 0 | 1 | 2): string | null {
  const endL = kind === 0;
  const endR = kind === 2;
  if (y > 5) {
    // iron brackets under the ends
    if ((endL && x >= 2 && x <= 3) || (endR && x >= 12 && x <= 13)) {
      if (y <= 10 - Math.abs(x - (endL ? 2 : 13)) * 2) return pick(RUSTR, 0.7 - (y - 6) * 0.1, x, y);
    }
    return null;
  }
  if ((endL && x === 0) || (endR && x === 15)) return y === 0 || y === 5 ? null : INK;
  if (y === 5) return INK;
  const band = (endL && x >= 2 && x <= 3) || (endR && x >= 12 && x <= 13) || (kind === 1 && x >= 7 && x <= 8);
  if (band) return pick(RUSTR, 0.8 - y * 0.15, x, y);
  if (y === 0) return WOOD[4];
  const grain = Math.sin(x * 0.6 + y * 2.3 + tnoise(x, y, 4, 9) * 4);
  return pick(WOOD, 0.5 - y * 0.06 + grain * 0.12 + (hash2(x >> 2, y, 5) - 0.5) * 0.1, x, y);
}

// --- Liquids ---------------------------------------------------------------------

interface LiquidStyle {
  body: string[];
  surf: string[];
  glint: string;
  alpha: number;
}
const LIQ: Record<EnvSet, LiquidStyle> = {
  marble: { body: ['#0e1416', '#141c1f', '#1c2427', '#253033', '#2f3c40'], surf: ['#2f3c40', '#4a5a5e', '#6f8487', '#a8bcbc'], glint: '#e4f0ec', alpha: 0.84 },
  rot: { body: ['#1e0206', '#2e0409', '#3e060e', '#4e0815', '#62101c'], surf: ['#4e0815', '#8a1020', '#c01a2c', '#e8343a'], glint: '#ff9a82', alpha: 0.95 },
  cistern: { body: ['#1c0306', '#2a050a', '#3a080f', '#4c0c14', '#5e121a'], surf: ['#5e121a', '#8a1a20', '#b8402a', '#e09048'], glint: '#ffe0a0', alpha: 0.86 },
};

function liquid(pc: PixelCanvas, ox: number, set: EnvSet, top: boolean) {
  const L = LIQ[set];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const n = tnoise(x, y, 4, 61) * 0.6 + tnoise(x, y, 8, 62) * 0.4;
      if (top) {
        const wave = Math.round(Math.sin((x / 16) * Math.PI * 4) * 0.8 + 1);
        if (y < wave) {
          if (y === wave - 1 && set === 'rot' && hash2(x, 2, 6) > 0.8) pc.px(ox + x, y, L.surf[1], 0.9);
          continue;
        }
        if (y === wave) {
          pc.px(ox + x, y, hash2(x, 1, 7) > 0.8 ? L.glint : pick(L.surf, 0.7 + n * 0.3, x, y), 0.92);
          continue;
        }
        if (y <= wave + 2) {
          pc.px(ox + x, y, pick(L.surf, 0.25 + n * 0.4 - (y - wave) * 0.1, x, y), Math.max(L.alpha, 0.88));
          continue;
        }
      }
      let v = 0.35 + (n - 0.5) * 0.5 - (top ? 0 : 0.1);
      if (set === 'rot' && tnoise(x, y, 4, 71) > 0.72) v -= 0.3; // clots
      let c = pick(L.body, v, x, y);
      // Slow drifting highlights
      if (Math.abs(tnoise(x, y * 3, 4, 64) - 0.5) < 0.03) c = L.surf[1];
      pc.px(ox + x, y, c, L.alpha);
    }
}

// --- Grate & thorns ----------------------------------------------------------------

function grate(pc: PixelCanvas, ox: number, set: EnvSet) {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let c: string | null = null;
      if (y >= 10) {
        // masonry below the grille: copy the interior tile
        const s = (y * pc.w + 15 * 16 + x) * 4;
        const t = (y * pc.w + ox + x) * 4;
        for (let q = 0; q < 4; q++) pc.data[t + q] = pc.data[s + q];
        continue;
      }
      else if (set === 'rot') {
        // Two mouths set into a gum frame
        const mx = x < 8 ? 3.5 : 11.5;
        const dx = (x - mx) / 3.6;
        const dy = (y - 4.5) / 3.2;
        const d = dx * dx + dy * dy;
        if (y === 9) c = FLESH[0];
        else if (d < 0.45) {
          const teeth = (y === 3 || y === 6) && x % 2 === 0;
          c = teeth ? BONE[4] : y < 4 ? '#0a0204' : '#2a0308';
        } else if (d < 1.0) c = y < 4 ? FLESH[4] : d > 0.8 ? FLESH[1] : FLESH[3];
        else c = y === 0 ? FLESH[5] : pick(FLESH, 0.65 - y * 0.05, x, y);
      } else {
        const R = set === 'marble' ? BRASS : IRONR;
        if (y <= 1 || y === 9) c = y === 0 ? R[4] : y === 9 ? R[0] : R[3];
        else {
          const m = x % 4;
          if (m === 0 || m === 1) c = pick(R, m === 0 ? 0.75 - y * 0.04 : 0.45 - y * 0.03, x, y);
          else c = y === 8 ? '#3a0a0e' : y === 7 ? '#1a0306' : '#050203';
          if (set === 'cistern' && m <= 1 && hash2(x, y, 5) > 0.7) c = RUSTR[2];
        }
        if (x === 0 || x === 15) c = R[0];
      }
      if (c) pc.px(ox + x, y, c);
    }
}

function thorns(pc: PixelCanvas, ox: number, set: EnvSet) {
  const R = set === 'rot' ? BONE : set === 'cistern' ? [...RUSTR, '#b06a36'] : IRONR;
  const spikes = [
    [1.5, 9],
    [4.5, 13],
    [7.5, 8],
    [10.5, 14],
    [13.5, 10],
  ];
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      let c: string | null = null;
      if (y >= 13) {
        if (set === 'rot') c = y === 13 ? FLESH[4] : y === 14 ? FLESH[2] : FLESH[1];
        else c = y === 13 ? R[3] : y === 14 ? R[1] : R[0];
      } else {
        for (const [sx, h] of spikes) {
          const t = (16 - y) / h; // 0 at base .. 1 at tip
          if (t > 1) continue;
          const half = 1.6 * (1 - t) + 0.3;
          const dx = x + 0.5 - sx;
          if (Math.abs(dx) <= half) {
            const tip = t > 0.72;
            if (tip && set !== 'rot') c = t > 0.86 ? BLOODR[4] : BLOODR[2];
            else if (tip && set === 'rot' && t > 0.85) c = BLOODR[3];
            else c = dx < -0.3 ? R[R.length - 1] : dx > 0.5 ? R[1] : R[2];
            if (Math.abs(dx) > half - 0.6 && Math.abs(dx) <= half) c = dx > 0 ? R[0] : c;
          }
        }
      }
      if (c) pc.px(ox + x, y, c);
    }
}

// --- Assembly ------------------------------------------------------------------------

export function drawTileset(set: EnvSet): PixelCanvas {
  const pc = new PixelCanvas(TILE * ET.COUNT, TILE);
  const S = SETS[set];
  const desc = (x: number, y: number, f: Flags, o: Px) => {
    layout(x, y, f, S.frieze, o);
    if (o.p) S.fn(x, y, f, o);
  };
  for (let m = 0; m < 16; m++) {
    const f: Flags = { N: !(m & 1), E: !(m & 2), S: !(m & 4), W: !(m & 8) };
    renderTile(pc, m * 16, desc, f, S.mats);
  }
  const closed: Flags = { N: false, E: false, S: false, W: false };
  for (const [i, k] of [
    [ET.PLAT_L, 0],
    [ET.PLAT_M, 1],
    [ET.PLAT_R, 2],
  ] as const) {
    if (set === 'cistern') {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const c = plank(x, y, k);
          if (c) pc.px(i * 16 + x, y, c);
        }
      continue;
    }
    const mats = set === 'rot' ? ROT_M : MARBLE_M;
    renderTile(
      pc,
      i * 16,
      (x, y, _f, o) => {
        ledge(x, y, k, o);
        if (o.p) ledgeMat(set, x, y, k, o);
      },
      closed,
      mats,
      false,
    );
  }
  liquid(pc, ET.LIQUID_TOP * 16, set, true);
  liquid(pc, ET.LIQUID * 16, set, false);
  grate(pc, ET.GRATE * 16, set);
  thorns(pc, ET.THORNS * 16, set);
  return pc;
}
