import React from 'react';
import type { TFunction } from 'i18next';

import {
  computeForecastScenarioV2,
  createForecastScenarioV2,
  createScenarioDepreciationRuleV2,
  getScenarioClassAllocationsV2,
  listScenarioDepreciationRulesV2,
  updateForecastScenarioV2,
  updateScenarioClassAllocationsV2,
  updateScenarioDepreciationRuleV2,
  type V2ForecastScenario,
  type V2YearlyInvestmentPlanRow,
} from '../api';
import {
  renderForecastInvestmentEditorRows,
  renderForecastInvestmentProgramRows,
} from './forecastInvestmentRenderers';
import {
  buildClassAllocationDraftByYear,
  clampYearlyInvestment,
  INVESTMENT_PROGRAM_GROUP_OPTION_DEFS,
  MAX_YEARLY_INVESTMENT_EUR,
  mergeSavedScenarioPreservingComputedOutputs,
  NEAR_TERM_FIELDS,
  normalizeInvestmentMappingLabel,
  parseAssumptionPercentInput,
  parseNearTermPercent,
  REVENUE_ASSUMPTION_KEYS,
  resolveInvestmentProgramTotal,
  resolveSingleMappedDepreciationClass,
  round4,
  toDepreciationRuleDraft,
  toNearTermExpenseDraftText,
  toYearlyInvestmentInput,
  validateNearTermPercent,
  type ClassAllocationDraftByYear,
  type DepreciationRuleDraft,
  type NearTermExpenseDraftText,
  type NearTermExpenseRow,
  type NearTermField,
  type NearTermValidationCode,
  type NearTermValidationErrors,
  type RiskPresetDefinition,
} from './forecastModel';
import { buildRiskPresetUpdate } from './riskScenario';

export type UseForecastInvestmentControllerParams = {
  t: TFunction;
  scenario: V2ForecastScenario | null;
  selectedScenarioId: string | null;
  draftName: string;
  setDraftName: React.Dispatch<React.SetStateAction<string>>;
  draftAssumptions: Record<string, number>;
  setDraftAssumptions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  draftInvestments: V2YearlyInvestmentPlanRow[];
  setDraftInvestments: React.Dispatch<React.SetStateAction<V2YearlyInvestmentPlanRow[]>>;
  draftNearTermExpenseAssumptions: NearTermExpenseRow[];
  setDraftNearTermExpenseAssumptions: React.Dispatch<
    React.SetStateAction<NearTermExpenseRow[]>
  >;
  nearTermExpenseDraftText: NearTermExpenseDraftText;
  setNearTermExpenseDraftText: React.Dispatch<
    React.SetStateAction<NearTermExpenseDraftText>
  >;
  depreciationRuleDrafts: DepreciationRuleDraft[];
  setDepreciationRuleDrafts: React.Dispatch<
    React.SetStateAction<DepreciationRuleDraft[]>
  >;
  savedDepreciationRuleDrafts: DepreciationRuleDraft[];
  setSavedDepreciationRuleDrafts: React.Dispatch<
    React.SetStateAction<DepreciationRuleDraft[]>
  >;
  classAllocationDraftByYear: ClassAllocationDraftByYear;
  setClassAllocationDraftByYear: React.Dispatch<
    React.SetStateAction<ClassAllocationDraftByYear>
  >;
  savedClassAllocationDraftByYear: ClassAllocationDraftByYear;
  setSavedClassAllocationDraftByYear: React.Dispatch<
    React.SetStateAction<ClassAllocationDraftByYear>
  >;
  loadingDepreciation: boolean;
  depreciationFeatureEnabled: boolean;
  hasUnsavedChanges: boolean;
  revenueAssumptionsChanged: boolean;
  setActiveOperation: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInfo: React.Dispatch<React.SetStateAction<string | null>>;
  updateScenarioSummary: (updated: V2ForecastScenario) => void;
  markScenarioAsNeedsRecompute: () => void;
  loadScenarioList: (preferredId?: string, forceRefresh?: boolean) => Promise<void>;
  mapKnownForecastError: (
    err: unknown,
    fallbackKey: string,
    fallbackText: string,
  ) => string;
};

export function useForecastInvestmentController({
  t,
  scenario,
  selectedScenarioId,
  draftName,
  setDraftName,
  draftAssumptions,
  setDraftAssumptions,
  draftInvestments,
  setDraftInvestments,
  draftNearTermExpenseAssumptions,
  setDraftNearTermExpenseAssumptions,
  nearTermExpenseDraftText,
  setNearTermExpenseDraftText,
  depreciationRuleDrafts,
  setDepreciationRuleDrafts,
  savedDepreciationRuleDrafts,
  setSavedDepreciationRuleDrafts,
  classAllocationDraftByYear,
  setClassAllocationDraftByYear,
  savedClassAllocationDraftByYear,
  setSavedClassAllocationDraftByYear,
  loadingDepreciation,
  depreciationFeatureEnabled,
  hasUnsavedChanges,
  revenueAssumptionsChanged,
  setActiveOperation,
  setError,
  setInfo,
  updateScenarioSummary,
  markScenarioAsNeedsRecompute,
  loadScenarioList,
  mapKnownForecastError,
}: UseForecastInvestmentControllerParams) {
  const handleRevenueAssumptionChange = React.useCallback(
    (key: (typeof REVENUE_ASSUMPTION_KEYS)[number], rawValue: string) => {
      setDraftAssumptions((prev) => ({
        ...prev,
        [key]: parseAssumptionPercentInput(rawValue),
      }));
    },
    [setDraftAssumptions],
  );

  const investmentSummary = React.useMemo(() => {
    if (draftInvestments.length === 0) {
      return {
        peakAnnualAmount: 0,
        peakYears: [] as number[],
        strongestFiveYearTotal: 0,
        strongestFiveYearRange: null as { startYear: number; endYear: number } | null,
      };
    }

    let peakAnnualAmount = 0;
    const peakYears: number[] = [];
    for (const row of draftInvestments) {
      if (row.amount > peakAnnualAmount) {
        peakAnnualAmount = row.amount;
      }
    }
    for (const row of draftInvestments) {
      if (round4(row.amount) === round4(peakAnnualAmount) && peakAnnualAmount > 0) {
        peakYears.push(row.year);
      }
    }

    let strongestFiveYearTotal = 0;
    let strongestFiveYearRange: { startYear: number; endYear: number } | null = null;
    for (let startIndex = 0; startIndex < draftInvestments.length; startIndex += 1) {
      const windowRows = draftInvestments.slice(startIndex, startIndex + 5);
      if (windowRows.length === 0) {
        continue;
      }
      const total = windowRows.reduce((sum, row) => sum + row.amount, 0);
      if (total > strongestFiveYearTotal) {
        strongestFiveYearTotal = total;
        strongestFiveYearRange = {
          startYear: windowRows[0]!.year,
          endYear: windowRows[windowRows.length - 1]!.year,
        };
      }
    }

    return {
      peakAnnualAmount,
      peakYears,
      strongestFiveYearTotal,
      strongestFiveYearRange,
    };
  }, [draftInvestments]);

  const nearTermInvestmentRows = React.useMemo(
    () => draftInvestments.slice(0, 5),
    [draftInvestments],
  );

  const longRangeInvestmentGroups = React.useMemo(() => {
    const groups: Array<{
      id: string;
      startYear: number;
      endYear: number;
      rows: Array<(typeof draftInvestments)[number]>;
      total: number;
      peakAmount: number;
      peakYears: number[];
    }> = [];
    const remainingRows = draftInvestments.slice(5);

    for (let index = 0; index < remainingRows.length; index += 5) {
      const rows = remainingRows.slice(index, index + 5);
      if (rows.length === 0) {
        continue;
      }
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      const peakAmount = rows.reduce((current, row) => Math.max(current, row.amount), 0);
      groups.push({
        id: `${rows[0]!.year}-${rows[rows.length - 1]!.year}`,
        startYear: rows[0]!.year,
        endYear: rows[rows.length - 1]!.year,
        rows,
        total,
        peakAmount,
        peakYears:
          peakAmount > 0
            ? rows
                .filter((row) => round4(row.amount) === round4(peakAmount))
                .map((row) => row.year)
            : [],
      });
    }

    return groups;
  }, [draftInvestments]);

  const investmentProgramGroupOptions = React.useMemo(
    () =>
      INVESTMENT_PROGRAM_GROUP_OPTION_DEFS.map((item) => t(item.key, item.fallback)),
    [t],
  );

  const suggestedDepreciationClassKeyByInvestmentGroup = React.useMemo(() => {
    const entries: Array<[string, string]> = [
      ['network', 'water_network_post_1999'],
      ['plant', 'plant_machinery'],
      ['meters', 'it_equipment'],
    ];
    const networkOptionIndexes = [0, 1, 2, 3, 4, 5];
    for (const index of networkOptionIndexes) {
      const label = investmentProgramGroupOptions[index];
      if (!label) {
        continue;
      }
      entries.push([
        normalizeInvestmentMappingLabel(label),
        'water_network_post_1999',
      ]);
    }
    if (investmentProgramGroupOptions[6]) {
      entries.push([
        normalizeInvestmentMappingLabel(investmentProgramGroupOptions[6]),
        'plant_machinery',
      ]);
    }
    if (investmentProgramGroupOptions[7]) {
      entries.push([
        normalizeInvestmentMappingLabel(investmentProgramGroupOptions[7]),
        'other_equipment',
      ]);
    }

    return new Map(entries);
  }, [investmentProgramGroupOptions]);

  const handleInvestmentChange = React.useCallback(
    (year: number, value: string) => {
      const normalized = value.trim().replace(',', '.');
      const parsed = normalized.length === 0 ? 0 : Number(normalized);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const safeAmount = clampYearlyInvestment(parsed);
      setDraftInvestments((prev) =>
        prev.map((item) =>
          item.year === year
            ? {
                ...item,
                amount: safeAmount,
                waterAmount: null,
                wastewaterAmount: null,
              }
            : item,
        ),
      );
    },
    [setDraftInvestments],
  );

  const handleInvestmentProgramAmountChange = React.useCallback(
    (
      year: number,
      field: 'waterAmount' | 'wastewaterAmount',
      value: string,
    ) => {
      const normalized = value.trim().replace(',', '.');
      if (normalized.length === 0) {
        setDraftInvestments((prev) =>
          prev.map((item) => {
            if (item.year !== year) {
              return item;
            }
            const next = {
              ...item,
              [field]: null,
            };
            return {
              ...next,
              amount: resolveInvestmentProgramTotal(next),
            };
          }),
        );
        return;
      }
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const safeAmount = clampYearlyInvestment(parsed);
      setDraftInvestments((prev) =>
        prev.map((item) => {
          if (item.year !== year) {
            return item;
          }
          const next = {
            ...item,
            [field]: safeAmount,
          };
          return {
            ...next,
            amount: resolveInvestmentProgramTotal(next),
          };
        }),
      );
    },
    [setDraftInvestments],
  );

  const handleInvestmentBlur = React.useCallback(
    (year: number) => {
      setDraftInvestments((prev) =>
        prev.map((item) =>
          item.year === year
            ? { ...item, amount: clampYearlyInvestment(item.amount) }
            : item,
        ),
      );
    },
    [setDraftInvestments],
  );

  const handleCopyFirstInvestmentToAll = React.useCallback(() => {
    setDraftInvestments((prev) => {
      const firstAmount = clampYearlyInvestment(prev[0]?.amount ?? 0);
      return prev.map((item) => ({
        ...item,
        amount: firstAmount,
        waterAmount: null,
        wastewaterAmount: null,
      }));
    });
  }, [setDraftInvestments]);

  const handleClearAllInvestments = React.useCallback(() => {
    setDraftInvestments((prev) =>
      prev.map((item) => ({
        ...item,
        amount: 0,
        waterAmount: null,
        wastewaterAmount: null,
      })),
    );
  }, [setDraftInvestments]);

  const handleRepeatNearTermInvestmentTemplate = React.useCallback(() => {
    setDraftInvestments((prev) => {
      const templateCount = Math.min(5, prev.length);
      if (templateCount === 0 || prev.length <= templateCount) {
        return prev;
      }
      return prev.map((item, index) => {
        if (index < templateCount) {
          return item;
        }
        const template = prev[index % templateCount]!;
        return {
          ...item,
          amount: template.amount,
          target: template.target ?? null,
          category: template.category ?? null,
          depreciationClassKey: template.depreciationClassKey ?? null,
          investmentType: template.investmentType ?? null,
          confidence: template.confidence ?? null,
          waterAmount: template.waterAmount ?? null,
          wastewaterAmount: template.wastewaterAmount ?? null,
          note: template.note ?? null,
        };
      });
    });
  }, [setDraftInvestments]);

  const handleInvestmentMetadataChange = React.useCallback(
    (
      year: number,
      field:
        | 'target'
        | 'category'
        | 'depreciationClassKey'
        | 'investmentType'
        | 'confidence'
        | 'note',
      value: string,
    ) => {
      setDraftInvestments((prev) =>
        prev.map((item) => {
          if (item.year !== year) {
            return item;
          }
          if (
            field === 'target' ||
            field === 'category' ||
            field === 'depreciationClassKey' ||
            field === 'note'
          ) {
            return {
              ...item,
              [field]: value.trim().length > 0 ? value : null,
            };
          }
          return {
            ...item,
            [field]: value.length > 0 ? value : null,
          };
        }),
      );
    },
    [setDraftInvestments],
  );

  const handleNearTermExpenseChange = React.useCallback(
    (year: number, field: NearTermField, rawValue: string) => {
      setNearTermExpenseDraftText((prev) => ({
        ...prev,
        [year]: {
          personnelPct: prev[year]?.personnelPct ?? '0',
          energyPct: prev[year]?.energyPct ?? '0',
          opexOtherPct: prev[year]?.opexOtherPct ?? '0',
          [field]: rawValue,
        },
      }));

      const parsed = parseNearTermPercent(rawValue);
      if (parsed == null) {
        return;
      }

      setDraftNearTermExpenseAssumptions((prev) =>
        prev.map((item) =>
          item.year === year
            ? {
                ...item,
                [field]: parsed,
              }
            : item,
        ),
      );
    },
    [setDraftNearTermExpenseAssumptions, setNearTermExpenseDraftText],
  );

  const handleNearTermExpenseBlur = React.useCallback(
    (year: number, field: NearTermField) => {
      setNearTermExpenseDraftText((prev) => {
        const row = prev[year];
        if (!row) {
          return prev;
        }
        const parsed = parseNearTermPercent(row[field]);
        const fallbackRow = draftNearTermExpenseAssumptions.find(
          (item) => item.year === year,
        );
        const normalized =
          parsed == null ? String(fallbackRow?.[field] ?? 0) : String(parsed);

        return {
          ...prev,
          [year]: {
            ...row,
            [field]: normalized,
          },
        };
      });
    },
    [draftNearTermExpenseAssumptions, setNearTermExpenseDraftText],
  );

  const nearTermInputValue = React.useCallback(
    (row: NearTermExpenseRow, field: NearTermField) =>
      nearTermExpenseDraftText[row.year]?.[field] ?? String(row[field]),
    [nearTermExpenseDraftText],
  );

  const nearTermValidationErrors = React.useMemo<NearTermValidationErrors>(() => {
    const errors: NearTermValidationErrors = {};
    for (const row of draftNearTermExpenseAssumptions) {
      for (const field of NEAR_TERM_FIELDS) {
        const code = validateNearTermPercent(nearTermInputValue(row, field));
        if (!code) {
          continue;
        }
        errors[row.year] = {
          ...(errors[row.year] ?? {}),
          [field]: code,
        };
      }
    }
    return errors;
  }, [draftNearTermExpenseAssumptions, nearTermInputValue]);

  const hasNearTermValidationErrors = React.useMemo(
    () => Object.keys(nearTermValidationErrors).length > 0,
    [nearTermValidationErrors],
  );

  const nearTermValidationMessage = React.useCallback(
    (code: NearTermValidationCode | undefined) => {
      switch (code) {
        case 'required':
          return t(
            'v2Forecast.nearTermValidationRequired',
            'Enter a percentage value.',
          );
        case 'invalid':
          return t(
            'v2Forecast.nearTermValidationInvalid',
            'Use a valid number (for example 3.5).',
          );
        case 'outOfRange':
          return t(
            'v2Forecast.nearTermValidationRange',
            'Value must be between -100 and 100.',
          );
        default:
          return null;
      }
    },
    [t],
  );

  const depreciationClassKeys = React.useMemo(
    () =>
      depreciationRuleDrafts
        .map((item) => item.assetClassKey.trim())
        .filter((key): key is string => key.length > 0),
    [depreciationRuleDrafts],
  );

  const depreciationClassOptions = React.useMemo(
    () =>
      depreciationRuleDrafts
        .map((item) => ({
          key: item.assetClassKey.trim(),
          label:
            item.assetClassName.trim().length > 0
              ? item.assetClassName.trim()
              : item.assetClassKey.trim(),
        }))
        .filter(
          (item): item is { key: string; label: string } => item.key.length > 0,
        ),
    [depreciationRuleDrafts],
  );

  const depreciationRulesUnavailable =
    depreciationFeatureEnabled &&
    !loadingDepreciation &&
    scenario != null &&
    depreciationClassOptions.length === 0;

  const depreciationRuleByKey = React.useMemo(
    () =>
      Object.fromEntries(
        depreciationRuleDrafts
          .map((item) => [item.assetClassKey.trim(), item] as const)
          .filter(([key]) => key.length > 0),
      ) as Record<string, DepreciationRuleDraft>,
    [depreciationRuleDrafts],
  );

  const formatDepreciationRuleSummary = React.useCallback(
    (ruleKey: string | null | undefined) => {
      if (!ruleKey) {
        return t('v2Forecast.investmentNeedsDepreciationRule', {
          defaultValue: 'Select a depreciation rule before saving this investment.',
        });
      }
      const rule = depreciationRuleByKey[ruleKey];
      if (!rule) {
        return t('v2Forecast.investmentMissingDepreciationRule', {
          defaultValue:
            'This investment points to a depreciation rule that is not available right now.',
        });
      }
      if (rule.method === 'none') {
        return t('v2Forecast.methodNone', 'No depreciation');
      }
      if (rule.method === 'residual') {
        return t('v2Forecast.investmentResidualSummary', 'Residual write-off {{percent}}%', {
          percent: rule.residualPercent || '0',
        });
      }
      return t(
        'v2Forecast.investmentStraightLineSummary',
        'Straight-line {{years}} years',
        {
          years: rule.linearYears || '-',
        },
      );
    },
    [depreciationRuleByKey, t],
  );

  const savedDepreciationClassKeys = React.useMemo(
    () =>
      savedDepreciationRuleDrafts
        .map((rule) => rule.assetClassKey.trim())
        .filter((key): key is string => key.length > 0),
    [savedDepreciationRuleDrafts],
  );

  const savedMappedDepreciationClassByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => [
          item.year,
          resolveSingleMappedDepreciationClass(
            savedClassAllocationDraftByYear,
            savedDepreciationClassKeys,
            item.year,
          ),
        ]),
      ) as Record<number, string | null>,
    [draftInvestments, savedClassAllocationDraftByYear, savedDepreciationClassKeys],
  );

  const savedInvestmentDepreciationSnapshotByYear = React.useMemo(
    () =>
      Object.fromEntries(
        (scenario?.yearlyInvestments ?? []).map((item) => [
          item.year,
          item.depreciationRuleSnapshot ?? null,
        ]),
      ) as Record<number, { assetClassKey: string } | null>,
    [scenario?.yearlyInvestments],
  );

  const unmappedInvestmentYears = React.useMemo(
    () =>
      draftInvestments
        .filter(
          (row) =>
            row.amount > 0 &&
            !savedInvestmentDepreciationSnapshotByYear[row.year] &&
            !savedMappedDepreciationClassByYear[row.year],
        )
        .map((row) => row.year),
    [
      draftInvestments,
      savedInvestmentDepreciationSnapshotByYear,
      savedMappedDepreciationClassByYear,
    ],
  );

  const plannedInvestmentYears = React.useMemo(
    () => draftInvestments.filter((row) => row.amount > 0).map((row) => row.year),
    [draftInvestments],
  );

  const savedMappedInvestmentYearsCount = React.useMemo(
    () =>
      plannedInvestmentYears.filter(
        (year) =>
          savedInvestmentDepreciationSnapshotByYear[year] != null ||
          savedMappedDepreciationClassByYear[year] != null,
      ).length,
    [
      plannedInvestmentYears,
      savedInvestmentDepreciationSnapshotByYear,
      savedMappedDepreciationClassByYear,
    ],
  );

  const hasIncompleteDepreciationMapping = React.useMemo(
    () => depreciationFeatureEnabled && unmappedInvestmentYears.length > 0,
    [depreciationFeatureEnabled, unmappedInvestmentYears],
  );

  const effectiveInvestmentDepreciationClassByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((row) => [
          row.year,
          row.depreciationClassKey ??
            savedMappedDepreciationClassByYear[row.year] ??
            null,
        ]),
      ) as Record<number, string | null>,
    [draftInvestments, savedMappedDepreciationClassByYear],
  );

  const invalidInvestmentDepreciationYears = React.useMemo(
    () =>
      draftInvestments
        .filter(
          (row) =>
            row.amount > 0 &&
            !effectiveInvestmentDepreciationClassByYear[row.year],
        )
        .map((row) => row.year),
    [draftInvestments, effectiveInvestmentDepreciationClassByYear],
  );

  const hasMissingDepreciationRules =
    depreciationRulesUnavailable && draftInvestments.some((row) => row.amount > 0);
  const hasInvestmentDepreciationErrors =
    invalidInvestmentDepreciationYears.length > 0 || hasMissingDepreciationRules;

  const blockedForecastActionHint = hasNearTermValidationErrors
    ? t(
        'v2Forecast.nearTermValidationSummary',
        'Fix highlighted near-term percentage fields before saving or computing.',
      )
    : hasMissingDepreciationRules
    ? t(
        'v2Forecast.depreciationRulesUnavailable',
        'Depreciation rules are missing for this scenario. Refresh the scenario before saving investment years.',
      )
    : hasInvestmentDepreciationErrors
    ? t(
        'v2Forecast.depreciationMappingBlockedHint',
        'Complete and save a depreciation rule for every investment year before creating report.',
      )
    : undefined;

  const inferredDepreciationClassKeyByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => {
          const normalizedCategory = normalizeInvestmentMappingLabel(item.category);
          const exactClassKey =
            depreciationClassKeys.find(
              (classKey) =>
                normalizeInvestmentMappingLabel(classKey) === normalizedCategory,
            ) ?? null;
          const exactClassLabel =
            depreciationClassOptions.find(
              (entry) =>
                normalizeInvestmentMappingLabel(entry.label) === normalizedCategory,
            )?.key ?? null;
          const suggestedClassKey =
            exactClassKey ??
            exactClassLabel ??
            suggestedDepreciationClassKeyByInvestmentGroup.get(normalizedCategory) ??
            null;
          const isKnownClass =
            suggestedClassKey != null && depreciationClassKeys.includes(suggestedClassKey);
          return [item.year, isKnownClass ? suggestedClassKey : null];
        }),
      ) as Record<number, string | null>,
    [
      depreciationClassKeys,
      depreciationClassOptions,
      draftInvestments,
      suggestedDepreciationClassKeyByInvestmentGroup,
    ],
  );

  const inferredDepreciationClassOptionByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => {
          const classKey = inferredDepreciationClassKeyByYear[item.year];
          const option =
            depreciationClassOptions.find((entry) => entry.key === classKey) ?? null;
          return [item.year, option];
        }),
      ) as Record<number, { key: string; label: string } | null>,
    [depreciationClassOptions, draftInvestments, inferredDepreciationClassKeyByYear],
  );

  const handleAllocationDraftChange = React.useCallback(
    (year: number, classKey: string) => {
      setClassAllocationDraftByYear((prev) => ({
        ...prev,
        [year]: Object.fromEntries(
          depreciationClassKeys.map((key) => [key, key === classKey ? '100' : '']),
        ),
      }));
    },
    [depreciationClassKeys, setClassAllocationDraftByYear],
  );

  React.useEffect(() => {
    const years = draftInvestments.map((item) => item.year);
    if (years.length === 0) {
      setClassAllocationDraftByYear({});
      return;
    }
    setClassAllocationDraftByYear((prev) => {
      const next: ClassAllocationDraftByYear = {};
      for (const year of years) {
        const existingRow = prev[year] ?? {};
        const hasExistingAllocation = Object.values(existingRow).some(
          (value) => value.trim().length > 0,
        );
        const inferredClassKey = inferredDepreciationClassKeyByYear[year];
        next[year] = Object.fromEntries(
          depreciationClassKeys.map((classKey) => {
            const existingValue = existingRow[classKey] ?? '';
            return [
              classKey,
              existingValue.trim().length > 0
                ? existingValue
                : !hasExistingAllocation && inferredClassKey === classKey
                ? '100'
                : '',
            ];
          }),
        );
      }
      return next;
    });
  }, [
    depreciationClassKeys,
    draftInvestments,
    inferredDepreciationClassKeyByYear,
    setClassAllocationDraftByYear,
  ]);

  const mappedDepreciationClassByYear = React.useMemo(
    () =>
      Object.fromEntries(
        draftInvestments.map((item) => [
          item.year,
          resolveSingleMappedDepreciationClass(
            classAllocationDraftByYear,
            depreciationClassKeys,
            item.year,
          ),
        ]),
      ) as Record<number, string | null>,
    [classAllocationDraftByYear, depreciationClassKeys, draftInvestments],
  );

  const previousSavedDepreciationClassByYear = React.useMemo(() => {
    const out: Record<number, { sourceYear: number; classKey: string } | null> = {};
    const sortedYears = draftInvestments
      .filter((item) => item.amount > 0)
      .map((item) => item.year)
      .sort((a, b) => a - b);

    for (const year of sortedYears) {
      let latestMatch: { sourceYear: number; classKey: string } | null = null;
      for (const candidateYear of sortedYears) {
        if (candidateYear >= year) {
          break;
        }
        const classKey = savedMappedDepreciationClassByYear[candidateYear];
        if (classKey) {
          latestMatch = { sourceYear: candidateYear, classKey };
        }
      }
      out[year] = latestMatch;
    }

    return out;
  }, [draftInvestments, savedMappedDepreciationClassByYear]);

  const applyCarryForwardMapping = React.useCallback(
    (year: number) => {
      const source = previousSavedDepreciationClassByYear[year];
      if (!source) {
        return;
      }
      setClassAllocationDraftByYear((prev) => ({
        ...prev,
        [year]: Object.fromEntries(
          depreciationClassKeys.map((key) => [
            key,
            key === source.classKey ? '100' : '',
          ]),
        ),
      }));
    },
    [depreciationClassKeys, previousSavedDepreciationClassByYear, setClassAllocationDraftByYear],
  );

  const saveDrafts = React.useCallback(async (): Promise<V2ForecastScenario | null> => {
    if (!scenario || !selectedScenarioId) {
      return null;
    }
    if (!hasUnsavedChanges) {
      return scenario;
    }

    const scenarioAssumptions = revenueAssumptionsChanged
      ? Object.fromEntries(
          REVENUE_ASSUMPTION_KEYS.map((key) => [key, draftAssumptions[key] ?? 0]),
        )
      : undefined;
    const effectiveDepreciationClassByYear = Object.fromEntries(
      draftInvestments.map((row) => [
        row.year,
        row.depreciationClassKey ??
          savedMappedDepreciationClassByYear[row.year] ??
          null,
      ]),
    ) as Record<number, string | null>;

    const payload = {
      name: draftName.trim() || scenario.name,
      yearlyInvestments: draftInvestments.map((row) =>
        toYearlyInvestmentInput(
          row,
          effectiveDepreciationClassByYear[row.year] ?? null,
        ),
      ),
      scenarioAssumptions,
      nearTermExpenseAssumptions: draftNearTermExpenseAssumptions,
    };
    const updated = await updateForecastScenarioV2(selectedScenarioId, payload);
    const nextScenario = mergeSavedScenarioPreservingComputedOutputs(scenario, updated);
    setDraftName(updated.name);
    setDraftAssumptions({ ...updated.assumptions });
    setDraftInvestments(updated.yearlyInvestments.map((item) => ({ ...item })));
    const nearTermDraft = updated.nearTermExpenseAssumptions.map((item) => ({ ...item }));
    setDraftNearTermExpenseAssumptions(nearTermDraft);
    setNearTermExpenseDraftText(toNearTermExpenseDraftText(nearTermDraft));
    updateScenarioSummary(nextScenario);
    return nextScenario;
  }, [
    draftAssumptions,
    draftInvestments,
    draftName,
    draftNearTermExpenseAssumptions,
    hasUnsavedChanges,
    revenueAssumptionsChanged,
    savedMappedDepreciationClassByYear,
    scenario,
    selectedScenarioId,
    setDraftAssumptions,
    setDraftInvestments,
    setDraftName,
    setDraftNearTermExpenseAssumptions,
    setNearTermExpenseDraftText,
    updateScenarioSummary,
  ]);

  const handleApplyRiskPreset = React.useCallback(
    async (preset: RiskPresetDefinition) => {
      if (!scenario || !selectedScenarioId) {
        return;
      }
      if (hasNearTermValidationErrors) {
        setError(
          t(
            'v2Forecast.nearTermValidationSummary',
            'Fix highlighted near-term percentage fields before saving or computing.',
          ),
        );
        setInfo(null);
        return;
      }

      setActiveOperation('creating');
      setError(null);
      setInfo(null);
      try {
        const saved = await saveDrafts();
        const baseScenario = saved ?? scenario;
        const createdName = `${baseScenario.name} - ${t(preset.titleKey, preset.title)}`;
        const created = await createForecastScenarioV2({
          name: createdName,
          copyFromScenarioId: selectedScenarioId,
          compute: false,
        });
        await updateForecastScenarioV2(
          created.id,
          buildRiskPresetUpdate(preset.id, baseScenario),
        );
        await computeForecastScenarioV2(created.id);
        await loadScenarioList(created.id, true);
        setInfo(
          t('v2Forecast.riskPresetCreated', 'Risk scenario "{{name}}" created.', {
            name: createdName,
          }),
        );
      } catch (err) {
        setError(
          mapKnownForecastError(
            err,
            'v2Forecast.errorRiskPresetFailed',
            'Failed to create risk scenario.',
          ),
        );
      } finally {
        setActiveOperation('idle');
      }
    },
    [
      hasNearTermValidationErrors,
      loadScenarioList,
      mapKnownForecastError,
      saveDrafts,
      scenario,
      selectedScenarioId,
      setActiveOperation,
      setError,
      setInfo,
      t,
    ],
  );

  const handleDepreciationRuleDraftChange = React.useCallback(
    (index: number, field: keyof DepreciationRuleDraft, value: string) => {
      setDepreciationRuleDrafts((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                [field]: value,
              }
            : item,
        ),
      );
    },
    [setDepreciationRuleDrafts],
  );

  const saveDepreciationRuleDraft = React.useCallback(
    async (index: number) => {
      const draft = depreciationRuleDrafts[index];
      if (!draft) {
        return;
      }
      const assetClassKey = draft.assetClassKey.trim();
      if (!assetClassKey) {
        setError(
          t(
            'v2Forecast.depreciationRuleKeyRequired',
            'Class key is required for depreciation rules.',
          ),
        );
        setInfo(null);
        return;
      }

      const linearYears = Number(draft.linearYears);
      const residualPercent = Number(draft.residualPercent);
      const payload = {
        assetClassKey,
        assetClassName: draft.assetClassName.trim() || undefined,
        method: draft.method,
        linearYears:
          draft.method === 'straight-line' && Number.isFinite(linearYears)
            ? Math.round(linearYears)
            : undefined,
        residualPercent:
          draft.method === 'residual' && Number.isFinite(residualPercent)
            ? residualPercent
            : undefined,
      };

      if (!selectedScenarioId) {
        return;
      }
      setActiveOperation('saving');
      setError(null);
      setInfo(null);
      try {
        if (draft.id) {
          await updateScenarioDepreciationRuleV2(selectedScenarioId, draft.id, payload);
        } else {
          await createScenarioDepreciationRuleV2(selectedScenarioId, payload);
        }
        const refreshed = await listScenarioDepreciationRulesV2(selectedScenarioId);
        const nextRuleDrafts = refreshed.map(toDepreciationRuleDraft);
        setDepreciationRuleDrafts(nextRuleDrafts);
        setSavedDepreciationRuleDrafts(nextRuleDrafts);
        markScenarioAsNeedsRecompute();
        setInfo(
          t('v2Forecast.depreciationRuleSaved', 'Depreciation rule saved successfully.'),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t(
                'v2Forecast.depreciationRuleSaveFailed',
                'Saving depreciation rule failed.',
              ),
        );
      } finally {
        setActiveOperation('idle');
      }
    },
    [
      depreciationRuleDrafts,
      markScenarioAsNeedsRecompute,
      selectedScenarioId,
      setActiveOperation,
      setDepreciationRuleDrafts,
      setError,
      setInfo,
      setSavedDepreciationRuleDrafts,
      t,
    ],
  );

  const saveClassAllocations = React.useCallback(async () => {
    if (!selectedScenarioId) {
      return;
    }

    const yearsPayload = draftInvestments
      .map((row) => {
        const mappedClassKey = mappedDepreciationClassByYear[row.year];
        const allocations = mappedClassKey
          ? [{ classKey: mappedClassKey, sharePct: 100 }]
          : [];
        return {
          year: row.year,
          allocations,
        };
      })
      .filter((row) => row.allocations.length > 0);

    setActiveOperation('saving');
    setError(null);
    setInfo(null);
    try {
      await updateScenarioClassAllocationsV2(selectedScenarioId, {
        years: yearsPayload,
      });
      const refreshed = await getScenarioClassAllocationsV2(selectedScenarioId);
      const nextAllocationDraft = buildClassAllocationDraftByYear(
        draftInvestments.map((item) => item.year),
        depreciationClassKeys,
        refreshed.years,
      );
      setClassAllocationDraftByYear(nextAllocationDraft);
      setSavedClassAllocationDraftByYear(nextAllocationDraft);
      markScenarioAsNeedsRecompute();
      setInfo(
        t(
          'v2Forecast.classAllocationsSaved',
          'Class allocations saved successfully.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              'v2Forecast.classAllocationsSaveFailed',
              'Saving class allocations failed.',
            ),
      );
    } finally {
      setActiveOperation('idle');
    }
  }, [
    depreciationClassKeys,
    draftInvestments,
    mappedDepreciationClassByYear,
    markScenarioAsNeedsRecompute,
    selectedScenarioId,
    setActiveOperation,
    setClassAllocationDraftByYear,
    setError,
    setInfo,
    setSavedClassAllocationDraftByYear,
    t,
  ]);

  const averageNearTermExpense = React.useMemo(() => {
    if (draftNearTermExpenseAssumptions.length === 0) {
      return {
        personnelPct: 0,
        energyPct: 0,
        opexOtherPct: 0,
      };
    }

    const total = draftNearTermExpenseAssumptions.reduce(
      (acc, row) => ({
        personnelPct: acc.personnelPct + row.personnelPct,
        energyPct: acc.energyPct + row.energyPct,
        opexOtherPct: acc.opexOtherPct + row.opexOtherPct,
      }),
      {
        personnelPct: 0,
        energyPct: 0,
        opexOtherPct: 0,
      },
    );

    return {
      personnelPct: total.personnelPct / draftNearTermExpenseAssumptions.length,
      energyPct: total.energyPct / draftNearTermExpenseAssumptions.length,
      opexOtherPct: total.opexOtherPct / draftNearTermExpenseAssumptions.length,
    };
  }, [draftNearTermExpenseAssumptions]);

  const firstNearTermExpense = React.useMemo(
    () => draftNearTermExpenseAssumptions[0] ?? null,
    [draftNearTermExpenseAssumptions],
  );

  const renderInvestmentProgramRows = React.useCallback(
    (rows: V2YearlyInvestmentPlanRow[]) =>
      renderForecastInvestmentProgramRows({
        rows,
        t,
        handleInvestmentMetadataChange,
        handleInvestmentProgramAmountChange,
        handleInvestmentChange,
        handleInvestmentBlur,
        loadingDepreciation,
        depreciationRulesUnavailable,
        effectiveInvestmentDepreciationClassByYear,
        depreciationClassOptions,
        formatDepreciationRuleSummary,
      }),
    [
      depreciationClassOptions,
      depreciationRulesUnavailable,
      effectiveInvestmentDepreciationClassByYear,
      formatDepreciationRuleSummary,
      handleInvestmentBlur,
      handleInvestmentChange,
      handleInvestmentMetadataChange,
      handleInvestmentProgramAmountChange,
      loadingDepreciation,
      t,
    ],
  );

  const renderInvestmentEditorRows = React.useCallback(
    (rows: V2YearlyInvestmentPlanRow[]) =>
      renderForecastInvestmentEditorRows({
        rows,
        t,
        handleInvestmentChange,
        handleInvestmentBlur,
        handleInvestmentMetadataChange,
      }),
    [handleInvestmentBlur, handleInvestmentChange, handleInvestmentMetadataChange, t],
  );

  return {
    handleRevenueAssumptionChange,
    saveDrafts,
    investmentSummary,
    nearTermInvestmentRows,
    longRangeInvestmentGroups,
    investmentProgramGroupOptions,
    handleInvestmentChange,
    handleInvestmentProgramAmountChange,
    handleInvestmentBlur,
    handleCopyFirstInvestmentToAll,
    handleClearAllInvestments,
    handleRepeatNearTermInvestmentTemplate,
    handleInvestmentMetadataChange,
    renderInvestmentProgramRows,
    renderInvestmentEditorRows,
    handleNearTermExpenseChange,
    handleNearTermExpenseBlur,
    nearTermInputValue,
    nearTermValidationErrors,
    hasNearTermValidationErrors,
    nearTermValidationMessage,
    handleApplyRiskPreset,
    depreciationClassKeys,
    depreciationClassOptions,
    depreciationRulesUnavailable,
    formatDepreciationRuleSummary,
    savedMappedDepreciationClassByYear,
    savedInvestmentDepreciationSnapshotByYear,
    unmappedInvestmentYears,
    plannedInvestmentYears,
    savedMappedInvestmentYearsCount,
    hasIncompleteDepreciationMapping,
    effectiveInvestmentDepreciationClassByYear,
    invalidInvestmentDepreciationYears,
    hasMissingDepreciationRules,
    hasInvestmentDepreciationErrors,
    blockedForecastActionHint,
    inferredDepreciationClassKeyByYear,
    inferredDepreciationClassOptionByYear,
    handleAllocationDraftChange,
    mappedDepreciationClassByYear,
    previousSavedDepreciationClassByYear,
    applyCarryForwardMapping,
    handleDepreciationRuleDraftChange,
    saveDepreciationRuleDraft,
    saveClassAllocations,
    averageNearTermExpense,
    firstNearTermExpense,
    MAX_YEARLY_INVESTMENT_EUR,
  };
}

export type ForecastInvestmentController = ReturnType<
  typeof useForecastInvestmentController
>;
