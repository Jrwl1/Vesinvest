import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ReportListItem } from '../api';
import { formatDateTime } from './format';
import { getReportDisplayTitle, getScenarioDisplayName } from './displayNames';
import { formatScenarioUpdatedAt } from './reportReadinessModel';

type ScenarioOption = {
  id: string;
  name: string;
};

type EmptyStateScenario = {
  name: string;
  updatedAt: string;
};

type ReportsListColumnProps = {
  emptyStateComputedVersionLabel: string;
  emptyStateCtaLabel: string;
  emptyStateForecastLabel: string;
  emptyStateForecastToneClass: string;
  emptyStateReportReadinessHint: string;
  emptyStateReportReadinessLabel: string;
  emptyStateReportReadinessToneClass: string;
  emptyStateScenario: EmptyStateScenario | null;
  handleEmptyStateAction: () => void;
  handleSavedFeePathAction: () => void;
  hasSelectedReportLayout: boolean;
  loadReports: (scenarioId?: string, force?: boolean) => void;
  loadingList: boolean;
  reportVariantLabel: (variant: V2ReportListItem['variant']) => string;
  reports: V2ReportListItem[];
  reportsHeaderHint: string;
  savedFeePathPlanId?: string | null;
  savedFeePathReportConflictActive: boolean;
  scenarioFilter: string;
  scenarioOptions: ScenarioOption[];
  selectedReportId: string | null;
  setScenarioFilter: (scenarioId: string) => void;
  setSelectedReportId: (reportId: string) => void;
  t: TFunction;
};

export const ReportsListColumn: React.FC<ReportsListColumnProps> = ({
  emptyStateComputedVersionLabel,
  emptyStateCtaLabel,
  emptyStateForecastLabel,
  emptyStateForecastToneClass,
  emptyStateReportReadinessHint,
  emptyStateReportReadinessLabel,
  emptyStateReportReadinessToneClass,
  emptyStateScenario,
  handleEmptyStateAction,
  handleSavedFeePathAction,
  hasSelectedReportLayout,
  loadReports,
  loadingList,
  reportVariantLabel,
  reports,
  reportsHeaderHint,
  savedFeePathPlanId,
  savedFeePathReportConflictActive,
  scenarioFilter,
  scenarioOptions,
  selectedReportId,
  setScenarioFilter,
  setSelectedReportId,
  t,
}) => (
  <div className="v2-reports-list-column">
    <section
      className={`v2-card v2-reports-list-card${
        hasSelectedReportLayout ? ' v2-reports-list-card-secondary' : ''
      }`}
    >
      <div className="v2-section-header v2-reports-list-head">
        <div className="v2-reports-section-copy">
          <p className="v2-overview-eyebrow">{t('v2Reports.title', 'Reports')}</p>
          <h2>{t('v2Reports.title', 'Reports')}</h2>
          <p className="v2-muted">{reportsHeaderHint}</p>
        </div>
        <div className="v2-inline-form">
          <label className="v2-field">
            <span>{t('projection.scenario', 'Scenario')}</span>
            <select
              id="v2-reports-scenario-filter"
              className="v2-input"
              name="scenarioFilter"
              value={scenarioFilter}
              onChange={(event) => setScenarioFilter(event.target.value)}
            >
              <option value="">{t('v2Reports.allScenarios', 'All')}</option>
              {scenarioOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="v2-btn"
            onClick={() => loadReports(undefined, true)}
            disabled={loadingList}
          >
            {t('v2Reports.refreshList', 'Refresh list')}
          </button>
          {savedFeePathReportConflictActive && savedFeePathPlanId ? (
            <button type="button" className="v2-btn" onClick={handleSavedFeePathAction}>
              {t('v2Vesinvest.openPricing', 'Open fee path')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="v2-reports-list-summary">
        <article>
          <span>{t('v2Reports.title', 'Reports')}</span>
          <strong>{reports.length}</strong>
        </article>
        <article>
          <span>{t('projection.scenario', 'Scenario')}</span>
            <strong>
              {scenarioFilter
                ? scenarioOptions.find((option) => option.id === scenarioFilter)?.name ??
                  scenarioFilter
                : t('v2Reports.allScenarios', 'All')}
            </strong>
          </article>
      </div>

      {loadingList ? (
        <div className="v2-loading-state v2-report-loading-card">
          <p className="v2-muted">
            {t('v2Reports.loadingListHint', 'Refreshing saved reports and filters.')}
          </p>
          <span className="v2-skeleton-line" />
          <span className="v2-skeleton-line" />
          <span className="v2-skeleton-line" />
        </div>
      ) : null}
      {!loadingList && reports.length === 0 ? (
        <div className="v2-empty-state">
          <p>{t('v2Reports.empty', 'No reports found.')}</p>
          <p className="v2-muted">{emptyStateReportReadinessHint}</p>
          {emptyStateScenario ? (
            <div className="v2-report-readiness-panel">
              <div className="v2-section-header">
                <h3>{t('v2Forecast.reportReadinessTitle', 'Report status')}</h3>
                <div className="v2-badge-row">
                  <span className={`v2-badge ${emptyStateReportReadinessToneClass}`}>
                    {emptyStateReportReadinessLabel}
                  </span>
                  <span className={`v2-badge ${emptyStateForecastToneClass}`}>
                    {emptyStateForecastLabel}
                  </span>
                </div>
              </div>
              <div className="v2-keyvalue-list">
                <div className="v2-keyvalue-row">
                  <span>{t('projection.scenario', 'Scenario')}</span>
                  <strong>{emptyStateScenario.name}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.computeStateLabel', 'Forecast state')}</span>
                  <strong>{emptyStateForecastLabel}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.reportComputeSource', 'Computed from version')}</span>
                  <strong>{emptyStateComputedVersionLabel}</strong>
                </div>
                <div className="v2-keyvalue-row">
                  <span>{t('v2Forecast.reportScenarioUpdated', 'Scenario updated')}</span>
                  <strong>{formatScenarioUpdatedAt(emptyStateScenario.updatedAt)}</strong>
                </div>
              </div>
            </div>
          ) : null}
          <div className="v2-keyvalue-row">
            <span>{t('v2Overview.wizardContextNext', 'Next')}</span>
            <strong>{emptyStateCtaLabel}</strong>
          </div>
          <button type="button" className="v2-btn v2-btn-primary" onClick={handleEmptyStateAction}>
            {emptyStateCtaLabel}
          </button>
        </div>
      ) : null}

      {reports.length > 0 ? (
        <div className="v2-report-table v2-report-list">
          {reports.map((row) => {
            const rowTitle =
              row.title?.trim() ||
              getReportDisplayTitle({
                title: row.title,
                scenarioName: row.ennuste.nimi ?? row.ennuste.id,
                createdAt: row.createdAt,
                t,
              });
            const rowScenarioLabel = getScenarioDisplayName(row.ennuste.nimi ?? row.ennuste.id, t);
            return (
              <button
                key={row.id}
                type="button"
                className={`v2-report-row ${selectedReportId === row.id ? 'active' : ''}`}
                onClick={() => setSelectedReportId(row.id)}
                aria-pressed={selectedReportId === row.id}
              >
                <div className="v2-report-row-top">
                  <div className="v2-report-row-main">
                    <strong>{rowTitle}</strong>
                    <span>{formatDateTime(row.createdAt)}</span>
                  </div>
                  <div className="v2-badge-row">
                    <span className="v2-badge v2-status-provenance">
                      {reportVariantLabel(row.variant)}
                    </span>
                    {selectedReportId === row.id ? (
                      <span className="v2-result-selected">
                        {t('v2Reports.selectedReportTitle', 'Selected report')}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="v2-report-row-meta">
                  <span>
                    {t('projection.scenario', 'Scenario')}: {rowScenarioLabel}
                  </span>
                  <span>
                    {t('projection.v2.baselineYearLabel', 'Baseline year')}: {row.baselineYear}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  </div>
);
