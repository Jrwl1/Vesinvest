import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  clearImportAndScenariosV2,
  getForecastScenarioV2,
  getImportStatusV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  type DecodedToken,
} from '../api';
import { applyOrganizationDefaultLanguage } from '../i18n';
import { OverviewPageV2 } from './OverviewPageV2';
import { AppShellV2AccountDrawer, AppShellV2BlockedTabNotice, AppShellV2Header, AppShellV2LanguageNotice } from './appShellV2Chrome';
import {
  EnnustePageV2,
  ReportsPageV2,
  getInitialTabFromLocation,
  readForecastRuntimeState,
  syncBrowserPath,
  type ForecastRuntimeState,
  type OrgLanguageNotice,
  type OverviewFocusTarget,
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

export const AppShellV2: React.FC<Props> = ({ tokenInfo, isDemoMode, onLogout }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    const initialTab = getInitialTabFromLocation();
    return initialTab === 'overview' ? initialTab : 'overview';
  });
  const [pendingPathTab, setPendingPathTab] = React.useState<TabId | null>(() => {
    const initialTab = getInitialTabFromLocation();
    return initialTab === 'overview' ? null : initialTab;
  });
  const [setupTruthBootstrapped, setSetupTruthBootstrapped] = React.useState(
    () => getInitialTabFromLocation() === 'overview',
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [reportsRefreshTick, setReportsRefreshTick] = React.useState(0);
  const [focusedReportId, setFocusedReportId] = React.useState<string | null>(null);
  const [workspaceResetVersion, setWorkspaceResetVersion] = React.useState(0);
  const [forecastRuntimeState, setForecastRuntimeState] =
    React.useState<ForecastRuntimeState>(readForecastRuntimeState);
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearError, setClearError] = React.useState<string | null>(null);
  const [clearConfirmValue, setClearConfirmValue] = React.useState('');
  const [setupBackSignal, setSetupBackSignal] = React.useState(0);
  const [setupWizardState, setSetupWizardState] = React.useState<SetupWizardState | null>(null);
  const [setupPlanState, setSetupPlanState] =
    React.useState<WorkspaceBootstrapSnapshot['planState']>(null);
  const [savedFeePathReportConflictPlanId, setSavedFeePathReportConflictPlanId] =
    React.useState<string | null>(null);
  const [overviewFocusTarget, setOverviewFocusTarget] = React.useState<OverviewFocusTarget | null>(
    null,
  );
  const [setupOrgName, setSetupOrgName] = React.useState<string | null>(null);
  const [orgLanguageNotice, setOrgLanguageNotice] = React.useState<OrgLanguageNotice | null>(
    null,
  );
  const [blockedTabNotice, setBlockedTabNotice] = React.useState<TabId | null>(null);
  const initialOverviewBootstrapPendingRef = React.useRef(getInitialTabFromLocation() === 'overview');

  const tabLabels: Record<TabId, string> = {
    overview: t('v2Shell.tabs.overview', 'Overview'),
    ennuste: t('v2Shell.tabs.forecast', 'Forecast'),
    reports: t('v2Shell.tabs.reports', 'Reports'),
  };

  const activeTabLabel = tabLabels[activeTab];
  const isBootstrappingPathTruth = pendingPathTab != null && !setupTruthBootstrapped;
  const bootstrappingTargetTab = pendingPathTab ?? activeTab;
  const shellSurfaceTab = activeTab;
  const bootstrappingTargetLabel = tabLabels[bootstrappingTargetTab];
  const hasSelectedUtility = typeof setupOrgName === 'string' && setupOrgName.trim().length > 0;
  const linkedSavedFeePathScenarioId = setupPlanState?.linkedScenarioId ?? null;
  const runtimeScenarioOffLinkedFeePath =
    activeTab === 'ennuste' &&
    setupWizardState?.reportsUnlocked === true &&
    typeof linkedSavedFeePathScenarioId === 'string' &&
    linkedSavedFeePathScenarioId.length > 0 &&
    typeof forecastRuntimeState.selectedScenarioId === 'string' &&
    forecastRuntimeState.selectedScenarioId.length > 0 &&
    forecastRuntimeState.selectedScenarioId !== linkedSavedFeePathScenarioId;
  const savedFeePathReportReady =
    setupWizardState?.reportsUnlocked === true &&
    !runtimeScenarioOffLinkedFeePath &&
    savedFeePathReportConflictPlanId !== setupPlanState?.activePlanId &&
    (setupPlanState == null ||
      (setupPlanState.classificationReviewRequired !== true &&
        setupPlanState.pricingStatus === 'verified' &&
        setupPlanState.baselineChangedSinceAcceptedRevision !== true &&
        setupPlanState.investmentPlanChangedSinceFeeRecommendation !== true));
  const shellSetupStep = setupWizardState?.currentStep ?? 1;
  const shellPresentedStep = getPresentedOverviewWorkflowStep(shellSetupStep);
  const showCompletedOverviewWorkspace =
    activeTab === 'overview' && !!setupWizardState?.reportsUnlocked && hasSelectedUtility;
  const connectionChipToneClass = isBootstrappingPathTruth
    ? 'v2-status-neutral'
    : isDemoMode
      ? 'v2-status-info'
      : !hasSelectedUtility
        ? 'v2-status-warning'
        : setupWizardState?.reportsUnlocked && !runtimeScenarioOffLinkedFeePath
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
    activeTab === 'overview' && setupWizardState && !showCompletedOverviewWorkspace
      ? resolvePreviousSetupStep(setupWizardState)
      : null;
  const shellBackLabel =
    shellBackStep === 1 || shellBackStep === 2
      ? t('v2Shell.backToIdentity', 'Back to utility identity')
      : shellBackStep === 3
        ? t('v2Shell.backToInvestmentPlan', 'Back to investment plan')
        : shellBackStep === 5
          ? t('v2Shell.backToBaseline', 'Back to baseline')
          : null;

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const clearOrgLanguageNotice = React.useCallback(() => {
    setOrgLanguageNotice(null);
  }, []);

  const applySetupWizardState = React.useCallback((nextState: SetupWizardState) => {
    setSetupWizardState((prev) => {
      if (
        prev?.currentStep === nextState.currentStep &&
        prev?.recommendedStep === nextState.recommendedStep &&
        prev?.activeStep === nextState.activeStep &&
        prev?.selectedProblemYear === nextState.selectedProblemYear &&
        prev?.transitions.reviewContinue === nextState.transitions.reviewContinue &&
        prev?.transitions.selectProblemYear === nextState.transitions.selectProblemYear &&
        prev?.wizardComplete === nextState.wizardComplete &&
        prev?.forecastUnlocked === nextState.forecastUnlocked &&
        prev?.reportsUnlocked === nextState.reportsUnlocked &&
        prev?.summary.importedYearCount === nextState.summary.importedYearCount &&
        prev?.summary.readyYearCount === nextState.summary.readyYearCount &&
        prev?.summary.blockedYearCount === nextState.summary.blockedYearCount &&
        prev?.summary.excludedYearCount === nextState.summary.excludedYearCount &&
        prev?.summary.baselineReady === nextState.summary.baselineReady
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  const applySetupPlanState = React.useCallback((nextState: WorkspaceBootstrapSnapshot['planState']) => {
    setSetupPlanState((prev) => {
      setSavedFeePathReportConflictPlanId((current) => {
        if (!current) {
          return current;
        }
        if (!nextState?.activePlanId || nextState.activePlanId !== current) {
          return null;
        }
        if (
          nextState.pricingStatus === 'verified' &&
          nextState.classificationReviewRequired !== true &&
          nextState.baselineChangedSinceAcceptedRevision !== true &&
          nextState.investmentPlanChangedSinceFeeRecommendation !== true
        ) {
          return null;
        }
        if (
          prev?.activePlanId === nextState.activePlanId &&
          prev.linkedScenarioId &&
          nextState.linkedScenarioId &&
          nextState.linkedScenarioId !== prev.linkedScenarioId
        ) {
          return null;
        }
        return current;
      });
      if (
        prev?.activePlanId === nextState?.activePlanId &&
        prev?.linkedScenarioId === nextState?.linkedScenarioId &&
        prev?.classificationReviewRequired === nextState?.classificationReviewRequired &&
        prev?.pricingStatus === nextState?.pricingStatus &&
        prev?.baselineChangedSinceAcceptedRevision ===
          nextState?.baselineChangedSinceAcceptedRevision &&
        prev?.investmentPlanChangedSinceFeeRecommendation ===
          nextState?.investmentPlanChangedSinceFeeRecommendation
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

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
      selectedScenario = await getForecastScenarioV2(workflowPlan.selectedScenarioId).catch(
        () => null,
      );
      if (selectedScenario == null) {
        const scenarioList = await listForecastScenariosV2().catch(() => null);
        selectedScenario =
          scenarioList?.find((item) => item.id === workflowPlan.selectedScenarioId) ?? null;
      }
    }

    if (importStatus.link?.uiLanguage) {
      void applyOrganizationDefaultLanguage(importStatus.link.uiLanguage);
    }

    return {
      orgName: workflowPlan?.utilityName ?? importStatus.link?.nimi ?? null,
      wizardState: resolveSetupWizardStateFromImportStatus(importStatus, planningContext, {
        selectedScenario,
      }),
      planState: workflowPlan
        ? {
            activePlanId: workflowPlan.id ?? null,
            linkedScenarioId: workflowPlan.selectedScenarioId ?? null,
            classificationReviewRequired: workflowPlan.classificationReviewRequired === true,
            pricingStatus: workflowPlan.pricingStatus ?? null,
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
  }, [applySetupOrgName, applySetupPlanState, applySetupWizardState, loadWorkspaceBootstrapSnapshot]);

  const isTabLockedForState = React.useCallback((tab: TabId, state: SetupWizardState | null) => {
    if (tab === 'overview' || !state) {
      return false;
    }
    return tab === 'ennuste' ? !state.forecastUnlocked : !state.reportsUnlocked;
  }, []);

  const isTabLocked = React.useCallback((tab: TabId) => isTabLockedForState(tab, setupWizardState), [isTabLockedForState, setupWizardState]);

  const handleLockedTabAttempt = React.useCallback((tab: TabId) => {
    setBlockedTabNotice(tab);
    sendV2OpsEvent({
      event: 'tab_change_blocked',
      status: 'warn',
      attrs: {
        tab,
        reason: setupWizardState?.activeStep != null ? `wizard_step_${setupWizardState.activeStep}` : 'wizard_incomplete',
      },
    });
  }, [setupWizardState]);

  const reportsNeedFeePathRecovery =
    blockedTabNotice === 'reports' &&
    setupWizardState?.forecastUnlocked === true &&
    !!setupPlanState?.activePlanId &&
    !savedFeePathReportReady;

  const lockedTabMessage = React.useCallback((tab: TabId) => {
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
      return t(
        'v2Vesinvest.workflowCreateReportBody',
        'Create the report after the fee path is saved and the linked scenario is up to date.',
      );
    }
    return t(
      'v2Shell.tabLockedHint',
      'Complete the setup steps before opening this workspace.',
    );
  }, [setupPlanState?.classificationReviewRequired, setupWizardState?.forecastUnlocked, t]);

  const handleGoToForecast = React.useCallback((scenarioId?: string | null) => {
    const hasScenarioTarget = typeof scenarioId === 'string' && scenarioId.trim().length > 0;
    if (!hasScenarioTarget && isTabLocked('ennuste')) {
      handleLockedTabAttempt('ennuste');
      return;
    }
    closeDrawer();
    setBlockedTabNotice(null);
    if (hasScenarioTarget) {
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId ? prev : { ...prev, selectedScenarioId: scenarioId },
      );
    }
    setActiveTab('ennuste');
    syncBrowserPath('ennuste');
    if (hasScenarioTarget) {
      void refreshWorkspaceTruth().catch(() => undefined);
    }
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked, refreshWorkspaceTruth]);

  const handleGoToForecastFromReport = React.useCallback((scenarioId?: string | null) => {
    if (isTabLocked('ennuste')) {
      handleLockedTabAttempt('ennuste');
      return;
    }
    closeDrawer();
    if (scenarioId) {
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId ? prev : { ...prev, selectedScenarioId: scenarioId },
      );
    }
    setActiveTab('ennuste');
    setBlockedTabNotice(null);
    syncBrowserPath('ennuste');
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked]);

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

  const handleGoToOverviewFeePath = React.useCallback((planId?: string | null) => {
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
    setOverviewFocusTarget(targetPlanId ? { kind: 'saved_fee_path', planId: targetPlanId } : null);
    setActiveTab('overview');
    syncBrowserPath('overview');
  }, [closeDrawer, setupPlanState?.activePlanId, setupPlanState?.linkedScenarioId]);

  const lockedTabActionLabel = React.useCallback((tab: TabId) => {
    if (tab === 'reports' && setupWizardState?.forecastUnlocked && reportsNeedFeePathRecovery) {
      return t('v2Vesinvest.openPricing', 'Open fee path');
    }
    if (tab === 'reports' && setupWizardState?.forecastUnlocked) {
      return t('v2Reports.openForecast', 'Open Forecast');
    }
    return t('v2Shell.tabs.overview', 'Overview');
  }, [reportsNeedFeePathRecovery, setupWizardState?.forecastUnlocked, t]);

  const handleLockedTabRecovery = React.useCallback(() => {
    if (!blockedTabNotice) {
      return;
    }
    if (blockedTabNotice === 'reports' && setupWizardState?.forecastUnlocked) {
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
    handleGoToOverviewFeePath,
    reportsNeedFeePathRecovery,
    setupPlanState?.activePlanId,
    setupPlanState?.linkedScenarioId,
    setupWizardState?.forecastUnlocked,
  ]);

  const showBlockedTabRecoveryAction =
    blockedTabNotice === 'reports' && setupWizardState?.forecastUnlocked
      ? true
      : blockedTabNotice != null && activeTab !== 'overview';

  const handleSavedFeePathReportConflict = React.useCallback((planId?: string | null) => {
    const targetPlanId = planId ?? setupPlanState?.activePlanId ?? null;
    setSavedFeePathReportConflictPlanId(targetPlanId);
  }, [setupPlanState?.activePlanId]);

  const handleReportCreated = React.useCallback((reportId: string) => {
    closeDrawer();
    setFocusedReportId(reportId);
    setReportsRefreshTick((prev) => prev + 1);
    setActiveTab('reports');
    setBlockedTabNotice(null);
    syncBrowserPath('reports');
  }, [closeDrawer]);

  const handleTabChange = React.useCallback((tab: TabId) => {
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
  }, [activeTab, closeDrawer, handleLockedTabAttempt, isTabLocked]);

  const handleSetupWizardStateChange = React.useCallback((nextState: SetupWizardState) => {
    applySetupWizardState(nextState);
    setSetupTruthBootstrapped(true);
  }, [applySetupWizardState]);

  const handleSetupPlanStateChange = React.useCallback((nextState: WorkspaceBootstrapSnapshot['planState']) => {
    applySetupPlanState(nextState);
    setSetupTruthBootstrapped(true);
  }, [applySetupPlanState]);

  const handleSetupOrgNameChange = React.useCallback((name: string | null) => {
    applySetupOrgName(name);
  }, [applySetupOrgName]);

  const isAdmin = React.useMemo(
    () => (tokenInfo?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN'),
    [tokenInfo?.roles],
  );

  const clearConfirmToken = tokenInfo?.org_id ? tokenInfo.org_id.slice(0, 8).toUpperCase() : 'CLEAR';
  const clearConfirmMatches = clearConfirmValue.trim().toUpperCase() === clearConfirmToken;

  const runWorkspaceReset = React.useCallback(async (confirmToken: string) => {
    setClearBusy(true);
    try {
      const result = await clearImportAndScenariosV2(confirmToken.trim());
      applySetupWizardState(resolveSetupWizardStateFromImportStatus(result.status, null));
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
      clearOrgLanguageNotice();
      setBlockedTabNotice(null);
      setActiveTab('overview');
      syncBrowserPath('overview', 'replace');
      return result;
    } finally {
      setClearBusy(false);
    }
  }, [applySetupOrgName, applySetupPlanState, applySetupWizardState, clearOrgLanguageNotice]);

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

    setClearError(null);
    try {
      await runWorkspaceReset(clearConfirmValue.trim());
      closeDrawer();
    } catch (err) {
      setClearError(
        err instanceof Error
          ? err.message
          : t('v2Shell.clearDataFailed', 'Database clear failed.'),
      );
    }
  }, [clearConfirmMatches, clearConfirmValue, closeDrawer, runWorkspaceReset, t]);

  const handleForecastScenarioSelection = React.useCallback((scenarioId: string | null) => {
    setForecastRuntimeState((prev) =>
      prev.selectedScenarioId === scenarioId ? prev : { ...prev, selectedScenarioId: scenarioId },
    );
  }, []);

  const handleFocusedReportChange = React.useCallback((reportId: string | null, scenarioId: string | null) => {
    setFocusedReportId(reportId);
    if (!scenarioId) {
      return;
    }
    setForecastRuntimeState((prev) =>
      prev.selectedScenarioId === scenarioId ? prev : { ...prev, selectedScenarioId: scenarioId },
    );
  }, []);

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

  const orgShort = tokenInfo?.org_id ? tokenInfo.org_id.slice(0, 8).toUpperCase() : '-';
  const orgChipName = isBootstrappingPathTruth
    ? t('v2Shell.workspaceResolving', 'Resolving...')
    : hasSelectedUtility
      ? setupOrgName
      : t('v2Shell.orgNotSelected', 'No utility selected');
  const orgChipHash = hasSelectedUtility && !isBootstrappingPathTruth ? orgShort : null;
  const orgChipLabel = orgChipHash ? `${orgChipName} / ${orgChipHash}` : orgChipName;
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
        handleClearImportAndScenarios={handleClearImportAndScenarios}
        isDemoMode={isDemoMode}
        onLogout={onLogout}
      />

      <main className="v2-main-content">
        <div className="v2-main-content-inner">
          <React.Suspense
            fallback={<div className="v2-loading">{t('common.loading', 'Loading...')}</div>}
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
              <div key={`${activeTab}:${workspaceResetVersion}`} className="v2-tab-panel">
                {activeTab === 'overview' ? (
                  <OverviewPageV2
                    onGoToForecast={handleGoToForecast}
                    onGoToReports={handleGoToReports}
                    isAdmin={isAdmin}
                    overviewFocusTarget={overviewFocusTarget}
                    onOverviewFocusTargetConsumed={() => setOverviewFocusTarget(null)}
                    onSavedFeePathReportConflict={handleSavedFeePathReportConflict}
                    onSetupWizardStateChange={handleSetupWizardStateChange}
                    onSetupPlanStateChange={handleSetupPlanStateChange}
                    onSetupOrgNameChange={handleSetupOrgNameChange}
                    onOrgLanguageNoticeChange={setOrgLanguageNotice}
                    setupBackSignal={setupBackSignal}
                  />
                ) : null}
                {activeTab === 'ennuste' ? (
                  <EnnustePageV2
                    onReportCreated={handleReportCreated}
                    initialScenarioId={forecastRuntimeState.selectedScenarioId}
                    onScenarioSelectionChange={handleForecastScenarioSelection}
                    onGoToOverviewFeePath={handleGoToOverviewFeePath}
                    onComputedVersionChange={() => {
                      void refreshWorkspaceTruth().catch(() => undefined);
                    }}
                  />
                ) : null}
                {activeTab === 'reports' ? (
                  <ReportsPageV2
                    refreshToken={reportsRefreshTick}
                    focusedReportId={focusedReportId}
                    onGoToForecast={handleGoToForecastFromReport}
                    onGoToOverviewFeePath={handleGoToOverviewFeePath}
                    savedFeePathPlanId={setupPlanState?.activePlanId ?? null}
                    savedFeePathScenarioId={setupPlanState?.linkedScenarioId ?? null}
                    savedFeePathPricingStatus={setupPlanState?.pricingStatus ?? null}
                    savedFeePathClassificationReviewRequired={
                      setupPlanState?.classificationReviewRequired ?? false
                    }
                    savedFeePathBaselineChangedSinceAcceptedRevision={
                      setupPlanState?.baselineChangedSinceAcceptedRevision ?? false
                    }
                    savedFeePathInvestmentPlanChangedSinceFeeRecommendation={
                      setupPlanState?.investmentPlanChangedSinceFeeRecommendation ?? false
                    }
                    savedFeePathReportConflictActive={
                      savedFeePathReportConflictPlanId === (setupPlanState?.activePlanId ?? null)
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
