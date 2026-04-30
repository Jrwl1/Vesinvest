import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TariffPlanPageV2 } from './TariffPlanPageV2';

const acceptTariffPlanV2 = vi.fn();
const createReportV2 = vi.fn();
const getPlanningContextV2 = vi.fn();
const getTariffPlanV2 = vi.fn();
const saveTariffPlanV2 = vi.fn();
const translate = vi.hoisted(() => (
  key: string,
  defaultValueOrOptions?: string | Record<string, unknown>,
  maybeOptions?: Record<string, unknown>,
) => {
  const options =
    typeof defaultValueOrOptions === 'object' && defaultValueOrOptions !== null
      ? defaultValueOrOptions
      : maybeOptions;
  let out =
    typeof defaultValueOrOptions === 'string'
      ? defaultValueOrOptions
      : typeof options?.defaultValue === 'string'
      ? String(options.defaultValue)
      : key;
  for (const [name, value] of Object.entries(options ?? {})) {
    out = out.split(`{{${name}}}`).join(String(value));
  }
  return out;
});

vi.mock('../api', () => ({
  acceptTariffPlanV2: (...args: unknown[]) => acceptTariffPlanV2(...args),
  createReportV2: (...args: unknown[]) => createReportV2(...args),
  getPlanningContextV2: (...args: unknown[]) => getPlanningContextV2(...args),
  getTariffPlanV2: (...args: unknown[]) => getTariffPlanV2(...args),
  saveTariffPlanV2: (...args: unknown[]) => saveTariffPlanV2(...args),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: translate,
  }),
}));

const activePlan = {
  id: 'plan-1',
  seriesId: 'series-1',
  name: 'Water Utility Vesinvest',
  utilityName: 'Water Utility',
  businessId: '1234567-8',
  veetiId: 1535,
  identitySource: 'veeti',
  horizonYears: 20,
  versionNumber: 1,
  status: 'active',
  baselineStatus: 'verified',
  pricingStatus: 'verified',
  selectedScenarioId: 'scenario-1',
  projectCount: 2,
  totalInvestmentAmount: 500000,
  lastReviewedAt: '2026-04-25T09:00:00.000Z',
  reviewDueAt: null,
  classificationReviewRequired: false,
  assetEvidenceReady: true,
  assetEvidenceMissingCount: 0,
  baselineChangedSinceAcceptedRevision: false,
  investmentPlanChangedSinceFeeRecommendation: false,
  tariffPlanStatus: 'draft',
  baselineFingerprint: 'baseline',
  scenarioFingerprint: 'scenario',
  updatedAt: '2026-04-25T09:00:00.000Z',
  createdAt: '2026-04-25T09:00:00.000Z',
};

const baselineInput = {
  connectionFeeAverage: 3500,
  connectionFeeRevenue: 10500,
  connectionFeeNewConnections: 3,
  connectionFeeBasis: 'Per anslutning',
  baseFeeRevenue: 18000,
  connectionCount: 1200,
  waterPrice: 1.5,
  wastewaterPrice: 2.8,
  soldWaterVolume: 87592,
  soldWastewaterVolume: 98021,
  notes: '',
};

const allocationPolicy = {
  connectionFeeSharePct: 40,
  baseFeeSharePct: 20,
  waterUsageSharePct: 20,
  wastewaterUsageSharePct: 20,
  smoothingYears: 5,
  regionalVariationApplies: false,
  stormwaterApplies: false,
  financialRiskAssessment: 'Måttlig risk; följ upp betalningsförmåga och likviditet.',
};

const recommendationFees = {
  connectionFee: {
    key: 'connectionFee',
    currentUnit: 10500,
    proposedUnit: 12000,
    currentAnnualRevenue: 10500,
    proposedAnnualRevenue: 12000,
    revenueImpact: 1500,
    deltaPct: 14.29,
    annualIncreasePct: 2.15,
    allocationSharePct: 40,
    denominator: 3,
    yearlyPath: [],
  },
  baseFee: {
    key: 'baseFee',
    currentUnit: 18000,
    proposedUnit: 20000,
    currentAnnualRevenue: 18000,
    proposedAnnualRevenue: 20000,
    revenueImpact: 2000,
    deltaPct: 11.11,
    annualIncreasePct: 2.15,
    allocationSharePct: 20,
    denominator: 1200,
    yearlyPath: [],
  },
  waterUsageFee: {
    key: 'waterUsageFee',
    currentUnit: 1.5,
    proposedUnit: 1.65,
    currentAnnualRevenue: 131388,
    proposedAnnualRevenue: 144527,
    revenueImpact: 13139,
    deltaPct: 10,
    annualIncreasePct: 2.15,
    allocationSharePct: 20,
    denominator: 87592,
    yearlyPath: [],
  },
  wastewaterUsageFee: {
    key: 'wastewaterUsageFee',
    currentUnit: 2.8,
    proposedUnit: 3.08,
    currentAnnualRevenue: 274459,
    proposedAnnualRevenue: 301905,
    revenueImpact: 27446,
    deltaPct: 10,
    annualIncreasePct: 2.15,
    allocationSharePct: 20,
    denominator: 98021,
    yearlyPath: [],
  },
};

const makeTariffPlan = (policy = allocationPolicy) => ({
  id: 'tariff-1',
  vesinvestPlanId: 'plan-1',
  scenarioId: 'scenario-1',
  status: 'draft',
  baselineInput,
  allocationPolicy: policy,
  recommendation: {
    savedAt: '2026-04-25T09:00:00.000Z',
    linkedScenarioId: 'scenario-1',
    vesinvestPlanId: 'plan-1',
    baselineFingerprint: 'baseline',
    scenarioFingerprint: 'scenario',
    targetAdditionalAnnualRevenue: 38760,
    baselineAnnualRevenue: 439000,
    proposedAnnualRevenue: 477760,
    smoothingYears: 5,
    averageAnnualIncreasePct: 2.15,
    priceSignal: {
      currentComparatorPrice: 1.9,
      requiredPriceToday: 2.54,
      requiredIncreasePct: 33.68,
      cumulativeCashFloorPrice: 4.25,
      cumulativeCashFloorIncreasePct: 123.68,
    },
    fees: recommendationFees,
    revenueTable: [],
    annualChangePath: [],
    impactFlags: {
      exceeds15PctAnnualIncrease: false,
      regionalVariationApplies: false,
      stormwaterApplies: false,
      specialUseApplies: false,
      connectionFeeLiabilityRecorded: true,
      ownerDistributionRecorded: true,
    },
    allocationRationale: [],
    lawReadiness: {
      isReady: true,
      assetPlan20YearPresent: true,
      trustedBaselinePresent: true,
      currentTariffBaselinePresent: true,
      investmentFinancingNeedPresent: true,
      riskAssessmentPresent: true,
      tariffRevenueEvidencePresent: true,
      costEvidencePresent: true,
      connectionFeeLiabilityPresent: true,
      smoothingStatus: 'ok',
      regionalVariationFlag: false,
      stormwaterFlag: false,
      unresolvedManualAssumptions: [],
    },
  },
  readinessChecklist: {
    isReady: true,
    assetPlan20YearPresent: true,
    trustedBaselinePresent: true,
    currentTariffBaselinePresent: true,
    investmentFinancingNeedPresent: true,
    riskAssessmentPresent: true,
    tariffRevenueEvidencePresent: true,
    costEvidencePresent: true,
    connectionFeeLiabilityPresent: true,
    smoothingStatus: 'ok',
    regionalVariationFlag: false,
    stormwaterFlag: false,
    unresolvedManualAssumptions: [],
  },
  revenueEvidence: { notes: 'Revenue evidence ready' },
  costEvidence: { notes: 'Cost evidence ready' },
  regionalDifferentiationState: null,
  stormwaterState: null,
  specialUseState: null,
  connectionFeeLiabilityState: { notes: 'Liability assessed' },
  ownerDistributionState: null,
  acceptedAt: null,
  updatedAt: '2026-04-25T09:00:00.000Z',
  createdAt: '2026-04-25T09:00:00.000Z',
});

describe('TariffPlanPageV2', () => {
  beforeEach(() => {
    acceptTariffPlanV2.mockReset();
    createReportV2.mockReset();
    getPlanningContextV2.mockReset();
    getTariffPlanV2.mockReset();
    saveTariffPlanV2.mockReset();

    getPlanningContextV2.mockResolvedValue({
      canCreateScenario: true,
      vesinvest: {
        hasPlan: true,
        planCount: 1,
        activePlan,
        selectedPlan: activePlan,
      },
      baselineYears: [],
      operations: {
        latestYear: 2025,
        energySeries: [],
        networkRehabSeries: [],
        networkAssetsCount: 0,
        toimintakertomusCount: 0,
        toimintakertomusLatestYear: null,
        vedenottolupaCount: 0,
        activeVedenottolupaCount: 0,
      },
    });
    getTariffPlanV2.mockResolvedValue(makeTariffPlan());
    saveTariffPlanV2.mockImplementation(async (_planId: string, data: Record<string, unknown>) => ({
      ...makeTariffPlan(data.allocationPolicy as typeof allocationPolicy),
      ...data,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('applies the recommended even split and returns to custom mode after manual edits', async () => {
    render(
      <TariffPlanPageV2
        onGoToAssetManagement={() => undefined}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(getPlanningContextV2).toHaveBeenCalled();
      expect(getTariffPlanV2).toHaveBeenCalledWith('plan-1');
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    expect(screen.getAllByText('Required price today').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2[,.]54 EUR/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Current comparator price').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Required increase vs comparator').length).toBeGreaterThan(0);
    const applyRecommendation = screen.getByRole('button', {
      name: 'Apply recommendation',
    });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Recommended even split' }).getAttribute('aria-pressed'),
      ).toBe('false');
      expect(
        screen.getByRole('button', { name: 'Custom allocation' }).getAttribute('aria-pressed'),
      ).toBe('true');
    });

    fireEvent.click(applyRecommendation);

    await waitFor(() => {
      expect(screen.getByLabelText('Connection fee %')).toHaveProperty('value', '25');
      expect(screen.getByLabelText('Base fee %')).toHaveProperty('value', '25');
      expect(screen.getByLabelText('Water usage price %')).toHaveProperty('value', '25');
      expect(screen.getByLabelText('Wastewater usage price %')).toHaveProperty('value', '25');
    });
    expect(
      screen.getByRole('button', { name: 'Recommended even split' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Apply recommendation' }).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Custom allocation' }));
    expect(
      screen.getByRole('button', { name: 'Custom allocation' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByLabelText('Connection fee %')).toHaveProperty('value', '25');

    fireEvent.change(screen.getByLabelText('Water usage price %'), {
      target: { value: '30' },
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Custom allocation' }).getAttribute('aria-pressed'),
      ).toBe('true');
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Apply recommendation' }).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apply recommendation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(saveTariffPlanV2).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          allocationPolicy: expect.objectContaining({
            connectionFeeSharePct: 25,
            baseFeeSharePct: 25,
            waterUsageSharePct: 25,
            wastewaterUsageSharePct: 25,
          }),
        }),
      );
    });
  });

  it('does not show validation placeholder evidence text as live tariff copy', async () => {
    getTariffPlanV2.mockResolvedValue({
      ...makeTariffPlan({
        ...allocationPolicy,
        financialRiskAssessment:
          'Moderate risk; monitor affordability, liquidity, and staged implementation.',
      }),
      revenueEvidence: { notes: 'Reviewed during live deployment audit.' },
      costEvidence: { notes: 'Reviewed during live deployment audit.' },
      connectionFeeLiabilityState: { notes: 'Reviewed during live deployment audit.' },
    });

    render(
      <TariffPlanPageV2
        onGoToAssetManagement={() => undefined}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await screen.findByDisplayValue(
      'Monitor affordability, liquidity, and staged implementation.',
    );
    expect(
      screen.getAllByDisplayValue('Evidence reviewed for the active tariff plan.').length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByDisplayValue(
        'Moderate risk; monitor affordability, liquidity, and staged implementation.',
      ),
    ).toBeNull();
    expect(screen.queryByDisplayValue('Reviewed during live deployment audit.')).toBeNull();
  });

  it('marks an accepted plan as not accepted when visible tariff fields change', async () => {
    getTariffPlanV2.mockResolvedValue({
      ...makeTariffPlan(),
      status: 'accepted',
      acceptedAt: '2026-04-25T09:30:00.000Z',
    });

    render(
      <TariffPlanPageV2
        onGoToAssetManagement={() => undefined}
        onGoToForecast={() => undefined}
        onGoToReports={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeNull();
    });
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Save' }).disabled).toBe(
      true,
    );
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Tariff plan accepted' }).disabled,
    ).toBe(true);
    expect(
      screen.getByText(
        'Annual-result price is the primary tariff target; the cumulative cash floor is higher because it tests cash sufficiency without relying on accumulated surplus.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Reports' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Water price'), {
      target: { value: '1.6' },
    });

    await waitFor(() => {
      expect(screen.getByText('Changes not accepted')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Open Reports' })).toBeNull();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Create report' }).disabled).toBe(
      true,
    );
    expect(
      screen.getByText(
        'Visible tariff changes must be accepted before they can be reported.',
      ),
    ).toBeTruthy();
  });
});
