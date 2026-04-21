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


