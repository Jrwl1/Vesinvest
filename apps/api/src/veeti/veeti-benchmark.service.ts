import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiService } from './veeti.service';

type MetricRow = {
  veetiId: number;
  kokoluokka: 'pieni' | 'keski' | 'suuri';
  nimi: string | null;
  ytunnus: string | null;
  kunta: string | null;
  metrics: Record<string, number>;
};

type RecomputeResult = {
  vuosi: number;
  computed: number;
  sourceOrgCount: number;
  computedAt: string;
  constraints: {
    chunkSize: number;
    chunkDelayMs: number;
    retries: number;
    timeoutMs: number;
  };
};

const BENCHMARK_CHUNK_SIZE = 50;
const BENCHMARK_CHUNK_DELAY_MS = 250;
const BENCHMARK_MAX_RETRIES = 3;
const BENCHMARK_TOTAL_TIMEOUT_MS = 10 * 60 * 1000;
const BENCHMARK_STALE_DAYS = 30;

@Injectable()
export class VeetiBenchmarkService {
  private readonly logger = new Logger(VeetiBenchmarkService.name);
  private readonly recomputeInFlight = new Map<
    number,
    Promise<RecomputeResult>
  >();
  private readonly peerSamplesByYear = new Map<number, MetricRow[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly veetiService: VeetiService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
  ) {}

  async recomputeYear(vuosi: number): Promise<RecomputeResult> {
    const existing = this.recomputeInFlight.get(vuosi);
    if (existing) return existing;

    const run = this.recomputeYearUnlocked(vuosi).finally(() => {
      this.recomputeInFlight.delete(vuosi);
    });

    this.recomputeInFlight.set(vuosi, run);
    return run;
  }

  private async recomputeYearUnlocked(vuosi: number): Promise<RecomputeResult> {
    const startedAt = Date.now();
    const computedAt = new Date();
    const organizations = await this.veetiService.listOrganizations();
    if (organizations.length === 0) {
      const emptyResult: RecomputeResult = {
        vuosi,
        computed: 0,
        sourceOrgCount: 0,
        computedAt: computedAt.toISOString(),
        constraints: {
          chunkSize: BENCHMARK_CHUNK_SIZE,
          chunkDelayMs: BENCHMARK_CHUNK_DELAY_MS,
          retries: BENCHMARK_MAX_RETRIES,
          timeoutMs: BENCHMARK_TOTAL_TIMEOUT_MS,
        },
      };
      this.peerSamplesByYear.set(vuosi, []);
      return emptyResult;
    }

    const rows: MetricRow[] = [];
    for (
      let index = 0;
      index < organizations.length;
      index += BENCHMARK_CHUNK_SIZE
    ) {
      if (Date.now() - startedAt > BENCHMARK_TOTAL_TIMEOUT_MS) {
        throw new BadRequestException(
          `Benchmark recompute timed out after ${BENCHMARK_TOTAL_TIMEOUT_MS} ms.`,
        );
      }

      const chunk = organizations.slice(index, index + BENCHMARK_CHUNK_SIZE);
      const chunkRows = await Promise.all(
        chunk.map(async (org) => {
          const row = await this.fetchMetricsWithRetry(org.Id, vuosi);
          if (!row) return null;
          const kokoluokka = this.classify(row.metrics.vesi_volume ?? 0);
          return {
            veetiId: row.veetiId,
            kokoluokka,
            nimi: org.Nimi ?? null,
            ytunnus: org.YTunnus ?? null,
            kunta: org.Kunta ?? null,
            metrics: row.metrics,
          } satisfies MetricRow;
        }),
      );

      for (const row of chunkRows) {
        if (!row) continue;
        rows.push(row);
      }

      const hasNext = index + BENCHMARK_CHUNK_SIZE < organizations.length;
      if (hasNext) {
        await this.sleep(BENCHMARK_CHUNK_DELAY_MS);
      }
    }

    const metricKeys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row.metrics)) metricKeys.add(key);
    }

    const statsRows: Array<{
      vuosi: number;
      metricKey: string;
      kokoluokka: string;
      orgCount: number;
      avgValue: number;
      medianValue: number;
      p25Value: number;
      p75Value: number;
      minValue: number;
      maxValue: number;
      computedAt: Date;
    }> = [];

    for (const metricKey of metricKeys) {
      for (const kokoluokka of ['pieni', 'keski', 'suuri'] as const) {
        const values = rows
          .filter((row) => row.kokoluokka === kokoluokka)
          .map((row) => row.metrics[metricKey])
          .filter((value): value is number => Number.isFinite(value));

        if (values.length === 0) continue;

        values.sort((a, b) => a - b);
        const avg =
          values.reduce((sum, value) => sum + value, 0) / values.length;

        statsRows.push({
          vuosi,
          metricKey,
          kokoluokka,
          orgCount: values.length,
          avgValue: avg,
          medianValue: this.percentile(values, 0.5),
          p25Value: this.percentile(values, 0.25),
          p75Value: this.percentile(values, 0.75),
          minValue: values[0],
          maxValue: values[values.length - 1],
          computedAt,
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.veetiBenchmark.deleteMany({ where: { vuosi } });
      if (statsRows.length > 0) {
        await tx.veetiBenchmark.createMany({ data: statsRows });
      }
    });

    this.peerSamplesByYear.set(vuosi, rows);

    const result: RecomputeResult = {
      vuosi,
      computed: rows.length,
      sourceOrgCount: organizations.length,
      computedAt: computedAt.toISOString(),
      constraints: {
        chunkSize: BENCHMARK_CHUNK_SIZE,
        chunkDelayMs: BENCHMARK_CHUNK_DELAY_MS,
        retries: BENCHMARK_MAX_RETRIES,
        timeoutMs: BENCHMARK_TOTAL_TIMEOUT_MS,
      },
    };

    return result;
  }

  async getBenchmarksForYear(orgId: string, vuosi: number) {
    let rows = await this.prisma.veetiBenchmark.findMany({ where: { vuosi } });
    if (rows.length === 0) {
      await this.ensureYearComputed(vuosi);
      rows = await this.prisma.veetiBenchmark.findMany({ where: { vuosi } });
    }

    const orgMetrics = await this.computeOrgMetrics(orgId, vuosi);
    const orgClass = this.classify(orgMetrics?.vesi_volume ?? 0);
    const classRows = rows.filter((row) => row.kokoluokka === orgClass);
    const latestComputedAt =
      classRows[0]?.computedAt ?? rows[0]?.computedAt ?? null;
    const isStale = this.isStale(latestComputedAt);

    return {
      vuosi,
      computedAt: latestComputedAt,
      isStale,
      staleAfterDays: BENCHMARK_STALE_DAYS,
      orgCount: classRows.reduce((max, row) => Math.max(max, row.orgCount), 0),
      kokoluokka: orgClass,
      metrics: classRows
        .map((row) => ({
          metricKey: row.metricKey,
          yourValue: orgMetrics?.[row.metricKey] ?? null,
          avgValue: Number(row.avgValue),
          medianValue: row.medianValue != null ? Number(row.medianValue) : null,
          p25Value: row.p25Value != null ? Number(row.p25Value) : null,
          p75Value: row.p75Value != null ? Number(row.p75Value) : null,
          minValue: row.minValue != null ? Number(row.minValue) : null,
          maxValue: row.maxValue != null ? Number(row.maxValue) : null,
          orgCount: row.orgCount,
        }))
        .sort((a, b) => a.metricKey.localeCompare(b.metricKey)),
    };
  }

  async getMetricTrend(orgId: string, metricKey: string) {
    const rows = await this.prisma.veetiBenchmark.findMany({
      where: { metricKey },
      orderBy: { vuosi: 'asc' },
    });
    if (rows.length === 0) {
      return {
        metricKey,
        computedAt: null,
        isStale: false,
        staleAfterDays: BENCHMARK_STALE_DAYS,
        orgCount: 0,
        trend: [],
      };
    }

    const trend = [] as Array<{
      vuosi: number;
      kokoluokka: string;
      yourValue: number | null;
      medianValue: number | null;
      p25Value: number | null;
      p75Value: number | null;
      orgCount: number;
      computedAt: Date;
    }>;

    const years = Array.from(new Set(rows.map((row) => row.vuosi))).sort(
      (a, b) => a - b,
    );
    for (const year of years) {
      const orgMetrics = await this.computeOrgMetrics(orgId, year);
      const kokoluokka = this.classify(orgMetrics?.vesi_volume ?? 0);
      const stat = rows.find(
        (row) => row.vuosi === year && row.kokoluokka === kokoluokka,
      );
      if (!stat) continue;
      trend.push({
        vuosi: year,
        kokoluokka,
        yourValue: orgMetrics?.[metricKey] ?? null,
        medianValue: stat.medianValue != null ? Number(stat.medianValue) : null,
        p25Value: stat.p25Value != null ? Number(stat.p25Value) : null,
        p75Value: stat.p75Value != null ? Number(stat.p75Value) : null,
        orgCount: stat.orgCount,
        computedAt: stat.computedAt,
      });
    }

    const latestComputedAt = trend.at(-1)?.computedAt ?? null;
    const isStale = this.isStale(latestComputedAt);

    return {
      metricKey,
      computedAt: latestComputedAt,
      isStale,
      staleAfterDays: BENCHMARK_STALE_DAYS,
      orgCount: trend.at(-1)?.orgCount ?? 0,
      trend,
    };
  }

  async getPeerGroup(orgId: string) {
    const link = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
    });
    if (!link)
      throw new BadRequestException('Organization is not linked to VEETI.');

    const latestYear = await this.getLatestSnapshotYear(orgId);
    if (!latestYear) {
      return {
        kokoluokka: 'pieni',
        latestYear: null,
        peers: [],
        peerCount: 0,
        orgCount: 0,
        computedAt: null,
        isStale: false,
        staleAfterDays: BENCHMARK_STALE_DAYS,
      };
    }

    await this.ensureYearComputed(latestYear, { requirePeerSamples: true });

    const orgMetrics = await this.computeOrgMetrics(orgId, latestYear);
    const kokoluokka = this.classify(orgMetrics?.vesi_volume ?? 0);
    const peerRows = (this.peerSamplesByYear.get(latestYear) ?? [])
      .filter(
        (peer) =>
          peer.kokoluokka === kokoluokka && peer.veetiId !== link.veetiId,
      )
      .slice(0, 25)
      .map((peer) => ({
        veetiId: peer.veetiId,
        nimi: peer.nimi ?? null,
        ytunnus: peer.ytunnus ?? null,
        kunta: peer.kunta ?? null,
      }));

    const benchmarkSample = await this.prisma.veetiBenchmark.findFirst({
      where: { vuosi: latestYear, kokoluokka },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true, orgCount: true },
    });
    const computedAt = benchmarkSample?.computedAt ?? null;

    return {
      kokoluokka,
      latestYear,
      peers: peerRows,
      peerCount: Math.max((benchmarkSample?.orgCount ?? 0) - 1, 0),
      orgCount: benchmarkSample?.orgCount ?? 0,
      computedAt,
      isStale: this.isStale(computedAt),
      staleAfterDays: BENCHMARK_STALE_DAYS,
    };
  }

  private async fetchMetricsWithRetry(
    veetiId: number,
    vuosi: number,
  ): Promise<{ veetiId: number; metrics: Record<string, number> } | null> {
    for (let attempt = 1; attempt <= BENCHMARK_MAX_RETRIES; attempt += 1) {
      try {
        const metrics = await this.fetchMetricsForVeetiOrg(veetiId, vuosi);
        if (!metrics) return null;
        return { veetiId, metrics };
      } catch (error) {
        if (attempt >= BENCHMARK_MAX_RETRIES) {
          this.logger.warn(
            `Benchmark fetch failed for VEETI org ${veetiId}, year ${vuosi} after ${attempt} attempts: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return null;
        }
        const backoffMs = 500 * 2 ** (attempt - 1);
        await this.sleep(backoffMs);
      }
    }
    return null;
  }

  private async fetchMetricsForVeetiOrg(
    veetiId: number,
    vuosi: number,
  ): Promise<Record<string, number> | null> {
    const [tilinpaatos, taksa, water, wastewater] = await Promise.all([
      this.veetiService.fetchEntityByYear(veetiId, 'tilinpaatos', vuosi),
      this.veetiService.fetchEntityByYear(veetiId, 'taksa', vuosi),
      this.veetiService.fetchEntityByYear(veetiId, 'volume_vesi', vuosi),
      this.veetiService.fetchEntityByYear(veetiId, 'volume_jatevesi', vuosi),
    ]);
    const [investointi, verkko] = await Promise.all([
      this.fetchOptionalEntityByYear(veetiId, 'investointi', vuosi),
      this.fetchOptionalEntityByYear(veetiId, 'verkko', vuosi),
    ]);

    if (
      tilinpaatos.length === 0 &&
      taksa.length === 0 &&
      water.length === 0 &&
      wastewater.length === 0
    ) {
      return null;
    }

    return this.computeMetricsFromRows(
      tilinpaatos,
      taksa,
      water,
      wastewater,
      investointi,
      verkko,
    );
  }

  private async fetchOptionalEntityByYear(
    veetiId: number,
    dataType: 'investointi' | 'verkko',
    vuosi: number,
  ): Promise<Record<string, unknown>[]> {
    try {
      return await this.veetiService.fetchEntityByYear(
        veetiId,
        dataType,
        vuosi,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `Optional VEETI entity ${dataType} missing for org ${veetiId}, year ${vuosi}: ${message}`,
      );
      return [];
    }
  }

  private classify(volume: number): 'pieni' | 'keski' | 'suuri' {
    if (volume < 200_000) return 'pieni';
    if (volume <= 1_000_000) return 'keski';
    return 'suuri';
  }

  private percentile(sorted: number[], ratio: number): number {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0]!;
    const idx = (sorted.length - 1) * ratio;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo]!;
    const w = idx - lo;
    return sorted[lo]! * (1 - w) + sorted[hi]! * w;
  }

  private async computeOrgMetrics(
    orgId: string,
    vuosi: number,
  ): Promise<Record<string, number> | null> {
    const [tilinpaatos, taksa, water, wastewater, investointi, verkko] =
      await Promise.all([
        this.getRows(orgId, vuosi, 'tilinpaatos'),
        this.getRows(orgId, vuosi, 'taksa'),
        this.getRows(orgId, vuosi, 'volume_vesi'),
        this.getRows(orgId, vuosi, 'volume_jatevesi'),
        this.getRows(orgId, vuosi, 'investointi'),
        this.getRows(orgId, vuosi, 'verkko'),
      ]);

    if (
      tilinpaatos.length === 0 &&
      taksa.length === 0 &&
      water.length === 0 &&
      wastewater.length === 0
    ) {
      return null;
    }

    return this.computeMetricsFromRows(
      tilinpaatos,
      taksa,
      water,
      wastewater,
      investointi,
      verkko,
    );
  }

  private computeMetricsFromRows(
    tilinpaatos: Record<string, unknown>[],
    taksa: Record<string, unknown>[],
    water: Record<string, unknown>[],
    wastewater: Record<string, unknown>[],
    investointi: Record<string, unknown>[],
    verkko: Record<string, unknown>[],
  ): Record<string, number> {
    const row = (tilinpaatos[0] ?? {}) as Record<string, unknown>;
    const waterPrice =
      taksa
        .filter((entry) => this.veetiService.toNumber(entry['Tyyppi_Id']) === 1)
        .map((entry) => this.veetiService.toNumber(entry['Kayttomaksu']) ?? 0)
        .filter((value) => value > 0)
        .pop() ?? 0;
    const wastewaterPrice =
      taksa
        .filter((entry) => this.veetiService.toNumber(entry['Tyyppi_Id']) === 2)
        .map((entry) => this.veetiService.toNumber(entry['Kayttomaksu']) ?? 0)
        .filter((value) => value > 0)
        .pop() ?? 0;

    const waterVolume = water.reduce<number>(
      (sum, entry) => sum + (this.veetiService.toNumber(entry['Maara']) ?? 0),
      0,
    );
    const wastewaterVolume = wastewater.reduce<number>(
      (sum, entry) => sum + (this.veetiService.toNumber(entry['Maara']) ?? 0),
      0,
    );

    const investments = investointi.reduce<number>((sum, entry) => {
      return (
        sum +
        (this.veetiService.toNumber(entry['InvestoinninMaara']) ?? 0) +
        (this.veetiService.toNumber(entry['KorvausInvestoinninMaara']) ?? 0)
      );
    }, 0);

    const networkKm = verkko.reduce<number>(
      (sum, entry) =>
        sum + (this.veetiService.toNumber(entry['VerkostonPituus']) ?? 0),
      0,
    );

    const liikevaihto = this.veetiService.toNumber(row['Liikevaihto']) ?? 0;

    return {
      vesi_yksikkohinta: waterPrice,
      jatevesi_yksikkohinta: wastewaterPrice,
      vesi_volume: waterVolume,
      jatevesi_volume: wastewaterVolume,
      liikevaihto,
      henkilostokulut: this.veetiService.toNumber(row['Henkilostokulut']) ?? 0,
      poistot: this.veetiService.toNumber(row['Poistot']) ?? 0,
      tulos: this.veetiService.toNumber(row['TilikaudenYliJaama']) ?? 0,
      investoinnit: investments,
      verkko_pituus: networkKm,
      liikevaihto_per_m3: waterVolume > 0 ? liikevaihto / waterVolume : 0,
      investointi_per_km: networkKm > 0 ? investments / networkKm : 0,
    };
  }

  private async getRows(
    orgId: string,
    vuosi: number,
    dataType: string,
  ): Promise<Record<string, unknown>[]> {
    const effective = await this.veetiEffectiveDataService.getEffectiveRows(
      orgId,
      vuosi,
      dataType as any,
    );
    return effective.rows;
  }

  private async getLatestSnapshotYear(orgId: string): Promise<number | null> {
    const years = await this.veetiEffectiveDataService.getAvailableYears(orgId);
    return years.length > 0 ? years[years.length - 1]!.vuosi : null;
  }

  private isStale(computedAt: Date | null): boolean {
    if (!computedAt) return false;
    return (
      Date.now() - computedAt.getTime() >
      BENCHMARK_STALE_DAYS * 24 * 60 * 60 * 1000
    );
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async ensureYearComputed(
    vuosi: number,
    options: { requirePeerSamples?: boolean } = {},
  ): Promise<void> {
    const benchmarkCount = await this.prisma.veetiBenchmark.count({
      where: { vuosi },
    });
    const hasPeerSamples = this.peerSamplesByYear.has(vuosi);
    const shouldRecompute =
      benchmarkCount === 0 ||
      (options.requirePeerSamples === true && !hasPeerSamples);
    if (!shouldRecompute) return;
    await this.recomputeYear(vuosi);
  }
}
