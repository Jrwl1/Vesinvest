import { BadRequestException } from '@nestjs/common';
import { VeetiEffectiveDataService,type OverrideProvenance } from '../veeti/veeti-effective-data.service';
import {
  ALLOWED_STATEMENT_CONTENT_TYPES,
  ALLOWED_STATEMENT_EXTENSIONS,
  ALLOWED_WORKBOOK_CONTENT_TYPES,
  ALLOWED_WORKBOOK_EXTENSIONS,
  IMPORT_YEAR_SUMMARY_FIELDS,
  STATEMENT_PREVIEW_FIELDS,
  STATEMENT_PREVIEW_MAX_BYTES,
  WORKBOOK_PREVIEW_MAX_BYTES,
} from './v2-import-overview.constants';
import type {
  ImportYearResultToZeroSignal,
  ImportYearSubrowAvailability,
  ImportYearSummaryRow,
  ImportYearSummarySource,
  ImportYearSummarySourceField,
  ImportYearTrustSignal,
  StatementPreviewRequest,
  StatementPreviewResponse,
  WorkbookPreviewRequest,
} from './v2-import-overview.types';

type ImportOverviewProvenanceContext = {
  round2(value: number): number;
  toNumber(value: unknown): number;
  normalizeNonNegativeNullable(value: number | null): number | null;
  summaryValuesDiffer(left: number | null, right: number | null): boolean;
};

export function createV2ImportOverviewProvenanceModel(
  ctx: ImportOverviewProvenanceContext,
) {
  return {
    buildImportYearSummaryRows(
      yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    ): ImportYearSummaryRow[] {
      const financialDataset =
        yearDataset.datasets.find((row) => row.dataType === 'tilinpaatos') ??
        null;
      const rawFinancials = (financialDataset?.rawRows?.[0] ??
        null) as Record<string, unknown> | null;
      const effectiveFinancials = (financialDataset?.effectiveRows?.[0] ??
        null) as Record<string, unknown> | null;

      if (!rawFinancials && !effectiveFinancials) {
        return [];
      }

      const buildRowValues = (sourceField: ImportYearSummarySourceField) => {
        const raw = this.readSummaryField(rawFinancials, sourceField);
        const effective = this.readSummaryField(effectiveFinancials, sourceField);
        const normalizeValue =
          sourceField === 'TilikaudenYliJaama'
            ? (value: number | null) => value
            : (value: number | null) => ctx.normalizeNonNegativeNullable(value);
        return {
          rawValue: normalizeValue(raw.value),
          effectiveValue: normalizeValue(effective.value),
          rawSource: raw.source,
          effectiveSource: effective.source,
        };
      };

      return IMPORT_YEAR_SUMMARY_FIELDS.map(({ key, sourceField }) => {
        const values = buildRowValues(sourceField);
        return {
          key,
          sourceField,
          rawValue: values.rawValue,
          effectiveValue: values.effectiveValue,
          changed: ctx.summaryValuesDiffer(values.rawValue, values.effectiveValue),
          rawSource: values.rawSource,
          effectiveSource: values.effectiveSource,
        };
      });
    },

    buildImportYearTrustSignal(
      yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
      summaryRows: ImportYearSummaryRow[],
    ): ImportYearTrustSignal {
      const changedSummaryKeys = summaryRows
        .filter((row) => row.changed)
        .map((row) => row.key);
      const statementImport = this.findDatasetProvenanceByKind(
        yearDataset.datasets,
        ['statement_import'],
      );
      const documentImport = this.findDatasetProvenanceByKind(
        yearDataset.datasets,
        ['document_import'],
      );
      const workbookImport = this.findDatasetProvenanceByKind(yearDataset.datasets, [
        'kva_import',
        'excel_import',
      ]);
      const reasons = new Set<ImportYearTrustSignal['reasons'][number]>();

      if (statementImport) {
        reasons.add('statement_import');
      }
      if (documentImport) {
        reasons.add('document_import');
      }
      if (workbookImport) {
        reasons.add('workbook_import');
      } else if (
        yearDataset.datasets.some(
          (dataset) =>
            (dataset.overrideMeta?.provenance as { kind?: string } | undefined)
              ?.kind === 'qdis_import',
        )
      ) {
        reasons.add('qdis_import');
      } else if (yearDataset.hasManualOverrides && changedSummaryKeys.length > 0) {
        reasons.add('manual_override');
      }
      if (yearDataset.sourceStatus === 'MIXED') {
        reasons.add('mixed_source');
      }
      if (yearDataset.sourceStatus === 'INCOMPLETE') {
        reasons.add('incomplete_source');
      }
      if (changedSummaryKeys.includes('result')) {
        reasons.add('result_changed');
      }

      return {
        level:
          changedSummaryKeys.length > 0 &&
          (statementImport != null ||
            documentImport != null ||
            yearDataset.hasManualOverrides)
            ? 'material'
            : reasons.size > 0
              ? 'review'
              : 'none',
        reasons: [...reasons],
        changedSummaryKeys,
        statementImport,
        documentImport,
        workbookImport,
      };
    },

    findDatasetProvenanceByKind(
      datasets: Array<
        Awaited<
          ReturnType<VeetiEffectiveDataService['getYearDataset']>
        >['datasets'][number]
      >,
      kinds: Array<OverrideProvenance['kind']>,
    ): OverrideProvenance | null {
      for (const dataset of datasets) {
        const provenance = dataset.overrideMeta?.provenance ?? null;
        if (!provenance) continue;
        if (kinds.includes(provenance.kind)) {
          return provenance;
        }
        const fieldSource = provenance.fieldSources?.find((item) =>
          kinds.includes(item.provenance.kind),
        );
        if (fieldSource) {
          return {
            ...fieldSource.provenance,
            fieldSources: [
              {
                sourceField: fieldSource.sourceField,
                provenance: fieldSource.provenance,
              },
            ],
          };
        }
      }
      return null;
    },

    buildImportYearResultToZeroSignal(
      summaryRows: ImportYearSummaryRow[],
    ): ImportYearResultToZeroSignal {
      const revenueRow = summaryRows.find((row) => row.key === 'revenue') ?? null;
      const resultRow = summaryRows.find((row) => row.key === 'result') ?? null;
      const rawValue = resultRow?.rawValue ?? null;
      const effectiveValue = resultRow?.effectiveValue ?? null;
      const delta =
        rawValue == null || effectiveValue == null
          ? null
          : ctx.round2(effectiveValue - rawValue);
      const absoluteGap =
        effectiveValue == null ? null : ctx.round2(Math.abs(effectiveValue));
      const marginPct =
        revenueRow?.effectiveValue == null ||
        revenueRow.effectiveValue === 0 ||
        effectiveValue == null
          ? null
          : ctx.round2((effectiveValue / revenueRow.effectiveValue) * 100);

      return {
        rawValue,
        effectiveValue,
        delta,
        absoluteGap,
        marginPct,
        direction:
          effectiveValue == null
            ? 'missing'
            : Math.abs(effectiveValue) <= 0.005
              ? 'at_zero'
              : effectiveValue > 0
                ? 'above_zero'
                : 'below_zero',
      };
    },

    readSummaryField(
      row: Record<string, unknown> | null,
      sourceKey: string,
    ): { value: number | null; source: ImportYearSummarySource } {
      const value = this.toNullableNumber(row?.[sourceKey]);
      return {
        value,
        source: value == null ? 'missing' : 'direct',
      };
    },

    buildImportYearSubrowAvailability(
      yearDataset: Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>,
    ): ImportYearSubrowAvailability {
      const financialDataset =
        yearDataset.datasets.find((row) => row.dataType === 'tilinpaatos') ??
        null;
      return {
        truthfulSubrowsAvailable: false,
        reason: 'year_summary_only',
        rawRowCount: financialDataset?.rawRows?.length ?? 0,
        effectiveRowCount: financialDataset?.effectiveRows?.length ?? 0,
      };
    },

    normalizeText(value: string | null | undefined): string | null {
      if (value == null) return null;
      let out = value;

      if (/\\u[0-9a-fA-F]{4}/.test(out)) {
        out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => {
          const codePoint = Number.parseInt(hex, 16);
          return Number.isFinite(codePoint) ? String.fromCharCode(codePoint) : '';
        });
      }

      if (/[\u00c3\u00c2\u00e2]/.test(out)) {
        const recovered = Buffer.from(out, 'latin1').toString('utf8');
        if (this.looksRecoveredText(recovered, out)) {
          out = recovered;
        }
      }

      return out;
    },

    formatIsoDate(value: Date | string): string {
      const parsed = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value instanceof Date ? parsed.toISOString().slice(0, 10) : value;
      }
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    buildDefaultScenarioName(value: Date | string): string {
      return `Scenario ${this.formatIsoDate(value)}`;
    },

    buildDefaultReportTitle(
      scenarioName: string | null | undefined,
      value: Date | string,
    ): string {
      const safeScenarioName =
        this.normalizeText(scenarioName)?.trim() || 'Scenario';
      return `Forecast report ${safeScenarioName} ${this.formatIsoDate(value)}`;
    },

    looksRecoveredText(candidate: string, original: string): boolean {
      const badPattern = /[\u00c3\u00c2\u00e2]/;
      if (badPattern.test(candidate)) return false;
      const candidateScore = (candidate.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
        .length;
      const originalScore = (original.match(/[A-Za-z0-9\u00C0-\u017F]/g) ?? [])
        .length;
      return candidateScore >= originalScore;
    },

    toPdfText(value: string): string {
      const sanitized = value
        .replace(/[\u00A0\u202F]/g, ' ')
        .replace(/[\u2010-\u2015\u2212]/g, '-')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\u2026/g, '...');

      return Array.from(sanitized)
        .map((char) => {
          const codePoint = char.codePointAt(0) ?? 0x3f;
          return codePoint === 0x09 ||
            codePoint === 0x0a ||
            codePoint === 0x0d ||
            (codePoint >= 0x20 && codePoint <= 0xff)
            ? char
            : '?';
        })
        .join('');
    },

    buildStatementPreviewFields(
      veetiRow: Record<string, unknown> | null,
      effectiveRow: Record<string, unknown> | null,
    ): StatementPreviewResponse['fields'] {
      return STATEMENT_PREVIEW_FIELDS.map((field) => {
        const veetiValue =
          veetiRow == null ? null : this.toNullableNumber(veetiRow[field.sourceField]);
        const effectiveValue =
          effectiveRow == null
            ? null
            : this.toNullableNumber(effectiveRow[field.sourceField]);

        return {
          key: field.key,
          label: field.label,
          sourceField: field.sourceField,
          veetiValue,
          effectiveValue,
          extractedValue: null,
          proposedValue: null,
          changed: false,
        };
      });
    },

    assertWorkbookPreviewUpload(input: WorkbookPreviewRequest) {
      this.assertUploadMetadata(
        {
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          fileBuffer: input.fileBuffer,
        },
        {
          maxBytes: WORKBOOK_PREVIEW_MAX_BYTES,
          allowedExtensions: ALLOWED_WORKBOOK_EXTENSIONS,
          allowedContentTypes: ALLOWED_WORKBOOK_CONTENT_TYPES,
          missingFileMessage: 'Workbook file is required.',
          invalidTypeMessage:
            'Workbook preview only supports .xlsx or .xlsm uploads.',
          invalidSignatureMessage:
            'Workbook preview only supports OpenXML workbook uploads.',
          signatureCheck: (buffer) => this.isZipContainer(buffer),
        },
      );
    },

    assertStatementPreviewUpload(input: StatementPreviewRequest) {
      this.assertUploadMetadata(
        {
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          fileBuffer: input.fileBuffer,
        },
        {
          maxBytes: STATEMENT_PREVIEW_MAX_BYTES,
          allowedExtensions: ALLOWED_STATEMENT_EXTENSIONS,
          allowedContentTypes: ALLOWED_STATEMENT_CONTENT_TYPES,
          missingFileMessage: 'Statement PDF file is required.',
          invalidTypeMessage: 'Statement preview only supports PDF uploads.',
          invalidSignatureMessage: 'Statement preview only supports PDF uploads.',
          signatureCheck: (buffer) => this.isPdfBuffer(buffer),
        },
      );
    },

    assertUploadMetadata(
      input: {
        fileName: string | null;
        contentType: string | null;
        sizeBytes: number;
        fileBuffer: Buffer | null;
      },
      options: {
        maxBytes: number;
        allowedExtensions: Set<string>;
        allowedContentTypes: Set<string>;
        missingFileMessage: string;
        invalidTypeMessage: string;
        invalidSignatureMessage: string;
        signatureCheck: (buffer: Buffer) => boolean;
      },
    ) {
      if (!input.fileBuffer || input.fileBuffer.length === 0 || !input.fileName) {
        throw new BadRequestException(options.missingFileMessage);
      }

      const fileName = input.fileName.trim();
      const extension = this.extractFileExtension(fileName);
      const normalizedContentType = input.contentType?.trim().toLowerCase() ?? null;

      if (!extension || !options.allowedExtensions.has(extension)) {
        throw new BadRequestException(options.invalidTypeMessage);
      }

      if (
        normalizedContentType &&
        !options.allowedContentTypes.has(normalizedContentType)
      ) {
        throw new BadRequestException(options.invalidTypeMessage);
      }

      const reportedSize = Math.max(0, Math.round(Number(input.sizeBytes) || 0));
      const actualSize = input.fileBuffer.length;
      const effectiveSize = reportedSize > 0 ? reportedSize : actualSize;

      if (effectiveSize <= 0 || effectiveSize > options.maxBytes) {
        throw new BadRequestException(
          `Uploaded file exceeds the ${options.maxBytes} byte limit.`,
        );
      }

      if (actualSize > options.maxBytes) {
        throw new BadRequestException(
          `Uploaded file exceeds the ${options.maxBytes} byte limit.`,
        );
      }

      if (!options.signatureCheck(input.fileBuffer)) {
        throw new BadRequestException(options.invalidSignatureMessage);
      }
    },

    extractFileExtension(fileName: string): string | null {
      const normalized = fileName.trim().toLowerCase();
      const lastDot = normalized.lastIndexOf('.');
      if (lastDot <= 0 || lastDot === normalized.length - 1) {
        return null;
      }
      return normalized.slice(lastDot);
    },

    isZipContainer(buffer: Buffer): boolean {
      if (buffer.length < 4) return false;
      return (
        (buffer[0] === 0x50 &&
          buffer[1] === 0x4b &&
          buffer[2] === 0x03 &&
          buffer[3] === 0x04) ||
        (buffer[0] === 0x50 &&
          buffer[1] === 0x4b &&
          buffer[2] === 0x05 &&
          buffer[3] === 0x06) ||
        (buffer[0] === 0x50 &&
          buffer[1] === 0x4b &&
          buffer[2] === 0x07 &&
          buffer[3] === 0x08)
      );
    },

    isPdfBuffer(buffer: Buffer): boolean {
      return (
        buffer.length >= 5 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46 &&
        buffer[4] === 0x2d
      );
    },

    toNullableNumber(value: unknown): number | null {
      if (value == null || value === '') return null;
      const parsed = ctx.toNumber(value);
      return Number.isFinite(parsed) ? parsed : null;
    },
  };
}
