import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  downloadReportPdfV2,
  getReportV2,
  listReportsV2,
  type V2ReportDetail,
  type V2ReportListItem,
} from '../api';
import {
  formatDateTime,
  formatEur,
  formatNumber,
  formatPercent,
  formatPrice,
} from './format';

type Props = {
  refreshToken: number;
  focusedReportId: string | null;
  onGoToForecast: () => void;
};

type ReportVariant = 'public_summary' | 'confidential_appendix';

const REPORT_VARIANT_OPTIONS: Array<{
  id: ReportVariant;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
  sections: {
    baselineSources: boolean;
    assumptions: boolean;
    yearlyInvestments: boolean;
    riskSummary: boolean;
  };
}> = [
  {
    id: 'public_summary',
    labelKey: 'v2Reports.variantPublic',
    label: 'Public summary',
    descriptionKey: 'v2Reports.variantPublicHint',
    description:
      'Shows fee, risk, and baseline context without the detailed assumption and investment appendix.',
    sections: {
      baselineSources: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    },
  },
  {
    id: 'confidential_appendix',
    labelKey: 'v2Reports.variantConfidential',
    label: 'Confidential appendix',
    descriptionKey: 'v2Reports.variantConfidentialHint',
    description:
      'Includes the detailed assumptions and yearly investment appendix alongside the summary.',
    sections: {
      baselineSources: true,
      assumptions: true,
      yearlyInvestments: true,
      riskSummary: true,
    },
  },
];

const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  investointikerroin: 'assumptions.investmentFactor',
};

export const ReportsPageV2: React.FC<Props> = ({
  refreshToken,
  focusedReportId,
  onGoToForecast,
}) => {
  const { t } = useTranslation();
  const [reports, setReports] = React.useState<V2ReportListItem[]>([]);
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(
    null,
  );
  const [selectedReport, setSelectedReport] =
    React.useState<V2ReportDetail | null>(null);
  const [scenarioFilter, setScenarioFilter] = React.useState<string>('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewVariant, setPreviewVariant] =
    React.useState<ReportVariant>('confidential_appendix');

  const loadReports = React.useCallback(
    async (preferredReportId?: string, forceRefresh = false) => {
      setLoadingList(true);
      setError(null);
      try {
        const rows = await listReportsV2(scenarioFilter || undefined, {
          force: forceRefresh,
        });
        setReports(rows);
        setSelectedReportId((current) => {
          if (
            preferredReportId &&
            rows.some((row) => row.id === preferredReportId)
          ) {
            return preferredReportId;
          }
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Reports.errorLoadListFailed', 'Failed to load reports.'),
        );
      } finally {
        setLoadingList(false);
      }
    },
    [scenarioFilter, t],
  );

  React.useEffect(() => {
    loadReports(focusedReportId ?? undefined);
  }, [loadReports, refreshToken, focusedReportId]);

  React.useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const detail = await getReportV2(selectedReportId);
        if (!cancelled) setSelectedReport(detail);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('v2Reports.errorLoadDetailFailed', 'Failed to load report.'),
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedReportId, t]);

  React.useEffect(() => {
    if (!selectedReport) return;
    setPreviewVariant(selectedReport.variant);
  }, [selectedReport]);

  const scenarioOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of reports) {
      if (!map.has(row.ennuste.id)) {
        map.set(row.ennuste.id, row.ennuste.nimi ?? row.ennuste.id);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [reports]);

  const assumptionLabelByKey = React.useCallback(
    (key: string) => t(ASSUMPTION_LABEL_KEYS[key] ?? key, key),
    [t],
  );

  const baselineDatasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance:
        | {
            kind: 'manual_edit' | 'statement_import';
            fileName: string | null;
          }
        | null
        | undefined,
    ) => {
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineSourceStatementImport',
          'Statement import ({{fileName}})',
          {
            fileName:
              provenance.fileName ??
              t('v2Reports.statementImportFallbackFile', 'bokslut PDF'),
          },
        );
      }
      if (source === 'manual') {
        return t('v2Reports.baselineSourceManual', 'Manual review');
      }
      if (source === 'veeti') {
        return t('v2Reports.baselineSourceVeeti', 'VEETI');
      }
      return t('v2Reports.baselineSourceMissing', 'Missing');
    },
    [t],
  );

  const handleDownloadPdf = React.useCallback(async () => {
    if (!selectedReport) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const { blob, filename } = await downloadReportPdfV2(selectedReport.id);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;

      setError(
        status && status >= 500
          ? t(
              'v2Reports.errorDownloadPdfUnavailable',
              'PDF export is temporarily unavailable. Please try again later.',
            )
          : err instanceof Error && err.message
          ? err.message
          : t('v2Reports.errorDownloadPdfFailed', 'Failed to download PDF.'),
      );
    } finally {
      setDownloadingPdf(false);
    }
  }, [selectedReport, t]);

  const activeVariant = React.useMemo(
    () =>
      REPORT_VARIANT_OPTIONS.find((option) => option.id === previewVariant) ??
      REPORT_VARIANT_OPTIONS[1],
    [previewVariant],
  );

  const downloadMatchesPreview =
    selectedReport != null ? selectedReport.variant === previewVariant : true;

  return (
    <div className="v2-page reports-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section className="v2-card">
        <div className="v2-section-header">
          <h2>{t('v2Reports.title', 'Reports')}</h2>
          <div className="v2-inline-form">
            <label className="v2-field">
              <span>{t('projection.scenario', 'Scenario')}</span>
              <select
                id="v2-reports-scenario-filter"
                className="v2-input"
                name="scenarioFilter"
                value={scenarioFilter}
                onChange={(event) => setScenarioFilter(event.target.value)}
              >
                <option value="">{t('v2Reports.allScenarios', 'All')}</option>
                {scenarioOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="v2-btn"
              onClick={() => loadReports(undefined, true)}
              disabled={loadingList}
            >
              {t('v2Reports.refreshList', 'Refresh list')}
            </button>
          </div>
        </div>

        {loadingList ? (
          <p>{t('v2Reports.loadingList', 'Loading reports...')}</p>
        ) : null}
        {!loadingList && reports.length === 0 ? (
          <div className="v2-empty-state">
            <p>{t('v2Reports.empty', 'No reports found.')}</p>
            <p className="v2-muted">
              {t(
                'v2Reports.emptyHint',
                'Open Forecast, compute a scenario, and create your first report.',
              )}
            </p>
            <button
              type="button"
              className="v2-btn v2-btn-primary"
              onClick={onGoToForecast}
            >
              {t('v2Reports.openForecast', 'Open Forecast')}
            </button>
          </div>
        ) : null}

        {reports.length > 0 ? (
          <div className="v2-report-table">
            <div className="v2-report-row v2-report-row-head">
              <span>{t('v2Reports.colCreated', 'Created')}</span>
              <span>{t('projection.scenario', 'Scenario')}</span>
              <span>{t('v2Reports.colVariant', 'Variant')}</span>
              <span>
                {t('projection.v2.baselineYearLabel', 'Baseline year')}
              </span>
              <span>
                {t('projection.summary.requiredTariff', 'Required price')}
              </span>
              <span>
                {t('v2Forecast.requiredIncreaseFromToday', 'Required increase')}
              </span>
              <span>{t('v2Forecast.totalInvestments', 'Investments')}</span>
            </div>
            {reports.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`v2-report-row ${
                  selectedReportId === row.id ? 'active' : ''
                }`}
                onClick={() => setSelectedReportId(row.id)}
              >
                <span>{formatDateTime(row.createdAt)}</span>
                <span>{row.ennuste.nimi ?? row.ennuste.id}</span>
                <span>
                  {t(
                    row.variant === 'public_summary'
                      ? 'v2Reports.variantPublic'
                      : 'v2Reports.variantConfidential',
                    row.variant === 'public_summary'
                      ? 'Public summary'
                      : 'Confidential appendix',
                  )}
                </span>
                <span>{row.baselineYear}</span>
                <span>{formatPrice(row.requiredPriceToday)}</span>
                <span>{formatPercent(row.requiredAnnualIncreasePct)}</span>
                <span>{formatEur(row.totalInvestments)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="v2-card">
        <h2>{t('v2Reports.previewTitle', 'Report preview')}</h2>
        {loadingDetail ? (
          <p>{t('v2Reports.loadingDetail', 'Loading report...')}</p>
        ) : null}
        {!loadingDetail && !selectedReport ? (
          <p>
            {t('v2Reports.selectFromList', 'Select a report from the list.')}
          </p>
        ) : null}

        {selectedReport ? (
          <>
            <article className="v2-kpi-strip">
              <div>
                <h3>
                  {t(
                    'v2Forecast.requiredPriceAnnualResult',
                    'Required price today (annual result = 0)',
                  )}
                </h3>
                <p>
                  {formatPrice(
                    selectedReport.snapshot.scenario
                      .requiredPriceTodayCombinedAnnualResult ??
                      selectedReport.requiredPriceToday,
                  )}
                </p>
              </div>
              <div>
                <h3>
                  {t(
                    'v2Forecast.requiredIncreaseAnnualResult',
                    'Required increase vs comparator (annual result)',
                  )}
                </h3>
                <p>
                  {formatPercent(
                    selectedReport.snapshot.scenario
                      .requiredAnnualIncreasePctAnnualResult ??
                      selectedReport.requiredAnnualIncreasePct,
                  )}
                </p>
              </div>
              <div>
                <h3>
                  {t(
                    'v2Forecast.requiredPriceCumulativeCash',
                    'Required price today (cumulative cash >= 0)',
                  )}
                </h3>
                <p>
                  {formatPrice(
                    selectedReport.snapshot.scenario
                      .requiredPriceTodayCombinedCumulativeCash ??
                      selectedReport.requiredPriceToday,
                  )}
                </p>
              </div>
              <div>
                <h3>
                  {t(
                    'v2Forecast.requiredIncreaseCumulativeCash',
                    'Required increase vs comparator (cumulative cash)',
                  )}
                </h3>
                <p>
                  {formatPercent(
                    selectedReport.snapshot.scenario
                      .requiredAnnualIncreasePctCumulativeCash ??
                      selectedReport.requiredAnnualIncreasePct,
                  )}
                </p>
              </div>
              <div>
                <h3>
                  {t(
                    'v2Forecast.latestComparatorPrice',
                    'Latest full-year comparator price',
                  )}
                </h3>
                <p>
                  {formatPrice(
                    selectedReport.snapshot.scenario
                      .baselinePriceTodayCombined ??
                      selectedReport.requiredPriceToday,
                  )}
                </p>
                <small>
                  {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                  {selectedReport.snapshot.scenario.baselineYear ??
                    selectedReport.baselineYear}
                </small>
              </div>
              <div>
                <h3>{t('v2Forecast.totalInvestments', 'Total investments')}</h3>
                <p>{formatEur(selectedReport.totalInvestments)}</p>
              </div>
            </article>

            <div className="v2-actions-row">
              <div className="v2-variant-toggle" role="tablist">
                {REPORT_VARIANT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`v2-btn ${
                      previewVariant === option.id ? 'v2-btn-primary' : ''
                    }`}
                    onClick={() => setPreviewVariant(option.id)}
                  >
                    {t(option.labelKey, option.label)}
                  </button>
                ))}
              </div>
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || !downloadMatchesPreview}
                title={
                  !downloadMatchesPreview
                    ? t(
                        'v2Reports.downloadUsesSavedVariant',
                        'PDF download still uses the saved report variant. Switch back to that variant to export.',
                      )
                    : undefined
                }
              >
                {downloadingPdf
                  ? t('v2Reports.downloadingPdf', 'Downloading PDF...')
                  : t('v2Reports.downloadPdf', 'Download PDF')}
              </button>
            </div>

            <article className="v2-subcard v2-report-variant-card">
              <h3>{t('v2Reports.variantTitle', 'Report variant')}</h3>
              <p className="v2-muted">
                {t(activeVariant.descriptionKey, activeVariant.description)}
              </p>
              <div className="v2-keyvalue-list">
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.sectionBaselineSources', 'Baseline sources')}</span>
                  <strong>
                    {activeVariant.sections.baselineSources
                      ? t('common.yes', 'Yes')
                      : t('common.no', 'No')}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.sectionAssumptions', 'Assumptions appendix')}</span>
                  <strong>
                    {activeVariant.sections.assumptions
                      ? t('common.yes', 'Yes')
                      : t('common.no', 'No')}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.sectionInvestments', 'Yearly investments')}</span>
                  <strong>
                    {activeVariant.sections.yearlyInvestments
                      ? t('common.yes', 'Yes')
                      : t('common.no', 'No')}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.sectionRiskSummary', 'Risk summary')}</span>
                  <strong>
                    {activeVariant.sections.riskSummary
                      ? t('common.yes', 'Yes')
                      : t('common.no', 'No')}
                  </strong>
                </div>
              </div>
            </article>

            <section className="v2-grid v2-grid-two">
              {activeVariant.sections.baselineSources &&
              selectedReport.snapshot.baselineSourceSummary ? (
                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Reports.baselineSourcesTitle',
                      'Baseline data sources',
                    )}
                  </h3>
                  <div className="v2-keyvalue-list">
                    <div className="v2-keyvalue-row">
                      <span>{t('v2Reports.baselineFinancials', 'Financials')}</span>
                      <strong>
                        {baselineDatasetSourceLabel(
                          selectedReport.snapshot.baselineSourceSummary.financials
                            .source,
                          selectedReport.snapshot.baselineSourceSummary.financials
                            .provenance,
                        )}
                      </strong>
                    </div>
                    <div className="v2-keyvalue-row">
                      <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                      <strong>
                        {baselineDatasetSourceLabel(
                          selectedReport.snapshot.baselineSourceSummary.prices
                            .source,
                          selectedReport.snapshot.baselineSourceSummary.prices
                            .provenance,
                        )}
                      </strong>
                    </div>
                    <div className="v2-keyvalue-row">
                      <span>{t('v2Reports.baselineVolumes', 'Sold volumes')}</span>
                      <strong>
                        {baselineDatasetSourceLabel(
                          selectedReport.snapshot.baselineSourceSummary.volumes
                            .source,
                          selectedReport.snapshot.baselineSourceSummary.volumes
                            .provenance,
                        )}
                      </strong>
                    </div>
                  </div>
                  {selectedReport.snapshot.baselineSourceSummary.financials
                    .provenance?.kind === 'statement_import' ? (
                    <p className="v2-muted">
                      {t(
                        'v2Reports.baselineStatementImportDetail',
                        'Financials came from {{fileName}}',
                        {
                          fileName:
                            selectedReport.snapshot.baselineSourceSummary
                              .financials.provenance.fileName ??
                            t(
                              'v2Reports.statementImportFallbackFile',
                              'bokslut PDF',
                            ),
                        },
                      )}
                    </p>
                  ) : null}
                </article>
              ) : null}

              {activeVariant.sections.assumptions ? (
                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Reports.assumptionsSnapshot',
                      'Assumptions from snapshot',
                    )}
                  </h3>
                  <div className="v2-keyvalue-list">
                    {Object.entries(
                      selectedReport.snapshot.scenario.assumptions,
                    ).map(([key, value]) => (
                      <div key={key} className="v2-keyvalue-row">
                        <span>{assumptionLabelByKey(key)}</span>
                        <strong>{formatNumber(value, 4)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ) : null}

              {activeVariant.sections.yearlyInvestments ? (
                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Reports.yearlyInvestmentsSnapshot',
                      'Yearly investments from snapshot',
                    )}
                  </h3>
                  <div className="v2-keyvalue-list">
                    {selectedReport.snapshot.scenario.yearlyInvestments.map(
                      (item) => (
                        <div key={item.year} className="v2-keyvalue-row">
                          <span>{item.year}</span>
                          <strong>{formatEur(item.amount)}</strong>
                        </div>
                      ),
                    )}
                  </div>
                </article>
              ) : null}
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
};
