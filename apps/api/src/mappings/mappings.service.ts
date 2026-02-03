import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { MappingsRepository, CreateMappingInput } from './mappings.repository';
import { ImportsRepository } from '../imports/imports.repository';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { UpdateMappingDto } from './dto/update-mapping.dto';
import { suggestMappings, MappingSuggestion } from './mapping-suggestions';
import {
  validateTargetFields,
  getCanonicalFieldsForApi,
  getRegistryFields,
  getFieldDefinition,
} from './canonical-registry';
import {
  findMatchingTemplates,
  getBestTemplate,
  TemplateMatchResult,
} from './template-matcher';
import { TargetEntity, Prisma } from '@prisma/client';
import type { ColumnProfile } from '../imports/column-profiler';

@Injectable()
export class MappingsService {
  private readonly logger = new Logger(MappingsService.name);

  constructor(
    private readonly repo: MappingsRepository,
    private readonly importsRepo: ImportsRepository,
  ) {}

  list(orgId: string, options?: { targetEntity?: TargetEntity; isTemplate?: boolean }) {
    return this.repo.findAll(orgId, options);
  }

  findById(orgId: string, id: string) {
    return this.repo.findById(orgId, id);
  }

  create(orgId: string, dto: CreateMappingDto) {
    // Validate all targetField values against the canonical registry
    const targetFields = dto.columns.map((c) => c.targetField);
    const validation = validateTargetFields(dto.targetEntity, targetFields);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid target field(s) for ${dto.targetEntity}: ${validation.invalidFields.join(', ')}. ` +
          `Valid fields are: ${getRegistryFields(dto.targetEntity).map((f) => f.key).join(', ')}`,
      );
    }

    // Auto-populate criticality from registry if not provided
    const columns = dto.columns.map((col) => {
      const fieldDef = getFieldDefinition(dto.targetEntity, col.targetField);
      return {
        sourceColumn: col.sourceColumn,
        targetField: col.targetField,
        transformation: col.transformation as Prisma.InputJsonValue | undefined,
        required: col.required ?? fieldDef?.required ?? false,
        criticality: col.criticality ?? fieldDef?.criticality,
      };
    });

    const input: CreateMappingInput = {
      name: dto.name,
      targetEntity: dto.targetEntity,
      isTemplate: dto.isTemplate,
      columns,
    };
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, dto: UpdateMappingDto) {
    const input: Partial<CreateMappingInput> = {};
    if (dto.name) input.name = dto.name;
    if (dto.targetEntity) input.targetEntity = dto.targetEntity;
    if (dto.isTemplate !== undefined) input.isTemplate = dto.isTemplate;

    if (dto.columns) {
      // Need to determine target entity for validation
      let targetEntity = dto.targetEntity;
      if (!targetEntity) {
        const existing = await this.repo.findById(orgId, id);
        if (!existing) {
          throw new NotFoundException('Mapping not found');
        }
        targetEntity = existing.targetEntity;
      }

      // Validate all targetField values against the canonical registry
      const targetFields = dto.columns.map((c) => c.targetField);
      const validation = validateTargetFields(targetEntity, targetFields);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid target field(s) for ${targetEntity}: ${validation.invalidFields.join(', ')}`,
        );
      }

      input.columns = dto.columns.map((col) => {
        const fieldDef = getFieldDefinition(targetEntity!, col.targetField);
        return {
          sourceColumn: col.sourceColumn,
          targetField: col.targetField,
          transformation: col.transformation as Prisma.InputJsonValue | undefined,
          required: col.required ?? fieldDef?.required ?? false,
          criticality: col.criticality ?? fieldDef?.criticality,
        };
      });
    }
    return this.repo.update(orgId, id, input);
  }

  delete(orgId: string, id: string) {
    return this.repo.delete(orgId, id);
  }

  /**
   * Get canonical field definitions for a target entity
   * Returns typed registry with full field metadata
   */
  getCanonicalFields(targetEntity?: TargetEntity) {
    return getCanonicalFieldsForApi(targetEntity);
  }

  /**
   * Generate mapping suggestions for an import's sheet
   */
  async getSuggestions(
    orgId: string,
    importId: string,
    sheetId: string,
  ): Promise<{ suggestions: MappingSuggestion[] }> {
    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = await this.importsRepo.findSheetById(importId, sheetId);
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

  /**
   * Validate a mapping against a sheet's headers
   */
  async validateMapping(
    orgId: string,
    mappingId: string,
    importId: string,
    sheetId: string,
  ): Promise<{
    valid: boolean;
    errors: Array<{ field: string; message: string }>;
    warnings: Array<{ field: string; message: string }>;
  }> {
    const mapping = await this.repo.findById(orgId, mappingId);
    if (!mapping) {
      throw new NotFoundException('Mapping not found');
    }

    const excelImport = await this.importsRepo.findById(orgId, importId);
    if (!excelImport) {
      throw new NotFoundException('Import not found');
    }

    const sheet = await this.importsRepo.findSheetById(importId, sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    const errors: Array<{ field: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
    const headerSet = new Set(sheet.headers.map((h) => h.toLowerCase()));

    // Validate all targetField values exist in registry
    const targetFields = mapping.columns.map((c) => c.targetField);
    const registryValidation = validateTargetFields(mapping.targetEntity, targetFields);
    if (!registryValidation.valid) {
      for (const invalidField of registryValidation.invalidFields) {
        errors.push({
          field: invalidField,
          message: `Invalid target field "${invalidField}" - not in canonical registry for ${mapping.targetEntity}`,
        });
      }
    }

    // Check each mapping column exists in sheet
    for (const col of mapping.columns) {
      const sourceExists = headerSet.has(col.sourceColumn.toLowerCase());

      if (!sourceExists) {
        if (col.required || col.criticality === 'law_critical') {
          errors.push({
            field: col.sourceColumn,
            message: `Required column "${col.sourceColumn}" not found in sheet`,
          });
        } else {
          warnings.push({
            field: col.sourceColumn,
            message: `Optional column "${col.sourceColumn}" not found in sheet`,
          });
        }
      }
    }

    // Check for law-critical fields that aren't mapped
    const registryFields = getRegistryFields(mapping.targetEntity);
    const mappedFields = new Set(mapping.columns.map((c) => c.targetField));

    for (const rf of registryFields) {
      if (rf.criticality === 'law_critical' && !mappedFields.has(rf.key)) {
        warnings.push({
          field: rf.key,
          message: `Law-critical field "${rf.key}" (${rf.label}) is not mapped`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Find matching templates for a sheet
   * Returns templates sorted by confidence
   */
  async findMatchingTemplates(
    orgId: string,
    importId: string,
    sheetId: string,
    targetEntity: TargetEntity,
  ): Promise<{
    matches: TemplateMatchResult[];
    bestMatch: TemplateMatchResult | null;
    autoApplyRecommended: boolean;
  }> {
    // Load templates for this entity
    const templates = await this.repo.findAll(orgId, {
      targetEntity,
      isTemplate: true,
    });

    if (templates.length === 0) {
      return { matches: [], bestMatch: null, autoApplyRecommended: false };
    }

    // Load sheet data
    const sheet = await this.importsRepo.findSheetById(importId, sheetId);
    if (!sheet) {
      throw new NotFoundException('Sheet not found');
    }

    // Convert templates to matching format
    const templatesForMatching = templates.map((t) => ({
      id: t.id,
      name: t.name,
      columns: t.columns.map((c) => ({
        sourceColumn: c.sourceColumn,
        targetField: c.targetField,
      })),
    }));

    // Find matches
    const sheetForMatching = {
      headers: sheet.headers,
      columnsProfile: sheet.columnsProfile as unknown as ColumnProfile[] | undefined,
    };

    const matches = findMatchingTemplates(templatesForMatching, sheetForMatching);
    const bestMatch = getBestTemplate(templatesForMatching, sheetForMatching, 0.7);

    return {
      matches,
      bestMatch,
      autoApplyRecommended: bestMatch !== null && bestMatch.confidence >= 0.7,
    };
  }

  /**
   * Get templates list for selection UI
   */
  async getTemplates(orgId: string, targetEntity?: TargetEntity) {
    return this.repo.findAll(orgId, {
      targetEntity,
      isTemplate: true,
    });
  }
}
