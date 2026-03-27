import React from 'react';
import type { TFunction } from 'i18next';

import {
  createScenarioDepreciationRuleV2,
  getScenarioClassAllocationsV2,
  listScenarioDepreciationRulesV2,
  updateScenarioClassAllocationsV2,
  updateScenarioDepreciationRuleV2,
  type V2ForecastScenario,
  type V2YearlyInvestmentPlanRow,
} from '../api';
import {
  buildClassAllocationDraftByYear,
  normalizeInvestmentMappingLabel,
  resolveSingleMappedDepreciationClass,
  toDepreciationRuleDraft,
  type ClassAllocationDraftByYear,
  type DepreciationRuleDraft,
} from './forecastModel';

type UseForecastDepreciationControllerParams = {
  t: TFunction;
  scenario: V2ForecastScenario | null;
  selectedScenarioId: string | null;
  draftInvestments: V2YearlyInvestmentPlanRow[];
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
  setActiveOperation: React.Dispatch<React.SetStateAction<any>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInfo: React.Dispatch<React.SetStateAction<string | null>>;
  markScenarioAsNeedsRecompute: () => void;
  suggestedDepreciationClassKeyByInvestmentGroup: Map<string, string>;
};

export function useForecastDepreciationController({
  t,
  scenario,
  selectedScenarioId,
  draftInvestments,
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
  setActiveOperation,
  setError,
  setInfo,
  markScenarioAsNeedsRecompute,
  suggestedDepreciationClassKeyByInvestmentGroup,
}: UseForecastDepreciationControllerParams) {
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
        return t(
          'v2Forecast.investmentResidualSummary',
          'Residual write-off {{percent}}%',
          {
            percent: rule.residualPercent || '0',
          },
        );
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
            suggestedClassKey != null &&
            depreciationClassKeys.includes(suggestedClassKey);
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
          await updateScenarioDepreciationRuleV2(
            selectedScenarioId,
            draft.id,
            payload,
          );
        } else {
          await createScenarioDepreciationRuleV2(selectedScenarioId, payload);
        }
        const refreshed = await listScenarioDepreciationRulesV2(selectedScenarioId);
        const nextRuleDrafts = refreshed.map(toDepreciationRuleDraft);
        setDepreciationRuleDrafts(nextRuleDrafts);
        setSavedDepreciationRuleDrafts(nextRuleDrafts);
        markScenarioAsNeedsRecompute();
        setInfo(
          t(
            'v2Forecast.depreciationRuleSaved',
            'Depreciation rule saved successfully.',
          ),
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

  return {
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
    inferredDepreciationClassKeyByYear,
    inferredDepreciationClassOptionByYear,
    handleAllocationDraftChange,
    mappedDepreciationClassByYear,
    previousSavedDepreciationClassByYear,
    applyCarryForwardMapping,
    handleDepreciationRuleDraftChange,
    saveDepreciationRuleDraft,
    saveClassAllocations,
  };
}

export type ForecastDepreciationController = ReturnType<
  typeof useForecastDepreciationController
>;
