import {describe, expect, test} from 'bun:test';

import {inputMode, promptsFor} from './prompts';
import {TEXTBOX_LINES, wrap} from './textbox';

describe('prompts', () => {
  test('the keyboard says SPACE and touch says TAP', () => {
    expect(promptsFor('keyboard').title).toBe('PRESS SPACE');
    expect(promptsFor('touch').title).toContain('TAP');
    for (const key of ['title', 'results', 'comparison', 'round1Result', 'round2Result'] as const) {
      expect(promptsFor('touch')[key]).toContain('TAP');
      expect(promptsFor('touch')[key]).not.toContain('SPACE');
    }
    expect(promptsFor('touch').comparison).not.toMatch(/\bR:/);
  });

  test('every text-box prompt fits the box', () => {
    for (const mode of ['keyboard', 'touch'] as const) {
      for (const key of ['results', 'comparison', 'decision', 'controlOn', 'controlOff', 'round1Result', 'round2Result'] as const) expect(wrap(promptsFor(mode)[key]).length).toBeLessThanOrEqual(TEXTBOX_LINES);
    }
  });

  test('the decision prompt names the keys on a keyboard and no keys on touch', () => {
    expect(promptsFor('keyboard').decision).toContain('W:');
    expect(promptsFor('keyboard').decision).toContain('O:');
    expect(promptsFor('touch').decision).not.toMatch(/\b[WOC]:/);
  });

  test('touch needs both no hover and a coarse pointer', () => {
    const only = (...hits: string[]) => (q: string) => hits.includes(q);
    expect(inputMode(only('(hover: none)', '(pointer: coarse)'))).toBe('touch');
    expect(inputMode(only('(pointer: coarse)'))).toBe('keyboard');
    expect(inputMode(only('(hover: none)'))).toBe('keyboard');
    expect(inputMode(only())).toBe('keyboard');
  });

  test('the keyboard title points at S, and the touch title leaves it to the button', () => {
    expect(promptsFor('keyboard').settingsHint).toBe('S: SETTINGS  M: SOUND');
    expect(promptsFor('touch').settingsHint).toBe('');
  });
});
