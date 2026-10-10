// Generates the home-screen icons (pixel art, nearest-neighbour upscaled).
// Run with: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const S = 32;
const px = new Uint8Array(S * S * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const [r, g, b] = hex(c);
  const i = (y * S + x) * 4;
  px.set([r, g, b, 255], i);
};
// Background: dark, with a gold glow at the top (Sanctum) fading to void
for (let y = 0; y < S; y++)
  for (let x = 0; x < S; x++) {
    const t = y / S;
    const d = ((x + y) & 1) * 0.06;
    set(x, y, t + d < 0.18 ? '#e8c25a' : t + d < 0.26 ? '#b98a2e' : t + d < 0.4 ? '#3b1d22' : '#0b0507');
  }
// Gold cross atop
for (let y = 2; y < 9; y++) set(16, y, '#fff1a8');
for (let x = 13; x < 20; x++) set(x, 4, '#fff1a8');
// The scarlet tether, snapped
for (let y = 9; y < 19; y++) set(16 + (y % 3 === 0 ? 1 : 0), y, '#d0162a');
for (let y = 22; y < 30; y++) set(16 + (y % 4 === 0 ? -1 : 0), y, '#d0162a');
set(15, 19, '#ff3b3b');
set(17, 20, '#ff3b3b');
set(16, 21, '#8a1020');
set(14, 23, '#ff3b3b');
set(18, 24, '#8a1020');

function png(scale) {
  const W = S * scale;
  const raw = Buffer.alloc((W * 4 + 1) * W);
  for (let y = 0; y < W; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const si = (Math.floor(y / scale) * S + Math.floor(x / scale)) * 4;
      raw.set(px.subarray(si, si + 4), y * (W * 4 + 1) + 1 + x * 4);
    }
  }
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(W, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('public/icons', { recursive: true });
// 180 isn't a multiple of 32, so render at 6x (192) and let iOS scale.
writeFileSync('public/icons/icon-180.png', png(6));
writeFileSync('public/icons/icon-192.png', png(6));
writeFileSync('public/icons/icon-512.png', png(16));
console.log('icons written');
