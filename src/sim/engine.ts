import type {Arrivals, MixOrderArrival, WalkInArrival} from './arrivals';
import {drawArrivals} from './arrivals';
import type {Metrics} from './metrics';
import {summarise} from './metrics';
import type {Params, ScenarioName} from './params';
import type {TimelineEvent} from './timeline';

export interface ScenarioResult {
  scenario: ScenarioName;
  timeline: readonly TimelineEvent[];
  metrics: Metrics;
}

export interface Comparison {
  seed: number;
  params: Params;
  today: ScenarioResult;
  hub: ScenarioResult;
}

/**
 * At equal times a freed staff member is handed the next customer before anyone new
 * arrives, and before a waiting walk-in gives up: a walk-in served exactly at the
 * patience limit has not waited past it.
 */
const PRIORITY = {free: 0, arrive: 1, abandon: 2} as const;

type Pending =
  | {kind: 'free'; at: number; staff: number}
  | {kind: 'arrive-walk-in'; at: number; walkIn: WalkInArrival}
  | {kind: 'arrive-order'; at: number; order: MixOrderArrival}
  | {kind: 'abandon'; at: number; walkIn: WalkInArrival};

type Waiting = {kind: 'walk-in'; walkIn: WalkInArrival} | {kind: 'order'; order: MixOrderArrival};

type StaffState = 'idle' | 'serving' | 'mixing';

function priority(p: Pending): number {
  if (p.kind === 'free') return PRIORITY.free;
  if (p.kind === 'abandon') return PRIORITY.abandon;
  return PRIORITY.arrive;
}

class EventQueue {
  private items: {p: Pending; seq: number}[] = [];
  private seq = 0;

  push(p: Pending): void {
    const entry = {p, seq: this.seq++};
    let i = this.items.length;
    while (i > 0) {
      const prev = this.items[i - 1];
      if (prev === undefined || !before(entry, prev)) break;
      i--;
    }
    this.items.splice(i, 0, entry);
  }

  shift(): Pending | undefined {
    return this.items.shift()?.p;
  }
}

function before(a: {p: Pending; seq: number}, b: {p: Pending; seq: number}): boolean {
  if (a.p.at !== b.p.at) return a.p.at < b.p.at;
  if (priority(a.p) !== priority(b.p)) return priority(a.p) < priority(b.p);
  return a.seq < b.seq;
}

/** Replays one shift's arrivals under one scenario. Pure: no randomness is drawn here (ADR 0001). */
export function runScenario(scenario: ScenarioName, arrivals: Arrivals, params: Params): ScenarioResult {
  const timeline: TimelineEvent[] = [];
  const staff: StaffState[] = Array.from({length: params.staff}, () => 'idle');
  const waiting: Waiting[] = [];
  const queue = new EventQueue();
  for (const walkIn of arrivals.walkIns) queue.push({kind: 'arrive-walk-in', at: walkIn.at, walkIn});
  for (const order of arrivals.mixOrders) queue.push({kind: 'arrive-order', at: order.at, order});

  const freeStaff = (): number => staff.filter(s => s === 'idle').length;
  const staffOnFloor = (): number => staff.filter(s => s !== 'mixing').length;

  const serve = (at: number, who: number, walkIn: WalkInArrival): void => {
    const until = at + params.serviceMinutes;
    staff[who] = 'serving';
    timeline.push({type: 'walk-in-served', at, walkIn: walkIn.id, staff: who, until});
    queue.push({kind: 'free', at: until, staff: who});
  };

  const mix = (at: number, who: number, order: MixOrderArrival): void => {
    const until = at + params.minutesPerTin * order.tins.length;
    staff[who] = 'mixing';
    timeline.push({type: 'mix-start', at, order: order.id, staff: who, tins: order.tins.length, until});
    queue.push({kind: 'free', at: until, staff: who});
  };

  const start = (at: number, who: number, next: Waiting): void => {
    if (next.kind === 'walk-in') serve(at, who, next.walkIn);
    else mix(at, who, next.order);
  };

  for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
    switch (p.kind) {
      case 'free': {
        staff[p.staff] = 'idle';
        timeline.push({type: 'staff-free', at: p.at, staff: p.staff});
        const next = waiting.shift();
        if (next) start(p.at, p.staff, next);
        break;
      }
      case 'arrive-walk-in': {
        timeline.push({type: 'walk-in-arrive', at: p.at, walkIn: p.walkIn.id, freeStaff: freeStaff(), staffOnFloor: staffOnFloor()});
        const who = staff.indexOf('idle');
        if (who >= 0) serve(p.at, who, p.walkIn);
        else {
          waiting.push({kind: 'walk-in', walkIn: p.walkIn});
          queue.push({kind: 'abandon', at: p.at + params.patienceMinutes, walkIn: p.walkIn});
        }
        break;
      }
      case 'arrive-order': {
        const {order} = p;
        timeline.push({type: 'order-arrive', at: p.at, order: order.id, tins: order.tins});
        if (scenario === 'hub' && order.tins.length > params.hubThresholdTins) {
          timeline.push({type: 'hub-dispatch', at: p.at, order: order.id, tins: order.tins.length, deliveryAt: p.at + params.hubDeliveryMinutes});
          break;
        }
        const who = staff.indexOf('idle');
        if (who >= 0) mix(p.at, who, order);
        else waiting.push({kind: 'order', order});
        break;
      }
      case 'abandon': {
        const {walkIn} = p;
        const index = waiting.findIndex(w => w.kind === 'walk-in' && w.walkIn === walkIn);
        if (index >= 0) {
          waiting.splice(index, 1);
          timeline.push({type: 'walk-in-lost', at: p.at, walkIn: walkIn.id, saleGbp: params.averageSaleGbp});
        }
        break;
      }
    }
  }

  return {scenario, timeline, metrics: summarise(timeline)};
}

/** Both scenarios over the same arrivals, so any difference is the hub's doing. */
export function compare(seed: number, params: Params): Comparison {
  const arrivals = drawArrivals(seed, params);
  return {seed, params, today: runScenario('today', arrivals, params), hub: runScenario('hub', arrivals, params)};
}
