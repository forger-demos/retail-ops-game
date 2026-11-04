import type {TinSize} from './params';

/** One step of a simulated shift, in the order the renderer replays it. `at` is shop minutes. */
export type TimelineEvent =
  | {type: 'walk-in-arrive'; at: number; walkIn: number; freeStaff: number; staffOnFloor: number}
  | {type: 'walk-in-served'; at: number; walkIn: number; staff: number; until: number}
  | {type: 'walk-in-lost'; at: number; walkIn: number; saleGbp: number}
  | {type: 'order-arrive'; at: number; order: number; tins: readonly TinSize[]}
  | {type: 'mix-start'; at: number; order: number; staff: number; tins: number; until: number}
  | {type: 'hub-dispatch'; at: number; order: number; tins: number; deliveryAt: number}
  | {type: 'staff-free'; at: number; staff: number};

export type TimelineEventType = TimelineEvent['type'];
