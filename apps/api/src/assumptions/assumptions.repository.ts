import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';

/** Default assumptions seeded for new organizations. */
const DEFAULT_ASSUMPTIONS = [
  { avain: 'inflaatio', nimi: 'Inflaatio', arvo: 0.025, yksikko: '%', kuvaus: 'Yleinen inflaatio-olettamus (2.5%)' },
  { avain: 'energiakerroin', nimi: 'Energiakerroin', arvo: 0.05, yksikko: '%', kuvaus: 'Energiakustannusten vuosittainen muutos (5%)' },
  { avain: 'vesimaaran_muutos', nimi: 'Vesimäärän muutos', arvo: -0.01, yksikko: '%', kuvaus: 'Myydyn vesimäärän vuosittainen muutos (-1%)' },
  { avain: 'hintakorotus', nimi: 'Hintakorotus', arvo: 0.03, yksikko: '%', kuvaus: 'Yksikköhinnan vuosittainen korotus (3%)' },
  { avain: 'investointikerroin', nimi: 'Investointikerroin', arvo: 0.02, yksikko: '%', kuvaus: 'Investointikustannusten vuosittainen muutos (2%)' },
];

@Injectable()
export class AssumptionsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.olettamus.findMany({
      where: { orgId: org },
      orderBy: { avain: 'asc' },
    });
  }

  upsert(orgId: string, avain: string, data: { arvo: number; nimi?: string; yksikko?: string; kuvaus?: string }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.olettamus.upsert({
      where: { orgId_avain: { orgId: org, avain } },
      update: { arvo: data.arvo, ...(data.nimi !== undefined && { nimi: data.nimi }), ...(data.yksikko !== undefined && { yksikko: data.yksikko }), ...(data.kuvaus !== undefined && { kuvaus: data.kuvaus }) },
      create: { orgId: org, avain, nimi: data.nimi ?? avain, arvo: data.arvo, yksikko: data.yksikko, kuvaus: data.kuvaus },
    });
  }

  async resetDefaults(orgId: string) {
    const org = this.requireOrgId(orgId);
    // Delete all then re-seed defaults
    await this.prisma.olettamus.deleteMany({ where: { orgId: org } });
    const results = [];
    for (const d of DEFAULT_ASSUMPTIONS) {
      const r = await this.prisma.olettamus.create({
        data: { orgId: org, ...d },
      });
      results.push(r);
    }
    return results;
  }
}
