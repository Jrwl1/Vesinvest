import { describe, expect, it } from 'vitest';

import fi from './fi.json';
import sv from './sv.json';
import en from './en.json';

import loginFormRaw from '../../components/LoginForm.tsx?raw';
import appShellV2Raw from '../../v2/AppShellV2.tsx?raw';
import overviewPageV2Raw from '../../v2/OverviewPageV2.tsx?raw';
import ennustePageV2Raw from '../../v2/EnnustePageV2.tsx?raw';
import reportsPageV2Raw from '../../v2/ReportsPageV2.tsx?raw';

const localeEntries = [
  { locale: 'fi', data: fi },
  { locale: 'sv', data: sv },
  { locale: 'en', data: en },
] as const;

const uiStringFiles = [
  { name: 'LoginForm.tsx', raw: loginFormRaw },
  { name: 'AppShellV2.tsx', raw: appShellV2Raw },
  { name: 'OverviewPageV2.tsx', raw: overviewPageV2Raw },
  { name: 'EnnustePageV2.tsx', raw: ennustePageV2Raw },
  { name: 'ReportsPageV2.tsx', raw: reportsPageV2Raw },
] as const;

const mojibakePattern =
  /\u00C3[\u0080-\u00BF]|\u00C2[\u0080-\u00BF]|\u00E2[\u0080-\u024F]|\uFFFD/;

function pick(obj: Record<string, unknown>, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

const refreshedFlowLocaleKeys = [
  'common.yes',
  'common.no',
  'auth.demoStatusLabel',
  'auth.demoStatusAvailable',
  'auth.demoStatusAvailableHint',
  'auth.demoStatusLoadingHint',
  'auth.demoStatusUnavailable',
  'auth.demoStatusUnavailableHint',
  'auth.demoStatusUnreachable',
  'auth.demoStatusUnreachableHint',
  'v2Forecast.availableScenarios',
  'v2Forecast.sidebarCount',
  'v2Forecast.sidebarIntro',
  'v2Forecast.scenarioRailEyebrow',
  'v2Forecast.scenarioRailTitle',
  'v2Forecast.scenarioRailBody',
  'v2Forecast.branchingTitle',
  'v2Forecast.branchingHint',
  'v2Forecast.branchingHintSelected',
  'v2Forecast.baseScenario',
  'v2Forecast.stressScenario',
  'v2Forecast.defaultScenarioPrefix',
  'v2Forecast.updatedLabel',
  'v2Forecast.computedState',
  'v2Forecast.draftState',
  'v2Forecast.computedYearsLabel',
  'v2Forecast.executiveHeroEyebrow',
  'v2Forecast.executiveHeroTitle',
  'v2Forecast.executiveHeroBody',
  'v2Forecast.standardViewMode',
  'v2Forecast.analystViewMode',
  'v2Forecast.editorEyebrow',
  'v2Forecast.editorIntro',
  'v2Forecast.baselineContextMissing',
  'v2Forecast.currentFeeLevel',
  'v2Forecast.feeSufficiencySnapshot',
  'v2Forecast.feeSufficiencySnapshotHint',
  'v2Forecast.depreciationRulesTitle',
  'v2Forecast.depreciationRulesHint',
  'v2Forecast.depreciationRulesLoading',
  'v2Forecast.depreciationRulesEmpty',
  'v2Forecast.addDepreciationRule',
  'v2Forecast.classKey',
  'v2Forecast.className',
  'v2Forecast.method',
  'v2Forecast.methodNone',
  'v2Forecast.methodLinear',
  'v2Forecast.methodResidual',
  'v2Forecast.methodStraightLine',
  'v2Forecast.methodCustomSchedule',
  'v2Forecast.linearYearsLabel',
  'v2Forecast.annualScheduleLabel',
  'v2Forecast.residualPercentLabel',
  'v2Forecast.depreciationRuleKeyRequired',
  'v2Forecast.depreciationRuleSaved',
  'v2Forecast.depreciationRuleSaveFailed',
  'v2Forecast.depreciationRuleDeleted',
  'v2Forecast.depreciationRuleDeleteFailed',
  'v2Forecast.classAllocationTitle',
  'v2Forecast.classAllocationHint',
  'v2Forecast.classAllocationNoRules',
  'v2Forecast.saveClassAllocations',
  'v2Forecast.classAllocationsSaved',
  'v2Forecast.classAllocationsSaveFailed',
  'v2Forecast.allocationTotal',
  'v2Forecast.investmentCategoryPlaceholder',
  'v2Forecast.investmentTypePlaceholder',
  'v2Forecast.investmentTypeNew',
  'v2Forecast.investmentTypeReplacement',
  'v2Forecast.investmentConfidencePlaceholder',
  'v2Forecast.investmentConfidenceLow',
  'v2Forecast.investmentConfidenceMedium',
  'v2Forecast.investmentConfidenceHigh',
  'v2Forecast.investmentNotePlaceholder',
  'v2Forecast.investmentPeakAnnualTotal',
  'v2Forecast.investmentPeakYears',
  'v2Forecast.investmentPeakYearsEmpty',
  'v2Forecast.investmentStrongestFiveYear',
  'v2Forecast.investmentRepeatNearTermTemplate',
  'v2Forecast.investmentNearTermTitle',
  'v2Forecast.investmentNearTermHint',
  'v2Forecast.investmentLongRangeTitle',
  'v2Forecast.investmentLongRangeHint',
  'v2Forecast.investmentLongRangeGroup',
  'v2Forecast.investmentAnalystTools',
  'v2Forecast.statementCosts',
  'v2Forecast.statementResult',
  'v2Forecast.statementCashflow',
  'v2Forecast.statementCumulativeCash',
  'v2Forecast.statementLabel',
  'v2Forecast.baselineLabel',
  'v2Forecast.unmapped',
  'v2Forecast.riskPresetCreated',
  'v2Forecast.riskPresetsTitle',
  'v2Forecast.baseVsStressTitle',
  'v2Forecast.loadingBaseComparison',
  'v2Forecast.baseComparisonBaseSelected',
  'v2Forecast.metric',
  'v2Forecast.requiredPriceCompare',
  'v2Forecast.requiredPriceDeltaTitle',
  'v2Forecast.requiredIncreaseCompare',
  'v2Forecast.requiredIncreaseDeltaTitle',
  'v2Forecast.annualUnderfundingCompare',
  'v2Forecast.annualUnderfundingDeltaTitle',
  'v2Forecast.cashUnderfundingCompare',
  'v2Forecast.peakGapCompare',
  'v2Forecast.peakGapDeltaTitle',
  'v2Forecast.noUnderfunding',
  'v2Forecast.riskSummaryTitle',
  'v2Forecast.riskSummaryPending',
  'v2Forecast.riskSummaryStable',
  'v2Forecast.riskSummaryStress',
  'v2Forecast.statementComparisonTitle',
  'v2Forecast.statementComparisonHint',
  'v2Forecast.pillarComparisonTitle',
  'v2Forecast.pillarComparisonHint',
  'v2Forecast.peakCumulativeGap',
  'v2Forecast.underfundingStartAnnualResult',
  'v2Forecast.underfundingStartCumulativeCash',
  'v2Forecast.outputsProvenanceTitle',
  'v2Forecast.outputsProvenanceHint',
  'v2Forecast.revenueWorkbenchTariffHint',
  'v2Forecast.revenueWorkbenchVolumeHint',
  'v2Forecast.materialsWorkbenchHint',
  'v2Forecast.personnelWorkbenchHint',
  'v2Forecast.otherOpexWorkbenchHint',
  'v2Forecast.workbenchOverviewTitle',
  'v2Forecast.workbenchOverviewHint',
  'v2Forecast.workbenchEditHint',
  'v2Forecast.analystModeLabel',
  'v2Forecast.analystModeHint',
  'v2Forecast.enableAnalystMode',
  'v2Forecast.disableAnalystMode',
  'v2Forecast.depreciationWorkbenchEyebrow',
  'v2Forecast.depreciationWorkbenchTitle',
  'v2Forecast.depreciationWorkbenchHint',
  'v2Forecast.depreciationRulesCount',
  'v2Forecast.depreciationMappedYears',
  'v2Forecast.depreciationFullyMappedYears',
  'v2Forecast.depreciationImpactTitle',
  'v2Forecast.depreciationImpactHint',
  'v2Forecast.depreciationImpactRequiredPrice',
  'v2Forecast.depreciationImpactRequiredIncrease',
  'v2Forecast.depreciationImpactUnderfunding',
  'v2Forecast.depreciationImpactPeakGap',
  'v2Forecast.depreciationImpactHorizonCashflow',
  'v2Forecast.depreciationCategory',
  'v2Overview.sourceLabel',
  'v2Overview.financialComparisonTitle',
  'v2Overview.financialComparisonBody',
  'v2Overview.financialComparisonVeeti',
  'v2Overview.financialComparisonEffective',
  'v2Overview.financialComparisonDelta',
  'v2Overview.financialComparisonDiffs',
  'v2Overview.financialComparisonMatches',
  'v2Overview.priceComparisonTitle',
  'v2Overview.priceComparisonBody',
  'v2Overview.priceComparisonDiffs',
  'v2Overview.priceComparisonMatches',
  'v2Overview.volumeComparisonTitle',
  'v2Overview.volumeComparisonBody',
  'v2Overview.volumeComparisonDiffs',
  'v2Overview.volumeComparisonMatches',
  'v2Overview.yearDetailTitle',
  'v2Overview.yearDetailBody',
  'v2Overview.yearDetailExcludedBody',
  'v2Overview.yearDetailStatus',
  'v2Overview.yearDetailSource',
  'v2Overview.previewRevenueLabel',
  'v2Overview.previewPricesLabel',
  'v2Overview.previewVolumesLabel',
  'v2Overview.previewMissingValue',
  'v2Overview.previewVeetiMissingValue',
  'v2Overview.keepCurrentYearValues',
  'v2Overview.keepCurrentYearValuesInfo',
  'v2Overview.manualEditedAt',
  'v2Overview.manualOverridesLabel',
  'v2Overview.manualReason',
  'v2Overview.optionalField',
  'v2Overview.manualPatchLoadFailed',
  'v2Overview.manualPatchNoChanges',
  'v2Overview.manualFinancialFinanceNet',
  'v2Overview.manualFinancialOwnerSupport',
  'v2Overview.manualFinancialOwnerWithdrawal',
  'v2Overview.statementImportStarting',
  'v2Overview.statementImportDone',
  'v2Overview.statementImportFailed',
  'v2Overview.statementImportReasonDefault',
  'v2Overview.statementImportConfidence',
  'v2Overview.statementImportDetectedPage',
  'v2Overview.qdisImportAction',
  'v2Overview.qdisImportWorkflowTitle',
  'v2Overview.qdisImportWorkflowBody',
  'v2Overview.qdisImportUploadFile',
  'v2Overview.qdisImportReplaceFile',
  'v2Overview.qdisImportStarting',
  'v2Overview.qdisImportDone',
  'v2Overview.qdisImportFailed',
  'v2Overview.qdisImportReasonDefault',
  'v2Overview.qdisImportConfirm',
  'v2Overview.qdisImportConfirmAndSync',
  'v2Overview.qdisImportDiffTitle',
  'v2Overview.qdisImportDiffPdf',
  'v2Overview.qdisImportAwaitingFile',
  'v2Overview.qdisImportNoMappedValues',
  'v2Overview.datasetSourceQdisImport',
  'v2Overview.reapplyVeetiFinancials',
  'v2Overview.reapplyVeetiPrices',
  'v2Overview.reapplyVeetiVolumes',
  'v2Overview.reconcileApplied',
  'v2Overview.reconcileFailed',
  'v2Overview.markYearForDelete',
  'v2Overview.deleteSelectedYears',
  'v2Overview.deletingYearsBulk',
  'v2Overview.deleteYearsBulkConfirm',
  'v2Overview.deleteYearsBulkDone',
  'v2Overview.deleteYearsBulkPartial',
  'v2Overview.deleteYearsBulkFailed',
  'v2Overview.yearExcluded',
  'v2Overview.excludedYearsLabel',
  'v2Overview.markYearForRestore',
  'v2Overview.restoreSelectedYears',
  'v2Overview.restoringYearsBulk',
  'v2Overview.restoreYearsBulkDone',
  'v2Overview.restoreYearsBulkPartial',
  'v2Overview.restoreYearsBulkFailed',
  'v2Overview.yearReviewActionsTitle',
  'v2Overview.yearReviewActionsBody',
  'v2Overview.noImportedYears',
  'v2Overview.setupStatusReady',
  'v2Overview.setupStatusNeedsAttention',
  'v2Overview.setupStatusExcluded',
  'v2Overview.setupStatusReadyHint',
  'v2Overview.setupStatusNeedsAttentionHint',
  'v2Overview.setupStatusExcludedHint',
  'v2Overview.setupStatusExcludedShort',
  'v2Overview.reviewContinue',
  'v2Overview.reviewContinueReadyHint',
  'v2Overview.reviewContinueBlockedHint',
  'v2Overview.reviewContinueReadyBody',
  'v2Overview.reviewContinueTechnicalReadyBody',
  'v2Overview.yearDecisionAction',
  'v2Overview.openReviewYearButton',
  'v2Overview.excludeYearFromPlan',
  'v2Overview.restoreYearToPlan',
  'v2Overview.setupStatusTechnicalReadyHint',
  'v2Overview.setupStatusReviewedHint',
  'v2Overview.yearActionsBody',
  'v2Overview.yearActionsReviewBody',
  'v2Overview.yearActionsFixBody',
  'v2Overview.yearActionsExcludedBody',
  'v2Overview.reviewModeHint',
  'v2Overview.createPlanningBaseline',
  'v2Overview.planningBaselineDone',
  'v2Overview.openForecast',
  'v2Overview.wizardProgress',
  'v2Overview.wizardLabel',
  'v2Overview.wizardQuestionConnect',
  'v2Overview.wizardBodyConnect',
  'v2Overview.wizardQuestionImportYears',
  'v2Overview.wizardBodyImportYears',
  'v2Overview.wizardStepOneHelp',
  'v2Overview.wizardStepTwoHelp',
  'v2Overview.wizardQuestionReviewYears',
  'v2Overview.wizardBodyReviewYears',
  'v2Overview.wizardQuestionReviewYear',
  'v2Overview.wizardBodyReviewYear',
  'v2Overview.wizardQuestionFixYear',
  'v2Overview.wizardBodyFixYear',
  'v2Overview.wizardQuestionBaseline',
  'v2Overview.wizardBodyBaseline',
  'v2Overview.wizardQuestionForecast',
  'v2Overview.wizardBodyForecast',
  'v2Overview.wizardSummaryTitle',
  'v2Overview.wizardSummarySubtitle',
  'v2Overview.wizardSummaryCompany',
  'v2Overview.wizardSummaryImportedYears',
  'v2Overview.wizardSummaryReadyYears',
  'v2Overview.wizardSummaryExcludedYears',
  'v2Overview.wizardSummaryBaselineReady',
  'v2Overview.wizardSummaryYes',
  'v2Overview.wizardSummaryNo',
  'v2Overview.wizardBaselineReadyDetail',
  'v2Overview.wizardBaselineReadyHint',
  'v2Overview.wizardBaselinePendingHint',
  'v2Overview.wizardContextEarlier',
  'v2Overview.wizardContextNext',
  'v2Overview.wizardContextStep2',
  'v2Overview.wizardContextStep3',
  'v2Overview.wizardContextStep4',
  'v2Overview.wizardContextStep5',
  'v2Overview.wizardContextStep6',
  'v2Overview.wizardContextConnectedSource',
  'v2Overview.wizardContextConnectNextBody',
  'v2Overview.wizardContextImportNextBody',
  'v2Overview.wizardContextImportedWorkspaceYears',
  'v2Overview.wizardContextImportedWorkspaceYearsBody',
  'v2Overview.wizardContextReviewNextOneBody',
  'v2Overview.wizardContextReviewNextManyBody',
  'v2Overview.wizardContextReviewNextReadyBody',
  'v2Overview.wizardContextReviewQueue',
  'v2Overview.wizardContextReviewQueueBody',
  'v2Overview.wizardContextBackToReview',
  'v2Overview.wizardContextFixNextReviewBody',
  'v2Overview.wizardContextFixNextBaselineBody',
  'v2Overview.wizardContextReviewSummary',
  'v2Overview.wizardContextReviewSummaryBody',
  'v2Overview.wizardContextBaselineNextBody',
  'v2Overview.wizardContextBaselineSummary',
  'v2Overview.wizardCurrentFocus',
  'v2Reports.previewTitle',
  'v2Reports.baselineSourcesTitle',
  'v2Reports.baselineSourceStatementImport',
  'v2Reports.baselineSourceWorkbookImport',
  'v2Reports.baselineSourceManual',
  'v2Reports.baselineSourceVeeti',
  'v2Reports.baselineSourceMissing',
  'v2Reports.baselineWorkbookImportDetail',
  'v2Reports.defaultTitlePrefix',
  'v2Reports.variantPublicHint',
  'v2Reports.variantConfidentialHint',
  'v2Reports.requiredCombinedPriceToday',
  'v2Reports.requiredCombinedIncreaseFromCurrent',
  'v2Reports.openForecastToSaveAndCompute',
  'v2Reports.openForecastToRecompute',
  'v2Reports.openForecastToCreateReport',
  'v2Reports.listBaselineStatus',
  'v2Reports.listFinancialSource',
  'v2Reports.previewBaselineStatus',
  'v2Reports.previewFinancialSource',
] as const;

// Wizard chrome stays on the strict parity path so fallback leaks fail fast.

describe('locale integrity', () => {
  it('contains no mojibake sequences in locale values', () => {
    for (const { locale, data } of localeEntries) {
      const text = JSON.stringify(data);
      expect(text, `mojibake found in locale ${locale}`).not.toMatch(
        mojibakePattern,
      );
    }
  });

  it('contains no mojibake sequences in core V2 UI files', () => {
    for (const file of uiStringFiles) {
      expect(file.raw, `mojibake found in ${file.name}`).not.toMatch(
        mojibakePattern,
      );
    }
  });

  it('has projection.v2 parity for required keys in fi/sv/en', () => {
    const requiredV2Keys = [
      'pageTitle',
      'inputsTitle',
      'volumeTitle',
      'volumeHint',
      'historyYearsLabel',
      'manualYearsLabel',
      'futureYearsLabel',
      'assumptionsTitle',
      'investmentsTitle',
      'investmentsHint',
      'addInvestment',
      'removeInvestment',
      'advancedTitle',
      'computeBtn',
      'computingBtn',
      'firstComputeBtn',
      'kpiRequiredTariff',
      'kpiTariffikorotus',
      'kpiTariffNext',
      'kpiCumulative',
      'kpiInvestments',
      'kpiCashflow',
      'chartTariffLabel',
      'chartRevenueLabel',
      'chartCostsLabel',
      'chartInvestmentsLabel',
      'chartCashflowLabel',
      'assumptionKayttomenot',
      'assumptionEnergia',
      'assumptionHenkilosto',
      'assumptionVesimaara',
      'assumptionTariffi',
      'assumptionInvestointi',
      'personnelManualHint',
      'detailedTableTitle',
      'yearEditorTitle',
      'selectedYear',
      'waterPriceCardTitle',
      'waterPriceGrowth',
      'lockPrice',
      'lockPercent',
      'investmentCardTitle',
      'investmentYearAmount',
      'categoryCardTitle',
      'categoryPersonnel',
      'categoryEnergy',
      'categoryOpexOther',
      'categoryOtherIncome',
      'categoryInvestments',
      'lineOverrideTitle',
      'lineOverrideEmpty',
      'clearYearOverrides',
    ];

    for (const { locale, data } of localeEntries) {
      for (const key of requiredV2Keys) {
        const value = pick(
          data as Record<string, unknown>,
          `projection.v2.${key}`,
        );
        expect(value, `${locale}: missing projection.v2.${key}`).toBeTypeOf(
          'string',
        );
      }
    }
  });

  it('uses water-price terminology in projection labels', () => {
    const forbidden = /\b(tariffi|tariff|taxa)\b/i;
    const paths = [
      'projection.summary.requiredTariff',
      'projection.kpi.requiredTariffGrowth',
      'projection.kpi.tariffYearPlusOne',
      'projection.charts.tariffTrend',
      'projection.charts.tariffHint',
      'projection.charts.tariffSeries',
      'projection.v2.kpiRequiredTariff',
      'projection.v2.kpiTariffikorotus',
      'projection.v2.kpiTariffNext',
      'projection.v2.chartTariffLabel',
      'projection.v2.assumptionTariffi',
    ];

    for (const { locale, data } of localeEntries) {
      for (const p of paths) {
        const value = pick(data as Record<string, unknown>, p);
        expect(value, `${locale}: missing ${p}`).toBeTypeOf('string');
        expect(String(value), `${locale}: forbidden term in ${p}`).not.toMatch(
          forbidden,
        );
      }
    }
  });

  it('keeps refreshed trust and admin locale keys in sync for fi/sv/en', () => {
    for (const { locale, data } of localeEntries) {
      for (const key of refreshedFlowLocaleKeys) {
        const value = pick(data as Record<string, unknown>, key);
        expect(value, `${locale}: missing ${key}`).toBeTypeOf('string');
      }
    }
  });

  it('avoids leaked source-language tokens in refreshed locale surfaces', () => {
    expect(String(pick(en as Record<string, unknown>, 'v2Overview.opsReports'))).not.toMatch(
      /Toimintakertomus/i,
    );
    expect(String(pick(sv as Record<string, unknown>, 'v2Overview.opsReports'))).not.toMatch(
      /Toimintakertomus/i,
    );
    expect(
      String(pick(fi as Record<string, unknown>, 'v2Overview.reviewWorkspaceBody')),
    ).not.toMatch(/\beffective\b/i);
    expect(
      String(pick(fi as Record<string, unknown>, 'v2Overview.selectedYearEmpty')),
    ).not.toMatch(/\beffective\b/i);
    expect(
      String(pick(sv as Record<string, unknown>, 'v2Overview.reviewWorkspaceBody')),
    ).not.toMatch(/\beffective\b/i);
    expect(
      String(pick(sv as Record<string, unknown>, 'v2Overview.selectedYearEmpty')),
    ).not.toMatch(/\beffective\b/i);
    expect(
      String(pick(en as Record<string, unknown>, 'v2Forecast.statementCosts')),
    ).toBe('Costs');
    expect(
      String(pick(en as Record<string, unknown>, 'v2Forecast.depreciationWorkbenchTitle')),
    ).not.toMatch(/Poistosaannot|Poistosaanto/i);
    expect(
      String(pick(sv as Record<string, unknown>, 'v2Forecast.statementCashflow')),
    ).not.toMatch(/Kassavirta/i);
    expect(
      String(pick(en as Record<string, unknown>, 'v2Reports.defaultTitlePrefix')),
    ).toBe('Forecast report');
  });
});
