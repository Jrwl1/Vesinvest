import React from 'react';
import type { TFunction } from 'i18next';

import type {
  V2BaselineSourceSummary,
  V2OverrideProvenance,
  V2ReportDetail,
  V2ReportListItem,
} from '../api';
import { formatEur, formatNumber, formatPercent, formatPrice } from './format';
import {
  formatDepreciationMethod,
  formatInvestmentSnapshotMethod,
  formatServiceSplitLabel,
  REPORT_VARIANT_OPTIONS,
} from './reportReadinessModel';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

export { ReportsListColumn } from './reportsListColumn';

type ReportVariantOption = (typeof REPORT_VARIANT_OPTIONS)[number];
type TariffAssumptionRow = { key: string; label: string; value: string };
type TariffDriverSummary = {
  baselineSoldVolume: number | null;
  openingDepreciation: number | null;
  peakInvestmentYear: number | null;
  peakInvestmentAmount: number | null;
  nearTermExpenseYears?: string | null;
};
type ReportPrimaryFeeSignal = { price: number | null; increase: number | null };

type ReportsPreviewColumnProps = {
  activeVariant: ReportVariantOption;
  assumptionLabelByKey: (key: string) => string;
  baselineDatasetSourceLabel: (
    source: V2BaselineSourceSummary['financials']['source'],
    provenance: V2OverrideProvenance | null,
  ) => string;
  baselineStatusLabel: (
    status: V2BaselineSourceSummary['sourceStatus'],
    planningRole?: V2BaselineSourceSummary['planningRole'],
  ) => string;
  canDownloadPdf: boolean;
  dataTypeLabel: (dataType: string) => string;
  datasetPublicationNote: (dataset: V2BaselineSourceSummary['financials']) => string;
  downloadingPdf: boolean;
  emptyStateReportReadinessHint: string;
  formatAssumptionSnapshotValue: (key: string, value: number) => string;
  handleDownloadPdf: () => void;
  hasSelectedReportLayout: boolean;
  loadingDetail: boolean;
  onGoToForecast: (scenarioId?: string | null) => void;
  previewVariant: V2ReportDetail['variant'];
  reportNearTermExpenseLabel: string;
  reportVariantLabel: (variant: V2ReportDetail['variant']) => string;
  reports: V2ReportListItem[];
  selectedAcceptedBaselineYearsLabel: string;
  selectedBaselineSourceSummaries: V2BaselineSourceSummary[];
  selectedInvestmentSummary: {
    coverageLabel?: string;
    peakYear: number | null;
    peakAmount: number | null;
  } | null;
  selectedPreviewTitle: string | null;
  selectedPrimaryBaselineSourceSummary: V2BaselineSourceSummary | null;
  selectedReport: V2ReportDetail | null;
  selectedReportExportHint: string | null;
  selectedReportGeneratedAt: string;
  selectedReportPrimaryFeeSignal: ReportPrimaryFeeSignal | null;
  selectedReportScenarioName: string;
  selectedScenarioBranchLabel: string;
  selectedScenarioHorizonLabel: string;
  selectedTariffAssumptionRows: TariffAssumptionRow[];
  selectedTariffDriverSummary: TariffDriverSummary | null;
  selectedVesinvestAppendix: V2ReportDetail['snapshot']['vesinvestAppendix'] | null;
  setPreviewVariant: (variant: V2ReportDetail['variant']) => void;
  showDetailedInvestmentPlan: boolean;
  t: TFunction;
};

export const ReportsPreviewColumn: React.FC<ReportsPreviewColumnProps> = ({
  activeVariant,
  assumptionLabelByKey,
  baselineDatasetSourceLabel,
  baselineStatusLabel,
  canDownloadPdf,
  dataTypeLabel,
  datasetPublicationNote,
  downloadingPdf,
  emptyStateReportReadinessHint,
  formatAssumptionSnapshotValue,
  handleDownloadPdf,
  hasSelectedReportLayout,
  loadingDetail,
  onGoToForecast,
  previewVariant,
  reportNearTermExpenseLabel,
  reportVariantLabel,
  reports,
  selectedAcceptedBaselineYearsLabel,
  selectedBaselineSourceSummaries,
  selectedInvestmentSummary,
  selectedPreviewTitle,
  selectedPrimaryBaselineSourceSummary,
  selectedReport,
  selectedReportExportHint,
  selectedReportGeneratedAt,
  selectedReportPrimaryFeeSignal,
  selectedReportScenarioName,
  selectedScenarioBranchLabel,
  selectedScenarioHorizonLabel,
  selectedTariffAssumptionRows,
  selectedTariffDriverSummary,
  selectedVesinvestAppendix,
  setPreviewVariant,
  showDetailedInvestmentPlan,
  t,
}) => (
  <div className="v2-reports-preview-column">
    <section
      className={`v2-card v2-reports-preview-card${
        hasSelectedReportLayout ? ' v2-reports-preview-card-primary' : ''
      }`}
    >
      <div className="v2-section-header v2-reports-preview-head">
        <div className="v2-reports-section-copy">
          <h2>{t('v2Reports.selectedReportTitle', 'Selected report')}</h2>
          {selectedReport ? (
            <p className="v2-muted">{selectedPreviewTitle}</p>
          ) : (
            <p className="v2-muted">{t('v2Reports.selectFromList')}</p>
          )}
        </div>
      </div>

      {loadingDetail ? (
        <div className="v2-loading-state v2-report-loading-card">
          <p className="v2-muted">
            {t(
              'v2Reports.loadingDetailHint',
              'Loading the saved report snapshot and export state.',
            )}
          </p>
          <span className="v2-skeleton-line" />
          <span className="v2-skeleton-line" />
          <span className="v2-skeleton-line" />
          <span className="v2-skeleton-line" />
        </div>
      ) : null}
      {!loadingDetail && !selectedReport ? (
        <div className="v2-empty-state">
          <p>{t('v2Reports.selectFromList')}</p>
          <p className="v2-muted">
            {reports.length === 0
              ? emptyStateReportReadinessHint
              : t('v2Reports.emptyHint')}
          </p>
        </div>
      ) : null}

      {selectedReport ? (
        <>
          <article className="v2-reports-document-header">
            <div className="v2-reports-document-header-top">
              <div className="v2-reports-document-copy">
                <h3>{selectedPreviewTitle}</h3>
                <p className="v2-muted">{selectedReportScenarioName}</p>
              </div>
              <div className="v2-badge-row">
                <span className="v2-badge v2-status-info">
                  {reportVariantLabel(selectedReport.variant)}
                </span>
                <span className="v2-badge v2-status-neutral">
                  {selectedReportGeneratedAt}
                </span>
              </div>
            </div>

            <div className="v2-reports-document-meta">
              <article>
                <span>{t('v2Reports.generatedAtLabel', 'Generated')}</span>
                <strong>{selectedReportGeneratedAt}</strong>
              </article>
              <article>
                <span>{t('projection.scenario', 'Scenario')}</span>
                <strong>{selectedReportScenarioName}</strong>
              </article>
              <article>
                <span>{t('v2Reports.acceptedBaselineYears', 'Accepted baseline years')}</span>
                <strong>{selectedAcceptedBaselineYearsLabel}</strong>
              </article>
              <article>
                <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                <strong>{selectedScenarioHorizonLabel}</strong>
              </article>
            </div>

            <div className="v2-actions-row v2-reports-document-actions">
              <div className="v2-reports-document-status">
                <strong>{reportVariantLabel(selectedReport.variant)}</strong>
                {selectedReportExportHint ? (
                  <p className="v2-muted">{selectedReportExportHint}</p>
                ) : null}
              </div>
              <div className="v2-reports-document-action-buttons">
                <button
                  className="v2-btn v2-btn-primary"
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={!canDownloadPdf}
                >
                  {downloadingPdf
                    ? t('v2Reports.downloadingPdf', 'Downloading PDF...')
                    : t('v2Reports.downloadPdf')}
                </button>
                <button
                  className="v2-btn"
                  type="button"
                  onClick={() => onGoToForecast(selectedReport.ennuste.id)}
                >
                  {t('v2Reports.openForecast')}
                </button>
              </div>
            </div>
          </article>

          <div className="v2-grid v2-grid-two v2-reports-preview-grid">
            <article className="v2-subcard v2-reports-panel-card v2-reports-meta-card">
              <div className="v2-keyvalue-list">
                {selectedReport.snapshot.vesinvestPlan ? (
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Vesinvest.planSelector', 'Plan revision')}</span>
                    <strong>{`${selectedReport.snapshot.vesinvestPlan.name} / v${selectedReport.snapshot.vesinvestPlan.versionNumber}`}</strong>
                  </div>
                ) : null}
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.scenarioTypeLabel', 'Branch type')}</span>
                  <strong>{selectedScenarioBranchLabel}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                  <strong>{selectedScenarioHorizonLabel}</strong>
                </div>
                {selectedPrimaryBaselineSourceSummary ? (
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Reports.previewBaselineStatus', 'Baseline source')}</span>
                    <strong>
                      {baselineStatusLabel(
                        selectedPrimaryBaselineSourceSummary.sourceStatus,
                        selectedPrimaryBaselineSourceSummary.planningRole,
                      )}
                    </strong>
                  </div>
                ) : null}
                {selectedPrimaryBaselineSourceSummary ? (
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Reports.previewFinancialSource', 'Financials source')}</span>
                    <strong>
                      {baselineDatasetSourceLabel(
                        selectedPrimaryBaselineSourceSummary.financials.source,
                        selectedPrimaryBaselineSourceSummary.financials.provenance,
                      )}
                    </strong>
                  </div>
                ) : null}
              </div>
            </article>

            <section className="v2-subcard v2-report-variant-card">
              <div className="v2-section-header">
                <div className="v2-reports-section-copy">
                  <h3>{t('v2Reports.variantTitle')}</h3>
                  <p className="v2-muted">
                    {t(activeVariant.descriptionKey, activeVariant.description)}
                  </p>
                </div>
                <div className="v2-badge-row">
                  <span className="v2-badge v2-status-info">
                    {reportVariantLabel(activeVariant.id)}
                  </span>
                </div>
              </div>
              <div className="v2-report-variant-grid">
                {REPORT_VARIANT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`v2-report-variant-option ${
                      previewVariant === option.id ? 'active' : ''
                    }`}
                    onClick={() => setPreviewVariant(option.id)}
                    aria-pressed={previewVariant === option.id}
                    aria-label={t(option.labelKey, option.label)}
                  >
                    <div className="v2-report-variant-option-head">
                      <strong>{t(option.labelKey, option.label)}</strong>
                      <div className="v2-badge-row">
                        {previewVariant === option.id ? (
                          <span className="v2-badge v2-status-info">
                            {t('v2Reports.previewTitle')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="v2-report-variant-sections">
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.sectionBaselineSources', 'Baseline sources')}</span>
                        <strong>{option.sections.baselineSources ? t('common.yes', 'Yes') : t('common.no', 'No')}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Vesinvest.investmentPlan', 'Investment plan')}</span>
                        <strong>{option.sections.investmentPlan ? t('common.yes', 'Yes') : t('common.no', 'No')}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.sectionAssumptions', 'Assumptions appendix')}</span>
                        <strong>{option.sections.assumptions ? t('common.yes', 'Yes') : t('common.no', 'No')}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.sectionInvestments', 'Yearly investments')}</span>
                        <strong>{option.sections.yearlyInvestments ? t('common.yes', 'Yes') : t('common.no', 'No')}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.sectionRiskSummary', 'Risk summary')}</span>
                        <strong>{option.sections.riskSummary ? t('common.yes', 'Yes') : t('common.no', 'No')}</strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <article className="v2-kpi-strip v2-reports-secondary-kpis">
              <div>
                <h3>{t('v2Forecast.requiredPriceCumulativeCash', 'Required price today (cumulative cash >= 0)')}</h3>
                <p>
                  {formatPrice(
                    selectedReport.snapshot.scenario.requiredPriceTodayCombinedCumulativeCash ??
                      selectedReport.requiredPriceToday,
                  )}
                </p>
              </div>
              <div>
                <h3>{t('v2Forecast.requiredIncreaseCumulativeCash', 'Required increase vs comparator (cumulative cash)')}</h3>
                <p>
                  {formatPercent(
                    selectedReport.snapshot.scenario.requiredAnnualIncreasePctCumulativeCash ??
                      selectedReport.requiredAnnualIncreasePct,
                  )}
                </p>
              </div>
              <div>
                <h3>{t('v2Forecast.latestComparatorPrice', 'Latest full-year comparator price')}</h3>
                <p>
                  {formatPrice(
                    selectedReport.snapshot.scenario.baselinePriceTodayCombined ??
                      selectedReport.requiredPriceToday,
                  )}
                </p>
                <small>
                  {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                  {selectedReport.snapshot.scenario.baselineYear ?? selectedReport.baselineYear}
                </small>
              </div>
            </article>

            {activeVariant.sections.baselineSources &&
            selectedBaselineSourceSummaries.length > 0 ? (
              <article className="v2-subcard v2-reports-panel-card">
                <h3>{t('v2Reports.baselineSourcesTitle')}</h3>
                {selectedBaselineSourceSummaries.map((summary) => (
                  <React.Fragment key={summary.year}>
                    <div className="v2-reports-provenance-summary">
                      <div>
                        <span>{t('projection.v2.baselineYearLabel', 'Baseline year')}</span>
                        <strong>{summary.year}</strong>
                      </div>
                      <div>
                        <span>{t('v2Reports.colVariant', 'Variant')}</span>
                        <strong>{baselineStatusLabel(summary.sourceStatus, summary.planningRole)}</strong>
                      </div>
                      <div>
                        <span>{t('v2Reports.baselineSourceVeeti', 'VEETI')}</span>
                        <strong>{summary.sourceBreakdown.veetiDataTypes.map(dataTypeLabel).join(', ') || t('common.no', 'No')}</strong>
                      </div>
                      <div>
                        <span>{t('v2Reports.baselineSourceManual', 'Manual review')}</span>
                        <strong>{summary.sourceBreakdown.manualDataTypes.map(dataTypeLabel).join(', ') || t('common.no', 'No')}</strong>
                      </div>
                    </div>
                    <details className="v2-reports-provenance-details">
                      <summary>{t('v2Overview.yearTechnicalDetailsSummary', 'Technical source details')}</summary>
                      <div className="v2-reports-provenance-grid">
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>{t('v2Reports.baselineFinancials', 'Financials')}</span>
                            <strong>{baselineDatasetSourceLabel(summary.financials.source, summary.financials.provenance)}</strong>
                          </div>
                          <p className="v2-muted">{datasetPublicationNote(summary.financials)}</p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                            <strong>{baselineDatasetSourceLabel(summary.prices.source, summary.prices.provenance)}</strong>
                          </div>
                          <p className="v2-muted">{datasetPublicationNote(summary.prices)}</p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>{t('v2Reports.baselineVolumes', 'Sold volumes')}</span>
                            <strong>{baselineDatasetSourceLabel(summary.volumes.source, summary.volumes.provenance)}</strong>
                          </div>
                          <p className="v2-muted">{datasetPublicationNote(summary.volumes)}</p>
                        </article>
                      </div>
                    </details>
                  </React.Fragment>
                ))}
              </article>
            ) : null}

            {selectedTariffDriverSummary ? (
              <article className="v2-subcard v2-reports-panel-card">
                <h3>{t('v2Forecast.tariffDriversTitle', 'Why this price')}</h3>
                <div className="v2-keyvalue-list v2-reports-investment-list">
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Reports.requiredCombinedPriceToday', 'Required combined price today')}</span>
                    <strong>{formatPrice(selectedReportPrimaryFeeSignal?.price ?? null)}</strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Reports.requiredCombinedIncreaseFromCurrent', 'Required increase from current combined price')}</span>
                    <strong>{formatPercent(selectedReportPrimaryFeeSignal?.increase ?? null)}</strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Vesinvest.baselineYearVolume', 'Combined sold volume')}</span>
                    <strong>
                      {selectedTariffDriverSummary.baselineSoldVolume != null
                        ? formatNumber(selectedTariffDriverSummary.baselineSoldVolume, 0)
                        : '-'}
                    </strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</span>
                    <strong>
                      {selectedTariffDriverSummary.openingDepreciation != null
                        ? formatEur(selectedTariffDriverSummary.openingDepreciation)
                        : '-'}
                    </strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.investmentPeakAnnualTotal', 'Peak annual investment total')}</span>
                    <strong>
                      {selectedTariffDriverSummary.peakInvestmentYear != null &&
                      selectedTariffDriverSummary.peakInvestmentAmount != null
                        ? `${selectedTariffDriverSummary.peakInvestmentYear} · ${formatEur(selectedTariffDriverSummary.peakInvestmentAmount)}`
                        : '-'}
                    </strong>
                  </div>
                  {selectedTariffDriverSummary.nearTermExpenseYears ? (
                    <div className="v2-keyvalue-row">
                      <span>{reportNearTermExpenseLabel}</span>
                      <strong>{selectedTariffDriverSummary.nearTermExpenseYears}</strong>
                    </div>
                  ) : null}
                  {selectedTariffAssumptionRows.map((row) => (
                    <div key={row.key} className="v2-keyvalue-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}

            {activeVariant.sections.assumptions ? (
              <article className="v2-subcard v2-reports-panel-card">
                <h3>{t('v2Reports.assumptionsSnapshot')}</h3>
                <div className="v2-reports-assumption-grid">
                  {Object.entries(selectedReport.snapshot.scenario.assumptions)
                    .filter(([key]) => key !== '__scenarioTypeCode')
                    .map(([key, value]) => (
                      <div key={key} className="v2-reports-assumption-item">
                        <span>{assumptionLabelByKey(key)}</span>
                        <strong>{formatAssumptionSnapshotValue(key, value)}</strong>
                      </div>
                    ))}
                  {selectedReport.snapshot.scenario.nearTermExpenseAssumptions.map((row) => (
                    <div key={`near-term-${row.year}`} className="v2-reports-assumption-item">
                      <span>{`${reportNearTermExpenseLabel} ${row.year}`}</span>
                      <strong>{`${formatPercent(row.personnelPct)} / ${formatPercent(row.energyPct)} / ${formatPercent(row.opexOtherPct)}`}</strong>
                    </div>
                  ))}
                  <div className="v2-reports-assumption-item">
                    <span>{t('v2Forecast.planningInputsEditableSummary', 'Near-term expenses, investments, and depreciation')}</span>
                    <strong>{`${formatPercent(selectedReport.snapshot.scenario.thereafterExpenseAssumptions.personnelPct)} / ${formatPercent(selectedReport.snapshot.scenario.thereafterExpenseAssumptions.energyPct)} / ${formatPercent(selectedReport.snapshot.scenario.thereafterExpenseAssumptions.opexOtherPct)}`}</strong>
                  </div>
                </div>
              </article>
            ) : null}

            {activeVariant.sections.investmentPlan ? (
              <article className="v2-subcard v2-reports-panel-card">
                <h3>{t('v2Vesinvest.investmentPlan', 'Investment plan')}</h3>
                <div className="v2-reports-investment-summary">
                  <div>
                    <span>{t('v2Reports.investmentYearsCovered', 'Years covered')}</span>
                    <strong>{selectedInvestmentSummary?.coverageLabel ?? '-'}</strong>
                  </div>
                  <div>
                    <span>{t('v2Forecast.totalInvestments', 'Total investments')}</span>
                    <strong>{formatEur(selectedReport.totalInvestments)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Reports.investmentPeakYear', 'Peak year')}</span>
                    <strong>
                      {selectedInvestmentSummary?.peakYear != null &&
                      selectedInvestmentSummary.peakAmount != null
                        ? `${selectedInvestmentSummary.peakYear} · ${formatEur(selectedInvestmentSummary.peakAmount)}`
                        : '-'}
                    </strong>
                  </div>
                </div>
                {showDetailedInvestmentPlan && selectedVesinvestAppendix?.yearlyTotals?.length ? (
                  <>
                    <h4>{t('v2Forecast.investmentAnnualTable', 'Full annual table')}</h4>
                    <div className="v2-keyvalue-list v2-reports-investment-list">
                      {selectedVesinvestAppendix.yearlyTotals.map((row) => (
                        <div key={row.year} className="v2-keyvalue-row">
                          <span>{row.year}</span>
                          <strong>{formatEur(row.totalAmount)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {selectedVesinvestAppendix?.fiveYearBands?.length ? (
                  <>
                    <h4>{t('v2Vesinvest.fiveYearBands', 'Five-year bands')}</h4>
                    <div className="v2-keyvalue-list v2-reports-investment-list">
                      {selectedVesinvestAppendix.fiveYearBands.map((band) => (
                        <div key={`${band.startYear}-${band.endYear}`} className="v2-keyvalue-row">
                          <span>{`${band.startYear}-${band.endYear}`}</span>
                          <strong>{formatEur(band.totalAmount)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                {selectedVesinvestAppendix?.groupedProjects?.length ? (
                  <>
                    <h4>{t('v2Vesinvest.investmentPlan', 'Investment plan')}</h4>
                    <div className="v2-vesinvest-table-wrap">
                      {showDetailedInvestmentPlan ? (
                        <table className="v2-vesinvest-table">
                          <thead>
                            <tr>
                              <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                              <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                              <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
                              <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedVesinvestAppendix.groupedProjects.map((group) => (
                              <React.Fragment key={group.classKey}>
                                <tr className="v2-vesinvest-matrix-group-row">
                                  <td />
                                  <td>{resolveVesinvestGroupLabel(t, group.classKey, group.classLabel)}</td>
                                  <td />
                                  <td>{formatEur(group.totalAmount)}</td>
                                </tr>
                                {group.projects.map((project) => (
                                  <tr key={`${group.classKey}-${project.code}`}>
                                    <td>{project.code}</td>
                                    <td>{project.name}</td>
                                    <td>{project.accountKey ?? '-'}</td>
                                    <td>{formatEur(project.totalAmount)}</td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="v2-vesinvest-table">
                          <thead>
                            <tr>
                              <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                              <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedVesinvestAppendix.groupedProjects.map((group) => (
                              <tr key={`summary-${group.classKey}`}>
                                <td>{resolveVesinvestGroupLabel(t, group.classKey, group.classLabel)}</td>
                                <td>{formatEur(group.totalAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                ) : null}
                {showDetailedInvestmentPlan &&
                selectedVesinvestAppendix?.depreciationPlan?.length ? (
                  <>
                    <h4>{t('v2Vesinvest.depreciationPlan', 'Depreciation plan')}</h4>
                    <div className="v2-vesinvest-table-wrap">
                      <table className="v2-vesinvest-table">
                        <thead>
                          <tr>
                            <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                            <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
                            <th>{t('v2Vesinvest.allocationSummary', 'Service split')}</th>
                            <th>{t('v2Forecast.method', 'Method')}</th>
                            <th>{t('v2Vesinvest.writeOffTime', 'Write-off time')}</th>
                            <th>{t('v2Vesinvest.residualShare', 'Residual share')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVesinvestAppendix.depreciationPlan.map((row) => (
                            <tr key={`depreciation-plan-${row.classKey}`}>
                              <td>{resolveVesinvestGroupLabel(t, row.classKey, row.classLabel)}</td>
                              <td>{row.accountKey ?? '-'}</td>
                              <td>{formatServiceSplitLabel(row.serviceSplit, t)}</td>
                              <td>
                                {formatDepreciationMethod(
                                  {
                                    method: row.method,
                                    linearYears: row.linearYears,
                                    residualPercent: row.residualPercent,
                                  },
                                  t,
                                ) ?? '-'}
                              </td>
                              <td>{row.linearYears == null ? '-' : row.linearYears}</td>
                              <td>{row.residualPercent == null ? '-' : formatPercent(row.residualPercent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </article>
            ) : null}
            {activeVariant.sections.yearlyInvestments ? (
              <article className="v2-subcard v2-reports-panel-card">
                <h3>{t('v2Reports.yearlyInvestmentsSnapshot')}</h3>
                <div className="v2-keyvalue-list v2-reports-investment-list">
                  {selectedReport.snapshot.scenario.yearlyInvestments.map((item, index) => {
                    const snapshotLabel = resolveVesinvestGroupLabel(
                      t,
                      item.depreciationRuleSnapshot?.assetClassKey ??
                        item.depreciationClassKey ??
                        null,
                      item.depreciationRuleSnapshot?.assetClassName ??
                        item.depreciationRuleSnapshot?.assetClassKey ??
                        item.depreciationClassKey ??
                        null,
                    );
                    const snapshotMethod = formatInvestmentSnapshotMethod(item, t);
                    const investmentKey = [
                      item.year,
                      item.depreciationRuleSnapshot?.assetClassKey ??
                        item.depreciationClassKey ??
                        'uncategorized',
                      item.amount,
                      index,
                    ].join('-');
                    return (
                      <div key={investmentKey} className="v2-keyvalue-row">
                        <div>
                          <span>{item.year}</span>
                          {snapshotLabel ? <div className="v2-muted">{snapshotLabel}</div> : null}
                          {snapshotMethod ? <div className="v2-muted">{snapshotMethod}</div> : null}
                        </div>
                        <strong>{formatEur(item.amount)}</strong>
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  </div>
);
