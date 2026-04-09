import React from 'react';
import type { TFunction } from 'i18next';

import type { V2YearlyInvestmentPlanRow } from '../api';
import {
  renderForecastInvestmentEditorRows,
} from './forecastInvestmentRenderers';
import {
  clampYearlyInvestment,
  INVESTMENT_PROGRAM_GROUP_OPTION_DEFS,
  MAX_YEARLY_INVESTMENT_EUR,
  NEAR_TERM_FIELDS,
  normalizeInvestmentMappingLabel,
  parseAssumptionPercentInput,
  parseNearTermPercent,
  REVENUE_ASSUMPTION_KEYS,
  resolveInvestmentProgramTotal,
  round4,
  validateNearTermPercent,
  type NearTermExpenseDraftText,
  type NearTermExpenseRow,
  type NearTermField,
  type NearTermValidationCode,
  type NearTermValidationErrors,
} from './forecastModel';

type UseForecastInvestmentEditorControllerParams = {
  t: TFunction;
  draftAssumptions: Record<string, number>;
  setDraftAssumptions: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  draftInvestments: V2YearlyInvestmentPlanRow[];
  setDraftInvestments: React.Dispatch<
    React.SetStateAction<V2YearlyInvestmentPlanRow[]>
  >;
  draftNearTermExpenseAssumptions: NearTermExpenseRow[];
  setDraftNearTermExpenseAssumptions: React.Dispatch<
    React.SetStateAction<NearTermExpenseRow[]>
  >;
  nearTermExpenseDraftText: NearTermExpenseDraftText;
  setNearTermExpenseDraftText: React.Dispatch<
    React.SetStateAction<NearTermExpenseDraftText>
  >;
};

export function useForecastInvestmentEditorController({
  t,
  draftAssumptions: _draftAssumptions,
  setDraftAssumptions,
  draftInvestments,
  setDraftInvestments,
  draftNearTermExpenseAssumptions,
  setDraftNearTermExpenseAssumptions,
  nearTermExpenseDraftText,
  setNearTermExpenseDraftText,
}: UseForecastInvestmentEditorControllerParams) {
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
        strongestFiveYearRange: null as {
          startYear: number;
          endYear: number;
        } | null,
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
    let strongestFiveYearRange: { startYear: number; endYear: number } | null =
      null;
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
      const peakAmount = rows.reduce(
        (current, row) => Math.max(current, row.amount),
        0,
      );
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
    (rowKey: string, value: string) => {
      const normalized = value.trim().replace(',', '.');
      const parsed = normalized.length === 0 ? 0 : Number(normalized);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const safeAmount = clampYearlyInvestment(parsed);
      setDraftInvestments((prev) =>
        prev.map((item) =>
          (item.rowId ?? String(item.year)) === rowKey
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
      rowKey: string,
      field: 'waterAmount' | 'wastewaterAmount',
      value: string,
    ) => {
      const normalized = value.trim().replace(',', '.');
      if (normalized.length === 0) {
        setDraftInvestments((prev) =>
          prev.map((item) => {
            if ((item.rowId ?? String(item.year)) !== rowKey) {
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
          if ((item.rowId ?? String(item.year)) !== rowKey) {
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
    (rowKey: string) => {
      setDraftInvestments((prev) =>
        prev.map((item) =>
          (item.rowId ?? String(item.year)) === rowKey
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
      rowKey: string,
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
          if ((item.rowId ?? String(item.year)) !== rowKey) {
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

  const renderInvestmentEditorRows = React.useCallback(
    (rows: V2YearlyInvestmentPlanRow[]) =>
      renderForecastInvestmentEditorRows({
        rows,
        t,
        handleInvestmentChange,
        handleInvestmentBlur,
        handleInvestmentMetadataChange,
      }),
    [
      handleInvestmentBlur,
      handleInvestmentChange,
      handleInvestmentMetadataChange,
      t,
    ],
  );

  return {
    handleRevenueAssumptionChange,
    investmentSummary,
    nearTermInvestmentRows,
    longRangeInvestmentGroups,
    investmentProgramGroupOptions,
    suggestedDepreciationClassKeyByInvestmentGroup,
    handleInvestmentChange,
    handleInvestmentProgramAmountChange,
    handleInvestmentBlur,
    handleCopyFirstInvestmentToAll,
    handleClearAllInvestments,
    handleRepeatNearTermInvestmentTemplate,
    handleInvestmentMetadataChange,
    renderInvestmentEditorRows,
    handleNearTermExpenseChange,
    handleNearTermExpenseBlur,
    nearTermInputValue,
    nearTermValidationErrors,
    hasNearTermValidationErrors,
    nearTermValidationMessage,
    averageNearTermExpense,
    firstNearTermExpense,
    MAX_YEARLY_INVESTMENT_EUR,
  };
}

export type ForecastInvestmentEditorController = ReturnType<
  typeof useForecastInvestmentEditorController
>;
