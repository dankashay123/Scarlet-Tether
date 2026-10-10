// Unified input state written by the HUD (touch + keyboard) and read by
// gameplay scenes. Presses are buffered briefly so taps never get lost.

export type Action = 'attack' | 'dodge' | 'execute' | 'stigma' | 'tear' | 'speak' | 'pause';

const BUFFER_MS = 160;

class Controls {
  moveX = 0;
  moveY = 0;
  /** 0..1 joystick deflection; under ~0.55 counts as sneaking. */
  mag = 0;
  attackHeld = false;
  attackHeldSince = 0;
  invert = false;
  private presses = new Map<Action, number>();
  private releases = new Map<Action, number>();

  press(a: Action) {
    this.presses.set(a, performance.now());
    if (a === 'attack') {
      this.attackHeld = true;
      this.attackHeldSince = performance.now();
    }
  }

  release(a: Action) {
    this.releases.set(a, performance.now());
    if (a === 'attack') this.attackHeld = false;
  }

  /** True once per press, if pressed within the buffer window. */
  take(a: Action): boolean {
    const t = this.presses.get(a);
    if (t === undefined) return false;
    this.presses.delete(a);
    return performance.now() - t < BUFFER_MS;
  }

  peek(a: Action): boolean {
    const t = this.presses.get(a);
    return t !== undefined && performance.now() - t < BUFFER_MS;
  }

  takeRelease(a: Action): boolean {
    const t = this.releases.get(a);
    if (t === undefined) return false;
    this.releases.delete(a);
    return performance.now() - t < BUFFER_MS;
  }

  heldMs(): number {
    return this.attackHeld ? performance.now() - this.attackHeldSince : 0;
  }

  setMove(x: number, y: number) {
    const m = Math.min(1, Math.hypot(x, y));
    this.mag = m;
    const s = this.invert ? -1 : 1;
    this.moveX = x * s;
    this.moveY = y * s;
  }

  clear() {
    this.presses.clear();
    this.releases.clear();
    this.attackHeld = false;
    this.setMove(0, 0);
  }
}

export const controls = new Controls();

/** Contextual state the HUD reflects (which buttons to show, what labels). */
export const hudState = {
  canExecute: false,
  interact: '' as string,
  stigma: '' as '' | 'maw',
  stigmaReady: false,
  tearReady: false,
  inRun: false,
  bossName: '',
  bossHp: 0,
  bossVisible: false,
};
