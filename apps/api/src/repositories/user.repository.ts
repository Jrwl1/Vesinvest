import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from './base.repository';

@Injectable()
export class UserRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByEmailInOrg(email: string, orgId?: string) {
    const tenantId = this.requireOrgId(orgId);
    return this.prisma.user.findFirst({
      where: {
        email,
        roles: { some: { org_id: tenantId } },
      },
      include: { roles: { include: { role: true, org: true } } },
    });
  }
}