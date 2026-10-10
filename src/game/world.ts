import type Phaser from 'phaser';
import type { Room } from './room';
import type { Fx } from './fx';
import type { Player } from './player';
import type { Enemy } from './enemies';

export type HitResult = 'hit' | 'dodged' | 'perfect' | 'ignored';

export interface PlayerHit {
  damage: number;
  x: number; // source position (for knockback)
  y: number;
  choke?: boolean;
  source?: Enemy | null;
  lucidity?: number; // extra Lucidity drained on hit
}

export interface Corpse {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  eaten: boolean;
}

/** What entities may ask of the scene they live in. */
export interface World {
  sc: Phaser.Scene;
  room: Room;
  fx: Fx;
  player: Player;
  enemies: Enemy[];
  corpses: Corpse[];
  enemyTimeScale: number;
  noise(x: number, y: number, radius: number, kind: 'step' | 'combat'): void;
  hitPlayer(hit: PlayerHit): HitResult;
  addProjectile(p: { x: number; y: number; vx: number; vy: number; r: number; damage: number; key: string; life?: number; onEnd?: (x: number, y: number) => void }): void;
  spawnTears(x: number, y: number, n: number): void;
  onEnemyKilled(e: Enemy, executed: boolean): void;
  hitstop(ms: number): void;
  slowEnemies(ms: number, scale: number): void;
  changeLucidity(delta: number, reason?: string): void;
  addSmoke(x: number, y: number, r: number, ms: number): void;
  vision(text: string): void;
}
