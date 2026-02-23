import React from 'react';
import type { DecodedToken } from '../api';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { EnnustePageV2 } from './EnnustePageV2';
import { OverviewPageV2 } from './OverviewPageV2';
import { ReportsPageV2 } from './ReportsPageV2';

type TabId = 'overview' | 'ennuste' | 'reports';

type Props = {
  tokenInfo: DecodedToken | null;
  isDemoMode: boolean;
  onLogout: () => void;
};

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'ennuste', label: 'Ennuste' },
  { id: 'reports', label: 'Reports' },
];

export const AppShellV2: React.FC<Props> = ({ tokenInfo, isDemoMode, onLogout }) => {
  const [activeTab, setActiveTab] = React.useState<TabId>('overview');
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [reportsRefreshTick, setReportsRefreshTick] = React.useState(0);
  const [focusedReportId, setFocusedReportId] = React.useState<string | null>(null);

  const handleGoToForecast = React.useCallback(() => {
    setActiveTab('ennuste');
  }, []);

  const handleReportCreated = React.useCallback((reportId: string) => {
    setFocusedReportId(reportId);
    setReportsRefreshTick((prev) => prev + 1);
    setActiveTab('reports');
  }, []);

  const handleTabChange = React.useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  const orgShort = tokenInfo?.org_id ? `${tokenInfo.org_id.slice(0, 8)}...` : '-';
  const roleText = tokenInfo?.roles?.join(', ') ?? '-';

  return (
    <div className="v2-app-shell">
      <header className="v2-app-header">
        <div className="v2-brand">
          <span className="v2-brand-title">VA Finance</span>
          <span className="v2-brand-subtitle">CFO Workspace</span>
        </div>

        <nav className="v2-main-nav" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`v2-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="v2-header-tools">
          <LanguageSwitcher />
          <span className="v2-connection-chip">
            {isDemoMode ? 'Demo mode' : 'Connected'}
          </span>
          <button
            type="button"
            className="v2-account-btn"
            onClick={() => setDrawerOpen((prev) => !prev)}
          >
            Tili
          </button>
        </div>
      </header>

      {drawerOpen ? (
        <aside className="v2-account-drawer">
          <h3>Tili ja oikeudet</h3>
          <p><strong>Org:</strong> {orgShort}</p>
          <p><strong>Rooli:</strong> {roleText}</p>
          <p className="v2-muted">
            Lakihyvaksynta ja trial-logiikka noudattaa nykyista backend-kaytosta.
          </p>
          {!isDemoMode ? (
            <button type="button" className="v2-btn v2-btn-danger" onClick={onLogout}>
              Kirjaudu ulos
            </button>
          ) : null}
        </aside>
      ) : null}

      <main className="v2-main-content">
        {activeTab === 'overview' ? (
          <OverviewPageV2 onGoToForecast={handleGoToForecast} />
        ) : null}
        {activeTab === 'ennuste' ? (
          <EnnustePageV2 onReportCreated={handleReportCreated} />
        ) : null}
        {activeTab === 'reports' ? (
          <ReportsPageV2
            refreshToken={reportsRefreshTick}
            focusedReportId={focusedReportId}
          />
        ) : null}
      </main>
    </div>
  );
};
