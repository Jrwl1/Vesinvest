import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  connectImportOrganizationV2,
  getImportYearDataV2,
  deleteImportYearV2,
  getOpsFunnelV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  refreshOverviewPeerV2,
  reconcileImportYearV2,
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
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getMissingSyncRequirements,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  resolveNextBestStep,
  type MissingRequirement,
} from './overviewWorkflow';
import { sendV2OpsEvent } from './opsTelemetry';

type Props = {
  onGoToForecast: () => void;
  onGoToReports: () => void;
  isAdmin: boolean;
};

const PEER_METRIC_LABEL_KEYS: Record<string, string> = {
  liikevaihto_per_m3: 'v2Overview.peerMetricRevenuePerM3',
  vesi_yksikkohinta: 'v2Overview.peerMetricWaterUnitPrice',
  jatevesi_yksikkohinta: 'v2Overview.peerMetricWastewaterUnitPrice',
  liikevaihto: 'v2Overview.peerMetricRevenue',
};

export const OverviewPageV2: React.FC<Props> = ({
  onGoToForecast,
  onGoToReports,
  isAdmin,
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
  const [showAdvancedYearSelection, setShowAdvancedYearSelection] =
    React.useState(false);
  const [scenarioList, setScenarioList] = React.useState<
    V2ForecastScenarioListItem[] | null
  >(null);
  const [reportList, setReportList] = React.useState<V2ReportListItem[] | null>(
    null,
  );
  const [opsFunnel, setOpsFunnel] = React.useState<V2OpsFunnelSnapshot | null>(
    null,
  );
  const [connecting, setConnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [refreshingPeer, setRefreshingPeer] = React.useState(false);
  const [removingYear, setRemovingYear] = React.useState<number | null>(null);
  const searchRequestSeq = React.useRef(0);
  const blockedYearsRef = React.useRef<HTMLDivElement | null>(null);
  const [manualPatchYear, setManualPatchYear] = React.useState<number | null>(
    null,
  );
  const [manualPatchMissing, setManualPatchMissing] = React.useState<
    MissingRequirement[]
  >([]);
  const [manualPatchBusy, setManualPatchBusy] = React.useState(false);
  const [manualPatchError, setManualPatchError] = React.useState<string | null>(
    null,
  );
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
  const [trendViewMode, setTrendViewMode] = React.useState<'cards' | 'chart'>(
    'cards',
  );
  const [yearDataCache, setYearDataCache] = React.useState<
    Record<number, V2ImportYearDataResponse>
  >({});
  const [loadingYearData, setLoadingYearData] = React.useState<number | null>(
    null,
  );

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
      const years = pickDefaultSyncYears(data.importStatus.years ?? []);
      setSelectedYears(years);
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
      setSelectedYears(years);
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

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      await runSync(selectedYears);
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_sync',
        status: 'error',
        attrs: { requestedYearCount: selectedYears.length },
      });
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorSyncFailed', 'VEETI sync failed.'),
      );
    } finally {
      setSyncing(false);
    }
  }, [runSync, selectedYears, t]);

  const toggleYear = React.useCallback(
    (year: number, blockedReason: string | null) => {
      if (blockedReason) return;
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

  const yearQualityByYear = React.useMemo(() => {
    const out = new Map<number, 'complete' | 'partial' | 'missing'>();
    for (const row of overview?.importStatus.years ?? []) {
      const hasFinancials = row.completeness.tilinpaatos;
      const hasVolumes =
        row.completeness.volume_vesi || row.completeness.volume_jatevesi;
      const hasPrices = row.completeness.taksa;
      const quality =
        hasFinancials && hasVolumes && hasPrices
          ? 'complete'
          : hasFinancials || hasVolumes || hasPrices
          ? 'partial'
          : 'missing';
      out.set(row.vuosi, quality);
    }
    return out;
  }, [overview?.importStatus.years]);

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

  const handleSyncRecommended = React.useCallback(async () => {
    if (recommendedYears.length === 0) return;
    setSyncing(true);
    setError(null);
    setInfo(null);
    setSelectedYears(recommendedYears);
    try {
      await runSync(recommendedYears);
    } catch (err) {
      sendV2OpsEvent({
        event: 'veeti_sync',
        status: 'error',
        attrs: {
          requestedYearCount: recommendedYears.length,
          mode: 'recommended',
        },
      });
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorSyncFailed', 'VEETI sync failed.'),
      );
    } finally {
      setSyncing(false);
    }
  }, [recommendedYears, runSync, t]);

  const handleGuideBlockedYears = React.useCallback(() => {
    setShowAdvancedYearSelection(true);
    blockedYearsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const openManualPatchDialog = React.useCallback(
    async (year: number, missing: MissingRequirement[]) => {
      const toNumber = (value: unknown): number => {
        const parsed = Number(String(value ?? '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
      };

      setManualPatchYear(year);
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

        const getFirstRow = (dataType: string) =>
          yearData.datasets.find((row) => row.dataType === dataType)
            ?.effectiveRows?.[0] ?? {};

        const financials = getFirstRow('tilinpaatos');
        const taksaRows =
          yearData.datasets.find((row) => row.dataType === 'taksa')
            ?.effectiveRows ?? [];
        const waterPriceRow = taksaRows.find(
          (row) => toNumber((row as any).Tyyppi_Id) === 1,
        ) as Record<string, unknown> | undefined;
        const wastewaterPriceRow = taksaRows.find(
          (row) => toNumber((row as any).Tyyppi_Id) === 2,
        ) as Record<string, unknown> | undefined;
        const waterVolume = getFirstRow('volume_vesi');
        const wastewaterVolume = getFirstRow('volume_jatevesi');
        const investments = getFirstRow('investointi');
        const energy = getFirstRow('energia');
        const network = getFirstRow('verkko');

        setManualFinancials({
          liikevaihto: toNumber((financials as any).Liikevaihto),
          henkilostokulut: toNumber((financials as any).Henkilostokulut),
          liiketoiminnanMuutKulut: toNumber(
            (financials as any).LiiketoiminnanMuutKulut,
          ),
          poistot: toNumber((financials as any).Poistot),
          arvonalentumiset: toNumber((financials as any).Arvonalentumiset),
          rahoitustuototJaKulut: toNumber(
            (financials as any).RahoitustuototJaKulut,
          ),
          tilikaudenYliJaama: toNumber((financials as any).TilikaudenYliJaama),
          omistajatuloutus: toNumber((financials as any).Omistajatuloutus),
          omistajanTukiKayttokustannuksiin: toNumber(
            (financials as any).OmistajanTukiKayttokustannuksiin,
          ),
        });
        setManualPrices({
          waterUnitPrice: toNumber((waterPriceRow as any)?.Kayttomaksu),
          wastewaterUnitPrice: toNumber(
            (wastewaterPriceRow as any)?.Kayttomaksu,
          ),
        });
        setManualVolumes({
          soldWaterVolume: toNumber((waterVolume as any).Maara),
          soldWastewaterVolume: toNumber((wastewaterVolume as any).Maara),
        });
        setManualInvestments({
          investoinninMaara: toNumber((investments as any).InvestoinninMaara),
          korvausInvestoinninMaara: toNumber(
            (investments as any).KorvausInvestoinninMaara,
          ),
        });
        setManualEnergy({
          prosessinKayttamaSahko: toNumber(
            (energy as any).ProsessinKayttamaSahko,
          ),
        });
        setManualNetwork({
          verkostonPituus: toNumber((network as any).VerkostonPituus),
        });

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
    if (manualPatchBusy) return;
    setManualPatchYear(null);
    setManualPatchMissing([]);
    setManualPatchError(null);
    setManualReason('');
  }, [manualPatchBusy]);

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

      const payload: V2ManualYearPatchPayload = {
        year: manualPatchYear,
        financials: {
          ...manualFinancials,
        },
        prices: {
          ...manualPrices,
        },
        volumes: {
          ...manualVolumes,
        },
        investments: {
          ...manualInvestments,
        },
        energy: {
          ...manualEnergy,
        },
        network: {
          ...manualNetwork,
        },
        reason: manualReason.trim() || undefined,
      };

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
      manualPatchMissing,
      manualPatchYear,
      manualPrices,
      manualReason,
      manualVolumes,
      runSync,
      t,
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

  const trendSeries = overview?.trendSeries ?? [];

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

  const ensureYearDataLoaded = React.useCallback(
    async (year: number) => {
      if (yearDataCache[year]) return yearDataCache[year];
      setLoadingYearData(year);
      try {
        const data = await getImportYearDataV2(year);
        setYearDataCache((prev) => ({ ...prev, [year]: data }));
        return data;
      } finally {
        setLoadingYearData((current) => (current === year ? null : current));
      }
    },
    [yearDataCache],
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
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.reconcileFailed',
                'Failed to apply VEETI values for the selected year.',
              ),
        );
      }
    },
    [loadOverview, t],
  );

  const metricLabel = React.useCallback(
    (metricKey: string) =>
      t(PEER_METRIC_LABEL_KEYS[metricKey] ?? metricKey, metricKey),
    [t],
  );

  const deltaClassName = React.useCallback((value: number | null) => {
    if (value === null || Number.isNaN(value)) return 'v2-delta-neutral';
    if (value > 0) return 'v2-delta-positive';
    if (value < 0) return 'v2-delta-negative';
    return 'v2-delta-neutral';
  }, []);

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
  const showFinancialSection =
    showAllManualSections || manualPatchMissing.includes('financials');
  const showPricesSection =
    showAllManualSections || manualPatchMissing.includes('prices');
  const showVolumesSection =
    showAllManualSections || manualPatchMissing.includes('volumes');

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

  const scenarioCount = scenarioList?.length ?? null;
  const computedScenarioCount = scenarioList
    ? scenarioList.filter((row) => row.computedYears > 0).length
    : null;
  const reportCount = reportList?.length ?? null;

  const nextBestStep = resolveNextBestStep({
    connected: importStatus.connected,
    canCreateScenario: hasBaselineBudget,
    readyYearCount: readyYearRows.length,
    blockedYearCount,
    scenarioCount,
    computedScenarioCount,
    reportCount,
  });

  const peerUnavailableMessage =
    peerSnapshot.reason === 'No VEETI years imported.'
      ? t('v2Overview.peerNoImportedYears', 'No imported VEETI years yet.')
      : t('v2Overview.peerUnavailable', 'Peer data is not available.');

  const yearInfoByYear = React.useMemo(
    () =>
      new Map<number, (typeof importStatus.years)[number]>(
        (importStatus.years ?? []).map((row) => [row.vuosi, row]),
      ),
    [importStatus.years],
  );

  const trendCards = React.useMemo(() => {
    return [...trendSeries]
      .sort((a, b) => a.year - b.year)
      .map((row, index, arr) => {
        const prev = index > 0 ? arr[index - 1] : null;
        const yearInfo = yearInfoByYear.get(row.year);
        return {
          ...row,
          deltas: {
            revenue: prev ? row.revenue - prev.revenue : null,
            operatingCosts: prev
              ? row.operatingCosts - prev.operatingCosts
              : null,
            yearResult: prev ? row.yearResult - prev.yearResult : null,
            volume: prev ? row.volume - prev.volume : null,
            combinedPrice: prev ? row.combinedPrice - prev.combinedPrice : null,
          },
          sourceStatus: yearInfo?.sourceStatus ?? 'INCOMPLETE',
          sourceBreakdown: yearInfo?.sourceBreakdown,
          manualEditedAt: yearInfo?.manualEditedAt ?? null,
          manualEditedBy: yearInfo?.manualEditedBy ?? null,
          manualReason: yearInfo?.manualReason ?? null,
        };
      })
      .reverse();
  }, [trendSeries, yearInfoByYear]);

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => {
      if (status === 'VEETI') return t('v2Overview.sourceVeeti', 'VEETI');
      if (status === 'MANUAL') return t('v2Overview.sourceManual', 'Manual');
      if (status === 'MIXED') return t('v2Overview.sourceMixed', 'Mixed');
      return t('v2Overview.sourceIncomplete', 'Incomplete');
    },
    [t],
  );

  const nextStepConfig: {
    title: string;
    body: string;
    actionLabel: string;
    action: () => void;
    disabled: boolean;
  } = (() => {
    if (nextBestStep === 'connect_org') {
      return {
        title: t(
          'v2Overview.nextStepConnectTitle',
          'Connect your VEETI organization',
        ),
        body: t(
          'v2Overview.nextStepConnectBody',
          'Search your organization by name or business ID, select it, then connect.',
        ),
        actionLabel: t('v2Overview.connectButton', '1) Connect organization'),
        action: handleConnect,
        disabled: !selectedOrg || syncing,
      };
    }
    if (nextBestStep === 'sync_ready_years') {
      return {
        title: t('v2Overview.nextStepSyncTitle', 'Sync recommended years'),
        body: t(
          'v2Overview.nextStepSyncBody',
          'Import the latest sync-ready VEETI years to create baseline budgets.',
        ),
        actionLabel: t(
          'v2Overview.nextStepSyncAction',
          'Sync recommended years',
        ),
        action: handleSyncRecommended,
        disabled: syncing || recommendedYears.length === 0,
      };
    }
    if (nextBestStep === 'fix_blocked_years') {
      return {
        title: t('v2Overview.nextStepFixTitle', 'Fix blocked years'),
        body: t(
          'v2Overview.nextStepFixBody',
          'Some years are blocked because required VEETI datasets are missing. Review missing fields and complete data before syncing again.',
        ),
        actionLabel: t('v2Overview.nextStepFixAction', 'Review blocked years'),
        action: handleGuideBlockedYears,
        disabled: blockedYearRows.length === 0,
      };
    }
    if (nextBestStep === 'create_first_scenario') {
      return {
        title: t(
          'v2Overview.nextStepScenarioTitle',
          'Create your first scenario',
        ),
        body: t(
          'v2Overview.nextStepScenarioBody',
          'Open Forecast and create your first scenario from synced baseline data.',
        ),
        actionLabel: t('v2Overview.openForecast', 'Open Forecast'),
        action: onGoToForecast,
        disabled: false,
      };
    }
    if (nextBestStep === 'compute_scenario') {
      return {
        title: t('v2Overview.nextStepComputeTitle', 'Compute your scenario'),
        body: t(
          'v2Overview.nextStepComputeBody',
          'Open Forecast and compute a scenario to generate updated result paths.',
        ),
        actionLabel: t('v2Overview.openForecast', 'Open Forecast'),
        action: onGoToForecast,
        disabled: false,
      };
    }
    if (nextBestStep === 'create_first_report') {
      return {
        title: t('v2Overview.nextStepReportTitle', 'Create your first report'),
        body: t(
          'v2Overview.nextStepReportBody',
          'Open Forecast, compute the selected scenario, and create a report.',
        ),
        actionLabel: t('v2Overview.openForecast', 'Open Forecast'),
        action: onGoToForecast,
        disabled: false,
      };
    }
    if (nextBestStep === 'review_reports') {
      return {
        title: t('v2Overview.nextStepReviewTitle', 'Review reports'),
        body: t(
          'v2Overview.nextStepReviewBody',
          'Open Reports to review generated outputs and share PDF artifacts.',
        ),
        actionLabel: t('v2Overview.openReports', 'Open Reports'),
        action: onGoToReports,
        disabled: false,
      };
    }
    return {
      title: t('v2Overview.nextStepTitle', 'Next step'),
      body: t(
        'v2Overview.nextStepBody',
        'Move to Forecast to model future investments and price impact.',
      ),
      actionLabel: t('v2Overview.openForecast', 'Open Forecast'),
      action: onGoToForecast,
      disabled: false,
    };
  })();

  return (
    <div className="v2-page overview-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-grid v2-grid-two">
        <article className="v2-card">
          <h2>{t('v2Overview.dataStatusTitle', 'Data status')}</h2>
          <p>
            {t('v2Overview.connectionLabel', 'VEETI connection')}:{' '}
            <strong>
              {importStatus.connected
                ? t('v2Overview.connected', 'Connected')
                : t('v2Overview.disconnected', 'Not connected')}
            </strong>
          </p>
          <p>
            {t('v2Overview.organizationLabel', 'Organization')}:{' '}
            <strong>{importStatus.link?.nimi ?? '-'}</strong>
          </p>
          <p>
            {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
            <strong>{importStatus.link?.ytunnus ?? '-'}</strong>
          </p>
          <p>
            {t('v2Overview.lastFetchLabel', 'Last fetch')}:{' '}
            <strong>{formatDateTime(importStatus.link?.lastFetchedAt)}</strong>
          </p>
          <div className="v2-year-chips">
            {(importStatus.years ?? []).map((row) => {
              const complete = isSyncReadyYear(row);
              return (
                <div
                  key={row.vuosi}
                  className={`v2-chip-row ${complete ? 'ok' : 'warn'}`}
                >
                  <span className={`v2-chip ${complete ? 'ok' : 'warn'}`}>
                    {row.vuosi}{' '}
                    {complete
                      ? t('v2Overview.yearComplete', 'complete')
                      : t('v2Overview.yearPartial', 'partial')}
                    {' • '}
                    {sourceStatusLabel(row.sourceStatus)}
                  </span>
                  <button
                    type="button"
                    className="v2-chip-remove"
                    onClick={() => handleDeleteYear(row.vuosi)}
                    disabled={removingYear === row.vuosi}
                  >
                    {removingYear === row.vuosi
                      ? t('v2Overview.removingYear', 'Removing...')
                      : t('v2Overview.removeYear', 'Remove')}
                  </button>
                </div>
              );
            })}
          </div>

          {isAdmin && opsFunnel ? (
            <div className="v2-ops-snapshot">
              <h3>{t('v2Overview.opsSnapshotTitle', 'Ops snapshot')}</h3>
              <p>
                {t('v2Overview.opsSnapshotOrg', 'Org funnel')}:{' '}
                {opsFunnel.organization.connected
                  ? t('v2Overview.connected', 'Connected')
                  : t('v2Overview.disconnected', 'Not connected')}
                {' -> '}
                {opsFunnel.organization.veetiBudgetCount}{' '}
                {t('v2Overview.opsSnapshotBudgets', 'VEETI budgets')}
                {' -> '}
                {opsFunnel.organization.scenarioCount}{' '}
                {t('v2Overview.opsSnapshotScenarios', 'scenarios')}
                {' -> '}
                {opsFunnel.organization.reportCount}{' '}
                {t('v2Overview.opsSnapshotReports', 'reports')}
              </p>
              <p className="v2-muted">
                {t('v2Overview.opsSnapshotSystem', 'System')}:{' '}
                {opsFunnel.system.connectedOrgCount}/{opsFunnel.system.orgCount}{' '}
                {t('v2Overview.opsSnapshotConnectedOrgs', 'connected orgs')},{' '}
                {opsFunnel.system.importedOrgCount}{' '}
                {t('v2Overview.opsSnapshotImportedOrgs', 'imported orgs')},{' '}
                {opsFunnel.system.scenarioOrgCount}{' '}
                {t('v2Overview.opsSnapshotScenarioOrgs', 'scenario orgs')}
              </p>
            </div>
          ) : null}
        </article>

        <article className="v2-card">
          <h2>{t('v2Overview.importTitle', 'Import VEETI')}</h2>
          {!importStatus.connected ? (
            <p className="v2-muted">
              {t(
                'v2Overview.connectHelp',
                'Step 1: search and connect your organization. Step 2: sync eligible years.',
              )}
            </p>
          ) : null}
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
              disabled={connecting || syncing}
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
                searching || connecting || syncing || query.trim().length < 2
              }
            >
              {searching
                ? t('v2Overview.searchingButton', 'Searching...')
                : t('v2Overview.searchButton', 'Search')}
            </button>
          </div>
          <div className="v2-result-list">
            {searchResults.map((org) => (
              <button
                type="button"
                key={org.Id}
                className={`v2-result-row ${
                  selectedOrg?.Id === org.Id ? 'active' : ''
                }`}
                onClick={() => setSelectedOrg(org)}
              >
                <strong>
                  {org.Nimi ??
                    t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                      id: org.Id,
                    })}
                </strong>
                <span>{org.YTunnus ?? '-'}</span>
              </button>
            ))}
          </div>

          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn"
              onClick={handleConnect}
              disabled={
                !selectedOrgStillVisible || searching || connecting || syncing
              }
            >
              {connecting
                ? t('v2Overview.connectingButton', 'Connecting...')
                : t('v2Overview.connectButton', '1) Connect organization')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={
                showAdvancedYearSelection ? handleSync : handleSyncRecommended
              }
              disabled={
                connecting ||
                syncing ||
                !importStatus.connected ||
                (showAdvancedYearSelection
                  ? selectedYears.length === 0
                  : recommendedYears.length === 0)
              }
            >
              {syncing
                ? t('v2Overview.syncingButton', 'Syncing...')
                : showAdvancedYearSelection
                ? t('v2Overview.syncButton', '2) Sync and create budgets')
                : t(
                    'v2Overview.syncRecommendedButton',
                    '2) Sync recommended years',
                  )}
            </button>
          </div>

          {importStatus.connected && recommendedYears.length > 0 ? (
            <p className="v2-muted">
              {t(
                'v2Overview.recommendedYearsHint',
                'Recommended years: {{years}}',
                {
                  years: recommendedYears.join(', '),
                },
              )}
            </p>
          ) : null}

          {blockedYearCount > 0 ? (
            <p className="v2-muted">
              {t(
                'v2Overview.yearSelectionHint',
                '{{count}} year(s) are not sync-ready yet. See reasons under each year.',
                { count: blockedYearCount },
              )}
            </p>
          ) : null}

          {blockedYearRows.length > 0 ? (
            <div className="v2-blocked-years" ref={blockedYearsRef}>
              <h3>{t('v2Overview.blockedYearsTitle', 'Blocked years')}</h3>
              {blockedYearRows.map((row) => {
                const missing = getMissingSyncRequirements(row);
                return (
                  <div key={row.vuosi} className="v2-blocked-year-row">
                    <strong>{row.vuosi}</strong>
                    <span>
                      {missing
                        .map((item) => missingRequirementLabel(item))
                        .join(', ')}
                    </span>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="v2-btn v2-btn-small"
                        onClick={() =>
                          openManualPatchDialog(row.vuosi, missing)
                        }
                      >
                        {t('v2Overview.manualPatchButton', 'Complete manually')}
                      </button>
                    ) : null}
                  </div>
                );
              })}
              <p className="v2-muted">
                {t(
                  'v2Overview.blockedYearsHelp',
                  'Complete missing fields in VEETI for these years, then run sync again.',
                )}
              </p>
              {!isAdmin ? (
                <p className="v2-muted">
                  {t(
                    'v2Overview.manualPatchAdminOnlyHint',
                    'Manual completion is available for admins only.',
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {importStatus.connected ? (
            <button
              type="button"
              className="v2-btn"
              onClick={() => setShowAdvancedYearSelection((prev) => !prev)}
            >
              {showAdvancedYearSelection
                ? t(
                    'v2Overview.hideAdvancedYears',
                    'Hide advanced year selection',
                  )
                : t(
                    'v2Overview.showAdvancedYears',
                    'Choose years manually (advanced)',
                  )}
            </button>
          ) : null}

          {showAdvancedYearSelection ? (
            <div className="v2-year-select">
              {syncYearRows.map((row) => (
                <label
                  key={row.vuosi}
                  className={
                    row.syncBlockedReason ? 'v2-year-select-disabled' : ''
                  }
                  title={row.syncBlockedReason ?? undefined}
                >
                  <input
                    type="checkbox"
                    name={`syncYear-${row.vuosi}`}
                    checked={selectedYears.includes(row.vuosi)}
                    onChange={() =>
                      toggleYear(row.vuosi, row.syncBlockedReason)
                    }
                    disabled={Boolean(row.syncBlockedReason)}
                  />
                  {row.vuosi}
                  {row.syncBlockedReason ? (
                    <small className="v2-year-reason">
                      {row.syncBlockedReason}
                    </small>
                  ) : null}
                </label>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      {manualPatchYear != null ? (
        <div className="v2-modal-backdrop" role="dialog" aria-modal="true">
          <div className="v2-modal-card">
            <h3>
              {t(
                'v2Overview.manualPatchTitle',
                'Complete year {{year}} manually',
                { year: manualPatchYear },
              )}
            </h3>
            <p className="v2-muted">
              {t(
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

            {showFinancialSection ? (
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
                  {t('v2Overview.manualFinancialPersonnel', 'Personnel costs')}
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
                  {t('v2Overview.manualFinancialDepreciation', 'Depreciation')}
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
                        rahoitustuototJaKulut: Number(event.target.value || 0),
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
            ) : null}

            {showPricesSection ? (
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
            ) : null}

            {showVolumesSection ? (
              <div className="v2-manual-grid">
                <label>
                  {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
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
            ) : null}

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
                      korvausInvestoinninMaara: Number(event.target.value || 0),
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

            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeManualPatchDialog}
                disabled={manualPatchBusy}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="v2-btn"
                onClick={() => submitManualPatch(false)}
                disabled={manualPatchBusy}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : t('v2Overview.manualPatchSave', 'Save year data')}
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-primary"
                onClick={() => submitManualPatch(true)}
                disabled={manualPatchBusy}
              >
                {manualPatchBusy
                  ? t('common.loading', 'Loading...')
                  : t(
                      'v2Overview.manualPatchSaveAndSync',
                      'Save and sync year',
                    )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="v2-card v2-cta-card">
        <h2>{nextStepConfig.title}</h2>
        <p>{nextStepConfig.body}</p>
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          onClick={() => {
            sendV2OpsEvent({
              event: 'next_best_step_click',
              status: 'ok',
              attrs: { step: nextBestStep },
            });
            nextStepConfig.action();
          }}
          disabled={nextStepConfig.disabled}
        >
          {nextStepConfig.actionLabel}
        </button>
      </section>

      <section className="v2-card">
        <div className="v2-section-header">
          <h2>{t('v2Overview.trendTitle', 'Your trend')}</h2>
          <div className="v2-view-toggle" role="group" aria-label="Trend view">
            <button
              type="button"
              className={`v2-btn ${
                trendViewMode === 'cards' ? 'v2-btn-primary' : ''
              }`}
              onClick={() => setTrendViewMode('cards')}
            >
              {t('v2Overview.trendCardsView', 'Year cards')}
            </button>
            <button
              type="button"
              className={`v2-btn ${
                trendViewMode === 'chart' ? 'v2-btn-primary' : ''
              }`}
              onClick={() => setTrendViewMode('chart')}
            >
              {t('v2Overview.trendChartView', 'Chart')}
            </button>
          </div>
        </div>

        {trendViewMode === 'cards' ? (
          <div className="v2-year-cards-grid">
            {trendCards.map((row) => {
              const cachedYearData = yearDataCache[row.year];
              const reconcileTypes =
                cachedYearData?.datasets
                  .filter((item) => item.reconcileNeeded)
                  .map((item) => item.dataType) ?? [];

              return (
                <article key={row.year} className="v2-year-card">
                  <header className="v2-year-card-header">
                    <h3>{row.year}</h3>
                    <span className="v2-chip">
                      {sourceStatusLabel(row.sourceStatus)}
                    </span>
                  </header>

                  <div className="v2-year-card-metrics">
                    <div>
                      <strong>{t('v2Overview.kpiRevenue', 'Revenue')}</strong>
                      <p>{formatEur(row.revenue)}</p>
                      <small
                        className={`v2-delta ${deltaClassName(
                          row.deltas.revenue,
                        )}`}
                      >
                        {formatEur(row.deltas.revenue ?? 0)}{' '}
                        {t('v2Overview.yoy', 'YoY')}
                      </small>
                    </div>
                    <div>
                      <strong>{t('v2Overview.kpiCosts', 'Costs')}</strong>
                      <p>{formatEur(row.operatingCosts)}</p>
                      <small
                        className={`v2-delta ${deltaClassName(
                          row.deltas.operatingCosts,
                        )}`}
                      >
                        {formatEur(row.deltas.operatingCosts ?? 0)}{' '}
                        {t('v2Overview.yoy', 'YoY')}
                      </small>
                    </div>
                    <div>
                      <strong>{t('v2Overview.kpiResult', 'Result')}</strong>
                      <p>{formatEur(row.yearResult)}</p>
                      <small
                        className={`v2-delta ${deltaClassName(
                          row.deltas.yearResult,
                        )}`}
                      >
                        {formatEur(row.deltas.yearResult ?? 0)}{' '}
                        {t('v2Overview.yoy', 'YoY')}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {t('v2Overview.kpiVolume', 'Sold volume')}
                      </strong>
                      <p>{formatNumber(row.volume)} m3</p>
                      <small
                        className={`v2-delta ${deltaClassName(
                          row.deltas.volume,
                        )}`}
                      >
                        {formatNumber(row.deltas.volume ?? 0)} m3{' '}
                        {t('v2Overview.yoy', 'YoY')}
                      </small>
                    </div>
                    <div>
                      <strong>
                        {t('v2Overview.kpiCombinedPrice', 'Combined price')}
                      </strong>
                      <p>{formatPrice(row.combinedPrice)}</p>
                      <small
                        className={`v2-delta ${deltaClassName(
                          row.deltas.combinedPrice,
                        )}`}
                      >
                        {formatPrice(row.deltas.combinedPrice ?? 0)}{' '}
                        {t('v2Overview.yoy', 'YoY')}
                      </small>
                    </div>
                  </div>

                  <div className="v2-year-card-actions">
                    {isAdmin ? (
                      <button
                        type="button"
                        className="v2-btn v2-btn-small"
                        onClick={() => openManualPatchDialog(row.year, [])}
                      >
                        {t('v2Overview.editYearData', 'Edit year data')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={() => ensureYearDataLoaded(row.year)}
                      disabled={loadingYearData === row.year}
                    >
                      {loadingYearData === row.year
                        ? t('common.loading', 'Loading...')
                        : t('v2Overview.showProvenance', 'Show provenance')}
                    </button>
                    {isAdmin && reconcileTypes.length > 0 ? (
                      <button
                        type="button"
                        className="v2-btn v2-btn-small"
                        onClick={() =>
                          handleApplyVeetiReconcile(row.year, reconcileTypes)
                        }
                      >
                        {t('v2Overview.applyVeetiValues', 'Apply VEETI values')}
                      </button>
                    ) : null}
                  </div>

                  <details>
                    <summary>
                      {t('v2Overview.provenanceTitle', 'Data provenance')}
                    </summary>
                    <p>
                      {t('v2Overview.sourceLabel', 'Source')}:{' '}
                      <strong>{sourceStatusLabel(row.sourceStatus)}</strong>
                    </p>
                    <p>
                      VEETI:{' '}
                      {(row.sourceBreakdown?.veetiDataTypes ?? []).join(', ') ||
                        '-'}
                    </p>
                    <p>
                      {t('v2Overview.manualOverridesLabel', 'Manual overrides')}
                      :{' '}
                      {(row.sourceBreakdown?.manualDataTypes ?? []).join(
                        ', ',
                      ) || '-'}
                    </p>
                    {row.manualEditedAt ? (
                      <p>
                        {t('v2Overview.manualEditedAt', 'Manual update')}:{' '}
                        {formatDateTime(row.manualEditedAt)}
                        {row.manualEditedBy ? ` - ${row.manualEditedBy}` : ''}
                      </p>
                    ) : null}
                    {row.manualReason ? (
                      <p>
                        {t('v2Overview.manualReason', 'Reason')}:{' '}
                        {row.manualReason}
                      </p>
                    ) : null}
                    {cachedYearData ? (
                      <div className="v2-peer-list">
                        {cachedYearData.datasets.map((dataset) => (
                          <span key={`${row.year}-${dataset.dataType}`}>
                            {dataset.dataType}: {dataset.source}
                            {dataset.reconcileNeeded
                              ? ' (reconcile available)'
                              : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </details>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="v2-chart-wrap">
            {trendSeries.length > 0 ? (
              <p className="v2-muted v2-trend-quality-note">
                {t(
                  'v2Overview.resultFormulaNote',
                  'Result comes from VEETI year result (TilikaudenYlijäämä). Other result items reconcile revenue, operating costs, and result.',
                )}
              </p>
            ) : null}
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ee" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => {
                    const year = Number(value);
                    const quality = yearQualityByYear.get(year);
                    if (quality === 'partial') {
                      return `${year} (${t(
                        'v2Overview.yearPartial',
                        'partial',
                      )})`;
                    }
                    if (quality === 'missing') {
                      return `${year} (${t(
                        'v2Overview.yearMissing',
                        'missing',
                      )})`;
                    }
                    return `${year}`;
                  }}
                />
                <Legend />
                <Line
                  type="linear"
                  dataKey="revenue"
                  name={t('v2Overview.chartRevenue', 'Revenue')}
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="operatingCosts"
                  name={t('v2Overview.chartCosts', 'Operating costs')}
                  stroke="#b91c1c"
                  strokeWidth={2.2}
                  strokeOpacity={0.9}
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="yearResult"
                  name={t('v2Overview.chartResult', 'Result')}
                  stroke="#1d4ed8"
                  strokeWidth={2.4}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
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
                    {t('v2Overview.peerAverageLabel', 'Medeltal')}:{' '}
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
