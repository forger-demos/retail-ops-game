import {describe, expect, test} from 'bun:test';

import {STYLE_MOMENTS} from '../flow/flow';
import type {Plot} from '../render/font';
import {C, isShade} from '../render/palette';
import {staffOnFloor} from '../render/replay';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {customerSprite, TRADE} from '../render/sprites';
import {wrap, TEXTBOX_LINES} from '../render/textbox';
import {DEFAULT_PARAMS} from '../sim/params';
import {BANNER, drawShop, LOSS_MINUTES, patienceShade, type Rect} from './shop';
import {BUBBLE, ORDER_TINS, styleFrame, TRADE_WALK_IN} from './style-frame';

const UNDRAWN = 255;

function render(moment: (typeof STYLE_MOMENTS)[number]): Uint8Array {
  const buf = new Uint8Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(UNDRAWN);
  const plot: Plot = (x, y, w, h, shade) => {
    if (x < 0 || y < 0 || x + w > SCREEN_WIDTH || y + h > SCREEN_HEIGHT || !isShade(shade)) throw new Error(`bad plot ${[x, y, w, h, shade].join(',')}`);
    for (let yy = y; yy < y + h; yy++) buf.fill(shade, yy * SCREEN_WIDTH + x, yy * SCREEN_WIDTH + x + w);
  };
  drawShop(plot, {...styleFrame(moment, DEFAULT_PARAMS), sound: false});
  return buf;
}

const count = (buf: Uint8Array, r: Rect, shade: number): number => {
  let n = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (buf[y * SCREEN_WIDTH + x] === shade) n++;
  return n;
};

describe('style frame', () => {
  test('each still fills the screen in palette colours, and its text fits the box', () => {
    for (const m of STYLE_MOMENTS) {
      expect(render(m).includes(UNDRAWN)).toBe(false);
      expect(wrap(styleFrame(m, DEFAULT_PARAMS).text).length).toBeLessThanOrEqual(TEXTBOX_LINES);
    }
  });

  test('the dilemma: a ten-tin trade order at the till, a queue of three, the front one about to walk out', () => {
    const view = styleFrame('dilemma', DEFAULT_PARAMS);
    expect(view.bubble).toBe(BUBBLE);
    expect(BUBBLE).toBe(`${ORDER_TINS} TINS`);
    expect(view.state.serving).toEqual([{walkIn: TRADE_WALK_IN, staff: 0}]);
    expect(customerSprite(TRADE_WALK_IN)).toBe(TRADE);
    expect(view.state.waiting).toHaveLength(3);
    const used = view.state.waiting.map(w => (view.state.minute - w.since) / DEFAULT_PARAMS.patienceMinutes);
    expect(used.map(patienceShade)).toEqual([C.red, C.yellow, C.leaf]);
    expect(staffOnFloor(view.state)).toBe(1);
    expect(count(render('dilemma'), BANNER, C.red)).toBe(0);
  });

  test('unmanned: the order is being mixed, the counter banner is up and a walk-in is leaving', () => {
    const view = styleFrame('unmanned', DEFAULT_PARAMS);
    expect(staffOnFloor(view.state)).toBe(0);
    expect(view.state.staff[0]?.mix).toMatchObject({tin: 3, tins: ORDER_TINS});
    expect(view.state.waiting).toHaveLength(3);
    const leaving = view.state.losses.filter(l => view.state.minute >= l.at && view.state.minute < l.at + LOSS_MINUTES);
    expect(leaving).toHaveLength(1);
    expect(count(render('unmanned'), BANNER, C.red)).toBeGreaterThan(BANNER.w * 5);
  });

  test('both stills draw the shop in real colour, not a handful of shades', () => {
    for (const m of STYLE_MOMENTS) expect(new Set(render(m)).size).toBeGreaterThanOrEqual(12);
  });
});
