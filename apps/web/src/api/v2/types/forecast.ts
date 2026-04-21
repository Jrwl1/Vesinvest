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

