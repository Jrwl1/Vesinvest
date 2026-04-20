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
import { AppShellV2 } from '../AppShellV2';

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

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');
  return {
    ...actual,
    clearImportAndScenariosV2: clearImportAndScenariosV2Mock,
    getForecastScenarioV2: getForecastScenarioV2Mock,
    getImportStatusV2: getImportStatusV2Mock,
    getPlanningContextV2: getPlanningContextV2Mock,
    listForecastScenariosV2: listForecastScenariosV2Mock,
  };
});

vi.mock('../../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher">lang</div>,
}));

vi.mock('../OverviewPageV2', () => ({
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

vi.mock('../EnnustePageV2', () => ({
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

vi.mock('../ReportsPageV2', () => ({
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


export function registerAppShellV2BootstrapRoutingSuite() {
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

  it('applies the VEETI org default language during direct-route bootstrap when no manual override exists', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Wizard Utility',
        ytunnus: '1234567-8',
        uiLanguage: 'sv',
      },
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
      planningBaselineYears: [],
    });

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

    await waitFor(() => {
      expect(window.localStorage.getItem('va_language')).toBe('sv');
      expect(window.localStorage.getItem('va_language_source')).toBe(
        'org_default',
      );
    });
  });

  it('keeps a manual language override when VEETI org default language is available', async () => {
    window.history.replaceState({}, '', '/forecast');
    window.localStorage.setItem('va_language', 'en');
    window.localStorage.setItem('va_language_source', 'manual');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Wizard Utility',
        ytunnus: '1234567-8',
        uiLanguage: 'sv',
      },
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
      planningBaselineYears: [],
    });

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

    await waitFor(() => {
      expect(window.localStorage.getItem('va_language')).toBe('en');
      expect(window.localStorage.getItem('va_language_source')).toBe('manual');
    });
  });

  it('shows a neutral loading shell instead of a false setup-required state during direct-route bootstrap', () => {
    window.history.replaceState({}, '', '/reports');
    getImportStatusV2Mock.mockReturnValueOnce(new Promise(() => undefined));
    getPlanningContextV2Mock.mockReturnValueOnce(new Promise(() => undefined));

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

    expect(screen.getByText('Loading workspace')).toBeTruthy();
    expect(screen.getAllByText('Reports').length).toBeGreaterThan(0);
    expect(screen.queryByText('No utility selected')).toBeNull();
    expect(screen.queryByText('Setup required')).toBeNull();
    expect(screen.queryByText('reports-content:-')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Reports' }).className,
    ).not.toContain('active');
  });

  it('hydrates the saved fee-path shell state on the overview route before Overview reports it', async () => {
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
      workspaceYears: [2024],
      excludedYears: [],
      planningBaselineYears: [2024],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          status: 'active',
          baselineStatus: 'verified',
          pricingStatus: 'verified',
          selectedScenarioId: 'scenario-1',
        },
        baselineYears: [{ year: 2024 }],
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

    await waitFor(() => {
      expect(screen.getByText('Report-ready scenario')).toBeTruthy();
      expect(screen.getByText('Active workspace')).toBeTruthy();
      expect(
        (screen.getByRole('button', { name: 'Reports' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it('falls back to the forecast scenario list when direct scenario bootstrap fetch misses', async () => {
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
      workspaceYears: [2024],
      excludedYears: [],
      planningBaselineYears: [2024],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce(
      buildPlanningContext({
        canCreateScenario: true,
        activePlan: {
          status: 'active',
          baselineStatus: 'verified',
          pricingStatus: 'verified',
          selectedScenarioId: 'scenario-1',
        },
        baselineYears: [{ year: 2024 }],
      }),
    );
    getForecastScenarioV2Mock.mockRejectedValueOnce(new Error('miss'));
    listForecastScenariosV2Mock.mockResolvedValueOnce([
      {
        id: 'scenario-1',
        name: 'Saved fee path',
        updatedAt: '2026-03-25T12:00:00.000Z',
        computedFromUpdatedAt: '2026-03-25T12:00:00.000Z',
        computedYears: 1,
      } as any,
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

    await waitFor(() => {
      expect(screen.getByText('Report-ready scenario')).toBeTruthy();
    });
  });

  it('hydrates the selected utility and opens Forecast directly when a Vesinvest plan has a verified baseline and linked scenario', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Kronoby vatten och avlopp ab',
        ytunnus: '1234567-8',
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
        activePlan: {
          utilityName: 'Kronoby vatten och avlopp ab',
          baselineStatus: 'verified',
          pricingStatus: 'provisional',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
        baselineYears: [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
          financials: { dataType: 'tilinpaatos', source: 'manual' },
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

    const { container } = render(
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
    expect(screen.getByText('Kronoby vatten och avlopp ab')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    expect(screen.queryByText('No utility selected')).toBeNull();
    expect(screen.queryByText('Setup required')).toBeNull();
    expect(container.firstElementChild?.className).toContain(
      'v2-app-shell-forecast',
    );
  });

  it('hydrates the selected utility and opens Reports directly when a Vesinvest plan has a verified pricing path and linked scenario', async () => {
    window.history.replaceState({}, '', '/reports');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Kronoby vatten och avlopp ab',
        ytunnus: '1234567-8',
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
        activePlan: {
          utilityName: 'Kronoby vatten och avlopp ab',
          baselineStatus: 'verified',
          pricingStatus: 'verified',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
        baselineYears: [
        {
          year: 2024,
          quality: 'complete',
          sourceStatus: 'MIXED',
          sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
          financials: { dataType: 'tilinpaatos', source: 'manual' },
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

    const { container } = render(
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

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(screen.getByText('Kronoby vatten och avlopp ab')).toBeTruthy();
    expect(screen.getByText('Report-ready scenario')).toBeTruthy();
    expect(screen.queryByText('No utility selected')).toBeNull();
    expect(screen.queryByText('Setup required')).toBeNull();
    expect(container.firstElementChild?.className).toContain(
      'v2-app-shell-reports',
    );
  });

  it('hydrates report-ready shell truth on direct /reports entry when only selectedPlan is available during bootstrap', async () => {
    window.history.replaceState({}, '', '/reports');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Kronoby vatten och avlopp ab',
        ytunnus: '1234567-8',
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
        activePlan: null,
        selectedPlan: {
          id: 'plan-1',
          utilityName: 'Kronoby vatten och avlopp ab',
          baselineStatus: 'verified',
          pricingStatus: 'verified',
          selectedScenarioId: 'scenario-1',
          status: 'active',
        },
        baselineYears: [
          {
            year: 2024,
            quality: 'complete',
            sourceStatus: 'MIXED',
            sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
            financials: { dataType: 'tilinpaatos', source: 'manual' },
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

    const { container } = render(
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

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(screen.getByText('Kronoby vatten och avlopp ab')).toBeTruthy();
    expect(screen.getByText('Report-ready scenario')).toBeTruthy();
    expect(container.firstElementChild?.className).toContain(
      'v2-app-shell-reports',
    );
  });

  it('renders only the 3-tab navigation', () => {
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
    expect(screen.getByRole('button', { name: 'Forecast' })).toBeTruthy();
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
          pricingStatus: 'provisional',
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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Create the report after the fee path is saved and the linked scenario is up to date.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open fee path' }));
    expect(screen.getByText('overview-focus-target:plan-1')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
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

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-forecast-only' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(screen.getByRole('status').textContent).toContain(
      'Create the report after the fee path is saved and the linked scenario is up to date.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open Forecast' }));
    expect(screen.getByText('ennuste-content:-')).toBeTruthy();
    expect(window.location.pathname).toBe('/forecast');
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

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'lock-setup' }));
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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain(
      'Review and save the Vesinvest class plan before creating a report.',
    );
    expect(
      screen.getByRole('button', { name: 'Open fee path' }),
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

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-forecast-only' }));

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

  it('refreshes shell route locks after overview hands off to a newly linked forecast scenario', async () => {
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
          pricingStatus: 'verified',
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

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-forecast-only' }));
    expect(screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-linked-forecast' }));

    expect(await screen.findByText('ennuste-content:scenario-1')).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled'),
      ).toBeNull();
    });
  });

  it('keeps the linked forecast handoff stable when the shell truth refresh fails', async () => {
    getImportStatusV2Mock.mockRejectedValueOnce(new Error('refresh failed'));

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

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-forecast-only' }));
    expect(screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'open-linked-forecast' }));

    expect(await screen.findByText('ennuste-content:scenario-1')).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Reports' }).getAttribute('aria-disabled'),
      ).toBe('true');
    });
  });

  it('allows direct /forecast entry once the saved baseline is verified even without investment rows', async () => {
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
          projectCount: 0,
          totalInvestmentAmount: 0,
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

  it('returns stale report flow to Overview and stores a saved fee-path focus target', async () => {
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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByText('overview-focus-target:plan-1')).toBeTruthy();
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
    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'open-linked-forecast' }));

    expect(await screen.findByText('ennuste-content:scenario-1')).toBeTruthy();
    expect(screen.getByText('Report-ready scenario')).toBeTruthy();
  });

  });
}

export function registerAppShellV2SavedFeePathSuite() {
  describe('AppShellV2 saved fee path and setup truth', () => {
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

  it('clears the shell stale-report demotion when Overview reports the saved fee path as verified again', async () => {
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

    fireEvent.click(await screen.findByRole('button', { name: 'stale-report-hit' }));
    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(await screen.findByText('Vesinvest in progress')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'set-plan-verified' }));

    expect(await screen.findByText('Report-ready scenario')).toBeTruthy();
  });

  it('demotes the shell ready badge when the visible scenario drifts away from the linked saved fee path', async () => {
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
    expect(await screen.findByText('Report-ready scenario')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'select-stress' }));

    expect(await screen.findByText('Vesinvest in progress')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText('Report-ready scenario')).toBeNull();
    });
  });

  it('keeps the shell ready badge on Reports when a saved report focuses another scenario, then demotes after opening that scenario in Forecast', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));
    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(await screen.findByText('Report-ready scenario')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'focus-stress-report' }));

    expect(await screen.findByText('reports-content:report-123')).toBeTruthy();
    expect(await screen.findByText('Report-ready scenario')).toBeTruthy();
    expect(screen.queryByText('Vesinvest in progress')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'report-to-forecast' }));

    expect(await screen.findByText('ennuste-content:stress-1')).toBeTruthy();
    expect(await screen.findByText('Vesinvest in progress')).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText('Report-ready scenario')).toBeNull();
    });
  });

  it('demotes the shell ready badge when the saved fee path itself is stale', async () => {
    getPlanningContextV2Mock.mockResolvedValue(
      buildPlanningContext({
        canCreateScenario: true,
        baselineYears: [{ year: 2024 }],
        activePlan: {
          id: 'plan-1',
          utilityName: 'Wizard Utility',
          businessId: '1234567-8',
          pricingStatus: 'verified',
          baselineChangedSinceAcceptedRevision: true,
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
    expect(screen.getByText('Vesinvest in progress')).toBeTruthy();
    expect(screen.queryByText('Report-ready scenario')).toBeNull();
  });

  it('uses the active step from Overview when a problem year is selected', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'focus-problem-year' }));

    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Step 3 / 5')).toBeTruthy();
  });

  it('tracks the blocked-year branch steps reported by Overview through review, fix, baseline, and handoff', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'review-blocked-year' }));
    expect(screen.getByText('Vesinvest workflow')).toBeTruthy();
    expect(screen.getByText('Step 2 / 5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'focus-problem-year' }));
    expect(screen.getByText('Step 3 / 5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'review-ready' }));
    expect(screen.getByText('Step 4 / 5')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'set-org-name' }));
    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    expect(screen.getByText('Active workspace')).toBeTruthy();
    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.queryByText('Vesinvest workflow')).toBeNull();
    expect(screen.queryByText('Step 5 / 5')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to baseline' })).toBeNull();
  });

  it('unlocks forecast navigation when setup reports a completed planning baseline', async () => {
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
    expect(screen.getByRole('button', { name: 'Forecast' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
  });

  it('opens Forecast from the step-6 handoff without creating a scenario in Overview', async () => {
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
    fireEvent.click(
      screen.getByRole('button', { name: 'open-forecast-handoff' }),
    );

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
  });

  it('keeps forecast and reports locked before baseline, then allows the step-6 handoff to open unlocked workspaces', async () => {
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

    const forecastTab = screen.getByRole('button', { name: 'Forecast' });
    const reportsTab = screen.getByRole('button', { name: 'Reports' });

    fireEvent.click(screen.getByRole('button', { name: 'review-ready' }));

    expect(screen.getByText('Step 4 / 5')).toBeTruthy();
    expect(forecastTab.getAttribute('aria-disabled')).toBe('true');
    expect(reportsTab.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'open-forecast-handoff' }),
    );

    expect(screen.getByText('overview-content')).toBeTruthy();
    expect(screen.queryByText('ennuste-content:-')).toBeNull();
    expect(window.location.pathname).toBe('/');

    await unlockSetupThroughOverview();

    fireEvent.click(
      screen.getByRole('button', { name: 'open-forecast-handoff' }),
    );

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(window.location.pathname).toBe('/forecast');

    fireEvent.click(screen.getByRole('button', { name: 'Reports' }));

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(window.location.pathname).toBe('/reports');
  });

  it('keeps forecast and reports locked while a queued year review is still active', () => {
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

    const forecastTab = screen.getByRole('button', { name: 'Forecast' });
    const reportsTab = screen.getByRole('button', { name: 'Reports' });

    fireEvent.click(screen.getByRole('button', { name: 'focus-problem-year' }));

    expect(screen.getByText('Step 3 / 5')).toBeTruthy();
    expect(forecastTab.getAttribute('aria-disabled')).toBe('true');
    expect(reportsTab.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('overview-content')).toBeTruthy();

  });

  });
}

export function registerAppShellV2SmokeSuite() {
  describe('AppShellV2 smoke', () => {
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

  it('applies the VEETI org default language during direct-route bootstrap when no manual override exists', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: true,
      link: {
        connected: true,
        orgId: 'org-1',
        veetiId: 1,
        nimi: 'Wizard Utility',
        ytunnus: '1234567-8',
        uiLanguage: 'sv',
      },
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
      planningBaselineYears: [],
    });

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

    await waitFor(() => {
      expect(window.localStorage.getItem('va_language')).toBe('sv');
      expect(window.localStorage.getItem('va_language_source')).toBe(
        'org_default',
      );
    });
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

  it('unlocks forecast navigation when setup reports a completed planning baseline', async () => {
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
    expect(screen.getByRole('button', { name: 'Forecast' }).getAttribute('aria-disabled')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forecast' }));

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
  });

  });
}
