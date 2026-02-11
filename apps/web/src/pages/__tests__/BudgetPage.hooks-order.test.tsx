/**
 * Regression tests for BudgetPage hook order crash: "Rendered more hooks than previous render".
 * Occurs when render path differs between rivit-based and valisummat-only payloads (e.g. hard reload).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { BudgetPage } from '../BudgetPage';
import { NavigationProvider } from '../../context/NavigationContext';
import { DemoStatusProvider } from '../../context/DemoStatusContext';
import * as api from '../../api';
import type { Budget, BudgetLine } from '../../api';

vi.mock('../../api', () => ({
  listBudgets: vi.fn(),
  getBudget: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  createBudgetLine: vi.fn(),
  updateBudgetLine: vi.fn(),
  deleteBudgetLine: vi.fn(),
  createRevenueDriver: vi.fn(),
  updateRevenueDriver: vi.fn(),
  seedDemoData: vi.fn(),
  getDemoStatus: vi.fn(() =>
    Promise.resolve({ enabled: true, orgId: 'test-org' }),
  ),
}));

/** Budget with rivit (account lines) — legacy path. No valisummat. */
function budgetWithRivit(rivit: BudgetLine[]): Budget {
  return {
    id: 'b-rivit',
    orgId: 'org1',
    vuosi: 2024,
    nimi: 'Budget with rivit',
    tila: 'luonnos',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    rivit,
    tuloajurit: [],
    valisummat: [],
  };
}

/** Minimal BudgetLine for rivit regression. */
const rivitFixture: BudgetLine[] = [
  {
    id: 'r1',
    talousarvioId: 'b-rivit',
    tiliryhma: '4100',
    nimi: 'Energia',
    tyyppi: 'kulu',
    summa: '50000',
    muistiinpanot: null,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'r2',
    talousarvioId: 'b-rivit',
    tiliryhma: '5100',
    nimi: 'Invest',
    tyyppi: 'investointi',
    summa: '30000',
    muistiinpanot: null,
    createdAt: '',
    updatedAt: '',
  },
];

function renderBudgetPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <NavigationProvider>
        <DemoStatusProvider>
          <BudgetPage />
        </DemoStatusProvider>
      </NavigationProvider>
    </I18nextProvider>,
  );
}

describe('BudgetPage hooks-order (regression)', () => {
  beforeEach(() => {
    vi.mocked(api.listBudgets).mockResolvedValue([]);
    vi.mocked(api.getBudget).mockResolvedValue({} as Budget);
  });

  describe('with rivit data', () => {
    it('renders without hook-order crash when budget has rivit', async () => {
      const budget = budgetWithRivit(rivitFixture);
      vi.mocked(api.listBudgets).mockResolvedValue([budget]);
      vi.mocked(api.getBudget).mockResolvedValue(budget);

      // Regression: when bug exists, second render throws "Rendered more hooks than during the previous render"
      // (useCallback at BudgetPage.tsx ~589 appears only when activeBudget path is taken).
      renderBudgetPage();

      await screen.findByRole('heading', { name: /talousarvio|budget/i });
    });
  });
});
