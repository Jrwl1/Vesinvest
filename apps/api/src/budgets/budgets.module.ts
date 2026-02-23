import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './budgets.repository';

@Module({
  imports: [PrismaModule],
  providers: [BudgetsService, BudgetsRepository],
  exports: [BudgetsService],
})
export class BudgetsModule {}
