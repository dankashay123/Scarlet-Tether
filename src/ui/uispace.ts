import Phaser from 'phaser';
import { VIEW_H } from '../game/config';

/**
 * Menus, dialogs and the HUD are laid out on a 360-px-tall canvas, finer than
 * the 224-px SNES play screen. A UI scene's camera zooms that layout down onto
 * the screen; text (DOM) stays crisp and UI art is filtered smoothly.
 */
export const UI_H = 360;
export const UI_K = VIEW_H / UI_H;

const SMOOTH = /^(hud-|btn-|stick-|ink-|title|sanctum|splash|menu|frame-|panel|dialog|portrait)/;

export function uiSpace(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(UI_K).setOrigin(0, 0).setRoundPixels(false);
  // Downscaled UI art reads better filtered than nearest-neighbour
  for (const key of scene.textures.getTextureKeys()) {
    if (!SMOOTH.test(key)) continue;
    const t = scene.textures.get(key);
    const data = t.customData as { smooth?: boolean };
    if (!data.smooth) {
      t.setFilter(Phaser.Textures.FilterMode.LINEAR);
      data.smooth = true;
    }
  }
}

export const uiW = (scene: Phaser.Scene) => Math.round(scene.scale.width / UI_K);
export const uiH = (_scene: Phaser.Scene) => UI_H;

/** A pointer's position in UI space. */
export const ux = (p: { x: number }) => p.x / UI_K;
export const uy = (p: { y: number }) => p.y / UI_K;
