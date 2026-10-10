import Phaser from 'phaser';
import { FONT, FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { buildHeroSheet } from '../art/hero';
import { lookFromSeed } from '../art/look';
import { buildPortraits } from '../art/vignettes';
import { currentRun, meta, save, startingLucidity } from '../game/state';
import { makeCitizen } from '../game/citizens';
import { SUCCESSION_LINES, STIGMA_TEXT } from '../game/lore';
import { sfx, stopLoop } from '../game/audio';
import { hudState } from '../game/controls';
import { hud } from './HudScene';

/** Death is a transfer of suffering: the next oblivious citizen awakens. */
export class SuccessionScene extends Phaser.Scene {
  private cause = '';

  constructor() {
    super('Succession');
  }

  init(data: { cause?: string; abandoned?: boolean }) {
    this.cause = data.cause ?? 'the dark';
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    hudState.inRun = false;
    hud(this).setControlsVisible(false);
    stopLoop(this, 'music');
    const m = meta();
    const run = currentRun();
    const old = m.citizen;

    // Settle the dead
    const banked = Math.floor(run.tears * 0.5);
    m.tears += banked;
    m.vertebrae += run.vertebrae;
    m.deaths++;
    m.bestRoom = Math.max(m.bestRoom, run.room);
    const inherited = Math.min(6, Math.floor(run.sin / 4));
    m.weightOfSin = Math.min(6, Math.max(0, Math.round((m.weightOfSin + inherited) * 0.7)));
    m.lineage.push({ name: old.name, occupation: old.occupation, fate: `fell in ${this.cause} after ${run.room} rooms` });
    const firstDeath = !m.unlocked.includes('maw');
    if (firstDeath) m.unlocked.push('maw');
    const next = makeCitizen(Math.floor(Math.random() * 1e9));
    m.citizen = next;
    save();

    const look = lookFromSeed(next.seed, { maw: m.equipped.includes('maw'), helix: m.equipped.includes('helix') });
    buildPortraits(this, look.skin, look.hair);
    buildHeroSheet(this, look);

    this.cameras.main.setBackgroundColor('#0b0507');
    const t = (y: number, s: string, c: string = P.bone0, font = FONT_OUTLINE) =>
      this.add.bitmapText(W / 2, y, font, s).setOrigin(0.5).setTint(hexNum(c)).setMaxWidth(W - 80).setCenterAlign().setAlpha(0);

    const lines: Phaser.GameObjects.BitmapText[] = [];
    lines.push(t(40, `${old.name}, ${old.occupation}, is dead.`, P.blood0));
    lines.push(t(56, `Fell in ${this.cause}. Kept ${banked} of ${run.tears} Tears and ${run.vertebrae} Vertebrae.`, P.bone2, FONT));
    lines.push(t(80, Phaser.Utils.Array.GetRandom(SUCCESSION_LINES), P.bone1));

    const art = this.add.image(W / 2, 108, 'sanctum-wide').setOrigin(0.5, 0).setAlpha(0);
    const portrait = this.add.image(W / 2, 108 + 60, 'portrait-smile').setAlpha(0);
    lines.push(t(H - 74, `Above, ${next.name}, ${next.occupation}, ${next.bliss}`, P.gold0));
    lines.push(t(H - 56, '...until now.', P.blood0));
    const sinLine = m.weightOfSin > 0 ? `Weight of Sin inherited: ${m.weightOfSin}. They begin with ${startingLucidity()} Lucidity.` : '';
    lines.push(t(H - 36, sinLine, P.lucid0, FONT));
    if (firstDeath) lines.push(t(H - 22, `The flesh remembers: ${STIGMA_TEXT.maw.name} may now be sewn by the Weaver.`, P.flesh1, FONT));

    let delay = 300;
    lines.slice(0, 3).forEach((l) => {
      this.tweens.add({ targets: l, alpha: 1, duration: 800, delay });
      delay += 900;
    });
    this.tweens.add({ targets: [art, portrait], alpha: 1, duration: 900, delay });
    delay += 1200;
    this.tweens.add({ targets: lines[3], alpha: 1, duration: 800, delay });
    delay += 1600;
    this.time.delayedCall(delay, () => {
      portrait.setTexture('portrait-weep');
      sfx(this, 'execute', { volume: 0.7 });
      this.cameras.main.flash(200, 150, 0, 20);
      this.cameras.main.shake(300, 0.01);
    });
    this.tweens.add({ targets: lines[4], alpha: 1, duration: 600, delay });
    delay += 900;
    lines.slice(5).forEach((l) => {
      this.tweens.add({ targets: l, alpha: 1, duration: 700, delay });
      delay += 500;
    });
    sfx(this, 'bell_distant', { volume: 0.6, rate: 0.7 });

    const hint = this.add.bitmapText(W - 10, H - 8, FONT, 'touch to fall').setOrigin(1).setTint(hexNum(P.marble4)).setAlpha(0);
    this.tweens.add({ targets: hint, alpha: 1, delay, duration: 500 });
    this.time.delayedCall(delay, () => {
      this.input.once('pointerdown', () => this.go());
      this.input.keyboard?.once('keydown', () => this.go());
    });
  }

  private go() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(620, () => {
      hud(this).setControlsVisible(true);
      this.scene.start('Hub', { arrival: 'chute' });
    });
  }
}
