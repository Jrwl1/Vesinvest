import type { V2BaselineDatasetSource } from './shared';

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
  assetEvidenceReady?: boolean;
  assetEvidenceMissingCount?: number;
  baselineChangedSinceAcceptedRevision: boolean;
  investmentPlanChangedSinceFeeRecommendation: boolean;
  tariffPlanStatus?: 'draft' | 'accepted' | 'stale' | null;
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
  assetEvidenceState: Record<string, unknown> | null;
  municipalPlanContext: Record<string, unknown> | null;
  maintenanceEvidenceState: Record<string, unknown> | null;
  conditionStudyState: Record<string, unknown> | null;
  financialRiskState: Record<string, unknown> | null;
  publicationState: Record<string, unknown> | null;
  communicationState: Record<string, unknown> | null;
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
  lawInvestmentSummary: {
    horizonYears: number;
    totalAmount: number;
    renovationAmount: number;
    newInvestmentAmount: number;
    repairAmount: number;
    timeBuckets: Array<{
      key: 'years_1_5' | 'years_6_10' | 'years_11_20' | string;
      startYear: number;
      endYear: number;
      totalAmount: number;
      waterAmount: number;
      wastewaterAmount: number;
    }>;
    byInvestmentType: Array<{
      investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
      projectCount: number;
      totalAmount: number;
    }>;
    byAssetCategory: Array<{
      groupKey: string;
      groupLabel: string;
      projectCount: number;
      totalAmount: number;
      waterAmount: number;
      wastewaterAmount: number;
    }>;
  };
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
  assetEvidenceState?: Record<string, unknown> | null;
  municipalPlanContext?: Record<string, unknown> | null;
  maintenanceEvidenceState?: Record<string, unknown> | null;
  conditionStudyState?: Record<string, unknown> | null;
  financialRiskState?: Record<string, unknown> | null;
  publicationState?: Record<string, unknown> | null;
  communicationState?: Record<string, unknown> | null;
  projects?: V2VesinvestPlanProjectInput[];
};

export type V2VesinvestPlanInput = V2VesinvestPlanCreateInput & {
  status?: 'draft' | 'active' | 'archived';
  baselineStatus?: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
};

export type V2TariffFeeKey =
  | 'connectionFee'
  | 'baseFee'
  | 'waterUsageFee'
  | 'wastewaterUsageFee';

export type V2TariffBaselineInput = {
  connectionFeeAverage?: number | null;
  connectionFeeRevenue?: number | null;
  connectionFeeNewConnections?: number | null;
  connectionFeeBasis?: string | null;
  baseFeeRevenue?: number | null;
  connectionCount?: number | null;
  waterPrice?: number | null;
  wastewaterPrice?: number | null;
  soldWaterVolume?: number | null;
  soldWastewaterVolume?: number | null;
  notes?: string | null;
};

export type V2TariffAllocationPolicy = {
  connectionFeeSharePct?: number | null;
  baseFeeSharePct?: number | null;
  waterUsageSharePct?: number | null;
  wastewaterUsageSharePct?: number | null;
  smoothingYears?: number | null;
  regionalVariationApplies?: boolean | null;
  stormwaterApplies?: boolean | null;
  financialRiskAssessment?: string | null;
};

export type V2TariffEvidenceObject = Record<string, unknown>;

export type V2TariffFeeRecommendation = {
  key: V2TariffFeeKey;
  currentUnit: number | null;
  proposedUnit: number | null;
  currentAnnualRevenue: number | null;
  proposedAnnualRevenue: number | null;
  revenueImpact: number;
  deltaPct: number | null;
  annualIncreasePct: number | null;
  allocationSharePct: number;
  denominator: number | null;
  yearlyPath: Array<{
    yearIndex: number;
    unit: number | null;
    annualRevenue: number | null;
  }>;
};

export type V2TariffReadinessChecklist = {
  isReady: boolean;
  assetPlan20YearPresent: boolean;
  trustedBaselinePresent: boolean;
  currentTariffBaselinePresent: boolean;
  investmentFinancingNeedPresent: boolean;
  riskAssessmentPresent: boolean;
  tariffRevenueEvidencePresent?: boolean;
  costEvidencePresent?: boolean;
  connectionFeeLiabilityPresent?: boolean;
  smoothingStatus: 'ok' | 'exceeds_15_pct' | 'missing';
  regionalVariationFlag: boolean;
  stormwaterFlag: boolean;
  unresolvedManualAssumptions: string[];
};

export type V2TariffRecommendation = {
  savedAt: string;
  linkedScenarioId: string;
  vesinvestPlanId: string;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  priceSignal?: {
    currentComparatorPrice: number | null;
    requiredPriceToday: number | null;
    requiredIncreasePct: number | null;
    cumulativeCashFloorPrice: number | null;
    cumulativeCashFloorIncreasePct: number | null;
  };
  targetAdditionalAnnualRevenue: number;
  baselineAnnualRevenue: number;
  proposedAnnualRevenue: number;
  smoothingYears: number;
  averageAnnualIncreasePct: number | null;
  fees: Record<V2TariffFeeKey, V2TariffFeeRecommendation>;
  revenueTable?: Array<{
    key: V2TariffFeeKey;
    currentAnnualRevenue: number | null;
    proposedAnnualRevenue: number | null;
    revenueImpact: number;
    allocationSharePct: number;
  }>;
  annualChangePath?: Array<{
    yearIndex: number;
    annualRevenue: number | null;
    annualIncreasePct: number | null;
  }>;
  impactFlags?: {
    exceeds15PctAnnualIncrease: boolean;
    regionalVariationApplies: boolean;
    stormwaterApplies: boolean;
    specialUseApplies: boolean;
    connectionFeeLiabilityRecorded: boolean;
    ownerDistributionRecorded: boolean;
  };
  allocationRationale?: string[];
  lawReadiness: V2TariffReadinessChecklist;
};

export type V2TariffPlan = {
  id: string | null;
  vesinvestPlanId: string;
  scenarioId: string;
  status: 'draft' | 'accepted' | 'stale';
  baselineInput: V2TariffBaselineInput;
  allocationPolicy: V2TariffAllocationPolicy;
  recommendation: V2TariffRecommendation;
  readinessChecklist: V2TariffReadinessChecklist;
  revenueEvidence: V2TariffEvidenceObject | null;
  costEvidence: V2TariffEvidenceObject | null;
  regionalDifferentiationState: V2TariffEvidenceObject | null;
  stormwaterState: V2TariffEvidenceObject | null;
  specialUseState: V2TariffEvidenceObject | null;
  connectionFeeLiabilityState: V2TariffEvidenceObject | null;
  ownerDistributionState: V2TariffEvidenceObject | null;
  acceptedAt: string | null;
  updatedAt: string | null;
  createdAt: string | null;
};

export type V2TariffPlanInput = {
  baselineInput?: V2TariffBaselineInput | null;
  allocationPolicy?: V2TariffAllocationPolicy | null;
  revenueEvidence?: V2TariffEvidenceObject | null;
  costEvidence?: V2TariffEvidenceObject | null;
  regionalDifferentiationState?: V2TariffEvidenceObject | null;
  stormwaterState?: V2TariffEvidenceObject | null;
  specialUseState?: V2TariffEvidenceObject | null;
  connectionFeeLiabilityState?: V2TariffEvidenceObject | null;
  ownerDistributionState?: V2TariffEvidenceObject | null;
};
