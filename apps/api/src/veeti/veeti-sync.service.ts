import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiDataType, VeetiService } from './veeti.service';
import { getStaticSnapshotYearForDataType } from './veeti-import-contract';

@Injectable()
export class VeetiSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly veetiService: VeetiService,
    private readonly veetiEffectiveDataService: VeetiEffectiveDataService,
  ) {}

  async connectOrg(orgId: string, veetiId: number) {
    const existingLink = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });
    if (existingLink && existingLink.veetiId !== veetiId) {
      const [snapshotCount, budgetCount, overrideCount] = await Promise.all([
        this.prisma.veetiSnapshot.count({
          where: { orgId, veetiId: existingLink.veetiId },
        }),
        this.prisma.talousarvio.count({
          where: {
            orgId,
            OR: [{ lahde: 'veeti' }, { veetiVuosi: { not: null } }],
          },
        }),
        this.prisma.veetiOverride.count({
          where: { orgId, veetiId: existingLink.veetiId },
        }),
      ]);
      if (snapshotCount + budgetCount + overrideCount > 0) {
        throw new BadRequestException(
          'Organization is already linked to another VEETI source with imported data. Clear imported VEETI data first (/v2/import/clear), then relink.',
        );
      }
    }

    const orgRow = await this.veetiService.getOrganizationById(veetiId);
    if (!orgRow) {
      throw new BadRequestException(
        `VEETI organization ${veetiId} was not found.`,
      );
    }

    await this.prisma.veetiOrganisaatio.upsert({
      where: { orgId },
      create: {
        orgId,
        veetiId,
        nimi: orgRow.Nimi ?? null,
        ytunnus: orgRow.YTunnus ?? null,
        kunta: orgRow.Kunta ?? null,
        linkedAt: new Date(),
        fetchStatus: 'success',
      },
      update: {
        veetiId,
        nimi: orgRow.Nimi ?? null,
        ytunnus: orgRow.YTunnus ?? null,
        kunta: orgRow.Kunta ?? null,
      },
    });

    return this.refreshOrg(orgId);
  }

  async refreshOrg(orgId: string) {
    const link = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
    });
    if (!link) {
      throw new BadRequestException(
        'Organization is not linked to VEETI. Connect first.',
      );
    }

    const [data, excludedYears] = await Promise.all([
      this.veetiService.fetchAllOrgData(link.veetiId),
      this.getExcludedYearSet(orgId, link.veetiId),
    ]);
    const summary = await this.persistSnapshots(
      orgId,
      link.veetiId,
      data,
      excludedYears,
    );

    await this.prisma.veetiOrganisaatio.update({
      where: { orgId },
      data: {
        lastFetchedAt: new Date(),
        fetchStatus: 'success',
      },
    });

    return {
      linked: {
        orgId,
        veetiId: link.veetiId,
        nimi: link.nimi,
        ytunnus: link.ytunnus,
      },
      fetchedAt: new Date().toISOString(),
      excludedYearsApplied: [...excludedYears].sort((a, b) => a - b),
      ...summary,
    };
  }

  async getStatus(orgId: string) {
    return this.prisma.veetiOrganisaatio.findUnique({ where: { orgId } });
  }

  async getSnapshots(orgId: string, dataType: VeetiDataType, vuosi?: number) {
    const link = await this.prisma.veetiOrganisaatio.findUnique({
      where: { orgId },
      select: { veetiId: true },
    });
    if (!link) return [];

    return this.prisma.veetiSnapshot.findMany({
      where: {
        orgId,
        veetiId: link.veetiId,
        dataType,
        ...(vuosi != null ? { vuosi } : {}),
      },
      orderBy: [{ vuosi: 'asc' }, { fetchedAt: 'desc' }],
    });
  }

  async getAvailableYears(orgId: string) {
    return this.veetiEffectiveDataService.getAvailableYears(orgId);
  }

  private async persistSnapshots(
    orgId: string,
    veetiId: number,
    data: Record<VeetiDataType, unknown[]>,
    excludedYears: Set<number>,
  ) {
    const allYears = new Set<number>();
    const skippedExcludedYears = new Set<number>();
    let upserts = 0;

    const upsertByYear = async (dataType: VeetiDataType, rows: unknown[]) => {
      const byYear = this.groupRowsByYear(rows, {
        staticYear: getStaticSnapshotYearForDataType(dataType),
      });
      for (const [vuosi, items] of byYear.entries()) {
        if (vuosi > 0 && excludedYears.has(vuosi)) {
          skippedExcludedYears.add(vuosi);
          continue;
        }
        if (vuosi > 0) {
          allYears.add(vuosi);
        }
        await this.prisma.veetiSnapshot.upsert({
          where: {
            orgId_veetiId_vuosi_dataType: {
              orgId,
              veetiId,
              vuosi,
              dataType,
            },
          },
          create: {
            orgId,
            veetiId,
            vuosi,
            dataType,
            rawData: items as any,
            fetchedAt: new Date(),
          },
          update: {
            rawData: items as any,
            fetchedAt: new Date(),
          },
        });
        upserts += 1;
      }
    };

    await upsertByYear('tilinpaatos', data.tilinpaatos);
    await upsertByYear('taksa', data.taksa);
    await upsertByYear('volume_vesi', data.volume_vesi);
    await upsertByYear('volume_jatevesi', data.volume_jatevesi);
    await upsertByYear('investointi', data.investointi);
    await upsertByYear('energia', data.energia);
    await upsertByYear('verkko', data.verkko);

    return {
      years: Array.from(allYears).sort((a, b) => a - b),
      snapshotUpserts: upserts,
      excludedYearsSkipped: [...skippedExcludedYears].sort((a, b) => a - b),
    };
  }

  private async getExcludedYearSet(orgId: string, veetiId: number) {
    const rows = await this.prisma.veetiYearPolicy.findMany({
      where: {
        orgId,
        veetiId,
        excluded: true,
      },
      select: { vuosi: true },
    });

    const years = new Set<number>();
    for (const row of rows) {
      const year = Math.round(Number(row.vuosi));
      if (Number.isFinite(year) && year > 0) {
        years.add(year);
      }
    }
    return years;
  }

  private groupRowsByYear(
    rows: unknown[],
    options?: { staticYear?: number | null },
  ): Map<number, unknown[]> {
    const grouped = new Map<number, unknown[]>();
    const staticYear =
      options?.staticYear != null && Number.isInteger(options.staticYear)
        ? Number(options.staticYear)
        : null;

    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const parsed = this.veetiService.extractYear(
        row as Record<string, unknown>,
      );
      if (parsed != null) {
        const items = grouped.get(parsed) ?? [];
        items.push(row);
        grouped.set(parsed, items);
        continue;
      }

      if (staticYear != null) {
        const items = grouped.get(staticYear) ?? [];
        items.push(row);
        grouped.set(staticYear, items);
      }
    }
    return grouped;
  }
}
