import type {Plot} from './font';
import type {Shade} from './palette';

/** A sprite is rows of shade digits 0-3; '.' is transparent. */
export type Sprite = readonly string[];

export function drawSprite(plot: Plot, sprite: Sprite, x: number, y: number, size = 1): void {
  sprite.forEach((row, sy) => {
    for (let sx = 0; sx < row.length; sx++) {
      const c = row[sx];
      if (c === undefined || c === '.') continue;
      plot(x + sx * size, y + sy * size, size, size, Number(c) as Shade);
    }
  });
}

// Drawn for this project: a paint tin with a wire handle and a label.
export const TIN: Sprite = [
  '....00000000....',
  '...0........0...',
  '..0..........0..',
  '..0000000000000.',
  '.01111111111110.',
  '.02222222222220.',
  '.02233333333220.',
  '.02230000003220.',
  '.02230111103220.',
  '.02230111103220.',
  '.02230000003220.',
  '.02233333333220.',
  '.02222222222220.',
  '.01111111111110.',
  '..000000000000..',
  '................',
];
