import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
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
import type { Request } from 'express';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('imports')
export class ImportsController {
  constructor(
    private readonly service: ImportsService,
    private readonly executionService: ImportExecutionService,
    private readonly validationService: ImportValidationService,
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
  upload(@Req() req: Request, @UploadedFile() file: Express.Multer.File) {
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
}
