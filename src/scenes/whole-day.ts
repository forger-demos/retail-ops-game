import {ADVANCE, drawText, type Plot} from '../render/font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {drawSprite, TIN} from '../render/sprite';
import {drawTextbox, TEXTBOX, wrap} from '../render/textbox';

export const WHOLE_DAY_TITLE = 'NOW A WHOLE REAL DAY';
export const WHOLE_DAY_TEXT = 'THE SAME SHOP OVER A FULL SHIFT, RUN BY THE SIMULATION. FIRST AS TODAY, THEN WITH THE HUB. SAME CUSTOMERS IN BOTH.';
const MARGIN = 4;
const LINE_H = 10;
const CHARS = Math.floor((SCREEN_WIDTH - 2 * MARGIN + 1) / ADVANCE);

export function drawWholeDay(plot: Plot, prompt: string): void {
  plot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3);
  plot(0, 0, SCREEN_WIDTH, 12, 1);
  drawText(plot, WHOLE_DAY_TITLE, 2, 3, 3);
  const lines = wrap(WHOLE_DAY_TEXT, CHARS);
  lines.forEach((line, i) => drawText(plot, line, MARGIN, 18 + i * LINE_H, 0));
  drawSprite(plot, TIN, (SCREEN_WIDTH - 32) / 2, TEXTBOX.y - 36, 2);
  drawTextbox(plot, prompt);
}

export function wholeDayAnnouncement(next: string): string {
  return `Now a whole real day: the same shop over a full shift, run by the simulation, first as today, then with the hub, with the same customers in both. ${next}`;
}
