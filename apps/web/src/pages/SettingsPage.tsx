import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useDemoStatus } from '../context/DemoStatusContext';
import {
  resetDemoData, listAssumptions, upsertAssumption, resetAssumptionDefaults,
  type Assumption,
} from '../api';

// Map assumption keys to translation keys
const ASSUMPTION_LABELS: Record<string, { nameKey: string; descKey: string }> = {
  inflaatio: { nameKey: 'assumptions.inflation', descKey: 'assumptions.inflationDesc' },
  energiakerroin: { nameKey: 'assumptions.energyFactor', descKey: 'assumptions.energyFactorDesc' },
  vesimaaran_muutos: { nameKey: 'assumptions.volumeChange', descKey: 'assumptions.volumeChangeDesc' },
  hintakorotus: { nameKey: 'assumptions.priceIncrease', descKey: 'assumptions.priceIncreaseDesc' },
  investointikerroin: { nameKey: 'assumptions.investmentFactor', descKey: 'assumptions.investmentFactorDesc' },
};

/** Default assumption keys and values when API returns none (manual-first skeleton). */
const DEFAULT_ASSUMPTIONS: { avain: string; arvo: string }[] = [
  { avain: 'inflaatio', arvo: '0.025' },
  { avain: 'energiakerroin', arvo: '0.05' },
  { avain: 'vesimaaran_muutos', arvo: '-0.01' },
  { avain: 'hintakorotus', arvo: '0.03' },
  { avain: 'investointikerroin', arvo: '0.02' },
];

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const demoStatus = useDemoStatus();
  const demoMode = demoStatus.status === 'ready' && demoStatus.enabled;
  const [resetting, setResetting] = React.useState(false);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadAssumptions = useCallback(async () => {
    try {
      const data = await listAssumptions();
      setAssumptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assumptions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssumptions();
  }, [loadAssumptions]);

  const startEdit = (a: Assumption) => {
    setEditingKey(a.avain);
    // Display as percentage for readability
    setEditValue(String(parseFloat(a.arvo) * 100));
  };

  const saveEdit = async (a: Assumption) => {
    const pct = parseFloat(editValue);
    if (isNaN(pct)) { setEditingKey(null); return; }
    try {
      await upsertAssumption(a.avain, { arvo: pct / 100 });
      await loadAssumptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setEditingKey(null);
  };

  const handleResetDefaults = async () => {
    try {
      await resetAssumptionDefaults();
      await loadAssumptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    }
  };

  const handleResetDemo = async () => {
    if (!confirm(t('demo.resetConfirm'))) return;
    try {
      setResetting(true);
      const result = await resetDemoData();
      if (result.success) {
        alert(t('demo.resetSuccess'));
        window.location.reload();
      }
    } catch (err) {
      alert(`${t('common.error')}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setResetting(false);
    }
  };

  const formatPercent = (val: string) => {
    const n = parseFloat(val) * 100;
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)} %`;
  };

  return (
    <div className="settings-page">
      {error && (
        <div className="error-banner"><span>⚠ {error}</span><button className="btn btn-small" onClick={() => setError(null)}>{t('common.close')}</button></div>
      )}
      <div className="page-header"><h2>{t('settings.title')}</h2></div>

      <div className="settings-section">
        <h3>{t('settings.language')}</h3>
        <p className="settings-hint">{t('settings.languageHint')}</p>
        <LanguageSwitcher />
      </div>

      <div className="settings-section">
        <div className="section-header-row">
          <h3>{t('assumptions.title')}</h3>
          <button className="btn btn-ghost btn-small" onClick={handleResetDefaults}>
            {t('assumptions.resetDefaults')}
          </button>
        </div>
        {loading ? (
          <p>{t('common.loading')}</p>
        ) : (
          <div className="assumptions-list">
            {(assumptions.length > 0
              ? assumptions
              : DEFAULT_ASSUMPTIONS.map(({ avain, arvo }) => ({
                  id: avain,
                  avain,
                  arvo,
                  nimi: '',
                  kuvaus: null,
                  orgId: '',
                  yksikko: null,
                  createdAt: '',
                  updatedAt: '',
                } as Assumption))
            ).map((a) => {
              const labels = ASSUMPTION_LABELS[a.avain];
              return (
                <div key={a.id} className="assumption-row">
                  <div className="assumption-info">
                    <div className="assumption-name">{labels ? t(labels.nameKey) : a.nimi}</div>
                    <div className="assumption-desc">{labels ? t(labels.descKey) : (a.kuvaus ?? '')}</div>
                  </div>
                  <div className="assumption-value">
                    {editingKey === a.avain ? (
                      <div className="inline-edit-group">
                        <input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(a)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(a); if (e.key === 'Escape') setEditingKey(null); }}
                          autoFocus
                          className="input-sm-num"
                        />
                        <span className="unit">%</span>
                      </div>
                    ) : (
                      <span className="editable-amount" onClick={() => startEdit(a)}>
                        {formatPercent(a.arvo)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {demoMode && (
        <div className="settings-section">
          <h3>{t('settings.demoSection')}</h3>
          <button
            className="btn btn-danger"
            onClick={handleResetDemo}
            disabled={resetting}
          >
            {resetting ? t('demo.resetting') : t('demo.reset')}
          </button>
        </div>
      )}
    </div>
  );
};
