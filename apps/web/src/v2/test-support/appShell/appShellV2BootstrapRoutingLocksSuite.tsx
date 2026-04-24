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



export function registerAppShellV2BootstrapRoutingLocksSuite() {
  describe('AppShellV2 bootstrap and routing', () => {
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
    fireEvent.click(await screen.findByRole('button', { name: 'set-org-name' }));
    fireEvent.click(await screen.findByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(await screen.findByRole('button', { name: 'set-plan-verified' }));
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

  const clickOverviewButton = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name }));
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

  it('renders only the 5-tab navigation', () => {
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

    expect(screen.getByRole('button', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Asset Management' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Forecast' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tariff Plan' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reports' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('keeps shell chrome truthful when only token identity exists and no utility is selected yet', () => {
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

    expect(screen.getAllByText('Create Vesinvest plan').length).toBeGreaterThan(0);
    expect(screen.getByText('Plan status')).toBeTruthy();
    expect(screen.getByText('No utility selected')).toBeTruthy();
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.queryByText('Active workspace')).toBeNull();
    expect(screen.queryByText('C9032CDE')).toBeNull();
  });

  it('switches to reports after report generation callback', async () => {
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
    fireEvent.click(
      await screen.findByRole('button', { name: 'create-report' }),
    );

    expect(await screen.findByText('reports-content:report-123')).toBeTruthy();
  });

  it('redirects direct /reports entry back to overview with a visible locked-workspace notice when setup is still incomplete', async () => {
    window.history.replaceState({}, '', '/reports');

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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Reports');
    expect(screen.getByRole('status').textContent).toContain(
      'Complete the setup steps before opening this workspace.',
    );
    expect(
      within(screen.getByRole('status')).queryByRole('button', {
        name: 'Overview',
      }),
    ).toBeNull();
    expect(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'Close',
      }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('shows a report-stage blocker message instead of startup copy when direct /reports is blocked after forecast unlock', async () => {
    window.history.replaceState({}, '', '/reports');
    getImportStatusV2Mock.mockResolvedValue({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1535,
        nimi: 'Kronoby vatten och avlopp ab',
        ytunnus: '0180030-9',
        uiLanguage: 'sv',
      },
      years: [],
      availableYears: [],
      workspaceYears: [2024],
      excludedYears: [],
      planningBaselineYears: [2024],
    });
    getPlanningContextV2Mock.mockResolvedValue(
      buildPlanningContext({
        canCreateScenario: true,
        baselineYears: [
          {
            year: 2024,
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
        activePlan: {
          utilityName: 'Kronoby vatten och avlopp ab',
          businessId: '0180030-9',
          veetiId: 1535,
          identitySource: 'veeti',
          baselineStatus: 'verified',
          pricingStatus: 'provisional',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
      }),
    );
    getForecastScenarioV2Mock.mockResolvedValue(buildReadyScenario());

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

    expect(await screen.findByText('tariff-plan-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Accept the tariff plan before creating reports.',
    );
    fireEvent.click(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'Tariff Plan',
      }),
    );
    expect(await screen.findByText('tariff-plan-content')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/tariff-plan');
    });
  });

  it('keeps the locked Reports tab clickable so the later-stage blocker message is reachable from nav', async () => {
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

    await clickOverviewButton('set-org-name');
    await clickOverviewButton('unlock-forecast-only');
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(screen.getByRole('status').textContent).toContain(
      'Accept the tariff plan before creating reports.',
    );
    fireEvent.click(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'Tariff Plan',
      }),
    );
    expect(await screen.findByText('tariff-plan-content')).toBeTruthy();
  });

  it('does not show a redundant Overview recovery button when a locked Forecast route lands on Overview', async () => {
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

    await clickOverviewButton('set-org-name');
    await clickOverviewButton('lock-setup');
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));

    const blocker = screen.getByRole('status');
    expect(blocker.textContent).toContain(
      'Complete the setup steps before opening this workspace.',
    );
    expect(
      within(blocker).queryByRole('button', { name: 'Overview' }),
    ).toBeNull();
    expect(within(blocker).getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('shows the classification-review blocker when Reports is locked by class-plan work', async () => {
    window.history.replaceState({}, '', '/reports');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1535,
        nimi: 'Kronoby vatten och avlopp ab',
        ytunnus: '0180030-9',
        uiLanguage: 'sv',
      },
      years: [],
      availableYears: [],
      workspaceYears: [2024],
      excludedYears: [],
      planningBaselineYears: [2024],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        baselineYears: [
          {
            year: 2024,
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
        activePlan: {
          utilityName: 'Kronoby vatten och avlopp ab',
          businessId: '0180030-9',
          veetiId: 1535,
          identitySource: 'veeti',
          baselineStatus: 'verified',
          pricingStatus: 'blocked',
          classificationReviewRequired: true,
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
      }),
    );
    getForecastScenarioV2Mock.mockResolvedValueOnce(buildReadyScenario());

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

    expect(await screen.findByText('asset-management-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Review and save the Vesinvest class plan before creating a report.',
    );
    expect(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'Asset Management',
      }),
    ).toBeTruthy();
  });

  it('keeps the shell in workflow-step mode while Forecast is unlocked but Reports are still locked', async () => {
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

    await clickOverviewButton('set-org-name');
    await clickOverviewButton('unlock-forecast-only');

    expect(screen.getByText('Step 5 / 5')).toBeTruthy();
    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
  });

  it('redirects direct /forecast entry back to overview with a visible locked-workspace notice and keeps step-1 shell truth when no utility is connected', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: false,
      link: null,
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(buildPlanningContext());

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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Forecast');
    expect(screen.getByRole('status').textContent).toContain(
      'Complete the setup steps before opening this workspace.',
    );
    expect(
      within(screen.getByRole('status')).queryByRole('button', {
        name: 'Overview',
      }),
    ).toBeNull();
    expect(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'Close',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Step 1 / 5')).toBeTruthy();
    expect(screen.getByText('Create Vesinvest plan')).toBeTruthy();
    expect(screen.getByText('No utility selected')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('keeps direct /forecast entry on forecast when the saved active Vesinvest plan already carries utility identity', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: false,
      link: null,
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
      planningBaselineYears: [],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          utilityName: 'Kronoby vatten och avlopp ab',
          businessId: '0180030-9',
          veetiId: 1535,
          identitySource: 'veeti',
          baselineStatus: 'verified',
          pricingStatus: 'provisional',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
        baselineYears: [
          {
            year: 2024,
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
    getForecastScenarioV2Mock.mockResolvedValueOnce(buildReadyScenario());

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

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(screen.queryByText('Step 1 / 5')).toBeNull();
    expect(screen.queryByText('No utility selected')).toBeNull();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });
  });

  it('keeps direct /forecast entry on forecast when a saved Vesinvest plan has a verified baseline and linked scenario', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
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
      workspaceYears: [2023],
      excludedYears: [],
      planningBaselineYears: [2023],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          baselineStatus: 'verified',
          pricingStatus: 'provisional',
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
    listForecastScenariosV2Mock.mockResolvedValueOnce([
      {
        id: 'scenario-1',
        name: 'Existing scenario',
        onOletus: true,
        horizonYears: 20,
        baselineYear: 2023,
        talousarvioId: 'budget-2023',
        updatedAt: '2026-03-25T12:00:00.000Z',
        computedYears: 10,
      },
    ]);

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

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });
  });

  it('keeps direct /forecast entry on forecast when a saved Vesinvest plan has a verified baseline but no scenario yet', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
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
      workspaceYears: [2023],
      excludedYears: [],
      planningBaselineYears: [2023],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          baselineStatus: 'verified',
          pricingStatus: 'blocked',
          selectedScenarioId: null,
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

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });
  });

  });
}
