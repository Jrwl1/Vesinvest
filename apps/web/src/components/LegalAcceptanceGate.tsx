import React, { useEffect, useState } from 'react';
import { acceptLegal, getLegalCurrent, getLegalStatus } from '../api';

interface LegalAcceptanceGateProps {
  onUnlocked: () => void;
}

export const LegalAcceptanceGate: React.FC<LegalAcceptanceGateProps> = ({ onUnlocked }) => {
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
        const [current, legalStatus] = await Promise.all([getLegalCurrent(), getLegalStatus()]);
        setDocs(current);
        setStatus(legalStatus);
        if (!legalStatus.requiresUserAcceptance && legalStatus.orgUnlocked) {
          onUnlocked();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load legal status');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onUnlocked]);

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
      setError(err instanceof Error ? err.message : 'Failed to accept legal terms');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-layout">
        <div className="login-container">
          <div className="login-card">
            <h2>Loading legal terms...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="login-container">
        <div className="login-card">
          <h2>Legal acceptance required</h2>
          <p className="login-subtitle">
            Accept Terms and DPA before using this tenant.
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
                  Terms version <strong>{docs.termsVersion}</strong>
                  {docs.termsUrl && (
                    <>
                      {' '}
                      <a href={docs.termsUrl} target="_blank" rel="noreferrer">
                        Open
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
                  DPA version <strong>{docs.dpaVersion}</strong>
                  {docs.dpaUrl && (
                    <>
                      {' '}
                      <a href={docs.dpaUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </>
                  )}
                </span>
              </label>
            </div>
          )}

          <button className="btn btn-primary login-btn" onClick={handleAccept} disabled={!canSubmit}>
            {submitting ? 'Saving...' : 'Accept and continue'}
          </button>

          {status?.waitingForAdmin && (
            <p className="login-subtitle">Accepted. Waiting for organization admin to unlock tenant.</p>
          )}
        </div>
      </div>
    </div>
  );
};

