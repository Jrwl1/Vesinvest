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
import {
  getPreviewPrefetchYears,
  pickDefaultBaselineYears,
} from '../../overviewSelectors';
import { buildImportYearSummaryRows } from '../../yearReview';
import {
  getExactEditedFieldLabels,
  useOverviewSetupState,
} from '../../useOverviewSetupState';
import { useOverviewImportController } from '../../useOverviewImportController';
export function registerOverviewReviewFlowSummarySuite() {
  describe('OverviewPageV2 review flow', () => {
    beforeEach(() => {
      resetOverviewTestState();
    });

    afterEach(() => {
      cleanup();
    });

    it('renders the extracted baseline and handoff panels with stable summary actions', () => {
      const onCreatePlanningBaseline = vi.fn();
      const onOpenForecast = vi.fn();
      const onManageYears = vi.fn();
      const onReopenYearReview = vi.fn();
      const onDeleteYear = vi.fn();
      const onExcludeYear = vi.fn();
      const onRestoreYear = vi.fn();
      const onRestoreVeeti = vi.fn();
      const renderYearValuePreview = vi.fn(() => (
        <div>{localeText('v2Overview.previewAccountingRevenueLabel')}</div>
      ));

      const { rerender } = render(
        <OverviewPlanningBaselineStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep3')}
          onBack={() => undefined}
          includedPlanningYears={[2024]}
          excludedYearsSorted={[2022]}
          correctedPlanningYears={[2024, 2022]}
          correctedPlanningManualDataTypes={['tilinpaatos']}
          correctedPlanningVeetiDataTypes={['taksa']}
          correctedYearsLabel="2024"
          includedPlanningYearsLabel="2024"
          renderDatasetTypeList={(values) => values.join(', ')}
          planningBaselineButtonClass="v2-btn v2-btn-primary"
          onCreatePlanningBaseline={onCreatePlanningBaseline}
          creatingPlanningBaseline={false}
          importedBlockedYearCount={0}
          isAdmin={true}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.createPlanningBaseline'),
        }),
      );
      expect(onCreatePlanningBaseline).toHaveBeenCalled();
      expect(screen.getAllByText('2024').length).toBeGreaterThan(0);
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.wizardBackStep3'),
        }),
      ).toBeNull();

      rerender(
        <OverviewPlanningBaselineStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep3')}
          onBack={() => undefined}
          includedPlanningYears={[]}
          excludedYearsSorted={[2022]}
          correctedPlanningYears={[]}
          correctedPlanningManualDataTypes={[]}
          correctedPlanningVeetiDataTypes={[]}
          correctedYearsLabel={localeText('v2Overview.noYearsSelected')}
          includedPlanningYearsLabel={localeText('v2Overview.noYearsSelected')}
          renderDatasetTypeList={(values) => values.join(', ')}
          planningBaselineButtonClass="v2-btn v2-btn-primary"
          onCreatePlanningBaseline={onCreatePlanningBaseline}
          creatingPlanningBaseline={false}
          importedBlockedYearCount={0}
          isAdmin={true}
        />,
      );

      expect(
        (
          screen.getByRole('button', {
            name: localeText('v2Overview.createPlanningBaseline'),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(
        screen.getByText(localeText('v2Overview.wizardBaselinePendingHint')),
      ).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.baselineReadyHint')),
      ).toBeNull();

      rerender(
        <OverviewPlanningBaselineStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep3')}
          onBack={() => undefined}
          includedPlanningYears={[2024]}
          excludedYearsSorted={[]}
          correctedPlanningYears={[]}
          correctedPlanningManualDataTypes={[]}
          correctedPlanningVeetiDataTypes={[]}
          correctedYearsLabel={localeText('v2Overview.noYearsSelected')}
          includedPlanningYearsLabel="2024"
          renderDatasetTypeList={(values) => values.join(', ')}
          planningBaselineButtonClass="v2-btn v2-btn-primary"
          onCreatePlanningBaseline={onCreatePlanningBaseline}
          creatingPlanningBaseline={false}
          importedBlockedYearCount={0}
          isAdmin={false}
        />,
      );

      expect(
        screen.getByText(localeText('v2Overview.adminOnlyBaselineHint')),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.createPlanningBaseline'),
        }),
      ).toBeNull();

      rerender(
        <OverviewForecastHandoffStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep5')}
          onBack={() => undefined}
          acceptedPlanningYearRows={[
            {
              vuosi: 2024,
              sourceStatus: 'MIXED',
              datasetCounts: { tilinpaatos: 1 },
              resultToZero: {
                rawValue: 0,
                effectiveValue: 0,
                delta: 0,
                absoluteGap: 0,
                marginPct: 0,
                direction: 'at_zero',
              },
              sourceLayers: [
                {
                  key: 'financials',
                  source: 'manual',
                  provenanceKind: 'statement_import',
                  provenanceKinds: ['statement_import'],
                  fileName: 'kronoby-2024.pdf',
                },
              ],
              completeness: {
                tilinpaatos: true,
                taksa: true,
                volume_vesi: true,
                volume_jatevesi: true,
              },
            },
          ]}
          correctedPlanningYears={[2024]}
          excludedYearsSorted={[2022]}
          sourceStatusClassName={() => 'v2-status-provenance'}
          sourceStatusLabel={() => 'Mixed'}
          renderDatasetCounts={() => '1 dataset'}
          renderYearValuePreview={renderYearValuePreview}
          openForecastButtonClass="v2-btn v2-btn-primary"
          isAdmin={true}
          onManageYears={onManageYears}
          onReopenYearReview={onReopenYearReview}
          onDeleteYear={onDeleteYear}
          onExcludeYear={onExcludeYear}
          onRestoreYear={onRestoreYear}
          onRestoreVeeti={onRestoreVeeti}
          onOpenForecast={onOpenForecast}
        />,
      );

      const managementRow = screen
        .getByRole('button', {
          name: localeText('v2Overview.openAssetManagement'),
        })
        .closest('.v2-overview-handoff-management-row') as HTMLElement;
      const reopenReviewButtons = screen.getAllByRole('button', {
        name: localeText('v2Overview.reopenReview'),
      });

      expect(
        within(managementRow).queryByRole('button', {
          name: localeText('v2Overview.manageYears'),
        }),
      ).toBeNull();
      expect(onManageYears).not.toHaveBeenCalled();
      expect(reopenReviewButtons).toHaveLength(1);
      expect(reopenReviewButtons[0]!.closest('.v2-actions-row')).toBe(
        document.querySelector('.v2-overview-handoff-year-primary-actions'),
      );
      expect(
        document.querySelectorAll('.v2-overview-handoff-summary-item'),
      ).toHaveLength(3);
      expect(
        document.querySelectorAll('.v2-overview-handoff-summary-item strong')[1]
          ?.textContent,
      ).toBe('1');
      expect(
        document.querySelectorAll('.v2-overview-year-chip-row > span'),
      ).toHaveLength(1);
      expect(
        document.querySelector('.v2-overview-handoff-year-actions-shell'),
      ).toBeTruthy();
      expect(
        screen
          .getByText(localeText('v2Overview.moreActions'))
          .closest('details'),
      ).toBe(document.querySelector('.v2-overview-handoff-year-actions-shell'));
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.manualCorrection'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.repairFromExcel'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.repairFromPdf'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.uploadEvidenceFile'),
        }),
      ).toBeTruthy();
      expect(renderYearValuePreview).toHaveBeenCalledWith(
        2024,
        {
          financials: true,
          prices: true,
          volumes: true,
        },
        { compact: true },
      );
      fireEvent.click(reopenReviewButtons[0]!);
      expect(onReopenYearReview).toHaveBeenCalledWith(2024);
      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.restoreVeetiValues'),
        }),
      );
      expect(onRestoreVeeti).toHaveBeenCalledWith(2024);
      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.excludeYear'),
        }),
      );
      expect(onExcludeYear).toHaveBeenCalledWith(2024);
      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.restoreYearToPlan'),
        }),
      );
      expect(onRestoreYear).toHaveBeenCalledWith(2022);
      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.openAssetManagement'),
        }),
      );
      expect(onOpenForecast).toHaveBeenCalled();
      expect(screen.getByText(/1 dataset/)).toBeTruthy();
      expect(
        screen.getAllByText(
          localeText('v2Overview.previewAccountingRevenueLabel'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(localeText('v2Overview.yearTargetStatusAtZero')),
      ).toBeTruthy();
      expect(
        screen.getByText(
          localeText('v2Overview.datasetSourceStatementImport', {
            fileName: 'kronoby-2024.pdf',
          }),
        ),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.wizardBackStep5'),
        }),
      ).toBeNull();
    });

    it('keeps accepted-baseline repair and restore actions admin-only', () => {
      const onReopenYearReview = vi.fn();
      const onExcludeYear = vi.fn();
      const onRestoreYear = vi.fn();
      const onRestoreVeeti = vi.fn();
      const onOpenForecast = vi.fn();

      render(
        <OverviewForecastHandoffStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep5')}
          onBack={() => undefined}
          acceptedPlanningYearRows={[
            {
              vuosi: 2024,
              sourceStatus: 'MIXED',
              datasetCounts: { tilinpaatos: 1 },
              resultToZero: {
                rawValue: 0,
                effectiveValue: 0,
                delta: 0,
                absoluteGap: 0,
                marginPct: 0,
                direction: 'at_zero',
              },
              sourceLayers: undefined,
              completeness: {
                tilinpaatos: true,
                taksa: true,
                volume_vesi: true,
                volume_jatevesi: true,
              },
            },
          ]}
          correctedPlanningYears={[2024]}
          excludedYearsSorted={[2022]}
          sourceStatusClassName={() => 'v2-status-provenance'}
          sourceStatusLabel={() => 'Mixed'}
          renderDatasetCounts={() => '1 dataset'}
          renderYearValuePreview={() => <div>preview</div>}
          openForecastButtonClass="v2-btn v2-btn-primary"
          isAdmin={false}
          onManageYears={() => undefined}
          onReopenYearReview={onReopenYearReview}
          onDeleteYear={() => undefined}
          onExcludeYear={onExcludeYear}
          onRestoreYear={onRestoreYear}
          onRestoreVeeti={onRestoreVeeti}
          onOpenForecast={onOpenForecast}
        />,
      );

      expect(
        screen.getByText(localeText('v2Overview.adminOnlyBaselineHint')),
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: localeText('v2Overview.openAssetManagement'),
        }),
      ).toBeTruthy();
      expect(
        screen.getByText(localeText('v2Overview.viewDetails')),
      ).toBeTruthy();
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.reopenReview'),
        }),
      ).toBeNull();
      expect(
        screen.queryByText(localeText('v2Overview.moreActions')),
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.restoreYearToPlan'),
        }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.excludeYear'),
        }),
      ).toBeNull();

      fireEvent.click(
        screen.getByRole('button', {
          name: localeText('v2Overview.openAssetManagement'),
        }),
      );
      expect(onOpenForecast).toHaveBeenCalledTimes(1);
      expect(onReopenYearReview).not.toHaveBeenCalled();
      expect(onRestoreVeeti).not.toHaveBeenCalled();
      expect(onExcludeYear).not.toHaveBeenCalled();
      expect(onRestoreYear).not.toHaveBeenCalled();
    });

    it('keeps mixed accepted years labeled with the caller status when compact provenance layers are missing', () => {
      render(
        <OverviewForecastHandoffStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep5')}
          onBack={() => undefined}
          acceptedPlanningYearRows={[
            {
              vuosi: 2024,
              sourceStatus: 'MIXED',
              datasetCounts: { tilinpaatos: 1 },
              resultToZero: {
                rawValue: 0,
                effectiveValue: 0,
                delta: 0,
                absoluteGap: 0,
                marginPct: 0,
                direction: 'at_zero',
              },
              sourceLayers: undefined,
              completeness: {
                tilinpaatos: true,
                taksa: true,
                volume_vesi: true,
                volume_jatevesi: true,
              },
            },
          ]}
          correctedPlanningYears={[]}
          excludedYearsSorted={[]}
          sourceStatusClassName={() => 'v2-status-provenance'}
          sourceStatusLabel={() => 'Mixed'}
          renderDatasetCounts={() => '1 dataset'}
          renderYearValuePreview={() => null}
          openForecastButtonClass="v2-btn v2-btn-primary"
          isAdmin={true}
          onManageYears={() => undefined}
          onReopenYearReview={() => undefined}
          onDeleteYear={() => undefined}
          onExcludeYear={() => undefined}
          onRestoreYear={() => undefined}
          onRestoreVeeti={() => undefined}
          onOpenForecast={() => undefined}
        />,
      );

      expect(screen.getByText('Mixed')).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.sourceManual')),
      ).toBeNull();
    });

    it('disables review continue and shows the empty-state footer when only excluded years remain', () => {
      render(
        <OverviewReviewBoard
          t={translate as any}
          wizardBackLabel={null}
          onBack={() => undefined}
          reviewStatusRows={
            [
              {
                year: 2024,
                sourceStatus: undefined,
                completeness: {
                  tilinpaatos: false,
                  taksa: false,
                  tariff_revenue: false,
                  volume_vesi: false,
                  volume_jatevesi: false,
                },
                readinessChecks: [],
                missingRequirements: [],
                warnings: [],
                setupStatus: 'excluded_from_plan',
              },
            ] as any
          }
          yearDataCache={{}}
          cardEditContext={null}
          cardEditYear={null}
          manualPatchYear={null}
          renderYearValuePreview={() => null}
          sourceStatusClassName={() => 'v2-status-info'}
          sourceStatusLabel={() => 'VEETI'}
          setupStatusClassName={() => 'v2-status-info'}
          setupStatusLabel={() => 'Utesluten fr\u00e5n planen'}
          yearStatusRowClassName={() => 'excluded'}
          importWarningLabel={() => ''}
          missingRequirementLabel={() => 'Baseline economics'}
          isAdmin={true}
          buildRepairActions={() => []}
          openInlineCardEditor={() => undefined}
          saveReviewWorkspaceYear={async () =>
            ({ syncReady: false, yearData: {} as any } as any)
          }
          manualPatchMode={'review' as any}
          manualPatchBusy={false}
          manualPatchError={null}
          documentImportBusy={false}
          documentImportStatus={null}
          documentImportError={null}
          documentImportPreview={null}
          documentImportReviewedKeys={[]}
          handleSelectDocumentImportMatch={() => undefined}
          isCurrentYearReadyForReview={false}
          isManualYearExcluded={true}
          canReapplyFinancialVeetiForYear={false}
          canReapplyPricesForYear={false}
          canReapplyVolumesForYear={false}
          keepYearButtonClass="v2-btn"
          fixYearButtonClass="v2-btn"
          handleKeepCurrentYearValues={() => undefined}
          handleSwitchToManualEditMode={() => undefined}
          handleSwitchToDocumentImportMode={() => undefined}
          handleSwitchToWorkbookImportMode={() => undefined}
          handleRestoreManualYearToPlan={() => undefined}
          handleExcludeManualYearFromPlan={() => undefined}
          handleModalApplyVeetiFinancials={() => undefined}
          handleModalApplyVeetiPrices={() => undefined}
          handleModalApplyVeetiVolumes={() => undefined}
          closeInlineCardEditor={() => undefined}
          workbookImportBusy={false}
          canConfirmImportWorkflow={false}
          isInlineCardDirty={false}
          documentFileInputRef={{ current: null }}
          setInlineCardFieldRef={() => () => undefined}
          manualFinancials={{} as any}
          setManualFinancials={() => undefined}
          manualPrices={{} as any}
          setManualPrices={() => undefined}
          manualVolumes={{} as any}
          setManualVolumes={() => undefined}
          markManualFieldTouched={() => undefined}
          saveInlineCardEdit={() => undefined}
          workbookImportWorkflowProps={{} as any}
          reviewContinueButtonClass="v2-btn v2-btn-primary"
          onContinueFromReview={() => undefined}
          importedBlockedYearCount={0}
          pendingReviewYearCount={0}
          technicalReadyYearsLabel=""
        />,
      );

      expect(
        screen.getByText(localeText('v2Overview.noYearsSelected')),
      ).toBeTruthy();
      expect(
        (
          screen.getByRole('button', {
            name: localeText('v2Overview.reviewContinue'),
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    it('keeps workbook-backed accepted baseline years compact in the handoff panel', () => {
      const renderYearValuePreview = vi.fn(() => <div>preview</div>);

      render(
        <OverviewForecastHandoffStep
          t={translate as any}
          wizardBackLabel={localeText('v2Overview.wizardBackStep5')}
          onBack={() => undefined}
          acceptedPlanningYearRows={[
            {
              vuosi: 2024,
              sourceStatus: 'MANUAL',
              baselineReady: true,
              baselineMissingRequirements: [],
              completeness: {
                tilinpaatos: false,
                taksa: true,
                volume_vesi: true,
                volume_jatevesi: false,
              },
            },
          ]}
          correctedPlanningYears={[2024]}
          excludedYearsSorted={[]}
          sourceStatusClassName={() => 'v2-status-provenance'}
          sourceStatusLabel={() => 'Manual'}
          renderDatasetCounts={() => '1 dataset'}
          renderYearValuePreview={renderYearValuePreview}
          openForecastButtonClass="v2-btn v2-btn-primary"
          isAdmin={true}
          onManageYears={() => undefined}
          onReopenYearReview={() => undefined}
          onDeleteYear={() => undefined}
          onExcludeYear={() => undefined}
          onRestoreYear={() => undefined}
          onRestoreVeeti={() => undefined}
          onOpenForecast={() => undefined}
        />,
      );

      expect(renderYearValuePreview).toHaveBeenCalledWith(
        2024,
        {
          financials: true,
          prices: true,
          volumes: true,
        },
        { compact: true },
      );
      expect(screen.getByText('2024')).toBeTruthy();
      expect(screen.getByText(/1 dataset/)).toBeTruthy();
      expect(screen.getAllByText('preview').length).toBeGreaterThan(0);
    });

    it('builds the shared import-year accounting summary from current raw and effective data', () => {
      const rows = buildImportYearSummaryRows({
        year: 2024,
        veetiId: 1,
        sourceStatus: 'MIXED',
        completeness: {},
        hasManualOverrides: true,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 95000,
                AineetJaPalvelut: 18000,
                Henkilostokulut: 22000,
                Poistot: 5000,
                LiiketoiminnanMuutKulut: 12000,
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
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: null,
          },
        ],
      } as any);

      expect(rows).toEqual([
        expect.objectContaining({
          key: 'revenue',
          sourceField: 'Liikevaihto',
          rawValue: 95000,
          effectiveValue: 100000,
          rawSource: 'direct',
          effectiveSource: 'direct',
        }),
        expect.objectContaining({
          key: 'materialsCosts',
          sourceField: 'AineetJaPalvelut',
          rawValue: 18000,
          effectiveValue: 15000,
          rawSource: 'direct',
          effectiveSource: 'direct',
        }),
        expect.objectContaining({
          key: 'personnelCosts',
          sourceField: 'Henkilostokulut',
          rawValue: 22000,
          effectiveValue: 21000,
        }),
        expect.objectContaining({
          key: 'depreciation',
          sourceField: 'Poistot',
          rawValue: 5000,
          effectiveValue: 6500,
        }),
        expect.objectContaining({
          key: 'otherOperatingCosts',
          sourceField: 'LiiketoiminnanMuutKulut',
          rawValue: 12000,
          effectiveValue: 19000,
          rawSource: 'direct',
          effectiveSource: 'direct',
        }),
        expect.objectContaining({
          key: 'result',
          sourceField: 'TilikaudenYliJaama',
          rawValue: 25000,
          effectiveValue: 30000,
          rawSource: 'direct',
          effectiveSource: 'direct',
        }),
      ]);
    });

    it('keeps the summary contract direct when materials rows are missing', () => {
      const rows = buildImportYearSummaryRows({
        year: 2023,
        veetiId: 1,
        sourceStatus: 'VEETI',
        completeness: {},
        hasManualOverrides: false,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [{ LiiketoiminnanMuutKulut: 100 }],
            effectiveRows: [{ LiiketoiminnanMuutKulut: 80 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      } as any);

      expect(rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: 'materialsCosts',
            sourceField: 'AineetJaPalvelut',
            rawValue: null,
            effectiveValue: null,
            rawSource: 'missing',
            effectiveSource: 'missing',
          }),
          expect.objectContaining({
            key: 'otherOperatingCosts',
            sourceField: 'LiiketoiminnanMuutKulut',
            rawValue: 100,
            effectiveValue: 80,
            rawSource: 'direct',
            effectiveSource: 'direct',
          }),
          expect.objectContaining({
            key: 'depreciation',
            sourceField: 'Poistot',
            rawValue: null,
            effectiveValue: null,
            rawSource: 'missing',
            effectiveSource: 'missing',
          }),
          expect.objectContaining({
            key: 'result',
            sourceField: 'TilikaudenYliJaama',
            rawValue: null,
            effectiveValue: null,
            rawSource: 'missing',
            effectiveSource: 'missing',
          }),
        ]),
      );
    });

    it.skip('renders the wizard summary and focused year-status review step', async () => {
      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(await screen.findByText('Valmis ennustamiseen?')).toBeTruthy();
      expect(screen.getByText('Setup summary')).toBeTruthy();
      expect(screen.getByText('Selected company')).toBeTruthy();
      expect(screen.getByText('Imported years')).toBeTruthy();
      expect(screen.getByText('Baseline ready')).toBeTruthy();
      expect(
        await screen.findByText('Mitkä vuodet ovat käyttövalmiita?'),
      ).toBeTruthy();
      expect(screen.getByText('Valmis')).toBeTruthy();
      expect(screen.getByText('Korjattava')).toBeTruthy();
      expect(screen.getAllByText('Tilinpäätös').length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(localeText('v2Overview.previewWaterPriceLabel'))
          .length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(localeText('v2Overview.previewWaterVolumeLabel'))
          .length,
      ).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
      expect(screen.getByText('Imported workspace years')).toBeTruthy();
      expect(
        screen.getByText('Imported workspace years: 2024, 2023.'),
      ).toBeTruthy();
      expect(screen.getByText('Step 4 decisions')).toBeTruthy();
      expect(
        screen.getByText(
          '1 year still needs a decision before baseline creation.',
        ),
      ).toBeTruthy();
      expect(screen.queryByText('Selected year')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Trend view' })).toBeNull();
      expect(screen.queryByText('Peer snapshot')).toBeNull();
      expect(
        screen.queryByText('Operations and compliance context'),
      ).toBeNull();
      expect(
        screen.queryByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
      ).toBeNull();
    });

    it('renders the wizard summary and focused year-status review step', async () => {
      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(await screen.findByRole('button', { name: 'Jatka' })).toBeTruthy();
      await openYearDecisionWorkspaceYear(2024);
      expect(
        screen.getAllByText(localeText('v2Overview.wizardSummaryTitle')).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          localeText('v2Overview.wizardProgress', { step: 2, total: 5 }),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(localeText('v2Overview.wizardSummarySubtitle'))
          .length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(localeText('v2Overview.organizationLabel')),
      ).toBeTruthy();
      expect(
        screen.getAllByText(localeText('v2Overview.selectedYearsLabel')).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getByText(localeText('v2Overview.wizardSummaryReadyYears')),
      ).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.wizardSummaryBaselineReady')),
      ).toBeNull();
      expect(
        screen.getByText(localeText('v2Overview.wizardBodyReviewYears')),
      ).toBeTruthy();
      expect(
        screen.getByText(localeText('v2Overview.reviewBucketReadyTitle')),
      ).toBeTruthy();
      expect(
        document.querySelector(
          '[data-review-group="almost_nothing"], [data-review-group="needs_filling"], [data-review-group="excluded"]',
        ),
      ).toBeTruthy();
      expect(
        screen.getAllByText(
          localeText('v2Overview.setupStatusTechnicalReadyHint'),
        ).length,
      ).toBeGreaterThan(0);
      expect((await screen.findAllByText(/Muokattu:/i)).length).toBeGreaterThan(
        0,
      );
      expect(
        screen.queryByText(/Tilinpäätöskorjaus muutti VEETI-rivejä/i),
      ).toBeNull();
      expect(document.body.textContent).not.toContain('Tulos / 0:');
      expect(document.body.textContent).not.toContain('Resultat / 0:');
      expect(document.body.textContent).not.toContain('Result / 0:');
      expect(document.body.textContent).not.toContain('Tulos on ylijäämäinen');
      expect(document.body.textContent).not.toContain('Tulos on alijäämäinen');
      expect(
        screen.queryByText(
          localeText('v2Overview.yearResultExplicitFieldNote'),
        ),
      ).toBeNull();
      expect(screen.getAllByText(/Tilin/i).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          localeText('v2Overview.previewAccountingRevenueLabel'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          localeText('v2Overview.previewAccountingMaterialsLabel'),
        ).length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(
          localeText('v2Overview.previewAccountingResultLabel'),
        ).length,
      ).toBeGreaterThan(0);
      expect(screen.getAllByText(/100.?000 EUR/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/30.?000 EUR/).length).toBeGreaterThan(0);
      expect(
        screen.getByText(
          localeText('v2Overview.setupStatusTechnicalReadyHint'),
        ),
      ).toBeTruthy();
      expect(
        screen.getAllByText(localeText('v2Overview.previewWaterPriceLabel'))
          .length,
      ).toBeGreaterThan(0);
      expect(
        screen.getAllByText(localeText('v2Overview.previewWaterVolumeLabel'))
          .length,
      ).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: 'Jatka' })).toBeTruthy();
      expect(
        screen.getAllByText(localeText('v2Overview.noYearsSelected')).length,
      ).toBeGreaterThan(0);
      expect(
        screen.queryByRole('button', { name: /Avaa ja tarkista/ }),
      ).toBeNull();
      expect(screen.queryByText('Selected year')).toBeNull();
      expect(screen.queryByRole('group', { name: 'Trend view' })).toBeNull();
      expect(screen.queryByText('Peer snapshot')).toBeNull();
      expect(
        screen.queryByText('Operations and compliance context'),
      ).toBeNull();
      expect(
        screen.queryByPlaceholderText(
          localeText('v2Overview.searchPlaceholder'),
        ),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Tuo valitut vuodet' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Luo suunnittelupohja' }),
      ).toBeNull();
      expect(screen.queryByText('Valmis ennustamiseen?')).toBeNull();
      expect(
        screen.queryByRole('textbox', {
          name: localeText('v2Overview.starterScenarioName'),
        }),
      ).toBeNull();
    });

    it('keeps the ready-years summary honest before explicit review decisions', async () => {
      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      const readySummary = await findSupportStatusItem(
        localeText('v2Overview.wizardSummaryReadyYears'),
      );
      expect(within(readySummary).getByText('0')).toBeTruthy();
      expect(
        within(readySummary).getByText(
          localeText('v2Overview.noYearsSelected'),
        ),
      ).toBeTruthy();
    });

    it('keeps the step-1 focus truthful when no utility is connected', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
        years: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
        }),
      );

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByText(localeText('v2Overview.wizardCurrentFocus')),
      ).toBeTruthy();
      const focusBlock = screen
        .getByText(localeText('v2Overview.wizardCurrentFocus'))
        .closest('.v2-overview-support-next-copy') as HTMLElement;
      expect(
        within(focusBlock).getByText(
          localeText('v2Vesinvest.workflowPlanFirst'),
        ),
      ).toBeTruthy();
    });

    it('keeps the rendered year-review focus truthful when blocked review rows remain', async () => {
      const currentYear = new Date().getFullYear();
      const templateYear = buildOverviewResponse().importStatus.years[0];
      const initialOverview = buildOverviewResponse({
        workspaceYears: [],
        years: [
          {
            ...templateYear,
            vuosi: currentYear,
            planningRole: 'current_year_estimate',
            completeness: {
              tilinpaatos: true,
              taksa: false,
              volume_vesi: true,
              volume_jatevesi: false,
            },
            baselineReady: false,
            baselineMissingRequirements: ['prices'],
            baselineWarnings: [],
            sourceStatus: 'VEETI',
            sourceBreakdown: {
              veetiDataTypes: ['tilinpaatos', 'volume_vesi'],
              manualDataTypes: [],
            },
            warnings: ['missing_prices'],
            manualEditedAt: null,
            manualEditedBy: null,
            manualReason: null,
            manualProvenance: null,
          },
        ],
      });
      const importedOverview = buildOverviewResponse({
        workspaceYears: [currentYear],
        years: initialOverview.importStatus.years,
      });
      getOverviewV2
        .mockResolvedValueOnce(initialOverview)
        .mockResolvedValue(importedOverview);
      importYearsV2.mockResolvedValueOnce({
        selectedYears: [currentYear],
        importedYears: [currentYear],
        skippedYears: [],
        sync: {
          linked: {
            orgId: 'org-1',
            veetiId: 1535,
            nimi: 'Water Utility',
            ytunnus: '1234567-8',
          },
          fetchedAt: '2026-03-08T10:00:00.000Z',
          years: [currentYear],
          snapshotUpserts: 1,
        },
        status: importedOverview.importStatus,
      });

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      await openCurrentYearEstimateLane();
      fireEvent.click(
        await screen.findByRole('button', {
          name: localeText('v2Overview.currentYearEstimateAction'),
        }),
      );

      await waitFor(() => {
        expect(importYearsV2).toHaveBeenCalledWith([currentYear]);
      });
      fireEvent.click(
        await screen.findByRole('button', {
          name: localeText('v2Overview.fixYearValues'),
        }),
      );
      expect(
        await screen.findByText(localeText('v2Overview.wizardQuestionFixYear')),
      ).toBeTruthy();

      expect(
        screen.queryByText(localeText('v2Overview.wizardCurrentFocus')),
      ).toBeNull();
      expect(
        document.querySelector('.v2-overview-support-next-copy'),
      ).toBeNull();
    });

    it('does not fall back to the step-1 connect state when an active asset-management plan already carries utility identity', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
        years: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: true,
          activePlan: {
            utilityName: 'Kronoby vatten och avlopp ab',
            businessId: '0180030-9',
            veetiId: 1535,
            identitySource: 'veeti',
            baselineStatus: 'verified',
            pricingStatus: 'blocked',
            selectedScenarioId: null,
            projectCount: 0,
            totalInvestmentAmount: 0,
            status: 'active',
          },
          baselineYears: [
            {
              year: 2024,
              quality: 'complete',
              sourceStatus: 'VEETI',
              sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
              financials: { dataType: 'tilinpaatos', source: 'veeti' },
              prices: { dataType: 'taksa', source: 'veeti' },
              volumes: { dataType: 'volume_vesi', source: 'veeti' },
              investmentAmount: 0,
              soldWaterVolume: 0,
              soldWastewaterVolume: 0,
              combinedSoldVolume: 0,
              processElectricity: 0,
              pumpedWaterVolume: 0,
              waterBoughtVolume: 0,
              waterSoldVolume: 0,
              netWaterTradeVolume: 0,
            },
          ],
        }),
      );

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByRole('heading', {
          name: localeText('v2Overview.wizardQuestionBaseline'),
        }),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        screen.queryByRole('heading', {
          name: localeText('v2Vesinvest.workflowIdentifyUtility'),
        }),
      ).toBeNull();
    });

    it('does not fall back to the step-1 connect state when only the selected asset-management plan carries utility identity', async () => {
      const disconnectedOverview = buildOverviewResponse({
        workspaceYears: [],
        years: [],
      });
      disconnectedOverview.importStatus.connected = false;
      disconnectedOverview.importStatus.link = null;
      disconnectedOverview.importStatus.availableYears = [];
      disconnectedOverview.importStatus.years = [];
      disconnectedOverview.importStatus.excludedYears = [];
      getOverviewV2.mockResolvedValueOnce(disconnectedOverview);
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: true,
          activePlan: null,
          selectedPlan: {
            utilityName: 'Kronoby vatten och avlopp ab',
            businessId: '0180030-9',
            veetiId: 1535,
            identitySource: 'veeti',
            baselineStatus: 'verified',
            pricingStatus: 'blocked',
            selectedScenarioId: null,
            projectCount: 0,
            totalInvestmentAmount: 0,
            status: 'draft',
          },
          baselineYears: [
            {
              year: 2024,
              quality: 'complete',
              sourceStatus: 'VEETI',
              sourceBreakdown: { veetiDataTypes: [], manualDataTypes: [] },
              financials: { dataType: 'tilinpaatos', source: 'veeti' },
              prices: { dataType: 'taksa', source: 'veeti' },
              volumes: { dataType: 'volume_vesi', source: 'veeti' },
              investmentAmount: 0,
              soldWaterVolume: 0,
              soldWastewaterVolume: 0,
              combinedSoldVolume: 0,
              processElectricity: 0,
              pumpedWaterVolume: 0,
              waterBoughtVolume: 0,
              waterSoldVolume: 0,
              netWaterTradeVolume: 0,
            },
          ],
        }),
      );

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByRole('heading', {
          name: localeText('v2Overview.wizardQuestionBaseline'),
        }),
      ).toBeTruthy();
      expect(screen.queryByTestId('vesinvest-panel')).toBeNull();
      expect(
        screen.queryByRole('heading', {
          name: localeText('v2Vesinvest.workflowIdentifyUtility'),
        }),
      ).toBeNull();
    });

    it('does not label a year plausible when the core cost structure is missing', async () => {
      const incompleteYear = {
        vuosi: 2015,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: [
            'tilinpaatos',
            'taksa',
            'volume_vesi',
            'volume_jatevesi',
          ],
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
      };
      getOverviewV2.mockResolvedValueOnce(
        buildOverviewResponse({ workspaceYears: [], years: [incompleteYear] }),
      );
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
        }),
      );
      getImportYearDataV2.mockImplementationOnce(async (year: number) => ({
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
            rawRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
            effectiveRows: [
              { Liikevaihto: 578662, TilikaudenYliJaama: -15995 },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'taksa',
            rawRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
            ],
            effectiveRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'volume_vesi',
            rawRows: [{ Maara: 80121 }],
            effectiveRows: [{ Maara: 80121 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'volume_jatevesi',
            rawRows: [{ Maara: 0 }],
            effectiveRows: [{ Maara: 0 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      }));

      render(
        <OverviewPageV2
          onGoToForecast={() => undefined}
          onGoToReports={() => undefined}
          isAdmin={true}
        />,
      );

      expect(
        await screen.findByText(localeText('v2Overview.trustMissingKeyCosts')),
      ).toBeTruthy();
      expect(
        screen.queryByText(localeText('v2Overview.trustLooksPlausible')),
      ).toBeNull();
    });

    it('treats imported years with missing canon finance rows as needs attention in step 3', async () => {
      const incompleteImportedYear = {
        vuosi: 2015,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        baselineReady: false,
        baselineMissingRequirements: ['financialBaseline'],
        baselineWarnings: [],
        sourceStatus: 'VEETI',
        sourceBreakdown: {
          veetiDataTypes: [
            'tilinpaatos',
            'taksa',
            'volume_vesi',
            'volume_jatevesi',
          ],
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
      };
      getOverviewV2.mockResolvedValueOnce(
        buildOverviewResponse({
          workspaceYears: [2015],
          years: [incompleteImportedYear],
        }),
      );
      getPlanningContextV2.mockResolvedValueOnce(
        buildPlanningContextResponse({
          canCreateScenario: false,
          baselineYears: [],
        }),
      );
      getImportYearDataV2.mockResolvedValueOnce({
        year: 2015,
        veetiId: 1,
        sourceStatus: 'VEETI',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        baselineReady: false,
        baselineMissingRequirements: ['financialBaseline'],
        baselineWarnings: [],
        hasManualOverrides: false,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [{ Liikevaihto: 578662, TilikaudenYliJaama: -15995 }],
            effectiveRows: [
              { Liikevaihto: 578662, TilikaudenYliJaama: -15995 },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'taksa',
            rawRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
            ],
            effectiveRows: [
              { Tyyppi_Id: 1, Kayttomaksu: 0.95 },
              { Tyyppi_Id: 2, Kayttomaksu: 2.0 },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'volume_vesi',
            rawRows: [{ Maara: 80121 }],
            effectiveRows: [{ Maara: 80121 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
          {
            dataType: 'volume_jatevesi',
            rawRows: [{ Maara: 50123 }],
            effectiveRows: [{ Maara: 50123 }],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
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

      fireEvent.click(await screen.findByRole('button', { name: 'Jatka' }));
      const focusedYear = await findReviewWorkspaceYear(2015);
      expect(focusedYear.className).toContain('decision-open');
      expect(
        screen.queryByRole('button', {
          name: localeText('v2Overview.createPlanningBaseline'),
        }),
      ).toBeNull();
    });
  });
}
