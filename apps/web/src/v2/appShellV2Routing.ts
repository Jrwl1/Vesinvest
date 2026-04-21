import React from 'react';

export type TabId = 'overview' | 'ennuste' | 'reports';

export type ForecastRuntimeState = {
  selectedScenarioId: string | null;
};

export type WorkspaceBootstrapSnapshot = {
  orgName: string | null;
  wizardState: import('./overviewWorkflow').SetupWizardState;
  planState: {
    activePlanId: string | null;
    linkedScenarioId: string | null;
    classificationReviewRequired: boolean;
    pricingStatus: 'blocked' | 'provisional' | 'verified' | null;
    baselineChangedSinceAcceptedRevision: boolean;
    investmentPlanChangedSinceFeeRecommendation: boolean;
  } | null;
};

export type OverviewFocusTarget = {
  kind: 'saved_fee_path';
  planId: string;
};

export type OrgLanguageNotice = {
  kind: 'switched' | 'kept_manual';
  language: 'fi' | 'sv' | 'en';
  previousLanguage: 'fi' | 'sv' | 'en';
};

let overviewPageModulePromise: Promise<typeof import('./OverviewPageV2')> | null = null;
let ennustePageModulePromise: Promise<typeof import('./EnnustePageV2')> | null = null;
let reportsPageModulePromise: Promise<typeof import('./ReportsPageV2')> | null = null;

function loadOverviewPageModule() {
  if (!overviewPageModulePromise) {
    overviewPageModulePromise = import('./OverviewPageV2');
  }
  return overviewPageModulePromise;
}

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

export const OverviewPageV2 = React.lazy(async () => {
  const mod = await loadOverviewPageModule();
  return { default: mod.OverviewPageV2 };
});

export const EnnustePageV2 = React.lazy(async () => {
  const mod = await loadEnnustePageModule();
  return { default: mod.EnnustePageV2 };
});

export const ReportsPageV2 = React.lazy(async () => {
  const mod = await loadReportsPageModule();
  return { default: mod.ReportsPageV2 };
});

export function preloadTab(tab: TabId): void {
  if (tab === 'ennuste') {
    void loadEnnustePageModule();
  }
  if (tab === 'reports') {
    void loadReportsPageModule();
  }
}

export const TAB_PATHS: Record<TabId, string> = {
  overview: '/',
  ennuste: '/forecast',
  reports: '/reports',
};

export const TABS: TabId[] = ['overview', 'ennuste', 'reports'];

export const FORECAST_RUNTIME_STORAGE_KEY = 'v2_forecast_runtime_state';

export function normalizePath(pathname: string): string {
  if (!pathname || pathname === '/') {
    return '/';
  }
  return pathname.replace(/\/+$/, '');
}

export function resolveTabFromPath(pathname: string): TabId {
  const normalized = normalizePath(pathname);
  if (normalized === '/reports') {
    return 'reports';
  }
  if (normalized === '/forecast' || normalized === '/ennuste') {
    return 'ennuste';
  }
  return 'overview';
}

export function getInitialTabFromLocation(): TabId {
  if (typeof window === 'undefined') {
    return 'overview';
  }
  return resolveTabFromPath(window.location.pathname);
}

export function readForecastRuntimeState(): ForecastRuntimeState {
  if (typeof window === 'undefined') {
    return { selectedScenarioId: null };
  }

  try {
    const raw = window.sessionStorage.getItem(FORECAST_RUNTIME_STORAGE_KEY);
    if (!raw) {
      return { selectedScenarioId: null };
    }

    const parsed = JSON.parse(raw) as { selectedScenarioId?: unknown };
    return {
      selectedScenarioId:
        typeof parsed.selectedScenarioId === 'string' ? parsed.selectedScenarioId : null,
    };
  } catch {
    return { selectedScenarioId: null };
  }
}

export function syncBrowserPath(tab: TabId, mode: 'push' | 'replace' = 'push'): void {
  if (typeof window === 'undefined') {
    return;
  }
  const targetPath = TAB_PATHS[tab];
  if (normalizePath(window.location.pathname) === targetPath) {
    return;
  }
  if (mode === 'replace') {
    window.history.replaceState(window.history.state, '', targetPath);
    return;
  }
  window.history.pushState(window.history.state, '', targetPath);
}
