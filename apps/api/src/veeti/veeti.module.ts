import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VeetiBudgetGenerator } from './veeti-budget-generator';
import { VeetiBenchmarkService } from './veeti-benchmark.service';
import { VeetiEffectiveDataService } from './veeti-effective-data.service';
import { VeetiService } from './veeti.service';
import { VeetiSyncService } from './veeti-sync.service';
import { VeetiSanityService } from './veeti-sanity.service';

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
