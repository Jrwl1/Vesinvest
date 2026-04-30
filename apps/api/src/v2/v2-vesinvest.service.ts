import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { V2VesinvestFoundationSupport } from './v2-vesinvest-foundation-support';
import { V2VesinvestPlanSupport } from './v2-vesinvest-plan-support';
import type {
  CreatePlanBody,
  SyncPlanBody,
  UpdateGroupDefinitionBody,
  UpdatePlanBody,
} from './v2-vesinvest.types';
import {
  computeVesinvestScenarioFingerprint,
  normalizeVesinvestDepreciationClassKey,
} from './vesinvest-contract';

@Injectable()
export class V2VesinvestService {
  private planningWorkspaceSupport: V2PlanningWorkspaceSupport;
  private readonly foundationSupport: V2VesinvestFoundationSupport;
  private readonly planSupport: V2VesinvestPlanSupport;

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastService: V2ForecastService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    this.foundationSupport = new V2VesinvestFoundationSupport(prisma);
    this.planSupport = new V2VesinvestPlanSupport(
      prisma,
      this.planningWorkspaceSupport,
      importOverviewService,
      this.foundationSupport,
    );
  }

  private currentPlanSupport() {
    this.planSupport.setPlanningWorkspaceSupport(this.planningWorkspaceSupport);
    return this.planSupport;
  }

  async getPlanningContextSummary(orgId: string) {
    const [plans, currentBaseline, groupDefinitions] = await Promise.all([
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
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.currentPlanSupport().getCurrentBaselineSnapshot(orgId),
      this.foundationSupport.getPersistedGroupDefinitionMap(orgId),
    ]);

    const activePlanRecord =
      this.foundationSupport.resolveActivePlanRecord(plans);
    const selectedPlanRecord = this.foundationSupport.resolveSelectedPlanRecord(
      plans,
      activePlanRecord,
    );

    return {
      vesinvest: {
        hasPlan: plans.length > 0,
        planCount: plans.length,
        activePlan: activePlanRecord
          ? this.currentPlanSupport().mapPlanSummary(
              activePlanRecord,
              currentBaseline,
              groupDefinitions,
            )
          : null,
        selectedPlan: selectedPlanRecord
          ? this.currentPlanSupport().mapPlanSummary(
              selectedPlanRecord,
              currentBaseline,
              groupDefinitions,
            )
          : null,
      },
    };
  }

  async getInvestmentGroupDefinitions(orgId: string) {
    return this.foundationSupport.listPersistedGroupDefinitions(orgId);
  }

  async updateInvestmentGroupDefinition(
    orgId: string,
    groupKey: string,
    body: UpdateGroupDefinitionBody,
    roles: string[],
  ) {
    if (!this.foundationSupport.isAdminRole(roles)) {
      throw new ForbiddenException(
        'Only admins can update Vesinvest group definitions.',
      );
    }
    const current = await this.foundationSupport.resolveGroupDefinition(
      orgId,
      groupKey,
    );
    const label =
      this.foundationSupport.normalizeText(body.label) ?? current.label;
    const defaultAccountKey =
      this.foundationSupport.normalizeText(body.defaultAccountKey) ??
      current.defaultAccountKey;
    const defaultDepreciationClassKey = current.key;
    const reportGroupKey =
      this.foundationSupport.normalizeReportGroupKey(body.reportGroupKey) ??
      current.reportGroupKey;
    const serviceSplit =
      this.foundationSupport.normalizeServiceSplit(body.serviceSplit) ??
      current.serviceSplit;

    if (!label || !defaultAccountKey) {
      throw new BadRequestException(
        'Group label and account key are required.',
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
      defaultDepreciationClassKey: updated.key,
      reportGroupKey: updated.reportGroupKey,
      serviceSplit: updated.serviceSplit,
    };
  }

  async listPlans(orgId: string) {
    const [plans, currentBaseline, groupDefinitions] = await Promise.all([
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
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.currentPlanSupport().getCurrentBaselineSnapshot(orgId),
      this.foundationSupport.getPersistedGroupDefinitionMap(orgId),
    ]);
    return plans.map((plan) =>
      this.currentPlanSupport().mapPlanSummary(
        plan,
        currentBaseline,
        groupDefinitions,
      ),
    );
  }

  async getPlan(orgId: string, planId: string) {
    const [plan, currentBaseline] = await Promise.all([
      this.currentPlanSupport().findPlanOrThrow(orgId, planId),
      this.currentPlanSupport().getCurrentBaselineSnapshot(orgId),
    ]);
    return this.currentPlanSupport().mapPlan(plan, currentBaseline);
  }

  async createPlan(orgId: string, body: CreatePlanBody) {
    const utilityIdentity =
      await this.currentPlanSupport().getRequiredBoundUtilityIdentity(orgId);
    const payload = await this.currentPlanSupport().normalizePlanPayload(
      orgId,
      {
        ...body,
        utilityName: utilityIdentity.utilityName,
        businessId: utilityIdentity.businessId,
        veetiId: utilityIdentity.veetiId,
        identitySource: utilityIdentity.identitySource,
      },
    );
    const reviewDueAt = this.foundationSupport.addYears(new Date(), 3);
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
        assetEvidenceState:
          payload.assetEvidenceState == null
            ? undefined
            : payload.assetEvidenceState,
        municipalPlanContext:
          payload.municipalPlanContext == null
            ? undefined
            : payload.municipalPlanContext,
        maintenanceEvidenceState:
          payload.maintenanceEvidenceState == null
            ? undefined
            : payload.maintenanceEvidenceState,
        conditionStudyState:
          payload.conditionStudyState == null
            ? undefined
            : payload.conditionStudyState,
        financialRiskState:
          payload.financialRiskState == null
            ? undefined
            : payload.financialRiskState,
        publicationState:
          payload.publicationState == null
            ? undefined
            : payload.publicationState,
        communicationState:
          payload.communicationState == null
            ? undefined
            : payload.communicationState,
        reviewDueAt,
        projects: {
          create: payload.projects.map((project) =>
            this.currentPlanSupport().toProjectCreate(project),
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
    const currentBaseline =
      await this.currentPlanSupport().getCurrentBaselineSnapshot(orgId);
    return this.currentPlanSupport().mapPlan(plan, currentBaseline);
  }

  async updatePlan(orgId: string, planId: string, body: UpdatePlanBody) {
    const current = await this.currentPlanSupport().findPlanOrThrow(
      orgId,
      planId,
    );
    this.assertFreshUpdateToken(
      current.updatedAt,
      body.expectedUpdatedAt,
      'VESINVEST_PLAN_STALE_EDIT',
      'This Vesinvest plan has changed in another session. Refresh it before saving.',
    );
    this.foundationSupport.assertIdentityMutationNotRequested(body, current);
    const payload = await this.currentPlanSupport().normalizePlanPayload(
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
                waterAmount: this.foundationSupport.toNumber(
                  project.waterAmount,
                ),
                wastewaterAmount: this.foundationSupport.toNumber(
                  project.wastewaterAmount,
                ),
                allocations: project.allocations.map((allocation) => ({
                  year: allocation.year,
                  totalAmount: this.foundationSupport.toNumber(
                    allocation.totalAmount,
                  ),
                  waterAmount: this.foundationSupport.toNumberNullable(
                    allocation.waterAmount,
                  ),
                  wastewaterAmount: this.foundationSupport.toNumberNullable(
                    allocation.wastewaterAmount,
                  ),
                })),
              })),
        baselineSourceState: body.baselineSourceState,
        assetEvidenceState: body.assetEvidenceState,
        municipalPlanContext: body.municipalPlanContext,
        maintenanceEvidenceState: body.maintenanceEvidenceState,
        conditionStudyState: body.conditionStudyState,
        financialRiskState: body.financialRiskState,
        publicationState: body.publicationState,
        communicationState: body.communicationState,
      },
      true,
    );
    const currentBaseline =
      await this.currentPlanSupport().getCurrentBaselineSnapshot(orgId);
    const nextStatus = body.status ?? current.status;
    if (current.status !== 'active' && nextStatus === 'active') {
      this.foundationSupport.assertPlanCanBecomeActive(
        current,
        currentBaseline,
      );
    }

    const investmentPlanChanged =
      body.projects !== undefined ||
      payload.horizonYears !== current.horizonYears;

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
          status: nextStatus,
          baselineStatus: nextBaselineStatus,
          feeRecommendationStatus: nextFeeRecommendationStatus,
          selectedScenarioId: current.selectedScenarioId,
          feeRecommendation: investmentPlanChanged ? Prisma.DbNull : undefined,
          baselineFingerprint: current.baselineFingerprint,
          scenarioFingerprint: investmentPlanChanged
            ? null
            : current.scenarioFingerprint,
          baselineSourceState:
            body.baselineSourceState !== undefined
              ? payload.baselineSourceState == null
                ? Prisma.DbNull
                : payload.baselineSourceState
              : undefined,
          assetEvidenceState:
            body.assetEvidenceState !== undefined
              ? payload.assetEvidenceState == null
                ? Prisma.DbNull
                : payload.assetEvidenceState
              : undefined,
          municipalPlanContext:
            body.municipalPlanContext !== undefined
              ? payload.municipalPlanContext == null
                ? Prisma.DbNull
                : payload.municipalPlanContext
              : undefined,
          maintenanceEvidenceState:
            body.maintenanceEvidenceState !== undefined
              ? payload.maintenanceEvidenceState == null
                ? Prisma.DbNull
                : payload.maintenanceEvidenceState
              : undefined,
          conditionStudyState:
            body.conditionStudyState !== undefined
              ? payload.conditionStudyState == null
                ? Prisma.DbNull
                : payload.conditionStudyState
              : undefined,
          financialRiskState:
            body.financialRiskState !== undefined
              ? payload.financialRiskState == null
                ? Prisma.DbNull
                : payload.financialRiskState
              : undefined,
          publicationState:
            body.publicationState !== undefined
              ? payload.publicationState == null
                ? Prisma.DbNull
                : payload.publicationState
              : undefined,
          communicationState:
            body.communicationState !== undefined
              ? payload.communicationState == null
                ? Prisma.DbNull
                : payload.communicationState
              : undefined,
          lastReviewedAt:
            body.lastReviewedAt !== undefined
              ? this.foundationSupport.normalizeDate(body.lastReviewedAt)
              : current.lastReviewedAt,
          reviewDueAt:
            body.reviewDueAt !== undefined
              ? this.foundationSupport.normalizeDate(body.reviewDueAt)
              : current.reviewDueAt,
          investmentPlanChangedSinceFeeRecommendation: investmentPlanChanged
            ? true
            : current.investmentPlanChangedSinceFeeRecommendation,
          baselineChangedSinceAcceptedRevision: investmentPlanChanged
            ? true
            : current.baselineChangedSinceAcceptedRevision,
          projects:
            body.projects !== undefined
              ? {
                  create: payload.projects.map((project) =>
                    this.currentPlanSupport().toProjectCreate(project),
                  ),
                }
              : undefined,
        },
      });
      if (nextStatus === 'active') {
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

  private assertFreshUpdateToken(
    currentUpdatedAt: Date | string,
    expectedUpdatedAt: string | null | undefined,
    conflictCode: string,
    conflictMessage: string,
  ) {
    const expected = expectedUpdatedAt?.trim();
    if (!expected) {
      throw new BadRequestException({
        code: `${conflictCode}_TOKEN_REQUIRED`,
        message: 'Refresh this workspace before saving.',
      });
    }
    const expectedTime = new Date(expected).getTime();
    const currentTime = new Date(currentUpdatedAt).getTime();
    if (!Number.isFinite(expectedTime)) {
      throw new BadRequestException({
        code: `${conflictCode}_TOKEN_INVALID`,
        message: 'Refresh this workspace before saving.',
      });
    }
    if (expectedTime !== currentTime) {
      throw new ConflictException({
        code: conflictCode,
        message: conflictMessage,
      });
    }
  }

  async clonePlan(orgId: string, sourcePlanId: string) {
    const source = await this.currentPlanSupport().findPlanOrThrow(
      orgId,
      sourcePlanId,
    );
    const boundUtilityIdentity =
      await this.currentPlanSupport().getOptionalBoundUtilityIdentity(orgId);
    const nextVersionNumber =
      await this.foundationSupport.resolveNextRevisionVersion(
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
        reviewDueAt: this.foundationSupport.addYears(new Date(), 3),
        lastReviewedAt: null,
        investmentPlanChangedSinceFeeRecommendation: true,
        baselineChangedSinceAcceptedRevision: true,
        baselineFingerprint: null,
        scenarioFingerprint: null,
        baselineSourceState: source.baselineSourceState ?? undefined,
        assetEvidenceState: source.assetEvidenceState ?? undefined,
        municipalPlanContext: source.municipalPlanContext ?? undefined,
        maintenanceEvidenceState: source.maintenanceEvidenceState ?? undefined,
        conditionStudyState: source.conditionStudyState ?? undefined,
        financialRiskState: source.financialRiskState ?? undefined,
        publicationState: source.publicationState ?? undefined,
        communicationState: source.communicationState ?? undefined,
        projects: {
          create: await Promise.all(
            source.projects.map(async (project) => {
              const group = await this.foundationSupport.resolveGroupDefinition(
                orgId,
                project.groupKey,
              );
              return this.currentPlanSupport().toProjectCreate({
                code: project.projectCode,
                name: project.projectName,
                investmentType: project.investmentType,
                groupKey: project.groupKey,
                depreciationClassKey:
                  normalizeVesinvestDepreciationClassKey(
                    group.key,
                    project.depreciationClassKey,
                  ) ?? group.key,
                accountKey: project.accountKey ?? group.defaultAccountKey,
                reportGroupKey: project.reportGroupKey ?? group.reportGroupKey,
                subtype: project.subtype,
                notes: project.notes,
                waterAmount: this.foundationSupport.toNumberNullable(
                  project.waterAmount,
                ),
                wastewaterAmount: this.foundationSupport.toNumberNullable(
                  project.wastewaterAmount,
                ),
                totalAmount: project.allocations.reduce(
                  (sum, allocation) =>
                    sum +
                    this.foundationSupport.toNumber(allocation.totalAmount),
                  0,
                ),
                allocations: project.allocations.map((allocation) => ({
                  year: allocation.year,
                  totalAmount: this.foundationSupport.toNumber(
                    allocation.totalAmount,
                  ),
                  waterAmount: this.foundationSupport.toNumberNullable(
                    allocation.waterAmount,
                  ),
                  wastewaterAmount: this.foundationSupport.toNumberNullable(
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
    const currentBaseline =
      await this.currentPlanSupport().getCurrentBaselineSnapshot(orgId);
    return this.currentPlanSupport().mapPlan(clone, currentBaseline);
  }

  async syncPlanToForecast(orgId: string, planId: string, body?: SyncPlanBody) {
    const plan = await this.currentPlanSupport().findPlanOrThrow(orgId, planId);
    if (!plan.projects.length) {
      throw new BadRequestException({
        code: 'VESINVEST_PROJECT_REQUIRED',
        message:
          'Create at least one investment project before opening pricing.',
      });
    }
    const currentBaseline =
      await this.currentPlanSupport().getCurrentBaselineSnapshot(orgId);
    if (this.foundationSupport.hasUtilityIdentityDrift(plan, currentBaseline)) {
      throw new BadRequestException({
        code: 'VESINVEST_UTILITY_MISMATCH',
        message:
          'Utility binding does not match this Vesinvest revision. Bind the org to the correct utility before opening pricing.',
      });
    }
    if (!currentBaseline.hasTrustedBaseline) {
      throw new BadRequestException({
        code: 'VESINVEST_BASELINE_UNVERIFIED',
        message:
          'Baseline not verified. Complete baseline evidence before opening pricing.',
      });
    }
    const groupDefinitions =
      await this.foundationSupport.getPersistedGroupDefinitionMap(orgId);
    if (
      this.foundationSupport.isClassificationReviewRequired(
        plan,
        groupDefinitions,
      )
    ) {
      throw new BadRequestException({
        code: 'VESINVEST_CLASSIFICATION_REVIEW_REQUIRED',
        message:
          'Legacy class overrides require review in this Vesinvest revision. Review and save the class-owned account and depreciation setup before opening pricing.',
      });
    }

    const yearlyInvestments =
      await this.currentPlanSupport().buildForecastYearlyInvestments(
        plan,
        groupDefinitions,
      );
    if (!yearlyInvestments.some((item) => item.amount > 0)) {
      throw new BadRequestException({
        code: 'VESINVEST_ALLOCATION_REQUIRED',
        message:
          'Add at least one investment allocation before opening pricing.',
      });
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
    const linkedScenarioId = scenarioId;
    if (!linkedScenarioId) {
      throw new BadRequestException({
        code: 'VESINVEST_SCENARIO_LINK_REQUIRED',
        message: 'Linked scenario could not be resolved.',
      });
    }

    await this.forecastService.updateForecastScenario(orgId, linkedScenarioId, {
      name: `${plan.name} v${plan.versionNumber}`,
      horizonYears: plan.horizonYears,
      yearlyInvestments,
      allowVesinvestLinkedInvestmentUpdate: true,
    });

    const scenario = compute
      ? await this.forecastService.computeForecastScenario(
          orgId,
          linkedScenarioId,
        )
      : await this.forecastService.getForecastScenario(orgId, linkedScenarioId);
    const scenarioFingerprint = computeVesinvestScenarioFingerprint({
      scenarioId: scenario.id,
      updatedAt: scenario.updatedAt,
      computedFromUpdatedAt: scenario.computedFromUpdatedAt,
      yearlyInvestments: scenario.yearlyInvestments,
      years: scenario.years,
    });

    const mergedBaselineSourceState =
      this.currentPlanSupport().buildMergedBaselineSourceState(
        plan.baselineSourceState,
        body?.baselineSourceState,
        currentBaseline,
      );
    const tariffPlanFingerprintChanged =
      plan.baselineFingerprint !== currentBaseline.fingerprint ||
      plan.scenarioFingerprint !== scenarioFingerprint;

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
          feeRecommendation:
            this.foundationSupport.buildFeeRecommendationSnapshot(
              plan,
              scenario,
              currentBaseline,
              scenarioFingerprint,
            ),
          baselineSourceState: mergedBaselineSourceState,
          baselineFingerprint: currentBaseline.fingerprint,
          scenarioFingerprint,
          lastReviewedAt: new Date(),
          reviewDueAt: this.foundationSupport.addYears(new Date(), 3),
          baselineChangedSinceAcceptedRevision: false,
          investmentPlanChangedSinceFeeRecommendation: false,
        },
      });
      if (tariffPlanFingerprintChanged) {
        await tx.vesinvestTariffPlan.updateMany({
          where: {
            orgId,
            vesinvestPlanId: planId,
            status: 'accepted',
          },
          data: { status: 'stale' },
        });
      }
    });

    return {
      plan: await this.getPlan(orgId, planId),
      scenarioId: scenario.id,
    };
  }
}
