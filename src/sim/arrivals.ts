import type {Params, TinSize, WalkInKind} from './params';
import {TIN_SIZES} from './params';
import {createRng, deriveSeed, exponential, intBetween, weightedPick} from './rng';

export interface WalkInArrival {
  id: number;
  at: number;
  kind: WalkInKind;
  valueGbp: number;
}

export interface MixOrderArrival {
  id: number;
  at: number;
  tins: readonly TinSize[];
  valueGbp: number;
}

export interface Arrivals {
  walkIns: readonly WalkInArrival[];
  mixOrders: readonly MixOrderArrival[];
}

const WALK_IN_STREAM = 1;
const MIX_ORDER_STREAM = 2;
/** Its own stream, so the walk-in times and the mix orders of a seed do not move when types are drawn. */
const WALK_IN_TYPE_STREAM = 3;

/**
 * Every random draw of a shift happens here, before any scenario runs (ADR 0001),
 * so both scenarios replay the same arrivals. Arrivals land on whole shop minutes,
 * which keeps every timeline time an exact integer and equal-time ties meaningful.
 */
export function drawArrivals(seed: number, params: Params): Arrivals {
  const walkInRng = createRng(deriveSeed(seed, WALK_IN_STREAM));
  const typeRng = createRng(deriveSeed(seed, WALK_IN_TYPE_STREAM));
  const walkIns: WalkInArrival[] = [];
  if (params.walkInsPerHour > 0) {
    for (let at = exponential(walkInRng, params.walkInsPerHour / 60); at < params.shiftMinutes; at += exponential(walkInRng, params.walkInsPerHour / 60)) {
      const type = weightedPick(typeRng, params.walkInTypes, t => t.share);
      walkIns.push({id: walkIns.length, at: Math.floor(at), kind: type.kind, valueGbp: type.valueGbp});
    }
  }

  const orderRng = createRng(deriveSeed(seed, MIX_ORDER_STREAM));
  const mixOrders: MixOrderArrival[] = [];
  if (params.mixOrdersPerHour > 0) {
    for (let at = exponential(orderRng, params.mixOrdersPerHour / 60); at < params.shiftMinutes; at += exponential(orderRng, params.mixOrdersPerHour / 60)) {
      const band = weightedPick(orderRng, params.orderSizeMix, b => b.share);
      const count = intBetween(orderRng, band.minTins, band.maxTins);
      const tins: TinSize[] = [];
      for (let i = 0; i < count; i++) tins.push(weightedPick(orderRng, TIN_SIZES, size => params.tinSizeMix[size]));
      const valueGbp = tins.reduce((sum, size) => sum + params.tinPricesGbp[size], 0);
      mixOrders.push({id: mixOrders.length, at: Math.floor(at), tins, valueGbp});
    }
  }

  return {walkIns, mixOrders};
}
