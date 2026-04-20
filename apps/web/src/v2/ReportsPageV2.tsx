import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  type V2ForecastScenario,
  type V2OverrideProvenance,
  type V2ReportDetail,
} from '../api';
import {
  formatDateTime,
  formatEur,
  formatNumber,
  formatPercent,
  formatPrice,
} from './format';
import {
  getReportDisplayTitle,
  getScenarioDisplayName,
} from './displayNames';
import {
  getDocumentImportEvidence,
  getImportedFileNameByKind,
  normalizeImportedFileName,
} from './provenanceDisplay';
import {
  appendDetailSuffix,
  ASSUMPTION_LABEL_KEYS,
  deriveForecastFreshnessState,
  deriveReportReadinessReason,
  formatScenarioUpdatedAt,
  ForecastFreshnessState,
  readForecastRuntimeState,
  REPORT_VARIANT_OPTIONS,
  ReportReadinessReason,
  ReportVariant,
  resolveAcceptedBaselineYears,
  stripTrailingParenthetical,
} from './reportReadinessModel';
import { ReportsListColumn, ReportsPreviewColumn } from './reportsPageSections';
import { useReportsPageController } from './useReportsPageController';

type Props = {
  refreshToken: number;
  focusedReportId: string | null;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToOverviewFeePath?: (planId?: string | null) => void;
  savedFeePathPlanId?: string | null;
  savedFeePathScenarioId?: string | null;
  savedFeePathPricingStatus?: 'blocked' | 'provisional' | 'verified' | null;
  savedFeePathClassificationReviewRequired?: boolean;
  savedFeePathBaselineChangedSinceAcceptedRevision?: boolean;
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation?: boolean;
  savedFeePathReportConflictActive?: boolean;
  onFocusedReportChange?: (
    reportId: string | null,
    scenarioId: string | null,
  ) => void;
};

export const ReportsPageV2: React.FC<Props> = ({
  refreshToken,
  focusedReportId,
  onGoToForecast,
  onGoToOverviewFeePath,
  savedFeePathPlanId,
  savedFeePathScenarioId,
  savedFeePathPricingStatus,
  savedFeePathClassificationReviewRequired = false,
  savedFeePathBaselineChangedSinceAcceptedRevision = false,
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation = false,
  savedFeePathReportConflictActive = false,
  onFocusedReportChange,
}) => {
  const { t } = useTranslation();
  const {
    downloadingPdf,
    emptyStateScenario,
    error,
    handleDownloadPdf,
    loadReports,
    loadingDetail,
    loadingList,
    previewVariant,
    reports,
    scenarioFilter,
    selectedReport,
    selectedReportId,
    setPreviewVariant,
    setScenarioFilter,
    setSelectedReportId,
  } = useReportsPageController({
    focusedReportId,
    refreshToken,
    savedFeePathScenarioId,
  });

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
      (savedFeePathPricingStatus != null && savedFeePathPricingStatus !== 'verified') ||
      savedFeePathBaselineChangedSinceAcceptedRevision ||
      savedFeePathInvestmentPlanChangedSinceFeeRecommendation
    ) {
      return 'staleSavedFeePath' as const;
    }
    return null;
  }, [
    savedFeePathBaselineChangedSinceAcceptedRevision,
    savedFeePathClassificationReviewRequired,
    savedFeePathReportConflictActive,
    savedFeePathInvestmentPlanChangedSinceFeeRecommendation,
    savedFeePathPlanId,
    savedFeePathPricingStatus,
  ]);

  const emptyStateReportReadinessReason = React.useMemo(
    () =>
      savedFeePathReportReadinessReason ??
      deriveReportReadinessReason({
        scenario: emptyStateScenario,
        forecastFreshnessState: emptyStateForecastFreshnessState,
      }),
    [
      emptyStateScenario,
      emptyStateForecastFreshnessState,
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
        return t('v2Vesinvest.openPricing', 'Open fee path');
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
    if (savedFeePathReportConflictActive) {
      return emptyStateReportReadinessHint;
    }
    return emptyStateReportReadinessHint;
  }, [emptyStateReportReadinessHint, reports.length, savedFeePathReportConflictActive, t]);

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

  const baselineDatasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: V2OverrideProvenance | null | undefined,
    ) => {
      const documentEvidence = getDocumentImportEvidence(provenance);
      const documentFileName = normalizeImportedFileName(
        documentEvidence.fileName ?? provenance?.fileName,
        'PDF document',
      );
      const withDocumentEvidence = (value: string, extraDetails: string[] = []) =>
        appendDetailSuffix(value, [...extraDetails, documentEvidence.pageLabel]);
      const hasStatementImport =
        provenance?.kind === 'statement_import' ||
        (provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'statement_import',
        ) ??
          false);
      const hasDocumentImport =
        provenance?.kind === 'document_import' ||
        (provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'document_import',
        ) ??
          false);
      const hasWorkbookImport =
        provenance?.kind === 'kva_import' ||
        provenance?.kind === 'excel_import' ||
        (provenance?.fieldSources?.some(
          (item) =>
            item.provenance.kind === 'kva_import' ||
            item.provenance.kind === 'excel_import',
        ) ??
          false);
      if (hasDocumentImport && hasWorkbookImport) {
        return withDocumentEvidence(
          t(
            'v2Reports.baselineSourceDocumentWorkbookMixed',
            'Source document + workbook repair',
          ),
          [documentFileName],
        );
      }
      if (hasStatementImport && hasWorkbookImport) {
        return appendDetailSuffix(
          t(
            'v2Reports.baselineSourceStatementWorkbookMixed',
            'Statement PDF + workbook repair',
          ),
          [
            getImportedFileNameByKind(
              provenance,
              'statement_import',
              t('v2Reports.statementImportFallbackFile', 'statement PDF'),
            ),
          ],
        );
      }
      if (hasDocumentImport) {
        return withDocumentEvidence(
          t(
            'v2Reports.baselineSourceDocumentImport',
            {
              defaultValue: 'Source document ({{fileName}})',
              fileName: documentFileName,
            },
          ),
        );
      }
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineSourceStatementImport',
          {
            defaultValue: 'Statement import ({{fileName}})',
            fileName: normalizeImportedFileName(
              provenance.fileName,
              t('v2Reports.statementImportFallbackFile', 'statement PDF'),
            ),
          },
        );
      }
      if (provenance?.kind === 'qdis_import') {
        return t(
          'v2Reports.baselineSourceQdisImport',
          {
            defaultValue: 'QDIS PDF ({{fileName}})',
            fileName: normalizeImportedFileName(provenance.fileName, 'QDIS PDF'),
          },
        );
      }
      if (
        provenance?.kind === 'kva_import' ||
        provenance?.kind === 'excel_import'
      ) {
        return t(
          'v2Reports.baselineSourceWorkbookImport',
          {
            defaultValue: 'Workbook import ({{fileName}})',
            fileName: normalizeImportedFileName(
              provenance.fileName,
              'Excel workbook',
            ),
          },
        );
      }
      if (source === 'manual') {
        return t('v2Reports.baselineSourceManual', 'Manual review');
      }
      if (source === 'veeti') {
        return t('v2Reports.baselineSourceVeeti', 'VEETI');
      }
      return t('v2Reports.baselineSourceMissing', 'Missing');
    },
    [t],
  );

  const baselineStatusLabel = React.useCallback(
    (
      status: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE',
      planningRole?: 'historical' | 'current_year_estimate',
    ) => {
      let label: string;
      switch (status) {
        case 'MANUAL':
          label = t('v2Reports.baselineStatusManual', 'Manual baseline');
          break;
        case 'MIXED':
          label = t('v2Reports.baselineStatusMixed', 'Mixed baseline');
          break;
        case 'INCOMPLETE':
          label = t('v2Reports.baselineStatusIncomplete', 'Incomplete baseline');
          break;
        case 'VEETI':
        default:
          label = t('v2Reports.baselineStatusVeeti', 'VEETI baseline');
          break;
      }
      return planningRole === 'current_year_estimate'
        ? `${label} · ${t('v2Overview.currentYearEstimateBadge', 'Estimate')}`
        : label;
    },
    [t],
  );

  const dataTypeLabel = React.useCallback(
    (dataType: string) => {
      switch (dataType) {
        case 'tilinpaatos':
          return t('v2Reports.baselineFinancials', 'Financials');
        case 'taksa':
          return t('v2Reports.baselinePrices', 'Prices');
        case 'volume_vesi':
          return t('v2Reports.baselineSoldWater', 'Sold water');
        case 'volume_jatevesi':
          return t('v2Reports.baselineSoldWastewater', 'Sold wastewater');
        case 'investointi':
          return t('v2Overview.datasetInvestments', 'Investments');
        case 'energia':
          return t('v2Overview.datasetEnergy', 'Process electricity');
        case 'verkko':
          return t('v2Overview.datasetNetwork', 'Network');
        default:
          return dataType;
      }
    },
    [t],
  );

  const datasetPublicationNote = React.useCallback(
    (dataset: {
      source: 'veeti' | 'manual' | 'none';
      editedAt: string | null;
      reason: string | null;
      provenance: V2OverrideProvenance | null | undefined;
    }) => {
      const documentEvidence = getDocumentImportEvidence(dataset.provenance);
      const documentFileName = normalizeImportedFileName(
        documentEvidence.fileName ?? dataset.provenance?.fileName,
        'PDF document',
      );
      const documentEvidenceDetail = [
        documentEvidence.pageLabel,
        ...documentEvidence.sourceLines,
      ];
      const hasStatementImport =
        dataset.provenance?.kind === 'statement_import' ||
        (dataset.provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'statement_import',
        ) ??
          false);
      const hasDocumentImport =
        dataset.provenance?.kind === 'document_import' ||
        (dataset.provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'document_import',
        ) ??
          false);
      const hasWorkbookImport =
        dataset.provenance?.kind === 'kva_import' ||
        dataset.provenance?.kind === 'excel_import' ||
        (dataset.provenance?.fieldSources?.some(
          (item) =>
            item.provenance.kind === 'kva_import' ||
            item.provenance.kind === 'excel_import',
        ) ??
          false);
      if (hasDocumentImport && hasWorkbookImport) {
        return appendDetailSuffix(
          t(
          'v2Reports.baselineDocumentWorkbookDetail',
          'Document-backed values and workbook repairs both affect this year.',
          ),
          [documentFileName, ...documentEvidenceDetail],
        );
      }
      if (hasStatementImport && hasWorkbookImport) {
        return appendDetailSuffix(
          t(
            'v2Reports.baselineStatementWorkbookDetail',
            'Statement-backed values and workbook repairs both affect this year.',
          ),
          [
            getImportedFileNameByKind(
              dataset.provenance,
              'statement_import',
              t('v2Reports.statementImportFallbackFile', 'statement PDF'),
            ),
          ],
        );
      }
      if (hasDocumentImport) {
        return appendDetailSuffix(
          t(
          'v2Reports.baselineDocumentImportDetail',
          {
            defaultValue: 'Values came from {{fileName}}',
            fileName: normalizeImportedFileName(
              documentEvidence.fileName ?? dataset.provenance?.fileName,
              'PDF document',
            ),
          },
          ),
          documentEvidenceDetail,
        );
      }
      if (dataset.provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineStatementImportDetail',
          {
            defaultValue: 'Financials came from {{fileName}}',
            fileName: normalizeImportedFileName(
              dataset.provenance.fileName,
              t('v2Reports.statementImportFallbackFile', 'statement PDF'),
            ),
          },
        );
      }
      if (dataset.provenance?.kind === 'qdis_import') {
        return t(
          'v2Reports.baselineQdisImportDetail',
          {
            defaultValue: 'Prices and volumes came from {{fileName}}',
            fileName: normalizeImportedFileName(
              dataset.provenance.fileName,
              'QDIS PDF',
            ),
          },
        );
      }
      if (
        dataset.provenance?.kind === 'kva_import' ||
        dataset.provenance?.kind === 'excel_import'
      ) {
        return t(
          'v2Reports.baselineWorkbookImportDetail',
          {
            defaultValue: 'Workbook-backed values came from {{fileName}}',
            fileName: normalizeImportedFileName(
              dataset.provenance.fileName,
              'Excel workbook',
            ),
          },
        );
      }
      if (dataset.source === 'manual' && dataset.reason) {
        return t('v2Reports.baselineManualReason', 'Reason: {{reason}}', {
          reason: dataset.reason,
        });
      }
      if (dataset.source === 'manual' && dataset.editedAt) {
        return t('v2Reports.baselineManualEditedAt', 'Reviewed {{date}}', {
          date: formatDateTime(dataset.editedAt),
        });
      }
      if (dataset.source === 'veeti') {
        return t(
          'v2Reports.baselineSourceVeetiHint',
          'Current report snapshot follows VEETI for this dataset.',
        );
      }
      return t(
        'v2Reports.baselineSourceMissingHint',
        'No trusted dataset was available in the saved baseline.',
      );
    },
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
  const requiredAnnualResultPriceLabel = React.useMemo(
    () =>
      t(
        'v2Forecast.requiredPriceAnnualResult',
        'Required price today (annual result = 0)',
      ),
    [t],
  );
  const requiredAnnualResultIncreaseLabel = React.useMemo(
    () =>
      t(
        'v2Forecast.requiredIncreaseAnnualResult',
        'Required increase vs comparator (annual result)',
      ),
    [t],
  );
  const formatScenarioBranch = React.useCallback(
    (value: V2ForecastScenario['scenarioType'] | undefined) => {
      if (value === 'base') {
        return t('v2Forecast.baseScenario', 'Base');
      }
      if (value === 'committed') {
        return t('v2Forecast.committedScenario', 'Committed');
      }
      if (value === 'hypothesis') {
        return t('v2Forecast.hypothesisScenario', 'Hypothesis');
      }
      if (value === 'stress') {
        return t('v2Forecast.stressScenario', 'Stress');
      }
      return '-';
    },
    [t],
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
  const selectedScenarioBranchLabel = React.useMemo(
    () => formatScenarioBranch(selectedReport?.snapshot.scenario.scenarioType),
    [formatScenarioBranch, selectedReport],
  );
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

  React.useEffect(() => {
    onFocusedReportChange?.(
      selectedReportId,
      selectedListReport?.ennuste.id ?? null,
    );
  }, [onFocusedReportChange, selectedListReport, selectedReportId]);

  const selectedVesinvestAppendix =
    selectedReport?.snapshot.vesinvestAppendix ?? null;
  const selectedInvestmentSummary = React.useMemo(() => {
    const yearlyTotals = selectedVesinvestAppendix?.yearlyTotals ?? [];
    if (yearlyTotals.length === 0) {
      return {
        coverageLabel: '-',
        peakYear: null as number | null,
        peakAmount: 0,
      };
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
    if (!selectedReport) {
      return null;
    }
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
        :
      Object.entries(selectedReport?.snapshot.scenario.assumptions ?? {})
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
    if (downloadingPdf) {
      return null;
    }
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

  const renderReportsListColumn = () => (
    <ReportsListColumn
      emptyStateComputedVersionLabel={emptyStateComputedVersionLabel}
      emptyStateCtaLabel={emptyStateCtaLabel}
      emptyStateForecastLabel={emptyStateForecastLabel}
      emptyStateForecastToneClass={emptyStateForecastToneClass}
      emptyStateReportReadinessHint={emptyStateReportReadinessHint}
      emptyStateReportReadinessLabel={emptyStateReportReadinessLabel}
      emptyStateReportReadinessToneClass={emptyStateReportReadinessToneClass}
      emptyStateScenario={emptyStateScenario}
      handleEmptyStateAction={handleEmptyStateAction}
      handleSavedFeePathAction={handleSavedFeePathAction}
      hasSelectedReportLayout={hasSelectedReportLayout}
      loadReports={loadReports}
      loadingList={loadingList}
      reportVariantLabel={reportVariantLabel}
      reports={reports}
      reportsHeaderHint={reportsHeaderHint}
      savedFeePathPlanId={savedFeePathPlanId}
      savedFeePathReportConflictActive={savedFeePathReportConflictActive}
      scenarioFilter={scenarioFilter}
      scenarioOptions={scenarioOptions}
      selectedReportId={selectedReportId}
      setScenarioFilter={setScenarioFilter}
      setSelectedReportId={setSelectedReportId}
      t={t}
    />
  );

  const renderReportsPreviewColumn = () => (
    <ReportsPreviewColumn
      activeVariant={activeVariant}
      assumptionLabelByKey={assumptionLabelByKey}
      baselineDatasetSourceLabel={baselineDatasetSourceLabel}
      baselineStatusLabel={baselineStatusLabel}
      canDownloadPdf={canDownloadPdf}
      dataTypeLabel={dataTypeLabel}
      datasetPublicationNote={datasetPublicationNote}
      downloadingPdf={downloadingPdf}
      emptyStateReportReadinessHint={emptyStateReportReadinessHint}
      formatAssumptionSnapshotValue={formatAssumptionSnapshotValue}
      handleDownloadPdf={handleDownloadPdf}
      hasSelectedReportLayout={hasSelectedReportLayout}
      loadingDetail={loadingDetail}
      onGoToForecast={onGoToForecast}
      previewVariant={previewVariant}
      reportNearTermExpenseLabel={reportNearTermExpenseLabel}
      reportVariantLabel={reportVariantLabel}
      reports={reports}
      selectedAcceptedBaselineYearsLabel={selectedAcceptedBaselineYearsLabel}
      selectedBaselineSourceSummaries={selectedBaselineSourceSummaries}
      selectedInvestmentSummary={selectedInvestmentSummary}
      selectedPreviewTitle={selectedPreviewTitle}
      selectedPrimaryBaselineSourceSummary={selectedPrimaryBaselineSourceSummary}
      selectedReport={selectedReport}
      selectedReportExportHint={selectedReportExportHint}
      selectedReportGeneratedAt={selectedReportGeneratedAt}
      selectedReportPrimaryFeeSignal={selectedReportPrimaryFeeSignal}
      selectedReportScenarioName={selectedReportScenarioName}
      selectedScenarioBranchLabel={selectedScenarioBranchLabel}
      selectedScenarioHorizonLabel={selectedScenarioHorizonLabel}
      selectedTariffAssumptionRows={selectedTariffAssumptionRows}
      selectedTariffDriverSummary={selectedTariffDriverSummary}
      selectedVesinvestAppendix={selectedVesinvestAppendix}
      setPreviewVariant={setPreviewVariant}
      showDetailedInvestmentPlan={showDetailedInvestmentPlan}
      t={t}
    />
  );
  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section
        className={`v2-grid v2-reports-layout${
          hasSelectedReportLayout ? ' has-selected-report' : ''
        }`}
      >
        {renderReportsListColumn()}
        {renderReportsPreviewColumn()}
      </section>
    </div>
  );
};
