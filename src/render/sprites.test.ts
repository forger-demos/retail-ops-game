import {describe, expect, test} from 'bun:test';

import {SPRITE_KEYS} from './palette';
import {shadeOf, SpriteKeyError, TIN} from './sprite';
import * as sprites from './sprites';
import {CUSTOMERS, customerSprite, PERSON_H, PERSON_W, STAFF} from './sprites';

const all = Object.entries({...sprites, TIN}).filter((e): e is [string, readonly string[]] => Array.isArray(e[1]) && typeof e[1][0] === 'string');

describe('sprites', () => {
  test('every sprite is a rectangle of palette keys and transparency', () => {
    const ok = new RegExp(`^[${SPRITE_KEYS}.]+$`);
    expect(all.length).toBeGreaterThan(5);
    for (const [name, rows] of all) {
      const width = rows[0]?.length ?? 0;
      expect({name, width: width > 0}).toEqual({name, width: true});
      for (const row of rows) expect({name, row, ok: row.length === width && ok.test(row)}).toEqual({name, row, ok: true});
    }
  });

  test('people share one size, and every customer looks different from the others and from staff', () => {
    for (const p of [STAFF, ...CUSTOMERS]) expect([p.length, p[0]?.length]).toEqual([PERSON_H, PERSON_W]);
    expect(CUSTOMERS.length).toBeGreaterThanOrEqual(4);
    const looks = new Set([STAFF, ...CUSTOMERS].map(p => p.join('/')));
    expect(looks.size).toBe(CUSTOMERS.length + 1);
  });

  test('a walk-in keeps one look, and neighbours in the queue differ', () => {
    expect(customerSprite(7)).toBe(customerSprite(7));
    for (let i = 0; i < 20; i++) expect(customerSprite(i)).not.toBe(customerSprite(i + 1));
  });

  test('an unknown key is an error, not a silent colour', () => {
    expect(shadeOf('f')).toBe(15);
    expect(() => shadeOf('z')).toThrow(SpriteKeyError);
  });
});
