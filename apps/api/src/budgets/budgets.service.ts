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

  // ── Talousarvio ──

  list(orgId: string) {
    return this.repo.findAll(orgId);
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

  // ── TalousarvioRivi ──

  createLine(orgId: string, budgetId: string, dto: CreateBudgetLineDto) {
    return this.repo.createLine(orgId, budgetId, dto);
  }

  updateLine(orgId: string, budgetId: string, lineId: string, dto: UpdateBudgetLineDto) {
    return this.repo.updateLine(orgId, budgetId, lineId, dto);
  }

  deleteLine(orgId: string, budgetId: string, lineId: string) {
    return this.repo.deleteLine(orgId, budgetId, lineId);
  }

  // ── Tuloajuri ──

  createDriver(orgId: string, budgetId: string, dto: CreateRevenueDriverDto) {
    return this.repo.createDriver(orgId, budgetId, dto);
  }

  updateDriver(orgId: string, budgetId: string, driverId: string, dto: UpdateRevenueDriverDto) {
    return this.repo.updateDriver(orgId, budgetId, driverId, dto);
  }

  deleteDriver(orgId: string, budgetId: string, driverId: string) {
    return this.repo.deleteDriver(orgId, budgetId, driverId);
  }
}
