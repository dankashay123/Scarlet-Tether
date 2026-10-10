import { P } from './palette';
import { hash2 } from './pixel';
import type { CitizenLook } from './hero';

export const SKIN_TONES = ['#e8b89a', '#d9a283', '#c08a66', '#9c6a4a', '#7a4b33', '#5a3726'];
export const HAIR_TONES = ['#2a1a14', '#5a3a22', '#8a5a2e', '#b8944c', '#d8c6a0', '#5a5a60', '#7a2a1a', '#1a1a22'];
// The penitent's cowl and cloak: crimsons, from fresh blood to old wine
export const ROBE_TONES = ['#9a1626', '#8c1222', '#a8202c', '#7e1430', '#94221e'];
export const TRIM_TONES = [P.gold1, P.gold2, '#9ab0c8', '#c88a9a'];

/** Random-but-deterministic look for a citizen seed. */
export function lookFromSeed(seed: number, stigmas: { maw: boolean; helix: boolean }): CitizenLook {
  const r = (k: number) => hash2(seed, k, 77);
  return {
    skin: SKIN_TONES[Math.floor(r(1) * SKIN_TONES.length)],
    hair: HAIR_TONES[Math.floor(r(2) * HAIR_TONES.length)],
    hairStyle: Math.floor(r(3) * 4),
    robe: ROBE_TONES[Math.floor(r(4) * ROBE_TONES.length)],
    trim: TRIM_TONES[Math.floor(r(5) * TRIM_TONES.length)],
    maw: stigmas.maw,
    helix: stigmas.helix,
  };
}
