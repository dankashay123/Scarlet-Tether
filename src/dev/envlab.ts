// Developer lab for environment art (web/art-env.html).
// ?view=scene&set=marble|rot|cistern&cam=300   composed sample scene (2x)
// ?view=strips                                 raw tile strips (4x) + autotile test
// ?view=props                                  every prop and frame (3x)
// ?view=layers&set=...                         each backdrop layer alone, tiled twice
import { buildEnvironment, ET, TILE } from '../art/environment';

interface Tex {
  canvas: HTMLCanvasElement;
  frames: Map<string | number, [number, number, number, number]>;
  add(name: string | number, src: number, x: number, y: number, w: number, h: number): void;
}
const tex = new Map<string, Tex>();
const anims = new Map<string, { key: string; frames: { key: string; frame: number }[] }>();
const scene = {
  textures: {
    exists: (k: string) => tex.has(k),
    remove: (k: string) => tex.delete(k),
    addCanvas: (k: string, canvas: HTMLCanvasElement) => {
      const t: Tex = {
        canvas,
        frames: new Map(),
        add(name, _src, x, y, w, h) {
          this.frames.set(name, [x, y, w, h]);
        },
      };
      tex.set(k, t);
      return t;
    },
  },
  anims: {
    exists: (k: string) => anims.has(k),
    remove: (k: string) => anims.delete(k),
    create: (cfg: { key: string; frames: { key: string; frame: number }[] }) => anims.set(cfg.key, cfg),
  },
} as unknown as Phaser.Scene;

const t0 = performance.now();
buildEnvironment(scene);
const genMs = performance.now() - t0;
if (location.search.includes('timing')) {
  const t1 = performance.now();
  buildEnvironment(scene);
  console.log('warm rebuild ms', (performance.now() - t1).toFixed(0));
}

const params = new URLSearchParams(location.search);
const view = params.get('view') || 'scene';
const set = params.get('set') || 'marble';
const cam = Number(params.get('cam') || 300);
const info = document.getElementById('t')!;
info.textContent = `generated in ${genMs.toFixed(0)} ms; textures ${tex.size}; anims ${[...anims.keys()].join(', ')}`;
console.log(info.textContent);

const c = document.getElementById('c') as HTMLCanvasElement;
const ctx = c.getContext('2d')!;

function img(key: string) {
  const t = tex.get(key);
  if (!t) throw new Error('missing texture ' + key);
  return t.canvas;
}
function frame(key: string, i: number, x: number, y: number, s = 1) {
  const t = tex.get(key)!;
  const f = t.frames.get(i)!;
  ctx.drawImage(t.canvas, f[0], f[1], f[2], f[3], x, y, f[2] * s, f[3] * s);
}
function tiled(key: string, factor: number, ox = 0, oy = 0, s = 1) {
  const off = -(((cam * factor) % 640) + 640) % 640;
  ctx.drawImage(img(key), ox + off * s, oy, 640 * s, 360 * s);
  ctx.drawImage(img(key), ox + (off + 640) * s, oy, 640 * s, 360 * s);
}

const MAP = [
  '########################################',
  '##########..........####################',
  '###.....................######......####',
  '##.........................##.........##',
  '##....................................##',
  '##....................................##',
  '##....................................##',
  '##....................................##',
  '##..........................###.......##',
  '##..........................###.......##',
  '##..........................#.#.......##',
  '##....................................##',
  '##....................................##',
  '##.......=====..............=====.....##',
  '##....................................##',
  '##....................................##',
  '##...................gggg.............##',
  '##..................######............##',
  '##.............xx...######............##',
  '#############################~~~~~~#####',
  '#############################~~~~~~#####',
  '#############################~~~~~~#####',
  '########################################',
];

function tileFor(x: number, y: number): number {
  const ch = (xx: number, yy: number) => (yy < 0 || yy >= MAP.length || xx < 0 || xx >= MAP[0].length ? '#' : MAP[yy][xx]);
  const solid = (k: string) => k === '#' || k === 'g';
  const k = ch(x, y);
  if (solid(k)) {
    const m = (solid(ch(x, y - 1)) ? 1 : 0) | (solid(ch(x + 1, y)) ? 2 : 0) | (solid(ch(x, y + 1)) ? 4 : 0) | (solid(ch(x - 1, y)) ? 8 : 0);
    if (k === 'g' && !(m & 1)) return ET.GRATE;
    return m;
  }
  if (k === '=') return ch(x - 1, y) !== '=' ? ET.PLAT_L : ch(x + 1, y) !== '=' ? ET.PLAT_R : ET.PLAT_M;
  if (k === '~') return ch(x, y - 1) === '~' ? ET.LIQUID : ET.LIQUID_TOP;
  if (k === 'x') return ET.THORNS;
  return -1;
}

function drawMap(tileKey: string, s: number, ox = 0, oy = 0) {
  const t = img(tileKey);
  for (let y = 0; y < MAP.length; y++)
    for (let x = 0; x < MAP[0].length; x++) {
      const i = tileFor(x, y);
      if (i < 0) continue;
      ctx.drawImage(t, i * TILE, 0, TILE, TILE, ox + x * TILE * s, oy + y * TILE * s, TILE * s, TILE * s);
    }
}

function put(key: string, x: number, y: number, s: number, anchor: 'bottom' | 'top' = 'bottom') {
  const i = img(key);
  ctx.drawImage(i, (x - i.width / 2) * s, (anchor === 'bottom' ? y - i.height : y) * s, i.width * s, i.height * s);
}

function composeScene(st: string, s: number, ox = 0, oy = 0) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, 640 * s, 360 * s);
  ctx.clip();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 640 * s, 360 * s);
  tiled(`bg-${st}-far`, 0.1, 0, 0, s);
  tiled(`bg-${st}-mid`, 0.35, 0, 0, s);
  tiled(`bg-${st}-near`, 0.65, 0, 0, s);
  const rot = st === 'rot';
  if (st === 'cistern') {
    ctx.globalCompositeOperation = 'lighter';
    put('prop-grate-light', 250, 32, s, 'top');
    ctx.globalCompositeOperation = 'source-over';
  }
  put(rot ? 'prop-booth-rot' : 'prop-booth', 92, 304, s);
  put('prop-booth-open', 160, 304, s);
  frame('candelabra', 1, (214 - 12) * s, (304 - 48) * s, s);
  put(rot ? 'prop-saint-rot' : 'prop-saint', 300, 272, s);
  put('prop-cage', 404, 32, s, 'top');
  frame('door', 0, (540 - 24) * s, (304 - 72) * s, s);
  put('emblem-elite', 540, 226, s);
  put('prop-votive', 600, 304, s);
  put('prop-cache', 380, 304, s);
  put('prop-lectern', 250, 304, s);
  put('prop-censer', 470, 120, s);
  drawMap(`env-${st}`, s);
  tiled(`fg-${st}`, 1.3, 0, 0, s);
  ctx.restore();
}

ctx.imageSmoothingEnabled = false;
if (view === 'scene') {
  c.width = 1280;
  c.height = 720;
  ctx.imageSmoothingEnabled = false;
  composeScene(set, 2);
} else if (view === 'layers') {
  c.width = 1280;
  c.height = 360 * 4;
  ctx.imageSmoothingEnabled = false;
  ['far', 'mid', 'near', 'fg'].forEach((l, i) => {
    ctx.fillStyle = (i % 2 ? '#3a5a3a' : '#2a3a5a');
    ctx.fillRect(0, i * 360, 1280, 360);
    const key = l === 'fg' ? `fg-${set}` : `bg-${set}-${l}`;
    if (params.has('zoom')) {
      const zx = Number(params.get('zoom'));
      ctx.drawImage(img(key), zx, 0, 320, 180, 0, i * 360, 640, 360);
      ctx.drawImage(img(key), zx, 180, 320, 180, 640, i * 360, 640, 360);
    } else {
      ctx.drawImage(img(key), 0, i * 360);
      ctx.drawImage(img(key), 640, i * 360);
    }
  });
} else if (view === 'strips') {
  const s = 4;
  c.width = ET.COUNT * TILE * s;
  c.height = 3 * (TILE * s + 20) + 3 * 6 * TILE * 3 + 40;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#5a6a7a';
  ctx.fillRect(0, 0, c.width, c.height);
  ['marble', 'rot', 'cistern'].forEach((st, r) => {
    ctx.drawImage(img(`env-${st}`), 0, r * (TILE * s + 20), ET.COUNT * TILE * s, TILE * s);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < ET.COUNT; i++) ctx.fillText(String(i), i * TILE * s + 2, r * (TILE * s + 20) + TILE * s + 12);
  });
  // Autotile test blobs at 3x
  const blob = ['.##..####...#.', '.###.#..#..###', '..#..####...#.', '.....#..#.....', '###..####..##.', '##...........#'];
  const s2 = 3;
  ['marble', 'rot', 'cistern'].forEach((st, r) => {
    const oy = 3 * (TILE * s + 20) + 10 + r * 6 * TILE * s2;
    for (let y = 0; y < blob.length; y++)
      for (let x = 0; x < blob[0].length; x++) {
        const ch = (xx: number, yy: number) => (yy < 0 || yy >= blob.length || xx < 0 || xx >= blob[0].length ? '.' : blob[yy][xx]);
        if (ch(x, y) !== '#') continue;
        const m = (ch(x, y - 1) === '#' ? 1 : 0) | (ch(x + 1, y) === '#' ? 2 : 0) | (ch(x, y + 1) === '#' ? 4 : 0) | (ch(x - 1, y) === '#' ? 8 : 0);
        ctx.drawImage(img(`env-${st}`), m * TILE, 0, TILE, TILE, x * TILE * s2, oy + y * TILE * s2, TILE * s2, TILE * s2);
      }
  });
} else {
  // props
  const s = 3;
  c.width = 1800;
  c.height = 1000;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#4a4248';
  ctx.fillRect(0, 0, c.width, c.height);
  let x = 10;
  let y = 10;
  let rowH = 0;
  const place = (w: number, h: number, draw: (x: number, y: number) => void) => {
    if (x + w * s > c.width) {
      x = 10;
      y += rowH + 10;
      rowH = 0;
    }
    draw(x, y);
    x += w * s + 10;
    rowH = Math.max(rowH, h * s);
  };
  for (const k of ['prop-booth', 'prop-booth-rot', 'prop-booth-open', 'prop-saint', 'prop-saint-rot', 'prop-cage', 'prop-votive', 'prop-votive-spent', 'prop-lectern']) {
    const i = img(k);
    place(i.width, i.height, (px, py) => ctx.drawImage(i, px, py, i.width * s, i.height * s));
  }
  for (let f = 0; f < 3; f++) place(24, 48, (px, py) => frame('candelabra', f, px, py, s));
  for (let f = 0; f < 5; f++) place(48, 72, (px, py) => frame('door', f, px, py, s));
  for (const k of ['prop-cache', 'prop-cache-open', 'prop-censer', 'emblem-combat', 'emblem-elite', 'emblem-confessional', 'emblem-votive', 'emblem-cache', 'emblem-boss']) {
    const i = img(k);
    place(i.width, i.height, (px, py) => ctx.drawImage(i, px, py, i.width * s, i.height * s));
  }
  const gl = img('prop-grate-light');
  place(64, 200, (px, py) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(px, py, 64 * s, 200 * s);
    ctx.drawImage(gl, px, py, 64 * s, 200 * s);
  });
}

if (params.has('timing')) {
  void import('../art/environment/backdrops').then(({ drawBackdrops }) =>
    import('../art/environment/tilesets').then(({ drawTileset }) =>
      import('../art/environment/props').then((pr) => {
        const tm = (n: string, f: () => unknown) => {
          const a = performance.now();
          f();
          console.log('TIME', n, (performance.now() - a).toFixed(1));
        };
        for (const s of ['marble', 'rot', 'cistern'] as const) {
          tm('tiles ' + s, () => drawTileset(s));
          tm('backdrops ' + s, () => drawBackdrops(s));
        }
        tm('booth', () => pr.drawBooth(false, false));
        tm('doors', () => pr.drawDoorFrames());
        tm('saint', () => pr.drawSaint(false));
        tm('votive', () => pr.drawVotive(false));
      }),
    ),
  );
}
