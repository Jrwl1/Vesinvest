import { VeetiEffectiveDataService,type OverrideProvenance } from '../veeti/veeti-effective-data.service';
import { ManualYearCompletionDto } from './dto/manual-year-completion.dto';
import { IMPORT_YEAR_SUMMARY_FIELDS,MANUAL_YEAR_FINANCIAL_FIELD_MAPPINGS,STATEMENT_PREVIEW_FIELDS } from './v2-import-overview.constants';
import type {
  ImportYearSummarySourceField,
  OverrideProvenanceCore,
} from './v2-import-overview.types';

type ImportManualFinancialContext = {
  round2(value: number): number;
  toNumber(value: unknown): number;
};

export function createV2ImportManualFinancialSupport(
  ctx: ImportManualFinancialContext,
) {
  return {
    buildFinancialOverrideRow(
      year: number,
      financials: NonNullable<ManualYearCompletionDto['financials']>,
      yearDataset:
        | Awaited<ReturnType<VeetiEffectiveDataService['getYearDataset']>>
        | null,
      sourceMeta: Record<string, unknown>,
    ): Record<string, unknown> | null {
      const financialDataset =
        yearDataset?.datasets.find((row) => row.dataType === 'tilinpaatos') ??
        null;
      const baseRow = {
        ...(((financialDataset?.effectiveRows?.[0] ??
          financialDataset?.rawRows?.[0] ??
          {}) as Record<string, unknown>) ?? {}),
      };
      delete baseRow.__sourceMeta;
      baseRow.Vuosi = year;

      let hasExplicitFinancialValue = false;
      for (const mapping of MANUAL_YEAR_FINANCIAL_FIELD_MAPPINGS) {
        if (!Object.prototype.hasOwnProperty.call(financials, mapping.payloadKey)) {
          continue;
        }
        const value = financials[mapping.payloadKey];
        if (value == null) {
          continue;
        }
        baseRow[mapping.sourceField] = ctx.round2(ctx.toNumber(value));
        hasExplicitFinancialValue = true;
      }

      return hasExplicitFinancialValue
        ? {
            ...baseRow,
            __sourceMeta: sourceMeta,
          }
        : null;
    },

    mergeFinancialOverrideProvenance(
      current: OverrideProvenance | null,
      incoming: OverrideProvenanceCore,
    ): OverrideProvenance | null {
      const fieldSources = this.collectFinancialFieldSources(current);
      const incomingFields = this.collectIncomingFinancialFields(incoming);

      for (const sourceField of incomingFields) {
        fieldSources.set(sourceField, this.stripFieldSources(incoming));
      }

      if (fieldSources.size === 0) {
        return incoming;
      }

      return {
        ...incoming,
        fieldSources: IMPORT_YEAR_SUMMARY_FIELDS.map(({ sourceField }) => {
          const provenance = fieldSources.get(sourceField);
          return provenance ? { sourceField, provenance } : null;
        }).filter(
          (
            item,
          ): item is {
            sourceField: ImportYearSummarySourceField;
            provenance: OverrideProvenanceCore;
          } => item !== null,
        ),
      };
    },

    collectIncomingFinancialFields(
      provenance: OverrideProvenanceCore,
    ): ImportYearSummarySourceField[] {
      const explicitFields =
        provenance.kind === 'statement_import' ||
        provenance.kind === 'document_import'
          ? provenance.matchedFields
          : provenance.kind === 'kva_import' || provenance.kind === 'excel_import'
            ? provenance.confirmedSourceFields ?? []
            : [];

      return explicitFields
        .map((field: string) => this.toFinancialSourceField(field))
        .filter(
          (field: ImportYearSummarySourceField | null): field is ImportYearSummarySourceField =>
            field != null,
        );
    },

    collectFinancialFieldSources(
      provenance: OverrideProvenance | null,
    ): Map<ImportYearSummarySourceField, OverrideProvenanceCore> {
      const fieldSources = new Map<
        ImportYearSummarySourceField,
        OverrideProvenanceCore
      >();
      if (!provenance) {
        return fieldSources;
      }

      if (
        Array.isArray(provenance.fieldSources) &&
        provenance.fieldSources.length > 0
      ) {
        for (const fieldSource of provenance.fieldSources) {
          if (!this.isImportYearSummarySourceField(fieldSource.sourceField)) {
            continue;
          }
          fieldSources.set(
            fieldSource.sourceField,
            this.stripFieldSources(fieldSource.provenance),
          );
        }
        return fieldSources;
      }

      for (const sourceField of this.collectIncomingFinancialFields(provenance)) {
        fieldSources.set(sourceField, this.stripFieldSources(provenance));
      }

      return fieldSources;
    },

    stripFieldSources(
      provenance: OverrideProvenance | OverrideProvenanceCore,
    ): OverrideProvenanceCore {
      const core = { ...(provenance as OverrideProvenance) };
      delete core.fieldSources;
      return core;
    },

    isImportYearSummarySourceField(
      value: string,
    ): value is ImportYearSummarySourceField {
      return IMPORT_YEAR_SUMMARY_FIELDS.some((field) => field.sourceField === value);
    },

    toFinancialSourceField(value: string): ImportYearSummarySourceField | null {
      if (this.isImportYearSummarySourceField(value)) {
        return value;
      }
      const fromStatementPreview =
        STATEMENT_PREVIEW_FIELDS.find((field) => field.key === value)?.sourceField ??
        null;
      if (
        fromStatementPreview != null &&
        this.isImportYearSummarySourceField(fromStatementPreview)
      ) {
        return fromStatementPreview;
      }
      return null;
    },
  };
}
