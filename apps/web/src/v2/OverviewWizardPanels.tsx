import React from 'react';
import type { TFunction } from 'i18next';

import type { VeetiOrganizationSearchHit } from '../api';

type AcceptedPlanningYearRow = {
  vuosi: number;
  sourceStatus?: string | undefined;
  datasetCounts?: Record<string, number>;
};

type OverviewConnectStepProps = {
  t: TFunction;
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
  connectButtonClass: string;
  connectDisabled: boolean;
  onConnect: () => void;
};

export const OverviewConnectStep: React.FC<OverviewConnectStepProps> = ({
  t,
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
  connectButtonClass,
  connectDisabled,
  onConnect,
}) => (
  <section>
    <article className="v2-card v2-overview-step-card">
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">
            {t('v2Overview.wizardProgress', { step: 1 })}
          </p>
          <h2>{t('v2Overview.wizardQuestionConnect')}</h2>
        </div>
        <span className="v2-chip v2-status-warning">
          {t('v2Overview.disconnected', 'Not connected')}
        </span>
      </div>

      <p className="v2-muted v2-overview-review-body">
        {t('v2Overview.wizardBodyConnect')}
      </p>
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
                  <span className="v2-result-selected">
                    {isActive
                      ? t('v2Overview.resultSelected', 'Selected')
                      : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
                  </span>
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
            {selectedOrg?.Kunta ? (
              <span>
                {t('v2Overview.municipalityLabel', 'Municipality')}:{' '}
                {selectedOrg.Kunta}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="v2-btn v2-btn-small"
            onClick={() => onSelectOrg(null)}
            disabled={connecting || importingYears || syncing}
          >
            {t('v2Overview.clearSelectionButton', 'Clear selection')}
          </button>
        </div>
      ) : null}

      <div className="v2-actions-row">
        <button
          type="button"
          className={connectButtonClass}
          onClick={onConnect}
          disabled={connectDisabled}
        >
          {connecting
            ? t('v2Overview.connectingButton', 'Connecting...')
            : t('v2Overview.connectButton', 'Yhdistä organisaatio')}
        </button>
      </div>
    </article>
  </section>
);

type OverviewPlanningBaselineStepProps = {
  t: TFunction;
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
  wizardBackLabel,
  onBack,
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
        {wizardBackLabel ? (
          <button type="button" className="v2-step-back-btn" onClick={onBack}>
            {wizardBackLabel}
          </button>
        ) : null}
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', { step: 5 })}
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
        {importedBlockedYearCount > 0
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
  sourceStatusClassName: (status: string | undefined) => string;
  sourceStatusLabel: (status: string | undefined) => string;
  renderDatasetCounts: (counts?: Record<string, number>) => string;
  openForecastButtonClass: string;
  onOpenForecast: () => void;
};

export const OverviewForecastHandoffStep: React.FC<
  OverviewForecastHandoffStepProps
> = ({
  t,
  wizardBackLabel,
  onBack,
  acceptedPlanningYearRows,
  correctedPlanningYears,
  sourceStatusClassName,
  sourceStatusLabel,
  renderDatasetCounts,
  openForecastButtonClass,
  onOpenForecast,
}) => (
  <section className="v2-card">
    <div className="v2-section-header">
      <div>
        {wizardBackLabel ? (
          <button type="button" className="v2-step-back-btn" onClick={onBack}>
            {wizardBackLabel}
          </button>
        ) : null}
        <p className="v2-overview-eyebrow">
          {t('v2Overview.wizardProgress', { step: 6 })}
        </p>
        <h2>{t('v2Overview.baselineIncludedYears')}</h2>
      </div>
      <span className="v2-badge v2-status-positive">
        {t('v2Overview.wizardSummaryYes')}
      </span>
    </div>

    {acceptedPlanningYearRows.length > 0 ? (
      <div className="v2-year-status-list">
        {acceptedPlanningYearRows.map((row) => {
          const corrected = correctedPlanningYears.includes(row.vuosi);
          return (
            <article key={`accepted-${row.vuosi}`} className="v2-year-status-row ready">
              <div className="v2-year-status-head">
                <div className="v2-year-status-labels">
                  <strong>{row.vuosi}</strong>
                  <span>
                    {corrected
                      ? t('v2Overview.baselineClosureChanged', 'Changed in review')
                      : t(
                          'v2Overview.baselineClosureStillVeeti',
                          'Still from VEETI',
                        )}
                  </span>
                </div>
                <div className="v2-badge-row">
                  <span className="v2-badge v2-status-positive">
                    {t('v2Overview.wizardSummaryReadyYears', 'Ready years')}
                  </span>
                  <span
                    className={`v2-badge ${sourceStatusClassName(row.sourceStatus)}`}
                  >
                    {sourceStatusLabel(row.sourceStatus)}
                  </span>
                </div>
              </div>

              <div className="v2-year-status-checks">
                <div className="v2-year-status-check ready">
                  <span>{t('v2Overview.sourceLabel', 'Source')}</span>
                  <span className="v2-year-status-check-badge">
                    {corrected
                      ? t('v2Overview.baselineClosureChanged', 'Changed in review')
                      : t(
                          'v2Overview.baselineClosureStillVeeti',
                          'Still from VEETI',
                        )}
                  </span>
                </div>
                <div className="v2-year-status-check ready">
                  <span>
                    {t('v2Overview.wizardSummaryBaselineReady', 'Baseline ready')}
                  </span>
                  <span className="v2-year-status-check-badge">
                    {t('v2Overview.wizardSummaryYes', 'Yes')}
                  </span>
                </div>
                <div className="v2-year-status-check ready">
                  <span>{t('v2Overview.datasetCountLabel', 'Datasets')}</span>
                  <span className="v2-year-status-check-badge">
                    {renderDatasetCounts(row.datasetCounts)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    ) : null}

    <div className="v2-overview-review-actions">
      <button
        type="button"
        className={openForecastButtonClass}
        onClick={onOpenForecast}
      >
        {t('v2Overview.openForecast')}
      </button>
      <p className="v2-muted">
        {t(
          'v2Forecast.selectScenarioHint',
          'Choose an existing scenario or create a new one to continue.',
        )}
      </p>
    </div>
  </section>
);
