import { BadRequestException } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2ReportService } from './v2-report.service';
import { V2Service } from './v2.service';

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
    veetiBudgets?: Array<{
      id: string;
      nimi: string;
      vuosi?: number;
      veetiVuosi?: number | null;
      lahde?: string | null;
    }>;
    linkedScenarios?: Array<{ id: string; nimi: string }>;
    scenarioBaselineYears?: number[];
    scenarioBaselineBudgets?: Array<{
      vuosi?: number;
      veetiVuosi?: number | null;
      lahde?: string | null;
    }>;
    yearPolicies?: Array<{
      vuosi: number;
      excluded?: boolean;
      includedInPlanningBaseline?: boolean;
    }>;
  }) => {
    const excludedYearSet = new Set<number>(options?.excludedYears ?? [2023]);
    const availableYears = (options?.availableYears ?? [2023, 2024]).map(
      readyYear,
    );
    const budgetRows = (options?.veetiBudgets ?? []).map((row) => ({
      lahde: 'veeti',
      vuosi: row.veetiVuosi ?? row.vuosi ?? 0,
      veetiVuosi: row.veetiVuosi ?? row.vuosi ?? null,
      ...row,
    }));
    const scenarioBaselineYears = options?.scenarioBaselineYears ?? [];
    const scenarioBaselineBudgets =
      options?.scenarioBaselineBudgets ??
      scenarioBaselineYears.map((year) => ({
        vuosi: year,
        veetiVuosi: year,
        lahde: 'veeti',
      }));
    const yearPolicyState = new Map<
      number,
      { excluded: boolean; includedInPlanningBaseline: boolean }
    >();
    for (const year of excludedYearSet) {
      yearPolicyState.set(year, {
        excluded: true,
        includedInPlanningBaseline: false,
      });
    }
    for (const row of options?.yearPolicies ?? []) {
      yearPolicyState.set(row.vuosi, {
        excluded: row.excluded === true,
        includedInPlanningBaseline: row.includedInPlanningBaseline === true,
      });
      if (row.excluded === true) {
        excludedYearSet.add(row.vuosi);
      } else {
        excludedYearSet.delete(row.vuosi);
      }
    }
    let linked = true;
    let workspaceYears = [...(options?.workspaceYears ?? [])].sort(
      (a, b) => a - b,
    );

    const veetiSnapshotDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiOverrideDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const talousarvioDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const ennusteDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const veetiYearPolicyDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const vesinvestPlanSeriesDeleteMany = jest.fn().mockResolvedValue({
      count: 1,
    });
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
        const current = yearPolicyState.get(year);
        if (args.where.excluded === true && current?.excluded === true) {
          const next = {
            excluded:
              typeof args.data?.excluded === 'boolean'
                ? args.data.excluded
                : current.excluded,
            includedInPlanningBaseline:
              typeof args.data?.includedInPlanningBaseline === 'boolean'
                ? args.data.includedInPlanningBaseline
                : current.includedInPlanningBaseline,
          };
          yearPolicyState.set(year, next);
          if (next.excluded) {
            excludedYearSet.add(year);
          } else {
            excludedYearSet.delete(year);
          }
          return { count: 1 };
        }
        return { count: 0 };
      });
    const veetiYearPolicyFindMany = jest
      .fn()
      .mockImplementation(async (args?: any) => {
        let rows = [...yearPolicyState.entries()].map(([vuosi, state]) => ({
          vuosi,
          excluded: state.excluded,
          includedInPlanningBaseline: state.includedInPlanningBaseline,
        }));
        const filterYears = args?.where?.vuosi?.in;
        if (Array.isArray(filterYears)) {
          const filterSet = new Set(filterYears);
          rows = rows.filter((row) => filterSet.has(row.vuosi));
        }
        if (args?.where?.excluded === true) {
          rows = rows.filter((row) => row.excluded === true);
        }
        if (args?.select) {
          return rows.map((row) =>
            Object.fromEntries(
              Object.entries(args.select)
                .filter(([, selected]) => selected)
                .map(([key]) => [key, row[key as keyof typeof row]]),
            ),
          );
        }
        return rows;
      });
    const veetiYearPolicyUpsert = jest
      .fn()
      .mockImplementation(async (args: any) => {
        const year = args.where.orgId_veetiId_vuosi.vuosi;
        const current = yearPolicyState.get(year) ?? {
          excluded: false,
          includedInPlanningBaseline: false,
        };
        const payload = yearPolicyState.has(year) ? args.update : args.create;
        const next = {
          excluded:
            typeof payload?.excluded === 'boolean'
              ? payload.excluded
              : current.excluded,
          includedInPlanningBaseline:
            typeof payload?.includedInPlanningBaseline === 'boolean'
              ? payload.includedInPlanningBaseline
              : current.includedInPlanningBaseline,
        };
        yearPolicyState.set(year, next);
        if (next.excluded) {
          excludedYearSet.add(year);
        } else {
          excludedYearSet.delete(year);
        }
        return { id: `policy-${year}`, vuosi: year, ...next };
      });
    const talousarvioFindMany = jest.fn().mockImplementation(async (args?: any) => {
      let rows = [...budgetRows];
      if (args?.where?.lahde) {
        rows = rows.filter((row) => row.lahde === args.where.lahde);
      }
      if (Array.isArray(args?.where?.id?.in)) {
        const idSet = new Set(args.where.id.in);
        rows = rows.filter((row) => idSet.has(row.id));
      }
      if (Array.isArray(args?.where?.OR)) {
        rows = rows.filter((row) =>
          args.where.OR.some((condition: any) => {
            if (condition.veetiVuosi?.in) {
              return condition.veetiVuosi.in.includes(row.veetiVuosi);
            }
            if (condition.vuosi?.in) {
              return condition.vuosi.in.includes(row.vuosi);
            }
            if (typeof condition.veetiVuosi === 'number') {
              return row.veetiVuosi === condition.veetiVuosi;
            }
            if (Array.isArray(condition.AND)) {
              return condition.AND.every((clause: any) => {
                if (clause.lahde) {
                  return row.lahde === clause.lahde;
                }
                if (typeof clause.vuosi === 'number') {
                  return row.vuosi === clause.vuosi;
                }
                return true;
              });
            }
            return false;
          }),
        );
      }
      if (args?.select) {
        return rows.map((row) =>
          Object.fromEntries(
            Object.entries(args.select)
              .filter(([, selected]) => selected)
              .map(([key]) => [key, row[key as keyof typeof row]]),
          ),
        );
      }
      return rows;
    });
    const talousarvioFindFirst = jest
      .fn()
      .mockImplementation(async (args?: any) => {
        const rows = await talousarvioFindMany(args);
        return [...rows].sort(
          (a, b) =>
            Number(b.veetiVuosi ?? b.vuosi ?? 0) -
              Number(a.veetiVuosi ?? a.vuosi ?? 0) || 0,
        )[0] ?? null;
      });
    const ennusteFindMany = jest.fn().mockImplementation(async (args?: any) => {
      if (Array.isArray(args?.where?.talousarvioId?.in)) {
        return options?.linkedScenarios ?? [];
      }
      if (args?.select?.talousarvio) {
        return scenarioBaselineBudgets.map((row) => ({
          talousarvio: {
            vuosi: row.vuosi ?? row.veetiVuosi ?? 0,
            veetiVuosi: row.veetiVuosi ?? row.vuosi ?? null,
            lahde: row.lahde ?? 'veeti',
          },
        }));
      }
      return options?.linkedScenarios ?? [];
    });

    const prisma = {
      talousarvio: {
        findMany: talousarvioFindMany,
        findFirst: talousarvioFindFirst,
        deleteMany: talousarvioDeleteMany,
      },
      ennuste: {
        findMany: ennusteFindMany,
        deleteMany: ennusteDeleteMany,
      },
      veetiSnapshot: {
        deleteMany: veetiSnapshotDeleteMany,
      },
      veetiOverride: {
        deleteMany: veetiOverrideDeleteMany,
      },
      veetiYearPolicy: {
        findMany: veetiYearPolicyFindMany,
        upsert: veetiYearPolicyUpsert,
        updateMany: veetiYearPolicyUpdateMany,
        deleteMany: veetiYearPolicyDeleteMany,
      },
      vesinvestPlanSeries: {
        deleteMany: vesinvestPlanSeriesDeleteMany,
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
      getEffectiveRows: jest
        .fn()
        .mockResolvedValue({ rows: [] as Array<Record<string, unknown>> }),
      getYearDataset: jest.fn().mockResolvedValue({
        datasets: [],
        sourceStatus: 'INCOMPLETE',
        sourceBreakdown: {
          veetiDataTypes: [],
          manualDataTypes: [],
        },
      }),
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

    const service = buildFacadeService({ prisma, projectionsService, veetiService, veetiSyncService, veetiEffectiveDataService, veetiBudgetGenerator, veetiBenchmarkService, veetiSanityService });

    return {
      service,
      excludedYearSet,
      mocks: {
        prisma,
        veetiService,
        veetiSyncService,
        veetiEffectiveDataService,
        veetiBudgetGenerator,
        veetiYearPolicyFindMany,
        veetiYearPolicyUpsert,
        veetiYearPolicyUpdateMany,
        vesinvestPlanSeriesDeleteMany,
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
    expect(result.acceptedPlanningBaselineYears).toEqual([2024]);
    expect(mocks.veetiYearPolicyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          vuosi: 2024,
          includedInPlanningBaseline: true,
        }),
        update: expect.objectContaining({
          includedInPlanningBaseline: true,
        }),
      }),
    );
  });

  it('treats workbook-backed finance rows as baseline-ready even when the raw year row lacks tilinpaatos completeness', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2024],
      workspaceYears: [2024],
    });
    mocks.veetiSyncService.getAvailableYears.mockResolvedValue([
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: false,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: false,
        },
      },
    ]);
    mocks.veetiEffectiveDataService.getYearDataset.mockResolvedValue({
      year: 2024,
      veetiId: 1535,
      sourceStatus: 'MANUAL',
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [],
          effectiveRows: [
            {
              Vuosi: 2024,
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              LiiketoiminnanMuutKulut: 18000,
              Poistot: 5000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [],
          effectiveRows: [{ Maara: 25000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [],
          effectiveRows: [],
          source: 'none',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });

    const result = await service.createPlanningBaseline(ORG_ID, [2024]);

    expect(mocks.veetiBudgetGenerator.generateBudgets).toHaveBeenCalledWith(
      ORG_ID,
      [2024],
    );
    expect(result.includedYears).toEqual([2024]);
  });

  it('marks workbook-backed accepted baseline years as complete in planning context quality', async () => {
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [2024],
      workspaceYears: [2024],
      veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 }],
      yearPolicies: [
        { vuosi: 2024, excluded: false, includedInPlanningBaseline: true },
      ],
    });
    mocks.veetiSyncService.getAvailableYears.mockResolvedValue([
      {
        vuosi: 2024,
        completeness: {
          tilinpaatos: false,
          taksa: true,
          volume_vesi: true,
          volume_jatevesi: false,
        },
        baselineReady: true,
        baselineMissingRequirements: [],
        baselineWarnings: [],
      },
    ]);
    mocks.veetiEffectiveDataService.getYearDataset.mockResolvedValue({
      year: 2024,
      veetiId: 1535,
      sourceStatus: 'MANUAL',
      completeness: {
        tilinpaatos: false,
        taksa: true,
        volume_vesi: true,
        volume_jatevesi: false,
      },
      hasManualOverrides: true,
      hasVeetiData: true,
      datasets: [
        {
          dataType: 'tilinpaatos',
          rawRows: [],
          effectiveRows: [
            {
              Vuosi: 2024,
              Liikevaihto: 100000,
              AineetJaPalvelut: 15000,
              Henkilostokulut: 20000,
              LiiketoiminnanMuutKulut: 18000,
              Poistot: 5000,
            },
          ],
          source: 'manual',
          hasOverride: true,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'taksa',
          rawRows: [],
          effectiveRows: [{ Tyyppi_Id: 1, Kayttomaksu: 2.5 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_vesi',
          rawRows: [],
          effectiveRows: [{ Maara: 25000 }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
        {
          dataType: 'volume_jatevesi',
          rawRows: [],
          effectiveRows: [],
          source: 'none',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });

    const context = await service.getPlanningContext(ORG_ID);

    expect(context.baselineYears[0]).toMatchObject({
      year: 2024,
      quality: 'complete',
    });
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

    expect(mocks.veetiSyncService.getStatus).toHaveBeenCalledWith(ORG_ID);
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
    const { service, mocks } = buildService({
      workspaceYears: [2024, 2023],
      yearPolicies: [
        { vuosi: 2023, excluded: true, includedInPlanningBaseline: false },
        { vuosi: 2024, excluded: false, includedInPlanningBaseline: true },
      ],
    });

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
    expect(status.planningBaselineYears).toEqual([2024]);
    expect(status.link).toMatchObject({
      veetiId: 1535,
      kieliId: 2,
      uiLanguage: 'sv',
    });
  });

  it('marks the current year as an estimate candidate and excludes future years from import status', async () => {
    const currentYear = new Date().getFullYear();
    const { service } = buildService({
      availableYears: [currentYear - 1, currentYear, currentYear + 1],
      workspaceYears: [],
    });

    const status = await service.getImportStatus(ORG_ID);

    expect(status.availableYears.map((row) => row.vuosi)).toEqual([
      currentYear - 1,
      currentYear,
    ]);
    expect(
      status.availableYears.map((row) => [row.vuosi, row.planningRole]),
    ).toEqual([
      [currentYear - 1, 'historical'],
      [currentYear, 'current_year_estimate'],
    ]);
  });

  it('imports the current-year estimate into workspaceYears without generating budgets', async () => {
    const currentYear = new Date().getFullYear();
    const { service, mocks } = buildService({
      excludedYears: [],
      availableYears: [currentYear - 1, currentYear],
      workspaceYears: [currentYear - 1],
    });

    const result = await service.importYears(ORG_ID, [currentYear]);

    expect(result.importedYears).toEqual([currentYear]);
    expect(result.workspaceYears).toEqual([currentYear - 1, currentYear]);
    expect(mocks.veetiBudgetGenerator.generateBudgets).not.toHaveBeenCalled();
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

  it('limits planning context baseline years to accepted planning baseline years only', async () => {
    const { service } = buildService({
      excludedYears: [],
      availableYears: [2015, 2024],
      workspaceYears: [2015, 2024],
      veetiBudgets: [
        { id: 'budget-2015', nimi: 'VEETI 2015', vuosi: 2015 },
        { id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 },
      ],
      yearPolicies: [
        { vuosi: 2015, excluded: false, includedInPlanningBaseline: false },
        { vuosi: 2024, excluded: false, includedInPlanningBaseline: true },
      ],
    });

    const context = await service.getPlanningContext(ORG_ID);

    expect(context.baselineYears.map((row) => row.year)).toEqual([2024]);
    expect(context.baselineYears[0]?.planningRole).toBe('historical');
    expect(context.canCreateScenario).toBe(true);
  });

  it('propagates the current-year estimate role into planning context baseline years', async () => {
    const currentYear = new Date().getFullYear();
    const { service } = buildService({
      excludedYears: [],
      availableYears: [currentYear],
      workspaceYears: [currentYear],
      veetiBudgets: [
        {
          id: `budget-${currentYear}`,
          nimi: `VEETI ${currentYear}`,
          vuosi: currentYear,
        },
      ],
      yearPolicies: [
        {
          vuosi: currentYear,
          excluded: false,
          includedInPlanningBaseline: true,
        },
      ],
    });

    const context = await service.getPlanningContext(ORG_ID);

    expect(context.baselineYears).toHaveLength(1);
    expect(context.baselineYears[0]).toMatchObject({
      year: currentYear,
      planningRole: 'current_year_estimate',
    });
  });

  it('backfills accepted planning baseline years from workspace VEETI budgets and workspace scenario-linked baseline years', async () => {
    const { service } = buildService({
      excludedYears: [],
      availableYears: [2015, 2024],
      workspaceYears: [2015, 2024],
      veetiBudgets: [
        { id: 'budget-2015', nimi: 'VEETI 2015', vuosi: 2015 },
        { id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 },
      ],
      scenarioBaselineYears: [2015],
      yearPolicies: [],
    });

    const status = await service.getImportStatus(ORG_ID);

    expect(status.planningBaselineYears).toEqual([2015, 2024]);
  });

  it('does not backfill accepted planning baseline years from non-VEETI scenario budgets', async () => {
    const { service } = buildService({
      excludedYears: [],
      availableYears: [2015, 2024],
      workspaceYears: [2015, 2024],
      veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 }],
      scenarioBaselineBudgets: [{ vuosi: 2015, veetiVuosi: null, lahde: 'manual' }],
      yearPolicies: [],
    });

    const status = await service.getImportStatus(ORG_ID);

    expect(status.planningBaselineYears).toEqual([2024]);
  });

  it('rejects scenario creation when explicit baseline budget is outside the accepted planning baseline', async () => {
    const { service } = buildService({
      excludedYears: [],
      workspaceYears: [2024],
      veetiBudgets: [
        { id: 'budget-2015', nimi: 'VEETI 2015', vuosi: 2015 },
        { id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 },
      ],
      yearPolicies: [
        { vuosi: 2024, excluded: false, includedInPlanningBaseline: true },
      ],
    });

    await expect(
      service.createForecastScenario(ORG_ID, {
        name: 'Scenario',
        talousarvioId: 'budget-2015',
        compute: false,
      }),
    ).rejects.toThrow(/accepted planning baseline/i);
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
      veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024', vuosi: 2024 }],
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
    expect(mocks.vesinvestPlanSeriesDeleteMany).toHaveBeenCalledWith({
      where: { orgId: ORG_ID },
    });
    expect(result).toMatchObject({
      deletedScenarios: 1,
      deletedVeetiBudgets: 1,
      deletedVeetiSnapshots: 1,
      deletedVeetiOverrides: 1,
      deletedVeetiYearPolicies: 1,
      deletedVesinvestPlanSeries: 1,
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

describe('V2Service scenario update merge-safety', () => {
  const buildService = () =>
    buildFacadeFromArgs(
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

    const result = ((service as any).forecastService as any).buildYearOverrides(
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
    buildFacadeFromArgs(
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

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
      { year: 2024, amount: 1200 },
    ]);

    expect(result).toEqual([
      {
        rowId: 'investment-2024-0',
        year: 2024,
        amount: 1200,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
    ]);
  });

  it('builds yearly investment rows that preserve structured metadata while keeping legacy years compatible', () => {
    const service = buildService();

    const rows = ((service as any).forecastService as any).buildYearlyInvestments(
      {
        aikajaksoVuosia: 2,
        userInvestments: [
          { year: 2024, amount: 1000 },
          {
            year: 2025,
            amount: 2000,
            target: 'Wastewater plant',
            category: 'network',
            investmentType: 'replacement',
            confidence: 'high',
            waterAmount: 1200,
            wastewaterAmount: 800,
            note: 'Trunk line renewal',
          },
        ],
        vuosiYlikirjoitukset: {},
      },
      2024,
    );

    expect(rows).toEqual([
      {
        rowId: 'investment-2024-0',
        year: 2024,
        amount: 1000,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
      {
        rowId: 'investment-2025-1',
        year: 2025,
        amount: 2000,
        target: 'Wastewater plant',
        category: 'network',
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: 'replacement',
        confidence: 'high',
        waterAmount: 1200,
        wastewaterAmount: 800,
        note: 'Trunk line renewal',
      },
      {
        rowId: 'year-2026',
        year: 2026,
        amount: 0,
        target: null,
        category: null,
        groupKey: null,
        accountKey: null,
        reportGroupKey: null,
        projectCode: null,
        vesinvestPlanId: null,
        vesinvestProjectId: null,
        allocationId: null,
        depreciationClassKey: null,
        depreciationRuleSnapshot: null,
        investmentType: null,
        confidence: null,
        waterAmount: null,
        wastewaterAmount: null,
        note: null,
      },
    ]);
  });

  it('keeps one category value per investment row for depreciation mapping compatibility', () => {
    const service = buildService();

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
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

  it('preserves investment program target and service split fields', () => {
    const service = buildService();

    const result = ((service as any).forecastService as any).normalizeUserInvestments([
      {
        year: 2024,
        amount: 1200,
        target: 'Main line renewal',
        category: 'network',
        waterAmount: 700,
        wastewaterAmount: 500,
        note: 'Phase 1',
      },
    ]);

    expect(result[0]).toEqual(
      expect.objectContaining({
        year: 2024,
        amount: 1200,
        target: 'Main line renewal',
        category: 'network',
        waterAmount: 700,
        wastewaterAmount: 500,
        note: 'Phase 1',
      }),
    );
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
      .spyOn((service as any).forecastService, 'getForecastScenario')
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
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'scenario-1' }),
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
      .spyOn((service as any).forecastService, 'getForecastScenario')
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

  it('falls back to a neutral default scenario name when none is provided', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-19T12:00:00.000Z'));
    const prisma = {} as any;
    const projectionsService = {
      list: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'scenario-1' }),
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
      .spyOn((service as any).forecastService, 'getForecastScenario')
      .mockResolvedValue({ id: 'scenario-1' } as any);

    try {
      await service.createForecastScenario(ORG_ID, {
        talousarvioId: 'budget-2024',
        compute: false,
      });

      expect(projectionsService.create).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({
          nimi: 'Scenario 2026-03-19',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });
});

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

describe('V2Service fee sufficiency helpers', () => {
  const buildService = () =>
    buildFacadeFromArgs(
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

    const result = ((service as any).forecastService as any).computeRequiredPriceForZeroResult({
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
            tariff_revenue: true,
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
        })
        .mockResolvedValue({
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

    const service = buildFacadeService({ prisma, projectionsService, veetiService, veetiSyncService, veetiEffectiveDataService, veetiBudgetGenerator, veetiBenchmarkService, veetiSanityService });

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
            tariff_revenue: true,
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

    const service = buildFacadeService({ prisma, projectionsService, veetiService, veetiSyncService, veetiEffectiveDataService, veetiBudgetGenerator, veetiBenchmarkService, veetiSanityService });

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

describe('V2Service workbook preview regression', () => {
  const ORG_ID = 'org-1';
  const VEETI_ID = 1535;

  const buildWorkbookFixtureBuffer = async () => {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('KVA totalt');
    sheet.addRows([
      ['Rad', 2022, 2023, 2024],
      ['Omsättning', 610000, 700000, 790000],
      ['Material och tjänster', 12000, 25000, 60000],
      ['Personalkostnader', 220000, 234000, 235000],
      ['Avskrivningar och nedskrivningar', 180000, 186000, 186000],
      ['Övriga rörelsekostnader', 300000, 320000, 323000],
      [
        'Vinst (- förlust) före bokslutsdepositioner och skatter',
        15000,
        -80000,
        4000,
      ],
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  };

  it('parses the six shared KVA rows and matches them to imported workspace years', async () => {
    const fileBuffer = await buildWorkbookFixtureBuffer();
    const veetiSyncService = {
      getStatus: jest.fn().mockResolvedValue({
        orgId: ORG_ID,
        veetiId: VEETI_ID,
        workspaceYears: [2022, 2023, 2024],
      }),
    } as any;

    const buildYearDataset = (
      year: number,
      financials: Record<string, unknown>,
    ) => ({
      year,
      veetiId: VEETI_ID,
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
          rawRows: [{ Vuosi: year, ...financials }],
          effectiveRows: [{ Vuosi: year, ...financials }],
          source: 'veeti',
          hasOverride: false,
          reconcileNeeded: false,
          overrideMeta: null,
        },
      ],
    });

    const yearDatasets = new Map([
      [
        2022,
        buildYearDataset(2022, {
          Liikevaihto: 610000,
          Henkilostokulut: 220000,
          Poistot: 180000,
          LiiketoiminnanMuutKulut: 300000,
          TilikaudenYliJaama: 15000,
        }),
      ],
      [
        2023,
        buildYearDataset(2023, {
          Liikevaihto: 700000,
          AineetJaPalvelut: 25000,
          Henkilostokulut: 234000,
          Poistot: 186000,
          LiiketoiminnanMuutKulut: 320000,
          TilikaudenYliJaama: -80000,
        }),
      ],
      [
        2024,
        buildYearDataset(2024, {
          Liikevaihto: 790000,
          AineetJaPalvelut: 60000,
          Henkilostokulut: 235000,
          Poistot: 186000,
          LiiketoiminnanMuutKulut: 323000,
          TilikaudenYliJaama: 4000,
        }),
      ],
    ]);

    const veetiEffectiveDataService = {
      getAvailableYears: jest.fn().mockResolvedValue([
        { vuosi: 2022 },
        { vuosi: 2023 },
        { vuosi: 2024 },
      ]),
      getYearDataset: jest
        .fn()
        .mockImplementation(async (_orgId: string, year: number) => {
          const dataset = yearDatasets.get(year);
          if (!dataset) {
            throw new Error(`Missing test dataset for year ${year}`);
          }
          return dataset;
        }),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.previewWorkbookImport(ORG_ID, {
      fileName: 'kronoby-kva.xlsx',
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: fileBuffer.length,
      fileBuffer,
    });

    expect(result.sheetName).toBe('KVA totalt');
    expect(result.importedYears).toEqual([2022, 2023, 2024]);
    expect(result.matchedYears).toEqual([2022, 2023, 2024]);
    expect(result.workbookYears).toEqual([2022, 2023, 2024]);
    expect(result.years).toHaveLength(3);
    expect(result.years[0]?.rows.map((row) => row.sourceField)).toEqual([
      'Liikevaihto',
      'AineetJaPalvelut',
      'Henkilostokulut',
      'Poistot',
      'LiiketoiminnanMuutKulut',
      'TilikaudenYliJaama',
    ]);
    expect(
      result.years
        .find((row) => row.year === 2022)
        ?.rows.find((row) => row.sourceField === 'AineetJaPalvelut'),
    ).toMatchObject({
      currentValue: null,
      workbookValue: 12000,
      currentSource: 'missing',
      suggestedAction: 'apply_workbook',
    });
    expect(
      result.years
        .find((row) => row.year === 2024)
        ?.rows.find((row) => row.sourceField === 'AineetJaPalvelut'),
    ).toMatchObject({
      currentValue: 60000,
      workbookValue: 60000,
      differs: false,
      suggestedAction: 'keep_veeti',
    });
    expect(
      result.years
        .find((row) => row.year === 2024)
        ?.rows.find((row) => row.sourceField === 'TilikaudenYliJaama'),
    ).toMatchObject({
      workbookValue: 4000,
    });
    expect(result.canApply).toBe(true);
  });

  it('rejects workbook previews that are not OpenXML workbook uploads', async () => {
    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {
        getStatus: jest.fn().mockResolvedValue({
          orgId: ORG_ID,
          veetiId: VEETI_ID,
          workspaceYears: [2024],
        }),
      } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.previewWorkbookImport(ORG_ID, {
        fileName: 'kronoby-kva.csv',
        contentType: 'text/csv',
        sizeBytes: 12,
        fileBuffer: Buffer.from('not-a-workbook'),
      }),
    ).rejects.toThrow('Workbook preview only supports .xlsx or .xlsm uploads.');
  });
});

describe('V2Service upload validation', () => {
  const ORG_ID = 'org-1';

  it('rejects oversized statement preview uploads before parser work', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn(),
    } as any;
    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.previewStatementImport(ORG_ID, 2024, {
        fileName: 'bokslut-2024.pdf',
        contentType: 'application/pdf',
        sizeBytes: 10 * 1024 * 1024 + 1,
        fileBuffer: Buffer.from('%PDF-1.7\nstub'),
      }),
    ).rejects.toThrow('Uploaded file exceeds the 10485760 byte limit.');
    expect(veetiEffectiveDataService.getYearDataset).not.toHaveBeenCalled();
  });

  it('rejects statement previews whose content is not actually a PDF', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn(),
    } as any;
    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(
      service.previewStatementImport(ORG_ID, 2024, {
        fileName: 'bokslut-2024.pdf',
        contentType: 'application/pdf',
        sizeBytes: 14,
        fileBuffer: Buffer.from('not-a-real-pdf'),
      }),
    ).rejects.toThrow('Statement preview only supports PDF uploads.');
    expect(veetiEffectiveDataService.getYearDataset).not.toHaveBeenCalled();
  });
});

describe('V2Service statement import manual-year regression', () => {
  const ORG_ID = 'org-1';
  const YEAR = 2024;
  const buildTariffYearDataset = (params?: {
    revenue?: number;
    fixedRevenue?: number | null;
    waterPrice?: number;
    wastewaterPrice?: number;
    soldWaterVolume?: number;
    soldWastewaterVolume?: number;
  }) => ({
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
            Liikevaihto: params?.revenue ?? 100000,
            PerusmaksuYhteensa: params?.fixedRevenue ?? null,
            AineetJaPalvelut: 15000,
            Henkilostokulut: 20000,
            LiiketoiminnanMuutKulut: 18000,
            Poistot: 5000,
            TilikaudenYliJaama: 30000,
          },
        ],
        effectiveRows: [
          {
            Vuosi: YEAR,
            Liikevaihto: params?.revenue ?? 100000,
            PerusmaksuYhteensa: params?.fixedRevenue ?? null,
            AineetJaPalvelut: 15000,
            Henkilostokulut: 20000,
            LiiketoiminnanMuutKulut: 18000,
            Poistot: 5000,
            TilikaudenYliJaama: 30000,
          },
        ],
        source: 'manual',
        hasOverride: true,
        reconcileNeeded: true,
        overrideMeta: null,
      },
      {
        dataType: 'taksa',
        rawRows: [
          { Tyyppi_Id: 1, Kayttomaksu: params?.waterPrice ?? 2.5 },
          { Tyyppi_Id: 2, Kayttomaksu: params?.wastewaterPrice ?? 3.1 },
        ],
        effectiveRows: [
          { Tyyppi_Id: 1, Kayttomaksu: params?.waterPrice ?? 2.5 },
          { Tyyppi_Id: 2, Kayttomaksu: params?.wastewaterPrice ?? 3.1 },
        ],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_vesi',
        rawRows: [{ Maara: params?.soldWaterVolume ?? 25000 }],
        effectiveRows: [{ Maara: params?.soldWaterVolume ?? 25000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
      {
        dataType: 'volume_jatevesi',
        rawRows: [{ Maara: params?.soldWastewaterVolume ?? 24000 }],
        effectiveRows: [{ Maara: params?.soldWastewaterVolume ?? 24000 }],
        source: 'veeti',
        hasOverride: false,
        reconcileNeeded: false,
        overrideMeta: null,
      },
    ],
  });

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
            tariff_revenue: true,
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

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
      connected: true,
      years: [
        {
          vuosi: YEAR,
          completeness: {
            tilinpaatos: true,
            taksa: true,
            tariff_revenue: true,
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
          perusmaksuYhteensa: 244000.15,
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
            PerusmaksuYhteensa: 244000.15,
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
                fieldSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'Liikevaihto',
                    provenance: expect.objectContaining({
                      kind: 'statement_import',
                    }),
                  }),
                  expect.objectContaining({
                    sourceField: 'TilikaudenYliJaama',
                    provenance: expect.objectContaining({
                      kind: 'statement_import',
                    }),
                  }),
                ]),
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
      tariffRevenueReason: null,
    });
  });

  it('returns a missing_fixed_revenue tariff reason when fixed revenue is absent', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 136900,
          fixedRevenue: null,
        }),
      ),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(false);
    expect(result.tariffRevenueReason).toBe('missing_fixed_revenue');
    expect(result.baselineReady).toBe(true);
    expect(result.baselineWarnings).toEqual(['tariffRevenueMismatch']);
  });

  it('returns a mismatch tariff reason when revenue does not reconcile after fixed revenue is present', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 100000,
          fixedRevenue: 12000,
        }),
      ),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(false);
    expect(result.tariffRevenueReason).toBe('mismatch');
    expect(result.baselineReady).toBe(true);
    expect(result.baselineWarnings).toEqual(['tariffRevenueMismatch']);
  });

  it('does not mark the financial baseline ready when Liikevaihto is zero', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 0,
          fixedRevenue: 0,
        }),
      ),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.baselineReady).toBe(false);
    expect(result.baselineMissingRequirements).toContain('financialBaseline');
  });

  it('treats explicit zero fixed revenue as a real value instead of a missing one', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 136900,
          fixedRevenue: 0,
        }),
      ),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getImportYearData(ORG_ID, YEAR);

    expect(result.completeness.tariff_revenue).toBe(true);
    expect(result.tariffRevenueReason).toBeNull();
  });

  it('includes tariff revenue mismatch metadata in refreshed status rows', async () => {
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
            tariff_revenue: false,
            volume_vesi: true,
            volume_jatevesi: true,
          },
          sourceStatus: 'MIXED',
          sourceBreakdown: {
            veetiDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
            manualDataTypes: [],
          },
          warnings: [],
        },
      ]),
    } as any;
    const veetiEffectiveDataService = {
      getExcludedYears: jest.fn().mockResolvedValue([]),
      getYearDataset: jest.fn().mockResolvedValue(
        buildTariffYearDataset({
          revenue: 100000,
          fixedRevenue: 12000,
        }),
      ),
    } as any;

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    const status = await service.getImportStatus(ORG_ID);

    expect(status.years[0]).toMatchObject({
      vuosi: YEAR,
      baselineReady: true,
      baselineWarnings: ['tariffRevenueMismatch'],
      tariffRevenueReason: 'mismatch',
    });
    expect(status.years[0].missingRequirements).toContain('tariffRevenue');
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

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
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
                fieldSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'Liikevaihto',
                    provenance: expect.objectContaining({
                      kind: 'statement_import',
                      fileName: 'bokslut-2024.pdf',
                    }),
                  }),
                  expect.objectContaining({
                    sourceField: 'AineetJaPalvelut',
                    provenance: expect.objectContaining({
                      kind: 'kva_import',
                      fileName: 'kronoby-kva.xlsx',
                    }),
                  }),
                ]),
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

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
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

  it('stores generic document provenance when one PDF patches financials and tariff data together', async () => {
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

    const service = buildFacadeFromArgs(
      {} as any,
      {} as any,
      {} as any,
      veetiSyncService,
      veetiEffectiveDataService,
      {} as any,
      {} as any,
      {} as any,
    );

    jest.spyOn((service as any).importOverviewService, 'getImportStatus').mockResolvedValue({
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
            veetiDataTypes: [],
            manualDataTypes: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'],
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
        reason: 'Imported from source document: source-2024.pdf',
        financials: {
          liikevaihto: 786930.85,
          tilikaudenYliJaama: 3691.35,
        },
        prices: {
          waterUnitPrice: 1.2,
          wastewaterUnitPrice: 2.5,
        },
        volumes: {
          soldWaterVolume: 65000,
          soldWastewaterVolume: 35000,
        },
        documentImport: {
          fileName: 'source-2024.pdf',
          pageNumber: undefined,
          pageNumbers: [1, 2],
          confidence: 91,
          scannedPageCount: 6,
          matchedFields: [
            'Liikevaihto',
            'TilikaudenYliJaama',
            'waterUnitPrice',
            'wastewaterUnitPrice',
            'soldWaterVolume',
            'soldWastewaterVolume',
          ],
          warnings: ['Generic PDF detection needs manual review before saving.'],
          documentProfile: 'generic_pdf',
          datasetKinds: ['financials', 'prices', 'volumes'],
          sourceLines: [
            {
              text: 'Omsattning 786 930,85',
              pageNumber: 2,
            },
            {
              text: 'Water 1,20 EUR/m3',
              pageNumber: 1,
            },
          ],
        },
      } as any,
    );

    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'tilinpaatos',
        rows: [
          expect.objectContaining({
            Liikevaihto: 786930.85,
            TilikaudenYliJaama: 3691.35,
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'document_import',
                fileName: 'source-2024.pdf',
                pageNumber: null,
                pageNumbers: [1, 2],
                documentProfile: 'generic_pdf',
                datasetKinds: ['financials', 'prices', 'volumes'],
                sourceLines: [
                  {
                    text: 'Omsattning 786 930,85',
                    pageNumber: 2,
                  },
                  {
                    text: 'Water 1,20 EUR/m3',
                    pageNumber: 1,
                  },
                ],
                fieldSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'Liikevaihto',
                    provenance: expect.objectContaining({
                      kind: 'document_import',
                    }),
                  }),
                ]),
              }),
            }),
          }),
        ],
      }),
    );
    expect(upsertOverride).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'taksa',
        rows: expect.arrayContaining([
          expect.objectContaining({
            __sourceMeta: expect.objectContaining({
              provenance: expect.objectContaining({
                kind: 'document_import',
                fileName: 'source-2024.pdf',
              }),
            }),
          }),
        ]),
      }),
    );
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
        totalDepreciation: 186000,
        combinedPrice: 2.5,
        soldVolume: 100000,
        cashflow: -45000,
        cumulativeCashflow: -45000,
        waterPrice: 1.2,
        wastewaterPrice: 1.3,
      },
      {
        year: 2025,
        revenue: 790000,
        costs: 812000,
        result: -22000,
        investments: 0,
        totalDepreciation: 188000,
        combinedPrice: 2.6,
        soldVolume: 99500,
        cashflow: -32000,
        cumulativeCashflow: -77000,
        waterPrice: 1.24,
        wastewaterPrice: 1.36,
      },
      {
        year: 2026,
        revenue: 805000,
        costs: 820000,
        result: -15000,
        investments: 50000,
        totalDepreciation: 190000,
        combinedPrice: 2.72,
        soldVolume: 99000,
        cashflow: -20000,
        cumulativeCashflow: -97000,
        waterPrice: 1.3,
        wastewaterPrice: 1.42,
      },
      {
        year: 2027,
        revenue: 820000,
        costs: 829000,
        result: -9000,
        investments: 100000,
        totalDepreciation: 194000,
        combinedPrice: 2.86,
        soldVolume: 98500,
        cashflow: -15000,
        cumulativeCashflow: -112000,
        waterPrice: 1.37,
        wastewaterPrice: 1.49,
      },
      {
        year: 2028,
        revenue: 838000,
        costs: 840000,
        result: -2000,
        investments: 50000,
        totalDepreciation: 197000,
        combinedPrice: 2.98,
        soldVolume: 98000,
        cashflow: -7000,
        cumulativeCashflow: -119000,
        waterPrice: 1.43,
        wastewaterPrice: 1.55,
      },
      {
        year: 2029,
        revenue: 854000,
        costs: 848000,
        result: 6000,
        investments: 150000,
        totalDepreciation: 201000,
        combinedPrice: 3.1,
        soldVolume: 97500,
        cashflow: 2000,
        cumulativeCashflow: -117000,
        waterPrice: 1.49,
        wastewaterPrice: 1.61,
      },
    ],
    priceSeries: [],
    investmentSeries: [{ year: 2024, amount: 150000 }],
    cashflowSeries: [],
    computedAt: NOW,
    computedFromUpdatedAt: NOW,
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

  const buildReportCreateHarness = (
    scenarioOverrides: Partial<ReturnType<typeof buildScenario>> = {},
  ) => {
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'report-harness',
          orgId: ORG_ID,
          title: data.title,
          createdAt: NOW,
          baselineYear: data.baselineYear,
          requiredPriceToday: data.requiredPriceToday,
          requiredAnnualIncreasePct: data.requiredAnnualIncreasePct,
          totalInvestments: data.totalInvestments,
          snapshotJson: data.snapshotJson,
        })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 1,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2024],
            latestAcceptedBudgetId: null,
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
          },
          projects: [],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(buildYearDataset()),
    } as any;

    const service = buildFacadeFromArgs(
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
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue({
        ...buildScenario(),
        ...scenarioOverrides,
      } as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2024],
        latestAcceptedBudgetId: null,
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-1',
      });
    jest.spyOn((service as any).reportService, 'getImportStatus').mockResolvedValue({
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

    return { prisma, service };
  };

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

    const service = buildFacadeFromArgs(
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

  it('keeps the result summary tied to explicit TilikaudenYliJaama in getImportYearData when other rows would imply a different derived result', async () => {
    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue({
        ...buildYearDataset(),
        datasets: [
          {
            dataType: 'tilinpaatos',
            rawRows: [
              {
                Liikevaihto: 1000,
                AineetJaPalvelut: 200,
                Henkilostokulut: 300,
                Poistot: 40,
                LiiketoiminnanMuutKulut: 50,
                TilikaudenYliJaama: 25,
              },
            ],
            effectiveRows: [
              {
                Liikevaihto: 1200,
                AineetJaPalvelut: 210,
                Henkilostokulut: 320,
                Poistot: 45,
                LiiketoiminnanMuutKulut: 55,
                TilikaudenYliJaama: 410,
              },
            ],
            source: 'manual',
            hasOverride: true,
            reconcileNeeded: true,
            overrideMeta: {
              editedAt: NOW.toISOString(),
              editedBy: 'user-1',
              reason: 'Manual correction',
              provenance: {
                kind: 'manual_edit',
                importedAt: NOW.toISOString(),
              },
            },
          },
        ],
      }),
    } as any;

    const service = buildFacadeFromArgs(
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
    const resultRow = result.summaryRows.find((row) => row.key === 'result');

    expect(resultRow).toMatchObject({
      sourceField: 'TilikaudenYliJaama',
      rawValue: 25,
      effectiveValue: 410,
      changed: true,
    });
    expect(result.resultToZero).toMatchObject({
      rawValue: 25,
      effectiveValue: 410,
      delta: 385,
      absoluteGap: 410,
      marginPct: 34.17,
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
                fieldSources: [
                  {
                    sourceField: 'Liikevaihto',
                    provenance: {
                      kind: 'statement_import',
                      fileName: 'bokslut-2024.pdf',
                      pageNumber: 4,
                      confidence: 98,
                      scannedPageCount: 5,
                      matchedFields: ['Liikevaihto', 'TilikaudenYliJaama'],
                      warnings: [],
                    },
                  },
                  {
                    sourceField: 'AineetJaPalvelut',
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
                ],
              },
            },
          },
        ],
      }),
    } as any;

    const service = buildFacadeFromArgs(
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
      reasons: expect.arrayContaining([
        'statement_import',
        'workbook_import',
        'mixed_source',
      ]),
      workbookImport: expect.objectContaining({
        kind: 'kva_import',
        fileName: 'kronoby-kva.xlsx',
        sheetName: 'KVA totalt',
        confirmedSourceFields: ['AineetJaPalvelut'],
      }),
      statementImport: expect.objectContaining({
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      }),
    });
    expect(result.datasets[0]?.overrideMeta?.provenance).toMatchObject({
      kind: 'kva_import',
      fileName: 'kronoby-kva.xlsx',
      fieldSources: expect.arrayContaining([
        expect.objectContaining({
          sourceField: 'Liikevaihto',
          provenance: expect.objectContaining({
            kind: 'statement_import',
            fileName: 'bokslut-2024.pdf',
          }),
        }),
        expect.objectContaining({
          sourceField: 'AineetJaPalvelut',
          provenance: expect.objectContaining({
            kind: 'kva_import',
            fileName: 'kronoby-kva.xlsx',
          }),
        }),
      ]),
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
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestGroupOverride: {
        findMany: jest.fn().mockResolvedValue([
          {
            key: 'legacy_extra_class',
            label: 'Legacy extra class',
            defaultAccountKey: 'legacy_extra_class',
            defaultDepreciationClassKey: 'legacy_extra_class',
            reportGroupKey: 'network_rehabilitation',
            serviceSplit: 'mixed',
          },
        ]),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 1,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2024],
            latestAcceptedBudgetId: null,
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
          },
          projects: [],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn().mockResolvedValue(buildYearDataset()),
    } as any;

    const service = buildFacadeFromArgs(
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
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2024],
        latestAcceptedBudgetId: null,
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-1',
      });
    jest.spyOn((service as any).reportService, 'getImportStatus').mockResolvedValue({
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

    jest.useFakeTimers().setSystemTime(NOW);
    try {
      await service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
        variant: 'public_summary',
      });
    } finally {
      jest.useRealTimers();
    }

    const listedReports = await service.listReports(ORG_ID);

    const createArgs = (prisma.ennusteReport.create as jest.Mock).mock.calls[0][0];
    const snapshot = createArgs.data.snapshotJson as any;

    expect(createArgs.data.title).toBe(
      'Forecast report Statement-backed scenario 2026-03-08',
    );
    expect(snapshot.reportVariant).toBe('public_summary');
    expect(snapshot.reportSections).toMatchObject({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(snapshot.acceptedBaselineYears).toEqual([2024]);
    expect(snapshot.baselineSourceSummaries).toHaveLength(1);
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
    expect(listedReports[0]?.requiredPriceToday).toBe(3.2);
    expect(listedReports[0]?.requiredAnnualIncreasePct).toBe(14);

    const report = await service.getReport(ORG_ID, 'report-1');

    expect(report.variant).toBe('public_summary');
    expect(report.snapshot.reportSections).toMatchObject({
      baselineSources: true,
      investmentPlan: true,
      assumptions: false,
      yearlyInvestments: false,
      riskSummary: true,
    });
    expect(report.snapshot.acceptedBaselineYears).toEqual([2024]);
    expect(report.snapshot.baselineSourceSummaries).toHaveLength(1);
    expect(report.snapshot.baselineSourceSummary?.financials.provenance).toMatchObject(
      {
        kind: 'statement_import',
        fileName: 'bokslut-2024.pdf',
      },
    );
  });

  it('allows report creation when yearly investment placeholders add only zero-only years', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 0,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Zero placeholder',
        },
      ],
    });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(prisma.ennusteReport.create).toHaveBeenCalledTimes(1);
  });

  it('allows report creation when computed series explicitly includes matching zero-only years', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 0,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Zero placeholder',
        },
      ],
      investmentSeries: [
        { year: 2024, amount: 150000 },
        { year: 2025, amount: 0 },
        { year: 2026, amount: 0 },
      ],
    });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(prisma.ennusteReport.create).toHaveBeenCalledTimes(1);
  });

  it('still blocks report creation when yearly investment inputs no longer match the computed series', async () => {
    const { prisma, service } = buildReportCreateHarness({
      yearlyInvestments: [
        ...buildScenario().yearlyInvestments,
        {
          year: 2025,
          amount: 50000,
          category: 'network',
          investmentType: 'replacement',
          confidence: 'high',
          note: 'Uncomputed addition',
        },
      ],
    });

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Scenario investment inputs changed after last compute/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });

  it('still blocks report creation when computed investment series retains a positive year missing from inputs', async () => {
    const { prisma, service } = buildReportCreateHarness({
      investmentSeries: [
        { year: 2024, amount: 150000 },
        { year: 2025, amount: 50000 },
      ],
    });

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Scenario investment inputs changed after last compute/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });

  it('prefers the saved Vesinvest baseline snapshot when creating a report from a linked plan', async () => {
    let createdReport: any = null;
    const prisma = {
      ennusteReport: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdReport = {
            id: 'report-2',
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
        findMany: jest.fn().mockResolvedValue([]),
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
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 2,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: {
            source: 'accepted_planning_baseline',
            acceptedYears: [2022, 2023, 2024],
            latestAcceptedBudgetId: 'budget-2024',
            veetiId: 1535,
            utilityName: 'Water Utility',
            businessId: '1234567-8',
            identitySource: 'veeti',
            baselineYears: [
              {
                year: 2022,
                planningRole: 'historical',
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
                  dataType: 'volume_vesi+volume_jatevesi',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
              },
              {
                year: 2023,
                planningRole: 'historical',
                sourceStatus: 'MIXED',
                sourceBreakdown: {
                  veetiDataTypes: ['taksa'],
                  manualDataTypes: ['tilinpaatos'],
                },
                financials: {
                  dataType: 'tilinpaatos',
                  source: 'manual',
                  provenance: {
                    kind: 'document_import',
                    fileName: 'saved-2023-source.pdf',
                    pageNumbers: [3, 4],
                    confidence: 94,
                    scannedPageCount: 6,
                    matchedFields: ['Liikevaihto'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
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
                  dataType: 'volume_vesi+volume_jatevesi',
                  source: 'veeti',
                  provenance: null,
                  editedAt: null,
                  editedBy: null,
                  reason: null,
                },
              },
              {
                year: 2024,
                planningRole: 'historical',
                sourceStatus: 'MANUAL',
                sourceBreakdown: {
                  veetiDataTypes: ['taksa'],
                  manualDataTypes: ['tilinpaatos', 'volume_vesi'],
                },
                financials: {
                  dataType: 'tilinpaatos',
                  source: 'manual',
                  provenance: {
                    kind: 'statement_import',
                    fileName: 'saved-baseline.pdf',
                    pageNumber: 7,
                    confidence: 99,
                    scannedPageCount: 8,
                    matchedFields: ['Liikevaihto'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
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
                  dataType: 'volume_vesi+volume_jatevesi',
                  source: 'manual',
                  provenance: {
                    kind: 'qdis_import',
                    fileName: 'saved-qdis.pdf',
                    pageNumber: 2,
                    confidence: 87,
                    scannedPageCount: 3,
                    matchedFields: ['waterUnitPrice'],
                    warnings: [],
                  },
                  editedAt: NOW.toISOString(),
                  editedBy: 'user-1',
                  reason: 'Saved with Vesinvest',
                },
              },
            ],
          },
          projects: [
            {
              groupKey: 'sanering_water_network',
              projectCode: 'P-001',
              projectName: 'Main rehabilitation',
              totalAmount: 150000,
              allocations: [
                {
                  year: 2026,
                  totalAmount: 50000,
                },
                {
                  year: 2027,
                  totalAmount: 100000,
                },
              ],
            },
            {
              groupKey: 'wastewater_treatment',
              projectCode: 'P-002',
              projectName: 'Plant renewal',
              totalAmount: 200000,
              allocations: [
                {
                  year: 2028,
                  totalAmount: 50000,
                },
                {
                  year: 2029,
                  totalAmount: 150000,
                },
              ],
            },
          ],
        }),
      },
    } as any;

    const veetiEffectiveDataService = {
      getYearDataset: jest.fn(),
    } as any;

    const service = buildFacadeFromArgs(
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
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);
    jest
      .spyOn((service as any).reportService, 'getCurrentBaselineSnapshot')
      .mockResolvedValue({
        utilityIdentity: {
          veetiId: 1535,
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          identitySource: 'veeti',
        },
        acceptedYears: [2022, 2023, 2024],
        latestAcceptedBudgetId: 'budget-2024',
        baselineYears: [],
        hasTrustedBaseline: true,
        fingerprint: 'baseline-2',
      });

    await service.createReport(ORG_ID, USER_ID, {
      ennusteId: 'scenario-1',
      vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
    });

    expect(veetiEffectiveDataService.getYearDataset).not.toHaveBeenCalled();
    const createArgs = (prisma.ennusteReport.create as jest.Mock).mock.calls[0][0];
    const snapshot = createArgs.data.snapshotJson as any;
    expect(snapshot.vesinvestPlan).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Water Utility Vesinvest',
      versionNumber: 2,
    });
    expect(snapshot.acceptedBaselineYears).toEqual([2022, 2023, 2024]);
    expect(snapshot.vesinvestAppendix).toMatchObject({
      yearlyTotals: [
        { year: 2024, totalAmount: 0 },
        { year: 2025, totalAmount: 0 },
        { year: 2026, totalAmount: 50000 },
        { year: 2027, totalAmount: 100000 },
        { year: 2028, totalAmount: 50000 },
        { year: 2029, totalAmount: 150000 },
      ],
      fiveYearBands: [
        {
          startYear: 2024,
          endYear: 2028,
          totalAmount: 200000,
        },
        {
          startYear: 2029,
          endYear: 2029,
          totalAmount: 150000,
        },
      ],
      groupedProjects: [
        {
          classKey: 'sanering_water_network',
          classLabel: 'Sanering / vattennätverk',
          totalAmount: 150000,
          projects: [
            {
              code: 'P-001',
              name: 'Main rehabilitation',
              classKey: 'sanering_water_network',
              classLabel: 'Sanering / vattennätverk',
              accountKey: 'sanering_water_network',
              allocations: [
                { year: 2026, totalAmount: 50000 },
                { year: 2027, totalAmount: 100000 },
              ],
              totalAmount: 150000,
            },
          ],
        },
        {
          classKey: 'wastewater_treatment',
          classLabel: 'Avloppsrening',
          totalAmount: 200000,
          projects: [
            {
              code: 'P-002',
              name: 'Plant renewal',
              classKey: 'wastewater_treatment',
              classLabel: 'Avloppsrening',
              accountKey: 'wastewater_treatment',
              allocations: [
                { year: 2028, totalAmount: 50000 },
                { year: 2029, totalAmount: 150000 },
              ],
              totalAmount: 200000,
            },
          ],
        },
      ],
      depreciationPlan: expect.arrayContaining([
        expect.objectContaining({
          classKey: 'sanering_water_network',
          classLabel: 'Sanering / vattennätverk',
          accountKey: 'sanering_water_network',
          serviceSplit: 'water',
        }),
        expect.objectContaining({
          classKey: 'wastewater_treatment',
          classLabel: 'Avloppsrening',
          accountKey: 'wastewater_treatment',
          serviceSplit: 'wastewater',
        }),
      ]),
    });
    expect(snapshot.vesinvestAppendix.depreciationPlan).toHaveLength(10);
    expect(
      snapshot.vesinvestAppendix.depreciationPlan.some(
        (row: any) => row.classKey === 'legacy_extra_class',
      ),
    ).toBe(false);
    expect(snapshot.baselineSourceSummaries).toHaveLength(3);
    expect(snapshot.baselineSourceSummaries[1]).toMatchObject({
      year: 2023,
      sourceStatus: 'MIXED',
      financials: {
        source: 'manual',
        provenance: expect.objectContaining({
          kind: 'document_import',
          fileName: 'saved-2023-source.pdf',
        }),
      },
    });
    expect(snapshot.baselineSourceSummary).toMatchObject({
      sourceStatus: 'MANUAL',
      financials: {
        source: 'manual',
        provenance: expect.objectContaining({
          fileName: 'saved-baseline.pdf',
        }),
      },
      volumes: {
        source: 'manual',
        provenance: expect.objectContaining({
          fileName: 'saved-qdis.pdf',
        }),
      },
    });
  });

  it('blocks report creation for a legacy active revision without a saved baseline snapshot', async () => {
    const prisma = {
      ennusteReport: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      vesinvestGroupDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      vesinvestPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: '11111111-1111-4111-8111-111111111111',
          seriesId: 'series-1',
          name: 'Water Utility Vesinvest',
          utilityName: 'Water Utility',
          businessId: '1234567-8',
          veetiId: 1535,
          identitySource: 'veeti',
          versionNumber: 2,
          status: 'active',
          selectedScenarioId: 'scenario-1',
          baselineFingerprint: null,
          scenarioFingerprint: null,
          feeRecommendation: null,
          baselineSourceState: null,
          projects: [],
        }),
      },
    } as any;

    const service = buildFacadeFromArgs(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    jest
      .spyOn((service as any).reportService, 'getForecastScenario')
      .mockResolvedValue(buildScenario() as any);

    await expect(
      service.createReport(ORG_ID, USER_ID, {
        ennusteId: 'scenario-1',
        vesinvestPlanId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(/Re-verify baseline before creating report/i);
    expect(prisma.ennusteReport.create).not.toHaveBeenCalled();
  });
});
