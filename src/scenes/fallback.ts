import {SCENARIO_TITLES} from '../render/narration';
import type {Comparison} from '../sim/engine';

export const FALLBACK_HEADLINE = 'This demo needs a modern browser.';

/** The results as plain sentences, for a browser that cannot draw the canvas. */
export function fallbackLines(c: Comparison): string[] {
  const line = (name: 'today' | 'hub'): string => {
    const m = c[name].metrics;
    return `${SCENARIO_TITLES[name]}: ${m.walkInsServed} of ${m.walkIns} walk-ins served, ${m.walkInsLost} walked out, GBP${m.salesLostGbp} in lost sales.`;
  };
  const saved = c.today.metrics.salesLostGbp - c.hub.metrics.salesLostGbp;
  return [line('today'), line('hub'), `Sending large orders to the hub saves GBP${saved} in one shift.`];
}
