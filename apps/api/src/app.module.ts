import { Module } from '@nestjs/common';
import { AppModeModule } from './app-mode/app-mode.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DemoModule } from './demo/demo.module';
import { HealthModule } from './health/health.module';
import { LegalModule } from './legal/legal.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { TrialModule } from './trial/trial.module';
// V2 API dependencies
import { ProjectionsModule } from './projections/projections.module';
import { V2Module } from './v2/v2.module';
import { VeetiModule } from './veeti/veeti.module';

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
    // V2 API dependencies
    ProjectionsModule,
    VeetiModule,
    V2Module,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
