import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';

type ImportWorkspaceContext = {
  prisma: PrismaService;
  veetiService: VeetiService;
  veetiSyncService: VeetiSyncService;
  veetiBudgetGenerator: VeetiBudgetGenerator;
  veetiSanityService: VeetiSanityService;
  veetiEffectiveDataService: VeetiEffectiveDataService;
  normalizeYears(years: number[]): number[];
  annotatePlanningYearRows<T extends { vuosi: number }>(
    yearRows: T[],
  ): Array<T & { planningRole: 'historical' | 'current_year_estimate' }>;
  hydrateYearRowsWithTariffRevenueReadiness<T extends { vuosi: number; completeness: Record<string, boolean> }>(
    orgId: string,
    yearRows: T[],
  ): Promise<
    Array<
      T & {
        tariffRevenueReason: 'missing_fixed_revenue' | 'mismatch' | null;
        baselineReady: boolean;
        baselineMissingRequirements: Array<'financialBaseline' | 'prices' | 'volumes'>;
        baselineWarnings: Array<'tariffRevenueMismatch'>;
      }
    >
  >;
  isFuturePlanningYear(year: number): boolean;
  persistPlanningBaselineYears(
    orgId: string,
    veetiId: number,
    workspaceYears: number[],
    includedYears: number[],
  ): Promise<void>;
  persistWorkspaceYears(orgId: string, years: number[]): Promise<number[]>;
  removeWorkspaceYears(orgId: string, years: number[]): Promise<number[]>;
  getWorkspaceYears(orgId: string): Promise<number[]>;
  resolveBaselineBlockReason(params: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
  }): string | null;
  resolveVeetiOrgLanguage(
    veetiId: number | null | undefined,
  ): Promise<{ kieliId: number | null; uiLanguage: 'fi' | 'sv' | null }>;
  getImportStatus(orgId: string): Promise<{
    years: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      baselineReady?: boolean;
      baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
      baselineWarnings?: Array<'tariffRevenueMismatch'>;
      tariffRevenueReason?: 'missing_fixed_revenue' | 'mismatch' | null;
    }>;
    excludedYears?: number[];
    workspaceYears?: number[];
    [key: string]: unknown;
  }>;
  workspaceSupport: {
    removeImportedYearInternal(
      orgId: string,
      year: number,
      options?: { keepExcluded?: boolean },
    ): Promise<{
      vuosi: number;
      deletedSnapshots: number;
      deletedOverrides: number;
      deletedBudgets: number;
      workspaceYears: number[];
      excludedPolicyApplied: boolean;
    }>;
  };
};

export function createV2ImportWorkspaceSupport(ctx: ImportWorkspaceContext) {
  return {
  async searchOrganizations(query: string, limit: number) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return [];
    }
    const safeLimit = Math.max(
      1,
      Math.min(25, Number.isFinite(limit) ? limit : 20),
    );
    return ctx.veetiService.searchOrganizations(normalizedQuery, safeLimit);
  },

  async connectOrganization(orgId: string, veetiId: number) {
    const currentLink = await ctx.veetiSyncService.getStatus(orgId);
    if (
      currentLink?.veetiId != null &&
      currentLink.veetiId !== veetiId
    ) {
      const [planCount, reportCount, selectedScenarioCount] = await Promise.all([
        ctx.prisma.vesinvestPlan.count({
          where: { orgId },
        }),
        ctx.prisma.ennusteReport.count({
          where: {
            orgId,
            vesinvestPlanId: {
              not: null,
            },
          },
        }),
        ctx.prisma.ennuste.count({
          where: {
            orgId,
            selectedByVesinvestPlans: {
              some: {},
            },
          },
        }),
      ]);
      if (planCount > 0 || reportCount > 0 || selectedScenarioCount > 0) {
        throw new ConflictException(
          'Utility binding cannot be changed after Vesinvest data exists. Clear the workspace first.',
        );
      }
    }
    const result = await ctx.veetiSyncService.connectOrg(orgId, veetiId);
    const language = await ctx.resolveVeetiOrgLanguage(result.linked.veetiId);
    return {
      ...result,
      linked: {
        ...result.linked,
        ...language,
      },
    };
  },

  async getBoundUtilityIdentity(orgId: string) {
    const link = await ctx.veetiSyncService.getStatus(orgId);
    if (!link?.veetiId) {
      return null;
    }
    const veetiOrg =
      typeof ctx.veetiService.getOrganizationById === 'function'
        ? await ctx.veetiService.getOrganizationById(link.veetiId)
        : null;
    const utilityName =
      typeof veetiOrg?.Nimi === 'string' && veetiOrg.Nimi.trim().length > 0
        ? veetiOrg.Nimi.trim()
        : typeof link.nimi === 'string' && link.nimi.trim().length > 0
        ? link.nimi.trim()
        : null;
    return {
      orgId,
      veetiId: link.veetiId,
      utilityName,
      businessId:
        typeof veetiOrg?.YTunnus === 'string' && veetiOrg.YTunnus.trim().length > 0
          ? veetiOrg.YTunnus.trim()
          : typeof link.ytunnus === 'string' && link.ytunnus.trim().length > 0
          ? link.ytunnus.trim()
          : null,
    };
  },

  async importYears(orgId: string, years: number[]) {
    const sync = await ctx.veetiSyncService.refreshOrg(orgId);
    const yearRows = ctx.annotatePlanningYearRows(
      await ctx.veetiSyncService.getAvailableYears(orgId),
    );
    const yearRowByYear = new Map(yearRows.map((row) => [row.vuosi, row]));
    const requestedYears = ctx.normalizeYears(years);
    const defaultYears = [...yearRows]
      .filter((row) => row.planningRole === 'historical')
      .sort((a, b) => b.vuosi - a.vuosi)
      .slice(0, 3)
      .map((row) => row.vuosi);
    const selectedYears =
      requestedYears.length > 0 ? requestedYears : defaultYears;

    const importedYears: number[] = [];
    const skippedYears: Array<{ vuosi: number; reason: string }> = [];

    for (const year of selectedYears) {
      if (ctx.isFuturePlanningYear(year)) {
        skippedYears.push({
          vuosi: year,
          reason: 'Future years are not supported in Overview import.',
        });
        continue;
      }
      if (!yearRowByYear.has(year)) {
        skippedYears.push({
          vuosi: year,
          reason:
            'Year is not available in imported VEETI data. Refresh import first.',
        });
        continue;
      }
      importedYears.push(year);
    }

    const workspaceYears = await ctx.persistWorkspaceYears(orgId, importedYears);

    return {
      selectedYears,
      importedYears,
      workspaceYears,
      skippedYears,
      sync,
      status: await ctx.getImportStatus(orgId),
    };
  },

  async createPlanningBaseline(orgId: string, years: number[]) {
    const yearRows = ctx.annotatePlanningYearRows(
      await ctx.hydrateYearRowsWithTariffRevenueReadiness(
        orgId,
        await ctx.veetiSyncService.getAvailableYears(orgId),
      ),
    );
    const persistedWorkspaceYears = await ctx.getWorkspaceYears(orgId);
    const link = await ctx.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });
    const workspaceYearSet = new Set(persistedWorkspaceYears);
    const excludedYearSet = new Set(
      await ctx.veetiEffectiveDataService.getExcludedYears(orgId),
    );
    const yearRowByYear = new Map(yearRows.map((row) => [row.vuosi, row]));
    const requestedYears = ctx.normalizeYears(years);
    const defaultYears = [...yearRows]
      .filter((row) => row.planningRole === 'historical')
      .filter((row) => workspaceYearSet.has(row.vuosi))
      .filter((row) => ctx.resolveBaselineBlockReason(row) === null)
      .sort((a, b) => b.vuosi - a.vuosi)
      .slice(0, 3)
      .map((row) => row.vuosi);
    const selectedYears =
      requestedYears.length > 0 ? requestedYears : defaultYears;

    const skippedYears: Array<{ vuosi: number; reason: string }> = [];
    const includedYears: number[] = [];

    for (const year of selectedYears) {
      if (ctx.isFuturePlanningYear(year)) {
        skippedYears.push({
          vuosi: year,
          reason:
            'Future years are not supported in planning baseline creation.',
        });
        continue;
      }
      if (excludedYearSet.has(year)) {
        skippedYears.push({
          vuosi: year,
          reason:
            'Year is excluded from planning. Restore it before creating the planning baseline for this year.',
        });
        continue;
      }

      const row = yearRowByYear.get(year);
      if (!row) {
        skippedYears.push({
          vuosi: year,
          reason:
            'Year is not available in imported VEETI data. Import it into the workspace first.',
        });
        continue;
      }

      if (!workspaceYearSet.has(year)) {
        skippedYears.push({
          vuosi: year,
          reason:
            'Year is not imported into the workspace. Import it before creating the planning baseline.',
        });
        continue;
      }

      const blockedReason = ctx.resolveBaselineBlockReason(row);
      if (blockedReason) {
        skippedYears.push({ vuosi: year, reason: blockedReason });
        continue;
      }

      includedYears.push(year);
    }

    const generatedBudgets =
      includedYears.length > 0
        ? await ctx.veetiBudgetGenerator.generateBudgets(orgId, includedYears)
        : {
            success: true,
            count: 0,
            results: [] as Array<{
              budgetId: string;
              vuosi: number;
              mode: 'created' | 'updated';
            }>,
            skipped: [] as Array<{ vuosi: number; reason: string }>,
          };

    const acceptedPlanningBaselineYears = ctx.normalizeYears(
      (generatedBudgets.results ?? []).map((row) => row.vuosi),
    );

    if (link) {
      await ctx.persistPlanningBaselineYears(
        orgId,
        link.veetiId,
        persistedWorkspaceYears,
        acceptedPlanningBaselineYears,
      );
    }

    return {
      selectedYears,
      includedYears,
      acceptedPlanningBaselineYears,
      skippedYears: [...skippedYears, ...(generatedBudgets.skipped ?? [])],
      planningBaseline: {
        success: generatedBudgets.success,
        count: generatedBudgets.count,
        results: generatedBudgets.results,
      },
      status: await ctx.getImportStatus(orgId),
    };
  },

  async syncImport(orgId: string, years: number[]) {
    const sync = await ctx.veetiSyncService.refreshOrg(orgId);
    const yearRows = ctx.annotatePlanningYearRows(
      await ctx.hydrateYearRowsWithTariffRevenueReadiness(
        orgId,
        await ctx.veetiSyncService.getAvailableYears(orgId),
      ),
    );
    const excludedYearSet = new Set(
      await ctx.veetiEffectiveDataService.getExcludedYears(orgId),
    );
    const yearRowByYear = new Map(yearRows.map((row) => [row.vuosi, row]));
    const requestedYears = ctx.normalizeYears(years);
    const defaultYears = [...yearRows]
      .filter((row) => row.planningRole === 'historical')
      .filter((row) => ctx.resolveBaselineBlockReason(row) === null)
      .sort((a, b) => b.vuosi - a.vuosi)
      .slice(0, 3)
      .map((row) => row.vuosi);
    const selectedYears =
      requestedYears.length > 0 ? requestedYears : defaultYears;

    const preSkipped: Array<{ vuosi: number; reason: string }> = [];
    const importedYears: number[] = [];
    const eligibleYears: number[] = [];

    for (const year of selectedYears) {
      if (ctx.isFuturePlanningYear(year)) {
        preSkipped.push({
          vuosi: year,
          reason: 'Future years are not supported in Overview sync.',
        });
        continue;
      }
      if (excludedYearSet.has(year)) {
        preSkipped.push({
          vuosi: year,
          reason:
            'Year is excluded from planning. Restore it before syncing this year.',
        });
        continue;
      }

      const row = yearRowByYear.get(year);
      if (!row) {
        preSkipped.push({
          vuosi: year,
          reason:
            'Year is not available in imported VEETI data. Refresh import first.',
        });
        continue;
      }

      importedYears.push(year);

      const blockedReason = ctx.resolveBaselineBlockReason(row);
      if (blockedReason) {
        preSkipped.push({ vuosi: year, reason: blockedReason });
        continue;
      }

      eligibleYears.push(year);
    }

    const workspaceYears = await ctx.persistWorkspaceYears(
      orgId,
      importedYears,
    );

    const generatedBudgets =
      eligibleYears.length > 0
        ? await ctx.veetiBudgetGenerator.generateBudgets(orgId, eligibleYears)
        : {
            success: true,
            count: 0,
            results: [] as Array<{
              budgetId: string;
              vuosi: number;
              mode: 'created' | 'updated';
            }>,
            skipped: [] as Array<{ vuosi: number; reason: string }>,
          };

    const sanity = await ctx.veetiSanityService.checkYears(
      orgId,
      selectedYears,
    );

    return {
      selectedYears,
      importedYears,
      workspaceYears,
      sync,
      sanity,
      generatedBudgets: {
        ...generatedBudgets,
        skipped: [...preSkipped, ...(generatedBudgets.skipped ?? [])],
      },
      status: await ctx.getImportStatus(orgId),
    };
  },

  async removeImportedYear(orgId: string, year: number) {
    const targetYear = Math.round(Number(year));
    if (!Number.isFinite(targetYear)) {
      throw new BadRequestException('Invalid year.');
    }

    const result = await ctx.workspaceSupport.removeImportedYearInternal(
      orgId,
      targetYear,
    );
    return {
      ...result,
      status: await ctx.getImportStatus(orgId),
    };
  },

  async removeImportedYears(orgId: string, years: number[]) {
    const targetYears = ctx.normalizeYears(years);
    if (targetYears.length === 0) {
      throw new BadRequestException('Provide at least one year.');
    }

    const results: Array<
      | {
          vuosi: number;
          ok: true;
          deletedSnapshots: number;
          deletedOverrides: number;
          deletedBudgets: number;
          excludedPolicyApplied: boolean;
        }
      | {
          vuosi: number;
          ok: false;
          error: string;
        }
    > = [];

    for (const targetYear of targetYears) {
      try {
        const removed = await ctx.workspaceSupport.removeImportedYearInternal(
          orgId,
          targetYear,
        );
        results.push({
          vuosi: targetYear,
          ok: true,
          deletedSnapshots: removed.deletedSnapshots,
          deletedOverrides: removed.deletedOverrides,
          deletedBudgets: removed.deletedBudgets,
          excludedPolicyApplied: removed.excludedPolicyApplied,
        });
      } catch (error) {
        results.push({
          vuosi: targetYear,
          ok: false,
          error: error instanceof Error ? error.message : 'Year delete failed.',
        });
      }
    }

    return {
      requestedYears: targetYears,
      deletedCount: results.filter((row) => row.ok).length,
      failedCount: results.filter((row) => !row.ok).length,
      results,
      status: await ctx.getImportStatus(orgId),
    };
  },

  async excludeImportedYears(orgId: string, years: number[]) {
    const targetYears = ctx.normalizeYears(years);
    if (targetYears.length === 0) {
      throw new BadRequestException('Provide at least one year.');
    }

    const link = await ctx.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }

    const excludedYearSet = new Set(
      await ctx.veetiEffectiveDataService.getExcludedYears(orgId),
    );
    const results: Array<{
      vuosi: number;
      excluded: boolean;
      reason: string | null;
    }> = [];

    for (const targetYear of targetYears) {
      const alreadyExcluded = excludedYearSet.has(targetYear);
      await ctx.prisma.veetiYearPolicy.upsert({
        where: {
          orgId_veetiId_vuosi: {
            orgId,
            veetiId: link.veetiId,
            vuosi: targetYear,
          },
        },
        create: {
          orgId,
          veetiId: link.veetiId,
          vuosi: targetYear,
          excluded: true,
          includedInPlanningBaseline: false,
          reason: 'Excluded from planning baseline',
          editedAt: new Date(),
        },
        update: {
          excluded: true,
          includedInPlanningBaseline: false,
          reason: 'Excluded from planning baseline',
          editedAt: new Date(),
        },
      });
      excludedYearSet.add(targetYear);
      results.push({
        vuosi: targetYear,
        excluded: true,
        reason: alreadyExcluded ? 'Year is already excluded.' : null,
      });
    }

    return {
      requestedYears: targetYears,
      excludedCount: results.length,
      alreadyExcludedCount: results.filter((row) => row.reason !== null).length,
      results,
      status: await ctx.getImportStatus(orgId),
    };
  },

  async restoreImportedYears(orgId: string, years: number[]) {
    const targetYears = ctx.normalizeYears(years);
    if (targetYears.length === 0) {
      throw new BadRequestException('Provide at least one year.');
    }

    const link = await ctx.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }

    const results: Array<{
      vuosi: number;
      restored: boolean;
      reason: string | null;
    }> = [];

    for (const targetYear of targetYears) {
      const updated = await ctx.prisma.veetiYearPolicy.updateMany({
        where: {
          orgId,
          veetiId: link.veetiId,
          vuosi: targetYear,
          excluded: true,
        },
        data: {
          excluded: false,
          includedInPlanningBaseline: false,
          reason: null,
          editedAt: new Date(),
        },
      });

      results.push({
        vuosi: targetYear,
        restored: updated.count > 0,
        reason: updated.count > 0 ? null : 'Year is not excluded.',
      });
    }

    return {
      requestedYears: targetYears,
      restoredCount: results.filter((row) => row.restored).length,
      notExcludedCount: results.filter((row) => !row.restored).length,
      results,
      status: await ctx.getImportStatus(orgId),
    };
  },

  async removeImportedYearInternal(orgId: string, targetYear: number) {
    const link = await ctx.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });

    const veetiBudgets = await ctx.prisma.talousarvio.findMany({
      where: {
        orgId,
        OR: [
          { veetiVuosi: targetYear },
          {
            AND: [{ lahde: 'veeti' }, { vuosi: targetYear }],
          },
        ],
      },
      select: { id: true, nimi: true },
      orderBy: { updatedAt: 'desc' },
    });

    const budgetIds = veetiBudgets.map((row) => row.id);
    if (budgetIds.length > 0) {
      const linkedScenarios = await ctx.prisma.ennuste.findMany({
        where: {
          orgId,
          talousarvioId: { in: budgetIds },
        },
        select: { id: true, nimi: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (linkedScenarios.length > 0) {
        const scenarioNames = linkedScenarios
          .slice(0, 3)
          .map((row) => row.nimi)
          .join(', ');
        throw new BadRequestException(
          `Cannot remove year ${targetYear} because forecast scenario(s) still use that baseline budget: ${scenarioNames}. Delete or rebase those scenarios first.`,
        );
      }
    }

    const [deletedSnapshots, deletedOverrides, deletedBudgets, excludedPolicy] =
      await ctx.prisma.$transaction(async (tx) => {
        const snapshotDelete = await tx.veetiSnapshot.deleteMany({
          where: {
            orgId,
            vuosi: targetYear,
          },
        });
        const overrideDelete = await tx.veetiOverride.deleteMany({
          where: {
            orgId,
            vuosi: targetYear,
          },
        });
        const budgetDelete = await tx.talousarvio.deleteMany({
          where: {
            orgId,
            id: { in: budgetIds },
          },
        });

        let policyApplied = false;
        if (link) {
          await tx.veetiYearPolicy.upsert({
            where: {
              orgId_veetiId_vuosi: {
                orgId,
                veetiId: link.veetiId,
                vuosi: targetYear,
              },
            },
            create: {
              orgId,
              veetiId: link.veetiId,
              vuosi: targetYear,
              excluded: true,
              includedInPlanningBaseline: false,
              reason: 'Removed via import year delete',
              editedAt: new Date(),
            },
            update: {
              excluded: true,
              includedInPlanningBaseline: false,
              editedAt: new Date(),
            },
          });
          policyApplied = true;
        }

        return [
          snapshotDelete,
          overrideDelete,
          budgetDelete,
          policyApplied,
        ] as const;
      });

    const workspaceYears = await ctx.removeWorkspaceYears(orgId, [targetYear]);

    return {
      vuosi: targetYear,
      deletedSnapshots: deletedSnapshots.count,
      deletedOverrides: deletedOverrides.count,
      deletedBudgets: deletedBudgets.count,
      workspaceYears,
      excludedPolicyApplied: excludedPolicy,
    };
  },

  };
}

