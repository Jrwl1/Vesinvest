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
  const [activeTab, setActiveTab] = React.useState<TabId>('overview');
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
  }, []);

  const handleGoToReports = React.useCallback(() => {
    setActiveTab('reports');
  }, []);

  const handleReportCreated = React.useCallback((reportId: string) => {
    setFocusedReportId(reportId);
    setReportsRefreshTick((prev) => prev + 1);
    setActiveTab('reports');
  }, []);

  const handleTabChange = React.useCallback((tab: TabId) => {
    setActiveTab(tab);
    sendV2OpsEvent({
      event: 'tab_change',
      status: 'ok',
      attrs: { tab },
    });
  }, []);

  const isAdmin = React.useMemo(
    () =>
      (tokenInfo?.roles ?? []).some((role) => role.toUpperCase() === 'ADMIN'),
    [tokenInfo?.roles],
  );

  const handleClearImportAndScenarios = React.useCallback(async () => {
    const confirmed = window.confirm(
      t(
        'v2Shell.clearDataConfirm',
        'This clears all VEETI imports and forecast scenarios for your organization. Continue?',
      ),
    );
    if (!confirmed) return;

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
  }, [t]);

  const orgShort = tokenInfo?.org_id
    ? `${tokenInfo.org_id.slice(0, 8)}...`
    : '-';
  const roleText = tokenInfo?.roles?.join(', ') ?? '-';

  return (
    <div className="v2-app-shell">
      <header className="v2-app-header">
        <div className="v2-brand">
          <span className="v2-brand-title">{t('app.title', 'Vesipolku')}</span>
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
      </header>

      {drawerOpen ? (
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
      ) : null}

      <main className="v2-main-content">
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
      </main>
    </div>
  );
};
