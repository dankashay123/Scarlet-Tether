import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { DEPTH } from './config';
import { meta } from './state';

/** Smoke, sparks, floating words, rings and screen shake. Blood lives in Gore. */
export class Fx {
  constructor(private scene: Phaser.Scene) {}

  smoke(x: number, y: number, n = 3, color: string = P.smoke0) {
    for (let i = 0; i < n; i++) {
      const img = this.scene.add
        .image(x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 6, 'smoke')
        .setTint(hexNum(color))
        .setAlpha(0.7)
        .setDepth(DEPTH.fx);
      this.scene.tweens.add({
        targets: img,
        y: img.y - 14 - Math.random() * 12,
        x: img.x + (Math.random() - 0.5) * 14,
        alpha: 0,
        scale: 2,
        duration: 700 + Math.random() * 500,
        onComplete: () => img.destroy(),
      });
    }
  }

  /** Chips of stone and a puff of grit: masonry giving way. */
  rubble(x: number, y: number, n = 10) {
    const stones = ['#5a4e48', '#7a6e66', '#3a302c', '#a89a8a'];
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, Math.random() < 0.5 ? 'px' : 'clot').setTint(hexNum(stones[i % stones.length])).setDepth(DEPTH.fx);
      const dx = (Math.random() - 0.5) * 70;
      this.scene.tweens.add({ targets: img, x: img.x + dx, duration: 600 + Math.random() * 300, ease: 'Linear' });
      this.scene.tweens.add({
        targets: img,
        y: img.y + 30 + Math.random() * 40,
        angle: (Math.random() - 0.5) * 360,
        duration: 600 + Math.random() * 300,
        ease: 'Back.In',
        onComplete: () => img.destroy(),
      });
    }
    this.smoke(x, y, Math.ceil(n / 4), '#4a403a');
  }

  sparks(x: number, y: number, n: number, color: string = P.candle) {
    for (let i = 0; i < n; i++) {
      const img = this.scene.add.image(x, y, 'px1').setTint(hexNum(color)).setDepth(DEPTH.fx);
      const a = Math.random() * Math.PI * 2;
      const d = 8 + Math.random() * 18;
      this.scene.tweens.add({ targets: img, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, duration: 300 + Math.random() * 300, onComplete: () => img.destroy() });
    }
  }

  text(x: number, y: number, s: string, color: string = P.bone0, rise = 18, ms = 900) {
    const t = this.scene.add.bitmapText(x, y, FONT_OUTLINE, s).setOrigin(0.5).setTint(hexNum(color)).setDepth(DEPTH.overlay - 1);
    this.scene.tweens.add({ targets: t, y: y - rise, alpha: { from: 1, to: 0 }, duration: ms, ease: 'Cubic.Out', onComplete: () => t.destroy() });
    return t;
  }

  whisper(x: number, y: number, s: string, color: string = P.lucid0) {
    const t = this.scene.add.bitmapText(x, y, FONT_OUTLINE, s).setOrigin(0.5).setTint(hexNum(color)).setDepth(DEPTH.overlay - 1).setAlpha(0);
    this.scene.tweens.add({ targets: t, alpha: 0.85, duration: 600, yoyo: true, hold: 1600, onComplete: () => t.destroy() });
    this.scene.tweens.add({ targets: t, x: x + (Math.random() - 0.5) * 30, y: y - 12, duration: 2800 });
  }

  shake(ms = 120, intensity = 0.006) {
    if (!meta().settings.shake) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  ring(x: number, y: number, radius: number, color: string, ms = 300) {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx);
    const o = { r: 4, a: 1 };
    this.scene.tweens.add({
      targets: o,
      r: radius,
      a: 0,
      duration: ms,
      onUpdate: () => {
        g.clear();
        g.lineStyle(2, hexNum(color), o.a);
        g.strokeCircle(x, y, o.r);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** A brief streak of light along a swing, for weight. */
  swoosh(x: number, y: number, r: number, a0: number, a1: number, color: string = P.bone0) {
    const g = this.scene.add.graphics().setDepth(DEPTH.fx);
    const o = { a: 0.55 };
    const draw = () => {
      g.clear();
      g.lineStyle(3, hexNum(color), o.a);
      g.beginPath();
      g.arc(x, y, r, Math.min(a0, a1), Math.max(a0, a1));
      g.strokePath();
    };
    draw();
    this.scene.tweens.add({ targets: o, a: 0, duration: 180, onUpdate: draw, onComplete: () => g.destroy() });
  }

  update(_dt: number) {}

  destroy() {}
}
