import {drawText, textWidth, type Plot} from '../render/font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {drawSprite, TIN} from '../render/sprite';

export const TITLE = 'PAINT RUSH';
export const BLINK_MS = 500;
/** The prompt holds steady first, so it is read before it starts to blink. */
export const HOLD_MS = 2000;

const centred = (text: string, size: number): number => Math.floor((SCREEN_WIDTH - textWidth(text, size)) / 2);

/** Whether the prompt shows at this moment; reduced motion keeps it on. */
export function promptVisible(elapsedMs: number, reducedMotion: boolean): boolean {
  return reducedMotion || elapsedMs < HOLD_MS || Math.floor((elapsedMs - HOLD_MS) / BLINK_MS) % 2 === 0;
}

export function drawTitle(plot: Plot, prompt: string, showPrompt: boolean, hint = ''): void {
  plot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3);
  plot(4, 4, SCREEN_WIDTH - 8, 2, 0);
  plot(4, SCREEN_HEIGHT - 6, SCREEN_WIDTH - 8, 2, 0);
  plot(4, 4, 2, SCREEN_HEIGHT - 8, 0);
  plot(SCREEN_WIDTH - 6, 4, 2, SCREEN_HEIGHT - 8, 0);

  drawText(plot, TITLE, centred(TITLE, 2) + 1, 23, 1, 2);
  drawText(plot, TITLE, centred(TITLE, 2), 22, 0, 2);
  drawSprite(plot, TIN, (SCREEN_WIDTH - 32) / 2, 50, 2);
  if (showPrompt) drawText(plot, prompt, centred(prompt, 1), 108, 0, 1);
  if (hint !== '') drawText(plot, hint, centred(hint, 1), 122, 1, 1);
}
