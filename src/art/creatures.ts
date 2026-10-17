// Generated enemy, boss, NPC and gib sprites. Every creature is painted with
// the volumetric renderer (render.ts) in the same key/rim lighting as the hero.
// Each builder registers a texture strip plus `${key}:${anim}` animations.
import { registerSheet } from './pixel';
import { registerAnims, type AnimDef } from './creatures/common';
import { BLIND, blindAnims } from './creatures/blind';
import { GOSSIP, gossipAnims } from './creatures/gossip';
import { PENITENT, penitentAnims } from './creatures/penitent';
import { CHERUB, cherubAnims } from './creatures/cherub';
import { BART, EAR, bartAnims, earAnims } from './creatures/bart';
import { NPC_SIZES, npcAnims } from './creatures/npcs';
import { gibAnims } from './creatures/gibs';

export { BLIND, GOSSIP, PENITENT, CHERUB, BART, EAR, NPC_SIZES };
export const GIB = { w: 10, h: 10, count: 10 };

/** 'blind' (the Blissful Blind) and 'blind-saint' (how Sanctum wants it seen). */
export function buildBlindSheets(scene: Phaser.Scene) {
  registerAnims(scene, 'blind', blindAnims(false));
  registerAnims(scene, 'blind-saint', blindAnims(true));
}

/** 'gossip': the Bile Gossip. */
export function buildGossipSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'gossip', gossipAnims());
}

/** 'penitent': the Lacquered Penitent (censer drawn into every frame). */
export function buildPenitentSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'penitent', penitentAnims());
}

/** 'cherub': the Hushed Cherub (frames centred; 'dead' lies at the bottom). */
export function buildCherubSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'cherub', cherubAnims());
}

/** 'bart' (Bartholomew, the Swollen Ear) and 'ear' (his torn-off ear). */
export function buildBossSheet(scene: Phaser.Scene) {
  registerAnims(scene, 'bart', bartAnims());
  registerAnims(scene, 'ear', earAnims());
}

/** 'magdalene', 'vivisect', 'hollow'. */
export function buildNpcSheets(scene: Phaser.Scene) {
  const n = npcAnims();
  registerAnims(scene, 'magdalene', n.magdalene);
  registerAnims(scene, 'vivisect', n.vivisect);
  registerAnims(scene, 'hollow', n.hollow);
}

/** 'gib': 10 frames of 10x10 (no animations). */
export function buildGibs(scene: Phaser.Scene) {
  registerSheet(scene, 'gib', gibAnims()[0].frames);
}

/** Builds every creature except the boss, which is built on demand (it is slow). */
export function buildCreatures(scene: Phaser.Scene) {
  buildBlindSheets(scene);
  buildGossipSheet(scene);
  buildPenitentSheet(scene);
  buildCherubSheet(scene);
  buildNpcSheets(scene);
  buildGibs(scene);
}

/** Build Bartholomew and his ear if they don't exist yet. */
export function ensureBossSheet(scene: Phaser.Scene) {
  if (!scene.textures.exists('bart')) buildBossSheet(scene);
}

// ---------------------------------------------------------------------------
// Dev preview
// ---------------------------------------------------------------------------

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
  time('bart', BART.w, BART.h, bartAnims);
  time('ear', EAR.w, EAR.h, earAnims);
  let npcs: ReturnType<typeof npcAnims> | null = null;
  const t0 = performance.now();
  npcs = npcAnims();
  const npcMs = (performance.now() - t0) / 3;
  for (const k of ['magdalene', 'vivisect', 'hollow'] as const) out.push({ key: k, w: NPC_SIZES[k].w, h: NPC_SIZES[k].h, anims: npcs[k], ms: npcMs });
  time('gib', GIB.w, GIB.h, gibAnims);
  return out;
}
