import {readFileSync} from 'fs';
import {join} from 'path';

import {describe, expect, test} from 'bun:test';

import {PALETTE_TOKENS, PaletteError, readPalette} from './palette';

describe('readPalette', () => {
  test('reads the four tokens darkest first, trimmed', () => {
    const values: Record<string, string> = {'--gb-0': ' a', '--gb-1': 'b ', '--gb-2': 'c', '--gb-3': 'd'};
    expect(readPalette(t => values[t] ?? '')).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a missing token is an error naming it', () => {
    expect(() => readPalette(t => (t === '--gb-2' ? '' : 'x'))).toThrow(PaletteError);
    expect(() => readPalette(t => (t === '--gb-2' ? '' : 'x'))).toThrow('--gb-2');
  });

  test('tokens.css defines every palette token', () => {
    const css = readFileSync(join(import.meta.dir, '../styles/tokens.css'), 'utf8');
    for (const token of PALETTE_TOKENS) expect(css).toContain(`${token}:`);
  });
});
