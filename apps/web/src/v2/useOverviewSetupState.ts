import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse, V2OverviewResponse } from '../api';
import {
  getSyncBlockReasonLabel as buildSyncBlockReasonLabel,
  getImportYearSummaryLabel as buildImportYearSummaryLabel,
  getRequirementDatasetLabel as buildRequirementDatasetLabel,
} from './overviewLabels';
import { IMPORT_BOARD_CANON_ROWS } from './overviewManualForms';
import { getPreviewPrefetchYears } from './overviewSelectors';
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
  completeness: Record<string, boolean>,
  tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null | undefined,
  yearData: V2ImportYearDataResponse | undefined,
): {
  completeness: Record<string, boolean>;
  tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null;
} {
  if (!yearData) {
    return {
      completeness,
      tariffRevenueReason: tariffRevenueReason ?? null,
    };
  }

  const summaryRows = buildImportYearSummaryRows(yearData);
  const summaryMap = new Map(summaryRows.map((row) => [row.key, row]));
  const hasCanonicalFinancialRows = IMPORT_BOARD_CANON_ROWS.every((item) => {
    const row = summaryMap.get(item.key);
    return row?.effectiveValue != null;
  });

  return {
    completeness: {
      ...completeness,
      tilinpaatos: hasCanonicalFinancialRows,
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
    tariffRevenueReason:
      yearData.tariffRevenueReason ??
      (yearData.completeness.tariff_revenue === false
        ? tariffRevenueReason ?? null
        : null),
  };
}

export function getExactEditedFieldLabels(params: {
  t: TFunction;
  yearData: V2ImportYearDataResponse | undefined;
  changedSummaryKeys: string[];
  statementImportFieldSources?: Array<{ sourceField: string }>;
  workbookImportFieldSources?: Array<{ sourceField: string }>;
}): string[] {
  const { t, yearData, changedSummaryKeys, statementImportFieldSources, workbookImportFieldSources } =
    params;
  const labels = new Set<string>();
  const financialFieldSources = [
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
        const mergedSignals = mergeYearDataSignals(
          row.completeness,
          row.tariffRevenueReason,
          yearDataCache[row.vuosi],
        );
        const mergedRow = {
          ...row,
          completeness: mergedSignals.completeness,
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
      return [...years].sort((a, b) => b - a);
    },
    [excludedYearOverrides, overview?.importStatus.excludedYears],
  );
  const excludedYearSet = React.useMemo(
    () => new Set(excludedYearsSorted),
    [excludedYearsSorted],
  );

  const readyAvailableYearRows = React.useMemo(
    () =>
      syncYearRows.filter(
        (row) =>
          row.planningRole !== 'current_year_estimate' && !row.syncBlockedReason,
      ),
    [syncYearRows],
  );

  const recommendedYears = React.useMemo(
    () =>
      [...readyAvailableYearRows]
        .sort((a, b) => b.vuosi - a.vuosi)
        .slice(0, 3)
        .map((row) => row.vuosi),
    [readyAvailableYearRows],
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
      const missingRequiredInputs = [
        {
          present: row.completeness?.tilinpaatos,
          label: t('v2Overview.datasetFinancials', 'Tilinpäätös'),
        },
        {
          present: row.completeness?.taksa,
          label: t('v2Overview.datasetPrices', 'Taksa'),
        },
        {
          present: row.completeness?.tariff_revenue !== false,
          label:
            row.tariffRevenueReason === 'mismatch'
              ? buildSyncBlockReasonLabel(t, row) ??
                t(
                  'v2Overview.requirementTariffRevenueMismatch',
                  'Tariff revenue does not reconcile with prices, volumes, and base-fee revenue',
                )
              : buildRequirementDatasetLabel(t, 'tariffRevenue'),
        },
        {
          present: row.completeness?.volume_vesi,
          label: t('v2Overview.previewWaterVolumeLabel', 'Myyty vesi'),
        },
        {
          present: row.completeness?.volume_jatevesi,
          label: t('v2Overview.previewWastewaterVolumeLabel', 'Myyty jätevesi'),
        },
      ].filter((item) => !item.present);
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
      const isExcludedFromPlan = excludedYearSet.has(row.vuosi);
      const lane =
        row.syncBlockedReason != null
          ? 'blocked'
          : missingCoreCostStructure ||
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
              total: 5,
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
  }, [excludedYearSet, selectedYears, selectableImportYearRows, yearDataCache, t]);

  const readyTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          row.planningRole !== 'current_year_estimate' &&
          !row.isExcludedFromPlan &&
          row.lane === 'ready',
      ),
    [importBoardRows],
  );
  const suspiciousTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          row.planningRole !== 'current_year_estimate' &&
          !row.isExcludedFromPlan &&
          row.lane === 'suspicious',
      ),
    [importBoardRows],
  );
  const trashbinTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          row.planningRole !== 'current_year_estimate' &&
          row.isExcludedFromPlan,
      ),
    [importBoardRows],
  );
  const blockedTrustBoardRows = React.useMemo(
    () =>
      importBoardRows.filter(
        (row) =>
          row.planningRole !== 'current_year_estimate' &&
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
          const mergedSignals = mergeYearDataSignals(
            row.completeness,
            row.tariffRevenueReason,
            yearDataCache[row.vuosi],
          );
          const effectiveRow = {
            ...row,
            completeness: mergedSignals.completeness,
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

  const reviewStatusRows = React.useMemo(() => {
    const rows = importYearRows.map((row) => ({
      year: row.vuosi,
      sourceStatus: row.sourceStatus,
      completeness: row.completeness,
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

  const acceptedPlanningYearRows = React.useMemo(
    () =>
      importBoardRows
        .filter((row) => includedPlanningYears.includes(row.vuosi))
        .sort((a, b) => b.vuosi - a.vuosi),
    [importBoardRows, includedPlanningYears],
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

  const wizardDisplayStep: SetupWizardStep =
    cardEditContext === 'step3' && cardEditYear != null
      ? 3
      : manualPatchYear != null && cardEditContext !== 'step3'
      ? 4
      : reviewContinueStep ??
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
      }),
    [
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
