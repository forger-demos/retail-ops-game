import {describe, expect, test} from 'bun:test';

import {compare} from '../sim/engine';
import {DEFAULT_PARAMS} from '../sim/params';
import {clockText, DEFAULT_TIME_SCALE, realMsFor, replayDurationMs, replayState, shopMinuteAt, staffOnFloor} from './replay';

const SEEDS = [1, 2, 3, 7, 42, 99];
const FRAME_MS = 1000 / 60;

describe('replay timing', () => {
  test('an 8 hour shift at 1 s = 5 min plays in 96 s', () => {
    expect(DEFAULT_TIME_SCALE).toBe(5);
    expect(replayDurationMs(8 * 60)).toBe(96_000);
    expect(replayDurationMs(240, 10)).toBe(24_000);
  });

  test('the replay finishes within one frame of its length, and not a frame before', () => {
    const {shiftMinutes, staff} = DEFAULT_PARAMS;
    const {timeline} = compare(1, DEFAULT_PARAMS).today;
    const length = replayDurationMs(shiftMinutes);
    expect(replayState(timeline, staff, shiftMinutes, shopMinuteAt(length - FRAME_MS)).finished).toBe(false);
    expect(replayState(timeline, staff, shiftMinutes, shopMinuteAt(length)).finished).toBe(true);
  });

  test('shop minutes and real milliseconds convert both ways', () => {
    expect(shopMinuteAt(1000)).toBe(5);
    expect(shopMinuteAt(-50)).toBe(0);
    expect(realMsFor(shopMinuteAt(12_345))).toBeCloseTo(12_345);
  });

  test('the clock runs from opening and holds at closing', () => {
    expect(clockText(0, 480)).toBe('09:00');
    expect(clockText(65.9, 480)).toBe('10:05');
    expect(clockText(480, 480)).toBe('17:00');
    expect(clockText(600, 480)).toBe('17:00');
  });
});

describe('replayState', () => {
  test('the counters at the end of a replay equal the metrics for the same seed', () => {
    for (const seed of SEEDS) {
      const c = compare(seed, DEFAULT_PARAMS);
      for (const run of [c.today, c.hub]) {
        const end = replayState(run.timeline, DEFAULT_PARAMS.staff, DEFAULT_PARAMS.shiftMinutes, shopMinuteAt(replayDurationMs(DEFAULT_PARAMS.shiftMinutes)));
        expect({seed, served: end.served, lost: end.lost, gbp: end.lostGbp}).toEqual({
          seed,
          served: run.metrics.walkInsServed,
          lost: run.metrics.walkInsLost,
          gbp: run.metrics.salesLostGbp,
        });
      }
    }
  });

  test('the shop opens empty, with every staff member on the floor', () => {
    const params = {...DEFAULT_PARAMS, staff: 3};
    const {timeline} = compare(1, params).today;
    const first = timeline[0]?.at ?? 0;
    const open = replayState(timeline, params.staff, params.shiftMinutes, Math.min(0, first - 1));
    expect(open.waiting).toEqual([]);
    expect(open.served).toBe(0);
    expect(open.staff.map(s => s.activity)).toEqual(['idle', 'idle', 'idle']);
  });

  test('whenever the timeline says nobody is on the floor, nobody is', () => {
    let empties = 0;
    for (const staff of [1, 2]) {
      const params = {...DEFAULT_PARAMS, staff};
      for (const seed of SEEDS) {
        const {timeline} = compare(seed, params).today;
        for (const e of timeline) {
          if (e.type !== 'walk-in-arrive') continue;
          // Staff only come back to the floor before arrivals at the same minute, so a later
          // event in that minute can take someone off the floor but never put them back.
          const onFloor = staffOnFloor(replayState(timeline, staff, params.shiftMinutes, e.at));
          if (e.staffOnFloor === 0) expect({seed, at: e.at, onFloor}).toEqual({seed, at: e.at, onFloor: 0});
          else expect(onFloor).toBeLessThanOrEqual(e.staffOnFloor);
          empties += e.staffOnFloor === 0 ? 1 : 0;
        }
      }
    }
    expect(empties).toBeGreaterThan(0);
  });

  test('a mix counts its tins up and fills its progress', () => {
    const {timeline} = compare(1, DEFAULT_PARAMS).today;
    const mix = timeline.find(e => e.type === 'mix-start' && e.tins >= 3);
    if (mix?.type !== 'mix-start') throw new Error('seed 1 has no 3-tin mix');
    const perTin = (mix.until - mix.at) / mix.tins;
    const at = (m: number) => replayState(timeline, 1, DEFAULT_PARAMS.shiftMinutes, m).staff[0]?.mix;
    expect(at(mix.at)).toEqual({tin: 1, tins: mix.tins, progress: 0});
    expect(at(mix.at + perTin * 2 + 0.5)?.tin).toBe(3);
    expect(at(mix.until - 0.01)?.tin).toBe(mix.tins);
  });

  test('a staff member back from mixing is marked so the scene can walk them back', () => {
    const {timeline} = compare(1, DEFAULT_PARAMS).today;
    const backs = timeline
      .filter(e => e.type === 'mix-start')
      .map(e => replayState(timeline, 1, DEFAULT_PARAMS.shiftMinutes, e.until).staff[0])
      .filter(s => s?.activity !== 'mixing');
    expect(backs.length).toBeGreaterThan(0);
    for (const s of backs) expect(s?.backFromMixAt).toBe(s?.since ?? -1);
  });

  test('waiting walk-ins queue in arrival order and leave the queue when served or lost', () => {
    const {timeline} = compare(1, DEFAULT_PARAMS).today;
    const lost = timeline.find(e => e.type === 'walk-in-lost');
    if (lost?.type !== 'walk-in-lost') throw new Error('seed 1 loses nobody');
    const before = replayState(timeline, 1, DEFAULT_PARAMS.shiftMinutes, lost.at - 0.5);
    const after = replayState(timeline, 1, DEFAULT_PARAMS.shiftMinutes, lost.at);
    expect(before.waiting.map(w => w.walkIn)).toContain(lost.walkIn);
    expect(after.waiting.map(w => w.walkIn)).not.toContain(lost.walkIn);
    const since = before.waiting.map(w => w.since);
    expect(since).toEqual([...since].sort((a, b) => a - b));
    expect(after.losses.at(-1)).toEqual({walkIn: lost.walkIn, at: lost.at, saleGbp: lost.saleGbp});
  });

  test('the hub run records each dispatch; today never dispatches', () => {
    const c = compare(1, DEFAULT_PARAMS);
    const end = (run: typeof c.today) => replayState(run.timeline, 1, DEFAULT_PARAMS.shiftMinutes, DEFAULT_PARAMS.shiftMinutes);
    expect(end(c.today).dispatches).toEqual([]);
    expect(end(c.hub).dispatches.length).toBe(c.hub.metrics.ordersSentToHub);
  });
});
