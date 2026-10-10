import Phaser from 'phaser';
import { FONT, FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { registerImage } from '../art/pixel';
import { drawSaint } from '../art/environment/props';
import { meta, wipeSave } from '../game/state';
import { loop, sfx } from '../game/audio';
import { DEPTH } from '../game/config';
import { Level } from '../game/level';
import { Backdrop } from '../game/backdrop';
import { Gore } from '../game/gore';
import { hud } from './HudScene';
import { buildHeroSheet } from '../art/hero';
import { lookFromSeed } from '../art/look';

const FLOOR_ROW = 17;

/**
 * The title: a lone penitent kneels in the drowned nave before a saint who
 * weeps blood. Built from the same art as the game itself.
 */
export class TitleScene extends Phaser.Scene {
  private started = false;
  private backdrop!: Backdrop;
  private gore!: Gore;
  private drift = 0;

  constructor() {
    super('Title');
  }

  create() {
    this.started = false;
    this.drift = 0;
    const W = this.scale.width;
    const H = this.scale.height;
    if (!this.scene.isActive('Hud')) this.scene.launch('Hud');
    this.scene.bringToTop('Hud');
    hud(this).setControlsVisible?.(false);
    this.cameras.main.setBackgroundColor('#0b0507');

    // --- The nave ------------------------------------------------------------
    this.backdrop = new Backdrop(this, 'marble');
    const cols = Math.ceil(W / 16) + 5;
    const rows: string[] = [];
    for (let y = 0; y < FLOOR_ROW; y++) rows.push('.'.repeat(cols));
    rows.push('#'.repeat(cols));
    const level = new Level(this, { name: 'title', kind: 'hub', rows }, 'marble');
    this.gore = new Gore(this, level);
    const floorY = FLOOR_ROW * 16;
    const cx = W / 2 + 18; // the camera breathes around x = 18

    // A great saint, rendered at double detail, weeping into a pool
    if (!this.textures.exists('prop-saint-big')) registerImage(this, 'prop-saint-big', drawSaint(false, 2));
    const saintX = cx + Math.min(150, W * 0.24);
    this.add.image(saintX, floorY, 'prop-saint-big').setOrigin(0.5, 1).setDepth(DEPTH.props);
    this.gore.pool(saintX, floorY, 3);
    for (let i = 0; i < 14; i++) this.gore.splat(saintX + (Math.random() - 0.5) * 120, floorY - 1, 0.5 + Math.random() * 0.7, i % 2 ? P.blood2 : P.blood3);
    // Tears of blood run down from her eyes, endlessly
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.gore.spray(saintX + side * 7, floorY - 158, Math.PI / 2, 1, 0.15, 0.2);
      },
    });

    // Confessional booths, candles and cages framing the scene
    this.add.image(cx - Math.min(210, W * 0.36), floorY, 'prop-booth').setOrigin(0.5, 1).setDepth(DEPTH.props);
    this.add.image(cx + Math.min(290, W * 0.46), floorY, 'prop-booth').setOrigin(0.5, 1).setDepth(DEPTH.props).setFlipX(true);
    for (const dx of [-120, -40, 70, 230]) this.add.sprite(cx + dx, floorY, 'candelabra').setOrigin(0.5, 1).play('candelabra:flicker').setDepth(DEPTH.props + 1);
    for (const [dx, y] of [[-170, 0], [40, -20], [210, -10]] as const) {
      const cage = this.add.image(cx + dx, y, 'prop-cage').setOrigin(0.5, 0).setDepth(DEPTH.props - 1);
      this.tweens.add({ targets: cage, angle: { from: -2, to: 2 }, duration: 3000 + Math.random() * 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // Hanging chains swaying in a draught that should not exist down here
    for (const dx of [-260, -90, 120, 300]) {
      const len = 6 + Math.floor(Math.random() * 6);
      const c = this.add.container(cx + dx, 0).setDepth(DEPTH.props - 2);
      for (let i = 0; i < len; i++) c.add(this.add.image(0, i * 16, 'hang-chain').setOrigin(0.5, 0));
      this.tweens.add({ targets: c, angle: { from: -1.5, to: 1.5 }, duration: 2600 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // The penitent, kneeling in a shaft of false daylight
    const heroX = cx - 40;
    const shaft = this.add.image(heroX, 0, 'prop-grate-light').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.light).setAlpha(0.6);
    shaft.setScale(1.3, (floorY + 10) / shaft.height);
    this.tweens.add({ targets: shaft, alpha: 0.35, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.add.sprite(heroX, floorY, 'player').setOrigin(0.5, 90 / 96).play('player:kneel').setDepth(DEPTH.player);
    this.gore.pool(heroX, floorY, 1.2);
    const glow = (x: number, y: number, r: string, a: number) => this.add.image(x, y, r).setBlendMode(Phaser.BlendModes.ADD).setTint(hexNum('#ffb050')).setAlpha(a).setDepth(DEPTH.light);
    for (const dx of [-120, -40, 70, 230]) {
      const l = glow(cx + dx, floorY - 44, 'light-lg', 0.35);
      this.tweens.add({ targets: l, alpha: 0.22, duration: 160 + Math.random() * 200, yoyo: true, repeat: -1 });
    }

    // Drifting embers and motes of blood
    for (let i = 0; i < 40; i++) {
      const mote = this.add
        .image(Math.random() * W, Math.random() * floorY, i % 3 ? 'px1' : 'px')
        .setTint(hexNum(i % 4 ? '#e8b060' : P.blood1))
        .setAlpha(0.2 + Math.random() * 0.5)
        .setDepth(DEPTH.fx);
      this.tweens.add({
        targets: mote,
        y: mote.y - 40 - Math.random() * 60,
        x: mote.x + (Math.random() - 0.5) * 40,
        alpha: 0,
        duration: 4000 + Math.random() * 5000,
        repeat: -1,
        delay: Math.random() * 4000,
      });
    }

    // Lens: crush the edges into the dark
    if (this.cameras.main.postFX) {
      this.cameras.main.postFX.addVignette(0.5, 0.45, 0.85, 0.35);
    }

    // --- The title -------------------------------------------------------------
    const ty = Math.round(H * 0.17);
    const ux = W / 2; // screen-space centre for the UI
    const frame = this.add.graphics().setDepth(DEPTH.overlay).setScrollFactor(0);
    const fw = 250;
    const gold = hexNum('#c9a45c');
    const dark = hexNum('#5a4020');
    frame.fillStyle(0x0b0507, 0.55).fillRect(ux - fw / 2, ty - 26, fw, 74);
    frame.lineStyle(1, dark, 1).strokeRect(ux - fw / 2 - 2, ty - 28, fw + 4, 78);
    frame.lineStyle(1, gold, 1).strokeRect(ux - fw / 2, ty - 26, fw, 74);
    // Corner flourishes and a crowning cross
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = ux + (sx * fw) / 2;
      const y = sy < 0 ? ty - 26 : ty + 48;
      frame.fillStyle(gold, 1).fillRect(x - 2, y - 2, 5, 5);
      frame.fillStyle(hexNum(P.blood1), 1).fillRect(x - 1, y - 1, 3, 3);
    }
    frame.fillStyle(gold, 1).fillRect(ux - 1, ty - 40, 3, 14).fillRect(ux - 5, ty - 36, 11, 3);
    frame.fillStyle(gold, 1).fillRect(ux - 70, ty + 7, 140, 1);
    const title1 = this.add.bitmapText(ux, ty - 8, FONT_OUTLINE, 'THE SCARLET').setOrigin(0.5).setScale(2).setTint(hexNum(P.bone0)).setDepth(DEPTH.overlay + 1).setScrollFactor(0);
    const title2 = this.add.bitmapText(ux, ty + 30, FONT_OUTLINE, 'TETHER').setOrigin(0.5).setScale(3).setTint(hexNum(P.blood1)).setDepth(DEPTH.overlay + 1).setScrollFactor(0);
    for (const o of [frame, title1, title2]) o.setAlpha(0);
    this.tweens.add({ targets: [frame, title1, title2], alpha: 1, duration: 1800, delay: 400 });
    // Blood seeps from the title, now and then
    this.time.addEvent({ delay: 700, loop: true, callback: () => this.gore.spray(cx - 40 + Math.random() * 80, ty + 44, Math.PI / 2, 1, 0.1, 0.2) });

    const m = meta();
    if (new URLSearchParams(location.search).has('splash')) return; // capture mode for the loading splash
    const label = m.seenIntro ? `touch to descend as ${m.citizen.name}` : 'touch to begin';
    const hint = this.add.bitmapText(ux, H - 40, FONT_OUTLINE, label).setOrigin(0.5).setTint(hexNum(P.bone1)).setDepth(DEPTH.overlay + 1).setScrollFactor(0);
    this.tweens.add({ targets: hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });
    const standalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      this.add.bitmapText(ux, H - 20, FONT, 'For fullscreen: Share > Add to Home Screen').setOrigin(0.5).setTint(hexNum(P.marble3)).setDepth(DEPTH.overlay + 1).setScrollFactor(0);
    }
    if (m.seenIntro) {
      const wipe = this.add.bitmapText(W - 10, 10, FONT, 'forget everything').setOrigin(1, 0).setTint(hexNum(P.marble4)).setDepth(DEPTH.overlay + 1).setScrollFactor(0).setInteractive({ useHandCursor: true });
      wipe.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.started = true;
        hud(this)
          .menu({ title: 'Forget everything?', body: 'Every life, Stigma and upgrade will be lost. The Lineage will be burned.', options: [{ label: 'Burn it' }], cancel: 'Keep it' })
          .then((i) => {
            if (i === 0) {
              wipeSave();
              const n = meta();
              buildHeroSheet(this, lookFromSeed(n.citizen.seed, { maw: false, helix: false }));
              this.scene.restart();
            } else this.started = false;
          });
      });
    }

    this.input.on('pointerdown', () => this.begin());
    this.input.keyboard?.on('keydown', () => this.begin());
    this.events.once('shutdown', () => this.gore.destroy());
  }

  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.gore.update(dt);
    // A slow, breathing drift through the nave's parallax
    this.drift += dt;
    const cam = this.cameras.main;
    cam.scrollX = 18 + Math.sin(this.drift * 0.12) * 18;
    this.backdrop.update();
  }

  private begin() {
    if (this.started || hud(this).modal) return;
    this.started = true;
    // The first touch unlocks audio on iOS.
    sfx(this, 'bell_distant', { volume: 0.8 });
    loop(this, 'amb_hub', 'amb', 0.6);
    this.cameras.main.fadeOut(900, 11, 5, 7);
    this.time.delayedCall(950, () => {
      hud(this).setControlsVisible(true);
      if (!meta().seenIntro) this.scene.start('Intro');
      else this.scene.start('Hub', { arrival: 'chute' });
    });
  }
}
