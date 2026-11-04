import {drawText, GLYPH_HEIGHT, textWidth, type Plot} from '../render/font';
import {deliveryLabel, SCENARIO_TITLES} from '../render/narration';
import {C, type Shade} from '../render/palette';
import {clockText, type ReplayState, staffOnFloor, type StaffView} from '../render/replay';
import {SCREEN_WIDTH} from '../render/screen-size';
import {drawSprite, type Sprite} from '../render/sprite';
import {BANG, CRATE, customerSprite, PERSON_H, PERSON_W, PLANT, SHAKER, STAFF, TILL, TINTER, VAN} from '../render/sprites';
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
/** The strip of shop wall behind the floor, where the swatches, shelves and plant hang. */
export const BACK_WALL: Rect = {x: 0, y: 20, w: 100, h: 14};
const DOORWAY = {y: 36, h: 18};

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
/** Share of patience used up at which a waiting bar turns amber, then red. */
export const PATIENCE_AMBER = 0.5;
export const PATIENCE_RED = 0.8;
export const UNMANNED = 'COUNTER UNMANNED';

export const COUNTER: Rect = {x: 70, y: 36, w: 12, h: 66};
const QUEUE_Y = 94;
/** Walk-outs leave along a lane above the queue, so they never hide a waiting walk-in. */
const WALK_OUT_Y = 72;
export const BANNER: Rect = {x: 0, y: 38, w: FLOOR.w, h: 13};

export interface Point {
  x: number;
  y: number;
}

const lerp = (a: Point, b: Point, t: number): Point => ({x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t)});

const counterStation = (k: number): Point => ({x: 85, y: 34 + (k % STATIONS) * 14});
const mixStation = (k: number): Point => ({x: 105 + (k % STATIONS) * 13, y: 37});
const servedSpot = (k: number): Point => ({x: 57, y: counterStation(k).y});
export const queueSlot = (i: number): Point => ({x: 54 - i * 13, y: QUEUE_Y});
export const DOOR_SPOT: Point = {x: 1, y: 76};

export function inside(r: Rect, p: Point, w = PERSON_W, h = PERSON_H): boolean {
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
    if (t < 1) return lerp({x: WALL.x - PERSON_W, y: DOORWAY.y}, counterStation(s.staff), Math.max(0, t));
  }
  return counterStation(s.staff);
}

/** The colour a waiting bar shows at this share of patience used. */
export function patienceShade(used: number): Shade {
  return used >= PATIENCE_RED ? C.red : used >= PATIENCE_AMBER ? C.yellow : C.leaf;
}

export interface ShopView {
  scenario: ScenarioName;
  state: ReplayState;
  params: Params;
  text: string;
  /** Characters of `text` typed out so far. */
  chars: number;
  /** Whether sound is on; the status bar shows it. */
  sound: boolean;
  /** What the customer at the till is asking for, shown in a speech bubble. */
  bubble?: string;
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
  plot(STATUS.x, STATUS.y, STATUS.w, STATUS.h, C.plum);
  plot(STATUS.x, STATUS.y + STATUS.h - 1, STATUS.w, 1, C.ink);
  const clock = clockText(state.minute, params.shiftMinutes);
  drawText(plot, SCENARIO_TITLES[view.scenario], 2, 3, C.cream);
  drawText(plot, clock, SCREEN_WIDTH - 2 - textWidth(clock), 3, C.cream);
  drawText(plot, `SERVED ${state.served}`, 2, 11, C.mint);
  const lost = `LOST ${state.lost} GBP${state.lostGbp}`;
  drawText(plot, lost, SCREEN_WIDTH - 2 - textWidth(lost), 11, C.pink);
  drawSpeaker(plot, view.sound);
}

/** A speaker in the gap between the scenario name and the clock: waves when sound is on, a cross when it is off. */
export const SPEAKER: Rect = {x: 108, y: 3, w: 12, h: 7};

function drawSpeaker(plot: Plot, on: boolean): void {
  const {x, y} = SPEAKER;
  plot(x, y + 2, 2, 3, C.cream);
  plot(x + 2, y + 1, 1, 5, C.cream);
  plot(x + 3, y, 1, 7, C.cream);
  if (on) {
    plot(x + 6, y + 2, 1, 3, C.mint);
    plot(x + 8, y + 1, 1, 5, C.mint);
    plot(x + 10, y, 1, 7, C.mint);
  } else {
    for (let i = 0; i < 5; i++) {
      plot(x + 6 + i, y + 1 + i, 1, 1, C.slate);
      plot(x + 10 - i, y + 1 + i, 1, 1, C.slate);
    }
  }
}

function checker(plot: Plot, r: Rect, size: number, a: Shade, b: Shade): void {
  plot(r.x, r.y, r.w, r.h, a);
  for (let y = r.y; y < r.y + r.h; y += size) {
    for (let x = r.x + (((y - r.y) / size) % 2) * size; x < r.x + r.w; x += size * 2) plot(x, y, Math.min(size, r.x + r.w - x), Math.min(size, r.y + r.h - y), b);
  }
}

const SWATCHES: readonly Shade[] = [C.red, C.orange, C.yellow, C.leaf, C.teal, C.blue, C.sky, C.pink, C.plum, C.forest, C.tan, C.brown];
const TIN_LIDS: readonly Shade[] = [C.blue, C.red, C.yellow, C.leaf, C.pink, C.teal, C.orange, C.sky];

function drawBackWall(plot: Plot): void {
  const {x, y, w, h} = BACK_WALL;
  plot(x, y, w, h, C.mint);
  for (let sx = x + 2; sx < x + w; sx += 6) plot(sx, y, 1, h - 2, C.cream);
  plot(x, y + h - 2, w, 2, C.brown);

  box(plot, {x: 3, y: 21, w: 30, h: 11}, C.cream, C.ink);
  SWATCHES.forEach((shade, i) => plot(5 + (i % 6) * 4 + Math.floor(i % 6 / 3) * 2, 23 + Math.floor(i / 6) * 4, 3, 3, shade));

  for (const shelfY of [25, 31]) {
    for (let i = 0; i < 4; i++) {
      const tx = 37 + i * 7;
      plot(tx, shelfY - 5, 5, 5, C.ink);
      plot(tx + 1, shelfY - 4, 3, 3, C.slate);
      plot(tx + 1, shelfY - 4, 3, 1, TIN_LIDS[(i + shelfY) % TIN_LIDS.length] ?? C.blue);
    }
    plot(35, shelfY, 30, 2, C.brown);
  }
  drawSprite(plot, PLANT, 88, 20);
}

function drawFloor(plot: Plot): void {
  checker(plot, {x: FLOOR.x, y: BACK_WALL.y + BACK_WALL.h, w: FLOOR.w, h: FLOOR.h - BACK_WALL.h}, 8, C.cream, C.mist);
  drawBackWall(plot);
  plot(0, 92, 13, 18, C.red);
  plot(1, 93, 11, 16, C.orange);
  for (let y = 95; y < 108; y += 3) plot(2, y, 9, 1, C.red);
  plot(0, 72, 2, 38, C.brown);

  plot(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h, C.ink);
  plot(COUNTER.x + 1, COUNTER.y + 1, COUNTER.w - 2, COUNTER.h - 2, C.brown);
  plot(COUNTER.x + 3, COUNTER.y + 1, COUNTER.w - 4, COUNTER.h - 3, C.tan);
  drawSprite(plot, TILL, COUNTER.x, COUNTER.y - 2);
  drawSprite(plot, PLANT, 2, 56);
}

function drawBackRooms(plot: Plot): void {
  plot(WALL.x, WALL.y, WALL.w, WALL.h, C.ink);
  plot(WALL.x, DOORWAY.y, WALL.w, DOORWAY.h, C.mist);
  checker(plot, MIX_ROOM, 4, C.mist, C.slate);
  plot(MIX_ROOM.x, MIX_ROOM.y, MIX_ROOM.w, 14, C.sky);
  plot(MIX_ROOM.x, MIX_ROOM.y + 14, MIX_ROOM.w, 1, C.ink);
  drawSprite(plot, TINTER, MIX_ROOM.x + 3, MIX_ROOM.y + 1);
  drawSprite(plot, SHAKER, MIX_ROOM.x + 37, MIX_ROOM.y + 1);
  plot(BAY.x, MIX_ROOM.y + MIX_ROOM.h, BAY.w, BAY.y - MIX_ROOM.y - MIX_ROOM.h, C.ink);
  plot(BAY.x, BAY.y, BAY.w, BAY.h, C.slate);
}

function drawBay(plot: Plot, view: ShopView): void {
  if (view.scenario === 'today') {
    for (const [x, y] of [[108, 80], [117, 80], [108, 89], [146, 100], [137, 100]] as const) drawSprite(plot, CRATE, x, y);
    return;
  }
  for (let y = BAY.y; y < BAY.y + BAY.h; y += 4) plot(BAY.x + BAY.w - 3, y, 3, 2, C.yellow);
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
  box(plot, {x: x - 2, y: BAY.y + 2, w: textWidth(label) + 4, h: 11}, C.cream, C.ink);
  drawText(plot, label, x, BAY.y + 4, C.ink);
}

/** A soft oval under a person's feet, so they stand on the floor rather than float over it. */
function shadow(plot: Plot, p: Point): void {
  plot(p.x + 2, p.y + PERSON_H - 2, PERSON_W - 4, 3, C.slate);
  plot(p.x + 1, p.y + PERSON_H - 1, PERSON_W - 2, 1, C.slate);
}

function person(plot: Plot, sprite: Sprite, p: Point): void {
  shadow(plot, p);
  drawSprite(plot, sprite, p.x, p.y);
}

function drawStaff(plot: Plot, view: ShopView): void {
  const {state} = view;
  const mixing: {k: number; tin: number; tins: number}[] = [];
  for (const s of state.staff.slice(0, STATIONS)) {
    const p = staffPosition(s, state.minute);
    person(plot, STAFF, p);
    if (s.activity !== 'mixing' || !s.mix) continue;
    const at = mixStation(s.staff);
    plot(at.x, at.y + PERSON_H, PERSON_W, 3, C.ink);
    plot(at.x + 1, at.y + PERSON_H + 1, PERSON_W - 2, 1, C.plum);
    plot(at.x + 1, at.y + PERSON_H + 1, Math.round((PERSON_W - 2) * s.mix.progress), 1, C.leaf);
    mixing.push({k: s.staff, tin: s.mix.tin, tins: s.mix.tins});
  }
  const room = clip(plot, MIX_ROOM);
  const rowY = (i: number): number => MIX_ROOM.y + MIX_ROOM.h - 2 * (GLYPH_HEIGHT + 1) + 1 + i * (GLYPH_HEIGHT + 1);
  const label = (text: string, x: number, y: number): void => {
    room(x - 1, y - 1, textWidth(text) + 2, GLYPH_HEIGHT + 1, C.cream);
    drawText(room, text, x, y, C.ink);
  };
  if (mixing.length <= 2) mixing.forEach((m, i) => label(`TIN ${m.tin}/${m.tins}`, MIX_ROOM.x + 2, rowY(i)));
  else mixing.forEach((m, i) => label(`${m.tin}/${m.tins}`, MIX_ROOM.x + 2 + (i % 2) * 28, rowY(Math.floor(i / 2))));
}

function patienceBar(plot: Plot, p: Point, waited: number, patience: number): void {
  const used = Math.min(1, patience > 0 ? waited / patience : 1);
  plot(p.x, p.y - 4, PERSON_W, 3, C.ink);
  plot(p.x + 1, p.y - 3, PERSON_W - 2, 1, C.plum);
  plot(p.x + 1, p.y - 3, Math.max(1, Math.round((PERSON_W - 2) * (1 - used))), 1, patienceShade(used));
}

function drawCustomers(plot: Plot, view: ShopView): void {
  const {state, params} = view;
  for (const s of state.serving) if (s.staff < STATIONS) person(plot, customerSprite(s.walkIn), servedSpot(s.staff));

  const overflow = state.waiting.length - QUEUE_SLOTS;
  if (overflow > 0) {
    person(plot, customerSprite(state.waiting[QUEUE_SLOTS]?.walkIn ?? 0), DOOR_SPOT);
    drawText(plot, `+${overflow}`, DOOR_SPOT.x + PERSON_W + 1, DOOR_SPOT.y + 1, C.ink);
  }
  state.waiting
    .slice(0, QUEUE_SLOTS)
    .map((w, i) => ({w, p: queueSlot(i)}))
    .reverse()
    .forEach(({w, p}) => {
      person(plot, customerSprite(w.walkIn), p);
      patienceBar(plot, p, state.minute - w.since, params.patienceMinutes);
    });

  const floor = clip(plot, FLOOR);
  for (const loss of state.losses) {
    const t = (state.minute - loss.at) / LOSS_MINUTES;
    if (t < 0 || t >= 1) continue;
    const p = lerp({x: queueSlot(0).x, y: WALK_OUT_Y}, {x: -PERSON_W, y: WALK_OUT_Y}, t);
    person(floor, customerSprite(loss.walkIn), p);
    drawSprite(floor, BANG, p.x + 3, p.y - 10);
    const pop = `-GBP${loss.saleGbp}`;
    drawText(floor, pop, Math.max(2, p.x - 4), WALK_OUT_Y - 18 - Math.round(t * 3), C.red);
  }
}

function drawBanner(plot: Plot): void {
  box(plot, BANNER, C.red, C.ink);
  plot(BANNER.x + 1, BANNER.y + 1, BANNER.w - 2, 1, C.orange);
  drawText(plot, UNMANNED, BANNER.x + Math.floor((BANNER.w - textWidth(UNMANNED)) / 2), BANNER.y + 3, C.cream);
}

/** A speech bubble beside the customer at the first till, its tail pointing at their face; it keeps clear of the back wall. */
function drawBubble(plot: Plot, text: string): void {
  const at = servedSpot(0);
  const w = textWidth(text) + 6;
  const x = Math.max(FLOOR.x + 1, at.x - w - 2);
  const y = at.y + 1;
  box(plot, {x, y, w, h: 11}, C.cream, C.ink);
  plot(x + w - 1, y + 4, 1, 3, C.cream);
  plot(x + w, y + 4, 1, 1, C.ink);
  plot(x + w, y + 5, 1, 1, C.cream);
  plot(x + w + 1, y + 5, 1, 1, C.ink);
  plot(x + w, y + 6, 1, 1, C.ink);
  drawText(plot, text, x + 3, y + 2, C.ink);
}

export function drawShop(plot: Plot, view: ShopView): void {
  drawStatus(plot, view);
  drawFloor(plot);
  drawBackRooms(plot);
  drawBay(plot, view);
  drawCustomers(plot, view);
  drawStaff(plot, view);
  if (staffOnFloor(view.state) === 0) drawBanner(plot);
  if (view.bubble) drawBubble(plot, view.bubble);
  drawTextbox(plot, view.text, view.chars);
}
