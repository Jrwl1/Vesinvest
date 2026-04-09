import React from 'react';
import { toPercentPoints } from './forecastModel';
import type { ForecastPageController } from './useForecastPageController';

type Props = {
  controller: ForecastPageController;
};

export const ForecastRevenueSurface: React.FC<Props> = ({ controller }) => {
  const {
    t,
    scenario,
    reportReadinessToneClass,
    reportReadinessLabel,
    formatEur,
    formatPrice,
    latestPricePoint,
    draftAssumptions,
    formatNumber,
    handleRevenueAssumptionChange,
    baselineContext,
    horizonYearSnapshot,
  } = controller;

  if (!scenario) return null;
  const baselineYearSnapshot = scenario.years[0] ?? null;

  return (
    <section className="v2-card v2-revenue-workbench">
      <div className="v2-forecast-workspace-head">
        <div className="v2-forecast-workspace-copy">
          <h3>
            {t('v2Forecast.revenueWorkbenchTitle', 'Revenue and volume drivers')}
          </h3>
        </div>
      </div>

      <div className="v2-statement-cockpit-grid">
        <article className="v2-subcard v2-statement-card">
          <div className="v2-section-header">
            <div>
              <h4>{t('v2Forecast.pillarRevenue', 'Revenue')}</h4>
              <p className="v2-muted">
                {t(
                  'v2Forecast.revenueWorkbenchTariffHint',
                  'Review today versus horizon tariffs before recomputing the scenario.',
                )}
              </p>
            </div>
            <span className={`v2-badge ${reportReadinessToneClass}`}>
              {reportReadinessLabel}
            </span>
          </div>
          <div className="v2-keyvalue-list">
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.currentFeeLevel')}</span>
              <strong>{formatPrice(scenario.baselinePriceTodayCombined ?? 0)}</strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.horizonCombinedPrice', 'Horizon combined')}</span>
              <strong>
                {latestPricePoint
                  ? formatPrice(latestPricePoint.combinedPrice)
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>
                {t('v2Forecast.horizonServiceSplit', 'Horizon water / wastewater')}
              </span>
              <strong>
                {latestPricePoint
                  ? `${formatPrice(latestPricePoint.waterPrice)} / ${formatPrice(latestPricePoint.wastewaterPrice)}`
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('projection.water.baseFeeRevenue', 'Base fee revenue')}</span>
              <strong>
                {baselineYearSnapshot
                  ? formatEur(baselineYearSnapshot.baseFeeRevenue ?? 0)
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <label className="v2-field">
              <span>{t('assumptions.priceIncrease', 'Price increase')}</span>
              <input
                id="v2-revenue-price-increase"
                className="v2-input"
                type="text"
                inputMode="decimal"
                name="revenuePriceIncrease"
                value={formatNumber(toPercentPoints(draftAssumptions.hintakorotus), 2)}
                onChange={(event) =>
                  handleRevenueAssumptionChange('hintakorotus', event.target.value)
                }
              />
            </label>
            <label className="v2-field">
              <span>{t('assumptions.baseFeeChange', 'Base fee change')}</span>
              <input
                id="v2-revenue-base-fee-change"
                className="v2-input"
                type="text"
                inputMode="decimal"
                name="revenueBaseFeeChange"
                value={formatNumber(
                  toPercentPoints(draftAssumptions.perusmaksuMuutos),
                  2,
                )}
                onChange={(event) =>
                  handleRevenueAssumptionChange(
                    'perusmaksuMuutos',
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </article>

        <article className="v2-subcard v2-statement-card">
          <div className="v2-section-header">
            <div>
              <h4>{t('assumptions.volumeChange', 'Volume change')}</h4>
              <p className="v2-muted">
                {t(
                  'v2Forecast.revenueWorkbenchVolumeHint',
                  'Keep baseline and horizon sold-volume context visible while editing the annual volume driver.',
                )}
              </p>
            </div>
          </div>
          <div className="v2-keyvalue-list">
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.ctxSoldWater', 'Sold water')}</span>
              <strong>
                {baselineContext
                  ? `${formatNumber(baselineContext.soldWaterVolume)} m3`
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2Forecast.ctxSoldWastewater', 'Sold wastewater')}</span>
              <strong>
                {baselineContext
                  ? `${formatNumber(baselineContext.soldWastewaterVolume)} m3`
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('projection.scenario', 'Scenario')}</span>
              <strong>
                {horizonYearSnapshot?.soldVolume != null
                  ? `${formatNumber(horizonYearSnapshot.soldVolume)} m3`
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('projection.water.connections', 'Connections')}</span>
              <strong>
                {baselineYearSnapshot
                  ? formatNumber(baselineYearSnapshot.connectionCount ?? 0)
                  : t('v2Forecast.reportStateMissing')}
              </strong>
            </div>
            <label className="v2-field">
              <span>{t('assumptions.volumeChange', 'Volume change')}</span>
              <input
                id="v2-revenue-volume-change"
                className="v2-input"
                type="text"
                inputMode="decimal"
                name="revenueVolumeChange"
                value={formatNumber(
                  toPercentPoints(draftAssumptions.vesimaaran_muutos),
                  2,
                )}
                onChange={(event) =>
                  handleRevenueAssumptionChange(
                    'vesimaaran_muutos',
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </article>
      </div>
    </section>
  );
};
