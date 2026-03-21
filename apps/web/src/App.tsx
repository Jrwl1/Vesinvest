import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import {
  AUTH_INVALIDATED_EVENT,
  clearToken,
  DecodedToken,
  getLegalStatus,
  getTokenInfo,
  isAuthenticated,
} from './api';
import { InviteAcceptForm } from './components/InviteAcceptForm';
import { LegalAcceptanceGate } from './components/LegalAcceptanceGate';
import { LoginForm } from './components/LoginForm';
import {
  DemoStatusProvider,
  useDemoEntryState,
  useDemoStatus,
} from './context/DemoStatusContext';
import './App.css';

const AppShellV2 = React.lazy(async () => {
  await import('./v2/v2.css');
  const mod = await import('./v2/AppShellV2');
  return { default: mod.AppShellV2 };
});

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const demoStatus = useDemoStatus();
  const demoEntryState = useDemoEntryState();

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DecodedToken | null>(null);
  const [legalGateState, setLegalGateState] = useState<
    'idle' | 'checking' | 'required' | 'clear'
  >('idle');

  const isBackendDemoMode =
    demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo';

  const isInviteAcceptPath =
    typeof window !== 'undefined' &&
    window.location.pathname.startsWith('/invite/accept');

  const initAuth = useCallback(async () => {
    setAuthState('loading');
    setLoadingMessage(t('common.loading'));
    setError(null);
    setDemoError(null);

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
    if (typeof window === 'undefined') return;

    const handleAuthInvalidated = () => {
      setTokenInfo(null);
      setLegalGateState('idle');
      setError(null);
      setDemoError(null);
      setAuthState('unauthenticated');
    };

    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener(
        AUTH_INVALIDATED_EVENT,
        handleAuthInvalidated,
      );
    };
  }, []);

  useEffect(() => {
    if (authState !== 'authenticated') {
      setLegalGateState('idle');
      return;
    }

    if (
      demoStatus.status === 'ready' &&
      demoStatus.appMode === 'internal_demo'
    ) {
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
          status.requiresUserAcceptance || !status.orgUnlocked
            ? 'required'
            : 'clear',
        );
      } catch {
        if (!cancelled && isAuthenticated()) setLegalGateState('required');
      }
    };

    checkLegal();
    return () => {
      cancelled = true;
    };
  }, [authState, tokenInfo?.sub, demoStatus]);

  const handleLoginSuccess = useCallback(() => {
    setLegalGateState('checking');
    setTokenInfo(getTokenInfo());
    setAuthState('authenticated');
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
  }, []);

  const entryHero = (
    <section className="entry-hero" aria-label={t('auth.workspaceTitle')}>
      <span className="entry-hero-kicker">{t('app.title', 'Vesipolku')}</span>
      <h1>{t('auth.workspaceTitle')}</h1>
      <p className="entry-hero-body">{t('auth.workspaceBody')}</p>
      <div className="entry-hero-points">
        <p>{t('auth.workspacePointBaseline')}</p>
        <p>{t('auth.workspacePointForecast')}</p>
        <p>{t('auth.workspacePointReports')}</p>
      </div>
    </section>
  );

  if (authState === 'loading') {
    return (
      <div className="app-layout">
        <div className="login-container">
          {entryHero}
          <div className="init-loading">
            <span className="login-card-kicker">{t('common.loading')}</span>
            <div className="spinner"></div>
            <h2>{t('common.loading')}</h2>
            <p className="login-subtitle">
              {loadingMessage || t('auth.loadingSubtitle')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'error') {
    return (
      <div className="app-layout">
        <div className="login-container">
          {entryHero}
          <div className="init-error">
            <span className="login-card-kicker">{t('common.error')}</span>
            <h2>{t('common.error')}</h2>
            <p>{error}</p>
            <p className="hint">{t('auth.errorSubtitle')}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary"
            >
              {t('common.retry')}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <LoginForm
          onSuccess={handleLoginSuccess}
          demoError={demoError}
          demoState={demoEntryState}
        />
      </div>
    );
  }

  if (legalGateState === 'idle' || legalGateState === 'checking') {
    return (
      <div className="app-layout">
        <div className="login-container">
          {entryHero}
          <div className="init-loading">
            <span className="login-card-kicker">{t('common.loading')}</span>
            <div className="spinner"></div>
            <h2>{t('common.loading')}</h2>
            <p className="login-subtitle">{t('auth.loadingSubtitle')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (legalGateState === 'required') {
    return (
      <LegalAcceptanceGate onUnlocked={() => setLegalGateState('clear')} />
    );
  }

  return (
    <div className="app-layout">
      <React.Suspense
        fallback={
          <div className="init-loading">
            <div className="spinner"></div>
            <p>{t('common.loading')}</p>
          </div>
        }
      >
        <AppShellV2
          tokenInfo={tokenInfo}
          isDemoMode={isBackendDemoMode}
          onLogout={handleLogout}
        />
      </React.Suspense>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <DemoStatusProvider>
      <AppContent />
    </DemoStatusProvider>
  );
};

export default App;
