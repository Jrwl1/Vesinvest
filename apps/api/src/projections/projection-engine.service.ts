import { Injectable } from '@nestjs/common';
import { resolveDriverValue, type DriverPaths } from './driver-paths';
import type { ProjectionYearOverride, ProjectionYearOverrides } from './year-overrides';
import {
  applyLineOverride,
  type AssumptionMap,
  type BudgetLineInput,
  type ComputedYear,
  type DepreciationRuleConfig,
  ENERGY_ACCOUNT_PREFIX,
  getCostCategoryBucket,
  getCostCategoryRate,
  OTHER_OPERATING_SUBTOTAL_CATEGORY_KEYS,
  PERSONNEL_YEAR_OVERRIDE_PREFIX,
  pickYearOverride,
  pctToRate,
  readYearRateOverrides,
  SALES_REVENUE_CATEGORY_KEYS,
  stripWaterPriceOverrides,
  type LinearCohort,
  type ResidualCohort,
  type RevenueDriverInput,
  round2,
  type ScheduleCohort,
  type SubtotalInput,
  weightedCombinedUnitPrice,
  type UserInvestmentSnapshotRule,
} from './projection-engine-model';
import {
  addDepreciationCohort,
  computeDriverRevenue,
  computeRequiredTariffForAnnualResultZero,
  computeYearCohortDepreciation,
  readDepreciationRules,
  readInvestmentSnapshotRule,
  readYearClassAllocations,
} from './projection-engine-support';

export type {
  AssumptionMap,
  BudgetLineInput,
  RevenueDriverInput,
  SubtotalInput,
} from './projection-engine-model';

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
    userInvestments?: Array<{
      year: number;
      amount: number;
      depreciationClassKey?: string | null;
      depreciationRuleSnapshot?: UserInvestmentSnapshotRule | null;
    }>,
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
    const depreciationRulesByClass = this.readDepreciationRules(assumptions);
    const hasDepreciationRules = depreciationRulesByClass.size > 0;
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
    const linearCohorts: LinearCohort[] = [];
    const residualCohorts: ResidualCohort[] = [];
    const scheduleCohorts: ScheduleCohort[] = [];
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
      const userInvestmentsForYear = (userInvestments ?? []).filter(
        (u) => u.year === year,
      );
      const userInvForYear = userInvestmentsForYear.reduce(
        (s, u) => s + (u.amount ?? 0),
        0,
      );
      const yearOverrideInvestment =
        typeof yearOverride?.investmentEur === 'number'
          ? yearOverride.investmentEur
          : undefined;
      totalInvestments = round2(
        totalInvestments + (yearOverrideInvestment ?? userInvForYear),
      );

      // ── Investment-driven additional depreciation (ADR: additional from investment plan) ──
      // Supports class-based cohorts when rules + class allocations are provided.
      const classAllocations = this.readYearClassAllocations(yearOverride);
      let legacyInvestmentBase = totalInvestments;
      let snapshotAllocatedInvestment = 0;
      for (const item of userInvestmentsForYear) {
        const snapshotRule = this.readInvestmentSnapshotRule(item);
        if (!snapshotRule) continue;
        const amount = round2(Number(item.amount ?? 0));
        if (!Number.isFinite(amount) || amount <= 0) continue;
        this.addDepreciationCohort(
          linearCohorts,
          residualCohorts,
          scheduleCohorts,
          snapshotRule,
          amount,
        );
        snapshotAllocatedInvestment += amount;
      }
      legacyInvestmentBase = round2(Math.max(0, legacyInvestmentBase - snapshotAllocatedInvestment));
      if (
        hasDepreciationRules &&
        legacyInvestmentBase > 0 &&
        classAllocations.length > 0
      ) {
        let allocatedShare = 0;
        for (const allocation of classAllocations) {
          const rule = depreciationRulesByClass.get(allocation.classKey);
          if (!rule) continue;
          const safeShare = Math.max(0, Math.min(100, allocation.sharePct));
          if (safeShare <= 0) continue;
          allocatedShare += safeShare;
          const allocatedAmount = round2(
            legacyInvestmentBase * (safeShare / 100),
          );
          this.addDepreciationCohort(
            linearCohorts,
            residualCohorts,
            scheduleCohorts,
            rule,
            allocatedAmount,
          );
        }
        const unallocatedShare = Math.max(0, 100 - allocatedShare);
        legacyInvestmentBase = round2(
          legacyInvestmentBase * (unallocatedShare / 100),
        );
      }

      const cohortDepreciation = this.computeYearCohortDepreciation(
        linearCohorts,
        residualCohorts,
        scheduleCohorts,
      );
      const legacyDepreciation = round2(
        legacyInvestmentBase * investoinninPoistoOsuus,
      );
      const poistoInvestoinneista = round2(
        cohortDepreciation + legacyDepreciation,
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
   * Compute required tariff P (€/m³) such that first forecast-year annual result >= 0.
   * Uses binary search and keeps explicit compute semantics (trial pricing only).
   */

  private readDepreciationRules(assumptions: AssumptionMap): Map<string, DepreciationRuleConfig> {
    return readDepreciationRules(assumptions);
  }

  private readInvestmentSnapshotRule(item: { depreciationRuleSnapshot?: UserInvestmentSnapshotRule | null }): DepreciationRuleConfig | null {
    return readInvestmentSnapshotRule(item);
  }

  private readYearClassAllocations(yearOverride: ProjectionYearOverride | undefined): Array<{ classKey: string; sharePct: number }> {
    return readYearClassAllocations(yearOverride);
  }

  private addDepreciationCohort(
    linearCohorts: LinearCohort[],
    residualCohorts: ResidualCohort[],
    scheduleCohorts: ScheduleCohort[],
    rule: DepreciationRuleConfig,
    amount: number,
  ) {
    return addDepreciationCohort(linearCohorts, residualCohorts, scheduleCohorts, rule, amount);
  }

  private computeYearCohortDepreciation(
    linearCohorts: LinearCohort[],
    residualCohorts: ResidualCohort[],
    scheduleCohorts: ScheduleCohort[],
  ): number {
    return computeYearCohortDepreciation(linearCohorts, residualCohorts, scheduleCohorts);
  }

  computeRequiredTariffForAnnualResultZero(
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
    return computeRequiredTariffForAnnualResultZero({
      baseYear,
      horizonYears,
      subtotals,
      drivers,
      assumptions,
      baseFeeOverrides,
      driverPaths,
      userInvestments,
      projectionYearOverrides,
      computeFromSubtotals: (...args) => this.computeFromSubtotals(...args),
    });
  }

  private computeDriverRevenue(
    drivers: RevenueDriverInput[],
    priceFactor: number,
    volumeFactor: number,
  ): number {
    return computeDriverRevenue(drivers, priceFactor, volumeFactor);
  }
}
