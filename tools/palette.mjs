// The master palette (GDD: "one master palette of about 48 colors").
// Every sprite pixel must be one of these; tools/sprites.mjs enforces it.
// Ramps run light -> dark (light comes from the top-left).
export const PALETTE = {
  // Shared darks and the 1 px outline.
  outline: '#0d0a0e', void: '#1a1420', dusk: '#2a2230',

  // Undercroft stone.
  stone0: '#7f7984', stone1: '#65606a', stone2: '#4f4b54', stone3: '#3d3a42', stone4: '#2e2c33',

  // Bone white.
  bone0: '#f2ead8', bone1: '#d8ccb4', bone2: '#b8ab94', bone3: '#857a68',

  // Candle green (Undercroft light).
  candle0: '#c8ffb0', candle1: '#7fd67a', candle2: '#3f7a4a', candle3: '#1f3a2a',

  // Gilding.
  gold0: '#ffe08a', gold1: '#d9a640', gold2: '#9a6c24', gold3: '#5a3e1a',

  // Blood and crimson cloth.
  blood0: '#e0383a', blood1: '#a81c22', blood2: '#6e1018', blood3: '#3a0b10',

  // Pale vestments.
  cloth0: '#e8e4dc', cloth1: '#bfb7aa', cloth2: '#8a8174',

  // Risen flesh (grey-green rot).
  rot0: '#98a888', rot1: '#6f8064', rot2: '#4b5a48',

  // Grave cloth and wood.
  shroud0: '#7a5e52', shroud1: '#4a3a35', wood0: '#8a5a32', wood1: '#4f2e1a',

  // Iron.
  iron0: '#9aa0aa', iron1: '#5c6270', iron2: '#353a46',

  // Holy and ember VFX.
  holy0: '#fff6d0', sky0: '#c8f0ff', sky1: '#7ad8ff', sky2: '#3a6aa8',
  ember0: '#ffb648', ember1: '#ff8a2a', ember2: '#c84a14',
};

export const NAMES = Object.keys(PALETTE);
export const RGB = NAMES.map((n) => {
  const h = PALETTE[n];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
});
export const IDX = Object.fromEntries(NAMES.map((n, i) => [n, i]));

// Common ramps [light, base, dark].
export const RAMP = {
  cloth: ['cloth0', 'cloth1', 'cloth2'],
  crimson: ['blood0', 'blood1', 'blood2'],
  gold: ['gold0', 'gold1', 'gold2'],
  rot: ['rot0', 'rot1', 'rot2'],
  shroud: ['shroud0', 'shroud1', 'void'],
  bone: ['bone0', 'bone1', 'bone2'],
  iron: ['iron0', 'iron1', 'iron2'],
  wood: ['wood0', 'wood0', 'wood1'],
  stone: ['stone1', 'stone2', 'stone3'],
};
