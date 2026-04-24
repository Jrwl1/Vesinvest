import React from 'react';
import {
  cloneVesinvestPlanV2,
  connectImportOrganizationV2,
  createReportV2,
  createVesinvestPlanV2,
  getForecastScenarioV2,
  getVesinvestPlanV2,
  listDepreciationRulesV2,
  listVesinvestGroupsV2,
  listVesinvestPlansV2,
  searchImportOrganizationsV2,
  syncVesinvestPlanToForecastV2,
  updateDepreciationRuleV2,
  updateVesinvestGroupV2,
  updateVesinvestPlanV2,
  type V2DepreciationRule,
  type V2EditableDepreciationRuleMethod,
  type V2ForecastScenario,
  type V2VesinvestGroupDefinition,
  type V2VesinvestGroupUpdateInput,
  type V2VesinvestPlan,
  type V2VesinvestPlanSummary,
  type V2VesinvestProject,
} from '../api';
import { buildDefaultReportTitle } from './displayNames';
import { toDepreciationRuleDraft,type DepreciationRuleDraft } from './forecastModel';
import { useVesinvestFeePathFocus } from './useVesinvestFeePathFocus';
import { useVesinvestPlanningDerivedState } from './useVesinvestPlanningDerivedState';
import { useVesinvestProjectComposer } from './useVesinvestProjectComposer';
import type {
  VesinvestPlanningControllerParams,
  VesinvestProjectComposerState,
  VesinvestVeetiSearchHit,
} from './vesinvestPlanningControllerTypes';
import {
  buildDraftFromPlan,
  FALLBACK_GROUP_KEY,
  parseNullableNumberInput,
  round2,
  syncProjectTotals,
  toCreatePlanInput,
  toUpdatePlanInput,
  type VesinvestWorkspaceView,
} from './vesinvestPlanningModel';
export const useVesinvestPlanningController = ({
  t,
  isAdmin = false,
  simplifiedSetup = false,
  compactReviewMode: _compactReviewMode = false,
  planningContext,
  linkedOrg,
  onGoToForecast,
  onGoToReports,
  overviewFocusTarget,
  onOverviewFocusTargetConsumed,
  onSavedFeePathReportConflict,
  onPlansChanged,
}: VesinvestPlanningControllerParams) => {
  const [groups, setGroups] = React.useState<V2VesinvestGroupDefinition[]>([]);
  const [groupDrafts, setGroupDrafts] = React.useState<V2VesinvestGroupDefinition[]>([]);
  const [depreciationRules, setDepreciationRules] = React.useState<V2DepreciationRule[]>([]);
  const [depreciationRuleDrafts, setDepreciationRuleDrafts] = React.useState<
    DepreciationRuleDraft[]
  >([]);
  const [plans, setPlans] = React.useState<V2VesinvestPlanSummary[]>([]);
  const [selectedPlanId, setSelectedPlanId] = React.useState<string | null>(
    planningContext?.vesinvest?.selectedPlan?.id ??
      planningContext?.vesinvest?.activePlan?.id ??
      null,
  );
  const [plan, setPlan] = React.useState<V2VesinvestPlan | null>(null);
  const [draft, setDraft] = React.useState(() => buildDraftFromPlan(null, linkedOrg));
  const [loading, setLoading] = React.useState(true);
  const [loadingPlan, setLoadingPlan] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [reportConflictCode, setReportConflictCode] = React.useState<string | null>(null);
  const [veetiSearchQuery, setVeetiSearchQuery] = React.useState('');
  const [veetiSearchResults, setVeetiSearchResults] = React.useState<VesinvestVeetiSearchHit[]>([]);
  const [searchingVeeti, setSearchingVeeti] = React.useState(false);
  const pendingAllocationFocusRef = React.useRef<{ projectIndex: number; year: number } | null>(null);
  const pendingOverviewFocusPlanIdRef = React.useRef<string | null>(null);
  const feePathSectionRef = React.useRef<HTMLElement | null>(null);
  const feePathHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const [savingClassKey, setSavingClassKey] = React.useState<string | null>(null);
  const [linkedScenario, setLinkedScenario] = React.useState<V2ForecastScenario | null>(null);
  const [loadingLinkedScenario, setLoadingLinkedScenario] = React.useState(false);
  const [activeWorkspaceView, setActiveWorkspaceView] = React.useState<VesinvestWorkspaceView>('investment');
  const [projectComposer, setProjectComposer] = React.useState<VesinvestProjectComposerState>({
    open: false,
    code: '',
    groupKey: FALLBACK_GROUP_KEY,
    name: '',
  });
  const useSimplifiedSetup = simplifiedSetup && isAdmin;
  const refreshSummaries = React.useCallback(
    async (preferredId?: string | null) => {
      const [groupRows, depreciationRuleRows, planRows] = await Promise.all([
        listVesinvestGroupsV2(),
        listDepreciationRulesV2(),
        listVesinvestPlansV2(),
      ]);
      setGroups(groupRows);
      setGroupDrafts(groupRows.map((item) => ({ ...item })));
      setDepreciationRules(depreciationRuleRows);
      setDepreciationRuleDrafts(depreciationRuleRows.map((item) => toDepreciationRuleDraft(item)));
      setPlans(planRows);
      setSelectedPlanId((current) => {
        if (preferredId && planRows.some((item) => item.id === preferredId)) {
          return preferredId;
        }
        if (current && planRows.some((item) => item.id === current)) {
          return current;
        }
        const contextSelectedId = planningContext?.vesinvest?.selectedPlan?.id;
        if (contextSelectedId && planRows.some((item) => item.id === contextSelectedId)) {
          return contextSelectedId;
        }
        const contextActiveId = planningContext?.vesinvest?.activePlan?.id;
        if (contextActiveId && planRows.some((item) => item.id === contextActiveId)) {
          return contextActiveId;
        }
        return planRows[0]?.id ?? null;
      });
    },
    [planningContext?.vesinvest?.activePlan?.id, planningContext?.vesinvest?.selectedPlan?.id],
  );
  React.useEffect(() => {
    let active = true;
    setLoading(true);
    void refreshSummaries()
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : t('v2Vesinvest.errorLoad', 'Failed to load Vesinvest plans.'),
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [refreshSummaries, t]);
  React.useEffect(() => {
    if (!selectedPlanId) {
      setPlan(null);
      setDraft(buildDraftFromPlan(null, linkedOrg));
      return;
    }
    let active = true;
    setLoadingPlan(true);
    void getVesinvestPlanV2(selectedPlanId)
      .then((data) => {
        if (!active) {
          return;
        }
        setPlan(data);
        setDraft(buildDraftFromPlan(data, linkedOrg));
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.errorLoadPlan', 'Failed to load the selected plan.'),
        );
      })
      .finally(() => {
        if (active) {
          setLoadingPlan(false);
        }
      });
    return () => {
      active = false;
    };
  }, [linkedOrg, selectedPlanId, t]);
  React.useEffect(() => {
    if (!plan?.selectedScenarioId) {
      setLinkedScenario(null);
      setLoadingLinkedScenario(false);
      return;
    }
    let active = true;
    setLoadingLinkedScenario(true);
    void getForecastScenarioV2(plan.selectedScenarioId)
      .then((scenario) => {
        if (active) {
          setLinkedScenario(scenario);
        }
      })
      .catch(() => {
        if (active) {
          setLinkedScenario(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingLinkedScenario(false);
        }
      });
    return () => {
      active = false;
    };
  }, [plan?.selectedScenarioId]);
  React.useEffect(() => {
    setReportConflictCode(null);
  }, [plan?.id, plan?.selectedScenarioId]);
  const {
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
    feeRecommendation,
    hasSavedFeePathLink,
    showDownstreamActions,
    hasSavedPricingOutput,
    revisionStatusMessage,
    reportReadinessReason,
    canCreateReport,
  } = useVesinvestPlanningDerivedState({
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
  });
  useVesinvestFeePathFocus({
    overviewFocusTarget,
    selectedPlanId,
    setSelectedPlanId,
    loading,
    loadingPlan,
    plans,
    plan,
    feePathSectionRef,
    feePathHeadingRef,
    onOverviewFocusTargetConsumed,
    pendingOverviewFocusPlanIdRef,
  });
  const updateProject = React.useCallback(
    (index: number, updater: (project: V2VesinvestProject) => V2VesinvestProject) => {
      setDraft((current) => ({
        ...current,
        projects: current.projects.map((project, projectIndex) =>
          projectIndex === index ? syncProjectTotals(updater(project)) : project,
        ),
      }));
    },
    [],
  );
  const updateGroupDraft = React.useCallback(
    (
      key: string,
      updater: (group: V2VesinvestGroupDefinition) => V2VesinvestGroupDefinition,
    ) => {
      setGroupDrafts((current) =>
        current.map((group) => (group.key === key ? updater(group) : group)),
      );
    },
    [],
  );
  const updateDepreciationRuleDraft = React.useCallback(
    (key: string, updater: (rule: DepreciationRuleDraft) => DepreciationRuleDraft) => {
      setDepreciationRuleDrafts((current) =>
        current.map((rule) => (rule.assetClassKey === key ? updater(rule) : rule)),
      );
    },
    [],
  );
  const handleSaveClassDefinition = React.useCallback(
    async (key: string) => {
      const groupDraft = groupDrafts.find((group) => group.key === key);
      const ruleDraft = depreciationRuleDrafts.find((rule) => rule.assetClassKey === key);
      if (!groupDraft || !ruleDraft) {
        return;
      }
      const payload: V2VesinvestGroupUpdateInput = {
        label: groupDraft.label,
        defaultAccountKey: groupDraft.defaultAccountKey,
        reportGroupKey: groupDraft.reportGroupKey,
        serviceSplit: groupDraft.serviceSplit,
      };
      setSavingClassKey(key);
      setError(null);
      try {
        const [updatedGroup, updatedRule] = await Promise.all([
          updateVesinvestGroupV2(key, payload),
          updateDepreciationRuleV2(key, {
            assetClassKey: key,
            assetClassName: groupDraft.label,
            method: ruleDraft.method as V2EditableDepreciationRuleMethod,
            linearYears: parseNullableNumberInput(ruleDraft.linearYears),
            residualPercent: parseNullableNumberInput(ruleDraft.residualPercent),
          }),
        ]);
        setGroups((current) =>
          current.map((group) => (group.key === key ? updatedGroup : group)),
        );
        setGroupDrafts((current) =>
          current.map((group) => (group.key === key ? updatedGroup : group)),
        );
        setDepreciationRules((current) =>
          current.map((rule) => (rule.assetClassKey === key ? updatedRule : rule)),
        );
        setDepreciationRuleDrafts((current) =>
          current.map((rule) =>
            rule.assetClassKey === key ? toDepreciationRuleDraft(updatedRule) : rule,
          ),
        );
        setDraft((current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.groupKey === key
              ? {
                  ...project,
                  groupLabel: updatedGroup.label,
                  depreciationClassKey: updatedGroup.key,
                  defaultAccountKey: updatedGroup.defaultAccountKey,
                  reportGroupKey: updatedGroup.reportGroupKey,
                }
              : project,
          ),
        }));
        setPlan((current) =>
          current
            ? {
                ...current,
                projects: current.projects.map((project) =>
                  project.groupKey === key
                    ? {
                        ...project,
                        groupLabel: updatedGroup.label,
                        depreciationClassKey: updatedGroup.key,
                        defaultAccountKey: updatedGroup.defaultAccountKey,
                        reportGroupKey: updatedGroup.reportGroupKey,
                      }
                    : project,
                ),
              }
            : current,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.errorLoad', 'Failed to load Vesinvest plans.'),
        );
      } finally {
        setSavingClassKey(null);
      }
    },
    [depreciationRuleDrafts, groupDrafts, t],
  );
  const updateProjectAllocation = React.useCallback(
    (
      projectIndex: number,
      year: number,
      field: 'totalAmount' | 'waterAmount' | 'wastewaterAmount',
      value: number,
    ) => {
      updateProject(projectIndex, (current) => {
        const serviceSplit =
          groups.find((group) => group.key === current.groupKey)?.serviceSplit ?? 'mixed';
        const allocations = current.allocations.map((allocation) => {
          if (allocation.year !== year) {
            return allocation;
          }
          if (field === 'totalAmount') {
            const totalAmount = round2(value);
            if (serviceSplit === 'water') {
              return {
                ...allocation,
                totalAmount,
                waterAmount: totalAmount,
                wastewaterAmount: 0,
              };
            }
            if (serviceSplit === 'wastewater') {
              return {
                ...allocation,
                totalAmount,
                waterAmount: 0,
                wastewaterAmount: totalAmount,
              };
            }
            const existingWater = allocation.waterAmount ?? 0;
            const existingWastewater = allocation.wastewaterAmount ?? 0;
            const existingTotal = existingWater + existingWastewater;
            if (existingTotal > 0) {
              const waterAmount = round2((existingWater / existingTotal) * totalAmount);
              return {
                ...allocation,
                totalAmount,
                waterAmount,
                wastewaterAmount: round2(totalAmount - waterAmount),
              };
            }
            return {
              ...allocation,
              totalAmount,
              waterAmount: totalAmount,
              wastewaterAmount: 0,
            };
          }
          if (field === 'waterAmount') {
            const waterAmount = round2(value);
            const wastewaterAmount = round2(allocation.wastewaterAmount ?? 0);
            return {
              ...allocation,
              waterAmount,
              totalAmount: round2(waterAmount + wastewaterAmount),
            };
          }
          const wastewaterAmount = round2(value);
          const waterAmount = round2(allocation.waterAmount ?? 0);
          return {
            ...allocation,
            wastewaterAmount,
            totalAmount: round2(waterAmount + wastewaterAmount),
          };
        });
        return {
          ...current,
          allocations,
        };
      });
    },
    [groups, updateProject],
  );
  const runVeetiLookup = React.useCallback(async () => {
    const query = veetiSearchQuery.trim();
    if (query.length < 2) {
      setError(
        t(
          'v2Vesinvest.veetiLookupQueryRequired',
          'Enter at least two characters before searching VEETI.',
        ),
      );
      setInfo(null);
      return;
    }
    setSearchingVeeti(true);
    setError(null);
    try {
      const rows = await searchImportOrganizationsV2(query, 8);
      setVeetiSearchResults(
        rows.map((row) => ({
          id: row.Id,
          name: row.Nimi?.trim() || `VEETI ${row.Id}`,
          businessId: row.YTunnus?.trim() || null,
          municipality: row.Kunta?.trim() || null,
        })),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Vesinvest.veetiLookupFailed', 'VEETI lookup failed.'),
      );
      setInfo(null);
    } finally {
      setSearchingVeeti(false);
    }
  }, [t, veetiSearchQuery]);
  const applyVeetiSearchHit = React.useCallback(
    async (hit: VesinvestVeetiSearchHit) => {
      if (linkedOrg?.veetiId) {
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        await connectImportOrganizationV2(hit.id);
        await onPlansChanged?.();
        setInfo(
          t(
            'v2Overview.infoConnected',
            'Organization connected. Create the first Vesinvest plan to continue.',
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.veetiLookupFailed', 'VEETI lookup failed.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [linkedOrg?.veetiId, onPlansChanged, t],
  );
  const persist = React.useCallback(
    async (mode: 'create' | 'save' | 'clone' | 'sync') => {
      const invalidProject = draft.projects.find(
        (project) => project.code.trim().length === 0 || project.name.trim().length === 0,
      );
      if (invalidProject) {
        setError(
          t('v2Vesinvest.errorProjectRequired', 'Project code and name are required.'),
        );
        setInfo(null);
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        if (mode === 'create') {
          const created = await createVesinvestPlanV2(toCreatePlanInput(draft, baselineSnapshot));
          setPlan(created);
          setDraft(buildDraftFromPlan(created, linkedOrg));
          await refreshSummaries(created.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoCreated', 'Vesinvest plan created.'));
          return;
        }
        if (!plan?.id) {
          return;
        }
        const payload = toUpdatePlanInput(draft, baselineSnapshot);
        if (mode === 'save') {
          const saved = await updateVesinvestPlanV2(plan.id, payload);
          setPlan(saved);
          setDraft(buildDraftFromPlan(saved, linkedOrg));
          await refreshSummaries(saved.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoSaved', 'Vesinvest plan saved.'));
          return;
        }
        if (mode === 'clone') {
          const saved = await updateVesinvestPlanV2(plan.id, payload);
          const cloned = await cloneVesinvestPlanV2(saved.id);
          setPlan(cloned);
          setDraft(buildDraftFromPlan(cloned, linkedOrg));
          await refreshSummaries(cloned.id);
          await onPlansChanged?.();
          setInfo(t('v2Vesinvest.infoCloned', 'New Vesinvest revision created.'));
          return;
        }
        const saved = await updateVesinvestPlanV2(plan.id, payload);
        const synced = await syncVesinvestPlanToForecastV2(saved.id, {
          compute: true,
          baselineSourceState: baselineSnapshot,
        });
        setPlan(synced.plan);
        setReportConflictCode(null);
        setDraft(buildDraftFromPlan(synced.plan, linkedOrg));
        await refreshSummaries(synced.plan.id);
        await onPlansChanged?.();
        onGoToForecast(synced.scenarioId);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Vesinvest.errorSave', 'Failed to save Vesinvest plan.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [draft, linkedOrg, onGoToForecast, onPlansChanged, plan?.id, refreshSummaries, t, baselineSnapshot],
  );
  const handleCreateReport = React.useCallback(async () => {
    if (!plan?.id || !plan.selectedScenarioId || !linkedScenario) {
      setError(
        t('v2Forecast.computeBeforeReport', 'Recompute results before creating report.'),
      );
      setInfo(null);
      return;
    }
    if (!canCreateReport) {
      const message =
        reportReadinessReason === 'unsavedChanges'
          ? t(
              'v2Forecast.unsavedHint',
              'You have unsaved changes. Save and compute results before creating report.',
            )
          : reportReadinessReason === 'classificationReviewRequired'
            ? t(
                'v2Forecast.classificationReviewRequired',
                'Review and save the Vesinvest class plan before creating a report.',
              )
            : reportReadinessReason === 'missingDepreciationSnapshots'
              ? t(
                  'v2Forecast.depreciationSnapshotsMissingHint',
                  'Refresh the synced Vesinvest class plan and recompute results before creating report.',
                )
            : reportReadinessReason === 'staleComputeToken'
              ? t(
                  'v2Forecast.staleComputeHint',
                  'Saved inputs changed after the last calculation. Recompute results before creating report.',
                )
              : reportReadinessReason === 'missingTariffPlan'
                ? t(
                    'v2TariffPlan.acceptBeforeReports',
                    'Accept the tariff plan before creating reports.',
                  )
                : t(
                    'v2Forecast.computeBeforeReport',
                    'Recompute results before creating report.',
                  );
      setError(message);
      setInfo(null);
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await createReportV2({
        vesinvestPlanId: plan.id,
        ennusteId: plan.selectedScenarioId,
        title: buildDefaultReportTitle(t, linkedScenario.name),
      });
      setReportConflictCode(null);
      setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onGoToReports();
    } catch (err) {
      const code =
        typeof err === 'object' && err != null && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (
        code === 'VESINVEST_SCENARIO_STALE' ||
        code === 'VESINVEST_BASELINE_STALE' ||
        code === 'FORECAST_RECOMPUTE_REQUIRED'
      ) {
        setReportConflictCode(code);
        await Promise.all([refreshSummaries(plan.id), Promise.resolve(onPlansChanged?.())]);
        onSavedFeePathReportConflict?.(plan.id);
        setError(
          code === 'VESINVEST_BASELINE_STALE'
            ? t(
                'v2Vesinvest.baselineChangedSincePricing',
                'Accepted baseline changed after the saved tariff-plan result.',
              )
            : code === 'VESINVEST_SCENARIO_STALE'
              ? t(
                  'v2Vesinvest.workflowOpenFeePathBody',
                  'When the baseline is verified, sync the plan to forecast to review price pressure, financing gaps, and the saved recommendation.',
                )
              : t(
                  'v2Forecast.staleComputeHint',
                  'Saved inputs changed after the last calculation. Recompute results before creating report.',
                ),
        );
        setInfo(null);
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorReportFailed', 'Failed to create report.'),
      );
    } finally {
      setBusy(false);
    }
  }, [
    canCreateReport,
    linkedScenario,
    onGoToReports,
    onSavedFeePathReportConflict,
    onPlansChanged,
    plan?.id,
    plan?.selectedScenarioId,
    refreshSummaries,
    reportReadinessReason,
    t,
  ]);
  const setDraftField = React.useCallback(
    <K extends keyof typeof draft>(field: K, value: (typeof draft)[K]) =>
      setDraft((current) => ({ ...current, [field]: value })),
    [],
  );
  const {
    projectComposerGroupKey,
    openProjectComposer,
    closeProjectComposer,
    handleCreateProjectDraft,
  } = useVesinvestProjectComposer({
    groups,
    loading,
    loadingPlan,
    projectComposer,
    setProjectComposer,
    setDraft,
    draft,
    pendingAllocationFocusRef,
  });
  const shouldLeadAddProject =
    activeWorkspaceView === 'investment' && draft.projects.length === 0;
  const shouldLeadSave = !shouldLeadAddProject && (hasUnsavedChanges || !plan);
  const shouldLeadSync =
    !shouldLeadAddProject && !shouldLeadSave && pricingReady && !canCreateReport;
  const projectActionClass = shouldLeadAddProject ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const saveActionClass = shouldLeadSave ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const syncActionClass = shouldLeadSync ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reportActionClass = 'v2-btn';

  return {
    groups,
    groupDrafts,
    depreciationRules,
    depreciationRuleDrafts,
    plans,
    selectedPlanId,
    setSelectedPlanId,
    plan,
    draft,
    setDraft,
    loading,
    loadingPlan,
    busy,
    error,
    info,
    reportConflictCode,
    veetiSearchQuery,
    setVeetiSearchQuery,
    veetiSearchResults,
    searchingVeeti,
    feePathSectionRef,
    feePathHeadingRef,
    savingClassKey,
    linkedScenario,
    loadingLinkedScenario,
    activeWorkspaceView,
    setActiveWorkspaceView,
    projectComposer,
    setProjectComposer,
    useSimplifiedSetup,
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
    feeRecommendation,
    hasSavedFeePathLink,
    showDownstreamActions,
    hasSavedPricingOutput,
    revisionStatusMessage,
    reportReadinessReason,
    canCreateReport,
    updateProject,
    updateGroupDraft,
    updateDepreciationRuleDraft,
    handleSaveClassDefinition,
    updateProjectAllocation,
    runVeetiLookup,
    applyVeetiSearchHit,
    persist,
    handleCreateReport,
    setDraftField,
    projectComposerGroupKey,
    openProjectComposer,
    closeProjectComposer,
    handleCreateProjectDraft,
    shouldLeadAddProject,
    shouldLeadSave,
    shouldLeadSync,
    projectActionClass,
    saveActionClass,
    syncActionClass,
    reportActionClass,
  };
};
