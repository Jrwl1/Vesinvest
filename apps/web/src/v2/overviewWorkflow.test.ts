import { describe, expect, it } from 'vitest';
import {
  getMissingSyncRequirements,
  getSetupReadinessChecks,
  getSetupYearStatus,
  getSyncBlockReasonKey,
  isSyncReadyYear,
  resolveNextBestStep,
  resolveSetupWizardState,
} from './overviewWorkflow';

describe('overviewWorkflow sync readiness', () => {
  it('marks year as sync-ready only with financials, prices, and any sold volume', () => {
    expect(
      isSyncReadyYear({
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: true,
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
          volume_vesi: true,
          volume_jatevesi: false,
        },
      }),
    ).toBe('v2Overview.yearReasonMissingFinancials');
  });

  it('derives the three setup readiness checks and overall setup status', () => {
    const checks = getSetupReadinessChecks({
      vuosi: 2024,
      completeness: {
        tilinpaatos: true,
        taksa: false,
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
    ]);

    expect(
      getSetupYearStatus({
        vuosi: 2024,
        completeness: {
          tilinpaatos: true,
          taksa: false,
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
            volume_vesi: true,
            volume_jatevesi: false,
          },
        },
        { excluded: true },
      ),
    ).toBe('excluded_from_plan');
  });
});

describe('overviewWorkflow next best step', () => {
  it('prioritizes connect before all other actions', () => {
    const step = resolveNextBestStep({
      connected: false,
      canCreateScenario: false,
      readyYearCount: 2,
      blockedYearCount: 1,
      scenarioCount: 0,
      computedScenarioCount: 0,
      reportCount: 0,
    });
    expect(step).toBe('connect_org');
  });

  it('guides through forecast lifecycle after baseline exists', () => {
    expect(
      resolveNextBestStep({
        connected: true,
        canCreateScenario: true,
        readyYearCount: 3,
        blockedYearCount: 0,
        scenarioCount: 0,
        computedScenarioCount: 0,
        reportCount: 0,
      }),
    ).toBe('create_first_scenario');

    expect(
      resolveNextBestStep({
        connected: true,
        canCreateScenario: true,
        readyYearCount: 3,
        blockedYearCount: 0,
        scenarioCount: 2,
        computedScenarioCount: 0,
        reportCount: 0,
      }),
    ).toBe('compute_scenario');

    expect(
      resolveNextBestStep({
        connected: true,
        canCreateScenario: true,
        readyYearCount: 3,
        blockedYearCount: 0,
        scenarioCount: 2,
        computedScenarioCount: 2,
        reportCount: 0,
      }),
    ).toBe('create_first_report');

    expect(
      resolveNextBestStep({
        connected: true,
        canCreateScenario: true,
        readyYearCount: 3,
        blockedYearCount: 0,
        scenarioCount: 2,
        computedScenarioCount: 2,
        reportCount: 3,
      }),
    ).toBe('review_reports');
  });
});

describe('overviewWorkflow setup wizard state', () => {
  it('recommends the fix step when imported years still need attention', () => {
    expect(
      resolveSetupWizardState({
        connected: true,
        importedYearCount: 2,
        readyYearCount: 1,
        blockedYearCount: 1,
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
        readyYearCount: 1,
        blockedYearCount: 1,
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
        readyYearCount: 2,
        blockedYearCount: 0,
        excludedYearCount: 1,
        baselineReady: false,
      }),
    ).toMatchObject({
      currentStep: 3,
      recommendedStep: 5,
      activeStep: 3,
      transitions: {
        reviewContinue: 5,
        selectProblemYear: 4,
      },
      summary: {
        importedYearCount: 2,
        readyYearCount: 2,
        blockedYearCount: 0,
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
        readyYearCount: 2,
        blockedYearCount: 0,
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
});
