// The master palette. Every sprite pixel must be one of these; the exporter
// in tools/sprites.mjs enforces it.
//
// v2: hue-shifted 5-step ramps (highlights warm, shadows cool and violet),
// in the Otherworld Legends manner. Ramps run light -> dark.
const R = {
  ink: ['#0b0710', '#150f1c', '#1f1828', '#2a2236', '#383047'],
  crimson: ['#ff7a66', '#e8383f', '#b51d36', '#7d1233', '#4a0b2a'],
  cloth: ['#fffaf0', '#e8e0d2', '#c2b6aa', '#918599', '#5f566f'],
  gold: ['#fff4b0', '#ffd155', '#e09a2c', '#a8601e', '#6b3518'],
  bone: ['#fffbea', '#eadfc4', '#c9b897', '#9a8770', '#665848'],
  rot: ['#c4dc9e', '#94b37a', '#6b8c60', '#48654c', '#2c4038'],
  shroud: ['#a8876f', '#7c5f50', '#57413d', '#3a2a30', '#22181f'],
  iron: ['#eef2f7', '#b2bccb', '#7c88a0', '#525b75', '#30364b'],
  wood: ['#d6955a', '#a2643a', '#733f28', '#4a261c', '#2b1514'],
  stone: ['#a59fb0', '#837d92', '#655f76', '#4b465b', '#353143'],
  slate: ['#6f7a8c', '#566073', '#424a5c', '#313747', '#222634'],
  moss: ['#b6d36a', '#7fa548', '#557a37', '#36542b', '#213622'],
  flame: ['#f4ffd8', '#b8ff8f', '#5fdc6c', '#2c9e55', '#155c3c'],
  ember: ['#fff3b0', '#ffc04a', '#ff7a1f', '#d6401a', '#8a1f1a'],
  holy: ['#ffffff', '#d8f7ff', '#8ae0ff', '#3fa4f0', '#2a5cc0'],
  blood: ['#ff5a4a', '#e0202e', '#a8102a', '#6a0a22', '#3a0618'],
  violet: ['#d4b0ff', '#9a6ae6', '#6a44b8', '#432a80', '#271a4d'],
  sand: ['#f2dcb6', '#cfae86', '#a28166', '#755c4f', '#4b3a3a'],
  skin: ['#ffdcbf', '#f0aa84', '#c97b60', '#8f5048', '#57303a'],
  roof: ['#c36a5a', '#93453f', '#6a2e33', '#47202a', '#2a1420'],
  // v4: warm torch-lit flagstones, brick mouldings and teal-grey walls.
  flag: ['#dcc8b2', '#b8a08e', '#937d73', '#6e5a58', '#4b3c42'],
  brick: ['#e8a27a', '#bf7056', '#8f4c42', '#613234', '#3c2028'],
  teal: ['#8eaeab', '#67888a', '#4a6670', '#334956', '#22323f'],
  pot: ['#f0d9b5', '#d0ae86', '#a6806a', '#7a5a52', '#4f3a3c'],
  // Round 18: the pink of the Bloodrose Keys.
  rose: ['#ffe0f0', '#ff9ccf', '#e85aa6', '#a8336f', '#5c1a44'],
};

// v3: each 5-step ramp gains in-between tones, giving 9 shades per material.
// The original steps keep their names (gold0..gold4); the in-betweens are
// gold0h..gold3h.
const mix = (a, b) => '#' + [1, 3, 5].map((i) => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
export const RAMPS = R;
export const PALETTE = {};
export const FINE = {};
for (const [name, ramp] of Object.entries(R)) {
  FINE[name] = [];
  ramp.forEach((hex, i) => {
    PALETTE[`${name}${i}`] = hex; FINE[name].push(`${name}${i}`);
    if (i < ramp.length - 1) { PALETTE[`${name}${i}h`] = mix(hex, ramp[i + 1]); FINE[name].push(`${name}${i}h`); }
  });
}
PALETTE.outline = R.ink[0];
PALETTE.white = '#ffffff';

export const NAMES = Object.keys(PALETTE);
export const RGB = NAMES.map((n) => {
  const h = PALETTE[n];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
});
export const IDX = Object.fromEntries(NAMES.map((n, i) => [n, i]));
// A ramp as palette indices, light -> dark (9 steps).
export const ramp = (name) => FINE[name].map((n) => IDX[n]);
