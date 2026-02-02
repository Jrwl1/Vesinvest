import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';

@Injectable()
export class SitesRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId?: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.site.findMany({ where: { orgId: org } });
  }

  create(orgId: string, data: { name: string; address?: string }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.site.create({ data: { ...data, orgId: org } });
  }

  async update(orgId: string, id: string, data: { name?: string; address?: string }) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.site.updateMany({
      where: { id, orgId: org },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Site not found');
    return this.prisma.site.findFirst({ where: { id, orgId: org } });
  }
}