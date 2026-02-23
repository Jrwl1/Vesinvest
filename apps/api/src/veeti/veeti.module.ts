import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VeetiBudgetGenerator } from './veeti-budget-generator';
import { VeetiBenchmarkService } from './veeti-benchmark.service';
import { VeetiService } from './veeti.service';
import { VeetiSyncService } from './veeti-sync.service';

@Module({
  imports: [PrismaModule],
  providers: [
    VeetiService,
    VeetiSyncService,
    VeetiBudgetGenerator,
    VeetiBenchmarkService,
  ],
  exports: [
    VeetiService,
    VeetiSyncService,
    VeetiBudgetGenerator,
    VeetiBenchmarkService,
  ],
})
export class VeetiModule {}
