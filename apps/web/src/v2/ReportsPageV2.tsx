import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  downloadReportPdfV2,
  getForecastScenarioV2,
  getReportV2,
  listForecastScenariosV2,
  listReportsV2,
  type V2ForecastScenario,
  type V2OverrideProvenance,
  type V2ReportDetail,
  type V2ReportListItem,
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
import { normalizeImportedFileName } from './provenanceDisplay';

type Props = {
  refreshToken: number;
  focusedReportId: string | null;
  onGoToForecast: (scenarioId?: string | null) => void;
  onFocusedReportChange?: (
    reportId: string | null,
    scenarioId: string | null,
  ) => void;
};

type ReportVariant = 'public_summary' | 'confidential_appendix';

type ForecastFreshnessState =
  | 'unsaved_changes'
  | 'saved_needs_recompute'
  | 'computing'
  | 'current';

type ReportReadinessReason =
  | 'missingScenario'
  | 'unsavedChanges'
  | 'missingComputeResults'
  | 'depreciationMappingIncomplete'
  | 'staleComputeResults';

type ForecastRuntimeState = {
  selectedScenarioId: string | null;
};

const FORECAST_RUNTIME_STORAGE_KEY = 'v2_forecast_runtime_state';

const REPORT_VARIANT_OPTIONS: Array<{
  id: ReportVariant;
  labelKey: string;
  label: string;
  descriptionKey: string;
  description: string;
  sections: {
    baselineSources: boolean;
    assumptions: boolean;
    yearlyInvestments: boolean;
    riskSummary: boolean;
  };
}> = [
  {
    id: 'public_summary',
    labelKey: 'v2Reports.variantPublic',
    label: 'Public summary',
    descriptionKey: 'v2Reports.variantPublicHint',
    description:
      'Shows fee, risk, and baseline context without the detailed assumption and investment appendix.',
    sections: {
      baselineSources: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    },
  },
  {
    id: 'confidential_appendix',
    labelKey: 'v2Reports.variantConfidential',
    label: 'Confidential appendix',
    descriptionKey: 'v2Reports.variantConfidentialHint',
    description:
      'Includes the detailed assumptions and yearly investment appendix alongside the summary.',
    sections: {
      baselineSources: true,
      assumptions: true,
      yearlyInvestments: true,
      riskSummary: true,
    },
  },
];

const ASSUMPTION_LABEL_KEYS: Record<string, string> = {
  inflaatio: 'assumptions.inflation',
  energiakerroin: 'assumptions.energyFactor',
  henkilostokerroin: 'assumptions.personnelFactor',
  vesimaaran_muutos: 'assumptions.volumeChange',
  hintakorotus: 'assumptions.priceIncrease',
  investointikerroin: 'assumptions.investmentFactor',
};

const formatScenarioUpdatedAt = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatInvestmentSnapshotMethod = (
  item: V2ForecastScenario['yearlyInvestments'][number],
  t: ReturnType<typeof useTranslation>['t'],
): string | null => {
  const snapshot = item.depreciationRuleSnapshot;
  if (!snapshot) return null;
  switch (snapshot.method) {
    case 'straight-line':
      return t('v2Forecast.methodStraightLine', 'Straight-line {{years}} years', {
        years: snapshot.linearYears ?? 0,
      });
    case 'linear':
      return t('v2Forecast.methodLinear', 'Linear');
    case 'residual':
      return t('v2Forecast.methodResidual', 'Residual {{percent}} %', {
        percent: snapshot.residualPercent ?? 0,
      });
    case 'none':
      return t('v2Forecast.methodNone', 'No depreciation');
    default:
      return null;
  }
};

const readForecastRuntimeState = (): ForecastRuntimeState => {
  if (typeof window === 'undefined') {
    return { selectedScenarioId: null };
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return { selectedScenarioId: null };
    }

    const parsed = JSON.parse(raw) as {
      selectedScenarioId?: unknown;
    };

    return {
      selectedScenarioId:
        typeof parsed.selectedScenarioId === 'string'
          ? parsed.selectedScenarioId
          : null,
    };
  } catch {
    return { selectedScenarioId: null };
  }
};

const deriveForecastFreshnessState = ({
  scenario,
  hasUnsavedChanges,
  isComputing,
}: {
  scenario: V2ForecastScenario | null;
  hasUnsavedChanges: boolean;
  isComputing: boolean;
}): ForecastFreshnessState => {
  if (isComputing) return 'computing';
  if (!scenario) return 'saved_needs_recompute';
  if (hasUnsavedChanges) return 'unsaved_changes';
  if (
    scenario.years.length === 0 ||
    !scenario.computedFromUpdatedAt ||
    scenario.computedFromUpdatedAt !== scenario.updatedAt
  ) {
    return 'saved_needs_recompute';
  }
  return 'current';
};

const deriveReportReadinessReason = ({
  scenario,
  forecastFreshnessState,
}: {
  scenario: V2ForecastScenario | null;
  forecastFreshnessState: ForecastFreshnessState;
}): ReportReadinessReason | null => {
  if (!scenario) return 'missingScenario';
  if (forecastFreshnessState === 'computing') return 'missingComputeResults';
  if (forecastFreshnessState === 'unsaved_changes') return 'unsavedChanges';
  if (forecastFreshnessState === 'saved_needs_recompute') {
    if (scenario.years.length === 0) return 'missingComputeResults';
    return 'staleComputeResults';
  }
  if (
    scenario.yearlyInvestments.some(
      (row) => row.amount > 0 && !row.depreciationRuleSnapshot,
    )
  ) {
    return 'depreciationMappingIncomplete';
  }
  return null;
};

export const ReportsPageV2: React.FC<Props> = ({
  refreshToken,
  focusedReportId,
  onGoToForecast,
  onFocusedReportChange,
}) => {
  const { t } = useTranslation();
  const [reports, setReports] = React.useState<V2ReportListItem[]>([]);
  const [selectedReportId, setSelectedReportId] = React.useState<string | null>(
    null,
  );
  const [selectedReport, setSelectedReport] =
    React.useState<V2ReportDetail | null>(null);
  const [scenarioFilter, setScenarioFilter] = React.useState<string>('');
  const [loadingList, setLoadingList] = React.useState(true);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewVariant, setPreviewVariant] =
    React.useState<ReportVariant>('confidential_appendix');
  const [emptyStateScenario, setEmptyStateScenario] =
    React.useState<V2ForecastScenario | null>(null);

  const loadReports = React.useCallback(
    async (preferredReportId?: string, forceRefresh = false) => {
      setLoadingList(true);
      setError(null);
      try {
        const rows = await listReportsV2(scenarioFilter || undefined, {
          force: forceRefresh,
        });
        setReports(rows);
        setSelectedReportId((current) => {
          if (
            preferredReportId &&
            rows.some((row) => row.id === preferredReportId)
          ) {
            return preferredReportId;
          }
          if (current && rows.some((row) => row.id === current)) return current;
          return rows[0]?.id ?? null;
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('v2Reports.errorLoadListFailed', 'Failed to load reports.'),
        );
      } finally {
        setLoadingList(false);
      }
    },
    [scenarioFilter, t],
  );

  React.useEffect(() => {
    loadReports(focusedReportId ?? undefined);
  }, [loadReports, refreshToken, focusedReportId]);

  React.useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoadingDetail(true);
      setError(null);
      try {
        const detail = await getReportV2(selectedReportId);
        if (!cancelled) setSelectedReport(detail);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : t('v2Reports.errorLoadDetailFailed', 'Failed to load report.'),
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedReportId, t]);

  React.useEffect(() => {
    if (loadingList || reports.length > 0) {
      setEmptyStateScenario(null);
      return;
    }

    let cancelled = false;
    const runtimeState = readForecastRuntimeState();

    const run = async () => {
      try {
        const scenarioRows = await listForecastScenariosV2();
        if (cancelled) return;
        if (scenarioRows.length === 0) {
          setEmptyStateScenario(null);
          return;
        }

        const preferredScenarioId =
          runtimeState.selectedScenarioId &&
          scenarioRows.some((row) => row.id === runtimeState.selectedScenarioId)
            ? runtimeState.selectedScenarioId
            : scenarioRows[0]?.id ?? null;

        if (!preferredScenarioId) {
          setEmptyStateScenario(null);
          return;
        }

        const scenario = await getForecastScenarioV2(preferredScenarioId);
        if (cancelled) return;

        setEmptyStateScenario(scenario);
      } catch {
        if (cancelled) return;
        setEmptyStateScenario(null);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadingList, reports]);

  React.useEffect(() => {
    if (!selectedReport) return;
    setPreviewVariant(selectedReport.variant);
  }, [selectedReport]);

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

  const emptyStateForecastFreshnessState = React.useMemo(
    () =>
      deriveForecastFreshnessState({
        scenario: emptyStateScenario,
        hasUnsavedChanges: false,
        isComputing: false,
      }),
    [emptyStateScenario],
  );

  const emptyStateReportReadinessReason = React.useMemo(
    () =>
      deriveReportReadinessReason({
        scenario: emptyStateScenario,
        forecastFreshnessState: emptyStateForecastFreshnessState,
      }),
    [
      emptyStateScenario,
      emptyStateForecastFreshnessState,
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
      case 'depreciationMappingIncomplete':
        return t(
          'v2Forecast.depreciationMappingBlockedHint',
          'Complete and save a depreciation mapping for every investment year before creating report.',
        );
      case 'missingScenario':
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
      case 'unsavedChanges':
        return t(
          'v2Reports.openForecastToSaveAndCompute',
          'Open Forecast to save and compute',
        );
      case 'missingComputeResults':
      case 'depreciationMappingIncomplete':
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

  const emptyStateComputedVersionLabel = React.useMemo(
    () =>
      emptyStateScenario?.computedFromUpdatedAt
        ? formatScenarioUpdatedAt(emptyStateScenario.computedFromUpdatedAt)
        : t('v2Forecast.reportStateMissing'),
    [emptyStateScenario?.computedFromUpdatedAt, t],
  );

  const reportsHeaderHint = React.useMemo(() => {
    if (reports.length === 0) {
      return t(
        'v2Reports.emptyHint',
        'Open Forecast, compute a scenario, and create your first report.',
      );
    }
    return t(
      'v2Reports.listHint',
      'Review saved reports, variants, and PDF export state.',
    );
  }, [reports.length, t]);

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
      const hasStatementImport =
        provenance?.kind === 'statement_import' ||
        (provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'statement_import',
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
      if (hasStatementImport && hasWorkbookImport) {
        return t(
          'v2Reports.baselineSourceStatementWorkbookMixed',
          'Statement PDF + workbook repair',
        );
      }
      if (provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineSourceStatementImport',
          {
            defaultValue: 'Statement import ({{fileName}})',
            fileName: normalizeImportedFileName(
              provenance.fileName,
              t('v2Reports.statementImportFallbackFile', 'bokslut PDF'),
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
      const hasStatementImport =
        dataset.provenance?.kind === 'statement_import' ||
        (dataset.provenance?.fieldSources?.some(
          (item) => item.provenance.kind === 'statement_import',
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
      if (hasStatementImport && hasWorkbookImport) {
        return t(
          'v2Reports.baselineStatementWorkbookDetail',
          'Statement-backed values and workbook repairs both affect this year.',
        );
      }
      if (dataset.provenance?.kind === 'statement_import') {
        return t(
          'v2Reports.baselineStatementImportDetail',
          {
            defaultValue: 'Financials came from {{fileName}}',
            fileName: normalizeImportedFileName(
              dataset.provenance.fileName,
              t('v2Reports.statementImportFallbackFile', 'bokslut PDF'),
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

  const handleDownloadPdf = React.useCallback(async () => {
    if (!selectedReport) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const { blob, filename } = await downloadReportPdfV2(selectedReport.id);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;

      setError(
        status && status >= 500
          ? t(
              'v2Reports.errorDownloadPdfUnavailable',
              'PDF export is temporarily unavailable. Please try again later.',
            )
          : err instanceof Error && err.message
          ? err.message
          : t('v2Reports.errorDownloadPdfFailed', 'Failed to download PDF.'),
      );
    } finally {
      setDownloadingPdf(false);
    }
  }, [selectedReport, t]);

  const activeVariant = React.useMemo(
    () =>
      REPORT_VARIANT_OPTIONS.find((option) => option.id === previewVariant) ??
      REPORT_VARIANT_OPTIONS[1],
    [previewVariant],
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
  const selectedScenarioDisplayName = React.useMemo(
    () =>
      selectedReport
        ? getScenarioDisplayName(
            selectedReport.ennuste.nimi ?? selectedReport.ennuste.id,
            t,
          )
        : null,
    [selectedReport, t],
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

  React.useEffect(() => {
    onFocusedReportChange?.(
      selectedReportId,
      selectedListReport?.ennuste.id ?? null,
    );
  }, [onFocusedReportChange, selectedListReport, selectedReportId]);

  const selectedInvestmentSummary = React.useMemo(() => {
    if (!selectedReport) return null;
    const items = selectedReport.snapshot.scenario.yearlyInvestments;
    if (items.length === 0) {
      return {
        count: 0,
        firstYear: null as number | null,
        peakYear: null as number | null,
        peakAmount: 0,
      };
    }
    const peak = items.reduce((current, item) =>
      item.amount > current.amount ? item : current,
    );
    return {
      count: items.length,
      firstYear: items[0]?.year ?? null,
      peakYear: peak.year,
      peakAmount: peak.amount,
    };
  }, [selectedReport]);
  const selectedVesinvestAppendix =
    selectedReport?.snapshot.vesinvestAppendix ?? null;

  const downloadMatchesPreview =
    selectedReport != null ? selectedReport.variant === previewVariant : true;

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section className="v2-grid v2-reports-layout">
        <div className="v2-reports-list-column">
          <section className="v2-card v2-reports-list-card">
            <div className="v2-section-header v2-reports-list-head">
              <div className="v2-reports-section-copy">
                <p className="v2-overview-eyebrow">
                  {t('v2Reports.title', 'Reports')}
                </p>
                <h2>{t('v2Reports.title', 'Reports')}</h2>
                <p className="v2-muted">
                  {reportsHeaderHint}
                </p>
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
                    <option value="">
                      {t('v2Reports.allScenarios', 'All')}
                    </option>
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
                    ? scenarioOptions.find((option) => option.id === scenarioFilter)
                        ?.name ?? scenarioFilter
                    : t('v2Reports.allScenarios', 'All')}
                </strong>
              </article>
              <article>
                <span>{t('v2Reports.selectedReportTitle', 'Selected report')}</span>
                <strong>
                  {selectedListReport
                    ? selectedListReportTitle
                    : t('v2Reports.selectFromList')}
                </strong>
              </article>
            </div>

            {loadingList ? (
              <div className="v2-loading-state v2-report-loading-card">
                <p className="v2-muted">
                  {t(
                    'v2Reports.loadingListHint',
                    'Refreshing saved reports and filters.',
                  )}
                </p>
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
              </div>
            ) : null}
            {!loadingList && reports.length === 0 ? (
              <div className="v2-empty-state">
                <p>{t('v2Reports.empty', 'No reports found.')}</p>
                <p className="v2-muted">
                  {emptyStateReportReadinessHint}
                </p>
                {emptyStateScenario ? (
                  <div className="v2-report-readiness-panel">
                    <div className="v2-section-header">
                      <h3>
                        {t('v2Forecast.reportReadinessTitle', 'Report status')}
                      </h3>
                      <div className="v2-badge-row">
                        <span
                          className={`v2-badge ${emptyStateReportReadinessToneClass}`}
                        >
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
                        <span>
                          {t('v2Forecast.reportComputeSource', 'Computed from version')}
                        </span>
                        <strong>{emptyStateComputedVersionLabel}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>
                          {t('v2Forecast.reportScenarioUpdated', 'Scenario updated')}
                        </span>
                        <strong>
                          {formatScenarioUpdatedAt(emptyStateScenario.updatedAt)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="v2-keyvalue-row">
                  <span>{t('v2Overview.wizardContextNext', 'Next')}</span>
                  <strong>{emptyStateCtaLabel}</strong>
                </div>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  onClick={() => onGoToForecast(emptyStateScenario?.id)}
                >
                  {emptyStateCtaLabel}
                </button>
              </div>
            ) : null}

            {reports.length > 0 ? (
              <div className="v2-report-table v2-report-list">
                {selectedListReport ? (
                  <article className="v2-report-list-focus">
                    <div className="v2-report-list-focus-head">
                      <div>
                        <p className="v2-overview-eyebrow">
                          {t('v2Reports.selectedReportTitle', 'Selected report')}
                        </p>
                        <h3>{selectedListReportTitle}</h3>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-status-provenance">
                          {reportVariantLabel(selectedListReport.variant)}
                        </span>
                      </div>
                    </div>
                    <div className="v2-report-list-focus-grid">
                      <div>
                        <span>{t('v2Reports.colCreated', 'Created')}</span>
                        <strong>{formatDateTime(selectedListReport.createdAt)}</strong>
                      </div>
                      <div>
                        <span>
                          {t(
                            'projection.v2.baselineYearLabel',
                            'Baseline year',
                          )}
                        </span>
                        <strong>{selectedListReport.baselineYear}</strong>
                      </div>
                      <div>
                        <span>{requiredAnnualResultPriceLabel}</span>
                        <strong>
                          {formatPrice(selectedListReport.requiredPriceToday)}
                        </strong>
                      </div>
                      <div>
                        <span>{requiredAnnualResultIncreaseLabel}</span>
                        <strong>
                          {formatPercent(
                            selectedListReport.requiredAnnualIncreasePct,
                          )}
                        </strong>
                      </div>
                    </div>
                  </article>
                ) : null}

                {reports.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={`v2-report-row ${
                      selectedReportId === row.id ? 'active' : ''
                    }`}
                    onClick={() => setSelectedReportId(row.id)}
                    aria-pressed={selectedReportId === row.id}
                  >
                    <div className="v2-report-row-top">
                      <div className="v2-report-row-main">
                        <strong>
                          {getScenarioDisplayName(
                            row.ennuste.nimi ?? row.ennuste.id,
                            t,
                          )}
                        </strong>
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
                    <div className="v2-report-row-kpis">
                      <div>
                        <span>
                          {t(
                            'projection.v2.baselineYearLabel',
                            'Baseline year',
                          )}
                        </span>
                        <strong>{row.baselineYear}</strong>
                      </div>
                      <div>
                        <span>{requiredAnnualResultPriceLabel}</span>
                        <strong>{formatPrice(row.requiredPriceToday)}</strong>
                      </div>
                      <div>
                        <span>{requiredAnnualResultIncreaseLabel}</span>
                        <strong>
                          {formatPercent(row.requiredAnnualIncreasePct)}
                        </strong>
                      </div>
                      <div>
                        <span>{t('v2Forecast.totalInvestments', 'Investments')}</span>
                        <strong>{formatEur(row.totalInvestments)}</strong>
                      </div>
                      {row.baselineSourceSummary ? (
                        <div>
                          <span>
                            {t(
                              'v2Reports.listBaselineStatus',
                              'Baseline source',
                            )}
                          </span>
                          <strong>
                            {baselineStatusLabel(
                              row.baselineSourceSummary.sourceStatus,
                              row.baselineSourceSummary.planningRole,
                            )}
                          </strong>
                        </div>
                      ) : null}
                      {row.baselineSourceSummary ? (
                        <div>
                          <span>
                            {t(
                              'v2Reports.listFinancialSource',
                              'Financials source',
                            )}
                          </span>
                          <strong>
                            {baselineDatasetSourceLabel(
                              row.baselineSourceSummary.financials.source,
                              row.baselineSourceSummary.financials.provenance,
                            )}
                          </strong>
                        </div>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="v2-reports-preview-column">
          <section className="v2-card v2-reports-preview-card">
            <div className="v2-section-header v2-reports-preview-head">
              <div className="v2-reports-section-copy">
                <p className="v2-overview-eyebrow">
                  {t('v2Reports.selectedReportTitle', 'Selected report')}
                </p>
                <h2>{t('v2Reports.selectedReportTitle', 'Selected report')}</h2>
                <p className="v2-muted">
                  {selectedReport
                    ? formatDateTime(selectedReport.createdAt)
                    : t(
                        'v2Reports.selectFromList',
                      )}
                </p>
              </div>
              {selectedReport ? (
                <div className="v2-badge-row">
                  <span className="v2-badge v2-status-info">
                    {selectedScenarioDisplayName}
                  </span>
                  <span className="v2-badge v2-status-provenance">
                    {reportVariantLabel(selectedReport.variant)}
                  </span>
                </div>
              ) : null}
            </div>

            {loadingDetail ? (
              <div className="v2-loading-state v2-report-loading-card">
                <p className="v2-muted">
                  {t(
                    'v2Reports.loadingDetailHint',
                    'Loading the saved report snapshot and export state.',
                  )}
                </p>
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
              </div>
            ) : null}
            {!loadingDetail && !selectedReport ? (
              <div className="v2-empty-state">
                <p>
                  {t(
                    'v2Reports.selectFromList',
                  )}
                </p>
                <p className="v2-muted">
                  {t(
                    'v2Reports.emptyHint',
                  )}
                </p>
              </div>
            ) : null}

            {selectedReport ? (
              <>
                <section className="v2-reports-preview-hero">
                  <div className="v2-reports-preview-hero-copy">
                    <p className="v2-overview-eyebrow">
                      {t('projection.scenario', 'Scenario')}
                    </p>
                    <h3>{selectedScenarioDisplayName}</h3>
                    <p className="v2-muted">
                      {formatDateTime(selectedReport.createdAt)}
                    </p>
                  </div>
                  <div className="v2-reports-preview-primary-kpis">
                    <article>
                      <span>
                        {t(
                          'projection.v2.baselineYearLabel',
                          'Baseline year',
                        )}
                      </span>
                      <strong>{selectedReport.baselineYear}</strong>
                    </article>
                    <article>
                      <span>
                        {selectedReportPrimaryFeeSignal.priceLabel}
                      </span>
                      <strong>
                        {formatPrice(selectedReportPrimaryFeeSignal.price)}
                      </strong>
                    </article>
                    <article>
                      <span>
                        {selectedReportPrimaryFeeSignal.increaseLabel}
                      </span>
                      <strong>
                        {formatPercent(selectedReportPrimaryFeeSignal.increase)}
                      </strong>
                    </article>
                    <article>
                      <span>
                        {t('v2Forecast.totalInvestments', 'Total investments')}
                      </span>
                      <strong>{formatEur(selectedReport.totalInvestments)}</strong>
                    </article>
                  </div>
                </section>

                <article className="v2-kpi-strip v2-reports-secondary-kpis">
                  <div>
                    <h3>
                      {t(
                        'v2Forecast.requiredPriceCumulativeCash',
                        'Required price today (cumulative cash >= 0)',
                      )}
                    </h3>
                    <p>
                      {formatPrice(
                        selectedReport.snapshot.scenario
                          .requiredPriceTodayCombinedCumulativeCash ??
                          selectedReport.requiredPriceToday,
                      )}
                    </p>
                  </div>
                  <div>
                    <h3>
                      {t(
                        'v2Forecast.requiredIncreaseCumulativeCash',
                        'Required increase vs comparator (cumulative cash)',
                      )}
                    </h3>
                    <p>
                      {formatPercent(
                        selectedReport.snapshot.scenario
                          .requiredAnnualIncreasePctCumulativeCash ??
                          selectedReport.requiredAnnualIncreasePct,
                      )}
                    </p>
                  </div>
                  <div>
                    <h3>
                      {t(
                        'v2Forecast.latestComparatorPrice',
                        'Latest full-year comparator price',
                      )}
                    </h3>
                    <p>
                      {formatPrice(
                        selectedReport.snapshot.scenario
                          .baselinePriceTodayCombined ??
                          selectedReport.requiredPriceToday,
                      )}
                    </p>
                    <small>
                      {t('projection.v2.baselineYearLabel', 'Baseline year')}:{' '}
                      {selectedReport.snapshot.scenario.baselineYear ??
                        selectedReport.baselineYear}
                    </small>
                  </div>
                </article>

                <div className="v2-actions-row v2-reports-toolbar">
                  <p className="v2-muted">
                    {downloadMatchesPreview
                      ? t(
                          'v2Reports.variantTitle',
                        )
                      : t(
                          'v2Reports.downloadUsesSavedVariant',
                          'PDF download still uses the saved report variant. Switch back to that variant to export.',
                        )}
                  </p>
                  <div className="v2-report-export-panel">
                    <button
                      className="v2-btn v2-btn-primary"
                      type="button"
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf || !downloadMatchesPreview}
                      title={
                        !downloadMatchesPreview
                          ? t(
                              'v2Reports.downloadUsesSavedVariant',
                              'PDF download still uses the saved report variant. Switch back to that variant to export.',
                            )
                          : undefined
                      }
                    >
                      {downloadingPdf
                        ? t('v2Reports.downloadingPdf', 'Downloading PDF...')
                        : t('v2Reports.downloadPdf')}
                    </button>
                    <span className="v2-muted">
                      {selectedReport.pdfUrl
                        ? t(
                            'v2Reports.exportReady',
                            'Saved report is available for export.',
                          )
                        : t(
                            'v2Reports.errorDownloadPdfUnavailable',
                            'PDF export is temporarily unavailable. Please try again later.',
                          )}
                    </span>
                  </div>
                </div>

                <div className="v2-grid v2-grid-two v2-reports-preview-grid">
                  <article className="v2-subcard v2-reports-panel-card v2-reports-meta-card">
                    <h3>{t('v2Reports.colCreated', 'Created')}</h3>
                      <div className="v2-keyvalue-list">
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Reports.colCreated', 'Created')}</span>
                          <strong>{formatDateTime(selectedReport.createdAt)}</strong>
                        </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Reports.generatedAtLabel', 'Generated')}</span>
                        <strong>
                          {formatDateTime(
                            selectedReport.snapshot.generatedAt ??
                              selectedReport.createdAt,
                          )}
                        </strong>
                      </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Reports.variantTitle')}</span>
                          <strong>
                            {reportVariantLabel(selectedReport.variant)}
                          </strong>
                        </div>
                        {selectedReport.snapshot.vesinvestPlan ? (
                          <div className="v2-keyvalue-row">
                            <span>{t('v2Vesinvest.planSelector', 'Plan revision')}</span>
                            <strong>{`${selectedReport.snapshot.vesinvestPlan.name} / v${selectedReport.snapshot.vesinvestPlan.versionNumber}`}</strong>
                          </div>
                        ) : null}
                        {selectedReport.snapshot.baselineSourceSummary ? (
                          <div className="v2-keyvalue-row">
                            <span>
                              {t(
                                'v2Reports.previewBaselineStatus',
                                'Baseline source',
                              )}
                            </span>
                            <strong>
                              {baselineStatusLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .sourceStatus,
                                selectedReport.snapshot.baselineSourceSummary
                                  .planningRole,
                              )}
                            </strong>
                          </div>
                        ) : null}
                        {selectedReport.snapshot.baselineSourceSummary ? (
                          <div className="v2-keyvalue-row">
                            <span>
                              {t(
                                'v2Reports.previewFinancialSource',
                                'Financials source',
                              )}
                            </span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.provenance,
                              )}
                            </strong>
                          </div>
                        ) : null}
                      </div>
                    </article>

                  <section className="v2-subcard v2-report-variant-card">
                    <div className="v2-section-header">
                      <div className="v2-reports-section-copy">
                        <h3>{t('v2Reports.variantTitle')}</h3>
                        <p className="v2-muted">
                          {t(
                            activeVariant.descriptionKey,
                            activeVariant.description,
                          )}
                        </p>
                      </div>
                      <div className="v2-badge-row">
                        <span className="v2-badge v2-status-info">
                          {reportVariantLabel(activeVariant.id)}
                        </span>
                        {!downloadMatchesPreview ? (
                          <span className="v2-badge v2-status-warning">
                            {reportVariantLabel(selectedReport.variant)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="v2-report-variant-grid">
                      {REPORT_VARIANT_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`v2-report-variant-option ${
                            previewVariant === option.id ? 'active' : ''
                          }`}
                          onClick={() => setPreviewVariant(option.id)}
                          aria-pressed={previewVariant === option.id}
                          aria-label={t(option.labelKey, option.label)}
                        >
                          <div className="v2-report-variant-option-head">
                            <div>
                              <strong>{t(option.labelKey, option.label)}</strong>
                              <p className="v2-muted">
                                {t(option.descriptionKey, option.description)}
                              </p>
                            </div>
                            <div className="v2-badge-row">
                              {previewVariant === option.id ? (
                                <span className="v2-badge v2-status-info">
                                  {t('v2Reports.previewTitle')}
                                </span>
                              ) : null}
                              {selectedReport.variant === option.id ? (
                                <span className="v2-badge v2-status-provenance">
                                  {t('v2Reports.downloadPdf')}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="v2-report-variant-sections">
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionBaselineSources',
                                  'Baseline sources',
                                )}
                              </span>
                              <strong>
                                {option.sections.baselineSources
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionAssumptions',
                                  'Assumptions appendix',
                                )}
                              </span>
                              <strong>
                                {option.sections.assumptions
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionInvestments',
                                  'Yearly investments',
                                )}
                              </span>
                              <strong>
                                {option.sections.yearlyInvestments
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                            <div className="v2-keyvalue-row">
                              <span>
                                {t(
                                  'v2Reports.sectionRiskSummary',
                                  'Risk summary',
                                )}
                              </span>
                              <strong>
                                {option.sections.riskSummary
                                  ? t('common.yes', 'Yes')
                                  : t('common.no', 'No')}
                              </strong>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>

                  {activeVariant.sections.baselineSources &&
                  selectedReport.snapshot.baselineSourceSummary ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.baselineSourcesTitle',
                        )}
                      </h3>
                      <div className="v2-reports-provenance-summary">
                        <div>
                          <span>
                            {t(
                              'projection.v2.baselineYearLabel',
                              'Baseline year',
                            )}
                          </span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.year}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.colVariant', 'Variant')}</span>
                          <strong>
                            {baselineStatusLabel(
                              selectedReport.snapshot.baselineSourceSummary
                                .sourceStatus,
                              selectedReport.snapshot.baselineSourceSummary
                                .planningRole,
                            )}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.baselineSourceVeeti', 'VEETI')}</span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.sourceBreakdown.veetiDataTypes
                              .map(dataTypeLabel)
                              .join(', ') || t('common.no', 'No')}
                          </strong>
                        </div>
                        <div>
                          <span>
                            {t('v2Reports.baselineSourceManual', 'Manual review')}
                          </span>
                          <strong>
                            {selectedReport.snapshot.baselineSourceSummary.sourceBreakdown.manualDataTypes
                              .map(dataTypeLabel)
                              .join(', ') || t('common.no', 'No')}
                          </strong>
                        </div>
                      </div>
                      <div className="v2-reports-provenance-grid">
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>
                              {t('v2Reports.baselineFinancials', 'Financials')}
                            </span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .financials.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary
                                .financials,
                            )}
                          </p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .prices.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .prices.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary.prices,
                            )}
                          </p>
                        </article>
                        <article className="v2-keyvalue-row v2-reports-provenance-row">
                          <div>
                            <span>
                              {t('v2Reports.baselineVolumes', 'Sold volumes')}
                            </span>
                            <strong>
                              {baselineDatasetSourceLabel(
                                selectedReport.snapshot.baselineSourceSummary
                                  .volumes.source,
                                selectedReport.snapshot.baselineSourceSummary
                                  .volumes.provenance,
                              )}
                            </strong>
                          </div>
                          <p className="v2-muted">
                            {datasetPublicationNote(
                              selectedReport.snapshot.baselineSourceSummary
                                .volumes,
                            )}
                          </p>
                        </article>
                      </div>
                    </article>
                  ) : null}

                  {activeVariant.sections.assumptions ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.assumptionsSnapshot',
                        )}
                      </h3>
                      <div className="v2-reports-assumption-grid">
                        {Object.entries(
                          selectedReport.snapshot.scenario.assumptions,
                        ).map(([key, value]) => (
                          <div key={key} className="v2-reports-assumption-item">
                            <span>{assumptionLabelByKey(key)}</span>
                            <strong>{formatNumber(value, 4)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  ) : null}

                  {activeVariant.sections.yearlyInvestments ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.yearlyInvestmentsSnapshot',
                        )}
                      </h3>
                      <div className="v2-reports-investment-summary">
                        <div>
                          <span>
                            {t('v2Reports.investmentYearsCovered', 'Years covered')}
                          </span>
                          <strong>{selectedInvestmentSummary?.count ?? 0}</strong>
                        </div>
                        <div>
                          <span>
                            {t(
                              'projection.v2.baselineYearLabel',
                              'Baseline year',
                            )}
                          </span>
                          <strong>
                            {selectedInvestmentSummary?.firstYear ?? '-'}
                          </strong>
                        </div>
                        <div>
                          <span>{t('v2Forecast.totalInvestments', 'Total investments')}</span>
                          <strong>{formatEur(selectedReport.totalInvestments)}</strong>
                        </div>
                        <div>
                          <span>{t('v2Reports.investmentPeakYear', 'Peak year')}</span>
                          <strong>
                            {selectedInvestmentSummary?.peakYear != null
                              ? `${selectedInvestmentSummary.peakYear} · ${formatEur(
                                  selectedInvestmentSummary.peakAmount,
                                )}`
                              : '-'}
                          </strong>
                        </div>
                      </div>
                      {selectedVesinvestAppendix?.fiveYearBands?.length ? (
                        <>
                          <h4>{t('v2Vesinvest.fiveYearBands', 'Five-year bands')}</h4>
                          <div className="v2-keyvalue-list v2-reports-investment-list">
                            {selectedVesinvestAppendix.fiveYearBands.map((band) => (
                              <div
                                key={`${band.startYear}-${band.endYear}`}
                                className="v2-keyvalue-row"
                              >
                                <span>{`${band.startYear}-${band.endYear}`}</span>
                                <strong>{formatEur(band.totalAmount)}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                      {selectedVesinvestAppendix?.groupedProjects?.length ? (
                        <>
                          <h4>{t('v2Vesinvest.investmentPlan', 'Investment plan')}</h4>
                          <div className="v2-vesinvest-table-wrap">
                            <table className="v2-vesinvest-table">
                              <thead>
                                <tr>
                                  <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                                  <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                                  <th>{t('v2Vesinvest.projectGroup', 'Group')}</th>
                                  <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVesinvestAppendix.groupedProjects.map((group) => (
                                  <React.Fragment key={group.groupKey}>
                                    <tr className="v2-vesinvest-matrix-group-row">
                                      <td />
                                      <td>{group.groupLabel}</td>
                                      <td />
                                      <td>{formatEur(group.totalAmount)}</td>
                                    </tr>
                                    {group.projects.map((project) => (
                                      <tr key={`${group.groupKey}-${project.code}`}>
                                        <td>{project.code}</td>
                                        <td>{project.name}</td>
                                        <td>{group.groupLabel}</td>
                                        <td>{formatEur(project.totalAmount)}</td>
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                      <div className="v2-keyvalue-list v2-reports-investment-list">
                        {selectedReport.snapshot.scenario.yearlyInvestments.map(
                          (item) => {
                            const snapshotLabel =
                              item.depreciationRuleSnapshot?.assetClassName ??
                              item.depreciationRuleSnapshot?.assetClassKey ??
                              item.depreciationClassKey ??
                              null;
                            const snapshotMethod = formatInvestmentSnapshotMethod(item, t);
                            return (
                            <div key={item.year} className="v2-keyvalue-row">
                              <div>
                                <span>{item.year}</span>
                                {snapshotLabel ? (
                                  <div className="v2-muted">{snapshotLabel}</div>
                                ) : null}
                                {snapshotMethod ? (
                                  <div className="v2-muted">{snapshotMethod}</div>
                                ) : null}
                              </div>
                              <strong>{formatEur(item.amount)}</strong>
                            </div>
                            );
                          },
                        )}
                      </div>
                    </article>
                  ) : null}
                </div>
              </>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
};
