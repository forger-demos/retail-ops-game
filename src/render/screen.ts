import type {Palette, Shade} from './palette';
import {integerScale, SCREEN_HEIGHT, SCREEN_WIDTH} from './screen-size';

export interface Screen {
  readonly ctx: CanvasRenderingContext2D;
  readonly palette: Palette;
  clear(shade: Shade): void;
  rect(x: number, y: number, w: number, h: number, shade: Shade): void;
}

/** Fixes the canvas at the logical resolution and keeps its CSS size a whole multiple of it. */
export function createScreen(canvas: HTMLCanvasElement, palette: Palette, win: Window = window): Screen {
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.imageSmoothingEnabled = false;

  const fit = (): void => {
    const scale = integerScale(win.innerWidth, win.innerHeight);
    canvas.style.width = `${SCREEN_WIDTH * scale}px`;
    canvas.style.height = `${SCREEN_HEIGHT * scale}px`;
  };
  fit();
  win.addEventListener('resize', fit);

  const rect = (x: number, y: number, w: number, h: number, shade: Shade): void => {
    ctx.fillStyle = palette[shade];
    ctx.fillRect(x, y, w, h);
  };
  return {
    ctx,
    palette,
    clear: shade => rect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, shade),
    rect,
  };
}
