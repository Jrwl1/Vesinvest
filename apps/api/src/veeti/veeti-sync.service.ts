import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VeetiDataType, VeetiService } from './veeti.service';

@Injectable()
export class VeetiSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly veetiService: VeetiService,
  ) {}

  async connectOrg(orgId: string, veetiId: number) {
    const orgRow = await this.veetiService.getOrganizationById(veetiId);
    if (!orgRow) {
      throw new BadRequestException(`VEETI organization ${veetiId} was not found.`);
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
    const link = await this.prisma.veetiOrganisaatio.findUnique({ where: { orgId } });
    if (!link) {
      throw new BadRequestException('Organization is not linked to VEETI. Connect first.');
    }

    const data = await this.veetiService.fetchAllOrgData(link.veetiId);
    const summary = await this.persistSnapshots(orgId, link.veetiId, data);

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
      ...summary,
    };
  }

  async getStatus(orgId: string) {
    return this.prisma.veetiOrganisaatio.findUnique({ where: { orgId } });
  }

  async getSnapshots(orgId: string, dataType: VeetiDataType, vuosi?: number) {
    return this.prisma.veetiSnapshot.findMany({
      where: {
        orgId,
        dataType,
        ...(vuosi != null ? { vuosi } : {}),
      },
      orderBy: [{ vuosi: 'asc' }, { fetchedAt: 'desc' }],
    });
  }

  async getAvailableYears(orgId: string) {
    const rows = await this.prisma.veetiSnapshot.findMany({
      where: { orgId },
      select: { vuosi: true, dataType: true },
      orderBy: { vuosi: 'asc' },
    });

    const byYear = new Map<number, Set<string>>();
    for (const row of rows) {
      const set = byYear.get(row.vuosi) ?? new Set<string>();
      set.add(row.dataType);
      byYear.set(row.vuosi, set);
    }

    return Array.from(byYear.entries()).map(([vuosi, dataTypes]) => ({
      vuosi,
      dataTypes: Array.from(dataTypes).sort(),
      completeness: {
        tilinpaatos: dataTypes.has('tilinpaatos'),
        taksa: dataTypes.has('taksa'),
        volume_vesi: dataTypes.has('volume_vesi'),
        volume_jatevesi: dataTypes.has('volume_jatevesi'),
        investointi: dataTypes.has('investointi'),
        energia: dataTypes.has('energia'),
        verkko: dataTypes.has('verkko'),
      },
    }));
  }

  private async persistSnapshots(
    orgId: string,
    veetiId: number,
    data: Record<VeetiDataType, unknown[]>,
  ) {
    const allYears = new Set<number>();
    let upserts = 0;

    const upsertByYear = async (dataType: VeetiDataType, rows: unknown[]) => {
      const byYear = this.groupRowsByYear(rows);
      for (const [vuosi, items] of byYear.entries()) {
        allYears.add(vuosi);
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
    };
  }

  private groupRowsByYear(rows: unknown[]): Map<number, unknown[]> {
    const grouped = new Map<number, unknown[]>();
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const parsed = this.veetiService.extractYear(row as Record<string, unknown>);
      if (parsed == null) continue;
      const items = grouped.get(parsed) ?? [];
      items.push(row);
      grouped.set(parsed, items);
    }
    return grouped;
  }
}

