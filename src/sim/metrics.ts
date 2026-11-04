import {WALK_IN_KINDS, type WalkInKind} from './params';
import type {TimelineEvent} from './timeline';

export interface Metrics {
  walkIns: number;
  walkInsServed: number;
  walkInsLost: number;
  salesLostGbp: number;
  /** Walk-ins who gave up, and what they would have spent, by type. */
  lostByType: Record<WalkInKind, {count: number; gbp: number}>;
  mixOrders: number;
  ordersMixedInStore: number;
  tinsMixedInStore: number;
  ordersSentToHub: number;
  tinsSentToHub: number;
  staffMinutesOffFloor: number;
}

/** Metrics are derived from the timeline alone, so what is replayed and what is reported cannot disagree. */
export function summarise(timeline: readonly TimelineEvent[]): Metrics {
  const m: Metrics = {
    walkIns: 0,
    walkInsServed: 0,
    walkInsLost: 0,
    salesLostGbp: 0,
    lostByType: Object.fromEntries(WALK_IN_KINDS.map(k => [k, {count: 0, gbp: 0}])) as Metrics['lostByType'],
    mixOrders: 0,
    ordersMixedInStore: 0,
    tinsMixedInStore: 0,
    ordersSentToHub: 0,
    tinsSentToHub: 0,
    staffMinutesOffFloor: 0,
  };
  for (const e of timeline) {
    switch (e.type) {
      case 'walk-in-arrive':
        m.walkIns++;
        break;
      case 'walk-in-served':
        m.walkInsServed++;
        break;
      case 'walk-in-lost':
        m.walkInsLost++;
        m.salesLostGbp += e.saleGbp;
        m.lostByType[e.kind].count++;
        m.lostByType[e.kind].gbp += e.saleGbp;
        break;
      case 'order-arrive':
        m.mixOrders++;
        break;
      case 'mix-start':
        m.ordersMixedInStore++;
        m.tinsMixedInStore += e.tins;
        m.staffMinutesOffFloor += e.until - e.at;
        break;
      case 'hub-dispatch':
        m.ordersSentToHub++;
        m.tinsSentToHub += e.tins;
        break;
      case 'staff-free':
        break;
    }
  }
  return m;
}
