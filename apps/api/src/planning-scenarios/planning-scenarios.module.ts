import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlanningScenariosController } from './planning-scenarios.controller';
import { PlanningScenariosService } from './planning-scenarios.service';
import { PlanningScenariosRepository } from './planning-scenarios.repository';

@Module({
  imports: [PrismaModule],
  controllers: [PlanningScenariosController],
  providers: [PlanningScenariosService, PlanningScenariosRepository],
  exports: [PlanningScenariosService],
})
export class PlanningScenariosModule {}
