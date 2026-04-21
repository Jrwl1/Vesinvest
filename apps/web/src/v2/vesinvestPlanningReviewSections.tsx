import React from 'react';
import type { TFunction } from 'i18next';

import type {
  V2EditableDepreciationRuleMethod,
  V2VesinvestBaselineSnapshotYear,
  V2VesinvestFeeRecommendation,
  V2VesinvestGroupDefinition,
  V2VesinvestPlanSummary,
} from '../api';
import { formatEur, formatPercent, formatPrice } from './format';
import type { DepreciationRuleDraft } from './forecastModel';
import {
  toneClass,
  type VesinvestDraft,
  type VesinvestLinkedOrg,
} from './vesinvestPlanningModel';
import type { VesinvestBaselineYear } from './vesinvestPlanningModel';
import {
  datasetSourceLabel,
  datasetSourceNote,
  qualityLabel,
  sourceStatusLabel,
} from './vesinvestPlanningProvenance';
import {
  VesinvestBaselineReviewSurface,
  VesinvestDepreciationPlanSurface,
  VesinvestIdentitySurface,
} from './vesinvestPlanningSections';

export function VesinvestUtilityBindingSection({
  t,
  linkedOrg,
  draft,
  utilityBindingMissing,
  utilityBindingMismatch,
  veetiSearchQuery,
  setVeetiSearchQuery,
  veetiSearchResults,
  busy,
  searchingVeeti,
  runVeetiLookup,
  applyVeetiSearchHit,
}: {
  t: TFunction;
  linkedOrg: VesinvestLinkedOrg;
  draft: VesinvestDraft;
  utilityBindingMissing: boolean;
  utilityBindingMismatch: boolean;
  veetiSearchQuery: string;
  setVeetiSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  veetiSearchResults: Array<{
    id: number;
    name: string;
    businessId: string | null;
    municipality: string | null;
  }>;
  busy: boolean;
  searchingVeeti: boolean;
  runVeetiLookup: () => Promise<void>;
  applyVeetiSearchHit: (hit: {
    id: number;
    name: string;
    businessId: string | null;
    municipality: string | null;
  }) => void;
}) {
  return (
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
}

export function VesinvestDepreciationPlanSection({
  t,
  active,
  groupDrafts,
  depreciationRuleDrafts,
  isAdmin,
  savingClassKey,
  updateGroupDraft,
  updateDepreciationRuleDraft,
  handleSaveClassDefinition,
}: {
  t: TFunction;
  active: boolean;
  groupDrafts: V2VesinvestGroupDefinition[];
  depreciationRuleDrafts: DepreciationRuleDraft[];
  isAdmin: boolean;
  savingClassKey: string | null;
  updateGroupDraft: (
    groupKey: string,
    updater: (current: V2VesinvestGroupDefinition) => V2VesinvestGroupDefinition,
  ) => void;
  updateDepreciationRuleDraft: (
    assetClassKey: string,
    updater: (current: DepreciationRuleDraft) => DepreciationRuleDraft,
  ) => void;
  handleSaveClassDefinition: (groupKey: string) => Promise<void>;
}) {
  if (!active) {
    return null;
  }

  return (
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
                depreciationRuleDrafts.find((rule) => rule.assetClassKey === group.key) ?? null;
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
                          serviceSplit: event.target.value as V2VesinvestGroupDefinition['serviceSplit'],
                        }))
                      }
                    >
                      <option value="water">
                        {t('v2Forecast.investmentServiceSplitWater', 'Water')}
                      </option>
                      <option value="wastewater">
                        {t('v2Forecast.investmentServiceSplitWastewater', 'Wastewater')}
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
      {depreciationRuleDrafts.length === 0 ? (
        <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
      ) : null}
    </VesinvestDepreciationPlanSurface>
  );
}

export function VesinvestBaselineReviewSection({
  t,
  baselineYears,
  baselineVerified,
  selectedSummary,
  feeRecommendation,
  feePathSectionRef,
  feePathHeadingRef,
}: {
  t: TFunction;
  baselineYears: Array<VesinvestBaselineYear | V2VesinvestBaselineSnapshotYear>;
  baselineVerified: boolean;
  selectedSummary: V2VesinvestPlanSummary | null;
  feeRecommendation: V2VesinvestFeeRecommendation | null;
  feePathSectionRef: React.RefObject<HTMLElement | null>;
  feePathHeadingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const pricingTone =
    selectedSummary?.pricingStatus === 'verified' ||
    selectedSummary?.pricingStatus === 'provisional' ||
    selectedSummary?.pricingStatus === 'blocked'
      ? selectedSummary.pricingStatus
      : 'blocked';

  const feePathSection = feeRecommendation ? (
    <section
      className="v2-vesinvest-section"
      ref={feePathSectionRef as React.RefObject<HTMLElement>}
    >
      <div className="v2-section-header">
        <div>
          <p className="v2-overview-eyebrow">{t('v2Vesinvest.feePathEyebrow', 'Fee path')}</p>
          <h3 ref={feePathHeadingRef as React.RefObject<HTMLHeadingElement>} tabIndex={-1}>
            {t('v2Vesinvest.feePathTitle', 'Saved fee-path recommendation')}
          </h3>
        </div>
        <span className={`v2-badge ${toneClass(pricingTone)}`}>
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
          <strong>{formatPrice(feeRecommendation.combined.annualResult.requiredPriceToday ?? null)}</strong>
        </div>
        <div>
          <span>
            {t(
              'v2Forecast.requiredIncreaseFromToday',
              'Required increase from current combined price',
            )}
          </span>
          <strong>
            {formatPercent(
              feeRecommendation.combined.annualResult.requiredAnnualIncreasePct ?? null,
            )}
          </strong>
        </div>
        <div>
          <span>
            {t(
              'v2Forecast.requiredPriceCumulativeCash',
              'Required price today (cumulative cash >= 0)',
            )}
          </span>
          <strong>{formatPrice(feeRecommendation.combined.cumulativeCash.requiredPriceToday ?? null)}</strong>
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

  return (
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
                <span
                  className={`v2-badge ${toneClass(
                    yearRow.sourceStatus === 'INCOMPLETE'
                      ? 'incomplete'
                      : yearRow.sourceStatus === 'MIXED'
                        ? 'provisional'
                        : 'verified',
                  )}`}
                >
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
  );
}
