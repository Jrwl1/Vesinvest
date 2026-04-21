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


export function registerV2DepreciationCompatibilitySuite() {
describe('V2Service depreciation compatibility', () => {
  const ORG_ID = 'org-1';
  const SCENARIO_ID = 'scenario-1';

  const buildService = () => {
    const prisma = {
      organizationDepreciationRule: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      ennuste: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const projectionsService = {
      findById: jest.fn().mockResolvedValue({
        id: SCENARIO_ID,
        aikajaksoVuosia: 2,
        talousarvio: { vuosi: 2024 },
        scenarioDepreciationRules: [],
        baselineDepreciation: [],
        vuosiYlikirjoitukset: {},
      }),
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

    return { service, prisma, projectionsService };
  };

  it('returns the authoritative class-owned depreciation catalog when no org overrides exist', async () => {
    const { service, prisma } = buildService();

    const result = await service.listDepreciationRules(ORG_ID);

    expect(prisma.organizationDepreciationRule.findMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
      orderBy: [{ assetClassKey: 'asc' }],
    });
    expect(result.map((item) => item.assetClassKey)).toEqual([
      'sanering_water_network',
      'sanering_wastewater_network',
      'new_water_network',
      'new_wastewater_network',
      'repair_water_network',
      'repair_wastewater_network',
      'waterworks_equipment',
      'wastewater_equipment',
      'water_production',
      'wastewater_treatment',
    ]);
  });

  it('maps organization-level legacy rules into the canonical Vesinvest class catalog', async () => {
    const { service, prisma } = buildService();
    prisma.organizationDepreciationRule.findMany.mockResolvedValueOnce([
      {
        id: 'rule-1',
        assetClassKey: 'water_network_post_1999',
        assetClassName: 'Water network',
        method: 'linear',
        linearYears: 25,
        residualPercent: null,
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
    ]);

    const result = await service.listDepreciationRules(ORG_ID);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetClassKey: 'sanering_water_network',
          assetClassName: 'Sanering / vattennätverk',
          method: 'straight-line',
          linearYears: 25,
        }),
        expect.objectContaining({
          assetClassKey: 'new_water_network',
          assetClassName: 'Nyanläggning / vattennätverk',
          method: 'straight-line',
          linearYears: 25,
        }),
        expect.objectContaining({
          assetClassKey: 'repair_water_network',
          assetClassName: 'Reparation / vattennätverk',
          method: 'straight-line',
          linearYears: 25,
        }),
      ]),
    );
  });

  it('keeps explicit class rules ahead of leftover legacy aliases in the class catalog', async () => {
    const { service, prisma } = buildService();
    prisma.organizationDepreciationRule.findMany.mockResolvedValueOnce([
      {
        id: 'rule-legacy',
        assetClassKey: 'water_network_post_1999',
        assetClassName: 'Water network',
        method: 'linear',
        linearYears: 25,
        residualPercent: null,
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
      {
        id: 'rule-class',
        assetClassKey: 'new_water_network',
        assetClassName: 'Nyanläggning / vattennätverk',
        method: 'linear',
        linearYears: 40,
        residualPercent: null,
        createdAt: '2026-03-25T10:00:00.000Z',
        updatedAt: '2026-03-25T10:00:00.000Z',
      },
    ]);

    const result = await service.listDepreciationRules(ORG_ID);

    expect(
      result.find((item) => item.assetClassKey === 'new_water_network'),
    ).toMatchObject({
      assetClassKey: 'new_water_network',
      assetClassName: 'Nyanläggning / vattennätverk',
      method: 'straight-line',
      linearYears: 40,
    });
    expect(
      result.find((item) => item.assetClassKey === 'sanering_water_network'),
    ).toMatchObject({
      assetClassKey: 'sanering_water_network',
      method: 'straight-line',
      linearYears: 25,
    });
  });

  it('returns empty class allocations when scenario has no class-allocation overrides', async () => {
    const { service, projectionsService } = buildService();

    const result = await service.getScenarioClassAllocations(
      ORG_ID,
      SCENARIO_ID,
    );

    expect(projectionsService.findById).toHaveBeenCalledWith(
      ORG_ID,
      SCENARIO_ID,
    );
    expect(result).toEqual({
      scenarioId: SCENARIO_ID,
      years: [],
    });
  });

  it('returns scenario-scoped depreciation rules from scenario storage', async () => {
    const { service, projectionsService } = buildService();
    projectionsService.findById.mockResolvedValueOnce({
      id: SCENARIO_ID,
      aikajaksoVuosia: 2,
      talousarvio: { vuosi: 2024 },
      scenarioDepreciationRules: [
        {
          id: 'network',
          assetClassKey: 'network',
          assetClassName: 'Network',
          method: 'straight-line',
          linearYears: 40,
          residualPercent: null,
          annualSchedule: null,
        },
      ],
      baselineDepreciation: [],
      vuosiYlikirjoitukset: {},
    });

    const result = await service.listScenarioDepreciationRules(
      ORG_ID,
      SCENARIO_ID,
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: 'network',
        assetClassKey: 'network',
        method: 'straight-line',
        linearYears: 40,
      }),
    ]);
  });

  it('seeds scenario depreciation rules from the PTS workbook defaults when none are stored yet', async () => {
    const { service, prisma } = buildService();

    const result = await service.listScenarioDepreciationRules(
      ORG_ID,
      SCENARIO_ID,
    );

    expect(prisma.ennuste.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SCENARIO_ID, orgId: ORG_ID },
        data: expect.objectContaining({
          scenarioDepreciationRules: expect.arrayContaining([
            expect.objectContaining({
              assetClassKey: 'water_network_post_1999',
              method: 'straight-line',
              linearYears: 25,
            }),
            expect.objectContaining({
              assetClassKey: 'plant_machinery',
              method: 'residual',
              residualPercent: 10,
            }),
          ]),
        }),
      }),
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetClassKey: 'water_network_post_1999',
          method: 'straight-line',
          linearYears: 25,
        }),
        expect.objectContaining({
          assetClassKey: 'plant_machinery',
          method: 'residual',
          residualPercent: 10,
        }),
      ]),
    );
  });

  it('creates, updates, and deletes scenario-scoped depreciation rules with canonical methods only', async () => {
    const { service, prisma, projectionsService } = buildService();
    projectionsService.findById
      .mockResolvedValueOnce({
        id: SCENARIO_ID,
        aikajaksoVuosia: 2,
        talousarvio: { vuosi: 2024 },
        scenarioDepreciationRules: [],
        baselineDepreciation: [],
        vuosiYlikirjoitukset: {},
      })
      .mockResolvedValueOnce({
        id: SCENARIO_ID,
        aikajaksoVuosia: 2,
        talousarvio: { vuosi: 2024 },
        scenarioDepreciationRules: [
          {
            id: 'network',
            assetClassKey: 'network',
            assetClassName: 'Network',
            method: 'none',
            linearYears: null,
            residualPercent: null,
            annualSchedule: null,
          },
        ],
        baselineDepreciation: [],
        vuosiYlikirjoitukset: {},
      })
      .mockResolvedValueOnce({
        id: SCENARIO_ID,
        aikajaksoVuosia: 2,
        talousarvio: { vuosi: 2024 },
        scenarioDepreciationRules: [
          {
            id: 'network',
            assetClassKey: 'network',
            assetClassName: 'Network',
            method: 'straight-line',
            linearYears: 25,
            residualPercent: null,
            annualSchedule: null,
          },
        ],
        baselineDepreciation: [],
        vuosiYlikirjoitukset: {},
      });

    const created = await service.createScenarioDepreciationRule(
      ORG_ID,
      SCENARIO_ID,
      {
        assetClassKey: 'network',
        assetClassName: 'Network',
        method: 'none',
      },
    );

    expect(created).toEqual(
      expect.objectContaining({
        id: 'network',
        method: 'none',
      }),
    );

    const updated = await service.updateScenarioDepreciationRule(
      ORG_ID,
      SCENARIO_ID,
      'network',
      {
        method: 'straight-line',
        linearYears: 25,
      },
    );

    expect(updated).toEqual(
      expect.objectContaining({
        id: 'network',
        method: 'straight-line',
        linearYears: 25,
      }),
    );

    await service.deleteScenarioDepreciationRule(ORG_ID, SCENARIO_ID, 'network');

    expect(prisma.ennuste.updateMany).toHaveBeenCalled();
  });

  it('rejects retired depreciation methods when saving scenario rules', async () => {
    const { service } = buildService();

    await expect(
      service.createScenarioDepreciationRule(ORG_ID, SCENARIO_ID, {
        assetClassKey: 'network',
        assetClassName: 'Network',
        method: 'custom-annual-schedule' as any,
        annualSchedule: [60, 40],
      }),
    ).rejects.toThrow(
      'method must be one of: residual, straight-line, none.',
    );
  });
});
}


