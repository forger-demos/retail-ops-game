import {ADVANCE, drawText, GLYPH_HEIGHT, type Plot} from './font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from './screen-size';

export const TEXTBOX = {x: 0, y: 112, w: SCREEN_WIDTH, h: SCREEN_HEIGHT - 112} as const;
const BORDER = 2;
const PAD = 3;
const LINE_GAP = 3;
export const TEXTBOX_LINES = 2;
export const TEXTBOX_CHARS = Math.floor((TEXTBOX.w - 2 * (BORDER + PAD) + 1) / ADVANCE);
/** Typing speed of the text box, in real milliseconds per character. */
export const MS_PER_CHAR = 30;

export class TextTooLongError extends Error {}

/** Greedy word wrap; a word longer than a line is an error, never silently cut. */
export function wrap(text: string, width = TEXTBOX_CHARS): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(w => w !== '')) {
    if (word.length > width) throw new TextTooLongError(`"${word}" is wider than ${width} characters`);
    if (line === '') line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** How many characters have typed out after `sinceMs`; reduced motion shows them all at once. */
export function revealed(text: string, sinceMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return text.length;
  return Math.min(text.length, Math.max(0, Math.floor(sinceMs / MS_PER_CHAR)));
}

/** A dialogue box along the bottom of the screen showing the first `chars` characters of `text`. */
export function drawTextbox(plot: Plot, text: string, chars = text.length): void {
  const {x, y, w, h} = TEXTBOX;
  plot(x, y, w, h, 0);
  plot(x + BORDER, y + BORDER, w - 2 * BORDER, h - 2 * BORDER, 3);
  plot(x + BORDER + 1, y + BORDER + 1, w - 2 * BORDER - 2, 1, 2);
  let left = chars;
  wrap(text)
    .slice(0, TEXTBOX_LINES)
    .forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, left));
      left -= line.length + 1;
      if (shown !== '') drawText(plot, shown, x + BORDER + PAD, y + BORDER + PAD + 1 + i * (GLYPH_HEIGHT + LINE_GAP), 0);
    });
}
