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
import {
  getDocumentImportEvidence,
  getImportedFileNameByKind,
  normalizeImportedFileName,
} from './provenanceDisplay';
import {
  resolveVesinvestGroupLabel,
} from './vesinvestLabels';

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
  | 'missingDepreciationSnapshots'
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
    investmentPlan: boolean;
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
      'Shows tariff path, grouped investment plan, and baseline context without the detailed assumptions or yearly investment rows.',
    sections: {
      baselineSources: true,
      investmentPlan: true,
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
      'Adds assumptions and detailed yearly investment rows on top of the grouped investment plan and summary.',
    sections: {
      baselineSources: true,
      investmentPlan: true,
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
  perusmaksuMuutos: 'assumptions.baseFeeChange',
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

const appendDetailSuffix = (
  base: string,
  suffixes: Array<string | null | undefined>,
): string => {
  const details = suffixes.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return details.length > 0 ? `${base} | ${details.join(' | ')}` : base;
};

const stripTrailingParenthetical = (value: string): string =>
  value.replace(/\s*\([^)]*\)\s*$/u, '');

const normalizeAcceptedBaselineYears = (
  values: Array<number | null | undefined>,
): number[] =>
  [...new Set(
    values.filter((value): value is number => Number.isFinite(value)).map((value) =>
      Math.trunc(value),
    ),
  )].sort((left, right) => left - right);

const resolveAcceptedBaselineYears = (
  snapshot: V2ReportDetail['snapshot'] | null | undefined,
): number[] => {
  const explicitYears = normalizeAcceptedBaselineYears(
    snapshot?.acceptedBaselineYears ?? [],
  );
  if (explicitYears.length > 0) {
    return explicitYears;
  }
  return normalizeAcceptedBaselineYears([
    ...(snapshot?.baselineSourceSummaries ?? []).map((summary) => summary?.year),
    snapshot?.baselineSourceSummary?.year,
  ]);
};

const formatDepreciationMethod = (
  item: {
    method: string;
    linearYears: number | null;
    residualPercent: number | null;
  },
  t: ReturnType<typeof useTranslation>['t'],
): string | null => {
  switch (item.method) {
    case 'straight-line':
      return t('v2Forecast.methodStraightLine', 'Straight-line {{years}} years', {
        years: item.linearYears ?? 0,
      });
    case 'linear':
      return t('v2Forecast.methodLinear', 'Linear');
    case 'residual':
      return t('v2Forecast.methodResidual', 'Residual {{percent}} %', {
        percent: item.residualPercent ?? 0,
      });
    case 'none':
      return t('v2Forecast.methodNone', 'No depreciation');
    default:
      return null;
  }
};

const formatInvestmentSnapshotMethod = (
  item: V2ForecastScenario['yearlyInvestments'][number],
  t: ReturnType<typeof useTranslation>['t'],
): string | null => {
  const snapshot = item.depreciationRuleSnapshot;
  if (!snapshot) return null;
  return formatDepreciationMethod(snapshot, t);
};

const formatServiceSplitLabel = (
  value: 'water' | 'wastewater' | 'mixed',
  t: ReturnType<typeof useTranslation>['t'],
) => {
  switch (value) {
    case 'water':
      return t('v2Forecast.investmentServiceSplitWater', 'Water');
    case 'wastewater':
      return t('v2Forecast.investmentServiceSplitWastewater', 'Wastewater');
    default:
      return t('v2Forecast.investmentServiceSplitMixed', 'Mixed');
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
    return 'missingDepreciationSnapshots';
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
      case 'missingDepreciationSnapshots':
        return t(
          'v2Forecast.depreciationSnapshotsMissingHint',
          'Refresh the synced Vesinvest class plan and recompute results before creating report.',
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

  const emptyStateComputedVersionLabel = React.useMemo(
    () =>
      emptyStateScenario?.computedFromUpdatedAt
        ? formatScenarioUpdatedAt(emptyStateScenario.computedFromUpdatedAt)
        : t('v2Forecast.reportStateMissing'),
    [emptyStateScenario?.computedFromUpdatedAt, t],
  );

  const reportsHeaderHint = React.useMemo(() => {
    if (reports.length === 0) {
      return emptyStateReportReadinessHint;
    }
    return t(
      'v2Reports.listHint',
      'Review saved reports, variants, and PDF export state.',
    );
  }, [emptyStateReportReadinessHint, reports.length, t]);

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
                    <div className="v2-report-row-meta">
                      <span>
                        {t(
                          'projection.v2.baselineYearLabel',
                          'Baseline year',
                        )}
                        : {row.baselineYear}
                      </span>
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
                <h2>{t('v2Reports.selectedReportTitle', 'Selected report')}</h2>
                {selectedReport ? (
                  <p className="v2-muted">{selectedPreviewTitle}</p>
                ) : (
                  <p className="v2-muted">
                    {t(
                      'v2Reports.selectFromList',
                    )}
                  </p>
                )}
              </div>
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
                  {reports.length === 0
                    ? emptyStateReportReadinessHint
                    : t(
                        'v2Reports.emptyHint',
                      )}
                </p>
              </div>
            ) : null}

            {selectedReport ? (
              <>
                <article className="v2-reports-document-header">
                  <div className="v2-reports-document-header-top">
                    <div className="v2-reports-document-copy">
                      <h3>{selectedPreviewTitle}</h3>
                      <p className="v2-muted">{selectedReportScenarioName}</p>
                    </div>
                    <div className="v2-badge-row">
                      <span className="v2-badge v2-status-info">
                        {reportVariantLabel(selectedReport.variant)}
                      </span>
                      <span className="v2-badge v2-status-neutral">
                        {selectedReportGeneratedAt}
                      </span>
                    </div>
                  </div>

                  <div className="v2-reports-document-meta">
                    <article>
                      <span>{t('v2Reports.generatedAtLabel', 'Generated')}</span>
                      <strong>{selectedReportGeneratedAt}</strong>
                    </article>
                    <article>
                      <span>{t('projection.scenario', 'Scenario')}</span>
                      <strong>{selectedReportScenarioName}</strong>
                    </article>
                    <article>
                      <span>
                        {t(
                          'v2Reports.acceptedBaselineYears',
                          'Accepted baseline years',
                        )}
                      </span>
                      <strong>{selectedAcceptedBaselineYearsLabel}</strong>
                    </article>
                    <article>
                      <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                      <strong>{selectedScenarioHorizonLabel}</strong>
                    </article>
                  </div>

                  <div className="v2-actions-row v2-reports-document-actions">
                    <div className="v2-reports-document-status">
                      <strong>{reportVariantLabel(selectedReport.variant)}</strong>
                      {selectedReportExportHint ? (
                        <p className="v2-muted">{selectedReportExportHint}</p>
                      ) : null}
                    </div>
                    <div className="v2-reports-document-action-buttons">
                      <button
                        className="v2-btn v2-btn-primary"
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={!canDownloadPdf}
                      >
                        {downloadingPdf
                          ? t('v2Reports.downloadingPdf', 'Downloading PDF...')
                          : t('v2Reports.downloadPdf')}
                      </button>
                      <button
                        className="v2-btn"
                        type="button"
                        onClick={() => onGoToForecast(selectedReport.ennuste.id)}
                      >
                        {t('v2Reports.openForecast')}
                      </button>
                    </div>
                  </div>
                </article>

                <div className="v2-grid v2-grid-two v2-reports-preview-grid">
                  <article className="v2-subcard v2-reports-panel-card v2-reports-meta-card">
                    <div className="v2-keyvalue-list">
                      {selectedReport.snapshot.vesinvestPlan ? (
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Vesinvest.planSelector', 'Plan revision')}</span>
                          <strong>{`${selectedReport.snapshot.vesinvestPlan.name} / v${selectedReport.snapshot.vesinvestPlan.versionNumber}`}</strong>
                        </div>
                      ) : null}
                      <div className="v2-keyvalue-row">
                        <span>{t('v2Forecast.scenarioTypeLabel', 'Branch type')}</span>
                        <strong>{selectedScenarioBranchLabel}</strong>
                      </div>
                      <div className="v2-keyvalue-row">
                        <span>{t('projection.v2.horizonLabel', 'Horizon')}</span>
                        <strong>{selectedScenarioHorizonLabel}</strong>
                      </div>
                      {selectedPrimaryBaselineSourceSummary ? (
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Reports.previewBaselineStatus',
                              'Baseline source',
                            )}
                          </span>
                          <strong>
                            {baselineStatusLabel(
                              selectedPrimaryBaselineSourceSummary.sourceStatus,
                              selectedPrimaryBaselineSourceSummary.planningRole,
                            )}
                          </strong>
                        </div>
                      ) : null}
                      {selectedPrimaryBaselineSourceSummary ? (
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Reports.previewFinancialSource',
                              'Financials source',
                            )}
                          </span>
                          <strong>
                            {baselineDatasetSourceLabel(
                              selectedPrimaryBaselineSourceSummary.financials
                                .source,
                              selectedPrimaryBaselineSourceSummary.financials
                                .provenance,
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
                              <span>{t('v2Vesinvest.investmentPlan', 'Investment plan')}</span>
                              <strong>
                                {option.sections.investmentPlan
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

                  {activeVariant.sections.baselineSources &&
                  selectedBaselineSourceSummaries.length > 0 ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.baselineSourcesTitle',
                        )}
                      </h3>
                      {selectedBaselineSourceSummaries.map((summary) => (
                        <React.Fragment key={summary.year}>
                          <div className="v2-reports-provenance-summary">
                            <div>
                              <span>
                                {t(
                                  'projection.v2.baselineYearLabel',
                                  'Baseline year',
                                )}
                              </span>
                              <strong>{summary.year}</strong>
                            </div>
                            <div>
                              <span>{t('v2Reports.colVariant', 'Variant')}</span>
                              <strong>
                                {baselineStatusLabel(
                                  summary.sourceStatus,
                                  summary.planningRole,
                                )}
                              </strong>
                            </div>
                            <div>
                              <span>{t('v2Reports.baselineSourceVeeti', 'VEETI')}</span>
                              <strong>
                                {summary.sourceBreakdown.veetiDataTypes
                                  .map(dataTypeLabel)
                                  .join(', ') || t('common.no', 'No')}
                              </strong>
                            </div>
                            <div>
                              <span>
                                {t('v2Reports.baselineSourceManual', 'Manual review')}
                              </span>
                              <strong>
                                {summary.sourceBreakdown.manualDataTypes
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
                                    summary.financials.source,
                                    summary.financials.provenance,
                                  )}
                                </strong>
                              </div>
                              <p className="v2-muted">
                                {datasetPublicationNote(summary.financials)}
                              </p>
                            </article>
                            <article className="v2-keyvalue-row v2-reports-provenance-row">
                              <div>
                                <span>{t('v2Reports.baselinePrices', 'Prices')}</span>
                                <strong>
                                  {baselineDatasetSourceLabel(
                                    summary.prices.source,
                                    summary.prices.provenance,
                                  )}
                                </strong>
                              </div>
                              <p className="v2-muted">
                                {datasetPublicationNote(summary.prices)}
                              </p>
                            </article>
                            <article className="v2-keyvalue-row v2-reports-provenance-row">
                              <div>
                                <span>
                                  {t('v2Reports.baselineVolumes', 'Sold volumes')}
                                </span>
                                <strong>
                                  {baselineDatasetSourceLabel(
                                    summary.volumes.source,
                                    summary.volumes.provenance,
                                  )}
                                </strong>
                              </div>
                              <p className="v2-muted">
                                {datasetPublicationNote(summary.volumes)}
                              </p>
                            </article>
                          </div>
                        </React.Fragment>
                      ))}
                    </article>
                  ) : null}

                  {selectedTariffDriverSummary ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>{t('v2Forecast.tariffDriversTitle', 'Why this price')}</h3>
                      <div className="v2-keyvalue-list v2-reports-investment-list">
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Reports.requiredCombinedPriceToday',
                              'Required combined price today',
                            )}
                          </span>
                          <strong>
                            {formatPrice(
                              selectedReportPrimaryFeeSignal.price,
                            )}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Reports.requiredCombinedIncreaseFromCurrent',
                              'Required increase from current combined price',
                            )}
                          </span>
                          <strong>
                            {formatPercent(
                              selectedReportPrimaryFeeSignal.increase,
                            )}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t('v2Vesinvest.baselineYearVolume', 'Combined sold volume')}
                          </span>
                          <strong>
                            {selectedTariffDriverSummary.baselineSoldVolume != null
                              ? formatNumber(
                                  selectedTariffDriverSummary.baselineSoldVolume,
                                  0,
                                )
                              : '-'}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>{t('v2Forecast.totalDepreciationTitle', 'Total depreciation')}</span>
                          <strong>
                            {selectedTariffDriverSummary.openingDepreciation != null
                              ? formatEur(
                                  selectedTariffDriverSummary.openingDepreciation,
                                )
                              : '-'}
                          </strong>
                        </div>
                        <div className="v2-keyvalue-row">
                          <span>
                            {t(
                              'v2Forecast.investmentPeakAnnualTotal',
                              'Peak annual investment total',
                            )}
                          </span>
                          <strong>
                            {selectedTariffDriverSummary.peakInvestmentYear != null &&
                            selectedTariffDriverSummary.peakInvestmentAmount != null
                              ? `${selectedTariffDriverSummary.peakInvestmentYear} · ${formatEur(
                                  selectedTariffDriverSummary.peakInvestmentAmount,
                                )}`
                              : '-'}
                          </strong>
                        </div>
                        {selectedTariffDriverSummary.nearTermExpenseYears ? (
                          <div className="v2-keyvalue-row">
                            <span>
                              {reportNearTermExpenseLabel}
                            </span>
                            <strong>
                              {selectedTariffDriverSummary.nearTermExpenseYears}
                            </strong>
                          </div>
                        ) : null}
                        {selectedTariffAssumptionRows.map((row) => (
                          <div key={row.key} className="v2-keyvalue-row">
                            <span>{row.label}</span>
                            <strong>{row.value}</strong>
                          </div>
                        ))}
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
                        )
                          .filter(([key]) => key !== '__scenarioTypeCode')
                          .map(([key, value]) => (
                          <div key={key} className="v2-reports-assumption-item">
                            <span>{assumptionLabelByKey(key)}</span>
                            <strong>
                              {formatAssumptionSnapshotValue(key, value)}
                            </strong>
                          </div>
                          ))}
                        {selectedReport.snapshot.scenario.nearTermExpenseAssumptions.map(
                          (row) => (
                            <div
                              key={`near-term-${row.year}`}
                              className="v2-reports-assumption-item"
                            >
                              <span>
                                {`${reportNearTermExpenseLabel} ${row.year}`}
                              </span>
                              <strong>{`${formatPercent(
                                row.personnelPct,
                              )} / ${formatPercent(
                                row.energyPct,
                              )} / ${formatPercent(row.opexOtherPct)}`}</strong>
                            </div>
                          ),
                        )}
                        <div className="v2-reports-assumption-item">
                          <span>
                            {t(
                              'v2Forecast.planningInputsEditableSummary',
                              'Near-term expenses, investments, and depreciation',
                            )}
                          </span>
                          <strong>{`${formatPercent(
                            selectedReport.snapshot.scenario.thereafterExpenseAssumptions
                              .personnelPct,
                          )} / ${formatPercent(
                            selectedReport.snapshot.scenario.thereafterExpenseAssumptions
                              .energyPct,
                          )} / ${formatPercent(
                            selectedReport.snapshot.scenario.thereafterExpenseAssumptions
                              .opexOtherPct,
                          )}`}</strong>
                        </div>
                      </div>
                    </article>
                  ) : null}

                  {activeVariant.sections.investmentPlan ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t('v2Vesinvest.investmentPlan', 'Investment plan')}
                      </h3>
                      <div className="v2-reports-investment-summary">
                        <div>
                          <span>
                            {t('v2Reports.investmentYearsCovered', 'Years covered')}
                          </span>
                          <strong>
                            {selectedInvestmentSummary?.coverageLabel ?? '-'}
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
                      {showDetailedInvestmentPlan &&
                      selectedVesinvestAppendix?.yearlyTotals?.length ? (
                        <>
                          <h4>
                            {t('v2Forecast.investmentAnnualTable', 'Full annual table')}
                          </h4>
                          <div className="v2-keyvalue-list v2-reports-investment-list">
                            {selectedVesinvestAppendix.yearlyTotals.map((row) => (
                              <div key={row.year} className="v2-keyvalue-row">
                                <span>{row.year}</span>
                                <strong>{formatEur(row.totalAmount)}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
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
                            {showDetailedInvestmentPlan ? (
                              <table className="v2-vesinvest-table">
                                <thead>
                                  <tr>
                                    <th>{t('v2Vesinvest.projectCode', 'Code')}</th>
                                    <th>{t('v2Vesinvest.projectName', 'Project')}</th>
                                    <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
                                    <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedVesinvestAppendix.groupedProjects.map((group) => (
                                    <React.Fragment key={group.classKey}>
                                      <tr className="v2-vesinvest-matrix-group-row">
                                        <td />
                                        <td>
                                          {resolveVesinvestGroupLabel(
                                            t,
                                            group.classKey,
                                            group.classLabel,
                                          )}
                                        </td>
                                        <td />
                                        <td>{formatEur(group.totalAmount)}</td>
                                      </tr>
                                      {group.projects.map((project) => (
                                        <tr key={`${group.classKey}-${project.code}`}>
                                          <td>{project.code}</td>
                                          <td>{project.name}</td>
                                          <td>{project.accountKey ?? '-'}</td>
                                          <td>{formatEur(project.totalAmount)}</td>
                                        </tr>
                                      ))}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <table className="v2-vesinvest-table">
                                <thead>
                                  <tr>
                                    <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                                    <th>{t('v2Vesinvest.projectTotal', 'Total')}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedVesinvestAppendix.groupedProjects.map((group) => (
                                    <tr key={`summary-${group.classKey}`}>
                                      <td>
                                        {resolveVesinvestGroupLabel(
                                          t,
                                          group.classKey,
                                          group.classLabel,
                                        )}
                                      </td>
                                      <td>{formatEur(group.totalAmount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </>
                      ) : null}
                      {showDetailedInvestmentPlan &&
                      selectedVesinvestAppendix?.depreciationPlan?.length ? (
                        <>
                          <h4>{t('v2Vesinvest.depreciationPlan', 'Depreciation plan')}</h4>
                          <div className="v2-vesinvest-table-wrap">
                            <table className="v2-vesinvest-table">
                              <thead>
                                <tr>
                                  <th>{t('v2Vesinvest.projectClass', 'Class')}</th>
                                  <th>{t('v2Vesinvest.projectAccount', 'Account')}</th>
                                  <th>{t('v2Vesinvest.allocationSummary', 'Service split')}</th>
                                  <th>{t('v2Forecast.method', 'Method')}</th>
                                  <th>{t('v2Vesinvest.writeOffTime', 'Write-off time')}</th>
                                  <th>{t('v2Vesinvest.residualShare', 'Residual share')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedVesinvestAppendix.depreciationPlan.map((row) => (
                                  <tr key={`depreciation-plan-${row.classKey}`}>
                                    <td>
                                      {resolveVesinvestGroupLabel(
                                        t,
                                        row.classKey,
                                        row.classLabel,
                                      )}
                                    </td>
                                    <td>{row.accountKey ?? '-'}</td>
                                    <td>{formatServiceSplitLabel(row.serviceSplit, t)}</td>
                                    <td>
                                      {formatDepreciationMethod(
                                        {
                                          method: row.method,
                                          linearYears: row.linearYears,
                                          residualPercent: row.residualPercent,
                                        },
                                        t,
                                      ) ?? '-'}
                                    </td>
                                    <td>{row.linearYears == null ? '-' : row.linearYears}</td>
                                    <td>
                                      {row.residualPercent == null
                                        ? '-'
                                        : formatPercent(row.residualPercent)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : null}
                    </article>
                  ) : null}
                  {activeVariant.sections.yearlyInvestments ? (
                    <article className="v2-subcard v2-reports-panel-card">
                      <h3>
                        {t(
                          'v2Reports.yearlyInvestmentsSnapshot',
                        )}
                      </h3>
                      <div className="v2-keyvalue-list v2-reports-investment-list">
                        {selectedReport.snapshot.scenario.yearlyInvestments.map(
                          (item) => {
                            const snapshotLabel = resolveVesinvestGroupLabel(
                              t,
                              item.depreciationRuleSnapshot?.assetClassKey ??
                                item.depreciationClassKey ??
                                null,
                              item.depreciationRuleSnapshot?.assetClassName ??
                              item.depreciationRuleSnapshot?.assetClassKey ??
                              item.depreciationClassKey ??
                              null,
                            );
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
