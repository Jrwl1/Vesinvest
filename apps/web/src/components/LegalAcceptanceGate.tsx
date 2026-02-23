import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { acceptLegal, getLegalCurrent, getLegalStatus } from '../api';

interface LegalAcceptanceGateProps {
  onUnlocked: () => void;
}

export const LegalAcceptanceGate: React.FC<LegalAcceptanceGateProps> = ({
  onUnlocked,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [dpaChecked, setDpaChecked] = useState(false);
  const [docs, setDocs] = useState<{
    termsVersion: string;
    termsUrl: string | null;
    dpaVersion: string;
    dpaUrl: string | null;
  } | null>(null);
  const [status, setStatus] = useState<{
    requiresUserAcceptance: boolean;
    orgUnlocked: boolean;
    waitingForAdmin: boolean;
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [current, legalStatus] = await Promise.all([
          getLegalCurrent(),
          getLegalStatus(),
        ]);
        setDocs(current);
        setStatus(legalStatus);
        if (!legalStatus.requiresUserAcceptance && legalStatus.orgUnlocked) {
          onUnlocked();
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('legal.errorLoadStatus', 'Failed to load legal status'),
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onUnlocked, t]);

  const canSubmit = termsChecked && dpaChecked && !submitting;

  const handleAccept = async () => {
    setError(null);
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await acceptLegal();
      if (!result.requiresUserAcceptance && result.orgUnlocked) {
        onUnlocked();
      } else {
        setStatus({
          requiresUserAcceptance: result.requiresUserAcceptance,
          orgUnlocked: result.orgUnlocked,
          waitingForAdmin: result.waitingForAdmin,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('legal.errorAcceptFailed', 'Failed to accept legal terms'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <div className="login-container">
          <div className="login-card">
            <h2>{t('legal.loading', 'Loading legal terms...')}</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="login-container">
        <div className="login-card">
          <h2>{t('legal.title', 'Legal acceptance required')}</h2>
          <p className="login-subtitle">
            {t(
              'legal.subtitle',
              'Accept Terms and DPA before using this tenant.',
            )}
          </p>

          {error && <div className="login-error">{error}</div>}

          {docs && (
            <div className="legal-doc-list">
              <label className="legal-check">
                <input
                  type="checkbox"
                  checked={termsChecked}
                  onChange={(e) => setTermsChecked(e.target.checked)}
                />
                <span>
                  {t('legal.termsVersion', 'Terms version')}{' '}
                  <strong>{docs.termsVersion}</strong>
                  {docs.termsUrl && (
                    <>
                      {' '}
                      <a href={docs.termsUrl} target="_blank" rel="noreferrer">
                        {t('legal.openDoc', 'Open')}
                      </a>
                    </>
                  )}
                </span>
              </label>

              <label className="legal-check">
                <input
                  type="checkbox"
                  checked={dpaChecked}
                  onChange={(e) => setDpaChecked(e.target.checked)}
                />
                <span>
                  {t('legal.dpaVersion', 'DPA version')}{' '}
                  <strong>{docs.dpaVersion}</strong>
                  {docs.dpaUrl && (
                    <>
                      {' '}
                      <a href={docs.dpaUrl} target="_blank" rel="noreferrer">
                        {t('legal.openDoc', 'Open')}
                      </a>
                    </>
                  )}
                </span>
              </label>
            </div>
          )}

          <button
            className="btn btn-primary login-btn"
            onClick={handleAccept}
            disabled={!canSubmit}
          >
            {submitting
              ? t('legal.saving', 'Saving...')
              : t('legal.acceptAndContinue', 'Accept and continue')}
          </button>

          {status?.waitingForAdmin && (
            <p className="login-subtitle">
              {t(
                'legal.waitingForAdmin',
                'Accepted. Waiting for organization admin to unlock tenant.',
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
