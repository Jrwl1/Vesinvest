import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellV2 } from '../../AppShellV2';

const {
  clearImportAndScenariosV2Mock,
  getForecastScenarioV2Mock,
  getImportStatusV2Mock,
  getPlanningContextV2Mock,
  listForecastScenariosV2Mock,
} = vi.hoisted(() => ({
  clearImportAndScenariosV2Mock: vi.fn(),
  getForecastScenarioV2Mock: vi.fn(),
  getImportStatusV2Mock: vi.fn(),
  getPlanningContextV2Mock: vi.fn(),
  listForecastScenariosV2Mock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (
      key: string,
      defaultValue?: string,
      options?: Record<string, unknown>,
    ) => {
      let out = defaultValue ?? key;
      for (const [name, value] of Object.entries(options ?? {})) {
        out = out.split(`{{${name}}}`).join(String(value));
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../api')>('../../../api');
  return {
    ...actual,
    clearImportAndScenariosV2: clearImportAndScenariosV2Mock,
    getForecastScenarioV2: getForecastScenarioV2Mock,
    getImportStatusV2: getImportStatusV2Mock,
    getPlanningContextV2: getPlanningContextV2Mock,
    listForecastScenariosV2: listForecastScenariosV2Mock,
  };
});

vi.mock('../../../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher">lang</div>,
}));

vi.mock('../../OverviewPageV2', () => ({
  OverviewPageV2: (props: {
    onGoToForecast: (scenarioId?: string | null) => void;
    onGoToReports: () => void;
    overviewFocusTarget?: { kind: 'saved_fee_path'; planId: string } | null;
    onOverviewFocusTargetConsumed?: () => void;
    setupBackSignal?: number;
    onSetupWizardStateChange?: (state: {
      totalSteps: 6;
      currentStep: 1 | 2 | 3 | 4 | 5 | 6;
      recommendedStep: 1 | 2 | 3 | 4 | 5 | 6;
      activeStep: 1 | 2 | 3 | 4 | 5 | 6;
      selectedProblemYear: number | null;
      transitions: {
        reviewContinue: 4 | 5;
        selectProblemYear: 4;
      };
      wizardComplete: boolean;
      forecastUnlocked: boolean;
      reportsUnlocked: boolean;
      summary: {
        importedYearCount: number;
        readyYearCount: number;
        blockedYearCount: number;
        excludedYearCount: number;
        baselineReady: boolean;
      };
    }) => void;
    onSetupPlanStateChange?: (state: {
      activePlanId: string | null;
      linkedScenarioId: string | null;
      classificationReviewRequired: boolean;
      pricingStatus: 'blocked' | 'provisional' | 'verified' | null;
      tariffPlanStatus?: 'draft' | 'accepted' | 'stale' | null;
      baselineChangedSinceAcceptedRevision: boolean;
      investmentPlanChangedSinceFeeRecommendation: boolean;
    } | null) => void;
    onSetupOrgNameChange?: (name: string | null) => void;
  }) => {
    const handledBackSignal = React.useRef(0);

    React.useEffect(() => {
      if ((props.setupBackSignal ?? 0) <= handledBackSignal.current) {
        return;
      }
      handledBackSignal.current = props.setupBackSignal ?? 0;
      props.onSetupOrgNameChange?.(null);
      props.onSetupWizardStateChange?.({
        totalSteps: 6,
        currentStep: 1,
        recommendedStep: 1,
        activeStep: 1,
        selectedProblemYear: null,
        transitions: {
          reviewContinue: 5,
          selectProblemYear: 4,
        },
        wizardComplete: false,
        forecastUnlocked: false,
        reportsUnlocked: false,
        summary: {
          importedYearCount: 0,
          readyYearCount: 0,
          blockedYearCount: 0,
          excludedYearCount: 0,
          baselineReady: false,
        },
      });
    }, [
      props.onSetupOrgNameChange,
      props.onSetupWizardStateChange,
      props.setupBackSignal,
    ]);

    return (
      <div>
      <button type="button" onClick={() => props.onGoToForecast()}>
        overview-content
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 2,
            recommendedStep: 2,
            activeStep: 2,
            selectedProblemYear: null,
            transitions: {
              reviewContinue: 5,
              selectProblemYear: 4,
            },
            wizardComplete: false,
            forecastUnlocked: false,
            reportsUnlocked: false,
            summary: {
              importedYearCount: 0,
              readyYearCount: 0,
              blockedYearCount: 0,
              excludedYearCount: 0,
              baselineReady: false,
            },
          })
        }
      >
        lock-setup
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 4,
            recommendedStep: 4,
            activeStep: 4,
            selectedProblemYear: 2023,
            transitions: {
              reviewContinue: 4,
              selectProblemYear: 4,
            },
            wizardComplete: false,
            forecastUnlocked: false,
            reportsUnlocked: false,
            summary: {
              importedYearCount: 2,
              readyYearCount: 1,
              blockedYearCount: 1,
              excludedYearCount: 0,
              baselineReady: false,
            },
          })
        }
      >
        focus-problem-year
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 3,
            recommendedStep: 4,
            activeStep: 3,
            selectedProblemYear: null,
            transitions: {
              reviewContinue: 4,
              selectProblemYear: 4,
            },
            wizardComplete: false,
            forecastUnlocked: false,
            reportsUnlocked: false,
            summary: {
              importedYearCount: 2,
              readyYearCount: 1,
              blockedYearCount: 1,
              excludedYearCount: 0,
              baselineReady: false,
            },
          })
        }
      >
        review-blocked-year
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 5,
            recommendedStep: 5,
            activeStep: 5,
            selectedProblemYear: null,
            transitions: {
              reviewContinue: 5,
              selectProblemYear: 4,
            },
            wizardComplete: false,
            forecastUnlocked: false,
            reportsUnlocked: false,
            summary: {
              importedYearCount: 1,
              readyYearCount: 1,
              blockedYearCount: 0,
              excludedYearCount: 1,
              baselineReady: false,
            },
          })
        }
      >
        review-ready
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 6,
            recommendedStep: 6,
            activeStep: 6,
            selectedProblemYear: null,
            transitions: {
              reviewContinue: 5,
              selectProblemYear: 4,
            },
            wizardComplete: true,
            forecastUnlocked: true,
            reportsUnlocked: true,
            summary: {
              importedYearCount: 2,
              readyYearCount: 2,
              blockedYearCount: 0,
              excludedYearCount: 0,
              baselineReady: true,
            },
          })
        }
      >
        unlock-setup
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSetupWizardStateChange?.({
            totalSteps: 6,
            currentStep: 6,
            recommendedStep: 6,
            activeStep: 6,
            selectedProblemYear: null,
            transitions: {
              reviewContinue: 5,
              selectProblemYear: 4,
            },
            wizardComplete: false,
            forecastUnlocked: true,
            reportsUnlocked: false,
            summary: {
              importedYearCount: 2,
              readyYearCount: 2,
              blockedYearCount: 0,
              excludedYearCount: 0,
              baselineReady: true,
            },
          })
        }
      >
        unlock-forecast-only
      </button>
      <button type="button" onClick={() => props.onGoToForecast()}>
        open-forecast-handoff
      </button>
      <button type="button" onClick={() => props.onGoToForecast('scenario-1')}>
        open-linked-forecast
      </button>
      <button
        type="button"
        onClick={() => props.onSetupOrgNameChange?.('Wizard Utility')}
      >
        set-org-name
      </button>
        <button
          type="button"
          onClick={() =>
            props.onSetupPlanStateChange?.({
              activePlanId: 'plan-1',
              linkedScenarioId: 'scenario-1',
              classificationReviewRequired: false,
              pricingStatus: 'verified',
              tariffPlanStatus: 'accepted',
              baselineChangedSinceAcceptedRevision: false,
              investmentPlanChangedSinceFeeRecommendation: false,
            })
          }
        >
          set-plan-verified
        </button>
        <button
          type="button"
          onClick={() => props.onOverviewFocusTargetConsumed?.()}
        >
          consume-focus-target
        </button>
        <div>
          overview-focus-target:{props.overviewFocusTarget?.planId ?? '-'}
        </div>
        <div>setup-back-signal:{props.setupBackSignal ?? 0}</div>
      </div>
    );
  },
}));

vi.mock('../../AssetManagementPageV2', () => ({
  AssetManagementPageV2: ({ onGoToTariffPlan }: { onGoToTariffPlan?: (scenarioId?: string | null) => void }) => (
    <div>
      <div>asset-management-content</div>
      <button type="button" onClick={() => onGoToTariffPlan?.('scenario-1')}>
        asset-to-tariff-plan
      </button>
    </div>
  ),
}));

vi.mock('../../EnnustePageV2', () => ({
  EnnustePageV2: ({
    onReportCreated,
    initialScenarioId,
    onScenarioSelectionChange,
    onGoToOverviewFeePath,
    onComputedVersionChange,
  }: {
    onReportCreated: (id: string) => void;
    initialScenarioId?: string | null;
    onScenarioSelectionChange?: (scenarioId: string | null) => void;
    onGoToOverviewFeePath?: (planId?: string | null) => void;
    onComputedVersionChange?: (
      scenarioId: string,
      computedFromUpdatedAt: string | null,
    ) => void;
  }) => (
    <div>
      <div>ennuste-content:{initialScenarioId ?? '-'}</div>
      <button type="button" onClick={() => onScenarioSelectionChange?.('stress-1')}>
        select-stress
      </button>
      <button
        type="button"
        onClick={() =>
          onComputedVersionChange?.(initialScenarioId ?? 'scenario-1', '2026-03-25T12:00:00.000Z')
        }
      >
        compute-scenario
      </button>
      <button
        type="button"
        onClick={() => onGoToOverviewFeePath?.('plan-1')}
      >
        stale-report-hit
      </button>
      <button type="button" onClick={() => onReportCreated('report-123')}>
        create-report
      </button>
    </div>
  ),
}));

vi.mock('../../TariffPlanPageV2', () => ({
  TariffPlanPageV2: ({
    onTariffPlanAccepted,
    onGoToReports,
  }: {
    onTariffPlanAccepted?: () => void;
    onGoToReports: () => void;
  }) => (
    <div>
      <div>tariff-plan-content</div>
      <button type="button" onClick={() => onTariffPlanAccepted?.()}>
        accept-tariff-plan
      </button>
      <button type="button" onClick={() => onGoToReports()}>
        tariff-to-reports
      </button>
    </div>
  ),
}));

vi.mock('../../ReportsPageV2', () => ({
  ReportsPageV2: ({
    focusedReportId,
    onGoToForecast,
    onGoToOverviewFeePath,
    savedFeePathScenarioId,
    onFocusedReportChange,
  }: {
    refreshToken: number;
    focusedReportId: string | null;
    onGoToForecast: (scenarioId?: string | null) => void;
    onGoToOverviewFeePath?: (planId?: string | null) => void;
    savedFeePathScenarioId?: string | null;
    onFocusedReportChange?: (
      reportId: string | null,
      scenarioId: string | null,
    ) => void;
  }) => (
    <div>
      <div>reports-content:{focusedReportId ?? '-'}</div>
      <button
        type="button"
        onClick={() => onFocusedReportChange?.('report-123', 'stress-1')}
      >
        focus-stress-report
      </button>
      <button type="button" onClick={() => onGoToForecast('stress-1')}>
        report-to-forecast
      </button>
      <button type="button" onClick={() => onGoToOverviewFeePath?.('plan-1')}>
        report-to-fee-path
      </button>
      <div>report-saved-fee-path-scenario:{savedFeePathScenarioId ?? '-'}</div>
    </div>
  ),
}));



export function registerAppShellV2NavigationDrawerSuite() {
  describe('AppShellV2 navigation and drawer', () => {
  const buildActivePlan = (overrides?: Record<string, unknown>) => ({
    id: 'plan-1',
    name: 'Vesinvest plan',
    utilityName: 'Wizard Utility',
    businessId: '1234567-8',
    veetiId: null,
    identitySource: 'manual',
    horizonYears: 20,
    versionNumber: 1,
    status: 'draft',
    baselineStatus: 'draft',
    pricingStatus: 'blocked',
    tariffPlanStatus: null,
    selectedScenarioId: null,
    projectCount: 1,
    totalInvestmentAmount: 100000,
    lastReviewedAt: null,
    reviewDueAt: null,
    classificationReviewRequired: false,
    baselineChangedSinceAcceptedRevision: false,
    investmentPlanChangedSinceFeeRecommendation: false,
    updatedAt: '2026-03-25T12:00:00.000Z',
    createdAt: '2026-03-25T12:00:00.000Z',
    ...overrides,
  });

  const buildPlanningContext = (options?: {
    canCreateScenario?: boolean;
    baselineYears?: any[];
    activePlan?: Record<string, unknown> | null;
    selectedPlan?: Record<string, unknown> | null;
  }) => ({
    canCreateScenario: options?.canCreateScenario ?? false,
    vesinvest: {
      hasPlan:
        options?.activePlan != null || options?.selectedPlan != null,
      planCount:
        options?.activePlan != null || options?.selectedPlan != null ? 1 : 0,
      activePlan:
        options?.activePlan != null ? buildActivePlan(options.activePlan) : null,
      selectedPlan:
        options?.selectedPlan != null
          ? buildActivePlan(options.selectedPlan)
          : null,
    },
    baselineYears: options?.baselineYears ?? [],
    operations: {
      latestYear: options?.baselineYears?.[0]?.year ?? null,
      energySeries: [],
      networkRehabSeries: [],
      networkAssetsCount: 0,
      toimintakertomusCount: 0,
      toimintakertomusLatestYear: null,
      vedenottolupaCount: 0,
      activeVedenottolupaCount: 0,
    },
  });

  const buildReadyScenario = (overrides?: Record<string, unknown>) => ({
    id: 'scenario-1',
    updatedAt: '2026-03-25T12:00:00.000Z',
    computedFromUpdatedAt: '2026-03-25T12:00:00.000Z',
    years: [{ vuosi: 2024 }],
    yearlyInvestments: [],
    ...overrides,
  });

  const primeVerifiedBaselineImportStatus = () => {
    getImportStatusV2Mock.mockResolvedValue({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Wizard Utility',
        ytunnus: '1234567-8',
        uiLanguage: 'fi',
      },
      years: [],
      availableYears: [],
      workspaceYears: [2024],
      excludedYears: [],
      planningBaselineYears: [2024],
    });
  };

  const unlockSetupThroughOverview = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'set-plan-verified' }));
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Forecast' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      expect(
        (screen.getByRole('button', { name: 'Reports' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  };

  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearImportAndScenariosV2Mock.mockReset();
    getForecastScenarioV2Mock.mockReset();
    clearImportAndScenariosV2Mock.mockResolvedValue({
      deletedScenarios: 1,
      deletedVeetiBudgets: 1,
      deletedVeetiSnapshots: 1,
      deletedVeetiOverrides: 1,
      deletedVeetiYearPolicies: 1,
      deletedVesinvestPlanSeries: 1,
      deletedVeetiLinks: 1,
      status: { connected: false, link: null, years: [] },
    });
    getImportStatusV2Mock.mockResolvedValue({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Wizard Utility',
        ytunnus: '1234567-8',
        uiLanguage: 'fi',
      },
      years: [
        {
          vuosi: 2023,
          dataTypes: ['tilinpaatos'],
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
          },
        },
      ],
      availableYears: [
        {
          vuosi: 2023,
          dataTypes: ['tilinpaatos'],
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
          },
        },
      ],
      workspaceYears: [2023],
      excludedYears: [],
      planningBaselineYears: [],
    });
    getPlanningContextV2Mock.mockResolvedValue(buildPlanningContext());
    getForecastScenarioV2Mock.mockResolvedValue(buildReadyScenario());
    listForecastScenariosV2Mock.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('unlocks forecast and reports only when a saved Vesinvest plan has verified baseline, pricing, and a linked scenario', async () => {
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          baselineStatus: 'verified',
          pricingStatus: 'verified',
          tariffPlanStatus: 'accepted',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
        baselineYears: [
          {
            year: 2023,
            quality: 'complete',
            sourceStatus: 'VEETI',
            sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
            financials: { dataType: 'tilinpaatos', source: 'veeti' },
            prices: { dataType: 'taksa', source: 'veeti' },
            volumes: { dataType: 'volume_vesi', source: 'veeti' },
            investmentAmount: 0,
            soldWaterVolume: 0,
            soldWastewaterVolume: 0,
            combinedSoldVolume: 0,
            processElectricity: 0,
            pumpedWaterVolume: 0,
            waterBoughtVolume: 0,
            waterSoldVolume: 0,
            netWaterTradeVolume: 0,
          },
        ],
      }),
    );

    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    const forecastTab = screen.getByRole('button', { name: 'Forecast' });
    const reportsTab = screen.getByRole('button', { name: 'Reports' });

    await waitFor(() => {
      expect(forecastTab.getAttribute('aria-disabled')).toBeNull();
      expect(reportsTab.getAttribute('aria-disabled')).toBeNull();
    });

    fireEvent.click(forecastTab);

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
  });

  it('updates the URL when switching tabs', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    await unlockSetupThroughOverview();

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
    await waitFor(() => {
      expect(window.location.pathname).toBe('/reports');
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Overview' })[0]!);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Forecast' })[0]!);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });
  });

  it('keeps only the active workspace surface mounted while tab emphasis follows the active tab', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    const overviewTab = screen.getAllByRole('button', { name: 'Overview' })[0]!;
    const forecastTab = screen.getAllByRole('button', { name: 'Forecast' })[0]!;
    const reportsTab = screen.getAllByRole('button', { name: 'Reports' })[0]!;

    expect(overviewTab.className).toContain('active');
    expect(overviewTab.getAttribute('aria-current')).toBe('page');
    expect(forecastTab.className).not.toContain('active');
    expect(reportsTab.className).not.toContain('active');
    expect(screen.getByText('overview-content')).toBeTruthy();
    expect(screen.queryByText('ennuste-content:-')).toBeNull();
    expect(screen.queryByText('reports-content:-')).toBeNull();

    await unlockSetupThroughOverview();
    const unlockedReportsTab = screen.getAllByRole('button', { name: 'Reports' })[0]!;
    fireEvent.click(unlockedReportsTab);

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(screen.queryByText('overview-content')).toBeNull();
    expect(screen.queryByText('ennuste-content:-')).toBeNull();
    expect(overviewTab.className).not.toContain('active');
    expect(overviewTab.getAttribute('aria-current')).toBeNull();
    expect(unlockedReportsTab.className).toContain('active');
    expect(unlockedReportsTab.getAttribute('aria-current')).toBe('page');

    const unlockedForecastTab = screen.getAllByRole('button', { name: 'Forecast' })[0]!;
    fireEvent.click(unlockedForecastTab);

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(screen.queryByText('overview-content')).toBeNull();
    expect(screen.queryByText('reports-content:-')).toBeNull();
    expect(unlockedForecastTab.className).toContain('active');
    expect(unlockedForecastTab.getAttribute('aria-current')).toBe('page');
    expect(unlockedReportsTab.className).not.toContain('active');
    expect(unlockedReportsTab.getAttribute('aria-current')).toBeNull();
  });

  it('moves from the overview CTA to forecast and keeps the workspace indicator in sync', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Overview' }),
    ).toBeTruthy();
    expect(screen.getByText('overview-content')).toBeTruthy();

    await unlockSetupThroughOverview();
    fireEvent.click(screen.getByRole('button', { name: 'overview-content' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(screen.getAllByText('Forecast').length).toBeGreaterThan(0);
  });

  it('restores report-focused forecast context when returning from reports', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    await unlockSetupThroughOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));
    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'select-stress' }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem('v2_forecast_runtime_state')).toContain(
        '"selectedScenarioId":"stress-1"',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'create-report' }));
    expect(await screen.findByText('reports-content:report-123')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'focus-stress-report' }));
    fireEvent.click(screen.getByRole('button', { name: 'report-to-forecast' }));

    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });

    expect(await screen.findByText('ennuste-content:stress-1')).toBeTruthy();
  });

  it('rehydrates forecast runtime state from session storage on remount', async () => {
    window.sessionStorage.setItem(
      'v2_forecast_runtime_state',
      JSON.stringify({
        selectedScenarioId: 'stress-1',
      }),
    );

    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    await unlockSetupThroughOverview();
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));

    expect(await screen.findByText('ennuste-content:stress-1')).toBeTruthy();
  });

  it('opens and closes the account drawer with the new shell affordances', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'org-1',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(
      screen.getByRole('dialog', { name: 'Account and access' }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Account and access' }),
      ).toBeNull();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(
      screen.getByRole('dialog', { name: 'Account and access' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Account and access' }),
      ).toBeNull();
    });
  });

  it('requires a matching visible confirmation code before clear database is enabled', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    const clearButton = screen.getByRole('button', { name: 'Clear database' });
    const confirmationInput = screen.getByRole('textbox', {
      name: 'Confirmation code',
    });

    expect((clearButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(confirmationInput, { target: { value: 'wrong' } });
    expect((clearButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(confirmationInput, { target: { value: 'c9032cde' } });
    expect((clearButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(clearImportAndScenariosV2Mock).toHaveBeenCalledTimes(1);
    });
    expect(clearImportAndScenariosV2Mock).toHaveBeenCalledWith('c9032cde');
  });

  it('returns clear/reset to locked overview truth and drops stale forecast context', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Forecast' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'open-forecast-handoff' }),
    );

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Confirmation code' }), {
      target: { value: 'c9032cde' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Clear database' }));

    await waitFor(() => {
      expect(clearImportAndScenariosV2Mock).toHaveBeenCalledWith('c9032cde');
    });
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByText('Create Vesinvest plan')).toBeTruthy();
    expect(screen.getByText('No utility selected')).toBeTruthy();
    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Step 1 / 5')).toBeTruthy();
    expect(screen.queryByText('ennuste-content:starter-1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Forecast' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(
      window.sessionStorage.getItem('v2_forecast_runtime_state'),
    ).toContain('"selectedScenarioId":null');
  });

  it('renders the org chip as company only and keeps locked tabs marked locked', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'lock-setup' }));

    expect(screen.getByText('Wizard Utility')).toBeTruthy();
    expect(screen.queryByText('C9032CDE')).toBeNull();
    expect(screen.getByTitle('Wizard Utility / C9032CDE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forecast' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
  });

  it('keeps the full long workspace label available on the org chip', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Kronoby vatten och avlopp',
        ytunnus: '1234567-8',
        uiLanguage: 'fi',
      },
      years: [
        {
          vuosi: 2023,
          dataTypes: ['tilinpaatos'],
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
          },
        },
      ],
      availableYears: [
        {
          vuosi: 2023,
          dataTypes: ['tilinpaatos'],
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
          },
        },
      ],
      workspaceYears: [2023],
      excludedYears: [],
    });

    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    expect(
      await screen.findByTitle('Kronoby vatten och avlopp / C9032CDE'),
    ).toBeTruthy();
  });

  it('shows the setup step indicator when wizard state is reported from Overview', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'lock-setup' }));

    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Step 2 / 5')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Back to utility identity' }),
    ).toBeTruthy();
  });

  it('keeps the shell back-step control keyboard-focusable while setup is in step 2', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'lock-setup' }));

    const backButton = await screen.findByRole('button', {
      name: 'Back to utility identity',
    });
    backButton.focus();
    expect(document.activeElement).toBe(backButton);

    fireEvent.click(backButton);

    expect(await screen.findByText('setup-back-signal:1')).toBeTruthy();
  });

  it('clears the shell org identity when back-navigation returns setup to step 1', async () => {
    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'lock-setup' }));
    expect(screen.getByTitle('Wizard Utility / C9032CDE')).toBeTruthy();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Back to utility identity' }),
    );

    expect(await screen.findByText('setup-back-signal:1')).toBeTruthy();
    expect(screen.queryByTitle('Wizard Utility / C9032CDE')).toBeNull();
    expect(screen.getByTitle('No utility selected')).toBeTruthy();
    expect(screen.getByText('Step 1 / 5')).toBeTruthy();
  });

  it('returns stale report flow to Tariff Plan and stores a saved fee-path conflict', async () => {
    primeVerifiedBaselineImportStatus();
    getPlanningContextV2Mock.mockResolvedValue(
      buildPlanningContext({
        canCreateScenario: true,
        baselineYears: [{ year: 2024 }],
        activePlan: {
          id: 'plan-1',
          utilityName: 'Wizard Utility',
          businessId: '1234567-8',
          pricingStatus: 'verified',
          tariffPlanStatus: 'accepted',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
      }),
    );

    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-linked-forecast' }));
    expect(await screen.findByText('ennuste-content:scenario-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'stale-report-hit' }));

    expect(await screen.findByText('tariff-plan-content')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    expect(screen.queryByText('Report-ready scenario')).toBeNull();
    expect(
      window.sessionStorage.getItem('v2_forecast_runtime_state'),
    ).toContain('"selectedScenarioId":"scenario-1"');
  });

  it('clears the shell stale-report demotion once the same saved fee path is opened cleanly again', async () => {
    primeVerifiedBaselineImportStatus();
    getPlanningContextV2Mock.mockResolvedValue(
      buildPlanningContext({
        canCreateScenario: true,
        baselineYears: [{ year: 2024 }],
        activePlan: {
          id: 'plan-1',
          utilityName: 'Wizard Utility',
          businessId: '1234567-8',
          pricingStatus: 'verified',
          tariffPlanStatus: 'accepted',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
      }),
    );

    render(
      <AppShellV2
        tokenInfo={{
          sub: 'u1',
          org_id: 'c9032cde-4074-4df0-9f05-c723d22a9af0',
          roles: ['ADMIN'],
          iat: 1,
          exp: 9999999999,
        }}
        isDemoMode={false}
        onLogout={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'open-linked-forecast' }));
    expect(await screen.findByText('ennuste-content:scenario-1')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'stale-report-hit' }));
    expect(await screen.findByText('tariff-plan-content')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'accept-tariff-plan' }));

    expect(await screen.findByText('Report-ready scenario')).toBeTruthy();
  });

  });
}
