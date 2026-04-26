import React from 'react';
import { ForecastCockpitSurface } from './ForecastCockpitSurface';
import { ForecastOpexSurface } from './ForecastOpexSurface';
import { ForecastRevenueSurface } from './ForecastRevenueSurface';
import { ForecastScenarioStrip } from './ForecastScenarioStrip';
import {
  useForecastPageController,
  type ForecastPageControllerProps,
} from './useForecastPageController';

type Props = ForecastPageControllerProps;

export const EnnustePageV2: React.FC<Props> = (props) => {
  const controller = useForecastPageController(props);
  const investmentSectionRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (controller.activeWorkbench === 'depreciation') {
      controller.setActiveWorkbench('investments');
    }
  }, [controller.activeWorkbench, controller.setActiveWorkbench]);

  React.useEffect(() => {
    const targetSection =
      controller.activeWorkbench === 'investments'
        ? investmentSectionRef.current
        : null;
    targetSection?.scrollIntoView?.({ block: 'start', inline: 'nearest' });
  }, [controller.activeWorkbench]);

  return (
    <div className="v2-page v2-forecast-theme">
      <ForecastScenarioStrip controller={controller} />

      <section className="v2-grid v2-forecast-layout v2-forecast-layout-board">
        <section className="v2-card v2-scenario-editor v2-forecast-editor">
          {controller.loadingScenario ? (
            <div className="v2-loading-state">
              <p>{controller.t('v2Forecast.loadingScenario', 'Loading scenario...')}</p>
              <div className="v2-skeleton-line" />
              <div className="v2-skeleton-line" />
              <div className="v2-skeleton-line" />
            </div>
          ) : null}
          {!controller.loadingScenario && !controller.scenario ? (
            <div className="v2-empty-state v2-subcard">
              <p>{controller.t('v2Forecast.selectScenario', 'Select a scenario.')}</p>
              {controller.scenarios.length === 0 && controller.firstBaselineYear ? (
                <div className="v2-overview-year-summary-grid">
                  <div>
                    <span>
                      {controller.t('projection.v2.baselineYearLabel', 'Baseline year')}
                    </span>
                    <strong>{controller.firstBaselineYear.year}</strong>
                  </div>
                  <div>
                    <span>{controller.t('v2Forecast.baselineSourceLabel', 'Baseline source')}</span>
                    <strong>
                      {controller.baselineSourceStatusLabel(
                        controller.firstBaselineYear.sourceStatus,
                        controller.firstBaselineYear.planningRole,
                      )}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="v2-muted">
                  {controller.t(
                    'v2Forecast.selectScenarioHint',
                    'Choose an existing scenario or create a new one to continue.',
                  )}
                </p>
              )}
            </div>
          ) : null}

          {controller.scenario ? (
            <>
              <ForecastCockpitSurface controller={controller} />

              <div
                ref={investmentSectionRef}
                className={`v2-forecast-planning-section ${
                  controller.activeWorkbench === 'investments' ? 'is-active' : ''
                }`.trim()}
              >
                <section className="v2-card v2-forecast-workspace">
                  <div className="v2-forecast-workspace-head">
                    <div className="v2-forecast-workspace-copy">
                      <h3>
                        {controller.t(
                          'v2Forecast.investmentProgramTitle',
                          'Investment program',
                        )}
                      </h3>
                      <p className="v2-muted">
                        {controller.t(
                          'v2Forecast.investmentProgramForecastReadOnly',
                          'Investment rows are edited in Asset Management. Forecast uses the synced plan for calculations.',
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="v2-btn"
                      onClick={() => controller.onGoToAssetManagement?.()}
                    >
                      {controller.t('v2Shell.tabs.assetManagement', 'Asset Management')}
                    </button>
                  </div>
                  <div className="v2-kpi-strip">
                    <div>
                      <h3>{controller.t('v2Forecast.totalInvestments', 'Total investments')}</h3>
                      <p>
                        {controller.formatEur(
                          controller.scenario.investmentSeries.reduce(
                            (sum, row) => sum + row.amount,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <div>
                      <h3>{controller.t('v2Forecast.forecastYears', 'Forecast years')}</h3>
                      <p>{controller.scenario.years.length}</p>
                    </div>
                    <div>
                      <h3>{controller.t('v2Forecast.computedVersion', 'Computed version')}</h3>
                      <p>{controller.computedVersionLabel}</p>
                    </div>
                  </div>
                </section>
              </div>

              {controller.activeWorkbench === 'revenue' ? (
                <ForecastRevenueSurface controller={controller} />
              ) : null}

              {controller.opexWorkbenchConfig ? (
                <ForecastOpexSurface controller={controller} />
              ) : null}
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
};
