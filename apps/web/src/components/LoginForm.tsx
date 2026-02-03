import React, { useState } from 'react';
import { login, demoLogin, isDemoMode, hasDemoKey } from '../api';

interface LoginFormProps {
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoMode = isDemoMode();
  const demoKeyMissing = demoMode && !hasDemoKey();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password, orgId);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);

    try {
      await demoLogin();
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Demo login failed';
      setError(message);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Sign In</h2>
        <p className="login-subtitle">Asset Maintenance System</p>

        <form onSubmit={handleSubmit} className="login-form">
          {demoKeyMissing && (
            <div className="login-error">
              Demo key missing in deployment config
            </div>
          )}
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="orgId">Organization ID</label>
            <input
              id="orgId"
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
              className="form-input"
              required
              disabled={loading}
            />
          </div>

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

          {demoMode && (
            <button
              type="button"
              className="btn btn-secondary demo-login-btn"
              onClick={handleDemoLogin}
              disabled={loading || demoLoading || demoKeyMissing}
            >
              {demoLoading ? 'Loading demo...' : 'Try Demo'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
