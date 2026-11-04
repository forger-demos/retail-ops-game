import {FIELDS, type Editor, MIX_ERROR, mixTotal, problem, VISIBLE_ROWS} from '../flow/settings';
import {drawText, textWidth, type Plot} from './font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from './screen-size';

const MARGIN = 2;
const HEADER_H = 12;
export const ROWS_TOP = 14;
export const ROW_H = 11;
const STATUS_TOP = ROWS_TOP + VISIBLE_ROWS * ROW_H + 3;
/** The strip along the bottom is left clear for the on-screen buttons that sit over it. */
export const CONTROLS_TOP = SCREEN_HEIGHT - 32;

export const NOT_REMEMBERED = 'NOT SAVED: STORAGE IS OFF.';

/** Which visible row a canvas y coordinate falls in, or null above, below or between the list. */
export function rowAt(y: number): number | null {
  const row = Math.floor((y - ROWS_TOP) / ROW_H);
  return row >= 0 && row < VISIBLE_ROWS ? row : null;
}

/** The lines under the list: what blocks leaving the menu first, then the storage note. */
export function statusLines(ed: Editor, remembered: boolean): string[] {
  const lines: string[] = [];
  if (problem(ed.settings)) lines.push(`${MIX_ERROR} NOW ${mixTotal(ed.settings)}`);
  if (!remembered) lines.push(NOT_REMEMBERED);
  return lines;
}

export function drawSettings(plot: Plot, ed: Editor, remembered: boolean): void {
  const field = FIELDS[ed.cursor];
  plot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3);
  plot(0, 0, SCREEN_WIDTH, HEADER_H, 1);
  drawText(plot, `SETTINGS: ${field?.section ?? ''}`, MARGIN, 3, 3);
  const count = `${ed.cursor + 1}/${FIELDS.length}`;
  drawText(plot, count, SCREEN_WIDTH - MARGIN - textWidth(count), 3, 3);

  FIELDS.slice(ed.top, ed.top + VISIBLE_ROWS).forEach((f, i) => {
    const y = ROWS_TOP + i * ROW_H;
    const selected = ed.top + i === ed.cursor;
    if (selected) plot(0, y, SCREEN_WIDTH, ROW_H, 1);
    const shade = selected ? 3 : 0;
    const value = f.format(f.read(ed.settings));
    drawText(plot, f.label, MARGIN + 2, y + 2, shade);
    drawText(plot, value, SCREEN_WIDTH - MARGIN - 2 - textWidth(value), y + 2, shade);
  });

  statusLines(ed, remembered)
    .slice(0, 2)
    .forEach((line, i) => drawText(plot, line, MARGIN, STATUS_TOP + i * 9, 0));
}
