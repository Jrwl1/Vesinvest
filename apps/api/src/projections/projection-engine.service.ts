import { Injectable } from '@nestjs/common';

/**
 * Projection computation engine.
 *
 * Implements the year-by-year projection logic specified in Plan Section 5.2:
 *
 * For each year n in the horizon:
 *   Revenue  = base revenue × (1 + hintakorotus)^n × volume adjustment
 *   Expenses = Σ line.summa × (1 + factor)^n  (energiakerroin for energy, inflaatio for others)
 *   Investments = Σ line.summa × (1 + investointikerroin)^n
 *   Net result = revenue - expenses - investments
 *   Cumulative = running sum of net results
 */

export interface BudgetLineInput {
  tiliryhma: string;
  nimi: string;
  tyyppi: 'kulu' | 'tulo' | 'investointi';
  summa: number; // base amount (absolute)
}

export interface RevenueDriverInput {
  palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
  yksikkohinta: number;
  myytyMaara: number;
  perusmaksu: number;
  liittymamaara: number;
}

export interface AssumptionMap {
  inflaatio: number;       // e.g. 0.025
  energiakerroin: number;  // e.g. 0.05
  vesimaaran_muutos: number; // e.g. -0.01
  hintakorotus: number;    // e.g. 0.03
  investointikerroin: number; // e.g. 0.02
  [key: string]: number;
}

export interface ComputedYear {
  vuosi: number;
  tulotYhteensa: number;
  kulutYhteensa: number;
  investoinnitYhteensa: number;
  tulos: number;
  kumulatiivinenTulos: number;
  vesihinta: number;
  myytyVesimaara: number;
  erittelyt: {
    tulot: Array<{ nimi: string; summa: number }>;
    kulut: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    investoinnit: Array<{ tiliryhma: string; nimi: string; summa: number }>;
    ajurit: Array<{
      palvelutyyppi: string;
      yksikkohinta: number;
      myytyMaara: number;
      perusmaksu: number;
      liittymamaara: number;
      laskettuTulo: number;
    }>;
  };
}

/** Well-known energy account groups (tiliryhma starting with 42xx) */
const ENERGY_ACCOUNT_PREFIX = '42';

@Injectable()
export class ProjectionEngine {
  /**
   * Compute a full projection given base budget data and assumptions.
   *
   * @param baseYear       The budget's year (base year, n=0)
   * @param horizonYears   Number of years to project (e.g. 5 means years 1..5)
   * @param lines          Budget lines from the base budget
   * @param drivers        Revenue drivers from the base budget
   * @param assumptions    Merged assumptions (org defaults + scenario overrides)
   */
  compute(
    baseYear: number,
    horizonYears: number,
    lines: BudgetLineInput[],
    drivers: RevenueDriverInput[],
    assumptions: AssumptionMap,
  ): ComputedYear[] {
    const {
      inflaatio = 0.025,
      energiakerroin = 0.05,
      vesimaaran_muutos = -0.01,
      hintakorotus = 0.03,
      investointikerroin = 0.02,
    } = assumptions;

    // Separate lines by type
    const expenses = lines.filter((l) => l.tyyppi === 'kulu');
    const manualRevenue = lines.filter((l) => l.tyyppi === 'tulo');
    const investments = lines.filter((l) => l.tyyppi === 'investointi');

    // Base revenue from drivers (year 0 values)
    const baseDriverRevenue = this.computeDriverRevenue(drivers, 1, 1);

    // Base totals for year 0 (not included in output — we start from year baseYear)
    const years: ComputedYear[] = [];
    let cumulative = 0;

    for (let n = 0; n <= horizonYears; n++) {
      const year = baseYear + n;

      // ── Revenue ──
      const priceFactor = Math.pow(1 + hintakorotus, n);
      const volumeFactor = Math.pow(1 + vesimaaran_muutos, n);

      // Computed revenue from drivers with price + volume adjustments
      const driverDetails = drivers.map((d) => {
        const adjPrice = d.yksikkohinta * priceFactor;
        const adjVolume = d.myytyMaara * volumeFactor;
        const volumeRevenue = adjPrice * adjVolume;
        const baseFeeRevenue = d.perusmaksu * d.liittymamaara;
        return {
          palvelutyyppi: d.palvelutyyppi,
          yksikkohinta: round2(adjPrice),
          myytyMaara: round2(adjVolume),
          perusmaksu: d.perusmaksu,
          liittymamaara: d.liittymamaara,
          laskettuTulo: round2(volumeRevenue + baseFeeRevenue),
        };
      });

      const totalDriverRevenue = driverDetails.reduce((sum, d) => sum + d.laskettuTulo, 0);

      // Manual revenue lines grow with inflation
      const manualRevenueDetails = manualRevenue.map((l) => ({
        nimi: l.nimi,
        summa: round2(l.summa * Math.pow(1 + inflaatio, n)),
      }));
      const totalManualRevenue = manualRevenueDetails.reduce((sum, l) => sum + l.summa, 0);

      const tulotYhteensa = round2(totalDriverRevenue + totalManualRevenue);

      // ── Expenses ──
      const expenseDetails = expenses.map((l) => {
        const isEnergy = l.tiliryhma.startsWith(ENERGY_ACCOUNT_PREFIX);
        const factor = isEnergy ? energiakerroin : inflaatio;
        return {
          tiliryhma: l.tiliryhma,
          nimi: l.nimi,
          summa: round2(l.summa * Math.pow(1 + factor, n)),
        };
      });
      const kulutYhteensa = round2(expenseDetails.reduce((sum, l) => sum + l.summa, 0));

      // ── Investments ──
      const investmentDetails = investments.map((l) => ({
        tiliryhma: l.tiliryhma,
        nimi: l.nimi,
        summa: round2(l.summa * Math.pow(1 + investointikerroin, n)),
      }));
      const investoinnitYhteensa = round2(investmentDetails.reduce((sum, l) => sum + l.summa, 0));

      // ── Net result ──
      const tulos = round2(tulotYhteensa - kulutYhteensa - investoinnitYhteensa);
      cumulative = round2(cumulative + tulos);

      // Average water price across drivers for display
      const waterDrivers = driverDetails.filter((d) => d.palvelutyyppi === 'vesi' || d.palvelutyyppi === 'jatevesi');
      const avgWaterPrice = waterDrivers.length > 0
        ? round2(waterDrivers.reduce((sum, d) => sum + d.yksikkohinta, 0) / waterDrivers.length)
        : 0;
      const totalVolume = round2(driverDetails.reduce((sum, d) => sum + d.myytyMaara, 0));

      years.push({
        vuosi: year,
        tulotYhteensa,
        kulutYhteensa,
        investoinnitYhteensa,
        tulos,
        kumulatiivinenTulos: cumulative,
        vesihinta: avgWaterPrice,
        myytyVesimaara: totalVolume,
        erittelyt: {
          tulot: manualRevenueDetails,
          kulut: expenseDetails,
          investoinnit: investmentDetails,
          ajurit: driverDetails,
        },
      });
    }

    return years;
  }

  /**
   * Compute base revenue from drivers (no adjustments).
   */
  private computeDriverRevenue(
    drivers: RevenueDriverInput[],
    priceFactor: number,
    volumeFactor: number,
  ): number {
    return drivers.reduce((sum, d) => {
      const volumeRevenue = d.yksikkohinta * priceFactor * d.myytyMaara * volumeFactor;
      const baseFeeRevenue = d.perusmaksu * d.liittymamaara;
      return sum + volumeRevenue + baseFeeRevenue;
    }, 0);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
