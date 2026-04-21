import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiEffectiveDataService } from '../veeti/veeti-effective-data.service';
import type {
  BaselineDatasetSource,
  BaselineMissingRequirement,
  BaselineSourceSummary,
  BaselineWarning,
  ImportYearSummaryRow,
  PlanningRole,
  SyncRequirement,
  TariffRevenueReason,
} from './v2-import-overview.types';

type ImportOverviewBaselineContext = {
  veetiBenchmarkService: VeetiBenchmarkService;
  normalizeText(value: string | null | undefined): string | null;
  round2(value: number): number;
  toNumber(value: unknown): number;
  resolvePlanningRole(year: number): PlanningRole;
  resolveLatestPrice(rows: Array<Record<string, unknown>>, typeId: number): number;
};

export function createV2ImportOverviewBaselineModel(
  ctx: ImportOverviewBaselineContext,
) {
  return {
    buildBaselineSourceSummary(
      importStatus: {
        years: Array<{
          vuosi: number;
          planningRole?: PlanningRole;
          sourceStatus?: 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
          sourceBreakdown?: {
            veetiDataTypes?: string[];
            manualDataTypes?: string[];
          };
        }>;
      },
      year: number,
      yearDataset: Awaited<
        ReturnType<VeetiEffectiveDataService['getYearDataset']>
      >,
    ): BaselineSourceSummary {
      const yearStatus =
        importStatus.years.find((row) => row.vuosi === year) ?? null;
      const financials = this.buildBaselineDatasetSource(
        yearDataset,
        'tilinpaatos',
        'tilinpaatos',
      );
      const prices = this.buildBaselineDatasetSource(
        yearDataset,
        'taksa',
        'taksa',
      );
      const volumes = this.mergeBaselineDatasetSources(yearDataset, [
        'volume_vesi',
        'volume_jatevesi',
      ]);

      return {
        year,
        planningRole: yearStatus?.planningRole ?? ctx.resolvePlanningRole(year),
        sourceStatus: yearStatus?.sourceStatus ?? yearDataset.sourceStatus,
        sourceBreakdown: {
          veetiDataTypes: yearStatus?.sourceBreakdown?.veetiDataTypes ?? [],
          manualDataTypes: yearStatus?.sourceBreakdown?.manualDataTypes ?? [],
        },
        financials,
        prices,
        volumes,
      };
    },

    buildBaselineDatasetSource(
      yearDataset: Awaited<
        ReturnType<VeetiEffectiveDataService['getYearDataset']>
      >,
      requestedDataType: string,
      fallbackDataType: string,
    ): BaselineDatasetSource {
      const dataset =
        yearDataset.datasets.find((row) => row.dataType === requestedDataType) ??
        null;

      return {
        dataType: dataset?.dataType ?? fallbackDataType,
        source: dataset?.source ?? 'none',
        provenance: dataset?.overrideMeta?.provenance ?? null,
        editedAt: dataset?.overrideMeta?.editedAt ?? null,
        editedBy: dataset?.overrideMeta?.editedBy ?? null,
        reason: dataset?.overrideMeta?.reason ?? null,
      };
    },

    mergeBaselineDatasetSources(
      yearDataset: Awaited<
        ReturnType<VeetiEffectiveDataService['getYearDataset']>
      >,
      dataTypes: string[],
    ): BaselineDatasetSource {
      const datasets = dataTypes
        .map(
          (dataType) =>
            yearDataset.datasets.find((row) => row.dataType === dataType) ??
            null,
        )
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const source = datasets.some((row) => row.source === 'manual')
        ? 'manual'
        : datasets.some((row) => row.source === 'veeti')
          ? 'veeti'
          : 'none';
      const overrideMeta =
        [...datasets]
          .map((row) => row.overrideMeta)
          .filter(
            (
              row,
            ): row is NonNullable<(typeof datasets)[number]['overrideMeta']> =>
              row !== null,
          )
          .sort(
            (left, right) =>
              new Date(right.editedAt).getTime() -
              new Date(left.editedAt).getTime(),
          )[0] ?? null;

      return {
        dataType: dataTypes.join('+'),
        source,
        provenance: overrideMeta?.provenance ?? null,
        editedAt: overrideMeta?.editedAt ?? null,
        editedBy: overrideMeta?.editedBy ?? null,
        reason: overrideMeta?.reason ?? null,
      };
    },

    buildKpi(value: number, previous: number | undefined) {
      return {
        value: ctx.round2(value),
        deltaYoY: previous == null ? null : ctx.round2(value - previous),
      };
    },

    async buildPeerSnapshot(orgId: string, year: number | null) {
      if (!year) {
        return {
          year: null,
          available: false,
          reason: 'No VEETI years imported.',
        };
      }

      try {
        const [benchmarks, peerGroup] = await Promise.all([
          ctx.veetiBenchmarkService.getBenchmarksForYear(orgId, year),
          ctx.veetiBenchmarkService.getPeerGroup(orgId),
        ]);

        const metricOrder = [
          'liikevaihto_per_m3',
          'vesi_yksikkohinta',
          'jatevesi_yksikkohinta',
          'liikevaihto',
        ];
        const selectedMetrics = metricOrder
          .map((key) => benchmarks.metrics.find((item) => item.metricKey === key))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        return {
          year,
          available: true,
          kokoluokka: benchmarks.kokoluokka,
          orgCount: benchmarks.orgCount,
          peerCount: peerGroup.peerCount ?? peerGroup.peers.length,
          computedAt: benchmarks.computedAt,
          isStale: benchmarks.isStale,
          staleAfterDays: benchmarks.staleAfterDays,
          peers: peerGroup.peers.slice(0, 8).map((peer) => ({
            veetiId: peer.veetiId,
            nimi: ctx.normalizeText(peer.nimi),
            ytunnus: ctx.normalizeText(peer.ytunnus),
            kunta: ctx.normalizeText(peer.kunta),
          })),
          metrics: selectedMetrics,
        };
      } catch (error) {
        return {
          year,
          available: false,
          reason:
            error instanceof Error ? error.message : 'Peer data unavailable.',
        };
      }
    },

    emptyCompleteness(): Record<string, boolean> {
      return {
        tilinpaatos: false,
        taksa: false,
        tariff_revenue: false,
        volume_vesi: false,
        volume_jatevesi: false,
        investointi: false,
        energia: false,
        verkko: false,
      };
    },

    resolveMissingSyncRequirements(
      completeness: Record<string, boolean>,
    ): SyncRequirement[] {
      const missing: SyncRequirement[] = [];
      if (!completeness.tilinpaatos) missing.push('financials');
      if (!completeness.taksa) missing.push('prices');
      if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
        missing.push('volumes');
      }
      if (
        completeness.tilinpaatos &&
        completeness.taksa &&
        (completeness.volume_vesi || completeness.volume_jatevesi) &&
        !completeness.tariff_revenue
      ) {
        missing.push('tariffRevenue');
      }
      return missing;
    },

    resolveSyncBlockReason(completeness: Record<string, boolean>): string | null {
      if (!completeness.tilinpaatos) {
        return 'Financial statement data is missing for this year.';
      }
      if (!completeness.taksa) {
        return 'Price data (taksa) is missing for this year.';
      }
      if (!completeness.volume_vesi && !completeness.volume_jatevesi) {
        return 'Sold volume data is missing for this year.';
      }
      if (!completeness.tariff_revenue) {
        return 'Fixed revenue is needed to reconcile tariff revenue for this year.';
      }
      return null;
    },

    resolveBaselineBlockReason(params: {
      completeness: Record<string, boolean>;
      baselineReady?: boolean;
      baselineMissingRequirements?: BaselineMissingRequirement[];
    }): string | null {
      if (typeof params.baselineReady !== 'boolean') {
        return this.resolveSyncBlockReason(params.completeness);
      }
      if (params.baselineReady) {
        return null;
      }
      const missing = params.baselineMissingRequirements ?? [];
      if (missing.includes('financialBaseline')) {
        return 'Financial baseline data is missing for this year.';
      }
      if (missing.includes('prices')) {
        return 'Price data (taksa) is missing for this year.';
      }
      if (missing.includes('volumes')) {
        return 'Sold volume data is missing for this year.';
      }
      return 'Year is missing baseline inputs.';
    },

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
    } {
      const summaryByField = new Map(
        summaryRows.map((row) => [row.sourceField, row]),
      );
      const revenueValue =
        summaryByField.get('Liikevaihto')?.effectiveValue ?? null;
      const financialBaselineReady =
        summaryRows.length > 0
          ? (
              [
                'Liikevaihto',
                'AineetJaPalvelut',
                'Henkilostokulut',
                'Poistot',
                'LiiketoiminnanMuutKulut',
              ] as const
            ).every((field) => summaryByField.get(field)?.effectiveValue != null) &&
            revenueValue != null &&
            revenueValue > 0
          : completeness.tilinpaatos === true;

      const taksaRows =
        yearDataset?.datasets.find((row) => row.dataType === 'taksa')
          ?.effectiveRows ?? [];
      const waterVolumeRows =
        yearDataset?.datasets.find((row) => row.dataType === 'volume_vesi')
          ?.effectiveRows ?? [];
      const wastewaterVolumeRows =
        yearDataset?.datasets.find((row) => row.dataType === 'volume_jatevesi')
          ?.effectiveRows ?? [];
      const waterPrice = ctx.resolveLatestPrice(taksaRows, 1);
      const wastewaterPrice = ctx.resolveLatestPrice(taksaRows, 2);
      const soldWaterVolume = waterVolumeRows.reduce(
        (sum, row) => sum + ctx.toNumber(row.Maara),
        0,
      );
      const soldWastewaterVolume = wastewaterVolumeRows.reduce(
        (sum, row) => sum + ctx.toNumber(row.Maara),
        0,
      );
      const hasDetailedDriverRows =
        taksaRows.length > 0 ||
        waterVolumeRows.length > 0 ||
        wastewaterVolumeRows.length > 0;

      const waterDriverReady = hasDetailedDriverRows
        ? waterPrice > 0 && soldWaterVolume > 0
        : completeness.taksa === true && completeness.volume_vesi === true;
      const wastewaterDriverReady = hasDetailedDriverRows
        ? wastewaterPrice > 0 && soldWastewaterVolume > 0
        : completeness.taksa === true && completeness.volume_jatevesi === true;
      const hasAnyPrice = hasDetailedDriverRows
        ? waterPrice > 0 || wastewaterPrice > 0
        : completeness.taksa === true;
      const hasAnyVolume = hasDetailedDriverRows
        ? soldWaterVolume > 0 || soldWastewaterVolume > 0
        : completeness.volume_vesi === true ||
          completeness.volume_jatevesi === true;

      const baselineMissingRequirements: BaselineMissingRequirement[] = [];
      if (!financialBaselineReady) {
        baselineMissingRequirements.push('financialBaseline');
      }
      if (!waterDriverReady && !wastewaterDriverReady) {
        if (!hasAnyPrice) {
          baselineMissingRequirements.push('prices');
        }
        if (!hasAnyVolume) {
          baselineMissingRequirements.push('volumes');
        }
        if (hasAnyPrice && hasAnyVolume) {
          baselineMissingRequirements.push('prices', 'volumes');
        }
      }

      return {
        baselineReady: baselineMissingRequirements.length === 0,
        baselineMissingRequirements,
        baselineWarnings:
          tariffRevenueReason != null ? ['tariffRevenueMismatch'] : [],
      };
    },

    augmentCompletenessWithTariffRevenue(
      completeness: Record<string, boolean>,
      yearDataset:
        | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
        | null
        | undefined,
    ): {
      completeness: Record<string, boolean>;
      tariffRevenueReason: TariffRevenueReason | null;
    } {
      const tariffRevenueStatus =
        this.evaluateTariffRevenueStructureStatus(yearDataset);
      const tariffRevenueReady =
        tariffRevenueStatus.ready ??
        this.resolveFallbackTariffRevenueReadiness(completeness);
      return {
        completeness: {
          ...this.emptyCompleteness(),
          ...completeness,
          tariff_revenue: tariffRevenueReady,
        },
        tariffRevenueReason: tariffRevenueReady ? null : tariffRevenueStatus.reason,
      };
    },

    resolveFallbackTariffRevenueReadiness(
      completeness: Record<string, boolean>,
    ): boolean {
      if (typeof completeness.tariff_revenue === 'boolean') {
        return completeness.tariff_revenue;
      }
      return (
        completeness.tilinpaatos === true &&
        completeness.taksa === true &&
        (completeness.volume_vesi === true ||
          completeness.volume_jatevesi === true)
      );
    },

    evaluateTariffRevenueStructureStatus(
      yearDataset:
        | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
        | null
        | undefined,
    ): {
      ready: boolean | null;
      reason: TariffRevenueReason | null;
    } {
      const financialRow =
        (yearDataset?.datasets.find((row) => row.dataType === 'tilinpaatos')
          ?.effectiveRows?.[0] as Record<string, unknown> | undefined) ?? null;
      const taksaRows =
        yearDataset?.datasets.find((row) => row.dataType === 'taksa')
          ?.effectiveRows ?? [];
      const waterVolumeRows =
        yearDataset?.datasets.find((row) => row.dataType === 'volume_vesi')
          ?.effectiveRows ?? [];
      const wastewaterVolumeRows =
        yearDataset?.datasets.find((row) => row.dataType === 'volume_jatevesi')
          ?.effectiveRows ?? [];

      const toNullableNumber = (value: unknown): number | null => {
        if (value == null || value === '') return null;
        const parsed = ctx.toNumber(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const expectedSalesRevenue = toNullableNumber(financialRow?.Liikevaihto);
      const waterPrice = ctx.resolveLatestPrice(taksaRows, 1);
      const wastewaterPrice = ctx.resolveLatestPrice(taksaRows, 2);
      const soldWaterVolume = waterVolumeRows.reduce(
        (sum, row) => sum + ctx.toNumber(row.Maara),
        0,
      );
      const soldWastewaterVolume = wastewaterVolumeRows.reduce(
        (sum, row) => sum + ctx.toNumber(row.Maara),
        0,
      );
      const fixedRevenue = toNullableNumber(financialRow?.PerusmaksuYhteensa);

      const hasRequiredInputs =
        expectedSalesRevenue != null &&
        (soldWaterVolume > 0 || soldWastewaterVolume > 0) &&
        (waterPrice > 0 || wastewaterPrice > 0);
      if (!hasRequiredInputs) {
        return { ready: null, reason: null };
      }

      if (fixedRevenue == null) {
        return { ready: false, reason: 'missing_fixed_revenue' };
      }

      const derivedSalesRevenue = ctx.round2(
        waterPrice * soldWaterVolume +
          wastewaterPrice * soldWastewaterVolume +
          fixedRevenue,
      );

      return Math.abs(ctx.round2(expectedSalesRevenue) - derivedSalesRevenue) <= 1
        ? { ready: true, reason: null }
        : { ready: false, reason: 'mismatch' };
    },
  };
}
