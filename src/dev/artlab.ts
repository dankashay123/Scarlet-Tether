// Developer art lab: renders generated sprites at large scale (web/art.html).
import { drawHero, STAND, FW, FH } from '../art/hero';
import { runCycle } from '../art/rig';
import type { PixelCanvas } from '../art/pixel';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('s') || 3);
const look = { skin: '#e3ad8c', hair: '#5a3a22', hairStyle: 1, robe: '#e8dcc0', trim: '#e8c25a', maw: params.has('maw'), helix: params.has('helix') };

const frames: PixelCanvas[] = [];
frames.push(drawHero({ look, pose: STAND }).pc);
for (let i = 0; i < 4; i++) frames.push(drawHero({ look, pose: runCycle(STAND, i / 8, 0.62, 0.95) }).pc);
frames.push(drawHero({ look: { ...look, hairStyle: 2, skin: '#7a4b33' }, pose: STAND }).pc);

const cols = Math.min(frames.length, 6);
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = cols * FW * scale;
c.height = Math.ceil(frames.length / cols) * FH * scale;
const ctx = c.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#3a3036';
ctx.fillRect(0, 0, c.width, c.height);
frames.forEach((f, i) => ctx.drawImage(f.toCanvas(), (i % cols) * FW * scale, Math.floor(i / cols) * FH * scale, FW * scale, FH * scale));
