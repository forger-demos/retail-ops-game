import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';

import {describe, expect, test} from 'bun:test';

import type {Arrivals, MixOrderArrival} from './arrivals';
import {drawArrivals} from './arrivals';
import {compare, runScenario} from './engine';
import type {TinSize} from './params';
import {DEFAULT_PARAMS, withParams} from './params';
import type {TimelineEvent} from './timeline';

const order = (id: number, at: number, tinCount: number): MixOrderArrival => {
  const tins: TinSize[] = Array.from({length: tinCount}, () => '5L');
  return {id, at, tins, valueGbp: tinCount * DEFAULT_PARAMS.tinPricesGbp['5L']};
};

const ofType = <T extends TimelineEvent['type']>(timeline: readonly TimelineEvent[], type: T) =>
  timeline.filter((e): e is Extract<TimelineEvent, {type: T}> => e.type === type);

describe('determinism', () => {
  test('same seed and parameters give an identical timeline and metrics', () => {
    expect(compare(42, DEFAULT_PARAMS)).toEqual(compare(42, DEFAULT_PARAMS));
  });

  test('different seeds give different timelines', () => {
    expect(compare(1, DEFAULT_PARAMS).today.timeline).not.toEqual(compare(2, DEFAULT_PARAMS).today.timeline);
  });

  test('timeline is ordered by time', () => {
    const {timeline} = compare(7, DEFAULT_PARAMS).today;
    for (let i = 1; i < timeline.length; i++) expect(timeline[i]?.at).toBeGreaterThanOrEqual(timeline[i - 1]?.at ?? 0);
  });
});

describe('same seed comparison (ADR 0001)', () => {
  test.each([1, 2, 3, 99])('seed %d: today and hub see identical walk-ins and mix orders', seed => {
    const {today, hub} = compare(seed, DEFAULT_PARAMS);
    const walkIns = (t: readonly TimelineEvent[]) => ofType(t, 'walk-in-arrive').map(e => [e.walkIn, e.at]);
    const orders = (t: readonly TimelineEvent[]) => ofType(t, 'order-arrive').map(e => [e.order, e.at, e.tins]);
    expect(walkIns(hub.timeline)).toEqual(walkIns(today.timeline));
    expect(orders(hub.timeline)).toEqual(orders(today.timeline));
    expect(walkIns(today.timeline).length).toBeGreaterThan(0);
    expect(orders(today.timeline).length).toBeGreaterThan(0);
  });

  test('arrivals stay within the shift and order sizes within the mix', () => {
    const {walkIns, mixOrders} = drawArrivals(5, DEFAULT_PARAMS);
    for (const w of walkIns) {
      expect(w.at).toBeLessThan(DEFAULT_PARAMS.shiftMinutes);
      expect(Number.isInteger(w.at)).toBe(true);
    }
    for (const o of mixOrders) {
      expect(o.at).toBeLessThan(DEFAULT_PARAMS.shiftMinutes);
      expect(Number.isInteger(o.at)).toBe(true);
      expect(o.tins.length).toBeGreaterThanOrEqual(1);
      expect(o.tins.length).toBeLessThanOrEqual(12);
      expect(o.valueGbp).toBe(o.tins.reduce((s, t) => s + DEFAULT_PARAMS.tinPricesGbp[t], 0));
    }
  });
});

describe('hub scenario', () => {
  test.each([1, 2, 3, 4, 5, 6, 7, 8])('seed %d: no order over the threshold is mixed in store; each is dispatched for delivery 120 minutes later', seed => {
    const {today, hub} = compare(seed, DEFAULT_PARAMS);
    const arrivals = ofType(hub.timeline, 'order-arrive');
    const large = new Set(arrivals.filter(o => o.tins.length > DEFAULT_PARAMS.hubThresholdTins).map(o => o.order));
    const mixedInHub = ofType(hub.timeline, 'mix-start');
    for (const m of mixedInHub) expect(large.has(m.order)).toBe(false);
    const dispatches = ofType(hub.timeline, 'hub-dispatch');
    expect(new Set(dispatches.map(d => d.order))).toEqual(large);
    for (const d of dispatches) expect(d.deliveryAt - d.at).toBe(120);
    expect(ofType(today.timeline, 'hub-dispatch')).toEqual([]);
    expect(hub.metrics.tinsMixedInStore + hub.metrics.tinsSentToHub).toBe(today.metrics.tinsMixedInStore);
  });

  test('an order of exactly the threshold stays in store', () => {
    const arrivals: Arrivals = {walkIns: [], mixOrders: [order(0, 10, 5), order(1, 100, 6)]};
    const {timeline} = runScenario('hub', arrivals, DEFAULT_PARAMS);
    expect(ofType(timeline, 'mix-start').map(e => e.order)).toEqual([0]);
    expect(ofType(timeline, 'hub-dispatch').map(e => e.order)).toEqual([1]);
  });
});

describe('walk-ins', () => {
  test('a walk-in who waits past patience is lost at the average sale; one served in time is not', () => {
    const arrivals: Arrivals = {walkIns: [{id: 0, at: 0}, {id: 1, at: 1}, {id: 2, at: 2}, {id: 3, at: 3}], mixOrders: []};
    const params = withParams({serviceMinutes: 4, patienceMinutes: 10});
    const {timeline, metrics} = runScenario('today', arrivals, params);
    expect(metrics.walkInsLost).toBe(0);
    const tight = runScenario('today', arrivals, withParams({serviceMinutes: 4, patienceMinutes: 5}));
    expect(ofType(tight.timeline, 'walk-in-served').map(e => e.walkIn)).toEqual([0, 1, 3]);
    expect(ofType(tight.timeline, 'walk-in-lost')).toEqual([{type: 'walk-in-lost', at: 7, walkIn: 2, saleGbp: 95}]);
    expect(tight.metrics).toMatchObject({walkInsServed: 3, walkInsLost: 1, salesLostGbp: 95});
    expect(ofType(timeline, 'walk-in-served')).toHaveLength(4);
  });

  test('a walk-in served exactly at the patience limit is not lost', () => {
    const arrivals: Arrivals = {walkIns: [{id: 0, at: 0}, {id: 1, at: 0}], mixOrders: []};
    const {metrics} = runScenario('today', arrivals, withParams({serviceMinutes: 10, patienceMinutes: 10}));
    expect(metrics).toMatchObject({walkInsServed: 2, walkInsLost: 0});
  });

  test('with one staff member mixing, a walk-in arriving during the mix finds the floor empty', () => {
    const arrivals: Arrivals = {walkIns: [{id: 0, at: 4}], mixOrders: [order(0, 0, 3)]};
    const {timeline, metrics} = runScenario('today', arrivals, withParams({staff: 1, patienceMinutes: 10}));
    const [arrive] = ofType(timeline, 'walk-in-arrive');
    expect(arrive).toMatchObject({freeStaff: 0, staffOnFloor: 0});
    expect(metrics).toMatchObject({walkInsLost: 1, salesLostGbp: 95, tinsMixedInStore: 3, staffMinutesOffFloor: 15});
  });

  test('a second staff member serves the walk-in while the first mixes', () => {
    const arrivals: Arrivals = {walkIns: [{id: 0, at: 5}], mixOrders: [order(0, 0, 3)]};
    const {timeline, metrics} = runScenario('today', arrivals, withParams({staff: 2}));
    expect(ofType(timeline, 'walk-in-arrive')[0]).toMatchObject({freeStaff: 1, staffOnFloor: 1});
    expect(metrics.walkInsServed).toBe(1);
  });
});

describe('metrics', () => {
  test('the hub run loses no more sales than today, and saves some on the default day', () => {
    let saved = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const {today, hub} = compare(seed, DEFAULT_PARAMS);
      for (const m of [today.metrics, hub.metrics]) {
        expect(m.walkInsServed + m.walkInsLost).toBe(m.walkIns);
        expect(m.salesLostGbp).toBe(m.walkInsLost * DEFAULT_PARAMS.averageSaleGbp);
        expect(m.ordersMixedInStore + m.ordersSentToHub).toBe(m.mixOrders);
      }
      saved += today.metrics.salesLostGbp - hub.metrics.salesLostGbp;
    }
    expect(saved).toBeGreaterThan(0);
  });

  test('reports every metric the demo needs', () => {
    expect(Object.keys(compare(1, DEFAULT_PARAMS).today.metrics)).toEqual(
      expect.arrayContaining(['tinsMixedInStore', 'ordersSentToHub', 'walkInsServed', 'walkInsLost', 'salesLostGbp', 'staffMinutesOffFloor'])
    );
  });
});

test('the simulation imports nothing but itself', () => {
  for (const file of readdirSync(import.meta.dir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const source = readFileSync(join(import.meta.dir, file), 'utf8');
    for (const [, specifier] of source.matchAll(/from\s+'([^']+)'/g)) expect(specifier).toMatch(/^\.\/[\w-]+$/);
    expect(source).not.toMatch(/\b(document|window|HTMLCanvasElement|CanvasRenderingContext2D)\b/);
  }
});
