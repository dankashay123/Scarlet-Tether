import { mulberry32 } from '../art/pixel';
import { ANTE_LAYOUT, BOSS_LAYOUT, COMBAT_LAYOUTS, SHRINE_LAYOUT, type Layout } from './layouts';

export type RoomType = 'combat' | 'elite' | 'confessional' | 'votive' | 'cache' | 'ante' | 'boss';

export interface RoomNode {
  type: RoomType;
  layout: Layout;
  depth: number;
  seed: number;
}

/** Rooms before the antechamber; the boss follows it. */
export const ROOMS_BEFORE_ANTE = 8;

export const ROOM_TITLES: Record<RoomType, string> = {
  combat: '',
  elite: 'A Heavier Sin',
  confessional: 'A Weeping Confessional',
  votive: 'A Votive Alcove',
  cache: 'A Reliquary Cache',
  ante: 'The Antechamber of the Ear',
  boss: 'The Grand Confessional',
};

export const EMBLEM: Record<RoomType, string> = {
  combat: 'combat',
  elite: 'elite',
  confessional: 'confessional',
  votive: 'votive',
  cache: 'cache',
  ante: 'votive',
  boss: 'boss',
};

class Plan {
  rand: () => number = Math.random;
  current: RoomNode | null = null;
  recentLayouts: string[] = [];
  history: RoomType[] = [];

  start(seed = Math.floor(Math.random() * 1e9)) {
    this.rand = mulberry32(seed);
    this.recentLayouts = [];
    this.history = [];
    this.current = this.make('combat', 0);
    return this.current;
  }

  private pickCombatLayout(): Layout {
    const pool = COMBAT_LAYOUTS.filter((l) => !this.recentLayouts.includes(l.name));
    const l = pool[Math.floor(this.rand() * pool.length)] ?? COMBAT_LAYOUTS[0];
    this.recentLayouts.push(l.name);
    if (this.recentLayouts.length > 4) this.recentLayouts.shift();
    return l;
  }

  make(type: RoomType, depth: number): RoomNode {
    let layout: Layout;
    if (type === 'combat' || type === 'elite') layout = this.pickCombatLayout();
    else if (type === 'ante') layout = ANTE_LAYOUT;
    else if (type === 'boss') layout = BOSS_LAYOUT;
    else layout = SHRINE_LAYOUT;
    return { type, layout, depth, seed: Math.floor(this.rand() * 1e9) };
  }

  /** What lies beyond each of `n` doors once the current room is cleared. */
  choices(n: number): RoomType[] {
    const cur = this.current!;
    const d = cur.depth + 1;
    if (cur.type === 'ante') return Array(n).fill('boss');
    if (d >= ROOMS_BEFORE_ANTE) return Array(n).fill('ante');
    const confessions = this.history.filter((t) => t === 'confessional').length;
    const w: [RoomType, number][] = [
      ['combat', 5],
      ['elite', d >= 3 ? 2 : 0],
      ['confessional', confessions === 0 && d >= 2 ? 6 : confessions < 3 ? 2.5 : 0.8],
      ['votive', d >= 4 ? 1.4 : 0],
      ['cache', d >= 1 ? 1.4 : 0],
    ];
    const out: RoomType[] = [];
    for (let i = 0; i < n; i++) {
      const avail = w.filter(([t, wt]) => wt > 0 && !out.includes(t) && !(t !== 'combat' && t === cur.type));
      const total = avail.reduce((a, [, wt]) => a + wt, 0);
      let r = this.rand() * total;
      let pick: RoomType = 'combat';
      for (const [t, wt] of avail) {
        if ((r -= wt) <= 0) {
          pick = t;
          break;
        }
      }
      out.push(pick);
    }
    // Never offer only rest: at least one door leads to a fight early on.
    if (d < 3 && !out.includes('combat')) out[0] = 'combat';
    return out;
  }

  advance(type: RoomType) {
    const d = (this.current?.depth ?? -1) + 1;
    this.history.push(type);
    this.current = this.make(type, d);
    return this.current;
  }
}

export const plan = new Plan();
