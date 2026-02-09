import { describe, it, expect } from 'vitest';
import {
  filterValisummatNoKvaTotaltDoubleCount,
  type ValisummaLike,
} from './budgetValisummatFilter';

function rev(rows: ValisummaLike[]): number {
  return rows
    .filter((v) => v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo')
    .reduce((s, v) => s + parseFloat(String(v.summa)), 0);
}

describe('filterValisummatNoKvaTotaltDoubleCount', () => {
  it('excludes sales_revenue muu when vesi and jatevesi exist; keeps other_income muu; total = 160', () => {
    const valisummat: ValisummaLike[] = [
      { id: '1', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'vesi', summa: 100 },
      { id: '2', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'jatevesi', summa: 50 },
      { id: '3', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'muu', summa: 150 },
      { id: '4', tyyppi: 'tulo', categoryKey: 'other_income', palvelutyyppi: 'muu', summa: 10 },
    ];
    const filtered = filterValisummatNoKvaTotaltDoubleCount(valisummat);
    const revenueTotal = rev(filtered);

    expect(filtered).toHaveLength(3);
    expect(filtered.map((v) => ({ categoryKey: v.categoryKey, palvelutyyppi: v.palvelutyyppi, summa: v.summa }))).toEqual([
      { categoryKey: 'sales_revenue', palvelutyyppi: 'vesi', summa: 100 },
      { categoryKey: 'sales_revenue', palvelutyyppi: 'jatevesi', summa: 50 },
      { categoryKey: 'other_income', palvelutyyppi: 'muu', summa: 10 },
    ]);
    expect(revenueTotal).toBe(160);
    expect(revenueTotal).not.toBe(310);
  });

  it('keeps muu when no vesi/jatevesi for that categoryKey', () => {
    const valisummat: ValisummaLike[] = [
      { id: '1', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'muu', summa: 200 },
      { id: '2', tyyppi: 'kulu', categoryKey: 'personnel_costs', palvelutyyppi: 'muu', summa: 80 },
    ];
    const filtered = filterValisummatNoKvaTotaltDoubleCount(valisummat);
    expect(filtered).toHaveLength(2);
    expect(rev(filtered)).toBe(200);
  });

  it('excludes muu per (tyyppi, categoryKey) only when that key has service splits', () => {
    const valisummat: ValisummaLike[] = [
      { id: '1', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'vesi', summa: 100 },
      { id: '2', tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'muu', summa: 150 },
      { id: '3', tyyppi: 'kulu', categoryKey: 'personnel_costs', palvelutyyppi: 'muu', summa: 50 },
    ];
    const filtered = filterValisummatNoKvaTotaltDoubleCount(valisummat);
    expect(filtered).toHaveLength(2);
    expect(filtered.find((v) => v.categoryKey === 'sales_revenue' && v.palvelutyyppi === 'muu')).toBeUndefined();
    expect(filtered.find((v) => v.categoryKey === 'personnel_costs' && v.palvelutyyppi === 'muu')).toBeDefined();
  });
});
