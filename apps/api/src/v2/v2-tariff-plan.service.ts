import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastService } from './v2-forecast.service';
import type {
  TariffAllocationPolicy,
  TariffBaselineInput,
  TariffFeeKey,
  TariffFeeRecommendation,
  TariffPlanBody,
  TariffReadinessChecklist,
  TariffRecommendation,
} from './v2-tariff-plan.types';
import { computeVesinvestScenarioFingerprint } from './vesinvest-contract';

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
    return this.toResponse(
      current,
      plan,
      scenario,
      this.readBaselineInput(current?.baselineInput ?? null, scenario),
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
    const baselineInput = this.readBaselineInput(
      body.baselineInput ?? current?.baselineInput ?? null,
      scenario,
    );
    const allocationPolicy = this.readAllocationPolicy(
      body.allocationPolicy ?? current?.allocationPolicy ?? null,
      plan,
    );
    const recommendation = this.buildRecommendation(
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
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
      acceptedAt: null,
    };
    const saved = existing
      ? await this.prisma.vesinvestTariffPlan.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.vesinvestTariffPlan.create({ data });

    return this.toResponse(saved, plan, scenario, baselineInput, allocationPolicy);
  }

  async acceptTariffPlan(orgId: string, vesinvestPlanId: string) {
    const { plan, scenario } = await this.resolvePlanAndScenario(
      orgId,
      vesinvestPlanId,
    );
    const existing = await this.findLatestPlan(orgId, plan.id, scenario.id);
    if (!existing) {
      throw new BadRequestException('Save the tariff plan before accepting it.');
    }
    const baselineInput = this.readBaselineInput(existing.baselineInput, scenario);
    const allocationPolicy = this.readAllocationPolicy(
      existing.allocationPolicy,
      plan,
    );
    const recommendation = this.buildRecommendation(
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
    );
    if (!recommendation.lawReadiness.isReady) {
      throw new ConflictException({
        code: 'TARIFF_PLAN_NOT_READY',
        message:
          'Tariff plan is not ready for report snapshot. Resolve readiness items before accepting.',
        readinessChecklist: recommendation.lawReadiness,
      });
    }

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
      return tx.vesinvestTariffPlan.update({
        where: { id: existing.id },
        data: {
          status: 'accepted',
          recommendation: recommendation as unknown as Prisma.InputJsonValue,
          readinessChecklist:
            recommendation.lawReadiness as unknown as Prisma.InputJsonValue,
          acceptedAt: new Date(),
        },
      });
    });

    return this.toResponse(
      accepted,
      plan,
      scenario,
      baselineInput,
      allocationPolicy,
    );
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
    if (!scenario.computedFromUpdatedAt) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message:
          'Compute the linked forecast scenario before tariff planning.',
      });
    }
    return { plan, scenario };
  }

  private findLatestPlan(
    orgId: string,
    vesinvestPlanId: string,
    scenarioId: string,
  ) {
    return this.prisma.vesinvestTariffPlan.findFirst({
      where: { orgId, vesinvestPlanId, scenarioId },
      orderBy: { updatedAt: 'desc' },
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
      orderBy: { updatedAt: 'desc' },
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
    const liveScenarioFingerprint =
      plan.scenarioFingerprint ??
      computeVesinvestScenarioFingerprint({
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
        this.toNullableNumber((firstYear as any)?.soldWaterVolume),
      soldWastewaterVolume:
        this.toNullableNumber(record.soldWastewaterVolume) ??
        this.toNullableNumber((firstYear as any)?.soldWastewaterVolume),
      notes: this.toNullableText(record.notes),
    };
  }

  private readAllocationPolicy(raw: unknown, plan: { projects: Array<{
    waterAmount: Prisma.Decimal | number | null;
    wastewaterAmount: Prisma.Decimal | number | null;
    totalAmount: Prisma.Decimal | number | null;
  }> }): TariffAllocationPolicy {
    const record = this.asRecord(raw);
    const defaults = this.buildDefaultAllocationPolicy(plan);
    return {
      connectionFeeSharePct:
        this.toNullableNumber(record.connectionFeeSharePct) ??
        defaults.connectionFeeSharePct,
      baseFeeSharePct:
        this.toNullableNumber(record.baseFeeSharePct) ?? defaults.baseFeeSharePct,
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

  private buildDefaultAllocationPolicy(plan: { projects: Array<{
    waterAmount: Prisma.Decimal | number | null;
    wastewaterAmount: Prisma.Decimal | number | null;
    totalAmount: Prisma.Decimal | number | null;
  }> }): Required<Pick<
    TariffAllocationPolicy,
    | 'connectionFeeSharePct'
    | 'baseFeeSharePct'
    | 'waterUsageSharePct'
    | 'wastewaterUsageSharePct'
    | 'smoothingYears'
  >> {
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
      scenario.requiredPriceTodayCombinedCumulativeCash ??
      scenario.requiredPriceTodayCombinedAnnualResult ??
      scenario.requiredPriceTodayCombined ??
      currentCombinedPrice;
    const usagePricePressure = Math.max(
      0,
      (requiredCombinedPrice - currentCombinedPrice) * totalVolume,
    );
    const peakGapPressure = Math.max(
      0,
      this.toNumber(scenario.feeSufficiency?.cumulativeCash?.peakGap) /
        smoothingYears,
    );
    const targetAdditionalAnnualRevenue = this.round2(
      Math.max(usagePricePressure, peakGapPressure),
    );
    const baselineAnnualRevenue = this.round2(
      this.toNumber(baselineInput.connectionFeeRevenue) +
        this.toNumber(baselineInput.baseFeeRevenue) +
        this.toNumber(baselineInput.waterPrice) *
          this.toNumber(baselineInput.soldWaterVolume) +
        this.toNumber(baselineInput.wastewaterPrice) *
          this.toNumber(baselineInput.soldWastewaterVolume),
    );
    const fees = {
      connectionFee: this.buildFeeRecommendation(
        'connectionFee',
        baselineInput.connectionFeeAverage ?? null,
        baselineInput.connectionFeeRevenue ?? null,
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
      targetAdditionalAnnualRevenue,
      averageAnnualIncreasePct,
    );

    return {
      savedAt: new Date().toISOString(),
      linkedScenarioId: scenario.id,
      vesinvestPlanId: plan.id,
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint:
        plan.scenarioFingerprint ??
        computeVesinvestScenarioFingerprint({
          scenarioId: scenario.id,
          updatedAt: scenario.updatedAt,
          computedFromUpdatedAt: scenario.computedFromUpdatedAt,
          yearlyInvestments: scenario.yearlyInvestments,
          years: scenario.years,
        }),
      targetAdditionalAnnualRevenue,
      baselineAnnualRevenue,
      proposedAnnualRevenue,
      smoothingYears,
      averageAnnualIncreasePct,
      fees,
      lawReadiness,
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
                currentUnit + ((proposedUnit - currentUnit) * step) / smoothingYears,
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
    if (
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
    const currentTariffBaselinePresent = unresolvedManualAssumptions.length === 0;
    const investmentFinancingNeedPresent =
      scenario.years.length > 0 &&
      (targetAdditionalAnnualRevenue > 0 ||
        scenario.investmentSeries.some((item) => this.toNumber(item.amount) > 0));
    const riskAssessmentPresent =
      typeof allocationPolicy.financialRiskAssessment === 'string' &&
      allocationPolicy.financialRiskAssessment.trim().length >= 8;
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
        riskAssessmentPresent,
      assetPlan20YearPresent,
      trustedBaselinePresent,
      currentTariffBaselinePresent,
      investmentFinancingNeedPresent,
      riskAssessmentPresent,
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
        ? (row.recommendation as unknown as TariffRecommendation)
        : this.buildRecommendation(plan as any, scenario, baselineInput, allocationPolicy);
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

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private round4(value: number) {
    return Math.round(value * 10000) / 10000;
  }
}
