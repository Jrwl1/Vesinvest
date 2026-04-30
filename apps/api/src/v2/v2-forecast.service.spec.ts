import { V2ForecastService } from './v2-forecast.service';
import { registerV2DepreciationCompatibilitySuite } from './test-support/legacy/v2DepreciationCompatibilitySuite';
import { registerV2FeeSufficiencyHelpersSuite } from './test-support/legacy/v2FeeSufficiencyHelpersSuite';
import { registerV2ForecastStarterContractSuite } from './test-support/legacy/v2ForecastStarterContractSuite';
import { registerV2ScenarioAssumptionOverrideSuite } from './test-support/legacy/v2ScenarioAssumptionOverrideSuite';
import { registerV2ScenarioBranchCompatibilitySuite } from './test-support/legacy/v2ScenarioBranchCompatibilitySuite';
import { registerV2ScenarioMergeSafetySuite } from './test-support/legacy/v2ScenarioMergeSafetySuite';
import { registerV2StructuredInvestmentCompatibilitySuite } from './test-support/legacy/v2StructuredInvestmentCompatibilitySuite';

const ORG_ID = 'org-1';
const SCENARIO_ID = 'scenario-1';

const buildForecastService = () => {
  const prisma = {
    olettamus: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;

  const service = new V2ForecastService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { getImportStatus: jest.fn() } as any,
  );

  return { service, prisma };
};

describe('V2ForecastService helper behavior', () => {
  it('maps investment depreciation from computed scenario years into the V2 forecast payload', async () => {
    const { service, prisma } = buildForecastService();
    const projection = {
      id: SCENARIO_ID,
      nimi: 'Scenario',
      onOletus: false,
      talousarvioId: 'budget-1',
      aikajaksoVuosia: 2,
      olettamusYlikirjoitukset: {},
      userInvestments: [{ year: 2024, amount: 100000, category: 'network' }],
      vuosiYlikirjoitukset: {},
      scenarioDepreciationRules: [],
      talousarvio: { vuosi: 2024 },
      vuodet: [
        {
          vuosi: 2024,
          tulotYhteensa: 500000,
          kulutYhteensa: 420000,
          tulos: 80000,
          investoinnitYhteensa: 100000,
          poistoPerusta: 50000,
          poistoInvestoinneista: 4000,
          vesihinta: 2.4,
          myytyVesimaara: 100000,
          kassafloede: -20000,
          ackumuleradKassa: -20000,
          erittelyt: { ajurit: [] },
        },
      ],
      requiredTariff: 2.9,
      updatedAt: new Date('2026-03-08T12:00:00.000Z'),
      createdAt: new Date('2026-03-08T12:00:00.000Z'),
    } as any;

    prisma.olettamus = {
      findMany: jest.fn().mockResolvedValue([]),
    } as any;
    jest
      .spyOn(service as any, 'ensureScenarioDepreciationStorage')
      .mockResolvedValue({ rules: [] });
    jest
      .spyOn(service as any, 'resolveLatestComparableBaselinePrice')
      .mockResolvedValue(null);

    const result = await (service as any).mapScenarioPayload(
      ORG_ID,
      projection,
    );

    expect(result.years[0]).toMatchObject({
      investmentDepreciation: 4000,
      totalDepreciation: 54000,
      cashflow: -20000,
      cumulativeCashflow: -20000,
    });
  });

  it('keeps changed depreciation and funding pressure fields visible in the V2 payload', async () => {
    const { service, prisma } = buildForecastService();
    const projection = {
      id: SCENARIO_ID,
      nimi: 'Scenario',
      onOletus: false,
      talousarvioId: 'budget-1',
      aikajaksoVuosia: 2,
      olettamusYlikirjoitukset: {},
      userInvestments: [{ year: 2024, amount: 100000, category: 'network' }],
      vuosiYlikirjoitukset: {},
      scenarioDepreciationRules: [],
      talousarvio: { vuosi: 2024 },
      vuodet: [
        {
          vuosi: 2024,
          tulotYhteensa: 500000,
          kulutYhteensa: 428000,
          tulos: 72000,
          investoinnitYhteensa: 100000,
          poistoPerusta: 50000,
          poistoInvestoinneista: 12000,
          vesihinta: 2.4,
          myytyVesimaara: 100000,
          kassafloede: -35000,
          ackumuleradKassa: -35000,
          erittelyt: { ajurit: [] },
        },
      ],
      requiredTariff: 3.4,
      requiredTariffAnnualResult: 3.6,
      requiredAnnualIncreasePct: 0.1,
      requiredAnnualIncreasePctAnnualResult: 0.13,
      requiredTariffCumulativeCash: 3.8,
      requiredAnnualIncreasePctCumulativeCash: 0.16,
      feeSufficiency: {
        baselineCombinedPrice: 2.4,
        annualResult: {
          requiredPriceToday: 3.6,
          requiredAnnualIncreasePct: 0.13,
          underfundingStartYear: 2027,
          peakDeficit: 45000,
        },
        cumulativeCash: {
          requiredPriceToday: 3.8,
          requiredAnnualIncreasePct: 0.16,
          underfundingStartYear: 2026,
          peakGap: 140000,
        },
      },
      updatedAt: new Date('2026-03-08T12:00:00.000Z'),
      createdAt: new Date('2026-03-08T12:00:00.000Z'),
    } as any;

    prisma.olettamus = {
      findMany: jest.fn().mockResolvedValue([]),
    } as any;
    jest
      .spyOn(service as any, 'ensureScenarioDepreciationStorage')
      .mockResolvedValue({ rules: [] });
    jest
      .spyOn(service as any, 'resolveLatestComparableBaselinePrice')
      .mockResolvedValue(null);

    const result = await (service as any).mapScenarioPayload(
      ORG_ID,
      projection,
    );

    expect(result).toMatchObject({
      requiredPriceTodayCombinedAnnualResult: 1.68,
      requiredPriceTodayCombinedCumulativeCash: 3.4,
      feeSufficiency: {
        cumulativeCash: expect.objectContaining({
          peakGap: 35000,
        }),
      },
    });
    expect(result.years[0]).toMatchObject({
      investmentDepreciation: 12000,
      totalDepreciation: 62000,
      cashflow: -35000,
      cumulativeCashflow: -35000,
    });
  });

  it('computes required price for zero result from first-year revenue, costs, and sold volume', () => {
    const { service } = buildForecastService();

    const result = (service as any).computeRequiredPriceForZeroResult({
      revenue: 110000,
      costs: 140000,
      soldVolume: 10000,
      combinedPrice: 8,
    });

    expect(result).toBe(11);
  });

  it('rejects negative or above-cap direct investment amounts', () => {
    const { service } = buildForecastService();

    expect(() =>
      (service as any).normalizeUserInvestments([{ year: 2027, amount: -1 }]),
    ).toThrow(/zero or greater/i);
    expect(() =>
      (service as any).normalizeUserInvestments([
        { year: 2027, amount: 1_000_000_001 },
      ]),
    ).toThrow(/must not exceed/i);
  });

  it('blocks direct edits to Vesinvest-linked Forecast investment rows', async () => {
    const prisma = {
      olettamus: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ennuste: {
        updateMany: jest.fn(),
      },
    } as any;
    const projection = {
      id: SCENARIO_ID,
      nimi: 'Linked scenario',
      onOletus: false,
      talousarvioId: 'budget-1',
      aikajaksoVuosia: 20,
      olettamusYlikirjoitukset: {},
      userInvestments: [
        {
          rowId: 'allocation-1',
          year: 2026,
          amount: 100000,
          waterAmount: 60000,
          wastewaterAmount: 40000,
          target: 'Linked plan row',
          vesinvestPlanId: 'plan-1',
          vesinvestProjectId: 'project-1',
          allocationId: 'allocation-1',
          projectCode: 'P-1',
          groupKey: 'sanering_water_network',
          accountKey: 'sanering_water_network',
          reportGroupKey: 'network_rehabilitation',
        },
      ],
      vuosiYlikirjoitukset: {},
      scenarioDepreciationRules: [],
      talousarvio: { vuosi: 2025 },
      vuodet: [],
      updatedAt: new Date('2026-04-24T08:30:00.000Z'),
      createdAt: new Date('2026-04-24T08:00:00.000Z'),
    };
    const projectionsService = {
      findById: jest.fn().mockResolvedValue(projection),
      update: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      compute: jest.fn(),
      delete: jest.fn(),
    };
    const service = new V2ForecastService(
      prisma,
      projectionsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getImportStatus: jest.fn() } as any,
    );
    jest
      .spyOn(service as any, 'ensureScenarioDepreciationStorage')
      .mockResolvedValue({ rules: [] });

    await expect(
      service.updateForecastScenario(ORG_ID, SCENARIO_ID, {
        yearlyInvestments: [
          {
            ...projection.userInvestments[0],
            amount: 250000,
          },
        ],
      } as any),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'VESINVEST_LINKED_INVESTMENT_READONLY',
      }),
    });
    expect(projectionsService.update).not.toHaveBeenCalled();
  });

  it('keeps non-Vesinvest structured investment rows editable when they only carry display grouping', async () => {
    const prisma = {
      olettamus: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ennuste: {
        updateMany: jest.fn(),
      },
    } as any;
    const projection = {
      id: SCENARIO_ID,
      nimi: 'Manual structured scenario',
      onOletus: false,
      talousarvioId: 'budget-1',
      aikajaksoVuosia: 20,
      olettamusYlikirjoitukset: {},
      userInvestments: [
        {
          rowId: 'manual-1',
          year: 2026,
          amount: 100000,
          target: 'Manual grouped row',
          groupKey: 'sanering_water_network',
          accountKey: 'sanering_water_network',
          reportGroupKey: 'network_rehabilitation',
        },
      ],
      vuosiYlikirjoitukset: {},
      scenarioDepreciationRules: [],
      talousarvio: { vuosi: 2025 },
      vuodet: [],
      updatedAt: new Date('2026-04-24T08:30:00.000Z'),
      createdAt: new Date('2026-04-24T08:00:00.000Z'),
    };
    const projectionsService = {
      findById: jest.fn().mockResolvedValue(projection),
      update: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      compute: jest.fn(),
      delete: jest.fn(),
    };
    const service = new V2ForecastService(
      prisma,
      projectionsService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getImportStatus: jest.fn() } as any,
    );
    jest
      .spyOn(service as any, 'ensureScenarioDepreciationStorage')
      .mockResolvedValue({ rules: [] });
    jest
      .spyOn(service as any, 'mapScenarioPayload')
      .mockResolvedValue(projection);

    await service.updateForecastScenario(ORG_ID, SCENARIO_ID, {
      yearlyInvestments: [
        {
          ...projection.userInvestments[0],
          amount: 125000,
        },
      ],
    } as any);

    expect(projectionsService.update).toHaveBeenCalledWith(
      ORG_ID,
      SCENARIO_ID,
      expect.objectContaining({
        userInvestments: expect.arrayContaining([
          expect.objectContaining({
            rowId: 'manual-1',
            amount: 125000,
            groupKey: 'sanering_water_network',
          }),
        ]),
      }),
    );
  });
});

registerV2DepreciationCompatibilitySuite();
registerV2ScenarioMergeSafetySuite();
registerV2StructuredInvestmentCompatibilitySuite();
registerV2ScenarioAssumptionOverrideSuite();
registerV2ForecastStarterContractSuite();
registerV2ScenarioBranchCompatibilitySuite();
registerV2FeeSufficiencyHelpersSuite();
