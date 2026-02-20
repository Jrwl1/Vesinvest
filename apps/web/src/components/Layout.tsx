import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiStatus, getApiBaseUrl, ApiStatus, resetDemoData } from '../api';
import { useDemoStatus } from '../context/DemoStatusContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export type TabId = 'budget' | 'projection' | 'settings';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { t } = useTranslation();
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const demoStatus = useDemoStatus();
  const [resetting, setResetting] = useState<boolean>(false);
  const apiBaseUrl = getApiBaseUrl();

  const demoMode = demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo';

  useEffect(() => {
    const checkStatus = async () => {
      const status = await getApiStatus();
      setApiStatus(status);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleResetDemo = async () => {
    if (!confirm(t('demo.resetConfirm'))) {
      return;
    }
    
    try {
      setResetting(true);
      const result = await resetDemoData();
      if (result.success) {
        alert(t('demo.resetSuccess'));
        window.location.reload();
      }
    } catch (err) {
      alert(`${t('common.error')}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1>{t('app.title')}</h1>
        </div>
        <nav className="header-center">
          <div className="app-nav">
            <button
              data-testid="nav-budget-tab"
              className={`nav-tab ${activeTab === 'budget' ? 'active' : ''}`}
              onClick={() => onTabChange('budget')}
            >
              {t('nav.budget')}
            </button>
            <button
              data-testid="nav-projection-tab"
              className={`nav-tab ${activeTab === 'projection' ? 'active' : ''}`}
              onClick={() => onTabChange('projection')}
            >
              {t('nav.projection')}
            </button>
            <button
              data-testid="nav-settings-tab"
              className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onTabChange('settings')}
            >
              {t('nav.settings')}
            </button>
          </div>
        </nav>
        <div className="header-right">
          <LanguageSwitcher />
          {demoMode && (
            <button
              className="btn btn-demo-reset"
              onClick={handleResetDemo}
              disabled={resetting}
              title={t('demo.reset')}
            >
              {resetting ? t('demo.resetting') : t('demo.reset')}
            </button>
          )}
          <div className={`api-status api-status-${apiStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {apiStatus === 'checking' && t('status.checking')}
              {apiStatus === 'green' && t('status.connected')}
              {apiStatus === 'yellow' && t('status.dbDown')}
              {apiStatus === 'red' && t('status.disconnected')}
            </span>
          </div>
        </div>
      </header>
      {apiStatus === 'red' && (
        <div className="api-warning-banner api-warning-red">
          <span className="warning-icon">⚠</span>
          <span>
            {t('status.apiWarningRed')} <code>{apiBaseUrl}</code>.
            {apiBaseUrl === 'http://localhost:3000' && (
              <> {t('status.setEnvVar')}</>
            )}
          </span>
        </div>
      )}
      {apiStatus === 'yellow' && (
        <div className="api-warning-banner api-warning-yellow">
          <span className="warning-icon">⚠</span>
          <span>{t('status.apiWarningYellow')}</span>
        </div>
      )}
      <main className="app-main">{children}</main>
    </div>
  );
};
