import type {InputMode} from '../flow/input';

export interface Prompts {
  title: string;
  results: string;
  comparison: string;
  /** How a sentence tells the listener to advance, for the canvas labels. */
  verb: string;
}

const PROMPTS: Readonly<Record<InputMode, Prompts>> = {
  keyboard: {
    title: 'PRESS SPACE',
    results: 'SPACE: SAME DAY WITH A CENTRAL HUB.',
    comparison: 'SPACE: REPLAY THIS DAY. R: RESHUFFLE THE DAY.',
    verb: 'Press space',
  },
  touch: {
    title: 'TAP TO START',
    results: 'TAP: SAME DAY WITH A CENTRAL HUB.',
    comparison: 'TAP: REPLAY THIS DAY. OR USE RESHUFFLE.',
    verb: 'Tap',
  },
};

export function promptsFor(mode: InputMode): Prompts {
  return PROMPTS[mode];
}

/** A device with no hover and a coarse pointer is driven by touch; anything else keeps the keyboard wording. */
export function inputMode(matches: (query: string) => boolean): InputMode {
  return matches('(hover: none)') && matches('(pointer: coarse)') ? 'touch' : 'keyboard';
}
