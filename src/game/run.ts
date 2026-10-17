import type { GeneratedMap } from './mapgen';
import { buildWorld } from './worldmap';
import { meta } from './state';

/** The persistent world of the Sunken Confessionals (handmade), then the boss stage. */
class Descent {
  seed = 0;
  map: GeneratedMap | null = null;
  explored = new Set<number>();
  /** Rooms whose enemies have been dealt with this descent. */
  cleared = new Set<number>();
  stage: 'map' | 'boss' = 'map';
  /** Where to put the player when returning to the map (unused for now). */

  start(seed = 7) {
    this.seed = seed;
    this.map = buildWorld().map;
    // Exploration persists in the save
    this.explored = new Set(meta().world.explored);
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
