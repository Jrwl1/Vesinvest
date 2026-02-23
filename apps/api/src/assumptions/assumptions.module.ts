import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssumptionsService } from './assumptions.service';
import { AssumptionsRepository } from './assumptions.repository';

@Module({
  imports: [PrismaModule],
  providers: [AssumptionsService, AssumptionsRepository],
  exports: [AssumptionsService],
})
export class AssumptionsModule {}
