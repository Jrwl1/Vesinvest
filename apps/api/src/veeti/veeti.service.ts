import { BadGatewayException, Injectable, Logger } from '@nestjs/common';

type ODataEnvelope<T> = {
  value?: T[];
};

const DEFAULT_VEETI_BASE_URL = 'https://veetirajapinta.ymparisto.fi/v1/odata';
const FETCH_TIMEOUT_MS = 20_000;

export type VeetiDataType =
  | 'tilinpaatos'
  | 'taksa'
  | 'volume_vesi'
  | 'volume_jatevesi'
  | 'investointi'
  | 'energia'
  | 'verkko';

export type VeetiOrganization = {
  Id: number;
  Nimi?: string | null;
  YTunnus?: string | null;
  Kunta?: string | null;
};

@Injectable()
export class VeetiService {
  private readonly logger = new Logger(VeetiService.name);
  private readonly baseUrl = (process.env.VEETI_ODATA_BASE_URL ?? DEFAULT_VEETI_BASE_URL).replace(/\/+$/, '');

  async searchOrganizations(query: string, limit = 20): Promise<VeetiOrganization[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // OData string filtering support can vary; fetch a capped set and filter client-side.
    const rows = await this.fetchEntity<VeetiOrganization>('VesihuoltoOrganisaatio', {
      $top: String(Math.max(limit * 10, 200)),
      $orderby: 'Nimi asc',
    });

    return rows
      .filter((row) => {
        const nimi = String(row.Nimi ?? '').toLowerCase();
        const ytunnus = String(row.YTunnus ?? '').toLowerCase();
        return nimi.includes(q) || ytunnus.includes(q);
      })
      .slice(0, Math.min(limit, 50));
  }

  async getOrganizationById(veetiId: number): Promise<VeetiOrganization | null> {
    const rows = await this.fetchEntity<VeetiOrganization>('VesihuoltoOrganisaatio', {
      $filter: `Id eq ${veetiId}`,
      $top: '1',
    });
    return rows[0] ?? null;
  }

  async listOrganizations(): Promise<VeetiOrganization[]> {
    return this.fetchEntity<VeetiOrganization>('VesihuoltoOrganisaatio', {
      $orderby: 'Nimi asc',
      $top: '5000',
    });
  }

  async fetchAllOrgData(veetiId: number): Promise<Record<VeetiDataType, unknown[]>> {
    const [tilinpaatos, taksa, volumeVesi, volumeJatevesi, investointi, energia, verkko] = await Promise.all([
      this.fetchEntity<Record<string, unknown>>('Tilinpaatos', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<Record<string, unknown>>('TaksaKayttomaksu', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc,Tyyppi_Id asc',
      }),
      this.fetchEntity<Record<string, unknown>>('LaskutettuTalousvesi', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<Record<string, unknown>>('LaskutettuJatevesi', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<Record<string, unknown>>('Investointi', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<Record<string, unknown>>('EnergianKaytto', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      }),
      this.fetchEntity<Record<string, unknown>>('Verkko', {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
      }),
    ]);

    return {
      tilinpaatos,
      taksa,
      volume_vesi: volumeVesi,
      volume_jatevesi: volumeJatevesi,
      investointi,
      energia,
      verkko,
    };
  }

  async fetchEntityByYear(
    veetiId: number,
    dataType: VeetiDataType,
    year: number,
  ): Promise<Record<string, unknown>[]> {
    const entityByType: Record<VeetiDataType, string> = {
      tilinpaatos: 'Tilinpaatos',
      taksa: 'TaksaKayttomaksu',
      volume_vesi: 'LaskutettuTalousvesi',
      volume_jatevesi: 'LaskutettuJatevesi',
      investointi: 'Investointi',
      energia: 'EnergianKaytto',
      verkko: 'Verkko',
    };

    return this.fetchEntity<Record<string, unknown>>(entityByType[dataType], {
      $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId} and Vuosi eq ${year}`,
      $orderby: 'Vuosi asc',
    });
  }

  extractYear(row: Record<string, unknown>): number | null {
    const raw = row['Vuosi'];
    if (typeof raw === 'number' && Number.isInteger(raw)) return raw;
    if (typeof raw === 'string') {
      const parsed = Number(raw);
      if (Number.isInteger(parsed)) return parsed;
    }
    return null;
  }

  toNumber(value: unknown): number | null {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const normalized = value.trim().replace(',', '.');
      if (!normalized) return null;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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

      const payload = (await response.json()) as ODataEnvelope<T>;
      return Array.isArray(payload.value) ? payload.value : [];
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      this.logger.warn(`VEETI fetch error for ${entity}: ${error instanceof Error ? error.message : String(error)}`);
      throw new BadGatewayException(`VEETI data fetch failed for ${entity}.`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

