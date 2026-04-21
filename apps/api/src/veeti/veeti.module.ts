import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VeetiBenchmarkService } from './veeti-benchmark.service';
import { VeetiBudgetGenerator } from './veeti-budget-generator';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiSanityService } from './veeti-sanity.service';
import { VeetiSyncService } from './veeti-sync.service';
import { VeetiService } from './veeti.service';

@Module({
  imports: [PrismaModule],
  providers: [
    VeetiService,
    VeetiEffectiveDataService,
    VeetiSyncService,
    VeetiBudgetGenerator,
    VeetiBenchmarkService,
    VeetiSanityService,
  ],
  exports: [
    VeetiService,
    VeetiEffectiveDataService,
    VeetiSyncService,
    VeetiBudgetGenerator,
    VeetiBenchmarkService,
    VeetiSanityService,
  ],
})
export class VeetiModule {}
