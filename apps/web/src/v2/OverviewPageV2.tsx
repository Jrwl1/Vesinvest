import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  connectImportOrganizationV2,
  excludeImportYearsV2,
  createPlanningBaselineV2,
  getImportYearDataV2,
  importYearsV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
  type V2PlanningContextResponse,
  type V2OverviewResponse,
  type V2ReportListItem,
  type VeetiOrganizationSearchHit,
} from '../api';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import {
  getAvailableImportYears,
  getConfirmedImportedYears,
  getExcludedYears,
  getMissingSyncRequirements,
  getSetupReadinessChecks,
  getSetupYearStatus,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  resolveSetupWizardState,
  type MissingRequirement,
  type SetupWizardState,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  extractStatementFromPdf,
  type StatementOcrMatch,
} from './statementOcr';
import {
  buildFinancialComparisonRows,
  buildImportYearResultToZeroSignal,
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
  syncPersistedReviewedImportYears,
} from './yearReview';

type Props = {
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
};

type ManualPatchMode = 'review' | 'manualEdit' | 'statementImport';

type StatementImportPreview = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  matches: StatementOcrMatch[];
  warnings: string[];
};

type ManualFinancialForm = {
  liikevaihto: number;
  henkilostokulut: number;
  liiketoiminnanMuutKulut: number;
  poistot: number;
  arvonalentumiset: number;
  rahoitustuototJaKulut: number;
  tilikaudenYliJaama: number;
  omistajatuloutus: number;
  omistajanTukiKayttokustannuksiin: number;
};

type ManualPriceForm = {
  waterUnitPrice: number;
  wastewaterUnitPrice: number;
};

type ManualVolumeForm = {
  soldWaterVolume: number;
  soldWastewaterVolume: number;
};

type ManualInvestmentForm = {
  investoinninMaara: number;
  korvausInvestoinninMaara: number;
};

type ManualEnergyForm = {
  prosessinKayttamaSahko: number;
};

type ManualNetworkForm = {
  verkostonPituus: number;
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

const MANUAL_NUMERIC_EPSILON = 0.005;
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

const parseManualNumber = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const numbersDiffer = (left: number, right: number): boolean =>
  Math.abs(left - right) > MANUAL_NUMERIC_EPSILON;

function getEffectiveFirstRow(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Record<string, unknown> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows?.[0] ??
    {}
  );
}

function getEffectiveRows(
  yearData: V2ImportYearDataResponse | undefined,
  dataType: string,
): Array<Record<string, unknown>> {
  return (
    yearData?.datasets.find((row) => row.dataType === dataType)?.effectiveRows ?? []
  );
}

function buildFinancialForm(yearData: V2ImportYearDataResponse | undefined): ManualFinancialForm {
  const financials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  return {
    liikevaihto: parseManualNumber((financials as any).Liikevaihto),
    henkilostokulut: parseManualNumber((financials as any).Henkilostokulut),
    liiketoiminnanMuutKulut: parseManualNumber(
      (financials as any).LiiketoiminnanMuutKulut,
    ),
    poistot: parseManualNumber((financials as any).Poistot),
    arvonalentumiset: parseManualNumber((financials as any).Arvonalentumiset),
    rahoitustuototJaKulut: parseManualNumber(
      (financials as any).RahoitustuototJaKulut,
    ),
    tilikaudenYliJaama: parseManualNumber((financials as any).TilikaudenYliJaama),
    omistajatuloutus: parseManualNumber((financials as any).Omistajatuloutus),
    omistajanTukiKayttokustannuksiin: parseManualNumber(
      (financials as any).OmistajanTukiKayttokustannuksiin,
    ),
  };
}

function buildPriceForm(yearData: V2ImportYearDataResponse | undefined): ManualPriceForm {
  const taksaRows = getEffectiveRows(yearData, 'taksa');
  const waterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 1,
  );
  const wastewaterPriceRow = taksaRows.find(
    (row) => parseManualNumber((row as any).Tyyppi_Id) === 2,
  );
  return {
    waterUnitPrice: parseManualNumber((waterPriceRow as any)?.Kayttomaksu),
    wastewaterUnitPrice: parseManualNumber(
      (wastewaterPriceRow as any)?.Kayttomaksu,
    ),
  };
}

function buildVolumeForm(yearData: V2ImportYearDataResponse | undefined): ManualVolumeForm {
  const waterVolume = getEffectiveFirstRow(yearData, 'volume_vesi');
  const wastewaterVolume = getEffectiveFirstRow(yearData, 'volume_jatevesi');
  return {
    soldWaterVolume: parseManualNumber((waterVolume as any).Maara),
    soldWastewaterVolume: parseManualNumber((wastewaterVolume as any).Maara),
  };
}

function buildInvestmentForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualInvestmentForm {
  const investments = getEffectiveFirstRow(yearData, 'investointi');
  return {
    investoinninMaara: parseManualNumber((investments as any).InvestoinninMaara),
    korvausInvestoinninMaara: parseManualNumber(
      (investments as any).KorvausInvestoinninMaara,
    ),
  };
}

function buildEnergyForm(yearData: V2ImportYearDataResponse | undefined): ManualEnergyForm {
  const energy = getEffectiveFirstRow(yearData, 'energia');
  return {
    prosessinKayttamaSahko: parseManualNumber(
      (energy as any).ProsessinKayttamaSahko,
    ),
  };
}

function buildNetworkForm(
  yearData: V2ImportYearDataResponse | undefined,
): ManualNetworkForm {
  const network = getEffectiveFirstRow(yearData, 'verkko');
  return {
    verkostonPituus: parseManualNumber((network as any).VerkostonPituus),
  };
}

function formsDiffer<T extends Record<string, number>>(left: T, right: T): boolean {
  return Object.keys(left).some((key) =>
    numbersDiffer(left[key as keyof T], right[key as keyof T]),
  );
}

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports: _onGoToReports,
  isAdmin,
  onSetupWizardStateChange,
  onSetupOrgNameChange,
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
  const [reviewContinueStep, setReviewContinueStep] = React.useState<
    4 | 5 | 6 | null
  >(null);
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
  const searchRequestSeq = React.useRef(0);
  const previewFetchYearsRef = React.useRef<Set<number>>(new Set());
  const [manualPatchYear, setManualPatchYear] = React.useState<number | null>(
    null,
  );
  const [manualPatchMode, setManualPatchMode] =
    React.useState<ManualPatchMode>('review');
  const [manualPatchMissing, setManualPatchMissing] = React.useState<
    MissingRequirement[]
  >([]);
  const [manualPatchBusy, setManualPatchBusy] = React.useState(false);
  const [manualPatchError, setManualPatchError] = React.useState<string | null>(
    null,
  );
  const [statementImportBusy, setStatementImportBusy] = React.useState(false);
  const [statementImportStatus, setStatementImportStatus] = React.useState<
    string | null
  >(null);
  const [statementImportError, setStatementImportError] = React.useState<
    string | null
  >(null);
  const [statementImportPreview, setStatementImportPreview] =
    React.useState<StatementImportPreview | null>(null);
  const [manualFinancials, setManualFinancials] = React.useState({
    liikevaihto: 0,
    henkilostokulut: 0,
    liiketoiminnanMuutKulut: 0,
    poistot: 0,
    arvonalentumiset: 0,
    rahoitustuototJaKulut: 0,
    tilikaudenYliJaama: 0,
    omistajatuloutus: 0,
    omistajanTukiKayttokustannuksiin: 0,
  });
  const [manualPrices, setManualPrices] = React.useState({
    waterUnitPrice: 0,
    wastewaterUnitPrice: 0,
  });
  const [manualVolumes, setManualVolumes] = React.useState({
    soldWaterVolume: 0,
    soldWastewaterVolume: 0,
  });
  const [manualInvestments, setManualInvestments] = React.useState({
    investoinninMaara: 0,
    korvausInvestoinninMaara: 0,
  });
  const [manualEnergy, setManualEnergy] = React.useState({
    prosessinKayttamaSahko: 0,
  });
  const [manualNetwork, setManualNetwork] = React.useState({
    verkostonPituus: 0,
  });
  const [manualReason, setManualReason] = React.useState('');
  const [yearDataCache, setYearDataCache] = React.useState<
    Record<number, V2ImportYearDataResponse>
  >({});
  const [loadingYearData, setLoadingYearData] = React.useState<number | null>(
    null,
  );
  const statementFileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, context, scenarios, reports] = await Promise.all([
        getOverviewV2(),
        getPlanningContextV2().catch(() => null),
        listForecastScenariosV2().catch(() => null),
        listReportsV2().catch(() => null),
      ]);
      setOverview(data);
      setPlanningContext(context);
      setScenarioList(scenarios);
      setReportList(reports);
      const availableYears = getAvailableImportYears(data.importStatus);
      const availableYearSet = new Set(
        availableYears.map((row) => row.vuosi),
      );
      const excludedYearSet = new Set(
        getExcludedYears(data.importStatus),
      );

      setSelectedYears((prev) => {
        const filtered = prev
          .filter((year) => availableYearSet.has(year))
          .sort((a, b) => a - b);
        if (syncYearSelectionTouchedRef.current) {
          return filtered;
        }
        const defaults = pickDefaultSyncYears(availableYears);
        return filtered.length > 0 ? filtered : defaults;
      });
      setSelectedYearsForDelete((prev) =>
        prev.filter((year) => availableYearSet.has(year)).sort((a, b) => a - b),
      );
      setSelectedYearsForRestore((prev) =>
        prev.filter((year) => excludedYearSet.has(year)).sort((a, b) => a - b),
      );
      setReviewContinueStep(null);
      setImportedWorkspaceYears(
        [...getConfirmedImportedYears(data.importStatus)]
          .map((year) => Number(year))
          .filter((year) => Number.isFinite(year) && availableYearSet.has(year))
          .sort((a, b) => b - a),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorLoadFailed', 'Failed to load overview.'),
      );
    } finally {
      setLoading(false);
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
        const rows = await searchImportOrganizationsV2(searchValue, 25);
        if (searchRequestSeq.current !== requestSeq) return;

        const exactBusinessIdMatch = isBusinessIdLikeQuery(searchValue)
          ? rows.find(
              (row) =>
                normalizeBusinessIdCandidate(row.YTunnus ?? '') ===
                normalizeBusinessIdCandidate(searchValue),
            ) ?? null
          : null;

        setSearchResults(rows);
        setSelectedOrg((current) => {
          if (exactBusinessIdMatch) {
            return exactBusinessIdMatch;
          }
          if (current) {
            const preserved = rows.find((row) => row.Id === current.Id);
            if (preserved) {
              return preserved;
            }
          }
          return rows.length === 1 ? rows[0] : null;
        });
        sendV2OpsEvent({
          event: 'veeti_search',
          status: 'ok',
          attrs: { queryLength: searchValue.length, resultCount: rows.length },
        });
        if (rows.length === 0) {
          setSelectedOrg(null);
          setInfo(
            t(
              'v2Overview.infoNoSearchResults',
              'No organizations found. Try a business ID or a longer name.',
            ),
          );
        }
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_search',
          status: 'error',
          attrs: { queryLength: searchValue.length },
        });
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

  const handleConnect = React.useCallback(async (org?: VeetiOrganizationSearchHit | null) => {
    const targetOrg = org ?? selectedOrg;
    if (!targetOrg) return;
    setConnecting(true);
    setError(null);
    setInfo(null);
    try {
      await connectImportOrganizationV2(targetOrg.Id);
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'ok',
        attrs: { veetiId: targetOrg.Id },
      });
      const status = await getImportStatusV2();
      const years = pickDefaultSyncYears(
        status.availableYears ?? status.years ?? [],
      );
      syncYearSelectionTouchedRef.current = false;
      setSelectedYears(years);
      setSelectedYearsForDelete([]);
      setSelectedYearsForRestore([]);
      setReviewContinueStep(null);
      const workspaceYears =
        status.workspaceYears == null ? [] : status.workspaceYears;
      setImportedWorkspaceYears(
        [...workspaceYears]
          .map((year) => Number(year))
          .filter((year) => Number.isFinite(year))
          .sort((a, b) => b - a),
      );
      setInfo(
        t(
          'v2Overview.infoConnected',
          'Organization connected. Select years and continue setup.',
        ),
      );
      await loadOverview();
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'error',
        attrs: { veetiId: targetOrg.Id },
      });
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
      const result = await importYearsV2(selectedYears);
      sendV2OpsEvent({
        event: 'veeti_import_years',
        status: 'ok',
        attrs: {
          requestedYearCount: selectedYears.length,
          importedYearCount: result.importedYears.length,
          skippedYearCount: result.skippedYears.length,
        },
      });
      setInfo(
        t('v2Overview.infoImportYearsDone', {
          years:
            result.importedYears.length > 0
              ? result.importedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        }),
      );
      setImportedWorkspaceYears([...result.importedYears].sort((a, b) => b - a));
      await loadOverview();
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_import_years',
        status: 'error',
        attrs: { requestedYearCount: selectedYears.length },
      });
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

  const availableYearRows = React.useMemo(
    () => overview?.importStatus.availableYears ?? overview?.importStatus.years ?? [],
    [overview?.importStatus.availableYears, overview?.importStatus.years],
  );

  const syncYearRows = React.useMemo(
    () =>
      availableYearRows.map((row) => ({
        ...row,
        syncBlockedReason: resolveSyncBlockReason(row),
      })),
    [availableYearRows, resolveSyncBlockReason],
  );
  const selectableImportYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
        })),
    [syncYearRows],
  );
  const importableYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason == null),
    [selectableImportYearRows],
  );
  const repairOnlyYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason != null),
    [selectableImportYearRows],
  );

  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );

  const blockedYearRows = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason),
    [syncYearRows],
  );

  const readyAvailableYearRows = React.useMemo(
    () => syncYearRows.filter((row) => !row.syncBlockedReason),
    [syncYearRows],
  );

  const recommendedYears = React.useMemo(
    () =>
      [...readyAvailableYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((row) => row.vuosi),
    [readyAvailableYearRows],
  );
  const importBoardMissingRequirementLabel = React.useCallback(
    (requirement: MissingRequirement) => {
      if (requirement === 'financials') {
        return t('v2Overview.datasetFinancials', 'Tilinpäätös');
      }
      if (requirement === 'prices') {
        return t('v2Overview.datasetPrices', 'Taksa');
      }
      return t('v2Overview.datasetWaterVolume', 'Volyymit');
    },
    [t],
  );
  const importBoardRows = React.useMemo(() => {
    return selectableImportYearRows.map((row) => {
      const yearData = yearDataCache[row.vuosi];
      const summaryRows = buildImportYearSummaryRows(yearData);
      const summaryMap = new Map(summaryRows.map((item) => [item.key, item]));
      const trustSignal = buildImportYearTrustSignal(yearData);
      const resultToZero = buildImportYearResultToZeroSignal(yearData);
      const missingPrimaryCosts = [
        summaryMap.get('materialsCosts')?.effectiveValue,
        summaryMap.get('personnelCosts')?.effectiveValue,
        summaryMap.get('otherOperatingCosts')?.effectiveValue,
      ].some((value) => value == null);
      const suspiciousMargin =
        resultToZero.marginPct != null && Math.abs(resultToZero.marginPct) >= 10;
      const hasFallbackZero =
        row.warnings?.includes('fallback_zero_used') ||
        trustSignal.reasons.includes('fallback_split');
      const hasLargeDiscrepancy = trustSignal.reasons.includes('statement_import');
      const needsHumanReview =
        row.sourceStatus === 'MIXED' ||
        row.sourceStatus === 'MANUAL' ||
        (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
        (row.manualProvenance != null && !hasLargeDiscrepancy);
      const lane =
        row.syncBlockedReason != null
          ? 'blocked'
          : missingPrimaryCosts ||
            hasFallbackZero ||
            hasLargeDiscrepancy ||
            suspiciousMargin ||
            needsHumanReview
          ? 'suspicious'
          : 'ready';
      const trustLabel =
        lane === 'blocked'
          ? missingPrimaryCosts
            ? t('v2Overview.trustMissingKeyCosts', 'Missing key cost rows')
            : t('v2Overview.yearNeedsCompletion', 'Needs completion')
          : hasLargeDiscrepancy
          ? t(
              'v2Overview.trustLargeDiscrepancy',
              'Large discrepancy vs statement',
            )
          : hasFallbackZero
          ? t('v2Overview.trustFallbackZeros', 'Fallback zeros used')
          : suspiciousMargin
          ? t('v2Overview.trustSuspiciousResult', 'Suspicious result profile')
          : needsHumanReview
          ? t('v2Overview.trustNeedsReview', 'Needs human review')
          : t('v2Overview.trustLooksPlausible', 'Looks plausible');
      const trustToneClass =
        lane === 'ready' ? 'v2-status-positive' : 'v2-status-warning';
      const trustNote =
        row.syncBlockedReason != null
          ? t('v2Overview.yearMissingLabel', 'Missing requirements: {{requirements}}', {
              requirements:
                row.missingRequirements.length > 0
                  ? row.missingRequirements
                      .map((item) => importBoardMissingRequirementLabel(item))
                      .join(', ')
                  : t('v2Overview.setupStatusNeedsAttention'),
            })
          : hasLargeDiscrepancy
          ? t(
              'v2Overview.yearTrustStatementImport',
              'Tilinpäätöskorjaus muutti VEETI-rivejä: {{fields}}.',
              {
                fields: trustSignal.changedSummaryKeys
                  .map((key) => {
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
                      return t(
                        'v2Overview.previewAccountingPersonnelLabel',
                        'Personnel costs',
                      );
                    }
                    if (key === 'otherOperatingCosts') {
                      return t(
                        'v2Overview.previewAccountingOtherOpexLabel',
                        'Other operating costs',
                      );
                    }
                    return t('v2Overview.previewAccountingResultLabel', 'Result');
                  })
                  .join(', '),
              },
            )
          : hasFallbackZero
          ? t(
              'v2Overview.trustFallbackZerosHint',
              'Missing VEETI values still fall back to zero in the imported totals.',
            )
          : missingPrimaryCosts
          ? t(
              'v2Overview.trustMissingKeyCostsHint',
              'Primary cost structure is still incomplete even though the year is technically importable.',
            )
          : suspiciousMargin
          ? t(
              'v2Overview.trustSuspiciousResultHint',
              'Year result sits far from zero compared with revenue and should be reviewed before import.',
            )
          : needsHumanReview
          ? t(
              'v2Overview.trustNeedsReviewHint',
              'Mixed or manually corrected source data needs a human review before it becomes the planning baseline.',
            )
          : t(
              'v2Overview.trustLooksPlausibleHint',
              'Core rows are present and the result stays close enough to zero for a normal review pass.',
            );
      return {
        ...row,
        lane,
        summaryMap,
        trustLabel,
        trustToneClass,
        trustNote,
        resultToZero,
      };
    });
  }, [
    selectableImportYearRows,
    yearDataCache,
    t,
    importBoardMissingRequirementLabel,
  ]);
  const readyTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.lane === 'ready'),
    [importBoardRows],
  );
  const suspiciousTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.lane === 'suspicious'),
    [importBoardRows],
  );
  const blockedTrustBoardRows = React.useMemo(
    () => importBoardRows.filter((row) => row.lane === 'blocked'),
    [importBoardRows],
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

  const confirmedImportedYears = React.useMemo(
    () => [...(importedWorkspaceYears ?? [])].sort((a, b) => b - a),
    [importedWorkspaceYears],
  );
  const reviewStorageOrgId = React.useMemo(
    () =>
      overview?.importStatus.link?.orgId ??
      overview?.importStatus.link?.ytunnus ??
      overview?.importStatus.link?.nimi ??
      null,
    [overview?.importStatus.link],
  );
  const reviewedImportedYearSet = React.useMemo(
    () => new Set(reviewedImportedYears),
    [reviewedImportedYears],
  );

  React.useEffect(() => {
    setReviewedImportedYears(
      syncPersistedReviewedImportYears(reviewStorageOrgId, confirmedImportedYears),
    );
  }, [confirmedImportedYears, reviewStorageOrgId]);

  const importYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .filter((row) => confirmedImportedYears.includes(row.vuosi))
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
          readinessChecks: getSetupReadinessChecks(row),
          setupStatus: getSetupYearStatus(row),
        })),
    [confirmedImportedYears, syncYearRows],
  );
  const excludedYearsSorted = React.useMemo(
    () =>
      [...(overview?.importStatus.excludedYears ?? [])]
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => b - a),
    [overview?.importStatus.excludedYears],
  );
  const reviewedImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus({
            ...row,
            reviewState: reviewedImportedYearSet.has(row.vuosi)
              ? 'reviewed'
              : 'pending_review',
          }, {
            excluded: excludedYearsSorted.includes(row.vuosi),
          }) === 'reviewed',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );
  const technicallyReadyImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus({
            ...row,
            reviewState: reviewedImportedYearSet.has(row.vuosi)
              ? 'reviewed'
              : 'pending_review',
          }, {
            excluded: excludedYearsSorted.includes(row.vuosi),
          }) === 'ready_for_review',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );
  const reviewStatusRows = React.useMemo(() => {
    const rows = importYearRows.map((row) => ({
      year: row.vuosi,
      sourceStatus: row.sourceStatus,
      readinessChecks: row.readinessChecks,
      missingRequirements: row.missingRequirements,
      warnings: (row.warnings ?? []) as ImportWarningCode[],
      setupStatus: getSetupYearStatus({
        ...row,
        reviewState: reviewedImportedYearSet.has(row.vuosi)
          ? 'reviewed'
          : 'pending_review',
      }, {
        excluded: excludedYearsSorted.includes(row.vuosi),
      }),
    }));
    const visibleYears = new Set(rows.map((row) => row.year));

    for (const year of excludedYearsSorted) {
      if (visibleYears.has(year)) continue;
      rows.push({
        year,
        sourceStatus: undefined,
        readinessChecks: [
          { key: 'financials', labelKey: 'v2Overview.datasetFinancials', ready: false },
          { key: 'prices', labelKey: 'v2Overview.datasetPrices', ready: false },
          { key: 'volumes', labelKey: 'v2Overview.datasetWaterVolume', ready: false },
        ],
        missingRequirements: [] as MissingRequirement[],
        warnings: [] as ImportWarningCode[],
        setupStatus: 'excluded_from_plan' as const,
      });
    }

    return rows.sort((a, b) => b.year - a.year);
  }, [excludedYearsSorted, importYearRows, reviewedImportedYearSet]);
  const importedBlockedYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'needs_attention')
        .length,
    [reviewStatusRows],
  );
  const pendingTechnicalReviewYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'ready_for_review')
        .length,
    [reviewStatusRows],
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
      setManualPatchYear(year);
      setManualPatchMode(mode);
      setManualPatchMissing(missing);
      setManualPatchError(null);
      setManualReason('');
      setManualFinancials({
        liikevaihto: 0,
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

      setLoadingYearData(year);
      try {
        const yearData = await getImportYearDataV2(year);
        setYearDataCache((prev) => ({ ...prev, [year]: yearData }));

        setManualFinancials(buildFinancialForm(yearData));
        setManualPrices(buildPriceForm(yearData));
        setManualVolumes(buildVolumeForm(yearData));
        setManualInvestments(buildInvestmentForm(yearData));
        setManualEnergy(buildEnergyForm(yearData));
        setManualNetwork(buildNetworkForm(yearData));

        const latestReason = yearData.datasets
          .map((row) => row.overrideMeta?.reason ?? '')
          .find((reason) => reason.length > 0);
        setManualReason(latestReason ?? '');
      } catch (err) {
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchLoadFailed',
                'Failed to load year data for editing.',
              ),
        );
      } finally {
        setLoadingYearData(null);
      }
    },
    [t],
  );

  const resetManualPatchDialog = React.useCallback(() => {
    setManualPatchYear(null);
    setReviewContinueStep(null);
    setManualPatchMode('review');
    setManualPatchMissing([]);
    setManualPatchError(null);
    setManualReason('');
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
  }, []);

  const closeManualPatchDialog = React.useCallback(() => {
    if (manualPatchBusy || statementImportBusy) return;
    resetManualPatchDialog();
  }, [manualPatchBusy, resetManualPatchDialog, statementImportBusy]);

  const applyOcrFinancialMatch = React.useCallback(
    (match: StatementOcrMatch) => {
      setManualFinancials((prev) => {
        switch (match.key) {
          case 'liikevaihto':
            return { ...prev, liikevaihto: match.value };
          case 'henkilostokulut':
            return { ...prev, henkilostokulut: Math.abs(match.value) };
          case 'liiketoiminnanMuutKulut':
            return {
              ...prev,
              liiketoiminnanMuutKulut: Math.abs(match.value),
            };
          case 'poistot':
            return { ...prev, poistot: Math.abs(match.value) };
          case 'rahoitustuototJaKulut':
            return { ...prev, rahoitustuototJaKulut: match.value };
          case 'tilikaudenYliJaama':
            return { ...prev, tilikaudenYliJaama: match.value };
          default:
            return prev;
        }
      });
    },
    [],
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
        const result = await extractStatementFromPdf(file, (message) => {
          setStatementImportStatus(message);
        });
        for (const match of result.matches) {
          applyOcrFinancialMatch(match);
        }

        if (!manualReason.trim()) {
          setManualReason(
            t(
              'v2Overview.statementImportReasonDefault',
              'Imported from statement PDF: {{fileName}}',
              { fileName: result.fileName },
            ),
          );
        }

        setStatementImportPreview({
          fileName: result.fileName,
          pageNumber: result.pageNumber,
          confidence: result.confidence,
          scannedPageCount: result.scannedPageCount,
          matches: result.matches,
          warnings: result.warnings,
        });
        setStatementImportStatus(
          t(
            'v2Overview.statementImportDone',
            'OCR import finished. Review the prefilled values before saving.',
          ),
        );
        sendV2OpsEvent({
          event: 'statement_pdf_ocr',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            fileName: result.fileName,
            detectedPage: result.pageNumber,
            mappedFieldCount: result.matches.length,
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

  const submitManualPatch = React.useCallback(
    async (syncAfterSave: boolean) => {
      if (manualPatchYear == null) return;

      if (manualFinancials.liikevaihto < 0) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchFinancialsRequired',
            'Revenue (Liikevaihto) cannot be negative.',
          ),
        );
        return;
      }

      const originalYearData = yearDataCache[manualPatchYear];
      const originalFinancials = buildFinancialForm(originalYearData);
      const originalPrices = buildPriceForm(originalYearData);
      const originalVolumes = buildVolumeForm(originalYearData);
      const originalInvestments = buildInvestmentForm(originalYearData);
      const originalEnergy = buildEnergyForm(originalYearData);
      const originalNetwork = buildNetworkForm(originalYearData);

      const payload: V2ManualYearPatchPayload = {
        year: manualPatchYear,
        reason: manualReason.trim() || undefined,
      };

      const shouldPersistStatementImport =
        manualPatchMode === 'statementImport' && statementImportPreview != null;

      if (
        formsDiffer(manualFinancials, originalFinancials) ||
        shouldPersistStatementImport
      ) {
        payload.financials = { ...manualFinancials };
      }
      if (formsDiffer(manualPrices, originalPrices)) {
        payload.prices = { ...manualPrices };
      }
      if (formsDiffer(manualVolumes, originalVolumes)) {
        payload.volumes = { ...manualVolumes };
      }
      if (formsDiffer(manualInvestments, originalInvestments)) {
        payload.investments = { ...manualInvestments };
      }
      if (formsDiffer(manualEnergy, originalEnergy)) {
        payload.energy = { ...manualEnergy };
      }
      if (formsDiffer(manualNetwork, originalNetwork)) {
        payload.network = { ...manualNetwork };
      }
      if (payload.financials && shouldPersistStatementImport) {
        payload.statementImport = {
          fileName: statementImportPreview.fileName,
          pageNumber: statementImportPreview.pageNumber ?? undefined,
          confidence: statementImportPreview.confidence ?? undefined,
          scannedPageCount: statementImportPreview.scannedPageCount,
          matchedFields: statementImportPreview.matches.map((item) => item.key),
          warnings: statementImportPreview.warnings,
        };
      }

      if (
        !payload.financials &&
        !payload.prices &&
        !payload.volumes &&
        !payload.investments &&
        !payload.energy &&
        !payload.network
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchNoChanges',
            'No changes detected. Update at least one field before saving.',
          ),
        );
        return;
      }

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const currentYear = manualPatchYear;
        const baselineAlreadyReady =
          planningContext?.canCreateScenario ??
          (planningContext?.baselineYears?.length ?? 0) > 0;
        const result = await completeImportYearManuallyV2(payload);
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus:
            row.year === currentYear && result.syncReady
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
        setReviewedImportedYears(
          markPersistedReviewedImportYears(
            reviewStorageOrgId,
            [currentYear],
            [...confirmedImportedYears, currentYear],
          ),
        );
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
          setReviewContinueStep(baselineAlreadyReady ? 6 : 5);
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
      loadOverview,
      manualFinancials,
      manualInvestments,
      manualEnergy,
      manualNetwork,
      manualPatchMode,
      manualPatchMissing,
      manualPatchYear,
      manualPrices,
      manualReason,
      manualVolumes,
      statementImportPreview,
      runSync,
      confirmedImportedYears,
      openManualPatchDialog,
      planningContext?.baselineYears?.length,
      planningContext?.canCreateScenario,
      resetManualPatchDialog,
      reviewStatusRows,
      reviewStorageOrgId,
      t,
      yearDataCache,
    ],
  );

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => {
      if (status === 'VEETI') return t('v2Overview.sourceVeeti', 'VEETI');
      if (status === 'MANUAL') return t('v2Overview.sourceManual', 'Manual');
      if (status === 'MIXED') return t('v2Overview.sourceMixed', 'Mixed');
      return t('v2Overview.sourceIncomplete', 'Incomplete');
    },
    [t],
  );
  const sourceStatusClassName = React.useCallback((status: string | undefined) => {
    if (status === 'VEETI') return 'v2-status-info';
    if (status === 'INCOMPLETE') return 'v2-status-warning';
    return 'v2-status-provenance';
  }, []);

  const financialComparisonLabel = React.useCallback(
    (key: string) => {
      if (key === 'liikevaihto') {
        return t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)');
      }
      if (key === 'henkilostokulut') {
        return t('v2Overview.manualFinancialPersonnel', 'Personnel costs');
      }
      if (key === 'liiketoiminnanMuutKulut') {
        return t(
          'v2Overview.manualFinancialOtherOpex',
          'Other operating costs',
        );
      }
      if (key === 'poistot') {
        return t('v2Overview.manualFinancialDepreciation', 'Depreciation');
      }
      if (key === 'arvonalentumiset') {
        return t('v2Overview.manualFinancialWriteDowns', 'Impairments');
      }
      if (key === 'rahoitustuototJaKulut') {
        return t(
          'v2Overview.manualFinancialFinanceNet',
          'Net financing result',
        );
      }
      if (key === 'tilikaudenYliJaama') {
        return t('v2Overview.manualFinancialYearResult', 'Year result');
      }
      if (key === 'omistajatuloutus') {
        return t(
          'v2Overview.manualFinancialOwnerWithdrawal',
          'Owner withdrawal',
        );
      }
      return t(
        'v2Overview.manualFinancialOwnerSupport',
        'Owner support for operating costs',
      );
    },
    [t],
  );

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance:
        | {
            kind: 'manual_edit' | 'statement_import';
            fileName: string | null;
            pageNumber: number | null;
          }
        | null
        | undefined,
    ) => {
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Overview.datasetSourceStatementImport',
          'Statement import ({{fileName}})',
          {
            fileName:
              provenance.fileName ??
              t('v2Overview.statementImportFallbackFile', 'bokslut PDF'),
          },
        );
      }
      if (source === 'manual') {
        return t('v2Overview.sourceManual', 'Manual');
      }
      if (source === 'veeti') {
        return t('v2Overview.sourceVeeti', 'VEETI');
      }
      return t('v2Overview.sourceIncomplete', 'Incomplete');
    },
    [t],
  );

  const datasetTypeLabel = React.useCallback(
    (datasetType: string) => {
      if (datasetType === 'tilinpaatos') {
        return t('v2Overview.datasetFinancials', 'Financial statement');
      }
      if (datasetType === 'taksa') {
        return t('v2Overview.datasetPrices', 'Unit prices');
      }
      if (datasetType === 'volume_vesi') {
        return t('v2Overview.datasetWaterVolume', 'Sold water volume');
      }
      if (datasetType === 'volume_jatevesi') {
        return t(
          'v2Overview.datasetWastewaterVolume',
          'Sold wastewater volume',
        );
      }
      if (datasetType === 'investointi') {
        return t('v2Overview.datasetInvestments', 'Investments');
      }
      if (datasetType === 'energia') {
        return t('v2Overview.datasetEnergy', 'Process electricity');
      }
      if (datasetType === 'verkko') {
        return t('v2Overview.datasetNetwork', 'Network');
      }
      return datasetType;
    },
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => {
      if (!dataTypes || dataTypes.length === 0) return '-';
      return dataTypes.map((item) => datasetTypeLabel(item)).join(', ');
    },
    [datasetTypeLabel],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => {
      if (warning === 'missing_financials') {
        return t(
          'v2Overview.yearWarningMissingFinancials',
          'Financial statement data is missing.',
        );
      }
      if (warning === 'missing_prices') {
        return t(
          'v2Overview.yearWarningMissingPrices',
          'Price data is missing.',
        );
      }
      if (warning === 'missing_volumes') {
        return t(
          'v2Overview.yearWarningMissingVolumes',
          'Sold volume data is missing.',
        );
      }
      return t(
        'v2Overview.yearWarningFallbackZero',
        'Missing VEETI values default to 0 in calculations.',
      );
    },
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => {
      if (!counts) return '-';
      const orderedKeys = [
        'tilinpaatos',
        'taksa',
        'volume_vesi',
        'volume_jatevesi',
        'investointi',
        'energia',
        'verkko',
      ];
      const parts = orderedKeys
        .map((key) => ({ key, count: Number(counts[key] ?? 0) }))
        .filter((item) => item.count > 0)
        .map((item) => `${datasetTypeLabel(item.key)}: ${item.count}`);
      return parts.length > 0 ? parts.join(', ') : '-';
    },
    [datasetTypeLabel],
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
        if (key === 'otherOperatingCosts') {
          return t(
            'v2Overview.previewAccountingOtherOpexLabel',
            'Other operating costs',
          );
        }
        return t('v2Overview.previewAccountingResultLabel', 'Result');
      };
      const changedSummaryFields = trustSignal.changedSummaryKeys
        .map((key) => summaryLabel(key))
        .join(', ');
      const discrepancyNote =
        trustSignal.level === 'material'
          ? trustSignal.reasons.includes('statement_import')
            ? t(
                'v2Overview.yearTrustStatementImport',
                'Tilinpäätöskorjaus muutti VEETI-rivejä: {{fields}}.',
                {
                  fields: changedSummaryFields,
                },
              )
            : t(
                'v2Overview.yearTrustMaterialChange',
                'Korjattu vuosi poikkeaa VEETIstä riveissä: {{fields}}.',
                {
                  fields: changedSummaryFields,
                },
              )
          : trustSignal.reasons.includes('fallback_split')
          ? t(
              'v2Overview.yearTrustFallbackSplit',
              'Materiaalit ja muut toimintakulut on jaettu VEETI-datasta oletusjaolla.',
            )
          : null;
      const resultToZeroNote =
        resultToZero.direction === 'missing'
          ? null
          : t('v2Overview.yearResultToZeroSignal', 'Tulos / 0: {{value}}', {
              value:
                resultToZero.marginPct == null
                  ? formatEur(resultToZero.effectiveValue ?? 0)
                  : `${formatEur(
                      resultToZero.effectiveValue ?? 0,
                    )} (${formatNumber(Math.abs(resultToZero.marginPct))} %)`,
            });
      const renderAccountingPreviewItem = (
        key:
          | 'revenue'
          | 'materialsCosts'
          | 'personnelCosts'
          | 'otherOperatingCosts'
          | 'result',
        labelKey: string,
        defaultLabel: string,
      ) => {
        const summaryRow = accountingSummaryMap.get(key);
        const value = summaryRow?.effectiveValue ?? null;
        const missing = !hasFinancials || value == null;
        return (
          <div className={`v2-year-preview-item ${missing ? 'missing' : ''}`}>
            <span>{t(labelKey, defaultLabel)}</span>
            <strong className={missing ? 'v2-year-preview-missing' : ''}>
              {missing
                ? t('v2Overview.previewMissingValue', 'Missing data')
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
                className={`v2-year-preview-item secondary ${hasPrices ? '' : 'missing'}`}
              >
                <span>{t('v2Overview.previewPricesLabel', 'Yksikköhinnat')}</span>
                <strong className={hasPrices ? '' : 'v2-year-preview-missing'}>
                  {hasPrices
                    ? `${formatPrice(prices.waterUnitPrice)} / ${formatPrice(
                        prices.wastewaterUnitPrice,
                      )}`
                    : t('v2Overview.previewMissingValue', 'Missing data')}
                </strong>
              </div>
              <div
                className={`v2-year-preview-item secondary ${hasVolumes ? '' : 'missing'}`}
              >
                <span>{t('v2Overview.previewVolumesLabel', 'Myydyt määrät')}</span>
                <strong className={hasVolumes ? '' : 'v2-year-preview-missing'}>
                  {hasVolumes
                    ? `${formatNumber(volumes.soldWaterVolume)} / ${formatNumber(
                        volumes.soldWastewaterVolume,
                      )} m3`
                    : t('v2Overview.previewMissingValue', 'Missing data')}
                </strong>
              </div>
            </div>
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
          {resultToZeroNote ? <p className="v2-muted">{resultToZeroNote}</p> : null}
        </>
      );
    },
    [t, yearDataCache],
  );

  React.useEffect(() => {
    const yearsToPrefetch = [
      ...selectableImportYearRows.map((row) => row.vuosi),
      ...reviewStatusRows
        .filter((row) => row.setupStatus !== 'excluded_from_plan')
        .map((row) => row.year),
    ];
    for (const year of new Set(yearsToPrefetch)) {
      void loadYearPreviewData(year);
    }
  }, [loadYearPreviewData, reviewStatusRows, selectableImportYearRows]);

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
    const baselineAlreadyReady =
      planningContext?.canCreateScenario ??
      (planningContext?.baselineYears?.length ?? 0) > 0;
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
      resetManualPatchDialog();
      await openManualPatchDialog(
        nextQueueRow.year,
        nextQueueRow.missingRequirements,
        'review',
      );
      setInfo(
        t(
          'v2Overview.keepCurrentYearValuesInfo',
          'No changes were applied for this year.',
        ),
      );
      return;
    }
    resetManualPatchDialog();
    setReviewContinueStep(nextStep === 5 ? (baselineAlreadyReady ? 6 : 5) : null);
    setInfo(
      t(
        'v2Overview.keepCurrentYearValuesInfo',
        'No changes were applied for this year.',
      ),
    );
  }, [
    confirmedImportedYears,
    manualPatchYear,
    planningContext?.baselineYears?.length,
    planningContext?.canCreateScenario,
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
    statementFileInputRef.current?.click();
  }, []);

  const handleSwitchToManualEditMode = React.useCallback(() => {
    setManualPatchMode('manualEdit');
    setManualPatchError(null);
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

  const setupCheckLabel = React.useCallback(
    (checkKey: MissingRequirement) => {
      if (checkKey === 'financials') {
        return t('v2Overview.datasetFinancials', 'Tilinpäätös');
      }
      if (checkKey === 'prices') {
        return t('v2Overview.datasetPrices', 'Taksa');
      }
      return t('v2Overview.datasetWaterVolume', 'Volyymit');
    },
    [t],
  );
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

    setReviewContinueStep(target.nextStep);

    if (target.selectedProblemYear != null) {
      const selectedYear = reviewStatusRows.find(
        (row) => row.year === target.selectedProblemYear,
      );
      if (selectedYear) {
        await openManualPatchDialog(
          selectedYear.year,
          selectedYear.missingRequirements,
          'review',
        );
        return;
      }
      handleGuideBlockedYears();
      return;
    }

    const nextReviewedYears = markPersistedReviewedImportYears(
      reviewStorageOrgId,
      target.yearsToMarkReviewed,
      confirmedImportedYears,
    );
    setReviewedImportedYears(nextReviewedYears);
    setInfo(
      target.yearsToMarkReviewed.length > 0
        ? t(
            'v2Overview.reviewContinueReviewedHint',
            'Tekninen valmius on nyt tarkistettu. Jatka suunnittelupohjaan.',
          )
        : t('v2Overview.reviewContinueReadyHint'),
    );
  }, [
    confirmedImportedYears,
    handleGuideBlockedYears,
    openManualPatchDialog,
    reviewStatusRows,
    reviewStorageOrgId,
    t,
  ]);
  const includedPlanningYears = React.useMemo(
    () =>
      reviewStatusRows
        .filter((row) => row.setupStatus === 'reviewed')
        .map((row) => row.year)
        .sort((a, b) => b - a),
    [reviewStatusRows],
  );
  const correctedPlanningYears = React.useMemo(
    () =>
      importYearRows
        .filter(
          (row) =>
            (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
            row.manualEditedAt != null ||
            row.manualReason != null,
        )
        .map((row) => row.vuosi)
        .sort((a, b) => b - a),
    [importYearRows],
  );
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
    (requirement: MissingRequirement) => {
      if (requirement === 'financials') {
        return t(
          'v2Overview.requirementFinancials',
          'Financial statement data',
        );
      }
      if (requirement === 'prices') {
        return t('v2Overview.requirementPrices', 'Price data (taksa)');
      }
      return t('v2Overview.requirementVolumes', 'Sold volume data');
    },
    [t],
  );
  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') => {
      if (key === 'waterUnitPrice') {
        return t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)');
      }
      return t(
        'v2Overview.manualPriceWastewater',
        'Wastewater unit price (EUR/m3)',
      );
    },
    [t],
  );
  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') => {
      if (key === 'soldWaterVolume') {
        return t('v2Overview.manualVolumeWater', 'Sold water volume (m3)');
      }
      return t(
        'v2Overview.manualVolumeWastewater',
        'Sold wastewater volume (m3)',
      );
    },
    [t],
  );

  const isReviewMode = manualPatchMode === 'review';
  const showAllManualSections =
    manualPatchMode === 'manualEdit' && manualPatchMissing.length === 0;
  const isStatementImportMode = manualPatchMode === 'statementImport';
  const showFinancialSection = manualPatchMode !== 'review';
  const showPricesSection = manualPatchMode !== 'review';
  const showVolumesSection = manualPatchMode !== 'review';
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
  const pendingReviewYearCount = pendingTechnicalReviewYearCount;
  const setupWizardState = React.useMemo(() => {
    if (!overview) return null;

    const baselineReady =
      planningContext?.canCreateScenario ??
      (planningContext?.baselineYears?.length ?? 0) > 0;

    return resolveSetupWizardState({
      connected: overview.importStatus.connected,
      importedYearCount: confirmedImportedYears.length,
      reviewedYearCount: reviewedImportedYearRows.length,
      blockedYearCount: importedBlockedYearCount,
      pendingReviewCount: pendingTechnicalReviewYearCount,
      excludedYearCount: excludedYearsSorted.length,
      baselineReady,
      selectedProblemYear: manualPatchYear,
    });
  }, [
    confirmedImportedYears.length,
    excludedYearsSorted.length,
    importedBlockedYearCount,
    manualPatchYear,
    overview,
    pendingTechnicalReviewYearCount,
    planningContext?.baselineYears?.length,
    planningContext?.canCreateScenario,
    reviewedImportedYearRows.length,
  ]);
  const wizardDisplayStep =
    manualPatchYear != null
      ? 4
      : reviewContinueStep ?? setupWizardState?.activeStep ?? 1;

  React.useEffect(() => {
    if (!setupWizardState) return;
    onSetupWizardStateChange?.(setupWizardState);
  }, [onSetupWizardStateChange, setupWizardState]);

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

  const hasBaselineBudget =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;

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
  const selectedConnectedOrg = overview?.importStatus.link ?? null;
  const selectedOrgName =
    selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';
  const importStep = Math.min(setupWizardState?.activeStep ?? 1, 3) as 1 | 2 | 3;
  const planningBaselineSummaryDetail = hasBaselineBudget
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
      label: t('v2Overview.wizardSummaryReviewedYears', 'Tarkistetut vuodet'),
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
      value: hasBaselineBudget
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
      badge: t('v2Overview.connected', 'Connected'),
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
      badge: t('v2Overview.wizardSummaryBaselineReady'),
    },
    6: {
      title: t('v2Overview.wizardQuestionForecast'),
      body: t('v2Overview.wizardBodyForecast'),
      badge: t('v2Overview.openForecast'),
    },
  };
  const wizardHero = wizardStepContent[wizardDisplayStep];
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

    return [
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
  const currentFinancialDataset =
    manualPatchYear != null
      ? yearDataCache[manualPatchYear]?.datasets.find(
          (dataset) => dataset.dataType === 'tilinpaatos',
        ) ?? null
      : null;
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
      <section>
        <article className="v2-card v2-overview-step-card">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 1 })}
              </p>
              <h2>{t('v2Overview.wizardQuestionConnect')}</h2>
            </div>
            <span className="v2-chip v2-status-warning">
              {t('v2Overview.disconnected', 'Not connected')}
            </span>
          </div>

          <p className="v2-muted v2-overview-review-body">
            {t('v2Overview.wizardBodyConnect')}
          </p>
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

          {selectedOrgStillVisible ? (
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
              <button
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() => setSelectedOrg(null)}
                disabled={connecting || importingYears || syncing}
              >
                {t('v2Overview.clearSelectionButton', 'Clear selection')}
              </button>
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
                : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
            </button>
          </div>
        </article>
      </section>
    ) : null;
  const importYearsSurface =
    wizardDisplayStep === 2 ? (
      <section>
        <article id="v2-import-years" className="v2-card v2-overview-step-card">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 2 })}
              </p>
              <h2>{t('v2Overview.wizardQuestionImportYears')}</h2>
            </div>
            <span className="v2-chip">
              {t('v2Overview.selectedYearsLabel', 'Selected years')}:{' '}
              {selectedYears.length}
            </span>
          </div>

          <p className="v2-muted v2-overview-review-body">
            {t('v2Overview.wizardBodyImportYears')}
          </p>

          {selectableImportYearRows.length === 0 ? (
            <p className="v2-muted">
              {t(
                'v2Overview.noImportedYears',
                'No imported years available yet.',
              )}
            </p>
          ) : (
            <>
              <div className="v2-import-board">
                {[
                  {
                    key: 'ready',
                    title: t('v2Overview.trustLaneReadyTitle', 'Ready to review'),
                    body: t(
                      'v2Overview.trustLaneReadyBody',
                      'These years look plausible enough to select now and verify after import.',
                    ),
                    rows: readyTrustBoardRows,
                  },
                  {
                    key: 'suspicious',
                    title: t(
                      'v2Overview.trustLaneSuspiciousTitle',
                      'Suspicious but salvageable',
                    ),
                    body: t(
                      'v2Overview.trustLaneSuspiciousBody',
                      'These years can still be selected, but the trust signals call for a human check before they become the planning baseline.',
                    ),
                    rows: suspiciousTrustBoardRows,
                  },
                  {
                    key: 'blocked',
                    title: t(
                      'v2Overview.trustLaneBlockedTitle',
                      'Blocked until completed',
                    ),
                    body: t(
                      'v2Overview.trustLaneBlockedBody',
                      'These years are missing key inputs and should stay out of the import selection until the gaps are fixed.',
                    ),
                    rows: blockedTrustBoardRows,
                  },
                ].map((lane) =>
                  lane.rows.length > 0 ? (
                    <div
                      key={lane.key}
                      className={`v2-import-board-lane v2-import-board-lane-${lane.key}`}
                    >
                      <div className="v2-year-readiness-section-head">
                        <h3>{lane.title}</h3>
                        <p className="v2-muted">{lane.body}</p>
                      </div>
                      <div className="v2-import-board-grid">
                        {lane.rows.map((row) => {
                          const revenueValue =
                            row.summaryMap.get('revenue')?.effectiveValue ?? null;
                          const resultValue =
                            row.summaryMap.get('result')?.effectiveValue ?? null;
                          const operatingCostValue =
                            row.summaryMap.get('materialsCosts')?.effectiveValue == null ||
                            row.summaryMap.get('personnelCosts')?.effectiveValue == null ||
                            row.summaryMap.get('otherOperatingCosts')?.effectiveValue == null
                              ? null
                              : (row.summaryMap.get('materialsCosts')?.effectiveValue ?? 0) +
                                (row.summaryMap.get('personnelCosts')?.effectiveValue ?? 0) +
                                (row.summaryMap.get('otherOperatingCosts')?.effectiveValue ?? 0);
                          const yearData = yearDataCache[row.vuosi];
                          const priceForm = buildPriceForm(yearData);
                          const volumeForm = buildVolumeForm(yearData);
                          const hasPrices =
                            row.completeness.taksa === true && yearData != null;
                          const hasVolumes =
                            (row.completeness.volume_vesi === true ||
                              row.completeness.volume_jatevesi === true) &&
                            yearData != null;
                          return (
                            <article
                              key={`${lane.key}-${row.vuosi}`}
                              className={`v2-year-readiness-row ${lane.key}`}
                            >
                              <div className="v2-year-readiness-head">
                                {lane.key === 'blocked' ? (
                                  <div className="v2-year-checkbox v2-year-select-disabled">
                                    <strong>{row.vuosi}</strong>
                                  </div>
                                ) : (
                                  <label className="v2-year-checkbox">
                                    <input
                                      type="checkbox"
                                      name={`syncYear-${row.vuosi}`}
                                      checked={selectedYears.includes(row.vuosi)}
                                      onChange={() => toggleYear(row.vuosi, null)}
                                      disabled={syncing}
                                    />
                                    <strong>{row.vuosi}</strong>
                                  </label>
                                )}
                                <div className="v2-badge-row">
                                  <span className={`v2-badge ${row.trustToneClass}`}>
                                    {row.trustLabel}
                                  </span>
                                  <span
                                    className={`v2-badge ${sourceStatusClassName(
                                      row.sourceStatus,
                                    )}`}
                                  >
                                    {sourceStatusLabel(row.sourceStatus)}
                                  </span>
                                </div>
                              </div>

                              <div className="v2-year-preview-grid">
                                <div className="v2-year-preview-item">
                                  <span>
                                    {t(
                                      'v2Overview.previewAccountingRevenueLabel',
                                      'Revenue',
                                    )}
                                  </span>
                                  <strong>
                                    {revenueValue == null
                                      ? t('v2Overview.previewMissingValue', 'Missing data')
                                      : formatEur(revenueValue)}
                                  </strong>
                                </div>
                                <div
                                  className={`v2-year-preview-item ${
                                    operatingCostValue == null ? 'missing' : ''
                                  }`}
                                >
                                  <span>
                                    {t(
                                      'v2Overview.previewOperatingCostsLabel',
                                      'Operating costs',
                                    )}
                                  </span>
                                  <strong
                                    className={
                                      operatingCostValue == null
                                        ? 'v2-year-preview-missing'
                                        : ''
                                    }
                                  >
                                    {operatingCostValue == null
                                      ? t('v2Overview.previewMissingValue', 'Missing data')
                                      : formatEur(operatingCostValue)}
                                  </strong>
                                </div>
                                <div className="v2-year-preview-item">
                                  <span>
                                    {t(
                                      'v2Overview.previewAccountingResultLabel',
                                      'Result',
                                    )}
                                  </span>
                                  <strong>
                                    {resultValue == null
                                      ? t('v2Overview.previewMissingValue', 'Missing data')
                                      : formatEur(resultValue)}
                                  </strong>
                                </div>
                              </div>

                              <p
                                className={
                                  lane.key === 'blocked'
                                    ? 'v2-year-readiness-missing'
                                    : 'v2-muted'
                                }
                              >
                                {row.trustNote}
                              </p>
                              {row.resultToZero.direction !== 'missing' ? (
                                <p className="v2-muted">
                                  {t(
                                    'v2Overview.yearResultToZeroSignal',
                                    'Tulos / 0: {{value}}',
                                    {
                                      value:
                                        row.resultToZero.marginPct == null
                                          ? formatEur(
                                              row.resultToZero.effectiveValue ?? 0,
                                            )
                                          : `${formatEur(
                                              row.resultToZero.effectiveValue ?? 0,
                                            )} (${formatNumber(
                                              Math.abs(row.resultToZero.marginPct),
                                            )} %)`,
                                    },
                                  )}
                                </p>
                              ) : null}

                              <details className="v2-year-technical-details">
                                <summary>
                                  {t(
                                    'v2Overview.previewSecondaryLabel',
                                    'Secondary checks before import',
                                  )}
                                </summary>
                                <div className="v2-year-preview-secondary-grid">
                                  <div
                                    className={`v2-year-preview-item secondary ${
                                      hasPrices ? '' : 'missing'
                                    }`}
                                  >
                                    <span>
                                      {t('v2Overview.previewPricesLabel', 'Unit prices')}
                                    </span>
                                    <strong
                                      className={
                                        hasPrices ? '' : 'v2-year-preview-missing'
                                      }
                                    >
                                      {hasPrices
                                        ? `${formatPrice(
                                            priceForm.waterUnitPrice,
                                          )} / ${formatPrice(
                                            priceForm.wastewaterUnitPrice,
                                          )}`
                                        : t(
                                            'v2Overview.previewMissingValue',
                                            'Missing data',
                                          )}
                                    </strong>
                                  </div>
                                  <div
                                    className={`v2-year-preview-item secondary ${
                                      hasVolumes ? '' : 'missing'
                                    }`}
                                  >
                                    <span>
                                      {t('v2Overview.previewVolumesLabel', 'Sold volumes')}
                                    </span>
                                    <strong
                                      className={
                                        hasVolumes ? '' : 'v2-year-preview-missing'
                                      }
                                    >
                                      {hasVolumes
                                        ? `${formatNumber(
                                            volumeForm.soldWaterVolume,
                                          )} / ${formatNumber(
                                            volumeForm.soldWastewaterVolume,
                                          )} m3`
                                        : t(
                                            'v2Overview.previewMissingValue',
                                            'Missing data',
                                          )}
                                    </strong>
                                  </div>
                                </div>
                                <p className="v2-muted">
                                  {t('v2Overview.sourceLabel', 'Source')}:{' '}
                                  {sourceStatusLabel(row.sourceStatus)}
                                </p>
                                <p className="v2-muted">
                                  {renderDatasetCounts(
                                    row.datasetCounts as
                                      | Record<string, number>
                                      | undefined,
                                  )}
                                </p>
                              </details>

                              {lane.key === 'blocked' && isAdmin ? (
                                <button
                                  type="button"
                                  className="v2-btn v2-btn-small"
                                  onClick={() =>
                                    openManualPatchDialog(
                                      row.vuosi,
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
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </>
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
                ? t('v2Overview.importingYearsButton')
                : t('v2Overview.importYearsButton')}
            </button>
          </div>
        </article>
      </section>
    ) : null;

  const shouldLeadWithActionSurface =
    wizardDisplayStep === 1 || wizardDisplayStep === 2;
  const compactSupportingChrome = shouldLeadWithActionSurface;

  const heroGrid = (
    <section className="v2-overview-hero-grid">
        <article
          className={`v2-card v2-overview-summary-card v2-overview-wizard-card ${
            compactSupportingChrome ? 'compact' : ''
          }`}
        >
          <div className="v2-overview-summary-head">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardLabel')}
              </p>
              <h2>{wizardHero.title}</h2>
            </div>
            <span className="v2-chip v2-status-info">
              {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
            </span>
          </div>

          {!compactSupportingChrome ? (
            <p className="v2-muted v2-overview-summary-body">{wizardHero.body}</p>
          ) : null}

          <div className="v2-overview-summary-meta">
            <div className="v2-overview-meta-block">
              <span>{t('v2Overview.organizationLabel', 'Organization')}</span>
              <strong>{importStatus.link?.nimi ?? '-'}</strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('v2Overview.businessIdLabel', 'Business ID')}</span>
              <strong>{importStatus.link?.ytunnus ?? '-'}</strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('v2Overview.lastFetchLabel', 'Last fetch')}</span>
              <strong>{formatDateTime(importStatus.link?.lastFetchedAt)}</strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('v2Overview.wizardCurrentFocus')}</span>
              <strong>{wizardHero.badge}</strong>
            </div>
          </div>
        </article>

        <aside
          className={`v2-card v2-overview-progress-card ${
            compactSupportingChrome ? 'compact' : ''
          }`}
        >
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardSummaryTitle')}
              </p>
              <h3>{t('v2Overview.wizardSummarySubtitle')}</h3>
            </div>
            <span className="v2-chip v2-status-provenance">
              {t('v2Overview.wizardProgress', { step: wizardDisplayStep })}
            </span>
          </div>

          <div className="v2-overview-progress-list">
            {wizardSummaryItems.map((item) => (
              <article key={item.label} className="v2-overview-progress-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.detail}</small>
              </article>
            ))}
          </div>

          <div className="v2-overview-helper-list">
            {wizardContextHelpers.map((helper) => (
              <article
                key={helper.key}
                className={`v2-overview-helper-card v2-overview-helper-card-${helper.tone}`}
              >
                <div className="v2-overview-helper-head">
                  <span>{helper.label}</span>
                  <strong>{helper.title}</strong>
                </div>
                <p>{helper.body}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>
  );

  const activeSurface = (
    <div className="v2-overview-active-surface">
        {connectSurface}

        {importYearsSurface}

      {false ? (
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

                          {isBlocked && isAdmin ? (
                            <button
                              type="button"
                              className="v2-btn v2-btn-small"
                              onClick={() =>
                                openManualPatchDialog(
                                  row.vuosi,
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
                                openManualPatchDialog(
                                  row.vuosi,
                                  row.missingRequirements,
                                  'review',
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

      {wizardDisplayStep === 4 && manualPatchYear != null ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
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

            <details
              className="v2-manual-optional v2-statement-import-panel"
              open={isStatementImportMode}
            >
              <summary>
                {t(
                  'v2Overview.statementImportSection',
                  'Statement correction and secondary detail',
                )}
              </summary>
              <section className="v2-manual-section v2-statement-import-panel">
              <div className="v2-manual-section-head">
                <h4>
                  {t(
                    'v2Overview.statementImportTitle',
                    'Import statement PDF with OCR',
                  )}
                </h4>
                <span className="v2-required-pill v2-required-pill-optional">
                  {t('v2Overview.optionalField', 'Optional')}
                </span>
              </div>
              <p className="v2-muted">
                {t(
                  'v2Overview.statementImportBody',
                  'Upload the bookkeeping PDF. OCR scans the first pages, detects the result statement, and pre-fills the financial statement fields below for review.',
                )}
              </p>
              <div className="v2-statement-import-actions">
                <input
                  ref={statementFileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleStatementPdfSelected}
                  disabled={statementImportBusy || manualPatchBusy}
                />
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
                  <p>
                    <strong>{statementImportPreview.fileName}</strong>
                    {statementImportPreview.pageNumber != null
                      ? ` - ${t(
                          'v2Overview.statementImportDetectedPage',
                          'detected page {{page}}',
                          { page: statementImportPreview.pageNumber },
                        )}`
                      : ''}
                    {statementImportPreview.confidence != null
                      ? ` - ${t(
                          'v2Overview.statementImportConfidence',
                          'confidence {{value}}%',
                          {
                            value: Math.round(statementImportPreview.confidence),
                          },
                        )}`
                      : ''}
                    {statementImportPreview.scannedPageCount > 0
                      ? ` - ${t(
                          'v2Overview.statementImportScannedPages',
                          'scanned {{count}} pages',
                          { count: statementImportPreview.scannedPageCount },
                        )}`
                      : ''}
                  </p>
                  <div className="v2-keyvalue-list">
                    {statementImportPreview.matches.map((match) => (
                      <div
                        key={`${match.key}-${match.pageNumber}-${match.sourceLine}`}
                        className="v2-keyvalue-row"
                      >
                        <span>
                          {match.label}: {formatEur(match.value)}
                        </span>
                        <span className="v2-muted">{match.sourceLine}</span>
                      </div>
                    ))}
                  </div>
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
              ) : null}
              </section>
            </details>

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
                disabled={manualPatchBusy || statementImportBusy}
              >
                {t(
                  isReviewMode ? 'common.close' : 'common.cancel',
                  isReviewMode ? 'Close' : 'Cancel',
                )}
              </button>
              {isReviewMode ? null : (
                <>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={manualPatchBusy || statementImportBusy}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirm',
                      'Confirm statement import',
                    )
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className={wizardDisplayStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn'}
                onClick={() => submitManualPatch(true)}
                disabled={manualPatchBusy || statementImportBusy}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : isStatementImportMode
                  ? t(
                      'v2Overview.statementImportConfirmAndSync',
                      'Confirm import and sync year',
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
      <section className="v2-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', { step: 3 })}
            </p>
            <h2>{t('v2Overview.wizardQuestionReviewYears')}</h2>
          </div>
          <span className="v2-badge v2-status-provenance">
            {t('v2Overview.reviewYearsCount', {
              count: reviewStatusRows.length,
            })}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyReviewYears')}
        </p>

        {reviewStatusRows.length === 0 ? (
          <div className="v2-empty-state">
            <p>{t('v2Overview.reviewYearsEmpty')}</p>
          </div>
        ) : (
          <div className="v2-year-status-list">
            {reviewStatusRows.map((row) => {
              const helperText =
                row.setupStatus === 'excluded_from_plan'
                  ? t('v2Overview.setupStatusExcludedHint')
                  : row.setupStatus === 'reviewed'
                    ? t(
                        'v2Overview.setupStatusReviewedHint',
                        'Tämä vuosi on tarkistettu ja hyväksytty mukaan suunnittelupohjaan.',
                      )
                    : row.setupStatus === 'ready_for_review'
                      ? t(
                          'v2Overview.setupStatusTechnicalReadyHint',
                          'Vuosi näyttää valmiilta. Tarkista vertailu ja hyväksy vuosi suunnittelupohjaan.',
                        )
                      : t('v2Overview.setupStatusNeedsAttentionHint', {
                        requirements:
                          row.missingRequirements.length > 0
                            ? row.missingRequirements
                                .map((item) => missingRequirementLabel(item))
                                .join(', ')
                            : t('v2Overview.setupStatusNeedsAttention'),
                      });

              return (
                <article
                  key={row.year}
                  className={`v2-year-status-row ${yearStatusRowClassName(row.setupStatus)}`}
                >
                  <div className="v2-year-status-head">
                    <div className="v2-year-status-labels">
                      <strong>{row.year}</strong>
                      <span
                        className={`v2-badge ${sourceStatusClassName(
                          row.sourceStatus,
                        )}`}
                      >
                        {row.setupStatus === 'excluded_from_plan'
                          ? t('v2Overview.setupStatusExcludedShort')
                          : sourceStatusLabel(row.sourceStatus)}
                      </span>
                    </div>
                    <span
                      className={`v2-badge ${setupStatusClassName(row.setupStatus)}`}
                    >
                      {setupStatusLabel(row.setupStatus)}
                    </span>
                  </div>

                  <div className="v2-year-status-checks">
                    {row.readinessChecks.map((check) => (
                      <div
                        key={`${row.year}-${check.key}`}
                        className={`v2-year-status-check ${
                          check.ready ? 'ready' : 'missing'
                        }`}
                      >
                        <span className="v2-year-status-check-badge">
                          {check.ready
                            ? t('v2Overview.checkReady')
                            : t('v2Overview.checkMissing')}
                        </span>
                        <span>{setupCheckLabel(check.key)}</span>
                      </div>
                    ))}
                  </div>

                  {renderYearValuePreview(row.year, {
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

                  <p className="v2-year-status-note">{helperText}</p>

                  {row.warnings.length > 0 ? (
                    <p className="v2-muted v2-year-status-note">
                      {row.warnings
                        .map((warning) => importWarningLabel(warning))
                        .join(' ')}
                    </p>
                  ) : null}

                  <div className="v2-year-status-actions">
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={() =>
                        openManualPatchDialog(
                          row.year,
                          row.missingRequirements,
                          'review',
                        )
                      }
                    >
                      {row.setupStatus === 'ready_for_review' ||
                      row.setupStatus === 'reviewed'
                        ? t(
                            'v2Overview.openReviewYearButton',
                            'Avaa ja tarkista',
                          )
                        : t('v2Overview.yearDecisionAction')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="v2-overview-review-actions">
          <button
            type="button"
            className={reviewContinueButtonClass}
            onClick={handleContinueFromReview}
            disabled={reviewStatusRows.length === 0}
          >
            {t('v2Overview.reviewContinue')}
          </button>
          <p className="v2-muted">
            {importedBlockedYearCount > 0
              ? t('v2Overview.reviewContinueBlockedHint')
              : pendingReviewYearCount > 0
                ? t(
                    'v2Overview.reviewContinueTechnicalReadyBody',
                    'Nämä vuodet odottavat vielä tarkistusta ja hyväksyntää: {{years}}.',
                    { years: technicalReadyYearsLabel },
                  )
                : t('v2Overview.reviewContinueReadyBody')}
          </p>
        </div>
      </section>
      ) : null}

      {wizardDisplayStep === 5 ? (
      <section className="v2-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', { step: 5 })}
            </p>
            <h2>{t('v2Overview.wizardQuestionBaseline')}</h2>
          </div>
          <span className="v2-badge v2-status-provenance">
            {includedPlanningYears.length}{' '}
            {t('v2Overview.wizardSummaryImportedYears')}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t('v2Overview.wizardBodyBaseline')}
        </p>

        <div className="v2-planning-baseline-grid">
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineIncludedYears')}</span>
            <strong>
              {includedPlanningYears.length > 0
                ? includedPlanningYears.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineExcludedYears')}</span>
            <strong>
              {excludedYearsSorted.length > 0
                ? excludedYearsSorted.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
          <article className="v2-planning-baseline-card">
            <span>{t('v2Overview.baselineCorrectedYears')}</span>
            <strong>
              {correctedPlanningYears.length > 0
                ? correctedPlanningYears.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected')}
            </strong>
          </article>
        </div>

        <div className="v2-overview-review-actions">
          <button
            type="button"
            className={planningBaselineButtonClass}
            onClick={handleCreatePlanningBaseline}
            disabled={
              creatingPlanningBaseline ||
              includedPlanningYears.length === 0 ||
              importedBlockedYearCount > 0
            }
          >
            {creatingPlanningBaseline
              ? t('common.loading', 'Loading...')
              : t('v2Overview.createPlanningBaseline')}
          </button>
          <p className="v2-muted">
            {importedBlockedYearCount > 0
              ? t('v2Overview.baselineBlockedHint')
              : t('v2Overview.baselineReadyHint')}
          </p>
        </div>
      </section>
      ) : null}

      {wizardDisplayStep === 6 && hasBaselineBudget ? (
        <section className="v2-card">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardProgress', { step: 6 })}
              </p>
              <h2>{t('v2Overview.wizardQuestionForecast')}</h2>
            </div>
          <span className="v2-badge v2-status-positive">
            {t('v2Overview.wizardSummaryYes')}
          </span>
        </div>

          <p className="v2-muted v2-overview-review-body">
            {t('v2Overview.wizardBodyForecast')}
          </p>

          <div className="v2-overview-review-actions">
            <button
              type="button"
              className={openForecastButtonClass}
              onClick={handleOpenForecastHandoff}
            >
              {t('v2Overview.openForecast')}
            </button>
            <p className="v2-muted">
              {t(
                'v2Forecast.selectScenarioHint',
                'Choose an existing scenario or create a new one to continue.',
              )}
            </p>
          </div>
        </section>
      ) : null}
      </div>
  );

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
      {shouldLeadWithActionSurface ? activeSurface : heroGrid}
      {shouldLeadWithActionSurface ? heroGrid : activeSurface}
    </div>
  );
};

