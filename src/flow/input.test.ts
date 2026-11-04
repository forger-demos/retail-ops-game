import {describe, expect, test} from 'bun:test';

import {keyAction, REPEATABLE, TAP_GAP_MS, tapAccepted} from './input';

describe('input actions', () => {
  test('SPACE advances, R reshuffles, other keys do nothing', () => {
    expect(keyAction('Space')).toBe('advance');
    expect(keyAction('KeyR')).toBe('reshuffle');
    expect(keyAction('KeyM')).toBeNull();
  });

  test('S opens the menu, the arrows move and change values, Enter and Escape go back', () => {
    expect(keyAction('KeyS')).toBe('settings');
    expect(keyAction('KeyC')).toBe('control');
    expect(keyAction('KeyW')).toBe('walk-in');
    expect(keyAction('KeyO')).toBe('order');
    expect(keyAction('ArrowUp')).toBe('up');
    expect(keyAction('ArrowDown')).toBe('down');
    expect(keyAction('ArrowLeft')).toBe('decrease');
    expect(keyAction('ArrowRight')).toBe('increase');
    expect(keyAction('Enter')).toBe('back');
    expect(keyAction('Escape')).toBe('back');
  });

  test('only the arrows repeat when held', () => {
    expect([...REPEATABLE].sort()).toEqual(['decrease', 'down', 'increase', 'up']);
  });

  test('the first tap always counts', () => {
    expect(tapAccepted(null, 0)).toBe(true);
  });

  test('a second tap inside the gap is a double tap and is ignored', () => {
    expect(tapAccepted(1000, 1000 + TAP_GAP_MS - 1)).toBe(false);
    expect(tapAccepted(1000, 1000 + 150)).toBe(false);
  });

  test('a tap after the gap counts again', () => {
    expect(tapAccepted(1000, 1000 + TAP_GAP_MS)).toBe(true);
  });
});
