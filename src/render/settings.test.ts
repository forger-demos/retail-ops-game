import {describe, expect, test} from 'bun:test';

import {change, DEFAULT_SETTINGS, FIELDS, moveCursor, openEditor, VISIBLE_ROWS, type Editor} from '../flow/settings';
import {textWidth} from './font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from './screen-size';
import {CONTROLS_TOP, drawSettings, NOT_REMEMBERED, ROW_H, ROWS_TOP, rowAt, statusLines} from './settings';

type Call = [number, number, number, number, number];
const record = (ed: Editor, remembered = true): Call[] => {
  const calls: Call[] = [];
  drawSettings((x, y, w, h, s) => calls.push([x, y, w, h, s]), ed, remembered);
  return calls;
};

describe('settings screen', () => {
  test('every state of every row stays on the screen and above the on-screen buttons', () => {
    let ed = openEditor(DEFAULT_SETTINGS);
    for (let i = 0; i < FIELDS.length; i++) {
      const [background, ...drawn] = record(ed, false);
      expect(background).toEqual([0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3]);
      for (const [x, y, w, h, s] of drawn) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(SCREEN_WIDTH);
        expect(y + h).toBeLessThanOrEqual(CONTROLS_TOP);
        expect([0, 1, 2, 3]).toContain(s);
      }
      ed = moveCursor(ed, 1);
    }
  });

  test('a label and its largest value never overlap', () => {
    for (const f of FIELDS) {
      const widest = f.format(f.max);
      expect(textWidth(f.label) + 6 + textWidth(widest)).toBeLessThanOrEqual(SCREEN_WIDTH - 8);
    }
  });

  test('the selected row is drawn as a bar behind it', () => {
    const calls = record({...openEditor(DEFAULT_SETTINGS), cursor: 2});
    expect(calls).toContainEqual([0, ROWS_TOP + 2 * ROW_H, SCREEN_WIDTH, ROW_H, 1]);
    expect(calls).not.toContainEqual([0, ROWS_TOP, SCREEN_WIDTH, ROW_H, 1]);
  });

  test('rows are found by their screen position', () => {
    expect(rowAt(ROWS_TOP - 1)).toBeNull();
    expect(rowAt(ROWS_TOP)).toBe(0);
    expect(rowAt(ROWS_TOP + ROW_H * 3 + 5)).toBe(3);
    expect(rowAt(ROWS_TOP + ROW_H * VISIBLE_ROWS - 1)).toBe(VISIBLE_ROWS - 1);
    expect(rowAt(ROWS_TOP + ROW_H * VISIBLE_ROWS)).toBeNull();
    expect(ROWS_TOP + ROW_H * VISIBLE_ROWS).toBeLessThan(CONTROLS_TOP);
  });

  test('the status lines say what blocks BACK and that nothing is remembered', () => {
    const off = change({...openEditor(DEFAULT_SETTINGS), cursor: FIELDS.findIndex(f => f.id === 'band0')}, 1);
    expect(statusLines(openEditor(DEFAULT_SETTINGS), true)).toEqual([]);
    expect(statusLines(off, true)).toEqual(['MUST TOTAL 100 NOW 101']);
    expect(statusLines(off, false)).toEqual(['MUST TOTAL 100 NOW 101', NOT_REMEMBERED]);
    expect(textWidth(NOT_REMEMBERED)).toBeLessThanOrEqual(SCREEN_WIDTH - 4);
  });
});
