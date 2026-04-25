import type { TFunction } from 'i18next';
import React from 'react';

import type {
  V2ForecastScenario,
  V2PlanningContextResponse,
  V2VesinvestBaselineSourceState,
  V2VesinvestFeeRecommendation,
  V2VesinvestGroupDefinition,
  V2VesinvestPlan,
  V2VesinvestPlanSummary,
} from '../api';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';
import {
  buildDraftFromPlan,
  FALLBACK_GROUP_KEY,
  round2,
  toUpdatePlanInput,
  type VesinvestDraft,
  type VesinvestGroupedMatrixSection,
  type VesinvestLinkedOrg,
} from './vesinvestPlanningModel';
import {
  buildBaselineSourceSnapshot,
  readSavedBaselineYears,
} from './vesinvestPlanningProvenance';

type ReportReadinessReason =
  | 'missingScenario'
  | 'staleComputeToken'
  | 'classificationReviewRequired'
  | 'assetEvidenceIncomplete'
  | 'unsavedChanges'
  | 'missingComputeResults'
  | 'missingDepreciationSnapshots'
  | 'missingTariffPlan'
  | null;

const hasEvidenceValue = (value: Record<string, unknown> | null | undefined) =>
  typeof value?.notes === 'string' && value.notes.trim().length > 0;

export function useVesinvestPlanningDerivedState({
  t,
  planningContext,
  plan,
  plans,
  selectedPlanId,
  linkedOrg,
  draft,
  groups,
  linkedScenario,
  loadingLinkedScenario,
  reportConflictCode,
}: {
  t: TFunction;
  planningContext: V2PlanningContextResponse | null;
  plan: V2VesinvestPlan | null;
  plans: V2VesinvestPlanSummary[];
  selectedPlanId: string | null;
  linkedOrg: VesinvestLinkedOrg;
  draft: VesinvestDraft;
  groups: V2VesinvestGroupDefinition[];
  linkedScenario: V2ForecastScenario | null;
  loadingLinkedScenario: boolean;
  reportConflictCode: string | null;
}) {
  const yearTotals = React.useMemo(
    () =>
      draft.horizonYearsRange.map((year) => ({
        year,
        totalAmount: draft.projects.reduce((sum, project) => {
          const allocation = project.allocations.find((item) => item.year === year);
          return sum + (allocation?.totalAmount ?? 0);
        }, 0),
      })),
    [draft],
  );

  const fiveYearBands = React.useMemo(() => {
    const bands: Array<{ startYear: number; endYear: number; totalAmount: number }> = [];
    for (let index = 0; index < yearTotals.length; index += 5) {
      const slice = yearTotals.slice(index, index + 5);
      if (slice.length === 0) {
        continue;
      }
      bands.push({
        startYear: slice[0]!.year,
        endYear: slice[slice.length - 1]!.year,
        totalAmount: slice.reduce((sum, item) => sum + item.totalAmount, 0),
      });
    }
    return bands;
  }, [yearTotals]);

  const totalInvestments = React.useMemo(
    () => yearTotals.reduce((sum, item) => sum + item.totalAmount, 0),
    [yearTotals],
  );

  const groupedPlanMatrix = React.useMemo<VesinvestGroupedMatrixSection[]>(() => {
    const groupOrder = new Map(groups.map((group, index) => [group.key, index]));
    const groupLabelByKey = new Map(
      groups.map((group) => [group.key, resolveVesinvestGroupLabel(t, group.key, group.label)]),
    );
    const sections = new Map<
      string,
      {
        groupKey: string;
        groupLabel: string;
        projects: VesinvestGroupedMatrixSection['projects'];
      }
    >();

    for (const project of draft.projects) {
      const groupKey = project.groupKey || FALLBACK_GROUP_KEY;
      const groupLabel =
        groupLabelByKey.get(groupKey) ??
        resolveVesinvestGroupLabel(t, groupKey, project.groupLabel ?? groupKey);
      const yearlyTotals = draft.horizonYearsRange.map((year) => ({
        year,
        totalAmount: round2(
          project.allocations.find((allocation) => allocation.year === year)?.totalAmount ?? 0,
        ),
      }));
      const totalAmount = round2(yearlyTotals.reduce((sum, item) => sum + item.totalAmount, 0));
      const current = sections.get(groupKey) ?? {
        groupKey,
        groupLabel,
        projects: [],
      };
      current.projects.push({
        code: project.code,
        name: project.name,
        totalAmount,
        yearlyTotals,
      });
      sections.set(groupKey, current);
    }

    return [...sections.values()]
      .sort((left, right) => {
        const leftOrder = groupOrder.get(left.groupKey) ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = groupOrder.get(right.groupKey) ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.groupLabel.localeCompare(right.groupLabel);
      })
      .map((section) => {
        const sectionYearTotals = draft.horizonYearsRange.map((year) => ({
          year,
          totalAmount: round2(
            section.projects.reduce(
              (sum, project) =>
                sum + (project.yearlyTotals.find((item) => item.year === year)?.totalAmount ?? 0),
              0,
            ),
          ),
        }));
        return {
          groupKey: section.groupKey,
          groupLabel: section.groupLabel,
          totalAmount: round2(sectionYearTotals.reduce((sum, item) => sum + item.totalAmount, 0)),
          yearlyTotals: sectionYearTotals,
          projects: section.projects,
        };
      });
  }, [draft.horizonYearsRange, draft.projects, groups, t]);

  const savedBaselineSource = React.useMemo(() => {
    const current = plan?.baselineSourceState;
    return current && typeof current === 'object'
      ? (current as V2VesinvestBaselineSourceState)
      : null;
  }, [plan?.baselineSourceState]);

  const selectedSummary = plans.find((item) => item.id === selectedPlanId) ?? null;

  const baselineSnapshot = React.useMemo(
    () =>
      buildBaselineSourceSnapshot(
        planningContext,
        savedBaselineSource,
        selectedSummary?.baselineChangedSinceAcceptedRevision === true,
      ),
    [planningContext, savedBaselineSource, selectedSummary?.baselineChangedSinceAcceptedRevision],
  );

  const loadedPlanDraft = React.useMemo(
    () => (plan ? buildDraftFromPlan(plan, linkedOrg) : null),
    [linkedOrg, plan],
  );

  const hasUnsavedChanges = React.useMemo(() => {
    if (!loadedPlanDraft) {
      return false;
    }
    return (
      JSON.stringify(toUpdatePlanInput(draft, baselineSnapshot)) !==
      JSON.stringify(toUpdatePlanInput(loadedPlanDraft, baselineSnapshot))
    );
  }, [baselineSnapshot, draft, loadedPlanDraft]);

  const liveBaselineVerified = planningContext?.canCreateScenario === true;
  const utilityBindingMissing = !linkedOrg?.veetiId;
  const utilityBindingMismatch =
    !!plan?.id &&
    ((linkedOrg?.veetiId ?? null) !== (plan.veetiId ?? null) ||
      ((linkedOrg?.ytunnus?.trim() ?? null) !== null &&
        (plan.businessId ?? null) !== null &&
        (linkedOrg?.ytunnus?.trim() ?? null) !== (plan.businessId ?? null)));
  const baselineVerified =
    selectedSummary?.baselineStatus === 'verified' || liveBaselineVerified;

  const baselineYears = React.useMemo(
    () =>
      [
        ...(planningContext?.baselineYears?.length
          ? planningContext.baselineYears
          : readSavedBaselineYears(savedBaselineSource)),
      ].sort((left, right) => right.year - left.year),
    [planningContext?.baselineYears, savedBaselineSource],
  );

  const assetEvidenceValues = [
    draft.assetEvidenceState,
    draft.conditionStudyState,
    draft.maintenanceEvidenceState,
    draft.municipalPlanContext,
    draft.financialRiskState,
    draft.publicationState,
    draft.communicationState,
  ];
  const assetEvidenceMissingCount = assetEvidenceValues.filter(
    (value) => !hasEvidenceValue(value),
  ).length;
  const assetEvidenceReady = assetEvidenceMissingCount === 0;

  const pricingReady =
    !utilityBindingMissing &&
    !utilityBindingMismatch &&
    baselineVerified &&
    draft.projects.length > 0 &&
    totalInvestments > 0 &&
    assetEvidenceReady;

  const feeRecommendation = React.useMemo(() => {
    const snapshot = plan?.feeRecommendation ?? null;
    if (
      snapshot &&
      typeof snapshot === 'object' &&
      'combined' in snapshot &&
      'water' in snapshot &&
      'wastewater' in snapshot &&
      'baseFee' in snapshot
    ) {
      return snapshot as V2VesinvestFeeRecommendation;
    }
    return null;
  }, [plan?.feeRecommendation]);

  const hasSavedFeePathLink = Boolean(
    selectedSummary?.selectedScenarioId || plan?.selectedScenarioId || feeRecommendation?.linkedScenarioId,
  );
  const showDownstreamActions =
    baselineVerified || hasSavedFeePathLink || !!plan?.selectedScenarioId || !!feeRecommendation;
  const hasSavedPricingOutput = !!feeRecommendation || hasSavedFeePathLink;

  const revisionStatusMessage = React.useMemo(() => {
    if (!plan?.id || !selectedSummary) {
      return t(
        'v2Vesinvest.planUnsavedDraft',
        'This revision is still a local draft until you save it.',
      );
    }
    if (utilityBindingMissing) {
      return t('v2Vesinvest.baselineLinkPending', 'Not yet linked');
    }
    if (utilityBindingMismatch) {
      return t(
        'v2Vesinvest.pricingBlockedHint',
        'Tariff-plan and financing output stay blocked until the baseline is verified.',
      );
    }
    if (!feeRecommendation || !hasSavedFeePathLink) {
      return t(
        'v2Vesinvest.planNotYetSynced',
        'Tariff plan has not been opened from this revision yet.',
      );
    }
    if (reportConflictCode === 'VESINVEST_BASELINE_STALE') {
      return t(
        'v2Vesinvest.baselineChangedSincePricing',
        'Accepted baseline changed after the saved tariff-plan result.',
      );
    }
    if (reportConflictCode === 'VESINVEST_SCENARIO_STALE') {
      return t(
        'v2Vesinvest.workflowOpenFeePathBody',
        'When the baseline is verified, sync the plan to forecast to review price pressure, financing gaps, and the saved recommendation.',
      );
    }
    if (selectedSummary.classificationReviewRequired) {
      return t(
        'v2Forecast.classificationReviewRequired',
        'Review and save the Vesinvest class plan before creating a report.',
      );
    }
    if (selectedSummary.baselineChangedSinceAcceptedRevision) {
      return t(
        'v2Vesinvest.baselineChangedSincePricing',
        'Accepted baseline changed after the saved tariff-plan result.',
      );
    }
    if (selectedSummary.investmentPlanChangedSinceFeeRecommendation) {
      return t(
        'v2Vesinvest.planChangedSincePricing',
        'Investment plan changed since the last tariff-plan result.',
      );
    }
    if (selectedSummary.pricingStatus !== 'verified') {
      return t(
        'v2Vesinvest.pricingBlockedHint',
        'Tariff-plan and financing output stay blocked until the baseline is verified.',
      );
    }
    return t(
      'v2Vesinvest.planAlignedWithPricing',
      'Saved tariff-plan result still matches this revision.',
    );
  }, [
    feeRecommendation,
    hasSavedFeePathLink,
    plan?.id,
    reportConflictCode,
    selectedSummary,
    t,
    utilityBindingMismatch,
    utilityBindingMissing,
  ]);

  const reportReadinessReason = React.useMemo<ReportReadinessReason>(() => {
    if (!plan?.selectedScenarioId || !linkedScenario) {
      return 'missingScenario';
    }
    if (reportConflictCode) {
      return 'staleComputeToken';
    }
    if (selectedSummary?.classificationReviewRequired) {
      return 'classificationReviewRequired';
    }
    if (!assetEvidenceReady) {
      return 'assetEvidenceIncomplete';
    }
    if (
      selectedSummary?.baselineChangedSinceAcceptedRevision ||
      selectedSummary?.investmentPlanChangedSinceFeeRecommendation
    ) {
      return 'staleComputeToken';
    }
    if (selectedSummary?.pricingStatus !== 'verified') {
      return 'staleComputeToken';
    }
    if (selectedSummary?.tariffPlanStatus !== 'accepted') {
      return 'missingTariffPlan';
    }
    if (hasUnsavedChanges) {
      return 'unsavedChanges';
    }
    if (
      !linkedScenario.computedFromUpdatedAt ||
      linkedScenario.computedFromUpdatedAt !== linkedScenario.updatedAt
    ) {
      return linkedScenario.years.length === 0 ? 'missingComputeResults' : 'staleComputeToken';
    }
    if (
      linkedScenario.yearlyInvestments.some(
        (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
      )
    ) {
      return 'missingDepreciationSnapshots';
    }
    return null;
  }, [
    assetEvidenceReady,
    hasUnsavedChanges,
    linkedScenario,
    plan?.selectedScenarioId,
    reportConflictCode,
    selectedSummary?.baselineChangedSinceAcceptedRevision,
    selectedSummary?.classificationReviewRequired,
    selectedSummary?.investmentPlanChangedSinceFeeRecommendation,
    selectedSummary?.pricingStatus,
    selectedSummary?.tariffPlanStatus,
  ]);

  const canCreateReport = reportReadinessReason == null && !loadingLinkedScenario && !!plan?.id;

  return {
    yearTotals,
    fiveYearBands,
    totalInvestments,
    groupedPlanMatrix,
    savedBaselineSource,
    selectedSummary,
    baselineSnapshot,
    loadedPlanDraft,
    hasUnsavedChanges,
    liveBaselineVerified,
    utilityBindingMissing,
    utilityBindingMismatch,
    baselineVerified,
    baselineYears,
    pricingReady,
    assetEvidenceReady,
    assetEvidenceMissingCount,
    feeRecommendation,
    hasSavedFeePathLink,
    showDownstreamActions,
    hasSavedPricingOutput,
    revisionStatusMessage,
    reportReadinessReason,
    canCreateReport,
  };
}
