import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImportsRepository } from './imports.repository';
import { MappingsRepository } from '../mappings/mappings.repository';
import { FieldCriticality, TargetEntity } from '@prisma/client';
import { getCanonicalFields } from '../mappings/mapping-suggestions';

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'mapping' | 'data' | 'reference' | 'compliance';
  field?: string;
  row?: number;
  message: string;
  impact: string;
  suggestion?: string;
}

export interface ValidationSummary {
  canProceed: boolean;
  lawCriticalMissing: number;
  modelCriticalMissing: number;
  dataIssues: number;
  referenceIssues: number;
}

export interface ValidationReport {
  valid: boolean;
  summary: ValidationSummary;
  issues: ValidationIssue[];
  fieldCoverage: {
    field: string;
    criticality: FieldCriticality;
    mapped: boolean;
    mappedTo?: string;
    coverage: number; // Percentage of rows with non-null values
    sampleValues?: string[];
  }[];
}

// Law-critical field requirements with explanations
const FIELD_REQUIREMENTS: Record<
  string,
  { criticality: FieldCriticality; whyItMatters: string; complianceNote?: string }
> = {
  name: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Asset identification is required for regulatory reporting and audit trails.',
    complianceNote: 'Finnish water law requires identifiable asset records.',
  },
  assetTypeId: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Asset categorization is essential for renewal planning and cost allocation.',
    complianceNote: 'Regulatory reports require assets grouped by category.',
  },
  installedOn: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Installation date determines asset age and replacement timing calculations.',
    complianceNote: 'Age-based renewal projections require installation dates.',
  },
  lifeYears: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Expected lifetime is needed to calculate when assets will need replacement.',
    complianceNote: 'Renewal planning requires explicit lifetime assumptions.',
  },
  replacementCostEur: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Replacement cost is required for investment planning and tariff calculations.',
    complianceNote: 'Financial projections require cost data.',
  },
  criticality: {
    criticality: FieldCriticality.law_critical,
    whyItMatters: 'Criticality determines priority in renewal planning and risk assessment.',
    complianceNote: 'Risk-based planning requires criticality classification.',
  },
  siteId: {
    criticality: FieldCriticality.model_critical,
    whyItMatters: 'Site assignment enables location-based planning and reporting.',
  },
  status: {
    criticality: FieldCriticality.model_critical,
    whyItMatters: 'Status filters active assets from retired ones in projections.',
  },
  externalRef: {
    criticality: FieldCriticality.optional,
    whyItMatters: 'External reference enables matching with existing systems.',
  },
  notes: {
    criticality: FieldCriticality.optional,
    whyItMatters: 'Notes provide context and documentation for audits.',
  },
};

@Injectable()
export class ImportValidationService {
  private readonly logger = new Logger(ImportValidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importsRepo: ImportsRepository,
    private readonly mappingsRepo: MappingsRepository,
  ) {}

  async generateValidationReport(
    orgId: string,
    importId: string,
    mappingId: string,
    sheetId: string,
  ): Promise<ValidationReport> {
    // Load import
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

    const issues: ValidationIssue[] = [];
    const rows = (sheet.sampleRows as Record<string, unknown>[]) || [];

    // Build column mapping lookup
    const columnMap = new Map<string, string>();
    const reverseMap = new Map<string, string>();
    for (const col of mapping.columns) {
      columnMap.set(col.sourceColumn.toLowerCase(), col.targetField);
      reverseMap.set(col.targetField, col.sourceColumn);
    }

    // Check field coverage
    const fieldCoverage: ValidationReport['fieldCoverage'] = [];
    const canonicalFields = getCanonicalFields();

    for (const cf of canonicalFields) {
      const sourceColumn = reverseMap.get(cf.field);
      const mapped = !!sourceColumn;
      
      let coverage = 0;
      const sampleValues: string[] = [];

      if (mapped && rows.length > 0) {
        let nonNullCount = 0;
        for (const row of rows) {
          const value = this.getRowValue(row, sourceColumn!);
          if (value !== null && value !== undefined && value !== '') {
            nonNullCount++;
            if (sampleValues.length < 3) {
              sampleValues.push(String(value).slice(0, 50));
            }
          }
        }
        coverage = Math.round((nonNullCount / rows.length) * 100);
      }

      fieldCoverage.push({
        field: cf.field,
        criticality: cf.criticality as FieldCriticality,
        mapped,
        mappedTo: sourceColumn,
        coverage,
        sampleValues: sampleValues.length > 0 ? sampleValues : undefined,
      });

      // Generate issues for unmapped or low-coverage fields
      const req = FIELD_REQUIREMENTS[cf.field];
      if (!req) continue;

      if (!mapped) {
        if (req.criticality === FieldCriticality.law_critical) {
          issues.push({
            severity: 'error',
            category: 'compliance',
            field: cf.field,
            message: `Law-critical field "${cf.field}" is not mapped`,
            impact: req.whyItMatters,
            suggestion: `Map one of your Excel columns to "${cf.field}". Example headers: ${cf.examples.join(', ')}`,
          });
        } else if (req.criticality === FieldCriticality.model_critical) {
          issues.push({
            severity: 'warning',
            category: 'mapping',
            field: cf.field,
            message: `Important field "${cf.field}" is not mapped`,
            impact: req.whyItMatters,
            suggestion: `Consider mapping a column to "${cf.field}" for better projections.`,
          });
        }
      } else if (coverage < 50 && req.criticality === FieldCriticality.law_critical) {
        issues.push({
          severity: 'warning',
          category: 'data',
          field: cf.field,
          message: `Field "${cf.field}" has low data coverage (${coverage}%)`,
          impact: `${100 - coverage}% of rows are missing this required field.`,
          suggestion: 'Fill in missing values in your Excel file before importing.',
        });
      } else if (coverage < 80 && req.criticality === FieldCriticality.model_critical) {
        issues.push({
          severity: 'info',
          category: 'data',
          field: cf.field,
          message: `Field "${cf.field}" has partial data coverage (${coverage}%)`,
          impact: `Some projections may be incomplete due to missing data.`,
        });
      }
    }

    // Check reference data availability
    if (mapping.targetEntity === TargetEntity.asset) {
      await this.validateAssetReferences(orgId, rows, columnMap, reverseMap, issues);
    }

    // Calculate summary
    const lawCriticalMissing = issues.filter(
      (i) => i.severity === 'error' && i.category === 'compliance',
    ).length;
    const modelCriticalMissing = issues.filter(
      (i) => i.severity === 'warning' && i.category === 'mapping',
    ).length;
    const dataIssues = issues.filter((i) => i.category === 'data').length;
    const referenceIssues = issues.filter((i) => i.category === 'reference').length;

    return {
      valid: lawCriticalMissing === 0,
      summary: {
        canProceed: lawCriticalMissing === 0 && referenceIssues === 0,
        lawCriticalMissing,
        modelCriticalMissing,
        dataIssues,
        referenceIssues,
      },
      issues,
      fieldCoverage,
    };
  }

  private async validateAssetReferences(
    orgId: string,
    rows: Record<string, unknown>[],
    columnMap: Map<string, string>,
    reverseMap: Map<string, string>,
    issues: ValidationIssue[],
  ): Promise<void> {
    // Check sites
    const siteColumn = reverseMap.get('siteId');
    if (siteColumn) {
      const sites = await this.prisma.site.findMany({ where: { orgId } });
      const siteNames = new Set(sites.map((s) => s.name.toLowerCase()));

      const unmatchedSites = new Set<string>();
      for (const row of rows) {
        const siteValue = this.getRowValue(row, siteColumn);
        if (siteValue && typeof siteValue === 'string') {
          if (!siteNames.has(siteValue.toLowerCase())) {
            unmatchedSites.add(siteValue);
          }
        }
      }

      if (unmatchedSites.size > 0) {
        const examples = Array.from(unmatchedSites).slice(0, 3);
        issues.push({
          severity: 'error',
          category: 'reference',
          field: 'siteId',
          message: `${unmatchedSites.size} site value(s) don't match existing sites`,
          impact: 'Rows with unmatched sites cannot be imported.',
          suggestion: `Create these sites first or correct the values: ${examples.join(', ')}${unmatchedSites.size > 3 ? '...' : ''}`,
        });
      }
    } else if ((await this.prisma.site.count({ where: { orgId } })) === 0) {
      issues.push({
        severity: 'error',
        category: 'reference',
        field: 'siteId',
        message: 'No sites exist in the organization',
        impact: 'Assets must be assigned to a site.',
        suggestion: 'Create at least one site before importing assets.',
      });
    }

    // Check asset types
    const typeColumn = reverseMap.get('assetTypeId');
    if (typeColumn) {
      const types = await this.prisma.assetType.findMany({ where: { orgId } });
      const typeNames = new Set([
        ...types.map((t) => t.code.toLowerCase()),
        ...types.map((t) => t.name.toLowerCase()),
      ]);

      const unmatchedTypes = new Set<string>();
      for (const row of rows) {
        const typeValue = this.getRowValue(row, typeColumn);
        if (typeValue && typeof typeValue === 'string') {
          if (!typeNames.has(typeValue.toLowerCase())) {
            unmatchedTypes.add(typeValue);
          }
        }
      }

      if (unmatchedTypes.size > 0) {
        const examples = Array.from(unmatchedTypes).slice(0, 3);
        issues.push({
          severity: 'error',
          category: 'reference',
          field: 'assetTypeId',
          message: `${unmatchedTypes.size} asset type value(s) don't match existing types`,
          impact: 'Rows with unmatched types cannot be imported.',
          suggestion: `Create these asset types first or correct the values: ${examples.join(', ')}${unmatchedTypes.size > 3 ? '...' : ''}`,
        });
      }
    } else if ((await this.prisma.assetType.count({ where: { orgId } })) === 0) {
      issues.push({
        severity: 'error',
        category: 'reference',
        field: 'assetTypeId',
        message: 'No asset types exist in the organization',
        impact: 'Assets must have an asset type.',
        suggestion: 'Create at least one asset type before importing assets.',
      });
    }
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
}
