import Phaser from 'phaser';
import { DEPTH } from './config';

const LAYERS: { name: 'far' | 'mid' | 'near'; factor: number; depth: number }[] = [
  { name: 'far', factor: 0.1, depth: DEPTH.bgFar },
  { name: 'mid', factor: 0.35, depth: DEPTH.bgMid },
  { name: 'near', factor: 0.65, depth: DEPTH.bgNear },
];

/**
 * Parallax cathedral behind the play layer, plus a dark foreground frame.
 * In the biome, every layer has a marble and a rot twin that crossfade
 * with Lucidity.
 */
export class Backdrop {
  private layers: { lie: Phaser.GameObjects.TileSprite; truth: Phaser.GameObjects.TileSprite | null; factor: number }[] = [];
  private fg: { lie: Phaser.GameObjects.TileSprite; truth: Phaser.GameObjects.TileSprite | null } | null = null;

  constructor(
    private scene: Phaser.Scene,
    set: 'marble' | 'cistern',
  ) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const mk = (key: string, depth: number) => (scene.textures.exists(key) ? scene.add.tileSprite(0, 0, W, H, key).setOrigin(0).setScrollFactor(0).setDepth(depth) : null);
    for (const l of LAYERS) {
      const lie = mk(`bg-${set}-${l.name}`, l.depth);
      if (!lie) continue;
      const truth = set === 'marble' ? mk(`bg-rot-${l.name}`, l.depth + 1) : null;
      truth?.setAlpha(0);
      this.layers.push({ lie, truth, factor: l.factor });
    }
    const fgLie = mk(`fg-${set}`, DEPTH.fg);
    if (fgLie) {
      const fgTruth = set === 'marble' ? mk('fg-rot', DEPTH.fg + 1) : null;
      fgTruth?.setAlpha(0);
      this.fg = { lie: fgLie, truth: fgTruth };
    }
  }

  update() {
    const cam = this.scene.cameras.main;
    for (const l of this.layers) {
      l.lie.tilePositionX = cam.scrollX * l.factor;
      if (l.truth) l.truth.tilePositionX = l.lie.tilePositionX;
    }
    if (this.fg) {
      this.fg.lie.tilePositionX = cam.scrollX * 1.3;
      if (this.fg.truth) this.fg.truth.tilePositionX = this.fg.lie.tilePositionX;
    }
  }

  setRot(rot: number) {
    for (const l of this.layers) l.truth?.setAlpha(rot);
    this.fg?.truth?.setAlpha(rot);
  }

  destroy() {
    for (const l of this.layers) {
      l.lie.destroy();
      l.truth?.destroy();
    }
    this.fg?.lie.destroy();
    this.fg?.truth?.destroy();
  }
}
