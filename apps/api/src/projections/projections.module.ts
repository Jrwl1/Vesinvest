import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectionsController } from './projections.controller';
import { ProjectionsService } from './projections.service';
import { ProjectionsRepository } from './projections.repository';
import { ProjectionEngine } from './projection-engine.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectionsController],
  providers: [ProjectionsService, ProjectionsRepository, ProjectionEngine],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
