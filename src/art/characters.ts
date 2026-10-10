import { P, darken, lighten } from './palette';
import { PixelCanvas, bayer, hash2 } from './pixel';
import { SheetBuilder } from './sheet';

// ---------------------------------------------------------------------------
// The Severed (player citizen)
// ---------------------------------------------------------------------------

export interface CitizenLook {
  skin: string;
  hair: string;
  hairStyle: number; // 0 short, 1 long, 2 shorn, 3 bun
  robe: string;
  trim: string;
  maw: boolean;
  helix: boolean;
}

export const SKIN_TONES = ['#f2c3a8', '#e3ad8c', '#c98d68', '#a36a4a', '#7a4b33', '#5a3726'];
export const HAIR_TONES = ['#2a1a14', '#5a3a22', '#8a5a2e', '#c9a45c', '#e8d6a8', '#6a6a70', '#8a2a1a', '#1a1a22'];
export const ROBE_TONES = ['#e9e2d2', '#ddd5c4', '#e8dcc0', '#d6d8d2'];
export const TRIM_TONES = [P.gold1, P.gold2, '#9ab0c8', '#c88a9a'];

type Dir = 'down' | 'up' | 'side';
type Arms = 'rest' | 'raise' | 'reach' | 'back';

interface Pose {
  step: number; // -1..1 leg phase
  bob: number; // body lift in px
  swing: number; // -1..1 arm swing
  arms: Arms;
}

const POSE_IDLE: Pose = { step: 0, bob: 0, swing: 0, arms: 'rest' };

function hem(pc: PixelCanvas, x0: number, x1: number, y: number, seed: number) {
  // Torn, blood-browned hem.
  for (let x = x0; x <= x1; x++) {
    if (hash2(x, y, seed) < 0.35) pc.erase(x, y);
    else if (hash2(x, y + 1, seed) < 0.5) pc.px(x, y, P.blood2);
    if (bayer(x, y - 1) < 0.35) pc.px(x, y - 1, darken(P.blood2, 0.1));
  }
}

function drawCitizen(look: CitizenLook, dir: Dir, pose: Pose): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  const b = pose.bob;
  const skin = look.skin;
  const skinD = darken(skin, 0.28);
  const robe = look.robe;
  const robeS = darken(robe, 0.2);
  const robeSS = darken(robe, 0.42);
  const hair = look.hair;
  const hairL = lighten(hair, 0.25);
  const hairD = darken(hair, 0.3);

  if (dir === 'down' || dir === 'up') {
    // Feet
    const fl = Math.round(pose.step);
    pc.rect(12, 27 + fl, 3, 2, skin);
    pc.rect(12, 28 + fl, 3, 1, skinD);
    pc.rect(17, 27 - fl, 3, 2, skin);
    pc.rect(17, 28 - fl, 3, 1, skinD);
    // Robe body
    pc.poly(
      [
        [11, 14 - b],
        [21, 14 - b],
        [23, 28],
        [9, 28],
      ],
      robe,
    );
    pc.map((x, y) => {
      if (y < 14 - b || y > 27) return null;
      if (x >= 19) return dir === 'up' ? robeSS : robeS;
      if (x <= 11) return dir === 'up' ? robeS : null;
      if ((x === 14 || x === 18) && y > 20 && bayer(x, y) < 0.6) return robeS;
      return null;
    });
    hem(pc, 8, 23, 27, 3);
    // Rope belt
    for (let x = 10; x <= 22; x++) pc.px(x, 20 - b, x % 2 ? look.trim : darken(look.trim, 0.3));
    if (dir === 'down') {
      // Collar
      pc.px(15, 14 - b, look.trim);
      pc.px(16, 15 - b, look.trim);
      pc.px(17, 14 - b, look.trim);
      pc.px(16, 14 - b, skinD);
    }
    // Arms
    const armY = 15 - b;
    const sw = Math.round(pose.swing);
    const drawArm = (side: -1 | 1) => {
      const ax = side < 0 ? 7 : 23;
      if (pose.arms === 'raise') {
        pc.rect(ax + (side < 0 ? 1 : -1), armY - 6, 3, 7, robe);
        pc.rect(ax + (side < 0 ? 1 : -1), armY - 8, 3, 2, skin);
        return;
      }
      if (pose.arms === 'reach') {
        pc.rect(side < 0 ? 10 : 19, armY + 3, 3, 6, robeS);
        pc.rect(side < 0 ? 12 : 18, armY + 9, 3, 2, skin);
        return;
      }
      if (pose.arms === 'back') {
        pc.rect(ax, armY - 1, 3, 6, robeS);
        pc.rect(ax, armY - 3, 3, 2, skin);
        return;
      }
      const o = side * sw;
      pc.rect(ax, armY + o, 3, 7, robeS);
      pc.rect(side < 0 ? ax + 2 : ax, armY + o, 1, 7, robeSS);
      pc.rect(ax, armY + 7 + o, 3, 2, skin);
      pc.px(ax + 1, armY + 8 + o, skinD);
    };
    drawArm(-1);
    drawArm(1);

    // Head
    const hy = 9 - b;
    pc.ellipse(16, hy, 5, 5, skin);
    pc.map((x, y) => (y >= hy - 5 && y <= hy + 5 && x >= 19 && pc.alphaAt(x, y) ? skinD : null));
    if (dir === 'down') {
      pc.px(14, hy + 1, P.ink);
      pc.px(18, hy + 1, P.ink);
      pc.px(14, hy + 2, P.blood1); // weeping
      pc.px(16, hy + 3, skinD);
    }
    // Hair
    const hairPx = (x: number, y: number) => {
      const top = y <= hy - 2;
      const sides = (x <= 11 || x >= 21) && y <= hy + 1;
      switch (look.hairStyle) {
        case 0:
          return dir === 'up' ? y <= hy + 3 : top || (sides && y <= hy - 1);
        case 1:
          return dir === 'up' ? true : top || sides;
        case 2:
          return dir === 'up' ? y <= hy - 3 : y <= hy - 4;
        default:
          return dir === 'up' ? y <= hy + 2 : top;
      }
    };
    for (let y = hy - 6; y <= hy + 5; y++) {
      for (let x = 10; x <= 22; x++) {
        const nx = (x - 16) / 5.5;
        const ny = (y - hy) / 5.5;
        if (nx * nx + ny * ny > 1) continue;
        if (!hairPx(x, y)) continue;
        pc.px(x, y, x >= 19 ? hairD : x <= 13 && y <= hy - 2 ? hairL : hair);
      }
    }
    if (look.hairStyle === 1) {
      // Long hair falls over the shoulders.
      pc.rect(10, hy, 2, 7, dir === 'up' ? hair : hairD);
      pc.rect(21, hy, 2, 7, hairD);
      if (dir === 'up') pc.rect(12, hy + 3, 9, 5, hair);
    }
    if (look.hairStyle === 3) pc.ellipse(16, hy - 6, 2, 2, hair);
    if (dir === 'up') {
      // The snapped tether knot at the nape.
      pc.px(16, 14 - b, P.blood1);
      pc.px(16, 15 - b, P.blood2);
      pc.px(15, 15 - b, P.blood1);
    }

    // Stigmata
    if (look.maw && dir === 'down') {
      pc.ellipse(16, 19 - b, 2, 2, P.blood1);
      pc.ellipse(16, 19 - b, 1, 1, P.ink);
      pc.px(16, 19 - b, P.bile0);
      pc.px(14, 17 - b, P.bone0);
      pc.px(18, 17 - b, P.bone0);
    }
    if (look.helix) {
      const ax = dir === 'down' ? 23 : 7;
      const ay = 19 - b + (pose.arms === 'rest' ? (dir === 'down' ? Math.round(pose.swing) : -Math.round(pose.swing)) : 0);
      if (pose.arms === 'rest') {
        pc.px(ax + 1, ay, P.flesh1);
        pc.px(ax + 2, ay, P.flesh2);
        pc.px(ax + 2, ay + 1, P.flesh3);
        pc.px(ax + 1, ay + 2, P.flesh2);
        pc.px(ax, ay + 1, P.flesh1);
        pc.px(ax + 1, ay + 1, P.blood2);
        pc.px(dir === 'down' ? ax + 3 : ax - 1, ay + 1, P.flesh2);
      }
    }
  } else {
    // Side (facing right)
    const s = pose.step;
    const f1 = Math.round(s * 2);
    pc.rect(13 - f1, 27, 3, 2, skinD);
    pc.rect(17 + f1, 27, 4, 2, skin);
    pc.rect(17 + f1, 28, 4, 1, skinD);
    pc.poly(
      [
        [12, 14 - b],
        [20, 14 - b],
        [22, 28],
        [10, 28],
      ],
      robe,
    );
    pc.map((x, y) => (y >= 14 - b && y <= 27 && x <= 13 ? robeS : null));
    hem(pc, 10, 21, 27, 7);
    for (let x = 12; x <= 20; x++) pc.px(x, 20 - b, x % 2 ? look.trim : darken(look.trim, 0.3));
    // Tether knot on the back of the neck
    pc.px(12, 14 - b, P.blood1);
    pc.px(11, 15 - b, P.blood2);

    const hy = 9 - b;
    pc.ellipse(16, hy, 4, 5, skin);
    pc.px(21, hy + 1, skin); // nose
    pc.px(18, hy, P.ink);
    pc.px(18, hy + 1, P.blood1);
    for (let y = hy - 6; y <= hy + 5; y++) {
      for (let x = 11; x <= 21; x++) {
        const nx = (x - 16) / 4.5;
        const ny = (y - hy) / 5.5;
        if (nx * nx + ny * ny > 1) continue;
        const back = x <= 15 && y <= hy + (look.hairStyle === 2 ? -3 : 2);
        const top = y <= hy - (look.hairStyle === 2 ? 4 : 3);
        if (back || top) pc.px(x, y, x <= 13 ? hairD : y <= hy - 3 ? hairL : hair);
      }
    }
    if (look.hairStyle === 1) pc.rect(11, hy, 4, 8, hairD);
    if (look.hairStyle === 3) pc.ellipse(12, hy - 4, 2, 2, hair);

    // Near arm
    const armY = 15 - b;
    if (pose.arms === 'raise') {
      pc.rect(14, armY - 7, 3, 8, robeS);
      pc.rect(14, armY - 9, 3, 2, skin);
    } else if (pose.arms === 'reach') {
      pc.rect(17, armY + 1, 6, 3, robeS);
      pc.rect(23, armY + 1, 2, 3, skin);
    } else if (pose.arms === 'back') {
      pc.rect(10, armY, 5, 3, robeS);
      pc.rect(8, armY, 2, 3, skin);
    } else {
      const o = Math.round(pose.swing * 2);
      pc.rect(15 + o, armY, 3, 7, robeS);
      pc.rect(15 + o, armY + 7, 3, 2, skin);
    }
    if (look.maw) {
      pc.px(20, 18 - b, P.blood1);
      pc.px(21, 19 - b, P.bile0);
      pc.px(20, 20 - b, P.blood1);
    }
    if (look.helix && pose.arms === 'rest') {
      const o = Math.round(pose.swing * 2);
      pc.px(15 + o, armY + 4, P.flesh2);
      pc.px(16 + o, armY + 4, P.flesh1);
      pc.px(16 + o, armY + 5, P.blood2);
      pc.px(17 + o, armY + 5, P.flesh2);
    }
  }
  pc.outline(P.ink);
  return pc;
}

function drawCitizenRoll(look: CitizenLook, i: number): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
  pc.ellipse(16, 21, 7, 6, (x, y) => (x + y > 38 ? darken(look.robe, 0.22) : look.robe));
  for (let x = 10; x <= 22; x++) if (hash2(x, i, 4) < 0.4) pc.px(x, 26, P.blood2);
  const hx = 16 + Math.cos(a) * 5;
  const hy = 20 + Math.sin(a) * 4;
  pc.ellipse(hx, hy, 3, 3, look.hairStyle === 2 ? look.skin : look.hair);
  pc.px(16 + Math.cos(a + 2) * 6, 21 + Math.sin(a + 2) * 5, look.skin);
  pc.px(16 + Math.cos(a + 3.5) * 6, 21 + Math.sin(a + 3.5) * 5, look.skin);
  pc.outline(P.ink);
  return pc;
}

function drawCitizenDead(look: CitizenLook): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  pc.ellipse(18, 25, 10, 3, look.robe);
  pc.map((x, y) => (y >= 26 ? darken(look.robe, 0.25) : null));
  pc.ellipse(6, 24, 4, 3, look.skin);
  pc.rect(3, 22, 5, 2, look.hair);
  pc.rect(20, 21, 6, 2, look.skin);
  for (let x = 9; x <= 27; x++) if (hash2(x, 1, 9) < 0.5) pc.px(x, 27, P.blood2);
  pc.outline(P.ink);
  return pc;
}

export function buildPlayerSheet(scene: Phaser.Scene, look: CitizenLook, key = 'player') {
  const sb = new SheetBuilder(key);
  for (const dir of ['down', 'up', 'side'] as Dir[]) {
    sb.add(`idle-${dir}`, [drawCitizen(look, dir, POSE_IDLE), drawCitizen(look, dir, { ...POSE_IDLE, bob: 1 })], 2);
    const walk = [0, 1, 0, -1].map((s, i) =>
      drawCitizen(look, dir, { step: s, bob: i % 2 === 0 ? 1 : 0, swing: -s, arms: 'rest' }),
    );
    sb.add(`walk-${dir}`, walk, 9);
    sb.add(`windup-${dir}`, [drawCitizen(look, dir, { ...POSE_IDLE, arms: 'back' })], 1, 0);
    sb.add(`strike-${dir}`, [drawCitizen(look, dir, { ...POSE_IDLE, arms: 'reach', step: 1 })], 1, 0);
    sb.add(`raise-${dir}`, [drawCitizen(look, dir, { ...POSE_IDLE, arms: 'raise' })], 1, 0);
  }
  sb.add('roll', [0, 1, 2, 3].map((i) => drawCitizenRoll(look, i)), 16);
  sb.add('dead', [drawCitizenDead(look)], 1, 0);
  sb.build(scene);
}

// ---------------------------------------------------------------------------
// The Blissful Blind — eyeless former Severed who hunt by sound.
// ---------------------------------------------------------------------------

type BlindPose = 'idle' | 'walk' | 'windup' | 'lunge' | 'stagger';

function drawBlind(pose: BlindPose, t: number): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  const sk = '#d8cdbb';
  const skD = '#a99a86';
  const skDD = '#76695a';
  const hunch = pose === 'lunge' ? 4 : pose === 'windup' ? -2 : pose === 'stagger' ? 3 : 1;
  const b = pose === 'idle' ? t : pose === 'walk' ? t % 2 : 0;
  // Legs
  const st = pose === 'walk' ? [0, 2, 0, -2][t] : pose === 'lunge' ? 3 : 0;
  pc.rect(12 - st, 22, 2, 6, skD);
  pc.rect(17 + st, 22, 2, 6, sk);
  pc.rect(11 - st, 27, 3, 1, skDD);
  pc.rect(17 + st, 27, 4, 1, skD);
  // Torso (hunched, ribs)
  const tx = 15 + hunch;
  pc.poly(
    [
      [tx - 4, 12 + b],
      [tx + 4, 13 + b],
      [19, 23],
      [11, 23],
    ],
    sk,
  );
  pc.map((x, y) => (y >= 12 && y <= 23 && x <= 12 ? skD : null));
  for (let y = 15 + b; y <= 19 + b; y += 2) pc.line(tx - 2, y, tx + 2, y + 1, skD);
  // Loincloth
  pc.rect(11, 21, 9, 3, P.cloth2);
  pc.px(13, 24, P.cloth2);
  pc.px(17, 24, P.cloth2);
  // Head, bowed forward
  const hx = tx + 3 + (pose === 'lunge' ? 2 : 0);
  const hy = 9 + b + (pose === 'stagger' ? 4 : 0);
  pc.ellipse(hx, hy, 4, 4, sk);
  pc.map((x, y) => (Math.abs(x - hx) <= 4 && Math.abs(y - hy) <= 4 && x <= hx - 2 ? skD : null));
  // Gouged eye + blood streaks, blissful grin
  pc.px(hx + 2, hy - 1, P.blood3);
  pc.px(hx + 3, hy - 1, P.blood2);
  pc.px(hx + 2, hy, P.blood1);
  pc.px(hx + 2, hy + 1, P.blood1);
  pc.px(hx + 3, hy + 2, P.ink);
  pc.px(hx + 2, hy + 3, P.ink);
  pc.px(hx + 1, hy + 3, P.bone0);
  pc.px(hx, hy + 2, P.ink);
  // Arms with long nails
  const ax = tx + 2;
  const ay = 13 + b;
  const nail = P.bone0;
  if (pose === 'windup') {
    pc.thickLine(ax, ay, ax - 2, ay - 8, 1, sk);
    pc.line(ax - 2, ay - 9, ax - 3, ay - 12, nail);
    pc.line(ax - 1, ay - 9, ax, ay - 12, nail);
  } else if (pose === 'lunge') {
    pc.thickLine(ax, ay, ax + 10, ay + 2, 1, sk);
    pc.line(ax + 11, ay + 1, ax + 14, ay, nail);
    pc.line(ax + 11, ay + 3, ax + 14, ay + 4, nail);
  } else {
    const sw = pose === 'walk' ? [0, 1, 0, -1][t] : 0;
    pc.thickLine(ax, ay, ax + 3 + sw, ay + 11, 1, sk);
    pc.line(ax + 3 + sw, ay + 12, ax + 4 + sw, ay + 15, nail);
    pc.line(ax + 5 + sw, ay + 12, ax + 6 + sw, ay + 14, nail);
  }
  pc.outline(P.ink);
  return pc;
}

function drawBlindCorpse(): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  pc.ellipse(15, 25, 9, 3, '#d8cdbb');
  pc.map((x, y) => (y >= 26 ? '#a99a86' : null));
  pc.ellipse(26, 24, 3, 3, '#d8cdbb');
  pc.px(27, 23, P.blood1);
  pc.rect(6, 23, 4, 1, P.bone0);
  pc.rect(10, 24, 8, 2, P.cloth2);
  pc.outline(P.ink);
  return pc;
}

/**
 * The Blind as Sanctum would have thee see them: serene saints in white,
 * eyes peacefully closed, haloed in gold.
 */
function sainted(src: PixelCanvas): PixelCanvas {
  const swap: Record<string, string> = {
    '#d8cdbb': P.marble0,
    '#a99a86': P.marble1,
    '#76695a': P.marble2,
    [P.cloth2]: P.marble0,
    [P.blood1]: P.marble1,
    [P.blood2]: P.marble1,
    [P.blood3]: P.marble2,
    [P.bone0]: P.gold1,
  };
  const out = new PixelCanvas(src.w, src.h);
  out.blit(src, 0, 0);
  out.map((_x, _y, r, g, b) => {
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    return swap[hex] ?? null;
  });
  // Find the head (topmost opaque pixel) and crown it with a halo
  let top = -1;
  let hx = 16;
  for (let y = 0; y < out.h && top < 0; y++)
    for (let x = 0; x < out.w; x++)
      if (out.alphaAt(x, y) && out.data[(y * out.w + x) * 4] > 30) {
        top = y;
        hx = x;
        break;
      }
  if (top >= 2) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      out.px(hx + 1 + Math.round(Math.cos(ang) * 5), top - 1 + Math.round(Math.sin(ang) * 2), P.gold1);
    }
  }
  return out;
}

export function buildBlindSheet(scene: Phaser.Scene) {
  new SheetBuilder('blind-saint')
    .add('idle', [sainted(drawBlind('idle', 0)), sainted(drawBlind('idle', 1))], 2)
    .add('walk', [0, 1, 2, 3].map((t) => sainted(drawBlind('walk', t))), 8)
    .add('windup', [sainted(drawBlind('windup', 0))], 1, 0)
    .add('attack', [sainted(drawBlind('lunge', 0))], 1, 0)
    .add('stagger', [sainted(drawBlind('stagger', 0))], 1, 0)
    .add('dead', [sainted(drawBlindCorpse())], 1, 0)
    .build(scene);
  new SheetBuilder('blind')
    .add('idle', [drawBlind('idle', 0), drawBlind('idle', 1)], 2)
    .add('walk', [0, 1, 2, 3].map((t) => drawBlind('walk', t)), 8)
    .add('windup', [drawBlind('windup', 0)], 1, 0)
    .add('attack', [drawBlind('lunge', 0)], 1, 0)
    .add('stagger', [drawBlind('stagger', 0)], 1, 0)
    .add('dead', [drawBlindCorpse()], 1, 0)
    .build(scene);
}

// ---------------------------------------------------------------------------
// The Bile Gossip — a bloated, many-mouthed thing that spits petty lies.
// ---------------------------------------------------------------------------

function drawGossip(pose: 'idle' | 'walk' | 'windup' | 'spit' | 'stagger', t: number): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  const swell = pose === 'windup' ? 2 : pose === 'idle' ? t : 0;
  const cy = 19 - (pose === 'walk' ? t : 0);
  const st = pose === 'walk' ? (t ? 1 : -1) : 0;
  pc.rect(11 + st, 25, 3, 3, P.flesh2);
  pc.rect(18 - st, 25, 3, 3, P.flesh2);
  pc.ellipse(16, cy, 9 + swell, 8 + swell, (x, y, nx, ny) => {
    if (nx * 0.7 + ny * 0.7 > 0.55) return P.flesh2;
    if (nx < -0.5 && ny < -0.2) return P.flesh0;
    return P.flesh1;
  });
  // Veins
  pc.line(9, cy - 2, 12, cy + 3, P.flesh3);
  pc.line(21, cy - 4, 23, cy + 1, P.flesh3);
  // Sewn upper mouth
  const mo = pose === 'spit' ? 3 : pose === 'windup' ? 1 : 0;
  pc.rect(12, cy - 5, 9, 1 + mo, mo ? P.ink : P.flesh3);
  if (mo) {
    pc.rect(13, cy - 5, 7, mo, P.bile1);
    pc.px(16, cy - 4, P.bile0);
  }
  for (let x = 12; x <= 20; x += 2) {
    pc.px(x, cy - 6, P.ink);
    pc.px(x, cy - 4 + mo, P.ink);
  }
  // Belly mouth with teeth
  pc.rect(13, cy + 2, 7, 3, P.ink);
  for (let x = 13; x <= 19; x += 2) {
    pc.px(x, cy + 2, P.bone0);
    pc.px(x + 1, cy + 4, P.bone0);
  }
  // Tiny weeping eyes
  pc.px(10, cy - 2, P.ink);
  pc.px(10, cy - 1, P.tear1);
  pc.px(22, cy - 3, P.ink);
  if (pose === 'stagger') {
    pc.line(8, cy - 1, 24, cy + 1, P.blood1);
  }
  pc.outline(P.ink);
  return pc;
}

function drawGossipCorpse(): PixelCanvas {
  const pc = new PixelCanvas(32, 32);
  pc.ellipse(16, 25, 11, 4, (_x, y) => (y > 25 ? P.flesh2 : P.flesh1));
  pc.rect(12, 24, 8, 1, P.ink);
  pc.ellipse(22, 27, 3, 1, P.bile1);
  pc.outline(P.ink);
  return pc;
}

export function buildGossipSheet(scene: Phaser.Scene) {
  new SheetBuilder('gossip')
    .add('idle', [drawGossip('idle', 0), drawGossip('idle', 1)], 3)
    .add('walk', [drawGossip('walk', 0), drawGossip('walk', 1)], 5)
    .add('windup', [drawGossip('windup', 0)], 1, 0)
    .add('attack', [drawGossip('spit', 0)], 1, 0)
    .add('stagger', [drawGossip('stagger', 0)], 1, 0)
    .add('dead', [drawGossipCorpse()], 1, 0)
    .build(scene);
}

// ---------------------------------------------------------------------------
// The Lacquered Penitent — a brute wearing a confessional booth as armour.
// ---------------------------------------------------------------------------

function drawPenitent(pose: 'idle' | 'walk' | 'windup' | 'slam' | 'stagger', t: number): PixelCanvas {
  const pc = new PixelCanvas(48, 48);
  const b = pose === 'idle' ? t : pose === 'walk' ? t % 2 : 0;
  const st = pose === 'walk' ? [0, 2, 0, -2][t] : 0;
  // Legs (bare, scarred)
  pc.rect(17 - st, 38, 4, 7, P.flesh2);
  pc.rect(27 + st, 38, 4, 7, P.flesh1);
  pc.rect(16 - st, 44, 6, 2, P.flesh3);
  pc.rect(27 + st, 44, 6, 2, P.flesh3);
  // Booth-armour: a carved mahogany box worn over the torso
  const top = 8 - b + (pose === 'stagger' ? 3 : 0);
  pc.rect(12, top, 24, 31, P.wood1);
  pc.rect(12, top, 24, 3, P.wood0);
  pc.rect(33, top + 3, 3, 28, P.wood2);
  pc.rect(12, top + 3, 2, 28, P.wood0);
  // Peaked roof with a little gold cross
  pc.poly(
    [
      [10, top + 1],
      [24, top - 6],
      [38, top + 1],
    ],
    P.wood2,
  );
  pc.line(24, top - 10, 24, top - 6, P.gold1);
  pc.line(22, top - 9, 26, top - 9, P.gold1);
  // Lattice grille over the face
  pc.rect(17, top + 5, 14, 9, P.ink);
  for (let x = 17; x <= 30; x++) for (let y = top + 5; y <= top + 13; y++) if ((x + y) % 3 === 0) pc.px(x, y, P.wood0);
  pc.px(22, top + 9, P.candle);
  pc.px(26, top + 9, P.candle);
  // Carved panel
  pc.strokeRect(16, top + 17, 16, 10, P.wood2);
  pc.strokeRect(18, top + 19, 12, 6, P.wood0);
  // Brass censer arm
  const ax = 36;
  const ay = top + 14;
  let cx = 42;
  let cy = top + 26;
  if (pose === 'windup') {
    cx = 30;
    cy = top - 12;
  } else if (pose === 'slam') {
    cx = 40;
    cy = 42;
  }
  pc.thickLine(ax, ay, Math.min(ax + 4, cx), ay + 4, 1, P.flesh2);
  pc.line(ax + 3, ay + 4, cx, cy - 3, P.iron0);
  pc.ellipse(cx, cy, 4, 4, (x, y) => (x < cx ? P.brass0 : P.brass1));
  pc.rect(cx - 4, cy, 9, 1, P.brass2);
  pc.px(cx - 1, cy - 1, P.candle);
  pc.outline(P.ink);
  if (pose === 'slam') {
    for (let i = 0; i < 10; i++) pc.px(34 + hash2(i, 0, 3) * 14, 40 + hash2(i, 1, 3) * 7, P.smoke0);
  }
  return pc;
}

function drawPenitentCorpse(): PixelCanvas {
  const pc = new PixelCanvas(48, 48);
  pc.rect(8, 34, 30, 10, P.wood1);
  pc.rect(8, 34, 30, 2, P.wood0);
  pc.rect(14, 36, 10, 6, P.ink);
  pc.ellipse(40, 41, 4, 3, P.brass1);
  pc.rect(4, 40, 5, 3, P.flesh2);
  for (let i = 0; i < 6; i++) pc.px(10 + i * 4, 44, P.blood2);
  pc.outline(P.ink);
  return pc;
}

export function buildPenitentSheet(scene: Phaser.Scene) {
  new SheetBuilder('penitent')
    .add('idle', [drawPenitent('idle', 0), drawPenitent('idle', 1)], 2)
    .add('walk', [0, 1, 2, 3].map((t) => drawPenitent('walk', t)), 6)
    .add('windup', [drawPenitent('windup', 0)], 1, 0)
    .add('attack', [drawPenitent('slam', 0)], 1, 0)
    .add('stagger', [drawPenitent('stagger', 0)], 1, 0)
    .add('dead', [drawPenitentCorpse()], 1, 0)
    .build(scene);
}

// ---------------------------------------------------------------------------
// Hub NPCs
// ---------------------------------------------------------------------------

function drawMagdalene(t: number): PixelCanvas {
  const pc = new PixelCanvas(64, 56);
  // Loom of hair: a frame strung with long dark strands
  pc.rect(4, 6, 3, 46, P.wood1);
  pc.rect(57, 6, 3, 46, P.wood1);
  pc.rect(4, 4, 56, 3, P.wood0);
  pc.rect(4, 48, 56, 3, P.wood2);
  for (let x = 8; x <= 56; x += 2) {
    const sway = Math.round(Math.sin(x * 0.4 + t * 1.5) * 1);
    pc.line(x, 7, x + sway, 47, x % 4 ? '#3a2418' : '#5a3a22');
  }
  // Her body seated at the loom: veiled, pale, hunched
  pc.ellipse(32, 38, 10, 10, P.veil0);
  pc.map((x, y) => (y > 30 && x > 36 && y < 50 ? P.veil1 : null));
  pc.ellipse(32, 23, 6, 7, P.veil0);
  pc.ellipse(32, 25, 4, 4, '#e8dccb');
  pc.px(30, 25, P.ink);
  pc.px(34, 25, P.ink);
  pc.px(30, 26, P.blood1);
  pc.px(34, 26, P.blood1);
  pc.line(31, 28, 33, 28, P.flesh3);
  // Six arms working the threads
  const arms: [number, number, number, number][] = [
    [24, 32, 12, 26],
    [24, 36, 10, 38],
    [25, 40, 14, 46],
    [40, 32, 52, 26],
    [40, 36, 54, 38],
    [39, 40, 50, 46],
  ];
  arms.forEach(([x0, y0, x1, y1], i) => {
    const w = Math.round(Math.sin(t * Math.PI + i) * 2);
    pc.thickLine(x0, y0, x1, y1 + w, 0.6, '#e8dccb');
    pc.px(x1, y1 + w, P.flesh2);
    pc.line(x1, y1 + w, 32, 46, P.blood2);
  });
  pc.outline(P.ink);
  return pc;
}

function drawVivisect(t: number): PixelCanvas {
  const pc = new PixelCanvas(32, 40);
  const b = t;
  pc.rect(12, 33, 3, 5, P.iron1);
  pc.rect(18, 33, 3, 5, P.iron1);
  // Butcher-surgeon smock, stained
  pc.poly(
    [
      [10, 14 - b],
      [22, 14 - b],
      [24, 34],
      [8, 34],
    ],
    '#b6ad9a',
  );
  pc.map((x, y) => {
    if (y < 14 || y > 34) return null;
    if (hash2(x, y, 11) < 0.25) return P.blood2;
    if (x > 19) return '#8a8270';
    return null;
  });
  // Barbed wire wrapping
  for (let y = 16; y <= 32; y += 4) {
    for (let x = 8; x <= 24; x++) {
      const yy = y + Math.round(Math.sin(x * 0.8) * 1) - b;
      pc.px(x, yy, P.iron0);
      if (x % 4 === 0) {
        pc.px(x, yy - 1, P.iron0);
        pc.px(x, yy + 1, P.iron2);
      }
    }
  }
  // Head: mask with wire
  pc.ellipse(16, 9 - b, 5, 5, '#c9b9a0');
  pc.rect(12, 9 - b, 9, 3, '#6a6a70');
  pc.px(14, 8 - b, P.ink);
  pc.px(18, 8 - b, P.candle);
  for (let x = 11; x <= 21; x += 2) pc.px(x, 5 - b, P.iron0);
  // Bone saw in hand
  pc.rect(24, 20 - b, 2, 8, '#c9b9a0');
  pc.rect(25, 12 - b, 2, 9, P.iron0);
  for (let y = 12; y <= 20; y += 2) pc.px(27, y - b, P.iron0);
  pc.outline(P.ink);
  return pc;
}

function drawHollow(t: number): PixelCanvas {
  const pc = new PixelCanvas(32, 40);
  const b = t;
  // Hooded skeletal merchant leaning on a crook strung with tear-vials
  pc.poly(
    [
      [11, 12 - b],
      [21, 12 - b],
      [25, 37],
      [7, 37],
    ],
    '#3a2f2a',
  );
  pc.map((x, y) => (y >= 12 && x > 19 ? '#261e1a' : null));
  pc.ellipse(16, 10 - b, 6, 6, '#3a2f2a');
  pc.ellipse(16, 11 - b, 4, 4, P.bone1);
  pc.rect(14, 10 - b, 2, 2, P.ink);
  pc.rect(17, 10 - b, 2, 2, P.ink);
  pc.px(14, 10 - b, P.tear1);
  pc.line(14, 14 - b, 18, 14 - b, P.ink);
  // Ribcage visible through torn robe
  for (let y = 18; y <= 24; y += 2) pc.line(13, y - b, 18, y - b, P.bone1);
  // Crook
  pc.line(5, 6, 5, 38, P.wood1);
  pc.line(5, 6, 9, 3, P.wood1);
  pc.line(9, 3, 10, 6, P.wood1);
  for (let i = 0; i < 3; i++) {
    const y = 10 + i * 5 + (i === 1 ? b : 0);
    pc.px(5 - 1, y, P.tear0);
    pc.px(5 - 1, y + 1, P.tear1);
  }
  pc.line(7, 22 - b, 10, 22 - b, P.bone1); // bony hand
  pc.outline(P.ink);
  return pc;
}

export function buildNpcSheets(scene: Phaser.Scene) {
  new SheetBuilder('magdalene').add('idle', [0, 1, 2, 3].map((t) => drawMagdalene(t)), 3).build(scene);
  new SheetBuilder('vivisect').add('idle', [drawVivisect(0), drawVivisect(1)], 2).build(scene);
  new SheetBuilder('hollow').add('idle', [drawHollow(0), drawHollow(1)], 2).build(scene);
}

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

