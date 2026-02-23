import React from 'react';
import {
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteForecastScenarioV2,
  getForecastScenarioV2,
  listForecastScenariosV2,
  updateForecastScenarioV2,
  type V2ForecastScenario,
  type V2ForecastScenarioListItem,
} from '../api';
import { formatEur, formatPercent, formatPrice } from './format';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Props = {
  onReportCreated: (reportId: string) => void;
};

const ASSUMPTION_LABELS: Record<string, string> = {
  inflaatio: 'Inflaatio',
  energiakerroin: 'Energian kustannusmuutos',
  henkilostokerroin: 'Henkilostokulujen muutos',
  vesimaaran_muutos: 'Vesimaaran muutos',
  hintakorotus: 'Hintakorotus',
  investointikerroin: 'Investointien kasvu',
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

const assumptionsEqual = (a: Record<string, number>, b: Record<string, number>): boolean => {
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  for (const key of keys) {
    if (round4(Number(a[key] ?? 0)) !== round4(Number(b[key] ?? 0))) {
      return false;
    }
  }
  return true;
};

const investmentsEqual = (
  a: Array<{ year: number; amount: number }>,
  b: Array<{ year: number; amount: number }>,
): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.year !== right.year) return false;
    if (round4(left.amount) !== round4(right.amount)) return false;
  }
  return true;
};

export const EnnustePageV2: React.FC<Props> = ({ onReportCreated }) => {
  const [scenarios, setScenarios] = React.useState<V2ForecastScenarioListItem[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<string | null>(null);
  const [scenario, setScenario] = React.useState<V2ForecastScenario | null>(null);
  const [draftName, setDraftName] = React.useState('');
  const [draftAssumptions, setDraftAssumptions] = React.useState<Record<string, number>>({});
  const [draftInvestments, setDraftInvestments] = React.useState<Array<{ year: number; amount: number }>>([]);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingScenario, setLoadingScenario] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);

  const loadScenarioList = React.useCallback(async (preferredId?: string) => {
    setLoadingList(true);
    setError(null);
    try {
      const rows = await listForecastScenariosV2();
      setScenarios(rows);
      setSelectedScenarioId((current) => {
        if (preferredId && rows.some((row) => row.id === preferredId)) return preferredId;
        if (current && rows.some((row) => row.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skenaarioiden lataus epaonnistui.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadScenario = React.useCallback(async (scenarioId: string) => {
    setLoadingScenario(true);
    setError(null);
    try {
      const data = await getForecastScenarioV2(scenarioId);
      setScenario(data);
      setDraftName(data.name);
      setDraftAssumptions({ ...data.assumptions });
      setDraftInvestments(data.yearlyInvestments.map((item) => ({ ...item })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skenaarion lataus epaonnistui.');
    } finally {
      setLoadingScenario(false);
    }
  }, []);

  React.useEffect(() => {
    loadScenarioList();
  }, [loadScenarioList]);

  React.useEffect(() => {
    if (!selectedScenarioId) {
      setScenario(null);
      return;
    }
    loadScenario(selectedScenarioId);
  }, [selectedScenarioId, loadScenario]);

  const updateScenarioSummary = React.useCallback((updated: V2ForecastScenario) => {
    setScenarios((prev) => prev.map((item) => (
      item.id === updated.id
        ? {
            ...item,
            name: updated.name,
            horizonYears: updated.horizonYears,
            baselineYear: updated.baselineYear,
            updatedAt: updated.updatedAt,
            computedYears: updated.years.length,
          }
        : item
    )));
  }, []);

  const hasUnsavedChanges = React.useMemo(() => {
    if (!scenario) return false;
    if (draftName.trim() !== scenario.name) return true;
    if (!assumptionsEqual(draftAssumptions, scenario.assumptions)) return true;
    if (!investmentsEqual(draftInvestments, scenario.yearlyInvestments)) return true;
    return false;
  }, [scenario, draftName, draftAssumptions, draftInvestments]);

  const saveDrafts = React.useCallback(async (): Promise<V2ForecastScenario | null> => {
    if (!scenario || !selectedScenarioId) return null;
    if (!hasUnsavedChanges) return scenario;

    const payload = {
      name: draftName.trim() || scenario.name,
      assumptions: draftAssumptions,
      yearlyInvestments: draftInvestments,
    };
    const updated = await updateForecastScenarioV2(selectedScenarioId, payload);
    setScenario(updated);
    setDraftName(updated.name);
    setDraftAssumptions({ ...updated.assumptions });
    setDraftInvestments(updated.yearlyInvestments.map((item) => ({ ...item })));
    updateScenarioSummary(updated);
    return updated;
  }, [
    scenario,
    selectedScenarioId,
    hasUnsavedChanges,
    draftName,
    draftAssumptions,
    draftInvestments,
    updateScenarioSummary,
  ]);

  const handleCreate = React.useCallback(async (copyFromCurrent: boolean) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const created = await createForecastScenarioV2({
        name: newScenarioName.trim() || undefined,
        copyFromScenarioId: copyFromCurrent ? selectedScenarioId ?? undefined : undefined,
      });
      setNewScenarioName('');
      await loadScenarioList(created.id);
      setInfo('Skenaario luotu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skenaarion luonti epaonnistui.');
    } finally {
      setBusy(false);
    }
  }, [newScenarioName, selectedScenarioId, loadScenarioList]);

  const handleDelete = React.useCallback(async () => {
    if (!scenario || !selectedScenarioId || scenario.onOletus) return;
    const confirmed = window.confirm(`Poistetaanko skenaario "${scenario.name}"?`);
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await deleteForecastScenarioV2(selectedScenarioId);
      setInfo('Skenaario poistettu.');
      await loadScenarioList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Skenaarion poisto epaonnistui.');
    } finally {
      setBusy(false);
    }
  }, [scenario, selectedScenarioId, loadScenarioList]);

  const handleSave = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      setInfo('Syotteet tallennettu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tallennus epaonnistui.');
    } finally {
      setBusy(false);
    }
  }, [saveDrafts]);

  const handleCompute = React.useCallback(async () => {
    if (!selectedScenarioId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      const computed = await computeForecastScenarioV2(selectedScenarioId);
      setScenario(computed);
      setDraftName(computed.name);
      setDraftAssumptions({ ...computed.assumptions });
      setDraftInvestments(computed.yearlyInvestments.map((item) => ({ ...item })));
      updateScenarioSummary(computed);
      setInfo('Skenaario laskettu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Laskenta epaonnistui.');
    } finally {
      setBusy(false);
    }
  }, [selectedScenarioId, saveDrafts, updateScenarioSummary]);

  const handleGenerateReport = React.useCallback(async () => {
    if (!selectedScenarioId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let current = await saveDrafts();
      if (!current || current.years.length === 0) {
        current = await computeForecastScenarioV2(selectedScenarioId);
        setScenario(current);
      }
      const report = await createReportV2({ ennusteId: selectedScenarioId });
      setInfo('Raportti luotu.');
      onReportCreated(report.reportId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raportin luonti epaonnistui.');
    } finally {
      setBusy(false);
    }
  }, [selectedScenarioId, saveDrafts, onReportCreated]);

  const handleAssumptionChange = React.useCallback((key: string, value: string) => {
    const parsed = Number(value);
    setDraftAssumptions((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  }, []);

  const handleInvestmentChange = React.useCallback((year: number, value: string) => {
    const parsed = Number(value);
    setDraftInvestments((prev) => prev.map((item) => (
      item.year === year
        ? { ...item, amount: Number.isFinite(parsed) ? parsed : 0 }
        : item
    )));
  }, []);

  const explanation = React.useMemo(() => {
    if (!scenario) return '-';
    const requiredPrice = scenario.requiredPriceTodayCombined ?? scenario.baselinePriceTodayCombined ?? 0;
    const annual = scenario.requiredAnnualIncreasePct ?? 0;
    return `Valituilla investoinneilla yhdistetyn veden hinnan tulisi olla ${formatPrice(requiredPrice)} tanaan ja nousta noin ${formatPercent(annual)} vuodessa.`;
  }, [scenario]);

  const orderedAssumptionKeys = React.useMemo(() => {
    const keys = Object.keys(draftAssumptions);
    return keys.sort((a, b) => {
      const aKnown = ASSUMPTION_LABELS[a] ? 0 : 1;
      const bKnown = ASSUMPTION_LABELS[b] ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return a.localeCompare(b, 'fi');
    });
  }, [draftAssumptions]);

  return (
    <div className="v2-page ennuste-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-grid v2-grid-ennuste">
        <aside className="v2-card v2-scenario-panel">
          <h2>Skenaariot</h2>
          <div className="v2-inline-form">
            <input
              className="v2-input"
              type="text"
              placeholder="Uuden skenaarion nimi"
              value={newScenarioName}
              onChange={(event) => setNewScenarioName(event.target.value)}
            />
            <button type="button" className="v2-btn" onClick={() => handleCreate(false)} disabled={busy}>
              Uusi
            </button>
            <button type="button" className="v2-btn" onClick={() => handleCreate(true)} disabled={busy || !selectedScenarioId}>
              Kopioi
            </button>
          </div>

          {loadingList ? (
            <p>Ladataan skenaarioita...</p>
          ) : (
            <div className="v2-scenario-list">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`v2-scenario-row ${selectedScenarioId === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedScenarioId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>Perusvuosi: {item.baselineYear ?? '-'}</span>
                  <span>Horisontti: {item.horizonYears} v</span>
                </button>
              ))}
            </div>
          )}

          <div className="v2-actions-row">
            <button type="button" className="v2-btn" onClick={handleSave} disabled={busy || !scenario || !hasUnsavedChanges}>
              Tallenna syotteet
            </button>
            <button type="button" className="v2-btn v2-btn-primary" onClick={handleCompute} disabled={busy || !scenario}>
              Laske skenaario
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-danger"
              onClick={handleDelete}
              disabled={busy || !scenario || scenario.onOletus}
            >
              Poista
            </button>
          </div>
        </aside>

        <section className="v2-card v2-scenario-editor">
          {loadingScenario ? <p>Ladataan skenaariota...</p> : null}
          {!loadingScenario && !scenario ? <p>Valitse skenaario.</p> : null}

          {scenario ? (
            <>
              <div className="v2-section-header">
                <h2>Ennuste: {scenario.name}</h2>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={handleGenerateReport}
                  disabled={busy}
                >
                  Luo raportti
                </button>
              </div>

              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>Skenaarion nimi</span>
                  <input
                    className="v2-input"
                    type="text"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
                <label className="v2-field">
                  <span>Perusvuosi</span>
                  <input className="v2-input" value={scenario.baselineYear ?? '-'} disabled />
                </label>
                <label className="v2-field">
                  <span>Horisontti</span>
                  <input className="v2-input" value={`${scenario.horizonYears} vuotta`} disabled />
                </label>
              </div>

              <article className="v2-kpi-strip v2-kpi-strip-three">
                <div>
                  <h3>Tarvittava hinta tanaan</h3>
                  <p>{formatPrice(scenario.requiredPriceTodayCombined ?? scenario.baselinePriceTodayCombined ?? 0)}</p>
                </div>
                <div>
                  <h3>Tarvittava vuosinousu</h3>
                  <p>{formatPercent(scenario.requiredAnnualIncreasePct ?? 0)}</p>
                </div>
                <div>
                  <h3>Investoinnit yhteensa</h3>
                  <p>{formatEur(scenario.investmentSeries.reduce((sum, row) => sum + row.amount, 0))}</p>
                </div>
              </article>

              <p className="v2-explanation">{explanation}</p>

              <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>Oletukset</h3>
                  <div className="v2-assumption-grid">
                    {orderedAssumptionKeys.map((key) => (
                      <label key={key} className="v2-field">
                        <span>{ASSUMPTION_LABELS[key] ?? key}</span>
                        <input
                          className="v2-input"
                          type="number"
                          step="0.0001"
                          value={draftAssumptions[key] ?? 0}
                          onChange={(event) => handleAssumptionChange(key, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>Vuosittaiset investoinnit (EUR)</h3>
                  <div className="v2-investment-table">
                    {draftInvestments.map((row) => (
                      <label key={row.year} className="v2-investment-row">
                        <span>{row.year}</span>
                        <input
                          className="v2-input"
                          type="number"
                          step="1"
                          value={row.amount}
                          onChange={(event) => handleInvestmentChange(row.year, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </article>
              </section>

              <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>Hintapolku</h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.priceSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="combinedPrice" name="Yhdistetty hinta" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="waterPrice" name="Vesi" stroke="#0f766e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="wastewaterPrice" name="Jatevesi" stroke="#b45309" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>Kassavirta ja kumulatiivinen kassa</h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.cashflowSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="cashflow" name="Kassavirta" fill="#0891b2" />
                        <Line type="monotone" dataKey="cumulativeCashflow" name="Kumulatiivinen kassa" stroke="#7c3aed" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </section>
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
};
