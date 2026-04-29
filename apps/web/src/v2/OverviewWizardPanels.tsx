import type { TFunction } from 'i18next';
import React from 'react';

import type {
  V2ImportYearResultToZeroSignal,
  VeetiOrganizationSearchHit,
} from '../api';
import {
  buildOverviewYearFinancialSourceChip,
  buildOverviewYearTargetChip,
} from './overviewRenderers';
import { PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS } from './overviewWorkflow';
import type { ImportYearSourceLayer } from './yearReview';

type AcceptedPlanningYearRow = {
  vuosi: number;
  sourceStatus?: string | undefined;
  datasetCounts?: Record<string, number>;
  resultToZero?: V2ImportYearResultToZeroSignal;
  sourceLayers?: ImportYearSourceLayer[];
  baselineReady?: boolean;
  baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
  completeness?: {
    tilinpaatos?: boolean;
    taksa?: boolean;
    volume_vesi?: boolean;
    volume_jatevesi?: boolean;
  };
};

function resolveAcceptedPlanningAvailability(row: AcceptedPlanningYearRow): {
  financials: boolean;
  prices: boolean;
  volumes: boolean;
} {
  const useBaselineReadiness =
    typeof row.baselineReady === 'boolean' ||
    Array.isArray(row.baselineMissingRequirements);
  const baselineMissing = new Set(row.baselineMissingRequirements ?? []);
  if (useBaselineReadiness) {
    return {
      financials: !baselineMissing.has('financialBaseline'),
      prices: !baselineMissing.has('prices'),
      volumes: !baselineMissing.has('volumes'),
    };
  }
  return {
    financials: row.completeness?.tilinpaatos !== false,
    prices: row.completeness?.taksa !== false,
    volumes:
      row.completeness?.volume_vesi !== false ||
      row.completeness?.volume_jatevesi !== false,
  };
}

type OverviewConnectStepProps = {
  t: TFunction;
  workflowStep?: number;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  searching: boolean;
  connecting: boolean;
  importingYears: boolean;
  syncing: boolean;
  searchResults: VeetiOrganizationSearchHit[];
  selectedOrg: VeetiOrganizationSearchHit | null;
  onSelectOrg: (org: VeetiOrganizationSearchHit | null) => void;
  renderHighlightedSearchMatch: (value: string) => React.ReactNode;
  selectedOrgStillVisible: boolean;
  selectedOrgName: string;
  selectedOrgBusinessId: string;
  selectedOrgMunicipality: string | null;
  selectedOrgReadyToConnect: boolean;
  onConnect: (org: VeetiOrganizationSearchHit) => void;
};

export const OverviewConnectStep: React.FC<OverviewConnectStepProps> = ({
  t,
  workflowStep = 1,
  query,
  onQueryChange,
  onSearch,
  searching,
  connecting,
  importingYears,
  syncing,
  searchResults,
  selectedOrg,
  onSelectOrg,
  renderHighlightedSearchMatch,
  selectedOrgStillVisible,
  selectedOrgName,
  selectedOrgBusinessId,
  selectedOrgMunicipality,
  selectedOrgReadyToConnect,
  onConnect,
}) => {
  const headline =
    workflowStep >= 4
      ? t('v2Vesinvest.workflowVerifyEvidence', 'Verify baseline & evidence')
      : workflowStep === 1
      ? t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility')
      : t('v2Overview.wizardQuestionConnect');
  const body =
    workflowStep >= 4
      ? t(
          'v2Vesinvest.workflowVerifyEvidenceBody',
          'Use VEETI, PDF, workbook, or manual corrections to verify the accepted baseline that pricing will rely on.',
        )
      : workflowStep === 1
      ? t(
          'v2Vesinvest.workflowIdentifyUtilityBody',
          'Search and connect the VEETI utility before creating the first Vesinvest plan.',
        )
      : t('v2Overview.wizardBodyConnect');

  return (
    <section>
      <article className="v2-card v2-overview-step-card">
        <div className="v2-section-header">
          <div>
            <p className="v2-overview-eyebrow">
              {t('v2Overview.wizardProgress', {
                step: workflowStep,
                total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
              })}
            </p>
            <h2>{headline}</h2>
          </div>
          <span className="v2-chip v2-status-warning">
            {t('v2Overview.disconnected', 'Not connected')}
          </span>
        </div>

        <p className="v2-muted v2-overview-review-body">{body}</p>
      <div className="v2-inline-form">
        <input
          id="v2-overview-org-search"
          name="orgSearch"
          className="v2-input"
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') {
              return;
            }
            event.preventDefault();
            onSearch();
          }}
          disabled={connecting || importingYears || syncing}
          placeholder={t(
            'v2Overview.searchPlaceholder',
            'Search by name or business ID',
          )}
        />
        <button
          className="v2-btn"
          type="button"
          onClick={onSearch}
          disabled={
            searching ||
            connecting ||
            importingYears ||
            syncing ||
            query.trim().length < 2
          }
        >
          {searching
            ? t('v2Overview.searchingButton', 'Searching...')
            : t('v2Overview.searchButton', 'Search')}
        </button>
      </div>

      {searchResults.length > 0 ? (
        <div className="v2-result-list">
          {searchResults.map((org) => {
            const isActive = selectedOrg?.Id === org.Id;
            const orgName =
              org.Nimi ??
              t('v2Overview.veetiFallbackName', 'VEETI {{id}}', {
                id: org.Id,
              });
            return (
              <button
                type="button"
                key={org.Id}
                className={`v2-result-row ${isActive ? 'active' : ''}`}
                onClick={() => onSelectOrg(org)}
                disabled={connecting || importingYears || syncing}
              >
                <div className="v2-result-main">
                  <strong>{renderHighlightedSearchMatch(orgName)}</strong>
                  <span>
                    {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
                    {renderHighlightedSearchMatch(org.YTunnus ?? '-')}
                  </span>
                </div>
                <div className="v2-result-meta">
                  <span>
                    {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                    {renderHighlightedSearchMatch(org.Kunta ?? '-')}
                  </span>
                  {isActive ? (
                    <span className="v2-result-selected">
                      {t('v2Overview.resultSelected', 'Selected')}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedOrgStillVisible ? (
        <div className="v2-import-org-summary">
          <div>
            <strong>
              {t('v2Overview.organizationLabel', 'Organization')}:{' '}
              {selectedOrgName}
            </strong>
            <span>
              {t('v2Overview.businessIdLabel', 'Business ID')}:{' '}
              {selectedOrgBusinessId}
            </span>
            {selectedOrgMunicipality ? (
              <span>
                {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                {selectedOrgMunicipality}
              </span>
            ) : null}
          </div>
          <div className="v2-import-org-summary-actions">
            <button
              type="button"
              className="v2-btn v2-btn-primary v2-btn-small"
              onClick={() => {
                if (!selectedOrg) return;
                onConnect(selectedOrg);
              }}
              disabled={
                connecting ||
                importingYears ||
                syncing ||
                !selectedOrgReadyToConnect ||
                !selectedOrg
              }
            >
              {connecting
                ? t('v2Overview.connectingButton', 'Connecting...')
                : t('v2Overview.connectButton', 'Connect selected utility')}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-small"
              onClick={() => onSelectOrg(null)}
              disabled={connecting || importingYears || syncing}
            >
              {t('v2Overview.clearSelectionButton', 'Clear selection')}
            </button>
          </div>
        </div>
      ) : null}

      </article>
    </section>
  );
};

type OverviewPlanningBaselineStepProps = {
  t: TFunction;
  workflowStep?: number;
  wizardBackLabel: string | null;
  onBack: () => void;
  includedPlanningYears: number[];
  excludedYearsSorted: number[];
  correctedPlanningYears: number[];
  correctedPlanningManualDataTypes: string[];
  correctedPlanningVeetiDataTypes: string[];
  correctedYearsLabel: string;
  includedPlanningYearsLabel: string;
  renderDatasetTypeList: (dataTypes: string[]) => string;
  planningBaselineButtonClass: string;
  onCreatePlanningBaseline: () => void;
  creatingPlanningBaseline: boolean;
  importedBlockedYearCount: number;
};

export const OverviewPlanningBaselineStep: React.FC<
  OverviewPlanningBaselineStepProps
> = ({
  t,
  workflowStep = 5,
  includedPlanningYears,
  excludedYearsSorted,
  correctedPlanningYears,
  correctedPlanningManualDataTypes,
  correctedPlanningVeetiDataTypes,
  correctedYearsLabel,
  includedPlanningYearsLabel,
  renderDatasetTypeList,
  planningBaselineButtonClass,
  onCreatePlanningBaseline,
  creatingPlanningBaseline,
  importedBlockedYearCount,
}) => (
  <section className="v2-card">
    <div className="v2-section-header">
      <div>
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', {
            step: workflowStep,
            total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
          })}
        </p>
        <h2>{t('v2Overview.wizardQuestionBaseline')}</h2>
      </div>
      <span className="v2-badge v2-status-provenance">
        {includedPlanningYears.length} {t('v2Overview.wizardSummaryImportedYears')}
      </span>
    </div>

    <p className="v2-muted v2-overview-review-body">
      {t('v2Overview.wizardBodyBaseline')}
    </p>

    <div className="v2-planning-baseline-grid">
      <article className="v2-planning-baseline-card">
        <span>{t('v2Overview.baselineIncludedYears')}</span>
        <strong>
          {includedPlanningYears.length > 0
            ? includedPlanningYears.join(', ')
            : t('v2Overview.noYearsSelected', 'None selected')}
        </strong>
      </article>
      <article className="v2-planning-baseline-card">
        <span>{t('v2Overview.baselineExcludedYears')}</span>
        <strong>
          {excludedYearsSorted.length > 0
            ? excludedYearsSorted.join(', ')
            : t('v2Overview.noYearsSelected', 'None selected')}
        </strong>
      </article>
      <article className="v2-planning-baseline-card">
        <span>{t('v2Overview.baselineCorrectedYears')}</span>
        <strong>
          {correctedPlanningYears.length > 0
            ? correctedPlanningYears.join(', ')
            : t('v2Overview.noYearsSelected', 'None selected')}
        </strong>
      </article>
    </div>

    <section className="v2-manual-section">
      <div className="v2-manual-section-head">
        <h4>
          {t(
            'v2Overview.baselineClosureTitle',
            'Before Forecast and Reports unlock',
          )}
        </h4>
      </div>
      <div className="v2-keyvalue-list">
        <div className="v2-keyvalue-row">
          <span>{t('v2Overview.baselineClosureChanged', 'Changed in review')}</span>
          <span>
            {correctedPlanningYears.length > 0 &&
            correctedPlanningManualDataTypes.length > 0
              ? t(
                  'v2Overview.baselineClosureChangedBody',
                  'Years {{years}} now use {{datasets}}.',
                  {
                    years: correctedYearsLabel,
                    datasets: renderDatasetTypeList(correctedPlanningManualDataTypes),
                  },
                )
              : t(
                  'v2Overview.baselineClosureNoCorrections',
                  'No corrected years are queued right now.',
                )}
          </span>
        </div>
        <div className="v2-keyvalue-row">
          <span>{t('v2Overview.baselineClosureStillVeeti', 'Still from VEETI')}</span>
          <span>
            {correctedPlanningVeetiDataTypes.length > 0
              ? renderDatasetTypeList(correctedPlanningVeetiDataTypes)
              : t(
                  'v2Overview.baselineClosureNoVeetiCarryForward',
                  'No VEETI carry-forward remains for the corrected years.',
                )}
          </span>
        </div>
        <div className="v2-keyvalue-row">
          <span>{t('v2Overview.baselineClosureQueued', 'Still queued')}</span>
          <span>
            {t(
              'v2Overview.baselineClosureQueuedBody',
              'Create the planning baseline for {{years}}. Forecast and Reports stay locked until that happens.',
              { years: includedPlanningYearsLabel },
            )}
          </span>
        </div>
      </div>
    </section>

    <div className="v2-overview-review-actions">
      <button
        type="button"
        className={planningBaselineButtonClass}
        onClick={onCreatePlanningBaseline}
        disabled={
          creatingPlanningBaseline ||
          includedPlanningYears.length === 0 ||
          importedBlockedYearCount > 0
        }
      >
        {creatingPlanningBaseline
          ? t('common.loading', 'Loading...')
          : t('v2Overview.createPlanningBaseline')}
      </button>
      <p className="v2-muted">
        {includedPlanningYears.length === 0
          ? t('v2Overview.wizardBaselinePendingHint')
          : importedBlockedYearCount > 0
          ? t('v2Overview.baselineBlockedHint')
          : t('v2Overview.baselineReadyHint')}
      </p>
    </div>
  </section>
);

type OverviewForecastHandoffStepProps = {
  t: TFunction;
  wizardBackLabel: string | null;
  onBack: () => void;
  acceptedPlanningYearRows: AcceptedPlanningYearRow[];
  correctedPlanningYears: number[];
  excludedYearsSorted: number[];
  sourceStatusClassName: (status: string | undefined) => string;
  sourceStatusLabel: (status: string | undefined) => string;
  renderDatasetCounts: (counts?: Record<string, number>) => string;
  renderYearValuePreview: (
    year: number,
    availability?: {
      financials: boolean;
      prices: boolean;
      volumes: boolean;
    },
    options?: {
      compact?: boolean;
    },
  ) => React.ReactNode;
  openForecastButtonClass: string;
  onManageYears: () => void;
  onReopenYearReview: (year: number) => void;
  onDeleteYear: (year: number) => void;
  onExcludeYear: (year: number) => void;
  onRestoreYear: (year: number) => void;
  onRestoreVeeti: (year: number) => void;
  onOpenForecast: () => void;
};

export const OverviewForecastHandoffStep: React.FC<
  OverviewForecastHandoffStepProps
> = ({
  t,
  acceptedPlanningYearRows,
  correctedPlanningYears,
  excludedYearsSorted,
  sourceStatusLabel,
  renderDatasetCounts,
  renderYearValuePreview,
  openForecastButtonClass,
  onReopenYearReview,
  onExcludeYear,
  onRestoreYear,
  onRestoreVeeti,
  onOpenForecast,
}) => {
  const correctedAcceptedYearCount = acceptedPlanningYearRows.filter((row) =>
    correctedPlanningYears.includes(row.vuosi),
  ).length;

  return (
  <section className="v2-card v2-overview-handoff-card">
    <div className="v2-section-header">
      <div>
        <h2>{t('v2Overview.acceptedBaselineTitle', 'Accepted baseline')}</h2>
        <p>
          {t(
            'v2Overview.acceptedBaselineBody',
            'Historical years are accepted and ready for asset planning.',
          )}
        </p>
      </div>
      <span className="v2-badge v2-status-positive">
        {t('v2Shell.statusAccepted', 'Accepted')}
      </span>
    </div>

    <div className="v2-actions-row v2-overview-handoff-management-row">
      <button
        type="button"
        className={openForecastButtonClass}
        onClick={onOpenForecast}
      >
        {t('v2Overview.openAssetManagement', 'Open Asset Management')}
      </button>
    </div>

    <div className="v2-overview-handoff-summary">
      <article className="v2-overview-handoff-summary-item">
        <span>{t('v2Overview.baselineIncludedYears', 'Included years')}</span>
        <strong>{acceptedPlanningYearRows.length}</strong>
      </article>
      <article className="v2-overview-handoff-summary-item">
        <span>{t('v2Overview.correctedRepairedYears', 'Corrected / repaired years')}</span>
        <strong>{correctedAcceptedYearCount}</strong>
      </article>
      <article className="v2-overview-handoff-summary-item">
        <span>{t('v2Overview.baselineAcceptanceState', 'Acceptance')}</span>
        <strong>{t('v2Overview.allChangesAccepted', 'All changes accepted')}</strong>
      </article>
    </div>

    {acceptedPlanningYearRows.length > 0 ? (
        <div className="v2-year-status-list v2-year-status-list-accepted">
        {acceptedPlanningYearRows.map((row) => {
          const corrected = correctedPlanningYears.includes(row.vuosi);
          const targetChip = buildOverviewYearTargetChip(t, row.resultToZero);
          const sourceChip = buildOverviewYearFinancialSourceChip(
            t,
            row.sourceLayers,
            row.sourceStatus,
          );
          const availability = resolveAcceptedPlanningAvailability(row);
          const compactSourceLabel =
            row.sourceLayers != null && row.sourceLayers.length > 0
              ? sourceChip.label
              : row.sourceStatus != null
              ? sourceStatusLabel(row.sourceStatus)
              : sourceChip.label;
          return (
            <article key={`accepted-${row.vuosi}`} className="v2-year-status-row ready">
              <div className="v2-year-status-head">
                <div className="v2-year-status-labels">
                  <strong>{row.vuosi}</strong>
                </div>
              </div>

              <div className="v2-overview-year-chip-row">
                <span className={`v2-badge ${targetChip.toneClass}`}>
                  {targetChip.label}
                </span>
              </div>

              {renderYearValuePreview(row.vuosi, availability, {
                compact: true,
              })}

              <div className="v2-year-card-meta">
                <span className="v2-overview-handoff-year-source">
                  {compactSourceLabel}
                </span>
                <span>
                  {t('v2Overview.datasetCountLabel', 'Datasets')}:{' '}
                  {renderDatasetCounts(row.datasetCounts)}
                </span>
                {corrected ? (
                  <span>{t('v2Overview.baselineClosureChanged', 'Changed in review')}</span>
                ) : null}
              </div>
              <div className="v2-actions-row v2-overview-handoff-year-primary-actions">
                <details className="v2-overview-handoff-year-details-shell">
                  <summary className="v2-btn v2-btn-small">
                    {t('v2Overview.viewDetails', 'View details')}
                  </summary>
                  <div className="v2-overview-handoff-year-details">
                    {renderYearValuePreview(row.vuosi, availability)}
                  </div>
                </details>
                <button
                  type="button"
                  className="v2-btn v2-btn-small"
                  onClick={() => onReopenYearReview(row.vuosi)}
                >
                  {t('v2Overview.reopenReview', 'Reopen review')}
                </button>
              </div>
              <details className="v2-overview-handoff-year-actions-shell">
                <summary>{t('v2Overview.moreActions', 'More actions')}</summary>
                <div className="v2-actions-row v2-overview-handoff-year-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => onReopenYearReview(row.vuosi)}
                  >
                    {t('v2Overview.manualCorrection', 'Manual correction')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => onReopenYearReview(row.vuosi)}
                  >
                    {t('v2Overview.repairFromExcel', 'Repair from Excel')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => onReopenYearReview(row.vuosi)}
                  >
                    {t('v2Overview.repairFromPdf', 'Repair from PDF')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    onClick={() => onReopenYearReview(row.vuosi)}
                  >
                    {t('v2Overview.uploadEvidenceFile', 'Upload evidence file')}
                  </button>
                  {corrected || row.sourceStatus !== 'VEETI' ? (
                    <button
                      type="button"
                      className="v2-btn v2-btn-small"
                      onClick={() => onRestoreVeeti(row.vuosi)}
                    >
                      {t('v2Overview.restoreVeetiValues', 'Restore VEETI values')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="v2-btn v2-btn-small v2-btn-danger"
                    onClick={() => onExcludeYear(row.vuosi)}
                  >
                    {t('v2Overview.excludeYear', 'Exclude year')}
                  </button>
                </div>
              </details>
            </article>
          );
        })}
        </div>
      ) : null}

    {excludedYearsSorted.length > 0 ? (
      <div className="v2-overview-handoff-excluded">
        <div className="v2-section-header">
          <div>
            <h3>{t('v2Overview.baselineExcludedYears', 'Excluded years')}</h3>
          </div>
        </div>
        <div className="v2-overview-handoff-excluded-list">
          {excludedYearsSorted.map((year) => (
            <article
              key={`excluded-${year}`}
              className="v2-overview-handoff-excluded-row"
            >
              <strong>{year}</strong>
              <button
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() => onRestoreYear(year)}
              >
                {t('v2Overview.restoreYearToPlan', 'Restore to plan')}
              </button>
            </article>
          ))}
        </div>
      </div>
    ) : null}
  </section>
  );
};
