export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;

/** The largest whole-pixel scale at which the screen fits the viewport; never below 1. */
export function integerScale(viewportWidth: number, viewportHeight: number): number {
  const fit = Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT));
  return Math.max(1, fit);
}
