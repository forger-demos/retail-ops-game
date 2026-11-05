import type {WalkInKind} from '../sim/params';
import type {TimelineEvent} from '../sim/timeline';

/** Shop minutes that pass per real second; 5 is one tin a second (ADR 0002). */
export const DEFAULT_TIME_SCALE = 5;
export const OPENING_HOUR = 9;

export function replayDurationMs(shiftMinutes: number, timeScale = DEFAULT_TIME_SCALE): number {
  return (shiftMinutes / timeScale) * 1000;
}

export function shopMinuteAt(elapsedMs: number, timeScale = DEFAULT_TIME_SCALE): number {
  return (Math.max(0, elapsedMs) * timeScale) / 1000;
}

export function realMsFor(shopMinutes: number, timeScale = DEFAULT_TIME_SCALE): number {
  return (shopMinutes / timeScale) * 1000;
}

/** The wall clock for a shop minute, held at closing time once the shift is over. */
export function clockText(minute: number, shiftMinutes: number, openingHour = OPENING_HOUR): string {
  const total = openingHour * 60 + Math.floor(Math.min(Math.max(minute, 0), shiftMinutes));
  const hh = Math.floor(total / 60) % 24;
  return `${String(hh).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export type Activity = 'idle' | 'serving' | 'mixing';

export interface StaffView {
  staff: number;
  activity: Activity;
  /** Shop minute the current activity began. */
  since: number;
  /** When idle or serving after a mix, the minute that mix ended; the scene walks the staff member back. */
  backFromMixAt: number | null;
  /** Which tin is in the mixer, and how far through the whole order, 0-1. */
  mix: {tin: number; tins: number; progress: number} | null;
}

export interface WaitingView {
  walkIn: number;
  kind: WalkInKind;
  since: number;
}

export interface ServingView {
  walkIn: number;
  kind: WalkInKind;
  staff: number;
}

export interface LossView {
  walkIn: number;
  kind: WalkInKind;
  at: number;
  saleGbp: number;
}

export interface SaleView {
  walkIn: number;
  kind: WalkInKind;
  at: number;
}

export interface DispatchView {
  order: number;
  at: number;
  tins: number;
  deliveryAt: number;
}

export interface ReplayState {
  minute: number;
  finished: boolean;
  served: number;
  lost: number;
  lostGbp: number;
  staff: readonly StaffView[];
  /** In arrival order: the first is next to be served. */
  waiting: readonly WaitingView[];
  serving: readonly ServingView[];
  losses: readonly LossView[];
  /** Walk-ins served so far, in order, so the scene can float each sale. */
  sales: readonly SaleView[];
  dispatches: readonly DispatchView[];
}

/**
 * The shop as it stands at `minute`: every event at or before it applied. Once the shift
 * is over every event applies, including walk-ins who give up after closing, so the
 * final counters are the scenario's metrics.
 */
export function replayState(timeline: readonly TimelineEvent[], staffCount: number, shiftMinutes: number, minute: number): ReplayState {
  const finished = minute >= shiftMinutes;
  const staff: StaffView[] = Array.from({length: staffCount}, (_, i) => ({staff: i, activity: 'idle', since: 0, backFromMixAt: null, mix: null}));
  const mixes = new Map<number, {at: number; until: number; tins: number}>();
  const waiting = new Map<number, WaitingView>();
  const serving = new Map<number, ServingView>();
  const losses: LossView[] = [];
  const sales: SaleView[] = [];
  const dispatches: DispatchView[] = [];
  let served = 0;
  let lost = 0;
  let lostGbp = 0;

  for (const e of timeline) {
    if (!finished && e.at > minute) break;
    switch (e.type) {
      case 'walk-in-arrive':
        waiting.set(e.walkIn, {walkIn: e.walkIn, kind: e.kind, since: e.at});
        break;
      case 'walk-in-served': {
        waiting.delete(e.walkIn);
        serving.set(e.staff, {walkIn: e.walkIn, kind: e.kind, staff: e.staff});
        served++;
        sales.push({walkIn: e.walkIn, kind: e.kind, at: e.at});
        const s = staff[e.staff];
        if (s) {
          s.activity = 'serving';
          s.since = e.at;
        }
        break;
      }
      case 'walk-in-lost':
        waiting.delete(e.walkIn);
        losses.push({walkIn: e.walkIn, kind: e.kind, at: e.at, saleGbp: e.saleGbp});
        lost++;
        lostGbp += e.saleGbp;
        break;
      case 'mix-start': {
        mixes.set(e.staff, {at: e.at, until: e.until, tins: e.tins});
        const s = staff[e.staff];
        if (s) {
          s.activity = 'mixing';
          s.since = e.at;
          s.backFromMixAt = null;
        }
        break;
      }
      case 'hub-dispatch':
        dispatches.push({order: e.order, at: e.at, tins: e.tins, deliveryAt: e.deliveryAt});
        break;
      case 'staff-free': {
        serving.delete(e.staff);
        const s = staff[e.staff];
        if (s) {
          if (s.activity === 'mixing') s.backFromMixAt = e.at;
          s.activity = 'idle';
          s.since = e.at;
        }
        mixes.delete(e.staff);
        break;
      }
      case 'order-arrive':
        break;
    }
  }

  for (const s of staff) {
    const m = mixes.get(s.staff);
    if (s.activity === 'mixing' && m) {
      const perTin = (m.until - m.at) / m.tins;
      s.mix = {tin: Math.min(m.tins, Math.floor((minute - m.at) / perTin) + 1), tins: m.tins, progress: Math.min(1, (minute - m.at) / (m.until - m.at))};
    }
  }

  return {
    minute: Math.min(minute, shiftMinutes),
    finished,
    served,
    lost,
    lostGbp,
    staff,
    waiting: [...waiting.values()],
    serving: [...serving.values()],
    losses,
    sales,
    dispatches,
  };
}

export function staffOnFloor(state: ReplayState): number {
  return state.staff.filter(s => s.activity !== 'mixing').length;
}
