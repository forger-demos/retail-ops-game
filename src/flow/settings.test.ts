import {describe, expect, test} from 'bun:test';

import {DEFAULT_PARAMS} from '../sim/params';
import {DEFAULT_ROUND_SECONDS} from '../sim/round';
import {
  change,
  DEFAULT_SETTINGS,
  describe as describeRow,
  FIELDS,
  mixTotal,
  moveCursor,
  openEditor,
  problem,
  resetToDefaults,
  selectVisible,
  VISIBLE_ROWS,
  type Editor,
  type Settings,
} from './settings';

const at = (id: string): number => FIELDS.findIndex(f => f.id === id);
const on = (id: string, settings: Settings = DEFAULT_SETTINGS): Editor => ({...openEditor(settings), cursor: at(id)});

describe('settings fields', () => {
  test('ids are unique and every field reads back the default it is built from', () => {
    expect(new Set(FIELDS.map(f => f.id)).size).toBe(FIELDS.length);
    for (const f of FIELDS) {
      expect(f.read(f.write(DEFAULT_SETTINGS, f.read(DEFAULT_SETTINGS)))).toBe(f.read(DEFAULT_SETTINGS));
      expect(f.read(DEFAULT_SETTINGS)).toBeGreaterThanOrEqual(f.min);
      expect(f.read(DEFAULT_SETTINGS)).toBeLessThanOrEqual(f.max);
    }
  });

  test('writing a field changes only the parameter it names', () => {
    for (const f of FIELDS) {
      const next = f.write(DEFAULT_SETTINGS, f.max);
      const changed = [
        ...Object.keys(DEFAULT_PARAMS).filter(k => JSON.stringify(next.params[k as keyof typeof next.params]) !== JSON.stringify(DEFAULT_PARAMS[k as keyof typeof DEFAULT_PARAMS])),
        ...(next.timeScale !== DEFAULT_SETTINGS.timeScale ? ['timeScale'] : []),
        ...(next.roundSeconds !== DEFAULT_SETTINGS.roundSeconds ? ['roundSeconds'] : []),
      ];
      expect({id: f.id, changed: changed.length}).toEqual({id: f.id, changed: 1});
    }
  });

  test('every numeric parameter of the simulation can be edited from the menu', () => {
    const editable = new Set<string>();
    for (const f of FIELDS) {
      const next = f.write(DEFAULT_SETTINGS, f.max);
      for (const key of Object.keys(DEFAULT_PARAMS) as (keyof typeof DEFAULT_PARAMS)[]) {
        if (JSON.stringify(next.params[key]) !== JSON.stringify(DEFAULT_PARAMS[key])) editable.add(key);
      }
    }
    expect([...editable].sort()).toEqual(Object.keys(DEFAULT_PARAMS).sort());
  });

  test('the order-size mix is edited as whole percentages and totals 100 by default', () => {
    expect(mixTotal(DEFAULT_SETTINGS)).toBe(100);
    expect(FIELDS.filter(f => f.id.startsWith('band')).map(f => f.read(DEFAULT_SETTINGS))).toEqual([55, 25, 12, 8]);
    expect(problem(DEFAULT_SETTINGS)).toBeNull();
  });
});

describe('the menu editor', () => {
  test('left and right step the selected value and stop at the limits', () => {
    expect(change(on('staff'), 1).settings.params.staff).toBe(2);
    let ed = on('staff');
    for (let i = 0; i < 10; i++) ed = change(ed, 1);
    expect(ed.settings.params.staff).toBe(4);
    for (let i = 0; i < 10; i++) ed = change(ed, -1);
    expect(ed.settings.params.staff).toBe(1);
  });

  test('shift length is edited in hours and time scale feeds the replay speed', () => {
    expect(change(on('shiftHours'), 1).settings.params.shiftMinutes).toBe(9 * 60);
    expect(change(on('timeScale'), 1).settings.timeScale).toBe(DEFAULT_SETTINGS.timeScale + 1);
  });

  test('the round length is edited in seconds, from the default round', () => {
    expect(DEFAULT_SETTINGS.roundSeconds).toBe(DEFAULT_ROUND_SECONDS);
    expect(change(on('roundSeconds'), 1).settings.roundSeconds).toBe(DEFAULT_ROUND_SECONDS + 5);
    expect(describeRow(on('roundSeconds'))).toBe(`ROUND LENGTH: ${DEFAULT_ROUND_SECONDS} SEC`);
  });

  test('order sizes that do not total 100 are a problem; fixing them clears it', () => {
    const off = change(on('band0'), 1);
    expect(mixTotal(off.settings)).toBe(101);
    expect(problem(off.settings)).toBe('MUST TOTAL 100');
    expect(problem(change({...off, cursor: at('band1')}, -1).settings)).toBeNull();
  });

  test('walk-in types are editable and their shares must total 100', () => {
    const more = change(on('type-share-advice'), 1);
    expect(more.settings.params.walkInTypes.find(t => t.kind === 'advice')?.share).toBeCloseTo(0.3, 10);
    expect(problem(more.settings)).toBe('TYPES MUST TOTAL 100');
    expect(problem(change({...more, cursor: at('type-share-small')}, -1).settings)).toBeNull();
    const dearer = change(on('type-value-sample'), 1).settings;
    expect(dearer.params.walkInTypes.find(t => t.kind === 'sample')?.valueGbp).toBe(35);
    expect(problem(dearer)).toBeNull();
  });

  test('reset restores the documented defaults', () => {
    const edited = change(change(on('stores'), 1), 1);
    expect(edited.settings).not.toEqual(DEFAULT_SETTINGS);
    expect(resetToDefaults(edited).settings).toEqual(DEFAULT_SETTINGS);
  });

  test('the cursor stops at both ends and the list scrolls to keep it in view', () => {
    expect(moveCursor(openEditor(DEFAULT_SETTINGS), -1).cursor).toBe(0);
    let ed = openEditor(DEFAULT_SETTINGS);
    for (let i = 0; i < VISIBLE_ROWS; i++) ed = moveCursor(ed, 1);
    expect(ed.cursor).toBe(VISIBLE_ROWS);
    expect(ed.top).toBe(1);
    for (let i = 0; i < FIELDS.length + 5; i++) ed = moveCursor(ed, 1);
    expect(ed.cursor).toBe(FIELDS.length - 1);
    expect(ed.top).toBe(FIELDS.length - VISIBLE_ROWS);
    for (let i = 0; i < FIELDS.length; i++) ed = moveCursor(ed, -1);
    expect(ed).toEqual(openEditor(DEFAULT_SETTINGS));
  });

  test('tapping a visible row selects it without scrolling, and taps off the list do nothing', () => {
    const scrolled: Editor = {...openEditor(DEFAULT_SETTINGS), cursor: 9, top: 3};
    const tapped = selectVisible(scrolled, 1);
    expect(tapped).toEqual({...scrolled, cursor: 4});
    expect(selectVisible(scrolled, -1)).toBe(scrolled);
    expect(selectVisible(scrolled, VISIBLE_ROWS)).toBe(scrolled);
  });

  test('the live-region text names the row and its value', () => {
    expect(describeRow(on('staff'))).toBe('STAFF ON FLOOR: 1');
    expect(describeRow(on('type-value-small'))).toBe('SMALL VALUE: 55 GBP');
  });
});
