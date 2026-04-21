import { BadRequestException } from '@nestjs/common';
import { V2ForecastScenarioMetaSupport } from './v2-forecast-scenario-meta-support';
import {
  SCENARIO_ASSUMPTION_KEYS,
  SCENARIO_TYPE_OVERRIDE_KEY,
  type DepreciationMethod,
  type NearTermExpenseAssumption,
  type ScenarioAssumptionKey,
  type ThereafterExpenseAssumption,
  type YearlyInvestment,
} from './v2-forecast.types';

export class V2ForecastInputModelSupport {
  constructor(
    private readonly scenarioMetaSupport: V2ForecastScenarioMetaSupport,
  ) {}

  toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  normalizeNonNegativeNullable(value: number | null): number | null {
    if (value == null) return null;
    return this.round2(Math.max(0, value));
  }

  summaryValuesDiffer(left: number | null, right: number | null): boolean {
    if (left == null && right == null) return false;
    if (left == null || right == null) return true;
    return Math.abs(left - right) > 0.005;
  }

  computeCombinedPrice(
    drivers: Array<{ yksikkohinta: unknown; myytyMaara: unknown }>,
  ): number {
    const totalVolume = drivers.reduce(
      (sum, row) => sum + this.toNumber(row.myytyMaara),
      0,
    );
    if (totalVolume <= 0) return 0;
    const totalRevenue = drivers.reduce((sum, row) => {
      return (
        sum + this.toNumber(row.yksikkohinta) * this.toNumber(row.myytyMaara)
      );
    }, 0);
    return totalRevenue / totalVolume;
  }

  normalizeYearOverrides(
    raw: unknown,
  ): Record<number, Record<string, unknown>> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<number, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const year = Number.parseInt(key, 10);
      if (!Number.isFinite(year) || !value || typeof value !== 'object') {
        continue;
      }
      out[year] = { ...(value as Record<string, unknown>) };
    }
    return out;
  }

  normalizeUserInvestments(raw: unknown): YearlyInvestment[] {
    if (!Array.isArray(raw)) return [];
    const normalized: YearlyInvestment[] = [];
    for (const [index, item] of raw.entries()) {
      if (!item || typeof item !== 'object') continue;
      const year = Math.round(Number((item as { year?: unknown }).year));
      const amount = Number((item as { amount?: unknown }).amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;

      const rowIdRaw = this.scenarioMetaSupport.normalizeText(
        typeof (item as { rowId?: unknown }).rowId === 'string'
          ? (item as { rowId?: string }).rowId
          : null,
      );
      const category = this.scenarioMetaSupport.normalizeText(
        typeof (item as { category?: unknown }).category === 'string'
          ? (item as { category?: string }).category
          : null,
      );
      const depreciationClassKey = this.scenarioMetaSupport.normalizeText(
        typeof (item as { depreciationClassKey?: unknown })
          .depreciationClassKey === 'string'
          ? (item as { depreciationClassKey?: string }).depreciationClassKey
          : null,
      );
      const depreciationRuleSnapshotRaw =
        (item as { depreciationRuleSnapshot?: unknown }).depreciationRuleSnapshot;
      const depreciationRuleSnapshot =
        depreciationRuleSnapshotRaw &&
        typeof depreciationRuleSnapshotRaw === 'object'
          ? {
              assetClassKey: String(
                (
                  depreciationRuleSnapshotRaw as { assetClassKey?: unknown }
                ).assetClassKey ?? '',
              ).trim(),
              assetClassName: this.scenarioMetaSupport.normalizeText(
                typeof (
                  depreciationRuleSnapshotRaw as { assetClassName?: unknown }
                ).assetClassName === 'string'
                  ? (
                      depreciationRuleSnapshotRaw as {
                        assetClassName?: string;
                      }
                    ).assetClassName
                  : null,
              ),
              method: String(
                (depreciationRuleSnapshotRaw as { method?: unknown }).method ??
                  'none',
              ) as DepreciationMethod,
              linearYears:
                (
                  depreciationRuleSnapshotRaw as { linearYears?: unknown }
                ).linearYears == null
                  ? null
                  : Math.round(
                      this.toNumber(
                        (
                          depreciationRuleSnapshotRaw as {
                            linearYears?: unknown;
                          }
                        ).linearYears,
                      ),
                    ),
              residualPercent:
                (
                  depreciationRuleSnapshotRaw as {
                    residualPercent?: unknown;
                  }
                ).residualPercent == null
                  ? null
                  : this.round2(
                      this.toNumber(
                        (
                          depreciationRuleSnapshotRaw as {
                            residualPercent?: unknown;
                          }
                        ).residualPercent,
                      ),
                    ),
              annualSchedule: Array.isArray(
                (
                  depreciationRuleSnapshotRaw as {
                    annualSchedule?: unknown;
                  }
                ).annualSchedule,
              )
                ? (
                    (
                      depreciationRuleSnapshotRaw as {
                        annualSchedule?: unknown[];
                      }
                    ).annualSchedule ?? []
                  ).map((value) => this.round2(this.toNumber(value)))
                : null,
            }
          : null;
      const target = this.scenarioMetaSupport.normalizeText(
        typeof (item as { target?: unknown }).target === 'string'
          ? (item as { target?: string }).target
          : null,
      );
      const investmentTypeRaw = this.scenarioMetaSupport.normalizeText(
        typeof (item as { investmentType?: unknown }).investmentType === 'string'
          ? (item as { investmentType?: string }).investmentType
          : null,
      );
      const confidenceRaw = this.scenarioMetaSupport.normalizeText(
        typeof (item as { confidence?: unknown }).confidence === 'string'
          ? (item as { confidence?: string }).confidence
          : null,
      );
      const note = this.scenarioMetaSupport.normalizeText(
        typeof (item as { note?: unknown }).note === 'string'
          ? (item as { note?: string }).note
          : null,
      );
      const vesinvestPlanId = this.scenarioMetaSupport.normalizeText(
        typeof (item as { vesinvestPlanId?: unknown }).vesinvestPlanId ===
          'string'
          ? (item as { vesinvestPlanId?: string }).vesinvestPlanId
          : null,
      );
      const vesinvestProjectId = this.scenarioMetaSupport.normalizeText(
        typeof (item as { vesinvestProjectId?: unknown }).vesinvestProjectId ===
          'string'
          ? (item as { vesinvestProjectId?: string }).vesinvestProjectId
          : null,
      );
      const allocationId = this.scenarioMetaSupport.normalizeText(
        typeof (item as { allocationId?: unknown }).allocationId === 'string'
          ? (item as { allocationId?: string }).allocationId
          : null,
      );
      const projectCode = this.scenarioMetaSupport.normalizeText(
        typeof (item as { projectCode?: unknown }).projectCode === 'string'
          ? (item as { projectCode?: string }).projectCode
          : null,
      );
      const groupKey = this.scenarioMetaSupport.normalizeText(
        typeof (item as { groupKey?: unknown }).groupKey === 'string'
          ? (item as { groupKey?: string }).groupKey
          : null,
      );
      const accountKey = this.scenarioMetaSupport.normalizeText(
        typeof (item as { accountKey?: unknown }).accountKey === 'string'
          ? (item as { accountKey?: string }).accountKey
          : null,
      );
      const reportGroupKey = this.scenarioMetaSupport.normalizeText(
        typeof (item as { reportGroupKey?: unknown }).reportGroupKey ===
          'string'
          ? (item as { reportGroupKey?: string }).reportGroupKey
          : null,
      );
      const waterAmount = this.normalizeNonNegativeNullable(
        typeof (item as { waterAmount?: unknown }).waterAmount === 'number' ||
          typeof (item as { waterAmount?: unknown }).waterAmount === 'string'
          ? Number((item as { waterAmount?: unknown }).waterAmount)
          : null,
      );
      const wastewaterAmount = this.normalizeNonNegativeNullable(
        typeof (item as { wastewaterAmount?: unknown }).wastewaterAmount ===
          'number' ||
          typeof (item as { wastewaterAmount?: unknown }).wastewaterAmount ===
            'string'
          ? Number((item as { wastewaterAmount?: unknown }).wastewaterAmount)
          : null,
      );
      normalized.push({
        rowId: rowIdRaw ?? allocationId ?? `investment-${year}-${index}`,
        year,
        amount,
        target,
        category,
        depreciationClassKey,
        depreciationRuleSnapshot:
          (depreciationRuleSnapshot?.assetClassKey ?? '').length > 0
            ? depreciationRuleSnapshot
            : null,
        investmentType:
          investmentTypeRaw === 'replacement' || investmentTypeRaw === 'new'
            ? investmentTypeRaw
            : null,
        confidence:
          confidenceRaw === 'low' ||
          confidenceRaw === 'medium' ||
          confidenceRaw === 'high'
            ? confidenceRaw
            : null,
        waterAmount,
        wastewaterAmount,
        note,
        vesinvestPlanId,
        vesinvestProjectId,
        allocationId,
        projectCode,
        groupKey,
        accountKey,
        reportGroupKey,
      });
    }
    return normalized.sort((left, right) => {
      if (left.year !== right.year) {
        return left.year - right.year;
      }
      return (left.rowId ?? '').localeCompare(right.rowId ?? '');
    });
  }

  normalizeAssumptionOverrides(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (key === SCENARIO_TYPE_OVERRIDE_KEY) continue;
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) continue;
      out[key] = numeric;
    }
    return out;
  }

  normalizeScenarioAssumptionOverrides(
    raw: Partial<Record<ScenarioAssumptionKey, unknown>>,
  ): Partial<Record<ScenarioAssumptionKey, number>> {
    const out: Partial<Record<ScenarioAssumptionKey, number>> = {};
    for (const key of SCENARIO_ASSUMPTION_KEYS) {
      const numeric = Number(raw[key]);
      if (!Number.isFinite(numeric)) continue;
      out[key] = numeric;
    }
    return out;
  }

  normalizeThereafterExpenseAssumptions(raw: {
    personnelPct?: number;
    energyPct?: number;
    opexOtherPct?: number;
  }): ThereafterExpenseAssumption {
    return {
      personnelPct: this.round2(this.toNumber(raw.personnelPct)),
      energyPct: this.round2(this.toNumber(raw.energyPct)),
      opexOtherPct: this.round2(this.toNumber(raw.opexOtherPct)),
    };
  }

  buildThereafterExpenseAssumptions(
    assumptions: Record<string, number>,
  ): ThereafterExpenseAssumption {
    return {
      personnelPct: this.round2(
        this.toNumber(assumptions.henkilostokerroin) * 100,
      ),
      energyPct: this.round2(this.toNumber(assumptions.energiakerroin) * 100),
      opexOtherPct: this.round2(this.toNumber(assumptions.inflaatio) * 100),
    };
  }

  buildYearOverrides(
    investments: YearlyInvestment[],
    nearTermExpenseAssumptions: NearTermExpenseAssumption[],
    rawExistingOverrides?: unknown,
  ): Record<number, Record<string, unknown>> {
    const out = this.normalizeYearOverrides(rawExistingOverrides);

    for (const [yearKey, payload] of Object.entries(out)) {
      delete payload.investmentEur;

      const categoryGrowth = payload.categoryGrowthPct;
      if (categoryGrowth && typeof categoryGrowth === 'object') {
        const categoryCopy = {
          ...(categoryGrowth as Record<string, unknown>),
        };
        delete categoryCopy.personnel;
        delete categoryCopy.energy;
        delete categoryCopy.opexOther;
        if (Object.keys(categoryCopy).length > 0) {
          payload.categoryGrowthPct = categoryCopy;
        } else {
          delete payload.categoryGrowthPct;
        }
      }

      if (Object.keys(payload).length === 0) {
        delete out[Number(yearKey)];
      }
    }

    for (const item of investments) {
      const year = Math.round(Number(item.year));
      const amount = Number(item.amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;
      out[year] = {
        ...(out[year] ?? {}),
        investmentEur: this.round2(this.toNumber(out[year]?.investmentEur) + amount),
      };
    }

    for (const row of nearTermExpenseAssumptions) {
      const year = Math.round(Number(row.year));
      if (!Number.isFinite(year)) continue;
      const currentCategoryGrowth = out[year]?.categoryGrowthPct;
      const mergedCategoryGrowth =
        currentCategoryGrowth && typeof currentCategoryGrowth === 'object'
          ? { ...(currentCategoryGrowth as Record<string, unknown>) }
          : {};
      out[year] = {
        ...(out[year] ?? {}),
        categoryGrowthPct: {
          ...mergedCategoryGrowth,
          personnel: this.round2(row.personnelPct),
          energy: this.round2(row.energyPct),
          opexOther: this.round2(row.opexOtherPct),
        },
      };
    }

    return out;
  }

  normalizeNearTermExpenseAssumptions(
    raw: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>,
    baseYear: number | null,
  ): NearTermExpenseAssumption[] {
    if (!Array.isArray(raw) || baseYear == null) return [];
    const out: NearTermExpenseAssumption[] = [];
    const seenYears = new Set<number>();
    for (const item of raw) {
      const year = Math.round(Number(item.year));
      if (!Number.isFinite(year)) continue;
      if (year < baseYear || year > baseYear + 4) {
        throw new BadRequestException(
          `Near-term expense year ${year} is outside the editable range ${baseYear}-${baseYear + 4}.`,
        );
      }
      if (seenYears.has(year)) {
        throw new BadRequestException(
          `Near-term expense year ${year} was provided more than once.`,
        );
      }
      seenYears.add(year);

      out.push({
        year,
        personnelPct: this.round2(
          this.normalizeNearTermPct(item.personnelPct, 'personnelPct'),
        ),
        energyPct: this.round2(
          this.normalizeNearTermPct(item.energyPct, 'energyPct'),
        ),
        opexOtherPct: this.round2(
          this.normalizeNearTermPct(item.opexOtherPct, 'opexOtherPct'),
        ),
      });
    }
    return out.sort((a, b) => a.year - b.year);
  }

  extractExplicitNearTermExpenseAssumptions(
    baseYear: number | null,
    rawOverrides: unknown,
  ): NearTermExpenseAssumption[] {
    if (baseYear == null) return [];
    const overrides = this.normalizeYearOverrides(rawOverrides);
    const out: NearTermExpenseAssumption[] = [];

    for (let year = baseYear; year <= baseYear + 4; year += 1) {
      const growth = overrides[year]?.categoryGrowthPct as
        | Record<string, unknown>
        | undefined;
      if (!growth || typeof growth !== 'object') continue;
      const personnel = this.toNumber(growth.personnel);
      const energy = this.toNumber(growth.energy);
      const opexOther = this.toNumber(growth.opexOther);
      out.push({
        year,
        personnelPct: this.round2(personnel),
        energyPct: this.round2(energy),
        opexOtherPct: this.round2(opexOther),
      });
    }

    return out;
  }

  buildNearTermExpenseAssumptions(
    baseYear: number | null,
    assumptions: Record<string, number>,
    rawOverrides: unknown,
  ): NearTermExpenseAssumption[] {
    if (baseYear == null) return [];
    const explicit = new Map(
      this.extractExplicitNearTermExpenseAssumptions(baseYear, rawOverrides).map(
        (row) => [row.year, row],
      ),
    );
    const defaultPersonnelPct = this.round2(
      this.toNumber(assumptions.henkilostokerroin) * 100,
    );
    const defaultEnergyPct = this.round2(
      this.toNumber(assumptions.energiakerroin) * 100,
    );
    const defaultOpexOtherPct = this.round2(
      this.toNumber(assumptions.inflaatio) * 100,
    );

    const out: NearTermExpenseAssumption[] = [];
    for (let year = baseYear; year <= baseYear + 4; year += 1) {
      const row = explicit.get(year);
      out.push({
        year,
        personnelPct: row?.personnelPct ?? defaultPersonnelPct,
        energyPct: row?.energyPct ?? defaultEnergyPct,
        opexOtherPct: row?.opexOtherPct ?? defaultOpexOtherPct,
      });
    }
    return out;
  }

  buildYearlyInvestments(
    projection: any,
    baseYear: number | null,
  ): YearlyInvestment[] {
    if (!baseYear) return [];

    const horizon = Math.max(0, Number(projection?.aikajaksoVuosia ?? 0));
    const userInvestments = Array.isArray(projection?.userInvestments)
      ? this.normalizeUserInvestments(projection.userInvestments)
      : [];
    const rows: YearlyInvestment[] = [];
    const populatedYears = new Set<number>();
    for (const item of userInvestments) {
      const year = Math.round(Number(item.year));
      if (!Number.isFinite(year)) {
        continue;
      }
      populatedYears.add(year);
      rows.push({
        ...item,
        rowId: item.rowId ?? `investment-${year}-${rows.length}`,
        amount: this.round2(this.toNumber(item.amount)),
      });
    }

    for (let offset = 0; offset <= horizon; offset += 1) {
      const year = baseYear + offset;
      if (populatedYears.has(year)) {
        continue;
      }
      rows.push({
        rowId: `year-${year}`,
        year,
        amount: 0,
        target: null,
        category: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        projectCode: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
      });
    }

    return rows.sort((left, right) => {
      if (left.year !== right.year) {
        return left.year - right.year;
      }
      return (left.rowId ?? '').localeCompare(right.rowId ?? '');
    });
  }

  normalizeNearTermPct(
    rawValue: unknown,
    fieldName: 'personnelPct' | 'energyPct' | 'opexOtherPct',
  ): number {
    const numeric = this.toNumber(rawValue);
    if (numeric < -100 || numeric > 100) {
      throw new BadRequestException(
        `Near-term ${fieldName} must stay within -100 to 100 percent.`,
      );
    }
    return numeric;
  }
}
