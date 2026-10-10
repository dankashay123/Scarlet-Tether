import { PixelCanvas, registerSheet } from './pixel';

interface AnimSpec {
  name: string;
  start: number;
  count: number;
  fps: number;
  repeat: number;
}

/**
 * Collects frames for one character into a texture strip and creates Phaser
 * animations named `${key}:${anim}`.
 */
export class SheetBuilder {
  private frames: PixelCanvas[] = [];
  private anims: AnimSpec[] = [];

  constructor(readonly key: string) {}

  add(name: string, frames: PixelCanvas[], fps = 8, repeat = -1) {
    this.anims.push({ name, start: this.frames.length, count: frames.length, fps, repeat });
    this.frames.push(...frames);
    return this;
  }

  build(scene: Phaser.Scene) {
    registerSheet(scene, this.key, this.frames);
    for (const a of this.anims) {
      const k = `${this.key}:${a.name}`;
      if (scene.anims.exists(k)) scene.anims.remove(k);
      scene.anims.create({
        key: k,
        frames: Array.from({ length: a.count }, (_, i) => ({ key: this.key, frame: a.start + i })),
        frameRate: a.fps,
        repeat: a.repeat,
      });
    }
  }
}
