import type { V2DepreciationRuleMethod,V2ForecastScenario } from './forecast';
import type { V2BaselineSourceSummary } from './shared';
import type {
  V2TariffAllocationPolicy,
  V2TariffBaselineInput,
  V2TariffReadinessChecklist,
  V2TariffRecommendation,
  V2VesinvestFeeRecommendation,
} from './vesinvest';

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
      assetEvidenceState?: Record<string, unknown> | null;
      municipalPlanContext?: Record<string, unknown> | null;
      maintenanceEvidenceState?: Record<string, unknown> | null;
      conditionStudyState?: Record<string, unknown> | null;
      financialRiskState?: Record<string, unknown> | null;
      publicationState?: Record<string, unknown> | null;
      communicationState?: Record<string, unknown> | null;
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
    tariffPlan?: {
      id: string;
      status: 'draft' | 'accepted' | 'stale';
      acceptedAt: string | null;
      baselineInput: V2TariffBaselineInput;
      allocationPolicy: V2TariffAllocationPolicy;
      recommendation: V2TariffRecommendation;
      readinessChecklist: V2TariffReadinessChecklist;
      revenueEvidence?: Record<string, unknown> | null;
      costEvidence?: Record<string, unknown> | null;
      regionalDifferentiationState?: Record<string, unknown> | null;
      stormwaterState?: Record<string, unknown> | null;
      specialUseState?: Record<string, unknown> | null;
      connectionFeeLiabilityState?: Record<string, unknown> | null;
      ownerDistributionState?: Record<string, unknown> | null;
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
