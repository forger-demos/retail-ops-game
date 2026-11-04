import {describe, expect, test} from 'bun:test';

import {change, DEFAULT_SETTINGS, FIELDS, openEditor, type Editor} from './settings';
import {type KeyValueStore, loadSettings, openStorage, parse, saveSettings, serialise, STORAGE_KEY} from './settings-store';

const memory = (): KeyValueStore & {data: Map<string, string>} => {
  const data = new Map<string, string>();
  return {data, getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v)};
};

const edited = (id: string, times = 1): ReturnType<typeof change>['settings'] => {
  let ed: Editor = {...openEditor(DEFAULT_SETTINGS), cursor: FIELDS.findIndex(f => f.id === id)};
  for (let i = 0; i < times; i++) ed = change(ed, 1);
  return ed.settings;
};

describe('settings storage', () => {
  test('an empty store gives the defaults', () => {
    expect(loadSettings(memory())).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('saved values survive a reload', () => {
    const store = memory();
    const mine = edited('staff', 2);
    expect(saveSettings(store, mine)).toBe(true);
    expect(loadSettings(store)).toEqual(mine);
    expect(loadSettings(store).params.staff).toBe(3);
  });

  test('every field round-trips through serialise and parse', () => {
    for (const f of FIELDS) {
      const mine = f.id.startsWith('band') ? DEFAULT_SETTINGS : f.write(DEFAULT_SETTINGS, f.max);
      expect(parse(serialise(mine))).toEqual(mine);
    }
  });

  test('with no storage, nothing is remembered and the caller is told', () => {
    expect(saveSettings(null, edited('staff'))).toBe(false);
    const full: KeyValueStore = {getItem: () => null, setItem: () => { throw new Error('quota'); }};
    expect(saveSettings(full, edited('staff'))).toBe(false);
  });

  test('storage that throws is treated as unavailable', () => {
    expect(openStorage(() => { throw new Error('denied'); })).toBeNull();
    const readOnly = {setItem: () => { throw new Error('denied'); }, removeItem: () => undefined} as unknown as Storage;
    expect(openStorage(() => readOnly)).toBeNull();
    const ok = memory();
    expect(openStorage(() => ({...ok, removeItem: (k: string) => void ok.data.delete(k)}) as unknown as Storage)).not.toBeNull();
    expect(ok.data.size).toBe(0);
  });

  test('unreadable, foreign or hostile entries fall back to the defaults', () => {
    for (const raw of ['', 'nope', '[]', 'null', '{"version":2,"values":{"staff":3}}', '{"version":1}', '{"version":1,"values":7}']) {
      expect(parse(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  test('stored values are clamped and unknown or non-numeric ones ignored', () => {
    const got = parse(JSON.stringify({version: 1, values: {staff: 99, walkIns: 'many', sale: -4, nope: 1, shiftHours: 10.4}}));
    expect(got.params.staff).toBe(4);
    expect(got.params.walkInsPerHour).toBe(DEFAULT_SETTINGS.params.walkInsPerHour);
    expect(got.params.averageSaleGbp).toBe(5);
    expect(got.params.shiftMinutes).toBe(600);
  });

  test('a stored mix that does not total 100 is discarded whole', () => {
    expect(parse(JSON.stringify({version: 1, values: {staff: 2, band0: 60}}))).toEqual(DEFAULT_SETTINGS);
  });

  test('only edited fields are stored', () => {
    const store = memory();
    saveSettings(store, DEFAULT_SETTINGS);
    expect(JSON.parse(store.data.get(STORAGE_KEY) ?? '{}').values).toEqual({});
  });
});
