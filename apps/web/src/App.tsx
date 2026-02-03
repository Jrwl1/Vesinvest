import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchDevToken,
  demoLogin,
  getTokenInfo,
  isAuthenticated,
  isDevMode,
  isDemoMode,
  hasDemoKey,
  clearToken,
  DecodedToken,
} from './api';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { SitesPage } from './pages/SitesPage';
import { ProjectionPage } from './pages/ProjectionPage';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import './App.css';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const AppContent: React.FC = () => {
  const { state, navigateToTab } = useNavigation();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DecodedToken | null>(null);

  // Initialize authentication
  const initAuth = useCallback(async () => {
    setAuthState('loading');
    setLoadingMessage('Initializing...');
    setError(null);

    // Check if we already have a valid token
    if (isAuthenticated()) {
      setTokenInfo(getTokenInfo());
      setAuthState('authenticated');
      return;
    }

    // In demo mode, try auto demo-login (only if key is configured)
    if (isDemoMode() && hasDemoKey()) {
      try {
        setLoadingMessage('Signing you in...');
        await demoLogin();
        setTokenInfo(getTokenInfo());
        setAuthState('authenticated');
        return;
      } catch (err) {
        // Demo login failed, fall through to show login form
        console.warn('Demo login not available:', err);
      }
    }

    // In dev mode, try to get dev token automatically
    if (isDevMode()) {
      try {
        await fetchDevToken();
        setTokenInfo(getTokenInfo());
        setAuthState('authenticated');
        return;
      } catch (err) {
        // Dev token failed, fall through to show login
        console.warn('Dev token not available:', err);
      }
    }

    // No valid token and auto-login failed
    setAuthState('unauthenticated');
  }, []);

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
          <p>{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (authState === 'error') {
    return (
      <div className="app-layout">
        <div className="init-error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated - show login
  if (authState === 'unauthenticated') {
    return (
      <div className="app-layout">
        <LoginForm onSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Authenticated - show main app
  const showAssetDetail = state.tab === 'assets' && state.assetId;

  return (
    <Layout activeTab={state.tab} onTabChange={navigateToTab}>
      {tokenInfo && (
        <div className="auth-info">
          <span className="org-badge">
            {tokenInfo.org_id.slice(0, 8)}...
          </span>
          <span className="role-badge">
            {tokenInfo.roles.join(', ')}
          </span>
          <button onClick={handleLogout} className="btn btn-small logout-btn">
            Logout
          </button>
        </div>
      )}
      {showAssetDetail && <AssetDetailPage assetId={state.assetId!} />}
      {state.tab === 'assets' && !state.assetId && <AssetsPage />}
      {state.tab === 'sites' && <SitesPage />}
      {state.tab === 'plan' && <ProjectionPage />}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  );
};

export default App;
