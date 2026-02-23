import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectionsService } from './projections.service';
import { ProjectionsRepository } from './projections.repository';
import { ProjectionEngine } from './projection-engine.service';

@Module({
  imports: [PrismaModule],
  providers: [ProjectionsService, ProjectionsRepository, ProjectionEngine],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
