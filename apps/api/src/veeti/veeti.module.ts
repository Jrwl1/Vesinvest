import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BenchmarkController, VeetiController } from './veeti.controller';
import { VeetiBudgetGenerator } from './veeti-budget-generator';
import { VeetiBenchmarkService } from './veeti-benchmark.service';
import { VeetiService } from './veeti.service';
import { VeetiSyncService } from './veeti-sync.service';

@Module({
  imports: [PrismaModule],
  controllers: [VeetiController, BenchmarkController],
  providers: [VeetiService, VeetiSyncService, VeetiBudgetGenerator, VeetiBenchmarkService],
  exports: [VeetiService, VeetiSyncService, VeetiBudgetGenerator, VeetiBenchmarkService],
})
export class VeetiModule {}

