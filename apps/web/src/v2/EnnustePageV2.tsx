import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createReportV2,
  deleteForecastScenarioV2,
  getForecastScenarioV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  updateForecastScenarioV2,
  type V2PlanningContextResponse,
  type V2ForecastScenario,
  type V2ForecastScenarioListItem,
} from '../api';
import { formatEur, formatNumber, formatPercent, formatPrice } from './format';
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

const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  investointikerroin: 'assumptions.investmentFactor',
};

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

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

const nearTermExpenseEqual = (
  a: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>,
  b: Array<{
    year: number;
    personnelPct: number;
    energyPct: number;
    opexOtherPct: number;
  }>,
): boolean => {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    const left = a[index];
    const right = b[index];
    if (!left || !right) return false;
    if (left.year !== right.year) return false;
    if (round4(left.personnelPct) !== round4(right.personnelPct)) return false;
    if (round4(left.energyPct) !== round4(right.energyPct)) return false;
    if (round4(left.opexOtherPct) !== round4(right.opexOtherPct)) return false;
  }
  return true;
};

export const EnnustePageV2: React.FC<Props> = ({ onReportCreated }) => {
  const { t } = useTranslation();
  const [scenarios, setScenarios] = React.useState<
    V2ForecastScenarioListItem[]
  >([]);
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<
    string | null
  >(null);
  const [scenario, setScenario] = React.useState<V2ForecastScenario | null>(
    null,
  );
  const [draftName, setDraftName] = React.useState('');
  const [draftAssumptions, setDraftAssumptions] = React.useState<
    Record<string, number>
  >({});
  const [draftInvestments, setDraftInvestments] = React.useState<
    Array<{ year: number; amount: number }>
  >([]);
  const [draftNearTermExpenseAssumptions, setDraftNearTermExpenseAssumptions] =
    React.useState<
      Array<{
        year: number;
        personnelPct: number;
        energyPct: number;
        opexOtherPct: number;
      }>
    >([]);
  const [newScenarioName, setNewScenarioName] = React.useState('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingScenario, setLoadingScenario] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [planningContextLoaded, setPlanningContextLoaded] =
    React.useState(false);

  const mapKnownForecastError = React.useCallback(
    (err: unknown, fallbackKey: string, fallbackText: string) => {
      const message = err instanceof Error ? err.message : '';
      if (message === 'No VEETI baseline budget found. Import data first.') {
        return t(
          'v2Forecast.errorMissingBaselineBudget',
          'No VEETI baseline budget found. Import VEETI data first.',
        );
      }
      return err instanceof Error ? err.message : t(fallbackKey, fallbackText);
    },
    [t],
  );

  const loadScenarioList = React.useCallback(
    async (preferredId?: string) => {
      setLoadingList(true);
      setError(null);
      try {
        const rows = await listForecastScenariosV2();
        setScenarios(rows);
        setSelectedScenarioId((current) => {
          if (preferredId && rows.some((row) => row.id === preferredId))
            return preferredId;
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Forecast.errorLoadListFailed', 'Failed to load scenarios.'),
        );
      } finally {
        setLoadingList(false);
      }
    },
    [t],
  );

  const loadScenario = React.useCallback(
    async (scenarioId: string) => {
      setLoadingScenario(true);
      setError(null);
      try {
        const data = await getForecastScenarioV2(scenarioId);
        setScenario(data);
        setDraftName(data.name);
        setDraftAssumptions({ ...data.assumptions });
        setDraftInvestments(
          data.yearlyInvestments.map((item) => ({ ...item })),
        );
        setDraftNearTermExpenseAssumptions(
          data.nearTermExpenseAssumptions.map((item) => ({ ...item })),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Forecast.errorLoadScenarioFailed',
                'Failed to load scenario.',
              ),
        );
      } finally {
        setLoadingScenario(false);
      }
    },
    [t],
  );

  React.useEffect(() => {
    loadScenarioList();
  }, [loadScenarioList]);

  React.useEffect(() => {
    let active = true;
    getPlanningContextV2()
      .then((data) => {
        if (active) setPlanningContext(data);
      })
      .catch(() => {
        if (active) setPlanningContext(null);
      })
      .finally(() => {
        if (active) setPlanningContextLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasBaselineBudget =
    planningContext?.canCreateScenario ??
    (planningContext?.baselineYears?.length ?? 0) > 0;

  React.useEffect(() => {
    if (!selectedScenarioId) {
      setScenario(null);
      return;
    }
    loadScenario(selectedScenarioId);
  }, [selectedScenarioId, loadScenario]);

  const updateScenarioSummary = React.useCallback(
    (updated: V2ForecastScenario) => {
      setScenarios((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                horizonYears: updated.horizonYears,
                baselineYear: updated.baselineYear,
                updatedAt: updated.updatedAt,
                computedYears: updated.years.length,
              }
            : item,
        ),
      );
    },
    [],
  );

  const hasUnsavedChanges = React.useMemo(() => {
    if (!scenario) return false;
    if (draftName.trim() !== scenario.name) return true;
    if (!investmentsEqual(draftInvestments, scenario.yearlyInvestments))
      return true;
    if (
      !nearTermExpenseEqual(
        draftNearTermExpenseAssumptions,
        scenario.nearTermExpenseAssumptions,
      )
    ) {
      return true;
    }
    return false;
  }, [scenario, draftName, draftInvestments, draftNearTermExpenseAssumptions]);

  const saveDrafts =
    React.useCallback(async (): Promise<V2ForecastScenario | null> => {
      if (!scenario || !selectedScenarioId) return null;
      if (!hasUnsavedChanges) return scenario;

      const payload = {
        name: draftName.trim() || scenario.name,
        yearlyInvestments: draftInvestments,
        nearTermExpenseAssumptions: draftNearTermExpenseAssumptions,
      };
      const updated = await updateForecastScenarioV2(
        selectedScenarioId,
        payload,
      );
      setScenario(updated);
      setDraftName(updated.name);
      setDraftAssumptions({ ...updated.assumptions });
      setDraftInvestments(
        updated.yearlyInvestments.map((item) => ({ ...item })),
      );
      setDraftNearTermExpenseAssumptions(
        updated.nearTermExpenseAssumptions.map((item) => ({ ...item })),
      );
      updateScenarioSummary(updated);
      return updated;
    }, [
      scenario,
      selectedScenarioId,
      hasUnsavedChanges,
      draftName,
      draftAssumptions,
      draftInvestments,
      draftNearTermExpenseAssumptions,
      updateScenarioSummary,
    ]);

  const handleCreate = React.useCallback(
    async (copyFromCurrent: boolean) => {
      if (!hasBaselineBudget) {
        setError(
          t(
            'v2Forecast.errorMissingBaselineBudget',
            'No VEETI baseline budget found. Import VEETI data first.',
          ),
        );
        setInfo(null);
        return;
      }
      setBusy(true);
      setError(null);
      setInfo(null);
      try {
        const created = await createForecastScenarioV2({
          name: newScenarioName.trim() || undefined,
          copyFromScenarioId: copyFromCurrent
            ? selectedScenarioId ?? undefined
            : undefined,
        });
        setNewScenarioName('');
        await loadScenarioList(created.id);
        setInfo(t('v2Forecast.infoCreated', 'Scenario created.'));
      } catch (err) {
        setError(
          mapKnownForecastError(
            err,
            'v2Forecast.errorCreateFailed',
            'Failed to create scenario.',
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [
      hasBaselineBudget,
      loadScenarioList,
      mapKnownForecastError,
      newScenarioName,
      selectedScenarioId,
      t,
    ],
  );

  const handleDelete = React.useCallback(async () => {
    if (!scenario || !selectedScenarioId || scenario.onOletus) return;
    const confirmed = window.confirm(
      t('v2Forecast.deleteConfirm', 'Delete scenario "{{name}}"?', {
        name: scenario.name,
      }),
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await deleteForecastScenarioV2(selectedScenarioId);
      setInfo(t('v2Forecast.infoDeleted', 'Scenario deleted.'));
      await loadScenarioList();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorDeleteFailed', 'Failed to delete scenario.'),
      );
    } finally {
      setBusy(false);
    }
  }, [scenario, selectedScenarioId, loadScenarioList, t]);

  const handleSave = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveDrafts();
      setInfo(
        t(
          'v2Forecast.infoDraftSaved',
          'Draft saved. Recalculate scenario to refresh results.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorSaveFailed', 'Saving failed.'),
      );
    } finally {
      setBusy(false);
    }
  }, [saveDrafts, t]);

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
      setDraftInvestments(
        computed.yearlyInvestments.map((item) => ({ ...item })),
      );
      setDraftNearTermExpenseAssumptions(
        computed.nearTermExpenseAssumptions.map((item) => ({ ...item })),
      );
      updateScenarioSummary(computed);
      setInfo(t('v2Forecast.infoComputed', 'Scenario calculated.'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorComputeFailed', 'Calculation failed.'),
      );
    } finally {
      setBusy(false);
    }
  }, [selectedScenarioId, saveDrafts, updateScenarioSummary, t]);

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
      setInfo(t('v2Forecast.infoReportCreated', 'Report created.'));
      onReportCreated(report.reportId);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorReportFailed', 'Failed to create report.'),
      );
    } finally {
      setBusy(false);
    }
  }, [selectedScenarioId, saveDrafts, onReportCreated, t]);

  const handleInvestmentChange = React.useCallback(
    (year: number, value: string) => {
      const parsed = Number(value);
      setDraftInvestments((prev) =>
        prev.map((item) =>
          item.year === year
            ? { ...item, amount: Number.isFinite(parsed) ? parsed : 0 }
            : item,
        ),
      );
    },
    [],
  );

  const handleNearTermExpenseChange = React.useCallback(
    (
      year: number,
      field: 'personnelPct' | 'energyPct' | 'opexOtherPct',
      rawValue: string,
    ) => {
      const parsed = Number(rawValue.replace(',', '.'));
      setDraftNearTermExpenseAssumptions((prev) =>
        prev.map((item) =>
          item.year === year
            ? {
                ...item,
                [field]: Number.isFinite(parsed) ? parsed : 0,
              }
            : item,
        ),
      );
    },
    [],
  );

  const orderedAssumptionKeys = React.useMemo(() => {
    const keys = Object.keys(draftAssumptions);
    return keys.sort((a, b) => {
      const aKnown = ASSUMPTION_LABEL_KEYS[a] ? 0 : 1;
      const bKnown = ASSUMPTION_LABEL_KEYS[b] ? 0 : 1;
      if (aKnown !== bKnown) return aKnown - bKnown;
      return a.localeCompare(b, 'fi');
    });
  }, [draftAssumptions]);

  const assumptionLabelByKey = React.useCallback(
    (key: string) => t(ASSUMPTION_LABEL_KEYS[key] ?? key, key),
    [t],
  );

  const formatAssumptionPercent = React.useCallback(
    (value: number | undefined) => {
      const numeric = Number.isFinite(value) ? Number(value) : 0;
      const asPercent = Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
      return `${formatNumber(asPercent, 2)} %`;
    },
    [],
  );

  const baselineContext = React.useMemo(() => {
    if (!scenario?.baselineYear || !planningContext) return null;
    return (
      planningContext.baselineYears.find(
        (row) => row.year === scenario.baselineYear,
      ) ?? null
    );
  }, [scenario?.baselineYear, planningContext]);

  return (
    <div className="v2-page ennuste-page-v2">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-grid v2-grid-ennuste">
        <aside className="v2-card v2-scenario-panel">
          <h2>{t('projection.v2.scenariosLabel', 'Scenarios')}</h2>
          <div className="v2-inline-form">
            <input
              className="v2-input"
              type="text"
              placeholder={t('projection.newScenarioName', 'New scenario name')}
              value={newScenarioName}
              onChange={(event) => setNewScenarioName(event.target.value)}
            />
            <button
              type="button"
              className="v2-btn"
              onClick={() => handleCreate(false)}
              disabled={busy || !planningContextLoaded || !hasBaselineBudget}
            >
              {t('v2Forecast.newScenario', 'New')}
            </button>
            <button
              type="button"
              className="v2-btn"
              onClick={() => handleCreate(true)}
              disabled={
                busy ||
                !selectedScenarioId ||
                !planningContextLoaded ||
                !hasBaselineBudget
              }
            >
              {t('v2Forecast.copyScenario', 'Copy')}
            </button>
          </div>
          {planningContextLoaded && !hasBaselineBudget ? (
            <p className="v2-muted">
              {t(
                'v2Forecast.createBlockedMissingBaselineHint',
                'Import VEETI data first to create scenarios.',
              )}
            </p>
          ) : null}

          {loadingList ? (
            <p>{t('v2Forecast.loadingScenarios', 'Loading scenarios...')}</p>
          ) : (
            <div className="v2-scenario-list">
              {scenarios.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`v2-scenario-row ${
                    selectedScenarioId === item.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedScenarioId(item.id)}
                >
                  <strong>{item.name}</strong>
                  <span>
                    {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                    {item.baselineYear ?? '-'}
                  </span>
                  <span>
                    {t('projection.v2.horizonLabel', 'Horizon')}:{' '}
                    {item.horizonYears} {t('projection.v2.horizonUnit', 'y')}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="v2-actions-row">
            <button
              type="button"
              className="v2-btn"
              onClick={handleSave}
              disabled={busy || !scenario || !hasUnsavedChanges}
            >
              {t('v2Forecast.saveDraft', 'Save draft')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-danger"
              onClick={handleDelete}
              disabled={busy || !scenario || scenario.onOletus}
            >
              {t('common.delete', 'Delete')}
            </button>
          </div>
        </aside>

        <section className="v2-card v2-scenario-editor">
          {loadingScenario ? (
            <p>{t('v2Forecast.loadingScenario', 'Loading scenario...')}</p>
          ) : null}
          {!loadingScenario && !scenario ? (
            <p>{t('v2Forecast.selectScenario', 'Select a scenario.')}</p>
          ) : null}

          {scenario ? (
            <>
              <div className="v2-section-header">
                <h2>
                  {t('projection.title', 'Projection')}: {scenario.name}
                </h2>
                <div className="v2-actions-row">
                  <button
                    type="button"
                    className="v2-btn v2-btn-primary"
                    onClick={handleCompute}
                    disabled={busy || !scenario}
                  >
                    {t(
                      'v2Forecast.computeAndRefresh',
                      'Compute and refresh results',
                    )}
                  </button>
                  <button
                    type="button"
                    className="v2-btn"
                    onClick={handleGenerateReport}
                    disabled={busy || hasUnsavedChanges}
                    title={
                      hasUnsavedChanges
                        ? t(
                            'v2Forecast.computeBeforeReport',
                            'Compute scenario before creating report.',
                          )
                        : undefined
                    }
                  >
                    {t('v2Forecast.createReport', 'Create report')}
                  </button>
                </div>
              </div>

              {hasUnsavedChanges ? (
                <p className="v2-muted">
                  {t(
                    'v2Forecast.unsavedHint',
                    'You have unsaved changes. Compute scenario before creating report.',
                  )}
                </p>
              ) : null}

              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>
                    {t('projection.newScenarioName', 'Scenario name')}
                  </span>
                  <input
                    className="v2-input"
                    type="text"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                  />
                </label>
                <label className="v2-field">
                  <span>
                    {t('projection.v2.baselineYearLabel', 'Baseline year')}
                  </span>
                  <input
                    className="v2-input"
                    value={scenario.baselineYear ?? '-'}
                    disabled
                  />
                </label>
                <label className="v2-field">
                  <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                  <input
                    className="v2-input"
                    value={`${scenario.horizonYears} ${t(
                      'projection.v2.horizonUnit',
                      'years',
                    )}`}
                    disabled
                  />
                </label>
              </div>

              <article className="v2-kpi-strip v2-kpi-strip-three">
                <div>
                  <h3>
                    {t(
                      'projection.summary.requiredTariff',
                      'Required price today',
                    )}
                  </h3>
                  <p>
                    {formatPrice(
                      scenario.requiredPriceTodayCombined ??
                        scenario.baselinePriceTodayCombined ??
                        0,
                    )}
                  </p>
                </div>
                <div>
                  <h3>
                    {t(
                      'v2Forecast.requiredIncreaseFromToday',
                      'Required increase from current price',
                    )}
                  </h3>
                  <p>
                    {formatPercent(scenario.requiredAnnualIncreasePct ?? 0)}
                  </p>
                </div>
                <div>
                  <h3>
                    {t('v2Forecast.totalInvestments', 'Total investments')}
                  </h3>
                  <p>
                    {formatEur(
                      scenario.investmentSeries.reduce(
                        (sum, row) => sum + row.amount,
                        0,
                      ),
                    )}
                  </p>
                </div>
              </article>

              {baselineContext ? (
                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.baselineContextTitle',
                      'Baseline realism context',
                    )}
                  </h3>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.baselineContextHint',
                      'Baseline year {{year}} quality: {{quality}}.',
                      {
                        year: baselineContext.year,
                        quality:
                          baselineContext.quality === 'complete'
                            ? t('v2Forecast.qualityComplete', 'complete')
                            : baselineContext.quality === 'partial'
                            ? t('v2Forecast.qualityPartial', 'partial')
                            : t('v2Forecast.qualityMissing', 'missing'),
                      },
                    )}
                  </p>
                  <div className="v2-peer-list">
                    <span>
                      {t('v2Forecast.ctxInvestments', 'Investments')}:{' '}
                      <strong>
                        {formatEur(baselineContext.investmentAmount)}
                      </strong>
                    </span>
                    <span>
                      {t('v2Forecast.ctxSoldWater', 'Sold water')}:{' '}
                      <strong>
                        {formatNumber(baselineContext.soldWaterVolume)} m3
                      </strong>
                    </span>
                    <span>
                      {t('v2Forecast.ctxSoldWastewater', 'Sold wastewater')}:{' '}
                      <strong>
                        {formatNumber(baselineContext.soldWastewaterVolume)} m3
                      </strong>
                    </span>
                    <span>
                      {t('v2Forecast.ctxPumpedWater', 'Pumped water')}:{' '}
                      <strong>
                        {formatNumber(baselineContext.pumpedWaterVolume)} m3
                      </strong>
                    </span>
                    <span>
                      {t('v2Forecast.ctxNetWaterTrade', 'Net water trade')}:{' '}
                      <strong>
                        {formatNumber(baselineContext.netWaterTradeVolume)} m3
                      </strong>
                    </span>
                    <span>
                      {t(
                        'v2Forecast.ctxProcessElectricity',
                        'Process electricity',
                      )}
                      :{' '}
                      <strong>
                        {formatNumber(baselineContext.processElectricity)}
                      </strong>
                    </span>
                  </div>
                  {baselineContext.quality !== 'complete' ? (
                    <p className="v2-alert v2-alert-error">
                      {t(
                        'v2Forecast.baselineContextWarning',
                        'Baseline year is partial. Forecast confidence is lower until data is complete.',
                      )}
                    </p>
                  ) : null}
                </article>
              ) : null}

              <article className="v2-subcard">
                <h3>
                  {t(
                    'v2Forecast.nearTermExpenseTitle',
                    'Near-term expense assumptions (editable)',
                  )}
                </h3>
                <p className="v2-muted">
                  {t(
                    'v2Forecast.nearTermExpenseHint',
                    'Set expected expense growth for the baseline year and next 3 years. Values are percentages.',
                  )}
                </p>
                <div className="v2-near-term-grid">
                  {draftNearTermExpenseAssumptions.map((row) => (
                    <div key={row.year} className="v2-near-term-row">
                      <strong>{row.year}</strong>
                      <label className="v2-field">
                        <span>
                          {t('v2Forecast.nearTermPersonnel', 'Personnel %')}
                        </span>
                        <input
                          className="v2-input"
                          type="number"
                          step="0.1"
                          value={row.personnelPct}
                          onChange={(event) =>
                            handleNearTermExpenseChange(
                              row.year,
                              'personnelPct',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="v2-field">
                        <span>
                          {t('v2Forecast.nearTermEnergy', 'Energy %')}
                        </span>
                        <input
                          className="v2-input"
                          type="number"
                          step="0.1"
                          value={row.energyPct}
                          onChange={(event) =>
                            handleNearTermExpenseChange(
                              row.year,
                              'energyPct',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="v2-field">
                        <span>
                          {t('v2Forecast.nearTermOpexOther', 'Other OPEX %')}
                        </span>
                        <input
                          className="v2-input"
                          type="number"
                          step="0.1"
                          value={row.opexOtherPct}
                          onChange={(event) =>
                            handleNearTermExpenseChange(
                              row.year,
                              'opexOtherPct',
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </article>

              <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>{t('projection.assumptions', 'Assumptions')}</h3>
                  <p className="v2-muted">
                    {t(
                      'v2Forecast.assumptionsLockedHint',
                      'Assumptions are fixed to VEETI baseline values in V2.',
                    )}
                  </p>
                  <div className="v2-assumption-grid">
                    {orderedAssumptionKeys.map((key) => (
                      <label key={key} className="v2-field">
                        <span>{assumptionLabelByKey(key)}</span>
                        <input
                          className="v2-input"
                          type="text"
                          value={formatAssumptionPercent(draftAssumptions[key])}
                          readOnly
                          disabled
                        />
                      </label>
                    ))}
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.yearlyInvestmentsEur',
                      'Yearly investments (EUR)',
                    )}
                  </h3>
                  <div className="v2-investment-table">
                    {draftInvestments.map((row) => (
                      <label key={row.year} className="v2-investment-row">
                        <span>{row.year}</span>
                        <input
                          className="v2-input"
                          type="number"
                          step="1"
                          value={row.amount}
                          onChange={(event) =>
                            handleInvestmentChange(row.year, event.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                </article>
              </section>

              <section className="v2-grid v2-grid-two">
                <article className="v2-subcard">
                  <h3>{t('v2Forecast.pricePath', 'Price path')}</h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.priceSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="combinedPrice"
                          name={t(
                            'projection.v2.kpiCombinedWeighted',
                            'Combined price',
                          )}
                          stroke="#2563eb"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="waterPrice"
                          name={t('revenue.water.title', 'Water')}
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="wastewaterPrice"
                          name={t('revenue.wastewater.title', 'Wastewater')}
                          stroke="#b45309"
                          strokeWidth={2}
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="v2-subcard">
                  <h3>
                    {t(
                      'v2Forecast.cashflowAndCumulative',
                      'Cashflow and cumulative cash',
                    )}
                  </h3>
                  <div className="v2-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                      <ComposedChart data={scenario.cashflowSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="cashflow"
                          name={t('projection.summary.cashflow', 'Cashflow')}
                          fill="#0891b2"
                        />
                        <Line
                          type="monotone"
                          dataKey="cumulativeCashflow"
                          name={t(
                            'projection.summary.accumulatedCash',
                            'Accumulated cash',
                          )}
                          stroke="#0f766e"
                          strokeWidth={2}
                          dot={false}
                        />
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
