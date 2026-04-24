import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  getImportStatusV2,
  getPlanningContextV2,
  type V2ImportStatus,
  type V2PlanningContextResponse,
} from '../api';
import { VesinvestPlanningPanel } from './VesinvestPlanningPanel';

type Props = {
  isAdmin: boolean;
  onGoToForecast: (scenarioId?: string | null) => void;
  onGoToTariffPlan: (scenarioId?: string | null) => void;
  onGoToReports: () => void;
  onWorkspaceChanged?: () => void;
};

export const AssetManagementPageV2: React.FC<Props> = ({
  isAdmin,
  onGoToForecast: _onGoToForecast,
  onGoToTariffPlan,
  onGoToReports,
  onWorkspaceChanged,
}) => {
  const { t } = useTranslation();
  const [planningContext, setPlanningContext] =
    React.useState<V2PlanningContextResponse | null>(null);
  const [importStatus, setImportStatus] =
    React.useState<V2ImportStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadWorkspace = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [context, status] = await Promise.all([
        getPlanningContextV2(),
        getImportStatusV2(),
      ]);
      setPlanningContext(context);
      setImportStatus(status);
      onWorkspaceChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('v2Vesinvest.errorLoad', 'Failed to load Vesinvest plans.'),
      );
    } finally {
      setLoading(false);
    }
  }, [onWorkspaceChanged, t]);

  React.useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  if (loading) {
    return <div className="v2-loading">{t('common.loading', 'Loading...')}</div>;
  }

  return (
    <div className="v2-page">
      {error ? <div className="v2-alert v2-alert-error">{error}</div> : null}
      <VesinvestPlanningPanel
        t={t}
        isAdmin={isAdmin}
        planningContext={planningContext}
        linkedOrg={importStatus?.link ?? null}
        onGoToForecast={onGoToTariffPlan}
        onGoToReports={onGoToReports}
        onPlansChanged={loadWorkspace}
      />
    </div>
  );
};
