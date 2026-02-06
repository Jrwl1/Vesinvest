import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listBudgets, getBudget, createRevenueDriver, updateRevenueDriver,
  type Budget, type RevenueDriver,
} from '../api';
import { formatCurrency } from '../utils/format';

export const RevenuePage: React.FC = () => {
  const { t } = useTranslation();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Handle field changes
  const handleChange = (type: 'vesi' | 'jatevesi', field: string, value: string) => {
    if (!budget) return;
    const numVal = parseFloat(value) || 0;
    const driver = getDriver(type);

    // Optimistic update in local state
    setBudget((prev) => {
      if (!prev) return prev;
      const newDrivers = [...(prev.tuloajurit ?? [])];
      const idx = newDrivers.findIndex((d) => d.palvelutyyppi === type);
      if (idx >= 0) {
        newDrivers[idx] = { ...newDrivers[idx], [field]: String(numVal) };
      } else {
        // Create placeholder
        newDrivers.push({
          id: `temp-${type}`, talousarvioId: prev.id, palvelutyyppi: type,
          yksikkohinta: '0', myytyMaara: '0', perusmaksu: null, liittymamaara: null,
          alvProsentti: '24', muistiinpanot: null, createdAt: '', updatedAt: '',
          [field]: String(numVal),
        } as RevenueDriver);
      }
      return { ...prev, tuloajurit: newDrivers };
    });

    autoSave(driver?.id, budget.id, type, { [field]: numVal });
  };

  // Compute revenue for a driver
  const computeRevenue = (d: RevenueDriver | undefined) => {
    if (!d) return { usage: 0, baseFee: 0, total: 0 };
    const usage = parseFloat(d.yksikkohinta) * parseFloat(d.myytyMaara);
    const baseFee = d.perusmaksu && d.liittymamaara ? parseFloat(d.perusmaksu) * d.liittymamaara : 0;
    return { usage, baseFee, total: usage + baseFee };
  };

  if (loading) return <div className="revenue-page"><p>{t('common.loading')}</p></div>;

  if (!budget) {
    return (
      <div className="revenue-page">
        <div className="page-header"><h2>{t('revenue.title')}</h2></div>
        <div className="empty-state">
          <div className="empty-icon">💧</div>
          <h3>{t('revenue.noDrivers')}</h3>
          <p>{t('revenue.noDriversHint')}</p>
        </div>
      </div>
    );
  }

  const waterDriver = getDriver('vesi');
  const wastewaterDriver = getDriver('jatevesi');
  const waterRev = computeRevenue(waterDriver);
  const wastewaterRev = computeRevenue(wastewaterDriver);
  const totalExclVat = waterRev.total + wastewaterRev.total;
  const vatRate = parseFloat(waterDriver?.alvProsentti ?? '24') || 24;
  const totalInclVat = totalExclVat * (1 + vatRate / 100);

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
        {saving && <span className="saving-indicator">{t('common.loading')}</span>}
      </div>
      <p className="formula-hint">{t('revenue.formula')}</p>

      {renderDriverSection('vesi', 'revenue.water.title', waterDriver, waterRev)}
      {renderDriverSection('jatevesi', 'revenue.wastewater.title', wastewaterDriver, wastewaterRev)}

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
