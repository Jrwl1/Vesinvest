import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse, V2ManualYearPatchPayload } from '../api';
import {
  buildEnergyForm,
  buildFinancialForm,
  buildInvestmentForm,
  buildNetworkForm,
  buildPriceForm,
  buildVolumeForm,
  formsDiffer,
  getEffectiveFirstRow,
  getEffectiveRows,
  getRawFirstRow,
  numbersDiffer,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import {
  getDocumentImportSelectedPageNumbers,
  getDocumentImportSelectedSourceLines,
} from './documentPdfImport';

type ManualPatchMode = 'review' | 'manualEdit' | 'documentImport' | 'workbookImport';

type DocumentImportPreviewLike = {
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

type ManualTouchedFieldKey =
  | keyof ManualFinancialForm
  | keyof ManualPriceForm
  | keyof ManualVolumeForm
  | keyof ReturnType<typeof buildInvestmentForm>
  | keyof ReturnType<typeof buildEnergyForm>
  | keyof ReturnType<typeof buildNetworkForm>;

const FINANCIAL_FIELD_SOURCE_KEYS: Record<keyof ManualFinancialForm, string> = {
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
};

const hasOwnNonNullValue = (row: Record<string, unknown>, key: string): boolean => {
  if (!Object.prototype.hasOwnProperty.call(row, key)) {
    return false;
  }
  const value = row[key];
  if (value == null) {
    return false;
  }
  return !(typeof value === 'string' && value.trim().length === 0);
};

function deriveAdjustedYearResult(
  originalFinancials: ManualFinancialForm,
  manualFinancials: ManualFinancialForm,
): number {
  return (
    (manualFinancials.liikevaihto ?? 0) -
    (manualFinancials.aineetJaPalvelut ?? 0) -
    (manualFinancials.henkilostokulut ?? 0) -
    (manualFinancials.liiketoiminnanMuutKulut ?? 0) -
    (manualFinancials.poistot ?? 0) -
    (manualFinancials.arvonalentumiset ?? 0) +
    (manualFinancials.rahoitustuototJaKulut ?? 0) -
    (manualFinancials.omistajatuloutus ?? 0) +
    (manualFinancials.omistajanTukiKayttokustannuksiin ?? 0) +
    ((originalFinancials.tilikaudenYliJaama ?? 0) -
      ((originalFinancials.liikevaihto ?? 0) -
        (originalFinancials.aineetJaPalvelut ?? 0) -
        (originalFinancials.henkilostokulut ?? 0) -
        (originalFinancials.liiketoiminnanMuutKulut ?? 0) -
        (originalFinancials.poistot ?? 0) -
        (originalFinancials.arvonalentumiset ?? 0) +
        (originalFinancials.rahoitustuototJaKulut ?? 0) -
        (originalFinancials.omistajatuloutus ?? 0) +
        (originalFinancials.omistajanTukiKayttokustannuksiin ?? 0)))
  );
}

function buildManualFinancialPayload(params: {
  originalFinancials: ManualFinancialForm;
  manualFinancials: ManualFinancialForm;
  touchedFields: Partial<Record<ManualTouchedFieldKey, boolean>>;
  yearData: V2ImportYearDataResponse | undefined;
}): NonNullable<V2ManualYearPatchPayload['financials']> {
  const { originalFinancials, manualFinancials, touchedFields, yearData } = params;
  const nextFinancials: NonNullable<V2ManualYearPatchPayload['financials']> = {};
  const rawFinancials = getRawFirstRow(yearData, 'tilinpaatos');
  const effectiveFinancials = getEffectiveFirstRow(yearData, 'tilinpaatos');
  const hasExplicitZeroIntent = (field: keyof ManualFinancialForm) => {
    if (touchedFields[field] !== true || manualFinancials[field] !== 0) {
      return false;
    }
    const sourceField = FINANCIAL_FIELD_SOURCE_KEYS[field];
    return (
      !hasOwnNonNullValue(rawFinancials, sourceField) &&
      !hasOwnNonNullValue(effectiveFinancials, sourceField)
    );
  };

  (Object.keys(FINANCIAL_FIELD_SOURCE_KEYS) as Array<keyof ManualFinancialForm>).forEach((field) => {
    if (numbersDiffer(manualFinancials[field], originalFinancials[field]) || hasExplicitZeroIntent(field)) {
      nextFinancials[field] = manualFinancials[field];
    }
  });

  const resultFieldChanged = numbersDiffer(
    manualFinancials.tilikaudenYliJaama,
    originalFinancials.tilikaudenYliJaama,
  );
  const visibleFinanceFieldsChanged =
    numbersDiffer(manualFinancials.liikevaihto, originalFinancials.liikevaihto) ||
    numbersDiffer(manualFinancials.aineetJaPalvelut, originalFinancials.aineetJaPalvelut) ||
    numbersDiffer(manualFinancials.henkilostokulut, originalFinancials.henkilostokulut) ||
    numbersDiffer(
      manualFinancials.liiketoiminnanMuutKulut,
      originalFinancials.liiketoiminnanMuutKulut,
    ) ||
    numbersDiffer(manualFinancials.poistot, originalFinancials.poistot) ||
    numbersDiffer(manualFinancials.arvonalentumiset, originalFinancials.arvonalentumiset) ||
    numbersDiffer(manualFinancials.rahoitustuototJaKulut, originalFinancials.rahoitustuototJaKulut) ||
    numbersDiffer(manualFinancials.omistajatuloutus, originalFinancials.omistajatuloutus) ||
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
  const previewKeys = Object.keys(previewFinancials) as Array<keyof ManualFinancialForm>;
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

  const manuallyEditedKeys = (Object.keys(manualFinancials) as Array<keyof ManualFinancialForm>).filter(
    (key) => numbersDiffer(manualFinancials[key], originalFinancials[key]),
  );
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
    numbersDiffer(mergedFinancials.aineetJaPalvelut, originalFinancials.aineetJaPalvelut) ||
    numbersDiffer(mergedFinancials.henkilostokulut, originalFinancials.henkilostokulut) ||
    numbersDiffer(
      mergedFinancials.liiketoiminnanMuutKulut,
      originalFinancials.liiketoiminnanMuutKulut,
    ) ||
    numbersDiffer(mergedFinancials.poistot, originalFinancials.poistot) ||
    numbersDiffer(mergedFinancials.arvonalentumiset, originalFinancials.arvonalentumiset) ||
    numbersDiffer(
      mergedFinancials.rahoitustuototJaKulut,
      originalFinancials.rahoitustuototJaKulut,
    ) ||
    numbersDiffer(mergedFinancials.omistajatuloutus, originalFinancials.omistajatuloutus) ||
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
  preview: Partial<Record<keyof T, number>>;
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
    if (numbersDiffer(manual[key], original[key])) {
      merged[key] = manual[key];
      changed = true;
    }
  }

  return changed ? merged : null;
}

export function buildOverviewManualPatchPayload(params: {
  year: number;
  manualFinancials: ManualFinancialForm;
  manualPrices: ManualPriceForm;
  manualVolumes: ManualVolumeForm;
  manualInvestments: ReturnType<typeof buildInvestmentForm>;
  manualEnergy: ReturnType<typeof buildEnergyForm>;
  manualNetwork: ReturnType<typeof buildNetworkForm>;
  manualReason: string;
  touchedFields: Partial<Record<ManualTouchedFieldKey, boolean>>;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  manualPatchMode: ManualPatchMode;
  documentImportPreview: DocumentImportPreviewLike;
  t: TFunction;
  hasExplicitMissingFinancialEntry: (yearData: V2ImportYearDataResponse | undefined) => boolean;
  hasExplicitMissingPriceEntry: (yearData: V2ImportYearDataResponse | undefined) => boolean;
  hasExplicitMissingVolumeEntry: (yearData: V2ImportYearDataResponse | undefined) => boolean;
}): { payload: V2ManualYearPatchPayload | null; error: string | null } {
  const {
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
  } = params;

  if (manualFinancials.liikevaihto < 0) {
    return {
      payload: null,
      error: t(
        'v2Overview.manualPatchFinancialsRequired',
        'Revenue (Liikevaihto) cannot be negative.',
      ),
    };
  }

  const originalYearData = yearDataCache[year];
  const originalFinancials = buildFinancialForm(originalYearData);
  const originalPrices = buildPriceForm(originalYearData);
  const originalVolumes = buildVolumeForm(originalYearData);
  const originalInvestments = buildInvestmentForm(originalYearData);
  const originalEnergy = buildEnergyForm(originalYearData);
  const originalNetwork = buildNetworkForm(originalYearData);
  const explicitMissingFinancialEntry = hasExplicitMissingFinancialEntry(originalYearData);
  const explicitMissingPriceEntry = hasExplicitMissingPriceEntry(originalYearData);
  const explicitMissingVolumeEntry = hasExplicitMissingVolumeEntry(originalYearData);

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
    explicitMissingFinancialEntry ||
    documentFinancialOverrides != null
  ) {
    payload.financials =
      documentFinancialOverrides ??
      buildManualFinancialPayload({
        originalFinancials,
        manualFinancials,
        touchedFields,
        yearData: originalYearData,
      });
  }
  if (
    formsDiffer(manualPrices, originalPrices) ||
    explicitMissingPriceEntry ||
    documentPriceOverrides != null
  ) {
    payload.prices = documentPriceOverrides ?? { ...manualPrices };
  }
  if (
    formsDiffer(manualVolumes, originalVolumes) ||
    explicitMissingVolumeEntry ||
    documentVolumeOverrides != null
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
  if ((payload.financials || payload.prices || payload.volumes) && shouldPersistDocumentImport) {
    const selectedDocumentImportFields = [
      ...new Set(documentImportPreview.matches.map((match) => match.key)),
    ];
    const selectedDocumentImportDatasetKindsFromMatches = [
      ...new Set(
        documentImportPreview.matches
          .map((match) => match.datasetKind)
          .filter(
            (datasetKind): datasetKind is 'financials' | 'prices' | 'volumes' =>
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
            (datasetKind): datasetKind is 'financials' | 'prices' | 'volumes' =>
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
      documentProfile: documentImportPreview.documentProfile as
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
    return {
      payload: null,
      error: t(
        'v2Overview.manualPatchNoChanges',
        'No changes detected. Update at least one field before saving.',
      ),
    };
  }

  return { payload, error: null };
}
