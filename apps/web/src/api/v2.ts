import {
  API_BASE,
  api,
  clearToken,
  createApiError,
  dedupeInFlightGet,
  getCachedGet,
  getToken,
  type GetRequestOptions,
  invalidateCachedGets,
  parseApiErrorResponse,
} from './core';
import type {
  BenchmarkMetric,
  VeetiConnectResult,
  VeetiLinkStatus,
  VeetiOrganizationSearchHit,
  VeetiYearInfo,
} from './veeti';


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

export type V2VesinvestGroupDefinition = {
  key: string;
  label: string;
  defaultAccountKey: string;
  defaultDepreciationClassKey: string | null;
  reportGroupKey: string;
  serviceSplit: 'water' | 'wastewater' | 'mixed';
};

export type V2VesinvestGroupUpdateInput = {
  label?: string;
  defaultAccountKey?: string;
  defaultDepreciationClassKey?: string | null;
  reportGroupKey?: string;
  serviceSplit?: 'water' | 'wastewater' | 'mixed';
};

export type V2VesinvestPlanSummary = {
  id: string;
  seriesId: string;
  name: string;
  utilityName: string;
  businessId: string | null;
  veetiId: number | null;
  identitySource: 'manual' | 'veeti' | 'mixed';
  horizonYears: number;
  versionNumber: number;
  status: 'draft' | 'active' | 'archived';
  baselineStatus: 'draft' | 'incomplete' | 'verified';
  pricingStatus: 'blocked' | 'provisional' | 'verified';
  selectedScenarioId: string | null;
  projectCount: number;
  totalInvestmentAmount: number;
  lastReviewedAt: string | null;
  reviewDueAt: string | null;
  classificationReviewRequired: boolean;
  baselineChangedSinceAcceptedRevision: boolean;
  investmentPlanChangedSinceFeeRecommendation: boolean;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  updatedAt: string;
  createdAt: string;
};

export type V2VesinvestProjectAllocation = {
  id?: string;
  year: number;
  totalAmount: number;
  waterAmount: number;
  wastewaterAmount: number;
};

export type V2VesinvestProject = {
  id?: string;
  code: string;
  name: string;
  investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
  groupKey: string;
  groupLabel?: string;
  depreciationClassKey: string | null;
  defaultAccountKey: string | null;
  reportGroupKey: string | null;
  subtype: string | null;
  notes: string | null;
  waterAmount: number;
  wastewaterAmount: number;
  totalAmount: number;
  allocations: V2VesinvestProjectAllocation[];
};

export type V2VesinvestBaselineSnapshotDataset = V2BaselineDatasetSource;

export type V2VesinvestBaselineSnapshotYear = {
  year: number;
  planningRole?: 'historical' | 'current_year_estimate';
  quality: 'complete' | 'partial' | 'missing';
  sourceStatus: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  financials: V2VesinvestBaselineSnapshotDataset;
  prices: V2VesinvestBaselineSnapshotDataset;
  volumes: V2VesinvestBaselineSnapshotDataset;
  combinedSoldVolume: number;
};

export type V2VesinvestBaselineSourceState = {
  source?: string | null;
  veetiId?: number | null;
  utilityName?: string | null;
  businessId?: string | null;
  identitySource?: 'veeti' | null;
  acceptedYears?: number[];
  latestAcceptedBudgetId?: string | null;
  verifiedAt?: string | null;
  snapshotCapturedAt?: string | null;
  baselineYears?: V2VesinvestBaselineSnapshotYear[];
};

export type V2VesinvestFeeRecommendation = {
  savedAt: string;
  linkedScenarioId: string;
  baselineFingerprint: string;
  scenarioFingerprint: string;
  baselineCombinedPrice: number | null;
  totalInvestments: number;
  combined: {
    baselinePriceToday: number | null;
    annualResult: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      peakDeficit: number | null;
      underfundingStartYear: number | null;
    };
    cumulativeCash: {
      requiredPriceToday: number | null;
      requiredAnnualIncreasePct: number | null;
      peakGap: number | null;
      underfundingStartYear: number | null;
    };
  };
  water: {
    currentPrice: number | null;
    forecastPath: Array<{
      year: number;
      price: number | null;
    }>;
  };
  wastewater: {
    currentPrice: number | null;
    forecastPath: Array<{
      year: number;
      price: number | null;
    }>;
  };
  baseFee: {
    currentRevenue: number | null;
    connectionCount: number | null;
  };
  annualResults: Array<{
    year: number;
    result: number | null;
    cashflow: number | null;
    cumulativeCashflow: number | null;
  }>;
  plan: {
    id: string;
    seriesId: string;
    versionNumber: number;
  };
};

export type V2VesinvestPlan = V2VesinvestPlanSummary & {
  feeRecommendationStatus: 'blocked' | 'provisional' | 'verified';
  feeRecommendation: V2VesinvestFeeRecommendation | null;
  baselineSourceState: V2VesinvestBaselineSourceState | null;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  horizonYearsRange: number[];
  yearlyTotals: Array<{
    year: number;
    totalAmount: number;
    waterAmount: number;
    wastewaterAmount: number;
  }>;
  fiveYearBands: Array<{
    startYear: number;
    endYear: number;
    totalAmount: number;
  }>;
  projects: V2VesinvestProject[];
};

export type V2VesinvestPlanProjectInput = {
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
  allocations?: Array<{
    year: number;
    totalAmount: number;
    waterAmount?: number | null;
    wastewaterAmount?: number | null;
  }>;
};

export type V2VesinvestPlanCreateInput = {
  name?: string;
  horizonYears?: number;
  baselineSourceState?: V2VesinvestBaselineSourceState | null;
  projects?: V2VesinvestPlanProjectInput[];
};

export type V2VesinvestPlanInput = V2VesinvestPlanCreateInput & {
  status?: 'draft' | 'active' | 'archived';
  baselineStatus?: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
};

export type V2ForecastScenarioListItem = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: V2ForecastScenarioType;
  horizonYears: number;
  baselineYear: number | null;
  talousarvioId: string;
  updatedAt: string;
  computedAt: string | null;
  computedFromUpdatedAt: string | null;
  computedYears: number;
};

export type V2ForecastScenarioType =
  | 'base'
  | 'committed'
  | 'hypothesis'
  | 'stress';

export type V2ForecastYear = {
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

export type V2ForecastScenario = {
  id: string;
  name: string;
  onOletus: boolean;
  scenarioType: V2ForecastScenarioType;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: V2YearlyInvestmentPlanRow[];
  nearTermExpenseAssumptions: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>;
  thereafterExpenseAssumptions: {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
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
  years: V2ForecastYear[];
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
  computedAt: string | null;
  computedFromUpdatedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type V2YearlyInvestmentPlanRow = {
  rowId?: string | null;
  year: number;
  amount: number;
  target: string | null;
  category: string | null;
  depreciationClassKey?: string | null;
  depreciationRuleSnapshot?: V2DepreciationRuleSnapshot | null;
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

export type V2YearlyInvestmentPlanInput = {
  rowId?: string | null;
  year: number;
  amount: number;
  target?: string | null;
  category?: string | null;
  depreciationClassKey?: string | null;
  investmentType?: 'replacement' | 'new' | null;
  confidence?: 'low' | 'medium' | 'high' | null;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
  note?: string | null;
  vesinvestPlanId?: string | null;
  vesinvestProjectId?: string | null;
  allocationId?: string | null;
  projectCode?: string | null;
  groupKey?: string | null;
  accountKey?: string | null;
  reportGroupKey?: string | null;
};

export type V2DepreciationRuleMethod =
  | 'linear'
  | 'residual'
  | 'straight-line'
  | 'custom-annual-schedule'
  | 'none';

export type V2EditableDepreciationRuleMethod =
  | 'residual'
  | 'straight-line'
  | 'none';

export type V2DepreciationRule = {
  id: string;
  assetClassKey: string;
  assetClassName: string | null;
  method: V2DepreciationRuleMethod;
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule?: number[] | null;
  createdAt: string;
  updatedAt: string;
};

export type V2DepreciationRuleSnapshot = {
  assetClassKey: string;
  assetClassName: string | null;
  method: V2DepreciationRuleMethod;
  linearYears: number | null;
  residualPercent: number | null;
  annualSchedule?: number[] | null;
};

export type V2ScenarioClassAllocationYear = {
  year: number;
  allocations: Array<{ classKey: string; sharePct: number }>;
};

export async function listDepreciationRulesV2(): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>('/v2/forecast/depreciation-rules');
}

export async function listScenarioDepreciationRulesV2(
  scenarioId: string,
): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
  );
}

export async function createDepreciationRuleV2(data: {
  assetClassKey: string;
  assetClassName?: string;
  method: V2EditableDepreciationRuleMethod;
  linearYears?: number;
  residualPercent?: number;
}): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>('/v2/forecast/depreciation-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createScenarioDepreciationRuleV2(
  scenarioId: string,
  data: {
    assetClassKey: string;
    assetClassName?: string;
    method: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function updateDepreciationRuleV2(
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export async function deleteDepreciationRuleV2(
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getScenarioClassAllocationsV2(
  scenarioId: string,
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`);
}

export async function updateScenarioClassAllocationsV2(
  scenarioId: string,
  data: { years: V2ScenarioClassAllocationYear[] },
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export type V2ReportListItem = {
  id: string;
  title: string;
  createdAt: string;
  ennuste: { id: string; nimi: string | null };
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  baselineSourceSummary?: V2BaselineSourceSummary | null;
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
};

export type V2ReportDetail = {
  id: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  ennuste: { id: string; nimi: string | null };
  snapshot: {
    scenario: V2ForecastScenario;
    generatedAt: string;
    acceptedBaselineYears: number[];
    baselineSourceSummaries: V2BaselineSourceSummary[];
    baselineSourceSummary: V2BaselineSourceSummary | null;
    vesinvestPlan?: {
      id: string;
      seriesId?: string;
      name: string;
      utilityName: string;
      businessId?: string | null;
      veetiId?: number | null;
      identitySource?: 'veeti' | null;
      versionNumber: number;
      status?: string;
      baselineFingerprint?: string | null;
      scenarioFingerprint?: string | null;
      feeRecommendation?: V2VesinvestFeeRecommendation | null;
    } | null;
    vesinvestAppendix?: {
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
        classKey: string;
        classLabel: string;
        totalAmount: number;
        projects: Array<{
          code: string;
          name: string;
          classKey: string;
          classLabel: string;
          accountKey: string | null;
          allocations: Array<{
            year: number;
            totalAmount: number;
            waterAmount: number | null;
            wastewaterAmount: number | null;
          }>;
          totalAmount: number;
        }>;
      }>;
      depreciationPlan: Array<{
        classKey: string;
        classLabel: string;
        accountKey: string | null;
        serviceSplit: 'water' | 'wastewater' | 'mixed';
        method: V2DepreciationRuleMethod;
        linearYears: number | null;
        residualPercent: number | null;
      }>;
    } | null;
    reportVariant: 'public_summary' | 'confidential_appendix';
    reportSections: {
      baselineSources: boolean;
      investmentPlan: boolean;
      assumptions: boolean;
      yearlyInvestments: boolean;
      riskSummary: boolean;
    };
  };
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
};

export async function getOverviewV2(): Promise<V2OverviewResponse> {
  return dedupeInFlightGet('GET /v2/overview', () =>
    api<V2OverviewResponse>('/v2/overview'),
  );
}

export async function getPlanningContextV2(
  options?: GetRequestOptions,
): Promise<V2PlanningContextResponse> {
  return getCachedGet(
    'GET /v2/context',
    () => api<V2PlanningContextResponse>('/v2/context'),
    options,
  );
}

export async function refreshOverviewPeerV2(vuosi?: number): Promise<{
  targetYear: number;
  recompute: {
    vuosi: number;
    computed: number;
    sourceOrgCount: number;
    computedAt: string;
  };
  peerSnapshot: V2PeerSnapshot;
}> {
  return api('/v2/overview/peer-refresh', {
    method: 'POST',
    body: JSON.stringify({ vuosi }),
  });
}

export async function searchImportOrganizationsV2(
  q: string,
  limit = 25,
): Promise<VeetiOrganizationSearchHit[]> {
  const normalizedQuery = q.trim();
  const safeLimit = Math.min(Math.max(Math.round(limit) || 25, 1), 25);
  return api<VeetiOrganizationSearchHit[]>(
    `/v2/import/search?q=${encodeURIComponent(normalizedQuery)}&limit=${safeLimit}`,
  );
}

export async function connectImportOrganizationV2(
  veetiId: number,
): Promise<VeetiConnectResult> {
  return api<VeetiConnectResult>('/v2/import/connect', {
    method: 'POST',
    body: JSON.stringify({ veetiId }),
  });
}

export async function importYearsV2(years: number[]): Promise<{
  selectedYears: number[];
  importedYears: number[];
  workspaceYears: number[];
  skippedYears: Array<{ vuosi: number; reason: string }>;
  sync: VeetiConnectResult;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/import', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function createPlanningBaselineV2(years: number[]): Promise<{
  selectedYears: number[];
  includedYears: number[];
  skippedYears: Array<{ vuosi: number; reason: string }>;
  planningBaseline: {
    success: boolean;
    count: number;
    results: Array<{
      budgetId: string;
      vuosi: number;
      mode: 'created' | 'updated';
    }>;
  };
  status: V2ImportStatus;
}> {
  const result = await api<{
    selectedYears: number[];
    includedYears: number[];
    skippedYears: Array<{ vuosi: number; reason: string }>;
    planningBaseline: {
      success: boolean;
      count: number;
      results: Array<{
        budgetId: string;
        vuosi: number;
        mode: 'created' | 'updated';
      }>;
    };
    status: V2ImportStatus;
  }>('/v2/import/planning-baseline', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
  invalidateCachedGets('GET /v2/context', 'GET /v2/forecast/scenarios');
  return result;
}

// Legacy review/fix helper. Step-2 import should use importYearsV2 and
// planning-baseline creation should use createPlanningBaselineV2.
export async function syncImportV2(years: number[]): Promise<{
  selectedYears: number[];
  importedYears: number[];
  workspaceYears: number[];
  sync: VeetiConnectResult;
  sanity?: {
    checkedAt: string;
    rows: Array<{
      year: number;
      status: 'ok' | 'mismatch' | 'missing_live' | 'missing_effective';
      mismatches: string[];
    }>;
  };
  generatedBudgets: {
    success: boolean;
    count: number;
    results: Array<{
      budgetId: string;
      vuosi: number;
      mode: 'created' | 'updated';
    }>;
    skipped?: Array<{ vuosi: number; reason: string }>;
  };
  status: V2ImportStatus;
}> {
  return api('/v2/import/sync', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function getImportStatusV2(): Promise<V2ImportStatus> {
  return dedupeInFlightGet('GET /v2/import/status', () =>
    api<V2ImportStatus>('/v2/import/status'),
  );
}

export async function deleteImportYearV2(year: number): Promise<{
  vuosi: number;
  deletedSnapshots: number;
  deletedOverrides?: number;
  deletedBudgets: number;
  excludedPolicyApplied?: boolean;
  status: V2ImportStatus;
}> {
  return api(`/v2/import/years/${year}`, {
    method: 'DELETE',
  });
}

export async function deleteImportYearsBulkV2(years: number[]): Promise<{
  requestedYears: number[];
  deletedCount: number;
  failedCount: number;
  results: Array<
    | {
        vuosi: number;
        ok: true;
        deletedSnapshots: number;
        deletedOverrides?: number;
        deletedBudgets: number;
        excludedPolicyApplied?: boolean;
      }
    | {
        vuosi: number;
        ok: false;
        error: string;
      }
  >;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function excludeImportYearsV2(years: number[]): Promise<{
  requestedYears: number[];
  excludedCount: number;
  alreadyExcludedCount: number;
  results: Array<{
    vuosi: number;
    excluded: boolean;
    reason: string | null;
  }>;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/exclude', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function restoreImportYearsV2(years: number[]): Promise<{
  requestedYears: number[];
  restoredCount: number;
  notExcludedCount: number;
  results: Array<{
    vuosi: number;
    restored: boolean;
    reason: string | null;
  }>;
  status: V2ImportStatus;
}> {
  return api('/v2/import/years/restore', {
    method: 'POST',
    body: JSON.stringify({ years }),
  });
}

export async function clearImportAndScenariosV2(confirmToken: string): Promise<{
  deletedScenarios: number;
  deletedVeetiBudgets: number;
  deletedVeetiSnapshots: number;
  deletedVeetiOverrides?: number;
  deletedVeetiYearPolicies?: number;
  deletedVesinvestPlanSeries?: number;
  deletedVeetiLinks: number;
  status: V2ImportStatus;
}> {
  // V2 account drawer destructive action. Backend handler: POST /v2/import/clear.
  const result = await api<{
    deletedScenarios: number;
    deletedVeetiBudgets: number;
    deletedVeetiSnapshots: number;
    deletedVeetiOverrides?: number;
    deletedVeetiYearPolicies?: number;
    deletedVesinvestPlanSeries?: number;
    deletedVeetiLinks: number;
    status: V2ImportStatus;
  }>('/v2/import/clear', {
    method: 'POST',
    body: JSON.stringify({ confirmToken }),
  });
  invalidateCachedGets(
    'GET /v2/context',
    'GET /v2/forecast/scenarios',
    'GET /v2/reports',
    'GET /v2/vesinvest/plans',
  );
  return result;
}

export async function completeImportYearManuallyV2(
  payload: V2ManualYearPatchPayload,
): Promise<V2ManualYearPatchResponse> {
  return api('/v2/import/manual-year', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getImportYearDataV2(
  year: number,
): Promise<V2ImportYearDataResponse> {
  return api(`/v2/import/years/${year}/data`);
}

export async function previewStatementImportV2(
  year: number,
  file: File,
): Promise<V2StatementPreviewResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('statementType', 'result_statement');
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/v2/import/years/${year}/statement-preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    const message = 'Session expired. Please log in again.';
    clearToken('expired', message);
    throw new Error(message);
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  return res.json();
}

export async function previewWorkbookImportV2(
  file: File,
): Promise<V2WorkbookPreviewResponse> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/v2/import/workbook-preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    const message = 'Session expired. Please log in again.';
    clearToken('expired', message);
    throw new Error(message);
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  return res.json();
}

export async function reconcileImportYearV2(
  year: number,
  payload: {
    action: 'keep_manual' | 'apply_veeti';
    dataTypes?: string[];
  },
): Promise<{
  year: number;
  action: 'keep_manual' | 'apply_veeti';
  reconciledDataTypes: string[];
  status: V2ImportStatus;
  yearData: V2ImportYearDataResponse;
}> {
  return api(`/v2/import/years/${year}/reconcile`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function trackOpsEventV2(
  payload: V2OpsEventPayload,
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  await fetch(`${API_BASE}/v2/ops/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  });
}

export async function getOpsFunnelV2(): Promise<V2OpsFunnelSnapshot> {
  return api<V2OpsFunnelSnapshot>('/v2/ops/funnel');
}

export async function listForecastScenariosV2(
  options?: GetRequestOptions,
): Promise<V2ForecastScenarioListItem[]> {
  return getCachedGet(
    'GET /v2/forecast/scenarios',
    () => api<V2ForecastScenarioListItem[]>('/v2/forecast/scenarios'),
    options,
  );
}

export async function createForecastScenarioV2(data: {
  name?: string;
  talousarvioId?: string;
  horizonYears?: number;
  copyFromScenarioId?: string;
  scenarioType?: V2ForecastScenarioType;
  compute?: boolean;
}): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>('/v2/forecast/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`);
}

export async function updateForecastScenarioV2(
  id: string,
  data: {
    name?: string;
    horizonYears?: number;
    scenarioType?: V2ForecastScenarioType;
    yearlyInvestments?: V2YearlyInvestmentPlanInput[];
    scenarioAssumptions?: Partial<
      Record<
        | 'inflaatio'
        | 'energiakerroin'
        | 'henkilostokerroin'
        | 'vesimaaran_muutos'
        | 'hintakorotus'
        | 'perusmaksuMuutos'
        | 'investointikerroin',
        number
      >
    >;
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
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteForecastScenarioV2(id: string): Promise<void> {
  await api(`/v2/forecast/scenarios/${id}`, { method: 'DELETE' });
}

export async function computeForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}/compute`, {
    method: 'POST',
  });
}

export async function listVesinvestGroupsV2(): Promise<V2VesinvestGroupDefinition[]> {
  return api<V2VesinvestGroupDefinition[]>('/v2/vesinvest/groups');
}

export async function updateVesinvestGroupV2(
  key: string,
  body: V2VesinvestGroupUpdateInput,
): Promise<V2VesinvestGroupDefinition> {
  return api<V2VesinvestGroupDefinition>(
    `/v2/vesinvest/groups/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function listVesinvestPlansV2(): Promise<V2VesinvestPlanSummary[]> {
  return api<V2VesinvestPlanSummary[]>('/v2/vesinvest/plans');
}

export async function createVesinvestPlanV2(
  data: V2VesinvestPlanCreateInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>('/v2/vesinvest/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function getVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  return api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`);
}

export async function updateVesinvestPlanV2(
  id: string,
  data: V2VesinvestPlanInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function cloneVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}/clone`, {
    method: 'POST',
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function syncVesinvestPlanToForecastV2(
  id: string,
  data?: {
    compute?: boolean;
    baselineSourceState?: V2VesinvestBaselineSourceState | null;
  },
): Promise<{ plan: V2VesinvestPlan; scenarioId: string }> {
  const result = await api<{ plan: V2VesinvestPlan; scenarioId: string }>(
    `/v2/vesinvest/plans/${id}/forecast-sync`,
    {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    },
  );
  invalidateCachedGets('GET /v2/context', 'GET /v2/forecast/scenarios');
  return result;
}

export async function listReportsV2(
  ennusteId?: string,
  options?: GetRequestOptions,
): Promise<V2ReportListItem[]> {
  const query = ennusteId ? `?ennusteId=${encodeURIComponent(ennusteId)}` : '';
  return getCachedGet(
    `GET /v2/reports${query}`,
    () => api<V2ReportListItem[]>(`/v2/reports${query}`),
    options,
  );
}

export async function createReportV2(data: {
  ennusteId?: string;
  vesinvestPlanId: string;
  title?: string;
  variant?: 'public_summary' | 'confidential_appendix';
}): Promise<{
  reportId: string;
  title: string;
  createdAt: string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  totalInvestments: number;
  variant: 'public_summary' | 'confidential_appendix';
  pdfUrl: string;
}> {
  const result = await api<{
    reportId: string;
    title: string;
    createdAt: string;
    baselineYear: number;
    requiredPriceToday: number;
    requiredAnnualIncreasePct: number;
    totalInvestments: number;
    variant: 'public_summary' | 'confidential_appendix';
    pdfUrl: string;
  }>('/v2/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/reports');
  return result;
}

export async function getReportV2(id: string): Promise<V2ReportDetail> {
  return api<V2ReportDetail>(`/v2/reports/${id}`);
}

export function getReportPdfUrlV2(id: string): string {
  return `${API_BASE}/v2/reports/${id}/pdf`;
}

export async function downloadReportPdfV2(id: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  const token = getToken();
  const res = await fetch(getReportPdfUrlV2(id), {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) {
    const message = 'Session expired. Please log in again.';
    clearToken('expired', message);
    throw new Error(message);
  }

  if (!res.ok) {
    const parsed = await parseApiErrorResponse(res);
    throw createApiError(res.status, parsed);
  }

  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition') ?? '';
  const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  const rawName = utf8Name ? decodeURIComponent(utf8Name) : quotedName;
  const filename =
    rawName && rawName.toLowerCase().endsWith('.pdf')
      ? rawName
      : `report-${id}.pdf`;

  return { blob, filename };
}