import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppShellV2 } from './AppShellV2';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher">lang</div>,
}));

vi.mock('./OverviewPageV2', () => ({
  OverviewPageV2: ({ onGoToForecast }: { onGoToForecast: () => void }) => (
    <button type="button" onClick={onGoToForecast}>
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

  it('switches to reports after report generation callback', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'ennuste-content' }));

    expect(screen.getByText('reports-content:report-123')).toBeTruthy();
  });
});
