import {describe, expect, test} from 'bun:test';

import {MS_PER_CHAR, revealed, TEXTBOX, TextTooLongError, wrap, drawTextbox} from './textbox';

describe('text box', () => {
  test('wraps on words within the width', () => {
    expect(wrap('NOBODY ON THE FLOOR...', 10)).toEqual(['NOBODY ON', 'THE', 'FLOOR...']);
    expect(wrap('  A  B ', 10)).toEqual(['A B']);
    expect(wrap('')).toEqual([]);
    expect(() => wrap('ABCDEFGHIJK', 10)).toThrow(TextTooLongError);
  });

  test('types out over time unless motion is reduced', () => {
    expect(revealed('HELLO', 0, false)).toBe(0);
    expect(revealed('HELLO', MS_PER_CHAR * 2, false)).toBe(2);
    expect(revealed('HELLO', 1e6, false)).toBe(5);
    expect(revealed('HELLO', 0, true)).toBe(5);
  });

  test('draws inside its box, and fewer characters draw less', () => {
    const count = (chars: number): number => {
      let n = 0;
      drawTextbox((x, y, w, h) => {
        n++;
        expect(x >= TEXTBOX.x && y >= TEXTBOX.y && x + w <= TEXTBOX.x + TEXTBOX.w && y + h <= TEXTBOX.y + TEXTBOX.h).toBe(true);
      }, 'CUSTOMER LEFT! -GBP95', chars);
      return n;
    };
    expect(count(3)).toBeLessThan(count(21));
    expect(count(0)).toBe(3);
  });
});
