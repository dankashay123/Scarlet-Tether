import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { HubScene } from './scenes/HubScene';
import { RunScene } from './scenes/RunScene';
import { HudScene } from './scenes/HudScene';
import { SuccessionScene } from './scenes/SuccessionScene';
import { EndingScene } from './scenes/EndingScene';
import { GalleryScene } from './scenes/GalleryScene';
import { VIEW_H, viewWidth } from './game/config';
import { controls } from './game/controls';

(window as unknown as { __booted: boolean }).__booted = true;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // Text is real DOM text over the canvas so serif letters stay crisp (see ui/text.ts)
  dom: { createContainer: true },
  backgroundColor: '#0b0507',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  width: viewWidth(),
  height: VIEW_H,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 4,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  audio: {
    disableWebAudio: false,
  },
  // Real frame time, so a slow device drops frames instead of slowing the game.
  fps: { target: 60, smoothStep: false },
  scene: [
    BootScene,
    TitleScene,
    IntroScene,
    HubScene,
    RunScene,
    HudScene,
    SuccessionScene,
    EndingScene,
    GalleryScene,
  ],
});

// The logical size is fixed at boot; on rotation or browser-bar changes we
// only rescale the canvas to fit.
function fit() {
  game.scale.refresh();
}
window.addEventListener('resize', () => setTimeout(fit, 50));
window.addEventListener('orientationchange', () => setTimeout(fit, 250));

// Block iOS gestures that fight with the touch controls.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

(window as unknown as { game: Phaser.Game }).game = game;
// Debug hook for automated play-tests.
(window as unknown as { controls: unknown }).controls = controls;
