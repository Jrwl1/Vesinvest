export type ReportVariant = 'public_summary' | 'confidential_appendix';

export type ReportSections = {
  baselineSources: boolean;
  investmentPlan: boolean;
  assumptions: boolean;
  yearlyInvestments: boolean;
  riskSummary: boolean;
};

export type DatasetProvenance = {
  kind?: string | null;
  fileName?: string | null;
  pageNumber?: number | null;
  pageNumbers?: number[] | null;
  sourceLines?:
    | Array<{
        text?: string | null;
        pageNumber?: number | null;
      }>
    | null;
  documentProfile?: string | null;
  fieldSources?: Array<{
    provenance: {
      kind?: string | null;
      fileName?: string | null;
      pageNumber?: number | null;
      pageNumbers?: number[] | null;
      sourceLines?:
        | Array<{
            text?: string | null;
            pageNumber?: number | null;
          }>
        | null;
    };
  }> | null;
} | null;

export type BaselineDatasetSource = {
  source: 'veeti' | 'manual' | 'none';
  provenance: DatasetProvenance;
} | null;

export type BaselineSourceSummary = {
  year?: number;
  planningRole?: 'historical' | 'current_year_estimate';
  sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
  sourceBreakdown?: {
    veetiDataTypes?: string[];
    manualDataTypes?: string[];
  };
  financials?: BaselineDatasetSource;
  prices?: BaselineDatasetSource;
  volumes?: BaselineDatasetSource;
} | null;

export type ScenarioSnapshot = {
  scenarioType?: 'base' | 'committed' | 'hypothesis' | 'stress';
  assumptions?: Record<string, number>;
  baselinePriceTodayCombined?: number | null;
  requiredPriceTodayCombinedAnnualResult?: number | null;
  requiredAnnualIncreasePctAnnualResult?: number | null;
  requiredPriceTodayCombinedCumulativeCash?: number | null;
  requiredAnnualIncreasePctCumulativeCash?: number | null;
  feeSufficiency?: {
    annualResult?: {
      underfundingStartYear?: number | null;
      peakDeficit?: number | null;
    };
    cumulativeCash?: {
      underfundingStartYear?: number | null;
      peakGap?: number | null;
    };
  };
  years?: Array<{
    year: number;
    revenue: number;
    costs: number;
    result: number;
    investments: number;
    totalDepreciation: number;
    combinedPrice: number;
    waterPrice: number;
    wastewaterPrice: number;
    soldVolume: number;
    cashflow: number;
    cumulativeCashflow: number;
  }>;
  nearTermExpenseAssumptions?: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>;
  thereafterExpenseAssumptions?: {
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  };
  yearlyInvestments?: Array<{
    year: number;
    amount: number;
    category?: string | null;
    investmentType?: string | null;
    confidence?: string | null;
    note?: string | null;
  }>;
} | null;

export type ReportSnapshot = {
  scenario?: ScenarioSnapshot;
  acceptedBaselineYears?: number[];
  baselineSourceSummaries?: BaselineSourceSummary[];
  baselineSourceSummary?: BaselineSourceSummary;
  vesinvestPlan?: {
    name?: string | null;
    versionNumber?: number | null;
    assetEvidenceState?: Record<string, unknown> | null;
    municipalPlanContext?: Record<string, unknown> | null;
    maintenanceEvidenceState?: Record<string, unknown> | null;
    conditionStudyState?: Record<string, unknown> | null;
    financialRiskState?: Record<string, unknown> | null;
    publicationState?: Record<string, unknown> | null;
    communicationState?: Record<string, unknown> | null;
  } | null;
  vesinvestAppendix?: {
    yearlyTotals?: Array<{
      year: number;
      totalAmount: number;
    }>;
    fiveYearBands?: Array<{
      startYear: number;
      endYear: number;
      totalAmount: number;
    }>;
    groupedProjects?: Array<{
      classKey: string;
      classLabel: string;
      totalAmount: number;
      projects?: Array<{
        code: string;
        name: string;
        classKey: string;
        classLabel: string;
        accountKey?: string | null;
        allocations?: Array<{
          year: number;
          totalAmount: number;
          waterAmount?: number | null;
          wastewaterAmount?: number | null;
        }>;
        totalAmount: number;
      }>;
    }>;
    depreciationPlan?: Array<{
      classKey: string;
      classLabel: string;
      accountKey?: string | null;
      serviceSplit: 'water' | 'wastewater' | 'mixed';
      method: string;
      linearYears?: number | null;
      residualPercent?: number | null;
    }>;
  } | null;
  tariffPlan?: {
    status?: 'draft' | 'accepted' | 'stale';
    acceptedAt?: string | null;
    revenueEvidence?: Record<string, unknown> | null;
    costEvidence?: Record<string, unknown> | null;
    regionalDifferentiationState?: Record<string, unknown> | null;
    stormwaterState?: Record<string, unknown> | null;
    specialUseState?: Record<string, unknown> | null;
    connectionFeeLiabilityState?: Record<string, unknown> | null;
    ownerDistributionState?: Record<string, unknown> | null;
    recommendation?: {
      targetAdditionalAnnualRevenue?: number | null;
      baselineAnnualRevenue?: number | null;
      proposedAnnualRevenue?: number | null;
      averageAnnualIncreasePct?: number | null;
      smoothingYears?: number | null;
      fees?: Record<
        string,
        {
          currentUnit?: number | null;
          proposedUnit?: number | null;
          revenueImpact?: number | null;
          annualIncreasePct?: number | null;
        }
      >;
      lawReadiness?: {
        smoothingStatus?: 'ok' | 'exceeds_15_pct' | 'missing';
        regionalVariationFlag?: boolean;
        stormwaterFlag?: boolean;
        unresolvedManualAssumptions?: string[];
      };
    } | null;
  } | null;
} | null;

export type ReportRecord = {
  title: string;
  createdAt: Date | string;
  baselineYear: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number | null;
  totalInvestments: number;
  ennuste?: {
    nimi?: string | null;
  } | null;
};

export type BuildV2ReportPdfInput = {
  report: ReportRecord;
  snapshot: ReportSnapshot;
  reportVariant: ReportVariant;
  reportSections: ReportSections;
  toPdfText: (value: string) => string;
  normalizeText: (value: string | null | undefined) => string | null;
  toNumber: (value: unknown) => number;
};

