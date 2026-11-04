import type {Comparison} from './engine';

export const WEEKS_PER_YEAR = 52;

export interface Savings {
  perDayGbp: number;
  perWeekGbp: number;
  perYearGbp: number;
  stores: number;
  acrossStoresGbp: number;
}

/** One shift's saving scaled up; a week is a 52nd of the trading year, so a shop shut on some days still adds up. */
export function savings(c: Comparison): Savings {
  const {tradingDaysPerYear, stores} = c.params;
  const perDayGbp = c.today.metrics.salesLostGbp - c.hub.metrics.salesLostGbp;
  const perYearGbp = perDayGbp * tradingDaysPerYear;
  return {perDayGbp, perWeekGbp: Math.round(perYearGbp / WEEKS_PER_YEAR), perYearGbp, stores, acrossStoresGbp: perYearGbp * stores};
}
