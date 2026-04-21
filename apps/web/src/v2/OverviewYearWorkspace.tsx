import type { TFunction } from 'i18next';
import React from 'react';
import type { V2ImportYearDataResponse } from '../api';
import { formatEur } from './format';
import { getSourceLayerText } from './overviewLabels';
import {
  deriveAdjustedYearResult,
  numbersDiffer,
  type InlineCardField,
  type ManualFinancialForm,
  type ManualPriceForm,
  type ManualVolumeForm,
} from './overviewManualForms';
import type { MissingRequirement } from './overviewWorkflow';
import {
  DEFAULT_WORKSPACE_FIELDS,
  RESULT_FIELD,
  WORKSPACE_FIELDS,
  buildDraft,
  buildDraftSignature,
  buildEffectiveValueLookup,
  buildRawValueLookup,
  buildResultBaselineFinancials,
  getWorkspaceDraftFieldValue,
  getWorkspaceFieldId,
  type ReviewStatusRow,
  type WorkspaceDraft,
  type WorkspaceSaveState,
  type WorkspaceTouchedFields,
} from './overviewYearWorkspaceModel';
import type { ManualPatchMode } from './useOverviewManualPatchEditor';
import { buildImportYearSourceLayers } from './yearReview';
type Props = {
  t: TFunction;
  reviewStatusRows: ReviewStatusRow[];
  activeYear: number | null;
  workspaceYears: number[];
  openedDecisionYear?: number | null;
  hideSelectionControlsWhenEmpty?: boolean;
  onTogglePinnedYear: (year: number) => void;
  yearDataCache: Record<number, V2ImportYearDataResponse>;
  sourceStatusClassName: (status: string | undefined) => string;
  sourceStatusLabel: (status: string | undefined) => string;
  missingRequirementLabel: (
    requirement: MissingRequirement,
    options?: {
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    },
  ) => string;
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
    explicitMissing?: {
      financials: boolean;
      prices: boolean;
      volumes: boolean;
      financialFields?: Array<keyof ManualFinancialForm>;
    };
    syncAfterSave?: boolean;
  }) => Promise<{ yearData: V2ImportYearDataResponse }>;
  busy?: boolean;
};
export const OverviewYearWorkspace: React.FC<Props> = ({
  t,
  reviewStatusRows,
  activeYear,
  workspaceYears,
  openedDecisionYear = null,
  hideSelectionControlsWhenEmpty = false,
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
  const [touchedFields, setTouchedFields] =
    React.useState<WorkspaceTouchedFields>({});
  const [resultOverrideYears, setResultOverrideYears] = React.useState<
    Record<number, boolean>
  >({});
  const [saveState, setSaveState] = React.useState<Record<number, WorkspaceSaveState>>(
    {},
  );
  const pinnedRows = React.useMemo(
    () =>
      workspaceYears
        .map((year) => reviewStatusRows.find((row) => row.year === year) ?? null)
        .filter((row): row is ReviewStatusRow => row != null),
    [reviewStatusRows, workspaceYears],
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
  const getExplicitMissingGroups = React.useCallback(
    (year: number, draft: WorkspaceDraft | undefined) => {
      const emptyGroups = {
        financials: false,
        prices: false,
        volumes: false,
        financialFields: [] as Array<keyof ManualFinancialForm>,
      };
      if (!draft) {
        return emptyGroups;
      }
      const yearTouchedFields = touchedFields[year];
      if (!yearTouchedFields) {
        return emptyGroups;
      }
      const yearData = yearDataCache[year];
      const rawValues = buildRawValueLookup(yearData);
      const effectiveValues = buildEffectiveValueLookup(yearData);
      const explicitMissing = { ...emptyGroups };
      for (const field of WORKSPACE_FIELDS) {
        const fieldId = getWorkspaceFieldId(field);
        if (yearTouchedFields[fieldId] !== true) {
          continue;
        }
        const fieldKey = field.key as keyof typeof rawValues;
        if (
          rawValues[fieldKey] == null &&
          effectiveValues[fieldKey] == null &&
          getWorkspaceDraftFieldValue(draft, field) === 0
        ) {
          explicitMissing[field.group] = true;
          if (field.group === 'financials') {
            explicitMissing.financialFields.push(
              field.key as keyof ManualFinancialForm,
            );
          }
        }
      }
      return explicitMissing;
    },
    [touchedFields, yearDataCache],
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
        const explicitMissing = getExplicitMissingGroups(year, draft);
        const result = await saveYear({
          year,
          financials: draft.financials,
          prices: draft.prices,
          volumes: draft.volumes,
          explicitMissing,
          syncAfterSave,
        });
        setDrafts((prev) => ({
          ...prev,
          [year]: buildDraft(result.yearData),
        }));
        setTouchedFields((prev) => {
          if (!(year in prev)) {
            return prev;
          }
          const next = { ...prev };
          delete next[year];
          return next;
        });
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
    [drafts, getExplicitMissingGroups, saveYear, t],
  );
  const hasExplicitMissingEntry = React.useCallback(
    (year: number, draft: WorkspaceDraft | undefined) => {
      const explicitMissing = getExplicitMissingGroups(year, draft);
      return (
        explicitMissing.financials ||
        explicitMissing.prices ||
        explicitMissing.volumes
      );
    },
    [getExplicitMissingGroups],
  );
  const showYearDecisionActions = React.useMemo(
    () =>
      pinnedRows.some((row) => {
        const draft = drafts[row.year];
        const saveStateEntry = saveState[row.year];
        return (
          saveStateEntry?.saving === true ||
          saveStateEntry?.error != null ||
          (draft != null && (draft.dirty || hasExplicitMissingEntry(row.year, draft)))
        );
      }),
    [drafts, hasExplicitMissingEntry, pinnedRows, saveState],
  );
  if (reviewStatusRows.length === 0) {
    return null;
  }

  const showSelectionControls =
    !hideSelectionControlsWhenEmpty || pinnedRows.length > 0;

  return (
    <section className="v2-overview-year-workspace">
      {showSelectionControls ? (
        <div
          className="v2-year-select"
          role="group"
          aria-label={t('v2Overview.selectedYearsLabel')}
        >
          {reviewStatusRows.map((row) => (
            <label
              key={`workspace-toggle-${row.year}`}
              data-review-workspace-toggle={row.year}
              className={activeYear === row.year ? 'v2-year-select-active' : ''}
            >
              <input
                type="checkbox"
                checked={workspaceYears.includes(row.year)}
                onChange={() => onTogglePinnedYear(row.year)}
              />
              <span>{row.year}</span>
            </label>
          ))}
        </div>
      ) : null}

      {pinnedRows.length === 0 && showSelectionControls ? (
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
            const yearData = yearDataCache[row.year];
            const yearBusy = busy || saveState[row.year]?.saving === true;
            const prefersFixPrimary = row.setupStatus === 'needs_attention';
            const isDecisionYearOpen = openedDecisionYear === row.year;
            const sourceLayers = buildImportYearSourceLayers(yearData).filter(
              (layer) => layer.source !== 'none',
            );
            return (
              <div
                key={`workspace-head-${row.year}`}
                className={`v2-overview-year-workspace-year ${row.setupStatus}${
                  isDecisionYearOpen ? ' decision-open' : ''
                }`}
                data-review-workspace-year={row.year}
              >
                <div className="v2-overview-year-workspace-year-head">
                  <strong>{`${row.year}:`}</strong>
                  {!isDecisionYearOpen ? (
                    <span
                      className={`v2-badge ${sourceStatusClassName(row.sourceStatus)}`}
                    >
                      {sourceStatusLabel(row.sourceStatus)}
                    </span>
                  ) : null}
                </div>
                {!isDecisionYearOpen && row.missingRequirements.length > 0 ? (
                  <p className="v2-muted v2-overview-year-workspace-year-note">
                    {row.missingRequirements
                      .map((requirement) =>
                        missingRequirementLabel(requirement, {
                          tariffRevenueReason: row.tariffRevenueReason,
                        }),
                      )
                      .join(', ')}
                  </p>
                ) : null}
                {!isDecisionYearOpen && sourceLayers.length > 0 ? (
                  <div className="v2-overview-year-workspace-year-provenance">
                    {sourceLayers.map((layer) => (
                      <p
                        key={`${row.year}-${layer.key}`}
                        className="v2-muted v2-overview-year-workspace-year-note"
                      >
                        {getSourceLayerText(t, layer)}
                      </p>
                    ))}
                  </div>
                ) : null}
                {saveState[row.year]?.error ? (
                  <p className="v2-year-reason">{saveState[row.year]?.error}</p>
                ) : null}
                {!isDecisionYearOpen ? (
                  <>
                    <div className="v2-overview-year-workspace-year-actions v2-overview-year-workspace-year-actions-primary">
                      {prefersFixPrimary ? (
                        <button
                          type="button"
                          className="v2-btn v2-btn-small v2-btn-primary"
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
                      ) : (
                        <button
                          type="button"
                          className="v2-btn v2-btn-small v2-btn-primary"
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
                      )}
                    </div>
                    <div className="v2-overview-year-workspace-year-actions v2-overview-year-workspace-year-actions-secondary">
                      <button
                        type="button"
                        className="v2-btn v2-btn-small v2-btn-quiet"
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
                        className="v2-btn v2-btn-small v2-btn-quiet"
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
                  </>
                ) : null}
                {!draft ? (
                  <p className="v2-muted">{t('common.loading', 'Loading...')}</p>
                ) : null}
              </div>
            );
          })}

          {DEFAULT_WORKSPACE_FIELDS.map((field) => (
            <React.Fragment key={`${field.group}-${field.key}`}>
              <div className="v2-overview-year-workspace-field">
                <strong>{t(field.labelKey, field.defaultLabel)}</strong>
              </div>
              {pinnedRows.map((row) => {
                const draft = drafts[row.year];
                const yearData = yearDataCache[row.year];
                const rawValues = buildRawValueLookup(yearData);
                const effectiveValues = buildEffectiveValueLookup(yearData);
                const yearBusy = busy || saveState[row.year]?.saving === true;
                const rawValue = rawValues[field.key as keyof typeof rawValues];
                const effectiveValue =
                  effectiveValues[field.key as keyof typeof effectiveValues];
                const fieldId = getWorkspaceFieldId(field);
                const currentValue =
                  draft == null
                    ? ''
                    : getWorkspaceDraftFieldValue(draft, field);
                const fieldTouched =
                  touchedFields[row.year]?.[fieldId] === true;
                const displayValue =
                  rawValue == null &&
                  effectiveValue == null &&
                  currentValue === 0 &&
                  !fieldTouched
                    ? ''
                    : currentValue;

                return (
                  <div
                    key={`${row.year}-${field.group}-${field.key}`}
                    className="v2-overview-year-workspace-cell"
                  >
                    {draft ? (
                      <div className="v2-overview-year-workspace-value-row">
                        <label className="v2-overview-year-workspace-input">
                          <input
                            className="v2-input"
                            type="number"
                            min={field.min}
                            step={field.step}
                            value={displayValue}
                            placeholder={t(
                              'v2Overview.previewMissingValue',
                              'Missing data',
                            )}
                            aria-label={`${t(field.labelKey, field.defaultLabel)} ${row.year}`}
                            onChange={(event) => {
                              setTouchedFields((prev) => ({
                                ...prev,
                                [row.year]: {
                                  ...(prev[row.year] ?? {}),
                                  [fieldId]: true,
                                },
                              }));
                              updateDraft(
                                row.year,
                                field.group as 'financials' | 'prices' | 'volumes',
                                field.key as never,
                                Number(event.target.value || 0),
                              );
                            }}
                            disabled={yearBusy}
                          />
                        </label>
                        <span
                          className={`v2-overview-year-workspace-reference${
                            rawValue == null ? ' is-missing' : ''
                          }`}
                        >
                          <span>{t('v2Overview.sourceVeeti', 'VEETI')}</span>
                          <strong>
                            {rawValue == null
                              ? t('v2Overview.previewMissingValue', 'Missing data')
                              : field.formatter(rawValue)}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <span className="v2-muted">{t('common.loading', 'Loading...')}</span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}

          <div className="v2-overview-year-workspace-field">
            <strong>{t(RESULT_FIELD.labelKey, RESULT_FIELD.defaultLabel)}</strong>
          </div>
          {pinnedRows.map((row) => {
            const draft = drafts[row.year];
            const yearData = yearDataCache[row.year];
            const yearBusy = busy || saveState[row.year]?.saving === true;
            const rawValues = buildRawValueLookup(yearData);
            const rawResult = rawValues.tilikaudenYliJaama;
            const baseFinancials = buildResultBaselineFinancials(yearData);
            const computedResult =
              draft != null
                ? deriveAdjustedYearResult(baseFinancials, draft.financials)
                : null;
            const storedResult = draft?.financials.tilikaudenYliJaama ?? null;
            const hasStoredOverride =
              computedResult != null &&
              storedResult != null &&
              numbersDiffer(storedResult, computedResult);
            const showResultOverride =
              resultOverrideYears[row.year] === true || hasStoredOverride;
            const fieldId = getWorkspaceFieldId(RESULT_FIELD);
            const fieldTouched = touchedFields[row.year]?.[fieldId] === true;
            const displayValue =
              storedResult == null &&
              computedResult == null &&
              !fieldTouched
                ? ''
                : storedResult ?? '';

            return (
              <div
                key={`${row.year}-financials-derived-result`}
                className="v2-overview-year-workspace-cell"
              >
                <div
                  className={`v2-overview-year-result-block ${
                    hasStoredOverride ? 'override-active' : ''
                  }`.trim()}
                >
                  <div className="v2-overview-year-result-main">
                    <strong>
                      {computedResult == null
                        ? t('v2Overview.previewMissingValue', 'Missing data')
                        : formatEur(computedResult)}
                    </strong>
                    <span
                      className={`v2-overview-year-workspace-reference${
                        rawResult == null ? ' is-missing' : ''
                      }`}
                    >
                      <span>{t('v2Overview.sourceVeeti', 'VEETI')}</span>
                      <strong>
                        {rawResult == null
                          ? t('v2Overview.previewMissingValue', 'Missing data')
                          : formatEur(rawResult)}
                      </strong>
                    </span>
                  </div>
                  {hasStoredOverride ? (
                    <small className="v2-overview-year-result-warning">
                      {t(
                        'v2Overview.manualFinancialYearResultOverrideActive',
                        'The stored result differs from the derived value.',
                      )}
                    </small>
                  ) : null}
                </div>

                <div className="v2-overview-year-result-actions">
                  <button
                    type="button"
                    className="v2-btn v2-btn-small v2-btn-quiet"
                    onClick={() => {
                      if (hasStoredOverride && computedResult != null) {
                        setTouchedFields((prev) => ({
                          ...prev,
                          [row.year]: {
                            ...(prev[row.year] ?? {}),
                            [fieldId]: true,
                          },
                        }));
                        setResultOverrideYears((prev) => ({
                          ...prev,
                          [row.year]: false,
                        }));
                        updateDraft(
                          row.year,
                          'financials',
                          'tilikaudenYliJaama',
                          computedResult,
                        );
                        return;
                      }

                      setResultOverrideYears((prev) => ({
                        ...prev,
                        [row.year]: !showResultOverride,
                      }));
                    }}
                    disabled={yearBusy}
                    aria-label={`${showResultOverride && hasStoredOverride
                      ? t(
                          'v2Overview.manualFinancialYearResultResetToDerived',
                          'Use derived result',
                        )
                      : showResultOverride
                      ? t(
                          'v2Overview.manualFinancialYearResultOverrideHide',
                          'Hide result override',
                        )
                      : t(
                          'v2Overview.manualFinancialYearResultOverrideShow',
                          'Override derived result',
                        )} ${row.year}`}
                  >
                    {t(
                      showResultOverride && hasStoredOverride
                        ? 'v2Overview.manualFinancialYearResultResetToDerived'
                        : showResultOverride
                        ? 'v2Overview.manualFinancialYearResultOverrideHide'
                        : 'v2Overview.manualFinancialYearResultOverrideShow',
                      showResultOverride && hasStoredOverride
                        ? 'Use derived result'
                        : showResultOverride
                        ? 'Hide result override'
                        : 'Override derived result',
                    )}
                  </button>
                </div>

                {showResultOverride ? (
                  <label className="v2-overview-year-workspace-input">
                    <input
                      className="v2-input"
                      type="number"
                      step={RESULT_FIELD.step}
                      value={displayValue}
                      placeholder={t(
                        'v2Overview.previewMissingValue',
                        'Missing data',
                      )}
                      aria-label={`${t(
                        RESULT_FIELD.labelKey,
                        RESULT_FIELD.defaultLabel,
                      )} ${row.year}`}
                      onChange={(event) => {
                        setTouchedFields((prev) => ({
                          ...prev,
                          [row.year]: {
                            ...(prev[row.year] ?? {}),
                            [fieldId]: true,
                          },
                        }));
                        setResultOverrideYears((prev) => ({
                          ...prev,
                          [row.year]: true,
                        }));
                        updateDraft(
                          row.year,
                          'financials',
                          'tilikaudenYliJaama',
                          Number(event.target.value || 0),
                        );
                      }}
                      disabled={yearBusy}
                    />
                  </label>
                ) : null}
              </div>
            );
          })}

          {showYearDecisionActions ? (
            <>
              <div className="v2-overview-year-workspace-field">
                <strong>
                  {t('v2Overview.yearDecisionAction', 'Review year decisions')}
                </strong>
              </div>

              {pinnedRows.map((row) => {
                const draft = drafts[row.year];
                const yearBusy = busy || saveState[row.year]?.saving === true;
                const canSaveYear =
                  draft != null &&
                  (draft.dirty || hasExplicitMissingEntry(row.year, draft));
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
                      disabled={!canSaveYear || yearBusy}
                    >
                      {yearBusy
                        ? t('common.loading', 'Loading...')
                        : t('v2Overview.manualPatchSave', 'Save year data')}
                    </button>
                    <button
                      type="button"
                      className="v2-btn v2-btn-primary"
                      aria-label={`${t(
                        'v2Overview.manualPatchSaveAndSync',
                        'Save and sync year',
                      )} ${row.year}`}
                      onClick={() => void handleSave(row.year, true)}
                      disabled={!canSaveYear || yearBusy}
                    >
                      {yearBusy
                        ? t('common.loading', 'Loading...')
                        : t(
                            'v2Overview.manualPatchSaveAndSync',
                            'Save and sync year',
                          )}
                    </button>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      </div>
      ) : null}
    </section>
  );
};
