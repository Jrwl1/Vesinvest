import React from 'react';
import type { TFunction } from 'i18next';
import type { DepreciationRuleDraft } from './forecastModel';

type DepreciationPreviewRow = {
  year: number;
  baseline: number;
  scenario: number;
  total: number;
};

type InvestmentAmountRow = {
  year: number;
  amount: number;
};

type DepreciationClassOption = {
  key: string;
  label: string;
};

type Props = {
  t: TFunction;
  reportReadinessToneClass: string;
  reportReadinessLabel: string;
  reportReadinessReason: string | null;
  reportReadinessHint: string | null;
  baselineDepreciationTotal: number;
  newInvestmentDepreciationTotal: number;
  totalDepreciationEffect: number;
  requiredPriceToday: number;
  requiredAnnualIncreasePct: number;
  underfundingStartYear: number | null;
  peakGap: number;
  latestCashflow: number | null;
  depreciationPreviewRows: DepreciationPreviewRow[];
  unmappedInvestmentYears: number[];
  savedMappedInvestmentYearsCount: number;
  plannedInvestmentYearCount: number;
  depreciationClassKeys: string[];
  draftInvestments: InvestmentAmountRow[];
  savedMappedDepreciationClassByYear: Record<number, string | null>;
  inferredDepreciationClassOptionByYear: Record<
    number,
    DepreciationClassOption | null
  >;
  previousSavedDepreciationClassByYear: Record<
    number,
    { sourceYear: number; classKey: string } | null
  >;
  mappedDepreciationClassByYear: Record<number, string | null>;
  handleAllocationDraftChange: (year: number, classKey: string) => void;
  depreciationClassOptions: DepreciationClassOption[];
  applyCarryForwardMapping: (year: number) => void;
  busy: boolean;
  canSaveClassAllocations: boolean;
  saveClassAllocations: () => void;
  loadingDepreciation: boolean;
  depreciationRuleDrafts: DepreciationRuleDraft[];
  getDepreciationRuleGroup: (assetClassKey: string) => string;
  handleDepreciationRuleDraftChange: (
    index: number,
    field: keyof DepreciationRuleDraft,
    value: string,
  ) => void;
  saveDepreciationRuleDraft: (index: number) => void;
  formatEur: (value: number) => string;
  formatPrice: (value: number) => string;
  formatPercent: (value: number) => string;
};

export const ForecastDepreciationSurface: React.FC<Props> = ({
  t,
  reportReadinessToneClass,
  reportReadinessLabel,
  reportReadinessReason,
  reportReadinessHint,
  baselineDepreciationTotal,
  newInvestmentDepreciationTotal,
  totalDepreciationEffect,
  requiredPriceToday,
  requiredAnnualIncreasePct,
  underfundingStartYear,
  peakGap,
  latestCashflow,
  depreciationPreviewRows,
  unmappedInvestmentYears,
  savedMappedInvestmentYearsCount,
  plannedInvestmentYearCount,
  depreciationClassKeys,
  draftInvestments,
  savedMappedDepreciationClassByYear,
  inferredDepreciationClassOptionByYear,
  previousSavedDepreciationClassByYear,
  mappedDepreciationClassByYear,
  handleAllocationDraftChange,
  depreciationClassOptions,
  applyCarryForwardMapping,
  busy,
  canSaveClassAllocations,
  saveClassAllocations,
  loadingDepreciation,
  depreciationRuleDrafts,
  getDepreciationRuleGroup,
  handleDepreciationRuleDraftChange,
  saveDepreciationRuleDraft,
  formatEur,
  formatPrice,
  formatPercent,
}) => {
  return (
    <section className="v2-card v2-depreciation-workbench">
      <div className="v2-forecast-workspace-head">
        <div className="v2-forecast-workspace-copy">
          <h3>
            {t(
              'v2Forecast.depreciationWorkbenchTitle',
              'Depreciation plans for future investments',
            )}
          </h3>
        </div>
      </div>

      <div className="v2-statement-cockpit-grid">
        <article className="v2-subcard v2-statement-card">
          <div className="v2-section-header">
            <div>
              <h4>
                {t(
                  'v2Forecast.depreciationPreviewTitle',
                  'Yearly depreciation preview',
                )}
              </h4>
              <p className="v2-muted">
                {t(
                  'v2Forecast.depreciationPreviewHint',
                  'Baseline, new-investment, and total depreciation stay visible while you adjust mappings and category rules.',
                )}
              </p>
            </div>
            <span className={`v2-badge ${reportReadinessToneClass}`}>
              {reportReadinessLabel}
            </span>
          </div>
          {reportReadinessReason === 'depreciationMappingIncomplete' ? (
            <p className="v2-alert v2-alert-error">{reportReadinessHint}</p>
          ) : null}
          <div className="v2-kpi-strip v2-kpi-strip-three">
            <article>
              <h3>
                {t(
                  'v2Forecast.baselineDepreciationTitle',
                  'Baseline depreciation',
                )}
              </h3>
              <p>{formatEur(baselineDepreciationTotal)}</p>
            </article>
            <article>
              <h3>
                {t(
                  'v2Forecast.newInvestmentDepreciationTitle',
                  'New-investment depreciation',
                )}
              </h3>
              <p>{formatEur(newInvestmentDepreciationTotal)}</p>
            </article>
            <article>
              <h3>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</h3>
              <p>{formatEur(totalDepreciationEffect)}</p>
            </article>
          </div>
          <div className="v2-section-header">
            <div>
              <h4>{t('v2Forecast.depreciationImpactTitle', 'Tariff and cash impact')}</h4>
              <p className="v2-muted">
                {t(
                  'v2Forecast.depreciationImpactHint',
                  'Keep the funding consequence visible while you map investment years and adjust depreciation classes.',
                )}
              </p>
            </div>
          </div>
          <div className="v2-kpi-strip v2-depreciation-impact-strip">
            <article>
              <h3>
                {t(
                  'v2Forecast.requiredPriceAnnualResult',
                  'Required price today (annual result = 0)',
                )}
              </h3>
              <p>{formatPrice(requiredPriceToday)}</p>
            </article>
            <article>
              <h3>
                {t(
                  'v2Forecast.requiredIncreaseAnnualResult',
                  'Required increase vs comparator (annual result)',
                )}
              </h3>
              <p>{formatPercent(requiredAnnualIncreasePct)}</p>
            </article>
            <article>
              <h3>
                {t(
                  'v2Forecast.underfundingStartAnnualResult',
                  'Underfunding starts (annual result)',
                )}
              </h3>
              <p>{underfundingStartYear ?? t('v2Forecast.noUnderfunding', 'None')}</p>
            </article>
            <article>
              <h3>{t('v2Forecast.depreciationImpactPeakGap', 'Peak cumulative gap')}</h3>
              <p>{formatEur(peakGap)}</p>
            </article>
            <article>
              <h3>
                {t(
                  'v2Forecast.depreciationImpactHorizonCashflow',
                  'Horizon cashflow',
                )}
              </h3>
              <p>
                {latestCashflow != null
                  ? formatEur(latestCashflow)
                  : t('v2Forecast.reportStateMissing', 'Missing')}
              </p>
            </article>
          </div>
          {depreciationPreviewRows.length === 0 ? (
            <p className="v2-muted">
              {t(
                'v2Forecast.depreciationPreviewMissing',
                'Compute the scenario to see the yearly depreciation preview.',
              )}
            </p>
          ) : (
            <div className="v2-statement-table" role="table">
              <div className="v2-statement-row v2-statement-row-head" role="row">
                <span>{t('common.year', 'Year')}</span>
                <span>
                  {t(
                    'v2Forecast.baselineDepreciationTitle',
                    'Baseline depreciation',
                  )}
                </span>
                <span>
                  {t(
                    'v2Forecast.newInvestmentDepreciationTitle',
                    'New-investment depreciation',
                  )}
                </span>
                <span>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</span>
              </div>
              {depreciationPreviewRows.map((row) => (
                <div
                  className="v2-statement-row"
                  key={`depreciation-preview-${row.year}`}
                  role="row"
                >
                  <strong>{row.year}</strong>
                  <span>{formatEur(row.baseline)}</span>
                  <span>{formatEur(row.scenario)}</span>
                  <span>{formatEur(row.total)}</span>
                </div>
              ))}
            </div>
          )}
        </article>
        <article className="v2-subcard v2-statement-card">
          <h4>
            {t(
              'v2Forecast.classAllocationTitle',
              'Set a depreciation plan for each investment year',
            )}
          </h4>
          <div className="v2-badge-row">
            <span
              className={`v2-badge ${
                unmappedInvestmentYears.length > 0
                  ? 'v2-status-warning'
                  : 'v2-status-positive'
              }`}
            >
              {unmappedInvestmentYears.length > 0
                ? t('v2Forecast.mappingStatusBlocked', 'Report blocked')
                : t('v2Forecast.mappingStatusReady', 'Ready for report')}
            </span>
            <span className="v2-badge v2-status-info">
              {t('v2Forecast.mappingSavedYears', '{{saved}}/{{total}} years saved', {
                saved: savedMappedInvestmentYearsCount,
                total: plannedInvestmentYearCount,
              })}
            </span>
          </div>
          {unmappedInvestmentYears.length > 0 ? (
            <p className="v2-alert v2-alert-error">
              {t(
                'v2Forecast.unmappedInvestmentYears',
                'Unmapped investment years: {{years}}',
                { years: unmappedInvestmentYears.join(', ') },
              )}
            </p>
          ) : (
            <p className="v2-muted">
              {t(
                'v2Forecast.allInvestmentsMapped',
                'Every investment year has a saved depreciation plan.',
              )}
            </p>
          )}
          {depreciationClassKeys.length === 0 ? (
            <p className="v2-muted">
              {t(
                'v2Forecast.classAllocationNoRules',
                'Add at least one depreciation rule below before mapping years.',
              )}
            </p>
          ) : (
            <div className="v2-class-allocation-table">
              {draftInvestments
                .filter((row) => row.amount > 0)
                .map((row) => {
                  const hasSavedMapping =
                    savedMappedDepreciationClassByYear[row.year] != null;
                  const inferredOption = inferredDepreciationClassOptionByYear[row.year];
                  const carryForwardSource =
                    previousSavedDepreciationClassByYear[row.year];
                  return (
                    <div
                      key={`allocation-${row.year}`}
                      className="v2-class-allocation-row"
                    >
                      <strong>{row.year}</strong>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.yearlyInvestmentsEur',
                              'Yearly investments (EUR)',
                            )}
                          </span>
                          <strong>{formatEur(row.amount)}</strong>
                        </div>
                      </div>
                      <label className="v2-field">
                        <span>{t('v2Forecast.depreciationCategory', 'Depreciation rule')}</span>
                        <select
                          className="v2-input"
                          value={mappedDepreciationClassByYear[row.year] ?? ''}
                          onChange={(event) =>
                            handleAllocationDraftChange(row.year, event.target.value)
                          }
                        >
                          <option value="">{t('v2Forecast.unmapped', 'Unmapped')}</option>
                          {depreciationClassOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {!hasSavedMapping && inferredOption ? (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.defaultMappingSuggestion',
                            'Default suggestion ready: {{label}}. Save depreciation plans to keep it for {{year}}.',
                            {
                              label: inferredOption.label,
                              year: row.year,
                            },
                          )}
                        </p>
                      ) : null}
                      {!hasSavedMapping && carryForwardSource ? (
                        <div className="v2-actions-row">
                          <button
                            type="button"
                            className="v2-btn v2-btn-small"
                            onClick={() => applyCarryForwardMapping(row.year)}
                          >
                            {t(
                              'v2Forecast.carryForwardMapping',
                              'Carry forward {{year}} mapping',
                              {
                                year: carryForwardSource.sourceYear ?? '',
                              },
                            )}
                          </button>
                        </div>
                      ) : null}
                      {!hasSavedMapping ? (
                        <p className="v2-muted">
                          {t(
                            'v2Forecast.mappingRequiresSaveHint',
                            'Reports stay blocked until this year is saved in depreciation plans.',
                          )}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          )}
          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn"
              disabled={busy || !canSaveClassAllocations}
              onClick={saveClassAllocations}
            >
              {t('v2Forecast.saveClassAllocations', 'Save depreciation plans')}
            </button>
          </div>
        </article>
      </div>

      <section className="v2-grid v2-grid-two">
        <article className="v2-subcard">
          <h3>{t('v2Forecast.depreciationRulesTitle', 'Depreciation plans')}</h3>
          {loadingDepreciation ? (
            <p className="v2-muted">
              {t('v2Forecast.depreciationRulesLoading', 'Loading depreciation rules...')}
            </p>
          ) : null}
          <div className="v2-depreciation-rule-list">
            {depreciationRuleDrafts.length === 0 ? (
              <p className="v2-muted">
                {t(
                  'v2Forecast.depreciationRulesEmpty',
                  'No depreciation plans yet. Add the first rule below.',
                )}
              </p>
            ) : null}
            {depreciationRuleDrafts.map((row, index) => (
              <div
                key={row.id ?? `new-rule-${index}`}
                className={`v2-depreciation-rule-row ${
                  index > 0 &&
                  getDepreciationRuleGroup(row.assetClassKey) !==
                    getDepreciationRuleGroup(
                      depreciationRuleDrafts[index - 1]?.assetClassKey ?? '',
                    )
                    ? 'group-start'
                    : ''
                }`.trim()}
              >
                <label className="v2-field">
                  <span>{t('v2Forecast.classKey', 'Rule code')}</span>
                  <input
                    className="v2-input"
                    type="text"
                    value={row.assetClassKey}
                    disabled
                    readOnly
                  />
                </label>
                <label className="v2-field">
                  <span>{t('v2Forecast.className', 'Plan name')}</span>
                  <input
                    className="v2-input"
                    type="text"
                    value={row.assetClassName}
                    disabled
                    readOnly
                  />
                </label>
                <label className="v2-field">
                  <span>{t('v2Forecast.method', 'Depreciation method')}</span>
                  <select
                    className="v2-input"
                    value={row.method}
                    onChange={(event) =>
                      handleDepreciationRuleDraftChange(
                        index,
                        'method',
                        event.target.value,
                      )
                    }
                  >
                    <option value="straight-line">
                      {t(
                        'v2Forecast.methodStraightLine',
                        'Straight-line {{years}} years',
                        {
                          years:
                            row.linearYears.trim().length > 0 ? row.linearYears : 'X',
                        },
                      )}
                    </option>
                    <option value="residual">
                      {t(
                        'v2Forecast.methodResidual',
                        'Residual {{percent}} %',
                        {
                          percent:
                            row.residualPercent.trim().length > 0
                              ? row.residualPercent
                              : 'Y',
                        },
                      )}
                    </option>
                    <option value="none">
                      {t('v2Forecast.methodNone', 'No depreciation')}
                    </option>
                  </select>
                </label>
                <label className="v2-field">
                  <span>{t('v2Forecast.linearYearsLabel', 'Write-off time (years)')}</span>
                  <input
                    className="v2-input"
                    type="number"
                    min="1"
                    max="120"
                    value={row.linearYears}
                    disabled={row.method !== 'straight-line'}
                    onChange={(event) =>
                      handleDepreciationRuleDraftChange(
                        index,
                        'linearYears',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label className="v2-field">
                  <span>{t('v2Forecast.residualPercentLabel', 'Residual share (%)')}</span>
                  <input
                    className="v2-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={row.residualPercent}
                    disabled={row.method !== 'residual'}
                    onChange={(event) =>
                      handleDepreciationRuleDraftChange(
                        index,
                        'residualPercent',
                        event.target.value,
                      )
                    }
                  />
                </label>
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className="v2-btn"
                    disabled={busy}
                    onClick={() => saveDepreciationRuleDraft(index)}
                  >
                    {t('common.save', 'Save')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="v2-subcard">
          <h3>{t('v2Forecast.depreciationStatusTitle', 'Saved plans and report status')}</h3>
          <div className="v2-keyvalue-list">
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.reportReadinessTitle', 'Report status')}</span>
              <strong>{reportReadinessLabel}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.mappedInvestmentYears', 'Saved investment years')}</span>
              <strong>{savedMappedInvestmentYearsCount}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>
                {t(
                  'v2Forecast.unmappedInvestmentYearsLabel',
                  'Years still blocking report',
                )}
              </span>
              <strong>
                {unmappedInvestmentYears.length > 0
                  ? unmappedInvestmentYears.join(', ')
                  : t('common.no', 'No')}
              </strong>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
};
