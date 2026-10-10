import { TILE } from '../art/environment';
import type { Level } from './level';

export const GRAVITY = 1150;
export const MAX_FALL = 560;

/**
 * A platformer body: (x, y) is the centre of the feet. The box is `w` wide
 * and `h` tall above the feet.
 */
export class Body {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  onGround = false;
  wasGround = false;
  hitWall = 0; // -1 left, 1 right, 0 none (this step)
  hitCeiling = false;
  dropThrough = 0; // seconds remaining ignoring one-way ledges
  gravity = 1;

  constructor(
    x: number,
    y: number,
    public w: number,
    public h: number,
  ) {
    this.x = x;
    this.y = y;
  }

  get top() {
    return this.y - this.h;
  }
  get cy() {
    return this.y - this.h / 2;
  }

  step(level: Level, dt: number, fly = false) {
    this.wasGround = this.onGround;
    if (!fly) this.vy = Math.min(MAX_FALL, this.vy + GRAVITY * this.gravity * dt);
    this.dropThrough = Math.max(0, this.dropThrough - dt);
    this.hitWall = 0;
    this.hitCeiling = false;
    this.moveX(level, this.vx * dt);
    this.moveY(level, this.vy * dt, fly);
  }

  private rowsSpan() {
    const t0 = Math.floor((this.y - this.h + 1) / TILE);
    const t1 = Math.floor((this.y - 1) / TILE);
    return [t0, t1];
  }

  private moveX(level: Level, dx: number) {
    if (dx === 0) return;
    const half = this.w / 2;
    const steps = Math.ceil(Math.abs(dx) / 6);
    const sx = dx / steps;
    for (let s = 0; s < steps; s++) {
      const nx = this.x + sx;
      const edge = sx > 0 ? nx + half : nx - half;
      const tx = Math.floor(edge / TILE);
      const [t0, t1] = this.rowsSpan();
      let blocked = false;
      for (let ty = t0; ty <= t1; ty++) if (level.solidAt(tx, ty)) blocked = true;
      if (blocked) {
        this.x = sx > 0 ? tx * TILE - half - 0.01 : (tx + 1) * TILE + half + 0.01;
        this.hitWall = sx > 0 ? 1 : -1;
        this.vx = 0;
        return;
      }
      this.x = nx;
    }
  }

  private moveY(level: Level, dy: number, fly: boolean) {
    const half = this.w / 2 - 0.5;
    const tx0 = Math.floor((this.x - half) / TILE);
    const tx1 = Math.floor((this.x + half) / TILE);
    this.onGround = false;
    if (dy > 0) {
      const ny = this.y + dy;
      const oldRow = Math.floor((this.y - 0.01) / TILE);
      const newRow = Math.floor(ny / TILE);
      for (let ty = oldRow + 1; ty <= newRow; ty++) {
        for (let tx = tx0; tx <= tx1; tx++) {
          const oneWay = !fly && this.dropThrough <= 0 && level.oneWayAt(tx, ty);
          if (level.solidAt(tx, ty) || oneWay) {
            this.y = ty * TILE;
            this.vy = 0;
            this.onGround = true;
            return;
          }
        }
      }
      this.y = ny;
      // Resting exactly on a surface still counts as grounded
      const below = Math.floor(this.y / TILE);
      if (this.y % TILE === 0) for (let tx = tx0; tx <= tx1; tx++) if (level.solidAt(tx, below) || (this.dropThrough <= 0 && level.oneWayAt(tx, below))) this.onGround = true;
    } else if (dy < 0) {
      const ny = this.y + dy;
      const headOld = Math.floor((this.y - this.h) / TILE);
      const headNew = Math.floor((ny - this.h) / TILE);
      for (let ty = headOld - 1; ty >= headNew; ty--) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (level.solidAt(tx, ty)) {
            this.y = (ty + 1) * TILE + this.h + 0.01;
            this.vy = 0;
            this.hitCeiling = true;
            return;
          }
        }
      }
      this.y = ny;
    } else {
      const below = Math.floor(this.y / TILE);
      for (let tx = tx0; tx <= tx1; tx++) if (level.solidAt(tx, below) || (this.dropThrough <= 0 && level.oneWayAt(tx, below))) this.onGround = true;
    }
  }

  /** Is there floor ahead in direction `dir` (for patrolling walkers)? */
  floorAhead(level: Level, dir: number) {
    const ax = this.x + dir * (this.w / 2 + 4);
    const tx = Math.floor(ax / TILE);
    const ty = Math.floor((this.y + 2) / TILE);
    return level.solidAt(tx, ty) || level.oneWayAt(tx, ty);
  }

  wallAhead(level: Level, dir: number) {
    const ax = this.x + dir * (this.w / 2 + 2);
    const tx = Math.floor(ax / TILE);
    const ty = Math.floor((this.y - 6) / TILE);
    return level.solidAt(tx, ty);
  }
}
