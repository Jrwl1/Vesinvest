import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { login, demoLogin, resetDemoData, getApiBaseUrl } from '../api';
import type { DemoEntryState } from '../context/DemoStatusContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface LoginFormProps {
  onSuccess: () => void;
  demoError?: string | null;
  demoState: DemoEntryState;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  demoError,
  demoState,
}) => {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginLanguageInitialized = React.useRef(false);

  const apiBaseUrl = getApiBaseUrl();
  const demoEnabled = demoState === 'available';
  const demoUnreachable = demoState === 'unreachable';
  const demoStatusLoading = demoState === 'loading';
  const demoUnavailable = demoState === 'unavailable';
  const demoStatusText = demoEnabled
    ? t('auth.demoStatusAvailable', 'Available')
    : demoStatusLoading
    ? t('auth.demoChecking', 'Checking demo...')
    : demoUnreachable
    ? t('auth.demoStatusUnreachable', 'Backend unreachable')
    : t('auth.demoStatusUnavailable', 'Unavailable');
  const demoStatusHint = demoEnabled
    ? t(
        'auth.demoStatusAvailableHint',
        'Use Try Demo to open the demo workspace.',
      )
    : demoStatusLoading
    ? t(
        'auth.demoStatusLoadingHint',
        'Checking whether this environment offers demo access.',
      )
    : demoUnreachable
    ? t(
        'auth.demoStatusUnreachableHint',
        'The backend is not responding, so demo availability cannot be confirmed.',
      )
    : t(
        'auth.demoStatusUnavailableHint',
        'Sign in to this environment with a normal user account.',
      );
  const showDemoStatusSummary = demoEnabled || demoStatusLoading || demoUnreachable;

  React.useEffect(() => {
    if (loginLanguageInitialized.current) {
      return;
    }
    loginLanguageInitialized.current = true;

    const currentLanguage = String(
      i18n.resolvedLanguage ?? i18n.language ?? '',
    )
      .trim()
      .toLowerCase();

    if (!currentLanguage.startsWith('fi')) {
      void i18n.changeLanguage('fi');
    }
  }, [i18n]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email.trim().toLowerCase(), password);
      onSuccess();
    } catch (err) {
      const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status?: unknown }).status === 'number'
          ? (err as { status: number }).status
          : undefined;

      const message =
        status === 429
          ? t(
              'auth.tooManyAttempts',
              'Too many login attempts. Please wait and try again.',
            )
          : err instanceof Error
          ? err.message
          : t('auth.loginFailed', 'Login failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Demo login is explicit; never auto-run on load. Only this button handler calls demoLogin().
  // Acceptance: (1) Fresh load, no token -> Sign In. (2) Click "Use Demo" -> POST /auth/demo-login, then navigate. (3) Backend unreachable -> button disabled + banner, stay on Sign In.
  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    const tryLogin = async (): Promise<boolean> => {
      try {
        await demoLogin();
        onSuccess();
        return true;
      } catch {
        return false;
      }
    };
    const ok = await tryLogin();
    if (!ok) {
      const retryOk = await tryLogin();
      if (!retryOk) {
        setError(
          t(
            'auth.demoRetryAfterReset',
            "Demo data was reset. Click 'Use Demo' again.",
          ),
        );
      }
    }
    setDemoLoading(false);
  };

  const handleResetDemo = async () => {
    setResetLoading(true);
    setError(null);
    try {
      await resetDemoData();
      await demoLogin();
      onSuccess();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : t('demo.resetFailed', 'Reset demo failed');
      setError(message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-container">
      <section
        className="entry-hero"
        aria-label={t(
          'auth.workspaceTitle',
          'Plan water utility finances',
        )}
      >
        <h1 className="entry-hero-brand">{t('app.title', 'Vesipolku')}</h1>
        <div className="entry-hero-points">
          <p>
            {t(
              'auth.workspacePointBaseline',
              "Bring in the utility's data from VEETI.",
            )}
          </p>
          <p>
            {t(
              'auth.workspacePointForecast',
              'Correct figures manually or from a PDF when needed.',
            )}
          </p>
          <p>
            {t(
              'auth.workspacePointReports',
              'Add future investments and see what they mean for the water price.',
            )}
          </p>
        </div>
      </section>
      <div className="login-card">
        <div className="login-card-head">
          <div className="login-card-toolbar">
            <LanguageSwitcher />
          </div>
          <h2>{t('auth.loginSubtitle', 'Open your workspace')}</h2>
        </div>

        {demoError && <div className="demo-error-banner">{demoError}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">{t('auth.email', 'Email')}</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder', 'you@example.com')}
              className="form-input"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.password', 'Password')}</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder', 'password')}
              className="form-input"
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading || demoLoading}
          >
            {loading
              ? t('auth.signingIn', 'Signing in...')
              : t('auth.signIn', 'Sign in')}
          </button>

          {(demoEnabled || demoStatusLoading) && (
            <>
              <button
                type="button"
                className="btn btn-secondary demo-login-btn"
                data-testid="demo-login-btn"
                onClick={handleDemoLogin}
                disabled={
                  loading || demoLoading || resetLoading || demoStatusLoading
                }
              >
                {demoLoading
                  ? t('common.loading', 'Loading...')
                  : demoStatusLoading
                  ? t('auth.demoChecking', 'Checking demo...')
                  : t('auth.demoLogin', 'Try Demo')}
              </button>
              {!demoUnavailable && !demoUnreachable && !demoStatusLoading && (
                <button
                  type="button"
                  className="btn btn-outline demo-reset-btn"
                  onClick={handleResetDemo}
                  disabled={loading || demoLoading || resetLoading}
                  title={t(
                    'demo.resetTitle',
                    'Clear all demo data and sign in again',
                  )}
                >
                  {resetLoading
                    ? t('demo.resetting', 'Resetting...')
                    : t('demo.reset', 'Reset Demo')}
                </button>
              )}
            </>
          )}
        </form>

        <details
          className="demo-status"
          data-testid="login-support-meta"
          open={demoUnreachable}
        >
          <summary className="demo-status-summary">
            <span>{t('auth.environmentDetails', 'Environment details')}</span>
            {showDemoStatusSummary ? <strong>{demoStatusText}</strong> : null}
          </summary>
          <div className="demo-status-body">
            <div className="demo-status-line">
              <span>{t('status.api', 'API')}:</span> <code>{apiBaseUrl}</code>
            </div>
            {showDemoStatusSummary ? (
              <div className="demo-status-line">
                <span>{t('auth.demoStatusLabel', 'Demo sign-in')}:</span>{' '}
                <strong>{demoStatusText}</strong>
              </div>
            ) : null}
            <p className="demo-status-hint">{demoStatusHint}</p>
          </div>
        </details>
      </div>
    </div>
  );
};
