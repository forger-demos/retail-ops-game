import type {Arrivals, MixOrderArrival, WalkInArrival} from './arrivals';
import {drawArrivals} from './arrivals';
import type {Metrics} from './metrics';
import {summarise} from './metrics';
import type {Params, ScenarioName, TinSize} from './params';
import type {TimelineEvent} from './timeline';

/** What the player can press. Each one is a decision of the round's policy, made at a shop minute. */
export type PlayAction = 'serve' | 'mix' | 'hub';
export const PLAY_ACTIONS: readonly PlayAction[] = ['serve', 'mix', 'hub'];

export interface Command {
  /** Shop minute the button was pressed; fractional, because the player presses between whole minutes. */
  at: number;
  action: PlayAction;
}

/** Shop minutes per real second in a round: faster than the full-shift replay, so a short round is a busy slice (ADR 0003). */
export const ROUND_TIME_SCALE = 3;
export const DEFAULT_ROUND_SECONDS = 40;
/** The scripted dilemma: a trade order of this many tins is at the till when the round starts. */
export const OPENING_ORDER_TINS = 10;
const OPENING_TIN: TinSize = '5L';
/** Shop minutes at which the scripted walk-ins join the queue behind the trade order. */
export const OPENING_WALK_INS: readonly number[] = [1, 3];
/** The opening order's id; walk-in ids start at 1, so the trade look of customer 0 is only ever the trade customer's. */
export const OPENING_ORDER = 0;

export interface Round {
  scenario: ScenarioName;
  arrivals: Arrivals;
  /** One assistant, whatever the settings say: in a round you are alone in the shop. */
  params: Params;
  /** Length of the round in shop minutes. */
  minutes: number;
}

export function roundMinutes(seconds: number): number {
  return seconds * ROUND_TIME_SCALE;
}

/**
 * The round's customers: the scripted opening, then the simulation's arrivals for `seed` over the
 * round's minutes. Both rounds call this with the same seed, so they face the same customers.
 */
export function roundArrivals(seed: number, params: Params, minutes: number): Arrivals {
  const drawn = drawArrivals(seed, {...params, shiftMinutes: minutes});
  const tins: TinSize[] = Array.from({length: OPENING_ORDER_TINS}, () => OPENING_TIN);
  const opening: MixOrderArrival = {id: OPENING_ORDER, at: 0, tins, valueGbp: OPENING_ORDER_TINS * params.tinPricesGbp[OPENING_TIN]};
  const walkIns = [...OPENING_WALK_INS.map(at => ({at})), ...drawn.walkIns]
    .filter(w => w.at < minutes)
    .sort((a, b) => a.at - b.at)
    .map((w, i): WalkInArrival => ({id: i + 1, at: w.at}));
  const mixOrders = [opening, ...drawn.mixOrders.map(o => ({...o, id: o.id + 1}))];
  return {walkIns, mixOrders};
}

export function setupRound(scenario: ScenarioName, seed: number, params: Params, seconds: number): Round {
  const minutes = roundMinutes(seconds);
  const one = {...params, staff: 1, shiftMinutes: minutes};
  return {scenario, arrivals: roundArrivals(seed, one, minutes), params: one, minutes};
}

/** Why a button cannot be pressed right now. */
export type Unavailable = 'busy-serving' | 'busy-mixing' | 'nobody-waiting' | 'no-order' | 'small-order' | 'round-over';

export interface PlayOption {
  action: PlayAction;
  reason: Unavailable | null;
  /** Tins of the order the button acts on, when there is one. */
  tins: number | null;
}

interface Simulated {
  timeline: TimelineEvent[];
  activity: 'idle' | 'serving' | 'mixing';
  waitingWalkIns: readonly WalkInArrival[];
  waitingOrders: readonly MixOrderArrival[];
  /** The orders the player has had mixed or sent, whose sale is therefore made. */
  captured: readonly MixOrderArrival[];
}

/**
 * At equal times the assistant comes free first, then orders and walk-ins arrive, then a press is applied, and
 * only then does a walk-in give up: a walk-in served exactly at the patience limit has not waited past it.
 */
const RANK = {free: 0, order: 1, walkIn: 2, press: 3, abandon: 4} as const;
type Rank = (typeof RANK)[keyof typeof RANK];

function optionFor(action: PlayAction, round: Round, s: Pick<Simulated, 'activity' | 'waitingWalkIns' | 'waitingOrders'>, minute: number): PlayOption {
  const order = s.waitingOrders[0];
  const tins = action === 'serve' ? null : (order?.tins.length ?? null);
  const no = (reason: Unavailable): PlayOption => ({action, reason, tins});
  if (minute >= round.minutes) return no('round-over');
  if (s.activity === 'serving') return no('busy-serving');
  if (s.activity === 'mixing') return no('busy-mixing');
  if (action === 'serve') return s.waitingWalkIns.length > 0 ? {action, reason: null, tins} : no('nobody-waiting');
  if (!order) return no('no-order');
  if (action === 'hub' && order.tins.length <= round.params.hubThresholdTins) return no('small-order');
  return {action, reason: null, tins};
}

/** The round played with these presses, up to `until`. A press the shop cannot take at its minute is ignored. */
function simulate(round: Round, commands: readonly Command[], until: number): Simulated {
  const {params} = round;
  const timeline: TimelineEvent[] = [];
  const walkIns = [...round.arrivals.walkIns].sort((a, b) => a.at - b.at);
  const orders = [...round.arrivals.mixOrders].sort((a, b) => a.at - b.at);
  const presses = [...commands].sort((a, b) => a.at - b.at);
  const waitingWalkIns: WalkInArrival[] = [];
  const waitingOrders: MixOrderArrival[] = [];
  const captured: MixOrderArrival[] = [];
  let activity: Simulated['activity'] = 'idle';
  let freeAt: number | null = null;
  let w = 0;
  let o = 0;
  let c = 0;

  for (;;) {
    const walkIn = walkIns[w];
    const order = orders[o];
    const pressed = presses[c];
    const giveUp = waitingWalkIns[0];
    const candidates: {at: number; rank: Rank}[] = [];
    if (freeAt !== null) candidates.push({at: freeAt, rank: RANK.free});
    if (order) candidates.push({at: order.at, rank: RANK.order});
    if (walkIn) candidates.push({at: walkIn.at, rank: RANK.walkIn});
    if (pressed) candidates.push({at: pressed.at, rank: RANK.press});
    if (giveUp) candidates.push({at: giveUp.at + params.patienceMinutes, rank: RANK.abandon});
    let next: {at: number; rank: Rank} | null = null;
    for (const x of candidates) if (next === null || x.at < next.at || (x.at === next.at && x.rank < next.rank)) next = x;
    if (next === null || next.at > until || next.at >= round.minutes) break;
    const {at} = next;

    switch (next.rank) {
      case RANK.free:
        freeAt = null;
        activity = 'idle';
        timeline.push({type: 'staff-free', at, staff: 0});
        break;
      case RANK.order:
        if (!order) break;
        o++;
        timeline.push({type: 'order-arrive', at, order: order.id, tins: order.tins});
        waitingOrders.push(order);
        break;
      case RANK.walkIn:
        if (!walkIn) break;
        w++;
        timeline.push({type: 'walk-in-arrive', at, walkIn: walkIn.id, freeStaff: activity === 'idle' ? 1 : 0, staffOnFloor: activity === 'mixing' ? 0 : 1});
        waitingWalkIns.push(walkIn);
        break;
      case RANK.press: {
        c++;
        if (!pressed || optionFor(pressed.action, round, {activity, waitingWalkIns, waitingOrders}, at).reason !== null) break;
        if (pressed.action === 'serve') {
          const served = waitingWalkIns.shift();
          if (!served) break;
          freeAt = at + params.serviceMinutes;
          activity = 'serving';
          timeline.push({type: 'walk-in-served', at, walkIn: served.id, staff: 0, until: freeAt});
          break;
        }
        const taken = waitingOrders.shift();
        if (!taken) break;
        captured.push(taken);
        if (pressed.action === 'mix') {
          freeAt = at + params.minutesPerTin * taken.tins.length;
          activity = 'mixing';
          timeline.push({type: 'mix-start', at, order: taken.id, staff: 0, tins: taken.tins.length, until: freeAt});
        } else {
          timeline.push({type: 'hub-dispatch', at, order: taken.id, tins: taken.tins.length, deliveryAt: at + params.hubDeliveryMinutes});
        }
        break;
      }
      case RANK.abandon:
        if (!giveUp) break;
        waitingWalkIns.shift();
        timeline.push({type: 'walk-in-lost', at, walkIn: giveUp.id, saleGbp: params.averageSaleGbp});
        break;
    }
  }
  return {timeline, activity, waitingWalkIns, waitingOrders, captured};
}

/** What each button would do at `minute`, given the presses so far. SEND TO HUB exists only in the hub round. */
export function optionsAt(round: Round, commands: readonly Command[], minute: number): PlayOption[] {
  const s = simulate(round, commands, minute);
  return PLAY_ACTIONS.filter(a => a !== 'hub' || round.scenario === 'hub').map(a => optionFor(a, round, s, minute));
}

/** Adds a press if the shop can take it at `minute`; otherwise says why not and leaves the presses as they were. */
export function press(round: Round, commands: readonly Command[], action: PlayAction, minute: number): {commands: readonly Command[]; reason: Unavailable | null} {
  const option = optionsAt(round, commands, minute).find(o => o.action === action);
  const reason = option ? option.reason : 'round-over';
  return reason === null ? {commands: [...commands, {at: minute, action}], reason} : {commands, reason};
}

export interface RoundResult {
  metrics: Metrics;
  served: number;
  walkedOut: number;
  lostGbp: number;
  /** Sales made: every walk-in served, and every order mixed or sent to the hub, at its value. */
  capturedGbp: number;
  /** Shop minutes within the round that nobody was on the floor. */
  unmannedMinutes: number;
  sentToHub: number;
  tinsSentToHub: number;
  /** Orders still at the till when the round ended: sales not made. */
  ordersLeft: number;
}

export interface PlayedRound {
  timeline: readonly TimelineEvent[];
  result: RoundResult;
}

/** The whole round under these presses; the results are the simulation's metrics of its timeline. */
export function playRound(round: Round, commands: readonly Command[]): PlayedRound {
  const s = simulate(round, commands, round.minutes);
  const metrics = summarise(s.timeline);
  let unmannedMinutes = 0;
  for (const e of s.timeline) if (e.type === 'mix-start') unmannedMinutes += Math.min(e.until, round.minutes) - e.at;
  const capturedGbp = metrics.walkInsServed * round.params.averageSaleGbp + s.captured.reduce((sum, order) => sum + order.valueGbp, 0);
  return {
    timeline: s.timeline,
    result: {
      metrics,
      served: metrics.walkInsServed,
      walkedOut: metrics.walkInsLost,
      lostGbp: metrics.salesLostGbp,
      capturedGbp,
      unmannedMinutes: Math.round(unmannedMinutes),
      sentToHub: metrics.ordersSentToHub,
      tinsSentToHub: metrics.tinsSentToHub,
      ordersLeft: s.waitingOrders.length,
    },
  };
}
