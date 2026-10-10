import Phaser from 'phaser';
import { DEPTH } from './config';

const LAYERS: { name: 'far' | 'mid' | 'near'; factor: number; depth: number }[] = [
  { name: 'far', factor: 0.1, depth: DEPTH.bgFar },
  { name: 'mid', factor: 0.35, depth: DEPTH.bgMid },
  { name: 'near', factor: 0.65, depth: DEPTH.bgNear },
];

/** Areas of the descent, each with its own parallax and palette. */
export type Theme = 'marble' | 'crypt' | 'bridge' | 'cistern';

interface Layer {
  lie: Phaser.GameObjects.TileSprite;
  truth: Phaser.GameObjects.TileSprite | null;
  factor: number;
  base: number;
}

interface ThemeLayers {
  layers: Layer[];
  w: number; // visibility weight 0..1
}

/** Texture keys: the sane look, and its rotten twin shown as Lucidity fails. */
function keys(theme: Theme, layer: string) {
  if (theme === 'marble') return { lie: layer === 'fg' ? 'fg-marble' : `bg-marble-${layer}`, truth: layer === 'fg' ? 'fg-rot' : `bg-rot-${layer}` };
  if (theme === 'cistern') return { lie: layer === 'fg' ? 'fg-cistern' : `bg-cistern-${layer}`, truth: null };
  return { lie: layer === 'fg' ? `fg-${theme}` : `bg-${theme}-${layer}`, truth: layer === 'fg' ? `fg-${theme}-rot` : `bg-${theme}-rot-${layer}` };
}

/**
 * Parallax behind the play layer, plus a dark foreground frame. A level may
 * hold several themes (cathedral, crypt, the bridge outside) and crossfades
 * between them room by room; every layer also crossfades to its rot twin.
 */
export class Backdrop {
  private themes = new Map<Theme, ThemeLayers>();
  private current: Theme;
  private rot = 0;
  private fade: Phaser.Tweens.Tween | null = null;

  constructor(
    private scene: Phaser.Scene,
    first: Theme,
    extra: Theme[] = [],
  ) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const mk = (key: string | null, depth: number) => (key && scene.textures.exists(key) ? scene.add.tileSprite(0, 0, W, H, key).setOrigin(0).setScrollFactor(0).setDepth(depth) : null);
    for (const theme of [first, ...extra.filter((t) => t !== first)]) {
      const layers: Layer[] = [];
      for (const l of [...LAYERS, { name: 'fg' as const, factor: 1.3, depth: DEPTH.fg }]) {
        const k = keys(theme, l.name);
        const lie = mk(k.lie, l.depth);
        if (!lie) continue;
        const truth = mk(k.truth, l.depth + 0.5);
        truth?.setAlpha(0);
        layers.push({ lie, truth, factor: l.factor, base: l.depth });
      }
      if (layers.length || theme === first) this.themes.set(theme, { layers, w: theme === first ? 1 : 0 });
    }
    this.current = first;
    this.apply();
  }

  /** Crossfade to another area's backdrop (no-op if its art is missing). */
  setTheme(theme: Theme, ms = 700) {
    if (theme === this.current || !this.themes.get(theme)?.layers.length) return;
    const next = this.themes.get(theme)!;
    this.current = theme;
    // The incoming theme draws on top while it fades in
    for (const t of this.themes.values()) {
      const top = t === next;
      for (const l of t.layers) {
        l.lie.setDepth(l.base + (top ? 0.2 : 0));
        l.truth?.setDepth(l.base + (top ? 0.7 : 0.5));
      }
    }
    this.fade?.stop();
    const from = next.w;
    const o = { t: 0 };
    this.fade = this.scene.tweens.add({
      targets: o,
      t: 1,
      duration: ms,
      onUpdate: () => {
        next.w = from + (1 - from) * o.t;
        this.apply();
      },
      onComplete: () => {
        for (const t of this.themes.values()) t.w = t === next ? 1 : 0;
        this.apply();
      },
    });
  }

  get theme() {
    return this.current;
  }

  private apply() {
    for (const t of this.themes.values())
      for (const l of t.layers) {
        l.lie.setVisible(t.w > 0).setAlpha(t.w);
        if (l.truth) l.truth.setVisible(t.w > 0 && this.rot > 0).setAlpha(t.w * this.rot);
      }
  }

  update() {
    const cam = this.scene.cameras.main;
    for (const t of this.themes.values()) {
      if (t.w <= 0) continue;
      for (const l of t.layers) {
        l.lie.tilePositionX = cam.scrollX * l.factor;
        if (l.truth) l.truth.tilePositionX = l.lie.tilePositionX;
      }
    }
  }

  setRot(rot: number) {
    if (rot === this.rot) return;
    this.rot = rot;
    this.apply();
  }

  destroy() {
    this.fade?.stop();
    for (const t of this.themes.values())
      for (const l of t.layers) {
        l.lie.destroy();
        l.truth?.destroy();
      }
  }
}
