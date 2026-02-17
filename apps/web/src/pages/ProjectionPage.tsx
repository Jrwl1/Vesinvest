/** V1: Projection view is VAT-free; no VAT inputs or VAT in displayed amounts. */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { ProjectionCharts } from '../components/ProjectionCharts';
import { useDemoStatus } from '../context/DemoStatusContext';
import { useNavigation } from '../context/NavigationContext';
import {
  formatDecimal,
  formatEurInt,
  formatM3Int,
  formatTariffEurPerM3,
} from '../utils/format';
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

/** Classify the projection: sustainable / tight / unsustainable */
function getVerdict(years: ProjectionYear[]): 'sustainable' | 'tight' | 'unsustainable' {
  if (years.length === 0) return 'tight';
  const deficitYears = years.filter((y) => num(y.tulos) < 0).length;
  if (deficitYears === 0) return 'sustainable';
  if (deficitYears <= Math.ceil(years.length * 0.3)) return 'tight';
  return 'unsustainable';
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

  // Comparison mode
  const [showComparison, setShowComparison] = useState(false);

  // Result view: table vs diagram (S-04)
  const [resultViewMode, setResultViewMode] = useState<'table' | 'diagram'>('table');
  const [showResultsTable, setShowResultsTable] = useState(false);
  const [showRevenueReport, setShowRevenueReport] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [userInvestments, setUserInvestments] = useState<Array<{ year: number; amount: number }>>([]);
  type AccordionSyotaId = 'olettamukset' | 'investoinnit' | 'tuloajurit';
  const [openAccordionSyota, setOpenAccordionSyota] = useState<Set<AccordionSyotaId>>(new Set(['olettamukset']));
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
  const { navigateToTab } = useNavigation();

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
      setError(e.message || 'Failed to load projection');
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
      setError(e.message || 'Failed to load data');
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
    setShowResultsTable(false);
    setOpenAccordionSyota(new Set(['olettamukset']));
  }, [activeProjection?.id]);

  const years = activeProjection?.vuodet ?? [];
  const effectiveSelectedYear = selectedYear ?? years[0]?.vuosi ?? null;
  useEffect(() => {
    if (years.length > 0 && (effectiveSelectedYear == null || !years.some((y) => y.vuosi === effectiveSelectedYear))) {
      setSelectedYear(years[0].vuosi);
    }
  }, [years, effectiveSelectedYear]);

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
      setError(e.message || 'Failed to create projection');
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
      setError(e.message || 'Failed to delete projection');
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
      setError(e.message || 'Failed to save driver inputs');
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

    // Collect overrides
    const cleanOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== null) {
        cleanOverrides[key] = value;
      }
    }
    const hasOverrides = Object.keys(cleanOverrides).length > 0;

    try {
      // Try the normal PATCH + compute path first
      await updateProjection(activeProjection.id, {
        olettamusYlikirjoitukset: hasOverrides ? cleanOverrides : undefined,
      });
      const result = await computeProjection(activeProjection.id);
      setActiveProjection(result);
    } catch (e: any) {
      const msg = String(e.message || '');
      const is404 = msg.includes('404') || msg.includes('not found');

      if (is404 && activeProjection.talousarvioId) {
        // Stale projection ID: fall back to budget-based upsert compute (baseline only; do not pass scenario overrides/paths)
        try {
          const result = await computeForBudget(activeProjection.talousarvioId);
          setActiveProjection(result);
          // Re-fetch projection list so tabs are in sync
          const projList = await listProjections();
          setProjections(projList);
        } catch (e2: any) {
          setError(e2.message || 'Failed to compute projection');
        }
      } else {
        setError(msg || 'Failed to compute projection');
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
      .catch((e) => setError('Export failed'));
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
      .catch((e) => setError('Export PDF failed'));
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
      setError(e.message || 'Failed to save investments');
    }
  };

  const handleHorizonChange = async (value: number) => {
    if (!activeProjection) return;
    try {
      await updateProjection(activeProjection.id, { aikajaksoVuosia: value });
      const updated = await getProjection(activeProjection.id);
      setActiveProjection(updated);
    } catch (e: any) {
      const msg = String(e.message || '');
      if (msg.includes('404') || msg.includes('not found')) {
        // Stale: re-fetch everything
        setDataVersion((v) => v + 1);
      } else {
        setError(msg);
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
        setError(e.message || 'Failed to load demo data');
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
  const verdict = hasComputedData ? getVerdict(years) : null;
  const canCompute = Boolean(activeProjection?.talousarvioId);
  const deficitYearsCount = years.filter((y) => num(y.tulos) < 0).length;
  const selectedYearData = effectiveSelectedYear != null
    ? years.find((year) => year.vuosi === effectiveSelectedYear) ?? null
    : null;
  const finalYear = years.length > 0 ? years[years.length - 1] : null;
  const finalCumulative = finalYear ? num(finalYear.kumulatiivinenTulos) : 0;
  const sustainabilityState = verdict === 'sustainable' ? 'sustainable' : 'not-sustainable';
  const selectedYearDepreciation = selectedYearData
    ? num(selectedYearData.poistoPerusta) + num(selectedYearData.poistoInvestoinneista)
    : 0;

  const firstYear = years.length > 0 ? years[0] : null;
  const lastYear = years.length > 0 ? years[years.length - 1] : null;
  const volumeTrendText = firstYear && lastYear
    ? `${firstYear.vuosi}: ${formatM3Int(firstYear.myytyVesimaara)} -> ${lastYear.vuosi}: ${formatM3Int(lastYear.myytyVesimaara)}`
    : '—';
  const opexTrendText = `${formatPercent(getEffectiveValue('energiakerroin'))} ${t('common.perYear')}`;
  const capexDepreciationTotal = years.reduce((sum, year) => sum + num(year.poistoInvestoinneista), 0);
  const capexImpactText = hasComputedData
    ? `${formatEurInt(capexDepreciationTotal)} (${t('projection.columns.investmentDepreciation')})`
    : '—';

  return (
    <div className="projection-page" data-ennuste-layout="codex">
      <header className="ennuste-topbar" aria-label={t('projection.title')}>
        <h1 className="ennuste-title">{t('projection.title')}</h1>
        <div className="ennuste-actions">
          {projections.length >= 2 && (
            <button type="button" className="ennuste-btn" onClick={() => setShowComparison(true)}>
              {t('projection.compare')}
            </button>
          )}
          {hasComputedData && (
            <>
              <button type="button" className="ennuste-btn" onClick={handleExport}>
                {t('projection.exportCsv')}
              </button>
              <button type="button" className="ennuste-btn" onClick={handleExportPdf}>
                {t('projection.exportPdf')}
              </button>
            </>
          )}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {activeProjection && !canCompute && (
        <div className="projection-no-drivers-banner" role="alert">
          {t('projection.noDriversForCompute')}
        </div>
      )}

      {/* Scenario comparison overlay */}
      {showComparison && (
        <ScenarioComparison onClose={() => setShowComparison(false)} />
      )}

      {/* Scenario selector — Codex pills */}
      {projections.length > 0 && (
        <nav className="ennuste-scenarios" aria-label={t('projection.scenario')}>
          {projections.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ennuste-pill ${activeProjection?.id === p.id ? 'active' : ''}`}
              onClick={() => selectProjection(p.id)}
            >
              {p.nimi}
              {p.onOletus && ' *'}
            </button>
          ))}
          <button type="button" className="ennuste-btn ennuste-btn-primary" onClick={openCreateScenarioForm}>
            {t('projection.createScenario')}
          </button>
          {activeProjection && (
            <button
              type="button"
              className="ennuste-btn btn-danger-text"
              onClick={handleDelete}
              title={t('projection.deleteScenario')}
              aria-label={t('projection.deleteScenarioAria', { name: activeProjection.nimi })}
            >
              × {t('projection.deleteScenario')}
            </button>
          )}
        </nav>
      )}

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

      {activeProjection && (
        <>
          <section id="ennuste-syota" className="ennuste-zone" aria-labelledby="ennuste-syota-heading">
            <h2 id="ennuste-syota-heading" className="ennuste-zone__heading">{t('projection.zoneInput')}</h2>
            <div className="ennuste-syota-mini-summary" role="status" aria-live="polite">
              <span>
                {t('projection.horizon')} {activeProjection.aikajaksoVuosia ?? 0} {t('projection.horizonYears')}
                {' · '}
                {t('projection.miniSummaryVolym')} {formatPercent(overrides['vesimaaran_muutos'] ?? getOrgDefault('vesimaaran_muutos'))}
                {' · '}
                {t('projection.miniSummaryKulut')} {formatPercent(overrides['energiakerroin'] ?? getOrgDefault('energiakerroin'))}
                {' · '}
                {t('projection.miniSummaryInvestoinnit')} {userInvestments.length}
              </span>
            </div>
            <div id="projection-variables" className="card projection-assumptions-card">
              <div className="projection-assumptions-card__accordion" role="region" aria-label={t('projection.assumptionsCardTitle')}>
                {/* Olettamukset — open by default */}
                <div className="accordion-syota__item">
                  <button
                    type="button"
                    className="accordion-syota__trigger btn-toggle"
                    aria-expanded={openAccordionSyota.has('olettamukset')}
                    onClick={() => toggleAccordionSyota('olettamukset')}
                    aria-controls="accordion-syota-olettamukset"
                    id="accordion-syota-olettamukset-trigger"
                  >
                    {t('projection.assumptions')} {openAccordionSyota.has('olettamukset') ? '▲' : '▼'}
                  </button>
                  {openAccordionSyota.has('olettamukset') && (
                    <div id="accordion-syota-olettamukset" className="accordion-syota__panel" role="region" aria-labelledby="accordion-syota-olettamukset-trigger">
                      <div className="projection-assumptions-card__header">
                        <div>
                          <h3>{t('projection.assumptionsCardTitle')}</h3>
                          <p>{activeProjection.talousarvio?.nimi ?? '—'} ({activeProjection.talousarvio?.vuosi})</p>
                        </div>
                        <div className="projection-assumptions-card__horizon">
                          <label htmlFor="projection-horizon-select">{t('projection.horizon')}</label>
                          <select
                            id="projection-horizon-select"
                            value={activeProjection.aikajaksoVuosia}
                            onChange={(e) => handleHorizonChange(parseInt(e.target.value, 10))}
                          >
                            {[3, 5, 7, 10, 15, 20].map((n) => (
                              <option key={n} value={n}>{n} {t('projection.horizonYears')}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-toggle controls-row__assumptions"
                        onClick={() => setShowAssumptions((prev) => !prev)}
                        aria-expanded={showAssumptions}
                        aria-label={showAssumptions ? t('projection.assumptionsClose') : t('projection.assumptionsOpen')}
                      >
                        <span className="controls-row__assumptions-icon" aria-hidden>⚙</span>
                        {t('projection.assumptionOverrides')} {showAssumptions ? '▲' : '▼'}
                      </button>
                      {showAssumptions && (
                        <div className="assumptions-panel">
                          <h4>{t('projection.assumptionOverrides')}</h4>
                          <table className="assumptions-table">
                            <thead>
                              <tr>
                                <th>{t('assumptions.title')}</th>
                                <th>{t('projection.orgDefault')}</th>
                                <th>{t('projection.overrideValue')}</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {ASSUMPTION_KEYS.map((key) => {
                                const orgDefault = getOrgDefault(key);
                                const hasOverride = overrides[key] !== null;
                                const labelKey = key === 'inflaatio' ? 'inflation'
                                  : key === 'energiakerroin' ? 'energyFactor'
                                  : key === 'vesimaaran_muutos' ? 'volumeChange'
                                  : key === 'hintakorotus' ? 'priceIncrease'
                                  : 'investmentFactor';

                                return (
                                  <tr key={key} className={hasOverride ? 'overridden' : ''}>
                                    <td>{t(`assumptions.${labelKey}`)}</td>
                                    <td className="value-cell">{formatPercent(orgDefault)}</td>
                                    <td className="value-cell">
                                      {hasOverride ? (
                                        <AssumptionInput
                                          value={overrides[key] ?? 0}
                                          onChange={(v) => setOverride(key, v)}
                                        />
                                      ) : (
                                        <span className="muted">{formatPercent(orgDefault)}</span>
                                      )}
                                    </td>
                                    <td>
                                      {hasOverride ? (
                                        <button className="btn-link" onClick={() => setOverride(key, null)}>
                                          {t('projection.useDefault')}
                                        </button>
                                      ) : (
                                        <button className="btn-link" onClick={() => setOverride(key, orgDefault)}>
                                          {t('common.edit')}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Investoinnit */}
                <div className="accordion-syota__item">
                  <button
                    type="button"
                    className="accordion-syota__trigger btn-toggle"
                    aria-expanded={openAccordionSyota.has('investoinnit')}
                    onClick={() => toggleAccordionSyota('investoinnit')}
                    aria-controls="accordion-syota-investoinnit"
                    id="accordion-syota-investoinnit-trigger"
                  >
                    {t('projection.financing.investments')} {openAccordionSyota.has('investoinnit') ? '▲' : '▼'}
                  </button>
                  {openAccordionSyota.has('investoinnit') && (
                    <div id="accordion-syota-investoinnit" className="accordion-syota__panel projection-assumptions-card__section" role="region" aria-labelledby="accordion-syota-investoinnit-trigger">
                      <table className="financing-investments-table">
                        <thead>
                          <tr>
                            <th>{t('projection.financing.year')}</th>
                            <th className="num-col">{t('projection.financing.amount')} (€)</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {userInvestments.map((u, i) => (
                            <tr key={`${u.year}-${i}`}>
                              <td>
                                <select
                                  value={u.year}
                                  onChange={(e) => handleUserInvestmentChange(i, 'year', parseInt(e.target.value, 10))}
                                >
                                  {plannerYears.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="num-col">
                                <input
                                  type="number"
                                  value={u.amount}
                                  onChange={(e) => handleUserInvestmentChange(i, 'amount', parseInt(e.target.value, 10) || 0)}
                                />
                              </td>
                              <td>
                                <button type="button" className="btn-link" onClick={() => handleRemoveUserInvestment(i)}>
                                  {t('common.delete')}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="financing-investments-actions">
                        <button type="button" className="btn btn-secondary" onClick={handleAddUserInvestment}>
                          {t('projection.financing.addInvestment')}
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleSaveUserInvestments}>
                          {t('common.save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tuloajuriden suunnittelu */}
                <div className="accordion-syota__item">
                  <button
                    type="button"
                    className="accordion-syota__trigger btn-toggle"
                    aria-expanded={openAccordionSyota.has('tuloajurit')}
                    onClick={() => toggleAccordionSyota('tuloajurit')}
                    aria-controls="accordion-syota-tuloajurit"
                    id="accordion-syota-tuloajurit-trigger"
                  >
                    {t('projection.driverPlanner.title')} {openAccordionSyota.has('tuloajurit') ? '▲' : '▼'}
                  </button>
                  {openAccordionSyota.has('tuloajurit') && plannerYears.length > 0 && (
                    <div id="accordion-syota-tuloajurit" className="accordion-syota__panel projection-assumptions-card__section" role="region" aria-labelledby="accordion-syota-tuloajurit-trigger">
                      <DriverPlanner
                        years={plannerYears}
                        baseValues={driverBaseValues}
                        value={driverPaths}
                        onChange={setDriverPaths}
                      />
                      <div className="driver-planner-actions">
                        <button
                          type="button"
                          className="btn btn-secondary driver-planner-actions__reset"
                          onClick={() => setDriverPaths(undefined)}
                          disabled={!driverPaths}
                        >
                          {t('projection.driverPlanner.reset')}
                        </button>
                        <button
                          type="button"
                          className={driverPathsDirty ? 'btn btn-primary driver-planner-actions__save' : 'btn btn-secondary driver-planner-actions__save'}
                          onClick={handleSaveDriverPaths}
                          disabled={!driverPathsDirty || savingDriverPaths}
                        >
                          {savingDriverPaths ? t('common.loading') : t('projection.driverPlanner.save')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="projection-controls__compute-wrap projection-assumptions-card__compute">
                {hasComputedData && activeProjection.updatedAt && (
                  <span className="projection-controls__last-computed" role="status">
                    {t('projection.lastComputed')}: {new Date(activeProjection.updatedAt).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                )}
                <button
                  className="btn-primary btn-compute"
                  onClick={handleCompute}
                  disabled={computing || driverPathsDirty || savingDriverPaths || !canCompute}
                  title={!canCompute ? t('projection.noDriversForCompute') : driverPathsDirty ? t('projection.driverPlanner.saveBeforeCompute') : undefined}
                >
                  {computing ? t('projection.computing') : (hasComputedData ? t('projection.recompute') : t('projection.compute'))}
                </button>
                {driverPathsDirty && (
                  <span className="projection-controls__dirty-hint" role="status">
                    {t('projection.driverPlanner.saveBeforeCompute')}
                  </span>
                )}
              </div>
            </div>
          </section>
          <section id="ennuste-tulokset" className="ennuste-zone" aria-labelledby="ennuste-tulokset-heading">
            <h2 id="ennuste-tulokset-heading" className="ennuste-zone__heading">{t('projection.zoneResults')}</h2>
          <section className="projection-hero">
            <div className="projection-hero__left">
              <div className="card projection-kpi-panel" role="status" aria-live="polite">
                <div className="projection-kpi-grid">
                  <div className="projection-kpi-card">
                    <span className="projection-kpi-card__label">{t('projection.kpi.sustainability')}</span>
                    <span className={`projection-sustainability projection-sustainability--${sustainabilityState}`}>
                      {verdict === 'sustainable' ? t('projection.verdict.sustainable') : t('projection.verdict.notSustainable')}
                    </span>
                  </div>
                  <div className="projection-kpi-card">
                    <span className="projection-kpi-card__label">{t('projection.summary.requiredTariff')}</span>
                    <span className="projection-kpi-card__value">{formatTariffEurPerM3(activeProjection.requiredTariff ?? undefined)}</span>
                  </div>
                  <div className="projection-kpi-card">
                    <span className="projection-kpi-card__label">{t('projection.kpi.finalCumulative')}</span>
                    <span className={`projection-kpi-card__value ${finalCumulative >= 0 ? 'positive' : 'negative'}`}>
                      {hasComputedData ? formatEurInt(finalCumulative) : '—'}
                    </span>
                  </div>
                  <div className="projection-kpi-card">
                    <span className="projection-kpi-card__label">{t('projection.kpi.deficitYears')}</span>
                    <span className="projection-kpi-card__value">
                      {hasComputedData ? `${deficitYearsCount}${t('projection.summary.of')}${years.length}` : `0${t('projection.summary.of')}0`}
                    </span>
                  </div>
                  <label className="projection-kpi-card projection-kpi-card--select">
                    <span className="projection-kpi-card__label">{t('projection.summary.selectYear')}</span>
                    <select
                      value={effectiveSelectedYear ?? ''}
                      onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={!hasComputedData}
                    >
                      {years.map((year) => (
                        <option key={year.vuosi} value={year.vuosi}>{year.vuosi}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="card projection-hero__right">
              <div className="projection-hero__chart-header">
                <h3>{t('projection.charts.tariffTrend')}</h3>
                <p>{t('projection.charts.tariffHint')}</p>
              </div>
              {hasComputedData ? (
                <ProjectionCharts years={years} mode="hero" />
              ) : (
                <div className="projection-hero__chart-empty">{t('projection.noDataHint')}</div>
              )}
            </div>
          </section>

          {hasComputedData ? (
            <>
              <section className="card projection-year-inspector" aria-label={t('projection.yearInspector.title')}>
                <h4>
                  {t('projection.yearInspector.title')} {effectiveSelectedYear != null ? `(${effectiveSelectedYear})` : ''}
                </h4>
                <div className="projection-year-inspector__grid">
                  <div>
                    <span>{t('projection.columns.revenue')}</span>
                    <strong>{selectedYearData ? formatEurInt(selectedYearData.tulotYhteensa) : '—'}</strong>
                  </div>
                  <div>
                    <span>{t('projection.columns.expenses')}</span>
                    <strong>{selectedYearData ? formatEurInt(selectedYearData.kulutYhteensa) : '—'}</strong>
                  </div>
                  <div>
                    <span>{t('projection.columns.depreciation')}</span>
                    <strong>{selectedYearData ? formatEurInt(selectedYearDepreciation) : '—'}</strong>
                  </div>
                  <div>
                    <span>{t('projection.columns.investments')}</span>
                    <strong>{selectedYearData ? formatEurInt(selectedYearData.investoinnitYhteensa) : '—'}</strong>
                  </div>
                  <div>
                    <span>{t('projection.columns.netResult')}</span>
                    <strong className={selectedYearData && num(selectedYearData.tulos) < 0 ? 'negative' : 'positive'}>
                      {selectedYearData ? formatEurInt(selectedYearData.tulos) : '—'}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="card projection-drivers-summary">
                <h4>{t('projection.topDrivers.title')}</h4>
                <ul>
                  <li><strong>{t('projection.topDrivers.volumeTrend')}:</strong> {volumeTrendText}</li>
                  <li><strong>{t('projection.topDrivers.opexTrend')}:</strong> {opexTrendText}</li>
                  <li><strong>{t('projection.topDrivers.capexImpact')}:</strong> {capexImpactText}</li>
                </ul>
              </section>

              <nav className="projection-anchor-nav" aria-label={t('projection.anchorNavLabel')}>
                <a href="#ennuste-syota">{t('projection.zoneInput')}</a>
                <a href="#ennuste-tulokset">{t('projection.zoneResults')}</a>
              </nav>

              {allZeroWaterDrivers && (
                <div className="projection-hint-banner info">
                  {t('projection.noDriversHintTable')}
                </div>
              )}

              <section id="projection-results-view">
                <div className="result-view-tabs" role="tablist" aria-label={t('projection.resultViewTabsLabel')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={resultViewMode === 'table'}
                    className={resultViewMode === 'table' ? 'active' : ''}
                    onClick={() => setResultViewMode('table')}
                  >
                    {t('projection.viewTabTable')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={resultViewMode === 'diagram'}
                    className={resultViewMode === 'diagram' ? 'active' : ''}
                    onClick={() => setResultViewMode('diagram')}
                  >
                    {t('projection.viewTabDiagram')}
                  </button>
                </div>

                {resultViewMode === 'table' && (
                  <div className="card projection-table-collapse">
                    <button
                      type="button"
                      className="btn-toggle projection-table-toggle"
                      onClick={() => setShowResultsTable((prev) => !prev)}
                      aria-expanded={showResultsTable}
                    >
                      {showResultsTable ? t('projection.hideTable') : t('projection.showTable')}
                    </button>
                    {showResultsTable && (
                      <div className="projection-table-wrapper">
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
                      </div>
                    )}
                  </div>
                )}

                {resultViewMode === 'diagram' && (
                  <div className="projection-diagram-wrapper card">
                    <ProjectionCharts years={years} />
                  </div>
                )}
              </section>

              <div id="projection-revenue" className="revenue-report-section">
                <button
                  type="button"
                  className="btn-toggle revenue-report-toggle"
                  onClick={() => setShowRevenueReport((prev) => !prev)}
                  aria-expanded={showRevenueReport}
                >
                  {showRevenueReport ? t('projection.hideRevenueBreakdown') : t('projection.showRevenueBreakdown')}
                  {showRevenueReport ? ' ▲' : ' ▼'}
                </button>
                {showRevenueReport && (
                  <RevenueReport
                    years={years}
                    scenarioName={activeProjection.nimi}
                  />
                )}
              </div>

              <footer className="projection-page-end" aria-label={t('projection.endOfPage')}>
                <span className="projection-page-end__label">{t('projection.endOfPage')}</span>
              </footer>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>{t('projection.noData')}</h3>
              <p>{t('projection.noDataHint')}</p>
              <button type="button" className="btn btn-primary empty-state__cta" onClick={handleCompute} disabled={computing}>
                {computing ? t('projection.computing') : t('projection.compute')}
              </button>
            </div>
          )}
          </section>
        </>
      )}

      {/* No projections available after load/bootstrap */}
      {projections.length === 0 && !showCreateForm && (
        <>
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>{t('projection.noData')}</h3>
            <p>{AUTO_BOOTSTRAP_ENABLED ? t('projection.bootstrapPendingHint') : t('projection.noDataHint')}</p>
            <div className="empty-state-actions">
              <button
                className="btn btn-primary"
                disabled={loading || bootstrappingProjection}
                onClick={loadData}
              >
                {bootstrappingProjection ? t('common.loading') : t('common.retry')}
              </button>
              {isDemoEnabled && (
                <button
                  className="btn btn-secondary"
                  disabled={seedingDemo}
                  onClick={async () => {
                    setSeedingDemo(true);
                    setError(null);
                    try {
                      await seedDemoData();
                      await loadData();
                    } catch (e: any) {
                      setError(e.message || 'Failed to load demo data');
                    } finally {
                      setSeedingDemo(false);
                    }
                  }}
                >
                  {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
                </button>
              )}
            </div>
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
                <tr><td colSpan={8} className="muted">{t('projection.noDataHint')}</td></tr>
              </tbody>
            </table>
          </div>
        </>
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
