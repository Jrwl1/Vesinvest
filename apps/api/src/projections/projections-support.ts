import type { RevenueDriverInput } from './projection-engine.service';
import type { ProjectionsRepository } from './projections.repository';
import {
  type ProjectionYearOverrides,
  normalizeProjectionYearOverrides,
} from './year-overrides';

export type ProjectionWithBudget = NonNullable<
  Awaited<ReturnType<ProjectionsRepository['findById']>>
>;

export type ParsedUserInvestment = {
  year: number;
  amount: number;
  depreciationClassKey?: string | null;
  depreciationRuleSnapshot?:
    | {
        assetClassKey: string;
        assetClassName?: string | null;
        method:
          | 'linear'
          | 'residual'
          | 'straight-line'
          | 'custom-annual-schedule'
          | 'none';
        linearYears?: number | null;
        residualPercent?: number | null;
        annualSchedule?: number[] | null;
      }
    | null;
};

export type VuosiWithCashflow = NonNullable<ProjectionWithBudget['vuodet']>[number] & {
  kassafloede: number;
  ackumuleradKassa: number;
};

export type EnrichedProjection = Omit<ProjectionWithBudget, 'vuodet'> & {
  requiredTariff: number | null;
  vuodet?: VuosiWithCashflow[];
};

const SALES_REVENUE_CATEGORY_KEYS = new Set(['sales_revenue', 'liikevaihto']);

export function parseUserInvestments(
  raw: unknown,
): ParsedUserInvestment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: ParsedUserInvestment[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && 'year' in item && 'amount' in item) {
      const year = Math.round(Number(item.year));
      const amount = Number(item.amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;
      const depreciationClassKey =
        typeof (item as { depreciationClassKey?: unknown }).depreciationClassKey ===
        'string'
          ? (item as { depreciationClassKey?: string }).depreciationClassKey?.trim() ||
            null
          : null;
      const snapshotRaw = (item as { depreciationRuleSnapshot?: unknown })
        .depreciationRuleSnapshot;
      const depreciationRuleSnapshot =
        snapshotRaw && typeof snapshotRaw === 'object'
          ? {
              assetClassKey: String(
                (snapshotRaw as { assetClassKey?: unknown }).assetClassKey ?? '',
              ).trim(),
              assetClassName:
                typeof (snapshotRaw as { assetClassName?: unknown }).assetClassName ===
                'string'
                  ? (snapshotRaw as { assetClassName?: string }).assetClassName?.trim() ||
                    null
                  : null,
              method: String(
                (snapshotRaw as { method?: unknown }).method ?? 'none',
              ) as NonNullable<
                ParsedUserInvestment['depreciationRuleSnapshot']
              >['method'],
              linearYears:
                (snapshotRaw as { linearYears?: unknown }).linearYears == null
                  ? null
                  : Math.round(
                      Number((snapshotRaw as { linearYears?: unknown }).linearYears),
                    ),
              residualPercent:
                (snapshotRaw as { residualPercent?: unknown }).residualPercent == null
                  ? null
                  : Number(
                      (snapshotRaw as { residualPercent?: unknown }).residualPercent,
                    ),
              annualSchedule: Array.isArray(
                (snapshotRaw as { annualSchedule?: unknown }).annualSchedule,
              )
                ? ((snapshotRaw as { annualSchedule?: unknown[] }).annualSchedule ?? [])
                    .map((value) => Number(value))
                    .filter((value) => Number.isFinite(value))
                : null,
            }
          : null;
      out.push({
        year,
        amount,
        depreciationClassKey,
        depreciationRuleSnapshot:
          depreciationRuleSnapshot && depreciationRuleSnapshot.assetClassKey.length > 0
            ? depreciationRuleSnapshot
            : null,
      });
    }
  }
  return out.length > 0 ? out : undefined;
}

export function parseProjectionYearOverrides(
  raw: unknown,
): ProjectionYearOverrides | undefined {
  return normalizeProjectionYearOverrides(raw);
}

export function hasUsableDriverVolume(drivers: RevenueDriverInput[]): boolean {
  return drivers.some(
    (driver) => Number.isFinite(driver.myytyMaara) && Number(driver.myytyMaara) > 0,
  );
}

export function collectRequiredDriverMissing(
  drivers: RevenueDriverInput[],
): string[] {
  const find = (service: 'vesi' | 'jatevesi') =>
    drivers.find((driver) => driver.palvelutyyppi === service);
  const water = find('vesi');
  const wastewater = find('jatevesi');
  const missing: string[] = [];
  if (!water || !(Number(water.yksikkohinta) > 0)) missing.push('vesi.yksikkohinta');
  if (!water || !(Number(water.myytyMaara) > 0)) missing.push('vesi.myytyMaara');
  if (!wastewater || !(Number(wastewater.yksikkohinta) > 0)) {
    missing.push('jatevesi.yksikkohinta');
  }
  if (!wastewater || !(Number(wastewater.myytyMaara) > 0)) {
    missing.push('jatevesi.myytyMaara');
  }
  return missing;
}

export function isImportedDriverMeta(sourceMeta: unknown): boolean {
  if (!sourceMeta || typeof sourceMeta !== 'object') return false;
  const meta = sourceMeta as Record<string, unknown>;
  return meta.imported === true && meta.manualOverride !== true;
}

export function waterSalesRevenueFromSubtotals(
  valisummat:
    | Array<{ categoryKey: string; tyyppi: string; summa: unknown }>
    | undefined,
): number {
  return (valisummat ?? [])
    .filter(
      (line) =>
        line.tyyppi === 'tulo' &&
        SALES_REVENUE_CATEGORY_KEYS.has(line.categoryKey),
    )
    .reduce((sum, line) => {
      const amount = Number(line.summa);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
}

export function waterDriverRevenue(
  drivers: RevenueDriverInput[],
  baseFeeTotal = 0,
): number {
  return (
    drivers
      .filter(
        (driver) =>
          driver.palvelutyyppi === 'vesi' ||
          driver.palvelutyyppi === 'jatevesi',
      )
      .reduce(
        (sum, driver) =>
          sum +
          driver.yksikkohinta * driver.myytyMaara +
          (driver.perusmaksu ?? 0) * (driver.liittymamaara ?? 0),
        0,
      ) + (Number.isFinite(baseFeeTotal) ? Number(baseFeeTotal) : 0)
  );
}

export function shouldUseSubtotalFallbackForImportedDrivers(
  budget: {
    valisummat?: Array<{
      categoryKey: string;
      tyyppi: string;
      summa: unknown;
    }>;
    tuloajurit?: Array<{ palvelutyyppi: string; sourceMeta?: unknown }>;
  },
  drivers: RevenueDriverInput[],
  hasExplicitDriverPaths: boolean,
): boolean {
  if (hasExplicitDriverPaths) return false;
  if (!budget.valisummat || budget.valisummat.length === 0) return false;

  const importedWaterDrivers = (budget.tuloajurit ?? []).filter(
    (driver) =>
      (driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi') &&
      isImportedDriverMeta(driver.sourceMeta),
  );
  if (importedWaterDrivers.length === 0) return false;

  const subtotalSalesRevenue = waterSalesRevenueFromSubtotals(budget.valisummat);
  if (!(subtotalSalesRevenue > 0)) return false;

  const driverRevenue = waterDriverRevenue(
    drivers,
    Number((budget as { perusmaksuYhteensa?: unknown }).perusmaksuYhteensa ?? 0),
  );
  if (!(driverRevenue > 0)) return true;

  return driverRevenue < subtotalSalesRevenue * 0.25;
}
