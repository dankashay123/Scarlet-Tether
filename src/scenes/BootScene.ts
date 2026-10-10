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

function setLoading(label: string, v: number) {
  const t = document.getElementById('loading-text');
  const b = document.getElementById('loading-fill');
  if (t && label) t.textContent = label;
  if (b) b.style.width = `${Math.round(Math.min(1, v) * 100)}%`;
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    for (const k of SFX_KEYS) this.load.audio(k, `audio/${k}.mp3`);
    // A missing sound must never block the game from starting.
    this.load.on('progress', (v: number) => setLoading('The tether frays\u2026', 0.05 + v * 0.25));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.warn('audio failed', f.key));
  }

  create() {
    // Art generation blocks the thread, so run it in stages and yield a frame
    // between each so the loading bar can paint.
    const m = meta();
    const steps: [string, () => void][] = [
      ['Carving the letters\u2026', () => buildFonts(this)],
      ['Gathering relics\u2026', () => buildProps(this)],
      ['Raising the naves\u2026', () => buildEnvironment(this)],
      ['Shaping the flesh\u2026', () => buildCreatures(this)],
      ['Gilding the frames\u2026', () => buildUi(this)],
      ['Painting the memories\u2026', () => buildVignettes(this)],
      ['Choosing a citizen\u2026', () => buildHeroSheet(this, lookFromSeed(m.citizen.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') }))],
    ];
    let i = 0;
    const next = () => {
      if (i >= steps.length) return this.finish();
      const [label, fn] = steps[i];
      setLoading(label, 0.3 + (i / steps.length) * 0.7);
      i++;
      setTimeout(() => {
        fn();
        next();
      }, 16);
    };
    next();
  }

  private finish() {
    setLoading('', 1);
    const el = document.getElementById('loading');
    if (el) {
      el.classList.add('done');
      setTimeout(() => el.remove(), 700);
    }
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
