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
  const [clearConfirmValue, setClearConfirmValue] = React.useState('');

  const tabLabels: Record<TabId, string> = {
    overview: t('v2Shell.tabs.overview', 'Overview'),
    ennuste: t('v2Shell.tabs.forecast', 'Ennuste'),
    reports: t('v2Shell.tabs.reports', 'Reports'),
  };

  const activeTabLabel = tabLabels[activeTab];

  const closeDrawer = React.useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleGoToForecast = React.useCallback(() => {
    closeDrawer();
    setActiveTab('ennuste');
    syncBrowserPath('ennuste');
  }, [closeDrawer]);

  const handleGoToReports = React.useCallback(() => {
    closeDrawer();
    setActiveTab('reports');
    syncBrowserPath('reports');
  }, [closeDrawer]);

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
    [activeTab, closeDrawer],
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
  }, [clearConfirmMatches, t]);

  const orgShort = tokenInfo?.org_id
    ? `${tokenInfo.org_id.slice(0, 8)}...`
    : '-';
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
            <div className="v2-page-indicator" aria-live="polite">
              <span>{t('v2Shell.activeWorkspace', 'Active workspace')}</span>
              <strong>{activeTabLabel}</strong>
            </div>
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
                aria-current={activeTab === tab ? 'page' : undefined}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>

          <div className="v2-header-tools">
            <LanguageSwitcher />
            <div className="v2-header-statuses">
              <span className="v2-connection-chip">
                {isDemoMode
                  ? t('v2Shell.demoMode', 'Demo mode')
                  : t('status.connected', 'Connected')}
              </span>
              <span className="v2-org-chip">
                <span>{t('v2Shell.orgLabel', 'Org')}</span>
                <strong>{orgShort}</strong>
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
                <strong>{t('v2Shell.orgLabel', 'Org')}:</strong> {orgShort}
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
