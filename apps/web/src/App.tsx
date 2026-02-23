import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './i18n';
import {
  clearToken,
  DecodedToken,
  getLegalStatus,
  getTokenInfo,
  isAuthenticated,
} from './api';
import { InviteAcceptForm } from './components/InviteAcceptForm';
import { LegalAcceptanceGate } from './components/LegalAcceptanceGate';
import { LoginForm } from './components/LoginForm';
import { DemoStatusProvider, useDemoStatus } from './context/DemoStatusContext';
import { AppShellV2 } from './v2/AppShellV2';
import './App.css';
import './v2/v2.css';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const demoStatus = useDemoStatus();

  const [authState, setAuthState] = useState<AuthState>('loading');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<DecodedToken | null>(null);
  const [legalGateState, setLegalGateState] = useState<'idle' | 'checking' | 'required' | 'clear'>('idle');

  const isBackendDemoMode =
    demoStatus.status === 'ready' && demoStatus.appMode === 'internal_demo';

  const isInviteAcceptPath =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/invite/accept');

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

  const handleLoginSuccess = useCallback(() => {
    setLegalGateState('checking');
    setTokenInfo(getTokenInfo());
    setAuthState('authenticated');
  }, []);

  const handleLogout = useCallback(() => {
    clearToken();
    setTokenInfo(null);
    setAuthState('unauthenticated');
  }, []);

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
        {demoStatus.status === 'unreachable' ? (
          <div className="demo-unreachable-banner" role="alert">
            {t('demo.unreachable')}
          </div>
        ) : null}
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

  return (
    <div className="app-layout">
      <AppShellV2
        tokenInfo={tokenInfo}
        isDemoMode={isBackendDemoMode}
        onLogout={handleLogout}
      />
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
