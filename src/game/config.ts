export const VIEW_H = 224;

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
  return Math.max(400, Math.min(512, w - (w % 2)));
}

/** Draw order for the side-view world, back to front. */
export const DEPTH = {
  bgFar: -300,
  bgMid: -290,
  bgNear: -280,
  props: -100, // booths, statues, candelabras behind the play layer
  tiles: 0,
  gore: 5, // blood painted onto the stone
  hazard: 8,
  corpse: 9,
  enemy: 20,
  player: 30,
  projectile: 40,
  fx: 50,
  light: 60,
  fg: 80,
  overlay: 90,
};
