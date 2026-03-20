import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acceptInvitation } from '../api';

interface InviteAcceptFormProps {
  onSuccess: () => void;
}

function readInviteToken(): string {
  const queryToken = new URLSearchParams(window.location.search)
    .get('token')
    ?.trim();
  if (queryToken) return queryToken;
  const path = window.location.pathname;
  const marker = '/invite/accept/';
  const idx = path.indexOf(marker);
  if (idx >= 0) {
    return decodeURIComponent(path.slice(idx + marker.length)).trim();
  }
  return '';
}

export const InviteAcceptForm: React.FC<InviteAcceptFormProps> = ({
  onSuccess,
}) => {
  const { t } = useTranslation();
  const initialToken = useMemo(() => readInviteToken(), []);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError(t('invite.tokenMissing', 'Invitation token missing'));
      return;
    }
    if (password.length < 8) {
      setError(
        t('invite.passwordTooShort', 'Password must be at least 8 characters'),
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(t('invite.passwordMismatch', 'Passwords do not match'));
      return;
    }

    setLoading(true);
    try {
      await acceptInvitation({ token, password });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('invite.acceptFailed', 'Invitation acceptance failed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
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
      <div className="login-card">
        <div className="login-card-head">
          <span className="login-card-kicker">{t('invite.title', 'Set Password')}</span>
          <h2>{t('invite.title', 'Set Password')}</h2>
          <p className="login-subtitle">
            {t('invite.subtitle', 'Accept invitation and create account access')}
          </p>
          <p className="login-body">{t('invite.body')}</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="inviteToken">
              {t('invite.tokenLabel', 'Invitation token')}
            </label>
            <input
              id="inviteToken"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">
              {t('auth.password', 'Password')}
            </label>
            <input
              id="newPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t(
                'invite.passwordPlaceholder',
                'Minimum 8 characters',
              )}
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">
              {t('invite.confirmPassword', 'Confirm password')}
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-btn"
            disabled={loading}
          >
            {loading
              ? t('invite.activating', 'Activating...')
              : t('invite.activate', 'Activate account')}
          </button>
        </form>
      </div>
    </div>
  );
};
