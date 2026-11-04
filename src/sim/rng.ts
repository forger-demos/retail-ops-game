/** A seeded generator of floats in [0, 1). */
export type Rng = () => number;

/** mulberry32: small, fast and identical on every JS engine, which is all a replayable demo needs. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An independent stream per purpose, so drawing more of one never shifts another. */
export function deriveSeed(seed: number, stream: number): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0;
}

/** Waiting time to the next arrival of a Poisson process at `ratePerMinute`. */
export function exponential(rng: Rng, ratePerMinute: number): number {
  return -Math.log(1 - rng()) / ratePerMinute;
}

export function weightedPick<T>(rng: Rng, items: readonly T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  let roll = rng() * total;
  for (const item of items) {
    roll -= weight(item);
    if (roll < 0) return item;
  }
  const last = items[items.length - 1];
  if (last === undefined) throw new Error('weightedPick needs at least one item');
  return last;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}
