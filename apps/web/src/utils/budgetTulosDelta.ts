/**
 * Tulos (result) year-over-year delta: display text and improvement direction.
 * Avoids misleading % when crossing zero (e.g. -87k → +14k).
 */

export type TulosDeltaImprovement = 'improvement' | 'worsening' | 'neutral';

export interface TulosDeltaResult {
  /** Change in euros (curr - prev). */
  deltaEur: number;
  /** Either a percentage string (when same sign and prev !== 0) or an i18n key for sign-crossing. */
  text: string;
  improvement: TulosDeltaImprovement;
}

/**
 * Compute percentage change; returns null when prev is 0 or when signs differ (avoid misleading %).
 */
function percentChangeSameSign(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  if ((prev > 0 && curr < 0) || (prev < 0 && curr > 0)) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Tulos delta for display between two years.
 * - Always conceptually uses Δ€ (curr - prev).
 * - Shows % only when same sign and prev !== 0.
 * - On sign-crossing: returns i18n key for "Alijäämä → ylijäämä" or "Ylijäämä → alijäämä".
 * - improvement: surplus increase or deficit→surplus = improvement; surplus→deficit or deficit increase = worsening.
 */
export function computeTulosDelta(prev: number, curr: number, formatPercent: (pct: number) => string = formatPct): TulosDeltaResult {
  const deltaEur = curr - prev;

  const improvement: TulosDeltaImprovement =
    curr > prev ? 'improvement' : curr < prev ? 'worsening' : 'neutral';

  if (prev === 0 && curr === 0) {
    return { deltaEur: 0, text: '0 %', improvement: 'neutral' };
  }
  if (prev === 0) {
    return { deltaEur, text: '—', improvement };
  }

  const pct = percentChangeSameSign(prev, curr);
  if (pct !== null) {
    return { deltaEur, text: formatPercent(pct), improvement };
  }

  if (prev < 0 && curr > 0) {
    return { deltaEur, text: 'budget.delta.deficitToSurplus', improvement: 'improvement' };
  }
  if (prev > 0 && curr < 0) {
    return { deltaEur, text: 'budget.delta.surplusToDeficit', improvement: 'worsening' };
  }

  return { deltaEur, text: '—', improvement };
}
