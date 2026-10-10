import Phaser from 'phaser';
import { T, TILE } from '../art/tiles';
import { hash2, valueNoise } from '../art/pixel';
import { DEPTH } from './config';
import { normalise, type Layout } from './layouts';

export interface Marker {
  ch: string;
  tx: number;
  ty: number;
  x: number; // world px (tile centre)
  y: number;
}

const FLOORISH = new Set(['.', ',', 'o', 'x', '~', 'g', 'r', 'S', 'e', 'E', 'P', 'p', 't', 'B', 'c', 'C', 'V', 'K', 'b', 'X', 'H', 'M', 'O', 'L', 'W']);
const MARKERS = new Set(['S', 'e', 'E', 'P', 'p', 't', 'B', 'c', 'C', 'V', 'K', 'b', 'D', 'X', 'H', 'M', 'O', 'L', 'W']);

/**
 * A room built from an ASCII layout: two tile layers (the marble lie and the
 * rotting truth), a collision grid, and the markers for spawning things.
 */
export class Room {
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
    tileset: 'biome' | 'cistern',
  ) {
    const l = normalise(layout);
    this.rows = l.rows;
    this.h = l.rows.length;
    this.w = l.rows[0].length;
    this.pxW = this.w * TILE;
    this.pxH = this.h * TILE;
    this.solid = new Uint8Array(this.w * this.h);
    this.rotThreshold = new Float32Array(this.w * this.h);

    const data: number[][] = [];
    for (let y = 0; y < this.h; y++) {
      const row: number[] = [];
      for (let x = 0; x < this.w; x++) {
        const ch = this.ch(x, y);
        row.push(this.tileFor(x, y, ch));
        if (ch === '#' || ch === 'D' || ch === ' ') this.solid[y * this.w + x] = 1;
        if (MARKERS.has(ch)) this.markers.push({ ch, tx: x, ty: y, x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 });
        // Rot spreads in organic patches, starting from the walls and ponds.
        const n = valueNoise(x, y, 4, 17) * 0.75 + hash2(x, y, 3) * 0.25;
        const nearWall = this.isWallCh(this.ch(x, y - 1)) || this.isWallCh(this.ch(x - 1, y)) || this.isWallCh(this.ch(x + 1, y));
        this.rotThreshold[y * this.w + x] = Phaser.Math.Clamp(n - (nearWall ? 0.18 : 0) - (ch === '~' ? 0.25 : 0), 0, 1);
      }
      data.push(row);
    }

    const baseKey = tileset === 'biome' ? 'tiles-marble' : 'tiles-cistern';
    const map = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const ts = map.addTilesetImage(baseKey, baseKey, TILE, TILE, 0, 0)!;
    this.base = map.createLayer(0, ts, 0, 0)!.setDepth(DEPTH.floor);
    if (tileset === 'biome') {
      const map2 = scene.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const ts2 = map2.addTilesetImage('tiles-rot', 'tiles-rot', TILE, TILE, 0, 0)!;
      this.rot = map2.createLayer(0, ts2, 0, 0)!.setDepth(DEPTH.rot);
      this.rot.forEachTile((t) => (t.alpha = 0));
    }
  }

  ch(x: number, y: number): string {
    if (y < 0 || y >= this.h || x < 0 || x >= this.w) return '#';
    return this.rows[y][x];
  }

  private isWallCh(c: string) {
    return c === '#' || c === 'D';
  }

  private tileFor(x: number, y: number, ch: string): number {
    if (ch === ' ') return T.VOID;
    if (this.isWallCh(ch)) {
      const below = this.ch(x, y + 1);
      if (FLOORISH.has(below)) return hash2(x, y, 2) < 0.25 ? T.WALL_FACE_B : T.WALL_FACE;
      const below2 = this.ch(x, y + 2);
      if (this.isWallCh(below) && FLOORISH.has(below2)) return T.WALL_TOP_EDGE;
      return T.WALL_TOP;
    }
    const above = this.ch(x, y - 1);
    const shadow = this.isWallCh(above);
    switch (ch) {
      case ',':
        return T.FLOOR_E;
      case 'o':
        return T.FLOOR_C;
      case 'x':
        return T.FLOOR_D;
      case '~':
        return above === '~' ? T.POND : T.POND_EDGE;
      case 'g':
        return T.GRATE;
      case 'r':
        return T.RUNNER;
    }
    if (shadow) return T.FLOOR_SHADOW;
    const h = hash2(x, y, 9);
    return h < 0.08 ? T.FLOOR_D : h < 0.5 ? T.FLOOR_A : T.FLOOR_B;
  }

  find(ch: string): Marker[] {
    return this.markers.filter((m) => m.ch === ch);
  }

  tileAtPx(px: number, py: number): string {
    return this.ch(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  solidAt(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true;
    return this.solid[ty * this.w + tx] === 1;
  }

  setSolid(tx: number, ty: number, v: boolean) {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return;
    this.solid[ty * this.w + tx] = v ? 1 : 0;
  }

  solidPx(px: number, py: number) {
    return this.solidAt(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  /** Is a box of half-size r centred at (x, y) clear of walls? */
  private boxClear(x: number, y: number, r: number) {
    return (
      !this.solidPx(x - r, y - r) &&
      !this.solidPx(x + r, y - r) &&
      !this.solidPx(x - r, y + r) &&
      !this.solidPx(x + r, y + r)
    );
  }

  /** Axis-separated movement with sliding along walls. */
  move(x: number, y: number, r: number, dx: number, dy: number): { x: number; y: number; hitX: boolean; hitY: boolean } {
    let hitX = false;
    let hitY = false;
    // Already overlapping a wall (spawned or knocked into one): let it slide free.
    if (!this.boxClear(x, y, r)) return { x: x + dx, y: y + dy, hitX: false, hitY: false };
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    for (let i = 0; i < steps; i++) {
      const sx = dx / steps;
      const sy = dy / steps;
      if (sx !== 0) {
        if (this.boxClear(x + sx, y, r)) x += sx;
        else hitX = true;
      }
      if (sy !== 0) {
        if (this.boxClear(x, y + sy, r)) y += sy;
        else hitY = true;
      }
    }
    return { x, y, hitX, hitY };
  }

  /** Clear straight line between two points (for sight / projectiles)? */
  lineClear(x0: number, y0: number, x1: number, y1: number) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidPx(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /** Find a random open floor position at least `minDist` from (ax, ay). */
  randomFloor(rand: () => number, ax: number, ay: number, minDist: number): { x: number; y: number } {
    for (let tries = 0; tries < 200; tries++) {
      const tx = 1 + Math.floor(rand() * (this.w - 2));
      const ty = 2 + Math.floor(rand() * (this.h - 3));
      const c = this.ch(tx, ty);
      if (this.solidAt(tx, ty) || c === '~' || c === 'g' || c === 't') continue;
      const x = tx * TILE + 8;
      const y = ty * TILE + 8;
      if (Math.hypot(x - ax, y - ay) >= minDist) return { x, y };
    }
    return { x: this.pxW / 2, y: this.pxH / 2 };
  }

  /**
   * Show the rot. `level` 0 = pristine marble, 1 = fully the truth.
   * Each tile reveals when the level passes its personal threshold.
   */
  setRot(level: number) {
    if (!this.rot) return;
    const q = Math.round(level * 50) / 50;
    if (q === this.lastRot) return;
    this.lastRot = q;
    this.rot.forEachTile((t) => {
      const th = this.rotThreshold[t.y * this.w + t.x];
      t.alpha = Phaser.Math.Clamp((q * 1.25 - th) * 5, 0, 1);
    });
  }

  destroy() {
    this.base.destroy();
    this.rot?.destroy();
  }
}
