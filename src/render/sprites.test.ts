import {describe, expect, test} from 'bun:test';

import {TIN} from './sprite';
import * as sprites from './sprites';

describe('sprites', () => {
  test('every sprite is a rectangle of the four shades and transparency', () => {
    for (const [name, rows] of Object.entries({...sprites, TIN})) {
      const width = rows[0]?.length ?? 0;
      expect({name, width: width > 0}).toEqual({name, width: true});
      for (const row of rows) expect({name, row, ok: row.length === width && /^[0-3.]+$/.test(row)}).toEqual({name, row, ok: true});
    }
  });
});
