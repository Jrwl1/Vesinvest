import React from 'react';
import type { TFunction } from 'i18next';

import type { V2YearlyInvestmentPlanRow } from '../api';
import { MAX_YEARLY_INVESTMENT_EUR, resolveInvestmentProgramTotal } from './forecastModel';

type InvestmentRow = V2YearlyInvestmentPlanRow;

type DepreciationClassOption = {
  key: string;
  label: string;
};

type RenderInvestmentProgramRowsParams = {
  rows: InvestmentRow[];
  t: TFunction;
  handleInvestmentMetadataChange: (
    rowKey: string,
    field:
      | 'target'
      | 'category'
      | 'depreciationClassKey'
      | 'investmentType'
      | 'confidence'
      | 'note',
    value: string,
  ) => void;
  handleInvestmentProgramAmountChange: (
    rowKey: string,
    field: 'waterAmount' | 'wastewaterAmount',
    value: string,
  ) => void;
  handleInvestmentChange: (rowKey: string, value: string) => void;
  handleInvestmentBlur: (rowKey: string) => void;
  loadingDepreciation: boolean;
  depreciationRulesUnavailable: boolean;
  effectiveInvestmentDepreciationClassByYear: Record<number, string | null>;
  depreciationClassOptions: DepreciationClassOption[];
  formatDepreciationRuleSummary: (ruleKey: string | null | undefined) => string | null;
};

export function renderForecastInvestmentProgramRows({
  rows,
  t,
  handleInvestmentMetadataChange,
  handleInvestmentProgramAmountChange,
  handleInvestmentChange,
  handleInvestmentBlur,
  loadingDepreciation,
  depreciationRulesUnavailable,
  effectiveInvestmentDepreciationClassByYear,
  depreciationClassOptions,
  formatDepreciationRuleSummary,
}: RenderInvestmentProgramRowsParams): React.ReactNode {
  return rows.map((row) => (
    <div
      key={`program-${row.rowId ?? row.year}`}
      className="v2-investment-program-row"
    >
      <strong className="v2-investment-year-pill">{row.year}</strong>
      <input
        className="v2-input"
        type="text"
        name={`investmentProgramTarget-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramTargetLabel', 'Target')} ${row.year}`}
        placeholder={t('v2Forecast.investmentProgramTargetLabel', 'Target')}
        value={row.target ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'target',
            event.target.value,
          )
        }
      />
      <select
        className="v2-input"
        name={`investmentProgramType-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramTypeLabel', 'Type')} ${row.year}`}
        value={row.investmentType ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'investmentType',
            event.target.value,
          )
        }
      >
        <option value="">{t('v2Forecast.investmentProgramTypeLabel', 'Type')}</option>
        <option value="replacement">
          {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
        </option>
        <option value="new">{t('v2Forecast.investmentTypeNew', 'New')}</option>
      </select>
      <input
        className="v2-input"
        type="text"
        list="v2-investment-program-group-options"
        name={`investmentProgramGroup-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramGroupLabel', 'Group')} ${row.year}`}
        placeholder={t('v2Forecast.investmentProgramGroupLabel', 'Group')}
        value={row.category ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'category',
            event.target.value,
          )
        }
      />
      <div className="v2-investment-depreciation-cell">
        <select
          className="v2-input"
          name={`investmentProgramDepreciationClass-${row.year}`}
          aria-label={`${t('v2Forecast.depreciationCategory', 'Depreciation rule')} ${row.year}`}
          value={effectiveInvestmentDepreciationClassByYear[row.year] ?? ''}
          disabled={loadingDepreciation || depreciationRulesUnavailable}
          onChange={(event) =>
            handleInvestmentMetadataChange(
              row.rowId ?? String(row.year),
              'depreciationClassKey',
              event.target.value,
            )
          }
        >
          <option value="">{t('v2Forecast.unmapped', 'Unmapped')}</option>
          {depreciationClassOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="v2-muted">
          {depreciationRulesUnavailable
            ? t(
                'v2Forecast.depreciationRulesUnavailableShort',
                'Depreciation rules unavailable',
              )
            : formatDepreciationRuleSummary(
                effectiveInvestmentDepreciationClassByYear[row.year],
              )}
        </span>
      </div>
      <input
        className="v2-input"
        type="number"
        inputMode="numeric"
        name={`investmentProgramWater-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramWaterAmount', 'Water EUR')} ${row.year}`}
        placeholder={t('v2Forecast.investmentProgramWaterAmount', 'Water EUR')}
        step="1"
        min="0"
        max={MAX_YEARLY_INVESTMENT_EUR}
        value={row.waterAmount ?? ''}
        onChange={(event) =>
          handleInvestmentProgramAmountChange(
            row.rowId ?? String(row.year),
            'waterAmount',
            event.target.value,
          )
        }
        onFocus={(event) => event.currentTarget.select()}
      />
      <input
        className="v2-input"
        type="number"
        inputMode="numeric"
        name={`investmentProgramWastewater-${row.year}`}
        aria-label={`${t(
          'v2Forecast.investmentProgramWastewaterAmount',
          'Wastewater EUR',
        )} ${row.year}`}
        placeholder={t(
          'v2Forecast.investmentProgramWastewaterAmount',
          'Wastewater EUR',
        )}
        step="1"
        min="0"
        max={MAX_YEARLY_INVESTMENT_EUR}
        value={row.wastewaterAmount ?? ''}
        onChange={(event) =>
          handleInvestmentProgramAmountChange(
            row.rowId ?? String(row.year),
            'wastewaterAmount',
            event.target.value,
          )
        }
        onFocus={(event) => event.currentTarget.select()}
      />
      <input
        className="v2-input"
        type="number"
        inputMode="numeric"
        name={`investmentProgramTotal-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramTotalAmount', 'Total EUR')} ${row.year}`}
        placeholder={t('v2Forecast.investmentProgramTotalAmount', 'Total EUR')}
        step="1"
        min="0"
        max={MAX_YEARLY_INVESTMENT_EUR}
        value={resolveInvestmentProgramTotal(row)}
        onChange={(event) =>
          handleInvestmentChange(row.rowId ?? String(row.year), event.target.value)
        }
        onBlur={() => handleInvestmentBlur(row.rowId ?? String(row.year))}
        onFocus={(event) => event.currentTarget.select()}
      />
      <input
        className="v2-input"
        type="text"
        name={`investmentProgramNote-${row.year}`}
        aria-label={`${t('v2Forecast.investmentProgramNoteLabel', 'Note')} ${row.year}`}
        placeholder={t('v2Forecast.investmentProgramNoteLabel', 'Note')}
        value={row.note ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'note',
            event.target.value,
          )
        }
      />
    </div>
  ));
}

type RenderInvestmentEditorRowsParams = {
  rows: InvestmentRow[];
  t: TFunction;
  handleInvestmentChange: (rowKey: string, value: string) => void;
  handleInvestmentBlur: (rowKey: string) => void;
  handleInvestmentMetadataChange: (
    rowKey: string,
    field:
      | 'target'
      | 'category'
      | 'depreciationClassKey'
      | 'investmentType'
      | 'confidence'
      | 'note',
    value: string,
  ) => void;
};

export function renderForecastInvestmentEditorRows({
  rows,
  t,
  handleInvestmentChange,
  handleInvestmentBlur,
  handleInvestmentMetadataChange,
}: RenderInvestmentEditorRowsParams): React.ReactNode {
  return rows.map((row) => (
    <div key={row.rowId ?? row.year} className="v2-investment-row">
      <strong className="v2-investment-year-pill">{row.year}</strong>
      <input
        className="v2-input"
        type="number"
        inputMode="numeric"
        name={`yearlyInvestment-${row.year}`}
        aria-label={`${t('v2Forecast.yearlyInvestmentsEur', 'Yearly investments (EUR)')} ${row.year}`}
        step="1"
        min="0"
        max={MAX_YEARLY_INVESTMENT_EUR}
        value={row.amount}
        onChange={(event) =>
          handleInvestmentChange(row.rowId ?? String(row.year), event.target.value)
        }
        onBlur={() => handleInvestmentBlur(row.rowId ?? String(row.year))}
        onFocus={(event) => event.currentTarget.select()}
      />
      <input
        className="v2-input"
        type="text"
        name={`yearlyInvestmentCategory-${row.year}`}
        aria-label={`${t('v2Forecast.investmentCategoryPlaceholder', 'Category')} ${row.year}`}
        placeholder={t('v2Forecast.investmentCategoryPlaceholder', 'Category')}
        value={row.category ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'category',
            event.target.value,
          )
        }
      />
      <select
        className="v2-input"
        name={`yearlyInvestmentType-${row.year}`}
        aria-label={`${t('v2Forecast.investmentTypePlaceholder', 'Type')} ${row.year}`}
        value={row.investmentType ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'investmentType',
            event.target.value,
          )
        }
      >
        <option value="">{t('v2Forecast.investmentTypePlaceholder', 'Type')}</option>
        <option value="replacement">
          {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
        </option>
        <option value="new">{t('v2Forecast.investmentTypeNew', 'New')}</option>
      </select>
      <select
        className="v2-input"
        name={`yearlyInvestmentConfidence-${row.year}`}
        aria-label={`${t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')} ${row.year}`}
        value={row.confidence ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'confidence',
            event.target.value,
          )
        }
      >
        <option value="">
          {t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')}
        </option>
        <option value="low">{t('v2Forecast.investmentConfidenceLow', 'Low')}</option>
        <option value="medium">
          {t('v2Forecast.investmentConfidenceMedium', 'Medium')}
        </option>
        <option value="high">
          {t('v2Forecast.investmentConfidenceHigh', 'High')}
        </option>
      </select>
      <input
        className="v2-input"
        type="text"
        name={`yearlyInvestmentNote-${row.year}`}
        aria-label={`${t('v2Forecast.investmentNotePlaceholder', 'Note')} ${row.year}`}
        placeholder={t('v2Forecast.investmentNotePlaceholder', 'Note')}
        value={row.note ?? ''}
        onChange={(event) =>
          handleInvestmentMetadataChange(
            row.rowId ?? String(row.year),
            'note',
            event.target.value,
          )
        }
      />
    </div>
  ));
}
