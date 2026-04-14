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
  deriveAdjustedYearResult,
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
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
  type InlineCardField,
} from './overviewManualForms';
import type { MissingRequirement, SetupWizardStep } from './overviewWorkflow';
import {
  getSyncBlockReasonLabel as buildSyncBlockReasonLabel,
} from './overviewLabels';
import {
  buildImportYearSummaryRows,
  markPersistedReviewedImportYears,
  resolveNextReviewQueueYear,
} from './yearReview';
import {
  getDocumentImportSelectedPageNumbers,
  getDocumentImportSelectedSourceLines,
} from './documentPdfImport';
import { sendV2OpsEvent } from './opsTelemetry';

export type ManualPatchMode =
  | 'review'
  | 'manualEdit'
  | 'documentImport'
  | 'workbookImport';

export type CardEditContext = 'step2' | 'step3' | null;

export type DocumentImportPreviewLike = {
  fileName: string;
  pageNumber: number | null;
  confidence: number | null;
  scannedPageCount: number;
  matchedFields: string[];
  warnings: string[];
  documentProfile: string;
  datasetKinds: Array<'financials' | 'prices' | 'volumes'>;
  sourceLines: Array<{ text: string; pageNumber?: number | null }>;
  financials: Partial<Record<keyof ManualFinancialForm, number>>;
  prices: Partial<Record<keyof ManualPriceForm, number>>;
  volumes: Partial<Record<keyof ManualVolumeForm, number>>;
  matches: Array<{
    key: string;
    label: string;
    value: number;
    datasetKind: 'financials' | 'prices' | 'volumes';
    sourceLine: string;
    pageNumber: number | null;
  }>;
  rawText: string;
} | null;

type ReviewStatusRowLike = {
  year: number;
  setupStatus: 'reviewed' | 'ready_for_review' | 'needs_attention' | 'excluded_from_plan';
  missingRequirements: MissingRequirement[];
};

function buildManualFinancialPayload(
  originalFinancials: ManualFinancialForm,
  manualFinancials: ManualFinancialForm,
): ManualFinancialForm {
  const nextFinancials = { ...manualFinancials };
  const resultFieldChanged = numbersDiffer(
    manualFinancials.tilikaudenYliJaama,
    originalFinancials.tilikaudenYliJaama,
  );
  const visibleFinanceFieldsChanged =
    numbersDiffer(manualFinancials.liikevaihto, originalFinancials.liikevaihto) ||
    numbersDiffer(
      manualFinancials.aineetJaPalvelut,
      originalFinancials.aineetJaPalvelut,
    ) ||
    numbersDiffer(
      manualFinancials.henkilostokulut,
      originalFinancials.henkilostokulut,
    ) ||
    numbersDiffer(
      manualFinancials.liiketoiminnanMuutKulut,
      originalFinancials.liiketoiminnanMuutKulut,
    ) ||
    numbersDiffer(manualFinancials.poistot, originalFinancials.poistot) ||
    numbersDiffer(
      manualFinancials.arvonalentumiset,
      originalFinancials.arvonalentumiset,
    ) ||
    numbersDiffer(
      manualFinancials.rahoitustuototJaKulut,
      originalFinancials.rahoitustuototJaKulut,
    ) ||
    numbersDiffer(
      manualFinancials.omistajatuloutus,
      originalFinancials.omistajatuloutus,
    ) ||
    numbersDiffer(
      manualFinancials.omistajanTukiKayttokustannuksiin,
      originalFinancials.omistajanTukiKayttokustannuksiin,
    );

  if (!resultFieldChanged && visibleFinanceFieldsChanged) {
    nextFinancials.tilikaudenYliJaama = deriveAdjustedYearResult(
      originalFinancials,
      manualFinancials,
    );
  }

  return nextFinancials;
}

function buildDocumentFinancialPayload(params: {
  previewFinancials: Partial<Record<keyof ManualFinancialForm, number>>;
  originalFinancials: ManualFinancialForm;
  manualFinancials: ManualFinancialForm;
}): ManualFinancialForm | null {
  const { previewFinancials, originalFinancials, manualFinancials } = params;
  const previewKeys = Object.keys(previewFinancials) as Array<
    keyof ManualFinancialForm
  >;
  const mergedFinancials: ManualFinancialForm = { ...originalFinancials };
  let changed = false;

  for (const key of previewKeys) {
    const value = previewFinancials[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      mergedFinancials[key] = value;
      if (numbersDiffer(value, originalFinancials[key])) {
        changed = true;
      }
    }
  }

  const manuallyEditedKeys = (
    Object.keys(manualFinancials) as Array<keyof ManualFinancialForm>
  ).filter((key) => numbersDiffer(manualFinancials[key], originalFinancials[key]));
  for (const key of manuallyEditedKeys) {
    mergedFinancials[key] = manualFinancials[key];
    changed = true;
  }

  if (!changed) {
    return null;
  }

  const resultManuallyChanged = manuallyEditedKeys.includes('tilikaudenYliJaama');
  const previewProvidesResult =
    typeof previewFinancials.tilikaudenYliJaama === 'number' &&
    Number.isFinite(previewFinancials.tilikaudenYliJaama);
  const visibleFinanceFieldsChanged =
    numbersDiffer(mergedFinancials.liikevaihto, originalFinancials.liikevaihto) ||
    numbersDiffer(
      mergedFinancials.aineetJaPalvelut,
      originalFinancials.aineetJaPalvelut,
    ) ||
    numbersDiffer(
      mergedFinancials.henkilostokulut,
      originalFinancials.henkilostokulut,
    ) ||
    numbersDiffer(
      mergedFinancials.liiketoiminnanMuutKulut,
      originalFinancials.liiketoiminnanMuutKulut,
    ) ||
    numbersDiffer(mergedFinancials.poistot, originalFinancials.poistot) ||
    numbersDiffer(
      mergedFinancials.arvonalentumiset,
      originalFinancials.arvonalentumiset,
    ) ||
    numbersDiffer(
      mergedFinancials.rahoitustuototJaKulut,
      originalFinancials.rahoitustuototJaKulut,
    ) ||
    numbersDiffer(
      mergedFinancials.omistajatuloutus,
      originalFinancials.omistajatuloutus,
    ) ||
    numbersDiffer(
      mergedFinancials.omistajanTukiKayttokustannuksiin,
      originalFinancials.omistajanTukiKayttokustannuksiin,
    );

  if (!resultManuallyChanged && !previewProvidesResult && visibleFinanceFieldsChanged) {
    mergedFinancials.tilikaudenYliJaama = deriveAdjustedYearResult(
      originalFinancials,
      mergedFinancials,
    );
  }

  return mergedFinancials;
}

function buildDocumentDatasetPayload<T extends Record<string, number>>(params: {
  original: T;
  manual: T;
  preview: Partial<T>;
}): T | null {
  const { original, manual, preview } = params;
  const merged = { ...original } as T;
  let changed = false;

  for (const key of Object.keys(preview) as Array<keyof T>) {
    const value = preview[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      merged[key] = value as T[keyof T];
      if (numbersDiffer(value, original[key])) {
        changed = true;
      }
    }
  }

  for (const key of Object.keys(manual) as Array<keyof T>) {
    if (!numbersDiffer(manual[key], original[key])) {
      continue;
    }
    merged[key] = manual[key];
    changed = true;
  }

  return changed ? merged : null;
}

export function useOverviewManualPatchEditor(params: {
  t: TFunction;
  documentImportPreview: DocumentImportPreviewLike;
  documentImportBusy: boolean;
  workbookImportBusy: boolean;
  resetDocumentImportState: () => void;
  resetWorkbookImportState: () => void;
}) {
  const {
    t,
    documentImportPreview,
    documentImportBusy,
    workbookImportBusy,
    resetDocumentImportState,
    resetWorkbookImportState,
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
    perusmaksuYhteensa: 0,
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
      documentImportBusy ||
      workbookImportBusy
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
    resetDocumentImportState();
    resetWorkbookImportState();
  }, [
    documentImportBusy,
    manualPatchBusy,
    resetDocumentImportState,
    resetWorkbookImportState,
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
        } else if (missing.includes('tariffRevenue')) {
          resolvedFocusField = 'perusmaksuYhteensa';
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
      resetDocumentImportState();
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
      resetDocumentImportState,
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
        key: 'prices' | 'volumes' | 'tariffRevenue';
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
      if (missingRequirements.includes('tariffRevenue')) {
        actions.push({
          key: 'tariffRevenue',
          label: t(
            'v2Overview.repairTariffRevenueButton',
            'Repair fixed revenue',
          ),
          focusField: 'perusmaksuYhteensa',
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

      const shouldPersistDocumentImport =
        manualPatchMode === 'documentImport' && documentImportPreview != null;
      const documentFinancialOverrides =
        shouldPersistDocumentImport && documentImportPreview != null
          ? buildDocumentFinancialPayload({
              previewFinancials: documentImportPreview.financials,
              originalFinancials,
              manualFinancials,
            })
          : null;
      const documentPriceOverrides =
        shouldPersistDocumentImport && documentImportPreview != null
          ? buildDocumentDatasetPayload({
              original: originalPrices,
              manual: manualPrices,
              preview: documentImportPreview.prices,
            })
          : null;
      const documentVolumeOverrides =
        shouldPersistDocumentImport && documentImportPreview != null
          ? buildDocumentDatasetPayload({
              original: originalVolumes,
              manual: manualVolumes,
              preview: documentImportPreview.volumes,
            })
          : null;

      if (
        formsDiffer(manualFinancials, originalFinancials) ||
        documentFinancialOverrides != null
      ) {
        payload.financials =
          documentFinancialOverrides ??
          buildManualFinancialPayload(originalFinancials, manualFinancials);
      }
      if (
        formsDiffer(manualPrices, originalPrices) || documentPriceOverrides != null
      ) {
        payload.prices = documentPriceOverrides ?? { ...manualPrices };
      }
      if (
        formsDiffer(manualVolumes, originalVolumes) || documentVolumeOverrides != null
      ) {
        payload.volumes = documentVolumeOverrides ?? { ...manualVolumes };
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
      if (
        (payload.financials || payload.prices || payload.volumes) &&
        shouldPersistDocumentImport
      ) {
        const selectedDocumentImportFields = [
          ...new Set(documentImportPreview.matches.map((match) => match.key)),
        ];
        const selectedDocumentImportDatasetKindsFromMatches = [
          ...new Set(
            documentImportPreview.matches
              .map((match) => match.datasetKind)
              .filter(
                (
                  datasetKind,
                ): datasetKind is 'financials' | 'prices' | 'volumes' =>
                  datasetKind === 'financials' ||
                  datasetKind === 'prices' ||
                  datasetKind === 'volumes',
              ),
          ),
        ];
        const selectedDocumentImportDatasetKinds =
          selectedDocumentImportDatasetKindsFromMatches.length > 0
            ? selectedDocumentImportDatasetKindsFromMatches
            : documentImportPreview.datasetKinds.filter(
                (
                  datasetKind,
                ): datasetKind is 'financials' | 'prices' | 'volumes' =>
                  datasetKind === 'financials' ||
                  datasetKind === 'prices' ||
                  datasetKind === 'volumes',
              );
        const selectedDocumentImportPageNumbers =
          getDocumentImportSelectedPageNumbers(documentImportPreview);
        const selectedDocumentImportSourceLines =
          getDocumentImportSelectedSourceLines(documentImportPreview);
        payload.documentImport = {
          fileName: documentImportPreview.fileName,
          pageNumber:
            selectedDocumentImportPageNumbers.length === 1
              ? selectedDocumentImportPageNumbers[0]
              : undefined,
          pageNumbers:
            selectedDocumentImportPageNumbers.length > 0
              ? selectedDocumentImportPageNumbers
              : undefined,
          confidence: documentImportPreview.confidence ?? undefined,
          scannedPageCount: documentImportPreview.scannedPageCount,
          matchedFields: selectedDocumentImportFields,
          warnings: documentImportPreview.warnings,
          documentProfile:
            documentImportPreview.documentProfile as
              | 'generic_pdf'
              | 'statement_pdf'
              | 'qdis_pdf'
              | 'unknown_pdf',
          datasetKinds: selectedDocumentImportDatasetKinds,
          sourceLines: selectedDocumentImportSourceLines.map((row) => ({
            text: row.text,
            pageNumber: row.pageNumber ?? undefined,
          })),
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
      documentImportPreview,
      manualEnergy,
      manualFinancials,
      manualInvestments,
      manualNetwork,
      manualPatchMode,
      manualPrices,
      manualReason,
      manualVolumes,
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
        const reopenCurrentYearForFollowup = false;
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
        } else if (cardEditContext === 'step3') {
          setCardEditYear(currentYear);
        } else {
          closeInlineCardEditor();
        }
        const savedYear = result.status.years.find(
          (row) => row.vuosi === currentYear,
        );
        const savedYearReason = savedYear
          ? buildSyncBlockReasonLabel(t, savedYear)
          : null;
        setInfo(
          result.syncReady
            ? t('v2Overview.manualPatchSaved', { year: currentYear })
            : savedYearReason
            ? t('v2Overview.manualPatchSavedNeedsReview', {
                year: currentYear,
                reason: savedYearReason,
              })
            : t(
                'v2Overview.manualPatchSavedStillBlocked',
                'Year {{year}} was saved. Review is still incomplete.',
                { year: currentYear },
              ),
        );
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
