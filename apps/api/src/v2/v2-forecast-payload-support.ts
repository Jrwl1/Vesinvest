import { PrismaService } from '../prisma/prisma.service';
import { V2ForecastDepreciationStorageSupport } from './v2-forecast-depreciation-storage-support';
import { V2ForecastInputModelSupport } from './v2-forecast-input-model-support';
import { V2ForecastScenarioMetaSupport } from './v2-forecast-scenario-meta-support';
import { V2ForecastSeriesSupport } from './v2-forecast-series-support';
import {
  SCENARIO_TYPE_OVERRIDE_KEY,
  type ScenarioPayload,
  type ScenarioYear,
  type TrendPoint,
} from './v2-forecast.types';

type ForecastYearRowLike = {
  vuosi?: unknown;
  tulotYhteensa?: unknown;
  kulutYhteensa?: unknown;
  tulos?: unknown;
  investoinnitYhteensa?: unknown;
  poistoPerusta?: unknown;
  poistoInvestoinneista?: unknown;
  vesihinta?: unknown;
  myytyVesimaara?: unknown;
  kassafloede?: unknown;
  ackumuleradKassa?: unknown;
  erittelyt?: unknown;
};

export type ForecastProjectionLike = {
  id?: string;
  nimi?: string;
  onOletus?: boolean;
  talousarvioId?: string;
  vuodet?: ForecastYearRowLike[];
  talousarvio?: { vuosi?: number | null } | null;
  requiredTariff?: number | null;
  olettamusYlikirjoitukset?: unknown;
  aikajaksoVuosia?: number;
  baselineYear?: number | null;
  userInvestments?: unknown;
  vuosiYlikirjoitukset?: unknown;
  computedAt?: Date | string | null;
  computedFromUpdatedAt?: Date | string | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
};

type MapScenarioPayloadCallbacks = {
  ensureScenarioDepreciationStorage?: (
    orgId: string,
    projection: ForecastProjectionLike,
  ) => Promise<unknown>;
  resolveLatestComparableBaselinePrice?: (
    orgId: string,
  ) => Promise<number | null>;
  buildYearlyInvestments?: (
    projection: ForecastProjectionLike,
    baseYear: number | null,
  ) => ReturnType<V2ForecastInputModelSupport['buildYearlyInvestments']>;
};

type ForecastImportStatusReader = {
  getImportStatus(orgId: string): Promise<{
    workspaceYears?: number[] | null;
    years?: Array<{
      vuosi: number;
      completeness?: Record<string, boolean>;
      sourceStatus?: string;
      isExcluded?: boolean;
    }>;
  }>;
};

export class V2ForecastPayloadSupport {
  constructor(
    private readonly prisma: PrismaService,
    private readonly importOverviewService: ForecastImportStatusReader,
    private readonly seriesSupport: V2ForecastSeriesSupport,
    private readonly inputModelSupport: V2ForecastInputModelSupport,
    private readonly scenarioMetaSupport: V2ForecastScenarioMetaSupport,
    private readonly depreciationStorageSupport: V2ForecastDepreciationStorageSupport,
  ) {}

  async mapScenarioPayload(
    orgId: string,
    projection: ForecastProjectionLike,
    callbacks?: MapScenarioPayloadCallbacks,
  ): Promise<ScenarioPayload> {
    const ensureScenarioDepreciationStorage =
      callbacks?.ensureScenarioDepreciationStorage ??
      ((nextOrgId: string, nextProjection: ForecastProjectionLike) =>
        this.depreciationStorageSupport.ensureScenarioDepreciationStorage(
          nextOrgId,
          nextProjection,
        ));
    const resolveLatestComparableBaselinePrice =
      callbacks?.resolveLatestComparableBaselinePrice ??
      ((nextOrgId: string) =>
        this.resolveLatestComparableBaselinePrice(nextOrgId));
    const buildYearlyInvestments =
      callbacks?.buildYearlyInvestments ??
      ((nextProjection: ForecastProjectionLike, baseYear: number | null) =>
        this.inputModelSupport.buildYearlyInvestments(nextProjection, baseYear));

    const scenarioDepreciationStorage =
      await ensureScenarioDepreciationStorage(orgId, projection);
    const years: ScenarioYear[] = (projection?.vuodet ?? []).map(
      (entry): ScenarioYear => {
        const row = (entry ?? {}) as ForecastYearRowLike;
        const erittelyt =
          row.erittelyt && typeof row.erittelyt === 'object'
            ? (row.erittelyt as { ajurit?: Array<Record<string, unknown>> })
            : null;
        const waterDrivers = this.extractWaterDriverPrices(
          Array.isArray(erittelyt?.ajurit) ? erittelyt.ajurit : [],
        );
        const cashflow =
          typeof row.kassafloede === 'number'
            ? row.kassafloede
            : this.inputModelSupport.toNumber(row.tulos) -
              this.inputModelSupport.toNumber(row.investoinnitYhteensa);
        const cumulativeCashflow =
          typeof row.ackumuleradKassa === 'number' ? row.ackumuleradKassa : 0;

        return {
          year: Number(row.vuosi),
          revenue: this.inputModelSupport.toNumber(row.tulotYhteensa),
          costs: this.inputModelSupport.toNumber(row.kulutYhteensa),
          result: this.inputModelSupport.toNumber(row.tulos),
          investments: this.inputModelSupport.toNumber(row.investoinnitYhteensa),
          baselineDepreciation: this.inputModelSupport.toNumber(row.poistoPerusta),
          investmentDepreciation:
            this.inputModelSupport.toNumber(row.poistoInvestoinneista),
          totalDepreciation: this.inputModelSupport.round2(
            this.inputModelSupport.toNumber(row.poistoPerusta) +
              this.inputModelSupport.toNumber(row.poistoInvestoinneista),
          ),
          combinedPrice: this.inputModelSupport.toNumber(row.vesihinta),
          soldVolume: this.inputModelSupport.toNumber(row.myytyVesimaara),
          cashflow: this.inputModelSupport.round2(cashflow),
          cumulativeCashflow: this.inputModelSupport.round2(cumulativeCashflow),
          waterPrice: waterDrivers.water,
          wastewaterPrice: waterDrivers.wastewater,
          baseFeeRevenue: waterDrivers.baseFeeRevenue,
          connectionCount: waterDrivers.connectionCount,
        };
      },
    );

    const baseYear = projection?.talousarvio?.vuosi ?? years[0]?.year ?? null;
    const latestComparablePriceTodayCombined =
      await resolveLatestComparableBaselinePrice(orgId);
    const baselinePriceTodayCombined =
      latestComparablePriceTodayCombined ?? years[0]?.combinedPrice ?? null;
    const requiredPriceTodayCombinedAnnualResult =
      this.computeRequiredPriceForZeroResult(years[0]);
    const requiredPriceTodayCombinedCumulativeCash =
      typeof projection?.requiredTariff === 'number'
        ? projection.requiredTariff
        : null;
    const requiredPriceTodayCombined =
      requiredPriceTodayCombinedAnnualResult ??
      requiredPriceTodayCombinedCumulativeCash;

    const annualRiseFromPath =
      years.length >= 2 && years[0].combinedPrice > 0
        ? (years[1].combinedPrice / years[0].combinedPrice - 1) * 100
        : null;

    const requiredRiseFromAnnualResult =
      baselinePriceTodayCombined != null &&
      baselinePriceTodayCombined > 0 &&
      requiredPriceTodayCombinedAnnualResult != null &&
      requiredPriceTodayCombinedAnnualResult >= 0
        ? (requiredPriceTodayCombinedAnnualResult / baselinePriceTodayCombined -
            1) *
          100
        : null;

    const requiredRiseFromCumulativeCash =
      baselinePriceTodayCombined != null &&
      baselinePriceTodayCombined > 0 &&
      requiredPriceTodayCombinedCumulativeCash != null &&
      requiredPriceTodayCombinedCumulativeCash >= 0
        ? (requiredPriceTodayCombinedCumulativeCash /
            baselinePriceTodayCombined -
            1) *
          100
        : null;

    const requiredAnnualIncreasePctAnnualResult = requiredRiseFromAnnualResult;
    const requiredAnnualIncreasePctCumulativeCash =
      requiredRiseFromCumulativeCash;

    const requiredAnnualIncreasePct =
      requiredRiseFromAnnualResult ??
      requiredRiseFromCumulativeCash ??
      annualRiseFromPath;
    const annualResultUnderfundingStartYear =
      years.find((item) => item.result < 0)?.year ?? null;
    const cumulativeCashUnderfundingStartYear =
      years.find((item) => item.cumulativeCashflow < 0)?.year ?? null;
    const peakAnnualDeficit = this.inputModelSupport.round2(
      Math.max(
        0,
        ...years.map((item) =>
          Math.max(0, -this.inputModelSupport.toNumber(item.result)),
        ),
      ),
    );
    const peakCumulativeGap = this.inputModelSupport.round2(
      Math.max(
        0,
        ...years.map((item) =>
          Math.max(0, -this.inputModelSupport.toNumber(item.cumulativeCashflow)),
        ),
      ),
    );

    const assumptionDefaults = this.prisma.olettamus?.findMany
      ? await this.prisma.olettamus.findMany({
          where: { orgId },
          select: { avain: true, arvo: true },
        })
      : [];

    const assumptions: Record<string, number> = {};
    for (const row of assumptionDefaults) {
      assumptions[row.avain] = this.inputModelSupport.toNumber(row.arvo);
    }
    for (const [key, value] of Object.entries(
      (projection?.olettamusYlikirjoitukset ?? {}) as Record<string, unknown>,
    )) {
      if (key === SCENARIO_TYPE_OVERRIDE_KEY) continue;
      assumptions[key] = this.inputModelSupport.toNumber(value);
    }

    const yearlyInvestments = buildYearlyInvestments(projection, baseYear);
    const nearTermExpenseAssumptions =
      this.inputModelSupport.buildNearTermExpenseAssumptions(
        baseYear,
        assumptions,
        projection?.vuosiYlikirjoitukset ?? {},
      );
    const thereafterExpenseAssumptions =
      this.inputModelSupport.buildThereafterExpenseAssumptions(assumptions);

    void scenarioDepreciationStorage;
    const scenarioType = this.scenarioMetaSupport.resolveScenarioType(
      projection?.olettamusYlikirjoitukset,
      Boolean(projection?.onOletus),
    );

    return {
      id: projection.id ?? '',
      name:
        this.scenarioMetaSupport.normalizeText(projection.nimi) ??
        projection.nimi ??
        '',
      onOletus: Boolean(projection.onOletus),
      scenarioType,
      talousarvioId: projection.talousarvioId ?? '',
      baselineYear: baseYear,
      horizonYears: this.inputModelSupport.toNumber(projection.aikajaksoVuosia),
      assumptions,
      yearlyInvestments,
      nearTermExpenseAssumptions,
      thereafterExpenseAssumptions,
      requiredPriceTodayCombined,
      baselinePriceTodayCombined,
      requiredAnnualIncreasePct,
      requiredPriceTodayCombinedAnnualResult,
      requiredAnnualIncreasePctAnnualResult,
      requiredPriceTodayCombinedCumulativeCash,
      requiredAnnualIncreasePctCumulativeCash,
      feeSufficiency: {
        baselineCombinedPrice: baselinePriceTodayCombined,
        annualResult: {
          requiredPriceToday: requiredPriceTodayCombinedAnnualResult,
          requiredAnnualIncreasePct: requiredAnnualIncreasePctAnnualResult,
          underfundingStartYear: annualResultUnderfundingStartYear,
          peakDeficit: peakAnnualDeficit,
        },
        cumulativeCash: {
          requiredPriceToday: requiredPriceTodayCombinedCumulativeCash,
          requiredAnnualIncreasePct: requiredAnnualIncreasePctCumulativeCash,
          underfundingStartYear: cumulativeCashUnderfundingStartYear,
          peakGap: peakCumulativeGap,
        },
      },
      years,
      priceSeries: years.map((item) => ({
        year: item.year,
        combinedPrice: item.combinedPrice,
        waterPrice: item.waterPrice,
        wastewaterPrice: item.wastewaterPrice,
      })),
      investmentSeries: years.map((item) => ({
        year: item.year,
        amount: item.investments,
      })),
      cashflowSeries: years.map((item) => ({
        year: item.year,
        cashflow: item.cashflow,
        cumulativeCashflow: item.cumulativeCashflow,
      })),
      computedAt: this.toDateOrNull(projection.computedAt),
      computedFromUpdatedAt: this.toDateOrNull(projection.computedFromUpdatedAt),
      updatedAt: this.toDate(projection.updatedAt),
      createdAt: this.toDate(projection.createdAt),
    };
  }

  extractWaterDriverPrices(rows: Array<Record<string, unknown>>) {
    let water = 0;
    let wastewater = 0;
    let baseFeeRevenue = 0;
    let connectionCount = 0;
    for (const row of rows) {
      const service = String(row.palvelutyyppi ?? '');
      const price = this.inputModelSupport.toNumber(row.yksikkohinta);
      const baseFee = this.inputModelSupport.toNumber(row.perusmaksu);
      const connections = this.inputModelSupport.toNumber(row.liittymamaara);
      if (service === 'vesi') water = price;
      if (service === 'jatevesi') wastewater = price;
      baseFeeRevenue = this.inputModelSupport.round2(
        baseFeeRevenue + baseFee * connections,
      );
      connectionCount = this.inputModelSupport.round2(
        connectionCount + connections,
      );
    }
    return { water, wastewater, baseFeeRevenue, connectionCount };
  }

  computeRequiredPriceForZeroResult(
    firstYear: ScenarioYear | undefined,
  ): number | null {
    if (!firstYear) return null;
    const volume = this.inputModelSupport.toNumber(firstYear.soldVolume);
    if (!Number.isFinite(volume) || volume <= 0) return null;

    const baseVolumeRevenue =
      this.inputModelSupport.toNumber(firstYear.combinedPrice) *
      this.inputModelSupport.toNumber(firstYear.soldVolume);
    const nonVolumeRevenue = this.inputModelSupport.round2(
      this.inputModelSupport.toNumber(firstYear.revenue) - baseVolumeRevenue,
    );
    const requiredCombinedPrice =
      (this.inputModelSupport.toNumber(firstYear.costs) - nonVolumeRevenue) /
      volume;

    return this.inputModelSupport.round2(Math.max(0, requiredCombinedPrice));
  }

  async resolveLatestComparableBaselinePrice(
    orgId: string,
  ): Promise<number | null> {
    const [importStatus, trendSeries] = await Promise.all([
      this.importOverviewService.getImportStatus(orgId),
      this.seriesSupport.getTrendSeries(orgId),
    ]);

    const latestComparableYear =
      this.scenarioMetaSupport.resolveLatestComparableYear(
        this.scenarioMetaSupport.resolveWorkspaceYearRows(importStatus),
      ) ??
      (() => {
        const latestIndex =
          this.scenarioMetaSupport.resolveLatestDataIndex(trendSeries);
        return latestIndex >= 0 ? trendSeries[latestIndex]?.year ?? null : null;
      })();

    if (latestComparableYear == null) return null;
    const point = trendSeries.find(
      (row: TrendPoint) => row.year === latestComparableYear,
    );
    if (!point) return null;
    return this.inputModelSupport.round2(
      this.inputModelSupport.toNumber(point.combinedPrice),
    );
  }

  private toDateOrNull(value: Date | string | null | undefined): Date | null {
    if (value == null) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDate(value: Date | string | null | undefined): Date {
    return this.toDateOrNull(value) ?? new Date(0);
  }
}
