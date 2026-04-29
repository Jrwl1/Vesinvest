import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { buildV2ReportPdf } from './v2-report-pdf';
import {
  computeVesinvestScenarioFingerprint,
  isVesinvestClassificationReviewRequired,
} from './vesinvest-contract';
import { V2ReportBaselineSupport } from './v2-report-baseline-support';
import { V2ReportCreationSupport } from './v2-report-creation-support';
import type {
  BaselineSourceSummary,
  ReportLocale,
  ReportSections,
  ReportVariant,
  SnapshotPayload,
} from './v2-report.types';

@Injectable()
export class V2ReportService {
  private readonly baselineSupport: V2ReportBaselineSupport;
  private readonly creationSupport: V2ReportCreationSupport;

  constructor(
    private readonly prisma: PrismaService,
    _projectionsService: ProjectionsService,
    _veetiService: VeetiService,
    _veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    _veetiBudgetGenerator: VeetiBudgetGenerator,
    _veetiBenchmarkService: VeetiBenchmarkService,
    _veetiSanityService: VeetiSanityService,
    private readonly forecastService: V2ForecastService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    const planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    this.baselineSupport = new V2ReportBaselineSupport(
      prisma,
      planningWorkspaceSupport,
      importOverviewService,
      veetiEffectiveDataService,
    );
    this.creationSupport = new V2ReportCreationSupport(
      prisma,
      forecastService,
      this.baselineSupport,
    );
  }

  private getForecastScenario(
    ...args: Parameters<V2ForecastService['getForecastScenario']>
  ) {
    return this.forecastService.getForecastScenario(...args);
  }

  private getImportStatus(
    ...args: Parameters<V2ImportOverviewService['getImportStatus']>
  ) {
    return this.importOverviewService.getImportStatus(...args);
  }

  private getCurrentBaselineSnapshot(
    ...args: Parameters<V2ReportBaselineSupport['getCurrentBaselineSnapshot']>
  ) {
    return this.baselineSupport.getCurrentBaselineSnapshot(...args);
  }

  private getVesinvestGroupClassificationDefaults(
    ...args: Parameters<
      V2ReportBaselineSupport['getVesinvestGroupClassificationDefaults']
    >
  ) {
    return this.baselineSupport.getVesinvestGroupClassificationDefaults(...args);
  }

  private investmentSeriesMatchesYearlyInvestments(
    ...args: Parameters<
      V2ReportCreationSupport['investmentSeriesMatchesYearlyInvestments']
    >
  ) {
    return this.creationSupport.investmentSeriesMatchesYearlyInvestments(...args);
  }

  private hasLegacyBaselineSnapshotDrift(
    ...args: Parameters<V2ReportBaselineSupport['hasLegacyBaselineSnapshotDrift']>
  ) {
    return this.baselineSupport.hasLegacyBaselineSnapshotDrift(...args);
  }

  private readSavedBaselineSourceState(
    ...args: Parameters<V2ReportBaselineSupport['readSavedBaselineSourceState']>
  ) {
    return this.baselineSupport.readSavedBaselineSourceState(...args);
  }

  private buildBaselineSourceSummariesFromVesinvestSnapshot(
    ...args: Parameters<
      V2ReportBaselineSupport['buildBaselineSourceSummariesFromVesinvestSnapshot']
    >
  ) {
    return this.baselineSupport.buildBaselineSourceSummariesFromVesinvestSnapshot(
      ...args,
    );
  }

  private buildBaselineSourceSummariesFromCurrentBaseline(
    ...args: Parameters<
      V2ReportBaselineSupport['buildBaselineSourceSummariesFromCurrentBaseline']
    >
  ) {
    return this.baselineSupport.buildBaselineSourceSummariesFromCurrentBaseline(
      ...args,
    );
  }

  private selectPrimaryBaselineSourceSummary(
    ...args: Parameters<
      V2ReportBaselineSupport['selectPrimaryBaselineSourceSummary']
    >
  ) {
    return this.baselineSupport.selectPrimaryBaselineSourceSummary(...args);
  }

  private buildBaselineSourceSummary(
    ...args: Parameters<V2ReportBaselineSupport['buildBaselineSourceSummary']>
  ) {
    return this.baselineSupport.buildBaselineSourceSummary(...args);
  }

  private buildVesinvestAppendix(
    ...args: Parameters<V2ReportCreationSupport['buildVesinvestAppendix']>
  ) {
    return this.creationSupport.buildVesinvestAppendix(...args);
  }

  private readSnapshotBaselineSourceSummaries(
    ...args: Parameters<V2ReportBaselineSupport['readSnapshotBaselineSourceSummaries']>
  ) {
    return this.baselineSupport.readSnapshotBaselineSourceSummaries(...args);
  }

  private normalizeText(
    ...args: Parameters<V2ReportBaselineSupport['normalizeText']>
  ) {
    return this.baselineSupport.normalizeText(...args);
  }

  private toNumber(...args: Parameters<V2ReportBaselineSupport['toNumber']>) {
    return this.baselineSupport.toNumber(...args);
  }

  private toPdfText(...args: Parameters<V2ReportBaselineSupport['toPdfText']>) {
    return this.baselineSupport.toPdfText(...args);
  }

async listReports(orgId: string, ennusteId?: string) {
    const rows = await this.prisma.ennusteReport.findMany({
      where: {
        orgId,
        ...(ennusteId ? { ennusteId } : {}),
      },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(
      (
        row,
      ): {
        id: string;
        title: string;
        createdAt: Date;
        ennuste: { id: string; nimi: string | null };
        baselineYear: number;
        requiredPriceToday: number;
        requiredAnnualIncreasePct: number;
        totalInvestments: number;
        baselineSourceSummary: BaselineSourceSummary | null;
        variant: ReportVariant;
        pdfUrl: string;
      } => {
        const snapshot = (row.snapshotJson ?? {}) as Partial<SnapshotPayload>;
        const reportVariant = this.normalizeReportVariant(snapshot.reportVariant);
        const baselineSourceSummaries =
          this.readSnapshotBaselineSourceSummaries(snapshot);
        const baselineSourceSummary =
          snapshot.baselineSourceSummary ??
          this.selectPrimaryBaselineSourceSummary(
            baselineSourceSummaries,
            row.baselineYear,
          );
        return {
          id: row.id,
          title: this.normalizeText(row.title) ?? row.title,
          createdAt: row.createdAt,
          ennuste: row.ennuste,
          baselineYear: row.baselineYear,
          requiredPriceToday: this.toNumber(row.requiredPriceToday),
          requiredAnnualIncreasePct: this.toNumber(row.requiredAnnualIncreasePct),
          totalInvestments: this.toNumber(row.totalInvestments),
          baselineSourceSummary,
          variant: reportVariant,
          pdfUrl: `/v2/reports/${row.id}/pdf`,
        };
      },
    );
  }

  async createReport(
    orgId: string,
    userId: string,
    body: {
      ennusteId?: string;
      vesinvestPlanId: string;
      title?: string;
      variant?: ReportVariant;
      locale?: ReportLocale;
    },
  ) {
    if (!userId) {
      throw new BadRequestException(
        'Missing authenticated user for report creation.',
      );
    }
    if (!body?.vesinvestPlanId || !body.vesinvestPlanId.trim()) {
      throw new BadRequestException(
        'Invalid report request: vesinvestPlanId is required.',
      );
    }
    const vesinvestPlan = await this.prisma.vesinvestPlan.findFirst({
      where: {
        id: body.vesinvestPlanId,
        orgId,
      },
      select: {
        id: true,
        seriesId: true,
        name: true,
        utilityName: true,
        businessId: true,
        veetiId: true,
        identitySource: true,
        versionNumber: true,
        status: true,
        selectedScenarioId: true,
        baselineFingerprint: true,
        scenarioFingerprint: true,
        feeRecommendation: true,
        baselineSourceState: true,
        assetEvidenceState: true,
        municipalPlanContext: true,
        maintenanceEvidenceState: true,
        conditionStudyState: true,
        financialRiskState: true,
        publicationState: true,
        communicationState: true,
        projects: {
          select: {
            groupKey: true,
            accountKey: true,
            depreciationClassKey: true,
            reportGroupKey: true,
            projectCode: true,
            projectName: true,
            totalAmount: true,
            allocations: {
              select: {
                year: true,
                totalAmount: true,
                waterAmount: true,
                wastewaterAmount: true,
              },
            },
          },
        },
      },
    });
    if (!vesinvestPlan) {
      throw new NotFoundException('Vesinvest plan not found.');
    }
    if (vesinvestPlan.status !== 'active') {
      throw new ConflictException(
        'Only the active Vesinvest revision can create a report.',
      );
    }
    const groupClassificationDefaults =
      await this.getVesinvestGroupClassificationDefaults(orgId);
    if (
      isVesinvestClassificationReviewRequired(
        vesinvestPlan.projects.map((project) => ({
          groupKey: project.groupKey,
          accountKey: project.accountKey,
          depreciationClassKey: project.depreciationClassKey,
        })),
        groupClassificationDefaults,
      )
    ) {
      throw new ConflictException({
        code: 'VESINVEST_CLASSIFICATION_REVIEW_REQUIRED',
        message:
          'Legacy Vesinvest class overrides require review in this revision. Review and save the class-owned depreciation setup before creating a report.',
      });
    }
    const scenarioId =
      this.normalizeText(body.ennusteId?.trim()) ?? vesinvestPlan.selectedScenarioId;
    if (!scenarioId) {
      throw new ConflictException(
        'Selected Vesinvest plan is not linked to a forecast scenario.',
      );
    }
    if (
      vesinvestPlan.selectedScenarioId &&
      vesinvestPlan.selectedScenarioId !== scenarioId
    ) {
      throw new ConflictException(
        'Selected Vesinvest plan is linked to a different forecast scenario.',
      );
    }

    const currentBaseline = await this.getCurrentBaselineSnapshot(orgId);
    const currentUtility = currentBaseline.utilityIdentity;
    if (
      !currentUtility ||
      (vesinvestPlan.veetiId ?? null) !== currentUtility.veetiId ||
      vesinvestPlan.utilityName !== currentUtility.utilityName ||
      (vesinvestPlan.businessId ?? null) !== (currentUtility.businessId ?? null) ||
      vesinvestPlan.identitySource !== currentUtility.identitySource
    ) {
      throw new ConflictException({
        code: 'VESINVEST_UTILITY_MISMATCH',
        message:
          'The current org utility binding does not match this Vesinvest revision. Create a fresh revision after binding the correct utility.',
      });
    }

    const scenario = await this.getForecastScenario(orgId, scenarioId);
    const scenarioUpdatedAtIso = new Date(scenario.updatedAt).toISOString();
    const computedFromUpdatedAtIso = scenario.computedFromUpdatedAt
      ? new Date(scenario.computedFromUpdatedAt).toISOString()
      : null;
    if (!computedFromUpdatedAtIso || computedFromUpdatedAtIso !== scenarioUpdatedAtIso) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message:
          'Scenario changed after last compute. Recompute scenario before creating report.',
      });
    }

    if (scenario.years.length === 0) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message:
          'Scenario has no computed years. Compute scenario before creating report.',
      });
    }

    if (!this.investmentSeriesMatchesYearlyInvestments(scenario)) {
      throw new ConflictException({
        code: 'FORECAST_RECOMPUTE_REQUIRED',
        message:
          'Scenario investment inputs changed after last compute. Recompute scenario before creating report.',
      });
    }
    const liveScenarioFingerprint = computeVesinvestScenarioFingerprint({
      scenarioId: scenario.id,
      updatedAt: scenario.updatedAt,
      computedFromUpdatedAt: scenario.computedFromUpdatedAt,
      yearlyInvestments: scenario.yearlyInvestments,
      years: scenario.years,
    });
    if (vesinvestPlan.baselineFingerprint) {
      if (vesinvestPlan.baselineFingerprint !== currentBaseline.fingerprint) {
        throw new ConflictException({
          code: 'VESINVEST_BASELINE_STALE',
          message:
            'Accepted baseline changed after this Vesinvest revision was verified. Re-verify baseline before creating report.',
        });
      }
    } else if (
      this.hasLegacyBaselineSnapshotDrift(
        vesinvestPlan.baselineSourceState ?? null,
        currentBaseline,
      )
    ) {
      throw new ConflictException({
        code: 'VESINVEST_BASELINE_STALE',
        message:
        'Legacy Vesinvest baseline snapshot does not match the current utility binding and accepted baseline. Re-verify baseline before creating report.',
      });
    }
    this.assertAssetEvidenceReady(vesinvestPlan);

    const latestTariffPlan = await this.prisma.vesinvestTariffPlan.findFirst({
      where: {
        orgId,
        vesinvestPlanId: vesinvestPlan.id,
        scenarioId,
      },
      orderBy: [
        { updatedAt: 'desc' },
        { acceptedAt: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
    if (!latestTariffPlan) {
      throw new ConflictException({
        code: 'TARIFF_PLAN_REQUIRED',
        message:
          'Accept the tariff plan before creating a report snapshot.',
      });
    }
    if (latestTariffPlan.status !== 'accepted') {
      throw new ConflictException({
        code: 'TARIFF_PLAN_STALE',
        message:
          'The latest tariff plan has not been accepted. Accept the current tariff package before creating a report snapshot.',
      });
    }
    const acceptedTariffPlan = latestTariffPlan;
    this.assertTariffEvidenceReady(acceptedTariffPlan);
    this.assertAcceptedTariffPlanCurrent(
      acceptedTariffPlan.recommendation,
      currentBaseline.fingerprint,
      liveScenarioFingerprint,
    );

    const savedBaselineSourceState = this.readSavedBaselineSourceState(
      vesinvestPlan.baselineSourceState,
    );
    const acceptedBaselineYears =
      currentBaseline.acceptedYears.length > 0
        ? [...currentBaseline.acceptedYears]
        : savedBaselineSourceState.acceptedYears;
    let baselineSourceSummaries =
      this.buildBaselineSourceSummariesFromVesinvestSnapshot(
        vesinvestPlan?.baselineSourceState ?? null,
        acceptedBaselineYears,
      );
    if (baselineSourceSummaries.length === 0) {
      baselineSourceSummaries =
        this.buildBaselineSourceSummariesFromCurrentBaseline(
          currentBaseline,
          acceptedBaselineYears,
        );
    }
    let baselineSourceSummary = this.selectPrimaryBaselineSourceSummary(
      baselineSourceSummaries,
      scenario.baselineYear,
    );
    if (!baselineSourceSummary && scenario.baselineYear != null) {
      try {
        const [importStatus, yearDataset] = await Promise.all([
          this.getImportStatus(orgId),
          this.veetiEffectiveDataService.getYearDataset(
            orgId,
            scenario.baselineYear,
          ),
        ]);
        baselineSourceSummary = this.buildBaselineSourceSummary(
          importStatus,
          scenario.baselineYear,
          yearDataset,
        );
        baselineSourceSummaries = baselineSourceSummary
          ? [baselineSourceSummary]
          : [];
      } catch {
        baselineSourceSummary = null;
        baselineSourceSummaries = [];
      }
    }

    const reportVariant = this.normalizeReportVariant(body.variant);
    const reportLocale = this.normalizeReportLocale(body.locale);
    const reportSections = this.buildReportSections(reportVariant);
    const includeInternalEvidence = reportVariant === 'internal_appendix';
    const vesinvestAppendix = await this.buildVesinvestAppendix(
      vesinvestPlan.projects,
      scenario.years.map((item) => item.year),
      orgId,
    );
    const snapshot: SnapshotPayload = {
      scenario,
      generatedAt: new Date().toISOString(),
      reportLocale,
      acceptedBaselineYears,
      baselineSourceSummaries,
      baselineSourceSummary,
      vesinvestPlan: {
        id: vesinvestPlan.id,
        seriesId: vesinvestPlan.seriesId,
        name: vesinvestPlan.name,
        utilityName: vesinvestPlan.utilityName,
        businessId: vesinvestPlan.businessId,
        veetiId: vesinvestPlan.veetiId,
        identitySource: vesinvestPlan.identitySource,
        versionNumber: vesinvestPlan.versionNumber,
        status: vesinvestPlan.status,
        baselineFingerprint: vesinvestPlan.baselineFingerprint,
        scenarioFingerprint: liveScenarioFingerprint,
        feeRecommendation:
          (vesinvestPlan.feeRecommendation as Record<string, unknown> | null) ?? null,
        ...(includeInternalEvidence
          ? {
              assetEvidenceState:
                vesinvestPlan.assetEvidenceState as Record<string, unknown> | null,
              municipalPlanContext:
                vesinvestPlan.municipalPlanContext as Record<string, unknown> | null,
              maintenanceEvidenceState:
                vesinvestPlan.maintenanceEvidenceState as Record<string, unknown> | null,
              conditionStudyState:
                vesinvestPlan.conditionStudyState as Record<string, unknown> | null,
              financialRiskState:
                vesinvestPlan.financialRiskState as Record<string, unknown> | null,
              publicationState:
                vesinvestPlan.publicationState as Record<string, unknown> | null,
              communicationState:
                vesinvestPlan.communicationState as Record<string, unknown> | null,
            }
          : {}),
      },
      vesinvestAppendix,
      tariffPlan: {
        id: acceptedTariffPlan.id,
        status: acceptedTariffPlan.status,
        acceptedAt: acceptedTariffPlan.acceptedAt?.toISOString() ?? null,
        baselineInput: acceptedTariffPlan.baselineInput as any,
        allocationPolicy: acceptedTariffPlan.allocationPolicy as any,
        recommendation: acceptedTariffPlan.recommendation as any,
        readinessChecklist: acceptedTariffPlan.readinessChecklist as any,
        ...(includeInternalEvidence
          ? {
              revenueEvidence:
                acceptedTariffPlan.revenueEvidence as Record<string, unknown> | null,
              costEvidence:
                acceptedTariffPlan.costEvidence as Record<string, unknown> | null,
              regionalDifferentiationState:
                acceptedTariffPlan.regionalDifferentiationState as Record<
                  string,
                  unknown
                > | null,
              stormwaterState:
                acceptedTariffPlan.stormwaterState as Record<string, unknown> | null,
              specialUseState:
                acceptedTariffPlan.specialUseState as Record<string, unknown> | null,
              connectionFeeLiabilityState:
                acceptedTariffPlan.connectionFeeLiabilityState as Record<
                  string,
                  unknown
                > | null,
              ownerDistributionState:
                acceptedTariffPlan.ownerDistributionState as Record<
                  string,
                  unknown
                > | null,
            }
          : {}),
      },
      reportVariant,
      reportSections,
    };

    const requiredPriceToday =
      scenario.requiredPriceTodayCombinedAnnualResult ??
      scenario.requiredPriceTodayCombined ??
      scenario.requiredPriceTodayCombinedCumulativeCash ??
      scenario.baselinePriceTodayCombined ??
      0;
    const requiredAnnualIncreasePct =
      scenario.requiredAnnualIncreasePctAnnualResult ??
      scenario.requiredAnnualIncreasePct ??
      scenario.requiredAnnualIncreasePctCumulativeCash ??
      0;
    const totalInvestments = snapshot.scenario.yearlyInvestments.reduce(
      (sum: number, item: { amount: number }) => sum + item.amount,
      0,
    );
    const baselineYear =
      scenario.baselineYear ??
      scenario.years[0]?.year ??
      new Date().getFullYear();

    const title =
      this.normalizeText(body.title?.trim()) ||
      this.buildDefaultPackageReportTitle(
        scenario.name,
        new Date(),
        reportVariant,
        reportLocale,
      );

    const created = await this.prisma.ennusteReport.create({
      data: {
        orgId,
        ennusteId: scenario.id,
        vesinvestPlanId: vesinvestPlan.id,
        title,
        createdByUserId: userId,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        snapshotVersion: 1,
        baselineYear,
        requiredPriceToday,
        requiredAnnualIncreasePct,
        totalInvestments,
      },
    });

    return {
      reportId: created.id,
      title: this.normalizeText(created.title) ?? created.title,
      createdAt: created.createdAt,
      baselineYear: created.baselineYear,
      requiredPriceToday: this.toNumber(created.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(
        created.requiredAnnualIncreasePct,
      ),
      totalInvestments: this.toNumber(created.totalInvestments),
      variant: reportVariant,
      pdfUrl: `/v2/reports/${created.id}/pdf`,
    };
  }


  async getReport(orgId: string, reportId: string) {
    const report = await this.prisma.ennusteReport.findFirst({
      where: { id: reportId, orgId },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const snapshot = (report.snapshotJson ?? {}) as Partial<SnapshotPayload>;
    const reportVariant = this.normalizeReportVariant(snapshot.reportVariant);
    const reportSections =
      snapshot.reportSections ?? this.buildReportSections(reportVariant);
    const baselineSourceSummaries =
      this.readSnapshotBaselineSourceSummaries(snapshot);
    const baselineSourceSummary =
      snapshot.baselineSourceSummary ??
      this.selectPrimaryBaselineSourceSummary(
        baselineSourceSummaries,
        report.baselineYear,
      );

    return {
      id: report.id,
      title: this.normalizeText(report.title) ?? report.title,
      createdAt: report.createdAt,
      baselineYear: report.baselineYear,
      requiredPriceToday: this.toNumber(report.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(
        report.requiredAnnualIncreasePct,
      ),
      totalInvestments: this.toNumber(report.totalInvestments),
      ennuste: report.ennuste,
      snapshot: {
        ...snapshot,
        acceptedBaselineYears: snapshot.acceptedBaselineYears ?? [],
        baselineSourceSummaries,
        baselineSourceSummary,
        vesinvestAppendix: snapshot.vesinvestAppendix ?? null,
        generatedAt: snapshot.generatedAt ?? report.createdAt.toISOString(),
        reportVariant,
        reportSections,
      },
      variant: reportVariant,
      pdfUrl: `/v2/reports/${report.id}/pdf`,
    };
  }

  private normalizeReportVariant(raw: unknown): ReportVariant {
    switch (raw) {
      case 'regulator_package':
      case 'board_package':
      case 'internal_appendix':
        return raw;
      case 'public_summary':
        return 'regulator_package';
      case 'confidential_appendix':
        return 'internal_appendix';
      default:
        return 'regulator_package';
    }
  }

  private normalizeReportLocale(raw: unknown): ReportLocale {
    return raw === 'fi' || raw === 'sv' || raw === 'en' ? raw : 'en';
  }

  private buildReportSections(variant: ReportVariant): ReportSections {
    if (variant === 'regulator_package') {
      return {
        baselineSources: true,
        investmentPlan: true,
        assumptions: false,
        yearlyInvestments: false,
        riskSummary: true,
      };
    }

    if (variant === 'board_package') {
      return {
        baselineSources: true,
        investmentPlan: true,
        assumptions: true,
        yearlyInvestments: false,
        riskSummary: true,
      };
    }

    return {
      baselineSources: true,
      investmentPlan: true,
      assumptions: true,
      yearlyInvestments: true,
      riskSummary: true,
    };
  }

  private getReportLocaleLabels(locale: ReportLocale): {
    defaultTitlePrefix: string;
    variants: Record<ReportVariant, string>;
  } {
    if (locale === 'sv') {
      return {
        defaultTitlePrefix: 'Prognosrapport',
        variants: {
          regulator_package: 'Myndighetspaket',
          board_package: 'Styrelsepaket',
          internal_appendix: 'Intern bilaga',
        },
      };
    }
    if (locale === 'fi') {
      return {
        defaultTitlePrefix: 'Ennusteraportti',
        variants: {
          regulator_package: 'Viranomaispaketti',
          board_package: 'Hallituksen paketti',
          internal_appendix: 'Sisäinen liite',
        },
      };
    }
    return {
      defaultTitlePrefix: 'Forecast report',
      variants: {
        regulator_package: 'Regulator package',
        board_package: 'Board package',
        internal_appendix: 'Internal appendix',
      },
    };
  }

  private getReportVariantTitleLabel(
    variant: ReportVariant,
    locale: ReportLocale,
  ): string {
    return this.getReportLocaleLabels(locale).variants[variant];
  }

  private formatIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private buildDefaultReportTitle(
    scenarioName: string | null | undefined,
    value: Date,
    locale: ReportLocale,
  ): string {
    const labels = this.getReportLocaleLabels(locale);
    const scenarioLabel =
      this.normalizeText(scenarioName)?.trim() ||
      (locale === 'fi' ? 'Skenaario' : locale === 'sv' ? 'Scenario' : 'Scenario');
    const reportDate = this.formatIsoDate(value);
    const baseTitle = `${labels.defaultTitlePrefix} ${scenarioLabel}`;
    return scenarioLabel.endsWith(` ${reportDate}`)
      ? baseTitle
      : `${baseTitle} ${reportDate}`;
  }

  private buildDefaultPackageReportTitle(
    scenarioName: string | null | undefined,
    value: Date,
    variant: ReportVariant,
    locale: ReportLocale,
  ): string {
    return `${this.buildDefaultReportTitle(
      scenarioName,
      value,
      locale,
    )} - ${this.getReportVariantTitleLabel(variant, locale)}`;
  }

  private assertAcceptedTariffPlanCurrent(
    recommendationRaw: unknown,
    currentBaselineFingerprint: string | null,
    liveScenarioFingerprint: string,
  ) {
    const recommendation = this.asRecord(recommendationRaw);
    const tariffBaselineFingerprint = this.normalizeTextValue(
      recommendation.baselineFingerprint,
    );
    const tariffScenarioFingerprint = this.normalizeTextValue(
      recommendation.scenarioFingerprint,
    );

    if (
      tariffBaselineFingerprint !== currentBaselineFingerprint ||
      tariffScenarioFingerprint !== liveScenarioFingerprint
    ) {
      throw new ConflictException({
        code: 'TARIFF_PLAN_STALE',
        message:
          'Accepted tariff plan is out of date. Re-open Tariff Plan and accept the current package before creating a report.',
      });
    }
  }

  private assertAssetEvidenceReady(plan: {
    assetEvidenceState?: unknown;
    municipalPlanContext?: unknown;
    maintenanceEvidenceState?: unknown;
    conditionStudyState?: unknown;
    financialRiskState?: unknown;
    publicationState?: unknown;
    communicationState?: unknown;
  }) {
    const fields = [
      plan.assetEvidenceState,
      plan.conditionStudyState,
      plan.maintenanceEvidenceState,
      plan.municipalPlanContext,
      plan.financialRiskState,
      plan.publicationState,
      plan.communicationState,
    ];
    if (fields.every((value) => this.hasEvidenceNotes(value))) {
      return;
    }
    throw new ConflictException({
      code: 'ASSET_EVIDENCE_REQUIRED',
      message:
        'Complete asset-management evidence before creating a report snapshot.',
    });
  }

  private assertTariffEvidenceReady(plan: {
    readinessChecklist?: unknown;
    revenueEvidence?: unknown;
    costEvidence?: unknown;
    connectionFeeLiabilityState?: unknown;
  }) {
    const readiness = this.asRecord(plan.readinessChecklist);
    if (
      readiness.tariffRevenueEvidencePresent === true &&
      readiness.costEvidencePresent === true &&
      readiness.connectionFeeLiabilityPresent === true &&
      this.hasEvidenceNotes(plan.revenueEvidence) &&
      this.hasEvidenceNotes(plan.costEvidence) &&
      this.hasEvidenceNotes(plan.connectionFeeLiabilityState)
    ) {
      return;
    }
    throw new ConflictException({
      code: 'TARIFF_EVIDENCE_REQUIRED',
      message:
        'Complete tariff evidence and accept the current tariff package before creating a report snapshot.',
    });
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

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeTextValue(value: unknown): string | null {
    return typeof value === 'string' ? this.normalizeText(value) : null;
  }

  async buildReportPdf(orgId: string, reportId: string): Promise<Buffer> {
    const report = await this.getReport(orgId, reportId);
    const snapshot = report.snapshot;
    const reportVariant = this.normalizeReportVariant(
      snapshot?.reportVariant ?? report.variant,
    );
    const reportSections =
      snapshot?.reportSections ?? this.buildReportSections(reportVariant);
    return buildV2ReportPdf({
      report,
      snapshot,
      reportVariant,
      reportSections,
      toPdfText: (value) => this.toPdfText(value),
      normalizeText: (value) => this.normalizeText(value),
      toNumber: (value) => this.toNumber(value),
    });
  }
}
