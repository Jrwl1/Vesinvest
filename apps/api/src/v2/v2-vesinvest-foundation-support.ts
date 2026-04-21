import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { V2ForecastService } from './v2-forecast.service';
import {
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
  DEFAULT_VESINVEST_REPORT_GROUP_DEFINITIONS,
  isVesinvestClassificationReviewRequired,
  normalizeVesinvestDepreciationClassKey,
  sortVesinvestGroupDefinitions,
  type VesinvestGroupDefinitionRecord,
} from './vesinvest-contract';
import type {
  CreatePlanBody,
  CurrentBaselineSnapshot,
  PlanProjectInput,
  SavedBaselineSourceState,
  UpdatePlanBody,
  VesinvestPlanRecord,
} from './v2-vesinvest.types';

export class V2VesinvestFoundationSupport {
  constructor(private readonly prisma: PrismaService) {}

  readBaselineSourceState(value: Prisma.JsonValue | null): SavedBaselineSourceState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        acceptedYears: [],
        latestAcceptedBudgetId: null,
        veetiId: null,
        utilityName: null,
        businessId: null,
        identitySource: null,
      };
    }
    const record = value as Record<string, unknown>;
    return {
      acceptedYears: this.normalizeYearList(record.acceptedYears),
      latestAcceptedBudgetId: this.normalizeText(
        typeof record.latestAcceptedBudgetId === 'string'
          ? record.latestAcceptedBudgetId
          : null,
      ),
      veetiId:
        typeof record.veetiId === 'number' && Number.isFinite(record.veetiId)
          ? Math.round(record.veetiId)
          : null,
      utilityName: this.normalizeText(
        typeof record.utilityName === 'string' ? record.utilityName : null,
      ),
      businessId: this.normalizeText(
        typeof record.businessId === 'string' ? record.businessId : null,
      ),
      identitySource:
        record.identitySource === 'veeti' ? ('veeti' as const) : null,
    };
  }

  hasSavedBaselineSnapshot(saved: SavedBaselineSourceState) {
    return (
      saved.acceptedYears.length > 0 ||
      (saved.latestAcceptedBudgetId?.length ?? 0) > 0
    );
  }

  hasSavedBaselineIdentityDrift(
    saved: SavedBaselineSourceState,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    if (!this.hasSavedBaselineSnapshot(saved)) {
      return false;
    }
    const bound = currentBaseline.utilityIdentity;
    if (!bound) {
      return true;
    }
    if (
      saved.veetiId == null ||
      !saved.utilityName ||
      saved.identitySource == null
    ) {
      return true;
    }
    return (
      saved.veetiId !== bound.veetiId ||
      saved.utilityName !== bound.utilityName ||
      (saved.businessId ?? null) !== (bound.businessId ?? null) ||
      saved.identitySource !== bound.identitySource
    );
  }

  hasUtilityIdentityDrift(
    plan: Pick<
      VesinvestPlanRecord,
      'veetiId' | 'utilityName' | 'businessId' | 'identitySource'
    >,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    const bound = currentBaseline.utilityIdentity;
    if (!bound) {
      return true;
    }
    return (
      (plan.veetiId ?? null) !== bound.veetiId ||
      plan.utilityName !== bound.utilityName ||
      (plan.businessId ?? null) !== (bound.businessId ?? null) ||
      plan.identitySource !== bound.identitySource
    );
  }

  assertIdentityMutationNotRequested(
    body: UpdatePlanBody,
    current: Pick<
      VesinvestPlanRecord,
      'utilityName' | 'businessId' | 'veetiId' | 'identitySource'
    >,
  ) {
    if (
      (body.utilityName !== undefined && body.utilityName !== current.utilityName) ||
      (body.businessId !== undefined &&
        (body.businessId ?? null) !== (current.businessId ?? null)) ||
      (body.veetiId !== undefined &&
        (body.veetiId ?? null) !== (current.veetiId ?? null)) ||
      (body.identitySource !== undefined &&
        body.identitySource !== current.identitySource)
    ) {
      throw new BadRequestException(
        'Utility identity is managed by the org VEETI binding and cannot be changed on a saved Vesinvest revision.',
      );
    }
  }

  assertPlanCanBecomeActive(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    if (this.hasUtilityIdentityDrift(plan, currentBaseline)) {
      throw new ConflictException(
        'Only revisions that match the current org utility binding can become active.',
      );
    }
    const savedBaseline = this.readBaselineSourceState(plan.baselineSourceState);
    if (this.requiresLegacyBaselineReverification(plan, savedBaseline)) {
      throw new ConflictException(
        'Legacy Vesinvest revisions must be re-verified against the current accepted baseline before they can become active.',
      );
    }
    if (
      this.hasSavedBaselineSnapshot(savedBaseline) &&
      this.hasSavedBaselineIdentityDrift(savedBaseline, currentBaseline)
    ) {
      throw new ConflictException(
        'Legacy Vesinvest revisions must be re-verified against the current utility binding before they can become active.',
      );
    }
  }

  requiresLegacyBaselineReverification(
    plan: Pick<
      VesinvestPlanRecord,
      'status' | 'selectedScenarioId' | 'feeRecommendationStatus' | 'baselineFingerprint'
    >,
    saved: SavedBaselineSourceState,
  ) {
    if (plan.baselineFingerprint || this.hasSavedBaselineSnapshot(saved)) {
      return false;
    }
    return (
      plan.status === 'active' ||
      plan.selectedScenarioId != null ||
      plan.feeRecommendationStatus !== 'blocked'
    );
  }

  async resolveGroupDefinition(orgId: string, groupKey: string) {
    return this.resolveGroupDefinitionFromMap(
      await this.getPersistedGroupDefinitionMap(orgId),
      groupKey,
    );
  }

  resolveGroupDefinitionFromMap(
    definitions: Map<string, VesinvestGroupDefinitionRecord>,
    groupKey: string,
  ) {
    const normalized = this.normalizeText(groupKey);
    const definition = normalized ? definitions.get(normalized) : null;
    if (!definition) {
      throw new BadRequestException(`Unknown investment group "${groupKey}".`);
    }
    return definition;
  }

  async listPersistedGroupDefinitions(orgId?: string) {
    const rows = await this.prisma.vesinvestGroupDefinition.findMany({
      orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
    });
    const persistedMap = new Map<string, VesinvestGroupDefinitionRecord>(
      rows.map((row) => [
        row.key,
        {
          key: row.key,
          label: row.label,
          defaultAccountKey: row.defaultAccountKey,
          defaultDepreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              row.key,
              row.defaultDepreciationClassKey,
            ) ?? row.key,
          reportGroupKey: row.reportGroupKey,
          serviceSplit: row.serviceSplit,
        },
      ]),
    );
    const base = DEFAULT_VESINVEST_GROUP_DEFINITIONS.map(
      (item) => persistedMap.get(item.key) ?? { ...item },
    );
    const extras = rows
      .filter((row) => !DEFAULT_VESINVEST_GROUP_DEFINITIONS.some((item) => item.key === row.key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        defaultAccountKey: row.defaultAccountKey,
        defaultDepreciationClassKey:
          normalizeVesinvestDepreciationClassKey(
            row.key,
            row.defaultDepreciationClassKey,
          ) ?? row.key,
        reportGroupKey: row.reportGroupKey,
        serviceSplit: row.serviceSplit,
      }));
    if (!orgId) {
      return sortVesinvestGroupDefinitions([...base, ...extras]);
    }
    const overrides = await this.prisma.vesinvestGroupOverride.findMany({
      where: { orgId },
      orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
    });
    if (overrides.length === 0) {
      return sortVesinvestGroupDefinitions([...base, ...extras]);
    }
    const overrideMap = new Map<string, VesinvestGroupDefinitionRecord>(
      overrides.map((row) => [
        row.key,
        {
          key: row.key,
          label: row.label,
          defaultAccountKey: row.defaultAccountKey,
          defaultDepreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              row.key,
              row.defaultDepreciationClassKey,
            ) ?? row.key,
          reportGroupKey: row.reportGroupKey,
          serviceSplit: row.serviceSplit,
        },
      ]),
    );
    const merged = [...base, ...extras].map((item) => overrideMap.get(item.key) ?? item);
    const overrideExtras = overrides
      .filter((row) => !merged.some((item) => item.key === row.key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        defaultAccountKey: row.defaultAccountKey,
        defaultDepreciationClassKey:
          normalizeVesinvestDepreciationClassKey(
            row.key,
            row.defaultDepreciationClassKey,
          ) ?? row.key,
        reportGroupKey: row.reportGroupKey,
        serviceSplit: row.serviceSplit,
      }));
    return sortVesinvestGroupDefinitions([...merged, ...overrideExtras]);
  }

  isClassificationReviewRequired(
    plan: VesinvestPlanRecord,
    groupDefinitions: Map<string, VesinvestGroupDefinitionRecord>,
  ) {
    return isVesinvestClassificationReviewRequired(
      plan.projects.map((project) => ({
        groupKey: project.groupKey,
        accountKey: project.accountKey,
        depreciationClassKey: project.depreciationClassKey,
      })),
      groupDefinitions,
    );
  }

  async getPersistedGroupDefinitionMap(orgId?: string) {
    return new Map<string, VesinvestGroupDefinitionRecord>(
      (await this.listPersistedGroupDefinitions(orgId)).map((item) => [
        item.key,
        item,
      ] as const),
    );
  }

  isAdminRole(roles: string[]) {
    return roles.some((role) => role.toUpperCase() === 'ADMIN');
  }

  normalizeServiceSplit(
    value: string | null | undefined,
  ): 'water' | 'wastewater' | 'mixed' | null {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }
    if (
      normalized !== 'water' &&
      normalized !== 'wastewater' &&
      normalized !== 'mixed'
    ) {
      throw new BadRequestException('Invalid Vesinvest service split.');
    }
    return normalized;
  }

  normalizeReportGroupKey(value: string | null | undefined) {
    const normalized = this.normalizeText(value);
    if (!normalized) {
      return null;
    }
    const allowed = new Set(
      DEFAULT_VESINVEST_REPORT_GROUP_DEFINITIONS.map((group) => group.key),
    );
    if (!allowed.has(normalized)) {
      throw new BadRequestException('Invalid Vesinvest report group.');
    }
    return normalized;
  }

  normalizeIdentitySource(
    value: CreatePlanBody['identitySource'],
  ): 'manual' | 'veeti' | 'mixed' {
    return value === 'veeti' || value === 'mixed' ? value : 'manual';
  }

  normalizeInvestmentType(
    value: PlanProjectInput['investmentType'],
  ): 'sanering' | 'nyanlaggning' | 'reparation' {
    if (
      value === 'sanering' ||
      value === 'nyanlaggning' ||
      value === 'reparation'
    ) {
      return value;
    }
    return 'sanering';
  }

  normalizeText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  normalizeJsonObject(
    value: unknown,
  ): Prisma.InputJsonValue | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Baseline source state must be an object.');
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  normalizeYearList(value: unknown): number[] {
    if (!Array.isArray(value)) {
      return [];
    }
    const unique = new Set<number>();
    for (const item of value) {
      const year = Math.round(Number(item));
      if (Number.isFinite(year)) {
        unique.add(year);
      }
    }
    return [...unique].sort((left, right) => left - right);
  }

  toNumber(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? this.round2(parsed) : 0;
  }

  toNumberNullable(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? this.round2(parsed) : 0;
  }

  toNullablePositiveNumber(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('Amount must be zero or greater.');
    }
    return this.round2(parsed);
  }

  normalizeDate(value: string | null) {
    if (value == null || value.trim().length === 0) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Date value is invalid.');
    }
    return parsed;
  }

  normalizeDateIso(value: Date | string | null | undefined) {
    if (value == null) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  addYears(date: Date, years: number) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  findDuplicateValues(values: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
        continue;
      }
      seen.add(value);
    }
    return [...duplicates].sort((left, right) => left.localeCompare(right));
  }

  resolveActivePlanRecord(plans: VesinvestPlanRecord[]) {
    const activePlans = plans
      .filter((plan) => plan.status === 'active')
      .sort((left, right) => {
        if (left.versionNumber !== right.versionNumber) {
          return right.versionNumber - left.versionNumber;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      });
    return activePlans[0] ?? null;
  }

  resolveSelectedPlanRecord(
    plans: VesinvestPlanRecord[],
    activePlan: VesinvestPlanRecord | null,
  ) {
    return plans[0] ?? activePlan ?? null;
  }

  buildFeeRecommendationSnapshot(
    plan: VesinvestPlanRecord,
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    currentBaseline: CurrentBaselineSnapshot,
    scenarioFingerprint: string,
  ) {
    const years = Array.isArray(scenario.years) ? scenario.years : [];
    const priceSeries = Array.isArray(scenario.priceSeries)
      ? scenario.priceSeries
      : [];
    const investmentSeries = Array.isArray(scenario.investmentSeries)
      ? scenario.investmentSeries
      : [];
    const annualResultFeeSufficiency = scenario.feeSufficiency?.annualResult ?? {
      peakDeficit: null,
      underfundingStartYear: null,
    };
    const cumulativeCashFeeSufficiency =
      scenario.feeSufficiency?.cumulativeCash ?? {
        peakGap: null,
        underfundingStartYear: null,
      };
    const firstYear = years[0] ?? null;
    return {
      savedAt: new Date().toISOString(),
      linkedScenarioId: scenario.id,
      baselineFingerprint: currentBaseline.fingerprint,
      scenarioFingerprint,
      baselineCombinedPrice: scenario.baselinePriceTodayCombined,
      totalInvestments: investmentSeries.reduce(
        (sum: number, item) => sum + this.toNumber(item.amount),
        0,
      ),
      combined: {
        baselinePriceToday: scenario.baselinePriceTodayCombined,
        annualResult: {
          requiredPriceToday: scenario.requiredPriceTodayCombinedAnnualResult,
          requiredAnnualIncreasePct:
            scenario.requiredAnnualIncreasePctAnnualResult,
          peakDeficit: annualResultFeeSufficiency.peakDeficit,
          underfundingStartYear: annualResultFeeSufficiency.underfundingStartYear,
        },
        cumulativeCash: {
          requiredPriceToday: scenario.requiredPriceTodayCombinedCumulativeCash,
          requiredAnnualIncreasePct:
            scenario.requiredAnnualIncreasePctCumulativeCash,
          peakGap: cumulativeCashFeeSufficiency.peakGap,
          underfundingStartYear: cumulativeCashFeeSufficiency.underfundingStartYear,
        },
      },
      water: {
        currentPrice: firstYear?.waterPrice ?? null,
        forecastPath: priceSeries.map((item) => ({
          year: item.year,
          price: item.waterPrice,
        })),
      },
      wastewater: {
        currentPrice: firstYear?.wastewaterPrice ?? null,
        forecastPath: priceSeries.map((item) => ({
          year: item.year,
          price: item.wastewaterPrice,
        })),
      },
      baseFee: {
        currentRevenue: firstYear?.baseFeeRevenue ?? null,
        connectionCount: firstYear?.connectionCount ?? null,
      },
      annualResults: years.map((item) => ({
        year: item.year,
        result: item.result,
        cashflow: item.cashflow,
        cumulativeCashflow: item.cumulativeCashflow,
      })),
      plan: {
        id: plan.id,
        seriesId: plan.seriesId,
        versionNumber: plan.versionNumber,
      },
    } as Prisma.InputJsonObject;
  }

  async resolveNextRevisionVersion(orgId: string, seriesId: string) {
    const plans = await this.prisma.vesinvestPlan.findMany({
      where: {
        orgId,
        seriesId,
      },
      select: {
        versionNumber: true,
      },
    });
    const highestVersion = plans.reduce(
      (maxVersion, plan) => Math.max(maxVersion, plan.versionNumber),
      0,
    );

    return highestVersion + 1;
}

}
