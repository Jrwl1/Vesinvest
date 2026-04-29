import React from 'react';
import { Bar,CartesianGrid,ComposedChart,Legend,Line,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { formatVolume } from './format';
import type { ForecastPageController } from './useForecastPageController';
type Props = { controller: ForecastPageController };
export const ForecastCockpitSurface: React.FC<Props> = ({ controller }) => {
  const {
    t,
    scenario,
    draftName,
    setDraftName,
    draftScenarioType,
    setDraftScenarioType,
    showInlineFreshnessState,
    scenarioTypeToneClass,
    forecastStateToneClass,
    forecastStateLabel,
    reportReadinessToneClass,
    reportReadinessLabel,
    reportReadinessHint,
    canCreateReport,
    reportBlockerNeedsComputeAction,
    handleGenerateReport,
    handleCompute,
    busy,
    hasNearTermValidationErrors,
    hasMissingDepreciationRules,
    blockedForecastActionHint,
    computeButtonLabel,
    denseAnalystMode,
    setDenseAnalystMode,
    primaryFeeSignal,
    formatPrice,
    formatPercent,
    formatEur,
    reportCommandSummary,
    activePrimaryChart,
    setActivePrimaryChart,
    forecastSurfaceToneClass,
    latestCashflowPoint,
    lowestCumulativeCashPoint,
    baselineContext,
    baselineSourceStatusLabel,
    baselineDatasetSourceLabel,
    baselineYearSnapshot,
    horizonYearSnapshot,
    statementRows,
    statementPillars,
    activeWorkbench,
    setActiveWorkbench,
    computedVersionLabel,
    formatScenarioUpdatedAt,
    normalizeImportedFileName,
    formatNumber,
    scenarioTypeLabel,
    scenarioTypeOptions,
    currentRequiredIncreaseFromToday,
    tariffDriverCards,
    primaryUnderfundingStartYear,
    onGoToAssetManagement,
  } = controller;
  if (!scenario) return null;
  const editableScenarioTypeOptions: Array<typeof draftScenarioType> = scenario.onOletus
    ? ['base']
    : scenarioTypeOptions.filter((option): option is Exclude<typeof draftScenarioType, 'base'> => option !== 'base');
  const primaryHeroCard = {
    key: 'required-price',
    label: t('v2Forecast.requiredPriceToday', 'Required price today'),
    value: formatPrice(primaryFeeSignal.price),
  };
  const supportingHeroCards = [
    {
      key: 'current-comparator',
      label: t('v2Forecast.currentComparatorPrice', 'Current comparator price'),
      value: formatPrice(scenario.baselinePriceTodayCombined ?? 0),
    },
    {
      key: 'required-increase',
      label: t(
        'v2Forecast.requiredIncreaseVsCurrent',
        'Required increase vs current',
      ),
      value: formatPercent(currentRequiredIncreaseFromToday),
    },
    {
      key: 'projected-horizon-price',
      label: t('v2Forecast.projectedHorizonPrice', 'Projected horizon price'),
      value: controller.latestPricePoint
        ? formatPrice(controller.latestPricePoint.combinedPrice)
        : t('v2Forecast.reportStateMissing'),
    },
    {
      key: 'underfunding-start',
      label: t(
        'v2Forecast.annualUnderfundingCompare',
        'Underfunding start (annual result)',
      ),
      value: primaryUnderfundingStartYear ?? t('v2Forecast.noUnderfunding', 'None'),
    },
    {
      key: 'total-investments',
      label: t('v2Forecast.totalInvestments', 'Total investments'),
      value: formatEur(
        scenario.investmentSeries.reduce((sum, row) => sum + row.amount, 0),
      ),
    },
  ];
  return (
    <>
      <div className="v2-scenario-editor-hero">
        <div>
          <div className="v2-section-header">
            <div className="v2-forecast-toolbar-main">
              <label className="v2-field">
                <span>{t('projection.newScenarioName', 'Scenario name')}</span>
                <input
                  id="v2-forecast-scenario-name"
                  className="v2-input"
                  type="text"
                  name="scenarioName"
                  value={draftName}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </label>
              <label className="v2-field">
                <span>{t('v2Forecast.scenarioTypeLabel', 'Branch type')}</span>
                <select
                  id="v2-forecast-scenario-type"
                  className="v2-input"
                  name="scenarioType"
                  value={draftScenarioType}
                  onChange={(event) =>
                    setDraftScenarioType(event.target.value as typeof draftScenarioType)
                  }
                  disabled={scenario.onOletus}
                >
                  {editableScenarioTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {scenarioTypeLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="v2-badge-row">
              <span className={`v2-badge ${scenarioTypeToneClass}`}>
                {scenarioTypeLabel(scenario.scenarioType)}
              </span>
              {showInlineFreshnessState ? (
                <span className={`v2-badge ${forecastStateToneClass}`}>
                  {forecastStateLabel}
                </span>
              ) : null}
              <span className={`v2-badge ${reportReadinessToneClass}`}>
                {reportReadinessLabel}
              </span>
            </div>
          </div>
          <div className="v2-forecast-workspace-meta v2-forecast-toolbar-meta">
            <div className="v2-overview-meta-block">
              <span>{t('projection.v2.baselineYearLabel', 'Baseline year')}</span>
              <strong>{scenario.baselineYear ?? '-'}</strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
              <strong>
                {scenario.horizonYears} {t('projection.v2.horizonUnit', 'y')}
              </strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('v2Forecast.computedYearsLabel', 'Computed years')}</span>
              <strong>{scenario.years.length}</strong>
            </div>
            <div className="v2-overview-meta-block">
              <span>{t('v2Forecast.updatedLabel', 'Updated')}</span>
              <strong>{formatScenarioUpdatedAt(scenario.updatedAt)}</strong>
            </div>
          </div>
        </div>
        <div className="v2-forecast-hero-summary">
          <div className="v2-actions-row v2-forecast-hero-command-row">
            {canCreateReport ? (
              <>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={handleGenerateReport}
                  disabled={busy || !canCreateReport}
                >
                  {t('v2Forecast.createReport', 'Create report')}
                </button>
                <button
                  type="button"
                  className="v2-btn"
                  onClick={handleCompute}
                  disabled={
                    busy ||
                    !scenario ||
                    hasNearTermValidationErrors ||
                    hasMissingDepreciationRules
                  }
                  title={blockedForecastActionHint}
                >
                  {computeButtonLabel}
                </button>
              </>
            ) : reportBlockerNeedsComputeAction ? (
              <>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={handleCompute}
                  disabled={
                    busy ||
                    !scenario ||
                    hasNearTermValidationErrors ||
                    hasMissingDepreciationRules
                  }
                  title={blockedForecastActionHint}
                >
                  {computeButtonLabel}
                </button>
                <button
                  type="button"
                  className="v2-btn"
                  onClick={handleGenerateReport}
                  disabled={busy || !canCreateReport}
                  title={!canCreateReport ? reportReadinessHint ?? undefined : undefined}
                >
                  {t('v2Forecast.createReport', 'Create report')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={handleGenerateReport}
                  disabled={busy || !canCreateReport}
                  title={!canCreateReport ? reportReadinessHint ?? undefined : undefined}
                >
                  {t('v2Forecast.createReport', 'Create report')}
                </button>
                <button
                  type="button"
                  className="v2-btn"
                  onClick={handleCompute}
                  disabled={
                    busy ||
                    !scenario ||
                    hasNearTermValidationErrors ||
                    hasMissingDepreciationRules
                  }
                  title={blockedForecastActionHint}
                >
                  {computeButtonLabel}
                </button>
              </>
            )}
          </div>
          <div
            className={`v2-forecast-answer-panel${denseAnalystMode ? ' dense' : ''}`}
          >
            <div className="v2-forecast-answer-main">
              <h3>{primaryHeroCard.label}</h3>
              <p>{primaryHeroCard.value}</p>
            </div>
            <div className="v2-forecast-answer-supporting">
              {supportingHeroCards.map((card) => (
                <div key={card.key} className="v2-forecast-answer-supporting-card">
                  <h3>{card.label}</h3>
                  <p>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <section className={`v2-card v2-statement-cockpit${denseAnalystMode ? ' dense' : ''}`}>
        <div className="v2-forecast-workspace-head">
          <div className="v2-forecast-workspace-copy">
            <p className="v2-overview-eyebrow">
              {t('v2Forecast.statementCockpitEyebrow', 'Result overview')}
            </p>
            <h3>{t('v2Forecast.statementCockpitTitle', 'Income statement overview')}</h3>
          </div>
          <div className="v2-forecast-workspace-meta">
            <div>
              <span>{t('v2Forecast.statementCockpitBaseline', 'Baseline year')}</span>
              <strong>{baselineYearSnapshot?.year ?? '-'}</strong>
            </div>
            <div>
              <span>{t('v2Forecast.statementCockpitScenario', 'Horizon end year')}</span>
              <strong>{horizonYearSnapshot?.year ?? '-'}</strong>
            </div>
          </div>
        </div>
        <article className="v2-subcard v2-primary-chart-region">
          <div className="v2-section-header">
            <div>
              <h3>
                {activePrimaryChart === 'cashflow'
                  ? t('v2Forecast.cashflowAndCumulative', 'Cashflow and cumulative cash')
                  : t('v2Forecast.pricePath', 'Price path')}
              </h3>
            </div>
            <div className="v2-primary-chart-tabs">
              <button
                type="button"
                className={`v2-btn ${activePrimaryChart === 'cashflow' ? 'v2-btn-primary' : ''}`}
                onClick={() => setActivePrimaryChart('cashflow')}
              >
                {t('v2Forecast.cashImpactTab', 'Cash impact')}
              </button>
              <button
                type="button"
                className={`v2-btn ${activePrimaryChart === 'price' ? 'v2-btn-primary' : ''}`}
                onClick={() => setActivePrimaryChart('price')}
              >
                {t('v2Forecast.pricePathTab', 'Price path')}
              </button>
              <span className={`v2-badge ${forecastStateToneClass}`}>
                {forecastStateLabel}
              </span>
            </div>
          </div>
          <div className="v2-actions-row v2-primary-chart-view-toggle">
            <button
              type="button"
              className={`v2-btn ${denseAnalystMode ? '' : 'v2-btn-primary'}`}
              onClick={() => setDenseAnalystMode(false)}
            >
              {t('v2Forecast.standardViewMode', 'Standard view')}
            </button>
            <button
              type="button"
              className={`v2-btn ${denseAnalystMode ? 'v2-btn-primary' : ''}`}
              onClick={() => setDenseAnalystMode(true)}
            >
              {t('v2Forecast.analystViewMode', 'Analyst view')}
            </button>
          </div>
          {denseAnalystMode ? <p className="v2-muted">{reportCommandSummary}</p> : null}
          <div className={`v2-chart-wrap ${forecastSurfaceToneClass}`}>
            <ResponsiveContainer width="100%" height={320}>
              {activePrimaryChart === 'cashflow' ? (
                <ComposedChart data={scenario.cashflowSeries ?? []}>
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
                    name={t('projection.summary.accumulatedCash', 'Accumulated cash')}
                    stroke="#0f766e"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              ) : (
                <ComposedChart data={scenario.priceSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="combinedPrice"
                    name={t('projection.v2.kpiCombinedWeighted', 'Combined price')}
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
              )}
            </ResponsiveContainer>
          </div>
          <div className="v2-keyvalue-list v2-chart-summary-list">
            {activePrimaryChart === 'cashflow' ? (
              <>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.horizonCashflow', 'Horizon cashflow')}</span>
                  <strong>
                    {latestCashflowPoint
                      ? formatEur(latestCashflowPoint.cashflow)
                      : t('v2Forecast.reportStateMissing')}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.lowestCumulativeCash', 'Lowest cumulative cash')}</span>
                  <strong>
                    {lowestCumulativeCashPoint
                      ? `${formatEur(lowestCumulativeCashPoint.cumulativeCashflow)} (${lowestCumulativeCashPoint.year})`
                      : t('v2Forecast.reportStateMissing')}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.currentFeeLevel')}</span>
                  <strong>{formatPrice(scenario.baselinePriceTodayCombined ?? 0)}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.horizonCombinedPrice', 'Horizon combined')}</span>
                  <strong>
                    {controller.latestPricePoint
                      ? formatPrice(controller.latestPricePoint.combinedPrice)
                      : t('v2Forecast.reportStateMissing')}
                  </strong>
                </div>
              </>
            )}
            {baselineContext ? (
              <div className="v2-keyvalue-row">
                <span>{t('v2Forecast.baselineSourceLabel', 'Baseline source')}</span>
                <strong>{baselineSourceStatusLabel(baselineContext.sourceStatus)}</strong>
              </div>
            ) : null}
          </div>
        </article>
        <section className="v2-tariff-answer-card v2-tariff-answer-card-inline">
          <div className="v2-section-header">
            <div>
              <p className="v2-overview-eyebrow">
                {t('v2Forecast.tariffAnswerEyebrow', 'Tariff answer')}
              </p>
              <h3>{t('v2Forecast.tariffDriversTitle', 'Why this price')}</h3>
            </div>
            <span className={`v2-badge ${scenarioTypeToneClass}`}>
              {scenarioTypeLabel(scenario.scenarioType)}
            </span>
          </div>
          <div className="v2-forecast-driver-grid">
            {tariffDriverCards.map((card) => (
              <article className="v2-subcard v2-forecast-driver-card" key={card.id}>
                <strong>{card.title}</strong>
                <div className="v2-keyvalue-list">
                  {card.rows.map((row) => (
                    <div className="v2-keyvalue-row" key={row.label}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <div className="v2-statement-cockpit-grid">
          {denseAnalystMode ? (
            <article className="v2-subcard v2-statement-card">
              <div className="v2-section-header">
                <div>
                  <h3>{t('v2Forecast.statementSummaryTitle', 'Derived result rows')}</h3>
                </div>
                <span className={`v2-badge ${forecastStateToneClass}`}>
                  {forecastStateLabel}
                </span>
              </div>
              <div className="v2-statement-table" role="table">
                <div className="v2-statement-row v2-statement-row-head" role="row">
                  <span>{t('v2Forecast.statementLabel', 'Row')}</span>
                  <span>{baselineYearSnapshot?.year ?? '-'}</span>
                  <span>{horizonYearSnapshot?.year ?? '-'}</span>
                  <span>{t('v2Forecast.deltaLabel', 'Delta')}</span>
                </div>
                {statementRows.map((row) => (
                  <div className="v2-statement-row" key={row.id} role="row">
                    <strong>{row.label}</strong>
                    <span>{row.baseline}</span>
                    <span>{row.scenario}</span>
                    <span>{row.delta}</span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
          <article className="v2-subcard v2-statement-card">
            <div className="v2-section-header">
              <div>
                <h3>{t('v2Forecast.statementPillarsTitle', 'Workbench')}</h3>
              </div>
            </div>
            <div className="v2-planning-launcher-grid">
              {statementPillars.map((pillar) => (
                <button
                  type="button"
                  className={`v2-planning-launcher ${
                    pillar.id === 'investments' ? 'primary-recommended' : ''
                  } ${
                    (pillar.id === 'investments' && activeWorkbench === 'investments') ||
                    (pillar.id === 'revenues' && activeWorkbench === 'revenue') ||
                    (pillar.id === 'materials' && activeWorkbench === 'materials') ||
                    (pillar.id === 'personnel' && activeWorkbench === 'personnel') ||
                    (pillar.id === 'opex' && activeWorkbench === 'otherOpex')
                      ? 'active'
                      : ''
                  }`}
                  key={pillar.id}
                  aria-label={
                    pillar.id === 'investments'
                      ? t('v2Forecast.investmentProgramTitle', 'Investment program')
                      : pillar.id === 'revenues'
                      ? t('v2Forecast.openRevenueWorkbench', 'Open revenue planning')
                      : pillar.id === 'materials'
                      ? t('v2Forecast.openMaterialsWorkbench', 'Open materials planning')
                      : pillar.id === 'personnel'
                      ? t('v2Forecast.openPersonnelWorkbench', 'Open personnel planning')
                      : t('v2Forecast.openOtherOpexWorkbench', 'Open other operating costs')
                  }
                  onClick={() => {
                    if (pillar.id === 'investments') {
                      onGoToAssetManagement?.();
                      return;
                    }
                    if (pillar.id === 'revenues') setActiveWorkbench('revenue');
                    if (pillar.id === 'materials') setActiveWorkbench('materials');
                    if (pillar.id === 'personnel') setActiveWorkbench('personnel');
                    if (pillar.id === 'opex') setActiveWorkbench('otherOpex');
                  }}
                >
                  <strong>{pillar.title}</strong>
                </button>
              ))}
            </div>
          </article>
          {baselineContext ? (
            <details className="v2-subcard v2-forecast-context-card">
              <summary className="v2-forecast-context-summary">
                <span>{t('v2Forecast.outputsProvenanceTitle', 'Baseline source')}</span>
                <span className="v2-badge v2-status-provenance">
                  {baselineSourceStatusLabel(baselineContext.sourceStatus)}
                </span>
              </summary>
              <div className="v2-keyvalue-list">
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.baselineFinancialsSource', 'Financials')}</span>
                  <strong>
                    {baselineDatasetSourceLabel(
                      baselineContext.financials.source,
                      baselineContext.financials.provenance,
                    )}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.baselinePricesSource', 'Prices')}</span>
                  <strong>
                    {baselineDatasetSourceLabel(
                      baselineContext.prices.source,
                      baselineContext.prices.provenance,
                    )}
                  </strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.baselineVolumesSource', 'Sold volumes')}</span>
                  <strong>
                    {baselineDatasetSourceLabel(
                      baselineContext.volumes.source,
                      baselineContext.volumes.provenance,
                    )}
                  </strong>
                </div>
                {scenario.computedFromUpdatedAt ? (
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.reportComputeSource', 'Computed from version')}</span>
                    <strong>{computedVersionLabel}</strong>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      </section>
      {activeWorkbench === 'cockpit' && denseAnalystMode ? (
        <section className={`v2-grid v2-grid-two v2-forecast-top-grid${denseAnalystMode ? ' dense' : ''}`}>
          <article className="v2-subcard">
            <div className="v2-section-header">
              <div>
                <h3>{t('v2Forecast.baselineContextTitle', 'Baseline realism context')}</h3>
                <p className="v2-muted">
                  {baselineContext
                    ? t('v2Forecast.baselineContextHint', 'Baseline year {{year}} quality: {{quality}}.', {
                        year: baselineContext.year,
                        quality:
                          baselineContext.quality === 'complete'
                            ? t('v2Forecast.qualityComplete', 'complete')
                            : baselineContext.quality === 'partial'
                            ? t('v2Forecast.qualityPartial', 'partial')
                            : t('v2Forecast.qualityMissing', 'missing'),
                      })
                    : t(
                        'v2Forecast.baselineContextMissing',
                        'Baseline provenance becomes visible after a scenario is loaded.',
                      )}
                </p>
              </div>
              {baselineContext ? (
                <span
                  className={`v2-badge ${
                    baselineContext.quality === 'complete'
                      ? 'v2-status-positive'
                      : baselineContext.quality === 'partial'
                      ? 'v2-status-warning'
                      : 'v2-status-neutral'
                  }`}
                >
                  {baselineContext.quality === 'complete'
                    ? t('v2Forecast.qualityComplete', 'complete')
                    : baselineContext.quality === 'partial'
                    ? t('v2Forecast.qualityPartial', 'partial')
                    : t('v2Forecast.qualityMissing', 'missing')}
                </span>
              ) : null}
            </div>
            {baselineContext ? (
              <>
                <div className="v2-keyvalue-list">
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.baselineYearSource', 'Year source')}</span>
                    <strong>{baselineSourceStatusLabel(baselineContext.sourceStatus)}</strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.baselineFinancialsSource', 'Financials')}</span>
                    <strong>
                      {baselineDatasetSourceLabel(
                        baselineContext.financials.source,
                        baselineContext.financials.provenance,
                      )}
                    </strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.baselinePricesSource', 'Prices')}</span>
                    <strong>
                      {baselineDatasetSourceLabel(
                        baselineContext.prices.source,
                        baselineContext.prices.provenance,
                      )}
                    </strong>
                  </div>
                  <div className="v2-keyvalue-row">
                    <span>{t('v2Forecast.baselineVolumesSource', 'Sold volumes')}</span>
                    <strong>
                      {baselineDatasetSourceLabel(
                        baselineContext.volumes.source,
                        baselineContext.volumes.provenance,
                      )}
                    </strong>
                  </div>
                </div>
                {baselineContext.financials.provenance?.kind === 'statement_import' ? (
                  <p className="v2-muted">
                    {t('v2Forecast.baselineStatementImportDetail', {
                      defaultValue: 'Financials were imported from {{fileName}}',
                      fileName: normalizeImportedFileName(
                        baselineContext.financials.provenance.fileName,
                        t('v2Forecast.statementImportFallbackFile', 'statement PDF'),
                      ),
                    })}
                    {baselineContext.financials.provenance.pageNumber
                      ? ` (${t('v2Forecast.pageLabel', 'page')} ${baselineContext.financials.provenance.pageNumber})`
                      : ''}
                  </p>
                ) : null}
                <div className="v2-peer-list">
                  <span>
                    {t('v2Forecast.ctxInvestments', 'Investments')}: <strong>{formatEur(baselineContext.investmentAmount)}</strong>
                  </span>
                  <span>
                    {t('v2Forecast.ctxSoldWater', 'Sold water')}: <strong>{formatVolume(baselineContext.soldWaterVolume)}</strong>
                  </span>
                  <span>
                    {t('v2Forecast.ctxSoldWastewater', 'Sold wastewater')}: <strong>{formatVolume(baselineContext.soldWastewaterVolume)}</strong>
                  </span>
                  <span>
                    {t('v2Forecast.ctxPumpedWater', 'Pumped water')}: <strong>{formatVolume(baselineContext.pumpedWaterVolume)}</strong>
                  </span>
                  <span>
                    {t('v2Forecast.ctxNetWaterTrade', 'Net water trade')}: <strong>{formatVolume(baselineContext.netWaterTradeVolume)}</strong>
                  </span>
                  <span>
                    {t('v2Forecast.ctxProcessElectricity', 'Process electricity')}: <strong>{formatNumber(baselineContext.processElectricity)}</strong>
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
              </>
            ) : null}
          </article>
          <article className="v2-subcard v2-forecast-summary-card">
            <div className="v2-section-header">
              <div>
                <h3>{t('v2Forecast.feeSufficiencySnapshot', 'Fee sufficiency snapshot')}</h3>
                <p className="v2-muted">
                  {t(
                    'v2Forecast.feeSufficiencySnapshotHint',
                    'Compare current pricing against the required fee level and underfunding timing before editing the detailed controls below.',
                  )}
                </p>
              </div>
              {showInlineFreshnessState ? (
                <span className={`v2-badge ${forecastStateToneClass}`}>{forecastStateLabel}</span>
              ) : null}
            </div>
            {reportReadinessHint ? <p className="v2-muted">{reportReadinessHint}</p> : null}
            <div className={`v2-kpi-strip ${forecastSurfaceToneClass}`}>
              <div>
                <h3>{t('v2Forecast.currentFeeLevel')}</h3>
                <p>{formatPrice(scenario.baselinePriceTodayCombined ?? 0)}</p>
                <small>
                  {t('projection.v2.baselineYearLabel', 'Baseline year')}: {scenario.baselineYear ?? '-'}
                </small>
              </div>
              <div>
                <h3>{t('v2Forecast.requiredPriceAnnualResult')}</h3>
                <p>
                  {formatPrice(
                    scenario.requiredPriceTodayCombinedAnnualResult ??
                      scenario.requiredPriceTodayCombined ??
                      scenario.baselinePriceTodayCombined ??
                      0,
                  )}
                </p>
              </div>
              <div>
                <h3>{t('v2Forecast.requiredIncreaseAnnualResult')}</h3>
                <p>
                  {formatPercent(
                    scenario.requiredAnnualIncreasePctAnnualResult ??
                      scenario.requiredAnnualIncreasePct ??
                      0,
                  )}
                </p>
              </div>
              <div>
                <h3>{t('v2Forecast.requiredPriceCumulativeCash')}</h3>
                <p>
                  {formatPrice(
                    scenario.requiredPriceTodayCombinedCumulativeCash ??
                      scenario.requiredPriceTodayCombined ??
                      scenario.baselinePriceTodayCombined ??
                      0,
                  )}
                </p>
              </div>
              <div>
                <h3>{t('v2Forecast.underfundingStartAnnualResult', 'Underfunding starts (annual result)')}</h3>
                <p>{scenario.feeSufficiency.annualResult.underfundingStartYear ?? t('v2Forecast.noUnderfunding', 'None')}</p>
              </div>
              <div>
                <h3>{t('v2Forecast.underfundingStartCumulativeCash', 'Underfunding starts (cumulative cash)')}</h3>
                <p>{scenario.feeSufficiency.cumulativeCash.underfundingStartYear ?? t('v2Forecast.noUnderfunding', 'None')}</p>
              </div>
              <div>
                <h3>{t('v2Forecast.peakCumulativeGap', 'Peak cumulative gap')}</h3>
                <p>{formatEur(scenario.feeSufficiency.cumulativeCash.peakGap)}</p>
              </div>
              <div>
                <h3>{t('v2Forecast.totalInvestments', 'Total investments')}</h3>
                <p>{formatEur(scenario.investmentSeries.reduce((sum, row) => sum + row.amount, 0))}</p>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </>
  );
};
