import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';
import { BudgetsRepository } from './budgets.repository';
import { BudgetImportService } from './budget-import.service';
import { VeetiImportService } from './veeti-import.service';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetsRepository, BudgetImportService, VeetiImportService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
