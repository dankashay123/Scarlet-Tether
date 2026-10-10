import Phaser from 'phaser';
import { ET, TILE } from '../art/environment';
import { hash2, valueNoise } from '../art/pixel';
import { DEPTH } from './config';
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
  private lastRot = -1;

  constructor(
    readonly scene: Phaser.Scene,
    layout: Layout,
    set: TileSet,
  ) {
    const l = normalise(layout);
    // Pad with stone so the level always fills the 360px-tall view.
    // Deep ground beneath, so the camera can frame the floor high enough to
    // keep the action clear of the thumbs; stone above to fill the view.
    const rows = [...l.rows];
    const wide = rows[0].length;
    for (let i = 0; i < 6; i++) rows.push('#'.repeat(wide));
    while (rows.length * TILE < 368) rows.unshift('#'.repeat(wide));
    this.rows = rows;
    this.h = rows.length;
    this.w = wide;
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.solid = new Uint8Array(this.w * this.h);
    this.rotThreshold = new Float32Array(this.w * this.h);

    const data: number[][] = [];
    for (let y = 0; y < this.h; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.w; x++) {
        const ch = this.ch(x, y);
        if (ch === '#' || ch === 'g') this.solid[y * this.w + x] = 1;
        row.push(this.tileFor(x, y, ch));
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
    if (set === 'marble') {
      const map2 = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const ts2 = map2.addTilesetImage('env-rot', 'env-rot', TILE, TILE, 0, 0)!;
      this.rot = map2.createLayer(0, ts2, 0, 0)!.setDepth(DEPTH.tiles + 1);
      this.rot.forEachTile((t) => (t.alpha = 0));
    }
  }

  ch(x: number, y: number): string {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return '#';
    return this.rows[y][x];
  }

  private isSolidCh(c: string) {
    return c === '#' || c === 'g';
  }

  private marker(ch: string, tx: number, ty: number): Marker {
    let y = ty * TILE + TILE;
    if (FLOOR_SNAPPED.has(ch)) {
      let yy = ty;
      while (yy < this.h && !this.isSolidCh(this.ch(tx, yy)) && this.ch(tx, yy) !== '=') yy++;
      y = yy * TILE;
    } else if (CEILING_SNAPPED.has(ch)) {
      let yy = ty;
      while (yy > 0 && !this.isSolidCh(this.ch(tx, yy - 1))) yy--;
      y = yy * TILE;
    } else y = ty * TILE + TILE / 2;
    return { ch, tx, ty, x: tx * TILE + TILE / 2, y };
  }

  private tileFor(x: number, y: number, ch: string): number {
    if (this.isSolidCh(ch)) {
      const s = (c: string) => this.isSolidCh(c);
      const mask = (s(this.ch(x, y - 1)) ? 1 : 0) | (s(this.ch(x + 1, y)) ? 2 : 0) | (s(this.ch(x, y + 1)) ? 4 : 0) | (s(this.ch(x - 1, y)) ? 8 : 0);
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

  oneWayAt(tx: number, ty: number) {
    return this.ch(tx, ty) === '=';
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
  }
}
