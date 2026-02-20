import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createBudgetLine,
  createRevenueDriver,
  updateRevenueDriver,
  updateBudget,
  type Budget,
} from '../api';

type GroupKey = 'income' | 'cost' | 'depreciation' | 'investment';

type DraftRow = {
  id: string;
  group: GroupKey;
  nimi: string;
  tiliryhma: string;
  summa: number;
  tyyppi: 'tulo' | 'kulu' | 'investointi';
};

const DEFAULT_GROUPS: Array<{ key: GroupKey; typeLabelKey: string; tyyppi: 'tulo' | 'kulu' | 'investointi' }> = [
  { key: 'income', typeLabelKey: 'budget.manualSetupGroupIncome', tyyppi: 'tulo' },
  { key: 'cost', typeLabelKey: 'budget.manualSetupGroupCosts', tyyppi: 'kulu' },
  { key: 'depreciation', typeLabelKey: 'budget.manualSetupGroupDepreciation', tyyppi: 'kulu' },
  { key: 'investment', typeLabelKey: 'budget.manualSetupGroupInvestments', tyyppi: 'investointi' },
];

interface ManualBudgetSetupWizardProps {
  budget: Budget;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
}

export const ManualBudgetSetupWizard: React.FC<ManualBudgetSetupWizardProps> = ({
  budget,
  onClose,
  onCompleted,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupEnabled, setGroupEnabled] = useState<Record<GroupKey, boolean>>({
    income: true,
    cost: true,
    depreciation: true,
    investment: true,
  });
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [vesiPrice, setVesiPrice] = useState(0);
  const [vesiVolume, setVesiVolume] = useState(0);
  const [jatevesiPrice, setJatevesiPrice] = useState(0);
  const [jatevesiVolume, setJatevesiVolume] = useState(0);

  const enabledGroups = useMemo(() => {
    return DEFAULT_GROUPS
      .filter((g) => groupEnabled[g.key])
      .map((g) => ({ ...g, label: t(g.typeLabelKey) }));
  }, [groupEnabled, t]);
  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    if (vesiPrice <= 0) missing.push('vesi.yksikkohinta');
    if (vesiVolume <= 0) missing.push('vesi.myytyMaara');
    if (jatevesiPrice <= 0) missing.push('jatevesi.yksikkohinta');
    if (jatevesiVolume <= 0) missing.push('jatevesi.myytyMaara');
    return missing;
  }, [vesiPrice, vesiVolume, jatevesiPrice, jatevesiVolume]);

  const addRow = (group: GroupKey, tyyppi: 'tulo' | 'kulu' | 'investointi') => {
    setRows((prev) => [
      ...prev,
      {
        id: `${group}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        group,
        nimi: '',
        tiliryhma: '',
        summa: 0,
        tyyppi,
      },
    ]);
  };

  const saveAll = async () => {
    if (requiredMissing.length > 0) {
      setError(`${t('budget.manualSetupMissingRequired')}: ${requiredMissing.join(', ')}`);
      setStep(4);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const groupLineIdByGroup = new Map<GroupKey, string>();
      let sortOrder = 0;
      for (const group of enabledGroups) {
        const createdGroup = await createBudgetLine(budget.id, {
          tiliryhma:
            group.key === 'income'
              ? '3000'
              : group.key === 'investment'
                ? '5000'
                : group.key === 'depreciation'
                  ? '4600'
                  : '4000',
          nimi: group.label,
          tyyppi: group.tyyppi,
          summa: 0,
          rowKind: 'group',
          sortOrder: sortOrder++,
        });
        groupLineIdByGroup.set(group.key, createdGroup.id);
      }

      for (const row of rows) {
        const parentId = groupLineIdByGroup.get(row.group);
        if (!parentId) continue;
        await createBudgetLine(budget.id, {
          tiliryhma: row.tiliryhma || '9999',
          nimi: row.nimi || 'Rivi',
          tyyppi: row.tyyppi,
          summa: row.summa,
          rowKind: 'line',
          parentId,
          sortOrder: sortOrder++,
        });
      }

      const existingVesi = (budget.tuloajurit ?? []).find((d) => d.palvelutyyppi === 'vesi');
      const existingJate = (budget.tuloajurit ?? []).find((d) => d.palvelutyyppi === 'jatevesi');
      const manualSourceMeta = { imported: false, manualOverride: true, source: 'manual_setup_wizard' };

      if (existingVesi) {
        await updateRevenueDriver(budget.id, existingVesi.id, {
          yksikkohinta: vesiPrice,
          myytyMaara: vesiVolume,
          sourceMeta: manualSourceMeta,
        });
      } else {
        await createRevenueDriver(budget.id, {
          palvelutyyppi: 'vesi',
          yksikkohinta: vesiPrice,
          myytyMaara: vesiVolume,
          sourceMeta: manualSourceMeta,
        });
      }

      if (existingJate) {
        await updateRevenueDriver(budget.id, existingJate.id, {
          yksikkohinta: jatevesiPrice,
          myytyMaara: jatevesiVolume,
          sourceMeta: manualSourceMeta,
        });
      } else {
        await createRevenueDriver(budget.id, {
          palvelutyyppi: 'jatevesi',
          yksikkohinta: jatevesiPrice,
          myytyMaara: jatevesiVolume,
          sourceMeta: manualSourceMeta,
        });
      }

      await updateBudget(budget.id, {
        inputCompleteness: {
          requiredDrivers: {
            vesi: true,
            jatevesi: true,
          },
          ready: true,
          source: 'manual_setup_wizard',
        },
      });
      await onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save manual setup');
    } finally {
      setSaving(false);
    }
  };

  const nextDisabled = (step === 4 && requiredMissing.length > 0) || saving;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-content" style={{ maxWidth: 760 }}>
        <h3 style={{ marginTop: 0 }}>
          {t('budget.manualSetupWizardTitle', 'Guided Manual Setup')}
        </h3>
        {error && <div className="error-banner">⚠ {error}</div>}

        {step === 1 && (
          <div>
            <p>{t('budget.manualSetupStep1', 'Step 1: Baseline year')}</p>
            <p>{t('common.year')}: {budget.vuosi}</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <p>{t('budget.manualSetupStep2', 'Step 2: Select top-level groups')}</p>
            {DEFAULT_GROUPS.map((g) => (
              <label key={g.key} style={{ display: 'block', marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={groupEnabled[g.key]}
                  onChange={(e) => setGroupEnabled((prev) => ({ ...prev, [g.key]: e.target.checked }))}
                />{' '}
                {t(g.typeLabelKey)}
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            <p>{t('budget.manualSetupStep3', 'Step 3: Add rows and subrows')}</p>
            {enabledGroups.map((group) => {
              const groupRows = rows.filter((r) => r.group === group.key);
              return (
                <div key={group.key} style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{group.label}</strong>
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => addRow(group.key, group.tyyppi)}
                    >
                      {t('common.add')}
                    </button>
                  </div>
                  {groupRows.map((row) => (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 140px auto', gap: 8, marginTop: 8 }}>
                      <input
                        className="input-field"
                        placeholder={t('budget.name')}
                        value={row.nimi}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, nimi: value } : r)));
                        }}
                      />
                      <input
                        className="input-field"
                        placeholder={t('budget.accountGroup')}
                        value={row.tiliryhma}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, tiliryhma: value } : r)));
                        }}
                      />
                      <input
                        className="input-field"
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.summa}
                        onChange={(e) => {
                          const value = Number(e.target.value || 0);
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, summa: value } : r)));
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div>
            <p>{t('budget.manualSetupStep4', 'Step 4: Required driver inputs')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
                <strong>{t('revenue.water.title', 'Vesi')}</strong>
                <label style={{ display: 'block', marginTop: 8 }}>
                  {t('budget.waterPrice', 'Vesihinta (€/m³)')}
                  <input className="input-field" type="number" min={0} step="0.001" value={vesiPrice} onChange={(e) => setVesiPrice(Number(e.target.value || 0))} />
                </label>
                <label style={{ display: 'block', marginTop: 8 }}>
                  {t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)')}
                  <input className="input-field" type="number" min={0} step="1" value={vesiVolume} onChange={(e) => setVesiVolume(Number(e.target.value || 0))} />
                </label>
              </div>
              <div style={{ border: '1px solid #d8dee8', borderRadius: 8, padding: 10 }}>
                <strong>{t('revenue.wastewater.title', 'Jätevesi')}</strong>
                <label style={{ display: 'block', marginTop: 8 }}>
                  {t('budget.wastewaterPrice', 'Jätevesihinta (€/m³)')}
                  <input className="input-field" type="number" min={0} step="0.001" value={jatevesiPrice} onChange={(e) => setJatevesiPrice(Number(e.target.value || 0))} />
                </label>
                <label style={{ display: 'block', marginTop: 8 }}>
                  {t('budget.historicalSoldVolume', 'Myyty vesimäärä (m³/v)')}
                  <input className="input-field" type="number" min={0} step="1" value={jatevesiVolume} onChange={(e) => setJatevesiVolume(Number(e.target.value || 0))} />
                </label>
              </div>
            </div>
            {requiredMissing.length > 0 && (
              <p className="error-text" style={{ marginTop: 8 }}>
                Missing: {requiredMissing.join(', ')}
              </p>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <p>{t('budget.manualSetupStep5', 'Step 5: Review and save')}</p>
            <p>{t('budget.manualSetupSummaryRows', 'Rows')}: {rows.length}</p>
            <p>{t('budget.manualSetupSummaryGroups', 'Groups')}: {enabledGroups.length}</p>
            <p>
              {t('budget.manualSetupSummaryReady', 'Calculation readiness')}:{' '}
              {requiredMissing.length === 0
                ? t('common.ready', 'Ready')
                : t('budget.manualSetupMissingRequired', 'Missing required fields')}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 1 && (
              <button type="button" className="btn btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={saving}>
                {t('common.back', 'Back')}
              </button>
            )}
            {step < 5 ? (
              <button type="button" className="btn btn-primary" onClick={() => setStep((s) => Math.min(5, s + 1))} disabled={nextDisabled}>
                {t('common.next', 'Next')}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={saveAll} disabled={saving || requiredMissing.length > 0}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
