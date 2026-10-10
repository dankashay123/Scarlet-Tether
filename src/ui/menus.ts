import type Phaser from 'phaser';
import { hud } from '../scenes/HudScene';
import { currentRun, meta, save } from '../game/state';
import { SACRAMENTS } from '../game/lore';
import { refreshLoopVolumes } from '../game/audio';

/** The pause book: settings, and (in a descent) abandoning it. */
export async function pauseMenu(scene: Phaser.Scene, inRun: boolean): Promise<void> {
  const h = hud(scene);
  scene.scene.pause();
  for (;;) {
    const s = meta().settings;
    const sac = inRun
      ? currentRun()
          .sacraments.map((id) => SACRAMENTS.find((x) => x.id === id)!)
          .map((x) => `${x.name}: ${x.boon} ${x.toll}`)
          .join('\n')
      : '';
    const i = await h.menu({
      title: 'The Book of Skin',
      body: inRun ? (sac ? `Sacraments carried:\n${sac}` : 'No Sacraments carried yet.') : undefined,
      width: inRun ? 440 : 300,
      options: [
        { label: 'Return to the dark' },
        { label: `Sounds: ${s.sfx > 0 ? 'on' : 'off'}` },
        { label: `Music: ${s.music > 0 ? 'on' : 'off'}` },
        { label: `Screen shake: ${s.shake ? 'on' : 'off'}` },
        { label: `Controls: ${s.leftHanded ? 'left-handed (stick right)' : 'right-handed (stick left)'}` },
        { label: `Button size: ${s.bigButtons ? 'large' : 'normal'}` },
        ...(inRun ? [{ label: 'Abandon this descent', desc: 'Climb back to the Drain. Half thy carried Tears are lost.' }] : []),
      ],
    });
    if (i === 1) s.sfx = s.sfx > 0 ? 0 : 1;
    else if (i === 2) {
      s.music = s.music > 0 ? 0 : 1;
    } else if (i === 3) s.shake = !s.shake;
    else if (i === 4) {
      s.leftHanded = !s.leftHanded;
      h.layout();
    } else if (i === 5) {
      s.bigButtons = !s.bigButtons;
      h.layout();
    } else if (i === 6 && inRun) {
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
