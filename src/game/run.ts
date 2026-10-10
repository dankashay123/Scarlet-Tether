import { generateMap, type GeneratedMap } from './mapgen';

/** The current descent: one generated map of the Sunken Confessionals, then the boss. */
class Descent {
  seed = 0;
  map: GeneratedMap | null = null;
  explored = new Set<number>();
  /** Rooms whose enemies have been dealt with this descent. */
  cleared = new Set<number>();
  stage: 'map' | 'boss' = 'map';
  /** Where to put the player when returning to the map (unused for now). */

  start(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed;
    this.map = generateMap(seed);
    this.explored = new Set();
    this.cleared = new Set();
    this.stage = 'map';
    return this.map;
  }

  get active() {
    return this.map !== null;
  }

  reset() {
    this.map = null;
  }
}

export const descent = new Descent();

export const ROLE_TITLES: Record<string, string> = {
  start: 'The Chute’s Foot',
  confessional: 'A Weeping Confessional',
  votive: 'A Votive Alcove',
  cache: 'A Reliquary Cache',
  ante: 'The Antechamber of the Ear',
  elite: 'A Heavier Sin',
};
