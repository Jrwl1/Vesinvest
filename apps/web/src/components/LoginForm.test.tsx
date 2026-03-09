import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

const apiMocks = vi.hoisted(() => ({
  demoLogin: vi.fn(),
  getApiBaseUrl: vi.fn(() => 'http://localhost:3000/api'),
  login: vi.fn(),
  resetDemoData: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
  }),
}));

vi.mock('../api', () => ({
  demoLogin: apiMocks.demoLogin,
  getApiBaseUrl: apiMocks.getApiBaseUrl,
  login: apiMocks.login,
  resetDemoData: apiMocks.resetDemoData,
}));

describe('LoginForm demo entry states', () => {
  beforeEach(() => {
    apiMocks.demoLogin.mockReset();
    apiMocks.getApiBaseUrl.mockReturnValue('http://localhost:3000/api');
    apiMocks.login.mockReset();
    apiMocks.resetDemoData.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows explicit unavailable messaging when demo sign-in is off', () => {
    render(
      <LoginForm
        onSuccess={() => undefined}
        demoState="unavailable"
      />,
    );

    expect(screen.getByText((_, element) => element?.textContent === 'Demo sign-in:')).toBeTruthy();
    expect(screen.getByText('Unavailable')).toBeTruthy();
    expect(
      screen.getByText('This environment requires a normal account sign-in.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('demo-login-btn')).toBeNull();
  });

  it('keeps the demo button visible but disabled while availability is loading', () => {
    render(
      <LoginForm
        onSuccess={() => undefined}
        demoState="loading"
      />,
    );

    const demoButton = screen.getByTestId('demo-login-btn');
    expect((demoButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText('Checking demo...').length).toBeGreaterThan(0);
  });

  it('shows backend-unreachable messaging without rendering demo actions', () => {
    render(
      <LoginForm
        onSuccess={() => undefined}
        demoState="unreachable"
      />,
    );

    expect(screen.getByText('Backend unreachable')).toBeTruthy();
    expect(
      screen.getByText(
        'The backend is not responding, so demo availability cannot be confirmed.',
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('demo-login-btn')).toBeNull();
  });

  it('allows explicit demo sign-in when demo access is available', async () => {
    apiMocks.demoLogin.mockResolvedValue(undefined);

    const onSuccess = vi.fn();

    render(
      <LoginForm
        onSuccess={onSuccess}
        demoState="available"
      />,
    );

    fireEvent.click(screen.getByTestId('demo-login-btn'));

    await waitFor(() => {
      expect(apiMocks.demoLogin).toHaveBeenCalledTimes(1);
    });
  });
});
