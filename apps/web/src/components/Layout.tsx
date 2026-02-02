import React from 'react';

export type TabId = 'assets' | 'sites' | 'plan';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
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
          {/* Future: user menu */}
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
};
