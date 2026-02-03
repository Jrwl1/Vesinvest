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
   * Idempotent demo bootstrap: upserts org, user, role, and asset types.
   * 
   * NOTE: Per Site Handling Contract, no default site or assets are created.
   * Demo mode follows the exact same rules as production:
   * - Sites must be created manually or resolved during import
   * - No auto-created or hardcoded default sites
   * 
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

    // 5. Upsert AssetTypes (foundational reference data)
    const assetTypes = [
      { code: 'PUMP', name: 'Pump', defaultLifeYears: 15 },
      { code: 'VALVE', name: 'Valve', defaultLifeYears: 25 },
      { code: 'PIPE', name: 'Pipe', defaultLifeYears: 50 },
      { code: 'METER', name: 'Water Meter', defaultLifeYears: 10 },
    ];

    for (const at of assetTypes) {
      await this.prisma.assetType.upsert({
        where: { orgId_code: { orgId: org.id, code: at.code } },
        update: { name: at.name, defaultLifeYears: at.defaultLifeYears },
        create: { orgId: org.id, code: at.code, name: at.name, defaultLifeYears: at.defaultLifeYears },
      });
    }
    this.logger.log(`AssetTypes: ${assetTypes.length} types ready`);

    // NOTE: Sites, Assets, and MaintenanceItems are NOT auto-created.
    // Per Site Handling Contract, these must be created via import or manually.

    this.logger.log('Demo bootstrap complete');

    return {
      userId: user.id,
      orgId: org.id,
      roles: [DEMO_ROLE_NAME],
    };
  }
}
