import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShellV2 } from './AppShellV2';

const {
  clearImportAndScenariosV2Mock,
  getImportStatusV2Mock,
  getPlanningContextV2Mock,
} = vi.hoisted(() => ({
  clearImportAndScenariosV2Mock: vi.fn(),
  getImportStatusV2Mock: vi.fn(),
  getPlanningContextV2Mock: vi.fn(),
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

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    clearImportAndScenariosV2: clearImportAndScenariosV2Mock,
    getImportStatusV2: getImportStatusV2Mock,
    getPlanningContextV2: getPlanningContextV2Mock,
  };
});

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher">lang</div>,
}));

vi.mock('./OverviewPageV2', () => ({
  OverviewPageV2: (props: {
    onGoToForecast: (scenarioId?: string | null) => void;
    onGoToReports: () => void;
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
    onSetupOrgNameChange?: (name: string | null) => void;
  }) => (
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
      <button type="button" onClick={() => props.onGoToForecast()}>
        open-forecast-handoff
      </button>
      <button
        type="button"
        onClick={() => props.onSetupOrgNameChange?.('Wizard Utility')}
      >
        set-org-name
      </button>
    </div>
  ),
}));

vi.mock('./EnnustePageV2', () => ({
  EnnustePageV2: ({
    onReportCreated,
    initialScenarioId,
    computedFromUpdatedAtByScenario,
    onScenarioSelectionChange,
    onComputedVersionChange,
  }: {
    onReportCreated: (id: string) => void;
    initialScenarioId?: string | null;
    computedFromUpdatedAtByScenario?: Record<string, string>;
    onScenarioSelectionChange?: (scenarioId: string | null) => void;
    onComputedVersionChange?: (
      scenarioId: string,
      computedFromUpdatedAt: string | null,
    ) => void;
  }) => (
    <div>
      <div>ennuste-content:{initialScenarioId ?? '-'}</div>
      <div>
        compute-token:
        {initialScenarioId
          ? computedFromUpdatedAtByScenario?.[initialScenarioId] ?? '-'
          : '-'}
      </div>
      <button type="button" onClick={() => onScenarioSelectionChange?.('stress-1')}>
        select-stress
      </button>
      <button
        type="button"
        onClick={() => onComputedVersionChange?.('stress-1', 'stamp-1')}
      >
        set-computed
      </button>
      <button type="button" onClick={() => onReportCreated('report-123')}>
        create-report
      </button>
    </div>
  ),
}));

vi.mock('./ReportsPageV2', () => ({
  ReportsPageV2: ({
    focusedReportId,
    onGoToForecast,
    onFocusedReportChange,
  }: {
    refreshToken: number;
    focusedReportId: string | null;
    onGoToForecast: (scenarioId?: string | null) => void;
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
    </div>
  ),
}));

describe('AppShellV2', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearImportAndScenariosV2Mock.mockReset();
    clearImportAndScenariosV2Mock.mockResolvedValue({
      deletedScenarios: 1,
      deletedVeetiBudgets: 1,
      deletedVeetiSnapshots: 1,
      deletedVeetiOverrides: 1,
      deletedVeetiYearPolicies: 1,
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
    });
    getPlanningContextV2Mock.mockResolvedValue({
      canCreateScenario: false,
      baselineYears: [],
      operations: {
        latestYear: null,
        energySeries: [],
        networkRehabSeries: [],
        networkAssetsCount: 0,
        toimintakertomusCount: 0,
        toimintakertomusLatestYear: null,
        vedenottolupaCount: 0,
        activeVedenottolupaCount: 0,
      },
    });
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

    expect(screen.getByText('Setup required')).toBeTruthy();
    expect(screen.getByText('Setup status')).toBeTruthy();
    expect(screen.getByText('Select utility')).toBeTruthy();
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Forecast' })[0]!);
    fireEvent.click(
      await screen.findByRole('button', { name: 'create-report' }),
    );

    expect(await screen.findByText('reports-content:report-123')).toBeTruthy();
  });

  it('redirects direct /reports entry back to overview when setup is still incomplete', async () => {
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
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });

  it('redirects direct /forecast entry back to overview and keeps step-1 shell truth when no utility is connected', async () => {
    window.history.replaceState({}, '', '/forecast');
    getImportStatusV2Mock.mockResolvedValueOnce({
      connected: false,
      link: null,
      years: [],
      availableYears: [],
      workspaceYears: [],
      excludedYears: [],
    });
    getPlanningContextV2Mock.mockResolvedValueOnce({
      canCreateScenario: false,
      baselineYears: [],
      operations: {
        latestYear: null,
        energySeries: [],
        networkRehabSeries: [],
        networkAssetsCount: 0,
        toimintakertomusCount: 0,
        toimintakertomusLatestYear: null,
        vedenottolupaCount: 0,
        activeVedenottolupaCount: 0,
      },
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

    expect(await screen.findByText('overview-content')).toBeTruthy();
    expect(screen.getByText('Guided setup')).toBeTruthy();
    expect(screen.getByText('Step 1 / 6')).toBeTruthy();
    expect(screen.getByText('Setup required')).toBeTruthy();
    expect(screen.getByText('No utility selected')).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Reports' })[0]!);
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

    fireEvent.click(reportsTab);

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
    expect(screen.queryByText('overview-content')).toBeNull();
    expect(screen.queryByText('ennuste-content:-')).toBeNull();
    expect(overviewTab.className).not.toContain('active');
    expect(overviewTab.getAttribute('aria-current')).toBeNull();
    expect(reportsTab.className).toContain('active');
    expect(reportsTab.getAttribute('aria-current')).toBe('page');

    fireEvent.click(forecastTab);

    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();
    expect(screen.queryByText('overview-content')).toBeNull();
    expect(screen.queryByText('reports-content:-')).toBeNull();
    expect(forecastTab.className).toContain('active');
    expect(forecastTab.getAttribute('aria-current')).toBe('page');
    expect(reportsTab.className).not.toContain('active');
    expect(reportsTab.getAttribute('aria-current')).toBeNull();
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Forecast' })[0]!);
    expect(await screen.findByText('ennuste-content:-')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'select-stress' }));
    fireEvent.click(screen.getByRole('button', { name: 'set-computed' }));

    await waitFor(() => {
      expect(window.sessionStorage.getItem('v2_forecast_runtime_state')).toContain(
        '"selectedScenarioId":"stress-1"',
      );
      expect(window.sessionStorage.getItem('v2_forecast_runtime_state')).toContain(
        '"stress-1":"stamp-1"',
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
    expect(screen.getByText('compute-token:stamp-1')).toBeTruthy();
  });

  it('rehydrates forecast runtime state from session storage on remount', async () => {
    window.sessionStorage.setItem(
      'v2_forecast_runtime_state',
      JSON.stringify({
        selectedScenarioId: 'stress-1',
        computedFromUpdatedAtByScenario: { 'stress-1': 'stamp-1' },
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Forecast' })[0]!);

    expect(await screen.findByText('ennuste-content:stress-1')).toBeTruthy();
    expect(screen.getByText('compute-token:stamp-1')).toBeTruthy();
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
    expect(screen.getByText('Setup required')).toBeTruthy();
    expect(screen.getByText('No utility selected')).toBeTruthy();
    expect(screen.getByText('Guided setup')).toBeTruthy();
    expect(screen.getByText('Step 1 / 6')).toBeTruthy();
    expect(screen.queryByText('ennuste-content:starter-1')).toBeNull();
    expect(
      (
        screen.getByRole('button', { name: 'Forecast' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', { name: 'Reports' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      window.sessionStorage.getItem('v2_forecast_runtime_state'),
    ).toContain('"selectedScenarioId":null');
  });

  it('formats the org chip as company plus short hash and keeps locked tabs disabled', async () => {
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

    expect(screen.getByText('Wizard Utility / C9032CDE')).toBeTruthy();
    expect(
      (
        screen.getByRole('button', { name: 'Forecast' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', { name: 'Reports' }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText('Setup in progress')).toBeTruthy();
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

    expect(screen.getByText('Guided setup')).toBeTruthy();
    expect(screen.getByText('Step 2 / 6')).toBeTruthy();
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

    expect(screen.getByText('Guided setup')).toBeTruthy();
    expect(screen.getByText('Step 4 / 6')).toBeTruthy();
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
    expect(screen.getByText('Guided setup')).toBeTruthy();
    expect(screen.getByText('Step 3 / 6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'focus-problem-year' }));
    expect(screen.getByText('Step 4 / 6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'review-ready' }));
    expect(screen.getByText('Step 5 / 6')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));
    expect(screen.getByText('Step 6 / 6')).toBeTruthy();
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
    expect(
      (screen.getByRole('button', { name: 'Forecast' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

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

    expect(screen.getByText('Step 5 / 6')).toBeTruthy();
    expect((forecastTab as HTMLButtonElement).disabled).toBe(true);
    expect((reportsTab as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(
      screen.getByRole('button', { name: 'open-forecast-handoff' }),
    );

    expect(screen.getByText('overview-content')).toBeTruthy();
    expect(screen.queryByText('ennuste-content:-')).toBeNull();
    expect(window.location.pathname).toBe('/');

    fireEvent.click(screen.getByRole('button', { name: 'unlock-setup' }));

    expect(screen.getByText('Step 6 / 6')).toBeTruthy();
    expect((forecastTab as HTMLButtonElement).disabled).toBe(false);
    expect((reportsTab as HTMLButtonElement).disabled).toBe(false);

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

    expect(screen.getByText('Step 4 / 6')).toBeTruthy();
    expect((forecastTab as HTMLButtonElement).disabled).toBe(true);
    expect((reportsTab as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('overview-content')).toBeTruthy();
  });
});
