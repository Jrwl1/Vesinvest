import { api, getCachedGet, type GetRequestOptions } from '../core';
import type {
  V2DepreciationRule,
  V2EditableDepreciationRuleMethod,
  V2ForecastScenario,
  V2ForecastScenarioListItem,
  V2ForecastScenarioType,
  V2ScenarioClassAllocationYear,
  V2YearlyInvestmentPlanInput,
} from './types';
export async function listDepreciationRulesV2(): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>('/v2/forecast/depreciation-rules');
}

export async function listScenarioDepreciationRulesV2(
  scenarioId: string,
): Promise<V2DepreciationRule[]> {
  return api<V2DepreciationRule[]>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
  );
}

export async function createDepreciationRuleV2(data: {
  assetClassKey: string;
  assetClassName?: string;
  method: V2EditableDepreciationRuleMethod;
  linearYears?: number;
  residualPercent?: number;
}): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>('/v2/forecast/depreciation-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createScenarioDepreciationRuleV2(
  scenarioId: string,
  data: {
    assetClassKey: string;
    assetClassName?: string;
    method: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function updateDepreciationRuleV2(
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function updateScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
  data: {
    assetClassKey?: string;
    assetClassName?: string;
    method?: V2EditableDepreciationRuleMethod;
    linearYears?: number;
    residualPercent?: number;
  },
): Promise<V2DepreciationRule> {
  return api<V2DepreciationRule>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export async function deleteDepreciationRuleV2(
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/v2/forecast/depreciation-rules/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteScenarioDepreciationRuleV2(
  scenarioId: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(
    `/v2/forecast/scenarios/${scenarioId}/depreciation-rules/${id}`,
    {
      method: 'DELETE',
    },
  );
}

export async function getScenarioClassAllocationsV2(
  scenarioId: string,
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`);
}

export async function updateScenarioClassAllocationsV2(
  scenarioId: string,
  data: { years: V2ScenarioClassAllocationYear[] },
): Promise<{
  scenarioId: string;
  years: V2ScenarioClassAllocationYear[];
}> {
  return api(`/v2/forecast/scenarios/${scenarioId}/class-allocations`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function listForecastScenariosV2(
  options?: GetRequestOptions,
): Promise<V2ForecastScenarioListItem[]> {
  return getCachedGet(
    'GET /v2/forecast/scenarios',
    () => api<V2ForecastScenarioListItem[]>('/v2/forecast/scenarios'),
    options,
  );
}

export async function createForecastScenarioV2(data: {
  name?: string;
  talousarvioId?: string;
  horizonYears?: number;
  copyFromScenarioId?: string;
  scenarioType?: V2ForecastScenarioType;
  compute?: boolean;
}): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>('/v2/forecast/scenarios', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`);
}

export async function updateForecastScenarioV2(
  id: string,
  data: {
    name?: string;
    horizonYears?: number;
    scenarioType?: V2ForecastScenarioType;
    yearlyInvestments?: V2YearlyInvestmentPlanInput[];
    scenarioAssumptions?: Partial<
      Record<
        | 'inflaatio'
        | 'energiakerroin'
        | 'henkilostokerroin'
        | 'vesimaaran_muutos'
        | 'hintakorotus'
        | 'perusmaksuMuutos'
        | 'investointikerroin',
        number
      >
    >;
    nearTermExpenseAssumptions?: Array<{
      year: number;
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    }>;
    thereafterExpenseAssumptions?: {
      personnelPct?: number;
      energyPct?: number;
      opexOtherPct?: number;
    };
  },
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteForecastScenarioV2(id: string): Promise<void> {
  await api(`/v2/forecast/scenarios/${id}`, { method: 'DELETE' });
}

export async function computeForecastScenarioV2(
  id: string,
): Promise<V2ForecastScenario> {
  return api<V2ForecastScenario>(`/v2/forecast/scenarios/${id}/compute`, {
    method: 'POST',
  });
}
