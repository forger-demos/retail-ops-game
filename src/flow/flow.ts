import {DEFAULT_SEED} from '../sim/cli';
import type {ScenarioName} from '../sim/params';

/** The pitch in order; SPACE walks it and the comparison loops back to the same day. */
export const STEPS = ['title', 'today', 'today-results', 'hub', 'comparison'] as const;
export type Step = (typeof STEPS)[number];

export interface FlowState {
  step: Step;
  seed: number;
}

export function startFlow(seed = DEFAULT_SEED): FlowState {
  return {step: 'title', seed};
}

/** The scenario a step replays, or null when it is not a replay. */
export function replayOf(step: Step): ScenarioName | null {
  return step === 'today' ? 'today' : step === 'hub' ? 'hub' : null;
}

export function advance(state: FlowState): FlowState {
  const i = STEPS.indexOf(state.step);
  return {...state, step: state.step === 'comparison' ? 'today' : (STEPS[i + 1] ?? 'title')};
}

/** A new day is drawn only from the comparison, so the two runs being compared always share a seed. */
export function reshuffle(state: FlowState): FlowState {
  return state.step === 'comparison' ? {step: 'today', seed: state.seed + 1} : state;
}

export interface DeepLink {
  flow: FlowState;
  /** Shop minute a replay opens at. */
  minute: number;
}

/** Where `?scene=`, `?scenario=`, `?minute=` and `?seed=` open the pitch; anything unrecognised opens the title. */
export function fromQuery(get: (key: string) => string | null): DeepLink {
  const raw = get('seed');
  const seed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_SEED;
  const at = (step: Step, minute = 0): DeepLink => ({flow: {step, seed}, minute});
  switch (get('scene')) {
    case 'shop':
      return at(get('scenario') === 'hub' ? 'hub' : 'today', Math.max(0, Number(get('minute')) || 0));
    case 'results':
      return at('today-results');
    case 'comparison':
      return at('comparison');
    default:
      return at('title');
  }
}
