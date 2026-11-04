import {type InputMode, PLAY_KEYS} from '../flow/input';
import type {PlayAction, PlayOption, Unavailable} from '../sim/round';

export interface PlayButton {
  action: PlayAction;
  /** What the press will do, e.g. MIX 10 TINS. */
  label: string;
  /** Under the label: the key that presses it, or why it cannot be pressed now. */
  note: string;
  enabled: boolean;
}

const tins = (n: number): string => `${n} ${n === 1 ? 'TIN' : 'TINS'}`;

export function playLabel(option: PlayOption): string {
  if (option.action === 'serve') return 'SERVE';
  if (option.action === 'hub') return 'SEND TO HUB';
  return option.tins === null ? 'MIX' : `MIX ${tins(option.tins)}`;
}

export function reasonText(reason: Unavailable, hubThresholdTins: number): string {
  switch (reason) {
    case 'busy-serving':
      return 'SERVING';
    case 'busy-mixing':
      return 'MIXING';
    case 'nobody-waiting':
      return 'NOBODY WAITING';
    case 'no-order':
      return 'NO ORDER';
    case 'small-order':
      return `ONLY OVER ${tins(hubThresholdTins)}`;
    case 'round-over':
      return 'TIME UP';
  }
}

/** The console's buttons for this moment of the round; touch has no keys to name, so an available button's note is empty. */
export function playButtons(options: readonly PlayOption[], mode: InputMode, hubThresholdTins: number): PlayButton[] {
  return options.map(o => ({
    action: o.action,
    label: playLabel(o),
    note: o.reason !== null ? reasonText(o.reason, hubThresholdTins) : mode === 'keyboard' ? `KEY ${PLAY_KEYS[o.action]}` : '',
    enabled: o.reason === null,
  }));
}

/** The sentence a screen reader hears when a button is pressed but cannot act. */
export function refusal(button: PlayButton): string {
  return `${button.label} is not available: ${button.note.toLowerCase()}.`;
}
