import type Phaser from 'phaser';
import { hud } from '../scenes/HudScene';
import { meta, save } from '../game/state';
import { refreshLoopVolumes } from '../game/audio';

/** The pause book: settings, and (in a descent) abandoning it. */
export async function pauseMenu(scene: Phaser.Scene, inRun: boolean): Promise<void> {
  const h = hud(scene);
  scene.scene.pause();
  for (;;) {
    const s = meta().settings;
    const i = await h.menu({
      title: 'The Book of Skin',
      options: [
        { label: 'Return to the dark' },
        { label: `Sounds: ${s.sfx > 0 ? 'on' : 'off'}` },
        { label: `Music: ${s.music > 0 ? 'on' : 'off'}` },
        { label: `Screen shake: ${s.shake ? 'on' : 'off'}` },
        ...(inRun ? [{ label: 'Abandon this descent', desc: 'Climb back to the Drain. Half thy carried Tears are lost.' }] : []),
      ],
      width: 300,
    });
    if (i === 1) s.sfx = s.sfx > 0 ? 0 : 1;
    else if (i === 2) {
      s.music = s.music > 0 ? 0 : 1;
    } else if (i === 3) s.shake = !s.shake;
    else if (i === 4 && inRun) {
      save();
      scene.scene.resume();
      scene.events.emit('abandon');
      return;
    } else break;
    refreshLoopVolumes();
    save();
  }
  scene.scene.resume();
}
