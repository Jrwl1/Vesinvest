import React, { useEffect, useState } from 'react';
import { checkApiHealth, getApiBaseUrl } from '../api';

export type TabId = 'assets' | 'sites' | 'plan';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const apiBaseUrl = getApiBaseUrl();

  useEffect(() => {
    const checkStatus = async () => {
      const healthy = await checkApiHealth();
      setApiStatus(healthy ? 'connected' : 'disconnected');
    };
    checkStatus();
    // Re-check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

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
              Sites
            </button>
            <button
              className={`nav-tab ${activeTab === 'plan' ? 'active' : ''}`}
              onClick={() => onTabChange('plan')}
            >
              Plan
            </button>
          </div>
        </nav>
        <div className="header-right">
          <div className={`api-status api-status-${apiStatus}`}>
            <span className="status-dot"></span>
            <span className="status-text">
              {apiStatus === 'checking' && 'Checking...'}
              {apiStatus === 'connected' && 'Connected'}
              {apiStatus === 'disconnected' && 'Disconnected'}
            </span>
          </div>
        </div>
      </header>
      {apiStatus === 'disconnected' && (
        <div className="api-warning-banner">
          <span className="warning-icon">⚠</span>
          <span>
            Cannot connect to API at <code>{apiBaseUrl}</code>.
            {apiBaseUrl === 'http://localhost:3000' && (
              <> Set <code>VITE_API_BASE_URL</code> environment variable.</>
            )}
          </span>
        </div>
      )}
      <main className="app-main">{children}</main>
    </div>
  );
};
