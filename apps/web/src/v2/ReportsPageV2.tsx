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

  const loadReports = React.useCallback(
    async (preferredReportId?: string) => {
      setLoadingList(true);
      setError(null);
      try {
        const rows = await listReportsV2(scenarioFilter || undefined);
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
              onClick={() => loadReports()}
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
            <article className="v2-kpi-strip v2-kpi-strip-three">
              <div>
                <h3>
                  {t(
                    'projection.summary.requiredTariff',
                    'Required price today',
                  )}
                </h3>
                <p>{formatPrice(selectedReport.requiredPriceToday)}</p>
              </div>
              <div>
                <h3>
                  {t(
                    'v2Forecast.requiredIncreaseFromToday',
                    'Required increase from current price',
                  )}
                </h3>
                <p>{formatPercent(selectedReport.requiredAnnualIncreasePct)}</p>
              </div>
              <div>
                <h3>{t('v2Forecast.totalInvestments', 'Total investments')}</h3>
                <p>{formatEur(selectedReport.totalInvestments)}</p>
              </div>
            </article>

            <div className="v2-actions-row">
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf
                  ? t('v2Reports.downloadingPdf', 'Downloading PDF...')
                  : t('v2Reports.downloadPdf', 'Download PDF')}
              </button>
            </div>

            <section className="v2-grid v2-grid-two">
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
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
};
