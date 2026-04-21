import { PrismaService } from '../prisma/prisma.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VeetiSanityService } from '../veeti/veeti-sanity.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { VeetiService } from '../veeti/veeti.service';
import type {
  BaselineMissingRequirement,
  BaselineWarning,
  ImportYearSummaryRow,
  PlanningRole,
  SyncRequirement,
  TariffRevenueReason,
} from './v2-import-overview.types';

type ImportOverviewPlanningContext = {
  prisma: PrismaService;
  veetiService: VeetiService;
  veetiSyncService: VeetiSyncService;
  veetiEffectiveDataService: VeetiEffectiveDataService;
  veetiBudgetGenerator: VeetiBudgetGenerator;
  veetiSanityService: VeetiSanityService;
  emptyCompleteness(): Record<string, boolean>;
  augmentCompletenessWithTariffRevenue(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
  ): {
    completeness: Record<string, boolean>;
    tariffRevenueReason: TariffRevenueReason | null;
  };
  buildImportYearSummaryRows(
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): ImportYearSummaryRow[];
  evaluateBaselineReadiness(
    completeness: Record<string, boolean>,
    yearDataset:
      | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
      | null
      | undefined,
    summaryRows: ImportYearSummaryRow[],
    tariffRevenueReason: TariffRevenueReason | null,
  ): {
    baselineReady: boolean;
    baselineMissingRequirements: BaselineMissingRequirement[];
    baselineWarnings: BaselineWarning[];
  };
  resolveMissingSyncRequirements(
    completeness: Record<string, boolean>,
  ): SyncRequirement[];
  resolveBaselineBlockReason(params: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: BaselineMissingRequirement[];
  }): string | null;
  toNumber(value: unknown): number;
  round2(value: number): number;
};

export function createV2ImportOverviewPlanningSupport(
  ctx: ImportOverviewPlanningContext,
) {
  return {
    mapVeetiUiLanguage(
      kieliId: number | null | undefined,
    ): 'fi' | 'sv' | null {
      if (kieliId === 1) return 'fi';
      if (kieliId === 2) return 'sv';
      return null;
    },

    async resolveVeetiOrgLanguage(
      veetiId: number | null | undefined,
    ): Promise<{ kieliId: number | null; uiLanguage: 'fi' | 'sv' | null }> {
      if (!Number.isInteger(veetiId)) {
        return { kieliId: null, uiLanguage: null };
      }
      if (typeof ctx.veetiService.getOrganizationById !== 'function') {
        return { kieliId: null, uiLanguage: null };
      }
      const org = await ctx.veetiService.getOrganizationById(Number(veetiId));
      const kieliId =
        typeof org?.Kieli_Id === 'number' && Number.isFinite(org.Kieli_Id)
          ? org.Kieli_Id
          : null;
      return {
        kieliId,
        uiLanguage: this.mapVeetiUiLanguage(kieliId),
      };
    },

    normalizeYears(years: number[]): number[] {
      const unique = new Set<number>();
      for (const raw of years) {
        const parsed = Math.round(Number(raw));
        if (Number.isFinite(parsed)) unique.add(parsed);
      }
      return [...unique].sort((a, b) => a - b);
    },

    getCurrentPlanningYear(): number {
      return new Date().getFullYear();
    },

    isFuturePlanningYear(year: number): boolean {
      return year > this.getCurrentPlanningYear();
    },

    resolvePlanningRole(year: number): PlanningRole {
      return year === this.getCurrentPlanningYear()
        ? 'current_year_estimate'
        : 'historical';
    },

    annotatePlanningYearRows<T extends { vuosi: number }>(
      yearRows: T[],
    ): Array<T & { planningRole: PlanningRole }> {
      return yearRows
        .filter((row) => !this.isFuturePlanningYear(row.vuosi))
        .map((row) => ({
          ...row,
          planningRole: this.resolvePlanningRole(row.vuosi),
        }));
    },

    async hydrateYearRowsWithTariffRevenueReadiness<
      T extends {
        vuosi: number;
        completeness: Record<string, boolean>;
        missingRequirements?: SyncRequirement[];
      },
    >(
      orgId: string,
      yearRows: T[],
    ): Promise<
      Array<
        T & {
          tariffRevenueReason: TariffRevenueReason | null;
          baselineReady: boolean;
          baselineMissingRequirements: BaselineMissingRequirement[];
          baselineWarnings: BaselineWarning[];
        }
      >
    > {
      const getYearDataset =
        typeof ctx.veetiEffectiveDataService.getYearDataset === 'function'
          ? ctx.veetiEffectiveDataService.getYearDataset.bind(
              ctx.veetiEffectiveDataService,
            )
          : null;
      const hydrated = await Promise.all(
        yearRows.map(async (row) => {
          const yearDataset = getYearDataset
            ? await getYearDataset(orgId, row.vuosi)
            : null;
          const { completeness, tariffRevenueReason } =
            ctx.augmentCompletenessWithTariffRevenue(
              row.completeness ?? ctx.emptyCompleteness(),
              yearDataset,
            );
          const summaryRows = yearDataset
            ? ctx.buildImportYearSummaryRows(yearDataset)
            : [];
          const baselineReadiness = ctx.evaluateBaselineReadiness(
            completeness,
            yearDataset,
            summaryRows,
            tariffRevenueReason,
          );
          return {
            ...row,
            completeness,
            missingRequirements: ctx.resolveMissingSyncRequirements(completeness),
            tariffRevenueReason,
            ...baselineReadiness,
          };
        }),
      );
      return hydrated;
    },

    resolveWorkspaceYearRows(importStatus: {
      years?: Array<{
        vuosi: number;
        completeness?: {
          tilinpaatos?: boolean;
          taksa?: boolean;
          volume_vesi?: boolean;
          volume_jatevesi?: boolean;
        };
        sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
        sourceBreakdown?: {
          veetiDataTypes?: string[];
          manualDataTypes?: string[];
        };
      }>;
      workspaceYears?: number[];
    }) {
      const importedYears = this.resolveImportedYears(importStatus);
      const workspaceYearSet = new Set(importedYears);
      return (importStatus.years ?? []).filter((row) =>
        workspaceYearSet.has(row.vuosi),
      );
    },

    resolveImportedYears(importStatus: {
      years?: Array<{ vuosi: number }>;
      workspaceYears?: number[];
    }): number[] {
      return this.normalizeYears(importStatus.workspaceYears ?? []);
    },

    async resolvePlanningBaselineYears(
      orgId: string,
      options?: {
        link?: { veetiId: number; workspaceYears?: number[] } | null;
        persistRepair?: boolean;
      },
    ): Promise<number[]> {
      const link =
        options?.link ??
        (await ctx.prisma.veetiOrganisaatio?.findUnique?.({
          where: { orgId },
          select: { veetiId: true, workspaceYears: true },
        })) ??
        null;
      if (!link) {
        return [];
      }

      const workspaceYears = this.normalizeYears(link.workspaceYears ?? []);
      if (!ctx.prisma.veetiYearPolicy?.findMany) {
        return workspaceYears;
      }
      const policies = await ctx.prisma.veetiYearPolicy.findMany({
        where: {
          orgId,
          veetiId: link.veetiId,
        },
        select: {
          vuosi: true,
          excluded: true,
          includedInPlanningBaseline: true,
        },
      });
      const acceptedFromPolicy = this.normalizeYears(
        policies
          .filter(
            (row) =>
              row.includedInPlanningBaseline === true && row.excluded !== true,
          )
          .map((row) => row.vuosi),
      );
      if (acceptedFromPolicy.length > 0) {
        return acceptedFromPolicy;
      }

      const fallbackYears = await this.resolveFallbackPlanningBaselineYears(
        orgId,
        workspaceYears,
      );
      if (options?.persistRepair && fallbackYears.length > 0) {
        await this.persistPlanningBaselineYears(
          orgId,
          link.veetiId,
          workspaceYears,
          fallbackYears,
        );
      }
      return fallbackYears;
    },

    async resolveFallbackPlanningBaselineYears(
      orgId: string,
      workspaceYears: number[],
    ): Promise<number[]> {
      if (!ctx.prisma.talousarvio?.findMany || !ctx.prisma.ennuste?.findMany) {
        return this.normalizeYears(workspaceYears);
      }
      const workspaceYearSet = new Set(this.normalizeYears(workspaceYears));
      const [veetiBudgets, scenarios] = await Promise.all([
        ctx.prisma.talousarvio.findMany({
          where: { orgId, lahde: 'veeti' },
          select: { vuosi: true, veetiVuosi: true },
        }),
        ctx.prisma.ennuste.findMany({
          where: { orgId },
          select: {
            talousarvio: {
              select: {
                lahde: true,
                vuosi: true,
                veetiVuosi: true,
              },
            },
          },
        }),
      ]);

      const acceptedYears = new Set<number>();
      for (const row of veetiBudgets) {
        const year = Number(row.veetiVuosi ?? row.vuosi);
        if (Number.isFinite(year) && workspaceYearSet.has(year)) {
          acceptedYears.add(year);
        }
      }
      for (const scenario of scenarios) {
        const year = Number(
          scenario.talousarvio?.veetiVuosi ?? scenario.talousarvio?.vuosi,
        );
        if (
          scenario.talousarvio?.lahde === 'veeti' &&
          Number.isFinite(year) &&
          workspaceYearSet.has(year)
        ) {
          acceptedYears.add(year);
        }
      }

      return [...acceptedYears].sort((a, b) => a - b);
    },

    async persistPlanningBaselineYears(
      orgId: string,
      veetiId: number,
      workspaceYears: number[],
      includedYears: number[],
    ): Promise<void> {
      if (
        !ctx.prisma.veetiYearPolicy?.findMany ||
        !ctx.prisma.veetiYearPolicy?.upsert
      ) {
        return;
      }
      const relevantYears = this.normalizeYears([
        ...workspaceYears,
        ...includedYears,
      ]);
      if (relevantYears.length === 0) {
        return;
      }

      const includedYearSet = new Set(this.normalizeYears(includedYears));
      const existingPolicies = await ctx.prisma.veetiYearPolicy.findMany({
        where: {
          orgId,
          veetiId,
          vuosi: { in: relevantYears },
        },
        select: {
          vuosi: true,
          excluded: true,
        },
      });
      const excludedByYear = new Map(
        existingPolicies.map((row) => [row.vuosi, row.excluded === true]),
      );

      await Promise.all(
        relevantYears.map((year) =>
          ctx.prisma.veetiYearPolicy.upsert({
            where: {
              orgId_veetiId_vuosi: {
                orgId,
                veetiId,
                vuosi: year,
              },
            },
            create: {
              orgId,
              veetiId,
              vuosi: year,
              excluded: excludedByYear.get(year) === true,
              includedInPlanningBaseline:
                excludedByYear.get(year) === true
                  ? false
                  : includedYearSet.has(year),
              editedAt: new Date(),
            },
            update: {
              includedInPlanningBaseline:
                excludedByYear.get(year) === true
                  ? false
                  : includedYearSet.has(year),
              editedAt: new Date(),
            },
          }),
        ),
      );
    },

    async getWorkspaceYears(orgId: string): Promise<number[]> {
      if (!ctx.prisma.veetiOrganisaatio?.findUnique) {
        return [];
      }

      const link = await ctx.prisma.veetiOrganisaatio.findUnique({
        where: { orgId },
        select: { workspaceYears: true },
      });
      return this.normalizeYears(link?.workspaceYears ?? []);
    },

    async persistWorkspaceYears(
      orgId: string,
      years: number[],
    ): Promise<number[]> {
      if (
        !ctx.prisma.veetiOrganisaatio?.findUnique ||
        !ctx.prisma.veetiOrganisaatio?.update
      ) {
        return this.normalizeYears(years);
      }

      const currentLink = await ctx.prisma.veetiOrganisaatio.findUnique({
        where: { orgId },
        select: { workspaceYears: true },
      });
      if (!currentLink) {
        return [];
      }

      const nextWorkspaceYears = this.normalizeYears([
        ...(currentLink.workspaceYears ?? []),
        ...years,
      ]);
      const link = await ctx.prisma.veetiOrganisaatio.update({
        where: { orgId },
        data: { workspaceYears: nextWorkspaceYears },
        select: { workspaceYears: true },
      });
      return this.normalizeYears(link.workspaceYears ?? []);
    },

    async removeWorkspaceYears(
      orgId: string,
      years: number[],
    ): Promise<number[]> {
      if (
        !ctx.prisma.veetiOrganisaatio?.findUnique ||
        !ctx.prisma.veetiOrganisaatio?.update
      ) {
        return [];
      }

      const removeYears = new Set(this.normalizeYears(years));
      const currentLink = await ctx.prisma.veetiOrganisaatio.findUnique({
        where: { orgId },
        select: { workspaceYears: true },
      });
      if (!currentLink) {
        return [];
      }

      const remainingWorkspaceYears = this.normalizeYears(
        (currentLink.workspaceYears ?? []).filter(
          (year) => !removeYears.has(year),
        ),
      );

      const link = await ctx.prisma.veetiOrganisaatio.update({
        where: { orgId },
        data: { workspaceYears: remainingWorkspaceYears },
        select: { workspaceYears: true },
      });
      return this.normalizeYears(link.workspaceYears ?? []);
    },
  };
}
