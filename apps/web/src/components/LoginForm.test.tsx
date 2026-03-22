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

    const supportMeta = screen.getByTestId(
      'login-support-meta',
    ) as HTMLDetailsElement;

    expect(supportMeta.open).toBe(false);
    expect(screen.getByText('Environment details')).toBeTruthy();
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Sign in to this environment with a normal user account.'),
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

    const supportMeta = screen.getByTestId(
      'login-support-meta',
    ) as HTMLDetailsElement;

    expect(supportMeta.open).toBe(true);
    expect(screen.getAllByText('Backend unreachable').length).toBeGreaterThan(0);
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

  it('submits the credential form through the native form path', async () => {
    apiMocks.login.mockResolvedValue(undefined);
    const onSuccess = vi.fn();

    render(
      <LoginForm
        onSuccess={onSuccess}
        demoState="unavailable"
      />,
    );

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: ' USER@Example.com ' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-pass' },
    });

    fireEvent.submit(screen.getByRole('button', { name: 'Sign in' }).closest('form')!);

    await waitFor(() => {
      expect(apiMocks.login).toHaveBeenCalledWith('user@example.com', 'secret-pass');
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('uses task-first entry copy without repeating sign-in chrome in the card header', () => {
    render(
      <LoginForm
        onSuccess={() => undefined}
        demoState="unavailable"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 2, name: 'Open your workspace' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Connect the utility, review imported years, and continue to forecasts and reports.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Sign in to Vesipolku')).toBeNull();
    expect(screen.getAllByText('Sign in')).toHaveLength(1);
  });

  it('renders environment metadata after the main sign-in form', () => {
    render(
      <LoginForm
        onSuccess={() => undefined}
        demoState="unavailable"
      />,
    );

    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form');
    const supportMeta = screen.getByTestId(
      'login-support-meta',
    ) as HTMLDetailsElement;

    expect(form).toBeTruthy();
    expect(supportMeta.tagName).toBe('DETAILS');
    expect(
      form!.compareDocumentPosition(supportMeta) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
