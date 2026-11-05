import {describe, expect, test} from 'bun:test';

import {EFFECTS} from '../audio/sfx';
import {runControlled} from '../sim/control';
import {drawArrivals} from '../sim/arrivals';
import {compare} from '../sim/engine';
import {DEFAULT_PARAMS} from '../sim/params';
import {playRound, setupRound} from '../sim/round';
import type {TimelineEventType} from '../sim/timeline';
import {arrowLift, FLASH_MINUTES, flashOn, JUICE, wobble} from './juice';

describe('the juice table', () => {
  test('has an entry for every event in the timelines', () => {
    const types = new Set<TimelineEventType>();
    for (const seed of [1, 2, 3]) {
      const day = compare(seed, DEFAULT_PARAMS);
      for (const e of [...day.today.timeline, ...day.hub.timeline]) types.add(e.type);
      const controlled = runControlled('today', drawArrivals(seed, DEFAULT_PARAMS), DEFAULT_PARAMS, []);
      for (const e of controlled.result.timeline) types.add(e.type);
      for (const n of [1, 2] as const) for (const e of playRound(setupRound(n === 1 ? 'today' : 'hub', seed, DEFAULT_PARAMS, 60), []).timeline) types.add(e.type);
    }
    expect(types.size).toBeGreaterThan(4);
    for (const type of types) expect(JUICE[type]).toBeDefined();
  });

  test('names only effects that exist, and writes every visual down', () => {
    for (const juice of Object.values(JUICE)) {
      if (juice.sound) expect(Object.keys(EFFECTS)).toContain(juice.sound);
      expect(juice.visual).not.toBe('');
    }
  });
});

describe('motion', () => {
  test('wobbles one pixel either way, and holds still when calm', () => {
    expect(wobble(0, 0.5, false)).toBe(1);
    expect(wobble(0.5, 0.5, false)).toBe(-1);
    expect(wobble(0.5, 0.5, true)).toBe(0);
  });

  test('bounces the arrow, and holds it still when calm', () => {
    expect(arrowLift(0, false)).toBe(0);
    expect(arrowLift(300, false)).toBe(1);
    expect(arrowLift(300, true)).toBe(0);
  });

  test('flashes only just after a walk-out, and never when calm', () => {
    expect(flashOn(0, false)).toBe(true);
    expect(flashOn(0.3, false)).toBe(false);
    expect(flashOn(FLASH_MINUTES, false)).toBe(false);
    expect(flashOn(-1, false)).toBe(false);
    expect(flashOn(0, true)).toBe(false);
  });
});
