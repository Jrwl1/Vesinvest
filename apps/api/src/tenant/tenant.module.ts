import { Global,Module } from '@nestjs/common';
import { DemoInfraModule } from '../demo/demo-infra.module';
import { LegalModule } from '../legal/legal.module';
import { TrialModule } from '../trial/trial.module';
import { TenantGuard } from './tenant.guard';

/**
 * Provides TenantGuard for tenant-scoped controllers.
 * Guard uses DemoInfraModule (DemoBootstrapService) when DEMO_MODE is enabled — no cycle with DemoModule.
 */
@Global()
@Module({
  imports: [DemoInfraModule, LegalModule, TrialModule],
  providers: [TenantGuard],
  exports: [TenantGuard],
})
export class TenantModule {}
