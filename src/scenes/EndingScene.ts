import Phaser from 'phaser';
import { FONT, FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { SLICE_ENDING } from '../game/lore';
import { meta } from '../game/state';
import { sfx } from '../game/audio';
import { hud } from './HudScene';

/** The end of the Sunken Confessionals (and of this vertical slice). */
export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  async create() {
    const W = this.scale.width;
    const H = this.scale.height;
    hud(this).setControlsVisible(false);
    const art = this.add.image(W / 2, H / 2, 'sanctum').setAlpha(0.35);
    art.setScale(Math.max(W / art.width, H / art.height));
    sfx(this, 'bell_distant', { volume: 0.8, rate: 0.85 });
    await hud(this).vision(SLICE_ENDING, P.bone0);
    const m = meta();
    this.add.bitmapText(W / 2, H * 0.4, FONT_OUTLINE, 'THE SUNKEN CONFESSIONALS').setOrigin(0.5).setScale(2).setTint(hexNum(P.gold1));
    this.add.bitmapText(W / 2, H * 0.4 + 22, FONT_OUTLINE, 'are silenced.').setOrigin(0.5).setTint(hexNum(P.bone1));
    this.add
      .bitmapText(W / 2, H * 0.62, FONT, `${m.citizen.name} absolved Bartholomew. Lives spent: ${m.deaths + 1}.`)
      .setOrigin(0.5)
      .setTint(hexNum(P.bone2));
    this.add
      .bitmapText(W / 2, H * 0.62 + 14, FONT, 'End of the vertical slice. The Crimson Chancel is yet to be built.')
      .setOrigin(0.5)
      .setTint(hexNum(P.marble3));
    const hint = this.add.bitmapText(W / 2, H - 20, FONT_OUTLINE, 'touch to return to the Drain').setOrigin(0.5).setTint(hexNum(P.bone1));
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    this.time.delayedCall(800, () =>
      this.input.once('pointerdown', () => {
        this.cameras.main.fadeOut(600);
        this.time.delayedCall(620, () => {
          hud(this).setControlsVisible(true);
          this.scene.start('Hub', { arrival: 'door' });
        });
      }),
    );
  }
}
