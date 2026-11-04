import {describe, expect, test} from 'bun:test';

import {inputMode, promptsFor} from './prompts';
import {TEXTBOX_LINES, wrap} from './textbox';

describe('prompts', () => {
  test('the keyboard says SPACE and touch says TAP', () => {
    expect(promptsFor('keyboard').title).toBe('PRESS SPACE');
    expect(promptsFor('touch').title).toContain('TAP');
    for (const key of ['title', 'results', 'comparison'] as const) {
      expect(promptsFor('touch')[key]).toContain('TAP');
      expect(promptsFor('touch')[key]).not.toContain('SPACE');
    }
    expect(promptsFor('touch').comparison).not.toMatch(/\bR:/);
  });

  test('every text-box prompt fits the box', () => {
    for (const mode of ['keyboard', 'touch'] as const) {
      for (const key of ['results', 'comparison'] as const) expect(wrap(promptsFor(mode)[key]).length).toBeLessThanOrEqual(TEXTBOX_LINES);
    }
  });

  test('touch needs both no hover and a coarse pointer', () => {
    const only = (...hits: string[]) => (q: string) => hits.includes(q);
    expect(inputMode(only('(hover: none)', '(pointer: coarse)'))).toBe('touch');
    expect(inputMode(only('(pointer: coarse)'))).toBe('keyboard');
    expect(inputMode(only('(hover: none)'))).toBe('keyboard');
    expect(inputMode(only())).toBe('keyboard');
  });
});
