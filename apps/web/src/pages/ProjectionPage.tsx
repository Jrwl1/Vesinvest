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
  listAssumptions,
  getProjectionExportUrl,
  getProjectionExportPdfUrl,
  seedDemoData,
  type Projection,
  type Budget,
  type Assumption,
  type DriverPaths,
  type ProjectionYearOverride,
  type ProjectionYearOverrides,
  type YearOverrideLockMode,
} from '../api';
import { ScenarioComparison } from '../components/ScenarioComparison';
import { RevenueReport } from '../components/RevenueReport';
import { EnnusteScenarioRow } from '../components/EnnusteScenarioRow';
import { EnnusteSyotaZone } from '../components/EnnusteSyotaZone';
import { EnnusteTuloksetZone } from '../components/EnnusteTuloksetZone';
import { EnnusteYearEditorDrawer, type YearEditorState } from '../components/EnnusteYearEditorDrawer';
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

const ASSUMPTION_KEYS = ['inflaatio', 'energiakerroin', 'henkilostokerroin', 'vesimaaran_muutos', 'hintakorotus', 'investointikerroin'];
const AUTO_BOOTSTRAP_FLAG = String(import.meta.env.VITE_PROJECTION_AUTO_BOOTSTRAP ?? 'true').toLowerCase();
const AUTO_BOOTSTRAP_ENABLED = !['0', 'false', 'off'].includes(AUTO_BOOTSTRAP_FLAG);

type ScenarioDriverDraft = Record<'vesi' | 'jatevesi', { yksikkohinta: string; myytyMaara: string }>;

const EMPTY_SCENARIO_DRIVER_DRAFT: ScenarioDriverDraft = {
  vesi: { yksikkohinta: '', myytyMaara: '' },
  jatevesi: { yksikkohinta: '', myytyMaara: '' },
};

function normalizeYearOverrides(
  input: ProjectionYearOverrides | null | undefined,
): ProjectionYearOverrides {
  if (!input || typeof input !== 'object') return {};
  const out: ProjectionYearOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    const year = Number(key);
    if (!Number.isFinite(year) || !value || typeof value !== 'object') continue;
    out[year] = { ...(value as ProjectionYearOverride) };
  }
  return out;
}

function mergeYearOverridesWithInvestments(
  base: ProjectionYearOverrides,
  investments: Array<{ year: number; amount: number }> | null | undefined,
): ProjectionYearOverrides {
  const out: ProjectionYearOverrides = { ...base };
  for (const inv of investments ?? []) {
    if (!Number.isFinite(inv.year) || !Number.isFinite(inv.amount)) continue;
    const year = Math.round(inv.year);
    out[year] = {
      ...(out[year] ?? {}),
      investmentEur: inv.amount,
    };
  }
  return out;
}

function yearOverridesToInvestments(
  overrides: ProjectionYearOverrides,
): Array<{ year: number; amount: number }> {
  return Object.entries(overrides)
    .map(([yearKey, value]) => ({
      year: Number(yearKey),
      amount: typeof value?.investmentEur === 'number' ? value.investmentEur : NaN,
    }))
    .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.amount));
}

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
  dataTestId?: string;
}> = ({ value, onChange, dataTestId }) => {
  const pct = value * 100;
  const [raw, setRaw] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  return (
    <span className="assumption-input-wrapper">
      <input
        type="text"
        inputMode="decimal"
        className="assumption-input"
        data-testid={dataTestId}
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

const EnnusteComboChartLazy = React.lazy(async () => {
  const module = await import('../components/EnnusteComboChart');
  return { default: module.EnnusteComboChart };
});

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
  const [computeValidation, setComputeValidation] = useState<{
    code: string;
    message: string;
    requiredMissing?: string[];
  } | null>(null);
  const [driverPaths, setDriverPaths] = useState<DriverPaths | undefined>(undefined);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBudgetId, setNewBudgetId] = useState('');
  const [newHorizon, setNewHorizon] = useState(20);
  const [newScenarioDrivers, setNewScenarioDrivers] = useState<ScenarioDriverDraft>(EMPTY_SCENARIO_DRIVER_DRAFT);
  const [newScenarioInvestments, setNewScenarioInvestments] = useState<Array<{ year: number; amount: number }>>([]);

  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  /** Ref mirror of overrides so handleCompute can read post-blur values after a tick (BUG 1: commit-on-blur). */
  const overridesRef = useRef<Record<string, number | null>>({});

  // Comparison mode
  const [showComparison, setShowComparison] = useState(false);

  // Horizon change notice
  const [horizonChangedNotice, setHorizonChangedNotice] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearEditorOpen, setYearEditorOpen] = useState(false);
  const [yearOverrides, setYearOverrides] = useState<ProjectionYearOverrides>({});
  const [savingYearOverrides, setSavingYearOverrides] = useState(false);
  const [userInvestments, setUserInvestments] = useState<Array<{ year: number; amount: number }>>([]);

  // Data version: increment to force re-fetch (e.g. after demo reset recovery)
  const [dataVersion, setDataVersion] = useState(0);

  const [seedingDemo, setSeedingDemo] = useState(false);
  const demoStatus = useDemoStatus();
  const isDemoEnabled = demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo';
  const { navigateToTab, state: navState } = useNavigation();

  const plannerYears = useMemo(() => {
    if (activeProjection?.talousarvio?.vuosi != null) {
      const horizon = activeProjection?.aikajaksoVuosia ?? 0;
      return Array.from({ length: horizon + 1 }, (_, idx) => activeProjection.talousarvio!.vuosi + idx);
    }
    return (activeProjection?.vuodet ?? []).map((y) => y.vuosi);
  }, [activeProjection?.talousarvio?.vuosi, activeProjection?.aikajaksoVuosia, activeProjection?.vuodet]);

  const driverPathsDirty = useMemo(() => {
    return stableStringifyPaths(driverPaths) !== stableStringifyPaths(activeProjection?.ajuriPolut);
  }, [driverPaths, activeProjection?.ajuriPolut]);

  const formatRequiredDriverLabel = useCallback((path: string) => {
    const [service, field] = path.split('.');
    const serviceLabel = service === 'vesi'
      ? t('revenue.water.title', 'Vesi')
      : t('revenue.wastewater.title', 'Jätevesi');
    const fieldLabel = field === 'yksikkohinta'
      ? t('revenue.water.unitPrice', 'Yksikköhinta')
      : t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)');
    return `${serviceLabel}: ${fieldLabel}`;
  }, [t]);

  const captureComputeValidation = useCallback((rawError: any) => {
    const code = String(rawError?.code ?? '');
    const details = rawError?.details ?? {};
    const message = typeof details?.remediation === 'string'
      ? details.remediation
      : (typeof details?.message === 'string' ? details.message : (rawError?.message || t('projection.errorComputeFailed')));
    const requiredMissing = Array.isArray(details?.requiredMissing)
      ? details.requiredMissing.filter((item: unknown): item is string => typeof item === 'string')
      : undefined;

    if (
      code === 'PROJECTION_BASELINE_DRIVERS_MISSING'
      || code === 'PROJECTION_BASELINE_REVENUE_MISMATCH'
      || code === 'PROJECTION_BASELINE_DRIVERS_INVALID'
    ) {
      setComputeValidation({ code, message, requiredMissing });
      return;
    }
    setComputeValidation(null);
  }, [t]);


  // -- Data Loading --

  const applyProjectionSelection = useCallback((full: Projection) => {
    setActiveProjection(full);
    const existingOverrides = (full.olettamusYlikirjoitukset as Record<string, number>) ?? {};
    const overrideState: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(existingOverrides)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        overrideState[key] = value;
      }
    }
    for (const key of ASSUMPTION_KEYS) {
      overrideState[key] = key in existingOverrides ? existingOverrides[key] : null;
    }
    setOverrides(overrideState);
    overridesRef.current = overrideState;
    const mergedYearOverrides = mergeYearOverridesWithInvestments(
      normalizeYearOverrides(full.vuosiYlikirjoitukset),
      Array.isArray(full.userInvestments) ? full.userInvestments : [],
    );
    setYearOverrides(mergedYearOverrides);
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
            captureComputeValidation(e);
            setError(msg || t('projection.errorComputeFailed'));
            applyProjectionSelection(selected);
            setProjections(await listProjections());
            return;
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
    try {
      const bootstrappedProjection = await computeForBudget(baselineBudget.id);
      applyProjectionSelection(bootstrappedProjection);
      setProjections(await listProjections());
    } catch (e: any) {
      captureComputeValidation(e);
      setError(e?.message || t('projection.errorComputeFailed'));
      const refreshed = await listProjections();
      setProjections(refreshed);
      if (refreshed.length > 0) {
        const fallback = refreshed.find((projection) => projection.onOletus)
          ?? [...refreshed].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        const fallbackFull = await getProjection(fallback.id);
        applyProjectionSelection(fallbackFull);
      } else {
        setActiveProjection(null);
      }
    }
  }, [applyProjectionSelection, captureComputeValidation, t]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setBootstrappingProjection(false);
    setError(null);
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
    setYearEditorOpen(false);
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

  useEffect(() => {
    if (loading || bootstrappingProjection || activeProjection || projections.length === 0) return;
    const fallback = projections.find((projection) => projection.onOletus)
      ?? [...projections].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    selectProjection(fallback.id).catch(() => undefined);
  }, [activeProjection, bootstrappingProjection, loading, projections, selectProjection]);

  const years = activeProjection?.vuodet ?? [];
  const hasComputedData = years.length > 0;
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
      const baseName = newName.trim();
      const firstAvailableScenarioName = buildUniqueScenarioName(baseName, projections);
      const scenarioDriverPaths = buildScenarioDriverPaths(newScenarioDrivers, createModalBaseYear);
      const scenarioInvestments = newScenarioInvestments
        .map((item) => ({ year: Math.round(Number(item.year)), amount: Number(item.amount) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.amount) && item.amount !== 0);

      const createAndComputeScenario = async (scenarioName: string) => {
        const scenarioPayload = {
          talousarvioId: newBudgetId,
          nimi: scenarioName,
          aikajaksoVuosia: newHorizon,
          ajuriPolut: scenarioDriverPaths,
          userInvestments: scenarioInvestments.length > 0 ? scenarioInvestments : undefined,
        };
        const created = await createProjection(scenarioPayload);
        return computeProjection(created.id);
      };

      let scenarioProjection: Projection | null = null;
      let candidateName = firstAvailableScenarioName;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          try {
            scenarioProjection = await createAndComputeScenario(candidateName);
          } catch (e: any) {
            const msg = String(e?.message ?? '');
            if (msg.includes('404') || msg.includes('not found')) {
              // Projection may have been reset between create and compute; retry full scenario create once.
              scenarioProjection = await createAndComputeScenario(candidateName);
            } else {
              throw e;
            }
          }
          break;
        } catch (e: any) {
          const msg = String(e?.message ?? '');
          const status = e?.status as number | undefined;
          const duplicateName = status === 409 || /already exists|duplicate|unique|conflict/i.test(msg);
          if (!duplicateName || attempt >= 5) {
            throw e;
          }
          candidateName = `${baseName} (${attempt + 2})`;
        }
      }
      if (!scenarioProjection) {
        throw new Error(t('projection.errorCreateFailed'));
      }

      applyProjectionSelection(scenarioProjection);
      setProjections(await listProjections());
      resetCreateScenarioForm();
    } catch (e: any) {
      setError(e.message || t('projection.errorCreateFailed'));
    }
  };

  const ensureEditableProjection = useCallback(async (): Promise<Projection | null> => {
    if (!activeProjection) return null;
    if (!activeProjection.onOletus) return activeProjection;

    const existingWorking = projections
      .filter((projection) => !projection.onOletus && projection.talousarvioId === activeProjection.talousarvioId)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];

    if (existingWorking) {
      const existingFull = await getProjection(existingWorking.id);
      applyProjectionSelection(existingFull);
      return existingFull;
    }

    const baseYear = activeProjection.talousarvio?.vuosi ?? new Date().getFullYear();
    const workingName = buildUniqueScenarioName(`Tyoversio ${baseYear}`, projections);
    const created = await createProjection({
      talousarvioId: activeProjection.talousarvioId,
      nimi: workingName,
      aikajaksoVuosia: activeProjection.aikajaksoVuosia,
      olettamusYlikirjoitukset: activeProjection.olettamusYlikirjoitukset ?? undefined,
      ajuriPolut: activeProjection.ajuriPolut ?? undefined,
      userInvestments: Array.isArray(activeProjection.userInvestments) ? activeProjection.userInvestments : undefined,
      vuosiYlikirjoitukset: activeProjection.vuosiYlikirjoitukset ?? undefined,
    });

    let workingProjection: Projection;
    try {
      workingProjection = await computeProjection(created.id);
    } catch {
      workingProjection = await getProjection(created.id);
    }

    applyProjectionSelection(workingProjection);
    setProjections(await listProjections());
    return workingProjection;
  }, [activeProjection, applyProjectionSelection, projections]);

  const handleDelete = async () => {
    if (!activeProjection) return;
    if (!window.confirm(t('projection.deleteConfirm', { name: activeProjection.nimi }))) return;
    try {
      await deleteProjection(activeProjection.id);
      const projList = await listProjections();
      setProjections(projList);
      if (projList.length > 0) {
        const fallback = projList.find((projection) => projection.onOletus)
          ?? [...projList].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
        await selectProjection(fallback.id);
      } else if (AUTO_BOOTSTRAP_ENABLED && budgets.length > 0) {
        const baselineBudget = selectBaselineBudget(budgets);
        if (baselineBudget) {
          const bootstrapped = await computeForBudget(baselineBudget.id);
          applyProjectionSelection(bootstrapped);
          setProjections(await listProjections());
        } else {
          setActiveProjection(null);
        }
      } else {
        setActiveProjection(null);
      }
    } catch (e: any) {
      setError(e.message || t('projection.errorDeleteFailed'));
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
    setComputeValidation(null);
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
    const hasYearOverrides = Object.keys(yearOverrides).length > 0;
    let targetProjection = activeProjection;

    try {
      if (activeProjection.onOletus && (hasOverrides || hasYearOverrides)) {
        const editableProjection = await ensureEditableProjection();
        if (!editableProjection) return;
        targetProjection = editableProjection;
      }

      // Try the normal PATCH + compute path first.
      // Send {} (empty object) when no overrides to explicitly clear any stored overrides in DB
      // (audit fix: sending undefined omits the field so backend never clears existing overrides).
      await updateProjection(targetProjection.id, {
        olettamusYlikirjoitukset: hasOverrides ? cleanOverrides : {},
        vuosiYlikirjoitukset: yearOverrides,
      });
      const result = await computeProjection(targetProjection.id);
      setActiveProjection(result);
      setComputeValidation(null);
    } catch (e: any) {
      const msg = String(e.message || '');
      const is404 = msg.includes('404') || msg.includes('not found');

      if (is404 && targetProjection.talousarvioId) {
        // Stale projection ID: fall back to budget-based upsert compute. Pass overrides and driver paths
        // so the recomputed projection preserves user inputs (BUG 2).
        try {
          const result = await computeForBudget(
            targetProjection.talousarvioId,
            hasOverrides ? cleanOverrides : undefined,
            driverPaths ?? undefined,
            yearOverrides,
          );
          setActiveProjection(result);
          setComputeValidation(null);
          // Re-fetch projection list so tabs are in sync
          const projList = await listProjections();
          setProjections(projList);
        } catch (e2: any) {
          captureComputeValidation(e2);
          setError(e2.message || t('projection.errorComputeFailed'));
        }
      } else {
        captureComputeValidation(e);
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

  const handleChartYearClick = useCallback((year: number) => {
    setSelectedYear(year);
    setYearEditorOpen(true);
  }, []);

  const setYearOverride = useCallback((year: number, updater: (prev: ProjectionYearOverride) => ProjectionYearOverride) => {
    setYearOverrides((prev) => {
      const current = prev[year] ?? {};
      const nextValue = updater(current);
      const hasCategory = Boolean(nextValue.categoryGrowthPct && Object.keys(nextValue.categoryGrowthPct).length > 0);
      const hasLines = Boolean(nextValue.lineOverrides && Object.keys(nextValue.lineOverrides).length > 0);
      const hasCore = (
        typeof nextValue.waterPriceEurM3 === 'number'
        || typeof nextValue.waterPriceGrowthPct === 'number'
        || typeof nextValue.investmentEur === 'number'
        || nextValue.lockMode != null
      );
      const next = { ...prev };
      if (!hasCategory && !hasLines && !hasCore) {
        delete next[year];
      } else {
        next[year] = nextValue;
      }
      return next;
    });
  }, []);

  const handleSaveYearOverrides = useCallback(async () => {
    if (!activeProjection) return;
    setSavingYearOverrides(true);
    setError(null);
    setComputeValidation(null);
    try {
      const editableProjection = await ensureEditableProjection();
      if (!editableProjection) return;
      const investments = yearOverridesToInvestments(yearOverrides);
      const updated = await updateProjection(editableProjection.id, {
        vuosiYlikirjoitukset: yearOverrides,
        userInvestments: investments,
      });
      setActiveProjection(updated);
      if (hasComputedData && !driverPathsDirty) {
        setComputing(true);
        try {
          const recomputed = await computeProjection(editableProjection.id);
          setActiveProjection(recomputed);
        } finally {
          setComputing(false);
        }
      }
    } catch (e: any) {
      setError(e.message || t('projection.errorSaveFailed'));
    } finally {
      setSavingYearOverrides(false);
    }
  }, [activeProjection, yearOverrides, hasComputedData, driverPathsDirty, t, ensureEditableProjection]);

  const handleSaveUserInvestments = async () => {
    if (!activeProjection) return;
    try {
      setError(null);
      setComputeValidation(null);
      const editableProjection = await ensureEditableProjection();
      if (!editableProjection) return;
      const updated = await updateProjection(editableProjection.id, {
        userInvestments: userInvestments.filter((u) => u.amount !== 0 || u.year > 0),
      });
      setActiveProjection(updated);
      // Auto-recompute so investment impact is immediately visible
      if (hasComputedData && !driverPathsDirty) {
        setComputing(true);
        try {
          const recomputed = await computeProjection(editableProjection.id);
          setActiveProjection(recomputed);
        } catch {
          // Ignore silent recompute failure; user can still press Laske uudelleen
        } finally {
          setComputing(false);
        }
      }
    } catch (e: any) {
      setError(e.message || t('projection.errorSaveFailed'));
    }
  };

  const handleHorizonChange = async (value: number) => {
    if (!activeProjection) return;
    try {
      const editableProjection = await ensureEditableProjection();
      if (!editableProjection) return;
      await updateProjection(editableProjection.id, { aikajaksoVuosia: value });
      const updated = await getProjection(editableProjection.id);
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

  const canCompute = Boolean(activeProjection?.talousarvioId);
  const selectedYearData = effectiveSelectedYear != null
    ? years.find((year) => year.vuosi === effectiveSelectedYear) ?? null
    : null;
  const selectedYearOverride = effectiveSelectedYear != null ? yearOverrides[effectiveSelectedYear] : undefined;
  const previousYearData = effectiveSelectedYear != null
    ? years.find((year) => year.vuosi === effectiveSelectedYear - 1) ?? null
    : null;
  const computedGrowthPct = selectedYearData && previousYearData && num(previousYearData.vesihinta) > 0
    ? ((num(selectedYearData.vesihinta) / num(previousYearData.vesihinta)) - 1) * 100
    : null;
  const selectedYearLineKeys = selectedYearData?.erittelyt
    ? Array.from(new Set([
      ...(selectedYearData.erittelyt.kulut?.map((line) => line.nimi) ?? []),
      ...(selectedYearData.erittelyt.tulot?.map((line) => line.nimi) ?? []),
      ...(selectedYearData.erittelyt.investoinnit?.map((line) => line.nimi) ?? []),
    ])).filter(Boolean)
    : [];
  const yearEditorState: YearEditorState | null = (effectiveSelectedYear != null && selectedYearData)
    ? {
      year: effectiveSelectedYear,
      computedWaterPrice: num(selectedYearData.vesihinta),
      computedGrowthPct,
      override: selectedYearOverride ?? {},
      lineKeys: selectedYearLineKeys,
    }
    : null;
  const finalYear = years.length > 0 ? years[years.length - 1] : null;
  const finalCumulative = finalYear ? num(finalYear.kumulatiivinenTulos) : 0;

  const firstYear = years.length > 0 ? years[0] : null;
  const tariffYearPlusOne = years.length > 1 ? num(years[1].vesihinta) : null;
  // Tariffikorotus: % increase needed vs current year-0 tariff
  const baseYearTariff = firstYear ? num(firstYear.vesihinta) : 0;
  const requiredTariff = num(activeProjection?.requiredTariff ?? 0);
  const tariffikorotus = baseYearTariff > 0 && requiredTariff > 0
    ? (requiredTariff / baseYearTariff - 1) * 100
    : null;
  const selectedYearCashflow = selectedYearData
    ? (typeof selectedYearData.kassafloede === 'number'
      ? selectedYearData.kassafloede
      : num(selectedYearData.tulos) - num(selectedYearData.investoinnitYhteensa))
    : null;
  const selectedYearInvestments = selectedYearData ? num(selectedYearData.investoinnitYhteensa) : null;
  const selectedYearWaterUnitPrice = selectedYearData?.erittelyt?.ajurit
    ?.find((driver) => driver.palvelutyyppi === 'vesi')?.yksikkohinta ?? null;
  const selectedYearWastewaterUnitPrice = selectedYearData?.erittelyt?.ajurit
    ?.find((driver) => driver.palvelutyyppi === 'jatevesi')?.yksikkohinta ?? null;
  const selectedYearWaterVolume = selectedYearData?.erittelyt?.ajurit
    ?.find((driver) => driver.palvelutyyppi === 'vesi')?.myytyMaara ?? null;
  const selectedYearWastewaterVolume = selectedYearData?.erittelyt?.ajurit
    ?.find((driver) => driver.palvelutyyppi === 'jatevesi')?.myytyMaara ?? null;
  const selectedYearCombinedWeighted = (
    selectedYearWaterUnitPrice != null
    && selectedYearWastewaterUnitPrice != null
    && selectedYearWaterVolume != null
    && selectedYearWastewaterVolume != null
    && (selectedYearWaterVolume + selectedYearWastewaterVolume) > 0
  )
    ? (
      ((selectedYearWaterUnitPrice * selectedYearWaterVolume)
      + (selectedYearWastewaterUnitPrice * selectedYearWastewaterVolume))
      / (selectedYearWaterVolume + selectedYearWastewaterVolume)
    )
    : (selectedYearData ? num(selectedYearData.vesihinta) : null);
  const selectedYearCombinedFormula = (
    selectedYearWaterUnitPrice != null
    && selectedYearWastewaterUnitPrice != null
    && selectedYearWaterVolume != null
    && selectedYearWastewaterVolume != null
    && (selectedYearWaterVolume + selectedYearWastewaterVolume) > 0
  )
    ? `(${formatTariffEurPerM3(selectedYearWaterUnitPrice)} * ${formatM3Int(selectedYearWaterVolume)} + ${formatTariffEurPerM3(selectedYearWastewaterUnitPrice)} * ${formatM3Int(selectedYearWastewaterVolume)}) / ${formatM3Int(selectedYearWaterVolume + selectedYearWastewaterVolume)}`
    : undefined;
  const baseProjectionYear = activeProjection?.talousarvio?.vuosi ?? years[0]?.vuosi ?? null;
  // --- V2 render ---
  const tv2 = (k: string) => t(`projection.v2.${k}`);

  return (
    <div className="projection-page ev2-page">
      {/* -- Topbar -- */}
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
              <button type="button" className="ev2-btn ev2-btn--ghost" data-testid="projection-export-pdf-btn" onClick={handleExportPdf}>{t('projection.exportPdf')}</button>
            </>
          )}
        </div>
      </header>

      {error && <div className="ev2-error-banner" role="alert">{error}</div>}

      {/* Scenario comparison overlay */}
      {showComparison && (
        <ScenarioComparison onClose={() => setShowComparison(false)} />
      )}

      {/* -- Scenario row -- */}
      <div className="ev2-scenario-row">
        <span className="ev2-scenario-row__label">{tv2('scenariosLabel')}:</span>
        <EnnusteScenarioRow
          projections={projections}
          activeProjectionId={activeProjection?.id ?? null}
          onSelectProjection={selectProjection}
          onCreateScenario={openCreateScenarioForm}
          onDeleteScenario={activeProjection && !activeProjection.onOletus ? handleDelete : undefined}
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
                data-testid="projection-create-scenario-name-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('projection.newScenarioPlaceholder')}
              />
            </div>
            <div className="form-row">
              <label>{t('projection.baseBudget')}</label>
              <select
                data-testid="projection-create-scenario-budget-select"
                value={newBudgetId}
                onChange={(e) => setNewBudgetId(e.target.value)}
              >
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
                  data-testid="projection-create-scenario-horizon-input"
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
              <button
                type="button"
                className="btn btn-secondary"
                data-testid="projection-create-scenario-add-investment-btn"
                onClick={handleAddScenarioInvestmentDraft}
              >
                {t('projection.financing.addInvestment')}
              </button>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={resetCreateScenarioForm}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-primary"
                data-testid="projection-create-scenario-submit-btn"
                onClick={handleCreate}
                disabled={!newName.trim() || !newBudgetId}
              >
                {t('projection.createScenario')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- KPI Strip -- */}
      {activeProjection && (
        <EnnusteTuloksetZone heading={tv2('resultsZoneTitle')}>
          {hasComputedData && (
            <div className="ev2-kpi-strip" role="status" aria-live="polite">
              <div className="ev2-kpi ev2-kpi--primary">
                <span className="ev2-kpi__label">{tv2('kpiRequiredTariff')}</span>
                <span className="ev2-kpi__value">{formatTariffEurPerM3(activeProjection.requiredTariff ?? undefined)}</span>
              </div>
              <div
                className="ev2-kpi"
                title={selectedYearCombinedFormula
                  ? `${tv2('kpiCombinedWeightedHelp')}: ${selectedYearCombinedFormula}`
                  : undefined}
              >
                <span className="ev2-kpi__label">{tv2('kpiCombinedWeighted')}</span>
                <span className="ev2-kpi__value">{formatTariffEurPerM3(selectedYearCombinedWeighted ?? undefined)}</span>
              </div>
              <div className="ev2-kpi">
                <span className="ev2-kpi__label">{tv2('kpiSelectedWaterPrice')}</span>
                <span className="ev2-kpi__value">{formatTariffEurPerM3(selectedYearWaterUnitPrice ?? undefined)}</span>
              </div>
              <div className="ev2-kpi">
                <span className="ev2-kpi__label">{tv2('kpiSelectedWastewaterPrice')}</span>
                <span className="ev2-kpi__value">{formatTariffEurPerM3(selectedYearWastewaterUnitPrice ?? undefined)}</span>
              </div>
              {tariffikorotus !== null && (
                <div className="ev2-kpi">
                  <span className="ev2-kpi__label">{tv2('kpiTariffikorotus')}</span>
                  <span className={`ev2-kpi__value ${tariffikorotus > 0 ? 'ev2-negative' : 'ev2-positive'}`}>
                    {tariffikorotus > 0 ? '+' : ''}{tariffikorotus.toFixed(1)} %
                  </span>
                </div>
              )}
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

      {/* -- Main chart -- */}
      <div className="ev2-chart-section">
        {hasComputedData ? (
          <Suspense fallback={<div className="ev2-chart-skeleton" />}>
            <EnnusteComboChartLazy
              years={years}
              selectedYear={effectiveSelectedYear}
              onYearClick={handleChartYearClick}
            />
          </Suspense>
        ) : (
          <div className="ev2-chart-empty">
            <p>{tv2('noDataHint')}</p>
          </div>
        )}
      </div>

      <EnnusteYearEditorDrawer
        open={yearEditorOpen}
        saving={savingYearOverrides}
        state={yearEditorState}
        onClose={() => setYearEditorOpen(false)}
        onClearYear={() => {
          if (effectiveSelectedYear == null) return;
          setYearOverrides((prev) => {
            const next = { ...prev };
            delete next[effectiveSelectedYear];
            return next;
          });
        }}
        onSave={handleSaveYearOverrides}
        onSetWaterPrice={(value) => {
          if (effectiveSelectedYear == null) return;
          const prevPrice = previousYearData ? num(previousYearData.vesihinta) : 0;
          const growth = prevPrice > 0 ? ((value / prevPrice) - 1) * 100 : undefined;
          setYearOverride(effectiveSelectedYear, (prev) => ({
            ...prev,
            waterPriceEurM3: value,
            waterPriceGrowthPct: growth,
            lockMode: 'price',
          }));
        }}
        onSetGrowthPct={(value) => {
          if (effectiveSelectedYear == null) return;
          const prevPrice = previousYearData ? num(previousYearData.vesihinta) : 0;
          const price = prevPrice > 0 ? prevPrice * (1 + value / 100) : undefined;
          setYearOverride(effectiveSelectedYear, (prev) => ({
            ...prev,
            waterPriceGrowthPct: value,
            waterPriceEurM3: price,
            lockMode: 'percent',
          }));
        }}
        onSetLockMode={(mode: YearOverrideLockMode) => {
          if (effectiveSelectedYear == null) return;
          setYearOverride(effectiveSelectedYear, (prev) => ({ ...prev, lockMode: mode }));
        }}
        onSetInvestment={(value) => {
          if (effectiveSelectedYear == null) return;
          setYearOverride(effectiveSelectedYear, (prev) => ({ ...prev, investmentEur: value }));
        }}
        onSetCategoryGrowth={(category, value) => {
          if (effectiveSelectedYear == null) return;
          setYearOverride(effectiveSelectedYear, (prev) => {
            const nextCategory = { ...(prev.categoryGrowthPct ?? {}) };
            if (value == null || !Number.isFinite(value)) delete nextCategory[category];
            else nextCategory[category] = value;
            return {
              ...prev,
              categoryGrowthPct: Object.keys(nextCategory).length > 0 ? nextCategory : undefined,
            };
          });
        }}
        onSetLineOverride={(lineKey, lineOverride) => {
          if (effectiveSelectedYear == null) return;
          setYearOverride(effectiveSelectedYear, (prev) => {
            const nextLines = { ...(prev.lineOverrides ?? {}) };
            if (!lineOverride) delete nextLines[lineKey];
            else nextLines[lineKey] = lineOverride;
            return {
              ...prev,
              lineOverrides: Object.keys(nextLines).length > 0 ? nextLines : undefined,
            };
          });
        }}
      />
        </EnnusteTuloksetZone>
      )}

      {/* -- Below-chart grid: inputs (right) + year cards (left) -- */}
      {activeProjection && (
        <EnnusteSyotaZone heading={tv2('inputsTitle')}>
          <p className="ev2-input-hint">
            {tv2('onboardingHint')}
            {' '}
            {tv2('baselineYearLabel')}: {baseProjectionYear ?? '-'}
            {' · '}
            {tv2('horizonLabel')}: {activeProjection.aikajaksoVuosia} {tv2('horizonUnit')}
          </p>
          <div className="ev2-body-grid">

          {/* -- Left: year cards -- */}
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
                      {num(y.vesihinta) > 0 && (
                        <div className="ev2-year-card__row ev2-year-card__row--tariff">
                          <span>{t('projection.columns.waterPrice')}</span>
                          <span>{formatTariffEurPerM3(num(y.vesihinta))}</span>
                        </div>
                      )}
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

          {/* -- Right: inputs -- */}
          <div className="ev2-inputs">

            {/* Compute button - always at top */}
            <div className="ev2-compute-bar">
              <button
                className="ev2-compute-btn"
                data-testid="projection-recalc-btn"
                onClick={handleCompute}
                disabled={computing || driverPathsDirty || !canCompute}
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
            {computeValidation && (
              <div className="ev2-validation-banner" role="alert" data-testid="projection-validation-banner">
                <div className="ev2-validation-banner__content">
                  <strong>{t('projection.v2.validationFixTitle', 'Laskenta estettiin ennen virheellistä ennustetta')}</strong>
                  <span>{computeValidation.message}</span>
                  {computeValidation.requiredMissing && computeValidation.requiredMissing.length > 0 && (
                    <span>
                      {computeValidation.requiredMissing.slice(0, 4).map(formatRequiredDriverLabel).join(' · ')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="ev2-btn ev2-btn--primary"
                  onClick={() => navigateToTab('budget')}
                >
                  {t('projection.v2.openBudgetFixCta', 'Avaa Talousarvio ja korjaa')}
                </button>
              </div>
            )}

            {/* -- Olettamukset -- */}
            <section className="ev2-input-section">
              <h2 className="ev2-input-section__title">{tv2('assumptionsTitle')}</h2>
              <div className="ev2-assumptions-grid">
                {([
                  { key: 'vesimaaran_muutos', label: tv2('assumptionVesimaara') },
                  { key: 'inflaatio', label: tv2('assumptionKayttomenot') },
                  { key: 'energiakerroin', label: tv2('assumptionEnergia') },
                  { key: 'henkilostokerroin', label: tv2('assumptionHenkilosto') },
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
                        dataTestId={`projection-assumption-${key}-input`}
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

            {/* -- Investoinnit -- */}
            <section className="ev2-input-section">
              <h2 className="ev2-input-section__title">{tv2('investmentsTitle')}</h2>
              <p className="ev2-input-hint">{tv2('investmentsHint')}</p>
              <div className="ev2-investments-list">
                {userInvestments.map((u, i) => (
                  <div key={`${u.year}-${i}`} className="ev2-investment-row">
                    <select
                      className="ev2-select ev2-select--year"
                      data-testid={`projection-investment-year-${i}`}
                      value={u.year}
                      onChange={(e) => handleUserInvestmentChange(i, 'year', parseInt(e.target.value, 10))}
                    >
                      {plannerYears.map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                    <input
                      className="ev2-input ev2-input--num"
                      data-testid={`projection-investment-amount-${i}`}
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
                <button
                  type="button"
                  className="ev2-btn"
                  data-testid="projection-add-investment-btn"
                  onClick={handleAddUserInvestment}
                >
                  + {tv2('addInvestment')}
                </button>
                <button
                  type="button"
                  className="ev2-btn ev2-btn--primary"
                  data-testid="projection-save-investments-btn"
                  onClick={handleSaveUserInvestments}
                >
                  {t('common.save')}
                </button>
              </div>
            </section>
            {hasComputedData && (
              <section className="ev2-input-section">
                <details className="revenue-report-section">
                  <summary className="revenue-report-toggle">{t('projection.showRevenueBreakdown')}</summary>
                  <RevenueReport years={years} scenarioName={activeProjection.nimi} />
                </details>
              </section>
            )}
          </div>

          {/* -- Extra column - visible on ultra-wide only (>1300px) -- */}
          {hasComputedData && (
            <div className="ev2-extra-col">
              <div className="ev2-input-section__title" style={{ marginBottom: 16 }}>Aikajana</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {years.map((y) => {
                  const tariffi = num(y.vesihinta);
                  const kv = typeof y.kassafloede === 'number' ? y.kassafloede : num(y.tulos) - num(y.investoinnitYhteensa);
                  const isSelected = y.vuosi === effectiveSelectedYear;
                  return (
                    <button
                      key={y.vuosi}
                      type="button"
                      onClick={() => setSelectedYear(y.vuosi)}
                      className={`ev2-timeline-row${isSelected ? ' ev2-timeline-row--selected' : ''}${kv < 0 ? ' ev2-timeline-row--deficit' : ''}`}
                    >
                      <span className="ev2-timeline-row__year">{y.vuosi}</span>
                      <span className="ev2-timeline-row__tariff">{tariffi > 0 ? formatTariffEurPerM3(tariffi) : '-'}</span>
                      <span className={`ev2-timeline-row__kv ${kv >= 0 ? 'ev2-positive' : 'ev2-negative'}`}>{formatEurInt(kv)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          </div>
        </EnnusteSyotaZone>
      )}

      {/* -- Empty states -- */}
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

function buildUniqueScenarioName(baseName: string, projections: Projection[]): string {
  const normalizedBase = baseName.trim();
  const existingNames = new Set(
    projections
      .map((projection) => projection.nimi?.trim().toLocaleLowerCase())
      .filter((name): name is string => Boolean(name)),
  );
  if (!existingNames.has(normalizedBase.toLocaleLowerCase())) {
    return normalizedBase;
  }
  let suffix = 2;
  while (existingNames.has(`${normalizedBase} (${suffix})`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${normalizedBase} (${suffix})`;
}


