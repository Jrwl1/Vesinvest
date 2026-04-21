import { Logger,Module,OnModuleInit } from '@nestjs/common';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DemoInfraModule } from './demo-infra.module';
import { DemoStatusService } from './demo-status.service';
import { DEMO_ORG_ID,getDemoModeReason } from './demo.constants';
import { DemoController } from './demo.controller';

// Re-export for consumers that still import from demo.module (e.g. tests)
export { DEMO_ORG_ID,getDemoModeReason,isDemoModeEnabled } from './demo.constants';

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
