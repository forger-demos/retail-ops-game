import {describe, expect, test} from 'bun:test';

import {isShade} from '../render/palette';

import {promptsFor} from '../render/prompts';
import {SCREEN_HEIGHT, SCREEN_WIDTH} from '../render/screen-size';
import {BLINK_MS, drawTitle, HOLD_MS, promptVisible} from './title';

type Call = [number, number, number, number, number];

const draw = (showPrompt: boolean, prompt = promptsFor('keyboard').title): Call[] => {
  const calls: Call[] = [];
  drawTitle((x, y, w, h, s) => calls.push([x, y, w, h, s]), prompt, showPrompt);
  return calls;
};

describe('title screen', () => {
  test('starts by filling the whole screen and stays inside it', () => {
    const calls = draw(true);
    expect(calls[0]).toEqual([0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 3]);
    for (const [x, y, w, h] of calls) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(y + h).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });

  test('the touch prompt stays inside the screen', () => {
    for (const [x, , w] of draw(true, promptsFor('touch').title)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(SCREEN_WIDTH);
    }
  });

  test('uses only palette colours', () => {
    for (const [, , , , s] of draw(true)) expect(isShade(s)).toBe(true);
  });

  test('hiding the prompt draws less', () => {
    expect(draw(false).length).toBeLessThan(draw(true).length);
  });

  test('the prompt holds steady, then blinks, unless motion is reduced', () => {
    expect(promptVisible(0, false)).toBe(true);
    expect(promptVisible(HOLD_MS - 1, false)).toBe(true);
    expect(promptVisible(HOLD_MS, false)).toBe(true);
    expect(promptVisible(HOLD_MS + BLINK_MS, false)).toBe(false);
    expect(promptVisible(HOLD_MS + BLINK_MS * 2, false)).toBe(true);
    expect(promptVisible(HOLD_MS + BLINK_MS, true)).toBe(true);
  });

  test('the settings hint is drawn under the prompt and stays inside the screen', () => {
    const hint = 'S: SETTINGS';
    const calls: Call[] = [];
    drawTitle((x, y, w, h, s) => calls.push([x, y, w, h, s]), 'PRESS SPACE', true, hint);
    expect(calls.length).toBeGreaterThan(draw(true).length);
    for (const [x, y, w, h] of calls) {
      expect(x + w).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(y + h).toBeLessThanOrEqual(SCREEN_HEIGHT);
    }
  });
});
