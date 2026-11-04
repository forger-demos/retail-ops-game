import {DEFAULT_SEED} from '../sim/cli';
import type {ScenarioName} from '../sim/params';

/** The pitch in order; SPACE walks it and the comparison loops back to the same day. */
export const STEPS = ['title', 'today', 'today-results', 'hub', 'comparison'] as const;
/**
 * The settings menu sits beside the pitch, not in it: it opens from the title and returns there.
 * The style frame is a still for judging the look; it is reached only by link.
 */
export type Step = (typeof STEPS)[number] | 'settings' | 'style-frame';

export const STYLE_MOMENTS = ['dilemma', 'unmanned'] as const;
export type StyleMoment = (typeof STYLE_MOMENTS)[number];

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
  if (state.step === 'settings') return state;
  if (state.step === 'style-frame') return {...state, step: 'title'};
  const i = STEPS.indexOf(state.step);
  return {...state, step: state.step === 'comparison' ? 'today' : (STEPS[i + 1] ?? 'title')};
}

/** A new day is drawn only from the comparison or the menu, so the two runs being compared always share a seed. */
export function reshuffle(state: FlowState): FlowState {
  if (state.step === 'settings') return {...state, seed: state.seed + 1};
  return state.step === 'comparison' ? {step: 'today', seed: state.seed + 1} : state;
}

export function openSettings(state: FlowState): FlowState {
  return state.step === 'title' ? {...state, step: 'settings'} : state;
}

export function closeSettings(state: FlowState): FlowState {
  return state.step === 'settings' ? {...state, step: 'title'} : state;
}

export interface DeepLink {
  flow: FlowState;
  /** Shop minute a replay opens at. */
  minute: number;
  /** Which still the style frame shows; present only when it opens the style frame. */
  moment?: StyleMoment;
}

/** Where `?scene=`, `?scenario=`, `?minute=`, `?moment=` and `?seed=` open the pitch; anything unrecognised opens the title. */
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
    case 'settings':
      return at('settings');
    case 'style-frame': {
      const moment = STYLE_MOMENTS.find(m => m === get('moment')) ?? 'dilemma';
      return {...at('style-frame'), moment};
    }
    default:
      return at('title');
  }
}
