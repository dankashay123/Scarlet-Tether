// Handmade side-view rooms for the Sunken Confessionals, strung together in
// a random order each descent.
//
// Legend
//  #  solid stone            g  solid floor with a whispering grate
//  =  one-way ledge (jump up through, hold down + jump to drop)
//  ~  coagulated pool (slows; looks like water while sane)
//  ^  thorns of penance (hidden while lucid)
//  .  air                    S  entrance (player spawn)
//  D  exit door (stands on the floor at this cell)
//  e  ground enemy           f  flying enemy          E  elite
//  P  censer pendulum (hangs from the ceiling above this cell)
//  B  confessional booth     c  candelabra            s  weeping saint statue
//  k  hanging cage           C  weeping confessional  V  votive altar
//  K  reliquary cache        b  boss
//  Hub only: H chute, M Magdalene, O Vivisect, L Hollow, W lineage lectern

export interface Layout {
  name: string;
  kind: 'combat' | 'shrine' | 'boss' | 'hub' | 'ante';
  rows: string[];
}

export const BOSS_LAYOUT: Layout = {
  name: 'The Grand Confessional',
  kind: 'boss',
  // One screen and a little more, as a Super Metroid boss room
  rows: [
    '################################',
    '#..............................#',
    '#.....k...............k........#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#.....======...................#',
    '#..............................#',
    '#...c.....s.......c.......b....#',
    '#.S............................#',
    '################################',
    '################################',
    '################################',
    '################################',
  ],
};

export const HUB_LAYOUT: Layout = {
  name: 'The Drain of Absolution',
  kind: 'hub',
  rows: [
    '##############################################################',
    '#....H.......................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#............................................................#',
    '#........c.....L.........M............O.........W.......D....#',
    '#.S..........................................................#',
    '#~~~~~~~~~~#####################################################',
    '##############################################################',
    '##############################################################',
    '##############################################################',
  ],
};

/**
 * Make hand-typed rows equal width: the most common row length wins; short
 * rows are padded with stone, long ones trimmed (keeping a closing wall).
 */
export function normalise(l: Layout): Layout {
  const count = new Map<number, number>();
  for (const r of l.rows) count.set(r.length, (count.get(r.length) ?? 0) + 1);
  const w = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return {
    ...l,
    rows: l.rows.map((r) => {
      if (r.length < w) return r + '#'.repeat(w - r.length);
      if (r.length > w) return r.slice(0, w - 1) + '#';
      return r;
    }),
  };
}
