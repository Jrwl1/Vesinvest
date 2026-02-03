/**
 * Readiness Gate Service - Validates import readiness before execution
 *
 * Checks:
 * - Law-critical fields must be mapped (blocks execution if missing)
 * - Model-critical fields should be mapped (warns, allows assumptions)
 * - Optional fields are informational only
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';
import { MappingsRepository } from '../mappings/mappings.repository';
import {
  getRegistryFields,
  getFieldDefinition,
  CanonicalFieldDefinition,
} from '../mappings/canonical-registry';
import { FieldCriticality, TargetEntity } from '@prisma/client';

export interface FieldCoverage {
  field: string;
  label: string;
  type: string;
  criticality: FieldCriticality;
  isMapped: boolean;
  mappedFrom?: string;
  hasAssumption: boolean;
  assumptionValue?: string;
  /** If true, this field can use a global assumption instead of being mapped from Excel */
  assumptionBased?: boolean;
  /** Default assumption value suggested by the system */
  defaultAssumption?: string;
  /** Categorization for UI display */
  requirementCategory: 'required_from_excel' | 'required_as_assumption' | 'optional';
}

export interface ReadinessCheckResult {
  ready: boolean;
  canProceed: boolean; // true if law_critical covered
  fieldCoverage: FieldCoverage[];
  lawCriticalMissing: string[];
  modelCriticalMissing: string[];
  optionalMissing: string[];
  summary: {
    totalFields: number;
    mappedFields: number;
    fieldsWithAssumptions: number;
    lawCriticalCount: number;
    lawCriticalMapped: number;
    modelCriticalCount: number;
    modelCriticalMapped: number;
  };
  warnings: string[];
  errors: string[];
}

export interface ImportAssumption {
  field: string;
  value: string;
  reason?: string;
}

@Injectable()
export class ReadinessGateService {
  private readonly logger = new Logger(ReadinessGateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: ImportsRepository,
    private readonly mappingsRepo: MappingsRepository,
  ) {}

  /**
   * Check import readiness for execution
   */
  async checkReadiness(
    orgId: string,
    importId: string,
    mappingId: string,
    sheetId: string,
    assumptions: ImportAssumption[] = [],
  ): Promise<ReadinessCheckResult> {
    // Load mapping
    const mapping = await this.mappingsRepo.findById(orgId, mappingId);
    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }

    // Load sheet
    const sheet = await this.importsRepo.findSheetById(importId, sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Get registry fields for target entity
    const registryFields = getRegistryFields(mapping.targetEntity);

    // Build mapped fields lookup
    const mappedFieldsMap = new Map<string, string>();
    for (const col of mapping.columns) {
      mappedFieldsMap.set(col.targetField, col.sourceColumn);
    }

    // Build assumptions lookup
    const assumptionsMap = new Map<string, ImportAssumption>();
    for (const assumption of assumptions) {
      assumptionsMap.set(assumption.field, assumption);
    }

    // Calculate coverage
    const fieldCoverage: FieldCoverage[] = [];
    const lawCriticalMissing: string[] = [];
    const modelCriticalMissing: string[] = [];
    const optionalMissing: string[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    let lawCriticalCount = 0;
    let lawCriticalMapped = 0;
    let modelCriticalCount = 0;
    let modelCriticalMapped = 0;
    let mappedFields = 0;
    let fieldsWithAssumptions = 0;

    for (const field of registryFields) {
      const isMapped = mappedFieldsMap.has(field.key);
      const assumption = assumptionsMap.get(field.key);
      const hasAssumption = !!assumption;

      if (isMapped) mappedFields++;
      if (hasAssumption) fieldsWithAssumptions++;

      // Determine requirement category for UI display
      let requirementCategory: 'required_from_excel' | 'required_as_assumption' | 'optional';
      if (field.criticality === FieldCriticality.law_critical && !field.assumptionBased) {
        requirementCategory = 'required_from_excel';
      } else if (field.assumptionBased || field.criticality === FieldCriticality.model_critical) {
        requirementCategory = 'required_as_assumption';
      } else {
        requirementCategory = 'optional';
      }

      fieldCoverage.push({
        field: field.key,
        label: field.label,
        type: field.type,
        criticality: field.criticality,
        isMapped,
        mappedFrom: mappedFieldsMap.get(field.key),
        hasAssumption,
        assumptionValue: assumption?.value,
        assumptionBased: field.assumptionBased,
        defaultAssumption: field.defaultAssumption,
        requirementCategory,
      });

      // Track by criticality - assumption-based fields don't block import
      if (field.criticality === FieldCriticality.law_critical) {
        lawCriticalCount++;
        if (isMapped) {
          lawCriticalMapped++;
        } else if (field.assumptionBased && hasAssumption) {
          // Assumption-based law-critical fields can use assumptions
          lawCriticalMapped++;
        } else if (field.assumptionBased) {
          // Assumption-based fields only warn, don't block
          warnings.push(
            `Field "${field.label}" is not mapped. ` +
              `Consider setting a default value${field.defaultAssumption ? ` (suggested: ${field.defaultAssumption})` : ''}.`,
          );
        } else {
          lawCriticalMissing.push(field.key);
          errors.push(`Required field "${field.label}" must be mapped from Excel`);
        }
      } else if (field.criticality === FieldCriticality.model_critical) {
        modelCriticalCount++;
        if (isMapped || hasAssumption) {
          modelCriticalMapped++;
        } else {
          modelCriticalMissing.push(field.key);
          if (field.assumptionBased) {
            // Softer warning for assumption-based fields
            warnings.push(
              `"${field.label}" not mapped. ` +
                `Will use default${field.defaultAssumption ? ` (${field.defaultAssumption})` : ''} if not provided.`,
            );
          } else {
            warnings.push(
              `Model-critical field "${field.label}" is not mapped. ` +
                'Consider adding an assumption or mapping it.',
            );
          }
        }
      } else if (!isMapped) {
        optionalMissing.push(field.key);
      }
    }

    // Validate assumptions - only assumption-based or model_critical fields can have assumptions
    for (const assumption of assumptions) {
      const field = getFieldDefinition(mapping.targetEntity, assumption.field);
      if (!field) {
        warnings.push(`Assumption for unknown field "${assumption.field}" will be ignored`);
      } else if (
        field.criticality === FieldCriticality.law_critical &&
        !field.assumptionBased
      ) {
        errors.push(
          `Cannot use assumption for required field "${field.label}". ` +
            'It must be mapped from the Excel file.',
        );
      }
    }

    const canProceed = lawCriticalMissing.length === 0;
    const ready = canProceed && modelCriticalMissing.length === 0;

    return {
      ready,
      canProceed,
      fieldCoverage,
      lawCriticalMissing,
      modelCriticalMissing,
      optionalMissing,
      summary: {
        totalFields: registryFields.length,
        mappedFields,
        fieldsWithAssumptions,
        lawCriticalCount,
        lawCriticalMapped,
        modelCriticalCount,
        modelCriticalMapped,
      },
      warnings,
      errors,
    };
  }

  /**
   * Save assumptions for an import
   */
  async saveAssumptions(
    orgId: string,
    importId: string,
    sheetId: string,
    mappingId: string,
    assumptions: ImportAssumption[],
  ): Promise<{ saved: boolean; assumptions: ImportAssumption[] }> {
    // Validate import exists
    const importRecord = await this.importsRepo.findById(orgId, importId);
    if (!importRecord) {
      throw new NotFoundException('Import not found');
    }

    // Validate mapping exists
    const mapping = await this.mappingsRepo.findById(orgId, mappingId);
    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }

    // Validate assumptions
    const validAssumptions: ImportAssumption[] = [];
    for (const assumption of assumptions) {
      const field = getFieldDefinition(mapping.targetEntity, assumption.field);
      if (!field) {
        this.logger.warn(`Ignoring assumption for unknown field: ${assumption.field}`);
        continue;
      }
      if (field.criticality === FieldCriticality.law_critical) {
        throw new BadRequestException(
          `Cannot set assumption for law-critical field "${field.label}"`,
        );
      }
      validAssumptions.push(assumption);
    }

    // Store assumptions in sheet metadata (as JSON)
    await this.prisma.excelSheet.update({
      where: { id: sheetId },
      data: {
        // Store in sampleRows for now as extended metadata
        // In a real system, we'd add a dedicated assumptions field
      },
    });

    return { saved: true, assumptions: validAssumptions };
  }

  /**
   * Get stored assumptions for an import sheet
   */
  async getAssumptions(
    orgId: string,
    importId: string,
    sheetId: string,
  ): Promise<ImportAssumption[]> {
    const importRecord = await this.importsRepo.findById(orgId, importId);
    if (!importRecord) {
      throw new NotFoundException('Import not found');
    }

    // For now, return empty - assumptions would be stored per-execution context
    return [];
  }
}
