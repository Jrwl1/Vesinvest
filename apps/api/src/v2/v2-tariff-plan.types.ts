export type TariffFeeKey =
  | 'connectionFee'
  | 'baseFee'
  | 'waterUsageFee'
  | 'wastewaterUsageFee';

export type TariffBaselineInput = {
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

export type TariffAllocationPolicy = {
  connectionFeeSharePct?: number | null;
  baseFeeSharePct?: number | null;
  waterUsageSharePct?: number | null;
  wastewaterUsageSharePct?: number | null;
  smoothingYears?: number | null;
  regionalVariationApplies?: boolean | null;
  stormwaterApplies?: boolean | null;
  financialRiskAssessment?: string | null;
};

export type TariffPlanBody = {
  baselineInput?: TariffBaselineInput | null;
  allocationPolicy?: TariffAllocationPolicy | null;
};

export type TariffFeeRecommendation = {
  key: TariffFeeKey;
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

export type TariffReadinessChecklist = {
  isReady: boolean;
  assetPlan20YearPresent: boolean;
  trustedBaselinePresent: boolean;
  currentTariffBaselinePresent: boolean;
  investmentFinancingNeedPresent: boolean;
  riskAssessmentPresent: boolean;
  smoothingStatus: 'ok' | 'exceeds_15_pct' | 'missing';
  regionalVariationFlag: boolean;
  stormwaterFlag: boolean;
  unresolvedManualAssumptions: string[];
};

export type TariffRecommendation = {
  savedAt: string;
  linkedScenarioId: string;
  vesinvestPlanId: string;
  baselineFingerprint: string | null;
  scenarioFingerprint: string | null;
  targetAdditionalAnnualRevenue: number;
  baselineAnnualRevenue: number;
  proposedAnnualRevenue: number;
  smoothingYears: number;
  averageAnnualIncreasePct: number | null;
  fees: Record<TariffFeeKey, TariffFeeRecommendation>;
  lawReadiness: TariffReadinessChecklist;
};
