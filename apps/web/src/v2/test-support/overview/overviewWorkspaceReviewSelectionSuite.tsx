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
export function registerOverviewWorkspaceReviewSelectionSuite() {
  describe('OverviewPageV2 workspace and handoff', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

  it('lets the user pin and unpin review workspace years explicitly', async () => {
    const buildWorkspaceReviewYearData = (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: year === 2024,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
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
            { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 26000 }],
          effectiveRows: [{ Maara: 26000 }],
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
      buildWorkspaceReviewYearData(year),
    );

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
    expect(document.querySelector('[data-review-workspace-year="2023"]')).toBeTruthy();

    fireEvent.click(
      document.querySelector(
        '[data-review-workspace-toggle="2023"] input',
      ) as HTMLInputElement,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2023"]'),
      ).toBeNull();
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });

    fireEvent.click(
      document.querySelector(
        '[data-review-workspace-toggle="2024"] input',
      ) as HTMLInputElement,
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeNull();
    });
    expect(
      screen.getAllByText(localeText('v2Overview.noYearsSelected')).length,
    ).toBeGreaterThan(0);
  });

  it('gives the review workspace one primary action per year while keeping imports secondary', () => {
    const buildWorkspaceYearData = (year: number, sourceStatus: string) => ({
      year,
      veetiId: 1,
      sourceStatus,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: sourceStatus === 'MIXED',
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
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
            { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          effectiveRows: [
            { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
            { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 26000 }],
          effectiveRows: [{ Maara: 26000 }],
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

    render(
      <OverviewYearWorkspace
        t={translate as any}
        reviewStatusRows={[
          {
            year: 2023,
            sourceStatus: 'VEETI',
            missingRequirements: ['prices'],
            setupStatus: 'needs_attention',
          },
          {
            year: 2024,
            sourceStatus: 'MIXED',
            missingRequirements: [],
            setupStatus: 'reviewed',
          },
        ]}
        activeYear={2023}
        workspaceYears={[2023, 2024]}
        onTogglePinnedYear={() => undefined}
        yearDataCache={{
          2023: buildWorkspaceYearData(2023, 'VEETI') as any,
          2024: buildWorkspaceYearData(2024, 'MIXED') as any,
        }}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceStatusLabel={(status) => status ?? 'VEETI'}
        missingRequirementLabel={() => 'Prices'}
        openInlineCardEditor={() => undefined}
        saveYear={vi.fn().mockResolvedValue({ yearData: buildWorkspaceYearData(2023, 'VEETI') })}
        isAdmin={true}
      />,
    );

    const needsAttentionYear = document.querySelector(
      '[data-review-workspace-year="2023"]',
    ) as HTMLElement;
    const reviewedYear = document.querySelector(
      '[data-review-workspace-year="2024"]',
    ) as HTMLElement;

    const needsPrimary = needsAttentionYear.querySelector(
      '.v2-overview-year-workspace-year-actions-primary',
    ) as HTMLElement;
    const needsSecondary = needsAttentionYear.querySelector(
      '.v2-overview-year-workspace-year-actions-secondary',
    ) as HTMLElement;
    const reviewedPrimary = reviewedYear.querySelector(
      '.v2-overview-year-workspace-year-actions-primary',
    ) as HTMLElement;
    const reviewedSecondary = reviewedYear.querySelector(
      '.v2-overview-year-workspace-year-actions-secondary',
    ) as HTMLElement;

    expect(
      within(needsPrimary).getByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2023`,
      }),
    ).toBeTruthy();
    expect(
      within(needsSecondary).queryByRole('button', {
        name: `${localeText('v2Overview.openReviewYearButton')} 2023`,
      }),
    ).toBeNull();
    expect(
      within(needsSecondary).getByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2023`,
      }),
    ).toBeTruthy();
    expect(
      within(needsSecondary).getByRole('button', {
        name: `${localeText('v2Overview.workbookImportAction')} 2023`,
      }),
    ).toBeTruthy();

    expect(
      within(reviewedPrimary).getByRole('button', {
        name: `${localeText('v2Overview.openReviewYearButton')} 2024`,
      }),
    ).toBeTruthy();
    expect(
      within(reviewedSecondary).queryByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2024`,
      }),
    ).toBeNull();
    expect(
      within(reviewedSecondary).getByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2024`,
      }),
    ).toBeTruthy();
    expect(
      within(reviewedSecondary).getByRole('button', {
        name: `${localeText('v2Overview.workbookImportAction')} 2024`,
      }),
    ).toBeTruthy();
  });

  it('keeps the review workspace read-only for non-admin users', async () => {
    const buildWorkspaceYearData = (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: false,
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
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });
    const openInlineCardEditor = vi.fn();
    const saveYear = vi.fn();

    render(
      <OverviewYearWorkspace
        t={translate as any}
        reviewStatusRows={[
          {
            year: 2023,
            sourceStatus: 'VEETI',
            missingRequirements: ['prices'],
            setupStatus: 'needs_attention',
          },
        ]}
        activeYear={2023}
        workspaceYears={[2023]}
        onTogglePinnedYear={() => undefined}
        yearDataCache={{ 2023: buildWorkspaceYearData(2023) as any }}
        sourceStatusClassName={() => 'v2-status-positive'}
        sourceStatusLabel={(status) => status ?? 'VEETI'}
        missingRequirementLabel={() => 'Prices'}
        openInlineCardEditor={openInlineCardEditor}
        saveYear={saveYear}
        isAdmin={false}
      />,
    );

    expect(
      screen.queryByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2023`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: `${localeText('v2Overview.documentImportAction')} 2023`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: `${localeText('v2Overview.workbookImportAction')} 2023`,
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: `${localeText('v2Overview.manualPatchSave')} 2023`,
      }),
    ).toBeNull();

    const inputs = [...document.querySelectorAll('input[type="number"]')] as HTMLInputElement[];
    expect(inputs.length).toBeGreaterThan(0);
    expect(inputs.every((input) => input.readOnly)).toBe(true);
    fireEvent.change(inputs[0]!, { target: { value: '123' } });
    expect(openInlineCardEditor).not.toHaveBeenCalled();
    expect(saveYear).not.toHaveBeenCalled();
  });

  it('defaults the review workspace to the first unresolved year', async () => {
    const buildWorkspaceReviewYearData = (year: number, blocked = false) => ({
      year,
      veetiId: 1,
      sourceStatus: blocked ? 'VEETI' : 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: !blocked,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: !blocked,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 90000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 20000,
              Poistot: 6000,
              LiiketoiminnanMuutKulut: 15000,
              TilikaudenYliJaama: 23000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: blocked
            ? [{ Tyyppi_Id: 1, Kayttomaksu: 2.3 }]
            : [
                { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
                { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
              ],
          effectiveRows: blocked
            ? [{ Tyyppi_Id: 1, Kayttomaksu: 2.3 }]
            : [
                { Tyyppi_Id: 1, Kayttomaksu: 2.3 },
                { Tyyppi_Id: 2, Kayttomaksu: 3.1 },
              ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 26000 }],
          effectiveRows: [{ Maara: 26000 }],
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

    const years = [
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'MIXED',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2023,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: ['missing_prices'],
        datasetCounts: {
          tilinpaatos: 1,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2022,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2021,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022, 2021],
        years,
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) =>
      buildWorkspaceReviewYearData(year, year === 2023),
    );

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

    expect(document.querySelector('[data-review-workspace-year="2023"]')).toBeTruthy();
    expect(document.querySelector('[data-review-workspace-year="2024"]')).toBeNull();
    expect(document.querySelector('[data-review-workspace-year="2022"]')).toBeNull();
    expect(document.querySelector('[data-review-workspace-year="2021"]')).toBeNull();
  });

  it('groups imported review years by readiness before the side-by-side workspace', async () => {
    const years = [
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'MIXED',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2023,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: ['missing_prices'],
        datasetCounts: {
          tilinpaatos: 1,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2022,
        completeness: {
          tilinpaatos: false,
          taksa: false,
          volume_vesi: false,
          volume_jatevesi: false,
          tariff_revenue: false,
        },
        baselineReady: false,
        baselineMissingRequirements: ['financialBaseline', 'prices', 'volumes'],
        baselineWarnings: [],
        sourceStatus: 'INCOMPLETE',
        sourceBreakdown: {
          veetiDataTypes: [],
          manualDataTypes: [],
        },
        warnings: ['missing_financials', 'missing_prices', 'missing_volumes'],
        datasetCounts: {},
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024, 2023, 2022],
        years,
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => {
      if (year === 2022) {
        return {
          year,
          veetiId: 1,
          sourceStatus: 'INCOMPLETE',
          completeness: {
            tilinpaatos: false,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
            tariff_revenue: false,
          },
          baselineReady: false,
          baselineMissingRequirements: ['financialBaseline', 'prices', 'volumes'],
          baselineWarnings: [],
          hasManualOverrides: false,
          hasVeetiData: false,
          datasets: [],
        } as any;
      }
      if (year === 2023) {
        return {
          year,
          veetiId: 1,
          sourceStatus: 'VEETI',
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          baselineReady: false,
          baselineMissingRequirements: ['prices'],
          baselineWarnings: [],
          hasManualOverrides: false,
          hasVeetiData: true,
          datasets: [
            {
              dataType: 'tilinpaatos',
              rawRows: [{ Liikevaihto: 91000, AineetJaPalvelut: 14000, Henkilostokulut: 20000, Poistot: 6000, LiiketoiminnanMuutKulut: 15000, TilikaudenYliJaama: 23000 }],
              effectiveRows: [{ Liikevaihto: 91000, AineetJaPalvelut: 14000, Henkilostokulut: 20000, Poistot: 6000, LiiketoiminnanMuutKulut: 15000, TilikaudenYliJaama: 23000 }],
              source: 'veeti',
              hasOverride: false,
              reconcileNeeded: false,
              overrideMeta: null,
            },
            {
              dataType: 'volume_vesi',
              rawRows: [{ Maara: 26000 }],
              effectiveRows: [{ Maara: 26000 }],
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
        } as any;
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
        baselineReady: true,
        baselineMissingRequirements: [],
        baselineWarnings: [],
        hasManualOverrides: false,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [{ Liikevaihto: 95000, AineetJaPalvelut: 14000, Henkilostokulut: 22000, Poistot: 5000, LiiketoiminnanMuutKulut: 18000, TilikaudenYliJaama: 25000 }],
            effectiveRows: [{ Liikevaihto: 95000, AineetJaPalvelut: 14000, Henkilostokulut: 22000, Poistot: 5000, LiiketoiminnanMuutKulut: 18000, TilikaudenYliJaama: 25000 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'taksa',
            rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }, { Tyyppi_Id: 2, Kayttomaksu: 3.1 }],
            effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }, { Tyyppi_Id: 2, Kayttomaksu: 3.1 }],
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
            rawRows: [{ Maara: 25000 }],
            effectiveRows: [{ Maara: 25000 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      } as any;
    });
    getPlanningContextV2.mockResolvedValueOnce(
      buildPlanningContextResponse({
        activePlan: {
          projectCount: 1,
          totalInvestmentAmount: 100000,
          baselineStatus: 'draft',
          pricingStatus: 'blocked',
        },
      }),
    );

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-review-group="good_to_go"]')).toBeTruthy();
    });

    expect(document.querySelector('[data-review-group="needs_filling"]')).toBeTruthy();
    expect(document.querySelector('[data-review-group="almost_nothing"]')).toBeTruthy();
    expect(
      document.querySelector('[data-review-group-year="good_to_go-2024"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-review-group-year="needs_filling-2023"]'),
    ).toBeTruthy();
    expect(
      document.querySelector('[data-review-group-year="almost_nothing-2022"]'),
    ).toBeTruthy();
  });

  it('focuses the review workspace on a single year when a review bucket chip is clicked', async () => {
    const years = [
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'MIXED',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: [],
        datasetCounts: {
          tilinpaatos: 1,
          taksa: 2,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
      {
        vuosi: 2023,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: ['tilinpaatos', 'volume_vesi', 'volume_jatevesi'],
          manualDataTypes: [],
        },
        warnings: ['missing_prices'],
        datasetCounts: {
          tilinpaatos: 1,
          volume_vesi: 1,
          volume_jatevesi: 1,
        },
        manualEditedAt: null,
        manualEditedBy: null,
        manualReason: null,
        manualProvenance: null,
      },
    ];

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024, 2023],
        years,
      }),
    );
    getImportYearDataV2.mockImplementation(async (year: number) => ({
      year,
      veetiId: 1,
      sourceStatus: year === 2024 ? 'MIXED' : 'VEETI',
      completeness: {
        tilinpaatos: true,
        taksa: year === 2024,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: year === 2024,
      hasVeetiData: true,
      datasets: [],
    }));

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

    await clickReviewGroupYear(2024);

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeTruthy();
    });
    expect(document.querySelector('[data-review-workspace-year="2023"]')).toBeNull();
  });

  it('keeps the lower review year card hidden until a year is explicitly opened', async () => {
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

    expect(document.querySelector('.v2-year-status-row')).toBeNull();

    fireEvent.click(
      await screen.findByRole('button', {
        name: `${localeText('v2Overview.fixYearValues')} 2023`,
      }),
    );

    await waitFor(() => {
      expect(document.querySelector('.v2-year-status-row')).toBeTruthy();
    });
    const workspaceYear = document.querySelector(
      '[data-review-workspace-year="2023"]',
    ) as HTMLElement | null;
    expect(workspaceYear).toBeTruthy();
    expect(
      within(workspaceYear!).queryByRole('button', {
        name: new RegExp(
          [
            localeText('v2Overview.fixYearValues'),
            localeText('v2Overview.openReviewYearButton'),
            localeText('v2Overview.documentImportAction'),
            localeText('v2Overview.workbookImportAction'),
          ].join('|'),
        ),
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', {
        name: localeText('v2Overview.reviewContinue'),
      }).className,
    ).toContain('v2-overview-review-continue-muted');
  });

  it('collapses a broadened review workspace back to the next unresolved year on Continue', async () => {
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
    expect(document.querySelector('[data-review-workspace-year="2023"]')).toBeTruthy();

    fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));

    await waitFor(() => {
      expect(
        document.querySelector('[data-review-workspace-year="2024"]'),
      ).toBeNull();
    });
    expect(document.querySelector('[data-review-workspace-year="2023"]')).toBeTruthy();
    expect(
      await screen.findByRole('button', {
        name: localeText('v2Overview.fixYearValues'),
      }),
    ).toBeTruthy();
  });

  it('uses readiness labels in year selection before import', async () => {
    getOverviewV2.mockResolvedValueOnce(
      buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            vuosi: 2024,
            completeness: {
              tilinpaatos: true,
              taksa: true,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: [],
            },
            warnings: [],
            datasetCounts: {
              tilinpaatos: 1,
              taksa: 2,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
          {
            vuosi: 2023,
            completeness: {
              tilinpaatos: true,
              taksa: false,
              volume_vesi: true,
              volume_jatevesi: true,
            },
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'volume_vesi', 'volume_jatevesi'],
              manualDataTypes: [],
            },
            warnings: ['missing_prices'],
            datasetCounts: {
              tilinpaatos: 1,
              volume_vesi: 1,
              volume_jatevesi: 1,
            },
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
      {
        vuosi: 2022,
        completeness: {
          tilinpaatos: false,
          taksa: false,
          volume_vesi: false,
          volume_jatevesi: false,
          tariff_revenue: false,
        },
        sourceStatus: 'INCOMPLETE',
        sourceBreakdown: {
          veetiDataTypes: [],
          manualDataTypes: [],
        },
        warnings: ['missing_financials', 'missing_prices', 'missing_volumes'],
        datasetCounts: {},
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
        ],
      }),
    );
    getPlanningContextV2.mockResolvedValueOnce(buildPlanningContextResponse());
    getImportYearDataV2.mockImplementation(async (year: number) => {
      if (year === 2022) {
        return {
          year,
          veetiId: 1,
          sourceStatus: 'INCOMPLETE',
          completeness: {
            tilinpaatos: false,
            taksa: false,
            volume_vesi: false,
            volume_jatevesi: false,
            tariff_revenue: false,
          },
          hasManualOverrides: false,
          hasVeetiData: false,
          datasets: [],
        } as any;
      }
      if (year === 2023) {
        return {
          year,
          veetiId: 1,
          sourceStatus: 'VEETI',
          completeness: {
            tilinpaatos: true,
            taksa: false,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          hasManualOverrides: false,
          hasVeetiData: true,
          datasets: [
            {
              dataType: 'tilinpaatos',
              rawRows: [{ Liikevaihto: 91000, AineetJaPalvelut: 14000, Henkilostokulut: 20000, Poistot: 6000, LiiketoiminnanMuutKulut: 15000, TilikaudenYliJaama: 23000 }],
              effectiveRows: [{ Liikevaihto: 91000, AineetJaPalvelut: 14000, Henkilostokulut: 20000, Poistot: 6000, LiiketoiminnanMuutKulut: 15000, TilikaudenYliJaama: 23000 }],
              source: 'veeti',
              hasOverride: false,
              reconcileNeeded: false,
              overrideMeta: null,
            },
            {
              dataType: 'volume_vesi',
              rawRows: [{ Maara: 26000 }],
              effectiveRows: [{ Maara: 26000 }],
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
        } as any;
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
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [{ Liikevaihto: 95000, AineetJaPalvelut: 14000, Henkilostokulut: 22000, Poistot: 5000, LiiketoiminnanMuutKulut: 18000, TilikaudenYliJaama: 25000 }],
            effectiveRows: [{ Liikevaihto: 95000, AineetJaPalvelut: 14000, Henkilostokulut: 22000, Poistot: 5000, LiiketoiminnanMuutKulut: 18000, TilikaudenYliJaama: 25000 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'taksa',
            rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }, { Tyyppi_Id: 2, Kayttomaksu: 3.1 }],
            effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }, { Tyyppi_Id: 2, Kayttomaksu: 3.1 }],
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
            rawRows: [{ Maara: 25000 }],
            effectiveRows: [{ Maara: 25000 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      } as any;
    });

    render(
      <OverviewPageV2
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
        isAdmin={true}
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: localeText('v2Overview.reviewBucketRepairTitle'),
      }),
    ).toBeTruthy();
  });

  it('shows missing VEETI raw values in the pinned workspace instead of fake zeroes', async () => {
    const readyYear = {
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      sourceStatus: 'MIXED',
      sourceBreakdown: {
        veetiDataTypes: ['tilinpaatos'],
        manualDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
      },
      warnings: [],
      datasetCounts: {
        tilinpaatos: 1,
        taksa: 2,
        volume_vesi: 1,
        volume_jatevesi: 1,
      },
      manualEditedAt: '2026-03-08T10:00:00.000Z',
      manualEditedBy: 'tester',
      manualReason: 'Prices and volumes patched from evidence file',
      manualProvenance: {
        kind: 'document_import',
        fileName: 'source-2024.pdf',
        pageNumber: 2,
        confidence: 84,
        matchedFields: ['waterUnitPrice', 'soldWaterVolume'],
      },
    };

    getOverviewV2.mockResolvedValue(
      buildOverviewResponse({
        workspaceYears: [2024],
        years: [readyYear],
      }),
    );
    getImportYearDataV2.mockResolvedValue({
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
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          effectiveRows: [
            {
              Liikevaihto: 95000,
              PerusmaksuYhteensa: 12000,
              AineetJaPalvelut: 14000,
              Henkilostokulut: 22000,
              Poistot: 5000,
              LiiketoiminnanMuutKulut: 18000,
              TilikaudenYliJaama: 25000,
            },
          ],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [],
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
          rawRows: [],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [],
          effectiveRows: [{ Maara: 24500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
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

    const workspace = document.querySelector(
      '.v2-overview-year-workspace',
    ) as HTMLElement | null;
    expect(workspace).toBeTruthy();
    expect(workspace?.textContent).toContain(localeText('v2Overview.previewMissingValue'));
    expect(workspace?.textContent).toContain('VEETI');
    expect(workspace?.textContent).not.toContain('VEETI: 0.00');
    expect(workspace?.textContent).not.toContain('VEETI0.00');
  });
  });
}
