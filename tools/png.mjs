// Minimal PNG encoder for palette-indexed frames ({ w, h, px }).
import { deflateSync } from 'node:zlib';
import { RGB } from './palette.mjs';

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function png(frame, scale = 1, bg = null) {
  const w = frame.w * scale, h = frame.h * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = frame.px[Math.floor(y / scale) * frame.w + Math.floor(x / scale)];
      const o = y * (w * 4 + 1) + 1 + x * 4;
      if (i < 0) { if (bg) { raw[o] = bg[0]; raw[o + 1] = bg[1]; raw[o + 2] = bg[2]; raw[o + 3] = 255; } continue; }
      const rgb = RGB[i];
      if (!rgb) throw new Error(`off-palette pixel index ${i}`);
      raw[o] = rgb[0]; raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2]; raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
// Lay frames side by side for previews.
export function strip(frames, gap = 2) {
  const w = frames.reduce((a, f) => a + f.w + gap, 0), h = Math.max(...frames.map((f) => f.h));
  const px = new Int16Array(w * h).fill(-1);
  let ox = 0;
  for (const f of frames) { for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) px[y * w + ox + x] = f.px[y * f.w + x]; ox += f.w + gap; }
  return { w, h, px };
}
