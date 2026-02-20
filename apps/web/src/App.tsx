import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n'; // Initialize i18n
import {
  getTokenInfo,
  isAuthenticated,
  clearToken,
  DecodedToken,
  getLegalStatus,
} from './api';
import { Layout } from './components/Layout';
import { InviteAcceptForm } from './components/InviteAcceptForm';
import { LegalAcceptanceGate } from './components/LegalAcceptanceGate';
import { LoginForm } from './components/LoginForm';
import { BudgetPage } from './pages/BudgetPage';
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
  const [legalGateState, setLegalGateState] = useState<'idle' | 'checking' | 'required' | 'clear'>('idle');

  // Backend demo mode: only from GET /demo/status (context). Never from env.
  const isBackendDemoMode =
    demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo';

  const isInviteAcceptPath =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/invite/accept');

  // Initialize authentication from token only. Login page is always shown first.
  // Acceptance: (1) No token -> Sign In. (2) Valid token -> app. (3) Demo only on "Use Demo" click.
  // (4) Backend unreachable -> button disabled + banner, stay on Sign In. (5) No infinite demo-login calls.
  // We do NOT wait for GET /demo/status to decide auth; demo status only affects button visibility/state.
  const initAuth = useCallback(async () => {
    setAuthState('loading');
    setLoadingMessage(t('common.loading'));
    setError(null);
    setDemoError(null);

    // Decide auth from token only. Never auto-call demoLogin() or fetchDevToken().
    if (isAuthenticated()) {
      setTokenInfo(getTokenInfo());
      setAuthState('authenticated');
      return;
    }

    setAuthState('unauthenticated');
  }, [t]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (authState !== 'authenticated') {
      setLegalGateState('idle');
      return;
    }

    if (demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo') {
      setLegalGateState('clear');
      return;
    }

    let cancelled = false;
    const checkLegal = async () => {
      setLegalGateState('checking');
      try {
        const status = await getLegalStatus();
        if (cancelled) return;
        setLegalGateState(
          status.requiresUserAcceptance || !status.orgUnlocked ? 'required' : 'clear',
        );
      } catch {
        if (!cancelled) setLegalGateState('required');
      }
    };

    checkLegal();
    return () => {
      cancelled = true;
    };
  }, [authState, tokenInfo?.sub, demoStatus]);

  // Handle successful login
  const handleLoginSuccess = useCallback(() => {
    setLegalGateState('checking');
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
    if (isInviteAcceptPath) {
      return (
        <div className="app-layout">
          <InviteAcceptForm onSuccess={handleLoginSuccess} />
        </div>
      );
    }

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
              ? demoStatus.appMode === 'internal_demo' && demoStatus.demoLoginEnabled
              : false
          }
          demoUnreachable={demoStatus.status === 'unreachable'}
          demoStatusLoading={demoStatus.status === 'loading'}
        />
      </div>
    );
  }

  if (legalGateState === 'idle' || legalGateState === 'checking') {
    return (
      <div className="app-layout">
        <div className="init-loading">
          <div className="spinner"></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (legalGateState === 'required') {
    return <LegalAcceptanceGate onUnlocked={() => setLegalGateState('clear')} />;
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
