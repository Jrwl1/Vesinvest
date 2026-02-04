import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { DemoInfraModule } from './demo-infra.module';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DemoStatusService } from './demo-status.service';
import { DemoController } from './demo.controller';
import { getDemoModeReason, DEMO_ORG_ID } from './demo.constants';

// Re-export for consumers that still import from demo.module (e.g. tests)
export { DEMO_ORG_ID, isDemoModeEnabled, getDemoModeReason } from './demo.constants';

/**
 * Demo Module - Thin shell for /demo HTTP endpoints and startup bootstrap.
 *
 * Imports only DemoInfraModule (Prisma + DemoBootstrapService, DemoResetService, DemoStatusService).
 * No dependency on AuthModule or TenantModule, so no circular dependency.
 */
@Module({
  imports: [DemoInfraModule],
  controllers: [DemoController],
  providers: [],
  exports: [],
})
export class DemoModule implements OnModuleInit {
  private readonly logger = new Logger(DemoModule.name);

  constructor(
    private readonly demoBootstrap: DemoBootstrapService,
    private readonly statusService: DemoStatusService,
  ) {}

  async onModuleInit() {
    const { enabled, reason } = getDemoModeReason();
    this.logger.warn(enabled ? `DEMO MODE ENABLED (${reason})` : `DEMO MODE DISABLED (${reason})`);

    if (enabled) {
      this.logger.warn(`  Using orgId = ${DEMO_ORG_ID}; no sites seeded.`);
      await this.demoBootstrap.ensureDemoOrg();
    }
  }
}
