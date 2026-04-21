import React from 'react';
import {
  completeImportYearManuallyV2,
  clearImportAndScenariosV2,
  connectImportOrganizationV2,
  createVesinvestPlanV2,
  createForecastScenarioV2,
  createPlanningBaselineV2,
  deleteImportYearsBulkV2,
  deleteImportYearV2,
  excludeImportYearsV2,
  getImportStatusV2,
  getImportYearDataV2,
  getTokenInfo,
  importYearsV2,
  getOpsFunnelV2,
  getOverviewV2,
  getPlanningContextV2,
  listForecastScenariosV2,
  listReportsV2,
  previewWorkbookImportV2,
  refreshOverviewPeerV2,
  reconcileImportYearV2,
  restoreImportYearsV2,
  searchImportOrganizationsV2,
  syncImportV2,
  sendV2OpsEvent,
  extractStatementFromPdf,
  extractQdisFromPdf,
  extractDocumentFromPdf,
  translate,
  localeText,
  getPrimaryButtons,
  expectPrimaryButtonLabels,
  clickReviewGroupYear,
  focusReviewWorkspaceYear,
  openReviewWorkspaceYear,
  openYearDecisionWorkspaceYear,
  openCurrentYearEstimateLane,
  getLatestSetupWizardState,
  findSupportStatusItem,
  findReviewWorkspaceYear,
  seedReviewedYears,
  buildOverviewResponse,
  buildPlanningContextResponse,
  resetOverviewTestState,
  setActiveLocale,
} from './overviewTestHarness';
import {
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverviewImportBoard } from '../../OverviewImportBoard';
import { OverviewPageV2 } from '../../OverviewPageV2';
import { OverviewReviewBoard } from '../../OverviewReviewBoard';
import { OverviewSupportRail } from '../../OverviewSupportRail';
import { OverviewYearWorkspace } from '../../OverviewYearWorkspace';
import {
  OverviewConnectStep,
  OverviewForecastHandoffStep,
  OverviewPlanningBaselineStep,
} from '../../OverviewWizardPanels';
import { submitWorkbookImportWorkflow } from '../../overviewImportWorkflows';
import { getPreviewPrefetchYears, pickDefaultBaselineYears } from '../../overviewSelectors';
import { buildImportYearSummaryRows } from '../../yearReview';
import { getExactEditedFieldLabels, useOverviewSetupState } from '../../useOverviewSetupState';
import { useOverviewImportController } from '../../useOverviewImportController';
export function registerOverviewWorkspaceInlineEditorSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('cancels the inline step-2 editor with Escape', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    fireEvent.click(
      document.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    const input = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(input, { target: { value: '17000' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });
  });

  it('does not discard dirty inline edits when another step-2 card is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const cards = Array.from(
      document.querySelectorAll('.v2-year-readiness-row'),
    ) as HTMLElement[];
    fireEvent.click(
      cards[0]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    const input = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(input, { target: { value: '17000' } });
    fireEvent.click(
      cards[1]!.querySelector(
        '[data-edit-field="aineetJaPalvelut"]',
      ) as HTMLButtonElement,
    );

    expect(cards[0]!.className).toContain('active-edit');
    expect(cards[1]!.className).toContain('quiet');
    expect(
      screen.getByText(localeText('v2Overview.inlineCardDirtyGuard')),
    ).toBeTruthy();
  });

  it('refreshes the step-3 review card values after save-and-sync', async () => {
    let reviewYearState: 'initial' | 'refreshed' = 'initial';
    const buildReviewYearData = (materials: number, result: number) => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 95000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: materials,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: result,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    });

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => {
      if (year === 2024) {
        return buildReviewYearData(
          reviewYearState === 'initial' ? 15000 : 16500,
          reviewYearState === 'initial' ? 30000 : 28000,
        );
      }
      return {
        year,
        veetiId: 1,
        sourceStatus: 'VEETI',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        hasManualOverrides: false,
        hasVeetiData: true,
        datasets: [],
      };
    });
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      status: buildOverviewResponse({ workspaceYears: [2024, 2023] }).importStatus,
    } as any);
    syncImportV2.mockImplementation(async () => {
      reviewYearState = 'refreshed';
      return {
        generatedBudgets: {
          results: [{ budgetId: 'budget-2024', vuosi: 2024, mode: 'updated' }],
          skipped: [],
        },
        sanity: { rows: [] },
      } as any;
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await openReviewWorkspaceYear(2024);
    fireEvent.click(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    );

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '16500' } },
    );
    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialYearResult'),
      }),
      { target: { value: '28000' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSaveAndSync'),
      }),
    );

    await waitFor(() => {
      expect(syncImportV2).toHaveBeenCalledWith([2024]);
    });
    await waitFor(() => {
      expect(getImportYearDataV2).toHaveBeenCalledWith(2024);
    });
    await openYearDecisionWorkspaceYear(2024);
    await waitFor(() => {
      const materialsInput = screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialMaterials')} 2024`,
      }) as HTMLInputElement;
      const yearResultInput = screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialYearResult')} 2024`,
      }) as HTMLInputElement;

      expect(materialsInput.value).toBe('16500');
      expect(yearResultInput.value).toBe('28000');
      expect(
        screen.getByRole('button', {
          name: new RegExp(
            `${localeText('v2Overview.manualFinancialYearResultResetToDerived')} 2024`,
          ),
        }),
      ).toBeTruthy();
    });
  });

  it('renders selected review years side by side and saves workspace edits per year', async () => {
    const buildWorkspaceReviewYearData = (
      year: number,
      materials: number,
      result: number,
    ) => ({
      year,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: materials,
              Henkilostokulut: 20000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: result,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.5 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 24000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({ workspaceYears: [2024, 2023] }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) =>
      buildWorkspaceReviewYearData(year, year === 2024 ? 15000 : 16000, 30000),
    );
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
      status: buildOverviewResponse({ workspaceYears: [2024, 2023] }).importStatus,
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2023"]'),
      ).toBeTruthy();
    });
    expect(
      screen.getByRole('group', {
        name: localeText('v2Overview.selectedYearsLabel'),
      }),
    ).toBeTruthy();
    expect(document.querySelector('[data-review-workspace-year="2024"]')).toBeNull();

    fireEvent.click(
      document.querySelector(
        '[data-review-workspace-toggle="2024"] input',
      ) as HTMLInputElement,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });
    const year2024Column = document.querySelector(
      '[data-review-workspace-year="2024"]',
    );
    const year2023Column = document.querySelector('[data-review-workspace-year="2023"]');

    expect(year2024Column).toBeTruthy();
    expect(year2023Column).toBeTruthy();

    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialMaterials')} 2024`,
      }),
      { target: { value: '16500' } },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.manualPatchSave')} 2024`,
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16500,
            tilikaudenYliJaama: 28500,
          }),
        }),
      );
    });
  });

  it('saves an explicit zero from the review workspace when the source field is missing', async () => {
    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2024,
            completeness: {
              tilinpaatos: false,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            baselineReady: false,
            baselineMissingRequirements: ['financialBaseline'],
            warnings: ['missing_financials'],
            datasetCounts: {
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
          },
        ],
      }),
    );
    getImportYearDataV2.mockImplementation(async () => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25500 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24500 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['financialBaseline'],
      missingAfter: [],
      syncReady: false,
      status: buildOverviewResponse({ workspaceYears: [2024] }).importStatus,
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });

    fireEvent.click(
      document.querySelector(
        '[data-review-group-year="almost_nothing-2024"]',
      ) as HTMLButtonElement,
    );

    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialMaterials')} 2024`,
      }),
      { target: { value: '0' } },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.manualPatchSave')} 2024`,
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 0,
          }),
        }),
      );
    });
  });

  it('hides the review workspace save strip once the reviewed year no longer has unsaved edits', async () => {
    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2024,
            completeness: {
              tilinpaatos: false,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            baselineReady: false,
            baselineMissingRequirements: ['financialBaseline'],
            warnings: ['missing_financials'],
            datasetCounts: {
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
          },
        ],
      }),
    );
    getImportYearDataV2.mockImplementation(async () => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: '',
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: '',
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25500 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24500 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['financialBaseline'],
      missingAfter: [],
      syncReady: false,
      status: buildOverviewResponse({ workspaceYears: [2024] }).importStatus,
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year=\"2024\"]'),
      ).toBeTruthy();
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2024`,
      }),
    );
    await screen.findByRole('spinbutton', {
      name: `${localeText('v2Overview.manualFinancialMaterials')} 2024`,
    });

    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialFixedRevenue')} 2024`,
      }),
      { target: { value: '0' } },
    );
    fireEvent.change(
      screen.getByRole('spinbutton', {
        name: `${localeText('v2Overview.manualFinancialMaterials')} 2024`,
      }),
      { target: { value: '0' } },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.manualPatchSave')} 2024`,
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            perusmaksuYhteensa: 0,
            aineetJaPalvelut: 0,
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: `${localeText('v2Overview.manualPatchSave')} 2024`,
        }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: `${localeText('v2Overview.manualPatchSaveAndSync')} 2024`,
        }),
      ).toBeNull();
    });
  });

  it('does not serialize untouched missing financial rows when only fixed revenue is set to zero in the review workspace', async () => {
    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [
          {
            ...buildOverviewResponse().importStatus.years[1],
            vuosi: 2024,
            completeness: {
              tilinpaatos: false,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            baselineReady: false,
            baselineMissingRequirements: ['financialBaseline'],
            warnings: ['missing_financials'],
            datasetCounts: {
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
          },
        ],
      }),
    );
    getImportYearDataV2.mockImplementation(async () => ({
      year: 2024,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: false,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: '',
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              PerusmaksuYhteensa: '',
              AineetJaPalvelut: '',
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 53500,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25500 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24500 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['financialBaseline'],
      missingAfter: [],
      syncReady: false,
      status: buildOverviewResponse({ workspaceYears: [2024] }).importStatus,
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });

    const fixedRevenueInput = await screen.findByRole('spinbutton', {
      name: `${localeText('v2Overview.manualFinancialFixedRevenue')} 2024`,
    });

    fireEvent.change(
      fixedRevenueInput,
      { target: { value: '0' } },
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `${localeText('v2Overview.manualPatchSave')} 2024`,
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalled();
    });

    const payload =
      completeImportYearManuallyV2.mock.calls[
        completeImportYearManuallyV2.mock.calls.length - 1
      ]?.[0];
    expect(payload?.financials?.perusmaksuYhteensa).toBe(0);
    expect(payload?.financials?.aineetJaPalvelut).toBeUndefined();
  });
  });
}

