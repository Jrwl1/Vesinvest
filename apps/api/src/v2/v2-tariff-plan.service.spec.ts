import { ConflictException } from '@nestjs/common';
import { V2TariffPlanService } from './v2-tariff-plan.service';

const ORG_ID = 'org-1';
const PLAN_ID = 'plan-1';
const SCENARIO_ID = 'scenario-1';

const makeScenario = (overrides: Record<string, unknown> = {}) => ({
  id: SCENARIO_ID,
  name: 'Selected forecast',
  onOletus: true,
  scenarioType: 'base',
  talousarvioId: 'budget-1',
  baselineYear: 2024,
  horizonYears: 20,
  assumptions: {},
  yearlyInvestments: [{ year: 2026, amount: 100000 }],
  nearTermExpenseAssumptions: [],
  thereafterExpenseAssumptions: null,
  requiredPriceTodayCombined: 2.2,
  baselinePriceTodayCombined: 1.36,
  requiredAnnualIncreasePct: 20,
  requiredPriceTodayCombinedAnnualResult: 2.5,
  requiredAnnualIncreasePctAnnualResult: 40,
  requiredPriceTodayCombinedCumulativeCash: 2.4,
  requiredAnnualIncreasePctCumulativeCash: 35,
  feeSufficiency: {
    baselineCombinedPrice: 1.36,
    annualResult: {
      requiredPriceToday: 2.5,
      requiredAnnualIncreasePct: 40,
      underfundingStartYear: 2027,
      peakDeficit: 120000,
    },
    cumulativeCash: {
      requiredPriceToday: 2.4,
      requiredAnnualIncreasePct: 35,
      underfundingStartYear: 2028,
      peakGap: 300000,
    },
  },
  years: [
    {
      year: 2026,
      revenue: 226000,
      costs: 240000,
      result: -14000,
      investments: 100000,
      baselineDepreciation: 20000,
      investmentDepreciation: 5000,
      totalDepreciation: 25000,
      combinedPrice: 1.36,
      soldVolume: 100000,
      cashflow: -5000,
      cumulativeCashflow: -5000,
      waterPrice: 1.2,
      wastewaterPrice: 1.6,
      baseFeeRevenue: 40000,
      connectionCount: 800,
    },
  ],
  priceSeries: [],
  investmentSeries: [{ year: 2026, amount: 100000 }],
  cashflowSeries: [],
  computedAt: new Date('2026-04-24T09:00:00.000Z'),
  computedFromUpdatedAt: new Date('2026-04-24T08:30:00.000Z'),
  updatedAt: new Date('2026-04-24T08:30:00.000Z'),
  createdAt: new Date('2026-04-24T08:00:00.000Z'),
  ...overrides,
});

const makePlan = (overrides: Record<string, unknown> = {}) => ({
  id: PLAN_ID,
  orgId: ORG_ID,
  horizonYears: 20,
  baselineFingerprint: 'baseline-fingerprint',
  scenarioFingerprint: null,
  selectedScenarioId: SCENARIO_ID,
  selectedScenario: { id: SCENARIO_ID },
  projects: [
    {
      waterAmount: 60000,
      wastewaterAmount: 40000,
      totalAmount: 100000,
      allocations: [{ totalAmount: 100000 }],
    },
  ],
  ...overrides,
});

const matchesWhere = (row: Record<string, unknown>, where: Record<string, unknown>) =>
  Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected) &&
      'in' in expected
    ) {
      return (expected as { in: unknown[] }).in.includes(actual);
    }
    if (
      expected &&
      typeof expected === 'object' &&
      !Array.isArray(expected) &&
      'not' in expected
    ) {
      return actual !== (expected as { not: unknown }).not;
    }
    return actual === expected;
  });

const makeService = (
  planOverrides: Record<string, unknown> = {},
  scenarioOverrides: Record<string, unknown> = {},
) => {
  const rows: Array<Record<string, any>> = [];
  let idCounter = 0;
  let tick = 0;
  const nextDate = () => new Date(Date.UTC(2026, 3, 24, 12, 0, tick++));
  const prisma: Record<string, any> = {
    vesinvestPlan: {
      findFirst: jest.fn().mockResolvedValue(makePlan(planOverrides)),
    },
    vesinvestTariffPlan: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return (
          [...rows]
            .filter((row) => matchesWhere(row, where))
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0] ??
          null
        );
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const createdAt = nextDate();
        const row = {
          id: `tariff-${++idCounter}`,
          ...data,
          createdAt,
          updatedAt: createdAt,
        };
        rows.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) {
          throw new Error(`Missing tariff plan ${where.id}`);
        }
        Object.assign(row, data, { updatedAt: nextDate() });
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of rows) {
          if (matchesWhere(row, where)) {
            Object.assign(row, data, { updatedAt: nextDate() });
            count += 1;
          }
        }
        return { count };
      }),
    },
  };
  prisma.$transaction = jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
    callback(prisma),
  );
  const forecastService = {
    getForecastScenario: jest.fn().mockResolvedValue(makeScenario(scenarioOverrides)),
  };
  const service = new V2TariffPlanService(prisma as any, forecastService as any);
  return { service, prisma, forecastService, rows };
};

const readyBaselineInput = {
  connectionFeeAverage: 5000,
  connectionFeeRevenue: 50000,
  connectionFeeNewConnections: 10,
  baseFeeRevenue: 40000,
  connectionCount: 800,
  waterPrice: 1.2,
  wastewaterPrice: 1.6,
  soldWaterVolume: 60000,
  soldWastewaterVolume: 40000,
};

const readyAllocationPolicy = {
  connectionFeeSharePct: 10,
  baseFeeSharePct: 30,
  waterUsageSharePct: 35,
  wastewaterUsageSharePct: 25,
  smoothingYears: 4,
  regionalVariationApplies: true,
  stormwaterApplies: true,
  financialRiskAssessment: 'Financing risk reviewed with a controlled staged increase.',
};

const readyEvidence = {
  revenueEvidence: { notes: 'Current and proposed fee revenue reviewed by fee type.' },
  costEvidence: { notes: 'Materials, services, personnel, financing and other costs reviewed.' },
  connectionFeeLiabilityState: { notes: 'Returnable connection-fee liability checked.' },
};

describe('V2TariffPlanService', () => {
  it('creates a first-class tariff package for all four fee types', async () => {
    const { service, prisma } = makeService();

    const result = await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: readyBaselineInput,
      allocationPolicy: readyAllocationPolicy,
      ...readyEvidence,
    });

    expect(prisma.vesinvestTariffPlan.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('draft');
    expect(result.baselineInput).toMatchObject(readyBaselineInput);
    expect(result.allocationPolicy).toMatchObject(readyAllocationPolicy);
    expect(Object.keys(result.recommendation.fees).sort()).toEqual([
      'baseFee',
      'connectionFee',
      'wastewaterUsageFee',
      'waterUsageFee',
    ]);
    expect(result.recommendation.targetAdditionalAnnualRevenue).toBe(104000);
    expect(result.recommendation.fees.connectionFee).toMatchObject({
      currentUnit: 5000,
      proposedUnit: 6040,
      revenueImpact: 10400,
      allocationSharePct: 10,
    });
    expect(result.recommendation.fees.baseFee).toMatchObject({
      currentUnit: 50,
      proposedUnit: 89,
      revenueImpact: 31200,
      allocationSharePct: 30,
    });
    expect(result.recommendation.fees.waterUsageFee.proposedUnit).toBeCloseTo(
      1.8067,
      4,
    );
    expect(result.recommendation.fees.wastewaterUsageFee.proposedUnit).toBeCloseTo(
      2.25,
      4,
    );
    expect(result.readinessChecklist).toMatchObject({
      isReady: true,
      currentTariffBaselinePresent: true,
      riskAssessmentPresent: true,
      regionalVariationFlag: true,
      stormwaterFlag: true,
      unresolvedManualAssumptions: [],
    });
  });

  it('persists tariff evidence fields without requiring old rows to have them', async () => {
    const { service, prisma } = makeService();

    const first = await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: readyBaselineInput,
      allocationPolicy: readyAllocationPolicy,
    });

    expect(first.revenueEvidence).toBeNull();
    expect(first.costEvidence).toBeNull();

    const result = await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      revenueEvidence: { waterUsageFee: { currentRevenue: 72000 } },
      costEvidence: { purchasedServices: 22000 },
      regionalDifferentiationState: { applies: true, reason: 'network areas' },
      stormwaterState: { applies: false },
      specialUseState: { wastewaterLoadReviewed: true },
      connectionFeeLiabilityState: { returnableLiability: 150000 },
      ownerDistributionState: { tuloutusReviewed: true },
    });

    expect(prisma.vesinvestTariffPlan.update).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      revenueEvidence: { waterUsageFee: { currentRevenue: 72000 } },
      costEvidence: { purchasedServices: 22000 },
      regionalDifferentiationState: { applies: true, reason: 'network areas' },
      stormwaterState: { applies: false },
      specialUseState: { wastewaterLoadReviewed: true },
      connectionFeeLiabilityState: { returnableLiability: 150000 },
      ownerDistributionState: { tuloutusReviewed: true },
    });
  });

  it('blocks acceptance when manual baseline or risk assessment is incomplete', async () => {
    const { service } = makeService();

    await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: {
        baseFeeRevenue: 40000,
        connectionCount: 800,
        waterPrice: 1.2,
        wastewaterPrice: 1.6,
        soldWaterVolume: 60000,
        soldWastewaterVolume: 40000,
      },
      allocationPolicy: {
        connectionFeeSharePct: 10,
        baseFeeSharePct: 30,
        waterUsageSharePct: 35,
        wastewaterUsageSharePct: 25,
        smoothingYears: 4,
      },
    });

    try {
      await service.acceptTariffPlan(ORG_ID, PLAN_ID);
      throw new Error('Expected acceptTariffPlan to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        code: 'TARIFF_PLAN_NOT_READY',
        readinessChecklist: {
          isReady: false,
          currentTariffBaselinePresent: false,
          riskAssessmentPresent: false,
          unresolvedManualAssumptions: [
            'connection-fee assumption',
            'tariff revenue evidence',
            'cost evidence',
            'returnable connection-fee liability',
          ],
        },
      });
    }
  });

  it('accepts a ready tariff plan and stales the prior accepted package for the scenario', async () => {
    const { service, prisma, rows } = makeService();

    await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: readyBaselineInput,
      allocationPolicy: readyAllocationPolicy,
      ...readyEvidence,
    });
    const firstAccepted = await service.acceptTariffPlan(ORG_ID, PLAN_ID);
    expect(firstAccepted.status).toBe('accepted');

    await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: {
        ...readyBaselineInput,
        waterPrice: 1.3,
      },
      allocationPolicy: readyAllocationPolicy,
      ...readyEvidence,
    });
    const secondAccepted = await service.acceptTariffPlan(ORG_ID, PLAN_ID);

    expect(secondAccepted.status).toBe('accepted');
    expect(prisma.vesinvestTariffPlan.updateMany).toHaveBeenLastCalledWith({
      where: {
        orgId: ORG_ID,
        vesinvestPlanId: PLAN_ID,
        scenarioId: SCENARIO_ID,
        status: 'accepted',
        id: { not: 'tariff-2' },
      },
      data: { status: 'stale' },
    });
    expect(rows.map((row) => [row.id, row.status])).toEqual([
      ['tariff-1', 'stale'],
      ['tariff-2', 'accepted'],
    ]);
    expect(secondAccepted.acceptedAt).toBeTruthy();
  });

  it('does not duplicate a combined forecast volume into both tariff services', async () => {
    const { service } = makeService();

    const result = await service.getTariffPlan(ORG_ID, PLAN_ID);

    expect(result.baselineInput).toMatchObject({
      waterPrice: 1.2,
      wastewaterPrice: 1.6,
      soldWaterVolume: null,
      soldWastewaterVolume: null,
    });
    expect(result.readinessChecklist.unresolvedManualAssumptions).toEqual(
      expect.arrayContaining(['sold water volume', 'sold wastewater volume']),
    );
  });

  it('uses explicit split forecast volumes when they are available', async () => {
    const { service } = makeService({}, {
      years: [
        {
          ...makeScenario().years[0],
          soldVolume: 100000,
          soldWaterVolume: 62000,
          soldWastewaterVolume: 38000,
        },
      ],
    });

    const result = await service.getTariffPlan(ORG_ID, PLAN_ID);

    expect(result.baselineInput.soldWaterVolume).toBe(62000);
    expect(result.baselineInput.soldWastewaterVolume).toBe(38000);
  });

  it('splits default usage allocation by known water and wastewater investment shares', async () => {
    const { service } = makeService({
      projects: [
        {
          waterAmount: 50000,
          wastewaterAmount: 50000,
          totalAmount: 1000000,
          allocations: [{ totalAmount: 1000000 }],
        },
      ],
    });

    const result = await service.getTariffPlan(ORG_ID, PLAN_ID);

    expect(result.allocationPolicy).toMatchObject({
      connectionFeeSharePct: 10,
      baseFeeSharePct: 35,
      waterUsageSharePct: 27.5,
      wastewaterUsageSharePct: 27.5,
    });
  });

  it('stales an accepted tariff package when live fingerprints no longer match', async () => {
    const { service, prisma, rows } = makeService();

    await service.upsertTariffPlan(ORG_ID, PLAN_ID, {
      baselineInput: readyBaselineInput,
      allocationPolicy: readyAllocationPolicy,
      ...readyEvidence,
    });
    await service.acceptTariffPlan(ORG_ID, PLAN_ID);

    prisma.vesinvestPlan.findFirst.mockResolvedValue(
      makePlan({ baselineFingerprint: 'new-baseline-fingerprint' }),
    );
    const result = await service.getTariffPlan(ORG_ID, PLAN_ID);

    expect(result.status).toBe('stale');
    expect(rows[0].status).toBe('stale');
  });
});
