import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { INTRO_SCRIPT } from '../game/lore';
import { meta, save } from '../game/state';
import { sfx } from '../game/audio';
import { hud } from './HudScene';

/** The tether snaps; the citizen falls. */
export class IntroScene extends Phaser.Scene {
  private i = 0;
  private ready = false;
  private text!: Phaser.GameObjects.BitmapText;
  private art!: Phaser.GameObjects.Image;
  private tether!: Phaser.GameObjects.Graphics;
  private stage = '';
  private done = false;

  constructor() {
    super('Intro');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.i = 0;
    this.done = false;
    hud(this).setControlsVisible(false);
    this.art = this.add.image(W / 2, 0, 'sanctum').setOrigin(0.5, 0);
    this.art.setScale(Math.max(W / this.art.width, H / this.art.height));
    this.tether = this.add.graphics();
    this.text = this.add
      .bitmapText(W / 2, H - 46, FONT_OUTLINE, '')
      .setOrigin(0.5)
      .setMaxWidth(W - 80)
      .setCenterAlign()
      .setTint(hexNum(P.bone0));
    this.add.bitmapText(W - 8, H - 8, FONT_OUTLINE, 'skip').setOrigin(1).setTint(hexNum(P.marble4)).setInteractive().on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.finish();
    });
    this.cameras.main.fadeIn(1200, 11, 5, 7);
    this.input.on('pointerdown', () => this.next());
    this.input.keyboard?.on('keydown', () => this.next());
    this.show();
  }

  private show() {
    const line = INTRO_SCRIPT[this.i];
    this.ready = false;
    this.text.setText(line.t).setAlpha(0);
    this.tweens.add({ targets: this.text, alpha: 1, duration: 800, onComplete: () => (this.ready = true) });
    if (line.s !== this.stage) {
      this.stage = line.s;
      if (line.s === 'snap') this.snap();
      if (line.s === 'fall') this.fall();
    }
  }

  private snap() {
    const W = this.scale.width;
    const H = this.scale.height;
    // One tether, from one smiling window, straight down; then it breaks.
    const x = Math.round(W * 0.46);
    const g = this.tether;
    g.clear().fillStyle(hexNum(P.blood1), 1).fillRect(x, H * 0.42, 1, H * 0.6);
    this.tweens.add({ targets: this.art, scale: this.art.scale * 1.15, duration: 1800, ease: 'Cubic.Out' });
    this.time.delayedCall(900, () => {
      sfx(this, 'execute');
      sfx(this, 'boss_roar', { volume: 0.4, rate: 1.4 });
      this.cameras.main.flash(250, 200, 20, 30);
      this.cameras.main.shake(500, 0.012);
      g.clear()
        .fillStyle(hexNum(P.blood1), 1)
        .fillRect(x, H * 0.42, 1, H * 0.18)
        .fillRect(x + 2, H * 0.7, 1, H * 0.3);
      for (let k = 0; k < 40; k++) g.fillStyle(hexNum(P.blood0), 1).fillRect(x + Phaser.Math.Between(-20, 20), H * 0.6 + Phaser.Math.Between(-10, 30), 1, 1);
    });
  }

  private fall() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.tether.clear();
    this.tweens.add({ targets: this.art, y: -this.art.displayHeight, duration: 2600, ease: 'Quad.In' });
    const body = this.add.sprite(W / 2, -20, 'player').play('player:fall').setScale(2).setAngle(160);
    this.tweens.add({ targets: body, y: H * 0.45, duration: 2200, ease: 'Quad.In' });
    const streaks = this.add.graphics();
    this.time.addEvent({
      delay: 40,
      repeat: 60,
      callback: () => {
        streaks.clear();
        for (let k = 0; k < 18; k++) streaks.fillStyle(hexNum(k % 3 ? P.shadow2 : P.blood3), 1).fillRect(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 1, Phaser.Math.Between(8, 30));
      },
    });
    sfx(this, 'whisper', { volume: 0.8, rate: 0.6 });
  }

  private next() {
    if (!this.ready || this.done) return;
    this.i++;
    if (this.i >= INTRO_SCRIPT.length) this.finish();
    else this.show();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const m = meta();
    m.seenIntro = true;
    save();
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.time.delayedCall(720, () => {
      hud(this).setControlsVisible(true);
      this.scene.start('Hub', { arrival: 'chute' });
    });
  }
}
