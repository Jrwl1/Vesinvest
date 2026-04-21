import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReportsListColumn, ReportsPreviewColumn } from './reportsPageSections';
import { useReportsPageController } from './useReportsPageController';
import { useReportsPageViewModel } from './useReportsPageViewModel';

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
  const { hasSelectedReportLayout, listColumnProps, previewColumnProps } =
    useReportsPageViewModel({
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
    });

  React.useEffect(() => {
    onFocusedReportChange?.(
      selectedReportId,
      selectedReport?.ennuste.id ?? null,
    );
  }, [onFocusedReportChange, selectedReport, selectedReportId]);

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}

      <section
        className={`v2-grid v2-reports-layout${
          hasSelectedReportLayout ? ' has-selected-report' : ''
        }`}
      >
        <ReportsListColumn {...listColumnProps} />
        <ReportsPreviewColumn {...previewColumnProps} />
      </section>
    </div>
  );
};
