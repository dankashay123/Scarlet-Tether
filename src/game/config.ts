export const VIEW_H = 360;

/**
 * Logical width matches the device's landscape shape so wide phones see more,
 * never less. It is chosen once at boot from the window if already landscape,
 * otherwise from the physical screen, so rotating never reflows the game.
 */
export function viewWidth(): number {
  const ww = window.innerWidth;
  const wh = Math.max(1, window.innerHeight);
  const sw = Math.max(screen.width, screen.height);
  const sh = Math.max(1, Math.min(screen.width, screen.height));
  const aspect = ww > wh ? ww / wh : sw / sh;
  const w = Math.round(VIEW_H * aspect);
  return Math.max(640, Math.min(820, w - (w % 2)));
}

export const DEPTH = {
  floor: 0,
  rot: 1,
  decal: 2,
  hazard: 3,
  shadow: 4,
  // Actors are y-sorted between these.
  actorBase: 10,
  fx: 5000,
  light: 6000,
  overlay: 7000,
};
