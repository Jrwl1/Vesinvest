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
 * 
 * Data Row Detection:
 * - Automatically detects where data starts (skipping header/descriptor rows)
 * - Filters out header-like values from site detection (e.g., "Area", "Ägare")
 * - Supports manual site override to bypass site detection entirely
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
import {
  detectDataStartRow,
  sanitizeSiteValues,
  getDataRows,
  DataRowDetectionResult,
} from './data-row-detector';

export interface SheetDefaults {
  /** Default lifeYears if not in Excel */
  lifeYears?: number;
  /** Default replacement cost if not in Excel */
  replacementCostEur?: number;
  /** Default criticality if not in Excel */
  criticality?: Criticality;
  /** AssetType to use for all rows (by code or name) */
  assetType: string;
  /** Site to use for all rows (by name) - required unless siteOverrideId provided */
  site?: string;
}

export interface AutoExtractOptions {
  /** Sheet-level defaults for assumed fields */
  sheetDefaults: SheetDefaults;
  /** If true, preview only without creating assets */
  dryRun?: boolean;
  /** Allow fallback identity generation for rows without externalRef */
  allowFallbackIdentity?: boolean;
  /** If provided, use this site ID for all rows (bypasses site detection) */
  siteOverrideId?: string;
}

export type AssumedFieldSource = 'excel' | 'default' | 'derived' | 'manual' | 'missing';

export interface AssumedFieldEntry {
  source: AssumedFieldSource;
  value?: unknown;
  derivedFrom?: string;
}

export interface AssumedFieldStat {
  field: string;
  source: 'sheet-default' | 'assetType-default';
  value: string | number;
  rowCount: number;
}

export interface AutoExtractResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  unchanged: number;
  derivedIdentityCount: number;
  assumedFields: AssumedFieldStat[];
  detectedColumns: {
    externalRef?: string;
    name?: string;
    installedOn?: string;
    ageYears?: string;
    lifeYears?: string;
    replacementCostEur?: string;
    criticality?: string;
  };
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  sampleErrors: Array<{ row: number; message: string }>;
  infoMessages: string[];
  dataRowDetection?: DataRowDetectionResult;
  /** Count of rows with missing lifetime (after defaults) */
  missingLifeYearsCount?: number;
  /** Count of rows with missing replacement cost */
  missingReplacementCostCount?: number;
  /** Count of rows where installedOn was derived from ageYears */
  derivedInstalledOnCount?: number;
  /** Count of assets excluded from projection (missing lifetime or cost) */
  excludedFromProjectionCount?: number;
}

export interface AutoExtractAnalysisResult {
  detectedColumns: Record<string, string | undefined>;
  suggestedAssetType: string | null;
  rowCount: number;
  /** Actual data row count after skipping headers */
  dataRowCount: number;
  canAutoExtract: boolean;
  issues: string[];
  /** Sites detected in the import data (if a site column was found) */
  detectedSites: string[];
  /** Sites that exist in the organization */
  existingSites: Array<{ id: string; name: string }>;
  /** Sites detected in import that don't exist in organization */
  unknownSites: string[];
  /** True if there are no sites in the organization */
  noSitesExist: boolean;
  /** True if user needs to manually select a site (no valid sites detected from file) */
  needsSiteSelection: boolean;
  /** Info about skipped header/descriptor rows */
  dataRowDetection: DataRowDetectionResult;
  /** Whether site override is supported */
  supportsSiteOverride: boolean;
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
    const { sheetDefaults, dryRun = false, allowFallbackIdentity = true, siteOverrideId } = options;

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

    // Resolve site - either from override or from sheet defaults
    let site: { id: string; name: string } | null = null;
    
    if (siteOverrideId) {
      // Manual override - validate site exists and belongs to org
      site = await this.prisma.site.findFirst({
        where: { id: siteOverrideId, orgId },
        select: { id: true, name: true },
      });
      if (!site) {
        throw new BadRequestException('Selected site not found or does not belong to this organization.');
      }
      this.logger.log(`Using site override: ${site.name} (${site.id})`);
    } else if (sheetDefaults.site) {
      // Site specified by name
      site = await this.resolveSite(orgId, sheetDefaults.site);
      if (!site) {
        throw new BadRequestException(
          `Site "${sheetDefaults.site}" not found. Create this site first or select an existing one.`
        );
      }
    } else {
      throw new BadRequestException('Please specify a site for this import.');
    }

    // Auto-detect column mappings using suggestions
    const suggestions = suggestMappings(sheet.headers);
    const columnMap = this.buildAutoColumnMap(suggestions, sheet.headers);

    this.logger.log(
      `Auto-extract: detected columns: externalRef=${columnMap.externalRef}, ` +
        `name=${columnMap.name}, installedOn=${columnMap.installedOn}`,
    );

    if (!columnMap.name) {
      throw new BadRequestException(
        'Could not auto-detect a "name" column. Name is required; installation date or age column is needed for projections.',
      );
    }

    // Get rows and detect data start
    const allRows = (sheet.sampleRows as Record<string, unknown>[]) || [];
    if (allRows.length === 0) {
      throw new BadRequestException('No data rows found in sheet');
    }

    // Detect where data starts (skip header/descriptor rows)
    const { rows, detection } = getDataRows(allRows, sheet.headers, columnMap.externalRef);
    
    if (rows.length === 0) {
      throw new BadRequestException('No data rows found after skipping header rows');
    }

    this.logger.log(`Data row detection: ${detection.reason} (starting at row ${detection.dataStartIndex + 2})`);

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
      dataRowDetection: detection,
      missingLifeYearsCount: 0,
      missingReplacementCostCount: 0,
      derivedInstalledOnCount: 0,
      excludedFromProjectionCount: 0,
    };

    // Add info about skipped rows
    if (detection.skippedRows > 0) {
      result.infoMessages.push(
        `Skipped ${detection.skippedRows} header/descriptor row(s) at the start of the sheet.`
      );
    }

    // Track assumption statistics
    const assumptionCounts: Record<string, { source: 'sheet-default' | 'assetType-default'; value: unknown; count: number }> = {};

    // Resolve defaults (optional - do not use 0 as sentinel)
    const defaultLifeYears = sheetDefaults.lifeYears ?? assetType.defaultLifeYears ?? undefined;
    const defaultCriticality = sheetDefaults.criticality ?? undefined;
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
      // Row number: +2 for header, +dataStartIndex for skipped rows, +1 for 1-based
      const rowNum = i + detection.dataStartIndex + 2;

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

        // InstalledOn: from Excel or derived from ageYears (no 0 sentinel)
        let installedOn: Date | undefined = columnMap.installedOn
          ? this.parseDate(this.getRowValue(row, columnMap.installedOn))
          : undefined;
        const ageYearsRaw = columnMap.ageYears ? this.getRowValue(row, columnMap.ageYears) : undefined;
        const ageYearsExcel = this.parseNumber(ageYearsRaw);
        const currentYear = new Date().getUTCFullYear();

        const assumedFieldsRow: Record<string, AssumedFieldEntry> = {};

        if (installedOn) {
          assumedFieldsRow['installedOn'] = { source: 'excel', value: installedOn.toISOString().slice(0, 10) };
        } else if (ageYearsExcel !== undefined && ageYearsExcel >= 0 && ageYearsExcel < 500) {
          installedOn = new Date(Date.UTC(currentYear - ageYearsExcel, 0, 1));
          assumedFieldsRow['installedOn'] = {
            source: 'derived',
            value: installedOn.toISOString().slice(0, 10),
            derivedFrom: 'ageYears',
          };
          result.derivedInstalledOnCount = (result.derivedInstalledOnCount ?? 0) + 1;
        }

        // LifeYears - from Excel or default; if missing, leave null (never 0)
        let lifeYears: number | undefined;
        const lifeYearsRaw = columnMap.lifeYears ? this.getRowValue(row, columnMap.lifeYears) : undefined;
        if (lifeYearsRaw !== undefined && lifeYearsRaw !== null && lifeYearsRaw !== '') {
          const parsed = this.parseNumber(lifeYearsRaw);
          if (parsed !== undefined && parsed > 0) {
            lifeYears = parsed;
            assumedFieldsRow['lifeYears'] = { source: 'excel', value: lifeYears };
          }
        }
        if (lifeYears === undefined && defaultLifeYears !== undefined) {
          lifeYears = defaultLifeYears;
          const source = sheetDefaults.lifeYears ? 'sheet-default' : 'assetType-default';
          assumedFieldsRow['lifeYears'] = { source: 'default', value: lifeYears };
          this.incrementAssumption(assumptionCounts, 'lifeYears', source, defaultLifeYears);
        } else if (lifeYears === undefined) {
          assumedFieldsRow['lifeYears'] = { source: 'missing' };
          result.missingLifeYearsCount = (result.missingLifeYearsCount ?? 0) + 1;
        }

        // ReplacementCostEur - from Excel or default; if missing, leave null
        let replacementCostEur: Prisma.Decimal | undefined;
        const costRaw = columnMap.replacementCostEur ? this.getRowValue(row, columnMap.replacementCostEur) : undefined;
        if (costRaw !== undefined && costRaw !== null && costRaw !== '') {
          const parsedCost = this.parseDecimal(costRaw);
          // Never use 0 as sentinel for missing
          if (parsedCost !== undefined && Number(parsedCost) > 0) {
            replacementCostEur = parsedCost;
            assumedFieldsRow['replacementCostEur'] = { source: 'excel', value: Number(replacementCostEur) };
          }
        }
        if (replacementCostEur === undefined && defaultReplacementCost !== undefined) {
          replacementCostEur = new Prisma.Decimal(defaultReplacementCost);
          assumedFieldsRow['replacementCostEur'] = { source: 'default', value: defaultReplacementCost };
          this.incrementAssumption(assumptionCounts, 'replacementCostEur', 'sheet-default', defaultReplacementCost);
        } else if (replacementCostEur === undefined) {
          assumedFieldsRow['replacementCostEur'] = { source: 'missing' };
          result.missingReplacementCostCount = (result.missingReplacementCostCount ?? 0) + 1;
        }

        // Criticality - from Excel or default; if missing, leave null
        let criticality: Criticality | undefined;
        const criticalityRaw = columnMap.criticality ? this.getRowValue(row, columnMap.criticality) : undefined;
        const parsedCriticality = this.parseCriticality(criticalityRaw);
        if (parsedCriticality) {
          criticality = parsedCriticality;
          assumedFieldsRow['criticality'] = { source: 'excel', value: criticality };
        } else if (defaultCriticality) {
          criticality = defaultCriticality;
          assumedFieldsRow['criticality'] = { source: 'default', value: defaultCriticality };
          this.incrementAssumption(assumptionCounts, 'criticality', 'sheet-default', defaultCriticality);
        } else {
          assumedFieldsRow['criticality'] = { source: 'missing' };
        }

        const effectiveLifeYears = lifeYears ?? assetType.defaultLifeYears ?? null;
        const hasReplacementCost = replacementCostEur !== undefined;
        if (effectiveLifeYears === null || !hasReplacementCost) {
          result.excludedFromProjectionCount = (result.excludedFromProjectionCount ?? 0) + 1;
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
            result.errors.push({
              row: rowNum,
              message: this.toUserFriendlyError(err, 'checking existing asset'),
            });
          }
          continue;
        }

        // Create or update asset
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
          installedOn: installedOn ?? null,
          // ageYears is not stored; computed at API boundary from installedOn
          lifeYears: lifeYears ?? null,
          replacementCostEur: replacementCostEur ?? null,
          criticality: criticality ?? null,
          status: AssetStatus.active,
          sourceImportId: importId,
          sourceSheetName: sheet.sheetName,
          sourceRowNumber: rowNum,
          assumedFields: Object.keys(assumedFieldsRow).length > 0 ? (assumedFieldsRow as unknown as Prisma.InputJsonValue) : undefined,
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
            // Create new
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
    siteOverrideId?: string,
  ): Promise<AutoExtractAnalysisResult> {
    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = excelImport.sheets.find((s) => s.id === sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const sheetWithMeta = sheet as typeof sheet & { kind?: string; dataRowCount?: number };
    if (sheetWithMeta.kind === 'REFERENCE') {
      const existingSites = await this.prisma.site.findMany({
        where: { orgId },
        select: { id: true, name: true },
      });
      return {
        detectedColumns: {},
        suggestedAssetType: null,
        rowCount: sheet.rowCount,
        dataRowCount: sheetWithMeta.dataRowCount ?? 0,
        canAutoExtract: false,
        issues: ['Reference sheet (explanations) — ignored.'],
        detectedSites: [],
        existingSites,
        unknownSites: [],
        noSitesExist: existingSites.length === 0,
        needsSiteSelection: true,
        dataRowDetection: { dataStartIndex: 0, skippedRows: 0, reason: 'Reference sheet' },
        supportsSiteOverride: true,
      };
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
    if (!columnMap.installedOn && !columnMap.ageYears) {
      issues.push('No installation date or age column detected - dates will be empty or derived from age if provided');
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

    // Get all rows and detect data start
    const allRows = (sheet.sampleRows as Record<string, unknown>[]) || [];
    const { rows: dataRows, detection } = getDataRows(allRows, sheet.headers, columnMap.externalRef);

    // === Site Detection (with manual override support) ===
    const existingSites = await this.prisma.site.findMany({
      where: { orgId },
      select: { id: true, name: true },
    });
    const noSitesExist = existingSites.length === 0;
    const existingSiteNames = new Set(existingSites.map((s) => s.name.toLowerCase()));

    let detectedSites: string[] = [];
    let unknownSites: string[] = [];
    let needsSiteSelection = false;

    // If siteOverrideId is provided, skip site detection entirely
    if (siteOverrideId) {
      // Validate the override site exists
      const overrideSite = existingSites.find((s) => s.id === siteOverrideId);
      if (!overrideSite) {
        issues.push('Selected site not found');
      }
      // With override, we don't need site detection
      needsSiteSelection = false;
    } else if (noSitesExist) {
      // No sites exist - user must create one
      needsSiteSelection = true;
    } else if (columnMap.siteId) {
      // Detect sites from Excel data (only from actual data rows, not headers)
      const rawSiteValues: string[] = [];
      
      for (const row of dataRows) {
        const siteValue = this.getRowValue(row, columnMap.siteId);
        if (siteValue && typeof siteValue === 'string') {
          rawSiteValues.push(siteValue);
        }
      }

      // Sanitize site values (filter out header labels like "Area", "Ägare")
      const sanitized = sanitizeSiteValues(rawSiteValues, sheet.headers);
      detectedSites = sanitized.validSites;

      if (sanitized.hadFiltering && sanitized.filteredOut.length > 0) {
        this.logger.log(
          `Site detection: filtered out ${sanitized.filteredOut.length} header-like values: ${sanitized.filteredOut.slice(0, 5).join(', ')}`
        );
      }

      // Check which detected sites don't exist
      for (const siteName of detectedSites) {
        if (!existingSiteNames.has(siteName.toLowerCase())) {
          unknownSites.push(siteName);
        }
      }

      // If no valid sites detected from file, user needs to select
      if (detectedSites.length === 0) {
        needsSiteSelection = true;
      }
    } else {
      // No site column detected - user must select a site
      needsSiteSelection = true;
    }

    // Add issue if unknown sites detected (per Site Handling Contract)
    if (unknownSites.length > 0) {
      issues.push(
        `Found ${unknownSites.length} new location(s) not in system: ${unknownSites.slice(0, 3).join(', ')}${unknownSites.length > 3 ? '...' : ''}`
      );
    }

    const storedDataRowCount = sheetWithMeta.dataRowCount;
    const dataRowCount = storedDataRowCount != null ? storedDataRowCount : dataRows.length;

    return {
      detectedColumns: columnMap,
      suggestedAssetType,
      rowCount: sheet.rowCount,
      dataRowCount,
      canAutoExtract: !!columnMap.name,
      issues,
      detectedSites,
      existingSites,
      unknownSites,
      noSitesExist,
      needsSiteSelection,
      dataRowDetection: detection,
      supportsSiteOverride: true,
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
      ageYears: undefined,
      lifeYears: undefined,
      replacementCostEur: undefined,
      criticality: undefined,
      siteId: undefined,
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

  /**
   * Resolve site by name or ID.
   * Per Site Handling Contract: No implicit defaults - site must be explicitly specified.
   */
  private async resolveSite(orgId: string, siteRef?: string) {
    if (!siteRef) {
      return null;
    }
    return this.prisma.site.findFirst({
      where: {
        orgId,
        name: { equals: siteRef, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });
  }

  private generateFallbackExternalRef(assetTypeId: string, siteId: string, name: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
    const input = `${assetTypeId}|${siteId}|${normalized}`;
    return `DERIVED_${crypto.createHash('sha256').update(input).digest('hex').substring(0, 16)}`;
  }

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

  private toUserFriendlyError(err: unknown, context: string): string {
    this.logger.error(`Error during ${context}:`, err);
    
    if (err instanceof Error) {
      const msg = err.message.toLowerCase();
      
      if (msg.includes('unique constraint') || msg.includes('duplicate')) {
        return 'An asset with this identifier already exists.';
      }
      
      if (msg.includes('foreign key') || msg.includes('fkey')) {
        return 'Referenced data (site or asset type) not found.';
      }
      
      if (msg.includes('invalid') && (msg.includes('invocation') || msg.includes('argument'))) {
        return 'Data format issue detected. This row will be skipped.';
      }
      
      if (msg.includes('connect') || msg.includes('timeout')) {
        return 'Database temporarily unavailable. Please try again.';
      }
    }
    
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
