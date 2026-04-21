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

