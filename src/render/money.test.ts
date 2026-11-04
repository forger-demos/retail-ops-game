import {describe, expect, test} from 'bun:test';

import {formatGbp} from './money';

describe('formatGbp', () => {
  test.each([
    [0, 'GBP0'],
    [95, 'GBP95'],
    [9999, 'GBP9999'],
    [10_000, 'GBP10K'],
    [12_345, 'GBP12.3K'],
    [123_456, 'GBP123K'],
    [999_499, 'GBP999K'],
    [999_500, 'GBP1M'],
    [1_234_567, 'GBP1.2M'],
    [15_400_000, 'GBP15.4M'],
    [2_500_000_000, 'GBP2.5B'],
    [-1_234_567, '-GBP1.2M'],
    [-40, '-GBP40'],
  ])('%p reads %p', (gbp, text) => {
    expect(formatGbp(gbp)).toBe(text);
  });

  test('never runs wider than nine characters below a trillion', () => {
    for (let gbp = 1; gbp < 1e12; gbp = Math.ceil(gbp * 1.37)) expect(formatGbp(-gbp).length).toBeLessThanOrEqual(9);
  });
});
