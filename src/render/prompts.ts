import type {InputMode} from '../flow/input';

export interface Prompts {
  title: string;
  results: string;
  comparison: string;
  /** Under the title prompt; empty when a button on screen already says it. */
  settingsHint: string;
  /** How a sentence tells the listener to advance, for the canvas labels. */
  verb: string;
  /** The text box while the shift waits for the presenter's pick. */
  decision: string;
  /** Said once when take-control is switched on or off. */
  controlOn: string;
  controlOff: string;
  /** Under a round's result: what SPACE or a tap goes to next. */
  round1Result: string;
  round2Result: string;
  /** What the canvas label tells a screen reader about the play buttons. */
  playHint: string;
}

const PROMPTS: Readonly<Record<InputMode, Prompts>> = {
  keyboard: {
    title: 'PRESS SPACE',
    results: 'SPACE: SAME DAY WITH A CENTRAL HUB.',
    comparison: 'SPACE: REPLAY THIS DAY. R: RESHUFFLE THE DAY.',
    settingsHint: 'S: SETTINGS  M: SOUND',
    verb: 'Press space',
    decision: 'W: SERVE THE WALK-IN. O: MIX THE ORDER.',
    controlOn: 'YOU DECIDE WHO IS NEXT. C: BACK TO AUTOPLAY.',
    controlOff: 'AUTOPLAY. C: TAKE CONTROL.',
    round1Result: 'SPACE: PLAY AGAIN, NOW WITH THE HUB.',
    round2Result: 'SPACE: NOW A WHOLE REAL DAY.',
    playHint: 'Press 1 to serve, 2 to mix the order, 3 to send it to the hub, or use the buttons.',
  },
  touch: {
    title: 'TAP TO START',
    results: 'TAP: SAME DAY WITH A CENTRAL HUB.',
    comparison: 'TAP: REPLAY THIS DAY. OR USE RESHUFFLE.',
    settingsHint: '',
    verb: 'Tap',
    decision: 'SERVE THE WALK-IN OR MIX THE ORDER?',
    controlOn: 'YOU DECIDE WHO IS NEXT. TAP AUTOPLAY TO STOP.',
    controlOff: 'AUTOPLAY. TAP TAKE CONTROL TO DECIDE.',
    round1Result: 'TAP: PLAY AGAIN, NOW WITH THE HUB.',
    round2Result: 'TAP: NOW A WHOLE REAL DAY.',
    playHint: 'Use the serve, mix and send to hub buttons.',
  },
};

export function promptsFor(mode: InputMode): Prompts {
  return PROMPTS[mode];
}

/** A device with no hover and a coarse pointer is driven by touch; anything else keeps the keyboard wording. */
export function inputMode(matches: (query: string) => boolean): InputMode {
  return matches('(hover: none)') && matches('(pointer: coarse)') ? 'touch' : 'keyboard';
}
