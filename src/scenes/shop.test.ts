import {describe, expect, test} from 'bun:test';

import type {Plot} from '../render/font';
import {isShade} from '../render/palette';
import {replayState, type ReplayState, type StaffView} from '../render/replay';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {compare} from '../sim/engine';
import {DEFAULT_PARAMS, type ScenarioName} from '../sim/params';
import {BAY, DOOR_SPOT, drawShop, FLOOR, inside, LOSS_MINUTES, QUEUE_SLOTS, type Rect, staffPosition, SPEAKER, VAN_MINUTES, WALK_MINUTES} from './shop';

const UNDRAWN = 255;

/** Renders into a shade buffer, failing on any plot outside the screen or outside the palette. */
function render(state: ReplayState, scenario: ScenarioName = 'today', text = 'HELLO', sound = false): Uint8Array {
  const buf = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(UNDRAWN);
  const plot: Plot = (x, y, w, h, shade) => {
    if (x < 0 || y < 0 || x + w > SCREEN_WIDTH || y + h > SCREEN_HEIGHT || !isShade(shade)) {
      throw new Error(`plot out of bounds: ${[x, y, w, h, shade].join(',')}`);
    }
    for (let yy = y; yy < y + h; yy++) buf.fill(shade, yy * SCREEN_WIDTH + x, yy * SCREEN_WIDTH + x + w);
  };
  drawShop(plot, {scenario, state, params: DEFAULT_PARAMS, text, chars: text.length, sound});
  return buf;
}

const region = (buf: Uint8Array, r: Rect): number[] => {
  const out: number[] = [];
  for (let y = r.y; y < r.y + r.h; y++) out.push(...buf.subarray(y * SCREEN_WIDTH + r.x, y * SCREEN_WIDTH + r.x + r.w));
  return out;
};

const idle = (staff: number): StaffView => ({staff, activity: 'idle', since: 0, backFromMixAt: null, mix: null});
const base = (over: Partial<ReplayState> = {}): ReplayState => ({
  minute: 60,
  finished: false,
  served: 0,
  lost: 0,
  lostGbp: 0,
  staff: [idle(0)],
  waiting: [],
  serving: [],
  losses: [],
  dispatches: [],
  ...over,
});

describe('shop scene', () => {
  test('the status bar shows whether sound is on', () => {
    const state = replayState(compare(1, DEFAULT_PARAMS).today.timeline, 2, DEFAULT_PARAMS.shiftMinutes, 10);
    const region = (buf: Uint8Array): number[] => {
      const out: number[] = [];
      for (let y = SPEAKER.y; y < SPEAKER.y + SPEAKER.h; y++) for (let x = SPEAKER.x; x < SPEAKER.x + SPEAKER.w; x++) out.push(buf[y * SCREEN_WIDTH + x] ?? UNDRAWN);
      return out;
    };
    expect(region(render(state, 'today', 'HELLO', true))).not.toEqual(region(render(state, 'today', 'HELLO', false)));
  });

  test('every frame of a replay fills the screen in palette colours and stays on it', () => {
    const c = compare(1, DEFAULT_PARAMS);
    for (const run of [c.today, c.hub]) {
      for (let m = 0; m <= DEFAULT_PARAMS.shiftMinutes + 5; m += 1.7) {
        const buf = render(replayState(run.timeline, DEFAULT_PARAMS.staff, DEFAULT_PARAMS.shiftMinutes, m), run.scenario);
        expect(buf.includes(UNDRAWN)).toBe(false);
      }
    }
  });

  test('the floor is drawn empty of staff whenever every staff member is mixing', () => {
    const c = compare(1, {...DEFAULT_PARAMS, staff: 2});
    let checked = 0;
    for (let m = 0; m < DEFAULT_PARAMS.shiftMinutes; m += 0.5) {
      const state = replayState(c.today.timeline, 2, DEFAULT_PARAMS.shiftMinutes, m);
      if (state.staff.some(s => s.activity !== 'mixing')) continue;
      checked++;
      expect(region(render(state), FLOOR)).toEqual(region(render({...state, staff: []}), FLOOR));
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('a mixing staff member never stands on the floor, even mid-walk', () => {
    for (let k = 0; k < 4; k++) {
      for (let t = 0; t <= WALK_MINUTES + 1; t += 0.25) {
        const p = staffPosition({staff: k, activity: 'mixing', since: 0, backFromMixAt: null, mix: {tin: 1, tins: 2, progress: 0}}, t);
        expect({k, t, overlapsFloor: p.x < FLOOR.x + FLOOR.w}).toEqual({k, t, overlapsFloor: false});
      }
    }
  });

  test('at opening the staff stand at the counter and nobody waits', () => {
    const c = compare(1, {...DEFAULT_PARAMS, staff: 4});
    const open = replayState(c.today.timeline, 4, DEFAULT_PARAMS.shiftMinutes, 0);
    for (const s of open.staff) expect(inside(FLOOR, staffPosition(s, 0))).toBe(true);
    const empty = base({minute: 0, staff: open.staff});
    expect(region(render(empty), FLOOR)).toEqual(region(render({...empty, waiting: []}), FLOOR));
  });

  test('a staff member back from mixing walks to the counter', () => {
    const back: StaffView = {staff: 0, activity: 'idle', since: 100, backFromMixAt: 100, mix: null};
    const start = staffPosition(back, 100);
    const end = staffPosition(back, 100 + WALK_MINUTES);
    expect(start).not.toEqual(end);
    expect(end).toEqual(staffPosition(idle(0), 0));
  });

  test('a full queue sends the extra walk-ins to the door, still counted', () => {
    const waiting = (n: number) => Array.from({length: n}, (_, i) => ({walkIn: i, since: 55}));
    const door: Rect = {x: DOOR_SPOT.x, y: DOOR_SPOT.y, w: 24, h: 8};
    const full = render(base({waiting: waiting(QUEUE_SLOTS)}));
    const over2 = render(base({waiting: waiting(QUEUE_SLOTS + 2)}));
    const over3 = render(base({waiting: waiting(QUEUE_SLOTS + 3)}));
    expect(region(full, door)).not.toEqual(region(over2, door));
    expect(region(over2, door)).not.toEqual(region(over3, door));
    const outside = (buf: Uint8Array) => region(buf, {x: 30, y: 20, w: 70, h: 92});
    expect(outside(over2)).toEqual(outside(over3));
  });

  test('a walk-out shows for a moment, then is gone', () => {
    const losses = [{walkIn: 1, at: 60, saleGbp: 95}];
    const plain = region(render(base({minute: 61})), FLOOR);
    expect(region(render(base({minute: 61, losses})), FLOOR)).not.toEqual(plain);
    expect(region(render(base({minute: 60 + LOSS_MINUTES, losses})), FLOOR)).toEqual(region(render(base({minute: 60 + LOSS_MINUTES})), FLOOR));
  });

  test('in the hub run a van leaves the bay for each dispatch', () => {
    const dispatches = [{order: 1, at: 60, tins: 8, deliveryAt: 180}];
    const parked = region(render(base({minute: 59}), 'hub'), BAY);
    expect(region(render(base({minute: 62, dispatches}), 'hub'), BAY)).not.toEqual(parked);
    expect(region(render(base({minute: 60 + VAN_MINUTES, dispatches}), 'hub'), BAY)).toEqual(parked);
    expect(region(render(base(), 'today'), BAY)).not.toEqual(parked);
  });
});
