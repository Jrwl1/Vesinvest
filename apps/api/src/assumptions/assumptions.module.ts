import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssumptionsController } from './assumptions.controller';
import { AssumptionsService } from './assumptions.service';
import { AssumptionsRepository } from './assumptions.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AssumptionsController],
  providers: [AssumptionsService, AssumptionsRepository],
  exports: [AssumptionsService],
})
export class AssumptionsModule {}
