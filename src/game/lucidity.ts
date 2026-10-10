import Phaser from 'phaser';
import { P, hexNum } from '../art/palette';
import { PixelCanvas, bayer, registerImage } from '../art/pixel';
import { DEPTH } from './config';
import { controls } from './controls';
import { loopVolume, sfx } from './audio';
import { currentRun, hasSacrament } from './state';
import { DREAD_WHISPERS } from './lore';
import type { World } from './world';

/** Rot level from Lucidity: 0 above 75, 1 near zero. */
export function rotLevel(lucidity: number) {
  return Phaser.Math.Clamp((75 - lucidity) / 65, 0, 1);
}

function ensureVisionTexture(scene: Phaser.Scene) {
  if (scene.textures.exists('vision-hole')) return;
  // Dithered darkness with a soft hole, drawn at quarter resolution and
  // scaled 4x so the dithering reads as chunky pixel art.
  const w = 260;
  const h = 150;
  const pc = new PixelCanvas(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2, (y - h / 2) * 1.15) / 22;
      const a = Phaser.Math.Clamp(d - 0.6, 0, 1);
      if (a >= 1 || bayer(x, y) < a) pc.px(x, y, P.ink);
    }
  }
  registerImage(scene, 'vision-hole', pc);
}

/**
 * Everything that changes as the mind fails: the marble rots, colours
 * drain toward red, whispers rise, false things walk, and at zero the body
 * stops obeying.
 */
export class LucidityFx {
  private cm: Phaser.FX.ColorMatrix | null = null;
  private vignette: Phaser.FX.Vignette | null = null;
  private hole: Phaser.GameObjects.Image;
  private whisperT = 6;
  private heartT = 0;
  private hallucT = 8;
  private ghosts: { s: Phaser.GameObjects.Sprite; life: number }[] = [];
  private inverted = false;
  private lastQ = -1;
  onRot?: (rot: number) => void;

  constructor(private world: World) {
    const scene = world.sc;
    const cam = scene.cameras.main;
    if (cam.postFX) {
      this.cm = cam.postFX.addColorMatrix();
      this.vignette = cam.postFX.addVignette(0.5, 0.5, 0.9, 0.25);
    }
    ensureVisionTexture(scene);
    this.hole = scene.add.image(0, 0, 'vision-hole').setScale(4).setDepth(DEPTH.overlay).setVisible(false);
  }

  update(dt: number) {
    const run = currentRun();
    const L = run.lucidity;
    const rot = rotLevel(L);
    const w = this.world;
    const q = Math.round(rot * 40);
    if (q !== this.lastQ) {
      this.lastQ = q;
      w.level.setRot(rot);
      this.onRot?.(rot);
      if (this.cm) {
        this.cm.reset();
        this.cm.saturate(-0.55 * rot, true);
        // Push the palette toward bruised red as the truth shows through
        const r = 1 + 0.12 * rot;
        const g = 1 - 0.22 * rot;
        const b = 1 - 0.18 * rot;
        this.cm.multiply([r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0], true);
      }
      if (this.vignette) {
        this.vignette.strength = 0.25 + rot * 0.45;
        this.vignette.radius = 0.9 - rot * 0.25;
      }
    }

    // Shrunken sight: the Blind Eye, or a mind nearly gone
    const blind = hasSacrament('blindeye');
    const narrow = blind || L < 15;
    this.hole.setVisible(narrow);
    if (narrow) {
      const cam = w.sc.cameras.main;
      this.hole.setPosition(w.player.x, w.player.cy);
      const s = blind ? (L < 15 ? 3.4 : 4) : 5.2;
      this.hole.setScale(s / cam.zoom);
    }

    // Whispers of dread
    if (L < 50) {
      this.whisperT -= dt;
      if (this.whisperT <= 0) {
        this.whisperT = 5 + Math.random() * 7 * (L / 50 + 0.3);
        const a = Math.random() * Math.PI * 2;
        w.fx.whisper(w.player.x + Math.cos(a) * 60, w.player.y - 60 + Math.sin(a) * 30, Phaser.Utils.Array.GetRandom(DREAD_WHISPERS));
        sfx(w.sc, 'whisper', { volume: 0.5 + (50 - L) / 100 });
      }
    }
    // The frantic heart
    if (L < 30) {
      this.heartT -= dt;
      if (this.heartT <= 0) {
        this.heartT = 0.55 + (L / 30) * 0.7;
        sfx(w.sc, 'heartbeat', { volume: 0.5 + (30 - L) / 40 });
      }
    }
    loopVolume('amb', 1 - rot * 0.6);

    // Things that are not there
    if (L < 30) {
      this.hallucT -= dt;
      if (this.hallucT <= 0) {
        this.hallucT = 5 + Math.random() * 8;
        this.spawnGhost();
      }
    }
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.life -= dt;
      const p = w.player;
      const dir = Math.sign(p.x - g.s.x) || 1;
      g.s.x += dir * 60 * dt;
      g.s.setFlipX(dir < 0);
      if (Math.abs(g.s.x - p.x) < 26 || g.life <= 0) {
        w.sc.tweens.add({ targets: g.s, alpha: 0, duration: 200, onComplete: () => g.s.destroy() });
        this.ghosts.splice(i, 1);
      }
    }

    // Zero Lucidity: the body no longer answers
    if (!this.inverted && L <= 0) {
      this.inverted = true;
      controls.invert = true;
      w.fx.text(w.player.x, w.player.y - 40, 'Thy limbs are not thine own', P.blood0, 12, 2000);
      w.sc.cameras.main.flash(300, 120, 0, 0);
    } else if (this.inverted && L >= 12) {
      this.inverted = false;
      controls.invert = false;
    }
  }

  private spawnGhost() {
    const w = this.world;
    const v = w.sc.cameras.main.worldView;
    const p = w.player;
    const x = Math.random() < 0.5 ? v.x + 12 : v.right - 12;
    const fy = w.level.floorY(x, p.y - 30) ?? p.y;
    const s = w.sc.add.sprite(x, fy, 'blind').setOrigin(0.5, 74 / 80).setTintFill(hexNum(P.ink)).setAlpha(0).setDepth(DEPTH.enemy - 1);
    s.play('blind:walk');
    w.sc.tweens.add({ targets: s, alpha: 0.7, duration: 500 });
    this.ghosts.push({ s, life: 4 });
  }

  destroy() {
    controls.invert = false;
    this.ghosts.forEach((g) => g.s.destroy());
    this.hole.destroy();
  }
}
