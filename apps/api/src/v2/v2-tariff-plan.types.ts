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

export type TariffEvidenceObject = Record<string, unknown>;

export type TariffPlanBody = {
  expectedUpdatedAt?: string | null;
  baselineInput?: TariffBaselineInput | null;
  allocationPolicy?: TariffAllocationPolicy | null;
  revenueEvidence?: TariffEvidenceObject | null;
  costEvidence?: TariffEvidenceObject | null;
  regionalDifferentiationState?: TariffEvidenceObject | null;
  stormwaterState?: TariffEvidenceObject | null;
  specialUseState?: TariffEvidenceObject | null;
  connectionFeeLiabilityState?: TariffEvidenceObject | null;
  ownerDistributionState?: TariffEvidenceObject | null;
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
  tariffRevenueEvidencePresent: boolean;
  costEvidencePresent: boolean;
  connectionFeeLiabilityPresent: boolean;
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
  priceSignal: {
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
  fees: Record<TariffFeeKey, TariffFeeRecommendation>;
  revenueTable: Array<{
    key: TariffFeeKey;
    currentAnnualRevenue: number | null;
    proposedAnnualRevenue: number | null;
    revenueImpact: number;
    allocationSharePct: number;
  }>;
  annualChangePath: Array<{
    yearIndex: number;
    annualRevenue: number | null;
    annualIncreasePct: number | null;
  }>;
  impactFlags: {
    exceeds15PctAnnualIncrease: boolean;
    regionalVariationApplies: boolean;
    stormwaterApplies: boolean;
    specialUseApplies: boolean;
    connectionFeeLiabilityRecorded: boolean;
    ownerDistributionRecorded: boolean;
  };
  allocationRationale: string[];
  lawReadiness: TariffReadinessChecklist;
};
