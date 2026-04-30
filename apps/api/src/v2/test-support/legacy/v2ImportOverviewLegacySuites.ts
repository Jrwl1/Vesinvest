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

export function registerV2ImportExclusionBehaviorSuite() {
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
      const veetiYearPolicyDeleteMany = jest
        .fn()
        .mockResolvedValue({ count: 1 });
      const vesinvestPlanSeriesDeleteMany = jest.fn().mockResolvedValue({
        count: 1,
      });
      const veetiOrganisaatioDeleteMany = jest
        .fn()
        .mockImplementation(async () => {
          linked = false;
          workspaceYears = [];
          return { count: 1 };
        });
      const veetiOrganisaatioFindUnique = jest
        .fn()
        .mockImplementation(async (args?: any) => {
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
        });
      const veetiOrganisaatioUpdate = jest
        .fn()
        .mockImplementation(async (args: any) => {
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
        });
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
      const talousarvioFindMany = jest
        .fn()
        .mockImplementation(async (args?: any) => {
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
          return (
            [...rows].sort(
              (a, b) =>
                Number(b.veetiVuosi ?? b.vuosi ?? 0) -
                  Number(a.veetiVuosi ?? a.vuosi ?? 0) || 0,
            )[0] ?? null
          );
        });
      const ennusteFindMany = jest
        .fn()
        .mockImplementation(async (args?: any) => {
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
      const clearChallengeRows = new Map<
        string,
        {
          id: string;
          orgId: string;
          userId: string;
          confirmTokenHash: string;
          expiresAt: Date;
          usedAt: Date | null;
        }
      >();
      const executeRaw = jest
        .fn()
        .mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
          const sql = strings.join('?');
          if (sql.includes('INSERT INTO "v2_import_clear_challenge"')) {
            const [id, orgId, userId, confirmTokenHash, expiresAt] = values;
            clearChallengeRows.set(id, {
              id,
              orgId,
              userId,
              confirmTokenHash,
              expiresAt,
              usedAt: null,
            });
            return 1;
          }
          if (sql.includes('UPDATE "v2_import_clear_challenge"')) {
            const [id] = values;
            const row = clearChallengeRows.get(id);
            if (!row || row.usedAt != null) return 0;
            row.usedAt = new Date(Date.now());
            return 1;
          }
          if (
            sql.includes('DELETE FROM "v2_import_clear_challenge"') &&
            sql.includes('WHERE "id" =')
          ) {
            const [id] = values;
            return clearChallengeRows.delete(id) ? 1 : 0;
          }
          if (sql.includes('DELETE FROM "v2_import_clear_challenge"')) {
            const [now] = values;
            let count = 0;
            for (const [id, row] of clearChallengeRows.entries()) {
              if (row.usedAt != null || row.expiresAt <= now) {
                clearChallengeRows.delete(id);
                count += 1;
              }
            }
            return count;
          }
          return 0;
        });
      const queryRaw = jest
        .fn()
        .mockImplementation(async (strings: TemplateStringsArray, ...values: any[]) => {
          const sql = strings.join('?');
          if (sql.includes('FROM "v2_import_clear_challenge"')) {
            const [id] = values;
            const row = clearChallengeRows.get(id);
            return row
              ? [
                  {
                    orgId: row.orgId,
                    userId: row.userId,
                    confirmTokenHash: row.confirmTokenHash,
                    expiresAt: row.expiresAt,
                    usedAt: row.usedAt,
                  },
                ]
              : [];
          }
          return [];
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
        $executeRaw: executeRaw,
        $queryRaw: queryRaw,
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
        getStatus: jest.fn().mockImplementation(async () =>
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

      const service = buildFacadeService({
        prisma,
        projectionsService,
        veetiService,
        veetiSyncService,
        veetiEffectiveDataService,
        veetiBudgetGenerator,
        veetiBenchmarkService,
        veetiSanityService,
      });

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
      expect(mocks.veetiSyncService.connectOrg).toHaveBeenCalledWith(
        ORG_ID,
        1535,
      );
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

      expect(status.availableYears.map((row: any) => row.vuosi)).toEqual([
        currentYear - 1,
        currentYear,
      ]);
      expect(
        status.availableYears.map((row: any) => [row.vuosi, row.planningRole]),
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

      expect(context.baselineYears.map((row: any) => row.year)).toEqual([2024]);
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
        scenarioBaselineBudgets: [
          { vuosi: 2015, veetiVuosi: null, lahde: 'manual' },
        ],
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

    it('rejects org-clear when the one-time confirmation challenge is missing, blank, or wrong', async () => {
      const { service, mocks } = buildService({
        excludedYears: [],
        availableYears: [2023, 2024],
      });
      const challenge = await service.createImportClearChallenge(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
      );

      await expect(
        service.clearImportAndScenarios(ORG_ID, 'admin-1', ['ADMIN']),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });
      await expect(
        service.clearImportAndScenarios(
          ORG_ID,
          'admin-1',
          ['ADMIN'],
          challenge.challengeId,
          '   ',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });
      await expect(
        service.clearImportAndScenarios(
          ORG_ID,
          'admin-1',
          ['ADMIN'],
          challenge.challengeId,
          'WRONGTOK',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });

      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows org-clear when the server-issued confirmation token matches after trimming and normalizing case', async () => {
      const { service, mocks } = buildService({
        excludedYears: [],
        availableYears: [2023, 2024],
        workspaceYears: [2023, 2024],
        veetiBudgets: [{ id: 'budget-2024', nimi: 'VEETI 2024' }],
      });
      const challenge = await service.createImportClearChallenge(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
      );

      const result = await service.clearImportAndScenarios(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
        challenge.challengeId,
        `  ${challenge.confirmToken.toLowerCase()}  `,
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

    it('rejects clear challenge reuse after a successful clear', async () => {
      const { service, mocks } = buildService({
        excludedYears: [],
        availableYears: [2023, 2024],
        workspaceYears: [2023, 2024],
      });
      const challenge = await service.createImportClearChallenge(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
      );

      await service.clearImportAndScenarios(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
        challenge.challengeId,
        challenge.confirmToken,
      );
      await expect(
        service.clearImportAndScenarios(
          ORG_ID,
          'admin-1',
          ['ADMIN'],
          challenge.challengeId,
          challenge.confirmToken,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });

      expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('binds clear challenges to the issuing admin user and org', async () => {
      const { service, mocks } = buildService({
        excludedYears: [],
        availableYears: [2023, 2024],
      });
      const challenge = await service.createImportClearChallenge(
        ORG_ID,
        'admin-1',
        ['ADMIN'],
      );

      await expect(
        service.clearImportAndScenarios(
          ORG_ID,
          'admin-2',
          ['ADMIN'],
          challenge.challengeId,
          challenge.confirmToken,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });
      await expect(
        service.clearImportAndScenarios(
          'org-2',
          'admin-1',
          ['ADMIN'],
          challenge.challengeId,
          challenge.confirmToken,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });

      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects expired clear challenges without clearing data', async () => {
      const now = new Date('2030-01-01T00:00:00.000Z').getTime();
      const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);
      try {
        const { service, mocks } = buildService({
          excludedYears: [],
          availableYears: [2023, 2024],
        });
        const challenge = await service.createImportClearChallenge(
          ORG_ID,
          'admin-1',
          ['ADMIN'],
        );
        dateNowSpy.mockReturnValue(now + 5 * 60 * 1000 + 1);

        await expect(
          service.clearImportAndScenarios(
            ORG_ID,
            'admin-1',
            ['ADMIN'],
            challenge.challengeId,
            challenge.confirmToken,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({
            code: 'CLEAR_CONFIRMATION_EXPIRED',
          }),
        });

        expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
      } finally {
        dateNowSpy.mockRestore();
      }
    });

    it('does not accept the derived org id prefix as the clear confirmation token', async () => {
      const { service, mocks } = buildService({
        excludedYears: [],
        availableYears: [2023, 2024],
      });

      await expect(
        service.clearImportAndScenarios(
          ORG_ID,
          'admin-1',
          ['ADMIN'],
          undefined,
          'ORG-1',
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'CLEAR_CONFIRMATION_INVALID',
        }),
      });

      expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    });
  });
}
