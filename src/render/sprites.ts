import {C, SPRITE_KEYS, type Shade} from './palette';
import type {Sprite} from './sprite';

// Every sprite here was drawn for this project. Rows are palette keys, '.' is transparent.

export const PERSON_W = 12;
export const PERSON_H = 16;

/**
 * People are a head on a body, in a shared outline. Capital letters are recoloured per person:
 * H hair, K skin, X and Y hat, S top, A accent (apron, vest, scarf), P legs.
 */
const HEADS = {
  short: ['...000000...', '..0HHHHHH0..', '.0HHHHHHHH0.', '.0HKKKKKKH0.', '.0K0KKKK0K0.', '.0KKKKKKKK0.', '..0KKKKKK0..', '...00KK00...'],
  long: ['...000000...', '..0HHHHHH0..', '.0HHHHHHHH0.', '.0HKKKKKKH0.', '.0H0KKKK0H0.', '.0HKKKKKKH0.', '.0HHKKKKHH0.', '.0HH0KK0HH0.'],
  cap: ['...000000...', '..0XXXXXX0..', '.0XXXXXXXX0.', '0YYYYYYYYYY0', '.0KKKKKKKK0.', '.0K0KKKK0K0.', '..0KKKKKK0..', '...00KK00...'],
  hardhat: ['....0000....', '..00XYYX00..', '.0XXXYYXXX0.', '0XXXXXXXXXX0', '.0HKKKKKKH0.', '.0K0KKKK0K0.', '..0KKKKKK0..', '...00KK00...'],
  balding: ['...000000...', '..0KKKKKK0..', '.0KKKKKKKK0.', '.0HKKKKKKH0.', '.0H0KKKK0H0.', '.0KKKKKKKK0.', '..0KHHHHK0..', '...00KK00...'],
  bun: ['....0000....', '...0HHHH0...', '..00HHHH00..', '.0HHHHHHHH0.', '.0HKKKKKKH0.', '.0K0KKKK0K0.', '..0KKKKKK0..', '...00KK00...'],
} as const;

const BODIES = {
  plain: ['..0SSSSSS0..', '.0SSSSSSSS0.', '0SSSSSSSSSS0', '0KSSSSSSSSK0', '.00PPPPPP00.', '..0PP00PP0..', '..0PP00PP0..', '..000..000..'],
  apron: ['..0SSSSSS0..', '.0SAAAAAAS0.', '0SSAAAAAASS0', '0KSAA33AASK0', '.00AAAAAA00.', '..0PP00PP0..', '..0PP00PP0..', '..000..000..'],
  vest: ['..0SSSSSS0..', '.0AASSSSAA0.', '0AAASSSSAAA0', '0K33333333K0', '.00PPPPPP00.', '..0PP00PP0..', '..0PP00PP0..', '..000..000..'],
  coat: ['..0SSSSSS0..', '.0SSSAASSS0.', '0SSSSAASSSS0', '0KSSSSSSSSK0', '.0SSSSSSSS0.', '.0SSS00SSS0.', '..0PP00PP0..', '..000..000..'],
  dress: ['..0SSSSSS0..', '.0SSSSSSSS0.', '0SSSSSSSSSS0', '0KSSSSSSSSK0', '.0SSSSSSSS0.', '0SSSSSSSSSS0', '..0KK00KK0..', '..000..000..'],
} as const;

type Colours = Partial<Record<'H' | 'K' | 'X' | 'Y' | 'S' | 'A' | 'P', Shade>>;

export function person(head: keyof typeof HEADS, body: keyof typeof BODIES, colours: Colours): Sprite {
  const key = (ch: string): string => {
    const shade = colours[ch as keyof Colours];
    return shade === undefined ? ch : (SPRITE_KEYS[shade] ?? ch);
  };
  return [...HEADS[head], ...BODIES[body]].map(row => [...row].map(key).join(''));
}

/** The shop assistant: the only person in an apron. */
export const STAFF: Sprite = person('short', 'apron', {H: C.brown, K: C.skin, S: C.teal, A: C.orange, P: C.plum});

/** A trade customer in a hard hat and a hi-vis vest; the one with the big mix order. */
export const TRADE: Sprite = person('hardhat', 'vest', {H: C.brown, K: C.tan, X: C.yellow, Y: C.orange, S: C.blue, A: C.orange, P: C.plum});

/** Walk-ins, each visibly different at a glance; a walk-in's number picks one. */
export const CUSTOMERS: readonly Sprite[] = [
  TRADE,
  person('long', 'dress', {H: C.yellow, K: C.skin, S: C.pink}),
  person('cap', 'plain', {X: C.red, Y: C.red, K: C.brown, S: C.leaf, P: C.blue}),
  person('balding', 'coat', {H: C.slate, K: C.skin, S: C.tan, A: C.red, P: C.plum}),
  person('bun', 'plain', {H: C.brown, K: C.tan, S: C.sky, P: C.forest}),
];

export function customerSprite(walkIn: number): Sprite {
  const n = CUSTOMERS.length;
  return CUSTOMERS[((walkIn % n) + n) % n] ?? TRADE;
}

/** The speech bubble a walk-in shows as they give up. */
export const BANG: Sprite = ['.00000.', '0333330', '0334330', '0334330', '0334330', '0333330', '0334330', '.00000.', '..00...'];

/** A delivery van facing right, cab at the front. */
export const VAN: Sprite = [
  '00000000000.....',
  '03333333330000..',
  '0ffffffff30aaa0.',
  '0ffffffff30aaa0.',
  '0333333333000000',
  '0000000000000000',
  '..020.....020...',
  '..000.....000...',
];

/** A stock crate for the back room. */
export const CRATE: Sprite = ['00000000', '0cccccc0', '0cbccbc0', '0ccbbcc0', '0ccbbcc0', '0cbccbc0', '0cccccc0', '00000000'];

/** The tinting machine: colourant canisters on top, dispensing into a tin. */
export const TINTER: Sprite = [
  '.00000000000000.',
  '04455667799eeff0',
  '04455667799eeff0',
  '0000000000000000',
  '0gggggggggggggg0',
  '0g0aaa0ggggg4g70',
  '0g00000gggggggg0',
  '0gggggg00gggggg0',
  '0222222442222220',
  '0211111441111120',
  '0211104444011120',
  '0211104334011120',
  '0211104444011120',
  '0222222222222220',
  '0gggggggggggggg0',
  '0000000000000000',
];

/** The shaker: a tin clamped behind a window. */
export const SHAKER: Sprite = [
  '.00000000000000.',
  '0222222222222220',
  '02gggggggggggg20',
  '02g0000000000g20',
  '02g0aaaaaaaa0g20',
  '02g0a000000a0g20',
  '02g0a044440a0g20',
  '02g0a043340a0g20',
  '02g0a044440a0g20',
  '02g0a000000a0g20',
  '02g0aaaaaaaa0g20',
  '02g0000000000g20',
  '02gggg00ggg47g20',
  '0222222222222220',
  '0000000000000000',
  '.00..........00.',
];

/** The till that sits on the counter. */
export const TILL: Sprite = [
  '...000000...',
  '...0aaaa0...',
  '...000000...',
  '..00000000..',
  '.0222222220.',
  '.0232323220.',
  '.0232323220.',
  '.0222222220.',
  '000000000000',
  '022222222220',
  '000000000000',
];

/** A potted plant. */
export const PLANT: Sprite = [
  '...0..0...',
  '..070070..',
  '.07780770.',
  '0778877870',
  '0787787780',
  '.07887870.',
  '..078870..',
  '...0880...',
  '.00000000.',
  '.0cccccc0.',
  '..0bbbb0..',
  '..0bbbb0..',
  '..0bbbb0..',
  '...0000...',
];
