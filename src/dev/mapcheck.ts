// Reachability check for generated maps: can the player get from the spawn
// to every exit, doorway, shrine and feature using the real movement rules?
// Run with: npm run mapcheck
import { generateMap, type GeneratedMap } from '../game/mapgen';
import { TEMPLATES } from '../game/rooms';

const JUMP_UP = 5; // rows (one-way ledges five rows up are reachable)
const JUMP_ACROSS = 5; // columns
const GRAB_UP = 7; // a solid stone corner can be grabbed this high
const HEAD = 3; // body is ~3 tiles tall

export interface Report {
  seed: number;
  unreachable: { what: string; room: string; x: number; y: number }[];
}

export function checkMap(m: GeneratedMap, seed = 0): Report {
  const rows = m.rows;
  const H = rows.length;
  const W = rows[0].length;
  const ch = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? '#' : rows[y][x]);
  const solid = (x: number, y: number) => ch(x, y) === '#' || ch(x, y) === 'g';
  const ladder = (x: number, y: number) => ch(x, y) === '|' || ch(x, y) === '!';
  const oneWay = (x: number, y: number) => ch(x, y) === '=' || (ch(x, y) === '|' && !ladder(x, y - 1) && !solid(x, y - 1));
  const open = (x: number, y: number) => !solid(x, y);
  const roomy = (x: number, y: number) => open(x, y) && open(x, y - 1) && open(x, y - 2);
  // Standing at cell (x,y) means feet rest on top of row y+1
  const stand = (x: number, y: number) => roomy(x, y) && (solid(x, y + 1) || oneWay(x, y + 1));
  const seen = new Uint8Array(W * H);
  const q: number[] = [];
  const visit = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (seen[i]) return;
    seen[i] = 1;
    q.push(i);
  };
  const fallFrom = (x: number, y: number) => {
    let yy = y;
    while (yy < H - 1 && !stand(x, yy) && !ladder(x, yy)) {
      if (solid(x, yy + 1)) break;
      yy++;
    }
    if (stand(x, yy) || ladder(x, yy)) visit(x, yy);
  };

  // Start at the spawn
  let sx = -1;
  let sy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rows[y][x] === 'S') ((sx = x), (sy = y));
  if (sx < 0) return { seed, unreachable: [{ what: 'spawn missing', room: '', x: 0, y: 0 }] };
  fallFrom(sx, sy);

  while (q.length) {
    const i = q.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    if (ladder(x, y)) {
      // Climb up/down; step off sideways
      if (ladder(x, y - 1) || (open(x, y - 1) && ladder(x, y))) visit(x, y - 1);
      if (ladder(x, y + 1)) visit(x, y + 1);
      for (const d of [-1, 1]) if (roomy(x + d, y)) fallFrom(x + d, y);
      if (stand(x, y)) visit(x, y);
      if (!ladder(x, y - 1) && stand(x, y - 1)) visit(x, y - 1);
    }
    if (!stand(x, y)) {
      if (!ladder(x, y)) fallFrom(x, y);
      continue;
    }
    // Walk / step off edges
    for (const d of [-1, 1]) if (roomy(x + d, y)) fallFrom(x + d, y);
    // Grab a ladder overhead or below
    if (ladder(x, y - 1)) visit(x, y - 1);
    if (ladder(x, y + 1)) visit(x, y + 1);
    // Drop through a ledge
    if (oneWay(x, y + 1)) fallFrom(x, y + 2);
    // Jumps: any standing spot up to JUMP_UP rows higher and JUMP_ACROSS away,
    // provided the column above us is clear for the rise.
    let clear = 0;
    while (clear < GRAB_UP && open(x, y - HEAD - clear)) clear++;
    for (let dy = 0; dy <= GRAB_UP; dy++) {
      for (let dx = -JUMP_ACROSS - 1; dx <= JUMP_ACROSS + 1; dx++) {
        const tx = x + dx;
        const ty = y - dy;
        if (!stand(tx, ty)) continue;
        const onStone = solid(tx, ty + 1);
        const ok =
          (dy <= JUMP_UP && Math.abs(dx) <= JUMP_ACROSS && dy <= clear + 1) ||
          (onStone && dy <= GRAB_UP && Math.abs(dx) <= 2 && dy <= clear + 2);
        if (ok) visit(tx, ty);
      }
    }
  }

  const reach = (x: number, y: number) => {
    for (let dy = -2; dy <= 3; dy++) for (let dx = -1; dx <= 1; dx++) if (seen[(y + dy) * W + x + dx]) return true;
    return false;
  };
  const unreachable: Report['unreachable'] = [];
  const roomName = (x: number, y: number) => m.rooms.find((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)?.tpl.name ?? '?';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = rows[y][x];
      if ('DXVK'.includes(c) && !reach(x, y)) unreachable.push({ what: c === 'D' ? 'boss door' : 'shrine/feature', room: roomName(x, y), x, y });
    }
  // Every room must be enterable
  for (const r of m.rooms) {
    let any = false;
    for (let y = r.y0; y <= r.y1 && !any; y++) for (let x = r.x0; x <= r.x1 && !any; x++) if (seen[y * W + x]) any = true;
    if (!any) unreachable.push({ what: 'room', room: r.tpl.name, x: r.x0, y: r.y0 });
  }
  return { seed, unreachable };
}

/** Run many seeds; returns a summary for the console or a test runner. */
export function checkMany(n = 200) {
  const fails: Report[] = [];
  let rooms = 0;
  for (let s = 1; s <= n; s++) {
    const m = generateMap(s * 104729);
    rooms += m.rooms.length;
    const r = checkMap(m, s);
    if (r.unreachable.length) fails.push(r);
  }
  return { n, avgRooms: rooms / n, fails, templates: TEMPLATES.length };
}
