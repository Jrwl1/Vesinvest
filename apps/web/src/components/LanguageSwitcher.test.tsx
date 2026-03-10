import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from './LanguageSwitcher';

const { changeLanguageMock } = vi.hoisted(() => ({
  changeLanguageMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: {
      language: 'en',
      resolvedLanguage: 'en',
      changeLanguage: changeLanguageMock,
    },
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    changeLanguageMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses matching visible and accessible labels for desktop language buttons', () => {
    render(<LanguageSwitcher />);

    const fiButton = screen.getByRole('button', { name: 'FI' });
    const svButton = screen.getByRole('button', { name: 'SV' });
    const enButton = screen.getByRole('button', { name: 'EN' });

    expect(fiButton.textContent).toBe('FI');
    expect(svButton.textContent).toBe('SV');
    expect(enButton.textContent).toBe('EN');
    expect((enButton as HTMLButtonElement).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('switches languages using the visible shell labels', () => {
    render(<LanguageSwitcher />);

    fireEvent.click(screen.getByRole('button', { name: 'SV' }));

    expect(changeLanguageMock).toHaveBeenCalledWith('sv');
  });
});
