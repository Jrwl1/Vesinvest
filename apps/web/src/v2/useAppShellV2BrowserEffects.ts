import React from 'react';

import { FORECAST_RUNTIME_STORAGE_KEY, resolveTabFromPath, syncBrowserPath, type ForecastRuntimeState, type TabId, type WorkspaceBootstrapSnapshot } from './appShellV2Routing';
import type { SetupWizardState } from './overviewWorkflow';

export function useAppShellV2BrowserEffects({
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
}: {
  pendingPathTab: TabId | null;
  setPendingPathTab: React.Dispatch<React.SetStateAction<TabId | null>>;
  setupTruthBootstrapped: boolean;
  setSetupTruthBootstrapped: React.Dispatch<React.SetStateAction<boolean>>;
  setupWizardState: SetupWizardState | null;
  hasSelectedUtility: boolean;
  activeTab: TabId;
  setActiveTab: React.Dispatch<React.SetStateAction<TabId>>;
  setBlockedTabNotice: React.Dispatch<React.SetStateAction<TabId | null>>;
  isTabLockedForState: (tab: TabId, state: SetupWizardState | null) => boolean;
  isTabLocked: (tab: TabId) => boolean;
  refreshWorkspaceTruth: () => Promise<WorkspaceBootstrapSnapshot>;
  loadWorkspaceBootstrapSnapshot: () => Promise<WorkspaceBootstrapSnapshot>;
  applySetupWizardState: (nextState: SetupWizardState) => void;
  applySetupPlanState: (nextState: WorkspaceBootstrapSnapshot['planState']) => void;
  applySetupOrgName: (name: string | null) => void;
  initialOverviewBootstrapPendingRef: React.MutableRefObject<boolean>;
  forecastRuntimeState: ForecastRuntimeState;
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  shellSurfaceTab: TabId;
}) {
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    let cancelled = false;

    if (pendingPathTab == null) {
      setSetupTruthBootstrapped(true);
      return;
    }

    const bootstrapSetupTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled) {
          return;
        }
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Overview will refresh truth once mounted.
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
  }, [applySetupOrgName, applySetupPlanState, applySetupWizardState, loadWorkspaceBootstrapSnapshot, pendingPathTab, setSetupTruthBootstrapped]);

  React.useEffect(() => {
    if (pendingPathTab != null || !initialOverviewBootstrapPendingRef.current) {
      return;
    }
    initialOverviewBootstrapPendingRef.current = false;
    let cancelled = false;

    const bootstrapOverviewTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled || !snapshot.wizardState.reportsUnlocked) {
          return;
        }
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Overview can still hydrate shell truth.
      }
    };

    void bootstrapOverviewTruth();
    return () => {
      cancelled = true;
    };
  }, [applySetupOrgName, applySetupPlanState, applySetupWizardState, initialOverviewBootstrapPendingRef, loadWorkspaceBootstrapSnapshot, pendingPathTab]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !setupTruthBootstrapped || activeTab === 'overview') {
      return;
    }
    if (setupWizardState && hasSelectedUtility) {
      return;
    }
    let cancelled = false;

    const rehydrateWorkspaceTruth = async () => {
      try {
        const snapshot = await loadWorkspaceBootstrapSnapshot();
        if (cancelled) {
          return;
        }
        applySetupWizardState(snapshot.wizardState);
        applySetupPlanState(snapshot.planState);
        applySetupOrgName(snapshot.orgName);
      } catch {
        // Keep current shell state if retry fails.
      }
    };

    void rehydrateWorkspaceTruth();
    return () => {
      cancelled = true;
    };
  }, [activeTab, applySetupOrgName, applySetupPlanState, applySetupWizardState, hasSelectedUtility, loadWorkspaceBootstrapSnapshot, setupTruthBootstrapped, setupWizardState]);

  React.useEffect(() => {
    if (setupTruthBootstrapped && pendingPathTab && !setupWizardState) {
      void refreshWorkspaceTruth().catch(() => undefined);
    }
  }, [pendingPathTab, refreshWorkspaceTruth, setupTruthBootstrapped, setupWizardState]);

  React.useEffect(() => {
    if (!setupTruthBootstrapped || !pendingPathTab || !setupWizardState) {
      return;
    }
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
  }, [isTabLockedForState, pendingPathTab, setActiveTab, setBlockedTabNotice, setPendingPathTab, setupTruthBootstrapped, setupWizardState]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
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
  }, [isTabLockedForState, setActiveTab, setBlockedTabNotice, setPendingPathTab, setupTruthBootstrapped, setupWizardState]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        FORECAST_RUNTIME_STORAGE_KEY,
        JSON.stringify(forecastRuntimeState),
      );
    }
  }, [forecastRuntimeState]);

  React.useEffect(() => {
    if (!drawerOpen || typeof window === 'undefined') {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen, setDrawerOpen]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
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
    if (activeTab === 'overview' || !setupWizardState || !isTabLocked(activeTab)) {
      return;
    }
    setBlockedTabNotice(activeTab);
    setActiveTab('overview');
    syncBrowserPath('overview', 'replace');
  }, [activeTab, isTabLocked, setActiveTab, setBlockedTabNotice, setupWizardState]);
}
