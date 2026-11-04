import type {Sprite} from './sprite';

// Every sprite here was drawn for this project. Digits are shades 0-3, '.' is transparent.

/** A staff member in an apron, seen from the front. */
export const STAFF: Sprite = [
  '..0000..',
  '.033330.',
  '.030030.',
  '.033330.',
  '..0110..',
  '.011110.',
  '.011110.',
  '..0..0..',
];

/** A walk-in in a cap and coat. */
export const CUSTOMER: Sprite = [
  '..0000..',
  '.000000.',
  '.033330.',
  '.030030.',
  '..0330..',
  '.022220.',
  '.022220.',
  '..0..0..',
];

/** The speech bubble a walk-in shows as they give up. */
export const BANG: Sprite = [
  '.000.',
  '03030',
  '03030',
  '03030',
  '03330',
  '03030',
  '.000.',
];

/** A delivery van facing right, cab at the front. */
export const VAN: Sprite = [
  '00000000000.....',
  '03333333330000..',
  '033333333303330.',
  '033333333303330.',
  '0333333333000000',
  '0000000000000000',
  '..000.....000...',
  '..000.....000...',
];

/** A stock crate for the back room. */
export const CRATE: Sprite = [
  '00000000',
  '02222220',
  '02000020',
  '02022020',
  '02022020',
  '02000020',
  '02222220',
  '00000000',
];

