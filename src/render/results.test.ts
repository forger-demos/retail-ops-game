import {describe, expect, test} from 'bun:test';

import {compare} from '../sim/engine';
import {savings} from '../sim/extrapolate';
import {withParams} from '../sim/params';
import {comparisonAnnouncement, resultsAnnouncement} from './results';

describe('results announcements', () => {
  test("today's results read out every figure", () => {
    const m = compare(1, withParams()).today.metrics;
    const text = resultsAnnouncement(m);
    expect(text).toContain(`${m.tinsMixedInStore} tins mixed`);
    expect(text).toContain(`${m.walkInsServed} customers served`);
    expect(text).toContain(`${m.walkInsLost} customers lost`);
    expect(text).toContain(`GBP${m.salesLostGbp.toLocaleString('en-GB')} in sales lost`);
  });

  test('the comparison reads out both runs, the savings in full pounds and the footnote', () => {
    const c = compare(1, withParams({stores: 50, tradingDaysPerYear: 360}));
    const s = savings(c);
    const text = comparisonAnnouncement(c, s);
    expect(text).toContain(`Today: ${c.today.metrics.walkInsLost} customers lost`);
    expect(text).toContain(`With central hub: ${c.hub.metrics.walkInsLost} customers lost`);
    expect(text).toContain(`GBP${s.acrossStoresGbp.toLocaleString('en-GB')} across 50 stores`);
    expect(text).toContain('Excludes central prep and delivery costs.');
  });

  test('a zero-loss day reads "No sales lost today"', () => {
    const c = compare(1, withParams({walkInsPerHour: 0}));
    expect(resultsAnnouncement(c.today.metrics)).toContain('No sales lost today.');
    expect(comparisonAnnouncement(c, savings(c))).toContain('No sales lost today.');
    expect(comparisonAnnouncement(c, savings(c))).toContain('Excludes central prep and delivery costs.');
  });
});
