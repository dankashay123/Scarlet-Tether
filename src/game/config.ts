export const VIEW_H = 360;

/** Logical width tracks the device aspect so wide phones see more, never less. */
export function viewWidth(): number {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 1) return 640;
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
