import {describe, expect, test} from 'bun:test';

import {compare} from '../sim/engine';
import {DEFAULT_PARAMS} from '../sim/params';
import {fallbackLines} from './fallback';

describe('no-canvas fallback', () => {
  test('states both runs and the saving, from the metrics', () => {
    const c = compare(1, DEFAULT_PARAMS);
    const [today, hub, saved] = fallbackLines(c);
    const t = c.today.metrics;
    expect(today).toBe(`TODAY: ${t.walkInsServed} of ${t.walkIns} walk-ins served, ${t.walkInsLost} walked out, GBP${t.salesLostGbp} in lost sales.`);
    expect(hub).toStartWith('WITH CENTRAL HUB: ');
    expect(saved).toBe(`Sending large orders to the hub saves GBP${t.salesLostGbp - c.hub.metrics.salesLostGbp} in one shift.`);
  });
});
