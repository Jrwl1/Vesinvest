import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request,Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CreatePlanningBaselineDto } from './dto/create-planning-baseline.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import {
  CreateDepreciationRuleDto,
  UpdateDepreciationRuleDto,
} from './dto/depreciation-rules.dto';
import { ImportClearDto } from './dto/import-clear.dto';
import { ImportConnectDto } from './dto/import-connect.dto';
import { ImportSearchQueryDto } from './dto/import-search-query.dto';
import { ImportSyncDto } from './dto/import-sync.dto';
import { ImportYearReconcileDto } from './dto/import-year-reconcile.dto';
import { ImportYearsBulkDto } from './dto/import-years-bulk.dto';
import { ImportYearsDto } from './dto/import-years.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ManualYearCompletionDto } from './dto/manual-year-completion.dto';
import { OpsEventDto } from './dto/ops-event.dto';
import { RefreshPeerDto } from './dto/refresh-peer.dto';
import { UpdateScenarioClassAllocationsDto } from './dto/scenario-class-allocations.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { UpdateVesinvestGroupDto } from './dto/vesinvest-group.dto';
import {
  CreateVesinvestPlanDto,
  SyncVesinvestPlanDto,
  UpdateVesinvestPlanDto,
} from './dto/vesinvest-plan.dto';
import { V2Service } from './v2.service';

const WORKBOOK_PREVIEW_MAX_BYTES = 5 * 1024 * 1024;
const STATEMENT_PREVIEW_MAX_BYTES = 10 * 1024 * 1024;
const v2ValidationPipeOptions = {
  transform: true,
  whitelist: true,
} as const;

function rejectMultipleFileUploads(
  _req: Request,
  file: { fieldname: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  if (file.fieldname !== 'file') {
    callback(
      new BadRequestException('Only a single file upload is supported.'),
      false,
    );
    return;
  }
  callback(null, true);
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('v2')
export class V2Controller {
  constructor(private readonly service: V2Service) {}

  private ensureDepreciationFeatureEnabled() {
    if (process.env.V2_DEPRECIATION_RULES_ENABLED === 'false') {
      throw new ServiceUnavailableException(
        'Depreciation rules feature is disabled by rollout flag.',
      );
    }
  }

  @Get('overview')
  async overview(@Req() req: Request) {
    return this.service.getOverview(req.orgId!);
  }

  @Get('context')
  async context(@Req() req: Request) {
    return this.service.getPlanningContext(req.orgId!);
  }

  @Post('overview/peer-refresh')
  async refreshPeer(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: RefreshPeerDto,
  ) {
    return this.service.refreshPeerSnapshot(req.orgId!, body?.vuosi);
  }

  @Get('import/search')
  async importSearch(
    @Query(new ValidationPipe(v2ValidationPipeOptions))
    query: ImportSearchQueryDto,
  ) {
    return this.service.searchOrganizations(query.q ?? '', query.limit ?? 20);
  }

  @Post('import/connect')
  async importConnect(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportConnectDto,
  ) {
    return this.service.connectOrganization(req.orgId!, body.veetiId);
  }

  @Post('import/sync')
  async importSync(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportSyncDto,
  ) {
    return this.service.syncImport(req.orgId!, body?.years ?? []);
  }

  @Post('import/years/import')
  async importYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsDto,
  ) {
    return this.service.importYears(req.orgId!, body?.years ?? []);
  }

  @Post('import/planning-baseline')
  async createPlanningBaseline(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: CreatePlanningBaselineDto,
  ) {
    return this.service.createPlanningBaseline(req.orgId!, body?.years ?? []);
  }

  @Get('import/status')
  async importStatus(@Req() req: Request) {
    return this.service.getImportStatus(req.orgId!);
  }

  @Delete('import/years/:year')
  async importRemoveYear(
    @Req() req: Request,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.removeImportedYear(req.orgId!, year);
  }

  @Post('import/years/bulk-delete')
  async importBulkDeleteYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsBulkDto,
  ) {
    return this.service.removeImportedYears(req.orgId!, body.years);
  }

  @Post('import/years/exclude')
  async importExcludeYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsBulkDto,
  ) {
    return this.service.excludeImportedYears(req.orgId!, body.years);
  }

  @Post('import/years/restore')
  async importRestoreYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsBulkDto,
  ) {
    return this.service.restoreImportedYears(req.orgId!, body.years);
  }

  @Get('import/years/:year/data')
  async importYearData(
    @Req() req: Request,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.getImportYearData(req.orgId!, year);
  }

  @Post('import/workbook-preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: WORKBOOK_PREVIEW_MAX_BYTES,
      },
      fileFilter: rejectMultipleFileUploads,
    }),
  )
  async previewWorkbookImport(
    @Req() req: Request,
    @UploadedFile()
    file?: {
      originalname?: string;
      mimetype?: string;
      size?: number;
      buffer?: Buffer;
    },
  ) {
    return this.service.previewWorkbookImport(req.orgId!, {
      fileName: file?.originalname ?? null,
      contentType: file?.mimetype ?? null,
      sizeBytes: file?.size ?? 0,
      fileBuffer: file?.buffer ?? null,
    });
  }

  @Post('import/years/:year/statement-preview')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: STATEMENT_PREVIEW_MAX_BYTES,
      },
      fileFilter: rejectMultipleFileUploads,
    }),
  )
  async previewStatementImport(
    @Req() req: Request,
    @Param('year', ParseIntPipe) year: number,
    @UploadedFile()
    file?: {
      originalname?: string;
      mimetype?: string;
      size?: number;
      buffer?: Buffer;
    },
    @Body('statementType') statementType?: string,
  ) {
    return this.service.previewStatementImport(req.orgId!, year, {
      fileName: file?.originalname ?? null,
      contentType: file?.mimetype ?? null,
      sizeBytes: file?.size ?? 0,
      fileBuffer: file?.buffer ?? null,
      statementType,
    });
  }

  @Post('import/years/:year/reconcile')
  async reconcileImportYear(
    @Req() req: Request,
    @Param('year', ParseIntPipe) year: number,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: ImportYearReconcileDto,
  ) {
    const user = req.user as { sub?: string; roles?: string[] };
    return this.service.reconcileImportYear(
      req.orgId!,
      user?.sub ?? '',
      user?.roles ?? [],
      year,
      body,
    );
  }

  @Post('import/clear')
  async clearImportAndScenarios(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportClearDto,
  ) {
    const user = req.user as { roles?: string[] };
    // Destructive org-level reset path used by the V2 account drawer.
    return this.service.clearImportAndScenarios(
      req.orgId!,
      user?.roles ?? [],
      body?.confirmToken,
    );
  }

  @Post('import/manual-year')
  async completeImportYearManually(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: ManualYearCompletionDto,
  ) {
    const user = req.user as { sub?: string; roles?: string[] };
    return this.service.completeImportYearManually(
      req.orgId!,
      user?.sub ?? '',
      user?.roles ?? [],
      body,
    );
  }

  @Post('ops/events')
  async trackOpsEvent(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: OpsEventDto,
  ) {
    const user = req.user as { sub?: string; roles?: string[] };
    return this.service.trackOpsEvent(
      req.orgId!,
      user?.sub ?? 'unknown',
      user?.roles ?? [],
      body,
    );
  }

  @Get('ops/funnel')
  async getOpsFunnel(@Req() req: Request) {
    const user = req.user as { roles?: string[] };
    return this.service.getOpsFunnel(req.orgId!, user?.roles ?? []);
  }

  @Get('vesinvest/groups')
  async listVesinvestGroups(@Req() req: Request) {
    return this.service.getInvestmentGroupDefinitions(req.orgId!);
  }

  @Patch('vesinvest/groups/:key')
  async updateVesinvestGroup(
    @Req() req: Request,
    @Param('key') key: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateVesinvestGroupDto,
  ) {
    const user = req.user as { roles?: string[] };
    return this.service.updateInvestmentGroupDefinition(
      req.orgId!,
      key,
      body,
      user?.roles ?? [],
    );
  }

  @Get('vesinvest/plans')
  async listVesinvestPlans(@Req() req: Request) {
    return this.service.listVesinvestPlans(req.orgId!);
  }

  @Post('vesinvest/plans')
  async createVesinvestPlan(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: CreateVesinvestPlanDto,
  ) {
    return this.service.createVesinvestPlan(req.orgId!, body);
  }

  @Get('vesinvest/plans/:id')
  async getVesinvestPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.getVesinvestPlan(req.orgId!, id);
  }

  @Patch('vesinvest/plans/:id')
  async updateVesinvestPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateVesinvestPlanDto,
  ) {
    return this.service.updateVesinvestPlan(req.orgId!, id, body);
  }

  @Post('vesinvest/plans/:id/clone')
  async cloneVesinvestPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.cloneVesinvestPlan(req.orgId!, id);
  }

  @Post('vesinvest/plans/:id/forecast-sync')
  async syncVesinvestPlanToForecast(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: SyncVesinvestPlanDto,
  ) {
    return this.service.syncVesinvestPlanToForecast(req.orgId!, id, body);
  }

  @Get('forecast/scenarios')
  async listScenarios(@Req() req: Request) {
    return this.service.listForecastScenarios(req.orgId!);
  }

  @Get('forecast/depreciation-rules')
  async listDepreciationRules(@Req() req: Request) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.listDepreciationRules(req.orgId!);
  }

  @Post('forecast/depreciation-rules')
  async createDepreciationRule(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: CreateDepreciationRuleDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.createDepreciationRule(req.orgId!, body);
  }

  @Patch('forecast/depreciation-rules/:id')
  async updateDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateDepreciationRuleDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.updateDepreciationRule(req.orgId!, id, body);
  }

  @Delete('forecast/depreciation-rules/:id')
  async deleteDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.deleteDepreciationRule(req.orgId!, id);
  }

  @Get('forecast/scenarios/:id/depreciation-rules')
  async listScenarioDepreciationRules(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.listScenarioDepreciationRules(req.orgId!, id);
  }

  @Post('forecast/scenarios/:id/depreciation-rules')
  async createScenarioDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: CreateDepreciationRuleDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.createScenarioDepreciationRule(req.orgId!, id, body);
  }

  @Patch('forecast/scenarios/:id/depreciation-rules/:ruleId')
  async updateScenarioDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('ruleId') ruleId: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateDepreciationRuleDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.updateScenarioDepreciationRule(
      req.orgId!,
      id,
      ruleId,
      body,
    );
  }

  @Delete('forecast/scenarios/:id/depreciation-rules/:ruleId')
  async deleteScenarioDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('ruleId') ruleId: string,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.deleteScenarioDepreciationRule(req.orgId!, id, ruleId);
  }

  @Post('forecast/scenarios')
  async createScenario(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: CreateScenarioDto,
  ) {
    return this.service.createForecastScenario(req.orgId!, body);
  }

  @Get('forecast/scenarios/:id')
  async getScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.getForecastScenario(req.orgId!, id);
  }

  @Get('forecast/scenarios/:id/class-allocations')
  async getScenarioClassAllocations(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.getScenarioClassAllocations(req.orgId!, id);
  }

  @Put('forecast/scenarios/:id/class-allocations')
  async putScenarioClassAllocations(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateScenarioClassAllocationsDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.updateScenarioClassAllocations(req.orgId!, id, body);
  }

  @Patch('forecast/scenarios/:id')
  async patchScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: UpdateScenarioDto,
  ) {
    return this.service.updateForecastScenario(req.orgId!, id, body);
  }

  @Delete('forecast/scenarios/:id')
  async deleteScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.deleteForecastScenario(req.orgId!, id);
  }

  @Post('forecast/scenarios/:id/compute')
  async computeScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.computeForecastScenario(req.orgId!, id);
  }

  @Get('reports')
  async listReports(
    @Req() req: Request,
    @Query(new ValidationPipe(v2ValidationPipeOptions))
    query: ListReportsQueryDto,
  ) {
    return this.service.listReports(req.orgId!, query.ennusteId);
  }

  @Post('reports')
  async createReport(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: CreateReportDto,
  ) {
    const user = req.user as { sub?: string };
    return this.service.createReport(req.orgId!, user?.sub ?? '', body);
  }

  @Get('reports/:id')
  async getReport(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.getReport(req.orgId!, id);
  }

  @Get('reports/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async getReportPdf(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.buildReportPdf(req.orgId!, id);
    const report = await this.service.getReport(req.orgId!, id);
    const safeTitle = report.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}.pdf"`,
    );
    res.send(pdf);
  }
}
