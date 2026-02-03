import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

const DEMO_ORG_SLUG = 'plan20-demo';
const DEMO_ORG_NAME = 'Plan20 Demo';
const DEMO_USER_EMAIL = 'admin@plan20.dev';
const DEMO_USER_PASSWORD = 'devpassword';
const DEMO_ROLE_NAME = 'ADMIN';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent demo bootstrap: upserts org, user, role, site, asset type, asset, maintenance item.
   * Returns the org ID and user ID for token issuance.
   */
  async bootstrapDemo(): Promise<{ userId: string; orgId: string; roles: string[] }> {
    this.logger.log('Bootstrapping demo data...');

    // 1. Upsert Organization
    const org = await this.prisma.organization.upsert({
      where: { slug: DEMO_ORG_SLUG },
      update: { name: DEMO_ORG_NAME },
      create: { slug: DEMO_ORG_SLUG, name: DEMO_ORG_NAME },
    });
    this.logger.log(`Org: ${org.id}`);

    // 2. Upsert Role
    const role = await this.prisma.role.upsert({
      where: { name: DEMO_ROLE_NAME },
      update: {},
      create: { name: DEMO_ROLE_NAME },
    });
    this.logger.log(`Role: ${role.id}`);

    // 3. Upsert User
    const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: { password: passwordHash },
      create: { email: DEMO_USER_EMAIL, password: passwordHash },
    });
    this.logger.log(`User: ${user.id}`);

    // 4. Upsert UserRole (assign user to org with role)
    await this.prisma.userRole.upsert({
      where: {
        user_id_role_id_org_id: {
          user_id: user.id,
          role_id: role.id,
          org_id: org.id,
        },
      },
      update: {},
      create: {
        user_id: user.id,
        role_id: role.id,
        org_id: org.id,
      },
    });

    // 5. Upsert Site
    let site = await this.prisma.site.findFirst({
      where: { orgId: org.id, name: 'Main Plant' },
    });
    if (!site) {
      site = await this.prisma.site.create({
        data: { orgId: org.id, name: 'Main Plant' },
      });
    }
    this.logger.log(`Site: ${site.id}`);

    // 6. Upsert AssetType
    const assetType = await this.prisma.assetType.upsert({
      where: { orgId_code: { orgId: org.id, code: 'PUMP' } },
      update: { name: 'Pump', defaultLifeYears: 10 },
      create: { orgId: org.id, code: 'PUMP', name: 'Pump', defaultLifeYears: 10 },
    });
    this.logger.log(`AssetType: ${assetType.id}`);

    // 7. Upsert Asset
    let asset = await this.prisma.asset.findFirst({
      where: { orgId: org.id, name: 'Pump A1' },
    });
    if (!asset) {
      asset = await this.prisma.asset.create({
        data: {
          orgId: org.id,
          siteId: site.id,
          assetTypeId: assetType.id,
          externalRef: 'PUMP-A1-001', // Per Asset Identity Contract
          name: 'Pump A1',
          installedOn: new Date('2018-01-01'),
          replacementCostEur: 15000,
          criticality: 'high',
          status: 'active',
        },
      });
    }
    this.logger.log(`Asset: ${asset.id}`);

    // 8. Upsert MaintenanceItem
    const currentYear = new Date().getFullYear();
    let maintenanceItem = await this.prisma.maintenanceItem.findFirst({
      where: { orgId: org.id, assetId: asset.id, kind: 'MAINTENANCE' },
    });
    if (!maintenanceItem) {
      maintenanceItem = await this.prisma.maintenanceItem.create({
        data: {
          orgId: org.id,
          assetId: asset.id,
          kind: 'MAINTENANCE',
          intervalYears: 1,
          costEur: 500,
          startsAtYear: currentYear,
        },
      });
    }
    this.logger.log(`MaintenanceItem: ${maintenanceItem.id}`);

    this.logger.log('Demo bootstrap complete');

    return {
      userId: user.id,
      orgId: org.id,
      roles: [DEMO_ROLE_NAME],
    };
  }
}
