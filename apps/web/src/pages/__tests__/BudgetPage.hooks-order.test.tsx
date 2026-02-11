/**
 * Regression tests for BudgetPage hook order crash and data-shape handling.
 * Uses deterministic fixtures for rivit and valisummat-only payloads.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { BudgetPage } from '../BudgetPage';
import { NavigationProvider } from '../../context/NavigationContext';
import { DemoStatusProvider } from '../../context/DemoStatusContext';
import * as api from '../../api';
import type { Budget, BudgetLine, BudgetValisumma } from '../../api';

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

// ─── Deterministic fixtures for rivit and valisummat-only budget payloads (S-02) ───

const RIVIT_BUDGET_ID = 'b-rivit';
const VALISUMMAT_BUDGET_ID = 'b-vali';

/** Deterministic rivit (account lines) — legacy path. */
export const FIXTURES_RIVIT_LINES: BudgetLine[] = [
  {
    id: 'r1',
    talousarvioId: RIVIT_BUDGET_ID,
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
    talousarvioId: RIVIT_BUDGET_ID,
    tiliryhma: '5100',
    nimi: 'Invest',
    tyyppi: 'investointi',
    summa: '30000',
    muistiinpanot: null,
    createdAt: '',
    updatedAt: '',
  },
];

/** Deterministic valisummat-only (KVA path). */
export const FIXTURES_VALISUMMAT: BudgetValisumma[] = [
  {
    id: 'v1',
    talousarvioId: VALISUMMAT_BUDGET_ID,
    palvelutyyppi: 'vesi',
    categoryKey: 'sales_revenue',
    tyyppi: 'tulo',
    label: 'Liikevaihto',
    summa: '400000',
    lahde: null,
  },
  {
    id: 'v2',
    talousarvioId: VALISUMMAT_BUDGET_ID,
    palvelutyyppi: 'vesi',
    categoryKey: 'personnel_costs',
    tyyppi: 'kulu',
    label: 'Henkilöstö',
    summa: '100000',
    lahde: null,
  },
];

/** Budget with rivit (legacy path). No valisummat. */
function budgetWithRivit(rivit: BudgetLine[]): Budget {
  return {
    id: RIVIT_BUDGET_ID,
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

/** Budget with valisummat only (KVA path). No rivit. */
function budgetWithValisummatOnly(valisummat: BudgetValisumma[]): Budget {
  return {
    id: VALISUMMAT_BUDGET_ID,
    orgId: 'org1',
    vuosi: 2024,
    nimi: 'Budget valisummat only',
    tila: 'luonnos',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    rivit: [],
    tuloajurit: [],
    valisummat,
  };
}

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
      const budget = budgetWithRivit(FIXTURES_RIVIT_LINES);
      vi.mocked(api.listBudgets).mockResolvedValue([budget]);
      vi.mocked(api.getBudget).mockResolvedValue(budget);

      // Regression: when bug exists, second render throws "Rendered more hooks than during the previous render"
      // (useCallback at BudgetPage.tsx ~589 appears only when activeBudget path is taken).
      renderBudgetPage();

      await screen.findByRole('heading', { name: /talousarvio|budget/i });
    });
  });

  describe('with valisummat-only data', () => {
    it('renders without hook-order crash when budget has valisummat only (no rivit)', async () => {
      const budget = budgetWithValisummatOnly(FIXTURES_VALISUMMAT);
      vi.mocked(api.listBudgets).mockResolvedValue([budget]);
      vi.mocked(api.getBudget).mockResolvedValue(budget);

      renderBudgetPage();

      await screen.findByRole('heading', { name: /talousarvio|budget/i });
    });

    it('renders valisummat-only content after hard reload (initial load with valisummat-only payload)', async () => {
      const budget = budgetWithValisummatOnly(FIXTURES_VALISUMMAT);
      vi.mocked(api.listBudgets).mockResolvedValue([budget]);
      vi.mocked(api.getBudget).mockResolvedValue(budget);

      renderBudgetPage();

      const headings = await screen.findAllByRole('heading', { name: /talousarvio|budget/i });
      expect(headings.length).toBeGreaterThanOrEqual(1);
      await waitFor(() => {
        const valiContent = screen.getAllByText(/Liikevaihto|Henkilöstö/i);
        expect(valiContent.length).toBeGreaterThanOrEqual(1);
      });
      // Regression: hard reload with imported valisummat shows content without white screen
      expect(screen.getAllByRole('heading', { name: /talousarvio|budget/i }).length).toBeGreaterThanOrEqual(1);
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(50);
    });
  });

  describe('switching between payload shapes in one session', () => {
    it('renders without crash when switching from rivit to valisummat-only budget', async () => {
      const rivitBudget = budgetWithRivit(FIXTURES_RIVIT_LINES);
      const valisummatBudget = budgetWithValisummatOnly(FIXTURES_VALISUMMAT);
      vi.mocked(api.listBudgets).mockResolvedValue([rivitBudget, valisummatBudget]);
      vi.mocked(api.getBudget).mockImplementation((id: string) =>
        Promise.resolve(id === rivitBudget.id ? rivitBudget : valisummatBudget),
      );

      renderBudgetPage();

      const headings = await screen.findAllByRole('heading', { name: /talousarvio|budget/i });
      expect(headings.length).toBeGreaterThanOrEqual(1);
      const comboboxes = screen.getAllByRole('combobox');
      const select = comboboxes.find((el) => el.querySelector(`option[value="${valisummatBudget.id}"]`)) ?? comboboxes[0];
      fireEvent.change(select, { target: { value: valisummatBudget.id } });

      await waitFor(() => {
        const valiContent = screen.getAllByText(/Liikevaihto|Henkilöstö/i);
        expect(valiContent.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
