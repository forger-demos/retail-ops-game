import {describe, expect, test} from 'bun:test';

import {DEFAULT_SEED} from '../sim/cli';
import {advance, closeSettings, controlAllowed, fromQuery, modeOf, openSettings, PLAY_STEPS, replayOf, reshuffle, roundOf, roundResultOf, roundScenario, startFlow, STEPS, toggleMode, type FlowState} from './flow';

const query = (q: string) => {
  const p = new URLSearchParams(q);
  return (k: string) => p.get(k);
};

describe('the pitch flow', () => {
  test('play mode is the default: rounds, their comparison, then the whole real day and the estate comparison, on one seed', () => {
    let s: FlowState = startFlow(7);
    const seen = [s.step];
    for (let i = 0; i < PLAY_STEPS.length + STEPS.length; i++) {
      s = advance(s);
      seen.push(s.step);
    }
    expect(seen).toEqual(['title', 'round-1', 'round-1-result', 'round-2', 'round-comparison', 'whole-day', 'today', 'today-results', 'hub', 'comparison', 'today']);
    expect(s).toEqual({step: 'today', seed: 7});
  });

  test('round 1 mixes in store and round 2 has the hub; only the rounds are played', () => {
    expect(PLAY_STEPS.map(roundOf)).toEqual([1, null, 2, null, null]);
    expect(PLAY_STEPS.map(roundResultOf)).toEqual([null, 1, null, null, null]);
    expect(PLAY_STEPS.map(replayOf)).toEqual([null, null, null, null, null]);
    expect([roundScenario(1), roundScenario(2)]).toEqual(['today', 'hub']);
    for (const step of PLAY_STEPS) expect(reshuffle({step, seed: 7})).toEqual({step, seed: 7});
  });

  test('presenter mode walks title, today, results, hub, comparison, then replays the same day', () => {
    let s: FlowState = {...startFlow(7), presenter: true};
    const seen = [s.step];
    for (let i = 0; i < STEPS.length; i++) {
      s = advance(s);
      seen.push(s.step);
    }
    expect(seen).toEqual(['title', 'today', 'today-results', 'hub', 'comparison', 'today']);
    expect(s).toEqual({step: 'today', seed: 7, presenter: true});
  });

  test('the title switches between play and presenter, and nowhere else does', () => {
    const title = startFlow(7);
    expect(modeOf(title)).toBe('play');
    const presenter = toggleMode(title);
    expect(presenter).toEqual({step: 'title', seed: 7, presenter: true});
    expect(modeOf(presenter)).toBe('presenter');
    expect(advance(presenter).step).toBe('today');
    expect(toggleMode(presenter)).toEqual(title);
    for (const step of [...STEPS, ...PLAY_STEPS].filter(x => x !== 'title')) {
      expect(toggleMode({step, seed: 7})).toEqual({step, seed: 7});
      expect(toggleMode({step, seed: 7, presenter: true})).toEqual({step, seed: 7, presenter: true});
    }
  });

  test('take-control is offered only to a presenter, and only while a day replays', () => {
    for (const step of [...STEPS, ...PLAY_STEPS]) {
      expect(controlAllowed({step, seed: 7})).toBe(false);
      expect(controlAllowed({step, seed: 7, presenter: true})).toBe(replayOf(step) !== null);
    }
  });

  test('R at the comparison replays a new day; elsewhere it does nothing', () => {
    expect(reshuffle({step: 'comparison', seed: 7})).toEqual({step: 'today', seed: 8});
    for (const step of STEPS.filter(x => x !== 'comparison')) expect(reshuffle({step, seed: 7})).toEqual({step, seed: 7});
  });

  test('settings open from the title only, return to the title, and keep the day', () => {
    expect(openSettings({step: 'title', seed: 7})).toEqual({step: 'settings', seed: 7});
    for (const step of STEPS.filter(x => x !== 'title')) expect(openSettings({step, seed: 7})).toEqual({step, seed: 7});
    expect(closeSettings({step: 'settings', seed: 9})).toEqual({step: 'title', seed: 9});
    expect(closeSettings({step: 'hub', seed: 9})).toEqual({step: 'hub', seed: 9});
  });

  test('SPACE does nothing in the menu, and R there draws a new day without leaving it', () => {
    expect(advance({step: 'settings', seed: 7})).toEqual({step: 'settings', seed: 7});
    expect(reshuffle({step: 'settings', seed: 7})).toEqual({step: 'settings', seed: 8});
  });

  test('only the two runs are replays', () => {
    expect(STEPS.map(replayOf)).toEqual([null, 'today', null, 'hub', null]);
  });

  test('deep links open each step, on the seed given', () => {
    expect(fromQuery(query(''))).toEqual({flow: {step: 'title', seed: DEFAULT_SEED}, minute: 0});
    expect(fromQuery(query('scene=shop&minute=424'))).toEqual({flow: {step: 'today', seed: DEFAULT_SEED}, minute: 424});
    expect(fromQuery(query('scene=shop&scenario=hub&minute=x'))).toEqual({flow: {step: 'hub', seed: DEFAULT_SEED}, minute: 0});
    expect(fromQuery(query('scene=results&seed=4')).flow).toEqual({step: 'today-results', seed: 4});
    expect(fromQuery(query('scene=comparison&seed=-2')).flow).toEqual({step: 'comparison', seed: DEFAULT_SEED});
    expect(fromQuery(query('scene=settings')).flow).toEqual({step: 'settings', seed: DEFAULT_SEED});
    expect(fromQuery(query('scene=nope')).flow.step).toBe('title');
    expect(fromQuery(query('scene=play')).flow).toEqual({step: 'round-1', seed: DEFAULT_SEED});
    expect(fromQuery(query('scene=play&round=2&seed=3')).flow).toEqual({step: 'round-2', seed: 3});
    expect(fromQuery(query('scene=round-result')).flow.step).toBe('round-1-result');
    expect(fromQuery(query('scene=rounds')).flow.step).toBe('round-comparison');
    expect(fromQuery(query('scene=whole-day&seed=5')).flow).toEqual({step: 'whole-day', seed: 5});
    expect(fromQuery(query('mode=presenter')).flow).toEqual({step: 'title', seed: DEFAULT_SEED, presenter: true});
    expect(advance(fromQuery(query('mode=presenter')).flow).step).toBe('today');
  });

  test('the style frame opens on the dilemma unless another still is named, and SPACE leaves it for the title', () => {
    expect(fromQuery(query('scene=style-frame'))).toEqual({flow: {step: 'style-frame', seed: DEFAULT_SEED}, minute: 0, moment: 'dilemma'});
    expect(fromQuery(query('scene=style-frame&moment=unmanned')).moment).toBe('unmanned');
    expect(fromQuery(query('scene=style-frame&moment=nope')).moment).toBe('dilemma');
    expect(advance({step: 'style-frame', seed: 3})).toEqual({step: 'title', seed: 3});
    expect(replayOf('style-frame')).toBeNull();
  });
});
