import {advance, closeSettings, fromQuery, openSettings, replayOf, reshuffle, type FlowState, type Step} from './flow/flow';
import {type Action, keyAction, REPEATABLE, tapAccepted} from './flow/input';
import {change, describe, type Editor, moveCursor, openEditor, problem, resetToDefaults, selectVisible} from './flow/settings';
import {loadSettings, openStorage, saveSettings} from './flow/settings-store';
import {type Beat, beatAt, narrationBeats, nextBeatAfter, SCENARIO_TITLES} from './render/narration';
import {readPalette} from './render/palette';
import {inputMode, promptsFor} from './render/prompts';
import {realMsFor, replayState, shopMinuteAt} from './render/replay';
import {CONTROLS_TOP, drawSettings, rowAt} from './render/settings';
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
import {SCREEN_HEIGHT} from './render/screen-size';
import type {ScenarioName} from './sim/params';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const prompt = document.querySelector<HTMLElement>('#prompt');
const stage = document.querySelector<HTMLElement>('.stage');
const button = (id: string): HTMLButtonElement => {
  const el = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el;
};
if (!canvas || !prompt || !stage) throw new Error('#screen, #prompt or .stage is missing from index.html');
const reshuffleButton = button('reshuffle');
const buttons = {
  open: button('open-settings'),
  decrease: button('decrease'),
  increase: button('increase'),
  reset: button('reset'),
  back: button('back'),
};

const store = openStorage(() => window.localStorage);
let settings = loadSettings(store);
let params = settings.params;
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
const settingsHint = mode === 'touch' ? 'Use the settings button for settings.' : 'Press S for settings.';

const LABELS: Readonly<Record<Step, string>> = {
  title: `PAINT RUSH title screen. ${prompts.verb} to start. ${settingsHint}`,
  settings: 'Settings menu. Up and down choose a setting, left and right or the minus and plus buttons change it, back returns to the title.',
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
  let builtFor = settings;
  let beats = beatsFor(day);
  let start = 0;
  let editor: Editor = openEditor(settings);
  let remembered = store !== null;

  function beatsFor(c: Comparison): Record<ScenarioName, Beat[]> {
    return {today: narrationBeats('today', c.today.timeline, params), hub: narrationBeats('hub', c.hub.timeline, params)};
  }

  const msFor = (minutes: number): number => realMsFor(minutes, settings.timeScale);
  const minuteAt = (elapsedMs: number): number => shopMinuteAt(elapsedMs, settings.timeScale);

  const announce = (text: string): void => {
    if (prompt.textContent !== text) prompt.textContent = text;
  };

  const blocker = (): string | null => problem(editor.settings);
  const settingsText = (): string => {
    const parts = [describe(editor), blocker(), remembered ? null : 'Not saved, browser storage is off'];
    return `${parts.filter(Boolean).join('. ')}.`;
  };

  const syncControls = (): void => {
    const inMenu = flow.step === 'settings';
    buttons.open.hidden = flow.step !== 'title';
    for (const b of [buttons.decrease, buttons.increase, buttons.reset, buttons.back]) b.hidden = !inMenu;
    reshuffleButton.hidden = flow.step !== 'comparison' && !inMenu;
    buttons.back.setAttribute('aria-disabled', String(blocker() !== null));
  };

  const enter = (next: FlowState, now: number, minute = 0): void => {
    if (next.seed !== day.seed || builtFor !== settings) {
      day = compare(next.seed, params);
      builtFor = settings;
      beats = beatsFor(day);
    }
    if (next.step === 'settings' && flow.step !== 'settings') editor = openEditor(settings);
    flow = next;
    start = now - msFor(minute);
    canvas.setAttribute('aria-label', LABELS[flow.step]);
    document.body.dataset.scene = replayOf(flow.step) ? 'shop' : flow.step === 'today-results' ? 'results' : flow.step;
    document.body.dataset.step = flow.step;
    document.body.dataset.seed = String(flow.seed);
    syncControls();
    if (flow.step === 'title') announce(prompts.title);
    if (flow.step === 'settings') announce(settingsText());
    if (flow.step === 'today-results') announce(resultsAnnouncement(day.today.metrics));
    if (flow.step === 'comparison') announce(comparisonAnnouncement(day, savings(day)));
  };

  const draw = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (flow.step === 'title') drawTitle(s.rect, prompts.title, promptVisible(now - start, reducedMotion.matches), prompts.settingsHint);
    else if (flow.step === 'settings') drawSettings(s.rect, editor, remembered);
    else if (flow.step === 'today-results') drawResults(s.rect, todayRows(day.today.metrics), day.today.metrics.salesLostGbp === 0, prompts.results);
    else if (flow.step === 'comparison') drawComparison(s.rect, comparisonRows(day), savingsRows(day, savings(day)), prompts.comparison);
    else if (scenario) {
      const minute = minuteAt(now - start);
      const state = replayState(day[scenario].timeline, params.staff, params.shiftMinutes, minute);
      const beat = beatAt(beats[scenario], state.minute);
      const text = beat?.text ?? '';
      const chars = revealed(text, msFor(state.minute - (beat?.at ?? 0)), reducedMotion.matches);
      announce(text);
      drawShop(s.rect, {scenario, state, params, text, chars});
    }
  };

  /** Edits are applied the moment they are valid, so the next run and the next visit both see them. */
  const edit = (next: Editor): void => {
    editor = next;
    if (blocker() === null) {
      settings = editor.settings;
      params = settings.params;
      remembered = saveSettings(store, settings);
    }
    syncControls();
    announce(settingsText());
  };

  const actInMenu = (action: Action, now: number): boolean => {
    switch (action) {
      case 'up':
      case 'down':
        editor = moveCursor(editor, action === 'up' ? -1 : 1);
        announce(settingsText());
        return true;
      case 'decrease':
      case 'increase':
        edit(change(editor, action === 'increase' ? 1 : -1));
        return true;
      case 'reset':
        edit(resetToDefaults(editor));
        announce(`Defaults restored. ${settingsText()}`);
        return true;
      case 'reshuffle':
        flow = reshuffle(flow);
        document.body.dataset.seed = String(flow.seed);
        announce(`New day drawn, number ${flow.seed}.`);
        return true;
      case 'back': {
        const why = blocker();
        if (why) announce(`Cannot leave the menu: ${why}.`);
        else enter(closeSettings(flow), now);
        return true;
      }
      default:
        return false;
    }
  };

  const act = (action: Action): boolean => {
    const now = performance.now();
    if (flow.step === 'settings') return actInMenu(action, now);
    if (action === 'settings') {
      if (flow.step !== 'title') return false;
      enter(openSettings(flow), now);
      return true;
    }
    if (action === 'reshuffle') {
      if (flow.step !== 'comparison') return false;
      enter(reshuffle(flow), now);
      return true;
    }
    if (action !== 'advance') return false;
    const scenario = replayOf(flow.step);
    if (scenario) {
      const minute = minuteAt(now - start);
      const next = nextBeatAfter(beats[scenario], minute);
      if (next) {
        start -= msFor(next.at - minute);
        return true;
      }
    }
    enter(advance(flow), now);
    return true;
  };

  window.addEventListener('keydown', e => {
    const action = keyAction(e.code);
    if (!action || (e.repeat && !REPEATABLE.includes(action))) return;
    // A focused button handles its own SPACE and Enter, so the key means what the button says.
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (act(action) || action === 'advance' || action === 'reshuffle') e.preventDefault();
  });

  let lastTap: number | null = null;
  stage.addEventListener('pointerdown', e => {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (flow.step === 'settings') {
      const box = canvas.getBoundingClientRect();
      const y = ((e.clientY - box.top) / box.height) * SCREEN_HEIGHT;
      const row = y < CONTROLS_TOP ? rowAt(y) : null;
      if (row !== null) {
        editor = selectVisible(editor, row);
        announce(settingsText());
      }
      return;
    }
    if (!tapAccepted(lastTap, e.timeStamp)) return;
    lastTap = e.timeStamp;
    act('advance');
  });

  reshuffleButton.addEventListener('click', () => act('reshuffle'));
  buttons.open.addEventListener('click', () => act('settings'));
  buttons.decrease.addEventListener('click', () => act('decrease'));
  buttons.increase.addEventListener('click', () => act('increase'));
  buttons.reset.addEventListener('click', () => act('reset'));
  buttons.back.addEventListener('click', () => act('back'));

  enter(flow, performance.now(), link.minute);
  const frame = (now: number): void => {
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
