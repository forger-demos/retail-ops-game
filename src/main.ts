import {advance, closeSettings, controlAllowed, fromQuery, modeOf, openSettings, replayOf, reshuffle, roundOf, roundResultOf, roundScenario, toggleMode, type FlowState, type RoundNumber, type Step} from './flow/flow';
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
import {drawComparison, drawResults, drawTable} from './scenes/results';
import {playView, RESULT_TITLES, ROUND_HEADINGS, roundAnnouncement, roundComparisonRows, roundRows, ROUNDS_NOTE, ROUNDS_TITLE, roundsAnnouncement, roundsVerdict} from './scenes/play';
import {drawShop} from './scenes/shop';
import {styleFrame} from './scenes/style-frame';
import {drawTitle, promptVisible} from './scenes/title';
import {drawWholeDay, wholeDayAnnouncement} from './scenes/whole-day';
import {DEFAULT_SEED} from './sim/cli';
import {runControlled, type ControlledRun} from './sim/control';
import {drawArrivals} from './sim/arrivals';
import {compare, type Choice, type Comparison, type Decision} from './sim/engine';
import {savings} from './sim/extrapolate';
import {SCREEN_HEIGHT} from './render/screen-size';
import {playButtons, refusal, type PlayButton} from './render/buttons';
import {optionsAt, playRound, press, ROUND_TIME_SCALE, setupRound, type Command, type PlayAction, type PlayedRound, type Round, type RoundResult} from './sim/round';
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
const modeButton = button('mode');
const soundButton = button('sound');
const pickButtons: Readonly<Record<Choice, HTMLButtonElement>> = {'walk-in': button('walk-in'), order: button('order')};
const actions = document.querySelector<HTMLElement>('.actions');
if (!actions) throw new Error('.actions is missing from index.html');
const playButtonEls: Readonly<Record<PlayAction, HTMLButtonElement>> = {serve: button('serve'), mix: button('mix'), hub: button('hub')};
/** Real milliseconds the shift waits for a pick before taking autoplay's, so doing nothing is autoplay. */
const DECISION_MS = 6000;
/** Real milliseconds a refused press's reason stays in the live region, long enough to be read out. */
const REFUSAL_MS = 2500;
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

const modeHint = mode === 'touch' ? 'Use the mode button to switch between play and presenter.' : 'Up and down switch between play and presenter.';
const MODE_TEXT = {
  play: 'Play mode: you play two short rounds as the shop assistant, then watch a whole real day.',
  presenter: 'Presenter mode: the whole real day on autoplay, for narrating.',
} as const;

const LABELS: Readonly<Record<Exclude<Step, 'title'>, string>> = {
  settings: 'Settings menu. Up and down choose a setting, left and right or the minus and plus buttons change it, back returns to the title.',
  today: `Shop scene, ${SCENARIO_TITLES.today}. ${prompts.verb} to skip ahead. ${controlHint}`,
  'today-results': `Today's results. ${prompts.verb} to run the same day with a central hub.`,
  hub: `Shop scene, ${SCENARIO_TITLES.hub}. ${prompts.verb} to skip ahead. ${controlHint}`,
  comparison: `Comparison of today and with a central hub. ${prompts.verb} to replay this day, or use ${reshuffleHint} to reshuffle the day.`,
  'style-frame': `Style frame: the shop at a decisive moment, a still for judging the look. ${prompts.verb} for the title.`,
  'round-1': `Round 1, today: you are the shop assistant and every order is mixed in store. ${prompts.playHint}`,
  'round-1-result': `Round 1 result. ${prompts.verb} to play again with the central hub.`,
  'round-2': `Round 2, with the hub: large orders can be sent to the hub. ${prompts.playHint}`,
  'round-comparison': `Round 1 against round 2. ${prompts.verb} to see a whole real day.`,
  'whole-day': `Now a whole real day. ${prompts.verb} to play it, first as today, then with the hub.`,
};

/** The whole day in play mode is autoplay only, so its labels do not offer take-control. */
function labelFor(state: FlowState): string {
  if (state.step === 'title') return `PAINT RUSH title screen. ${MODE_TEXT[modeOf(state)]} ${prompts.verb} to start. ${modeHint} ${settingsHint}`;
  const label = LABELS[state.step];
  return replayOf(state.step) && !state.presenter ? label.replace(` ${controlHint}`, '') : label;
}

/** A round being played: its presses so far, and the round they give. */
interface Playing {
  n: RoundNumber;
  round: Round;
  commands: readonly Command[];
  played: PlayedRound;
  start: number;
}

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
  let playing: Playing | null = null;
  const results = new Map<RoundNumber, RoundResult>();
  /** What each play button shows, so the DOM is touched only when it changes. */
  let shownButtons = '';
  /** Until then the live region keeps saying why a press was refused, rather than the round's running line. */
  let refusedUntil = 0;

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
    modeButton.hidden = flow.step !== 'title';
    modeButton.textContent = `MODE: ${modeOf(flow).toUpperCase()}`;
    controlButton.hidden = !controlAllowed(flow);
    controlButton.textContent = controlOn ? 'AUTOPLAY' : 'TAKE CONTROL';
    controlButton.setAttribute('aria-pressed', String(controlOn));
    for (const b of Object.values(pickButtons)) b.hidden = !(replaying && deciding());
    actions.hidden = playing === null;
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
    if (!flow.presenter) controlOn = false;
    const n = roundOf(next.step);
    playing = null;
    if (n) {
      const round = setupRound(roundScenario(n), next.seed, params, settings.roundSeconds);
      playing = {n, round, commands: [], played: playRound(round, []), start: now};
      results.delete(n);
      shownButtons = '';
    }
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
    canvas.setAttribute('aria-label', labelFor(flow));
    const resultOf = roundResultOf(flow.step);
    document.body.dataset.scene = replayOf(flow.step) ? 'shop' : flow.step === 'today-results' ? 'results' : n ? 'play' : resultOf ? 'round-result' : flow.step;
    document.body.dataset.step = flow.step;
    document.body.dataset.seed = String(flow.seed);
    syncControls();
    if (flow.step === 'title') announce(`${prompts.title}. ${MODE_TEXT[modeOf(flow)]}`);
    if (flow.step === 'settings') announce(settingsText());
    if (flow.step === 'today-results') announce(resultsAnnouncement(day.today.metrics));
    if (flow.step === 'comparison') announce(comparisonAnnouncement(day, savings(day)));
    if (flow.step === 'style-frame') announce(styleFrame(moment, params).text);
    if (resultOf) announce(roundAnnouncement(resultOf, resultFor(resultOf), labelFor(flow)));
    if (flow.step === 'round-comparison') announce(roundsAnnouncement(resultFor(1), resultFor(2), `${prompts.verb} to see a whole real day.`));
    if (flow.step === 'whole-day') announce(wholeDayAnnouncement(`${prompts.verb} to play it.`));
  };

  /** A round's result; one reached without being played, by link, is the round with no presses. */
  function resultFor(n: RoundNumber): RoundResult {
    const known = results.get(n);
    if (known) return known;
    const result = playRound(setupRound(roundScenario(n), flow.seed, params, settings.roundSeconds), []).result;
    results.set(n, result);
    return result;
  }

  const roundMinute = (p: Playing, now: number): number => shopMinuteAt(now - p.start, ROUND_TIME_SCALE);

  const syncPlayButtons = (p: Playing, minute: number): PlayButton[] => {
    const shown = playButtons(optionsAt(p.round, p.commands, minute), mode, p.round.params.hubThresholdTins);
    const key = JSON.stringify(shown);
    if (key !== shownButtons) {
      shownButtons = key;
      for (const [action, el] of Object.entries(playButtonEls) as [PlayAction, HTMLButtonElement][]) {
        const b = shown.find(x => x.action === action);
        el.hidden = !b;
        if (!b) continue;
        const [label, note] = el.children;
        if (label) label.textContent = b.label;
        if (note) note.textContent = b.note;
        el.setAttribute('aria-disabled', String(!b.enabled));
      }
    }
    return shown;
  };

  /** A press goes through the simulation; one it refuses is said aloud, so a disabled button still answers. */
  const pressPlay = (action: PlayAction, now: number): boolean => {
    const p = playing;
    if (!p) return false;
    const minute = roundMinute(p, now);
    const next = press(p.round, p.commands, action, minute);
    if (next.reason !== null) {
      const shown = syncPlayButtons(p, minute).find(b => b.action === action);
      if (shown) {
        announce(refusal(shown));
        refusedUntil = now + REFUSAL_MS;
      }
      return shown !== undefined;
    }
    playing = {...p, commands: next.commands, played: playRound(p.round, next.commands)};
    return true;
  };

  /** Ends the round when its time is up, keeping the result the presses gave. */
  const tickRound = (now: number): void => {
    const p = playing;
    if (!p || roundMinute(p, now) < p.round.minutes) return;
    results.set(p.n, p.played.result);
    enter(advance(flow), now);
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
    if (!scenario || !controlAllowed(flow)) return;
    if (deciding()) start = now - msFor(pendingNow()?.at ?? 0);
    controlOn = !controlOn;
    if (controlOn && !run) rerun(scenario);
    decidingSince = null;
    syncControls();
    announce(controlOn ? prompts.controlOn : prompts.controlOff);
  };

  const draw = (now: number): void => {
    const scenario = replayOf(flow.step);
    if (flow.step === 'title') drawTitle(s.rect, prompts.title, promptVisible(now - start, reducedMotion.matches), prompts.settingsHint, modeOf(flow));
    else if (flow.step === 'whole-day') drawWholeDay(s.rect, prompts.wholeDay);
    else if (flow.step === 'round-comparison') {
      const [r1, r2] = [resultFor(1), resultFor(2)];
      drawTable(s.rect, {title: ROUNDS_TITLE, headings: ROUND_HEADINGS, rows: roundComparisonRows(r1, r2), below: [roundsVerdict(r1, r2)], note: ROUNDS_NOTE}, prompts.roundsResult);
    }
    else if (flow.step === 'settings') drawSettings(s.rect, editor, remembered);
    else if (flow.step === 'today-results') drawResults(s.rect, todayRows(day.today.metrics), day.today.metrics.salesLostGbp === 0, prompts.results);
    else if (flow.step === 'comparison') drawComparison(s.rect, comparisonRows(day), savingsRows(day, savings(day)), prompts.comparison);
    else if (flow.step === 'style-frame') drawShop(s.rect, {...styleFrame(moment, params), sound: sfx.on});
    else if (playing) {
      const minute = Math.min(roundMinute(playing, now), playing.round.minutes);
      const view = playView(playing.n, playing.round, playing.played.timeline, minute, ROUND_TIME_SCALE, sfx.on);
      for (const name of effectsBetween(playing.played.timeline, heardTo, minute)) sfx.play(name);
      heardTo = minute;
      syncPlayButtons(playing, minute);
      if (now >= refusedUntil) announce(view.text);
      drawShop(s.rect, view);
    } else if (roundResultOf(flow.step)) {
      const n = roundResultOf(flow.step) ?? 1;
      drawResults(s.rect, roundRows(n, resultFor(n)), false, prompts.round1Result, RESULT_TITLES[n]);
    }
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
      return controlAllowed(flow);
    }
    if (flow.step === 'title' && (action === 'mode' || action === 'up' || action === 'down' || action === 'decrease' || action === 'increase')) {
      enter(toggleMode(flow), now);
      announce(MODE_TEXT[modeOf(flow)]);
      return true;
    }
    if (action === 'serve' || action === 'mix' || action === 'hub') return pressPlay(action, now);
    if (playing) return action === 'advance';
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
  modeButton.addEventListener('click', () => act('mode'));
  for (const [action, el] of Object.entries(playButtonEls) as [PlayAction, HTMLButtonElement][]) el.addEventListener('click', () => act(action));
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
    tickRound(now);
    draw(now);
    requestAnimationFrame(frame);
  };
  draw(performance.now());
  requestAnimationFrame(frame);
}
