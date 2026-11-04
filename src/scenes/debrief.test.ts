import {describe, expect, test} from 'bun:test';

import {textWidth, type Plot} from '../render/font';
import {isShade} from '../render/palette';
import {promptsFor} from '../render/prompts';
import type {Row} from '../render/results';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {DEFAULT_PARAMS} from '../sim/params';
import {playRound, press, setupRound, type RoundResult} from '../sim/round';
import {ROUND_HEADINGS, roundComparisonRows, ROUNDS_NOTE, ROUNDS_TITLE, roundsAnnouncement, roundsVerdict} from './play';
import {drawTable, rowLayout} from './results';
import {drawTitle, MODES, modeLayout} from './title';
import {drawWholeDay, WHOLE_DAY_TITLE, wholeDayAnnouncement} from './whole-day';

const P = promptsFor('keyboard');
type Call = [number, number, number, number, number];
const record = (draw: (plot: Plot) => void): Call[] => {
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
    expect(isShade(s)).toBe(true);
  }
};
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

const today = setupRound('today', 1, DEFAULT_PARAMS, 40);
const hub = setupRound('hub', 1, DEFAULT_PARAMS, 40);
const mixed = playRound(today, press(today, [], 'mix', 0).commands).result;
const sent = playRound(hub, press(hub, [], 'hub', 0).commands).result;
/** Figures as wide as a round can make them. */
const widest: RoundResult = {...mixed, capturedGbp: 9_999_999, walkedOut: 999, unmannedMinutes: 999};

describe('the round comparison', () => {
  test('puts the two rounds side by side, as their results say', () => {
    expect(roundComparisonRows(mixed, sent)).toEqual([
      {label: 'SALES MADE', values: [expect.stringMatching(/^GBP/), expect.stringMatching(/^GBP/)]},
      {label: 'WALKED OUT', values: [String(mixed.walkedOut), String(sent.walkedOut)]},
      {label: 'UNMANNED', values: [`${mixed.unmannedMinutes} MIN`, `${sent.unmannedMinutes} MIN`]},
    ]);
    expect(sent.unmannedMinutes).toBe(0);
    expect(mixed.unmannedMinutes).toBeGreaterThan(0);
  });

  test('names the winner by sales, whichever way round', () => {
    expect(roundsVerdict(mixed, {...mixed, capturedGbp: mixed.capturedGbp + 120})).toEqual({label: 'THE HUB WON', values: ['+GBP120']});
    expect(roundsVerdict({...mixed, capturedGbp: mixed.capturedGbp + 40}, mixed)).toEqual({label: 'ROUND 1 WON', values: ['+GBP40']});
    expect(roundsVerdict(mixed, mixed)).toEqual({label: 'NO DIFFERENCE', values: []});
  });

  test('says both rounds and the difference aloud', () => {
    const text = roundsAnnouncement(mixed, {...mixed, capturedGbp: mixed.capturedGbp + 1200}, 'Press space.');
    expect(text).toContain(`Round 1: GBP${mixed.capturedGbp.toLocaleString('en-GB')} in sales made`);
    expect(text).toContain('With the hub you made GBP1,200 more in sales.');
    expect(text.endsWith('Press space.')).toBe(true);
    expect(roundsAnnouncement(mixed, mixed, '')).toContain('Both rounds made the same sales.');
  });

  for (const [name, r1, r2] of [['played', mixed, sent], ['widest', widest, widest]] as const) {
    test(`stays on screen with no figure on its label (${name})`, () => {
      const rows = roundComparisonRows(r1, r2);
      const below = [roundsVerdict(r1, {...r2, capturedGbp: r2.capturedGbp + 9_999_999})];
      inScreen(record(p => drawTable(p, {title: ROUNDS_TITLE, headings: ROUND_HEADINGS, rows, below, note: ROUNDS_NOTE}, P.roundsResult)));
      [...rows, ...below, {label: '', values: [...ROUND_HEADINGS]}].forEach(noOverlap);
    });
  }
});

describe('the whole-day card', () => {
  test('stays on screen in the palette, and says what comes next', () => {
    inScreen(record(p => drawWholeDay(p, P.wholeDay)));
    inScreen(record(p => drawWholeDay(p, promptsFor('touch').wholeDay)));
    expect(textWidth(WHOLE_DAY_TITLE)).toBeLessThanOrEqual(SCREEN_WIDTH - 4);
    expect(wholeDayAnnouncement('Press space to play it.')).toMatch(/^Now a whole real day: .*same customers.* Press space to play it\.$/);
  });
});

describe('the title mode choice', () => {
  test('offers play and presenter side by side, inside the frame', () => {
    expect(MODES.map(m => m.mode)).toEqual(['play', 'presenter']);
    const xs = modeLayout();
    MODES.forEach((m, i) => {
      const x = xs[i] ?? 0;
      expect(x).toBeGreaterThan(6);
      expect(x + textWidth(m.label)).toBeLessThan(SCREEN_WIDTH - 6);
      if (i > 0) expect(x).toBeGreaterThan((xs[i - 1] ?? 0) + textWidth(MODES[i - 1]?.label ?? ''));
    });
  });

  test('marks the chosen mode, and the mark moves with the choice', () => {
    const draw = (mode: 'play' | 'presenter'): Call[] => record(p => drawTitle(p, P.title, true, P.settingsHint, mode));
    const box = (calls: Call[]): Call | undefined => calls.find(([, y, , h, s]) => s === 0 && h === 13 && y > 80 && y < 100);
    inScreen(draw('play'));
    inScreen(draw('presenter'));
    const xs = modeLayout();
    expect(box(draw('play'))?.[0]).toBe((xs[0] ?? 0) - 3);
    expect(box(draw('presenter'))?.[0]).toBe((xs[1] ?? 0) - 3);
  });
});
