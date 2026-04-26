import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useForecastPageController } from './useForecastPageController';

const useForecastScenarioControllerMock = vi.fn();
const useForecastInvestmentControllerMock = vi.fn();

const buildBaselineYear = (overrides?: Record<string, unknown>) => ({
  year: 2024,
  soldWaterVolume: 1000,
  soldWastewaterVolume: 900,
  processElectricity: 12000,
  prices: {
    source: 'veeti',
    provenance: null,
  },
  volumes: {
    source: 'veeti',
    provenance: null,
  },
  financials: {
    source: 'veeti',
    provenance: null,
  },
  sourceStatus: 'VEETI',
  planningRole: 'historical',
  ...overrides,
});

const buildInvestmentSummary = (overrides?: Record<string, unknown>) => ({
  peakAnnualAmount: 0,
  peakYears: [],
  strongestFiveYearRange: null,
  strongestFiveYearTotal: 0,
  totalPlannedAmount: 0,
  ...overrides,
});

const buildScenario = (overrides?: Record<string, unknown>) => ({
  id: 'scenario-1',
  scenarioType: 'base',
  years: [{ year: 2024 }],
  investmentSeries: [],
  yearlyInvestments: [],
  computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
  baselineYear: 2024,
  feeSufficiency: {
    annualResult: {
      underfundingStartYear: null,
    },
    cumulativeCash: {
      peakGap: 0,
      underfundingStartYear: null,
    },
  },
  assumptions: {},
  nearTermExpenseAssumptions: [],
  ...overrides,
});

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

vi.mock('./useForecastScenarioController', () => ({
  useForecastScenarioController: (...args: unknown[]) =>
    useForecastScenarioControllerMock(...args),
}));

vi.mock('./useForecastInvestmentController', () => ({
  useForecastInvestmentController: (...args: unknown[]) =>
    useForecastInvestmentControllerMock(...args),
}));

const buildScenarioController = (overrides?: Record<string, unknown>) => ({
  activeWorkbench: 'overview',
  baseScenarioListItem: null,
  classAllocationDraftByYear: {},
  depreciationRuleDrafts: [],
  draftAssumptions: {},
  draftInvestments: [],
  draftName: '',
  draftNearTermExpenseAssumptions: [],
  draftScenarioType: 'base',
  forecastFreshnessState: 'current',
  hasBaselineBudget: true,
  hasUnsavedChanges: false,
  latestPricePoint: null,
  loadScenarioList: vi.fn(),
  loadingDepreciation: false,
  mapKnownForecastError: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : 'unknown',
  ),
  markScenarioAsNeedsRecompute: vi.fn(),
  nearTermExpenseDraftText: {},
  newScenarioName: '',
  newScenarioType: 'base',
  planningContext: {
    vesinvest: {
      activePlan: {
        id: 'plan-1',
        selectedScenarioId: 'scenario-1',
        classificationReviewRequired: false,
        assetEvidenceReady: true,
        tariffPlanStatus: 'accepted',
      },
    },
    baselineYears: [buildBaselineYear()],
  },
  primaryFeeSignal: {
    increase: 0,
    price: 0,
  },
  revenueAssumptionsChanged: false,
  savedClassAllocationDraftByYear: {},
  savedDepreciationRuleDrafts: [],
  scenario: buildScenario(),
  scenarios: [{ id: 'scenario-1', name: 'Base', scenarioType: 'base' }],
  selectedScenarioId: 'scenario-1',
  selectedScenarioListItem: { id: 'scenario-1', name: 'Base', scenarioType: 'base' },
  setActiveOperation: vi.fn(),
  setActivePrimaryChart: vi.fn(),
  setClassAllocationDraftByYear: vi.fn(),
  setDepreciationRuleDrafts: vi.fn(),
  setDraftAssumptions: vi.fn(),
  setDraftInvestments: vi.fn(),
  setDraftName: vi.fn(),
  setDraftNearTermExpenseAssumptions: vi.fn(),
  setDraftScenarioType: vi.fn(),
  setError: vi.fn(),
  setInfo: vi.fn(),
  setNearTermExpenseDraftText: vi.fn(),
  setNewScenarioName: vi.fn(),
  setSavedClassAllocationDraftByYear: vi.fn(),
  setSavedDepreciationRuleDrafts: vi.fn(),
  setScenario: vi.fn(),
  updateScenarioSummary: vi.fn(),
  ...overrides,
});

const buildInvestmentController = (overrides?: Record<string, unknown>) => ({
  averageNearTermExpense: {
    energyPct: 0,
    opexOtherPct: 0,
    personnelPct: 0,
  },
  firstNearTermExpense: {
    energyPct: 0,
    opexOtherPct: 0,
    personnelPct: 0,
  },
  hasNearTermValidationErrors: false,
  investmentSummary: {
    ...buildInvestmentSummary(),
  },
  nearTermInputValue: '',
  nearTermValidationErrors: {},
  plannedInvestmentYears: [],
  saveDrafts: vi.fn(),
  savedMappedInvestmentYearsCount: 0,
  ...overrides,
});

describe('useForecastPageController', () => {
  beforeEach(() => {
    useForecastScenarioControllerMock.mockReset();
    useForecastInvestmentControllerMock.mockReset();
    useForecastScenarioControllerMock.mockReturnValue(buildScenarioController());
    useForecastInvestmentControllerMock.mockReturnValue(buildInvestmentController());
  });

  it('switches the primary chart to cashflow when investments workbench is active', async () => {
    const setActivePrimaryChart = vi.fn();
    useForecastScenarioControllerMock.mockReturnValue(
      buildScenarioController({
        activeWorkbench: 'investments',
        setActivePrimaryChart,
      }),
    );

    renderHook(() =>
      useForecastPageController({
        onReportCreated: () => undefined,
      }),
    );

    await waitFor(() => {
      expect(setActivePrimaryChart).toHaveBeenCalledWith('cashflow');
    });
  });

  it('switches the primary chart to price when revenue workbench is active', async () => {
    const setActivePrimaryChart = vi.fn();
    useForecastScenarioControllerMock.mockReturnValue(
      buildScenarioController({
        activeWorkbench: 'revenue',
        setActivePrimaryChart,
      }),
    );

    renderHook(() =>
      useForecastPageController({
        onReportCreated: () => undefined,
      }),
    );

    await waitFor(() => {
      expect(setActivePrimaryChart).toHaveBeenCalledWith('price');
    });
  });

  it('blocks report creation when the active Vesinvest plan needs classification review', () => {
    useForecastScenarioControllerMock.mockReturnValue(
      buildScenarioController({
        planningContext: {
          baselineYears: [buildBaselineYear()],
          vesinvest: {
            activePlan: {
              id: 'plan-1',
              selectedScenarioId: 'scenario-1',
              classificationReviewRequired: true,
            },
          },
        },
      }),
    );

    const { result } = renderHook(() =>
      useForecastPageController({
        onReportCreated: () => undefined,
      }),
    );

    expect(result.current.canCreateReport).toBe(false);
    expect(result.current.reportReadinessReason).toBe(
      'classificationReviewRequired',
    );
  });

  it('blocks report creation when positive investments are missing depreciation snapshots', () => {
    useForecastScenarioControllerMock.mockReturnValue(
      buildScenarioController({
        scenario: {
          ...buildScenario(),
          yearlyInvestments: [
            {
              year: 2025,
              amount: 150000,
              depreciationRuleSnapshot: null,
            },
          ],
          computedFromUpdatedAt: '2026-04-16T10:00:00.000Z',
          baselineYear: 2024,
          assumptions: {},
          nearTermExpenseAssumptions: [],
        },
      }),
    );

    const { result } = renderHook(() =>
      useForecastPageController({
        onReportCreated: () => undefined,
      }),
    );

    expect(result.current.canCreateReport).toBe(false);
    expect(result.current.reportReadinessReason).toBe(
      'missingDepreciationSnapshots',
    );
  });

  it('reports the computed version for the active scenario', async () => {
    const onComputedVersionChange = vi.fn();

    renderHook(() =>
      useForecastPageController({
        onReportCreated: () => undefined,
        onComputedVersionChange,
      }),
    );

    await waitFor(() => {
      expect(onComputedVersionChange).toHaveBeenCalledWith(
        'scenario-1',
        '2026-04-16T10:00:00.000Z',
      );
    });
  });
});
