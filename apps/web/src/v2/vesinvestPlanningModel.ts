import type { TFunction } from 'i18next';

import type {
  V2PlanningContextResponse,
  V2VesinvestBaselineSourceState,
  V2VesinvestGroupDefinition,
  V2VesinvestPlan,
  V2VesinvestPlanCreateInput,
  V2VesinvestPlanInput,
  V2VesinvestProject,
} from '../api';
import { formatEur } from './format';

export type VesinvestLinkedOrg =
  | {
      veetiId?: number | null;
      nimi?: string | null;
      ytunnus?: string | null;
    }
  | null
  | undefined;

export type VesinvestDraft = {
  id?: string;
  name: string;
  utilityName: string;
  businessId: string | null;
  veetiId: number | null;
  identitySource: 'manual' | 'veeti' | 'mixed';
  horizonYears: number;
  status?: 'draft' | 'active' | 'archived';
  baselineStatus: 'draft' | 'incomplete' | 'verified';
  feeRecommendationStatus: 'blocked' | 'provisional' | 'verified';
  lastReviewedAt?: string | null;
  reviewDueAt?: string | null;
  horizonYearsRange: number[];
  projects: V2VesinvestProject[];
};

export type VesinvestBaselineYear =
  NonNullable<V2PlanningContextResponse>['baselineYears'][number];

export type VesinvestGroupedMatrixSection = {
  groupKey: string;
  groupLabel: string;
  totalAmount: number;
  yearlyTotals: Array<{
    year: number;
    totalAmount: number;
  }>;
  projects: Array<{
    code: string;
    name: string;
    totalAmount: number;
    yearlyTotals: Array<{
      year: number;
      totalAmount: number;
    }>;
  }>;
};

export type VesinvestWorkspaceView = 'investment' | 'depreciation';

export const FALLBACK_GROUP_KEY = 'sanering_water_network';

export const buildHorizonYears = (startYear: number, horizonYears: number) =>
  Array.from({ length: horizonYears }, (_, index) => startYear + index);

export const resolveProjectGroup = (
  groups: V2VesinvestGroupDefinition[],
  preferredKey?: string | null,
) =>
  groups.find((item) => item.key === preferredKey) ??
  groups.find((item) => item.key === FALLBACK_GROUP_KEY) ??
  groups[0] ??
  null;

export const buildDraftFromPlan = (
  plan: V2VesinvestPlan | null,
  linkedOrg: VesinvestLinkedOrg,
): VesinvestDraft => {
  if (plan) {
    return {
      id: plan.id,
      name: plan.name,
      utilityName: plan.utilityName,
      businessId: plan.businessId,
      veetiId: plan.veetiId,
      identitySource: plan.identitySource,
      horizonYears: plan.horizonYears,
      status: plan.status,
      baselineStatus: plan.baselineStatus,
      feeRecommendationStatus: plan.feeRecommendationStatus,
      lastReviewedAt: plan.lastReviewedAt,
      reviewDueAt: plan.reviewDueAt,
      horizonYearsRange: [...plan.horizonYearsRange],
      projects: plan.projects.map((project) => ({
        ...project,
        allocations: project.allocations.map((allocation) => ({ ...allocation })),
      })),
    };
  }
  const currentYear = new Date().getFullYear();
  return {
    name: linkedOrg?.nimi ? `${linkedOrg.nimi} Vesinvest` : 'Vesinvest',
    utilityName: linkedOrg?.nimi ?? '',
    businessId: linkedOrg?.ytunnus ?? null,
    veetiId: linkedOrg?.veetiId ?? null,
    identitySource: linkedOrg?.veetiId ? 'mixed' : 'manual',
    horizonYears: 20,
    baselineStatus: 'draft',
    feeRecommendationStatus: 'blocked',
    horizonYearsRange: buildHorizonYears(currentYear, 20),
    projects: [],
  };
};

const toPlanProjectInputs = (draft: VesinvestDraft) =>
  draft.projects.map((project) => ({
    code: project.code,
    name: project.name,
    investmentType: project.investmentType,
    groupKey: project.groupKey,
    depreciationClassKey: project.depreciationClassKey,
    accountKey: project.defaultAccountKey,
    reportGroupKey: project.reportGroupKey,
    subtype: project.subtype,
    notes: project.notes,
    waterAmount: project.waterAmount,
    wastewaterAmount: project.wastewaterAmount,
    allocations: project.allocations.map((allocation) => ({
      year: allocation.year,
      totalAmount: allocation.totalAmount,
      waterAmount: allocation.waterAmount,
      wastewaterAmount: allocation.wastewaterAmount,
    })),
  }));

export const toCreatePlanInput = (
  draft: VesinvestDraft,
  baselineSourceState: V2VesinvestBaselineSourceState | null,
): V2VesinvestPlanCreateInput => ({
  name: draft.name,
  horizonYears: draft.horizonYears,
  baselineSourceState,
  projects: toPlanProjectInputs(draft),
});

export const toUpdatePlanInput = (
  draft: VesinvestDraft,
  baselineSourceState: V2VesinvestBaselineSourceState | null,
): V2VesinvestPlanInput => ({
  name: draft.name,
  horizonYears: draft.horizonYears,
  status: draft.status,
  baselineStatus: draft.baselineStatus,
  feeRecommendationStatus: draft.feeRecommendationStatus,
  lastReviewedAt: draft.lastReviewedAt,
  reviewDueAt: draft.reviewDueAt,
  baselineSourceState,
  projects: toPlanProjectInputs(draft),
});

export const createProject = (
  years: number[],
  groups: V2VesinvestGroupDefinition[],
  index: number,
  seed: {
    code: string;
    name: string;
    groupKey: string;
  },
): V2VesinvestProject => {
  const group = resolveProjectGroup(groups, seed.groupKey);
  const resolvedGroupKey = group?.key ?? seed.groupKey ?? FALLBACK_GROUP_KEY;
  return {
    code: seed.code.trim() || `P-${String(index + 1).padStart(3, '0')}`,
    name: seed.name.trim(),
    investmentType: resolveInvestmentTypeFromGroupKey(resolvedGroupKey),
    groupKey: resolvedGroupKey,
    groupLabel: group?.label ?? resolvedGroupKey,
    depreciationClassKey: group?.defaultDepreciationClassKey ?? group?.key ?? null,
    defaultAccountKey: group?.defaultAccountKey ?? null,
    reportGroupKey: group?.reportGroupKey ?? null,
    subtype: null,
    notes: null,
    waterAmount: 0,
    wastewaterAmount: 0,
    totalAmount: 0,
    allocations: years.map((year) => ({
      year,
      totalAmount: 0,
      waterAmount: 0,
      wastewaterAmount: 0,
    })),
  };
};

export const resolveInvestmentTypeFromGroupKey = (
  groupKey: string,
): V2VesinvestProject['investmentType'] =>
  groupKey.startsWith('new_')
    ? 'nyanlaggning'
    : groupKey.startsWith('repair_')
    ? 'reparation'
    : 'sanering';

export const typeLabel = (t: TFunction, value: V2VesinvestProject['investmentType']) =>
  value === 'nyanlaggning'
    ? t('v2Vesinvest.typeNewBuild', 'New build')
    : value === 'reparation'
    ? t('v2Vesinvest.typeRepair', 'Repair')
    : t('v2Vesinvest.typeSanering', 'Rehabilitation');

export const parseNullableNumberInput = (value: string): number | undefined => {
  const normalized = value.trim().replace(',', '.');
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const allocationFieldLabel = (
  t: TFunction,
  fieldKey: 'totalAmount' | 'waterAmount' | 'wastewaterAmount',
) =>
  fieldKey === 'totalAmount'
    ? t('v2Vesinvest.projectTotal', 'Total')
    : fieldKey === 'waterAmount'
    ? t('v2Vesinvest.projectWaterTotal', 'Water total')
    : t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total');

export const toneClass = (
  status: 'draft' | 'incomplete' | 'verified' | 'blocked' | 'provisional',
) =>
  status === 'verified'
    ? 'v2-status-positive'
    : status === 'incomplete' || status === 'provisional'
    ? 'v2-status-warning'
    : 'v2-status-neutral';

export const round2 = (value: number) => Math.round(value * 100) / 100;

export const formatPlanMatrixAmount = (value: number) =>
  Math.abs(value) > 0.004 ? formatEur(value) : '';

export const syncProjectTotals = (project: V2VesinvestProject): V2VesinvestProject => {
  const waterAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.waterAmount ?? 0), 0),
  );
  const wastewaterAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.wastewaterAmount ?? 0), 0),
  );
  const totalAmount = round2(
    project.allocations.reduce((sum, allocation) => sum + (allocation.totalAmount ?? 0), 0),
  );
  return {
    ...project,
    waterAmount,
    wastewaterAmount,
    totalAmount,
  };
};

export const cloneJson = <T,>(value: T): T =>
  JSON.parse(JSON.stringify(value)) as T;
