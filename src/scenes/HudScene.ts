import Phaser from 'phaser';
import { FONT, FONT_OUTLINE } from '../art/font';
import { P, hexNum } from '../art/palette';
import { makePanel } from '../art/ui';
import { controls, hudState, type Action } from '../game/controls';
import { currentRun, hasSacrament, meta } from '../game/state';
import { sfx } from '../game/audio';
import { safeInsets } from '../ui/safearea';
import { FAKE_ACHIEVEMENTS, UI_LIES } from '../game/lore';

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
  private reliq!: Phaser.GameObjects.Image;
  private cracks!: Phaser.GameObjects.Image;
  private tearsText!: Phaser.GameObjects.BitmapText;
  private vertText!: Phaser.GameObjects.BitmapText;
  private lieText!: Phaser.GameObjects.BitmapText;
  private bossName!: Phaser.GameObjects.BitmapText;
  private shownHp = 1;
  private trailHp = 1;
  private lieUntil = 0;
  private emptyLieUntil = 0;
  private nextLie = 0;

  modal = false;
  private modalLayer: Phaser.GameObjects.Container | null = null;
  private modalTap: ((p: Phaser.Input.Pointer) => void) | null = null;
  private modalKey: ((k: string) => void) | null = null;
  private inset = { left: 0, right: 0, top: 0, bottom: 0 };
  private interactLabel!: Phaser.GameObjects.BitmapText;
  private controlsVisible = true;

  constructor() {
    super('Hud');
  }

  create() {
    this.input.addPointer(3);
    this.inset = safeInsets(this.scale.width);
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
    return this.scale.width;
  }
  private get H() {
    return this.scale.height;
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
      stigma: [152, 98],
      tear: [152, 38],
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
    // The run HUD shifts right past a notch; right-side items are placed in
    // container space, so subtract that shift back out.
    const off = L - 8;
    this.runLayer.setX(off);
    (this.runLayer.getByName('icon-tear') as Phaser.GameObjects.Image).setPosition(R - 46 - off, 14);
    (this.runLayer.getByName('icon-vert') as Phaser.GameObjects.Image).setPosition(R - 48 - off, 30);
    this.tearsText.setPosition(R - 38 - off, 14);
    this.vertText.setPosition(R - 38 - off, 30);
    this.bossName.setPosition(this.W / 2 - off, 34);
    this.interactLabel.setPosition(lefty ? L + 100 * k : R - 100 * k, B - 128 * k);
  }

  // -------------------------------------------------------------------------
  // Run HUD: Reliquary, Censer, Lucidity, Tears
  // -------------------------------------------------------------------------

  private buildRunHud() {
    this.runLayer = this.add.container(0, 0).setDepth(10);
    this.bars = this.add.graphics();
    this.reliq = this.add.image(10, 8, 'reliquary').setOrigin(0);
    this.cracks = this.add.image(10, 8, 'reliquary-cracks').setOrigin(0).setAlpha(0);
    const censerIcon = this.add.image(12, 26, 'icon-censer').setOrigin(0);
    const censerBar = this.add.image(28, 29, 'bar-censer').setOrigin(0);
    const eyeIcon = this.add.image(11, 41, 'icon-eye').setOrigin(0);
    const lucidBar = this.add.image(28, 42, 'bar-lucid').setOrigin(0);
    const tearIcon = this.add.image(0, 0, 'icon-tear').setName('icon-tear');
    const vertIcon = this.add.image(0, 0, 'icon-vertebra').setName('icon-vert');
    this.tearsText = this.add.bitmapText(0, 0, FONT_OUTLINE, '0').setOrigin(0, 0.5);
    this.vertText = this.add.bitmapText(0, 0, FONT_OUTLINE, '0').setOrigin(0, 0.5);
    this.lieText = this.add.bitmapText(12, 56, FONT_OUTLINE, '').setTint(hexNum(P.blood0)).setAlpha(0);
    this.bossName = this.add.bitmapText(0, 0, FONT_OUTLINE, '').setOrigin(0.5, 0.5).setTint(hexNum(P.bone0));
    this.runLayer.add([
      this.reliq,
      censerIcon,
      censerBar,
      eyeIcon,
      lucidBar,
      this.bars,
      this.cracks,
      tearIcon,
      vertIcon,
      this.tearsText,
      this.vertText,
      this.lieText,
      this.bossName,
    ]);
    this.runLayer.setVisible(false);
  }

  private drawBars() {
    const g = this.bars;
    g.clear();
    const run = currentRun();
    const t = this.time.now;
    // The descent as a rosary: one bead per room, the last an ear.
    if (hudState.depth >= 0 && !hudState.bossVisible) {
      const n = hudState.totalDepth;
      const sp = 9;
      const bx = Math.round(this.W / 2 - ((n - 1) * sp) / 2) - (this.runLayer.x || 0);
      g.fillStyle(hexNum(P.bone3), 1).fillRect(bx, 9, (n - 1) * sp, 1);
      for (let i = 0; i < n; i++) {
        const x = bx + i * sp;
        const boss = i === n - 1;
        const col = i < hudState.depth ? P.bone1 : i === hudState.depth ? P.blood0 : P.shadow2;
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
      const ox = -(this.runLayer.x || 0);
      g.fillStyle(hexNum(P.blood2), a);
      g.fillRect(ox, 0, this.W, 6).fillRect(ox, this.H - 6, this.W, 6).fillRect(ox, 0, 6, this.H).fillRect(ox + this.W - 6, 0, 6, this.H);
      g.fillStyle(hexNum(P.blood3), a * 0.6);
      g.fillRect(ox + 6, 6, this.W - 12, 4).fillRect(ox + 6, this.H - 10, this.W - 12, 4).fillRect(ox + 6, 6, 4, this.H - 12).fillRect(ox + this.W - 10, 6, 4, this.H - 12);
    }
    // --- Reliquary (health) ---
    const target = Phaser.Math.Clamp(run.hp / run.maxHp, 0, 1);
    this.shownHp = Phaser.Math.Linear(this.shownHp, target, 0.35);
    if (this.trailHp < this.shownHp) this.trailHp = this.shownHp;
    else this.trailHp = Math.max(this.shownHp, this.trailHp - 0.006);
    const lying = run.lucidity < 30 && t < this.emptyLieUntil;
    const veiled = hasSacrament('mirror');
    const x0 = 16;
    const y0 = 11;
    const fw = 108;
    if (!veiled) {
      const shown = lying ? 0 : this.shownHp;
      g.fillStyle(hexNum('#e8d0c0'), 1).fillRect(x0, y0, Math.round(fw * (lying ? 0 : this.trailHp)), 8);
      g.fillStyle(hexNum(P.blood2), 1).fillRect(x0, y0, Math.round(fw * shown), 8);
      g.fillStyle(hexNum(P.blood1), 1).fillRect(x0, y0, Math.round(fw * shown), 6);
      g.fillStyle(hexNum(P.blood0), 1).fillRect(x0, y0 + 1, Math.round(fw * shown), 1);
      // Meniscus wobble
      const mx = x0 + Math.round(fw * shown);
      if (shown > 0.02) g.fillStyle(hexNum(P.blood0), 1).fillRect(mx - 1, y0 + (Math.floor(t / 200) % 2), 1, 7);
    } else {
      g.fillStyle(hexNum(P.veil1), 1).fillRect(x0, y0, fw, 8);
    }
    this.cracks.setAlpha(target < 0.6 ? Phaser.Math.Clamp((0.6 - target) * 2.2, 0, 1) : 0);
    // --- Censer (stamina) ---
    const st = Phaser.Math.Clamp(run.stamina / run.maxStamina, 0, 1);
    const choking = (this.registry.get('choking') as boolean) ?? false;
    g.fillStyle(choking && Math.floor(t / 120) % 2 ? hexNum(P.blood1) : hexNum(P.brass1), 1).fillRect(30, 31, Math.round(80 * st), 4);
    g.fillStyle(hexNum(P.brass0), 1).fillRect(30, 31, Math.round(80 * st), 1);
    // --- Lucidity ---
    const lu = Phaser.Math.Clamp(run.lucidity / run.maxLucidity, 0, 1);
    const jitter = run.lucidity < 30 ? Math.round(Math.sin(t / 37) * 2) : 0;
    g.fillStyle(hexNum(P.lucid1), 1).fillRect(30 + jitter, 44, Math.round(80 * lu), 4);
    g.fillStyle(hexNum(P.lucid0), 1).fillRect(30 + jitter, 44, Math.round(80 * lu), 1);
    // --- Boss ---
    if (hudState.bossVisible) {
      const bw = 240;
      const bx = Math.round(this.W / 2 - bw / 2) - (this.runLayer.x || 0);
      const by = 16;
      g.fillStyle(hexNum(P.ink), 1).fillRect(bx - 2, by - 2, bw + 4, 9);
      g.fillStyle(hexNum(P.shadow2), 1).fillRect(bx, by, bw, 5);
      g.fillStyle(hexNum(P.bile1), 1).fillRect(bx, by, Math.round(bw * Phaser.Math.Clamp(hudState.bossHp, 0, 1)), 5);
      g.fillStyle(hexNum(P.bile0), 1).fillRect(bx, by, Math.round(bw * Phaser.Math.Clamp(hudState.bossHp, 0, 1)), 1);
      this.bossName.setText(hudState.bossName).setVisible(true);
    } else this.bossName.setVisible(false);
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
    this.lieText.setX(12 + (Math.random() < 0.2 ? Phaser.Math.Between(-2, 2) : 0));
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
    mk('execute', 'execute', 18);
    mk('speak', 'speak', 18);
    mk('stigma', 'maw', 18);
    mk('tear', 'tear', 18);
    mk('pause', 'pause', 10);
    this.interactLabel = this.add.bitmapText(0, 0, FONT_OUTLINE, '').setOrigin(0.5, 1).setDepth(22).setTint(hexNum(P.gold0));
  }

  private btn(a: Action) {
    return this.btns.find((b) => b.action === a)!;
  }

  private setBtnVisible(a: Action, v: boolean) {
    const b = this.btn(a);
    b.visible = v;
    b.img.setVisible(v && this.controlsVisible);
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.modal) {
      this.modalTap?.(p);
      return;
    }
    if (!this.controlsVisible) return;
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

  private onMove(p: Phaser.Input.Pointer) {
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

  private onUp(p: Phaser.Input.Pointer) {
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
    const names = ['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'J', 'Z', 'K', 'X', 'SPACE', 'L', 'C', 'I', 'V', 'H', 'E', 'ENTER', 'ESC', 'SHIFT'];
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

  update() {
    this.pollKeyboard();
    this.runLayer.setVisible(hudState.inRun);
    if (hudState.inRun) {
      this.drawBars();
      this.updateLies();
      const run = currentRun();
      this.tearsText.setText(String(run.tears));
      this.vertText.setText(String(run.vertebrae));
    }
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
  }

  // -------------------------------------------------------------------------
  // Toasts & banners
  // -------------------------------------------------------------------------

  toast(text: string, color: string = P.bone0) {
    const t = this.add
      .bitmapText(this.W / 2, -10, FONT_OUTLINE, text)
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
    const c = this.add.container(this.W / 2, this.H * 0.28).setDepth(40).setAlpha(0);
    const a = this.add.bitmapText(0, 0, FONT_OUTLINE, title).setOrigin(0.5).setScale(2).setTint(hexNum(P.gold1));
    const b = this.add.bitmapText(0, 16, FONT_OUTLINE, sub).setOrigin(0.5).setTint(hexNum(P.bone1));
    c.add([a, b]);
    this.tweens.add({ targets: c, alpha: 1, duration: 600, yoyo: true, hold: 1600, onComplete: () => c.destroy() });
  }

  // -------------------------------------------------------------------------
  // Modal dialog & menus
  // -------------------------------------------------------------------------

  private openModal() {
    this.modal = true;
    this.setControlsVisible(false);
    this.modalLayer = this.add.container(0, 0).setDepth(DEPTH_MODAL);
    return this.modalLayer;
  }

  private closeModal() {
    this.modalLayer?.destroy();
    this.modalLayer = null;
    this.modalTap = null;
    this.modalKey = null;
    this.modal = false;
    this.setControlsVisible(true);
    controls.clear();
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
      const name = this.add.bitmapText(x + 14, y + 12, FONT_OUTLINE, speaker).setTint(hexNum(P.gold1));
      const body = this.add.bitmapText(x + 14, y + 28, FONT, '').setMaxWidth(w - 28).setTint(hexNum(P.bone0));
      const more = this.add.bitmapText(x + w - 14, y + h - 10, FONT, '✞').setOrigin(1).setTint(hexNum(P.blood1));
      layer.add([panel, name, body, more]);
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
      const rowH = (o: MenuOption) => (o.desc ? 24 : 14);
      const bodyLines = spec.body ? this.measureLines(spec.body, w - 28) : 0;
      const h = Math.min(this.H - 16, 34 + bodyLines * 10 + opts.reduce((a, o) => a + rowH(o) + 3, 0) + 10);
      const x = Math.round((this.W - w) / 2);
      const y = Math.round((this.H - h) / 2);
      const shade = this.add.rectangle(0, 0, this.W, this.H, 0x000000, 0.55).setOrigin(0);
      const panel = this.add.image(x, y, makePanel(this, `panel-${w}x${h}`, w, h)).setOrigin(0);
      const title = this.add.bitmapText(x + w / 2, y + 12, FONT_OUTLINE, spec.title).setOrigin(0.5, 0).setTint(hexNum(P.gold1));
      layer.add([shade, panel, title]);
      let cy = y + 28;
      if (spec.body) {
        const b = this.add.bitmapText(x + 14, cy, FONT, spec.body).setMaxWidth(w - 28).setTint(hexNum(P.bone1));
        layer.add(b);
        cy += bodyLines * 10 + 6;
      }
      const rows: { y: number; h: number; o: MenuOption; bg: Phaser.GameObjects.Rectangle }[] = [];
      opts.forEach((o) => {
        const rh = rowH(o);
        const bg = this.add.rectangle(x + 10, cy - 2, w - 20, rh + 2, hexNum(P.shadow2), 0.0).setOrigin(0);
        const lab = this.add
          .bitmapText(x + 16, cy, FONT_OUTLINE, o.label)
          .setTint(o.disabled ? hexNum(P.marble4) : o.tint ?? hexNum(P.bone0));
        layer.add([bg, lab]);
        if (o.desc) {
          const d = this.add
            .bitmapText(x + 22, cy + 11, FONT, o.desc)
            .setMaxWidth(w - 40)
            .setTint(o.disabled ? hexNum(P.marble4) : hexNum(P.bone2));
          layer.add(d);
        }
        rows.push({ y: cy - 2, h: rh + 2, o, bg });
        cy += rh + 3;
      });
      let sel = opts.findIndex((o) => !o.disabled);
      const highlight = () => rows.forEach((r, i) => r.bg.setFillStyle(hexNum(P.blood3), i === sel ? 0.8 : 0));
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
      };
    });
  }

  private measureLines(text: string, maxW: number) {
    const t = this.add.bitmapText(-999, -999, FONT, text).setMaxWidth(maxW);
    const n = Math.max(1, Math.round(t.height / 10));
    t.destroy();
    return n;
  }

  /** A crime seen in a Tear: red text over the world, play continues. */
  visionFlash(text: string) {
    const bg = this.add.rectangle(0, 0, this.W, this.H, 0x2a0008, 0).setOrigin(0).setDepth(45);
    const t = this.add
      .bitmapText(this.W / 2, this.H * 0.38, FONT_OUTLINE, text)
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
      const text = this.add
        .bitmapText(this.W / 2, this.H / 2, FONT_OUTLINE, '')
        .setOrigin(0.5)
        .setMaxWidth(Math.min(460, this.W - 60))
        .setCenterAlign()
        .setTint(hexNum(color));
      const hint = this.add.bitmapText(this.W / 2, this.H - 18, FONT, 'touch to continue').setOrigin(0.5).setTint(hexNum(P.marble4)).setAlpha(0);
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
