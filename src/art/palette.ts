// The Scarlet Tether master palette. Everything is drawn from these swatches so
// the generated art reads as one coherent 16-bit set.
export const P = {
  clear: 'transparent',
  ink: '#0b0507', // outline / void
  ink2: '#1a0d10',
  shadow: '#2a1418',
  shadow2: '#3b1d22',

  // Marble & gold (Sanctum's lie)
  marble0: '#f4efe4',
  marble1: '#ddd5c4',
  marble2: '#b9ae9a',
  marble3: '#8c8273',
  marble4: '#5e564d',
  vein: '#c9b48a',
  gold0: '#fff1a8',
  gold1: '#e8c25a',
  gold2: '#b98a2e',
  gold3: '#7a5418',

  // Mahogany (confessionals)
  wood0: '#a8583a',
  wood1: '#7d3b25',
  wood2: '#56251a',
  wood3: '#341510',

  // Flesh & rot (the truth)
  flesh0: '#f2c3a8',
  flesh1: '#d98f7a',
  flesh2: '#b05a55',
  flesh3: '#7a3540',
  flesh4: '#4d1f2b',
  bone0: '#efe3bf',
  bone1: '#cdb889',
  bone2: '#9a845a',
  bone3: '#5f4e35',
  rot0: '#8a7a52',
  rot1: '#5f5636',
  rot2: '#3a3424',
  bile0: '#c7c25a',
  bile1: '#8d8a2e',
  bile2: '#555418',

  // Blood
  blood0: '#ff3b3b',
  blood1: '#d0162a',
  blood2: '#8a1020',
  blood3: '#4e0815',

  // Water / murk
  murk0: '#4a5a5e',
  murk1: '#2f3c40',
  murk2: '#1c2427',

  // Brass & iron
  brass0: '#e0b468',
  brass1: '#a87a35',
  brass2: '#6a4a1e',
  iron0: '#8a8d93',
  iron1: '#5a5c63',
  iron2: '#35363c',

  // Cloth
  cloth0: '#d8cfc0', // citizen's white robe
  cloth1: '#a89c8a',
  cloth2: '#6e6556',
  veil0: '#3a2a3a',
  veil1: '#24182a',

  // Light / UI
  candle: '#ffd27a',
  holy: '#fff8dc',
  tear0: '#bfe6ff',
  tear1: '#6fb3e0',
  tear2: '#336b9e',
  lucid0: '#d9c2ff',
  lucid1: '#9a7fd8',
  lucid2: '#5a4596',
  smoke0: '#cfc6b8',
  smoke1: '#8f877c',
  white: '#ffffff',
} as const;

export type Swatch = keyof typeof P;

const cache = new Map<string, [number, number, number, number]>();

export function rgba(color: string): [number, number, number, number] {
  let c = cache.get(color);
  if (c) return c;
  if (color === 'transparent') c = [0, 0, 0, 0];
  else {
    const h = color.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  cache.set(color, c);
  return c;
}

export function hexNum(color: string): number {
  const [r, g, b] = rgba(color);
  return (r << 16) | (g << 8) | b;
}

/** Linear blend between two hex colours, returned as hex. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgba(a);
  const [r2, g2, b2] = rgba(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return '#' + f(r1, r2) + f(g1, g2) + f(b1, b2);
}

export const darken = (c: string, t: number) => mix(c, '#0b0507', t);
export const lighten = (c: string, t: number) => mix(c, '#fff8e8', t);
