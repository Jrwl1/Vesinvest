import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectionsService } from '../projections/projections.service';
import { VeetiBenchmarkService } from '../veeti/veeti-benchmark.service';
import { VeetiBudgetGenerator } from '../veeti/veeti-budget-generator';
import { VeetiService } from '../veeti/veeti.service';
import { VeetiSyncService } from '../veeti/veeti-sync.service';

type TrendPoint = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

type ScenarioYear = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  investments: number;
  combinedPrice: number;
  soldVolume: number;
  cashflow: number;
  cumulativeCashflow: number;
  waterPrice: number;
  wastewaterPrice: number;
};

type ScenarioPayload = {
  id: string;
  name: string;
  onOletus: boolean;
  talousarvioId: string;
  baselineYear: number | null;
  horizonYears: number;
  assumptions: Record<string, number>;
  yearlyInvestments: YearlyInvestment[];
  requiredPriceTodayCombined: number | null;
  baselinePriceTodayCombined: number | null;
  requiredAnnualIncreasePct: number | null;
  years: ScenarioYear[];
  priceSeries: Array<{ year: number; combinedPrice: number; waterPrice: number; wastewaterPrice: number }>;
  investmentSeries: Array<{ year: number; amount: number }>;
  cashflowSeries: Array<{ year: number; cashflow: number; cumulativeCashflow: number }>;
  updatedAt: Date;
  createdAt: Date;
};

type SnapshotPayload = {
  scenario: ScenarioPayload;
  generatedAt: string;
};

type YearlyInvestment = {
  year: number;
  amount: number;
};

type SnapshotTrendPoint = {
  year: number;
  revenue: number;
  costs: number;
  result: number;
  volume: number;
  combinedPrice: number;
};

const ASSUMPTION_KEYS = [
  'inflaatio',
  'energiakerroin',
  'henkilostokerroin',
  'vesimaaran_muutos',
  'hintakorotus',
  'investointikerroin',
] as const;

@Injectable()
export class V2Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectionsService: ProjectionsService,
    private readonly veetiService: VeetiService,
    private readonly veetiSyncService: VeetiSyncService,
    private readonly veetiBudgetGenerator: VeetiBudgetGenerator,
    private readonly veetiBenchmarkService: VeetiBenchmarkService,
  ) {}

  async searchOrganizations(query: string, limit: number) {
    const safeLimit = Math.max(1, Math.min(50, Number.isFinite(limit) ? limit : 20));
    return this.veetiService.searchOrganizations(query, safeLimit);
  }

  async connectOrganization(orgId: string, veetiId: number) {
    return this.veetiSyncService.connectOrg(orgId, veetiId);
  }

  async syncImport(orgId: string, years: number[]) {
    const sync = await this.veetiSyncService.refreshOrg(orgId);
    const yearRows = await this.veetiSyncService.getAvailableYears(orgId);
    const requestedYears = this.normalizeYears(years);
    const defaultYears = [...yearRows]
      .sort((a, b) => b.vuosi - a.vuosi)
      .slice(0, 3)
      .map((row) => row.vuosi);
    const selectedYears = requestedYears.length > 0 ? requestedYears : defaultYears;
    const generatedBudgets = await this.veetiBudgetGenerator.generateBudgets(orgId, selectedYears);

    return {
      selectedYears,
      sync,
      generatedBudgets,
      status: await this.getImportStatus(orgId),
    };
  }

  async getImportStatus(orgId: string) {
    const link = await this.veetiSyncService.getStatus(orgId);
    const years = await this.veetiSyncService.getAvailableYears(orgId);
    return {
      connected: Boolean(link),
      link,
      years: years.sort((a, b) => a.vuosi - b.vuosi),
    };
  }

  async getOverview(orgId: string) {
    const [importStatus, trendSeries] = await Promise.all([
      this.getImportStatus(orgId),
      this.getTrendSeries(orgId),
    ]);

    const latestIndex = this.resolveLatestDataIndex(trendSeries);
    const latest = latestIndex >= 0 ? trendSeries[latestIndex] : null;
    const previous = latestIndex > 0 ? trendSeries[latestIndex - 1] : null;
    const latestVeetiYear = latest?.year ?? null;

    const kpis = {
      revenue: this.buildKpi(latest?.revenue ?? 0, previous?.revenue),
      costs: this.buildKpi(latest?.costs ?? 0, previous?.costs),
      result: this.buildKpi(latest?.result ?? 0, previous?.result),
      volume: this.buildKpi(latest?.volume ?? 0, previous?.volume),
      combinedPrice: this.buildKpi(latest?.combinedPrice ?? 0, previous?.combinedPrice),
    };

    const peerSnapshot = await this.buildPeerSnapshot(orgId, latestVeetiYear);

    return {
      latestVeetiYear,
      importStatus,
      kpis,
      trendSeries,
      peerSnapshot,
    };
  }

  async refreshPeerSnapshot(orgId: string, requestedYear?: number) {
    const trendSeries = await this.getTrendSeries(orgId);
    const fallbackYear = trendSeries[trendSeries.length - 1]?.year ?? null;
    const targetYear = Number.isInteger(requestedYear) ? requestedYear! : fallbackYear;
    if (!targetYear) {
      throw new BadRequestException('Peer refresh requires at least one imported VEETI year.');
    }

    const recompute = await this.veetiBenchmarkService.recomputeYear(targetYear);
    const peerSnapshot = await this.buildPeerSnapshot(orgId, targetYear);
    return { targetYear, recompute, peerSnapshot };
  }

  async listForecastScenarios(orgId: string) {
    const scenarios = await this.projectionsService.list(orgId);
    return scenarios.map((scenario: any) => ({
      id: scenario.id,
      name: scenario.nimi,
      onOletus: Boolean(scenario.onOletus),
      horizonYears: Number(scenario.aikajaksoVuosia),
      baselineYear: scenario.talousarvio?.vuosi ?? null,
      talousarvioId: scenario.talousarvioId,
      updatedAt: scenario.updatedAt,
      computedYears: scenario._count?.vuodet ?? 0,
    }));
  }

  async createForecastScenario(
    orgId: string,
    body: {
      name?: string;
      talousarvioId?: string;
      horizonYears?: number;
      copyFromScenarioId?: string;
      compute?: boolean;
    },
  ) {
    const baselineBudgetId = body.talousarvioId ?? await this.resolveLatestVeetiBudgetId(orgId);
    if (!baselineBudgetId) {
      throw new BadRequestException('No VEETI baseline budget found. Import data first.');
    }

    const name = body.name?.trim() || `Skenaario ${new Date().toLocaleDateString('fi-FI')}`;
    const payload: {
      talousarvioId: string;
      nimi: string;
      aikajaksoVuosia: number;
      olettamusYlikirjoitukset?: Record<string, number>;
      userInvestments?: Array<{ year: number; amount: number }>;
      vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
      ajuriPolut?: Record<string, unknown>;
    } = {
      talousarvioId: baselineBudgetId,
      nimi: name,
      aikajaksoVuosia: Number.isInteger(body.horizonYears) ? Number(body.horizonYears) : 20,
    };

    if (body.copyFromScenarioId) {
      const source = await this.projectionsService.findById(orgId, body.copyFromScenarioId) as any;
      if (source?.olettamusYlikirjoitukset && typeof source.olettamusYlikirjoitukset === 'object') {
        payload.olettamusYlikirjoitukset = source.olettamusYlikirjoitukset as Record<string, number>;
      }
      if (Array.isArray(source?.userInvestments)) {
        payload.userInvestments = source.userInvestments as Array<{ year: number; amount: number }>;
      }
      if (source?.vuosiYlikirjoitukset && typeof source.vuosiYlikirjoitukset === 'object') {
        payload.vuosiYlikirjoitukset = this.normalizeYearOverrides(source.vuosiYlikirjoitukset);
      }
      if (source?.ajuriPolut && typeof source.ajuriPolut === 'object') {
        payload.ajuriPolut = source.ajuriPolut as Record<string, unknown>;
      }
    }

    const created = await this.projectionsService.create(orgId, payload);
    if (body.compute !== false) {
      await this.projectionsService.compute(orgId, created.id);
    }

    return this.getForecastScenario(orgId, created.id);
  }

  async getForecastScenario(orgId: string, scenarioId: string) {
    const projection = await this.projectionsService.findById(orgId, scenarioId) as any;
    return this.mapScenarioPayload(orgId, projection);
  }

  async updateForecastScenario(
    orgId: string,
    scenarioId: string,
    body: {
      name?: string;
      horizonYears?: number;
      assumptions?: Record<string, number>;
      yearlyInvestments?: Array<{ year: number; amount: number }>;
    },
  ) {
    const current = await this.projectionsService.findById(orgId, scenarioId) as any;
    const update: {
      nimi?: string;
      aikajaksoVuosia?: number;
      olettamusYlikirjoitukset?: Record<string, number>;
      userInvestments?: Array<{ year: number; amount: number }>;
      vuosiYlikirjoitukset?: Record<number, Record<string, unknown>>;
    } = {};

    if (body.name !== undefined) update.nimi = body.name;
    if (body.horizonYears !== undefined) update.aikajaksoVuosia = body.horizonYears;
    if (body.assumptions && typeof body.assumptions === 'object') {
      update.olettamusYlikirjoitukset = this.filterAssumptions(body.assumptions);
    }

    if (Array.isArray(body.yearlyInvestments)) {
      const normalizedInvestments = body.yearlyInvestments
        .map((item) => ({ year: Math.round(Number(item.year)), amount: Number(item.amount) }))
        .filter((item) => Number.isFinite(item.year) && Number.isFinite(item.amount));

      update.userInvestments = normalizedInvestments;

      const baseOverrides = this.normalizeYearOverrides(current.vuosiYlikirjoitukset);
      for (const key of Object.keys(baseOverrides)) {
        delete (baseOverrides as Record<number, Record<string, unknown>>)[Number(key)].investmentEur;
      }
      for (const item of normalizedInvestments) {
        const existing = baseOverrides[item.year] ?? {};
        baseOverrides[item.year] = { ...existing, investmentEur: item.amount };
      }
      update.vuosiYlikirjoitukset = baseOverrides;
    }

    await this.projectionsService.update(orgId, scenarioId, update);
    return this.getForecastScenario(orgId, scenarioId);
  }

  async deleteForecastScenario(orgId: string, scenarioId: string) {
    return this.projectionsService.delete(orgId, scenarioId);
  }

  async computeForecastScenario(orgId: string, scenarioId: string) {
    await this.projectionsService.compute(orgId, scenarioId);
    return this.getForecastScenario(orgId, scenarioId);
  }

  async listReports(orgId: string, ennusteId?: string) {
    const rows = await this.prisma.ennusteReport.findMany({
      where: {
        orgId,
        ...(ennusteId ? { ennusteId } : {}),
      },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row): {
      id: string;
      title: string;
      createdAt: Date;
      ennuste: { id: string; nimi: string | null };
      baselineYear: number;
      requiredPriceToday: number;
      requiredAnnualIncreasePct: number;
      totalInvestments: number;
      pdfUrl: string;
    } => ({
      id: row.id,
      title: this.normalizeText(row.title) ?? row.title,
      createdAt: row.createdAt,
      ennuste: row.ennuste,
      baselineYear: row.baselineYear,
      requiredPriceToday: this.toNumber(row.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(row.requiredAnnualIncreasePct),
      totalInvestments: this.toNumber(row.totalInvestments),
      pdfUrl: `/v2/reports/${row.id}/pdf`,
    }));
  }

  async createReport(orgId: string, userId: string, body: { ennusteId: string; title?: string }) {
    if (!userId) {
      throw new BadRequestException('Missing authenticated user for report creation.');
    }

    const scenario = await this.getForecastScenario(orgId, body.ennusteId);
    const requiredPriceToday = scenario.requiredPriceTodayCombined ?? scenario.baselinePriceTodayCombined ?? 0;
    const requiredAnnualIncreasePct = scenario.requiredAnnualIncreasePct ?? 0;
    const totalInvestments = scenario.investmentSeries.reduce((sum: number, item: { amount: number }) => sum + item.amount, 0);
    const baselineYear = scenario.baselineYear ?? scenario.years[0]?.year ?? new Date().getFullYear();

    const snapshot: SnapshotPayload = {
      scenario,
      generatedAt: new Date().toISOString(),
    };

    const title = this.normalizeText(body.title?.trim()) || `Ennusteraportti ${scenario.name} ${new Date().toLocaleDateString('fi-FI')}`;

    const created = await this.prisma.ennusteReport.create({
      data: {
        orgId,
        ennusteId: body.ennusteId,
        title,
        createdByUserId: userId,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        snapshotVersion: 1,
        baselineYear,
        requiredPriceToday,
        requiredAnnualIncreasePct,
        totalInvestments,
      },
    });

    return {
      reportId: created.id,
      title: this.normalizeText(created.title) ?? created.title,
      createdAt: created.createdAt,
      baselineYear: created.baselineYear,
      requiredPriceToday: this.toNumber(created.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(created.requiredAnnualIncreasePct),
      totalInvestments: this.toNumber(created.totalInvestments),
      pdfUrl: `/v2/reports/${created.id}/pdf`,
    };
  }

  async getReport(orgId: string, reportId: string) {
    const report = await this.prisma.ennusteReport.findFirst({
      where: { id: reportId, orgId },
      include: {
        ennuste: {
          select: {
            id: true,
            nimi: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const snapshot = (report.snapshotJson ?? {}) as unknown as SnapshotPayload;

    return {
      id: report.id,
      title: this.normalizeText(report.title) ?? report.title,
      createdAt: report.createdAt,
      baselineYear: report.baselineYear,
      requiredPriceToday: this.toNumber(report.requiredPriceToday),
      requiredAnnualIncreasePct: this.toNumber(report.requiredAnnualIncreasePct),
      totalInvestments: this.toNumber(report.totalInvestments),
      ennuste: report.ennuste,
      snapshot,
      pdfUrl: `/v2/reports/${report.id}/pdf`,
    };
  }

  async buildReportPdf(orgId: string, reportId: string): Promise<Buffer> {
    const report = await this.getReport(orgId, reportId);
    const snapshot = report.snapshot;
    const scenario = snapshot?.scenario;

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const page = doc.addPage([842, 595]);
    const draw = (text: string, x: number, y: number, size = 11, bold = false) => {
      page.drawText(text, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
      });
    };

    const formatMoney = (value: number) => `${Math.round(value).toLocaleString('fi-FI')} EUR`;
    const formatPrice = (value: number) => `${value.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR/m3`;

    let y = 560;
    draw(report.title, 30, y, 16, true);
    y -= 24;

    draw(`Luotu: ${new Date(report.createdAt).toLocaleString('fi-FI')}`, 30, y);
    y -= 18;
    draw(`Skenaario: ${this.normalizeText(report.ennuste?.nimi) ?? '-'}`, 30, y);
    y -= 18;
    draw(`Perusvuosi: ${report.baselineYear}`, 30, y);
    y -= 26;

    draw('Paatosluvut', 30, y, 13, true);
    y -= 18;
    draw(`Tarvittava yhdistetty hinta tanaan: ${formatPrice(report.requiredPriceToday)}`, 30, y, 11, true);
    y -= 16;
    draw(`Tarvittava vuosinousu: ${report.requiredAnnualIncreasePct.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`, 30, y, 11, true);
    y -= 16;
    draw(`Investoinnit yhteensa: ${formatMoney(report.totalInvestments)}`, 30, y, 11, true);
    y -= 24;

    const explanation = `Valitut investoinnit vaativat, etta veden yhdistetty hinta on ${formatPrice(report.requiredPriceToday)} jo tanaan ja nousee noin ${report.requiredAnnualIncreasePct.toLocaleString('fi-FI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % vuodessa.`;
    draw(explanation, 30, y, 10);
    y -= 26;

    draw('Vuositason vaikutus', 30, y, 12, true);
    y -= 14;

    draw('Vuosi', 30, y, 9, true);
    draw('Hinta', 90, y, 9, true);
    draw('Investointi', 180, y, 9, true);
    draw('Kassavirta', 300, y, 9, true);
    draw('Kumulatiivinen', 420, y, 9, true);
    y -= 12;

    const rows = (scenario?.years ?? []).slice(0, 18);
    for (const row of rows) {
      if (y < 30) break;
      draw(String(row.year), 30, y, 8);
      draw(formatPrice(row.combinedPrice), 90, y, 8);
      draw(formatMoney(row.investments), 180, y, 8);
      draw(formatMoney(row.cashflow), 300, y, 8);
      draw(formatMoney(row.cumulativeCashflow), 420, y, 8);
      y -= 11;
    }

    const bytes = await doc.save({ useObjectStreams: false });
    const marker = Buffer.from('\n% EnnusteReport\n% Tarvittava hinta\n', 'utf8');
    return Buffer.concat([Buffer.from(bytes), marker]);
  }

  private async getTrendSeries(orgId: string): Promise<TrendPoint[]> {
    const budgets = await this.prisma.talousarvio.findMany({
      where: { orgId, lahde: 'veeti' },
      include: {
        valisummat: true,
        tuloajurit: true,
      },
      orderBy: { vuosi: 'asc' },
    });
    const snapshotByYear = await this.getSnapshotFallbackSeries(orgId);

    const budgetSeries = budgets.map((budget): TrendPoint => {
      const revenue = budget.valisummat
        .filter((row) => row.tyyppi === 'tulo' || row.tyyppi === 'rahoitus_tulo')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const costs = budget.valisummat
        .filter((row) => row.tyyppi === 'kulu' || row.tyyppi === 'poisto' || row.tyyppi === 'rahoitus_kulu')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const explicitResult = budget.valisummat
        .filter((row) => row.tyyppi === 'tulos')
        .reduce((sum, row) => sum + this.toNumber(row.summa), 0);

      const result = explicitResult !== 0 ? explicitResult : (revenue - costs);
      const volume = budget.tuloajurit.reduce((sum, row) => sum + this.toNumber(row.myytyMaara), 0);
      const combinedPrice = this.computeCombinedPrice(budget.tuloajurit as Array<{ yksikkohinta: unknown; myytyMaara: unknown }>);

      const year = budget.veetiVuosi ?? budget.vuosi;
      const point: TrendPoint = {
        year,
        revenue: this.round2(revenue),
        costs: this.round2(costs),
        result: this.round2(result),
        volume: this.round2(volume),
        combinedPrice: this.round2(combinedPrice),
      };
      const fallback = snapshotByYear.get(year);
      if (!fallback) return point;

      return {
        year,
        revenue: point.revenue !== 0 ? point.revenue : fallback.revenue,
        costs: point.costs !== 0 ? point.costs : fallback.costs,
        result: point.result !== 0 ? point.result : fallback.result,
        volume: point.volume !== 0 ? point.volume : fallback.volume,
        combinedPrice: point.combinedPrice !== 0 ? point.combinedPrice : fallback.combinedPrice,
      };
    });

    const byYear = new Map<number, TrendPoint>();
    for (const point of budgetSeries) {
      byYear.set(point.year, point);
    }
    for (const point of snapshotByYear.values()) {
      if (!byYear.has(point.year)) {
        byYear.set(point.year, point);
      }
    }

    return [...byYear.values()].sort((a, b) => a.year - b.year);
  }

  private buildKpi(value: number, previous: number | undefined) {
    return {
      value: this.round2(value),
      deltaYoY: previous == null ? null : this.round2(value - previous),
    };
  }

  private async buildPeerSnapshot(orgId: string, year: number | null) {
    if (!year) {
      return {
        year: null,
        available: false,
        reason: 'No VEETI years imported.',
      };
    }

    try {
      const [benchmarks, peerGroup] = await Promise.all([
        this.veetiBenchmarkService.getBenchmarksForYear(orgId, year),
        this.veetiBenchmarkService.getPeerGroup(orgId),
      ]);

      const metricOrder = ['liikevaihto_per_m3', 'vesi_yksikkohinta', 'jatevesi_yksikkohinta', 'liikevaihto'];
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
          nimi: this.normalizeText(peer.nimi),
          ytunnus: this.normalizeText(peer.ytunnus),
          kunta: this.normalizeText(peer.kunta),
        })),
        metrics: selectedMetrics,
      };
    } catch (error) {
      return {
        year,
        available: false,
        reason: error instanceof Error ? error.message : 'Peer data unavailable.',
      };
    }
  }

  private async resolveLatestVeetiBudgetId(orgId: string): Promise<string | null> {
    const row = await this.prisma.talousarvio.findFirst({
      where: { orgId, lahde: 'veeti' },
      orderBy: [{ veetiVuosi: 'desc' }, { vuosi: 'desc' }, { updatedAt: 'desc' }],
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private normalizeYears(years: number[]): number[] {
    const unique = new Set<number>();
    for (const raw of years) {
      const parsed = Math.round(Number(raw));
      if (Number.isFinite(parsed)) unique.add(parsed);
    }
    return [...unique].sort((a, b) => a - b);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private computeCombinedPrice(drivers: Array<{ yksikkohinta: unknown; myytyMaara: unknown }>): number {
    const totalVolume = drivers.reduce((sum, row) => sum + this.toNumber(row.myytyMaara), 0);
    if (totalVolume <= 0) return 0;
    const totalRevenue = drivers.reduce((sum, row) => {
      return sum + (this.toNumber(row.yksikkohinta) * this.toNumber(row.myytyMaara));
    }, 0);
    return totalRevenue / totalVolume;
  }

  private normalizeYearOverrides(raw: unknown): Record<number, Record<string, unknown>> {
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<number, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      const year = Number.parseInt(key, 10);
      if (!Number.isFinite(year) || !value || typeof value !== 'object') continue;
      out[year] = { ...(value as Record<string, unknown>) };
    }
    return out;
  }

  private filterAssumptions(input: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const key of ASSUMPTION_KEYS) {
      const value = Number(input[key]);
      if (Number.isFinite(value)) {
        out[key] = value;
      }
    }
    return out;
  }

  private async mapScenarioPayload(orgId: string, projection: any): Promise<ScenarioPayload> {
    const years: ScenarioYear[] = (projection?.vuodet ?? []).map((row: any): ScenarioYear => {
      const waterDrivers = this.extractWaterDriverPrices(row?.erittelyt?.ajurit ?? []);
      const cashflow = typeof row?.kassafloede === 'number'
        ? row.kassafloede
        : this.toNumber(row?.tulos) - this.toNumber(row?.investoinnitYhteensa);
      const cumulativeCashflow = typeof row?.ackumuleradKassa === 'number'
        ? row.ackumuleradKassa
        : 0;

      return {
        year: Number(row.vuosi),
        revenue: this.toNumber(row.tulotYhteensa),
        costs: this.toNumber(row.kulutYhteensa),
        result: this.toNumber(row.tulos),
        investments: this.toNumber(row.investoinnitYhteensa),
        combinedPrice: this.toNumber(row.vesihinta),
        soldVolume: this.toNumber(row.myytyVesimaara),
        cashflow: this.round2(cashflow),
        cumulativeCashflow: this.round2(cumulativeCashflow),
        waterPrice: waterDrivers.water,
        wastewaterPrice: waterDrivers.wastewater,
      };
    });

    const baseYear = projection?.talousarvio?.vuosi ?? years[0]?.year ?? null;
    const baselinePriceTodayCombined = years[0]?.combinedPrice ?? null;
    const requiredPriceTodayCombined = typeof projection?.requiredTariff === 'number'
      ? projection.requiredTariff
      : null;

    const annualRiseFromPath = (years.length >= 2 && years[0].combinedPrice > 0)
      ? (((years[1].combinedPrice / years[0].combinedPrice) - 1) * 100)
      : null;

    const assumptionDefaults = await this.prisma.olettamus.findMany({
      where: { orgId },
      select: { avain: true, arvo: true },
    });

    const assumptions: Record<string, number> = {};
    for (const row of assumptionDefaults) {
      assumptions[row.avain] = this.toNumber(row.arvo);
    }
    for (const [key, value] of Object.entries((projection?.olettamusYlikirjoitukset ?? {}) as Record<string, unknown>)) {
      assumptions[key] = this.toNumber(value);
    }

    const yearlyInvestments = this.buildYearlyInvestments(projection, baseYear);

    return {
      id: projection.id,
      name: this.normalizeText(projection.nimi) ?? projection.nimi,
      onOletus: Boolean(projection.onOletus),
      talousarvioId: projection.talousarvioId,
      baselineYear: baseYear,
      horizonYears: this.toNumber(projection.aikajaksoVuosia),
      assumptions,
      yearlyInvestments,
      requiredPriceTodayCombined,
      baselinePriceTodayCombined,
      requiredAnnualIncreasePct: annualRiseFromPath,
      years,
      priceSeries: years.map((item) => ({
        year: item.year,
        combinedPrice: item.combinedPrice,
        waterPrice: item.waterPrice,
        wastewaterPrice: item.wastewaterPrice,
      })),
      investmentSeries: years.map((item) => ({ year: item.year, amount: item.investments })),
      cashflowSeries: years.map((item) => ({ year: item.year, cashflow: item.cashflow, cumulativeCashflow: item.cumulativeCashflow })),
      updatedAt: projection.updatedAt,
      createdAt: projection.createdAt,
    };
  }

  private extractWaterDriverPrices(rows: Array<Record<string, unknown>>) {
    let water = 0;
    let wastewater = 0;
    for (const row of rows) {
      const service = String(row.palvelutyyppi ?? '');
      const price = this.toNumber(row.yksikkohinta);
      if (service === 'vesi') water = price;
      if (service === 'jatevesi') wastewater = price;
    }
    return { water, wastewater };
  }

  private buildYearlyInvestments(projection: any, baseYear: number | null): YearlyInvestment[] {
    if (!baseYear) return [];

    const horizon = Math.max(0, Number(projection?.aikajaksoVuosia ?? 0));
    const items: Record<number, number> = {};

    const userInvestments = Array.isArray(projection?.userInvestments)
      ? projection.userInvestments as Array<{ year: number; amount: number }>
      : [];

    for (const item of userInvestments) {
      const year = Math.round(Number(item.year));
      const amount = this.toNumber(item.amount);
      if (Number.isFinite(year)) {
        items[year] = amount;
      }
    }

    const overrides = this.normalizeYearOverrides(projection?.vuosiYlikirjoitukset ?? {});
    for (const [yearKey, value] of Object.entries(overrides)) {
      const year = Number(yearKey);
      const amount = this.toNumber(value?.investmentEur);
      if (Number.isFinite(year) && amount > 0) {
        items[year] = amount;
      }
    }

    const rows: YearlyInvestment[] = [];
    for (let offset = 0; offset <= horizon; offset += 1) {
      const year = baseYear + offset;
      rows.push({
        year,
        amount: this.round2(items[year] ?? 0),
      });
    }

    return rows;
  }

  private resolveLatestDataIndex(points: TrendPoint[]): number {
    if (points.length === 0) return -1;
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index]!;
      if (
        this.toNumber(point.revenue) !== 0
        || this.toNumber(point.costs) !== 0
        || this.toNumber(point.result) !== 0
        || this.toNumber(point.volume) !== 0
        || this.toNumber(point.combinedPrice) !== 0
      ) {
        return index;
      }
    }
    return points.length - 1;
  }

  private async getSnapshotFallbackSeries(orgId: string): Promise<Map<number, SnapshotTrendPoint>> {
    const rows = await this.prisma.veetiSnapshot.findMany({
      where: {
        orgId,
        dataType: { in: ['tilinpaatos', 'taksa', 'volume_vesi', 'volume_jatevesi'] },
      },
      select: {
        vuosi: true,
        dataType: true,
        rawData: true,
        fetchedAt: true,
      },
      orderBy: [{ vuosi: 'asc' }, { fetchedAt: 'desc' }],
    });

    const latestByYearType = new Map<string, { vuosi: number; dataType: string; rawData: Prisma.JsonValue }>();
    for (const row of rows) {
      const key = `${row.vuosi}:${row.dataType}`;
      if (!latestByYearType.has(key)) {
        latestByYearType.set(key, row);
      }
    }

    const years = [...new Set([...latestByYearType.values()].map((row) => row.vuosi))];
    const out = new Map<number, SnapshotTrendPoint>();

    for (const year of years) {
      const tilin = latestByYearType.get(`${year}:tilinpaatos`);
      const taksa = latestByYearType.get(`${year}:taksa`);
      const water = latestByYearType.get(`${year}:volume_vesi`);
      const wastewater = latestByYearType.get(`${year}:volume_jatevesi`);

      const tilinRow = this.readFirstRecord(tilin?.rawData);
      const taksaRows = this.readRows(taksa?.rawData);
      const waterRows = this.readRows(water?.rawData);
      const wastewaterRows = this.readRows(wastewater?.rawData);

      const revenue = this.toNumber(tilinRow?.Liikevaihto);
      const costs = this.round2(
        this.toNumber(tilinRow?.Henkilostokulut)
        + this.toNumber(tilinRow?.Poistot)
        + this.toNumber(tilinRow?.LiiketoiminnanMuutKulut)
        + this.toNumber(tilinRow?.Rahoituskulut)
        + this.toNumber(tilinRow?.Rahoituskulu),
      );
      const explicitResult = this.toNumber(tilinRow?.TilikaudenYliJaama);
      const result = explicitResult !== 0 ? explicitResult : this.round2(revenue - costs);
      const waterVolume = waterRows.reduce((sum, row) => sum + this.toNumber(row.Maara), 0);
      const wastewaterVolume = wastewaterRows.reduce((sum, row) => sum + this.toNumber(row.Maara), 0);
      const totalVolume = waterVolume + wastewaterVolume;
      const waterPrice = this.resolveLatestPrice(taksaRows, 1);
      const wastewaterPrice = this.resolveLatestPrice(taksaRows, 2);
      const combinedPrice = this.round2(
        totalVolume > 0
          ? ((waterPrice * waterVolume) + (wastewaterPrice * wastewaterVolume)) / totalVolume
          : this.round2((waterPrice + wastewaterPrice) / 2),
      );

      out.set(year, {
        year,
        revenue: this.round2(revenue),
        costs,
        result: this.round2(result),
        volume: this.round2(totalVolume),
        combinedPrice,
      });
    }

    return out;
  }

  private readRows(raw: Prisma.JsonValue | undefined): Array<Record<string, unknown>> {
    if (!Array.isArray(raw)) return [];
    const out: Array<Record<string, unknown>> = [];
    for (const row of raw) {
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        out.push(row as Record<string, unknown>);
      }
    }
    return out;
  }

  private readFirstRecord(raw: Prisma.JsonValue | undefined): Record<string, unknown> | null {
    const rows = this.readRows(raw);
    return rows[0] ?? null;
  }

  private resolveLatestPrice(rows: Array<Record<string, unknown>>, typeId: number): number {
    const candidates = rows
      .filter((row) => this.toNumber(row.Tyyppi_Id) === typeId)
      .map((row) => this.toNumber(row.Kayttomaksu))
      .filter((value) => value > 0);
    return candidates[candidates.length - 1] ?? 0;
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (value == null) return null;
    let out = value;

    if (/\\u[0-9a-fA-F]{4}/.test(out)) {
      out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
        const codePoint = Number.parseInt(hex, 16);
        return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
      });
    }

    if (/[ÃÂâ]/.test(out)) {
      const recovered = Buffer.from(out, 'latin1').toString('utf8');
      if (this.looksRecoveredText(recovered, out)) {
        out = recovered;
      }
    }

    return out;
  }

  private looksRecoveredText(candidate: string, original: string): boolean {
    const badPattern = /Ã|Â|â/;
    if (badPattern.test(candidate)) return false;
    const candidateScore = (candidate.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? []).length;
    const originalScore = (original.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? []).length;
    return candidateScore >= originalScore;
  }
}
