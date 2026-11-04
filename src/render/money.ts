const UNITS = [
  {size: 1e9, suffix: 'B'},
  {size: 1e6, suffix: 'M'},
  {size: 1e3, suffix: 'K'},
] as const;

/** Below this, pounds are shown in full; four digits still fit a column. */
const FULL_BELOW = 10_000;

/** Three significant figures, with a trailing ".0" dropped. */
function short(value: number): string {
  return value.toFixed(value < 100 ? 1 : 0).replace(/\.0$/, '');
}

/**
 * GBP shortened to fit a column of the text box: GBP9999, GBP12.3K, GBP1.2M. A value
 * that would round up to 1000 of a unit is shown in the next unit up.
 */
export function formatGbp(gbp: number): string {
  const sign = gbp < 0 ? '-' : '';
  const n = Math.abs(Math.round(gbp));
  if (n < FULL_BELOW) return `${sign}GBP${n}`;
  for (let i = UNITS.length - 1; i >= 0; i--) {
    const unit = UNITS[i];
    if (!unit) continue;
    const bigger = UNITS[i - 1];
    if (bigger && n >= bigger.size) continue;
    const text = short(n / unit.size);
    if (bigger && Number(text) >= 1000) return `${sign}GBP${short(n / bigger.size)}${bigger.suffix}`;
    return `${sign}GBP${text}${unit.suffix}`;
  }
  return `${sign}GBP${n}`;
}
