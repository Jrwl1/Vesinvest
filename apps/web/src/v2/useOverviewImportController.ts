import type { TFunction } from 'i18next';
import React from 'react';
import {
  getImportYearDataV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ImportYearDataResponse,
  type V2OverviewResponse,
  type V2PlanningContextResponse,
  type V2ReportListItem,
  type VeetiOrganizationSearchHit,
} from '../api';
import i18n,{
  applyOrganizationDefaultLanguage,
  hasManualLanguageOverride,
  normalizeLanguage,
  type SupportedLanguage,
} from '../i18n';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  getAutoSearchDelayMs,
  getAutoSearchMinLength,
  normalizeOrganizationSearchQuery,
  OVERVIEW_RUNTIME_STORAGE_KEY,
  readOverviewRuntimeState,
} from './overviewImportPersistence';
import {
  connectOverviewOrganization,
  ensureOverviewPlanContext,
  importOverviewYears,
  loadOverviewOrchestration,
  performOverviewOrganizationSearch,
  recordOverviewConnectFailure,
  recordOverviewImportFailure,
  recordOverviewSearchFailure,
} from './overviewOrchestration';
import {
  getRequiredImportedBaselineYears,
  type SetupWizardStep,
} from './overviewWorkflow';
import { useOverviewImportMaintenance } from './useOverviewImportMaintenance';
export type UseOverviewImportControllerParams = {
  t: TFunction;
  pickDefaultSyncYears: (
    rows: Array<{
      vuosi: number;
      completeness: Record<string, boolean>;
      planningRole?: 'historical' | 'current_year_estimate';
    }>,
  ) => number[];
  setYearDataCache: React.Dispatch<
    React.SetStateAction<Record<number, V2ImportYearDataResponse>>
  >;
  onOrgLanguageNoticeChange?: (
    notice:
      | {
          kind: 'switched' | 'kept_manual';
          language: SupportedLanguage;
          previousLanguage: SupportedLanguage;
        }
      | null,
  ) => void;
};
export function useOverviewImportController({
  t,
  pickDefaultSyncYears,
  setYearDataCache,
  onOrgLanguageNoticeChange,
}: UseOverviewImportControllerParams) {
  const [overview, setOverview] = React.useState<V2OverviewResponse | null>(null);
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<
    VeetiOrganizationSearchHit[]
  >([]);
  const [selectedOrg, setSelectedOrg] =
    React.useState<VeetiOrganizationSearchHit | null>(null);
  const [selectedYears, setSelectedYears] = React.useState<number[]>([]);
  const [scenarioList, setScenarioList] = React.useState<
    V2ForecastScenarioListItem[] | null
  >(null);
  const [reportList, setReportList] = React.useState<V2ReportListItem[] | null>(
    null,
  );
  const [reviewedImportedYears, setReviewedImportedYears] = React.useState<
    number[]
  >([]);
  const [importedWorkspaceYears, setImportedWorkspaceYears] = React.useState<
    number[] | null
  >(null);
  const [latestPlanningBaselineSummary, setLatestPlanningBaselineSummary] =
    React.useState<{
      includedYears: number[];
      excludedYears: number[];
      correctedYears: number[];
    } | null>(null);
  const [reviewContinueStep, setReviewContinueStep] =
    React.useState<SetupWizardStep | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [importingYears, setImportingYears] = React.useState(false);
  const [creatingPlanningBaseline, setCreatingPlanningBaseline] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [removingYear, setRemovingYear] = React.useState<number | null>(null);
  const [excludedYearOverrides, setExcludedYearOverrides] = React.useState<
    Record<number, boolean>
  >({});
  const [bulkDeletingYears, setBulkDeletingYears] = React.useState(false);
  const [bulkRestoringYears, setBulkRestoringYears] = React.useState(false);
  const [selectedYearsForDelete, setSelectedYearsForDelete] = React.useState<
    number[]
  >([]);
  const [selectedYearsForRestore, setSelectedYearsForRestore] = React.useState<
    number[]
  >([]);
  const syncYearSelectionTouchedRef = React.useRef(false);
  const selectedYearsRef = React.useRef<number[]>([]);
  const selectedYearsForDeleteRef = React.useRef<number[]>([]);
  const selectedYearsForRestoreRef = React.useRef<number[]>([]);
  const selectedOrgRef = React.useRef<VeetiOrganizationSearchHit | null>(null);
  const searchRequestSeq = React.useRef(0);
  const previewFetchYearsRef = React.useRef<Set<number>>(new Set());
  const handledSetupBackSignalRef = React.useRef(0);
  const hydratedRuntimeWorkspaceKeyRef = React.useRef<string | null>(null);
  const runtimeWorkspaceKey = React.useMemo(() => {
    const linkedBusinessId =
      typeof overview?.importStatus.link?.ytunnus === 'string' &&
      overview.importStatus.link.ytunnus.trim().length > 0
        ? overview.importStatus.link.ytunnus.trim()
        : null;
    if (linkedBusinessId) {
      return `org:${linkedBusinessId}`;
    }
    const linkedVeetiId = Number(overview?.importStatus.link?.veetiId);
    if (Number.isFinite(linkedVeetiId)) {
      return `veeti:${linkedVeetiId}`;
    }
    const selectedBusinessId =
      typeof selectedOrg?.YTunnus === 'string' && selectedOrg.YTunnus.trim().length > 0
        ? selectedOrg.YTunnus.trim()
        : null;
    if (selectedBusinessId) {
      return `org:${selectedBusinessId}`;
    }
    const selectedVeetiId = Number((selectedOrg as { Id?: unknown } | null)?.Id);
    return Number.isFinite(selectedVeetiId) ? `veeti:${selectedVeetiId}` : null;
  }, [overview?.importStatus.link?.veetiId, overview?.importStatus.link?.ytunnus, selectedOrg]);
  const baselineReady = React.useMemo(
    () => {
      const requiredImportedBaselineYears = overview
        ? getRequiredImportedBaselineYears(overview.importStatus)
        : [];
      const acceptedPlanningYears = new Set<number>([
        ...((overview?.importStatus.planningBaselineYears ?? []).map((year) =>
          Number(year),
        )),
        ...((planningContext?.baselineYears ?? []).map((row) => Number(row.year))),
      ]);
      const baselineCoversImportedWorkspaceYears =
        requiredImportedBaselineYears.length === 0 ||
        requiredImportedBaselineYears.every((year) =>
          acceptedPlanningYears.has(year),
        );
      return (
        ((planningContext?.canCreateScenario ?? false) ||
          (overview?.importStatus.planningBaselineYears?.length ?? 0) > 0 ||
          (planningContext?.baselineYears?.length ?? 0) > 0) &&
        baselineCoversImportedWorkspaceYears
      );
    },
    [
      overview?.importStatus,
      overview?.importStatus.planningBaselineYears?.length,
      overview?.importStatus.workspaceYears,
      overview?.importStatus.availableYears,
      overview?.importStatus.years,
      planningContext?.baselineYears,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
    ],
  );
  const backendAcceptedPlanningYears = React.useMemo(
    () =>
      [
        ...new Set(
          [
            ...(overview?.importStatus.planningBaselineYears ?? []),
            ...((planningContext?.baselineYears ?? []).map((row) => row.year) ?? []),
          ].filter((year): year is number => Number.isFinite(year)),
        ),
      ].sort((a, b) => b - a),
    [overview?.importStatus.planningBaselineYears, planningContext?.baselineYears],
  );
  const pruneYearFromSelections = React.useCallback((year: number) => {
    setSelectedYears((prev) => prev.filter((item) => item !== year));
    setSelectedYearsForDelete((prev) => prev.filter((item) => item !== year));
    setSelectedYearsForRestore((prev) => prev.filter((item) => item !== year));
    selectedYearsRef.current = selectedYearsRef.current.filter((item) => item !== year);
    selectedYearsForDeleteRef.current = selectedYearsForDeleteRef.current.filter(
      (item) => item !== year,
    );
    selectedYearsForRestoreRef.current = selectedYearsForRestoreRef.current.filter(
      (item) => item !== year,
    );
  }, []);
  React.useEffect(() => {
    selectedYearsRef.current = selectedYears;
  }, [selectedYears]);
  React.useEffect(() => {
    selectedYearsForDeleteRef.current = selectedYearsForDelete;
  }, [selectedYearsForDelete]);
  React.useEffect(() => {
    selectedYearsForRestoreRef.current = selectedYearsForRestore;
  }, [selectedYearsForRestore]);
  React.useEffect(() => {
    selectedOrgRef.current = selectedOrg;
  }, [selectedOrg]);
  React.useEffect(() => {
    previewFetchYearsRef.current.clear();
  }, [runtimeWorkspaceKey]);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!runtimeWorkspaceKey) return;
    if (hydratedRuntimeWorkspaceKeyRef.current !== runtimeWorkspaceKey) return;
    window.sessionStorage.setItem(
      OVERVIEW_RUNTIME_STORAGE_KEY,
      JSON.stringify({
        workspaceKey: runtimeWorkspaceKey,
        selectedYears,
      }),
    );
  }, [runtimeWorkspaceKey, selectedYears]);
  React.useEffect(() => {
    if (!overview || !runtimeWorkspaceKey) {
      return;
    }
    if (hydratedRuntimeWorkspaceKeyRef.current === runtimeWorkspaceKey) {
      return;
    }
    hydratedRuntimeWorkspaceKeyRef.current = runtimeWorkspaceKey;
    const availableYears = new Set(
      (overview.importStatus.years ?? [])
        .map((row) => Number(row.vuosi))
        .filter((year) => Number.isFinite(year)),
    );
    const restoredYears = readOverviewRuntimeState(
      runtimeWorkspaceKey,
    ).selectedYears.filter((year) => availableYears.has(year));
    const persistedYears =
      restoredYears.length > 0 ? restoredYears : selectedYearsRef.current;
    if (restoredYears.length > 0) {
      syncYearSelectionTouchedRef.current = true;
      selectedYearsRef.current = restoredYears;
      setSelectedYears(restoredYears);
    }
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        OVERVIEW_RUNTIME_STORAGE_KEY,
        JSON.stringify({
          workspaceKey: runtimeWorkspaceKey,
          selectedYears: persistedYears,
        }),
      );
    }
  }, [overview, runtimeWorkspaceKey]);
  const loadOverviewInternal = React.useCallback(
    async (options?: {
      preserveVisibleState?: boolean;
      preserveSelectionState?: boolean;
      preserveReviewContinueStep?: boolean;
      deferSecondaryLoads?: boolean;
      refreshPlanningContext?: boolean;
      skipSecondaryLoads?: boolean;
    }) => {
      let mainOverviewLoaded = false;
      if (!options?.preserveVisibleState) {
        setLoading(true);
      }
      setError(null);
      try {
        const result = await loadOverviewOrchestration({
          options,
          previousSelectedYears: selectedYearsRef.current,
          previousSelectedYearsForDelete: selectedYearsForDeleteRef.current,
          previousSelectedYearsForRestore: selectedYearsForRestoreRef.current,
          yearSelectionTouched: syncYearSelectionTouchedRef.current,
          pickDefaultSyncYears,
        });
        const data = result.overview;
        mainOverviewLoaded = true;
        setOverview(data);
        setPlanningContext(result.planningContext);
        if (result.immediateSecondaryLoads) {
          setScenarioList(result.immediateSecondaryLoads.scenarioList);
          setReportList(result.immediateSecondaryLoads.reportList);
        } else if (result.secondaryLoads) {
          void result.secondaryLoads.then(({ scenarioList, reportList }) => {
            setScenarioList(scenarioList);
            setReportList(reportList);
          });
        }
        if (result.selectionState) {
          setImportedWorkspaceYears(result.selectionState.importedWorkspaceYears);
          if (!options?.preserveSelectionState) {
            selectedYearsRef.current = result.selectionState.selectedYears;
            selectedYearsForDeleteRef.current =
              result.selectionState.selectedYearsForDelete;
            selectedYearsForRestoreRef.current =
              result.selectionState.selectedYearsForRestore;
            setSelectedYears(result.selectionState.selectedYears);
            setSelectedYearsForDelete(result.selectionState.selectedYearsForDelete);
            setSelectedYearsForRestore(result.selectionState.selectedYearsForRestore);
          }
          if (!options?.preserveReviewContinueStep) {
            setReviewContinueStep(null);
          }
        }
        if (!options?.preserveVisibleState) {
          setLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Overview.errorLoadFailed', 'Failed to load overview.'),
        );
      } finally {
        if (!options?.preserveVisibleState && !mainOverviewLoaded) {
          setLoading(false);
        }
      }
      return mainOverviewLoaded;
    },
    [pickDefaultSyncYears, t],
  );
  const loadOverview = React.useCallback(
    async (options?: {
      preserveVisibleState?: boolean;
      preserveSelectionState?: boolean;
      preserveReviewContinueStep?: boolean;
      deferSecondaryLoads?: boolean;
      refreshPlanningContext?: boolean;
      skipSecondaryLoads?: boolean;
    }) => {
      await loadOverviewInternal(options);
    },
    [loadOverviewInternal],
  );
  React.useEffect(() => {
    void loadOverview();
  }, [loadOverview]);
  const performOrganizationSearch = React.useCallback(
    async (searchValue: string) => {
      if (searchValue.length < 2) return;
      const requestSeq = searchRequestSeq.current + 1;
      searchRequestSeq.current = requestSeq;
      setSearching(true);
      setError(null);
      setInfo(null);
      try {
        const result = await performOverviewOrganizationSearch({
          searchValue,
          currentSelectedOrg: selectedOrgRef.current,
          t,
        });
        if (searchRequestSeq.current !== requestSeq) return;
        setSearchResults(result.rows);
        setSelectedOrg(result.selectedOrg);
        if (result.info) {
          setInfo(result.info);
        }
      } catch (err) {
        recordOverviewSearchFailure(searchValue);
        setError(
          err instanceof Error
            ? err.message
            : t('v2Overview.errorSearchFailed', 'VEETI search failed.'),
        );
      } finally {
        if (searchRequestSeq.current === requestSeq) {
          setSearching(false);
        }
      }
    },
    [t],
  );
  React.useEffect(() => {
    const searchValue = normalizeOrganizationSearchQuery(query);
    const connected = overview?.importStatus.connected ?? false;
    if (connected || searchValue.length < getAutoSearchMinLength(searchValue)) {
      searchRequestSeq.current += 1;
      setSearching(false);
      setSearchResults([]);
      setInfo(null);
      return;
    }
    const timer = window.setTimeout(() => {
      void performOrganizationSearch(searchValue);
    }, getAutoSearchDelayMs(searchValue));

    return () => {
      window.clearTimeout(timer);
    };
  }, [overview?.importStatus.connected, performOrganizationSearch, query]);

  const handleSearch = React.useCallback(async () => {
    const searchValue = normalizeOrganizationSearchQuery(query);
    if (searchValue.length < 2) return;
    await performOrganizationSearch(searchValue);
  }, [performOrganizationSearch, query]);

  const handleConnect = React.useCallback(
    async (org?: VeetiOrganizationSearchHit | null) => {
      const targetOrg = org ?? selectedOrg;
      if (!targetOrg) return;
      setConnecting(true);
      setError(null);
      setInfo(null);
      try {
        const previousLanguage = normalizeLanguage(
          i18n.resolvedLanguage ?? i18n.language,
        );
        const result = await connectOverviewOrganization({
          targetOrg,
          pickDefaultSyncYears,
          t,
        });
        const orgLanguage = result.status.link?.uiLanguage;
        if (orgLanguage) {
          const hadManualOverride = hasManualLanguageOverride();
          const languageResult = await applyOrganizationDefaultLanguage(orgLanguage);
          if (
            hadManualOverride &&
            normalizeLanguage(orgLanguage) !== previousLanguage
          ) {
            onOrgLanguageNoticeChange?.({
              kind: 'kept_manual',
              language: normalizeLanguage(orgLanguage),
              previousLanguage,
            });
          } else if (
            languageResult != null &&
            languageResult !== previousLanguage
          ) {
            onOrgLanguageNoticeChange?.({
              kind: 'switched',
              language: languageResult,
              previousLanguage,
            });
          } else {
            onOrgLanguageNoticeChange?.(null);
          }
        } else {
          onOrgLanguageNoticeChange?.(null);
        }
        syncYearSelectionTouchedRef.current = false;
        selectedYearsRef.current = result.defaultSelectedYears;
        selectedYearsForDeleteRef.current = [];
        selectedYearsForRestoreRef.current = [];
        setSelectedYears(result.defaultSelectedYears);
        setSelectedYearsForDelete([]);
        setSelectedYearsForRestore([]);
        setReviewContinueStep(null);
        setImportedWorkspaceYears(result.importedWorkspaceYears);
        setSelectedOrg(targetOrg);
        setSearchResults([]);
        setOverview((current) =>
          current
            ? {
                ...current,
                importStatus: result.status,
              }
            : current,
        );
        setInfo(result.info);
        try {
          const ensuredPlan = await ensureOverviewPlanContext();
          const preservePlanSetupStep = ensuredPlan.createdPlan;
          if (ensuredPlan.planningContext) {
            setPlanningContext(ensuredPlan.planningContext);
          }
          setReviewContinueStep(preservePlanSetupStep ? 3 : null);
          setInfo(
            i18n.t(
              'v2Overview.infoConnected',
              'Utility linked. Select historical years and continue building the baseline.',
            ),
          );
          void loadOverview({
            preserveVisibleState: true,
            preserveReviewContinueStep: preservePlanSetupStep,
            deferSecondaryLoads: true,
            refreshPlanningContext: true,
          });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : t(
                  'v2Overview.errorLoadPlanningContext',
                  'Failed to load planning context.',
                ),
          );
        }
      } catch (err) {
        recordOverviewConnectFailure(targetOrg);
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.errorConnectFailed',
                'Failed to connect VEETI organization.',
              ),
        );
      } finally {
        setConnecting(false);
      }
    },
    [
      loadOverview,
      onOrgLanguageNoticeChange,
      pickDefaultSyncYears,
      selectedOrg,
      t,
    ],
  );

  const importYearsIntoWorkspace = React.useCallback(
    async (years: number[]) => {
      setImportingYears(true);
      setError(null);
      setInfo(null);
      try {
        const result = await importOverviewYears({ selectedYears: years, t });
        setInfo(result.info);
        setImportedWorkspaceYears(result.importedWorkspaceYears);
        await loadOverview({
          preserveVisibleState: true,
          preserveSelectionState: true,
          preserveReviewContinueStep: true,
          deferSecondaryLoads: true,
        });
        return result;
      } catch (err) {
        recordOverviewImportFailure(years);
        setError(
          err instanceof Error
            ? err.message
            : t('v2Overview.errorImportYearsFailed', 'Year import failed.'),
        );
        throw err;
      } finally {
        setImportingYears(false);
      }
    },
    [loadOverviewInternal, t],
  );

  const handleImportYears = React.useCallback(async () => {
    setImportingYears(true);
    setError(null);
    setInfo(null);
    try {
      const result = await importOverviewYears({ selectedYears, t });
      setInfo(result.info);
      setImportedWorkspaceYears(result.importedWorkspaceYears);
      await loadOverview();
    } catch (err) {
      recordOverviewImportFailure(selectedYears);
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorImportYearsFailed', 'Year import failed.'),
      );
    } finally {
      setImportingYears(false);
    }
  }, [loadOverview, selectedYears, t]);

  const runSync = React.useCallback(
    async (years: number[]) => {
      const result = await syncImportV2(years);
      sendV2OpsEvent({
        event: 'veeti_sync',
        status: 'ok',
        attrs: {
          requestedYearCount: years.length,
          syncedCount: result.generatedBudgets.results.length,
          skippedCount: result.generatedBudgets.skipped?.length ?? 0,
        },
      });
      const syncedCount = result.generatedBudgets.results.length;
      const skippedCount = result.generatedBudgets.skipped?.length ?? 0;
      const mismatchYears = (result.sanity?.rows ?? [])
        .filter((row) => row.status === 'mismatch')
        .map((row) => row.year);
      if (skippedCount > 0) {
        setInfo(
          t(
            'v2Overview.infoSyncWithSkips',
            mismatchYears.length > 0
              ? 'Sync done: {{synced}} year(s) updated, {{skipped}} skipped. Sanity mismatches: {{years}}.'
              : 'Sync done: {{synced}} year(s) updated, {{skipped}} skipped. Check year notes below.',
            {
              synced: syncedCount,
              skipped: skippedCount,
              years: mismatchYears.join(', '),
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.infoSyncDone',
            mismatchYears.length > 0
              ? 'Sync done: {{count}} year(s) updated. Sanity mismatches: {{years}}.'
              : 'Sync done: {{count}} year(s) updated.',
            {
              count: syncedCount,
              years: mismatchYears.join(', '),
            },
          ),
        );
      }
      await loadOverview({
        preserveVisibleState: true,
        preserveSelectionState: true,
        preserveReviewContinueStep: true,
        deferSecondaryLoads: true,
      });
      const yearsToRefresh = [...new Set(years)]
        .map((year) => Math.round(Number(year)))
        .filter((year) => Number.isFinite(year));
      if (yearsToRefresh.length > 0) {
        const refreshedEntries = await Promise.all(
          yearsToRefresh.map(async (year) => {
            try {
              return [year, await getImportYearDataV2(year)] as const;
            } catch {
              return null;
            }
          }),
        );
        const nextEntries = refreshedEntries.filter(
          (entry): entry is readonly [number, V2ImportYearDataResponse] =>
            entry !== null,
        );
        if (nextEntries.length > 0) {
          setYearDataCache((prev) => ({
            ...prev,
            ...Object.fromEntries(nextEntries),
          }));
        }
      }
      return result;
    },
    [loadOverview, setYearDataCache, t],
  );

  const toggleYear = React.useCallback((year: number, blockedReason: string | null) => {
    if (blockedReason) return;
    syncYearSelectionTouchedRef.current = true;
    setSelectedYears((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

  const selectedOrgStillVisible = React.useMemo(
    () => (selectedOrg ? searchResults.some((row) => row.Id === selectedOrg.Id) : false),
    [searchResults, selectedOrg],
  );
  React.useEffect(() => {
    if (selectedOrg || searchResults.length !== 1) return;
    setSelectedOrg(searchResults[0] ?? null);
  }, [searchResults, selectedOrg]);
  const preferredSearchOrg = React.useMemo(
    () => selectedOrg ?? (searchResults.length === 1 ? searchResults[0] : null),
    [searchResults, selectedOrg],
  );

  const {
    excludeYearFromImportBoard,
    handleBulkDeleteYears,
    handleBulkRestoreYears,
    handleGuideBlockedYears,
    restoreYearFromImportBoard,
    toggleYearForDelete,
    toggleYearForRestore,
  } = useOverviewImportMaintenance({
    t,
    selectedYearsForDelete,
    selectedYearsForRestore,
    selectedYearsRef,
    selectedYearsForDeleteRef,
    selectedYearsForRestoreRef,
    syncYearSelectionTouchedRef,
    setSelectedYears,
    setSelectedYearsForDelete,
    setSelectedYearsForRestore,
    setExcludedYearOverrides,
    setRemovingYear,
    setError,
    setInfo,
    setBulkDeletingYears,
    setBulkRestoringYears,
    loadOverview,
    loadOverviewInternal,
  });

  const searchTerm = query.trim();

  return {
    overview,
    setOverview,
    planningContext,
    setPlanningContext,
    loading,
    setLoading,
    error,
    setError,
    info,
    setInfo,
    query,
    setQuery,
    searching,
    setSearching,
    searchResults,
    setSearchResults,
    selectedOrg,
    setSelectedOrg,
    selectedYears,
    setSelectedYears,
    scenarioList,
    setScenarioList,
    reportList,
    setReportList,
    reviewedImportedYears,
    setReviewedImportedYears,
    importedWorkspaceYears,
    setImportedWorkspaceYears,
    latestPlanningBaselineSummary,
    setLatestPlanningBaselineSummary,
    reviewContinueStep,
    setReviewContinueStep,
    connecting,
    setConnecting,
    importingYears,
    importYearsIntoWorkspace,
    setImportingYears,
    creatingPlanningBaseline,
    setCreatingPlanningBaseline,
    syncing,
    setSyncing,
    removingYear,
    setRemovingYear,
    excludedYearOverrides,
    bulkDeletingYears,
    setBulkDeletingYears,
    bulkRestoringYears,
    setBulkRestoringYears,
    selectedYearsForDelete,
    setSelectedYearsForDelete,
    selectedYearsForRestore,
    setSelectedYearsForRestore,
    syncYearSelectionTouchedRef,
    selectedYearsRef,
    selectedYearsForDeleteRef,
    selectedYearsForRestoreRef,
    selectedOrgRef,
    searchRequestSeq,
    previewFetchYearsRef,
    handledSetupBackSignalRef,
    pruneYearFromSelections,
    baselineReady,
    backendAcceptedPlanningYears,
    loadOverview,
    performOrganizationSearch,
    handleSearch,
    handleConnect,
    handleImportYears,
    runSync,
    toggleYear,
    selectedOrgStillVisible,
    preferredSearchOrg,
    toggleYearForDelete,
    toggleYearForRestore,
    handleBulkDeleteYears,
    handleBulkRestoreYears,
    excludeYearFromImportBoard,
    restoreYearFromImportBoard,
    searchTerm,
    handleGuideBlockedYears,
  };
}

export type OverviewImportController = ReturnType<typeof useOverviewImportController>;
