import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  connectImportOrganizationV2,
  getImportStatusV2,
  getOverviewV2,
  refreshOverviewPeerV2,
  searchImportOrganizationsV2,
  syncImportV2,
  type V2OverviewResponse,
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

type Props = {
  onGoToForecast: () => void;
};

type WindowFilter = 'all' | '3' | '5' | '10';

const PEER_METRIC_LABEL_KEYS: Record<string, string> = {
  liikevaihto_per_m3: 'v2Overview.peerMetricRevenuePerM3',
  vesi_yksikkohinta: 'v2Overview.peerMetricWaterUnitPrice',
  jatevesi_yksikkohinta: 'v2Overview.peerMetricWastewaterUnitPrice',
  liikevaihto: 'v2Overview.peerMetricRevenue',
};

export const OverviewPageV2: React.FC<Props> = ({ onGoToForecast }) => {
  const { t } = useTranslation();
  const [overview, setOverview] = React.useState<V2OverviewResponse | null>(
    null,
  );
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
  const [syncing, setSyncing] = React.useState(false);
  const [refreshingPeer, setRefreshingPeer] = React.useState(false);
  const [windowFilter, setWindowFilter] = React.useState<WindowFilter>('all');

  const resolveSyncBlockReason = React.useCallback(
    (row: { completeness: Record<string, boolean> }): string | null => {
      if (!row.completeness.tilinpaatos) {
        return t(
          'v2Overview.yearReasonMissingFinancials',
          'Missing financial statement data.',
        );
      }
      if (!row.completeness.taksa) {
        return t(
          'v2Overview.yearReasonMissingPrices',
          'Missing price data (taksa).',
        );
      }
      if (!row.completeness.volume_vesi && !row.completeness.volume_jatevesi) {
        return t(
          'v2Overview.yearReasonMissingVolumes',
          'Missing sold volume data.',
        );
      }
      return null;
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
      const data = await getOverviewV2();
      setOverview(data);
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

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    setError(null);
    setInfo(null);
    try {
      const result = await syncImportV2(selectedYears);
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
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Overview.errorSyncFailed', 'VEETI sync failed.'),
      );
    } finally {
      setSyncing(false);
    }
  }, [selectedYears, loadOverview, t]);

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

  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );

  const trendSeries = React.useMemo(() => {
    if (!overview) return [];
    const src = overview.trendSeries;
    if (windowFilter === 'all') return src;
    const count = Number(windowFilter);
    return src.slice(Math.max(0, src.length - count));
  }, [overview, windowFilter]);

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
              const complete =
                row.completeness.tilinpaatos &&
                (row.completeness.volume_vesi ||
                  row.completeness.volume_jatevesi);
              return (
                <span
                  key={row.vuosi}
                  className={`v2-chip ${complete ? 'ok' : 'warn'}`}
                >
                  {row.vuosi}{' '}
                  {complete
                    ? t('v2Overview.yearComplete', 'complete')
                    : t('v2Overview.yearPartial', 'partial')}
                </span>
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
              onClick={handleSync}
              disabled={
                syncing || selectedYears.length === 0 || !importStatus.connected
              }
            >
              {syncing
                ? t('v2Overview.syncingButton', 'Syncing...')
                : t('v2Overview.syncButton', '2) Sync and create budgets')}
            </button>
          </div>

          {blockedYearCount > 0 ? (
            <p className="v2-muted">
              {t(
                'v2Overview.yearSelectionHint',
                '{{count}} year(s) are not sync-ready yet. See reasons under each year.',
                { count: blockedYearCount },
              )}
            </p>
          ) : null}

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
                  onChange={() => toggleYear(row.vuosi, row.syncBlockedReason)}
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
        </article>
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
            <p>{formatEur(kpis.costs.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(kpis.costs.deltaYoY)}`}
            >
              {formatEur(kpis.costs.deltaYoY ?? 0)} {t('v2Overview.yoy', 'YoY')}
            </small>
          </article>
          <article>
            <h3>{t('v2Overview.kpiResult', 'Result')}</h3>
            <p>{formatEur(kpis.result.value)}</p>
            <small
              className={`v2-delta ${deltaClassName(kpis.result.deltaYoY)}`}
            >
              {formatEur(kpis.result.deltaYoY ?? 0)}{' '}
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

        <div className="v2-window-filter">
          {(['all', '3', '5', '10'] as const).map((key) => (
            <button
              type="button"
              key={key}
              className={`v2-btn ${
                windowFilter === key ? 'v2-btn-primary' : ''
              }`}
              onClick={() => setWindowFilter(key)}
            >
              {key === 'all'
                ? t('v2Overview.allYears', 'All years')
                : t('v2Overview.windowYears', '{{count}} y', {
                    count: Number(key),
                  })}
            </button>
          ))}
        </div>

        <div className="v2-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe2ee" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
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
                dataKey="costs"
                name={t('v2Overview.chartCosts', 'Costs')}
                stroke="#b91c1c"
                strokeWidth={2.2}
                strokeOpacity={0.9}
                dot={false}
              />
              <Line
                type="linear"
                dataKey="result"
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
          <p>
            {peerSnapshot.reason ??
              t('v2Overview.peerUnavailable', 'Peer data is not available.')}
          </p>
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

      <section className="v2-card v2-cta-card">
        <h2>{t('v2Overview.nextStepTitle', 'Next step')}</h2>
        <p>
          {t(
            'v2Overview.nextStepBody',
            'Move to Forecast to model future investments and price impact.',
          )}
        </p>
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          onClick={onGoToForecast}
        >
          {t('v2Overview.openForecast', 'Open Forecast')}
        </button>
      </section>
    </div>
  );
};
