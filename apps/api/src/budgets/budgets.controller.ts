import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  // ── Talousarvio (Budget) ──

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

  // ── TalousarvioRivi (Budget Line) ──

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

  // ── Tuloajuri (Revenue Driver) ──

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

  // ── TalousarvioValisumma ──

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

  // ── Budget Import ──

  /**
   * KVA-specific preview: parse KVA.xlsx without requiring a pre-existing budget.
   * Budget is created on confirm (POST /budgets/import/confirm-kva).
   */
  @Post('import/preview-kva')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = /\.(xlsx|xls)$/i;
      if (!allowed.test(file.originalname)) {
        cb(new BadRequestException('Only Excel files are allowed for KVA import'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  previewKva(
    @Req() req: Request,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.previewKva(req.orgId!, file.buffer, file.originalname);
  }

  /**
   * KVA confirm: create a named budget profile with all associated data in one transaction.
   * Body: { nimi, vuosi, subtotalLines, revenueDrivers, accountLines? }
   */
  @Post('import/confirm-kva')
  confirmKva(
    @Req() req: Request,
    @Body() body: {
      nimi: string;
      vuosi: number;
      extractedYears?: number[];
      importBatchId?: string;
      importSourceFileName?: string;
      reimportMode?: 'replace_imported_scope' | 'replace_all';
      importQuality?: {
        requiredMissing?: string[];
        fields?: Record<string, { status: 'explicit' | 'derived' | 'missing'; source: string; confidence: 'high' | 'medium' }>;
      };
      subtotalLines: Array<{
        palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
        categoryKey: string;
        tyyppi: 'tulo' | 'kulu' | 'poisto' | 'rahoitus_tulo' | 'rahoitus_kulu' | 'investointi' | 'tulos';
        summa: number;
        label?: string;
        lahde?: string;
      }>;
      revenueDrivers?: Array<{
        palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
        yksikkohinta: number;
        myytyMaara: number;
        perusmaksu?: number;
        liittymamaara?: number;
        alvProsentti?: number;
        sourceMeta?: Record<string, unknown>;
      }>;
      driverOverrides?: Array<{
        palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
        yksikkohinta?: number;
        myytyMaara?: number;
        perusmaksu?: number;
        liittymamaara?: number;
        alvProsentti?: number;
        sourceMeta?: Record<string, unknown>;
      }>;
      accountLines?: Array<{
        tiliryhma: string;
        nimi: string;
        tyyppi: 'kulu' | 'tulo' | 'investointi';
        summa: number;
        muistiinpanot?: string;
      }>;
    },
  ) {
    return this.service.confirmKvaImport(req.orgId!, body);
  }

  /**
   * Parse an uploaded CSV/Excel file and return a preview of detected budget lines.
   * Does NOT persist anything — use POST /budgets/:id/import/confirm to apply.
   */
  @Post(':id/import/preview')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (_req: any, file: any, cb: any) => {
      const allowed = /\.(csv|txt|xlsx|xls)$/i;
      if (!allowed.test(file.originalname)) {
        cb(new BadRequestException('Only CSV and Excel files are allowed'), false);
      } else {
        cb(null, true);
      }
    },
  }))
  importPreview(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.importPreview(req.orgId!, budgetId, file.buffer, file.originalname);
  }

  /**
   * Confirm import: create budget lines from previously previewed data.
   * Body: rows (from preview); optional revenueDrivers (KVA) to upsert Tuloajuri by palvelutyyppi.
   */
  @Post(':id/import/confirm')
  importConfirm(
    @Req() req: Request,
    @Param('id') budgetId: string,
    @Body()
    body: {
      rows: Array<{ tiliryhma: string; nimi: string; tyyppi: string; summa: number; muistiinpanot?: string }>;
      revenueDrivers?: Array<{
        palvelutyyppi: 'vesi' | 'jatevesi' | 'muu';
        yksikkohinta?: number;
        myytyMaara?: number;
        perusmaksu?: number;
        liittymamaara?: number;
        alvProsentti?: number;
        sourceMeta?: Record<string, unknown>;
      }>;
    },
  ) {
    return this.service.importConfirm(req.orgId!, budgetId, body.rows, body.revenueDrivers);
  }
}
