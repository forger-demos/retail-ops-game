import {describe, expect, test} from 'bun:test';

import {textWidth} from '../render/font';
import {comparisonRows, FOOTNOTE, NO_LOSS, savingsRows, todayRows, type Row} from '../render/results';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {TEXTBOX} from '../render/textbox';
import {compare} from '../sim/engine';
import {savings} from '../sim/extrapolate';
import {withParams} from '../sim/params';
import {drawComparison, drawResults, rowLayout} from './results';

type Call = [number, number, number, number, number];
const record = (draw: (plot: (x: number, y: number, w: number, h: number, s: number) => void) => void): Call[] => {
  const calls: Call[] = [];
  draw((x, y, w, h, s) => calls.push([x, y, w, h, s]));
  return calls;
};

const inScreen = (calls: Call[]): void => {
  expect(calls[0]).toEqual([0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3]);
  for (const [x, y, w, h, s] of calls) {
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(SCREEN_WIDTH);
    expect(y + h).toBeLessThanOrEqual(SCREEN_HEIGHT);
    expect([0, 1, 2, 3]).toContain(s);
  }
};

/** No value starts before its label ends, or before the previous value ends. */
const noOverlap = (row: Row): void => {
  const at = rowLayout(row);
  let end = at.label + textWidth(row.label);
  row.values.forEach((v, i) => {
    const x = at.values[i] ?? 0;
    expect(x).toBeGreaterThan(end);
    end = x + textWidth(v);
  });
  expect(end).toBeLessThanOrEqual(SCREEN_WIDTH);
};

/** A day whose figures all need shortening, across a large estate. */
const busy = withParams({walkInsPerHour: 60, averageSaleGbp: 9000, stores: 999, tradingDaysPerYear: 365});

describe('results screens', () => {
  for (const [name, params] of [['default', withParams()], ['busy', busy]] as const) {
    test(`today's results stay on screen and in the four shades (${name})`, () => {
      const m = compare(1, params).today.metrics;
      inScreen(record(p => drawResults(p, todayRows(m), m.salesLostGbp === 0)));
      todayRows(m).forEach(noOverlap);
    });

    test(`the comparison stays on screen and no figure collides with its label (${name})`, () => {
      const c = compare(1, params);
      const s = savings(c);
      inScreen(record(p => drawComparison(p, comparisonRows(c), savingsRows(c, s))));
      [...comparisonRows(c), ...savingsRows(c, s)].forEach(noOverlap);
    });
  }

  test('the comparison figures are the engine metrics and the extrapolation', () => {
    const c = compare(3, withParams({stores: 20, tradingDaysPerYear: 300}));
    const s = savings(c);
    expect(comparisonRows(c)).toEqual([
      {label: 'WALKED OUT', values: [String(c.today.metrics.walkInsLost), String(c.hub.metrics.walkInsLost)]},
      {label: 'SALES LOST', values: [`GBP${c.today.metrics.salesLostGbp}`, `GBP${c.hub.metrics.salesLostGbp}`]},
    ]);
    expect(savingsRows(c, s).map(r => r.label)).toEqual(['SAVED PER DAY', 'PER WEEK', 'PER YEAR', 'ACROSS 20 STORES']);
  });

  test('the footnote is drawn above the text box on every comparison', () => {
    const c = compare(1, withParams({walkInsPerHour: 0}));
    const calls = record(p => drawComparison(p, comparisonRows(c), savingsRows(c, savings(c))));
    const footnote = calls.filter(([, y, , , s]) => s === 1 && y >= TEXTBOX.y - 20 && y < TEXTBOX.y);
    expect(footnote.length).toBeGreaterThan(FOOTNOTE.replace(/ /g, '').length);
  });

  test('a day with nothing lost says so instead of scaling up zeros', () => {
    const c = compare(1, withParams({walkInsPerHour: 0}));
    expect(savingsRows(c, savings(c))).toEqual([{label: NO_LOSS, values: []}]);
    const m = c.today.metrics;
    expect(todayRows(m).map(r => r.values[0])).toEqual([String(m.tinsMixedInStore), '0', '0', 'GBP0']);
    expect(record(p => drawResults(p, todayRows(m), true)).length).toBeGreaterThan(record(p => drawResults(p, todayRows(m), false)).length);
  });
});
