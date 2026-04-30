import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectionsModule } from '../projections/projections.module';
import { VeetiModule } from '../veeti/veeti.module';
import { V2ForecastService } from './v2-forecast.service';
import { V2ImportOverviewService } from './v2-import-overview.service';
import { V2ReportService } from './v2-report.service';
import { V2AdminGuard, V2EditorGuard } from './v2-role-access.guard';
import { V2TariffPlanService } from './v2-tariff-plan.service';
import { V2VesinvestService } from './v2-vesinvest.service';
import { V2Controller } from './v2.controller';
import { V2Service } from './v2.service';

@Module({
  imports: [PrismaModule, ProjectionsModule, VeetiModule],
  controllers: [V2Controller],
  providers: [
    V2ImportOverviewService,
    V2ForecastService,
    V2ReportService,
    V2TariffPlanService,
    V2VesinvestService,
    V2AdminGuard,
    V2EditorGuard,
    V2Service,
  ],
})
export class V2Module {}
