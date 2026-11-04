import {ADVANCE, drawText, textWidth, type Plot} from '../render/font';
import {COMPARISON_HEADINGS, COMPARISON_PROMPT, COMPARISON_TITLE, FOOTNOTE, NO_LOSS, RESULTS_PROMPT, RESULTS_TITLE, type Row} from '../render/results';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {drawTextbox, TEXTBOX, wrap} from '../render/textbox';

export const MARGIN = 2;
const HEADER_H = 12;
const LINE_H = 10;
/** Right edges of the TODAY and HUB columns; the last one is the screen's own margin. */
export const COLUMN_RIGHTS = [110, SCREEN_WIDTH - MARGIN] as const;
const FOOTNOTE_CHARS = Math.floor((SCREEN_WIDTH - 2 * MARGIN + 1) / ADVANCE);

function header(plot: Plot, title: string): void {
  plot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3);
  plot(0, 0, SCREEN_WIDTH, HEADER_H, 1);
  drawText(plot, title, MARGIN, 3, 3);
}

/** A label on the left and its values right-aligned to the columns, the last value always at the right margin. */
export function rowLayout(row: Row): {label: number; values: number[]} {
  const rights = COLUMN_RIGHTS.slice(COLUMN_RIGHTS.length - row.values.length);
  return {label: MARGIN, values: row.values.map((v, i) => (rights[i] ?? SCREEN_WIDTH - MARGIN) - textWidth(v))};
}

function drawRow(plot: Plot, row: Row, y: number): void {
  const at = rowLayout(row);
  drawText(plot, row.label, at.label, y, 0);
  row.values.forEach((v, i) => drawText(plot, v, at.values[i] ?? 0, y, 0));
}

export function drawResults(plot: Plot, rows: readonly Row[], noLoss: boolean): void {
  header(plot, RESULTS_TITLE);
  rows.forEach((row, i) => drawRow(plot, row, HEADER_H + 8 + i * LINE_H * 1.5));
  if (noLoss) drawText(plot, NO_LOSS, Math.floor((SCREEN_WIDTH - textWidth(NO_LOSS)) / 2), TEXTBOX.y - 14, 1);
  drawTextbox(plot, RESULTS_PROMPT);
}

export function drawComparison(plot: Plot, table: readonly Row[], saved: readonly Row[]): void {
  header(plot, COMPARISON_TITLE);
  let y = HEADER_H + 3;
  drawRow(plot, {label: '', values: [...COMPARISON_HEADINGS]}, y);
  for (const row of table) drawRow(plot, row, (y += LINE_H));
  y += LINE_H + 3;
  plot(MARGIN, y - 4, SCREEN_WIDTH - 2 * MARGIN, 1, 1);
  for (const row of saved) {
    drawRow(plot, row, y);
    y += LINE_H;
  }
  wrap(FOOTNOTE, FOOTNOTE_CHARS).forEach((line, i) => drawText(plot, line, MARGIN, TEXTBOX.y - 20 + i * 9, 1));
  drawTextbox(plot, COMPARISON_PROMPT);
}
