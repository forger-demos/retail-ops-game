import type {Mode} from '../flow/flow';
import {drawText, textWidth, type Plot} from '../render/font';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {drawSprite, TIN} from '../render/sprite';

export const TITLE = 'PAINT RUSH';
export const BLINK_MS = 500;
/** The prompt holds steady first, so it is read before it starts to blink. */
export const HOLD_MS = 2000;

const centred = (text: string, size: number): number => Math.floor((SCREEN_WIDTH - textWidth(text, size)) / 2);

/** Whether the prompt shows at this moment; reduced motion keeps it on. */
export function promptVisible(elapsedMs: number, reducedMotion: boolean): boolean {
  return reducedMotion || elapsedMs < HOLD_MS || Math.floor((elapsedMs - HOLD_MS) / BLINK_MS) % 2 === 0;
}

export const MODES: readonly {mode: Mode; label: string}[] = [
  {mode: 'play', label: 'PLAY'},
  {mode: 'presenter', label: 'PRESENTER'},
];
const MODE_GAP = 12;
const MODE_Y = 90;

/** Left edge of each mode's label, the pair centred on the screen. */
export function modeLayout(): number[] {
  const total = MODES.reduce((w, m) => w + textWidth(m.label), 0) + MODE_GAP * (MODES.length - 1);
  let x = Math.floor((SCREEN_WIDTH - total) / 2);
  return MODES.map(m => {
    const at = x;
    x += textWidth(m.label) + MODE_GAP;
    return at;
  });
}

/** Both modes, the chosen one drawn reversed out of a dark box so it reads at a glance. */
function drawModes(plot: Plot, chosen: Mode): void {
  const xs = modeLayout();
  MODES.forEach((m, i) => {
    const x = xs[i] ?? 0;
    const on = m.mode === chosen;
    if (on) plot(x - 3, MODE_Y - 3, textWidth(m.label) + 6, 13, 0);
    drawText(plot, m.label, x, MODE_Y, on ? 3 : 1);
  });
}

export function drawTitle(plot: Plot, prompt: string, showPrompt: boolean, hint = '', mode: Mode = 'play'): void {
  plot(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3);
  plot(4, 4, SCREEN_WIDTH - 8, 2, 0);
  plot(4, SCREEN_HEIGHT - 6, SCREEN_WIDTH - 8, 2, 0);
  plot(4, 4, 2, SCREEN_HEIGHT - 8, 0);
  plot(SCREEN_WIDTH - 6, 4, 2, SCREEN_HEIGHT - 8, 0);

  drawText(plot, TITLE, centred(TITLE, 2) + 1, 23, 1, 2);
  drawText(plot, TITLE, centred(TITLE, 2), 22, 0, 2);
  drawSprite(plot, TIN, (SCREEN_WIDTH - 32) / 2, 46, 2);
  drawModes(plot, mode);
  if (showPrompt) drawText(plot, prompt, centred(prompt, 1), 108, 0, 1);
  if (hint !== '') drawText(plot, hint, centred(hint, 1), 122, 1, 1);
}
