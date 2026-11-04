import {DEFAULT_SEED} from '../sim/cli';
import type {ScenarioName} from '../sim/params';

/** The pitch in order; SPACE walks it and the comparison loops back to the same day. */
export const STEPS = ['title', 'today', 'today-results', 'hub', 'comparison'] as const;
/** Play mode, the default: two played rounds come between the title and the full-shift pitch. */
export const PLAY_STEPS = ['round-1', 'round-1-result', 'round-2', 'round-2-result'] as const;
export type PlayStep = (typeof PLAY_STEPS)[number];
/**
 * The settings menu sits beside the pitch, not in it: it opens from the title and returns there.
 * The style frame is a still for judging the look; it is reached only by link.
 */
export type Step = (typeof STEPS)[number] | PlayStep | 'settings' | 'style-frame';

export const STYLE_MOMENTS = ['dilemma', 'unmanned'] as const;
export type StyleMoment = (typeof STYLE_MOMENTS)[number];

export interface FlowState {
  step: Step;
  seed: number;
  /** Presenter mode: the v1 autoplay pitch, with no played rounds. */
  presenter?: true;
}

export function startFlow(seed = DEFAULT_SEED): FlowState {
  return {step: 'title', seed};
}

/** The scenario a step replays, or null when it is not a replay. */
export function replayOf(step: Step): ScenarioName | null {
  return step === 'today' ? 'today' : step === 'hub' ? 'hub' : null;
}

export type RoundNumber = 1 | 2;

/** Which round a step plays, or null when it is not a played round. */
export function roundOf(step: Step): RoundNumber | null {
  return step === 'round-1' ? 1 : step === 'round-2' ? 2 : null;
}

/** Which round a step shows the result of, or null. */
export function roundResultOf(step: Step): RoundNumber | null {
  return step === 'round-1-result' ? 1 : step === 'round-2-result' ? 2 : null;
}

/** Round 1 mixes every order in store; round 2 has the hub. */
export function roundScenario(round: RoundNumber): ScenarioName {
  return round === 1 ? 'today' : 'hub';
}

/** A round ends when its time is up, not on SPACE; `advance` from a round is that ending. */
export function advance(state: FlowState): FlowState {
  if (state.step === 'settings') return state;
  if (state.step === 'style-frame') return {...state, step: 'title'};
  if (state.step === 'title' && !state.presenter) return {...state, step: 'round-1'};
  const p = (PLAY_STEPS as readonly Step[]).indexOf(state.step);
  if (p >= 0) return {...state, step: PLAY_STEPS[p + 1] ?? 'today'};
  const i = (STEPS as readonly Step[]).indexOf(state.step);
  return {...state, step: state.step === 'comparison' ? 'today' : (STEPS[i + 1] ?? 'title')};
}

/** A new day is drawn only from the comparison or the menu, so the two runs being compared always share a seed. */
export function reshuffle(state: FlowState): FlowState {
  if (state.step === 'settings') return {...state, seed: state.seed + 1};
  return state.step === 'comparison' ? {...state, step: 'today', seed: state.seed + 1} : state;
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

/**
 * Where `?scene=`, `?scenario=`, `?minute=`, `?moment=`, `?round=`, `?mode=` and `?seed=` open the pitch;
 * anything unrecognised opens the title. `?mode=presenter` is the autoplay pitch with no played rounds.
 */
export function fromQuery(get: (key: string) => string | null): DeepLink {
  const raw = get('seed');
  const seed = raw !== null && /^\d+$/.test(raw) ? Number(raw) : DEFAULT_SEED;
  const presenter = get('mode') === 'presenter' ? ({presenter: true} as const) : {};
  const at = (step: Step, minute = 0): DeepLink => ({flow: {step, seed, ...presenter}, minute});
  switch (get('scene')) {
    case 'play':
      return at(get('round') === '2' ? 'round-2' : 'round-1');
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
