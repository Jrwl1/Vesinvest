import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  createReportV2,
  downloadReportPdfV2,
  getForecastScenarioV2,
  getPlanningContextV2,
  getReportV2,
  listForecastScenariosV2,
  listReportsV2,
  type V2ForecastScenario,
  type V2ReportDetail,
  type V2ReportListItem,
} from '../api';
import {
  buildDefaultPackageReportTitle,
  normalizeReportLocale,
} from './displayNames';
import type { ReportVariant } from './reportReadinessModel';
import { readForecastRuntimeState } from './reportReadinessModel';

export type ReportsPageControllerOptions = {
  refreshToken: number;
  focusedReportId: string | null;
  savedFeePathPlanId?: string | null;
  savedFeePathScenarioId?: string | null;
};

export const useReportsPageController = ({
  refreshToken,
  focusedReportId,
  savedFeePathPlanId,
  savedFeePathScenarioId,
}: ReportsPageControllerOptions) => {
  const { t, i18n } = useTranslation();
  const reportLocaleLanguage = i18n?.language;
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
  const [creatingPreviewPackage, setCreatingPreviewPackage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewVariant, setPreviewVariant] =
    React.useState<ReportVariant>('regulator_package');
  const [emptyStateScenario, setEmptyStateScenario] =
    React.useState<V2ForecastScenario | null>(null);
  const [emptyStateBaselineYears, setEmptyStateBaselineYears] =
    React.useState<number[]>([]);

  const pickDefaultReportId = React.useCallback(
    (
      rows: V2ReportListItem[],
      currentReportId: string | null,
      preferredReportId?: string,
    ) => {
      if (preferredReportId && rows.some((row) => row.id === preferredReportId)) {
        return preferredReportId;
      }
      if (currentReportId && rows.some((row) => row.id === currentReportId)) {
        return currentReportId;
      }
      const regulatorPackage = rows.find((row) => row.variant === 'regulator_package');
      return regulatorPackage?.id ?? rows[0]?.id ?? null;
    },
    [],
  );

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
          return pickDefaultReportId(rows, current, preferredReportId);
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
    [pickDefaultReportId, scenarioFilter, t],
  );

  React.useEffect(() => {
    loadReports(focusedReportId ?? undefined);
  }, [focusedReportId, loadReports, refreshToken]);

  React.useEffect(() => {
    if (!selectedReportId) {
      setSelectedReport(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setSelectedReport(null);
      setLoadingDetail(true);
      setError(null);
      try {
        const detail = await getReportV2(selectedReportId);
        if (!cancelled) setSelectedReport(detail);
      } catch (err) {
        if (!cancelled) {
          setSelectedReport(null);
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

    void run();
    return () => {
      cancelled = true;
    };
  }, [selectedReportId, t]);

  React.useEffect(() => {
    if (loadingList || reports.length > 0) {
      setEmptyStateScenario(null);
      setEmptyStateBaselineYears([]);
      return;
    }

    let cancelled = false;
    const runtimeState = readForecastRuntimeState();

    const run = async () => {
      try {
        const [scenarioRows, planningContext] = await Promise.all([
          listForecastScenariosV2(),
          getPlanningContextV2().catch(() => null),
        ]);
        if (cancelled) return;
        setEmptyStateBaselineYears(
          planningContext?.baselineYears.map((row) => row.year).sort((left, right) => left - right) ??
            [],
        );
        if (scenarioRows.length === 0) {
          setEmptyStateScenario(null);
          return;
        }

        const candidateScenarioIds = [
          savedFeePathScenarioId,
          runtimeState.selectedScenarioId &&
          scenarioRows.some((row) => row.id === runtimeState.selectedScenarioId)
            ? runtimeState.selectedScenarioId
            : null,
          scenarioRows[0]?.id ?? null,
        ].filter(
          (value, index, all): value is string =>
            typeof value === 'string' &&
            value.length > 0 &&
            all.indexOf(value) === index,
        );

        if (candidateScenarioIds.length === 0) {
          setEmptyStateScenario(null);
          return;
        }

        for (const scenarioId of candidateScenarioIds) {
          try {
            const scenario = await getForecastScenarioV2(scenarioId);
            if (cancelled) return;
            setEmptyStateScenario(scenario);
            return;
          } catch {
            if (cancelled) return;
          }
        }

        setEmptyStateScenario(null);
      } catch {
        if (cancelled) return;
        setEmptyStateScenario(null);
        setEmptyStateBaselineYears([]);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadingList, reports, savedFeePathScenarioId]);

  React.useEffect(() => {
    if (!selectedReport) return;
    setPreviewVariant(selectedReport.variant);
  }, [selectedReport]);

  const handleDownloadPdf = React.useCallback(async () => {
    if (!selectedReport) return;
    setDownloadingPdf(true);
    setError(null);
    try {
      const { blob, filename } = await downloadReportPdfV2(selectedReport.id);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      link.click();
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

  const handleCreatePreviewPackage = React.useCallback(async () => {
    if (!selectedReport) return;
    const vesinvestPlanId = selectedReport.snapshot.vesinvestPlan?.id;
    if (!vesinvestPlanId) {
      setError(
        t(
          'v2Reports.errorCreateVariantMissingPlan',
          'This saved report does not include a Vesinvest plan snapshot for package creation.',
        ),
      );
      return;
    }

    setCreatingPreviewPackage(true);
    setError(null);
    try {
      const created = await createReportV2({
        vesinvestPlanId,
        ennusteId: selectedReport.ennuste.id,
        variant: previewVariant,
        locale: normalizeReportLocale(reportLocaleLanguage),
        title: buildDefaultPackageReportTitle(
          t,
          selectedReport.ennuste.nimi ?? selectedReport.ennuste.id,
          previewVariant,
        ),
      });
      await loadReports(created.reportId, true);
      setPreviewVariant(created.variant);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('v2Reports.errorCreateVariantFailed', 'Failed to create report package.'),
      );
    } finally {
      setCreatingPreviewPackage(false);
    }
  }, [loadReports, previewVariant, reportLocaleLanguage, selectedReport, t]);

  const handleCreateFirstPackage = React.useCallback(async () => {
    const scenarioId = savedFeePathScenarioId ?? emptyStateScenario?.id ?? null;
    if (!savedFeePathPlanId || !scenarioId) {
      setError(
        t(
          'v2Reports.errorCreateFirstPackageMissingContext',
          'A ready Vesinvest plan and computed forecast are required before creating a report package.',
        ),
      );
      return;
    }

    setCreatingPreviewPackage(true);
    setError(null);
    try {
      const created = await createReportV2({
        vesinvestPlanId: savedFeePathPlanId,
        ennusteId: scenarioId,
        variant: previewVariant,
        locale: normalizeReportLocale(reportLocaleLanguage),
        title: buildDefaultPackageReportTitle(
          t,
          emptyStateScenario?.name ?? scenarioId,
          previewVariant,
        ),
      });
      await loadReports(created.reportId, true);
      setPreviewVariant(created.variant);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : t('v2Reports.errorCreateVariantFailed', 'Failed to create report package.'),
      );
    } finally {
      setCreatingPreviewPackage(false);
    }
  }, [
    emptyStateScenario?.id,
    emptyStateScenario?.name,
    loadReports,
    previewVariant,
    reportLocaleLanguage,
    savedFeePathPlanId,
    savedFeePathScenarioId,
    t,
  ]);

  const handlePreviewVariantChange = React.useCallback(
    (variant: ReportVariant) => {
      setPreviewVariant(variant);
      if (!selectedReport) {
        return;
      }
      const matchingSavedPackage = reports.find(
        (row) =>
          row.variant === variant &&
          row.ennuste.id === selectedReport.ennuste.id,
      );
      if (matchingSavedPackage) {
        setSelectedReportId(matchingSavedPackage.id);
      }
    },
    [reports, selectedReport],
  );

  return {
    creatingPreviewPackage,
    downloadingPdf,
    emptyStateBaselineYears,
    emptyStateScenario,
    error,
    handleCreatePreviewPackage,
    handleCreateFirstPackage,
    handleDownloadPdf,
    loadReports,
    loadingDetail,
    loadingList,
    previewVariant,
    reports,
    scenarioFilter,
    selectedReport,
    selectedReportId,
    setPreviewVariant: handlePreviewVariantChange,
    setScenarioFilter,
    setSelectedReportId,
  };
};
