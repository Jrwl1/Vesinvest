import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  completeImportYearManuallyV2,
  connectImportOrganizationV2,
  deleteImportYearV2,
  getImportStatusV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  refreshOverviewPeerV2,
  searchImportOrganizationsV2,
  syncImportV2,
  type V2ForecastScenarioListItem,
  type V2ManualYearPatchPayload,
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
  const [syncing, setSyncing] = React.useState(false);
  const [refreshingPeer, setRefreshingPeer] = React.useState(false);
  const [removingYear, setRemovingYear] = React.useState<number | null>(null);
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
  }, [pickDefaultSyncYears, t]);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSearch = React.useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    setInfo(null);
    try {
      const rows = await searchImportOrganizationsV2(query, 25);
      setSearchResults(rows);
      if (rows.length === 0) {
        setInfo(
          t(
            'v2Overview.infoNoSearchResults',
            'No organizations found. Try a business ID or a longer name.',
          ),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorSearchFailed', 'VEETI search failed.'),
      );
    } finally {
      setSearching(false);
    }
  }, [query, t]);

  const handleConnect = React.useCallback(async () => {
    if (!selectedOrg) return;
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      await connectImportOrganizationV2(selectedOrg.Id);
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
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Overview.errorConnectFailed',
              'Failed to connect VEETI organization.',
            ),
      );
    } finally {
      setSyncing(false);
    }
  }, [selectedOrg, pickDefaultSyncYears, loadOverview, t]);

  const runSync = React.useCallback(
    async (years: number[]) => {
      const result = await syncImportV2(years);
      const syncedCount = result.generatedBudgets.results.length;
      const skippedCount = result.generatedBudgets.skipped?.length ?? 0;
      if (skippedCount > 0) {
        setInfo(
          t(
            'v2Overview.infoSyncWithSkips',
            'Sync done: {{synced}} year(s) updated, {{skipped}} skipped. Check year notes below.',
            {
              synced: syncedCount,
              skipped: skippedCount,
            },
          ),
        );
      } else {
        setInfo(
          t(
            'v2Overview.infoSyncDone',
            'Sync done: {{count}} year(s) updated.',
            {
              count: syncedCount,
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

  const handleSyncRecommended = React.useCallback(async () => {
    if (recommendedYears.length === 0) return;
    setSyncing(true);
    setError(null);
    setInfo(null);
    setSelectedYears(recommendedYears);
    try {
      await runSync(recommendedYears);
    } catch (err) {
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
    (year: number, missing: MissingRequirement[]) => {
      setManualPatchYear(year);
      setManualPatchMissing(missing);
      setManualPatchError(null);
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
    },
    [],
  );

  const closeManualPatchDialog = React.useCallback(() => {
    if (manualPatchBusy) return;
    setManualPatchYear(null);
    setManualPatchMissing([]);
    setManualPatchError(null);
  }, [manualPatchBusy]);

  const submitManualPatch = React.useCallback(
    async (syncAfterSave: boolean) => {
      if (manualPatchYear == null) return;

      if (
        manualPatchMissing.includes('financials') &&
        manualFinancials.liikevaihto <= 0
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchFinancialsRequired',
            'Revenue (Liikevaihto) must be greater than zero.',
          ),
        );
        return;
      }

      if (
        manualPatchMissing.includes('prices') &&
        manualPrices.waterUnitPrice <= 0 &&
        manualPrices.wastewaterUnitPrice <= 0
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchPricesRequired',
            'At least one unit price must be greater than zero.',
          ),
        );
        return;
      }

      if (
        manualPatchMissing.includes('volumes') &&
        manualVolumes.soldWaterVolume <= 0 &&
        manualVolumes.soldWastewaterVolume <= 0
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchVolumesRequired',
            'At least one sold volume must be greater than zero.',
          ),
        );
        return;
      }

      const payload: V2ManualYearPatchPayload = {
        year: manualPatchYear,
      };

      if (manualPatchMissing.includes('financials')) {
        payload.financials = {
          ...manualFinancials,
        };
      }
      if (manualPatchMissing.includes('prices')) {
        payload.prices = {
          ...manualPrices,
        };
      }
      if (manualPatchMissing.includes('volumes')) {
        payload.volumes = {
          ...manualVolumes,
        };
      }

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const result = await completeImportYearManuallyV2(payload);
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
      manualPatchMissing,
      manualPatchYear,
      manualPrices,
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

  const { importStatus, kpis, peerSnapshot } = overview;

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
              className="v2-input"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(
                'v2Overview.searchPlaceholder',
                'Search by name or business ID',
              )}
            />
            <button
              className="v2-btn"
              type="button"
              onClick={handleSearch}
              disabled={searching || query.trim().length < 2}
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
              disabled={!selectedOrg || syncing}
            >
              {syncing
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

            {manualPatchMissing.includes('financials') ? (
              <div className="v2-manual-grid">
                <label>
                  {t(
                    'v2Overview.manualFinancialRevenue',
                    'Revenue (Liikevaihto)',
                  )}
                  <input
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

            {manualPatchMissing.includes('prices') ? (
              <div className="v2-manual-grid">
                <label>
                  {t(
                    'v2Overview.manualPriceWater',
                    'Water unit price (EUR/m3)',
                  )}
                  <input
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

            {manualPatchMissing.includes('volumes') ? (
              <div className="v2-manual-grid">
                <label>
                  {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
                  <input
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
          onClick={nextStepConfig.action}
          disabled={nextStepConfig.disabled}
        >
          {nextStepConfig.actionLabel}
        </button>
      </section>

      <section className="v2-card">
        <h2>{t('v2Overview.trendTitle', 'Your trend')}</h2>
        <div className="v2-kpi-strip">
          <article>
            <h3>{t('v2Overview.kpiRevenue', 'Revenue')}</h3>
            <p>{formatEur(kpis.revenue.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(kpis.revenue.deltaYoY)}`}
            >
              {formatEur(kpis.revenue.deltaYoY ?? 0)}{' '}
              {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiCosts', 'Costs')}</h3>
            <p>{formatEur(kpis.operatingCosts.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(
                kpis.operatingCosts.deltaYoY,
              )}`}
            >
              {formatEur(kpis.operatingCosts.deltaYoY ?? 0)}{' '}
              {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiResult', 'Result')}</h3>
            <p>{formatEur(kpis.yearResult.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(kpis.yearResult.deltaYoY)}`}
            >
              {formatEur(kpis.yearResult.deltaYoY ?? 0)}{' '}
              {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiOtherResultItems', 'Other result items')}</h3>
            <p>{formatEur(kpis.otherResultItems.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(
                kpis.otherResultItems.deltaYoY,
              )}`}
            >
              {formatEur(kpis.otherResultItems.deltaYoY ?? 0)}{' '}
              {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiVolume', 'Sold volume')}</h3>
            <p>
              {formatNumber(kpis.volume.value)} {t('v2Overview.unitM3', 'm3')}
            </p>
            <small
              className={`v2-delta ${deltaClassName(kpis.volume.deltaYoY)}`}
            >
              {formatNumber(kpis.volume.deltaYoY ?? 0)}{' '}
              {t('v2Overview.unitM3', 'm3')} {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiCombinedPrice', 'Combined price')}</h3>
            <p>{formatPrice(kpis.combinedPrice.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(
                kpis.combinedPrice.deltaYoY,
              )}`}
            >
              {formatPrice(kpis.combinedPrice.deltaYoY ?? 0)}{' '}
              {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
        </div>

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
