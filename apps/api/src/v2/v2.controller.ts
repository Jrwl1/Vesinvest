import {
  ArgumentsHost,
  BadRequestException,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
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
  UseFilters,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
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
import {
  AcceptTariffPlanDto,
  UpsertTariffPlanDto,
} from './dto/tariff-plan.dto';
import { UpdateVesinvestGroupDto } from './dto/vesinvest-group.dto';
import {
  CreateVesinvestPlanDto,
  SyncVesinvestPlanDto,
  UpdateVesinvestPlanDto,
} from './dto/vesinvest-plan.dto';
import { V2AdminGuard, V2EditorGuard } from './v2-role-access.guard';
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

function getBadRequestMessage(exception: BadRequestException) {
  const body = exception.getResponse();
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message?: unknown }).message
      : body;
  return Array.isArray(message) ? String(message[0] ?? '') : String(message);
}

@Catch(BadRequestException)
class V2UploadBadRequestExceptionFilter
  implements ExceptionFilter<BadRequestException>
{
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const currentMessage = getBadRequestMessage(exception);
    const mappedMessage =
      currentMessage === 'Unexpected field'
        ? 'Only a single file upload is supported.'
        : currentMessage === 'File too large'
          ? 'Uploaded file exceeds the configured byte limit.'
          : null;

    if (mappedMessage) {
      const badRequest = new BadRequestException(mappedMessage);
      response.status(badRequest.getStatus()).json(badRequest.getResponse());
      return;
    }

    response.status(exception.getStatus()).json(exception.getResponse());
  }
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  async importConnect(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportConnectDto,
  ) {
    return this.service.connectOrganization(req.orgId!, body.veetiId);
  }

  @Post('import/sync')
  @UseGuards(V2AdminGuard)
  async importSync(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportSyncDto,
  ) {
    return this.service.syncImport(req.orgId!, body?.years ?? []);
  }

  @Post('import/years/import')
  @UseGuards(V2AdminGuard)
  async importYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsDto,
  ) {
    return this.service.importYears(req.orgId!, body?.years ?? []);
  }

  @Post('import/planning-baseline')
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  async importRemoveYear(
    @Req() req: Request,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.service.removeImportedYear(req.orgId!, year);
  }

  @Post('import/years/bulk-delete')
  @UseGuards(V2AdminGuard)
  async importBulkDeleteYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsBulkDto,
  ) {
    return this.service.removeImportedYears(req.orgId!, body.years);
  }

  @Post('import/years/exclude')
  @UseGuards(V2AdminGuard)
  async importExcludeYears(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportYearsBulkDto,
  ) {
    return this.service.excludeImportedYears(req.orgId!, body.years);
  }

  @Post('import/years/restore')
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  @UseFilters(new V2UploadBadRequestExceptionFilter())
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
  @UseGuards(V2AdminGuard)
  @UseFilters(new V2UploadBadRequestExceptionFilter())
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  async clearImportAndScenarios(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: ImportClearDto,
  ) {
    const user = req.user as { sub?: string; roles?: string[] };
    // Destructive org-level reset path used by the V2 account drawer.
    return this.service.clearImportAndScenarios(
      req.orgId!,
      user?.sub ?? '',
      user?.roles ?? [],
      body?.challengeId,
      body?.confirmToken,
    );
  }

  @Post('import/clear/challenge')
  @UseGuards(V2AdminGuard)
  async createImportClearChallenge(@Req() req: Request) {
    const user = req.user as { sub?: string; roles?: string[] };
    return this.service.createImportClearChallenge(
      req.orgId!,
      user?.sub ?? '',
      user?.roles ?? [],
    );
  }

  @Post('import/manual-year')
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  async getOpsFunnel(@Req() req: Request) {
    const user = req.user as { roles?: string[] };
    return this.service.getOpsFunnel(req.orgId!, user?.roles ?? []);
  }

  @Get('vesinvest/groups')
  async listVesinvestGroups(@Req() req: Request) {
    return this.service.getInvestmentGroupDefinitions(req.orgId!);
  }

  @Patch('vesinvest/groups/:key')
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2EditorGuard)
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
  @UseGuards(V2EditorGuard)
  async updateVesinvestPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpdateVesinvestPlanDto,
  ) {
    return this.service.updateVesinvestPlan(req.orgId!, id, body);
  }

  @Post('vesinvest/plans/:id/clone')
  @UseGuards(V2EditorGuard)
  async cloneVesinvestPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.cloneVesinvestPlan(req.orgId!, id);
  }

  @Post('vesinvest/plans/:id/forecast-sync')
  @UseGuards(V2EditorGuard)
  async syncVesinvestPlanToForecast(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: SyncVesinvestPlanDto,
  ) {
    return this.service.syncVesinvestPlanToForecast(req.orgId!, id, body);
  }

  @Get('vesinvest/plans/:id/tariff-plan')
  async getTariffPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.getTariffPlan(req.orgId!, id);
  }

  @Put('vesinvest/plans/:id/tariff-plan')
  @UseGuards(V2EditorGuard)
  async upsertTariffPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: UpsertTariffPlanDto,
  ) {
    return this.service.upsertTariffPlan(req.orgId!, id, body);
  }

  @Post('vesinvest/plans/:id/tariff-plan/accept')
  @UseGuards(V2EditorGuard)
  async acceptTariffPlan(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: AcceptTariffPlanDto,
  ) {
    return this.service.acceptTariffPlan(req.orgId!, id, body);
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
  @UseGuards(V2AdminGuard)
  async createDepreciationRule(
    @Req() req: Request,
    @Body(new ValidationPipe(v2ValidationPipeOptions))
    body: CreateDepreciationRuleDto,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.createDepreciationRule(req.orgId!, body);
  }

  @Patch('forecast/depreciation-rules/:id')
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2AdminGuard)
  async deleteScenarioDepreciationRule(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('ruleId') ruleId: string,
  ) {
    this.ensureDepreciationFeatureEnabled();
    return this.service.deleteScenarioDepreciationRule(req.orgId!, id, ruleId);
  }

  @Post('forecast/scenarios')
  @UseGuards(V2EditorGuard)
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
  @UseGuards(V2AdminGuard)
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
  @UseGuards(V2EditorGuard)
  async patchScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ValidationPipe(v2ValidationPipeOptions)) body: UpdateScenarioDto,
  ) {
    return this.service.updateForecastScenario(req.orgId!, id, body);
  }

  @Delete('forecast/scenarios/:id')
  @UseGuards(V2AdminGuard)
  async deleteScenario(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.service.deleteForecastScenario(req.orgId!, id);
  }

  @Post('forecast/scenarios/:id/compute')
  @UseGuards(V2EditorGuard)
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
  @UseGuards(V2EditorGuard)
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
