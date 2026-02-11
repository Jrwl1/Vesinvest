import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listBudgets, getBudget, createBudget, updateBudget,
  createBudgetLine, updateBudgetLine, deleteBudgetLine,
  createRevenueDriver, updateRevenueDriver,
  seedDemoData,
  type Budget, type BudgetLine, type RevenueDriver,
} from '../api';
import { formatCurrency } from '../utils/format';
import { filterValisummatNoKvaTotaltDoubleCount } from '../utils/budgetValisummatFilter';
import { BudgetImport } from '../components/BudgetImport';
import { KvaImportPreview } from '../components/KvaImportPreview';
import { RevenueDriversPanel } from '../components/RevenueDriversPanel';
import { useNavigation } from '../context/NavigationContext';
import { useDemoStatus } from '../context/DemoStatusContext';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);

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

function getDefaultDraftLines(): DraftLine[] {
  return SKELETON_LINES.map((l) => ({ ...l, summa: 0 }));
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
  const { t } = useTranslation();
  const { navigateToTab } = useNavigation();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
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

  const isDraftMode = !activeBudget;

  const loadBudgets = useCallback(async () => {
    try {
      const data = await listBudgets();
      setBudgets(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
      return [];
    }
  }, []);

  const loadBudget = useCallback(async (id: string) => {
    try {
      const data = await getBudget(id);
      setActiveBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await loadBudgets();
      if (data.length > 0) {
        await loadBudget(data[0].id);
      }
      setLoading(false);
    })();
  }, [loadBudgets, loadBudget]);

  const handleEditRevenues = useCallback(() => {
    try {
      sessionStorage.setItem('scrollToRevenueDrivers', '1');
    } catch {
      /* ignore */
    }
    navigateToTab('revenue');
  }, [navigateToTab]);

  // Reset to fresh draft (e.g. "Uusi talousarvio" selected)
  const switchToNewDraft = useCallback(() => {
    setActiveBudget(null);
    setDraftLines(getDefaultDraftLines());
  }, []);

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

  // Save draft as persisted budget (modal submit)
  const handleSaveDraftAsBudget = async () => {
    const name = saveModalName.trim();
    if (!name) return;
    setSavingBudget(true);
    setError(null);
    try {
      const created = await createBudget({ vuosi: saveModalYear, nimi: name });
      for (const line of draftLines) {
        await createBudgetLine(created.id, {
          tiliryhma: line.tiliryhma,
          nimi: t(line.nameKey),
          tyyppi: line.tyyppi,
          summa: line.summa,
        });
      }
      await loadBudgets();
      await loadBudget(created.id);
      setShowSaveModal(false);
      setSaveModalName('');
      setSaveModalYear(currentYear);
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

  // Group lines by type (TalousarvioRivi). When rivit are empty but valisummat exist (KVA import), show valisummat as rows.
  const lines = activeBudget?.rivit ?? [];
  const valisummatRaw = activeBudget?.valisummat ?? [];
  // Prevent KVA totalt double-count: exclude 'muu' for (tyyppi, categoryKey) when vesi/jatevesi splits exist.
  const valisummat = filterValisummatNoKvaTotaltDoubleCount(valisummatRaw);
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
      nimi: (v.label || v.categoryKey).trim() || v.categoryKey,
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
      nimi: (v.label || v.categoryKey).trim() || v.categoryKey,
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
      nimi: (v.label || v.categoryKey).trim() || v.categoryKey,
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

  // Compute revenue from drivers
  const drivers = activeBudget?.tuloajurit ?? [];
  const revenueDriversStatus = isRevenueDriversConfigured(drivers);
  const computedRevenue = drivers.reduce((sum, d) => {
    return sum + parseFloat(d.yksikkohinta) * parseFloat(d.myytyMaara)
      + (d.perusmaksu && d.liittymamaara ? parseFloat(d.perusmaksu) * d.liittymamaara : 0);
  }, 0);

  const totalRevenue = revenueLines.reduce((s, l) => s + parseFloat(l.summa), 0) + (useValisummaAsRows ? 0 : revenueFromValisummat) + computedRevenue;
  const totalExpenses = expenseLines.reduce((s, l) => s + parseFloat(l.summa), 0) + (useValisummaAsRows ? 0 : expenseFromValisummat);
  const totalInvestments = investmentLines.reduce((s, l) => s + parseFloat(l.summa), 0) + (useValisummaAsRows ? 0 : investmentFromValisummat);
  const netResult = totalRevenue - totalExpenses - totalInvestments;

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
      await seedDemoData();
      const data = await loadBudgets();
      if (data.length > 0) await loadBudget(data[0].id);
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
          <tr className="section-total">
            <td /><td>{t('common.total')}</td>
            <td className="num"><strong>{formatCurrency(sectionTotal)}</strong></td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  type LineForDisplay = BudgetLine & { _readOnly?: boolean; _palvelutyyppi?: string };
  const renderLineRow = (line: LineForDisplay, isComputed = false) => {
    const readOnly = line._readOnly === true;
    const palvelutyyppi = line._palvelutyyppi;
    return (
      <tr key={line.id} className="budget-line-row">
        <td className="line-code">{line.tiliryhma}</td>
        <td className="line-name">
          {line.nimi}
          {palvelutyyppi && <span className="palvelutyyppi-badge" title={palvelutyyppi}>{palvelutyyppi}</span>}
          {isComputed && <span className="computed-badge">({t('common.computed')})</span>}
        </td>
        <td className="line-amount num">
          {readOnly ? (
            formatCurrency(line.summa)
          ) : editingLineId === line.id ? (
            <AmountInput
              value={parseFloat(editValue) || 0}
              onChange={(n) => setEditValue(String(n))}
              onBlurWithValue={(n) => saveEdit(line, n)}
              className="inline-edit"
              autoFocus
            />
          ) : (
            <span className="editable-amount" onClick={() => !isComputed && startEdit(line)}>
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

  const renderSection = (title: string, sectionLines: BudgetLine[], sectionTotal: number, type: 'kulu' | 'tulo' | 'investointi') => (
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
          <RevenueDriversPanel
            budget={activeBudget}
            savingDriverType={savingDriverType}
            driverFieldErrors={driverFieldErrors}
            updateDriverField={updateDriverField}
            saveDriver={saveDriver}
            setDriverFieldErrors={setDriverFieldErrors}
            t={t}
          />
        </>
      )}
      <table className="budget-table">
        <tbody>
          {type === 'tulo' && (
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
          {sectionLines.map((l) => renderLineRow(l))}
        </tbody>
        <tfoot>
          <tr className="section-total">
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
      ) : (
        <button className="btn btn-ghost add-line-btn" onClick={() => setAddingType(type)}>+ {t('budget.addLine')}</button>
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
          <h2>{t('budget.title')}</h2>
          {budgets.length > 0 ? (
            <>
              <select
                className="filter-select year-select"
                value={isDraftMode ? '__new__' : (activeBudget?.id ?? '')}
                onChange={async (e) => {
                  if (e.target.value === '__new__') {
                    switchToNewDraft();
                  } else {
                    await loadBudget(e.target.value);
                  }
                }}
              >
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>{b.nimi || `${t('budget.title')} ${b.vuosi}`}</option>
                ))}
                <option value="__new__">+ {t('budget.newBudget')}</option>
              </select>
              {isDraftMode ? (
                <span className="status-badge status-luonnos">{t('budget.emptyDraft')}</span>
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
              {/* Import from file: opens KVA flow (preview-kva + KvaImportPreview). Budget created on confirm. */}
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
              {/* Primary: Import from file uses KVA flow (preview-kva + 3-section UI). */}
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
            <div className="form-row">
              <label htmlFor="budget-year">{t('budget.budgetYear')}</label>
              <select
                id="budget-year"
                value={saveModalYear}
                onChange={(e) => setSaveModalYear(parseInt(e.target.value, 10))}
                className="input-field"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
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
          onImportComplete={async (budgetId) => {
            setShowKvaImport(false);
            setError(null);
            const list = await loadBudgets();
            const fromList = list.find((b) => b.id === budgetId);
            if (fromList) {
              setActiveBudget({ ...fromList, rivit: [], tuloajurit: [], valisummat: [] });
            }
            // Full load populates tuloajurit/valisummat so Tulot drivers panel shows immediately
            try {
              await loadBudget(budgetId);
            } catch {
              setError(t('budget.loadFailedAfterImport'));
            }
          }}
          onClose={() => setShowKvaImport(false)}
        />
      )}

      {isDraftMode ? (
        <>
          <p className="skeleton-hint">{t('budget.emptyDraftHint')}</p>
          {renderDraftSection(t('budget.sections.revenue'), draftRevenueLines, draftTotalRevenue, 'tulo')}
          {renderDraftSection(t('budget.sections.expenses'), draftExpenseLines, draftTotalExpenses, 'kulu')}
          {renderDraftSection(t('budget.sections.investments'), draftInvestmentLines, draftTotalInvestments, 'investointi')}
          <div className="budget-result">
            <span className="result-label">{t('budget.result')}</span>
            <span className={`result-value ${draftNetResult >= 0 ? 'surplus' : 'deficit'}`}>
              {formatCurrency(Math.abs(draftNetResult))} {draftNetResult >= 0 ? t('common.surplus') : t('common.deficit')}
            </span>
          </div>
        </>
      ) : activeBudget ? (
        <>
          {renderSection(t('budget.sections.revenue'), revenueLines, totalRevenue, 'tulo')}
          {renderSection(t('budget.sections.expenses'), expenseLines, totalExpenses, 'kulu')}
          {renderSection(t('budget.sections.investments'), investmentLines, totalInvestments, 'investointi')}
          <div className="budget-result">
            <span className="result-label">{t('budget.result')}</span>
            <span className={`result-value ${netResult >= 0 ? 'surplus' : 'deficit'}`}>
              {formatCurrency(Math.abs(netResult))} {netResult >= 0 ? t('common.surplus') : t('common.deficit')}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
};
