// Unified input state written by the HUD (touch + keyboard) and read by
// gameplay scenes. Presses are buffered briefly so taps never get lost.

export type Action = 'attack' | 'jump' | 'dodge' | 'execute' | 'stigma' | 'tear' | 'speak' | 'pause';

const BUFFER_MS = 160;

class Controls {
  moveX = 0;
  moveY = 0;
  /** 0..1 joystick deflection; a light push counts as sneaking. */
  mag = 0;
  invert = false;
  private presses = new Map<Action, number>();
  private releases = new Map<Action, number>();
  private held = new Map<Action, number>();

  press(a: Action) {
    const now = performance.now();
    this.presses.set(a, now);
    this.held.set(a, now);
  }

  release(a: Action) {
    this.releases.set(a, performance.now());
    this.held.delete(a);
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

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }

  heldMs(a: Action = 'attack'): number {
    const t = this.held.get(a);
    return t === undefined ? 0 : performance.now() - t;
  }

  get attackHeld() {
    return this.held.has('attack');
  }

  setMove(x: number, y: number) {
    this.mag = Math.min(1, Math.hypot(x, y));
    const s = this.invert ? -1 : 1;
    this.moveX = x * s;
    this.moveY = y * s;
  }

  clear() {
    this.presses.clear();
    this.releases.clear();
    this.held.clear();
    this.setMove(0, 0);
  }
}

export const controls = new Controls();

/** Contextual state the HUD reflects (which buttons to show, what labels). */
export const hudState = {
  canExecute: false,
  interact: '' as string,
  stigmaReady: false,
  tearReady: false,
  inRun: false,
  bossName: '',
  bossHp: 0,
  bossVisible: false,
  depth: -1,
  totalDepth: 10,
  /** The descent map for the minimap and map screen (cells). */
  map: null as null | {
    gw: number;
    gh: number;
    rooms: { x: number; y: number; w: number; h: number; role: string; theme?: string; explored: boolean; seen: boolean; links: [number, number, string][] }[];
    current: number;
    px: number;
    py: number;
  },
};
