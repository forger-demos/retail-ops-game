import type {Comparison} from '../sim/engine';
import type {Savings} from '../sim/extrapolate';
import type {Metrics} from '../sim/metrics';
import {formatGbp} from './money';
import {SCENARIO_TITLES} from './narration';

export interface Row {
  label: string;
  values: string[];
}

export const NO_LOSS = 'NO SALES LOST TODAY';
export const FOOTNOTE = 'EXCLUDES CENTRAL PREP AND DELIVERY COSTS.';
export const RESULTS_TITLE = `${SCENARIO_TITLES.today}: RESULTS`;
export const COMPARISON_TITLE = 'TODAY VS CENTRAL HUB';
export const RESULTS_PROMPT = 'SPACE: SAME DAY WITH A CENTRAL HUB.';
export const COMPARISON_PROMPT = 'SPACE: REPLAY THIS DAY. R: RESHUFFLE THE DAY.';

export function todayRows(m: Metrics): Row[] {
  return [
    {label: 'TINS MIXED', values: [String(m.tinsMixedInStore)]},
    {label: 'CUSTOMERS SERVED', values: [String(m.walkInsServed)]},
    {label: 'CUSTOMERS LOST', values: [String(m.walkInsLost)]},
    {label: 'SALES LOST', values: [formatGbp(m.salesLostGbp)]},
  ];
}

export const COMPARISON_HEADINGS = ['TODAY', 'HUB'] as const;

export function comparisonRows(c: Comparison): Row[] {
  const {today, hub} = c;
  return [
    {label: 'WALKED OUT', values: [String(today.metrics.walkInsLost), String(hub.metrics.walkInsLost)]},
    {label: 'SALES LOST', values: [formatGbp(today.metrics.salesLostGbp), formatGbp(hub.metrics.salesLostGbp)]},
  ];
}

/** What the hub saves, scaled up; a day with nothing lost has nothing to scale, so it says so instead. */
export function savingsRows(c: Comparison, s: Savings): Row[] {
  if (c.today.metrics.salesLostGbp === 0) return [{label: NO_LOSS, values: []}];
  return [
    {label: 'SAVED PER DAY', values: [formatGbp(s.perDayGbp)]},
    {label: 'PER WEEK', values: [formatGbp(s.perWeekGbp)]},
    {label: 'PER YEAR', values: [formatGbp(s.perYearGbp)]},
    {label: `ACROSS ${s.stores} STORES`, values: [formatGbp(s.acrossStoresGbp)]},
  ];
}

/** Full pounds for a screen reader: nothing is short of room there. */
const gbp = (n: number): string => `GBP${n.toLocaleString('en-GB')}`;
const sentence = (s: string): string => s.charAt(0) + s.slice(1).toLowerCase();

export function resultsAnnouncement(m: Metrics): string {
  const lost = m.salesLostGbp === 0 ? `${sentence(NO_LOSS)}.` : `${gbp(m.salesLostGbp)} in sales lost.`;
  return `Today's results: ${m.tinsMixedInStore} tins mixed in store, ${m.walkInsServed} customers served, ${m.walkInsLost} customers lost. ${lost} Press space to run the same day with a central hub.`;
}

export function comparisonAnnouncement(c: Comparison, s: Savings): string {
  const run = (name: 'today' | 'hub'): string => {
    const m = c[name].metrics;
    return `${sentence(SCENARIO_TITLES[name])}: ${m.walkInsLost} customers lost, ${gbp(m.salesLostGbp)} in sales lost.`;
  };
  const saved =
    c.today.metrics.salesLostGbp === 0
      ? `${sentence(NO_LOSS)}.`
      : `Saved ${gbp(s.perDayGbp)} per day, ${gbp(s.perWeekGbp)} per week, ${gbp(s.perYearGbp)} per year, ${gbp(s.acrossStoresGbp)} across ${s.stores} stores.`;
  return `Comparison. ${run('today')} ${run('hub')} ${saved} ${sentence(FOOTNOTE)} Press space to replay this day, or R to reshuffle the day.`;
}
