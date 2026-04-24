import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  acceptTariffPlanV2,
  createReportV2,
  getPlanningContextV2,
  getTariffPlanV2,
  saveTariffPlanV2,
  type V2PlanningContextResponse,
  type V2TariffAllocationPolicy,
  type V2TariffBaselineInput,
  type V2TariffFeeKey,
  type V2TariffPlan,
} from '../api';
import { formatDateTime, formatEur, formatNumber, formatPercent, formatPrice } from './format';

type Props = {
  onGoToAssetManagement: () => void;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  onTariffPlanAccepted?: () => void;
};

const FEE_KEYS: V2TariffFeeKey[] = [
  'connectionFee',
  'baseFee',
  'waterUsageFee',
  'wastewaterUsageFee',
];

const FEE_SHARE_FIELDS: Record<
  V2TariffFeeKey,
  keyof Pick<
    V2TariffAllocationPolicy,
    | 'connectionFeeSharePct'
    | 'baseFeeSharePct'
    | 'waterUsageSharePct'
    | 'wastewaterUsageSharePct'
  >
> = {
  connectionFee: 'connectionFeeSharePct',
  baseFee: 'baseFeeSharePct',
  waterUsageFee: 'waterUsageSharePct',
  wastewaterUsageFee: 'wastewaterUsageSharePct',
};

const numberValue = (value: number | null | undefined) =>
  value == null || Number.isNaN(value) ? '' : String(value);

const parseInputNumber = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatTariffUnit = (key: V2TariffFeeKey, value: number | null) => {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return key === 'waterUsageFee' || key === 'wastewaterUsageFee'
    ? formatPrice(value)
    : formatEur(value, 2);
};

const getTariffStatusKey = (status: V2TariffPlan['status'] | null | undefined) => {
  if (status === 'accepted') {
    return 'statusAccepted';
  }
  if (status === 'stale') {
    return 'statusStale';
  }
  return 'statusDraft';
};

export const TariffPlanPageV2: React.FC<Props> = ({
  onGoToAssetManagement,
  onGoToForecast,
  onGoToReports,
  onTariffPlanAccepted,
}) => {
  const { t } = useTranslation();
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [tariffPlan, setTariffPlan] = React.useState<V2TariffPlan | null>(null);
  const [baselineInput, setBaselineInput] = React.useState<V2TariffBaselineInput>({});
  const [allocationPolicy, setAllocationPolicy] =
    React.useState<V2TariffAllocationPolicy>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const feeLabels: Record<V2TariffFeeKey, string> = {
    connectionFee: t('v2TariffPlan.feeConnection', 'Connection fee'),
    baseFee: t('v2TariffPlan.feeBase', 'Base fee'),
    waterUsageFee: t('v2TariffPlan.feeWaterUsage', 'Water usage price'),
    wastewaterUsageFee: t('v2TariffPlan.feeWastewaterUsage', 'Wastewater usage price'),
  };

  const workflowPlan =
    planningContext?.vesinvest?.activePlan ??
    planningContext?.vesinvest?.selectedPlan ??
    null;
  const activePlanId = workflowPlan?.id ?? null;
  const activeScenarioId = workflowPlan?.selectedScenarioId ?? null;
  const hasUnsavedTariffEdits = React.useMemo(() => {
    if (!tariffPlan) {
      return false;
    }
    return (
      JSON.stringify(baselineInput) !== JSON.stringify(tariffPlan.baselineInput) ||
      JSON.stringify(allocationPolicy) !== JSON.stringify(tariffPlan.allocationPolicy)
    );
  }, [allocationPolicy, baselineInput, tariffPlan]);

  const loadTariffWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const context = await getPlanningContextV2();
      setPlanningContext(context);
      const plan =
        context.vesinvest?.activePlan ?? context.vesinvest?.selectedPlan ?? null;
      if (!plan?.id || !plan.selectedScenarioId) {
        setTariffPlan(null);
        setBaselineInput({});
        setAllocationPolicy({});
        return;
      }
      const loaded = await getTariffPlanV2(plan.id);
      setTariffPlan(loaded);
      setBaselineInput(loaded.baselineInput);
      setAllocationPolicy(loaded.allocationPolicy);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2TariffPlan.loadFailed', 'Failed to load tariff plan.'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    void loadTariffWorkspace();
  }, [loadTariffWorkspace]);

  const updateBaselineNumber = (field: keyof V2TariffBaselineInput, value: string) => {
    setBaselineInput((current) => ({
      ...current,
      [field]: parseInputNumber(value),
    }));
  };
  const updatePolicyNumber = (field: keyof V2TariffAllocationPolicy, value: string) => {
    setAllocationPolicy((current) => ({
      ...current,
      [field]: parseInputNumber(value),
    }));
  };
  const updateBaselineText = (field: keyof V2TariffBaselineInput, value: string) => {
    setBaselineInput((current) => ({
      ...current,
      [field]: value.trim().length > 0 ? value : null,
    }));
  };

  const saveTariffPlan = React.useCallback(async () => {
    if (!activePlanId) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await saveTariffPlanV2(activePlanId, {
        baselineInput,
        allocationPolicy,
      });
      setTariffPlan(saved);
      setBaselineInput(saved.baselineInput);
      setAllocationPolicy(saved.allocationPolicy);
      setInfo(t('v2TariffPlan.saved', 'Tariff plan saved.'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2TariffPlan.saveFailed', 'Failed to save tariff plan.'),
      );
    } finally {
      setBusy(false);
    }
  }, [activePlanId, allocationPolicy, baselineInput, t]);

  const acceptTariffPlan = React.useCallback(async () => {
    if (!activePlanId) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const saved = await saveTariffPlanV2(activePlanId, {
        baselineInput,
        allocationPolicy,
      });
      setTariffPlan(saved);
      setBaselineInput(saved.baselineInput);
      setAllocationPolicy(saved.allocationPolicy);
      const accepted = await acceptTariffPlanV2(activePlanId);
      setTariffPlan(accepted);
      setBaselineInput(accepted.baselineInput);
      setAllocationPolicy(accepted.allocationPolicy);
      onTariffPlanAccepted?.();
      setInfo(t('v2TariffPlan.accepted', 'Tariff plan accepted.'));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2TariffPlan.acceptFailed', 'Tariff plan is not ready.'),
      );
    } finally {
      setBusy(false);
    }
  }, [activePlanId, allocationPolicy, baselineInput, onTariffPlanAccepted, t]);

  const createReport = React.useCallback(async () => {
    if (!activePlanId || !activeScenarioId) {
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    if (hasUnsavedTariffEdits) {
      setBusy(false);
      setError(
        t(
          'v2TariffPlan.acceptVisibleBeforeReport',
          'Save and accept the visible tariff changes before creating a report.',
        ),
      );
      return;
    }
    try {
      await createReportV2({
        vesinvestPlanId: activePlanId,
        ennusteId: activeScenarioId,
        title: t('v2TariffPlan.reportTitle', '{{name}} tariff report', {
          name: workflowPlan?.name ?? 'Vesinvest',
        }),
      });
      onGoToReports();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Forecast.errorReportFailed', 'Failed to create report.'),
      );
    } finally {
      setBusy(false);
    }
  }, [activePlanId, activeScenarioId, hasUnsavedTariffEdits, onGoToReports, t, workflowPlan?.name]);

  const readinessRows = tariffPlan
    ? [
        {
          label: t('v2TariffPlan.readinessAssetPlan', '20-year asset plan'),
          ready: tariffPlan.readinessChecklist.assetPlan20YearPresent,
        },
        {
          label: t('v2TariffPlan.readinessBaseline', 'Trusted baseline'),
          ready: tariffPlan.readinessChecklist.trustedBaselinePresent,
        },
        {
          label: t('v2TariffPlan.readinessTariffBaseline', 'Current tariff baseline'),
          ready: tariffPlan.readinessChecklist.currentTariffBaselinePresent,
        },
        {
          label: t('v2TariffPlan.readinessInvestmentNeed', 'Investment and financing need'),
          ready: tariffPlan.readinessChecklist.investmentFinancingNeedPresent,
        },
        {
          label: t('v2TariffPlan.readinessRisk', 'Financial risk assessment'),
          ready: tariffPlan.readinessChecklist.riskAssessmentPresent,
        },
      ]
    : [];

  if (loading) {
    return <div className="v2-loading">{t('common.loading', 'Loading...')}</div>;
  }

  if (!activePlanId || !activeScenarioId) {
    return (
      <div className="v2-page">
        <section className="v2-card v2-vesinvest-panel">
          <div className="v2-section-header">
            <div>
              <h2>{t('v2Shell.tabs.tariffPlan', 'Tariff Plan')}</h2>
              <p className="v2-muted">
                {t(
                  'v2TariffPlan.scenarioRequired',
                  'Sync the asset-management plan to forecast before tariff planning.',
                )}
              </p>
            </div>
          </div>
          <div className="v2-actions-row">
            <button type="button" className="v2-btn v2-btn-primary" onClick={onGoToAssetManagement}>
              {t('v2Shell.tabs.assetManagement', 'Asset Management')}
            </button>
            {activeScenarioId ? (
              <button type="button" className="v2-btn" onClick={() => onGoToForecast(activeScenarioId)}>
                {t('v2Shell.tabs.forecast', 'Forecast')}
              </button>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      {info ? <div className="v2-alert v2-alert-info">{info}</div> : null}

      <section className="v2-card v2-vesinvest-panel">
        <div className="v2-section-header">
          <div>
            <h2>{t('v2Shell.tabs.tariffPlan', 'Tariff Plan')}</h2>
            <p className="v2-muted">
              {workflowPlan?.name ?? t('v2Vesinvest.title', 'Vesinvest workspace')}
            </p>
          </div>
          <span
            className={`v2-badge ${
              tariffPlan?.status === 'accepted'
                ? 'v2-status-positive'
                : 'v2-status-warning'
            }`}
          >
            {t(`v2TariffPlan.${getTariffStatusKey(tariffPlan?.status)}`)}
          </span>
        </div>

        <div className="v2-vesinvest-evidence-grid">
          <label className="v2-field">
            <span>{t('v2TariffPlan.connectionFeeAverage', 'Connection fee average')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.connectionFeeAverage)}
              onChange={(event) => updateBaselineNumber('connectionFeeAverage', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.connectionFeeRevenue', 'Connection fee revenue')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.connectionFeeRevenue)}
              onChange={(event) => updateBaselineNumber('connectionFeeRevenue', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.connectionFeeNewConnections', 'New connections')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.connectionFeeNewConnections)}
              onChange={(event) =>
                updateBaselineNumber('connectionFeeNewConnections', event.target.value)
              }
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.connectionFeeBasis', 'Connection fee basis')}</span>
            <input
              className="v2-input"
              value={baselineInput.connectionFeeBasis ?? ''}
              onChange={(event) => updateBaselineText('connectionFeeBasis', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.baseFeeRevenue', 'Base-fee revenue')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.baseFeeRevenue)}
              onChange={(event) => updateBaselineNumber('baseFeeRevenue', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.connectionCount', 'Connection count')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.connectionCount)}
              onChange={(event) => updateBaselineNumber('connectionCount', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.waterPrice', 'Water price')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.waterPrice)}
              onChange={(event) => updateBaselineNumber('waterPrice', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.wastewaterPrice', 'Wastewater price')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.wastewaterPrice)}
              onChange={(event) => updateBaselineNumber('wastewaterPrice', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.soldWaterVolume', 'Sold water volume')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.soldWaterVolume)}
              onChange={(event) => updateBaselineNumber('soldWaterVolume', event.target.value)}
            />
          </label>
          <label className="v2-field">
            <span>{t('v2TariffPlan.soldWastewaterVolume', 'Sold wastewater volume')}</span>
            <input
              className="v2-input"
              value={numberValue(baselineInput.soldWastewaterVolume)}
              onChange={(event) => updateBaselineNumber('soldWastewaterVolume', event.target.value)}
            />
          </label>
        </div>

        <div className="v2-vesinvest-evidence-grid">
          {FEE_KEYS.map((key) => (
            <label key={key} className="v2-field">
              <span>{feeLabels[key]} %</span>
              <input
                className="v2-input"
                value={numberValue(allocationPolicy[FEE_SHARE_FIELDS[key]] as number | null)}
                onChange={(event) =>
                  updatePolicyNumber(FEE_SHARE_FIELDS[key], event.target.value)
                }
              />
            </label>
          ))}
          <label className="v2-field">
            <span>{t('v2TariffPlan.smoothingYears', 'Smoothing years')}</span>
            <input
              className="v2-input"
              value={numberValue(allocationPolicy.smoothingYears)}
              onChange={(event) => updatePolicyNumber('smoothingYears', event.target.value)}
            />
          </label>
        </div>

        <label className="v2-field">
          <span>{t('v2TariffPlan.notes', 'Notes')}</span>
          <textarea
            className="v2-input"
            rows={2}
            value={baselineInput.notes ?? ''}
            onChange={(event) => updateBaselineText('notes', event.target.value)}
          />
        </label>

        <label className="v2-field">
          <span>{t('v2TariffPlan.financialRiskAssessment', 'Financial risk assessment')}</span>
          <textarea
            className="v2-input"
            rows={3}
            value={allocationPolicy.financialRiskAssessment ?? ''}
            onChange={(event) =>
              setAllocationPolicy((current) => ({
                ...current,
                financialRiskAssessment: event.target.value,
              }))
            }
          />
        </label>

        <div className="v2-actions-row">
          <label className="v2-checkbox-row">
            <input
              type="checkbox"
              checked={allocationPolicy.regionalVariationApplies === true}
              onChange={(event) =>
                setAllocationPolicy((current) => ({
                  ...current,
                  regionalVariationApplies: event.target.checked,
                }))
              }
            />
            <span>{t('v2TariffPlan.regionalVariationFlag', 'Regional variation flag')}</span>
          </label>
          <label className="v2-checkbox-row">
            <input
              type="checkbox"
              checked={allocationPolicy.stormwaterApplies === true}
              onChange={(event) =>
                setAllocationPolicy((current) => ({
                  ...current,
                  stormwaterApplies: event.target.checked,
                }))
              }
            />
            <span>{t('v2TariffPlan.stormwaterFlag', 'Stormwater flag')}</span>
          </label>
        </div>

        <div className="v2-actions-row">
          <button type="button" className="v2-btn v2-btn-primary" onClick={() => void saveTariffPlan()} disabled={busy}>
            {busy ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
          </button>
          <button type="button" className="v2-btn" onClick={() => void acceptTariffPlan()} disabled={busy || !tariffPlan}>
            {t('v2TariffPlan.accept', 'Accept tariff plan')}
          </button>
          <button type="button" className="v2-btn" onClick={() => void createReport()} disabled={busy || tariffPlan?.status !== 'accepted' || hasUnsavedTariffEdits}>
            {t('v2Reports.createReport', 'Create report')}
          </button>
        </div>
        {hasUnsavedTariffEdits && tariffPlan?.status === 'accepted' ? (
          <p className="v2-muted">
            {t(
              'v2TariffPlan.unsavedAcceptedHint',
              'Visible tariff changes must be accepted before they can be reported.',
            )}
          </p>
        ) : null}
      </section>

      {tariffPlan ? (
        <section className="v2-card v2-vesinvest-panel">
          <div className="v2-section-header">
            <div>
              <h3>{t('v2TariffPlan.recommendation', 'Recommendation')}</h3>
              <p className="v2-muted">
                {t('v2TariffPlan.updatedAt', 'Updated')}: {formatDateTime(tariffPlan.updatedAt)}
              </p>
            </div>
            <span className="v2-badge">
              {formatPercent(tariffPlan.recommendation.averageAnnualIncreasePct)}
            </span>
          </div>
          <div className="v2-keyvalue-list">
            <div className="v2-keyvalue-row">
              <span>{t('v2TariffPlan.targetRevenue', 'Target additional annual revenue')}</span>
              <span>{formatEur(tariffPlan.recommendation.targetAdditionalAnnualRevenue)}</span>
            </div>
            <div className="v2-keyvalue-row">
              <span>{t('v2TariffPlan.proposedRevenue', 'Proposed annual revenue')}</span>
              <span>{formatEur(tariffPlan.recommendation.proposedAnnualRevenue)}</span>
            </div>
          </div>
          <div className="v2-vesinvest-table-wrap">
            <table className="v2-vesinvest-table">
              <thead>
                <tr>
                  <th>{t('common.type', 'Type')}</th>
                  <th>{t('v2TariffPlan.current', 'Current')}</th>
                  <th>{t('v2TariffPlan.proposed', 'Proposed')}</th>
                  <th>{t('v2TariffPlan.impact', 'Impact')}</th>
                  <th>{t('v2TariffPlan.annualIncrease', 'Annual increase')}</th>
                </tr>
              </thead>
              <tbody>
                {FEE_KEYS.map((key) => {
                  const fee = tariffPlan.recommendation.fees[key];
                  return (
                    <tr key={key}>
                      <td>{feeLabels[key]}</td>
                      <td>{formatTariffUnit(key, fee.currentUnit)}</td>
                      <td>{formatTariffUnit(key, fee.proposedUnit)}</td>
                      <td>{formatEur(fee.revenueImpact)}</td>
                      <td>{formatPercent(fee.annualIncreasePct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="v2-vesinvest-evidence-grid">
            {readinessRows.map((row) => (
              <article key={row.label} className="v2-vesinvest-evidence-card">
                <h4>{row.label}</h4>
                <span className={`v2-badge ${row.ready ? 'v2-status-positive' : 'v2-status-warning'}`}>
                  {row.ready ? t('v2Overview.wizardSummaryYes', 'Yes') : t('v2Overview.wizardSummaryNo', 'No')}
                </span>
              </article>
            ))}
          </div>
          {tariffPlan.readinessChecklist.unresolvedManualAssumptions.length > 0 ? (
            <p className="v2-muted">
              {t('v2TariffPlan.unresolved', 'Unresolved')}: {tariffPlan.readinessChecklist.unresolvedManualAssumptions.join(', ')}
            </p>
          ) : null}
          <p className="v2-muted">
            {t('v2TariffPlan.smoothingStatus', '15% smoothing status')}: {tariffPlan.readinessChecklist.smoothingStatus}
          </p>
          <p className="v2-muted">
            {t('v2TariffPlan.volumeSummary', 'Volumes')}: {formatNumber((baselineInput.soldWaterVolume ?? 0) + (baselineInput.soldWastewaterVolume ?? 0))}
          </p>
        </section>
      ) : null}
    </div>
  );
};
