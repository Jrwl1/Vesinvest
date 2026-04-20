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
import {
  DEFAULT_VESINVEST_GROUP_DEFINITIONS,
  expandLegacyDepreciationRuleKeyToVesinvestClasses,
  VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY,
} from './vesinvest-contract';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { createV2ForecastComputationSupport } from './v2-forecast-computation-support';
import { createV2ForecastDepreciationSupport } from './v2-forecast-depreciation-support';
import { createV2ForecastScenarioSupport } from './v2-forecast-scenario-support';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { buildV2ReportPdf } from './v2-report-pdf';

type SyncRequirement = 'financials' | 'prices' | 'volumes';
type OverrideProvenanceCore = Omit<OverrideProvenance, 'fieldSources'>;
type ScenarioAssumptionKey =
  | 'inflaatio'
  | 'energiakerroin'
  | 'henkilostokerroin'
  | 'vesimaaran_muutos'
  | 'hintakorotus'
  | 'perusmaksuMuutos'
  | 'investointikerroin';

type ScenarioType = 'base' | 'committed' | 'hypothesis' | 'stress';

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
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: BaselineDatasetSource;
  prices: BaselineDatasetSource;
  volumes: BaselineDatasetSource;
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

const SCENARIO_TYPE_OVERRIDE_KEY = '__scenarioTypeCode';
const SCENARIO_TYPE_CODE_TO_VALUE: Record<number, Exclude<ScenarioType, 'base'>> = {
  1: 'committed',
  2: 'hypothesis',
  3: 'stress',
};
const SCENARIO_TYPE_VALUE_TO_CODE: Record<Exclude<ScenarioType, 'base'>, number> = {
  committed: 1,
  hypothesis: 2,
  stress: 3,
};

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
  baseFeeRevenue: number;
  connectionCount: number;
};

type ScenarioPayload = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: ScenarioType;
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
  rowId?: string | null;
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
  vesinvestPlanId?: string | null;
  vesinvestProjectId?: string | null;
  allocationId?: string | null;
  projectCode?: string | null;
  groupKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
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
export class V2ForecastService {
  protected readonly logger = new Logger(V2ForecastService.name);
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;
  private readonly depreciationSupport: ReturnType<
    typeof createV2ForecastDepreciationSupport
  >;
  private readonly scenarioSupport: ReturnType<
    typeof createV2ForecastScenarioSupport
  >;
  private readonly computationSupport: ReturnType<
    typeof createV2ForecastComputationSupport
  >;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
    private readonly veetiSanityService: VeetiSanityService,
    private readonly importOverviewService: V2ImportOverviewService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    const ctx = this as any;
    this.depreciationSupport = createV2ForecastDepreciationSupport(ctx);
    this.scenarioSupport = createV2ForecastScenarioSupport(ctx);
    this.computationSupport = createV2ForecastComputationSupport(ctx);
  }

  private getImportStatus(
    ...args: Parameters<V2ImportOverviewService['getImportStatus']>
  ) {
    return this.importOverviewService.getImportStatus(...args);
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

  private async resolveLatestAcceptedVeetiBudgetId(orgId: string): Promise<string | null> {
    return this.planningWorkspaceSupport.resolveLatestAcceptedVeetiBudgetId(orgId);
  }

  private async resolveAcceptedPlanningBaselineBudgetIds(orgId: string): Promise<string[]> {
    return this.planningWorkspaceSupport.resolveAcceptedPlanningBaselineBudgetIds(
      orgId,
    );
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

    if (/[ÃƒÃ‚Ã¢]/.test(out)) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    out = out.normalize('NFKC');
    out = out.replace(/[\u0000-\u001f\u007f]/g, '');
    return out.trim();
  }

  private looksRecoveredText(candidate: string, original: string): boolean {
    const candidateLetters = (candidate.match(/[A-Za-zÅÄÖåäö]/g) ?? []).length;
    const originalLetters = (original.match(/[A-Za-zÅÄÖåäö]/g) ?? []).length;
    const replacementCount = (candidate.match(/\uFFFD/g) ?? []).length;
    return candidateLetters >= Math.max(3, originalLetters - 1) && replacementCount === 0;
  }

  private resolveWorkspaceYearRows(importStatus: {
    workspaceYears?: number[] | null;
    years?: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      sourceStatus?: string;
      isExcluded?: boolean;
    }>;
  }) {
    return this.planningWorkspaceSupport.resolveWorkspaceYearRows(importStatus);
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

  async listForecastScenarios(orgId: string) {
    return this.scenarioSupport.listForecastScenarios(orgId);
  }

  async listDepreciationRules(orgId: string) {
    return this.depreciationSupport.listDepreciationRules(orgId);
  }

  async createDepreciationRule(orgId: string, body: DepreciationRuleInput) {
    return this.depreciationSupport.createDepreciationRule(orgId, body);
  }

  async updateDepreciationRule(
    orgId: string,
    ruleId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.updateDepreciationRule(orgId, ruleId, body);
  }

  async deleteDepreciationRule(orgId: string, ruleId: string) {
    return this.depreciationSupport.deleteDepreciationRule(orgId, ruleId);
  }

  async listScenarioDepreciationRules(orgId: string, scenarioId: string) {
    return this.depreciationSupport.listScenarioDepreciationRules(orgId, scenarioId);
  }

  async createScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.createScenarioDepreciationRule(
      orgId,
      scenarioId,
      body,
    );
  }

  async updateScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    ruleId: string,
    body: DepreciationRuleInput,
  ) {
    return this.depreciationSupport.updateScenarioDepreciationRule(
      orgId,
      scenarioId,
      ruleId,
      body,
    );
  }

  async deleteScenarioDepreciationRule(
    orgId: string,
    scenarioId: string,
    ruleId: string,
  ) {
    return this.depreciationSupport.deleteScenarioDepreciationRule(
      orgId,
      scenarioId,
      ruleId,
    );
  }

  async getScenarioClassAllocations(orgId: string, scenarioId: string) {
    return this.depreciationSupport.getScenarioClassAllocations(orgId, scenarioId);
  }

  async updateScenarioClassAllocations(
    orgId: string,
    scenarioId: string,
    body: ScenarioClassAllocationInput,
  ) {
    return this.depreciationSupport.updateScenarioClassAllocations(
      orgId,
      scenarioId,
      body,
    );
  }

  async createForecastScenario(
    orgId: string,
    body: {
      name?: string;
      talousarvioId?: string;
      horizonYears?: number;
      copyFromScenarioId?: string;
      scenarioType?: ScenarioType;
      compute?: boolean;
    },
  ) {
    return this.scenarioSupport.createForecastScenario(orgId, body);
  }

  async getForecastScenario(orgId: string, scenarioId: string) {
    const projection = (await this.projectionsService.findById(
      orgId,
      scenarioId,
    )) as any;
    return this.mapScenarioPayload(orgId, projection);
  }

  async updateForecastScenario(
    orgId: string,
    scenarioId: string,
    body: {
      name?: string;
      horizonYears?: number;
      scenarioType?: ScenarioType;
      yearlyInvestments?: Array<{ year: number; amount: number }>;
      scenarioAssumptions?: Partial<Record<ScenarioAssumptionKey, number>>;
      nearTermExpenseAssumptions?: Array<{
        year: number;
        personnelPct?: number;
        energyPct?: number;
        opexOtherPct?: number;
      }>;
      thereafterExpenseAssumptions?: {
        personnelPct?: number;
        energyPct?: number;
        opexOtherPct?: number;
      };
    },
  ) {
    return this.scenarioSupport.updateForecastScenario(orgId, scenarioId, body);
  }

  async deleteForecastScenario(orgId: string, scenarioId: string) {
    return this.scenarioSupport.deleteForecastScenario(orgId, scenarioId);
  }

  async computeForecastScenario(orgId: string, scenarioId: string) {
    return this.computationSupport.computeForecastScenario(orgId, scenarioId);
  }


  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private normalizeNonNegativeNullable(value: number | null): number | null {
    if (value == null) return null;
    return this.round2(Math.max(0, value));
  }

  private summaryValuesDiffer(
    left: number | null,
    right: number | null,
  ): boolean {
    if (left == null && right == null) return false;
    if (left == null || right == null) return true;
    return Math.abs(left - right) > 0.005;
  }

  private computeCombinedPrice(
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

  private normalizeYearOverrides(
    raw: unknown,
  ): Record<number, Record<string, unknown>> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<number, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const year = Number.parseInt(key, 10);
      if (!Number.isFinite(year) || !value || typeof value !== 'object')
        continue;
      out[year] = { ...(value as Record<string, unknown>) };
    }
    return out;
  }

  private normalizeUserInvestments(
    raw: unknown,
  ): YearlyInvestment[] {
    if (!Array.isArray(raw)) return [];
    const normalized: YearlyInvestment[] = [];
    for (const [index, item] of raw.entries()) {
      if (!item || typeof item !== 'object') continue;
      const year = Math.round(Number((item as { year?: unknown }).year));
      const amount = Number((item as { amount?: unknown }).amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;
      const rowIdRaw = this.normalizeText(
        typeof (item as { rowId?: unknown }).rowId === 'string'
          ? (item as { rowId?: string }).rowId
          : null,
      );
      const category = this.normalizeText(
        typeof (item as { category?: unknown }).category === 'string'
          ? (item as { category?: string }).category
          : null,
      );
      const depreciationClassKey = this.normalizeText(
        typeof (item as { depreciationClassKey?: unknown }).depreciationClassKey ===
          'string'
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
                (depreciationRuleSnapshotRaw as { assetClassKey?: unknown })
                  .assetClassKey ?? '',
              ).trim(),
              assetClassName: this.normalizeText(
                typeof (depreciationRuleSnapshotRaw as { assetClassName?: unknown })
                  .assetClassName === 'string'
                  ? (depreciationRuleSnapshotRaw as { assetClassName?: string })
                      .assetClassName
                  : null,
              ),
              method: String(
                (depreciationRuleSnapshotRaw as { method?: unknown }).method ?? 'none',
              ) as DepreciationMethod,
              linearYears:
                (depreciationRuleSnapshotRaw as { linearYears?: unknown }).linearYears ==
                null
                  ? null
                  : Math.round(
                      this.toNumber(
                        (depreciationRuleSnapshotRaw as { linearYears?: unknown })
                          .linearYears,
                      ),
                    ),
              residualPercent:
                (depreciationRuleSnapshotRaw as { residualPercent?: unknown })
                  .residualPercent == null
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
                (depreciationRuleSnapshotRaw as { annualSchedule?: unknown })
                  .annualSchedule,
              )
                ? (
                    (depreciationRuleSnapshotRaw as { annualSchedule?: unknown[] })
                      .annualSchedule ?? []
                  ).map((value) => this.round2(this.toNumber(value)))
                : null,
            }
          : null;
      const target = this.normalizeText(
        typeof (item as { target?: unknown }).target === 'string'
          ? (item as { target?: string }).target
          : null,
      );
      const investmentTypeRaw = this.normalizeText(
        typeof (item as { investmentType?: unknown }).investmentType === 'string'
          ? (item as { investmentType?: string }).investmentType
          : null,
      );
      const confidenceRaw = this.normalizeText(
        typeof (item as { confidence?: unknown }).confidence === 'string'
          ? (item as { confidence?: string }).confidence
          : null,
      );
      const note = this.normalizeText(
        typeof (item as { note?: unknown }).note === 'string'
          ? (item as { note?: string }).note
          : null,
      );
      const vesinvestPlanId = this.normalizeText(
        typeof (item as { vesinvestPlanId?: unknown }).vesinvestPlanId === 'string'
          ? (item as { vesinvestPlanId?: string }).vesinvestPlanId
          : null,
      );
      const vesinvestProjectId = this.normalizeText(
        typeof (item as { vesinvestProjectId?: unknown }).vesinvestProjectId ===
          'string'
          ? (item as { vesinvestProjectId?: string }).vesinvestProjectId
          : null,
      );
      const allocationId = this.normalizeText(
        typeof (item as { allocationId?: unknown }).allocationId === 'string'
          ? (item as { allocationId?: string }).allocationId
          : null,
      );
      const projectCode = this.normalizeText(
        typeof (item as { projectCode?: unknown }).projectCode === 'string'
          ? (item as { projectCode?: string }).projectCode
          : null,
      );
      const groupKey = this.normalizeText(
        typeof (item as { groupKey?: unknown }).groupKey === 'string'
          ? (item as { groupKey?: string }).groupKey
          : null,
      );
      const accountKey = this.normalizeText(
        typeof (item as { accountKey?: unknown }).accountKey === 'string'
          ? (item as { accountKey?: string }).accountKey
          : null,
      );
      const reportGroupKey = this.normalizeText(
        typeof (item as { reportGroupKey?: unknown }).reportGroupKey === 'string'
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

  private normalizeAssumptionOverrides(raw: unknown): Record<string, number> {
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

  private normalizeScenarioAssumptionOverrides(
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

  private normalizeThereafterExpenseAssumptions(raw: {
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

  private buildThereafterExpenseAssumptions(
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

  private buildYearOverrides(
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
        investmentEur: this.round2(
          this.toNumber(out[year]?.investmentEur) + amount,
        ),
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

  private normalizeNearTermExpenseAssumptions(
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

  private extractExplicitNearTermExpenseAssumptions(
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

  private buildNearTermExpenseAssumptions(
    baseYear: number | null,
    assumptions: Record<string, number>,
    rawOverrides: unknown,
  ): NearTermExpenseAssumption[] {
    if (baseYear == null) return [];
    const explicit = new Map(
      this.extractExplicitNearTermExpenseAssumptions(
        baseYear,
        rawOverrides,
      ).map((row) => [row.year, row]),
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

  private async mapScenarioPayload(
    orgId: string,
    projection: any,
  ): Promise<ScenarioPayload> {
    const scenarioDepreciationStorage =
      await this.ensureScenarioDepreciationStorage(orgId, projection);
    const years: ScenarioYear[] = (projection?.vuodet ?? []).map(
      (row: any): ScenarioYear => {
        const waterDrivers = this.extractWaterDriverPrices(
          row?.erittelyt?.ajurit ?? [],
        );
        const cashflow =
          typeof row?.kassafloede === 'number'
            ? row.kassafloede
            : this.toNumber(row?.tulos) -
              this.toNumber(row?.investoinnitYhteensa);
        const cumulativeCashflow =
          typeof row?.ackumuleradKassa === 'number' ? row.ackumuleradKassa : 0;

        return {
          year: Number(row.vuosi),
          revenue: this.toNumber(row.tulotYhteensa),
          costs: this.toNumber(row.kulutYhteensa),
          result: this.toNumber(row.tulos),
          investments: this.toNumber(row.investoinnitYhteensa),
          baselineDepreciation: this.toNumber(row.poistoPerusta),
          investmentDepreciation: this.toNumber(row.poistoInvestoinneista),
          totalDepreciation: this.round2(
            this.toNumber(row.poistoPerusta) +
              this.toNumber(row.poistoInvestoinneista),
          ),
          combinedPrice: this.toNumber(row.vesihinta),
          soldVolume: this.toNumber(row.myytyVesimaara),
          cashflow: this.round2(cashflow),
          cumulativeCashflow: this.round2(cumulativeCashflow),
          waterPrice: waterDrivers.water,
          wastewaterPrice: waterDrivers.wastewater,
          baseFeeRevenue: waterDrivers.baseFeeRevenue,
          connectionCount: waterDrivers.connectionCount,
        };
      },
    );

    const baseYear = projection?.talousarvio?.vuosi ?? years[0]?.year ?? null;
    const latestComparablePriceTodayCombined =
      await this.resolveLatestComparableBaselinePrice(orgId);
    const baselinePriceTodayCombined =
      latestComparablePriceTodayCombined ?? years[0]?.combinedPrice ?? null;
    const requiredPriceTodayCombinedAnnualResult =
      this.computeRequiredPriceForZeroResult(years[0]);
    const requiredPriceTodayCombinedCumulativeCash =
      typeof projection?.requiredTariff === 'number'
        ? projection.requiredTariff
        : null;
    const requiredPriceTodayCombined =
      requiredPriceTodayCombinedAnnualResult ??
      requiredPriceTodayCombinedCumulativeCash;

    const annualRiseFromPath =
      years.length >= 2 && years[0].combinedPrice > 0
        ? (years[1].combinedPrice / years[0].combinedPrice - 1) * 100
        : null;

    const requiredRiseFromAnnualResult =
      baselinePriceTodayCombined != null &&
      baselinePriceTodayCombined > 0 &&
      requiredPriceTodayCombinedAnnualResult != null &&
      requiredPriceTodayCombinedAnnualResult >= 0
        ? (requiredPriceTodayCombinedAnnualResult / baselinePriceTodayCombined -
            1) *
          100
        : null;

    const requiredRiseFromCumulativeCash =
      baselinePriceTodayCombined != null &&
      baselinePriceTodayCombined > 0 &&
      requiredPriceTodayCombinedCumulativeCash != null &&
      requiredPriceTodayCombinedCumulativeCash >= 0
        ? (requiredPriceTodayCombinedCumulativeCash /
            baselinePriceTodayCombined -
            1) *
          100
        : null;

    const requiredAnnualIncreasePctAnnualResult = requiredRiseFromAnnualResult;
    const requiredAnnualIncreasePctCumulativeCash =
      requiredRiseFromCumulativeCash;

    const requiredAnnualIncreasePct =
      requiredRiseFromAnnualResult ??
      requiredRiseFromCumulativeCash ??
      annualRiseFromPath;
    const annualResultUnderfundingStartYear =
      years.find((item) => item.result < 0)?.year ?? null;
    const cumulativeCashUnderfundingStartYear =
      years.find((item) => item.cumulativeCashflow < 0)?.year ?? null;
    const peakAnnualDeficit = this.round2(
      Math.max(
        0,
        ...years.map((item) => Math.max(0, -this.toNumber(item.result))),
      ),
    );
    const peakCumulativeGap = this.round2(
      Math.max(
        0,
        ...years.map((item) => Math.max(0, -this.toNumber(item.cumulativeCashflow))),
      ),
    );

    const assumptionDefaults = await this.prisma.olettamus.findMany({
      where: { orgId },
      select: { avain: true, arvo: true },
    });

    const assumptions: Record<string, number> = {};
    for (const row of assumptionDefaults) {
      assumptions[row.avain] = this.toNumber(row.arvo);
    }
    for (const [key, value] of Object.entries(
      (projection?.olettamusYlikirjoitukset ?? {}) as Record<string, unknown>,
    )) {
      if (key === SCENARIO_TYPE_OVERRIDE_KEY) continue;
      assumptions[key] = this.toNumber(value);
    }

    const yearlyInvestments = this.buildYearlyInvestments(projection, baseYear);
    const nearTermExpenseAssumptions = this.buildNearTermExpenseAssumptions(
      baseYear,
      assumptions,
      projection?.vuosiYlikirjoitukset ?? {},
    );
    const thereafterExpenseAssumptions =
      this.buildThereafterExpenseAssumptions(assumptions);

    void scenarioDepreciationStorage;
    const scenarioType = this.resolveScenarioType(
      projection?.olettamusYlikirjoitukset,
      Boolean(projection?.onOletus),
    );

    return {
      id: projection.id,
      name: this.normalizeText(projection.nimi) ?? projection.nimi,
      onOletus: Boolean(projection.onOletus),
      scenarioType,
      talousarvioId: projection.talousarvioId,
      baselineYear: baseYear,
      horizonYears: this.toNumber(projection.aikajaksoVuosia),
      assumptions,
      yearlyInvestments,
      nearTermExpenseAssumptions,
      thereafterExpenseAssumptions,
      requiredPriceTodayCombined,
      baselinePriceTodayCombined,
      requiredAnnualIncreasePct,
      requiredPriceTodayCombinedAnnualResult,
      requiredAnnualIncreasePctAnnualResult,
      requiredPriceTodayCombinedCumulativeCash,
      requiredAnnualIncreasePctCumulativeCash,
      feeSufficiency: {
        baselineCombinedPrice: baselinePriceTodayCombined,
        annualResult: {
          requiredPriceToday: requiredPriceTodayCombinedAnnualResult,
          requiredAnnualIncreasePct: requiredAnnualIncreasePctAnnualResult,
          underfundingStartYear: annualResultUnderfundingStartYear,
          peakDeficit: peakAnnualDeficit,
        },
        cumulativeCash: {
          requiredPriceToday: requiredPriceTodayCombinedCumulativeCash,
          requiredAnnualIncreasePct: requiredAnnualIncreasePctCumulativeCash,
          underfundingStartYear: cumulativeCashUnderfundingStartYear,
          peakGap: peakCumulativeGap,
        },
      },
      years,
      priceSeries: years.map((item) => ({
        year: item.year,
        combinedPrice: item.combinedPrice,
        waterPrice: item.waterPrice,
        wastewaterPrice: item.wastewaterPrice,
      })),
      investmentSeries: years.map((item) => ({
        year: item.year,
        amount: item.investments,
      })),
      cashflowSeries: years.map((item) => ({
        year: item.year,
        cashflow: item.cashflow,
        cumulativeCashflow: item.cumulativeCashflow,
      })),
      computedAt: projection.computedAt ?? null,
      computedFromUpdatedAt: projection.computedFromUpdatedAt ?? null,
      updatedAt: projection.updatedAt,
      createdAt: projection.createdAt,
    };
  }

  private extractWaterDriverPrices(rows: Array<Record<string, unknown>>) {
    let water = 0;
    let wastewater = 0;
    let baseFeeRevenue = 0;
    let connectionCount = 0;
    for (const row of rows) {
      const service = String(row.palvelutyyppi ?? '');
      const price = this.toNumber(row.yksikkohinta);
      const baseFee = this.toNumber(row.perusmaksu);
      const connections = this.toNumber(row.liittymamaara);
      if (service === 'vesi') water = price;
      if (service === 'jatevesi') wastewater = price;
      baseFeeRevenue = this.round2(baseFeeRevenue + baseFee * connections);
      connectionCount = this.round2(connectionCount + connections);
    }
    return { water, wastewater, baseFeeRevenue, connectionCount };
  }

  private computeRequiredPriceForZeroResult(
    firstYear: ScenarioYear | undefined,
  ): number | null {
    if (!firstYear) return null;
    const volume = this.toNumber(firstYear.soldVolume);
    if (!Number.isFinite(volume) || volume <= 0) return null;

    const baseVolumeRevenue =
      this.toNumber(firstYear.combinedPrice) *
      this.toNumber(firstYear.soldVolume);
    const nonVolumeRevenue = this.round2(
      this.toNumber(firstYear.revenue) - baseVolumeRevenue,
    );
    const requiredCombinedPrice =
      (this.toNumber(firstYear.costs) - nonVolumeRevenue) / volume;

    return this.round2(Math.max(0, requiredCombinedPrice));
  }

  private async resolveLatestComparableBaselinePrice(
    orgId: string,
  ): Promise<number | null> {
    const [importStatus, trendSeries] = await Promise.all([
      this.getImportStatus(orgId),
      this.getTrendSeries(orgId),
    ]);

    const latestComparableYear =
      this.resolveLatestComparableYear(
        this.resolveWorkspaceYearRows(importStatus),
      ) ??
      (() => {
        const latestIndex = this.resolveLatestDataIndex(trendSeries);
        return latestIndex >= 0 ? trendSeries[latestIndex]?.year ?? null : null;
      })();

    if (latestComparableYear == null) return null;
    const point = trendSeries.find(
      (row: TrendPoint) => row.year === latestComparableYear,
    );
    if (!point) return null;
    return this.round2(this.toNumber(point.combinedPrice));
  }

  private buildYearlyInvestments(
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

  private mapDepreciationRule(row: any) {
    const method = toCanonicalDepreciationMethod(String(row.method ?? '')) ?? 'none';
    return {
      id: row.id,
      assetClassKey: String(row.assetClassKey ?? ''),
      assetClassName: this.resolveAuthoritativeDepreciationClassName(
        String(row.assetClassKey ?? ''),
        this.normalizeText(row.assetClassName) ?? null,
      ),
      method,
      linearYears:
        row.linearYears == null
          ? null
          : Math.round(this.toNumber(row.linearYears)),
      residualPercent:
        row.residualPercent == null
          ? null
          : this.round2(this.toNumber(row.residualPercent)),
      annualSchedule: Array.isArray(row.annualSchedule)
        ? row.annualSchedule.map((item: unknown) =>
            this.round2(this.toNumber(item)),
          )
        : null,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
    };
  }

  private mapScenarioDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    const now = new Date().toISOString();
    return {
      id: rule.id,
      assetClassKey: rule.assetClassKey,
      assetClassName: this.resolveAuthoritativeDepreciationClassName(
        rule.assetClassKey,
        rule.assetClassName,
      ),
      method: rule.method,
      linearYears: rule.linearYears,
      residualPercent: rule.residualPercent,
      annualSchedule: rule.annualSchedule,
      updatedAt: now,
      createdAt: now,
    };
  }

  private snapshotDepreciationRule(rule: ScenarioStoredDepreciationRule) {
    return {
      assetClassKey: rule.assetClassKey,
      assetClassName: this.resolveAuthoritativeDepreciationClassName(
        rule.assetClassKey,
        rule.assetClassName,
      ),
      method: rule.method,
      linearYears: rule.linearYears,
      residualPercent: rule.residualPercent,
      annualSchedule: rule.annualSchedule ?? null,
    };
  }

  private async ensureScenarioDepreciationStorage(
    orgId: string,
    projection: any,
  ): Promise<{
    baselineDepreciation: ScenarioBaselineDepreciationRow[];
    rules: ScenarioStoredDepreciationRule[];
  }> {
    const baselineDepreciation = this.normalizeScenarioBaselineDepreciation(
      projection?.baselineDepreciation,
    );
    const rules = this.normalizeScenarioStoredDepreciationRules(
      projection?.scenarioDepreciationRules,
    );

    const nextData: Record<string, unknown> = {};
    let nextBaseline = baselineDepreciation;
    let nextRules = rules;

    if (projection?.baselineDepreciation == null) {
      nextBaseline = this.buildScenarioBaselineDepreciationSeed(projection);
      if (nextBaseline.length > 0) {
        nextData.baselineDepreciation = nextBaseline;
      }
    }

    if (
      projection?.scenarioDepreciationRules == null ||
      (Array.isArray(projection?.scenarioDepreciationRules) &&
        projection.scenarioDepreciationRules.length === 0)
    ) {
      nextRules = await this.buildScenarioDepreciationRuleSeed(orgId);
      nextData.scenarioDepreciationRules = nextRules;
    }

    if (Object.keys(nextData).length > 0 && projection?.id) {
      await (this.prisma.ennuste as any).updateMany({
        where: { id: projection.id, orgId },
        data: nextData,
      });
    }

    return {
      baselineDepreciation: nextBaseline,
      rules: nextRules,
    };
  }

  private async saveScenarioDepreciationRules(
    orgId: string,
    scenarioId: string,
    rules: ScenarioStoredDepreciationRule[],
  ) {
    await (this.prisma.ennuste as any).updateMany({
      where: { id: scenarioId, orgId },
      data: {
        scenarioDepreciationRules: rules,
        computedAt: null,
        computedFromUpdatedAt: null,
      },
    });
  }

  private async buildScenarioDepreciationRuleSeed(
    orgId: string,
  ): Promise<ScenarioStoredDepreciationRule[]> {
    const delegate = (this.prisma as any).organizationDepreciationRule;
    const rows = delegate?.findMany
      ? await delegate.findMany({
          where: { orgId },
          orderBy: [{ assetClassKey: 'asc' }],
        })
      : [];
    const merged = new Map<string, ScenarioStoredDepreciationRule>();
    const authoritativeClassKeys = new Set(
      DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group) => group.key),
    );

    for (const rule of PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS) {
      merged.set(rule.assetClassKey, {
        ...rule,
      });
    }

    for (const group of DEFAULT_VESINVEST_GROUP_DEFINITIONS) {
      const legacyRule =
        merged.get(VESINVEST_LEGACY_DEPRECIATION_RULE_KEY_BY_GROUP_KEY[group.key]) ?? null;
      if (!legacyRule) {
        continue;
      }
      merged.set(group.key, {
        ...legacyRule,
        id: group.key,
        assetClassKey: group.key,
        assetClassName: group.label,
      });
    }

    const explicitClassKeys = new Set<string>();
    for (const row of rows as Array<{ assetClassKey?: unknown }>) {
      const assetClassKey = String(row.assetClassKey ?? '').trim();
      if (authoritativeClassKeys.has(assetClassKey)) {
        explicitClassKeys.add(assetClassKey);
      }
    }
    const sortedRows = [...rows].sort((left, right) => {
      const leftIsClass = authoritativeClassKeys.has(
        String(left.assetClassKey ?? '').trim(),
      );
      const rightIsClass = authoritativeClassKeys.has(
        String(right.assetClassKey ?? '').trim(),
      );
      if (leftIsClass === rightIsClass) {
        return String(left.assetClassKey ?? '').localeCompare(
          String(right.assetClassKey ?? ''),
        );
      }
      return leftIsClass ? 1 : -1;
    });

    for (const row of sortedRows) {
      const assetClassKey = String(row.assetClassKey ?? '').trim();
      if (!assetClassKey) continue;
      const isExplicitClassRule = authoritativeClassKeys.has(assetClassKey);
      const targetKeys = new Set<string>([
        assetClassKey,
        ...expandLegacyDepreciationRuleKeyToVesinvestClasses(assetClassKey),
      ]);
      for (const targetKey of targetKeys) {
        if (!isExplicitClassRule && explicitClassKeys.has(targetKey)) {
          continue;
        }
        const classLabel =
          DEFAULT_VESINVEST_GROUP_DEFINITIONS.find((group) => group.key === targetKey)
            ?.label ?? null;
        merged.set(targetKey, {
          id: targetKey,
          assetClassKey: targetKey,
          assetClassName:
            classLabel ?? this.normalizeText(row.assetClassName) ?? null,
          method:
            toCanonicalDepreciationMethod(String(row.method ?? '')) ?? 'none',
          linearYears:
            row.linearYears == null
              ? null
              : Math.round(this.toNumber(row.linearYears)),
          residualPercent:
            row.residualPercent == null
              ? null
              : this.round2(this.toNumber(row.residualPercent)),
          annualSchedule: null,
        });
      }
    }

    return [...merged.values()];
  }

  private buildScenarioBaselineDepreciationSeed(
    projection: any,
  ): ScenarioBaselineDepreciationRow[] {
    if (!Array.isArray(projection?.vuodet)) return [];
    return projection.vuodet
      .map((row: any) => ({
        year: Math.round(this.toNumber(row?.vuosi)),
        amount: this.round2(this.toNumber(row?.poistoPerusta)),
      }))
      .filter(
        (row: ScenarioBaselineDepreciationRow) =>
          Number.isFinite(row.year) && Number.isFinite(row.amount),
      );
  }

  private normalizeScenarioBaselineDepreciation(
    raw: unknown,
  ): ScenarioBaselineDepreciationRow[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => {
        if (!row || typeof row !== 'object') return null;
        const payload = row as Record<string, unknown>;
        const year = Math.round(this.toNumber(payload.year));
        const amount = this.round2(this.toNumber(payload.amount));
        if (!Number.isFinite(year) || !Number.isFinite(amount)) return null;
        return { year, amount };
      })
      .filter(
        (
          row,
        ): row is ScenarioBaselineDepreciationRow =>
          row != null,
      );
  }

  private normalizeScenarioStoredDepreciationRules(
    raw: unknown,
  ): ScenarioStoredDepreciationRule[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const assetClassKey = (
          this.normalizeText(
            typeof row.assetClassKey === 'string' ? row.assetClassKey : null,
          ) ?? ''
        ).trim();
        const method = (
          this.normalizeText(
            typeof row.method === 'string' ? row.method : null,
          ) ?? ''
        ).toLowerCase();
        const canonicalMethod = toCanonicalDepreciationMethod(method);
        if (!assetClassKey) return null;
        if (!canonicalMethod) {
          return null;
        }
        return {
          id:
            (
              this.normalizeText(
                typeof row.id === 'string' ? row.id : null,
              ) ?? assetClassKey
            ).trim() || assetClassKey,
          assetClassKey,
          assetClassName: this.normalizeText(
            typeof row.assetClassName === 'string' ? row.assetClassName : null,
          ) ?? null,
          method: canonicalMethod,
          linearYears:
            row.linearYears == null
              ? null
              : Math.round(this.toNumber(row.linearYears)),
          residualPercent:
            row.residualPercent == null
              ? null
              : this.round2(this.toNumber(row.residualPercent)),
          annualSchedule:
            Array.isArray(row.annualSchedule) &&
            row.annualSchedule.every((item) => Number.isFinite(Number(item)))
              ? row.annualSchedule.map((item) =>
                  this.round2(this.toNumber(item)),
                )
              : null,
        };
      })
      .filter(
        (
          row,
        ): row is ScenarioStoredDepreciationRule =>
          row != null,
      );
  }

  private normalizeDepreciationRuleInput(input: DepreciationRuleInput): {
    id: string;
    assetClassKey: string;
    assetClassName: string | null;
    method: ScenarioStoredDepreciationRule['method'];
    linearYears: number | null;
    residualPercent: number | null;
    annualSchedule: number[] | null;
  } {
    const assetClassKeyRaw = this.normalizeText(input.assetClassKey) ?? '';
    const assetClassKey = assetClassKeyRaw.trim();
    if (!assetClassKey) {
      throw new BadRequestException('assetClassKey is required.');
    }

    const method = String(input.method ?? '')
      .trim()
      .toLowerCase();
    if (method !== 'residual' && method !== 'straight-line' && method !== 'none') {
      throw new BadRequestException(
        'method must be one of: residual, straight-line, none.',
      );
    }

    let linearYears: number | null = null;
    let residualPercent: number | null = null;
    if (method === 'straight-line') {
      const parsedYears = Math.round(this.toNumber(input.linearYears));
      if (
        !Number.isFinite(parsedYears) ||
        parsedYears < 1 ||
        parsedYears > 120
      ) {
        throw new BadRequestException(
          'linearYears must be between 1 and 120 for straight-line method.',
        );
      }
      linearYears = parsedYears;
    }

    if (method === 'residual') {
      const parsedResidual = this.round2(this.toNumber(input.residualPercent));
      if (
        !Number.isFinite(parsedResidual) ||
        parsedResidual < 0 ||
        parsedResidual > 100
      ) {
        throw new BadRequestException(
          'residualPercent must be between 0 and 100 for residual method.',
        );
      }
      residualPercent = parsedResidual;
    }

    const classNameRaw = this.normalizeText(input.assetClassName) ?? null;
    const assetClassName = classNameRaw ? classNameRaw.trim() : null;

    return {
      id: assetClassKey,
      assetClassKey,
      assetClassName:
        assetClassName && assetClassName.length > 0 ? assetClassName : null,
      method,
      linearYears,
      residualPercent,
      annualSchedule: null,
    };
  }

  private scenarioAllocationRecordFromArray(
    allocations: Array<{ classKey?: string; sharePct?: number }>,
  ): Record<string, unknown> {
    const map = new Map<string, number>();
    for (const row of allocations) {
      const classKeyRaw = this.normalizeText(row.classKey) ?? '';
      const classKey = classKeyRaw.trim();
      if (!classKey) continue;
      const sharePct = this.round2(this.toNumber(row.sharePct));
      if (!Number.isFinite(sharePct) || sharePct < 0 || sharePct > 100) {
        throw new BadRequestException(
          `sharePct must be between 0 and 100 for class "${classKey}".`,
        );
      }
      map.set(classKey, sharePct);
    }
    const total = [...map.values()].reduce((sum, value) => sum + value, 0);
    if (total > 100.01) {
      throw new BadRequestException(
        'Class allocation percentages cannot exceed 100%.',
      );
    }
    return Object.fromEntries(map.entries());
  }

  private normalizeScenarioYearAllocations(
    raw: Record<string, unknown>,
  ): Array<{ classKey: string; sharePct: number }> {
    const out: Array<{ classKey: string; sharePct: number }> = [];
    for (const [classKey, shareValue] of Object.entries(raw)) {
      const key = classKey.trim();
      if (!key) continue;
      const sharePct = this.round2(this.toNumber(shareValue));
      if (!Number.isFinite(sharePct) || sharePct <= 0) continue;
      out.push({ classKey: key, sharePct });
    }
    return out.sort((a, b) => a.classKey.localeCompare(b.classKey));
  }

  private isPrismaUniqueError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private resolveLatestDataIndex(points: TrendPoint[]): number {
    if (points.length === 0) return -1;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index]!;
      if (
        this.toNumber(point.revenue) !== 0 ||
        this.toNumber(point.costs) !== 0 ||
        this.toNumber(point.result) !== 0 ||
        this.toNumber(point.volume) !== 0
      ) {
        return index;
      }
    }
    return points.length - 1;
  }

  private resolveLatestComparableYear(
    years:
      | Array<{
          vuosi: number;
          completeness?: {
            tilinpaatos?: boolean;
            volume_vesi?: boolean;
            volume_jatevesi?: boolean;
          };
        }>
      | undefined,
  ): number | null {
    if (!Array.isArray(years) || years.length === 0) return null;
    let latestComplete: number | null = null;
    let latestWithTilinpaatos: number | null = null;
    for (const row of years) {
      const year = Number(row?.vuosi);
      if (!Number.isFinite(year)) continue;
      const hasTilinpaatos = row?.completeness?.tilinpaatos === true;
      const hasVolume =
        row?.completeness?.volume_vesi === true ||
        row?.completeness?.volume_jatevesi === true;

      if (
        hasTilinpaatos &&
        (latestWithTilinpaatos == null || year > latestWithTilinpaatos)
      ) {
        latestWithTilinpaatos = year;
      }
      if (
        hasTilinpaatos &&
        hasVolume &&
        (latestComplete == null || year > latestComplete)
      ) {
        latestComplete = year;
      }
    }
    return latestComplete ?? latestWithTilinpaatos;
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

  private resolveAuthoritativeDepreciationClassName(
    assetClassKey: string | null | undefined,
    fallbackName: string | null | undefined,
  ): string | null {
    const normalizedKey = String(assetClassKey ?? '').trim();
    if (normalizedKey.length > 0) {
      const authoritativeLabel =
        DEFAULT_VESINVEST_GROUP_DEFINITIONS.find(
          (group) => group.key === normalizedKey,
        )?.label ?? null;
      if (authoritativeLabel) {
        return authoritativeLabel;
      }
    }
    const normalizedFallback = this.normalizeText(fallbackName ?? null);
    return normalizedFallback && normalizedFallback.length > 0
      ? normalizedFallback
      : null;
  }

  private normalizeScenarioType(raw: unknown): ScenarioType {
    if (
      raw === 'base' ||
      raw === 'committed' ||
      raw === 'hypothesis' ||
      raw === 'stress'
    ) {
      return raw;
    }
    return 'hypothesis';
  }

  private resolveScenarioType(
    rawOverrides: unknown,
    onOletus: boolean,
  ): ScenarioType {
    if (onOletus) {
      return 'base';
    }
    if (!rawOverrides || typeof rawOverrides !== 'object') {
      return 'hypothesis';
    }
    const rawCode = Number(
      (rawOverrides as Record<string, unknown>)[SCENARIO_TYPE_OVERRIDE_KEY],
    );
    return SCENARIO_TYPE_CODE_TO_VALUE[rawCode] ?? 'hypothesis';
  }

  private resolveScenarioTypeForCreate(params: {
    requestedScenarioType?: ScenarioType;
    existingBaseScenarioExists: boolean;
    sourceScenarioType: ScenarioType | null;
  }): ScenarioType {
    const { requestedScenarioType, existingBaseScenarioExists, sourceScenarioType } =
      params;
    const normalizedRequested =
      requestedScenarioType == null
        ? null
        : this.normalizeScenarioType(requestedScenarioType);
    if (normalizedRequested === 'base') {
      if (existingBaseScenarioExists) {
        throw new BadRequestException('Base scenario already exists.');
      }
      return 'base';
    }
    if (normalizedRequested) {
      return normalizedRequested;
    }
    if (!existingBaseScenarioExists) {
      return 'base';
    }
    if (sourceScenarioType && sourceScenarioType !== 'base') {
      return sourceScenarioType;
    }
    return 'hypothesis';
  }

  private withScenarioTypeOverride(
    overrides: Record<string, number> | undefined,
    scenarioType: ScenarioType,
  ): Record<string, number> {
    const next = { ...(overrides ?? {}) };
    if (scenarioType === 'base') {
      delete next[SCENARIO_TYPE_OVERRIDE_KEY];
      return next;
    }
    next[SCENARIO_TYPE_OVERRIDE_KEY] =
      SCENARIO_TYPE_VALUE_TO_CODE[scenarioType];
    return next;
  }

  private normalizeNearTermPct(
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
