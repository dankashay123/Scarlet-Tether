import Phaser from 'phaser';

/**
 * Crisp serif text. The game draws at 640x360 and is scaled up, so text drawn
 * into the canvas would be blocky. Instead text lives in the DOM layer Phaser
 * lays over the canvas (scaled with it by CSS), so the browser renders the
 * letters at the phone's full resolution while positions stay in game units.
 *
 *   title  Cinzel Decorative: the game's name and grand headings
 *   head   Cinzel: names, menu titles, banners
 *   label  EB Garamond, semi-bold with a dark outline: prompts, floating words
 *   body   EB Garamond: dialogue, descriptions
 */
export type Face = 'title' | 'head' | 'label' | 'body';

const FACES: Record<Face, { family: string; weight: number; size: number; spacing: string; outline: boolean }> = {
  title: { family: "'Cinzel Decorative', 'Cinzel', Georgia, serif", weight: 900, size: 16, spacing: '0.02em', outline: true },
  head: { family: "'Cinzel', Georgia, serif", weight: 700, size: 10, spacing: '0.06em', outline: true },
  label: { family: "'EB Garamond', Georgia, serif", weight: 600, size: 11, spacing: '0.01em', outline: true },
  body: { family: "'EB Garamond', Georgia, serif", weight: 500, size: 11, spacing: '0', outline: false },
};

// Hairline outline plus a soft drop, in game pixels (scaled with the canvas)
const OUTLINE = '-0.6px 0 0 #0b0507, 0.6px 0 0 #0b0507, 0 -0.6px 0 #0b0507, 0 0.6px 0 #0b0507, 0 1px 2px rgba(0,0,0,0.9)';
const SOFT = '0 0.6px 1px rgba(0,0,0,0.85)';

/** Load the bundled fonts before anything measures text. */
export function loadFonts(): Promise<unknown> {
  const fonts = document.fonts;
  if (!fonts?.load) return Promise.resolve();
  const want = ["900 16px 'Cinzel Decorative'", "700 10px 'Cinzel'", "600 11px 'EB Garamond'", "500 11px 'EB Garamond'", "italic 500 11px 'EB Garamond'"];
  const all = Promise.all(want.map((f) => fonts.load(f).catch(() => null)));
  // Never hang the boot on a font
  return Promise.race([all, new Promise((r) => setTimeout(r, 2500))]);
}

const hex = (n: number) => '#' + (n & 0xffffff).toString(16).padStart(6, '0');

export class GameText extends Phaser.GameObjects.DOMElement {
  private face: Face;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, face: Face = 'body', size?: number) {
    const el = document.createElement('div');
    const f = FACES[face];
    el.style.cssText = [
      `font-family: ${f.family}`,
      `font-weight: ${f.weight}`,
      `font-size: ${size ?? f.size}px`,
      `letter-spacing: ${f.spacing}`,
      'line-height: 1.18',
      'white-space: pre',
      'color: #e8dcc0',
      `text-shadow: ${f.outline ? OUTLINE : SOFT}`,
      'user-select: none',
      '-webkit-user-select: none',
      'font-kerning: normal',
      // iOS would otherwise "autosize" wrapped paragraphs to several times their size
      '-webkit-text-size-adjust: 100%',
      'text-size-adjust: 100%',
      // Cinzel Decorative's TH and other ligatures garble the name
      'font-variant-ligatures: none',
      "font-feature-settings: 'liga' 0, 'dlig' 0, 'clig' 0",
      '-webkit-font-smoothing: antialiased',
    ].join(';');
    el.textContent = text;
    super(scene, x, y, el);
    this.face = face;
    el.dataset.layer = scene.sys.settings.key === 'Hud' ? 'hud' : 'world';
    this.pointerEvents = 'none';
    this.setOrigin(0, 0);
    this.setDepth(0);
    scene.add.existing(this);
    this.updateSize();
  }

  /** Text colour, as a 0xRRGGBB number (drop-in for a bitmap tint). */
  setTint(color: number) {
    (this.node as HTMLElement).style.color = hex(color);
    return this;
  }

  setColor(css: string) {
    (this.node as HTMLElement).style.color = css;
    return this;
  }

  setText(text: string) {
    (this.node as HTMLElement).textContent = text;
    this.updateSize();
    return this;
  }

  get text() {
    return (this.node as HTMLElement).textContent ?? '';
  }

  /** Wrap within `w` game pixels. */
  setMaxWidth(w: number) {
    const s = (this.node as HTMLElement).style;
    s.whiteSpace = 'pre-line';
    s.width = `${w}px`;
    this.updateSize();
    return this;
  }

  /** Shrink-wrap while still wrapping within `w` (centred blocks). */
  setWrap(w: number) {
    const s = (this.node as HTMLElement).style;
    s.whiteSpace = 'pre-line';
    s.maxWidth = `${w}px`;
    s.width = 'max-content';
    this.updateSize();
    return this;
  }

  setCenterAlign() {
    (this.node as HTMLElement).style.textAlign = 'center';
    return this;
  }

  setRightAlign() {
    (this.node as HTMLElement).style.textAlign = 'right';
    return this;
  }

  setItalic(on = true) {
    (this.node as HTMLElement).style.fontStyle = on ? 'italic' : 'normal';
    return this;
  }

  setFontSize(px: number) {
    (this.node as HTMLElement).style.fontSize = `${px}px`;
    this.updateSize();
    return this;
  }

  /** Letters glow (titles, holy things). */
  setGlow(color: string, blur = 6) {
    (this.node as HTMLElement).style.textShadow = `${OUTLINE}, 0 0 ${blur}px ${color}`;
    return this;
  }

  /** Fill the letters with a vertical gradient (titles), keeping an outline and glow. */
  setGradient(top: string, bottom: string, glow = 'rgba(0,0,0,0)') {
    const s = (this.node as HTMLElement).style;
    s.backgroundImage = `linear-gradient(to bottom, ${top}, ${bottom})`;
    s.setProperty('-webkit-background-clip', 'text');
    s.backgroundClip = 'text';
    s.color = 'transparent';
    s.textShadow = 'none';
    s.filter = `drop-shadow(0 1px 0 #0b0507) drop-shadow(0 -0.5px 0 #0b0507) drop-shadow(0 0 6px ${glow})`;
    return this;
  }

  /** Depth within this scene; the HUD's text always sits above the world's. */
  setDepth(value: number) {
    super.setDepth(value + (this.scene?.sys.settings.key === 'Hud' ? 10000 : 1000));
    return this;
  }

  get kind() {
    return this.face;
  }

  // Camera fades are drawn on the canvas, which the DOM sits above: follow them by hand.
  renderWebGL(r: Phaser.Renderer.WebGL.WebGLRenderer, src: Phaser.GameObjects.DOMElement, cam: Phaser.Cameras.Scene2D.Camera) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Phaser.GameObjects.DOMElement.prototype as any).renderWebGL.call(this, r, src, cam);
    this.applyFade(cam);
  }

  renderCanvas(r: Phaser.Renderer.Canvas.CanvasRenderer, src: Phaser.GameObjects.DOMElement, cam: Phaser.Cameras.Scene2D.Camera) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Phaser.GameObjects.DOMElement.prototype as any).renderCanvas.call(this, r, src, cam);
    this.applyFade(cam);
  }

  private applyFade(cam: Phaser.Cameras.Scene2D.Camera) {
    const fx = cam.fadeEffect;
    if (!fx || (!fx.isRunning && !fx.isComplete)) return;
    const node = this.node as HTMLElement;
    const a = parseFloat(node.style.opacity || '1');
    node.style.opacity = String(a * (1 - (fx as unknown as { alpha: number }).alpha));
  }
}

/** Add crisp text to a scene. */
export function txt(scene: Phaser.Scene, x: number, y: number, text: string, face: Face = 'body', size?: number) {
  return new GameText(scene, x, y, text, face, size);
}

/** Drop-in for `scene.add.bitmapText(x, y, font, text)`: the old pixel fonts map to serif faces. */
export function btxt(scene: Phaser.Scene, x: number, y: number, font: string | Face, text: string) {
  const face: Face = font === 'title' || font === 'head' || font === 'label' || font === 'body' ? font : font === 'font-o' ? 'label' : 'body';
  return new GameText(scene, x, y, text, face);
}
