import { Injectable } from '@nestjs/common';
import { DriverPaths, resolveDriverValue, round2 } from './driver-paths';
import {
  ProjectionYearOverride,
  ProjectionYearOverrides,
} from './year-overrides';

/**
 * Projection computation engine.
 *
 * V1: All amounts are VAT-free; no VAT multiplier is applied in calculations or outputs.
 *
 * Implements the year-by-year projection logic specified in Plan Section 5.2:
 *
 * For each year n in the horizon:
 *   Revenue (TULOT) = base revenue × (1 + hintakorotus)^n × volume adjustment + other income + financial income
 *   Expenses (KULUT) = costs + depreciation + financial costs
 *   Investments = Σ line.summa × (1 + investointikerroin)^n (shown separately; do not reduce tulos)
 *   Net result (TULOS) = income minus expenses = revenue - expenses
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
  inflaatio: number; // e.g. 0.025
  energiakerroin: number; // e.g. 0.05
  vesimaaran_muutos: number; // e.g. -0.01
  hintakorotus: number; // e.g. 0.03
  investointikerroin: number; // e.g. 0.02
  [key: string]: number;
}

export interface ComputedYear {
  vuosi: number;
  tulotYhteensa: number;
  kulutYhteensa: number;
  investoinnitYhteensa: number;
  /** Depreciation split: baseline (from base-year inputs). */
  poistoPerusta: number;
  /** Depreciation split: investment-driven additional component. */
  poistoInvestoinneista: number;
  tulos: number;
  kumulatiivinenTulos: number;
  /** Kassaflöde(y) = Tulos(y) − Investoinnit(y) */
  kassafloede: number;
  /** Ackumulerad kassa(y) = sum of Kassaflöde(0..y) */
  ackumuleradKassa: number;
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

/** Input for subtotal-based projections (from TalousarvioValisumma). */
export interface SubtotalInput {
  categoryKey: string;
  tyyppi: string; // tulo, kulu, poisto, rahoitus_tulo, rahoitus_kulu, investointi, tulos
  summa: number;
  palvelutyyppi?: string;
}

/** Well-known energy account groups (tiliryhma starting with 42xx) */
const ENERGY_ACCOUNT_PREFIX = '42';
const MATERIALS_SERVICES_SUBTOTAL_CATEGORY_KEYS = new Set([
  'energy_costs',
  'materials_services',
]);
const PERSONNEL_SUBTOTAL_CATEGORY_KEYS = new Set([
  'personnel_costs',
  'henkilostokulut',
]);
const OTHER_OPERATING_SUBTOTAL_CATEGORY_KEYS = new Set([
  'other_costs',
  'liiketoiminnan_muut_kulut',
]);
const SALES_REVENUE_CATEGORY_KEYS = new Set(['sales_revenue', 'liikevaihto']);
const PERSONNEL_YEAR_OVERRIDE_PREFIX = 'henkilosto_muutos_';

function getCostCategoryBucket(
  categoryKey: string,
): 'materialsServices' | 'personnel' | 'opexOther' | null {
  if (PERSONNEL_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) return 'personnel';
  if (MATERIALS_SERVICES_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) {
    return 'materialsServices';
  }
  if (OTHER_OPERATING_SUBTOTAL_CATEGORY_KEYS.has(categoryKey)) {
    return 'opexOther';
  }
  return null;
}

function readYearRateOverrides(
  assumptions: AssumptionMap,
  prefix: string,
): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [key, raw] of Object.entries(assumptions)) {
    if (
      !key.startsWith(prefix) ||
      typeof raw !== 'number' ||
      !Number.isFinite(raw)
    )
      continue;
    const yearPart = key.slice(prefix.length);
    const year = Number.parseInt(yearPart, 10);
    if (Number.isFinite(year)) {
      out[year] = raw;
    }
  }
  return out;
}

function pctToRate(pct: number | undefined): number | undefined {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return undefined;
  return pct / 100;
}

function pickYearOverride(
  projectionYearOverrides: ProjectionYearOverrides | undefined,
  year: number,
): ProjectionYearOverride | undefined {
  return projectionYearOverrides?.[year];
}

function getCostCategoryRate(
  yearOverride: ProjectionYearOverride | undefined,
  categoryKey: string,
): number | undefined {
  const growth = yearOverride?.categoryGrowthPct;
  if (!growth) return undefined;
  const bucket = getCostCategoryBucket(categoryKey);
  if (bucket === 'personnel') return pctToRate(growth.personnel);
  if (bucket === 'materialsServices') {
    const materialsServicesRaw =
      (growth as Record<string, unknown>).materialsServices ?? growth.energy;
    const materialsServicesPct =
      typeof materialsServicesRaw === 'number' &&
      Number.isFinite(materialsServicesRaw)
        ? materialsServicesRaw
        : undefined;
    return pctToRate(materialsServicesPct);
  }
  if (bucket === 'opexOther') return pctToRate(growth.opexOther);
  return undefined;
}

function applyLineOverride(
  lineOverride: { mode: 'percent' | 'absolute'; value: number } | undefined,
  previousAmount: number,
): number | undefined {
  if (!lineOverride) return undefined;
  if (lineOverride.mode === 'absolute') return round2(lineOverride.value);
  if (lineOverride.mode === 'percent')
    return round2(previousAmount * (1 + lineOverride.value / 100));
  return undefined;
}

function stripWaterPriceOverrides(
  projectionYearOverrides: ProjectionYearOverrides | undefined,
): ProjectionYearOverrides | undefined {
  if (!projectionYearOverrides) return undefined;
  const out: ProjectionYearOverrides = {};
  for (const [yearKey, value] of Object.entries(projectionYearOverrides)) {
    const year = Number.parseInt(yearKey, 10);
    if (!Number.isFinite(year) || !value) continue;
    const next: ProjectionYearOverride = { ...value };
    delete next.waterPriceEurM3;
    delete next.waterPriceGrowthPct;
    delete next.lockMode;
    if (Object.keys(next).length > 0) out[year] = next;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function weightedCombinedUnitPrice(
  drivers: Array<{
    palvelutyyppi: string;
    yksikkohinta: number;
    myytyMaara: number;
  }>,
): number {
  const waterDrivers = drivers.filter(
    (driver) =>
      driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi',
  );
  const totalVolume = waterDrivers.reduce(
    (sum, driver) => sum + driver.myytyMaara,
    0,
  );
  if (totalVolume <= 0) return 0;
  const totalVolumeRevenue = waterDrivers.reduce(
    (sum, driver) => sum + driver.yksikkohinta * driver.myytyMaara,
    0,
  );
  return round2(totalVolumeRevenue / totalVolume);
}

@Injectable()
export class ProjectionEngine {
  /**
   * Compute a full projection given base budget data and assumptions.
   *
   * @param baseYear         The budget's year (base year, n=0)
   * @param horizonYears     Number of years to project (e.g. 5 means years 1..5)
   * @param lines            Budget lines from the base budget
   * @param drivers          Revenue drivers from the base budget
   * @param assumptions      Merged assumptions (org defaults + scenario overrides)
   * @param baseFeeOverrides ADR-013: optional per-year override for base-fee total (year -> EUR). When set for a year, replaces computed base fee for that year.
   */
  compute(
    baseYear: number,
    horizonYears: number,
    lines: BudgetLineInput[],
    drivers: RevenueDriverInput[],
    assumptions: AssumptionMap,
    baseFeeOverrides?: Record<number, number>,
    driverPaths?: DriverPaths,
  ): ComputedYear[] {
    const {
      inflaatio = 0.025,
      energiakerroin = 0.05,
      vesimaaran_muutos = -0.01,
      hintakorotus = 0.03,
      investointikerroin = 0.02,
    } = assumptions;
    const perusmaksuMuutos =
      typeof assumptions.perusmaksuMuutos === 'number'
        ? assumptions.perusmaksuMuutos
        : 0;

    // Separate lines by type
    const expenses = lines.filter((l) => l.tyyppi === 'kulu');
    const manualRevenue = lines.filter((l) => l.tyyppi === 'tulo');
    const investments = lines.filter((l) => l.tyyppi === 'investointi');

    // Base revenue from drivers (year 0 values)
    const baseDriverRevenue = this.computeDriverRevenue(drivers, 1, 1);

    // Base totals for year 0 (not included in output — we start from year baseYear)
    const years: ComputedYear[] = [];
    let cumulative = 0;
    let ackumCumulative = 0;

    for (let n = 0; n <= horizonYears; n++) {
      const year = baseYear + n;

      // ── Revenue ──
      const priceFactor = Math.pow(1 + hintakorotus, n);
      const volumeFactor = Math.pow(1 + vesimaaran_muutos, n);

      // Base-fee total: ADR-013 yearly percent change or override
      const baseFeeYear0 = drivers.reduce(
        (s, d) => s + d.perusmaksu * (d.liittymamaara ?? 0),
        0,
      );
      const baseFeeForYear =
        baseFeeOverrides?.[year] ??
        baseFeeYear0 * Math.pow(1 + perusmaksuMuutos, n);

      // Computed revenue from drivers with price + volume adjustments; base fee uses yearly total (percent change or override)
      let totalVolumeRevenue = 0;
      const shareDenom = baseFeeYear0 > 0 ? baseFeeYear0 : 1;
      const driverDetails = drivers.map((d) => {
        const adjPriceDefault = round2(d.yksikkohinta * priceFactor);
        const adjVolumeDefault = round2(d.myytyMaara * volumeFactor);
        const adjPrice = resolveDriverValue(
          driverPaths,
          d,
          'yksikkohinta',
          year,
          d.yksikkohinta,
          adjPriceDefault,
        );
        const adjVolume = resolveDriverValue(
          driverPaths,
          d,
          'myytyMaara',
          year,
          d.myytyMaara,
          adjVolumeDefault,
        );
        const volumeRevenue = adjPrice * adjVolume;
        totalVolumeRevenue += volumeRevenue;
        const driverBaseShare =
          (d.perusmaksu * (d.liittymamaara ?? 0)) / shareDenom;
        const baseFeeRevenue = round2(baseFeeForYear * driverBaseShare);
        return {
          palvelutyyppi: d.palvelutyyppi,
          yksikkohinta: round2(adjPrice),
          myytyMaara: round2(adjVolume),
          perusmaksu: d.perusmaksu,
          liittymamaara: d.liittymamaara,
          laskettuTulo: round2(volumeRevenue + baseFeeRevenue),
        };
      });
      const totalDriverRevenue = round2(totalVolumeRevenue + baseFeeForYear);

      // Manual revenue lines grow with inflation
      const manualRevenueDetails = manualRevenue.map((l) => ({
        nimi: l.nimi,
        summa: round2(l.summa * Math.pow(1 + inflaatio, n)),
      }));
      const totalManualRevenue = manualRevenueDetails.reduce(
        (sum, l) => sum + l.summa,
        0,
      );

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
      const kulutYhteensa = round2(
        expenseDetails.reduce((sum, l) => sum + l.summa, 0),
      );

      // ── Investments ──
      const investmentDetails = investments.map((l) => ({
        tiliryhma: l.tiliryhma,
        nimi: l.nimi,
        summa: round2(l.summa * Math.pow(1 + investointikerroin, n)),
      }));
      const investoinnitYhteensa = round2(
        investmentDetails.reduce((sum, l) => sum + l.summa, 0),
      );

      // ── Net result: income minus expenses (investments shown separately, do not reduce tulos) ──
      const tulos = round2(tulotYhteensa - kulutYhteensa);
      cumulative = round2(cumulative + tulos);

      // Kassaflöde = Tulos − Investoinnit; Ackumulerad kassa = running sum
      const kassafloede = round2(tulos - investoinnitYhteensa);
      ackumCumulative = round2(ackumCumulative + kassafloede);

      // Combined water price is volume-weighted across vesi + jatevesi.
      const avgWaterPrice = weightedCombinedUnitPrice(driverDetails);
      const totalVolume = round2(
        driverDetails
          .filter(
            (driver) =>
              driver.palvelutyyppi === 'vesi' ||
              driver.palvelutyyppi === 'jatevesi',
          )
          .reduce((sum, driver) => sum + driver.myytyMaara, 0),
      );

      years.push({
        vuosi: year,
        tulotYhteensa,
        kulutYhteensa,
        investoinnitYhteensa,
        poistoPerusta: 0,
        poistoInvestoinneista: 0,
        tulos,
        kumulatiivinenTulos: cumulative,
        kassafloede,
        ackumuleradKassa: ackumCumulative,
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
   * Compute projection from subtotal-level P&L data (KVA import path).
   *
   * Uses subtotal categories instead of account-level lines.
   * Revenue is computed from drivers (not from sales_revenue subtotal).
   * Expenses grow with inflaatio. Depreciation is flat. Investments grow with investointikerroin.
   * Financial items are flat. Result is computed.
   * ADR-013: base-fee total uses perusmaksuMuutos for yearly percent change, or baseFeeOverrides per year.
   *
   * Formula:
   *   tulos = revenue - operating_costs - depreciation - investments + financial_income - financial_costs
   */
  computeFromSubtotals(
    baseYear: number,
    horizonYears: number,
    subtotals: SubtotalInput[],
    drivers: RevenueDriverInput[],
    assumptions: AssumptionMap,
    baseFeeOverrides?: Record<number, number>,
    driverPaths?: DriverPaths,
    userInvestments?: Array<{ year: number; amount: number }>,
    projectionYearOverrides?: ProjectionYearOverrides,
  ): ComputedYear[] {
    const {
      inflaatio = 0.025,
      energiakerroin = 0.05,
      vesimaaran_muutos = -0.01,
      hintakorotus = 0.03,
      investointikerroin = 0.02,
    } = assumptions;
    const perusmaksuMuutos =
      typeof assumptions.perusmaksuMuutos === 'number'
        ? assumptions.perusmaksuMuutos
        : 0;
    const investoinninPoistoOsuus =
      typeof assumptions.investoinninPoistoOsuus === 'number'
        ? assumptions.investoinninPoistoOsuus
        : 0;
    const henkilostoDefaultRate =
      typeof assumptions.henkilostokerroin === 'number'
        ? assumptions.henkilostokerroin
        : inflaatio;
    const henkilostoYearOverrides = readYearRateOverrides(
      assumptions,
      PERSONNEL_YEAR_OVERRIDE_PREFIX,
    );

    // Separate subtotals by type (exclude result types and sales_revenue which comes from drivers)
    const costSubtotals = subtotals.filter((s) => s.tyyppi === 'kulu');
    const depreciationSubtotals = subtotals.filter(
      (s) => s.tyyppi === 'poisto',
    );
    const investmentSubtotals = subtotals.filter(
      (s) => s.tyyppi === 'investointi',
    );
    const financialIncome = subtotals.filter(
      (s) => s.tyyppi === 'rahoitus_tulo',
    );
    const financialCosts = subtotals.filter(
      (s) => s.tyyppi === 'rahoitus_kulu',
    );
    // Non-driver income: connection_fees, other_income (NOT sales_revenue — that comes from drivers).
    // Exclude result-type categories so "revenue minus expenses" is never counted as revenue.
    const RESULT_CATEGORIES = new Set(['operating_result', 'net_result']);
    const otherIncome = subtotals.filter(
      (s) =>
        s.tyyppi === 'tulo' &&
        !SALES_REVENUE_CATEGORY_KEYS.has(s.categoryKey) &&
        !RESULT_CATEGORIES.has(s.categoryKey),
    );

    const years: ComputedYear[] = [];
    let cumulative = 0;
    let ackumCumulative = 0;
    const prevCostByCategory: Record<string, number> = {};
    const prevOtherIncomeByCategory: Record<string, number> = {};
    const prevInvestmentByCategory: Record<string, number> = {};
    let prevAverageWaterPrice = weightedCombinedUnitPrice(
      drivers.filter(
        (driver) =>
          driver.palvelutyyppi === 'vesi' ||
          driver.palvelutyyppi === 'jatevesi',
      ),
    );

    for (let n = 0; n <= horizonYears; n++) {
      const year = baseYear + n;
      const yearOverride = pickYearOverride(projectionYearOverrides, year);

      // ── Revenue (from drivers) ──
      const priceFactor = Math.pow(1 + hintakorotus, n);
      const volumeFactor = Math.pow(1 + vesimaaran_muutos, n);

      // Base-fee total: ADR-013 yearly percent change or override
      const baseFeeYear0 = drivers.reduce(
        (s, d) => s + d.perusmaksu * (d.liittymamaara ?? 0),
        0,
      );
      const baseFeeForYear =
        baseFeeOverrides?.[year] ??
        baseFeeYear0 * Math.pow(1 + perusmaksuMuutos, n);

      let totalVolumeRevenue = 0;
      const shareDenom = baseFeeYear0 > 0 ? baseFeeYear0 : 1;
      let driverDetails = drivers.map((d) => {
        const adjPriceDefault = round2(d.yksikkohinta * priceFactor);
        const adjVolumeDefault = round2(d.myytyMaara * volumeFactor);
        const adjPrice = resolveDriverValue(
          driverPaths,
          d,
          'yksikkohinta',
          year,
          d.yksikkohinta,
          adjPriceDefault,
        );
        const adjVolume = resolveDriverValue(
          driverPaths,
          d,
          'myytyMaara',
          year,
          d.myytyMaara,
          adjVolumeDefault,
        );
        const volumeRevenue = adjPrice * adjVolume;
        totalVolumeRevenue += volumeRevenue;
        const driverBaseShare =
          (d.perusmaksu * (d.liittymamaara ?? 0)) / shareDenom;
        const baseFeeRevenue = round2(baseFeeForYear * driverBaseShare);
        return {
          palvelutyyppi: d.palvelutyyppi,
          yksikkohinta: round2(adjPrice),
          myytyMaara: round2(adjVolume),
          perusmaksu: d.perusmaksu,
          liittymamaara: d.liittymamaara,
          laskettuTulo: round2(volumeRevenue + baseFeeRevenue),
        };
      });
      const waterDrivers = driverDetails.filter(
        (d) => d.palvelutyyppi === 'vesi' || d.palvelutyyppi === 'jatevesi',
      );
      let avgWaterPrice = weightedCombinedUnitPrice(waterDrivers);
      const growthOverrideRate = pctToRate(yearOverride?.waterPriceGrowthPct);
      const usePercentLock =
        yearOverride?.lockMode === 'percent' &&
        typeof growthOverrideRate === 'number';
      const usePriceLock =
        typeof yearOverride?.waterPriceEurM3 === 'number' && !usePercentLock;
      let targetAveragePrice: number | undefined;
      if (usePriceLock) {
        targetAveragePrice = round2(yearOverride!.waterPriceEurM3!);
      } else if (typeof growthOverrideRate === 'number' && n > 0) {
        targetAveragePrice = round2(
          prevAverageWaterPrice * (1 + growthOverrideRate),
        );
      }
      if (
        typeof targetAveragePrice === 'number' &&
        Number.isFinite(targetAveragePrice) &&
        waterDrivers.length > 0
      ) {
        const sourceAverage = avgWaterPrice > 0 ? avgWaterPrice : 1;
        const scale = targetAveragePrice / sourceAverage;
        driverDetails = driverDetails.map((d) => {
          if (d.palvelutyyppi !== 'vesi' && d.palvelutyyppi !== 'jatevesi')
            return d;
          const newPrice = round2(d.yksikkohinta * scale);
          const volumeRevenue = newPrice * d.myytyMaara;
          const driverBaseShare =
            (d.perusmaksu * (d.liittymamaara ?? 0)) / shareDenom;
          const baseFeeRevenue = round2(baseFeeForYear * driverBaseShare);
          return {
            ...d,
            yksikkohinta: newPrice,
            laskettuTulo: round2(volumeRevenue + baseFeeRevenue),
          };
        });
        avgWaterPrice = weightedCombinedUnitPrice(
          driverDetails.filter(
            (driver) =>
              driver.palvelutyyppi === 'vesi' ||
              driver.palvelutyyppi === 'jatevesi',
          ),
        );
      }
      prevAverageWaterPrice = avgWaterPrice;
      totalVolumeRevenue = round2(
        driverDetails.reduce(
          (sum, d) => sum + d.yksikkohinta * d.myytyMaara,
          0,
        ),
      );

      const totalDriverRevenue = round2(totalVolumeRevenue + baseFeeForYear);

      // Non-driver income grows with inflation unless year/category overrides are set.
      const otherIncomeGrowthRate = pctToRate(
        yearOverride?.categoryGrowthPct?.otherIncome,
      );
      const otherIncomeDetails = otherIncome.map((s) => {
        const defaultAmount = round2(s.summa * Math.pow(1 + inflaatio, n));
        const previousAmount =
          prevOtherIncomeByCategory[s.categoryKey] ?? round2(s.summa);
        const lineOverride = yearOverride?.lineOverrides?.[s.categoryKey];
        const fromLineOverride = applyLineOverride(
          lineOverride,
          previousAmount,
        );
        const fromCategoryOverride =
          typeof otherIncomeGrowthRate === 'number'
            ? round2(previousAmount * (1 + otherIncomeGrowthRate))
            : undefined;
        const amount =
          fromLineOverride ?? fromCategoryOverride ?? defaultAmount;
        prevOtherIncomeByCategory[s.categoryKey] = amount;
        return {
          nimi: s.categoryKey,
          summa: amount,
        };
      });
      const totalOtherIncome = otherIncomeDetails.reduce(
        (sum, l) => sum + l.summa,
        0,
      );

      // Financial income (flat)
      const totalFinancialIncome = financialIncome.reduce(
        (sum, s) => sum + s.summa,
        0,
      );

      const tulotYhteensa = round2(
        totalDriverRevenue + totalOtherIncome + totalFinancialIncome,
      );

      // ── Operating costs (grow with inflation) ──
      const costDetails = costSubtotals.map((s) => {
        const previousAmount =
          prevCostByCategory[s.categoryKey] ?? round2(s.summa);
        const defaultRate = (() => {
          const bucket = getCostCategoryBucket(s.categoryKey);
          if (bucket === 'personnel') {
            return henkilostoYearOverrides[year] ?? henkilostoDefaultRate;
          }
          if (bucket === 'materialsServices') {
            return energiakerroin;
          }
          return inflaatio;
        })();
        const defaultAmount =
          n === 0
            ? round2(s.summa)
            : round2(previousAmount * (1 + defaultRate));
        const lineOverride = yearOverride?.lineOverrides?.[s.categoryKey];
        const fromLineOverride = applyLineOverride(
          lineOverride,
          previousAmount,
        );
        const categoryRate = getCostCategoryRate(yearOverride, s.categoryKey);
        const fromCategoryOverride =
          typeof categoryRate === 'number'
            ? round2(previousAmount * (1 + categoryRate))
            : undefined;
        const amount =
          fromLineOverride ?? fromCategoryOverride ?? defaultAmount;
        prevCostByCategory[s.categoryKey] = amount;
        return {
          tiliryhma: s.categoryKey,
          nimi: s.categoryKey,
          summa: amount,
        };
      });
      const totalCosts = round2(
        costDetails.reduce((sum, l) => sum + l.summa, 0),
      );

      // ── Depreciation: baseline from base-year poisto inputs (flat) ──
      const poistoPerusta = round2(
        depreciationSubtotals.reduce((sum, s) => sum + s.summa, 0),
      );

      // ── Financial costs (flat) ──
      const totalFinancialCosts = round2(
        financialCosts.reduce((sum, s) => sum + s.summa, 0),
      );

      // ── Investments (grow with investointikerroin) + user investments merged per year ──
      const investmentGrowthRate = pctToRate(
        yearOverride?.categoryGrowthPct?.investments,
      );
      const investmentDetails = investmentSubtotals.map((s) => {
        const defaultAmount = round2(
          s.summa * Math.pow(1 + investointikerroin, n),
        );
        const previousAmount =
          prevInvestmentByCategory[s.categoryKey] ?? round2(s.summa);
        const lineOverride = yearOverride?.lineOverrides?.[s.categoryKey];
        const fromLineOverride = applyLineOverride(
          lineOverride,
          previousAmount,
        );
        const fromCategoryOverride =
          typeof investmentGrowthRate === 'number'
            ? round2(previousAmount * (1 + investmentGrowthRate))
            : undefined;
        const amount =
          fromLineOverride ?? fromCategoryOverride ?? defaultAmount;
        prevInvestmentByCategory[s.categoryKey] = amount;
        return {
          tiliryhma: s.categoryKey,
          nimi: s.categoryKey,
          summa: amount,
        };
      });
      let totalInvestments = round2(
        investmentDetails.reduce((sum, l) => sum + l.summa, 0),
      );
      const userInvForYear = (userInvestments ?? [])
        .filter((u) => u.year === year)
        .reduce((s, u) => s + (u.amount ?? 0), 0);
      const yearOverrideInvestment =
        typeof yearOverride?.investmentEur === 'number'
          ? yearOverride.investmentEur
          : undefined;
      totalInvestments = round2(
        totalInvestments + (yearOverrideInvestment ?? userInvForYear),
      );

      // ── Investment-driven additional depreciation (ADR: additional from investment plan) ──
      const poistoInvestoinneista = round2(
        totalInvestments * investoinninPoistoOsuus,
      );

      // ── Expenses total (costs + baseline depreciation + investment depreciation + financial costs) ──
      const kulutYhteensa = round2(
        totalCosts +
          poistoPerusta +
          poistoInvestoinneista +
          totalFinancialCosts,
      );

      // ── Net result: TULOS = income minus expenses (TULOT - KULUT). Investments shown separately. ──
      const tulos = round2(tulotYhteensa - kulutYhteensa);
      cumulative = round2(cumulative + tulos);

      // Kassaflöde = Tulos − Investoinnit; Ackumulerad kassa = running sum
      const kassafloede = round2(tulos - totalInvestments);
      ackumCumulative = round2(ackumCumulative + kassafloede);

      // Water price/volume for display
      const totalVolume = round2(
        driverDetails
          .filter(
            (driver) =>
              driver.palvelutyyppi === 'vesi' ||
              driver.palvelutyyppi === 'jatevesi',
          )
          .reduce((sum, driver) => sum + driver.myytyMaara, 0),
      );

      years.push({
        vuosi: year,
        tulotYhteensa,
        kulutYhteensa,
        investoinnitYhteensa: totalInvestments,
        poistoPerusta,
        poistoInvestoinneista,
        tulos,
        kumulatiivinenTulos: cumulative,
        kassafloede,
        ackumuleradKassa: ackumCumulative,
        vesihinta: avgWaterPrice,
        myytyVesimaara: totalVolume,
        erittelyt: {
          tulot: otherIncomeDetails,
          kulut: costDetails,
          investoinnit: investmentDetails,
          ajurit: driverDetails,
        },
      });
    }

    return years;
  }

  /**
   * Compute required tariff P (€/m³) such that min(Ackumulerad kassa over horizon) ≥ 0.
   * Uses binary search. Returns null if infeasible (zero/negative volume, or no P keeps cash ≥ 0).
   */
  computeRequiredTariff(
    baseYear: number,
    horizonYears: number,
    subtotals: SubtotalInput[],
    drivers: RevenueDriverInput[],
    assumptions: AssumptionMap,
    baseFeeOverrides?: Record<number, number>,
    driverPaths?: DriverPaths,
    userInvestments?: Array<{ year: number; amount: number }>,
    projectionYearOverrides?: ProjectionYearOverrides,
  ): number | null {
    const solverYearOverrides = stripWaterPriceOverrides(
      projectionYearOverrides,
    );
    // Build driverPaths that force yksikkohinta = trialP for all water drivers, preserving volume from driverPaths
    const buildTrialPaths = (trialP: number): DriverPaths => {
      const years = Array.from(
        { length: horizonYears + 1 },
        (_, i) => baseYear + i,
      );
      const values: Record<number, number> = {};
      years.forEach((y) => {
        values[y] = trialP;
      });
      const pricePlan = { mode: 'manual' as const, values };
      return {
        vesi: { ...driverPaths?.vesi, yksikkohinta: pricePlan },
        jatevesi: { ...driverPaths?.jatevesi, yksikkohinta: pricePlan },
      };
    };

    const runTrial = (trialP: number): ComputedYear[] => {
      const trialPaths = buildTrialPaths(trialP);
      return this.computeFromSubtotals(
        baseYear,
        horizonYears,
        subtotals,
        drivers,
        assumptions,
        baseFeeOverrides,
        trialPaths,
        userInvestments,
        solverYearOverrides,
      );
    };

    // Get volume series from one run with current drivers
    const baselineYears = runTrial(
      weightedCombinedUnitPrice(
        drivers.filter(
          (driver) =>
            driver.palvelutyyppi === 'vesi' ||
            driver.palvelutyyppi === 'jatevesi',
        ),
      ),
    );
    const volumes = baselineYears.map((y) => y.myytyVesimaara);

    // Edge case: zero or negative volume in any year
    if (volumes.some((v) => !Number.isFinite(v) || v <= 0)) {
      return null;
    }

    const checkFeasible = (years: ComputedYear[]): boolean => {
      return years.every((y) => y.ackumuleradKassa >= 0);
    };

    // Binary search: find minimum P such that checkFeasible
    const P_MAX = 100; // €/m³ upper bound
    const TOL = 0.005; // 0.5 cent precision
    let lo = 0;
    let hi = P_MAX;

    // Check if P=0 is feasible (no tariff needed)
    const atZero = runTrial(0);
    if (checkFeasible(atZero)) {
      return round2(0);
    }

    // Check if P_MAX is feasible; if not, infeasible
    const atMax = runTrial(P_MAX);
    if (!checkFeasible(atMax)) {
      return null;
    }

    while (hi - lo > TOL) {
      const mid = (lo + hi) / 2;
      const years = runTrial(mid);
      if (checkFeasible(years)) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    return round2(hi);
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
      const volumeRevenue =
        d.yksikkohinta * priceFactor * d.myytyMaara * volumeFactor;
      const baseFeeRevenue = d.perusmaksu * d.liittymamaara;
      return sum + volumeRevenue + baseFeeRevenue;
    }, 0);
  }
}
