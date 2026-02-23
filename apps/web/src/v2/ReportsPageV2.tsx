import React from 'react';
import { getReportPdfUrlV2, getReportV2, listReportsV2, type V2ReportDetail, type V2ReportListItem } from '../api';
import { formatEur, formatPercent, formatPrice } from './format';

type Props = {
  refreshToken: number;
  focusedReportId: string | null;
};

export const ReportsPageV2: React.FC<Props> = ({ refreshToken, focusedReportId }) => {
  const [reports, setReports] = React.useState<V2ReportListItem[]>([]);
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(null);
  const [selectedReport, setSelectedReport] = React.useState<V2ReportDetail | null>(null);
  const [scenarioFilter, setScenarioFilter] = React.useState<string>('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReports = React.useCallback(async (preferredReportId?: string) => {
    setLoadingList(true);
    setError(null);
    try {
      const rows = await listReportsV2(scenarioFilter || undefined);
      setReports(rows);
      setSelectedReportId((current) => {
        if (preferredReportId && rows.some((row) => row.id === preferredReportId)) return preferredReportId;
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raporttien lataus epaonnistui.');
    } finally {
      setLoadingList(false);
    }
  }, [scenarioFilter]);

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
          setError(err instanceof Error ? err.message : 'Raportin haku epaonnistui.');
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedReportId]);

  const scenarioOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of reports) {
      if (!map.has(row.ennuste.id)) {
        map.set(row.ennuste.id, row.ennuste.nimi ?? row.ennuste.id);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [reports]);

  return (
    <div className="v2-page reports-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section className="v2-card">
        <div className="v2-section-header">
          <h2>Raportit</h2>
          <div className="v2-inline-form">
            <label className="v2-field">
              <span>Skenaario</span>
              <select
                className="v2-input"
                value={scenarioFilter}
                onChange={(event) => setScenarioFilter(event.target.value)}
              >
                <option value="">Kaikki</option>
                {scenarioOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <button type="button" className="v2-btn" onClick={() => loadReports()} disabled={loadingList}>
              Paivita lista
            </button>
          </div>
        </div>

        {loadingList ? <p>Ladataan raportteja...</p> : null}
        {!loadingList && reports.length === 0 ? <p>Raportteja ei loytynyt.</p> : null}

        {reports.length > 0 ? (
          <div className="v2-report-table">
            <div className="v2-report-row v2-report-row-head">
              <span>Luotu</span>
              <span>Skenaario</span>
              <span>Perusvuosi</span>
              <span>Tarvittava hinta</span>
              <span>Vuosinousu</span>
              <span>Investoinnit</span>
            </div>
            {reports.map((row) => (
              <button
                key={row.id}
                type="button"
                className={`v2-report-row ${selectedReportId === row.id ? 'active' : ''}`}
                onClick={() => setSelectedReportId(row.id)}
              >
                <span>{new Date(row.createdAt).toLocaleString('fi-FI')}</span>
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
        <h2>Raportin esikatselu</h2>
        {loadingDetail ? <p>Ladataan raporttia...</p> : null}
        {!loadingDetail && !selectedReport ? <p>Valitse raportti listasta.</p> : null}

        {selectedReport ? (
          <>
            <article className="v2-kpi-strip v2-kpi-strip-three">
              <div>
                <h3>Tarvittava hinta tanaan</h3>
                <p>{formatPrice(selectedReport.requiredPriceToday)}</p>
              </div>
              <div>
                <h3>Tarvittava vuosinousu</h3>
                <p>{formatPercent(selectedReport.requiredAnnualIncreasePct)}</p>
              </div>
              <div>
                <h3>Investoinnit yhteensa</h3>
                <p>{formatEur(selectedReport.totalInvestments)}</p>
              </div>
            </article>

            <div className="v2-actions-row">
              <a
                className="v2-btn v2-btn-primary"
                href={getReportPdfUrlV2(selectedReport.id)}
                target="_blank"
                rel="noreferrer"
              >
                Lataa PDF
              </a>
            </div>

            <section className="v2-grid v2-grid-two">
              <article className="v2-subcard">
                <h3>Oletukset snapshotista</h3>
                <div className="v2-keyvalue-list">
                  {Object.entries(selectedReport.snapshot.scenario.assumptions).map(([key, value]) => (
                    <div key={key} className="v2-keyvalue-row">
                      <span>{key}</span>
                      <strong>{value.toLocaleString('fi-FI', { maximumFractionDigits: 4 })}</strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className="v2-subcard">
                <h3>Vuosittaiset investoinnit snapshotista</h3>
                <div className="v2-keyvalue-list">
                  {selectedReport.snapshot.scenario.yearlyInvestments.map((item) => (
                    <div key={item.year} className="v2-keyvalue-row">
                      <span>{item.year}</span>
                      <strong>{formatEur(item.amount)}</strong>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
};
