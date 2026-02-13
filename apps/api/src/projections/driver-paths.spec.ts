import {
  resolveDriverValue,
  synthesizeDriversFromPaths,
  synthesizeDriversFromSubtotals,
  buildManualDriverPathsFromDrivers,
  type DriverPaths,
} from './driver-paths';
import type { RevenueDriverInput } from './projection-engine.service';

describe('driver-paths resolveDriverValue', () => {
  const waterDriver: RevenueDriverInput = {
    palvelutyyppi: 'vesi',
    yksikkohinta: 1.2,
    myytyMaara: 12000,
    perusmaksu: 0,
    liittymamaara: 0,
  };

  it('applies percent plan both before and after selected base year', () => {
    const paths: DriverPaths = {
      vesi: {
        yksikkohinta: {
          mode: 'percent',
          baseYear: 2026,
          baseValue: 2.0,
          annualPercent: 0.1,
        },
      },
    };

    const y2024 = resolveDriverValue(paths, waterDriver, 'yksikkohinta', 2024, 1.2, 1.2);
    const y2025 = resolveDriverValue(paths, waterDriver, 'yksikkohinta', 2025, 1.2, 1.2);
    const y2026 = resolveDriverValue(paths, waterDriver, 'yksikkohinta', 2026, 1.2, 1.2);
    const y2027 = resolveDriverValue(paths, waterDriver, 'yksikkohinta', 2027, 1.2, 1.2);

    expect(y2026).toBeCloseTo(2.0, 2);
    expect(y2027).toBeCloseTo(2.2, 2);
    expect(y2025).toBeCloseTo(2.0 / 1.1, 2);
    expect(y2024).toBeCloseTo(2.0 / Math.pow(1.1, 2), 2);
  });
});

describe('synthesizeDriversFromPaths', () => {
  it('extracts vesi and jatevesi from manual values for base year', () => {
    const paths: DriverPaths = {
      vesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 1.5 } },
        myytyMaara: { mode: 'manual', values: { 2025: 50000 } },
      },
      jatevesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 2.0 } },
        myytyMaara: { mode: 'manual', values: { 2025: 30000 } },
      },
    };
    const drivers = synthesizeDriversFromPaths(paths, 2025);
    expect(drivers).toHaveLength(2);
    const vesi = drivers.find((d) => d.palvelutyyppi === 'vesi');
    const jatevesi = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
    expect(vesi?.yksikkohinta).toBeCloseTo(1.5, 2);
    expect(vesi?.myytyMaara).toBeCloseTo(50000, 2);
    expect(jatevesi?.yksikkohinta).toBeCloseTo(2.0, 2);
    expect(jatevesi?.myytyMaara).toBeCloseTo(30000, 2);
  });

  it('returns empty when paths is undefined', () => {
    expect(synthesizeDriversFromPaths(undefined, 2025)).toEqual([]);
  });
});

describe('subtotal fallback synthesis', () => {
  it('builds deterministic fallback drivers from subtotal revenues', () => {
    const drivers = synthesizeDriversFromSubtotals([
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 120000, palvelutyyppi: 'vesi' },
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 80000, palvelutyyppi: 'jatevesi' },
      { categoryKey: 'other_income', tyyppi: 'tulo', summa: 10000 },
      { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 50000 },
    ]);

    expect(drivers).toHaveLength(2);
    expect(drivers.every((d) => d.myytyMaara > 0)).toBe(true);
    const totalRevenue = drivers.reduce((sum, d) => sum + d.yksikkohinta * d.myytyMaara, 0);
    expect(totalRevenue).toBeGreaterThan(200000);
  });

  it('falls back to deterministic defaults when subtotals have no revenue rows', () => {
    const drivers = synthesizeDriversFromSubtotals([
      { categoryKey: 'personnel_costs', tyyppi: 'kulu', summa: 50000 },
      { categoryKey: 'investments', tyyppi: 'investointi', summa: 20000 },
    ]);

    expect(drivers).toHaveLength(2);
    expect(drivers[0].myytyMaara).toBeGreaterThan(0);
    expect(drivers[1].myytyMaara).toBeGreaterThan(0);
    expect(drivers[0].yksikkohinta).toBeGreaterThan(0);
    expect(drivers[1].yksikkohinta).toBeGreaterThan(0);
  });

  it('converts fallback drivers into editable manual driver paths', () => {
    const paths = buildManualDriverPathsFromDrivers([
      { palvelutyyppi: 'vesi', yksikkohinta: 1.8, myytyMaara: 55000, perusmaksu: 0, liittymamaara: 0 },
      { palvelutyyppi: 'jatevesi', yksikkohinta: 2.2, myytyMaara: 45000, perusmaksu: 0, liittymamaara: 0 },
    ], 2025);

    expect(paths?.vesi?.yksikkohinta?.values?.[2025]).toBeCloseTo(1.8, 2);
    expect(paths?.vesi?.myytyMaara?.values?.[2025]).toBeCloseTo(55000, 2);
    expect(paths?.jatevesi?.yksikkohinta?.values?.[2025]).toBeCloseTo(2.2, 2);
    expect(paths?.jatevesi?.myytyMaara?.values?.[2025]).toBeCloseTo(45000, 2);
  });
});
