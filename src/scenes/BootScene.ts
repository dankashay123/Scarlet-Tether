import Phaser from 'phaser';
import { buildFonts } from '../art/font';
import { buildTilesets } from '../art/tiles';
import {
  buildBlindSheet,
  buildGossipSheet,
  buildNpcSheets,
  buildPenitentSheet,
  buildPlayerSheet,
  lookFromSeed,
} from '../art/characters';
import { buildProps } from '../art/props';
import { buildUi } from '../art/ui';
import { buildBossSheet } from '../art/boss';
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
    document.getElementById('loading')?.remove();
    buildFonts(this);
    buildTilesets(this);
    buildBlindSheet(this);
    buildGossipSheet(this);
    buildPenitentSheet(this);
    buildNpcSheets(this);
    buildProps(this);
    buildUi(this);
    buildBossSheet(this);
    buildVignettes(this);
    const m = meta();
    buildPlayerSheet(this, lookFromSeed(m.citizen.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') }));

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
