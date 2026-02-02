import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { AssetStatus } from '@prisma/client';

@Injectable()
export class AssetsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId?: string, filters?: { siteId?: string; assetTypeId?: string; status?: AssetStatus; q?: string }) {
    const org = this.requireOrgId(orgId);
    const where: any = {
      orgId: org,
      ...(filters?.siteId ? { siteId: filters.siteId } : {}),
      ...(filters?.assetTypeId ? { assetTypeId: filters.assetTypeId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    };

    if (filters?.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { externalRef: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.asset.findMany({
      where,
      include: { assetType: true, site: true },
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.asset.findFirst({
      where: { id, orgId: org },
      include: { assetType: true, site: true },
    });
  }

  create(orgId: string, data: any) {
    const org = this.requireOrgId(orgId);
    return this.prisma.asset.create({
      data: { ...data, orgId: org },
      include: { assetType: true, site: true },
    });
  }

  async update(orgId: string, id: string, data: any) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.asset.updateMany({
      where: { id, orgId: org },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Asset not found');
    return this.prisma.asset.findFirst({
      where: { id, orgId: org },
      include: { assetType: true, site: true },
    });
  }
}