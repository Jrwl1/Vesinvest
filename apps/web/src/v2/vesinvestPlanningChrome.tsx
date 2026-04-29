import type { TFunction } from 'i18next';
import React from 'react';

import type { V2VesinvestGroupDefinition,V2VesinvestPlan,V2VesinvestPlanSummary } from '../api';
import { formatDateTime,formatEur } from './format';
import { resolveVesinvestGroupLabel } from './vesinvestLabels';
import {
  buildHorizonYears,
  toneClass,
  type VesinvestDraft,
  type VesinvestWorkspaceView,
} from './vesinvestPlanningModel';

type ProjectComposerState = {
  open: boolean;
  code: string;
  groupKey: string;
  name: string;
};

type YearTotal = {
  year: number;
  totalAmount: number;
};

type FiveYearBand = {
  startYear: number;
  endYear: number;
  totalAmount: number;
};

export function VesinvestPanelHeader({
  t,
  useSimplifiedSetup,
  plans,
  selectedPlanId,
  hasUnsavedChanges,
  loading,
  busy,
  onSelectPlan,
}: {
  t: TFunction;
  useSimplifiedSetup: boolean;
  plans: V2VesinvestPlanSummary[];
  selectedPlanId: string | null;
  hasUnsavedChanges: boolean;
  loading: boolean;
  busy: boolean;
  onSelectPlan: (planId: string | null) => void;
}) {
  return (
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
                onChange={(event) => onSelectPlan(event.target.value || null)}
                disabled={loading || busy}
                data-has-unsaved-changes={hasUnsavedChanges ? 'true' : 'false'}
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
  );
}

export function VesinvestProjectComposerDialog({
  t,
  busy,
  loading,
  loadingPlan,
  groups,
  projectComposer,
  projectComposerGroupKey,
  setProjectComposer,
  closeProjectComposer,
  handleCreateProjectDraft,
}: {
  t: TFunction;
  busy: boolean;
  loading: boolean;
  loadingPlan: boolean;
  groups: V2VesinvestGroupDefinition[];
  projectComposer: ProjectComposerState;
  projectComposerGroupKey: string;
  setProjectComposer: React.Dispatch<React.SetStateAction<ProjectComposerState>>;
  closeProjectComposer: () => void;
  handleCreateProjectDraft: () => void;
}) {
  if (!projectComposer.open) {
    return null;
  }

  return (
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
  );
}

export function VesinvestPlanningActionRow({
  t,
  activeWorkspaceView,
  projectActionClass,
  saveActionClass,
  syncActionClass,
  reportActionClass,
  openProjectComposer,
  busy,
  loading,
  loadingPlan,
  groupsCount,
  plan,
  utilityBindingMissing,
  showDownstreamActions,
  pricingReady,
  persist,
  onOpenReports,
}: {
  t: TFunction;
  activeWorkspaceView: VesinvestWorkspaceView;
  projectActionClass: string;
  saveActionClass: string;
  syncActionClass: string;
  reportActionClass: string;
  openProjectComposer: () => void;
  busy: boolean;
  loading: boolean;
  loadingPlan: boolean;
  groupsCount: number;
  plan: V2VesinvestPlan | null;
  utilityBindingMissing: boolean;
  showDownstreamActions: boolean;
  pricingReady: boolean;
  persist: (mode: 'create' | 'save' | 'sync' | 'clone') => Promise<void>;
  onOpenReports: () => void;
}) {
  return (
    <div className="v2-vesinvest-action-stack">
      <div className="v2-actions-row v2-vesinvest-workflow-actions">
        {activeWorkspaceView === 'investment' ? (
          <button
            type="button"
            className={projectActionClass}
            onClick={openProjectComposer}
            disabled={busy || loading || loadingPlan || groupsCount === 0}
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
              {t('v2TariffPlan.openTariffPlan', 'Open Tariff Plan')}
            </button>
            <button
              type="button"
              className={reportActionClass}
              onClick={onOpenReports}
              disabled={busy}
            >
              {t('v2Reports.openReports', 'Open Reports')}
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
}

export function VesinvestWorkspaceTabs({
  t,
  activeWorkspaceView,
  setActiveWorkspaceView,
}: {
  t: TFunction;
  activeWorkspaceView: VesinvestWorkspaceView;
  setActiveWorkspaceView: React.Dispatch<React.SetStateAction<VesinvestWorkspaceView>>;
}) {
  return (
    <section className="v2-vesinvest-section">
      <div
        className="v2-actions-row"
        role="group"
        aria-label={t('v2Vesinvest.workspaceTabs', 'Vesinvest workspace views')}
      >
        <button
          type="button"
          className={`v2-btn ${activeWorkspaceView === 'evidence' ? 'v2-btn-primary' : ''}`}
          aria-pressed={activeWorkspaceView === 'evidence'}
          onClick={() => setActiveWorkspaceView('evidence')}
        >
          {t('v2Vesinvest.assetEvidenceTab', 'Asset evidence')}
        </button>
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
}

export function VesinvestPlanStatusStrip({
  t,
  draft,
  baselineVerified,
  showDownstreamActions,
  pricingStatus,
  hasSavedPricingOutput,
  revisionStatusMessage,
  pricingReady,
  assetEvidenceReady,
  assetEvidenceMissingCount,
  assetEvidenceMissingLabels,
}: {
  t: TFunction;
  draft: VesinvestDraft;
  baselineVerified: boolean;
  showDownstreamActions: boolean;
  pricingStatus: string | null | undefined;
  hasSavedPricingOutput: boolean;
  revisionStatusMessage: string | null;
  pricingReady: boolean;
  assetEvidenceReady: boolean;
  assetEvidenceMissingCount: number;
  assetEvidenceMissingLabels: string[];
}) {
  const pricingTone =
    pricingStatus === 'verified' || pricingStatus === 'provisional' || pricingStatus === 'blocked'
      ? pricingStatus
      : 'blocked';

  return (
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
          <h3>{t('v2Vesinvest.pricingState', 'Forecast sync')}</h3>
          <p>
            <span className={`v2-badge ${toneClass(pricingTone)}`}>
              {pricingStatus === 'verified'
                ? t('v2Vesinvest.pricingVerified', 'Verified')
                : pricingStatus === 'provisional'
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
                    'Sync the plan to open tariff planning.',
                  )
                : baselineVerified && !assetEvidenceReady
                  ? t(
                      'v2Vesinvest.assetEvidenceMissingHint',
                      '{{count}} asset evidence area(s) still need input before tariff planning is ready.',
                      { count: assetEvidenceMissingCount },
                    )
                    + (assetEvidenceMissingLabels.length > 0
                      ? ` ${assetEvidenceMissingLabels.join(', ')}.`
                      : '')
                : baselineVerified
                  ? t(
                      'v2Vesinvest.pricingPlanMissingHint',
                      'Add investment rows and yearly allocations before tariff-plan and financing output can be opened.',
                    )
                  : t(
                      'v2Vesinvest.pricingBlockedHint',
                      'Tariff-plan and financing output stay blocked until the baseline is verified.',
                    )}
          </small>
        </article>
      ) : null}
    </div>
  );
}

export function VesinvestRevisionSummary({
  t,
  actionRow,
  draft,
  totalInvestments,
  reviewDueAt,
  setDraftField,
  setDraft,
}: {
  t: TFunction;
  actionRow: React.ReactNode;
  draft: VesinvestDraft;
  totalInvestments: number;
  reviewDueAt: string | null | undefined;
  setDraftField: <K extends keyof VesinvestDraft>(field: K, value: VesinvestDraft[K]) => void;
  setDraft: React.Dispatch<React.SetStateAction<VesinvestDraft>>;
}) {
  return (
    <>
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
          <strong>{formatDateTime(reviewDueAt ?? draft.reviewDueAt ?? null)}</strong>
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
              const nextHorizon = Math.min(50, Math.max(20, Number(event.target.value || 20)));
              const firstYear = draft.horizonYearsRange[0] ?? new Date().getFullYear();
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
    </>
  );
}

export function VesinvestDerivedTotalsStrip({
  t,
  draft,
  yearTotals,
  fiveYearBands,
  forecastSyncLabel,
}: {
  t: TFunction;
  draft: VesinvestDraft;
  yearTotals: YearTotal[];
  fiveYearBands: FiveYearBand[];
  forecastSyncLabel?: string | null;
}) {
  const horizonRows = yearTotals.filter((item) => item.totalAmount > 0);
  const horizonTotal = horizonRows.reduce((sum, item) => sum + item.totalAmount, 0);
  const waterTotal = draft.projects.reduce(
    (sum, project) => sum + (project.waterAmount ?? 0),
    0,
  );
  const wastewaterTotal = draft.projects.reduce(
    (sum, project) => sum + (project.wastewaterAmount ?? 0),
    0,
  );
  const peakYear =
    horizonRows.length > 0
      ? horizonRows.reduce((current, item) =>
          item.totalAmount > current.totalAmount ? item : current,
        )
      : null;
  const horizonLabel =
    horizonRows.length > 0
      ? `${horizonRows[0]!.year}-${horizonRows[horizonRows.length - 1]!.year}`
      : t('v2Vesinvest.noHorizonYears', 'No horizon years');

  return (
    <div className="v2-kpi-strip v2-kpi-strip-three v2-vesinvest-investment-picture">
      <article>
        <h3>{t('v2Vesinvest.horizonTotal', 'Horizon total')}</h3>
        <strong>{formatEur(horizonTotal)}</strong>
        <p>{horizonLabel}</p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.peakAnnualInvestment', 'Peak annual investment')}</h3>
        <p>
          {peakYear
            ? `${peakYear.year}: ${formatEur(peakYear.totalAmount)}`
            : t('v2Vesinvest.none', 'None')}
        </p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.fiveYearBands', 'Five-year bands')}</h3>
        <p>
          {fiveYearBands
            .slice(0, 3)
            .map((band) => `${band.startYear}-${band.endYear}: ${formatEur(band.totalAmount)}`)
            .join(' | ') || t('v2Vesinvest.none', 'None')}
        </p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.allocationSummary', 'Service split')}</h3>
        <p>{`${t('v2Vesinvest.waterShort', 'Water')}: ${formatEur(waterTotal)} | ${t(
          'v2Vesinvest.wastewaterShort',
          'Wastewater',
        )}: ${formatEur(wastewaterTotal)}`}</p>
      </article>
      <article>
        <h3>{t('v2Vesinvest.projectCount', 'Projects')}</h3>
        <strong>{draft.projects.length}</strong>
        <p>{forecastSyncLabel ?? t('v2Vesinvest.forecastSyncUnknown', 'Forecast sync pending')}</p>
      </article>
    </div>
  );
}
