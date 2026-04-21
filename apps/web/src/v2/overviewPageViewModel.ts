import type { TFunction } from 'i18next';

import { formatDateTime } from './format';
import {
  getPresentedOverviewWorkflowStep,
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  resolveVesinvestWorkflowState,
} from './overviewWorkflow';
import type { OverviewPageController } from './useOverviewPageController';

type Params = {
  controller: OverviewPageController;
  overview: NonNullable<OverviewPageController['overview']>;
  t: TFunction;
};

export function buildOverviewPageViewModel({
  controller,
  overview,
  t,
}: Params) {
  const importStatus = overview.importStatus;
  const hasBaselineBudget = controller.baselineReady;
  const activeImportedReviewYears = controller.reviewStatusRows
    .filter((row) => row.setupStatus !== 'excluded_from_plan')
    .map((row) => row.year)
    .sort((left, right) => right - left);
  const activeImportedReviewYearsLabel =
    activeImportedReviewYears.length > 0
      ? activeImportedReviewYears.join(', ')
      : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const hasPostImportYearTruth =
    activeImportedReviewYears.length > 0 ||
    controller.confirmedImportedYears.length > 0 ||
    controller.importYearRows.length > 0 ||
    controller.acceptedPlanningYearRows.length > 0 ||
    controller.backendAcceptedPlanningYears.length > 0;
  const includedPlanningYearsLabel =
    controller.includedPlanningYears.length > 0
      ? controller.includedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const importedYearsLabel = hasPostImportYearTruth
    ? activeImportedReviewYearsLabel
    : t('v2Overview.noImportedYears', 'No imported years available yet.');
  const readySummaryYearRows = [
    ...controller.reviewedImportedYearRows,
    ...controller.technicallyReadyImportedYearRows,
  ].sort((left, right) => right.vuosi - left.vuosi);
  const readyYearsLabel =
    readySummaryYearRows.length > 0
      ? readySummaryYearRows.map((row) => row.vuosi).join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const selectedHistoricalYearSet = new Set(
    controller.selectableImportYearRows
      .filter((row) => row.planningRole !== 'current_year_estimate')
      .map((row) => row.vuosi),
  );
  const includedCurrentEstimateYears = controller.currentYearEstimateBoardRows
    .filter((row) => controller.confirmedImportedYears.includes(row.vuosi))
    .map((row) => row.vuosi)
    .sort((left, right) => right - left);
  const selectedBaselineYears = [
    ...controller.selectedYears.filter((year) =>
      selectedHistoricalYearSet.has(year),
    ),
    ...includedCurrentEstimateYears,
  ].sort((left, right) => right - left);
  const selectedBaselineYearsLabel =
    selectedBaselineYears.length > 0
      ? selectedBaselineYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const readyBaselineYears = controller.readyTrustBoardRows
    .map((row) => row.vuosi)
    .filter((year) => selectedBaselineYears.includes(year))
    .sort((left, right) => right - left);
  const readyBaselineYearsLabel =
    readyBaselineYears.length > 0
      ? readyBaselineYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const technicalReadyYearsLabel =
    controller.technicallyReadyImportedYearRows.length > 0
      ? controller.technicallyReadyImportedYearRows
          .map((row) => row.vuosi)
          .join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const excludedYearsLabel =
    controller.excludedYearsSorted.length > 0
      ? controller.excludedYearsSorted.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const handoffExcludedYearsSorted = controller.excludedYearsSorted.filter(
    (year) => !controller.backendAcceptedPlanningYears.includes(year),
  );
  const correctedYearsLabel =
    controller.correctedPlanningYears.length > 0
      ? controller.correctedPlanningYears.join(', ')
      : t('v2Overview.noYearsSelected', 'None selected');
  const selectedConnectedOrg = overview.importStatus.link ?? null;
  const selectedOrgName =
    controller.selectedOrg?.Nimi ??
    selectedConnectedOrg?.nimi ??
    t('v2Overview.organizationNotSelected', 'Not selected');
  const selectedOrgBusinessId =
    controller.selectedOrg?.YTunnus ?? selectedConnectedOrg?.ytunnus ?? '-';
  const selectedOrgMunicipality = controller.selectedOrg?.Kunta ?? null;
  const activeVesinvestPlan =
    controller.planningContext?.vesinvest?.activePlan ??
    controller.planningContext?.vesinvest?.selectedPlan ??
    null;
  const activeVesinvestScenario =
    activeVesinvestPlan?.selectedScenarioId != null
      ? (controller.scenarioList ?? []).find(
          (item) => item.id === activeVesinvestPlan.selectedScenarioId,
        ) ??
        (activeVesinvestPlan.baselineStatus === 'verified' &&
        activeVesinvestPlan.pricingStatus === 'verified' &&
        controller.baselineReady
          ? {
              id: activeVesinvestPlan.selectedScenarioId,
              updatedAt: activeVesinvestPlan.updatedAt,
              computedFromUpdatedAt: activeVesinvestPlan.updatedAt,
              computedYears: 1,
            }
          : null)
      : null;
  const shouldKeepSavedWorkspaceStep =
    activeVesinvestPlan?.baselineStatus === 'verified' &&
    activeVesinvestPlan?.pricingStatus === 'verified' &&
    typeof activeVesinvestPlan?.selectedScenarioId === 'string' &&
    activeVesinvestPlan.selectedScenarioId.length > 0 &&
    controller.baselineReady;
  const vesinvestWorkflowState = resolveVesinvestWorkflowState(
    importStatus,
    controller.planningContext,
    {
      selectedScenario: activeVesinvestScenario,
    },
  );
  const wizardProgressStep = shouldKeepSavedWorkspaceStep
    ? 6
    : vesinvestWorkflowState.currentStep;
  const hasBlockedReviewRows = controller.reviewStatusRows.some(
    (row) => row.setupStatus === 'needs_attention',
  );
  const hasPendingReviewRows = controller.reviewStatusRows.some(
    (row) => row.setupStatus === 'ready_for_review',
  );
  const baselineReadyForSummary =
    controller.baselineReady && !hasBlockedReviewRows && !hasPendingReviewRows;
  const planningBaselineSummaryDetail = baselineReadyForSummary
    ? controller.latestPlanningBaselineSummary
      ? t('v2Overview.wizardBaselineReadyDetail', {
          included:
            controller.latestPlanningBaselineSummary.includedYears.length > 0
              ? controller.latestPlanningBaselineSummary.includedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          excluded:
            controller.latestPlanningBaselineSummary.excludedYears.length > 0
              ? controller.latestPlanningBaselineSummary.excludedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
          corrected:
            controller.latestPlanningBaselineSummary.correctedYears.length > 0
              ? controller.latestPlanningBaselineSummary.correctedYears.join(', ')
              : t('v2Overview.noYearsSelected', 'None selected'),
        })
      : t('v2Overview.wizardBaselineReadyHint')
    : t('v2Overview.wizardBaselinePendingHint');
  const wizardSummaryItems = [
    {
      label: t('v2Overview.wizardSummaryCompany'),
      value:
        activeVesinvestPlan?.utilityName ?? importStatus.link?.nimi ?? selectedOrgName,
      detail:
        activeVesinvestPlan?.businessId ??
        importStatus.link?.ytunnus ??
        selectedOrgBusinessId,
    },
    {
      label: t('v2Overview.wizardSummaryImportedYears'),
      value: String(activeImportedReviewYears.length),
      detail: importedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
      value: String(readySummaryYearRows.length),
      detail: readyYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryExcludedYears'),
      value: String(controller.excludedYearsSorted.length),
      detail: excludedYearsLabel,
    },
    {
      label: t('v2Overview.wizardSummaryBaselineReady'),
      value: baselineReadyForSummary
        ? t('v2Overview.wizardSummaryYes')
        : t('v2Overview.wizardSummaryNo'),
      detail: planningBaselineSummaryDetail,
    },
  ] as const;
  const step3WizardHero = {
    title:
      hasBlockedReviewRows || hasPendingReviewRows
        ? t('v2Overview.wizardQuestionReviewYears')
        : t('v2Vesinvest.workflowVerifyEvidence', 'Verify baseline & evidence'),
    body:
      hasBlockedReviewRows || hasPendingReviewRows
        ? t('v2Overview.wizardBodyReviewYears')
        : t(
            'v2Vesinvest.workflowVerifyEvidenceBody',
            'Use VEETI, PDF, workbook, or manual corrections to verify the accepted baseline that pricing will rely on.',
          ),
    badge:
      hasBlockedReviewRows
        ? t('v2Overview.blockedYearsTitle')
        : hasPendingReviewRows
          ? t('v2Overview.wizardQuestionReviewYears')
          : t('v2Vesinvest.evidenceTitle', 'Accepted baseline years'),
  };
  const wizardStepContent: Record<number, { title: string; body: string; badge: string }> =
    {
      1: {
        title: t('v2Vesinvest.workflowIdentifyUtility', 'Identify the utility'),
        body: t(
          'v2Vesinvest.workflowIdentifyUtilityBody',
          'Search and link the utility. Then build the baseline from historical years before pricing opens.',
        ),
        badge: t('v2Vesinvest.workflowPlanFirst', 'VEETI-first'),
      },
      2: {
        title: t(
          'v2Overview.wizardQuestionImportYears',
          'Choose historical years for the baseline',
        ),
        body: t(
          'v2Overview.wizardBodyImportYears',
          'Start with four consecutive historical years. Keep the current year as an optional estimate.',
        ),
        badge: t('v2Overview.wizardFocusImportYears', 'Baseline years'),
      },
      3: {
        title: step3WizardHero.title,
        body: step3WizardHero.body,
        badge: step3WizardHero.badge,
      },
      4: {
        title: t('v2Vesinvest.workflowOpenFeePath', 'Open fee path'),
        body: t(
          'v2Vesinvest.workflowOpenFeePathBody',
          'When the baseline is verified, sync the plan to forecast to review price pressure, financing gaps, and the saved recommendation.',
        ),
        badge: t('v2Vesinvest.feePathEyebrow', 'Fee path'),
      },
      5: {
        title: t('v2Vesinvest.workflowCreateReport', 'Create report'),
        body: t(
          'v2Vesinvest.workflowCreateReportBody',
          'Create the report after the fee path is saved and the linked scenario is up to date.',
        ),
        badge: t('v2Shell.tabs.reports', 'Reports'),
      },
    };
  const shouldRespectBackNavigation =
    controller.reviewContinueStep != null &&
    controller.wizardDisplayStep < wizardProgressStep;
  const isManageYearsMaintenanceMode =
    controller.reviewContinueStep === 2 && hasPostImportYearTruth;
  const mountedWorkflowStep =
    controller.wizardDisplayStep === 4
      ? 4
      : activeVesinvestPlan &&
          wizardProgressStep > controller.wizardDisplayStep &&
          !shouldRespectBackNavigation
        ? wizardProgressStep
        : controller.wizardDisplayStep;
  const overviewVisualStep = getPresentedOverviewWorkflowStep(mountedWorkflowStep);
  const supportWorkflowStep = isManageYearsMaintenanceMode ? 3 : overviewVisualStep;
  const wizardHero = wizardStepContent[overviewVisualStep];
  const isStep2SupportChrome = supportWorkflowStep === 2;
  const compactSupportingChrome =
    supportWorkflowStep === 1 ||
    supportWorkflowStep === 2 ||
    supportWorkflowStep === 3;
  const useCompactSetupSupportChrome =
    compactSupportingChrome || overviewVisualStep === 4;
  const useCompactWorkspaceLayout =
    overviewVisualStep !== PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS &&
    useCompactSetupSupportChrome;
  const showConnectedSummaryMeta = supportWorkflowStep !== 1;
  const summaryMetaBlocks = [
    {
      label: t('v2Overview.organizationLabel', 'Organization'),
      value: showConnectedSummaryMeta
        ? activeVesinvestPlan?.utilityName ?? importStatus.link?.nimi ?? '-'
        : '-',
    },
    {
      label: t('v2Overview.businessIdLabel', 'Business ID'),
      value: showConnectedSummaryMeta
        ? activeVesinvestPlan?.businessId ?? importStatus.link?.ytunnus ?? '-'
        : '-',
    },
    {
      label: t('v2Overview.lastFetchLabel', 'Last fetch'),
      value: showConnectedSummaryMeta
        ? formatDateTime(importStatus.link?.lastFetchedAt)
        : '-',
    },
  ];
  const compactSupportStatusItems =
    supportWorkflowStep === 2
      ? [
          {
            label: t('v2Overview.selectedYearsLabel', 'Selected years'),
            value: String(selectedBaselineYears.length),
            detail: selectedBaselineYearsLabel,
          },
          {
            label: t('v2Overview.wizardSummaryReadyYears', 'Ready years'),
            value: String(readyBaselineYears.length),
            detail: readyBaselineYearsLabel,
          },
        ]
      : [wizardSummaryItems[1], wizardSummaryItems[2]].filter(
          (item): item is (typeof wizardSummaryItems)[number] => item != null,
        );
  const supportStatusItems = useCompactSetupSupportChrome
    ? compactSupportStatusItems
    : wizardSummaryItems;
  const nextAction = (() => {
    if (isManageYearsMaintenanceMode) {
      return {
        title: t('v2Overview.wizardQuestionReviewYears'),
        body: `${t('v2Overview.wizardSummaryImportedYears')}: ${activeImportedReviewYearsLabel}`,
      };
    }

    if (overviewVisualStep === 2) {
      return {
        title: hasPostImportYearTruth
          ? t('v2Overview.wizardQuestionReviewYears')
          : t('v2Overview.importYearsButton'),
        body: hasPostImportYearTruth
          ? `${t('v2Overview.wizardSummaryImportedYears')}: ${activeImportedReviewYearsLabel}`
          : selectedBaselineYears.length > 0
            ? `${t('v2Overview.selectedYearsLabel')}: ${selectedBaselineYears.join(', ')}`
            : t('v2Overview.noYearsSelected'),
      };
    }

    if (overviewVisualStep === 3) {
      if (hasBlockedReviewRows) {
        return {
          title: t('v2Overview.blockedYearsTitle'),
          body:
            controller.reviewStatusRows
              .filter((row) => row.setupStatus === 'needs_attention')
              .map((row) => String(row.year))
              .join(', ') || t('v2Overview.noYearsSelected'),
        };
      }
      if (hasPendingReviewRows) {
        return {
          title: t('v2Overview.wizardQuestionReviewYears'),
          body: readyYearsLabel,
        };
      }
      return {
        title: t('v2Overview.createPlanningBaseline'),
        body: t('v2Overview.reviewContinueReadyBody'),
      };
    }

    if (overviewVisualStep === 4) {
      return {
        title: t('v2Overview.createPlanningBaseline'),
        body: planningBaselineSummaryDetail,
      };
    }

    return {
      title: wizardHero.badge,
      body: wizardHero.title,
    };
  })();
  const connectButtonClass =
    overviewVisualStep === 1 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const importYearsButtonClass =
    overviewVisualStep === 2 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const reviewContinueButtonClass =
    overviewVisualStep === 2 || overviewVisualStep === 3
      ? 'v2-btn v2-btn-primary'
      : 'v2-btn';
  const planningBaselineButtonClass =
    overviewVisualStep === 4 ? 'v2-btn v2-btn-primary' : 'v2-btn';
  const openForecastButtonClass =
    overviewVisualStep === PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS
      ? 'v2-btn v2-btn-primary'
      : 'v2-btn';
  const showSimplifiedPostChoiceSetup =
    activeVesinvestPlan != null &&
    mountedWorkflowStep === 3 &&
    controller.confirmedImportedYears.length === 0 &&
    !controller.baselineReady;
  const shouldCompactPlanningPanel =
    !showSimplifiedPostChoiceSetup &&
    (mountedWorkflowStep === 3 || mountedWorkflowStep === 4);
  const shouldShowVesinvestPanel =
    mountedWorkflowStep >= 3 &&
    (importStatus.connected === true || activeVesinvestPlan != null);
  const useSupportRail =
    overviewVisualStep !== PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS;
  const useReviewDominantLayout =
    mountedWorkflowStep === 3 || mountedWorkflowStep === 4;
  const supportingChromeEyebrow = useCompactSetupSupportChrome
    ? t('v2Overview.wizardSummaryTitle')
    : t('v2Overview.wizardLabel');
  const supportingChromeTitle = useCompactSetupSupportChrome
    ? t('v2Overview.wizardSummarySubtitle')
    : wizardHero.title;
  const showSupportNextActionBlock =
    !useReviewDominantLayout && overviewVisualStep !== 4;
  const demotePlanningPanelInSetup =
    shouldShowVesinvestPanel &&
    overviewVisualStep >= 2 &&
    overviewVisualStep <= PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS;
  const collapsePlanningPanelInSetup = demotePlanningPanelInSetup;

  return {
    activeVesinvestPlan,
    collapsePlanningPanelInSetup,
    compactSupportingChrome,
    connectButtonClass,
    correctedYearsLabel,
    demotePlanningPanelInSetup,
    handoffExcludedYearsSorted,
    hasBaselineBudget,
    importStatus,
    importYearsButtonClass,
    includedPlanningYearsLabel,
    isManageYearsMaintenanceMode,
    isStep2SupportChrome,
    mountedWorkflowStep,
    nextAction,
    openForecastButtonClass,
    overviewVisualStep,
    planningBaselineButtonClass,
    reviewContinueButtonClass,
    selectedOrgBusinessId,
    selectedOrgMunicipality,
    selectedOrgName,
    shouldCompactPlanningPanel,
    shouldShowVesinvestPanel,
    showSimplifiedPostChoiceSetup,
    showSupportNextActionBlock,
    summaryMetaBlocks,
    supportingChromeEyebrow,
    supportingChromeTitle,
    supportStatusItems,
    supportWorkflowStep,
    technicalReadyYearsLabel,
    useCompactSetupSupportChrome,
    useCompactWorkspaceLayout,
    useReviewDominantLayout,
    useSupportRail,
  };
}
