/** What a key, tap or button asks the pitch to do; every input goes through this so touch and keyboard cannot drift apart. */
export type Action = 'advance' | 'reshuffle' | 'settings' | 'up' | 'down' | 'decrease' | 'increase' | 'reset' | 'back';

/** Actions that make sense held down: a held arrow keeps moving or changing the value. */
export const REPEATABLE: readonly Action[] = ['up', 'down', 'decrease', 'increase'];

const KEYS: Readonly<Record<string, Action>> = {
  Space: 'advance',
  KeyR: 'reshuffle',
  KeyS: 'settings',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'decrease',
  ArrowRight: 'increase',
  Escape: 'back',
  Enter: 'back',
};

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
