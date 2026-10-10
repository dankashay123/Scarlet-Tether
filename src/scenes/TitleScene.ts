import Phaser from 'phaser';
import { FONT, FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { meta, wipeSave } from '../game/state';
import { loop, sfx } from '../game/audio';
import { hud } from './HudScene';
import { buildHeroSheet } from '../art/hero';
import { lookFromSeed } from '../art/look';

export class TitleScene extends Phaser.Scene {
  private started = false;

  constructor() {
    super('Title');
  }

  create() {
    this.started = false;
    const W = this.scale.width;
    const H = this.scale.height;
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    hud(this).setControlsVisible?.(false);

    const art = this.add.image(W / 2, 0, 'sanctum').setOrigin(0.5, 0);
    art.setScale(Math.max(W / art.width, H / art.height) * 1.0001);
    this.tweens.add({ targets: art, y: -12, duration: 14000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const title1 = this.add.bitmapText(W / 2, H * 0.6, FONT_OUTLINE, 'THE SCARLET').setOrigin(0.5).setScale(3).setTint(hexNum(P.bone0));
    const title2 = this.add.bitmapText(W / 2, H * 0.6 + 30, FONT_OUTLINE, 'TETHER').setOrigin(0.5).setScale(4).setTint(hexNum(P.blood1));
    title1.setAlpha(0);
    title2.setAlpha(0);
    this.tweens.add({ targets: [title1, title2], alpha: 1, duration: 1600, delay: 300 });

    const m = meta();
    const label = m.seenIntro ? `touch to descend as ${m.citizen.name}` : 'touch to begin';
    const hint = this.add.bitmapText(W / 2, H - 34, FONT_OUTLINE, label).setOrigin(0.5).setTint(hexNum(P.bone1));
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    const standalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      this.add.bitmapText(W / 2, H - 16, FONT, 'For fullscreen: Share > Add to Home Screen').setOrigin(0.5).setTint(hexNum(P.marble3));
    }
    if (m.seenIntro) {
      const wipe = this.add.bitmapText(W - 10, 10, FONT, 'forget everything').setOrigin(1, 0).setTint(hexNum(P.marble4)).setInteractive({ useHandCursor: true });
      wipe.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.started = true;
        hud(this)
          .menu({ title: 'Forget everything?', body: 'Every life, Stigma and upgrade will be lost. The Lineage will be burned.', options: [{ label: 'Burn it' }], cancel: 'Keep it' })
          .then((i) => {
            if (i === 0) {
              wipeSave();
              const n = meta();
              buildHeroSheet(this, lookFromSeed(n.citizen.seed, { maw: false, helix: false }));
              this.scene.restart();
            } else this.started = false;
          });
      });
    }

    this.input.on('pointerdown', () => this.begin());
    this.input.keyboard?.on('keydown', () => this.begin());
  }

  private begin() {
    if (this.started || hud(this).modal) return;
    this.started = true;
    // The first touch unlocks audio on iOS.
    sfx(this, 'bell_distant', { volume: 0.8 });
    loop(this, 'amb_hub', 'amb', 0.6);
    this.cameras.main.fadeOut(900, 11, 5, 7);
    this.time.delayedCall(950, () => {
      hud(this).setControlsVisible(true);
      if (!meta().seenIntro) this.scene.start('Intro');
      else this.scene.start('Hub', { arrival: 'chute' });
    });
  }
}
