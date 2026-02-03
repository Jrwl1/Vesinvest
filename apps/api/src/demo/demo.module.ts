import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DemoResetService } from './demo-reset.service';
import { DemoController } from './demo.controller';

/**
 * Demo Module - Handles DEMO_MODE initialization and configuration.
 * 
 * When DEMO_MODE=true:
 * - Upserts a deterministic demo Organization on startup
 * - Logs warning about disabled authentication
 * - Provides DEMO_ORG_ID constant for use in guards
 * - Exposes /demo/reset endpoint to clear demo data
 * 
 * Per Site Handling Contract: No sites are seeded in demo mode.
 */
@Module({
  imports: [PrismaModule],
  controllers: [DemoController],
  providers: [DemoBootstrapService, DemoResetService],
  exports: [DemoBootstrapService, DemoResetService],
})
export class DemoModule implements OnModuleInit {
  private readonly logger = new Logger(DemoModule.name);

  constructor(private readonly demoBootstrap: DemoBootstrapService) {}

  async onModuleInit() {
    if (isDemoModeEnabled()) {
      this.logger.warn('========================================');
      this.logger.warn('  DEMO MODE ENABLED');
      this.logger.warn('  Authentication is DISABLED');
      this.logger.warn(`  Using orgId = ${DEMO_ORG_ID}`);
      this.logger.warn('  DEMO MODE: no sites are seeded');
      this.logger.warn('========================================');
      
      await this.demoBootstrap.ensureDemoOrg();
    }
  }
}

/**
 * Deterministic demo organization ID.
 * Used when DEMO_MODE=true to bypass auth.
 */
export const DEMO_ORG_ID = 'demo-org-00000000-0000-0000-0000-000000000001';

/**
 * Check if demo mode is enabled via environment variable.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === 'true';
}
