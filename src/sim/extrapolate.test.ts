import {describe, expect, test} from 'bun:test';

import {compare} from './engine';
import {savings, WEEKS_PER_YEAR} from './extrapolate';
import {withParams} from './params';

describe('savings', () => {
  test('the day saved is the difference in sales lost, scaled by trading days and stores', () => {
    const c = compare(1, withParams({tradingDaysPerYear: 300, stores: 12}));
    const s = savings(c);
    const day = c.today.metrics.salesLostGbp - c.hub.metrics.salesLostGbp;
    expect(day).toBeGreaterThan(0);
    expect(s.perDayGbp).toBe(day);
    expect(s.perYearGbp).toBe(day * 300);
    expect(s.perWeekGbp).toBe(Math.round((day * 300) / WEEKS_PER_YEAR));
    expect(s.stores).toBe(12);
    expect(s.acrossStoresGbp).toBe(day * 300 * 12);
  });

  test('a day where neither run loses a sale saves nothing', () => {
    const s = savings(compare(1, withParams({walkInsPerHour: 0})));
    expect(s).toEqual({perDayGbp: 0, perWeekGbp: 0, perYearGbp: 0, stores: 50, acrossStoresGbp: 0});
  });
});
