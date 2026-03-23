import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  excludeImportYearsV2,
  createPlanningBaselineV2,
  getImportYearDataV2,
  previewWorkbookImportV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
  type V2PlanningContextResponse,
  type V2OverviewResponse,
  type V2ReportListItem,
  type V2WorkbookPreviewResponse,
  type VeetiOrganizationSearchHit,
} from '../api';
import { applyOrganizationDefaultLanguage } from '../i18n';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import { OverviewImportBoard } from './OverviewImportBoard';
import { OverviewReviewBoard } from './OverviewReviewBoard';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from './OverviewWizardPanels';
import { OverviewSupportRail } from './OverviewSupportRail';
import {
  getDatasetSourceLabel as buildDatasetSourceLabel,
  getFinancialComparisonLabel as buildFinancialComparisonLabel,
  getFinancialSourceFieldLabel,
  getImportWarningLabel as buildImportWarningLabel,
  getMissingRequirementLabel as buildMissingRequirementLabel,
  getPriceComparisonLabel as buildPriceComparisonLabel,
  getSourceLayerText as buildSourceLayerText,
  getSourceStatusClassName as buildSourceStatusClassName,
  getSourceStatusLabel as buildSourceStatusLabel,
  getVolumeComparisonLabel as buildVolumeComparisonLabel,
  renderDatasetCounts as formatDatasetCounts,
  renderDatasetTypeList as formatDatasetTypeList,
} from './overviewLabels';
import {
  buildEnergyForm,
  buildFinancialForm,
  buildInvestmentForm,
  buildNetworkForm,
  buildPriceForm,
  buildVolumeForm,
  CARD_SUMMARY_FIELD_TO_INLINE_FIELD,
  formsDiffer,
  getEffectiveFirstRow,
  getEffectiveRows,
  getRawFirstRow,
  IMPORT_BOARD_CANON_ROWS,
  numbersDiffer,
  parseManualNumber,
  type InlineCardField,
  type ManualEnergyForm,
  type ManualFinancialForm,
  type ManualInvestmentForm,
  type ManualNetworkForm,
  type ManualPriceForm,
  type ManualVolumeForm,
  WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY,
} from './overviewManualForms';
import {
  connectOverviewOrganization,
  importOverviewYears,
  loadOverviewOrchestration,
  performOverviewOrganizationSearch,
  recordOverviewConnectFailure,
  recordOverviewImportFailure,
  recordOverviewSearchFailure,
} from './overviewOrchestration';
import {
  createQdisImportState,
  createStatementImportState,
  createWorkbookImportState,
  submitWorkbookImportWorkflow,
} from './overviewImportWorkflows';
import {
  useOverviewManualPatchEditor,
  type ManualPatchMode,
} from './useOverviewManualPatchEditor';
import {
  getExactEditedFieldLabels,
  useOverviewSetupState,
} from './useOverviewSetupState';
import {
  getMissingSyncRequirements,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  type SetupWizardStep,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';
import type { QdisFieldKey, QdisFieldMatch } from './qdisPdfImport';
import {
  buildStatementOcrComparisonRows,
  normalizeStatementOcrFieldValue,
  type StatementOcrFieldKey,
  type StatementOcrMatch,
} from './statementOcrParse';
import {
  buildFinancialComparisonRows,
  buildImportYearResultToZeroSignal,
  buildImportYearSourceLayers,
  buildImportYearSummaryRows,
  buildImportYearTrustSignal,
  buildPriceComparisonRows,
  buildVolumeComparisonRows,
  canReapplyDatasetVeeti,
  canReapplyFinancialVeeti,
  markPersistedReviewedImportYears,
  resolveApprovedYearStep,
  resolveNextReviewQueueYear,
  resolveReviewContinueTarget,
} from './yearReview';

type Props = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
  setupBackSignal?: number;
};

type StatementImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<StatementOcrFieldKey, number>>;
  matches: StatementOcrMatch[];
  warnings: string[];
};

type QdisImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  fields: Partial<Record<QdisFieldKey, number>>;
  matches: QdisFieldMatch[];
  warnings: string[];
};
type ImportWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

type WizardContextHelperTone = 'neutral' | 'positive' | 'warning';

type WizardContextHelper = {
  key: string;
  label: string;
  title: string;
  body: string;
  tone: WizardContextHelperTone;
};

const AUTO_SEARCH_MIN_QUERY_LENGTH = 3;
const AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH = 4;
const AUTO_SEARCH_DELAY_MS = 320;
const AUTO_SEARCH_BUSINESS_ID_DELAY_MS = 120;

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeOrganizationSearchQuery = (value: string): string =>
  value.trim().replace(/\s+/g, ' ');

const normalizeBusinessIdCandidate = (value: string): string =>
  normalizeOrganizationSearchQuery(value).replace(/[^\d]/g, '');

const isBusinessIdLikeQuery = (value: string): boolean =>
  /^[\d-\s]+$/.test(normalizeOrganizationSearchQuery(value)) &&
  normalizeBusinessIdCandidate(value).length > 0;

const getAutoSearchMinLength = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_MIN_LENGTH
    : AUTO_SEARCH_MIN_QUERY_LENGTH;

const getAutoSearchDelayMs = (value: string): number =>
  isBusinessIdLikeQuery(value)
    ? AUTO_SEARCH_BUSINESS_ID_DELAY_MS
    : AUTO_SEARCH_DELAY_MS;

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
  setupBackSignal,
}) => {
  const { t } = useTranslation();
  const [overview, setOverview] = React.useState<V2OverviewResponse | null>(
    null,
  );
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
  const [statementImportBusy, setStatementImportBusy] = React.useState(false);
  const [statementImportStatus, setStatementImportStatus] = React.useState<
    string | null
  >(null);
  const [statementImportError, setStatementImportError] = React.useState<
    string | null
  >(null);
  const [statementImportPreview, setStatementImportPreview] =
    React.useState<StatementImportPreview | null>(null);
  const [workbookImportBusy, setWorkbookImportBusy] = React.useState(false);
  const [workbookImportStatus, setWorkbookImportStatus] = React.useState<
    string | null
  >(null);
  const [workbookImportError, setWorkbookImportError] = React.useState<
    string | null
  >(null);
  const [workbookImportPreview, setWorkbookImportPreview] =
    React.useState<V2WorkbookPreviewResponse | null>(null);
  const [workbookImportSelections, setWorkbookImportSelections] =
    React.useState<
      Record<
        number,
        Partial<
          Record<
            V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
            'keep_veeti' | 'apply_workbook'
          >
        >
      >
    >({});
  const [qdisImportBusy, setQdisImportBusy] = React.useState(false);
  const [qdisImportStatus, setQdisImportStatus] = React.useState<string | null>(
    null,
  );
  const [qdisImportError, setQdisImportError] = React.useState<string | null>(
    null,
  );
  const [qdisImportPreview, setQdisImportPreview] =
    React.useState<QdisImportPreview | null>(null);
  const handledSetupBackSignalRef = React.useRef(0);
  const baselineReady = React.useMemo(
    () =>
      (planningContext?.canCreateScenario ??
        (planningContext?.baselineYears?.length ?? 0) > 0) ||
      (scenarioList?.length ?? 0) > 0 ||
      (reportList?.length ?? 0) > 0,
    [
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      reportList?.length,
      scenarioList?.length,
    ],
  );
  const statementFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const workbookFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const qdisFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const resetStatementImportState = React.useCallback(() => {
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
  }, []);
  const resetWorkbookImportState = React.useCallback(() => {
    setWorkbookImportError(null);
    setWorkbookImportStatus(null);
    setWorkbookImportPreview(null);
    setWorkbookImportSelections({});
    if (workbookFileInputRef.current) {
      workbookFileInputRef.current.value = '';
    }
  }, []);
  const resetQdisImportState = React.useCallback(() => {
    setQdisImportError(null);
    setQdisImportStatus(null);
    setQdisImportPreview(null);
    if (qdisFileInputRef.current) {
      qdisFileInputRef.current.value = '';
    }
  }, []);

  const {
    setInlineCardFieldRef,
    yearDataCache,
    setYearDataCache,
    loadingYearData,
    manualPatchYear,
    setManualPatchYear,
    cardEditYear,
    setCardEditYear,
    cardEditFocusField,
    setCardEditFocusField,
    cardEditContext,
    setCardEditContext,
    manualPatchMode,
    setManualPatchMode,
    manualPatchMissing,
    setManualPatchMissing,
    manualPatchBusy,
    setManualPatchBusy,
    manualPatchError,
    setManualPatchError,
    manualFinancials,
    setManualFinancials,
    manualPrices,
    setManualPrices,
    manualVolumes,
    setManualVolumes,
    manualInvestments,
    setManualInvestments,
    manualEnergy,
    setManualEnergy,
    manualNetwork,
    setManualNetwork,
    manualReason,
    setManualReason,
    populateManualEditorFromYearData,
    loadYearIntoManualEditor,
    closeInlineCardEditor,
    isInlineCardDirty,
    dismissInlineCardEditor,
    openInlineCardEditor,
    attemptOpenInlineCardEditor,
    resolveRepairFocusField,
    buildRepairActions,
    buildManualPatchPayload,
    saveInlineCardEdit: saveInlineCardEditBase,
    handleSwitchToManualEditMode,
  } = useOverviewManualPatchEditor({
    t,
    statementImportPreview,
    qdisImportPreview,
    statementImportBusy,
    workbookImportBusy,
    qdisImportBusy,
    resetStatementImportState,
    resetWorkbookImportState,
    resetQdisImportState,
  });

  const resolveSyncBlockReason = React.useCallback(
    (row: { completeness: Record<string, boolean> }): string | null => {
      const key = getSyncBlockReasonKey({
        vuosi: 0,
        completeness: row.completeness,
      });
      if (!key) return null;
      if (key === 'v2Overview.yearReasonMissingFinancials') {
        return t(key, 'Missing financial statement data.');
      }
      if (key === 'v2Overview.yearReasonMissingPrices') {
        return t(key, 'Missing price data (taksa).');
      }
      return t(key, 'Missing sold volume data.');
    },
    [t],
  );

  const pickDefaultSyncYears = React.useCallback(
    (rows: Array<{ vuosi: number; completeness: Record<string, boolean> }>) =>
      [...rows]
        .filter((row) => resolveSyncBlockReason(row) === null)
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi),
    [resolveSyncBlockReason],
  );

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

  const loadOverview = React.useCallback(async (options?: {
    preserveVisibleState?: boolean;
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
        setSelectedYears(result.selectionState.selectedYears);
        setSelectedYearsForDelete(result.selectionState.selectedYearsForDelete);
        setSelectedYearsForRestore(result.selectionState.selectedYearsForRestore);
        setImportedWorkspaceYears(result.selectionState.importedWorkspaceYears);
        setReviewContinueStep(null);
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
  }, [pickDefaultSyncYears, t]);

  React.useEffect(() => {
    loadOverview();
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

  React.useEffect(() => {
    const orgLanguage = overview?.importStatus.link?.uiLanguage;
    if (!orgLanguage) return;
    void applyOrganizationDefaultLanguage(orgLanguage);
  }, [overview?.importStatus.link?.uiLanguage]);

  const handleSearch = React.useCallback(async () => {
    const searchValue = normalizeOrganizationSearchQuery(query);
    if (searchValue.length < 2) return;
    await performOrganizationSearch(searchValue);
  }, [performOrganizationSearch, query]);

  const handleConnect = React.useCallback(async (org?: VeetiOrganizationSearchHit | null) => {
    const targetOrg = org ?? selectedOrg;
    if (!targetOrg) return;
    setConnecting(true);
    setError(null);
    setInfo(null);
    try {
      const result = await connectOverviewOrganization({
        targetOrg,
        pickDefaultSyncYears,
        t,
      });
      syncYearSelectionTouchedRef.current = false;
      setSelectedYears(result.defaultSelectedYears);
      setSelectedYearsForDelete([]);
      setSelectedYearsForRestore([]);
      setReviewContinueStep(null);
      setImportedWorkspaceYears(result.importedWorkspaceYears);
      setOverview((current) =>
        current
          ? {
              ...current,
              importStatus: result.status,
            }
          : current,
      );
      setInfo(result.info);
      void loadOverview({
        preserveVisibleState: true,
        deferSecondaryLoads: true,
      });
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
  }, [selectedOrg, pickDefaultSyncYears, loadOverview, t]);

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
      await loadOverview();
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
    [loadOverview, t],
  );

  const toggleYear = React.useCallback(
    (year: number, blockedReason: string | null) => {
      if (blockedReason) return;
      syncYearSelectionTouchedRef.current = true;
      setSelectedYears((prev) => {
        if (prev.includes(year)) return prev.filter((item) => item !== year);
        return [...prev, year].sort((a, b) => a - b);
      });
    },
    [],
  );

  const {
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    recommendedYears,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    parkedTrustBoardRows,
    blockedTrustBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    excludedYearsSorted,
    reviewStatusRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    pendingReviewYearCount,
    includedPlanningYears,
    acceptedPlanningYearRows,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
    setupWizardState,
    wizardDisplayStep,
    displaySetupWizardState,
    wizardBackStep,
    previewPrefetchYears,
    selectableImportYearRows,
  } = useOverviewSetupState({
    overview,
    yearDataCache,
    selectedYears,
    importedWorkspaceYears,
    reviewedImportedYears,
    setReviewedImportedYears,
    manualPatchYear,
    cardEditYear,
    cardEditContext,
    reviewContinueStep,
    baselineReady,
    t,
  });

  const saveInlineCardEdit = React.useCallback(
    async (syncAfterSave = false) =>
      saveInlineCardEditBase({
        syncAfterSave,
        loadOverview,
        runSync,
        reviewStatusRows,
        confirmedImportedYears,
        reviewStorageOrgId,
        baselineReady,
        setReviewedImportedYears,
        setReviewContinueStep,
        setError,
        setInfo,
      }),
    [
      baselineReady,
      confirmedImportedYears,
      loadOverview,
      reviewStatusRows,
      reviewStorageOrgId,
      runSync,
      saveInlineCardEditBase,
    ],
  );
  const handleInlineCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        dismissInlineCardEditor(true);
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === 'TEXTAREA') return;
        event.preventDefault();
        void saveInlineCardEdit(false);
      }
    },
    [dismissInlineCardEditor, saveInlineCardEdit],
  );

  const selectedOrgStillVisible = React.useMemo(
    () =>
      selectedOrg
        ? searchResults.some((row) => row.Id === selectedOrg.Id)
        : false,
    [searchResults, selectedOrg],
  );
  React.useEffect(() => {
    if (selectedOrg || searchResults.length !== 1) return;
    setSelectedOrg(searchResults[0] ?? null);
  }, [searchResults, selectedOrg]);
  const preferredSearchOrg = React.useMemo(
    () =>
      selectedOrg ?? (searchResults.length === 1 ? searchResults[0] : null),
    [searchResults, selectedOrg],
  );

  const toggleYearForDelete = React.useCallback((year: number) => {
    setSelectedYearsForDelete((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

  const toggleYearForRestore = React.useCallback((year: number) => {
    setSelectedYearsForRestore((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

  const handleBulkDeleteYears = React.useCallback(async () => {
    if (selectedYearsForDelete.length === 0) return;

    const yearsLabel = [...selectedYearsForDelete]
      .sort((a, b) => a - b)
      .join(', ');
    const confirmed = window.confirm(
      t(
        'v2Overview.excludeYearsBulkConfirm',
        'Rajataanko vuodet {{years}} pois suunnitelmasta? Vuodet säilyvät työtilassa ja ne voi palauttaa myöhemmin.',
        { years: yearsLabel },
      ),
    );
    if (!confirmed) return;

    setBulkDeletingYears(true);
    setError(null);
    setInfo(null);

    try {
      const result = await excludeImportYearsV2(selectedYearsForDelete);
      const skippedYears = result.results
        .filter((row) => row.reason !== null)
        .map((row) => row.vuosi);
      if (skippedYears.length > 0) {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkPartial',
            'Rajattiin {{excluded}} vuosi/vuotta pois suunnitelmasta. {{skipped}} vuosi/vuotta oli jo rajattu: {{years}}.',
            {
              excluded: result.excludedCount,
              skipped: result.alreadyExcludedCount,
              years: skippedYears.join(', '),
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.excludeYearsBulkDone',
            'Vuodet rajattiin pois suunnitelmasta: {{count}}.',
            { count: result.excludedCount },
          ),
        );
      }
      setSelectedYearsForDelete([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearsBulkFailed',
              'Valittujen vuosien rajaaminen pois suunnitelmasta epäonnistui.',
            ),
      );
    } finally {
      setBulkDeletingYears(false);
    }
  }, [selectedYearsForDelete, loadOverview, t]);

  const handleBulkRestoreYears = React.useCallback(async () => {
    if (selectedYearsForRestore.length === 0) return;

    setBulkRestoringYears(true);
    setError(null);
    setInfo(null);

    try {
      const result = await restoreImportYearsV2(selectedYearsForRestore);
      const notRestored = result.results.filter((row) => !row.restored);
      if (notRestored.length > 0) {
        setInfo(
          t(
            'v2Overview.restoreYearsBulkPartial',
            'Restored {{restored}} year(s). {{missing}} year(s) were not excluded.',
            {
              restored: result.restoredCount,
              missing: result.notExcludedCount,
            },
          ),
        );
      } else {
        setInfo(
          t('v2Overview.restoreYearsBulkDone', 'Restored {{count}} year(s).', {
            count: result.restoredCount,
          }),
        );
      }
      setSelectedYearsForRestore([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.restoreYearsBulkFailed',
              'Failed to restore selected years.',
            ),
      );
    } finally {
      setBulkRestoringYears(false);
    }
  }, [selectedYearsForRestore, loadOverview, t]);

  const searchTerm = query.trim();

  const renderHighlightedSearchMatch = React.useCallback(
    (value: string): React.ReactNode => {
      if (searchTerm.length < 2) return value;
      const matcher = new RegExp(`(${escapeRegExp(searchTerm)})`, 'ig');
      const parts = value.split(matcher);
      return parts.map((part, index) => {
        if (part.toLowerCase() === searchTerm.toLowerCase()) {
          return (
            <mark className="v2-search-mark" key={`${value}-${index}`}>
              {part}
            </mark>
          );
        }
        return (
          <React.Fragment key={`${value}-${index}`}>{part}</React.Fragment>
        );
      });
    },
    [searchTerm],
  );

  const handleGuideBlockedYears = React.useCallback(() => {
    document.getElementById('v2-import-years')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const openManualPatchDialog = React.useCallback(
    async (
      year: number,
      missing: MissingRequirement[],
      mode: ManualPatchMode = 'review',
    ) => {
      setCardEditContext(null);
      setCardEditYear(null);
      setCardEditFocusField(null);
      setManualPatchYear(year);
      setManualPatchMode(mode);
      setManualPatchMissing(missing);
      setManualPatchError(null);
      setManualReason('');
      setManualFinancials({
        liikevaihto: 0,
        aineetJaPalvelut: 0,
        henkilostokulut: 0,
        liiketoiminnanMuutKulut: 0,
        poistot: 0,
        arvonalentumiset: 0,
        rahoitustuototJaKulut: 0,
        tilikaudenYliJaama: 0,
        omistajatuloutus: 0,
        omistajanTukiKayttokustannuksiin: 0,
      });
      setManualPrices({ waterUnitPrice: 0, wastewaterUnitPrice: 0 });
      setManualVolumes({ soldWaterVolume: 0, soldWastewaterVolume: 0 });
      setManualInvestments({
        investoinninMaara: 0,
        korvausInvestoinninMaara: 0,
      });
      setManualEnergy({ prosessinKayttamaSahko: 0 });
      setManualNetwork({ verkostonPituus: 0 });
      setStatementImportError(null);
      setStatementImportStatus(null);
      setStatementImportPreview(null);
      setQdisImportError(null);
      setQdisImportStatus(null);
      setQdisImportPreview(null);
      if (statementFileInputRef.current) {
        statementFileInputRef.current.value = '';
      }
      if (qdisFileInputRef.current) {
        qdisFileInputRef.current.value = '';
      }

      await loadYearIntoManualEditor(year);
    },
    [loadYearIntoManualEditor],
  );

  const resetManualPatchDialog = React.useCallback(() => {
    setManualPatchYear(null);
    setCardEditYear(null);
    setCardEditFocusField(null);
    setCardEditContext(null);
    setReviewContinueStep(null);
    setManualPatchMode('review');
    setManualPatchMissing([]);
    setManualPatchError(null);
    setManualReason('');
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    setWorkbookImportError(null);
    setWorkbookImportStatus(null);
    setWorkbookImportPreview(null);
    setWorkbookImportSelections({});
    setQdisImportError(null);
    setQdisImportStatus(null);
    setQdisImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
    if (workbookFileInputRef.current) {
      workbookFileInputRef.current.value = '';
    }
    if (qdisFileInputRef.current) {
      qdisFileInputRef.current.value = '';
    }
  }, []);

  const closeManualPatchDialog = React.useCallback(() => {
    if (manualPatchBusy || statementImportBusy || workbookImportBusy) return;
    resetManualPatchDialog();
  }, [
    manualPatchBusy,
    resetManualPatchDialog,
    statementImportBusy,
    workbookImportBusy,
  ]);

  const applyOcrFinancialMatch = React.useCallback(
    (match: StatementOcrMatch) => {
      const normalizedValue = normalizeStatementOcrFieldValue(
        match.key,
        match.value,
      );
      setManualFinancials((prev) => {
        switch (match.key) {
          case 'liikevaihto':
            return { ...prev, liikevaihto: normalizedValue ?? 0 };
          case 'henkilostokulut':
            return { ...prev, henkilostokulut: normalizedValue ?? 0 };
          case 'liiketoiminnanMuutKulut':
            return {
              ...prev,
              liiketoiminnanMuutKulut: normalizedValue ?? 0,
            };
          case 'poistot':
            return { ...prev, poistot: normalizedValue ?? 0 };
          case 'rahoitustuototJaKulut':
            return { ...prev, rahoitustuototJaKulut: normalizedValue ?? 0 };
          case 'tilikaudenYliJaama':
            return { ...prev, tilikaudenYliJaama: normalizedValue ?? 0 };
          default:
            return prev;
        }
      });
    },
    [],
  );

  const handleWorkbookSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setWorkbookImportBusy(true);
      setWorkbookImportError(null);
      setWorkbookImportPreview(null);
      setWorkbookImportSelections({});
      setWorkbookImportStatus(
        t(
          'v2Overview.workbookImportStarting',
          'Preparing workbook comparison from the uploaded Excel file...',
        ),
      );

      try {
        const result = await createWorkbookImportState({
          file,
          manualReason,
          t,
          yearDataCache,
        });
        if (result.nextReason) {
          setManualReason(result.nextReason);
        }
        setWorkbookImportPreview(result.preview);
        setWorkbookImportSelections(result.selections);
        if (Object.keys(result.loadedYears).length > 0) {
          setYearDataCache((prev) => ({
            ...prev,
            ...result.loadedYears,
          }));
        }
        setWorkbookImportStatus(result.status);
      } catch (err) {
        setWorkbookImportError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportFailed',
                'Workbook import preview failed.',
              ),
        );
        setWorkbookImportStatus(null);
      } finally {
        setWorkbookImportBusy(false);
      }
    },
    [manualReason, t, yearDataCache],
  );

  const handleStatementPdfSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || manualPatchYear == null) return;

      setStatementImportBusy(true);
      setStatementImportError(null);
      setStatementImportPreview(null);
      setStatementImportStatus(
        t(
          'v2Overview.statementImportStarting',
          'Preparing OCR import for the uploaded statement PDF...',
        ),
      );

      try {
        const result = await createStatementImportState({
          file,
          manualReason,
          t,
        });
        for (const match of result.preview.matches) {
          applyOcrFinancialMatch(match);
        }
        if (result.nextReason) {
          setManualReason(result.nextReason);
        }
        setStatementImportPreview(result.preview);
        setStatementImportStatus(result.status);
        sendV2OpsEvent({
          event: 'statement_pdf_ocr',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            fileName: result.preview.fileName,
            detectedPage: result.preview.pageNumber,
            mappedFieldCount: result.preview.matches.length,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.statementImportFailed',
                'Statement OCR import failed.',
              );
        setStatementImportError(message);
        setStatementImportStatus(null);
        sendV2OpsEvent({
          event: 'statement_pdf_ocr',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            fileName: file.name,
          },
        });
      } finally {
        setStatementImportBusy(false);
      }
    },
    [applyOcrFinancialMatch, manualPatchYear, manualReason, t],
  );

  const handleQdisPdfSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || manualPatchYear == null) return;

      setQdisImportBusy(true);
      setQdisImportError(null);
      setQdisImportPreview(null);
      setQdisImportStatus(
        t(
          'v2Overview.qdisImportStarting',
          'Preparing QDIS import for the uploaded PDF...',
        ),
      );

      try {
        const result = await createQdisImportState({
          file,
          manualReason,
          t,
        });

        setManualPrices((prev) => ({
          waterUnitPrice:
            result.preview.fields.waterUnitPrice ?? prev.waterUnitPrice,
          wastewaterUnitPrice:
            result.preview.fields.wastewaterUnitPrice ?? prev.wastewaterUnitPrice,
        }));
        setManualVolumes((prev) => ({
          soldWaterVolume:
            result.preview.fields.soldWaterVolume ?? prev.soldWaterVolume,
          soldWastewaterVolume:
            result.preview.fields.soldWastewaterVolume ?? prev.soldWastewaterVolume,
        }));

        if (result.nextReason) {
          setManualReason(result.nextReason);
        }

        setQdisImportPreview(result.preview);
        setQdisImportStatus(result.status);
        sendV2OpsEvent({
          event: 'qdis_pdf_import',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            fileName: result.preview.fileName,
            detectedPage: result.preview.pageNumber,
            mappedFieldCount: result.preview.matches.length,
          },
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.qdisImportFailed',
                'QDIS PDF import failed.',
              );
        setQdisImportError(message);
        setQdisImportStatus(null);
        sendV2OpsEvent({
          event: 'qdis_pdf_import',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            fileName: file.name,
          },
        });
      } finally {
        setQdisImportBusy(false);
      }
    },
    [manualPatchYear, manualReason, t],
  );

  const buildWorkbookImportPayloads = React.useCallback(() => {
    if (!workbookImportPreview) {
      setManualPatchError(
        t(
          'v2Overview.workbookImportNoPreview',
          'Upload the KVA workbook and review the comparison before saving workbook choices.',
        ),
      );
      return null;
    }

    const payloads: Array<{ year: number; payload: V2ManualYearPatchPayload }> = [];
    for (const year of workbookImportPreview.years) {
      const candidateRows = year.rows
        .filter((row) => row.workbookValue != null)
        .map((row) => ({
          sourceField: row.sourceField,
          workbookValue: row.workbookValue,
          action:
            workbookImportSelections[year.year]?.[row.sourceField] ??
            row.suggestedAction,
        }));
      const confirmedRows = candidateRows.filter(
        (row) => row.action === 'apply_workbook' && row.workbookValue != null,
      );
      if (confirmedRows.length === 0) {
        continue;
      }

      const financials: NonNullable<V2ManualYearPatchPayload['financials']> = {};
      for (const row of confirmedRows) {
        financials[WORKBOOK_SOURCE_FIELD_TO_FINANCIAL_KEY[row.sourceField]] =
          row.workbookValue ?? undefined;
      }

      payloads.push({
        year: year.year,
        payload: {
          year: year.year,
          reason:
            manualReason.trim() ||
            t(
              'v2Overview.workbookImportReasonDefault',
              'Imported from KVA workbook: {{fileName}}',
              { fileName: workbookImportPreview.document.fileName },
            ),
          financials,
          workbookImport: {
            kind: 'kva_import',
            fileName: workbookImportPreview.document.fileName,
            sheetName: workbookImportPreview.sheetName,
            matchedYears: workbookImportPreview.matchedYears,
            matchedFields: candidateRows.map((row) => row.sourceField),
            confirmedSourceFields: confirmedRows.map((row) => row.sourceField),
            candidateRows,
            warnings: [],
          },
        },
      });
    }

    if (payloads.length === 0) {
      setManualPatchError(
        t(
          'v2Overview.workbookImportNoSelection',
          'Choose at least one workbook value to apply before saving workbook choices.',
        ),
      );
      return null;
    }

    return {
      payloads,
      matchedYears: workbookImportPreview.matchedYears,
      yearsToSync: payloads.map((item) => item.year),
    };
  }, [manualReason, t, workbookImportPreview, workbookImportSelections]);

  const submitWorkbookImport = React.useCallback(
    async (syncAfterSave: boolean) => {
      const built = buildWorkbookImportPayloads();
      if (!built) return;

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const { syncedYears, nextQueueRow, shouldCloseInlineReview } =
          await submitWorkbookImportWorkflow({
            built,
            syncAfterSave,
            reviewStatusRows,
            reviewStorageOrgId,
            confirmedImportedYears,
            cardEditContext,
            baselineReady,
            runSync,
            loadOverview,
            setReviewedImportedYears,
            setYearDataCache,
          });

        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            years: built.yearsToSync.join(','),
            syncReadyCount: syncedYears.length,
            patchedYearCount: built.payloads.length,
          },
        });

        if (!syncAfterSave || syncedYears.length === 0) {
          setInfo(
            t(
              'v2Overview.workbookImportSaved',
              'Workbook choices saved for {{count}} year(s).',
              { count: built.payloads.length },
            ),
          );
        }

        if (cardEditContext === 'step3' && nextQueueRow) {
          await openInlineCardEditor(
            nextQueueRow.year,
            null,
            'step3',
            nextQueueRow.missingRequirements,
          );
          return;
        }

        if (shouldCloseInlineReview) {
          closeInlineCardEditor();
          setReviewContinueStep(baselineReady ? 6 : 5);
          return;
        }

        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }

        if (syncedYears.length > 0) {
          setReviewContinueStep(baselineReady ? 6 : 5);
        }
        resetManualPatchDialog();
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            syncAfterSave,
            mode: 'workbookImport',
          },
        });
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.workbookImportApplyFailed',
                'Applying workbook choices failed.',
              ),
        );
      } finally {
        setManualPatchBusy(false);
      }
    },
    [
      buildWorkbookImportPayloads,
      cardEditContext,
      closeInlineCardEditor,
      confirmedImportedYears,
      loadOverview,
      openInlineCardEditor,
      openManualPatchDialog,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      runSync,
      t,
    ],
  );

  const submitManualPatch = React.useCallback(
    async (syncAfterSave: boolean) => {
      if (manualPatchYear == null) return;
      const payload = buildManualPatchPayload(manualPatchYear);
      if (!payload) return;

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const currentYear = manualPatchYear;
        const result = await completeImportYearManuallyV2(payload);
        const reopenCurrentYearForFollowup =
          manualPatchMode === 'statementImport' && result.syncReady;
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus:
            row.year === currentYear && result.syncReady && !reopenCurrentYearForFollowup
              ? ('reviewed' as const)
              : row.setupStatus,
          missingRequirements: row.missingRequirements,
        }));
        const nextQueueYear = result.syncReady
          ? resolveNextReviewQueueYear(nextRows)
          : null;
        const nextQueueRow =
          nextQueueYear == null
            ? null
            : nextRows.find((row) => row.year === nextQueueYear) ?? null;
        if (!reopenCurrentYearForFollowup) {
          setReviewedImportedYears(
            markPersistedReviewedImportYears(
              reviewStorageOrgId,
              [currentYear],
              [...confirmedImportedYears, currentYear],
            ),
          );
        }
        setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[currentYear];
          return next;
        });
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            year: currentYear,
            syncReady: result.syncReady,
            patchedDataTypeCount: result.patchedDataTypes.length,
          },
        });
        if (syncAfterSave && result.syncReady) {
          await runSync([currentYear]);
        } else {
          await loadOverview();
          setInfo(t('v2Overview.manualPatchSaved', { year: currentYear }));
        }
        if (reopenCurrentYearForFollowup) {
          resetManualPatchDialog();
          await openInlineCardEditor(
            currentYear,
            null,
            'step3',
            manualPatchMissing,
          );
          return;
        }
        if (nextQueueRow) {
          resetManualPatchDialog();
          await openManualPatchDialog(
            nextQueueRow.year,
            nextQueueRow.missingRequirements,
            'review',
          );
          return;
        }
        if (result.syncReady) {
          setReviewContinueStep(baselineReady ? 6 : 5);
        }
        setManualPatchYear(null);
        setManualPatchMissing([]);
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            year: manualPatchYear,
            syncAfterSave,
          },
        });
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchFailed',
                'Manual year completion failed.',
              ),
        );
      } finally {
        setManualPatchBusy(false);
      }
    },
    [
      buildManualPatchPayload,
      loadOverview,
      manualPatchMissing,
      manualPatchMode,
      manualPatchYear,
      statementImportPreview,
      runSync,
      confirmedImportedYears,
      openManualPatchDialog,
      openInlineCardEditor,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      t,
    ],
  );

  const renderStep2InlineFieldEditor = (field: InlineCardField) => {
    const actionButtons = (
      <div className="v2-inline-field-editor-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small v2-btn-primary"
          onClick={() => void saveInlineCardEdit(false)}
          disabled={manualPatchBusy}
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t('v2Overview.manualPatchSave', 'Save year data')}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => dismissInlineCardEditor(true)}
          disabled={manualPatchBusy}
        >
          {t('common.close', 'Close')}
        </button>
      </div>
    );

    const wrapEditor = (children: React.ReactNode) => (
      <div
        className="v2-inline-field-editor"
        onKeyDown={handleInlineCardKeyDown}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
        {actionButtons}
      </div>
    );

    switch (field) {
      case 'liikevaihto':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)')}
            </span>
            <input
              ref={setInlineCardFieldRef('liikevaihto')}
              name={`inline-liikevaihto-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.liikevaihto}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  liikevaihto: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'aineetJaPalvelut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialMaterials', 'Materials and services')}
            </span>
            <input
              ref={setInlineCardFieldRef('aineetJaPalvelut')}
              name={`inline-aineetJaPalvelut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.aineetJaPalvelut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  aineetJaPalvelut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'henkilostokulut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialPersonnel', 'Personnel costs')}
            </span>
            <input
              ref={setInlineCardFieldRef('henkilostokulut')}
              name={`inline-henkilostokulut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.henkilostokulut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  henkilostokulut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'poistot':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualFinancialDepreciation', 'Depreciation')}
            </span>
            <input
              ref={setInlineCardFieldRef('poistot')}
              name={`inline-poistot-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.poistot}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  poistot: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'liiketoiminnanMuutKulut':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualFinancialOtherOpex',
                'Other operating costs',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('liiketoiminnanMuutKulut')}
              name={`inline-liiketoiminnanMuutKulut-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.01"
              value={manualFinancials.liiketoiminnanMuutKulut}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  liiketoiminnanMuutKulut: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'tilikaudenYliJaama':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualFinancialYearResult',
                'Year result (Tilikauden ylijäämä/alijäämä)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('tilikaudenYliJaama')}
              name={`inline-tilikaudenYliJaama-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              step="0.01"
              value={manualFinancials.tilikaudenYliJaama}
              onChange={(event) =>
                setManualFinancials((prev) => ({
                  ...prev,
                  tilikaudenYliJaama: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'waterUnitPrice':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)')}
            </span>
            <input
              ref={setInlineCardFieldRef('waterUnitPrice')}
              name={`inline-waterUnitPrice-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.001"
              value={manualPrices.waterUnitPrice}
              onChange={(event) =>
                setManualPrices((prev) => ({
                  ...prev,
                  waterUnitPrice: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'wastewaterUnitPrice':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualPriceWastewater',
                'Wastewater unit price (EUR/m3)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('wastewaterUnitPrice')}
              name={`inline-wastewaterUnitPrice-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="0.001"
              value={manualPrices.wastewaterUnitPrice}
              onChange={(event) =>
                setManualPrices((prev) => ({
                  ...prev,
                  wastewaterUnitPrice: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'soldWaterVolume':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
            </span>
            <input
              ref={setInlineCardFieldRef('soldWaterVolume')}
              name={`inline-soldWaterVolume-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="1"
              value={manualVolumes.soldWaterVolume}
              onChange={(event) =>
                setManualVolumes((prev) => ({
                  ...prev,
                  soldWaterVolume: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
      case 'soldWastewaterVolume':
        return wrapEditor(
          <label className="v2-inline-field-editor-control">
            <span className="v2-inline-field-editor-label">
              {t(
                'v2Overview.manualVolumeWastewater',
                'Sold wastewater volume (m3)',
              )}
            </span>
            <input
              ref={setInlineCardFieldRef('soldWastewaterVolume')}
              name={`inline-soldWastewaterVolume-${cardEditYear ?? 'year'}`}
              className="v2-input"
              type="number"
              min={0}
              step="1"
              value={manualVolumes.soldWastewaterVolume}
              onChange={(event) =>
                setManualVolumes((prev) => ({
                  ...prev,
                  soldWastewaterVolume: Number(event.target.value || 0),
                }))
              }
            />
          </label>,
        );
    }
  };

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => buildSourceStatusLabel(t, status),
    [t],
  );
  const sourceStatusClassName = React.useCallback(
    (status: string | undefined) => buildSourceStatusClassName(status),
    [],
  );

  const financialComparisonLabel = React.useCallback(
    (key: string) => buildFinancialComparisonLabel(t, key),
    [t],
  );

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: Parameters<typeof buildDatasetSourceLabel>[2],
    ) => buildDatasetSourceLabel(t, source, provenance),
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => formatDatasetTypeList(t, dataTypes),
    [t],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => buildImportWarningLabel(t, warning),
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => formatDatasetCounts(t, counts),
    [t],
  );
  const loadYearPreviewData = React.useCallback(
    async (year: number) => {
      if (
        yearDataCache[year] ||
        previewFetchYearsRef.current.has(year)
      ) {
        return;
      }
      previewFetchYearsRef.current.add(year);
      try {
        const yearData = await getImportYearDataV2(year);
        setYearDataCache((prev) =>
          prev[year] ? prev : { ...prev, [year]: yearData },
        );
      } catch {
        // Preview cards fall back gracefully when data is unavailable.
      } finally {
        previewFetchYearsRef.current.delete(year);
      }
    },
    [yearDataCache],
  );
  const renderYearValuePreview = React.useCallback(
    (
      year: number,
      availability?: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
    ) => {
      const yearData = yearDataCache[year];
      const accountingSummary = buildImportYearSummaryRows(yearData);
      const accountingSummaryMap = new Map(
        accountingSummary.map((row) => [row.key, row]),
      );
      const prices = buildPriceForm(yearData);
      const volumes = buildVolumeForm(yearData);
      const hasFinancials =
        availability?.financials ?? accountingSummaryMap.size > 0;
      const hasPrices =
        availability?.prices ??
        (prices.waterUnitPrice > 0 || prices.wastewaterUnitPrice > 0);
      const hasVolumes =
        availability?.volumes ??
        (volumes.soldWaterVolume > 0 || volumes.soldWastewaterVolume > 0);
      const trustSignal = buildImportYearTrustSignal(yearData);
      const resultToZero = buildImportYearResultToZeroSignal(yearData);
      const sourceLayers = buildImportYearSourceLayers(yearData);
      const summaryLabel = (key: string) => {
        if (key === 'revenue') {
          return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
        }
        if (key === 'materialsCosts') {
          return t(
            'v2Overview.previewAccountingMaterialsLabel',
            'Materials and services',
          );
        }
        if (key === 'personnelCosts') {
          return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
        }
        if (key === 'depreciation') {
          return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
        }
        if (key === 'otherOperatingCosts') {
          return t(
            'v2Overview.previewAccountingOtherOpexLabel',
            'Other operating costs',
          );
        }
        return t('v2Overview.previewAccountingResultLabel', 'Result');
      };
      const exactEditedFieldLabels = getExactEditedFieldLabels({
        t,
        yearData,
        changedSummaryKeys: trustSignal.changedSummaryKeys,
        statementImportFieldSources: trustSignal.statementImport?.fieldSources,
        workbookImportFieldSources: trustSignal.workbookImport?.fieldSources,
      });
      const discrepancyNote =
        trustSignal.level === 'material'
          ? exactEditedFieldLabels.length > 0
            ? t('v2Overview.editedFieldsLabel', 'Edited: {{fields}}', {
                fields: exactEditedFieldLabels.join(', '),
              })
            : trustSignal.changedSummaryKeys.length > 0
            ? t('v2Overview.editedFieldsLabel', 'Edited: {{fields}}', {
                fields: trustSignal.changedSummaryKeys
                  .map((key) => summaryLabel(key))
                  .join(', '),
              })
            : null
          : null;
      const renderAccountingPreviewItem = (
        key:
          | 'revenue'
          | 'materialsCosts'
          | 'personnelCosts'
          | 'depreciation'
          | 'otherOperatingCosts'
          | 'result',
        labelKey: string,
        defaultLabel: string,
      ) => {
        const summaryRow = accountingSummaryMap.get(key);
        const value = summaryRow?.effectiveValue ?? null;
        const missing = !hasFinancials || value == null;
        const zero = !missing && value === 0;
        return (
          <div
            className={`v2-year-preview-item ${missing ? 'missing' : ''} ${
              zero ? 'zero' : ''
            }`.trim()}
          >
            <span>{t(labelKey, defaultLabel)}</span>
            <strong
              className={`${missing ? 'v2-year-preview-missing' : ''} ${
                zero ? 'v2-year-preview-zero' : ''
              }`.trim()}
            >
              {missing
                ? t(
                    'v2Overview.previewVeetiMissingValue',
                    'VEETI did not provide this value',
                  )
                : formatEur(value)}
            </strong>
          </div>
        );
      };

      return (
        <>
          <div className="v2-year-preview-grid">
            {renderAccountingPreviewItem(
              'revenue',
              'v2Overview.previewAccountingRevenueLabel',
              'Revenue',
            )}
            {renderAccountingPreviewItem(
              'materialsCosts',
              'v2Overview.previewAccountingMaterialsLabel',
              'Materials and services',
            )}
            {renderAccountingPreviewItem(
              'personnelCosts',
              'v2Overview.previewAccountingPersonnelLabel',
              'Personnel costs',
            )}
            {renderAccountingPreviewItem(
              'depreciation',
              'v2Overview.previewAccountingDepreciationLabel',
              'Depreciation',
            )}
            {renderAccountingPreviewItem(
              'otherOperatingCosts',
              'v2Overview.previewAccountingOtherOpexLabel',
              'Other operating costs',
            )}
            {renderAccountingPreviewItem(
              'result',
              'v2Overview.previewAccountingResultLabel',
              'Result',
            )}
          </div>
          <div className="v2-year-preview-secondary">
            <span className="v2-year-preview-secondary-label">
              {t(
                'v2Overview.previewSecondaryLabel',
                'Secondary checks before import',
              )}
            </span>
            <div className="v2-year-preview-secondary-grid">
              <div
                className={`v2-year-preview-item secondary ${hasPrices ? '' : 'missing'} ${
                  hasPrices &&
                  prices.waterUnitPrice === 0 &&
                  prices.wastewaterUnitPrice === 0
                    ? 'zero'
                    : ''
                }`.trim()}
              >
                <span>{t('v2Overview.previewPricesLabel', 'Yksikköhinnat')}</span>
                <strong
                  className={`${hasPrices ? '' : 'v2-year-preview-missing'} ${
                    hasPrices &&
                    prices.waterUnitPrice === 0 &&
                    prices.wastewaterUnitPrice === 0
                      ? 'v2-year-preview-zero'
                      : ''
                  }`.trim()}
                >
                  {hasPrices
                    ? `${formatPrice(prices.waterUnitPrice)} / ${formatPrice(
                        prices.wastewaterUnitPrice,
                      )}`
                    : t(
                        'v2Overview.previewVeetiMissingValue',
                        'VEETI did not provide this value',
                      )}
                </strong>
              </div>
              <div
                className={`v2-year-preview-item secondary ${hasVolumes ? '' : 'missing'} ${
                  hasVolumes &&
                  volumes.soldWaterVolume === 0 &&
                  volumes.soldWastewaterVolume === 0
                    ? 'zero'
                    : ''
                }`.trim()}
              >
                <span>{t('v2Overview.previewVolumesLabel', 'Myydyt määrät')}</span>
                <strong
                  className={`${hasVolumes ? '' : 'v2-year-preview-missing'} ${
                    hasVolumes &&
                    volumes.soldWaterVolume === 0 &&
                    volumes.soldWastewaterVolume === 0
                      ? 'v2-year-preview-zero'
                      : ''
                  }`.trim()}
                >
                  {hasVolumes
                    ? `${formatNumber(volumes.soldWaterVolume)} / ${formatNumber(
                        volumes.soldWastewaterVolume,
                      )} m3`
                    : t(
                        'v2Overview.previewVeetiMissingValue',
                        'VEETI did not provide this value',
                      )}
                </strong>
              </div>
            </div>
          </div>
          <div className="v2-year-source-list">
            {sourceLayers.map((layer) => (
              <span key={`${year}-${layer.key}`} className="v2-year-source-pill">
                {sourceLayerText(layer)}
              </span>
            ))}
          </div>
          {discrepancyNote ? (
            <p
              className={
                trustSignal.level === 'material'
                  ? 'v2-year-readiness-missing'
                  : 'v2-muted'
              }
            >
              {discrepancyNote}
            </p>
          ) : null}
        </>
      );
    },
    [t, yearDataCache],
  );

  const renderReviewValueSummary = React.useCallback(
    (
      year: number,
      availability: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
    ) => {
      const yearData = yearDataCache[year];
      const accountingSummary = buildImportYearSummaryRows(yearData);
      const summaryMap = new Map(accountingSummary.map((row) => [row.key, row]));
      const prices = buildPriceForm(yearData);
      const volumes = buildVolumeForm(yearData);
      const revenue = summaryMap.get('revenue')?.effectiveValue ?? null;
      const materials = summaryMap.get('materialsCosts')?.effectiveValue ?? null;
      const result = summaryMap.get('result')?.effectiveValue ?? null;

      const financialSummary =
        availability.financials && revenue != null && result != null
          ? `${t('v2Overview.previewAccountingRevenueLabel')}: ${formatEur(
              revenue,
            )} | ${t('v2Overview.previewAccountingMaterialsLabel')}: ${
              materials == null ? t('v2Overview.checkMissing', 'Missing') : formatEur(materials)
            } | ${t('v2Overview.previewAccountingResultLabel')}: ${formatEur(
              result,
            )}`
          : t('v2Overview.checkMissing', 'Missing');
      const priceSummary = availability.prices
        ? `${formatPrice(prices.waterUnitPrice)} / ${formatPrice(
            prices.wastewaterUnitPrice,
          )}`
        : t('v2Overview.checkMissing', 'Missing');
      const volumeSummary = availability.volumes
        ? `${formatNumber(volumes.soldWaterVolume)} / ${formatNumber(
            volumes.soldWastewaterVolume,
          )} m3`
        : t('v2Overview.checkMissing', 'Missing');

      return (
        <div className="v2-year-status-summary-grid">
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewFinancialSummaryLabel', 'Bokslut')}</span>
            <strong>{financialSummary}</strong>
          </div>
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewPriceSummaryLabel', 'Prices')}</span>
            <strong>{priceSummary}</strong>
          </div>
          <div className="v2-year-preview-item secondary">
            <span>{t('v2Overview.reviewVolumeSummaryLabel', 'Volumes')}</span>
            <strong>{volumeSummary}</strong>
          </div>
        </div>
      );
    },
    [t, yearDataCache],
  );

  const handleDeleteYear = React.useCallback(
    async (year: number) => {
      const confirmed = window.confirm(
        t(
          'v2Overview.excludeYearConfirm',
          'Rajataanko vuosi {{year}} pois suunnitelmasta? Vuosi säilyy työtilassa ja sen voi palauttaa myöhemmin.',
          { year },
        ),
      );
      if (!confirmed) return;

      setRemovingYear(year);
      setError(null);
      setInfo(null);
      try {
        await excludeImportYearsV2([year]);
        setInfo(
          t(
            'v2Overview.excludeYearDoneSingle',
            'Vuosi {{year}} on nyt pois suunnitelmasta.',
            { year },
          ),
        );
        await loadOverview();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.excludeYearFailedSingle',
                'Vuoden rajaaminen pois suunnitelmasta epäonnistui.',
              ),
        );
      } finally {
        setRemovingYear(null);
      }
    },
    [loadOverview, t],
  );

  const handleApplyVeetiReconcile = React.useCallback(
    async (year: number, dataTypes: string[]) => {
      setError(null);
      setInfo(null);
      try {
        await reconcileImportYearV2(year, {
          action: 'apply_veeti',
          dataTypes,
        });
        setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[year];
          return next;
        });
        await loadOverview();
        setInfo(
          t(
            'v2Overview.reconcileApplied',
            'VEETI values restored for year {{year}}.',
            { year },
          ),
        );
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.reconcileFailed',
                'Failed to apply VEETI values for the selected year.',
              ),
        );
        return false;
      }
    },
    [loadOverview, t],
  );

  const handleKeepCurrentYearValues = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    const approvedYear = manualPatchYear;
    const nextRows = reviewStatusRows.map((row) => ({
      year: row.year,
      setupStatus:
        row.year === approvedYear && row.setupStatus === 'ready_for_review'
          ? ('reviewed' as const)
          : row.setupStatus,
      missingRequirements: row.missingRequirements,
    }));
    const nextReviewedYears = markPersistedReviewedImportYears(
      reviewStorageOrgId,
      [approvedYear],
      [...confirmedImportedYears, approvedYear],
    );
    const nextStep = resolveApprovedYearStep(nextRows, approvedYear);
    const nextQueueYear = resolveNextReviewQueueYear(nextRows);
    const nextQueueRow =
      nextQueueYear == null
        ? null
        : nextRows.find((row) => row.year === nextQueueYear) ?? null;

    setReviewedImportedYears(nextReviewedYears);
    if (nextQueueRow) {
      if (cardEditContext === 'step3') {
        await openInlineCardEditor(
          nextQueueRow.year,
          null,
          'step3',
          nextQueueRow.missingRequirements,
        );
      } else {
        resetManualPatchDialog();
        await openManualPatchDialog(
          nextQueueRow.year,
          nextQueueRow.missingRequirements,
          'review',
        );
      }
      setInfo(
        t(
          'v2Overview.keepCurrentYearValuesInfo',
          'No changes were applied for this year.',
        ),
      );
      return;
    }
    if (cardEditContext === 'step3') {
      closeInlineCardEditor();
    } else {
      resetManualPatchDialog();
    }
    setReviewContinueStep(nextStep === 5 ? (baselineReady ? 6 : 5) : null);
    setInfo(
      t(
        'v2Overview.keepCurrentYearValuesInfo',
        'No changes were applied for this year.',
      ),
    );
  }, [
    confirmedImportedYears,
    cardEditContext,
    closeInlineCardEditor,
    manualPatchYear,
    planningContext?.baselineYears?.length,
    planningContext?.canCreateScenario,
    openInlineCardEditor,
    openManualPatchDialog,
    resetManualPatchDialog,
    reviewStatusRows,
    reviewStorageOrgId,
    t,
  ]);

  const handleSwitchToStatementImportMode = React.useCallback(() => {
    setManualPatchMode('statementImport');
    setManualPatchError(null);
    setStatementImportError(null);
    setWorkbookImportError(null);
    setQdisImportError(null);
    statementFileInputRef.current?.click();
  }, []);

  const handleSwitchToWorkbookImportMode = React.useCallback(() => {
    setManualPatchMode('workbookImport');
    setManualPatchError(null);
    setWorkbookImportError(null);
    workbookFileInputRef.current?.click();
  }, []);

  const handleSwitchToQdisImportMode = React.useCallback(() => {
    setManualPatchMode('qdisImport');
    setManualPatchError(null);
    setQdisImportError(null);
    qdisFileInputRef.current?.click();
  }, []);

  const handleExcludeManualYearFromPlan = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    setManualPatchBusy(true);
    setManualPatchError(null);
    setError(null);
    setInfo(null);
    try {
      await excludeImportYearsV2([manualPatchYear]);
      setInfo(
        t(
          'v2Overview.excludeYearDone',
          'Vuosi {{year}} on nyt pois suunnitelmasta.',
          { year: manualPatchYear },
        ),
      );
      resetManualPatchDialog();
      await loadOverview();
    } catch (err) {
      setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.excludeYearFailed',
              'Vuoden rajaaminen pois suunnitelmasta epäonnistui.',
            ),
      );
    } finally {
      setManualPatchBusy(false);
    }
  }, [loadOverview, manualPatchYear, resetManualPatchDialog, t]);

  const handleRestoreManualYearToPlan = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    setManualPatchBusy(true);
    setManualPatchError(null);
    setError(null);
    setInfo(null);
    try {
      await restoreImportYearsV2([manualPatchYear]);
      setInfo(
        t(
          'v2Overview.restoreYearDone',
          'Vuosi {{year}} on palautettu takaisin suunnitelmaan.',
          { year: manualPatchYear },
        ),
      );
      resetManualPatchDialog();
      await loadOverview();
    } catch (err) {
      setManualPatchError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.restoreYearFailed',
              'Vuoden palauttaminen suunnitelmaan epäonnistui.',
            ),
      );
    } finally {
      setManualPatchBusy(false);
    }
  }, [loadOverview, manualPatchYear, resetManualPatchDialog, t]);

  const handleModalApplyVeetiFinancials = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    const applied = await handleApplyVeetiReconcile(manualPatchYear, [
      'tilinpaatos',
    ]);
    if (!applied) return;
    setManualPatchYear(null);
    setManualPatchMissing([]);
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
  }, [handleApplyVeetiReconcile, manualPatchYear]);
  const handleModalApplyVeetiPrices = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    await handleApplyVeetiReconcile(manualPatchYear, ['taksa']);
  }, [handleApplyVeetiReconcile, manualPatchYear]);
  const handleModalApplyVeetiVolumes = React.useCallback(async () => {
    if (manualPatchYear == null) return;
    await handleApplyVeetiReconcile(manualPatchYear, [
      'volume_vesi',
      'volume_jatevesi',
    ]);
  }, [handleApplyVeetiReconcile, manualPatchYear]);

  const setupStatusLabel = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return t('v2Overview.setupStatusReviewed', 'Reviewed');
      }
      if (status === 'ready_for_review') {
        return t('v2Overview.setupStatusTechnicalReady', 'Ready for review');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded');
      }
      return t('v2Overview.setupStatusNeedsAttention');
    },
    [t],
  );
  const setupStatusClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') return 'v2-status-positive';
      if (status === 'ready_for_review') return 'v2-status-info';
      if (status === 'excluded_from_plan') return 'v2-status-provenance';
      return 'v2-status-warning';
    },
    [],
  );
  const yearStatusRowClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      return status;
    },
    [],
  );
  const handleContinueFromReview = React.useCallback(async () => {
    const target = resolveReviewContinueTarget(
      reviewStatusRows.map((row) => ({
        year: row.year,
        setupStatus: row.setupStatus,
      })),
    );
    const hasReviewedCorrectedYear = reviewStatusRows.some(
      (row) =>
        row.setupStatus === 'reviewed' &&
        (row.sourceStatus === 'MANUAL' || row.sourceStatus === 'MIXED'),
    );
    const correctedReviewedYear =
      target.selectedProblemYear == null &&
      hasReviewedCorrectedYear &&
      reviewedImportedYearRows.length > 0 &&
      importedBlockedYearCount === 0 &&
      pendingTechnicalReviewYearCount === 0 &&
      !baselineReady
        ? reviewedImportedYearRows[0]?.vuosi ?? null
        : null;
    const reviewTargetYear = target.selectedProblemYear ?? correctedReviewedYear;
    if (reviewTargetYear != null) {
      setReviewContinueStep(null);
      const selectedYear = reviewStatusRows.find(
        (row) => row.year === reviewTargetYear,
      );
      if (selectedYear) {
        await openInlineCardEditor(
          selectedYear.year,
          null,
          'step3',
          selectedYear.missingRequirements,
        );
        return;
      }
      handleGuideBlockedYears();
      return;
    }

    setReviewContinueStep(target.nextStep);
    setInfo(
      t('v2Overview.reviewContinueReadyHint'),
    );
  }, [
    baselineReady,
    handleGuideBlockedYears,
    openInlineCardEditor,
    pendingTechnicalReviewYearCount,
    planningContext,
    reportList,
    reviewStatusRows,
    reviewedImportedYearRows,
    scenarioList,
    t,
    importedBlockedYearCount,
  ]);
  const handleCreatePlanningBaseline = React.useCallback(async () => {
    if (includedPlanningYears.length === 0) return;
    setCreatingPlanningBaseline(true);
    setError(null);
    setInfo(null);
    try {
      const result = await createPlanningBaselineV2(includedPlanningYears);
      setLatestPlanningBaselineSummary({
        includedYears: [...result.includedYears].sort((a, b) => b - a),
        excludedYears: [...excludedYearsSorted],
        correctedYears: [...correctedPlanningYears],
      });
      setInfo(
        t('v2Overview.planningBaselineDone', {
          years:
            result.includedYears.length > 0
              ? result.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        }),
      );
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.planningBaselineFailed',
              'Suunnittelupohjan luonti epäonnistui.',
            ),
      );
    } finally {
      setCreatingPlanningBaseline(false);
    }
  }, [correctedPlanningYears, excludedYearsSorted, includedPlanningYears, loadOverview, t]);
  const handleOpenForecastHandoff = React.useCallback(() => {
    onGoToForecast();
  }, [onGoToForecast]);

  const missingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) =>
      buildMissingRequirementLabel(t, requirement),
    [t],
  );
  const sourceLayerText = React.useCallback(
    (
      layer: ReturnType<typeof buildImportYearSourceLayers>[number],
    ): string => buildSourceLayerText(t, layer),
    [t],
  );
  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') =>
      buildPriceComparisonLabel(t, key),
    [t],
  );
  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') =>
      buildVolumeComparisonLabel(t, key),
    [t],
  );

  const isReviewMode = manualPatchMode === 'review';
  const showAllManualSections =
    manualPatchMode === 'manualEdit' && manualPatchMissing.length === 0;
  const isStatementImportMode = manualPatchMode === 'statementImport';
  const isWorkbookImportMode = manualPatchMode === 'workbookImport';
  const isQdisImportMode = manualPatchMode === 'qdisImport';
  const showFinancialSection =
    manualPatchMode !== 'review' &&
    manualPatchMode !== 'qdisImport' &&
    manualPatchMode !== 'workbookImport';
  const showPricesSection =
    manualPatchMode !== 'review' && manualPatchMode !== 'workbookImport';
  const showVolumesSection =
    manualPatchMode !== 'review' && manualPatchMode !== 'workbookImport';
  const financialComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildFinancialComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: financialComparisonLabel(row.key),
      }),
    );
  }, [financialComparisonLabel, manualPatchYear, yearDataCache]);
  const hasFinancialComparisonDiffs = financialComparisonRows.some(
    (row) => row.changed,
  );
  const priceComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildPriceComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: priceComparisonLabel(row.key),
      }),
    );
  }, [manualPatchYear, priceComparisonLabel, yearDataCache]);
  const hasPriceComparisonDiffs = priceComparisonRows.some((row) => row.changed);
  const volumeComparisonRows = React.useMemo(() => {
    if (manualPatchYear == null) return [];
    return buildVolumeComparisonRows(yearDataCache[manualPatchYear]).map(
      (row) => ({
        ...row,
        label: volumeComparisonLabel(row.key),
      }),
    );
  }, [manualPatchYear, volumeComparisonLabel, yearDataCache]);
  const hasVolumeComparisonDiffs = volumeComparisonRows.some((row) => row.changed);
  const currentYearData =
    manualPatchYear != null ? yearDataCache[manualPatchYear] : undefined;
  const statementImportComparisonRows = React.useMemo(() => {
    if (!statementImportPreview) return [];
    return buildStatementOcrComparisonRows({
      fields: statementImportPreview.fields,
      matches: statementImportPreview.matches,
      veetiFinancials: getRawFirstRow(currentYearData, 'tilinpaatos'),
      currentFinancials: getEffectiveFirstRow(currentYearData, 'tilinpaatos'),
    });
  }, [currentYearData, statementImportPreview]);
  const hasStatementImportPreviewValues = statementImportComparisonRows.some(
    (row) => row.pdfValue != null,
  );
  const qdisImportComparisonRows = React.useMemo(() => {
    if (!qdisImportPreview || manualPatchYear == null) return [];
    const rawPriceRows =
      currentYearData?.datasets.find((dataset) => dataset.dataType === 'taksa')
        ?.rawRows ?? [];
    const currentPrices = buildPriceForm(currentYearData);
    const rawWaterPrice = rawPriceRows.find(
      (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
    );
    const rawWastewaterPrice = rawPriceRows.find(
      (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
    );
    const rawWaterVolume = getRawFirstRow(currentYearData, 'volume_vesi');
    const rawWastewaterVolume = getRawFirstRow(currentYearData, 'volume_jatevesi');
    const currentVolumes = buildVolumeForm(currentYearData);
    return [
      {
        key: 'waterUnitPrice',
        label: t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)'),
        veetiValue: parseManualNumber((rawWaterPrice as any)?.Kayttomaksu),
        pdfValue: qdisImportPreview.fields.waterUnitPrice ?? null,
        currentValue: currentPrices.waterUnitPrice,
      },
      {
        key: 'wastewaterUnitPrice',
        label: t(
          'v2Overview.manualPriceWastewater',
          'Wastewater unit price (EUR/m3)',
        ),
        veetiValue: parseManualNumber((rawWastewaterPrice as any)?.Kayttomaksu),
        pdfValue: qdisImportPreview.fields.wastewaterUnitPrice ?? null,
        currentValue: currentPrices.wastewaterUnitPrice,
      },
      {
        key: 'soldWaterVolume',
        label: t('v2Overview.manualVolumeWater', 'Sold water volume (m3)'),
        veetiValue: parseManualNumber((rawWaterVolume as any).Maara),
        pdfValue: qdisImportPreview.fields.soldWaterVolume ?? null,
        currentValue: currentVolumes.soldWaterVolume,
      },
      {
        key: 'soldWastewaterVolume',
        label: t(
          'v2Overview.manualVolumeWastewater',
          'Sold wastewater volume (m3)',
        ),
        veetiValue: parseManualNumber((rawWastewaterVolume as any).Maara),
        pdfValue: qdisImportPreview.fields.soldWastewaterVolume ?? null,
        currentValue: currentVolumes.soldWastewaterVolume,
      },
    ].map((row) => ({
      ...row,
      changedFromCurrent:
        row.pdfValue != null && numbersDiffer(row.pdfValue, row.currentValue),
    }));
  }, [currentYearData, manualPatchYear, qdisImportPreview, t]);
  const hasQdisPreviewValues = qdisImportComparisonRows.some(
    (row) => row.pdfValue != null,
  );
  const workbookImportComparisonYears = React.useMemo(() => {
    if (!workbookImportPreview) return [];
    return workbookImportPreview.years.map((year) => {
      const summaryRows = buildImportYearSummaryRows(yearDataCache[year.year]);
      return {
        ...year,
        rows: year.rows.map((row) => ({
          ...row,
          label: financialComparisonLabel(row.key),
          veetiValue:
            summaryRows.find(
              (summaryRow) => summaryRow.sourceField === row.sourceField,
            )?.rawValue ?? null,
          selection:
            workbookImportSelections[year.year]?.[row.sourceField] ??
            row.suggestedAction,
        })),
      };
    });
  }, [
    financialComparisonLabel,
    workbookImportPreview,
    workbookImportSelections,
    yearDataCache,
  ]);
  const hasWorkbookImportPreviewValues = workbookImportComparisonYears.some(
    (year) => year.rows.some((row) => row.workbookValue != null),
  );
  const hasWorkbookApplySelections = workbookImportComparisonYears.some((year) =>
    year.rows.some(
      (row) => row.selection === 'apply_workbook' && row.workbookValue != null,
    ),
  );
  const canConfirmStatementImport =
    !isStatementImportMode ||
    (statementImportPreview != null && hasStatementImportPreviewValues);
  const canConfirmQdisImport =
    !isQdisImportMode || (qdisImportPreview != null && hasQdisPreviewValues);
  const canConfirmImportWorkflow =
    canConfirmStatementImport && canConfirmQdisImport;
  const canReapplyPricesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['taksa'],
    isAdmin,
  );
  const canReapplyVolumesForYear = canReapplyDatasetVeeti(
    currentYearData,
    ['volume_vesi', 'volume_jatevesi'],
    isAdmin,
  );
  const wizardBackLabel =
    wizardBackStep === 1
      ? t('v2Overview.wizardBackStep1', 'Back to connection')
      : wizardBackStep === 2
      ? t('v2Overview.wizardBackStep2', 'Back to year selection')
      : wizardBackStep === 3
      ? t('v2Overview.wizardBackStep3', 'Back to review')
      : wizardBackStep === 5
      ? t('v2Overview.wizardBackStep5', 'Back to baseline')
      : null;
  const handleWizardBack = React.useCallback(() => {
    if (wizardBackStep == null) return;
    closeInlineCardEditor();
    setInfo(null);
    setReviewContinueStep(wizardBackStep);
  }, [closeInlineCardEditor, wizardBackStep]);

  React.useEffect(() => {
    for (const year of previewPrefetchYears) {
      void loadYearPreviewData(year);
    }
  }, [loadYearPreviewData, previewPrefetchYears]);

  React.useEffect(() => {
    if (!displaySetupWizardState) return;
    onSetupWizardStateChange?.(displaySetupWizardState);
  }, [displaySetupWizardState, onSetupWizardStateChange]);

  React.useEffect(() => {
    if (!setupBackSignal) return;
    if (setupBackSignal === handledSetupBackSignalRef.current) return;
    handledSetupBackSignalRef.current = setupBackSignal;
    handleWizardBack();
  }, [handleWizardBack, setupBackSignal]);

  React.useEffect(() => {
    onSetupOrgNameChange?.(overview?.importStatus.link?.nimi ?? null);
  }, [onSetupOrgNameChange, overview?.importStatus.link?.nimi]);

  if (loading)
    return (
      <div className="v2-loading">
        {t('v2Overview.loading', 'Loading overview...')}
      </div>
    );
  if (!overview)
    return (
      <div className="v2-error">
        {t('v2Overview.loadFailed', 'Overview data is not available.')}
      </div>
    );

  const { importStatus } = overview;

  const hasBaselineBudget = baselineReady;

  const includedPlanningYearsLabel =
    includedPlanningYears.length > 0
      ? includedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const importedYearsLabel =
    confirmedImportedYears.length > 0
      ? confirmedImportedYears.join(', ')
      : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const readyYearsLabel =
    reviewedImportedYearRows.length > 0
      ? reviewedImportedYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const technicalReadyYearsLabel =
    technicallyReadyImportedYearRows.length > 0
      ? technicallyReadyImportedYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const excludedYearsLabel =
    excludedYearsSorted.length > 0
      ? excludedYearsSorted.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const correctedYearsLabel =
    correctedPlanningYears.length > 0
      ? correctedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const selectedConnectedOrg = overview?.importStatus.link ?? null;
  const selectedOrgName =
    selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';
  const importStep = Math.min(setupWizardState?.activeStep ?? 1, 3) as 1 | 2 | 3;
  const baselineReadyForSummary = setupWizardState?.wizardComplete === true;
  const planningBaselineSummaryDetail = baselineReadyForSummary
    ? latestPlanningBaselineSummary
      ? t('v2Overview.wizardBaselineReadyDetail', {
          included:
            latestPlanningBaselineSummary.includedYears.length > 0
              ? latestPlanningBaselineSummary.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          excluded:
            latestPlanningBaselineSummary.excludedYears.length > 0
              ? latestPlanningBaselineSummary.excludedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          corrected:
            latestPlanningBaselineSummary.correctedYears.length > 0
              ? latestPlanningBaselineSummary.correctedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        })
      : t('v2Overview.wizardBaselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const wizardSummaryItems = [
    {
      label: t('v2Overview.wizardSummaryCompany'),
      value: importStatus.link?.nimi ?? selectedOrgName,
      detail: importStatus.link?.ytunnus ?? selectedOrgBusinessId,
    },
    {
      label: t('v2Overview.wizardSummaryImportedYears'),
      value: String(importYearRows.length),
      detail: importedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
      value: String(reviewedImportedYearRows.length),
      detail: readyYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryExcludedYears'),
      value: String(excludedYearsSorted.length),
      detail: excludedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryBaselineReady'),
      value: baselineReadyForSummary
        ? t('v2Overview.wizardSummaryYes')
        : t('v2Overview.wizardSummaryNo'),
      detail: planningBaselineSummaryDetail,
    },
  ] as const;
  const wizardStepContent: Record<
    number,
    { title: string; body: string; badge: string }
  > = {
    1: {
      title: t('v2Overview.wizardQuestionConnect'),
      body: t('v2Overview.wizardBodyConnect'),
      badge: t('v2Overview.disconnected', 'Not connected'),
    },
    2: {
      title: t('v2Overview.wizardQuestionImportYears'),
      body: t('v2Overview.wizardBodyImportYears'),
      badge: t('v2Overview.importTitle', 'Import VEETI'),
    },
    3: {
      title: t('v2Overview.wizardQuestionReviewYears'),
      body: t('v2Overview.wizardBodyReviewYears'),
      badge: t('v2Overview.needsReviewBadge'),
    },
    4: {
      title: t('v2Overview.wizardQuestionFixYear'),
      body: t('v2Overview.wizardBodyFixYear'),
      badge: t('v2Overview.needsReviewBadge'),
    },
    5: {
      title: t('v2Overview.wizardQuestionBaseline'),
      body: t('v2Overview.wizardBodyBaseline'),
      badge: t('v2Overview.createPlanningBaseline'),
    },
    6: {
      title: t('v2Overview.wizardQuestionForecast'),
      body: t('v2Overview.wizardBodyForecast'),
      badge: t('v2Overview.openForecast'),
    },
  };
  const wizardHero = wizardStepContent[wizardDisplayStep];
  const isStep2SupportChrome = wizardDisplayStep === 2;
  const summaryMetaBlocks = isStep2SupportChrome
    ? [
        {
          label: t('v2Overview.organizationLabel', 'Organization'),
          value: importStatus.link?.nimi ?? '-',
        },
        {
          label: t('v2Overview.businessIdLabel', 'Business ID'),
          value: importStatus.link?.ytunnus ?? '-',
        },
        {
          label: t('v2Overview.lastFetchLabel', 'Last fetch'),
          value: formatDateTime(importStatus.link?.lastFetchedAt),
        },
        {
          label: t('v2Overview.wizardContextImportedWorkspaceYears'),
          value: importedYearsLabel,
        },
      ]
    : [
        {
          label: t('v2Overview.organizationLabel', 'Organization'),
          value: importStatus.link?.nimi ?? '-',
        },
        {
          label: t('v2Overview.businessIdLabel', 'Business ID'),
          value: importStatus.link?.ytunnus ?? '-',
        },
        {
          label: t('v2Overview.lastFetchLabel', 'Last fetch'),
          value: formatDateTime(importStatus.link?.lastFetchedAt),
        },
        {
          label: t('v2Overview.wizardCurrentFocus'),
          value: wizardHero.badge,
        },
      ];
  const wizardContextHelpers: WizardContextHelper[] = (() => {
    const priorLabel = t('v2Overview.wizardContextEarlier');
    const nextLabel = t('v2Overview.wizardContextNext');

    if (wizardDisplayStep === 1) {
      return [
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep2'),
          body: t('v2Overview.wizardContextConnectNextBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 2) {
      return [
        {
          key: 'prior',
          label: t('v2Overview.wizardContextNow'),
          title: t('v2Overview.wizardContextImportedWorkspaceYears'),
          body: t('v2Overview.wizardContextImportedWorkspaceYearsBody', {
            years: importedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep3'),
          body: t('v2Overview.wizardContextImportNextBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 3) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextImportedWorkspaceYears'),
          body: t('v2Overview.wizardContextImportedWorkspaceYearsBody', {
            years: importedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title:
            pendingReviewYearCount > 0
              ? t('v2Overview.wizardContextStep4')
              : t('v2Overview.wizardContextStep5'),
          body:
            pendingReviewYearCount === 1
              ? t('v2Overview.wizardContextReviewNextOneBody')
              : pendingReviewYearCount > 1
                ? t('v2Overview.wizardContextReviewNextManyBody', {
                    count: pendingReviewYearCount,
                  })
                : t('v2Overview.wizardContextReviewNextReadyBody'),
          tone: pendingReviewYearCount > 0 ? 'warning' : 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 4) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextReviewQueue'),
          body: t('v2Overview.wizardContextReviewQueueBody', {
            year: manualPatchYear ?? '-',
          }),
          tone: 'warning',
        },
        {
          key: 'next',
          label: nextLabel,
          title:
            pendingReviewYearCount > 1
              ? t('v2Overview.wizardContextBackToReview')
              : t('v2Overview.wizardContextStep5'),
          body:
            pendingReviewYearCount > 1
              ? t('v2Overview.wizardContextFixNextReviewBody')
              : t('v2Overview.wizardContextFixNextBaselineBody'),
          tone: 'neutral',
        },
      ];
    }

    if (wizardDisplayStep === 5) {
      return [
        {
          key: 'prior',
          label: priorLabel,
          title: t('v2Overview.wizardContextReviewSummary'),
          body: t('v2Overview.wizardContextReviewSummaryBody', {
            ready: includedPlanningYearsLabel,
            excluded: excludedYearsLabel,
          }),
          tone: 'positive',
        },
        {
          key: 'next',
          label: nextLabel,
          title: t('v2Overview.wizardContextStep6'),
          body: t('v2Overview.wizardContextBaselineNextBody'),
          tone: 'neutral',
        },
      ];
    }

    return wizardDisplayStep === 6
      ? []
      : [
          {
            key: 'prior',
            label: priorLabel,
            title: t('v2Overview.wizardContextBaselineSummary'),
            body: planningBaselineSummaryDetail,
            tone: 'positive',
          },
        ];
  })();
  const connectButtonClass =
    wizardDisplayStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    wizardDisplayStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    wizardDisplayStep === 3 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const planningBaselineButtonClass =
    wizardDisplayStep === 5 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    wizardDisplayStep === 6 ? 'v2-btn v2-btn-primary' : 'v2-btn';

  const statementImportImpact = (() => {
    if (manualPatchYear == null) {
      return {
        currentFinancialSource: null as string | null,
        keepVeeti: [] as string[],
        keepManual: [] as string[],
        keepEmpty: [] as string[],
      };
    }

    const yearData = yearDataCache[manualPatchYear];
    const datasets = yearData?.datasets ?? [];
    return {
      currentFinancialSource:
        datasets.find((dataset) => dataset.dataType === 'tilinpaatos')?.source ??
        null,
      keepVeeti: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'veeti',
        )
        .map((dataset) => dataset.dataType),
      keepManual: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'manual',
        )
        .map((dataset) => dataset.dataType),
      keepEmpty: datasets
        .filter(
          (dataset) =>
            dataset.dataType !== 'tilinpaatos' && dataset.source === 'none',
        )
        .map((dataset) => dataset.dataType),
    };
  })();
  const setWorkbookSelection = (
    year: number,
    sourceField: V2WorkbookPreviewResponse['years'][number]['rows'][number]['sourceField'],
    action: 'keep_veeti' | 'apply_workbook',
  ) => {
    setWorkbookImportSelections((prev) => ({
      ...prev,
      [year]: {
        ...(prev[year] ?? {}),
        [sourceField]: action,
      },
    }));
  };
  const renderWorkbookImportWorkflow = (yearLabel: number | string) => (
    <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
      <div className="v2-manual-section-head">
        <h4>
          {t(
            'v2Overview.workbookImportWorkflowTitle',
            'Import KVA workbook for year {{year}}',
            { year: yearLabel },
          )}
        </h4>
      </div>
      <p className="v2-muted">
        {t(
          'v2Overview.workbookImportWorkflowBody',
          'Upload one KVA workbook, review the matched years, and choose row by row whether to keep VEETI or apply workbook values before saving.',
        )}
      </p>
      <div className="v2-statement-import-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => workbookFileInputRef.current?.click()}
          disabled={workbookImportBusy || manualPatchBusy}
        >
          {t(
            workbookImportPreview
              ? 'v2Overview.workbookImportReplaceFile'
              : 'v2Overview.workbookImportUploadFile',
            workbookImportPreview
              ? 'Choose another workbook'
              : 'Upload KVA workbook',
          )}
        </button>
        {workbookImportPreview ? (
          <span className="v2-muted">
            {workbookImportPreview.document.fileName}
          </span>
        ) : null}
      </div>
      {workbookImportStatus ? <p className="v2-muted">{workbookImportStatus}</p> : null}
      {workbookImportError ? (
        <div className="v2-alert v2-alert-error">{workbookImportError}</div>
      ) : null}
      {workbookImportPreview && hasWorkbookImportPreviewValues ? (
        <section className="v2-manual-section v2-statement-import-diff-panel">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.workbookImportDiffTitle',
                'VEETI and workbook values by year',
              )}
            </h4>
          </div>
          {workbookImportComparisonYears.map((year) => (
            <div key={year.year} className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>{year.year}</h4>
                <span className="v2-badge v2-status-provenance">
                  {sourceStatusLabel(year.sourceStatus)}
                </span>
              </div>
              <div className="v2-statement-import-diff-table">
                <div className="v2-statement-import-diff-head">
                  <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                  <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                  <span>
                    {t('v2Overview.workbookImportDiffWorkbook', 'Workbook')}
                  </span>
                  <span>{t('v2Overview.workbookImportChoice', 'Choice')}</span>
                </div>
                {year.rows.map((row) => (
                  <div
                    key={`${year.year}-${row.sourceField}`}
                    data-testid={`workbook-compare-${year.year}-${row.sourceField}`}
                    className={`v2-statement-import-diff-row ${
                      row.differs ? 'v2-statement-import-diff-row-changed' : ''
                    }`}
                  >
                    <span>
                      <strong>{row.label}</strong>
                    </span>
                    <span>
                      {row.veetiValue == null
                        ? t('v2Overview.previewMissingValue', 'Missing data')
                        : formatEur(row.veetiValue)}
                    </span>
                    <span>
                      {row.workbookValue == null
                        ? t(
                            'v2Overview.workbookImportMissingValue',
                            'Not found in workbook',
                          )
                        : formatEur(row.workbookValue)}
                    </span>
                    <span className="v2-actions-row">
                      <button
                        type="button"
                        className={`v2-btn v2-btn-small ${
                          row.selection === 'keep_veeti' ? 'v2-btn-primary' : ''
                        }`}
                        aria-pressed={row.selection === 'keep_veeti'}
                        onClick={() =>
                          setWorkbookSelection(year.year, row.sourceField, 'keep_veeti')
                        }
                      >
                        {t(
                          'v2Overview.workbookChoiceKeepVeeti',
                          'Keep VEETI',
                        )}
                      </button>
                      <button
                        type="button"
                        className={`v2-btn v2-btn-small ${
                          row.selection === 'apply_workbook' ? 'v2-btn-primary' : ''
                        }`}
                        aria-pressed={row.selection === 'apply_workbook'}
                        onClick={() =>
                          setWorkbookSelection(
                            year.year,
                            row.sourceField,
                            'apply_workbook',
                          )
                        }
                      >
                        {t(
                          'v2Overview.workbookChoiceApply',
                          'Apply workbook',
                        )}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <p className="v2-muted v2-statement-import-placeholder">
          {t(
            'v2Overview.workbookImportAwaitingFile',
            'Upload the KVA workbook to populate the year-by-year comparison before saving any workbook choices.',
          )}
        </p>
      )}
      <div className="v2-inline-card-editor-actions">
        <button
          type="button"
          className="v2-btn"
          onClick={() => void submitWorkbookImport(false)}
          disabled={
            manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections
          }
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t(
                'v2Overview.workbookImportConfirm',
                'Apply workbook choices',
              )}
        </button>
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          onClick={() => void submitWorkbookImport(true)}
          disabled={
            manualPatchBusy || workbookImportBusy || !hasWorkbookApplySelections
          }
        >
          {manualPatchBusy
            ? t('common.loading', 'Loading...')
            : t(
                'v2Overview.workbookImportConfirmAndSync',
                'Apply workbook choices and sync years',
              )}
        </button>
      </div>
    </section>
  );
  const renderQdisImportWorkflow = (yearLabel: number | string) => (
    <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
      <div className="v2-manual-section-head">
        <h4>
          {t(
            'v2Overview.qdisImportWorkflowTitle',
            'Import QDIS PDF for year {{year}}',
            { year: yearLabel },
          )}
        </h4>
      </div>
      <p className="v2-muted">
        {t(
          'v2Overview.qdisImportWorkflowBody',
          'Upload the QDIS PDF, review the detected prices and sold volumes, and confirm them into the year patch flow.',
        )}
      </p>
      <div className="v2-statement-import-actions">
        <button
          type="button"
          className="v2-btn v2-btn-small"
          onClick={() => qdisFileInputRef.current?.click()}
          disabled={qdisImportBusy || manualPatchBusy}
        >
          {t(
            qdisImportPreview
              ? 'v2Overview.qdisImportReplaceFile'
              : 'v2Overview.qdisImportUploadFile',
            qdisImportPreview ? 'Choose another QDIS PDF' : 'Upload QDIS PDF',
          )}
        </button>
        {qdisImportPreview ? (
          <span className="v2-muted">{qdisImportPreview.fileName}</span>
        ) : null}
      </div>
      {qdisImportStatus ? <p className="v2-muted">{qdisImportStatus}</p> : null}
      {qdisImportError ? (
        <div className="v2-alert v2-alert-error">{qdisImportError}</div>
      ) : null}
      {qdisImportPreview ? (
        <section className="v2-manual-section v2-statement-import-diff-panel">
          <div className="v2-manual-section-head">
            <h4>
              {t(
                'v2Overview.qdisImportDiffTitle',
                'VEETI, QDIS PDF, and current values',
              )}
            </h4>
          </div>
          {qdisImportComparisonRows.length > 0 ? (
            <div className="v2-statement-import-diff-table">
              <div className="v2-statement-import-diff-head">
                <span>{t('v2Overview.statementImportDiffField', 'Field')}</span>
                <span>{t('v2Overview.statementImportDiffVeeti', 'VEETI')}</span>
                <span>
                  {t('v2Overview.qdisImportDiffPdf', 'QDIS PDF')}
                </span>
                <span>
                  {t('v2Overview.statementImportDiffCurrent', 'Current')}
                </span>
              </div>
              {qdisImportComparisonRows.map((row) => (
                <div
                  key={row.key}
                  className={`v2-statement-import-diff-row ${
                    row.changedFromCurrent
                      ? 'v2-statement-import-diff-row-changed'
                      : ''
                  }`}
                >
                  <span>
                    <strong>{row.label}</strong>
                  </span>
                  <span>
                    {row.veetiValue == null
                      ? t('v2Overview.previewMissingValue', 'Missing data')
                      : row.key.includes('Price')
                      ? formatPrice(row.veetiValue)
                      : `${formatNumber(row.veetiValue)} m3`}
                  </span>
                  <span>
                    {row.pdfValue == null
                      ? t('v2Overview.previewMissingValue', 'Missing data')
                      : row.key.includes('Price')
                      ? formatPrice(row.pdfValue)
                      : `${formatNumber(row.pdfValue)} m3`}
                  </span>
                  <span>
                    {row.key.includes('Price')
                      ? formatPrice(row.currentValue)
                      : `${formatNumber(row.currentValue)} m3`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="v2-muted">
              {t(
                'v2Overview.qdisImportNoMappedValues',
                'QDIS PDF import did not detect prices or sold volumes yet. Upload another PDF before confirming the import.',
              )}
            </p>
          )}
          {qdisImportPreview.warnings.length > 0 ? (
            <div className="v2-statement-import-warnings">
              {qdisImportPreview.warnings.map((warning) => (
                <p key={warning} className="v2-muted">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="v2-muted v2-statement-import-placeholder">
          {t(
            'v2Overview.qdisImportAwaitingFile',
            'Upload the QDIS PDF to populate the price and volume comparison before confirming the import.',
          )}
        </p>
      )}
    </section>
  );
  const currentFinancialDataset =
    manualPatchYear != null
      ? yearDataCache[manualPatchYear]?.datasets.find(
          (dataset) => dataset.dataType === 'tilinpaatos',
        ) ?? null
      : null;
  const financialSourceFieldLabel = (sourceField: string) =>
    getFinancialSourceFieldLabel(t, sourceField);
  const currentFinancialFieldSources = (() => {
    const fieldSources = currentFinancialDataset?.overrideMeta?.provenance?.fieldSources;
    if (!fieldSources || fieldSources.length === 0) {
      return [];
    }
    return fieldSources.map((fieldSource) => ({
      sourceField: fieldSource.sourceField,
      label: financialSourceFieldLabel(fieldSource.sourceField),
      owner: datasetSourceLabel('manual', fieldSource.provenance),
    }));
  })();
  const canReapplyFinancialVeetiForYear =
    manualPatchYear != null &&
    canReapplyFinancialVeeti(yearDataCache[manualPatchYear], isAdmin);
  const currentFinancialSourceLabel = currentFinancialDataset
    ? datasetSourceLabel(
        currentFinancialDataset.source,
        currentFinancialDataset.overrideMeta?.provenance,
      )
    : t('v2Overview.sourceIncomplete', 'Incomplete');
  const isManualYearExcluded =
    manualPatchYear != null && excludedYearsSorted.includes(manualPatchYear);
  const currentManualYearStatus =
    manualPatchYear != null
      ? reviewStatusRows.find((row) => row.year === manualPatchYear)?.setupStatus ??
        (isManualYearExcluded ? 'excluded_from_plan' : 'ready_for_review')
      : 'needs_attention';
  const isCurrentYearReadyForReview =
    currentManualYearStatus === 'ready_for_review' ||
    currentManualYearStatus === 'reviewed';
  const manualPatchDialogTitle = isCurrentYearReadyForReview
    ? t('v2Overview.wizardQuestionReviewYear')
    : t('v2Overview.wizardQuestionFixYear');
  const manualPatchDialogBody = isManualYearExcluded
    ? t('v2Overview.manualPatchExcludedBody')
    : isCurrentYearReadyForReview
      ? t('v2Overview.wizardBodyReviewYear')
      : t('v2Overview.wizardBodyFixYear');
  const yearActionsBody = isManualYearExcluded
    ? t(
        'v2Overview.yearActionsExcludedBody',
        'Review the imported values, then restore the year to the plan or keep it excluded.',
      )
    : isCurrentYearReadyForReview
      ? t(
          'v2Overview.yearActionsReviewBody',
          'Approve the year as-is after reviewing the comparison, or open editing only if something needs to change.',
        )
      : t(
          'v2Overview.yearActionsFixBody',
          'Choose whether to correct the year, restore VEETI values, or exclude the year from the planning baseline.',
        );
  const keepYearButtonClass =
    isCurrentYearReadyForReview && manualPatchMode === 'review'
    ? 'v2-btn v2-btn-small v2-btn-primary'
    : 'v2-btn v2-btn-small';
  const fixYearButtonClass =
    currentManualYearStatus === 'needs_attention' &&
    manualPatchMode === 'review'
      ? 'v2-btn v2-btn-small v2-btn-primary'
      : 'v2-btn v2-btn-small';
  const connectSurface =
    wizardDisplayStep === 1 ? (
      <OverviewConnectStep
        t={t}
        query={query}
        onQueryChange={(value) => {
          setQuery(value);
          setSelectedOrg(null);
        }}
        onSearch={() => void handleSearch()}
        searching={searching}
        connecting={connecting}
        importingYears={importingYears}
        syncing={syncing}
        searchResults={searchResults}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        renderHighlightedSearchMatch={renderHighlightedSearchMatch}
        selectedOrgStillVisible={selectedOrgStillVisible}
        selectedOrgName={selectedOrgName}
        selectedOrgBusinessId={selectedOrgBusinessId}
        connectButtonClass={connectButtonClass}
        connectDisabled={
          !preferredSearchOrg ||
          searching ||
          connecting ||
          importingYears ||
          syncing
        }
        onConnect={() => void handleConnect(preferredSearchOrg)}
      />
    ) : null;
  const importYearsSurface =
    wizardDisplayStep === 2 ? (
      <OverviewImportBoard
        t={t}
        wizardBackLabel={wizardBackLabel}
        onBack={handleWizardBack}
        selectedYears={selectedYears}
        syncing={syncing}
        readyRows={readyTrustBoardRows}
        suspiciousRows={suspiciousTrustBoardRows}
        blockedRows={blockedTrustBoardRows}
        parkedRows={parkedTrustBoardRows}
        yearDataCache={yearDataCache}
        cardEditYear={cardEditYear}
        cardEditContext={cardEditContext}
        cardEditFocusField={cardEditFocusField}
        isAdmin={isAdmin}
        renderStep2InlineFieldEditor={renderStep2InlineFieldEditor}
        buildRepairActions={buildRepairActions}
        sourceStatusLabel={sourceStatusLabel}
        sourceStatusClassName={sourceStatusClassName}
        sourceLayerText={sourceLayerText}
        renderDatasetCounts={renderDatasetCounts}
        missingRequirementLabel={missingRequirementLabel}
        attemptOpenInlineCardEditor={attemptOpenInlineCardEditor}
        openInlineCardEditor={openInlineCardEditor}
        openManualPatchDialog={openManualPatchDialog}
        loadingYearData={loadingYearData}
        manualPatchError={manualPatchError}
        blockedYearCount={blockedYearCount}
        onToggleYear={(year) => toggleYear(year, null)}
        onImportYears={handleImportYears}
        importYearsButtonClass={importYearsButtonClass}
        importingYears={importingYears}
      />
    ) : null;
  const shouldLeadWithActionSurface =
    wizardDisplayStep === 1 ||
    wizardDisplayStep === 2 ||
    wizardDisplayStep === 3;
  const compactSupportingChrome = shouldLeadWithActionSurface;
  const supportingChromeEyebrow = compactSupportingChrome
    ? t('v2Overview.wizardSummaryTitle')
    : t('v2Overview.wizardLabel');
  const supportingChromeTitle = compactSupportingChrome
    ? t('v2Overview.wizardSummarySubtitle')
    : wizardHero.title;

  const heroGrid = (
    <OverviewSupportRail
      t={t}
      wizardDisplayStep={wizardDisplayStep}
      isStep2SupportChrome={isStep2SupportChrome}
      compactSupportingChrome={compactSupportingChrome}
      supportingChromeEyebrow={supportingChromeEyebrow}
      supportingChromeTitle={supportingChromeTitle}
      wizardHero={wizardHero}
      summaryMetaBlocks={summaryMetaBlocks}
      wizardSummaryItems={wizardSummaryItems}
      wizardContextHelpers={wizardContextHelpers}
    />
  );

  const activeSurface = (
    <div className="v2-overview-active-surface">
        {connectSurface}

        {importYearsSurface}

      {(globalThis as { __vp_unused_legacy_import_panel__?: boolean })
        .__vp_unused_legacy_import_panel__ ? (
      <section>
        <article className="v2-card">
          <div className="v2-section-header">
            <h2>{t('v2Overview.importTitle', 'Import VEETI')}</h2>
            <strong className="v2-import-progress">
              {t('v2Overview.importStepProgress', 'Step {{step}} / 3', {
                step: importStep,
              })}
            </strong>
          </div>
          <p className="v2-muted">
            {t(
              'v2Overview.wizardBodyImportYears',
              'Choose the years you want in this workspace. After import you will immediately see which years are included.',
            )}
          </p>

          <ol className="v2-import-stepper" aria-label="VEETI import steps">
            <li className={!importStatus.connected ? 'current' : 'done'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepOneHelp',
                  'Search by name or business ID and connect the imported organization.',
                )}
              </span>
            </li>
            <li
              className={
                !importStatus.connected
                  ? 'pending'
                  : importStep === 2
                  ? 'current'
                  : 'done'
              }
            >
              <strong>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardStepTwoHelp',
                  'Select the years you want to bring into this workspace.',
                )}
              </span>
            </li>
            <li className={importStep === 3 ? 'current' : 'pending'}>
              <strong>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.wizardBodyReviewYears',
                  'Tarkista jokainen vuosi yhdestä paikasta. Tässä vaiheessa tarkoitus on ymmärtää vuosien tila ennen korjauksia tai rajauksia.',
                )}
              </span>
            </li>
          </ol>

          <section
            className={`v2-import-panel ${
              importStatus.connected ? 'done' : 'current'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionConnect',
                  'Minkä vesilaitoksen tiedoilla työskentelet?',
                )}
              </h3>
              <span
                className={`v2-chip ${
                  importStatus.connected
                    ? 'v2-status-positive'
                    : 'v2-status-warning'
                }`}
              >
                {importStatus.connected
                  ? t('v2Overview.connected', 'Connected')
                  : t('v2Overview.disconnected', 'Not connected')}
              </span>
            </div>

            <div className="v2-import-org-summary">
              <div>
                <strong>
                  {t('v2Overview.organizationLabel', 'Organization')}:{' '}
                  {selectedOrgName}
                </strong>
                <span>
                  {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                  {selectedOrgBusinessId}
                </span>
                {selectedOrg?.Kunta ? (
                  <span>
                    {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                    {selectedOrg?.Kunta}
                  </span>
                ) : null}
              </div>
              {selectedOrgStillVisible ? (
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={() => setSelectedOrg(null)}
                  disabled={connecting || importingYears || syncing}
                >
                  {t('v2Overview.clearSelectionButton', 'Clear selection')}
                </button>
              ) : null}
            </div>

            <div className="v2-inline-form">
              <input
                id="v2-overview-org-search"
                name="orgSearch"
                className="v2-input"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedOrg(null);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }
                  event.preventDefault();
                  if (preferredSearchOrg) {
                    void handleConnect(preferredSearchOrg);
                    return;
                  }
                  void handleSearch();
                }}
                disabled={connecting || importingYears || syncing}
                placeholder={t(
                  'v2Overview.searchPlaceholder',
                  'Search by name or business ID',
                )}
              />
              <button
                className="v2-btn"
                type="button"
                onClick={handleSearch}
                disabled={
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing ||
                  query.trim().length < 2
                }
              >
                {searching
                  ? t('v2Overview.searchingButton', 'Searching...')
                  : t('v2Overview.searchButton', 'Search')}
              </button>
            </div>

            {searchResults.length > 0 ? (
              <div className="v2-result-list">
                {searchResults.map((org) => {
                  const isActive = selectedOrg?.Id === org.Id;
                  const orgName =
                    org.Nimi ??
                    t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                      id: org.Id,
                    });
                  return (
                    <button
                      type="button"
                      key={org.Id}
                      className={`v2-result-row ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedOrg(org);
                        void handleConnect(org);
                      }}
                      disabled={connecting || importingYears || syncing}
                    >
                      <div className="v2-result-main">
                        <strong>{renderHighlightedSearchMatch(orgName)}</strong>
                        <span>
                          {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                          {renderHighlightedSearchMatch(org.YTunnus ?? '-')}
                        </span>
                      </div>
                      <div className="v2-result-meta">
                        <span>
                          {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                          {renderHighlightedSearchMatch(org.Kunta ?? '-')}
                        </span>
                        {isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.resultSelected', 'Selected')}
                          </span>
                        ) : null}
                        {!isActive ? (
                          <span className="v2-result-selected">
                            {t('v2Overview.connectButton', 'Yhdistä organisaatio')}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="v2-actions-row">
              <button
                type="button"
                className={connectButtonClass}
                onClick={() => void handleConnect(preferredSearchOrg)}
                disabled={
                  !preferredSearchOrg ||
                  searching ||
                  connecting ||
                  importingYears ||
                  syncing
                }
              >
                {connecting
                  ? t('v2Overview.connectingButton', 'Connecting...')
                  : importStatus.connected
                  ? t(
                      'v2Overview.connectSelectedButton',
                      'Yhdistä organisaatio',
                    )
                  : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
              </button>
            </div>
          </section>

          <section
            id="v2-import-years"
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 2
                ? 'current'
                : 'done'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionImportYears',
                  'Mitkä vuodet haluat tuoda sisään?',
                )}
              </h3>
              <span className="v2-chip">
                {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
                {selectedYears.length}
              </span>
            </div>

            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.yearSelectionLocked',
                  'Connect an organization first to review and select years.',
                )}
              </p>
            ) : (
              <>
                {recommendedYears.length > 0 ? (
                  <p className="v2-muted">
                    {t('v2Overview.availableYearsHint', 'Available years: {{years}}', {
                      years: recommendedYears.join(', '),
                    })}
                  </p>
                ) : null}

                {importYearRows.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.noImportedYears',
                      'No imported years available yet.',
                    )}
                  </p>
                ) : (
                  <div className="v2-year-readiness-table">
                    {importYearRows.map((row) => {
                      const isBlocked = row.syncBlockedReason != null;
                      return (
                        <div
                          key={row.vuosi}
                          className={`v2-year-readiness-row ${
                            isBlocked ? 'blocked' : 'ready'
                          }`}
                        >
                          <div className="v2-year-readiness-head">
                            <label
                              className={`v2-year-checkbox ${
                                isBlocked ? 'v2-year-select-disabled' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                name={`syncYear-${row.vuosi}`}
                                checked={selectedYears.includes(row.vuosi)}
                                onChange={() =>
                                  toggleYear(row.vuosi, row.syncBlockedReason)
                                }
                                disabled={syncing || isBlocked}
                              />
                              <strong>{row.vuosi}</strong>
                            </label>
                            <span
                              className={`v2-chip ${isBlocked ? 'warn' : 'ok'}`}
                            >
                              {isBlocked
                                ? t(
                                    'v2Overview.yearNeedsCompletion',
                                    'Needs completion',
                                  )
                                : row.setupStatus === 'reviewed'
                                  ? t('v2Overview.yearReviewed', 'Tarkistettu')
                                  : t('v2Overview.yearReadyForReview', 'Tarkista')}
                            </span>
                            <span
                              className={`v2-badge ${sourceStatusClassName(
                                row.sourceStatus,
                              )}`}
                            >
                              {sourceStatusLabel(row.sourceStatus)}
                            </span>
                          </div>

                          {isBlocked ? (
                            <p className="v2-year-readiness-missing">
                              {t(
                                'v2Overview.yearMissingLabel',
                                'Missing requirements: {{requirements}}',
                                {
                                  requirements: row.missingRequirements
                                    .map((item) =>
                                      missingRequirementLabel(item),
                                    )
                                    .join(', '),
                                },
                              )}
                            </p>
                          ) : null}

                          {row.warnings && row.warnings.length > 0 ? (
                            <p className="v2-muted">
                              {row.warnings
                                .map((warning) => importWarningLabel(warning))
                                .join(' ')}
                            </p>
                          ) : null}

                          {renderYearValuePreview(row.vuosi, {
                            financials:
                              row.readinessChecks.find(
                                (check) => check.key === 'financials',
                              )?.ready === true,
                            prices:
                              row.readinessChecks.find(
                                (check) => check.key === 'prices',
                              )?.ready === true,
                            volumes:
                              row.readinessChecks.find(
                                (check) => check.key === 'volumes',
                              )?.ready === true,
                          })}

                          <p className="v2-muted">
                            {t(
                              'v2Overview.datasetCountsSecondaryLabel',
                              'Imported rows in background data',
                            )}
                            :{' '}
                            {renderDatasetCounts(
                              row.datasetCounts as
                                | Record<string, number>
                                | undefined,
                            )}
                          </p>

                          {isAdmin
                            ? buildRepairActions(
                                row.vuosi,
                                row.missingRequirements,
                              ).map((action) => (
                                <button
                                  key={`${row.vuosi}-${action.key}`}
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={() =>
                                    void openInlineCardEditor(
                                      row.vuosi,
                                      action.focusField,
                                      'step3',
                                      row.missingRequirements,
                                      'manualEdit',
                                    )
                                  }
                                >
                                  {action.label}
                                </button>
                              ))
                            : null}
                          {isBlocked && isAdmin ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.manualPatchButton',
                                'Complete manually',
                              )}
                            </button>
                          ) : null}
                          {!isBlocked ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                void openInlineCardEditor(
                                  row.vuosi,
                                  null,
                                  'step3',
                                  row.missingRequirements,
                                )
                              }
                            >
                              {t(
                                'v2Overview.openReviewYearButton',
                                'Avaa ja tarkista',
                              )}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {blockedYearCount > 0 && !isAdmin ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.manualPatchAdminOnlyHint',
                      'Manual completion is available for admins only.',
                    )}
                  </p>
                ) : null}
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className={importYearsButtonClass}
                    onClick={handleImportYears}
                    disabled={
                      !importStatus.connected ||
                      importingYears ||
                      syncing ||
                      selectedYears.length === 0
                    }
                  >
                    {importingYears
                      ? t('v2Overview.importingYearsButton', 'Tuodaan vuosia...')
                      : t('v2Overview.importYearsButton', 'Tuo valitut vuodet')}
                  </button>
                </div>
              </>
            )}
          </section>

          <section
            className={`v2-import-panel ${
              !importStatus.connected
                ? 'disabled'
                : importStep === 3
                ? 'current'
                : 'pending'
            }`}
          >
            <div className="v2-import-panel-head">
              <h3>
                {t(
                  'v2Overview.wizardQuestionReviewYears',
                  'Mitkä vuodet ovat käyttövalmiita?',
                )}
              </h3>
            </div>
            {!importStatus.connected ? (
              <p className="v2-muted">
                {t(
                  'v2Overview.importReviewLocked',
                  'Connect an organization before starting import.',
                )}
              </p>
            ) : (
              <>
                {selectedYears.length === 0 ? (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.importedYearsPending',
                      'Valitse ainakin yksi vuosi vaiheessa 2, jotta näet mitä työtilassa on mukana.',
                    )}
                  </p>
                ) : (
                  <p className="v2-muted">
                    {t(
                      'v2Overview.wizardContextImportedWorkspaceYearsBody',
                      'Imported workspace years: {{years}}. Review them in the same setup flow before building the planning baseline.',
                      {
                        years:
                          confirmedImportedYears.length > 0
                            ? confirmedImportedYears.join(', ')
                            : t('v2Overview.noYearsSelected', 'None selected'),
                      },
                    )}
                  </p>
                )}
              </>
            )}
          </section>
        </article>
      </section>
      ) : null}

      <input
        ref={statementFileInputRef}
        type="file"
        data-import-kind="statement"
        accept="application/pdf"
        onChange={handleStatementPdfSelected}
        disabled={statementImportBusy || manualPatchBusy}
        hidden
      />
      <input
        ref={workbookFileInputRef}
        type="file"
        data-import-kind="workbook"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleWorkbookSelected}
        disabled={workbookImportBusy || manualPatchBusy}
        hidden
      />
      <input
        ref={qdisFileInputRef}
        type="file"
        data-import-kind="qdis"
        accept="application/pdf"
        onChange={handleQdisPdfSelected}
        disabled={qdisImportBusy || manualPatchBusy}
        hidden
      />

      {wizardDisplayStep === 4 &&
      manualPatchYear != null &&
      cardEditContext !== 'step3' ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
            {wizardBackLabel ? (
              <button
                type="button"
                className="v2-step-back-btn"
                onClick={handleWizardBack}
              >
                {wizardBackLabel}
              </button>
            ) : null}
            <h3>{manualPatchDialogTitle}</h3>
            <p className="v2-muted">{manualPatchDialogBody}</p>
            <span className="v2-chip v2-status-provenance">
              {manualPatchYear}
            </span>
            {manualPatchError ? (
              <div className="v2-alert v2-alert-error">{manualPatchError}</div>
            ) : null}
            {loadingYearData === manualPatchYear ? (
              <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
            ) : null}

            {manualPatchMissing.length > 0 ? (
              <p className="v2-manual-required-note">
                {t(
                  'v2Overview.manualPatchRequiredHint',
                  'Required for sync readiness: {{requirements}}',
                  {
                    requirements: manualPatchMissing
                      .map((item) => missingRequirementLabel(item))
                      .join(', '),
                  },
                )}
              </p>
            ) : null}

            <section className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>
                  {t(
                    'v2Overview.yearDetailTitle',
                    'Year review surface',
                  )}
                </h4>
                <span className="v2-required-pill v2-required-pill-optional">
                  {currentFinancialSourceLabel}
                </span>
              </div>
              <p className="v2-muted">
                {isManualYearExcluded
                  ? t(
                      'v2Overview.yearDetailExcludedBody',
                      'This year is excluded from the planning baseline, but you can still review the imported values and restore it when needed.',
                    )
                  : t(
                      'v2Overview.yearDetailBody',
                      'Review the imported year calmly before deciding what to edit, restore from VEETI, or keep as-is.',
                    )}
              </p>
              {isReviewMode && !isStatementImportMode ? (
                <p className="v2-manual-review-note">
                  {t(
                    'v2Overview.reviewModeHint',
                    'Edit fields stay hidden until you choose "Fix values". Start by reviewing the comparison and deciding what to do with the year.',
                  )}
                </p>
              ) : null}
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Overview.yearDetailStatus', 'Current status')}</span>
                    <span>{setupStatusLabel(currentManualYearStatus)}</span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Overview.yearDetailSource', 'Current source')}</span>
                  <span>{currentFinancialSourceLabel}</span>
                </div>
                {currentFinancialFieldSources.length > 0 ? (
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.yearDetailFinancialOwnership',
                        'Financial field ownership',
                      )}
                    </span>
                    <span>
                      {currentFinancialFieldSources
                        .map((field) => `${field.label}: ${field.owner}`)
                        .join(' | ')}
                    </span>
                  </div>
                ) : null}
              </div>
            </section>

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-impact-panel">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportEffectTitle',
                      'What this import changes',
                    )}
                  </h4>
                </div>
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectChanged',
                        'Will update',
                      )}
                    </span>
                    <span>
                      {t(
                        'v2Overview.datasetFinancials',
                        'Financial statement',
                      )}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectCurrentFinancialSource',
                        'Current financial source',
                      )}
                    </span>
                    <span>
                      {statementImportImpact.currentFinancialSource === 'manual'
                        ? t('v2Overview.sourceManual', 'Manual')
                        : statementImportImpact.currentFinancialSource ===
                          'veeti'
                        ? t('v2Overview.sourceVeeti', 'VEETI')
                        : t('v2Overview.sourceIncomplete', 'Incomplete')}
                    </span>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>
                      {t(
                        'v2Overview.statementImportEffectKeepsVeeti',
                        'Keeps from VEETI',
                      )}
                    </span>
                    <span>
                      {renderDatasetTypeList(statementImportImpact.keepVeeti)}
                    </span>
                  </div>
                  {statementImportImpact.keepManual.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectKeepsManual',
                          'Keeps manual',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepManual)}
                      </span>
                    </div>
                  ) : null}
                  {statementImportImpact.keepEmpty.length > 0 ? (
                    <div className="v2-keyvalue-row">
                      <span>
                        {t(
                          'v2Overview.statementImportEffectStillMissing',
                          'Still missing',
                        )}
                      </span>
                      <span>
                        {renderDatasetTypeList(statementImportImpact.keepEmpty)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
            {isWorkbookImportMode
              ? renderWorkbookImportWorkflow(manualPatchYear ?? '-')
              : null}
            {isQdisImportMode ? renderQdisImportWorkflow(manualPatchYear ?? '-') : null}

            {financialComparisonRows.length > 0 ||
            priceComparisonRows.length > 0 ||
            volumeComparisonRows.length > 0 ? (
              <details className="v2-manual-optional">
                <summary>
                  {t(
                    'v2Overview.yearSecondaryTools',
                    'Additional tools and restore actions',
                  )}
                </summary>
            {financialComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.financialComparisonTitle',
                      'VEETI vs effective financial values',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasFinancialComparisonDiffs
                        ? ''
                        : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasFinancialComparisonDiffs
                      ? t(
                          'v2Overview.financialComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.financialComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.financialComparisonBody',
                    'Review how the current effective year differs from the original VEETI financial row before saving changes.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {financialComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatEur(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatEur(row.effectiveValue)}
                        {row.changed
                          ? ` | ${t(
                              'v2Overview.financialComparisonDelta',
                              'Delta',
                            )}: ${formatEur(row.effectiveValue - row.veetiValue)}`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyFinancialVeetiForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiFinancials}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiFinancials',
                      'Restore VEETI financials',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {priceComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.priceComparisonTitle',
                      'VEETI vs current unit prices',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasPriceComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasPriceComparisonDiffs
                      ? t(
                          'v2Overview.priceComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.priceComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.priceComparisonBody',
                    'Review raw VEETI prices against the current effective prices before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {priceComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatPrice(row.veetiValue)} |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatPrice(row.effectiveValue)}
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyPricesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiPrices}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiPrices',
                      'Restore VEETI prices',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}

            {volumeComparisonRows.length > 0 ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.volumeComparisonTitle',
                      'VEETI vs current sold volumes',
                    )}
                  </h4>
                  <span
                    className={`v2-required-pill ${
                      hasVolumeComparisonDiffs ? '' : 'v2-required-pill-optional'
                    }`}
                  >
                    {hasVolumeComparisonDiffs
                      ? t(
                          'v2Overview.volumeComparisonDiffs',
                          'Differences detected',
                        )
                      : t(
                          'v2Overview.volumeComparisonMatches',
                          'Matches VEETI',
                        )}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.volumeComparisonBody',
                    'Review raw VEETI sold volumes against the current effective values before saving or restoring this section.',
                  )}
                </p>
                <div className="v2-keyvalue-list">
                  {volumeComparisonRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <span>
                        {t('v2Overview.financialComparisonVeeti', 'VEETI')}:{' '}
                        {formatNumber(row.veetiValue)} m3 |{' '}
                        {t(
                          'v2Overview.financialComparisonEffective',
                          'Effective',
                        )}
                        : {formatNumber(row.effectiveValue)} m3
                      </span>
                    </div>
                  ))}
                </div>
                {canReapplyVolumesForYear ? (
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={handleModalApplyVeetiVolumes}
                    disabled={manualPatchBusy || statementImportBusy}
                  >
                    {t(
                      'v2Overview.reapplyVeetiVolumes',
                      'Restore VEETI volumes',
                    )}
                  </button>
                ) : null}
              </section>
            ) : null}
              </details>
            ) : null}

            <input
              ref={statementFileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleStatementPdfSelected}
              disabled={statementImportBusy || manualPatchBusy}
              hidden
            />

            {isStatementImportMode ? (
              <section className="v2-manual-section v2-statement-import-panel v2-statement-import-workflow">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.statementImportWorkflowTitle',
                      'Import statement PDF for year {{year}}',
                      { year: manualPatchYear ?? '-' },
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <p className="v2-muted">
                  {t(
                    'v2Overview.statementImportWorkflowBody',
                    'Upload the bookkeeping PDF, review the detected financial statement values, and confirm the import. Other datasets keep their current source.',
                  )}
                </p>
                <div className="v2-statement-import-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => statementFileInputRef.current?.click()}
                    disabled={statementImportBusy || manualPatchBusy}
                  >
                    {t(
                      statementImportPreview
                        ? 'v2Overview.statementImportReplaceFile'
                        : 'v2Overview.statementImportUploadFile',
                      statementImportPreview
                        ? 'Choose another PDF'
                        : 'Upload statement PDF',
                    )}
                  </button>
                  {statementImportPreview ? (
                    <span className="v2-muted">
                      {statementImportPreview.fileName}
                    </span>
                  ) : null}
                </div>
                {statementImportStatus ? (
                  <p className="v2-muted">{statementImportStatus}</p>
                ) : null}
                {statementImportError ? (
                  <div className="v2-alert v2-alert-error">
                    {statementImportError}
                  </div>
                ) : null}
                {statementImportPreview ? (
                  <div className="v2-statement-import-preview">
                    <div className="v2-keyvalue-list v2-statement-import-meta-grid">
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaFile',
                            'Detected file',
                          )}
                        </span>
                        <span>{statementImportPreview.fileName}</span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaPage',
                            'Detected page',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.pageNumber != null
                            ? statementImportPreview.pageNumber
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaConfidence',
                            'OCR confidence',
                          )}
                        </span>
                        <span>
                          {statementImportPreview.confidence != null
                            ? t(
                                'v2Overview.statementImportConfidence',
                                'confidence {{value}}%',
                                {
                                  value: Math.round(
                                    statementImportPreview.confidence,
                                  ),
                                },
                              )
                            : t(
                                'v2Overview.previewMissingValue',
                                'Missing data',
                              )}
                        </span>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t(
                            'v2Overview.statementImportMetaScannedPages',
                            'Scanned pages',
                          )}
                        </span>
                        <span>
                          {t(
                            'v2Overview.statementImportScannedPages',
                            'scanned {{count}} pages',
                            {
                              count: statementImportPreview.scannedPageCount,
                            },
                          )}
                        </span>
                      </div>
                    </div>
                    <section className="v2-manual-section v2-statement-import-diff-panel">
                      <div className="v2-manual-section-head">
                        <h4>
                          {t(
                            'v2Overview.statementImportDiffTitle',
                            'VEETI, PDF, and current values',
                          )}
                        </h4>
                      </div>
                      <p className="v2-muted">
                        {t(
                          'v2Overview.statementImportDiffBody',
                          'Check what the PDF proposes against the original VEETI row and the current effective year before you confirm or sync.',
                        )}
                      </p>
                      {statementImportComparisonRows.length > 0 ? (
                        <div className="v2-statement-import-diff-table">
                          <div className="v2-statement-import-diff-head">
                            <span>
                              {t('v2Overview.statementImportDiffField', 'Field')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffVeeti', 'VEETI')}
                            </span>
                            <span>
                              {t('v2Overview.statementImportDiffPdf', 'PDF')}
                            </span>
                            <span>
                              {t(
                                'v2Overview.statementImportDiffCurrent',
                                'Current',
                              )}
                            </span>
                          </div>
                          {statementImportComparisonRows.map((row) => (
                            <div
                              key={row.key}
                              className={`v2-statement-import-diff-row ${
                                row.changedFromCurrent
                                  ? 'v2-statement-import-diff-row-changed'
                                  : ''
                              }`}
                            >
                              <span>
                                <strong>{row.label}</strong>
                                {row.sourceLine ? (
                                  <small className="v2-muted">
                                    {row.sourceLine}
                                  </small>
                                ) : null}
                              </span>
                              <span>
                                {row.veetiValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.veetiValue)}
                              </span>
                              <span>
                                {row.pdfValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.pdfValue)}
                              </span>
                              <span>
                                {row.currentValue == null
                                  ? t(
                                      'v2Overview.previewMissingValue',
                                      'Missing data',
                                    )
                                  : formatEur(row.currentValue)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="v2-muted">
                          {t(
                            'v2Overview.statementImportNoMappedValues',
                            'OCR did not produce mapped financial values yet. Upload another PDF before confirming the import.',
                          )}
                        </p>
                      )}
                    </section>
                    {statementImportPreview.warnings.length > 0 ? (
                      <div className="v2-statement-import-warnings">
                        {statementImportPreview.warnings.map((warning) => (
                          <p key={warning} className="v2-muted">
                            {warning}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="v2-muted v2-statement-import-placeholder">
                    {t(
                      'v2Overview.statementImportAwaitingFile',
                      'Upload the statement PDF to populate the OCR comparison before confirming the import.',
                    )}
                  </p>
                )}
              </section>
            ) : null}

            {showFinancialSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t(
                      'v2Overview.manualSectionFinancials',
                      'Financial statement data',
                    )}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualFinancialRevenue',
                      'Revenue (Liikevaihto)',
                    )}
                    <input
                      name="manual-financials-liikevaihto"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liikevaihto}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liikevaihto: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialMaterials',
                      'Materials and services',
                    )}
                    <input
                      name="manual-financials-aineetJaPalvelut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.aineetJaPalvelut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          aineetJaPalvelut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialPersonnel',
                      'Personnel costs',
                    )}
                    <input
                      name="manual-financials-henkilostokulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.henkilostokulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          henkilostokulut: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialOtherOpex',
                      'Other operating costs',
                    )}
                    <input
                      name="manual-financials-liiketoiminnanMuutKulut"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.liiketoiminnanMuutKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          liiketoiminnanMuutKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialDepreciation',
                      'Depreciation',
                    )}
                    <input
                      name="manual-financials-poistot"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.poistot}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          poistot: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialWriteDowns', 'Write-downs')}
                    <input
                      name="manual-financials-arvonalentumiset"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={manualFinancials.arvonalentumiset}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          arvonalentumiset: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t('v2Overview.manualFinancialNetFinance', 'Net finance')}
                    <input
                      name="manual-financials-rahoitustuototJaKulut"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.rahoitustuototJaKulut}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          rahoitustuototJaKulut: Number(
                            event.target.value || 0,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualFinancialYearResult',
                      'Year result (Tilikauden ylijäämä/alijäämä)',
                    )}
                    <input
                      name="manual-financials-tilikaudenYliJaama"
                      className="v2-input"
                      type="number"
                      step="0.01"
                      value={manualFinancials.tilikaudenYliJaama}
                      onChange={(event) =>
                        setManualFinancials((prev) => ({
                          ...prev,
                          tilikaudenYliJaama: Number(event.target.value || 0),
                        }))
                      }
                    />
                    <small className="v2-muted">
                      {t(
                        'v2Overview.manualFinancialYearResultHint',
                        'Update this saved Year result field directly when the visible result row should change.',
                      )}
                    </small>
                  </label>
                </div>
              </section>
            ) : null}

            {showPricesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>{t('v2Overview.manualSectionPrices', 'Unit prices')}</h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualPriceWater',
                      'Water unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-waterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.waterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          waterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualPriceWastewater',
                      'Wastewater unit price (EUR/m3)',
                    )}
                    <input
                      name="manual-prices-wastewaterUnitPrice"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="0.001"
                      value={manualPrices.wastewaterUnitPrice}
                      onChange={(event) =>
                        setManualPrices((prev) => ({
                          ...prev,
                          wastewaterUnitPrice: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {showVolumesSection ? (
              <section className="v2-manual-section">
                <div className="v2-manual-section-head">
                  <h4>
                    {t('v2Overview.manualSectionVolumes', 'Sold volumes')}
                  </h4>
                  <span className="v2-required-pill">
                    {t('v2Overview.requiredField', 'Required')}
                  </span>
                </div>
                <div className="v2-manual-grid">
                  <label>
                    {t(
                      'v2Overview.manualVolumeWater',
                      'Sold water volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                  <label>
                    {t(
                      'v2Overview.manualVolumeWastewater',
                      'Sold wastewater volume (m3)',
                    )}
                    <input
                      name="manual-volumes-soldWastewaterVolume"
                      className="v2-input"
                      type="number"
                      min={0}
                      step="1"
                      value={manualVolumes.soldWastewaterVolume}
                      onChange={(event) =>
                        setManualVolumes((prev) => ({
                          ...prev,
                          soldWastewaterVolume: Number(event.target.value || 0),
                        }))
                      }
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {manualPatchMode === 'manualEdit' ? (
            <details
              className="v2-manual-optional"
              open={showAllManualSections}
            >
              <summary>
                {t(
                  'v2Overview.manualOptionalSection',
                  'Optional context fields and note',
                )}
              </summary>
              <div className="v2-manual-grid">
                <label>
                  {t('v2Overview.manualInvestmentAmount', 'Investment amount')}
                  <input
                    name="manual-investments-investoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.investoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        investoinninMaara: Number(event.target.value || 0),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualReplacementInvestmentAmount',
                    'Replacement investment amount',
                  )}
                  <input
                    name="manual-investments-korvausInvestoinninMaara"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualInvestments.korvausInvestoinninMaara}
                    onChange={(event) =>
                      setManualInvestments((prev) => ({
                        ...prev,
                        korvausInvestoinninMaara: Number(
                          event.target.value || 0,
                        ),
                      }))
                    }
                  />
                </label>
                <label>
                  {t(
                    'v2Overview.manualProcessElectricity',
                    'Process electricity',
                  )}
                  <input
                    name="manual-energy-prosessinKayttamaSahko"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualEnergy.prosessinKayttamaSahko}
                    onChange={(event) =>
                      setManualEnergy({
                        prosessinKayttamaSahko: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
                <label>
                  {t('v2Overview.manualNetworkLength', 'Network length')}
                  <input
                    name="manual-network-verkostonPituus"
                    className="v2-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={manualNetwork.verkostonPituus}
                    onChange={(event) =>
                      setManualNetwork({
                        verkostonPituus: Number(event.target.value || 0),
                      })
                    }
                  />
                </label>
              </div>

              <label>
                {t('v2Overview.manualPatchReason', 'Reason for manual change')}
                <textarea
                  name="manual-reason"
                  className="v2-input"
                  rows={3}
                  value={manualReason}
                  onChange={(event) => setManualReason(event.target.value)}
                  placeholder={t(
                    'v2Overview.manualPatchReasonPlaceholder',
                    'Optional note describing why this year is edited manually',
                  )}
                />
              </label>
            </details>
            ) : null}

            <section className="v2-manual-section">
              <div className="v2-manual-section-head">
                <h4>{t('v2Overview.yearActionsTitle', 'Year actions')}</h4>
              </div>
              <p className="v2-muted">
                {yearActionsBody}
              </p>
              <div className="v2-year-card-actions">
                <button
                  type="button"
                  className={keepYearButtonClass}
                  onClick={handleKeepCurrentYearValues}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t('v2Overview.keepYearInPlan')}
                </button>
                <button
                  type="button"
                  className={fixYearButtonClass}
                  onClick={handleSwitchToManualEditMode}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t('v2Overview.fixYearValues')}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToStatementImportMode}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    'v2Overview.statementImportAction',
                    'Import statement PDF',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToWorkbookImportMode}
                  disabled={manualPatchBusy || workbookImportBusy}
                >
                  {t(
                    'v2Overview.workbookImportAction',
                    'Import KVA workbook',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleSwitchToQdisImportMode}
                  disabled={manualPatchBusy || qdisImportBusy}
                >
                  {t(
                    'v2Overview.qdisImportAction',
                    'Import QDIS PDF',
                  )}
                </button>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={
                    isManualYearExcluded
                      ? handleRestoreManualYearToPlan
                      : handleExcludeManualYearFromPlan
                  }
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    isManualYearExcluded
                      ? 'v2Overview.restoreYearToPlan'
                      : 'v2Overview.excludeYearFromPlan',
                    isManualYearExcluded
                      ? 'Palauta suunnitelmaan'
                      : 'Pois suunnitelmasta',
                  )}
                </button>
              </div>
            </section>

            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeManualPatchDialog}
                disabled={manualPatchBusy || statementImportBusy || workbookImportBusy}
              >
                {t(
                  isReviewMode ? 'common.close' : 'common.cancel',
                  isReviewMode ? 'Close' : 'Cancel',
                )}
              </button>
              {isReviewMode || isWorkbookImportMode ? null : (
                <>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirm',
                      'Confirm statement import',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirm',
                      'Confirm QDIS import',
                    )
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
                onClick={() => submitManualPatch(true)}
                disabled={
                  manualPatchBusy ||
                  statementImportBusy ||
                  !canConfirmImportWorkflow
                }
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirmAndSync',
                      'Confirm import and sync year',
                    )
                  : isQdisImportMode
                  ? t(
                      'v2Overview.qdisImportConfirmAndSync',
                      'Confirm QDIS import and sync year',
                    )
                  : t(
                      'v2Overview.manualPatchSaveAndSync',
                      'Save and sync year',
                    )}
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {wizardDisplayStep === 3 ? (
        <OverviewReviewBoard
          t={t}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          reviewStatusRows={reviewStatusRows}
          cardEditContext={cardEditContext}
          cardEditYear={cardEditYear}
          manualPatchYear={manualPatchYear}
          renderReviewValueSummary={renderReviewValueSummary}
          renderYearValuePreview={renderYearValuePreview}
          sourceStatusClassName={sourceStatusClassName}
          sourceStatusLabel={sourceStatusLabel}
          setupStatusClassName={setupStatusClassName}
          setupStatusLabel={setupStatusLabel}
          yearStatusRowClassName={yearStatusRowClassName}
          importWarningLabel={importWarningLabel}
          missingRequirementLabel={missingRequirementLabel}
          isAdmin={isAdmin}
          buildRepairActions={buildRepairActions}
          openInlineCardEditor={openInlineCardEditor}
          manualPatchMode={manualPatchMode}
          manualPatchBusy={manualPatchBusy}
          manualPatchError={manualPatchError}
          isCurrentYearReadyForReview={isCurrentYearReadyForReview}
          isManualYearExcluded={isManualYearExcluded}
          canReapplyFinancialVeetiForYear={canReapplyFinancialVeetiForYear}
          canReapplyPricesForYear={canReapplyPricesForYear}
          canReapplyVolumesForYear={canReapplyVolumesForYear}
          keepYearButtonClass={keepYearButtonClass}
          fixYearButtonClass={fixYearButtonClass}
          handleKeepCurrentYearValues={handleKeepCurrentYearValues}
          handleSwitchToManualEditMode={handleSwitchToManualEditMode}
          handleSwitchToStatementImportMode={handleSwitchToStatementImportMode}
          handleSwitchToWorkbookImportMode={handleSwitchToWorkbookImportMode}
          handleSwitchToQdisImportMode={handleSwitchToQdisImportMode}
          handleRestoreManualYearToPlan={handleRestoreManualYearToPlan}
          handleExcludeManualYearFromPlan={handleExcludeManualYearFromPlan}
          handleModalApplyVeetiFinancials={handleModalApplyVeetiFinancials}
          handleModalApplyVeetiPrices={handleModalApplyVeetiPrices}
          handleModalApplyVeetiVolumes={handleModalApplyVeetiVolumes}
          closeInlineCardEditor={closeInlineCardEditor}
          statementImportBusy={statementImportBusy}
          statementImportStatus={statementImportStatus}
          statementImportPreview={statementImportPreview}
          statementImportComparisonRows={statementImportComparisonRows}
          workbookImportBusy={workbookImportBusy}
          qdisImportBusy={qdisImportBusy}
          canConfirmImportWorkflow={canConfirmImportWorkflow}
          statementFileInputRef={statementFileInputRef}
          setInlineCardFieldRef={setInlineCardFieldRef}
          manualFinancials={manualFinancials}
          setManualFinancials={setManualFinancials}
          manualPrices={manualPrices}
          setManualPrices={setManualPrices}
          manualVolumes={manualVolumes}
          setManualVolumes={setManualVolumes}
          saveInlineCardEdit={saveInlineCardEdit}
          renderWorkbookImportWorkflow={renderWorkbookImportWorkflow}
          renderQdisImportWorkflow={renderQdisImportWorkflow}
          reviewContinueButtonClass={reviewContinueButtonClass}
          onContinueFromReview={handleContinueFromReview}
          importedBlockedYearCount={importedBlockedYearCount}
          pendingReviewYearCount={pendingReviewYearCount}
          technicalReadyYearsLabel={technicalReadyYearsLabel}
        />
      ) : null}

      {wizardDisplayStep === 5 ? (
        <OverviewPlanningBaselineStep
          t={t}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          includedPlanningYears={includedPlanningYears}
          excludedYearsSorted={excludedYearsSorted}
          correctedPlanningYears={correctedPlanningYears}
          correctedPlanningManualDataTypes={correctedPlanningManualDataTypes}
          correctedPlanningVeetiDataTypes={correctedPlanningVeetiDataTypes}
          correctedYearsLabel={correctedYearsLabel}
          includedPlanningYearsLabel={includedPlanningYearsLabel}
          renderDatasetTypeList={renderDatasetTypeList}
          planningBaselineButtonClass={planningBaselineButtonClass}
          onCreatePlanningBaseline={() => void handleCreatePlanningBaseline()}
          creatingPlanningBaseline={creatingPlanningBaseline}
          importedBlockedYearCount={importedBlockedYearCount}
        />
      ) : null}

      {wizardDisplayStep === 6 && hasBaselineBudget ? (
        <OverviewForecastHandoffStep
          t={t}
          wizardBackLabel={wizardBackLabel}
          onBack={handleWizardBack}
          acceptedPlanningYearRows={acceptedPlanningYearRows}
          correctedPlanningYears={correctedPlanningYears}
          sourceStatusClassName={sourceStatusClassName}
          sourceStatusLabel={sourceStatusLabel}
          renderDatasetCounts={renderDatasetCounts}
          openForecastButtonClass={openForecastButtonClass}
          onOpenForecast={handleOpenForecastHandoff}
        />
      ) : null}

      </div>
  );

  const usePersistentSupportRail =
    (overview?.importStatus.connected ?? false) && wizardDisplayStep >= 2;

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
      {usePersistentSupportRail ? (
        <div className="v2-overview-workspace-layout">
          {activeSurface}
          {heroGrid}
        </div>
      ) : (
        <>
          {shouldLeadWithActionSurface ? activeSurface : heroGrid}
          {shouldLeadWithActionSurface ? heroGrid : activeSurface}
        </>
      )}
    </div>
  );
};
