import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  clearImportAndScenariosV2,
  getForecastScenarioV2,
  getImportStatusV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  requestImportClearChallengeV2,
  type DecodedToken,
  type V2ImportClearChallenge,
} from '../api';
import { applyOrganizationDefaultLanguage } from '../i18n';
import {
  AppShellV2AccountDrawer,
  AppShellV2BlockedTabNotice,
  AppShellV2Header,
  AppShellV2LanguageNotice,
} from './appShellV2Chrome';
import {
  AssetManagementPageV2,
  EnnustePageV2,
  getInitialTabFromLocation,
  OverviewPageV2,
  readForecastRuntimeState,
  ReportsPageV2,
  syncBrowserPath,
  TariffPlanPageV2,
  type ForecastRuntimeState,
  type OrgLanguageNotice,
  type OverviewFocusTarget,
  type TabStatus,
  type TabId,
  type WorkspaceBootstrapSnapshot,
} from './appShellV2Routing';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  getPresentedOverviewWorkflowStep,
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  resolvePreviousSetupStep,
  resolveSetupWizardStateFromImportStatus,
  type SetupWizardState,
} from './overviewWorkflow';
import { useAppShellV2BrowserEffects } from './useAppShellV2BrowserEffects';

type Props = {
  tokenInfo: DecodedToken | null;
  isDemoMode: boolean;
  onLogout: () => void;
};

type BootstrapScenario = {
  updatedAt?: string | null;
  computedFromUpdatedAt?: string | null;
  years?: unknown[];
  computedYears?: number | null;
  yearlyInvestments?: Array<{
    amount?: number | null;
    depreciationRuleSnapshot?: unknown;
  }>;
};

const isBootstrapScenarioComputedFresh = (
  scenario: BootstrapScenario | null,
): boolean => {
  if (!scenario) {
    return false;
  }
  const hasComputedRows = Array.isArray(scenario.years)
    ? scenario.years.length > 0
    : (scenario.computedYears ?? 0) > 0;
  if (
    !hasComputedRows ||
    !scenario.updatedAt ||
    !scenario.computedFromUpdatedAt ||
    scenario.computedFromUpdatedAt !== scenario.updatedAt
  ) {
    return false;
  }
  return !(
    scenario.yearlyInvestments?.some(
      (row) => (row.amount ?? 0) > 0 && !row.depreciationRuleSnapshot,
    ) ?? false
  );
};

export const AppShellV2: React.FC<Props> = ({
  tokenInfo,
  isDemoMode,
  onLogout,
}) => {
  const { t } = useTranslation();
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    const initialTab = getInitialTabFromLocation();
    return initialTab === 'overview' ? initialTab : 'overview';
  });
  const [pendingPathTab, setPendingPathTab] = React.useState<TabId | null>(
    () => {
      const initialTab = getInitialTabFromLocation();
      return initialTab === 'overview' ? null : initialTab;
    },
  );
  const [setupTruthBootstrapped, setSetupTruthBootstrapped] = React.useState(
    () => getInitialTabFromLocation() === 'overview',
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [reportsRefreshTick, setReportsRefreshTick] = React.useState(0);
  const [focusedReportId, setFocusedReportId] = React.useState<string | null>(
    null,
  );
  const [workspaceResetVersion, setWorkspaceResetVersion] = React.useState(0);
  const [forecastRuntimeState, setForecastRuntimeState] =
    React.useState<ForecastRuntimeState>(readForecastRuntimeState);
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearError, setClearError] = React.useState<string | null>(null);
  const [clearConfirmValue, setClearConfirmValue] = React.useState('');
  const [clearChallenge, setClearChallenge] =
    React.useState<V2ImportClearChallenge | null>(null);
  const [clearChallengeLoading, setClearChallengeLoading] =
    React.useState(false);
  const [setupBackSignal, setSetupBackSignal] = React.useState(0);
  const [setupWizardState, setSetupWizardState] =
    React.useState<SetupWizardState | null>(null);
  const [setupPlanState, setSetupPlanState] =
    React.useState<WorkspaceBootstrapSnapshot['planState']>(null);
  const [
    savedFeePathReportConflictPlanId,
    setSavedFeePathReportConflictPlanId,
  ] = React.useState<string | null>(null);
  const [overviewFocusTarget, setOverviewFocusTarget] =
    React.useState<OverviewFocusTarget | null>(null);
  const [setupOrgName, setSetupOrgName] = React.useState<string | null>(null);
  const [orgLanguageNotice, setOrgLanguageNotice] =
    React.useState<OrgLanguageNotice | null>(null);
  const [blockedTabNotice, setBlockedTabNotice] = React.useState<TabId | null>(
    null,
  );
  const initialOverviewBootstrapPendingRef = React.useRef(
    getInitialTabFromLocation() === 'overview',
  );

  const tabLabels: Record<TabId, string> = {
    overview: t('v2Shell.tabs.overview', 'Overview'),
    asset_management: t('v2Shell.tabs.assetManagement', 'Asset Management'),
    ennuste: t('v2Shell.tabs.forecast', 'Forecast'),
    tariff_plan: t('v2Shell.tabs.tariffPlan', 'Tariff Plan'),
    reports: t('v2Shell.tabs.reports', 'Reports'),
  };

  const activeTabLabel = tabLabels[activeTab];
  const isBootstrappingPathTruth =
    pendingPathTab != null && !setupTruthBootstrapped;
  const bootstrappingTargetTab = pendingPathTab ?? activeTab;
  const shellSurfaceTab = activeTab;
  const bootstrappingTargetLabel = tabLabels[bootstrappingTargetTab];
  const hasSelectedUtility =
    typeof setupOrgName === 'string' && setupOrgName.trim().length > 0;
  const linkedSavedFeePathScenarioId = setupPlanState?.linkedScenarioId ?? null;
  const runtimeScenarioOffLinkedFeePath =
    activeTab === 'ennuste' &&
    setupWizardState?.reportsUnlocked === true &&
    typeof linkedSavedFeePathScenarioId === 'string' &&
    linkedSavedFeePathScenarioId.length > 0 &&
    typeof forecastRuntimeState.selectedScenarioId === 'string' &&
    forecastRuntimeState.selectedScenarioId.length > 0 &&
    forecastRuntimeState.selectedScenarioId !== linkedSavedFeePathScenarioId;
  const assetEvidenceSatisfied =
    setupPlanState?.assetEvidenceReady === true &&
    setupPlanState.assetEvidenceMissingCount === 0;
  const currentReportReady =
    setupWizardState?.forecastUnlocked === true &&
    setupPlanState != null &&
    !runtimeScenarioOffLinkedFeePath &&
    savedFeePathReportConflictPlanId !== setupPlanState.activePlanId &&
    setupPlanState.classificationReviewRequired !== true &&
    assetEvidenceSatisfied &&
    setupPlanState.pricingStatus === 'verified' &&
    setupPlanState.tariffPlanStatus === 'accepted' &&
    setupPlanState.linkedScenarioComputedFresh === true &&
    setupPlanState.baselineChangedSinceAcceptedRevision !== true &&
    setupPlanState.investmentPlanChangedSinceFeeRecommendation !== true;
  const savedFeePathReportReady = currentReportReady;
  const shellSetupStep = setupWizardState?.currentStep ?? 1;
  const shellPresentedStep = getPresentedOverviewWorkflowStep(shellSetupStep);
  const showCompletedOverviewWorkspace =
    activeTab === 'overview' &&
    !!setupWizardState?.reportsUnlocked &&
    hasSelectedUtility;
  const connectionChipToneClass = isBootstrappingPathTruth
    ? 'v2-status-neutral'
    : isDemoMode
    ? 'v2-status-info'
    : !hasSelectedUtility
    ? 'v2-status-warning'
    : savedFeePathReportReady
    ? 'v2-status-positive'
    : 'v2-status-info';
  const connectionChipLabel = isBootstrappingPathTruth
    ? t('v2Shell.workspaceLoading', 'Checking workspace')
    : isDemoMode
    ? t('v2Shell.demoMode', 'Demo mode')
    : !hasSelectedUtility
    ? t('v2Shell.planRequired', 'Create Vesinvest plan')
    : savedFeePathReportReady
    ? t('v2Shell.reportReady', 'Report-ready scenario')
    : t('v2Shell.planInProgress', 'Vesinvest in progress');
  const pageIndicatorLabel = isBootstrappingPathTruth
    ? bootstrappingTargetLabel
    : showCompletedOverviewWorkspace
    ? activeTabLabel
    : activeTab === 'overview' && setupWizardState
    ? t('v2Shell.setupStepLabel', 'Step {{step}} / {{total}}', {
        step: shellPresentedStep,
        total: PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
      })
    : !hasSelectedUtility
    ? t('v2Shell.planRequired', 'Create Vesinvest plan')
    : activeTabLabel;
  const pageIndicatorCaption = isBootstrappingPathTruth
    ? t('v2Shell.workspaceLoadingLabel', 'Loading workspace')
    : showCompletedOverviewWorkspace
    ? t('v2Shell.activeWorkspace', 'Active workspace')
    : activeTab === 'overview' && setupWizardState
    ? t('v2Shell.workflowMode', 'Vesinvest workflow')
    : !hasSelectedUtility
    ? t('v2Shell.planStatus', 'Plan status')
    : t('v2Shell.activeWorkspace', 'Active workspace');
  const shellBackStep =
    activeTab === 'overview' &&
    setupWizardState &&
    !showCompletedOverviewWorkspace
      ? resolvePreviousSetupStep(setupWizardState)
      : null;
  const shellBackLabel =
    shellBackStep === 1 || shellBackStep === 2
      ? t('v2Shell.backToIdentity', 'Back to utility identity')
      : shellBackStep === 3
      ? t('v2Shell.backToInvestmentPlan', 'Back to year review')
      : shellBackStep === 5
      ? t('v2Shell.backToBaseline', 'Back to baseline')
      : null;

  const tabStatuses = React.useMemo<Record<TabId, TabStatus>>(() => {
    const statusLabels = {
      notStarted: t('v2Shell.statusNotStarted', 'Not started'),
      needsWork: t('v2Shell.statusNeedsWork', 'Needs work'),
      ready: t('v2Shell.statusReady', 'Ready'),
      fresh: t('v2Shell.statusFresh', 'Fresh'),
      available: t('v2Shell.statusAvailable', 'Available'),
      blocked: t('v2Shell.statusBlocked', 'Blocked'),
      accepted: t('v2Shell.statusAccepted', 'Accepted'),
      stale: t('v2Shell.statusStale', 'Stale'),
    };
    const status = (tone: TabStatus['tone'], label: string): TabStatus => ({
      tone,
      label,
    });
    const baselineVerified = setupWizardState?.forecastUnlocked === true;
    const hasBlockingBaselineYears =
      (setupWizardState?.summary.blockedYearCount ?? 0) > 0 &&
      !baselineVerified;
    const hasPlan = setupPlanState?.activePlanId != null;
    const hasHardPlanBlocker =
      setupPlanState?.classificationReviewRequired === true;

    return {
      overview: !hasSelectedUtility
        ? status('neutral', statusLabels.notStarted)
        : baselineVerified
        ? status('positive', statusLabels.accepted)
        : hasBlockingBaselineYears
        ? status('danger', statusLabels.blocked)
        : status('warning', statusLabels.needsWork),
      asset_management: !hasPlan
        ? status('neutral', statusLabels.notStarted)
        : hasHardPlanBlocker
        ? status('danger', statusLabels.blocked)
        : setupPlanState?.investmentPlanReady === true && assetEvidenceSatisfied
        ? status('positive', statusLabels.ready)
        : status('warning', statusLabels.needsWork),
      ennuste: !baselineVerified
        ? status('neutral', statusLabels.notStarted)
        : runtimeScenarioOffLinkedFeePath
        ? status('warning', statusLabels.stale)
        : setupPlanState?.linkedScenarioComputedFresh === true
        ? status('positive', statusLabels.fresh)
        : setupPlanState?.linkedScenarioId
        ? status('warning', statusLabels.stale)
        : status('warning', statusLabels.needsWork),
      tariff_plan: !baselineVerified
        ? status('neutral', statusLabels.notStarted)
        : hasHardPlanBlocker
        ? status('danger', statusLabels.blocked)
        : setupPlanState?.tariffPlanStatus === 'accepted'
        ? status('positive', statusLabels.accepted)
        : setupPlanState?.tariffPlanStatus === 'stale'
        ? status('warning', statusLabels.stale)
        : status('warning', statusLabels.needsWork),
      reports: !baselineVerified
        ? status('neutral', statusLabels.notStarted)
        : hasHardPlanBlocker
        ? status('danger', statusLabels.blocked)
        : currentReportReady
        ? status('positive', statusLabels.available)
        : status('warning', statusLabels.needsWork),
    };
  }, [
    currentReportReady,
    hasSelectedUtility,
    runtimeScenarioOffLinkedFeePath,
    setupPlanState?.activePlanId,
    assetEvidenceSatisfied,
    setupPlanState?.classificationReviewRequired,
    setupPlanState?.investmentPlanReady,
    setupPlanState?.linkedScenarioComputedFresh,
    setupPlanState?.linkedScenarioId,
    setupPlanState?.tariffPlanStatus,
    setupWizardState?.forecastUnlocked,
    setupWizardState?.summary.blockedYearCount,
    t,
  ]);

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const clearOrgLanguageNotice = React.useCallback(() => {
    setOrgLanguageNotice(null);
  }, []);

  const applySetupWizardState = React.useCallback(
    (nextState: SetupWizardState) => {
      setSetupWizardState((prev) => {
        if (
          prev?.currentStep === nextState.currentStep &&
          prev?.recommendedStep === nextState.recommendedStep &&
          prev?.activeStep === nextState.activeStep &&
          prev?.selectedProblemYear === nextState.selectedProblemYear &&
          prev?.transitions.reviewContinue ===
            nextState.transitions.reviewContinue &&
          prev?.transitions.selectProblemYear ===
            nextState.transitions.selectProblemYear &&
          prev?.wizardComplete === nextState.wizardComplete &&
          prev?.forecastUnlocked === nextState.forecastUnlocked &&
          prev?.reportsUnlocked === nextState.reportsUnlocked &&
          prev?.summary.importedYearCount ===
            nextState.summary.importedYearCount &&
          prev?.summary.readyYearCount === nextState.summary.readyYearCount &&
          prev?.summary.blockedYearCount ===
            nextState.summary.blockedYearCount &&
          prev?.summary.excludedYearCount ===
            nextState.summary.excludedYearCount &&
          prev?.summary.baselineReady === nextState.summary.baselineReady
        ) {
          return prev;
        }
        return nextState;
      });
    },
    [],
  );

  const applySetupPlanState = React.useCallback(
    (nextState: WorkspaceBootstrapSnapshot['planState']) => {
      setSetupPlanState((prev) => {
        const mergedState =
          nextState && prev?.activePlanId === nextState.activePlanId
            ? {
                ...prev,
                ...nextState,
                linkedScenarioComputedFresh:
                  nextState.linkedScenarioComputedFresh ??
                  prev.linkedScenarioComputedFresh,
              }
            : nextState;
        setSavedFeePathReportConflictPlanId((current) => {
          if (!current) {
            return current;
          }
          if (
            !mergedState?.activePlanId ||
            mergedState.activePlanId !== current
          ) {
            return null;
          }
          if (
            mergedState.pricingStatus === 'verified' &&
            mergedState.tariffPlanStatus === 'accepted' &&
            mergedState.linkedScenarioComputedFresh === true &&
            mergedState.classificationReviewRequired !== true &&
            mergedState.assetEvidenceReady === true &&
            mergedState.assetEvidenceMissingCount === 0 &&
            mergedState.baselineChangedSinceAcceptedRevision !== true &&
            mergedState.investmentPlanChangedSinceFeeRecommendation !== true
          ) {
            return null;
          }
          if (
            prev?.activePlanId === mergedState.activePlanId &&
            prev.linkedScenarioId &&
            mergedState.linkedScenarioId &&
            mergedState.linkedScenarioId !== prev.linkedScenarioId
          ) {
            return null;
          }
          return current;
        });
        if (
          prev?.activePlanId === mergedState?.activePlanId &&
          prev?.linkedScenarioId === mergedState?.linkedScenarioId &&
          prev?.investmentPlanReady === mergedState?.investmentPlanReady &&
          prev?.linkedScenarioComputedFresh ===
            mergedState?.linkedScenarioComputedFresh &&
          prev?.classificationReviewRequired ===
            mergedState?.classificationReviewRequired &&
          prev?.assetEvidenceReady === mergedState?.assetEvidenceReady &&
          prev?.assetEvidenceMissingCount ===
            mergedState?.assetEvidenceMissingCount &&
          prev?.pricingStatus === mergedState?.pricingStatus &&
          prev?.tariffPlanStatus === mergedState?.tariffPlanStatus &&
          prev?.baselineChangedSinceAcceptedRevision ===
            mergedState?.baselineChangedSinceAcceptedRevision &&
          prev?.investmentPlanChangedSinceFeeRecommendation ===
            mergedState?.investmentPlanChangedSinceFeeRecommendation
        ) {
          return prev;
        }
        return mergedState;
      });
    },
    [],
  );

  const applySetupOrgName = React.useCallback((name: string | null) => {
    setSetupOrgName((prev) => (prev === name ? prev : name));
  }, []);

  const loadWorkspaceBootstrapSnapshot = React.useCallback(async () => {
    const [importStatus, planningContext] = await Promise.all([
      getImportStatusV2(),
      getPlanningContextV2().catch(() => null),
    ]);
    const activePlan = planningContext?.vesinvest?.activePlan ?? null;
    const selectedPlan = planningContext?.vesinvest?.selectedPlan ?? null;
    const workflowPlan = activePlan ?? selectedPlan;
    let selectedScenario = null;

    if (workflowPlan?.selectedScenarioId != null) {
      selectedScenario = await getForecastScenarioV2(
        workflowPlan.selectedScenarioId,
      ).catch(() => null);
      if (selectedScenario == null) {
        const scenarioList = await listForecastScenariosV2().catch(() => null);
        selectedScenario =
          scenarioList?.find(
            (item) => item.id === workflowPlan.selectedScenarioId,
          ) ?? null;
      }
    }

    if (importStatus.link?.uiLanguage) {
      void applyOrganizationDefaultLanguage(importStatus.link.uiLanguage);
    }

    return {
      orgName: workflowPlan?.utilityName ?? importStatus.link?.nimi ?? null,
      wizardState: resolveSetupWizardStateFromImportStatus(
        importStatus,
        planningContext,
        {
          selectedScenario,
        },
      ),
      planState: workflowPlan
        ? {
            activePlanId: workflowPlan.id ?? null,
            linkedScenarioId: workflowPlan.selectedScenarioId ?? null,
            investmentPlanReady:
              (workflowPlan.projectCount ?? 0) > 0 &&
              (workflowPlan.totalInvestmentAmount ?? 0) > 0,
            linkedScenarioComputedFresh:
              isBootstrapScenarioComputedFresh(selectedScenario),
            classificationReviewRequired:
              workflowPlan.classificationReviewRequired === true,
            assetEvidenceReady:
              workflowPlan.assetEvidenceReady === true &&
              workflowPlan.assetEvidenceMissingCount === 0,
            assetEvidenceMissingCount: workflowPlan.assetEvidenceMissingCount,
            pricingStatus: workflowPlan.pricingStatus ?? null,
            tariffPlanStatus: workflowPlan.tariffPlanStatus ?? null,
            baselineChangedSinceAcceptedRevision:
              workflowPlan.baselineChangedSinceAcceptedRevision === true,
            investmentPlanChangedSinceFeeRecommendation:
              workflowPlan.investmentPlanChangedSinceFeeRecommendation === true,
          }
        : null,
    } satisfies WorkspaceBootstrapSnapshot;
  }, []);

  const refreshWorkspaceTruth = React.useCallback(async () => {
    const snapshot = await loadWorkspaceBootstrapSnapshot();
    applySetupWizardState(snapshot.wizardState);
    applySetupPlanState(snapshot.planState);
    applySetupOrgName(snapshot.orgName);
    setSetupTruthBootstrapped(true);
    return snapshot;
  }, [
    applySetupOrgName,
    applySetupPlanState,
    applySetupWizardState,
    loadWorkspaceBootstrapSnapshot,
  ]);

  const isTabLockedForState = React.useCallback(
    (tab: TabId, state: SetupWizardState | null) => {
      if (tab === 'overview' || !state) {
        return false;
      }
      return !state.forecastUnlocked;
    },
    [],
  );

  const isTabLocked = React.useCallback(
    (tab: TabId) => isTabLockedForState(tab, setupWizardState),
    [isTabLockedForState, setupWizardState],
  );

  const isTabLockedForSnapshot = React.useCallback(
    (tab: TabId, snapshot: WorkspaceBootstrapSnapshot) => {
      if (tab === 'overview') {
        return false;
      }
      return !snapshot.wizardState.forecastUnlocked;
    },
    [],
  );

  const handleLockedTabAttempt = React.useCallback(
    (tab: TabId) => {
      setBlockedTabNotice(tab);
      sendV2OpsEvent({
        event: 'tab_change_blocked',
        status: 'warn',
        attrs: {
          tab,
          reason:
            setupWizardState?.activeStep != null
              ? `wizard_step_${setupWizardState.activeStep}`
              : 'wizard_incomplete',
        },
      });
    },
    [setupWizardState],
  );

  const getLockedPathFallbackTab = React.useCallback(
    (tab: TabId, state: SetupWizardState | null): TabId => {
      if (tab === 'reports' && state?.forecastUnlocked) {
        if (setupPlanState?.classificationReviewRequired) {
          return 'asset_management';
        }
        if (!assetEvidenceSatisfied) {
          return 'asset_management';
        }
        if (setupPlanState?.tariffPlanStatus !== 'accepted') {
          return 'tariff_plan';
        }
        return 'ennuste';
      }
      return 'overview';
    },
    [
      setupPlanState?.classificationReviewRequired,
      assetEvidenceSatisfied,
      setupPlanState?.tariffPlanStatus,
    ],
  );

  const getLockedPathFallbackTabForSnapshot = React.useCallback(
    (tab: TabId, snapshot: WorkspaceBootstrapSnapshot): TabId => {
      if (tab === 'reports' && snapshot.wizardState.forecastUnlocked) {
        if (snapshot.planState?.classificationReviewRequired) {
          return 'asset_management';
        }
        if (
          snapshot.planState?.assetEvidenceReady !== true ||
          snapshot.planState.assetEvidenceMissingCount !== 0
        ) {
          return 'asset_management';
        }
        if (snapshot.planState?.tariffPlanStatus !== 'accepted') {
          return 'tariff_plan';
        }
        return 'ennuste';
      }
      return 'overview';
    },
    [],
  );

  const reportsNeedFeePathRecovery =
    blockedTabNotice === 'reports' &&
    setupWizardState?.forecastUnlocked === true &&
    !!setupPlanState?.activePlanId &&
    !savedFeePathReportReady;

  const lockedTabMessage = React.useCallback(
    (tab: TabId) => {
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        setupPlanState?.classificationReviewRequired
      ) {
        return t(
          'v2Forecast.classificationReviewRequired',
          'Review and save the Vesinvest class plan before creating a report.',
        );
      }
      if (tab === 'reports' && setupWizardState?.forecastUnlocked) {
        if (!assetEvidenceSatisfied) {
          return t(
            'v2Vesinvest.assetEvidenceReportBlocked',
            'Complete asset-management evidence before creating reports.',
          );
        }
        if (setupPlanState?.tariffPlanStatus !== 'accepted') {
          return t(
            'v2TariffPlan.acceptBeforeReports',
            'Accept the tariff plan before creating reports.',
          );
        }
        return t(
          'v2Vesinvest.workflowCreateReportBody',
          'Create the report after the tariff plan is accepted and the linked scenario is up to date.',
        );
      }
      return t(
        'v2Shell.tabLockedHint',
        'Complete the setup steps before opening this workspace.',
      );
    },
    [
      setupPlanState?.classificationReviewRequired,
      assetEvidenceSatisfied,
      setupPlanState?.tariffPlanStatus,
      setupWizardState?.forecastUnlocked,
      t,
    ],
  );

  const handleGoToForecast = React.useCallback(
    (scenarioId?: string | null) => {
      const hasScenarioTarget =
        typeof scenarioId === 'string' && scenarioId.trim().length > 0;
      if (!hasScenarioTarget && isTabLocked('ennuste')) {
        handleLockedTabAttempt('ennuste');
        return;
      }
      closeDrawer();
      setBlockedTabNotice(null);
      if (hasScenarioTarget) {
        setForecastRuntimeState((prev) =>
          prev.selectedScenarioId === scenarioId
            ? prev
            : { ...prev, selectedScenarioId: scenarioId },
        );
      }
      setActiveTab('ennuste');
      syncBrowserPath('ennuste');
      if (hasScenarioTarget) {
        void refreshWorkspaceTruth().catch(() => undefined);
      }
    },
    [closeDrawer, handleLockedTabAttempt, isTabLocked, refreshWorkspaceTruth],
  );

  const handleGoToForecastFromReport = React.useCallback(
    (scenarioId?: string | null) => {
      if (isTabLocked('ennuste')) {
        handleLockedTabAttempt('ennuste');
        return;
      }
      closeDrawer();
      if (scenarioId) {
        setForecastRuntimeState((prev) =>
          prev.selectedScenarioId === scenarioId
            ? prev
            : { ...prev, selectedScenarioId: scenarioId },
        );
      }
      setActiveTab('ennuste');
      setBlockedTabNotice(null);
      syncBrowserPath('ennuste');
    },
    [closeDrawer, handleLockedTabAttempt, isTabLocked],
  );

  const handleGoToAssetManagement = React.useCallback(() => {
    if (isTabLocked('asset_management')) {
      handleLockedTabAttempt('asset_management');
      return;
    }
    closeDrawer();
    setBlockedTabNotice(null);
    setActiveTab('asset_management');
    syncBrowserPath('asset_management');
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked]);

  const handleGoToTariffPlan = React.useCallback(
    (scenarioId?: string | null) => {
      if (isTabLocked('tariff_plan')) {
        handleLockedTabAttempt('tariff_plan');
        return;
      }
      closeDrawer();
      setBlockedTabNotice(null);
      if (scenarioId) {
        setForecastRuntimeState((prev) =>
          prev.selectedScenarioId === scenarioId
            ? prev
            : { ...prev, selectedScenarioId: scenarioId },
        );
      }
      setActiveTab('tariff_plan');
      syncBrowserPath('tariff_plan');
      void refreshWorkspaceTruth().catch(() => undefined);
    },
    [closeDrawer, handleLockedTabAttempt, isTabLocked, refreshWorkspaceTruth],
  );

  const handleGoToReports = React.useCallback(() => {
    if (isTabLocked('reports')) {
      handleLockedTabAttempt('reports');
      return;
    }
    closeDrawer();
    setBlockedTabNotice(null);
    setActiveTab('reports');
    syncBrowserPath('reports');
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked]);

  const handleGoToOverviewFeePath = React.useCallback(
    (planId?: string | null) => {
      closeDrawer();
      setBlockedTabNotice(null);
      const targetPlanId = planId ?? setupPlanState?.activePlanId ?? null;
      setSavedFeePathReportConflictPlanId(targetPlanId);
      const targetScenarioId = setupPlanState?.linkedScenarioId ?? null;
      if (targetScenarioId) {
        setForecastRuntimeState((prev) =>
          prev.selectedScenarioId === targetScenarioId
            ? prev
            : { ...prev, selectedScenarioId: targetScenarioId },
        );
      }
      setOverviewFocusTarget(
        targetPlanId ? { kind: 'saved_fee_path', planId: targetPlanId } : null,
      );
      setActiveTab('tariff_plan');
      syncBrowserPath('tariff_plan');
    },
    [
      closeDrawer,
      setupPlanState?.activePlanId,
      setupPlanState?.linkedScenarioId,
    ],
  );

  const lockedTabActionLabel = React.useCallback(
    (tab: TabId) => {
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        setupPlanState?.classificationReviewRequired
      ) {
        return t('v2Shell.tabs.assetManagement', 'Asset Management');
      }
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        !assetEvidenceSatisfied
      ) {
        return t('v2Shell.tabs.assetManagement', 'Asset Management');
      }
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        setupPlanState?.tariffPlanStatus !== 'accepted'
      ) {
        return t('v2Shell.tabs.tariffPlan', 'Tariff Plan');
      }
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        reportsNeedFeePathRecovery
      ) {
        return t('v2Shell.tabs.tariffPlan', 'Tariff Plan');
      }
      if (tab === 'reports' && setupWizardState?.forecastUnlocked) {
        return t('v2Reports.openForecast', 'Open Forecast');
      }
      return t('v2Shell.tabs.overview', 'Overview');
    },
    [
      reportsNeedFeePathRecovery,
      setupPlanState?.classificationReviewRequired,
      assetEvidenceSatisfied,
      setupPlanState?.tariffPlanStatus,
      setupWizardState?.forecastUnlocked,
      t,
    ],
  );

  const handleLockedTabRecovery = React.useCallback(() => {
    if (!blockedTabNotice) {
      return;
    }
    if (blockedTabNotice === 'reports' && setupWizardState?.forecastUnlocked) {
      if (setupPlanState?.classificationReviewRequired) {
        handleGoToAssetManagement();
        return;
      }
      if (!assetEvidenceSatisfied) {
        handleGoToAssetManagement();
        return;
      }
      if (setupPlanState?.tariffPlanStatus !== 'accepted') {
        handleGoToTariffPlan(setupPlanState?.linkedScenarioId ?? null);
        return;
      }
      if (reportsNeedFeePathRecovery && setupPlanState?.activePlanId) {
        handleGoToOverviewFeePath(setupPlanState.activePlanId);
        return;
      }
      handleGoToForecast(setupPlanState?.linkedScenarioId ?? null);
      return;
    }
    closeDrawer();
    setBlockedTabNotice(null);
    setActiveTab('overview');
    syncBrowserPath('overview', 'replace');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [
    blockedTabNotice,
    closeDrawer,
    handleGoToForecast,
    handleGoToTariffPlan,
    handleGoToAssetManagement,
    handleGoToOverviewFeePath,
    assetEvidenceSatisfied,
    reportsNeedFeePathRecovery,
    setupPlanState?.activePlanId,
    setupPlanState?.assetEvidenceReady,
    setupPlanState?.classificationReviewRequired,
    setupPlanState?.linkedScenarioId,
    setupWizardState?.forecastUnlocked,
  ]);

  const showBlockedTabRecoveryAction =
    blockedTabNotice === 'reports' && setupWizardState?.forecastUnlocked
      ? true
      : blockedTabNotice != null && activeTab !== 'overview';

  const handleSavedFeePathReportConflict = React.useCallback(
    (planId?: string | null) => {
      const targetPlanId = planId ?? setupPlanState?.activePlanId ?? null;
      setSavedFeePathReportConflictPlanId(targetPlanId);
    },
    [setupPlanState?.activePlanId],
  );

  const handleReportCreated = React.useCallback(
    (reportId: string) => {
      closeDrawer();
      setFocusedReportId(reportId);
      setReportsRefreshTick((prev) => prev + 1);
      setActiveTab('reports');
      setBlockedTabNotice(null);
      syncBrowserPath('reports');
    },
    [closeDrawer],
  );

  const handleTabChange = React.useCallback(
    (tab: TabId) => {
      closeDrawer();
      if (isTabLocked(tab)) {
        handleLockedTabAttempt(tab);
        return;
      }
      if (tab !== activeTab) {
        setActiveTab(tab);
        setBlockedTabNotice(null);
        syncBrowserPath(tab);
      }
      sendV2OpsEvent({ event: 'tab_change', status: 'ok', attrs: { tab } });
    },
    [activeTab, closeDrawer, handleLockedTabAttempt, isTabLocked],
  );

  const handleSetupWizardStateChange = React.useCallback(
    (nextState: SetupWizardState) => {
      applySetupWizardState(nextState);
      setSetupTruthBootstrapped(true);
    },
    [applySetupWizardState],
  );

  const handleSetupPlanStateChange = React.useCallback(
    (nextState: WorkspaceBootstrapSnapshot['planState']) => {
      applySetupPlanState(nextState);
      setSetupTruthBootstrapped(true);
    },
    [applySetupPlanState],
  );

  const handleSetupOrgNameChange = React.useCallback(
    (name: string | null) => {
      applySetupOrgName(name);
    },
    [applySetupOrgName],
  );

  const isAdmin = React.useMemo(
    () =>
      (tokenInfo?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN'),
    [tokenInfo?.roles],
  );

  const requestClearChallenge = React.useCallback(async () => {
    if (!isAdmin) {
      setClearChallenge(null);
      return;
    }
    setClearChallengeLoading(true);
    try {
      const challenge = await requestImportClearChallengeV2();
      setClearChallenge(challenge);
      setClearConfirmValue('');
    } catch (err) {
      setClearChallenge(null);
      setClearError(
        err instanceof Error
          ? err.message
          : tRef.current(
              'v2Shell.clearDataChallengeFailed',
              'Could not prepare the database clear confirmation code.',
            ),
      );
    } finally {
      setClearChallengeLoading(false);
    }
  }, [isAdmin]);

  React.useEffect(() => {
    if (!drawerOpen) {
      setClearConfirmValue('');
      setClearChallenge(null);
      return;
    }
    if (isAdmin) {
      setClearError(null);
      void requestClearChallenge();
    }
  }, [drawerOpen, isAdmin, requestClearChallenge]);

  const clearConfirmToken = clearChallenge?.confirmToken ?? '';
  const clearConfirmMatches =
    clearConfirmToken.length > 0 &&
    clearConfirmValue.trim().toUpperCase() === clearConfirmToken;

  const runWorkspaceReset = React.useCallback(
    async (challengeId: string, confirmToken: string) => {
      setClearBusy(true);
      try {
        const result = await clearImportAndScenariosV2({
          challengeId,
          confirmToken: confirmToken.trim(),
        });
        applySetupWizardState(
          resolveSetupWizardStateFromImportStatus(result.status, null),
        );
        applySetupPlanState(null);
        setOverviewFocusTarget(null);
        applySetupOrgName(result.status.link?.nimi ?? null);
        setSetupTruthBootstrapped(true);
        setPendingPathTab(null);
        setForecastRuntimeState({ selectedScenarioId: null });
        setFocusedReportId(null);
        setReportsRefreshTick(0);
        setWorkspaceResetVersion((prev) => prev + 1);
        setClearConfirmValue('');
        setClearChallenge(null);
        clearOrgLanguageNotice();
        setBlockedTabNotice(null);
        setActiveTab('overview');
        syncBrowserPath('overview', 'replace');
        return result;
      } finally {
        setClearBusy(false);
      }
    },
    [
      applySetupOrgName,
      applySetupPlanState,
      applySetupWizardState,
      clearOrgLanguageNotice,
    ],
  );

  const handleClearImportAndScenarios = React.useCallback(async () => {
    if (!clearConfirmMatches) {
      setClearError(
        t(
          'v2Shell.clearDataTypeMismatch',
          'Confirmation text did not match. Database was not cleared.',
        ),
      );
      return;
    }
    if (!clearChallenge) {
      setClearError(
        t(
          'v2Shell.clearDataChallengeMissing',
          'Request a new confirmation code before clearing the database.',
        ),
      );
      return;
    }

    setClearError(null);
    try {
      await runWorkspaceReset(
        clearChallenge.challengeId,
        clearConfirmValue.trim(),
      );
      closeDrawer();
    } catch (err) {
      setClearChallenge(null);
      void requestClearChallenge();
      setClearError(
        err instanceof Error
          ? err.message
          : t('v2Shell.clearDataFailed', 'Database clear failed.'),
      );
    }
  }, [
    clearChallenge,
    clearConfirmMatches,
    clearConfirmValue,
    closeDrawer,
    requestClearChallenge,
    runWorkspaceReset,
    t,
  ]);

  const handleForecastScenarioSelection = React.useCallback(
    (scenarioId: string | null) => {
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId
          ? prev
          : { ...prev, selectedScenarioId: scenarioId },
      );
    },
    [],
  );

  const handleFocusedReportChange = React.useCallback(
    (reportId: string | null, scenarioId: string | null) => {
      setFocusedReportId(reportId);
      if (!scenarioId) {
        return;
      }
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId
          ? prev
          : { ...prev, selectedScenarioId: scenarioId },
      );
    },
    [],
  );

  useAppShellV2BrowserEffects({
    pendingPathTab,
    setPendingPathTab,
    setupTruthBootstrapped,
    setSetupTruthBootstrapped,
    setupWizardState,
    hasSelectedUtility,
    activeTab,
    setActiveTab,
    setBlockedTabNotice,
    isTabLockedForState,
    isTabLockedForSnapshot,
    getLockedPathFallbackTab,
    getLockedPathFallbackTabForSnapshot,
    isTabLocked,
    refreshWorkspaceTruth,
    loadWorkspaceBootstrapSnapshot,
    applySetupWizardState,
    applySetupPlanState,
    applySetupOrgName,
    initialOverviewBootstrapPendingRef,
    forecastRuntimeState,
    drawerOpen,
    setDrawerOpen,
    shellSurfaceTab,
  });

  const orgShort = tokenInfo?.org_id
    ? tokenInfo.org_id.slice(0, 8).toUpperCase()
    : '-';
  const orgChipName = isBootstrappingPathTruth
    ? t('v2Shell.workspaceResolving', 'Resolving...')
    : hasSelectedUtility
    ? setupOrgName
    : t('v2Shell.orgNotSelected', 'No utility selected');
  const orgChipHash =
    hasSelectedUtility && !isBootstrappingPathTruth ? orgShort : null;
  const orgChipLabel = orgChipHash
    ? `${orgChipName} / ${orgChipHash}`
    : orgChipName;
  const roleText = tokenInfo?.roles?.join(', ') ?? '-';

  return (
    <div
      className={`v2-app-shell ${
        shellSurfaceTab === 'ennuste'
          ? 'v2-app-shell-forecast'
          : shellSurfaceTab === 'reports'
          ? 'v2-app-shell-reports'
          : ''
      }`.trim()}
    >
      <AppShellV2Header
        t={t}
        activeTab={activeTab}
        tabLabels={tabLabels}
        tabStatuses={tabStatuses}
        shellBackLabel={shellBackLabel}
        onBack={() => setSetupBackSignal((prev) => prev + 1)}
        pageIndicatorCaption={pageIndicatorCaption}
        pageIndicatorLabel={pageIndicatorLabel}
        isTabLocked={isTabLocked}
        lockedTabMessage={lockedTabMessage}
        handleTabChange={handleTabChange}
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        connectionChipToneClass={connectionChipToneClass}
        connectionChipLabel={connectionChipLabel}
        orgChipLabel={orgChipLabel}
        orgChipName={orgChipName}
      />

      <AppShellV2LanguageNotice
        t={t}
        orgLanguageNotice={orgLanguageNotice}
        clearOrgLanguageNotice={clearOrgLanguageNotice}
      />

      <AppShellV2BlockedTabNotice
        t={t}
        blockedTabNotice={blockedTabNotice}
        tabLabels={tabLabels}
        lockedTabMessage={lockedTabMessage}
        showBlockedTabRecoveryAction={showBlockedTabRecoveryAction}
        handleLockedTabRecovery={handleLockedTabRecovery}
        lockedTabActionLabel={lockedTabActionLabel}
        clearBlockedTabNotice={() => setBlockedTabNotice(null)}
      />

      <AppShellV2AccountDrawer
        t={t}
        drawerOpen={drawerOpen}
        closeDrawer={closeDrawer}
        orgChipLabel={orgChipLabel}
        roleText={roleText}
        activeTabLabel={activeTabLabel}
        isAdmin={isAdmin}
        clearBusy={clearBusy}
        clearError={clearError}
        clearConfirmValue={clearConfirmValue}
        setClearConfirmValue={(value) => {
          setClearConfirmValue(value);
          if (clearError) {
            setClearError(null);
          }
        }}
        clearConfirmMatches={clearConfirmMatches}
        clearConfirmToken={clearConfirmToken}
        clearChallengeLoading={clearChallengeLoading}
        handleClearImportAndScenarios={handleClearImportAndScenarios}
        isDemoMode={isDemoMode}
        onLogout={onLogout}
      />

      <main className="v2-main-content">
        <div className="v2-main-content-inner">
          <React.Suspense
            fallback={
              <div className="v2-loading">
                {t('common.loading', 'Loading...')}
              </div>
            }
          >
            {isBootstrappingPathTruth ? (
              <div className="v2-card v2-loading-state v2-tab-panel">
                <p>{t('common.loading', 'Loading...')}</p>
                <p className="v2-muted">
                  {t(
                    'v2Shell.workspaceLoadingBody',
                    'Checking workspace access and route state...',
                  )}
                </p>
                <span className="v2-skeleton-line" />
                <span className="v2-skeleton-line" />
              </div>
            ) : (
              <div
                key={`${activeTab}:${workspaceResetVersion}`}
                className="v2-tab-panel"
              >
                {activeTab === 'overview' ? (
                  <OverviewPageV2
                    onGoToAssetManagement={handleGoToAssetManagement}
                    onGoToForecast={handleGoToForecast}
                    onGoToReports={handleGoToReports}
                    isAdmin={isAdmin}
                    overviewFocusTarget={overviewFocusTarget}
                    onOverviewFocusTargetConsumed={() =>
                      setOverviewFocusTarget(null)
                    }
                    onSavedFeePathReportConflict={
                      handleSavedFeePathReportConflict
                    }
                    onSetupWizardStateChange={handleSetupWizardStateChange}
                    onSetupPlanStateChange={handleSetupPlanStateChange}
                    onSetupOrgNameChange={handleSetupOrgNameChange}
                    onOrgLanguageNoticeChange={setOrgLanguageNotice}
                    setupBackSignal={setupBackSignal}
                  />
                ) : null}
                {activeTab === 'asset_management' ? (
                  <AssetManagementPageV2
                    isAdmin={isAdmin}
                    onGoToForecast={handleGoToForecast}
                    onGoToTariffPlan={handleGoToTariffPlan}
                    onGoToReports={handleGoToReports}
                    onWorkspaceChanged={() => {
                      void refreshWorkspaceTruth().catch(() => undefined);
                    }}
                  />
                ) : null}
                {activeTab === 'ennuste' ? (
                  <EnnustePageV2
                    onReportCreated={handleReportCreated}
                    initialScenarioId={forecastRuntimeState.selectedScenarioId}
                    onScenarioSelectionChange={handleForecastScenarioSelection}
                    onGoToAssetManagement={handleGoToAssetManagement}
                    onGoToOverviewFeePath={handleGoToOverviewFeePath}
                    onComputedVersionChange={() => {
                      void refreshWorkspaceTruth().catch(() => undefined);
                    }}
                  />
                ) : null}
                {activeTab === 'tariff_plan' ? (
                  <TariffPlanPageV2
                    onGoToAssetManagement={handleGoToAssetManagement}
                    onGoToForecast={handleGoToForecast}
                    onGoToReports={handleGoToReports}
                    onTariffPlanAccepted={() => {
                      void refreshWorkspaceTruth().catch(() => undefined);
                    }}
                  />
                ) : null}
                {activeTab === 'reports' ? (
                  <ReportsPageV2
                    refreshToken={reportsRefreshTick}
                    focusedReportId={focusedReportId}
                    onGoToAssetManagement={handleGoToAssetManagement}
                    onGoToForecast={handleGoToForecastFromReport}
                    onGoToOverviewFeePath={handleGoToOverviewFeePath}
                    savedFeePathPlanRequired={
                      setupWizardState?.forecastUnlocked === true
                    }
                    savedFeePathPlanId={setupPlanState?.activePlanId ?? null}
                    savedFeePathScenarioId={
                      setupPlanState?.linkedScenarioId ?? null
                    }
                    savedFeePathPricingStatus={
                      setupPlanState?.pricingStatus ?? null
                    }
                    savedFeePathTariffPlanStatus={
                      setupPlanState?.tariffPlanStatus ?? null
                    }
                    savedFeePathClassificationReviewRequired={
                      setupPlanState?.classificationReviewRequired ?? false
                    }
                    savedFeePathAssetEvidenceReady={
                      setupPlanState?.assetEvidenceReady ?? false
                    }
                    savedFeePathBaselineChangedSinceAcceptedRevision={
                      setupPlanState?.baselineChangedSinceAcceptedRevision ??
                      false
                    }
                    savedFeePathInvestmentPlanChangedSinceFeeRecommendation={
                      setupPlanState?.investmentPlanChangedSinceFeeRecommendation ??
                      false
                    }
                    savedFeePathReportConflictActive={
                      savedFeePathReportConflictPlanId ===
                      (setupPlanState?.activePlanId ?? null)
                    }
                    onFocusedReportChange={handleFocusedReportChange}
                  />
                ) : null}
              </div>
            )}
          </React.Suspense>
        </div>
      </main>
    </div>
  );
};
