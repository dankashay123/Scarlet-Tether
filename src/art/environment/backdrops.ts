import type { PixelCanvas } from '../pixel';
import { drawCistern } from './cistern';
import { drawNave } from './nave';

/**
 * Parallax backdrops. Every layer is 512x224 (the SNES screen height) and wraps horizontally.
 *
 * The biome ('marble' = the lie, 'rot' = the truth) is an Andalusian nave of
 * muqarnas arches (nave.ts); the hub is the brick cistern (cistern.ts). Both
 * are relief-rendered (relief.ts) so they share the characters' lighting.
 */
export type BackdropSet = 'marble' | 'rot' | 'cistern';

export function drawBackdrops(set: BackdropSet): { far: PixelCanvas; mid: PixelCanvas; near: PixelCanvas; fg: PixelCanvas } {
  if (set === 'cistern') return drawCistern();
  return drawNave(set);
}
