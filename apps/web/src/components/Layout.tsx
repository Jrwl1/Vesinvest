import React, { useEffect, useState } from 'react';
import { getApiStatus, getApiBaseUrl, ApiStatus, resetDemoData } from '../api';
import { useDemoStatus } from '../context/DemoStatusContext';

export type TabId = 'assets' | 'sites' | 'plan' | 'import';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const demoStatus = useDemoStatus();
  const [resetting, setResetting] = useState<boolean>(false);
  const apiBaseUrl = getApiBaseUrl();

  const demoMode = demoStatus.status === 'ready' && demoStatus.enabled;

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
    if (!confirm('Reset all demo data? This will delete all locations, assets, imports, and mappings.')) {
      return;
    }
    
    try {
      setResetting(true);
      const result = await resetDemoData();
      if (result.success) {
        alert(
          `Demo data reset!\n\n` +
          `Deleted:\n` +
          `- ${result.deleted.sites} locations\n` +
          `- ${result.deleted.assets} assets\n` +
          `- ${result.deleted.maintenanceItems} maintenance items\n` +
          `- ${result.deleted.excelImports} imports\n\n` +
          `Recreated:\n` +
          `- ${result.recreated.assetTypes} asset types`
        );
        // Refresh the page to reset all state
        window.location.reload();
      }
    } catch (err) {
      alert(`Reset failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <h1>Asset Maintenance</h1>
        </div>
        <nav className="header-center">
          <div className="app-nav">
            <button
              className={`nav-tab ${activeTab === 'assets' ? 'active' : ''}`}
              onClick={() => onTabChange('assets')}
            >
              Assets
            </button>
            <button
              className={`nav-tab ${activeTab === 'sites' ? 'active' : ''}`}
              onClick={() => onTabChange('sites')}
            >
              Locations
            </button>
            <button
              className={`nav-tab ${activeTab === 'plan' ? 'active' : ''}`}
              onClick={() => onTabChange('plan')}
            >
              Plan
            </button>
            <button
              className={`nav-tab ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => onTabChange('import')}
            >
              Import
            </button>
          </div>
        </nav>
        <div className="header-right">
          {demoMode && (
            <button
              className="btn btn-demo-reset"
              onClick={handleResetDemo}
              disabled={resetting}
              title="Reset all demo data to a clean state"
            >
              {resetting ? 'Resetting...' : 'Reset Demo'}
            </button>
          )}
          <div className={`api-status api-status-${apiStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {apiStatus === 'checking' && 'Checking...'}
              {apiStatus === 'green' && 'Connected'}
              {apiStatus === 'yellow' && 'DB Down'}
              {apiStatus === 'red' && 'Disconnected'}
            </span>
          </div>
        </div>
      </header>
      {apiStatus === 'red' && (
        <div className="api-warning-banner api-warning-red">
          <span className="warning-icon">⚠</span>
          <span>
            Cannot connect to API at <code>{apiBaseUrl}</code>.
            {apiBaseUrl === 'http://localhost:3000' && (
              <> Set <code>VITE_API_BASE_URL</code> environment variable.</>
            )}
          </span>
        </div>
      )}
      {apiStatus === 'yellow' && (
        <div className="api-warning-banner api-warning-yellow">
          <span className="warning-icon">⚠</span>
          <span>API is up but database is temporarily unavailable. Some features may not work.</span>
        </div>
      )}
      <main className="app-main">{children}</main>
    </div>
  );
};
