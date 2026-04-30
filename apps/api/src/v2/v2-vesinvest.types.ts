import { Prisma } from '@prisma/client';
import type { VesinvestUtilityIdentitySnapshot } from './vesinvest-contract';

export type PlanEvidenceBody = {
  assetEvidenceState?: Record<string, unknown> | null;
  municipalPlanContext?: Record<string, unknown> | null;
  maintenanceEvidenceState?: Record<string, unknown> | null;
  conditionStudyState?: Record<string, unknown> | null;
  financialRiskState?: Record<string, unknown> | null;
  publicationState?: Record<string, unknown> | null;
  communicationState?: Record<string, unknown> | null;
};

export type PlanProjectAllocationInput = {
  year: number;
  totalAmount: number;
  waterAmount?: number | null;
  wastewaterAmount?: number | null;
};

export type PlanProjectInput = {
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
  allocations?: PlanProjectAllocationInput[];
};

export type CreatePlanBody = PlanEvidenceBody & {
  name?: string;
  utilityName?: string;
  businessId?: string | null;
  veetiId?: number | null;
  identitySource?: 'manual' | 'veeti' | 'mixed';
  horizonYears?: number;
  baselineSourceState?: Record<string, unknown> | null;
  projects?: PlanProjectInput[];
};

export type UpdatePlanBody = PlanEvidenceBody & {
  expectedUpdatedAt?: string | null;
  name?: string;
  utilityName?: string;
  businessId?: string | null;
  veetiId?: number | null;
  identitySource?: 'manual' | 'veeti' | 'mixed';
  horizonYears?: number;
  status?: 'draft' | 'active' | 'archived';
  baselineStatus?: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus?: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
  baselineSourceState?: Record<string, unknown> | null;
  projects?: PlanProjectInput[];
};

export type SyncPlanBody = {
  compute?: boolean;
  baselineSourceState?: Record<string, unknown> | null;
};

export type UpdateGroupDefinitionBody = {
  label?: string;
  defaultAccountKey?: string;
  defaultDepreciationClassKey?: string | null;
  reportGroupKey?: string;
  serviceSplit?: 'water' | 'wastewater' | 'mixed';
};

export type CurrentBaselineSnapshot = {
  hasTrustedBaseline: boolean;
  acceptedYears: number[];
  latestAcceptedBudgetId: string | null;
  baselineYears: Array<Record<string, unknown>>;
  utilityIdentity: VesinvestUtilityIdentitySnapshot | null;
  fingerprint: string;
};

export type VesinvestPlanRecord = Prisma.VesinvestPlanGetPayload<{
  include: {
    projects: {
      include: {
        allocations: true;
      };
    };
    selectedScenario: {
      select: {
        id: true;
        updatedAt: true;
        computedAt: true;
        computedFromUpdatedAt: true;
      };
    };
    tariffPlans: {
      select: {
        id: true;
        scenarioId: true;
        status: true;
        acceptedAt: true;
        updatedAt: true;
        recommendation: true;
      };
    };
  };
}>;

export type SavedBaselineSourceState = {
  acceptedYears: number[];
  latestAcceptedBudgetId: string | null;
  veetiId: number | null;
  utilityName: string | null;
  businessId: string | null;
  identitySource: 'veeti' | null;
};

export type NormalizedPlanProjectAllocation = {
  year: number;
  totalAmount: number;
  waterAmount: number | null;
  wastewaterAmount: number | null;
};

export type NormalizedPlanProject = {
  code: string;
  name: string;
  investmentType: 'sanering' | 'nyanlaggning' | 'reparation';
  groupKey: string;
  depreciationClassKey: string | null;
  accountKey: string | null;
  reportGroupKey: string | null;
  subtype: string | null;
  notes: string | null;
  waterAmount: number | null;
  wastewaterAmount: number | null;
  totalAmount: number;
  allocations: NormalizedPlanProjectAllocation[];
};

export type NormalizedPlanPayload = {
  name: string;
  utilityName: string;
  businessId: string | null;
  veetiId: number | null;
  identitySource: 'manual' | 'veeti' | 'mixed';
  horizonYears: number;
  baselineSourceState: Prisma.InputJsonValue | null | undefined;
  assetEvidenceState: Prisma.InputJsonValue | null | undefined;
  municipalPlanContext: Prisma.InputJsonValue | null | undefined;
  maintenanceEvidenceState: Prisma.InputJsonValue | null | undefined;
  conditionStudyState: Prisma.InputJsonValue | null | undefined;
  financialRiskState: Prisma.InputJsonValue | null | undefined;
  publicationState: Prisma.InputJsonValue | null | undefined;
  communicationState: Prisma.InputJsonValue | null | undefined;
  projects: NormalizedPlanProject[];
};
