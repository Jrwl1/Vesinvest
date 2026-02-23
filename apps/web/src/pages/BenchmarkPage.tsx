import React from 'react';
import {
  getBenchmarks,
  getBenchmarkPeerGroup,
  getBenchmarkTrend,
  listBudgets,
  type BenchmarkYearResult,
  type BenchmarkTrendResult,
  type BenchmarkPeerGroupResult,
} from '../api';
import { BenchmarkComparisonChart } from '../components/Benchmark/BenchmarkComparisonChart';
import { BenchmarkMetricCard } from '../components/Benchmark/BenchmarkMetricCard';
import { BenchmarkPeerGroup } from '../components/Benchmark/BenchmarkPeerGroup';
import { BenchmarkTrendOverlay } from '../components/Benchmark/BenchmarkTrendOverlay';

export const BenchmarkPage: React.FC = () => {
  const [year, setYear] = React.useState<number | null>(null);
  const [data, setData] = React.useState<BenchmarkYearResult | null>(null);
  const [trend, setTrend] = React.useState<BenchmarkTrendResult | null>(null);
  const [peerGroup, setPeerGroup] = React.useState<BenchmarkPeerGroupResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (targetYear?: number | null) => {
    setLoading(true);
    setError(null);
    try {
      const budgets = await listBudgets();
      const latestYear = targetYear ?? budgets.map((budget) => budget.vuosi).sort((a, b) => b - a)[0] ?? new Date().getFullYear() - 1;
      const [benchmark, peers] = await Promise.all([
        getBenchmarks(latestYear),
        getBenchmarkPeerGroup(),
      ]);
      const metric = benchmark.metrics[0]?.metricKey ?? 'liikevaihto';
      const trendData = await getBenchmarkTrend(metric).catch(() => null);
      setYear(latestYear);
      setData(benchmark);
      setPeerGroup(peers);
      setTrend(trendData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vertailudatan lataus epäonnistui');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="page-loading">Ladataan vertailua...</div>;

  return (
    <div className="benchmark-page">
      <div className="page-header-row">
        <h2>Vertailu</h2>
        <div className="button-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => load((year ?? new Date().getFullYear()) - 1)}
          >
            Edellinen vuosi
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => load((year ?? new Date().getFullYear()) + 1)}
          >
            Seuraava vuosi
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {data && (
        <p className="muted">
          Vuosi {data.vuosi}
          {' • '}
          Päivitetty {data.computedAt ? new Date(data.computedAt).toLocaleString('fi-FI') : 'ei tiedossa'}
          {' • '}
          {data.orgCount} organisaatiota
          {data.isStale ? ' • Varoitus: vertailudata on yli 30 päivää vanhaa' : ''}
        </p>
      )}

      <BenchmarkPeerGroup data={peerGroup} />

      <section className="metric-grid">
        {(data?.metrics ?? []).slice(0, 8).map((metric) => (
          <BenchmarkMetricCard key={metric.metricKey} metric={metric} />
        ))}
      </section>

      <BenchmarkComparisonChart metric={data?.metrics?.[0] ?? null} />
      <BenchmarkTrendOverlay trend={trend} />
    </div>
  );
};

