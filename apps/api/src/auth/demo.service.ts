import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { DemoBootstrapService } from '../demo/demo-bootstrap.service';
import { DEMO_ORG_ID, isDemoModeEnabled } from '../demo/demo.constants';

const DEMO_USER_EMAIL = 'admin@vesipolku.dev';
const DEMO_USER_PASSWORD = 'devpassword';
const DEMO_ROLE_NAME = 'ADMIN';

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly demoBootstrap: DemoBootstrapService,
  ) {}

  /**
   * Idempotent: ensure UserRole link exists (composite unique user_id, role_id, org_id).
   * Uses findUnique + create to avoid upsert unique-constraint failures on repeated/concurrent calls.
   */
  private async ensureUserRole(
    userId: string,
    roleId: string,
    orgId: string,
  ): Promise<void> {
    const existing = await this.prisma.userRole.findUnique({
      where: {
        user_id_role_id_org_id: {
          user_id: userId,
          role_id: roleId,
          org_id: orgId,
        },
      },
    });
    if (existing) return;
    await this.prisma.userRole.create({
      data: {
        user_id: userId,
        role_id: roleId,
        org_id: orgId,
      },
    });
  }

  /**
   * Idempotent demo bootstrap: upserts org, user, role, and asset types.
   * When DEMO_MODE=true uses DEMO_ORG_ID so token org matches TenantGuard.
   *
   * NOTE: Per Site Handling Contract, no default site or assets are created.
   */
  async bootstrapDemo(): Promise<{
    userId: string;
    orgId: string;
    roles: string[];
  }> {
    this.logger.log('Bootstrapping demo data...');

    if (!isDemoModeEnabled()) {
      throw new Error('Demo bootstrap is only available in internal demo mode');
    }

    await this.demoBootstrap.ensureDemoOrg(); // org only; no budgets/projections/assumptions
    const orgId = DEMO_ORG_ID;
    const role = await this.prisma.role.upsert({
      where: { name: DEMO_ROLE_NAME },
      update: {},
      create: { name: DEMO_ROLE_NAME },
    });
    const passwordHash = await bcrypt.hash(DEMO_USER_PASSWORD, 10);
    const user = await this.prisma.user.upsert({
      where: { email: DEMO_USER_EMAIL },
      update: { password: passwordHash },
      create: { email: DEMO_USER_EMAIL, password: passwordHash },
    });
    await this.ensureUserRole(user.id, role.id, orgId);
    this.logger.log(`Demo bootstrap complete (org=${orgId})`);

    return {
      userId: user.id,
      orgId,
      roles: [DEMO_ROLE_NAME],
    };
  }
}
