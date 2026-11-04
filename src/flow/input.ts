import type {PlayAction} from '../sim/round';

/** What a key, tap or button asks the pitch to do; every input goes through this so touch and keyboard cannot drift apart. */
export type Action = 'advance' | 'reshuffle' | 'settings' | 'up' | 'down' | 'decrease' | 'increase' | 'reset' | 'back' | 'control' | 'walk-in' | 'order' | 'sound' | 'mode' | PlayAction;

/** Actions that make sense held down: a held arrow keeps moving or changing the value. */
export const REPEATABLE: readonly Action[] = ['up', 'down', 'decrease', 'increase'];

const KEYS: Readonly<Record<string, Action>> = {
  Space: 'advance',
  KeyR: 'reshuffle',
  KeyS: 'settings',
  KeyC: 'control',
  KeyW: 'walk-in',
  KeyO: 'order',
  KeyM: 'sound',
  Digit1: 'serve',
  Digit2: 'mix',
  Digit3: 'hub',
  Numpad1: 'serve',
  Numpad2: 'mix',
  Numpad3: 'hub',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'decrease',
  ArrowRight: 'increase',
  Escape: 'back',
  Enter: 'back',
};

/** The key that presses each play button, as its label names it. */
export const PLAY_KEYS: Readonly<Record<PlayAction, string>> = {serve: '1', mix: '2', hub: '3'};

export type InputMode = 'keyboard' | 'touch';

export function keyAction(code: string): Action | null {
  return KEYS[code] ?? null;
}

/**
 * Taps closer together than this count once. A double tap lands well inside it, so a presenter's
 * accidental second tap never skips a whole screen; deliberate taps through narration are slower.
 */
export const TAP_GAP_MS = 350;

export function tapAccepted(lastAcceptedAt: number | null, now: number): boolean {
  return lastAcceptedAt === null || now - lastAcceptedAt >= TAP_GAP_MS;
}
