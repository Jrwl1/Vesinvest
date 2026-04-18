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
    newScenarioType,
    setNewScenarioType,
    handleCreate,
    planningContextLoaded,
    planningContextError,
    hasBaselineBudget,
    handleSave,
    hasUnsavedChanges,
    hasNearTermValidationErrors,
    hasMissingDepreciationRules,
    blockedForecastActionHint,
    handleDelete,
    loadingList,
    getScenarioDisplayName,
    scenarioTypeOptions,
    scenario,
    scenarioTypeLabel,
  } = controller;
  const showCreationDraftControls =
    scenarios.length === 0 || !scenarios.some((item) => item.onOletus);
  const hasScenarioTools = scenarios.length > 0;
  const showPrimarySaveAction = !!scenario && hasUnsavedChanges;

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
            {!loadingList && scenarios.length === 0 ? (
              <h3>{t('v2Forecast.firstScenarioTitle', 'Create your first scenario')}</h3>
            ) : null}
          </div>
          <div className="v2-forecast-strip-actions">
            <div className="v2-inline-form v2-forecast-strip-primary-controls">
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
              {!hasScenarioTools && showCreationDraftControls ? (
                <>
                  <label className="v2-field">
                    <span>{t('projection.newScenarioName', 'New scenario name')}</span>
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
                  </label>
                  <label className="v2-field">
                    <span>{t('v2Forecast.scenarioTypeLabel', 'Branch type')}</span>
                    <select
                      id="v2-forecast-new-scenario-type"
                      className="v2-input"
                      name="newScenarioType"
                      value={newScenarioType}
                      onChange={(event) =>
                        setNewScenarioType(event.target.value as typeof newScenarioType)
                      }
                      disabled={busy}
                    >
                      {scenarioTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {scenarioTypeLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              {!hasScenarioTools ? (
                <>
                  <button
                    type="button"
                    className="v2-btn"
                    onClick={() => handleCreate(false)}
                    disabled={busy || !planningContextLoaded || !hasBaselineBudget}
                  >
                    {t('v2Forecast.firstScenarioCta', 'Create first scenario')}
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
                </>
              ) : null}
            </div>
            {hasScenarioTools ? (
              <details className="v2-forecast-strip-tools">
                <summary>{t('common.actions', 'Actions')}</summary>
                <div className="v2-inline-form v2-forecast-strip-tools-body">
                  {showCreationDraftControls ? (
                    <>
                      <label className="v2-field">
                        <span>{t('projection.newScenarioName', 'New scenario name')}</span>
                        <input
                          id="v2-forecast-new-scenario-name"
                          className="v2-input"
                          type="text"
                          name="newScenarioName"
                          placeholder={t('projection.newScenarioName', 'New scenario name')}
                          value={newScenarioName}
                          onChange={(event) => setNewScenarioName(event.target.value)}
                        />
                      </label>
                      <label className="v2-field">
                        <span>{t('v2Forecast.scenarioTypeLabel', 'Branch type')}</span>
                        <select
                          id="v2-forecast-new-scenario-type"
                          className="v2-input"
                          name="newScenarioType"
                          value={newScenarioType}
                          onChange={(event) =>
                            setNewScenarioType(event.target.value as typeof newScenarioType)
                          }
                          disabled={busy}
                        >
                          {scenarioTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {scenarioTypeLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </>
                  ) : null}
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
                  {scenario ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-danger"
                      onClick={handleDelete}
                      disabled={busy || !scenario || scenario.onOletus}
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  ) : null}
                </div>
              </details>
            ) : null}
            {showPrimarySaveAction ? (
              <div className="v2-actions-row v2-forecast-strip-save-row">
                <button
                  type="button"
                  className="v2-btn"
                  onClick={handleSave}
                  disabled={
                    busy ||
                    !scenario ||
                    !hasUnsavedChanges ||
                    hasNearTermValidationErrors ||
                    hasMissingDepreciationRules
                  }
                  title={blockedForecastActionHint}
                >
                  {t('v2Forecast.saveDraft', 'Save draft')}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {planningContextLoaded && planningContextError ? (
          <p className="v2-muted">{planningContextError}</p>
        ) : null}

        {planningContextLoaded && !planningContextError && !hasBaselineBudget ? (
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
