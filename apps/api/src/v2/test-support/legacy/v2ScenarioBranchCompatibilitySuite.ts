import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { V2ForecastService } from '../../v2-forecast.service';
import { V2ImportOverviewService } from '../../v2-import-overview.service';
import { V2ReportService } from '../../v2-report.service';
import { V2Service } from '../../v2.service';

const buildFacadeFromArgs = (
  prisma: any,
  projectionsService: any,
  veetiService: any,
  veetiSyncService: any,
  veetiEffectiveDataService: any,
  veetiBudgetGenerator: any,
  veetiBenchmarkService: any,
  veetiSanityService: any,
) =>
  buildFacadeService({
    prisma,
    projectionsService,
    veetiService: {
      getOrganizationById: jest.fn().mockResolvedValue({
        Id: 1535,
        Nimi: 'Water Utility',
        YTunnus: '1234567-8',
        Kieli_Id: 2,
      }),
      ...veetiService,
    },
    veetiSyncService: {
      getStatus: jest.fn().mockResolvedValue({
        orgId: 'org-1',
        veetiId: 1535,
        workspaceYears: [],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([]),
      ...veetiSyncService,
    },
    veetiEffectiveDataService: {
      getExcludedYears: jest.fn().mockResolvedValue([]),
      ...veetiEffectiveDataService,
    },
    veetiBudgetGenerator,
    veetiBenchmarkService,
    veetiSanityService,
  });

const buildFacadeService = (deps: {
  prisma: any;
  projectionsService: any;
  veetiService: any;
  veetiSyncService: any;
  veetiEffectiveDataService: any;
  veetiBudgetGenerator: any;
  veetiBenchmarkService: any;
  veetiSanityService: any;
}) => {
  const importOverviewService = new V2ImportOverviewService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
  );
  const forecastService = new V2ForecastService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
    importOverviewService,
  );
  const reportService = new V2ReportService(
    deps.prisma,
    deps.projectionsService,
    deps.veetiService,
    deps.veetiSyncService,
    deps.veetiEffectiveDataService,
    deps.veetiBudgetGenerator,
    deps.veetiBenchmarkService,
    deps.veetiSanityService,
    forecastService,
    importOverviewService,
  );

  return new V2Service(importOverviewService, forecastService, reportService, {
    getPlanningContextSummary: jest.fn().mockResolvedValue({
      vesinvest: {
        hasPlan: false,
        planCount: 0,
        activePlan: null,
      },
    }),
  } as any);
};


export function registerV2ScenarioBranchCompatibilitySuite() {
describe('V2Service scenario branch compatibility', () => {
  const ORG_ID = 'org-1';
  const SCENARIO_ID = 'scenario-1';

  it('defaults the first created scenario to the base branch and marks it as onOletus', async () => {
    const prisma = {} as any;
    const projectionsService = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: SCENARIO_ID }),
      compute: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      projectionsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).forecastService, 'resolveAcceptedPlanningBaselineBudgetIds')
      .mockResolvedValue([]);
    jest
      .spyOn((service as any).forecastService, 'resolveLatestAcceptedVeetiBudgetId')
      .mockResolvedValue('budget-2024');
    jest
      .spyOn((service as any).forecastService, 'getForecastScenario')
      .mockResolvedValue({ id: SCENARIO_ID, scenarioType: 'base' } as any);

    await service.createForecastScenario(ORG_ID, {
      name: 'First scenario',
      compute: false,
    });

    expect(projectionsService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        nimi: 'First scenario',
        talousarvioId: 'budget-2024',
        onOletus: true,
        olettamusYlikirjoitukset: {},
      }),
    );
  });

  it('inherits a copied non-base branch type when no explicit type is requested', async () => {
    const prisma = {} as any;
    const projectionsService = {
      list: jest.fn().mockResolvedValue([{ id: 'base-1', onOletus: true }]),
      findById: jest.fn().mockResolvedValue({
        id: 'scenario-source',
        onOletus: false,
        olettamusYlikirjoitukset: {
          hintakorotus: 0.03,
          __scenarioTypeCode: 3,
        },
        userInvestments: [],
        talousarvio: { vuosi: 2024 },
        vuosiYlikirjoitukset: {},
      }),
      create: jest.fn().mockResolvedValue({ id: SCENARIO_ID }),
      compute: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      projectionsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).forecastService, 'resolveAcceptedPlanningBaselineBudgetIds')
      .mockResolvedValue([]);
    jest
      .spyOn((service as any).forecastService, 'resolveLatestAcceptedVeetiBudgetId')
      .mockResolvedValue('budget-2024');
    jest
      .spyOn((service as any).forecastService, 'getForecastScenario')
      .mockResolvedValue({ id: SCENARIO_ID, scenarioType: 'stress' } as any);

    await service.createForecastScenario(ORG_ID, {
      copyFromScenarioId: 'scenario-source',
      compute: false,
    });

    expect(projectionsService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        talousarvioId: 'budget-2024',
        olettamusYlikirjoitukset: expect.objectContaining({
          hintakorotus: 0.03,
          __scenarioTypeCode: 3,
        }),
      }),
    );
  });

  it('stores non-base branch metadata while keeping public assumption maps clean', async () => {
    const prisma = {
      olettamus: {
        findMany: jest.fn().mockResolvedValue([
          { avain: 'hintakorotus', arvo: 0.01 },
        ]),
      },
      ennuste: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const currentProjection = {
      id: SCENARIO_ID,
      nimi: 'Committed branch',
      onOletus: false,
      talousarvioId: 'budget-2024',
      talousarvio: {
        vuosi: 2024,
        data: [
          {
            Liikevaihto: 100000,
            LiiketoiminnanMuutTuotot: 0,
            MateriaalitJaPalvelut: 10000,
            Henkilostokulut: 10000,
            PoistotJaArvonalentumiset: 5000,
            LiiketoiminnanMuutKulut: 5000,
            TilikaudenYliJaama: 5000,
          },
        ],
      },
      aikajaksoVuosia: 1,
      vuodet: [],
      olettamusYlikirjoitukset: {
        hintakorotus: 0.03,
        __scenarioTypeCode: 2,
      },
      userInvestments: [],
      vuosiYlikirjoitukset: {},
      baselineDepreciation: [],
      scenarioDepreciationRules: [],
      computedAt: null,
      computedFromUpdatedAt: null,
      updatedAt: '2026-04-10T00:00:00.000Z',
      createdAt: '2026-04-10T00:00:00.000Z',
    };
    const committedProjection = {
      ...currentProjection,
      olettamusYlikirjoitukset: {
        hintakorotus: 0.03,
        __scenarioTypeCode: 1,
      },
    };
    const projectionsService = {
      findById: jest
        .fn()
        .mockResolvedValueOnce(currentProjection)
        .mockResolvedValue(committedProjection),
      update: jest.fn().mockResolvedValue({}),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      projectionsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).forecastService, 'ensureScenarioDepreciationStorage')
      .mockResolvedValue({ rules: [] });
    jest
      .spyOn((service as any).forecastService, 'resolveLatestComparableBaselinePrice')
      .mockResolvedValue(4.2);

    await service.updateForecastScenario(ORG_ID, SCENARIO_ID, {
      scenarioType: 'committed',
    });

    expect(projectionsService.update).toHaveBeenCalledWith(
      ORG_ID,
      SCENARIO_ID,
      expect.objectContaining({
        olettamusYlikirjoitukset: expect.objectContaining({
          hintakorotus: 0.03,
          __scenarioTypeCode: 1,
        }),
      }),
    );

    const refreshed = await service.getForecastScenario(ORG_ID, SCENARIO_ID);

    expect(refreshed.scenarioType).toBe('committed');
    expect(refreshed.assumptions).toEqual(
      expect.objectContaining({
        hintakorotus: 0.03,
      }),
    );
    expect(refreshed.assumptions).not.toHaveProperty('__scenarioTypeCode');
  });

  it('defaults legacy non-base scenarios without an override key to the hypothesis branch', async () => {
    const service = buildFacadeFromArgs(
      {} as any,
      {
        list: jest.fn().mockResolvedValue([
          {
            id: 'legacy-1',
            nimi: 'Legacy scenario',
            onOletus: false,
            olettamusYlikirjoitukset: {},
            aikajaksoVuosia: 20,
            talousarvio: { vuosi: 2024 },
            _count: { vuodet: 0 },
            updatedAt: '2026-04-10T00:00:00.000Z',
          },
        ]),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const scenarios = await service.listForecastScenarios(ORG_ID);

    expect(scenarios).toEqual([
      expect.objectContaining({
        id: 'legacy-1',
        scenarioType: 'hypothesis',
      }),
    ]);
  });

  it('rejects near-term expense rows outside the editable five-year window', async () => {
    const prisma = {
      ennuste: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const projectionsService = {
      findById: jest.fn().mockResolvedValue({
        id: SCENARIO_ID,
        onOletus: false,
        olettamusYlikirjoitukset: {},
        userInvestments: [],
        talousarvio: { vuosi: 2024 },
        vuosiYlikirjoitukset: {},
        baselineDepreciation: [],
        scenarioDepreciationRules: [],
      }),
      update: jest.fn(),
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      projectionsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.updateForecastScenario(ORG_ID, SCENARIO_ID, {
        nearTermExpenseAssumptions: [
          {
            year: 2030,
            personnelPct: 5,
          },
        ],
      }),
    ).rejects.toThrow(/outside the editable range 2024-2028/i);
  });
});
}


