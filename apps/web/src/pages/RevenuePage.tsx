import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listBudgets, getBudget, createRevenueDriver, updateRevenueDriver,
  seedDemoData,
  type Budget, type RevenueDriver,
} from '../api';
import { formatCurrency } from '../utils/format';
import { useDemoStatus } from '../context/DemoStatusContext';
import { useNavigation } from '../context/NavigationContext';

const REVENUE_DRIVERS_ANCHOR = 'revenue-drivers';

/** Minimal driver-like shape for skeleton (no budget) so computeRevenue works. */
type SkeletonDriver = Pick<RevenueDriver, 'yksikkohinta' | 'myytyMaara' | 'perusmaksu' | 'liittymamaara' | 'alvProsentti'>;

const DEFAULT_SKELETON: SkeletonDriver = {
  yksikkohinta: '0', myytyMaara: '0', perusmaksu: '0', liittymamaara: 0, alvProsentti: '24',
};

export const RevenuePage: React.FC = () => {
  const { t } = useTranslation();
  const { navigateToTab } = useNavigation();
  const driversRef = useRef<HTMLDivElement>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [skeletonVesi, setSkeletonVesi] = useState<SkeletonDriver>(() => ({ ...DEFAULT_SKELETON }));
  const [skeletonJatevesi, setSkeletonJatevesi] = useState<SkeletonDriver>(() => ({ ...DEFAULT_SKELETON }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const demoStatus = useDemoStatus();
  const isDemoEnabled = demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled;

  // When navigated from BudgetPage "Muokkaa Tulot", scroll to drivers section
  useEffect(() => {
    try {
      if (sessionStorage.getItem('scrollToRevenueDrivers') === '1') {
        sessionStorage.removeItem('scrollToRevenueDrivers');
        requestAnimationFrame(() => {
          driversRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Load the most recent budget
  useEffect(() => {
    (async () => {
      try {
        const budgets = await listBudgets();
        if (budgets.length > 0) {
          const full = await getBudget(budgets[0].id);
          setBudget(full);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Get or create a driver for a service type
  const getDriver = (type: 'vesi' | 'jatevesi'): RevenueDriver | undefined => {
    return budget?.tuloajurit?.find((d) => d.palvelutyyppi === type);
  };

  // Auto-save with debounce
  const autoSave = useCallback(async (driverId: string | undefined, budgetId: string, palvelutyyppi: string, updates: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        if (driverId) {
          await updateRevenueDriver(budgetId, driverId, updates);
        } else {
          await createRevenueDriver(budgetId, { palvelutyyppi, yksikkohinta: 0, myytyMaara: 0, ...updates });
        }
        // Reload full budget to sync state
        const full = await getBudget(budgetId);
        setBudget(full);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    }, 600);
  }, []);

  // Handle field changes (skeleton when no budget; otherwise optimistic + autoSave)
  const handleChange = (type: 'vesi' | 'jatevesi', field: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    const strVal = field === 'liittymamaara' ? String(Math.max(0, Math.round(numVal))) : String(numVal);

    if (!budget) {
      if (type === 'vesi') setSkeletonVesi((s) => ({ ...s, [field]: strVal }));
      else setSkeletonJatevesi((s) => ({ ...s, [field]: strVal }));
      return;
    }

    const driver = getDriver(type);
    setBudget((prev) => {
      if (!prev) return prev;
      const newDrivers = [...(prev.tuloajurit ?? [])];
      const idx = newDrivers.findIndex((d) => d.palvelutyyppi === type);
      if (idx >= 0) {
        newDrivers[idx] = { ...newDrivers[idx], [field]: strVal };
      } else {
        newDrivers.push({
          id: `temp-${type}`, talousarvioId: prev.id, palvelutyyppi: type,
          yksikkohinta: '0', myytyMaara: '0', perusmaksu: null, liittymamaara: null,
          alvProsentti: '24', muistiinpanot: null, createdAt: '', updatedAt: '',
          [field]: strVal,
        } as RevenueDriver);
      }
      return { ...prev, tuloajurit: newDrivers };
    });
    autoSave(driver?.id, budget.id, type, { [field]: field === 'liittymamaara' ? Math.max(0, Math.round(numVal)) : numVal });
  };

  // Compute revenue for a driver
  const computeRevenue = (d: RevenueDriver | undefined) => {
    if (!d) return { usage: 0, baseFee: 0, total: 0 };
    const usage = parseFloat(d.yksikkohinta) * parseFloat(d.myytyMaara);
    const baseFee = d.perusmaksu && d.liittymamaara ? parseFloat(d.perusmaksu) * d.liittymamaara : 0;
    return { usage, baseFee, total: usage + baseFee };
  };

  if (loading) return <div className="revenue-page"><p>{t('common.loading')}</p></div>;

  const handleLoadDemoData = async () => {
    setSeedingDemo(true);
    setError(null);
    try {
      await seedDemoData();
      const budgets = await listBudgets();
      if (budgets.length > 0) {
        const full = await getBudget(budgets[0].id);
        setBudget(full);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo data');
    } finally {
      setSeedingDemo(false);
    }
  };

  // When no budget: use skeleton drivers (local state, 0 defaults); full form still renders
  const waterDriver = budget ? getDriver('vesi') : (skeletonVesi as RevenueDriver);
  const wastewaterDriver = budget ? getDriver('jatevesi') : (skeletonJatevesi as RevenueDriver);
  const waterRev = computeRevenue(waterDriver);
  const wastewaterRev = computeRevenue(wastewaterDriver);
  const totalExclVat = waterRev.total + wastewaterRev.total;
  const vatRate = parseFloat(waterDriver?.alvProsentti ?? '24') || 24;
  const totalInclVat = totalExclVat * (1 + vatRate / 100);
  const noBudget = !budget;

  const renderDriverSection = (
    type: 'vesi' | 'jatevesi',
    titleKey: string,
    driver: RevenueDriver | undefined,
    rev: { usage: number; baseFee: number; total: number },
  ) => (
    <div className="driver-section">
      <h3>{t(titleKey)}</h3>
      <div className="driver-grid">
        <label>{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.unitPrice`)}</label>
        <div className="input-with-unit">
          <input type="number" step="0.01" min="0"
            value={driver ? parseFloat(driver.yksikkohinta) || '' : ''}
            onChange={(e) => handleChange(type, 'yksikkohinta', e.target.value)}
            className="input-field"
          />
          <span className="unit">{t('revenue.water.unitPriceUnit')}</span>
        </div>

        <label>{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.soldVolume`)}</label>
        <div className="input-with-unit">
          <input type="number" step="1" min="0"
            value={driver ? parseFloat(driver.myytyMaara) || '' : ''}
            onChange={(e) => handleChange(type, 'myytyMaara', e.target.value)}
            className="input-field"
          />
          <span className="unit">{t('revenue.water.soldVolumeUnit')}</span>
        </div>

        <label className="computed-label">{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.revenue`)}</label>
        <div className="computed-value">{formatCurrency(rev.usage)}</div>

        <label>{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.baseFee`)}</label>
        <div className="input-with-unit">
          <input type="number" step="0.01" min="0"
            value={driver?.perusmaksu ? parseFloat(driver.perusmaksu) || '' : ''}
            onChange={(e) => handleChange(type, 'perusmaksu', e.target.value)}
            className="input-field"
          />
          <span className="unit">{t('revenue.water.baseFeeUnit')}</span>
        </div>

        <label>{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.connections`)}</label>
        <div className="input-with-unit">
          <input type="number" step="1" min="0"
            value={driver?.liittymamaara ?? ''}
            onChange={(e) => handleChange(type, 'liittymamaara', e.target.value)}
            className="input-field"
          />
          <span className="unit">kpl</span>
        </div>

        {rev.baseFee > 0 && (
          <>
            <label className="computed-label">{t(`revenue.${type === 'vesi' ? 'water' : 'wastewater'}.baseFeeRevenue`)}</label>
            <div className="computed-value">{formatCurrency(rev.baseFee)}</div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="revenue-page">
      {error && (
        <div className="error-banner"><span>⚠ {error}</span><button className="btn btn-small" onClick={() => setError(null)}>{t('common.close')}</button></div>
      )}
      <div className="page-header">
        <h2>{t('revenue.title')}</h2>
        {!noBudget && saving && <span className="saving-indicator">{t('common.loading')}</span>}
        {noBudget && (
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
        )}
      </div>
      {noBudget && <p className="skeleton-hint">{t('revenue.noBudgetHint')}</p>}
      <p className="formula-hint">{t('revenue.formula')}</p>

      <div ref={driversRef} id={REVENUE_DRIVERS_ANCHOR}>
        {renderDriverSection('vesi', 'revenue.water.title', waterDriver, waterRev)}
        {renderDriverSection('jatevesi', 'revenue.wastewater.title', wastewaterDriver, wastewaterRev)}
      </div>

      <div className="revenue-vat-section">
        <label>{t('revenue.vat')}</label>
        <div className="input-with-unit">
          <input type="number" step="0.1" min="0" max="100"
            value={vatRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              if (waterDriver) handleChange('vesi', 'alvProsentti', String(val));
              if (wastewaterDriver) handleChange('jatevesi', 'alvProsentti', String(val));
            }}
            className="input-field input-sm-num"
          />
          <span className="unit">% ({t('revenue.vatEditable')})</span>
        </div>
      </div>

      <div className="revenue-totals">
        <div className="total-row">
          <span>{t('revenue.totalRevenue')} ({t('revenue.totalRevenueExclVat')})</span>
          <strong>{formatCurrency(totalExclVat)}</strong>
        </div>
        <div className="total-row total-row-big">
          <span>{t('revenue.totalRevenue')} ({t('revenue.totalRevenueInclVat')})</span>
          <strong>{formatCurrency(totalInclVat)}</strong>
        </div>
      </div>
    </div>
  );
};
