import React from 'react';
import type { TFunction } from 'i18next';

import type {
  V2ImportYearDataResponse,
  V2OverviewResponse,
  V2PlanningContextResponse,
} from '../api';
import {
  getSyncBlockReasonLabel as buildSyncBlockReasonLabel,
  getImportYearSummaryLabel as buildImportYearSummaryLabel,
  getRequirementDatasetLabel as buildRequirementDatasetLabel,
} from './overviewLabels';
import { IMPORT_BOARD_CANON_ROWS } from './overviewManualForms';
import {
  getPreviewPrefetchYears,
  isHistoricalPlanningYear,
  pickDefaultBaselineYears,
} from './overviewSelectors';
import {
  getMissingSyncRequirements,
  getSetupReadinessChecks,
  getSetupYearStatus,
  resolvePreviousSetupStep,
  resolveSetupWizardState,
  type MissingRequirement,
  type SetupWizardStep,
  type SetupWizardState,
} from './overviewWorkflow';
import {
  buildPriceComparisonRows,
  buildImportYearResultToZeroSignal,
  buildImportYearSourceLayers,
  buildImportYearSummaryRows,
  buildImportYearTrustSignal,
  buildVolumeComparisonRows,
  syncPersistedReviewedImportYears,
} from './yearReview';

type ImportWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

type ReviewCardContext = 'step2' | 'step3' | null;

function getEditedFinancialFieldLabel(
  t: TFunction,
  sourceField: string,
): string {
  if (sourceField === 'Liikevaihto') {
    return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
  }
  if (sourceField === 'PerusmaksuYhteensa') {
    return t('v2Overview.manualFinancialFixedRevenue', 'Fixed revenue total');
  }
  if (sourceField === 'AineetJaPalvelut') {
    return t('v2Overview.previewAccountingMaterialsLabel', 'Materials and services');
  }
  if (sourceField === 'Henkilostokulut') {
    return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
  }
  if (sourceField === 'Poistot') {
    return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
  }
  if (sourceField === 'LiiketoiminnanMuutKulut') {
    return t('v2Overview.previewAccountingOtherOpexLabel', 'Other operating costs');
  }
  if (sourceField === 'TilikaudenYliJaama') {
    return t('v2Overview.previewAccountingResultLabel', 'Result');
  }
  return sourceField;
}

function mergeYearDataSignals(
  yearRow: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: Array<
      'financialBaseline' | 'prices' | 'volumes'
    >;
    baselineWarnings?: Array<'tariffRevenueMismatch'>;
    tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
  },
  yearData: V2ImportYearDataResponse | undefined,
): {
  completeness: Record<string, boolean>;
  baselineReady?: boolean;
  baselineMissingRequirements: Array<'financialBaseline' | 'prices' | 'volumes'>;
  baselineWarnings: Array<'tariffRevenueMismatch'>;
  tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null;
} {
  const completeness = yearRow.completeness;
  const tariffRevenueReason = yearRow.tariffRevenueReason;
  if (!yearData) {
    return {
      completeness,
      baselineReady: yearRow.baselineReady,
      baselineMissingRequirements: yearRow.baselineMissingRequirements ?? [],
      baselineWarnings: yearRow.baselineWarnings ?? [],
      tariffRevenueReason: tariffRevenueReason ?? null,
    };
  }

  return {
    completeness: {
      ...completeness,
      tilinpaatos:
        completeness.tilinpaatos === true ||
        yearData.completeness.tilinpaatos === true,
      taksa:
        completeness.taksa === true || yearData.completeness.taksa === true,
      tariff_revenue:
        completeness.tariff_revenue === false ||
        yearData.completeness.tariff_revenue === false
          ? false
          : true,
      volume_vesi:
        completeness.volume_vesi === true ||
        yearData.completeness.volume_vesi === true,
      volume_jatevesi:
        completeness.volume_jatevesi === true ||
        yearData.completeness.volume_jatevesi === true,
    },
    baselineReady: yearData.baselineReady ?? yearRow.baselineReady,
    baselineMissingRequirements:
      yearData.baselineMissingRequirements ??
      yearRow.baselineMissingRequirements ??
      [],
    baselineWarnings:
      yearData.baselineWarnings ?? yearRow.baselineWarnings ?? [],
    tariffRevenueReason:
      yearData.tariffRevenueReason ??
      (yearData.completeness.tariff_revenue === false
        ? tariffRevenueReason ?? null
        : null),
  };
}

function deriveDatasetCounts(
  yearData: V2ImportYearDataResponse | undefined,
): Record<string, number> | undefined {
  const counts =
    yearData?.datasets.reduce<Record<string, number>>((acc, dataset) => {
      const count = Math.max(
        dataset.effectiveRows?.length ?? 0,
        dataset.rawRows?.length ?? 0,
        dataset.source === 'none' ? 0 : 1,
      );
      if (count > 0) {
        acc[dataset.dataType] = count;
      }
      return acc;
    }, {}) ?? {};
  return Object.keys(counts).length > 0 ? counts : undefined;
}

export function getExactEditedFieldLabels(params: {
  t: TFunction;
  yearData: V2ImportYearDataResponse | undefined;
  changedSummaryKeys: string[];
  manualFinancialFieldSources?: Array<{ sourceField: string }>;
  statementImportFieldSources?: Array<{ sourceField: string }>;
  workbookImportFieldSources?: Array<{ sourceField: string }>;
}): string[] {
  const {
    t,
    yearData,
    changedSummaryKeys,
    manualFinancialFieldSources,
    statementImportFieldSources,
    workbookImportFieldSources,
  } =
    params;
  const labels = new Set<string>();
  const financialFieldSources = [
    ...(manualFinancialFieldSources ?? []),
    ...(statementImportFieldSources ?? []),
    ...(workbookImportFieldSources ?? []),
  ];

  for (const fieldSource of financialFieldSources) {
    labels.add(getEditedFinancialFieldLabel(t, fieldSource.sourceField));
  }

  if (labels.size === 0) {
    for (const key of changedSummaryKeys) {
      labels.add(buildImportYearSummaryLabel(t, key as any));
    }
  }

  for (const row of buildPriceComparisonRows(yearData)) {
    if (!row.changed) continue;
    labels.add(
      row.key === 'waterUnitPrice'
        ? t('v2Overview.previewWaterPriceLabel', 'Water price')
        : t('v2Overview.previewWastewaterPriceLabel', 'Wastewater price'),
    );
  }

  for (const row of buildVolumeComparisonRows(yearData)) {
    if (!row.changed) continue;
    labels.add(
      row.key === 'soldWaterVolume'
        ? t('v2Overview.previewWaterVolumeLabel', 'Sold water')
        : t('v2Overview.previewWastewaterVolumeLabel', 'Sold wastewater'),
    );
  }

  return [...labels];
}

export function useOverviewSetupState(params: {
  overview: V2OverviewResponse | null;
  planningContext?: V2PlanningContextResponse | null;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  selectedYears: number[];
  excludedYearOverrides: Record<number, boolean>;
  importedWorkspaceYears: number[] | null;
  backendAcceptedPlanningYears: number[];
  reviewedImportedYears: number[];
  setReviewedImportedYears: React.Dispatch<React.SetStateAction<number[]>>;
  manualPatchYear: number | null;
  cardEditYear: number | null;
  cardEditContext: ReviewCardContext;
  reviewContinueStep: SetupWizardStep | null;
  baselineReady: boolean;
  t: TFunction;
}) {
  const {
    overview,
    planningContext = null,
    yearDataCache,
    selectedYears,
    excludedYearOverrides,
    importedWorkspaceYears,
    backendAcceptedPlanningYears,
    reviewedImportedYears,
    setReviewedImportedYears,
    manualPatchYear,
    cardEditYear,
    cardEditContext,
    reviewContinueStep,
    baselineReady,
    t,
  } = params;

  const resolveSyncBlockReason = React.useCallback(
    (row: {
      completeness: Record<string, boolean>;
      baselineReady?: boolean;
      baselineMissingRequirements?: Array<
        'financialBaseline' | 'prices' | 'volumes'
      >;
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      vuosi: number;
    }) => buildSyncBlockReasonLabel(t, row),
    [t],
  );

  const availableYearRows = React.useMemo(
    () => overview?.importStatus.availableYears ?? overview?.importStatus.years ?? [],
    [overview?.importStatus.availableYears, overview?.importStatus.years],
  );

  const syncYearRows = React.useMemo(
    () =>
      availableYearRows.map((row) => {
        const mergedSignals = mergeYearDataSignals(row, yearDataCache[row.vuosi]);
        const mergedRow = {
          ...row,
          completeness: mergedSignals.completeness,
          baselineReady: mergedSignals.baselineReady,
          baselineMissingRequirements:
            mergedSignals.baselineMissingRequirements,
          baselineWarnings: mergedSignals.baselineWarnings,
          tariffRevenueReason: mergedSignals.tariffRevenueReason,
        };
        return {
          ...mergedRow,
          syncBlockedReason: resolveSyncBlockReason(mergedRow),
        };
      }),
    [availableYearRows, resolveSyncBlockReason, yearDataCache],
  );

  const selectableImportYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => ({
          ...row,
          missingRequirements: getMissingSyncRequirements(row),
        })),
    [syncYearRows],
  );

  const importableYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason == null),
    [selectableImportYearRows],
  );

  const repairOnlyYearRows = React.useMemo(
    () => selectableImportYearRows.filter((row) => row.syncBlockedReason != null),
    [selectableImportYearRows],
  );

  const blockedYearCount = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason).length,
    [syncYearRows],
  );

  const blockedYearRows = React.useMemo(
    () => syncYearRows.filter((row) => row.syncBlockedReason),
    [syncYearRows],
  );

  const excludedYearsSorted = React.useMemo(
    () => {
      const years = new Set(
        [...(overview?.importStatus.excludedYears ?? [])]
          .map((year) => Number(year))
          .filter((year) => Number.isFinite(year)),
      );
      for (const [year, excluded] of Object.entries(excludedYearOverrides)) {
        const numericYear = Number(year);
        if (!Number.isFinite(numericYear)) continue;
        if (excluded) {
          years.add(numericYear);
        } else {
          years.delete(numericYear);
        }
      }
      for (const year of backendAcceptedPlanningYears) {
        years.delete(year);
      }
      return [...years].sort((a, b) => b - a);
    },
    [
      backendAcceptedPlanningYears,
      excludedYearOverrides,
      overview?.importStatus.excludedYears,
    ],
  );
  const excludedYearSet = React.useMemo(
    () => new Set(excludedYearsSorted),
    [excludedYearsSorted],
  );

  const readyAvailableYearRows = React.useMemo(
    () =>
      syncYearRows.filter(
        (row) => isHistoricalPlanningYear(row) && !row.syncBlockedReason,
      ),
    [syncYearRows],
  );

  const recommendedYears = React.useMemo(
    () => pickDefaultBaselineYears(readyAvailableYearRows),
    [readyAvailableYearRows],
  );
  const defaultBaselineYearSet = React.useMemo(
    () => new Set(pickDefaultBaselineYears(syncYearRows)),
    [syncYearRows],
  );

  const importBoardRows = React.useMemo(() => {
    return selectableImportYearRows.map((row) => {
      const isSelectedForImport = selectedYears.includes(row.vuosi);
      const yearData = yearDataCache[row.vuosi];
      const summaryRows = buildImportYearSummaryRows(yearData);
      const summaryMap = new Map(summaryRows.map((item) => [item.key, item]));
      const trustSignal = buildImportYearTrustSignal(yearData);
      const resultToZero = buildImportYearResultToZeroSignal(yearData);
      const sourceLayers = buildImportYearSourceLayers(yearData);
      const missingPrimaryCosts = [
        summaryMap.get('materialsCosts')?.effectiveValue,
        summaryMap.get('personnelCosts')?.effectiveValue,
        summaryMap.get('depreciation')?.effectiveValue,
        summaryMap.get('otherOperatingCosts')?.effectiveValue,
      ].some((value) => value == null);
      const missingCanonRows = IMPORT_BOARD_CANON_ROWS.filter(
        (item) => summaryMap.get(item.key)?.effectiveValue == null,
      ).map((item) => buildImportYearSummaryLabel(t, item.key));
      const baselineMissing = new Set(row.baselineMissingRequirements ?? []);
      const usesBaselineReadiness =
        typeof row.baselineReady === 'boolean' ||
        baselineMissing.size > 0;
      const missingRequiredInputs = [
        {
          present: usesBaselineReadiness
            ? !baselineMissing.has('financialBaseline')
            : row.completeness?.tilinpaatos,
          label: t('v2Overview.datasetFinancials', 'Baseline economics'),
        },
        {
          present: usesBaselineReadiness
            ? !baselineMissing.has('prices')
            : row.completeness?.taksa,
          label: t('v2Overview.datasetPrices', 'Taksa'),
        },
        {
          present: usesBaselineReadiness
            ? !baselineMissing.has('volumes')
            : row.completeness?.volume_vesi || row.completeness?.volume_jatevesi,
          label: t('v2Overview.datasetWaterVolume', 'Volyymit'),
        },
      ].filter((item) => !item.present);
      const hasTariffBaselineWarning =
        row.syncBlockedReason == null &&
        row.baselineWarnings?.includes('tariffRevenueMismatch') === true;
      const tariffBaselineWarningText = hasTariffBaselineWarning
        ? buildSyncBlockReasonLabel(t, row) ??
          t(
            'v2Overview.requirementTariffRevenueMismatch',
            'Tariff revenue does not reconcile with prices, volumes, and fixed revenue',
          )
        : null;
      const incompleteSource =
        row.sourceStatus === 'INCOMPLETE' ||
        trustSignal.reasons.includes('incomplete_source');
      const missingCoreCostStructure = missingPrimaryCosts || incompleteSource;
      const suspiciousMargin =
        resultToZero.marginPct != null && Math.abs(resultToZero.marginPct) >= 10;
      const hasFallbackZero = row.warnings?.includes('fallback_zero_used');
      const hasLargeDiscrepancy = trustSignal.reasons.includes('statement_import');
      const needsHumanReview =
        row.sourceStatus === 'MIXED' ||
        row.sourceStatus === 'MANUAL' ||
        (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
        (row.manualProvenance != null && !hasLargeDiscrepancy);
      const isCurrentYearEstimate =
        row.planningRole === 'current_year_estimate';
      const isHistoricalCompleted = isHistoricalPlanningYear(row);
      const isExcludedFromPlan = excludedYearSet.has(row.vuosi);
      const isDefaultBaselineYear = defaultBaselineYearSet.has(row.vuosi);
      const baselineGroup = isCurrentYearEstimate
        ? 'current_estimate'
        : row.syncBlockedReason != null
        ? 'historical_incomplete'
        : isSelectedForImport || isDefaultBaselineYear
        ? 'historical_selected'
        : 'historical_available';
      const lane =
        row.syncBlockedReason != null
          ? 'blocked'
          : hasTariffBaselineWarning ||
            missingCoreCostStructure ||
            hasFallbackZero ||
            hasLargeDiscrepancy ||
            suspiciousMargin ||
            needsHumanReview
          ? 'suspicious'
          : 'ready';
      const trustLabel =
        lane === 'blocked'
          ? missingCoreCostStructure
            ? t('v2Overview.trustMissingKeyCosts', 'Missing key cost rows')
            : t('v2Overview.yearNeedsCompletion', 'Needs completion')
          : hasTariffBaselineWarning
          ? t('v2Overview.trustNeedsReview', 'Needs human review')
          : missingCoreCostStructure
          ? t('v2Overview.trustMissingKeyCosts', 'Missing key cost rows')
          : hasLargeDiscrepancy
          ? t(
              'v2Overview.trustLargeDiscrepancy',
              'Large discrepancy vs statement',
            )
          : hasFallbackZero
          ? t('v2Overview.trustFallbackZeros', 'Fallback zeros used')
          : suspiciousMargin
          ? t('v2Overview.trustSuspiciousResult', 'Check result')
          : needsHumanReview
          ? t('v2Overview.trustNeedsReview', 'Needs human review')
          : t('v2Overview.trustLooksPlausible', 'Looks plausible');
      const trustToneClass =
        lane === 'ready'
          ? 'v2-status-positive'
          : 'v2-status-warning';
      const missingSummary =
        missingRequiredInputs.length > 0
          ? {
              count: missingRequiredInputs.length,
              total: 3,
              fields: missingRequiredInputs.map((item) => item.label).join(', '),
            }
          : missingCoreCostStructure && missingCanonRows.length > 0
          ? {
              count: missingCanonRows.length,
              total: IMPORT_BOARD_CANON_ROWS.length,
              fields: missingCanonRows.join(', '),
            }
          : null;
      const exactEditedFieldLabels = getExactEditedFieldLabels({
        t,
        yearData,
        changedSummaryKeys: trustSignal.changedSummaryKeys,
        manualFinancialFieldSources:
          yearData?.datasets
            .find((dataset) => dataset.dataType === 'tilinpaatos')
            ?.overrideMeta?.provenance?.fieldSources?.filter(
              (item) => item.provenance.kind === 'manual_edit',
            ),
        statementImportFieldSources: trustSignal.statementImport?.fieldSources,
        workbookImportFieldSources: trustSignal.workbookImport?.fieldSources,
      });
      const trustNote =
        missingSummary != null
          ? null
          : row.syncBlockedReason != null
          ? t('v2Overview.yearMissingLabel', 'Missing requirements: {{requirements}}', {
              requirements:
                row.missingRequirements.length > 0
                  ? row.missingRequirements
                      .map((item) => buildRequirementDatasetLabel(t, item))
                      .join(', ')
                  : t('v2Overview.setupStatusNeedsAttention'),
            })
          : tariffBaselineWarningText != null
          ? tariffBaselineWarningText
          : missingCoreCostStructure
          ? t(
              'v2Overview.trustMissingKeyCostsHint',
              'VEETI did not provide these card rows: {{fields}}.',
              {
                fields:
                  missingCanonRows.length > 0
                    ? missingCanonRows.join(', ')
                    : t('v2Overview.previewMissingValue', 'Missing data'),
              },
            )
          : hasLargeDiscrepancy || needsHumanReview
          ? exactEditedFieldLabels.length > 0
            ? t('v2Overview.editedFieldsLabel', 'Edited: {{fields}}', {
                fields: exactEditedFieldLabels.join(', '),
              })
            : null
          : hasFallbackZero
          ? t(
              'v2Overview.trustFallbackZerosHint',
              'Missing VEETI values still fall back to zero in the imported totals.',
            )
          : suspiciousMargin
          ? null
          : t(
              'v2Overview.trustLooksPlausibleHint',
              'Core rows are present and the result stays close enough to zero for a normal review pass.',
            );
      return {
        ...row,
        lane,
        baselineGroup,
        isCurrentEstimate: isCurrentYearEstimate,
        isHistoricalCompleted,
        isDefaultBaselineYear,
        showCanonicalYearCard: true,
        isSelectedForImport,
        isExcludedFromPlan,
        summaryMap,
        trustLabel,
        trustToneClass,
        trustNote,
        resultToZero,
        missingCoreCostStructure,
        missingSummary,
        missingCount:
          missingSummary?.count ?? row.missingRequirements.length ?? 0,
        sourceLayers,
      };
    });
  }, [
    defaultBaselineYearSet,
    excludedYearSet,
    selectedYears,
    selectableImportYearRows,
    yearDataCache,
    t,
  ]);

  const readyTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          isHistoricalPlanningYear(row) &&
          !row.isExcludedFromPlan &&
          row.lane === 'ready',
      ),
    [importBoardRows],
  );
  const suspiciousTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          isHistoricalPlanningYear(row) &&
          !row.isExcludedFromPlan &&
          row.lane === 'suspicious',
      ),
    [importBoardRows],
  );
  const trashbinTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          isHistoricalPlanningYear(row) &&
          row.isExcludedFromPlan,
      ),
    [importBoardRows],
  );
  const blockedTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          isHistoricalPlanningYear(row) &&
          !row.isExcludedFromPlan &&
          row.lane === 'blocked',
      ),
    [importBoardRows],
  );
  const currentYearEstimateBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) => row.planningRole === 'current_year_estimate',
      ),
    [importBoardRows],
  );

  const confirmedImportedYears = React.useMemo(
    () => [...(importedWorkspaceYears ?? [])].sort((a, b) => b - a),
    [importedWorkspaceYears],
  );
  const reviewStorageOrgId = React.useMemo(
    () =>
      overview?.importStatus.link?.orgId ??
      overview?.importStatus.link?.ytunnus ??
      overview?.importStatus.link?.nimi ??
      null,
    [overview?.importStatus.link],
  );
  const persistedReviewedImportedYears = React.useMemo(
    () =>
      syncPersistedReviewedImportYears(
        reviewStorageOrgId,
        confirmedImportedYears,
      ),
    [confirmedImportedYears, reviewStorageOrgId],
  );
  const reviewedImportedYearSet = React.useMemo(
    () =>
      new Set(
        [
          ...(reviewedImportedYears.length > 0
            ? reviewedImportedYears
            : persistedReviewedImportedYears),
          ...backendAcceptedPlanningYears,
        ].filter((year) => Number.isFinite(year)),
      ),
    [
      backendAcceptedPlanningYears,
      persistedReviewedImportedYears,
      reviewedImportedYears,
    ],
  );

  React.useEffect(() => {
    setReviewedImportedYears(persistedReviewedImportedYears);
  }, [persistedReviewedImportedYears, setReviewedImportedYears]);

  const importYearRows = React.useMemo(
    () =>
      [...syncYearRows]
        .filter((row) => confirmedImportedYears.includes(row.vuosi))
        .sort((a, b) => b.vuosi - a.vuosi)
        .map((row) => {
          const mergedSignals = mergeYearDataSignals(row, yearDataCache[row.vuosi]);
          const effectiveRow = {
            ...row,
            completeness: mergedSignals.completeness,
            baselineReady: mergedSignals.baselineReady,
            baselineMissingRequirements:
              mergedSignals.baselineMissingRequirements,
            baselineWarnings: mergedSignals.baselineWarnings,
            tariffRevenueReason: mergedSignals.tariffRevenueReason,
          };
          const missingRequirements = getMissingSyncRequirements(effectiveRow);
          return {
            ...effectiveRow,
            missingRequirements,
            readinessChecks: getSetupReadinessChecks(effectiveRow),
            setupStatus: getSetupYearStatus(effectiveRow),
          };
        }),
    [confirmedImportedYears, syncYearRows, yearDataCache],
  );

  const reviewedImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus(
            {
              ...row,
              reviewState: reviewedImportedYearSet.has(row.vuosi)
                ? 'reviewed'
                : 'pending_review',
            },
            {
              excluded: excludedYearsSorted.includes(row.vuosi),
            },
          ) === 'reviewed',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );

  const technicallyReadyImportedYearRows = React.useMemo(
    () =>
      importYearRows.filter(
        (row) =>
          getSetupYearStatus(
            {
              ...row,
              reviewState: reviewedImportedYearSet.has(row.vuosi)
                ? 'reviewed'
                : 'pending_review',
            },
            {
              excluded: excludedYearsSorted.includes(row.vuosi),
            },
          ) === 'ready_for_review',
      ),
    [excludedYearsSorted, importYearRows, reviewedImportedYearSet],
  );

  const importReviewStatusRows = React.useMemo(() => {
    const rows = importYearRows.map((row) => ({
      year: row.vuosi,
      sourceStatus: row.sourceStatus,
      completeness: row.completeness,
      baselineReady: row.baselineReady,
      baselineMissingRequirements: row.baselineMissingRequirements ?? [],
      baselineWarnings: row.baselineWarnings ?? [],
      tariffRevenueReason: row.tariffRevenueReason ?? null,
      readinessChecks: row.readinessChecks,
      missingRequirements: row.missingRequirements,
      warnings: (row.warnings ?? []) as ImportWarningCode[],
      setupStatus: getSetupYearStatus(
        {
          ...row,
          reviewState: reviewedImportedYearSet.has(row.vuosi)
            ? 'reviewed'
            : 'pending_review',
        },
        {
          excluded: excludedYearsSorted.includes(row.vuosi),
        },
      ),
    }));
    const visibleYears = new Set(rows.map((row) => row.year));

    for (const year of excludedYearsSorted) {
      if (visibleYears.has(year)) continue;
      rows.push({
        year,
        sourceStatus: undefined,
        completeness: {
          tilinpaatos: false,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: false,
          volume_jatevesi: false,
        },
        baselineReady: false,
        baselineMissingRequirements: [
          'financialBaseline',
          'prices',
          'volumes',
        ] as Array<'financialBaseline' | 'prices' | 'volumes'>,
        baselineWarnings: [] as Array<'tariffRevenueMismatch'>,
        tariffRevenueReason: null,
        readinessChecks: [
          { key: 'financials', labelKey: 'v2Overview.datasetFinancials', ready: false },
          { key: 'prices', labelKey: 'v2Overview.datasetPrices', ready: false },
          { key: 'tariffRevenue', labelKey: 'v2Overview.datasetTariffRevenue', ready: false },
          { key: 'volumes', labelKey: 'v2Overview.datasetWaterVolume', ready: false },
        ],
        missingRequirements: [] as MissingRequirement[],
        warnings: [] as ImportWarningCode[],
        setupStatus: 'excluded_from_plan' as const,
      });
    }

    return rows.sort((a, b) => b.year - a.year);
  }, [excludedYearsSorted, importYearRows, reviewedImportedYearSet]);

  const acceptedPlanningYearRows = React.useMemo(
    () => {
      const importBoardRowByYear = new Map(
        importBoardRows.map((row) => [row.vuosi, row]),
      );
      const acceptedBaselineYears = Array.isArray(planningContext?.baselineYears)
        ? planningContext.baselineYears
        : [];
      const importYearRowByYear = new Map(
        importYearRows.map((row) => [row.vuosi, row]),
      );
      const syncRowByYear = new Map(syncYearRows.map((row) => [row.vuosi, row]));

      const planningBaselineRows = acceptedBaselineYears
        .map((baselineYear) => {
          const boardRow = importBoardRowByYear.get(baselineYear.year);
          if (boardRow) {
            return {
              ...boardRow,
              sourceStatus: baselineYear.sourceStatus ?? boardRow.sourceStatus,
              baselineReady: true,
              baselineMissingRequirements: [],
            };
          }

          const importYearRow = importYearRowByYear.get(baselineYear.year);
          if (importYearRow) {
            return {
              vuosi: importYearRow.vuosi,
              sourceStatus:
                baselineYear.sourceStatus ?? importYearRow.sourceStatus,
              datasetCounts:
                importYearRow.datasetCounts ??
                deriveDatasetCounts(yearDataCache[importYearRow.vuosi]),
              baselineReady: true,
              baselineMissingRequirements: [],
              baselineWarnings: importYearRow.baselineWarnings ?? [],
              tariffRevenueReason: importYearRow.tariffRevenueReason ?? null,
              completeness: {
                tilinpaatos: baselineYear.financials != null,
                taksa: baselineYear.prices != null,
                volume_vesi: baselineYear.volumes != null,
                volume_jatevesi: baselineYear.volumes != null,
              },
              warnings: importYearRow.warnings ?? [],
              sourceLayers: buildImportYearSourceLayers(
                yearDataCache[importYearRow.vuosi],
              ),
            };
          }

          const syncRow = syncRowByYear.get(baselineYear.year);
          if (!syncRow) {
            return {
              vuosi: baselineYear.year,
              sourceStatus: baselineYear.sourceStatus,
              datasetCounts: deriveDatasetCounts(yearDataCache[baselineYear.year]),
              baselineReady: true,
              baselineMissingRequirements: [],
              baselineWarnings: [],
              tariffRevenueReason: null,
              completeness: {
                tilinpaatos: baselineYear.financials != null,
                taksa: baselineYear.prices != null,
                volume_vesi: baselineYear.volumes != null,
                volume_jatevesi: baselineYear.volumes != null,
              },
              warnings: [],
              sourceLayers: buildImportYearSourceLayers(
                yearDataCache[baselineYear.year],
              ),
            };
          }

          return {
            vuosi: syncRow.vuosi,
            sourceStatus: baselineYear.sourceStatus ?? syncRow.sourceStatus,
            datasetCounts:
              syncRow.datasetCounts ??
              deriveDatasetCounts(yearDataCache[syncRow.vuosi]),
            baselineReady: true,
            baselineMissingRequirements: [],
            baselineWarnings: syncRow.baselineWarnings ?? [],
            tariffRevenueReason: syncRow.tariffRevenueReason ?? null,
            completeness: {
              tilinpaatos: baselineYear.financials != null,
              taksa: baselineYear.prices != null,
              volume_vesi: baselineYear.volumes != null,
              volume_jatevesi: baselineYear.volumes != null,
            },
            warnings: syncRow.warnings ?? [],
            sourceLayers: buildImportYearSourceLayers(yearDataCache[syncRow.vuosi]),
          };
        })
        .sort((a, b) => b.vuosi - a.vuosi);

      if (planningBaselineRows.length > 0) {
        return planningBaselineRows;
      }

      return backendAcceptedPlanningYears
        .map((year) => {
          const boardRow = importBoardRowByYear.get(year);
          if (boardRow) {
            return boardRow;
          }

          const importYearRow = importYearRowByYear.get(year);
          if (importYearRow) {
            return {
              vuosi: importYearRow.vuosi,
              sourceStatus: importYearRow.sourceStatus,
              datasetCounts:
                importYearRow.datasetCounts ??
                deriveDatasetCounts(yearDataCache[importYearRow.vuosi]),
              baselineReady: importYearRow.baselineReady,
              baselineMissingRequirements:
                importYearRow.baselineMissingRequirements,
              baselineWarnings: importYearRow.baselineWarnings ?? [],
              tariffRevenueReason: importYearRow.tariffRevenueReason ?? null,
              completeness: importYearRow.completeness,
              warnings: importYearRow.warnings ?? [],
              sourceLayers: buildImportYearSourceLayers(
                yearDataCache[importYearRow.vuosi],
              ),
            };
          }

          const syncRow = syncRowByYear.get(year);
          if (!syncRow) {
            return null;
          }

          return {
            vuosi: syncRow.vuosi,
            sourceStatus: syncRow.sourceStatus,
            datasetCounts:
              syncRow.datasetCounts ??
              deriveDatasetCounts(yearDataCache[syncRow.vuosi]),
            baselineReady: syncRow.baselineReady,
            baselineMissingRequirements: syncRow.baselineMissingRequirements,
            baselineWarnings: syncRow.baselineWarnings ?? [],
            tariffRevenueReason: syncRow.tariffRevenueReason ?? null,
            completeness: syncRow.completeness,
            warnings: syncRow.warnings ?? [],
            sourceLayers: buildImportYearSourceLayers(yearDataCache[syncRow.vuosi]),
          };
        })
        .filter((row): row is NonNullable<typeof row> => row != null)
        .sort((a, b) => b.vuosi - a.vuosi);
    },
    [
      planningContext?.baselineYears,
      backendAcceptedPlanningYears,
      importBoardRows,
      importYearRows,
      syncYearRows,
      yearDataCache,
    ],
  );

  const reviewStatusRows = React.useMemo(() => {
    const rows = [...importReviewStatusRows];
    const visibleYears = new Set(rows.map((row) => row.year));

    for (const row of acceptedPlanningYearRows) {
      if (visibleYears.has(row.vuosi)) {
        continue;
      }
      rows.push({
        year: row.vuosi,
        sourceStatus: row.sourceStatus,
        completeness: {
          ...row.completeness,
          tariff_revenue:
            'tariff_revenue' in row.completeness
              ? (row.completeness as Record<string, boolean>).tariff_revenue
              : true,
        },
        baselineReady: true,
        baselineMissingRequirements: [] as Array<
          'financialBaseline' | 'prices' | 'volumes'
        >,
        baselineWarnings: row.baselineWarnings ?? [],
        tariffRevenueReason: row.tariffRevenueReason ?? null,
        readinessChecks: [
          {
            key: 'financials',
            labelKey: 'v2Overview.datasetFinancials',
            ready: row.completeness.tilinpaatos === true,
          },
          {
            key: 'prices',
            labelKey: 'v2Overview.datasetPrices',
            ready: row.completeness.taksa === true,
          },
          {
            key: 'tariffRevenue',
            labelKey: 'v2Overview.datasetTariffRevenue',
            ready: true,
          },
          {
            key: 'volumes',
            labelKey: 'v2Overview.datasetWaterVolume',
            ready:
              row.completeness.volume_vesi === true ||
              row.completeness.volume_jatevesi === true,
          },
        ],
        missingRequirements: [] as MissingRequirement[],
        warnings: row.warnings ?? [],
        setupStatus: 'reviewed' as const,
      });
    }

    return rows.sort((a, b) => b.year - a.year);
  }, [acceptedPlanningYearRows, importReviewStatusRows]);

  const importedBlockedYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'needs_attention')
        .length,
    [reviewStatusRows],
  );
  const pendingTechnicalReviewYearCount = React.useMemo(
    () =>
      reviewStatusRows.filter((row) => row.setupStatus === 'ready_for_review')
        .length,
    [reviewStatusRows],
  );
  const pendingReviewYearCount = pendingTechnicalReviewYearCount;

  const includedPlanningYears = React.useMemo(
    () =>
      reviewStatusRows
        .filter((row) => row.setupStatus === 'reviewed')
        .map((row) => row.year)
        .sort((a, b) => b - a),
    [reviewStatusRows],
  );

  const correctedPlanningYears = React.useMemo(
    () =>
      importYearRows
        .filter(
          (row) =>
            (row.sourceBreakdown?.manualDataTypes?.length ?? 0) > 0 ||
            row.manualEditedAt != null ||
            row.manualReason != null,
        )
        .map((row) => row.vuosi)
        .sort((a, b) => b - a),
    [importYearRows],
  );
  const correctedPlanningYearRows = React.useMemo(
    () =>
      importYearRows.filter((row) => correctedPlanningYears.includes(row.vuosi)),
    [correctedPlanningYears, importYearRows],
  );
  const correctedPlanningManualDataTypes = React.useMemo(
    () =>
      [...new Set(
        correctedPlanningYearRows.flatMap(
          (row) => row.sourceBreakdown?.manualDataTypes ?? [],
        ),
      )].sort(),
    [correctedPlanningYearRows],
  );
  const correctedPlanningVeetiDataTypes = React.useMemo(
    () =>
      [...new Set(
        correctedPlanningYearRows.flatMap(
          (row) => row.sourceBreakdown?.veetiDataTypes ?? [],
        ),
      )].sort(),
    [correctedPlanningYearRows],
  );

  const setupWizardState = React.useMemo<SetupWizardState | null>(() => {
    if (!overview) return null;

    if (baselineReady) {
      const acceptedCount = backendAcceptedPlanningYears.length;
      return resolveSetupWizardState({
        connected: overview.importStatus.connected,
        importedYearCount: acceptedCount,
        reviewedYearCount: acceptedCount,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: excludedYearsSorted.length,
        baselineReady: true,
        selectedProblemYear: null,
      });
    }

    return resolveSetupWizardState({
      connected: overview.importStatus.connected,
      importedYearCount: confirmedImportedYears.length,
      reviewedYearCount: reviewedImportedYearRows.length,
      blockedYearCount: importedBlockedYearCount,
      pendingReviewCount: pendingTechnicalReviewYearCount,
      excludedYearCount: excludedYearsSorted.length,
      baselineReady,
      selectedProblemYear: cardEditContext === 'step3' ? null : manualPatchYear,
    });
  }, [
    baselineReady,
    cardEditContext,
    confirmedImportedYears.length,
    excludedYearsSorted.length,
    importedBlockedYearCount,
    manualPatchYear,
    overview,
    pendingTechnicalReviewYearCount,
    reviewedImportedYearRows.length,
  ]);

  const reopeningAcceptedBaselineYear =
    baselineReady &&
    manualPatchYear != null &&
    cardEditContext !== 'step3' &&
    !confirmedImportedYears.includes(manualPatchYear);

  const wizardDisplayStep: SetupWizardStep =
    cardEditContext === 'step3' && cardEditYear != null
      ? 3
      : reopeningAcceptedBaselineYear
      ? 6
      : manualPatchYear != null && cardEditContext !== 'step3'
      ? 4
      : (baselineReady && reviewContinueStep === 5 ? 6 : reviewContinueStep) ??
        (setupWizardState?.activeStep === 5 &&
        correctedPlanningYears.length > 0 &&
        reviewedImportedYearRows.length > 0 &&
        importedBlockedYearCount === 0 &&
        pendingTechnicalReviewYearCount === 0 &&
        !baselineReady
          ? 3
          : setupWizardState?.activeStep ?? 1) as SetupWizardStep;

  const displaySetupWizardState = React.useMemo(() => {
    if (!setupWizardState) return null;
    return {
      ...setupWizardState,
      currentStep: wizardDisplayStep,
      recommendedStep: setupWizardState.recommendedStep,
      activeStep: wizardDisplayStep,
      selectedProblemYear:
        wizardDisplayStep === 4 && manualPatchYear != null
          ? manualPatchYear
          : null,
    };
  }, [manualPatchYear, setupWizardState, wizardDisplayStep]);

  const wizardBackStep = displaySetupWizardState
    ? resolvePreviousSetupStep(displaySetupWizardState)
    : null;

  const previewPrefetchYears = React.useMemo(
    () =>
      getPreviewPrefetchYears({
        cardEditYear,
        manualPatchYear,
        connected: overview?.importStatus.connected ?? false,
        importedWorkspaceYears,
      wizardDisplayStep,
      selectedYears,
      selectableImportYearRows,
      reviewStatusRows,
      acceptedPlanningYears: acceptedPlanningYearRows.map((row) => row.vuosi),
    }),
    [
      acceptedPlanningYearRows,
      cardEditYear,
      importedWorkspaceYears,
      manualPatchYear,
      overview?.importStatus.connected,
      reviewStatusRows,
      selectableImportYearRows,
      selectedYears,
      wizardDisplayStep,
    ],
  );

  return {
    availableYearRows,
    syncYearRows,
    selectableImportYearRows,
    importableYearRows,
    repairOnlyYearRows,
    blockedYearCount,
    blockedYearRows,
    readyAvailableYearRows,
    recommendedYears,
    importBoardRows,
    readyTrustBoardRows,
    suspiciousTrustBoardRows,
    trashbinTrustBoardRows,
    blockedTrustBoardRows,
    currentYearEstimateBoardRows,
    confirmedImportedYears,
    reviewStorageOrgId,
    persistedReviewedImportedYears,
    reviewedImportedYearRows,
    technicallyReadyImportedYearRows,
    importYearRows,
    excludedYearsSorted,
    reviewStatusRows,
    importedBlockedYearCount,
    pendingTechnicalReviewYearCount,
    pendingReviewYearCount,
    includedPlanningYears,
    acceptedPlanningYearRows,
    correctedPlanningYears,
    correctedPlanningManualDataTypes,
    correctedPlanningVeetiDataTypes,
    setupWizardState,
    wizardDisplayStep,
    displaySetupWizardState,
    wizardBackStep,
    previewPrefetchYears,
  };
}

