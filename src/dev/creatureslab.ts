// Developer lab for creature sprites (web/art-creatures.html).
// ?s=<scale>  ?only=<key,key>
import { creatureGallery } from '../art/creatures';

const params = new URLSearchParams(location.search);
const scale = Number(params.get('s') || 2);
const only = params.get('only')?.split(',');
const sheets = creatureGallery().filter((s) => !only || only.includes(s.key));

const PAD = 6;
const LABEL = 14;
const maxW = 2400;
// Layout: one block per sheet, frames flowing left to right with anim labels.
interface Cell { x: number; y: number; img: HTMLCanvasElement; w: number; h: number; label?: string }
const cells: Cell[] = [];
const heads: { x: number; y: number; text: string }[] = [];
let y = 0;
for (const s of sheets) {
  heads.push({ x: 4, y: y + 12, text: `${s.key}  ${s.w}x${s.h}  ${s.ms.toFixed(0)}ms` });
  y += LABEL + 4;
  let x = PAD;
  let rowH = s.h * scale + LABEL;
  for (const a of s.anims) {
    a.frames.forEach((fr, i) => {
      const w = s.w * scale;
      if (x + w > maxW) { x = PAD; y += rowH + PAD; }
      cells.push({ x, y: y + LABEL, img: fr.toCanvas(), w, h: s.h * scale, label: i === 0 ? `${a.name} (${a.frames.length})` : undefined });
      x += w + PAD;
    });
  }
  y += rowH + PAD * 2;
}
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = maxW;
c.height = y;
const ctx = c.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
ctx.fillStyle = '#3a3036';
ctx.fillRect(0, 0, c.width, c.height);
ctx.font = '12px monospace';
for (const cl of cells) {
  ctx.fillStyle = '#2e262b';
  ctx.fillRect(cl.x, cl.y, cl.w, cl.h);
  ctx.drawImage(cl.img, cl.x, cl.y, cl.w, cl.h);
  if (cl.label) { ctx.fillStyle = '#d8c8a8'; ctx.fillText(cl.label, cl.x, cl.y - 3); }
}
ctx.fillStyle = '#ffd27a';
for (const h of heads) ctx.fillText(h.text, h.x, h.y);
console.log(sheets.map((s) => `${s.key}:${s.ms.toFixed(0)}ms`).join(' '));
