import Phaser from 'phaser';
import { FONT_OUTLINE } from '../art/font';

/** Developer view of every generated texture (open with ?gallery). */
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  create() {
    this.cameras.main.setBackgroundColor('#3a3036');
    const only = new URLSearchParams(location.search).get('tex');
    if (only) {
      const t = this.textures.get(only);
      const fr = t.getFrameNames().filter((f) => f !== '__BASE');
      const fw = t.get(fr[0]).width;
      const fh = t.get(fr[0]).height;
      const per = Math.floor((this.scale.width - 8) / (fw + 2));
      fr.forEach((f, i) => this.add.image(4 + (i % per) * (fw + 2), 4 + Math.floor(i / per) * (fh + 2), only, f).setOrigin(0));
      this.cameras.main.setZoom(Number(new URLSearchParams(location.search).get('zoom') || 2)).setOrigin(0, 0);
      return;
    }
    const keys = this.textures.getTextureKeys().filter((k) => !k.startsWith('__'));
    let x = 4;
    let y = 4;
    let rowH = 0;
    const page = Number(new URLSearchParams(location.search).get('gallery') || 0);
    let shown = 0;
    let skip = page * 40;
    for (const k of keys) {
      if (skip-- > 0) continue;
      const tex = this.textures.get(k);
      const frames = tex.getFrameNames().filter((f) => f !== '__BASE');
      const isFont = k.startsWith('font');
      const w = isFont || frames.length === 0 ? tex.source[0].width : tex.get(frames[0]).width * Math.min(frames.length, 6);
      const h = isFont || frames.length === 0 ? tex.source[0].height : tex.get(frames[0]).height;
      if (x + w > this.scale.width - 4) {
        x = 4;
        y += rowH + 12;
        rowH = 0;
      }
      if (isFont || frames.length === 0) this.add.image(x, y, k).setOrigin(0);
      else frames.slice(0, 6).forEach((f, i) => this.add.image(x + i * tex.get(f).width, y, k, f).setOrigin(0));
      this.add.bitmapText(x, y + h + 1, FONT_OUTLINE, k).setOrigin(0);
      x += Math.max(w, k.length * 6) + 6;
      rowH = Math.max(rowH, h);
      if (++shown >= 40) break;
    }
    const z = Number(new URLSearchParams(location.search).get('zoom') || 1);
    if (z > 1) this.cameras.main.setZoom(z).setOrigin(0, 0);
  }
}
