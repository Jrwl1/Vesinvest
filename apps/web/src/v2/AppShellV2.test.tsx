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

const { clearImportAndScenariosV2Mock } = vi.hoisted(() => ({
  clearImportAndScenariosV2Mock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    clearImportAndScenariosV2: clearImportAndScenariosV2Mock,
  };
});

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher">lang</div>,
}));

vi.mock('./OverviewPageV2', () => ({
  OverviewPageV2: (props: {
    onGoToForecast: () => void;
    onGoToReports: () => void;
  }) => (
    <button type="button" onClick={props.onGoToForecast}>
      overview-content
    </button>
  ),
}));

vi.mock('./EnnustePageV2', () => ({
  EnnustePageV2: ({
    onReportCreated,
  }: {
    onReportCreated: (id: string) => void;
  }) => (
    <button type="button" onClick={() => onReportCreated('report-123')}>
      ennuste-content
    </button>
  ),
}));

vi.mock('./ReportsPageV2', () => ({
  ReportsPageV2: ({
    focusedReportId,
  }: {
    refreshToken: number;
    focusedReportId: string | null;
    onGoToForecast: () => void;
  }) => <div>reports-content:{focusedReportId ?? '-'}</div>,
}));

describe('AppShellV2', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
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
  });

  afterEach(() => {
    cleanup();
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
    expect(screen.getByRole('button', { name: 'Ennuste' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reports' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Ennuste' })[0]!);
    fireEvent.click(
      await screen.findByRole('button', { name: 'ennuste-content' }),
    );

    expect(await screen.findByText('reports-content:report-123')).toBeTruthy();
  });

  it('renders reports tab content when opened on /reports', async () => {
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

    expect(await screen.findByText('reports-content:-')).toBeTruthy();
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

    fireEvent.click(screen.getAllByRole('button', { name: 'Ennuste' })[0]!);
    await waitFor(() => {
      expect(window.location.pathname).toBe('/forecast');
    });
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

    expect(await screen.findByRole('button', { name: 'ennuste-content' })).toBeTruthy();
    expect(screen.getAllByText('Ennuste').length).toBeGreaterThan(0);
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
});
