import {readFileSync} from 'fs';
import {join} from 'path';

import {describe, expect, test} from 'bun:test';

import {C, isShade, PALETTE_SIZE, PALETTE_TOKENS, PaletteError, readPalette, SPRITE_KEYS} from './palette';

const read = (file: string): string => readFileSync(join(import.meta.dir, '..', file), 'utf8');
const defined = (css: string): Set<string> => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1] ?? ''));

describe('palette', () => {
  test('reads every token in order, trimmed', () => {
    expect(readPalette(t => ` ${t} `)).toEqual([...PALETTE_TOKENS]);
  });

  test('a missing token is an error naming it', () => {
    const lookup = (t: string): string => (t === '--px-teal' ? '' : 'x');
    expect(() => readPalette(lookup)).toThrow(PaletteError);
    expect(() => readPalette(lookup)).toThrow('--px-teal');
  });

  test('every named colour is the token of the same name, and every token has a sprite key', () => {
    expect(Object.entries(C).map(([name, i]) => [PALETTE_TOKENS[i], name])).toEqual(PALETTE_TOKENS.map(t => [t, t.slice('--px-'.length)]));
    expect(SPRITE_KEYS.length).toBe(PALETTE_SIZE);
    expect(new Set(SPRITE_KEYS).size).toBe(PALETTE_SIZE);
  });

  test('isShade accepts exactly the palette indices', () => {
    expect([...Array(PALETTE_SIZE).keys()].every(isShade)).toBe(true);
    for (const n of [-1, PALETTE_SIZE, 1.5, Number.NaN]) expect(isShade(n)).toBe(false);
  });

  test('tokens.css defines every palette token', () => {
    const tokens = defined(read('styles/tokens.css'));
    for (const token of PALETTE_TOKENS) expect(tokens.has(token)).toBe(true);
  });

  test('the page styles write no colour of their own and use only defined tokens', () => {
    const css = read('styles/main.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?)\(/gi)).toBeNull();
    const tokens = defined(read('styles/tokens.css'));
    const used = [...css.matchAll(/var\((--[\w-]+)\)/g)].map(m => m[1] ?? '');
    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(t => !tokens.has(t))).toEqual([]);
  });
});
