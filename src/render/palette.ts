/**
 * The screen palette, in sprite-key order: key '0' is the first token, 'a' the eleventh.
 * Scenes name colours through `C`; sprites write one key per pixel.
 */
export const PALETTE_TOKENS = [
  '--px-ink',
  '--px-plum',
  '--px-slate',
  '--px-cream',
  '--px-red',
  '--px-orange',
  '--px-yellow',
  '--px-leaf',
  '--px-forest',
  '--px-blue',
  '--px-sky',
  '--px-brown',
  '--px-tan',
  '--px-skin',
  '--px-pink',
  '--px-teal',
  '--px-mist',
  '--px-mint',
] as const;

/** One character per colour; a sprite row is a string of these, '.' for transparent. */
export const SPRITE_KEYS = '0123456789abcdefgh';

export const C = {
  ink: 0,
  plum: 1,
  slate: 2,
  cream: 3,
  red: 4,
  orange: 5,
  yellow: 6,
  leaf: 7,
  forest: 8,
  blue: 9,
  sky: 10,
  brown: 11,
  tan: 12,
  skin: 13,
  pink: 14,
  teal: 15,
  mist: 16,
  mint: 17,
} as const;

export type Shade = (typeof C)[keyof typeof C];
/** The CSS colour of each shade, indexed by shade. */
export type Palette = readonly string[];

export const PALETTE_SIZE = PALETTE_TOKENS.length;

export function isShade(n: number): n is Shade {
  return Number.isInteger(n) && n >= 0 && n < PALETTE_SIZE;
}

export class PaletteError extends Error {}

/** Reads the palette through a custom-property lookup, so a missing token fails loudly instead of drawing black. */
export function readPalette(lookup: (token: string) => string): Palette {
  return PALETTE_TOKENS.map(token => {
    const value = lookup(token).trim();
    if (value === '') throw new PaletteError(`design token ${token} is not defined; see src/styles/tokens.css`);
    return value;
  });
}
