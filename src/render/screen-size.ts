export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;

/** The largest whole-pixel scale at which the screen fits the viewport; never below 1. */
export function integerScale(viewportWidth: number, viewportHeight: number): number {
  const fit = Math.floor(Math.min(viewportWidth / SCREEN_WIDTH, viewportHeight / SCREEN_HEIGHT));
  return Math.max(1, fit);
}

/**
 * The largest whole-pixel scale, no bigger than the viewport allows, that `fits` accepts; 1 when
 * none does. `fits` may lay the page out at that scale to measure what surrounds the screen.
 */
export function fittingScale(viewportWidth: number, viewportHeight: number, fits: (scale: number) => boolean): number {
  for (let scale = integerScale(viewportWidth, viewportHeight); scale > 1; scale--) if (fits(scale)) return scale;
  return 1;
}
