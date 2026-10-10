import Phaser from 'phaser';
import { buildFonts } from '../art/font';
import { buildHeroSheet } from '../art/hero';
import { lookFromSeed } from '../art/look';
import { buildCreatures } from '../art/creatures';
import { buildEnvironment } from '../art/environment';
import { buildProps } from '../art/props';
import { buildUi } from '../art/ui';
import { buildVignettes } from '../art/vignettes';
import { SFX_KEYS } from '../game/audio';
import { meta } from '../game/state';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const k of SFX_KEYS) this.load.audio(k, `audio/${k}.mp3`);
    // A missing sound must never block the game from starting.
    const label = document.getElementById('loading');
    this.load.on('progress', (v: number) => {
      if (label) label.textContent = `The tether frays\u2026 ${Math.round(v * 100)}%`;
    });
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('audio failed', f.key));
  }

  create() {
    const label = document.getElementById('loading');
    if (label) label.textContent = 'Shaping the flesh\u2026';
    // Yield one frame so the label paints before the (blocking) art generation.
    this.time.delayedCall(30, () => this.generate());
  }

  private generate() {
    buildFonts(this);
    buildProps(this);
    buildEnvironment(this);
    buildCreatures(this);
    buildUi(this);
    buildVignettes(this);
    const m = meta();
    buildHeroSheet(this, lookFromSeed(m.citizen.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') }));

    document.getElementById('loading')?.remove();
    // The HUD runs above every scene; start it first so it is ready.
    this.scene.launch('Hud');
    const params = new URLSearchParams(location.search);
    if (params.has('gallery')) this.scene.start('Gallery');
    else if (params.has('run')) this.scene.start('Run', { debug: true });
    else if (params.has('boss')) this.scene.start('Run', { debug: true, boss: true });
    else if (params.has('hub')) this.scene.start('Hub');
    else this.scene.start('Title');
  }
}
