import {describe, expect, test} from 'bun:test';
import type {Plot} from '../render/font';
import {isShade} from '../render/palette';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {staffOnFloor} from '../render/replay';
import {wrap, TEXTBOX_LINES} from '../render/textbox';
import {DEFAULT_PARAMS} from '../sim/params';
import {OPENING_ORDER_TINS, playRound, press, ROUND_TIME_SCALE, setupRound} from '../sim/round';
import {countdown, ordersWaiting, playView, roundAnnouncement, roundRows} from './play';
import {drawShop, UNMANNED} from './shop';
import {drawText} from '../render/font';

const today = setupRound('today', 1, DEFAULT_PARAMS, 40);
const hub = setupRound('hub', 1, DEFAULT_PARAMS, 40);

function render(view: ReturnType<typeof playView>): void {
  const plot: Plot = (x, y, w, h, shade) => {
    if (x < 0 || y < 0 || x + w > SCREEN_WIDTH || y + h > SCREEN_HEIGHT || !isShade(shade)) throw new Error(`plot out of bounds: ${[x, y, w, h, shade].join(',')}`);
  };
  drawShop(plot, view);
}

describe('a played round on screen', () => {
  test('opens on the trade order at the till and the dilemma in the text box', () => {
    const {timeline} = playRound(today, []);
    const view = playView(1, today, timeline, 0, ROUND_TIME_SCALE, false);
    expect(view.till).toEqual({customer: 0, tins: OPENING_ORDER_TINS});
    expect(view.text).toBe('A TRADE ORDER: 10 TINS. MIX THEM NOW?');
    expect(view.clock).toBe('0:40');
    expect(view.title).toBe('ROUND 1: TODAY');
    expect(playView(2, hub, playRound(hub, []).timeline, 0, ROUND_TIME_SCALE, false).text).toBe('A TRADE ORDER: 10 TINS. SEND IT TO THE HUB?');
  });

  test('the counter is unmanned exactly while the assistant is mixing', () => {
    const {commands} = press(today, [], 'mix', 0);
    const {timeline} = playRound(today, commands);
    const until = OPENING_ORDER_TINS * DEFAULT_PARAMS.minutesPerTin;
    for (let minute = 0; minute < today.minutes; minute += 0.5) {
      const view = playView(1, today, timeline, minute, ROUND_TIME_SCALE, false);
      expect({minute, unmanned: staffOnFloor(view.state) === 0}).toEqual({minute, unmanned: minute < until});
      if (minute < until) expect(view.text).toBe('THE COUNTER IS UNMANNED. NOBODY CAN SERVE.');
    }
    expect(ordersWaiting(timeline, 1)).toEqual([]);
  });

  test('every moment of a round draws on screen in palette colours, and every line fits the text box', () => {
    let commands = press(today, [], 'mix', 0).commands;
    for (let at = 0; at < today.minutes; at += 0.5) commands = press(today, commands, 'serve', at).commands;
    const {timeline} = playRound(today, commands);
    for (let minute = 0; minute <= today.minutes; minute += 1) {
      const view = playView(1, today, timeline, minute, ROUND_TIME_SCALE, true);
      render(view);
      expect(wrap(view.text).length).toBeLessThanOrEqual(TEXTBOX_LINES);
    }
    const sent = playRound(hub, press(hub, [], 'hub', 0).commands).timeline;
    for (let minute = 0; minute <= hub.minutes; minute += 1) render(playView(2, hub, sent, minute, ROUND_TIME_SCALE, false));
    expect(UNMANNED).toBe('COUNTER UNMANNED');
  });

  test('the clock counts the real seconds left, and stops at zero', () => {
    expect(countdown(today, 3, ROUND_TIME_SCALE)).toBe('0:39');
    expect(countdown(today, today.minutes + 9, ROUND_TIME_SCALE)).toBe('0:00');
    expect(countdown(setupRound('today', 1, DEFAULT_PARAMS, 90), 0, ROUND_TIME_SCALE)).toBe('1:30');
  });
});

describe('round results', () => {
  test('round 2 adds what was sent to the hub; every row draws in the font', () => {
    const {result} = playRound(hub, press(hub, [], 'hub', 0).commands);
    const rows = roundRows(2, result);
    expect(rows.map(r => r.label)).toEqual(['SALES MADE', 'WALKED OUT', 'TIME UNMANNED', 'SENT TO HUB', ...(result.ordersLeft > 0 ? ['ORDERS NOT MIXED'] : []), 'LOST ADVICE', 'LOST SAMPLES', 'LOST SMALL']);
    expect(rows[3]?.values).toEqual([`${OPENING_ORDER_TINS} TINS`]);
    for (const r of rows) for (const t of [r.label, ...r.values]) drawText(() => undefined, t, 0, 0, 0);
    expect(roundAnnouncement(2, result, 'Next.')).toContain(`${OPENING_ORDER_TINS} tins sent to the hub.`);
  });

  test('round 1 has no hub row, and says when an order was never mixed', () => {
    const {result} = playRound(today, []);
    expect(roundRows(1, result).map(r => r.label)).toEqual(['SALES MADE', 'WALKED OUT', 'TIME UNMANNED', 'ORDERS NOT MIXED', 'LOST ADVICE', 'LOST SAMPLES', 'LOST SMALL']);
  });
});
