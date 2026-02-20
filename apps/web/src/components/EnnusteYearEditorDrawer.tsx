import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ProjectionYearOverride,
  ProjectionYearLineOverride,
  YearOverrideLockMode,
} from '../api';

type CategoryKey = 'personnel' | 'energy' | 'opexOther' | 'otherIncome' | 'investments';

export interface YearEditorState {
  year: number;
  computedWaterPrice: number;
  computedGrowthPct: number | null;
  override: ProjectionYearOverride;
  lineKeys: string[];
}

interface EnnusteYearEditorDrawerProps {
  open: boolean;
  saving: boolean;
  state: YearEditorState | null;
  onClose: () => void;
  onClearYear: () => void;
  onSave: () => void;
  onSetWaterPrice: (value: number) => void;
  onSetGrowthPct: (value: number) => void;
  onSetLockMode: (mode: YearOverrideLockMode) => void;
  onSetInvestment: (value: number) => void;
  onSetCategoryGrowth: (category: CategoryKey, value: number | undefined) => void;
  onSetLineOverride: (lineKey: string, lineOverride: ProjectionYearLineOverride | undefined) => void;
}

const parseNumber = (raw: string): number | undefined => {
  const normalized = raw.replace(',', '.').trim();
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
};

const NumberInput: React.FC<{
  value?: number;
  step?: string;
  suffix?: string;
  onChange: (value: number | undefined) => void;
}> = ({ value, step = '0.1', suffix, onChange }) => (
  <label className="ev2-year-editor__number">
    <input
      type="text"
      inputMode="decimal"
      value={value == null || !Number.isFinite(value) ? '' : String(value)}
      onChange={(e) => onChange(parseNumber(e.target.value))}
      step={step}
    />
    {suffix && <span>{suffix}</span>}
  </label>
);

export const EnnusteYearEditorDrawer: React.FC<EnnusteYearEditorDrawerProps> = ({
  open,
  saving,
  state,
  onClose,
  onClearYear,
  onSave,
  onSetWaterPrice,
  onSetGrowthPct,
  onSetLockMode,
  onSetInvestment,
  onSetCategoryGrowth,
  onSetLineOverride,
}) => {
  const { t } = useTranslation();
  if (!open || !state) return null;

  const categoryLabels: Array<{ key: CategoryKey; label: string }> = [
    { key: 'personnel', label: t('projection.v2.categoryPersonnel', 'Personnel cost growth %') },
    { key: 'energy', label: t('projection.v2.categoryEnergy', 'Energy cost growth %') },
    { key: 'opexOther', label: t('projection.v2.categoryOpexOther', 'Other operating cost growth %') },
    { key: 'otherIncome', label: t('projection.v2.categoryOtherIncome', 'Other income growth %') },
    { key: 'investments', label: t('projection.v2.categoryInvestments', 'Investment growth %') },
  ];

  return (
    <aside className="ev2-year-editor" aria-label={t('projection.v2.yearEditorTitle', 'Year editor')}>
      <div className="ev2-year-editor__header">
        <h3>{t('projection.v2.selectedYear', 'Selected year')}: {state.year}</h3>
        <button type="button" className="ev2-btn ev2-btn--ghost" onClick={onClose}>
          {t('common.close', 'Close')}
        </button>
      </div>

      <section className="ev2-year-editor__section">
        <h4>{t('projection.v2.waterPriceCardTitle', 'Water price controls')}</h4>
        <div className="ev2-year-editor__rows">
          <div className="ev2-year-editor__row">
            <span>{t('projection.columns.waterPrice', 'Water price')}</span>
            <NumberInput
              value={state.override.waterPriceEurM3 ?? state.computedWaterPrice}
              step="0.01"
              suffix="€/m³"
              onChange={(value) => onSetWaterPrice(value ?? 0)}
            />
          </div>
          <div className="ev2-year-editor__row">
            <span>{t('projection.v2.waterPriceGrowth', 'Price increase')}</span>
            <NumberInput
              value={state.override.waterPriceGrowthPct ?? state.computedGrowthPct ?? 0}
              step="0.1"
              suffix="%"
              onChange={(value) => onSetGrowthPct(value ?? 0)}
            />
          </div>
          <div className="ev2-year-editor__lock">
            <button
              type="button"
              className={`ev2-btn ${state.override.lockMode === 'price' ? 'ev2-btn--primary' : ''}`}
              onClick={() => onSetLockMode('price')}
            >
              {t('projection.v2.lockPrice', 'Lock €/m³')}
            </button>
            <button
              type="button"
              className={`ev2-btn ${state.override.lockMode === 'percent' ? 'ev2-btn--primary' : ''}`}
              onClick={() => onSetLockMode('percent')}
            >
              {t('projection.v2.lockPercent', 'Lock %')}
            </button>
          </div>
        </div>
      </section>

      <section className="ev2-year-editor__section">
        <h4>{t('projection.v2.investmentCardTitle', 'Investment')}</h4>
        <div className="ev2-year-editor__row">
          <span>{t('projection.v2.investmentYearAmount', 'Planned investment')}</span>
          <NumberInput
            value={state.override.investmentEur}
            step="1000"
            suffix="€"
            onChange={(value) => onSetInvestment(value ?? 0)}
          />
        </div>
      </section>

      <section className="ev2-year-editor__section">
        <h4>{t('projection.v2.categoryCardTitle', 'Category overrides')}</h4>
        <p className="ev2-input-hint">{t('projection.v2.personnelManualHint')}</p>
        {categoryLabels.map(({ key, label }) => (
          <div key={key} className="ev2-year-editor__row">
            <span>{label}</span>
            <NumberInput
              value={state.override.categoryGrowthPct?.[key]}
              step="0.1"
              suffix="%"
              onChange={(value) => onSetCategoryGrowth(key, value)}
            />
          </div>
        ))}
      </section>

      <details className="ev2-year-editor__section">
        <summary>{t('projection.v2.lineOverrideTitle', 'Line-level overrides (advanced)')}</summary>
        {state.lineKeys.length === 0 ? (
          <p className="ev2-input-hint">{t('projection.v2.lineOverrideEmpty', 'No rows available for selected year.')}</p>
        ) : (
          <div className="ev2-year-editor__line-grid">
            {state.lineKeys.map((lineKey) => {
              const current = state.override.lineOverrides?.[lineKey];
              return (
                <div key={lineKey} className="ev2-year-editor__line-row">
                  <span>{lineKey}</span>
                  <select
                    className="ev2-select"
                    value={current?.mode ?? 'percent'}
                    onChange={(e) => {
                      const mode = e.target.value as ProjectionYearLineOverride['mode'];
                      onSetLineOverride(lineKey, { mode, value: current?.value ?? 0 });
                    }}
                  >
                    <option value="percent">%</option>
                    <option value="absolute">€</option>
                  </select>
                  <NumberInput
                    value={current?.value}
                    step="0.1"
                    onChange={(value) => {
                      if (value == null) {
                        onSetLineOverride(lineKey, undefined);
                        return;
                      }
                      onSetLineOverride(lineKey, { mode: current?.mode ?? 'percent', value });
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </details>

      <div className="ev2-year-editor__footer">
        <button type="button" className="ev2-btn" onClick={onClearYear}>
          {t('projection.v2.clearYearOverrides', 'Clear year overrides')}
        </button>
        <button type="button" className="ev2-btn ev2-btn--primary" onClick={onSave} disabled={saving}>
          {saving ? t('common.loading', 'Saving...') : t('common.save', 'Save')}
        </button>
      </div>
    </aside>
  );
};
