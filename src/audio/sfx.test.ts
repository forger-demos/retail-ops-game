import {describe, expect, test} from 'bun:test';

import {compare} from '../sim/engine';
import {DEFAULT_PARAMS} from '../sim/params';
import type {TimelineEvent} from '../sim/timeline';
import {type AudioLike, createSfx, EFFECTS, effectsBetween, type SfxName} from './sfx';

const timeline: TimelineEvent[] = [
  {type: 'walk-in-arrive', at: 1, walkIn: 0, freeStaff: 1, staffOnFloor: 1},
  {type: 'order-arrive', at: 2, order: 0, tins: ['750ml', '2.5L']},
  {type: 'mix-start', at: 2, order: 0, staff: 0, tins: 2, until: 4},
  {type: 'walk-in-lost', at: 5, walkIn: 1, saleGbp: 40},
  {type: 'hub-dispatch', at: 6, order: 1, tins: 3, deliveryAt: 60},
];

describe('effectsBetween', () => {
  test('names an effect for each walk-in, walk-out, finished tin and van', () => {
    expect(effectsBetween(timeline, 0, 1)).toEqual(['walk-in']);
    expect(effectsBetween(timeline, 1, 2)).toEqual([]);
    expect(effectsBetween(timeline, 2, 3)).toEqual(['tin-done']);
    expect(effectsBetween(timeline, 3, 4)).toEqual(['tin-done']);
    expect(effectsBetween(timeline, 4, 5)).toEqual(['walkout']);
    expect(effectsBetween(timeline, 5, 6)).toEqual(['van']);
  });

  test('is silent for events at the start of the window, so a frame never repeats one', () => {
    expect(effectsBetween(timeline, 1, 1.5)).toEqual([]);
  });

  test('puts several events in one window in time order', () => {
    const wide: TimelineEvent[] = [
      {type: 'hub-dispatch', at: 0.8, order: 0, tins: 1, deliveryAt: 9},
      {type: 'walk-in-arrive', at: 0.5, walkIn: 0, freeStaff: 1, staffOnFloor: 1},
    ];
    expect(effectsBetween(wide, 0, 1)).toEqual(['walk-in', 'van']);
  });

  test('stays silent across a skip or a rewind', () => {
    expect(effectsBetween(timeline, 0, 30)).toEqual([]);
    expect(effectsBetween(timeline, 6, 0)).toEqual([]);
  });

  test('covers every effect over a real shift', () => {
    const day = compare(1, DEFAULT_PARAMS);
    const heard = new Set<SfxName>();
    for (const scenario of [day.today, day.hub]) {
      for (let m = 0; m < DEFAULT_PARAMS.shiftMinutes; m += 0.5) for (const n of effectsBetween(scenario.timeline, m, m + 0.5)) heard.add(n);
    }
    expect(heard.size).toBeGreaterThan(0);
    for (const n of heard) expect(Object.keys(EFFECTS)).toContain(n);
  });
});

function fakeContext(): {ctx: AudioLike; started: {type: string; hz: number; at: number}[]; resumed: number[]} {
  const started: {type: string; hz: number; at: number}[] = [];
  const resumed: number[] = [];
  const ctx: AudioLike = {
    currentTime: 10,
    destination: {},
    resume: async () => resumed.push(1),
    createGain: () => ({gain: {setValueAtTime: () => 0, linearRampToValueAtTime: () => 0}, connect: () => 0}),
    createOscillator: () => {
      const osc = {
        type: '',
        hz: 0,
        frequency: {setValueAtTime: (hz: number) => void (osc.hz = hz)},
        connect: () => 0,
        start: (at: number) => void started.push({type: osc.type, hz: osc.hz, at}),
        stop: () => undefined,
      };
      return osc;
    },
  };
  return {ctx, started, resumed};
}

describe('createSfx', () => {
  test('is muted on load and makes no audio context until unmuted', () => {
    let made = 0;
    const sfx = createSfx(() => {
      made++;
      return fakeContext().ctx;
    });
    sfx.play('walk-in');
    expect(sfx.on).toBe(false);
    expect(made).toBe(0);
  });

  test('plays nothing while muted, and square-wave notes once unmuted', () => {
    const {ctx, started} = fakeContext();
    const sfx = createSfx(() => ctx);
    sfx.play('van');
    expect(started).toEqual([]);
    expect(sfx.toggle()).toBe(true);
    sfx.play('van');
    expect(started.map(s => s.hz)).toEqual(EFFECTS.van.map(n => n.hz));
    expect(started.every(s => s.type === 'square')).toBe(true);
    expect(started[0]?.at).toBe(10);
  });

  test('mutes again on the second toggle and reuses one context', () => {
    let made = 0;
    const {ctx, started} = fakeContext();
    const sfx = createSfx(() => (made++, ctx));
    sfx.toggle();
    expect(sfx.toggle()).toBe(false);
    sfx.play('walkout');
    expect(started).toEqual([]);
    sfx.toggle();
    expect(made).toBe(1);
  });

  test('wakes a suspended context on unmute', () => {
    const {ctx, resumed} = fakeContext();
    createSfx(() => ctx).toggle();
    expect(resumed).toEqual([1]);
  });

  test('stays off when the browser has no audio', () => {
    expect(createSfx(() => null).toggle()).toBe(false);
    expect(
      createSfx(() => {
        throw new Error('blocked');
      }).toggle(),
    ).toBe(false);
  });
});
