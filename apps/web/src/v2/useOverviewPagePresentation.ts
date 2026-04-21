import type { TFunction } from 'i18next';
import React from 'react';

import { getImportYearDataV2 } from '../api';
import {
  getDatasetSourceLabel as buildDatasetSourceLabel,
  getFinancialComparisonLabel as buildFinancialComparisonLabel,
  getImportWarningLabel as buildImportWarningLabel,
  getMissingRequirementLabel as buildMissingRequirementLabel,
  getPriceComparisonLabel as buildPriceComparisonLabel,
  getSourceLayerText as buildSourceLayerText,
  getSourceStatusClassName as buildSourceStatusClassName,
  getSourceStatusLabel as buildSourceStatusLabel,
  getVolumeComparisonLabel as buildVolumeComparisonLabel,
  renderDatasetCounts as formatDatasetCounts,
  renderDatasetTypeList as formatDatasetTypeList,
} from './overviewLabels';
import {
  renderOverviewStep2InlineFieldEditor,
  renderOverviewYearValuePreview,
} from './overviewRenderers';
import { type MissingRequirement } from './overviewWorkflow';
import type { useOverviewImportController } from './useOverviewImportController';
import type { useOverviewManualPatchController } from './useOverviewManualPatchController';
import { buildImportYearSourceLayers } from './yearReview';

type Params = {
  t: TFunction;
  importController: ReturnType<typeof useOverviewImportController>;
  manualController: ReturnType<typeof useOverviewManualPatchController>;
  handleInlineCardKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  saveInlineCardEdit: () => Promise<void> | void;
};

export function useOverviewPagePresentation({
  t,
  importController,
  manualController,
  handleInlineCardKeyDown,
  saveInlineCardEdit,
}: Params) {
  const yearDataCacheRef = React.useRef(manualController.yearDataCache);

  React.useEffect(() => {
    yearDataCacheRef.current = manualController.yearDataCache;
  }, [manualController.yearDataCache]);

  const sourceStatusLabel = React.useCallback(
    (status: string | undefined) => buildSourceStatusLabel(t, status),
    [t],
  );

  const sourceStatusClassName = React.useCallback(
    (status: string | undefined) => buildSourceStatusClassName(status),
    [],
  );

  const financialComparisonLabel = React.useCallback(
    (key: string) => buildFinancialComparisonLabel(t, key),
    [t],
  );

  const datasetSourceLabel = React.useCallback(
    (
      source: 'veeti' | 'manual' | 'none',
      provenance: Parameters<typeof buildDatasetSourceLabel>[2],
    ) => buildDatasetSourceLabel(t, source, provenance),
    [t],
  );

  const renderDatasetTypeList = React.useCallback(
    (dataTypes?: string[]) => formatDatasetTypeList(t, dataTypes),
    [t],
  );

  const importWarningLabel = React.useCallback(
    (warning: string) => buildImportWarningLabel(t, warning),
    [t],
  );

  const renderDatasetCounts = React.useCallback(
    (counts?: Record<string, number>) => formatDatasetCounts(t, counts),
    [t],
  );

  const missingRequirementLabel = React.useCallback(
    (
      requirement: MissingRequirement,
      options?: {
        tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
      },
    ) => buildMissingRequirementLabel(t, requirement, options),
    [t],
  );

  const sourceLayerText = React.useCallback(
    (layer: ReturnType<typeof buildImportYearSourceLayers>[number]): string =>
      buildSourceLayerText(t, layer),
    [t],
  );

  const priceComparisonLabel = React.useCallback(
    (key: 'waterUnitPrice' | 'wastewaterUnitPrice') =>
      buildPriceComparisonLabel(t, key),
    [t],
  );

  const volumeComparisonLabel = React.useCallback(
    (key: 'soldWaterVolume' | 'soldWastewaterVolume') =>
      buildVolumeComparisonLabel(t, key),
    [t],
  );

  const loadYearPreviewData = React.useCallback(
    async (year: number) => {
      if (
        yearDataCacheRef.current[year] ||
        importController.previewFetchYearsRef.current.has(year)
      ) {
        return;
      }
      importController.previewFetchYearsRef.current.add(year);
      try {
        const yearData = await getImportYearDataV2(year);
        manualController.setYearDataCache((prev) =>
          prev[year] ? prev : { ...prev, [year]: yearData },
        );
      } catch {
        // Preview cards fall back gracefully when data is unavailable.
        importController.previewFetchYearsRef.current.delete(year);
      }
    },
    [importController.previewFetchYearsRef, manualController.setYearDataCache],
  );

  const renderYearValuePreview = React.useCallback(
    (
      year: number,
      availability?: {
        financials: boolean;
        prices: boolean;
        volumes: boolean;
      },
      options?: {
        compact?: boolean;
      },
    ) =>
      renderOverviewYearValuePreview({
        year,
        t,
        yearDataCache: manualController.yearDataCache,
        sourceLayerText,
        availability,
        options,
      }),
    [manualController.yearDataCache, sourceLayerText, t],
  );

  const renderStep2InlineFieldEditor = React.useCallback(
    (
      field: Parameters<typeof renderOverviewStep2InlineFieldEditor>[0]['field'],
    ) =>
      renderOverviewStep2InlineFieldEditor({
        field,
        t,
        cardEditYear: manualController.cardEditYear,
        manualPatchBusy: manualController.manualPatchBusy,
        manualFinancials: manualController.manualFinancials,
        setManualFinancials: manualController.setManualFinancials,
        manualPrices: manualController.manualPrices,
        setManualPrices: manualController.setManualPrices,
        manualVolumes: manualController.manualVolumes,
        setManualVolumes: manualController.setManualVolumes,
        markManualFieldTouched: manualController.markManualFieldTouched,
        setInlineCardFieldRef: manualController.setInlineCardFieldRef,
        handleInlineCardKeyDown,
        isInlineCardDirty: manualController.isInlineCardDirty,
        saveInlineCardEdit,
        dismissInlineCardEditor: manualController.dismissInlineCardEditor,
      }),
    [handleInlineCardKeyDown, manualController, saveInlineCardEdit, t],
  );

  const setupStatusLabel = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return t('v2Overview.setupStatusReviewed', 'Reviewed');
      }
      if (status === 'ready_for_review') {
        return t('v2Overview.setupStatusTechnicalReady', 'Ready for review');
      }
      if (status === 'excluded_from_plan') {
        return t('v2Overview.setupStatusExcluded');
      }
      return t('v2Overview.setupStatusNeedsAttention');
    },
    [t],
  );

  const setupStatusClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => {
      if (status === 'reviewed') {
        return 'v2-status-positive';
      }
      if (status === 'ready_for_review') {
        return 'v2-status-info';
      }
      if (status === 'excluded_from_plan') {
        return 'v2-status-provenance';
      }
      return 'v2-status-warning';
    },
    [],
  );

  const yearStatusRowClassName = React.useCallback(
    (
      status:
        | 'reviewed'
        | 'ready_for_review'
        | 'needs_attention'
        | 'excluded_from_plan',
    ) => status,
    [],
  );

  return {
    datasetSourceLabel,
    financialComparisonLabel,
    importWarningLabel,
    loadYearPreviewData,
    missingRequirementLabel,
    priceComparisonLabel,
    renderDatasetCounts,
    renderDatasetTypeList,
    renderStep2InlineFieldEditor,
    renderYearValuePreview,
    setupStatusClassName,
    setupStatusLabel,
    sourceLayerText,
    sourceStatusClassName,
    sourceStatusLabel,
    volumeComparisonLabel,
    yearStatusRowClassName,
  };
}
