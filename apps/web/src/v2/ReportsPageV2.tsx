import React from 'react';
import { useTranslation } from 'react-i18next';

import { ReportsListColumn, ReportsPreviewColumn } from './reportsPageSections';
import { useReportsPageController } from './useReportsPageController';
import { useReportsPageViewModel } from './useReportsPageViewModel';

type Props = {
  refreshToken: number;
  focusedReportId: string | null;
  onGoToAssetManagement?: () => void;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToOverviewFeePath?: (planId?: string | null) => void;
  savedFeePathPlanRequired?: boolean;
  savedFeePathPlanId?: string | null;
  savedFeePathScenarioId?: string | null;
  savedFeePathPricingStatus?: 'blocked' | 'provisional' | 'verified' | null;
  savedFeePathTariffPlanStatus?: 'draft' | 'accepted' | 'stale' | null;
  savedFeePathClassificationReviewRequired?: boolean;
  savedFeePathAssetEvidenceReady?: boolean;
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
  onGoToAssetManagement,
  onGoToForecast,
  onGoToOverviewFeePath,
  savedFeePathPlanRequired = false,
  savedFeePathPlanId,
  savedFeePathScenarioId,
  savedFeePathPricingStatus,
  savedFeePathTariffPlanStatus,
  savedFeePathClassificationReviewRequired = false,
  savedFeePathAssetEvidenceReady = false,
  savedFeePathBaselineChangedSinceAcceptedRevision = false,
  savedFeePathInvestmentPlanChangedSinceFeeRecommendation = false,
  savedFeePathReportConflictActive = false,
  onFocusedReportChange,
}) => {
  const { t } = useTranslation();
  const {
    creatingPreviewPackage,
    downloadingPdf,
    emptyStateScenario,
    error,
    handleCreateFirstPackage,
    handleCreatePreviewPackage,
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
    savedFeePathPlanId,
    savedFeePathScenarioId,
  });
  const { hasSelectedReportLayout, listColumnProps, previewColumnProps } =
    useReportsPageViewModel({
      t,
      creatingPreviewPackage,
      downloadingPdf,
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
