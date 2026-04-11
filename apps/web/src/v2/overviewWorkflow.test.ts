import { describe, expect, it } from 'vitest';
import {
  resolveSetupWizardStateFromImportStatus,
  getMissingSyncRequirements,
  getSetupReadinessChecks,
  getSetupYearStatus,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  resolveSetupWizardState,
  resolveVesinvestWorkflowState,
} from './overviewWorkflow';

describe('overviewWorkflow sync readiness', () => {
  it('marks year as sync-ready only with financials, prices, and any sold volume', () => {
    expect(
      isSyncReadyYear({
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
          tariff_revenue: true,
          volume_vesi: false,
          volume_jatevesi: true,
        },
      }),
    ).toBe(true);

    expect(
      isSyncReadyYear({
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: true,
          volume_jatevesi: false,
        },
      }),
    ).toBe(false);
  });

  it('returns missing requirements in deterministic order', () => {
    const missing = getMissingSyncRequirements({
      vuosi: 2018,
      completeness: {
        tilinpaatos: false,
        taksa: false,
        tariff_revenue: false,
        volume_vesi: false,
        volume_jatevesi: false,
      },
    });

    expect(missing).toEqual(['financials', 'prices', 'volumes']);
    expect(
      getSyncBlockReasonKey({
        vuosi: 2018,
        completeness: {
          tilinpaatos: false,
          taksa: true,
          tariff_revenue: false,
          volume_vesi: true,
          volume_jatevesi: false,
        },
      }),
    ).toBe('v2Overview.yearReasonMissingFinancials');
  });

  it('derives the setup readiness checks and overall setup status', () => {
    const checks = getSetupReadinessChecks({
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: false,
        tariff_revenue: false,
        volume_vesi: false,
        volume_jatevesi: true,
      },
    });

    expect(checks).toEqual([
      {
        key: 'financials',
        labelKey: 'v2Overview.datasetFinancials',
        ready: true,
      },
      {
        key: 'prices',
        labelKey: 'v2Overview.datasetPrices',
        ready: false,
      },
      {
        key: 'volumes',
        labelKey: 'v2Overview.datasetWaterVolume',
        ready: true,
      },
      {
        key: 'tariffRevenue',
        labelKey: 'v2Overview.datasetTariffRevenue',
        ready: false,
      },
    ]);

    expect(
      getSetupYearStatus({
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: false,
          tariff_revenue: false,
          volume_vesi: false,
          volume_jatevesi: true,
        },
      }),
    ).toBe('needs_attention');

    expect(
      getSetupYearStatus(
        {
          vuosi: 2024,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: true,
            volume_vesi: true,
            volume_jatevesi: false,
          },
        },
        { excluded: true },
      ),
    ).toBe('excluded_from_plan');
  });

  it('separates technical readiness from reviewed state', () => {
    const readyRow = {
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: true,
        tariff_revenue: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
    };

    expect(getSetupYearStatus(readyRow)).toBe('ready_for_review');
    expect(
      getSetupYearStatus({
        ...readyRow,
        reviewState: 'reviewed',
      }),
    ).toBe('reviewed');
  });
});

describe('overviewWorkflow setup wizard state', () => {
  it('treats a saved plan identity as connected workflow truth even when import link state is empty', () => {
    expect(
      resolveVesinvestWorkflowState(
        {
          connected: false,
          link: null,
          years: [],
          availableYears: [],
          workspaceYears: [],
          excludedYears: [],
          planningBaselineYears: [],
        },
        {
          canCreateScenario: false,
          vesinvest: {
            hasPlan: true,
            planCount: 1,
            activePlan: {
              id: 'plan-1',
              seriesId: 'series-1',
              name: 'Vesinvest plan',
              utilityName: 'Kronoby vatten och avlopp ab',
              businessId: '0180030-9',
              veetiId: 1535,
              identitySource: 'veeti',
              horizonYears: 20,
              versionNumber: 1,
              status: 'active',
              baselineStatus: 'verified',
              pricingStatus: 'blocked',
              selectedScenarioId: null,
              projectCount: 0,
              totalInvestmentAmount: 0,
              lastReviewedAt: null,
              reviewDueAt: null,
              classificationReviewRequired: false,
              baselineChangedSinceAcceptedRevision: false,
              investmentPlanChangedSinceFeeRecommendation: false,
              baselineFingerprint: null,
              scenarioFingerprint: null,
              updatedAt: '2026-04-10T00:00:00.000Z',
              createdAt: '2026-04-10T00:00:00.000Z',
            },
            selectedPlan: null,
          },
          baselineYears: [],
          operations: {
            latestYear: null,
            energySeries: [],
            networkRehabSeries: [],
            networkAssetsCount: 0,
            toimintakertomusCount: 0,
            toimintakertomusLatestYear: null,
            vedenottolupaCount: 0,
            activeVedenottolupaCount: 0,
          },
        },
      ),
    ).toMatchObject({
      utilityIdentified: true,
      hasPlan: true,
      currentStep: 3,
      baselineVerified: true,
      forecastReady: false,
    });
  });

  it('keeps no-plan states out of forecast and report readiness even when baseline truth exists', () => {
    expect(
      resolveVesinvestWorkflowState(
        {
          connected: true,
          link: {
            connected: true,
            orgId: 'org-1',
            veetiId: 1535,
            nimi: 'Kronoby vatten och avlopp ab',
            ytunnus: '0180030-9',
          },
          years: [],
          availableYears: [],
          workspaceYears: [],
          excludedYears: [],
          planningBaselineYears: [2024],
        },
        {
          canCreateScenario: true,
          vesinvest: {
            hasPlan: false,
            planCount: 0,
            activePlan: null,
            selectedPlan: null,
          },
          baselineYears: [
            {
              year: 2024,
              quality: 'complete',
              sourceStatus: 'VEETI',
              sourceBreakdown: {
                veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
                manualDataTypes: [],
              },
              financials: {
                dataType: 'tilinpaatos',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
              prices: {
                dataType: 'taksa',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
              volumes: {
                dataType: 'volume_vesi',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
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
          operations: {
            latestYear: null,
            energySeries: [],
            networkRehabSeries: [],
            networkAssetsCount: 0,
            toimintakertomusCount: 0,
            toimintakertomusLatestYear: null,
            vedenottolupaCount: 0,
            activeVedenottolupaCount: 0,
          },
        },
      ),
    ).toMatchObject({
      hasPlan: false,
      baselineVerified: true,
      currentStep: 3,
      forecastReady: false,
      reportsReady: false,
    });
  });

  it('keeps reports blocked while Vesinvest classification review is still required', () => {
    expect(
      resolveVesinvestWorkflowState(
        {
          connected: true,
          link: {
            connected: true,
            orgId: 'org-1',
            veetiId: 1535,
            nimi: 'Kronoby vatten och avlopp ab',
            ytunnus: '0180030-9',
          },
          years: [],
          availableYears: [],
          workspaceYears: [],
          excludedYears: [],
          planningBaselineYears: [2024],
        },
        {
          canCreateScenario: true,
          vesinvest: {
            hasPlan: true,
            planCount: 1,
            activePlan: {
              id: 'plan-1',
              seriesId: 'series-1',
              name: 'Vesinvest plan',
              utilityName: 'Kronoby vatten och avlopp ab',
              businessId: '0180030-9',
              veetiId: 1535,
              identitySource: 'veeti',
              horizonYears: 20,
              versionNumber: 1,
              status: 'active',
              baselineStatus: 'verified',
              pricingStatus: 'verified',
              selectedScenarioId: 'scenario-1',
              projectCount: 2,
              totalInvestmentAmount: 250000,
              lastReviewedAt: null,
              reviewDueAt: null,
              classificationReviewRequired: true,
              baselineChangedSinceAcceptedRevision: false,
              investmentPlanChangedSinceFeeRecommendation: false,
              baselineFingerprint: null,
              scenarioFingerprint: null,
              updatedAt: '2026-04-10T00:00:00.000Z',
              createdAt: '2026-04-10T00:00:00.000Z',
            },
            selectedPlan: null,
          },
          baselineYears: [
            {
              year: 2024,
              quality: 'complete',
              sourceStatus: 'VEETI',
              sourceBreakdown: {
                veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
                manualDataTypes: [],
              },
              financials: {
                dataType: 'tilinpaatos',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
              prices: {
                dataType: 'taksa',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
              volumes: {
                dataType: 'volume_vesi',
                source: 'veeti',
                provenance: null,
                editedAt: null,
                editedBy: null,
                reason: null,
              },
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
          operations: {
            latestYear: null,
            energySeries: [],
            networkRehabSeries: [],
            networkAssetsCount: 0,
            toimintakertomusCount: 0,
            toimintakertomusLatestYear: null,
            vedenottolupaCount: 0,
            activeVedenottolupaCount: 0,
          },
        },
        {
          selectedScenario: {
            id: 'scenario-1',
            updatedAt: '2026-04-10T00:00:00.000Z',
            computedFromUpdatedAt: '2026-04-10T00:00:00.000Z',
            computedYears: 20,
          },
        },
      ),
    ).toMatchObject({
      currentStep: 5,
      forecastReady: true,
      reportsReady: false,
    });
  });

  it('recommends the fix step when imported years still need attention', () => {
    expect(
      resolveSetupWizardState({
        connected: true,
        importedYearCount: 2,
        reviewedYearCount: 1,
        blockedYearCount: 1,
        pendingReviewCount: 0,
        excludedYearCount: 0,
        baselineReady: false,
      }),
    ).toMatchObject({
      currentStep: 3,
      recommendedStep: 4,
      activeStep: 3,
      selectedProblemYear: null,
      transitions: {
        reviewContinue: 4,
        selectProblemYear: 4,
      },
      wizardComplete: false,
      forecastUnlocked: false,
    });
  });

  it('activates step 4 when a blocked problem year is explicitly selected', () => {
    expect(
      resolveSetupWizardState({
        connected: true,
        importedYearCount: 2,
        reviewedYearCount: 1,
        blockedYearCount: 1,
        pendingReviewCount: 0,
        excludedYearCount: 0,
        baselineReady: false,
        selectedProblemYear: 2023,
      }),
    ).toMatchObject({
      currentStep: 4,
      recommendedStep: 4,
      activeStep: 4,
      selectedProblemYear: 2023,
      transitions: {
        reviewContinue: 4,
        selectProblemYear: 4,
      },
    });
  });

  it('recommends baseline creation once imported years are ready', () => {
    expect(
      resolveSetupWizardState({
        connected: true,
        importedYearCount: 2,
        reviewedYearCount: 2,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: 1,
        baselineReady: false,
      }),
    ).toMatchObject({
      currentStep: 5,
      recommendedStep: 5,
      activeStep: 5,
      transitions: {
        reviewContinue: 5,
        selectProblemYear: 4,
      },
      summary: {
        importedYearCount: 2,
        reviewedYearCount: 2,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: 1,
        baselineReady: false,
      },
    });
  });

  it('unlocks forecast only after the planning baseline exists', () => {
    expect(
      resolveSetupWizardState({
        connected: true,
        importedYearCount: 2,
        reviewedYearCount: 2,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: 0,
        baselineReady: true,
      }),
    ).toMatchObject({
      currentStep: 6,
      recommendedStep: 6,
      activeStep: 6,
      selectedProblemYear: null,
      wizardComplete: true,
      forecastUnlocked: true,
      reportsUnlocked: true,
    });
  });

  it('counts only imported workspace years when extra available VEETI years remain incomplete', () => {
    expect(
      resolveSetupWizardStateFromImportStatus(
        {
          connected: true,
          link: { connected: true, orgId: 'org-1', veetiId: 1 },
          years: [
            {
              vuosi: 2024,
              dataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              completeness: {
                tilinpaatos: true,
                taksa: true,
                tariff_revenue: true,
                volume_vesi: true,
                volume_jatevesi: false,
              },
            },
            {
              vuosi: 2023,
              dataTypes: ['tilinpaatos'],
              completeness: {
                tilinpaatos: true,
                taksa: false,
                tariff_revenue: false,
                volume_vesi: false,
                volume_jatevesi: false,
              },
            },
          ],
          availableYears: [
            {
              vuosi: 2024,
              dataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              completeness: {
                tilinpaatos: true,
                taksa: true,
                tariff_revenue: true,
                volume_vesi: true,
                volume_jatevesi: false,
              },
            },
            {
              vuosi: 2023,
              dataTypes: ['tilinpaatos'],
              completeness: {
                tilinpaatos: true,
                taksa: false,
                tariff_revenue: false,
                volume_vesi: false,
                volume_jatevesi: false,
              },
            },
          ],
          workspaceYears: [2024],
          excludedYears: [],
        },
        {
          canCreateScenario: false,
          baselineYears: [],
          operations: {
            latestYear: null,
            energySeries: [],
            networkRehabSeries: [],
            networkAssetsCount: 0,
            toimintakertomusCount: 0,
            toimintakertomusLatestYear: null,
            vedenottolupaCount: 0,
            activeVedenottolupaCount: 0,
          },
        },
      ),
    ).toMatchObject({
      currentStep: 3,
      recommendedStep: 3,
      activeStep: 3,
      summary: {
        importedYearCount: 1,
        reviewedYearCount: 0,
        blockedYearCount: 0,
        pendingReviewCount: 1,
        excludedYearCount: 0,
        baselineReady: false,
      },
    });
  });

  it('keeps operators in plan creation until a Vesinvest plan exists even when planning baseline years are accepted', () => {
    expect(
      resolveSetupWizardStateFromImportStatus(
        {
          connected: true,
          link: { connected: true, orgId: 'org-1', veetiId: 1 },
          years: [
            {
              vuosi: 2024,
              dataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              completeness: {
                tilinpaatos: true,
                taksa: true,
                tariff_revenue: true,
                volume_vesi: true,
                volume_jatevesi: false,
              },
            },
          ],
          availableYears: [
            {
              vuosi: 2024,
              dataTypes: ['tilinpaatos', 'taksa', 'volume_vesi'],
              completeness: {
                tilinpaatos: true,
                taksa: true,
                tariff_revenue: true,
                volume_vesi: true,
                volume_jatevesi: false,
              },
            },
          ],
          workspaceYears: [2024],
          excludedYears: [],
          planningBaselineYears: [2024],
        },
        {
          canCreateScenario: false,
          baselineYears: [],
          operations: {
            latestYear: null,
            energySeries: [],
            networkRehabSeries: [],
            networkAssetsCount: 0,
            toimintakertomusCount: 0,
            toimintakertomusLatestYear: null,
            vedenottolupaCount: 0,
            activeVedenottolupaCount: 0,
          },
        },
      ),
    ).toMatchObject({
      currentStep: 3,
      recommendedStep: 3,
      activeStep: 3,
      wizardComplete: false,
      forecastUnlocked: false,
      reportsUnlocked: false,
      summary: {
        importedYearCount: 1,
        reviewedYearCount: 1,
        blockedYearCount: 0,
        pendingReviewCount: 0,
        excludedYearCount: 0,
        baselineReady: true,
      },
    });
  });
});
