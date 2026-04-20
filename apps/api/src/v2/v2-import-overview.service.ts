import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { createV2ImportManualPatchSupport } from './v2-import-manual-patch-support';
import { createV2ImportWorkspaceSupport } from './v2-import-workspace-support';
import { createV2OverviewReadModelSupport } from './v2-overview-read-model-support';
import { V2PlanningWorkspaceSupport } from './v2-planning-workspace-support';
import { buildV2ReportPdf } from './v2-report-pdf';

type SyncRequirement =
  | 'financials'
  | 'prices'
  | 'volumes'
  | 'tariffRevenue';
type BaselineMissingRequirement =
  | 'financialBaseline'
  | 'prices'
  | 'volumes';
type BaselineWarning = 'tariffRevenueMismatch';
type TariffRevenueReason = 'missing_fixed_revenue' | 'mismatch';
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
  | 'perusmaksuYhteensa'
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
    | 'document_import'
    | 'workbook_import'
    | 'mixed_source'
    | 'incomplete_source'
    | 'result_changed'
  >;
  changedSummaryKeys: ImportYearSummaryFieldKey[];
  statementImport: OverrideProvenance | null;
  documentImport?: OverrideProvenance | null;
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
    | 'perusmaksuYhteensa'
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
  { payloadKey: 'perusmaksuYhteensa', sourceField: 'PerusmaksuYhteensa' },
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
export class V2ImportOverviewService {
  protected readonly logger = new Logger(V2ImportOverviewService.name);
  private readonly planningWorkspaceSupport: V2PlanningWorkspaceSupport;
  private readonly workspaceSupport: any;
  private readonly manualPatchSupport: any;
  private readonly overviewReadModelSupport: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
    private readonly veetiSanityService: VeetiSanityService,
  ) {
    this.planningWorkspaceSupport = new V2PlanningWorkspaceSupport(prisma);
    const ctx = this as any;
    this.workspaceSupport = createV2ImportWorkspaceSupport(ctx);
    this.manualPatchSupport = createV2ImportManualPatchSupport(ctx);
    this.overviewReadModelSupport = createV2OverviewReadModelSupport(ctx);
  }

  private mapVeetiUiLanguage(
    kieliId: number | null | undefined,
  ): 'fi' | 'sv' | null {
    if (kieliId === 1) return 'fi';
    if (kieliId === 2) return 'sv';
    return null;
  }

  private async resolveVeetiOrgLanguage(
    veetiId: number | null | undefined,
  ): Promise<{ kieliId: number | null; uiLanguage: 'fi' | 'sv' | null }> {
    if (!Number.isInteger(veetiId)) {
      return { kieliId: null, uiLanguage: null };
    }
    if (typeof this.veetiService.getOrganizationById !== 'function') {
      return { kieliId: null, uiLanguage: null };
    }
    const org = await this.veetiService.getOrganizationById(Number(veetiId));
    const kieliId =
      typeof org?.Kieli_Id === 'number' && Number.isFinite(org.Kieli_Id)
        ? org.Kieli_Id
        : null;
    return {
      kieliId,
      uiLanguage: this.mapVeetiUiLanguage(kieliId),
    };
  }

  async searchOrganizations(query: string, limit: number) {
    return this.workspaceSupport.searchOrganizations(query, limit);
  }

  async connectOrganization(orgId: string, veetiId: number) {
    return this.workspaceSupport.connectOrganization(orgId, veetiId);
  }

  async getBoundUtilityIdentity(orgId: string) {
    return this.workspaceSupport.getBoundUtilityIdentity(orgId);
  }

  async importYears(orgId: string, years: number[]) {
    return this.workspaceSupport.importYears(orgId, years);
  }

  async createPlanningBaseline(orgId: string, years: number[]) {
    return this.workspaceSupport.createPlanningBaseline(orgId, years);
  }

  async syncImport(orgId: string, years: number[]) {
    return this.workspaceSupport.syncImport(orgId, years);
  }

  async removeImportedYear(orgId: string, year: number) {
    return this.workspaceSupport.removeImportedYear(orgId, year);
  }

  async removeImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.removeImportedYears(orgId, years);
  }

  async excludeImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.excludeImportedYears(orgId, years);
  }

  async restoreImportedYears(orgId: string, years: number[]) {
    return this.workspaceSupport.restoreImportedYears(orgId, years);
  }

  async getImportYearData(orgId: string, year: number) {
    return this.manualPatchSupport.getImportYearData(orgId, year);
  }

  async previewWorkbookImport(orgId: string, input: WorkbookPreviewRequest): Promise<WorkbookPreviewResponse> {
    return this.manualPatchSupport.previewWorkbookImport(orgId, input);
  }

  async previewStatementImport(orgId: string, year: number, input: StatementPreviewRequest): Promise<StatementPreviewResponse> {
    return this.manualPatchSupport.previewStatementImport(orgId, year, input);
  }

  async reconcileImportYear(orgId: string, _userId: string, roles: string[], year: number, body: ImportYearReconcileDto) {
    return this.manualPatchSupport.reconcileImportYear(orgId, _userId, roles, year, body);
  }

  async clearImportAndScenarios(orgId: string, roles: string[], confirmToken?: string) {
    return this.manualPatchSupport.clearImportAndScenarios(
      orgId,
      roles,
      confirmToken,
    );
  }

  async completeImportYearManually(orgId: string, userId: string, roles: string[], body: ManualYearCompletionDto) {
    return this.manualPatchSupport.completeImportYearManually(orgId, userId, roles, body);
  }

  async trackOpsEvent(orgId: string, userId: string, roles: string[], body: OpsEventDto) {
    return this.overviewReadModelSupport.trackOpsEvent(orgId, userId, roles, body);
  }

  async getOpsFunnel(orgId: string, roles: string[]) {
    return this.overviewReadModelSupport.getOpsFunnel(orgId, roles);
  }

  async getImportStatus(orgId: string) {
    return this.overviewReadModelSupport.getImportStatus(orgId);
  }

  async getOverview(orgId: string) {
    return this.overviewReadModelSupport.getOverview(orgId);
  }

  async getPlanningContext(orgId: string) {
    return this.overviewReadModelSupport.getPlanningContext(orgId);
  }

  async refreshPeerSnapshot(orgId: string, requestedYear?: number) {
    return this.overviewReadModelSupport.refreshPeerSnapshot(orgId, requestedYear);
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
    yearDataset: Awaited<
      ReturnType<VeetiEffectiveDataService['getYearDataset']>
    >,
  ): BaselineSourceSummary {
    const yearStatus =
      importStatus.years.find((row) => row.vuosi === year) ?? null;
    const financials = this.buildBaselineDatasetSource(
      yearDataset,
      'tilinpaatos',
      'tilinpaatos',
    );
    const prices = this.buildBaselineDatasetSource(
      yearDataset,
      'taksa',
      'taksa',
    );
    const volumes = this.mergeBaselineDatasetSources(yearDataset, [
      'volume_vesi',
      'volume_jatevesi',
    ]);

    return {
      year,
      planningRole:
        yearStatus?.planningRole ?? this.resolvePlanningRole(year),
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

  private buildBaselineDatasetSource(
    yearDataset: Awaited<
      ReturnType<VeetiEffectiveDataService['getYearDataset']>
    >,
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
    yearDataset: Awaited<
      ReturnType<VeetiEffectiveDataService['getYearDataset']>
    >,
    dataTypes: string[],
  ): BaselineDatasetSource {
    const datasets = dataTypes
      .map(
        (dataType) =>
          yearDataset.datasets.find((row) => row.dataType === dataType) ?? null,
      )
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const source = datasets.some((row) => row.source === 'manual')
      ? 'manual'
      : datasets.some((row) => row.source === 'veeti')
        ? 'veeti'
        : 'none';
    const overrideMeta =
      [...datasets]
        .map((row) => row.overrideMeta)
        .filter(
          (
            row,
          ): row is NonNullable<(typeof datasets)[number]['overrideMeta']> =>
            row !== null,
        )
        .sort(
          (left, right) =>
            new Date(right.editedAt).getTime() -
            new Date(left.editedAt).getTime(),
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

  private buildKpi(value: number, previous: number | undefined) {
    return {
      value: this.round2(value),
      deltaYoY: previous == null ? null : this.round2(value - previous),
    };
  }

  private async buildPeerSnapshot(orgId: string, year: number | null) {
    if (!year) {
      return {
        year: null,
        available: false,
        reason: 'No VEETI years imported.',
      };
    }

    try {
      const [benchmarks, peerGroup] = await Promise.all([
        this.veetiBenchmarkService.getBenchmarksForYear(orgId, year),
        this.veetiBenchmarkService.getPeerGroup(orgId),
      ]);

      const metricOrder = [
        'liikevaihto_per_m3',
        'vesi_yksikkohinta',
        'jatevesi_yksikkohinta',
        'liikevaihto',
      ];
      const selectedMetrics = metricOrder
        .map((key) => benchmarks.metrics.find((item) => item.metricKey === key))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      return {
        year,
        available: true,
        kokoluokka: benchmarks.kokoluokka,
        orgCount: benchmarks.orgCount,
        peerCount: peerGroup.peerCount ?? peerGroup.peers.length,
        computedAt: benchmarks.computedAt,
        isStale: benchmarks.isStale,
        staleAfterDays: benchmarks.staleAfterDays,
        peers: peerGroup.peers.slice(0, 8).map((peer) => ({
          veetiId: peer.veetiId,
          nimi: this.normalizeText(peer.nimi),
          ytunnus: this.normalizeText(peer.ytunnus),
          kunta: this.normalizeText(peer.kunta),
        })),
        metrics: selectedMetrics,
      };
    } catch (error) {
      return {
        year,
        available: false,
        reason:
          error instanceof Error ? error.message : 'Peer data unavailable.',
      };
    }
  }

  private async resolveLatestAcceptedVeetiBudgetId(
    orgId: string,
  ): Promise<string | null> {
    if (!this.prisma.talousarvio?.findFirst) {
      return null;
    }
    const acceptedYears = await this.resolvePlanningBaselineYears(orgId, {
      persistRepair: true,
    });
    if (acceptedYears.length === 0) {
      return null;
    }
    const row = await this.prisma.talousarvio.findFirst({
      where: {
        orgId,
        lahde: 'veeti',
        OR: [
          { veetiVuosi: { in: acceptedYears } },
          { vuosi: { in: acceptedYears } },
        ],
      },
      orderBy: [
        { veetiVuosi: 'desc' },
        { vuosi: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private async resolveAcceptedPlanningBaselineBudgetIds(
    orgId: string,
  ): Promise<string[]> {
    if (!this.prisma.talousarvio?.findMany) {
      return [];
    }
    const acceptedYears = await this.resolvePlanningBaselineYears(orgId, {
      persistRepair: true,
    });
    if (acceptedYears.length === 0) {
      return [];
    }
    const rows = await this.prisma.talousarvio.findMany({
      where: {
        orgId,
        lahde: 'veeti',
        OR: [
          { veetiVuosi: { in: acceptedYears } },
          { vuosi: { in: acceptedYears } },
        ],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  private normalizeYears(years: number[]): number[] {
    const unique = new Set<number>();
    for (const raw of years) {
      const parsed = Math.round(Number(raw));
      if (Number.isFinite(parsed)) unique.add(parsed);
    }
    return [...unique].sort((a, b) => a - b);
  }

  private getCurrentPlanningYear(): number {
    return new Date().getFullYear();
  }

  private isFuturePlanningYear(year: number): boolean {
    return year > this.getCurrentPlanningYear();
  }

  private resolvePlanningRole(year: number): PlanningRole {
    return year === this.getCurrentPlanningYear()
      ? 'current_year_estimate'
      : 'historical';
  }

  private annotatePlanningYearRows<T extends { vuosi: number }>(
    yearRows: T[],
  ): Array<T & { planningRole: PlanningRole }> {
    return yearRows
      .filter((row) => !this.isFuturePlanningYear(row.vuosi))
      .map((row) => ({
        ...row,
        planningRole: this.resolvePlanningRole(row.vuosi),
      }));
  }

  private async hydrateYearRowsWithTariffRevenueReadiness<
    T extends {
      vuosi: number;
      completeness: Record<string, boolean>;
      missingRequirements?: SyncRequirement[];
    },
  >(
    orgId: string,
    yearRows: T[],
  ): Promise<
    Array<
      T & {
        tariffRevenueReason: TariffRevenueReason | null;
        baselineReady: boolean;
        baselineMissingRequirements: BaselineMissingRequirement[];
        baselineWarnings: BaselineWarning[];
      }
    >
  > {
    const getYearDataset =
      typeof this.veetiEffectiveDataService.getYearDataset === 'function'
        ? this.veetiEffectiveDataService.getYearDataset.bind(
            this.veetiEffectiveDataService,
          )
        : null;
    const hydrated = await Promise.all(
      yearRows.map(async (row) => {
        const yearDataset = getYearDataset
          ? await getYearDataset(orgId, row.vuosi)
          : null;
        const { completeness, tariffRevenueReason } =
          this.augmentCompletenessWithTariffRevenue(
            row.completeness ?? this.emptyCompleteness(),
            yearDataset,
          );
        const summaryRows = yearDataset
          ? this.buildImportYearSummaryRows(yearDataset)
          : [];
        const baselineReadiness = this.evaluateBaselineReadiness(
          completeness,
          yearDataset,
          summaryRows,
          tariffRevenueReason,
        );
        return {
          ...row,
          completeness,
          missingRequirements: this.resolveMissingSyncRequirements(completeness),
          tariffRevenueReason,
          ...baselineReadiness,
        };
      }),
    );
    return hydrated;
  }

  private evaluateBaselineReadiness(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
    summaryRows: ImportYearSummaryRow[],
    tariffRevenueReason: TariffRevenueReason | null,
  ): {
    baselineReady: boolean;
    baselineMissingRequirements: BaselineMissingRequirement[];
    baselineWarnings: BaselineWarning[];
  } {
    const summaryByField = new Map(
      summaryRows.map((row) => [row.sourceField, row]),
    );
    const revenueValue =
      summaryByField.get('Liikevaihto')?.effectiveValue ?? null;
    const financialBaselineReady =
      summaryRows.length > 0
        ? (
            [
              'Liikevaihto',
              'AineetJaPalvelut',
              'Henkilostokulut',
              'Poistot',
              'LiiketoiminnanMuutKulut',
            ] as const
          ).every(
            (field) => summaryByField.get(field)?.effectiveValue != null,
          ) && revenueValue != null && revenueValue > 0
        : completeness.tilinpaatos === true;

    const taksaRows =
      yearDataset?.datasets.find((row) => row.dataType === 'taksa')
        ?.effectiveRows ?? [];
    const waterVolumeRows =
      yearDataset?.datasets.find((row) => row.dataType === 'volume_vesi')
        ?.effectiveRows ?? [];
    const wastewaterVolumeRows =
      yearDataset?.datasets.find((row) => row.dataType === 'volume_jatevesi')
        ?.effectiveRows ?? [];
    const waterPrice = this.resolveLatestPrice(taksaRows, 1);
    const wastewaterPrice = this.resolveLatestPrice(taksaRows, 2);
    const soldWaterVolume = waterVolumeRows.reduce(
      (sum, row) => sum + this.toNumber(row.Maara),
      0,
    );
    const soldWastewaterVolume = wastewaterVolumeRows.reduce(
      (sum, row) => sum + this.toNumber(row.Maara),
      0,
    );
    const hasDetailedDriverRows =
      taksaRows.length > 0 ||
      waterVolumeRows.length > 0 ||
      wastewaterVolumeRows.length > 0;

    const waterDriverReady = hasDetailedDriverRows
      ? waterPrice > 0 && soldWaterVolume > 0
      : completeness.taksa === true && completeness.volume_vesi === true;
    const wastewaterDriverReady = hasDetailedDriverRows
      ? wastewaterPrice > 0 && soldWastewaterVolume > 0
      : completeness.taksa === true && completeness.volume_jatevesi === true;
    const hasAnyPrice = hasDetailedDriverRows
      ? waterPrice > 0 || wastewaterPrice > 0
      : completeness.taksa === true;
    const hasAnyVolume = hasDetailedDriverRows
      ? soldWaterVolume > 0 || soldWastewaterVolume > 0
      : completeness.volume_vesi === true ||
        completeness.volume_jatevesi === true;

    const baselineMissingRequirements: BaselineMissingRequirement[] = [];
    if (!financialBaselineReady) {
      baselineMissingRequirements.push('financialBaseline');
    }
    if (!waterDriverReady && !wastewaterDriverReady) {
      if (!hasAnyPrice) {
        baselineMissingRequirements.push('prices');
      }
      if (!hasAnyVolume) {
        baselineMissingRequirements.push('volumes');
      }
      if (hasAnyPrice && hasAnyVolume) {
        baselineMissingRequirements.push('prices', 'volumes');
      }
    }

    return {
      baselineReady: baselineMissingRequirements.length === 0,
      baselineMissingRequirements,
      baselineWarnings:
        tariffRevenueReason != null ? ['tariffRevenueMismatch'] : [],
    };
  }

  private augmentCompletenessWithTariffRevenue(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
  ): {
    completeness: Record<string, boolean>;
    tariffRevenueReason: TariffRevenueReason | null;
  } {
    const tariffRevenueStatus =
      this.evaluateTariffRevenueStructureStatus(yearDataset);
    const tariffRevenueReady =
      tariffRevenueStatus.ready ??
      this.resolveFallbackTariffRevenueReadiness(completeness);
    return {
      completeness: {
        ...this.emptyCompleteness(),
        ...completeness,
        tariff_revenue: tariffRevenueReady,
      },
      tariffRevenueReason: tariffRevenueReady
        ? null
        : tariffRevenueStatus.reason,
    };
  }

  private resolveFallbackTariffRevenueReadiness(
    completeness: Record<string, boolean>,
  ): boolean {
    if (typeof completeness.tariff_revenue === 'boolean') {
      return completeness.tariff_revenue;
    }
    return (
      completeness.tilinpaatos === true &&
      completeness.taksa === true &&
      (completeness.volume_vesi === true ||
        completeness.volume_jatevesi === true)
    );
  }

  private evaluateTariffRevenueStructureStatus(
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
  ): {
    ready: boolean | null;
    reason: TariffRevenueReason | null;
  } {
    const financialRow =
      (yearDataset?.datasets.find((row) => row.dataType === 'tilinpaatos')
        ?.effectiveRows?.[0] as Record<string, unknown> | undefined) ?? null;
    const taksaRows =
      yearDataset?.datasets.find((row) => row.dataType === 'taksa')?.effectiveRows ??
      [];
    const waterVolumeRows =
      yearDataset?.datasets.find((row) => row.dataType === 'volume_vesi')
        ?.effectiveRows ?? [];
    const wastewaterVolumeRows =
      yearDataset?.datasets.find((row) => row.dataType === 'volume_jatevesi')
        ?.effectiveRows ?? [];

    const expectedSalesRevenue = this.toNullableNumber(financialRow?.Liikevaihto);
    const waterPrice = this.resolveLatestPrice(taksaRows, 1);
    const wastewaterPrice = this.resolveLatestPrice(taksaRows, 2);
    const soldWaterVolume = waterVolumeRows.reduce(
      (sum, row) => sum + this.toNumber(row.Maara),
      0,
    );
    const soldWastewaterVolume = wastewaterVolumeRows.reduce(
      (sum, row) => sum + this.toNumber(row.Maara),
      0,
    );
    const fixedRevenue = this.toNullableNumber(financialRow?.PerusmaksuYhteensa);

    const hasRequiredInputs =
      expectedSalesRevenue != null &&
      (soldWaterVolume > 0 || soldWastewaterVolume > 0) &&
      (waterPrice > 0 || wastewaterPrice > 0);
    if (!hasRequiredInputs) {
      return { ready: null, reason: null };
    }

    if (fixedRevenue == null) {
      return { ready: false, reason: 'missing_fixed_revenue' };
    }

    const derivedSalesRevenue = this.round2(
      waterPrice * soldWaterVolume +
        wastewaterPrice * soldWastewaterVolume +
        fixedRevenue,
    );

    return Math.abs(this.round2(expectedSalesRevenue) - derivedSalesRevenue) <= 1
      ? { ready: true, reason: null }
      : { ready: false, reason: 'mismatch' };
  }

  private resolveWorkspaceYearRows(importStatus: {
    years?: Array<{
      vuosi: number;
      completeness?: {
        tilinpaatos?: boolean;
        taksa?: boolean;
        volume_vesi?: boolean;
        volume_jatevesi?: boolean;
      };
      sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
      sourceBreakdown?: {
        veetiDataTypes?: string[];
        manualDataTypes?: string[];
      };
    }>;
    workspaceYears?: number[];
  }) {
    const importedYears = this.resolveImportedYears(importStatus);
    const workspaceYearSet = new Set(importedYears);
    return (importStatus.years ?? []).filter((row) =>
      workspaceYearSet.has(row.vuosi),
    );
  }

  private resolveImportedYears(importStatus: {
    years?: Array<{ vuosi: number }>;
    workspaceYears?: number[];
  }): number[] {
    return this.normalizeYears(importStatus.workspaceYears ?? []);
  }

  private async resolvePlanningBaselineYears(
    orgId: string,
    options?: {
      link?: { veetiId: number; workspaceYears?: number[] } | null;
      persistRepair?: boolean;
    },
  ): Promise<number[]> {
    const link =
      options?.link ??
      (await this.prisma.veetiOrganisaatio?.findUnique?.({
        where: { orgId },
        select: { veetiId: true, workspaceYears: true },
      })) ??
      null;
    if (!link) {
      return [];
    }

    const workspaceYears = this.normalizeYears(link.workspaceYears ?? []);
    if (!this.prisma.veetiYearPolicy?.findMany) {
      return workspaceYears;
    }
    const policies = await this.prisma.veetiYearPolicy.findMany({
      where: {
        orgId,
        veetiId: link.veetiId,
      },
      select: {
        vuosi: true,
        excluded: true,
        includedInPlanningBaseline: true,
      },
    });
    const acceptedFromPolicy = this.normalizeYears(
      policies
        .filter(
          (row) =>
            row.includedInPlanningBaseline === true && row.excluded !== true,
        )
        .map((row) => row.vuosi),
    );
    if (acceptedFromPolicy.length > 0) {
      return acceptedFromPolicy;
    }

    const fallbackYears = await this.resolveFallbackPlanningBaselineYears(
      orgId,
      workspaceYears,
    );
    if (options?.persistRepair && fallbackYears.length > 0) {
      await this.persistPlanningBaselineYears(
        orgId,
        link.veetiId,
        workspaceYears,
        fallbackYears,
      );
    }
    return fallbackYears;
  }

  private async resolveFallbackPlanningBaselineYears(
    orgId: string,
    workspaceYears: number[],
  ): Promise<number[]> {
    if (!this.prisma.talousarvio?.findMany || !this.prisma.ennuste?.findMany) {
      return this.normalizeYears(workspaceYears);
    }
    const workspaceYearSet = new Set(this.normalizeYears(workspaceYears));
    const [veetiBudgets, scenarios] = await Promise.all([
      this.prisma.talousarvio.findMany({
        where: { orgId, lahde: 'veeti' },
        select: { vuosi: true, veetiVuosi: true },
      }),
      this.prisma.ennuste.findMany({
        where: { orgId },
        select: {
          talousarvio: {
            select: {
              lahde: true,
              vuosi: true,
              veetiVuosi: true,
            },
          },
        },
      }),
    ]);

    const acceptedYears = new Set<number>();
    for (const row of veetiBudgets) {
      const year = Number(row.veetiVuosi ?? row.vuosi);
      if (Number.isFinite(year) && workspaceYearSet.has(year)) {
        acceptedYears.add(year);
      }
    }
    for (const scenario of scenarios) {
      const year = Number(
        scenario.talousarvio?.veetiVuosi ?? scenario.talousarvio?.vuosi,
      );
      if (
        scenario.talousarvio?.lahde === 'veeti' &&
        Number.isFinite(year) &&
        workspaceYearSet.has(year)
      ) {
        acceptedYears.add(year);
      }
    }

    return [...acceptedYears].sort((a, b) => a - b);
  }

  private async persistPlanningBaselineYears(
    orgId: string,
    veetiId: number,
    workspaceYears: number[],
    includedYears: number[],
  ): Promise<void> {
    if (!this.prisma.veetiYearPolicy?.findMany || !this.prisma.veetiYearPolicy?.upsert) {
      return;
    }
    const relevantYears = this.normalizeYears([
      ...workspaceYears,
      ...includedYears,
    ]);
    if (relevantYears.length === 0) {
      return;
    }

    const includedYearSet = new Set(this.normalizeYears(includedYears));
    const existingPolicies = await this.prisma.veetiYearPolicy.findMany({
      where: {
        orgId,
        veetiId,
        vuosi: { in: relevantYears },
      },
      select: {
        vuosi: true,
        excluded: true,
      },
    });
    const excludedByYear = new Map(
      existingPolicies.map((row) => [row.vuosi, row.excluded === true]),
    );

    await Promise.all(
      relevantYears.map((year) =>
        this.prisma.veetiYearPolicy.upsert({
          where: {
            orgId_veetiId_vuosi: {
              orgId,
              veetiId,
              vuosi: year,
            },
          },
          create: {
            orgId,
            veetiId,
            vuosi: year,
            excluded: excludedByYear.get(year) === true,
            includedInPlanningBaseline:
              excludedByYear.get(year) === true
                ? false
                : includedYearSet.has(year),
            editedAt: new Date(),
          },
          update: {
            includedInPlanningBaseline:
              excludedByYear.get(year) === true
                ? false
                : includedYearSet.has(year),
            editedAt: new Date(),
          },
        }),
      ),
    );
  }

  private async getWorkspaceYears(orgId: string): Promise<number[]> {
    if (!this.prisma.veetiOrganisaatio?.findUnique) {
      return [];
    }

    const link = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link?.workspaceYears ?? []);
  }

  private async persistWorkspaceYears(
    orgId: string,
    years: number[],
  ): Promise<number[]> {
    if (
      !this.prisma.veetiOrganisaatio?.findUnique ||
      !this.prisma.veetiOrganisaatio?.update
    ) {
      return this.normalizeYears(years);
    }

    const currentLink = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { workspaceYears: true },
    });
    if (!currentLink) {
      return [];
    }

    const nextWorkspaceYears = this.normalizeYears([
      ...(currentLink.workspaceYears ?? []),
      ...years,
    ]);
    const link = await this.prisma.veetiOrganisaatio.update({
      where: { orgId },
      data: { workspaceYears: nextWorkspaceYears },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link.workspaceYears ?? []);
  }

  private async removeWorkspaceYears(
    orgId: string,
    years: number[],
  ): Promise<number[]> {
    if (
      !this.prisma.veetiOrganisaatio?.findUnique ||
      !this.prisma.veetiOrganisaatio?.update
    ) {
      return [];
    }

    const removeYears = new Set(this.normalizeYears(years));
    const currentLink = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { workspaceYears: true },
    });
    if (!currentLink) {
      return [];
    }

    const remainingWorkspaceYears = this.normalizeYears(
      (currentLink.workspaceYears ?? []).filter((year) => !removeYears.has(year)),
    );

    const link = await this.prisma.veetiOrganisaatio.update({
      where: { orgId },
      data: { workspaceYears: remainingWorkspaceYears },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link.workspaceYears ?? []);
  }

  private sanitizeOpsAttrs(
    attrs: Record<string, unknown> | undefined,
  ): Record<string, string | number | boolean | null> {
    const out: Record<string, string | number | boolean | null> = {};
    if (!attrs || typeof attrs !== 'object') return out;
    for (const [key, value] of Object.entries(attrs)) {
      if (Object.keys(out).length >= 24) break;
      if (typeof value === 'string') {
        out[key] = value.slice(0, 240);
      } else if (typeof value === 'number') {
        out[key] = Number.isFinite(value) ? value : null;
      } else if (typeof value === 'boolean') {
        out[key] = value;
      } else if (value == null) {
        out[key] = null;
      }
    }
    return out;
  }

  private emptyCompleteness(): Record<string, boolean> {
    return {
      tilinpaatos: false,
      taksa: false,
      tariff_revenue: false,
      volume_vesi: false,
      volume_jatevesi: false,
      investointi: false,
      energia: false,
      verkko: false,
    };
  }

  private resolveMissingSyncRequirements(
    completeness: Record<string, boolean>,
  ): SyncRequirement[] {
    const missing: SyncRequirement[] = [];
    if (!completeness.tilinpaatos) missing.push('financials');
    if (!completeness.taksa) missing.push('prices');
    if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
      missing.push('volumes');
    }
    if (
      completeness.tilinpaatos &&
      completeness.taksa &&
      (completeness.volume_vesi || completeness.volume_jatevesi) &&
      !completeness.tariff_revenue
    ) {
      missing.push('tariffRevenue');
    }
    return missing;
  }

  private resolveSyncBlockReason(
    completeness: Record<string, boolean>,
  ): string | null {
    if (!completeness.tilinpaatos) {
      return 'Financial statement data is missing for this year.';
    }
    if (!completeness.taksa) {
      return 'Price data (taksa) is missing for this year.';
    }
    if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
      return 'Sold volume data is missing for this year.';
    }
    if (!completeness.tariff_revenue) {
      return 'Fixed revenue is needed to reconcile tariff revenue for this year.';
    }
    return null;
  }

  private resolveBaselineBlockReason(params: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: BaselineMissingRequirement[];
  }): string | null {
    if (typeof params.baselineReady !== 'boolean') {
      return this.resolveSyncBlockReason(params.completeness);
    }
    if (params.baselineReady) {
      return null;
    }
    const missing = params.baselineMissingRequirements ?? [];
    if (missing.includes('financialBaseline')) {
      return 'Financial baseline data is missing for this year.';
    }
    if (missing.includes('prices')) {
      return 'Price data (taksa) is missing for this year.';
    }
    if (missing.includes('volumes')) {
      return 'Sold volume data is missing for this year.';
    }
    return 'Year is missing baseline inputs.';
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
    const normalizedByYear = new Map<number, YearlyInvestment>();
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const year = Math.round(Number((item as { year?: unknown }).year));
      const amount = Number((item as { amount?: unknown }).amount);
      if (!Number.isFinite(year) || !Number.isFinite(amount)) continue;
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
      normalizedByYear.set(year, {
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
      });
    }
    return [...normalizedByYear.values()].sort((left, right) => left.year - right.year);
  }

  private normalizeAssumptionOverrides(raw: unknown): Record<string, number> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
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
        investmentEur: amount,
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
    for (const item of raw) {
      const year = Math.round(Number(item.year));
      if (!Number.isFinite(year)) continue;
      if (year < baseYear || year > baseYear + 4) continue;

      out.push({
        year,
        personnelPct: this.round2(this.toNumber(item.personnelPct)),
        energyPct: this.round2(this.toNumber(item.energyPct)),
        opexOtherPct: this.round2(this.toNumber(item.opexOtherPct)),
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

    return {
      id: projection.id,
      name: this.normalizeText(projection.nimi) ?? projection.nimi,
      onOletus: Boolean(projection.onOletus),
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
    for (const row of rows) {
      const service = String(row.palvelutyyppi ?? '');
      const price = this.toNumber(row.yksikkohinta);
      if (service === 'vesi') water = price;
      if (service === 'jatevesi') wastewater = price;
    }
    return { water, wastewater };
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
    const point = trendSeries.find((row) => row.year === latestComparableYear);
    if (!point) return null;
    return this.round2(this.toNumber(point.combinedPrice));
  }

  private buildYearlyInvestments(
    projection: any,
    baseYear: number | null,
  ): YearlyInvestment[] {
    if (!baseYear) return [];

    const horizon = Math.max(0, Number(projection?.aikajaksoVuosia ?? 0));
    const items = new Map<number, YearlyInvestment>();

    const userInvestments = Array.isArray(projection?.userInvestments)
      ? this.normalizeUserInvestments(projection.userInvestments)
      : [];

    for (const item of userInvestments) {
      const year = Math.round(Number(item.year));
      const amount = this.toNumber(item.amount);
      if (Number.isFinite(year)) {
        items.set(year, {
          ...item,
          amount,
        });
      }
    }

    const overrides = this.normalizeYearOverrides(
      projection?.vuosiYlikirjoitukset ?? {},
    );
    for (const [yearKey, value] of Object.entries(overrides)) {
      const year = Number(yearKey);
      const amount = this.toNumber(value?.investmentEur);
      if (Number.isFinite(year) && amount > 0) {
        const current = items.get(year);
        items.set(year, {
          year,
          amount,
          target: current?.target ?? null,
          category: current?.category ?? null,
          depreciationClassKey: current?.depreciationClassKey ?? null,
          depreciationRuleSnapshot: current?.depreciationRuleSnapshot ?? null,
          investmentType: current?.investmentType ?? null,
          confidence: current?.confidence ?? null,
          waterAmount: current?.waterAmount ?? null,
          wastewaterAmount: current?.wastewaterAmount ?? null,
          note: current?.note ?? null,
        });
      }
    }

    const rows: YearlyInvestment[] = [];
    for (let offset = 0; offset <= horizon; offset += 1) {
      const year = baseYear + offset;
      const current = items.get(year);
      rows.push({
        year,
        amount: this.round2(current?.amount ?? 0),
        target: current?.target ?? null,
        category: current?.category ?? null,
        depreciationClassKey: current?.depreciationClassKey ?? null,
        depreciationRuleSnapshot: current?.depreciationRuleSnapshot ?? null,
        investmentType: current?.investmentType ?? null,
        confidence: current?.confidence ?? null,
        waterAmount: current?.waterAmount ?? null,
        wastewaterAmount: current?.wastewaterAmount ?? null,
        note: current?.note ?? null,
      });
    }

    return rows;
  }

  private mapDepreciationRule(row: any) {
    const method = toCanonicalDepreciationMethod(String(row.method ?? '')) ?? 'none';
    return {
      id: row.id,
      assetClassKey: String(row.assetClassKey ?? ''),
      assetClassName: this.normalizeText(row.assetClassName) ?? null,
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
      assetClassName: rule.assetClassName,
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
      assetClassName: rule.assetClassName,
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

    for (const rule of PTS_SCENARIO_DEPRECIATION_RULE_DEFAULTS) {
      merged.set(rule.assetClassKey, {
        ...rule,
      });
    }

    for (const row of rows) {
      const assetClassKey = String(row.assetClassKey ?? '').trim();
      if (!assetClassKey) continue;
      merged.set(assetClassKey, {
        id:
          String(row.id ?? row.assetClassKey ?? '').trim() || assetClassKey,
        assetClassKey,
        assetClassName: this.normalizeText(row.assetClassName) ?? null,
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

  private buildImportYearSummaryRows(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): ImportYearSummaryRow[] {
    const financialDataset =
      yearDataset.datasets.find((row) => row.dataType === 'tilinpaatos') ?? null;
    const rawFinancials = (financialDataset?.rawRows?.[0] ??
      null) as Record<string, unknown> | null;
    const effectiveFinancials = (financialDataset?.effectiveRows?.[0] ??
      null) as Record<string, unknown> | null;

    if (!rawFinancials && !effectiveFinancials) {
      return [];
    }

    const buildRowValues = (sourceField: ImportYearSummarySourceField) => {
      const raw = this.readSummaryField(rawFinancials, sourceField);
      const effective = this.readSummaryField(effectiveFinancials, sourceField);
      const normalizeValue =
        sourceField === 'TilikaudenYliJaama'
          ? (value: number | null) => value
          : this.normalizeNonNegativeNullable.bind(this);
      return {
        rawValue: normalizeValue(raw.value),
        effectiveValue: normalizeValue(effective.value),
        rawSource: raw.source,
        effectiveSource: effective.source,
      };
    };

    return IMPORT_YEAR_SUMMARY_FIELDS.map(({ key, sourceField }) => {
      const values = buildRowValues(sourceField);
      return {
        key,
        sourceField,
        rawValue: values.rawValue,
        effectiveValue: values.effectiveValue,
        changed: this.summaryValuesDiffer(values.rawValue, values.effectiveValue),
        rawSource: values.rawSource,
        effectiveSource: values.effectiveSource,
      };
    });
  }

  private buildImportYearTrustSignal(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    summaryRows: ImportYearSummaryRow[],
  ): ImportYearTrustSignal {
    const changedSummaryKeys = summaryRows
      .filter((row) => row.changed)
      .map((row) => row.key);
    const statementImport = this.findDatasetProvenanceByKind(
      yearDataset.datasets,
      ['statement_import'],
    );
    const documentImport = this.findDatasetProvenanceByKind(
      yearDataset.datasets,
      ['document_import'],
    );
    const workbookImport = this.findDatasetProvenanceByKind(yearDataset.datasets, [
      'kva_import',
      'excel_import',
    ]);
    const reasons = new Set<ImportYearTrustSignal['reasons'][number]>();

    if (statementImport) {
      reasons.add('statement_import');
    }
    if (documentImport) {
      reasons.add('document_import');
    }
    if (workbookImport) {
      reasons.add('workbook_import');
    } else if (
      yearDataset.datasets.some(
        (dataset) =>
          (dataset.overrideMeta?.provenance as { kind?: string } | undefined)
            ?.kind === 'qdis_import',
      )
    ) {
      reasons.add('qdis_import');
    } else if (yearDataset.hasManualOverrides && changedSummaryKeys.length > 0) {
      reasons.add('manual_override');
    }
    if (yearDataset.sourceStatus === 'MIXED') {
      reasons.add('mixed_source');
    }
    if (yearDataset.sourceStatus === 'INCOMPLETE') {
      reasons.add('incomplete_source');
    }
    if (changedSummaryKeys.includes('result')) {
      reasons.add('result_changed');
    }

    return {
      level:
        changedSummaryKeys.length > 0 &&
        (statementImport != null ||
          documentImport != null ||
          yearDataset.hasManualOverrides)
          ? 'material'
          : reasons.size > 0
          ? 'review'
          : 'none',
      reasons: [...reasons],
      changedSummaryKeys,
      statementImport,
      documentImport,
      workbookImport,
    };
  }

  private findDatasetProvenanceByKind(
    datasets: Array<
      Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>['datasets'][number]
    >,
    kinds: Array<OverrideProvenance['kind']>,
  ): OverrideProvenance | null {
    for (const dataset of datasets) {
      const provenance = dataset.overrideMeta?.provenance ?? null;
      if (!provenance) continue;
      if (kinds.includes(provenance.kind)) {
        return provenance;
      }
      const fieldSource = provenance.fieldSources?.find((item) =>
        kinds.includes(item.provenance.kind),
      );
      if (fieldSource) {
        return {
          ...fieldSource.provenance,
          fieldSources: [{ sourceField: fieldSource.sourceField, provenance: fieldSource.provenance }],
        };
      }
    }
    return null;
  }

  private buildImportYearResultToZeroSignal(
    summaryRows: ImportYearSummaryRow[],
  ): ImportYearResultToZeroSignal {
    const revenueRow = summaryRows.find((row) => row.key === 'revenue') ?? null;
    const resultRow = summaryRows.find((row) => row.key === 'result') ?? null;
    const rawValue = resultRow?.rawValue ?? null;
    const effectiveValue = resultRow?.effectiveValue ?? null;
    const delta =
      rawValue == null || effectiveValue == null
        ? null
        : this.round2(effectiveValue - rawValue);
    const absoluteGap =
      effectiveValue == null ? null : this.round2(Math.abs(effectiveValue));
    const marginPct =
      revenueRow?.effectiveValue == null ||
      revenueRow.effectiveValue === 0 ||
      effectiveValue == null
        ? null
        : this.round2((effectiveValue / revenueRow.effectiveValue) * 100);

    return {
      rawValue,
      effectiveValue,
      delta,
      absoluteGap,
      marginPct,
      direction:
        effectiveValue == null
          ? 'missing'
          : Math.abs(effectiveValue) <= 0.005
          ? 'at_zero'
          : effectiveValue > 0
          ? 'above_zero'
          : 'below_zero',
    };
  }

  private readSummaryField(
    row: Record<string, unknown> | null,
    sourceKey: string,
  ): { value: number | null; source: ImportYearSummarySource } {
    const value = this.toNullableNumber(row?.[sourceKey]);
    return {
      value,
      source: value == null ? 'missing' : 'direct',
    };
  }

  private buildImportYearSubrowAvailability(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): ImportYearSubrowAvailability {
    const financialDataset =
      yearDataset.datasets.find((row) => row.dataType === 'tilinpaatos') ?? null;
    return {
      truthfulSubrowsAvailable: false,
      reason: 'year_summary_only',
      rawRowCount: financialDataset?.rawRows?.length ?? 0,
      effectiveRowCount: financialDataset?.effectiveRows?.length ?? 0,
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

  private buildStatementPreviewFields(
    veetiRow: Record<string, unknown> | null,
    effectiveRow: Record<string, unknown> | null,
  ): StatementPreviewResponse['fields'] {
    return STATEMENT_PREVIEW_FIELDS.map((field) => {
      const veetiValue =
        veetiRow == null ? null : this.toNullableNumber(veetiRow[field.sourceField]);
      const effectiveValue =
        effectiveRow == null
          ? null
          : this.toNullableNumber(effectiveRow[field.sourceField]);

      return {
        key: field.key,
        label: field.label,
        sourceField: field.sourceField,
        veetiValue,
        effectiveValue,
        extractedValue: null,
        proposedValue: null,
        changed: false,
      };
    });
  }

  private assertWorkbookPreviewUpload(input: WorkbookPreviewRequest) {
    this.assertUploadMetadata(
      {
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        fileBuffer: input.fileBuffer,
      },
      {
        maxBytes: WORKBOOK_PREVIEW_MAX_BYTES,
        allowedExtensions: ALLOWED_WORKBOOK_EXTENSIONS,
        allowedContentTypes: ALLOWED_WORKBOOK_CONTENT_TYPES,
        missingFileMessage: 'Workbook file is required.',
        invalidTypeMessage:
          'Workbook preview only supports .xlsx or .xlsm uploads.',
        invalidSignatureMessage:
          'Workbook preview only supports OpenXML workbook uploads.',
        signatureCheck: (buffer) => this.isZipContainer(buffer),
      },
    );
  }

  private assertStatementPreviewUpload(input: StatementPreviewRequest) {
    this.assertUploadMetadata(
      {
        fileName: input.fileName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        fileBuffer: input.fileBuffer,
      },
      {
        maxBytes: STATEMENT_PREVIEW_MAX_BYTES,
        allowedExtensions: ALLOWED_STATEMENT_EXTENSIONS,
        allowedContentTypes: ALLOWED_STATEMENT_CONTENT_TYPES,
        missingFileMessage: 'Statement PDF file is required.',
        invalidTypeMessage: 'Statement preview only supports PDF uploads.',
        invalidSignatureMessage:
          'Statement preview only supports PDF uploads.',
        signatureCheck: (buffer) => this.isPdfBuffer(buffer),
      },
    );
  }

  private assertUploadMetadata(
    input: {
      fileName: string | null;
      contentType: string | null;
      sizeBytes: number;
      fileBuffer: Buffer | null;
    },
    options: {
      maxBytes: number;
      allowedExtensions: Set<string>;
      allowedContentTypes: Set<string>;
      missingFileMessage: string;
      invalidTypeMessage: string;
      invalidSignatureMessage: string;
      signatureCheck: (buffer: Buffer) => boolean;
    },
  ) {
    if (!input.fileBuffer || input.fileBuffer.length === 0 || !input.fileName) {
      throw new BadRequestException(options.missingFileMessage);
    }

    const fileName = input.fileName.trim();
    const extension = this.extractFileExtension(fileName);
    const normalizedContentType = input.contentType?.trim().toLowerCase() ?? null;

    if (!extension || !options.allowedExtensions.has(extension)) {
      throw new BadRequestException(options.invalidTypeMessage);
    }

    if (
      normalizedContentType &&
      !options.allowedContentTypes.has(normalizedContentType)
    ) {
      throw new BadRequestException(options.invalidTypeMessage);
    }

    const reportedSize = Math.max(0, Math.round(Number(input.sizeBytes) || 0));
    const actualSize = input.fileBuffer.length;
    const effectiveSize = reportedSize > 0 ? reportedSize : actualSize;

    if (effectiveSize <= 0 || effectiveSize > options.maxBytes) {
      throw new BadRequestException(
        `Uploaded file exceeds the ${options.maxBytes} byte limit.`,
      );
    }

    if (actualSize > options.maxBytes) {
      throw new BadRequestException(
        `Uploaded file exceeds the ${options.maxBytes} byte limit.`,
      );
    }

    if (!options.signatureCheck(input.fileBuffer)) {
      throw new BadRequestException(options.invalidSignatureMessage);
    }
  }

  private extractFileExtension(fileName: string): string | null {
    const normalized = fileName.trim().toLowerCase();
    const lastDot = normalized.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === normalized.length - 1) {
      return null;
    }
    return normalized.slice(lastDot);
  }

  private isZipContainer(buffer: Buffer): boolean {
    if (buffer.length < 4) return false;
    return (
      (buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04) ||
      (buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x05 &&
        buffer[3] === 0x06) ||
      (buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x07 &&
        buffer[3] === 0x08)
    );
  }

  private isPdfBuffer(buffer: Buffer): boolean {
    return (
      buffer.length >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2d
    );
  }

  private toNullableNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = this.toNumber(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
