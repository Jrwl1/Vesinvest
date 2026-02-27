import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  VEETI_IMPORT_CONTRACT,
  VEETI_IMPORT_DATA_TYPES,
} from './veeti-import-contract';

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
  private readonly baseUrl = (
    process.env.VEETI_ODATA_BASE_URL ?? DEFAULT_VEETI_BASE_URL
  ).replace(/\/+$/, '');

  async searchOrganizations(
    query: string,
    limit = 20,
  ): Promise<VeetiOrganization[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const qNormalized = this.normalizeSearchToken(q);

    // OData filtering support can vary by environment. Use deterministic client-side filtering
    // over paged reads so Y-tunnus searches do not depend on alphabetical prefix windows.
    const pageSize = 500;
    const maxScan = 5_000;
    const cappedLimit = Math.min(Math.max(limit, 1), 50);
    const matches: VeetiOrganization[] = [];
    const seen = new Set<number>();
    let skip = 0;

    while (skip < maxScan && matches.length < cappedLimit) {
      const rows = await this.fetchEntity<VeetiOrganization>(
        'VesihuoltoOrganisaatio',
        {
          $top: String(pageSize),
          $skip: String(skip),
          $orderby: 'Nimi asc',
        },
      );
      if (rows.length === 0) break;

      for (const row of rows) {
        const nimi = String(row.Nimi ?? '').toLowerCase();
        const ytunnus = String(row.YTunnus ?? '').toLowerCase();
        const ytunnusNormalized = this.normalizeSearchToken(ytunnus);
        const isMatch =
          nimi.includes(q) ||
          ytunnus.includes(q) ||
          (qNormalized.length > 0 && ytunnusNormalized.includes(qNormalized));
        if (!isMatch || seen.has(row.Id)) continue;
        seen.add(row.Id);
        matches.push(row);
        if (matches.length >= cappedLimit) break;
      }

      if (rows.length < pageSize) break;
      skip += rows.length;
    }

    return matches;
  }

  async getOrganizationById(
    veetiId: number,
  ): Promise<VeetiOrganization | null> {
    const rows = await this.fetchEntity<VeetiOrganization>(
      'VesihuoltoOrganisaatio',
      {
        $filter: `Id eq ${veetiId}`,
        $top: '1',
      },
    );
    return rows[0] ?? null;
  }

  async listOrganizations(): Promise<VeetiOrganization[]> {
    return this.fetchEntity<VeetiOrganization>('VesihuoltoOrganisaatio', {
      $orderby: 'Nimi asc',
      $top: '5000',
    });
  }

  async fetchAllOrgData(
    veetiId: number,
  ): Promise<Record<VeetiDataType, unknown[]>> {
    const entries = await Promise.all(
      VEETI_IMPORT_DATA_TYPES.map(async (dataType) => {
        const contract = VEETI_IMPORT_CONTRACT[dataType];
        const params: Record<string, string> = {
          $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        };
        if (contract.orderBy) {
          params.$orderby = contract.orderBy;
        }

        const rows = await this.fetchEntity<Record<string, unknown>>(
          contract.entity,
          params,
        );

        return [dataType, rows] as const;
      }),
    );

    return Object.fromEntries(entries) as Record<VeetiDataType, unknown[]>;
  }

  async fetchEntityByYear(
    veetiId: number,
    dataType: VeetiDataType,
    year: number,
  ): Promise<Record<string, unknown>[]> {
    const contract = VEETI_IMPORT_CONTRACT[dataType];
    const filterClauses = [`VesihuoltoOrganisaatio_Id eq ${veetiId}`];
    if (contract.mode === 'yearly') {
      filterClauses.push(`Vuosi eq ${year}`);
    }

    const params: Record<string, string> = {
      $filter: filterClauses.join(' and '),
    };
    if (contract.orderBy) {
      params.$orderby = contract.orderBy;
    }

    return this.fetchEntity<Record<string, unknown>>(contract.entity, params);
  }

  async fetchVerkostoonPumpattuTalousvesi(
    veetiId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>(
      'VerkostoonPumpattuTalousvesi',
      {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      },
    );
  }

  async fetchTalousvedenOstoJaMyynti(
    veetiId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>(
      'TalousvedenOstoJaMyynti',
      {
        $filter: `MyyjaVesihuoltoOrganisaatio_Id eq ${veetiId} or OstajaVesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      },
    );
  }

  async fetchVerkkojenSaneeraukset(
    veetiId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>(
      'VerkkojenSaneerauksetVerkkoTyyppi',
      {
        $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
        $orderby: 'Vuosi asc',
      },
    );
  }

  async fetchToimintakertomus(
    veetiId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>('Toimintakertomus', {
      $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
      $orderby: 'Vuosi asc',
    });
  }

  async fetchVedenottoluvat(
    veetiId: number,
  ): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>('Vedenottolupa', {
      $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
    });
  }

  async fetchVerkko(veetiId: number): Promise<Record<string, unknown>[]> {
    return this.fetchEntity<Record<string, unknown>>('Verkko', {
      $filter: `VesihuoltoOrganisaatio_Id eq ${veetiId}`,
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

  private normalizeSearchToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private async fetchEntity<T>(
    entity: string,
    params: Record<string, string>,
  ): Promise<T[]> {
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
      this.logger.warn(
        `VEETI fetch error for ${entity}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new BadGatewayException(`VEETI data fetch failed for ${entity}.`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
