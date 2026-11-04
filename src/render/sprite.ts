import type {Plot} from './font';
import {SPRITE_KEYS, type Shade} from './palette';

/** A sprite is rows of palette keys (see SPRITE_KEYS); '.' is transparent. */
export type Sprite = readonly string[];

export class SpriteKeyError extends Error {}

export function shadeOf(key: string): Shade {
  const i = SPRITE_KEYS.indexOf(key);
  if (key.length !== 1 || i < 0) throw new SpriteKeyError(`${JSON.stringify(key)} is not a palette key`);
  return i as Shade;
}

export function drawSprite(plot: Plot, sprite: Sprite, x: number, y: number, size = 1): void {
  sprite.forEach((row, sy) => {
    for (let sx = 0; sx < row.length; sx++) {
      const c = row[sx];
      if (c === undefined || c === '.') continue;
      plot(x + sx * size, y + sy * size, size, size, shadeOf(c));
    }
  });
}

// Drawn for this project: a paint tin with a wire handle, a red band and a swatch label.
export const TIN: Sprite = [
  '....00000000....',
  '...0........0...',
  '..0..........0..',
  '.00000000000000.',
  '.0gggggggggggg0.',
  '.02222222222220.',
  '.04444444444440.',
  '.04433333333440.',
  '.04439966553440.',
  '.04439966553440.',
  '.04433333333440.',
  '.04444444444440.',
  '.04444444444440.',
  '.01111111111110.',
  '..000000000000..',
  '................',
];
