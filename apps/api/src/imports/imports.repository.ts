import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../repositories/base.repository';
import { ImportStatus, ImportAction, TargetEntity, Prisma } from '@prisma/client';
import { ColumnProfile } from './column-profiler';

export interface CreateExcelSheetInput {
  sheetName: string;
  headers: string[];
  rowCount: number;
  sampleRows?: Prisma.InputJsonValue;
  columnsProfile?: ColumnProfile[];
}

export interface CreateImportedRecordInput {
  importId: string;
  entityType: TargetEntity;
  entityId: string;
  sheetName: string;
  rowNumber: number;
  rowHash: string;
  action: ImportAction;
  matchKey?: string;
  matchValue?: string;
}

@Injectable()
export class ImportsRepository extends BaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAll(orgId: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.excelImport.findMany({
      where: { orgId: org },
      include: { sheets: true },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  findById(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    return this.prisma.excelImport.findFirst({
      where: { id, orgId: org },
      include: { sheets: true },
    });
  }

  async create(
    orgId: string,
    data: {
      filename: string;
      sheets: CreateExcelSheetInput[];
    },
  ) {
    const org = this.requireOrgId(orgId);
    return this.prisma.excelImport.create({
      data: {
        orgId: org,
        filename: data.filename,
        status: ImportStatus.pending,
        sheets: {
          create: data.sheets.map((sheet) => ({
            sheetName: sheet.sheetName,
            headers: sheet.headers,
            rowCount: sheet.rowCount,
            sampleRows: sheet.sampleRows ?? Prisma.JsonNull,
            columnsProfile: sheet.columnsProfile
              ? (sheet.columnsProfile as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          })),
        },
      },
      include: { sheets: true },
    });
  }

  async updateStatus(orgId: string, id: string, status: ImportStatus) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.excelImport.updateMany({
      where: { id, orgId: org },
      data: { status },
    });
    if (result.count === 0) throw new NotFoundException('Import not found');
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string) {
    const org = this.requireOrgId(orgId);
    const result = await this.prisma.excelImport.deleteMany({
      where: { id, orgId: org },
    });
    if (result.count === 0) throw new NotFoundException('Import not found');
    return { deleted: true };
  }

  findSheetById(importId: string, sheetId: string) {
    return this.prisma.excelSheet.findFirst({
      where: { id: sheetId, importId },
    });
  }

  // ============================================
  // Imported Records (Idempotency)
  // ============================================

  /**
   * Find existing imported record by row position
   */
  findImportedRecordByRow(importId: string, sheetName: string, rowNumber: number) {
    return this.prisma.importedRecord.findUnique({
      where: {
        importId_sheetName_rowNumber: { importId, sheetName, rowNumber },
      },
    });
  }

  /**
   * Find existing imported record by row hash
   */
  findImportedRecordByHash(importId: string, rowHash: string, entityType: TargetEntity) {
    return this.prisma.importedRecord.findUnique({
      where: {
        importId_rowHash_entityType: { importId, rowHash, entityType },
      },
    });
  }

  /**
   * Get all imported records for an import
   */
  findImportedRecords(importId: string) {
    return this.prisma.importedRecord.findMany({
      where: { importId },
      orderBy: { rowNumber: 'asc' },
    });
  }

  /**
   * Create an imported record
   */
  createImportedRecord(data: CreateImportedRecordInput) {
    return this.prisma.importedRecord.create({
      data: {
        importId: data.importId,
        entityType: data.entityType,
        entityId: data.entityId,
        sheetName: data.sheetName,
        rowNumber: data.rowNumber,
        rowHash: data.rowHash,
        action: data.action,
        matchKey: data.matchKey,
        matchValue: data.matchValue,
      },
    });
  }

  /**
   * Update an imported record (for re-imports)
   */
  updateImportedRecord(
    id: string,
    data: { entityId?: string; rowHash?: string; action?: ImportAction },
  ) {
    return this.prisma.importedRecord.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete all imported records for an import (for cleanup/retry)
   */
  deleteImportedRecords(importId: string) {
    return this.prisma.importedRecord.deleteMany({
      where: { importId },
    });
  }
}
