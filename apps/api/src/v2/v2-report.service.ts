import { Injectable } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parseKvaWorkbookPreview } from '../budgets/va-import/kva-workbook-preview';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import {
  VeetiEffectiveDataService,
  type OverrideProvenance,
} from '../veeti/veeti-effective-data.service';
import { VEETI_TARIFF_SCOPE } from '../veeti/veeti-import-contract';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { ManualYearCompletionDto } from './dto/manual-year-completion.dto';
import { ImportYearReconcileDto } from './dto/import-year-reconcile.dto';
import { OpsEventDto } from './dto/ops-event.dto';
import { PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS } from './pts-depreciation-defaults';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { buildV2ReportPdf } from './v2-report-pdf';
import {
  computeVesinvestBaselineFingerprint,
  computeVesinvestScenarioFingerprint,
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
} from './vesinvest-contract';

type SyncRequirement = 'financials' | 'prices' | 'volumes';
type PlanningRole = 'historical' | 'current_year_estimate';
type OverrideProvenanceCore = Omit<OverrideProvenance, 'fieldSources'>;
type ScenarioAssumptionKey =
  | 'inflaatio'
  | 'energiakerroin'
  | 'henkilostokerroin'
  | 'vesimaaran_muutos'
  | 'hintakorotus'
  | 'perusmaksuMuutos'
  | 'investointikerroin';

type StatementPreviewFieldKey =
  | 'liikevaihto'
  | 'aineetJaPalvelut'
  | 'henkilostokulut'
  | 'liiketoiminnanMuutKulut'
  | 'poistot'
  | 'arvonalentumiset'
  | 'rahoitustuototJaKulut'
  | 'tilikaudenYliJaama'
  | 'omistajatuloutus'
  | 'omistajanTukiKayttokustannuksiin';

type StatementPreviewRequest = {
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  fileBuffer: Buffer | null;
  statementType?: string | null;
};

type WorkbookPreviewRequest = {
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  fileBuffer: Buffer | null;
};

type StatementPreviewResponse = {
  year: number;
  statementType: 'result_statement';
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
    parserStatus: 'pending_parser';
  };
  fields: Array<{
    key: StatementPreviewFieldKey;
    label: string;
    sourceField: string;
    veetiValue: number | null;
    effectiveValue: number | null;
    extractedValue: number | null;
    proposedValue: number | null;
    changed: boolean;
  }>;
  sourceRows: Array<{
    label: string;
    currentYearValue: number | null;
    previousYearValue: number | null;
    pageNumber: number | null;
    lineIndex: number | null;
    mappingStatus: 'pending';
    mappedKey: StatementPreviewFieldKey | null;
  }>;
  warnings: string[];
  canApply: boolean;
};

type WorkbookPreviewResponse = {
  document: {
    fileName: string;
    contentType: string | null;
    sizeBytes: number;
    receivedAt: string;
  };
  sheetName: string;
  workbookYears: number[];
  importedYears: number[];
  matchedYears: number[];
  unmatchedImportedYears: number[];
  unmatchedWorkbookYears: number[];
  years: Array<{
    year: number;
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    rows: Array<{
      key: ImportYearSummaryFieldKey;
      sourceField: ImportYearSummarySourceField;
      currentValue: number | null;
      workbookValue: number | null;
      differs: boolean;
      currentSource: ImportYearSummarySource;
      suggestedAction: 'keep_veeti' | 'apply_workbook';
    }>;
  }>;
  canApply: boolean;
};

type BaselineDatasetSource = {
  dataType: string;
  source: 'veeti' | 'manual' | 'none';
  provenance: OverrideProvenance | null;
  editedAt: string | null;
  editedBy: string | null;
  reason: string | null;
};

type BaselineSourceSummary = {
  year: number;
  planningRole: PlanningRole;
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: BaselineDatasetSource;
  prices: BaselineDatasetSource;
  volumes: BaselineDatasetSource;
};

type VesinvestBaselineSnapshotYear = {
  year?: number;
  planningRole?: PlanningRole;
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown?: {
    veetiDataTypes?: string[];
    manualDataTypes?: string[];
  };
  financials?: BaselineDatasetSource | null;
  prices?: BaselineDatasetSource | null;
  volumes?: BaselineDatasetSource | null;
};

type ImportYearSummaryFieldKey =
  | 'revenue'
  | 'materialsCosts'
  | 'personnelCosts'
  | 'depreciation'
  | 'otherOperatingCosts'
  | 'result';

type ImportYearSummarySourceField =
  | 'Liikevaihto'
  | 'AineetJaPalvelut'
  | 'Henkilostokulut'
  | 'Poistot'
  | 'LiiketoiminnanMuutKulut'
  | 'TilikaudenYliJaama';

type ImportYearSummarySource = 'direct' | 'missing';

type ImportYearSummaryRow = {
  key: ImportYearSummaryFieldKey;
  sourceField: ImportYearSummarySourceField;
  rawValue: number | null;
  effectiveValue: number | null;
  changed: boolean;
  rawSource: ImportYearSummarySource;
  effectiveSource: ImportYearSummarySource;
};

type ImportYearTrustSignal = {
  level: 'none' | 'review' | 'material';
  reasons: Array<
    | 'manual_override'
    | 'statement_import'
    | 'qdis_import'
    | 'workbook_import'
    | 'mixed_source'
    | 'incomplete_source'
    | 'result_changed'
  >;
  changedSummaryKeys: ImportYearSummaryFieldKey[];
  statementImport: OverrideProvenance | null;
  workbookImport: OverrideProvenance | null;
};

type ImportYearResultToZeroSignal = {
  rawValue: number | null;
  effectiveValue: number | null;
  delta: number | null;
  absoluteGap: number | null;
  marginPct: number | null;
  direction: 'above_zero' | 'below_zero' | 'at_zero' | 'missing';
};

type ImportYearSubrowAvailability = {
  truthfulSubrowsAvailable: boolean;
  reason: 'year_summary_only';
  rawRowCount: number;
  effectiveRowCount: number;
};

type TrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

const SCENARIO_ASSUMPTION_KEYS: ScenarioAssumptionKey[] = [
  'inflaatio',
  'energiakerroin',
  'henkilostokerroin',
  'vesimaaran_muutos',
  'hintakorotus',
  'perusmaksuMuutos',
  'investointikerroin',
];

type ScenarioYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  baselineDepreciation: number;
  investmentDepreciation: number;
  totalDepreciation: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
};

type ScenarioPayload = {
  id: string;
  name: string;
  onOletus: boolean;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: YearlyInvestment[];
  nearTermExpenseAssumptions: NearTermExpenseAssumption[];
  thereafterExpenseAssumptions: ThereafterExpenseAssumption;
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
  requiredPriceTodayCombinedAnnualResult: number | null;
  requiredAnnualIncreasePctAnnualResult: number | null;
  requiredPriceTodayCombinedCumulativeCash: number | null;
  requiredAnnualIncreasePctCumulativeCash: number | null;
  feeSufficiency: {
    baselineCombinedPrice: number | null;
    annualResult: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakDeficit: number;
    };
    cumulativeCash: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      underfundingStartYear: number | null;
      peakGap: number;
    };
  };
  years: ScenarioYear[];
  priceSeries: Array<{
    year: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
  }>;
  investmentSeries: Array<{ year: number; amount: number }>;
  cashflowSeries: Array<{
    year: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  computedAt: Date | null;
  computedFromUpdatedAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

type SnapshotPayload = {
  scenario: ScenarioPayload;
  generatedAt: string;
  baselineSourceSummary: BaselineSourceSummary | null;
  vesinvestPlan: {
    id: string;
    seriesId?: string;
    name: string;
    utilityName: string;
    versionNumber: number;
    status?: string;
    baselineFingerprint?: string | null;
    scenarioFingerprint?: string | null;
    feeRecommendation?: Record<string, unknown> | null;
  } | null;
  vesinvestAppendix: {
    yearlyTotals: Array<{
      year: number;
      totalAmount: number;
    }>;
    fiveYearBands: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }>;
    groupedProjects: Array<{
      groupKey: string;
      groupLabel: string;
      totalAmount: number;
      projects: Array<{
        code: string;
        name: string;
        totalAmount: number;
      }>;
    }>;
  } | null;
  reportVariant: ReportVariant;
  reportSections: ReportSections;
};

type ReportVariant = 'public_summary' | 'confidential_appendix';

type ReportSections = {
  baselineSources: boolean;
  assumptions: boolean;
  yearlyInvestments: boolean;
  riskSummary: boolean;
};

type YearlyInvestment = {
  year: number;
  amount: number;
  target: string | null;
  category: string | null;
  depreciationClassKey: string | null;
  depreciationRuleSnapshot: {
    assetClassKey: string;
    assetClassName: string | null;
    method: DepreciationMethod;
    linearYears: number | null;
    residualPercent: number | null;
    annualSchedule?: number[] | null;
  } | null;
  investmentType: 'replacement' | 'new' | null;
  confidence: 'low' | 'medium' | 'high' | null;
  waterAmount: number | null;
  wastewaterAmount: number | null;
  note: string | null;
};

type NearTermExpenseAssumption = {
  year: number;
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

type ThereafterExpenseAssumption = {
  personnelPct: number;
  energyPct: number;
  opexOtherPct: number;
};

type DepreciationMethod =
  | 'linear'
  | 'residual'
  | 'straight-line'
  | 'custom-annual-schedule'
  | 'none';

const VESINVEST_REPORT_GROUP_LABELS: Record<string, string> =
  Object.fromEntries(
    DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((item) => [item.key, item.label]),
  );

type DepreciationRuleInput = {
  assetClassKey?: string;
  assetClassName?: string | null;
  method?: DepreciationMethod;
  linearYears?: number | null;
  residualPercent?: number | null;
  annualSchedule?: number[] | null;
};

type ScenarioStoredDepreciationRule = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: 'residual' | 'straight-line' | 'none';
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule: number[] | null;
};

const toCanonicalDepreciationMethod = (
  method: string,
): 'residual' | 'straight-line' | 'none' | null => {
  if (method === 'linear' || method === 'straight-line') {
    return 'straight-line';
  }
  if (method === 'residual' || method === 'none') {
    return method;
  }
  if (method === 'custom-annual-schedule') {
    return 'straight-line';
  }
  return null;
};

type ScenarioBaselineDepreciationRow = {
  year: number;
  amount: number;
};

type ScenarioClassAllocationInput = {
  years?: Array<{
    year?: number;
    allocations?: Array<{ classKey?: string; sharePct?: number }>;
  }>;
};

type SnapshotTrendPoint = {
  year: number;
  revenue: number;
  operatingCosts: number;
  financingNet: number;
  otherResultItems: number;
  yearResult: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
};

const IMPORT_YEAR_SUMMARY_FIELDS: Array<{
  key: ImportYearSummaryFieldKey;
  sourceField: ImportYearSummarySourceField;
}> = [
  { key: 'revenue', sourceField: 'Liikevaihto' },
  { key: 'materialsCosts', sourceField: 'AineetJaPalvelut' },
  { key: 'personnelCosts', sourceField: 'Henkilostokulut' },
  { key: 'depreciation', sourceField: 'Poistot' },
  { key: 'otherOperatingCosts', sourceField: 'LiiketoiminnanMuutKulut' },
  { key: 'result', sourceField: 'TilikaudenYliJaama' },
];

const MANUAL_YEAR_FINANCIAL_FIELD_MAPPINGS: Array<{
  payloadKey:
    | 'liikevaihto'
    | 'aineetJaPalvelut'
    | 'henkilostokulut'
    | 'liiketoiminnanMuutKulut'
    | 'poistot'
    | 'arvonalentumiset'
    | 'rahoitustuototJaKulut'
    | 'tilikaudenYliJaama'
    | 'omistajatuloutus'
    | 'omistajanTukiKayttokustannuksiin';
  sourceField: string;
}> = [
  { payloadKey: 'liikevaihto', sourceField: 'Liikevaihto' },
  { payloadKey: 'aineetJaPalvelut', sourceField: 'AineetJaPalvelut' },
  { payloadKey: 'henkilostokulut', sourceField: 'Henkilostokulut' },
  {
    payloadKey: 'liiketoiminnanMuutKulut',
    sourceField: 'LiiketoiminnanMuutKulut',
  },
  { payloadKey: 'poistot', sourceField: 'Poistot' },
  { payloadKey: 'arvonalentumiset', sourceField: 'Arvonalentumiset' },
  {
    payloadKey: 'rahoitustuototJaKulut',
    sourceField: 'RahoitustuototJaKulut',
  },
  { payloadKey: 'tilikaudenYliJaama', sourceField: 'TilikaudenYliJaama' },
  { payloadKey: 'omistajatuloutus', sourceField: 'Omistajatuloutus' },
  {
    payloadKey: 'omistajanTukiKayttokustannuksiin',
    sourceField: 'OmistajanTukiKayttokustannuksiin',
  },
];

const STATEMENT_PREVIEW_FIELDS: Array<{
  key: StatementPreviewFieldKey;
  label: string;
  sourceField: string;
}> = [
  { key: 'liikevaihto', label: 'Liikevaihto', sourceField: 'Liikevaihto' },
  {
    key: 'aineetJaPalvelut',
    label: 'Aineet ja palvelut',
    sourceField: 'AineetJaPalvelut',
  },
  {
    key: 'henkilostokulut',
    label: 'Henkilostokulut',
    sourceField: 'Henkilostokulut',
  },
  {
    key: 'liiketoiminnanMuutKulut',
    label: 'Liiketoiminnan muut kulut',
    sourceField: 'LiiketoiminnanMuutKulut',
  },
  { key: 'poistot', label: 'Poistot', sourceField: 'Poistot' },
  {
    key: 'arvonalentumiset',
    label: 'Arvonalentumiset',
    sourceField: 'Arvonalentumiset',
  },
  {
    key: 'rahoitustuototJaKulut',
    label: 'Rahoitustuotot ja -kulut',
    sourceField: 'RahoitustuototJaKulut',
  },
  {
    key: 'tilikaudenYliJaama',
    label: 'Tilikauden ylijäämä/alijäämä',
    sourceField: 'TilikaudenYliJaama',
  },
  {
    key: 'omistajatuloutus',
    label: 'Omistajatuloutus',
    sourceField: 'Omistajatuloutus',
  },
  {
    key: 'omistajanTukiKayttokustannuksiin',
    label: 'Omistajan tuki käyttökustannuksiin',
    sourceField: 'OmistajanTukiKayttokustannuksiin',
  },
];

const WORKBOOK_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const STATEMENT_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_WORKBOOK_EXTENSIONS = new Set(['.xlsx', '.xlsm']);
const ALLOWED_WORKBOOK_CONTENT_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/octet-stream',
]);

const ALLOWED_STATEMENT_EXTENSIONS = new Set(['.pdf']);
const ALLOWED_STATEMENT_CONTENT_TYPES = new Set([
  'application/pdf',
  'application/octet-stream',
]);

@Injectable()
export class V2ReportService {
  protected readonly logger = new Logger(V2ReportService.name);
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
    private readonly veetiSanityService: VeetiSanityService,
    private readonly forecastService: V2ForecastService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
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

  private computeCombinedPrice(
    drivers: Array<{ yksikkohinta: unknown; myytyMaara: unknown }>,
  ): number {
    const totalVolume = drivers.reduce(
      (sum, row) => sum + this.toNumber(row.myytyMaara),
      0,
    );
    if (totalVolume <= 0) return 0;
    const totalRevenue = drivers.reduce(
      (sum, row) =>
        sum +
        this.toNumber(row.yksikkohinta) * this.toNumber(row.myytyMaara),
      0,
    );
    return this.round2(totalRevenue / totalVolume);
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
        return {
        id: row.id,
        title: this.normalizeText(row.title) ?? row.title,
        createdAt: row.createdAt,
        ennuste: row.ennuste,
        baselineYear: row.baselineYear,
        requiredPriceToday: this.toNumber(row.requiredPriceToday),
        requiredAnnualIncreasePct: this.toNumber(row.requiredAnnualIncreasePct),
        totalInvestments: this.toNumber(row.totalInvestments),
        baselineSourceSummary: snapshot.baselineSourceSummary ?? null,
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
        versionNumber: true,
        status: true,
        selectedScenarioId: true,
        baselineFingerprint: true,
        scenarioFingerprint: true,
        feeRecommendation: true,
        baselineSourceState: true,
        projects: {
          select: {
            groupKey: true,
            projectCode: true,
            projectName: true,
            totalAmount: true,
            allocations: {
              select: {
                year: true,
                totalAmount: true,
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
    if (
      vesinvestPlan.scenarioFingerprint &&
      vesinvestPlan.scenarioFingerprint !== liveScenarioFingerprint
    ) {
      throw new ConflictException({
        code: 'VESINVEST_SCENARIO_STALE',
        message:
          'Vesinvest pricing snapshot is out of date. Re-open fee path before creating report.',
      });
    }
    if (vesinvestPlan.baselineFingerprint) {
      const currentBaseline = await this.getCurrentBaselineSnapshot(orgId);
      if (vesinvestPlan.baselineFingerprint !== currentBaseline.fingerprint) {
        throw new ConflictException({
          code: 'VESINVEST_BASELINE_STALE',
          message:
            'Accepted baseline changed after this Vesinvest revision was verified. Re-verify baseline before creating report.',
        });
      }
    }

    let baselineSourceSummary =
      this.buildBaselineSourceSummaryFromVesinvestSnapshot(
        vesinvestPlan?.baselineSourceState ?? null,
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
      } catch {
        baselineSourceSummary = null;
      }
    }

    const reportVariant = this.normalizeReportVariant(body.variant);
    const reportSections = this.buildReportSections(reportVariant);
    const vesinvestAppendix = await this.buildVesinvestAppendix(
      vesinvestPlan.projects,
      scenario.yearlyInvestments.map((item) => item.year),
      orgId,
    );
    const snapshot: SnapshotPayload = {
      scenario,
      generatedAt: new Date().toISOString(),
      baselineSourceSummary,
      vesinvestPlan: {
        id: vesinvestPlan.id,
        seriesId: vesinvestPlan.seriesId,
        name: vesinvestPlan.name,
        utilityName: vesinvestPlan.utilityName,
        versionNumber: vesinvestPlan.versionNumber,
        status: vesinvestPlan.status,
        baselineFingerprint: vesinvestPlan.baselineFingerprint,
        scenarioFingerprint: vesinvestPlan.scenarioFingerprint,
        feeRecommendation:
          (vesinvestPlan.feeRecommendation as Record<string, unknown> | null) ?? null,
      },
      vesinvestAppendix,
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
      this.buildDefaultReportTitle(scenario.name, new Date());

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

  private async buildVesinvestAppendix(
    projects: Array<{
      groupKey: string;
      projectCode: string;
      projectName: string;
      totalAmount: Prisma.Decimal | number | null;
      allocations: Array<{
        year: number;
        totalAmount: Prisma.Decimal | number;
      }>;
    }>,
    scenarioYears: number[],
    orgId: string,
  ) {
    const yearSet = new Set<number>();
    for (const year of scenarioYears) {
      yearSet.add(year);
    }
    for (const project of projects) {
      for (const allocation of project.allocations) {
        yearSet.add(allocation.year);
      }
    }

    const years = [...yearSet].sort((left, right) => left - right);
    const groupLabels = await this.getReportGroupLabelMap(orgId);
    const groupOrder = new Map(
      Object.keys(groupLabels).map((key, index) => [key, index]),
    );
    const groupMap = new Map<
      string,
      {
        groupKey: string;
        groupLabel: string;
        totalAmount: number;
        projects: Array<{
          code: string;
          name: string;
          totalAmount: number;
        }>;
      }
    >();
    const yearlyTotalsMap = new Map<number, number>();

    for (const project of projects) {
      const groupKey = project.groupKey;
      const groupLabel = groupLabels[groupKey] ?? groupKey;
      const totalAmount = this.round2(this.toNumber(project.totalAmount));
      const currentGroup = groupMap.get(groupKey) ?? {
        groupKey,
        groupLabel,
        totalAmount: 0,
        projects: [],
      };
      currentGroup.totalAmount = this.round2(currentGroup.totalAmount + totalAmount);
      currentGroup.projects.push({
        code: project.projectCode,
        name: project.projectName,
        totalAmount,
      });
      groupMap.set(groupKey, currentGroup);

      for (const allocation of project.allocations) {
        yearlyTotalsMap.set(
          allocation.year,
          this.round2(
            (yearlyTotalsMap.get(allocation.year) ?? 0) +
              this.toNumber(allocation.totalAmount),
          ),
        );
      }
    }

    const yearlyTotals = years.map((year) => ({
      year,
      totalAmount: this.round2(yearlyTotalsMap.get(year) ?? 0),
    }));

    const fiveYearBands: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }> = [];
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

    const groupedProjects = [...groupMap.values()]
      .sort((left, right) => {
        const leftOrder = groupOrder.get(left.groupKey) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder =
          groupOrder.get(right.groupKey) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.groupLabel.localeCompare(right.groupLabel);
      })
      .map((group) => ({
        ...group,
        projects: [...group.projects].sort((left, right) =>
          left.code.localeCompare(right.code),
        ),
      }));

    return {
      yearlyTotals,
      fiveYearBands,
      groupedProjects,
    };
  }

  private investmentSeriesMatchesYearlyInvestments(
    scenario: ScenarioPayload,
  ): boolean {
    const computedByYear = new Map<number, number>();
    for (const row of scenario.investmentSeries) {
      computedByYear.set(row.year, this.toNumber(row.amount));
    }

    const inputByYear = new Map<number, number>();
    for (const row of scenario.yearlyInvestments) {
      inputByYear.set(
        row.year,
        this.round2((inputByYear.get(row.year) ?? 0) + this.toNumber(row.amount)),
      );
    }

    for (const [year, amount] of inputByYear.entries()) {
      const computed = computedByYear.get(year);
      if (computed == null) return false;
      if (Math.abs(computed - amount) > 0.01) {
        return false;
      }
    }

    return true;
  }

  private async getCurrentBaselineSnapshot(orgId: string) {
    const [acceptedYears, latestAcceptedBudgetId, planningContext] = await Promise.all([
      this.planningWorkspaceSupport.resolvePlanningBaselineYears(orgId, {
        persistRepair: true,
      }),
      this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId),
      this.importOverviewService.getPlanningContext(orgId),
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
      fingerprint: computeVesinvestBaselineFingerprint({
        acceptedYears,
        latestAcceptedBudgetId,
        baselineYears,
      }),
    };
  }

  private async getReportGroupLabelMap(orgId: string) {
    const findMany = this.prisma.vesinvestGroupDefinition?.findMany;
    const rows =
      typeof findMany === 'function'
        ? await findMany({
            orderBy: [{ key: 'asc' }],
            select: {
              key: true,
              label: true,
            },
          })
        : [];
    const source =
      rows.length > 0
        ? rows.map((row) => [row.key, row.label] as const)
        : DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((row) => [row.key, row.label] as const);
    const labels = Object.fromEntries(source) as Record<string, string>;
    const overrideFindMany = this.prisma.vesinvestGroupOverride?.findMany;
    if (typeof overrideFindMany !== 'function') {
      return labels;
    }
    const overrides = await overrideFindMany({
      where: { orgId },
      select: {
        key: true,
        label: true,
      },
    });
    for (const row of overrides) {
      labels[row.key] = row.label;
    }
    return labels;
  }

  private buildBaselineSourceSummary(
    importStatus: {
      years: Array<{
        vuosi: number;
        planningRole?: PlanningRole;
        sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
        sourceBreakdown?: {
          veetiDataTypes?: string[];
          manualDataTypes?: string[];
        };
      }>;
    },
    year: number,
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): BaselineSourceSummary {
    const yearStatus =
      importStatus.years.find((row) => row.vuosi === year) ?? null;
    const financials = this.buildBaselineDatasetSource(
      yearDataset,
      'tilinpaatos',
      'tilinpaatos',
    );
    const prices = this.buildBaselineDatasetSource(yearDataset, 'taksa', 'taksa');
    const volumes = this.mergeBaselineDatasetSources(yearDataset, [
      'volume_vesi',
      'volume_jatevesi',
    ]);

    return {
      year,
      planningRole:
        yearStatus?.planningRole ??
        (year === new Date().getFullYear()
          ? 'current_year_estimate'
          : 'historical'),
      sourceStatus: yearStatus?.sourceStatus ?? yearDataset.sourceStatus,
      sourceBreakdown: {
        veetiDataTypes: yearStatus?.sourceBreakdown?.veetiDataTypes ?? [],
        manualDataTypes: yearStatus?.sourceBreakdown?.manualDataTypes ?? [],
      },
      financials,
      prices,
      volumes,
    };
  }

  private buildBaselineSourceSummaryFromVesinvestSnapshot(
    rawState: Prisma.JsonValue | null,
    requestedYear: number | null,
  ): BaselineSourceSummary | null {
    if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) {
      return null;
    }
    const state = rawState as Record<string, unknown>;
    const years = Array.isArray(state.baselineYears)
      ? (state.baselineYears as VesinvestBaselineSnapshotYear[])
      : [];
    if (years.length === 0) {
      return null;
    }
    const targetYear =
      requestedYear != null &&
      years.some((item) => this.toNumber(item.year) === requestedYear)
        ? requestedYear
        : this.toNumber(
            [...years]
              .map((item) => this.toNumber(item.year))
              .sort((left, right) => right - left)[0] ?? 0,
          );
    const selected =
      years.find((item) => this.toNumber(item.year) === targetYear) ?? years[0];
    if (!selected) {
      return null;
    }
    return {
      year: this.toNumber(selected.year),
      planningRole:
        selected.planningRole === 'current_year_estimate'
          ? 'current_year_estimate'
          : 'historical',
      sourceStatus:
        selected.sourceStatus === 'VEETI' ||
        selected.sourceStatus === 'MANUAL' ||
        selected.sourceStatus === 'MIXED'
          ? selected.sourceStatus
          : 'INCOMPLETE',
      sourceBreakdown: {
        veetiDataTypes: Array.isArray(selected.sourceBreakdown?.veetiDataTypes)
          ? selected.sourceBreakdown?.veetiDataTypes.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
        manualDataTypes: Array.isArray(selected.sourceBreakdown?.manualDataTypes)
          ? selected.sourceBreakdown?.manualDataTypes.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      },
      financials: this.normalizeSavedBaselineDataset(
        selected.financials,
        'tilinpaatos',
      ),
      prices: this.normalizeSavedBaselineDataset(selected.prices, 'taksa'),
      volumes: this.normalizeSavedBaselineDataset(
        selected.volumes,
        'volume_vesi+volume_jatevesi',
      ),
    };
  }

  private normalizeSavedBaselineDataset(
    raw: VesinvestBaselineSnapshotYear['financials'],
    fallbackDataType: string,
  ): BaselineDatasetSource {
    const dataset =
      raw && typeof raw === 'object' ? (raw as BaselineDatasetSource) : null;
    return {
      dataType: this.normalizeText(dataset?.dataType) ?? fallbackDataType,
      source:
        dataset?.source === 'veeti' || dataset?.source === 'manual'
          ? dataset.source
          : 'none',
      provenance:
        dataset?.provenance && typeof dataset.provenance === 'object'
          ? (dataset.provenance as OverrideProvenance)
          : null,
      editedAt: this.normalizeText(dataset?.editedAt) ?? null,
      editedBy: this.normalizeText(dataset?.editedBy) ?? null,
      reason: this.normalizeText(dataset?.reason) ?? null,
    };
  }

  private buildBaselineDatasetSource(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    requestedDataType: string,
    fallbackDataType: string,
  ): BaselineDatasetSource {
    const dataset =
      yearDataset.datasets.find((row) => row.dataType === requestedDataType) ??
      null;

    return {
      dataType: dataset?.dataType ?? fallbackDataType,
      source: dataset?.source ?? 'none',
      provenance: dataset?.overrideMeta?.provenance ?? null,
      editedAt: dataset?.overrideMeta?.editedAt ?? null,
      editedBy: dataset?.overrideMeta?.editedBy ?? null,
      reason: dataset?.overrideMeta?.reason ?? null,
    };
  }

  private mergeBaselineDatasetSources(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    dataTypes: string[],
  ): BaselineDatasetSource {
    const datasets = dataTypes
      .map((dataType) =>
        yearDataset.datasets.find((row) => row.dataType === dataType) ?? null,
      )
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const source =
      datasets.some((row) => row.source === 'manual')
        ? 'manual'
        : datasets.some((row) => row.source === 'veeti')
        ? 'veeti'
        : 'none';
    const overrideMeta =
      [...datasets]
        .map((row) => row.overrideMeta)
        .filter(
          (row): row is NonNullable<(typeof datasets)[number]['overrideMeta']> =>
            row !== null,
        )
        .sort(
          (left, right) =>
            new Date(right.editedAt).getTime() - new Date(left.editedAt).getTime(),
        )[0] ?? null;

    return {
      dataType: dataTypes.join('+'),
      source,
      provenance: overrideMeta?.provenance ?? null,
      editedAt: overrideMeta?.editedAt ?? null,
      editedBy: overrideMeta?.editedBy ?? null,
      reason: overrideMeta?.reason ?? null,
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
        baselineSourceSummary: snapshot.baselineSourceSummary ?? null,
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
    return raw === 'public_summary'
      ? 'public_summary'
      : 'confidential_appendix';
  }

  private buildReportSections(variant: ReportVariant): ReportSections {
    if (variant === 'public_summary') {
      return {
        baselineSources: true,
        assumptions: false,
        yearlyInvestments: false,
        riskSummary: true,
      };
    }

    return {
      baselineSources: true,
      assumptions: true,
      yearlyInvestments: true,
      riskSummary: true,
    };
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

  private async getTrendSeries(orgId: string): Promise<TrendPoint[]> {
    const budgets = await this.prisma.talousarvio.findMany({
      where: { orgId, lahde: 'veeti' },
      include: {
        valisummat: true,
        tuloajurit: true,
      },
      orderBy: { vuosi: 'asc' },
    });
    const snapshotByYear = await this.getSnapshotFallbackSeries(orgId);

    const budgetSeries = budgets.map((budget): TrendPoint => {
      const liikevaihto = budget.valisummat
        .filter((row) => row.categoryKey === 'liikevaihto')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const revenueFallback = budget.valisummat
        .filter(
          (row) => row.tyyppi === 'tulo' || row.tyyppi === 'rahoitus_tulo',
        )
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const revenue = liikevaihto !== 0 ? liikevaihto : revenueFallback;

      const operatingCostsFromRows = budget.valisummat
        .filter((row) => row.tyyppi === 'kulu' || row.tyyppi === 'poisto')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const financingIncome = budget.valisummat
        .filter((row) => row.tyyppi === 'rahoitus_tulo')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);
      const financingCost = budget.valisummat
        .filter((row) => row.tyyppi === 'rahoitus_kulu')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);
      const financingNet = financingIncome - financingCost;

      const explicitResult = budget.valisummat
        .filter((row) => row.categoryKey === 'tilikauden_tulos')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const explicitResultFallback = budget.valisummat
        .filter((row) => row.tyyppi === 'tulos')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      let result =
        explicitResult !== 0
          ? explicitResult
          : explicitResultFallback !== 0
          ? explicitResultFallback
          : revenue - operatingCostsFromRows + financingNet;

      let operatingCosts = operatingCostsFromRows;
      const volume = budget.tuloajurit.reduce(
        (sum, row) => sum + this.toNumber(row.myytyMaara),
        0,
      );
      const combinedPrice = this.computeCombinedPrice(
        budget.tuloajurit as Array<{
          yksikkohinta: unknown;
          myytyMaara: unknown;
        }>,
      );

      const year = budget.veetiVuosi ?? budget.vuosi;
      const otherResultItems = revenue - operatingCosts - result;
      const point: TrendPoint = {
        year,
        revenue: this.round2(revenue),
        operatingCosts: this.round2(operatingCosts),
        financingNet: this.round2(financingNet),
        otherResultItems: this.round2(otherResultItems),
        yearResult: this.round2(result),
        costs: this.round2(operatingCosts),
        result: this.round2(result),
        volume: this.round2(volume),
        combinedPrice: this.round2(combinedPrice),
      };
      const fallback = snapshotByYear.get(year);
      if (!fallback) {
        if (
          point.operatingCosts === 0 &&
          point.revenue !== 0 &&
          point.yearResult !== 0
        ) {
          point.operatingCosts = this.round2(point.revenue - point.yearResult);
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        }
        return point;
      }

      if (fallback.sourceStatus && fallback.sourceStatus !== 'VEETI') {
        return {
          year,
          revenue: fallback.revenue,
          operatingCosts: fallback.operatingCosts,
          financingNet: fallback.financingNet,
          otherResultItems: fallback.otherResultItems,
          yearResult: fallback.yearResult,
          costs: fallback.costs,
          result: fallback.result,
          volume: fallback.volume,
          combinedPrice: fallback.combinedPrice,
        };
      }

      // Older VEETI years can have sparse cost fields. In that case,
      // prefer signed snapshot result and derive costs from revenue-result.
      if (point.operatingCosts === 0 && point.revenue !== 0) {
        if (fallback.yearResult !== 0) {
          point.yearResult = this.round2(fallback.yearResult);
          point.result = point.yearResult;
          point.operatingCosts = this.round2(
            Math.max(0, point.revenue - point.yearResult),
          );
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        } else if (point.yearResult !== 0) {
          point.operatingCosts = this.round2(
            Math.max(0, point.revenue - point.yearResult),
          );
          point.costs = point.operatingCosts;
          point.otherResultItems = this.round2(
            point.revenue - point.operatingCosts - point.yearResult,
          );
        } else if (fallback.operatingCosts !== 0) {
          point.operatingCosts = this.round2(fallback.operatingCosts);
          point.costs = point.operatingCosts;
          point.yearResult = this.round2(
            point.revenue - point.operatingCosts - point.otherResultItems,
          );
          point.result = point.yearResult;
        }
      }

      const mergedRevenue =
        point.revenue !== 0 ? point.revenue : fallback.revenue;
      const mergedOperatingCosts =
        point.operatingCosts !== 0
          ? point.operatingCosts
          : fallback.operatingCosts;
      const mergedYearResult =
        point.yearResult !== 0 ? point.yearResult : fallback.yearResult;
      const mergedFinancingNet =
        point.financingNet !== 0 ? point.financingNet : fallback.financingNet;
      const mergedOtherResultItems = this.round2(
        mergedRevenue - mergedOperatingCosts - mergedYearResult,
      );

      return {
        year,
        revenue: mergedRevenue,
        operatingCosts: mergedOperatingCosts,
        financingNet: mergedFinancingNet,
        otherResultItems: mergedOtherResultItems,
        yearResult: mergedYearResult,
        costs: mergedOperatingCosts,
        result: mergedYearResult,
        volume: point.volume !== 0 ? point.volume : fallback.volume,
        combinedPrice:
          point.combinedPrice !== 0
            ? point.combinedPrice
            : fallback.combinedPrice,
      };
    });

    const byYear = new Map<number, TrendPoint>();
    for (const point of budgetSeries) {
      byYear.set(point.year, point);
    }
    if (budgets.length === 0) {
      for (const point of snapshotByYear.values()) {
        if (!byYear.has(point.year)) {
          byYear.set(point.year, point);
        }
      }
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }


  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async getSnapshotFallbackSeries(
    orgId: string,
  ): Promise<Map<number, SnapshotTrendPoint>> {
    const yearRows = await this.veetiEffectiveDataService.getAvailableYears(
      orgId,
    );
    const sourceStatusByYear = new Map(
      yearRows.map((row) => [row.vuosi, row.sourceStatus] as const),
    );
    const years = yearRows.map((row) => row.vuosi);
    const out = new Map<number, SnapshotTrendPoint>();

    for (const year of years.sort((a, b) => a - b)) {
      const [tilin, taksa, water, wastewater] = await Promise.all([
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'tilinpaatos',
        ),
        this.veetiEffectiveDataService.getEffectiveRows(orgId, year, 'taksa'),
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'volume_vesi',
        ),
        this.veetiEffectiveDataService.getEffectiveRows(
          orgId,
          year,
          'volume_jatevesi',
        ),
      ]);

      const tilinRow = tilin.rows[0] ?? null;
      if (!tilinRow) continue;
      const taksaRows = taksa.rows;
      const waterRows = water.rows;
      const wastewaterRows = wastewater.rows;

      const revenue = this.toNumber(tilinRow?.Liikevaihto);
      const operatingCostBuckets = this.splitVaOperatingCosts(tilinRow);
      const operatingCosts = this.round2(
        operatingCostBuckets.personnel +
          operatingCostBuckets.materialsServices +
          operatingCostBuckets.other +
          this.toNumber(tilinRow?.Poistot) +
          this.toNumber(tilinRow?.Arvonalentumiset),
      );
      const financingNet = this.round2(
        this.toNumber(tilinRow?.RahoitustuototJaKulut),
      );
      const explicitResult = this.toNumber(tilinRow?.TilikaudenYliJaama);
      const result =
        explicitResult !== 0
          ? explicitResult
          : this.round2(revenue - operatingCosts + financingNet);
      const waterVolume = waterRows.reduce(
        (sum, row) => sum + this.toNumber(row.Maara),
        0,
      );
      const wastewaterVolume = wastewaterRows.reduce(
        (sum, row) => sum + this.toNumber(row.Maara),
        0,
      );
      const totalVolume = waterVolume + wastewaterVolume;
      const waterPrice = this.resolveLatestPrice(taksaRows, 1);
      const wastewaterPrice = this.resolveLatestPrice(taksaRows, 2);
      const combinedPrice = this.round2(
        totalVolume > 0
          ? (waterPrice * waterVolume + wastewaterPrice * wastewaterVolume) /
              totalVolume
          : this.round2((waterPrice + wastewaterPrice) / 2),
      );

      out.set(year, {
        year,
        revenue: this.round2(revenue),
        operatingCosts,
        financingNet,
        otherResultItems: this.round2(revenue - operatingCosts - result),
        yearResult: this.round2(result),
        costs: operatingCosts,
        result: this.round2(result),
        volume: this.round2(totalVolume),
        combinedPrice,
        sourceStatus: sourceStatusByYear.get(year),
      });
    }

    return out;
  }

  private readRows(
    raw: Prisma.JsonValue | undefined,
  ): Array<Record<string, unknown>> {
    if (!Array.isArray(raw)) return [];
    const out: Array<Record<string, unknown>> = [];
    for (const row of raw) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        out.push(row as Record<string, unknown>);
      }
    }
    return out;
  }

  private readFirstRecord(
    raw: Prisma.JsonValue | undefined,
  ): Record<string, unknown> | null {
    const rows = this.readRows(raw);
    return rows[0] ?? null;
  }

  private resolveLatestPrice(
    rows: Array<Record<string, unknown>>,
    typeId: number,
  ): number {
    const candidates = rows
      .filter((row) => this.toNumber(row.Tyyppi_Id) === typeId)
      .map((row) => this.toNumber(row.Kayttomaksu))
      .filter((value) => value > 0);
    return candidates[candidates.length - 1] ?? 0;
  }

  private splitVaOperatingCosts(row: Record<string, unknown> | null): {
    materialsServices: number;
    personnel: number;
    other: number;
  } {
    const personnel = this.toNumber(row?.Henkilostokulut);
    const materialsServicesRaw = this.toNumber(row?.AineetJaPalvelut);
    const otherRaw = this.toNumber(row?.LiiketoiminnanMuutKulut);

    return {
      materialsServices: this.round2(Math.max(0, materialsServicesRaw)),
      personnel: this.round2(Math.max(0, personnel)),
      other: this.round2(Math.max(0, otherRaw)),
    };
  }


  private normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    let out = value;

    if (/\\u[0-9a-fA-F]{4}/.test(out)) {
      out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
      });
    }

    if (/[ÃÂâ]/.test(out)) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    return out;
  }

  private formatIsoDate(value: Date | string): string {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value instanceof Date ? parsed.toISOString().slice(0, 10) : value;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildDefaultScenarioName(value: Date | string): string {
    return `Scenario ${this.formatIsoDate(value)}`;
  }

  private buildDefaultReportTitle(
    scenarioName: string | null | undefined,
    value: Date | string,
  ): string {
    const safeScenarioName =
      this.normalizeText(scenarioName)?.trim() || 'Scenario';
    return `Forecast report ${safeScenarioName} ${this.formatIsoDate(value)}`;
  }

  private looksRecoveredText(candidate: string, original: string): boolean {
    const badPattern = /Ã|Â|â/;
    if (badPattern.test(candidate)) return false;
    const candidateScore = (candidate.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    const originalScore = (original.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
      .length;
    return candidateScore >= originalScore;
  }

  private toPdfText(value: string): string {
    const sanitized = value
      .replace(/[\u00A0\u202F]/g, ' ')
      .replace(/[\u2010-\u2015\u2212]/g, '-')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\u2026/g, '...');

    return Array.from(sanitized)
      .map((char) => {
        const codePoint = char.codePointAt(0) ?? 0x3f;
        return codePoint === 0x09 ||
          codePoint === 0x0a ||
          codePoint === 0x0d ||
          (codePoint >= 0x20 && codePoint <= 0xff)
          ? char
          : '?';
      })
      .join('');
  }
}
