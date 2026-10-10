import { P, darken, lighten, mix } from './palette';
import { PixelCanvas, bayer, hash2, valueNoise } from './pixel';

export const TILE = 16;

/** Tile indices shared by every tileset so layers can swap textures 1:1. */
export const T = {
  FLOOR_A: 0,
  FLOOR_B: 1,
  FLOOR_C: 2, // inlay
  FLOOR_D: 3, // cracked
  WALL_FACE: 4,
  WALL_FACE_B: 5,
  WALL_TOP: 6,
  WALL_TOP_EDGE: 7,
  POND: 8,
  GRATE: 9,
  FLOOR_SHADOW: 10,
  RUNNER: 11,
  VOID: 12,
  THRESHOLD: 13,
  POND_EDGE: 14,
  FLOOR_E: 15,
} as const;
const COUNT = 16;

type Painter = (pc: PixelCanvas, ox: number, oy: number, idx: number) => void;

function sheet(scene: Phaser.Scene, key: string, paint: Painter) {
  const pc = new PixelCanvas(TILE * COUNT, TILE);
  for (let i = 0; i < COUNT; i++) paint(pc, i * TILE, 0, i);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, pc.toCanvas());
}

// --- Biome 1, as Sanctum wishes you to see it: marble and mahogany ---------

function marbleFloor(pc: PixelCanvas, ox: number, oy: number, seed: number, variant: number) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = valueNoise(ox + x, y + seed * 3, 6, seed) * 0.6 + valueNoise(ox + x, y, 2.5, seed + 9) * 0.4;
      let c: string = n > 0.62 ? P.marble0 : n < 0.32 ? P.marble2 : P.marble1;
      if (bayer(x, y) < 0.15 && n < 0.45) c = P.marble2;
      pc.px(ox + x, oy + y, c);
    }
  }
  // Vein
  let vy = 3 + hash2(seed, 1) * 10;
  for (let x = 0; x < 16; x++) {
    vy += (hash2(x, seed, 5) - 0.5) * 1.6;
    if (variant !== 1 || x < 9) pc.px(ox + x, oy + Math.round(vy), P.vein);
  }
  // Soft grout: a thin seam, broken in places, so slabs read large
  for (let i = 0; i < 16; i++) {
    if (hash2(i, seed, 31) < 0.85) pc.px(ox + i, oy + 15, P.marble2);
    if (hash2(seed, i, 32) < 0.85) pc.px(ox + 15, oy + i, P.marble2);
    if (i % 3 === 0) pc.px(ox + i, oy, lighten(P.marble0, 0.15));
  }
}

function paintMarble(pc: PixelCanvas, ox: number, oy: number, idx: number) {
  switch (idx) {
    case T.FLOOR_A:
    case T.FLOOR_B:
    case T.FLOOR_E:
      marbleFloor(pc, ox, oy, idx + 1, idx);
      if (idx === T.FLOOR_E) {
        // Shallow flood-water sheen
        for (let x = 2; x < 13; x++) if (hash2(x, 2, 8) < 0.7) pc.px(ox + x, oy + 9 + Math.round(Math.sin(x) * 1), mix(P.marble1, P.tear1, 0.35));
      }
      break;
    case T.FLOOR_C: {
      marbleFloor(pc, ox, oy, 7, idx);
      // Gilded rosette inlay
      pc.ellipse(ox + 8, oy + 8, 4, 4, P.gold2);
      pc.ellipse(ox + 8, oy + 8, 3, 3, P.gold1);
      pc.ellipse(ox + 8, oy + 8, 1, 1, P.gold0);
      pc.px(ox + 8, oy + 2, P.gold1);
      pc.px(ox + 8, oy + 14, P.gold1);
      pc.px(ox + 2, oy + 8, P.gold1);
      pc.px(ox + 14, oy + 8, P.gold1);
      break;
    }
    case T.FLOOR_D:
      marbleFloor(pc, ox, oy, 11, idx);
      pc.line(ox + 2, oy + 3, ox + 7, oy + 8, P.marble3);
      pc.line(ox + 7, oy + 8, ox + 6, oy + 13, P.marble3);
      pc.line(ox + 7, oy + 8, ox + 12, oy + 10, P.marble3);
      break;
    case T.FLOOR_SHADOW:
      marbleFloor(pc, ox, oy, 2, 0);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) if (bayer(x, y) < 1 - y / 6) pc.px(ox + x, oy + y, darken(P.marble2, 0.35));
      break;
    case T.WALL_FACE:
    case T.WALL_FACE_B: {
      // Carved mahogany booth paneling
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const plank = x % 4 === 0 ? P.wood2 : x % 4 === 1 ? P.wood0 : P.wood1;
          pc.px(ox + x, oy + y, hash2(x, y, idx) < 0.06 ? P.wood2 : plank);
        }
      }
      pc.rect(ox, oy, 16, 2, P.wood0);
      pc.rect(ox, oy + 2, 16, 1, P.wood3);
      pc.rect(ox, oy + 14, 16, 2, P.wood3);
      if (idx === T.WALL_FACE_B) {
        // Lattice window with candlelight behind
        pc.rect(ox + 4, oy + 4, 8, 8, P.ink);
        pc.ellipse(ox + 8, oy + 4, 4, 2, P.ink);
        for (let y = 2; y < 12; y++) for (let x = 4; x < 12; x++) if ((x + y) % 3 === 0 && y > 3) pc.px(ox + x, oy + y, P.wood0);
        pc.px(ox + 7, oy + 8, P.candle);
        pc.px(ox + 8, oy + 9, P.gold1);
      } else {
        // Carved gothic arch
        pc.line(ox + 3, oy + 13, ox + 3, oy + 7, P.wood0);
        pc.line(ox + 12, oy + 13, ox + 12, oy + 7, P.wood2);
        pc.line(ox + 3, oy + 7, ox + 7, oy + 4, P.wood0);
        pc.line(ox + 12, oy + 7, ox + 8, oy + 4, P.wood2);
      }
      break;
    }
    case T.WALL_TOP:
    case T.WALL_TOP_EDGE:
      pc.rect(ox, oy, 16, 16, P.wood3);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (hash2(ox + x, y, 4) < 0.08) pc.px(ox + x, oy + y, P.wood2);
      if (idx === T.WALL_TOP_EDGE) {
        pc.rect(ox, oy + 13, 16, 3, P.wood2);
        pc.rect(ox, oy + 13, 16, 1, P.wood0);
        for (let x = 1; x < 16; x += 3) pc.px(ox + x, oy + 15, P.gold2);
      }
      break;
    case T.POND:
    case T.POND_EDGE:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = valueNoise(ox + x, y, 5, 3);
          pc.px(ox + x, oy + y, n > 0.6 ? P.murk0 : n < 0.3 ? P.murk2 : P.murk1);
        }
      }
      pc.line(ox + 3, oy + 5, ox + 7, oy + 5, mix(P.murk0, P.white, 0.3));
      pc.line(ox + 9, oy + 11, ox + 12, oy + 11, mix(P.murk0, P.white, 0.2));
      if (idx === T.POND_EDGE) pc.rect(ox, oy, 16, 2, P.marble3);
      break;
    case T.GRATE:
      marbleFloor(pc, ox, oy, 5, 0);
      pc.rect(ox + 1, oy + 1, 14, 14, P.brass2);
      pc.rect(ox + 2, oy + 2, 12, 12, P.ink);
      for (let i = 3; i < 14; i += 3) {
        pc.rect(ox + i, oy + 2, 1, 12, P.brass0);
        pc.rect(ox + i + 1, oy + 2, 1, 12, P.brass1);
      }
      pc.strokeRect(ox + 1, oy + 1, 14, 14, P.brass1);
      break;
    case T.RUNNER:
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.px(ox + x, oy + y, bayer(x, y) < 0.2 ? P.blood2 : P.blood1);
      pc.rect(ox, oy, 2, 16, P.gold2);
      pc.rect(ox + 14, oy, 2, 16, P.gold2);
      for (let y = 2; y < 16; y += 5) pc.px(ox + 8, oy + y, P.gold1);
      break;
    case T.VOID:
      pc.rect(ox, oy, 16, 16, P.ink);
      break;
    case T.THRESHOLD:
      marbleFloor(pc, ox, oy, 9, 0);
      for (let x = 0; x < 16; x += 2) pc.rect(ox + x, oy + 6, 1, 4, P.gold2);
      pc.rect(ox, oy + 5, 16, 1, P.gold1);
      pc.rect(ox, oy + 10, 16, 1, P.gold3);
      break;
  }
}

// --- Biome 1, as it truly is: rot, porous bone, gristle ---------------------

function rotFloor(pc: PixelCanvas, ox: number, oy: number, seed: number) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = valueNoise(ox + x, y + seed, 4, seed + 40);
      let c: string = n > 0.68 ? P.flesh1 : n < 0.3 ? P.flesh3 : P.flesh2;
      if (n < 0.18) c = P.flesh4;
      pc.px(ox + x, oy + y, c);
    }
  }
  // Pores
  for (let i = 0; i < 4; i++) {
    const px = Math.floor(hash2(i, seed, 2) * 14) + 1;
    const py = Math.floor(hash2(seed, i, 3) * 14) + 1;
    pc.px(ox + px, oy + py, P.ink);
    pc.px(ox + px + 1, oy + py, P.flesh4);
    pc.px(ox + px, oy + py - 1, P.flesh1);
  }
  // Vein
  let vy = 2 + hash2(seed, 9) * 12;
  for (let x = 0; x < 16; x++) {
    vy += (hash2(x, seed, 15) - 0.5) * 2;
    if (hash2(x, seed, 16) < 0.8) pc.px(ox + x, oy + Math.round(vy), P.blood2);
  }
}

function paintRot(pc: PixelCanvas, ox: number, oy: number, idx: number) {
  switch (idx) {
    case T.FLOOR_A:
    case T.FLOOR_B:
    case T.FLOOR_E:
      rotFloor(pc, ox, oy, idx + 20);
      break;
    case T.FLOOR_C:
      rotFloor(pc, ox, oy, 31);
      // The gilded rosette is a puckered, weeping orifice
      pc.ellipse(ox + 8, oy + 8, 4, 4, P.flesh3);
      pc.ellipse(ox + 8, oy + 8, 2, 2, P.flesh4);
      pc.px(ox + 8, oy + 8, P.ink);
      for (let a = 0; a < 6; a++) pc.px(ox + 8 + Math.round(Math.cos(a) * 4), oy + 8 + Math.round(Math.sin(a) * 4), P.flesh1);
      break;
    case T.FLOOR_D:
      rotFloor(pc, ox, oy, 35);
      pc.line(ox + 3, oy + 4, ox + 12, oy + 11, P.bone1);
      pc.line(ox + 4, oy + 4, ox + 13, oy + 11, P.bone2);
      pc.ellipse(ox + 3, oy + 4, 1, 1, P.bone0);
      pc.ellipse(ox + 12, oy + 11, 1, 1, P.bone0);
      break;
    case T.FLOOR_SHADOW:
      rotFloor(pc, ox, oy, 22);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) if (bayer(x, y) < 1 - y / 6) pc.px(ox + x, oy + y, P.flesh4);
      break;
    case T.WALL_FACE:
    case T.WALL_FACE_B: {
      // Porous bone, ribbed
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = valueNoise(ox + x, y, 3, 60 + idx);
          pc.px(ox + x, oy + y, n > 0.6 ? P.bone0 : n < 0.3 ? P.bone2 : P.bone1);
        }
      }
      for (let i = 0; i < 7; i++) {
        const px = Math.floor(hash2(i, idx, 7) * 14) + 1;
        const py = Math.floor(hash2(idx, i, 8) * 12) + 2;
        pc.ellipse(ox + px, oy + py, 1, 1, P.bone3);
        pc.px(ox + px, oy + py, P.ink);
      }
      if (idx === T.WALL_FACE_B) {
        // The lattice is a ribcage; the candle a wet eye
        for (let x = 3; x < 13; x += 3) pc.line(ox + x, oy + 3, ox + x + 1, oy + 13, P.bone3);
        pc.ellipse(ox + 8, oy + 8, 2, 1, P.white);
        pc.px(ox + 8, oy + 8, P.blood2);
      }
      pc.rect(ox, oy + 14, 16, 2, P.flesh4);
      for (let x = 0; x < 16; x++) if (hash2(x, idx, 12) < 0.3) pc.px(ox + x, oy + 13, P.blood2);
      break;
    }
    case T.WALL_TOP:
    case T.WALL_TOP_EDGE:
      pc.rect(ox, oy, 16, 16, P.flesh4);
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (hash2(ox + x, y, 14) < 0.12) pc.px(ox + x, oy + y, P.flesh3);
      if (idx === T.WALL_TOP_EDGE) {
        pc.rect(ox, oy + 13, 16, 3, P.flesh3);
        for (let x = 0; x < 16; x += 2) pc.px(ox + x, oy + 15, P.bone1);
      }
      break;
    case T.POND:
    case T.POND_EDGE:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = valueNoise(ox + x, y, 5, 3);
          pc.px(ox + x, oy + y, n > 0.62 ? P.blood1 : n < 0.3 ? P.blood3 : P.blood2);
        }
      }
      pc.ellipse(ox + 5, oy + 6, 1, 1, P.blood0);
      pc.px(ox + 11, oy + 11, P.blood0);
      if (idx === T.POND_EDGE) pc.rect(ox, oy, 16, 2, P.flesh4);
      break;
    case T.GRATE:
      rotFloor(pc, ox, oy, 26);
      pc.rect(ox + 1, oy + 1, 14, 14, P.rot2);
      pc.rect(ox + 2, oy + 2, 12, 12, P.ink);
      for (let i = 3; i < 14; i += 3) pc.rect(ox + i, oy + 2, 1, 12, P.rot0);
      // Lips at the grille, mid-whisper
      pc.line(ox + 4, oy + 8, ox + 11, oy + 8, P.flesh1);
      pc.line(ox + 5, oy + 9, ox + 10, oy + 9, P.flesh3);
      break;
    case T.RUNNER:
      rotFloor(pc, ox, oy, 28);
      for (let y = 0; y < 16; y++) for (let x = 3; x < 13; x++) if (hash2(x, y, 3) < 0.6) pc.px(ox + x, oy + y, P.blood2);
      break;
    case T.VOID:
      pc.rect(ox, oy, 16, 16, P.ink);
      break;
    case T.THRESHOLD:
      rotFloor(pc, ox, oy, 29);
      for (let x = 0; x < 16; x += 2) pc.rect(ox + x, oy + 6, 1, 4, P.bone1);
      break;
  }
}

// --- The Drain of Absolution (hub cistern) ----------------------------------

function cisternFloor(pc: PixelCanvas, ox: number, oy: number, seed: number) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = valueNoise(ox + x, y, 4, seed + 80);
      pc.px(ox + x, oy + y, n > 0.62 ? '#5a4a44' : n < 0.32 ? '#2e2422' : '#433632');
    }
  }
  // Brick seams
  for (let x = 0; x < 16; x++) {
    pc.px(ox + x, oy + 7, '#22191a');
    pc.px(ox + x, oy + 15, '#22191a');
  }
  pc.px(ox + 7, oy + 0, '#22191a');
  for (let y = 0; y < 7; y++) pc.px(ox + 7, oy + y, '#22191a');
  for (let y = 8; y < 15; y++) pc.px(ox + 15, oy + y, '#22191a');
  for (let x = 0; x < 16; x++) if (hash2(x, seed, 2) < 0.2) pc.px(ox + x, oy + 8, '#6a5850');
}

function paintCistern(pc: PixelCanvas, ox: number, oy: number, idx: number) {
  switch (idx) {
    case T.WALL_FACE:
    case T.WALL_FACE_B:
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) pc.px(ox + x, oy + y, (y >> 2) % 2 ? '#3a2e2a' : '#46383a');
      for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x++) pc.px(ox + x, oy + y, '#1f1718');
      for (let y = 0; y < 16; y += 4) pc.px(ox + ((y / 4) % 2 ? 4 : 11), oy + y + 1, '#1f1718');
      // Grime and blood trickling from the grates above
      for (let x = 0; x < 16; x++) {
        const len = Math.floor(hash2(x, idx, 3) * 10);
        if (hash2(x, idx, 4) < 0.25) for (let y = 0; y < len; y++) pc.px(ox + x, oy + y, y > len - 3 ? P.blood2 : '#2a3a2a');
      }
      if (idx === T.WALL_FACE_B) {
        pc.rect(ox + 5, oy + 3, 6, 4, P.ink);
        pc.rect(ox + 6, oy + 3, 1, 4, P.iron1);
        pc.rect(ox + 9, oy + 3, 1, 4, P.iron1);
      }
      pc.rect(ox, oy + 15, 16, 1, P.ink);
      break;
    case T.WALL_TOP:
    case T.WALL_TOP_EDGE:
      pc.rect(ox, oy, 16, 16, '#140c0d');
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (hash2(ox + x, y, 34) < 0.08) pc.px(ox + x, oy + y, '#241a1a');
      if (idx === T.WALL_TOP_EDGE) pc.rect(ox, oy + 14, 16, 2, '#3a2e2a');
      break;
    case T.POND:
    case T.POND_EDGE:
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const n = valueNoise(ox + x, y, 6, 13);
          pc.px(ox + x, oy + y, n > 0.6 ? '#7a1c22' : n < 0.3 ? '#3a0a12' : '#561018');
        }
      }
      pc.line(ox + 2, oy + 6, ox + 6, oy + 6, '#a83a3a');
      if (idx === T.POND_EDGE) pc.rect(ox, oy, 16, 2, '#2e2422');
      break;
    case T.GRATE:
      cisternFloor(pc, ox, oy, 3);
      pc.rect(ox + 2, oy + 2, 12, 12, P.ink);
      for (let i = 3; i < 14; i += 3) pc.rect(ox + i, oy + 2, 1, 12, P.iron1);
      break;
    case T.FLOOR_SHADOW:
      cisternFloor(pc, ox, oy, 1);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) if (bayer(x, y) < 1 - y / 6) pc.px(ox + x, oy + y, '#160e0f');
      break;
    case T.VOID:
      pc.rect(ox, oy, 16, 16, P.ink);
      break;
    case T.RUNNER:
      cisternFloor(pc, ox, oy, 6);
      for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) if (hash2(x, y, 9) < 0.5) pc.px(ox + x, oy + y, '#5a1018');
      break;
    default:
      cisternFloor(pc, ox, oy, idx);
      if (idx === T.FLOOR_D) {
        pc.ellipse(ox + 5, oy + 11, 2, 1, P.bone1);
        pc.px(ox + 11, oy + 4, P.bone0);
      }
  }
}

export function buildTilesets(scene: Phaser.Scene) {
  sheet(scene, 'tiles-marble', paintMarble);
  sheet(scene, 'tiles-rot', paintRot);
  sheet(scene, 'tiles-cistern', paintCistern);
}
