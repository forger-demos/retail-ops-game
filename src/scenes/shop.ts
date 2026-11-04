import {drawText, textWidth, type Plot} from '../render/font';
import {deliveryLabel, SCENARIO_TITLES} from '../render/narration';
import type {Shade} from '../render/palette';
import {clockText, type ReplayState, type StaffView} from '../render/replay';
import {SCREEN_WIDTH} from '../render/screen-size';
import {drawSprite} from '../render/sprite';
import {BANG, CRATE, CUSTOMER, STAFF, VAN} from '../render/sprites';
import {drawTextbox} from '../render/textbox';
import type {Params, ScenarioName} from '../sim/params';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const STATUS: Rect = {x: 0, y: 0, w: SCREEN_WIDTH, h: 20};
export const FLOOR: Rect = {x: 0, y: 20, w: 100, h: 92};
export const WALL: Rect = {x: 100, y: 20, w: 4, h: 92};
export const MIX_ROOM: Rect = {x: 104, y: 20, w: 56, h: 52};
export const BAY: Rect = {x: 104, y: 76, w: 56, h: 36};
const DOORWAY = {y: 40, h: 12};

/** Stations the scene has room to draw; the plan caps staff at four. */
export const STATIONS = 4;
/** Visible queue slots at the counter; anyone further back waits by the door. */
export const QUEUE_SLOTS = 4;
/** Shop minutes a walk between the floor and the mixing room takes on screen. */
export const WALK_MINUTES = 2;
/** Shop minutes a walk-out and its lost-sale pop stay on screen. */
export const LOSS_MINUTES = 5;
/** Shop minutes the van takes to drive out of the bay. */
export const VAN_MINUTES = 8;

const COUNTER: Rect = {x: 66, y: 28, w: 6, h: 64};
const QUEUE_Y = 100;
/** Walk-outs leave along a lane above the queue, so they never hide a waiting walk-in. */
const WALK_OUT_Y = 86;
const SPRITE = 8;

export interface Point {
  x: number;
  y: number;
}

const lerp = (a: Point, b: Point, t: number): Point => ({x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t)});

const counterStation = (k: number): Point => ({x: 80, y: 30 + (k % STATIONS) * 16});
const mixStation = (k: number): Point => ({x: 106, y: 23 + (k % STATIONS) * 12});
const servedSpot = (k: number): Point => ({x: 56, y: counterStation(k).y});
export const queueSlot = (i: number): Point => ({x: 56 - i * 11, y: QUEUE_Y});
export const DOOR_SPOT: Point = {x: 4, y: 84};

export function inside(r: Rect, p: Point, w = SPRITE, h = SPRITE): boolean {
  return p.x >= r.x && p.y >= r.y && p.x + w <= r.x + r.w && p.y + h <= r.y + r.h;
}

/** Where a staff member stands at `minute`; a mixing staff member is always beyond the wall. */
export function staffPosition(s: StaffView, minute: number): Point {
  if (s.activity === 'mixing') {
    const t = (minute - s.since) / WALK_MINUTES;
    return t < 1 ? lerp({x: WALL.x, y: DOORWAY.y}, mixStation(s.staff), Math.max(0, t)) : mixStation(s.staff);
  }
  if (s.backFromMixAt !== null) {
    const t = (minute - s.backFromMixAt) / WALK_MINUTES;
    if (t < 1) return lerp({x: WALL.x - SPRITE, y: DOORWAY.y}, counterStation(s.staff), Math.max(0, t));
  }
  return counterStation(s.staff);
}

export interface ShopView {
  scenario: ScenarioName;
  state: ReplayState;
  params: Params;
  text: string;
  /** Characters of `text` typed out so far. */
  chars: number;
}

function clip(plot: Plot, r: Rect): Plot {
  return (x, y, w, h, shade) => {
    const x0 = Math.max(x, r.x);
    const y0 = Math.max(y, r.y);
    const x1 = Math.min(x + w, r.x + r.w);
    const y1 = Math.min(y + h, r.y + r.h);
    if (x1 > x0 && y1 > y0) plot(x0, y0, x1 - x0, y1 - y0, shade);
  };
}

function box(plot: Plot, r: Rect, fill: Shade, edge: Shade): void {
  plot(r.x, r.y, r.w, r.h, edge);
  plot(r.x + 1, r.y + 1, r.w - 2, r.h - 2, fill);
}

function drawStatus(plot: Plot, view: ShopView): void {
  const {state, params} = view;
  plot(STATUS.x, STATUS.y, STATUS.w, STATUS.h, 0);
  const clock = clockText(state.minute, params.shiftMinutes);
  drawText(plot, SCENARIO_TITLES[view.scenario], 2, 3, 3);
  drawText(plot, clock, SCREEN_WIDTH - 2 - textWidth(clock), 3, 3);
  drawText(plot, `SERVED ${state.served}`, 2, 11, 3);
  const lost = `LOST ${state.lost} GBP${state.lostGbp}`;
  drawText(plot, lost, SCREEN_WIDTH - 2 - textWidth(lost), 11, 2);
}

function drawFloor(plot: Plot): void {
  plot(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h, 3);
  for (let y = FLOOR.y + 4; y < FLOOR.y + FLOOR.h; y += 8) for (let x = 4; x < FLOOR.w; x += 8) plot(x, y, 1, 1, 2);
  for (const x of [8, 32]) {
    box(plot, {x, y: 26, w: 16, h: 36}, 1, 0);
    for (let y = 32; y < 62; y += 6) plot(x + 1, y, 14, 1, 2);
  }
  box(plot, COUNTER, 1, 0);
  plot(0, 92, 2, 18, 0);
  plot(2, 94, 2, 14, 1);
}

function drawWalls(plot: Plot): void {
  plot(WALL.x, WALL.y, WALL.w, WALL.h, 0);
  plot(WALL.x, DOORWAY.y, WALL.w, DOORWAY.h, 2);
  plot(MIX_ROOM.x, MIX_ROOM.y, MIX_ROOM.w, MIX_ROOM.h, 2);
  plot(BAY.x, MIX_ROOM.y + MIX_ROOM.h, BAY.w, BAY.y - MIX_ROOM.y - MIX_ROOM.h, 0);
  plot(BAY.x, BAY.y, BAY.w, BAY.h, 2);
}

function drawBay(plot: Plot, view: ShopView): void {
  if (view.scenario === 'today') {
    for (const [x, y] of [[108, 80], [117, 80], [108, 89], [146, 100], [137, 100]] as const) drawSprite(plot, CRATE, x, y);
    return;
  }
  for (let y = BAY.y; y < BAY.y + BAY.h; y += 4) plot(BAY.x + BAY.w - 3, y, 3, 2, 1);
  const {minute} = view.state;
  const leaving = view.state.dispatches.filter(d => minute >= d.at && minute < d.at + VAN_MINUTES).at(-1);
  const parked = {x: 120, y: 98};
  const bay = clip(plot, BAY);
  if (!leaving) {
    drawSprite(bay, VAN, parked.x, parked.y);
    return;
  }
  const t = (minute - leaving.at) / VAN_MINUTES;
  drawSprite(bay, VAN, Math.round(parked.x + t * (BAY.w - 4)), parked.y);
  const label = deliveryLabel(view.params.hubDeliveryMinutes);
  const x = SCREEN_WIDTH - 2 - textWidth(label);
  plot(x - 2, BAY.y + 2, textWidth(label) + 4, 11, 3);
  drawText(plot, label, x, BAY.y + 4, 0);
}

function drawStaff(plot: Plot, view: ShopView): void {
  const {state} = view;
  for (const s of state.staff.slice(0, STATIONS)) {
    const p = staffPosition(s, state.minute);
    drawSprite(plot, STAFF, p.x, p.y);
    if (s.activity !== 'mixing' || !s.mix) continue;
    const row = mixStation(s.staff);
    const full = `TIN ${s.mix.tin}/${s.mix.tins}`;
    const label = textWidth(full) <= MIX_ROOM.x + MIX_ROOM.w - row.x - 11 ? full : `${s.mix.tin}/${s.mix.tins}`;
    drawText(plot, label, row.x + 10, row.y, 0);
    const bar = MIX_ROOM.x + MIX_ROOM.w - 2 - (row.x + 10);
    plot(row.x + 10, row.y + 8, bar, 2, 1);
    plot(row.x + 10, row.y + 8, Math.round(bar * s.mix.progress), 2, 0);
  }
}

function waitMeter(plot: Plot, p: Point, waited: number, patience: number): void {
  plot(p.x, p.y - 3, SPRITE, 2, 1);
  plot(p.x, p.y - 3, Math.round(SPRITE * Math.min(1, patience > 0 ? waited / patience : 1)), 2, 0);
}

function drawCustomers(plot: Plot, view: ShopView): void {
  const {state, params} = view;
  for (const s of state.serving) if (s.staff < STATIONS) drawSprite(plot, CUSTOMER, servedSpot(s.staff).x, servedSpot(s.staff).y);

  state.waiting.slice(0, QUEUE_SLOTS).forEach((w, i) => {
    const p = queueSlot(i);
    drawSprite(plot, CUSTOMER, p.x, p.y);
    waitMeter(plot, p, state.minute - w.since, params.patienceMinutes);
  });
  const overflow = state.waiting.length - QUEUE_SLOTS;
  if (overflow > 0) {
    drawSprite(plot, CUSTOMER, DOOR_SPOT.x, DOOR_SPOT.y);
    drawText(plot, `+${overflow}`, DOOR_SPOT.x + 10, DOOR_SPOT.y + 1, 0);
  }

  const floor = clip(plot, FLOOR);
  for (const loss of state.losses) {
    const t = (state.minute - loss.at) / LOSS_MINUTES;
    if (t < 0 || t >= 1) continue;
    const p = lerp({x: queueSlot(0).x, y: WALK_OUT_Y}, {x: -SPRITE, y: WALK_OUT_Y}, t);
    drawSprite(floor, CUSTOMER, p.x, p.y);
    drawSprite(floor, BANG, p.x + 1, p.y - 9);
    drawText(floor, `-GBP${loss.saleGbp}`, 4, 66 - Math.round(t * 8), 0);
  }
}

export function drawShop(plot: Plot, view: ShopView): void {
  drawStatus(plot, view);
  drawFloor(plot);
  drawWalls(plot);
  drawBay(plot, view);
  drawCustomers(plot, view);
  drawStaff(plot, view);
  drawTextbox(plot, view.text, view.chars);
}
