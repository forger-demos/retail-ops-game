import {describe, expect, test} from 'bun:test';

import {fittingScale, integerScale, SCREEN_HEIGHT, SCREEN_WIDTH} from './screen-size';

describe('integerScale', () => {
  test('picks the largest whole factor that fits both axes', () => {
    expect(integerScale(1280, 800)).toBe(5);
    expect(integerScale(390, 844)).toBe(2);
    expect(integerScale(1920, 1080)).toBe(7);
  });

  test('the scaled screen fits the viewport it was computed for', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1280, 800], [1366, 768], [320, 568]] as const) {
      const s = integerScale(w, h);
      expect(SCREEN_WIDTH * s).toBeLessThanOrEqual(w);
      expect(SCREEN_HEIGHT * s).toBeLessThanOrEqual(h);
      expect(SCREEN_WIDTH * (s + 1) > w || SCREEN_HEIGHT * (s + 1) > h).toBe(true);
    }
  });

  test('never drops below 1 on a viewport smaller than the screen', () => {
    expect(integerScale(100, 100)).toBe(1);
    expect(integerScale(0, 0)).toBe(1);
  });
});

describe('fittingScale', () => {
  test('steps down from the viewport scale to the largest one the frame fits around', () => {
    const tried: number[] = [];
    const frameW = 60;
    const scale = fittingScale(390, 844, s => {
      tried.push(s);
      return SCREEN_WIDTH * s + frameW <= 390;
    });
    expect(scale).toBe(2);
    expect(tried).toEqual([2]);
    expect(fittingScale(1280, 800, s => SCREEN_HEIGHT * s + 200 <= 800)).toBe(4);
  });

  test('falls back to 1 when nothing fits', () => {
    expect(fittingScale(1280, 800, () => false)).toBe(1);
  });
});
