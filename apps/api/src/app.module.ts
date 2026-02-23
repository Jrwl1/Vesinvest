import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppModeModule } from './app-mode/app-mode.module';
import { AuthModule } from './auth/auth.module';
import { DemoModule } from './demo/demo.module';
import { TenantModule } from './tenant/tenant.module';
import { HealthModule } from './health/health.module';
import { LegalModule } from './legal/legal.module';
import { TrialModule } from './trial/trial.module';
// VA Budget modules (new)
import { BudgetsModule } from './budgets/budgets.module';
import { AssumptionsModule } from './assumptions/assumptions.module';
import { ProjectionsModule } from './projections/projections.module';
import { VeetiModule } from './veeti/veeti.module';
import { V2Module } from './v2/v2.module';

@Module({
  imports: [
    PrismaModule,
    AppModeModule,
    DemoModule, // Must be early to bootstrap demo org before other modules
    TenantModule, // TenantGuard (uses DemoBootstrapService in demo mode)
    AuthModule,
    LegalModule,
    TrialModule,
    HealthModule,
    // VA Budget modules
    BudgetsModule,
    AssumptionsModule,
    ProjectionsModule,
    VeetiModule,
    V2Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

