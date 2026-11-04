import {DEFAULT_SETTINGS, clampTo, FIELDS, fieldById, problem, type Settings} from './settings';

export const STORAGE_KEY = 'paint-rush.settings';
const VERSION = 1;

/** The slice of `Storage` the menu needs. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's storage if it works; private modes and blocked cookies throw on access or on write. */
export function openStorage(get: () => Storage): KeyValueStore | null {
  try {
    const store = get();
    store.setItem(`${STORAGE_KEY}.probe`, '1');
    store.removeItem(`${STORAGE_KEY}.probe`);
    return store;
  } catch {
    return null;
  }
}

/** Only fields that differ from the defaults are stored, so a changed default reaches people who never edited it. */
export function serialise(settings: Settings): string {
  const values: Record<string, number> = {};
  for (const f of FIELDS) {
    const v = f.read(settings);
    if (v !== f.read(DEFAULT_SETTINGS)) values[f.id] = v;
  }
  return JSON.stringify({version: VERSION, values});
}

/** Stored values are clamped and anything unrecognised is dropped, so a hand-edited or old entry cannot break a run. */
export function parse(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  let stored: unknown;
  try {
    stored = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  const values = (stored as {version?: unknown; values?: unknown} | null)?.values;
  if ((stored as {version?: unknown} | null)?.version !== VERSION || typeof values !== 'object' || values === null) return DEFAULT_SETTINGS;
  let settings = DEFAULT_SETTINGS;
  for (const [id, value] of Object.entries(values)) {
    const field = fieldById(id);
    if (field && typeof value === 'number' && Number.isFinite(value)) settings = field.write(settings, clampTo(field, Math.round(value)));
  }
  return problem(settings) === null ? settings : DEFAULT_SETTINGS;
}

export function loadSettings(store: KeyValueStore | null): Settings {
  try {
    return parse(store?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Whether the settings were remembered; false means they apply for this session only. */
export function saveSettings(store: KeyValueStore | null, settings: Settings): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, serialise(settings));
    return true;
  } catch {
    return false;
  }
}
