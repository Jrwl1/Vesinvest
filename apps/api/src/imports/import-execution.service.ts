import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';
import { MappingsRepository } from '../mappings/mappings.repository';
import { ImportStatus, ImportAction, TargetEntity, AssetStatus, Criticality, Prisma } from '@prisma/client';
import { computeRowHash } from './row-hash';
import * as crypto from 'crypto';

/**
 * Match key strategy per Asset Identity Contract:
 * - 'externalRef' is the ONLY production strategy
 * - 'fallback_acknowledged' allows generating derived identities when explicitly requested
 * 
 * See: docs/IdentityContract/ASSET_IDENTITY_CONTRACT.md
 */
export type MatchKeyStrategy = 'externalRef' | 'fallback_acknowledged';

export interface ImportExecutionOptions {
  dryRun?: boolean;
  updateExisting?: boolean;
  /**
   * Only 'externalRef' should be used in production.
   * 'fallback_acknowledged' allows import when externalRef is missing,
   * but will generate derivedIdentity assets that should be fixed later.
   */
  matchKeyStrategy?: MatchKeyStrategy;
}

export interface ImportExecutionResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  unchanged: number; // Rows with same hash, no changes needed
  derivedIdentityCount: number; // Count of assets created with fallback identity
  errors: Array<{ row: number; message: string }>;
  warnings: Array<{ row: number; message: string }>;
  matchKeyUsed: MatchKeyStrategy;
  sampleErrors: Array<{ row: number; message: string }>; // First 5 errors for display
}

interface TransformationRule {
  dateFormat?: string;
  multiply?: number;
  divide?: number;
  defaultValue?: unknown;
  mapValues?: Record<string, string>;
}

/**
 * Intermediate asset data before identity resolution.
 * externalRef may be undefined here - the calling code handles fallback generation.
 */
interface AssetImportData {
  siteId: string;
  assetTypeId: string;
  name: string;
  externalRef?: string;
  installedOn?: Date;
  lifeYears?: number;
  replacementCostEur?: Prisma.Decimal;
  criticality: Criticality;
  status: AssetStatus;
  notes?: string;
  ownerRole?: string;
  sourceImportId?: string;
  sourceSheetName?: string;
  sourceRowNumber?: number;
}

@Injectable()
export class ImportExecutionService {
  private readonly logger = new Logger(ImportExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: ImportsRepository,
    private readonly mappingsRepo: MappingsRepository,
  ) {}

  async executeImport(
    orgId: string,
    importId: string,
    mappingId: string,
    sheetId: string,
    options?: ImportExecutionOptions,
  ): Promise<ImportExecutionResult> {
    const dryRun = options?.dryRun ?? false;
    const updateExisting = options?.updateExisting ?? true; // Default to true for idempotency
    // Per Asset Identity Contract: default to externalRef, only allow fallback_acknowledged if explicit
    const matchKeyStrategy = options?.matchKeyStrategy ?? 'externalRef';

    // Load import and validate
    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = excelImport.sheets.find((s) => s.id === sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Load mapping
    const mapping = await this.mappingsRepo.findById(orgId, mappingId);
    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }

    // Build column mapping lookup
    const columnMap = new Map<string, { targetField: string; transformation?: TransformationRule }>();
    for (const col of mapping.columns) {
      columnMap.set(col.sourceColumn.toLowerCase(), {
        targetField: col.targetField,
        transformation: col.transformation as TransformationRule | undefined,
      });
    }

    // Per Asset Identity Contract: externalRef is required
    const hasExternalRef = Array.from(columnMap.values()).some((m) => m.targetField === 'externalRef');
    
    if (!hasExternalRef && matchKeyStrategy === 'externalRef') {
      throw new BadRequestException(
        'externalRef mapping is required per Asset Identity Contract. ' +
        'Either map an externalRef column, or explicitly acknowledge fallback identity generation.'
      );
    }
    
    // Effective strategy is always externalRef - fallback_acknowledged just allows derived identity generation
    const effectiveMatchKey: MatchKeyStrategy = matchKeyStrategy;

    // We need the full Excel data - get it from the stored sample rows
    // In a production system, you might want to store the full data or re-parse the file
    const rows = (sheet.sampleRows as Record<string, unknown>[]) || [];

    if (rows.length === 0) {
      throw new BadRequestException('No data rows found in sheet');
    }

    const result: ImportExecutionResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      derivedIdentityCount: 0,
      errors: [],
      warnings: [],
      matchKeyUsed: effectiveMatchKey,
      sampleErrors: [],
    };

    // Process based on target entity
    if (mapping.targetEntity === TargetEntity.asset) {
      await this.executeAssetImport(
        orgId,
        importId,
        sheet.sheetName,
        rows,
        columnMap,
        result,
        { dryRun, updateExisting, matchKeyStrategy: effectiveMatchKey },
      );
    } else {
      throw new BadRequestException(`Import for ${mapping.targetEntity} not yet implemented`);
    }

    // Update import status
    if (!dryRun && result.errors.length === 0) {
      await this.importsRepo.updateStatus(orgId, importId, ImportStatus.imported);
    } else if (!dryRun && result.errors.length > 0 && result.created + result.updated === 0) {
      await this.importsRepo.updateStatus(orgId, importId, ImportStatus.failed);
    } else if (!dryRun) {
      // Partial success - some created/updated, some errors
      await this.importsRepo.updateStatus(orgId, importId, ImportStatus.imported);
    }

    // Populate sample errors for UI display
    result.sampleErrors = result.errors.slice(0, 5);
    result.success = result.errors.length === 0;
    return result;
  }

  /**
   * Generate a deterministic fallback externalRef per Asset Identity Contract.
   * Formula: hash(assetType + siteId + normalizedName)
   */
  private generateFallbackExternalRef(assetTypeId: string, siteId: string, name: string): string {
    const normalized = name.toLowerCase().trim().replace(/\s+/g, '_');
    const input = `${assetTypeId}|${siteId}|${normalized}`;
    return `DERIVED_${crypto.createHash('sha256').update(input).digest('hex').substring(0, 16)}`;
  }

  private async executeAssetImport(
    orgId: string,
    importId: string,
    sheetName: string,
    rows: Record<string, unknown>[],
    columnMap: Map<string, { targetField: string; transformation?: TransformationRule }>,
    result: ImportExecutionResult,
    options: { dryRun: boolean; updateExisting: boolean; matchKeyStrategy: MatchKeyStrategy },
  ): Promise<void> {
    // Load available sites and asset types for mapping
    const sites = await this.prisma.site.findMany({ where: { orgId } });
    const assetTypes = await this.prisma.assetType.findMany({ where: { orgId } });

    const siteMap = new Map(sites.map((s) => [s.name.toLowerCase(), s.id]));
    const assetTypeMap = new Map(assetTypes.map((t) => [t.code.toLowerCase(), t.id]));
    assetTypes.forEach((t) => assetTypeMap.set(t.name.toLowerCase(), t.id));

    // Check if externalRef is mapped
    const hasExternalRefMapping = Array.from(columnMap.values()).some(
      (m) => m.targetField === 'externalRef',
    );

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 for header row and 0-indexing

      try {
        // Compute row hash for idempotency
        const rowHash = computeRowHash(row, columnMap);

        // Check if this row was already imported
        const existingRecord = await this.importsRepo.findImportedRecordByRow(
          importId,
          sheetName,
          rowNum,
        );

        if (existingRecord) {
          // Row was previously imported - check if hash changed
          if (existingRecord.rowHash === rowHash) {
            // No changes, skip
            result.unchanged++;
            continue;
          }
          // Hash changed - will update if entity still exists
          this.logger.debug(`Row ${rowNum} hash changed: ${existingRecord.rowHash} -> ${rowHash}`);
        }

        const assetData = this.transformRowToAsset(
          row,
          columnMap,
          siteMap,
          assetTypeMap,
          result,
          rowNum,
        );

        if (!assetData) {
          result.skipped++;
          continue;
        }

        // === Asset Identity Contract Enforcement ===
        let derivedIdentity = false;
        
        if (!assetData.externalRef) {
          // No externalRef provided
          if (options.matchKeyStrategy !== 'fallback_acknowledged') {
            // Cannot proceed without externalRef unless fallback is acknowledged
            result.errors.push({
              row: rowNum,
              message: 'Missing externalRef (Asset Identity). Map an externalRef column or acknowledge fallback identity.',
            });
            continue;
          }
          
          // Generate fallback identity per contract: hash(assetType + siteId + normalizedName)
          assetData.externalRef = this.generateFallbackExternalRef(
            assetData.assetTypeId!,
            assetData.siteId!,
            assetData.name,
          );
          derivedIdentity = true;
          result.derivedIdentityCount++;
          
          result.warnings.push({
            row: rowNum,
            message: `Generated fallback identity: ${assetData.externalRef}. Should be replaced with real ID.`,
          });
        }

        // Add provenance
        assetData.sourceImportId = importId;
        assetData.sourceSheetName = sheetName;
        assetData.sourceRowNumber = rowNum;

        if (options.dryRun) {
          // In dry run, check if asset exists by externalRef
          const wouldExist = await this.prisma.asset.findUnique({
            where: { orgId_externalRef: { orgId, externalRef: assetData.externalRef } },
          });
          if (wouldExist || existingRecord) {
            result.updated++;
          } else {
            result.created++;
          }
          continue;
        }

        // === All matching is by externalRef per Identity Contract ===
        const matchKey = 'externalRef';
        const matchValue = assetData.externalRef;

        // Look up existing asset by externalRef (unique within org)
        let existingAsset = await this.prisma.asset.findUnique({
          where: { orgId_externalRef: { orgId, externalRef: assetData.externalRef } },
        });

        // Also check by previous import record's entityId for row-level idempotency
        if (!existingAsset && existingRecord) {
          existingAsset = await this.prisma.asset.findFirst({
            where: { id: existingRecord.entityId, orgId },
          });
        }

        let entityId: string;
        let action: ImportAction;

        if (existingAsset) {
          // Update existing - but externalRef is IMMUTABLE per Identity Contract
          // Only update non-identity fields
          const { externalRef: _ignored, ...updateData } = assetData;
          
          await this.prisma.asset.update({
            where: { id: existingAsset.id },
            data: {
              ...updateData,
              // Never update externalRef or derivedIdentity on existing assets
              orgId: undefined,
            },
          });
          entityId = existingAsset.id;
          action = ImportAction.updated;
          result.updated++;
        } else {
          // Create new asset with identity
          // At this point, externalRef is guaranteed to be set (from data or fallback)
          const created = await this.prisma.asset.create({
            data: {
              ...assetData,
              externalRef: assetData.externalRef!, // Guaranteed set above
              orgId,
              derivedIdentity,
            },
          });
          entityId = created.id;
          action = ImportAction.created;
          result.created++;
        }

        // Record the import for idempotency tracking
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
            sheetName,
            rowNumber: rowNum,
            rowHash,
            action,
            matchKey,
            matchValue,
          });
        }
      } catch (err) {
        result.errors.push({
          row: rowNum,
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  private transformRowToAsset(
    row: Record<string, unknown>,
    columnMap: Map<string, { targetField: string; transformation?: TransformationRule }>,
    siteMap: Map<string, string>,
    assetTypeMap: Map<string, string>,
    result: ImportExecutionResult,
    rowNum: number,
  ): AssetImportData | null {
    const getValue = (targetField: string): unknown => {
      for (const [sourceCol, mapping] of columnMap) {
        if (mapping.targetField === targetField) {
          const rawValue = this.getRowValue(row, sourceCol);
          return this.applyTransformation(rawValue, mapping.transformation);
        }
      }
      return undefined;
    };

    // Required fields
    const name = getValue('name');
    if (!name || typeof name !== 'string') {
      result.warnings.push({ row: rowNum, message: 'Missing or invalid name, skipping row' });
      return null;
    }

    // Site reference
    const siteValue = getValue('siteId');
    let siteId: string | undefined;
    if (siteValue && typeof siteValue === 'string') {
      siteId = siteMap.get(siteValue.toLowerCase());
      if (!siteId) {
        result.warnings.push({ row: rowNum, message: `Site "${siteValue}" not found` });
        return null;
      }
    }
    if (!siteId) {
      // Use first site as default if only one exists
      if (siteMap.size === 1) {
        siteId = Array.from(siteMap.values())[0];
      } else {
        result.warnings.push({ row: rowNum, message: 'No site specified and multiple sites exist' });
        return null;
      }
    }

    // Asset type reference
    const typeValue = getValue('assetTypeId');
    let assetTypeId: string | undefined;
    if (typeValue && typeof typeValue === 'string') {
      assetTypeId = assetTypeMap.get(typeValue.toLowerCase());
      if (!assetTypeId) {
        result.warnings.push({ row: rowNum, message: `Asset type "${typeValue}" not found` });
        return null;
      }
    }
    if (!assetTypeId) {
      // Use first type as default if only one exists
      if (assetTypeMap.size === 1) {
        assetTypeId = Array.from(assetTypeMap.values())[0];
      } else {
        result.warnings.push({ row: rowNum, message: 'No asset type specified and multiple types exist' });
        return null;
      }
    }

    // Optional fields with transformations
    const externalRef = getValue('externalRef');
    const installedOn = this.parseDate(getValue('installedOn'));
    const lifeYears = this.parseNumber(getValue('lifeYears'));
    const replacementCostEur = this.parseDecimal(getValue('replacementCostEur'));
    const criticality = this.parseCriticality(getValue('criticality'));
    const status = this.parseStatus(getValue('status'));
    const notes = getValue('notes');
    const ownerRole = getValue('ownerRole');

    return {
      siteId,
      assetTypeId,
      name: name as string,
      externalRef: typeof externalRef === 'string' ? externalRef : undefined,
      installedOn,
      lifeYears,
      replacementCostEur,
      criticality: criticality || Criticality.medium,
      status: status || AssetStatus.active,
      notes: typeof notes === 'string' ? notes : undefined,
      ownerRole: typeof ownerRole === 'string' ? ownerRole : undefined,
    };
  }

  private findMappedColumn(
    columnMap: Map<string, { targetField: string; transformation?: TransformationRule }>,
    targetField: string,
  ): string | undefined {
    for (const [sourceCol, mapping] of columnMap) {
      if (mapping.targetField === targetField) {
        return sourceCol;
      }
    }
    return undefined;
  }

  private getRowValue(row: Record<string, unknown>, columnName: string): unknown {
    // Case-insensitive lookup
    const lowerName = columnName.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return undefined;
  }

  private applyTransformation(value: unknown, transformation?: TransformationRule): unknown {
    if (value === null || value === undefined) {
      return transformation?.defaultValue ?? value;
    }

    if (transformation?.mapValues && typeof value === 'string') {
      const mapped = transformation.mapValues[value.toLowerCase()];
      if (mapped !== undefined) return mapped;
    }

    if (transformation?.multiply && typeof value === 'number') {
      return value * transformation.multiply;
    }

    if (transformation?.divide && typeof value === 'number') {
      return value / transformation.divide;
    }

    return value;
  }

  private parseDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    
    if (value instanceof Date) {
      return value;
    }
    
    if (typeof value === 'string') {
      // Try ISO format first
      const isoDate = new Date(value);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
      
      // Try year-only format
      const yearMatch = value.match(/^\d{4}$/);
      if (yearMatch) {
        return new Date(parseInt(value, 10), 0, 1);
      }
    }
    
    if (typeof value === 'number') {
      // Assume it's a year
      if (value > 1900 && value < 2100) {
        return new Date(value, 0, 1);
      }
      // Could be Excel serial date
      if (value > 25569) {
        const utc = (value - 25569) * 86400 * 1000;
        return new Date(utc);
      }
    }
    
    return undefined;
  }

  private parseNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) return undefined;
    
    if (typeof value === 'number') {
      return Math.round(value);
    }
    
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) return parsed;
    }
    
    return undefined;
  }

  private parseDecimal(value: unknown): Prisma.Decimal | undefined {
    if (value === null || value === undefined) return undefined;
    
    if (typeof value === 'number') {
      return new Prisma.Decimal(value);
    }
    
    if (typeof value === 'string') {
      // Remove currency symbols and thousand separators
      const cleaned = value.replace(/[€$£,\s]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed)) {
        return new Prisma.Decimal(parsed);
      }
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

  private parseStatus(value: unknown): AssetStatus | undefined {
    if (!value) return undefined;
    
    const str = String(value).toLowerCase().trim();
    
    const mapping: Record<string, AssetStatus> = {
      active: AssetStatus.active,
      aktiv: AssetStatus.active,
      aktiivinen: AssetStatus.active,
      'in use': AssetStatus.active,
      '1': AssetStatus.active,
      
      inactive: AssetStatus.inactive,
      inaktiv: AssetStatus.inactive,
      epäaktiivinen: AssetStatus.inactive,
      '0': AssetStatus.inactive,
      
      retired: AssetStatus.retired,
      pensionerad: AssetStatus.retired,
      poistettu: AssetStatus.retired,
      decommissioned: AssetStatus.retired,
    };
    
    return mapping[str];
  }
}
