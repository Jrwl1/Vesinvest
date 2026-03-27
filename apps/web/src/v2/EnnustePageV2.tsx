import React from 'react';
import { ForecastCockpitSurface } from './ForecastCockpitSurface';
import { ForecastDepreciationSurface } from './ForecastDepreciationSurface';
import { ForecastInvestmentSurface } from './ForecastInvestmentSurface';
import { ForecastOpexSurface } from './ForecastOpexSurface';
import { ForecastRevenueSurface } from './ForecastRevenueSurface';
import { ForecastScenarioStrip } from './ForecastScenarioStrip';
import { getDepreciationRuleGroup } from './forecastModel';
import {
  useForecastPageController,
  type ForecastPageControllerProps,
} from './useForecastPageController';

type Props = ForecastPageControllerProps;

export const EnnustePageV2: React.FC<Props> = (props) => {
  const controller = useForecastPageController(props);

  const investmentProgramSurface = (
    <ForecastInvestmentSurface
      t={controller.t}
      depreciationRulesUnavailable={controller.depreciationRulesUnavailable}
      investmentSummary={controller.investmentSummary}
      forecastStateToneClass={controller.forecastStateToneClass}
      forecastStateLabel={controller.forecastStateLabel}
      investmentImpactSummary={controller.investmentImpactSummary}
      hasInvestmentDepreciationErrors={controller.hasInvestmentDepreciationErrors}
      invalidInvestmentDepreciationYears={controller.invalidInvestmentDepreciationYears}
      onContinueToDepreciation={() => controller.setActiveWorkbench('depreciation')}
      renderInvestmentProgramRows={controller.renderInvestmentProgramRows}
      nearTermInvestmentRows={controller.nearTermInvestmentRows}
      investmentProgramGroupOptions={controller.investmentProgramGroupOptions}
      longRangeInvestmentGroups={controller.longRangeInvestmentGroups}
      renderInvestmentEditorRows={controller.renderInvestmentEditorRows}
      denseAnalystMode={controller.denseAnalystMode}
      busy={controller.busy}
      draftInvestmentsCount={controller.draftInvestments.length}
      onCopyFirstInvestmentToAll={controller.handleCopyFirstInvestmentToAll}
      onRepeatNearTermInvestmentTemplate={
        controller.handleRepeatNearTermInvestmentTemplate
      }
      onClearAllInvestments={controller.handleClearAllInvestments}
      allInvestmentRows={controller.draftInvestments}
      formatEur={controller.formatEur}
      formatPrice={controller.formatPrice}
    />
  );

  return (
    <div className="v2-page v2-forecast-theme">
      <ForecastScenarioStrip controller={controller} />

      <section className="v2-grid v2-grid-ennuste v2-forecast-layout v2-forecast-layout-board">
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

              {controller.activeWorkbench === 'investments' ? (
                <section className="v2-card v2-forecast-workspace">
                  <div className="v2-forecast-workspace-head">
                    <div className="v2-forecast-workspace-copy">
                      <h3>
                        {controller.t(
                          'v2Forecast.investmentProgramTitle',
                          'Investment program',
                        )}
                      </h3>
                    </div>
                  </div>
                  {investmentProgramSurface}
                </section>
              ) : null}

              {controller.activeWorkbench === 'revenue' ? (
                <ForecastRevenueSurface controller={controller} />
              ) : null}

              {controller.opexWorkbenchConfig ? (
                <ForecastOpexSurface controller={controller} />
              ) : null}

              {controller.activeWorkbench === 'depreciation' ? (
                <ForecastDepreciationSurface
                  t={controller.t}
                  reportReadinessToneClass={controller.reportReadinessToneClass}
                  reportReadinessLabel={controller.reportReadinessLabel}
                  reportReadinessReason={controller.reportReadinessReason}
                  reportReadinessHint={controller.reportReadinessHint}
                  baselineDepreciationTotal={controller.baselineDepreciationTotal}
                  newInvestmentDepreciationTotal={controller.newInvestmentDepreciationTotal}
                  totalDepreciationEffect={controller.totalDepreciationEffect}
                  requiredPriceToday={
                    controller.scenario.requiredPriceTodayCombinedAnnualResult ??
                    controller.scenario.requiredPriceTodayCombined ??
                    controller.scenario.baselinePriceTodayCombined ??
                    0
                  }
                  requiredAnnualIncreasePct={
                    controller.scenario.requiredAnnualIncreasePctAnnualResult ??
                    controller.scenario.requiredAnnualIncreasePct ??
                    0
                  }
                  underfundingStartYear={
                    controller.scenario.feeSufficiency.cumulativeCash.underfundingStartYear ??
                    null
                  }
                  peakGap={controller.scenario.feeSufficiency.cumulativeCash.peakGap}
                  latestCashflow={controller.latestCashflowPoint?.cashflow ?? null}
                  depreciationPreviewRows={controller.depreciationPreviewRows}
                  unmappedInvestmentYears={controller.unmappedInvestmentYears}
                  savedMappedInvestmentYearsCount={
                    controller.savedMappedInvestmentYearsCount
                  }
                  plannedInvestmentYearCount={controller.plannedInvestmentYears.length}
                  depreciationClassKeys={controller.depreciationClassKeys}
                  draftInvestments={controller.draftInvestments}
                  savedMappedDepreciationClassByYear={
                    controller.savedMappedDepreciationClassByYear
                  }
                  inferredDepreciationClassOptionByYear={
                    controller.inferredDepreciationClassOptionByYear
                  }
                  previousSavedDepreciationClassByYear={
                    controller.previousSavedDepreciationClassByYear
                  }
                  mappedDepreciationClassByYear={
                    controller.mappedDepreciationClassByYear
                  }
                  handleAllocationDraftChange={controller.handleAllocationDraftChange}
                  depreciationClassOptions={controller.depreciationClassOptions}
                  applyCarryForwardMapping={controller.applyCarryForwardMapping}
                  busy={controller.busy}
                  canSaveClassAllocations={Boolean(controller.selectedScenarioId)}
                  saveClassAllocations={() => void controller.saveClassAllocations()}
                  loadingDepreciation={controller.loadingDepreciation}
                  depreciationRuleDrafts={controller.depreciationRuleDrafts}
                  getDepreciationRuleGroup={getDepreciationRuleGroup}
                  handleDepreciationRuleDraftChange={
                    controller.handleDepreciationRuleDraftChange
                  }
                  saveDepreciationRuleDraft={(index) =>
                    void controller.saveDepreciationRuleDraft(index)
                  }
                  formatEur={controller.formatEur}
                  formatPrice={controller.formatPrice}
                  formatPercent={controller.formatPercent}
                />
              ) : null}
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
};
