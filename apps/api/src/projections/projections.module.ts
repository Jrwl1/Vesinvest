import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectionEngine } from './projection-engine.service';
import { ProjectionsRepository } from './projections.repository';
import { ProjectionsService } from './projections.service';

@Module({
  imports: [PrismaModule],
  providers: [ProjectionsService, ProjectionsRepository, ProjectionEngine],
  exports: [ProjectionsService],
})
export class ProjectionsModule {}
