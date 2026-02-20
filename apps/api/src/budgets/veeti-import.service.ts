import { BadGatewayException, BadRequestException, Injectable, Logger } from '@nestjs/common';

type VeetiServiceType = 'vesi' | 'jatevesi';

type VeetiDriver = {
  palvelutyyppi: VeetiServiceType;
  yksikkohinta?: number;
  myytyMaara?: number;
  sourceMeta?: Record<string, unknown>;
};

type VeetiOrg = {
  id: number;
  name: string | null;
  ytunnus: string | null;
};

export type VeetiDriversResponse = {
  source: 'VEETI';
  fetchedAt: string;
  org: VeetiOrg;
  years: number[];
  driversByYear: Record<number, VeetiDriver[]>;
  missingByYear: Record<number, string[]>;
  warnings: string[];
};

type ODataEnvelope<T> = {
  value?: T[];
};

type VeetiOrganizationRow = {
  Id: number;
  Nimi?: string | null;
  YTunnus?: string | null;
};

type VeetiFeeRow = {
  Vuosi: number;
  Kayttomaksu?: number | string | null;
  Tyyppi_Id: number;
};

type VeetiSoldWaterRow = {
  Vuosi: number;
  Maara?: number | string | null;
};

type VeetiSoldWastewaterRow = {
  Vuosi: number;
  Maara?: number | string | null;
};

const DEFAULT_VEETI_BASE_URL = 'https://veetirajapinta.ymparisto.fi/v1/odata';
const FETCH_TIMEOUT_MS = 15_000;

@Injectable()
export class VeetiImportService {
  private readonly logger = new Logger(VeetiImportService.name);
  private readonly baseUrl = (process.env.VEETI_ODATA_BASE_URL ?? DEFAULT_VEETI_BASE_URL).replace(/\/+$/, '');

  async fetchDrivers(orgId: number, years: number[]): Promise<VeetiDriversResponse> {
    const normalizedYears = this.normalizeYears(years);
    if (!Number.isInteger(orgId) || orgId <= 0) {
      throw new BadRequestException('Invalid VEETI organization id. Provide a positive integer.');
    }
    if (normalizedYears.length === 0) {
      throw new BadRequestException('At least one year is required for VEETI import.');
    }

    const minYear = normalizedYears[0]!;
    const maxYear = normalizedYears[normalizedYears.length - 1]!;

    const [orgRows, feeRows, soldWaterRows, soldWastewaterRows] = await Promise.all([
      this.fetchEntity<VeetiOrganizationRow>('VesihuoltoOrganisaatio', {
        $filter: `Id eq ${orgId}`,
      }),
      this.fetchEntity<VeetiFeeRow>('TaksaKayttomaksu', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${orgId} and Vuosi ge ${minYear} and Vuosi le ${maxYear}`,
        $orderby: 'Vuosi asc,Tyyppi_Id asc',
      }),
      this.fetchEntity<VeetiSoldWaterRow>('LaskutettuTalousvesi', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${orgId} and Vuosi ge ${minYear} and Vuosi le ${maxYear}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<VeetiSoldWastewaterRow>('LaskutettuJatevesi', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${orgId} and Vuosi ge ${minYear} and Vuosi le ${maxYear}`,
        $orderby: 'Vuosi asc',
      }),
    ]);

    const orgRow = orgRows[0];
    if (!orgRow) {
      throw new BadRequestException(`VEETI organization not found for id ${orgId}.`);
    }

    const waterPriceByYear = new Map<number, number>();
    const wastewaterPriceByYear = new Map<number, number>();
    for (const row of feeRows) {
      if (!normalizedYears.includes(row.Vuosi)) continue;
      const amount = this.toFiniteNumber(row.Kayttomaksu);
      if (amount == null) continue;
      if (row.Tyyppi_Id === 1) {
        waterPriceByYear.set(row.Vuosi, amount);
      } else if (row.Tyyppi_Id === 2) {
        wastewaterPriceByYear.set(row.Vuosi, amount);
      }
    }

    const soldWaterByYear = new Map<number, number>();
    for (const row of soldWaterRows) {
      if (!normalizedYears.includes(row.Vuosi)) continue;
      const amount = this.toFiniteNumber(row.Maara);
      if (amount == null) continue;
      soldWaterByYear.set(row.Vuosi, (soldWaterByYear.get(row.Vuosi) ?? 0) + amount);
    }

    const soldWastewaterByYear = new Map<number, number>();
    for (const row of soldWastewaterRows) {
      if (!normalizedYears.includes(row.Vuosi)) continue;
      const amount = this.toFiniteNumber(row.Maara);
      if (amount == null) continue;
      soldWastewaterByYear.set(row.Vuosi, (soldWastewaterByYear.get(row.Vuosi) ?? 0) + amount);
    }

    const driversByYear: Record<number, VeetiDriver[]> = {};
    const missingByYear: Record<number, string[]> = {};

    for (const year of normalizedYears) {
      const waterPrice = waterPriceByYear.get(year);
      const wastewaterPrice = wastewaterPriceByYear.get(year);
      const soldWater = soldWaterByYear.get(year);
      const soldWastewater = soldWastewaterByYear.get(year);

      const waterDriver: VeetiDriver = {
        palvelutyyppi: 'vesi',
        ...(typeof waterPrice === 'number' ? { yksikkohinta: this.round4(waterPrice) } : {}),
        ...(typeof soldWater === 'number' ? { myytyMaara: this.round2(soldWater) } : {}),
        sourceMeta: {
          imported: true,
          manualOverride: false,
          source: 'veeti_odata',
          veetiOrgId: orgId,
          veetiYear: year,
        },
      };

      const wastewaterDriver: VeetiDriver = {
        palvelutyyppi: 'jatevesi',
        ...(typeof wastewaterPrice === 'number' ? { yksikkohinta: this.round4(wastewaterPrice) } : {}),
        ...(typeof soldWastewater === 'number' ? { myytyMaara: this.round2(soldWastewater) } : {}),
        sourceMeta: {
          imported: true,
          manualOverride: false,
          source: 'veeti_odata',
          veetiOrgId: orgId,
          veetiYear: year,
        },
      };

      driversByYear[year] = [waterDriver, wastewaterDriver];

      const missing: string[] = [];
      if (!(typeof waterPrice === 'number' && waterPrice > 0)) missing.push('vesi.yksikkohinta');
      if (!(typeof soldWater === 'number' && soldWater > 0)) missing.push('vesi.myytyMaara');
      if (!(typeof wastewaterPrice === 'number' && wastewaterPrice > 0)) missing.push('jatevesi.yksikkohinta');
      if (!(typeof soldWastewater === 'number' && soldWastewater > 0)) missing.push('jatevesi.myytyMaara');
      missingByYear[year] = missing;
    }

    return {
      source: 'VEETI',
      fetchedAt: new Date().toISOString(),
      org: {
        id: orgRow.Id,
        name: orgRow.Nimi ?? null,
        ytunnus: orgRow.YTunnus ?? null,
      },
      years: normalizedYears,
      driversByYear,
      missingByYear,
      warnings: [],
    };
  }

  private normalizeYears(years: number[]): number[] {
    return Array.from(
      new Set(
        (years ?? [])
          .map((year) => Number(year))
          .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100),
      ),
    ).sort((a, b) => a - b);
  }

  private toFiniteNumber(value: number | string | null | undefined): number | null {
    if (value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const normalized = String(value).trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round4(value: number): number {
    return Math.round(value * 10000) / 10000;
  }

  private async fetchEntity<T>(entity: string, params: Record<string, string>): Promise<T[]> {
    const query = new URLSearchParams(params);
    const url = `${this.baseUrl}/${entity}?${query.toString()}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new BadGatewayException(
          `VEETI request failed for ${entity} (${response.status}). ${details}`.trim(),
        );
      }

      const payload = await response.json() as ODataEnvelope<T>;
      return Array.isArray(payload.value) ? payload.value : [];
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      this.logger.warn(`VEETI fetch error for ${entity}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException(`VEETI data fetch failed for ${entity}.`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

