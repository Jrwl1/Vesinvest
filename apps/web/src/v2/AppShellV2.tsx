import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  clearImportAndScenariosV2,
  getImportStatusV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  type DecodedToken,
} from '../api';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { applyOrganizationDefaultLanguage } from '../i18n';
import { OverviewPageV2 } from './OverviewPageV2';
import { sendV2OpsEvent } from './opsTelemetry';
import {
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
  computedFromUpdatedAtByScenario: Record<string, string>;
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
    return { selectedScenarioId: null, computedFromUpdatedAtByScenario: {} };
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return { selectedScenarioId: null, computedFromUpdatedAtByScenario: {} };
    }

    const parsed = JSON.parse(raw) as {
      selectedScenarioId?: unknown;
      computedFromUpdatedAtByScenario?: unknown;
    };

    const computedFromUpdatedAtByScenario =
      parsed.computedFromUpdatedAtByScenario &&
      typeof parsed.computedFromUpdatedAtByScenario === 'object'
        ? Object.fromEntries(
            Object.entries(
              parsed.computedFromUpdatedAtByScenario as Record<
                string,
                unknown
              >,
            ).filter((entry): entry is [string, string] => {
              const [, value] = entry;
              return typeof value === 'string' && value.trim().length > 0;
            }),
          )
        : {};

    return {
      selectedScenarioId:
        typeof parsed.selectedScenarioId === 'string'
          ? parsed.selectedScenarioId
          : null,
      computedFromUpdatedAtByScenario,
    };
  } catch {
    return { selectedScenarioId: null, computedFromUpdatedAtByScenario: {} };
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
  const [setupOrgName, setSetupOrgName] = React.useState<string | null>(null);

  const tabLabels: Record<TabId, string> = {
    overview: t('v2Shell.tabs.overview', 'Overview'),
    ennuste: t('v2Shell.tabs.forecast', 'Forecast'),
    reports: t('v2Shell.tabs.reports', 'Reports'),
  };

  const activeTabLabel = tabLabels[activeTab];
  const isBootstrappingPathTruth =
    pendingPathTab != null && !setupTruthBootstrapped;
  const bootstrappingTargetTab = pendingPathTab ?? activeTab;
  const bootstrappingTargetLabel = tabLabels[bootstrappingTargetTab];
  const hasSelectedUtility =
    typeof setupOrgName === 'string' && setupOrgName.trim().length > 0;
  const shellSetupStep = setupWizardState?.currentStep ?? 1;
  const connectionChipToneClass = isBootstrappingPathTruth
    ? 'v2-status-neutral'
    : isDemoMode
    ? 'v2-status-info'
    : !hasSelectedUtility
      ? 'v2-status-warning'
      : setupWizardState?.forecastUnlocked
        ? 'v2-status-positive'
        : 'v2-status-info';
  const connectionChipLabel = isBootstrappingPathTruth
    ? t('v2Shell.workspaceLoading', 'Checking workspace')
    : isDemoMode
    ? t('v2Shell.demoMode', 'Demo mode')
    : !hasSelectedUtility
      ? t('v2Shell.setupRequired', 'Setup required')
      : setupWizardState?.forecastUnlocked
        ? t('v2Shell.planningBaselineReady', 'Planning baseline ready')
        : t('v2Shell.setupInProgress', 'Setup in progress');
  const pageIndicatorLabel = isBootstrappingPathTruth
    ? bootstrappingTargetLabel
    : activeTab === 'overview' && setupWizardState
      ? t('v2Shell.setupStepLabel', 'Step {{step}} / {{total}}', {
          step: shellSetupStep,
          total: setupWizardState.totalSteps,
        })
      : !hasSelectedUtility
        ? t('v2Shell.selectUtility', 'Select utility')
      : activeTabLabel;
  const pageIndicatorCaption = isBootstrappingPathTruth
    ? t('v2Shell.workspaceLoadingLabel', 'Loading workspace')
    : activeTab === 'overview' && setupWizardState
      ? t('v2Shell.setupMode', 'Guided setup')
      : !hasSelectedUtility
        ? t('v2Shell.setupStatus', 'Setup status')
        : t('v2Shell.activeWorkspace', 'Active workspace');
  const shellBackStep =
    activeTab === 'overview' && setupWizardState
      ? resolvePreviousSetupStep(setupWizardState)
      : null;
  const shellBackLabel =
    shellBackStep === 1
      ? t('v2Overview.wizardBackStep1', 'Back to connection')
      : shellBackStep === 2
      ? t('v2Overview.wizardBackStep2', 'Back to year selection')
      : shellBackStep === 3
      ? t('v2Overview.wizardBackStep3', 'Back to review')
      : shellBackStep === 5
      ? t('v2Overview.wizardBackStep5', 'Back to baseline')
      : null;

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
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

  const applySetupOrgName = React.useCallback((name: string | null) => {
    setSetupOrgName((prev) => (prev === name ? prev : name));
  }, []);

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

  const handleGoToForecast = React.useCallback((scenarioId?: string | null) => {
    if (isTabLocked('ennuste')) {
      handleLockedTabAttempt('ennuste');
      return;
    }
    closeDrawer();
    if (typeof scenarioId === 'string' && scenarioId.length > 0) {
      setForecastRuntimeState((prev) =>
        prev.selectedScenarioId === scenarioId
          ? prev
          : { ...prev, selectedScenarioId: scenarioId },
      );
    }
    setActiveTab('ennuste');
    syncBrowserPath('ennuste');
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked]);

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
    setActiveTab('reports');
    syncBrowserPath('reports');
  }, [closeDrawer, handleLockedTabAttempt, isTabLocked]);

  const handleReportCreated = React.useCallback(
    (reportId: string) => {
      closeDrawer();
      setFocusedReportId(reportId);
      setReportsRefreshTick((prev) => prev + 1);
      setActiveTab('reports');
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
        const [importStatus, planningContext, scenarios] = await Promise.all([
          getImportStatusV2(),
          getPlanningContextV2().catch(() => null),
          listForecastScenariosV2().catch(() => []),
        ]);
        if (cancelled) return;
        if (importStatus.link?.uiLanguage) {
          void applyOrganizationDefaultLanguage(importStatus.link.uiLanguage);
        }
        applySetupWizardState(
          resolveSetupWizardStateFromImportStatus(importStatus, planningContext, {
            existingScenarioCount: scenarios.length,
          }),
        );
        applySetupOrgName(importStatus.link?.nimi ?? null);
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
  }, [applySetupOrgName, applySetupWizardState, pendingPathTab]);

  React.useEffect(() => {
    if (!setupTruthBootstrapped) return;
    if (!pendingPathTab) return;

    if (
      !setupWizardState ||
      isTabLockedForState(pendingPathTab, setupWizardState)
    ) {
      setActiveTab('overview');
      syncBrowserPath('overview', 'replace');
    } else {
      setActiveTab(pendingPathTab);
      syncBrowserPath(pendingPathTab, 'replace');
    }
    setPendingPathTab(null);
  }, [isTabLockedForState, pendingPathTab, setupTruthBootstrapped, setupWizardState]);

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
        setActiveTab('overview');
        syncBrowserPath('overview', 'replace');
        return;
      }
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
    if (activeTab === 'overview') return;
    if (!setupWizardState) return;
    if (!isTabLocked(activeTab)) return;
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

    setClearBusy(true);
    setClearError(null);
    try {
      const result = await clearImportAndScenariosV2(clearConfirmValue.trim());
      applySetupWizardState(
        resolveSetupWizardStateFromImportStatus(result.status, null),
      );
      applySetupOrgName(result.status.link?.nimi ?? null);
      setSetupTruthBootstrapped(true);
      setPendingPathTab(null);
      setForecastRuntimeState({
        selectedScenarioId: null,
        computedFromUpdatedAtByScenario: {},
      });
      setFocusedReportId(null);
      setReportsRefreshTick(0);
      setWorkspaceResetVersion((prev) => prev + 1);
      setClearConfirmValue('');
      closeDrawer();
      setActiveTab('overview');
      syncBrowserPath('overview', 'replace');
    } catch (err) {
      setClearError(
        err instanceof Error
          ? err.message
          : t('v2Shell.clearDataFailed', 'Database clear failed.'),
      );
    } finally {
      setClearBusy(false);
    }
  }, [
    applySetupOrgName,
    applySetupWizardState,
    clearConfirmMatches,
    clearConfirmValue,
    closeDrawer,
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

  const handleForecastComputedVersionChange = React.useCallback(
    (scenarioId: string, computedFromUpdatedAt: string | null) => {
      setForecastRuntimeState((prev) => {
        const nextComputedFromUpdatedAtByScenario = {
          ...prev.computedFromUpdatedAtByScenario,
        };

        if (computedFromUpdatedAt) {
          nextComputedFromUpdatedAtByScenario[scenarioId] = computedFromUpdatedAt;
        } else {
          delete nextComputedFromUpdatedAtByScenario[scenarioId];
        }

        const unchangedEntries =
          Object.keys(prev.computedFromUpdatedAtByScenario).length ===
            Object.keys(nextComputedFromUpdatedAtByScenario).length &&
          Object.entries(nextComputedFromUpdatedAtByScenario).every(
            ([key, value]) => prev.computedFromUpdatedAtByScenario[key] === value,
          );

        if (unchangedEntries) {
          return prev;
        }

        return {
          ...prev,
          computedFromUpdatedAtByScenario: nextComputedFromUpdatedAtByScenario,
        };
      });
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
    <div className="v2-app-shell">
      <header className="v2-app-header">
        <div className="v2-app-header-inner">
          <div className="v2-brand-block">
            <div className="v2-brand">
              <span className="v2-brand-title">
                {t('app.title', 'Vesipolku')}
              </span>
              <span className="v2-brand-subtitle">
                {t('v2Shell.subtitle', 'Financial planning')}
              </span>
            </div>
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
                  disabled={locked}
                  title={
                    locked
                      ? t(
                          'v2Shell.tabLockedHint',
                          'Complete the setup steps before opening this workspace.',
                        )
                      : undefined
                  }
                >
                  {tabLabels[tab]}
                </button>
              );
            })}
          </nav>

          <div className="v2-header-tools">
            <LanguageSwitcher />
            <div className="v2-header-statuses">
              <span className={`v2-badge ${connectionChipToneClass}`}>
                {connectionChipLabel}
              </span>
              <span className="v2-badge v2-status-provenance v2-org-chip">
                <span>{t('v2Shell.workspaceLabel', 'Workspace')}</span>
                <strong className="v2-org-chip-value" title={orgChipLabel}>
                  <span className="v2-org-chip-name">{orgChipName}</span>
                  {orgChipHash ? (
                    <>
                      <span className="v2-org-chip-separator" aria-hidden="true">
                        {' / '}
                      </span>
                      <span className="v2-org-chip-code">{orgChipHash}</span>
                    </>
                  ) : null}
                </strong>
              </span>
            </div>
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
      </header>

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
                ×
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
                      'Admin tool: clears VEETI imports and forecast scenarios for this org.',
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
                    onSetupWizardStateChange={handleSetupWizardStateChange}
                    onSetupOrgNameChange={handleSetupOrgNameChange}
                    setupBackSignal={setupBackSignal}
                  />
                ) : null}
                {activeTab === 'ennuste' ? (
                  <EnnustePageV2
                    onReportCreated={handleReportCreated}
                    initialScenarioId={forecastRuntimeState.selectedScenarioId}
                    computedFromUpdatedAtByScenario={
                      forecastRuntimeState.computedFromUpdatedAtByScenario
                    }
                    onScenarioSelectionChange={handleForecastScenarioSelection}
                    onComputedVersionChange={handleForecastComputedVersionChange}
                  />
                ) : null}
                {activeTab === 'reports' ? (
                  <ReportsPageV2
                    refreshToken={reportsRefreshTick}
                    focusedReportId={focusedReportId}
                    onGoToForecast={handleGoToForecastFromReport}
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
