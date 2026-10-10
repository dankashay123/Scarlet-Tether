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

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
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
  fps: { target: 60 },
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

// Keep the logical width matched to the device's aspect ratio so wide
// iPhones see more of the room instead of black bars.
function fit() {
  const w = viewWidth();
  if (game.scale.width !== w) game.scale.setGameSize(w, VIEW_H);
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
