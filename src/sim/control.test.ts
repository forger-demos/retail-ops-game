import {describe, expect, test} from 'bun:test';

import {drawArrivals} from './arrivals';
import {runControlled} from './control';
import {runScenario} from './engine';
import {DEFAULT_PARAMS} from './params';

const params = {...DEFAULT_PARAMS, staff: 1};
const arrivals = drawArrivals(3, params);

describe('runControlled', () => {
  test('with no choices the result is autoplay', () => {
    expect(runControlled('today', arrivals, params, []).result).toEqual(runScenario('today', arrivals, params));
  });

  test('reports the first undecided decision, and none once every decision is made', () => {
    const first = runControlled('today', arrivals, params, []);
    expect(first.pending?.index).toBe(0);
    let choices: ('walk-in' | 'order')[] = [];
    for (let run = first; run.pending; run = runControlled('today', arrivals, params, choices)) choices = [...choices, 'order'];
    expect(runControlled('today', arrivals, params, choices).pending).toBeNull();
  });

  test('choices are replayed identically and change the outcome', () => {
    const orders = runControlled('today', arrivals, params, Array(200).fill('order')).result;
    expect(orders).toEqual(runControlled('today', arrivals, params, Array(200).fill('order')).result);
    expect(orders.metrics).not.toEqual(runScenario('today', arrivals, params).metrics);
  });
});
