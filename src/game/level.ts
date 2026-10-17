import Phaser from 'phaser';
import { ET, TILE } from '../art/environment';
import { hash2, valueNoise } from '../art/pixel';
import { DEPTH, VIEW_H } from './config';
import { normalise, type Layout } from './layouts';

export interface Marker {
  ch: string;
  tx: number;
  ty: number;
  /** World position. Floor-standing markers are snapped onto the ground. */
  x: number;
  y: number;
}

const FLOOR_SNAPPED = new Set(['S', 'e', 'E', 'B', 'c', 's', 'D', 'C', 'V', 'K', 'b', 'X', 'M', 'O', 'L', 'W']);
const CEILING_SNAPPED = new Set(['P', 'k']);
const MARKER_CHARS = new Set([...FLOOR_SNAPPED, ...CEILING_SNAPPED, 'f', 'H', '^']);

export type TileSet = 'marble' | 'cistern';

/** A sealed door in a doorway: solid until the right shot opens it. */
export interface Hatch {
  key: string;
  tx: number;
  ty0: number;
  ty1: number;
  kind: 'crimson';
  img: Phaser.GameObjects.Image;
  open: boolean;
}

/** A crumbling ledge tile: shakes when stood on, falls, then reforms. */
interface Crumble {
  tx: number;
  ty: number;
  img: Phaser.GameObjects.Image;
  state: 'whole' | 'shaking' | 'gone';
  t: number;
}

/** Copy one tile out of a tileset strip and scar it with cracks. */
function crackedTile(scene: Phaser.Scene, src: string, index: number, key: string, heavy: boolean) {
  if (scene.textures.exists(key)) return;
  const img = scene.textures.get(src).getSourceImage() as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = TILE;
  c.height = TILE;
  const g = c.getContext('2d')!;
  g.drawImage(img, index * TILE, 0, TILE, TILE, 0, 0, TILE, TILE);
  const px = (x: number, y: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, 1, 1);
  };
  // A jagged fracture with a lit lip, so it reads as breakable at a glance
  const lines = heavy
    ? [[[2, 1], [5, 5], [4, 9], [8, 12], [7, 15]], [[13, 0], [10, 4], [12, 8], [9, 12]], [[0, 9], [4, 9]], [[11, 8], [15, 10]]]
    : [[[3, 1], [5, 3], [8, 2], [10, 4], [13, 3]], [[7, 2], [6, 5]]];
  for (const l of lines)
    for (let i = 0; i < l.length - 1; i++) {
      const [x0, y0] = l[i];
      const [x1, y1] = l[i + 1];
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + ((x1 - x0) * k) / n);
        const y = Math.round(y0 + ((y1 - y0) * k) / n);
        px(x, y, '#0b0507');
        if (x + 1 < TILE) px(x + 1, y, 'rgba(255,240,210,0.35)');
      }
    }
  if (heavy) {
    // Old blood seeping from the seams
    for (const [x, y] of [[5, 6], [5, 7], [8, 13], [8, 14], [12, 9]]) px(x, y, '#5e0a18');
  }
  scene.textures.addCanvas(key, c);
}

/**
 * A side-view level built from an ASCII layout: solid stone, one-way
 * ledges, pools, and two matching tile layers (the marble lie and the
 * rotting truth) that crossfade with Lucidity.
 */
export class Level {
  readonly w: number;
  readonly h: number;
  readonly rows: string[];
  readonly pxW: number;
  readonly pxH: number;
  readonly markers: Marker[] = [];
  private solid: Uint8Array;
  private base: Phaser.Tilemaps.TilemapLayer;
  private rot: Phaser.Tilemaps.TilemapLayer | null = null;
  private rotThreshold: Float32Array;
  private climbables: Phaser.GameObjects.Image[] = [];
  private crumbles = new Map<number, Crumble>();
  private walls = new Map<number, Phaser.GameObjects.Image>();
  /** Air sealed behind false walls: drawn as stone until the wall breaks. */
  private hidden = new Set<number>();
  /** Called as a ledge starts to give (fall = false) and as it drops away. */
  onCrumble: ((x: number, y: number, fall: boolean) => void) | null = null;
  /** Sealed doors in doorways (Super Metroid hatches). */
  readonly hatches: Hatch[] = [];
  private lastRot = -1;

  constructor(
    readonly scene: Phaser.Scene,
    layout: Layout,
    set: TileSet,
  ) {
    const l = normalise(layout);
    // Pad with stone so the level always fills the 224px-tall view.
    // Deep ground beneath, so the camera can frame the floor high enough to
    // keep the action clear of the thumbs; stone above to fill the view.
    const rows = [...l.rows];
    const wide = rows[0].length;
    for (let i = 0; i < 6; i++) rows.push('#'.repeat(wide));
    while (rows.length * TILE < VIEW_H + 8) rows.unshift('#'.repeat(wide));
    this.rows = rows;
    this.h = rows.length;
    this.w = wide;
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.solid = new Uint8Array(this.w * this.h);
    this.rotThreshold = new Float32Array(this.w * this.h);

    this.findHidden();
    const data: number[][] = [];
    for (let y = 0; y < this.h; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.w; x++) {
        const ch = this.ch(x, y);
        if (ch === '#' || ch === 'g' || ch === 'w') this.solid[y * this.w + x] = 1;
        row.push(this.hidden.has(y * this.w + x) ? this.tileFor(x, y, '#') : this.tileFor(x, y, ch));
        if (MARKER_CHARS.has(ch)) this.markers.push(this.marker(ch, x, y));
        const n = valueNoise(x, y, 5, 17) * 0.8 + hash2(x, y, 3) * 0.2;
        this.rotThreshold[y * this.w + x] = Phaser.Math.Clamp(n, 0, 1);
      }
      data.push(row);
    }
    const key = set === 'marble' ? 'env-marble' : 'env-cistern';
    const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(key, key, TILE, TILE, 0, 0)!;
    this.base = map.createLayer(0, ts, 0, 0)!.setDepth(DEPTH.tiles);
    // Ladders and hanging chains are drawn as sprites over the stone
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.ch(x, y);
        if (c === '|' || c === '!') this.climbables.push(scene.add.image(x * TILE + 8, y * TILE + 8, c === '|' ? 'ladder' : 'hang-chain').setDepth(DEPTH.tiles + 2));
      }
    // Crumbling ledges and false walls are sprites so they can fall apart
    crackedTile(scene, key, ET.PLAT_M, `crumble-${set}`, false);
    crackedTile(scene, key, 15, `crackwall-${set}`, true);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.ch(x, y);
        if (c === '%') {
          const img = scene.add.image(x * TILE + 8, y * TILE + 8, `crumble-${set}`).setDepth(DEPTH.tiles + 1);
          this.crumbles.set(y * this.w + x, { tx: x, ty: y, img, state: 'whole', t: 0 });
        } else if (c === 'w') {
          this.walls.set(y * this.w + x, scene.add.image(x * TILE + 8, y * TILE + 8, `crackwall-${set}`).setDepth(DEPTH.tiles + 1));
        }
      }
    if (set === 'marble') {
      const map2 = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const ts2 = map2.addTilesetImage('env-rot', 'env-rot', TILE, TILE, 0, 0)!;
      this.rot = map2.createLayer(0, ts2, 0, 0)!.setDepth(DEPTH.tiles + 1);
      this.rot.forEachTile((t) => (t.alpha = 0));
    }
  }

  /** Seal a doorway column (tiles ty0..ty1) with a hatch. */
  addHatch(key: string, tx: number, ty0: number, ty1: number, kind: 'crimson') {
    for (let ty = ty0; ty <= ty1; ty++) this.solid[ty * this.w + tx] = 1;
    const img = this.scene.add.image(tx * TILE, ty0 * TILE, `hatch-${kind}`).setOrigin(0, 0).setDepth(DEPTH.tiles + 2);
    const h: Hatch = { key, tx, ty0, ty1, kind, img, open: false };
    this.hatches.push(h);
    return h;
  }

  hatchAt(px: number, py: number): Hatch | null {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    return this.hatches.find((h) => !h.open && h.tx === tx && ty >= h.ty0 && ty <= h.ty1) ?? null;
  }

  openHatch(h: Hatch) {
    if (h.open) return;
    h.open = true;
    for (let ty = h.ty0; ty <= h.ty1; ty++) this.solid[ty * this.w + h.tx] = 0;
    h.img.setTexture('hatch-open');
  }

  /** Something heavy is standing at (px, py): start any crumbling ledge there. */
  standOn(px: number, py: number) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    for (const dx of [-1, 0, 1]) {
      const c = this.crumbles.get(ty * this.w + tx + dx);
      if (c && c.state === 'whole' && Math.abs((tx + dx) * TILE + 8 - px) < 14) {
        // The whole span goes together
        let a = tx + dx;
        let b = tx + dx;
        while (this.crumbles.get(ty * this.w + a - 1)?.state === 'whole') a--;
        while (this.crumbles.get(ty * this.w + b + 1)?.state === 'whole') b++;
        for (let x = a; x <= b; x++) {
          const k = this.crumbles.get(ty * this.w + x)!;
          k.state = 'shaking';
          k.t = 0;
        }
        this.onCrumble?.(px, ty * TILE, false);
        return;
      }
    }
  }

  /** Crumbling ledges tick: shaking, falling, reforming. */
  update(dt: number) {
    for (const c of this.crumbles.values()) {
      if (c.state === 'whole') continue;
      c.t += dt;
      if (c.state === 'shaking') {
        c.img.x = c.tx * TILE + 8 + (Math.random() < 0.5 ? -1 : 1) * (c.t > 0.3 ? 1 : 0.5);
        if (c.t > 0.55) {
          c.state = 'gone';
          c.t = 0;
          const img = c.img;
          this.scene.tweens.add({ targets: img, y: img.y + 60, angle: (Math.random() - 0.5) * 60, alpha: 0, duration: 450, ease: 'Quad.In' });
          this.onCrumble?.(c.tx * TILE + 8, c.ty * TILE + 8, true);
        }
      } else if (c.t > 3.5) {
        c.state = 'whole';
        c.t = 0;
        this.scene.tweens.killTweensOf(c.img);
        c.img.setPosition(c.tx * TILE + 8, c.ty * TILE + 8).setAngle(0).setAlpha(0);
        this.scene.tweens.add({ targets: c.img, alpha: 1, duration: 400 });
      }
    }
  }

  /** A blow lands at (px, py): smash any false wall it touches. Returns the broken tiles' centres. */
  strike(px: number, py: number, r = 10): [number, number][] {
    const out: [number, number][] = [];
    const tx0 = Math.floor((px - r) / TILE);
    const tx1 = Math.floor((px + r) / TILE);
    const ty0 = Math.floor((py - r) / TILE);
    const ty1 = Math.floor((py + r) / TILE);
    const seeds: number[] = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.walls.has(ty * this.w + tx)) seeds.push(ty * this.w + tx);
    // Bring the whole false wall down at once
    while (seeds.length) {
      const k = seeds.pop()!;
      const img = this.walls.get(k);
      if (!img) continue;
      img.destroy();
      this.walls.delete(k);
      const tx = k % this.w;
      const ty = (k / this.w) | 0;
      this.solid[k] = 0;
      this.base.removeTileAt(tx, ty);
      this.rot?.removeTileAt(tx, ty);
      const row = this.rows[ty];
      (this.rows as string[])[ty] = row.slice(0, tx) + '.' + row.slice(tx + 1);
      out.push([tx * TILE + 8, ty * TILE + 8]);
      for (const n of [k - 1, k + 1, k - this.w, k + this.w]) if (this.walls.has(n)) seeds.push(n);
    }
    // Reveal the hollow behind
    const revealed: [number, number][] = [];
    if (out.length) {
      // Flood from the breach through the hidden cells it touches
      const q = out.map(([cx, cy]) => ((cy - 8) / TILE) * this.w + (cx - 8) / TILE);
      const got = new Set<number>();
      while (q.length) {
        const k = q.pop()!;
        for (const n of [k - 1, k + 1, k - this.w, k + this.w]) {
          if (!this.hidden.has(n) || got.has(n)) continue;
          got.add(n);
          q.push(n);
          revealed.push([n % this.w, (n / this.w) | 0]);
        }
      }
      for (const [hx, hy] of revealed) {
        this.hidden.delete(hy * this.w + hx);
        this.base.removeTileAt(hx, hy);
        this.rot?.removeTileAt(hx, hy);
      }
    }
    // Re-edge the surrounding stone so the breach has proper faces
    for (const [cx, cy] of [...out, ...revealed.map(([hx, hy]) => [hx * TILE + 8, hy * TILE + 8] as [number, number])]) {
      const tx = (cx - 8) / TILE;
      const ty = (cy - 8) / TILE;
      for (const [nx, ny] of [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]]) {
        const c = this.ch(nx, ny);
        if (c === '#' || c === 'g') {
          const t = this.tileFor(nx, ny, c);
          this.base.putTileAt(t, nx, ny);
          this.rot?.putTileAt(t, nx, ny).setAlpha(Phaser.Math.Clamp((Math.max(0, this.lastRot) * 1.25 - this.rotThreshold[ny * this.w + nx]) * 5, 0, 1));
        }
      }
    }
    return out;
  }

  ch(x: number, y: number): string {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return '#';
    return this.rows[y][x];
  }

  private isSolidCh(c: string) {
    return c === '#' || c === 'g' || c === 'w';
  }

  private marker(ch: string, tx: number, ty: number): Marker {
    let y = ty * TILE + TILE;
    if (FLOOR_SNAPPED.has(ch)) {
      let yy = ty;
      while (yy < this.h && !this.isSolidCh(this.ch(tx, yy)) && this.ch(tx, yy) !== '=' && this.ch(tx, yy) !== '%') yy++;
      y = yy * TILE;
    } else if (CEILING_SNAPPED.has(ch)) {
      let yy = ty;
      while (yy > 0 && !this.isSolidCh(this.ch(tx, yy - 1))) yy--;
      y = yy * TILE;
    } else y = ty * TILE + TILE / 2;
    return { ch, tx, ty, x: tx * TILE + TILE / 2, y };
  }

  /** Small enclosed air pockets beside false walls are secrets. */
  private findHidden() {
    const W = this.w;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < W; x++) {
        if (this.ch(x, y) !== 'w') continue;
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (this.isSolidCh(this.ch(nx, ny)) || this.hidden.has(ny * W + nx)) continue;
          const seen = new Set<number>([ny * W + nx]);
          const q = [ny * W + nx];
          let open = true;
          while (q.length && open) {
            const k = q.pop()!;
            const kx = k % W;
            const ky = (k / W) | 0;
            for (const [ax, ay] of [[kx - 1, ky], [kx + 1, ky], [kx, ky - 1], [kx, ky + 1]]) {
              const kk = ay * W + ax;
              if (seen.has(kk) || this.isSolidCh(this.ch(ax, ay))) continue;
              seen.add(kk);
              q.push(kk);
            }
            if (seen.size > 80) open = false; // that's the room, not a hollow
          }
          if (open) for (const k of seen) this.hidden.add(k);
        }
      }
  }

  private tileFor(x: number, y: number, ch: string): number {
    if (this.isSolidCh(ch)) {
      const s = (c: string, cx: number, cy: number) => this.isSolidCh(c) || this.hidden.has(cy * this.w + cx);
      const mask =
        (s(this.ch(x, y - 1), x, y - 1) ? 1 : 0) | (s(this.ch(x + 1, y), x + 1, y) ? 2 : 0) | (s(this.ch(x, y + 1), x, y + 1) ? 4 : 0) | (s(this.ch(x - 1, y), x - 1, y) ? 8 : 0);
      if (ch === 'g' && !(mask & 1)) return ET.GRATE;
      return mask;
    }
    if (ch === '=') {
      const l = this.ch(x - 1, y) === '=';
      const r = this.ch(x + 1, y) === '=';
      return !l ? ET.PLAT_L : !r ? ET.PLAT_R : ET.PLAT_M;
    }
    if (ch === '~') return this.ch(x, y - 1) === '~' ? ET.LIQUID : ET.LIQUID_TOP;
    return -1;
  }

  find(ch: string): Marker[] {
    return this.markers.filter((m) => m.ch === ch);
  }

  tileAt(px: number, py: number): string {
    return this.ch(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  solidAt(tx: number, ty: number) {
    if (tx < 0 || tx >= this.w) return true;
    if (ty < 0) return false;
    if (ty >= this.h) return true;
    return this.solid[ty * this.w + tx] === 1;
  }

  setSolid(tx: number, ty: number, v: boolean) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.solid[ty * this.w + tx] = v ? 1 : 0;
  }

  solidPx(px: number, py: number) {
    return this.solidAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  /** Ledges, and the top rung of a ladder, can be stood on from above. */
  oneWayAt(tx: number, ty: number) {
    const c = this.ch(tx, ty);
    if (c === '=') return true;
    if (c === '%') return this.crumbles.get(ty * this.w + tx)?.state !== 'gone';
    if (c !== '|') return false;
    // The top rung, or a ladder passing through a floor (walk over the gap)
    return (this.ch(tx, ty - 1) !== '|' && !this.isSolidCh(this.ch(tx, ty - 1))) || (this.isSolidCh(this.ch(tx - 1, ty)) && this.isSolidCh(this.ch(tx + 1, ty)));
  }

  /** Ladders ('|') and hanging chains ('!') can be climbed. */
  climbableAt(tx: number, ty: number) {
    const c = this.ch(tx, ty);
    return c === '|' || c === '!';
  }

  climbablePx(px: number, py: number) {
    return this.climbableAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  inLiquid(px: number, py: number) {
    return this.tileAt(px, py - 2) === '~';
  }

  /** Ground directly beneath (x, y) within `range` px? */
  groundBelow(px: number, py: number, range = 18) {
    for (let d = 0; d <= range; d += 4) {
      const tx = Math.floor(px / TILE);
      const ty = Math.floor((py + d) / TILE);
      if (this.solidAt(tx, ty) || this.oneWayAt(tx, ty)) return true;
    }
    return false;
  }

  /** Clear straight line between two points (sight / projectiles). */
  lineClear(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /** The y of the floor surface at or below (px, py), or null. */
  floorY(px: number, py: number): number | null {
    const tx = Math.floor(px / TILE);
    for (let ty = Math.max(0, Math.floor(py / TILE)); ty < this.h; ty++) {
      if (this.solidAt(tx, ty) || this.oneWayAt(tx, ty)) return ty * TILE;
    }
    return null;
  }

  /** Reveal the rot. Each tile flips when the level passes its threshold. */
  setRot(level: number) {
    if (!this.rot) return;
    const q = Math.round(level * 50) / 50;
    if (q === this.lastRot) return;
    this.lastRot = q;
    this.rot.forEachTile((t) => {
      if (t.index < 0) return;
      const th = this.rotThreshold[t.y * this.w + t.x];
      t.alpha = Phaser.Math.Clamp((q * 1.25 - th) * 5, 0, 1);
    });
  }

  destroy() {
    this.base.destroy();
    this.rot?.destroy();
    this.climbables.forEach((c) => c.destroy());
  }
}
