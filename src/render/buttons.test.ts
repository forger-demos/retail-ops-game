import {describe, expect, test} from 'bun:test';
import {DEFAULT_PARAMS} from '../sim/params';
import {optionsAt, press, setupRound} from '../sim/round';
import {playButtons, refusal} from './buttons';

const hub = setupRound('hub', 1, DEFAULT_PARAMS, 40);
const today = setupRound('today', 1, DEFAULT_PARAMS, 40);
const threshold = DEFAULT_PARAMS.hubThresholdTins;

describe('play buttons', () => {
  test('say what they will do, and name their key on a keyboard', () => {
    expect(playButtons(optionsAt(hub, [], 0), 'keyboard', threshold)).toEqual([
      {action: 'serve', label: 'SERVE', note: 'NOBODY WAITING', enabled: false},
      {action: 'mix', label: 'MIX 10 TINS', note: 'KEY 2', enabled: true},
      {action: 'hub', label: 'SEND TO HUB', note: 'KEY 3', enabled: true},
    ]);
  });

  test('on touch an available button has no note, and round 1 has no hub button', () => {
    expect(playButtons(optionsAt(today, [], 0), 'touch', threshold).map(b => [b.label, b.note])).toEqual([
      ['SERVE', 'NOBODY WAITING'],
      ['MIX 10 TINS', ''],
    ]);
  });

  test('while mixing every button is disabled with the reason', () => {
    const {commands} = press(today, [], 'mix', 0);
    const buttons = playButtons(optionsAt(today, commands, 5), 'keyboard', threshold);
    expect(buttons.map(b => [b.enabled, b.note])).toEqual([
      [false, 'MIXING'],
      [false, 'MIXING'],
    ]);
    expect(refusal(buttons[0] ?? {action: 'serve', label: '', note: '', enabled: false})).toBe('SERVE is not available: mixing.');
  });

  test('the hub button explains a small order, and MIX names its tins', () => {
    const small = setupRound('hub', 1, {...DEFAULT_PARAMS, hubThresholdTins: 10}, 40);
    const [, mix, send] = playButtons(optionsAt(small, [], 0), 'keyboard', 10);
    expect(mix?.label).toBe('MIX 10 TINS');
    expect(send).toMatchObject({enabled: false, note: 'ONLY OVER 10 TINS'});
  });

  test('every reason fits on a finger-sized button', () => {
    for (const minute of [0, 1, 5, 200]) for (const b of playButtons(optionsAt(hub, [], minute), 'keyboard', threshold)) expect(b.note.length).toBeLessThanOrEqual(16);
  });
});
