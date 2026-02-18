/** V1: Projection view is VAT-free; no VAT inputs or VAT in displayed amounts. */
import React, { Suspense, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listProjections,
  getProjection,
  createProjection,
  deleteProjection,
  computeProjection,
  computeForBudget,
  updateProjection,
  listBudgets,
  getBudget,
  getBudgetsByBatchId,
  listAssumptions,
  getProjectionExportUrl,
  getProjectionExportPdfUrl,
  seedDemoData,
  type Projection,
  type ProjectionYear,
  type Budget,
  type Assumption,
  type DriverPaths,
} from '../api';
import { ScenarioComparison } from '../components/ScenarioComparison';
import { RevenueReport } from '../components/RevenueReport';
import { DriverPlanner, BaseValueMap } from '../components/DriverPlanner';
import { EnnusteScenarioRow } from '../components/EnnusteScenarioRow';
import { EnnusteSyotaZone } from '../components/EnnusteSyotaZone';
import { EnnusteTuloksetZone } from '../components/EnnusteTuloksetZone';
import { useDemoStatus } from '../context/DemoStatusContext';
import { useNavigation } from '../context/NavigationContext';
import {
  formatDecimal,
  formatEurInt,
  formatM3Int,
  formatTariffEurPerM3,
} from '../utils/format';
import { readHistoryVolumeStore, setHistoryVolume } from '../utils/historyVolumes';
import { selectBaselineBudget } from './projection/baselineBudget';

// -- Helpers --

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toLocaleString('fi-FI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

function getBudgetDriverVolume(budget: Budget | null | undefined): number {
  if (!budget?.tuloajurit || budget.tuloajurit.length === 0) return 0;
  const total = budget.tuloajurit
    .filter((driver) => driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi')
    .reduce((sum, driver) => sum + (parseFloat(driver.myytyMaara || '0') || 0), 0);
  return Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
}

const ASSUMPTION_KEYS = ['inflaatio', 'energiakerroin', 'vesimaaran_muutos', 'hintakorotus', 'investointikerroin'];
const AUTO_BOOTSTRAP_FLAG = String(import.meta.env.VITE_PROJECTION_AUTO_BOOTSTRAP ?? 'true').toLowerCase();
const AUTO_BOOTSTRAP_ENABLED = !['0', 'false', 'off'].includes(AUTO_BOOTSTRAP_FLAG);

type ScenarioDriverDraft = Record<'vesi' | 'jatevesi', { yksikkohinta: string; myytyMaara: string }>;

const EMPTY_SCENARIO_DRIVER_DRAFT: ScenarioDriverDraft = {
  vesi: { yksikkohinta: '', myytyMaara: '' },
  jatevesi: { yksikkohinta: '', myytyMaara: '' },
};

/**
 * Editable percentage input with focus/blur pattern.
 *
 * Problem: `<input type="number" value="3,0">` breaks because number inputs
 * reject comma decimals (Finnish locale uses comma). A controlled input with
 * `formatDecimal()` value + parseFloat onChange creates a frozen input since
 * intermediate typing states ("", "4", "4,") are NaN and state never updates.
 *
 * Fix: use `type="text" inputMode="decimal"`. While focused, the user edits
 * raw text freely. On blur we normalize comma to dot and parse. Display reverts
 * to formatted Finnish locale text when not focused.
 */
const AssumptionInput: React.FC<{
  /** Internal decimal value, e.g. 0.03 for 3 % */
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const pct = value * 100;
  const [raw, setRaw] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  return (
    <span className="assumption-input-wrapper">
      <input
        type="text"
        inputMode="decimal"
        className="assumption-input"
        value={focused ? raw : formatDecimal(pct)}
        onFocus={() => {
          // Show comma-formatted value for Finnish users
          setRaw(formatDecimal(pct));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          const normalized = raw.replace(',', '.');
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) {
            onChange(parsed / 100);
          }
          // If NaN (e.g. empty), silently keep the previous value
        }}
        onChange={(e) => setRaw(e.target.value)}
      />
      <span className="assumption-input-suffix">%</span>
    </span>
  );
};

const ProjectionChartsLazy = React.lazy(async () => {
  const module = await import('../components/ProjectionCharts');
  return { default: module.ProjectionCharts };
});

const EnnusteComboChartLazy = React.lazy(async () => {
  const module = await import('../components/EnnusteComboChart');
  return { default: module.EnnusteComboChart };
});

const ProjectionChartSkeleton: React.FC = () => (
  <div className="projection-chart-skeleton card" role="status" aria-live="polite">
    <div className="projection-skeleton projection-skeleton--chart">
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
    </div>
  </div>
);

const ProjectionTableSkeleton: React.FC = () => (
  <div className="projection-table-skeleton card" role="status" aria-live="polite">
    <div className="projection-skeleton projection-skeleton--table">
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
      <div className="projection-skeleton__line" />
    </div>
  </div>
);

const ProjectionResultsTable: React.FC<{ years: ProjectionYear[]; t: (key: string) => string }> = ({ years, t }) => (
  <table className="projection-table">
    <thead>
      <tr>
        <th className="projection-table__sticky-col">{t('projection.columns.year')}</th>
        <th className="num-col">{t('projection.columns.revenue')} (€)</th>
        <th className="num-col">{t('projection.columns.expenses')} (€)</th>
        <th className="num-col">{t('projection.columns.depreciation')} (€)</th>
        <th className="num-col">{t('projection.columns.investments')} (€)</th>
        <th className="num-col result-col">{t('projection.columns.netResult')} (€)</th>
        <th className="num-col">{t('projection.columns.cumulative')} (€)</th>
        <th className="num-col">{t('projection.columns.waterPrice')} (€/m³)</th>
        <th className="num-col">{t('projection.columns.volume')} (m³)</th>
      </tr>
    </thead>
    <tbody>
      {years.map((year, index) => {
        const netResult = num(year.tulos);
        const cumulative = num(year.kumulatiivinenTulos);
        const depreciation = num(year.poistoPerusta) + num(year.poistoInvestoinneista);
        const isBase = index === 0;
        return (
          <tr key={year.vuosi} className={`${netResult < 0 ? 'deficit-row' : ''} ${isBase ? 'base-year-row' : ''}`}>
            <td className="year-cell projection-table__sticky-col">
              {year.vuosi}
              {isBase && <span className="base-badge">base</span>}
            </td>
            <td className="num-col">{formatEurInt(year.tulotYhteensa)}</td>
            <td className="num-col">{formatEurInt(year.kulutYhteensa)}</td>
            <td className="num-col">{formatEurInt(depreciation)}</td>
            <td className="num-col">{formatEurInt(year.investoinnitYhteensa)}</td>
            <td className={`num-col result-col ${netResult >= 0 ? 'positive' : 'negative'}`}>
              {formatEurInt(netResult)}
            </td>
            <td className={`num-col ${cumulative >= 0 ? 'positive' : 'negative'}`}>
              {formatEurInt(cumulative)}
            </td>
            <td className="num-col">{formatTariffEurPerM3(num(year.vesihinta))}</td>
            <td className="num-col">{formatM3Int(year.myytyVesimaara)}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const ProjectionResultsTableLazy = React.lazy(async () => ({ default: ProjectionResultsTable }));

// -- Main Component --

export const ProjectionPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [projections, setProjections] = useState<Projection[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [orgAssumptions, setOrgAssumptions] = useState<Assumption[]>([]);
  const [activeProjection, setActiveProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrappingProjection, setBootstrappingProjection] = useState(false);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverPaths, setDriverPaths] = useState<DriverPaths | undefined>(undefined);
  const [savingDriverPaths, setSavingDriverPaths] = useState(false);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBudgetId, setNewBudgetId] = useState('');
  const [newHorizon, setNewHorizon] = useState(20);
  const [newScenarioDrivers, setNewScenarioDrivers] = useState<ScenarioDriverDraft>(EMPTY_SCENARIO_DRIVER_DRAFT);
  const [newScenarioInvestments, setNewScenarioInvestments] = useState<Array<{ year: number; amount: number }>>([]);

  // Assumption overrides panel
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  /** Ref mirror of overrides so handleCompute can read post-blur values after a tick (BUG 1: commit-on-blur). */
  const overridesRef = useRef<Record<string, number | null>>({});

  // Comparison mode
  const [showComparison, setShowComparison] = useState(false);

  // Horizon change notice
  const [horizonChangedNotice, setHorizonChangedNotice] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [userInvestments, setUserInvestments] = useState<Array<{ year: number; amount: number }>>([]);
  const [historyVolumes, setHistoryVolumes] = useState<Record<string, number>>(() => readHistoryVolumeStore());
  const [historySetBudgets, setHistorySetBudgets] = useState<Budget[]>([]);
  type AccordionSyotaId = 'olettamukset' | 'investoinnit' | 'tuloajurit';
  const [openAccordionSyota, setOpenAccordionSyota] = useState<Set<AccordionSyotaId>>(new Set(['investoinnit']));
  const toggleAccordionSyota = useCallback((id: AccordionSyotaId) => {
    setOpenAccordionSyota((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Data version: increment to force re-fetch (e.g. after demo reset recovery)
  const [dataVersion, setDataVersion] = useState(0);

  const [seedingDemo, setSeedingDemo] = useState(false);
  const demoStatus = useDemoStatus();
  const isDemoEnabled = demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled;
  const { navigateToTab, state: navState } = useNavigation();

  const plannerYears = useMemo(() => {
    if (activeProjection?.talousarvio?.vuosi != null) {
      const horizon = activeProjection?.aikajaksoVuosia ?? 0;
      return Array.from({ length: horizon + 1 }, (_, idx) => activeProjection.talousarvio!.vuosi + idx);
    }
    return (activeProjection?.vuodet ?? []).map((y) => y.vuosi);
  }, [activeProjection?.talousarvio?.vuosi, activeProjection?.aikajaksoVuosia, activeProjection?.vuodet]);

  const driverBaseValues = useMemo<BaseValueMap>(() => {
    const base: BaseValueMap = {
      vesi: { yksikkohinta: null, myytyMaara: null },
      jatevesi: { yksikkohinta: null, myytyMaara: null },
    };
    const drivers = activeProjection?.talousarvio?.tuloajurit ?? [];
    drivers.forEach((driver) => {
      if (driver.palvelutyyppi === 'vesi' || driver.palvelutyyppi === 'jatevesi') {
        const price = parseFloat(driver.yksikkohinta);
        const volume = parseFloat(driver.myytyMaara);
        base[driver.palvelutyyppi].yksikkohinta = Number.isFinite(price) ? price : null;
        base[driver.palvelutyyppi].myytyMaara = Number.isFinite(volume) ? volume : null;
      }
    });
    return base;
  }, [activeProjection?.talousarvio?.tuloajurit]);

  const driverPathsDirty = useMemo(() => {
    return stableStringifyPaths(driverPaths) !== stableStringifyPaths(activeProjection?.ajuriPolut);
  }, [driverPaths, activeProjection?.ajuriPolut]);

  const allZeroWaterDrivers = useMemo(() => {
    const y = activeProjection?.vuodet ?? [];
    if (y.length === 0) return false;
    return y.every((yr) => num(yr.vesihinta) === 0 && num(yr.myytyVesimaara) === 0);
  }, [activeProjection?.vuodet]);


  // -- Data Loading --

  const applyProjectionSelection = useCallback((full: Projection) => {
    setActiveProjection(full);
    const existingOverrides = (full.olettamusYlikirjoitukset as Record<string, number>) ?? {};
    const overrideState: Record<string, number | null> = {};
    for (const key of ASSUMPTION_KEYS) {
      overrideState[key] = key in existingOverrides ? existingOverrides[key] : null;
    }
    setOverrides(overrideState);
    overridesRef.current = overrideState;
  }, []);

  const selectProjection = useCallback(async (id: string) => {
    try {
      const full = await getProjection(id);
      applyProjectionSelection(full);
    } catch (e: any) {
      if (String(e.message).includes('404') || String(e.message).includes('not found')) {
        setActiveProjection(null);
        setDataVersion((v) => v + 1);
        return;
      }
      setError(e.message || t('projection.errorLoadFailed'));
    }
  }, [applyProjectionSelection]);

  const fetchInitialProjectionContext = useCallback(async () => {
    const [projList, budgetList, assumptions] = await Promise.all([
      listProjections(),
      listBudgets(),
      listAssumptions(),
    ]);
    setProjections(projList);
    setBudgets(budgetList);
    setOrgAssumptions(assumptions);
    return { projList, budgetList };
  }, []);

  const selectOrBootstrapProjection = useCallback(async (projList: Projection[], budgetList: Budget[]) => {
    if (projList.length > 0) {
      const defaultProjection = projList.find((p) => p.onOletus)
        ?? [...projList].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
      let selected: Projection;
      try {
        selected = await getProjection(defaultProjection.id);
      } catch (e: any) {
        const msg = String(e.message || '');
        if (msg.includes('404') || msg.includes('not found')) {
          setDataVersion((v) => v + 1);
          return;
        }
        throw e;
      }
      const hasYears = (selected.vuodet?.length ?? 0) > 0;
      if (!hasYears && selected.talousarvioId) {
        setBootstrappingProjection(true);
        try {
          selected = await computeProjection(selected.id);
        } catch (e: any) {
          const msg = String(e.message || '');
          if (msg.includes('404') || msg.includes('not found')) {
            // Stale projection ID: recover via budget baseline only to avoid applying stale scenario paths
            selected = await computeForBudget(selected.talousarvioId);
          } else {
            throw e;
          }
        }
        setProjections(await listProjections());
      }
      applyProjectionSelection(selected);
      return;
    }

    if (!AUTO_BOOTSTRAP_ENABLED || budgetList.length === 0) {
      setActiveProjection(null);
      return;
    }

    const baselineBudget = selectBaselineBudget(budgetList);
    if (!baselineBudget) {
      setActiveProjection(null);
      return;
    }

    setBootstrappingProjection(true);
    const bootstrappedProjection = await computeForBudget(baselineBudget.id);
    applyProjectionSelection(bootstrappedProjection);
    setProjections(await listProjections());
  }, [applyProjectionSelection]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setBootstrappingProjection(false);
    setError(null);
    setActiveProjection(null);
    try {
      const { projList, budgetList } = await fetchInitialProjectionContext();
      await selectOrBootstrapProjection(projList, budgetList);
    } catch (e: any) {
      setError(e.message || t('projection.errorLoadFailed'));
    } finally {
      setBootstrappingProjection(false);
      setLoading(false);
    }
  }, [dataVersion, fetchInitialProjectionContext, selectOrBootstrapProjection]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setDriverPaths(activeProjection?.ajuriPolut ?? undefined);
  }, [activeProjection?.ajuriPolut, activeProjection?.id]);

  useEffect(() => {
    const inv = activeProjection?.userInvestments;
    setUserInvestments(Array.isArray(inv) ? inv : []);
  }, [activeProjection?.userInvestments, activeProjection?.id]);

  useEffect(() => {
    setOpenAccordionSyota(new Set(['investoinnit']));
  }, [activeProjection?.id]);

  useEffect(() => {
    overridesRef.current = overrides;
  }, [overrides]);

  // Refetch org assumptions when projection tab is focused so "Org default" column stays fresh
  // after editing Asetukset (audit fix: stale orgAssumptions after Asetukset change).
  useEffect(() => {
    if (navState.tab === 'projection') {
      listAssumptions()
        .then((fresh) => setOrgAssumptions(fresh))
        .catch(() => {/* silent; previous values remain */});
    }
  }, [navState.tab]);

  const years = activeProjection?.vuodet ?? [];
  const effectiveSelectedYear = selectedYear ?? years[0]?.vuosi ?? null;
  useEffect(() => {
    if (years.length > 0 && (effectiveSelectedYear == null || !years.some((y) => y.vuosi === effectiveSelectedYear))) {
      setSelectedYear(years[0].vuosi);
    }
  }, [years, effectiveSelectedYear]);

  useEffect(() => {
    let cancelled = false;

    const loadHistoryBaseline = async () => {
      if (!activeProjection?.talousarvioId) {
        setHistorySetBudgets([]);
        return;
      }

      const activeBudget = budgets.find((budget) => budget.id === activeProjection.talousarvioId) ?? null;
      let baselineBudgets: Budget[] = [];

      if (activeBudget?.importBatchId) {
        baselineBudgets = await getBudgetsByBatchId(activeBudget.importBatchId).catch(() => []);
      }

      if (baselineBudgets.length === 0) {
        const sorted = [...budgets].sort((a, b) => a.vuosi - b.vuosi);
        if (activeBudget) {
          const upToBaseYear = sorted.filter((budget) => budget.vuosi <= activeBudget.vuosi);
          baselineBudgets = (upToBaseYear.length >= 3 ? upToBaseYear : sorted).slice(-3);
        } else {
          baselineBudgets = sorted.slice(-3);
        }
      }

      const mergedVolumes = readHistoryVolumeStore();
      for (const budget of baselineBudgets) {
        try {
          const fullBudget = await getBudget(budget.id);
          const dbVolume = getBudgetDriverVolume(fullBudget);
          if (dbVolume > 0) {
            mergedVolumes[budget.id] = dbVolume;
          }
        } catch {
          // Keep local fallback volume value.
        }
      }

      if (!cancelled) {
        setHistorySetBudgets(baselineBudgets);
        setHistoryVolumes(mergedVolumes);
      }
    };

    loadHistoryBaseline();
    return () => { cancelled = true; };
  }, [activeProjection?.talousarvioId, budgets]);

  // -- Actions --

  const selectedCreateBudget = useMemo(
    () => budgets.find((budget) => budget.id === newBudgetId) ?? null,
    [budgets, newBudgetId],
  );
  const createModalBaseYear = selectedCreateBudget?.vuosi
    ?? activeProjection?.talousarvio?.vuosi
    ?? new Date().getFullYear();
  const createModalYears = useMemo(
    () => Array.from({ length: Math.max(1, newHorizon) + 1 }, (_, index) => createModalBaseYear + index),
    [createModalBaseYear, newHorizon],
  );

  const resetCreateScenarioForm = useCallback(() => {
    setShowCreateForm(false);
    setNewName('');
    setNewBudgetId('');
    setNewHorizon(20);
    setNewScenarioDrivers(EMPTY_SCENARIO_DRIVER_DRAFT);
    setNewScenarioInvestments([]);
  }, []);

  const openCreateScenarioForm = useCallback(() => {
    const preferredBudget = activeProjection?.talousarvioId
      ? budgets.find((b) => b.id === activeProjection.talousarvioId) ?? null
      : selectBaselineBudget(budgets);
    const baseBudgetId = preferredBudget?.id ?? '';
    const baseYear = preferredBudget?.vuosi ?? new Date().getFullYear();
    const initialHorizon = activeProjection?.aikajaksoVuosia ?? 20;
    const activePaths = activeProjection?.ajuriPolut ?? undefined;
    const readPathValue = (service: 'vesi' | 'jatevesi', field: 'yksikkohinta' | 'myytyMaara'): number | undefined => {
      const plan = activePaths?.[service]?.[field];
      if (!plan) return undefined;
      const manual = plan.values?.[baseYear];
      if (typeof manual === 'number' && Number.isFinite(manual)) return manual;
      if (plan.mode === 'percent' && typeof plan.baseValue === 'number' && Number.isFinite(plan.baseValue)) return plan.baseValue;
      return undefined;
    };

    setNewBudgetId(baseBudgetId);
    setNewHorizon(initialHorizon);
    setNewScenarioDrivers({
      vesi: {
        yksikkohinta: formatDraftNumber(readPathValue('vesi', 'yksikkohinta')),
        myytyMaara: formatDraftNumber(readPathValue('vesi', 'myytyMaara')),
      },
      jatevesi: {
        yksikkohinta: formatDraftNumber(readPathValue('jatevesi', 'yksikkohinta')),
        myytyMaara: formatDraftNumber(readPathValue('jatevesi', 'myytyMaara')),
      },
    });
    const inheritedInvestments = Array.isArray(activeProjection?.userInvestments)
      ? activeProjection.userInvestments.filter((item) => Number.isFinite(item.year) && Number.isFinite(item.amount))
      : [];
    setNewScenarioInvestments(
      inheritedInvestments.length > 0
        ? inheritedInvestments.map((item) => ({ year: Number(item.year), amount: Number(item.amount) }))
        : [{ year: baseYear, amount: 0 }],
    );
    setShowCreateForm(true);
  }, [activeProjection?.aikajaksoVuosia, activeProjection?.ajuriPolut, activeProjection?.talousarvioId, activeProjection?.userInvestments, budgets]);

  const handleScenarioDriverDraftChange = (
    service: 'vesi' | 'jatevesi',
    field: 'yksikkohinta' | 'myytyMaara',
    raw: string,
  ) => {
    setNewScenarioDrivers((prev) => ({
      ...prev,
      [service]: {
        ...prev[service],
        [field]: raw,
      },
    }));
  };

  const handleAddScenarioInvestmentDraft = () => {
    const nextYear = createModalYears.find((year) => !newScenarioInvestments.some((item) => item.year === year))
      ?? createModalBaseYear;
    setNewScenarioInvestments((prev) => [...prev, { year: nextYear, amount: 0 }]);
  };

  const handleScenarioInvestmentDraftChange = (index: number, field: 'year' | 'amount', value: number) => {
    setNewScenarioInvestments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveScenarioInvestmentDraft = (index: number) => {
    setNewScenarioInvestments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newBudgetId) return;
    try {
      setError(null);
      const scenarioDriverPaths = buildScenarioDriverPaths(newScenarioDrivers, createModalBaseYear);
      const scenarioInvestments = newScenarioInvestments
        .map((item) => ({ year: Math.round(Number(item.year)), amount: Number(item.amount) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.amount) && item.amount !== 0);

      const scenarioPayload = {
        talousarvioId: newBudgetId,
        nimi: newName.trim(),
        aikajaksoVuosia: newHorizon,
        ajuriPolut: scenarioDriverPaths,
        userInvestments: scenarioInvestments.length > 0 ? scenarioInvestments : undefined,
      };

      const createAndComputeScenario = async () => {
        const created = await createProjection(scenarioPayload);
        return computeProjection(created.id);
      };

      let scenarioProjection: Projection;
      try {
        scenarioProjection = await createAndComputeScenario();
      } catch (e: any) {
        const msg = String(e.message || '');
        if (msg.includes('404') || msg.includes('not found')) {
          // Projection may have been reset between create and compute; retry full scenario create once.
          scenarioProjection = await createAndComputeScenario();
        } else {
          throw e;
        }
      }

      applyProjectionSelection(scenarioProjection);
      setProjections(await listProjections());
      resetCreateScenarioForm();
    } catch (e: any) {
      setError(e.message || t('projection.errorCreateFailed'));
    }
  };

  const handleDelete = async () => {
    if (!activeProjection) return;
    if (!window.confirm(t('projection.deleteConfirm', { name: activeProjection.nimi }))) return;
    try {
      await deleteProjection(activeProjection.id);
      setActiveProjection(null);
      const projList = await listProjections();
      setProjections(projList);
      if (projList.length > 0) {
        await selectProjection(projList[0].id);
      }
    } catch (e: any) {
      setError(e.message || t('projection.errorDeleteFailed'));
    }
  };

  const handleSaveDriverPaths = async () => {
    if (!activeProjection) return;
    setSavingDriverPaths(true);
    setError(null);
    try {
      const payload = driverPaths && Object.keys(driverPaths).length > 0 ? driverPaths : undefined;
      const updated = await updateProjection(activeProjection.id, { ajuriPolut: payload });
      setActiveProjection(updated);
    } catch (e: any) {
      setError(e.message || t('projection.errorSaveFailed'));
    } finally {
      setSavingDriverPaths(false);
    }
  };

  const handleCompute = async () => {
    if (!activeProjection) return;
    if (driverPathsDirty) {
      setError(t('projection.driverPlanner.saveBeforeCompute'));
      return;
    }
    setComputing(true);
    setError(null);
    setHorizonChangedNotice(false);

    // BUG 1: Commit any focused assumption input (value is applied on blur). Blur then wait a tick
    // so React flushes the onBlur setState; we read from overridesRef which is synced in useEffect.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise<void>((r) => setTimeout(r, 0));

    // Collect overrides (use ref so we get post-blur values)
    const currentOverrides = overridesRef.current;
    const cleanOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(currentOverrides)) {
      if (value !== null) {
        cleanOverrides[key] = value;
      }
    }
    const hasOverrides = Object.keys(cleanOverrides).length > 0;

    try {
      // Try the normal PATCH + compute path first.
      // Send {} (empty object) when no overrides to explicitly clear any stored overrides in DB
      // (audit fix: sending undefined omits the field so backend never clears existing overrides).
      await updateProjection(activeProjection.id, {
        olettamusYlikirjoitukset: hasOverrides ? cleanOverrides : {},
      });
      const result = await computeProjection(activeProjection.id);
      setActiveProjection(result);
    } catch (e: any) {
      const msg = String(e.message || '');
      const is404 = msg.includes('404') || msg.includes('not found');

      if (is404 && activeProjection.talousarvioId) {
        // Stale projection ID: fall back to budget-based upsert compute. Pass overrides and driver paths
        // so the recomputed projection preserves user inputs (BUG 2).
        try {
          const result = await computeForBudget(
            activeProjection.talousarvioId,
            hasOverrides ? cleanOverrides : undefined,
            driverPaths ?? undefined,
          );
          setActiveProjection(result);
          // Re-fetch projection list so tabs are in sync
          const projList = await listProjections();
          setProjections(projList);
        } catch (e2: any) {
          setError(e2.message || t('projection.errorComputeFailed'));
        }
      } else {
        setError(msg || t('projection.errorComputeFailed'));
      }
    } finally {
      setComputing(false);
    }
  };

  const handleExport = () => {
    if (!activeProjection) return;
    const token = localStorage.getItem('access_token');
    const url = getProjectionExportUrl(activeProjection.id);
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ennuste_${activeProjection.nimi}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setError(t('projection.errorExportFailed')));
  };

  const handleExportPdf = () => {
    if (!activeProjection) return;
    const token = localStorage.getItem('access_token');
    const url = getProjectionExportPdfUrl(activeProjection.id);
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ennuste_${activeProjection.nimi}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => setError(t('projection.errorExportFailed')));
  };

  const handleAddUserInvestment = () => {
    const baseYear = activeProjection?.talousarvio?.vuosi ?? new Date().getFullYear();
    const horizon = activeProjection?.aikajaksoVuosia ?? 20;
    const years = Array.from({ length: horizon + 1 }, (_, i) => baseYear + i);
    const nextYear = years.find((y) => !userInvestments.some((u) => u.year === y)) ?? baseYear;
    setUserInvestments((prev) => [...prev, { year: nextYear, amount: 0 }]);
  };

  const handleRemoveUserInvestment = (index: number) => {
    setUserInvestments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUserInvestmentChange = (index: number, field: 'year' | 'amount', value: number) => {
    setUserInvestments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveUserInvestments = async () => {
    if (!activeProjection) return;
    try {
      setError(null);
      const updated = await updateProjection(activeProjection.id, {
        userInvestments: userInvestments.filter((u) => u.amount !== 0 || u.year > 0),
      });
      setActiveProjection(updated);
    } catch (e: any) {
      setError(e.message || t('projection.errorSaveFailed'));
    }
  };

  const handleHorizonChange = async (value: number) => {
    if (!activeProjection) return;
    try {
      await updateProjection(activeProjection.id, { aikajaksoVuosia: value });
      const updated = await getProjection(activeProjection.id);
      setActiveProjection(updated);
      // Show notice that recompute is needed to reflect new horizon (audit fix)
      setHorizonChangedNotice(true);
    } catch (e: any) {
      const msg = String(e.message || '');
      if (msg.includes('404') || msg.includes('not found')) {
        // Stale: re-fetch everything
        setDataVersion((v) => v + 1);
      } else {
        setError(msg || t('projection.errorSaveFailed'));
      }
    }
  };

  // -- Assumption override helpers --

  const getOrgDefault = (key: string): number => {
    const a = orgAssumptions.find((a) => a.avain === key);
    return a ? num(a.arvo) : 0;
  };

  const getEffectiveValue = (key: string): number => {
    return overrides[key] ?? getOrgDefault(key);
  };

  const setOverride = (key: string, value: number | null) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const buildDriverPathsWithBaseVolume = useCallback((baseVolume: number): DriverPaths | undefined => {
    const baseYear = activeProjection?.talousarvio?.vuosi ?? years[0]?.vuosi;
    if (!baseYear) return driverPaths ?? activeProjection?.ajuriPolut ?? undefined;

    const next = cloneDriverPaths(driverPaths ?? activeProjection?.ajuriPolut ?? undefined) ?? {};
    const firstYearDrivers = years[0]?.erittelyt?.ajurit ?? [];
    const services: Array<'vesi' | 'jatevesi'> = ['vesi', 'jatevesi'];

    for (const service of services) {
      const fromDetail = firstYearDrivers.find((driver) => driver.palvelutyyppi === service);
      const fallbackPrice = fromDetail ? Number(fromDetail.yksikkohinta) : 0;
      const fallbackVolume = fromDetail ? Number(fromDetail.myytyMaara) : 0;
      const servicePaths = next[service] ?? {};

      const priceValues = { ...(servicePaths.yksikkohinta?.values ?? {}) };
      if (!Number.isFinite(priceValues[baseYear])) {
        priceValues[baseYear] = fallbackPrice;
      }
      servicePaths.yksikkohinta = {
        mode: 'manual',
        values: priceValues,
      };

      const volumeValues = { ...(servicePaths.myytyMaara?.values ?? {}) };
      if (!Number.isFinite(volumeValues[baseYear])) {
        volumeValues[baseYear] = fallbackVolume;
      }
      servicePaths.myytyMaara = {
        mode: 'manual',
        values: volumeValues,
      };
      next[service] = servicePaths;
    }

    next.vesi = next.vesi ?? {};
    next.vesi.myytyMaara = {
      mode: 'manual',
      values: {
        ...(next.vesi.myytyMaara?.values ?? {}),
        [baseYear]: Math.max(0, Math.round(baseVolume)),
      },
    };
    return next;
  }, [activeProjection?.ajuriPolut, activeProjection?.talousarvio?.vuosi, driverPaths, years]);

  const handleHistoryVolumeCommit = useCallback(async (budgetId: string, value: number) => {
    const safe = Math.max(0, Math.round(value));
    const merged = setHistoryVolume(budgetId, safe);
    setHistoryVolumes(merged);

    if (!activeProjection || budgetId !== activeProjection.talousarvioId) return;

    const nextPaths = buildDriverPathsWithBaseVolume(safe);
    setDriverPaths(nextPaths);
    if (!nextPaths) return;

    try {
      setSavingDriverPaths(true);
      const updated = await updateProjection(activeProjection.id, { ajuriPolut: nextPaths });
      setActiveProjection(updated);
    } catch (e: any) {
      setError(e.message || t('projection.errorSaveFailed'));
    } finally {
      setSavingDriverPaths(false);
    }
  }, [activeProjection, buildDriverPathsWithBaseVolume, t]);

  // -- Rendering --

  if (loading || bootstrappingProjection) {
    return (
      <div className="projection-page">
        <div className="page-header"><h2>{t('projection.title')}</h2></div>
        <div className="loading-state">{t('common.loading')}</div>
      </div>
    );
  }

  if (budgets.length === 0) {
    const handleLoadDemoData = async () => {
      setSeedingDemo(true);
      setError(null);
      try {
        await seedDemoData();
        await loadData();
      } catch (e: any) {
        setError(e.message || t('projection.errorLoadFailed'));
      } finally {
        setSeedingDemo(false);
      }
    };

    return (
      <div className="projection-page">
        {error && <div className="error-banner">{error}</div>}
        <div className="page-header">
          <h2>{t('projection.title')}</h2>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigateToTab('budget')}>
              {t('budget.title')}
            </button>
            {isDemoEnabled && (
              <button type="button" className="btn btn-primary" onClick={handleLoadDemoData} disabled={seedingDemo}>
                {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
              </button>
            )}
          </div>
        </div>
        <div className="card projection-scaffold">
          <p className="skeleton-hint">{t('projection.noBudgetScaffold')}</p>
        </div>
        <div className="projection-table-wrapper card">
          <table className="projection-table">
            <thead>
              <tr>
                <th>{t('projection.columns.year')}</th>
                <th className="num-col">{t('projection.columns.revenue')}</th>
                <th className="num-col">{t('projection.columns.expenses')}</th>
                <th className="num-col">{t('projection.columns.investments')}</th>
                <th className="num-col result-col">{t('projection.columns.netResult')}</th>
                <th className="num-col">{t('projection.columns.cumulative')}</th>
                <th className="num-col">{t('projection.columns.waterPrice')}</th>
                <th className="num-col">{t('projection.columns.volume')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="muted">{t('projection.noBudgetScaffold')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hasComputedData = years.length > 0;
  const canCompute = Boolean(activeProjection?.talousarvioId);
  const selectedYearData = effectiveSelectedYear != null
    ? years.find((year) => year.vuosi === effectiveSelectedYear) ?? null
    : null;
  const finalYear = years.length > 0 ? years[years.length - 1] : null;
  const finalCumulative = finalYear ? num(finalYear.kumulatiivinenTulos) : 0;
  const selectedYearDepreciation = selectedYearData
    ? num(selectedYearData.poistoPerusta) + num(selectedYearData.poistoInvestoinneista)
    : 0;

  const firstYear = years.length > 0 ? years[0] : null;
  const lastYear = years.length > 0 ? years[years.length - 1] : null;
  const tariffYearPlusOne = years.length > 1 ? num(years[1].vesihinta) : null;
  const selectedYearCashflow = selectedYearData
    ? (typeof selectedYearData.kassafloede === 'number'
      ? selectedYearData.kassafloede
      : num(selectedYearData.tulos) - num(selectedYearData.investoinnitYhteensa))
    : null;
  const selectedYearInvestments = selectedYearData ? num(selectedYearData.investoinnitYhteensa) : null;
  const historyBaselineRows = historySetBudgets.map((budget) => {
    const valisummat = budget.valisummat ?? [];
    const tulot = valisummat
      .filter((item) => item.tyyppi === 'tulo' || item.tyyppi === 'rahoitus_tulo')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
    const kulut = valisummat
      .filter((item) => item.tyyppi === 'kulu' || item.tyyppi === 'rahoitus_kulu')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
    const poistot = valisummat
      .filter((item) => item.tyyppi === 'poisto')
      .reduce((sum, item) => sum + (parseFloat(item.summa) || 0), 0);
    return {
      id: budget.id,
      vuosi: budget.vuosi,
      tulot,
      kulut,
      tulos: tulot - kulut - poistot,
      volume: historyVolumes[budget.id] ?? 0,
      isActive: budget.id === activeProjection?.talousarvioId,
    };
  });
  const volumeTrendText = firstYear && lastYear
    ? `${firstYear.vuosi}: ${formatM3Int(firstYear.myytyVesimaara)} -> ${lastYear.vuosi}: ${formatM3Int(lastYear.myytyVesimaara)}`
    : '—';
  const opexTrendText = `${formatPercent(getEffectiveValue('energiakerroin'))} ${t('common.perYear')}`;
  const capexDepreciationTotal = years.reduce((sum, year) => sum + num(year.poistoInvestoinneista), 0);
  const capexImpactText = hasComputedData
    ? `${formatEurInt(capexDepreciationTotal)} (${t('projection.columns.investmentDepreciation')})`
    : '—';

  // --- V2 render ---
  const tv2 = (k: string) => t(`projection.v2.${k}`);

  return (
    <div className="projection-page ev2-page">
      {/* ── Topbar ── */}
      <header className="ev2-topbar">
        <div className="ev2-topbar__left">
          <h1 className="ev2-title">{tv2('pageTitle')}</h1>
          {activeProjection && (
            <span className="ev2-topbar__meta">
              {tv2('budgetLabel')}: <strong>{activeProjection.talousarvio?.nimi ?? activeProjection.talousarvioId}</strong>
              {' · '}
              {tv2('horizonLabel')}: <strong>{activeProjection.aikajaksoVuosia} {tv2('horizonUnit')}</strong>
            </span>
          )}
        </div>
        <div className="ev2-topbar__right ennuste-actions">
          {projections.length >= 2 && (
            <button type="button" className="ev2-btn ev2-btn--ghost" onClick={() => setShowComparison(true)}>
              {t('projection.compare')}
            </button>
          )}
          {hasComputedData && (
            <>
              <button type="button" className="ev2-btn ev2-btn--ghost" onClick={handleExport}>{t('projection.exportCsv')}</button>
              <button type="button" className="ev2-btn ev2-btn--ghost" onClick={handleExportPdf}>{t('projection.exportPdf')}</button>
            </>
          )}
        </div>
      </header>

      {error && <div className="ev2-error-banner" role="alert">{error}</div>}

      {/* Scenario comparison overlay */}
      {showComparison && (
        <ScenarioComparison onClose={() => setShowComparison(false)} />
      )}

      {/* ── Scenario row ── */}
      <div className="ev2-scenario-row">
        <span className="ev2-scenario-row__label">{tv2('scenariosLabel')}:</span>
        <EnnusteScenarioRow
          projections={projections}
          activeProjectionId={activeProjection?.id ?? null}
          onSelectProjection={selectProjection}
          onCreateScenario={openCreateScenarioForm}
          onDeleteScenario={activeProjection ? handleDelete : undefined}
          scenarioAriaLabel={t('projection.scenario')}
          createScenarioLabel={t('projection.createScenario')}
          deleteScenarioLabel={t('projection.deleteScenario')}
          deleteScenarioAriaLabel={
            activeProjection ? t('projection.deleteScenarioAria', { name: activeProjection.nimi }) : undefined
          }
        />
      </div>

      {/* Create scenario modal */}
      {showCreateForm && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-scenario-modal-title"
          onClick={(e) => e.target === e.currentTarget && resetCreateScenarioForm()}
        >
          <div className="modal-content create-scenario-form card">
            <h3 id="create-scenario-modal-title">{t('projection.createScenario')}</h3>
            <p className="create-scenario-form__context">{t('projection.createScenarioContext')}</p>
            <div className="form-row">
              <label>{t('projection.newScenarioName')}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('projection.newScenarioPlaceholder')}
              />
            </div>
            <div className="form-row">
              <label>{t('projection.baseBudget')}</label>
              <select value={newBudgetId} onChange={(e) => setNewBudgetId(e.target.value)}>
                <option value="">{t('projection.selectBudget')}</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nimi ?? `Talousarvio ${b.vuosi}`} ({b.vuosi})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>{t('projection.horizon')}</label>
              <div className="horizon-input">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newHorizon}
                  onChange={(e) => setNewHorizon(parseInt(e.target.value) || 20)}
                />
                <span>{t('projection.horizonYears')}</span>
              </div>
            </div>
            <div className="form-row">
              <label>{t('projection.createScenarioDriversTitle')}</label>
              <div className="create-scenario-driver-grid">
                {(['vesi', 'jatevesi'] as const).map((service) => (
                  <div key={service} className="create-scenario-driver-card">
                    <strong>{t(service === 'vesi' ? 'projection.driverPlanner.water' : 'projection.driverPlanner.wastewater')}</strong>
                    <label>
                      {t('projection.driverPlanner.unitPrice')}
                      <input
                        type="number"
                        step="0.01"
                        value={newScenarioDrivers[service].yksikkohinta}
                        onChange={(e) => handleScenarioDriverDraftChange(service, 'yksikkohinta', e.target.value)}
                      />
                    </label>
                    <label>
                      {t('projection.driverPlanner.volume')}
                      <input
                        type="number"
                        step="1"
                        value={newScenarioDrivers[service].myytyMaara}
                        onChange={(e) => handleScenarioDriverDraftChange(service, 'myytyMaara', e.target.value)}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-row">
              <label>{t('projection.createScenarioInvestmentsTitle')}</label>
              <table className="financing-investments-table financing-investments-table--compact">
                <thead>
                  <tr>
                    <th>{t('projection.financing.year')}</th>
                    <th className="num-col">{t('projection.financing.amount')} (EUR)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {newScenarioInvestments.map((item, index) => (
                    <tr key={`${item.year}-${index}`}>
                      <td>
                        <select
                          value={item.year}
                          onChange={(e) => handleScenarioInvestmentDraftChange(index, 'year', Number(e.target.value))}
                        >
                          {createModalYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </td>
                      <td className="num-col">
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleScenarioInvestmentDraftChange(index, 'amount', Number(e.target.value) || 0)}
                        />
                      </td>
                      <td>
                        <button type="button" className="btn-link" onClick={() => handleRemoveScenarioInvestmentDraft(index)}>
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" className="btn btn-secondary" onClick={handleAddScenarioInvestmentDraft}>
                {t('projection.financing.addInvestment')}
              </button>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={resetCreateScenarioForm}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn-primary" onClick={handleCreate} disabled={!newName.trim() || !newBudgetId}>
                {t('projection.createScenario')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI Strip ── */}
      {hasComputedData && activeProjection && (
        <div className="ev2-kpi-strip" role="status" aria-live="polite">
          <div className="ev2-kpi ev2-kpi--primary">
            <span className="ev2-kpi__label">{tv2('kpiRequiredTariff')}</span>
            <span className="ev2-kpi__value">{formatTariffEurPerM3(activeProjection.requiredTariff ?? undefined)}</span>
          </div>
          <div className="ev2-kpi">
            <span className="ev2-kpi__label">{tv2('kpiTariffNext')}</span>
            <span className="ev2-kpi__value">{formatTariffEurPerM3(tariffYearPlusOne)}</span>
          </div>
          <div className="ev2-kpi">
            <span className="ev2-kpi__label">{tv2('kpiCumulative')}</span>
            <span className={`ev2-kpi__value ${finalCumulative >= 0 ? 'ev2-positive' : 'ev2-negative'}`}>
              {formatEurInt(finalCumulative)}
            </span>
          </div>
          <div className="ev2-kpi">
            <span className="ev2-kpi__label">{tv2('kpiInvestments')}</span>
            <span className="ev2-kpi__value">{formatEurInt(selectedYearInvestments)}</span>
          </div>
          <div className="ev2-kpi">
            <span className="ev2-kpi__label">{tv2('kpiCashflow')}</span>
            <span className={`ev2-kpi__value ${(selectedYearCashflow ?? 0) >= 0 ? 'ev2-positive' : 'ev2-negative'}`}>
              {formatEurInt(selectedYearCashflow)}
            </span>
          </div>
          <label className="ev2-kpi ev2-kpi--select">
            <span className="ev2-kpi__label">{tv2('selectYear')}</span>
            <select
              className="ev2-select"
              value={effectiveSelectedYear ?? ''}
              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value, 10) : null)}
            >
              {years.map((y) => (
                <option key={y.vuosi} value={y.vuosi}>{y.vuosi}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* ── Main chart ── */}
      <div className="ev2-chart-section">
        {hasComputedData ? (
          <Suspense fallback={<div className="ev2-chart-skeleton" />}>
            <EnnusteComboChartLazy
              years={years}
              selectedYear={effectiveSelectedYear}
              onYearClick={(yr) => setSelectedYear(yr)}
            />
          </Suspense>
        ) : (
          <div className="ev2-chart-empty">
            <p>{tv2('noDataHint')}</p>
          </div>
        )}
      </div>

      {/* ── Below-chart grid: inputs (right) + year cards (left) ── */}
      {activeProjection && (
        <div className="ev2-body-grid" id="ennuste-syota">

          {/* ── Left: year cards ── */}
          <aside className="ev2-year-cards" aria-label="Vuositiedot">
            {hasComputedData ? (
              <div className="ev2-year-cards__list">
                {years.map((y, idx) => {
                  const tulos = num(y.tulos);
                  const kv = typeof y.kassafloede === 'number' ? y.kassafloede : tulos - num(y.investoinnitYhteensa);
                  const isSelected = y.vuosi === effectiveSelectedYear;
                  const isBase = idx === 0;
                  return (
                    <button
                      key={y.vuosi}
                      type="button"
                      className={`ev2-year-card${isSelected ? ' ev2-year-card--selected' : ''}${tulos < 0 ? ' ev2-year-card--deficit' : ''}`}
                      onClick={() => setSelectedYear(y.vuosi)}
                      aria-pressed={isSelected}
                      aria-label={`${y.vuosi}${isBase ? ', perusvuosi' : ''}`}
                    >
                      <div className="ev2-year-card__header">
                        <strong>{y.vuosi}</strong>
                        {isBase && <span className="ev2-badge ev2-badge--base">perusta</span>}
                        {tulos < 0 && !isBase && <span className="ev2-badge ev2-badge--deficit">alijäämä</span>}
                      </div>
                      <div className="ev2-year-card__row">
                        <span>Tulot</span>
                        <span>{formatEurInt(y.tulotYhteensa)}</span>
                      </div>
                      <div className="ev2-year-card__row">
                        <span>Käyttömenot</span>
                        <span>{formatEurInt(y.kulutYhteensa)}</span>
                      </div>
                      {num(y.investoinnitYhteensa) > 0 && (
                        <div className="ev2-year-card__row ev2-year-card__row--inv">
                          <span>Investoinnit</span>
                          <span>{formatEurInt(y.investoinnitYhteensa)}</span>
                        </div>
                      )}
                      <div className={`ev2-year-card__row ev2-year-card__row--kv ${kv >= 0 ? 'ev2-positive' : 'ev2-negative'}`}>
                        <span>Kassavirta</span>
                        <span>{formatEurInt(kv)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ev2-year-cards__empty">
                <p>{tv2('noDataHint')}</p>
              </div>
            )}
          </aside>

          {/* ── Right: inputs ── */}
          <div className="ev2-inputs" id="ennuste-tulokset">

            {/* Compute button — always at top */}
            <div className="ev2-compute-bar">
              <button
                className="ev2-compute-btn"
                data-testid="projection-recalc-btn"
                onClick={handleCompute}
                disabled={computing || driverPathsDirty || savingDriverPaths || !canCompute}
                title={!canCompute ? t('projection.noDriversForCompute') : driverPathsDirty ? tv2('saveBeforeCompute') : undefined}
              >
                {computing
                  ? tv2('computingBtn')
                  : hasComputedData
                    ? tv2('computeBtn')
                    : tv2('firstComputeBtn')}
              </button>
              {hasComputedData && activeProjection.updatedAt && (
                <span className="ev2-last-computed" role="status" data-testid="projection-last-computed">
                  {t('projection.lastComputed')}: {new Date(activeProjection.updatedAt).toLocaleString('fi-FI', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              )}
              {driverPathsDirty && (
                <span className="ev2-dirty-hint" role="alert">{tv2('saveBeforeCompute')}</span>
              )}
              {horizonChangedNotice && !driverPathsDirty && (
                <span className="ev2-dirty-hint" role="status">{t('projection.horizonChangedNotice')}</span>
              )}
            </div>

            {/* ── Olettamukset ── */}
            <section className="ev2-input-section">
              <h2 className="ev2-input-section__title">{tv2('assumptionsTitle')}</h2>
              <div className="ev2-assumptions-grid">
                {([
                  { key: 'vesimaaran_muutos', label: tv2('assumptionVesimaara') },
                  { key: 'inflaatio', label: tv2('assumptionHenkilosto') },
                  { key: 'energiakerroin', label: tv2('assumptionKayttomenot') },
                  { key: 'hintakorotus', label: tv2('assumptionTariffi') },
                  { key: 'investointikerroin', label: tv2('assumptionInvestointi') },
                ] as const).map(({ key, label }) => {
                  const hasOv = overrides[key] !== null;
                  return (
                    <div key={key} className={`ev2-assumption-row${hasOv ? ' ev2-assumption-row--overridden' : ''}`}>
                      <label className="ev2-assumption-label">{label}</label>
                      <AssumptionInput
                        value={overrides[key] ?? getOrgDefault(key)}
                        onChange={(v) => setOverride(key, v)}
                      />
                      {hasOv && (
                        <button
                          type="button"
                          className="ev2-btn-reset"
                          onClick={() => setOverride(key, null)}
                          title={t('projection.useDefault')}
                        >
                          ↺
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Horizon */}
              <div className="ev2-horizon-row">
                <label htmlFor="ev2-horizon-select" className="ev2-assumption-label">{tv2('horizonLabel')}</label>
                <select
                  id="ev2-horizon-select"
                  className="ev2-select"
                  value={activeProjection.aikajaksoVuosia}
                  onChange={(e) => handleHorizonChange(parseInt(e.target.value, 10))}
                >
                  {[3, 5, 7, 10, 15, 20].map((n) => (
                    <option key={n} value={n}>{n} {tv2('horizonUnit')}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* ── Myyty vesimäärä ── */}
            <section className="ev2-input-section">
              <h2 className="ev2-input-section__title">{tv2('volumeTitle')}</h2>
              <p className="ev2-input-hint">{tv2('volumeHint')}</p>

              {/* History volumes */}
              {historyBaselineRows.length > 0 && (
                <div className="ev2-volume-table ennuste-history-volume-controls">
                  <div className="ev2-volume-table__header">
                    <span className="ev2-volume-label ev2-muted">{tv2('historyYearsLabel')}</span>
                  </div>
                  {historyBaselineRows.map((row) => (
                    <label key={row.id} className={`ev2-volume-row${row.isActive ? ' ev2-volume-row--active' : ''}`}>
                      <span className="ev2-volume-row__year">
                        {row.vuosi}
                        {row.isActive && <span className="ev2-badge ev2-badge--base">perusta</span>}
                      </span>
                      <input
                        className="ev2-input ev2-input--num"
                        type="number"
                        min={0}
                        step={1}
                        value={historyVolumes[row.id] ?? 0}
                        onChange={(e) => {
                          const parsed = Number(e.target.value);
                          setHistoryVolumes((prev) => ({ ...prev, [row.id]: Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0 }));
                        }}
                        onBlur={(e) => {
                          const parsed = Number(e.currentTarget.value);
                          void handleHistoryVolumeCommit(row.id, Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0);
                        }}
                      />
                      <span className="ev2-muted">m³/v</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Future years volume (from computed data, first 3 editable via driverPaths) */}
              {hasComputedData && years.length > 1 && (
                <div className="ev2-volume-table">
                  <div className="ev2-volume-table__header">
                    <span className="ev2-volume-label ev2-muted">{tv2('futureYearsLabel')}</span>
                  </div>
                  {years.slice(1).map((y) => (
                    <div key={y.vuosi} className="ev2-volume-row ev2-volume-row--future">
                      <span className="ev2-volume-row__year">{y.vuosi}</span>
                      <span className="ev2-volume-row__value">{formatM3Int(y.myytyVesimaara)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── Investoinnit ── */}
            <section className="ev2-input-section">
              <h2 className="ev2-input-section__title">{tv2('investmentsTitle')}</h2>
              <p className="ev2-input-hint">{tv2('investmentsHint')}</p>
              <div className="ev2-investments-list">
                {userInvestments.map((u, i) => (
                  <div key={`${u.year}-${i}`} className="ev2-investment-row">
                    <select
                      className="ev2-select ev2-select--year"
                      value={u.year}
                      onChange={(e) => handleUserInvestmentChange(i, 'year', parseInt(e.target.value, 10))}
                    >
                      {plannerYears.map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                    <input
                      className="ev2-input ev2-input--num"
                      type="number"
                      step={1000}
                      value={u.amount}
                      onChange={(e) => handleUserInvestmentChange(i, 'amount', parseInt(e.target.value, 10) || 0)}
                    />
                    <span className="ev2-muted">€</span>
                    <button
                      type="button"
                      className="ev2-btn-remove"
                      onClick={() => handleRemoveUserInvestment(i)}
                      aria-label={tv2('removeInvestment')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="ev2-investments-actions">
                <button type="button" className="ev2-btn" onClick={handleAddUserInvestment}>
                  + {tv2('addInvestment')}
                </button>
                <button type="button" className="ev2-btn ev2-btn--primary" onClick={handleSaveUserInvestments}>
                  {t('common.save')}
                </button>
              </div>
            </section>

            {/* ── Advanced: tuloajurit ── */}
            <section className="ev2-input-section">
              <button
                type="button"
                className="ev2-accordion-trigger"
                aria-expanded={openAccordionSyota.has('tuloajurit')}
                onClick={() => toggleAccordionSyota('tuloajurit')}
              >
                {tv2('advancedTitle')} {openAccordionSyota.has('tuloajurit') ? '▲' : '▼'}
              </button>
              {openAccordionSyota.has('tuloajurit') && plannerYears.length > 0 && (
                <div className="ev2-accordion-panel">
                  <DriverPlanner
                    years={plannerYears}
                    baseValues={driverBaseValues}
                    value={driverPaths}
                    onChange={setDriverPaths}
                  />
                  <div className="ev2-investments-actions">
                    <button type="button" className="ev2-btn" onClick={() => setDriverPaths(undefined)} disabled={!driverPaths}>
                      {t('projection.driverPlanner.reset')}
                    </button>
                    <button
                      type="button"
                      className={driverPathsDirty ? 'ev2-btn ev2-btn--primary' : 'ev2-btn'}
                      onClick={handleSaveDriverPaths}
                      disabled={!driverPathsDirty || savingDriverPaths}
                    >
                      {savingDriverPaths ? t('common.loading') : t('projection.driverPlanner.save')}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* ── Results table — always visible when computed ── */}
            {hasComputedData && (
              <section className="ev2-input-section" id="projection-results-view">
                <Suspense fallback={<ProjectionTableSkeleton />}>
                  <div className="projection-table-wrapper">
                    <ProjectionResultsTableLazy years={years} t={t} />
                  </div>
                </Suspense>
                <details className="revenue-report-section">
                  <summary className="revenue-report-toggle">{t('projection.showRevenueBreakdown')}</summary>
                  <RevenueReport years={years} scenarioName={activeProjection.nimi} />
                </details>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ── Empty states ── */}
      {!activeProjection && projections.length === 0 && !showCreateForm && (
        <div className="ev2-empty-state">
          <p>{AUTO_BOOTSTRAP_ENABLED ? t('projection.bootstrapPendingHint') : t('projection.noDataHint')}</p>
          <div className="ev2-empty-state__actions">
            <button className="ev2-btn ev2-btn--primary" disabled={loading || bootstrappingProjection} onClick={loadData}>
              {bootstrappingProjection ? t('common.loading') : t('common.retry')}
            </button>
            {isDemoEnabled && (
              <button className="ev2-btn" disabled={seedingDemo}
                onClick={async () => {
                  setSeedingDemo(true); setError(null);
                  try { await seedDemoData(); await loadData(); }
                  catch (e: any) { setError(e.message || t('projection.errorLoadFailed')); }
                  finally { setSeedingDemo(false); }
                }}
              >
                {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function stableStringifyPaths(input?: DriverPaths | null): string {
  if (!input) return '';
  const sortObject = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(obj[key]);
        return acc;
      }, {} as Record<string, unknown>);
  };
  return JSON.stringify(sortObject(input));
}

function cloneDriverPaths(input?: DriverPaths | null): DriverPaths | undefined {
  if (!input) return undefined;
  return JSON.parse(JSON.stringify(input)) as DriverPaths;
}

function parseDraftNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDraftNumber(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return String(value);
}

function buildScenarioDriverPaths(draft: ScenarioDriverDraft, baseYear: number): DriverPaths | undefined {
  const next: DriverPaths = {};
  for (const service of ['vesi', 'jatevesi'] as const) {
    const price = parseDraftNumber(draft[service].yksikkohinta);
    const volume = parseDraftNumber(draft[service].myytyMaara);
    const servicePlan: NonNullable<DriverPaths[typeof service]> = {};
    if (price !== undefined) {
      servicePlan.yksikkohinta = { mode: 'manual', values: { [baseYear]: price } };
    }
    if (volume !== undefined) {
      servicePlan.myytyMaara = { mode: 'manual', values: { [baseYear]: volume } };
    }
    if (Object.keys(servicePlan).length > 0) {
      next[service] = servicePlan;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

