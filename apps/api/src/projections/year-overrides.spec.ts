import { normalizeProjectionYearOverrides } from './year-overrides';
import { mergeUserInvestmentsIntoYearOverrides } from './year-overrides';

describe('normalizeProjectionYearOverrides', () => {
  it('preserves unknown year payload keys while normalizing known fields', () => {
    const input = {
      2025: {
        waterPriceGrowthPct: '2.5',
        lockMode: 'price',
        categoryGrowthPct: {
          personnel: '1.5',
          futureCategory: 42,
        },
        futureTopLevel: { enabled: true },
      },
    };

    const result = normalizeProjectionYearOverrides(input);

    expect(result?.[2025]).toMatchObject({
      waterPriceGrowthPct: 2.5,
      lockMode: 'price',
      futureTopLevel: { enabled: true },
    });
    expect((result?.[2025]?.categoryGrowthPct as any)?.personnel).toBe(1.5);
    expect((result?.[2025]?.categoryGrowthPct as any)?.futureCategory).toBe(42);
  });

  it('keeps forward-compatible lineOverrides entries while normalizing known ones', () => {
    const input = {
      2026: {
        lineOverrides: {
          revenue: { mode: 'percent', value: '3.2' },
          futureLine: { strategy: 'piecewise', breakpoints: [1, 2, 3] },
        },
      },
    };

    const result = normalizeProjectionYearOverrides(input);
    const lineOverrides = result?.[2026]?.lineOverrides as any;

    expect(lineOverrides?.revenue).toEqual({ mode: 'percent', value: 3.2 });
    expect(lineOverrides?.futureLine).toEqual({
      strategy: 'piecewise',
      breakpoints: [1, 2, 3],
    });
  });

  it('merges structured user investments into year overrides using amount only', () => {
    const result = mergeUserInvestmentsIntoYearOverrides(
      {
        2027: {
          waterPriceGrowthPct: 1.5,
        },
      },
      [
        {
          year: 2027,
          amount: 250000,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Main trunk renewal',
        },
      ],
    );

    expect(result?.[2027]).toEqual({
      waterPriceGrowthPct: 1.5,
      investmentEur: 250000,
    });
  });
});
