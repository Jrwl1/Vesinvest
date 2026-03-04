import { BadRequestException } from '@nestjs/common';
import { V2Service } from './v2.service';

describe('V2Service import exclusion behavior', () => {
  const ORG_ID = 'org-1';

  const readyYear = (year: number) => ({
    vuosi: year,
    completeness: {
      tilinpaatos: true,
      taksa: true,
      volume_vesi: true,
      volume_jatevesi: false,
    },
  });

  const buildService = (options?: {
    excludedYears?: number[];
    availableYears?: number[];
    veetiBudgets?: Array<{ id: string; nimi: string }>;
    linkedScenarios?: Array<{ id: string; nimi: string }>;
  }) => {
    const excludedYearSet = new Set<number>(options?.excludedYears ?? [2023]);
    const availableYears = (options?.availableYears ?? [2023, 2024]).map(
      readyYear,
    );

    const veetiSnapshotDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiOverrideDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const talousarvioDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiYearPolicyUpsert = jest
      .fn()
      .mockImplementation(async (args: any) => {
        excludedYearSet.add(args.where.orgId_veetiId_vuosi.vuosi);
        return { id: 'policy-1' };
      });

    const prisma = {
      veetiOrganisaatio: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
      },
      talousarvio: {
        findMany: jest.fn().mockResolvedValue(options?.veetiBudgets ?? []),
        deleteMany: talousarvioDeleteMany,
      },
      ennuste: {
        findMany: jest.fn().mockResolvedValue(options?.linkedScenarios ?? []),
      },
      veetiSnapshot: {
        deleteMany: veetiSnapshotDeleteMany,
      },
      veetiOverride: {
        deleteMany: veetiOverrideDeleteMany,
      },
      veetiYearPolicy: {
        upsert: veetiYearPolicyUpsert,
      },
      $transaction: jest.fn().mockImplementation(async (arg: any) => {
        if (typeof arg === 'function') {
          const tx = {
            veetiSnapshot: { deleteMany: veetiSnapshotDeleteMany },
            veetiOverride: { deleteMany: veetiOverrideDeleteMany },
            talousarvio: { deleteMany: talousarvioDeleteMany },
            veetiYearPolicy: { upsert: veetiYearPolicyUpsert },
          };
          return arg(tx);
        }
        return Promise.all(arg);
      }),
    } as any;

    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      refreshOrg: jest.fn().mockResolvedValue({ ok: true }),
      getAvailableYears: jest
        .fn()
        .mockImplementation(async () =>
          availableYears.filter((row) => !excludedYearSet.has(row.vuosi)),
        ),
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
    } as any;
    const veetiEffectiveDataService = {
      getExcludedYears: jest
        .fn()
        .mockImplementation(async () =>
          [...excludedYearSet].sort((a, b) => a - b),
        ),
    } as any;
    const veetiBudgetGenerator = {
      generateBudgets: jest
        .fn()
        .mockImplementation(async (_orgId: string, years: number[]) => ({
          success: true,
          count: years.length,
          results: years.map((year) => ({
            budgetId: `budget-${year}`,
            vuosi: year,
            mode: 'created' as const,
          })),
          skipped: [],
        })),
    } as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {
      checkYears: jest.fn().mockResolvedValue({ checkedAt: 'now', rows: [] }),
    } as any;

    const service = new V2Service(
      prisma,
      projectionsService,
      veetiService,
      veetiSyncService,
      veetiEffectiveDataService,
      veetiBudgetGenerator,
      veetiBenchmarkService,
      veetiSanityService,
    );

    return {
      service,
      excludedYearSet,
      mocks: {
        prisma,
        veetiSyncService,
        veetiEffectiveDataService,
        veetiBudgetGenerator,
        veetiYearPolicyUpsert,
      },
    };
  };

  it('skips excluded years during sync selection resolution', async () => {
    const { service, mocks } = buildService();

    const result = await service.syncImport(ORG_ID, [2023, 2024]);

    expect(mocks.veetiSyncService.refreshOrg).toHaveBeenCalledWith(ORG_ID);
    expect(
      mocks.veetiEffectiveDataService.getExcludedYears,
    ).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(result.generatedBudgets.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2023 })]),
    );
  });

  it('includes excludedYears in import status response', async () => {
    const { service, mocks } = buildService();

    const status = await service.getImportStatus(ORG_ID);

    expect(mocks.veetiSyncService.getStatus).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.veetiSyncService.getAvailableYears).toHaveBeenCalledWith(
      ORG_ID,
    );
    expect(
      mocks.veetiEffectiveDataService.getExcludedYears,
    ).toHaveBeenCalledWith(ORG_ID);
    expect(status.excludedYears).toEqual([2023]);
  });

  it('persists deleted year as excluded and keeps it skipped on subsequent sync', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    await service.removeImportedYear(ORG_ID, 2023);
    const syncResult = await service.syncImport(ORG_ID, [2023, 2024]);

    expect(mocks.veetiYearPolicyUpsert).toHaveBeenCalled();
    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(syncResult.status.excludedYears).toEqual([2023]);
    expect(syncResult.generatedBudgets.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2023 })]),
    );
  });

  it('blocks year delete when linked scenario uses baseline budget', async () => {
    const { service } = buildService({
      excludedYears: [],
      veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024' }],
      linkedScenarios: [{ id: 'scenario-1', nimi: 'Perusskenaario 2024' }],
    });

    await expect(service.removeImportedYear(ORG_ID, 2024)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.removeImportedYear(ORG_ID, 2024)).rejects.toThrow(
      /Cannot remove year 2024/,
    );
  });
});

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
        vuosiYlikirjoitukset: {},
      }),
    } as any;

    const service = new V2Service(
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

  it('returns an empty depreciation-rule list when none are configured', async () => {
    const { service, prisma } = buildService();

    const result = await service.listDepreciationRules(ORG_ID);

    expect(prisma.organizationDepreciationRule.findMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
      orderBy: [{ assetClassKey: 'asc' }],
    });
    expect(result).toEqual([]);
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
});

describe('V2Service scenario update merge-safety', () => {
  const buildService = () =>
    new V2Service(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

  it('preserves unknown override keys while updating investments and near-term growth', () => {
    const service = buildService();

    const result = (service as any).buildYearOverrides(
      [{ year: 2024, amount: 2500 }],
      [
        {
          year: 2024,
          personnelPct: 5,
          energyPct: 6,
          opexOtherPct: 7,
        },
      ],
      {
        2024: {
          futureTopLevel: { enabled: true },
          categoryGrowthPct: {
            personnel: 1,
            energy: 2,
            opexOther: 3,
            futureCategory: 99,
          },
        },
        2030: {
          futureOnly: 'keep-me',
        },
      },
    );

    expect(result[2024].futureTopLevel).toEqual({ enabled: true });
    expect(result[2024].investmentEur).toBe(2500);
    expect((result[2024].categoryGrowthPct as any).futureCategory).toBe(99);
    expect((result[2024].categoryGrowthPct as any).personnel).toBe(5);
    expect((result[2024].categoryGrowthPct as any).energy).toBe(6);
    expect((result[2024].categoryGrowthPct as any).opexOther).toBe(7);
    expect(result[2030].futureOnly).toBe('keep-me');
  });
});
