import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { MaintenanceKind } from '@prisma/client';

@Injectable()
export class MaintenanceRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(
    orgId?: string,
    filters?: { assetId?: string; siteId?: string; kind?: MaintenanceKind },
  ) {
    const org = this.requireOrgId(orgId);
    return this.prisma.maintenanceItem.findMany({
      where: {
        orgId: org,
        ...(filters?.assetId ? { assetId: filters.assetId } : {}),
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.siteId ? { asset: { siteId: filters.siteId } } : {}),
      },
      include: { asset: true },
    });
  }

  create(orgId: string, data: any) {
    const org = this.requireOrgId(orgId);
    return this.prisma.maintenanceItem.create({
      data: { ...data, orgId: org },
    });
  }

  async update(orgId: string, id: string, data: any) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.maintenanceItem.updateMany({
      where: { id, orgId: org },
      data,
    });
    if (result.count === 0) throw new NotFoundException('Maintenance item not found');

    return this.prisma.maintenanceItem.findFirst({
      where: { id, orgId: org },
    });
  }
}