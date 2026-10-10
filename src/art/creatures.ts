// Generated enemy, boss, NPC and gib sprites. Every creature is painted with
// the volumetric renderer (render.ts) in the same lighting as the hero.
import { registerAnims, type AnimDef } from './creatures/common';
import { BLIND, blindAnims } from './creatures/blind';
import { GOSSIP, gossipAnims } from './creatures/gossip';
import { PENITENT, penitentAnims } from './creatures/penitent';
import { CHERUB, cherubAnims } from './creatures/cherub';

export { BLIND, GOSSIP, PENITENT, CHERUB };

export function buildCherubSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'cherub', cherubAnims());
}

export function buildPenitentSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'penitent', penitentAnims());
}

export function buildGossipSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'gossip', gossipAnims());
}

export function buildBlindSheets(scene: Phaser.Scene) {
  registerAnims(scene, 'blind', blindAnims(false));
  registerAnims(scene, 'blind-saint', blindAnims(true));
}

export interface GallerySheet {
  key: string;
  w: number;
  h: number;
  anims: AnimDef[];
  ms: number;
}

/** Generates every sheet without registering it (for dev preview pages). */
export function creatureGallery(): GallerySheet[] {
  const out: GallerySheet[] = [];
  const time = (key: string, w: number, h: number, fn: () => AnimDef[]) => {
    const t0 = performance.now();
    const anims = fn();
    out.push({ key, w, h, anims, ms: performance.now() - t0 });
  };
  time('blind', BLIND.w, BLIND.h, () => blindAnims(false));
  time('blind-saint', BLIND.w, BLIND.h, () => blindAnims(true));
  time('gossip', GOSSIP.w, GOSSIP.h, gossipAnims);
  time('penitent', PENITENT.w, PENITENT.h, penitentAnims);
  time('cherub', CHERUB.w, CHERUB.h, cherubAnims);
  return out;
}

export function buildCreatures(scene: Phaser.Scene) {
  buildBlindSheets(scene);
  buildGossipSheet(scene);
  buildPenitentSheet(scene);
  buildCherubSheet(scene);
}
