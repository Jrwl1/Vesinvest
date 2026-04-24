import { api,invalidateCachedGets } from '../core';
import type {
  V2VesinvestBaselineSourceState,
  V2VesinvestGroupDefinition,
  V2VesinvestGroupUpdateInput,
  V2VesinvestPlan,
  V2VesinvestPlanCreateInput,
  V2VesinvestPlanInput,
  V2VesinvestPlanSummary,
  V2TariffPlan,
  V2TariffPlanInput,
} from './types';
export async function listVesinvestGroupsV2(): Promise<V2VesinvestGroupDefinition[]> {
  return api<V2VesinvestGroupDefinition[]>('/v2/vesinvest/groups');
}

export async function updateVesinvestGroupV2(
  key: string,
  body: V2VesinvestGroupUpdateInput,
): Promise<V2VesinvestGroupDefinition> {
  return api<V2VesinvestGroupDefinition>(
    `/v2/vesinvest/groups/${encodeURIComponent(key)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function listVesinvestPlansV2(): Promise<V2VesinvestPlanSummary[]> {
  return api<V2VesinvestPlanSummary[]>('/v2/vesinvest/plans');
}

export async function createVesinvestPlanV2(
  data: V2VesinvestPlanCreateInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>('/v2/vesinvest/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function getVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  return api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`);
}

export async function updateVesinvestPlanV2(
  id: string,
  data: V2VesinvestPlanInput,
): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function cloneVesinvestPlanV2(id: string): Promise<V2VesinvestPlan> {
  const result = await api<V2VesinvestPlan>(`/v2/vesinvest/plans/${id}/clone`, {
    method: 'POST',
  });
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function syncVesinvestPlanToForecastV2(
  id: string,
  data?: {
    compute?: boolean;
    baselineSourceState?: V2VesinvestBaselineSourceState | null;
  },
): Promise<{ plan: V2VesinvestPlan; scenarioId: string }> {
  const result = await api<{ plan: V2VesinvestPlan; scenarioId: string }>(
    `/v2/vesinvest/plans/${id}/forecast-sync`,
    {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    },
  );
  invalidateCachedGets('GET /v2/context', 'GET /v2/forecast/scenarios');
  return result;
}

export async function getTariffPlanV2(planId: string): Promise<V2TariffPlan> {
  return api<V2TariffPlan>(`/v2/vesinvest/plans/${planId}/tariff-plan`);
}

export async function saveTariffPlanV2(
  planId: string,
  data: V2TariffPlanInput,
): Promise<V2TariffPlan> {
  const result = await api<V2TariffPlan>(
    `/v2/vesinvest/plans/${planId}/tariff-plan`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  );
  invalidateCachedGets('GET /v2/context');
  return result;
}

export async function acceptTariffPlanV2(planId: string): Promise<V2TariffPlan> {
  const result = await api<V2TariffPlan>(
    `/v2/vesinvest/plans/${planId}/tariff-plan/accept`,
    {
      method: 'POST',
    },
  );
  invalidateCachedGets('GET /v2/context');
  return result;
}
