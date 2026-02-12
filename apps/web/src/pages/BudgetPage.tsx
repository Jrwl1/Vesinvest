import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listBudgets, getBudget, getBudgetSets, getBudgetsByBatchId,
  createBudget, updateBudget,
  createBudgetLine, updateBudgetLine, deleteBudgetLine,
  createRevenueDriver, updateRevenueDriver,
  setValisummat, updateValisumma,
  seedDemoData,
  type Budget, type BudgetLine, type BudgetValisumma, type RevenueDriver,
} from '../api';
import { formatCurrency } from '../utils/format';
import { filterValisummatNoKvaTotaltDoubleCount } from '../utils/budgetValisummatFilter';
import { computeTulosDelta } from '../utils/budgetTulosDelta';
import { BudgetImport } from '../components/BudgetImport';
import { KvaImportPreview } from '../components/KvaImportPreview';
import { RevenueDriversPanel } from '../components/RevenueDriversPanel';
import { useDemoStatus } from '../context/DemoStatusContext';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

/** Three years shown in draft and set views (same as import preview). */
const DRAFT_THREE_YEARS = [currentYear - 2, currentYear - 1, currentYear] as const;

type DraftYearTotals = { tulot: number; kulut: number; poistot: number; investoinnit: number };

function getDefaultDraftThreeYearData(): Record<number, DraftYearTotals> {
  return Object.fromEntries(
    DRAFT_THREE_YEARS.map((y) => [y, { tulot: 0, kulut: 0, poistot: 0, investoinnit: 0 }]),
  ) as Record<number, DraftYearTotals>;
}

/** Draft line shape (client-only until saved). Same structure as backend lines. */
export type DraftLine = { tiliryhma: string; nameKey: string; tyyppi: 'kulu' | 'tulo' | 'investointi'; summa: number };

/** UI-only skeleton rows (0€). Same structure as demo seed. */
const SKELETON_LINES: { tiliryhma: string; nameKey: string; tyyppi: 'kulu' | 'tulo' | 'investointi' }[] = [
  { tiliryhma: '3200', nameKey: 'accountGroups.3200', tyyppi: 'tulo' },
  { tiliryhma: '3900', nameKey: 'accountGroups.3900', tyyppi: 'tulo' },
  { tiliryhma: '4100', nameKey: 'accountGroups.4100', tyyppi: 'kulu' },
  { tiliryhma: '4200', nameKey: 'accountGroups.4200', tyyppi: 'kulu' },
  { tiliryhma: '4000', nameKey: 'accountGroups.4000', tyyppi: 'kulu' },
  { tiliryhma: '4300', nameKey: 'accountGroups.4300', tyyppi: 'kulu' },
  { tiliryhma: '4500', nameKey: 'accountGroups.4500', tyyppi: 'kulu' },
  { tiliryhma: '4600', nameKey: 'accountGroups.4600', tyyppi: 'kulu' },
  { tiliryhma: '4900', nameKey: 'accountGroups.4900', tyyppi: 'kulu' },
  { tiliryhma: '5000', nameKey: 'accountGroups.5000', tyyppi: 'investointi' },
  { tiliryhma: '5100', nameKey: 'accountGroups.5100', tyyppi: 'investointi' },
];

const CATEGORY_FALLBACK_I18N_KEYS: Record<string, string> = {
  sales_revenue: 'budget.categoryFallback.sales_revenue',
  connection_fees: 'budget.categoryFallback.connection_fees',
  other_income: 'budget.categoryFallback.other_income',
  materials_services: 'budget.categoryFallback.materials_services',
  personnel_costs: 'budget.categoryFallback.personnel_costs',
  other_costs: 'budget.categoryFallback.other_costs',
  purchased_services: 'budget.categoryFallback.purchased_services',
  rents: 'budget.categoryFallback.rents',
  depreciation: 'budget.categoryFallback.depreciation',
  financial_income: 'budget.categoryFallback.financial_income',
  financial_costs: 'budget.categoryFallback.financial_costs',
  investments: 'budget.categoryFallback.investments',
  operating_result: 'budget.categoryFallback.operating_result',
  net_result: 'budget.categoryFallback.net_result',
};

function getDefaultDraftLines(): DraftLine[] {
  return SKELETON_LINES.map((l) => ({ ...l, summa: 0 }));
}

/** Normalize a budget line so optional/missing fields never break rendering or reduce (NaN). */
function normalizeBudgetLine(l: Partial<BudgetLine> | null | undefined): BudgetLine {
  if (!l || typeof l !== 'object') {
    return { id: '', talousarvioId: '', tiliryhma: '', nimi: '', tyyppi: 'kulu', summa: '0', muistiinpanot: null, createdAt: '', updatedAt: '' };
  }
  const tyyppi = l.tyyppi === 'tulo' || l.tyyppi === 'investointi' ? l.tyyppi : 'kulu';
  const summa = l.summa != null && String(l.summa).trim() !== '' ? String(l.summa) : '0';
  return {
    id: l.id ?? '',
    talousarvioId: l.talousarvioId ?? '',
    tiliryhma: l.tiliryhma ?? '',
    nimi: l.nimi ?? '',
    tyyppi,
    summa,
    muistiinpanot: l.muistiinpanot ?? null,
    createdAt: l.createdAt ?? '',
    updatedAt: l.updatedAt ?? '',
  };
}

/** Normalize a valisumma so optional/missing fields never break rendering or reduce (NaN). */
function normalizeValisumma(v: Partial<BudgetValisumma> | null | undefined): BudgetValisumma {
  if (!v || typeof v !== 'object') {
    return { id: '', talousarvioId: '', palvelutyyppi: '', categoryKey: '', tyyppi: 'kulu', label: null, summa: '0', lahde: null };
  }
  const tyyppi = (v.tyyppi && ['tulo', 'kulu', 'poisto', 'rahoitus_tulo', 'rahoitus_kulu', 'investointi', 'tulos'].includes(v.tyyppi))
    ? v.tyyppi
    : 'kulu';
  const summa = v.summa != null && String(v.summa).trim() !== '' ? String(v.summa) : '0';
  return {
    id: v.id ?? '',
    talousarvioId: v.talousarvioId ?? '',
    palvelutyyppi: v.palvelutyyppi ?? '',
    categoryKey: v.categoryKey ?? '',
    tyyppi,
    label: v.label ?? null,
    summa,
    lahde: v.lahde ?? null,
  };
}

/** Percentage change between two values; returns null if prev is 0 (avoid div by zero). */
function percentChange(prev: number, curr: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

/** Format % for delta pill: "+5.2 %" or "-3.1 %" or "—" when null. */
function formatPercentDelta(pct: number | null): string {
  if (pct === null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toLocaleString('fi-FI', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Locale-safe amount input (comma decimal, no type="number"). */
const AmountInput: React.FC<{
  value: number;
  onChange: (n: number) => void;
  onBlur?: () => void;
  /** Called on blur with the parsed value (use for save when parent needs the final number). */
  onBlurWithValue?: (n: number) => void;
  className?: string;
  autoFocus?: boolean;
}> = ({ value, onChange, onBlur, onBlurWithValue, className, autoFocus }) => {
  const [raw, setRaw] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const displayNum = focused ? raw : value.toLocaleString('fi-FI', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={focused ? raw : displayNum}
      onFocus={() => {
        setRaw(String(value));
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        const normalized = raw.replace(/\s/g, '').replace(',', '.');
        const parsed = parseFloat(normalized);
        const safe = !isNaN(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : value;
        if (!isNaN(parsed) && parsed >= 0) onChange(safe);
        onBlurWithValue?.(safe);
        onBlur?.();
      }}
      onChange={(e) => setRaw(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setFocused(false);
      }}
      autoFocus={autoFocus}
    />
  );
};

/** Per-driver revenue breakdown (same logic as RevenuePage). */
function driverRevenue(d: RevenueDriver | undefined): { usage: number; baseFee: number; total: number } {
  if (!d) return { usage: 0, baseFee: 0, total: 0 };
  const usage = parseFloat(d.yksikkohinta || '0') * parseFloat(d.myytyMaara || '0');
  const baseFee = (d.perusmaksu != null && d.liittymamaara != null)
    ? parseFloat(String(d.perusmaksu)) * d.liittymamaara
    : 0;
  return { usage, baseFee, total: usage + baseFee };
}

/** Keys for missing-driver fields (for i18n). Same for water & wastewater. */
const REVENUE_DRIVER_FIELD_KEYS = [
  'revenue.water.unitPrice',
  'revenue.water.soldVolume',
  'revenue.water.baseFee',
  'revenue.water.connections',
] as const;

/** Whether revenue drivers are configured (drivers exist so computed value can be shown). */
function isRevenueDriversConfigured(drivers: RevenueDriver[]): { configured: boolean; missingFieldKeys: readonly string[] } {
  const missingFieldKeys = [...REVENUE_DRIVER_FIELD_KEYS];
  return { configured: drivers.length > 0, missingFieldKeys };
}

export const BudgetPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetSets, setBudgetSets] = useState<Array<{ batchId: string; id: string; vuosi: number; nimi: string; minVuosi?: number; maxVuosi?: number }>>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [activeSetBudgets, setActiveSetBudgets] = useState<Budget[] | null>(null);
  const [expandedSetBucket, setExpandedSetBucket] = useState<string | null>(null); // 'budgetId:bucketKey'
  const revenueDriversRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingType, setAddingType] = useState<'kulu' | 'tulo' | 'investointi' | null>(null);
  const [newLine, setNewLine] = useState({ tiliryhma: '', nimi: '', summa: '' });
  const [showImport, setShowImport] = useState(false);
  const [showKvaImport, setShowKvaImport] = useState(false);
  const [showVesimaksutBreakdown, setShowVesimaksutBreakdown] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [draftLines, setDraftLines] = useState<DraftLine[]>(() => getDefaultDraftLines());
  const [draftThreeYearData, setDraftThreeYearData] = useState<Record<number, DraftYearTotals>>(getDefaultDraftThreeYearData);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveModalName, setSaveModalName] = useState('');
  const [saveModalYear, setSaveModalYear] = useState(currentYear);
  const [savingBudget, setSavingBudget] = useState(false);
  const [showImportCreateModal, setShowImportCreateModal] = useState(false);
  const [importCreateName, setImportCreateName] = useState('');
  const [importCreateYear, setImportCreateYear] = useState(currentYear);
  const [creatingForImport, setCreatingForImport] = useState(false);
  const [savingDriverType, setSavingDriverType] = useState<'vesi' | 'jatevesi' | null>(null);
  const [driverFieldErrors, setDriverFieldErrors] = useState<Record<string, string>>({});
  const demoStatus = useDemoStatus();
  const isDemoEnabled = demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled;

  const isDraftMode = !activeBudget && !(activeSetBudgets && activeSetBudgets.length > 0);

  const getValisummaName = useCallback((valisumma: BudgetValisumma) => {
    const directLabel = (valisumma.label ?? '').trim();
    if (directLabel) return directLabel;
    const fallbackKey = CATEGORY_FALLBACK_I18N_KEYS[valisumma.categoryKey];
    if (fallbackKey) {
      const localized = t(fallbackKey);
      if (localized && localized !== fallbackKey) {
        return localized;
      }
    }
    return valisumma.categoryKey;
  }, [t]);

  const loadBudgets = useCallback(async (): Promise<{ data: Budget[]; sets: Array<{ batchId: string; id: string; vuosi: number; nimi: string; minVuosi?: number; maxVuosi?: number }> }> => {
    try {
      const [data, sets] = await Promise.all([listBudgets(), getBudgetSets().catch(() => [])]);
      setBudgets(data);
      setBudgetSets(sets);
      return { data, sets };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
      return { data: [], sets: [] };
    }
  }, []);

  const loadBudget = useCallback(async (id: string) => {
    try {
      setActiveSetBudgets(null);
      const data = await getBudget(id);
      setActiveBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    }
  }, []);

  // Initial load: prefer 3-card set view when a set exists (e.g. after demo seed or import)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, sets } = await loadBudgets();
      if (sets.length > 0) {
        try {
          const setBudgets = await getBudgetsByBatchId(sets[0].batchId);
          setActiveSetBudgets(setBudgets);
          setActiveBudget(null);
        } catch {
          if (data.length > 0) await loadBudget(data[0].id);
        }
      } else if (data.length > 0) {
        await loadBudget(data[0].id);
      }
      setLoading(false);
    })();
  }, [loadBudgets, loadBudget]);

  const handleEditRevenues = useCallback(() => {
    revenueDriversRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Reset to fresh draft (e.g. "Uusi talousarvio" selected)
  const switchToNewDraft = useCallback(() => {
    setActiveBudget(null);
    setActiveSetBudgets(null);
    setDraftLines(getDefaultDraftLines());
    setDraftThreeYearData(getDefaultDraftThreeYearData());
  }, []);

  const selectValue = activeSetBudgets?.length
    ? `__set__:${activeSetBudgets[0]?.importBatchId ?? ''}`
    : (isDraftMode ? '__new__' : (activeBudget?.id ?? ''));

  /** Create a budget for import when org has none; then open import overlay. */
  const handleCreateBudgetForImport = async () => {
    const name = importCreateName.trim() || `${t('budget.title')} ${importCreateYear}`;
    setCreatingForImport(true);
    setError(null);
    try {
      const created = await createBudget({ vuosi: importCreateYear, nimi: name });
      await loadBudgets();
      await loadBudget(created.id);
      setShowImportCreateModal(false);
      setImportCreateName('');
      setImportCreateYear(currentYear);
      setShowImport(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    } finally {
      setCreatingForImport(false);
    }
  };

  // Save 3-year draft as persisted set (modal submit): create 3 budgets with same batchId + valisummat
  const handleSaveDraftAsBudget = async () => {
    const nameBase = saveModalName.trim();
    if (!nameBase) return;
    setSavingBudget(true);
    setError(null);
    const batchId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `manual-${Date.now()}`;
    try {
      const createdIds: string[] = [];
      for (const vuosi of DRAFT_THREE_YEARS) {
        const created = await createBudget({
          vuosi,
          nimi: `${nameBase} ${vuosi}`,
          importBatchId: batchId,
        });
        createdIds.push(created.id);
        const totals = draftThreeYearData[vuosi] ?? { tulot: 0, kulut: 0, poistot: 0, investoinnit: 0 };
        await setValisummat(created.id, [
          { palvelutyyppi: 'muu', categoryKey: 'other_income', tyyppi: 'tulo', summa: totals.tulot },
          { palvelutyyppi: 'muu', categoryKey: 'other_costs', tyyppi: 'kulu', summa: totals.kulut },
          { palvelutyyppi: 'muu', categoryKey: 'depreciation', tyyppi: 'poisto', summa: totals.poistot },
          { palvelutyyppi: 'muu', categoryKey: 'investments', tyyppi: 'investointi', summa: totals.investoinnit },
        ]);
      }
      await loadBudgets();
      const data = await getBudgetsByBatchId(batchId);
      setActiveSetBudgets(data);
      setActiveBudget(null);
      setShowSaveModal(false);
      setSaveModalName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setSavingBudget(false);
    }
  };

  // Inline edit: start
  const startEdit = (line: BudgetLine) => {
    setEditingLineId(line.id);
    setEditValue(String(parseFloat(line.summa)));
  };

  // Inline edit: save (value from AmountInput blur when provided)
  const saveEdit = async (line: BudgetLine, value?: number) => {
    if (!activeBudget) return;
    const val = value !== undefined ? value : parseFloat(editValue);
    if (isNaN(val) || val < 0) return;
    try {
      await updateBudgetLine(activeBudget.id, line.id, { summa: val });
      await loadBudget(activeBudget.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line');
    }
    setEditingLineId(null);
  };

  // Add new line
  const handleAddLine = async () => {
    if (!activeBudget || !addingType) return;
    const summa = parseFloat(newLine.summa);
    if (!newLine.nimi || isNaN(summa)) return;
    try {
      await createBudgetLine(activeBudget.id, {
        tiliryhma: newLine.tiliryhma || '9999',
        nimi: newLine.nimi,
        tyyppi: addingType,
        summa,
      });
      await loadBudget(activeBudget.id);
      setAddingType(null);
      setNewLine({ tiliryhma: '', nimi: '', summa: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line');
    }
  };

  // Delete line
  const handleDeleteLine = async (lineId: string) => {
    if (!activeBudget) return;
    try {
      await deleteBudgetLine(activeBudget.id, lineId);
      await loadBudget(activeBudget.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line');
    }
  };

  /** Optimistic update of a driver field (so totals update immediately). */
  const updateDriverField = useCallback((type: 'vesi' | 'jatevesi', field: keyof Pick<RevenueDriver, 'yksikkohinta' | 'myytyMaara' | 'perusmaksu' | 'liittymamaara'>, value: number) => {
    if (!activeBudget) return;
    const strVal = String(value);
    setActiveBudget((prev) => {
      if (!prev) return prev;
      const list = [...(prev.tuloajurit ?? [])];
      const idx = list.findIndex((d) => d.palvelutyyppi === type);
      if (idx >= 0) {
        list[idx] = { ...list[idx], [field]: field === 'liittymamaara' ? value : strVal };
      } else {
        list.push({
          id: `temp-${type}`,
          talousarvioId: prev.id,
          palvelutyyppi: type,
          yksikkohinta: field === 'yksikkohinta' ? strVal : '0',
          myytyMaara: field === 'myytyMaara' ? strVal : '0',
          perusmaksu: field === 'perusmaksu' ? strVal : null,
          liittymamaara: field === 'liittymamaara' ? value : null,
          alvProsentti: null,
          muistiinpanot: null,
          createdAt: '',
          updatedAt: '',
        } as RevenueDriver);
      }
      return { ...prev, tuloajurit: list };
    });
  }, [activeBudget]);

  /** Persist current driver state for type (on blur). Revert on error. */
  const saveDriver = useCallback(async (type: 'vesi' | 'jatevesi') => {
    if (!activeBudget) return;
    const driver = activeBudget.tuloajurit?.find((d) => d.palvelutyyppi === type);
    const payload = {
      yksikkohinta: driver ? parseFloat(driver.yksikkohinta || '0') : 0,
      myytyMaara: driver ? parseFloat(driver.myytyMaara || '0') : 0,
      perusmaksu: driver?.perusmaksu != null ? parseFloat(String(driver.perusmaksu)) : undefined,
      liittymamaara: driver?.liittymamaara ?? undefined,
    };
    setSavingDriverType(type);
    setDriverFieldErrors((prev) => ({ ...prev, [`${type}.yksikkohinta`]: '', [`${type}.myytyMaara`]: '', [`${type}.perusmaksu`]: '', [`${type}.liittymamaara`]: '' }));
    try {
      if (driver?.id && !driver.id.startsWith('temp-')) {
        await updateRevenueDriver(activeBudget.id, driver.id, payload);
      } else {
        await createRevenueDriver(activeBudget.id, { palvelutyyppi: type, ...payload });
      }
      const fresh = await getBudget(activeBudget.id);
      setActiveBudget(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save revenue driver');
      const fresh = await getBudget(activeBudget.id).catch(() => null);
      if (fresh) setActiveBudget(fresh);
    } finally {
      setSavingDriverType(null);
    }
  }, [activeBudget]);

  /** Persist annual base-fee total (ADR-013). Used by projection compute. Must be declared before any early return to keep hook order stable. */
  const saveAnnualBaseFeeTotal = useCallback(async (value: number) => {
    if (!activeBudget) return;
    try {
      await updateBudget(activeBudget.id, { perusmaksuYhteensa: value >= 0 ? value : undefined });
      const fresh = await getBudget(activeBudget.id);
      setActiveBudget(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update annual base-fee total');
    }
  }, [activeBudget]);

  // Group lines by type (TalousarvioRivi). When rivit are empty but valisummat exist (KVA import), show valisummat as rows (categoryKey + tyyppi aligned with API).
  // Normalize so optional/missing fields never break rendering or reduce (NaN).
  const lines = (activeBudget?.rivit ?? []).map(normalizeBudgetLine);
  const valisummatRaw = (activeBudget?.valisummat ?? []).map(normalizeValisumma);
  // Prevent KVA totalt double-count: exclude 'muu' for (tyyppi, categoryKey) when vesi/jatevesi splits exist.
  const valisummat = filterValisummatNoKvaTotaltDoubleCount(valisummatRaw as unknown as import('../utils/budgetValisummatFilter').ValisummaLike[]) as unknown as BudgetValisumma[];
  const hasMeaningfulDrivers = (activeBudget?.tuloajurit ?? []).some(
    (d) => parseFloat(d.myytyMaara || '0') > 0 || parseFloat(d.yksikkohinta || '0') > 0,
  );
  const useValisummaAsRows = lines.length === 0 && valisummat.length > 0;

  const revenueLinesFromValisummat = valisummat
    .filter(
      (v) =>
        (v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo') &&
        (!hasMeaningfulDrivers || v.categoryKey !== 'sales_revenue'),
    )
    .map((v) => ({
      id: v.id,
      tiliryhma: v.categoryKey,
      nimi: getValisummaName(v),
      tyyppi: 'tulo' as const,
      summa: String(v.summa),
      _readOnly: true as const,
      _palvelutyyppi: v.palvelutyyppi ?? undefined,
    }));
  const expenseLinesFromValisummat = valisummat
    .filter((v) => v.tyyppi === 'kulu' || v.tyyppi === 'poisto' || v.tyyppi === 'rahoitus_kulu')
    .map((v) => ({
      id: v.id,
      tiliryhma: v.categoryKey,
      nimi: getValisummaName(v),
      tyyppi: 'kulu' as const,
      summa: String(v.summa),
      _readOnly: true as const,
      _palvelutyyppi: v.palvelutyyppi ?? undefined,
    }));
  const investmentLinesFromValisummat = valisummat
    .filter((v) => v.tyyppi === 'investointi')
    .map((v) => ({
      id: v.id,
      tiliryhma: v.categoryKey,
      nimi: getValisummaName(v),
      tyyppi: 'investointi' as const,
      summa: String(v.summa),
      _readOnly: true as const,
      _palvelutyyppi: v.palvelutyyppi ?? undefined,
    }));

  const revenueLines = useValisummaAsRows ? revenueLinesFromValisummat : lines.filter((l) => l.tyyppi === 'tulo');
  const expenseLines = useValisummaAsRows ? expenseLinesFromValisummat : lines.filter((l) => l.tyyppi === 'kulu');
  const investmentLines = useValisummaAsRows ? investmentLinesFromValisummat : lines.filter((l) => l.tyyppi === 'investointi');

  // KVA subtotals (TalousarvioValisumma): totals when we use rivit for rows; excluded when useValisummaAsRows.
  const revenueFromValisummat = valisummat
    .filter(
      (v) =>
        (v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo') &&
        (!hasMeaningfulDrivers || v.categoryKey !== 'sales_revenue'),
    )
    .reduce((s, v) => s + parseFloat(v.summa), 0);
  const expenseFromValisummat = valisummat
    .filter((v) => v.tyyppi === 'kulu' || v.tyyppi === 'poisto' || v.tyyppi === 'rahoitus_kulu')
    .reduce((s, v) => s + parseFloat(v.summa), 0);
  const investmentFromValisummat = valisummat
    .filter((v) => v.tyyppi === 'investointi')
    .reduce((s, v) => s + parseFloat(v.summa), 0);

  // Compute revenue from drivers (Talousarvio = historical only: no tuloajurit on this tab per ADR-022)
  const drivers = activeBudget?.tuloajurit ?? [];
  const revenueDriversStatus = isRevenueDriversConfigured(drivers);
  const computedRevenueRaw = drivers.reduce((sum, d) => {
    return sum + parseFloat(d.yksikkohinta) * parseFloat(d.myytyMaara)
      + (d.perusmaksu && d.liittymamaara ? parseFloat(d.perusmaksu) * d.liittymamaara : 0);
  }, 0);
  const computedRevenue = useValisummaAsRows ? 0 : computedRevenueRaw;

  // TULOS = income minus expenses (investments shown separately, not subtracted).
  const totalRevenue = revenueLines.reduce((s, l) => s + parseFloat(String(l.summa)), 0) + (useValisummaAsRows ? 0 : revenueFromValisummat) + computedRevenue;
  const totalExpenses = expenseLines.reduce((s, l) => s + parseFloat(String(l.summa)), 0) + (useValisummaAsRows ? 0 : expenseFromValisummat);
  const totalInvestments = investmentLines.reduce((s, l) => s + parseFloat(String(l.summa)), 0) + (useValisummaAsRows ? 0 : investmentFromValisummat);
  const netResult = totalRevenue - totalExpenses;

  // Loading state
  if (loading) {
    return <div className="budget-page"><p>{t('common.loading')}</p></div>;
  }

  // Draft-mode totals (computed revenue = 0 when no budget/drivers)
  const draftRevenueLines = draftLines.filter((l) => l.tyyppi === 'tulo');
  const draftExpenseLines = draftLines.filter((l) => l.tyyppi === 'kulu');
  const draftInvestmentLines = draftLines.filter((l) => l.tyyppi === 'investointi');
  const draftTotalRevenue = draftRevenueLines.reduce((s, l) => s + l.summa, 0) + (isDraftMode ? 0 : computedRevenue);
  const draftTotalExpenses = draftExpenseLines.reduce((s, l) => s + l.summa, 0);
  const draftTotalInvestments = draftInvestmentLines.reduce((s, l) => s + l.summa, 0);
  const draftNetResult = draftTotalRevenue - draftTotalExpenses - draftTotalInvestments;

  const handleLoadDemoData = async () => {
    setSeedingDemo(true);
    setError(null);
    try {
      const result = await seedDemoData();
      const { data, sets } = await loadBudgets();
      if (result.batchId) {
        const setBudgets = await getBudgetsByBatchId(result.batchId);
        setActiveSetBudgets(setBudgets);
        setActiveBudget(null);
      } else if (data.length > 0) {
        await loadBudget(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo data');
    } finally {
      setSeedingDemo(false);
    }
  };

  const updateDraftLineSumma = (tiliryhma: string, summa: number) => {
    setDraftLines((prev) => prev.map((l) => (l.tiliryhma === tiliryhma ? { ...l, summa } : l)));
  };

  const renderDraftSection = (title: string, sectionLines: DraftLine[], sectionTotal: number, type: 'kulu' | 'tulo' | 'investointi') => (
    <div className="budget-section" key={title}>
      <h3 className="section-title">{title}</h3>
      <table className="budget-table">
        <tbody>
          {type === 'tulo' && (
            <tr
              className="budget-line-row computed-row computed-row-clickable"
              role="button"
              tabIndex={0}
              onClick={() => setShowVesimaksutBreakdown((v) => !v)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowVesimaksutBreakdown((v) => !v); } }}
              aria-expanded={showVesimaksutBreakdown}
            >
              <td className="line-code">3000</td>
              <td className="line-name">
                {t('accountGroups.3000')} <span className="computed-badge">({t('common.computed')})</span>
                <button
                  type="button"
                  className="btn-chip source-chip"
                  onClick={(e) => { e.stopPropagation(); handleEditRevenues(); }}
                  title={t('budget.vesimaksutFillRevenuesHint')}
                >
                  {t('budget.vesimaksutSourceChip')}
                </button>
                <button
                  type="button"
                  className="btn-vesimaksut-info"
                  onClick={(e) => { e.stopPropagation(); setShowVesimaksutBreakdown((v) => !v); }}
                  title={showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                  aria-expanded={showVesimaksutBreakdown}
                >
                  {showVesimaksutBreakdown ? '▼' : '▶'} {showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                </button>
              </td>
              <td className="line-amount num">
                <span className="vesimaksut-unset">—</span>
                <span className="vesimaksut-hint">{t('budget.vesimaksutFillRevenuesHint')}</span>
              </td>
              <td className="line-actions" />
            </tr>
          )}
          {type === 'tulo' && showVesimaksutBreakdown && (
            <tr className="vesimaksut-breakdown-row">
              <td colSpan={4} className="vesimaksut-breakdown-cell">
                <div className="vesimaksut-breakdown-panel">
                  <p className="vesimaksut-formula">{t('budget.vesimaksutFormula')}</p>
                  <div className="vesimaksut-missing-block">
                    <p className="vesimaksut-missing-title">{t('budget.vesimaksutMissingInputsTitle')}</p>
                    <ul className="vesimaksut-missing-list">
                      {REVENUE_DRIVER_FIELD_KEYS.map((key) => (
                        <li key={key}>{t(key)}</li>
                      ))}
                    </ul>
                    <button type="button" className="btn btn-small btn-primary" onClick={handleEditRevenues}>
                      {t('budget.vesimaksutFillRevenuesCta')}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          )}
          {sectionLines.map((line) => (
            <tr key={line.tiliryhma} className="budget-line-row">
              <td className="line-code">{line.tiliryhma}</td>
              <td className="line-name">{t(line.nameKey)}</td>
              <td className="line-amount num">
                <AmountInput
                  value={line.summa}
                  onChange={(n) => updateDraftLineSumma(line.tiliryhma, n)}
                  className="inline-edit"
                />
              </td>
              <td className="line-actions" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={`section-total section-total-${type}`}>
            <td /><td>{t('common.total')}</td>
            <td className="num"><strong>{formatCurrency(sectionTotal)}</strong></td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  /** Section row: either full BudgetLine (rivit) or valisummat-derived row (id, tiliryhma, nimi, tyyppi, summa, _readOnly?, _palvelutyyppi?). */
  type SectionLine = { id: string; tiliryhma: string; nimi: string; tyyppi: 'kulu' | 'tulo' | 'investointi'; summa: string; _readOnly?: boolean; _palvelutyyppi?: string };
  const isNumericAccountCode = (code: string) => /^\d{4,6}$/.test((code ?? '').trim());
  const renderLineRow = (line: SectionLine, isComputed = false) => {
    const readOnly = line._readOnly === true;
    return (
      <tr key={line.id} className="budget-line-row">
        <td className="line-code">{isNumericAccountCode(line.tiliryhma) ? line.tiliryhma : '—'}</td>
        <td className="line-name">
          {line.nimi}
          {isComputed && <span className="computed-badge">({t('common.computed')})</span>}
        </td>
        <td className="line-amount num">
          {readOnly ? (
            formatCurrency(line.summa)
          ) : editingLineId === line.id ? (
            <AmountInput
              value={parseFloat(editValue) || 0}
              onChange={(n) => setEditValue(String(n))}
              onBlurWithValue={(n) => saveEdit(line as BudgetLine, n)}
              className="inline-edit"
              autoFocus
            />
          ) : (
            <span className="editable-amount" onClick={() => !isComputed && startEdit(line as BudgetLine)}>
              {formatCurrency(line.summa)}
            </span>
          )}
        </td>
        <td className="line-actions">
          {!isComputed && !readOnly && (
            <button className="btn-icon" onClick={() => handleDeleteLine(line.id)} title={t('common.delete')}>×</button>
          )}
        </td>
      </tr>
    );
  };

  const waterDriver = drivers.find((d) => d.palvelutyyppi === 'vesi');
  const wastewaterDriver = drivers.find((d) => d.palvelutyyppi === 'jatevesi');
  const waterRev = driverRevenue(waterDriver);
  const wastewaterRev = driverRevenue(wastewaterDriver);
  const breakdownTotal = waterRev.total + wastewaterRev.total;

  const addLineLabel = (tipo: 'kulu' | 'tulo' | 'investointi') =>
    tipo === 'tulo' ? t('budget.addIncomeLine') : tipo === 'kulu' ? t('budget.addExpenseLine') : t('budget.addLine');

  const renderSection = (title: string, sectionLines: SectionLine[], sectionTotal: number, type: 'kulu' | 'tulo' | 'investointi') => (
    <div className="budget-section">
      <h3 className="section-title">{title}</h3>
      {type === 'tulo' && activeBudget && (
        <>
          <div className="budget-annual-base-fee-row">
            <label className="budget-annual-base-fee-label">{t('budget.annualBaseFeeTotal')} (€)</label>
            <AmountInput
              value={activeBudget.perusmaksuYhteensa != null ? Number(activeBudget.perusmaksuYhteensa) : 0}
              onChange={() => {}}
              onBlurWithValue={(n) => saveAnnualBaseFeeTotal(n >= 0 ? n : 0)}
              className="inline-edit budget-annual-base-fee-input"
            />
          </div>
          {!useValisummaAsRows && (
          <div ref={revenueDriversRef} id="revenue-drivers-panel">
            <RevenueDriversPanel
              budget={activeBudget}
              savingDriverType={savingDriverType}
              driverFieldErrors={driverFieldErrors}
              updateDriverField={updateDriverField}
              saveDriver={saveDriver}
              setDriverFieldErrors={setDriverFieldErrors}
              t={t as (key: string, fallback?: string) => string}
            />
          </div>
          )}
        </>
      )}
      {!useValisummaAsRows && sectionLines.length === 0 ? (
        <div className="budget-section-empty">
          <p className="budget-section-empty-hint">{t('budget.emptySectionHint')}</p>
          {addingType === type ? (
            <div className="add-line-form">
              <input placeholder={t('budget.accountGroup')} value={newLine.tiliryhma} onChange={(e) => setNewLine((p) => ({ ...p, tiliryhma: e.target.value }))} className="input-sm" />
              <input placeholder={t('budget.name')} value={newLine.nimi} onChange={(e) => setNewLine((p) => ({ ...p, nimi: e.target.value }))} className="input-sm input-wide" />
              <input placeholder={t('budget.amount')} type="number" value={newLine.summa} onChange={(e) => setNewLine((p) => ({ ...p, summa: e.target.value }))} className="input-sm" />
              <button className="btn btn-small btn-primary" onClick={handleAddLine}>{t('common.add')}</button>
              <button className="btn btn-small" onClick={() => setAddingType(null)}>{t('common.cancel')}</button>
            </div>
          ) : (
            <button type="button" className="btn btn-ghost add-line-btn" onClick={() => { setAddingType(type); setNewLine({ tiliryhma: '9999', nimi: type === 'tulo' ? 'Uusi tulo' : type === 'kulu' ? 'Uusi kulu' : 'Uusi rivi', summa: '0' }); }}>+ {addLineLabel(type)}</button>
          )}
        </div>
      ) : (
      <>
      <table className="budget-table">
        <tbody>
          {type === 'tulo' && (
            <>
              {!useValisummaAsRows && (
              <>
              <tr
                className="budget-line-row computed-row computed-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => setShowVesimaksutBreakdown((v) => !v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowVesimaksutBreakdown((v) => !v); } }}
                aria-expanded={showVesimaksutBreakdown}
              >
                <td className="line-code">3000</td>
                <td className="line-name">
                  {t('accountGroups.3000')} <span className="computed-badge">({t('common.computed')})</span>
                  <button
                    type="button"
                    className="btn-chip source-chip"
                    onClick={(e) => { e.stopPropagation(); handleEditRevenues(); }}
                    title={t('budget.vesimaksutFillRevenuesHint')}
                  >
                    {t('budget.vesimaksutSourceChip')}
                  </button>
                  <button
                    type="button"
                    className="btn-vesimaksut-info"
                    onClick={(e) => { e.stopPropagation(); setShowVesimaksutBreakdown((v) => !v); }}
                    title={showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                    aria-expanded={showVesimaksutBreakdown}
                  >
                    {showVesimaksutBreakdown ? '▼' : '▶'} {showVesimaksutBreakdown ? t('budget.hideCalculation') : t('budget.showCalculation')}
                  </button>
                </td>
                <td className="line-amount num">
                  {revenueDriversStatus.configured ? (
                    formatCurrency(computedRevenue)
                  ) : (
                    <>
                      <span className="vesimaksut-unset">—</span>
                      <span className="vesimaksut-hint">{t('budget.vesimaksutFillRevenuesHint')}</span>
                    </>
                  )}
                </td>
                <td className="line-actions" />
              </tr>
              {showVesimaksutBreakdown && (
                <tr className="vesimaksut-breakdown-row">
                  <td colSpan={4} className="vesimaksut-breakdown-cell">
                    <div className="vesimaksut-breakdown-panel">
                      <p className="vesimaksut-formula">{t('budget.vesimaksutFormula')}</p>
                      {revenueDriversStatus.configured ? (
                        <>
                          <table className="vesimaksut-breakdown-table">
                            <tbody>
                              {waterDriver && (waterRev.usage > 0 || waterRev.baseFee > 0) && (
                                <>
                                  <tr>
                                    <td>{t('revenue.water.title')}</td>
                                    <td className="num">{formatCurrency(waterRev.usage)}</td>
                                  </tr>
                                  {waterRev.baseFee > 0 && (
                                    <tr>
                                      <td>{t('revenue.water.baseFeeRevenue')}</td>
                                      <td className="num">{formatCurrency(waterRev.baseFee)}</td>
                                    </tr>
                                  )}
                                </>
                              )}
                              {wastewaterDriver && (wastewaterRev.usage > 0 || wastewaterRev.baseFee > 0) && (
                                <>
                                  <tr>
                                    <td>{t('revenue.wastewater.title')}</td>
                                    <td className="num">{formatCurrency(wastewaterRev.usage)}</td>
                                  </tr>
                                  {wastewaterRev.baseFee > 0 && (
                                    <tr>
                                      <td>{t('revenue.wastewater.baseFeeRevenue')}</td>
                                      <td className="num">{formatCurrency(wastewaterRev.baseFee)}</td>
                                    </tr>
                                  )}
                                </>
                              )}
                              <tr className="vesimaksut-breakdown-total">
                                <td>{t('revenue.totalRevenue')} ({t('budget.revenueVatFree')})</td>
                                <td className="num"><strong>{formatCurrency(breakdownTotal)}</strong></td>
                              </tr>
                            </tbody>
                          </table>
                          <div className="vesimaksut-actions">
                            <button type="button" className="btn btn-small btn-primary" onClick={handleEditRevenues}>
                              {t('budget.editRevenues')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="vesimaksut-missing-block">
                          <p className="vesimaksut-missing-title">{t('budget.vesimaksutMissingInputsTitle')}</p>
                          <ul className="vesimaksut-missing-list">
                            {revenueDriversStatus.missingFieldKeys.map((key) => (
                              <li key={key}>{t(key)}</li>
                            ))}
                          </ul>
                          <button type="button" className="btn btn-small btn-primary" onClick={handleEditRevenues}>
                            {t('budget.vesimaksutFillRevenuesCta')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </>
              )}
            </>
          )}
          {sectionLines.map((l) => renderLineRow(l))}
        </tbody>
        <tfoot>
          <tr className={`section-total section-total-${type}`}>
            <td></td>
            <td>{t('common.total')}</td>
            <td className="num"><strong>{formatCurrency(type === 'tulo' ? totalRevenue : sectionTotal)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      {addingType === type ? (
        <div className="add-line-form">
          <input placeholder={t('budget.accountGroup')} value={newLine.tiliryhma} onChange={(e) => setNewLine((p) => ({ ...p, tiliryhma: e.target.value }))} className="input-sm" />
          <input placeholder={t('budget.name')} value={newLine.nimi} onChange={(e) => setNewLine((p) => ({ ...p, nimi: e.target.value }))} className="input-sm input-wide" />
          <input placeholder={t('budget.amount')} type="number" value={newLine.summa} onChange={(e) => setNewLine((p) => ({ ...p, summa: e.target.value }))} className="input-sm" />
          <button className="btn btn-small btn-primary" onClick={handleAddLine}>{t('common.add')}</button>
          <button className="btn btn-small" onClick={() => setAddingType(null)}>{t('common.cancel')}</button>
        </div>
      ) : !useValisummaAsRows ? (
        <button type="button" className="btn btn-ghost add-line-btn" onClick={() => { setAddingType(type); setNewLine({ tiliryhma: '9999', nimi: type === 'tulo' ? 'Uusi tulo' : type === 'kulu' ? 'Uusi kulu' : 'Uusi rivi', summa: '0' }); }}>+ {addLineLabel(type)}</button>
      ) : null}
      </>
      )}
    </div>
  );

  return (
    <div className="budget-page">
      {error && (
        <div className="error-banner"><span>⚠ {error}</span><button className="btn btn-small" onClick={() => setError(null)}>{t('common.close')}</button></div>
      )}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-header-title-block">
            <h2>{t('budget.title')}</h2>
            <p className="budget-page-subtitle">{t('budget.historicalBaseMessage')}</p>
          </div>
          {budgets.length > 0 || budgetSets.length > 0 ? (
            <>
              <select
                className="filter-select year-select"
                value={selectValue}
                onChange={async (e) => {
                  const v = e.target.value;
                  if (v === '__new__') {
                    switchToNewDraft();
                    return;
                  }
                  if (v.startsWith('__set__:')) {
                    const batchId = v.slice(8);
                    try {
                      setError(null);
                      const data = await getBudgetsByBatchId(batchId);
                      setActiveBudget(null);
                      setActiveSetBudgets(data);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to load set');
                    }
                    return;
                  }
                  await loadBudget(v);
                }}
              >
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>{b.nimi || `${t('budget.title')} ${b.vuosi}`}</option>
                ))}
                {budgetSets.map((s) => (
                  <option key={s.batchId} value={`__set__:${s.batchId}`}>
                    {s.minVuosi != null && s.maxVuosi != null ? `${s.minVuosi}–${s.maxVuosi} (3 vuotta)` : `${s.nimi} (3 vuotta)`}
                  </option>
                ))}
                <option value="__new__">+ {t('budget.newBudget')}</option>
              </select>
              {isDraftMode && !activeSetBudgets?.length ? (
                <span className="status-badge status-luonnos">{t('budget.emptyDraft')}</span>
              ) : activeSetBudgets?.length ? (
                <span className="status-badge status-luonnos">3 vuotta</span>
              ) : activeBudget ? (
                <span className={`status-badge status-${activeBudget.tila}`}>
                  {activeBudget.tila === 'luonnos' ? t('budget.status.draft') : t('budget.status.confirmed')}
                </span>
              ) : null}
            </>
          ) : (
            <span className="status-badge status-luonnos">{t('budget.emptyDraft')}</span>
          )}
        </div>
        <div className="header-actions">
          {isDraftMode ? (
            <>
              {/* Import from file: KVA flow totals-only (preview-kva + KvaImportPreview). Tulot edited manually in RevenueDriversPanel. */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKvaImport(true)}
              >
                📁 {t('budget.importFromFile')}
              </button>
              {isDemoEnabled && (
                <button type="button" className="btn btn-secondary" onClick={handleLoadDemoData} disabled={seedingDemo}>
                  {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={() => setShowSaveModal(true)}>
                {t('budget.saveBudget')}
              </button>
            </>
          ) : (
            <>
              {/* Primary: KVA flow totals-only. Legacy account-line import via BudgetImport when budget selected. */}
              <button type="button" className="btn btn-primary" onClick={() => setShowKvaImport(true)}>
                📁 {t('budget.importFromFile')}
              </button>
              {activeBudget && (
                <button type="button" className="btn btn-secondary" onClick={() => setShowImport(true)}>
                  {t('import.importAccountLines', 'Import account-level rows (CSV/Excel)')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save draft as budget modal */}
      {showSaveModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="save-budget-title">
          <div className="modal-content" style={{ padding: '20px' }}>
            <h3 id="save-budget-title" style={{ marginTop: 0 }}>{t('budget.saveBudgetModalTitle')}</h3>
            <div className="form-row">
              <label htmlFor="budget-name">{t('budget.budgetName')}</label>
              <input
                id="budget-name"
                type="text"
                value={saveModalName}
                onChange={(e) => setSaveModalName(e.target.value)}
                placeholder={t('budget.budgetNamePlaceholder')}
                className="input-field"
              />
            </div>
            <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
              {t('budget.saveThreeYearsHint', 'Creates 3 years')}: {DRAFT_THREE_YEARS.join(', ')}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSaveModal(false)} disabled={savingBudget}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveDraftAsBudget}
                disabled={savingBudget || !saveModalName.trim()}
              >
                {savingBudget ? t('common.loading') : t('budget.saveBudget')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create budget for import (when no budget exists yet) */}
      {showImportCreateModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="import-create-title">
          <div className="modal-content" style={{ padding: '20px' }}>
            <h3 id="import-create-title" style={{ marginTop: 0 }}>{t('budget.importCreateBudgetTitle')}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{t('budget.importCreateBudgetHint')}</p>
            <div className="form-row">
              <label htmlFor="import-create-name">{t('budget.budgetName')}</label>
              <input
                id="import-create-name"
                type="text"
                value={importCreateName}
                onChange={(e) => setImportCreateName(e.target.value)}
                placeholder={t('budget.budgetNamePlaceholder')}
                className="input-field"
              />
            </div>
            <div className="form-row">
              <label htmlFor="import-create-year">{t('budget.budgetYear')}</label>
              <select
                id="import-create-year"
                value={importCreateYear}
                onChange={(e) => setImportCreateYear(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowImportCreateModal(false)} disabled={creatingForImport}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateBudgetForImport}
                disabled={creatingForImport}
              >
                {creatingForImport ? t('common.loading') : t('budget.importCreateAndOpen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Import Overlay (generic CSV/Excel) */}
      {showImport && activeBudget && (
        <BudgetImport
          budgetId={activeBudget.id}
          onImportComplete={() => loadBudget(activeBudget.id)}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* KVA Import Overlay (subtotal-first flow) */}
      {showKvaImport && (
        <KvaImportPreview
          onImportComplete={async (result) => {
            setShowKvaImport(false);
            setError(null);
            await loadBudgets();
            if (result.importBatchId) {
              try {
                const data = await getBudgetsByBatchId(result.importBatchId);
                setActiveSetBudgets(data);
                setActiveBudget(null);
              } catch {
                setError(t('budget.loadFailedAfterImport'));
                try {
                  await loadBudget(result.budgetId);
                } catch {
                  /* already set error */
                }
              }
            } else {
              const list = await listBudgets();
              const fromList = list.find((b) => b.id === result.budgetId);
              if (fromList) {
                setActiveBudget({ ...fromList, rivit: [], tuloajurit: [], valisummat: [] });
              }
              try {
                await loadBudget(result.budgetId);
              } catch {
                setError(t('budget.loadFailedAfterImport'));
              }
            }
          }}
          onClose={() => setShowKvaImport(false)}
        />
      )}

      {isDraftMode ? (
        <div className="budget-year-cards-wrapper">
          <p className="skeleton-hint" style={{ marginBottom: '12px' }}>{t('budget.emptyDraftHint')}</p>
          <div className="budget-year-cards" data-testid="budget-draft-three-cards">
            {DRAFT_THREE_YEARS.map((vuosi, i) => {
              const totals = draftThreeYearData[vuosi] ?? { tulot: 0, kulut: 0, poistot: 0, investoinnit: 0 };
              const prevTotals = i > 0 ? (draftThreeYearData[DRAFT_THREE_YEARS[i - 1]] ?? { tulot: 0, kulut: 0, poistot: 0, investoinnit: 0 }) : null;
              const tulos = totals.tulot - totals.kulut - totals.poistot;
              const updateDraft = (field: keyof DraftYearTotals, value: number) => {
                setDraftThreeYearData((prev) => ({
                  ...prev,
                  [vuosi]: { ...(prev[vuosi] ?? { tulot: 0, kulut: 0, poistot: 0, investoinnit: 0 }), [field]: value },
                }));
              };
              return (
                <React.Fragment key={vuosi}>
                  {i > 0 ? (
                    <div className="budget-year-delta" data-testid={`draft-delta-${DRAFT_THREE_YEARS[i - 1]}-${vuosi}`}>
                      <div className="budget-year-delta-label">{DRAFT_THREE_YEARS[i - 1]} → {vuosi}</div>
                      <div className={`budget-year-delta-row budget-year-delta-tulot ${(percentChange(prevTotals!.tulot, totals.tulot) ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                        <span className="budget-year-delta-name">Tulot</span>
                        <span className="budget-year-delta-value">{formatPercentDelta(percentChange(prevTotals!.tulot, totals.tulot))}</span>
                      </div>
                      <div className={`budget-year-delta-row budget-year-delta-kulut ${(percentChange(prevTotals!.kulut, totals.kulut) ?? 0) <= 0 ? 'positive' : 'negative'}`}>
                        <span className="budget-year-delta-name">Kulut</span>
                        <span className="budget-year-delta-value">{formatPercentDelta(percentChange(prevTotals!.kulut, totals.kulut))}</span>
                      </div>
                      <div className={`budget-year-delta-row budget-year-delta-poistot ${(percentChange(prevTotals!.poistot, totals.poistot) ?? 0) <= 0 ? 'positive' : 'negative'}`}>
                        <span className="budget-year-delta-name">Poistot</span>
                        <span className="budget-year-delta-value">{formatPercentDelta(percentChange(prevTotals!.poistot, totals.poistot))}</span>
                      </div>
                      {(() => {
                        const prevTulos = prevTotals!.tulot - prevTotals!.kulut - prevTotals!.poistot;
                        const tulosRes = computeTulosDelta(prevTulos, tulos);
                        const tulosText = tulosRes.text.startsWith('budget.') ? t(tulosRes.text) : tulosRes.text;
                        return (
                          <div className={`budget-year-delta-row budget-year-delta-tulos budget-year-delta-${tulosRes.improvement}`}>
                            <span className="budget-year-delta-name">Tulos</span>
                            <span className="budget-year-delta-value">{formatCurrency(tulosRes.deltaEur)} {tulosText}</span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : null}
                  <div className="budget-year-card" data-testid={`draft-year-card-${vuosi}`}>
                    <h3 className="budget-year-card-header">
                      Vuosi {vuosi}
                      <span className={`budget-year-card-tulos ${tulos >= 0 ? 'surplus' : 'deficit'}`}>
                        {formatCurrency(Math.abs(tulos))} {tulos >= 0 ? t('common.surplus') : t('common.deficit')}
                      </span>
                    </h3>
                    <div className="budget-year-bucket budget-year-bucket-tulot">
                      <div className="budget-year-bucket-row">
                        <span>{t('budget.sections.revenue')}</span>
                        <span className="num">
                          <AmountInput
                            value={totals.tulot}
                            onChange={(n) => updateDraft('tulot', n)}
                            className="inline-edit"
                          />
                        </span>
                      </div>
                    </div>
                    <div className="budget-year-bucket budget-year-bucket-kulut">
                      <div className="budget-year-bucket-row">
                        <span>Kulut</span>
                        <span className="num">
                          <AmountInput
                            value={totals.kulut}
                            onChange={(n) => updateDraft('kulut', n)}
                            className="inline-edit"
                          />
                        </span>
                      </div>
                    </div>
                    <div className="budget-year-bucket budget-year-bucket-poistot">
                      <div className="budget-year-bucket-row">
                        <span>Poistot</span>
                        <span className="num">
                          <AmountInput
                            value={totals.poistot}
                            onChange={(n) => updateDraft('poistot', n)}
                            className="inline-edit"
                          />
                        </span>
                      </div>
                    </div>
                    <div className="budget-year-bucket budget-year-bucket-investoinnit">
                      <div className="budget-year-bucket-row">
                        <span>{t('budget.sections.investments')}</span>
                        <span className="num">
                          <AmountInput
                            value={totals.investoinnit}
                            onChange={(n) => updateDraft('investoinnit', n)}
                            className="inline-edit"
                          />
                        </span>
                      </div>
                    </div>
                    <div className={`budget-year-card-footer ${tulos >= 0 ? 'surplus' : 'deficit'}`}>
                      <span className="result-label">{t('budget.result')} </span>
                      <span>{formatCurrency(Math.abs(tulos))} {tulos >= 0 ? t('common.surplus') : t('common.deficit')}</span>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      ) : activeSetBudgets?.length ? (
        <div className="budget-year-cards-wrapper">
          <div className="budget-year-cards" data-testid="budget-set-view">
          {(() => {
            type YearStats = { budget: Budget; tulot: number; kulut: number; poistot: number; investoinnit: number; tulos: number; bucketRows: Array<{ key: string; label: string; total: number; rows: Array<{ id: string; label: string; summa: number }> }> };
            const batchId = activeSetBudgets[0]?.importBatchId ?? '';
            const refreshSet = async () => {
              if (!batchId) return;
              try {
                const data = await getBudgetsByBatchId(batchId);
                setActiveSetBudgets(data);
              } catch {
                setError(t('budget.loadFailedAfterImport'));
              }
            };
            const cardsData: YearStats[] = activeSetBudgets.map((budget) => {
              const valiRaw = (budget.valisummat ?? []).map(normalizeValisumma);
              const vali = filterValisummatNoKvaTotaltDoubleCount(valiRaw as unknown as import('../utils/budgetValisummatFilter').ValisummaLike[]) as unknown as BudgetValisumma[];
              const tulot = vali.filter((v) => v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo').reduce((s, v) => s + parseFloat(v.summa), 0);
              const kulut = vali.filter((v) => v.tyyppi === 'kulu' || v.tyyppi === 'rahoitus_kulu').reduce((s, v) => s + parseFloat(v.summa), 0);
              const poistot = vali.filter((v) => v.tyyppi === 'poisto').reduce((s, v) => s + parseFloat(v.summa), 0);
              const investoinnit = vali.filter((v) => v.tyyppi === 'investointi').reduce((s, v) => s + parseFloat(v.summa), 0);
              const tulos = tulot - kulut - poistot;
              const bucketRows: YearStats['bucketRows'] = [
                { key: 'tulot', label: 'Tulot', total: tulot, rows: vali.filter((v) => v.tyyppi === 'tulo' || v.tyyppi === 'rahoitus_tulo').map((v) => ({ id: v.id, label: getValisummaName(v), summa: parseFloat(v.summa) })) },
                { key: 'kulut', label: 'Kulut', total: kulut, rows: vali.filter((v) => v.tyyppi === 'kulu' || v.tyyppi === 'rahoitus_kulu').map((v) => ({ id: v.id, label: getValisummaName(v), summa: parseFloat(v.summa) })) },
                { key: 'poistot', label: 'Poistot', total: poistot, rows: vali.filter((v) => v.tyyppi === 'poisto').map((v) => ({ id: v.id, label: getValisummaName(v), summa: parseFloat(v.summa) })) },
                { key: 'investoinnit', label: 'Investoinnit', total: investoinnit, rows: vali.filter((v) => v.tyyppi === 'investointi').map((v) => ({ id: v.id, label: getValisummaName(v), summa: parseFloat(v.summa) })) },
              ];
              return { budget, tulot, kulut, poistot, investoinnit, tulos, bucketRows };
            });
            return cardsData.map((data, i) => (
              <React.Fragment key={data.budget.id}>
                {i > 0 ? (
                  <div className="budget-year-delta" data-testid={`delta-${cardsData[i - 1].budget.vuosi}-${data.budget.vuosi}`}>
                    <div className="budget-year-delta-label">{cardsData[i - 1].budget.vuosi} → {data.budget.vuosi}</div>
                    <div className={`budget-year-delta-row budget-year-delta-tulot ${(percentChange(cardsData[i - 1].tulot, data.tulot) ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                      <span className="budget-year-delta-name">Tulot</span>
                      <span className="budget-year-delta-value">{formatPercentDelta(percentChange(cardsData[i - 1].tulot, data.tulot))}</span>
                    </div>
                    <div className={`budget-year-delta-row budget-year-delta-kulut ${(percentChange(cardsData[i - 1].kulut, data.kulut) ?? 0) <= 0 ? 'positive' : 'negative'}`}>
                      <span className="budget-year-delta-name">Kulut</span>
                      <span className="budget-year-delta-value">{formatPercentDelta(percentChange(cardsData[i - 1].kulut, data.kulut))}</span>
                    </div>
                    <div className={`budget-year-delta-row budget-year-delta-poistot ${(percentChange(cardsData[i - 1].poistot, data.poistot) ?? 0) <= 0 ? 'positive' : 'negative'}`}>
                      <span className="budget-year-delta-name">Poistot</span>
                      <span className="budget-year-delta-value">{formatPercentDelta(percentChange(cardsData[i - 1].poistot, data.poistot))}</span>
                    </div>
                    {(() => {
                      const prevTulos = cardsData[i - 1].tulos;
                      const currTulos = data.tulos;
                      const tulosRes = computeTulosDelta(prevTulos, currTulos);
                      const tulosText = tulosRes.text.startsWith('budget.') ? t(tulosRes.text) : tulosRes.text;
                      return (
                        <div className={`budget-year-delta-row budget-year-delta-tulos budget-year-delta-${tulosRes.improvement}`}>
                          <span className="budget-year-delta-name">Tulos</span>
                          <span className="budget-year-delta-value">{formatCurrency(tulosRes.deltaEur)} {tulosText}</span>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                <div className="budget-year-card" data-testid={`year-card-${data.budget.vuosi}`}>
                  <h3 className="budget-year-card-header">
                    Vuosi {data.budget.vuosi}
                    <span className={`budget-year-card-tulos ${data.tulos >= 0 ? 'surplus' : 'deficit'}`}>
                      {formatCurrency(Math.abs(data.tulos))} {data.tulos >= 0 ? t('common.surplus') : t('common.deficit')}
                    </span>
                  </h3>
                  {data.bucketRows.map((b) => {
                    const isExpanded = (key: string) => expandedSetBucket === `${data.budget.id}:${key}`;
                    const toggle = (key: string) => setExpandedSetBucket((prev) => (prev === `${data.budget.id}:${key}` ? null : `${data.budget.id}:${key}`));
                    return (
                      <div key={b.key} className={`budget-year-bucket budget-year-bucket-${b.key}`}>
                        <div
                          className="budget-year-bucket-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(b.key)}
                          onKeyDown={(e) => e.key === 'Enter' && toggle(b.key)}
                          aria-expanded={isExpanded(b.key)}
                        >
                          <span>{b.label}</span>
                          <span className="num">{formatCurrency(b.total)}</span>
                          <span className="budget-year-expand">{isExpanded(b.key) ? '▼' : '▶'}</span>
                        </div>
                        {isExpanded(b.key) && b.rows.length > 0 && (
                          <div className="budget-year-bucket-details">
                            {b.rows.map((r) => (
                              <div key={r.id} className="budget-year-detail-row">
                                <span>{r.label}</span>
                                <span className="num">
                                  <AmountInput
                                    value={r.summa}
                                    onChange={() => {}}
                                    onBlurWithValue={async (n) => {
                                      if (data.budget.id && r.id) {
                                        try {
                                          await updateValisumma(data.budget.id, r.id, { summa: n });
                                          await refreshSet();
                                        } catch {
                                          setError(t('budget.updateValisummaFailed', 'Failed to update amount'));
                                        }
                                      }
                                    }}
                                    className="inline-edit"
                                  />
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className={`budget-year-card-footer ${data.tulos >= 0 ? 'surplus' : 'deficit'}`}>
                    <span className="result-label">{t('budget.result')} </span>
                    <span>{formatCurrency(Math.abs(data.tulos))} {data.tulos >= 0 ? t('common.surplus') : t('common.deficit')}</span>
                  </div>
                  <span className="budget-year-source-info">
                    <button type="button" className="budget-year-source-btn" title={t('budget.sourceTooltip', { name: data.budget.nimi || `${t('budget.title')} ${data.budget.vuosi}` })} aria-label={t('budget.sourceTooltip', { name: data.budget.nimi || `${t('budget.title')} ${data.budget.vuosi}` })}>ℹ</button>
                  </span>
                </div>
              </React.Fragment>
            ));
          })()}
          </div>
        </div>
      ) : activeBudget ? (
        <>
          {renderSection(t('budget.sections.revenue'), revenueLines, totalRevenue, 'tulo')}
          {renderSection(t('budget.sections.expenses'), expenseLines, totalExpenses, 'kulu')}
          {renderSection(t('budget.sections.investments'), investmentLines, totalInvestments, 'investointi')}
          <div className="budget-result">
            <span className="result-label">{t('budget.result')} </span>
            <span className={`result-value ${netResult >= 0 ? 'surplus' : 'deficit'}`}>
              {formatCurrency(Math.abs(netResult))} {netResult >= 0 ? t('common.surplus') : t('common.deficit')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
};
