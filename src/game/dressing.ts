import Phaser from 'phaser';
import { DEPTH } from './config';
import type { Level } from './level';

/**
 * Set dressing laid procedurally over a generated level, after Blasphemous:
 * chunky flagstone caps along every exposed floor (so the 16px grid stops
 * reading as a grid), rubble, skulls, coffins and candles standing on the
 * floors, drips, stalactites and lanterns hanging from ceilings and ledges,
 * and cobwebs in the corners. Each area (theme) dresses differently.
 *
 * Objects are grouped per region so only those near the camera are drawn.
 */
export type DressTheme = 'marble' | 'crypt' | 'bridge' | 'cistern';

export interface Region {
  x0: number; // tiles, inclusive
  y0: number;
  x1: number;
  y1: number;
  theme: DressTheme;
}

interface Group {
  layer: Phaser.GameObjects.Layer;
  caps: Phaser.GameObjects.Layer;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CAP_SET: Record<DressTheme, string> = { marble: 'marble', bridge: 'marble', crypt: 'crypt', cistern: 'cistern' };

const STANDING: Record<DressTheme, [string, number][]> = {
  marble: [['deco-rubble-0', 3], ['deco-rubble-1', 2], ['deco-urn', 2], ['deco-candles', 3], ['deco-bones', 2], ['deco-column-broken', 1], ['deco-bloodpool', 2], ['deco-skulls-0', 1]],
  crypt: [['deco-rubble-0', 2], ['deco-rubble-2', 2], ['deco-skulls-0', 3], ['deco-skulls-1', 2], ['deco-bones', 3], ['deco-coffin', 2], ['deco-coffin-open', 2], ['deco-candles', 2], ['deco-bloodpool', 2]],
  bridge: [['deco-rubble-1', 2], ['deco-rubble-2', 1], ['deco-bloodpool', 2], ['deco-bones', 1]],
  cistern: [['deco-rubble-0', 2], ['deco-bones', 2], ['deco-skulls-1', 1], ['deco-bloodpool', 2]],
};

/** Small things that fit on a narrow one-way ledge. */
const LEDGE_OK = new Set(['deco-candles', 'deco-bones', 'deco-skulls-0', 'deco-skulls-1', 'deco-urn', 'deco-bloodpool']);

const DRIPS: Record<DressTheme, string> = { marble: 'drips-marble', bridge: 'drips-marble', crypt: 'drips-crypt', cistern: 'drips-rot' };

export interface DressingHooks {
  /** Register a texture swap for the rot (lie -> truth). */
  swap?: (img: Phaser.GameObjects.Image, lie: string, truth: string) => void;
  /** A warm light pool for a lantern. */
  light?: (x: number, y: number) => void;
  /** Keep dressing clear of these tiles (doors, shrines, features). */
  blocked?: (tx: number, ty: number) => boolean;
}

export class Dressing {
  private groups: Group[] = [];
  private capLayer!: Phaser.GameObjects.Layer;

  constructor(
    private scene: Phaser.Scene,
    private level: Level,
    regions: Region[],
    seed: number,
    private hooks: DressingHooks = {},
  ) {
    const rnd = new Phaser.Math.RandomDataGenerator([`dress-${seed}`]);
    for (const r of regions) {
      const layer = scene.add.layer().setDepth(DEPTH.props + 1);
      const caps = scene.add.layer().setDepth(DEPTH.tiles + 3); // over the stone, under the blood
      this.capLayer = caps;
      this.groups.push({ layer, caps, x0: r.x0 * 16, y0: r.y0 * 16, x1: (r.x1 + 1) * 16, y1: (r.y1 + 1) * 16 });
      this.dress(r, layer, rnd);
    }
  }

  private has(key: string) {
    return this.scene.textures.exists(key);
  }

  private dress(r: Region, layer: Phaser.GameObjects.Layer, rnd: Phaser.Math.RandomDataGenerator) {
    const L = this.level;
    const sc = this.scene;
    const solid = (x: number, y: number) => L.solidAt(x, y);
    const air = (x: number, y: number) => !L.solidAt(x, y) && L.ch(x, y) !== '~' && !L.oneWayAt(x, y);
    const capSet = CAP_SET[r.theme];

    for (let ty = r.y0 + 1; ty <= r.y1; ty++) {
      // --- Floors: runs of solid tiles with open air above -------------------
      let x = r.x0;
      while (x <= r.x1) {
        if (!(solid(x, ty) && air(x, ty - 1) && L.ch(x, ty) !== 'w')) {
          x++;
          continue;
        }
        let e = x;
        while (e + 1 <= r.x1 && solid(e + 1, ty) && air(e + 1, ty - 1) && L.ch(e + 1, ty) !== 'w') e++;
        this.floorRun(r, layer, rnd, x, e, ty, capSet, false);
        x = e + 1;
      }
      // --- One-way ledges ------------------------------------------------------
      x = r.x0;
      while (x <= r.x1) {
        if (!(L.ch(x, ty) === '=' && air(x, ty - 1))) {
          x++;
          continue;
        }
        let e = x;
        while (e + 1 <= r.x1 && L.ch(e + 1, ty) === '=') e++;
        this.floorRun(r, layer, rnd, x, e, ty, capSet, true);
        // Drips under the ledge
        for (let dx = x; dx <= e; dx += rnd.between(2, 4)) {
          if (rnd.frac() < 0.45) this.hang(layer, rnd, `${DRIPS[r.theme]}-${rnd.between(0, 2)}`, dx * 16 + 8, ty * 16 + 7);
        }
        x = e + 1;
      }
      // --- Ceilings: solid tiles with air beneath ---------------------------------
      x = r.x0;
      while (x <= r.x1) {
        if (!(solid(x, ty - 1) && air(x, ty) && air(x, ty + 1))) {
          x++;
          continue;
        }
        let e = x;
        while (e + 1 <= r.x1 && solid(e + 1, ty - 1) && air(e + 1, ty) && air(e + 1, ty + 1)) e++;
        if (r.theme !== 'bridge') this.ceilingRun(r, layer, rnd, x, e, ty);
        x = e + 1;
      }
    }

    // --- Cobwebs in the inside corners of the vaults -----------------------------
    if (r.theme !== 'bridge' && this.has('web-l'))
      for (let ty = r.y0 + 1; ty <= r.y1; ty++)
        for (let tx = r.x0; tx <= r.x1; tx++) {
          if (!air(tx, ty) || !solid(tx, ty - 1)) continue;
          if (solid(tx - 1, ty) && solid(tx - 1, ty - 1) && rnd.frac() < 0.55) layer.add(sc.add.image(tx * 16, ty * 16, 'web-l').setOrigin(0, 0).setAlpha(0.85));
          if (solid(tx + 1, ty) && solid(tx + 1, ty - 1) && rnd.frac() < 0.55) layer.add(sc.add.image((tx + 1) * 16, ty * 16, 'web-r').setOrigin(1, 0).setAlpha(0.85));
        }
  }

  /** Lay caps along a floor run and stand a few things on it. */
  private floorRun(r: Region, layer: Phaser.GameObjects.Layer, rnd: Phaser.Math.RandomDataGenerator, x0: number, x1: number, ty: number, capSet: string, ledge: boolean) {
    const sc = this.scene;
    const y = ty * 16;
    const blocked = (x: number) => this.hooks.blocked?.(x, ty - 1) ?? false;
    // Flagstone caps, three tiles per stone course, cropped at the end of the run
    if (!ledge && this.has(`cap-${capSet}-0`)) {
      for (let x = x0; x <= x1; x += 3) {
        const i = rnd.between(0, 3);
        const key = `cap-${capSet}-${i}`;
        const img = sc.add.image(x * 16, y - 4, key).setOrigin(0, 0);
        const w = Math.min(48, (x1 - x + 1) * 16);
        if (w < 48) img.setCrop(0, 0, w, 16);
        this.capLayer.add(img);
        if (capSet === 'marble' && this.has(`cap-rot-${i}`)) this.hooks.swap?.(img, key, `cap-rot-${i}`);
      }
    }
    // Things standing on the floor, spaced out and never on doorways/shrines
    const pool = STANDING[r.theme].filter(([k]) => this.has(k) && (!ledge || LEDGE_OK.has(k)));
    if (pool.length) {
      const total = pool.reduce((a, [, w]) => a + w, 0);
      let x = x0 + rnd.between(1, 4);
      while (x <= x1 - 1) {
        if (!blocked(x) && !blocked(x - 1) && !blocked(x + 1) && rnd.frac() < (ledge ? 0.35 : 0.6)) {
          let pick = rnd.frac() * total;
          let key = pool[0][0];
          for (const [k, w] of pool) if ((pick -= w) <= 0) ((key = k), (pick = Infinity));
          const img = sc.add.image(x * 16 + rnd.between(0, 15), y + 1, key).setOrigin(0.5, 1).setFlipX(rnd.frac() < 0.5);
          layer.add(img);
          if (key === 'deco-candles') this.hooks.light?.(img.x, y - 8);
        }
        x += rnd.between(ledge ? 3 : 4, ledge ? 6 : 9);
      }
    }
    // The bridge: lamp posts and statues march along the deck
    if (r.theme === 'bridge' && !ledge) {
      for (let x = x0 + 3; x <= x1 - 2; x += 9) {
        if (blocked(x)) continue;
        const key = (x / 9) % 2 < 1 ? 'deco-lamppost' : 'deco-statue';
        if (!this.has(key)) continue;
        layer.add(sc.add.image(x * 16 + 8, y + 1, key).setOrigin(0.5, 1));
        if (key === 'deco-lamppost') this.hooks.light?.(x * 16 + 8, y - 58);
      }
    }
  }

  private ceilingRun(r: Region, layer: Phaser.GameObjects.Layer, rnd: Phaser.Math.RandomDataGenerator, x0: number, x1: number, ty: number) {
    const y = ty * 16;
    for (let x = x0; x <= x1; x += rnd.between(1, 3)) {
      const roll = rnd.frac();
      if (r.theme === 'crypt' && roll < 0.12) this.hang(layer, rnd, 'deco-stalactites', x * 16 + 8, y);
      else if (roll < 0.4) this.hang(layer, rnd, `${DRIPS[r.theme]}-${rnd.between(0, 2)}`, x * 16 + 8, y);
    }
    // Now and then a lantern or a hanging censer, on a long run of vault
    if (x1 - x0 > 8 && rnd.frac() < 0.5) {
      const x = rnd.between(x0 + 2, x1 - 2);
      const key = rnd.frac() < 0.6 ? 'deco-lantern' : 'deco-censer-hang';
      if (this.has(key)) {
        const img = this.hang(layer, rnd, key, x * 16 + 8, y);
        if (img && key === 'deco-lantern') {
          this.hooks.light?.(img.x, y + img.height - 10);
          this.scene.tweens.add({ targets: img, angle: { from: -2, to: 2 }, duration: 2200 + rnd.between(0, 900), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        }
      }
    }
  }

  private hang(layer: Phaser.GameObjects.Layer, rnd: Phaser.Math.RandomDataGenerator, key: string, x: number, y: number) {
    if (!this.has(key)) return null;
    const img = this.scene.add.image(x + rnd.between(-3, 3), y, key).setOrigin(0.5, 0).setFlipX(rnd.frac() < 0.5);
    layer.add(img);
    return img;
  }

  /** Show only regions near the camera. */
  update() {
    const v = this.scene.cameras.main.worldView;
    const m = 96;
    for (const g of this.groups) {
      const on = g.x1 > v.x - m && g.x0 < v.right + m && g.y1 > v.y - m && g.y0 < v.bottom + m;
      if (g.layer.visible !== on) {
        g.layer.setVisible(on);
        g.caps.setVisible(on);
      }
    }
  }

  destroy() {
    for (const g of this.groups) {
      g.layer.destroy();
      g.caps.destroy();
    }
    this.groups = [];
  }
}
