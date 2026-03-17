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
const ORGANIZATION_SEARCH_PAGE_SIZE = 500;
const ORGANIZATION_SEARCH_MAX_SCAN = 5_000;
const ORGANIZATION_SEARCH_LIMIT_MAX = 25;
const ORGANIZATION_CATALOG_CACHE_TTL_MS = 5 * 60_000;

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
  Kieli_Id?: number | null;
};

@Injectable()
export class VeetiService {
  private readonly logger = new Logger(VeetiService.name);
  private readonly baseUrl = (
    process.env.VEETI_ODATA_BASE_URL ?? DEFAULT_VEETI_BASE_URL
  ).replace(/\/+$/, '');
  private organizationCatalogCache:
    | { value: VeetiOrganization[]; expiresAt: number }
    | null = null;
  private organizationCatalogPromise: Promise<VeetiOrganization[]> | null = null;

  async searchOrganizations(
    query: string,
    limit = 20,
  ): Promise<VeetiOrganization[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const qNormalized = this.normalizeSearchToken(q);
    const businessIdToken = this.normalizeBusinessIdToken(q);
    const cappedLimit = Math.min(
      Math.max(Math.round(limit) || 20, 1),
      ORGANIZATION_SEARCH_LIMIT_MAX,
    );

    if (businessIdToken.length === 8) {
      const exactMatches = await this.fetchOrganizationsByExactBusinessId(
        businessIdToken,
        cappedLimit,
      );
      if (exactMatches.length > 0) {
        return exactMatches;
      }
    }

    const catalog = await this.getOrganizationCatalog();
    return catalog
      .map((row) => ({
        row,
        score: this.scoreOrganizationSearchHit(row, q, qNormalized),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        const leftName = String(left.row.Nimi ?? '').toLowerCase();
        const rightName = String(right.row.Nimi ?? '').toLowerCase();
        return leftName.localeCompare(rightName);
      })
      .slice(0, cappedLimit)
      .map((entry) => entry.row);
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

  private normalizeBusinessIdToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^\d]/g, '');
  }

  private async fetchOrganizationsByExactBusinessId(
    businessIdToken: string,
    limit: number,
  ): Promise<VeetiOrganization[]> {
    const candidates = [
      `${businessIdToken.slice(0, 7)}-${businessIdToken.slice(7)}`,
      businessIdToken,
    ];
    const seen = new Set<number>();
    const matches: VeetiOrganization[] = [];

    for (const candidate of candidates) {
      try {
        const rows = await this.fetchEntity<VeetiOrganization>(
          'VesihuoltoOrganisaatio',
          {
            $filter: `YTunnus eq '${candidate}'`,
            $orderby: 'Nimi asc',
            $top: String(limit),
          },
        );
        for (const row of rows) {
          if (seen.has(row.Id)) continue;
          seen.add(row.Id);
          matches.push(row);
          if (matches.length >= limit) {
            return matches;
          }
        }
        if (matches.length > 0) {
          return matches;
        }
      } catch (error) {
        this.logger.warn(
          `VEETI exact Y-tunnus lookup fallback engaged: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return [];
      }
    }

    return matches;
  }

  private async getOrganizationCatalog(): Promise<VeetiOrganization[]> {
    const cached = this.organizationCatalogCache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (this.organizationCatalogPromise) {
      return this.organizationCatalogPromise;
    }

    this.organizationCatalogPromise = this.fetchOrganizationCatalog().then(
      (rows) => {
        this.organizationCatalogCache = {
          value: rows,
          expiresAt: Date.now() + ORGANIZATION_CATALOG_CACHE_TTL_MS,
        };
        return rows;
      },
    ).finally(() => {
      this.organizationCatalogPromise = null;
    });

    return this.organizationCatalogPromise;
  }

  private async fetchOrganizationCatalog(): Promise<VeetiOrganization[]> {
    const seen = new Set<number>();
    const rows: VeetiOrganization[] = [];
    let skip = 0;

    while (skip < ORGANIZATION_SEARCH_MAX_SCAN) {
      const page = await this.fetchEntity<VeetiOrganization>(
        'VesihuoltoOrganisaatio',
        {
          $top: String(ORGANIZATION_SEARCH_PAGE_SIZE),
          $skip: String(skip),
          $orderby: 'Nimi asc',
        },
      );
      if (page.length === 0) break;

      for (const row of page) {
        if (seen.has(row.Id)) continue;
        seen.add(row.Id);
        rows.push(row);
      }

      if (page.length < ORGANIZATION_SEARCH_PAGE_SIZE) break;
      skip += page.length;
    }

    return rows;
  }

  private scoreOrganizationSearchHit(
    row: VeetiOrganization,
    q: string,
    qNormalized: string,
  ): number {
    const name = String(row.Nimi ?? '').toLowerCase();
    const municipality = String(row.Kunta ?? '').toLowerCase();
    const businessId = String(row.YTunnus ?? '').toLowerCase();
    const businessIdNormalized = this.normalizeBusinessIdToken(businessId);
    let score = 0;

    if (businessIdNormalized.length > 0 && qNormalized.length > 0) {
      if (businessIdNormalized === qNormalized) {
        score = Math.max(score, 1000);
      } else if (businessIdNormalized.startsWith(qNormalized)) {
        score = Math.max(score, 850);
      } else if (businessIdNormalized.includes(qNormalized)) {
        score = Math.max(score, 650);
      }
    }

    if (name === q) {
      score = Math.max(score, 900);
    } else if (name.startsWith(q)) {
      score = Math.max(score, 750);
    } else if (name.includes(q)) {
      score = Math.max(score, 550);
    }

    if (municipality === q) {
      score = Math.max(score, 500);
    } else if (municipality.startsWith(q)) {
      score = Math.max(score, 400);
    } else if (municipality.includes(q)) {
      score = Math.max(score, 300);
    }

    return score;
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
