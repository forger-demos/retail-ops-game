import {beatAt, narrationBeats, nextBeatAfter, SCENARIO_TITLES} from './render/narration';
import {readPalette} from './render/palette';
import {realMsFor, replayState, shopMinuteAt} from './render/replay';
import {createScreen, type Screen} from './render/screen';
import {revealed} from './render/textbox';
import {fallbackLines, FALLBACK_HEADLINE} from './scenes/fallback';
import {drawShop} from './scenes/shop';
import {drawTitle, promptVisible} from './scenes/title';
import {DEFAULT_SEED} from './sim/cli';
import {compare} from './sim/engine';
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

type Scene = {name: 'title'; start: number} | {name: 'shop'; scenario: ScenarioName; start: number};

function shopScene(scenario: ScenarioName, startMinute: number, now: number): Scene {
  const label = `Shop scene, ${SCENARIO_TITLES[scenario]}. Press space to skip ahead.`;
  canvas?.setAttribute('aria-label', label);
  document.body.dataset.scene = 'shop';
  return {name: 'shop', scenario, start: now - realMsFor(startMinute)};
}

function initialScene(now: number): Scene {
  const query = new URLSearchParams(location.search);
  if (query.get('scene') !== 'shop') {
    document.body.dataset.scene = 'title';
    return {name: 'title', start: now};
  }
  const scenario: ScenarioName = query.get('scenario') === 'hub' ? 'hub' : 'today';
  return shopScene(scenario, Math.max(0, Number(query.get('minute')) || 0), now);
}

if (screen) {
  const s = screen;
  const beats = {today: narrationBeats('today', comparison.today.timeline, params), hub: narrationBeats('hub', comparison.hub.timeline, params)};
  let scene = initialScene(performance.now());

  const draw = (now: number): void => {
    if (scene.name === 'title') {
      drawTitle(s.rect, promptVisible(now - scene.start, reducedMotion.matches));
      return;
    }
    const minute = shopMinuteAt(now - scene.start);
    const run = comparison[scene.scenario];
    const state = replayState(run.timeline, params.staff, params.shiftMinutes, minute);
    const beat = beatAt(beats[scene.scenario], state.minute);
    const text = beat?.text ?? '';
    const chars = revealed(text, realMsFor(state.minute - (beat?.at ?? 0)), reducedMotion.matches);
    if (prompt.textContent !== text) prompt.textContent = text;
    drawShop(s.rect, {scenario: scene.scenario, state, params, text, chars});
  };

  window.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat) return;
    e.preventDefault();
    const now = performance.now();
    if (scene.name === 'title') {
      scene = shopScene('today', 0, now);
      return;
    }
    const minute = shopMinuteAt(now - scene.start);
    const next = nextBeatAfter(beats[scene.scenario], minute);
    if (next) scene.start -= realMsFor(next.at - minute);
  });

  const frame = (now: number): void => {
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
