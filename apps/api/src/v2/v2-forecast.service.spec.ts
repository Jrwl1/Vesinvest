import { V2ForecastService } from './v2-forecast.service';

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

    const result = await (service as any).mapScenarioPayload(ORG_ID, projection);

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

    const result = await (service as any).mapScenarioPayload(ORG_ID, projection);

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
});
