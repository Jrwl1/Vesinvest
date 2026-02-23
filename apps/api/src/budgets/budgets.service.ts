import { Injectable } from '@nestjs/common';
import { BudgetsRepository } from './budgets.repository';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { CreateRevenueDriverDto } from './dto/create-revenue-driver.dto';
import { UpdateRevenueDriverDto } from './dto/update-revenue-driver.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly repo: BudgetsRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  listBudgetSets(orgId: string) {
    return this.repo.findBudgetSets(orgId);
  }

  getBudgetsByBatchId(orgId: string, batchId: string) {
    return this.repo.findBudgetsByBatchId(orgId, batchId);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  create(orgId: string, dto: CreateBudgetDto) {
    return this.repo.create(orgId, dto);
  }

  update(orgId: string, id: string, dto: UpdateBudgetDto) {
    return this.repo.update(orgId, id, dto);
  }

  delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }

  createLine(orgId: string, budgetId: string, dto: CreateBudgetLineDto) {
    return this.repo.createLine(orgId, budgetId, dto);
  }

  updateLine(orgId: string, budgetId: string, lineId: string, dto: UpdateBudgetLineDto) {
    return this.repo.updateLine(orgId, budgetId, lineId, dto);
  }

  moveLine(
    orgId: string,
    budgetId: string,
    lineId: string,
    dto: { parentId?: string | null; sortOrder: number },
  ) {
    return this.repo.moveLine(orgId, budgetId, lineId, dto);
  }

  deleteLine(orgId: string, budgetId: string, lineId: string) {
    return this.repo.deleteLine(orgId, budgetId, lineId);
  }

  createDriver(orgId: string, budgetId: string, dto: CreateRevenueDriverDto) {
    return this.repo.createDriver(orgId, budgetId, dto);
  }

  updateDriver(orgId: string, budgetId: string, driverId: string, dto: UpdateRevenueDriverDto) {
    return this.repo.updateDriver(orgId, budgetId, driverId, dto);
  }

  deleteDriver(orgId: string, budgetId: string, driverId: string) {
    return this.repo.deleteDriver(orgId, budgetId, driverId);
  }

  findValisummat(orgId: string, budgetId: string) {
    return this.repo.findValisummat(orgId, budgetId);
  }

  upsertValisumma(orgId: string, budgetId: string, data: Parameters<BudgetsRepository['upsertValisumma']>[2]) {
    return this.repo.upsertValisumma(orgId, budgetId, data);
  }

  upsertManyValisummat(orgId: string, budgetId: string, items: Parameters<BudgetsRepository['upsertManyValisummat']>[2]) {
    return this.repo.upsertManyValisummat(orgId, budgetId, items);
  }

  deleteValisummat(orgId: string, budgetId: string) {
    return this.repo.deleteValisummat(orgId, budgetId);
  }

  updateValisummaSumma(orgId: string, budgetId: string, valisummaId: string, summa: number) {
    return this.repo.updateValisummaSumma(orgId, budgetId, valisummaId, summa);
  }

  setValisummat(
    orgId: string,
    budgetId: string,
    items: Parameters<BudgetsRepository['upsertManyValisummat']>[2],
  ) {
    return this.repo.upsertManyValisummat(orgId, budgetId, items);
  }
}
