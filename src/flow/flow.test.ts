import {describe, expect, test} from 'bun:test';

import {DEFAULT_SEED} from '../sim/cli';
import {advance, closeSettings, fromQuery, openSettings, replayOf, reshuffle, startFlow, STEPS, type FlowState} from './flow';

const query = (q: string) => {
  const p = new URLSearchParams(q);
  return (k: string) => p.get(k);
};

describe('the pitch flow', () => {
  test('SPACE walks title, today, results, hub, comparison, then replays the same day', () => {
    let s: FlowState = startFlow(7);
    const seen = [s.step];
    for (let i = 0; i < STEPS.length; i++) {
      s = advance(s);
      seen.push(s.step);
    }
    expect(seen).toEqual(['title', 'today', 'today-results', 'hub', 'comparison', 'today']);
    expect(s.seed).toBe(7);
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
  });
});
