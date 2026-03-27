import { PrismaService } from '../prisma/prisma.service';

type ImportStatusLike = {
  years?: Array<{
    vuosi: number;
    completeness?: Record<string, boolean>;
    sourceStatus?: string;
    sourceBreakdown?: {
      veetiDataTypes?: string[];
      manualDataTypes?: string[];
    };
    isExcluded?: boolean;
  }>;
  workspaceYears?: number[] | null;
};

export class V2PlanningWorkspaceSupport {
  constructor(private readonly prisma: PrismaService) {}

  normalizeYears(years: number[]): number[] {
    const unique = new Set<number>();
    for (const raw of years) {
      const parsed = Math.round(Number(raw));
      if (Number.isFinite(parsed)) unique.add(parsed);
    }
    return [...unique].sort((a, b) => a - b);
  }

  resolveWorkspaceYearRows(importStatus: ImportStatusLike) {
    const importedYears = this.resolveImportedYears(importStatus);
    const workspaceYearSet = new Set(importedYears);
    return (importStatus.years ?? []).filter((row) =>
      workspaceYearSet.has(row.vuosi),
    );
  }

  resolveImportedYears(importStatus: Pick<ImportStatusLike, 'years' | 'workspaceYears'>): number[] {
    return this.normalizeYears(importStatus.workspaceYears ?? []);
  }

  async resolveLatestAcceptedVeetiBudgetId(
    orgId: string,
  ): Promise<string | null> {
    if (!this.prisma.talousarvio?.findFirst) {
      return null;
    }
    const acceptedYears = await this.resolvePlanningBaselineYears(orgId, {
      persistRepair: true,
    });
    if (acceptedYears.length === 0) {
      return null;
    }
    const row = await this.prisma.talousarvio.findFirst({
      where: {
        orgId,
        lahde: 'veeti',
        OR: [
          { veetiVuosi: { in: acceptedYears } },
          { vuosi: { in: acceptedYears } },
        ],
      },
      orderBy: [
        { veetiVuosi: 'desc' },
        { vuosi: 'desc' },
        { updatedAt: 'desc' },
      ],
      select: { id: true },
    });
    return row?.id ?? null;
  }

  async resolveAcceptedPlanningBaselineBudgetIds(
    orgId: string,
  ): Promise<string[]> {
    if (!this.prisma.talousarvio?.findMany) {
      return [];
    }
    const acceptedYears = await this.resolvePlanningBaselineYears(orgId, {
      persistRepair: true,
    });
    if (acceptedYears.length === 0) {
      return [];
    }
    const rows = await this.prisma.talousarvio.findMany({
      where: {
        orgId,
        lahde: 'veeti',
        OR: [
          { veetiVuosi: { in: acceptedYears } },
          { vuosi: { in: acceptedYears } },
        ],
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async resolvePlanningBaselineYears(
    orgId: string,
    options?: {
      link?: { veetiId: number; workspaceYears?: number[] } | null;
      persistRepair?: boolean;
    },
  ): Promise<number[]> {
    const link =
      options?.link ??
      (await this.prisma.veetiOrganisaatio?.findUnique?.({
        where: { orgId },
        select: { veetiId: true, workspaceYears: true },
      })) ??
      null;
    if (!link) {
      return [];
    }

    const workspaceYears = this.normalizeYears(link.workspaceYears ?? []);
    if (!this.prisma.veetiYearPolicy?.findMany) {
      return workspaceYears;
    }
    const policies = await this.prisma.veetiYearPolicy.findMany({
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
  }

  async resolveFallbackPlanningBaselineYears(
    orgId: string,
    workspaceYears: number[],
  ): Promise<number[]> {
    if (!this.prisma.talousarvio?.findMany || !this.prisma.ennuste?.findMany) {
      return this.normalizeYears(workspaceYears);
    }
    const workspaceYearSet = new Set(this.normalizeYears(workspaceYears));
    const [veetiBudgets, scenarios] = await Promise.all([
      this.prisma.talousarvio.findMany({
        where: { orgId, lahde: 'veeti' },
        select: { vuosi: true, veetiVuosi: true },
      }),
      this.prisma.ennuste.findMany({
        where: { orgId },
        select: {
          talousarvio: {
            select: {
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
      if (Number.isFinite(year)) {
        acceptedYears.add(year);
      }
    }

    return [...acceptedYears].sort((a, b) => a - b);
  }

  async persistPlanningBaselineYears(
    orgId: string,
    veetiId: number,
    workspaceYears: number[],
    includedYears: number[],
  ): Promise<void> {
    if (
      !this.prisma.veetiYearPolicy?.findMany ||
      !this.prisma.veetiYearPolicy?.upsert
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
    const existingPolicies = await this.prisma.veetiYearPolicy.findMany({
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
        this.prisma.veetiYearPolicy.upsert({
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
  }

  async getWorkspaceYears(orgId: string): Promise<number[]> {
    if (!this.prisma.veetiOrganisaatio?.findUnique) {
      return [];
    }

    const link = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link?.workspaceYears ?? []);
  }

  async persistWorkspaceYears(
    orgId: string,
    years: number[],
  ): Promise<number[]> {
    if (
      !this.prisma.veetiOrganisaatio?.findUnique ||
      !this.prisma.veetiOrganisaatio?.update
    ) {
      return this.normalizeYears(years);
    }

    const currentLink = await this.prisma.veetiOrganisaatio.findUnique({
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
    const link = await this.prisma.veetiOrganisaatio.update({
      where: { orgId },
      data: { workspaceYears: nextWorkspaceYears },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link.workspaceYears ?? []);
  }

  async removeWorkspaceYears(
    orgId: string,
    years: number[],
  ): Promise<number[]> {
    if (
      !this.prisma.veetiOrganisaatio?.findUnique ||
      !this.prisma.veetiOrganisaatio?.update
    ) {
      return [];
    }

    const removeYears = new Set(this.normalizeYears(years));
    const currentLink = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { workspaceYears: true },
    });
    if (!currentLink) {
      return [];
    }

    const remainingWorkspaceYears = this.normalizeYears(
      (currentLink.workspaceYears ?? []).filter((year) => !removeYears.has(year)),
    );

    const link = await this.prisma.veetiOrganisaatio.update({
      where: { orgId },
      data: { workspaceYears: remainingWorkspaceYears },
      select: { workspaceYears: true },
    });
    return this.normalizeYears(link.workspaceYears ?? []);
  }
}
