import { Injectable, BadRequestException, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ImportsRepository, CreateExcelSheetInput } from './imports.repository';
import * as ExcelJS from 'exceljs';
import { ImportStatus, Prisma } from '@prisma/client';
import { suggestMappings, MappingSuggestion } from '../mappings/mapping-suggestions';
import { profileColumns, ColumnProfile } from './column-profiler';
import { AutoExtractService } from './auto-extract.service';
import { detectDataStartRow } from './data-row-detector';
import { classifySheet } from './sheet-classifier';
import type {
  ImportInboxDto,
  ImportInboxGroup,
  InboxSignal,
  InboxDetectedColumnSummary,
} from './dto/import-inbox.dto';

const MAX_SAMPLE_ROWS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/** When true, log per-sheet details (columns, kind). Default: minimal logs only. */
function isImportDebug(): boolean {
  return process.env.IMPORT_DEBUG === 'true' || process.env.LOG_LEVEL === 'debug';
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private readonly repo: ImportsRepository,
    private readonly autoExtractService: AutoExtractService,
  ) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  /**
   * Build inbox view model for an import: one group per sheet with signals and recommended method.
   * Tenant-scoped via orgId (JWT/demo guard).
   */
  async getInbox(orgId: string, importId: string): Promise<ImportInboxDto> {
    const excelImport = await this.repo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const groups: ImportInboxGroup[] = [];

    for (const sheet of excelImport.sheets) {
      const storedKind = (sheet as { kind?: string }).kind;
      const storedDataRowCount = (sheet as { dataRowCount?: number }).dataRowCount;
      const storedKindReason = (sheet as { kindReason?: string }).kindReason;

      let analysis: Awaited<ReturnType<AutoExtractService['analyzeSheet']>> | null = null;
      if (storedKind !== 'REFERENCE') {
        try {
          analysis = await this.autoExtractService.analyzeSheet(orgId, importId, sheet.id);
        } catch (err) {
          this.logger.warn(`Inbox: analysis failed for sheet ${sheet.sheetName}: ${err}`);
        }
      }

      const dataRowCount =
        storedDataRowCount ?? analysis?.dataRowCount ?? (sheet.rowCount ?? 0);
      const isReference = storedKind === 'REFERENCE';
      let recommendedMethod: 'quick' | 'mapping' =
        analysis?.canAutoExtract === true ? 'quick' : 'mapping';
      let quickImportDisabledReason: string | undefined;
      if (isReference) {
        recommendedMethod = 'mapping';
        quickImportDisabledReason = 'Reference sheet (explanations) — ignored.';
      }

      const signals: InboxSignal[] = [];

      if (analysis) {
        const dc = analysis.detectedColumns || {};
        signals.push({
          label: 'IDs',
          status: dc.externalRef ? 'good' : 'warn',
        });
        signals.push({
          label: 'Install year',
          status: dc.installedOn ? 'good' : 'warn',
        });
        const suggestions = suggestMappings(sheet.headers);
        const hasLength = suggestions.some(
          (s) => s.targetField === 'lengthMeters' && s.confidence >= 0.5,
        );
        signals.push({
          label: 'Length',
          status: hasLength ? 'good' : 'warn',
        });
        signals.push({
          label: 'Locations',
          status:
            (analysis.detectedSites?.length ?? 0) > 0 ? 'good' : 'missing',
        });
      } else {
        signals.push(
          { label: 'IDs', status: 'warn' },
          { label: 'Install year', status: 'warn' },
          { label: 'Length', status: 'warn' },
          { label: 'Locations', status: 'missing' },
        );
      }

      const detectedColumnsSummary: InboxDetectedColumnSummary[] | undefined =
        analysis?.detectedColumns
          ? Object.entries(analysis.detectedColumns)
              .filter(([_, col]) => col != null && col !== '')
              .map(([field, sourceColumn]) => ({
                field,
                sourceColumn: sourceColumn as string,
              }))
          : undefined;

      groups.push({
        sheetId: sheet.id,
        sheetName: sheet.sheetName,
        dataRowCount,
        recommendedMethod,
        signals,
        detectedColumnsSummary,
        kind: storedKind as ImportInboxGroup['kind'],
        kindReason: storedKindReason,
        quickImportDisabledReason,
      });
    }

    const uploadedAt =
      excelImport.uploadedAt instanceof Date
        ? excelImport.uploadedAt.toISOString()
        : String(excelImport.uploadedAt ?? new Date().toISOString());

    return {
      importId: excelImport.id,
      filename: excelImport.filename,
      uploadedAt,
      groups,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upload(orgId: string, file: any) {
    if (isImportDebug()) {
      this.logger.debug(`[UPLOAD] orgId=${orgId} fileName=${file?.originalname ?? '?'} size=${file?.size ?? 0}`);
    }

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Please upload an Excel file (.xlsx or .xls)');
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);

      const sheets: CreateExcelSheetInput[] = [];

      workbook.eachSheet((worksheet) => {
        const headers: string[] = [];
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const headerValue = cell.value?.toString()?.trim() || `Column ${colNumber}`;
          headers.push(headerValue);
        });

        if (headers.length === 0) return;

        // Build sample of rows 2..51 for data-start detection (Facit: skip multiple header rows)
        const sampleForDetection: Record<string, unknown>[] = [];
        let lastRowNumber = 0;
        const maxSample = 50;
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          lastRowNumber = rowNumber;
          if (rowNumber === 1) return;
          if (sampleForDetection.length < maxSample) {
            const rowData: Record<string, unknown> = {};
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const header = headers[colNumber - 1] || `Column ${colNumber}`;
              rowData[header] = this.getCellValue(cell);
            });
            sampleForDetection.push(rowData);
          }
        });

        const detection = detectDataStartRow(sampleForDetection, headers);
        const firstDataRowIndex1Based = 2 + detection.dataStartIndex;
        const headerRowsSkipped = firstDataRowIndex1Based - 1;
        let dataRowCount = 0;
        const sampleRows: Record<string, unknown>[] = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber < firstDataRowIndex1Based) return;
          dataRowCount++;
          if (sampleRows.length < MAX_SAMPLE_ROWS) {
            const rowData: Record<string, unknown> = {};
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const header = headers[colNumber - 1] || `Column ${colNumber}`;
              rowData[header] = this.getCellValue(cell);
            });
            sampleRows.push(rowData);
          }
        });

        const rowCount = Math.max(0, lastRowNumber - 1);
        const classification = classifySheet(
          worksheet.name,
          headers,
          dataRowCount,
          headerRowsSkipped,
        );

        const columnsProfile =
          sampleRows.length > 0 ? profileColumns(headers, sampleRows) : undefined;

        sheets.push({
          sheetName: worksheet.name,
          headers,
          rowCount,
          sampleRows: sampleRows.length > 0 ? (sampleRows as unknown as Prisma.InputJsonValue) : undefined,
          columnsProfile,
          dataRowCount,
          headerRowsSkipped,
          kind: classification.kind,
          kindReason: classification.kindReason,
        });

        if (isImportDebug()) {
          this.logger.debug(
            `Sheet "${worksheet.name}": cols=${headers.length} totalRows=${rowCount} dataRows=${dataRowCount} headerSkipped=${headerRowsSkipped} kind=${classification.kind}`,
          );
        }
      });

      if (sheets.length === 0) {
        throw new BadRequestException('No valid sheets found in the Excel file');
      }

      const excelImport = await this.repo.create(orgId, {
        filename: file.originalname,
        sheets,
      });

      this.logger.log(`Created import ${excelImport.id} with ${sheets.length} sheet(s) for org ${orgId}`);

      return {
        message: 'File uploaded successfully',
        import: excelImport,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Map FK errors (e.g. orgId from JWT doesn't exist after demo reset) to actionable message
      const errMsg = error instanceof Error ? error.message : String(error);
      if (
        errMsg.includes('ExcelImport_orgId_fkey') ||
        (errMsg.includes('foreign key constraint') && errMsg.includes('orgId'))
      ) {
        this.logger.warn(`Import upload FK (org): ${errMsg}`);
        throw new UnauthorizedException(
          'Your session points to an organization that no longer exists (e.g. after a demo reset). Click "Use Demo" again or "Reset Demo" to continue.',
        );
      }
      this.logger.error('Failed to parse Excel file', error);
      throw new BadRequestException('Failed to parse Excel file. Please ensure it is a valid Excel file.');
    }
  }

  async getSheetPreview(orgId: string, importId: string, sheetId: string) {
    const excelImport = await this.repo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = await this.repo.findSheetById(importId, sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    return {
      id: sheet.id,
      sheetName: sheet.sheetName,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
      sampleRows: sheet.sampleRows,
      columnsProfile: sheet.columnsProfile as ColumnProfile[] | null,
    };
  }

  async updateStatus(orgId: string, id: string, status: ImportStatus) {
    return this.repo.updateStatus(orgId, id, status);
  }

  async delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }

  async getSuggestions(
    orgId: string,
    importId: string,
    sheetId: string,
  ): Promise<{ suggestions: MappingSuggestion[] }> {
    const excelImport = await this.repo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = await this.repo.findSheetById(importId, sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const suggestions = suggestMappings(sheet.headers);
    if (isImportDebug()) {
      this.logger.debug(`Suggestions for "${sheet.sheetName}": ${suggestions.length} mappings`);
    }

    return { suggestions };
  }

  private getCellValue(cell: ExcelJS.Cell): unknown {
    if (cell.value === null || cell.value === undefined) {
      return null;
    }

    // Handle different cell types
    if (typeof cell.value === 'object') {
      // Date
      if (cell.value instanceof Date) {
        return cell.value.toISOString();
      }
      // Rich text
      if ('richText' in cell.value) {
        return (cell.value as ExcelJS.CellRichTextValue).richText
          .map((rt) => rt.text)
          .join('');
      }
      // Formula result
      if ('result' in cell.value) {
        return (cell.value as ExcelJS.CellFormulaValue).result;
      }
      // Hyperlink
      if ('hyperlink' in cell.value) {
        return (cell.value as ExcelJS.CellHyperlinkValue).text;
      }
      // Error
      if ('error' in cell.value) {
        return null;
      }
    }

    return cell.value;
  }
}
