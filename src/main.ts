import {advance, fromQuery, replayOf, reshuffle, type FlowState, type Step} from './flow/flow';
import {type Action, keyAction, tapAccepted} from './flow/input';
import {type Beat, beatAt, narrationBeats, nextBeatAfter, SCENARIO_TITLES} from './render/narration';
import {readPalette} from './render/palette';
import {inputMode, promptsFor} from './render/prompts';
import {realMsFor, replayState, shopMinuteAt} from './render/replay';
import {createScreen, type Screen} from './render/screen';
import {comparisonAnnouncement, comparisonRows, resultsAnnouncement, savingsRows, todayRows} from './render/results';
import {revealed} from './render/textbox';
import {fallbackLines, FALLBACK_HEADLINE} from './scenes/fallback';
import {drawComparison, drawResults} from './scenes/results';
import {drawShop} from './scenes/shop';
import {drawTitle, promptVisible} from './scenes/title';
import {DEFAULT_SEED} from './sim/cli';
import {compare, type Comparison} from './sim/engine';
import {savings} from './sim/extrapolate';
import {DEFAULT_PARAMS, type ScenarioName} from './sim/params';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const prompt = document.querySelector<HTMLElement>('#prompt');
const stage = document.querySelector<HTMLElement>('.stage');
const reshuffleButton = document.querySelector<HTMLButtonElement>('#reshuffle');
if (!canvas || !prompt || !stage || !reshuffleButton) throw new Error('#screen, #prompt, .stage or #reshuffle is missing from index.html');

const params = DEFAULT_PARAMS;
const comparison = compare(DEFAULT_SEED, params);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function showFallback(c: HTMLCanvasElement): void {
  const box = document.createElement('section');
  box.className = 'fallback';
  for (const text of [FALLBACK_HEADLINE, ...fallbackLines(comparison)]) {
    const p = document.createElement('p');
    p.textContent = text;
    box.append(p);
  }
  c.replaceWith(box);
  document.body.dataset.scene = 'fallback';
}

let screen: Screen | null = null;
try {
  screen = createScreen(canvas, readPalette(token => getComputedStyle(document.documentElement).getPropertyValue(token)));
} catch {
  showFallback(canvas);
}

const mode = inputMode(query => window.matchMedia(query).matches);
const prompts = promptsFor(mode);
document.body.dataset.input = mode;
const reshuffleHint = mode === 'touch' ? 'the reshuffle button' : 'R';

const LABELS: Readonly<Record<Step, string>> = {
  title: `PAINT RUSH title screen. ${prompts.verb} to start.`,
  today: `Shop scene, ${SCENARIO_TITLES.today}. ${prompts.verb} to skip ahead.`,
  'today-results': `Today's results. ${prompts.verb} to run the same day with a central hub.`,
  hub: `Shop scene, ${SCENARIO_TITLES.hub}. ${prompts.verb} to skip ahead.`,
  comparison: `Comparison of today and with a central hub. ${prompts.verb} to replay this day, or use ${reshuffleHint} to reshuffle the day.`,
};

if (screen) {
  const s = screen;
  const link = fromQuery(key => new URLSearchParams(location.search).get(key));
  let flow = link.flow;
  let day = comparison;
  let beats = beatsFor(day);
  let start = 0;

  function beatsFor(c: Comparison): Record<ScenarioName, Beat[]> {
    return {today: narrationBeats('today', c.today.timeline, params), hub: narrationBeats('hub', c.hub.timeline, params)};
  }

  const announce = (text: string): void => {
    if (prompt.textContent !== text) prompt.textContent = text;
  };

  const enter = (next: FlowState, now: number, minute = 0): void => {
    if (next.seed !== day.seed) {
      day = compare(next.seed, params);
      beats = beatsFor(day);
    }
    flow = next;
    start = now - realMsFor(minute);
    canvas.setAttribute('aria-label', LABELS[flow.step]);
    document.body.dataset.scene = replayOf(flow.step) ? 'shop' : flow.step === 'today-results' ? 'results' : flow.step;
    document.body.dataset.step = flow.step;
    reshuffleButton.hidden = flow.step !== 'comparison';
    if (flow.step === 'title') announce(prompts.title);
    if (flow.step === 'today-results') announce(resultsAnnouncement(day.today.metrics));
    if (flow.step === 'comparison') announce(comparisonAnnouncement(day, savings(day)));
  };

  const draw = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (flow.step === 'title') drawTitle(s.rect, prompts.title, promptVisible(now - start, reducedMotion.matches));
    else if (flow.step === 'today-results') drawResults(s.rect, todayRows(day.today.metrics), day.today.metrics.salesLostGbp === 0, prompts.results);
    else if (flow.step === 'comparison') drawComparison(s.rect, comparisonRows(day), savingsRows(day, savings(day)), prompts.comparison);
    else if (scenario) {
      const minute = shopMinuteAt(now - start);
      const state = replayState(day[scenario].timeline, params.staff, params.shiftMinutes, minute);
      const beat = beatAt(beats[scenario], state.minute);
      const text = beat?.text ?? '';
      const chars = revealed(text, realMsFor(state.minute - (beat?.at ?? 0)), reducedMotion.matches);
      announce(text);
      drawShop(s.rect, {scenario, state, params, text, chars});
    }
  };

  const act = (action: Action): void => {
    const now = performance.now();
    if (action === 'reshuffle') {
      if (flow.step === 'comparison') enter(reshuffle(flow), now);
      return;
    }
    const scenario = replayOf(flow.step);
    if (scenario) {
      const minute = shopMinuteAt(now - start);
      const next = nextBeatAfter(beats[scenario], minute);
      if (next) {
        start -= realMsFor(next.at - minute);
        return;
      }
    }
    enter(advance(flow), now);
  };

  window.addEventListener('keydown', e => {
    const action = keyAction(e.code);
    // A focused button handles its own SPACE and Enter, so the key means what the button says.
    if (e.repeat || !action || (e.target instanceof HTMLButtonElement && action === 'advance')) return;
    e.preventDefault();
    act(action);
  });

  let lastTap: number | null = null;
  stage.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (!tapAccepted(lastTap, e.timeStamp)) return;
    lastTap = e.timeStamp;
    act('advance');
  });

  reshuffleButton.addEventListener('click', () => act('reshuffle'));

  enter(flow, performance.now(), link.minute);
  const frame = (now: number): void => {
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
