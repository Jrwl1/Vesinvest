import type { TFunction } from 'i18next';
import React from 'react';
import type {
  V2ForecastScenario,
  V2ReportDetail,
  V2ReportListItem,
} from '../api';
import {
  getReportDisplayTitle,
  getScenarioDisplayName,
} from './displayNames';
import {
  formatDateTime,
  formatNumber,
} from './format';
import {
  ASSUMPTION_LABEL_KEYS,
  deriveForecastFreshnessState,
  deriveReportReadinessReason,
  formatScenarioUpdatedAt,
  REPORT_VARIANT_OPTIONS,
  type ReportVariant,
  resolveAcceptedBaselineYears,
  stripTrailingParenthetical,
} from './reportReadinessModel';
import {
  createBaselineDatasetSourceLabel,
  createBaselineStatusLabel,
  createDatasetPublicationNote,
  createDataTypeLabel,
} from './reportsPageProvenance';

type Params = {
  t: TFunction;
  downloadingPdf: boolean;
  emptyStateScenario: V2ForecastScenario | null;
  handleDownloadPdf: () => Promise<void> | void;
  loadReports: () => Promise<void> | void;
  loadingDetail: boolean;
  loadingList: boolean;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToOverviewFeePath?: (planId?: string | null) => void;
  previewVariant: ReportVariant;
  reports: V2ReportListItem[];
  savedFeePathBaselineChangedSinceAcceptedRevision: boolean;
  savedFeePathClassificationReviewRequired: boolean;
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation: boolean;
  savedFeePathPlanId?: string | null;
  savedFeePathPricingStatus?: 'blocked' | 'provisional' | 'verified' | null;
  savedFeePathReportConflictActive: boolean;
  savedFeePathScenarioId?: string | null;
  scenarioFilter: string;
  selectedReport: V2ReportDetail | null;
  selectedReportId: string | null;
  setPreviewVariant: React.Dispatch<React.SetStateAction<ReportVariant>>;
  setScenarioFilter: React.Dispatch<React.SetStateAction<string>>;
  setSelectedReportId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useReportsPageViewModel({
  t,
  downloadingPdf,
  emptyStateScenario,
  handleDownloadPdf,
  loadReports,
  loadingDetail,
  loadingList,
  onGoToForecast,
  onGoToOverviewFeePath,
  previewVariant,
  reports,
  savedFeePathBaselineChangedSinceAcceptedRevision,
  savedFeePathClassificationReviewRequired,
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation,
  savedFeePathPlanId,
  savedFeePathPricingStatus,
  savedFeePathReportConflictActive,
  savedFeePathScenarioId,
  scenarioFilter,
  selectedReport,
  selectedReportId,
  setPreviewVariant,
  setScenarioFilter,
  setSelectedReportId,
}: Params) {
  const scenarioOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const row of reports) {
      if (!map.has(row.ennuste.id)) {
        map.set(
          row.ennuste.id,
          getScenarioDisplayName(row.ennuste.nimi ?? row.ennuste.id, t),
        );
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [reports, t]);

  const assumptionLabelByKey = React.useCallback(
    (key: string) => t(ASSUMPTION_LABEL_KEYS[key] ?? key, key),
    [t],
  );
  const formatAssumptionSnapshotValue = React.useCallback(
    (key: string, value: number) => {
      if (key === 'investointikerroin') {
        return formatNumber(value, 4);
      }
      return `${formatNumber(value * 100, 2)} %`;
    },
    [],
  );

  const emptyStateForecastFreshnessState = React.useMemo(
    () =>
      deriveForecastFreshnessState({
        scenario: emptyStateScenario,
        hasUnsavedChanges: false,
        isComputing: false,
      }),
    [emptyStateScenario],
  );

  const savedFeePathReportReadinessReason = React.useMemo(() => {
    if (!savedFeePathPlanId) {
      return null;
    }
    if (savedFeePathReportConflictActive) {
      return 'staleSavedFeePath' as const;
    }
    if (savedFeePathClassificationReviewRequired) {
      return 'classificationReviewRequired' as const;
    }
    if (
      (savedFeePathPricingStatus != null &&
        savedFeePathPricingStatus !== 'verified') ||
      savedFeePathBaselineChangedSinceAcceptedRevision ||
      savedFeePathInvestmentPlanChangedSinceFeeRecommendation
    ) {
      return 'staleSavedFeePath' as const;
    }
    return null;
  }, [
    savedFeePathBaselineChangedSinceAcceptedRevision,
    savedFeePathClassificationReviewRequired,
    savedFeePathInvestmentPlanChangedSinceFeeRecommendation,
    savedFeePathPlanId,
    savedFeePathPricingStatus,
    savedFeePathReportConflictActive,
  ]);

  const emptyStateReportReadinessReason = React.useMemo(
    () =>
      savedFeePathReportReadinessReason ??
      deriveReportReadinessReason({
        scenario: emptyStateScenario,
        forecastFreshnessState: emptyStateForecastFreshnessState,
      }),
    [
      emptyStateForecastFreshnessState,
      emptyStateScenario,
      savedFeePathReportReadinessReason,
    ],
  );

  const emptyStateCanCreateReport = emptyStateReportReadinessReason == null;
  const emptyStateForecastLabel = React.useMemo(() => {
    switch (emptyStateForecastFreshnessState) {
      case 'current':
        return t('v2Forecast.stateCurrent');
      case 'computing':
        return t('v2Forecast.stateComputing');
      case 'unsaved_changes':
        return t('v2Forecast.stateUnsaved');
      case 'saved_needs_recompute':
      default:
        return t('v2Forecast.stateNeedsRecompute');
    }
  }, [emptyStateForecastFreshnessState, t]);

  const emptyStateForecastToneClass = React.useMemo(() => {
    switch (emptyStateForecastFreshnessState) {
      case 'current':
        return 'v2-status-positive';
      case 'computing':
        return 'v2-status-info';
      case 'unsaved_changes':
      case 'saved_needs_recompute':
      default:
        return 'v2-status-warning';
    }
  }, [emptyStateForecastFreshnessState]);

  const emptyStateReportReadinessLabel = React.useMemo(
    () =>
      emptyStateCanCreateReport
        ? t('v2Forecast.reportReady')
        : t('v2Forecast.reportBlocked'),
    [emptyStateCanCreateReport, t],
  );

  const emptyStateReportReadinessToneClass = React.useMemo(() => {
    if (emptyStateCanCreateReport) return 'v2-status-positive';
    if (
      emptyStateReportReadinessReason === 'staleSavedFeePath' ||
      emptyStateReportReadinessReason === 'staleComputeResults' ||
      emptyStateReportReadinessReason === 'unsavedChanges'
    ) {
      return 'v2-status-warning';
    }
    return 'v2-status-neutral';
  }, [emptyStateCanCreateReport, emptyStateReportReadinessReason]);

  const emptyStateReportReadinessHint = React.useMemo(() => {
    switch (emptyStateReportReadinessReason) {
      case 'unsavedChanges':
        return t(
          'v2Forecast.unsavedHint',
          'You have unsaved changes. Save and compute results before creating report.',
        );
      case 'missingComputeResults':
        return t(
          'v2Forecast.computeBeforeReport',
          'Recompute results before creating report.',
        );
      case 'staleComputeResults':
        return t(
          'v2Forecast.staleComputeHint',
          'Saved inputs changed after the last calculation. Recompute results before creating report.',
        );
      case 'missingDepreciationSnapshots':
        return t(
          'v2Forecast.depreciationSnapshotsMissingHint',
          'Refresh the synced Vesinvest class plan and recompute results before creating report.',
        );
      case 'classificationReviewRequired':
        return t(
          'v2Forecast.classificationReviewRequired',
          'Review and save the Vesinvest class plan before creating a report.',
        );
      case 'staleSavedFeePath':
      case 'missingScenario':
        if (emptyStateReportReadinessReason === 'staleSavedFeePath') {
          return t(
            'v2Forecast.staleComputeHint',
            'Saved inputs changed after the last calculation. Recompute results before creating report.',
          );
        }
        return t(
          'v2Reports.emptyHint',
          'Open Forecast, compute a scenario, and create your first report.',
        );
      default:
        return t(
          'v2Forecast.reportReadyHint',
          'Latest computed scenario can be published as a report.',
        );
    }
  }, [emptyStateReportReadinessReason, t]);

  const emptyStateCtaLabel = React.useMemo(() => {
    switch (emptyStateReportReadinessReason) {
      case 'classificationReviewRequired':
      case 'staleSavedFeePath':
        return t('v2Shell.tabs.tariffPlan', 'Tariff Plan');
      case 'unsavedChanges':
        return t(
          'v2Reports.openForecastToSaveAndCompute',
          'Open Forecast to save and compute',
        );
      case 'missingComputeResults':
      case 'missingDepreciationSnapshots':
      case 'staleComputeResults':
        return t(
          'v2Reports.openForecastToRecompute',
          'Open Forecast to recompute results',
        );
      case 'missingScenario':
        return t('v2Reports.openForecast');
      default:
        return t(
          'v2Reports.openForecastToCreateReport',
          'Open Forecast to create report',
        );
    }
  }, [emptyStateReportReadinessReason, t]);

  const handleEmptyStateAction = React.useCallback(() => {
    if (
      (emptyStateReportReadinessReason === 'classificationReviewRequired' ||
        emptyStateReportReadinessReason === 'staleSavedFeePath') &&
      savedFeePathPlanId
    ) {
      onGoToOverviewFeePath?.(savedFeePathPlanId);
      return;
    }
    onGoToForecast(savedFeePathScenarioId ?? emptyStateScenario?.id ?? null);
  }, [
    emptyStateReportReadinessReason,
    emptyStateScenario?.id,
    onGoToForecast,
    onGoToOverviewFeePath,
    savedFeePathPlanId,
    savedFeePathScenarioId,
  ]);

  const emptyStateComputedVersionLabel = React.useMemo(
    () =>
      emptyStateScenario?.computedFromUpdatedAt
        ? formatScenarioUpdatedAt(emptyStateScenario.computedFromUpdatedAt)
        : t('v2Forecast.reportStateMissing'),
    [emptyStateScenario?.computedFromUpdatedAt, t],
  );

  const reportsHeaderHint = React.useMemo(() => {
    if (reports.length > 0) {
      return t(
        'v2Reports.listHint',
        'Review saved reports, variants, and PDF export state.',
      );
    }
    return emptyStateReportReadinessHint;
  }, [emptyStateReportReadinessHint, reports.length, t]);

  const handleSavedFeePathAction = React.useCallback(() => {
    if (savedFeePathPlanId) {
      onGoToOverviewFeePath?.(savedFeePathPlanId);
    }
  }, [onGoToOverviewFeePath, savedFeePathPlanId]);

  const reportVariantLabel = React.useCallback(
    (variant: ReportVariant) =>
      t(
        variant === 'public_summary'
          ? 'v2Reports.variantPublic'
          : 'v2Reports.variantConfidential',
      ),
    [t],
  );

  const baselineDatasetSourceLabel = React.useMemo(
    () => createBaselineDatasetSourceLabel(t),
    [t],
  );
  const baselineStatusLabel = React.useMemo(
    () => createBaselineStatusLabel(t),
    [t],
  );
  const dataTypeLabel = React.useMemo(() => createDataTypeLabel(t), [t]);
  const datasetPublicationNote = React.useMemo(
    () => createDatasetPublicationNote(t),
    [t],
  );

  const activeVariant = React.useMemo(
    () =>
      REPORT_VARIANT_OPTIONS.find((option) => option.id === previewVariant) ??
      REPORT_VARIANT_OPTIONS[1],
    [previewVariant],
  );
  const showDetailedInvestmentPlan = activeVariant.sections.yearlyInvestments;
  const reportNearTermExpenseLabel = React.useMemo(
    () =>
      stripTrailingParenthetical(
        t(
          'v2Forecast.nearTermExpenseTitle',
          'Near-term expense assumptions (editable)',
        ),
      ),
    [t],
  );

  const selectedListReport = React.useMemo(
    () => reports.find((row) => row.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );
  const selectedListReportTitle = React.useMemo(
    () =>
      selectedListReport
        ? getReportDisplayTitle({
            title: selectedListReport.title,
            scenarioName:
              selectedListReport.ennuste.nimi ?? selectedListReport.ennuste.id,
            createdAt: selectedListReport.createdAt,
            t,
          })
        : null,
    [selectedListReport, t],
  );
  const selectedPreviewTitle = React.useMemo(
    () =>
      selectedReport
        ? getReportDisplayTitle({
            title: selectedReport.title,
            scenarioName:
              selectedReport.ennuste.nimi ?? selectedReport.ennuste.id,
            createdAt: selectedReport.createdAt,
            t,
          })
        : selectedListReportTitle,
    [selectedListReportTitle, selectedReport, t],
  );
  const selectedAcceptedBaselineYearsLabel = React.useMemo(() => {
    const years = resolveAcceptedBaselineYears(selectedReport?.snapshot);
    return years.length > 0 ? years.join(', ') : '-';
  }, [selectedReport]);
  const selectedBaselineSourceSummaries = React.useMemo(() => {
    const summaries = selectedReport?.snapshot.baselineSourceSummaries ?? [];
    if (summaries.length > 0) {
      return [...summaries].sort((left, right) => left.year - right.year);
    }
    const primary = selectedReport?.snapshot.baselineSourceSummary ?? null;
    return primary ? [primary] : [];
  }, [selectedReport]);
  const selectedScenarioBranchLabel = React.useMemo(() => {
    const value = selectedReport?.snapshot.scenario.scenarioType;
    if (value === 'base') return t('v2Forecast.baseScenario', 'Base');
    if (value === 'committed') return t('v2Forecast.committedScenario', 'Committed');
    if (value === 'hypothesis') return t('v2Forecast.hypothesisScenario', 'Hypothesis');
    if (value === 'stress') return t('v2Forecast.stressScenario', 'Stress');
    return '-';
  }, [selectedReport, t]);
  const selectedScenarioHorizonLabel = React.useMemo(() => {
    const years = selectedReport?.snapshot.scenario.years ?? [];
    if (years.length > 0) {
      return `${years[0]?.year}-${years[years.length - 1]?.year}`;
    }
    const baselineYear = selectedReport?.snapshot.scenario.baselineYear ?? null;
    const horizonYears = selectedReport?.snapshot.scenario.horizonYears ?? null;
    if (
      baselineYear != null &&
      horizonYears != null &&
      Number.isFinite(horizonYears) &&
      horizonYears > 0
    ) {
      return `${baselineYear}-${baselineYear + horizonYears - 1}`;
    }
    return '-';
  }, [selectedReport]);

  const selectedReportPrimaryFeeSignal = React.useMemo(() => {
    const scenario = selectedReport?.snapshot.scenario ?? null;
    return {
      priceLabel: t(
        'v2Forecast.requiredPriceAnnualResult',
        'Required price today (annual result = 0)',
      ),
      price:
        scenario?.requiredPriceTodayCombinedAnnualResult ??
        selectedReport?.requiredPriceToday ??
        scenario?.requiredPriceTodayCombinedCumulativeCash ??
        0,
      increaseLabel: t(
        'v2Forecast.requiredIncreaseAnnualResult',
        'Required increase vs comparator (annual result)',
      ),
      increase:
        scenario?.requiredAnnualIncreasePctAnnualResult ??
        selectedReport?.requiredAnnualIncreasePct ??
        scenario?.requiredAnnualIncreasePctCumulativeCash ??
        0,
    };
  }, [selectedReport, t]);
  const selectedPrimaryBaselineSourceSummary = React.useMemo(
    () =>
      selectedReport?.snapshot.baselineSourceSummary ??
      selectedBaselineSourceSummaries[selectedBaselineSourceSummaries.length - 1] ??
      null,
    [selectedBaselineSourceSummaries, selectedReport],
  );

  const selectedVesinvestAppendix =
    selectedReport?.snapshot.vesinvestAppendix ?? null;
  const selectedInvestmentSummary = React.useMemo(() => {
    const yearlyTotals = selectedVesinvestAppendix?.yearlyTotals ?? [];
    if (yearlyTotals.length === 0) {
      return { coverageLabel: '-', peakYear: null as number | null, peakAmount: 0 };
    }
    const distinctYears = [...new Set(yearlyTotals.map((item) => item.year))].sort(
      (left, right) => left - right,
    );
    const peak = yearlyTotals.reduce((current, item) =>
      item.totalAmount > current.totalAmount ? item : current,
    );
    const firstYear = distinctYears[0] ?? null;
    const lastYear = distinctYears[distinctYears.length - 1] ?? null;
    return {
      coverageLabel:
        firstYear != null && lastYear != null
          ? firstYear === lastYear
            ? `${firstYear} (${distinctYears.length})`
            : `${firstYear}-${lastYear} (${distinctYears.length})`
          : '-',
      peakYear: peak.year,
      peakAmount: peak.totalAmount,
    };
  }, [selectedVesinvestAppendix]);
  const selectedTariffDriverSummary = React.useMemo(() => {
    if (!selectedReport) return null;
    const scenario = selectedReport.snapshot.scenario;
    const openingYear = scenario.years[0] ?? null;
    const peakYearlyInvestment =
      selectedVesinvestAppendix?.yearlyTotals?.reduce((current, item) =>
        item.totalAmount > current.totalAmount ? item : current,
      ) ?? null;
    const nearTermExpenseRows = [...scenario.nearTermExpenseAssumptions].sort(
      (left, right) => left.year - right.year,
    );
    return {
      baselineCombinedPrice: scenario.baselinePriceTodayCombined,
      baselineSoldVolume: openingYear?.soldVolume ?? null,
      openingDepreciation: openingYear?.totalDepreciation ?? null,
      peakInvestmentYear: peakYearlyInvestment?.year ?? null,
      peakInvestmentAmount: peakYearlyInvestment?.totalAmount ?? null,
      nearTermExpenseYears:
        nearTermExpenseRows.length > 0
          ? `${nearTermExpenseRows[0]?.year}-${nearTermExpenseRows[nearTermExpenseRows.length - 1]?.year}`
          : null,
    };
  }, [selectedReport, selectedVesinvestAppendix]);
  const selectedTariffAssumptionRows = React.useMemo(
    () =>
      !activeVariant.sections.assumptions
        ? []
        : Object.entries(selectedReport?.snapshot.scenario.assumptions ?? {})
            .filter(([key]) => key !== '__scenarioTypeCode')
            .map(([key, value]) => ({
              key,
              label: assumptionLabelByKey(key),
              value: formatAssumptionSnapshotValue(key, value),
            })),
    [
      activeVariant.sections.assumptions,
      assumptionLabelByKey,
      formatAssumptionSnapshotValue,
      selectedReport,
    ],
  );

  const downloadMatchesPreview =
    selectedReport != null ? selectedReport.variant === previewVariant : true;
  const selectedReportHasPdf = Boolean(selectedReport?.pdfUrl);
  const canDownloadPdf =
    selectedReport != null &&
    selectedReportHasPdf &&
    downloadMatchesPreview &&
    !downloadingPdf;
  const selectedReportScenarioName =
    selectedReport?.ennuste.nimi ?? selectedReport?.ennuste.id ?? '-';
  const selectedReportGeneratedAt = selectedReport
    ? formatDateTime(selectedReport.snapshot.generatedAt ?? selectedReport.createdAt)
    : '-';
  const selectedReportExportHint = React.useMemo(() => {
    if (downloadingPdf) return null;
    if (!selectedReportHasPdf) {
      return t(
        'v2Reports.errorDownloadPdfUnavailable',
        'PDF export is temporarily unavailable. Please try again later.',
      );
    }
    if (!downloadMatchesPreview) {
      return t(
        'v2Reports.downloadUsesSavedVariant',
        'PDF download still uses the saved report variant. Switch back to that variant to export.',
      );
    }
    return t(
      'v2Reports.exportReady',
      'Saved report is available for export.',
    );
  }, [downloadMatchesPreview, downloadingPdf, selectedReportHasPdf, t]);
  const hasSelectedReportLayout = selectedReportId != null;

  return {
    hasSelectedReportLayout,
    listColumnProps: {
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
    },
    previewColumnProps: {
      activeVariant,
      assumptionLabelByKey,
      baselineDatasetSourceLabel,
      baselineStatusLabel,
      canDownloadPdf,
      dataTypeLabel,
      datasetPublicationNote,
      downloadingPdf,
      emptyStateReportReadinessHint,
      formatAssumptionSnapshotValue,
      handleDownloadPdf,
      hasSelectedReportLayout,
      loadingDetail,
      onGoToForecast,
      previewVariant,
      reportNearTermExpenseLabel,
      reportVariantLabel,
      reports,
      selectedAcceptedBaselineYearsLabel,
      selectedBaselineSourceSummaries,
      selectedInvestmentSummary,
      selectedPreviewTitle,
      selectedPrimaryBaselineSourceSummary,
      selectedReport,
      selectedReportExportHint,
      selectedReportGeneratedAt,
      selectedReportPrimaryFeeSignal,
      selectedReportScenarioName,
      selectedScenarioBranchLabel,
      selectedScenarioHorizonLabel,
      selectedTariffAssumptionRows,
      selectedTariffDriverSummary,
      selectedVesinvestAppendix,
      setPreviewVariant,
      showDetailedInvestmentPlan,
      t,
    },
  };
}
