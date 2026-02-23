import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { CreateRevenueDriverDto } from './dto/create-revenue-driver.dto';
import { UpdateRevenueDriverDto } from './dto/update-revenue-driver.dto';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('budgets')
export class BudgetsController {
  constructor(private readonly service: BudgetsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Get('sets')
  listSets(@Req() req: Request) {
    return this.service.listBudgetSets(req.orgId!);
  }

  @Get('sets/:batchId')
  getBudgetsByBatch(@Req() req: Request, @Param('batchId') batchId: string) {
    return this.service.getBudgetsByBatchId(req.orgId!, batchId);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateBudgetDto) {
    return this.service.create(req.orgId!, dto);
  }

  @Get(':id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.service.findById(req.orgId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBudgetDto) {
    return this.service.update(req.orgId!, id, dto);
  }

  @Delete(':id')
  delete(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(req.orgId!, id);
  }

  @Post(':id/rivit')
  createLine(@Req() req: Request, @Param('id') budgetId: string, @Body() dto: CreateBudgetLineDto) {
    return this.service.createLine(req.orgId!, budgetId, dto);
  }

  @Patch(':id/rivit/:riviId')
  updateLine(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Param('riviId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ) {
    return this.service.updateLine(req.orgId!, budgetId, lineId, dto);
  }

  @Patch(':id/rivit/:riviId/move')
  moveLine(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Param('riviId') lineId: string,
    @Body() body: { parentId?: string | null; sortOrder: number },
  ) {
    return this.service.moveLine(req.orgId!, budgetId, lineId, body);
  }

  @Delete(':id/rivit/:riviId')
  deleteLine(@Req() req: Request, @Param('id') budgetId: string, @Param('riviId') lineId: string) {
    return this.service.deleteLine(req.orgId!, budgetId, lineId);
  }

  @Post(':id/tuloajurit')
  createDriver(@Req() req: Request, @Param('id') budgetId: string, @Body() dto: CreateRevenueDriverDto) {
    return this.service.createDriver(req.orgId!, budgetId, dto);
  }

  @Patch(':id/tuloajurit/:ajuriId')
  updateDriver(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Param('ajuriId') driverId: string,
    @Body() dto: UpdateRevenueDriverDto,
  ) {
    return this.service.updateDriver(req.orgId!, budgetId, driverId, dto);
  }

  @Delete(':id/tuloajurit/:ajuriId')
  deleteDriver(@Req() req: Request, @Param('id') budgetId: string, @Param('ajuriId') driverId: string) {
    return this.service.deleteDriver(req.orgId!, budgetId, driverId);
  }

  @Patch(':id/valisummat/:valisummaId')
  updateValisummaSumma(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Param('valisummaId') valisummaId: string,
    @Body() body: { summa: number },
  ) {
    return this.service.updateValisummaSumma(req.orgId!, budgetId, valisummaId, body.summa);
  }

  @Post(':id/valisummat')
  setValisummat(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Body()
    body: {
      items: Array<{
        palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
        categoryKey: string;
        tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
        summa: number;
        label?: string;
        lahde?: string;
      }>;
    },
  ) {
    return this.service.setValisummat(req.orgId!, budgetId, body.items);
  }
}
