import {advance, fromQuery, replayOf, reshuffle, type FlowState, type Step} from './flow/flow';
import {type Beat, beatAt, narrationBeats, nextBeatAfter, SCENARIO_TITLES} from './render/narration';
import {readPalette} from './render/palette';
import {realMsFor, replayState, shopMinuteAt} from './render/replay';
import {createScreen, type Screen} from './render/screen';
import {comparisonAnnouncement, comparisonRows, resultsAnnouncement, savingsRows, todayRows} from './render/results';
import {revealed} from './render/textbox';
import {fallbackLines, FALLBACK_HEADLINE} from './scenes/fallback';
import {drawComparison, drawResults} from './scenes/results';
import {drawShop} from './scenes/shop';
import {drawTitle, PROMPT, promptVisible} from './scenes/title';
import {DEFAULT_SEED} from './sim/cli';
import {compare, type Comparison} from './sim/engine';
import {savings} from './sim/extrapolate';
import {DEFAULT_PARAMS, type ScenarioName} from './sim/params';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const prompt = document.querySelector<HTMLElement>('#prompt');
if (!canvas || !prompt) throw new Error('#screen or #prompt is missing from index.html');

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

const LABELS: Readonly<Record<Step, string>> = {
  title: 'PAINT RUSH title screen. Press space to start.',
  today: `Shop scene, ${SCENARIO_TITLES.today}. Press space to skip ahead.`,
  'today-results': "Today's results. Press space to run the same day with a central hub.",
  hub: `Shop scene, ${SCENARIO_TITLES.hub}. Press space to skip ahead.`,
  comparison: 'Comparison of today and with a central hub. Press space to replay this day, or R to reshuffle the day.',
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
    if (flow.step === 'title') announce(PROMPT);
    if (flow.step === 'today-results') announce(resultsAnnouncement(day.today.metrics));
    if (flow.step === 'comparison') announce(comparisonAnnouncement(day, savings(day)));
  };

  const draw = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (flow.step === 'title') drawTitle(s.rect, promptVisible(now - start, reducedMotion.matches));
    else if (flow.step === 'today-results') drawResults(s.rect, todayRows(day.today.metrics), day.today.metrics.salesLostGbp === 0);
    else if (flow.step === 'comparison') drawComparison(s.rect, comparisonRows(day), savingsRows(day, savings(day)));
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

  window.addEventListener('keydown', e => {
    if (e.repeat || (e.code !== 'Space' && e.code !== 'KeyR')) return;
    e.preventDefault();
    const now = performance.now();
    if (e.code === 'KeyR') {
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
  });

  enter(flow, performance.now(), link.minute);
  const frame = (now: number): void => {
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
