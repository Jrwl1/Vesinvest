/**
 * Modal state tests for KVA import preview: confirm is disabled until preview extraction is loaded.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { KvaImportPreview, buildConsecutiveTriples, pickDefaultSelectedYears } from './KvaImportPreview';

function renderKvaModal() {
  return render(
    <I18nextProvider i18n={i18n}>
      <KvaImportPreview onImportComplete={() => {}} onClose={() => {}} />
    </I18nextProvider>,
  );
}

describe('KvaImportPreview modal state', () => {
  it('does not show confirm button until preview step (confirm disabled until extraction loaded)', () => {
    renderKvaModal();
    // In upload step there is no confirm button; user must load a file first
    const confirmBtn = screen.queryByTestId('kva-confirm-btn');
    expect(confirmBtn).toBeNull();
  });

  it('does not render Tuloajurit section (KVA flow is totals-only)', () => {
    renderKvaModal();
    expect(screen.queryByText('Tuloajurit')).toBeNull();
  });

  it('does not render Blad1 Tilitason rivit section (default modal flow)', () => {
    renderKvaModal();
    expect(screen.queryByText(/Tilitason rivit|Blad1.*rivit/i)).toBeNull();
  });

  it('builds only consecutive 3-year windows from detected years', () => {
    expect(buildConsecutiveTriples([2023, 2024, 2025, 2027, 2028, 2030])).toEqual([
      [2023, 2024, 2025],
    ]);
  });

  it('default selection resolves to a consecutive 3-year block', () => {
    expect(pickDefaultSelectedYears([2023, 2024, 2025, 2026, 2027], [2023, 2026, 2027])).toEqual([
      2025, 2026, 2027,
    ]);
  });
});
