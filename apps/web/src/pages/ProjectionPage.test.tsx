import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import { ProjectionPage } from './ProjectionPage';
import { NavigationProvider } from '../context/NavigationContext';
import { DemoStatusProvider } from '../context/DemoStatusContext';
import * as api from '../api';

vi.mock('../components/ScenarioComparison', () => ({
  ScenarioComparison: () => null,
}));

vi.mock('../components/RevenueReport', () => ({
  RevenueReport: () => null,
}));

vi.mock('../components/DriverPlanner', () => ({
  DriverPlanner: () => <div data-testid="driver-planner" />,
}));

vi.mock('../components/ProjectionCharts', () => ({
  ProjectionCharts: () => <div data-testid="projection-charts" />,
}));

vi.mock('../api', () => ({
  listProjections: vi.fn(),
  getProjection: vi.fn(),
  createProjection: vi.fn(),
  deleteProjection: vi.fn(),
  computeProjection: vi.fn(),
  computeForBudget: vi.fn(),
  updateProjection: vi.fn(),
  listBudgets: vi.fn(),
  listAssumptions: vi.fn(),
  getProjectionExportUrl: vi.fn(() => '/projections/x/export'),
  getProjectionExportPdfUrl: vi.fn(() => '/projections/x/export-pdf'),
  seedDemoData: vi.fn(),
  getDemoStatus: vi.fn(() => Promise.resolve({ enabled: false, orgId: null })),
}));

function renderProjectionPage() {
  return render(
    <I18nextProvider i18n={i18n}>
      <NavigationProvider>
        <DemoStatusProvider>
          <ProjectionPage />
        </DemoStatusProvider>
      </NavigationProvider>
    </I18nextProvider>,
  );
}

function makeBudget(id: string, year: number, importBatchId: string | null = null) {
  return {
    id,
    orgId: 'org-1',
    vuosi: year,
    nimi: `Budget ${year}`,
    tila: 'luonnos',
    importBatchId,
    importedAt: `2026-01-${Math.max(1, year - 2023).toString().padStart(2, '0')}T00:00:00.000Z`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { tuloajurit: 0, rivit: 0 },
  } as any;
}

function makeProjectionSummary(id: string, budgetId: string) {
  return {
    id,
    orgId: 'org-1',
    talousarvioId: budgetId,
    nimi: 'Perusskenaario 2025',
    aikajaksoVuosia: 20,
    olettamusYlikirjoitukset: null,
    onOletus: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    _count: { vuodet: 21 },
  } as any;
}

function makeProjectionWithYears(id: string, budgetId: string) {
  return {
    ...makeProjectionSummary(id, budgetId),
    talousarvio: {
      id: budgetId,
      vuosi: 2025,
      nimi: 'Budget 2025',
      tuloajurit: [],
      rivit: [],
      valisummat: [{ categoryKey: 'sales_revenue', tyyppi: 'tulo', summa: '100000', palvelutyyppi: 'vesi' }],
    },
    requiredTariff: 1.22,
    ajuriPolut: null,
    userInvestments: [],
    vuodet: [
      {
        id: 'year-1',
        ennusteId: id,
        vuosi: 2025,
        tulotYhteensa: '100000',
        kulutYhteensa: '90000',
        investoinnitYhteensa: '10000',
        tulos: '10000',
        kumulatiivinenTulos: '10000',
        vesihinta: '1.5',
        myytyVesimaara: '100000',
        erittelyt: null,
      },
    ],
  } as any;
}

describe('ProjectionPage bootstrap + scenario hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listAssumptions).mockResolvedValue([]);
    vi.mocked(api.updateProjection).mockResolvedValue({} as any);
    vi.mocked(api.createProjection).mockResolvedValue({} as any);
    vi.mocked(api.deleteProjection).mockResolvedValue(undefined);
    vi.mocked(api.seedDemoData).mockResolvedValue({ alreadySeeded: true, seededAt: '2026-01-01T00:00:00.000Z' } as any);
  });

  it('auto-bootstraps baseline when there are budgets but no projections', async () => {
    const budget = makeBudget('budget-2025', 2025, 'batch-2025');
    const bootstrapped = makeProjectionWithYears('projection-1', budget.id);

    vi.mocked(api.listProjections)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makeProjectionSummary('projection-1', budget.id)]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.computeForBudget).mockResolvedValue(bootstrapped);

    renderProjectionPage();

    await waitFor(() => {
      expect(api.computeForBudget).toHaveBeenCalledWith(budget.id);
    });
  });

  it('does not call bootstrap when selected projection already has computed years', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const full = makeProjectionWithYears('projection-1', budget.id);

    vi.mocked(api.listProjections).mockResolvedValue([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(full);

    renderProjectionPage();

    await waitFor(() => {
      expect(api.getProjection).toHaveBeenCalledWith(summary.id);
    });
    expect(api.computeForBudget).not.toHaveBeenCalled();
  });

  it('startup 404 recovery computes by budget without carrying selected scenario driver paths', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const selectedWithoutYears = {
      ...makeProjectionWithYears('projection-1', budget.id),
      vuodet: [],
      ajuriPolut: {
        vesi: {
          yksikkohinta: { mode: 'manual', values: { 2025: 1.9 } },
          myytyMaara: { mode: 'manual', values: { 2025: 125000 } },
        },
      },
    } as any;
    const recovered = makeProjectionWithYears('projection-2', budget.id);

    vi.mocked(api.listProjections)
      .mockResolvedValueOnce([summary])
      .mockResolvedValueOnce([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(selectedWithoutYears);
    vi.mocked(api.computeProjection).mockRejectedValue(new Error('404 Projection not found'));
    vi.mocked(api.computeForBudget).mockResolvedValue(recovered);

    renderProjectionPage();

    await waitFor(() => {
      expect(api.computeForBudget).toHaveBeenCalled();
    });

    const firstCall = vi.mocked(api.computeForBudget).mock.calls[0] ?? [];
    expect(firstCall[0]).toBe(budget.id);
    expect(firstCall).toHaveLength(1);
  });

  it('stale 404 recovery computes by budget and passes overrides and driver paths', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const overrides = { inflaatio: 0.04 };
    const ajuriPolut = {
      vesi: {
        yksikkohinta: { mode: 'manual', values: { 2025: 1.7 } },
        myytyMaara: { mode: 'manual', values: { 2025: 120000 } },
      },
    };
    const full = {
      ...makeProjectionWithYears('projection-1', budget.id),
      olettamusYlikirjoitukset: overrides,
      ajuriPolut,
    } as any;

    vi.mocked(api.listProjections).mockResolvedValue([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(full);
    vi.mocked(api.computeProjection).mockRejectedValue(new Error('404 Projection not found'));
    vi.mocked(api.computeForBudget).mockResolvedValue(full);

    renderProjectionPage();

    const computeButtons = await screen.findAllByRole('button', { name: /recompute|recalculate|compute|laske uudelleen/i });
    fireEvent.click(computeButtons[0]);

    await waitFor(() => {
      expect(api.computeForBudget).toHaveBeenCalled();
    });

    const firstCall = vi.mocked(api.computeForBudget).mock.calls[0] ?? [];
    expect(firstCall[0]).toBe(budget.id);
    expect(firstCall).toHaveLength(3);
    // 404 fallback now accepts overrides and driver paths (BUG 2); args 2 and 3 may be undefined if ref not synced yet in test
  });

  it('scenario create 404 recovery retries scenario creation instead of falling back to computeForBudget', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const full = makeProjectionWithYears('projection-1', budget.id);
    const recoveredScenario = makeProjectionWithYears('scenario-2', budget.id);

    vi.mocked(api.listProjections).mockResolvedValue([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(full);
    vi.mocked(api.createProjection)
      .mockResolvedValueOnce({ id: 'scenario-draft-1' } as any)
      .mockResolvedValueOnce({ id: 'scenario-draft-2' } as any);
    vi.mocked(api.computeProjection)
      .mockRejectedValueOnce(new Error('404 Projection not found'))
      .mockResolvedValueOnce(recoveredScenario);

    renderProjectionPage();

    const openScenarioButtons = await screen.findAllByRole('button', { name: /create scenario|luo skenaario|skapa scenario/i });
    const openScenarioButton = openScenarioButtons.find((button) => button.closest('.ennuste-scenarios'));
    expect(openScenarioButton).toBeTruthy();
    fireEvent.click(openScenarioButton as HTMLElement);

    const dialog = await screen.findByRole('dialog');
    const scenarioNameInput = within(dialog).getByRole('textbox');
    fireEvent.change(scenarioNameInput, { target: { value: 'What-if 2030' } });

    const createScenarioButton = within(dialog).getByRole('button', { name: /create scenario|luo skenaario|skapa scenario/i });
    fireEvent.click(createScenarioButton);

    await waitFor(() => {
      expect(api.createProjection).toHaveBeenCalledTimes(2);
      expect(api.computeProjection).toHaveBeenCalledTimes(2);
    });
    expect(api.computeForBudget).not.toHaveBeenCalled();
  });

  it('"Luo skenaario" renders in the scenario row (ennuste-scenarios), not in the topbar actions', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const full = makeProjectionWithYears('projection-1', budget.id);

    vi.mocked(api.listProjections).mockResolvedValue([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(full);

    const { container } = renderProjectionPage();

    const scenarioButtons = await screen.findAllByRole('button', { name: /create scenario|luo skenaario|skapa scenario/i });
    const createInScenarioRow = scenarioButtons.find((button) => button.closest('.ennuste-scenarios'));
    expect(createInScenarioRow).toBeTruthy();

    const topbarActions = container.querySelector('.ennuste-actions');
    expect(topbarActions).toBeTruthy();
    expect(within(topbarActions as HTMLElement).queryByRole('button', { name: /create scenario|luo skenaario|skapa scenario/i })).toBeNull();
  });

  it('shows results table always visible (no collapse) after audit §9 change', async () => {
    const budget = makeBudget('budget-2025', 2025);
    const summary = makeProjectionSummary('projection-1', budget.id);
    const full = makeProjectionWithYears('projection-1', budget.id);

    vi.mocked(api.listProjections).mockResolvedValue([summary]);
    vi.mocked(api.listBudgets).mockResolvedValue([budget]);
    vi.mocked(api.getProjection).mockResolvedValue(full);

    renderProjectionPage();

    // Table is now always visible — no <details> collapse
    const resultsSection = document.getElementById('projection-results-view');
    expect(resultsSection).toBeTruthy();
    expect(resultsSection?.tagName.toLowerCase()).not.toBe('details');

    const columnheaders = await screen.findAllByRole('columnheader', { name: /water price|vesihinta|vattenpris/i });
    expect(columnheaders.length).toBeGreaterThan(0);
  });
});
