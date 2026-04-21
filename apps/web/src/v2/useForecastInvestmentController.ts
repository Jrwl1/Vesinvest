import type { TFunction } from 'i18next';
import React from 'react';

import {
  updateForecastScenarioV2,
  type V2ForecastScenario,
  type V2ForecastScenarioType,
  type V2YearlyInvestmentPlanRow,
} from '../api';
import { renderForecastInvestmentProgramRows } from './forecastInvestmentRenderers';
import {
  mergeSavedScenarioPreservingComputedOutputs,
  type ForecastOperationState,
  REVENUE_ASSUMPTION_KEYS,
  toNearTermExpenseDraftText,
  toYearlyInvestmentInput,
  type ClassAllocationDraftByYear,
  type DepreciationRuleDraft,
  type NearTermExpenseDraftText,
  type NearTermExpenseRow,
} from './forecastModel';
import { useForecastDepreciationController } from './useForecastDepreciationController';
import { useForecastInvestmentEditorController } from './useForecastInvestmentEditorController';

export type UseForecastInvestmentControllerParams = {
  t: TFunction;
  scenario: V2ForecastScenario | null;
  selectedScenarioId: string | null;
  draftName: string;
  setDraftName: React.Dispatch<React.SetStateAction<string>>;
  draftScenarioType: V2ForecastScenarioType;
  setDraftScenarioType: React.Dispatch<
    React.SetStateAction<V2ForecastScenarioType>
  >;
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
  setActiveOperation: React.Dispatch<
    React.SetStateAction<ForecastOperationState>
  >;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setInfo: React.Dispatch<React.SetStateAction<string | null>>;
  updateScenarioSummary: (updated: V2ForecastScenario) => void;
  markScenarioAsNeedsRecompute: () => void;
};

export function useForecastInvestmentController({
  t,
  scenario,
  selectedScenarioId,
  draftName,
  setDraftName,
  draftScenarioType,
  setDraftScenarioType,
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
}: UseForecastInvestmentControllerParams) {
  const editorController = useForecastInvestmentEditorController({
    t,
    draftAssumptions,
    setDraftAssumptions,
    draftInvestments,
    setDraftInvestments,
    draftNearTermExpenseAssumptions,
    setDraftNearTermExpenseAssumptions,
    nearTermExpenseDraftText,
    setNearTermExpenseDraftText,
  });

  const depreciationController = useForecastDepreciationController({
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
    suggestedDepreciationClassKeyByInvestmentGroup:
      editorController.suggestedDepreciationClassKeyByInvestmentGroup,
  });

  const renderInvestmentProgramRows = React.useCallback(
    (rows: V2YearlyInvestmentPlanRow[]) =>
      renderForecastInvestmentProgramRows({
        rows,
        t,
        handleInvestmentMetadataChange: editorController.handleInvestmentMetadataChange,
        handleInvestmentProgramAmountChange:
          editorController.handleInvestmentProgramAmountChange,
        handleInvestmentChange: editorController.handleInvestmentChange,
        handleInvestmentBlur: editorController.handleInvestmentBlur,
        loadingDepreciation,
        depreciationRulesUnavailable: depreciationController.depreciationRulesUnavailable,
        effectiveInvestmentDepreciationClassByYear:
          depreciationController.effectiveInvestmentDepreciationClassByYear,
        depreciationClassOptions: depreciationController.depreciationClassOptions,
        formatDepreciationRuleSummary:
          depreciationController.formatDepreciationRuleSummary,
      }),
    [depreciationController, editorController, loadingDepreciation, t],
  );

  const blockedForecastActionHint = editorController.hasNearTermValidationErrors
    ? t(
        'v2Forecast.nearTermValidationSummary',
        'Fix highlighted near-term percentage fields before saving or computing.',
      )
    : depreciationController.hasMissingDepreciationRules
      ? t(
          'v2Forecast.depreciationRulesUnavailable',
          'Depreciation rules are missing for this scenario. Refresh the scenario before saving investment years.',
        )
      : undefined;

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
          depreciationController.savedMappedDepreciationClassByYear[row.year] ??
          null,
      ]),
    ) as Record<number, string | null>;

    const payload = {
      name: draftName.trim() || scenario.name,
      scenarioType: draftScenarioType,
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
    setDraftScenarioType(updated.scenarioType);
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
    draftScenarioType,
    draftNearTermExpenseAssumptions,
    hasUnsavedChanges,
    revenueAssumptionsChanged,
    depreciationController.savedMappedDepreciationClassByYear,
    scenario,
    selectedScenarioId,
    setDraftAssumptions,
    setDraftInvestments,
    setDraftName,
    setDraftScenarioType,
    setDraftNearTermExpenseAssumptions,
    setNearTermExpenseDraftText,
    updateScenarioSummary,
  ]);

  return {
    ...editorController,
    ...depreciationController,
    renderInvestmentProgramRows,
    saveDrafts,
    blockedForecastActionHint,
  };
}

export type ForecastInvestmentController = ReturnType<
  typeof useForecastInvestmentController
>;
