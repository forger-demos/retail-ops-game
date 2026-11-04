import type {TimelineEvent} from './timeline';

export interface Metrics {
  walkIns: number;
  walkInsServed: number;
  walkInsLost: number;
  salesLostGbp: number;
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
