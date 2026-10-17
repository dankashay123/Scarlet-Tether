import { assemble, exitsOf, type Dir, type GeneratedMap, type PlacedRoom, type RoomRole } from './mapgen';
import { TEMPLATES, type RoomTheme } from './rooms';

/**
 * The handmade world: the Sunken Confessionals, laid out room by room on the
 * map grid like a Super Metroid area. Rooms link wherever two exits face
 * each other; unused side exits are sealed.
 *
 * Progression (first area):
 *   - The Chute's Foot is the first save altar.
 *   - The Antechamber of the Ear (boss) is behind a crimson hatch, opened only
 *     by a Censer Shell. The Censer Launcher waits deep in the crypt.
 *   - Cracked false walls need shells too, so the Reliquary Shards behind
 *     them call you back once you have the launcher.
 */

/** What a room holds besides its enemies. */
export type Treasure = 'launcher' | 'shells' | 'shard' | 'save';

interface Plan {
  tpl: string;
  gx: number;
  gy: number;
  role?: RoomRole;
  theme?: RoomTheme;
  /** An item on the room's 'X' feature spot. */
  item?: Treasure;
}

/** Hatches between rooms: crimson ones open only to a Censer Shell. */
export interface Hatch {
  a: number; // room ids
  b: number;
  dir: Dir; // from a to b
  kind: 'grey' | 'crimson';
}

const PLAN: Plan[] = [
  // Row 0: the cathedral at the Chute's level
  { tpl: 'The Chute’s Foot', gx: 0, gy: 0, role: 'start', item: 'save' },
  { tpl: 'The Nave of Whispers', gx: 1, gy: 0 },
  { tpl: 'The Bell Shaft', gx: 2, gy: 0 },
  { tpl: 'The Long Nave', gx: 3, gy: 0, role: 'elite' },
  { tpl: 'The Antechamber of the Ear', gx: 5, gy: 0, role: 'ante' },
  // Above the bell shaft: a loft with Censer Shells
  { tpl: 'A High Reliquary', gx: 2, gy: -1, role: 'cache', item: 'shells' },
  // Row 1
  { tpl: 'A Side Chapel', gx: 0, gy: 1, role: 'votive', item: 'save' },
  { tpl: 'The Flooded Aisle', gx: 1, gy: 1 },
  { tpl: 'The Choir Loft', gx: 3, gy: 1 },
  { tpl: 'The Thorned Dais', gx: 5, gy: 1 },
  { tpl: 'The Crypt Descent', gx: 6, gy: 1 },
  { tpl: 'A Walled-Up Chapel', gx: 7, gy: 1, role: 'cache', item: 'shard' },
  // Row 2: under the bell shaft
  { tpl: 'A Ladder Landing', gx: 2, gy: 2 },
  { tpl: 'The Pendulum Walk', gx: 1, gy: 2 },
  { tpl: 'The Collapsed Gallery', gx: 3, gy: 2 },
  // Row 3: the crypt proper
  { tpl: 'The Crossing', gx: 6, gy: 3 },
  { tpl: 'The Drowned Sacristy', gx: 4, gy: 3 },
  { tpl: 'The Processional', gx: 7, gy: 3, role: 'elite' },
  { tpl: 'The Great Ossuary', gx: 10, gy: 3 },
  { tpl: 'The Pilgrims’ Bridge', gx: 12, gy: 3 },
  { tpl: 'A Side Chapel', gx: 14, gy: 3, role: 'votive', item: 'save' },
  // Row 4: the deep places
  { tpl: 'A Sunken Chapel', gx: 6, gy: 4, role: 'cache', item: 'launcher' },
];

const OPP: Record<Dir, Dir> = { W: 'E', E: 'W', N: 'S', S: 'N' };
const STEP: Record<Dir, [number, number]> = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };

export interface World {
  map: GeneratedMap;
  hatches: Hatch[];
  items: Map<number, Treasure>;
}

let built: World | null = null;

/** Build (once) and return the handmade world. */
export function buildWorld(): World {
  if (built) return built;
  const byName = new Map(TEMPLATES.map((t) => [t.name, t]));
  const rooms: PlacedRoom[] = [];
  const occ = new Map<string, number>();
  const items = new Map<number, Treasure>();
  for (const p of PLAN) {
    if (!Number.isInteger(p.gy)) continue;
    const tpl = byName.get(p.tpl);
    if (!tpl) throw new Error(`world: no template ${p.tpl}`);
    let clash = false;
    for (let y = 0; y < tpl.ch; y++) for (let x = 0; x < tpl.cw; x++) if (occ.has(`${p.gx + x},${p.gy + y}`)) clash = true;
    if (clash) throw new Error(`world: ${p.tpl} overlaps another room at ${p.gx},${p.gy}`);
    const id = rooms.length;
    rooms.push({ id, tpl, gx: p.gx, gy: p.gy, role: p.role ?? 'combat', depth: 0, theme: p.theme ?? tpl.theme ?? 'marble', links: [], x0: 0, y0: 0, x1: 0, y1: 0 });
    for (let y = 0; y < tpl.ch; y++) for (let x = 0; x < tpl.cw; x++) occ.set(`${p.gx + x},${p.gy + y}`, id);
    if (p.item) items.set(id, p.item);
  }
  // Link facing exits between neighbours
  for (const a of rooms) {
    for (const e of exitsOf(a.tpl)) {
      const [dx, dy] = STEP[e.dir];
      const nx = a.gx + e.cx + dx;
      const ny = a.gy + e.cy + dy;
      const bid = occ.get(`${nx},${ny}`);
      if (bid === undefined || bid === a.id) continue;
      const b = rooms[bid];
      const back = exitsOf(b.tpl).find((x) => x.dir === OPP[e.dir] && b.gx + x.cx === nx && b.gy + x.cy === ny);
      if (!back) continue;
      if (a.links.some((l) => l.exit === e)) continue;
      a.links.push({ exit: e, to: b.id });
      b.links.push({ exit: back, to: a.id });
    }
  }
  // Every mandatory shaft must lead somewhere
  for (const r of rooms) {
    for (const e of exitsOf(r.tpl)) {
      if ((e.dir === 'N' || e.dir === 'S') && !r.links.some((l) => l.exit === e)) throw new Error(`world: ${r.tpl.name} has an unlinked ${e.dir} shaft`);
    }
  }
  // Depth for enemy strength: distance (in links) from the start
  const q = [0];
  const seen = new Set([0]);
  while (q.length) {
    const id = q.shift()!;
    for (const l of rooms[id].links)
      if (!seen.has(l.to)) {
        seen.add(l.to);
        rooms[l.to].depth = rooms[id].depth + 1;
        q.push(l.to);
      }
  }
  const map = assemble(rooms);
  // Two storeys of cathedral, the crypt below them, the bridge outside
  // (assemble shifted the grid, so measure from the start room)
  for (const r of rooms) r.theme = r.tpl.theme ?? (r.gy >= rooms[0].gy + 2 ? 'crypt' : 'marble');
  const ante = rooms.find((r) => r.role === 'ante')!;
  const toAnte = ante.links[0];
  const hatches: Hatch[] = toAnte ? [{ a: toAnte.to, b: ante.id, dir: OPP[toAnte.exit.dir], kind: 'crimson' }] : [];
  built = { map, hatches, items };
  return built;
}
