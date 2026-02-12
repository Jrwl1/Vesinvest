import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DriverPaths, DriverType, DriverField, DriverValuePlan } from '../api';

export type BaseValueMap = Record<DriverType, Record<DriverField, number | null>>;

interface DriverPlannerProps {
  years: number[];
  baseValues: BaseValueMap;
  value: DriverPaths | undefined;
  onChange: (next: DriverPaths | undefined) => void;
}

const SERVICE_SPECS: Array<{ key: DriverType; titleKey: string }> = [
  { key: 'vesi', titleKey: 'projection.driverPlanner.water' },
  { key: 'jatevesi', titleKey: 'projection.driverPlanner.wastewater' },
];

const FIELD_SPECS: Record<DriverField, { titleKey: string; unit: string; decimals: number }> = {
  yksikkohinta: { titleKey: 'projection.driverPlanner.unitPrice', unit: '€/m³', decimals: 2 },
  myytyMaara: { titleKey: 'projection.driverPlanner.volume', unit: 'm³', decimals: 0 },
};

export const DriverPlanner: React.FC<DriverPlannerProps> = ({ years, baseValues, value, onChange }) => {
  const { t } = useTranslation();

  const updatePaths = (
    type: DriverType,
    field: DriverField,
    updater: (prev: DriverValuePlan | undefined) => DriverValuePlan | undefined,
  ) => {
    const next: DriverPaths = { ...(value ?? {}) };
    const currentService = { ...(next[type] ?? {}) };
    const updatedPlan = updater(currentService[field]);

    if (updatedPlan) {
      currentService[field] = updatedPlan;
      next[type] = currentService;
    } else {
      delete currentService[field];
      if (Object.keys(currentService).length === 0) {
        delete next[type];
      } else {
        next[type] = currentService;
      }
    }

    onChange(Object.keys(next).length === 0 ? undefined : next);
  };

  const getPlan = (type: DriverType, field: DriverField): DriverValuePlan | undefined =>
    value?.[type]?.[field];

  const clearPlan = (type: DriverType, field: DriverField) => {
    updatePaths(type, field, () => undefined);
  };

  const handleManualInput = (type: DriverType, field: DriverField, year: number, raw: string) => {
    updatePaths(type, field, (prev) => {
      const plan: DriverValuePlan = prev?.mode === 'manual'
        ? { ...prev, values: { ...(prev.values ?? {}) } }
        : { mode: 'manual', values: {} };
      const parsed = parseNumber(raw);
      if (parsed === undefined) {
        if (plan.values) delete plan.values[year];
      } else {
        plan.values = { ...(plan.values ?? {}) };
        plan.values[year] = parsed;
      }
      if (!plan.values || Object.keys(plan.values).length === 0) {
        return undefined;
      }
      return plan;
    });
  };

  const handleModeChange = (type: DriverType, field: DriverField, mode: 'manual' | 'percent') => {
    if (mode === 'manual') {
      updatePaths(type, field, (prev) => {
        if (prev?.mode === 'manual') return prev;
        const values = prev?.mode === 'percent'
          ? buildSeriesFromPercent(prev, years, baseValues[type][field])
          : undefined;
        return values && Object.keys(values).length > 0
          ? { mode: 'manual', values }
          : undefined;
      });
    } else {
      updatePaths(type, field, (prev) => {
        if (prev?.mode === 'percent') return prev;
        const baseYear = years[0];
        const baseValue =
          (prev?.values && prev.values[baseYear])
          ?? baseValues[type][field]
          ?? null;
        if (baseValue == null) {
          return {
            mode: 'percent',
            baseYear,
            annualPercent: 0,
          };
        }
        return {
          mode: 'percent',
          baseYear,
          baseValue,
          annualPercent: 0,
        };
      });
    }
  };

  const handleBaseYearChange = (type: DriverType, field: DriverField, baseYear: number) => {
    updatePaths(type, field, (prev) => {
      const plan: DriverValuePlan = prev?.mode === 'percent'
        ? { ...prev }
        : { mode: 'percent', annualPercent: 0 };
      plan.baseYear = baseYear;
      if (plan.baseValue == null) {
        const auto = plan.values?.[baseYear] ?? baseValues[type][field];
        if (auto != null) plan.baseValue = auto;
      }
      return plan;
    });
  };

  const handleBaseValueChange = (type: DriverType, field: DriverField, raw: string) => {
    updatePaths(type, field, (prev) => {
      const plan: DriverValuePlan = prev?.mode === 'percent'
        ? { ...prev }
        : { mode: 'percent', annualPercent: 0 };
      const parsed = parseNumber(raw);
      plan.baseValue = parsed ?? undefined;
      return plan;
    });
  };

  const handlePercentChange = (type: DriverType, field: DriverField, raw: string) => {
    updatePaths(type, field, (prev) => {
      const plan: DriverValuePlan = prev?.mode === 'percent'
        ? { ...prev }
        : { mode: 'percent', baseYear: years[0] };
      const parsed = parseNumber(raw);
      plan.annualPercent = parsed !== undefined ? parsed / 100 : undefined;
      return plan;
    });
  };

  const getDisplayValue = (type: DriverType, field: DriverField, year: number): number | null => {
    const plan = value?.[type]?.[field];
    if (!plan) return null;
    if (plan.mode === 'manual') {
      return plan.values?.[year] ?? null;
    }
    if (plan.mode === 'percent') {
      return computePercentValue(plan, year, baseValues[type][field]);
    }
    return null;
  };

  return (
    <div className="driver-planner">
      <div className="driver-planner__intro">
        <h3>{t('projection.driverPlanner.title')}</h3>
        <p>{t('projection.driverPlanner.description')}</p>
      </div>
      <div className="driver-planner__grid">
        {SERVICE_SPECS.map((service) => (
          <section
            key={service.key}
            className={`driver-planner__service driver-planner__service--${service.key}`}
            aria-labelledby={`driver-heading-${service.key}`}
          >
            <div className="driver-card">
              <h4 id={`driver-heading-${service.key}`}>{t(service.titleKey)}</h4>
            {(Object.keys(FIELD_SPECS) as DriverField[]).map((field) => {
              const plan = getPlan(service.key, field);
              const mode = plan?.mode ?? 'manual';
              const fieldMeta = FIELD_SPECS[field];
              return (
                <div key={`${service.key}-${field}`} className="driver-field-block">
                  <div className="driver-field-header">
                    <div>
                      <strong>{t(fieldMeta.titleKey)}</strong>
                      <span className="driver-field-unit">{fieldMeta.unit}</span>
                    </div>
                    <div className="driver-mode-toggle">
                      <button
                        type="button"
                        className={mode === 'manual' ? 'active' : ''}
                        onClick={() => handleModeChange(service.key, field, 'manual')}
                      >
                        {t('projection.driverPlanner.modeManual')}
                      </button>
                      <button
                        type="button"
                        className={mode === 'percent' ? 'active' : ''}
                        onClick={() => handleModeChange(service.key, field, 'percent')}
                      >
                        {t('projection.driverPlanner.modePercent')}
                      </button>
                    </div>
                  </div>

                  {mode === 'manual' ? (
                    <table className="driver-table">
                      <thead>
                        <tr>
                          <th>{t('projection.driverPlanner.year')}</th>
                          <th>{t('projection.driverPlanner.value')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {years.map((year) => (
                          <tr key={year}>
                            <td>{year}</td>
                            <td>
                              <input
                                type="number"
                                step={field === 'yksikkohinta' ? '0.01' : '1'}
                                value={plan?.values?.[year] ?? ''}
                                onChange={(e) => handleManualInput(service.key, field, year, e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="driver-percent-form">
                      <label>
                        {t('projection.driverPlanner.baseYear')}
                        <select
                          value={plan?.baseYear ?? years[0]}
                          onChange={(e) => handleBaseYearChange(service.key, field, Number(e.target.value))}
                        >
                          {years.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        {t('projection.driverPlanner.baseValue')}
                        <input
                          type="number"
                          step={field === 'yksikkohinta' ? '0.01' : '1'}
                          value={plan?.baseValue ?? ''}
                          onChange={(e) => handleBaseValueChange(service.key, field, e.target.value)}
                        />
                      </label>
                      <label>
                        {t('projection.driverPlanner.annualChange')}
                        <div className="percent-input">
                          <input
                            type="number"
                            step="0.1"
                            value={
                              plan?.annualPercent !== undefined
                                ? (plan.annualPercent * 100).toString()
                                : ''
                            }
                            onChange={(e) => handlePercentChange(service.key, field, e.target.value)}
                          />
                          <span>%</span>
                        </div>
                      </label>
                      <div className="driver-percent-preview">
                        <table className="driver-table">
                          <thead>
                            <tr>
                              <th>{t('projection.driverPlanner.year')}</th>
                              <th>{t('projection.driverPlanner.value')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {years.map((year) => (
                              <tr key={year}>
                                <td>{year}</td>
                                <td>{formatNumber(getDisplayValue(service.key, field, year), FIELD_SPECS[field].decimals)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="driver-field-actions">
                    <button type="button" className="btn-link" onClick={() => clearPlan(service.key, field)}>
                      {t('projection.driverPlanner.clear')}
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

function parseNumber(raw: string): number | undefined {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return undefined;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function computePercentValue(plan: DriverValuePlan, year: number, fallbackBase: number | null): number | null {
  if (plan.mode !== 'percent') return null;
  const pct = plan.annualPercent ?? 0;
  const baseYear = plan.baseYear ?? year;
  const baseValue = plan.baseValue ?? plan.values?.[baseYear] ?? fallbackBase;
  if (baseValue == null) return null;
  const diff = year - baseYear;
  const computed = baseValue * Math.pow(1 + pct, diff);
  if (!Number.isFinite(computed)) return null;
  return round(computed, 2);
}

function buildSeriesFromPercent(
  plan: DriverValuePlan | undefined,
  years: number[],
  fallbackBase: number | null,
): Record<number, number> | undefined {
  if (!plan || plan.mode !== 'percent') return undefined;
  const out: Record<number, number> = {};
  years.forEach((year) => {
    const val = computePercentValue(plan, year, fallbackBase);
    if (val != null) out[year] = val;
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function formatNumber(value: number | null, decimals: number): string {
  if (value == null) return '—';
  return value.toLocaleString('fi-FI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
