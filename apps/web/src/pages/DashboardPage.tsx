import React, { useMemo } from 'react';
import { useNavigation } from '../context/NavigationContext';
import {
  getVeetiStatus,
  listBudgets,
  getBenchmarks,
  refreshVeeti,
  type Budget,
  type BenchmarkYearResult,
} from '../api';
import { DashboardBenchmarkWidget } from '../components/Dashboard/DashboardBenchmarkWidget';
import { DashboardKPIs } from '../components/Dashboard/DashboardKPIs';
import { DashboardQuickActions } from '../components/Dashboard/DashboardQuickActions';
import { DashboardTrendChart } from '../components/Dashboard/DashboardTrendChart';

type DashboardState = {
  loading: boolean;
  budgets: Budget[];
  benchmark: BenchmarkYearResult | null;
  refreshRunning: boolean;
};

export const DashboardPage: React.FC = () => {
  const { navigateToTab } = useNavigation();
  const [state, setState] = React.useState<DashboardState>({
    loading: true,
    budgets: [],
    benchmark: null,
    refreshRunning: false,
  });

  const load = React.useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const [status, budgets] = await Promise.all([getVeetiStatus(), listBudgets()]);
      const years = budgets.map((budget) => budget.vuosi).sort((a, b) => b - a);
      const latestYear = years[0];
      const benchmark = latestYear && status.connected ? await getBenchmarks(latestYear).catch(() => null) : null;
      setState((prev) => ({ ...prev, budgets, benchmark, loading: false }));
    } catch {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const latest = [...state.budgets].sort((a, b) => b.vuosi - a.vuosi)[0];
    const valisummat = latest?.valisummat ?? [];
    const revenue = valisummat
      .filter((item) => item.tyyppi === 'tulo' || item.tyyppi === 'rahoitus_tulo')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
    const costs = valisummat
      .filter((item) => item.tyyppi === 'kulu' || item.tyyppi === 'poisto' || item.tyyppi === 'rahoitus_kulu')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
    const result = valisummat
      .filter((item) => item.tyyppi === 'tulos')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0)
      || revenue - costs;
    const totalVolume = (latest?.tuloajurit ?? []).reduce((sum, driver) => sum + (parseFloat(driver.myytyMaara) || 0), 0);

    return {
      latestYear: latest?.vuosi ?? null,
      revenue,
      costs,
      result,
      totalVolume,
      trend: [...state.budgets]
        .sort((a, b) => a.vuosi - b.vuosi)
        .map((budget) => {
          const tulos = (budget.valisummat ?? [])
            .filter((item) => item.tyyppi === 'tulos')
            .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
          return { year: budget.vuosi, result: tulos };
        }),
    };
  }, [state.budgets]);

  const handleRefresh = React.useCallback(async () => {
    setState((prev) => ({ ...prev, refreshRunning: true }));
    try {
      await refreshVeeti();
      await load();
    } finally {
      setState((prev) => ({ ...prev, refreshRunning: false }));
    }
  }, [load]);

  if (state.loading) {
    return <div className="page-loading">Ladataan dashboardia...</div>;
  }

  return (
    <div className="dashboard-page">
      <h2>Dashboard</h2>
      <DashboardKPIs
        latestYear={totals.latestYear}
        revenue={totals.revenue}
        costs={totals.costs}
        result={totals.result}
        totalVolume={totals.totalVolume}
      />
      <DashboardTrendChart data={totals.trend} />
      <DashboardBenchmarkWidget benchmark={state.benchmark} />
      <DashboardQuickActions
        onGoToConnect={() => navigateToTab('connect')}
        onGoToProjection={() => navigateToTab('projection')}
        onGoToBenchmarks={() => navigateToTab('benchmarks')}
        onRefresh={handleRefresh}
        refreshing={state.refreshRunning}
      />
    </div>
  );
};

