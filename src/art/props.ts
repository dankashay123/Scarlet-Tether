import { P } from './palette';
import { PixelCanvas, bayer, hash2, registerImage } from './pixel';
import { SheetBuilder } from './sheet';
import { Figure, KEY_LIGHT, grain } from './render';
import { BLOOD, IRON, RUST } from './hero';

// Small pieces shared by every scene: pickups, projectiles, the chain,
// lights and particles. Big set dressing lives in environment.ts.

function tearPickup(f: number): PixelCanvas {
  const pc = new PixelCanvas(9, 12);
  pc.ellipse(4, 7, 3, 3, P.tear1);
  pc.px(4, 2, P.tear1);
  pc.px(4, 3, P.tear1);
  pc.px(3, 4, P.tear1);
  pc.px(5, 4, P.tear1);
  pc.px(5, 8, P.tear2);
  pc.px(4, 9, P.tear2);
  pc.px(3, 6, f ? P.white : P.tear0);
  if (f) pc.px(2, 5, P.white);
  pc.outline(P.ink);
  return pc;
}

function vertebra(): PixelCanvas {
  const f = new Figure(16, 12);
  const bone = { ramp: ['#2a2012', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf'], tex: grain(1.5, 0.1, 2) };
  f.ellipse(8, 7, 4, 3, bone, 1);
  f.capsule(2, 6, 14, 6, 1.4, 1.4, bone, 0);
  f.capsule(8, 2, 8, 6, 1.4, 1.2, bone, 0);
  f.ellipse(8, 7, 1.4, 1.2, { ramp: ['#1a0d10', '#3a2416'] }, 2);
  return f.render(KEY_LIGHT);
}

/** A Reliquary Shard: a gilded fragment of a heart-shaped reliquary, a garnet set in it. */
function relicShard(): PixelCanvas {
  const f = new Figure(16, 18);
  const gold = { ramp: ['#2a1a06', '#5e3e10', '#9a6a1e', '#d0a040', '#f4d886', '#fff6d0'], spec: 1, tex: grain(1.2, 0.08, 4) };
  const gem = { ramp: ['#1a0206', '#4e0814', '#8e1020', '#d0283a', '#ff8a8a'], spec: 1 };
  // Half a heart, broken along a jagged seam
  f.poly([[8, 16], [2, 9], [2, 5], [5, 2], [8, 4], [10, 2], [13, 4], [11, 7], [12, 10], [9, 12], [10, 14]], gold, 1);
  f.ellipse(6.5, 7.5, 2.4, 2.6, gem, 2);
  f.capsule(4, 12, 6, 14, 0.6, 0.6, gold, 2);
  return f.render(KEY_LIGHT);
}

/** A Mark of Contrition: a crimson wax seal pressed with a thorned cross, a gilt rim. */
function markSeal(): PixelCanvas {
  const f = new Figure(16, 16);
  const wax = { ramp: ['#1e0206', '#4a0812', '#7e1020', '#b0202e', '#e05050'], spec: 0.7 };
  const gold = { ramp: ['#2a1a06', '#6a4812', '#b08030', '#e8c060', '#fff0b0'], spec: 1 };
  f.ellipse(8, 8, 6.6, 6.6, gold, 1);
  f.ellipse(8, 8, 5.4, 5.4, wax, 2);
  f.capsule(8, 4.5, 8, 11.5, 0.9, 0.9, wax, 3);
  f.capsule(5.5, 7, 10.5, 7, 0.9, 0.9, wax, 3);
  // A drip of wax escaping the rim
  f.capsule(11, 12, 12, 15, 1.1, 0.8, wax, 2.5);
  return f.render(KEY_LIGHT);
}

function projectile(kind: 'bile' | 'sludge'): PixelCanvas {
  const s = kind === 'sludge' ? 14 : 10;
  const f = new Figure(s, s);
  const m =
    kind === 'bile'
      ? { ramp: ['#2a2a08', '#555418', '#8d8a2e', '#c7c25a', '#f0ee9a'], spec: 0.9 }
      : { ramp: ['#1a2006', '#3a4a10', '#5f7a1a', '#8db02a', '#d0f06a'], spec: 0.9 };
  f.ellipse(s / 2, s / 2, s / 2 - 1.5, s / 2 - 2, m, 1);
  f.ellipse(s / 2 - 2, s / 2 + 1, 1.5, 1.5, m, 2);
  return f.render(KEY_LIGHT);
}

function sludgeWave(f: number): PixelCanvas {
  // A rolling crest of acid sludge, foaming with half-dissolved faces
  const fig = new Figure(30, 22);
  const m = { ramp: ['#141a06', '#2f3d0e', '#4f6a16', '#7d9a22', '#b8d84a', '#e8ff9a'], spec: 0.8, tex: grain(1.5, 0.15, f + 3) };
  fig.poly(
    [
      [0, 22],
      [2, 12],
      [8, 4 + f],
      [16, 1],
      [24, 5 - f],
      [29, 14],
      [30, 22],
    ],
    m,
    1,
  );
  for (let i = 0; i < 4; i++) fig.ellipse(6 + i * 6, 6 + ((i + f) % 2) * 3, 1.6, 1.6, m, 2);
  fig.ellipse(15, 13, 2.4, 2.8, { ramp: ['#2a2012', '#9a845a', '#cdb889'] }, 2);
  return fig.render(KEY_LIGHT);
}

function chainLink(): PixelCanvas {
  const f = new Figure(7, 5);
  f.ellipse(3, 2, 3, 2, IRON, 1);
  f.ellipse(3, 2, 1.2, 0.6, { ramp: ['#0b0507'] }, 2);
  return f.render(KEY_LIGHT, '#0b0507');
}

function chainHead(): PixelCanvas {
  // The Severed Tether's end: a rusted shackle grafted with vertebrae
  const f = new Figure(18, 18);
  f.ellipse(9, 9, 7, 7, IRON, 1);
  f.ellipse(9, 9, 3, 3, { ramp: ['#0b0507', '#1a0d10'] }, 2);
  f.stain((x, y) => hash2(x | 0, y | 0, 3) < 0.35, RUST, [IRON]);
  const bone = { ramp: ['#2a2012', '#5f4e35', '#9a845a', '#cdb889', '#efe3bf'] };
  f.ellipse(15, 5, 2.4, 2, bone, 3);
  f.ellipse(3, 13, 2.2, 1.8, bone, 3);
  f.stain((x, y) => hash2(x | 0, y | 0, 9) < 0.18, BLOOD);
  return f.render(KEY_LIGHT);
}

function thorns(up: boolean): PixelCanvas {
  const pc = new PixelCanvas(16, 16);
  for (let i = 0; i < 5; i++) {
    const x = 1 + i * 3;
    const h = up ? 8 + (i % 2) * 4 : 1;
    pc.line(x, 15, x, 16 - h, P.iron0);
    pc.px(x + 1, 15, P.iron2);
    if (up) pc.px(x, 15 - h, P.blood1);
  }
  return pc;
}

function malicePool(f: number): PixelCanvas {
  // Side view: a low boiling slick of malice with faces breaching it
  const pc = new PixelCanvas(40, 14);
  for (let x = 0; x < 40; x++) {
    const top = 8 - Math.round(Math.sin(x * 0.5 + f * 2) * 1.5) - (x > 4 && x < 36 ? 2 : 0);
    for (let y = top; y < 14; y++) pc.px(x, y, y === top ? P.bile0 : (x + y + f) % 5 === 0 ? P.bile1 : P.bile2);
  }
  const faces = f ? [10, 27] : [16, 31];
  for (const fx of faces) {
    pc.ellipse(fx, 6, 3, 3, P.bone1);
    pc.px(fx - 1, 5, P.ink);
    pc.px(fx + 1, 5, P.ink);
    pc.ellipse(fx, 7.5, 1, 1 + f * 0.6, P.ink);
  }
  pc.outline(P.ink);
  return pc;
}

function softDot(r: number, color: string): PixelCanvas {
  const pc = new PixelCanvas(r * 2 + 1, r * 2 + 1);
  pc.ellipse(r, r, r, r, (x, y, nx, ny) => (nx * nx + ny * ny < 0.4 || bayer(x, y) < 0.5 ? color : null));
  return pc;
}

function light(r: number): PixelCanvas {
  const pc = new PixelCanvas(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++)
    for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x - r + 0.5, y - r + 0.5) / r;
      if (d < 1) pc.px(x, y, '#ffffff', Math.pow(1 - d, 2));
    }
  return pc;
}

function ladder(): PixelCanvas {
  // Rough mahogany rails and rungs, nailed together, bloodied by many hands
  const f = new Figure(16, 16);
  const wood = { ramp: ['#1a0c08', '#341510', '#56251a', '#7d3b25', '#a8583a'], tex: grain(1.5, 0.12, 4) };
  f.capsule(3, -1, 3, 17, 1.6, 1.6, wood, 1);
  f.capsule(12, -1, 12, 17, 1.6, 1.6, wood, 1);
  f.capsule(3, 4, 12, 4, 1.1, 1.1, wood, 2);
  f.capsule(3, 12, 12, 12, 1.1, 1.1, wood, 2);
  f.stain((x, y) => hash2(x | 0, y | 0, 5) < 0.08, BLOOD);
  return f.render(KEY_LIGHT);
}

function hangingChain(): PixelCanvas {
  const f = new Figure(16, 16);
  for (let i = 0; i < 4; i++) {
    const y = i * 4 + 2;
    if (i % 2) f.ellipse(8, y, 1.4, 2.6, IRON, 1);
    else f.ellipse(8, y, 2.6, 2.2, IRON, 1);
  }
  return f.render(KEY_LIGHT);
}

export function buildProps(scene: Phaser.Scene) {
  registerImage(scene, 'ladder', ladder());
  registerImage(scene, 'hang-chain', hangingChain());
  new SheetBuilder('tear').add('spin', [tearPickup(0), tearPickup(1)], 3).build(scene);
  registerImage(scene, 'vertebra', vertebra());
  registerImage(scene, 'relic-shard', relicShard());
  registerImage(scene, 'mark-seal', markSeal());
  registerImage(scene, 'proj-bile', projectile('bile'));
  registerImage(scene, 'proj-sludge', projectile('sludge'));
  new SheetBuilder('wave').add('roll', [sludgeWave(0), sludgeWave(1)], 8).build(scene);
  registerImage(scene, 'proj-wave', sludgeWave(0));
  registerImage(scene, 'chain-link', chainLink());
  registerImage(scene, 'chain-head', chainHead());
  registerImage(scene, 'thorns-down', thorns(false));
  registerImage(scene, 'thorns-up', thorns(true));
  new SheetBuilder('malice').add('boil', [malicePool(0), malicePool(1)], 4).build(scene);
  registerImage(scene, 'smoke', softDot(4, P.smoke0));
  registerImage(scene, 'light-sm', light(16));
  registerImage(scene, 'light-lg', light(48));
  const px = new PixelCanvas(2, 2);
  px.rect(0, 0, 2, 2, '#ffffff');
  registerImage(scene, 'px', px);
  const px1 = new PixelCanvas(1, 1);
  px1.px(0, 0, '#ffffff');
  registerImage(scene, 'px1', px1);
}
