import React from 'react';
import type { TFunction } from 'i18next';

import type { V2ImportYearDataResponse } from '../api';
import { formatEur, formatNumber, formatPrice } from './format';
import {
  buildFinancialForm,
  buildPriceForm,
  buildVolumeForm,
  getRawFirstRow,
  type InlineCardField,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import type { MissingRequirement, SetupYearStatus } from './overviewWorkflow';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';

type ReviewStatusRow = {
  year: number;
  sourceStatus: string | undefined;
  missingRequirements: MissingRequirement[];
  setupStatus: SetupYearStatus;
};

type WorkspaceDraft = {
  financials: ManualFinancialForm;
  prices: ManualPriceForm;
  volumes: ManualVolumeForm;
  baseSignature: string;
  dirty: boolean;
};

type WorkspaceSaveState = {
  saving: boolean;
  error: string | null;
};

type WorkspaceFieldConfig =
  | {
      key: keyof ManualFinancialForm;
      group: 'financials';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    }
  | {
      key: keyof ManualPriceForm;
      group: 'prices';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    }
  | {
      key: keyof ManualVolumeForm;
      group: 'volumes';
      labelKey: string;
      defaultLabel: string;
      min?: number;
      step: string;
      formatter: (value: number) => string;
    };

const WORKSPACE_FIELDS: WorkspaceFieldConfig[] = [
  {
    key: 'liikevaihto',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialRevenue',
    defaultLabel: 'Revenue (Liikevaihto)',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'perusmaksuYhteensa',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialFixedRevenue',
    defaultLabel: 'Fixed revenue total',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'aineetJaPalvelut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialMaterials',
    defaultLabel: 'Materials and services',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'henkilostokulut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialPersonnel',
    defaultLabel: 'Personnel costs',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'poistot',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialDepreciation',
    defaultLabel: 'Depreciation',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'liiketoiminnanMuutKulut',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialOtherOpex',
    defaultLabel: 'Other operating costs',
    min: 0,
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'tilikaudenYliJaama',
    group: 'financials',
    labelKey: 'v2Overview.manualFinancialYearResult',
    defaultLabel: 'Year result (Tilikauden ylijäämä/alijäämä)',
    step: '0.01',
    formatter: formatEur,
  },
  {
    key: 'waterUnitPrice',
    group: 'prices',
    labelKey: 'v2Overview.manualPriceWater',
    defaultLabel: 'Water unit price (EUR/m3)',
    min: 0,
    step: '0.001',
    formatter: formatPrice,
  },
  {
    key: 'wastewaterUnitPrice',
    group: 'prices',
    labelKey: 'v2Overview.manualPriceWastewater',
    defaultLabel: 'Wastewater unit price (EUR/m3)',
    min: 0,
    step: '0.001',
    formatter: formatPrice,
  },
  {
    key: 'soldWaterVolume',
    group: 'volumes',
    labelKey: 'v2Overview.manualVolumeWater',
    defaultLabel: 'Sold water volume (m3)',
    min: 0,
    step: '1',
    formatter: (value) => formatNumber(value, 0),
  },
  {
    key: 'soldWastewaterVolume',
    group: 'volumes',
    labelKey: 'v2Overview.manualVolumeWastewater',
    defaultLabel: 'Sold wastewater volume (m3)',
    min: 0,
    step: '1',
    formatter: (value) => formatNumber(value, 0),
  },
];

function parseOptionalNumber(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDraftSignature(
  financials: ManualFinancialForm,
  prices: ManualPriceForm,
  volumes: ManualVolumeForm,
): string {
  return JSON.stringify({
    financials,
    prices,
    volumes,
  });
}

function buildDraft(yearData: V2ImportYearDataResponse): WorkspaceDraft {
  const financials = buildFinancialForm(yearData);
  const prices = buildPriceForm(yearData);
  const volumes = buildVolumeForm(yearData);
  return {
    financials,
    prices,
    volumes,
    baseSignature: buildDraftSignature(financials, prices, volumes),
    dirty: false,
  };
}

function buildRawValueLookup(yearData: V2ImportYearDataResponse | undefined) {
  const rawFinancials = getRawFirstRow(yearData, 'tilinpaatos');
  const rawPriceRows =
    yearData?.datasets.find((dataset) => dataset.dataType === 'taksa')?.rawRows ??
    [];
  const rawWaterPrice = rawPriceRows.find(
    (row) => parseOptionalNumber((row as any).Tyyppi_Id) === 1,
  );
  const rawWastewaterPrice = rawPriceRows.find(
    (row) => parseOptionalNumber((row as any).Tyyppi_Id) === 2,
  );
  const rawWaterVolume = getRawFirstRow(yearData, 'volume_vesi');
  const rawWastewaterVolume = getRawFirstRow(yearData, 'volume_jatevesi');

  return {
    liikevaihto: parseOptionalNumber((rawFinancials as any).Liikevaihto),
    perusmaksuYhteensa: parseOptionalNumber((rawFinancials as any).PerusmaksuYhteensa),
    aineetJaPalvelut: parseOptionalNumber((rawFinancials as any).AineetJaPalvelut),
    henkilostokulut: parseOptionalNumber((rawFinancials as any).Henkilostokulut),
    poistot: parseOptionalNumber((rawFinancials as any).Poistot),
    liiketoiminnanMuutKulut: parseOptionalNumber(
      (rawFinancials as any).LiiketoiminnanMuutKulut,
    ),
    tilikaudenYliJaama: parseOptionalNumber((rawFinancials as any).TilikaudenYliJaama),
    waterUnitPrice: parseOptionalNumber((rawWaterPrice as any)?.Kayttomaksu),
    wastewaterUnitPrice: parseOptionalNumber(
      (rawWastewaterPrice as any)?.Kayttomaksu,
    ),
    soldWaterVolume: parseOptionalNumber((rawWaterVolume as any).Maara),
    soldWastewaterVolume: parseOptionalNumber(
      (rawWastewaterVolume as any).Maara,
    ),
  };
}

type Props = {
  t: TFunction;
  reviewStatusRows: ReviewStatusRow[];
  pinnedYears: number[];
  onTogglePinnedYear: (year: number) => void;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  sourceStatusClassName: (status: string | undefined) => string;
  sourceStatusLabel: (status: string | undefined) => string;
  missingRequirementLabel: (requirement: MissingRequirement) => string;
  openInlineCardEditor: (
    year: number,
    focusField: InlineCardField | null,
    context?: 'step2' | 'step3',
    missing?: MissingRequirement[],
    mode?: ManualPatchMode,
  ) => Promise<void> | void;
  saveYear: (params: {
    year: number;
    financials: ManualFinancialForm;
    prices: ManualPriceForm;
    volumes: ManualVolumeForm;
    syncAfterSave?: boolean;
  }) => Promise<{ yearData: V2ImportYearDataResponse }>;
  busy?: boolean;
};

export const OverviewYearWorkspace: React.FC<Props> = ({
  t,
  reviewStatusRows,
  pinnedYears,
  onTogglePinnedYear,
  yearDataCache,
  sourceStatusClassName,
  sourceStatusLabel,
  missingRequirementLabel,
  openInlineCardEditor,
  saveYear,
  busy = false,
}) => {
  const [drafts, setDrafts] = React.useState<Record<number, WorkspaceDraft>>({});
  const [saveState, setSaveState] = React.useState<Record<number, WorkspaceSaveState>>(
    {},
  );
  const pinnedRows = React.useMemo(
    () =>
      pinnedYears
        .map((year) => reviewStatusRows.find((row) => row.year === year) ?? null)
        .filter((row): row is ReviewStatusRow => row != null),
    [pinnedYears, reviewStatusRows],
  );

  React.useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const row of reviewStatusRows) {
        const yearData = yearDataCache[row.year];
        if (!yearData) {
          continue;
        }
        const baseDraft = buildDraft(yearData);
        const currentDraft = next[row.year];
        if (
          !currentDraft ||
          (!currentDraft.dirty && currentDraft.baseSignature !== baseDraft.baseSignature)
        ) {
          next[row.year] = baseDraft;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [reviewStatusRows, yearDataCache]);

  const updateDraft = React.useCallback(
    <T extends 'financials' | 'prices' | 'volumes'>(
      year: number,
      group: T,
      key:
        T extends 'financials'
          ? keyof ManualFinancialForm
          : T extends 'prices'
          ? keyof ManualPriceForm
          : keyof ManualVolumeForm,
      value: number,
    ) => {
      setDrafts((prev) => {
        const current = prev[year];
        if (!current) {
          return prev;
        }
        const next = {
          ...current,
          [group]: {
            ...current[group],
            [key]: value,
          },
        } as WorkspaceDraft;
        next.dirty =
          buildDraftSignature(next.financials, next.prices, next.volumes) !==
          next.baseSignature;
        return {
          ...prev,
          [year]: next,
        };
      });
    },
    [],
  );

  const handleSave = React.useCallback(
    async (year: number, syncAfterSave: boolean) => {
      const draft = drafts[year];
      if (!draft) {
        return;
      }
      setSaveState((prev) => ({
        ...prev,
        [year]: { saving: true, error: null },
      }));
      try {
        const result = await saveYear({
          year,
          financials: draft.financials,
          prices: draft.prices,
          volumes: draft.volumes,
          syncAfterSave,
        });
        setDrafts((prev) => ({
          ...prev,
          [year]: buildDraft(result.yearData),
        }));
        setSaveState((prev) => ({
          ...prev,
          [year]: { saving: false, error: null },
        }));
      } catch (error) {
        setSaveState((prev) => ({
          ...prev,
          [year]: {
            saving: false,
            error:
              error instanceof Error
                ? error.message
                : t(
                    'v2Overview.manualPatchFailed',
                    'Manual year completion failed.',
                  ),
          },
        }));
      }
    },
    [drafts, saveYear, t],
  );

  if (reviewStatusRows.length === 0) {
    return null;
  }

  return (
    <section className="v2-overview-year-workspace">
      <div className="v2-year-select" aria-label={t('v2Overview.selectedYearsLabel')}>
        {reviewStatusRows.map((row) => (
          <label
            key={`workspace-toggle-${row.year}`}
            data-review-workspace-toggle={row.year}
          >
            <input
              type="checkbox"
              checked={pinnedYears.includes(row.year)}
              onChange={() => onTogglePinnedYear(row.year)}
            />
            <span>{row.year}</span>
          </label>
        ))}
      </div>

      {pinnedRows.length === 0 ? (
        <div className="v2-empty-state">
          <p>{t('v2Overview.noYearsSelected', 'None selected')}</p>
        </div>
      ) : null}

      {pinnedRows.length > 0 ? (
      <div className="v2-overview-year-workspace-scroll">
        <div
          className="v2-overview-year-workspace-grid"
          style={{
            gridTemplateColumns: `minmax(200px, 240px) repeat(${pinnedRows.length}, minmax(220px, 1fr))`,
          }}
        >
          <div className="v2-overview-year-workspace-corner">
            {t('v2Overview.selectedYearsLabel', 'Selected years')}
          </div>

          {pinnedRows.map((row) => {
            const draft = drafts[row.year];
            const yearBusy = busy || saveState[row.year]?.saving === true;
            return (
              <div
                key={`workspace-head-${row.year}`}
                className={`v2-overview-year-workspace-year ${row.setupStatus}`}
                data-review-workspace-year={row.year}
              >
                <div className="v2-overview-year-workspace-year-head">
                  <strong>{`${row.year}:`}</strong>
                  <span
                    className={`v2-badge ${sourceStatusClassName(row.sourceStatus)}`}
                  >
                    {sourceStatusLabel(row.sourceStatus)}
                  </span>
                </div>
                {row.missingRequirements.length > 0 ? (
                  <p className="v2-muted v2-overview-year-workspace-year-note">
                    {row.missingRequirements
                      .map((requirement) => missingRequirementLabel(requirement))
                      .join(', ')}
                  </p>
                ) : null}
                {saveState[row.year]?.error ? (
                  <p className="v2-year-reason">{saveState[row.year]?.error}</p>
                ) : null}
                <div className="v2-overview-year-workspace-year-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    aria-label={`${t(
                      'v2Overview.openReviewYearButton',
                      'Avaa ja tarkista',
                    )} ${row.year}`}
                    onClick={() =>
                      void openInlineCardEditor(
                        row.year,
                        null,
                        'step3',
                        row.missingRequirements,
                      )
                    }
                    disabled={yearBusy}
                  >
                    {t('v2Overview.openReviewYearButton', 'Avaa ja tarkista')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    aria-label={`${t('v2Overview.fixYearValues')} ${row.year}`}
                    onClick={() =>
                      void openInlineCardEditor(
                        row.year,
                        null,
                        'step3',
                        row.missingRequirements,
                        'manualEdit',
                      )
                    }
                    disabled={yearBusy}
                  >
                    {t('v2Overview.fixYearValues')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    aria-label={`${t(
                      'v2Overview.documentImportAction',
                      'Import source PDF',
                    )} ${row.year}`}
                    onClick={() =>
                      void openInlineCardEditor(
                        row.year,
                        null,
                        'step3',
                        row.missingRequirements,
                        'documentImport',
                      )
                    }
                    disabled={yearBusy}
                  >
                    {t('v2Overview.documentImportAction', 'Import source PDF')}
                  </button>
                  <button
                    type="button"
                    className="v2-btn v2-btn-small"
                    aria-label={`${t(
                      'v2Overview.workbookImportAction',
                      'Import KVA workbook',
                    )} ${row.year}`}
                    onClick={() =>
                      void openInlineCardEditor(
                        row.year,
                        null,
                        'step3',
                        row.missingRequirements,
                        'workbookImport',
                      )
                    }
                    disabled={yearBusy}
                  >
                    {t('v2Overview.workbookImportAction', 'Import KVA workbook')}
                  </button>
                </div>
                {!draft ? (
                  <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
                ) : null}
              </div>
            );
          })}

          {WORKSPACE_FIELDS.map((field) => (
            <React.Fragment key={`${field.group}-${field.key}`}>
              <div className="v2-overview-year-workspace-field">
                <strong>{t(field.labelKey, field.defaultLabel)}</strong>
              </div>
              {pinnedRows.map((row) => {
                const draft = drafts[row.year];
                const yearData = yearDataCache[row.year];
                const rawValues = buildRawValueLookup(yearData);
                const yearBusy = busy || saveState[row.year]?.saving === true;
                const rawValue = rawValues[field.key as keyof typeof rawValues];
                const currentValue =
                  draft == null
                    ? ''
                    : field.group === 'financials'
                    ? draft.financials[field.key as keyof ManualFinancialForm]
                    : field.group === 'prices'
                    ? draft.prices[field.key as keyof ManualPriceForm]
                    : draft.volumes[field.key as keyof ManualVolumeForm];

                return (
                  <div
                    key={`${row.year}-${field.group}-${field.key}`}
                    className="v2-overview-year-workspace-cell"
                  >
                    {draft ? (
                      <label className="v2-overview-year-workspace-input">
                        <input
                          className="v2-input"
                          type="number"
                          min={field.min}
                          step={field.step}
                          value={currentValue}
                          aria-label={`${t(field.labelKey, field.defaultLabel)} ${row.year}`}
                          onChange={(event) =>
                            updateDraft(
                              row.year,
                              field.group as 'financials' | 'prices' | 'volumes',
                              field.key as never,
                              Number(event.target.value || 0),
                            )
                          }
                          disabled={yearBusy}
                        />
                      </label>
                    ) : (
                      <span className="v2-muted">{t('common.loading', 'Loading...')}</span>
                    )}
                    <small className="v2-muted">
                      {t('v2Overview.sourceVeeti', 'VEETI')}:{' '}
                      {rawValue == null
                        ? t('v2Overview.previewMissingValue', 'Missing data')
                        : field.formatter(rawValue)}
                    </small>
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          <div className="v2-overview-year-workspace-field">
            <strong>
              {t('v2Overview.yearDecisionAction', 'Review year decisions')}
            </strong>
          </div>

          {pinnedRows.map((row) => {
            const draft = drafts[row.year];
            const yearBusy = busy || saveState[row.year]?.saving === true;
            return (
              <div
                key={`workspace-save-${row.year}`}
                className="v2-overview-year-workspace-save"
              >
                <button
                  type="button"
                  className="v2-btn"
                  aria-label={`${t(
                    'v2Overview.manualPatchSave',
                    'Save year data',
                  )} ${row.year}`}
                  onClick={() => void handleSave(row.year, false)}
                  disabled={!draft?.dirty || yearBusy}
                >
                  {yearBusy
                    ? t('common.loading', 'Loading...')
                    : t('v2Overview.manualPatchSave', 'Save year data')}
                </button>
                <button
                  type="button"
                  className="v2-btn"
                  aria-label={`${t(
                    'v2Overview.manualPatchSaveAndSync',
                    'Save and sync year',
                  )} ${row.year}`}
                  onClick={() => void handleSave(row.year, true)}
                  disabled={!draft?.dirty || yearBusy}
                >
                  {yearBusy
                    ? t('common.loading', 'Loading...')
                    : t('v2Overview.manualPatchSaveAndSync', 'Save and sync year')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      ) : null}
    </section>
  );
};
