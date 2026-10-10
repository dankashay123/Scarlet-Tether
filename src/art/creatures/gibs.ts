// Gibs: the bits that fly out of things when the Tether is done with them.
import { BLOOD, OLD_BLOOD, BONE, RAW, TEETH, VOID, anim, back, renderFig, skinMat, tube, frame, type AnimDef, type Material } from './common';

const FAT: Material = { ramp: ['#3a2a10', '#7a6430', '#b0985a', '#d8c488', '#f0e4b0'], spec: 0.5 };
const ORGAN: Material = { ramp: ['#1a040a', '#3e0a16', '#6a1424', '#8e2232', '#b03a44', '#d86a68'], spec: 0.9 };
const EYE: Material = { ramp: ['#4a4038', '#9a9284', '#d8d2c4', '#f4f0e8', '#ffffff'], spec: 1 };
const GUT: Material = { ramp: ['#2a0a12', '#5a1e2a', '#8a3a44', '#b0606a', '#d08a8a', '#ecb4a8'], spec: 0.8 };

function gib(k: number) {
  const f = frame(16, 16);
  const skin = skinMat('#b8907a', 0.4);
  switch (k) {
    case 0: // chunk of flesh with fat and skin
      f.ellipse(8, 8, 5.5, 4.5, RAW, 1, 0.4);
      f.ellipse(6, 6, 3, 2, FAT, 1.2);
      f.ellipse(10, 10.5, 3.2, 1.8, skin, 1.3, 0.3);
      f.stain((x, y) => (x * 7 + y * 3) % 5 === 0, BLOOD, [RAW]);
      break;
    case 1: // gristle chunk
      f.poly([[3, 9], [7, 3], [13, 5], [13, 11], [8, 13]], RAW, 1);
      f.ellipse(10, 9, 2, 1.6, BONE, 1.2);
      f.stain((x, y) => y > 9, BLOOD, [RAW]);
      break;
    case 2: // a rib
      tube(f, [[2, 12], [5, 6], [10, 3], [14, 4]], 1.4, 0.9, BONE, 1);
      f.ellipse(2.5, 12, 1.6, 1.6, RAW, 1.1);
      f.stain((x, y) => x < 6, BLOOD, [BONE]);
      break;
    case 3: // a bone shard
      f.poly([[3, 13], [6, 10], [12, 2], [13, 4], [8, 12], [5, 14]], BONE, 1);
      f.ellipse(4, 12.5, 2, 1.6, RAW, 1.1);
      f.stain((x, y) => x + y > 15, OLD_BLOOD, [BONE]);
      break;
    case 4: // an eyeball trailing its nerve
      tube(f, [[3, 13], [5, 11], [6, 9]], 1, 0.8, ORGAN, 1);
      f.ellipse(9, 7, 4.2, 4.2, EYE, 1.1);
      f.ellipse(11, 6, 2, 2, { ramp: ['#1a2a1a', '#4a6a4a', '#7a9a6a'], spec: 1 }, 1.2);
      f.ellipse(11.4, 5.8, 0.9, 0.9, VOID, 1.3);
      f.stain((x, y) => x < 8 && y > 7, BLOOD, [EYE]);
      break;
    case 5: { // a jaw with teeth
      tube(f, [[2, 6], [3, 11], [8, 13], [13, 11]], 1.6, 1.8, BONE, 1);
      for (let q = 0; q < 5; q++) f.capsule(5 + q * 1.8, 11.5 - q * 0.2, 5.2 + q * 1.8, 9 - q * 0.2, 0.75, 0.55, TEETH, 1.2);
      f.ellipse(2.5, 6, 2, 1.6, RAW, 1.1);
      f.stain((x, y) => y > 12, BLOOD, [BONE]);
      break;
    }
    case 6: // a loop of intestine
      tube(f, [[2, 10], [4, 5], [8, 4], [11, 6], [10, 10], [7, 11], [6, 8], [9, 7], [13, 9], [14, 13]], 1.6, 1.4, GUT, 1);
      f.stain((x, y) => (x + y) % 6 === 0, BLOOD, [GUT]);
      break;
    case 7: // an organ (a fist-sized heart)
      f.ellipse(8, 9, 5, 5.5, ORGAN, 1, 0.3);
      f.ellipse(6, 5, 2.4, 2, ORGAN, 1.1);
      tube(f, [[9, 4], [10, 1.5]], 1.3, 1, back(ORGAN, 0.2), 1.2);
      tube(f, [[6, 4], [4.5, 2]], 1, 0.8, FAT, 1.2);
      f.stain((x, y) => Math.abs(x - y * 0.4 - 4) < 0.5, back(ORGAN, 0.4), [ORGAN]);
      break;
    case 8: // an ear
      f.ellipse(8, 8, 4.5, 6, skin, 1);
      tube(f, [[10, 3], [6, 2.5], [4, 6], [4.5, 11], [7, 13.5]], 1.4, 1.6, skin, 1.2);
      f.ellipse(8.5, 8, 2.2, 2.8, { ...skin, round: -1 }, 1.1);
      f.ellipse(9, 8.5, 0.8, 1.2, VOID, 1.15);
      f.stain((x, y) => x > 11, BLOOD, [skin]);
      break;
    case 9: // a tooth
      f.capsule(8, 4, 8, 9, 2.4, 2.1, TEETH, 1);
      f.capsule(6.8, 9, 6, 13, 0.9, 0.5, TEETH, 1);
      f.capsule(9.2, 9, 10, 13, 0.9, 0.5, TEETH, 1);
      f.stain((x, y) => y > 10, BLOOD, [TEETH]);
      break;
  }
  return renderFig(f);
}

function skinStrip() {
  const f = frame(16, 16);
  const skin = skinMat('#c4a088', 0.4);
  tube(f, [[1, 6], [5, 4], [9, 7], [13, 5], [15, 8]], 1.6, 1.3, skin, 1);
  tube(f, [[1, 7.5], [5, 5.5], [9, 8.5], [13, 6.5], [15, 9.5]], 1, 0.8, RAW, 0.9);
  f.stain((x, y) => (x * 5 + y) % 7 === 0, BLOOD, [skin]);
  return renderFig(f);
}

/** 10 frames: flesh, gristle, rib, bone shard, eyeball, jaw, intestine, organ, ear, tooth... plus a strip of skin. */
export function gibAnims(): AnimDef[] {
  // flesh chunk, rib, bone shard, eyeball, jaw, intestine, organ, ear, tooth, skin strip
  const frames = [gib(0), gib(2), gib(3), gib(4), gib(5), gib(6), gib(7), gib(8), gib(9), skinStrip()];
  return [anim('all', frames, 1, 0)];
}
