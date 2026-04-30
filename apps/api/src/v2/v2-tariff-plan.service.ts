import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import type {
  TariffAllocationPolicy,
  TariffBaselineInput,
  TariffFeeKey,
  TariffFeeRecommendation,
  TariffPlanBody,
  TariffReadinessChecklist,
  TariffRecommendation,
} from './v2-tariff-plan.types';
import {
  computeVesinvestScenarioFingerprint,
  findVesinvestScenarioInvestmentMismatches,
} from './vesinvest-contract';

type VesinvestTariffPlanRow = Awaited<
  ReturnType<PrismaService['vesinvestTariffPlan']['findFirst']>
>;

const FEE_KEYS: TariffFeeKey[] = [
  'connectionFee',
  'baseFee',
  'waterUsageFee',
  'wastewaterUsageFee',
];

@Injectable()
export class V2TariffPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: V2ForecastService,
    private readonly importOverviewService?: V2ImportOverviewService,
  ) {}

  async getTariffPlan(orgId: string, vesinvestPlanId: string) {
    const { plan, scenario } = await this.resolvePlanAndScenario(
      orgId,
      vesinvestPlanId,
    );
    const existing = await this.findLatestPlan(orgId, plan.id, scenario.id);
    const current = await this.staleAcceptedPlanIfFingerprintsMoved(
      plan,
      scenario,
      existing,
    );
    const baselineVolumeDefaults = await this.resolveBaselineVolumeDefaults(
      orgId,
      scenario.baselineYear,
    );
    return this.toResponse(
      current,
      plan,
      scenario,
      this.readBaselineInput(
        current?.baselineInput ?? null,
        scenario,
        baselineVolumeDefaults,
      ),
      this.readAllocationPolicy(current?.allocationPolicy ?? null, plan),
    );
  }

  async upsertTariffPlan(
    orgId: string,
    vesinvestPlanId: string,
    body: TariffPlanBody,
  ) {
    const { plan, scenario } = await this.resolvePlanAndScenario(
      orgId,
      vesinvestPlanId,
    );
    const existing = await this.findEditablePlan(orgId, plan.id, scenario.id);
    const current = await this.findLatestPlan(orgId, plan.id, scenario.id);
    this.assertFreshTariffEditToken(current, body.expectedUpdatedAt);
    const baselineVolumeDefaults = await this.resolveBaselineVolumeDefaults(
      orgId,
      scenario.baselineYear,
    );
    const baselineInput = this.readBaselineInput(
      body.baselineInput ?? current?.baselineInput ?? null,
      scenario,
      baselineVolumeDefaults,
    );
    const allocationPolicy = this.readAllocationPolicy(
      body.allocationPolicy ?? current?.allocationPolicy ?? null,
      plan,
    );
    const revenueEvidence = this.readEvidenceObject(
      body.revenueEvidence !== undefined
        ? body.revenueEvidence
        : current?.revenueEvidence ?? null,
    );
    const costEvidence = this.readEvidenceObject(
      body.costEvidence !== undefined
        ? body.costEvidence
        : current?.costEvidence ?? null,
    );
    const regionalDifferentiationState = this.readEvidenceObject(
      body.regionalDifferentiationState !== undefined
        ? body.regionalDifferentiationState
        : current?.regionalDifferentiationState ?? null,
    );
    const stormwaterState = this.readEvidenceObject(
      body.stormwaterState !== undefined
        ? body.stormwaterState
        : current?.stormwaterState ?? null,
    );
    const specialUseState = this.readEvidenceObject(
      body.specialUseState !== undefined
        ? body.specialUseState
        : current?.specialUseState ?? null,
    );
    const connectionFeeLiabilityState = this.readEvidenceObject(
      body.connectionFeeLiabilityState !== undefined
        ? body.connectionFeeLiabilityState
        : current?.connectionFeeLiabilityState ?? null,
    );
    const ownerDistributionState = this.readEvidenceObject(
      body.ownerDistributionState !== undefined
        ? body.ownerDistributionState
        : current?.ownerDistributionState ?? null,
    );
    const recommendation = this.buildRecommendation(
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
      {
        revenueEvidence,
        costEvidence,
        regionalDifferentiationState,
        stormwaterState,
        specialUseState,
        connectionFeeLiabilityState,
        ownerDistributionState,
      },
    );
    const data = {
      orgId,
      vesinvestPlanId: plan.id,
      scenarioId: scenario.id,
      status: 'draft' as const,
      baselineInput: baselineInput as unknown as Prisma.InputJsonValue,
      allocationPolicy: allocationPolicy as unknown as Prisma.InputJsonValue,
      recommendation: recommendation as unknown as Prisma.InputJsonValue,
      readinessChecklist:
        recommendation.lawReadiness as unknown as Prisma.InputJsonValue,
      revenueEvidence:
        revenueEvidence == null
          ? Prisma.DbNull
          : (revenueEvidence as unknown as Prisma.InputJsonValue),
      costEvidence:
        costEvidence == null
          ? Prisma.DbNull
          : (costEvidence as unknown as Prisma.InputJsonValue),
      regionalDifferentiationState:
        regionalDifferentiationState == null
          ? Prisma.DbNull
          : (regionalDifferentiationState as unknown as Prisma.InputJsonValue),
      stormwaterState:
        stormwaterState == null
          ? Prisma.DbNull
          : (stormwaterState as unknown as Prisma.InputJsonValue),
      specialUseState:
        specialUseState == null
          ? Prisma.DbNull
          : (specialUseState as unknown as Prisma.InputJsonValue),
      connectionFeeLiabilityState:
        connectionFeeLiabilityState == null
          ? Prisma.DbNull
          : (connectionFeeLiabilityState as unknown as Prisma.InputJsonValue),
      ownerDistributionState:
        ownerDistributionState == null
          ? Prisma.DbNull
          : (ownerDistributionState as unknown as Prisma.InputJsonValue),
      acceptedAt: null,
    };
    const saved = existing
      ? await this.prisma.vesinvestTariffPlan.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.vesinvestTariffPlan.create({ data });

    return this.toResponse(
      saved,
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
    );
  }

  async acceptTariffPlan(
    orgId: string,
    vesinvestPlanId: string,
    body?: { expectedUpdatedAt?: string | null },
  ) {
    const { plan, scenario } = await this.resolvePlanAndScenario(
      orgId,
      vesinvestPlanId,
    );
    const existing = await this.findLatestPlan(orgId, plan.id, scenario.id);
    if (!existing) {
      throw new BadRequestException(
        'Save the tariff plan before accepting it.',
      );
    }
    this.assertFreshTariffEditToken(existing, body?.expectedUpdatedAt);
    const baselineVolumeDefaults = await this.resolveBaselineVolumeDefaults(
      orgId,
      scenario.baselineYear,
    );
    const baselineInput = this.readBaselineInput(
      existing.baselineInput,
      scenario,
      baselineVolumeDefaults,
    );
    const allocationPolicy = this.readAllocationPolicy(
      existing.allocationPolicy,
      plan,
    );
    const recommendation = this.buildRecommendation(
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
      {
        revenueEvidence: this.readEvidenceObject(existing.revenueEvidence),
        costEvidence: this.readEvidenceObject(existing.costEvidence),
        regionalDifferentiationState: this.readEvidenceObject(
          existing.regionalDifferentiationState,
        ),
        stormwaterState: this.readEvidenceObject(existing.stormwaterState),
        specialUseState: this.readEvidenceObject(existing.specialUseState),
        connectionFeeLiabilityState: this.readEvidenceObject(
          existing.connectionFeeLiabilityState,
        ),
        ownerDistributionState: this.readEvidenceObject(
          existing.ownerDistributionState,
        ),
      },
    );
    if (!recommendation.lawReadiness.isReady) {
      throw new ConflictException({
        code: 'TARIFF_PLAN_NOT_READY',
        message:
          'Tariff plan is not ready for report snapshot. Resolve readiness items before accepting.',
        readinessChecklist: recommendation.lawReadiness,
      });
    }

    const acceptedScenarioFingerprint =
      recommendation.scenarioFingerprint ??
      computeVesinvestScenarioFingerprint({
        scenarioId: scenario.id,
        updatedAt: scenario.updatedAt,
        computedFromUpdatedAt: scenario.computedFromUpdatedAt,
        yearlyInvestments: scenario.yearlyInvestments,
        years: scenario.years,
      });

    const accepted = await this.prisma.$transaction(async (tx) => {
      await tx.vesinvestTariffPlan.updateMany({
        where: {
          orgId,
          vesinvestPlanId: plan.id,
          scenarioId: scenario.id,
          status: 'accepted',
          id: { not: existing.id },
        },
        data: { status: 'stale' },
      });
      const acceptedRow = await tx.vesinvestTariffPlan.update({
        where: { id: existing.id },
        data: {
          status: 'accepted',
          recommendation: recommendation as unknown as Prisma.InputJsonValue,
          readinessChecklist:
            recommendation.lawReadiness as unknown as Prisma.InputJsonValue,
          acceptedAt: new Date(),
        },
      });
      await tx.vesinvestPlan.update({
        where: { id: plan.id },
        data: {
          scenarioFingerprint: acceptedScenarioFingerprint,
          feeRecommendationStatus: 'verified',
          investmentPlanChangedSinceFeeRecommendation: false,
        },
      });
      return acceptedRow;
    });

    return this.toResponse(
      accepted,
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
    );
  }

  private assertFreshTariffEditToken(
    current: VesinvestTariffPlanRow,
    expectedUpdatedAt: string | null | undefined,
  ) {
    if (!current) {
      return;
    }
    const expected = expectedUpdatedAt?.trim();
    if (!expected) {
      throw new BadRequestException({
        code: 'TARIFF_PLAN_STALE_EDIT_TOKEN_REQUIRED',
        message: 'Refresh the tariff plan before saving.',
      });
    }
    const expectedTime = new Date(expected).getTime();
    const currentTime = new Date(current.updatedAt).getTime();
    if (!Number.isFinite(expectedTime)) {
      throw new BadRequestException({
        code: 'TARIFF_PLAN_STALE_EDIT_TOKEN_INVALID',
        message: 'Refresh the tariff plan before saving.',
      });
    }
    if (expectedTime !== currentTime) {
      throw new ConflictException({
        code: 'TARIFF_PLAN_STALE_EDIT',
        message:
          'This tariff plan has changed in another session. Refresh it before saving.',
      });
    }
  }

  private async resolvePlanAndScenario(orgId: string, vesinvestPlanId: string) {
    const plan = await this.prisma.vesinvestPlan.findFirst({
      where: { id: vesinvestPlanId, orgId },
      include: {
        projects: {
          include: {
            allocations: true,
          },
        },
        selectedScenario: {
          select: {
            id: true,
          },
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Vesinvest plan not found.');
    }
    if (!plan.selectedScenarioId) {
      throw new ConflictException({
        code: 'TARIFF_SCENARIO_REQUIRED',
        message:
          'Sync the asset-management plan to forecast before tariff planning.',
      });
    }
    const scenario = await this.forecastService.getForecastScenario(
      orgId,
      plan.selectedScenarioId,
    );
    const scenarioUpdatedAtIso = new Date(scenario.updatedAt).toISOString();
    const computedFromUpdatedAtIso = scenario.computedFromUpdatedAt
      ? new Date(scenario.computedFromUpdatedAt).toISOString()
      : null;
    if (
      !computedFromUpdatedAtIso ||
      computedFromUpdatedAtIso !== scenarioUpdatedAtIso
    ) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message: 'Compute the linked forecast scenario before tariff planning.',
      });
    }
    if (scenario.years.length === 0) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message: 'Compute the linked forecast scenario before tariff planning.',
      });
    }
    if (!this.investmentSeriesMatchesYearlyInvestments(scenario)) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message:
          'Recompute the linked forecast scenario before tariff planning.',
      });
    }
    const vesinvestInvestmentMismatches =
      findVesinvestScenarioInvestmentMismatches(plan, scenario);
    if (vesinvestInvestmentMismatches.length > 0) {
      throw new ConflictException({
        code: 'VESINVEST_SCENARIO_INVESTMENTS_STALE',
        message:
          'Forecast investments no longer match the active Vesinvest plan. Sync Asset Management to Forecast before tariff planning.',
        mismatches: vesinvestInvestmentMismatches.slice(0, 5),
      });
    }
    return { plan, scenario };
  }

  private investmentSeriesMatchesYearlyInvestments(
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
  ) {
    const investmentSeries = new Map<number, number>();
    for (const row of scenario.investmentSeries) {
      investmentSeries.set(
        Number(row.year),
        this.round2(this.toNumber(row.amount)),
      );
    }
    const yearlyInvestments = new Map<number, number>();
    for (const row of scenario.yearlyInvestments) {
      yearlyInvestments.set(
        Number(row.year),
        this.round2(
          (yearlyInvestments.get(Number(row.year)) ?? 0) +
            this.toNumber(row.amount),
        ),
      );
    }
    for (const [year, amount] of investmentSeries) {
      if (amount !== (yearlyInvestments.get(year) ?? 0)) {
        return false;
      }
    }
    for (const [year, amount] of yearlyInvestments) {
      if (amount !== (investmentSeries.get(year) ?? 0)) {
        return false;
      }
    }
    return true;
  }

  private findLatestPlan(
    orgId: string,
    vesinvestPlanId: string,
    scenarioId: string,
  ) {
    return this.prisma.vesinvestTariffPlan.findFirst({
      where: { orgId, vesinvestPlanId, scenarioId },
      orderBy: [
        { updatedAt: 'desc' },
        { acceptedAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  private findEditablePlan(
    orgId: string,
    vesinvestPlanId: string,
    scenarioId: string,
  ) {
    return this.prisma.vesinvestTariffPlan.findFirst({
      where: {
        orgId,
        vesinvestPlanId,
        scenarioId,
        status: { in: ['draft', 'stale'] },
      },
      orderBy: [
        { updatedAt: 'desc' },
        { acceptedAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  private async staleAcceptedPlanIfFingerprintsMoved(
    plan: {
      id: string;
      baselineFingerprint: string | null;
      scenarioFingerprint: string | null;
    },
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    row: VesinvestTariffPlanRow,
  ): Promise<VesinvestTariffPlanRow> {
    if (!row || row.status !== 'accepted') {
      return row;
    }
    if (this.tariffPlanMatchesLiveFingerprints(row, plan, scenario)) {
      return row;
    }
    return this.prisma.vesinvestTariffPlan.update({
      where: { id: row.id },
      data: { status: 'stale' },
    });
  }

  private tariffPlanMatchesLiveFingerprints(
    row: VesinvestTariffPlanRow,
    plan: {
      baselineFingerprint: string | null;
      scenarioFingerprint: string | null;
    },
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
  ) {
    const recommendation = this.asRecord(row?.recommendation);
    const savedBaselineFingerprint = this.toNullableText(
      recommendation.baselineFingerprint,
    );
    const savedScenarioFingerprint = this.toNullableText(
      recommendation.scenarioFingerprint,
    );
    const liveScenarioFingerprint = computeVesinvestScenarioFingerprint({
      scenarioId: scenario.id,
      updatedAt: scenario.updatedAt,
      computedFromUpdatedAt: scenario.computedFromUpdatedAt,
      yearlyInvestments: scenario.yearlyInvestments,
      years: scenario.years,
    });

    return (
      savedBaselineFingerprint === plan.baselineFingerprint &&
      savedScenarioFingerprint === liveScenarioFingerprint
    );
  }

  private readBaselineInput(
    raw: unknown,
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    baselineVolumeDefaults?: {
      soldWaterVolume: number | null;
      soldWastewaterVolume: number | null;
    } | null,
  ): TariffBaselineInput {
    const firstYear = scenario.years[0] ?? null;
    const record = this.asRecord(raw);
    return {
      connectionFeeAverage: this.toNullableNumber(record.connectionFeeAverage),
      connectionFeeRevenue: this.toNullableNumber(record.connectionFeeRevenue),
      connectionFeeNewConnections: this.toNullableNumber(
        record.connectionFeeNewConnections,
      ),
      connectionFeeBasis: this.toNullableText(record.connectionFeeBasis),
      baseFeeRevenue:
        this.toNullableNumber(record.baseFeeRevenue) ??
        this.toNullableNumber(firstYear?.baseFeeRevenue),
      connectionCount:
        this.toNullableNumber(record.connectionCount) ??
        this.toNullableNumber(firstYear?.connectionCount),
      waterPrice:
        this.toNullableNumber(record.waterPrice) ??
        this.toNullableNumber(firstYear?.waterPrice),
      wastewaterPrice:
        this.toNullableNumber(record.wastewaterPrice) ??
        this.toNullableNumber(firstYear?.wastewaterPrice),
      soldWaterVolume:
        this.toNullableNumber(record.soldWaterVolume) ??
        baselineVolumeDefaults?.soldWaterVolume ??
        this.toNullableNumber((firstYear as any)?.soldWaterVolume),
      soldWastewaterVolume:
        this.toNullableNumber(record.soldWastewaterVolume) ??
        baselineVolumeDefaults?.soldWastewaterVolume ??
        this.toNullableNumber((firstYear as any)?.soldWastewaterVolume),
      notes: this.toNullableText(record.notes),
    };
  }

  private async resolveBaselineVolumeDefaults(
    orgId: string,
    baselineYear: number | null,
  ) {
    if (!this.importOverviewService || baselineYear == null) {
      return null;
    }
    try {
      const context = await this.importOverviewService.getPlanningContext(
        orgId,
      );
      const row = Array.isArray((context as any)?.baselineYears)
        ? (context as any).baselineYears.find(
            (item: any) => item?.year === baselineYear,
          )
        : null;
      if (!row) {
        return null;
      }
      const soldWaterVolume = this.toNullableNumber(row.soldWaterVolume);
      const soldWastewaterVolume = this.toNullableNumber(
        row.soldWastewaterVolume,
      );
      if (soldWaterVolume == null && soldWastewaterVolume == null) {
        return null;
      }
      return { soldWaterVolume, soldWastewaterVolume };
    } catch {
      return null;
    }
  }

  private readAllocationPolicy(
    raw: unknown,
    plan: {
      projects: Array<{
        waterAmount: Prisma.Decimal | number | null;
        wastewaterAmount: Prisma.Decimal | number | null;
        totalAmount: Prisma.Decimal | number | null;
      }>;
    },
  ): TariffAllocationPolicy {
    const record = this.asRecord(raw);
    const defaults = this.buildDefaultAllocationPolicy(plan);
    return {
      connectionFeeSharePct:
        this.toNullableNumber(record.connectionFeeSharePct) ??
        defaults.connectionFeeSharePct,
      baseFeeSharePct:
        this.toNullableNumber(record.baseFeeSharePct) ??
        defaults.baseFeeSharePct,
      waterUsageSharePct:
        this.toNullableNumber(record.waterUsageSharePct) ??
        defaults.waterUsageSharePct,
      wastewaterUsageSharePct:
        this.toNullableNumber(record.wastewaterUsageSharePct) ??
        defaults.wastewaterUsageSharePct,
      smoothingYears:
        this.toNullableNumber(record.smoothingYears) ?? defaults.smoothingYears,
      regionalVariationApplies:
        typeof record.regionalVariationApplies === 'boolean'
          ? record.regionalVariationApplies
          : false,
      stormwaterApplies:
        typeof record.stormwaterApplies === 'boolean'
          ? record.stormwaterApplies
          : false,
      financialRiskAssessment: this.toNullableText(
        record.financialRiskAssessment,
      ),
    };
  }

  private buildDefaultAllocationPolicy(plan: {
    projects: Array<{
      waterAmount: Prisma.Decimal | number | null;
      wastewaterAmount: Prisma.Decimal | number | null;
      totalAmount: Prisma.Decimal | number | null;
    }>;
  }): Required<
    Pick<
      TariffAllocationPolicy,
      | 'connectionFeeSharePct'
      | 'baseFeeSharePct'
      | 'waterUsageSharePct'
      | 'wastewaterUsageSharePct'
      | 'smoothingYears'
    >
  > {
    const waterTotal = plan.projects.reduce(
      (sum, project) => sum + this.toNumber(project.waterAmount),
      0,
    );
    const wastewaterTotal = plan.projects.reduce(
      (sum, project) => sum + this.toNumber(project.wastewaterAmount),
      0,
    );
    const serviceTotal = waterTotal + wastewaterTotal;
    const serviceShare = serviceTotal > 0 ? waterTotal / serviceTotal : 0.5;
    const usageShare = 55;
    return {
      connectionFeeSharePct: 10,
      baseFeeSharePct: 35,
      waterUsageSharePct: this.round2(usageShare * serviceShare),
      wastewaterUsageSharePct: this.round2(usageShare * (1 - serviceShare)),
      smoothingYears: 5,
    };
  }

  private buildRecommendation(
    plan: {
      id: string;
      horizonYears: number;
      baselineFingerprint: string | null;
      scenarioFingerprint: string | null;
      projects: Array<{
        totalAmount: Prisma.Decimal | number | null;
        allocations: Array<{ totalAmount: Prisma.Decimal | number | null }>;
      }>;
    },
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    baselineInput: TariffBaselineInput,
    allocationPolicy: TariffAllocationPolicy,
    evidence: {
      revenueEvidence?: Record<string, unknown> | null;
      costEvidence?: Record<string, unknown> | null;
      regionalDifferentiationState?: Record<string, unknown> | null;
      stormwaterState?: Record<string, unknown> | null;
      specialUseState?: Record<string, unknown> | null;
      connectionFeeLiabilityState?: Record<string, unknown> | null;
      ownerDistributionState?: Record<string, unknown> | null;
    } = {},
  ): TariffRecommendation {
    const shares = this.normalizeShares(allocationPolicy);
    const smoothingYears = Math.max(
      1,
      Math.min(20, Math.round(allocationPolicy.smoothingYears ?? 5)),
    );
    const totalVolume =
      this.toNumber(baselineInput.soldWaterVolume) +
      this.toNumber(baselineInput.soldWastewaterVolume);
    const currentCombinedPrice =
      totalVolume > 0
        ? (this.toNumber(baselineInput.waterPrice) *
            this.toNumber(baselineInput.soldWaterVolume) +
            this.toNumber(baselineInput.wastewaterPrice) *
              this.toNumber(baselineInput.soldWastewaterVolume)) /
          totalVolume
        : scenario.baselinePriceTodayCombined ?? 0;
    const requiredCombinedPrice =
      scenario.requiredPriceTodayCombinedAnnualResult ??
      scenario.requiredPriceTodayCombined ??
      currentCombinedPrice;
    const priceSignal = this.buildPriceSignal(
      scenario,
      currentCombinedPrice,
      requiredCombinedPrice,
    );
    const usagePricePressure = Math.max(
      0,
      (requiredCombinedPrice - currentCombinedPrice) * totalVolume,
    );
    const targetAdditionalAnnualRevenue = this.round2(usagePricePressure);
    const baselineAnnualRevenue = this.round2(
      this.toNumber(baselineInput.connectionFeeRevenue) +
        this.toNumber(baselineInput.baseFeeRevenue) +
        this.toNumber(baselineInput.waterPrice) *
          this.toNumber(baselineInput.soldWaterVolume) +
        this.toNumber(baselineInput.wastewaterPrice) *
          this.toNumber(baselineInput.soldWastewaterVolume),
    );
    const connectionFeeAnnualRevenue =
      this.resolveConnectionFeeAnnualRevenue(baselineInput);
    const fees = {
      connectionFee: this.buildFeeRecommendation(
        'connectionFee',
        baselineInput.connectionFeeAverage ?? null,
        connectionFeeAnnualRevenue,
        baselineInput.connectionFeeNewConnections ?? null,
        shares.connectionFee,
        targetAdditionalAnnualRevenue,
        smoothingYears,
      ),
      baseFee: this.buildFeeRecommendation(
        'baseFee',
        this.safeDivide(
          this.toNumber(baselineInput.baseFeeRevenue),
          this.toNumber(baselineInput.connectionCount),
        ),
        baselineInput.baseFeeRevenue ?? null,
        baselineInput.connectionCount ?? null,
        shares.baseFee,
        targetAdditionalAnnualRevenue,
        smoothingYears,
      ),
      waterUsageFee: this.buildFeeRecommendation(
        'waterUsageFee',
        baselineInput.waterPrice ?? null,
        this.toNumber(baselineInput.waterPrice) *
          this.toNumber(baselineInput.soldWaterVolume),
        baselineInput.soldWaterVolume ?? null,
        shares.waterUsageFee,
        targetAdditionalAnnualRevenue,
        smoothingYears,
      ),
      wastewaterUsageFee: this.buildFeeRecommendation(
        'wastewaterUsageFee',
        baselineInput.wastewaterPrice ?? null,
        this.toNumber(baselineInput.wastewaterPrice) *
          this.toNumber(baselineInput.soldWastewaterVolume),
        baselineInput.soldWastewaterVolume ?? null,
        shares.wastewaterUsageFee,
        targetAdditionalAnnualRevenue,
        smoothingYears,
      ),
    };
    const proposedAnnualRevenue = this.round2(
      FEE_KEYS.reduce(
        (sum, key) => sum + (fees[key].proposedAnnualRevenue ?? 0),
        0,
      ),
    );
    const averageAnnualIncreasePct =
      baselineAnnualRevenue > 0
        ? this.round2(
            ((proposedAnnualRevenue - baselineAnnualRevenue) /
              baselineAnnualRevenue /
              smoothingYears) *
              100,
          )
        : null;
    const lawReadiness = this.buildReadinessChecklist(
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
      evidence,
      targetAdditionalAnnualRevenue,
      averageAnnualIncreasePct,
    );
    const revenueTable = FEE_KEYS.map((key) => ({
      key,
      currentAnnualRevenue: fees[key].currentAnnualRevenue,
      proposedAnnualRevenue: fees[key].proposedAnnualRevenue,
      revenueImpact: fees[key].revenueImpact,
      allocationSharePct: fees[key].allocationSharePct,
    }));
    const annualChangePath = Array.from(
      { length: smoothingYears },
      (_, index) => {
        const yearIndex = index + 1;
        const annualRevenue = FEE_KEYS.reduce<number | null>((sum, key) => {
          const row = fees[key].yearlyPath[index];
          if (sum == null || row?.annualRevenue == null) {
            return null;
          }
          return sum + row.annualRevenue;
        }, 0);
        return {
          yearIndex,
          annualRevenue:
            annualRevenue == null ? null : this.round2(annualRevenue),
          annualIncreasePct:
            averageAnnualIncreasePct == null ? null : averageAnnualIncreasePct,
        };
      },
    );
    const impactFlags = {
      exceeds15PctAnnualIncrease:
        averageAnnualIncreasePct != null && averageAnnualIncreasePct > 15,
      regionalVariationApplies:
        allocationPolicy.regionalVariationApplies === true ||
        this.hasEvidenceNotes(evidence.regionalDifferentiationState),
      stormwaterApplies:
        allocationPolicy.stormwaterApplies === true ||
        this.hasEvidenceNotes(evidence.stormwaterState),
      specialUseApplies: this.hasEvidenceNotes(evidence.specialUseState),
      connectionFeeLiabilityRecorded: this.hasEvidenceNotes(
        evidence.connectionFeeLiabilityState,
      ),
      ownerDistributionRecorded: this.hasEvidenceNotes(
        evidence.ownerDistributionState,
      ),
    };
    const allocationRationale = [
      'Allocation uses the current service split and the edited four-lever policy.',
      `Target pressure is ${this.round2(
        targetAdditionalAnnualRevenue,
      )} annual revenue after smoothing.`,
      `Smoothing period is ${smoothingYears} year(s).`,
    ];

    return {
      savedAt: new Date().toISOString(),
      linkedScenarioId: scenario.id,
      vesinvestPlanId: plan.id,
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint: computeVesinvestScenarioFingerprint({
        scenarioId: scenario.id,
        updatedAt: scenario.updatedAt,
        computedFromUpdatedAt: scenario.computedFromUpdatedAt,
        yearlyInvestments: scenario.yearlyInvestments,
        years: scenario.years,
      }),
      priceSignal,
      targetAdditionalAnnualRevenue,
      baselineAnnualRevenue,
      proposedAnnualRevenue,
      smoothingYears,
      averageAnnualIncreasePct,
      fees,
      revenueTable,
      annualChangePath,
      impactFlags,
      allocationRationale,
      lawReadiness,
    };
  }

  private buildPriceSignal(
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    currentCombinedPrice: number,
    requiredCombinedPrice: number,
  ): TariffRecommendation['priceSignal'] {
    const currentComparatorPrice =
      currentCombinedPrice > 0
        ? currentCombinedPrice
        : scenario.baselinePriceTodayCombined ?? currentCombinedPrice;
    const requiredPriceToday =
      scenario.requiredPriceTodayCombinedAnnualResult ??
      scenario.requiredPriceTodayCombined ??
      requiredCombinedPrice;
    const cumulativeCashFloorPrice =
      scenario.requiredPriceTodayCombinedCumulativeCash ?? null;
    return {
      currentComparatorPrice:
        currentComparatorPrice == null
          ? null
          : this.round4(currentComparatorPrice),
      requiredPriceToday:
        requiredPriceToday == null ? null : this.round4(requiredPriceToday),
      requiredIncreasePct: this.calculateIncreasePct(
        requiredPriceToday,
        currentComparatorPrice,
      ),
      cumulativeCashFloorPrice:
        cumulativeCashFloorPrice == null
          ? null
          : this.round4(cumulativeCashFloorPrice),
      cumulativeCashFloorIncreasePct: this.calculateIncreasePct(
        cumulativeCashFloorPrice,
        currentComparatorPrice,
      ),
    };
  }

  private buildFeeRecommendation(
    key: TariffFeeKey,
    currentUnit: number | null,
    currentAnnualRevenueRaw: number | null,
    denominatorRaw: number | null,
    allocationSharePct: number,
    targetAdditionalAnnualRevenue: number,
    smoothingYears: number,
  ): TariffFeeRecommendation {
    const currentAnnualRevenue = this.toNullableNumber(currentAnnualRevenueRaw);
    const denominator = this.toNullableNumber(denominatorRaw);
    const revenueImpact = this.round2(
      targetAdditionalAnnualRevenue * (allocationSharePct / 100),
    );
    const proposedAnnualRevenue =
      currentAnnualRevenue == null
        ? null
        : this.round2(currentAnnualRevenue + revenueImpact);
    const proposedUnit =
      proposedAnnualRevenue == null || !denominator || denominator <= 0
        ? null
        : this.round4(proposedAnnualRevenue / denominator);
    const deltaPct =
      currentUnit != null && currentUnit > 0 && proposedUnit != null
        ? this.round2(((proposedUnit - currentUnit) / currentUnit) * 100)
        : null;
    const annualIncreasePct =
      deltaPct == null ? null : this.round2(deltaPct / smoothingYears);
    return {
      key,
      currentUnit: currentUnit == null ? null : this.round4(currentUnit),
      proposedUnit,
      currentAnnualRevenue,
      proposedAnnualRevenue,
      revenueImpact,
      deltaPct,
      annualIncreasePct,
      allocationSharePct,
      denominator,
      yearlyPath: Array.from({ length: smoothingYears }, (_, index) => {
        const step = index + 1;
        const unit =
          currentUnit == null || proposedUnit == null
            ? null
            : this.round4(
                currentUnit +
                  ((proposedUnit - currentUnit) * step) / smoothingYears,
              );
        const annualRevenue =
          currentAnnualRevenue == null || proposedAnnualRevenue == null
            ? null
            : this.round2(
                currentAnnualRevenue +
                  ((proposedAnnualRevenue - currentAnnualRevenue) * step) /
                    smoothingYears,
              );
        return { yearIndex: step, unit, annualRevenue };
      }),
    };
  }

  private resolveConnectionFeeAnnualRevenue(
    baselineInput: TariffBaselineInput,
  ): number | null {
    const explicitRevenue = this.toNullableNumber(
      baselineInput.connectionFeeRevenue,
    );
    if (explicitRevenue != null) {
      return explicitRevenue;
    }
    const average = this.toNullableNumber(baselineInput.connectionFeeAverage);
    const newConnections = this.toNullableNumber(
      baselineInput.connectionFeeNewConnections,
    );
    if (average == null || newConnections == null) {
      return null;
    }
    return this.round2(average * newConnections);
  }

  private buildReadinessChecklist(
    plan: {
      horizonYears: number;
      baselineFingerprint: string | null;
      projects: Array<{
        totalAmount: Prisma.Decimal | number | null;
        allocations: Array<{ totalAmount: Prisma.Decimal | number | null }>;
      }>;
    },
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    baselineInput: TariffBaselineInput,
    allocationPolicy: TariffAllocationPolicy,
    evidence: {
      revenueEvidence?: Record<string, unknown> | null;
      costEvidence?: Record<string, unknown> | null;
      regionalDifferentiationState?: Record<string, unknown> | null;
      stormwaterState?: Record<string, unknown> | null;
      specialUseState?: Record<string, unknown> | null;
      connectionFeeLiabilityState?: Record<string, unknown> | null;
      ownerDistributionState?: Record<string, unknown> | null;
    },
    targetAdditionalAnnualRevenue: number,
    averageAnnualIncreasePct: number | null,
  ): TariffReadinessChecklist {
    const unresolvedManualAssumptions: string[] = [];
    const requirePositive = (
      value: unknown,
      label: string,
      allowZero = false,
    ) => {
      const parsed = this.toNullableNumber(value);
      if (parsed == null || (!allowZero && parsed <= 0)) {
        unresolvedManualAssumptions.push(label);
      }
    };
    requirePositive(baselineInput.waterPrice, 'current water price');
    requirePositive(baselineInput.wastewaterPrice, 'current wastewater price');
    requirePositive(baselineInput.soldWaterVolume, 'sold water volume');
    requirePositive(
      baselineInput.soldWastewaterVolume,
      'sold wastewater volume',
    );
    requirePositive(baselineInput.baseFeeRevenue, 'base-fee revenue', true);
    requirePositive(baselineInput.connectionCount, 'connection count');
    const shares = this.normalizeShares(allocationPolicy);
    const connectionFeeRevenue =
      this.resolveConnectionFeeAnnualRevenue(baselineInput);
    if (
      shares.connectionFee > 0 &&
      (connectionFeeRevenue == null ||
        this.toNumber(baselineInput.connectionFeeNewConnections) <= 0)
    ) {
      unresolvedManualAssumptions.push('connection-fee revenue and volume');
    } else if (
      shares.connectionFee <= 0 &&
      baselineInput.connectionFeeAverage == null &&
      baselineInput.connectionFeeRevenue == null &&
      !baselineInput.connectionFeeBasis
    ) {
      unresolvedManualAssumptions.push('connection-fee assumption');
    }
    const assetPlan20YearPresent =
      plan.horizonYears >= 20 &&
      plan.projects.some((project) =>
        project.allocations.some(
          (allocation) => this.toNumber(allocation.totalAmount) > 0,
        ),
      );
    const trustedBaselinePresent = plan.baselineFingerprint != null;
    const currentTariffBaselinePresent =
      unresolvedManualAssumptions.length === 0;
    const investmentFinancingNeedPresent =
      scenario.years.length > 0 &&
      (targetAdditionalAnnualRevenue > 0 ||
        scenario.investmentSeries.some(
          (item) => this.toNumber(item.amount) > 0,
        ));
    const riskAssessmentPresent =
      typeof allocationPolicy.financialRiskAssessment === 'string' &&
      allocationPolicy.financialRiskAssessment.trim().length >= 8;
    const tariffRevenueEvidencePresent = this.hasEvidenceNotes(
      evidence.revenueEvidence,
    );
    const costEvidencePresent = this.hasEvidenceNotes(evidence.costEvidence);
    const connectionFeeLiabilityPresent = this.hasEvidenceNotes(
      evidence.connectionFeeLiabilityState,
    );
    if (!tariffRevenueEvidencePresent) {
      unresolvedManualAssumptions.push('tariff revenue evidence');
    }
    if (!costEvidencePresent) {
      unresolvedManualAssumptions.push('cost evidence');
    }
    if (!connectionFeeLiabilityPresent) {
      unresolvedManualAssumptions.push('returnable connection-fee liability');
    }
    const smoothingStatus =
      averageAnnualIncreasePct == null
        ? 'missing'
        : averageAnnualIncreasePct > 15
        ? 'exceeds_15_pct'
        : 'ok';

    return {
      isReady:
        assetPlan20YearPresent &&
        trustedBaselinePresent &&
        currentTariffBaselinePresent &&
        investmentFinancingNeedPresent &&
        riskAssessmentPresent &&
        tariffRevenueEvidencePresent &&
        costEvidencePresent &&
        connectionFeeLiabilityPresent,
      assetPlan20YearPresent,
      trustedBaselinePresent,
      currentTariffBaselinePresent,
      investmentFinancingNeedPresent,
      riskAssessmentPresent,
      tariffRevenueEvidencePresent,
      costEvidencePresent,
      connectionFeeLiabilityPresent,
      smoothingStatus,
      regionalVariationFlag: allocationPolicy.regionalVariationApplies === true,
      stormwaterFlag: allocationPolicy.stormwaterApplies === true,
      unresolvedManualAssumptions,
    };
  }

  private normalizeShares(policy: TariffAllocationPolicy) {
    const raw = {
      connectionFee: this.toNumber(policy.connectionFeeSharePct),
      baseFee: this.toNumber(policy.baseFeeSharePct),
      waterUsageFee: this.toNumber(policy.waterUsageSharePct),
      wastewaterUsageFee: this.toNumber(policy.wastewaterUsageSharePct),
    };
    const total = Object.values(raw).reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
      return {
        connectionFee: 10,
        baseFee: 35,
        waterUsageFee: 27.5,
        wastewaterUsageFee: 27.5,
      };
    }
    return {
      connectionFee: this.round2((raw.connectionFee / total) * 100),
      baseFee: this.round2((raw.baseFee / total) * 100),
      waterUsageFee: this.round2((raw.waterUsageFee / total) * 100),
      wastewaterUsageFee: this.round2((raw.wastewaterUsageFee / total) * 100),
    };
  }

  private toResponse(
    row: VesinvestTariffPlanRow,
    plan: { id: string; selectedScenarioId: string | null },
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    baselineInput: TariffBaselineInput,
    allocationPolicy: TariffAllocationPolicy,
  ) {
    const recommendation =
      row?.recommendation && typeof row.recommendation === 'object'
        ? this.normalizeRecommendation(
            row.recommendation as unknown as TariffRecommendation,
            scenario,
            baselineInput,
          )
        : this.buildRecommendation(
            plan as any,
            scenario,
            baselineInput,
            allocationPolicy,
          );
    return {
      id: row?.id ?? null,
      vesinvestPlanId: plan.id,
      scenarioId: scenario.id,
      status: row?.status ?? 'draft',
      baselineInput,
      allocationPolicy,
      recommendation,
      readinessChecklist:
        (row?.readinessChecklist as unknown as TariffReadinessChecklist | null) ??
        recommendation.lawReadiness,
      revenueEvidence: this.readEvidenceObject(row?.revenueEvidence ?? null),
      costEvidence: this.readEvidenceObject(row?.costEvidence ?? null),
      regionalDifferentiationState: this.readEvidenceObject(
        row?.regionalDifferentiationState ?? null,
      ),
      stormwaterState: this.readEvidenceObject(row?.stormwaterState ?? null),
      specialUseState: this.readEvidenceObject(row?.specialUseState ?? null),
      connectionFeeLiabilityState: this.readEvidenceObject(
        row?.connectionFeeLiabilityState ?? null,
      ),
      ownerDistributionState: this.readEvidenceObject(
        row?.ownerDistributionState ?? null,
      ),
      acceptedAt: row?.acceptedAt?.toISOString() ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      createdAt: row?.createdAt?.toISOString() ?? null,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readEvidenceObject(value: unknown): Record<string, unknown> | null {
    if (value == null || value === Prisma.JsonNull || value === Prisma.DbNull) {
      return null;
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Tariff evidence state must be an object.');
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private hasEvidenceNotes(value: Record<string, unknown> | null | undefined) {
    return typeof value?.notes === 'string' && value.notes.trim().length > 0;
  }

  private toNullableText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private toNumber(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toNullableNumber(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? this.round2(parsed) : null;
  }

  private safeDivide(numerator: number, denominator: number) {
    if (!denominator || denominator <= 0) {
      return null;
    }
    return this.round4(numerator / denominator);
  }

  private calculateIncreasePct(
    requiredPrice: number | null | undefined,
    comparatorPrice: number | null | undefined,
  ) {
    if (
      requiredPrice == null ||
      comparatorPrice == null ||
      comparatorPrice <= 0
    ) {
      return null;
    }
    return this.round2((requiredPrice / comparatorPrice - 1) * 100);
  }

  private normalizeRecommendation(
    recommendation: TariffRecommendation,
    scenario: Awaited<ReturnType<V2ForecastService['getForecastScenario']>>,
    baselineInput: TariffBaselineInput,
  ): TariffRecommendation {
    const totalVolume =
      this.toNumber(baselineInput.soldWaterVolume) +
      this.toNumber(baselineInput.soldWastewaterVolume);
    const currentCombinedPrice =
      totalVolume > 0
        ? (this.toNumber(baselineInput.waterPrice) *
            this.toNumber(baselineInput.soldWaterVolume) +
            this.toNumber(baselineInput.wastewaterPrice) *
              this.toNumber(baselineInput.soldWastewaterVolume)) /
          totalVolume
        : scenario.baselinePriceTodayCombined ?? 0;
    const requiredCombinedPrice =
      scenario.requiredPriceTodayCombinedAnnualResult ??
      scenario.requiredPriceTodayCombined ??
      currentCombinedPrice;
    return {
      ...recommendation,
      priceSignal: this.buildPriceSignal(
        scenario,
        currentCombinedPrice,
        requiredCombinedPrice,
      ),
    };
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private round4(value: number) {
    return Math.round(value * 10000) / 10000;
  }
}
