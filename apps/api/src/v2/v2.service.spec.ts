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
    workspaceYears?: number[];
    veetiBudgets?: Array<{ id: string; nimi: string }>;
    linkedScenarios?: Array<{ id: string; nimi: string }>;
  }) => {
    const excludedYearSet = new Set<number>(options?.excludedYears ?? [2023]);
    const availableYears = (options?.availableYears ?? [2023, 2024]).map(
      readyYear,
    );
    let linked = true;
    let workspaceYears = [...(options?.workspaceYears ?? [])].sort(
      (a, b) => a - b,
    );

    const veetiSnapshotDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiOverrideDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const talousarvioDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const ennusteDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiYearPolicyDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiOrganisaatioDeleteMany = jest.fn().mockImplementation(async () => {
      linked = false;
      workspaceYears = [];
      return { count: 1 };
    });
    const veetiOrganisaatioFindUnique = jest.fn().mockImplementation(
      async (args?: any) => {
        if (!linked) {
          return null;
        }
        const row = {
          orgId: ORG_ID,
          veetiId: 1535,
          workspaceYears: [...workspaceYears],
        };
        if (!args?.select) {
          return row;
        }
        return Object.fromEntries(
          Object.entries(args.select)
            .filter(([, selected]) => selected)
            .map(([key]) => [key, row[key as keyof typeof row]]),
        );
      },
    );
    const veetiOrganisaatioUpdate = jest.fn().mockImplementation(
      async (args: any) => {
        linked = true;
        workspaceYears = [...(args?.data?.workspaceYears ?? [])].sort(
          (a, b) => a - b,
        );
        const row = {
          orgId: ORG_ID,
          veetiId: 1535,
          workspaceYears: [...workspaceYears],
        };
        if (!args?.select) {
          return row;
        }
        return Object.fromEntries(
          Object.entries(args.select)
            .filter(([, selected]) => selected)
            .map(([key]) => [key, row[key as keyof typeof row]]),
        );
      },
    );
    const veetiYearPolicyUpdateMany = jest
      .fn()
      .mockImplementation(async (args: any) => {
        const year = args.where.vuosi;
        if (args.where.excluded === true && excludedYearSet.has(year)) {
          excludedYearSet.delete(year);
          return { count: 1 };
        }
        return { count: 0 };
      });
    const veetiYearPolicyUpsert = jest
      .fn()
      .mockImplementation(async (args: any) => {
        excludedYearSet.add(args.where.orgId_veetiId_vuosi.vuosi);
        return { id: 'policy-1' };
      });

    const prisma = {
      talousarvio: {
        findMany: jest.fn().mockResolvedValue(options?.veetiBudgets ?? []),
        deleteMany: talousarvioDeleteMany,
      },
      ennuste: {
        findMany: jest.fn().mockResolvedValue(options?.linkedScenarios ?? []),
        deleteMany: ennusteDeleteMany,
      },
      veetiSnapshot: {
        deleteMany: veetiSnapshotDeleteMany,
      },
      veetiOverride: {
        deleteMany: veetiOverrideDeleteMany,
      },
      veetiYearPolicy: {
        upsert: veetiYearPolicyUpsert,
        updateMany: veetiYearPolicyUpdateMany,
        deleteMany: veetiYearPolicyDeleteMany,
      },
      veetiOrganisaatio: {
        findUnique: veetiOrganisaatioFindUnique,
        update: veetiOrganisaatioUpdate,
        deleteMany: veetiOrganisaatioDeleteMany,
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
    const veetiService = {
      searchOrganizations: jest.fn().mockResolvedValue([]),
      getOrganizationById: jest.fn().mockResolvedValue({
        Id: 1535,
        Kieli_Id: 2,
      }),
    } as any;
    const veetiSyncService = {
      connectOrg: jest.fn().mockImplementation(async () => ({
        linked: { orgId: ORG_ID, veetiId: 1535 },
        years: availableYears.map((row) => row.vuosi),
        availableYears: availableYears.map((row) => row.vuosi),
        workspaceYears: [],
      })),
      refreshOrg: jest.fn().mockResolvedValue({ ok: true }),
      getAvailableYears: jest
        .fn()
        .mockImplementation(async () =>
          linked
            ? availableYears.filter((row) => !excludedYearSet.has(row.vuosi))
            : [],
        ),
      getStatus: jest
        .fn()
        .mockImplementation(async () =>
          linked
            ? {
                orgId: ORG_ID,
                veetiId: 1535,
                workspaceYears: [...workspaceYears],
              }
            : null,
        ),
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
        veetiService,
        veetiSyncService,
        veetiEffectiveDataService,
        veetiBudgetGenerator,
        veetiYearPolicyUpsert,
        veetiYearPolicyUpdateMany,
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

  it('imports selected years into workspace without generating baseline budgets', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    const result = await service.importYears(ORG_ID, [2023, 2024]);

    expect(mocks.veetiSyncService.refreshOrg).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.veetiBudgetGenerator.generateBudgets).not.toHaveBeenCalled();
    expect(mocks.prisma.veetiOrganisaatio.update).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
      data: { workspaceYears: [2023, 2024] },
      select: { workspaceYears: true },
    });
    expect(result).toMatchObject({
      selectedYears: [2023, 2024],
      importedYears: [2023, 2024],
      workspaceYears: [2023, 2024],
      skippedYears: [],
      status: {
        workspaceYears: [2023, 2024],
      },
    });
  });

  it('creates the planning baseline only from eligible years and reports skipped years separately', async () => {
    const { service, mocks } = buildService({
      excludedYears: [2023],
      availableYears: [2023, 2024],
      workspaceYears: [2023, 2024],
    });

    const result = await service.createPlanningBaseline(ORG_ID, [2023, 2024]);

    expect(mocks.veetiSyncService.refreshOrg).not.toHaveBeenCalled();
    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(result.includedYears).toEqual([2024]);
    expect(result.skippedYears).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2023 })]),
    );
    expect(result.planningBaseline.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2024 })]),
    );
  });

  it('limits planning baseline years to persisted workspaceYears', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
      workspaceYears: [2024],
    });

    const result = await service.createPlanningBaseline(ORG_ID, [2023, 2024]);

    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(result.includedYears).toEqual([2024]);
    expect(result.skippedYears).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          vuosi: 2023,
          reason:
            'Year is not imported into the workspace. Import it before creating the planning baseline.',
        }),
      ]),
    );
  });

  it('connects the organization without refreshing years or generating budgets', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    const result = await service.connectOrganization(ORG_ID, 1535);

    expect(mocks.veetiSyncService.getStatus).not.toHaveBeenCalled();
    expect(mocks.veetiSyncService.refreshOrg).not.toHaveBeenCalled();
    expect(mocks.veetiBudgetGenerator.generateBudgets).not.toHaveBeenCalled();
    expect(mocks.veetiSyncService.connectOrg).toHaveBeenCalledWith(ORG_ID, 1535);
    expect(mocks.veetiService.getOrganizationById).toHaveBeenCalledWith(1535);
    expect(result).toMatchObject({
      linked: {
        orgId: ORG_ID,
        veetiId: 1535,
        kieliId: 2,
        uiLanguage: 'sv',
      },
      availableYears: [2023, 2024],
      workspaceYears: [],
    });
  });

  it('normalizes org-search input and clamps the forwarded limit', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });
    mocks.veetiService.searchOrganizations.mockResolvedValue([
      { Id: 1535, Nimi: 'Water Utility' },
    ]);

    const result = await service.searchOrganizations('  Water  ', 99);

    expect(mocks.veetiService.searchOrganizations).toHaveBeenCalledWith(
      'Water',
      25,
    );
    expect(result).toEqual([{ Id: 1535, Nimi: 'Water Utility' }]);
  });

  it('keeps workspaceYears in syncImport results without treating available years as imported by default', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024, 2025],
      workspaceYears: [2023],
    });

    const result = await service.syncImport(ORG_ID, [2024]);

    expect(mocks.prisma.veetiOrganisaatio.update).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
      data: { workspaceYears: [2023, 2024] },
      select: { workspaceYears: true },
    });
    expect(result.importedYears).toEqual([2024]);
    expect(result.workspaceYears).toEqual([2023, 2024]);
    expect(result.status.workspaceYears).toEqual([2023, 2024]);
    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
  });

  it('includes excludedYears and workspaceYears in import status response', async () => {
    const { service, mocks } = buildService({ workspaceYears: [2024, 2023] });

    const status = await service.getImportStatus(ORG_ID);

    expect(mocks.veetiSyncService.getStatus).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.veetiSyncService.getAvailableYears).toHaveBeenCalledWith(
      ORG_ID,
    );
    expect(
      mocks.veetiEffectiveDataService.getExcludedYears,
    ).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.veetiService.getOrganizationById).toHaveBeenCalledWith(1535);
    expect(status.excludedYears).toEqual([2023]);
    expect(status.workspaceYears).toEqual([2023, 2024]);
    expect(status.link).toMatchObject({
      veetiId: 1535,
      kieliId: 2,
      uiLanguage: 'sv',
    });
  });

  it('excludes year from planning without deleting snapshots or baseline budgets', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    const result = await service.excludeImportedYears(ORG_ID, [2023]);
    const syncResult = await service.syncImport(ORG_ID, [2023, 2024]);

    expect(mocks.veetiYearPolicyUpsert).toHaveBeenCalled();
    expect(mocks.prisma.veetiSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.veetiOverride.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.talousarvio.deleteMany).not.toHaveBeenCalled();
    expect(result.status.excludedYears).toEqual([2023]);
    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(syncResult.generatedBudgets.skipped).toEqual(
      expect.arrayContaining([expect.objectContaining({ vuosi: 2023 })]),
    );
  });

  it('restores excluded year back into planning without deleting historical data', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    await service.excludeImportedYears(ORG_ID, [2023]);
    const result = await service.restoreImportedYears(ORG_ID, [2023]);

    expect(mocks.veetiYearPolicyUpdateMany).toHaveBeenCalled();
    expect(mocks.prisma.veetiSnapshot.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.talousarvio.deleteMany).not.toHaveBeenCalled();
    expect(result.restoredCount).toBe(1);
    expect(result.status.excludedYears).toEqual([]);
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

  it('removes deleted years from persisted workspaceYears', async () => {
    const { service } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
      workspaceYears: [2023, 2024],
    });

    const result = await service.removeImportedYear(ORG_ID, 2023);

    expect(result.workspaceYears).toEqual([2024]);
    expect(result.status.workspaceYears).toEqual([2024]);
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

  it('rejects org-clear when the confirmation token is missing, blank, or wrong', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
    });

    await expect(
      service.clearImportAndScenarios(ORG_ID, ['ADMIN']),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CLEAR_CONFIRMATION_INVALID',
      }),
    });
    await expect(
      service.clearImportAndScenarios(ORG_ID, ['ADMIN'], '   '),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CLEAR_CONFIRMATION_INVALID',
      }),
    });
    await expect(
      service.clearImportAndScenarios(ORG_ID, ['ADMIN'], 'WRONGTOK'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'CLEAR_CONFIRMATION_INVALID',
      }),
    });

    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows org-clear when the confirmation token matches after trimming and normalizing case', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2023, 2024],
      workspaceYears: [2023, 2024],
      veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024' }],
    });

    const result = await service.clearImportAndScenarios(
      ORG_ID,
      ['ADMIN'],
      '  OrG-1  ',
    );

    expect(mocks.prisma.$transaction).toHaveBeenCalled();
    expect(result).toMatchObject({
      deletedScenarios: 1,
      deletedVeetiBudgets: 1,
      deletedVeetiSnapshots: 1,
      deletedVeetiOverrides: 1,
      deletedVeetiYearPolicies: 1,
      deletedVeetiLinks: 1,
      status: {
        connected: false,
        workspaceYears: [],
        years: [],
      },
    });
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
        scenarioDepreciationRules: [],
        baselineDepreciation: [],
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

  it('creates, updates, and deletes scenario-scoped depreciation rules with custom annual schedules', async () => {
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
            method: 'custom-annual-schedule',
            linearYears: null,
            residualPercent: null,
            annualSchedule: [60, 40],
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
        method: 'custom-annual-schedule',
        annualSchedule: [60, 40],
      },
    );

    expect(created).toEqual(
      expect.objectContaining({
        id: 'network',
        method: 'custom-annual-schedule',
        annualSchedule: [60, 40],
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

describe('V2Service structured investment compatibility', () => {
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

  it('normalizes legacy yearly investments to the structured contract with null metadata', () => {
    const service = buildService();

    const result = (service as any).normalizeUserInvestments([
      { year: 2024, amount: 1200 },
    ]);

    expect(result).toEqual([
      {
        year: 2024,
        amount: 1200,
        category: null,
        investmentType: null,
        confidence: null,
        note: null,
      },
    ]);
  });

  it('builds yearly investment rows that preserve structured metadata while keeping legacy years compatible', () => {
    const service = buildService();

    const rows = (service as any).buildYearlyInvestments(
      {
        aikajaksoVuosia: 2,
        userInvestments: [
          { year: 2024, amount: 1000 },
          {
            year: 2025,
            amount: 2000,
            category: 'network',
            investmentType: 'replacement',
            confidence: 'high',
            note: 'Trunk line renewal',
          },
        ],
        vuosiYlikirjoitukset: {},
      },
      2024,
    );

    expect(rows).toEqual([
      {
        year: 2024,
        amount: 1000,
        category: null,
        investmentType: null,
        confidence: null,
        note: null,
      },
      {
        year: 2025,
        amount: 2000,
        category: 'network',
        investmentType: 'replacement',
        confidence: 'high',
        note: 'Trunk line renewal',
      },
      {
        year: 2026,
        amount: 0,
        category: null,
        investmentType: null,
        confidence: null,
        note: null,
      },
    ]);
  });

  it('keeps one category value per investment row for depreciation mapping compatibility', () => {
    const service = buildService();

    const result = (service as any).normalizeUserInvestments([
      {
        year: 2024,
        amount: 1200,
        category: 'network',
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        year: 2024,
        category: 'network',
      }),
    );
    expect(Array.isArray(result[0].category)).toBe(false);
  });
});

describe('V2Service scenario assumption override compatibility', () => {
  const ORG_ID = 'org-1';
  const SCENARIO_ID = 'scenario-1';

  it('merges explicit scenario assumption overrides into the existing forecast assumptions', async () => {
    const prisma = {
      ennuste: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const projectionsService = {
      findById: jest.fn().mockResolvedValue({
        id: SCENARIO_ID,
        userInvestments: [{ year: 2024, amount: 1000 }],
        olettamusYlikirjoitukset: {
          hintakorotus: 0.03,
          vesimaaran_muutos: -0.01,
        },
        talousarvio: { vuosi: 2024 },
        vuosiYlikirjoitukset: {},
      }),
      update: jest.fn().mockResolvedValue({}),
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

    jest
      .spyOn(service, 'getForecastScenario')
      .mockResolvedValue({ id: SCENARIO_ID } as any);

    await service.updateForecastScenario(ORG_ID, SCENARIO_ID, {
      scenarioAssumptions: {
        hintakorotus: 0,
        investointikerroin: 0.04,
      },
    });

    expect(projectionsService.update).toHaveBeenCalledWith(
      ORG_ID,
      SCENARIO_ID,
      expect.objectContaining({
        olettamusYlikirjoitukset: expect.objectContaining({
          hintakorotus: 0,
          vesimaaran_muutos: -0.01,
          investointikerroin: 0.04,
        }),
      }),
    );
  });
});

describe('V2Service forecast starter contract', () => {
  const ORG_ID = 'org-1';

  it('reuses the existing scenario-create contract for explicit name and horizon starter fields', async () => {
    const prisma = {} as any;
    const projectionsService = {
      create: jest.fn().mockResolvedValue({ id: 'scenario-1' }),
      compute: jest.fn().mockResolvedValue(undefined),
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

    jest
      .spyOn(service, 'getForecastScenario')
      .mockResolvedValue({ id: 'scenario-1' } as any);

    await service.createForecastScenario(ORG_ID, {
      name: 'Ensimmäinen skenaario',
      horizonYears: 25,
      talousarvioId: 'budget-2024',
      compute: false,
    });

    expect(projectionsService.create).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({
        nimi: 'Ensimmäinen skenaario',
        aikajaksoVuosia: 25,
        talousarvioId: 'budget-2024',
      }),
    );
    expect(projectionsService.compute).not.toHaveBeenCalled();
  });
});

describe('V2Service fee sufficiency helpers', () => {
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

  it('computes required price for zero result from first-year revenue, costs, and sold volume', () => {
    const service = buildService();

    const result = (service as any).computeRequiredPriceForZeroResult({
      revenue: 110000,
      costs: 140000,
      soldVolume: 10000,
      combinedPrice: 8,
    });

    expect(result).toBe(11);
  });
});

describe('V2Service year reconcile behavior', () => {
  const ORG_ID = 'org-1';
  const YEAR = 2024;

  it('re-applies only allowed requested VEETI data types and returns refreshed year data', async () => {
    const yearDataset = {
      year: YEAR,
      veetiId: 1535,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [{ Liikevaihto: 1000 }],
          effectiveRows: [{ Liikevaihto: 1200 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [{ Kayttomaksu: 1.5 }],
          effectiveRows: [{ Kayttomaksu: 1.5 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    };

    const prisma = {} as any;
    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest
        .fn()
        .mockResolvedValueOnce(yearDataset)
        .mockResolvedValueOnce({
          ...yearDataset,
          sourceStatus: 'VEETI',
          datasets: yearDataset.datasets.map((dataset) =>
            dataset.dataType === 'tilinpaatos'
              ? {
                  ...dataset,
                  source: 'veeti',
                  hasOverride: false,
                  reconcileNeeded: false,
                }
              : dataset,
          ),
        }),
      getExcludedYears: jest.fn().mockResolvedValue([]),
      removeOverrides: jest.fn().mockResolvedValue({ count: 1 }),
    } as any;
    const veetiBudgetGenerator = {} as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {} as any;

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

    const result = await service.reconcileImportYear(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      YEAR,
      {
        action: 'apply_veeti',
        dataTypes: ['tilinpaatos', 'unknown_type'],
      } as any,
    );

    expect(veetiEffectiveDataService.removeOverrides).toHaveBeenCalledWith(
      ORG_ID,
      1535,
      YEAR,
      ['tilinpaatos'],
    );
    expect(result.reconciledDataTypes).toEqual(['tilinpaatos']);
    expect(result.yearData.sourceStatus).toBe('VEETI');
    expect(result.status.excludedYears).toEqual([]);
  });

  it('allows VEETI reconcile for prices and both volume datasets in one request', async () => {
    const ORG_ID = 'org-1';
    const YEAR = 2024;
    const yearDataset = {
      year: YEAR,
      veetiId: 1535,
      sourceStatus: 'MIXED',
      completeness: {
        tilinpaatos: true,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: true,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'taksa',
          rawRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.75 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [{ Maara: 25000 }],
          effectiveRows: [{ Maara: 25500 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [{ Maara: 24000 }],
          effectiveRows: [{ Maara: 23800 }],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: true,
          overrideMeta: null,
        },
      ],
    };
    const prisma = {} as any;
    const projectionsService = {} as any;
    const veetiService = {} as any;
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({ orgId: ORG_ID, veetiId: 1535 }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest
        .fn()
        .mockResolvedValueOnce(yearDataset)
        .mockResolvedValueOnce({
          ...yearDataset,
          sourceStatus: 'VEETI',
          datasets: yearDataset.datasets.map((dataset) => ({
            ...dataset,
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
          })),
        }),
      getExcludedYears: jest.fn().mockResolvedValue([]),
      removeOverrides: jest.fn().mockResolvedValue({ count: 3 }),
    } as any;
    const veetiBudgetGenerator = {} as any;
    const veetiBenchmarkService = {} as any;
    const veetiSanityService = {} as any;

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

    const result = await service.reconcileImportYear(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      YEAR,
      {
        action: 'apply_veeti',
        dataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
      } as any,
    );

    expect(veetiEffectiveDataService.removeOverrides).toHaveBeenCalledWith(
      ORG_ID,
      1535,
      YEAR,
      ['taksa', 'volume_vesi', 'volume_jatevesi'],
    );
    expect(result.reconciledDataTypes).toEqual([
      'taksa',
      'volume_vesi',
      'volume_jatevesi',
    ]);
  });
});

describe('V2Service statement import manual-year regression', () => {
  const ORG_ID = 'org-1';
  const YEAR = 2024;

  it('keeps a statement-backed financial patch sync-ready without extra backend workflow flags', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        year: YEAR,
        veetiId: 1535,
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
            rawRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                RahoitustuototJaKulut: -9000,
                TilikaudenYliJaama: 4000,
              },
            ],
            effectiveRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 700000,
                AineetJaPalvelut: 175000,
                Henkilostokulut: 220000,
                LiiketoiminnanMuutKulut: 315000,
                Poistot: 182000,
                RahoitustuototJaKulut: -9000,
                TilikaudenYliJaama: 4000,
              },
            ],
            source: 'veeti',
            hasOverride: false,
            reconcileNeeded: false,
            overrideMeta: null,
          },
        ],
      }),
      upsertOverride,
    } as any;

    const service = new V2Service(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    const result = await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from statement PDF: bokslut-2024.pdf',
        financials: {
          liikevaihto: 786930.85,
          aineetJaPalvelut: 182000.12,
          henkilostokulut: 235498.71,
          liiketoiminnanMuutKulut: 322785.53,
          poistot: 186904.08,
          rahoitustuototJaKulut: -10225.3,
          tilikaudenYliJaama: 3691.35,
        },
        statementImport: {
          fileName: 'bokslut-2024.pdf',
          pageNumber: 4,
          confidence: 98,
          scannedPageCount: 5,
          matchedFields: [
            'liikevaihto',
            'henkilostokulut',
            'liiketoiminnanMuutKulut',
            'poistot',
            'rahoitustuototJaKulut',
            'tilikaudenYliJaama',
          ],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        veetiId: 1535,
        vuosi: YEAR,
        dataType: 'tilinpaatos',
        editedBy: 'user-1',
        rows: [
          expect.objectContaining({
            Liikevaihto: 786930.85,
            AineetJaPalvelut: 182000.12,
            Henkilostokulut: 235498.71,
            LiiketoiminnanMuutKulut: 322785.53,
            Poistot: 186904.08,
            RahoitustuototJaKulut: -10225.3,
            TilikaudenYliJaama: 3691.35,
            __sourceMeta: expect.objectContaining({
              reason: 'Imported from statement PDF: bokslut-2024.pdf',
              provenance: expect.objectContaining({
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: [
                  'liikevaihto',
                  'henkilostokulut',
                  'liiketoiminnanMuutKulut',
                  'poistot',
                  'rahoitustuototJaKulut',
                  'tilikaudenYliJaama',
                ],
                warnings: [],
              }),
            }),
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      year: YEAR,
      patchedDataTypes: ['tilinpaatos'],
      missingBefore: [],
      missingAfter: [],
      syncReady: true,
    });
  });

  it('stores workbook provenance and preserves untouched financial fields during selective override apply', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: 1535,
        workspaceYears: [YEAR],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        year: YEAR,
        veetiId: 1535,
        sourceStatus: 'MIXED',
        completeness: {
          tilinpaatos: true,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: true,
        },
        hasManualOverrides: true,
        hasVeetiData: true,
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 710000,
                AineetJaPalvelut: null,
                Henkilostokulut: 230000,
                LiiketoiminnanMuutKulut: 305000,
                Poistot: 180000,
                TilikaudenYliJaama: -5000,
              },
            ],
            effectiveRows: [
              {
                Vuosi: YEAR,
                Liikevaihto: 710000,
                AineetJaPalvelut: 170000,
                Henkilostokulut: 230000,
                LiiketoiminnanMuutKulut: 305000,
                Poistot: 180000,
                TilikaudenYliJaama: -5000,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: '2026-03-08T12:00:00.000Z',
              editedBy: 'user-1',
              reason: 'Previous repair',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: ['liikevaihto'],
                warnings: [],
              },
            },
          },
        ],
      }),
      upsertOverride,
    } as any;

    const service = new V2Service(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from KVA workbook: kronoby-kva.xlsx',
        financials: {
          aineetJaPalvelut: 182000.12,
        },
        workbookImport: {
          kind: 'kva_import',
          fileName: 'kronoby-kva.xlsx',
          sheetName: 'KVA totalt',
          matchedYears: [2022, 2023, 2024],
          candidateRows: [
            {
              sourceField: 'AineetJaPalvelut',
              workbookValue: 182000.12,
              action: 'apply_workbook',
            },
            {
              sourceField: 'Poistot',
              workbookValue: 180000,
              action: 'keep_veeti',
            },
          ],
          confirmedSourceFields: ['AineetJaPalvelut'],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'tilinpaatos',
        rows: [
          expect.objectContaining({
            Vuosi: YEAR,
            Liikevaihto: 710000,
            AineetJaPalvelut: 182000.12,
            Henkilostokulut: 230000,
            LiiketoiminnanMuutKulut: 305000,
            Poistot: 180000,
            TilikaudenYliJaama: -5000,
            __sourceMeta: expect.objectContaining({
              reason: 'Imported from KVA workbook: kronoby-kva.xlsx',
              provenance: expect.objectContaining({
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                sheetName: 'KVA totalt',
                matchedYears: [2022, 2023, 2024],
                confirmedSourceFields: ['AineetJaPalvelut'],
                candidateRows: [
                  {
                    sourceField: 'AineetJaPalvelut',
                    workbookValue: 182000.12,
                    action: 'apply_workbook',
                  },
                  {
                    sourceField: 'Poistot',
                    workbookValue: 180000,
                    action: 'keep_veeti',
                  },
                ],
              }),
            }),
          }),
        ],
      }),
    );
  });

  it('stores QDIS import provenance on price and volume overrides', async () => {
    const upsertOverride = jest.fn().mockResolvedValue(undefined);
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        veetiId: 1535,
        nimi: 'Water Utility',
        ytunnus: '1234567-8',
        fetchedAt: '2026-03-08T10:00:00.000Z',
        years: [YEAR],
        excludedYears: [],
      }),
      getAvailableYears: jest.fn().mockResolvedValue([
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      upsertOverride,
    } as any;

    const service = new V2Service(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn(service, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos'],
            manualDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    const result = await service.completeImportYearManually(
      ORG_ID,
      'user-1',
      ['ADMIN'],
      {
        year: YEAR,
        reason: 'Imported from QDIS PDF: qdis-2022.pdf',
        prices: {
          waterUnitPrice: 1.2,
          wastewaterUnitPrice: 2.5,
        },
        volumes: {
          soldWaterVolume: 65000,
          soldWastewaterVolume: 35000,
        },
        qdisImport: {
          fileName: 'qdis-2022.pdf',
          pageNumber: 2,
          confidence: 94,
          scannedPageCount: 2,
          matchedFields: [
            'waterUnitPrice',
            'wastewaterUnitPrice',
            'soldWaterVolume',
            'soldWastewaterVolume',
          ],
          warnings: [],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'taksa',
        rows: expect.arrayContaining([
          expect.objectContaining({
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'qdis_import',
                fileName: 'qdis-2022.pdf',
                pageNumber: 2,
                confidence: 94,
              }),
            }),
          }),
        ]),
      }),
    );
    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'volume_jatevesi',
        rows: [
          expect.objectContaining({
            Maara: 35000,
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'qdis_import',
                fileName: 'qdis-2022.pdf',
              }),
            }),
          }),
        ],
      }),
    );
    expect(result).toMatchObject({
      year: YEAR,
      patchedDataTypes: expect.arrayContaining([
        'taksa',
        'volume_vesi',
        'volume_jatevesi',
      ]),
    });
  });
});

describe('V2Service report variant regression', () => {
  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';
  const NOW = new Date('2026-03-08T12:00:00.000Z');

  const buildScenario = () => ({
    id: 'scenario-1',
    name: 'Statement-backed scenario',
    onOletus: false,
    talousarvioId: 'budget-1',
    baselineYear: 2024,
    horizonYears: 20,
    assumptions: {
      inflaatio: 0.025,
      hintakorotus: 0.03,
    },
    yearlyInvestments: [
      {
        year: 2024,
        amount: 150000,
        category: 'network',
        investmentType: 'replacement',
        confidence: 'high',
        note: 'Main line renewal',
      },
    ],
    nearTermExpenseAssumptions: [],
    thereafterExpenseAssumptions: {
      personnelPct: 2,
      energyPct: 3,
      opexOtherPct: 2,
    },
    requiredPriceTodayCombined: 3.1,
    baselinePriceTodayCombined: 2.5,
    requiredAnnualIncreasePct: 12,
    requiredPriceTodayCombinedAnnualResult: 3.2,
    requiredAnnualIncreasePctAnnualResult: 14,
    requiredPriceTodayCombinedCumulativeCash: 3.4,
    requiredAnnualIncreasePctCumulativeCash: 18,
    feeSufficiency: {
      baselineCombinedPrice: 2.5,
      annualResult: {
        requiredPriceToday: 3.2,
        requiredAnnualIncreasePct: 14,
        underfundingStartYear: 2027,
        peakDeficit: 25000,
      },
      cumulativeCash: {
        requiredPriceToday: 3.4,
        requiredAnnualIncreasePct: 18,
        underfundingStartYear: 2026,
        peakGap: 90000,
      },
    },
    years: [
      {
        year: 2024,
        revenue: 780000,
        costs: 805000,
        result: -25000,
        investments: 150000,
        combinedPrice: 2.5,
        soldVolume: 100000,
        cashflow: -45000,
        cumulativeCashflow: -45000,
        waterPrice: 1.2,
        wastewaterPrice: 1.3,
      },
    ],
    priceSeries: [],
    investmentSeries: [{ year: 2024, amount: 150000 }],
    cashflowSeries: [],
    updatedAt: NOW,
    createdAt: NOW,
  });

  const buildYearDataset = () => ({
    year: 2024,
    veetiId: 1535,
    sourceStatus: 'MIXED',
    completeness: {
      tilinpaatos: true,
      taksa: true,
      volume_vesi: true,
      volume_jatevesi: true,
    },
    hasManualOverrides: true,
    hasVeetiData: true,
    datasets: [
      {
        dataType: 'tilinpaatos',
        rawRows: [{ Liikevaihto: 700000 }],
        effectiveRows: [{ Liikevaihto: 786930.85 }],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: true,
        overrideMeta: {
          editedAt: NOW.toISOString(),
          editedBy: 'user-1',
          reason: 'Statement import',
          provenance: {
            kind: 'statement_import',
            fileName: 'bokslut-2024.pdf',
            pageNumber: 4,
            importedAt: NOW.toISOString(),
          },
        },
      },
      {
        dataType: 'taksa',
        rawRows: [{ Kayttomaksu: 2.5 }],
        effectiveRows: [{ Kayttomaksu: 2.5 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_vesi',
        rawRows: [{ Maara: 65000 }],
        effectiveRows: [{ Maara: 65000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_jatevesi',
        rawRows: [{ Maara: 35000 }],
        effectiveRows: [{ Maara: 35000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
    ],
  });

  it('returns canonical summary rows and trust/result signals from getImportYearData', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: 180000,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 786930.85,
                AineetJaPalvelut: 190000,
                Henkilostokulut: 235499,
                Poistot: 180000,
                LiiketoiminnanMuutKulut: 132000,
                TilikaudenYliJaama: 3691,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Statement import',
              provenance: {
                kind: 'statement_import',
                fileName: 'bokslut-2024.pdf',
                pageNumber: 4,
                confidence: 98,
                scannedPageCount: 5,
                matchedFields: ['liikevaihto', 'tilikaudenYliJaama'],
                warnings: [],
              },
            },
          },
        ],
      }),
    } as any;

    const service = new V2Service(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, 2024);

    expect(result.summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'revenue',
          sourceField: 'Liikevaihto',
          rawValue: 700000,
          effectiveValue: 786930.85,
          changed: true,
        }),
        expect.objectContaining({
          key: 'depreciation',
          sourceField: 'Poistot',
          rawValue: 140000,
          effectiveValue: 180000,
          changed: true,
        }),
        expect.objectContaining({
          key: 'result',
          sourceField: 'TilikaudenYliJaama',
          rawValue: 25000,
          effectiveValue: 3691,
          changed: true,
        }),
      ]),
    );
    expect(result.trustSignal).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining([
        'statement_import',
        'mixed_source',
        'result_changed',
      ]),
      changedSummaryKeys: expect.arrayContaining(['revenue', 'depreciation', 'result']),
      statementImport: expect.objectContaining({
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(result.subrowAvailability).toEqual({
      truthfulSubrowsAvailable: false,
      reason: 'year_summary_only',
      rawRowCount: 1,
      effectiveRowCount: 1,
    });
    expect(result.resultToZero).toMatchObject({
      rawValue: 25000,
      effectiveValue: 3691,
      delta: -21309,
      absoluteGap: 3691,
      marginPct: 0.47,
      direction: 'above_zero',
    });
  });

  it('surfaces workbook provenance separately from generic manual overrides in getImportYearData', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: null,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 700000,
                AineetJaPalvelut: 182000.12,
                Henkilostokulut: 120000,
                Poistot: 140000,
                LiiketoiminnanMuutKulut: 140000,
                TilikaudenYliJaama: 25000,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Workbook repair',
              provenance: {
                kind: 'kva_import',
                fileName: 'kronoby-kva.xlsx',
                pageNumber: null,
                confidence: null,
                scannedPageCount: null,
                matchedFields: ['AineetJaPalvelut'],
                warnings: [],
                sheetName: 'KVA totalt',
                matchedYears: [2022, 2023, 2024],
                confirmedSourceFields: ['AineetJaPalvelut'],
                candidateRows: [
                  {
                    sourceField: 'AineetJaPalvelut',
                    workbookValue: 182000.12,
                    action: 'apply_workbook',
                  },
                ],
              },
            },
          },
        ],
      }),
    } as any;

    const service = new V2Service(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, 2024);

    expect(result.summaryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'materialsCosts',
          sourceField: 'AineetJaPalvelut',
          rawValue: null,
          effectiveValue: 182000.12,
          changed: true,
        }),
      ]),
    );
    expect(result.trustSignal).toMatchObject({
      level: 'material',
      reasons: expect.arrayContaining(['workbook_import', 'mixed_source']),
      workbookImport: expect.objectContaining({
        kind: 'kva_import',
        fileName: 'kronoby-kva.xlsx',
        sheetName: 'KVA totalt',
        confirmedSourceFields: ['AineetJaPalvelut'],
      }),
      statementImport: null,
    });
    expect(result.datasets[0]?.overrideMeta?.provenance).toMatchObject({
      kind: 'kva_import',
      fileName: 'kronoby-kva.xlsx',
      candidateRows: [
        {
          sourceField: 'AineetJaPalvelut',
          workbookValue: 182000.12,
          action: 'apply_workbook',
        },
      ],
    });
  });

  it('keeps statement-backed baseline provenance and public-summary sections across report create and readback', async () => {
    let createdReport: any = null;
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdReport = {
            id: 'report-1',
            orgId: ORG_ID,
            title: data.title,
            createdAt: NOW,
            baselineYear: data.baselineYear,
            requiredPriceToday: data.requiredPriceToday,
            requiredAnnualIncreasePct: data.requiredAnnualIncreasePct,
            totalInvestments: data.totalInvestments,
            snapshotJson: data.snapshotJson,
          };
          return createdReport;
        }),
        findMany: jest.fn().mockImplementation(async () =>
          createdReport
            ? [
                {
                  ...createdReport,
                  ennuste: {
                    id: 'scenario-1',
                    nimi: 'Statement-backed scenario',
                  },
                },
              ]
            : [],
        ),
        findFirst: jest.fn().mockImplementation(async () =>
          createdReport
            ? {
                ...createdReport,
                ennuste: {
                  id: 'scenario-1',
                  nimi: 'Statement-backed scenario',
                },
              }
            : null,
        ),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(buildYearDataset()),
    } as any;

    const service = new V2Service(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn(service, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);
    jest.spyOn(service, 'getImportStatus').mockResolvedValue({
      years: [
        {
          vuosi: 2024,
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: ['tilinpaatos'],
          },
        },
      ],
      excludedYears: [],
    } as any);

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      computedFromUpdatedAt: NOW.toISOString(),
      variant: 'public_summary',
    });

    const listedReports = await service.listReports(ORG_ID);

    const createArgs = (prisma.ennusteReport.create as jest.Mock).mock.calls[0][0];
    const snapshot = createArgs.data.snapshotJson as any;

    expect(snapshot.reportVariant).toBe('public_summary');
    expect(snapshot.reportSections).toMatchObject({
      baselineSources: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(snapshot.baselineSourceSummary.financials).toMatchObject({
      source: 'manual',
      provenance: expect.objectContaining({
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(snapshot.baselineSourceSummary.prices).toMatchObject({
      source: 'veeti',
    });
    expect(listedReports[0]?.baselineSourceSummary).toMatchObject({
      sourceStatus: 'MIXED',
      financials: expect.objectContaining({
        source: 'manual',
        provenance: expect.objectContaining({
          kind: 'statement_import',
          fileName: 'bokslut-2024.pdf',
        }),
      }),
    });

    const report = await service.getReport(ORG_ID, 'report-1');

    expect(report.variant).toBe('public_summary');
    expect(report.snapshot.reportSections).toMatchObject({
      baselineSources: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(report.snapshot.baselineSourceSummary?.financials.provenance).toMatchObject(
      {
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      },
    );
  });
});
