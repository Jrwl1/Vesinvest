import { Global, Module } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { DemoInfraModule } from '../demo/demo-infra.module';

/**
 * Provides TenantGuard for tenant-scoped controllers.
 * Guard uses DemoInfraModule (DemoBootstrapService) when DEMO_MODE is enabled — no cycle with DemoModule.
 */
@Global()
@Module({
  imports: [DemoInfraModule],
  providers: [TenantGuard],
  exports: [TenantGuard],
})
export class TenantModule {}
