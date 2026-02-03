/**
 * Auto-Extract Service
 * 
 * Provides a simplified import path that bypasses per-column mapping:
 * - Detects assetType per sheet (from sheet name or explicit selection)
 * - Requires only: externalRef + name + installedOn
 * - Applies sheet-level defaults for: lifeYears, replacementCostEur, criticality
 * - Marks assumed fields with assumptionSource='sheet-default'
 * - Returns a post-import report with assumption statistics
 * 
 * Handles GIS exports gracefully:
 * - Numeric IDs (FEATUREID, OBJECTID) are automatically converted to strings
 * - No Prisma errors leak to the UI
 * - Preview reflects post-normalization state
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';
import { ImportStatus, TargetEntity, AssetStatus, Criticality, Prisma, ImportAction } from '@prisma/client';
import { computeRowHash } from './row-hash';
import * as crypto from 'crypto';
import { suggestMappings } from '../mappings/mapping-suggestions';
import {
  normalizeExternalRef,
  normalizeExternalRefWithDetails,
  analyzeExternalRefColumn,
} from './external-ref-normalizer';

export interface SheetDefaults {
  /** Default lifeYears if not in Excel */
  lifeYears?: number;
  /** Default replacement cost if not in Excel */
  replacementCostEur?: number;
  /** Default criticality if not in Excel */
  criticality?: Criticality;
  /** AssetType to use for all rows (by code or name) */
  assetType: string;
  /** Site to use for all rows (by name, optional if only one site exists) */
  site?: string;
}

export interface AutoExtractOptions {
  /** Sheet-level defaults for assumed fields */
  sheetDefaults: SheetDefaults;
  /** If true, preview only without creating assets */
  dryRun?: boolean;
  /** Allow fallback identity generation for rows without externalRef */
  allowFallbackIdentity?: boolean;
}

export interface AssumedFieldStat {
  field: string;
  source: 'sheet-default' | 'assetType-default';
  value: string | number;
  rowCount: number;
}

export interface AutoExtractResult {
  success: boolean;
  /** Number of assets created */
  created: number;
  /** Number of assets updated (if re-running) */
  updated: number;
  /** Number of rows skipped due to errors */
  skipped: number;
  /** Number of rows unchanged (same hash) */
  unchanged: number;
  /** Number of assets with derived identity */
  derivedIdentityCount: number;
  /** Detailed assumption report */
  assumedFields: AssumedFieldStat[];
  /** Column auto-detection results */
  detectedColumns: {
    externalRef?: string;
    name?: string;
    installedOn?: string;
    lifeYears?: string;
    replacementCostEur?: string;
    criticality?: string;
  };
  /** Errors by row - user-friendly messages only */
  errors: Array<{ row: number; message: string }>;
  /** Warnings by row */
  warnings: Array<{ row: number; message: string }>;
  /** Sample errors for UI display */
  sampleErrors: Array<{ row: number; message: string }>;
  /** Info messages for UI (e.g., "Numeric IDs detected and normalized") */
  infoMessages: string[];
}

@Injectable()
export class AutoExtractService {
  private readonly logger = new Logger(AutoExtractService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: ImportsRepository,
  ) {}

  /**
   * Auto-extract assets from a sheet with minimal required fields and sheet-level defaults
   */
  async autoExtract(
    orgId: string,
    importId: string,
    sheetId: string,
    options: AutoExtractOptions,
  ): Promise<AutoExtractResult> {
    const { sheetDefaults, dryRun = false, allowFallbackIdentity = true } = options;

    // Load import
    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = excelImport.sheets.find((s) => s.id === sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Resolve asset type
    const assetType = await this.resolveAssetType(orgId, sheetDefaults.assetType);
    if (!assetType) {
      throw new BadRequestException(`Asset type "${sheetDefaults.assetType}" not found`);
    }

    // Resolve site
    const site = await this.resolveSite(orgId, sheetDefaults.site);
    if (!site) {
      throw new BadRequestException(
        sheetDefaults.site
          ? `Site "${sheetDefaults.site}" not found`
          : 'Multiple sites exist, please specify a site',
      );
    }

    // Auto-detect column mappings using suggestions
    const suggestions = suggestMappings(sheet.headers);
    const columnMap = this.buildAutoColumnMap(suggestions, sheet.headers);

    this.logger.log(
      `Auto-extract: detected columns: externalRef=${columnMap.externalRef}, ` +
        `name=${columnMap.name}, installedOn=${columnMap.installedOn}`,
    );

    // Validate required columns
    if (!columnMap.name) {
      throw new BadRequestException(
        'Could not auto-detect a "name" column. Required columns: externalRef, name, installedOn',
      );
    }

    // Get rows
    const rows = (sheet.sampleRows as Record<string, unknown>[]) || [];
    if (rows.length === 0) {
      throw new BadRequestException('No data rows found in sheet');
    }

    const result: AutoExtractResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      derivedIdentityCount: 0,
      assumedFields: [],
      detectedColumns: columnMap,
      errors: [],
      warnings: [],
      sampleErrors: [],
      infoMessages: [],
    };

    // Track assumption statistics
    const assumptionCounts: Record<string, { source: 'sheet-default' | 'assetType-default'; value: unknown; count: number }> = {};

    // Resolve defaults
    const defaultLifeYears = sheetDefaults.lifeYears ?? assetType.defaultLifeYears ?? 20;
    const defaultCriticality = sheetDefaults.criticality ?? Criticality.medium;
    const defaultReplacementCost = sheetDefaults.replacementCostEur;

    // Pre-analyze externalRef column for info messages
    if (columnMap.externalRef) {
      const externalRefValues = rows.map((row) => this.getRowValue(row, columnMap.externalRef!));
      const analysis = analyzeExternalRefColumn(externalRefValues);
      
      if (analysis.numericCount > 0) {
        result.infoMessages.push(
          `Numeric identifiers detected and normalized (${analysis.numericCount} GIS-style IDs).`
        );
        this.logger.log(`Auto-extract: normalizing ${analysis.numericCount} numeric externalRef values`);
      }
      
      if (analysis.emptyCount > 0 && allowFallbackIdentity) {
        result.infoMessages.push(
          `${analysis.emptyCount} row(s) missing identifier - fallback IDs will be generated.`
        );
      }
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row and 0-indexing

      try {
        // Extract values
        const nameRaw = this.getRowValue(row, columnMap.name!);
        const name = this.normalizeStringValue(nameRaw);
        if (!name) {
          result.warnings.push({ row: rowNum, message: 'Missing name, skipping row' });
          result.skipped++;
          continue;
        }

        // ExternalRef - CRITICAL: normalize before any operations
        const externalRefRaw = columnMap.externalRef
          ? this.getRowValue(row, columnMap.externalRef)
          : undefined;
        
        // Use canonical normalizer - handles numbers, strings, whitespace
        let externalRef = normalizeExternalRef(externalRefRaw);
        let derivedIdentity = false;

        if (!externalRef) {
          if (!allowFallbackIdentity) {
            result.errors.push({
              row: rowNum,
              message: 'Missing identifier. Enable fallback identity or ensure the ID column has values.',
            });
            continue;
          }
          // Generate fallback per Asset Identity Contract
          externalRef = this.generateFallbackExternalRef(assetType.id, site.id, name);
          derivedIdentity = true;
          result.derivedIdentityCount++;
          result.warnings.push({
            row: rowNum,
            message: `Generated fallback identity: ${externalRef}`,
          });
        }

        // InstalledOn
        const installedOnRaw = columnMap.installedOn
          ? this.getRowValue(row, columnMap.installedOn)
          : undefined;
        const installedOn = this.parseDate(installedOnRaw);

        // Track assumed fields for this row
        const assumedFields: Record<string, 'sheet-default' | 'assetType-default'> = {};

        // LifeYears - from Excel or default
        let lifeYears: number | undefined;
        const lifeYearsRaw = columnMap.lifeYears
          ? this.getRowValue(row, columnMap.lifeYears)
          : undefined;
        if (lifeYearsRaw !== undefined && lifeYearsRaw !== null && lifeYearsRaw !== '') {
          lifeYears = this.parseNumber(lifeYearsRaw);
        }
        if (lifeYears === undefined) {
          lifeYears = defaultLifeYears;
          const source = sheetDefaults.lifeYears ? 'sheet-default' : 'assetType-default';
          assumedFields['lifeYears'] = source;
          this.incrementAssumption(assumptionCounts, 'lifeYears', source, defaultLifeYears);
        }

        // ReplacementCostEur - from Excel or default
        let replacementCostEur: Prisma.Decimal | undefined;
        const costRaw = columnMap.replacementCostEur
          ? this.getRowValue(row, columnMap.replacementCostEur)
          : undefined;
        if (costRaw !== undefined && costRaw !== null && costRaw !== '') {
          replacementCostEur = this.parseDecimal(costRaw);
        }
        if (replacementCostEur === undefined && defaultReplacementCost !== undefined) {
          replacementCostEur = new Prisma.Decimal(defaultReplacementCost);
          assumedFields['replacementCostEur'] = 'sheet-default';
          this.incrementAssumption(assumptionCounts, 'replacementCostEur', 'sheet-default', defaultReplacementCost);
        }

        // Criticality - from Excel or default
        let criticality: Criticality;
        const criticalityRaw = columnMap.criticality
          ? this.getRowValue(row, columnMap.criticality)
          : undefined;
        const parsedCriticality = this.parseCriticality(criticalityRaw);
        if (parsedCriticality) {
          criticality = parsedCriticality;
        } else {
          criticality = defaultCriticality;
          assumedFields['criticality'] = 'sheet-default';
          this.incrementAssumption(assumptionCounts, 'criticality', 'sheet-default', defaultCriticality);
        }

        // Compute row hash for idempotency
        const rowHash = this.computeSimpleRowHash(externalRef as string, name, installedOn);

        // Check existing record
        const existingRecord = await this.importsRepo.findImportedRecordByRow(
          importId,
          sheet.sheetName,
          rowNum,
        );

        if (existingRecord && existingRecord.rowHash === rowHash) {
          result.unchanged++;
          continue;
        }

        if (dryRun) {
          // Preview mode - check if would exist
          // externalRef is already normalized (string) at this point
          try {
            const wouldExist = await this.prisma.asset.findUnique({
              where: { orgId_externalRef: { orgId, externalRef } },
            });
            if (wouldExist || existingRecord) {
              result.updated++;
            } else {
              result.created++;
            }
          } catch (err) {
            // Convert any Prisma errors to user-friendly messages
            result.errors.push({
              row: rowNum,
              message: this.toUserFriendlyError(err, 'checking existing asset'),
            });
          }
          continue;
        }

        // Create or update asset
        // externalRef is already normalized (string) at this point
        let existingAsset = null;
        try {
          existingAsset = await this.prisma.asset.findUnique({
            where: { orgId_externalRef: { orgId, externalRef } },
          });
        } catch (err) {
          result.errors.push({
            row: rowNum,
            message: this.toUserFriendlyError(err, 'looking up asset'),
          });
          continue;
        }

        let entityId: string;
        let action: ImportAction;

        const assetData = {
          name: name.trim(),
          installedOn,
          lifeYears,
          replacementCostEur,
          criticality,
          status: AssetStatus.active,
          sourceImportId: importId,
          sourceSheetName: sheet.sheetName,
          sourceRowNumber: rowNum,
          assumedFields: Object.keys(assumedFields).length > 0 ? assumedFields : undefined,
        };

        try {
          if (existingAsset) {
            // Update - but preserve externalRef (immutable)
            await this.prisma.asset.update({
              where: { id: existingAsset.id },
              data: assetData,
            });
            entityId = existingAsset.id;
            action = ImportAction.updated;
            result.updated++;
          } else {
            // Create new - externalRef is already normalized
            const created = await this.prisma.asset.create({
              data: {
                ...assetData,
                orgId,
                siteId: site.id,
                assetTypeId: assetType.id,
                externalRef,
                derivedIdentity,
              },
            });
            entityId = created.id;
            action = ImportAction.created;
            result.created++;
          }
        } catch (err) {
          result.errors.push({
            row: rowNum,
            message: this.toUserFriendlyError(err, existingAsset ? 'updating asset' : 'creating asset'),
          });
          continue;
        }

        // Record import for idempotency
        try {
          if (existingRecord) {
            await this.importsRepo.updateImportedRecord(existingRecord.id, {
              entityId,
              rowHash,
              action,
            });
          } else {
            await this.importsRepo.createImportedRecord({
              importId,
              entityType: TargetEntity.asset,
              entityId,
              sheetName: sheet.sheetName,
              rowNumber: rowNum,
              rowHash,
              action,
              matchKey: 'externalRef',
              matchValue: externalRef,
            });
          }
        } catch (err) {
          // Non-fatal: asset was created but tracking failed
          this.logger.warn(`Failed to record import for row ${rowNum}: ${err}`);
        }
      } catch (err) {
        // Catch-all for unexpected errors - never leak technical details
        result.errors.push({
          row: rowNum,
          message: this.toUserFriendlyError(err, 'processing row'),
        });
      }
    }

    // Build assumption report
    result.assumedFields = Object.entries(assumptionCounts).map(([field, data]) => ({
      field,
      source: data.source,
      value: data.value as string | number,
      rowCount: data.count,
    }));

    // Update import status
    if (!dryRun && result.errors.length === 0) {
      await this.importsRepo.updateStatus(orgId, importId, ImportStatus.imported);
    }

    result.sampleErrors = result.errors.slice(0, 5);
    result.success = result.errors.length === 0;

    this.logger.log(
      `Auto-extract complete: created=${result.created}, updated=${result.updated}, ` +
        `skipped=${result.skipped}, unchanged=${result.unchanged}, ` +
        `derivedIdentity=${result.derivedIdentityCount}, errors=${result.errors.length}`,
    );

    return result;
  }

  /**
   * Get analysis of a sheet for auto-extract preview
   */
  async analyzeSheet(
    orgId: string,
    importId: string,
    sheetId: string,
  ): Promise<{
    detectedColumns: Record<string, string | undefined>;
    suggestedAssetType: string | null;
    rowCount: number;
    canAutoExtract: boolean;
    issues: string[];
  }> {
    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = excelImport.sheets.find((s) => s.id === sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const suggestions = suggestMappings(sheet.headers);
    const columnMap = this.buildAutoColumnMap(suggestions, sheet.headers);

    const issues: string[] = [];
    if (!columnMap.name) {
      issues.push('Could not detect a "name" column');
    }
    if (!columnMap.externalRef) {
      issues.push('No externalRef column detected - will use fallback identity');
    }
    if (!columnMap.installedOn) {
      issues.push('No installedOn column detected - installation dates will be empty');
    }

    // Try to match sheet name to asset type
    const assetTypes = await this.prisma.assetType.findMany({ where: { orgId } });
    let suggestedAssetType: string | null = null;
    const sheetNameLower = sheet.sheetName.toLowerCase();
    for (const at of assetTypes) {
      if (
        sheetNameLower.includes(at.code.toLowerCase()) ||
        sheetNameLower.includes(at.name.toLowerCase())
      ) {
        suggestedAssetType = at.code;
        break;
      }
    }

    return {
      detectedColumns: columnMap,
      suggestedAssetType,
      rowCount: sheet.rowCount,
      canAutoExtract: !!columnMap.name,
      issues,
    };
  }

  private buildAutoColumnMap(
    suggestions: Array<{ sourceColumn: string; targetField: string; confidence: number }>,
    headers: string[],
  ): Record<string, string | undefined> {
    const map: Record<string, string | undefined> = {
      externalRef: undefined,
      name: undefined,
      installedOn: undefined,
      lifeYears: undefined,
      replacementCostEur: undefined,
      criticality: undefined,
    };

    // Use suggestions with confidence > 0.5
    for (const s of suggestions) {
      if (s.confidence >= 0.5 && map[s.targetField] === undefined) {
        map[s.targetField] = s.sourceColumn;
      }
    }

    return map;
  }

  private async resolveAssetType(orgId: string, assetTypeRef: string) {
    return this.prisma.assetType.findFirst({
      where: {
        orgId,
        OR: [
          { code: { equals: assetTypeRef, mode: 'insensitive' } },
          { name: { equals: assetTypeRef, mode: 'insensitive' } },
        ],
      },
    });
  }

  private async resolveSite(orgId: string, siteRef?: string) {
    if (siteRef) {
      return this.prisma.site.findFirst({
        where: {
          orgId,
          name: { equals: siteRef, mode: 'insensitive' },
        },
      });
    }
    // If no site specified, use first if only one exists
    const sites = await this.prisma.site.findMany({ where: { orgId } });
    return sites.length === 1 ? sites[0] : null;
  }

  private generateFallbackExternalRef(assetTypeId: string, siteId: string, name: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
    const input = `${assetTypeId}|${siteId}|${normalized}`;
    return `DERIVED_${crypto.createHash('sha256').update(input).digest('hex').substring(0, 16)}`;
  }

  /**
   * Normalize a string value (name, etc.) - trim whitespace
   */
  private normalizeStringValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }
    if (typeof value === 'number') {
      return String(value);
    }
    return null;
  }

  /**
   * Convert internal errors to user-friendly messages.
   * Never expose stack traces, file paths, or Prisma internals.
   */
  private toUserFriendlyError(err: unknown, context: string): string {
    // Log the full error internally for debugging
    this.logger.error(`Error during ${context}:`, err);
    
    // Check for common Prisma error patterns
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      
      // Unique constraint violation
      if (msg.includes('unique constraint') || msg.includes('duplicate')) {
        return 'An asset with this identifier already exists.';
      }
      
      // Foreign key violation
      if (msg.includes('foreign key') || msg.includes('fkey')) {
        return 'Referenced data (site or asset type) not found.';
      }
      
      // Type validation errors (shouldn't happen after normalization, but defensive)
      if (msg.includes('invalid') && (msg.includes('invocation') || msg.includes('argument'))) {
        return 'Data format issue detected. This row will be skipped.';
      }
      
      // Connection errors
      if (msg.includes('connect') || msg.includes('timeout')) {
        return 'Database temporarily unavailable. Please try again.';
      }
    }
    
    // Generic fallback - never expose raw error
    return `Unable to process this row while ${context}.`;
  }

  private computeSimpleRowHash(externalRef: string, name: string, installedOn?: Date): string {
    const parts = [
      externalRef,
      name.toLowerCase().trim(),
      installedOn?.toISOString() ?? '',
    ];
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').substring(0, 32);
  }

  private getRowValue(row: Record<string, unknown>, columnName: string): unknown {
    const lowerName = columnName.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return undefined;
  }

  private incrementAssumption(
    counts: Record<string, { source: 'sheet-default' | 'assetType-default'; value: unknown; count: number }>,
    field: string,
    source: 'sheet-default' | 'assetType-default',
    value: unknown,
  ) {
    if (!counts[field]) {
      counts[field] = { source, value, count: 0 };
    }
    counts[field].count++;
  }

  private parseDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
      const yearMatch = value.match(/^\d{4}$/);
      if (yearMatch) return new Date(parseInt(value, 10), 0, 1);
    }
    if (typeof value === 'number') {
      if (value > 1900 && value < 2100) return new Date(value, 0, 1);
      if (value > 25569) {
        const utc = (value - 25569) * 86400 * 1000;
        return new Date(utc);
      }
    }
    return undefined;
  }

  private parseNumber(value: unknown): number | undefined {
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return undefined;
  }

  private parseDecimal(value: unknown): Prisma.Decimal | undefined {
    if (typeof value === 'number') return new Prisma.Decimal(value);
    if (typeof value === 'string') {
      const cleaned = value.replace(/[€$£,\s]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) return new Prisma.Decimal(parsed);
    }
    return undefined;
  }

  private parseCriticality(value: unknown): Criticality | undefined {
    if (!value) return undefined;
    const str = String(value).toLowerCase().trim();
    const mapping: Record<string, Criticality> = {
      low: Criticality.low,
      låg: Criticality.low,
      matala: Criticality.low,
      '1': Criticality.low,
      medium: Criticality.medium,
      medel: Criticality.medium,
      keskitaso: Criticality.medium,
      '2': Criticality.medium,
      high: Criticality.high,
      hög: Criticality.high,
      korkea: Criticality.high,
      '3': Criticality.high,
      critical: Criticality.high,
    };
    return mapping[str];
  }
}
