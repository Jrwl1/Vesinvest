import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';

@Injectable()
export class AssetTypesRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId?: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.assetType.findMany({ where: { orgId: org } });
  }

  create(orgId: string, data: { code: string; name: string; defaultLifeYears?: number }) {
    const org = this.requireOrgId(orgId);
    return this.prisma.assetType.create({ data: { ...data, orgId: org } });
  }

  async update(
    orgId: string,
    id: string,
    data: { code?: string; name?: string; defaultLifeYears?: number },
  ) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.assetType.updateMany({
      where: { id, orgId: org },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Asset type not found');
    return this.prisma.assetType.findFirst({ where: { id, orgId: org } });
  }
}