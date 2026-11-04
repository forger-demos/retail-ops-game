export const TIN_SIZES = ['750ml', '2.5L', '5L'] as const;
export type TinSize = (typeof TIN_SIZES)[number];

export type ScenarioName = 'today' | 'hub';

/** One band of the order-size mix: orders of `minTins`..`maxTins` tins, drawn with weight `share`. */
export interface OrderSizeBand {
  minTins: number;
  maxTins: number;
  share: number;
}

/** Everything that shapes a shift. Times are shop minutes, money is GBP. */
export interface Params {
  shiftMinutes: number;
  staff: number;
  walkInsPerHour: number;
  serviceMinutes: number;
  averageSaleGbp: number;
  patienceMinutes: number;
  mixOrdersPerHour: number;
  minutesPerTin: number;
  orderSizeMix: readonly OrderSizeBand[];
  tinPricesGbp: Readonly<Record<TinSize, number>>;
  /** Weight of each tin size when a tin is drawn; the default split puts the average tin near GBP95. */
  tinSizeMix: Readonly<Record<TinSize, number>>;
  /** Orders with more tins than this go to the hub in the `hub` scenario. */
  hubThresholdTins: number;
  hubDeliveryMinutes: number;
}

export const DEFAULT_PARAMS: Params = {
  shiftMinutes: 8 * 60,
  staff: 1,
  walkInsPerHour: 10,
  serviceMinutes: 4,
  averageSaleGbp: 95,
  patienceMinutes: 10,
  mixOrdersPerHour: 3,
  minutesPerTin: 5,
  orderSizeMix: [
    {minTins: 1, maxTins: 1, share: 0.55},
    {minTins: 2, maxTins: 3, share: 0.25},
    {minTins: 4, maxTins: 5, share: 0.12},
    {minTins: 6, maxTins: 12, share: 0.08},
  ],
  tinPricesGbp: {'750ml': 45, '2.5L': 85, '5L': 120},
  tinSizeMix: {'750ml': 15, '2.5L': 40, '5L': 45},
  hubThresholdTins: 5,
  hubDeliveryMinutes: 120,
};

export function withParams(overrides: Partial<Params> = {}): Params {
  return {...DEFAULT_PARAMS, ...overrides};
}
