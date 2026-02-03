import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { SitesModule } from './sites/sites.module';
import { AssetTypesModule } from './asset-types/asset-types.module';
import { AssetsModule } from './assets/assets.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { PlanningScenariosModule } from './planning-scenarios/planning-scenarios.module';
import { ImportsModule } from './imports/imports.module';
import { MappingsModule } from './mappings/mappings.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    SitesModule,
    AssetTypesModule,
    AssetsModule,
    MaintenanceModule,
    PlanningScenariosModule,
    ImportsModule,
    MappingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}