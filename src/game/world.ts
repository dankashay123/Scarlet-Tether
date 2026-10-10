import type Phaser from 'phaser';
import type { Level } from './level';
import type { Fx } from './fx';
import type { Gore } from './gore';
import type { Player } from './player';
import type { Enemy } from './enemies';

export type HitResult = 'hit' | 'dodged' | 'perfect' | 'ignored';

export interface PlayerHit {
  damage: number;
  x: number; // source position (for knockback)
  y: number;
  choke?: boolean;
  source?: Enemy | null;
  lucidity?: number;
}

export interface Corpse {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  eaten: boolean;
}

export interface ProjectileSpec {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  key: string;
  gravity?: number;
  life?: number;
  /** Rolls along the floor instead of breaking on it (sludge waves). */
  rolls?: boolean;
  onEnd?: (x: number, y: number) => void;
}

/** What entities may ask of the scene they live in. */
export interface World {
  sc: Phaser.Scene;
  level: Level;
  fx: Fx;
  gore: Gore;
  player: Player;
  enemies: Enemy[];
  corpses: Corpse[];
  enemyTimeScale: number;
  noise(x: number, y: number, radius: number, kind: 'step' | 'combat'): void;
  hitPlayer(hit: PlayerHit): HitResult;
  addProjectile(p: ProjectileSpec): void;
  spawnTears(x: number, y: number, n: number): void;
  onEnemyKilled(e: Enemy, executed: boolean): void;
  hitstop(ms: number): void;
  slowEnemies(ms: number, scale: number): void;
  changeLucidity(delta: number, reason?: string): void;
  addSmoke(x: number, y: number, r: number, ms: number): void;
  vision(text: string): void;
  /** A blow lands at (x, y) on something breakable that isn't a foe (cherub cages). */
  strikeAt?(x: number, y: number): boolean;
}
