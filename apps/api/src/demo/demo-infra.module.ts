import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DemoBootstrapService } from './demo-bootstrap.service';
import { DemoResetService } from './demo-reset.service';
import { DemoStatusService } from './demo-status.service';

/**
 * Demo infrastructure module: Prisma-backed demo services only.
 *
 * This module breaks the circular dependency between DemoModule, TenantModule,
 * and AuthModule by depending ONLY on PrismaModule (and env/config). No
 * controllers, no auth, no tenant guards. TenantGuard and AuthModule's
 * DemoService import DemoInfraModule to get DemoBootstrapService; DemoModule
 * imports DemoInfraModule for the /demo HTTP endpoints. No module that
 * DemoInfraModule depends on (PrismaModule) imports DemoModule or AuthModule,
 * so the cycle is removed without using forwardRef.
 *
 * Marked @Global() so TenantGuard (used by many feature modules) can resolve
 * DemoBootstrapService in any module context without each module importing DemoInfraModule.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [DemoBootstrapService, DemoResetService, DemoStatusService],
  exports: [DemoBootstrapService, DemoResetService, DemoStatusService],
})
export class DemoInfraModule {}
