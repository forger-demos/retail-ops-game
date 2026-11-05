import type {SfxName} from '../audio/sfx';
import type {TimelineEventType} from '../sim/timeline';

/** Everything that answers the player: each timeline event, plus the presses and states that are not events. */
export type JuiceKey = TimelineEventType | 'press-accepted' | 'press-refused' | 'sfx-toggle' | 'dialogue-waiting' | 'patience-low';

export interface Juice {
  /** The change on screen; it is information, so it stays when motion is reduced. */
  visual: string;
  /** The movement that goes with it, switched off when motion is reduced; null when there is none. */
  motion: string | null;
  /** The synthesised effect, heard only when sound is on; null when the answer is silent. */
  sound: SfxName | null;
}

/** One entry per action and event; the type makes a missing timeline event a compile error. */
export const JUICE: Readonly<Record<JuiceKey, Juice>> = {
  'walk-in-arrive': {visual: 'a customer joins the queue with a patience bar', motion: null, sound: 'walk-in'},
  'walk-in-served': {visual: 'a +GBP floater over the till', motion: 'the floater rises', sound: 'sale'},
  'walk-in-lost': {visual: 'a red flash, a bang and a -GBP floater', motion: 'the flash pulses and the floater rises', sound: 'walkout'},
  'order-arrive': {visual: 'a customer with a tin count at the till', motion: null, sound: null},
  'mix-start': {visual: 'the shaker runs and a tin counter fills', motion: 'the shaker jitters', sound: 'hum'},
  'hub-dispatch': {visual: 'the van drives out with its delivery label', motion: 'the van slides along the bay', sound: 'van'},
  'staff-free': {visual: 'the assistant is back on the floor', motion: 'the assistant walks back', sound: null},
  'press-accepted': {visual: 'the button turns yellow', motion: 'the button sinks', sound: 'press'},
  'press-refused': {visual: 'the button turns yellow and says why', motion: 'the button sinks', sound: 'refuse'},
  'sfx-toggle': {visual: 'the SFX button and the speaker icon change', motion: null, sound: 'press'},
  'dialogue-waiting': {visual: 'an arrow beside the finished line', motion: 'the arrow bounces', sound: null},
  'patience-low': {visual: 'the patience bar turns red', motion: 'the bar shakes', sound: null},
};

/** Shop minutes a +GBP floater stays on screen. */
export const SALE_MINUTES = 3;
/** Shop minutes a walk-out flashes the floor red. */
export const FLASH_MINUTES = 1.5;

/** One pixel left or right, flipping every `period` units of `t`; nothing when motion is reduced. */
export function wobble(t: number, period: number, calm: boolean): number {
  if (calm) return 0;
  return Math.floor(t / period) % 2 === 0 ? 1 : -1;
}

/** How far the dialogue arrow sits above its rest, in pixels, bouncing with real time. */
export function arrowLift(ms: number, calm: boolean): number {
  if (calm) return 0;
  return Math.floor(ms / 300) % 2;
}

/** Whether the floor is flashing red `since` shop minutes after a walk-out. */
export function flashOn(since: number, calm: boolean): boolean {
  if (calm || since < 0 || since >= FLASH_MINUTES) return false;
  return Math.floor(since * 4) % 2 === 0;
}
