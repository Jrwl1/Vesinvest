import type { TFunction } from 'i18next';
import React from 'react';
import type {
  V2ForecastScenario,
  V2ReportDetail,
  V2ReportListItem,
} from '../api';
import {
  getReportCompactDisplayTitle,
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
  creatingPreviewPackage: boolean;
  downloadingPdf: boolean;
  emptyStateBaselineYears: number[];
  emptyStateScenario: V2ForecastScenario | null;
  handleCreateFirstPackage: () => Promise<void> | void;
  handleCreatePreviewPackage: () => Promise<void> | void;
  handleDownloadPdf: () => Promise<void> | void;
  loadReports: () => Promise<void> | void;
  loadingDetail: boolean;
  loadingList: boolean;
  onGoToAssetManagement?: () => void;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToOverviewFeePath?: (planId?: string | null) => void;
  previewVariant: ReportVariant;
  reports: V2ReportListItem[];
  savedFeePathBaselineChangedSinceAcceptedRevision: boolean;
  savedFeePathClassificationReviewRequired: boolean;
  savedFeePathAssetEvidenceReady: boolean;
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation: boolean;
  savedFeePathPlanId?: string | null;
  savedFeePathPlanRequired: boolean;
  savedFeePathPricingStatus?: 'blocked' | 'provisional' | 'verified' | null;
  savedFeePathTariffPlanStatus?: 'draft' | 'accepted' | 'stale' | null;
  savedFeePathReportConflictActive: boolean;
  savedFeePathScenarioId?: string | null;
  scenarioFilter: string;
  selectedReport: V2ReportDetail | null;
  selectedReportId: string | null;
  setPreviewVariant: (variant: ReportVariant) => void;
  setScenarioFilter: React.Dispatch<React.SetStateAction<string>>;
  setSelectedReportId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useReportsPageViewModel({
  t,
  creatingPreviewPackage,
  downloadingPdf,
  emptyStateBaselineYears,
  emptyStateScenario,
  handleCreateFirstPackage,
  handleCreatePreviewPackage,
  handleDownloadPdf,
  loadReports,
  loadingDetail,
  loadingList,
  onGoToAssetManagement,
  onGoToForecast,
  onGoToOverviewFeePath,
  previewVariant,
  reports,
  savedFeePathBaselineChangedSinceAcceptedRevision,
  savedFeePathClassificationReviewRequired,
  savedFeePathAssetEvidenceReady,
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation,
  savedFeePathPlanId,
  savedFeePathPlanRequired,
  savedFeePathPricingStatus,
  savedFeePathTariffPlanStatus,
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
      return savedFeePathPlanRequired ? 'missingActivePlan' as const : null;
    }
    if (!savedFeePathScenarioId) {
      return 'missingScenario' as const;
    }
    if (savedFeePathReportConflictActive) {
      return 'staleSavedFeePath' as const;
    }
    if (savedFeePathClassificationReviewRequired) {
      return 'classificationReviewRequired' as const;
    }
    if (!savedFeePathAssetEvidenceReady) {
      return 'assetEvidenceIncomplete' as const;
    }
    if (savedFeePathTariffPlanStatus === 'stale') {
      return 'staleSavedFeePath' as const;
    }
    if (savedFeePathTariffPlanStatus !== 'accepted') {
      return 'missingAcceptedTariffPlan' as const;
    }
    if (
      savedFeePathPricingStatus !== 'verified' ||
      savedFeePathBaselineChangedSinceAcceptedRevision ||
      savedFeePathInvestmentPlanChangedSinceFeeRecommendation
    ) {
      return 'staleSavedFeePath' as const;
    }
    return null;
  }, [
    savedFeePathBaselineChangedSinceAcceptedRevision,
    savedFeePathAssetEvidenceReady,
    savedFeePathClassificationReviewRequired,
    savedFeePathInvestmentPlanChangedSinceFeeRecommendation,
    savedFeePathPlanId,
    savedFeePathPlanRequired,
    savedFeePathPricingStatus,
    savedFeePathScenarioId,
    savedFeePathTariffPlanStatus,
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

  const emptyStateCanCreateReport =
    emptyStateReportReadinessReason == null &&
    Boolean(savedFeePathPlanId) &&
    Boolean(savedFeePathScenarioId);
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
      emptyStateReportReadinessReason === 'missingActivePlan' ||
      emptyStateReportReadinessReason === 'missingAcceptedTariffPlan' ||
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
      case 'assetEvidenceIncomplete':
        return t(
          'v2Vesinvest.assetEvidenceReportBlocked',
          'Complete asset-management evidence before creating reports.',
        );
      case 'missingActivePlan':
        return t(
          'v2Vesinvest.workflowCreatePlanBody',
          'After the VEETI utility is connected, create the first plan revision and carry the linked identity into Vesinvest.',
        );
      case 'missingAcceptedTariffPlan':
        return t(
          'v2TariffPlan.acceptBeforeReports',
          'Accept the tariff plan before creating reports.',
        );
      case 'staleSavedFeePath':
      case 'missingScenario':
        if (emptyStateReportReadinessReason === 'staleSavedFeePath') {
          if (savedFeePathTariffPlanStatus === 'stale') {
            return t(
              'v2TariffPlan.acceptCurrentBeforeReports',
              'Accept the current tariff plan before creating reports.',
            );
          }
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
  }, [emptyStateReportReadinessReason, savedFeePathTariffPlanStatus, t]);

  const emptyStateCtaLabel = React.useMemo(() => {
    if (emptyStateCanCreateReport) {
      return t(
        'v2Reports.createFirstPackage',
        'Create report package',
      );
    }
    switch (emptyStateReportReadinessReason) {
      case 'missingActivePlan':
      case 'assetEvidenceIncomplete':
        return t('v2Shell.tabs.assetManagement', 'Asset Management');
      case 'classificationReviewRequired':
      case 'missingAcceptedTariffPlan':
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
  }, [emptyStateCanCreateReport, emptyStateReportReadinessReason, t]);

  const handleEmptyStateAction = React.useCallback(() => {
    if (emptyStateCanCreateReport) {
      void handleCreateFirstPackage();
      return;
    }
    if (emptyStateReportReadinessReason === 'missingActivePlan') {
      onGoToAssetManagement?.();
      return;
    }
    if (emptyStateReportReadinessReason === 'assetEvidenceIncomplete') {
      onGoToAssetManagement?.();
      return;
    }
    if (
      (emptyStateReportReadinessReason === 'classificationReviewRequired' ||
        emptyStateReportReadinessReason === 'missingAcceptedTariffPlan' ||
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
    emptyStateCanCreateReport,
    handleCreateFirstPackage,
    onGoToAssetManagement,
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
        variant === 'regulator_package'
          ? 'v2Reports.variantRegulator'
          : variant === 'board_package'
            ? 'v2Reports.variantBoard'
            : 'v2Reports.variantInternal',
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
      REPORT_VARIANT_OPTIONS[0],
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
        ? getReportCompactDisplayTitle({
            variant: selectedListReport.variant,
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
        ? getReportCompactDisplayTitle({
            variant: selectedReport.variant,
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
        'v2Forecast.requiredPriceToday',
        'Required price today',
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
  const selectedReportCashFloorSignal = React.useMemo(() => {
    const scenario = selectedReport?.snapshot.scenario ?? null;
    return {
      priceLabel: t(
        'v2Reports.cashSufficiencyFloor',
        'Cumulative cash floor',
      ),
      price:
        scenario?.requiredPriceTodayCombinedCumulativeCash ??
        selectedReport?.requiredPriceToday ??
        0,
      increaseLabel: t(
        'v2Reports.cashSufficiencyIncrease',
        'Cash sufficiency increase',
      ),
      increase:
        scenario?.requiredAnnualIncreasePctCumulativeCash ??
        selectedReport?.requiredAnnualIncreasePct ??
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
  const currentWorkflowBlockHint =
    savedFeePathReportReadinessReason == null
      ? null
      : emptyStateReportReadinessHint;
  const canCreatePreviewPackage =
    selectedReport != null &&
    selectedReport.variant !== previewVariant &&
    selectedReport.snapshot.vesinvestPlan?.id != null &&
    !creatingPreviewPackage &&
    currentWorkflowBlockHint == null;
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
  const selectedReportTariffPlanLabel = React.useMemo(() => {
    const tariffPlan = selectedReport?.snapshot.tariffPlan ?? null;
    if (!tariffPlan) return null;
    if (tariffPlan.status === 'accepted') {
      return tariffPlan.acceptedAt
        ? t('v2Reports.acceptedTariffPlanAt', 'Accepted {{date}}', {
            date: formatDateTime(tariffPlan.acceptedAt),
          })
        : t('v2TariffPlan.statusAccepted', 'Accepted');
    }
    if (tariffPlan.status === 'stale') {
      return t('v2TariffPlan.statusStale', 'Stale');
    }
    return t('v2TariffPlan.statusDraft', 'Draft');
  }, [selectedReport, t]);
  const selectedReportExportHint = React.useMemo(() => {
    if (downloadingPdf) return null;
    if (!selectedReportHasPdf) {
      return t(
        'v2Reports.errorDownloadPdfUnavailable',
        'PDF export is temporarily unavailable. Please try again later.',
      );
    }
    if (!downloadMatchesPreview) {
      if (currentWorkflowBlockHint) {
        return t(
          'v2Reports.exportSavedCurrentBlocked',
          'Saved package can be exported. New packages are blocked until the current workflow is ready: {{reason}}',
          { reason: currentWorkflowBlockHint },
        );
      }
      return t(
        'v2Reports.downloadUsesSavedVariant',
        'Create this package variant before downloading its PDF.',
      );
    }
    return t(
      'v2Reports.exportReady',
      'Saved report is available for export from the accepted tariff plan.',
    );
  }, [
    currentWorkflowBlockHint,
    downloadMatchesPreview,
    downloadingPdf,
    selectedReportHasPdf,
    t,
  ]);
  const emptyStatePrimaryFeeSignal = React.useMemo(() => {
    const scenario = emptyStateScenario;
    return {
      price: scenario?.requiredPriceTodayCombinedAnnualResult ??
        scenario?.requiredPriceTodayCombined ??
        scenario?.requiredPriceTodayCombinedCumulativeCash ??
        null,
      increase: scenario?.requiredAnnualIncreasePctAnnualResult ??
        scenario?.requiredAnnualIncreasePct ??
        scenario?.requiredAnnualIncreasePctCumulativeCash ??
        null,
    };
  }, [emptyStateScenario]);
  const emptyStateBaselineYearsLabel = React.useMemo(
    () => (emptyStateBaselineYears.length > 0 ? emptyStateBaselineYears.join(', ') : '-'),
    [emptyStateBaselineYears],
  );
  const hasSelectedReportLayout = selectedReportId != null || reports.length === 0;

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
      canCreatePreviewPackage,
      creatingPreviewPackage,
      dataTypeLabel,
      datasetPublicationNote,
      downloadingPdf,
      emptyStateActionBusy: creatingPreviewPackage,
      emptyStateActionBusyLabel: t('v2Reports.creatingPackage', 'Creating package...'),
      emptyStateBaselineYearsLabel,
      emptyStateCanCreateReport,
      emptyStateComputedVersionLabel,
      emptyStateCtaLabel,
      emptyStateForecastLabel,
      emptyStatePrimaryFeeSignal,
      emptyStateReportReadinessHint,
      emptyStateReportReadinessLabel,
      emptyStateReportReadinessToneClass,
      emptyStateScenario,
      formatAssumptionSnapshotValue,
      handleEmptyStateAction,
      handleCreatePreviewPackage,
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
      selectedReportTariffPlanLabel,
      selectedReportCashFloorSignal,
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
