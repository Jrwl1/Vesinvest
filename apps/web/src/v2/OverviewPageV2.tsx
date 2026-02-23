import React from 'react';
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
import { formatEur, formatNumber, formatPrice } from './format';
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

export const OverviewPageV2: React.FC<Props> = ({ onGoToForecast }) => {
  const [overview, setOverview] = React.useState<V2OverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<VeetiOrganizationSearchHit[]>([]);
  const [selectedOrg, setSelectedOrg] = React.useState<VeetiOrganizationSearchHit | null>(null);

  const [selectedYears, setSelectedYears] = React.useState<number[]>([]);
  const [syncing, setSyncing] = React.useState(false);
  const [refreshingPeer, setRefreshingPeer] = React.useState(false);
  const [windowFilter, setWindowFilter] = React.useState<WindowFilter>('all');

  const loadOverview = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOverviewV2();
      setOverview(data);
      const years = [...(data.importStatus.years ?? [])]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi);
      setSelectedYears(years);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Overviewin lataus epaonnistui.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSearch = React.useCallback(async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const rows = await searchImportOrganizationsV2(query, 25);
      setSearchResults(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VEETI-haku epaonnistui.');
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleConnect = React.useCallback(async () => {
    if (!selectedOrg) return;
    setSyncing(true);
    setError(null);
    try {
      await connectImportOrganizationV2(selectedOrg.Id);
      const status = await getImportStatusV2();
      const years = [...(status.years ?? [])]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((item) => item.vuosi);
      setSelectedYears(years);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VEETI-yhteyden avaus epaonnistui.');
    } finally {
      setSyncing(false);
    }
  }, [selectedOrg, loadOverview]);

  const handleSync = React.useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncImportV2(selectedYears);
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'VEETI-synkronointi epaonnistui.');
    } finally {
      setSyncing(false);
    }
  }, [selectedYears, loadOverview]);

  const toggleYear = React.useCallback((year: number) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) return prev.filter((item) => item !== year);
      return [...prev, year].sort((a, b) => a - b);
    });
  }, []);

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
      setError(err instanceof Error ? err.message : 'Vertailudatan paivitys epaonnistui.');
    } finally {
      setRefreshingPeer(false);
    }
  }, [overview?.latestVeetiYear, loadOverview]);

  if (loading) return <div className="v2-loading">Ladataan overview...</div>;
  if (!overview) return <div className="v2-error">Overview-dataa ei saatu ladattua.</div>;

  const { importStatus, kpis, peerSnapshot } = overview;

  return (
    <div className="v2-page overview-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section className="v2-grid v2-grid-two">
        <article className="v2-card">
          <h2>Data Status</h2>
          <p>
            VEETI-yhteys: <strong>{importStatus.connected ? 'Yhdistetty' : 'Ei yhdistetty'}</strong>
          </p>
          <p>
            Organisaatio: <strong>{importStatus.link?.nimi ?? '-'}</strong>
          </p>
          <p>
            Y-tunnus: <strong>{importStatus.link?.ytunnus ?? '-'}</strong>
          </p>
          <p>
            Viimeisin haku:{' '}
            <strong>
              {importStatus.link?.lastFetchedAt
                ? new Date(importStatus.link.lastFetchedAt).toLocaleString('fi-FI')
                : '-'}
            </strong>
          </p>
          <div className="v2-year-chips">
            {(importStatus.years ?? []).map((row) => {
              const complete = row.completeness.tilinpaatos && (row.completeness.volume_vesi || row.completeness.volume_jatevesi);
              return (
                <span key={row.vuosi} className={`v2-chip ${complete ? 'ok' : 'warn'}`}>
                  {row.vuosi} {complete ? 'ok' : 'osittainen'}
                </span>
              );
            })}
          </div>
        </article>

        <article className="v2-card">
          <h2>Import VEETI</h2>
          <div className="v2-inline-form">
            <input
              className="v2-input"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hae nimella tai Y-tunnuksella"
            />
            <button className="v2-btn" type="button" onClick={handleSearch} disabled={searching || query.trim().length < 2}>
              {searching ? 'Haetaan...' : 'Hae'}
            </button>
          </div>
          <div className="v2-result-list">
            {searchResults.map((org) => (
              <button
                type="button"
                key={org.Id}
                className={`v2-result-row ${selectedOrg?.Id === org.Id ? 'active' : ''}`}
                onClick={() => setSelectedOrg(org)}
              >
                <strong>{org.Nimi ?? `VEETI ${org.Id}`}</strong>
                <span>{org.YTunnus ?? '-'}</span>
              </button>
            ))}
          </div>

          <div className="v2-actions-row">
            <button type="button" className="v2-btn" onClick={handleConnect} disabled={!selectedOrg || syncing}>
              {syncing ? 'Yhdistetaan...' : '1) Yhdista organisaatio'}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={handleSync}
              disabled={syncing || selectedYears.length === 0}
            >
              {syncing ? 'Synkronoidaan...' : '2) Synkronoi ja luo budjetit'}
            </button>
          </div>

          <div className="v2-year-select">
            {(importStatus.years ?? []).map((row) => (
              <label key={row.vuosi}>
                <input
                  type="checkbox"
                  checked={selectedYears.includes(row.vuosi)}
                  onChange={() => toggleYear(row.vuosi)}
                />
                {row.vuosi}
              </label>
            ))}
          </div>
        </article>
      </section>

      <section className="v2-card">
        <h2>Oman toiminnan trendit</h2>
        <div className="v2-kpi-strip">
          <article>
            <h3>Liikevaihto</h3>
            <p>{formatEur(kpis.revenue.value)}</p>
            <small>{formatEur(kpis.revenue.deltaYoY ?? 0)} YoY</small>
          </article>
          <article>
            <h3>Kulut</h3>
            <p>{formatEur(kpis.costs.value)}</p>
            <small>{formatEur(kpis.costs.deltaYoY ?? 0)} YoY</small>
          </article>
          <article>
            <h3>Tulos</h3>
            <p>{formatEur(kpis.result.value)}</p>
            <small>{formatEur(kpis.result.deltaYoY ?? 0)} YoY</small>
          </article>
          <article>
            <h3>Myyty maara</h3>
            <p>{formatNumber(kpis.volume.value)} m3</p>
            <small>{formatNumber(kpis.volume.deltaYoY ?? 0)} m3 YoY</small>
          </article>
          <article>
            <h3>Yhdistetty hinta</h3>
            <p>{formatPrice(kpis.combinedPrice.value)}</p>
            <small>{formatPrice(kpis.combinedPrice.deltaYoY ?? 0)} YoY</small>
          </article>
        </div>

        <div className="v2-window-filter">
          {(['all', '3', '5', '10'] as const).map((key) => (
            <button
              type="button"
              key={key}
              className={`v2-btn ${windowFilter === key ? 'v2-btn-primary' : ''}`}
              onClick={() => setWindowFilter(key)}
            >
              {key === 'all' ? 'Kaikki vuodet' : `${key} v`}
            </button>
          ))}
        </div>

        <div className="v2-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Liikevaihto" stroke="#0f766e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="costs" name="Kulut" stroke="#b91c1c" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="result" name="Tulos" stroke="#1d4ed8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="v2-card">
        <div className="v2-section-header">
          <h2>Peer Snapshot</h2>
          <button type="button" className="v2-btn" onClick={handleRefreshPeer} disabled={refreshingPeer || !overview.latestVeetiYear}>
            {refreshingPeer ? 'Paivitetaan...' : 'Paivita vertailudata'}
          </button>
        </div>

        {!peerSnapshot.available ? (
          <p>{peerSnapshot.reason ?? 'Vertailudataa ei ole saatavilla.'}</p>
        ) : (
          <>
            <p>
              Vuosi <strong>{peerSnapshot.year}</strong> | kokoluokka <strong>{peerSnapshot.kokoluokka}</strong> | organisaatioita <strong>{peerSnapshot.orgCount}</strong> | vertailuorg: <strong>{peerSnapshot.peerCount}</strong>
            </p>
            <p>
              Data: <strong>{peerSnapshot.isStale ? 'Vanhentunut' : 'Ajantasainen'}</strong>
              {peerSnapshot.computedAt ? ` (${new Date(peerSnapshot.computedAt).toLocaleString('fi-FI')})` : ''}
            </p>
            <div className="v2-peer-grid">
              {(peerSnapshot.metrics ?? []).map((metric) => (
                <article key={metric.metricKey} className="v2-peer-metric">
                  <h3>{metric.metricKey}</h3>
                  <p>Oma: {formatNumber(metric.yourValue ?? 0, 2)}</p>
                  <p>Mediaani: {formatNumber(metric.medianValue ?? 0, 2)}</p>
                </article>
              ))}
            </div>
            <div className="v2-peer-list">
              {(peerSnapshot.peers ?? []).map((peer) => (
                <span key={`${peer.veetiId}-${peer.ytunnus ?? peer.nimi ?? 'peer'}`}>
                  {peer.nimi ?? `VEETI ${peer.veetiId}`} ({peer.ytunnus ?? '-'})
                </span>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="v2-card v2-cta-card">
        <h2>Seuraava askel</h2>
        <p>Siirry Ennusteeseen ja mallinna tulevat investoinnit hintavaikutuksineen.</p>
        <button type="button" className="v2-btn v2-btn-primary" onClick={onGoToForecast}>
          Avaa Ennuste
        </button>
      </section>
    </div>
  );
};
