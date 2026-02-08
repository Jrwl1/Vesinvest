import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  listProjections,
  getProjection,
  createProjection,
  deleteProjection,
  computeProjection,
  computeForBudget,
  updateProjection,
  listBudgets,
  listAssumptions,
  getProjectionExportUrl,
  seedDemoData,
  type Projection,
  type ProjectionYear,
  type Budget,
  type Assumption,
} from '../api';
import { ScenarioComparison } from '../components/ScenarioComparison';
import { RevenueReport } from '../components/RevenueReport';
import { useDemoStatus } from '../context/DemoStatusContext';
import { useNavigation } from '../context/NavigationContext';

// ── Helpers ──

function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function fmtEur(n: number): string {
  return n.toLocaleString('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function fmtDecimal(n: number, decimals = 2): string {
  return n.toLocaleString('fi-FI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Classify the projection: sustainable / tight / unsustainable */
function getVerdict(years: ProjectionYear[]): 'sustainable' | 'tight' | 'unsustainable' {
  if (years.length === 0) return 'tight';
  const deficitYears = years.filter((y) => num(y.tulos) < 0).length;
  if (deficitYears === 0) return 'sustainable';
  if (deficitYears <= Math.ceil(years.length * 0.3)) return 'tight';
  return 'unsustainable';
}

const ASSUMPTION_KEYS = ['inflaatio', 'energiakerroin', 'vesimaaran_muutos', 'hintakorotus', 'investointikerroin'];

/**
 * Editable percentage input with focus/blur pattern.
 *
 * Problem: `<input type="number" value="3,0">` breaks because number inputs
 * reject comma decimals (Finnish locale uses comma). A controlled input with
 * `fmtDecimal()` value + parseFloat onChange creates a frozen input since
 * intermediate typing states ("", "4", "4,") are NaN and state never updates.
 *
 * Fix: use `type="text" inputMode="decimal"`. While focused, the user edits
 * raw text freely. On blur we normalize comma → dot and parse. Display reverts
 * to formatted Finnish locale text when not focused.
 */
const AssumptionInput: React.FC<{
  /** Internal decimal value, e.g. 0.03 for 3 % */
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const pct = value * 100;
  const [raw, setRaw] = React.useState('');
  const [focused, setFocused] = React.useState(false);

  return (
    <span className="assumption-input-wrapper">
      <input
        type="text"
        inputMode="decimal"
        className="assumption-input"
        value={focused ? raw : fmtDecimal(pct, 1)}
        onFocus={() => {
          // Show comma-formatted value for Finnish users
          setRaw(fmtDecimal(pct, 1));
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
          const normalized = raw.replace(',', '.');
          const parsed = parseFloat(normalized);
          if (!isNaN(parsed)) {
            onChange(parsed / 100);
          }
          // If NaN (e.g. empty), silently keep the previous value
        }}
        onChange={(e) => setRaw(e.target.value)}
      />
      <span className="assumption-input-suffix">%</span>
    </span>
  );
};

// ── Main Component ──

export const ProjectionPage: React.FC = () => {
  const { t } = useTranslation();

  // State
  const [projections, setProjections] = useState<Projection[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [orgAssumptions, setOrgAssumptions] = useState<Assumption[]>([]);
  const [activeProjection, setActiveProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBudgetId, setNewBudgetId] = useState('');
  const [newHorizon, setNewHorizon] = useState(5);

  // Assumption overrides panel
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});

  // Comparison mode
  const [showComparison, setShowComparison] = useState(false);

  // Data version — increment to force re-fetch (e.g. after demo reset recovery)
  const [dataVersion, setDataVersion] = useState(0);

  const [seedingDemo, setSeedingDemo] = useState(false);
  const demoStatus = useDemoStatus();
  const isDemoEnabled = demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled;
  const { navigateToTab } = useNavigation();

  // ── Data Loading ──

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActiveProjection(null);
    try {
      const [projList, budgetList, assumptions] = await Promise.all([
        listProjections(),
        listBudgets(),
        listAssumptions(),
      ]);
      setProjections(projList);
      setBudgets(budgetList);
      setOrgAssumptions(assumptions);

      // Auto-select default projection, or first one
      if (projList.length > 0) {
        const defaultProj = projList.find((p) => p.onOletus) ?? projList[0];
        await selectProjection(defaultProj.id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [dataVersion]);

  const selectProjection = async (id: string) => {
    try {
      const full = await getProjection(id);
      setActiveProjection(full);
      // Load overrides from projection
      const existingOverrides = (full.olettamusYlikirjoitukset as Record<string, number>) ?? {};
      const overrideState: Record<string, number | null> = {};
      for (const key of ASSUMPTION_KEYS) {
        overrideState[key] = key in existingOverrides ? existingOverrides[key] : null;
      }
      setOverrides(overrideState);
    } catch (e: any) {
      // If projection not found (stale ID), clear and let user re-select
      if (String(e.message).includes('404') || String(e.message).includes('not found')) {
        setActiveProjection(null);
        setDataVersion((v) => v + 1); // Trigger re-fetch
        return;
      }
      setError(e.message || 'Failed to load projection');
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ──

  const handleCreate = async () => {
    if (!newName.trim() || !newBudgetId) return;
    try {
      setError(null);
      const proj = await createProjection({
        talousarvioId: newBudgetId,
        nimi: newName.trim(),
        aikajaksoVuosia: newHorizon,
      });
      setShowCreateForm(false);
      setNewName('');
      setNewBudgetId('');
      setNewHorizon(5);
      // Reload and select new
      const projList = await listProjections();
      setProjections(projList);
      await selectProjection(proj.id);
    } catch (e: any) {
      setError(e.message || 'Failed to create projection');
    }
  };

  const handleDelete = async () => {
    if (!activeProjection) return;
    if (!window.confirm(t('projection.deleteConfirm', { name: activeProjection.nimi }))) return;
    try {
      await deleteProjection(activeProjection.id);
      setActiveProjection(null);
      const projList = await listProjections();
      setProjections(projList);
      if (projList.length > 0) {
        await selectProjection(projList[0].id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to delete projection');
    }
  };

  const handleCompute = async () => {
    if (!activeProjection) return;
    setComputing(true);
    setError(null);

    // Collect overrides
    const cleanOverrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== null) {
        cleanOverrides[key] = value;
      }
    }
    const hasOverrides = Object.keys(cleanOverrides).length > 0;

    try {
      // Try the normal PATCH + compute path first
      await updateProjection(activeProjection.id, {
        olettamusYlikirjoitukset: hasOverrides ? cleanOverrides : undefined,
      });
      const result = await computeProjection(activeProjection.id);
      setActiveProjection(result);
    } catch (e: any) {
      const msg = String(e.message || '');
      const is404 = msg.includes('404') || msg.includes('not found');

      if (is404 && activeProjection.talousarvioId) {
        // Stale projection ID — fall back to budget-based upsert compute
        try {
          const result = await computeForBudget(
            activeProjection.talousarvioId,
            hasOverrides ? cleanOverrides : undefined,
          );
          setActiveProjection(result);
          // Re-fetch projection list so tabs are in sync
          const projList = await listProjections();
          setProjections(projList);
        } catch (e2: any) {
          setError(e2.message || 'Failed to compute projection');
        }
      } else {
        setError(msg || 'Failed to compute projection');
      }
    } finally {
      setComputing(false);
    }
  };

  const handleExport = () => {
    if (!activeProjection) return;
    const token = localStorage.getItem('access_token');
    const url = getProjectionExportUrl(activeProjection.id);
    // Open with auth — use fetch + blob for download
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ennuste_${activeProjection.nimi}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch((e) => setError('Export failed'));
  };

  const handleHorizonChange = async (value: number) => {
    if (!activeProjection) return;
    try {
      await updateProjection(activeProjection.id, { aikajaksoVuosia: value });
      const updated = await getProjection(activeProjection.id);
      setActiveProjection(updated);
    } catch (e: any) {
      const msg = String(e.message || '');
      if (msg.includes('404') || msg.includes('not found')) {
        // Stale — re-fetch everything
        setDataVersion((v) => v + 1);
      } else {
        setError(msg);
      }
    }
  };

  // ── Assumption override helpers ──

  const getOrgDefault = (key: string): number => {
    const a = orgAssumptions.find((a) => a.avain === key);
    return a ? num(a.arvo) : 0;
  };

  const getEffectiveValue = (key: string): number => {
    return overrides[key] ?? getOrgDefault(key);
  };

  const setOverride = (key: string, value: number | null) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  // ── Rendering ──

  if (loading) {
    return (
      <div className="projection-page">
        <div className="page-header"><h2>{t('projection.title')}</h2></div>
        <div className="loading-state">{t('common.loading')}</div>
      </div>
    );
  }

  if (budgets.length === 0) {
    const handleLoadDemoData = async () => {
      setSeedingDemo(true);
      setError(null);
      try {
        await seedDemoData();
        await loadData();
      } catch (e: any) {
        setError(e.message || 'Failed to load demo data');
      } finally {
        setSeedingDemo(false);
      }
    };

    return (
      <div className="projection-page">
        {error && <div className="error-banner">{error}</div>}
        <div className="page-header">
          <h2>{t('projection.title')}</h2>
          <div className="empty-state-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigateToTab('budget')}>
              {t('budget.title')}
            </button>
            {isDemoEnabled && (
              <button type="button" className="btn btn-primary" onClick={handleLoadDemoData} disabled={seedingDemo}>
                {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
              </button>
            )}
          </div>
        </div>
        <div className="card projection-scaffold">
          <p className="skeleton-hint">{t('projection.noBudgetScaffold')}</p>
        </div>
        <div className="projection-table-wrapper card">
          <table className="projection-table">
            <thead>
              <tr>
                <th>{t('projection.columns.year')}</th>
                <th className="num-col">{t('projection.columns.revenue')}</th>
                <th className="num-col">{t('projection.columns.expenses')}</th>
                <th className="num-col">{t('projection.columns.investments')}</th>
                <th className="num-col result-col">{t('projection.columns.netResult')}</th>
                <th className="num-col">{t('projection.columns.cumulative')}</th>
                <th className="num-col">{t('projection.columns.waterPrice')}</th>
                <th className="num-col">{t('projection.columns.volume')}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={8} className="muted">{t('projection.noBudgetScaffold')}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const years = activeProjection?.vuodet ?? [];
  const hasComputedData = years.length > 0;
  const verdict = hasComputedData ? getVerdict(years) : null;

  return (
    <div className="projection-page">
      <div className="page-header">
        <h2>{t('projection.title')}</h2>
        <div className="header-actions">
          {projections.length >= 2 && (
            <button className="btn-secondary" onClick={() => setShowComparison(true)}>
              {t('projection.compare')}
            </button>
          )}
          {hasComputedData && (
            <button className="btn-secondary" onClick={handleExport}>
              {t('projection.exportCsv')}
            </button>
          )}
          <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
            + {t('projection.createScenario')}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Scenario comparison overlay */}
      {showComparison && (
        <ScenarioComparison onClose={() => setShowComparison(false)} />
      )}

      {/* Scenario selector */}
      {projections.length > 0 && (
        <div className="scenario-selector">
          <label>{t('projection.scenario')}:</label>
          <div className="scenario-tabs">
            {projections.map((p) => (
              <button
                key={p.id}
                className={`scenario-tab ${activeProjection?.id === p.id ? 'active' : ''}`}
                onClick={() => selectProjection(p.id)}
              >
                {p.nimi}
                {p.onOletus && <span className="default-badge">★</span>}
              </button>
            ))}
          </div>
          {activeProjection && (
            <button className="btn-icon btn-danger-text" onClick={handleDelete} title={t('projection.deleteScenario')}>
              ✕
            </button>
          )}
        </div>
      )}

      {/* Create form modal */}
      {showCreateForm && (
        <div className="create-scenario-form card">
          <h3>{t('projection.createScenario')}</h3>
          <div className="form-row">
            <label>{t('projection.newScenarioName')}</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('projection.newScenarioPlaceholder')}
            />
          </div>
          <div className="form-row">
            <label>{t('projection.baseBudget')}</label>
            <select value={newBudgetId} onChange={(e) => setNewBudgetId(e.target.value)}>
              <option value="">{t('projection.selectBudget')}</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nimi ?? `Talousarvio ${b.vuosi}`} ({b.vuosi})
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>{t('projection.horizon')}</label>
            <div className="horizon-input">
              <input
                type="number"
                min={1}
                max={20}
                value={newHorizon}
                onChange={(e) => setNewHorizon(parseInt(e.target.value) || 5)}
              />
              <span>{t('projection.horizonYears')}</span>
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" onClick={handleCreate} disabled={!newName.trim() || !newBudgetId}>
              {t('projection.createScenario')}
            </button>
          </div>
        </div>
      )}

      {/* Active projection controls */}
      {activeProjection && (
        <>
          <div className="projection-controls card">
            <div className="controls-row">
              <div className="control-group">
                <label>{t('projection.baseBudget')}</label>
                <span className="control-value">
                  {activeProjection.talousarvio?.nimi ?? '—'} ({activeProjection.talousarvio?.vuosi})
                </span>
              </div>

              <div className="control-group">
                <label>{t('projection.horizon')}</label>
                <div className="horizon-input">
                  <select
                    value={activeProjection.aikajaksoVuosia}
                    onChange={(e) => handleHorizonChange(parseInt(e.target.value))}
                  >
                    {[3, 5, 7, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>{n} {t('projection.horizonYears')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="btn-toggle"
                onClick={() => setShowAssumptions(!showAssumptions)}
              >
                {t('projection.assumptions')} {showAssumptions ? '▲' : '▼'}
              </button>

              <button
                className="btn-primary btn-compute"
                onClick={handleCompute}
                disabled={computing}
              >
                {computing ? t('projection.computing') : (hasComputedData ? t('projection.recompute') : t('projection.compute'))}
              </button>
            </div>

            {/* Collapsible assumptions panel */}
            {showAssumptions && (
              <div className="assumptions-panel">
                <h4>{t('projection.assumptionOverrides')}</h4>
                <table className="assumptions-table">
                  <thead>
                    <tr>
                      <th>{t('assumptions.title')}</th>
                      <th>{t('projection.orgDefault')}</th>
                      <th>{t('projection.overrideValue')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ASSUMPTION_KEYS.map((key) => {
                      const orgDefault = getOrgDefault(key);
                      const hasOverride = overrides[key] !== null;
                      const labelKey = key === 'inflaatio' ? 'inflation'
                        : key === 'energiakerroin' ? 'energyFactor'
                        : key === 'vesimaaran_muutos' ? 'volumeChange'
                        : key === 'hintakorotus' ? 'priceIncrease'
                        : 'investmentFactor';

                      return (
                        <tr key={key} className={hasOverride ? 'overridden' : ''}>
                          <td>{t(`assumptions.${labelKey}`)}</td>
                          <td className="value-cell">{fmtDecimal(orgDefault * 100, 1)}%</td>
                          <td className="value-cell">
                            {hasOverride ? (
                              <AssumptionInput
                                value={overrides[key] ?? 0}
                                onChange={(v) => setOverride(key, v)}
                              />
                            ) : (
                              <span className="muted">{fmtDecimal(orgDefault * 100, 1)}%</span>
                            )}
                          </td>
                          <td>
                            {hasOverride ? (
                              <button className="btn-link" onClick={() => setOverride(key, null)}>
                                {t('projection.useDefault')}
                              </button>
                            ) : (
                              <button className="btn-link" onClick={() => setOverride(key, orgDefault)}>
                                {t('common.edit')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Projection Results */}
          {hasComputedData ? (
            <>
              {/* Verdict insight */}
              {verdict && (
                <div className={`verdict-card verdict-${verdict}`}>
                  <div className="verdict-icon">
                    {verdict === 'sustainable' ? '✅' : verdict === 'tight' ? '⚠️' : '🔴'}
                  </div>
                  <div className="verdict-content">
                    <strong>{t(`projection.verdict.${verdict}`)}</strong>
                    <p>{t(`projection.verdict.${verdict}Desc`)}</p>
                  </div>
                  <div className="verdict-stats">
                    <div className="stat">
                      <span className="stat-label">{t('projection.summary.avgResult')}</span>
                      <span className={`stat-value ${years.reduce((s, y) => s + num(y.tulos), 0) / years.length >= 0 ? 'positive' : 'negative'}`}>
                        {fmtEur(years.reduce((s, y) => s + num(y.tulos), 0) / years.length)}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">{t('projection.summary.finalCumulative')}</span>
                      <span className={`stat-value ${num(years[years.length - 1]?.kumulatiivinenTulos) >= 0 ? 'positive' : 'negative'}`}>
                        {fmtEur(num(years[years.length - 1]?.kumulatiivinenTulos))}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">{t('projection.summary.deficitYears')}</span>
                      <span className="stat-value">
                        {years.filter((y) => num(y.tulos) < 0).length}{t('projection.summary.of')}{years.length}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Year-by-year table */}
              <div className="projection-table-wrapper card">
                <table className="projection-table">
                  <thead>
                    <tr>
                      <th>{t('projection.columns.year')}</th>
                      <th className="num-col">{t('projection.columns.revenue')}</th>
                      <th className="num-col">{t('projection.columns.expenses')}</th>
                      <th className="num-col">{t('projection.columns.investments')}</th>
                      <th className="num-col result-col">{t('projection.columns.netResult')}</th>
                      <th className="num-col">{t('projection.columns.cumulative')}</th>
                      <th className="num-col">{t('projection.columns.waterPrice')}</th>
                      <th className="num-col">{t('projection.columns.volume')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((y, i) => {
                      const tulos = num(y.tulos);
                      const kum = num(y.kumulatiivinenTulos);
                      const isBase = i === 0;
                      return (
                        <tr key={y.vuosi} className={`${tulos < 0 ? 'deficit-row' : ''} ${isBase ? 'base-year-row' : ''}`}>
                          <td className="year-cell">
                            {y.vuosi}
                            {isBase && <span className="base-badge">base</span>}
                          </td>
                          <td className="num-col">{fmtEur(num(y.tulotYhteensa))}</td>
                          <td className="num-col">{fmtEur(num(y.kulutYhteensa))}</td>
                          <td className="num-col">{fmtEur(num(y.investoinnitYhteensa))}</td>
                          <td className={`num-col result-col ${tulos >= 0 ? 'positive' : 'negative'}`}>
                            {fmtEur(tulos)}
                          </td>
                          <td className={`num-col ${kum >= 0 ? 'positive' : 'negative'}`}>
                            {fmtEur(kum)}
                          </td>
                          <td className="num-col">
                            {y.vesihinta ? `${fmtDecimal(num(y.vesihinta))} €/m³` : '—'}
                          </td>
                          <td className="num-col">
                            {y.myytyVesimaara ? `${Math.round(num(y.myytyVesimaara)).toLocaleString('fi-FI')} m³` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Revenue Breakdown Report (printable) */}
              <RevenueReport
                years={years}
                scenarioName={activeProjection.nimi}
              />
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h3>{t('projection.noData')}</h3>
              <p>{t('projection.noDataHint')}</p>
              <button className="btn-primary" onClick={handleCompute} disabled={computing}>
                {computing ? t('projection.computing') : t('projection.compute')}
              </button>
            </div>
          )}
        </>
      )}

      {/* No projections at all — scaffold + quick-start */}
      {projections.length === 0 && !showCreateForm && (
        <>
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h3>{t('projection.noData')}</h3>
            <p>{t('projection.noDataHint')}</p>
            <div className="empty-state-actions">
              {budgets.length > 0 && (
                <button
                  className="btn btn-primary"
                  disabled={computing}
                  onClick={async () => {
                    setComputing(true);
                    setError(null);
                    try {
                      const result = await computeForBudget(budgets[0].id);
                      setActiveProjection(result);
                      const projList = await listProjections();
                      setProjections(projList);
                    } catch (e: any) {
                      setError(e.message || 'Failed to compute');
                    } finally {
                      setComputing(false);
                    }
                  }}
                >
                  {computing ? t('projection.computing') : t('projection.compute')}
                </button>
              )}
              {isDemoEnabled && (
                <button
                  className="btn btn-secondary"
                  disabled={seedingDemo}
                  onClick={async () => {
                    setSeedingDemo(true);
                    setError(null);
                    try {
                      await seedDemoData();
                      await loadData();
                    } catch (e: any) {
                      setError(e.message || 'Failed to load demo data');
                    } finally {
                      setSeedingDemo(false);
                    }
                  }}
                >
                  {seedingDemo ? t('demo.loadingDemoData') : t('demo.loadDemoData')}
                </button>
              )}
            </div>
          </div>
          <div className="projection-table-wrapper card">
            <table className="projection-table">
              <thead>
                <tr>
                  <th>{t('projection.columns.year')}</th>
                  <th className="num-col">{t('projection.columns.revenue')}</th>
                  <th className="num-col">{t('projection.columns.expenses')}</th>
                  <th className="num-col">{t('projection.columns.investments')}</th>
                  <th className="num-col result-col">{t('projection.columns.netResult')}</th>
                  <th className="num-col">{t('projection.columns.cumulative')}</th>
                  <th className="num-col">{t('projection.columns.waterPrice')}</th>
                  <th className="num-col">{t('projection.columns.volume')}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={8} className="muted">{t('projection.noDataHint')}</td></tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
