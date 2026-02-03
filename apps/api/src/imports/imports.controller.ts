import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { ImportsService } from './imports.service';
import { ImportExecutionService, MatchKeyStrategy } from './import-execution.service';
import { ImportValidationService } from './import-validation.service';
import { ReadinessGateService, ImportAssumption } from './readiness-gate.service';
import { AutoExtractService, SheetDefaults } from './auto-extract.service';
import { SanitySummaryService } from './sanity-summary.service';
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly service: ImportsService,
    private readonly executionService: ImportExecutionService,
    private readonly validationService: ImportValidationService,
    private readonly readinessService: ReadinessGateService,
    private readonly autoExtractService: AutoExtractService,
    private readonly sanitySummaryService: SanitySummaryService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.service.list(req.orgId!);
  }

  @Get(':id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.service.findById(req.orgId!, id);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, callback) => {
        const validMimeTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ];
        if (validMimeTypes.includes(file.mimetype)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Invalid file type. Please upload an Excel file (.xlsx or .xls)'),
            false,
          );
        }
      },
    }),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  upload(@Req() req: Request, @UploadedFile() file: any) {
    return this.service.upload(req.orgId!, file);
  }

  @Get(':id/sheets/:sheetId/preview')
  getSheetPreview(
    @Req() req: Request,
    @Param('id') importId: string,
    @Param('sheetId') sheetId: string,
  ) {
    return this.service.getSheetPreview(req.orgId!, importId, sheetId);
  }

  @Delete(':id')
  delete(@Req() req: Request, @Param('id') id: string) {
    return this.service.delete(req.orgId!, id);
  }

  @Get(':id/sheets/:sheetId/suggestions')
  getSuggestions(
    @Req() req: Request,
    @Param('id') importId: string,
    @Param('sheetId') sheetId: string,
  ) {
    return this.service.getSuggestions(req.orgId!, importId, sheetId);
  }

  @Post(':id/execute')
  execute(
    @Req() req: Request,
    @Param('id') importId: string,
    @Body()
    body: {
      mappingId: string;
      sheetId: string;
      dryRun?: boolean;
      updateExisting?: boolean;
      matchKeyStrategy?: MatchKeyStrategy;
    },
  ) {
    return this.executionService.executeImport(
      req.orgId!,
      importId,
      body.mappingId,
      body.sheetId,
      {
        dryRun: body.dryRun,
        updateExisting: body.updateExisting,
        matchKeyStrategy: body.matchKeyStrategy,
      },
    );
  }

  @Post(':id/validation-report')
  getValidationReport(
    @Req() req: Request,
    @Param('id') importId: string,
    @Body() body: { mappingId: string; sheetId: string },
  ) {
    return this.validationService.generateValidationReport(
      req.orgId!,
      importId,
      body.mappingId,
      body.sheetId,
    );
  }

  @Post(':id/readiness-check')
  checkReadiness(
    @Req() req: Request,
    @Param('id') importId: string,
    @Body()
    body: {
      mappingId: string;
      sheetId: string;
      assumptions?: ImportAssumption[];
    },
  ) {
    return this.readinessService.checkReadiness(
      req.orgId!,
      importId,
      body.mappingId,
      body.sheetId,
      body.assumptions || [],
    );
  }

  @Post(':id/preview')
  executePreview(
    @Req() req: Request,
    @Param('id') importId: string,
    @Body()
    body: {
      mappingId: string;
      sheetId: string;
      matchKeyStrategy?: MatchKeyStrategy;
      assumptions?: ImportAssumption[];
    },
  ) {
    // Execute in dry-run mode
    // Per Asset Identity Contract, default to externalRef matching
    return this.executionService.executeImport(
      req.orgId!,
      importId,
      body.mappingId,
      body.sheetId,
      {
        dryRun: true,
        updateExisting: true,
        matchKeyStrategy: body.matchKeyStrategy || 'externalRef',
      },
    );
  }

  /**
   * Analyze a sheet for auto-extract compatibility
   * Returns detected columns, suggested asset type, site detection info, and any issues.
   * 
   * Supports manual site override via query parameter - when provided, site detection
   * from Excel is skipped entirely.
   */
  @Get(':id/sheets/:sheetId/auto-extract-analysis')
  analyzeForAutoExtract(
    @Req() req: Request,
    @Param('id') importId: string,
    @Param('sheetId') sheetId: string,
    @Query('siteOverrideId') siteOverrideId?: string,
  ) {
    return this.autoExtractService.analyzeSheet(
      req.orgId!,
      importId,
      sheetId,
      siteOverrideId || undefined,
    );
  }

  /**
   * Auto-extract assets from a sheet with minimal required fields
   * Bypasses per-column mapping - uses sheet-level defaults for lifeYears, replacementCostEur, criticality
   * 
   * Required fields auto-detected from Excel: externalRef, name, installedOn
   * Sheet-level defaults: assetType (required), lifeYears, replacementCostEur, criticality
   * 
   * Site can be specified via:
   * - siteOverrideId: Direct site ID (bypasses all site detection)
   * - sheetDefaults.site: Site name to look up
   * 
   * Per Site Handling Contract: Site must be explicitly specified - no implicit defaults.
   */
  @Post(':id/auto-extract')
  autoExtract(
    @Req() req: Request,
    @Param('id') importId: string,
    @Body()
    body: {
      sheetId: string;
      sheetDefaults: SheetDefaults;
      dryRun?: boolean;
      allowFallbackIdentity?: boolean;
      /** If provided, use this site ID for all rows (bypasses site detection) */
      siteOverrideId?: string;
    },
  ) {
    if (!body.sheetId) {
      throw new BadRequestException('sheetId is required');
    }
    if (!body.sheetDefaults?.assetType) {
      throw new BadRequestException('sheetDefaults.assetType is required');
    }
    return this.autoExtractService.autoExtract(req.orgId!, importId, body.sheetId, {
      sheetDefaults: body.sheetDefaults,
      dryRun: body.dryRun,
      allowFallbackIdentity: body.allowFallbackIdentity ?? true,
      siteOverrideId: body.siteOverrideId,
    });
  }

  /**
   * Get post-import sanity summary for visual validation.
   * Returns aggregated data about imported assets to help users verify the import.
   * This endpoint never throws user-visible errors - returns null on failure.
   */
  @Get(':id/sanity-summary')
  getSanitySummary(@Req() req: Request, @Param('id') importId: string) {
    return this.sanitySummaryService.getSanitySummary(req.orgId!, importId);
  }
}
