import { mulberry32 } from '../art/pixel';
import { CH, CW, FLOOR_ROW, SHAFT_COL, SIDE_ROWS, TEMPLATES, type RoomKind, type RoomTheme, type Template } from './rooms';

export type Dir = 'W' | 'E' | 'N' | 'S';
const OPP: Record<Dir, Dir> = { W: 'E', E: 'W', N: 'S', S: 'N' };
const STEP: Record<Dir, [number, number]> = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };

export type RoomRole = 'start' | 'combat' | 'elite' | 'confessional' | 'votive' | 'cache' | 'ante';

/** An exit on a template: which cell of the template, and which edge. */
interface Exit {
  cx: number;
  cy: number;
  dir: Dir;
}

export interface PlacedRoom {
  id: number;
  tpl: Template;
  gx: number; // grid cell origin
  gy: number;
  role: RoomRole;
  depth: number; // rooms from the start along the path
  theme: RoomTheme;
  links: { exit: Exit; to: number }[];
  /** Tile-space bounds in the assembled level. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GeneratedMap {
  rows: string[];
  rooms: PlacedRoom[];
  /** Grid size in cells, and origin offset (cells) applied to rooms. */
  gw: number;
  gh: number;
}

const exitCache = new Map<Template, Exit[]>();
function exitsOf(t: Template): Exit[] {
  const c = exitCache.get(t);
  if (c) return c;
  const out: Exit[] = [];
  const W = t.cw * CW;
  const H = t.ch * CH;
  for (let cy = 0; cy < t.ch; cy++) {
    if (t.rows[cy * CH + SIDE_ROWS[0]][0] === '<') out.push({ cx: 0, cy, dir: 'W' });
    if (t.rows[cy * CH + SIDE_ROWS[0]][W - 1] === '>') out.push({ cx: t.cw - 1, cy, dir: 'E' });
  }
  for (let cx = 0; cx < t.cw; cx++) {
    if (t.rows[0][cx * CW + SHAFT_COL] === 'n') out.push({ cx, cy: 0, dir: 'N' });
    if (t.rows[H - 1][cx * CW + SHAFT_COL] === 'u') out.push({ cx, cy: t.ch - 1, dir: 'S' });
  }
  exitCache.set(t, out);
  return out;
}

const vertical = (d: Dir) => d === 'N' || d === 'S';

/**
 * Stitch handmade rooms into one interconnected descent: a main path from the
 * Chute's Foot to the Antechamber, side branches to chapels, and every
 * vertical shaft connected. Retries until a valid map is found.
 */
export function generateMap(seed: number, mainLength = 9): GeneratedMap {
  for (let attempt = 0; attempt < 60; attempt++) {
    const m = tryGenerate(seed + attempt * 7919, mainLength);
    if (m) return m;
  }
  // Extremely unlikely: fall back to a short path.
  return tryGenerate(seed, 4)!;
}

function tryGenerate(seed: number, mainLength: number): GeneratedMap | null {
  const rand = mulberry32(seed);
  const occ = new Map<string, number>();
  const rooms: PlacedRoom[] = [];
  const key = (x: number, y: number) => `${x},${y}`;
  const pick = <T,>(a: T[], w: (t: T) => number = () => 1): T | null => {
    const total = a.reduce((s, t) => s + w(t), 0);
    if (!a.length || total <= 0) return null;
    let r = rand() * total;
    for (const t of a) if ((r -= w(t)) <= 0) return t;
    return a[a.length - 1];
  };

  const fits = (t: Template, gx: number, gy: number) => {
    for (let y = 0; y < t.ch; y++) for (let x = 0; x < t.cw; x++) if (occ.has(key(gx + x, gy + y))) return false;
    // Keep the map compact enough for the map screen
    return gy >= -4 && gy <= 4;
  };

  const place = (t: Template, gx: number, gy: number, role: RoomRole, depth: number) => {
    const id = rooms.length;
    rooms.push({ id, tpl: t, gx, gy, role, depth, theme: 'marble', links: [], x0: 0, y0: 0, x1: 0, y1: 0 });
    for (let y = 0; y < t.ch; y++) for (let x = 0; x < t.cw; x++) occ.set(key(gx + x, gy + y), id);
    return rooms[id];
  };

  /** Free exits of a room (not yet linked). */
  const freeExits = (r: PlacedRoom) => exitsOf(r.tpl).filter((e) => !r.links.some((l) => l.exit.cx === e.cx && l.exit.cy === e.cy && l.exit.dir === e.dir));
  const pendingVertical = (r: PlacedRoom) => freeExits(r).filter((e) => vertical(e.dir));

  /** Try to attach a room of one of `kinds` through exit `e` of room `a`. */
  const attach = (a: PlacedRoom, e: Exit, kinds: RoomKind[], role: RoomRole, depth: number, avoidVertical = false): PlacedRoom | null => {
    const [dx, dy] = STEP[e.dir];
    const nx = a.gx + e.cx + dx;
    const ny = a.gy + e.cy + dy;
    const want = OPP[e.dir];
    const options: { t: Template; ex: Exit; gx: number; gy: number }[] = [];
    for (const t of TEMPLATES) {
      if (!kinds.includes(t.kind)) continue;
      const exits = exitsOf(t);
      if (avoidVertical && exits.some((x) => vertical(x.dir) && !(x.dir === want))) continue;
      for (const ex of exits) {
        if (ex.dir !== want) continue;
        const gx = nx - ex.cx;
        const gy = ny - ex.cy;
        if (fits(t, gx, gy)) options.push({ t, ex, gx, gy });
      }
    }
    // Don't repeat the same template back to back
    const fresh = options.filter((o) => o.t !== a.tpl);
    const o = pick(fresh.length ? fresh : options, (x) => x.t.weight ?? 1);
    if (!o) return null;
    const b = place(o.t, o.gx, o.gy, role, depth);
    a.links.push({ exit: e, to: b.id });
    b.links.push({ exit: o.ex, to: a.id });
    return b;
  };

  // --- Main path ----------------------------------------------------------
  const startTpl = TEMPLATES.filter((t) => t.kind === 'start');
  const start = place(startTpl[Math.floor(rand() * startTpl.length)], 0, 0, 'start', 0);
  let cur = start;
  for (let d = 1; d <= mainLength; d++) {
    const free = freeExits(cur);
    if (!free.length) return null;
    // Must follow any open shaft first; otherwise prefer pressing east
    const pv = free.filter((e) => vertical(e.dir));
    const e = pick(pv.length ? pv : free, (x) => (x.dir === 'E' ? 5 : x.dir === 'W' ? 0.6 : 2));
    if (!e) return null;
    const role: RoomRole = d >= 4 && rand() < 0.22 ? 'elite' : 'combat';
    const next = attach(cur, e, ['combat'], role, d);
    if (!next) return null;
    cur = next;
  }
  // Finish any shafts on the last room by continuing through them
  for (let guard = 0; guard < 4 && pendingVertical(cur).length; guard++) {
    const e = pendingVertical(cur)[0];
    const next = attach(cur, e, ['combat'], 'combat', cur.depth + 1);
    if (!next) return null;
    cur = next;
  }
  // The antechamber, through a free west/east exit
  const side = freeExits(cur).filter((e) => e.dir === 'E' || e.dir === 'W');
  let ante: PlacedRoom | null = null;
  for (const e of side.sort((a, b) => (a.dir === 'E' ? -1 : 1) - (b.dir === 'E' ? -1 : 1))) {
    ante = attach(cur, e, ['ante'], 'ante', cur.depth + 1);
    if (ante) break;
  }
  if (!ante) return null;

  // --- Every open shaft must lead somewhere: chapels in pits and lofts ----
  const specials: RoomRole[] = ['confessional', 'votive', 'cache', 'confessional', 'cache'];
  let si = 0;
  const nextSpecial = () => specials[si++ % specials.length];
  for (const r of [...rooms]) {
    for (const e of pendingVertical(r)) {
      const kind: RoomKind = e.dir === 'S' ? 'pit' : 'loft';
      const b = attach(r, e, [kind], nextSpecial(), r.depth + 1);
      if (!b) return null;
    }
  }

  // --- Side branches: chapels (and sometimes a fight before them) ---------
  const branches = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < branches * 4 && si < branches + 2; i++) {
    const host = rooms[1 + Math.floor(rand() * (rooms.length - 1))];
    if (!host || host.role === 'ante') continue;
    const free = freeExits(host).filter((e) => !vertical(e.dir));
    if (!free.length) continue;
    const e = free[Math.floor(rand() * free.length)];
    if (rand() < 0.35) {
      const mid = attach(host, e, ['combat'], 'combat', host.depth + 1, true);
      if (!mid) continue;
      const f2 = freeExits(mid).filter((x) => !vertical(x.dir));
      if (f2.length) attach(mid, f2[0], ['special'], nextSpecial(), mid.depth + 1);
    } else attach(host, e, ['special'], nextSpecial(), host.depth + 1);
  }
  if (rooms.some((r) => pendingVertical(r).length)) return null;
  return assemble(rooms);
}

function assemble(rooms: PlacedRoom[]): GeneratedMap {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    minX = Math.min(minX, r.gx);
    minY = Math.min(minY, r.gy);
    maxX = Math.max(maxX, r.gx + r.tpl.cw);
    maxY = Math.max(maxY, r.gy + r.tpl.ch);
  }
  const gw = maxX - minX;
  const gh = maxY - minY;
  const W = gw * CW;
  const H = gh * CH;
  const grid: string[][] = Array.from({ length: H }, () => Array(W).fill('#'));
  for (const r of rooms) {
    r.gx -= minX;
    r.gy -= minY;
    r.x0 = r.gx * CW;
    r.y0 = r.gy * CH;
    r.x1 = r.x0 + r.tpl.cw * CW - 1;
    r.y1 = r.y0 + r.tpl.ch * CH - 1;
    const used = new Set(r.links.map((l) => `${l.exit.cx},${l.exit.cy},${l.exit.dir}`));
    for (let y = 0; y < r.tpl.rows.length; y++) {
      for (let x = 0; x < r.tpl.rows[y].length; x++) {
        let c = r.tpl.rows[y][x];
        if (c === '<' || c === '>' || c === 'n' || c === 'u') {
          const cx = Math.floor(x / CW);
          const cy = Math.floor(y / CH);
          const dir: Dir = c === '<' ? 'W' : c === '>' ? 'E' : c === 'n' ? 'N' : 'S';
          const open = used.has(`${cx},${cy},${dir}`);
          c = open ? (vertical(dir) ? '|' : '.') : '#';
          // A sealed side exit also loses its threshold step
        }
        // Role-specific markers
        if (c === 'S' && r.role !== 'start') c = '.';
        if (c === 'D' && r.role !== 'ante') c = '.';
        if (c === 'E' && r.role !== 'elite') c = 'e';
        grid[r.y0 + y][r.x0 + x] = c;
      }
    }
  }
  // Areas: the cathedral at the Chute's level, the crypt below it, and any
  // room with its own theme (the bridge outside)
  const startGy = rooms[0].gy;
  for (const r of rooms) r.theme = r.tpl.theme ?? (r.role === 'ante' || r.role === 'start' ? 'marble' : r.gy > startGy ? 'crypt' : 'marble');
  // Doorways between neighbouring rooms: clear the two-tile-thick join
  for (const r of rooms) {
    for (const l of r.links) {
      const e = l.exit;
      if (e.dir === 'E') {
        const x = r.x0 + (e.cx + 1) * CW - 1;
        for (const row of SIDE_ROWS) {
          grid[r.y0 + e.cy * CH + row][x] = '.';
          if (x + 1 < W) grid[r.y0 + e.cy * CH + row][x + 1] = '.';
        }
        grid[r.y0 + e.cy * CH + FLOOR_ROW][x] = '#';
      }
    }
  }
  return { rows: grid.map((r) => r.join('')), rooms, gw, gh };
}

/** Breadth-first reachability check used by tests and the dev map check. */
export function roomAt(map: GeneratedMap, tx: number, ty: number): PlacedRoom | null {
  for (const r of map.rooms) if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
  return null;
}
