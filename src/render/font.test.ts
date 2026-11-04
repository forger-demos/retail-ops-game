import {describe, expect, test} from 'bun:test';

import {ADVANCE, drawText, GLYPH_HEIGHT, GLYPH_WIDTH, GLYPHS, textWidth, UnknownGlyphError} from './font';

describe('font', () => {
  test('every glyph is a 5x7 grid of ink and paper', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect({ch, height: rows.length}).toEqual({ch, height: GLYPH_HEIGHT});
      for (const row of rows) expect({ch, row: /^[#.]{5}$/.test(row)}).toEqual({ch, row: true});
    }
  });

  test('covers A-Z and 0-9', () => {
    for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') expect(GLYPHS[ch]).toBeDefined();
  });

  test('textWidth drops the trailing gap and scales', () => {
    expect(textWidth('')).toBe(0);
    expect(textWidth('A')).toBe(GLYPH_WIDTH);
    expect(textWidth('AB', 2)).toBe((2 * ADVANCE - 1) * 2);
  });

  test('drawText plots every inked cell, offset per glyph, at the given size', () => {
    const plotted: [number, number, number, number, number][] = [];
    drawText((x, y, w, h, s) => plotted.push([x, y, w, h, s]), 'I-', 10, 20, 0, 2);
    const ink = (ch: string): number => (GLYPHS[ch] ?? []).join('').split('#').length - 1;
    expect(plotted.length).toBe(ink('I') + ink('-'));
    expect(plotted).toContainEqual([10 + 1 * 2, 20, 2, 2, 0]);
    expect(plotted).toContainEqual([10 + ADVANCE * 2, 20 + 3 * 2, 2, 2, 0]);
  });

  test('lower case draws as upper case; an unknown character is an error', () => {
    const count = (t: string): number => {
      let n = 0;
      drawText(() => n++, t, 0, 0, 0);
      return n;
    };
    expect(count('paint')).toBe(count('PAINT'));
    expect(() => drawText(() => undefined, '?', 0, 0, 0)).toThrow(UnknownGlyphError);
  });
});
