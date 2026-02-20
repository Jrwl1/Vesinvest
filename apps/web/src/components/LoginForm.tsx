import React, { useState } from 'react';
import { login, demoLogin, resetDemoData, getApiBaseUrl } from '../api';

interface LoginFormProps {
  onSuccess: () => void;
  demoError?: string | null;
  /** From GET /demo/status. When true, show "Use Demo" button enabled. When unreachable, parent may pass true so button area is visible. */
  demoEnabled: boolean;
  /** When true, show "Demo mode unavailable (backend not responding)" in parent; button may still be shown. */
  demoUnreachable?: boolean;
  /** When true, GET /demo/status still in progress; show Use Demo disabled with "Checking...". */
  demoStatusLoading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  demoError,
  demoEnabled,
  demoUnreachable = false,
  demoStatusLoading = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = getApiBaseUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email.trim().toLowerCase(), password);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
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
        setError("Demo data was reset. Click 'Use Demo' again.");
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
      const message = err instanceof Error ? err.message : 'Reset demo failed';
      setError(message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Sign In</h2>
        <p className="login-subtitle">Asset Maintenance System</p>

        {demoEnabled && (
          <div className="demo-status">
            <div className="demo-status-line">
              <span>API:</span> <code>{apiBaseUrl}</code>
            </div>
          </div>
        )}

        {demoError && (
          <div className="demo-error-banner">
            {demoError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading || demoLoading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {(demoEnabled || demoStatusLoading) && (
            <>
              <button
                type="button"
                className="btn btn-secondary demo-login-btn"
                data-testid="demo-login-btn"
                onClick={handleDemoLogin}
                disabled={loading || demoLoading || resetLoading || demoStatusLoading}
              >
                {demoLoading ? 'Loading...' : demoStatusLoading ? 'Checking demo...' : 'Use Demo'}
              </button>
              {!demoUnreachable && !demoStatusLoading && (
                <button
                  type="button"
                  className="btn btn-outline demo-reset-btn"
                  onClick={handleResetDemo}
                  disabled={loading || demoLoading || resetLoading}
                  title="Clear all demo data and sign in again"
                >
                  {resetLoading ? 'Resetting...' : 'Reset Demo'}
                </button>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
};
