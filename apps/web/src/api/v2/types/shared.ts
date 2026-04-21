import type {
  BenchmarkMetric,
  VeetiLinkStatus,
  VeetiYearInfo,
} from '../../veeti';
import type { V2VesinvestPlanSummary } from './vesinvest';
export type V2MetricKpi = {
  value: number;
  deltaYoY: number | null;
};

export type V2TrendPoint = {
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

export type V2PeerSnapshot = {
  year: number | null;
  available: boolean;
  reason?: string;
  kokoluokka?: 'pieni' | 'keski' | 'suuri';
  orgCount?: number;
  peerCount?: number;
  computedAt?: string | null;
  isStale?: boolean;
  staleAfterDays?: number;
  peers?: Array<{
    veetiId: number;
    nimi: string | null;
    ytunnus: string | null;
    kunta: string | null;
  }>;
  metrics?: BenchmarkMetric[];
};

export type V2ImportStatus = {
  connected: boolean;
  link: VeetiLinkStatus | null;
  tariffScope?: 'usage_fee_only' | string;
  years: VeetiYearInfo[];
  availableYears?: VeetiYearInfo[];
  workspaceYears?: number[];
  excludedYears?: number[];
  planningBaselineYears?: number[];
};

export type V2WorkbookImportKind = 'kva_import' | 'excel_import';

export type V2DocumentImportProfile =
  | 'generic_pdf'
  | 'statement_pdf'
  | 'qdis_pdf'
  | 'unknown_pdf';

export type V2DocumentImportDatasetKind =
  | 'financials'
  | 'prices'
  | 'volumes';

export type V2DocumentImportSourceLine = {
  text: string;
  pageNumber?: number | null;
};

export type V2WorkbookCandidateRowAction =
  | 'keep_veeti'
  | 'apply_workbook';

export type V2WorkbookCandidateRow = {
  sourceField: string;
  workbookValue: number | null;
  action: V2WorkbookCandidateRowAction;
};

export type V2OverrideProvenanceRef = {
  kind:
    | 'manual_edit'
    | 'statement_import'
    | 'qdis_import'
    | 'document_import'
    | V2WorkbookImportKind;
  fileName: string | null;
  pageNumber: number | null;
  pageNumbers?: number[];
  confidence: number | null;
  scannedPageCount: number | null;
  matchedFields: string[];
  warnings: string[];
  documentProfile?: V2DocumentImportProfile | null;
  datasetKinds?: V2DocumentImportDatasetKind[];
  sourceLines?: V2DocumentImportSourceLine[];
  sheetName?: string | null;
  matchedYears?: number[];
  confirmedSourceFields?: string[];
  candidateRows?: V2WorkbookCandidateRow[];
};

export type V2OverrideFinancialFieldSource = {
  sourceField: V2ImportYearSummarySourceField;
  provenance: V2OverrideProvenanceRef;
};

export type V2OverrideProvenance = V2OverrideProvenanceRef & {
  fieldSources?: V2OverrideFinancialFieldSource[];
};

export type V2ImportYearSummaryFieldKey =
  | 'revenue'
  | 'materialsCosts'
  | 'personnelCosts'
  | 'depreciation'
  | 'otherOperatingCosts'
  | 'result';

export type V2ImportYearSummarySourceField =
  | 'Liikevaihto'
  | 'PerusmaksuYhteensa'
  | 'AineetJaPalvelut'
  | 'Henkilostokulut'
  | 'Poistot'
  | 'LiiketoiminnanMuutKulut'
  | 'TilikaudenYliJaama';

export type V2ImportYearSummarySource = 'direct' | 'missing';

export type V2ImportYearSummaryRow = {
  key: V2ImportYearSummaryFieldKey;
  sourceField: V2ImportYearSummarySourceField;
  rawValue: number | null;
  effectiveValue: number | null;
  changed: boolean;
  rawSource: V2ImportYearSummarySource;
  effectiveSource: V2ImportYearSummarySource;
};

export type V2ImportYearTrustReason =
  | 'manual_override'
  | 'statement_import'
  | 'qdis_import'
  | 'document_import'
  | 'workbook_import'
  | 'mixed_source'
  | 'incomplete_source'
  | 'result_changed';

export type V2ImportYearTrustSignal = {
  level: 'none' | 'review' | 'material';
  reasons: V2ImportYearTrustReason[];
  changedSummaryKeys: V2ImportYearSummaryFieldKey[];
  statementImport: V2OverrideProvenance | null;
  documentImport?: V2OverrideProvenance | null;
  workbookImport: V2OverrideProvenance | null;
};

export type V2ImportYearResultToZeroSignal = {
  rawValue: number | null;
  effectiveValue: number | null;
  delta: number | null;
  absoluteGap: number | null;
  marginPct: number | null;
  direction: 'above_zero' | 'below_zero' | 'at_zero' | 'missing';
};

export type V2ImportYearSubrowAvailability = {
  truthfulSubrowsAvailable: boolean;
  reason: 'year_summary_only';
  rawRowCount: number;
  effectiveRowCount: number;
};

export type V2BaselineDatasetSource = {
  dataType: string;
  source: 'veeti' | 'manual' | 'none';
  provenance: V2OverrideProvenance | null;
  editedAt: string | null;
  editedBy: string | null;
  reason: string | null;
};

export type V2BaselineSourceSummary = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: V2BaselineDatasetSource;
  prices: V2BaselineDatasetSource;
  volumes: V2BaselineDatasetSource;
};

export type V2ManualYearPatchPayload = {
  year: number;
  financials?: {
    liikevaihto?: number;
    perusmaksuYhteensa?: number;
    aineetJaPalvelut?: number;
    henkilostokulut?: number;
    liiketoiminnanMuutKulut?: number;
    poistot?: number;
    arvonalentumiset?: number;
    rahoitustuototJaKulut?: number;
    tilikaudenYliJaama?: number;
    omistajatuloutus?: number;
    omistajanTukiKayttokustannuksiin?: number;
  };
  prices?: {
    waterUnitPrice: number;
    wastewaterUnitPrice: number;
  };
  volumes?: {
    soldWaterVolume: number;
    soldWastewaterVolume: number;
  };
  investments?: {
    investoinninMaara: number;
    korvausInvestoinninMaara: number;
  };
  energy?: {
    prosessinKayttamaSahko: number;
  };
  network?: {
    verkostonPituus: number;
  };
  reason?: string;
  statementImport?: {
    fileName: string;
    pageNumber?: number;
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
  };
  qdisImport?: {
    fileName: string;
    pageNumber?: number;
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
  };
  documentImport?: {
    fileName: string;
    pageNumber?: number;
    pageNumbers?: number[];
    confidence?: number;
    scannedPageCount?: number;
    matchedFields?: string[];
    warnings?: string[];
    documentProfile?: V2DocumentImportProfile;
    datasetKinds?: V2DocumentImportDatasetKind[];
    sourceLines?: V2DocumentImportSourceLine[];
  };
  workbookImport?: {
    kind?: V2WorkbookImportKind;
    fileName: string;
    sheetName?: string;
    matchedYears?: number[];
    matchedFields?: string[];
    confirmedSourceFields?: string[];
    candidateRows?: V2WorkbookCandidateRow[];
    warnings?: string[];
  };
};

export type V2ManualYearPatchResponse = {
  year: number;
  patchedDataTypes: string[];
  missingBefore: Array<'financials' | 'prices' | 'volumes' | 'tariffRevenue'>;
  missingAfter: Array<'financials' | 'prices' | 'volumes' | 'tariffRevenue'>;
  syncReady: boolean;
  baselineReady?: boolean;
  baselineMissingRequirements?: Array<
    'financialBaseline' | 'prices' | 'volumes'
  >;
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  status: V2ImportStatus;
};

export type V2ImportYearDataResponse = {
  year: number;
  veetiId: number;
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  completeness: Record<string, boolean>;
  baselineReady?: boolean;
  baselineMissingRequirements?: Array<
    'financialBaseline' | 'prices' | 'volumes'
  >;
  baselineWarnings?: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  hasManualOverrides: boolean;
  hasVeetiData: boolean;
  summaryRows?: V2ImportYearSummaryRow[];
  trustSignal?: V2ImportYearTrustSignal;
  resultToZero?: V2ImportYearResultToZeroSignal;
  subrowAvailability?: V2ImportYearSubrowAvailability;
  datasets: Array<{
    dataType: string;
    rawRows: Array<Record<string, unknown>>;
    effectiveRows: Array<Record<string, unknown>>;
    source: 'veeti' | 'manual' | 'none';
    hasOverride: boolean;
    reconcileNeeded: boolean;
    overrideMeta: {
      editedAt: string;
      editedBy: string | null;
      reason: string | null;
      provenance: V2OverrideProvenance | null;
    } | null;
  }>;
};

export type V2StatementPreviewFieldKey =
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

export type V2StatementPreviewResponse = {
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
    key: V2StatementPreviewFieldKey;
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
    mappedKey: V2StatementPreviewFieldKey | null;
  }>;
  warnings: string[];
  canApply: boolean;
};

export type V2WorkbookPreviewResponse = {
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
      key: V2ImportYearSummaryFieldKey;
      sourceField: V2ImportYearSummarySourceField;
      currentValue: number | null;
      workbookValue: number | null;
      differs: boolean;
      currentSource: V2ImportYearSummarySource;
      suggestedAction: 'keep_veeti' | 'apply_workbook';
    }>;
  }>;
  canApply: boolean;
};

export type V2OpsEventPayload = {
  event: string;
  status?: 'info' | 'ok' | 'warn' | 'error';
  attrs?: Record<string, unknown>;
};

export type V2OpsFunnelSnapshot = {
  organization: {
    orgId: string;
    connected: boolean;
    importedYearCount: number;
    syncReadyYearCount: number;
    blockedYearCount: number;
    latestFetchedAt: string | null;
    veetiBudgetCount: number;
    scenarioCount: number;
    computedScenarioCount: number;
    reportCount: number;
  };
  system: {
    orgCount: number;
    connectedOrgCount: number;
    importedOrgCount: number;
    scenarioOrgCount: number;
  };
  computedAt: string;
};

export type V2OverviewResponse = {
  latestVeetiYear: number | null;
  importStatus: V2ImportStatus;
  kpis: {
    revenue: V2MetricKpi;
    operatingCosts: V2MetricKpi;
    costs: V2MetricKpi;
    financingNet: V2MetricKpi;
    otherResultItems: V2MetricKpi;
    yearResult: V2MetricKpi;
    result: V2MetricKpi;
    volume: V2MetricKpi;
    combinedPrice: V2MetricKpi;
  };
  trendSeries: V2TrendPoint[];
  peerSnapshot: V2PeerSnapshot;
};

export type V2PlanningContextResponse = {
  canCreateScenario?: boolean;
  vesinvest?: {
    hasPlan: boolean;
    planCount: number;
    activePlan: V2VesinvestPlanSummary | null;
    selectedPlan: V2VesinvestPlanSummary | null;
  };
  baselineYears: Array<{
    year: number;
    planningRole?: 'historical' | 'current_year_estimate';
    quality: 'complete' | 'partial' | 'missing';
    sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
    sourceBreakdown: {
      veetiDataTypes: string[];
      manualDataTypes: string[];
    };
    financials: V2BaselineDatasetSource;
    prices: V2BaselineDatasetSource;
    volumes: V2BaselineDatasetSource;
    investmentAmount: number;
    soldWaterVolume: number;
    soldWastewaterVolume: number;
    combinedSoldVolume: number;
    processElectricity: number;
    pumpedWaterVolume: number;
    waterBoughtVolume: number;
    waterSoldVolume: number;
    netWaterTradeVolume: number;
  }>;
  operations: {
    latestYear: number | null;
    energySeries: Array<{ year: number; processElectricity: number }>;
    networkRehabSeries: Array<{ year: number; length: number }>;
    networkAssetsCount: number;
    toimintakertomusCount: number;
    toimintakertomusLatestYear: number | null;
    vedenottolupaCount: number;
    activeVedenottolupaCount: number;
  };
};

