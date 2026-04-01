import React from 'react';
import type { TFunction } from 'i18next';
import type { V2YearlyInvestmentPlanRow } from '../api';

type InvestmentSurfaceRow = V2YearlyInvestmentPlanRow;

type LongRangeInvestmentGroup = {
  id: string;
  startYear: number;
  endYear: number;
  rows: InvestmentSurfaceRow[];
  total: number;
  peakYears: number[];
};

type InvestmentSummary = {
  peakAnnualAmount: number;
  peakYears: number[];
  strongestFiveYearTotal: number;
  strongestFiveYearRange: { startYear: number; endYear: number } | null;
};

type InvestmentImpactSummary = {
  totalInvestments: number;
  totalDepreciation: number;
  requiredPriceToday: number;
  peakGap: number;
};

type Props = {
  t: TFunction;
  depreciationRulesUnavailable: boolean;
  investmentSummary: InvestmentSummary;
  forecastStateToneClass: string;
  forecastStateLabel: string;
  investmentImpactSummary: InvestmentImpactSummary;
  hasInvestmentDepreciationErrors: boolean;
  invalidInvestmentDepreciationYears: number[];
  onContinueToDepreciation: () => void;
  renderInvestmentProgramRows: (rows: InvestmentSurfaceRow[]) => React.ReactNode;
  nearTermInvestmentRows: InvestmentSurfaceRow[];
  investmentProgramGroupOptions: string[];
  longRangeInvestmentGroups: LongRangeInvestmentGroup[];
  renderInvestmentEditorRows: (rows: InvestmentSurfaceRow[]) => React.ReactNode;
  denseAnalystMode: boolean;
  busy: boolean;
  draftInvestmentsCount: number;
  onCopyFirstInvestmentToAll: () => void;
  onRepeatNearTermInvestmentTemplate: () => void;
  onClearAllInvestments: () => void;
  allInvestmentRows: InvestmentSurfaceRow[];
  formatEur: (value: number) => string;
  formatPrice: (value: number) => string;
};

export const ForecastInvestmentSurface: React.FC<Props> = ({
  t,
  depreciationRulesUnavailable,
  investmentSummary,
  forecastStateToneClass,
  forecastStateLabel,
  investmentImpactSummary,
  hasInvestmentDepreciationErrors,
  invalidInvestmentDepreciationYears,
  onContinueToDepreciation,
  renderInvestmentProgramRows,
  nearTermInvestmentRows,
  investmentProgramGroupOptions,
  longRangeInvestmentGroups,
  renderInvestmentEditorRows,
  denseAnalystMode,
  busy,
  draftInvestmentsCount,
  onCopyFirstInvestmentToAll,
  onRepeatNearTermInvestmentTemplate,
  onClearAllInvestments,
  allInvestmentRows,
  formatEur,
  formatPrice,
}) => {
  return (
    <article className="v2-subcard v2-investment-program-card">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Forecast.investmentProgramEyebrow', 'Investment program')}
          </p>
          <h3>{t('v2Forecast.investmentProgramTitle', 'Investment program')}</h3>
        </div>
      </div>
      {depreciationRulesUnavailable ? (
        <p className="v2-alert v2-alert-error">
          {t(
            'v2Forecast.depreciationRulesUnavailable',
            'Depreciation rules are missing for this scenario. Refresh the scenario before saving investment years.',
          )}
        </p>
      ) : null}
      <div className="v2-kpi-strip v2-kpi-strip-three v2-investment-summary-strip">
        <article>
          <h3>
            {t(
              'v2Forecast.investmentPeakAnnualTotal',
              'Peak annual investment total',
            )}
          </h3>
          <p>{formatEur(investmentSummary.peakAnnualAmount)}</p>
        </article>
        <article>
          <h3>
            {t(
              'v2Forecast.investmentStrongestFiveYear',
              'Strongest rolling 5-year total',
            )}
          </h3>
          <p>{formatEur(investmentSummary.strongestFiveYearTotal)}</p>
          <small>
            {investmentSummary.strongestFiveYearRange
              ? `${investmentSummary.strongestFiveYearRange.startYear}-${investmentSummary.strongestFiveYearRange.endYear}`
              : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
          </small>
        </article>
        <article>
          <h3>{t('v2Forecast.investmentPeakYears', 'Peak years')}</h3>
          <p>
            {investmentSummary.peakYears.length > 0
              ? investmentSummary.peakYears.join(', ')
              : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
          </p>
        </article>
      </div>
      <div className="v2-section-header">
        <div>
          <h4>{t('v2Forecast.investmentImpactTitle', 'Investment plan effect')}</h4>
        </div>
        <span className={`v2-badge ${forecastStateToneClass}`}>
          {forecastStateLabel}
        </span>
      </div>
      <div className="v2-kpi-strip v2-kpi-strip-four v2-investment-impact-strip">
        <article>
          <h3>{t('v2Forecast.totalInvestments', 'Total investments')}</h3>
          <p>{formatEur(investmentImpactSummary.totalInvestments)}</p>
        </article>
        <article>
          <h3>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</h3>
          <p>{formatEur(investmentImpactSummary.totalDepreciation)}</p>
        </article>
        <article>
          <h3>
            {t(
              'v2Forecast.requiredPriceAnnualResult',
              'Required price today (annual result = 0)',
            )}
          </h3>
          <p>{formatPrice(investmentImpactSummary.requiredPriceToday)}</p>
        </article>
        <article>
          <h3>{t('v2Forecast.depreciationImpactPeakGap', 'Peak cumulative gap')}</h3>
          <p>{formatEur(investmentImpactSummary.peakGap)}</p>
        </article>
      </div>
      {hasInvestmentDepreciationErrors ? (
        <div className="v2-alert v2-alert-error">
          <p>
            {t(
              'v2Forecast.unmappedInvestmentYears',
              'Unmapped investment years: {{years}}',
              { years: invalidInvestmentDepreciationYears.join(', ') },
            )}
          </p>
          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn v2-btn-small"
              onClick={onContinueToDepreciation}
            >
              {t(
                'v2Forecast.investmentProgramContinueDepreciation',
                'Continue to depreciation plans',
              )}
            </button>
          </div>
        </div>
      ) : null}
      <div className="v2-investment-workspace-toolbar">
        <p className="v2-muted">
          {t(
            'v2Forecast.investmentGuardrailHint',
            'Investment values are normalized to non-negative whole euros (max 1,000,000,000).',
          )}
        </p>
        <div className="v2-actions-row v2-investment-bulk-actions">
          <button
            type="button"
            className="v2-btn"
            onClick={onCopyFirstInvestmentToAll}
            disabled={busy || draftInvestmentsCount === 0}
          >
            {t('v2Forecast.investmentCopyFirstToAll', 'Copy first year to all')}
          </button>
          <button
            type="button"
            className="v2-btn"
            onClick={onRepeatNearTermInvestmentTemplate}
            disabled={busy || draftInvestmentsCount <= 5}
          >
            {t(
              'v2Forecast.investmentRepeatNearTermTemplate',
              'Repeat near-term template',
            )}
          </button>
          <button
            type="button"
            className="v2-btn"
            onClick={onClearAllInvestments}
            disabled={busy || draftInvestmentsCount === 0}
          >
            {t('v2Forecast.investmentClearAll', 'Clear all')}
          </button>
          <button
            type="button"
            className="v2-btn"
            onClick={onContinueToDepreciation}
          >
            {t(
              'v2Forecast.openDepreciationWorkbench',
              'Open depreciation planning',
            )}
          </button>
        </div>
      </div>
      <div className="v2-investment-program-table">
        <div
          className="v2-investment-program-row v2-investment-program-row-head"
          aria-hidden="true"
        >
          <span>{t('common.year', 'Year')}</span>
          <span>{t('v2Forecast.investmentProgramTargetLabel', 'Target')}</span>
          <span>{t('v2Forecast.investmentProgramTypeLabel', 'Type')}</span>
          <span>{t('v2Forecast.investmentProgramGroupLabel', 'Group')}</span>
          <span>{t('v2Forecast.depreciationCategory', 'Depreciation rule')}</span>
          <span>{t('v2Forecast.investmentProgramWaterAmount', 'Water EUR')}</span>
          <span>
            {t('v2Forecast.investmentProgramWastewaterAmount', 'Wastewater EUR')}
          </span>
          <span>{t('v2Forecast.investmentProgramTotalAmount', 'Total EUR')}</span>
          <span>{t('v2Forecast.investmentProgramNoteLabel', 'Note')}</span>
        </div>
        {renderInvestmentProgramRows(nearTermInvestmentRows)}
      </div>
      <datalist id="v2-investment-program-group-options">
        {investmentProgramGroupOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>

      {longRangeInvestmentGroups.length > 0 ? (
        <div className="v2-investment-group-list">
          <div className="v2-section-header">
            <div>
              <h4>
                {t(
                  'v2Forecast.investmentLongRangeTitle',
                  'Grouped long-range blocks',
                )}
              </h4>
            </div>
          </div>
          {longRangeInvestmentGroups.map((group) => (
            <details
              key={group.id}
              className="v2-manual-optional v2-investment-group-card"
            >
              <summary>
                {t(
                  'v2Forecast.investmentLongRangeGroup',
                  'Long-range block {{start}}-{{end}}',
                  {
                    start: group.startYear,
                    end: group.endYear,
                  },
                )}
                {` | ${formatEur(group.total)}`}
              </summary>
              <p className="v2-muted">
                {group.peakYears.length > 0
                  ? `${t('v2Forecast.investmentPeakYears', 'Peak years')}: ${group.peakYears.join(', ')}`
                  : t('v2Forecast.investmentPeakYearsEmpty', 'None')}
              </p>
              <div className="v2-investment-table">
                <div className="v2-investment-row v2-investment-row-head" aria-hidden="true">
                  <span>{t('common.year', 'Year')}</span>
                  <span>
                    {t(
                      'v2Forecast.yearlyInvestmentsEur',
                      'Yearly investments (EUR)',
                    )}
                  </span>
                  <span>{t('v2Forecast.investmentCategoryPlaceholder', 'Group')}</span>
                  <span>{t('v2Forecast.investmentTypePlaceholder', 'Type')}</span>
                  <span>
                    {t(
                      'v2Forecast.investmentConfidencePlaceholder',
                      'Confidence',
                    )}
                  </span>
                  <span>{t('v2Forecast.investmentNotePlaceholder', 'Note')}</span>
                </div>
                {renderInvestmentEditorRows(group.rows)}
              </div>
            </details>
          ))}
        </div>
      ) : null}

      <details className="v2-manual-optional" open={denseAnalystMode}>
        <summary>
          {t('v2Forecast.investmentAnnualTable', 'Full annual table')}
        </summary>
        <div className="v2-investment-table">
          <div className="v2-investment-row v2-investment-row-head" aria-hidden="true">
            <span>{t('common.year', 'Year')}</span>
            <span>
              {t('v2Forecast.yearlyInvestmentsEur', 'Yearly investments (EUR)')}
            </span>
            <span>{t('v2Forecast.investmentCategoryPlaceholder', 'Group')}</span>
            <span>{t('v2Forecast.investmentTypePlaceholder', 'Type')}</span>
            <span>
              {t('v2Forecast.investmentConfidencePlaceholder', 'Confidence')}
            </span>
            <span>{t('v2Forecast.investmentNotePlaceholder', 'Note')}</span>
          </div>
          {renderInvestmentEditorRows(allInvestmentRows)}
        </div>
      </details>
    </article>
  );
};
