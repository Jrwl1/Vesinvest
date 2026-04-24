import React from 'react';

export type TabId =
  | 'overview'
  | 'asset_management'
  | 'ennuste'
  | 'tariff_plan'
  | 'reports';

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
    tariffPlanStatus: 'draft' | 'accepted' | 'stale' | null;
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
let assetManagementPageModulePromise: Promise<typeof import('./AssetManagementPageV2')> | null = null;
let ennustePageModulePromise: Promise<typeof import('./EnnustePageV2')> | null = null;
let tariffPlanPageModulePromise: Promise<typeof import('./TariffPlanPageV2')> | null = null;
let reportsPageModulePromise: Promise<typeof import('./ReportsPageV2')> | null = null;

function loadOverviewPageModule() {
  if (!overviewPageModulePromise) {
    overviewPageModulePromise = import('./OverviewPageV2');
  }
  return overviewPageModulePromise;
}

function loadAssetManagementPageModule() {
  if (!assetManagementPageModulePromise) {
    assetManagementPageModulePromise = import('./AssetManagementPageV2');
  }
  return assetManagementPageModulePromise;
}

function loadEnnustePageModule() {
  if (!ennustePageModulePromise) {
    ennustePageModulePromise = import('./EnnustePageV2');
  }
  return ennustePageModulePromise;
}

function loadTariffPlanPageModule() {
  if (!tariffPlanPageModulePromise) {
    tariffPlanPageModulePromise = import('./TariffPlanPageV2');
  }
  return tariffPlanPageModulePromise;
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

export const AssetManagementPageV2 = React.lazy(async () => {
  const mod = await loadAssetManagementPageModule();
  return { default: mod.AssetManagementPageV2 };
});

export const EnnustePageV2 = React.lazy(async () => {
  const mod = await loadEnnustePageModule();
  return { default: mod.EnnustePageV2 };
});

export const TariffPlanPageV2 = React.lazy(async () => {
  const mod = await loadTariffPlanPageModule();
  return { default: mod.TariffPlanPageV2 };
});

export const ReportsPageV2 = React.lazy(async () => {
  const mod = await loadReportsPageModule();
  return { default: mod.ReportsPageV2 };
});

export function preloadTab(tab: TabId): void {
  if (tab === 'asset_management') {
    void loadAssetManagementPageModule();
  }
  if (tab === 'ennuste') {
    void loadEnnustePageModule();
  }
  if (tab === 'tariff_plan') {
    void loadTariffPlanPageModule();
  }
  if (tab === 'reports') {
    void loadReportsPageModule();
  }
}

export const TAB_PATHS: Record<TabId, string> = {
  overview: '/',
  asset_management: '/asset-management',
  ennuste: '/forecast',
  tariff_plan: '/tariff-plan',
  reports: '/reports',
};

export const TABS: TabId[] = [
  'overview',
  'asset_management',
  'ennuste',
  'tariff_plan',
  'reports',
];

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
  if (normalized === '/tariff-plan' || normalized === '/tariffs') {
    return 'tariff_plan';
  }
  if (normalized === '/forecast' || normalized === '/ennuste') {
    return 'ennuste';
  }
  if (normalized === '/asset-management' || normalized === '/assets') {
    return 'asset_management';
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
