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
export function registerOverviewConnectImportRecoverySuite() {
  describe('OverviewPageV2 connect and import step', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('opens one inline step-2 card editor at a time and quiets surrounding cards', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const materialButtons = Array.from(
      document.querySelectorAll('[data-edit-field="aineetJaPalvelut"]'),
    ) as HTMLButtonElement[];
    const firstCard = materialButtons[0]!.closest(
      '.v2-year-readiness-row',
    ) as HTMLElement;
    const secondCard = materialButtons[1]!.closest(
      '.v2-year-readiness-row',
    ) as HTMLElement;

    fireEvent.click(materialButtons[0]!);

    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialRevenue'),
      }),
    ).toBeNull();
    expect(firstCard.className).toContain('active-edit');
    expect(secondCard.className).toContain('quiet');

    fireEvent.click(materialButtons[1]!);

    await waitFor(() => {
      expect(secondCard.className).toContain('active-edit');
      expect(firstCard.className).toContain('quiet');
    });
  });

  it('focuses the matching field when a step-2 card value is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const valueButton = document.querySelector(
      '[data-edit-field="aineetJaPalvelut"]',
    ) as HTMLButtonElement | null;
    expect(valueButton).toBeTruthy();

    fireEvent.click(valueButton!);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
    expect(
      screen.queryByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialRevenue'),
      }),
    ).toBeNull();
  });

  it('opens step-2 inline edit when the full finance row is clicked', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const rowLabel = screen.getAllByText(
      localeText('v2Overview.previewAccountingMaterialsLabel'),
    )[0]!;

    fireEvent.click(rowLabel.closest('.v2-year-canon-row') as HTMLElement);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('keeps step-2 save actions disabled until an inline edit is actually changed', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));

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

    const saveButton = await screen.findByRole('button', {
      name: localeText('v2Overview.manualPatchSave'),
    });

    expect((saveButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '17000' } },
    );

    await waitFor(() => {
      expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('allows saving an explicit zero for a financially missing field that arrived blank', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
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
    getImportYearDataV2.mockResolvedValueOnce({
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
    } as any);
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['financialBaseline'],
      missingAfter: [],
      syncReady: false,
      status: buildOverviewResponse({ workspaceYears: [] }).importStatus,
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    fireEvent.click(
      document.querySelector('[data-edit-field="aineetJaPalvelut"]') as HTMLButtonElement,
    );

    const saveButton = (await screen.findByRole('button', {
      name: localeText('v2Overview.manualPatchSave'),
    })) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);

    const materialsInput = await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    });
    fireEvent.change(materialsInput, { target: { value: '1' } });
    fireEvent.change(materialsInput, { target: { value: '0' } });

    await waitFor(() => {
      expect(saveButton.disabled).toBe(false);
    });

    fireEvent.click(saveButton);

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

  it('opens repair from a missing secondary stat and focuses the missing field', async () => {
    getOverviewV2.mockResolvedValueOnce(buildOverviewResponse({ workspaceYears: [] }));
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: year === 2024,
        volume_vesi: true,
        volume_jatevesi: year === 2024,
      },
      hasManualOverrides: year === 2024,
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
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        ...(year === 2024
          ? [
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
            ]
          : []),
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        ...(year === 2024
          ? [
              {
                dataType: 'volume_jatevesi',
                rawRows: [{ Maara: 25000 }],
                effectiveRows: [{ Maara: 24500 }],
                source: 'manual',
                hasOverride: true,
                reconcileNeeded: true,
                overrideMeta: null,
              },
            ]
          : []),
      ],
    }));

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    const year2023Card = (await screen.findByRole('checkbox', { name: '2023' }))
      .closest('.v2-year-readiness-row') as HTMLElement;
    const missingVolumeButton = year2023Card.querySelector(
      '[data-edit-field="soldWastewaterVolume"]',
    ) as HTMLButtonElement;
    expect(missingVolumeButton).toBeTruthy();
    fireEvent.click(missingVolumeButton);

    const input = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualVolumeWastewater'),
    })) as HTMLInputElement;

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });

  it('closes the active step-2 card after saving and allows reopening the same or another year', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: false,
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const valueButton = document.querySelector(
      '[data-edit-field="aineetJaPalvelut"]',
    ) as HTMLButtonElement | null;
    fireEvent.click(valueButton!);

    fireEvent.change(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { target: { value: '16500' } },
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16500,
          }),
        }),
      );
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });
    expect(getOverviewV2).toHaveBeenCalledTimes(2);
    expect(getPlanningContextV2).toHaveBeenCalled();
    expect(listForecastScenariosV2).toHaveBeenCalledTimes(1);
    expect(listReportsV2).toHaveBeenCalledTimes(1);

    fireEvent.click(
      document.querySelector('[data-edit-field="aineetJaPalvelut"]')!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
    fireEvent.keyDown(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { key: 'Escape' },
    );

    fireEvent.click(
      (await screen.findAllByRole('button', {
        name: localeText('v2Overview.repairPricesButton'),
      }))[0]!,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualPriceWater'),
      }),
    ).toBeTruthy();
  });

  it('keeps tariff mismatch as a warning and hides the repair CTA', async () => {
    const blockedYear = {
      ...buildOverviewResponse({ workspaceYears: [] }).importStatus.years[0],
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
    };
    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [],
        years: [blockedYear],
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: false,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      baselineReady: true,
      baselineMissingRequirements: [],
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'missing_fixed_revenue',
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 21000,
              Poistot: 6500,
              LiiketoiminnanMuutKulut: 19000,
              TilikaudenYliJaama: 30000,
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
            { Tyyppi_Id: 1, Kayttomaksu: 2.75 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.2 },
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
          rawRows: [{ Maara: 25500 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24500 }],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: ['tariffRevenue'],
      missingAfter: ['tariffRevenue'],
      syncReady: true,
      baselineReady: true,
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    expect(
      screen.getByText(localeText('v2Overview.requirementTariffRevenueMismatch')),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', {
        name: localeText('v2Overview.repairTariffRevenueButton'),
      }),
    ).toBeNull();
  });

  it('reopens step-2 inline correction from full finance rows after save without relying on value-chip targets', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: false,
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await screen.findByRole('checkbox', { name: '2024' });
    const financeRows = screen.getAllByText(
      localeText('v2Overview.previewAccountingMaterialsLabel'),
    );

    fireEvent.click(financeRows[0]!.closest('.v2-year-canon-row') as HTMLElement);

    const firstInput = (await screen.findByRole('spinbutton', {
      name: localeText('v2Overview.manualFinancialMaterials'),
    })) as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '16500' } });
    fireEvent.click(
      screen.getByRole('button', {
        name: localeText('v2Overview.manualPatchSave'),
      }),
    );

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 16500,
          }),
        }),
      );
    });
    await waitFor(() => {
      expect(
        document.querySelector('.v2-year-readiness-row.active-edit'),
      ).toBeNull();
    });

    fireEvent.click(
      screen
        .getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))[0]!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();

    fireEvent.keyDown(
      screen.getByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
      { key: 'Escape' },
    );

    fireEvent.click(
      screen
        .getAllByText(localeText('v2Overview.previewAccountingMaterialsLabel'))[1]!
        .closest('.v2-year-canon-row') as HTMLElement,
    );
    expect(
      await screen.findByRole('spinbutton', {
        name: localeText('v2Overview.manualFinancialMaterials'),
      }),
    ).toBeTruthy();
  });

  it('saves the inline step-2 card with Enter', async () => {
    getOverviewV2.mockResolvedValue(buildOverviewResponse({ workspaceYears: [] }));
    completeImportYearManuallyV2.mockResolvedValue({
      year: 2024,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: false,
      status: {
        connected: true,
        link: {
          nimi: 'Water Utility',
          ytunnus: '1234567-8',
          lastFetchedAt: '2026-03-08T10:00:00.000Z',
        },
        years: [],
        excludedYears: [],
      },
    } as any);

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
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(completeImportYearManuallyV2).toHaveBeenCalledWith(
        expect.objectContaining({
          year: 2024,
          financials: expect.objectContaining({
            aineetJaPalvelut: 17000,
            tilikaudenYliJaama: 28000,
          }),
        }),
      );
    });
  });
  });
}

