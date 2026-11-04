import {describe, expect, test} from 'bun:test';
import {DEFAULT_PARAMS} from './params';
import type {Command, PlayAction, Round} from './round';
import {DEFAULT_ROUND_SECONDS, OPENING_ORDER, OPENING_ORDER_TINS, OPENING_WALK_INS, optionsAt, playRound, press, roundMinutes, setupRound} from './round';
import type {TimelineEvent} from './timeline';

const SEED = 1;
const today = setupRound('today', SEED, DEFAULT_PARAMS, DEFAULT_ROUND_SECONDS);
const hub = setupRound('hub', SEED, DEFAULT_PARAMS, DEFAULT_ROUND_SECONDS);

const ofType = <T extends TimelineEvent['type']>(timeline: readonly TimelineEvent[], type: T) =>
  timeline.filter((e): e is Extract<TimelineEvent, {type: T}> => e.type === type);

/** Presses each action at its minute through `press`, as the buttons do; a press the shop refuses is dropped. */
function play(round: Round, script: readonly [number, PlayAction][]): readonly Command[] {
  let commands: readonly Command[] = [];
  for (const [at, action] of script) commands = press(round, commands, action, at).commands;
  return commands;
}

/** A player who serves whoever is waiting whenever the assistant is free, every half minute. */
function serveEveryone(round: Round, first: readonly Command[] = [], from = 0): readonly Command[] {
  let commands = first;
  for (let at = from; at < round.minutes; at += 0.5) commands = press(round, commands, 'serve', at).commands;
  return commands;
}

const reason = (round: Round, commands: readonly Command[], minute: number, action: PlayAction) =>
  optionsAt(round, commands, minute).find(o => o.action === action)?.reason;

describe('setting up a round', () => {
  test('both rounds face identical arrivals for one seed', () => {
    expect(hub.arrivals).toEqual(today.arrivals);
    expect(hub.minutes).toBe(roundMinutes(DEFAULT_ROUND_SECONDS));
    expect(setupRound('today', 2, DEFAULT_PARAMS, DEFAULT_ROUND_SECONDS).arrivals).not.toEqual(today.arrivals);
  });

  test('the scripted trade order is at the till at minute 0, and the queue starts behind it', () => {
    const [first] = today.arrivals.mixOrders;
    expect(first).toMatchObject({id: OPENING_ORDER, at: 0});
    expect(first?.tins).toHaveLength(OPENING_ORDER_TINS);
    for (const at of OPENING_WALK_INS) expect(today.arrivals.walkIns.some(w => w.at === at)).toBe(true);
    const {timeline} = playRound(today, []);
    expect(timeline[0]).toEqual({type: 'order-arrive', at: 0, order: OPENING_ORDER, tins: first?.tins ?? []});
  });

  test('a round always has one assistant, whatever the settings say', () => {
    expect(setupRound('today', SEED, {...DEFAULT_PARAMS, staff: 3}, 30).params.staff).toBe(1);
  });
});

describe('MIX N TINS', () => {
  test('takes the assistant off the floor for N tins, and nobody can be served meanwhile', () => {
    const commands = play(today, [[0, 'mix']]);
    const {timeline, result} = playRound(today, commands);
    const mix = ofType(timeline, 'mix-start')[0];
    expect(mix).toMatchObject({at: 0, tins: OPENING_ORDER_TINS, until: OPENING_ORDER_TINS * DEFAULT_PARAMS.minutesPerTin});
    expect(reason(today, commands, 10, 'serve')).toBe('busy-mixing');
    expect(reason(today, commands, 10, 'mix')).toBe('busy-mixing');
    for (const arrive of ofType(timeline, 'walk-in-arrive').filter(e => e.at < (mix?.until ?? 0))) expect(arrive.staffOnFloor).toBe(0);
    expect(result.unmannedMinutes).toBe(OPENING_ORDER_TINS * DEFAULT_PARAMS.minutesPerTin);
    expect(result.walkedOut).toBeGreaterThan(0);
  });

  test('time unmanned stops at the end of the round', () => {
    const short = setupRound('today', SEED, DEFAULT_PARAMS, 10);
    const {result} = playRound(short, play(short, [[0, 'mix']]));
    expect(short.minutes).toBeLessThan(OPENING_ORDER_TINS * DEFAULT_PARAMS.minutesPerTin);
    expect(result.unmannedMinutes).toBe(short.minutes);
  });
});

describe('SERVE', () => {
  test('serves the longest-waiting walk-in for the service time, and needs someone waiting', () => {
    expect(reason(today, [], 0, 'serve')).toBe('nobody-waiting');
    const commands = play(today, [[1, 'serve']]);
    const served = ofType(playRound(today, commands).timeline, 'walk-in-served');
    expect(served).toEqual([{type: 'walk-in-served', at: 1, walkIn: 1, staff: 0, until: 1 + DEFAULT_PARAMS.serviceMinutes}]);
    expect(reason(today, commands, 2, 'serve')).toBe('busy-serving');
  });

  test('a press the shop cannot take changes nothing', () => {
    expect(press(today, [], 'serve', 0)).toEqual({commands: [], reason: 'nobody-waiting'});
    expect(press(today, [], 'hub', 0)).toEqual({commands: [], reason: 'round-over'});
    expect(press(today, [], 'mix', today.minutes)).toEqual({commands: [], reason: 'round-over'});
  });
});

describe('SEND TO HUB', () => {
  test('is offered only in the hub round', () => {
    expect(optionsAt(today, [], 0).map(o => o.action)).toEqual(['serve', 'mix']);
    expect(optionsAt(hub, [], 0).map(o => o.action)).toEqual(['serve', 'mix', 'hub']);
  });

  test('is available only for an order over the hub threshold', () => {
    expect(optionsAt(hub, [], 0).find(o => o.action === 'hub')).toEqual({action: 'hub', reason: null, tins: OPENING_ORDER_TINS});
    const small = setupRound('hub', SEED, {...DEFAULT_PARAMS, hubThresholdTins: OPENING_ORDER_TINS}, DEFAULT_ROUND_SECONDS);
    expect(reason(small, [], 0, 'hub')).toBe('small-order');
    expect(reason(small, [], 0, 'mix')).toBeNull();
  });

  test('keeps the assistant at the till: the next walk-in can be served at once', () => {
    const commands = play(hub, [[0, 'hub'], [1, 'serve']]);
    const {timeline, result} = playRound(hub, commands);
    expect(ofType(timeline, 'hub-dispatch')[0]).toMatchObject({at: 0, order: OPENING_ORDER, tins: OPENING_ORDER_TINS, deliveryAt: DEFAULT_PARAMS.hubDeliveryMinutes});
    expect(ofType(timeline, 'walk-in-served')[0]).toMatchObject({at: 1});
    expect(ofType(timeline, 'mix-start')).toEqual([]);
    expect(result).toMatchObject({sentToHub: 1, tinsSentToHub: OPENING_ORDER_TINS, unmannedMinutes: 0});
  });
});

describe('round results', () => {
  test('come from the simulation metrics of the choices made, and replay identically', () => {
    const commands = play(today, [[0, 'mix']]);
    const once = playRound(today, commands);
    expect(playRound(today, commands)).toEqual(once);
    const {metrics} = once.result;
    expect(once.result).toMatchObject({served: metrics.walkInsServed, walkedOut: metrics.walkInsLost, lostGbp: metrics.salesLostGbp});
    expect(once.result.capturedGbp).toBe(metrics.walkInsServed * DEFAULT_PARAMS.averageSaleGbp + (today.arrivals.mixOrders[0]?.valueGbp ?? 0));
  });

  test('sending the trade order to the hub loses fewer walk-ins than mixing it, for the same arrivals and the same serving', () => {
    const mixed = playRound(today, serveEveryone(today, play(today, [[0, 'mix']]), 0)).result;
    const sent = playRound(hub, serveEveryone(hub, play(hub, [[0, 'hub']]), 0)).result;
    expect(sent.walkedOut).toBeLessThan(mixed.walkedOut);
    expect(sent.capturedGbp).toBeGreaterThan(mixed.capturedGbp);
    expect(sent.unmannedMinutes).toBeLessThan(mixed.unmannedMinutes);
  });

  test('an order nobody mixes is a sale not made', () => {
    const {result} = playRound(today, serveEveryone(today));
    expect(result.ordersLeft).toBeGreaterThanOrEqual(1);
    expect(result.capturedGbp).toBe(result.served * DEFAULT_PARAMS.averageSaleGbp);
  });

  test('a walk-in served exactly at the patience limit is not lost', () => {
    const commands = play(today, [[1 + DEFAULT_PARAMS.patienceMinutes, 'serve']]);
    const {timeline} = playRound(today, commands);
    expect(ofType(timeline, 'walk-in-served')[0]).toMatchObject({walkIn: 1});
    expect(ofType(timeline, 'walk-in-lost').some(e => e.walkIn === 1)).toBe(false);
  });

  test('the timeline is ordered by time and ends with the round', () => {
    const {timeline} = playRound(today, serveEveryone(today, play(today, [[0, 'mix']])));
    for (let i = 1; i < timeline.length; i++) expect(timeline[i]?.at).toBeGreaterThanOrEqual(timeline[i - 1]?.at ?? 0);
    for (const e of timeline) expect(e.at).toBeLessThan(today.minutes);
  });
});
