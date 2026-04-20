import React from 'react';
import type { TFunction } from 'i18next';

import {
  connectImportOrganizationV2,
  cloneVesinvestPlanV2,
  createReportV2,
  createVesinvestPlanV2,
  getForecastScenarioV2,
  getVesinvestPlanV2,
  listDepreciationRulesV2,
  listVesinvestGroupsV2,
  listVesinvestPlansV2,
  searchImportOrganizationsV2,
  syncVesinvestPlanToForecastV2,
  updateDepreciationRuleV2,
  updateVesinvestGroupV2,
  updateVesinvestPlanV2,
  type V2DepreciationRule,
  type V2EditableDepreciationRuleMethod,
  type V2ForecastScenario,
  type V2PlanningContextResponse,
  type V2VesinvestBaselineSourceState,
  type V2VesinvestGroupDefinition,
  type V2VesinvestGroupUpdateInput,
  type V2VesinvestFeeRecommendation,
  type V2VesinvestPlan,
  type V2VesinvestPlanSummary,
  type V2VesinvestProject,
} from '../api';
import { buildDefaultReportTitle } from './displayNames';
import { formatDateTime, formatEur, formatPercent, formatPrice } from './format';
import { toDepreciationRuleDraft, type DepreciationRuleDraft } from './forecastModel';
import {
  allocationFieldLabel,
  buildDraftFromPlan,
  buildHorizonYears,
  cloneJson,
  createProject,
  FALLBACK_GROUP_KEY,
  formatPlanMatrixAmount,
  parseNullableNumberInput,
  resolveInvestmentTypeFromGroupKey,
  resolveProjectGroup,
  round2,
  syncProjectTotals,
  toneClass,
  toCreatePlanInput,
  toUpdatePlanInput,
  typeLabel,
  type VesinvestBaselineYear,
  type VesinvestDraft,
  type VesinvestGroupedMatrixSection,
  type VesinvestLinkedOrg,
  type VesinvestWorkspaceView,
} from './vesinvestPlanningModel';
import {
  buildBaselineSourceSnapshot,
  datasetSourceLabel,
  datasetSourceNote,
  qualityLabel,
  readSavedBaselineYears,
  sourceStatusLabel,
} from './vesinvestPlanningProvenance';
import {
  VesinvestBaselineReviewSurface,
  VesinvestDepreciationPlanSurface,
  VesinvestIdentitySurface,
  VesinvestMatrixSurface,
  VesinvestProjectDetailsSurface,
  VesinvestRegisterSurface,
  VesinvestRevisionSurface,
} from './vesinvestPlanningSections';
import { useVesinvestPlanningController } from './useVesinvestPlanningController';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';

type Props = {
  t: TFunction;
  isAdmin?: boolean;
  simplifiedSetup?: boolean;
  compactReviewMode?: boolean;
  planningContext: V2PlanningContextResponse | null;
  linkedOrg: VesinvestLinkedOrg;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  overviewFocusTarget?: VesinvestOverviewFocusTarget | null;
  onOverviewFocusTargetConsumed?: () => void;
  onSavedFeePathReportConflict?: (planId?: string | null) => void;
  onPlansChanged?: () => Promise<void> | void;
};

export type VesinvestOverviewFocusTarget = {
  kind: 'saved_fee_path';
  planId: string;
};

export const VesinvestPlanningPanel: React.FC<Props> = ({
  t,
  isAdmin = false,
  simplifiedSetup = false,
  compactReviewMode = false,
  planningContext,
  linkedOrg,
  onGoToForecast,
  onGoToReports,
  overviewFocusTarget,
  onOverviewFocusTargetConsumed,
  onSavedFeePathReportConflict,
  onPlansChanged,
}) => {
  const {
    groups,
    groupDrafts,
    depreciationRules,
    depreciationRuleDrafts,
    plans,
    selectedPlanId,
    setSelectedPlanId,
    plan,
    draft,
    setDraft,
    loading,
    loadingPlan,
    busy,
    error,
    info,
    reportConflictCode,
    veetiSearchQuery,
    setVeetiSearchQuery,
    veetiSearchResults,
    searchingVeeti,
    feePathSectionRef,
    feePathHeadingRef,
    savingClassKey,
    linkedScenario,
    loadingLinkedScenario,
    activeWorkspaceView,
    setActiveWorkspaceView,
    projectComposer,
    setProjectComposer,
    useSimplifiedSetup,
    yearTotals,
    fiveYearBands,
    totalInvestments,
    groupedPlanMatrix,
    savedBaselineSource,
    selectedSummary,
    baselineSnapshot,
    loadedPlanDraft,
    hasUnsavedChanges,
    liveBaselineVerified,
    utilityBindingMissing,
    utilityBindingMismatch,
    baselineVerified,
    baselineYears,
    pricingReady,
    feeRecommendation,
    hasSavedFeePathLink,
    showDownstreamActions,
    hasSavedPricingOutput,
    revisionStatusMessage,
    reportReadinessReason,
    canCreateReport,
    updateProject,
    updateGroupDraft,
    updateDepreciationRuleDraft,
    handleSaveClassDefinition,
    updateProjectAllocation,
    runVeetiLookup,
    applyVeetiSearchHit,
    persist,
    handleCreateReport,
    setDraftField,
    projectComposerGroupKey,
    openProjectComposer,
    closeProjectComposer,
    handleCreateProjectDraft,
    shouldLeadAddProject,
    shouldLeadSave,
    shouldLeadSync,
    projectActionClass,
    saveActionClass,
    syncActionClass,
    reportActionClass,
  } = useVesinvestPlanningController({
    t,
    isAdmin,
    simplifiedSetup,
    compactReviewMode,
    planningContext,
    linkedOrg,
    onGoToForecast,
    onGoToReports,
    overviewFocusTarget,
    onOverviewFocusTargetConsumed,
    onSavedFeePathReportConflict,
    onPlansChanged,
  });
  const actionRow = (
    <div className="v2-vesinvest-action-stack">
      <div className="v2-actions-row v2-vesinvest-workflow-actions">
        {activeWorkspaceView === 'investment' ? (
          <button
            type="button"
            className={projectActionClass}
            onClick={openProjectComposer}
            disabled={busy || loading || loadingPlan || groups.length === 0}
          >
            {t('v2Vesinvest.addProject', 'Add project')}
          </button>
        ) : null}
        <button
          type="button"
          className={saveActionClass}
          onClick={() => void persist(plan ? 'save' : 'create')}
          disabled={busy || (!plan && utilityBindingMissing)}
        >
          {plan
            ? t('v2Vesinvest.savePlan', 'Save Vesinvest')
            : t('v2Vesinvest.createPlan', 'Create Vesinvest plan')}
        </button>
        {showDownstreamActions ? (
          <>
            <button
              type="button"
              className={syncActionClass}
              onClick={() => void persist('sync')}
              disabled={busy || !plan || !pricingReady}
            >
              {t('v2Vesinvest.openPricing', 'Open fee path')}
            </button>
            <button
              type="button"
              className={reportActionClass}
              onClick={() => void handleCreateReport()}
              disabled={busy || !canCreateReport}
            >
              {t('v2Forecast.createReport', 'Create report')}
            </button>
          </>
        ) : null}
      </div>
      {plan ? (
        <div className="v2-actions-row v2-vesinvest-maintenance-actions">
          <button
            type="button"
            className="v2-btn"
            onClick={() => void persist('clone')}
            disabled={busy}
          >
            {t('v2Vesinvest.clonePlan', 'New revision')}
          </button>
        </div>
      ) : null}
    </div>
  );

  const workspaceTabs = (
    <section className="v2-vesinvest-section">
      <div className="v2-actions-row" role="tablist" aria-label={t('v2Vesinvest.workspaceTabs', 'Vesinvest workspace views')}>
        <button
          type="button"
          className={`v2-btn ${activeWorkspaceView === 'investment' ? 'v2-btn-primary' : ''}`}
          aria-pressed={activeWorkspaceView === 'investment'}
          onClick={() => setActiveWorkspaceView('investment')}
        >
          {t('v2Vesinvest.investmentPlanTab', 'Investment plan')}
        </button>
        <button
          type="button"
          className={`v2-btn ${activeWorkspaceView === 'depreciation' ? 'v2-btn-primary' : ''}`}
          aria-pressed={activeWorkspaceView === 'depreciation'}
          onClick={() => setActiveWorkspaceView('depreciation')}
        >
          {t('v2Vesinvest.depreciationPlanTab', 'Depreciation plan')}
        </button>
      </div>
    </section>
  );

  const utilityBindingSection = (
    <VesinvestIdentitySurface
      t={t}
      badge={
        <span
          className={`v2-badge ${toneClass(
            utilityBindingMissing
              ? 'blocked'
              : utilityBindingMismatch
              ? 'provisional'
              : 'verified',
          )}`}
        >
          {utilityBindingMissing
            ? t('v2Vesinvest.baselineLinkPending', 'Not yet linked')
            : utilityBindingMismatch
            ? t('v2Vesinvest.identityNeedsReview', 'Link needs review')
            : t('v2Vesinvest.identityLinked', 'VEETI linked')}
        </span>
      }
    >
      {utilityBindingMissing ? (
        <>
          <div className="v2-inline-form">
            <label className="v2-field v2-field-wide">
              <span>{t('v2Vesinvest.veetiLookupLabel', 'VEETI lookup')}</span>
              <input
                id="vesinvest-veeti-lookup"
                name="vesinvest-veeti-lookup"
                className="v2-input"
                value={veetiSearchQuery}
                placeholder={t(
                  'v2Vesinvest.veetiLookupPlaceholder',
                  'Search by business ID or utility name',
                )}
                onChange={(event) => setVeetiSearchQuery(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="v2-btn"
              onClick={() => void runVeetiLookup()}
              disabled={busy || searchingVeeti}
            >
              {searchingVeeti
                ? t('v2Overview.searchingButton', 'Searching...')
                : t('v2Overview.searchButton', 'Search')}
            </button>
          </div>
          {veetiSearchResults.length > 0 ? (
            <div className="v2-inline-list">
              {veetiSearchResults.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  className="v2-btn v2-btn-secondary"
                  onClick={() => applyVeetiSearchHit(hit)}
                >
                  {hit.name}
                  {hit.businessId ? ` · ${hit.businessId}` : ''}
                  {hit.municipality ? ` · ${hit.municipality}` : ''}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="v2-overview-year-summary-grid">
          <div>
            <span>{t('v2Vesinvest.utilityName', 'Utility name')}</span>
            <strong>{linkedOrg?.nimi ?? draft.utilityName ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.businessId', 'Business ID')}</span>
            <strong>{linkedOrg?.ytunnus ?? draft.businessId ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.identityVeeti', 'VEETI')}</span>
            <strong>{linkedOrg?.veetiId ?? draft.veetiId ?? '-'}</strong>
          </div>
          <div>
            <span>{t('v2Vesinvest.identitySource', 'Identity source')}</span>
            <strong>{t('v2Vesinvest.identityVeeti', 'VEETI')}</strong>
          </div>
          </div>
        )}
    </VesinvestIdentitySurface>
  );

  const depreciationPlanSection =
    activeWorkspaceView === 'depreciation' ? (
    <VesinvestDepreciationPlanSurface t={t}>
      <div className="v2-vesinvest-table-wrap">
        <table className="v2-vesinvest-table">
          <thead>
            <tr>
              <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
              <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
              <th>{t('v2Vesinvest.allocationMetric', 'Split')}</th>
              <th>{t('v2Forecast.method', 'Depreciation method')}</th>
              <th>{t('v2Vesinvest.writeOffTime', 'Write-off time')}</th>
              <th>{t('v2Vesinvest.residualShare', 'Residual share')}</th>
              <th>{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {groupDrafts.map((group) => {
              const ruleDraft =
                depreciationRuleDrafts.find(
                  (rule) => rule.assetClassKey === group.key,
                ) ?? null;
              return (
              <tr key={group.key}>
                <td>
                  <input
                    id={`vesinvest-group-label-${group.key}`}
                    name={`vesinvest-group-label-${group.key}`}
                    className="v2-input"
                    value={group.label}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    id={`vesinvest-group-account-${group.key}`}
                    name={`vesinvest-group-account-${group.key}`}
                    className="v2-input"
                    value={group.defaultAccountKey}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        defaultAccountKey: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <select
                    id={`vesinvest-group-split-${group.key}`}
                    name={`vesinvest-group-split-${group.key}`}
                    className="v2-input"
                    value={group.serviceSplit}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateGroupDraft(group.key, (current) => ({
                        ...current,
                        serviceSplit:
                          event.target.value as V2VesinvestGroupDefinition['serviceSplit'],
                      }))
                    }
                  >
                    <option value="water">
                      {t('v2Forecast.investmentServiceSplitWater', 'Water')}
                    </option>
                    <option value="wastewater">
                      {t(
                        'v2Forecast.investmentServiceSplitWastewater',
                        'Wastewater',
                      )}
                    </option>
                    <option value="mixed">
                      {t('v2Forecast.investmentServiceSplitMixed', 'Mixed')}
                    </option>
                  </select>
                </td>
                <td>
                  <select
                    id={`vesinvest-group-method-${group.key}`}
                    name={`vesinvest-group-method-${group.key}`}
                    className="v2-input"
                    value={ruleDraft?.method ?? 'none'}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        method: event.target.value as V2EditableDepreciationRuleMethod,
                      }))
                    }
                  >
                    <option value="none">
                      {t('v2Forecast.methodNone', 'No depreciation')}
                    </option>
                    <option value="straight-line">
                      {t('v2Forecast.methodLinear', 'Straight-line')}
                    </option>
                    <option value="residual">
                      {t('v2Forecast.methodResidualShort', 'Residual')}
                    </option>
                  </select>
                </td>
                <td>
                  <input
                    id={`vesinvest-group-years-${group.key}`}
                    name={`vesinvest-group-years-${group.key}`}
                    className="v2-input"
                    type="number"
                    min={0}
                    value={ruleDraft?.linearYears ?? ''}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        linearYears: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    id={`vesinvest-group-residual-${group.key}`}
                    name={`vesinvest-group-residual-${group.key}`}
                    className="v2-input"
                    type="number"
                    min={0}
                    value={ruleDraft?.residualPercent ?? ''}
                    disabled={!isAdmin}
                    onChange={(event) =>
                      updateDepreciationRuleDraft(group.key, (current) => ({
                        ...current,
                        residualPercent: event.target.value,
                      }))
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => void handleSaveClassDefinition(group.key)}
                    disabled={!isAdmin || savingClassKey === group.key}
                  >
                    {t('common.save', 'Save')}
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {depreciationRules.length === 0 ? (
        <p className="v2-muted">
          {t('common.loading', 'Loading...')}
        </p>
      ) : null}
    </VesinvestDepreciationPlanSurface>
  ) : null;

  const feePathSection = feeRecommendation ? (
    <section className="v2-vesinvest-section" ref={feePathSectionRef}>
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">{t('v2Vesinvest.feePathEyebrow', 'Fee path')}</p>
          <h3 ref={feePathHeadingRef} tabIndex={-1}>
            {t('v2Vesinvest.feePathTitle', 'Saved fee-path recommendation')}
          </h3>
        </div>
        <span className={`v2-badge ${toneClass(selectedSummary?.pricingStatus ?? 'blocked')}`}>
          {selectedSummary?.pricingStatus === 'verified'
            ? t('v2Vesinvest.pricingVerified', 'Verified')
            : selectedSummary?.pricingStatus === 'provisional'
            ? t('v2Vesinvest.pricingProvisional', 'Provisional')
            : t('v2Vesinvest.pricingBlocked', 'Blocked')}
        </span>
      </div>
      {baselineYears.length > 0 ? (
        <div className="v2-overview-year-summary-grid">
          <div>
            <span>{t('v2Vesinvest.evidenceTitle', 'Accepted baseline years')}</span>
            <strong>{baselineYears.map((yearRow) => yearRow.year).join(', ')}</strong>
          </div>
        </div>
      ) : null}
      <div className="v2-overview-year-summary-grid">
        <div>
          <span>{t('projection.v2.kpiCombinedWeighted', 'Combined price')}</span>
          <strong>{formatPrice(feeRecommendation.combined.baselinePriceToday ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Reports.requiredCombinedPriceToday', 'Required combined price today')}</span>
          <strong>
            {formatPrice(feeRecommendation.combined.annualResult.requiredPriceToday ?? null)}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.requiredIncreaseFromToday', 'Required increase from current combined price')}</span>
          <strong>
            {formatPercent(
              feeRecommendation.combined.annualResult.requiredAnnualIncreasePct ?? null,
            )}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.requiredPriceCumulativeCash', 'Required price today (cumulative cash >= 0)')}</span>
          <strong>
            {formatPrice(
              feeRecommendation.combined.cumulativeCash.requiredPriceToday ?? null,
            )}
          </strong>
        </div>
        <div>
          <span>{t('v2Forecast.peakGapCompare', 'Peak cumulative gap')}</span>
          <strong>{formatEur(feeRecommendation.combined.cumulativeCash.peakGap ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Vesinvest.feePathInvestmentTotal', 'Synced investment total')}</span>
          <strong>{formatEur(feeRecommendation.totalInvestments ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.waterPricePerM3', 'Water price')}</span>
          <strong>{formatPrice(feeRecommendation.water.currentPrice ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.wastewaterPricePerM3', 'Wastewater price')}</span>
          <strong>{formatPrice(feeRecommendation.wastewater.currentPrice ?? null)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.baseFeeRevenue', 'Base-fee revenue')}</span>
          <strong>{formatEur(feeRecommendation.baseFee.currentRevenue ?? 0)}</strong>
        </div>
        <div>
          <span>{t('v2Forecast.connectionCount', 'Connections')}</span>
          <strong>{(feeRecommendation.baseFee.connectionCount ?? 0).toLocaleString()}</strong>
        </div>
      </div>
    </section>
  ) : null;

  const planStatusStrip = (
    <div
      className={`v2-kpi-strip${
        showDownstreamActions ? ' v2-kpi-strip-three' : ''
      }`}
    >
      <article>
        <h3>{t('v2Vesinvest.planState', 'Plan state')}</h3>
        <p>
          <span
            className={`v2-badge ${toneClass(
              draft.projects.length > 0 ? 'incomplete' : 'draft',
            )}`}
          >
            {draft.projects.length > 0
              ? t('v2Vesinvest.planDraftExists', 'Plan draft exists')
              : t('v2Vesinvest.planDraftMissing', 'No plan rows yet')}
          </span>
        </p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.baselineState', 'Baseline & evidence')}</h3>
        <p>
          <span
            className={`v2-badge ${toneClass(
              baselineVerified ? 'verified' : 'incomplete',
            )}`}
          >
            {baselineVerified
              ? t('v2Vesinvest.baselineVerified', 'Baseline verified')
              : t('v2Vesinvest.baselineIncomplete', 'Baseline incomplete')}
          </span>
        </p>
        <small>
          {baselineVerified
            ? t(
                'v2Vesinvest.baselineVerifiedHint',
                'Pricing can now be synced from the plan.',
              )
            : t(
                'v2Vesinvest.baselineIncompleteHint',
                'VEETI, PDF, or manual corrections are still needed before pricing is final.',
              )}
        </small>
      </article>
      {showDownstreamActions ? (
        <article>
          <h3>{t('v2Vesinvest.pricingState', 'Pricing output')}</h3>
          <p>
            <span
              className={`v2-badge ${toneClass(
                selectedSummary?.pricingStatus ?? 'blocked',
              )}`}
            >
              {selectedSummary?.pricingStatus === 'verified'
                ? t('v2Vesinvest.pricingVerified', 'Verified')
                : selectedSummary?.pricingStatus === 'provisional'
                ? t('v2Vesinvest.pricingProvisional', 'Provisional')
                : t('v2Vesinvest.pricingBlocked', 'Blocked')}
            </span>
          </p>
          <small>
            {hasSavedPricingOutput
              ? revisionStatusMessage
              : pricingReady
              ? t(
                  'v2Vesinvest.pricingReadyHint',
                  'Sync the plan to open fee-path and financing results.',
                )
              : baselineVerified
              ? t(
                  'v2Vesinvest.pricingPlanMissingHint',
                  'Add investment rows and yearly allocations before fee-path and financing output can be opened.',
                )
              : t(
                  'v2Vesinvest.pricingBlockedHint',
                  'Fee-path and financing output stay blocked until the baseline is verified.',
                )}
          </small>
        </article>
      ) : null}
    </div>
  );

  const loadingState =
    loading || loadingPlan ? (
      <div className="v2-loading-state">
        <p>{t('common.loading', 'Loading...')}</p>
        <div className="v2-skeleton-line" />
      </div>
    ) : null;

  if (compactReviewMode) {
    return (
      <section className="v2-card v2-vesinvest-panel v2-vesinvest-panel-compact">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">{t('v2Vesinvest.eyebrow', 'Vesinvest')}</p>
            <h2>{t('v2Vesinvest.title', 'Vesinvest VEETI-first workspace')}</h2>
          </div>
        </div>

        {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
        {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}
        {loadingState}
      </section>
    );
  }

  return (
    <section className="v2-card v2-vesinvest-panel">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">{t('v2Vesinvest.eyebrow', 'Vesinvest')}</p>
          <h2>{t('v2Vesinvest.title', 'Vesinvest VEETI-first workspace')}</h2>
        </div>
        {!useSimplifiedSetup ? (
        <div className="v2-actions-row">
          {plans.length > 0 ? (
            <label className="v2-field">
              <span>{t('v2Vesinvest.planSelector', 'Plan revision')}</span>
              <select
                id="v2-vesinvest-plan-selector"
                name="vesinvestPlanSelector"
                className="v2-input"
                value={selectedPlanId ?? ''}
                onChange={(event) => {
                  const nextPlanId = event.target.value || null;
                  if (
                    nextPlanId !== selectedPlanId &&
                    hasUnsavedChanges &&
                    !window.confirm(
                      t(
                        'v2Vesinvest.unsavedChangesConfirm',
                        'Discard unsaved Vesinvest changes and switch to another revision?',
                      ),
                    )
                  ) {
                    return;
                  }
                  setSelectedPlanId(nextPlanId);
                }}
                disabled={loading || busy}
              >
                {plans.map((item) => (
                  <option key={item.id} value={item.id}>{`${item.utilityName} / v${item.versionNumber}`}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        ) : null}
      </div>

      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      {projectComposer.open ? (
        <div className="v2-modal-backdrop" onClick={closeProjectComposer}>
          <div
            className="v2-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vesinvest-project-composer-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="v2-section-header">
              <div>
                <p className="v2-overview-eyebrow">
                  {t('v2Vesinvest.investmentPlan', 'Investment plan')}
                </p>
                <h3 id="vesinvest-project-composer-title">
                  {t('v2Vesinvest.addProject', 'Add project')}
                </h3>
              </div>
            </div>
            <div className="v2-inline-form">
              <label className="v2-field">
                <span>{t('v2Vesinvest.projectCode', 'Code')}</span>
                <input
                  id="vesinvest-project-composer-code"
                  name="vesinvest-project-composer-code"
                  className="v2-input"
                  value={projectComposer.code}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="v2-field">
                <span>{t('v2Vesinvest.projectClass', 'Class')}</span>
                <select
                  id="vesinvest-project-composer-group"
                  name="vesinvest-project-composer-group"
                  className="v2-input"
                  value={projectComposerGroupKey}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      groupKey: event.target.value,
                    }))
                  }
                >
                  {groups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {resolveVesinvestGroupLabel(t, group.key, group.label)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="v2-field v2-field-wide">
                <span>{t('v2Vesinvest.projectName', 'Project')}</span>
                <input
                  id="vesinvest-project-composer-name"
                  name="vesinvest-project-composer-name"
                  className="v2-input"
                  value={projectComposer.name}
                  onChange={(event) =>
                    setProjectComposer((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <div className="v2-modal-actions">
              <button
                type="button"
                className="v2-btn"
                onClick={closeProjectComposer}
                disabled={busy}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-primary"
                onClick={handleCreateProjectDraft}
                disabled={
                  busy ||
                  loading ||
                  loadingPlan ||
                  groups.length === 0 ||
                  projectComposer.code.trim().length === 0 ||
                  projectComposer.name.trim().length === 0
                }
              >
                {t('v2Vesinvest.addProject', 'Add project')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {utilityBindingSection}

      {loadingState}

      {planStatusStrip}

      {workspaceTabs}

      {depreciationPlanSection}

      {useSimplifiedSetup ? null : (
        <>
          <VesinvestRevisionSurface>
            {actionRow}

            <div className="v2-overview-year-summary-grid">
              <div>
                <span>{t('v2Vesinvest.totalInvestments', 'Horizon total')}</span>
                <strong>{formatEur(totalInvestments)}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.projectCount', 'Projects')}</span>
                <strong>{draft.projects.length}</strong>
              </div>
              <div>
                <span>{t('v2Vesinvest.reviewDue', 'Next review due')}</span>
                <strong>
                  {formatDateTime(selectedSummary?.reviewDueAt ?? draft.reviewDueAt ?? null)}
                </strong>
              </div>
            </div>

            <div className="v2-inline-form v2-vesinvest-identity-form">
              <label className="v2-field">
                <span>{t('v2Vesinvest.planName', 'Plan name')}</span>
                <input
                  id="vesinvest-plan-name"
                  name="vesinvest-plan-name"
                  className="v2-input"
                  value={draft.name ?? ''}
                  onChange={(event) => setDraftField('name', event.target.value)}
                />
              </label>
              <label className="v2-field">
                <span>{t('v2Vesinvest.horizonYears', 'Horizon years')}</span>
                <input
                  id="vesinvest-horizon-years"
                  name="vesinvest-horizon-years"
                  className="v2-input"
                  type="number"
                  min={20}
                  max={50}
                  value={draft.horizonYears ?? 20}
                  onChange={(event) => {
                    const nextHorizon = Math.min(
                      50,
                      Math.max(20, Number(event.target.value || 20)),
                    );
                    const firstYear =
                      draft.horizonYearsRange[0] ?? new Date().getFullYear();
                    const years = buildHorizonYears(firstYear, nextHorizon);
                    setDraft((current) => ({
                      ...current,
                      horizonYears: nextHorizon,
                      horizonYearsRange: years,
                      projects: current.projects.map((project) => ({
                        ...project,
                        allocations: years.map(
                          (year) =>
                            project.allocations.find((item) => item.year === year) ?? {
                              year,
                              totalAmount: 0,
                              waterAmount: 0,
                              wastewaterAmount: 0,
                            },
                        ),
                      })),
                    }));
                  }}
                />
              </label>
            </div>
          </VesinvestRevisionSurface>

      {false && veetiSearchResults.length > 0 ? (
        <div className="v2-inline-list">
          {veetiSearchResults.map((hit) => (
            <button
              key={hit.id}
              type="button"
              className="v2-btn v2-btn-secondary"
              onClick={() => applyVeetiSearchHit(hit)}
            >
              {hit.name}
              {hit.businessId ? ` · ${hit.businessId}` : ''}
              {hit.municipality ? ` · ${hit.municipality}` : ''}
            </button>
          ))}
        </div>
      ) : null}

      {false ? (
      <section className="v2-vesinvest-section">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Vesinvest.identityLock', 'Identity guardrail')}
            </p>
            <h3>{t('v2Vesinvest.utilityName', 'Utility name')}</h3>
          </div>
          <span
            className={`v2-badge ${toneClass(
              utilityBindingMissing
                ? 'blocked'
                : utilityBindingMismatch
                ? 'provisional'
                : 'verified',
            )}`}
          >
            {utilityBindingMissing
              ? t('v2Vesinvest.baselineLinkPending', 'Not yet linked')
              : utilityBindingMismatch
              ? t('v2Vesinvest.pricingBlocked', 'Blocked')
              : t('v2Vesinvest.baselineVerified', 'Baseline verified')}
          </span>
        </div>
        {utilityBindingMissing ? (
          <>
            <div className="v2-inline-form">
              <label className="v2-field v2-field-wide">
                <span>{t('v2Vesinvest.veetiLookupLabel', 'VEETI lookup')}</span>
                <input
                  id="vesinvest-veeti-lookup"
                  name="vesinvest-veeti-lookup"
                  className="v2-input"
                  value={veetiSearchQuery}
                  placeholder={t(
                    'v2Vesinvest.veetiLookupPlaceholder',
                    'Search by business ID or utility name',
                  )}
                  onChange={(event) => setVeetiSearchQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="v2-btn"
                onClick={() => void runVeetiLookup()}
                disabled={busy || searchingVeeti}
              >
                {searchingVeeti
                  ? t('v2Overview.searchingButton', 'Searching...')
                  : t('v2Overview.searchButton', 'Search')}
              </button>
            </div>
            {veetiSearchResults.length > 0 ? (
              <div className="v2-inline-list">
                {veetiSearchResults.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className="v2-btn v2-btn-secondary"
                    onClick={() => applyVeetiSearchHit(hit)}
                  >
                    {hit.name}
                    {hit.businessId ? ` · ${hit.businessId}` : ''}
                    {hit.municipality ? ` · ${hit.municipality}` : ''}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="v2-overview-year-summary-grid">
            <div>
              <span>{t('v2Vesinvest.utilityName', 'Utility name')}</span>
              <strong>{linkedOrg?.nimi ?? draft.utilityName ?? '-'}</strong>
            </div>
            <div>
              <span>{t('v2Vesinvest.businessId', 'Business ID')}</span>
              <strong>{linkedOrg?.ytunnus ?? draft.businessId ?? '-'}</strong>
            </div>
            <div>
              <span>{t('v2Vesinvest.identitySource', 'Identity source')}</span>
              <strong>{t('v2Vesinvest.identityVeeti', 'VEETI')}</strong>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {loading || loadingPlan ? (
        <div className="v2-loading-state">
          <p>{t('common.loading', 'Loading...')}</p>
          <div className="v2-skeleton-line" />
        </div>
      ) : null}

      <VesinvestBaselineReviewSurface
        t={t}
        badge={
          <span className={`v2-badge ${toneClass(baselineVerified ? 'verified' : 'incomplete')}`}>
            {baselineYears.length > 0
              ? t('v2Vesinvest.baselineYearCount', '{{count}} year(s)', {
                  count: baselineYears.length,
                })
              : t('v2Vesinvest.baselineLinkPending', 'Not yet linked')}
          </span>
        }
        feePath={feePathSection}
      >
        {baselineYears.length === 0 ? (
          <p className="v2-muted">
            {t(
              'v2Vesinvest.evidenceEmpty',
              'No accepted baseline years yet. Finish VEETI, PDF, or manual verification before pricing is treated as final.',
            )}
          </p>
        ) : (
          <div className="v2-vesinvest-evidence-grid">
            {baselineYears.map((yearRow) => (
              <article key={yearRow.year} className="v2-vesinvest-evidence-card">
                <div className="v2-section-header">
                  <div>
                    <h4>{yearRow.year}</h4>
                    <p className="v2-muted">
                      {sourceStatusLabel(t, yearRow.sourceStatus, yearRow.planningRole)}
                    </p>
                  </div>
                  <span className={`v2-badge ${toneClass(yearRow.sourceStatus === 'INCOMPLETE' ? 'incomplete' : yearRow.sourceStatus === 'MIXED' ? 'provisional' : 'verified')}`}>
                    {qualityLabel(t, yearRow.quality)}
                  </span>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselineFinancials', 'Financials')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.financials)}</strong>
                </div>
                {datasetSourceNote(t, yearRow.financials) ? (
                  <small>{datasetSourceNote(t, yearRow.financials)}</small>
                ) : null}
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.prices)}</strong>
                </div>
                {datasetSourceNote(t, yearRow.prices) ? (
                  <small>{datasetSourceNote(t, yearRow.prices)}</small>
                ) : null}
                <div className="v2-keyvalue-row">
                  <span>{t('v2Reports.baselineVolumes', 'Sold volumes')}</span>
                  <strong>{datasetSourceLabel(t, yearRow.volumes)}</strong>
                </div>
                {datasetSourceNote(t, yearRow.volumes) ? (
                  <small>{datasetSourceNote(t, yearRow.volumes)}</small>
                ) : null}
                <div className="v2-keyvalue-row">
                  <span>{t('v2Vesinvest.baselineYearVolume', 'Combined sold volume')}</span>
                  <strong>{yearRow.combinedSoldVolume.toLocaleString()} m3</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </VesinvestBaselineReviewSurface>

      {activeWorkspaceView === 'investment' ? (
      <>
      <VesinvestMatrixSurface t={t}>
        <div className="v2-vesinvest-table-wrap v2-vesinvest-matrix-wrap" data-testid="vesinvest-grouped-plan">
          <table className="v2-vesinvest-table v2-vesinvest-plan-matrix">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                {draft.horizonYearsRange.map((year) => (
                  <th key={`matrix-head-${year}`}>{year}</th>
                ))}
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {groupedPlanMatrix.length === 0 ? (
                <tr>
                  <td
                    colSpan={draft.horizonYearsRange.length + 3}
                    className="v2-muted"
                  >
                    <div>
                      <span>
                        {t(
                          'v2Vesinvest.projectEmpty',
                          'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                        )}
                      </span>
                      <button
                        type="button"
                        className="v2-btn v2-btn-primary"
                        data-testid="vesinvest-empty-add-project"
                        onClick={openProjectComposer}
                        disabled={busy || loading || loadingPlan || groups.length === 0}
                      >
                        {t('v2Vesinvest.addProject', 'Add project')}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
              {groupedPlanMatrix.map((section) => (
                <React.Fragment key={section.groupKey}>
                  <tr className="v2-vesinvest-matrix-group-row">
                    <td />
                    <td className="v2-vesinvest-matrix-label">{section.groupLabel}</td>
                    {section.yearlyTotals.map((item) => (
                      <td key={`${section.groupKey}-${item.year}`}>
                        {formatPlanMatrixAmount(item.totalAmount)}
                      </td>
                    ))}
                    <td>{formatPlanMatrixAmount(section.totalAmount)}</td>
                  </tr>
                  {section.projects.map((project) => (
                    <tr
                      key={`${section.groupKey}-${project.code}`}
                      className="v2-vesinvest-matrix-project-row"
                    >
                      <td>{project.code}</td>
                      <td>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</td>
                      {project.yearlyTotals.map((item) => (
                        <td key={`${project.code}-${item.year}`}>
                          {formatPlanMatrixAmount(item.totalAmount)}
                        </td>
                      ))}
                      <td>{formatPlanMatrixAmount(project.totalAmount)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {groupedPlanMatrix.length > 0 ? (
                <tr className="v2-vesinvest-matrix-total-row">
                  <td />
                  <td className="v2-vesinvest-matrix-label">
                    {t('v2Vesinvest.totalInvestments', 'Horizon total')}
                  </td>
                  {yearTotals.map((item) => (
                    <td key={`matrix-total-${item.year}`}>
                      {formatPlanMatrixAmount(item.totalAmount)}
                    </td>
                  ))}
                  <td>{formatPlanMatrixAmount(totalInvestments)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </VesinvestMatrixSurface>

      <VesinvestRegisterSurface t={t}>
        <div className="v2-vesinvest-table-wrap">
          <table className="v2-vesinvest-table">
            <thead>
              <tr>
                <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                <th>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</th>
                <th>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</th>
                <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                <th>{t('common.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {draft.projects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="v2-muted">
                    {t(
                      'v2Vesinvest.projectEmpty',
                      'No projects yet. Add the investment plan first, then connect baseline evidence later.',
                    )}
                  </td>
                </tr>
              ) : null}
              {draft.projects.map((project, index) => (
                <tr key={project.id ?? `draft-project-row-${index}`}>
                  <td>
                    <input
                      id={`vesinvest-project-code-${index}`}
                      name={`vesinvest-project-code-${index}`}
                      className="v2-input"
                      value={project.code}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          code: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      id={`vesinvest-project-name-${index}`}
                      name={`vesinvest-project-name-${index}`}
                      className="v2-input"
                      value={project.name}
                      onChange={(event) =>
                        updateProject(index, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <select
                      id={`vesinvest-project-group-${index}`}
                      name={`vesinvest-project-group-${index}`}
                      className="v2-input"
                      value={project.groupKey}
                      onChange={(event) => {
                        const group = groups.find((item) => item.key === event.target.value);
                        updateProject(index, (current) => ({
                          ...current,
                          groupKey: event.target.value,
                          groupLabel: group?.label,
                          investmentType: resolveInvestmentTypeFromGroupKey(
                            event.target.value,
                          ),
                          depreciationClassKey:
                            group?.defaultDepreciationClassKey ?? group?.key ?? null,
                          defaultAccountKey: group?.defaultAccountKey ?? null,
                          reportGroupKey: group?.reportGroupKey ?? null,
                        }));
                      }}
                    >
                      {groups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {resolveVesinvestGroupLabel(t, group.key, group.label)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formatEur(project.waterAmount ?? 0)}</td>
                  <td>{formatEur(project.wastewaterAmount ?? 0)}</td>
                  <td>{formatEur(project.totalAmount ?? 0)}</td>
                  <td><button type="button" className="v2-btn v2-btn-small v2-btn-danger" onClick={() => setDraft((current) => ({ ...current, projects: current.projects.filter((_, projectIndex) => projectIndex !== index) }))}>{t('common.delete', 'Delete')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VesinvestRegisterSurface>

      {draft.projects.length > 0 ? (
        <VesinvestProjectDetailsSurface>
          {draft.projects.map((project, projectIndex) => (
            <section
              key={project.id ?? `draft-project-details-${projectIndex}`}
              className="v2-vesinvest-project-card"
              data-vesinvest-project-index={projectIndex}
            >
              <div className="v2-section-header">
                <div>
                  <p className="v2-overview-eyebrow">{project.code}</p>
                  <h3>{project.name || t('v2Vesinvest.projectUnnamed', 'Unnamed project')}</h3>
                  <p className="v2-muted">
                    {`${typeLabel(t, project.investmentType)} · ${resolveVesinvestGroupLabel(
                      t,
                      project.groupKey,
                      project.groupLabel,
                    )}`}
                  </p>
                </div>
                <div className="v2-overview-year-summary-grid v2-vesinvest-project-meta">
                  <div>
                    <span>{t('v2Vesinvest.projectWaterTotal', 'Water total')}</span>
                    <strong>{formatEur(project.waterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectWastewaterTotal', 'Wastewater total')}</span>
                    <strong>{formatEur(project.wastewaterAmount ?? 0)}</strong>
                  </div>
                  <div>
                    <span>{t('v2Vesinvest.projectTotal', 'Total')}</span>
                    <strong>{formatEur(project.totalAmount ?? 0)}</strong>
                  </div>
                </div>
              </div>
              <div className="v2-inline-form">
                <label className="v2-field">
                  <span>{t('v2Vesinvest.projectSubtype', 'Subtype')}</span>
                  <input
                    id={`vesinvest-project-subtype-${projectIndex}`}
                    name={`vesinvest-project-subtype-${projectIndex}`}
                    className="v2-input"
                    value={project.subtype ?? ''}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        subtype: event.target.value || null,
                      }))
                    }
                  />
                </label>
                <label className="v2-field v2-field-wide">
                  <span>{t('v2Vesinvest.projectNotes', 'Notes')}</span>
                  <input
                    id={`vesinvest-project-notes-${projectIndex}`}
                    name={`vesinvest-project-notes-${projectIndex}`}
                    className="v2-input"
                    value={project.notes ?? ''}
                    onChange={(event) =>
                      updateProject(projectIndex, (current) => ({
                        ...current,
                        notes: event.target.value || null,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="v2-vesinvest-table-wrap">
                <table className="v2-vesinvest-table v2-vesinvest-allocation-table">
                  <thead>
                    <tr>
                      <th>{t('v2Vesinvest.allocationMetric', 'Split')}</th>
                      {draft.horizonYearsRange.map((year) => <th key={year}>{year}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(['totalAmount', 'waterAmount', 'wastewaterAmount'] as const).map((fieldKey) => (
                      <tr key={`${project.code}-${fieldKey}`}>
                        <td>
                          {allocationFieldLabel(t, fieldKey)}
                        </td>
                        {draft.horizonYearsRange.map((year) => {
                          const allocation =
                            project.allocations.find((item) => item.year === year) ?? null;
                          return (
                            <td key={`${project.code}-${fieldKey}-${year}`}>
                              <input
                                id={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                name={`vesinvest-allocation-${projectIndex}-${fieldKey}-${year}`}
                                aria-label={`${project.code} ${year} ${allocationFieldLabel(
                                  t,
                                  fieldKey,
                                )}`}
                                className="v2-input"
                                type="number"
                                min={0}
                                value={allocation?.[fieldKey] ?? 0}
                                onChange={(event) =>
                                  updateProjectAllocation(
                                    projectIndex,
                                    year,
                                    fieldKey,
                                    Number(event.target.value || 0),
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </VesinvestProjectDetailsSurface>
      ) : null}
      </>
      ) : null}

      <div className="v2-kpi-strip v2-kpi-strip-three">
        <article><h3>{t('v2Vesinvest.yearlySummary', 'Annual derived totals')}</h3><p>{yearTotals.filter((item) => item.totalAmount > 0).slice(0, 3).map((item) => `${item.year}: ${formatEur(item.totalAmount)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p></article>
        <article><h3>{t('v2Vesinvest.fiveYearBands', 'Five-year bands')}</h3><p>{fiveYearBands.slice(0, 3).map((band) => `${band.startYear}-${band.endYear}: ${formatEur(band.totalAmount)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p></article>
        <article><h3>{t('v2Vesinvest.allocationSummary', 'Service split')}</h3><p>{draft.projects.slice(0, 3).map((project) => `${project.code}: ${formatEur(project.waterAmount ?? 0)} / ${formatEur(project.wastewaterAmount ?? 0)}`).join(' | ') || t('v2Vesinvest.none', 'None')}</p><small>{t('v2Vesinvest.allocationSummaryHint', 'Water and wastewater totals are derived from the yearly allocation split above.')}</small></article>
      </div>
        </>
      )}
    </section>
  );
};
