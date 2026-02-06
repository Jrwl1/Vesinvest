import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n'; // Initialize i18n
import {
  fetchDevToken,
  demoLogin,
  getTokenInfo,
  isAuthenticated,
  isDevMode,
  clearToken,
  DecodedToken,
} from './api';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { BudgetPage } from './pages/BudgetPage';
import { RevenuePage } from './pages/RevenuePage';
import { ProjectionPage } from './pages/ProjectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { DemoStatusProvider, useDemoStatus } from './context/DemoStatusContext';
import './App.css';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const { state, navigateToTab } = useNavigation();
  const demoStatus = useDemoStatus();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DecodedToken | null>(null);

  // Backend demo mode: only from GET /demo/status (context). Never from env.
  const isBackendDemoMode =
    demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled;

  // Initialize authentication
  const initAuth = useCallback(async () => {
    setAuthState('loading');
    setLoadingMessage(t('common.loading'));
    setError(null);
    setDemoError(null);

    // Wait for demo status so we know if backend has demo enabled
    if (demoStatus.status === 'loading') {
      return;
    }

    // If backend has demo enabled, get a real demo token so re-entry after logout works
    if (demoStatus.status === 'ready' && 'enabled' in demoStatus && demoStatus.enabled) {
      try {
        setLoadingMessage(t('common.loading'));
        await demoLogin();
        setTokenInfo(getTokenInfo());
        setAuthState('authenticated');
        return;
      } catch (err) {
        console.warn('Demo auto-login failed, using synthetic session:', err);
        const orgId = 'orgId' in demoStatus ? demoStatus.orgId : null;
        setTokenInfo({
          sub: 'demo-user',
          org_id: orgId || 'demo-org',
          roles: ['admin'],
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400,
        });
        setAuthState('authenticated');
        return;
      }
    }

    // Check if we already have a valid token
    if (isAuthenticated()) {
      setTokenInfo(getTokenInfo());
      setAuthState('authenticated');
      return;
    }

    // In dev mode, try to get dev token automatically
    if (isDevMode()) {
      try {
        await fetchDevToken();
        setTokenInfo(getTokenInfo());
        setAuthState('authenticated');
        return;
      } catch (err) {
        console.warn('Dev token not available:', err);
      }
    }

    setAuthState('unauthenticated');
  }, [demoStatus, t]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Handle successful login
  const handleLoginSuccess = useCallback(() => {
    setTokenInfo(getTokenInfo());
    setAuthState('authenticated');
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    clearToken();
    setTokenInfo(null);
    setAuthState('unauthenticated');
  }, []);

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="app-layout">
        <div className="init-loading">
          <div className="spinner"></div>
          <p>{loadingMessage || t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (authState === 'error') {
    return (
      <div className="app-layout">
        <div className="init-error">
          <h2>{t('common.error')}</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated - show login (demo button visibility from backend status only)
  if (authState === 'unauthenticated') {
    return (
      <div className="app-layout">
        {demoStatus.status === 'unreachable' && (
          <div className="demo-unreachable-banner" role="alert">
            {t('demo.unreachable')}
          </div>
        )}
        <LoginForm
          onSuccess={handleLoginSuccess}
          demoError={demoError}
          demoEnabled={
            demoStatus.status === 'ready'
              ? 'enabled' in demoStatus && demoStatus.enabled
              : demoStatus.status === 'unreachable'
          }
          demoUnreachable={demoStatus.status === 'unreachable'}
        />
      </div>
    );
  }

  // Authenticated - show main app
  return (
    <Layout activeTab={state.tab} onTabChange={navigateToTab}>
      {/* Demo Mode Banner */}
      {isBackendDemoMode && (
        <div className="demo-banner">
          <span className="demo-banner-icon">⚠️</span>
          <span className="demo-banner-text">
            {t('demo.banner')}
          </span>
        </div>
      )}
      
      {/* Auth Info (hide logout in demo mode) */}
      {tokenInfo && (
        <div className="auth-info">
          {isBackendDemoMode ? (
            <span className="demo-badge">Demo</span>
          ) : (
            <>
              <span className="org-badge">
                {tokenInfo.org_id.slice(0, 8)}...
              </span>
              <span className="role-badge">
                {tokenInfo.roles.join(', ')}
              </span>
              <button onClick={handleLogout} className="btn btn-small logout-btn">
                {t('auth.signOut')}
              </button>
            </>
          )}
        </div>
      )}
      {state.tab === 'budget' && <BudgetPage />}
      {state.tab === 'revenue' && <RevenuePage />}
      {state.tab === 'projection' && <ProjectionPage />}
      {state.tab === 'settings' && <SettingsPage />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <DemoStatusProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </DemoStatusProvider>
  );
};

export default App;
