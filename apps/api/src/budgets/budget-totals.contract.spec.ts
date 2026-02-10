/**
 * Contract test: Budget page revenue total rule (no double-count of sales_revenue).
 * When a budget has both valisummat (including sales_revenue) and revenue drivers (tuloajurit),
 * the display total must use drivers for "sales" revenue and must NOT add sales_revenue from
 * valisummat (projection rule: drivers replace sales_revenue).
 */
describe('Budget revenue total (no double-count)', () => {
  type ValisummaLike = { tyyppi: string; categoryKey: string; summa: string | number };
  type DriverLike = { yksikkohinta: string | number; myytyMaara: string | number; perusmaksu?: string | number; liittymamaara?: number };

  function revenueFromValisummat(
    valisummat: ValisummaLike[],
    hasMeaningfulDrivers: boolean,
  ): number {
    return valisummat
      .filter(
        (v) =>
          (v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo') &&
          (!hasMeaningfulDrivers || v.categoryKey !== 'sales_revenue'),
      )
      .reduce((s, v) => s + parseFloat(String(v.summa)), 0);
  }

  function computedRevenueFromDrivers(drivers: DriverLike[]): number {
    return drivers.reduce((sum, d) => {
      return (
        sum +
        parseFloat(String(d.yksikkohinta)) * parseFloat(String(d.myytyMaara)) +
        (d.perusmaksu != null && d.liittymamaara != null
          ? parseFloat(String(d.perusmaksu)) * d.liittymamaara
          : 0)
      );
    }, 0);
  }

  it('excludes sales_revenue from valisummat when drivers are present so total is not double-counted', () => {
    const valisummat: ValisummaLike[] = [
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
      { categoryKey: 'connection_fees', tyyppi: 'tulo', summa: 50000 },
    ];
    const drivers: DriverLike[] = [
      { yksikkohinta: 1.2, myytyMaara: 12000 },
      { yksikkohinta: 2.0, myytyMaara: 9000 },
    ];
    const hasMeaningfulDrivers = drivers.some(
      (d) => parseFloat(String(d.myytyMaara)) > 0 || parseFloat(String(d.yksikkohinta)) > 0,
    );
    expect(hasMeaningfulDrivers).toBe(true);

    const fromValisummat = revenueFromValisummat(valisummat, hasMeaningfulDrivers);
    const computed = computedRevenueFromDrivers(drivers);

    expect(fromValisummat).toBe(50000);
    expect(computed).toBe(1.2 * 12000 + 2.0 * 9000); // 14400 + 18000 = 32400
    const totalRevenue = fromValisummat + computed;
    expect(totalRevenue).toBe(50000 + 32400);
    expect(totalRevenue).not.toBe(400000 + 50000 + 32400);
  });

  it('V1: budget revenue total is VAT-free (driver revenue = price×volume + base fee×connections only)', () => {
    const drivers: DriverLike[] = [
      { yksikkohinta: 1.2, myytyMaara: 12000, perusmaksu: 10, liittymamaara: 100 },
    ];
    const computed = computedRevenueFromDrivers(drivers);
    expect(computed).toBe(1.2 * 12000 + 10 * 100);
    expect(computed).toBe(15400);
  });

  it('includes sales_revenue from valisummat when no meaningful drivers', () => {
    const valisummat: ValisummaLike[] = [
      { categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: 400000 },
      { categoryKey: 'connection_fees', tyyppi: 'tulo', summa: 50000 },
    ];
    const drivers: DriverLike[] = [
      { yksikkohinta: 0, myytyMaara: 0 },
      { yksikkohinta: 0, myytyMaara: 0 },
    ];
    const hasMeaningfulDrivers = drivers.some(
      (d) => parseFloat(String(d.myytyMaara)) > 0 || parseFloat(String(d.yksikkohinta)) > 0,
    );
    expect(hasMeaningfulDrivers).toBe(false);

    const fromValisummat = revenueFromValisummat(valisummat, hasMeaningfulDrivers);
    expect(fromValisummat).toBe(400000 + 50000);
  });
});

/**
 * Contract: Budget page must not double-count KVA totalt when service splits (vesi, jatevesi) exist.
 * For each (tyyppi, categoryKey), if any valisumma has palvelutyyppi in ['vesi','jatevesi'],
 * exclude valisummat with palvelutyyppi === 'muu' for that (tyyppi, categoryKey).
 * Displayed revenue = sum of filtered revenue-type valisummat.
 */
describe('Valisummat filter: exclude muu when vesi/jatevesi exist (no KVA totalt double-count)', () => {
  type ValisummaWithService = { tyyppi: string; categoryKey: string; summa: string | number; palvelutyyppi?: string };

  function filterValisummatNoKvaTotaltDoubleCount<T extends ValisummaWithService>(valisummat: T[]): T[] {
    const SERVICE_SPLITS = new Set<string>(['vesi', 'jatevesi']);
    const key = (v: ValisummaWithService) => `${v.tyyppi}\0${v.categoryKey}`;
    const hasServiceSplit = new Set<string>();
    for (const v of valisummat) {
      if (SERVICE_SPLITS.has(String(v.palvelutyyppi ?? '').toLowerCase())) hasServiceSplit.add(key(v));
    }
    return valisummat.filter((v) => {
      const k = key(v);
      const isMuu = String(v.palvelutyyppi ?? '').toLowerCase() === 'muu';
      if (isMuu && hasServiceSplit.has(k)) return false;
      return true;
    });
  }

  function revenueFromFiltered(valisummat: ValisummaWithService[]): number {
    return valisummat
      .filter((v) => v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo')
      .reduce((s, v) => s + parseFloat(String(v.summa)), 0);
  }

  it('excludes sales_revenue muu when vesi+jatevesi exist; keeps other_income muu; total revenue = 160', () => {
    const valisummat: ValisummaWithService[] = [
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'vesi', summa: 100 },
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'jatevesi', summa: 50 },
      { tyyppi: 'tulo', categoryKey: 'sales_revenue', palvelutyyppi: 'muu', summa: 150 },
      { tyyppi: 'tulo', categoryKey: 'other_income', palvelutyyppi: 'muu', summa: 10 },
    ];
    const filtered = filterValisummatNoKvaTotaltDoubleCount(valisummat);
    const totalRevenue = revenueFromFiltered(filtered);

    expect(filtered).toHaveLength(3);
    expect(filtered.some((v) => v.categoryKey === 'sales_revenue' && v.palvelutyyppi === 'muu')).toBe(false);
    expect(totalRevenue).toBe(160);
    expect(totalRevenue).not.toBe(310);
  });
});
