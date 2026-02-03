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
  fetchConfig,
  getDemoOrgId,
  DecodedToken,
} from './api';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { AssetsPage } from './pages/AssetsPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { SitesPage } from './pages/SitesPage';
import { ProjectionPage } from './pages/ProjectionPage';
import { ImportPage } from './pages/ImportPage';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import './App.css';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const AppContent: React.FC = () => {
  const { state, navigateToTab } = useNavigation();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DecodedToken | null>(null);
  const [isBackendDemoMode, setIsBackendDemoMode] = useState(false);

  // Initialize authentication
  const initAuth = useCallback(async () => {
    setAuthState('loading');
    setLoadingMessage('Initializing...');
    setError(null);
    setDemoError(null);

    // First, fetch backend config to check if demo mode is enabled server-side
    const config = await fetchConfig();
    setIsBackendDemoMode(config.demoMode);
    
    // If backend is in demo mode, skip auth entirely
    if (config.demoMode) {
      console.warn('DEMO MODE — authentication disabled');
      // Create synthetic token info for display
      setTokenInfo({
        sub: 'demo-user',
        org_id: config.demoOrgId || 'demo-org',
        roles: ['admin'],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400, // 24h from now
      });
      setAuthState('authenticated');
      return;
    }

    // Check if we already have a valid token
    if (isAuthenticated()) {
      setTokenInfo(getTokenInfo());
      setAuthState('authenticated');
      return;
    }

    // In demo mode (frontend env), try auto demo-login (only if key is configured)
    if (isDemoMode() && hasDemoKey()) {
      try {
        setLoadingMessage('Signing you in...');
        await demoLogin();
        setTokenInfo(getTokenInfo());
        setAuthState('authenticated');
        return;
      } catch (err) {
        // Demo login failed, track reason and fall through to show login form
        const msg = err instanceof Error ? err.message : 'Demo login failed';
        console.warn('Demo auto-login failed:', msg);
        setDemoError(msg);
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
        <LoginForm onSuccess={handleLoginSuccess} demoError={demoError} />
      </div>
    );
  }

  // Authenticated - show main app
  const showAssetDetail = state.tab === 'assets' && state.assetId;

  return (
    <Layout activeTab={state.tab} onTabChange={navigateToTab}>
      {/* Demo Mode Banner */}
      {isBackendDemoMode && (
        <div className="demo-banner">
          <span className="demo-banner-icon">⚠️</span>
          <span className="demo-banner-text">
            DEMO MODE — Authentication disabled. Data will not persist.
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
                Logout
              </button>
            </>
          )}
        </div>
      )}
      {showAssetDetail && <AssetDetailPage assetId={state.assetId!} />}
      {state.tab === 'assets' && !state.assetId && <AssetsPage />}
      {state.tab === 'sites' && <SitesPage />}
      {state.tab === 'plan' && <ProjectionPage />}
      {state.tab === 'import' && <ImportPage />}
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
