import type {StyleMoment} from '../flow/flow';
import type {ReplayState, StaffView, WaitingView} from '../render/replay';
import {type Params, WALK_IN_KINDS} from '../sim/params';
import type {ShopView} from './shop';

/** The trade customer's walk-in number: it picks the hard hat and hi-vis look. */
export const TRADE_WALK_IN = 0;
export const ORDER_TINS = 10;
export const BUBBLE = `${ORDER_TINS} TINS`;

const TEXT: Readonly<Record<StyleMoment, string>> = {
  dilemma: `A TRADE ORDER: ${ORDER_TINS} TINS. MIX THEM NOW?`,
  unmanned: 'THE COUNTER IS UNMANNED. ANOTHER SALE WALKS OUT.',
};

/** A queue of three whose front walk-in has used `frontShare` of their patience, the rest less. */
function queue(first: number, minute: number, patience: number, frontShare: number): WaitingView[] {
  return [frontShare, 0.55, 0.2].map((share, i) => ({walkIn: first + i, kind: WALK_IN_KINDS[(first + i) % WALK_IN_KINDS.length] ?? 'small', since: minute - share * patience}));
}

/**
 * The fixed, composed moments the v2 look is judged on. `dilemma`: you are alone at the till with a
 * ten-tin trade order while three wait, the first about to give up. `unmanned`: you went to mix it.
 */
export function styleFrame(moment: StyleMoment, params: Params): Omit<ShopView, 'sound'> {
  const patience = params.patienceMinutes;
  const base = {finished: false, served: 14, sales: [], dispatches: []} as const;
  let state: ReplayState;
  if (moment === 'dilemma') {
    const minute = 134;
    const staff: StaffView = {staff: 0, activity: 'serving', since: minute - 1, backFromMixAt: null, mix: null};
    state = {...base, minute, lost: 3, lostGbp: 285, staff: [staff], serving: [{walkIn: TRADE_WALK_IN, kind: 'advice', staff: 0}], waiting: queue(1, minute, patience, 0.9), losses: []};
  } else {
    const minute = 149;
    const since = minute - 2 * params.minutesPerTin - 3;
    const total = ORDER_TINS * params.minutesPerTin;
    const done = (minute - since) / total;
    const staff: StaffView = {
      staff: 0,
      activity: 'mixing',
      since,
      backFromMixAt: null,
      mix: {tin: Math.floor((minute - since) / params.minutesPerTin) + 1, tins: ORDER_TINS, progress: done},
    };
    state = {...base, minute, lost: 4, lostGbp: 380, staff: [staff], serving: [], waiting: queue(2, minute, patience, 0.85), losses: [{walkIn: 1, kind: 'small', at: minute - 1.5, saleGbp: 95}]};
  }
  const text = TEXT[moment];
  return {scenario: 'today', state, params, text, chars: text.length, ...(moment === 'dilemma' ? {bubble: BUBBLE} : {})};
}
