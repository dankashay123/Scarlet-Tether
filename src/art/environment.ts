import { registerImage } from './pixel';
import { SheetBuilder } from './sheet';
import { ET, TILE, drawTileset, type EnvSet } from './environment/tilesets';
import { drawBackdrops } from './environment/backdrops';
import {
  drawBooth,
  drawCache,
  drawCage,
  drawCandelabra,
  drawCenser,
  drawDoorFrames,
  drawEmblem,
  drawLectern,
  drawLightShaft,
  drawSaint,
  drawVotive,
} from './environment/props';
import { buildDressing } from './environment/dressing';
import { drawCrypt } from './environment/crypt';
import { drawBridge } from './environment/bridge';

/**
 * Side-view environment art for the Under-Naves: autotiled tilesets,
 * parallax backdrops and props, all generated in code.
 *
 * Tilesets 'env-marble' | 'env-rot' | 'env-cistern' are single-row strips of
 * ET.COUNT 16x16 tiles. Indices 0..15 are solids autotiled by neighbour mask
 * (1 = N, 2 = E, 4 = S, 8 = W), then ET.* specials. The marble and rot sets
 * share silhouettes so the game can crossfade between them.
 *
 * Backdrops per set S: 'bg-S-far' (~0.1), 'bg-S-mid' (~0.35), 'bg-S-near'
 * (~0.65), 'fg-S' (~1.3); each 512x224 and horizontally tileable.
 */
export { ET, TILE };
export type { EnvSet };

export const ENV_SETS: EnvSet[] = ['marble', 'rot', 'cistern'];

export function buildEnvironment(scene: Phaser.Scene) {
  for (const s of ENV_SETS) {
    const key = `env-${s}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, drawTileset(s).toCanvas());
    const bd = drawBackdrops(s);
    registerImage(scene, `bg-${s}-far`, bd.far);
    registerImage(scene, `bg-${s}-mid`, bd.mid);
    registerImage(scene, `bg-${s}-near`, bd.near);
    registerImage(scene, `fg-${s}`, bd.fg);
  }

  registerImage(scene, 'prop-booth', drawBooth(false, false));
  registerImage(scene, 'prop-booth-rot', drawBooth(true, false));
  registerImage(scene, 'prop-booth-open', drawBooth(false, true));
  new SheetBuilder('candelabra').add('flicker', [0, 1, 2].map((f) => drawCandelabra(f)), 7, -1).build(scene);
  registerImage(scene, 'prop-saint', drawSaint(false));
  registerImage(scene, 'prop-saint-rot', drawSaint(true));
  registerImage(scene, 'prop-cage', drawCage());
  const door = drawDoorFrames();
  new SheetBuilder('door').add('closed', [door[0]], 1, 0).add('open', door.slice(1), 10, 0).build(scene);
  registerImage(scene, 'prop-votive', drawVotive(false));
  registerImage(scene, 'prop-votive-spent', drawVotive(true));
  registerImage(scene, 'prop-cache', drawCache(false));
  registerImage(scene, 'prop-cache-open', drawCache(true));
  registerImage(scene, 'prop-censer', drawCenser());
  registerImage(scene, 'prop-lectern', drawLectern());
  registerImage(scene, 'prop-grate-light', drawLightShaft());
  for (const k of ['combat', 'elite', 'confessional', 'votive', 'cache', 'boss']) registerImage(scene, `emblem-${k}`, drawEmblem(k));
  // Area themes: the crypt below the naves, and the bridge outside under Sanctum
  for (const [name, draw] of [['crypt', drawCrypt], ['bridge', drawBridge]] as const) {
    const { plain, rot } = draw();
    for (const l of ['far', 'mid', 'near'] as const) {
      registerImage(scene, `bg-${name}-${l}`, plain[l]);
      registerImage(scene, `bg-${name}-rot-${l}`, rot[l]);
    }
    registerImage(scene, `fg-${name}`, plain.fg);
    registerImage(scene, `fg-${name}-rot`, rot.fg);
  }
  buildDressing(scene);
}
