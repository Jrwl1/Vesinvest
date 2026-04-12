import React from 'react';
import type { TFunction } from 'i18next';

import type { V2YearlyInvestmentPlanRow } from '../api';
import { MAX_YEARLY_INVESTMENT_EUR, resolveInvestmentProgramTotal } from './forecastModel';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

type InvestmentRow = V2YearlyInvestmentPlanRow;

type DepreciationClassOption = {
  key: string;
  label: string;
};

function isVesinvestLinkedForecastRow(row: InvestmentRow): boolean {
  return (
    (row.vesinvestPlanId ?? '').trim().length > 0 ||
    (row.vesinvestProjectId ?? '').trim().length > 0 ||
    (row.allocationId ?? '').trim().length > 0 ||
    (row.projectCode ?? '').trim().length > 0 ||
    (row.groupKey ?? '').trim().length > 0
  );
}

function renderReadonlyInvestmentCell(
  primary: string,
  secondary?: string | null,
): React.ReactNode {
  return (
    <div className="v2-input v2-readonly-field">
      <strong>{primary}</strong>
      {secondary ? <span className="v2-muted">{secondary}</span> : null}
    </div>
  );
}

function formatForecastInvestmentTypeLabel(
  t: TFunction,
  value: InvestmentRow['investmentType'],
): string {
  if (value === 'new') {
    return t('v2Forecast.investmentTypeNew', 'New');
  }
  if (value === 'replacement') {
    return t('v2Forecast.investmentTypeReplacement', 'Replacement');
  }
  return '-';
}

function formatForecastInvestmentConfidenceLabel(
  t: TFunction,
  value: InvestmentRow['confidence'],
): string {
  if (value === 'high') {
    return t('v2Forecast.investmentConfidenceHigh', 'High');
  }
  if (value === 'medium') {
    return t('v2Forecast.investmentConfidenceMedium', 'Medium');
  }
  if (value === 'low') {
    return t('v2Forecast.investmentConfidenceLow', 'Low');
  }
  return '-';
}

function formatDepreciationSnapshotSummary(
  t: TFunction,
  snapshot: InvestmentRow['depreciationRuleSnapshot'] | null | undefined,
): string | null {
  if (!snapshot) {
    return null;
  }
  switch (snapshot.method) {
    case 'straight-line':
      return t('v2Forecast.methodStraightLine', 'Straight-line {{years}} years', {
        years: snapshot.linearYears ?? 0,
      });
    case 'linear':
      return t('v2Forecast.methodLinear', 'Linear');
    case 'custom-annual-schedule':
      return t('v2Forecast.methodCustomSchedule', 'Year-by-year schedule');
    case 'residual':
      return t('v2Forecast.methodResidual', 'Residual {{percent}} %', {
        percent: snapshot.residualPercent ?? 0,
      });
    case 'none':
      return t('v2Forecast.methodNone', 'No depreciation');
    default:
      return null;
  }
}

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
  const authoritativeClassColumns =
    rows.length > 0 && rows.every((row) => isVesinvestLinkedForecastRow(row));

  return rows.map((row) => {
    const rowKey = row.rowId ?? String(row.year);
    const isVesinvestLinked = isVesinvestLinkedForecastRow(row);
    const classLabel = resolveVesinvestGroupLabel(t, row.groupKey, row.category ?? null);
    const snapshotDepreciationSummary = formatDepreciationSnapshotSummary(
      t,
      row.depreciationRuleSnapshot,
    );
    const depreciationSummary = depreciationRulesUnavailable
      ? t(
          'v2Forecast.depreciationRulesUnavailableShort',
          'Depreciation rules unavailable',
        )
      : snapshotDepreciationSummary ??
        formatDepreciationRuleSummary(effectiveInvestmentDepreciationClassByYear[row.year]) ??
        t('v2Vesinvest.none', 'None');
    const linkedDepreciationSummary = snapshotDepreciationSummary
      ?? (depreciationRulesUnavailable
        ? t(
            'v2Forecast.depreciationRulesUnavailableShort',
            'Depreciation rules unavailable',
          )
        : t('v2Forecast.unmapped', 'Unmapped'));

    return (
      <div key={`program-${rowKey}`} className="v2-investment-program-row">
        <strong className="v2-investment-year-pill">{row.year}</strong>
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(row.target ?? '-', null)
          : (
            <input
              className="v2-input"
              type="text"
              name={`investmentProgramTarget-${row.year}`}
              aria-label={`${t('v2Forecast.investmentProgramTargetLabel', 'Target')} ${row.year}`}
              placeholder={t('v2Forecast.investmentProgramTargetLabel', 'Target')}
              value={row.target ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'target', event.target.value)
              }
            />
          )}
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(
              authoritativeClassColumns
                ? row.projectCode?.trim() || '-'
                : formatForecastInvestmentTypeLabel(t, row.investmentType),
              authoritativeClassColumns
                ? formatForecastInvestmentTypeLabel(t, row.investmentType)
                : row.projectCode?.trim() || null,
            )
          : (
            <select
              className="v2-input"
              name={`investmentProgramType-${row.year}`}
              aria-label={`${t('v2Forecast.investmentProgramTypeLabel', 'Type')} ${row.year}`}
              value={row.investmentType ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'investmentType', event.target.value)
              }
            >
              <option value="">{t('v2Forecast.investmentProgramTypeLabel', 'Type')}</option>
              <option value="replacement">
                {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
              </option>
              <option value="new">{t('v2Forecast.investmentTypeNew', 'New')}</option>
            </select>
          )}
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(classLabel, null)
          : (
            <input
              className="v2-input"
              type="text"
              list="v2-investment-program-group-options"
              name={`investmentProgramGroup-${row.year}`}
              aria-label={`${t('v2Forecast.investmentProgramGroupLabel', 'Group')} ${row.year}`}
              placeholder={t('v2Forecast.investmentProgramGroupLabel', 'Group')}
              value={row.category ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'category', event.target.value)
              }
            />
          )}
        <div className="v2-investment-depreciation-cell">
          {isVesinvestLinked
            ? renderReadonlyInvestmentCell(linkedDepreciationSummary, row.accountKey ?? null)
            : (
              <>
                <select
                  className="v2-input"
                  name={`investmentProgramDepreciationClass-${row.year}`}
                  aria-label={`${t('v2Forecast.depreciationCategory', 'Depreciation rule')} ${row.year}`}
                  value={effectiveInvestmentDepreciationClassByYear[row.year] ?? ''}
                  disabled={loadingDepreciation || depreciationRulesUnavailable}
                  onChange={(event) =>
                    handleInvestmentMetadataChange(
                      rowKey,
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
                <span className="v2-muted">{depreciationSummary}</span>
              </>
            )}
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
            handleInvestmentProgramAmountChange(rowKey, 'waterAmount', event.target.value)
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
            handleInvestmentProgramAmountChange(rowKey, 'wastewaterAmount', event.target.value)
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
          onChange={(event) => handleInvestmentChange(rowKey, event.target.value)}
          onBlur={() => handleInvestmentBlur(rowKey)}
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
            handleInvestmentMetadataChange(rowKey, 'note', event.target.value)
          }
        />
      </div>
    );
  });
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
  return rows.map((row) => {
    const rowKey = row.rowId ?? String(row.year);
    const isVesinvestLinked = isVesinvestLinkedForecastRow(row);
    const classLabel = resolveVesinvestGroupLabel(t, row.groupKey, row.category ?? null);

    return (
      <div key={rowKey} className="v2-investment-row">
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
          onChange={(event) => handleInvestmentChange(rowKey, event.target.value)}
          onBlur={() => handleInvestmentBlur(rowKey)}
          onFocus={(event) => event.currentTarget.select()}
        />
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(classLabel, null)
          : (
            <input
              className="v2-input"
              type="text"
              name={`yearlyInvestmentCategory-${row.year}`}
              aria-label={`${t('v2Forecast.investmentCategoryPlaceholder', 'Category')} ${row.year}`}
              placeholder={t('v2Forecast.investmentCategoryPlaceholder', 'Category')}
              value={row.category ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'category', event.target.value)
              }
            />
          )}
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(
              formatForecastInvestmentTypeLabel(t, row.investmentType),
              row.projectCode?.trim() || null,
            )
          : (
            <select
              className="v2-input"
              name={`yearlyInvestmentType-${row.year}`}
              aria-label={`${t('v2Forecast.investmentTypePlaceholder', 'Type')} ${row.year}`}
              value={row.investmentType ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'investmentType', event.target.value)
              }
            >
              <option value="">{t('v2Forecast.investmentTypePlaceholder', 'Type')}</option>
              <option value="replacement">
                {t('v2Forecast.investmentTypeReplacement', 'Replacement')}
              </option>
              <option value="new">{t('v2Forecast.investmentTypeNew', 'New')}</option>
            </select>
          )}
        {isVesinvestLinked
          ? renderReadonlyInvestmentCell(
              formatForecastInvestmentConfidenceLabel(t, row.confidence),
              null,
            )
          : (
            <select
              className="v2-input"
              name={`yearlyInvestmentConfidence-${row.year}`}
              aria-label={`${t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')} ${row.year}`}
              value={row.confidence ?? ''}
              onChange={(event) =>
                handleInvestmentMetadataChange(rowKey, 'confidence', event.target.value)
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
          )}
        <input
          className="v2-input"
          type="text"
          name={`yearlyInvestmentNote-${row.year}`}
          aria-label={`${t('v2Forecast.investmentNotePlaceholder', 'Note')} ${row.year}`}
          placeholder={t('v2Forecast.investmentNotePlaceholder', 'Note')}
          value={row.note ?? ''}
          onChange={(event) =>
            handleInvestmentMetadataChange(rowKey, 'note', event.target.value)
          }
        />
      </div>
    );
  });
}
