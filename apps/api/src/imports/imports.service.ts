import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ImportsRepository, CreateExcelSheetInput } from './imports.repository';
import * as ExcelJS from 'exceljs';
import { ImportStatus, Prisma } from '@prisma/client';
import { suggestMappings, MappingSuggestion } from '../mappings/mapping-suggestions';
import { profileColumns, ColumnProfile } from './column-profiler';

const MAX_SAMPLE_ROWS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(private readonly repo: ImportsRepository) {}

  list(orgId: string) {
    return this.repo.findAll(orgId);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upload(orgId: string, file: any) {
    // SECURITY: orgId comes from JWT via TenantGuard, never from client input
    this.logger.debug(`[UPLOAD] orgId=${orgId} (source: JWT/TenantGuard)`);

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
        const sampleRows: Record<string, unknown>[] = [];
        let rowCount = 0;

        // Get headers from first row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const headerValue = cell.value?.toString()?.trim() || `Column ${colNumber}`;
          headers.push(headerValue);
        });

        // Count rows and collect sample data
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header row
          rowCount++;

          // Collect sample rows (first N data rows)
          if (rowCount <= MAX_SAMPLE_ROWS) {
            const rowData: Record<string, unknown> = {};
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              const header = headers[colNumber - 1] || `Column ${colNumber}`;
              rowData[header] = this.getCellValue(cell);
            });
            sampleRows.push(rowData);
          }
        });

        if (headers.length > 0) {
          // Generate column profiles from sample data
          const columnsProfile = sampleRows.length > 0
            ? profileColumns(headers, sampleRows)
            : undefined;

          sheets.push({
            sheetName: worksheet.name,
            headers,
            rowCount,
            sampleRows: sampleRows.length > 0 ? (sampleRows as unknown as Prisma.InputJsonValue) : undefined,
            columnsProfile,
          });

          this.logger.debug(
            `Sheet "${worksheet.name}": ${headers.length} columns, ${rowCount} rows, ` +
            `profiles: ${columnsProfile?.length ?? 0}`,
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

      this.logger.log(
        `Created import ${excelImport.id} with ${sheets.length} sheets for org ${orgId}`,
      );

      return {
        message: 'File uploaded successfully',
        import: excelImport,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
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

    this.logger.debug(
      `Generating suggestions for sheet "${sheet.sheetName}" with ${sheet.headers.length} columns`,
    );

    const suggestions = suggestMappings(sheet.headers);

    this.logger.debug(`Generated ${suggestions.length} suggestions`);

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
