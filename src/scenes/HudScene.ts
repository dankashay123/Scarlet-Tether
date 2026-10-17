import Phaser from 'phaser';
import { uiH, uiSpace, uiW, ux, uy } from '../ui/uispace';
import { P, hexNum, mix } from '../art/palette';
import {
  BAR_FILL_Y,
  BOSS_END,
  BOSS_FILL_Y,
  HUD_BARS,
  MINI_H,
  MINI_W,
  makeBossBar,
  makePanel,
  makeRule,
  makeSelBar,
  makeSep,
} from '../art/ui';
import { controls, hudState, type Action } from '../game/controls';
import { currentRun, hasSacrament, meta } from '../game/state';
import { sfx } from '../game/audio';
import { safeInsets } from '../ui/safearea';
import { FAKE_ACHIEVEMENTS, UI_LIES } from '../game/lore';
import { GameText, txt, type Face } from '../ui/text';

interface Btn {
  action: Action;
  img: Phaser.GameObjects.Image;
  key: string;
  r: number;
  visible: boolean;
  pointer: number | null;
  scale?: number;
}

export interface MenuOption {
  label: string;
  desc?: string;
  disabled?: boolean;
  tint?: number;
}

export interface MenuSpec {
  title: string;
  body?: string;
  options: MenuOption[];
  cancel?: string; // adds a final "leave" option returning -1
  /** Option chosen by Escape when there is no cancel option. */
  escape?: number;
  width?: number;
}

const DEPTH_MODAL = 100;

export class HudScene extends Phaser.Scene {
  private btns: Btn[] = [];
  private stickBase!: Phaser.GameObjects.Image;
  private stickKnob!: Phaser.GameObjects.Image;
  private stickPointer: number | null = null;
  private stickOrigin = new Phaser.Math.Vector2();
  private stickHome = new Phaser.Math.Vector2();
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private keyWasDown: Record<string, boolean> = {};

  private runLayer!: Phaser.GameObjects.Container;
  private bars!: Phaser.GameObjects.Graphics;
  private mini!: Phaser.GameObjects.Graphics;
  private miniMask!: Phaser.GameObjects.Graphics;
  private miniRect = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private miniFrameImg!: Phaser.GameObjects.Image;
  private medal!: Phaser.GameObjects.Image;
  private cracks!: Phaser.GameObjects.Image;
  private bleed!: Phaser.GameObjects.Image;
  private fills: Record<'hp' | 'trail' | 'veil' | 'censer' | 'lucid', Phaser.GameObjects.Image> = {} as never;
  private tearCoin!: Phaser.GameObjects.Image;
  private vertCoin!: Phaser.GameObjects.Image;
  private tearsText!: GameText;
  private vertText!: GameText;
  private lieText!: GameText;
  private bossName!: GameText;
  private boss!: { frame: Phaser.GameObjects.Image; fill: Phaser.GameObjects.Image; trail: Phaser.GameObjects.Image; w: number; x: number; y: number };
  /** Run-HUD objects placed in screen space (DOM text must not sit in the offset container). */
  private runAbs: (Phaser.GameObjects.Image | GameText)[] = [];
  private counts = '';
  private shownHp = 1;
  private trailHp = 1;
  private shownBoss = 1;
  private trailBoss = 1;
  private lieUntil = 0;
  private emptyLieUntil = 0;
  private nextLie = 0;

  modal = false;
  private modalLayer: Phaser.GameObjects.Container | null = null;
  private modalTap: ((p: { x: number; y: number }) => void) | null = null;
  private modalKey: ((k: string) => void) | null = null;
  private inset = { left: 0, right: 0, top: 0, bottom: 0 };
  private interactLabel!: GameText;
  private shellText!: GameText;
  private controlsVisible = true;

  constructor() {
    super('Hud');
  }

  create() {
    uiSpace(this);
    this.input.addPointer(3);
    this.inset = safeInsets(this.W);
    this.buildInkFrame();
    this.buildRunHud();
    this.buildControls();
    this.buildKeyboard();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.input.on('pointerupoutside', this.onUp, this);
    this.scale.on('resize', () => this.layout());
    this.layout();
    this.setControlsVisible(this.controlsVisible);
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  private get W() {
    return uiW(this);
  }
  private get H() {
    return uiH(this);
  }

  layout() {
    this.inset = safeInsets(this.W);
    const st = meta().settings;
    const k = st.bigButtons ? 1.25 : 1;
    const lefty = st.leftHanded;
    const R = this.W - Math.max(8, this.inset.right);
    const B = this.H - Math.max(6, this.inset.bottom);
    const L = Math.max(10, this.inset.left);
    // Offsets from the bottom corner of the button cluster.
    const place: Record<string, [number, number]> = {
      jump: [36, 34],
      attack: [92, 46],
      dodge: [44, 92],
      execute: [100, 106],
      speak: [100, 106],
      aim: [146, 30],
      weapon: [150, 82],
      stigma: [196, 66],
      tear: [190, 22],
    };
    for (const b of this.btns) {
      if (b.action === 'pause') {
        b.img.setPosition(R - 10, 16);
        continue;
      }
      const [ox, oy] = place[b.action];
      const x = lefty ? L + ox * k : R - ox * k;
      b.img.setPosition(x, B - oy * k).setScale(k);
      b.scale = k;
    }
    this.stickHome.set(lefty ? R - 58 : L + 58, B - 52);
    this.stickBase.setScale(k);
    this.stickKnob.setScale(k);
    if (this.stickPointer === null) {
      this.stickBase.setPosition(this.stickHome.x, this.stickHome.y);
      this.stickKnob.setPosition(this.stickHome.x, this.stickHome.y);
    }
    // The run HUD's vials shift right past a notch (container space);
    // everything on the right and all text is placed in screen space.
    const off = L - 8;
    this.runLayer.setX(off);
    this.lieText.setPosition(L + 2, 50);
    this.counts = '';
    this.layoutBossBar(k, lefty);
    this.interactLabel.setPosition(lefty ? L + 100 * k : R - 100 * k, B - 128 * k);
  }

  /** The boss bar sits on the bottom edge, in the gap between stick and buttons. */
  private layoutBossBar(k: number, lefty: boolean) {
    const barH = 18;
    const by = Math.round(this.H - Math.max(4, this.inset.bottom) - barH);
    const nameTop = by - 16;
    const stickR = 30 * k;
    let gapL: number;
    let gapR: number;
    const low = this.btns.filter((b) => b.action !== 'pause' && b.img.y + b.r * k > nameTop);
    if (!lefty) {
      gapL = this.stickHome.x + stickR + 10;
      gapR = Math.min(...low.map((b) => b.img.x - b.r * k)) - 10;
    } else {
      gapL = Math.max(...low.map((b) => b.img.x + b.r * k)) + 10;
      gapR = this.stickHome.x - stickR - 10;
    }
    const bw = Math.round(Phaser.Math.Clamp(gapR - gapL, 150, 340) / 2) * 2;
    const cx = Phaser.Math.Clamp(this.W / 2, gapL + bw / 2, Math.max(gapL + bw / 2, gapR - bw / 2));
    const bx = Math.round(cx - bw / 2);
    const keys = makeBossBar(this, bw);
    const b = this.boss;
    b.frame.setTexture(keys.frame).setPosition(bx, by);
    b.fill.setTexture(keys.fill).setPosition(bx + BOSS_END, by + BOSS_FILL_Y);
    b.trail.setTexture(keys.trail).setPosition(bx + BOSS_END, by + BOSS_FILL_Y);
    b.w = bw;
    b.x = bx;
    b.y = by;
    this.bossName.setPosition(Math.round(cx) - 200, by - 13);
  }

  // -------------------------------------------------------------------------
  // Run HUD: Reliquary, Censer, Lucidity, Tears
  // -------------------------------------------------------------------------

  // Container-space anchors of the medallion and its vials
  private static MEDAL_X = 4;
  private static MEDAL_Y = 2;
  private static BAR_X: Record<string, number> = { hp: 34, censer: 40, lucid: 40 };
  private static BAR_Y: Record<string, number> = { hp: 8, censer: 18, lucid: 26 };

  private buildRunHud() {
    this.runLayer = this.add.container(0, 0).setDepth(10);
    this.bars = this.add.graphics();
    this.mini = this.add.graphics().setDepth(11);
    this.miniMask = this.make.graphics({}, false);
    this.mini.setMask(this.miniMask.createGeometryMask());
    this.miniFrameImg = this.add.image(0, 0, 'hud-mini-frame').setOrigin(0).setDepth(12).setVisible(false);
    // Three vials emerging from behind the medallion: blood, censer smoke, lucidity
    const bx = HudScene.BAR_X;
    const parts: Phaser.GameObjects.GameObject[] = [];
    for (const [key] of HUD_BARS) parts.push(this.add.image(bx[key], HudScene.BAR_Y[key], `hud-bar-${key}`).setOrigin(0));
    const fy = (k: string) => HudScene.BAR_Y[k] + BAR_FILL_Y;
    this.fills.trail = this.add.image(bx.hp, fy('hp'), 'hud-fill-trail').setOrigin(0);
    this.fills.hp = this.add.image(bx.hp, fy('hp'), 'hud-fill-hp').setOrigin(0);
    this.fills.veil = this.add.image(bx.hp, fy('hp'), 'hud-fill-veil').setOrigin(0).setVisible(false);
    this.fills.censer = this.add.image(bx.censer, fy('censer'), 'hud-fill-censer').setOrigin(0);
    this.fills.lucid = this.add.image(bx.lucid, fy('lucid'), 'hud-fill-lucid').setOrigin(0);
    // The portrait medallion over the vials' ends; it cracks as the mind goes, weeps as the body does
    this.medal = this.add.image(HudScene.MEDAL_X, HudScene.MEDAL_Y, 'hud-medallion').setOrigin(0);
    this.bleed = this.add.image(HudScene.MEDAL_X, HudScene.MEDAL_Y, 'hud-medallion-blood').setOrigin(0).setAlpha(0);
    this.cracks = this.add.image(HudScene.MEDAL_X, HudScene.MEDAL_Y, 'hud-medallion-cracks').setOrigin(0).setAlpha(0);
    this.runLayer.add([
      ...parts,
      this.fills.trail,
      this.fills.hp,
      this.fills.veil,
      this.fills.censer,
      this.fills.lucid,
      this.bars,
      this.medal,
      this.bleed,
      this.cracks,
    ]);
    // Screen space: counters, lies, the boss bar
    this.tearCoin = this.add.image(0, 0, 'hud-coin-tear').setDepth(10);
    this.vertCoin = this.add.image(0, 0, 'hud-coin-vert').setDepth(10);
    this.tearsText = txt(this, 0, 0, '0', 'head', 12).setOrigin(1, 0.5).setTint(hexNum(P.bone0));
    this.vertText = txt(this, 0, 0, '0', 'head', 12).setOrigin(1, 0.5).setTint(hexNum(P.bone0));
    this.lieText = txt(this, 12, 50, '', 'label', 11).setItalic().setTint(hexNum(P.blood0)).setAlpha(0);
    // Centred by CSS in a fixed box: origins measure a hidden node as zero wide
    this.bossName = txt(this, 0, 0, '', 'head', 12).setMaxWidth(400).setCenterAlign().setTint(hexNum(P.bone0));
    this.boss = {
      frame: this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(10),
      trail: this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(10),
      fill: this.add.image(0, 0, '__DEFAULT').setOrigin(0).setDepth(10),
      w: 0,
      x: 0,
      y: 0,
    };
    this.runAbs = [this.tearCoin, this.vertCoin, this.tearsText, this.vertText, this.lieText];
    this.runLayer.setVisible(false);
    for (const o of this.runAbs) o.setVisible(false);
    this.setBossVisible(false);
  }

  private bossShown = true;
  private setBossVisible(v: boolean) {
    if (v === this.bossShown) return;
    this.bossShown = v;
    this.boss.frame.setVisible(v);
    this.boss.fill.setVisible(v);
    this.boss.trail.setVisible(v);
    this.bossName.setVisible(v);
    if (!v) this.shownBoss = this.trailBoss = 1;
  }

  /** Tears and vertebrae beneath the minimap, right-aligned, each with its coin. */
  private updateCounters() {
    const run = currentRun();
    const key = `${run.tears}|${run.vertebrae}`;
    if (key === this.counts) return;
    this.counts = key;
    this.tearsText.setText(String(run.tears));
    this.vertText.setText(String(run.vertebrae));
    const R = this.W - Math.max(8, this.inset.right);
    const y = 9 + MINI_H + 15;
    const tx = R - 32;
    this.tearCoin.setPosition(tx, y);
    this.tearsText.setPosition(tx - 10, y);
    // A node shown this very frame still measures zero: try again next frame
    if (!this.tearsText.width) this.counts = '';
    const vx = Math.round(tx - 10 - this.tearsText.width - 18);
    this.vertCoin.setPosition(vx, y);
    this.vertText.setPosition(vx - 10, y);
  }

  /** Crop one vial's fill to a fraction of its length. */
  private crop(img: Phaser.GameObjects.Image, frac: number) {
    const w = Math.round(img.frame.realWidth * Phaser.Math.Clamp(frac, 0, 1));
    img.setVisible(w > 0);
    if (w > 0) img.setCrop(0, 0, w, img.frame.realHeight);
    return w;
  }

  private drawBars() {
    const g = this.bars;
    g.clear();
    const run = currentRun();
    const t = this.time.now;
    const ox = -(this.runLayer.x || 0);
    // The descent as a rosary: one bead per room, the last an ear.
    if (hudState.depth >= 0 && !hudState.bossVisible) {
      const n = hudState.totalDepth;
      const sp = 9;
      const bx = Math.round(this.W / 2 - ((n - 1) * sp) / 2) + ox;
      g.fillStyle(hexNum(P.gold3), 1).fillRect(bx, 9, (n - 1) * sp, 1);
      for (let i = 0; i < n; i++) {
        const x = bx + i * sp;
        const boss = i === n - 1;
        const col = i < hudState.depth ? P.gold1 : i === hudState.depth ? P.blood0 : P.shadow2;
        const r = boss ? 3 : 2;
        g.fillStyle(hexNum(P.ink), 1).fillRect(x - r - 1, 9 - r - 1, r * 2 + 3, r * 2 + 3);
        g.fillStyle(hexNum(boss && i > hudState.depth ? P.flesh3 : col), 1).fillRect(x - r, 9 - r, r * 2 + 1, r * 2 + 1);
        if (i === hudState.depth && Math.floor(t / 400) % 2) g.fillStyle(hexNum(P.blood1), 1).fillRect(x - r, 9 - r, r * 2 + 1, r * 2 + 1);
      }
    }
    // The body failing: a red pulse at the edges of sight
    const frac = run.hp / run.maxHp;
    if (frac < 0.3 && run.hp > 0) {
      const a = (0.25 + 0.2 * Math.sin(t / 160)) * (1 - frac / 0.3);
      g.fillStyle(hexNum(P.blood2), a);
      g.fillRect(ox, 0, this.W, 6).fillRect(ox, this.H - 6, this.W, 6).fillRect(ox, 0, 6, this.H).fillRect(ox + this.W - 6, 0, 6, this.H);
      g.fillStyle(hexNum(P.blood3), a * 0.6);
      g.fillRect(ox + 6, 6, this.W - 12, 4).fillRect(ox + 6, this.H - 10, this.W - 12, 4).fillRect(ox + 6, 6, 4, this.H - 12).fillRect(ox + this.W - 10, 6, 4, this.H - 12);
    }
    // --- Blood (health) ---
    const target = Phaser.Math.Clamp(run.hp / run.maxHp, 0, 1);
    this.shownHp = Phaser.Math.Linear(this.shownHp, target, 0.35);
    if (this.trailHp < this.shownHp) this.trailHp = this.shownHp;
    else this.trailHp = Math.max(this.shownHp, this.trailHp - 0.006);
    const lying = run.lucidity < 30 && t < this.emptyLieUntil;
    const veiled = hasSacrament('mirror');
    const f = this.fills;
    f.veil.setVisible(veiled);
    if (!veiled) {
      const shown = lying ? 0 : this.shownHp;
      this.crop(f.trail, lying ? 0 : this.trailHp);
      const w = this.crop(f.hp, shown);
      // Meniscus wobble
      if (shown > 0.02) {
        const fy = HudScene.BAR_Y.hp + BAR_FILL_Y;
        g.fillStyle(hexNum('#ffb0a0'), 1).fillRect(HudScene.BAR_X.hp + w - 1, fy + (Math.floor(t / 200) % 2), 1, HUD_BARS[0][2] - 1);
      }
    } else {
      f.hp.setVisible(false);
      f.trail.setVisible(false);
    }
    this.bleed.setAlpha(Phaser.Math.Clamp((0.5 - target) * 2.4, 0, 1));
    // --- Censer (stamina) ---
    const choking = (this.registry.get('choking') as boolean) ?? false;
    this.crop(f.censer, run.stamina / run.maxStamina);
    if (choking && Math.floor(t / 120) % 2) f.censer.setTint(hexNum(P.blood1));
    else f.censer.clearTint();
    // --- Lucidity --- (the glass cracks as it fails)
    const lu = Phaser.Math.Clamp(run.lucidity / run.maxLucidity, 0, 1);
    const jitter = run.lucidity < 30 ? Math.round(Math.sin(t / 37) * 2) : 0;
    f.lucid.setX(HudScene.BAR_X.lucid + jitter);
    this.crop(f.lucid, lu);
    this.cracks.setAlpha(Phaser.Math.Clamp((0.6 - lu) * 2.2, 0, 1));
    // --- Boss ---
    this.setBossVisible(hudState.bossVisible);
    if (hudState.bossVisible) {
      const hp = Phaser.Math.Clamp(hudState.bossHp, 0, 1);
      this.shownBoss = Phaser.Math.Linear(this.shownBoss, hp, 0.3);
      if (this.trailBoss < this.shownBoss) this.trailBoss = this.shownBoss;
      else this.trailBoss = Math.max(this.shownBoss, this.trailBoss - 0.004);
      this.crop(this.boss.trail, this.trailBoss);
      this.crop(this.boss.fill, this.shownBoss);
      if (this.bossName.text !== hudState.bossName) this.bossName.setText(hudState.bossName);
    }
  }

  private updateLies() {
    const run = currentRun();
    const t = this.time.now;
    if (run.lucidity >= 30) {
      this.lieText.setAlpha(0);
      return;
    }
    if (t > this.nextLie) {
      this.nextLie = t + Phaser.Math.Between(5000, 11000);
      const roll = Math.random();
      if (roll < 0.4) this.emptyLieUntil = t + Phaser.Math.Between(900, 2200);
      else if (roll < 0.75) {
        this.lieText.setText(Phaser.Utils.Array.GetRandom(UI_LIES));
        this.lieUntil = t + 1800;
      } else this.toast(Phaser.Utils.Array.GetRandom(FAKE_ACHIEVEMENTS), P.gold1);
    }
    this.lieText.setAlpha(t < this.lieUntil ? 0.6 + Math.random() * 0.4 : 0);
    this.lieText.setX(Math.max(10, this.inset.left) + 2 + (Math.random() < 0.2 ? Phaser.Math.Between(-2, 2) : 0));
  }

  // -------------------------------------------------------------------------
  // Minimap & map screen
  // -------------------------------------------------------------------------

  /** Each region's muted fill on the map. */
  private static THEME_FILL: Record<string, string> = {
    marble: '#3b2d50', // the Nave: dusky violet
    crypt: '#173a33', // the Crypt: dark teal-green
    bridge: '#5c3b30', // the Bridge: rose-ochre
  };
  private static WALL = '#a88d62';

  /** Tiny gold map glyphs (7x7). g gold, G pale gold, d dark gold, r blood, w bone, b tear, f flesh, k ink. */
  private static ICONS: Record<string, string[]> = {
    confessional: ['...G...', '..dGd..', '.ggggg.', 'gdgkgdg', 'gdgkgdg', 'gdgkgdg', 'ggggggg'],
    votive: ['...g...', '..gGg..', '...g...', '..wwd..', '..wwd..', '..wwd..', '.ddddd.'],
    cache: ['.......', '.ddddd.', 'dgggggd', 'ddddddd', 'dgbGbgd', 'dgggggd', 'ddddddd'],
    elite: ['.rrrrr.', 'rrrrrrr', 'rkkrkkr', 'rrrrrrr', '.rrkrr.', '.r.r.r.', '.......'],
    ante: ['..fff..', '.f...f.', 'f..ff.f', 'f.f..f.', '...ff..', '..f....', '.rr....'],
  };
  private static ICON_COLS: Record<string, string> = {
    g: P.gold1,
    G: P.gold0,
    d: P.gold2,
    r: P.blood1,
    w: P.bone0,
    b: P.tear1,
    f: P.flesh1,
    k: P.ink,
  };

  private drawIcon(g: Phaser.GameObjects.Graphics, role: string, cx: number, cy: number, s: number) {
    const ic = HudScene.ICONS[role];
    if (!ic) return;
    const x0 = Math.round(cx - 3.5 * s);
    const y0 = Math.round(cy - 3.5 * s);
    // Drop shadow first, then the glyph
    g.fillStyle(hexNum(P.ink), 0.9);
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) if (ic[y][x] !== '.') g.fillRect(x0 + x * s + 1, y0 + y * s + 1, s, s);
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++) {
        const c = ic[y][x];
        if (c === '.') continue;
        g.fillStyle(hexNum(HudScene.ICON_COLS[c]), 1).fillRect(x0 + x * s, y0 + y * s, s, s);
      }
  }

  /**
   * Draw the rooms of the descent map into a graphics object, cell size cw x ch:
   * regions filled in their own muted colour, tan walls with gaps at doorways,
   * gold glyphs on rooms of note. lw is the wall thickness.
   */
  private drawMapRooms(g: Phaser.GameObjects.Graphics, ox: number, oy: number, cw: number, ch: number, lw = 1, icon = 1) {
    const m = hudState.map!;
    const t = this.time.now;
    const h0 = Math.floor(lw / 2);
    const fillOf = (r: (typeof m.rooms)[number], i: number) => {
      const base = HudScene.THEME_FILL[r.theme ?? 'marble'] ?? HudScene.THEME_FILL.marble;
      return i === m.current ? mix(base, '#c8a0a0', 0.22 + 0.08 * Math.sin(t / 260)) : base;
    };
    const box = (r: (typeof m.rooms)[number]) => [ox + r.x * cw, oy + r.y * ch, r.w * cw, r.h * ch] as const;
    // 1. Fills
    m.rooms.forEach((r, i) => {
      if (!r.seen) return;
      const [x, y, w, h] = box(r);
      g.fillStyle(hexNum(fillOf(r, i)), r.explored ? 1 : 0.32).fillRect(x, y, w, h);
    });
    // 2. Walls: solid where walked, dotted where only glimpsed through a door
    const wall = hexNum(HudScene.WALL);
    m.rooms.forEach((r) => {
      if (!r.seen) return;
      const [x, y, w, h] = box(r);
      if (r.explored) {
        g.fillStyle(wall, 1);
        g.fillRect(x - h0, y - h0, w + lw, lw).fillRect(x - h0, y + h - h0, w + lw, lw);
        g.fillRect(x - h0, y - h0, lw, h + lw).fillRect(x + w - h0, y - h0, lw, h + lw);
      } else {
        g.fillStyle(wall, 0.55);
        const step = lw * 3;
        for (let k = 0; k <= w; k += step) g.fillRect(x + k - h0, y - h0, lw, lw).fillRect(x + k - h0, y + h - h0, lw, lw);
        for (let k = 0; k <= h; k += step) g.fillRect(x - h0, y + k - h0, lw, lw).fillRect(x + w - h0, y + k - h0, lw, lw);
      }
    });
    // 3. Doorways: gaps in the walls of rooms walked
    m.rooms.forEach((r, i) => {
      if (!r.explored) return;
      const [x, y] = box(r);
      g.fillStyle(hexNum(fillOf(r, i)), 1);
      for (const [cx, cy, d] of r.links) {
        if (d === 'E' || d === 'W') {
          const wx = x + (d === 'E' ? cx + 1 : cx) * cw - h0;
          const gy0 = y + cy * ch + Math.round(ch * 0.4);
          const gy1 = y + (cy + 1) * ch - Math.max(lw + 1, Math.round(ch * 0.12));
          g.fillRect(wx, gy0, lw, Math.max(1, gy1 - gy0));
        } else {
          const wy = y + (d === 'S' ? cy + 1 : cy) * ch - h0;
          const gx0 = x + cx * cw + Math.round(cw * 0.3);
          g.fillRect(gx0, wy, Math.max(1, Math.round(cw * 0.4)), lw);
        }
      }
    });
    // 4. Glyphs
    m.rooms.forEach((r) => {
      if (!HudScene.ICONS[r.role] || !(r.explored || r.role === 'ante')) return;
      const [x, y, w, h] = box(r);
      this.drawIcon(g, r.role, x + w / 2, y + h / 2, icon);
    });
  }

  /** The penitent on the map: a pulsing blood-red diamond. */
  private drawMarker(g: Phaser.GameObjects.Graphics, x: number, y: number, s: number) {
    const t = this.time.now;
    const p = 0.5 + 0.5 * Math.sin(t / 180);
    x = Math.round(x);
    y = Math.round(y);
    g.fillStyle(hexNum(P.blood0), 0.25 + 0.25 * p).fillCircle(x, y, (3 + p * 2.5) * s);
    const d = 2 * s;
    g.fillStyle(hexNum(P.ink), 1).fillTriangle(x - d - 1, y, x, y - d - 1, x + d + 1, y).fillTriangle(x - d - 1, y, x, y + d + 1, x + d + 1, y);
    g.fillStyle(hexNum(p > 0.5 ? P.blood0 : P.blood1), 1).fillTriangle(x - d, y, x, y - d, x + d, y).fillTriangle(x - d, y, x, y + d, x + d, y);
    g.fillStyle(hexNum(P.white), 1).fillRect(x - Math.floor(s / 2), y - Math.floor(s / 2), s, s);
  }

  private drawMinimap() {
    const g = this.mini;
    g.clear();
    const m = hudState.map;
    if (!m || !hudState.inRun || this.modal) {
      this.miniFrameImg.setVisible(false);
      return;
    }
    const cw = 12;
    const ch = 7;
    const vw = MINI_W;
    const vh = MINI_H;
    const R = this.W - Math.max(8, this.inset.right);
    const x0 = R - vw - 26;
    const y0 = 9;
    if (this.miniRect.x !== x0 - 5) {
      this.miniRect.setTo(x0 - 5, y0 - 5, vw + 10, vh + 10);
      this.miniMask.clear().fillStyle(0xffffff).fillRect(x0, y0, vw, vh);
      this.miniFrameImg.setPosition(x0 - 5, y0 - 5);
    }
    this.miniFrameImg.setVisible(true);
    g.fillStyle(0x000000, 0.85).fillRect(x0, y0, vw, vh);
    this.drawMapRooms(g, Math.round(x0 + vw / 2 - m.px * cw), Math.round(y0 + vh / 2 - m.py * ch), cw, ch, 1, 1);
    this.drawMarker(g, x0 + vw / 2, y0 + vh / 2, 1);
  }

  /** The full map of this descent: regions in their colours on black, in a gilt panel. */
  showMap() {
    const m = hudState.map;
    if (!m || this.modal) return;
    sfx(this, 'page_turn');
    const layer = this.openModal();
    const pw = Math.min(this.W - 30, 620);
    const ph = this.H - 24;
    const px = Math.round((this.W - pw) / 2);
    const py = 12;
    const shade = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.72).setOrigin(0);
    const panel = this.add.image(px, py, makePanel(this, `panel-${pw}x${ph}`, pw, ph)).setOrigin(0);
    const title = txt(this, this.W / 2, py + 10, 'The Sunken Confessionals', 'head', 13).setOrigin(0.5, 0).setTint(hexNum(P.gold1));
    const rule = this.add.image(this.W / 2, py + 31, makeRule(this, 220)).setOrigin(0.5);
    // The map well: black, in a thin gilt rule
    const wx = px + 16;
    const wy = py + 42;
    const ww = pw - 32;
    const wh = ph - 42 - 34;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 1).fillRect(wx, wy, ww, wh);
    g.lineStyle(1, hexNum(P.gold3), 1).strokeRect(wx - 0.5, wy - 0.5, ww + 1, wh + 1);
    g.lineStyle(1, hexNum(P.gold2), 0.5).strokeRect(wx - 2.5, wy - 2.5, ww + 5, wh + 5);
    // Fit the explored part of the map, not the whole grid
    let gx0 = m.gw;
    let gy0 = m.gh;
    let gx1 = 0;
    let gy1 = 0;
    for (const r of m.rooms) {
      if (!r.seen) continue;
      gx0 = Math.min(gx0, r.x);
      gy0 = Math.min(gy0, r.y);
      gx1 = Math.max(gx1, r.x + r.w);
      gy1 = Math.max(gy1, r.y + r.h);
    }
    if (gx1 <= gx0) [gx0, gy0, gx1, gy1] = [0, 0, m.gw, m.gh];
    const sw = Math.max(gx1 - gx0, 6);
    const sh = Math.max(gy1 - gy0, 4);
    const cw = Math.max(6, Math.min(36, Math.floor((ww - 24) / sw), Math.floor(((wh - 20) / sh) * 1.75)));
    const ch = Math.max(4, Math.min(20, Math.floor(cw / 1.75), Math.floor((wh - 20) / sh)));
    const ox = Math.round(wx + ww / 2 - ((gx0 + gx1) / 2) * cw);
    const oy = Math.round(wy + wh / 2 - ((gy0 + gy1) / 2) * ch);
    const big = cw >= 16;
    const rooms = this.add.graphics();
    const marker = this.add.graphics();
    const paint = () => {
      rooms.clear();
      this.drawMapRooms(rooms, ox, oy, cw, ch, big ? 2 : 1, big ? 2 : 1);
      marker.clear();
      this.drawMarker(marker, ox + m.px * cw, oy + m.py * ch, big ? 2 : 1);
    };
    paint();
    const pulse = this.time.addEvent({ delay: 60, loop: true, callback: paint });
    const well = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(wx, wy, ww, wh);
    rooms.setMask(well.createGeometryMask());
    // Legend: glyphs, then the regions' colours
    const lg = this.add.graphics();
    const items: [string, string, boolean][] = [
      ['confessional', 'Confessional', true],
      ['votive', 'Votive', true],
      ['cache', 'Reliquary', true],
      ['elite', 'Heavier sin', true],
      ['ante', 'The Ear', true],
      ['marble', 'Nave', false],
      ['crypt', 'Crypt', false],
      ['bridge', 'Bridge', false],
    ];
    const ly = py + ph - 19;
    const labels = items.map(([, name]) => txt(this, 0, ly, name, 'body', 10).setOrigin(0, 0.5).setTint(hexNum(P.bone1)));
    const hint = txt(this, 0, ly, 'tap to close', 'body', 10).setItalic().setOrigin(1, 0.5).setTint(hexNum(P.marble4));
    const gap = 12;
    const total = labels.reduce((a, l) => a + 11 + l.width + gap, 0) - gap;
    let lx = Math.round(this.W / 2 - total / 2 - (hint.width + 16) / 2);
    items.forEach(([k, , glyph], i) => {
      if (glyph) this.drawIcon(lg, k, lx + 4, ly, 1);
      else {
        lg.fillStyle(hexNum(HudScene.WALL), 1).fillRect(lx, ly - 4, 8, 8);
        lg.fillStyle(hexNum(HudScene.THEME_FILL[k]), 1).fillRect(lx + 1, ly - 3, 6, 6);
      }
      labels[i].setX(lx + 11);
      lx += 11 + labels[i].width + gap;
    });
    hint.setX(px + pw - 14);
    lg.fillStyle(hexNum(P.gold3), 0.6).fillRect(px + 24, ly - 11, pw - 48, 1);
    layer.add([shade, panel, title, rule, g, rooms, marker, lg, ...labels, hint]);
    const close = () => {
      pulse.remove();
      this.closeModal();
      well.destroy();
    };
    this.modalTap = close;
    this.modalKey = close;
  }

  // -------------------------------------------------------------------------
  // Touch controls
  // -------------------------------------------------------------------------

  private buildControls() {
    this.stickBase = this.add.image(0, 0, 'stick-base').setAlpha(0.55).setDepth(20);
    this.stickKnob = this.add.image(0, 0, 'stick-knob').setAlpha(0.8).setDepth(21);
    const mk = (action: Action, key: string, r: number) => {
      const img = this.add.image(0, 0, `btn-${key}`).setDepth(20).setAlpha(0.85);
      this.btns.push({ action, img, key, r, visible: true, pointer: null });
    };
    mk('attack', 'attack', 24);
    mk('jump', 'jump', 22);
    mk('dodge', 'dodge', 18);
    mk('aim', 'aim', 18);
    mk('weapon', 'weapon', 18);
    mk('execute', 'execute', 18);
    mk('speak', 'speak', 18);
    mk('stigma', 'maw', 18);
    mk('tear', 'tear', 18);
    mk('pause', 'pause', 10);
    this.interactLabel = txt(this, 0, 0, '', 'label', 12).setOrigin(0.5, 1).setDepth(22).setTint(hexNum(P.gold0));
    this.shellText = txt(this, 0, 0, '0', 'head', 12).setOrigin(0.5).setDepth(22).setVisible(false);
  }

  private btn(a: Action) {
    return this.btns.find((b) => b.action === a)!;
  }

  private setBtnVisible(a: Action, v: boolean) {
    const b = this.btn(a);
    b.visible = v;
    b.img.setVisible(v && this.controlsVisible);
  }

  private onDown(raw: Phaser.Input.Pointer) {
    const p = { id: raw.id, x: ux(raw), y: uy(raw) };
    if (this.modal) {
      this.modalTap?.(p);
      return;
    }
    if (!this.controlsVisible) return;
    if (hudState.map && hudState.inRun && this.miniRect.contains(p.x, p.y)) {
      this.showMap();
      return;
    }
    for (const b of this.btns) {
      if (!b.visible) continue;
      const d = Phaser.Math.Distance.Between(p.x, p.y, b.img.x, b.img.y);
      if (d <= b.r * (b.scale ?? 1) + 7) {
        b.pointer = p.id;
        b.img.setTexture(`btn-${b.key}-down`);
        controls.press(b.action);
        return;
      }
    }
    const stickSide = meta().settings.leftHanded ? p.x > this.W * 0.5 : p.x < this.W * 0.5;
    if (stickSide && this.stickPointer === null) {
      this.stickPointer = p.id;
      this.stickOrigin.set(p.x, p.y);
      this.stickBase.setPosition(p.x, p.y).setAlpha(0.75);
      this.stickKnob.setPosition(p.x, p.y);
    }
  }

  private onMove(raw: Phaser.Input.Pointer) {
    const p = { id: raw.id, x: ux(raw), y: uy(raw) };
    if (p.id !== this.stickPointer) return;
    const dx = p.x - this.stickOrigin.x;
    const dy = p.y - this.stickOrigin.y;
    const max = 28 * (meta().settings.bigButtons ? 1.25 : 1);
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    // Drag the base along if the thumb wanders far, so it never "runs out".
    if (len > max * 1.6) {
      this.stickOrigin.x += dx * (1 - (max * 1.6) / len);
      this.stickOrigin.y += dy * (1 - (max * 1.6) / len);
      this.stickBase.setPosition(this.stickOrigin.x, this.stickOrigin.y);
    }
    this.stickKnob.setPosition(this.stickOrigin.x + dx * k, this.stickOrigin.y + dy * k);
    const dead = 4;
    if (len < dead) controls.setMove(0, 0);
    else controls.setMove((dx * k) / max, (dy * k) / max);
  }

  private onUp(raw: Phaser.Input.Pointer) {
    const p = { id: raw.id, x: ux(raw), y: uy(raw) };
    if (p.id === this.stickPointer) {
      this.stickPointer = null;
      controls.setMove(0, 0);
      this.stickBase.setPosition(this.stickHome.x, this.stickHome.y).setAlpha(0.55);
      this.stickKnob.setPosition(this.stickHome.x, this.stickHome.y);
    }
    for (const b of this.btns) {
      if (b.pointer === p.id) {
        b.pointer = null;
        b.img.setTexture(`btn-${b.key}`);
        controls.release(b.action);
      }
    }
  }

  setControlsVisible(v: boolean) {
    this.controlsVisible = v;
    if (!this.stickBase) return; // not built yet; create() applies the flag
    this.stickBase.setVisible(v);
    this.stickKnob.setVisible(v);
    for (const b of this.btns) b.img.setVisible(v && b.visible);
    this.interactLabel.setVisible(v);
    if (!v) {
      controls.clear();
      this.stickPointer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Keyboard (desktop development & testing)
  // -------------------------------------------------------------------------

  private buildKeyboard() {
    const kb = this.input.keyboard;
    if (!kb) return;
    const names = ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'J', 'Z', 'K', 'X', 'SPACE', 'L', 'C', 'I', 'V', 'H', 'E', 'ENTER', 'ESC', 'SHIFT', 'Q', 'R', 'F', 'TAB'];
    this.keys = {};
    for (const n of names) this.keys[n] = kb.addKey(n, false);
    kb.on('keydown', (ev: KeyboardEvent) => {
      if (this.modal) this.modalKey?.(ev.key);
    });
  }

  private pollKeyboard() {
    if (!this.keys || this.modal) return;
    const k = this.keys;
    const map: [string[], Action][] = [
      [['J', 'Z'], 'attack'],
      [['SPACE'], 'jump'],
      [['K', 'X'], 'dodge'],
      [['Q', 'R'], 'aim'],
      [['F', 'TAB'], 'weapon'],
      [['L', 'C'], 'execute'],
      [['I', 'V'], 'stigma'],
      [['H'], 'tear'],
      [['E', 'ENTER'], 'speak'],
      [['ESC'], 'pause'],
    ];
    for (const [ks, a] of map) {
      const down = ks.some((n) => k[n].isDown);
      const was = this.keyWasDown[a] ?? false;
      if (down && !was) {
        controls.press(a);
        if (a === 'execute') controls.press('speak');
      }
      if (!down && was) controls.release(a);
      this.keyWasDown[a] = down;
    }
    let x = 0;
    let y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    if (x || y) {
      const l = Math.hypot(x, y);
      const sneak = k.SHIFT.isDown ? 0.4 : 1;
      controls.setMove((x / l) * sneak, (y / l) * sneak);
      this.keyWasDown.move = true;
    } else if (this.keyWasDown.move) {
      controls.setMove(0, 0);
      this.keyWasDown.move = false;
    }
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  /** Torn black ink-brush edges framing the play, as in Blasphemous's art. */
  private ink: Phaser.GameObjects.GameObject[] = [];
  private buildInkFrame() {
    const W = this.W;
    const H = this.H;
    const t = this.textures;
    if (t.exists('ink-top')) this.ink.push(this.add.tileSprite(0, 0, W, 28, 'ink-top').setOrigin(0).setScale(1, 0.8));
    if (t.exists('ink-bottom')) this.ink.push(this.add.tileSprite(0, H, W, 28, 'ink-bottom').setOrigin(0, 1).setScale(1, 0.8));
    if (t.exists('ink-side')) {
      this.ink.push(this.add.image(0, 0, 'ink-side').setOrigin(0).setScale(0.7, H / 360));
      this.ink.push(this.add.image(W, 0, 'ink-side').setOrigin(0).setScale(-0.7, H / 360));
    }
    for (const o of this.ink) (o as Phaser.GameObjects.Image).setDepth(1).setAlpha(0.92);
  }

  update() {
    this.pollKeyboard();
    const framed = this.scene.isActive('Run') || this.scene.isActive('Hub');
    for (const o of this.ink) (o as Phaser.GameObjects.Image).setVisible(framed);
    this.runLayer.setVisible(hudState.inRun);
    for (const o of this.runAbs) o.setVisible(hudState.inRun);
    this.drawMinimap();
    if (hudState.inRun) {
      this.drawBars();
      this.updateLies();
      this.updateCounters();
    } else this.setBossVisible(false);
    const m = meta();
    this.setBtnVisible('execute', hudState.canExecute && !hudState.interact);
    this.setBtnVisible('speak', !!hudState.interact);
    this.interactLabel.setText(hudState.interact);
    this.setBtnVisible('stigma', hudState.inRun && m.equipped.includes('maw'));
    this.btn('stigma').img.setAlpha(hudState.stigmaReady ? 0.95 : 0.35);
    this.setBtnVisible('tear', hudState.inRun);
    this.btn('tear').img.setAlpha(hudState.tearReady ? 0.9 : 0.35);
    this.setBtnVisible('attack', true);
    this.setBtnVisible('jump', true);
    this.setBtnVisible('dodge', true);
    this.setBtnVisible('aim', hudState.inRun);
    const shells = hudState.inRun && hudState.shellsMax > 0;
    this.setBtnVisible('weapon', shells);
    const wb = this.btn('weapon');
    wb.img.setAlpha(hudState.shellArmed ? 1 : 0.6).setTint(hudState.shellArmed ? 0xffd890 : 0xffffff);
    this.shellText.setVisible(shells && this.controlsVisible);
    if (shells) {
      const t = String(hudState.shells);
      if (this.shellText.text !== t) this.shellText.setText(t);
      this.shellText.setPosition(wb.img.x + 14 * (wb.scale ?? 1), wb.img.y + 12 * (wb.scale ?? 1));
      this.shellText.setTint(hexNum(hudState.shells ? (hudState.shellArmed ? P.gold0 : P.bone1) : P.blood0));
    }
  }

  // -------------------------------------------------------------------------
  // Toasts & banners
  // -------------------------------------------------------------------------

  toast(text: string, color: string = P.bone0) {
    const t = txt(this, this.W / 2, -16, text, 'label', 12)
      .setOrigin(0.5, 0)
      .setTint(hexNum(color))
      .setDepth(50);
    this.tweens.add({
      targets: t,
      y: 22,
      duration: 350,
      ease: 'Back.Out',
      yoyo: true,
      hold: 2200,
      onComplete: () => t.destroy(),
    });
  }

  banner(title: string, sub = '') {
    // (DOM text is positioned directly, not inside an offset container)
    const cx = this.W / 2;
    const cy = this.H * 0.28;
    const a = txt(this, cx, cy, title, 'head', 22).setOrigin(0.5).setTint(hexNum(P.gold1)).setGlow('rgba(200,16,42,0.55)', 8).setDepth(40).setAlpha(0);
    const b = txt(this, cx, cy + 20, sub, 'label', 12).setOrigin(0.5).setItalic().setTint(hexNum(P.bone1)).setDepth(40).setAlpha(0);
    this.tweens.add({ targets: [a, b], alpha: 1, duration: 600, yoyo: true, hold: 1600, onComplete: () => (a.destroy(), b.destroy()) });
  }

  // -------------------------------------------------------------------------
  // Modal dialog & menus
  // -------------------------------------------------------------------------

  private controlsBeforeModal = true;
  /** When the last dialog closed: the key that closed it must not also act on the scene below. */
  modalClosedAt = 0;

  private openModal() {
    if (!this.modal) this.controlsBeforeModal = this.controlsVisible;
    this.modal = true;
    this.setControlsVisible(false);
    const layer = this.add.container(0, 0).setDepth(DEPTH_MODAL);
    // DOM text always sits above the canvas: hide everything but the dialog's own words
    this.game.domContainer?.classList.add('st-modal');
    const add = layer.add.bind(layer);
    layer.add = ((c: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[]) => {
      for (const o of Array.isArray(c) ? c : [c]) if (o instanceof GameText) (o.node as HTMLElement).dataset.layer = 'modal';
      return add(c);
    }) as typeof layer.add;
    this.modalLayer = layer;
    return layer;
  }

  private closeModal() {
    this.modalLayer?.destroy();
    this.modalLayer = null;
    this.modalTap = null;
    this.modalKey = null;
    this.modal = false;
    this.modalClosedAt = performance.now();
    this.game.domContainer?.classList.remove('st-modal');
    this.setControlsVisible(this.controlsBeforeModal);
    controls.clear();
    // Keys used to answer the dialog must not also act in the game
    if (this.keys) {
      const k = this.keys;
      const groups: [string[], string][] = [[['J', 'Z'], 'attack'], [['SPACE'], 'jump'], [['K', 'X'], 'dodge'], [['L', 'C'], 'execute'], [['I', 'V'], 'stigma'], [['H'], 'tear'], [['E', 'ENTER'], 'speak'], [['ESC'], 'pause']];
      for (const [ks, a] of groups) this.keyWasDown[a] = ks.some((n) => k[n].isDown);
    }
  }

  /** Paged dialogue with a speaker. Tap to reveal / advance. */
  dialog(speaker: string, lines: string[]): Promise<void> {
    return new Promise((resolve) => {
      const layer = this.openModal();
      const w = Math.min(this.W - 60, 520);
      const h = 86;
      const x = Math.round((this.W - w) / 2);
      const y = this.H - h - 10;
      const panel = this.add.image(x, y, makePanel(this, `panel-${w}x${h}`, w, h)).setOrigin(0);
      const name = txt(this, x + 16, y + 9, speaker, 'head', 11).setTint(hexNum(P.gold1));
      const sep = this.add.image(x + 12, y + 24, makeSep(this, Math.min(w - 24, Math.round(name.width + 60)))).setOrigin(0, 0.5);
      const body = txt(this, x + 16, y + 28, '', 'body', 12).setMaxWidth(w - 32).setTint(hexNum('#e9dfc6'));
      const more = txt(this, x + w - 14, y + h - 7, '✞', 'label', 12).setOrigin(1).setTint(hexNum(P.blood1));
      layer.add([panel, name, sep, body, more]);
      let i = 0;
      let shown = 0;
      let full = '';
      const timer = this.time.addEvent({
        delay: 22,
        loop: true,
        callback: () => {
          if (shown < full.length) {
            shown = Math.min(full.length, shown + 1);
            body.setText(full.slice(0, shown));
          }
          more.setVisible(shown >= full.length && Math.floor(this.time.now / 400) % 2 === 0);
        },
      });
      const show = () => {
        full = lines[i];
        shown = 0;
        body.setText('');
        sfx(this, 'page_turn', { volume: 0.4 });
      };
      const advance = () => {
        if (shown < full.length) {
          shown = full.length;
          body.setText(full);
          return;
        }
        i++;
        if (i >= lines.length) {
          timer.remove();
          this.closeModal();
          resolve();
        } else show();
      };
      this.modalTap = () => advance();
      this.modalKey = (k) => {
        if (k === 'Enter' || k === ' ' || k === 'e' || k === 'j') advance();
      };
      show();
    });
  }

  /** A choice menu in a skin-bound panel. Resolves the chosen index (or -1). */
  menu(spec: MenuSpec): Promise<number> {
    return new Promise((resolve) => {
      const layer = this.openModal();
      const opts = [...spec.options];
      if (spec.cancel) opts.push({ label: spec.cancel });
      const w = Math.min(this.W - 40, spec.width ?? 380);
      const descH = (o: MenuOption) => (o.desc ? this.measure(o.desc, 'body', 10, w - 40) : 0);
      const rowH = (o: MenuOption) => 14 + (o.desc ? descH(o) + 1 : 0);
      const bodyH = spec.body ? this.measure(spec.body, 'body', 11, w - 28) : 0;
      const h = Math.min(this.H - 16, 42 + (bodyH ? bodyH + 8 : 0) + opts.reduce((a, o) => a + rowH(o) + 3, 0) + 12);
      const x = Math.round((this.W - w) / 2);
      const y = Math.round((this.H - h) / 2);
      const shade = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.55).setOrigin(0);
      const panel = this.add.image(x, y, makePanel(this, `panel-${w}x${h}`, w, h)).setOrigin(0);
      const title = txt(this, x + w / 2, y + 9, spec.title, 'head', 13).setOrigin(0.5, 0).setTint(hexNum(P.gold1));
      const rule = this.add.image(x + w / 2, y + 29, makeRule(this, Math.min(w - 50, Math.max(140, Math.round(title.width + 70))))).setOrigin(0.5);
      layer.add([shade, panel, title, rule]);
      let cy = y + 38;
      if (spec.body) {
        const b = txt(this, x + 16, cy, spec.body, 'body', 11).setMaxWidth(w - 32).setTint(hexNum(P.bone1));
        layer.add(b);
        cy += bodyH + 8;
      }
      const sepKey = makeSep(this, w - 48);
      const rows: { y: number; h: number; o: MenuOption; bg: Phaser.GameObjects.Image; lab: GameText; tint: number }[] = [];
      opts.forEach((o, i) => {
        const rh = rowH(o);
        const bg = this.add.image(x + 10, cy - 2, makeSelBar(this, w - 20, rh + 2)).setOrigin(0).setVisible(false);
        const tint = o.disabled ? hexNum(P.marble4) : o.tint ?? hexNum('#e9dfc6');
        const lab = txt(this, x + 18, cy - 1, o.label, 'label', 12).setTint(tint);
        layer.add([bg, lab]);
        if (i < opts.length - 1) layer.add(this.add.image(x + 24, cy + rh + 0.5, sepKey).setOrigin(0, 0.5).setAlpha(0.35));
        if (o.desc) {
          const d = txt(this, x + 24, cy + 13, o.desc, 'body', 10)
            .setItalic()
            .setMaxWidth(w - 40)
            .setTint(o.disabled ? hexNum(P.marble4) : hexNum(P.bone2));
          layer.add(d);
        }
        rows.push({ y: cy - 2, h: rh + 2, o, bg, lab, tint });
        cy += rh + 3;
      });
      let sel = opts.findIndex((o) => !o.disabled);
      const highlight = () =>
        rows.forEach((r, i) => {
          r.bg.setVisible(i === sel);
          // The chosen line brightens to pale gold, unless it bears its own colour
          r.lab.setTint(i === sel && !r.o.disabled && r.o.tint === undefined ? hexNum(P.gold0) : r.tint);
        });
      highlight();
      const choose = (i: number) => {
        if (i < 0 || opts[i].disabled) {
          sfx(this, 'ui_back');
          return;
        }
        sfx(this, 'ui_confirm');
        this.closeModal();
        resolve(spec.cancel && i === opts.length - 1 ? -1 : i);
      };
      this.modalTap = (p) => {
        const i = rows.findIndex((r) => p.y >= r.y && p.y < r.y + r.h && p.x > x && p.x < x + w);
        if (i >= 0) {
          sel = i;
          highlight();
          choose(i);
        }
      };
      this.modalKey = (k) => {
        if (k === 'ArrowDown' || k === 's') {
          do sel = (sel + 1) % opts.length;
          while (opts[sel].disabled);
          sfx(this, 'ui_select');
          highlight();
        } else if (k === 'ArrowUp' || k === 'w') {
          do sel = (sel - 1 + opts.length) % opts.length;
          while (opts[sel].disabled);
          sfx(this, 'ui_select');
          highlight();
        } else if (k === 'Enter' || k === 'e' || k === 'j' || k === ' ') choose(sel);
        else if (k === 'Escape' && spec.cancel) choose(opts.length - 1);
        else if (k === 'Escape' && spec.escape !== undefined) choose(spec.escape);
      };
    });
  }

  /** Height of wrapped text in game pixels. */
  private measure(text: string, face: Face, size: number, maxW: number) {
    const t = txt(this, -999, -999, text, face, size).setMaxWidth(maxW);
    const h = t.height;
    t.destroy();
    return h;
  }

  /** A crime seen in a Tear: red text over the world, play continues. */
  visionFlash(text: string) {
    const bg = this.add.rectangle(0, 0, this.W, this.H, 0x2a0008, 0).setOrigin(0).setDepth(45);
    const t = txt(this, this.W / 2, this.H * 0.38, text, 'label', 15)
      .setItalic()
      .setOrigin(0.5)
      .setMaxWidth(Math.min(420, this.W - 80))
      .setCenterAlign()
      .setTint(hexNum(P.blood0))
      .setDepth(46)
      .setAlpha(0);
    this.tweens.add({ targets: bg, fillAlpha: 0.45, duration: 150, yoyo: true, hold: 300, onComplete: () => bg.destroy() });
    this.tweens.add({ targets: t, alpha: 1, duration: 250, yoyo: true, hold: 2600, onComplete: () => t.destroy() });
  }

  /** Full-screen black card with centered text (confessions, visions). */
  vision(lines: string[], color: string = P.bone0): Promise<void> {
    return new Promise((resolve) => {
      const layer = this.openModal();
      const bg = this.add.rectangle(0, 0, this.W, this.H, 0x0b0507, 1).setOrigin(0).setAlpha(0);
      const text = txt(this, this.W / 2, this.H / 2, '', 'body', 15)
        .setItalic()
        .setOrigin(0.5)
        .setMaxWidth(Math.min(460, this.W - 60))
        .setCenterAlign()
        .setTint(hexNum(color));
      const hint = txt(this, this.W / 2, this.H - 18, 'touch to continue', 'body', 10).setItalic().setOrigin(0.5).setTint(hexNum(P.marble4)).setAlpha(0);
      layer.add([bg, text, hint]);
      this.tweens.add({ targets: bg, alpha: 1, duration: 400 });
      let i = 0;
      let ready = false;
      const show = () => {
        ready = false;
        text.setText(lines[i]).setAlpha(0);
        this.tweens.add({ targets: text, alpha: 1, duration: 700, onComplete: () => (ready = true) });
        this.tweens.add({ targets: hint, alpha: 0.8, delay: 900, duration: 400 });
      };
      const next = () => {
        if (!ready) return;
        i++;
        hint.setAlpha(0);
        if (i >= lines.length) {
          this.tweens.add({
            targets: [bg, text],
            alpha: 0,
            duration: 400,
            onComplete: () => {
              this.closeModal();
              resolve();
            },
          });
        } else show();
      };
      this.modalTap = next;
      this.modalKey = () => next();
      this.time.delayedCall(450, show);
    });
  }
}

export function hud(scene: Phaser.Scene): HudScene {
  return scene.scene.get('Hud') as HudScene;
}
