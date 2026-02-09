import React from 'react';
import type { Budget, RevenueDriver } from '../api';

/** Parse locale-friendly number (comma or dot decimal). Returns null if invalid or negative. */
function parseDriverNumber(raw: string): number | null {
  const s = raw.replace(/\s/g, '').replace(',', '.');
  if (s === '') return 0;
  const n = parseFloat(s);
  return typeof n === 'number' && !isNaN(n) && n >= 0 ? n : null;
}

const DriverNumericInput: React.FC<{
  value: number | string | null | undefined;
  onChange: (n: number) => void;
  onBlurSave: (n: number) => void;
  error: string | null;
  setError: (s: string | null) => void;
  readOnly?: boolean;
  integer?: boolean;
}> = ({ value, onChange, onBlurSave, error, setError, readOnly, integer }) => {
  const numVal = value !== undefined && value !== null && value !== ''
    ? (typeof value === 'number' ? value : parseFloat(String(value)))
    : null;
  const displayVal = numVal !== null && !isNaN(numVal) ? numVal : null;
  const [raw, setRaw] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const showPlaceholder = !focused && (displayVal === null || (displayVal === 0 && raw === ''));
  return (
    <span className="driver-field-wrap">
      <input
        type="text"
        inputMode="decimal"
        className={`driver-input num ${error ? 'input-error' : ''}`}
        value={focused ? raw : (displayVal !== null ? (integer ? String(Math.round(displayVal)) : String(displayVal)) : '')}
        placeholder={showPlaceholder ? '–' : undefined}
        readOnly={readOnly}
        onFocus={() => {
          setRaw(displayVal !== null ? String(displayVal) : '');
          setFocused(true);
          setError(null);
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseDriverNumber(raw);
          if (parsed !== null) {
            const final = integer ? Math.max(0, Math.round(parsed)) : parsed;
            onChange(final);
            onBlurSave(final);
          } else if (raw.trim() !== '') {
            setError('Numero ≥ 0');
          }
        }}
        onChange={(e) => {
          setRaw(e.target.value);
          const parsed = parseDriverNumber(e.target.value);
          if (parsed !== null) onChange(integer ? Math.max(0, Math.round(parsed)) : parsed);
        }}
      />
      {error && <span className="driver-field-error">{error}</span>}
    </span>
  );
};

export interface RevenueDriversPanelProps {
  budget: Budget | null;
  savingDriverType: 'vesi' | 'jatevesi' | null;
  driverFieldErrors: Record<string, string>;
  updateDriverField: (type: 'vesi' | 'jatevesi', field: keyof Pick<RevenueDriver, 'yksikkohinta' | 'myytyMaara' | 'perusmaksu' | 'liittymamaara'>, value: number) => void;
  saveDriver: (type: 'vesi' | 'jatevesi') => void;
  setDriverFieldErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  t: (key: string, fallback?: string) => string;
}

/**
 * Tuloajurit panel shown in Tulot section. Must reflect activeBudget.tuloajurit:
 * - If drivers exist for vesi/jatevesi, inputs show those values (not '-' unless actually empty).
 * - If drivers are missing, show '-' and warning/missing-fields state.
 */
export const RevenueDriversPanel: React.FC<RevenueDriversPanelProps> = ({
  budget,
  savingDriverType,
  driverFieldErrors,
  updateDriverField,
  saveDriver,
  setDriverFieldErrors,
  t,
}) => {
  if (!budget) return null;
  return (
    <div className="tuloajurit-panel">
      <h4 className="tuloajurit-panel-title">{t('budget.tuloajuritTitle', 'Tuloajurit')}</h4>
      <div className="tuloajurit-cards">
        {(['vesi', 'jatevesi'] as const).map((palvelutyyppi) => {
          const driver = budget.tuloajurit?.find((d) => d.palvelutyyppi === palvelutyyppi);
          const label = palvelutyyppi === 'vesi' ? t('revenue.water.title') : t('revenue.wastewater.title');
          const saving = savingDriverType === palvelutyyppi;
          const readOnly = !budget;
          return (
            <div key={palvelutyyppi} className="tuloajurit-card">
              <div className="tuloajurit-card-header">{label}{saving ? ` (${t('common.loading')})` : ''}</div>
              <div className="tuloajurit-card-fields">
                <div className="tuloajurit-field">
                  <label>{t('revenue.water.unitPrice')} (€/m³)</label>
                  <DriverNumericInput
                    value={driver?.yksikkohinta}
                    onChange={(n) => updateDriverField(palvelutyyppi, 'yksikkohinta', n)}
                    onBlurSave={() => saveDriver(palvelutyyppi)}
                    error={driverFieldErrors[`${palvelutyyppi}.yksikkohinta`] || null}
                    setError={(s) => setDriverFieldErrors((prev) => ({ ...prev, [`${palvelutyyppi}.yksikkohinta`]: s ?? '' }))}
                    readOnly={readOnly}
                  />
                </div>
                <div className="tuloajurit-field">
                  <label>{t('revenue.water.soldVolume')} (m³/a)</label>
                  <DriverNumericInput
                    value={driver?.myytyMaara}
                    onChange={(n) => updateDriverField(palvelutyyppi, 'myytyMaara', n)}
                    onBlurSave={() => saveDriver(palvelutyyppi)}
                    error={driverFieldErrors[`${palvelutyyppi}.myytyMaara`] || null}
                    setError={(s) => setDriverFieldErrors((prev) => ({ ...prev, [`${palvelutyyppi}.myytyMaara`]: s ?? '' }))}
                    readOnly={readOnly}
                  />
                </div>
                <div className="tuloajurit-field">
                  <label>{t('revenue.water.connections')}</label>
                  <DriverNumericInput
                    value={driver?.liittymamaara}
                    onChange={(n) => updateDriverField(palvelutyyppi, 'liittymamaara', n)}
                    onBlurSave={() => saveDriver(palvelutyyppi)}
                    error={driverFieldErrors[`${palvelutyyppi}.liittymamaara`] || null}
                    setError={(s) => setDriverFieldErrors((prev) => ({ ...prev, [`${palvelutyyppi}.liittymamaara`]: s ?? '' }))}
                    readOnly={readOnly}
                    integer
                  />
                </div>
                <div className="tuloajurit-field">
                  <label>{t('revenue.water.baseFee')} (€)</label>
                  <DriverNumericInput
                    value={driver?.perusmaksu}
                    onChange={(n) => updateDriverField(palvelutyyppi, 'perusmaksu', n)}
                    onBlurSave={() => saveDriver(palvelutyyppi)}
                    error={driverFieldErrors[`${palvelutyyppi}.perusmaksu`] || null}
                    setError={(s) => setDriverFieldErrors((prev) => ({ ...prev, [`${palvelutyyppi}.perusmaksu`]: s ?? '' }))}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
