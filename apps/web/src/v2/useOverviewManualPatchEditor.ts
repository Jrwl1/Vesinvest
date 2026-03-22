import React from 'react';
import type { TFunction } from 'i18next';

import {
  completeImportYearManuallyV2,
  getImportYearDataV2,
  type V2ImportYearDataResponse,
  type V2ManualYearPatchPayload,
} from '../api';
import {
  buildEnergyForm,
  buildFinancialForm,
  buildInvestmentForm,
  buildNetworkForm,
  buildPriceForm,
  buildVolumeForm,
  CARD_SUMMARY_FIELD_TO_INLINE_FIELD,
  formsDiffer,
  getEffectiveFirstRow,
  getEffectiveRows,
  getRawFirstRow,
  IMPORT_BOARD_CANON_ROWS,
  numbersDiffer,
  parseManualNumber,
  type InlineCardField,
} from './overviewManualForms';
import type { MissingRequirement, SetupWizardStep } from './overviewWorkflow';
import {
  buildImportYearSummaryRows,
  markPersistedReviewedImportYears,
  resolveNextReviewQueueYear,
} from './yearReview';
import { sendV2OpsEvent } from './opsTelemetry';

export type ManualPatchMode =
  | 'review'
  | 'manualEdit'
  | 'statementImport'
  | 'workbookImport'
  | 'qdisImport';

export type CardEditContext = 'step2' | 'step3' | null;

export type StatementImportPreviewLike = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  matches: Array<{ key: string }>;
  warnings: string[];
} | null;

export type QdisImportPreviewLike = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  matches: Array<{ key: string }>;
  warnings: string[];
} | null;

type ReviewStatusRowLike = {
  year: number;
  setupStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
};

export function useOverviewManualPatchEditor(params: {
  t: TFunction;
  statementImportPreview: StatementImportPreviewLike;
  qdisImportPreview: QdisImportPreviewLike;
  statementImportBusy: boolean;
  workbookImportBusy: boolean;
  qdisImportBusy: boolean;
  resetStatementImportState: () => void;
  resetWorkbookImportState: () => void;
  resetQdisImportState: () => void;
}) {
  const {
    t,
    statementImportPreview,
    qdisImportPreview,
    statementImportBusy,
    workbookImportBusy,
    qdisImportBusy,
    resetStatementImportState,
    resetWorkbookImportState,
    resetQdisImportState,
  } = params;

  const inlineCardFieldRefs = React.useRef<
    Partial<Record<InlineCardField, HTMLInputElement | null>>
  >({});
  const [manualPatchYear, setManualPatchYear] = React.useState<number | null>(null);
  const [cardEditYear, setCardEditYear] = React.useState<number | null>(null);
  const [cardEditFocusField, setCardEditFocusField] =
    React.useState<InlineCardField | null>(null);
  const [cardEditContext, setCardEditContext] =
    React.useState<CardEditContext>(null);
  const [manualPatchMode, setManualPatchMode] =
    React.useState<ManualPatchMode>('review');
  const [manualPatchMissing, setManualPatchMissing] = React.useState<
    MissingRequirement[]
  >([]);
  const [manualPatchBusy, setManualPatchBusy] = React.useState(false);
  const [manualPatchError, setManualPatchError] = React.useState<string | null>(null);
  const [manualFinancials, setManualFinancials] = React.useState({
    liikevaihto: 0,
    aineetJaPalvelut: 0,
    henkilostokulut: 0,
    liiketoiminnanMuutKulut: 0,
    poistot: 0,
    arvonalentumiset: 0,
    rahoitustuototJaKulut: 0,
    tilikaudenYliJaama: 0,
    omistajatuloutus: 0,
    omistajanTukiKayttokustannuksiin: 0,
  });
  const [manualPrices, setManualPrices] = React.useState({
    waterUnitPrice: 0,
    wastewaterUnitPrice: 0,
  });
  const [manualVolumes, setManualVolumes] = React.useState({
    soldWaterVolume: 0,
    soldWastewaterVolume: 0,
  });
  const [manualInvestments, setManualInvestments] = React.useState({
    investoinninMaara: 0,
    korvausInvestoinninMaara: 0,
  });
  const [manualEnergy, setManualEnergy] = React.useState({
    prosessinKayttamaSahko: 0,
  });
  const [manualNetwork, setManualNetwork] = React.useState({
    verkostonPituus: 0,
  });
  const [manualReason, setManualReason] = React.useState('');
  const [yearDataCache, setYearDataCache] = React.useState<
    Record<number, V2ImportYearDataResponse>
  >({});
  const [loadingYearData, setLoadingYearData] = React.useState<number | null>(null);

  const setInlineCardFieldRef = React.useCallback(
    (field: InlineCardField) => (node: HTMLInputElement | null) => {
      inlineCardFieldRefs.current[field] = node;
    },
    [],
  );

  const populateManualEditorFromYearData = React.useCallback(
    (yearData: V2ImportYearDataResponse) => {
      setManualFinancials(buildFinancialForm(yearData));
      setManualPrices(buildPriceForm(yearData));
      setManualVolumes(buildVolumeForm(yearData));
      setManualInvestments(buildInvestmentForm(yearData));
      setManualEnergy(buildEnergyForm(yearData));
      setManualNetwork(buildNetworkForm(yearData));

      const latestReason = yearData.datasets
        .map((row) => row.overrideMeta?.reason ?? '')
        .find((reason) => reason.length > 0);
      setManualReason(latestReason ?? '');
    },
    [],
  );

  const loadYearIntoManualEditor = React.useCallback(
    async (year: number) => {
      setLoadingYearData(year);
      try {
        const yearData = await getImportYearDataV2(year);
        setYearDataCache((prev) => ({ ...prev, [year]: yearData }));
        populateManualEditorFromYearData(yearData);
      } catch (err) {
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchLoadFailed',
                'Failed to load year data for editing.',
              ),
        );
      } finally {
        setLoadingYearData(null);
      }
    },
    [populateManualEditorFromYearData, t],
  );

  const closeInlineCardEditor = React.useCallback(() => {
    if (
      manualPatchBusy ||
      statementImportBusy ||
      workbookImportBusy ||
      qdisImportBusy
    ) {
      return;
    }
    setCardEditYear(null);
    setCardEditFocusField(null);
    setCardEditContext(null);
    setManualPatchYear(null);
    setManualPatchMode('review');
    setManualPatchMissing([]);
    setManualPatchError(null);
    resetStatementImportState();
    resetWorkbookImportState();
    resetQdisImportState();
  }, [
    manualPatchBusy,
    qdisImportBusy,
    resetQdisImportState,
    resetStatementImportState,
    resetWorkbookImportState,
    statementImportBusy,
    workbookImportBusy,
  ]);

  const isInlineCardDirty = React.useMemo(() => {
    if (cardEditYear == null) return false;
    const originalYearData = yearDataCache[cardEditYear];
    if (!originalYearData) return false;

    const originalReason =
      originalYearData.datasets
        .map((row) => row.overrideMeta?.reason ?? '')
        .find((reason) => reason.length > 0) ?? '';

    return (
      formsDiffer(manualFinancials, buildFinancialForm(originalYearData)) ||
      formsDiffer(manualPrices, buildPriceForm(originalYearData)) ||
      formsDiffer(manualVolumes, buildVolumeForm(originalYearData)) ||
      formsDiffer(manualInvestments, buildInvestmentForm(originalYearData)) ||
      formsDiffer(manualEnergy, buildEnergyForm(originalYearData)) ||
      formsDiffer(manualNetwork, buildNetworkForm(originalYearData)) ||
      manualReason.trim() !== originalReason.trim()
    );
  }, [
    cardEditYear,
    manualEnergy,
    manualFinancials,
    manualInvestments,
    manualNetwork,
    manualPrices,
    manualReason,
    manualVolumes,
    yearDataCache,
  ]);

  const dismissInlineCardEditor = React.useCallback(
    (forceDiscard = false) => {
      if (!forceDiscard && isInlineCardDirty) {
        setManualPatchError(
          t(
            'v2Overview.inlineCardDirtyGuard',
            'Save or cancel this year before moving to another card.',
          ),
        );
        return false;
      }
      closeInlineCardEditor();
      return true;
    },
    [closeInlineCardEditor, isInlineCardDirty, t],
  );

  const openInlineCardEditor = React.useCallback(
    async (
      year: number,
      focusField: InlineCardField | null = null,
      context: 'step2' | 'step3' = 'step2',
      missing: MissingRequirement[] = [],
      mode: ManualPatchMode = context === 'step3' ? 'review' : 'manualEdit',
    ) => {
      let resolvedFocusField = focusField;
      if (context === 'step2' && resolvedFocusField == null) {
        if (missing.includes('financials')) {
          const summaryRows = buildImportYearSummaryRows(yearDataCache[year]);
          const firstMissingFinancialRow = IMPORT_BOARD_CANON_ROWS.find((item) => {
            const summaryRow = summaryRows.find((row) => row.key === item.key);
            return summaryRow?.effectiveValue == null;
          });
          resolvedFocusField = firstMissingFinancialRow
            ? CARD_SUMMARY_FIELD_TO_INLINE_FIELD[firstMissingFinancialRow.key]
            : 'aineetJaPalvelut';
        } else if (missing.includes('prices')) {
          const priceRows = getEffectiveRows(yearDataCache[year], 'taksa');
          const hasWaterPrice = priceRows.some(
            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
          );
          const hasWastewaterPrice = priceRows.some(
            (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
          );
          resolvedFocusField = !hasWaterPrice
            ? 'waterUnitPrice'
            : hasWastewaterPrice
            ? 'waterUnitPrice'
            : 'wastewaterUnitPrice';
        } else if (missing.includes('volumes')) {
          const waterVolumeRow = getEffectiveFirstRow(
            yearDataCache[year],
            'volume_vesi',
          );
          const wastewaterVolumeRow = getEffectiveFirstRow(
            yearDataCache[year],
            'volume_jatevesi',
          );
          resolvedFocusField =
            Object.keys(waterVolumeRow).length === 0
              ? 'soldWaterVolume'
              : Object.keys(wastewaterVolumeRow).length === 0
              ? 'soldWastewaterVolume'
              : 'soldWaterVolume';
        } else {
          resolvedFocusField = 'aineetJaPalvelut';
        }
      }
      setManualPatchYear(context === 'step3' ? year : null);
      setCardEditYear(year);
      setCardEditFocusField(resolvedFocusField);
      setCardEditContext(context);
      setManualPatchMode(mode);
      setManualPatchMissing(missing);
      setManualPatchError(null);
      resetStatementImportState();
      resetWorkbookImportState();

      const cachedYearData = yearDataCache[year];
      if (cachedYearData) {
        populateManualEditorFromYearData(cachedYearData);
        return;
      }
      await loadYearIntoManualEditor(year);
    },
    [
      loadYearIntoManualEditor,
      populateManualEditorFromYearData,
      resetStatementImportState,
      resetWorkbookImportState,
      yearDataCache,
    ],
  );

  const attemptOpenInlineCardEditor = React.useCallback(
    async (
      year: number,
      focusField: InlineCardField | null = null,
      context: 'step2' | 'step3' = 'step2',
      missing: MissingRequirement[] = [],
      mode: ManualPatchMode = context === 'step3' ? 'review' : 'manualEdit',
    ) => {
      if (
        cardEditYear != null &&
        cardEditYear !== year &&
        !dismissInlineCardEditor()
      ) {
        return;
      }
      await openInlineCardEditor(year, focusField, context, missing, mode);
    },
    [cardEditYear, dismissInlineCardEditor, openInlineCardEditor],
  );

  const resolveRepairFocusField = React.useCallback(
    (year: number, target: 'prices' | 'volumes'): InlineCardField => {
      const yearData = yearDataCache[year];
      if (target === 'prices') {
        const priceRows = getEffectiveRows(yearData, 'taksa');
        const hasWaterPrice = priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
        );
        if (!hasWaterPrice) {
          return 'waterUnitPrice';
        }
        const hasWastewaterPrice = priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
        );
        return hasWastewaterPrice ? 'waterUnitPrice' : 'wastewaterUnitPrice';
      }
      const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
      if (Object.keys(waterVolumeRow).length === 0) {
        return 'soldWaterVolume';
      }
      const wastewaterVolumeRow = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      return Object.keys(wastewaterVolumeRow).length === 0
        ? 'soldWastewaterVolume'
        : 'soldWaterVolume';
    },
    [yearDataCache],
  );

  const buildRepairActions = React.useCallback(
    (year: number, missingRequirements: MissingRequirement[]) => {
      const yearData = yearDataCache[year];
      const priceRows = getEffectiveRows(yearData, 'taksa');
      const hasMissingPrices =
        missingRequirements.includes('prices') ||
        !priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
        ) ||
        !priceRows.some(
          (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
        );
      const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
      const wastewaterVolumeRow = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      const hasMissingVolumes =
        missingRequirements.includes('volumes') ||
        Object.keys(waterVolumeRow).length === 0 ||
        Object.keys(wastewaterVolumeRow).length === 0;
      const actions: Array<{
        key: 'prices' | 'volumes';
        label: string;
        focusField: InlineCardField;
      }> = [];
      if (hasMissingPrices) {
        actions.push({
          key: 'prices',
          label: t('v2Overview.repairPricesButton', 'Repair prices'),
          focusField: resolveRepairFocusField(year, 'prices'),
        });
      }
      if (hasMissingVolumes) {
        actions.push({
          key: 'volumes',
          label: t('v2Overview.repairVolumesButton', 'Repair volumes'),
          focusField: resolveRepairFocusField(year, 'volumes'),
        });
      }
      return actions;
    },
    [resolveRepairFocusField, t, yearDataCache],
  );

  React.useEffect(() => {
    if (cardEditYear == null || cardEditFocusField == null) return;
    if (loadingYearData === cardEditYear) return;
    const field = cardEditFocusField;
    const timer = window.setTimeout(() => {
      const input = inlineCardFieldRefs.current[field];
      input?.focus();
      input?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cardEditFocusField, cardEditYear, loadingYearData]);

  const buildManualPatchPayload = React.useCallback(
    (year: number): V2ManualYearPatchPayload | null => {
      if (manualFinancials.liikevaihto < 0) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchFinancialsRequired',
            'Revenue (Liikevaihto) cannot be negative.',
          ),
        );
        return null;
      }

      const originalYearData = yearDataCache[year];
      const originalFinancials = buildFinancialForm(originalYearData);
      const originalPrices = buildPriceForm(originalYearData);
      const originalVolumes = buildVolumeForm(originalYearData);
      const originalInvestments = buildInvestmentForm(originalYearData);
      const originalEnergy = buildEnergyForm(originalYearData);
      const originalNetwork = buildNetworkForm(originalYearData);

      const payload: V2ManualYearPatchPayload = {
        year,
        reason: manualReason.trim() || undefined,
      };

      const shouldPersistStatementImport =
        manualPatchMode === 'statementImport' && statementImportPreview != null;
      const shouldPersistQdisImport =
        manualPatchMode === 'qdisImport' && qdisImportPreview != null;

      if (
        formsDiffer(manualFinancials, originalFinancials) ||
        shouldPersistStatementImport
      ) {
        payload.financials = { ...manualFinancials };
      }
      if (formsDiffer(manualPrices, originalPrices) || shouldPersistQdisImport) {
        payload.prices = { ...manualPrices };
      }
      if (formsDiffer(manualVolumes, originalVolumes) || shouldPersistQdisImport) {
        payload.volumes = { ...manualVolumes };
      }
      if (formsDiffer(manualInvestments, originalInvestments)) {
        payload.investments = { ...manualInvestments };
      }
      if (formsDiffer(manualEnergy, originalEnergy)) {
        payload.energy = { ...manualEnergy };
      }
      if (formsDiffer(manualNetwork, originalNetwork)) {
        payload.network = { ...manualNetwork };
      }
      if (payload.financials && shouldPersistStatementImport) {
        payload.statementImport = {
          fileName: statementImportPreview.fileName,
          pageNumber: statementImportPreview.pageNumber ?? undefined,
          confidence: statementImportPreview.confidence ?? undefined,
          scannedPageCount: statementImportPreview.scannedPageCount,
          matchedFields: statementImportPreview.matches.map((item) => item.key),
          warnings: statementImportPreview.warnings,
        };
      }
      if ((payload.prices || payload.volumes) && shouldPersistQdisImport) {
        payload.qdisImport = {
          fileName: qdisImportPreview.fileName,
          pageNumber: qdisImportPreview.pageNumber ?? undefined,
          confidence: qdisImportPreview.confidence ?? undefined,
          scannedPageCount: qdisImportPreview.scannedPageCount,
          matchedFields: qdisImportPreview.matches.map((item) => item.key),
          warnings: qdisImportPreview.warnings,
        };
      }

      if (
        !payload.financials &&
        !payload.prices &&
        !payload.volumes &&
        !payload.investments &&
        !payload.energy &&
        !payload.network
      ) {
        setManualPatchError(
          t(
            'v2Overview.manualPatchNoChanges',
            'No changes detected. Update at least one field before saving.',
          ),
        );
        return null;
      }

      return payload;
    },
    [
      manualEnergy,
      manualFinancials,
      manualInvestments,
      manualNetwork,
      manualPatchMode,
      manualPrices,
      manualReason,
      manualVolumes,
      qdisImportPreview,
      statementImportPreview,
      t,
      yearDataCache,
    ],
  );

  const saveInlineCardEdit = React.useCallback(
    async (params: {
      syncAfterSave?: boolean;
      loadOverview: (options?: {
        preserveVisibleState?: boolean;
        deferSecondaryLoads?: boolean;
        refreshPlanningContext?: boolean;
        skipSecondaryLoads?: boolean;
      }) => Promise<void>;
      runSync: (years: number[]) => Promise<unknown>;
      reviewStatusRows: ReviewStatusRowLike[];
      confirmedImportedYears: number[];
      reviewStorageOrgId: string | null;
      baselineReady: boolean;
      setReviewedImportedYears: React.Dispatch<React.SetStateAction<number[]>>;
      setReviewContinueStep: React.Dispatch<
        React.SetStateAction<SetupWizardStep | null>
      >;
      setError: React.Dispatch<React.SetStateAction<string | null>>;
      setInfo: React.Dispatch<React.SetStateAction<string | null>>;
    }) => {
      const {
        syncAfterSave = false,
        loadOverview,
        runSync,
        reviewStatusRows,
        confirmedImportedYears,
        reviewStorageOrgId,
        baselineReady,
        setReviewedImportedYears,
        setReviewContinueStep,
        setError,
        setInfo,
      } = params;
      if (cardEditYear == null) return;
      const payload = buildManualPatchPayload(cardEditYear);
      if (!payload) return;

      setManualPatchBusy(true);
      setManualPatchError(null);
      setError(null);
      setInfo(null);
      try {
        const currentYear = cardEditYear;
        const result = await completeImportYearManuallyV2(payload);
        const reopenCurrentYearForFollowup =
          manualPatchMode === 'statementImport' &&
          cardEditContext === 'step3' &&
          result.syncReady;
        const nextRows = reviewStatusRows.map((row) => ({
          year: row.year,
          setupStatus:
            row.year === currentYear && result.syncReady && !reopenCurrentYearForFollowup
              ? ('reviewed' as const)
              : row.setupStatus,
          missingRequirements: row.missingRequirements,
        }));
        const nextQueueYear = result.syncReady
          ? resolveNextReviewQueueYear(nextRows)
          : null;
        const nextQueueRow =
          nextQueueYear == null
            ? null
            : nextRows.find((row) => row.year === nextQueueYear) ?? null;
        if (result.syncReady && !reopenCurrentYearForFollowup) {
          setReviewedImportedYears(
            markPersistedReviewedImportYears(
              reviewStorageOrgId,
              [currentYear],
              [...confirmedImportedYears, currentYear],
            ),
          );
        }
        if (syncAfterSave && result.syncReady) {
          await runSync([currentYear]);
        } else {
          const refreshedYearData = await getImportYearDataV2(currentYear);
          setYearDataCache((prev) => ({ ...prev, [currentYear]: refreshedYearData }));
          populateManualEditorFromYearData(refreshedYearData);
          await loadOverview({
            preserveVisibleState: true,
            refreshPlanningContext: false,
            skipSecondaryLoads: true,
          });
          setCardEditYear(currentYear);
        }
        if (reopenCurrentYearForFollowup) {
          await openInlineCardEditor(currentYear, null, 'step3', manualPatchMissing);
        } else if (cardEditContext === 'step3' && result.syncReady) {
          if (nextQueueRow) {
            await openInlineCardEditor(
              nextQueueRow.year,
              null,
              'step3',
              nextQueueRow.missingRequirements,
            );
          } else {
            closeInlineCardEditor();
            setReviewContinueStep(baselineReady ? 6 : 5);
          }
        } else {
          closeInlineCardEditor();
        }
        setInfo(t('v2Overview.manualPatchSaved', { year: currentYear }));
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'ok',
          attrs: {
            year: currentYear,
            syncReady: result.syncReady,
            patchedDataTypeCount: result.patchedDataTypes.length,
            surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
          },
        });
      } catch (err) {
        sendV2OpsEvent({
          event: 'veeti_manual_patch',
          status: 'error',
          attrs: {
            year: cardEditYear,
            surface: cardEditContext === 'step3' ? 'review_card' : 'step2_card',
          },
        });
        setManualPatchError(
          err instanceof Error
            ? err.message
            : t(
                'v2Overview.manualPatchFailed',
                'Manual year completion failed.',
              ),
        );
      } finally {
        setManualPatchBusy(false);
      }
    },
    [
      buildManualPatchPayload,
      cardEditContext,
      cardEditYear,
      closeInlineCardEditor,
      manualPatchMissing,
      manualPatchMode,
      openInlineCardEditor,
      populateManualEditorFromYearData,
      t,
    ],
  );

  const handleSwitchToManualEditMode = React.useCallback(() => {
    setManualPatchMode('manualEdit');
    setManualPatchError(null);
  }, []);

  return {
    inlineCardFieldRefs,
    setInlineCardFieldRef,
    yearDataCache,
    setYearDataCache,
    loadingYearData,
    manualPatchYear,
    setManualPatchYear,
    cardEditYear,
    setCardEditYear,
    cardEditFocusField,
    setCardEditFocusField,
    cardEditContext,
    setCardEditContext,
    manualPatchMode,
    setManualPatchMode,
    manualPatchMissing,
    setManualPatchMissing,
    manualPatchBusy,
    setManualPatchBusy,
    manualPatchError,
    setManualPatchError,
    manualFinancials,
    setManualFinancials,
    manualPrices,
    setManualPrices,
    manualVolumes,
    setManualVolumes,
    manualInvestments,
    setManualInvestments,
    manualEnergy,
    setManualEnergy,
    manualNetwork,
    setManualNetwork,
    manualReason,
    setManualReason,
    populateManualEditorFromYearData,
    loadYearIntoManualEditor,
    closeInlineCardEditor,
    isInlineCardDirty,
    dismissInlineCardEditor,
    openInlineCardEditor,
    attemptOpenInlineCardEditor,
    resolveRepairFocusField,
    buildRepairActions,
    buildManualPatchPayload,
    saveInlineCardEdit,
    handleSwitchToManualEditMode,
  };
}
