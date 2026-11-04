/** The four shades, darkest first, as the CSS colour strings the tokens define. */
export type Palette = readonly [string, string, string, string];
export type Shade = 0 | 1 | 2 | 3;

export const PALETTE_TOKENS = ['--gb-0', '--gb-1', '--gb-2', '--gb-3'] as const;

export class PaletteError extends Error {}

/** Reads the palette through a custom-property lookup, so a missing token fails loudly instead of drawing black. */
export function readPalette(lookup: (token: string) => string): Palette {
  const read = (token: string): string => {
    const value = lookup(token).trim();
    if (value === '') throw new PaletteError(`design token ${token} is not defined; see src/styles/tokens.css`);
    return value;
  };
  const [a, b, c, d] = PALETTE_TOKENS;
  return [read(a), read(b), read(c), read(d)];
}
