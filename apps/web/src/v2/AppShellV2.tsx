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
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import {
  applyManualLanguagePreference,
  applyOrganizationDefaultLanguage,
} from '../i18n';
import { OverviewPageV2 } from './OverviewPageV2';
import { sendV2OpsEvent } from './opsTelemetry';
import {
  getPresentedOverviewWorkflowStep,
  PRESENTED_OVERVIEW_WORKFLOW_TOTAL_STEPS,
  resolvePreviousSetupStep,
  resolveSetupWizardStateFromImportStatus,
  type SetupWizardState,
} from './overviewWorkflow';

let ennustePageModulePromise: Promise<typeof import('./EnnustePageV2')> | null =
  null;
let reportsPageModulePromise: Promise<typeof import('./ReportsPageV2')> | null =
  null;

function loadEnnustePageModule() {
  if (!ennustePageModulePromise) {
    ennustePageModulePromise = import('./EnnustePageV2');
  }
  return ennustePageModulePromise;
}

function loadReportsPageModule() {
  if (!reportsPageModulePromise) {
    reportsPageModulePromise = import('./ReportsPageV2');
  }
  return reportsPageModulePromise;
}

const EnnustePageV2 = React.lazy(async () => {
  const mod = await loadEnnustePageModule();
  return { default: mod.EnnustePageV2 };
});

const ReportsPageV2 = React.lazy(async () => {
  const mod = await loadReportsPageModule();
  return { default: mod.ReportsPageV2 };
});

function preloadTab(tab: TabId): void {
  if (tab === 'ennuste') {
    void loadEnnustePageModule();
  }
  if (tab === 'reports') {
    void loadReportsPageModule();
  }
}

type TabId = 'overview' | 'ennuste' | 'reports';

type ForecastRuntimeState = {
  selectedScenarioId: string | null;
};

type WorkspaceBootstrapSnapshot = {
  orgName: string | null;
  wizardState: SetupWizardState;
  planState: {
    activePlanId: string | null;
    linkedScenarioId: string | null;
    classificationReviewRequired: boolean;
    pricingStatus: 'blocked' | 'provisional' | 'verified' | null;
    baselineChangedSinceAcceptedRevision: boolean;
    investmentPlanChangedSinceFeeRecommendation: boolean;
  } | null;
};

type OverviewFocusTarget = {
  kind: 'saved_fee_path';
  planId: string;
};

type OrgLanguageNotice = {
  kind: 'switched' | 'kept_manual';
  language: 'fi' | 'sv' | 'en';
  previousLanguage: 'fi' | 'sv' | 'en';
};

const TAB_PATHS: Record<TabId, string> = {
  overview: '/',
  ennuste: '/forecast',
  reports: '/reports',
};

const FORECAST_RUNTIME_STORAGE_KEY = 'v2_forecast_runtime_state';

function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '');
}

function resolveTabFromPath(pathname: string): TabId {
  const normalized = normalizePath(pathname);
  if (normalized === '/reports') return 'reports';
  if (normalized === '/forecast' || normalized === '/ennuste') {
    return 'ennuste';
  }
  return 'overview';
}

function getInitialTabFromLocation(): TabId {
  if (typeof window === 'undefined') return 'overview';
  return resolveTabFromPath(window.location.pathname);
}

function readForecastRuntimeState(): ForecastRuntimeState {
  if (typeof window === 'undefined') {
    return { selectedScenarioId: null };
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return { selectedScenarioId: null };
    }

    const parsed = JSON.parse(raw) as {
      selectedScenarioId?: unknown;
    };

    return {
      selectedScenarioId:
        typeof parsed.selectedScenarioId === 'string'
          ? parsed.selectedScenarioId
          : null,
    };
  } catch {
    return { selectedScenarioId: null };
  }
}

function syncBrowserPath(tab: TabId, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined') return;
  const targetPath = TAB_PATHS[tab];
  if (normalizePath(window.location.pathname) === targetPath) return;
  if (mode === 'replace') {
    window.history.replaceState(window.history.state, '', targetPath);
    return;
  }
  window.history.pushState(window.history.state, '', targetPath);
}

type Props = {
  tokenInfo: DecodedToken | null;
  isDemoMode: boolean;
  onLogout: () => void;
};

const TABS: TabId[] = ['overview', 'ennuste', 'reports'];

export const AppShellV2: React.FC<Props> = ({
  tokenInfo,
  isDemoMode,
  onLogout,
}) => {
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
  const [focusedReportId, setFocusedReportId] = React.useState<string | null>(
    null,
  );
  const [workspaceResetVersion, setWorkspaceResetVersion] = React.useState(0);
  const [forecastRuntimeState, setForecastRuntimeState] =
    React.useState<ForecastRuntimeState>(readForecastRuntimeState);
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearError, setClearError] = React.useState<string | null>(null);
  const [clearConfirmValue, setClearConfirmValue] = React.useState('');
  const [setupBackSignal, setSetupBackSignal] = React.useState(0);
  const [setupWizardState, setSetupWizardState] =
    React.useState<SetupWizardState | null>(null);
  const [setupPlanState, setSetupPlanState] =
    React.useState<WorkspaceBootstrapSnapshot['planState']>(null);
  const [savedFeePathReportConflictPlanId, setSavedFeePathReportConflictPlanId] =
    React.useState<string | null>(null);
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
    ennuste: t('v2Shell.tabs.forecast', 'Forecast'),
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
    activeTab === 'overview' &&
    !!setupWizardState?.reportsUnlocked &&
    hasSelectedUtility;
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
    shellBackStep === 1
      ? t('v2Shell.backToIdentity', 'Back to utility identity')
    : shellBackStep === 2
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
        prev?.transitions.selectProblemYear ===
          nextState.transitions.selectProblemYear &&
        prev?.wizardComplete === nextState.wizardComplete &&
        prev?.forecastUnlocked === nextState.forecastUnlocked &&
        prev?.reportsUnlocked === nextState.reportsUnlocked &&
        prev?.summary.importedYearCount ===
          nextState.summary.importedYearCount &&
        prev?.summary.readyYearCount === nextState.summary.readyYearCount &&
        prev?.summary.blockedYearCount === nextState.summary.blockedYearCount &&
        prev?.summary.excludedYearCount ===
          nextState.summary.excludedYearCount &&
        prev?.summary.baselineReady === nextState.summary.baselineReady
      ) {
        return prev;
      }
      return nextState;
    });
  }, []);

  const applySetupPlanState = React.useCallback(
    (nextState: WorkspaceBootstrapSnapshot['planState']) => {
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
          prev?.classificationReviewRequired ===
            nextState?.classificationReviewRequired &&
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
          scenarioList?.find((item) => item.id === workflowPlan.selectedScenarioId) ??
          null;
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
            classificationReviewRequired:
              workflowPlan.classificationReviewRequired === true,
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

  const isTabLockedForState = React.useCallback(
    (tab: TabId, state: SetupWizardState | null) => {
      if (tab === 'overview') return false;
      if (!state) return false;
      if (tab === 'ennuste') return !state.forecastUnlocked;
      return !state.reportsUnlocked;
    },
    [],
  );

  const isTabLocked = React.useCallback(
    (tab: TabId) => {
      return isTabLockedForState(tab, setupWizardState);
    },
    [isTabLockedForState, setupWizardState],
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
        return t(
          'v2Vesinvest.workflowCreateReportBody',
          'Create the report after the fee path is saved and the linked scenario is up to date.',
        );
      }
      return t(
        'v2Shell.tabLockedHint',
        'Complete the setup steps before opening this workspace.',
      );
    },
    [setupPlanState?.classificationReviewRequired, setupWizardState?.forecastUnlocked, t],
  );

  const handleGoToForecast = React.useCallback((scenarioId?: string | null) => {
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
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked, refreshWorkspaceTruth]);

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
        targetPlanId
          ? {
              kind: 'saved_fee_path',
              planId: targetPlanId,
            }
          : null,
      );
      setActiveTab('overview');
      syncBrowserPath('overview');
    },
    [closeDrawer, setupPlanState?.activePlanId, setupPlanState?.linkedScenarioId],
  );

  const lockedTabActionLabel = React.useCallback(
    (tab: TabId) => {
      if (
        tab === 'reports' &&
        setupWizardState?.forecastUnlocked &&
        reportsNeedFeePathRecovery
      ) {
        return t('v2Vesinvest.openPricing', 'Open fee path');
      }
      if (tab === 'reports' && setupWizardState?.forecastUnlocked) {
        return t('v2Reports.openForecast', 'Open Forecast');
      }
      return t('v2Shell.tabs.overview', 'Overview');
    },
    [reportsNeedFeePathRecovery, setupWizardState?.forecastUnlocked, t],
  );

  const handleLockedTabRecovery = React.useCallback(() => {
    if (!blockedTabNotice) return;
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
      sendV2OpsEvent({
        event: 'tab_change',
        status: 'ok',
        attrs: { tab },
      });
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

  const handleSetupOrgNameChange = React.useCallback((name: string | null) => {
    applySetupOrgName(name);
  }, [applySetupOrgName]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    if (pendingPathTab == null) {
      setSetupTruthBootstrapped(true);
      return;
    }

    const bootstrapSetupTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled) return;
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Ignore bootstrap fetch failure here; Overview will refresh truth once mounted.
      } finally {
        if (!cancelled) {
          setSetupTruthBootstrapped(true);
        }
      }
    };

    void bootstrapSetupTruth();

    return () => {
      cancelled = true;
    };
  }, [
    applySetupOrgName,
    applySetupPlanState,
    applySetupWizardState,
    loadWorkspaceBootstrapSnapshot,
    pendingPathTab,
  ]);

  React.useEffect(() => {
    if (pendingPathTab != null) return;
    if (!initialOverviewBootstrapPendingRef.current) return;
    initialOverviewBootstrapPendingRef.current = false;

    let cancelled = false;

    const bootstrapOverviewTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled) return;
        if (!snapshot.wizardState.reportsUnlocked) return;
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Ignore bootstrap fetch failure here; Overview can still hydrate shell truth.
      }
    };

    void bootstrapOverviewTruth();

    return () => {
      cancelled = true;
    };
  }, [
    applySetupOrgName,
    applySetupPlanState,
    applySetupWizardState,
    loadWorkspaceBootstrapSnapshot,
    pendingPathTab,
  ]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!setupTruthBootstrapped) return;
    if (activeTab === 'overview') return;
    if (setupWizardState && hasSelectedUtility) return;

    let cancelled = false;

    const rehydrateWorkspaceTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled) return;
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Keep the current shell state if the retry fails; the page surface can still render.
      }
    };

    void rehydrateWorkspaceTruth();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    applySetupOrgName,
    applySetupPlanState,
    applySetupWizardState,
    hasSelectedUtility,
    loadWorkspaceBootstrapSnapshot,
    setupTruthBootstrapped,
    setupWizardState,
  ]);

  React.useEffect(() => {
    if (!setupTruthBootstrapped) return;
    if (!pendingPathTab) return;
    if (setupWizardState != null) return;
    void refreshWorkspaceTruth().catch(() => undefined);
  }, [
    pendingPathTab,
    refreshWorkspaceTruth,
    setupTruthBootstrapped,
    setupWizardState,
  ]);

  React.useEffect(() => {
    if (!setupTruthBootstrapped) return;
    if (!pendingPathTab) return;
    if (!setupWizardState) return;

    if (isTabLockedForState(pendingPathTab, setupWizardState)) {
      setBlockedTabNotice(pendingPathTab);
      setActiveTab('overview');
      syncBrowserPath('overview', 'replace');
    } else {
      setActiveTab(pendingPathTab);
      setBlockedTabNotice(null);
      syncBrowserPath(pendingPathTab, 'replace');
    }
    setPendingPathTab(null);
  }, [
    isTabLockedForState,
    pendingPathTab,
    setupTruthBootstrapped,
    setupWizardState,
  ]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      const tabFromPath = resolveTabFromPath(window.location.pathname);
      if (!setupTruthBootstrapped && tabFromPath !== 'overview') {
        setPendingPathTab(tabFromPath);
        setActiveTab('overview');
        return;
      }
      if (
        tabFromPath !== 'overview' &&
        (!setupWizardState || isTabLockedForState(tabFromPath, setupWizardState))
      ) {
        setBlockedTabNotice(tabFromPath);
        setActiveTab('overview');
        syncBrowserPath('overview', 'replace');
        return;
      }
      setBlockedTabNotice(null);
      setPendingPathTab(null);
      setActiveTab(tabFromPath);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isTabLockedForState, setupTruthBootstrapped, setupWizardState]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      FORECAST_RUNTIME_STORAGE_KEY,
      JSON.stringify(forecastRuntimeState),
    );
  }, [forecastRuntimeState]);

  React.useEffect(() => {
    if (!drawerOpen || typeof window === 'undefined') return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const body = document.body;
    body.classList.remove('v2-body-forecast', 'v2-body-reports');
    if (shellSurfaceTab === 'ennuste') {
      body.classList.add('v2-body-forecast');
    }
    if (shellSurfaceTab === 'reports') {
      body.classList.add('v2-body-reports');
    }

    return () => {
      body.classList.remove('v2-body-forecast', 'v2-body-reports');
    };
  }, [shellSurfaceTab]);

  React.useEffect(() => {
    if (activeTab === 'overview') return;
    if (!setupWizardState) return;
    if (!isTabLocked(activeTab)) return;
    setBlockedTabNotice(activeTab);
    setActiveTab('overview');
    syncBrowserPath('overview', 'replace');
  }, [activeTab, isTabLocked, setupWizardState]);

  const isAdmin = React.useMemo(
    () =>
      (tokenInfo?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN'),
    [tokenInfo?.roles],
  );

  const clearConfirmToken = tokenInfo?.org_id
    ? tokenInfo.org_id.slice(0, 8).toUpperCase()
    : 'CLEAR';
  const clearConfirmMatches =
    clearConfirmValue.trim().toUpperCase() === clearConfirmToken;

  const runWorkspaceReset = React.useCallback(
    async (confirmToken: string) => {
      setClearBusy(true);
      try {
        const result = await clearImportAndScenariosV2(confirmToken.trim());
        applySetupWizardState(
          resolveSetupWizardStateFromImportStatus(result.status, null),
        );
        applySetupPlanState(null);
        setOverviewFocusTarget(null);
        applySetupOrgName(result.status.link?.nimi ?? null);
        setSetupTruthBootstrapped(true);
        setPendingPathTab(null);
        setForecastRuntimeState({
          selectedScenarioId: null,
        });
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
    },
    [applySetupOrgName, applySetupPlanState, applySetupWizardState, clearOrgLanguageNotice],
  );

  const handleClearImportAndScenarios = React.useCallback(async () => {
    // Destructive flow trace:
    // account drawer -> clearImportAndScenariosV2() -> POST /v2/import/clear
    // -> V2Service.clearImportAndScenarios().
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
  }, [
    clearConfirmMatches,
    clearConfirmValue,
    closeDrawer,
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
      if (!scenarioId) return;
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId
          ? prev
          : { ...prev, selectedScenarioId: scenarioId },
      );
    },
    [],
  );

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
      <header className="v2-app-header">
        <div className="v2-app-header-inner">
          <div className="v2-brand-block">
            <div className="v2-brand">
              <span className="v2-brand-title">
                {t('app.title', 'Vesinvest')}
              </span>
              <span className="v2-brand-subtitle">
                {t('v2Shell.subtitle', 'Financial planning')}
              </span>
            </div>
            <div className="v2-brand-meta">
              {shellBackLabel ? (
                <button
                  type="button"
                  className="v2-shell-back-btn"
                  onClick={() => setSetupBackSignal((prev) => prev + 1)}
                >
                  {shellBackLabel}
                </button>
              ) : null}
              <div className="v2-page-indicator" aria-live="polite">
                <span>{pageIndicatorCaption}</span>
                <strong>{pageIndicatorLabel}</strong>
              </div>
            </div>
          </div>

          <nav
            className="v2-main-nav"
            aria-label={t('v2Shell.mainNavigation', 'Main navigation')}
          >
            {TABS.map((tab) => {
              const locked = isTabLocked(tab);
              return (
                <button
                  key={tab}
                  type="button"
                  className={`v2-nav-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
                  onMouseEnter={() => preloadTab(tab)}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  aria-disabled={locked || undefined}
                  title={locked ? lockedTabMessage(tab) : undefined}
                >
                  {tabLabels[tab]}
                </button>
              );
            })}
          </nav>

          <div className="v2-header-tools">
            <LanguageSwitcher />
            <button
              type="button"
              className="v2-account-btn"
              onClick={() => setDrawerOpen((prev) => !prev)}
              aria-expanded={drawerOpen}
              aria-controls="v2-account-drawer"
            >
              {t('v2Shell.accountButton', 'Account')}
            </button>
          </div>
        </div>
        <div className="v2-header-meta">
          <div className="v2-header-statuses">
            <span className={`v2-badge ${connectionChipToneClass}`}>
              {connectionChipLabel}
            </span>
            <span className="v2-badge v2-status-provenance v2-org-chip">
              <span>{t('v2Shell.workspaceLabel', 'Workspace')}</span>
              <strong className="v2-org-chip-value" title={orgChipLabel}>
                <span className="v2-org-chip-name">{orgChipName}</span>
              </strong>
            </span>
          </div>
        </div>
      </header>

      {orgLanguageNotice ? (
        <div className="v2-language-notice" role="status" aria-live="polite">
          <p>
            {orgLanguageNotice.kind === 'switched'
              ? t(
                  'v2Shell.orgLanguageSwitched',
                  'Organization language is {{language}}. The workspace switched automatically.',
                  {
                    language: t(
                      `language.${orgLanguageNotice.language}`,
                      orgLanguageNotice.language,
                    ),
                  },
                )
              : t(
                  'v2Shell.orgLanguageKept',
                  'Organization language is {{language}}. Keeping your chosen interface language.',
                  {
                    language: t(
                      `language.${orgLanguageNotice.language}`,
                      orgLanguageNotice.language,
                    ),
                  },
                )}
          </p>
          <div className="v2-language-notice-actions">
            {orgLanguageNotice.kind === 'switched' ? (
              <button
                type="button"
                className="v2-btn v2-btn-small"
                onClick={() => {
                  void applyManualLanguagePreference(
                    orgLanguageNotice.previousLanguage,
                  );
                  clearOrgLanguageNotice();
                }}
              >
                {t('v2Shell.orgLanguageUndo', 'Keep {{language}}', {
                  language: t(
                    `language.${orgLanguageNotice.previousLanguage}`,
                    orgLanguageNotice.previousLanguage,
                  ),
                })}
              </button>
            ) : null}
            <button
              type="button"
              className="v2-btn v2-btn-small"
              onClick={clearOrgLanguageNotice}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : null}

      {blockedTabNotice ? (
        <div
          className="v2-language-notice v2-shell-tab-notice"
          role="status"
          aria-live="polite"
        >
          <p>
            <strong>{tabLabels[blockedTabNotice]}</strong>
            {': '}
            {lockedTabMessage(blockedTabNotice)}
          </p>
          <div className="v2-language-notice-actions">
            <button
              type="button"
              className="v2-btn v2-btn-small v2-btn-primary"
              onClick={handleLockedTabRecovery}
            >
              {lockedTabActionLabel(blockedTabNotice)}
            </button>
            <button
              type="button"
              className="v2-btn v2-btn-small"
              onClick={() => setBlockedTabNotice(null)}
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      ) : null}

      {drawerOpen ? (
        <div className="v2-account-drawer-layer" onClick={closeDrawer}>
          <aside
            id="v2-account-drawer"
            className="v2-account-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('v2Shell.accountTitle', 'Account and access')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="v2-account-drawer-head">
              <div>
                <span className="v2-overview-eyebrow">
                  {t('v2Shell.accountButton', 'Account')}
                </span>
                <h3>{t('v2Shell.accountTitle', 'Account and access')}</h3>
                <p className="v2-muted">
                  {t(
                    'v2Shell.drawerHint',
                    'Workspace access and organization controls.',
                  )}
                </p>
              </div>
              <button
                type="button"
                className="v2-account-drawer-close"
                onClick={closeDrawer}
                aria-label={t('common.close', 'Close')}
              >
                x
              </button>
            </div>

            <div className="v2-account-drawer-section">
              <p>
                <strong>{t('v2Shell.orgLabel', 'Org')}:</strong> {orgChipLabel}
              </p>
              <p>
                <strong>{t('v2Shell.roleLabel', 'Role')}:</strong> {roleText}
              </p>
              <p>
                <strong>
                  {t('v2Shell.activeWorkspace', 'Active workspace')}:
                </strong>{' '}
                {activeTabLabel}
              </p>
            </div>

            <div className="v2-account-drawer-section">
              <p className="v2-muted">
                {t(
                  'v2Shell.legalHint',
                  'Legal acceptance and trial logic follow current backend behavior.',
                )}
              </p>
              {isAdmin ? (
                <>
                  <p className="v2-muted">
                    {t(
                      'v2Shell.clearDataHint',
                      'Admin tool: clears VEETI imports, Vesinvest plans, and forecast scenarios for this org.',
                    )}
                  </p>
                  <p className="v2-muted">
                    {t(
                      'v2Shell.clearDataTypeHint',
                      'For safety, type {{token}} before the database clear action becomes available.',
                      { token: clearConfirmToken },
                    )}
                  </p>
                  <label className="v2-field v2-danger-field">
                    <span>{t('v2Shell.clearDataCodeLabel', 'Confirmation code')}</span>
                    <input
                      type="text"
                      className="v2-input"
                      value={clearConfirmValue}
                      onChange={(event) => {
                        setClearConfirmValue(event.target.value);
                        if (clearError) {
                          setClearError(null);
                        }
                      }}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-describedby="v2-clear-data-help"
                    />
                  </label>
                  <p id="v2-clear-data-help" className="v2-muted">
                    {clearConfirmMatches
                      ? t(
                          'v2Shell.clearDataTypeMatched',
                          'Confirmation code matches. Database clear is enabled.',
                        )
                      : t(
                          'v2Shell.clearDataTypePrompt',
                          'Type {{token}} to confirm database clear.',
                          { token: clearConfirmToken },
                        )}
                  </p>
                  <button
                    type="button"
                    className="v2-btn v2-btn-danger"
                    onClick={handleClearImportAndScenarios}
                    disabled={clearBusy || !clearConfirmMatches}
                  >
                    {clearBusy
                      ? t('v2Shell.clearDataBusy', 'Clearing...')
                      : t('v2Shell.clearDataButton', 'Clear database')}
                  </button>
                </>
              ) : null}
              {clearError ? (
                <div className="v2-alert v2-alert-error">{clearError}</div>
              ) : null}
            </div>

            {!isDemoMode ? (
              <div className="v2-account-drawer-actions">
                <button
                  type="button"
                  className="v2-btn v2-btn-danger"
                  onClick={onLogout}
                  disabled={clearBusy}
                >
                  {t('auth.signOut', 'Sign out')}
                </button>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

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
                    onGoToForecast={handleGoToForecast}
                    onGoToReports={handleGoToReports}
                    isAdmin={isAdmin}
                    overviewFocusTarget={overviewFocusTarget}
                    onOverviewFocusTargetConsumed={() =>
                      setOverviewFocusTarget(null)
                    }
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
