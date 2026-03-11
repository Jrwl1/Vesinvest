import { describe, expect, it } from 'vitest';
import type { V2ImportYearDataResponse } from '../api';
import {
  buildFinancialComparisonRows,
  canReapplyFinancialVeeti,
} from './yearReview';

function buildYearData(
  tilinpaatos: Partial<V2ImportYearDataResponse['datasets'][number]>,
): V2ImportYearDataResponse {
  return {
    year: 2024,
    veetiId: 1535,
    sourceStatus: 'MIXED',
    completeness: {
      tilinpaatos: true,
      taksa: true,
      volume_vesi: true,
      volume_jatevesi: true,
    },
    hasManualOverrides: true,
    hasVeetiData: true,
    datasets: [
      {
        dataType: 'tilinpaatos',
        rawRows: [],
        effectiveRows: [],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: false,
        overrideMeta: null,
        ...tilinpaatos,
      },
    ],
  };
}

describe('yearReview helpers', () => {
  it('returns no financial comparison rows when statement data is absent', () => {
    const yearData = buildYearData({
      rawRows: [],
      effectiveRows: [],
      reconcileNeeded: false,
    });

    expect(buildFinancialComparisonRows(yearData)).toEqual([]);
  });

  it('builds comparison rows for wrong-but-complete years and marks changed fields', () => {
    const yearData = buildYearData({
      rawRows: [
        {
          Liikevaihto: 1000,
          Henkilostokulut: 100,
          TilikaudenYliJaama: 25,
        },
      ],
      effectiveRows: [
        {
          Liikevaihto: 1400,
          Henkilostokulut: 100,
          TilikaudenYliJaama: 50,
        },
      ],
      reconcileNeeded: true,
    });

    const rows = buildFinancialComparisonRows(yearData);
    const revenue = rows.find((row) => row.key === 'liikevaihto');
    const personnel = rows.find((row) => row.key === 'henkilostokulut');
    const result = rows.find((row) => row.key === 'tilikaudenYliJaama');

    expect(revenue).toMatchObject({
      veetiValue: 1000,
      effectiveValue: 1400,
      changed: true,
    });
    expect(personnel).toMatchObject({
      veetiValue: 100,
      effectiveValue: 100,
      changed: false,
    });
    expect(result).toMatchObject({
      veetiValue: 25,
      effectiveValue: 50,
      changed: true,
    });
  });

  it('only allows VEETI re-apply when the year has a financial reconcile path and the user is admin', () => {
    const yearData = buildYearData({
      rawRows: [{ Liikevaihto: 1000 }],
      effectiveRows: [{ Liikevaihto: 1200 }],
      reconcileNeeded: true,
    });

    expect(canReapplyFinancialVeeti(yearData, true)).toBe(true);
    expect(canReapplyFinancialVeeti(yearData, false)).toBe(false);
    expect(
      canReapplyFinancialVeeti(
        buildYearData({
          rawRows: [{ Liikevaihto: 1000 }],
          effectiveRows: [{ Liikevaihto: 1000 }],
          reconcileNeeded: false,
        }),
        true,
      ),
    ).toBe(false);
  });
});
