import {describe, expect, test} from 'bun:test';

import {drawArrivals} from './arrivals';
import {compare} from './engine';
import {averageWalkInGbp, DEFAULT_PARAMS, WALK_IN_KINDS, withParams} from './params';

describe('walk-in types', () => {
  test('the default shares total one and the expected value is the documented average sale', () => {
    expect(DEFAULT_PARAMS.walkInTypes.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1, 10);
    expect(averageWalkInGbp(DEFAULT_PARAMS)).toBeCloseTo(95, 10);
  });

  test('over many seeds the mean walk-in value comes out at the average sale', () => {
    let total = 0;
    let count = 0;
    for (let seed = 1; seed <= 300; seed++) {
      for (const w of drawArrivals(seed, DEFAULT_PARAMS).walkIns) {
        total += w.valueGbp;
        count++;
      }
    }
    expect(count).toBeGreaterThan(10_000);
    expect(Math.abs(total / count - 95)).toBeLessThan(2);
  });

  test('every type turns up, with its own value', () => {
    const seen = new Map<string, number>();
    for (const w of drawArrivals(1, DEFAULT_PARAMS).walkIns) seen.set(w.kind, w.valueGbp ?? -1);
    expect([...seen.keys()].sort()).toEqual([...WALK_IN_KINDS].sort());
    for (const t of DEFAULT_PARAMS.walkInTypes) expect(seen.get(t.kind)).toBe(t.valueGbp ?? -1);
  });

  test('drawing types does not move when walk-ins or mix orders arrive', () => {
    const a = drawArrivals(5, DEFAULT_PARAMS);
    const b = drawArrivals(5, withParams({walkInTypes: DEFAULT_PARAMS.walkInTypes.map(t => ({...t, share: t.kind === 'small' ? 1 : 0}))}));
    expect(b.walkIns.map(w => w.at)).toEqual(a.walkIns.map(w => w.at));
    expect(b.mixOrders).toEqual(a.mixOrders);
    expect(new Set(b.walkIns.map(w => w.kind))).toEqual(new Set(['small']));
  });

  test('lost sales are listed by type and add up to the total', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const m = compare(seed, DEFAULT_PARAMS).today.metrics;
      const kinds = Object.values(m.lostByType);
      expect(kinds.reduce((sum, t) => sum + t.count, 0)).toBe(m.walkInsLost);
      expect(kinds.reduce((sum, t) => sum + t.gbp, 0)).toBe(m.salesLostGbp);
    }
  });

  test('a lost walk-in costs the value of its own type', () => {
    const {timeline} = compare(1, DEFAULT_PARAMS).today;
    for (const e of timeline) if (e.type === 'walk-in-lost') expect(e.saleGbp).toBe(DEFAULT_PARAMS.walkInTypes.find(t => t.kind === e.kind)?.valueGbp ?? -1);
  });
});
