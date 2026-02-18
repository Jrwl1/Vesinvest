/**
 * Tulos (result) year-over-year delta: display text and improvement direction.
 * Always shows € delta and % for consistent layout. Colors: improvement=green, worsening=red.
 */

export type TulosDeltaImprovement = 'improvement' | 'worsening' | 'neutral';

export interface TulosDeltaResult {
  /** Change in euros (curr - prev). */
  deltaEur: number;
  /** Percentage string for display (matches layout across all cases). */
  text: string;
  improvement: TulosDeltaImprovement;
}

/**
 * Compute percentage change; returns null only when prev is 0.
 */
function percentChange(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/**
 * Tulos delta for display between two years.
 * - Always shows Δ€ and % for consistent layout (no Alijäämä/ylijäämä labels).
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

  const pct = percentChange(prev, curr);
  return { deltaEur, text: pct !== null ? formatPercent(pct) : '—', improvement };
}
