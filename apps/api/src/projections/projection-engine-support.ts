import type { DriverPaths } from './driver-paths';
import type { ProjectionYearOverride, ProjectionYearOverrides } from './year-overrides';
import {
  type AssumptionMap,
  type ComputedYear,
  type DepreciationRuleConfig,
  type LinearCohort,
  type ResidualCohort,
  type RevenueDriverInput,
  type ScheduleCohort,
  type SubtotalInput,
  type UserInvestmentSnapshotRule,
  readYearRateOverrides,
  stripWaterPriceOverrides,
  weightedCombinedUnitPrice,
  round2,
} from './projection-engine-model';

export function readDepreciationRules(
  assumptions: AssumptionMap,
): Map<string, DepreciationRuleConfig> {
  const out = new Map<string, DepreciationRuleConfig>();
  const rawRules =
    (assumptions as unknown as Record<string, unknown>).depreciationRules ?? null;
  if (!Array.isArray(rawRules)) return out;

  for (const raw of rawRules) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const classKey = String(row.classKey ?? '').trim();
    const method = String(row.method ?? '').trim().toLowerCase();
    if (!classKey) continue;
    if (
      method !== 'linear' &&
      method !== 'residual' &&
      method !== 'straight-line' &&
      method !== 'custom-annual-schedule' &&
      method !== 'none'
    ) {
      continue;
    }

    const linearYearsRaw = Number(
      row.linearYears ?? row.usefulLifeYears ?? row.depreciationYears,
    );
    const residualPercentRaw = Number(row.residualPercent ?? row.residualRate);
    const annualScheduleRaw = Array.isArray(row.annualSchedule)
      ? row.annualSchedule.map((item) => Number(item))
      : null;

    const rule: DepreciationRuleConfig = { classKey, method };
    if (Number.isFinite(linearYearsRaw) && linearYearsRaw > 0) {
      rule.linearYears = Math.round(linearYearsRaw);
    }
    if (Number.isFinite(residualPercentRaw) && residualPercentRaw >= 0) {
      rule.residualPercent = residualPercentRaw;
    }
    if (
      annualScheduleRaw &&
      annualScheduleRaw.length > 0 &&
      annualScheduleRaw.every((value) => Number.isFinite(value) && value >= 0)
    ) {
      rule.annualSchedule = annualScheduleRaw.map((value) => round2(value));
    }
    out.set(classKey, rule);
  }

  return out;
}

export function readInvestmentSnapshotRule(
  item: { depreciationRuleSnapshot?: UserInvestmentSnapshotRule | null },
): DepreciationRuleConfig | null {
  const snapshot = item.depreciationRuleSnapshot;
  if (!snapshot) return null;
  const classKey = String(snapshot.assetClassKey ?? '').trim();
  if (!classKey) return null;
  return {
    classKey,
    method: snapshot.method,
    linearYears:
      snapshot.linearYears == null ? undefined : Math.round(snapshot.linearYears),
    residualPercent:
      snapshot.residualPercent == null ? undefined : snapshot.residualPercent,
    annualSchedule: Array.isArray(snapshot.annualSchedule)
      ? snapshot.annualSchedule.map((value) => round2(Number(value)))
      : undefined,
  };
}

export function readYearClassAllocations(
  yearOverride: ProjectionYearOverride | undefined,
): Array<{ classKey: string; sharePct: number }> {
  const raw =
    (yearOverride as unknown as Record<string, unknown> | undefined)
      ?.investmentClassAllocations ?? null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  const out: Array<{ classKey: string; sharePct: number }> = [];
  for (const [classKey, shareRaw] of Object.entries(raw as Record<string, unknown>)) {
    const key = classKey.trim();
    const sharePct = Number(shareRaw);
    if (!key) continue;
    if (!Number.isFinite(sharePct) || sharePct <= 0) continue;
    out.push({ classKey: key, sharePct });
  }

  return out;
}

export function addDepreciationCohort(
  linearCohorts: LinearCohort[],
  residualCohorts: ResidualCohort[],
  scheduleCohorts: ScheduleCohort[],
  rule: DepreciationRuleConfig,
  amount: number,
) {
  if (!Number.isFinite(amount) || amount <= 0) return;
  if (rule.method === 'none') return;

  if (rule.method === 'linear' || rule.method === 'straight-line') {
    const years = Math.max(1, Math.round(rule.linearYears ?? 0));
    linearCohorts.push({
      annualDepreciation: round2(amount / years),
      remainingYears: years,
    });
    return;
  }

  if (rule.method === 'custom-annual-schedule') {
    const schedule = (rule.annualSchedule ?? [])
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => round2((amount * value) / 100));
    if (schedule.length === 0) return;
    scheduleCohorts.push({
      annualAmounts: schedule,
      nextIndex: 0,
    });
    return;
  }

  if (rule.method === 'residual') {
    const annualRatePct = Number(rule.residualPercent ?? 0);
    const annualRate = annualRatePct / 100;
    if (!Number.isFinite(annualRate) || annualRate <= 0) return;
    residualCohorts.push({
      remainingBookValue: round2(amount),
      annualRate,
    });
  }
}

export function computeYearCohortDepreciation(
  linearCohorts: LinearCohort[],
  residualCohorts: ResidualCohort[],
  scheduleCohorts: ScheduleCohort[],
): number {
  let total = 0;

  for (const cohort of linearCohorts) {
    if (cohort.remainingYears <= 0) continue;
    total += cohort.annualDepreciation;
    cohort.remainingYears -= 1;
  }

  for (const cohort of residualCohorts) {
    if (cohort.remainingBookValue <= 0) continue;
    if (!Number.isFinite(cohort.annualRate) || cohort.annualRate <= 0) continue;
    const depreciation = Math.min(
      cohort.remainingBookValue,
      round2(cohort.remainingBookValue * cohort.annualRate),
    );
    total += depreciation;
    cohort.remainingBookValue = round2(cohort.remainingBookValue - depreciation);
  }

  for (const cohort of scheduleCohorts) {
    if (cohort.nextIndex >= cohort.annualAmounts.length) continue;
    total += cohort.annualAmounts[cohort.nextIndex] ?? 0;
    cohort.nextIndex += 1;
  }

  for (let i = linearCohorts.length - 1; i >= 0; i -= 1) {
    if (linearCohorts[i].remainingYears <= 0) linearCohorts.splice(i, 1);
  }
  for (let i = residualCohorts.length - 1; i >= 0; i -= 1) {
    if (residualCohorts[i].remainingBookValue <= 0.01) residualCohorts.splice(i, 1);
  }
  for (let i = scheduleCohorts.length - 1; i >= 0; i -= 1) {
    if (scheduleCohorts[i].nextIndex >= scheduleCohorts[i].annualAmounts.length) {
      scheduleCohorts.splice(i, 1);
    }
  }

  return round2(total);
}

export function computeDriverRevenue(
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

export function computeRequiredTariffForAnnualResultZero(params: {
  baseYear: number;
  horizonYears: number;
  subtotals: SubtotalInput[];
  drivers: RevenueDriverInput[];
  assumptions: AssumptionMap;
  baseFeeOverrides?: Record<number, number>;
  driverPaths?: DriverPaths;
  userInvestments?: Array<{ year: number; amount: number }>;
  projectionYearOverrides?: ProjectionYearOverrides;
  computeFromSubtotals: (
    baseYear: number,
    horizonYears: number,
    subtotals: SubtotalInput[],
    drivers: RevenueDriverInput[],
    assumptions: AssumptionMap,
    baseFeeOverrides?: Record<number, number>,
    driverPaths?: DriverPaths,
    userInvestments?: Array<{ year: number; amount: number }>,
    projectionYearOverrides?: ProjectionYearOverrides,
  ) => ComputedYear[];
}): number | null {
  const {
    baseYear,
    horizonYears,
    subtotals,
    drivers,
    assumptions,
    baseFeeOverrides,
    driverPaths,
    userInvestments,
    projectionYearOverrides,
    computeFromSubtotals,
  } = params;

  const solverYearOverrides = stripWaterPriceOverrides(projectionYearOverrides);
  const buildTrialPaths = (trialP: number): DriverPaths => {
    const years = Array.from({ length: horizonYears + 1 }, (_, i) => baseYear + i);
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
    return computeFromSubtotals(
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

  const baselineYears = runTrial(
    weightedCombinedUnitPrice(
      drivers.filter(
        (driver) =>
          driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi',
      ),
    ),
  );
  const firstYear = baselineYears[0];
  if (!firstYear || !Number.isFinite(firstYear.myytyVesimaara)) {
    return null;
  }
  if (firstYear.myytyVesimaara <= 0) {
    return null;
  }

  const checkFeasible = (years: ComputedYear[]): boolean =>
    years.length > 0 && years[0].tulos >= 0;

  const P_MAX = 100;
  const TOL = 0.005;
  let lo = 0;
  let hi = P_MAX;

  const atZero = runTrial(0);
  if (checkFeasible(atZero)) {
    return round2(0);
  }

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
