import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import {
  computeVesinvestBaselineFingerprint,
  computeVesinvestScenarioFingerprint,
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
  DEFAULT_VESINVEST_REPORT_GROUP_DEFINITIONS,
  type VesinvestGroupDefinitionRecord,
  type VesinvestUtilityIdentitySnapshot,
} from './vesinvest-contract';

type PlanProjectAllocationInput = {
  year: number;
  totalAmount: number;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
};

type PlanProjectInput = {
  id?: string;
  code: string;
  name: string;
  investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
  groupKey: string;
  depreciationClassKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
  subtype?: string | null;
  notes?: string | null;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
  allocations?: PlanProjectAllocationInput[];
};

type CreatePlanBody = {
  name?: string;
  utilityName?: string;
  businessId?: string | null;
  veetiId?: number | null;
  identitySource?: 'manual' | 'veeti' | 'mixed';
  horizonYears?: number;
  baselineSourceState?: Record<string, unknown> | null;
  projects?: PlanProjectInput[];
};

type UpdatePlanBody = {
  name?: string;
  utilityName?: string;
  businessId?: string | null;
  veetiId?: number | null;
  identitySource?: 'manual' | 'veeti' | 'mixed';
  horizonYears?: number;
  status?: 'draft' | 'active' | 'archived';
  baselineStatus?: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
  baselineSourceState?: Record<string, unknown> | null;
  projects?: PlanProjectInput[];
};

type SyncPlanBody = {
  compute?: boolean;
  baselineSourceState?: Record<string, unknown> | null;
};

type UpdateGroupDefinitionBody = {
  label?: string;
  defaultAccountKey?: string;
  defaultDepreciationClassKey?: string | null;
  reportGroupKey?: string;
  serviceSplit?: 'water' | 'wastewater' | 'mixed';
};

type CurrentBaselineSnapshot = {
  hasTrustedBaseline: boolean;
  acceptedYears: number[];
  latestAcceptedBudgetId: string | null;
  baselineYears: Array<Record<string, unknown>>;
  utilityIdentity: VesinvestUtilityIdentitySnapshot | null;
  fingerprint: string;
};

type VesinvestPlanRecord = Prisma.VesinvestPlanGetPayload<{
  include: {
    projects: {
      include: {
        allocations: true;
      };
    };
    selectedScenario: {
      select: {
        id: true;
        updatedAt: true;
        computedAt: true;
        computedFromUpdatedAt: true;
      };
    };
  };
}>;

@Injectable()
export class V2VesinvestService {
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: V2ForecastService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
  }

  async getPlanningContextSummary(orgId: string) {
    const [plans, currentBaseline] = await Promise.all([
      this.prisma.vesinvestPlan.findMany({
        where: {
          orgId,
          status: {
            not: 'archived',
          },
        },
        include: {
          projects: {
            include: {
              allocations: true,
            },
          },
          selectedScenario: {
            select: {
              id: true,
              updatedAt: true,
              computedAt: true,
              computedFromUpdatedAt: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.getCurrentBaselineSnapshot(orgId),
    ]);

    const activePlanRecord = this.resolveActivePlanRecord(plans);
    const selectedPlanRecord = this.resolveSelectedPlanRecord(plans, activePlanRecord);

    return {
      vesinvest: {
        hasPlan: plans.length > 0,
        planCount: plans.length,
        activePlan: activePlanRecord
          ? this.mapPlanSummary(activePlanRecord, currentBaseline)
          : null,
        selectedPlan: selectedPlanRecord
          ? this.mapPlanSummary(selectedPlanRecord, currentBaseline)
          : null,
      },
    };
  }

  async getInvestmentGroupDefinitions(orgId: string) {
    return this.listPersistedGroupDefinitions(orgId);
  }

  async updateInvestmentGroupDefinition(
    orgId: string,
    groupKey: string,
    body: UpdateGroupDefinitionBody,
    roles: string[],
  ) {
    if (!this.isAdminRole(roles)) {
      throw new ForbiddenException(
        'Only admins can update Vesinvest group definitions.',
      );
    }
    const current = await this.resolveGroupDefinition(orgId, groupKey);
    const label = this.normalizeText(body.label) ?? current.label;
    const defaultAccountKey =
      this.normalizeText(body.defaultAccountKey) ?? current.defaultAccountKey;
    const defaultDepreciationClassKey =
      body.defaultDepreciationClassKey === null
        ? null
        : this.normalizeText(body.defaultDepreciationClassKey) ??
          current.defaultDepreciationClassKey;
    const reportGroupKey =
      this.normalizeReportGroupKey(body.reportGroupKey) ?? current.reportGroupKey;
    const serviceSplit =
      this.normalizeServiceSplit(body.serviceSplit) ?? current.serviceSplit;

    if (!label || !defaultAccountKey || !reportGroupKey) {
      throw new BadRequestException(
        'Group label, account key, and report group key are required.',
      );
    }

    const updated = await this.prisma.vesinvestGroupOverride.upsert({
      where: {
        orgId_key: {
          orgId,
          key: current.key,
        },
      },
      create: {
        orgId,
        key: current.key,
        label,
        defaultAccountKey,
        defaultDepreciationClassKey,
        reportGroupKey,
        serviceSplit,
      },
      update: {
        label,
        defaultAccountKey,
        defaultDepreciationClassKey,
        reportGroupKey,
        serviceSplit,
      },
    });

    return {
      key: updated.key,
      label: updated.label,
      defaultAccountKey: updated.defaultAccountKey,
      defaultDepreciationClassKey: updated.defaultDepreciationClassKey,
      reportGroupKey: updated.reportGroupKey,
      serviceSplit: updated.serviceSplit,
    };
  }

  async listPlans(orgId: string) {
    const [plans, currentBaseline] = await Promise.all([
      this.prisma.vesinvestPlan.findMany({
        where: { orgId },
        include: {
          projects: {
            include: {
              allocations: true,
            },
          },
          selectedScenario: {
            select: {
              id: true,
              updatedAt: true,
              computedAt: true,
              computedFromUpdatedAt: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.getCurrentBaselineSnapshot(orgId),
    ]);
    return plans.map((plan) => this.mapPlanSummary(plan, currentBaseline));
  }

  async getPlan(orgId: string, planId: string) {
    const [plan, currentBaseline] = await Promise.all([
      this.findPlanOrThrow(orgId, planId),
      this.getCurrentBaselineSnapshot(orgId),
    ]);
    return this.mapPlan(plan, currentBaseline);
  }

  async createPlan(orgId: string, body: CreatePlanBody) {
    const utilityIdentity = await this.getRequiredBoundUtilityIdentity(orgId);
    const payload = await this.normalizePlanPayload(orgId, {
      ...body,
      utilityName: utilityIdentity.utilityName,
      businessId: utilityIdentity.businessId,
      veetiId: utilityIdentity.veetiId,
      identitySource: utilityIdentity.identitySource,
    });
    const reviewDueAt = this.addYears(new Date(), 3);
    const series = await this.prisma.vesinvestPlanSeries.create({
      data: {
        orgId,
      },
      select: {
        id: true,
      },
    });
    const plan = await this.prisma.vesinvestPlan.create({
      data: {
        orgId,
        seriesId: series.id,
        name: payload.name,
        utilityName: payload.utilityName,
        businessId: payload.businessId,
        veetiId: payload.veetiId,
        identitySource: payload.identitySource,
        horizonYears: payload.horizonYears,
        versionNumber: 1,
        status: 'draft',
        baselineStatus: payload.projects.length > 0 ? 'incomplete' : 'draft',
        baselineSourceState:
          payload.baselineSourceState == null
            ? undefined
            : payload.baselineSourceState,
        reviewDueAt,
        projects: {
          create: payload.projects.map((project) => this.toProjectCreate(project)),
        },
      },
      include: {
        projects: {
          include: {
            allocations: true,
          },
        },
        selectedScenario: {
          select: {
            id: true,
            updatedAt: true,
            computedAt: true,
            computedFromUpdatedAt: true,
          },
        },
      },
    });
    const currentBaseline = await this.getCurrentBaselineSnapshot(orgId);
    return this.mapPlan(plan, currentBaseline);
  }

  async updatePlan(orgId: string, planId: string, body: UpdatePlanBody) {
    const current = await this.findPlanOrThrow(orgId, planId);
    this.assertIdentityMutationNotRequested(body, current);
    const payload = await this.normalizePlanPayload(
      orgId,
      {
        name: body.name ?? current.name,
        utilityName: current.utilityName,
        businessId: current.businessId,
        veetiId: current.veetiId,
        identitySource: current.identitySource,
        horizonYears:
          body.horizonYears !== undefined
            ? body.horizonYears
            : current.horizonYears,
        projects:
          body.projects !== undefined
            ? body.projects
            : current.projects.map((project) => ({
                id: project.id,
                code: project.projectCode,
                name: project.projectName,
                investmentType: project.investmentType,
                groupKey: project.groupKey,
                depreciationClassKey: project.depreciationClassKey,
                accountKey: project.accountKey,
                reportGroupKey: project.reportGroupKey,
                subtype: project.subtype,
                notes: project.notes,
                waterAmount: this.toNumber(project.waterAmount),
                wastewaterAmount: this.toNumber(project.wastewaterAmount),
                allocations: project.allocations.map((allocation) => ({
                  year: allocation.year,
                  totalAmount: this.toNumber(allocation.totalAmount),
                  waterAmount: this.toNumberNullable(allocation.waterAmount),
                  wastewaterAmount: this.toNumberNullable(
                    allocation.wastewaterAmount,
                  ),
                })),
              })),
      },
      true,
    );

    const investmentPlanChanged =
      body.projects !== undefined || payload.horizonYears !== current.horizonYears;

    const nextBaselineStatus =
      body.baselineStatus ??
      (payload.projects.length > 0 ? 'incomplete' : current.baselineStatus);
    const nextFeeRecommendationStatus =
      body.feeRecommendationStatus ??
      (investmentPlanChanged ? 'blocked' : current.feeRecommendationStatus);

    await this.prisma.$transaction(async (tx) => {
      if (body.projects !== undefined) {
        await tx.vesinvestProjectAllocation.deleteMany({
          where: {
            project: {
              planId,
            },
          },
        });
        await tx.vesinvestProject.deleteMany({
          where: {
            planId,
          },
        });
      }

      await tx.vesinvestPlan.update({
        where: { id: planId },
        data: {
          name: payload.name,
          utilityName: current.utilityName,
          businessId: current.businessId,
          veetiId: current.veetiId,
          identitySource: current.identitySource,
          horizonYears: payload.horizonYears,
          status: body.status ?? current.status,
          baselineStatus: nextBaselineStatus,
          feeRecommendationStatus: nextFeeRecommendationStatus,
          selectedScenarioId: current.selectedScenarioId,
          feeRecommendation:
            investmentPlanChanged
              ? Prisma.JsonNull
              : undefined,
          baselineFingerprint: current.baselineFingerprint,
          scenarioFingerprint:
            investmentPlanChanged ? null : current.scenarioFingerprint,
          baselineSourceState:
            body.baselineSourceState !== undefined
              ? payload.baselineSourceState == null
                ? Prisma.JsonNull
                : payload.baselineSourceState
              : undefined,
          lastReviewedAt:
            body.lastReviewedAt !== undefined
              ? this.normalizeDate(body.lastReviewedAt)
              : current.lastReviewedAt,
          reviewDueAt:
            body.reviewDueAt !== undefined
              ? this.normalizeDate(body.reviewDueAt)
              : current.reviewDueAt,
          investmentPlanChangedSinceFeeRecommendation:
            investmentPlanChanged
              ? true
              : current.investmentPlanChangedSinceFeeRecommendation,
          baselineChangedSinceAcceptedRevision:
            investmentPlanChanged
              ? true
              : current.baselineChangedSinceAcceptedRevision,
          projects:
            body.projects !== undefined
              ? {
                  create: payload.projects.map((project) =>
                    this.toProjectCreate(project),
                  ),
                }
              : undefined,
        },
      });
      if ((body.status ?? current.status) === 'active') {
        await tx.vesinvestPlan.updateMany({
          where: {
            orgId,
            seriesId: current.seriesId,
            id: { not: planId },
            status: 'active',
          },
          data: {
            status: 'archived',
          },
        });
      }
    });

    return this.getPlan(orgId, planId);
  }

  async clonePlan(orgId: string, sourcePlanId: string) {
    const source = await this.findPlanOrThrow(orgId, sourcePlanId);
    const boundUtilityIdentity = await this.getOptionalBoundUtilityIdentity(orgId);
    const nextVersionNumber = await this.resolveNextRevisionVersion(
      orgId,
      source.seriesId,
    );
    const clone = await this.prisma.vesinvestPlan.create({
      data: {
        orgId,
        seriesId: source.seriesId,
        name: source.name,
        utilityName: boundUtilityIdentity?.utilityName ?? source.utilityName,
        businessId: boundUtilityIdentity?.businessId ?? source.businessId,
        veetiId: boundUtilityIdentity?.veetiId ?? source.veetiId,
        identitySource:
          boundUtilityIdentity?.identitySource ?? source.identitySource,
        horizonYears: source.horizonYears,
        versionNumber: nextVersionNumber,
        status: 'draft',
        baselineStatus: source.projects.length > 0 ? 'incomplete' : 'draft',
        feeRecommendationStatus: 'blocked',
        sourcePlanId: source.id,
        reviewDueAt: this.addYears(new Date(), 3),
        lastReviewedAt: null,
        investmentPlanChangedSinceFeeRecommendation: true,
        baselineChangedSinceAcceptedRevision: true,
        baselineFingerprint: null,
        scenarioFingerprint: null,
        baselineSourceState: source.baselineSourceState ?? undefined,
        projects: {
          create: await Promise.all(
            source.projects.map(async (project) => {
              const group = await this.resolveGroupDefinition(
                orgId,
                project.groupKey,
              );
              return this.toProjectCreate({
              code: project.projectCode,
              name: project.projectName,
              investmentType: project.investmentType,
              groupKey: project.groupKey,
              depreciationClassKey: project.depreciationClassKey,
              accountKey: project.accountKey ?? group.defaultAccountKey,
              reportGroupKey: project.reportGroupKey ?? group.reportGroupKey,
              subtype: project.subtype,
              notes: project.notes,
              waterAmount: this.toNumberNullable(project.waterAmount),
              wastewaterAmount: this.toNumberNullable(project.wastewaterAmount),
              totalAmount: project.allocations.reduce(
                (sum, allocation) => sum + this.toNumber(allocation.totalAmount),
                0,
              ),
              allocations: project.allocations.map((allocation) => ({
                year: allocation.year,
                totalAmount: this.toNumber(allocation.totalAmount),
                waterAmount: this.toNumberNullable(allocation.waterAmount),
                wastewaterAmount: this.toNumberNullable(
                  allocation.wastewaterAmount,
                ),
              })),
            });
            }),
          ),
        },
      },
      include: {
        projects: {
          include: {
            allocations: true,
          },
        },
        selectedScenario: {
          select: {
            id: true,
            updatedAt: true,
            computedAt: true,
            computedFromUpdatedAt: true,
          },
        },
      },
    });
    const currentBaseline = await this.getCurrentBaselineSnapshot(orgId);
    return this.mapPlan(clone, currentBaseline);
  }

  async syncPlanToForecast(
    orgId: string,
    planId: string,
    body?: SyncPlanBody,
  ) {
    const plan = await this.findPlanOrThrow(orgId, planId);
    if (!plan.projects.length) {
      throw new BadRequestException(
        'Create at least one investment project before opening pricing.',
      );
    }
    const currentBaseline = await this.getCurrentBaselineSnapshot(orgId);
    if (this.hasUtilityIdentityDrift(plan, currentBaseline)) {
      throw new BadRequestException(
        'Utility binding does not match this Vesinvest revision. Bind the org to the correct utility before opening pricing.',
      );
    }
    if (!currentBaseline.hasTrustedBaseline) {
      throw new BadRequestException(
        'Baseline not verified. Complete baseline evidence before opening pricing.',
      );
    }

    const yearlyInvestments = await this.buildForecastYearlyInvestments(plan);
    if (!yearlyInvestments.some((item) => item.amount > 0)) {
      throw new BadRequestException(
        'Add at least one investment allocation before opening pricing.',
      );
    }
    const compute = body?.compute !== false;
    let scenarioId = plan.selectedScenarioId ?? null;

    if (!scenarioId) {
      const created = await this.forecastService.createForecastScenario(orgId, {
        name: `${plan.name} v${plan.versionNumber}`,
        horizonYears: plan.horizonYears,
        compute: false,
      });
      scenarioId = created.id;
    }

    await this.forecastService.updateForecastScenario(orgId, scenarioId, {
      name: `${plan.name} v${plan.versionNumber}`,
      horizonYears: plan.horizonYears,
      yearlyInvestments,
    });

    const scenario = compute
      ? await this.forecastService.computeForecastScenario(orgId, scenarioId)
      : await this.forecastService.getForecastScenario(orgId, scenarioId);
    const scenarioFingerprint = computeVesinvestScenarioFingerprint({
      scenarioId: scenario.id,
      updatedAt: scenario.updatedAt,
      computedFromUpdatedAt: scenario.computedFromUpdatedAt,
      yearlyInvestments: scenario.yearlyInvestments,
      years: scenario.years,
    });

    const mergedBaselineSourceState = this.buildMergedBaselineSourceState(
      plan.baselineSourceState,
      body?.baselineSourceState,
      currentBaseline,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.vesinvestPlan.updateMany({
        where: {
          orgId,
          seriesId: plan.seriesId,
          id: { not: planId },
          status: 'active',
        },
        data: {
          status: 'archived',
        },
      });
      await tx.vesinvestPlan.update({
        where: { id: planId },
        data: {
          selectedScenarioId: scenario.id,
          status: 'active',
          baselineStatus: 'verified',
          feeRecommendationStatus: compute ? 'verified' : 'provisional',
          feeRecommendation: this.buildFeeRecommendationSnapshot(
            plan,
            scenario,
            currentBaseline,
            scenarioFingerprint,
          ),
          baselineSourceState: mergedBaselineSourceState,
          baselineFingerprint: currentBaseline.fingerprint,
          scenarioFingerprint,
          lastReviewedAt: new Date(),
          reviewDueAt: this.addYears(new Date(), 3),
          baselineChangedSinceAcceptedRevision: false,
          investmentPlanChangedSinceFeeRecommendation: false,
        },
      });
    });

    return {
      plan: await this.getPlan(orgId, planId),
      scenarioId: scenario.id,
    };
  }

  private async getCurrentBaselineSnapshot(
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

  private async findPlanOrThrow(orgId: string, planId: string) {
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
      },
    });
    if (!plan) {
      throw new NotFoundException('Vesinvest plan not found.');
    }
    return plan;
  }

  private async normalizePlanPayload(
    orgId: string,
    body: CreatePlanBody,
    allowPartial = false,
  ) {
    const utilityName = this.normalizeText(body.utilityName);
    if (!utilityName && !allowPartial) {
      throw new BadRequestException('Utility name is required.');
    }
    const name =
      this.normalizeText(body.name) ??
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
    const duplicateProjectCodes = this.findDuplicateValues(
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
      businessId: this.normalizeText(body.businessId),
      veetiId:
        body.veetiId == null || body.veetiId === 0
          ? null
          : Math.round(Number(body.veetiId)),
      identitySource: this.normalizeIdentitySource(body.identitySource),
      horizonYears: horizonYearsRaw,
      baselineSourceState: this.normalizeJsonObject(body.baselineSourceState),
      projects,
    };
  }

  private async normalizeProject(orgId: string, project: PlanProjectInput) {
    const code = this.normalizeText(project.code);
    const name = this.normalizeText(project.name);
    if (!code || !name) {
      throw new BadRequestException('Project code and name are required.');
    }
    const group = await this.resolveGroupDefinition(orgId, project.groupKey);
    const allocations = (project.allocations ?? [])
      .map((allocation) => this.normalizeAllocation(allocation))
      .sort((left, right) => left.year - right.year);
    const duplicateYears = this.findDuplicateValues(
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
      investmentType: this.normalizeInvestmentType(project.investmentType),
      groupKey: group.key,
      depreciationClassKey:
        this.normalizeText(project.depreciationClassKey) ??
        group.defaultDepreciationClassKey,
      accountKey:
        this.normalizeText(project.accountKey) ?? group.defaultAccountKey,
      reportGroupKey:
        this.normalizeReportGroupKey(project.reportGroupKey) ??
        group.reportGroupKey,
      subtype: this.normalizeText(project.subtype),
      notes: this.normalizeText(project.notes),
      waterAmount: this.toNullablePositiveNumber(project.waterAmount),
      wastewaterAmount: this.toNullablePositiveNumber(project.wastewaterAmount),
      totalAmount,
      allocations,
    };
  }

  private normalizeAllocation(allocation: PlanProjectAllocationInput) {
    const year = Math.round(Number(allocation.year));
    const totalAmount = this.round2(Number(allocation.totalAmount ?? 0));
    if (!Number.isFinite(year) || year < 1900 || year > 2200) {
      throw new BadRequestException('Allocation year is invalid.');
    }
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new BadRequestException('Allocation total amount is invalid.');
    }
    return {
      year,
      totalAmount,
      waterAmount: this.toNullablePositiveNumber(allocation.waterAmount),
      wastewaterAmount: this.toNullablePositiveNumber(
        allocation.wastewaterAmount,
      ),
    };
  }

  private toProjectCreate(
    project: Awaited<ReturnType<V2VesinvestService['normalizeProject']>>,
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

  private async buildForecastYearlyInvestments(plan: VesinvestPlanRecord) {
    const groupDefinitions = await this.getPersistedGroupDefinitionMap(plan.orgId);
    const rows = plan.projects.flatMap((project) => {
      const group = this.resolveGroupDefinitionFromMap(
        groupDefinitions,
        project.groupKey,
      );
      const depreciationClassKey =
        this.normalizeText(project.depreciationClassKey) ??
        group.defaultDepreciationClassKey;
      const forecastInvestmentType =
        project.investmentType === 'nyanlaggning'
          ? ('new' as const)
          : ('replacement' as const);
      return project.allocations.map((allocation) => ({
        rowId: allocation.id,
        year: allocation.year,
        amount: this.round2(this.toNumber(allocation.totalAmount)),
        target: project.projectName,
        category: group.label,
        depreciationClassKey,
        investmentType: forecastInvestmentType,
        confidence: depreciationClassKey ? ('high' as const) : ('medium' as const),
        waterAmount:
          this.toNumberNullable(allocation.waterAmount) > 0
            ? this.round2(this.toNumberNullable(allocation.waterAmount))
            : null,
        wastewaterAmount:
          this.toNumberNullable(allocation.wastewaterAmount) > 0
            ? this.round2(this.toNumberNullable(allocation.wastewaterAmount))
            : null,
        note: project.notes ?? null,
        vesinvestPlanId: plan.id,
        vesinvestProjectId: project.id,
        allocationId: allocation.id,
        projectCode: project.projectCode,
        groupKey: group.key,
        accountKey: project.accountKey ?? group.defaultAccountKey,
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

  private mapPlanSummary(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    const totalInvestmentAmount = this.round2(
      plan.projects.reduce(
        (sum, project) => sum + this.toNumber(project.totalAmount),
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
    );
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
      baselineChangedSinceAcceptedRevision,
      investmentPlanChangedSinceFeeRecommendation:
        plan.investmentPlanChangedSinceFeeRecommendation,
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint: plan.scenarioFingerprint,
      updatedAt: plan.updatedAt.toISOString(),
      createdAt: plan.createdAt.toISOString(),
    };
  }

  private async mapPlan(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    const groupDefinitions = await this.getPersistedGroupDefinitionMap(plan.orgId);
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
          acc.total += this.toNumberNullable(allocation?.totalAmount ?? null);
          acc.water += this.toNumberNullable(allocation?.waterAmount ?? null);
          acc.wastewater += this.toNumberNullable(
            allocation?.wastewaterAmount ?? null,
          );
          return acc;
        },
        { total: 0, water: 0, wastewater: 0 },
      );
      return {
        year,
        totalAmount: this.round2(totals.total),
        waterAmount: this.round2(totals.water),
        wastewaterAmount: this.round2(totals.wastewater),
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
        totalAmount: this.round2(
          slice.reduce((sum, item) => sum + item.totalAmount, 0),
        ),
      });
    }

    return {
      ...this.mapPlanSummary(plan, currentBaseline),
      feeRecommendationStatus: this.resolvePricingStatus(
        plan,
        currentBaseline,
        this.hasBaselineRevisionDrift(plan, currentBaseline),
      ),
      feeRecommendation: plan.feeRecommendation ?? null,
      baselineSourceState: plan.baselineSourceState ?? null,
      baselineFingerprint: plan.baselineFingerprint,
      scenarioFingerprint: plan.scenarioFingerprint,
      horizonYearsRange: horizonYears,
      yearlyTotals,
      fiveYearBands,
      projects: plan.projects.map((project) => {
        const group = this.resolveGroupDefinitionFromMap(
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
            project.depreciationClassKey ?? group.defaultDepreciationClassKey,
          defaultAccountKey: project.accountKey ?? group.defaultAccountKey,
          reportGroupKey: project.reportGroupKey ?? group.reportGroupKey,
          subtype: project.subtype,
          notes: project.notes,
          waterAmount: this.toNumberNullable(project.waterAmount),
          wastewaterAmount: this.toNumberNullable(project.wastewaterAmount),
          totalAmount: this.toNumber(project.totalAmount),
          allocations: project.allocations.map((allocation) => ({
            id: allocation.id,
            year: allocation.year,
            totalAmount: this.toNumber(allocation.totalAmount),
            waterAmount: this.toNumberNullable(allocation.waterAmount),
            wastewaterAmount: this.toNumberNullable(
              allocation.wastewaterAmount,
            ),
          })),
        };
      }),
    };
  }

  private resolveBaselineStatus(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
    baselineChangedSinceAcceptedRevision: boolean,
  ) {
    if (this.hasUtilityIdentityDrift(plan, currentBaseline)) {
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

  private resolvePricingStatus(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
    baselineChangedSinceAcceptedRevision: boolean,
  ) {
    if (this.hasUtilityIdentityDrift(plan, currentBaseline)) {
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
      this.normalizeDateIso(plan.selectedScenario?.updatedAt ?? null) != null &&
      this.normalizeDateIso(plan.selectedScenario?.computedFromUpdatedAt ?? null) ===
        this.normalizeDateIso(plan.selectedScenario?.updatedAt ?? null);
    if (
      scenarioStillCurrent &&
      plan.feeRecommendationStatus === 'verified' &&
      !plan.investmentPlanChangedSinceFeeRecommendation
    ) {
      return 'verified' as const;
    }
    return 'provisional' as const;
  }

  private hasBaselineRevisionDrift(
    plan: VesinvestPlanRecord,
    currentBaseline: CurrentBaselineSnapshot,
  ) {
    if (this.hasUtilityIdentityDrift(plan, currentBaseline)) {
      return true;
    }
    if (plan.baselineFingerprint) {
      return plan.baselineFingerprint !== currentBaseline.fingerprint;
    }
    const saved = this.readBaselineSourceState(plan.baselineSourceState);
    if (
      saved.acceptedYears.length === 0 &&
      (saved.latestAcceptedBudgetId?.length ?? 0) === 0
    ) {
      return false;
    }
    if (saved.latestAcceptedBudgetId !== currentBaseline.latestAcceptedBudgetId) {
      return true;
    }
    return (
      JSON.stringify(saved.acceptedYears) !==
      JSON.stringify(currentBaseline.acceptedYears)
    );
  }

  private readBaselineSourceState(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        acceptedYears: [] as number[],
        latestAcceptedBudgetId: null as string | null,
        veetiId: null as number | null,
        utilityName: null as string | null,
        businessId: null as string | null,
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
    };
  }

  private buildMergedBaselineSourceState(
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

  private async getOptionalBoundUtilityIdentity(
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

  private async getRequiredBoundUtilityIdentity(
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

  private hasUtilityIdentityDrift(
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

  private assertIdentityMutationNotRequested(
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

  private async resolveGroupDefinition(orgId: string, groupKey: string) {
    return this.resolveGroupDefinitionFromMap(
      await this.getPersistedGroupDefinitionMap(orgId),
      groupKey,
    );
  }

  private resolveGroupDefinitionFromMap(
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

  private async listPersistedGroupDefinitions(orgId?: string) {
    const rows = await this.prisma.vesinvestGroupDefinition.findMany({
      orderBy: [{ key: 'asc' }],
    });
    const source =
      rows.length > 0
        ? rows.map((row) => ({
            key: row.key,
            label: row.label,
            defaultAccountKey: row.defaultAccountKey,
            defaultDepreciationClassKey: row.defaultDepreciationClassKey,
            reportGroupKey: row.reportGroupKey,
            serviceSplit: row.serviceSplit,
          }))
        : DEFAULT_VESINVEST_GROUP_DEFINITIONS;
    const base = source.map((item) => ({ ...item }));
    if (!orgId) {
      return base;
    }
    const overrides = await this.prisma.vesinvestGroupOverride.findMany({
      where: { orgId },
      orderBy: [{ key: 'asc' }],
    });
    if (overrides.length === 0) {
      return base;
    }
    const overrideMap = new Map<string, VesinvestGroupDefinitionRecord>(
      overrides.map((row) => [
        row.key,
        {
          key: row.key,
          label: row.label,
          defaultAccountKey: row.defaultAccountKey,
          defaultDepreciationClassKey: row.defaultDepreciationClassKey,
          reportGroupKey: row.reportGroupKey,
          serviceSplit: row.serviceSplit,
        },
      ]),
    );
    const merged = base.map((item) => overrideMap.get(item.key) ?? item);
    const extras = overrides
      .filter((row) => !base.some((item) => item.key === row.key))
      .map((row) => ({
        key: row.key,
        label: row.label,
        defaultAccountKey: row.defaultAccountKey,
        defaultDepreciationClassKey: row.defaultDepreciationClassKey,
        reportGroupKey: row.reportGroupKey,
        serviceSplit: row.serviceSplit,
      }));
    return [...merged, ...extras];
  }

  private async getPersistedGroupDefinitionMap(orgId?: string) {
    return new Map<string, VesinvestGroupDefinitionRecord>(
      (await this.listPersistedGroupDefinitions(orgId)).map((item) => [
        item.key,
        item,
      ] as const),
    );
  }

  private isAdminRole(roles: string[]) {
    return roles.some((role) => role.toUpperCase() === 'ADMIN');
  }

  private normalizeServiceSplit(
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

  private normalizeReportGroupKey(value: string | null | undefined) {
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

  private normalizeIdentitySource(
    value: CreatePlanBody['identitySource'],
  ): 'manual' | 'veeti' | 'mixed' {
    return value === 'veeti' || value === 'mixed' ? value : 'manual';
  }

  private normalizeInvestmentType(
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

  private normalizeText(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : null;
  }

  private normalizeJsonObject(
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

  private normalizeYearList(value: unknown): number[] {
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

  private toNumber(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? this.round2(parsed) : 0;
  }

  private toNumberNullable(value: unknown) {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? this.round2(parsed) : 0;
  }

  private toNullablePositiveNumber(value: unknown) {
    if (value == null || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException('Amount must be zero or greater.');
    }
    return this.round2(parsed);
  }

  private normalizeDate(value: string | null) {
    if (value == null || value.trim().length === 0) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Date value is invalid.');
    }
    return parsed;
  }

  private normalizeDateIso(value: Date | string | null | undefined) {
    if (value == null) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  }

  private addYears(date: Date, years: number) {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  }

  private round2(value: number) {
    return Math.round(value * 100) / 100;
  }

  private findDuplicateValues(values: string[]) {
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

  private resolveActivePlanRecord(plans: VesinvestPlanRecord[]) {
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

  private resolveSelectedPlanRecord(
    plans: VesinvestPlanRecord[],
    activePlan: VesinvestPlanRecord | null,
  ) {
    return plans[0] ?? activePlan ?? null;
  }

  private buildFeeRecommendationSnapshot(
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
        (sum, item) => sum + this.toNumber(item.amount),
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

  private async resolveNextRevisionVersion(orgId: string, seriesId: string) {
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
