import React from 'react';
import type { ForecastPageController } from './useForecastPageController';

type Props = {
  controller: ForecastPageController;
};

export const ForecastScenarioStrip: React.FC<Props> = ({ controller }) => {
  const {
    t,
    error,
    info,
    scenarios,
    selectedScenarioId,
    setSelectedScenarioId,
    busy,
    loadingScenario,
    newScenarioName,
    setNewScenarioName,
    handleCreate,
    planningContextLoaded,
    hasBaselineBudget,
    scenario,
    handleSave,
    hasUnsavedChanges,
    hasNearTermValidationErrors,
    hasInvestmentDepreciationErrors,
    blockedForecastActionHint,
    handleDelete,
    loadingList,
    getScenarioDisplayName,
  } = controller;

  return (
    <>
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-card v2-forecast-strip">
        <div className="v2-forecast-strip-head">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Forecast.availableScenarios', 'Scenarios')}
            </p>
            <h2>{t('v2Forecast.scenarioRailTitle', 'Forecast workspace')}</h2>
            {scenarios.length === 0 ? (
              <h3>{t('v2Forecast.firstScenarioTitle', 'Create your first scenario')}</h3>
            ) : null}
          </div>
          <div className="v2-forecast-strip-actions">
            <div className="v2-inline-form">
              {scenarios.length > 0 ? (
                <label className="v2-field">
                  <span>{t('v2Forecast.selectedScenario', 'Scenario')}</span>
                  <select
                    id="v2-forecast-scenario-picker"
                    className="v2-input"
                    name="scenarioPicker"
                    value={selectedScenarioId ?? ''}
                    onChange={(event) =>
                      setSelectedScenarioId(event.target.value || null)
                    }
                    disabled={busy || loadingScenario}
                  >
                    {scenarios.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getScenarioDisplayName(item.name, t)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <input
                id="v2-forecast-new-scenario-name"
                className="v2-input"
                type="text"
                name="newScenarioName"
                autoFocus={scenarios.length === 0}
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
                {scenarios.length === 0
                  ? t('v2Forecast.firstScenarioCta', 'Create first scenario')
                  : t('v2Forecast.newScenario', 'New')}
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
            {scenario ? (
              <div className="v2-actions-row">
                <button
                  type="button"
                  className="v2-btn"
                  onClick={handleSave}
                  disabled={
                    busy ||
                    !scenario ||
                    !hasUnsavedChanges ||
                    hasNearTermValidationErrors ||
                    hasInvestmentDepreciationErrors
                  }
                  title={blockedForecastActionHint}
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
            ) : null}
          </div>
        </div>

        {planningContextLoaded && !hasBaselineBudget ? (
          <p className="v2-muted">
            {t(
              'v2Forecast.createBlockedMissingBaselineHint',
              'Complete Overview import and sync first to create scenarios.',
            )}
          </p>
        ) : null}

        {loadingList ? (
          <div className="v2-loading-state v2-subcard">
            <p>{t('v2Forecast.loadingScenarios', 'Loading scenarios...')}</p>
            <div className="v2-skeleton-line" />
          </div>
        ) : null}
      </section>
    </>
  );
};
