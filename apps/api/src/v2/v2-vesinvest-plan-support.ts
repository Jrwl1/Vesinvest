import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import {
  computeVesinvestBaselineFingerprint,
  normalizeVesinvestDepreciationClassKey,
  type VesinvestGroupDefinitionRecord,
  type VesinvestUtilityIdentitySnapshot,
} from './vesinvest-contract';
import { V2VesinvestFoundationSupport } from './v2-vesinvest-foundation-support';
import type {
  CreatePlanBody,
  CurrentBaselineSnapshot,
  NormalizedPlanProject,
  PlanProjectAllocationInput,
  PlanProjectInput,
  VesinvestPlanRecord,
} from './v2-vesinvest.types';
import { normalizeV2ValidationText } from './v2-validation-text';

export class V2VesinvestPlanSupport {
  constructor(
    private readonly prisma: PrismaService,
    private planningWorkspaceSupport: V2PlanningWorkspaceSupport,
    private readonly importOverviewService: V2ImportOverviewService,
    private readonly foundationSupport: V2VesinvestFoundationSupport,
  ) {}

  setPlanningWorkspaceSupport(support: V2PlanningWorkspaceSupport) {
    this.planningWorkspaceSupport = support;
  }

  async getCurrentBaselineSnapshot(
    orgId: string,
  ): Promise<CurrentBaselineSnapshot> {
    const [
      acceptedYears,
      latestAcceptedBudgetId,
      planningContext,
      utilityIdentity,
    ] = await Promise.all([
      this.planningWorkspaceSupport.resolvePlanningBaselineYears(orgId, {
        persistRepair: true,
      }),
      this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId),
      this.importOverviewService.getPlanningContext(orgId),
      this.getOptionalBoundUtilityIdentity(orgId),
    ]);
    const baselineYears = Array.isArray(planningContext?.baselineYears)
      ? planningContext.baselineYears.map((row) => ({
          year: row.year,
          planningRole: row.planningRole ?? null,
          quality: row.quality,
          sourceStatus: row.sourceStatus,
          sourceBreakdown: row.sourceBreakdown,
          financials: row.financials,
          prices: row.prices,
          volumes: row.volumes,
          soldWaterVolume: row.soldWaterVolume,
          soldWastewaterVolume: row.soldWastewaterVolume,
          combinedSoldVolume: row.combinedSoldVolume,
        }))
      : [];
    return {
      hasTrustedBaseline: latestAcceptedBudgetId !== null && utilityIdentity != null,
      acceptedYears,
      latestAcceptedBudgetId,
      baselineYears,
      utilityIdentity,
      fingerprint: computeVesinvestBaselineFingerprint({
        acceptedYears,
        latestAcceptedBudgetId,
        baselineYears,
        utilityIdentity,
      }),
    };
  }

  async findPlanOrThrow(orgId: string, planId: string) {
    const plan = await this.prisma.vesinvestPlan.findFirst({
      where: {
        id: planId,
        orgId,
      },
      include: {
        projects: {
          include: {
            allocations: {
              orderBy: { year: 'asc' },
            },
          },
          orderBy: { projectCode: 'asc' },
        },
        selectedScenario: {
          select: {
            id: true,
            updatedAt: true,
            computedAt: true,
            computedFromUpdatedAt: true,
          },
        },
        tariffPlans: {
          select: {
            id: true,
            scenarioId: true,
            status: true,
            acceptedAt: true,
            updatedAt: true,
            recommendation: true,
          },
          orderBy: [
            { updatedAt: 'desc' },
            { acceptedAt: 'desc' },
            { createdAt: 'desc' },
            { id: 'desc' },
          ],
        },
      },
    });
    if (!plan) {
      throw new NotFoundException('Vesinvest plan not found.');
    }
    return plan;
  }

  async normalizePlanPayload(
    orgId: string,
    body: CreatePlanBody,
    allowPartial = false,
  ) {
    const utilityName = this.foundationSupport.normalizeText(body.utilityName);
    if (!utilityName && !allowPartial) {
      throw new BadRequestException('Utility name is required.');
    }
    const name =
      this.foundationSupport.normalizeText(body.name) ??
      (utilityName ? `${utilityName} Vesinvest` : 'Vesinvest');
    const horizonYearsRaw =
      body.horizonYears == null ? 20 : Math.round(Number(body.horizonYears));
    if (!Number.isFinite(horizonYearsRaw) || horizonYearsRaw < 20 || horizonYearsRaw > 50) {
      throw new BadRequestException(
        'Horizon must be between 20 and 50 years.',
      );
    }

    const projects = await Promise.all(
      (body.projects ?? []).map((project) => this.normalizeProject(orgId, project)),
    );
    const duplicateProjectCodes = this.foundationSupport.findDuplicateValues(
      projects.map((project) => project.code),
    );
    if (duplicateProjectCodes.length > 0) {
      throw new BadRequestException(
        `Project codes must be unique within a Vesinvest plan. Duplicate codes: ${duplicateProjectCodes.join(
          ', ',
        )}.`,
      );
    }
    for (const project of projects) {
      const outOfRangeAllocations = project.allocations
        .map((allocation) => allocation.year)
        .filter((year) => year < 1900 || year > 2200);
      if (outOfRangeAllocations.length > 0) {
        throw new BadRequestException('Allocation year is invalid.');
      }
    }

    return {
      name,
      utilityName: utilityName ?? 'Vesinvest utility',
      businessId: this.foundationSupport.normalizeText(body.businessId),
      veetiId:
        body.veetiId == null || body.veetiId === 0
          ? null
          : Math.round(Number(body.veetiId)),
      identitySource: this.foundationSupport.normalizeIdentitySource(
        body.identitySource,
      ),
      horizonYears: horizonYearsRaw,
      baselineSourceState: this.foundationSupport.normalizeJsonObject(
        body.baselineSourceState,
      ),
      assetEvidenceState: this.foundationSupport.normalizeJsonObject(
        body.assetEvidenceState,
      ),
      municipalPlanContext: this.foundationSupport.normalizeJsonObject(
        body.municipalPlanContext,
      ),
      maintenanceEvidenceState: this.foundationSupport.normalizeJsonObject(
        body.maintenanceEvidenceState,
      ),
      conditionStudyState: this.foundationSupport.normalizeJsonObject(
        body.conditionStudyState,
      ),
      financialRiskState: this.foundationSupport.normalizeJsonObject(
        body.financialRiskState,
      ),
      publicationState: this.foundationSupport.normalizeJsonObject(
        body.publicationState,
      ),
      communicationState: this.foundationSupport.normalizeJsonObject(
        body.communicationState,
      ),
      projects,
    };
  }

  async normalizeProject(orgId: string, project: PlanProjectInput) {
    const code = this.foundationSupport.normalizeText(project.code);
    const name = this.foundationSupport.normalizeText(project.name);
    if (!code || !name) {
      throw new BadRequestException('Project code and name are required.');
    }
    const group = await this.foundationSupport.resolveGroupDefinition(orgId, project.groupKey);
    const allocations = (project.allocations ?? [])
      .map((allocation) => this.normalizeAllocation(allocation))
      .sort((left, right) => left.year - right.year);
    const duplicateYears = this.foundationSupport.findDuplicateValues(
      allocations.map((allocation) => String(allocation.year)),
    );
    if (duplicateYears.length > 0) {
      throw new BadRequestException(
        `Allocation years must be unique within a project. Duplicate years: ${duplicateYears.join(
          ', ',
        )}.`,
      );
    }
    const totalAmount = allocations.reduce(
      (sum, item) => sum + item.totalAmount,
      0,
    );
    return {
      code,
      name,
      investmentType: this.foundationSupport.normalizeInvestmentType(project.investmentType),
      groupKey: group.key,
      depreciationClassKey:
        normalizeVesinvestDepreciationClassKey(
          group.key,
          this.foundationSupport.normalizeText(project.depreciationClassKey),
        ) ?? group.key,
      accountKey:
        this.foundationSupport.normalizeText(project.accountKey) ?? group.defaultAccountKey,
      reportGroupKey:
        this.foundationSupport.normalizeReportGroupKey(project.reportGroupKey) ??
        group.reportGroupKey,
      subtype: this.foundationSupport.normalizeText(project.subtype),
      notes: this.foundationSupport.normalizeText(project.notes),
      waterAmount: this.foundationSupport.toNullablePositiveNumber(project.waterAmount),
      wastewaterAmount: this.foundationSupport.toNullablePositiveNumber(project.wastewaterAmount),
      totalAmount,
      allocations,
    };
  }

  normalizeAllocation(allocation: PlanProjectAllocationInput) {
    const year = Math.round(Number(allocation.year));
    const totalAmount = this.foundationSupport.round2(Number(allocation.totalAmount ?? 0));
    if (!Number.isFinite(year) || year < 1900 || year > 2200) {
      throw new BadRequestException('Allocation year is invalid.');
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new BadRequestException('Allocation total amount is invalid.');
    }
    return {
      year,
      totalAmount,
      waterAmount: this.foundationSupport.toNullablePositiveNumber(allocation.waterAmount),
      wastewaterAmount: this.foundationSupport.toNullablePositiveNumber(
        allocation.wastewaterAmount,
      ),
    };
  }

  toProjectCreate(
    project: NormalizedPlanProject,
  ): Prisma.VesinvestProjectCreateWithoutPlanInput {
    return {
      projectCode: project.code,
      projectName: project.name,
      investmentType: project.investmentType,
      groupKey: project.groupKey,
      depreciationClassKey: project.depreciationClassKey,
      accountKey: project.accountKey,
      reportGroupKey: project.reportGroupKey,
      subtype: project.subtype,
      notes: project.notes,
      waterAmount: project.waterAmount,
      wastewaterAmount: project.wastewaterAmount,
      totalAmount: project.totalAmount,
      allocations: {
        create: project.allocations.map((allocation) => ({
          year: allocation.year,
          totalAmount: allocation.totalAmount,
          waterAmount: allocation.waterAmount,
          wastewaterAmount: allocation.wastewaterAmount,
        })),
      },
    };
  }

  async buildForecastYearlyInvestments(
    plan: VesinvestPlanRecord,
    groupDefinitions?: Map<string, VesinvestGroupDefinitionRecord>,
  ) {
    const definitions =
      groupDefinitions ?? (await this.foundationSupport.getPersistedGroupDefinitionMap(plan.orgId));
    const rows = plan.projects.flatMap((project) => {
      const group = this.foundationSupport.resolveGroupDefinitionFromMap(
        definitions,
        project.groupKey,
      );
      const depreciationClassKey = group.key;
      const forecastInvestmentType =
        group.key.startsWith('new_')
          ? ('new' as const)
          : ('replacement' as const);
      return project.allocations.map((allocation) => ({
        rowId: allocation.id,
        year: allocation.year,
        amount: this.foundationSupport.round2(this.foundationSupport.toNumber(allocation.totalAmount)),
        target: normalizeV2ValidationText(project.projectName),
        category: group.label,
        depreciationClassKey,
        investmentType: forecastInvestmentType,
        confidence: depreciationClassKey ? ('high' as const) : ('medium' as const),
        waterAmount:
          this.foundationSupport.toNumberNullable(allocation.waterAmount) > 0
            ? this.foundationSupport.round2(this.foundationSupport.toNumberNullable(allocation.waterAmount))
            : null,
        wastewaterAmount:
          this.foundationSupport.toNumberNullable(allocation.wastewaterAmount) > 0
            ? this.foundationSupport.round2(this.foundationSupport.toNumberNullable(allocation.wastewaterAmount))
            : null,
        note: normalizeV2ValidationText(project.notes) || null,
        vesinvestPlanId: plan.id,
        vesinvestProjectId: project.id,
        allocationId: allocation.id,
        projectCode: project.projectCode,
        groupKey: group.key,
        accountKey: group.defaultAccountKey,
        reportGroupKey: project.reportGroupKey ?? group.reportGroupKey,
      }));
    });
    return rows.sort((left, right) => {
      if (left.year !== right.year) {
        return left.year - right.year;
      }
      return (left.projectCode ?? '').localeCompare(right.projectCode ?? '');
    });
  }

  mapPlanSummary(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
    groupDefinitions: Map<string, VesinvestGroupDefinitionRecord>,
  ) {
    const classificationReviewRequired = this.foundationSupport.isClassificationReviewRequired(
      plan,
      groupDefinitions,
    );
    const totalInvestmentAmount = this.foundationSupport.round2(
      plan.projects.reduce(
        (sum, project) => sum + this.foundationSupport.toNumber(project.totalAmount),
        0,
      ),
    );
    const baselineChangedSinceAcceptedRevision =
      this.hasBaselineRevisionDrift(plan, currentBaseline);
    const baselineStatus = this.resolveBaselineStatus(
      plan,
      currentBaseline,
      baselineChangedSinceAcceptedRevision,
    );
    const pricingStatus = this.resolvePricingStatus(
      plan,
      currentBaseline,
      baselineChangedSinceAcceptedRevision,
      classificationReviewRequired,
    );
    const assetEvidenceFields = [
      plan.assetEvidenceState,
      plan.conditionStudyState,
      plan.maintenanceEvidenceState,
      plan.municipalPlanContext,
      plan.financialRiskState,
      plan.publicationState,
      plan.communicationState,
    ];
    const assetEvidenceMissingCount = assetEvidenceFields.filter(
      (value) => !this.hasEvidenceNotes(value),
    ).length;
    return {
      id: plan.id,
      seriesId: plan.seriesId,
      name: plan.name,
      utilityName: plan.utilityName,
      businessId: plan.businessId,
      veetiId: plan.veetiId,
      identitySource: plan.identitySource,
      horizonYears: plan.horizonYears,
      versionNumber: plan.versionNumber,
      status: plan.status,
      baselineStatus,
      pricingStatus,
      selectedScenarioId: plan.selectedScenarioId,
      projectCount: plan.projects.length,
      totalInvestmentAmount,
      lastReviewedAt: plan.lastReviewedAt?.toISOString() ?? null,
      reviewDueAt: plan.reviewDueAt?.toISOString() ?? null,
      classificationReviewRequired,
      assetEvidenceReady: assetEvidenceMissingCount === 0,
      assetEvidenceMissingCount,
      baselineChangedSinceAcceptedRevision,
      investmentPlanChangedSinceFeeRecommendation:
        plan.investmentPlanChangedSinceFeeRecommendation,
      tariffPlanStatus: this.resolveTariffPlanStatus(plan),
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint: plan.scenarioFingerprint,
      updatedAt: plan.updatedAt.toISOString(),
      createdAt: plan.createdAt.toISOString(),
    };
  }

  async mapPlan(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    const groupDefinitions = await this.foundationSupport.getPersistedGroupDefinitionMap(plan.orgId);
    const classificationReviewRequired =
      this.foundationSupport.isClassificationReviewRequired(
        plan,
        groupDefinitions,
      );
    const horizonStart =
      plan.projects.flatMap((project) => project.allocations).reduce<number | null>(
        (minYear, allocation) =>
          minYear == null ? allocation.year : Math.min(minYear, allocation.year),
        null,
      ) ?? new Date().getFullYear();
    const horizonYears = Array.from({ length: plan.horizonYears }, (_, index) =>
      horizonStart + index,
    );

    const yearlyTotals = horizonYears.map((year) => {
      const totals = plan.projects.reduce(
        (acc, project) => {
          const allocation = project.allocations.find((item) => item.year === year);
          acc.total += this.foundationSupport.toNumberNullable(allocation?.totalAmount ?? null);
          acc.water += this.foundationSupport.toNumberNullable(allocation?.waterAmount ?? null);
          acc.wastewater += this.foundationSupport.toNumberNullable(
            allocation?.wastewaterAmount ?? null,
          );
          return acc;
        },
        { total: 0, water: 0, wastewater: 0 },
      );
      return {
        year,
        totalAmount: this.foundationSupport.round2(totals.total),
        waterAmount: this.foundationSupport.round2(totals.water),
        wastewaterAmount: this.foundationSupport.round2(totals.wastewater),
      };
    });

    const fiveYearBands = [];
    for (let index = 0; index < yearlyTotals.length; index += 5) {
      const slice = yearlyTotals.slice(index, index + 5);
      if (slice.length === 0) {
        continue;
      }
      fiveYearBands.push({
        startYear: slice[0]!.year,
        endYear: slice[slice.length - 1]!.year,
        totalAmount: this.foundationSupport.round2(
          slice.reduce((sum, item) => sum + item.totalAmount, 0),
        ),
      });
    }
    const summarizeAllocations = (
      projects: VesinvestPlanRecord['projects'],
      years: number[],
    ) => {
      const yearSet = new Set(years);
      return projects.reduce(
        (acc, project) => {
          const projectTotal = project.allocations
            .filter((allocation) => yearSet.has(allocation.year))
            .reduce(
              (sum, allocation) =>
                sum + this.foundationSupport.toNumberNullable(allocation.totalAmount),
              0,
            );
          return {
            totalAmount: acc.totalAmount + projectTotal,
            waterAmount:
              acc.waterAmount +
              project.allocations
                .filter((allocation) => yearSet.has(allocation.year))
                .reduce(
                  (sum, allocation) =>
                    sum + this.foundationSupport.toNumberNullable(allocation.waterAmount),
                  0,
                ),
            wastewaterAmount:
              acc.wastewaterAmount +
              project.allocations
                .filter((allocation) => yearSet.has(allocation.year))
                .reduce(
                  (sum, allocation) =>
                    sum + this.foundationSupport.toNumberNullable(allocation.wastewaterAmount),
                  0,
                ),
          };
        },
        { totalAmount: 0, waterAmount: 0, wastewaterAmount: 0 },
      );
    };
    const lawBucketDefinitions = [
      { key: 'years_1_5', years: horizonYears.slice(0, 5) },
      { key: 'years_6_10', years: horizonYears.slice(5, 10) },
      { key: 'years_11_20', years: horizonYears.slice(10, 20) },
    ];
    const renovationTotals = summarizeAllocations(
      plan.projects.filter((project) => project.investmentType === 'sanering'),
      horizonYears,
    );
    const newInvestmentTotals = summarizeAllocations(
      plan.projects.filter((project) => project.investmentType === 'nyanlaggning'),
      horizonYears,
    );
    const repairTotals = summarizeAllocations(
      plan.projects.filter((project) => project.investmentType === 'reparation'),
      horizonYears,
    );
    const lawInvestmentSummary = {
      horizonYears: plan.horizonYears,
      totalAmount: this.foundationSupport.round2(
        yearlyTotals.reduce((sum, item) => sum + item.totalAmount, 0),
      ),
      renovationAmount: this.foundationSupport.round2(renovationTotals.totalAmount),
      newInvestmentAmount: this.foundationSupport.round2(newInvestmentTotals.totalAmount),
      repairAmount: this.foundationSupport.round2(repairTotals.totalAmount),
      timeBuckets: lawBucketDefinitions
        .filter((bucket) => bucket.years.length > 0)
        .map((bucket) => {
          const totals = summarizeAllocations(plan.projects, bucket.years);
          return {
            key: bucket.key,
            startYear: bucket.years[0]!,
            endYear: bucket.years[bucket.years.length - 1]!,
            totalAmount: this.foundationSupport.round2(totals.totalAmount),
            waterAmount: this.foundationSupport.round2(totals.waterAmount),
            wastewaterAmount: this.foundationSupport.round2(totals.wastewaterAmount),
          };
        }),
      byInvestmentType: (['sanering', 'nyanlaggning', 'reparation'] as const).map(
        (investmentType) => {
          const projects = plan.projects.filter(
            (project) => project.investmentType === investmentType,
          );
          const totals = summarizeAllocations(projects, horizonYears);
          return {
            investmentType,
            projectCount: projects.length,
            totalAmount: this.foundationSupport.round2(totals.totalAmount),
          };
        },
      ),
      byAssetCategory: [...new Set(plan.projects.map((project) => project.groupKey))].map(
        (groupKey) => {
          const projects = plan.projects.filter((project) => project.groupKey === groupKey);
          const group = this.foundationSupport.resolveGroupDefinitionFromMap(
            groupDefinitions,
            groupKey,
          );
          const totals = summarizeAllocations(projects, horizonYears);
          return {
            groupKey,
            groupLabel: group.label,
            projectCount: projects.length,
            totalAmount: this.foundationSupport.round2(totals.totalAmount),
            waterAmount: this.foundationSupport.round2(totals.waterAmount),
            wastewaterAmount: this.foundationSupport.round2(totals.wastewaterAmount),
          };
        },
      ),
    };

    return {
      ...this.mapPlanSummary(plan, currentBaseline, groupDefinitions),
      feeRecommendationStatus: this.resolvePricingStatus(
        plan,
        currentBaseline,
        this.hasBaselineRevisionDrift(plan, currentBaseline),
        classificationReviewRequired,
      ),
      feeRecommendation: plan.feeRecommendation ?? null,
      baselineSourceState: plan.baselineSourceState ?? null,
      assetEvidenceState: plan.assetEvidenceState ?? null,
      municipalPlanContext: plan.municipalPlanContext ?? null,
      maintenanceEvidenceState: plan.maintenanceEvidenceState ?? null,
      conditionStudyState: plan.conditionStudyState ?? null,
      financialRiskState: plan.financialRiskState ?? null,
      publicationState: plan.publicationState ?? null,
      communicationState: plan.communicationState ?? null,
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint: plan.scenarioFingerprint,
      horizonYearsRange: horizonYears,
      yearlyTotals,
      fiveYearBands,
      lawInvestmentSummary,
      projects: plan.projects.map((project) => {
        const group = this.foundationSupport.resolveGroupDefinitionFromMap(
          groupDefinitions,
          project.groupKey,
        );
        return {
          id: project.id,
          code: project.projectCode,
          name: project.projectName,
          investmentType: project.investmentType,
          groupKey: project.groupKey,
          groupLabel: group.label,
          depreciationClassKey:
            normalizeVesinvestDepreciationClassKey(
              group.key,
              project.depreciationClassKey,
            ) ?? group.key,
          defaultAccountKey: project.accountKey ?? group.defaultAccountKey,
          reportGroupKey: project.reportGroupKey ?? group.reportGroupKey,
          subtype: project.subtype,
          notes: project.notes,
          waterAmount: this.foundationSupport.toNumberNullable(project.waterAmount),
          wastewaterAmount: this.foundationSupport.toNumberNullable(project.wastewaterAmount),
          totalAmount: this.foundationSupport.toNumber(project.totalAmount),
          allocations: project.allocations.map((allocation) => ({
            id: allocation.id,
            year: allocation.year,
            totalAmount: this.foundationSupport.toNumber(allocation.totalAmount),
            waterAmount: this.foundationSupport.toNumberNullable(allocation.waterAmount),
            wastewaterAmount: this.foundationSupport.toNumberNullable(
              allocation.wastewaterAmount,
            ),
          })),
        };
      }),
    };
  }

  private hasEvidenceNotes(value: unknown) {
    return (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as { notes?: unknown }).notes === 'string' &&
      (value as { notes: string }).notes.trim().length > 0
    );
  }

  resolveBaselineStatus(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
    baselineChangedSinceAcceptedRevision: boolean,
  ) {
    if (this.foundationSupport.hasUtilityIdentityDrift(plan, currentBaseline)) {
      return 'incomplete' as const;
    }
    if (
      currentBaseline.hasTrustedBaseline &&
      baselineChangedSinceAcceptedRevision !== true
    ) {
      return 'verified' as const;
    }
    if (plan.projects.length > 0) {
      return 'incomplete' as const;
    }
    return 'draft' as const;
  }

  resolvePricingStatus(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
    baselineChangedSinceAcceptedRevision: boolean,
    classificationReviewRequired: boolean,
  ) {
    if (this.foundationSupport.hasUtilityIdentityDrift(plan, currentBaseline)) {
      return 'blocked' as const;
    }
    if (classificationReviewRequired) {
      return 'blocked' as const;
    }
    if (
      !currentBaseline.hasTrustedBaseline ||
      baselineChangedSinceAcceptedRevision
    ) {
      return 'blocked' as const;
    }
    const scenarioStillCurrent =
      plan.selectedScenarioId != null &&
      plan.scenarioFingerprint != null &&
      this.foundationSupport.normalizeDateIso(plan.selectedScenario?.updatedAt ?? null) != null &&
      this.foundationSupport.normalizeDateIso(plan.selectedScenario?.computedFromUpdatedAt ?? null) ===
        this.foundationSupport.normalizeDateIso(plan.selectedScenario?.updatedAt ?? null) &&
      this.isPlanFingerprintTimestampAlignedWithSelectedScenario(
        plan,
        (plan as { updatedAt?: Date | string | null }).updatedAt ?? null,
      );
    const acceptedTariffPlanIsCurrent =
      this.resolveTariffPlanStatus(plan) === 'accepted';
    if (
      ((scenarioStillCurrent && plan.feeRecommendationStatus === 'verified') ||
        acceptedTariffPlanIsCurrent) &&
      !plan.investmentPlanChangedSinceFeeRecommendation
    ) {
      return 'verified' as const;
    }
    return 'provisional' as const;
  }

  resolveTariffPlanStatus(
    plan: VesinvestPlanRecord,
  ): 'draft' | 'accepted' | 'stale' | null {
    const tariffPlans = Array.isArray((plan as any).tariffPlans)
      ? ((plan as any).tariffPlans as Array<{
          scenarioId: string | null;
          status: 'draft' | 'accepted' | 'stale';
          updatedAt: Date;
          recommendation?: unknown;
        }>)
      : [];
    const relevant = tariffPlans.filter(
      (item) => !plan.selectedScenarioId || item.scenarioId === plan.selectedScenarioId,
    );
    const latest = relevant[0] ?? null;
    if (!latest) {
      return null;
    }
    if (
      latest.status === 'accepted' &&
      (!this.isPlanFingerprintTimestampAlignedWithSelectedScenario(
          plan,
          latest.updatedAt,
        ) ||
        this.readTariffRecommendationFingerprint(latest.recommendation) !==
          plan.scenarioFingerprint)
    ) {
      return 'stale';
    }
    return latest.status ?? null;
  }

  private readTariffRecommendationFingerprint(recommendation: unknown) {
    if (
      recommendation &&
      typeof recommendation === 'object' &&
      !Array.isArray(recommendation) &&
      typeof (recommendation as { scenarioFingerprint?: unknown }).scenarioFingerprint === 'string'
    ) {
      return (recommendation as { scenarioFingerprint: string }).scenarioFingerprint;
    }
    return null;
  }

  private isPlanFingerprintTimestampAlignedWithSelectedScenario(
    plan: VesinvestPlanRecord,
    acceptedAt: Date | string | null | undefined,
  ) {
    const scenarioUpdatedAt = this.foundationSupport.normalizeDateIso(
      plan.selectedScenario?.updatedAt ?? null,
    );
    const acceptedUpdatedAt = this.foundationSupport.normalizeDateIso(acceptedAt ?? null);
    if (!plan.selectedScenarioId) {
      return false;
    }
    if (!plan.scenarioFingerprint || !scenarioUpdatedAt || !acceptedUpdatedAt) {
      return false;
    }
    return new Date(acceptedUpdatedAt).getTime() >= new Date(scenarioUpdatedAt).getTime();
  }

  hasBaselineRevisionDrift(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    if (this.foundationSupport.hasUtilityIdentityDrift(plan, currentBaseline)) {
      return true;
    }
    if (plan.baselineFingerprint) {
      return plan.baselineFingerprint !== currentBaseline.fingerprint;
    }
    const saved = this.foundationSupport.readBaselineSourceState(plan.baselineSourceState);
    if (!this.foundationSupport.hasSavedBaselineSnapshot(saved)) {
      return this.foundationSupport.requiresLegacyBaselineReverification(plan, saved);
    }
    if (this.foundationSupport.hasSavedBaselineIdentityDrift(saved, currentBaseline)) {
      return true;
    }
    if (saved.latestAcceptedBudgetId !== currentBaseline.latestAcceptedBudgetId) {
      return true;
    }
    return (
      JSON.stringify(saved.acceptedYears) !==
      JSON.stringify(currentBaseline.acceptedYears)
    );
  }

  buildMergedBaselineSourceState(
    current: Prisma.JsonValue | null,
    incoming: Record<string, unknown> | null | undefined,
    currentBaseline: CurrentBaselineSnapshot,
  ): Prisma.InputJsonObject {
    const base =
      incoming && typeof incoming === 'object' && !Array.isArray(incoming)
        ? JSON.parse(JSON.stringify(incoming))
        : current && typeof current === 'object' && !Array.isArray(current)
        ? JSON.parse(JSON.stringify(current))
        : {};
    const record =
      base && typeof base === 'object' && !Array.isArray(base)
        ? (base as Record<string, unknown>)
        : {};
    const timestamp = new Date().toISOString();
    return {
      ...record,
      source: 'accepted_planning_baseline',
      veetiId: currentBaseline.utilityIdentity?.veetiId ?? null,
      utilityName: currentBaseline.utilityIdentity?.utilityName ?? null,
      businessId: currentBaseline.utilityIdentity?.businessId ?? null,
      identitySource: currentBaseline.utilityIdentity?.identitySource ?? null,
      acceptedYears: currentBaseline.acceptedYears,
      latestAcceptedBudgetId: currentBaseline.latestAcceptedBudgetId,
      baselineYears:
        currentBaseline.baselineYears as unknown as Prisma.InputJsonValue,
      baselineFingerprint: currentBaseline.fingerprint,
      verifiedAt: timestamp,
      snapshotCapturedAt:
        typeof record.snapshotCapturedAt === 'string'
          ? record.snapshotCapturedAt
          : timestamp,
    };
  }

  async getOptionalBoundUtilityIdentity(
    orgId: string,
  ): Promise<VesinvestUtilityIdentitySnapshot | null> {
    const bound = await this.importOverviewService.getBoundUtilityIdentity(orgId);
    if (!bound?.veetiId || !bound.utilityName) {
      return null;
    }
    return {
      veetiId: bound.veetiId,
      utilityName: bound.utilityName,
      businessId: bound.businessId ?? null,
      identitySource: 'veeti',
    };
  }

  async getRequiredBoundUtilityIdentity(
    orgId: string,
  ): Promise<VesinvestUtilityIdentitySnapshot> {
    const identity = await this.getOptionalBoundUtilityIdentity(orgId);
    if (!identity) {
      throw new BadRequestException(
        'Bind this workspace to a VEETI utility before creating a Vesinvest plan.',
      );
    }
    return identity;
  }

}
