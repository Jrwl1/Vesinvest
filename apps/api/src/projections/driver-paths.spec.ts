import { resolveDriverValue, type DriverPaths } from './driver-paths';
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
