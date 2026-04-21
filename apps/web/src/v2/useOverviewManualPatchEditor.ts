import React from 'react';
import type { TFunction } from 'i18next';

import {
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
  getDatasetRowValue,
  formsDiffer,
  getEffectiveFirstRow,
  getEffectiveRows,
  getRawFirstRow,
  IMPORT_BOARD_CANON_ROWS,
  parseManualNumber,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
  type InlineCardField,
} from './overviewManualForms';
import type { MissingRequirement, SetupWizardStep } from './overviewWorkflow';
import { buildImportYearSummaryRows } from './yearReview';
import { buildOverviewManualPatchPayload } from './overviewManualPatchPayload';
import { saveOverviewInlineCardEdit } from './overviewManualPatchSave';

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

type ManualTouchedFieldKey =
  | keyof ManualFinancialForm
  | keyof ManualPriceForm
  | keyof ManualVolumeForm
  | keyof ReturnType<typeof buildInvestmentForm>
  | keyof ReturnType<typeof buildEnergyForm>
  | keyof ReturnType<typeof buildNetworkForm>;

const FINANCIAL_FIELD_SOURCE_KEYS = {
  liikevaihto: 'Liikevaihto',
  perusmaksuYhteensa: 'PerusmaksuYhteensa',
  aineetJaPalvelut: 'AineetJaPalvelut',
  henkilostokulut: 'Henkilostokulut',
  liiketoiminnanMuutKulut: 'LiiketoiminnanMuutKulut',
  poistot: 'Poistot',
  arvonalentumiset: 'Arvonalentumiset',
  rahoitustuototJaKulut: 'RahoitustuototJaKulut',
  tilikaudenYliJaama: 'TilikaudenYliJaama',
  omistajatuloutus: 'Omistajatuloutus',
  omistajanTukiKayttokustannuksiin: 'OmistajanTukiKayttokustannuksiin',
} as const;

const hasOwnNonNullValue = (row: Record<string, unknown>, key: string): boolean => {
  if (!Object.prototype.hasOwnProperty.call(row, key)) return false;
  const value = row[key];
  return !(value == null || (typeof value === 'string' && value.trim().length === 0));
};

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
  const [touchedFields, setTouchedFields] = React.useState<
    Partial<Record<ManualTouchedFieldKey, boolean>>
  >({});

  const resetTouchedFields = React.useCallback(() => {
    setTouchedFields({});
  }, []);

  const markManualFieldTouched = React.useCallback(
    (field: ManualTouchedFieldKey) => {
      setTouchedFields((prev) =>
        prev[field] === true ? prev : { ...prev, [field]: true },
      );
    },
    [],
  );

  const setInlineCardFieldRef = React.useCallback(
    (field: InlineCardField) => (node: HTMLInputElement | null) => {
      inlineCardFieldRefs.current[field] = node;
    },
    [],
  );

  const populateManualEditorFromYearData = React.useCallback(
    (yearData: V2ImportYearDataResponse) => {
      resetTouchedFields();
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
    [resetTouchedFields],
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

  const hasExplicitMissingFinancialEntry = React.useCallback(
    (yearData: V2ImportYearDataResponse | undefined) => {
      if (!yearData) {
        return false;
      }
      const rawFinancials = getRawFirstRow(yearData, 'tilinpaatos');
      const effectiveFinancials = getEffectiveFirstRow(yearData, 'tilinpaatos');
      return (Object.keys(FINANCIAL_FIELD_SOURCE_KEYS) as Array<
        keyof ManualFinancialForm
      >).some((field) => {
        const hasExplicitIntent = touchedFields[field] === true;
        if (!hasExplicitIntent || manualFinancials[field] !== 0) {
          return false;
        }
        const sourceField = FINANCIAL_FIELD_SOURCE_KEYS[field];
        return (
          !hasOwnNonNullValue(rawFinancials, sourceField) &&
          !hasOwnNonNullValue(effectiveFinancials, sourceField)
        );
      });
    },
    [manualFinancials, touchedFields],
  );

  const hasExplicitMissingPriceEntry = React.useCallback(
    (yearData: V2ImportYearDataResponse | undefined) => {
      if (!yearData) {
        return false;
      }
      const rawPriceRows =
        yearData.datasets.find((row) => row.dataType === 'taksa')?.rawRows ?? [];
      const effectivePriceRows = getEffectiveRows(yearData, 'taksa');
      const hasPrice = (
        rows: Array<Record<string, unknown>>,
        typeId: 1 | 2,
      ): boolean =>
        rows.some(
          (row) =>
            parseManualNumber(getDatasetRowValue(row, 'Tyyppi_Id')) === typeId &&
            hasOwnNonNullValue(row, 'Kayttomaksu'),
        );
      return (
        (touchedFields.waterUnitPrice === true &&
          manualPrices.waterUnitPrice === 0 &&
          !hasPrice(rawPriceRows, 1) &&
          !hasPrice(effectivePriceRows, 1)) ||
        (touchedFields.wastewaterUnitPrice === true &&
          manualPrices.wastewaterUnitPrice === 0 &&
          !hasPrice(rawPriceRows, 2) &&
          !hasPrice(effectivePriceRows, 2))
      );
    },
    [manualPrices, touchedFields],
  );

  const hasExplicitMissingVolumeEntry = React.useCallback(
    (yearData: V2ImportYearDataResponse | undefined) => {
      if (!yearData) {
        return false;
      }
      const rawWaterVolume = getRawFirstRow(yearData, 'volume_vesi');
      const effectiveWaterVolume = getEffectiveFirstRow(yearData, 'volume_vesi');
      const rawWastewaterVolume = getRawFirstRow(yearData, 'volume_jatevesi');
      const effectiveWastewaterVolume = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      return (
        (touchedFields.soldWaterVolume === true &&
          manualVolumes.soldWaterVolume === 0 &&
          !hasOwnNonNullValue(rawWaterVolume, 'Maara') &&
          !hasOwnNonNullValue(effectiveWaterVolume, 'Maara')) ||
        (touchedFields.soldWastewaterVolume === true &&
          manualVolumes.soldWastewaterVolume === 0 &&
          !hasOwnNonNullValue(rawWastewaterVolume, 'Maara') &&
          !hasOwnNonNullValue(effectiveWastewaterVolume, 'Maara'))
      );
    },
    [manualVolumes, touchedFields],
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
      hasExplicitMissingFinancialEntry(originalYearData) ||
      hasExplicitMissingPriceEntry(originalYearData) ||
      hasExplicitMissingVolumeEntry(originalYearData) ||
      manualReason.trim() !== originalReason.trim()
    );
  }, [
    cardEditYear,
    hasExplicitMissingFinancialEntry,
    hasExplicitMissingPriceEntry,
    hasExplicitMissingVolumeEntry,
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
            (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 1,
          );
          const hasWastewaterPrice = priceRows.some(
            (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 2,
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
          (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 1,
        );
        if (!hasWaterPrice) {
          return 'waterUnitPrice';
        }
        const hasWastewaterPrice = priceRows.some(
          (entry) => parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id')) === 2,
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
      const hasAnyPrice = priceRows.some((entry) => {
        const typeId = parseManualNumber(getDatasetRowValue(entry, 'Tyyppi_Id'));
        return typeId === 1 || typeId === 2;
      });
      const hasMissingPrices =
        missingRequirements.includes('prices') || !hasAnyPrice;
      const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
      const wastewaterVolumeRow = getEffectiveFirstRow(
        yearData,
        'volume_jatevesi',
      );
      const hasAnyVolume =
        Object.keys(waterVolumeRow).length > 0 ||
        Object.keys(wastewaterVolumeRow).length > 0;
      const hasMissingVolumes =
        missingRequirements.includes('volumes') || !hasAnyVolume;
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
      const result = buildOverviewManualPatchPayload({
        year,
        manualFinancials,
        manualPrices,
        manualVolumes,
        manualInvestments,
        manualEnergy,
        manualNetwork,
        manualReason,
        touchedFields,
        yearDataCache,
        manualPatchMode,
        documentImportPreview,
        t,
        hasExplicitMissingFinancialEntry,
        hasExplicitMissingPriceEntry,
        hasExplicitMissingVolumeEntry,
      });
      if (result.error) {
        setManualPatchError(result.error);
        return null;
      }
      return result.payload;
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
      hasExplicitMissingFinancialEntry,
      hasExplicitMissingPriceEntry,
      hasExplicitMissingVolumeEntry,
      t,
      touchedFields,
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
      setReviewContinueStep: React.Dispatch<React.SetStateAction<SetupWizardStep | null>>;
      setError: React.Dispatch<React.SetStateAction<string | null>>;
      setInfo: React.Dispatch<React.SetStateAction<string | null>>;
    }) => {
      await saveOverviewInlineCardEdit({
        ...params,
        cardEditYear,
        cardEditContext,
        manualPatchMissing,
        t,
        buildManualPatchPayload,
        closeInlineCardEditor,
        openInlineCardEditor,
        populateManualEditorFromYearData,
        setYearDataCache,
        setManualPatchBusy,
        setManualPatchError,
        setCardEditYear,
      });
    },
    [
      buildManualPatchPayload,
      cardEditContext,
      cardEditYear,
      closeInlineCardEditor,
      manualPatchMissing,
      openInlineCardEditor,
      populateManualEditorFromYearData,
      setCardEditYear,
    ],
  );
  const handleSwitchToManualEditMode = React.useCallback(() => {
    setManualPatchMode('manualEdit');
    setManualPatchError(null);
    if (cardEditYear == null) {
      return;
    }
    const cachedYearData = yearDataCache[cardEditYear];
    if (cachedYearData) {
      populateManualEditorFromYearData(cachedYearData);
      return;
    }
    void loadYearIntoManualEditor(cardEditYear);
  }, [cardEditYear, loadYearIntoManualEditor, populateManualEditorFromYearData, yearDataCache]);

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
    touchedFields,
    markManualFieldTouched,
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
