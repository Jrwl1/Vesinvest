import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useForecastScenarioController } from './useForecastScenarioController';

const {
  getForecastScenarioV2Mock,
  getPlanningContextV2Mock,
  listForecastScenariosV2Mock,
} = vi.hoisted(() => ({
  getForecastScenarioV2Mock: vi.fn(),
  getPlanningContextV2Mock: vi.fn(),
  listForecastScenariosV2Mock: vi.fn(),
}));

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    getForecastScenarioV2: getForecastScenarioV2Mock,
    getPlanningContextV2: getPlanningContextV2Mock,
    listForecastScenariosV2: listForecastScenariosV2Mock,
  };
});

describe('useForecastScenarioController', () => {
  const t = ((key: string, defaultValue?: string) => defaultValue ?? key) as any;

  beforeEach(() => {
    getForecastScenarioV2Mock.mockReset();
    getPlanningContextV2Mock.mockReset();
    listForecastScenariosV2Mock.mockReset();
    getPlanningContextV2Mock.mockResolvedValue({
      canCreateScenario: false,
      baselineYears: [],
      vesinvest: null,
      operations: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not bounce back to an initial scenario id that is missing from the loaded list', async () => {
    listForecastScenariosV2Mock
      .mockResolvedValueOnce([
        {
          id: 'scenario-1',
          name: 'Base',
          onOletus: true,
          scenarioType: 'base',
          updatedAt: '2026-04-16T10:00:00.000Z',
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          computedYears: 21,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'scenario-1',
          name: 'Base',
          onOletus: true,
          scenarioType: 'base',
          updatedAt: '2026-04-16T10:00:00.000Z',
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          computedYears: 21,
        },
        {
          id: 'scenario-2',
          name: 'Synced',
          onOletus: false,
          scenarioType: 'hypothesis',
          updatedAt: '2026-04-16T10:00:00.000Z',
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          computedYears: 21,
        },
      ])
      .mockResolvedValue([
        {
          id: 'scenario-1',
          name: 'Base',
          onOletus: true,
          scenarioType: 'base',
          updatedAt: '2026-04-16T10:00:00.000Z',
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          computedYears: 21,
        },
        {
          id: 'scenario-2',
          name: 'Synced',
          onOletus: false,
          scenarioType: 'hypothesis',
          updatedAt: '2026-04-16T10:00:00.000Z',
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          computedYears: 21,
        },
      ]);
    getForecastScenarioV2Mock.mockImplementation(async (scenarioId: string) => ({
      id: scenarioId,
      name: scenarioId === 'scenario-2' ? 'Synced' : 'Base',
      scenarioType: scenarioId === 'scenario-2' ? 'hypothesis' : 'base',
      updatedAt: '2026-04-16T10:00:00.000Z',
      computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
      priceSeries: [],
      cashflowSeries: [],
      years: [{ vuosi: 2022 }],
      yearlyInvestments: [],
      assumptions: {},
      nearTermExpenseAssumptions: [],
    }));

    const { result } = renderHook(() =>
      useForecastScenarioController({
        t,
        depreciationFeatureEnabled: false,
        initialScenarioId: 'scenario-2',
      }),
    );

    await waitFor(() => {
      expect(result.current.selectedScenarioId).toBe('scenario-2');
    });

    expect(listForecastScenariosV2Mock.mock.calls.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => {
      expect(getForecastScenarioV2Mock).toHaveBeenCalledWith('scenario-2');
    });
  });
});
