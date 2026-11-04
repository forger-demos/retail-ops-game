import type {RoundNumber} from '../flow/flow';
import {formatGbp} from '../render/money';
import {replayState, staffOnFloor, type ReplayState} from '../render/replay';
import type {Row} from '../render/results';
import {OPENING_ORDER, type Round, type RoundResult} from '../sim/round';
import type {TimelineEvent} from '../sim/timeline';
import {LOSS_MINUTES, type ShopView} from './shop';

export const ROUND_TITLES: Readonly<Record<RoundNumber, string>> = {1: 'ROUND 1: TODAY', 2: 'ROUND 2: HUB'};
export const RESULT_TITLES: Readonly<Record<RoundNumber, string>> = {1: 'ROUND 1: RESULT', 2: 'ROUND 2: RESULT'};

export interface WaitingOrder {
  order: number;
  tins: number;
}

/** Mix orders that have arrived by `minute` and not yet been mixed or sent, first come first. */
export function ordersWaiting(timeline: readonly TimelineEvent[], minute: number): WaitingOrder[] {
  const waiting = new Map<number, WaitingOrder>();
  for (const e of timeline) {
    if (e.at > minute) break;
    if (e.type === 'order-arrive') waiting.set(e.order, {order: e.order, tins: e.tins.length});
    else if (e.type === 'mix-start' || e.type === 'hub-dispatch') waiting.delete(e.order);
  }
  return [...waiting.values()];
}

/** Real seconds left in the round, rounded up, as M:SS. */
export function countdown(round: Round, minute: number, timeScale: number): string {
  const left = Math.max(0, Math.ceil((round.minutes - minute) / timeScale));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** The order customer's look: the trade customer for the opening order, a varied shopper otherwise. */
const orderCustomer = (order: number): number => (order === OPENING_ORDER ? 0 : order + 2);

/** What the text box says at this moment of a round: the worst thing happening wins. */
export function playLine(n: RoundNumber, state: ReplayState, orders: readonly WaitingOrder[], hubThresholdTins: number): string {
  if (staffOnFloor(state) === 0) return 'THE COUNTER IS UNMANNED. NOBODY CAN SERVE.';
  const loss = state.losses.at(-1);
  if (loss && state.minute - loss.at < LOSS_MINUTES) return `A CUSTOMER WALKED OUT! -GBP${loss.saleGbp}`;
  const order = orders[0];
  if (order?.order === OPENING_ORDER) return n === 1 ? `A TRADE ORDER: ${order.tins} TINS. MIX THEM NOW?` : `A TRADE ORDER: ${order.tins} TINS. SEND IT TO THE HUB?`;
  if (order && n === 2 && order.tins > hubThresholdTins) return `${order.tins} TINS. THE HUB CAN MIX THEM.`;
  if (order && state.waiting.length > 0) return 'SERVE THE QUEUE OR MIX THE ORDER?';
  if (order) return `${order.tins} ${order.tins === 1 ? 'TIN' : 'TINS'} TO MIX.`;
  if (state.waiting.length > 0) return 'A CUSTOMER IS WAITING.';
  return 'ALL QUIET. FOR NOW.';
}

/** The shop scene for a round at `minute`, drawn from the round's own timeline. */
export function playView(n: RoundNumber, round: Round, timeline: readonly TimelineEvent[], minute: number, timeScale: number, sound: boolean): ShopView {
  const state = replayState(timeline, 1, round.minutes, minute);
  const orders = ordersWaiting(timeline, minute);
  const text = playLine(n, state, orders, round.params.hubThresholdTins);
  const first = orders[0];
  return {
    scenario: round.scenario,
    state,
    params: round.params,
    text,
    chars: text.length,
    sound,
    title: ROUND_TITLES[n],
    clock: countdown(round, minute, timeScale),
    ...(first ? {till: {customer: orderCustomer(first.order), tins: first.tins}} : {}),
  };
}

export function roundRows(n: RoundNumber, r: RoundResult): Row[] {
  const rows: Row[] = [
    {label: 'SALES MADE', values: [formatGbp(r.capturedGbp)]},
    {label: 'WALKED OUT', values: [String(r.walkedOut)]},
    {label: 'TIME UNMANNED', values: [`${r.unmannedMinutes} MIN`]},
  ];
  if (n === 2) rows.push({label: 'SENT TO HUB', values: [`${r.tinsSentToHub} TINS`]});
  if (r.ordersLeft > 0) rows.push({label: 'ORDERS NOT MIXED', values: [String(r.ordersLeft)]});
  return rows;
}

export const ROUNDS_TITLE = 'ROUND 1 VS ROUND 2';
export const ROUND_HEADINGS = ['ROUND 1', 'ROUND 2'] as const;

/** The two rounds side by side; labels are short so two columns of figures fit beside them. */
export function roundComparisonRows(r1: RoundResult, r2: RoundResult): Row[] {
  return [
    {label: 'SALES MADE', values: [formatGbp(r1.capturedGbp), formatGbp(r2.capturedGbp)]},
    {label: 'WALKED OUT', values: [String(r1.walkedOut), String(r2.walkedOut)]},
    {label: 'UNMANNED', values: [`${r1.unmannedMinutes} MIN`, `${r2.unmannedMinutes} MIN`]},
  ];
}

/** What the hub changed between the rounds, measured in sales; the sign decides the wording. */
export function roundsVerdict(r1: RoundResult, r2: RoundResult): Row {
  const gained = r2.capturedGbp - r1.capturedGbp;
  if (gained > 0) return {label: 'THE HUB WON', values: [`+${formatGbp(gained)}`]};
  if (gained < 0) return {label: 'ROUND 1 WON', values: [`+${formatGbp(-gained)}`]};
  return {label: 'NO DIFFERENCE', values: []};
}

export const ROUNDS_NOTE = 'TWO SHORT ROUNDS. NEXT, A WHOLE SHIFT.';

const gbp = (n: number): string => `GBP${n.toLocaleString('en-GB')}`;

export function roundsAnnouncement(r1: RoundResult, r2: RoundResult, next: string): string {
  const gained = r2.capturedGbp - r1.capturedGbp;
  const verdict =
    gained > 0 ? `With the hub you made ${gbp(gained)} more in sales.` : gained < 0 ? `Round 1 made ${gbp(-gained)} more in sales.` : 'Both rounds made the same sales.';
  const round = (n: RoundNumber, r: RoundResult): string =>
    `Round ${n}: ${gbp(r.capturedGbp)} in sales made, ${r.walkedOut} customers walked out, ${r.unmannedMinutes} shop minutes unmanned.`;
  return `Round 1 against round 2. ${round(1, r1)} ${round(2, r2)} ${verdict} ${next}`;
}

export function roundAnnouncement(n: RoundNumber, r: RoundResult, next: string): string {
  const hub = n === 2 ? ` ${r.tinsSentToHub} tins sent to the hub.` : '';
  const left = r.ordersLeft > 0 ? ` ${r.ordersLeft} orders not mixed.` : '';
  return `Round ${n} result: ${gbp(r.capturedGbp)} in sales made, ${r.walkedOut} customers walked out, ${r.unmannedMinutes} shop minutes with the counter unmanned.${hub}${left} ${next}`;
}
