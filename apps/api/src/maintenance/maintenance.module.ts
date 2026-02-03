import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceRepository } from './maintenance.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanningScenariosModule } from '../planning-scenarios/planning-scenarios.module';

@Module({
  imports: [PrismaModule, PlanningScenariosModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService, MaintenanceRepository],
})
export class MaintenanceModule {}
