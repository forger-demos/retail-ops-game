import type {Arrivals} from './arrivals';
import type {Choice, Decision, ScenarioResult} from './engine';
import {runScenario} from './engine';
import type {Params, ScenarioName} from './params';

export interface ControlledRun {
  result: ScenarioResult;
  /** The first decision the presenter has not yet made, or null when the shift needs no more. */
  pending: Decision | null;
}

/**
 * Replays the shift with the presenter's choices so far. Decisions beyond them fall back to autoplay, so
 * no choices at all gives the autoplay result; the first of those is reported as pending, because
 * anything after it depends on what the presenter picks.
 */
export function runControlled(scenario: ScenarioName, arrivals: Arrivals, params: Params, choices: readonly Choice[]): ControlledRun {
  let pending: Decision | null = null;
  const result = runScenario(scenario, arrivals, params, d => {
    const made = choices[d.index];
    if (made) return made;
    pending ??= d;
    return d.fallback;
  });
  return {result, pending};
}
