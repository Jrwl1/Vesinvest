import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  connectImportOrganizationV2,
  deleteImportYearsBulkV2,
  getImportYearDataV2,
  importYearsV2,
  deleteImportYearV2,
  getOpsFunnelV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  refreshOverviewPeerV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
  type V2OpsFunnelSnapshot,
  type V2PlanningContextResponse,
  type V2OverviewResponse,
  type V2ReportListItem,
  type VeetiOrganizationSearchHit,
} from '../api';
import { formatDateTime, formatEur, formatNumber, formatPrice } from './format';
import {
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
  canReapplyFinancialVeeti,
} from './yearReview';

type Props = {
  onGoToForecast: () => void;
  onGoToReports: () => void;
  isAdmin: boolean;
  onSetupWizardStateChange?: (state: SetupWizardState) => void;
  onSetupOrgNameChange?: (name: string | null) => void;
};

type ManualPatchMode = 'manualEdit' | 'statementImport';

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

const MANUAL_NUMERIC_EPSILON = 0.005;

const PEER_METRIC_LABEL_KEYS: Record<string, string> = {
  liikevaihto_per_m3: 'v2Overview.peerMetricRevenuePerM3',
  vesi_yksikkohinta: 'v2Overview.peerMetricWaterUnitPrice',
  jatevesi_yksikkohinta: 'v2Overview.peerMetricWastewaterUnitPrice',
  liikevaihto: 'v2Overview.peerMetricRevenue',
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  onGoToForecast: _onGoToForecast,
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
  const [importedWorkspaceYears, setImportedWorkspaceYears] = React.useState<
    number[] | null
  >(null);
  const [opsFunnel, setOpsFunnel] = React.useState<V2OpsFunnelSnapshot | null>(
    null,
  );
  const [connecting, setConnecting] = React.useState(false);
  const [importingYears, setImportingYears] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [refreshingPeer, setRefreshingPeer] = React.useState(false);
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
  const [manualPatchYear, setManualPatchYear] = React.useState<number | null>(
    null,
  );
  const [manualPatchMode, setManualPatchMode] =
    React.useState<ManualPatchMode>('manualEdit');
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
      const [data, context, scenarios, reports, funnel] = await Promise.all([
        getOverviewV2(),
        getPlanningContextV2().catch(() => null),
        listForecastScenariosV2().catch(() => null),
        listReportsV2().catch(() => null),
        isAdmin ? getOpsFunnelV2().catch(() => null) : Promise.resolve(null),
      ]);
      setOverview(data);
      setPlanningContext(context);
      setScenarioList(scenarios);
      setReportList(reports);
      setOpsFunnel(funnel);
      const availableYearSet = new Set(
        (data.importStatus.years ?? []).map((row) => row.vuosi),
      );
      const excludedYearSet = new Set(
        (data.importStatus.excludedYears ?? [])
          .map((year) => Number(year))
          .filter((year) => Number.isFinite(year)),
      );

      setSelectedYears((prev) => {
        const filtered = prev
          .filter((year) => availableYearSet.has(year))
          .sort((a, b) => a - b);
        if (syncYearSelectionTouchedRef.current) {
          return filtered;
        }
        const defaults = pickDefaultSyncYears(data.importStatus.years ?? []);
        return filtered.length > 0 ? filtered : defaults;
      });
      setSelectedYearsForDelete((prev) =>
        prev.filter((year) => availableYearSet.has(year)).sort((a, b) => a - b),
      );
      setSelectedYearsForRestore((prev) =>
        prev.filter((year) => excludedYearSet.has(year)).sort((a, b) => a - b),
      );
      setImportedWorkspaceYears((prev) => {
        const fallbackYears = (data.importStatus.years ?? [])
          .map((row) => row.vuosi)
          .sort((a, b) => b - a);
        if (!prev) return fallbackYears;
        return prev.filter((year) => availableYearSet.has(year));
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorLoadFailed', 'Failed to load overview.'),
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, pickDefaultSyncYears, t]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSearch = React.useCallback(async () => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    const requestSeq = searchRequestSeq.current + 1;
    searchRequestSeq.current = requestSeq;
    setSearching(true);
    setError(null);
    setInfo(null);
    setSelectedOrg(null);
    setSearchResults([]);
    try {
      const rows = await searchImportOrganizationsV2(trimmedQuery, 25);
      if (searchRequestSeq.current !== requestSeq) return;
      setSearchResults(rows);
      sendV2OpsEvent({
        event: 'veeti_search',
        status: 'ok',
        attrs: { queryLength: trimmedQuery.length, resultCount: rows.length },
      });
      if (rows.length === 0) {
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
        attrs: { queryLength: trimmedQuery.length },
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
  }, [query, t]);

  const handleConnect = React.useCallback(async () => {
    if (!selectedOrg) return;
    setConnecting(true);
    setError(null);
    setInfo(null);
    try {
      await connectImportOrganizationV2(selectedOrg.Id);
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'ok',
        attrs: { veetiId: selectedOrg.Id },
      });
      const status = await getImportStatusV2();
      const years = pickDefaultSyncYears(status.years ?? []);
      syncYearSelectionTouchedRef.current = false;
      setSelectedYears(years);
      setSelectedYearsForDelete([]);
      setSelectedYearsForRestore([]);
      setInfo(
        t(
          'v2Overview.infoConnected',
          'Organization connected. Select years and run sync.',
        ),
      );
      await loadOverview();
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_connect_org',
        status: 'error',
        attrs: { veetiId: selectedOrg.Id },
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
        t(
          'v2Overview.infoImportYearsDone',
          'Imported years are now in the workspace: {{years}}.',
          {
            years:
              result.importedYears.length > 0
                ? result.importedYears.join(', ')
                : t('v2Overview.noYearsSelected', 'None selected'),
          },
        ),
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

  const syncYearRows = React.useMemo(
    () =>
      (overview?.importStatus.years ?? []).map((row) => ({
        ...row,
        syncBlockedReason: resolveSyncBlockReason(row),
      })),
    [overview?.importStatus.years, resolveSyncBlockReason],
  );

  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );

  const blockedYearRows = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason),
    [syncYearRows],
  );

  const readyYearRows = React.useMemo(
    () => syncYearRows.filter((row) => !row.syncBlockedReason),
    [syncYearRows],
  );

  const recommendedYears = React.useMemo(
    () =>
      [...readyYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((row) => row.vuosi),
    [readyYearRows],
  );

  const selectedOrgStillVisible = React.useMemo(
    () =>
      selectedOrg
        ? searchResults.some((row) => row.Id === selectedOrg.Id)
        : false,
    [searchResults, selectedOrg],
  );

  const importYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
          readinessChecks: getSetupReadinessChecks(row),
          setupStatus: getSetupYearStatus(row),
        })),
    [syncYearRows],
  );

  const confirmedImportedYears = React.useMemo(
    () =>
      importedWorkspaceYears && importedWorkspaceYears.length > 0
        ? importedWorkspaceYears
        : importYearRows.map((row) => row.vuosi),
    [importYearRows, importedWorkspaceYears],
  );

  const excludedYearsSorted = React.useMemo(
    () =>
      [...(overview?.importStatus.excludedYears ?? [])]
        .map((year) => Number(year))
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => b - a),
    [overview?.importStatus.excludedYears],
  );
  const reviewStatusRows = React.useMemo(() => {
    const rows = importYearRows.map((row) => ({
      year: row.vuosi,
      sourceStatus: row.sourceStatus,
      readinessChecks: row.readinessChecks,
      missingRequirements: row.missingRequirements,
      warnings: (row.warnings ?? []) as ImportWarningCode[],
      setupStatus: getSetupYearStatus(row, {
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
  }, [excludedYearsSorted, importYearRows]);

  const setupWizardState = React.useMemo(() => {
    if (!overview) return null;

    const baselineReady =
      planningContext?.canCreateScenario ??
      (planningContext?.baselineYears?.length ?? 0) > 0;

    return resolveSetupWizardState({
      connected: overview.importStatus.connected,
      importedYearCount: overview.importStatus.years.length,
      readyYearCount: readyYearRows.length,
      blockedYearCount,
      excludedYearCount: excludedYearsSorted.length,
      baselineReady,
    });
  }, [
    blockedYearCount,
    excludedYearsSorted.length,
    overview,
    planningContext?.baselineYears?.length,
    planningContext?.canCreateScenario,
    readyYearRows.length,
  ]);

  React.useEffect(() => {
    if (!setupWizardState) return;
    onSetupWizardStateChange?.(setupWizardState);
  }, [onSetupWizardStateChange, setupWizardState]);

  React.useEffect(() => {
    onSetupOrgNameChange?.(overview?.importStatus.link?.nimi ?? null);
  }, [onSetupOrgNameChange, overview?.importStatus.link?.nimi]);

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
        'v2Overview.deleteYearsBulkConfirm',
        'Remove selected imported years: {{years}}? This also prevents those years from returning on sync until restored.',
        { years: yearsLabel },
      ),
    );
    if (!confirmed) return;

    setBulkDeletingYears(true);
    setError(null);
    setInfo(null);

    try {
      const result = await deleteImportYearsBulkV2(selectedYearsForDelete);
      const failedRows = result.results.filter((row) => !row.ok);
      if (failedRows.length > 0) {
        const failedYears = failedRows.map((row) => row.vuosi).join(', ');
        setInfo(
          t(
            'v2Overview.deleteYearsBulkPartial',
            'Removed {{deleted}} year(s). Failed for {{failed}} year(s): {{years}}.',
            {
              deleted: result.deletedCount,
              failed: result.failedCount,
              years: failedYears,
            },
          ),
        );
      } else {
        setInfo(
          t('v2Overview.deleteYearsBulkDone', 'Removed {{count}} year(s).', {
            count: result.deletedCount,
          }),
        );
      }
      setSelectedYearsForDelete([]);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.deleteYearsBulkFailed',
              'Failed to remove selected years.',
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

  const selectedConnectedOrg = overview?.importStatus.link ?? null;
  const selectedOrgName =
    selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';

  const importStep = !overview?.importStatus.connected
    ? 1
    : selectedYears.length === 0
    ? 2
    : 3;

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
      mode: ManualPatchMode = 'manualEdit',
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

  const closeManualPatchDialog = React.useCallback(() => {
    if (manualPatchBusy || statementImportBusy) return;
    setManualPatchYear(null);
    setManualPatchMode('manualEdit');
    setManualPatchMissing([]);
    setManualPatchError(null);
    setManualReason('');
    setStatementImportError(null);
    setStatementImportStatus(null);
    setStatementImportPreview(null);
    if (statementFileInputRef.current) {
      statementFileInputRef.current.value = '';
    }
  }, [manualPatchBusy, statementImportBusy]);

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
        const result = await completeImportYearManuallyV2(payload);
        setYearDataCache((prev) => {
          const next = { ...prev };
          delete next[manualPatchYear];
          return next;
        });
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            year: manualPatchYear,
            syncReady: result.syncReady,
            patchedDataTypeCount: result.patchedDataTypes.length,
          },
        });
        if (syncAfterSave && result.syncReady) {
          await runSync([manualPatchYear]);
        } else {
          await loadOverview();
          setInfo(
            t(
              'v2Overview.manualPatchSaved',
              'Year {{year}} was patched. Run sync to create/update baseline budget.',
              { year: manualPatchYear },
            ),
          );
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
      t,
      yearDataCache,
    ],
  );

  const operationsLatest = React.useMemo(() => {
    if (!planningContext?.operations.latestYear) return null;
    return planningContext.baselineYears.find(
      (row) => row.year === planningContext.operations.latestYear,
    );
  }, [planningContext]);

  const recentBaselineRows = React.useMemo(
    () => planningContext?.baselineYears.slice(-4).reverse() ?? [],
    [planningContext],
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

  const handleDeleteYear = React.useCallback(
    async (year: number) => {
      const confirmed = window.confirm(
        t(
          'v2Overview.deleteYearConfirm',
          'Remove imported year {{year}}? This deletes imported snapshots and generated VEETI budgets for that year.',
          { year },
        ),
      );
      if (!confirmed) return;

      setRemovingYear(year);
      setError(null);
      setInfo(null);
      try {
        const result = await deleteImportYearV2(year);
        setInfo(
          t(
            'v2Overview.deleteYearDone',
            'Year {{year}} removed ({{snapshots}} snapshots, {{budgets}} budgets).',
            {
              year: result.vuosi,
              snapshots: result.deletedSnapshots,
              budgets: result.deletedBudgets,
            },
          ),
        );
        await loadOverview();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.deleteYearFailed',
                'Failed to remove imported year.',
              ),
        );
      } finally {
        setRemovingYear(null);
      }
    },
    [loadOverview, t],
  );

  const handleRefreshPeer = React.useCallback(async () => {
    if (!overview?.latestVeetiYear) return;
    setRefreshingPeer(true);
    setError(null);
    try {
      await refreshOverviewPeerV2(overview.latestVeetiYear);
      await loadOverview();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.errorRefreshPeerFailed',
              'Failed to refresh peer data.',
            ),
      );
    } finally {
      setRefreshingPeer(false);
    }
  }, [overview?.latestVeetiYear, loadOverview, t]);

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

  const handleKeepCurrentYearValues = React.useCallback(() => {
    closeManualPatchDialog();
    setInfo(
      t(
        'v2Overview.keepCurrentYearValuesInfo',
        'No changes were applied for this year.',
      ),
    );
  }, [closeManualPatchDialog, t]);

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

  const metricLabel = React.useCallback(
    (metricKey: string) =>
      t(PEER_METRIC_LABEL_KEYS[metricKey] ?? metricKey, metricKey),
    [t],
  );
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
    (status: 'ready' | 'needs_attention' | 'excluded_from_plan') => {
      if (status === 'ready') {
        return t('v2Overview.setupStatusReady', 'Valmis');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded', 'Pois suunnitelmasta');
      }
      return t('v2Overview.setupStatusNeedsAttention', 'Korjattava');
    },
    [t],
  );
  const setupStatusClassName = React.useCallback(
    (status: 'ready' | 'needs_attention' | 'excluded_from_plan') => {
      if (status === 'ready') return 'v2-status-positive';
      if (status === 'excluded_from_plan') return 'v2-status-provenance';
      return 'v2-status-warning';
    },
    [],
  );
  const handleContinueFromReview = React.useCallback(() => {
    if (blockedYearCount > 0) {
      handleGuideBlockedYears();
      return;
    }
    setInfo(
      t(
        'v2Overview.reviewContinueReadyHint',
        'Vuodet ovat valmiit. Suunnittelupohjan luonti tulee seuraavassa vaiheessa.',
      ),
    );
  }, [blockedYearCount, handleGuideBlockedYears, t]);

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

  const showAllManualSections = manualPatchMissing.length === 0;
  const isStatementImportMode = manualPatchMode === 'statementImport';
  const showFinancialSection =
    showAllManualSections || manualPatchMissing.includes('financials');
  const showPricesSection =
    showAllManualSections || manualPatchMissing.includes('prices');
  const showVolumesSection =
    showAllManualSections || manualPatchMissing.includes('volumes');
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

  const { importStatus, peerSnapshot } = overview;

  const hasBaselineBudget =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;

  const wizardDisplayStep =
    setupWizardState?.recommendedStep ?? setupWizardState?.currentStep ?? 1;
  const importedYearsLabel =
    confirmedImportedYears.length > 0
      ? confirmedImportedYears.join(', ')
      : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const readyYearsLabel =
    readyYearRows.length > 0
      ? readyYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const excludedYearsLabel =
    excludedYearsSorted.length > 0
      ? excludedYearsSorted.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const wizardSummaryItems = [
    {
      label: t('v2Overview.wizardSummaryCompany', 'Selected company'),
      value: importStatus.link?.nimi ?? selectedOrgName,
      detail: importStatus.link?.ytunnus ?? selectedOrgBusinessId,
    },
    {
      label: t('v2Overview.wizardSummaryImportedYears', 'Imported years'),
      value: String(importYearRows.length),
      detail: importedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
      value: String(readyYearRows.length),
      detail: readyYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryExcludedYears', 'Excluded years'),
      value: String(excludedYearsSorted.length),
      detail: excludedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryBaselineReady', 'Baseline ready'),
      value: hasBaselineBudget
        ? t('v2Overview.wizardSummaryYes', 'Yes')
        : t('v2Overview.wizardSummaryNo', 'No'),
      detail: hasBaselineBudget
        ? t(
            'v2Overview.wizardBaselineReadyHint',
            'Planning baseline is available for the next step.',
          )
        : t(
            'v2Overview.wizardBaselinePendingHint',
            'Planning baseline is created later in the setup flow.',
          ),
    },
  ] as const;
  const wizardStepContent: Record<
    number,
    { title: string; body: string; badge: string }
  > = {
    1: {
      title: t(
        'v2Overview.wizardQuestionConnect',
        'Minkä vesilaitoksen tiedoilla työskentelet?',
      ),
      body: t(
        'v2Overview.wizardBodyConnect',
        'Hae ja valitse tuotu VEETI-organisaatio. Tämän jälkeen työtila kertoo selvästi, minkä vesilaitoksen tiedoilla jatkat.',
      ),
      badge: t('v2Overview.connected', 'Connected'),
    },
    2: {
      title: t(
        'v2Overview.wizardQuestionImportYears',
        'Mitkä vuodet haluat tuoda sisään?',
      ),
      body: t(
        'v2Overview.wizardBodyImportYears',
        'Valitse työtilaan ne vuodet, joita haluat käyttää suunnittelun pohjana. Tuonnin jälkeen näet heti, mitkä vuodet ovat mukana.',
      ),
      badge: t('v2Overview.importTitle', 'Import VEETI'),
    },
    3: {
      title: t(
        'v2Overview.wizardQuestionReviewYears',
        'Mitkä vuodet ovat käyttövalmiita?',
      ),
      body: t(
        'v2Overview.wizardBodyReviewYears',
        'Tarkista jokainen vuosi yhdestä paikasta. Tässä vaiheessa tarkoitus on ymmärtää vuosien tila ennen korjauksia tai rajauksia.',
      ),
      badge: t('v2Overview.needsReviewBadge', 'Needs review'),
    },
    4: {
      title: t(
        'v2Overview.wizardQuestionFixYear',
        'Mitä tälle vuodelle tehdään?',
      ),
      body: t(
        'v2Overview.wizardBodyFixYear',
        'Valitse ongelmavuodelle yksi selkeä jatkotoimi: pidä mukana, korjaa tiedot tai rajaa pois suunnitelmasta.',
      ),
      badge: t('v2Overview.needsReviewBadge', 'Needs review'),
    },
    5: {
      title: t(
        'v2Overview.wizardQuestionBaseline',
        'Rakennetaanko näistä vuosista suunnittelupohja?',
      ),
      body: t(
        'v2Overview.wizardBodyBaseline',
        'Vahvista mitkä vuodet otetaan mukaan suunnittelupohjaan ja mitkä jätetään sen ulkopuolelle ennen kuin siirryt Ennusteeseen.',
      ),
      badge: t('v2Overview.wizardSummaryBaselineReady', 'Baseline ready'),
    },
    6: {
      title: t(
        'v2Overview.wizardQuestionForecast',
        'Valmis ennustamiseen?',
      ),
      body: t(
        'v2Overview.wizardBodyForecast',
        'Suunnittelupohja on valmis. Seuraavaksi siirryt Ennusteeseen nimeämään ensimmäisen skenaarion ja jatkamaan mallinnusta.',
      ),
      badge: t('v2Overview.openForecast', 'Open Forecast'),
    },
  };
  const wizardHero = wizardStepContent[wizardDisplayStep];
  const connectButtonClass =
    wizardDisplayStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const yearFixPrimaryClass =
    wizardDisplayStep === 4 ? 'v2-btn v2-btn-small v2-btn-primary' : 'v2-btn v2-btn-small';
  const importYearsButtonClass =
    wizardDisplayStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';

  const peerUnavailableMessage =
    peerSnapshot.reason === 'No VEETI years imported.'
      ? t('v2Overview.peerNoImportedYears', 'No imported VEETI years yet.')
      : t('v2Overview.peerUnavailable', 'Peer data is not available.');

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

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-overview-hero-grid">
        <article className="v2-card v2-overview-summary-card v2-overview-wizard-card">
          <div className="v2-overview-summary-head">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardLabel', 'Setup wizard')}
              </p>
              <h2>{wizardHero.title}</h2>
            </div>
            <span className="v2-chip v2-status-info">
              {t('v2Overview.wizardProgress', 'Vaihe {{step}} / 6', {
                step: wizardDisplayStep,
              })}
            </span>
          </div>

          <p className="v2-muted v2-overview-summary-body">{wizardHero.body}</p>

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
              <span>{t('v2Overview.wizardCurrentFocus', 'Current focus')}</span>
              <strong>{wizardHero.badge}</strong>
            </div>
          </div>
        </article>

        <aside className="v2-card v2-overview-progress-card">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Overview.wizardSummaryTitle', 'Setup summary')}
              </p>
              <h3>{t('v2Overview.wizardSummarySubtitle', 'Planning baseline')}</h3>
            </div>
            <span className="v2-chip v2-status-provenance">
              {t('v2Overview.wizardProgress', 'Vaihe {{step}} / 6', {
                step: wizardDisplayStep,
              })}
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
        </aside>
      </section>

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
              'v2Overview.importWizardIntro',
              'Follow three steps: connect organization, choose years, then run import.',
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
                  'v2Overview.importWorkspaceTitle',
                  '3. Tuodut vuodet työtilassa',
                )}
              </strong>
              <span>
                {t(
                  'v2Overview.importWorkspaceBody',
                  'Imported years are confirmed in the workspace here before later wizard steps continue.',
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
                    {selectedOrg.Kunta}
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
                      onClick={() => setSelectedOrg(org)}
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
                onClick={handleConnect}
                disabled={
                  !selectedOrgStillVisible ||
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
                                : t('v2Overview.yearSyncReady', 'Sync ready')}
                            </span>
                            <small className="v2-muted">
                              {sourceStatusLabel(row.sourceStatus)}
                            </small>
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

                          <p className="v2-muted">
                            {t(
                              'v2Overview.datasetCountsLabel',
                              'Imported rows',
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
                  'v2Overview.importWorkspaceTitle',
                  '3. Tuodut vuodet työtilassa',
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
                <div className="v2-import-review-grid">
                  <p>
                    <strong>
                      {t('v2Overview.organizationLabel', 'Organization')}:
                    </strong>{' '}
                    {selectedConnectedOrg?.nimi ?? selectedOrgName}
                  </p>
                  <p>
                    <strong>
                      {t('v2Overview.businessIdLabel', 'Business ID')}:
                    </strong>{' '}
                    {selectedConnectedOrg?.ytunnus ?? selectedOrgBusinessId}
                  </p>
                  <p>
                    <strong>
                      {t('v2Overview.wizardSummaryImportedYears', 'Imported years')}:
                    </strong>{' '}
                    {confirmedImportedYears.length > 0
                      ? confirmedImportedYears.join(', ')
                      : t('v2Overview.noYearsSelected', 'None selected')}
                  </p>
                  <p>
                    <strong>
                      {t('v2Overview.blockedYearsTitle', 'Blocked years')}:
                    </strong>{' '}
                    {blockedYearCount}
                  </p>
                </div>

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
                      'v2Overview.importWorkspaceBody',
                      'These imported years are now available in the workspace: {{years}}. Planning baseline creation comes later in the wizard.',
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

      {manualPatchYear != null ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
            <h3>
              {isStatementImportMode
                ? t(
                    'v2Overview.statementImportWorkflowTitle',
                    'Import statement PDF for year {{year}}',
                    { year: manualPatchYear },
                  )
                : t(
                    'v2Overview.manualPatchTitle',
                    'Complete year {{year}} manually',
                    { year: manualPatchYear },
                  )}
            </h3>
            <p className="v2-muted">
              {isStatementImportMode
                ? t(
                    'v2Overview.statementImportWorkflowBody',
                    'Upload the bookkeeping PDF, review the detected financial statement values, and confirm the import. Other datasets keep their current source.',
                  )
                : t(
                    'v2Overview.manualPatchBody',
                    'Fill missing required fields, save, and optionally sync this year immediately.',
                  )}
            </p>
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
                    'v2Overview.yearReviewActionsTitle',
                    'Year review actions',
                  )}
                </h4>
                <span className="v2-required-pill v2-required-pill-optional">
                  {currentFinancialSourceLabel}
                </span>
              </div>
              <p className="v2-muted">
                {t(
                  'v2Overview.yearReviewActionsBody',
                  'Choose whether to keep the current year values, import a statement PDF, edit effective values, or restore the VEETI financial row.',
                )}
              </p>
              <div className="v2-year-card-actions">
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={handleKeepCurrentYearValues}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    'v2Overview.keepCurrentYearValues',
                    'Keep current year values',
                  )}
                </button>
                <button
                  type="button"
                  className={yearFixPrimaryClass}
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
                  onClick={handleSwitchToManualEditMode}
                  disabled={manualPatchBusy || statementImportBusy}
                >
                  {t(
                    'v2Overview.editYearData',
                    'Review / edit year data',
                  )}
                </button>
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
              </section>
            ) : null}

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

            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeManualPatchDialog}
                disabled={manualPatchBusy || statementImportBusy}
              >
                {t('common.cancel', 'Cancel')}
              </button>
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
            </div>
          </div>
        </div>
      ) : null}

      <section className="v2-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', 'Vaihe {{step}} / 6', {
                step: 3,
              })}
            </p>
            <h2>
              {t(
                'v2Overview.wizardQuestionReviewYears',
                'Mitkä vuodet ovat käyttövalmiita?',
              )}
            </h2>
          </div>
          <span className="v2-chip v2-status-provenance">
            {t('v2Overview.reviewYearsCount', '{{count}} vuotta', {
              count: reviewStatusRows.length,
            })}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">
          {t(
            'v2Overview.wizardBodyReviewYears',
            'Tarkista jokainen vuosi yhdestä paikasta. Tässä vaiheessa tarkoitus on ymmärtää vuosien tila ennen korjauksia tai rajauksia.',
          )}
        </p>

        {reviewStatusRows.length === 0 ? (
          <div className="v2-empty-state">
            <p>
              {t(
                'v2Overview.reviewYearsEmpty',
                'Valitse ainakin yksi vuosi vaiheessa 2, jotta näet vuosien käyttövalmiuden.',
              )}
            </p>
          </div>
        ) : (
          <div className="v2-year-status-list">
            {reviewStatusRows.map((row) => {
              const helperText =
                row.setupStatus === 'excluded_from_plan'
                  ? t(
                      'v2Overview.setupStatusExcludedHint',
                      'Vuosi on rajattu pois suunnitelmasta, mutta sitä ei ole poistettu työtilasta.',
                    )
                  : row.setupStatus === 'ready'
                    ? t(
                        'v2Overview.setupStatusReadyHint',
                        'Vuosi voidaan käyttää suunnittelupohjassa.',
                      )
                    : t(
                        'v2Overview.setupStatusNeedsAttentionHint',
                        'Tästä vuodesta puuttuu: {{requirements}}.',
                        {
                          requirements:
                            row.missingRequirements.length > 0
                              ? row.missingRequirements
                                  .map((item) => missingRequirementLabel(item))
                                  .join(', ')
                              : t('v2Overview.setupStatusNeedsAttention', 'Korjattava'),
                        },
                      );

              return (
                <article
                  key={row.year}
                  className={`v2-year-status-row ${row.setupStatus}`}
                >
                  <div className="v2-year-status-head">
                    <div className="v2-year-status-labels">
                      <strong>{row.year}</strong>
                      <small className="v2-muted">
                        {row.setupStatus === 'excluded_from_plan'
                          ? t(
                              'v2Overview.setupStatusExcludedShort',
                              'Ei mukana suunnittelupohjassa',
                            )
                          : sourceStatusLabel(row.sourceStatus)}
                      </small>
                    </div>
                    <span
                      className={`v2-chip ${setupStatusClassName(row.setupStatus)}`}
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
                            ? t('v2Overview.checkReady', 'OK')
                            : t('v2Overview.checkMissing', 'Puuttuu')}
                        </span>
                        <span>{setupCheckLabel(check.key)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="v2-year-status-note">{helperText}</p>

                  {row.warnings.length > 0 ? (
                    <p className="v2-muted v2-year-status-note">
                      {row.warnings
                        .map((warning) => importWarningLabel(warning))
                        .join(' ')}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        <div className="v2-overview-review-actions">
          <button
            type="button"
            className="v2-btn v2-btn-primary"
            onClick={handleContinueFromReview}
            disabled={reviewStatusRows.length === 0}
          >
            {t('v2Overview.reviewContinue', 'Jatka')}
          </button>
          <p className="v2-muted">
            {blockedYearCount > 0
              ? t(
                  'v2Overview.reviewContinueBlockedHint',
                  'Korjattava-tilassa olevat vuodet ohjataan seuraavaksi tarkempaan käsittelyyn.',
                )
              : t(
                  'v2Overview.reviewContinueReadyBody',
                  'Kun vuosien tila on ymmärretty, seuraava vaihe rakentaa suunnittelupohjan.',
                )}
          </p>
        </div>
      </section>

      <section className="v2-card">
        <div className="v2-section-header">
          <h2>{t('v2Overview.peerTitle', 'Peer snapshot')}</h2>
          <button
            type="button"
            className="v2-btn"
            onClick={handleRefreshPeer}
            disabled={refreshingPeer || !overview.latestVeetiYear}
          >
            {refreshingPeer
              ? t('v2Overview.refreshingPeer', 'Refreshing...')
              : t('v2Overview.refreshPeer', 'Refresh peer data')}
          </button>
        </div>

        {!peerSnapshot.available ? (
          <p>{peerUnavailableMessage}</p>
        ) : (
          <>
            <p>
              {t('v2Overview.peerYearLabel', 'Year')}{' '}
              <strong>{peerSnapshot.year}</strong> |{' '}
              {t('v2Overview.peerSizeClassLabel', 'size class')}{' '}
              <strong>{peerSnapshot.kokoluokka}</strong> |{' '}
              {t('v2Overview.peerOrgCountLabel', 'organizations')}{' '}
              <strong>{peerSnapshot.orgCount}</strong> |{' '}
              {t('v2Overview.peerComparisonCountLabel', 'peers')}{' '}
              <strong>{peerSnapshot.peerCount}</strong>
            </p>
            <p>
              {t('v2Overview.peerDataLabel', 'Data')}:{' '}
              <strong>
                {peerSnapshot.isStale
                  ? t('v2Overview.peerDataStale', 'Stale')
                  : t('v2Overview.peerDataFresh', 'Fresh')}
              </strong>
              {peerSnapshot.computedAt
                ? ` (${formatDateTime(peerSnapshot.computedAt)})`
                : ''}
            </p>
            <div className="v2-peer-grid">
              {(peerSnapshot.metrics ?? []).map((metric) => (
                <article key={metric.metricKey} className="v2-peer-metric">
                  <h3>{metricLabel(metric.metricKey)}</h3>
                  <p>
                    {t('v2Overview.peerYouLabel', 'You')}:{' '}
                    {formatNumber(metric.yourValue ?? 0, 2)}
                  </p>
                  <p>
                    {t('v2Overview.peerAverageLabel', 'Average')}:{' '}
                    {formatNumber(metric.avgValue ?? 0, 2)}
                  </p>
                  <p>
                    {t('v2Overview.peerMedianLabel', 'Median')}:{' '}
                    {formatNumber(metric.medianValue ?? 0, 2)}
                  </p>
                </article>
              ))}
            </div>
            <div className="v2-peer-list">
              {(peerSnapshot.peers ?? []).map((peer) => (
                <span
                  key={`${peer.veetiId}-${peer.ytunnus ?? peer.nimi ?? 'peer'}`}
                >
                  {peer.nimi ??
                    t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                      id: peer.veetiId,
                    })}{' '}
                  ({peer.ytunnus ?? '-'})
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="v2-card">
        <details>
          <summary className="v2-ops-summary">
            {t(
              'v2Overview.operationsTitle',
              'Operations and compliance context',
            )}
          </summary>
          <div className="v2-ops-grid">
            <article className="v2-subcard">
              <h3>{t('v2Overview.opsLatestYear', 'Latest baseline year')}</h3>
              <p>
                {planningContext?.operations.latestYear ?? '-'}
                {operationsLatest ? (
                  <span className="v2-muted">
                    {' '}
                    - {t('v2Overview.opsQuality', 'quality')}:{' '}
                    {operationsLatest.quality === 'complete'
                      ? t('v2Overview.yearComplete', 'complete')
                      : operationsLatest.quality === 'partial'
                      ? t('v2Overview.yearPartial', 'partial')
                      : t('v2Overview.yearMissing', 'missing')}
                  </span>
                ) : null}
              </p>
              {operationsLatest ? (
                <>
                  <p>
                    {t('v2Overview.opsInvestments', 'Investments')}:{' '}
                    <strong>
                      {formatEur(operationsLatest.investmentAmount)}
                    </strong>
                  </p>
                  <p>
                    {t('v2Overview.opsSoldVolume', 'Sold volume')}:{' '}
                    <strong>
                      {formatNumber(operationsLatest.combinedSoldVolume)} m3
                    </strong>
                  </p>
                  <p>
                    {t('v2Overview.opsPumpedVolume', 'Pumped water')}:{' '}
                    <strong>
                      {formatNumber(operationsLatest.pumpedWaterVolume)} m3
                    </strong>
                  </p>
                </>
              ) : null}
            </article>

            <article className="v2-subcard">
              <h3>{t('v2Overview.opsCompliance', 'Compliance metadata')}</h3>
              <p>
                {t('v2Overview.opsReports', 'Toimintakertomus files')}:{' '}
                <strong>
                  {planningContext?.operations.toimintakertomusCount ?? 0}
                </strong>
              </p>
              <p>
                {t('v2Overview.opsReportsLatest', 'Latest report year')}:{' '}
                <strong>
                  {planningContext?.operations.toimintakertomusLatestYear ??
                    '-'}
                </strong>
              </p>
              <p>
                {t('v2Overview.opsPermits', 'Water intake permits')}:{' '}
                <strong>
                  {planningContext?.operations.vedenottolupaCount ?? 0}
                </strong>
              </p>
              <p>
                {t('v2Overview.opsPermitsActive', 'Active permits')}:{' '}
                <strong>
                  {planningContext?.operations.activeVedenottolupaCount ?? 0}
                </strong>
              </p>
              <p>
                {t('v2Overview.opsNetworkAssets', 'Network assets')}:{' '}
                <strong>
                  {planningContext?.operations.networkAssetsCount ?? 0}
                </strong>
              </p>
            </article>

            <article className="v2-subcard">
              <h3>{t('v2Overview.opsRecentYears', 'Recent baseline years')}</h3>
              <div className="v2-peer-list">
                {recentBaselineRows.map((row) => (
                  <span key={row.year}>
                    {row.year}: {t('v2Overview.opsInvestments', 'Investments')}{' '}
                    {formatEur(row.investmentAmount)} |{' '}
                    {t('v2Overview.opsSoldVolume', 'Sold volume')}{' '}
                    {formatNumber(row.combinedSoldVolume)} m3 |{' '}
                    {t('v2Overview.opsEnergy', 'Process electricity')}{' '}
                    {formatNumber(row.processElectricity)}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </details>
      </section>
    </div>
  );
};
