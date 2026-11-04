import {DEFAULT_TIME_SCALE} from '../render/replay';
import {DEFAULT_PARAMS, type Params, TIN_SIZES, type TinSize, WALK_IN_KINDS, type WalkInKind} from '../sim/params';
import {DEFAULT_ROUND_SECONDS} from '../sim/round';

/** Everything the menu edits: the simulation's parameters plus how fast the replay runs. */
export interface Settings {
  params: Params;
  /** Shop minutes that pass per real second. */
  timeScale: number;
  /** Real seconds each played round lasts. */
  roundSeconds: number;
}

export const DEFAULT_SETTINGS: Settings = {params: DEFAULT_PARAMS, timeScale: DEFAULT_TIME_SCALE, roundSeconds: DEFAULT_ROUND_SECONDS};

export type Section = 'DAY' | 'PEOPLE' | 'WALK-INS' | 'MIXING' | 'TINS' | 'HUB' | 'SCALE' | 'PLAY';

export interface Field {
  id: string;
  label: string;
  section: Section;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  read(settings: Settings): number;
  write(settings: Settings, value: number): Settings;
}

const withParams = (s: Settings, patch: Partial<Params>): Settings => ({...s, params: {...s.params, ...patch}});
const plain = (v: number): string => String(v);
const unit = (u: string) => (v: number): string => `${v} ${u}`;

type NumericParam = {[K in keyof Params]: Params[K] extends number ? K : never}[keyof Params];

function paramField(key: NumericParam, rest: Pick<Field, 'id' | 'label' | 'section' | 'min' | 'max' | 'step'> & Partial<Pick<Field, 'format'>>): Field {
  return {
    format: plain,
    ...rest,
    read: s => s.params[key],
    write: (s, v) => withParams(s, {[key]: v}),
  };
}

const bandField = (index: number): Field => {
  const band = DEFAULT_PARAMS.orderSizeMix[index];
  if (!band) throw new Error(`no order-size band ${index}`);
  const tins = band.minTins === band.maxTins ? `${band.minTins} TIN` : `${band.minTins}-${band.maxTins} TINS`;
  return {
    id: `band${index}`,
    label: `ORDERS OF ${tins}`,
    section: 'MIXING',
    min: 0,
    max: 100,
    step: 1,
    format: unit('%'),
    read: s => Math.round((s.params.orderSizeMix[index]?.share ?? 0) * 100),
    write: (s, v) => withParams(s, {orderSizeMix: s.params.orderSizeMix.map((b, i) => (i === index ? {...b, share: v / 100} : b))}),
  };
};

const KIND_LABELS: Record<WalkInKind, string> = {advice: 'ADVICE', sample: 'SAMPLE', small: 'SMALL'};

const withType = (s: Settings, kind: WalkInKind, patch: {share?: number; valueGbp?: number}): Settings =>
  withParams(s, {walkInTypes: s.params.walkInTypes.map(t => (t.kind === kind ? {...t, ...patch} : t))});

const typeOf = (s: Settings, kind: WalkInKind) => s.params.walkInTypes.find(t => t.kind === kind);

const typeShareField = (kind: WalkInKind): Field => ({
  id: `type-share-${kind}`,
  label: `${KIND_LABELS[kind]} SHARE`,
  section: 'WALK-INS',
  min: 0,
  max: 100,
  step: 5,
  format: unit('%'),
  read: s => Math.round((typeOf(s, kind)?.share ?? 0) * 100),
  write: (s, v) => withType(s, kind, {share: v / 100}),
});

const typeValueField = (kind: WalkInKind): Field => ({
  id: `type-value-${kind}`,
  label: `${KIND_LABELS[kind]} VALUE`,
  section: 'WALK-INS',
  min: 5,
  max: 500,
  step: 5,
  format: unit('GBP'),
  read: s => typeOf(s, kind)?.valueGbp ?? 0,
  write: (s, v) => withType(s, kind, {valueGbp: v}),
});

const sizeLabel = (size: TinSize): string => size.toUpperCase();

const priceField = (size: TinSize): Field => ({
  id: `price-${size}`,
  label: `${sizeLabel(size)} TIN PRICE`,
  section: 'TINS',
  min: 5,
  max: 500,
  step: 5,
  format: unit('GBP'),
  read: s => s.params.tinPricesGbp[size],
  write: (s, v) => withParams(s, {tinPricesGbp: {...s.params.tinPricesGbp, [size]: v}}),
});

const sizeMixField = (size: TinSize): Field => ({
  id: `size-${size}`,
  label: `${sizeLabel(size)} TIN SPLIT`,
  section: 'TINS',
  min: 5,
  max: 100,
  step: 5,
  format: plain,
  read: s => s.params.tinSizeMix[size],
  write: (s, v) => withParams(s, {tinSizeMix: {...s.params.tinSizeMix, [size]: v}}),
});

/** In menu order. Every key of `Params` is reachable from here, and so are the replay speed and the round length. */
export const FIELDS: readonly Field[] = [
  {
    id: 'shiftHours',
    label: 'SHIFT LENGTH',
    section: 'DAY',
    min: 1,
    max: 12,
    step: 1,
    format: unit('HRS'),
    read: s => Math.round(s.params.shiftMinutes / 60),
    write: (s, v) => withParams(s, {shiftMinutes: v * 60}),
  },
  {
    id: 'timeScale',
    label: 'TIME SCALE',
    section: 'DAY',
    min: 1,
    max: 20,
    step: 1,
    format: unit('MIN/S'),
    read: s => s.timeScale,
    write: (s, v) => ({...s, timeScale: v}),
  },
  paramField('staff', {id: 'staff', label: 'STAFF ON FLOOR', section: 'DAY', min: 1, max: 4, step: 1}),
  paramField('walkInsPerHour', {id: 'walkIns', label: 'WALK-INS PER HR', section: 'DAY', min: 1, max: 60, step: 1}),
  paramField('mixOrdersPerHour', {id: 'mixOrders', label: 'MIX ORDERS PER HR', section: 'DAY', min: 1, max: 20, step: 1}),
  paramField('serviceMinutes', {id: 'service', label: 'SERVICE TIME', section: 'PEOPLE', min: 1, max: 30, step: 1, format: unit('MIN')}),
  paramField('patienceMinutes', {id: 'patience', label: 'PATIENCE', section: 'PEOPLE', min: 1, max: 60, step: 1, format: unit('MIN')}),
  paramField('minutesPerTin', {id: 'perTin', label: 'MINUTES PER TIN', section: 'MIXING', min: 1, max: 30, step: 1, format: unit('MIN')}),
  ...DEFAULT_PARAMS.orderSizeMix.map((_, i) => bandField(i)),
  ...WALK_IN_KINDS.flatMap(k => [typeShareField(k), typeValueField(k)]),
  ...TIN_SIZES.map(priceField),
  ...TIN_SIZES.map(sizeMixField),
  paramField('hubThresholdTins', {id: 'threshold', label: 'HUB IF OVER', section: 'HUB', min: 1, max: 12, step: 1, format: unit('TINS')}),
  paramField('hubDeliveryMinutes', {id: 'delivery', label: 'HUB DELIVERY', section: 'HUB', min: 15, max: 480, step: 15, format: unit('MIN')}),
  paramField('stores', {id: 'stores', label: 'STORES', section: 'SCALE', min: 5, max: 500, step: 5}),
  paramField('tradingDaysPerYear', {id: 'days', label: 'TRADING DAYS/YR', section: 'SCALE', min: 5, max: 365, step: 5}),
  {
    id: 'roundSeconds',
    label: 'ROUND LENGTH',
    section: 'PLAY',
    min: 20,
    max: 120,
    step: 5,
    format: unit('SEC'),
    read: s => s.roundSeconds,
    write: (s, v) => ({...s, roundSeconds: v}),
  },
];

export const clampTo = (field: Field, value: number): number => Math.min(field.max, Math.max(field.min, value));

export function fieldById(id: string): Field | undefined {
  return FIELDS.find(f => f.id === id);
}

export const MIX_ERROR = 'MUST TOTAL 100';

export function mixTotal(s: Settings): number {
  return s.params.orderSizeMix.reduce((sum, b) => sum + Math.round(b.share * 100), 0);
}

export const TYPE_ERROR = 'TYPES MUST TOTAL 100';

export function typeTotal(s: Settings): number {
  return s.params.walkInTypes.reduce((sum, t) => sum + Math.round(t.share * 100), 0);
}

/** The reason the settings cannot be left, or null when they are fine. */
export function problem(s: Settings): string | null {
  if (mixTotal(s) !== 100) return MIX_ERROR;
  return typeTotal(s) === 100 ? null : TYPE_ERROR;
}

/** Rows of the list that fit on screen at once. */
export const VISIBLE_ROWS = 7;

export interface Editor {
  settings: Settings;
  cursor: number;
  /** Index of the first visible row. */
  top: number;
}

export function openEditor(settings: Settings): Editor {
  return {settings, cursor: 0, top: 0};
}

function scrolled(cursor: number, top: number): number {
  if (cursor < top) return cursor;
  if (cursor >= top + VISIBLE_ROWS) return cursor - VISIBLE_ROWS + 1;
  return top;
}

export function moveCursor(ed: Editor, delta: number): Editor {
  const cursor = Math.min(FIELDS.length - 1, Math.max(0, ed.cursor + delta));
  return {...ed, cursor, top: scrolled(cursor, ed.top)};
}

/** Tapping the nth visible row selects it; a tap on empty space or past the end does nothing. */
export function selectVisible(ed: Editor, row: number): Editor {
  const cursor = ed.top + row;
  return row < 0 || row >= VISIBLE_ROWS || cursor >= FIELDS.length ? ed : {...ed, cursor};
}

export function change(ed: Editor, direction: 1 | -1): Editor {
  const field = FIELDS[ed.cursor];
  if (!field) return ed;
  const next = clampTo(field, field.read(ed.settings) + direction * field.step);
  return {...ed, settings: field.write(ed.settings, next)};
}

export function resetToDefaults(ed: Editor): Editor {
  return {...ed, settings: DEFAULT_SETTINGS};
}

/** The field under the cursor, for the live region and the screen. */
export function describe(ed: Editor): string {
  const field = FIELDS[ed.cursor];
  return field ? `${field.label}: ${field.format(field.read(ed.settings))}` : '';
}
