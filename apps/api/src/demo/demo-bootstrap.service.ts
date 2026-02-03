import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_ORG_ID } from './demo.module';

/**
 * Service to bootstrap demo data when DEMO_MODE is enabled.
 * Creates deterministic demo organization and minimal seed data.
 */
@Injectable()
export class DemoBootstrapService {
  private readonly logger = new Logger(DemoBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ensure demo organization exists with deterministic ID.
   * Idempotent - safe to call multiple times.
   */
  async ensureDemoOrg(): Promise<void> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { id: DEMO_ORG_ID },
    });

    if (existingOrg) {
      this.logger.log(`Demo org already exists: ${DEMO_ORG_ID}`);
      return;
    }

    // Create demo organization
    const org = await this.prisma.organization.create({
      data: {
        id: DEMO_ORG_ID,
        name: 'Demo Water Utility',
        slug: 'demo',
      },
    });

    this.logger.log(`Created demo org: ${org.id} (${org.name})`);

    // NOTE: No default site is created per Site Handling Contract.
    // Sites must be created manually or resolved during import.
    // Demo mode follows the exact same rules as production.

    // Create some default asset types
    const assetTypes = [
      { id: 'demo-type-pump', code: 'PUMP', name: 'Pump', defaultLifeYears: 15 },
      { id: 'demo-type-valve', code: 'VALVE', name: 'Valve', defaultLifeYears: 25 },
      { id: 'demo-type-pipe', code: 'PIPE', name: 'Pipe', defaultLifeYears: 50 },
      { id: 'demo-type-meter', code: 'METER', name: 'Water Meter', defaultLifeYears: 10 },
    ];

    for (const at of assetTypes) {
      await this.prisma.assetType.upsert({
        where: { id: at.id },
        update: {},
        create: {
          id: at.id,
          orgId: DEMO_ORG_ID,
          code: at.code,
          name: at.name,
          defaultLifeYears: at.defaultLifeYears,
        },
      });
    }

    this.logger.log(`Demo asset types ready: ${assetTypes.length} types`);
  }
}
