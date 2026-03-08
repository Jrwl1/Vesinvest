import React from 'react';
import { useTranslation } from 'react-i18next';
import { clearImportAndScenariosV2, type DecodedToken } from '../api';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { OverviewPageV2 } from './OverviewPageV2';
import { sendV2OpsEvent } from './opsTelemetry';

const EnnustePageV2 = React.lazy(async () => {
  const mod = await import('./EnnustePageV2');
  return { default: mod.EnnustePageV2 };
});

const ReportsPageV2 = React.lazy(async () => {
  const mod = await import('./ReportsPageV2');
  return { default: mod.ReportsPageV2 };
});

function preloadTab(tab: TabId): void {
  if (tab === 'ennuste') {
    void import('./EnnustePageV2');
  }
  if (tab === 'reports') {
    void import('./ReportsPageV2');
  }
}

type TabId = 'overview' | 'ennuste' | 'reports';

const TAB_PATHS: Record<TabId, string> = {
  overview: '/',
  ennuste: '/forecast',
  reports: '/reports',
};

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
  const [activeTab, setActiveTab] = React.useState<TabId>(
    getInitialTabFromLocation,
  );
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [reportsRefreshTick, setReportsRefreshTick] = React.useState(0);
  const [focusedReportId, setFocusedReportId] = React.useState<string | null>(
    null,
  );
  const [clearBusy, setClearBusy] = React.useState(false);
  const [clearError, setClearError] = React.useState<string | null>(null);

  const tabLabels: Record<TabId, string> = {
    overview: t('v2Shell.tabs.overview', 'Overview'),
    ennuste: t('v2Shell.tabs.forecast', 'Ennuste'),
    reports: t('v2Shell.tabs.reports', 'Reports'),
  };

  const handleGoToForecast = React.useCallback(() => {
    setActiveTab('ennuste');
    syncBrowserPath('ennuste');
  }, []);

  const handleGoToReports = React.useCallback(() => {
    setActiveTab('reports');
    syncBrowserPath('reports');
  }, []);

  const handleReportCreated = React.useCallback((reportId: string) => {
    setFocusedReportId(reportId);
    setReportsRefreshTick((prev) => prev + 1);
    setActiveTab('reports');
    syncBrowserPath('reports');
  }, []);

  const handleTabChange = React.useCallback(
    (tab: TabId) => {
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
    [activeTab],
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const tabFromPath = resolveTabFromPath(window.location.pathname);
    setActiveTab(tabFromPath);
    syncBrowserPath(tabFromPath, 'replace');

    const onPopState = () => {
      setActiveTab(resolveTabFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const isAdmin = React.useMemo(
    () =>
      (tokenInfo?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN'),
    [tokenInfo?.roles],
  );

  const clearConfirmToken = tokenInfo?.org_id
    ? tokenInfo.org_id.slice(0, 8).toUpperCase()
    : 'CLEAR';

  const handleClearImportAndScenarios = React.useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'v2Shell.clearDataConfirm',
        'This clears all VEETI imports and forecast scenarios for your organization. Continue?',
      ),
    );
    if (!confirmed) return;

    const typed = window.prompt(
      t(
        'v2Shell.clearDataTypePrompt',
        'Type {{token}} to confirm database clear.',
        { token: clearConfirmToken },
      ),
      '',
    );
    if ((typed ?? '').trim().toUpperCase() !== clearConfirmToken) {
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
      await clearImportAndScenariosV2();
      window.location.reload();
    } catch (err) {
      setClearError(
        err instanceof Error
          ? err.message
          : t('v2Shell.clearDataFailed', 'Database clear failed.'),
      );
    } finally {
      setClearBusy(false);
    }
  }, [clearConfirmToken, t]);

  const orgShort = tokenInfo?.org_id
    ? `${tokenInfo.org_id.slice(0, 8)}...`
    : '-';
  const roleText = tokenInfo?.roles?.join(', ') ?? '-';

  return (
    <div className="v2-app-shell">
      <header className="v2-app-header">
        <div className="v2-app-header-inner">
          <div className="v2-brand">
            <span className="v2-brand-title">
              {t('app.title', 'Vesipolku')}
            </span>
            <span className="v2-brand-subtitle">
              {t('v2Shell.subtitle', 'Financial planning')}
            </span>
          </div>

          <nav
            className="v2-main-nav"
            aria-label={t('v2Shell.mainNavigation', 'Main navigation')}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                className={`v2-nav-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => handleTabChange(tab)}
                onMouseEnter={() => preloadTab(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>

          <div className="v2-header-tools">
            <LanguageSwitcher />
            <span className="v2-connection-chip">
              {isDemoMode
                ? t('v2Shell.demoMode', 'Demo mode')
                : t('status.connected', 'Connected')}
            </span>
            <button
              type="button"
              className="v2-account-btn"
              onClick={() => setDrawerOpen((prev) => !prev)}
            >
              {t('v2Shell.accountButton', 'Account')}
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="v2-account-drawer-wrap">
          <aside className="v2-account-drawer">
            <h3>{t('v2Shell.accountTitle', 'Account and access')}</h3>
            <p>
              <strong>{t('v2Shell.orgLabel', 'Org')}:</strong> {orgShort}
            </p>
            <p>
              <strong>{t('v2Shell.roleLabel', 'Role')}:</strong> {roleText}
            </p>
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
                    'For safety, type {{token}} in the confirmation prompt.',
                    { token: clearConfirmToken },
                  )}
                </p>
                <button
                  type="button"
                  className="v2-btn v2-btn-danger"
                  onClick={handleClearImportAndScenarios}
                  disabled={clearBusy}
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
            {!isDemoMode ? (
              <button
                type="button"
                className="v2-btn v2-btn-danger"
                onClick={onLogout}
                disabled={clearBusy}
              >
                {t('auth.signOut', 'Sign out')}
              </button>
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
            <div key={activeTab} className="v2-tab-panel">
              {activeTab === 'overview' ? (
                <OverviewPageV2
                  onGoToForecast={handleGoToForecast}
                  onGoToReports={handleGoToReports}
                  isAdmin={isAdmin}
                />
              ) : null}
              {activeTab === 'ennuste' ? (
                <EnnustePageV2 onReportCreated={handleReportCreated} />
              ) : null}
              {activeTab === 'reports' ? (
                <ReportsPageV2
                  refreshToken={reportsRefreshTick}
                  focusedReportId={focusedReportId}
                  onGoToForecast={handleGoToForecast}
                />
              ) : null}
            </div>
          </React.Suspense>
        </div>
      </main>
    </div>
  );
};
