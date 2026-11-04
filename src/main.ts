import {advance, closeSettings, fromQuery, openSettings, replayOf, reshuffle, type FlowState, type Step} from './flow/flow';
import {type Action, keyAction, REPEATABLE, tapAccepted} from './flow/input';
import {change, describe, type Editor, moveCursor, openEditor, problem, resetToDefaults, selectVisible} from './flow/settings';
import {loadSettings, openStorage, saveSettings} from './flow/settings-store';
import {type Beat, beatAt, narrationBeats, nextBeatAfter, SCENARIO_TITLES} from './render/narration';
import {createSfx, effectsBetween, type AudioLike} from './audio/sfx';
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
import {styleFrame} from './scenes/style-frame';
import {drawTitle, promptVisible} from './scenes/title';
import {DEFAULT_SEED} from './sim/cli';
import {runControlled, type ControlledRun} from './sim/control';
import {drawArrivals} from './sim/arrivals';
import {compare, type Choice, type Comparison, type Decision} from './sim/engine';
import {savings} from './sim/extrapolate';
import {SCREEN_HEIGHT} from './render/screen-size';
import type {ScenarioName} from './sim/params';

const canvas = document.querySelector<HTMLCanvasElement>('#screen');
const prompt = document.querySelector<HTMLElement>('#prompt');
const stage = document.querySelector<HTMLElement>('.stage');
const consoleFrame = document.querySelector<HTMLElement>('.console');
const button = (id: string): HTMLButtonElement => {
  const el = document.querySelector<HTMLButtonElement>(`#${id}`);
  if (!el) throw new Error(`#${id} is missing from index.html`);
  return el;
};
if (!canvas || !prompt || !stage || !consoleFrame) throw new Error('#screen, #prompt, .stage or .console is missing from index.html');
/** Clear space kept around the console, on top of the console's own size, in CSS pixels. */
const MARGIN_PX = 12;
const reshuffleButton = button('reshuffle');
const controlButton = button('control');
const soundButton = button('sound');
const pickButtons: Readonly<Record<Choice, HTMLButtonElement>> = {'walk-in': button('walk-in'), order: button('order')};
/** Real milliseconds the shift waits for a pick before taking autoplay's, so doing nothing is autoplay. */
const DECISION_MS = 6000;
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
  const fits = (): boolean => {
    const frame = consoleFrame.getBoundingClientRect();
    return frame.width + 2 * MARGIN_PX <= window.innerWidth && frame.height + 2 * MARGIN_PX <= window.innerHeight;
  };
  screen = createScreen(canvas, readPalette(token => getComputedStyle(document.documentElement).getPropertyValue(token)), window, fits);
} catch {
  showFallback(canvas);
}

const sfx = createSfx(() => {
  const w = window as unknown as {AudioContext?: new () => AudioLike; webkitAudioContext?: new () => AudioLike};
  const Context = w.AudioContext ?? w.webkitAudioContext;
  return Context ? new Context() : null;
});

const mode = inputMode(query => window.matchMedia(query).matches);
const prompts = promptsFor(mode);
document.body.dataset.input = mode;
const reshuffleHint = mode === 'touch' ? 'the reshuffle button' : 'R';
const controlHint = mode === 'touch' ? 'Use the take control button to decide who is served next.' : 'Press C to take control of who is served next.';
const settingsHint = mode === 'touch' ? 'Use the settings button for settings.' : 'Press S for settings, M for sound.';

const LABELS: Readonly<Record<Step, string>> = {
  title: `PAINT RUSH title screen. ${prompts.verb} to start. ${settingsHint}`,
  settings: 'Settings menu. Up and down choose a setting, left and right or the minus and plus buttons change it, back returns to the title.',
  today: `Shop scene, ${SCENARIO_TITLES.today}. ${prompts.verb} to skip ahead. ${controlHint}`,
  'today-results': `Today's results. ${prompts.verb} to run the same day with a central hub.`,
  hub: `Shop scene, ${SCENARIO_TITLES.hub}. ${prompts.verb} to skip ahead. ${controlHint}`,
  comparison: `Comparison of today and with a central hub. ${prompts.verb} to replay this day, or use ${reshuffleHint} to reshuffle the day.`,
  'style-frame': `Style frame: the shop at a decisive moment, a still for judging the look. ${prompts.verb} for the title.`,
};

if (screen) {
  const s = screen;
  const link = fromQuery(key => new URLSearchParams(location.search).get(key));
  let flow = link.flow;
  const moment = link.moment ?? 'dilemma';
  let baseDay = comparison;
  let day = comparison;
  let controlOn = false;
  let choices: Choice[] = [];
  let run: ControlledRun | null = null;
  /** Real time the shift stopped to wait for a pick, or null while it is running. */
  let decidingSince: number | null = null;
  let builtFor = settings;
  let beats = beatsFor(day);
  let start = 0;
  /** Shop minute the last replay frame showed, so each frame plays only the effects it has just passed. */
  let heardTo = 0;
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
    soundButton.hidden = inMenu;
    soundButton.textContent = sfx.on ? 'SOUND ON' : 'SOUND OFF';
    buttons.open.hidden = flow.step !== 'title';
    for (const b of [buttons.decrease, buttons.increase, buttons.reset, buttons.back]) b.hidden = !inMenu;
    reshuffleButton.hidden = flow.step !== 'comparison' && !inMenu;
    const replaying = replayOf(flow.step) !== null;
    controlButton.hidden = !replaying;
    controlButton.textContent = controlOn ? 'AUTOPLAY' : 'TAKE CONTROL';
    controlButton.setAttribute('aria-pressed', String(controlOn));
    for (const b of Object.values(pickButtons)) b.hidden = !(replaying && deciding());
    buttons.back.setAttribute('aria-disabled', String(blocker() !== null));
  };

  const enter = (next: FlowState, now: number, minute = 0): void => {
    if (next.seed !== day.seed || builtFor !== settings) {
      baseDay = compare(next.seed, params);
      day = baseDay;
      builtFor = settings;
      beats = beatsFor(day);
    }
    if (next.step === 'settings' && flow.step !== 'settings') editor = openEditor(settings);
    flow = next;
    const entering = replayOf(next.step);
    if (entering) {
      day = next.step === 'today' ? baseDay : {...day, [entering]: baseDay[entering]};
      beats = beatsFor(day);
      choices = [];
      run = null;
      decidingSince = null;
    }
    start = now - msFor(minute);
    heardTo = minute;
    canvas.setAttribute('aria-label', LABELS[flow.step]);
    document.body.dataset.scene = replayOf(flow.step) ? 'shop' : flow.step === 'today-results' ? 'results' : flow.step;
    document.body.dataset.step = flow.step;
    document.body.dataset.seed = String(flow.seed);
    syncControls();
    if (flow.step === 'title') announce(prompts.title);
    if (flow.step === 'settings') announce(settingsText());
    if (flow.step === 'today-results') announce(resultsAnnouncement(day.today.metrics));
    if (flow.step === 'comparison') announce(comparisonAnnouncement(day, savings(day)));
    if (flow.step === 'style-frame') announce(styleFrame(moment, params).text);
  };

  const pendingNow = (): Decision | null => (controlOn ? (run?.pending ?? null) : null);
  const deciding = (): boolean => decidingSince !== null;

  /** Shop minute a replay shows: it stops at an unmade decision rather than running past it. */
  const replayMinute = (now: number): number => {
    const minute = minuteAt(now - start);
    const pending = pendingNow();
    return pending && minute >= pending.at ? pending.at : minute;
  };

  const rerun = (scenario: ScenarioName): void => {
    run = runControlled(scenario, drawArrivals(flow.seed, params), params, choices);
    day = {...day, [scenario]: run.result};
    beats = beatsFor(day);
  };

  const resolve = (choice: Choice, now: number): void => {
    const scenario = replayOf(flow.step);
    const pending = pendingNow();
    if (!scenario || !pending) return;
    choices = [...choices, choice];
    rerun(scenario);
    start = now - msFor(pending.at);
    decidingSince = null;
    syncControls();
  };

  /** Starts, and times out, the wait for a pick. */
  const tick = (now: number): void => {
    const scenario = replayOf(flow.step);
    const pending = pendingNow();
    if (!scenario || !pending) {
      if (decidingSince !== null) {
        decidingSince = null;
        syncControls();
      }
      return;
    }
    if (decidingSince === null && minuteAt(now - start) >= pending.at) {
      decidingSince = now;
      syncControls();
    }
    if (decidingSince !== null && now - decidingSince >= DECISION_MS) resolve(pending.fallback, now);
  };

  const toggleControl = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (!scenario) return;
    if (deciding()) start = now - msFor(pendingNow()?.at ?? 0);
    controlOn = !controlOn;
    if (controlOn && !run) rerun(scenario);
    decidingSince = null;
    syncControls();
    announce(controlOn ? prompts.controlOn : prompts.controlOff);
  };

  const draw = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (flow.step === 'title') drawTitle(s.rect, prompts.title, promptVisible(now - start, reducedMotion.matches), prompts.settingsHint);
    else if (flow.step === 'settings') drawSettings(s.rect, editor, remembered);
    else if (flow.step === 'today-results') drawResults(s.rect, todayRows(day.today.metrics), day.today.metrics.salesLostGbp === 0, prompts.results);
    else if (flow.step === 'comparison') drawComparison(s.rect, comparisonRows(day), savingsRows(day, savings(day)), prompts.comparison);
    else if (flow.step === 'style-frame') drawShop(s.rect, {...styleFrame(moment, params), sound: sfx.on});
    else if (scenario) {
      const minute = replayMinute(now);
      const state = replayState(day[scenario].timeline, params.staff, params.shiftMinutes, minute);
      const beat = beatAt(beats[scenario], state.minute);
      const text = deciding() ? prompts.decision : (beat?.text ?? '');
      const chars = deciding() ? text.length : revealed(text, msFor(state.minute - (beat?.at ?? 0)), reducedMotion.matches);
      announce(text);
      for (const name of effectsBetween(day[scenario].timeline, heardTo, state.minute)) sfx.play(name);
      heardTo = state.minute;
      drawShop(s.rect, {scenario, state, params, text, chars, sound: sfx.on});
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
    if (action === 'sound') {
      const wasOn = sfx.on;
      const isOn = sfx.toggle();
      announce(isOn ? 'Sound on.' : wasOn ? 'Sound off.' : 'Sound stays off. This browser has no audio.');
      syncControls();
      return true;
    }
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
    if (action === 'control') {
      toggleControl(now);
      return replayOf(flow.step) !== null;
    }
    if (action === 'walk-in' || action === 'order') {
      if (!deciding()) return false;
      resolve(action, now);
      return true;
    }
    if (action !== 'advance') return false;
    if (deciding()) return true;
    const scenario = replayOf(flow.step);
    if (scenario) {
      const minute = replayMinute(now);
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

  controlButton.addEventListener('click', () => act('control'));
  pickButtons['walk-in'].addEventListener('click', () => act('walk-in'));
  pickButtons.order.addEventListener('click', () => act('order'));
  soundButton.addEventListener('click', () => act('sound'));
  reshuffleButton.addEventListener('click', () => act('reshuffle'));
  buttons.open.addEventListener('click', () => act('settings'));
  buttons.decrease.addEventListener('click', () => act('decrease'));
  buttons.increase.addEventListener('click', () => act('increase'));
  buttons.reset.addEventListener('click', () => act('reset'));
  buttons.back.addEventListener('click', () => act('back'));

  enter(flow, performance.now(), link.minute);
  const frame = (now: number): void => {
    tick(now);
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
