import {summarise} from '../sim/metrics';
import type {Params, ScenarioName} from '../sim/params';
import type {TimelineEvent} from '../sim/timeline';

export interface Beat {
  at: number;
  text: string;
}

/** Beats closer together than this are dropped, so each one stays up long enough to read. */
export const BEAT_GAP_MINUTES = 10;

export const SCENARIO_TITLES: Readonly<Record<ScenarioName, string>> = {today: 'TODAY', hub: 'WITH CENTRAL HUB'};

export function deliveryLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}H DELIVERY` : `${minutes}M DELIVERY`;
}

const tins = (n: number): string => `${n} ${n === 1 ? 'TIN' : 'TINS'}`;

function opening(scenario: ScenarioName, params: Params): string {
  return scenario === 'today'
    ? 'TODAY. EVERY TIN IS MIXED IN THE SHOP.'
    : `ORDERS OVER ${tins(params.hubThresholdTins)} GO TO THE HUB.`;
}

function beatFor(e: TimelineEvent, params: Params): string | null {
  switch (e.type) {
    case 'order-arrive':
      return `A CUSTOMER WANTS ${tins(e.tins.length)} MIXED!`;
    case 'hub-dispatch':
      return `${tins(e.tins)} SENT TO THE HUB. ${deliveryLabel(params.hubDeliveryMinutes)}.`;
    case 'walk-in-arrive':
      return e.staffOnFloor === 0 ? 'NOBODY ON THE FLOOR...' : null;
    case 'walk-in-lost':
      return `CUSTOMER LEFT! -GBP${e.saleGbp}`;
    default:
      return null;
  }
}

/**
 * The text box's script for one scenario, derived from its timeline alone. A beat too
 * close to the one before is dropped, except that a later beat at the same minute, or a
 * hub dispatch, replaces it: the dispatch is the point of the hub run. The opening and
 * closing beats always stand, and replacing never brings two beats closer than the gap.
 */
export function narrationBeats(scenario: ScenarioName, timeline: readonly TimelineEvent[], params: Params): Beat[] {
  const beats: Beat[] = [{at: 0, text: opening(scenario, params)}];
  for (const e of timeline) {
    if (e.at >= params.shiftMinutes) break;
    const text = beatFor(e, params);
    if (text === null) continue;
    const last = beats[beats.length - 1];
    if (last === undefined) continue;
    const spaced = e.at - last.at >= BEAT_GAP_MINUTES;
    const displaces = beats.length > 1 && (last.at === e.at || e.type === 'hub-dispatch');
    if (displaces && !spaced) beats[beats.length - 1] = {at: e.at, text};
    else if (spaced) beats.push({at: e.at, text});
  }
  const m = summarise(timeline);
  beats.push({at: params.shiftMinutes, text: `CLOSING TIME. ${m.walkInsLost} WALKED OUT. GBP${m.salesLostGbp} LOST.`});
  return beats;
}

export function beatAt(beats: readonly Beat[], minute: number): Beat | null {
  let found: Beat | null = null;
  for (const b of beats) {
    if (b.at > minute) break;
    found = b;
  }
  return found;
}

export function nextBeatAfter(beats: readonly Beat[], minute: number): Beat | null {
  return beats.find(b => b.at > minute) ?? null;
}
