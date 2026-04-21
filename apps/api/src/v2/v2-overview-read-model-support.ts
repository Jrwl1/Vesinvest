import { BadRequestException,ForbiddenException,Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import { VEETI_TARIFF_SCOPE } from '../veeti/veeti-import-contract';
import { VeetiSyncService } from '../veeti/veeti-sync.service';
import { VeetiService } from '../veeti/veeti.service';
import type { TrendPoint } from './v2-forecast.types';
import type { BaselineSourceSummary } from './v2-import-overview.types';

type OverviewReadModelContext = {
  logger: Logger;
  prisma: PrismaService;
  veetiService: VeetiService;
  veetiSyncService: VeetiSyncService;
  veetiEffectiveDataService: VeetiEffectiveDataService;
  veetiBenchmarkService: VeetiBenchmarkService;
  sanitizeOpsAttrs(
    attrs: Record<string, unknown> | undefined,
  ): Record<string, string | number | boolean | null>;
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
  annotatePlanningYearRows<T extends { vuosi: number }>(
    yearRows: T[],
  ): Array<T & { planningRole: 'historical' | 'current_year_estimate' }>;
  resolveBaselineBlockReason(params: {
    completeness: Record<string, boolean>;
    baselineReady?: boolean;
    baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
  }): string | null;
  getWorkspaceYears(orgId: string): Promise<number[]>;
  resolveVeetiOrgLanguage(
    veetiId: number | null | undefined,
  ): Promise<{ kieliId: number | null; uiLanguage: 'fi' | 'sv' | null }>;
  resolvePlanningBaselineYears(
    orgId: string,
    options?: {
      link?: { veetiId: number; workspaceYears?: number[] } | null;
      persistRepair?: boolean;
    },
  ): Promise<number[]>;
  getImportStatus(orgId: string): Promise<{
    years: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      planningRole?: 'historical' | 'current_year_estimate';
      sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
      sourceBreakdown?: {
        veetiDataTypes?: string[];
        manualDataTypes?: string[];
      };
      baselineReady?: boolean;
      baselineMissingRequirements?: Array<'financialBaseline' | 'prices' | 'volumes'>;
    }>;
    link?: { veetiId?: number | null } | null;
    planningBaselineYears?: number[];
  }>;
  getTrendSeries(orgId: string): Promise<TrendPoint[]>;
  resolveLatestDataIndex(points: TrendPoint[]): number;
  resolveLatestComparableYear(
    years:
      | Array<{
          vuosi: number;
          completeness?: {
            tilinpaatos?: boolean;
            volume_vesi?: boolean;
            volume_jatevesi?: boolean;
          };
        }>
      | undefined,
  ): number | null;
  buildKpi(value: number, previous: number | undefined): {
    value: number;
    deltaYoY: number | null;
  };
  buildPeerSnapshot(orgId: string, year: number | null): Promise<unknown>;
  buildBaselineSourceSummary(
    importStatus: {
      years: Array<{
        vuosi: number;
        planningRole?: 'historical' | 'current_year_estimate';
        sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
        sourceBreakdown?: {
          veetiDataTypes?: string[];
          manualDataTypes?: string[];
        };
      }>;
    },
    year: number,
    yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
  ): BaselineSourceSummary;
  normalizeYears(years: number[]): number[];
  resolveImportedYears(importStatus: {
    years?: Array<{ vuosi: number }>;
    workspaceYears?: number[];
  }): number[];
  resolvePlanningRole(year: number): 'historical' | 'current_year_estimate';
  resolveLatestAcceptedVeetiBudgetId(orgId: string): Promise<string | null>;
  round2(value: number): number;
  toNumber(value: unknown): number;
};

export function createV2OverviewReadModelSupport(ctx: OverviewReadModelContext) {
  return {
  async trackOpsEvent(
    orgId: string,
    userId: string,
    roles: string[],
    body: { event: string; status?: string; attrs?: Record<string, unknown> },
  ) {
    const payload = {
      type: 'ops_event',
      event: body.event,
      status: body.status ?? 'info',
      orgId,
      userId,
      roles,
      at: new Date().toISOString(),
      attrs: ctx.sanitizeOpsAttrs(body.attrs),
    };

    const line = JSON.stringify(payload);
    if ((body.status ?? 'info').toLowerCase() === 'error') {
      ctx.logger.error(line);
    } else if ((body.status ?? 'info').toLowerCase() === 'warn') {
      ctx.logger.warn(line);
    } else {
      ctx.logger.log(line);
    }

    return { accepted: true };
  },

  async getOpsFunnel(orgId: string, roles: string[]) {
    const isAdmin = roles.some((role) => role.toUpperCase() === 'ADMIN');
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can access ops funnel data.');
    }

    const [link, rawYearRows, veetiBudgetCount, scenarioCount, reportCount] =
      await Promise.all([
        ctx.prisma.veetiOrganisaatio.findUnique({ where: { orgId } }),
        ctx.veetiSyncService.getAvailableYears(orgId),
        ctx.prisma.talousarvio.count({
          where: {
            orgId,
            OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
          },
        }),
        ctx.prisma.ennuste.count({ where: { orgId } }),
        ctx.prisma.ennusteReport.count({ where: { orgId } }),
      ]);
    const yearRows = await ctx.hydrateYearRowsWithTariffRevenueReadiness(
      orgId,
      rawYearRows,
    );

    const computedScenarioCount = await ctx.prisma.ennuste.count({
      where: {
        orgId,
        vuodet: { some: {} },
      },
    });

    const [orgCount, connectedOrgCount, importedOrgCount, scenarioOrgCount] =
      await Promise.all([
        ctx.prisma.organization.count(),
        ctx.prisma.organization.count({
          where: { veetiLink: { isNot: null } },
        }),
        ctx.prisma.organization.count({
          where: {
            talousarviot: {
              some: {
                OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
              },
            },
          },
        }),
        ctx.prisma.organization.count({
          where: {
            ennusteet: { some: {} },
          },
        }),
      ]);

    return {
      organization: {
        orgId,
        connected: Boolean(link),
        importedYearCount: yearRows.length,
        syncReadyYearCount: yearRows.filter(
          (row) => ctx.resolveBaselineBlockReason(row) === null,
        ).length,
        blockedYearCount: yearRows.filter(
          (row) => ctx.resolveBaselineBlockReason(row) !== null,
        ).length,
        latestFetchedAt: link?.lastFetchedAt?.toISOString() ?? null,
        veetiBudgetCount,
        scenarioCount,
        computedScenarioCount,
        reportCount,
      },
      system: {
        orgCount,
        connectedOrgCount,
        importedOrgCount,
        scenarioOrgCount,
      },
      computedAt: new Date().toISOString(),
    };
  },

  async getImportStatus(orgId: string) {
    const [link, years, excludedYears, workspaceYears] = await Promise.all([
      ctx.veetiSyncService.getStatus(orgId),
      ctx.veetiSyncService.getAvailableYears(orgId),
      ctx.veetiEffectiveDataService.getExcludedYears(orgId),
      ctx.getWorkspaceYears(orgId),
    ]);
    const linkLanguage = await ctx.resolveVeetiOrgLanguage(link?.veetiId);
    const availableYears = ctx.annotatePlanningYearRows(
      await ctx.hydrateYearRowsWithTariffRevenueReadiness(
        orgId,
        years.sort((a, b) => a.vuosi - b.vuosi),
      ),
    );
    const planningBaselineYears = await ctx.resolvePlanningBaselineYears(
      orgId,
      {
        link: link
          ? {
              veetiId: link.veetiId,
              workspaceYears,
            }
          : null,
        persistRepair: true,
      },
    );
    return {
      connected: Boolean(link),
      link: link
        ? {
            ...link,
            ...linkLanguage,
          }
        : null,
      tariffScope: VEETI_TARIFF_SCOPE,
      years: availableYears,
      availableYears,
      excludedYears,
      workspaceYears,
      planningBaselineYears,
    };
  },

  async getOverview(orgId: string) {
    const [importStatus, trendSeries] = await Promise.all([
      ctx.getImportStatus(orgId),
      ctx.getTrendSeries(orgId),
    ]);

    const latestKpiIndex = ctx.resolveLatestDataIndex(trendSeries);
    const latest = latestKpiIndex >= 0 ? trendSeries[latestKpiIndex] : null;
    const previous =
      latestKpiIndex > 0 ? trendSeries[latestKpiIndex - 1] : null;
    const latestVeetiYear =
      ctx.resolveLatestComparableYear(importStatus.years) ??
      latest?.year ??
      null;

    const kpis = {
      revenue: ctx.buildKpi(latest?.revenue ?? 0, previous?.revenue),
      operatingCosts: ctx.buildKpi(
        latest?.operatingCosts ?? 0,
        previous?.operatingCosts,
      ),
      costs: ctx.buildKpi(
        latest?.operatingCosts ?? 0,
        previous?.operatingCosts,
      ),
      financingNet: ctx.buildKpi(
        latest?.financingNet ?? 0,
        previous?.financingNet,
      ),
      otherResultItems: ctx.buildKpi(
        latest?.otherResultItems ?? 0,
        previous?.otherResultItems,
      ),
      yearResult: ctx.buildKpi(latest?.yearResult ?? 0, previous?.yearResult),
      result: ctx.buildKpi(latest?.yearResult ?? 0, previous?.yearResult),
      volume: ctx.buildKpi(latest?.volume ?? 0, previous?.volume),
      combinedPrice: ctx.buildKpi(
        latest?.combinedPrice ?? 0,
        previous?.combinedPrice,
      ),
    };

    const peerSnapshot = await ctx.buildPeerSnapshot(orgId, latestVeetiYear);

    return {
      latestVeetiYear,
      importStatus,
      kpis,
      trendSeries,
      peerSnapshot,
    };
  },

  async getPlanningContext(orgId: string) {
    const importStatus = await ctx.getImportStatus(orgId);
    const veetiId = importStatus.link?.veetiId ?? null;
    const acceptedBaselineYears = ctx.normalizeYears(
      importStatus.planningBaselineYears ?? [],
    );

    const investmentByYear = new Map<number, number>();
    const soldWaterByYear = new Map<number, number>();
    const soldWastewaterByYear = new Map<number, number>();
    const processElectricityByYear = new Map<number, number>();
    const baselineSourceSummaryByYear = new Map<number, BaselineSourceSummary>();

    const importedYears = ctx.resolveImportedYears(importStatus);
    const sourceYears = ctx.normalizeYears([
      ...importedYears,
      ...acceptedBaselineYears,
    ]);
    await Promise.all(
      sourceYears.map(async (year) => {
        const [investointi, volumeVesi, volumeJatevesi, energia, yearDataset] =
          await Promise.all([
            ctx.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'investointi',
            ),
            ctx.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'volume_vesi',
            ),
            ctx.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'volume_jatevesi',
            ),
            ctx.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              year,
              'energia',
            ),
            ctx.veetiEffectiveDataService.getYearDataset(orgId, year),
          ]);

        const investmentSum = investointi.rows.reduce(
          (acc, item) =>
            acc +
            ctx.toNumber(item.InvestoinninMaara) +
            ctx.toNumber(item.KorvausInvestoinninMaara),
          0,
        );
        if (investmentSum !== 0) {
          investmentByYear.set(year, ctx.round2(investmentSum));
        }

        const waterSum = volumeVesi.rows.reduce(
          (acc, item) => acc + ctx.toNumber(item.Maara),
          0,
        );
        if (waterSum !== 0) {
          soldWaterByYear.set(year, ctx.round2(waterSum));
        }

        const wastewaterSum = volumeJatevesi.rows.reduce(
          (acc, item) => acc + ctx.toNumber(item.Maara),
          0,
        );
        if (wastewaterSum !== 0) {
          soldWastewaterByYear.set(year, ctx.round2(wastewaterSum));
        }

        const processElectricitySum = energia.rows.reduce(
          (acc, item) => acc + ctx.toNumber(item.ProsessinKayttamaSahko),
          0,
        );
        if (processElectricitySum !== 0) {
          processElectricityByYear.set(
            year,
            ctx.round2(processElectricitySum),
          );
        }

        baselineSourceSummaryByYear.set(
          year,
          ctx.buildBaselineSourceSummary(importStatus, year, yearDataset),
        );
      }),
    );

    const safeFetch = async <T>(
      work: () => Promise<T>,
      fallback: T,
    ): Promise<T> => {
      try {
        return await work();
      } catch {
        return fallback;
      }
    };

    const [pumpedRows, waterTradeRows, rehabRows, reportRows, permitRows] =
      veetiId == null
        ? [[], [], [], [], []]
        : await Promise.all([
            safeFetch(
              () =>
                ctx.veetiService.fetchVerkostoonPumpattuTalousvesi(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => ctx.veetiService.fetchTalousvedenOstoJaMyynti(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => ctx.veetiService.fetchVerkkojenSaneeraukset(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => ctx.veetiService.fetchToimintakertomus(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
            safeFetch(
              () => ctx.veetiService.fetchVedenottoluvat(veetiId),
              [] as Array<Record<string, unknown>>,
            ),
          ]);

    const latestImportedYear = importedYears[importedYears.length - 1] ?? null;
    const networkRows =
      latestImportedYear == null
        ? []
        : (
            await ctx.veetiEffectiveDataService.getEffectiveRows(
              orgId,
              latestImportedYear,
              'verkko',
            )
          ).rows;

    const pumpedByYear = new Map<number, number>();
    for (const row of pumpedRows) {
      const year = ctx.toNumber(row.Vuosi);
      if (!year) continue;
      const current = pumpedByYear.get(year) ?? 0;
      pumpedByYear.set(year, current + ctx.toNumber(row.Maara));
    }

    const boughtWaterByYear = new Map<number, number>();
    const soldWaterTradeByYear = new Map<number, number>();
    for (const row of waterTradeRows) {
      const year = ctx.toNumber(row.Vuosi);
      if (!year) continue;
      const amount = ctx.toNumber(row.Maara);
      const buyer = ctx.toNumber(row.OstajaVesihuoltoOrganisaatio_Id);
      const seller = ctx.toNumber(row.MyyjaVesihuoltoOrganisaatio_Id);

      if (veetiId != null && buyer === veetiId) {
        boughtWaterByYear.set(
          year,
          (boughtWaterByYear.get(year) ?? 0) + amount,
        );
      }
      if (veetiId != null && seller === veetiId) {
        soldWaterTradeByYear.set(
          year,
          (soldWaterTradeByYear.get(year) ?? 0) + amount,
        );
      }
    }

    const rehabByYear = new Map<number, number>();
    for (const row of rehabRows) {
      const year = ctx.toNumber(row.Vuosi);
      if (!year) continue;
      rehabByYear.set(
        year,
        (rehabByYear.get(year) ?? 0) + ctx.toNumber(row.Pituus),
      );
    }

    const reportYears = reportRows
      .map((row) => ctx.toNumber(row.Vuosi))
      .filter((year) => year > 0);

    const years = new Set<number>();
    for (const year of importedYears) years.add(year);
    for (const year of investmentByYear.keys()) years.add(year);
    for (const year of soldWaterByYear.keys()) years.add(year);
    for (const year of soldWastewaterByYear.keys()) years.add(year);
    for (const year of processElectricityByYear.keys()) years.add(year);
    for (const year of pumpedByYear.keys()) years.add(year);
    for (const year of boughtWaterByYear.keys()) years.add(year);
    for (const year of soldWaterTradeByYear.keys()) years.add(year);
    for (const year of rehabByYear.keys()) years.add(year);

    const baselineYears = acceptedBaselineYears.map((year) => {
      const yearStatus = importStatus.years.find((row) => row.vuosi === year);
      const completeness = yearStatus?.completeness ?? {};
      const sourceSummary = baselineSourceSummaryByYear.get(year) ?? null;
      const useBaselineReadiness =
        typeof yearStatus?.baselineReady === 'boolean' ||
        Array.isArray(yearStatus?.baselineMissingRequirements);
      const baselineMissing = new Set(yearStatus?.baselineMissingRequirements ?? []);
      const hasFinancials = useBaselineReadiness
        ? !baselineMissing.has('financialBaseline')
        : sourceSummary?.financials?.source !== 'none' ||
          completeness.tilinpaatos === true;
      const hasPrices = useBaselineReadiness
        ? !baselineMissing.has('prices')
        : sourceSummary?.prices?.source !== 'none' ||
          completeness.taksa === true;
      const hasVolume = useBaselineReadiness
        ? !baselineMissing.has('volumes')
        : sourceSummary?.volumes?.source !== 'none' ||
          completeness.volume_vesi === true ||
          completeness.volume_jatevesi === true;
      const quality: 'complete' | 'partial' | 'missing' =
        hasFinancials && hasPrices && hasVolume
          ? 'complete'
          : hasFinancials || hasPrices || hasVolume
          ? 'partial'
          : 'missing';

      const soldWaterVolume = ctx.round2(soldWaterByYear.get(year) ?? 0);
      const soldWastewaterVolume = ctx.round2(
        soldWastewaterByYear.get(year) ?? 0,
      );
      const combinedSoldVolume = ctx.round2(
        soldWaterVolume + soldWastewaterVolume,
      );
      const waterBoughtVolume = ctx.round2(boughtWaterByYear.get(year) ?? 0);
      const waterSoldVolume = ctx.round2(soldWaterTradeByYear.get(year) ?? 0);

      return {
        year,
        planningRole:
          sourceSummary?.planningRole ??
          yearStatus?.planningRole ??
          ctx.resolvePlanningRole(year),
        quality,
        sourceStatus: sourceSummary?.sourceStatus ?? yearStatus?.sourceStatus ?? 'INCOMPLETE',
        sourceBreakdown: sourceSummary?.sourceBreakdown ?? {
          veetiDataTypes: yearStatus?.sourceBreakdown?.veetiDataTypes ?? [],
          manualDataTypes: yearStatus?.sourceBreakdown?.manualDataTypes ?? [],
        },
        financials: sourceSummary?.financials ?? {
          dataType: 'tilinpaatos',
          source: 'none',
          provenance: null,
          editedAt: null,
          editedBy: null,
          reason: null,
        },
        prices: sourceSummary?.prices ?? {
          dataType: 'taksa',
          source: 'none',
          provenance: null,
          editedAt: null,
          editedBy: null,
          reason: null,
        },
        volumes: sourceSummary?.volumes ?? {
          dataType: 'volume_vesi',
          source: 'none',
          provenance: null,
          editedAt: null,
          editedBy: null,
          reason: null,
        },
        investmentAmount: ctx.round2(investmentByYear.get(year) ?? 0),
        soldWaterVolume,
        soldWastewaterVolume,
        combinedSoldVolume,
        processElectricity: ctx.round2(
          processElectricityByYear.get(year) ?? 0,
        ),
        pumpedWaterVolume: ctx.round2(pumpedByYear.get(year) ?? 0),
        waterBoughtVolume,
        waterSoldVolume,
        netWaterTradeVolume: ctx.round2(waterBoughtVolume - waterSoldVolume),
      };
    });

    const canCreateScenario =
      (await ctx.resolveLatestAcceptedVeetiBudgetId(orgId)) !== null;

    return {
      canCreateScenario,
      baselineYears,
      operations: {
        latestYear: baselineYears[baselineYears.length - 1]?.year ?? null,
        energySeries: Array.from(processElectricityByYear.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([year, processElectricity]) => ({
            year,
            processElectricity: ctx.round2(processElectricity),
          })),
        networkRehabSeries: Array.from(rehabByYear.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([year, length]) => ({
            year,
            length: ctx.round2(length),
          })),
        networkAssetsCount: networkRows.length,
        toimintakertomusCount: reportRows.length,
        toimintakertomusLatestYear:
          reportYears.length > 0 ? Math.max(...reportYears) : null,
        vedenottolupaCount: permitRows.length,
        activeVedenottolupaCount: permitRows.filter(
          (row) => row.OnkoVoimassa === true,
        ).length,
      },
    };
  },

  async refreshPeerSnapshot(orgId: string, requestedYear?: number) {
    const trendSeries = await ctx.getTrendSeries(orgId);
    const fallbackYear = trendSeries[trendSeries.length - 1]?.year ?? null;
    const targetYear = Number.isInteger(requestedYear)
      ? requestedYear!
      : fallbackYear;
    if (!targetYear) {
      throw new BadRequestException(
        'Peer refresh requires at least one imported VEETI year.',
      );
    }

    const recompute = await ctx.veetiBenchmarkService.recomputeYear(
      targetYear,
    );
    const peerSnapshot = await ctx.buildPeerSnapshot(orgId, targetYear);
    return { targetYear, recompute, peerSnapshot };
  },

  };
}
