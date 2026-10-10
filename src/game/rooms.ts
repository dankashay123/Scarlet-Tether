// Handmade room templates for the Sunken Confessionals, drawn with a small
// builder so exits always sit on the standard grid and can be stitched.
//
// A cell is 40x24 tiles (640x384 px, about one screen). Templates span one
// or more cells. Exits sit at fixed places on the cell edges:
//   west/east:   rows 15..19 of the cell row, floor at row 20
//   north/south: column 19 of the cell column (a one-tile ladder shaft)
// Border chars: '<' west, '>' east, 'n' north, 'u' south. West/east exits
// are optional (sealed with stone when unused); north/south ones must be
// connected by the generator.

export const CW = 40;
export const CH = 24;
export const SIDE_ROWS = [15, 16, 17, 18, 19];
export const FLOOR_ROW = 20;
export const SHAFT_COL = 19;

export type RoomKind = 'start' | 'combat' | 'special' | 'ante' | 'pit' | 'loft';

export interface Template {
  name: string;
  kind: RoomKind;
  cw: number;
  ch: number;
  rows: string[];
  weight?: number;
}

class Grid {
  readonly w: number;
  readonly h: number;
  private g: string[][];
  constructor(readonly cw: number, readonly ch: number) {
    this.w = cw * CW;
    this.h = ch * CH;
    this.g = Array.from({ length: this.h }, () => Array(this.w).fill('#'));
  }
  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.g[y][x] = c;
  }
  get(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.g[y][x] : '#';
  }
  fill(x0: number, y0: number, x1: number, y1: number, c: string) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }
  /** Hollow out the interior, leaving a ceiling, walls and a floor. */
  carve() {
    return this.fill(1, 2, this.w - 2, this.h - 5, '.');
  }
  /** Raise the floor back up at the bottom of each cell row except the last. */
  ledge(x0: number, x1: number, y: number, c = '=') {
    for (let x = x0; x <= x1; x++) this.set(x, y, c);
    return this;
  }
  block(x0: number, y0: number, x1: number, y1: number) {
    return this.fill(x0, y0, x1, y1, '#');
  }
  west(row = 0) {
    for (const r of SIDE_ROWS) this.set(0, row * CH + r, '<');
    this.fill(1, row * CH + FLOOR_ROW, 3, row * CH + FLOOR_ROW, '#');
    return this;
  }
  east(row = 0) {
    for (const r of SIDE_ROWS) this.set(this.w - 1, row * CH + r, '>');
    this.fill(this.w - 4, row * CH + FLOOR_ROW, this.w - 2, row * CH + FLOOR_ROW, '#');
    return this;
  }
  /** A ladder shaft up through the ceiling, reaching down to row `toY`. */
  north(col = 0, toY = FLOOR_ROW - 1) {
    const x = col * CW + SHAFT_COL;
    this.set(x, 0, 'n');
    for (let y = 1; y <= toY; y++) this.set(x, y, '|');
    return this;
  }
  /** A ladder shaft down through the floor, from row `fromY`. */
  south(col = 0, fromY = FLOOR_ROW) {
    const x = col * CW + SHAFT_COL;
    for (let y = fromY; y < this.h - 1; y++) this.set(x, y, '|');
    this.set(x, this.h - 1, 'u');
    return this;
  }
  ladder(x: number, y0: number, y1: number) {
    for (let y = y0; y <= y1; y++) this.set(x, y, '|');
    return this;
  }
  chain(x: number, y0: number, y1: number) {
    for (let y = y0; y <= y1; y++) this.set(x, y, '!');
    return this;
  }
  put(x: number, y: number, c: string) {
    this.set(x, y, c);
    return this;
  }
  /** Place a marker standing on the floor below (y = the air row above a floor). */
  mark(x: number, y: number, c: string) {
    return this.put(x, y, c);
  }
  rows() {
    return this.g.map((r) => r.join(''));
  }
}

const F = FLOOR_ROW - 1; // the air row just above the floor of a cell

function t(name: string, kind: RoomKind, g: Grid, weight = 1): Template {
  return { name, kind, cw: g.cw, ch: g.ch, rows: g.rows(), weight };
}

export const TEMPLATES: Template[] = [
  // --- Start --------------------------------------------------------------
  t(
    'The Chute’s Foot',
    'start',
    new Grid(1, 1)
      .carve()
      .east()
      .mark(4, F, 'S')
      .mark(9, F, 'c')
      .mark(16, F, 's')
      .mark(27, F, 'B')
      .mark(34, F, 'c')
      .put(10, 3, 'k')
      .put(30, 3, 'k')
      .ledge(20, 26, 15),
  ),

  // --- Combat, one screen ---------------------------------------------------
  t(
    'The Nave of Whispers',
    'combat',
    new Grid(1, 1)
      .carve()
      .west()
      .east()
      .ledge(7, 13, 15)
      .ledge(26, 32, 15)
      .ledge(15, 24, 10)
      .fill(17, 20, 19, 20, 'g')
      .mark(5, F, 'B')
      .mark(34, F, 'B')
      .mark(20, F, 'c')
      .mark(12, F, 'e')
      .mark(28, F, 'e')
      .mark(20, 6, 'f')
      .put(9, 3, 'k'),
  ),
  t(
    'The Flooded Aisle',
    'combat',
    new Grid(1, 1)
      .carve()
      .west()
      .east()
      .fill(8, 20, 14, 21, '~')
      .fill(24, 20, 31, 21, '~')
      .block(17, 17, 21, 19)
      .ledge(9, 13, 14)
      .ledge(25, 30, 14)
      .mark(5, F, 's')
      .mark(19, 16, 'c')
      .mark(35, F, 'B')
      .mark(19, 16, 'e')
      .mark(34, F, 'e')
      .mark(12, 7, 'f'),
  ),
  t(
    'The Pendulum Walk',
    'combat',
    new Grid(1, 1)
      .carve()
      .west()
      .east()
      .put(12, 2, 'P')
      .put(27, 2, 'P')
      .ledge(17, 22, 15)
      .mark(5, F, 'c')
      .mark(20, F, 's')
      .mark(35, F, 'c')
      .mark(20, F, 'e')
      .mark(31, F, 'e')
      .fill(15, F, 16, F, '^')
      .fill(24, F, 25, F, '^'),
  ),
  t(
    'The Thorned Dais',
    'combat',
    new Grid(1, 1)
      .carve()
      .west()
      .east()
      .block(12, 17, 27, 19)
      .block(16, 14, 23, 16)
      .fill(5, F, 10, F, '^')
      .fill(29, F, 34, F, '^')
      .ledge(3, 8, 15)
      .ledge(31, 36, 15)
      .mark(20, 13, 's')
      .mark(14, 16, 'c')
      .mark(25, 16, 'c')
      .mark(19, 13, 'e')
      .mark(13, 16, 'e')
      .mark(5, 8, 'f'),
  ),

  // --- Combat, two screens wide --------------------------------------------
  t(
    'The Long Nave',
    'combat',
    new Grid(2, 1)
      .carve()
      .west()
      .east()
      .ledge(8, 16, 15)
      .ledge(18, 28, 11)
      .ledge(30, 44, 15)
      .ledge(46, 56, 11)
      .ledge(58, 72, 15)
      .fill(37, 20, 43, 20, 'g')
      .mark(6, F, 'B')
      .mark(18, F, 'c')
      .mark(30, F, 's')
      .mark(50, F, 'B')
      .mark(62, F, 'c')
      .mark(74, F, 'B')
      .put(14, 3, 'k')
      .put(40, 3, 'k')
      .put(66, 3, 'k')
      .mark(20, F, 'e')
      .mark(44, F, 'E')
      .mark(60, F, 'e')
      .mark(27, 7, 'f')
      .mark(53, 7, 'f'),
    1.4,
  ),
  t(
    'The Choir Loft',
    'combat',
    new Grid(2, 1)
      .carve()
      .west()
      .east()
      .block(14, 17, 65, 19)
      .block(20, 14, 59, 16)
      .block(28, 11, 51, 13)
      .ledge(5, 11, 15)
      .ledge(68, 74, 15)
      .fill(36, 10, 43, 10, '^')
      .mark(9, F, 'c')
      .mark(24, 13, 'B')
      .mark(55, 13, 'B')
      .mark(32, 10, 's')
      .mark(47, 10, 's')
      .mark(70, F, 'c')
      .mark(17, 16, 'e')
      .mark(30, 10, 'e')
      .mark(50, 10, 'e')
      .mark(62, 16, 'e')
      .mark(40, 5, 'f'),
    1.2,
  ),
  t(
    'The Drowned Sacristy',
    'combat',
    new Grid(2, 1)
      .carve()
      .west()
      .east()
      .fill(6, 20, 73, 21, '~')
      .block(4, 20, 5, 21)
      .block(14, 16, 19, 21)
      .block(30, 18, 35, 21)
      .block(46, 16, 51, 21)
      .block(62, 18, 67, 21)
      .ledge(22, 27, 12)
      .ledge(38, 43, 10)
      .ledge(54, 59, 12)
      .chain(40, 2, 9)
      .mark(16, 15, 'c')
      .mark(32, 17, 's')
      .mark(48, 15, 'c')
      .mark(64, 17, 's')
      .mark(17, 15, 'e')
      .mark(49, 15, 'e')
      .mark(33, 17, 'e')
      .mark(25, 6, 'f')
      .mark(57, 6, 'f'),
  ),

  // --- Vertical ----------------------------------------------------------------
  t(
    'The Bell Shaft',
    'combat',
    new Grid(1, 2)
      .carve()
      .north(0, 8)
      .south(0, 44)
      .west(0)
      .east(0)
      .west(1)
      .east(1)
      .block(1, 20, 12, 20)
      .block(27, 20, 38, 20)
      .ledge(14, 25, 20)
      .ledge(5, 12, 34)
      .ledge(27, 34, 34)
      .ledge(14, 25, 28)
      .ledge(8, 13, 24)
      .ledge(26, 31, 24)
      .ledge(15, 24, 9)
      .ladder(19, 9, 19)
      .ladder(19, 29, 43)
      .put(8, 3, 'k')
      .mark(6, F, 'c')
      .mark(33, F, 'c')
      .mark(9, 33, 'e')
      .mark(31, 33, 'e')
      .mark(20, 40, 's')
      .mark(30, 26, 'f'),
  ),
  t(
    'The Ossuary Well',
    'combat',
    new Grid(1, 2)
      .carve()
      .north(0, 11)
      .west(1)
      .east(1)
      // A zigzag of bone ledges up the well, four rows apart
      .ledge(6, 14, 40)
      .ledge(16, 24, 36)
      .ledge(26, 34, 32)
      .ledge(16, 24, 28)
      .ledge(6, 14, 24)
      .ledge(16, 24, 20)
      .ledge(26, 34, 16)
      .ledge(15, 23, 12)
      .chain(4, 18, 34)
      .chain(36, 12, 30)
      .mark(30, 31, 'e')
      .mark(10, 23, 'e')
      .mark(20, 18, 'f')
      .mark(10, 36, 'f')
      .mark(6, CH + F, 'c')
      .mark(20, CH + F, 's')
      .mark(34, CH + F, 'c'),
    0.9,
  ),
  t(
    'The Crypt Descent',
    'combat',
    new Grid(1, 2)
      .carve()
      .south(0, CH + FLOOR_ROW)
      .west(0)
      .east(0)
      .block(1, 20, 14, 20)
      .block(25, 20, 38, 20)
      .ledge(15, 24, 25)
      .ledge(4, 12, 30)
      .ledge(27, 35, 30)
      .ledge(14, 25, 36)
      .ladder(8, 31, CH + F)
      .mark(5, F, 'B')
      .mark(34, F, 'B')
      .mark(8, 29, 'e')
      .mark(31, 29, 'e')
      .mark(20, CH + F, 'e')
      .mark(20, 30, 'f')
      .mark(30, CH + F, 's'),
    0.9,
  ),
  t(
    'A Ladder Landing',
    'combat',
    new Grid(1, 1).carve().west().east().north(0, F).ledge(10, 16, 15).ledge(23, 29, 15).mark(6, F, 'c').mark(33, F, 's').mark(12, F, 'e').mark(28, F, 'e'),
    0.8,
  ),
  t(
    'A Broken Floor',
    'combat',
    new Grid(1, 1).carve().west().east().south(0, FLOOR_ROW).ledge(8, 14, 15).ledge(25, 31, 15).mark(5, F, 's').mark(34, F, 'c').mark(11, F, 'e').mark(29, F, 'e').mark(20, 8, 'f'),
    0.8,
  ),
  t(
    'The Crossing',
    'combat',
    new Grid(1, 1).carve().west().east().north(0, F).south(0, FLOOR_ROW).ledge(4, 12, 15).ledge(27, 35, 15).mark(8, F, 'B').mark(31, F, 'B').mark(13, F, 'e').mark(27, F, 'e'),
    0.8,
  ),

  // --- Special rooms (dead ends) -----------------------------------------------
  t(
    'A Side Chapel',
    'special',
    new Grid(1, 1).carve().west().east().mark(20, F, 'X').mark(8, F, 'c').mark(31, F, 'c').mark(13, F, 's').mark(27, F, 's').put(20, 3, 'k').ledge(15, 25, 15),
    1,
  ),
  t(
    'A Sunken Chapel',
    'pit',
    new Grid(1, 1).carve().north(0, 14).ledge(14, 25, 15).mark(26, F, 'X').mark(8, F, 'c').mark(33, F, 'c').mark(12, F, 's'),
    1,
  ),
  t(
    'A High Reliquary',
    'loft',
    new Grid(1, 1).carve().south(0, FLOOR_ROW).mark(26, F, 'X').mark(8, F, 'c').mark(33, F, 'c').mark(12, F, 's').put(26, 3, 'k'),
    1,
  ),

  // --- The way to the boss ------------------------------------------------------
  t(
    'The Antechamber of the Ear',
    'ante',
    new Grid(1, 1).carve().west().mark(8, F, 'c').mark(13, F, 'B').mark(19, F, 'V').mark(26, F, 's').mark(34, F, 'D').put(12, 3, 'k').put(28, 3, 'k'),
    1,
  ),
];
