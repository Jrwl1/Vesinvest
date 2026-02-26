import { Injectable } from '@nestjs/common';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiService } from './veeti.service';

type YearSanityRow = {
  year: number;
  status: 'ok' | 'mismatch' | 'missing_live' | 'missing_effective';
  mismatches: string[];
  expected: {
    revenue: number;
    operatingCosts: number;
    yearResult: number;
    volume: number;
    combinedPrice: number;
  };
  actual: {
    revenue: number;
    operatingCosts: number;
    yearResult: number;
    volume: number;
    combinedPrice: number;
  };
};

@Injectable()
export class VeetiSanityService {
  constructor(
    private readonly veetiService: VeetiService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
  ) {}

  async checkYears(orgId: string, years: number[]) {
    const link = await this.veetiEffectiveDataService.getLink(orgId);
    if (!link) {
      return {
        checkedAt: new Date().toISOString(),
        rows: [] as YearSanityRow[],
      };
    }

    const normalizedYears = [
      ...new Set(years.map((year) => Math.round(Number(year)))),
    ]
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => a - b);

    const rows: YearSanityRow[] = [];
    for (const year of normalizedYears) {
      const [expected, actual] = await Promise.all([
        this.loadLiveSummary(link.veetiId, year),
        this.loadEffectiveSummary(orgId, year),
      ]);

      if (expected == null) {
        rows.push({
          year,
          status: 'missing_live',
          mismatches: [],
          expected: this.emptySummary(),
          actual: actual ?? this.emptySummary(),
        });
        continue;
      }
      if (actual == null) {
        rows.push({
          year,
          status: 'missing_effective',
          mismatches: [],
          expected,
          actual: this.emptySummary(),
        });
        continue;
      }

      const mismatches: string[] = [];
      this.checkMetricDelta(
        mismatches,
        'revenue',
        expected.revenue,
        actual.revenue,
      );
      this.checkMetricDelta(
        mismatches,
        'operatingCosts',
        expected.operatingCosts,
        actual.operatingCosts,
      );
      this.checkMetricDelta(
        mismatches,
        'yearResult',
        expected.yearResult,
        actual.yearResult,
      );
      this.checkMetricDelta(
        mismatches,
        'volume',
        expected.volume,
        actual.volume,
      );
      this.checkMetricDelta(
        mismatches,
        'combinedPrice',
        expected.combinedPrice,
        actual.combinedPrice,
      );

      rows.push({
        year,
        status: mismatches.length > 0 ? 'mismatch' : 'ok',
        mismatches,
        expected,
        actual,
      });
    }

    return {
      checkedAt: new Date().toISOString(),
      rows,
    };
  }

  private async loadLiveSummary(veetiId: number, year: number) {
    const [tilinpaatos, taksa, water, wastewater] = await Promise.all([
      this.veetiService.fetchEntityByYear(veetiId, 'tilinpaatos', year),
      this.veetiService.fetchEntityByYear(veetiId, 'taksa', year),
      this.veetiService.fetchEntityByYear(veetiId, 'volume_vesi', year),
      this.veetiService.fetchEntityByYear(veetiId, 'volume_jatevesi', year),
    ]);
    if (
      tilinpaatos.length === 0 &&
      taksa.length === 0 &&
      water.length === 0 &&
      wastewater.length === 0
    ) {
      return null;
    }
    return this.computeSummary(tilinpaatos, taksa, water, wastewater);
  }

  private async loadEffectiveSummary(orgId: string, year: number) {
    const [tilinpaatos, taksa, water, wastewater] = await Promise.all([
      this.veetiEffectiveDataService.getEffectiveRows(
        orgId,
        year,
        'tilinpaatos',
      ),
      this.veetiEffectiveDataService.getEffectiveRows(orgId, year, 'taksa'),
      this.veetiEffectiveDataService.getEffectiveRows(
        orgId,
        year,
        'volume_vesi',
      ),
      this.veetiEffectiveDataService.getEffectiveRows(
        orgId,
        year,
        'volume_jatevesi',
      ),
    ]);

    if (
      tilinpaatos.rows.length === 0 &&
      taksa.rows.length === 0 &&
      water.rows.length === 0 &&
      wastewater.rows.length === 0
    ) {
      return null;
    }

    return this.computeSummary(
      tilinpaatos.rows,
      taksa.rows,
      water.rows,
      wastewater.rows,
    );
  }

  private computeSummary(
    tilinpaatos: Array<Record<string, unknown>>,
    taksa: Array<Record<string, unknown>>,
    water: Array<Record<string, unknown>>,
    wastewater: Array<Record<string, unknown>>,
  ) {
    const row = (tilinpaatos[0] ?? {}) as Record<string, unknown>;
    const revenue = this.toNumber(row.Liikevaihto);
    const operatingCosts = this.round2(
      this.toNumber(row.Henkilostokulut) +
        this.toNumber(row.Poistot) +
        this.toNumber(row.LiiketoiminnanMuutKulut) +
        this.toNumber(row.Arvonalentumiset),
    );
    const financingNet = this.toNumber(row.RahoitustuototJaKulut);
    const explicitResult = this.toNumber(row.TilikaudenYliJaama);
    const yearResult =
      explicitResult !== 0
        ? explicitResult
        : this.round2(revenue - operatingCosts + financingNet);

    const waterVolume = water.reduce(
      (sum, item) => sum + this.toNumber(item.Maara),
      0,
    );
    const wastewaterVolume = wastewater.reduce(
      (sum, item) => sum + this.toNumber(item.Maara),
      0,
    );
    const volume = this.round2(waterVolume + wastewaterVolume);

    const waterPrice = this.resolveLatestPrice(taksa, 1);
    const wastewaterPrice = this.resolveLatestPrice(taksa, 2);
    const combinedPrice = this.round2(
      volume > 0
        ? (waterPrice * waterVolume + wastewaterPrice * wastewaterVolume) /
            Math.max(volume, 1)
        : this.round2((waterPrice + wastewaterPrice) / 2),
    );

    return {
      revenue: this.round2(revenue),
      operatingCosts: this.round2(operatingCosts),
      yearResult: this.round2(yearResult),
      volume: this.round2(volume),
      combinedPrice,
    };
  }

  private resolveLatestPrice(
    rows: Array<Record<string, unknown>>,
    typeId: number,
  ): number {
    const prices = rows
      .filter((row) => this.toNumber(row.Tyyppi_Id) === typeId)
      .map((row) => this.toNumber(row.Kayttomaksu))
      .filter((price) => price > 0);
    return prices[prices.length - 1] ?? 0;
  }

  private checkMetricDelta(
    mismatches: string[],
    key: string,
    expected: number,
    actual: number,
  ) {
    const epsilon = 0.01;
    if (Math.abs(expected - actual) > epsilon) {
      mismatches.push(key);
    }
  }

  private toNumber(value: unknown): number {
    if (value == null) return 0;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private emptySummary() {
    return {
      revenue: 0,
      operatingCosts: 0,
      yearResult: 0,
      volume: 0,
      combinedPrice: 0,
    };
  }
}
