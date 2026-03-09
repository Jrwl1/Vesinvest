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

  const reportVariantLabel = React.useCallback(
    (variant: ReportVariant) =>
      t(
        variant === 'public_summary'
          ? 'v2Reports.variantPublic'
          : 'v2Reports.variantConfidential',
        variant === 'public_summary'
          ? 'Public summary'
          : 'Confidential appendix',
      ),
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

  const baselineStatusLabel = React.useCallback(
    (status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE') => {
      switch (status) {
        case 'MANUAL':
          return t('v2Reports.baselineStatusManual', 'Manual baseline');
        case 'MIXED':
          return t('v2Reports.baselineStatusMixed', 'Mixed baseline');
        case 'INCOMPLETE':
          return t('v2Reports.baselineStatusIncomplete', 'Incomplete baseline');
        case 'VEETI':
        default:
          return t('v2Reports.baselineStatusVeeti', 'VEETI baseline');
      }
    },
    [t],
  );

  const dataTypeLabel = React.useCallback(
    (dataType: string) => {
      switch (dataType) {
        case 'tilinpaatos':
          return t('v2Reports.baselineFinancials', 'Financials');
        case 'taksa':
          return t('v2Reports.baselinePrices', 'Prices');
        case 'volume_vesi':
          return t('v2Reports.baselineSoldWater', 'Sold water');
        case 'volume_jatevesi':
          return t('v2Reports.baselineSoldWastewater', 'Sold wastewater');
        default:
          return dataType;
      }
    },
    [t],
  );

  const datasetPublicationNote = React.useCallback(
    (dataset: {
      source: 'veeti' | 'manual' | 'none';
      editedAt: string | null;
      reason: string | null;
      provenance:
        | {
            kind: 'manual_edit' | 'statement_import';
            fileName: string | null;
          }
        | null
        | undefined;
    }) => {
      if (dataset.provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineStatementImportDetail',
          'Financials came from {{fileName}}',
          {
            fileName:
              dataset.provenance.fileName ??
              t('v2Reports.statementImportFallbackFile', 'bokslut PDF'),
          },
        );
      }
      if (dataset.source === 'manual' && dataset.reason) {
        return t('v2Reports.baselineManualReason', 'Reason: {{reason}}', {
          reason: dataset.reason,
        });
      }
      if (dataset.source === 'manual' && dataset.editedAt) {
        return t('v2Reports.baselineManualEditedAt', 'Reviewed {{date}}', {
          date: formatDateTime(dataset.editedAt),
        });
      }
      if (dataset.source === 'veeti') {
        return t(
          'v2Reports.baselineSourceVeetiHint',
          'Current report snapshot follows VEETI for this dataset.',
        );
      }
      return t(
        'v2Reports.baselineSourceMissingHint',
        'No trusted dataset was available in the saved baseline.',
      );
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

  const selectedListReport = React.useMemo(
    () => reports.find((row) => row.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const selectedInvestmentSummary = React.useMemo(() => {
    if (!selectedReport) return null;
    const items = selectedReport.snapshot.scenario.yearlyInvestments;
    if (items.length === 0) {
      return {
        count: 0,
        firstYear: null as number | null,
        peakYear: null as number | null,
        peakAmount: 0,
      };
    }
    const peak = items.reduce((current, item) =>
      item.amount > current.amount ? item : current,
    );
    return {
      count: items.length,
      firstYear: items[0]?.year ?? null,
      peakYear: peak.year,
      peakAmount: peak.amount,
    };
  }, [selectedReport]);

  const downloadMatchesPreview =
    selectedReport != null ? selectedReport.variant === previewVariant : true;

  return (
    <div className="v2-page reports-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section className="v2-grid v2-reports-layout">
        <div className="v2-reports-list-column">
          <section className="v2-card v2-reports-list-card">
            <div className="v2-section-header v2-reports-list-head">
              <div className="v2-reports-section-copy">
                <p className="v2-overview-eyebrow">
                  {t('v2Reports.title', 'Reports')}
                </p>
                <h2>{t('v2Reports.title', 'Reports')}</h2>
                <p className="v2-muted">
                  {t(
                    'v2Reports.emptyHint',
                    'Open Forecast, compute a scenario, and create your first report.',
                  )}
                </p>
              </div>
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
                    <option value="">
                      {t('v2Reports.allScenarios', 'All')}
                    </option>
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

            <div className="v2-reports-list-summary">
              <article>
                <span>{t('v2Reports.title', 'Reports')}</span>
                <strong>{reports.length}</strong>
              </article>
              <article>
                <span>{t('projection.scenario', 'Scenario')}</span>
                <strong>
                  {scenarioFilter
                    ? scenarioOptions.find((option) => option.id === scenarioFilter)
                        ?.name ?? scenarioFilter
                    : t('v2Reports.allScenarios', 'All')}
                </strong>
              </article>
              <article>
                <span>{t('v2Reports.previewTitle', 'Report preview')}</span>
                <strong>
                  {selectedListReport
                    ? selectedListReport.ennuste.nimi ?? selectedListReport.ennuste.id
                    : t('v2Reports.selectFromList', 'Select a report from the list.')}
                </strong>
              </article>
            </div>

            {loadingList ? (
              <div className="v2-loading-state v2-report-loading-card">
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
              </div>
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
              <div className="v2-report-table v2-report-list">
                {selectedListReport ? (
                  <article className="v2-report-list-focus">
                    <div className="v2-report-list-focus-head">
                      <div>
                        <p className="v2-overview-eyebrow">
                          {t('v2Reports.previewTitle', 'Report preview')}
                        </p>
                        <h3>
                          {selectedListReport.ennuste.nimi ??
                            selectedListReport.ennuste.id}
                        </h3>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-badge-base">
                          {reportVariantLabel(selectedListReport.variant)}
                        </span>
                      </div>
                    </div>
                    <div className="v2-report-list-focus-grid">
                      <div>
                        <span>{t('v2Reports.colCreated', 'Created')}</span>
                        <strong>{formatDateTime(selectedListReport.createdAt)}</strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'projection.v2.baselineYearLabel',
                            'Baseline year',
                          )}
                        </span>
                        <strong>{selectedListReport.baselineYear}</strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'projection.summary.requiredTariff',
                            'Required price',
                          )}
                        </span>
                        <strong>
                          {formatPrice(selectedListReport.requiredPriceToday)}
                        </strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'v2Forecast.requiredIncreaseFromToday',
                            'Required increase',
                          )}
                        </span>
                        <strong>
                          {formatPercent(
                            selectedListReport.requiredAnnualIncreasePct,
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                ) : null}

                {reports.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`v2-report-row ${
                      selectedReportId === row.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedReportId(row.id)}
                    aria-pressed={selectedReportId === row.id}
                  >
                    <div className="v2-report-row-top">
                      <div className="v2-report-row-main">
                        <strong>{row.ennuste.nimi ?? row.ennuste.id}</strong>
                        <span>{formatDateTime(row.createdAt)}</span>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-badge-draft">
                          {reportVariantLabel(row.variant)}
                        </span>
                        {selectedReportId === row.id ? (
                          <span className="v2-result-selected">
                            {t('v2Reports.previewTitle', 'Report preview')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="v2-report-row-kpis">
                      <div>
                        <span>
                          {t(
                            'projection.v2.baselineYearLabel',
                            'Baseline year',
                          )}
                        </span>
                        <strong>{row.baselineYear}</strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'projection.summary.requiredTariff',
                            'Required price',
                          )}
                        </span>
                        <strong>{formatPrice(row.requiredPriceToday)}</strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'v2Forecast.requiredIncreaseFromToday',
                            'Required increase',
                          )}
                        </span>
                        <strong>
                          {formatPercent(row.requiredAnnualIncreasePct)}
                        </strong>
                      </div>
                      <div>
                        <span>{t('v2Forecast.totalInvestments', 'Investments')}</span>
                        <strong>{formatEur(row.totalInvestments)}</strong>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="v2-reports-preview-column">
          <section className="v2-card v2-reports-preview-card">
            <div className="v2-section-header v2-reports-preview-head">
              <div className="v2-reports-section-copy">
                <p className="v2-overview-eyebrow">
                  {t('v2Reports.previewTitle', 'Report preview')}
                </p>
                <h2>{t('v2Reports.previewTitle', 'Report preview')}</h2>
                <p className="v2-muted">
                  {selectedReport
                    ? formatDateTime(selectedReport.createdAt)
                    : t(
                        'v2Reports.selectFromList',
                        'Select a report from the list.',
                      )}
                </p>
              </div>
              {selectedReport ? (
                <div className="v2-badge-row">
                  <span className="v2-badge v2-badge-base">
                    {selectedReport.ennuste.nimi ?? selectedReport.ennuste.id}
                  </span>
                  <span className="v2-badge v2-badge-draft">
                    {reportVariantLabel(selectedReport.variant)}
                  </span>
                </div>
              ) : null}
            </div>

            {loadingDetail ? (
              <div className="v2-loading-state v2-report-loading-card">
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
              </div>
            ) : null}
            {!loadingDetail && !selectedReport ? (
              <div className="v2-empty-state">
                <p>
                  {t(
                    'v2Reports.selectFromList',
                    'Select a report from the list.',
                  )}
                </p>
                <p className="v2-muted">
                  {t(
                    'v2Reports.emptyHint',
                    'Open Forecast, compute a scenario, and create your first report.',
                  )}
                </p>
              </div>
            ) : null}

            {selectedReport ? (
              <>
                <section className="v2-reports-preview-hero">
                  <div className="v2-reports-preview-hero-copy">
                    <p className="v2-overview-eyebrow">
                      {t('projection.scenario', 'Scenario')}
                    </p>
                    <h3>
                      {selectedReport.ennuste.nimi ?? selectedReport.ennuste.id}
                    </h3>
                    <p className="v2-muted">
                      {formatDateTime(selectedReport.createdAt)}
                    </p>
                  </div>
                  <div className="v2-reports-preview-primary-kpis">
                    <article>
                      <span>
                        {t(
                          'projection.v2.baselineYearLabel',
                          'Baseline year',
                        )}
                      </span>
                      <strong>{selectedReport.baselineYear}</strong>
                    </article>
                    <article>
                      <span>
                        {t(
                          'v2Forecast.requiredPriceAnnualResult',
                          'Required price today (annual result = 0)',
                        )}
                      </span>
                      <strong>
                        {formatPrice(
                          selectedReport.snapshot.scenario
                            .requiredPriceTodayCombinedAnnualResult ??
                            selectedReport.requiredPriceToday,
                        )}
                      </strong>
                    </article>
                    <article>
                      <span>
                        {t(
                          'v2Forecast.requiredIncreaseAnnualResult',
                          'Required increase vs comparator (annual result)',
                        )}
                      </span>
                      <strong>
                        {formatPercent(
                          selectedReport.snapshot.scenario
                            .requiredAnnualIncreasePctAnnualResult ??
                            selectedReport.requiredAnnualIncreasePct,
                        )}
                      </strong>
                    </article>
                    <article>
                      <span>
                        {t('v2Forecast.totalInvestments', 'Total investments')}
                      </span>
                      <strong>{formatEur(selectedReport.totalInvestments)}</strong>
                    </article>
                  </div>
                </section>

                <article className="v2-kpi-strip v2-reports-secondary-kpis">
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
                </article>

                <div className="v2-actions-row v2-reports-toolbar">
                  <p className="v2-muted">
                    {downloadMatchesPreview
                      ? t(
                          'v2Reports.variantTitle',
                          'Report variant',
                        )
                      : t(
                          'v2Reports.downloadUsesSavedVariant',
                          'PDF download still uses the saved report variant. Switch back to that variant to export.',
                        )}
                  </p>
                  <div className="v2-report-export-panel">
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
                    <span className="v2-muted">
                      {selectedReport.pdfUrl
                        ? t(
                            'v2Reports.exportReady',
                            'Saved report is available for export.',
                          )
                        : t(
                            'v2Reports.errorDownloadPdfUnavailable',
                            'PDF export is temporarily unavailable. Please try again later.',
                          )}
                    </span>
                  </div>
                </div>

                <div className="v2-grid v2-grid-two v2-reports-preview-grid">
                  <article className="v2-subcard v2-reports-panel-card v2-reports-meta-card">
                    <h3>{t('v2Reports.colCreated', 'Created')}</h3>
                    <div className="v2-keyvalue-list">
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.colCreated', 'Created')}</span>
                        <strong>{formatDateTime(selectedReport.createdAt)}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.previewTitle', 'Report preview')}</span>
                        <strong>
                          {formatDateTime(
                            selectedReport.snapshot.generatedAt ??
                              selectedReport.createdAt,
                          )}
                        </strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.variantTitle', 'Report variant')}</span>
                        <strong>
                          {reportVariantLabel(selectedReport.variant)}
                        </strong>
                      </div>
                    </div>
                  </article>

                  <section className="v2-subcard v2-report-variant-card">
                    <div className="v2-section-header">
                      <div className="v2-reports-section-copy">
                        <h3>{t('v2Reports.variantTitle', 'Report variant')}</h3>
                        <p className="v2-muted">
                          {t(
                            activeVariant.descriptionKey,
                            activeVariant.description,
                          )}
                        </p>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-badge-base">
                          {reportVariantLabel(activeVariant.id)}
                        </span>
                        {!downloadMatchesPreview ? (
                          <span className="v2-badge v2-badge-stress">
                            {reportVariantLabel(selectedReport.variant)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className="v2-report-variant-grid"
                      role="tablist"
                      aria-label={t('v2Reports.variantTitle', 'Report variant')}
                    >
                      {REPORT_VARIANT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`v2-report-variant-option ${
                            previewVariant === option.id ? 'active' : ''
                          }`}
                          onClick={() => setPreviewVariant(option.id)}
                          aria-label={t(option.labelKey, option.label)}
                        >
                          <div className="v2-report-variant-option-head">
                            <div>
                              <strong>{t(option.labelKey, option.label)}</strong>
                              <p className="v2-muted">
                                {t(option.descriptionKey, option.description)}
                              </p>
                            </div>
                            <div className="v2-badge-row">
                              {previewVariant === option.id ? (
                                <span className="v2-badge v2-badge-base">
                                  {t('v2Reports.previewTitle', 'Report preview')}
                                </span>
                              ) : null}
                              {selectedReport.variant === option.id ? (
                                <span className="v2-badge v2-badge-draft">
                                  {t('v2Reports.downloadPdf', 'Download PDF')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="v2-report-variant-sections">
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionBaselineSources',
                                  'Baseline sources',
                                )}
                              </span>
                              <strong>
                                {option.sections.baselineSources
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionAssumptions',
                                  'Assumptions appendix',
                                )}
                              </span>
                              <strong>
                                {option.sections.assumptions
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionInvestments',
                                  'Yearly investments',
                                )}
                              </span>
                              <strong>
                                {option.sections.yearlyInvestments
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionRiskSummary',
                                  'Risk summary',
                                )}
                              </span>
                              <strong>
                                {option.sections.riskSummary
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {activeVariant.sections.baselineSources &&
                  selectedReport.snapshot.baselineSourceSummary ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.baselineSourcesTitle',
                          'Baseline data sources',
                        )}
                      </h3>
                      <div className="v2-reports-provenance-summary">
                        <div>
                          <span>
                            {t(
                              'projection.v2.baselineYearLabel',
                              'Baseline year',
                            )}
                          </span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.year}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.colVariant', 'Variant')}</span>
                          <strong>
                            {baselineStatusLabel(
                              selectedReport.snapshot.baselineSourceSummary
                                .sourceStatus,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.baselineSourceVeeti', 'VEETI')}</span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.sourceBreakdown.veetiDataTypes
                              .map(dataTypeLabel)
                              .join(', ') || t('common.no', 'No')}
                          </strong>
                        </div>
                        <div>
                          <span>
                            {t('v2Reports.baselineSourceManual', 'Manual review')}
                          </span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.sourceBreakdown.manualDataTypes
                              .map(dataTypeLabel)
                              .join(', ') || t('common.no', 'No')}
                          </strong>
                        </div>
                      </div>
                      <div className="v2-reports-provenance-grid">
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>
                              {t('v2Reports.baselineFinancials', 'Financials')}
                            </span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary
                                .financials,
                            )}
                          </p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .prices.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .prices.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary.prices,
                            )}
                          </p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>
                              {t('v2Reports.baselineVolumes', 'Sold volumes')}
                            </span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .volumes.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .volumes.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary
                                .volumes,
                            )}
                          </p>
                        </article>
                      </div>
                    </article>
                  ) : null}

                  {activeVariant.sections.assumptions ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.assumptionsSnapshot',
                          'Assumptions from snapshot',
                        )}
                      </h3>
                      <div className="v2-reports-assumption-grid">
                        {Object.entries(
                          selectedReport.snapshot.scenario.assumptions,
                        ).map(([key, value]) => (
                          <div key={key} className="v2-reports-assumption-item">
                            <span>{assumptionLabelByKey(key)}</span>
                            <strong>{formatNumber(value, 4)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  {activeVariant.sections.yearlyInvestments ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.yearlyInvestmentsSnapshot',
                          'Yearly investments from snapshot',
                        )}
                      </h3>
                      <div className="v2-reports-investment-summary">
                        <div>
                          <span>
                            {t('v2Reports.investmentYearsCovered', 'Years covered')}
                          </span>
                          <strong>{selectedInvestmentSummary?.count ?? 0}</strong>
                        </div>
                        <div>
                          <span>
                            {t(
                              'projection.v2.baselineYearLabel',
                              'Baseline year',
                            )}
                          </span>
                          <strong>
                            {selectedInvestmentSummary?.firstYear ?? '-'}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Forecast.totalInvestments', 'Total investments')}</span>
                          <strong>{formatEur(selectedReport.totalInvestments)}</strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.investmentPeakYear', 'Peak year')}</span>
                          <strong>
                            {selectedInvestmentSummary?.peakYear != null
                              ? `${selectedInvestmentSummary.peakYear} · ${formatEur(
                                  selectedInvestmentSummary.peakAmount,
                                )}`
                              : '-'}
                          </strong>
                        </div>
                      </div>
                      <div className="v2-keyvalue-list v2-reports-investment-list">
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
                </div>
              </>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
};
