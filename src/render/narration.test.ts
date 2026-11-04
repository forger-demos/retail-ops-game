import {describe, expect, test} from 'bun:test';

import {compare} from '../sim/engine';
import {DEFAULT_PARAMS} from '../sim/params';
import {GLYPHS} from './font';
import {beatAt, BEAT_GAP_MINUTES, deliveryLabel, narrationBeats, nextBeatAfter} from './narration';
import {TEXTBOX_CHARS, TEXTBOX_LINES, wrap} from './textbox';

const SEEDS = [1, 2, 3, 7, 42];

describe('narration', () => {
  test('every beat fits the text box in drawable glyphs', () => {
    for (const seed of SEEDS) {
      const c = compare(seed, DEFAULT_PARAMS);
      for (const run of [c.today, c.hub]) {
        for (const beat of narrationBeats(run.scenario, run.timeline, DEFAULT_PARAMS)) {
          expect({text: beat.text, lines: wrap(beat.text).length <= TEXTBOX_LINES}).toEqual({text: beat.text, lines: true});
          for (const ch of beat.text) expect({ch, known: GLYPHS[ch] !== undefined}).toEqual({ch, known: true});
        }
      }
    }
    expect(TEXTBOX_CHARS).toBe(25);
  });

  test('opens on the scenario and closes on the lost sales', () => {
    const c = compare(1, DEFAULT_PARAMS);
    const beats = narrationBeats('today', c.today.timeline, DEFAULT_PARAMS);
    expect(beats[0]).toEqual({at: 0, text: 'TODAY. EVERY TIN IS MIXED IN THE SHOP.'});
    expect(beats.at(-1)).toEqual({at: DEFAULT_PARAMS.shiftMinutes, text: `CLOSING TIME. ${c.today.metrics.walkInsLost} WALKED OUT. GBP${c.today.metrics.salesLostGbp} LOST.`});
    expect(narrationBeats('hub', c.hub.timeline, DEFAULT_PARAMS)[0]?.text).toBe('ORDERS OVER 5 TINS GO TO THE HUB.');
  });

  test('beats are in order and spaced for reading', () => {
    const c = compare(1, DEFAULT_PARAMS);
    const beats = narrationBeats('today', c.today.timeline, DEFAULT_PARAMS).slice(0, -1);
    for (let i = 1; i < beats.length; i++) expect((beats[i]?.at ?? 0) - (beats[i - 1]?.at ?? 0)).toBeGreaterThanOrEqual(BEAT_GAP_MINUTES);
  });

  test('narrates orders, walk-outs and an empty floor; the hub run narrates its dispatches', () => {
    const c = compare(1, DEFAULT_PARAMS);
    const today = narrationBeats('today', c.today.timeline, DEFAULT_PARAMS).map(b => b.text);
    expect(today.some(t => /^A CUSTOMER WANTS \d+ TINS? MIXED!$/.test(t))).toBe(true);
    expect(today.some(t => /^CUSTOMER LEFT! -GBP95$/.test(t))).toBe(true);
    expect(today).toContain('NOBODY ON THE FLOOR...');
    const hub = narrationBeats('hub', c.hub.timeline, DEFAULT_PARAMS).map(b => b.text);
    expect(hub.some(t => /^\d+ TINS SENT TO THE HUB\. 2H DELIVERY\.$/.test(t))).toBe(true);
  });

  test('looks up the current and next beat', () => {
    const beats = [{at: 0, text: 'A'}, {at: 20, text: 'B'}, {at: 480, text: 'C'}];
    expect(beatAt(beats, 0)?.text).toBe('A');
    expect(beatAt(beats, 19.9)?.text).toBe('A');
    expect(beatAt(beats, 20)?.text).toBe('B');
    expect(nextBeatAfter(beats, 20)?.text).toBe('C');
    expect(nextBeatAfter(beats, 480)).toBeNull();
  });

  test('delivery label', () => {
    expect(deliveryLabel(120)).toBe('2H DELIVERY');
    expect(deliveryLabel(90)).toBe('90M DELIVERY');
  });
});
