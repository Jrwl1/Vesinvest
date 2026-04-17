import React from 'react';
import type { TFunction } from 'i18next';

import type {
  V2ImportYearDataResponse,
  V2ImportYearResultToZeroSignal,
} from '../api';
import { formatEur, formatNumber, formatPrice } from './format';
import {
  getImportYearTargetStatusLabel,
  getSourceLayerBadgeText,
} from './overviewLabels';
import {
  buildPriceForm,
  buildVolumeForm,
  getEffectiveFirstRow,
  getEffectiveRows,
  parseManualNumber,
  type InlineCardField,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import { getExactEditedFieldLabels } from './useOverviewSetupState';
import {
  type ImportYearSourceLayer,
  buildImportYearSourceLayers,
  buildImportYearSummaryRows,
  buildImportYearTrustSignal,
} from './yearReview';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export type OverviewYearStatusChip = {
  label: string;
  toneClass: string;
};

export function buildOverviewYearTargetChip(
  t: TFunction,
  signal: V2ImportYearResultToZeroSignal | null | undefined,
): OverviewYearStatusChip {
  const direction = signal?.direction ?? 'missing';
  const toneClass =
    direction === 'at_zero'
      ? 'v2-overview-year-target-chip is-at-zero'
      : direction === 'above_zero'
      ? 'v2-overview-year-target-chip is-above-zero'
      : direction === 'below_zero'
      ? 'v2-overview-year-target-chip is-below-zero'
      : 'v2-overview-year-target-chip is-missing';
  return {
    label: getImportYearTargetStatusLabel(t, signal),
    toneClass,
  };
}

export function buildOverviewYearFinancialSourceChip(
  t: TFunction,
  sourceLayers: ImportYearSourceLayer[] | undefined,
  sourceStatus?: string,
): OverviewYearStatusChip {
  const financialLayer = sourceLayers?.find((layer) => layer.key === 'financials');
  if (financialLayer && financialLayer.source !== 'none') {
    return {
      label: getSourceLayerBadgeText(t, financialLayer),
      toneClass: 'v2-overview-year-source-chip is-present',
    };
  }

  if (sourceStatus === 'VEETI') {
    return {
      label: t('v2Overview.sourceVeeti', 'VEETI'),
      toneClass: 'v2-overview-year-source-chip is-present',
    };
  }

  if (sourceStatus === 'MANUAL' || sourceStatus === 'MIXED') {
    return {
      label: t('v2Overview.sourceManual', 'Manual'),
      toneClass: 'v2-overview-year-source-chip is-present',
    };
  }

  return {
    label: t('v2Overview.baselineSourceMissing', 'Missing'),
    toneClass: 'v2-overview-year-source-chip is-missing',
  };
}

export function renderOverviewHighlightedSearchMatch(
  value: string,
  searchTerm: string,
): React.ReactNode {
  if (searchTerm.length < 2) {
    return value;
  }

  const matcher = new RegExp(`(${escapeRegExp(searchTerm)})`, 'ig');
  const parts = value.split(matcher);
  return parts.map((part, index) => {
    if (part.toLowerCase() === searchTerm.toLowerCase()) {
      return (
        <mark className="v2-search-mark" key={`${value}-${index}`}>
          {part}
        </mark>
      );
    }
    return <React.Fragment key={`${value}-${index}`}>{part}</React.Fragment>;
  });
}

type RenderStep2InlineFieldEditorParams = {
  field: InlineCardField;
  t: TFunction;
  cardEditYear: number | null;
  manualPatchBusy: boolean;
  manualFinancials: ManualFinancialForm;
  setManualFinancials: React.Dispatch<React.SetStateAction<ManualFinancialForm>>;
  manualPrices: ManualPriceForm;
  setManualPrices: React.Dispatch<React.SetStateAction<ManualPriceForm>>;
  manualVolumes: ManualVolumeForm;
  setManualVolumes: React.Dispatch<React.SetStateAction<ManualVolumeForm>>;
  markManualFieldTouched: (field: InlineCardField) => void;
  setInlineCardFieldRef: (
    field: InlineCardField,
  ) => (element: HTMLInputElement | null) => void;
  handleInlineCardKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  isInlineCardDirty: boolean;
  saveInlineCardEdit: (syncAfterSave?: boolean) => Promise<void> | void;
  dismissInlineCardEditor: (forceDiscard?: boolean) => boolean;
};

export function renderOverviewStep2InlineFieldEditor({
  field,
  t,
  cardEditYear,
  manualPatchBusy,
  manualFinancials,
  setManualFinancials,
  manualPrices,
  setManualPrices,
  manualVolumes,
  setManualVolumes,
  markManualFieldTouched,
  setInlineCardFieldRef,
  handleInlineCardKeyDown,
  isInlineCardDirty,
  saveInlineCardEdit,
  dismissInlineCardEditor,
}: RenderStep2InlineFieldEditorParams): React.ReactNode {
  const actionButtons = (
    <div className="v2-inline-field-editor-actions">
      <button
        type="button"
        className="v2-btn v2-btn-small v2-btn-primary"
        onClick={() => void saveInlineCardEdit(false)}
        disabled={manualPatchBusy || !isInlineCardDirty}
        title={
          !isInlineCardDirty
            ? t(
                'v2Overview.manualPatchNoChanges',
                'No changes detected. Update at least one field before saving.',
              )
            : undefined
        }
      >
        {manualPatchBusy
          ? t('common.loading', 'Loading...')
          : t('v2Overview.manualPatchSave', 'Save year data')}
      </button>
      <button
        type="button"
        className="v2-btn v2-btn-small"
        onClick={() => dismissInlineCardEditor(true)}
        disabled={manualPatchBusy}
      >
        {t('common.close', 'Close')}
      </button>
    </div>
  );

  const wrapEditor = (children: React.ReactNode) => (
    <div
      className="v2-inline-field-editor"
      onKeyDown={handleInlineCardKeyDown}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      {actionButtons}
    </div>
  );

  switch (field) {
    case 'liikevaihto':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualFinancialRevenue', 'Revenue (Liikevaihto)')}
          </span>
          <input
            ref={setInlineCardFieldRef('liikevaihto')}
            name={`inline-liikevaihto-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.liikevaihto}
            onChange={(event) => {
              markManualFieldTouched('liikevaihto');
              setManualFinancials((prev) => ({
                ...prev,
                liikevaihto: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'perusmaksuYhteensa':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t(
              'v2Overview.manualFinancialFixedRevenue',
              'Fixed revenue total',
            )}
          </span>
          <input
            ref={setInlineCardFieldRef('perusmaksuYhteensa')}
            name={`inline-perusmaksuYhteensa-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.perusmaksuYhteensa}
            onChange={(event) => {
              markManualFieldTouched('perusmaksuYhteensa');
              setManualFinancials((prev) => ({
                ...prev,
                perusmaksuYhteensa: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'aineetJaPalvelut':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualFinancialMaterials', 'Materials and services')}
          </span>
          <input
            ref={setInlineCardFieldRef('aineetJaPalvelut')}
            name={`inline-aineetJaPalvelut-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.aineetJaPalvelut}
            onChange={(event) => {
              markManualFieldTouched('aineetJaPalvelut');
              setManualFinancials((prev) => ({
                ...prev,
                aineetJaPalvelut: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'henkilostokulut':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualFinancialPersonnel', 'Personnel costs')}
          </span>
          <input
            ref={setInlineCardFieldRef('henkilostokulut')}
            name={`inline-henkilostokulut-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.henkilostokulut}
            onChange={(event) => {
              markManualFieldTouched('henkilostokulut');
              setManualFinancials((prev) => ({
                ...prev,
                henkilostokulut: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'poistot':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualFinancialDepreciation', 'Depreciation')}
          </span>
          <input
            ref={setInlineCardFieldRef('poistot')}
            name={`inline-poistot-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.poistot}
            onChange={(event) => {
              markManualFieldTouched('poistot');
              setManualFinancials((prev) => ({
                ...prev,
                poistot: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'liiketoiminnanMuutKulut':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualFinancialOtherOpex', 'Other operating costs')}
          </span>
          <input
            ref={setInlineCardFieldRef('liiketoiminnanMuutKulut')}
            name={`inline-liiketoiminnanMuutKulut-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.01"
            value={manualFinancials.liiketoiminnanMuutKulut}
            onChange={(event) => {
              markManualFieldTouched('liiketoiminnanMuutKulut');
              setManualFinancials((prev) => ({
                ...prev,
                liiketoiminnanMuutKulut: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'tilikaudenYliJaama':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t(
              'v2Overview.manualFinancialYearResult',
              'Year result (Tilikauden ylijäämä/alijäämä)',
            )}
          </span>
          <input
            ref={setInlineCardFieldRef('tilikaudenYliJaama')}
            name={`inline-tilikaudenYliJaama-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            step="0.01"
            value={manualFinancials.tilikaudenYliJaama}
            onChange={(event) => {
              markManualFieldTouched('tilikaudenYliJaama');
              setManualFinancials((prev) => ({
                ...prev,
                tilikaudenYliJaama: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'waterUnitPrice':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualPriceWater', 'Water unit price (EUR/m3)')}
          </span>
          <input
            ref={setInlineCardFieldRef('waterUnitPrice')}
            name={`inline-waterUnitPrice-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.001"
            value={manualPrices.waterUnitPrice}
            onChange={(event) => {
              markManualFieldTouched('waterUnitPrice');
              setManualPrices((prev) => ({
                ...prev,
                waterUnitPrice: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'wastewaterUnitPrice':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualPriceWastewater', 'Wastewater unit price (EUR/m3)')}
          </span>
          <input
            ref={setInlineCardFieldRef('wastewaterUnitPrice')}
            name={`inline-wastewaterUnitPrice-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="0.001"
            value={manualPrices.wastewaterUnitPrice}
            onChange={(event) => {
              markManualFieldTouched('wastewaterUnitPrice');
              setManualPrices((prev) => ({
                ...prev,
                wastewaterUnitPrice: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'soldWaterVolume':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualVolumeWater', 'Sold water volume (m3)')}
          </span>
          <input
            ref={setInlineCardFieldRef('soldWaterVolume')}
            name={`inline-soldWaterVolume-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="1"
            value={manualVolumes.soldWaterVolume}
            onChange={(event) => {
              markManualFieldTouched('soldWaterVolume');
              setManualVolumes((prev) => ({
                ...prev,
                soldWaterVolume: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
    case 'soldWastewaterVolume':
      return wrapEditor(
        <label className="v2-inline-field-editor-control">
          <span className="v2-inline-field-editor-label">
            {t('v2Overview.manualVolumeWastewater', 'Sold wastewater volume (m3)')}
          </span>
          <input
            ref={setInlineCardFieldRef('soldWastewaterVolume')}
            name={`inline-soldWastewaterVolume-${cardEditYear ?? 'year'}`}
            className="v2-input"
            type="number"
            min={0}
            step="1"
            value={manualVolumes.soldWastewaterVolume}
            onChange={(event) => {
              markManualFieldTouched('soldWastewaterVolume');
              setManualVolumes((prev) => ({
                ...prev,
                soldWastewaterVolume: Number(event.target.value || 0),
              }));
            }}
          />
        </label>,
      );
  }
}

type RenderYearValuePreviewParams = {
  year: number;
  t: TFunction;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  sourceLayerText: (
    layer: ReturnType<typeof buildImportYearSourceLayers>[number],
  ) => string;
  availability?: {
    financials: boolean;
    prices: boolean;
    volumes: boolean;
  };
  options?: {
    compact?: boolean;
  };
};

export function renderOverviewYearValuePreview({
  year,
  t,
  yearDataCache,
  sourceLayerText,
  availability,
  options,
}: RenderYearValuePreviewParams): React.ReactNode {
  const yearData = yearDataCache[year];
  const accountingSummary = buildImportYearSummaryRows(yearData);
  const accountingSummaryMap = new Map(accountingSummary.map((row) => [row.key, row]));
  const prices = buildPriceForm(yearData);
  const volumes = buildVolumeForm(yearData);
  const priceRows = getEffectiveRows(yearData, 'taksa');
  const waterPriceRow = priceRows.find(
    (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 1,
  );
  const wastewaterPriceRow = priceRows.find(
    (entry) => parseManualNumber((entry as any).Tyyppi_Id) === 2,
  );
  const waterVolumeRow = getEffectiveFirstRow(yearData, 'volume_vesi');
  const wastewaterVolumeRow = getEffectiveFirstRow(yearData, 'volume_jatevesi');
  const hasFinancials = availability?.financials ?? accountingSummaryMap.size > 0;
  const trustSignal = buildImportYearTrustSignal(yearData);
  const sourceLayers = buildImportYearSourceLayers(yearData);

  const summaryLabel = (key: string) => {
    if (key === 'revenue') {
      return t('v2Overview.previewAccountingRevenueLabel', 'Revenue');
    }
    if (key === 'materialsCosts') {
      return t('v2Overview.previewAccountingMaterialsLabel', 'Materials and services');
    }
    if (key === 'personnelCosts') {
      return t('v2Overview.previewAccountingPersonnelLabel', 'Personnel costs');
    }
    if (key === 'depreciation') {
      return t('v2Overview.previewAccountingDepreciationLabel', 'Depreciation');
    }
    if (key === 'otherOperatingCosts') {
      return t('v2Overview.previewAccountingOtherOpexLabel', 'Other operating costs');
    }
    return t('v2Overview.previewAccountingResultLabel', 'Result');
  };

  const exactEditedFieldLabels = getExactEditedFieldLabels({
    t,
    yearData,
    changedSummaryKeys: trustSignal.changedSummaryKeys,
    statementImportFieldSources: trustSignal.statementImport?.fieldSources,
    workbookImportFieldSources: trustSignal.workbookImport?.fieldSources,
  });
  const discrepancyNote =
    trustSignal.level === 'material'
      ? exactEditedFieldLabels.length > 0
        ? t('v2Overview.editedFieldsLabel', 'Edited: {{fields}}', {
            fields: exactEditedFieldLabels.join(', '),
          })
        : trustSignal.changedSummaryKeys.length > 0
        ? t('v2Overview.editedFieldsLabel', 'Edited: {{fields}}', {
            fields: trustSignal.changedSummaryKeys
              .map((key) => summaryLabel(key))
              .join(', '),
          })
        : null
      : null;

  const renderAccountingPreviewItem = (
    key:
      | 'revenue'
      | 'materialsCosts'
      | 'personnelCosts'
      | 'depreciation'
      | 'otherOperatingCosts'
      | 'result',
    labelKey: string,
    defaultLabel: string,
  ) => {
    const summaryRow = accountingSummaryMap.get(key);
    const value = summaryRow?.effectiveValue ?? null;
    const missing = !hasFinancials || value == null;
    const zero = !missing && value === 0;
    return (
      <div
        className={`v2-year-preview-item v2-year-preview-item-${key} ${
          missing ? 'missing' : ''
        } ${zero ? 'zero' : ''}`.trim()}
      >
        <span>{t(labelKey, defaultLabel)}</span>
        <strong
          className={`${missing ? 'v2-year-preview-missing' : ''} ${
            zero ? 'v2-year-preview-zero' : ''
          }`.trim()}
        >
          {missing
            ? t('v2Overview.previewVeetiMissingValue', 'VEETI did not provide this value')
            : formatEur(value)}
        </strong>
      </div>
    );
  };

  const secondaryStats = [
    {
      label: t('v2Overview.previewWaterPriceLabel', 'Water price'),
      missing: waterPriceRow == null,
      zero: waterPriceRow != null && prices.waterUnitPrice === 0,
      displayValue:
        waterPriceRow == null
          ? t('v2Overview.previewVeetiMissingValue', 'VEETI did not provide this value')
          : formatPrice(prices.waterUnitPrice),
    },
    {
      label: t('v2Overview.previewWastewaterPriceLabel', 'Wastewater price'),
      missing: wastewaterPriceRow == null,
      zero: wastewaterPriceRow != null && prices.wastewaterUnitPrice === 0,
      displayValue:
        wastewaterPriceRow == null
          ? t('v2Overview.previewVeetiMissingValue', 'VEETI did not provide this value')
          : formatPrice(prices.wastewaterUnitPrice),
    },
    {
      label: t('v2Overview.previewWaterVolumeLabel', 'Sold water'),
      missing: Object.keys(waterVolumeRow).length === 0,
      zero: Object.keys(waterVolumeRow).length > 0 && volumes.soldWaterVolume === 0,
      displayValue:
        Object.keys(waterVolumeRow).length === 0
          ? t('v2Overview.previewVeetiMissingValue', 'VEETI did not provide this value')
          : `${formatNumber(volumes.soldWaterVolume)} m3`,
    },
    {
      label: t('v2Overview.previewWastewaterVolumeLabel', 'Sold wastewater'),
      missing: Object.keys(wastewaterVolumeRow).length === 0,
      zero:
        Object.keys(wastewaterVolumeRow).length > 0 &&
        volumes.soldWastewaterVolume === 0,
      displayValue:
        Object.keys(wastewaterVolumeRow).length === 0
          ? t('v2Overview.previewVeetiMissingValue', 'VEETI did not provide this value')
          : `${formatNumber(volumes.soldWastewaterVolume)} m3`,
    },
  ];

  return (
    <>
      <div className={`v2-year-preview-grid ${options?.compact ? 'compact' : ''}`.trim()}>
        {renderAccountingPreviewItem(
          'revenue',
          'v2Overview.previewAccountingRevenueLabel',
          'Revenue',
        )}
        {renderAccountingPreviewItem(
          'materialsCosts',
          'v2Overview.previewAccountingMaterialsLabel',
          'Materials and services',
        )}
        {renderAccountingPreviewItem(
          'personnelCosts',
          'v2Overview.previewAccountingPersonnelLabel',
          'Personnel costs',
        )}
        {renderAccountingPreviewItem(
          'depreciation',
          'v2Overview.previewAccountingDepreciationLabel',
          'Depreciation',
        )}
        {renderAccountingPreviewItem(
          'otherOperatingCosts',
          'v2Overview.previewAccountingOtherOpexLabel',
          'Other operating costs',
        )}
        {renderAccountingPreviewItem(
          'result',
          'v2Overview.previewAccountingResultLabel',
          'Result',
        )}
      </div>
      <div className={`v2-year-card-secondary ${options?.compact ? 'compact' : ''}`.trim()}>
        <div
          className={`v2-year-card-secondary-grid ${
            options?.compact ? 'compact' : ''
          }`.trim()}
        >
          {secondaryStats.map((item) => (
            <div
              key={`${year}-${item.label}`}
              className={`v2-year-preview-item secondary ${
                item.missing ? 'missing' : ''
              } ${item.zero ? 'zero' : ''}`.trim()}
            >
              <span>{item.label}</span>
              <strong
                className={`${item.missing ? 'v2-year-preview-missing' : ''} ${
                  item.zero ? 'v2-year-preview-zero' : ''
                }`.trim()}
              >
                {item.displayValue}
              </strong>
            </div>
          ))}
        </div>
      </div>
      {!options?.compact ? (
        <>
          <div className="v2-year-source-list">
            {sourceLayers.map((layer) => (
              <span key={`${year}-${layer.key}`} className="v2-year-source-pill">
                {sourceLayerText(layer)}
              </span>
            ))}
          </div>
          {discrepancyNote ? (
            <p
              className={
                trustSignal.level === 'material'
                  ? 'v2-year-readiness-missing'
                  : 'v2-muted'
              }
            >
              {discrepancyNote}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
