import React from 'react';
import type { ForecastPageController } from './useForecastPageController';

type Props = {
  controller: ForecastPageController;
};

export const ForecastOpexSurface: React.FC<Props> = ({ controller }) => {
  const {
    t,
    opexWorkbenchConfig,
    denseAnalystMode,
    setDenseAnalystMode,
    activeWorkbench,
    setActiveWorkbench,
    showInlineFreshnessState,
    forecastStateToneClass,
    forecastStateLabel,
    hasNearTermValidationErrors,
    opexWorkbenchRows,
    assumptionLabelByKey,
    handleNearTermExpenseChange,
    handleNearTermExpenseBlur,
    nearTermValidationMessage,
  } = controller;

  if (!opexWorkbenchConfig) return null;

  return (
    <section
      className={`v2-card v2-opex-workbench${denseAnalystMode ? ' dense' : ''}`}
    >
      <div className="v2-forecast-workspace-head">
        <div className="v2-forecast-workspace-copy">
          <h3>{opexWorkbenchConfig.title}</h3>
        </div>
        <div className="v2-actions-row">
          <button
            type="button"
            className="v2-btn"
            onClick={() => setDenseAnalystMode((prev) => !prev)}
          >
            {denseAnalystMode
              ? t('v2Forecast.disableAnalystMode', 'Disable analyst mode')
              : t('v2Forecast.enableAnalystMode', 'Enable analyst mode')}
          </button>
        </div>
      </div>

      <div className="v2-workbench-switcher">
        <button
          type="button"
          className={`v2-btn ${activeWorkbench === 'materials' ? 'v2-btn-primary' : ''}`}
          onClick={() => setActiveWorkbench('materials')}
        >
          {t('v2Forecast.pillarMaterials', 'Materials and services')}
        </button>
        <button
          type="button"
          className={`v2-btn ${activeWorkbench === 'personnel' ? 'v2-btn-primary' : ''}`}
          onClick={() => setActiveWorkbench('personnel')}
        >
          {t('v2Forecast.pillarPersonnel', 'Personnel costs')}
        </button>
        <button
          type="button"
          className={`v2-btn ${activeWorkbench === 'otherOpex' ? 'v2-btn-primary' : ''}`}
          onClick={() => setActiveWorkbench('otherOpex')}
        >
          {t('v2Forecast.pillarOtherOpex', 'Other operating costs')}
        </button>
      </div>

      <div className="v2-statement-cockpit-grid v2-opex-workbench-layout">
        <article className="v2-subcard v2-statement-card v2-opex-summary-card">
          <div className="v2-section-header">
            <div>
              <h4>{t('v2Forecast.workbenchOverviewTitle', 'Workbench overview')}</h4>
            </div>
            {showInlineFreshnessState ? (
              <span className={`v2-badge ${forecastStateToneClass}`}>
                {forecastStateLabel}
              </span>
            ) : null}
          </div>
          <div className="v2-keyvalue-list v2-workbench-metric-list">
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.baselineLabel', 'Baseline')}</span>
              <strong>{opexWorkbenchConfig.baseline}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('projection.scenario', 'Scenario')}</span>
              <strong>{opexWorkbenchConfig.scenario}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
              <strong>{opexWorkbenchConfig.delta}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.analystModeLabel', 'Analyst mode')}</span>
              <strong>
                {denseAnalystMode ? t('common.yes', 'Yes') : t('common.no', 'No')}
              </strong>
            </div>
          </div>
        </article>

        <article className="v2-subcard v2-statement-card v2-opex-editor-card">
          <div className="v2-section-header">
            <div>
              <h4>
                {t(
                  'v2Forecast.nearTermExpenseTitle',
                  'Near-term expense assumptions (editable)',
                )}
              </h4>
            </div>
          </div>
          {hasNearTermValidationErrors ? (
            <p className="v2-alert v2-alert-error">
              {t(
                'v2Forecast.nearTermValidationSummary',
                'Fix highlighted near-term percentage fields before saving or computing.',
              )}
            </p>
          ) : null}
          <div className={`v2-opex-workbench-grid${denseAnalystMode ? ' dense' : ''}`}>
            {opexWorkbenchRows.map((row) => (
              <div
                key={`${activeWorkbench}-${row.year}`}
                className="v2-opex-workbench-row"
              >
                <strong>{row.year}</strong>
                <span className="v2-muted">
                  {assumptionLabelByKey(
                    row.field === 'energyPct'
                      ? 'energiakerroin'
                      : row.field === 'personnelPct'
                      ? 'henkilostokerroin'
                      : 'inflaatio',
                  )}
                </span>
                <input
                  id={`opex-workbench-${row.field}-${row.year}`}
                  className={`v2-input${row.error ? ' v2-input-invalid' : ''}`}
                  type="text"
                  inputMode="decimal"
                  name={`opexWorkbench-${row.field}-${row.year}`}
                  aria-label={`${opexWorkbenchConfig.title} ${row.year}`}
                  value={row.value}
                  aria-invalid={row.error ? true : undefined}
                  onChange={(event) =>
                    handleNearTermExpenseChange(row.year, row.field, event.target.value)
                  }
                  onBlur={() => handleNearTermExpenseBlur(row.year, row.field)}
                />
                {row.error ? (
                  <small className="v2-field-error">
                    {nearTermValidationMessage(row.error)}
                  </small>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
};
