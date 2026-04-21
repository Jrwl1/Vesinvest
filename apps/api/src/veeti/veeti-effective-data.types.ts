import { VEETI_IMPORT_DATA_TYPES } from './veeti-import-contract';
import type { VeetiDataType } from './veeti.service';

export const VEETI_DATA_TYPES: VeetiDataType[] = [...VEETI_IMPORT_DATA_TYPES];

export type YearSourceStatus = 'VEETI' | 'MANUAL' | 'MIXED' | 'INCOMPLETE';
export type SyncRequirement = 'financials' | 'prices' | 'volumes';
export type YearWarningCode =
  | 'missing_financials'
  | 'missing_prices'
  | 'missing_volumes'
  | 'fallback_zero_used';

export type OverrideMeta = {
  editedAt: Date;
  editedBy: string | null;
  reason: string | null;
  provenance: OverrideProvenance | null;
};

export type OverrideProvenanceRef = {
  kind:
    | 'manual_edit'
    | 'statement_import'
    | 'qdis_import'
    | 'document_import'
    | 'kva_import'
    | 'excel_import';
  fileName: string | null;
  pageNumber: number | null;
  pageNumbers?: number[];
  confidence: number | null;
  scannedPageCount: number | null;
  matchedFields: string[];
  warnings: string[];
  documentProfile?:
    | 'generic_pdf'
    | 'statement_pdf'
    | 'qdis_pdf'
    | 'unknown_pdf'
    | null;
  datasetKinds?: Array<'financials' | 'prices' | 'volumes'>;
  sourceLines?: Array<{
    text: string;
    pageNumber: number | null;
  }>;
  sheetName?: string | null;
  matchedYears?: number[];
  confirmedSourceFields?: string[];
  candidateRows?: Array<{
    sourceField: string;
    workbookValue: number | null;
    action: 'keep_veeti' | 'apply_workbook';
  }>;
};

export type OverrideFinancialFieldSource = {
  sourceField: string;
  provenance: OverrideProvenanceRef;
};

export type OverrideProvenance = OverrideProvenanceRef & {
  fieldSources?: OverrideFinancialFieldSource[];
};

export type EffectiveRowsResult = {
  rows: Array<Record<string, unknown>>;
  source: 'veeti' | 'manual' | 'none';
  hasRawSnapshot: boolean;
  hasOverride: boolean;
  overrideMeta: OverrideMeta | null;
};

export type EffectiveYearInfo = {
  vuosi: number;
  dataTypes: string[];
  datasetCounts: Record<VeetiDataType, number>;
  completeness: {
    tilinpaatos: boolean;
    taksa: boolean;
    volume_vesi: boolean;
    volume_jatevesi: boolean;
    investointi: boolean;
    energia: boolean;
    verkko: boolean;
  };
  sourceStatus: YearSourceStatus;
  missingRequirements: SyncRequirement[];
  warnings: YearWarningCode[];
  sourceBreakdown: {
    veetiDataTypes: string[];
    manualDataTypes: string[];
  };
  manualEditedAt: string | null;
  manualEditedBy: string | null;
  manualReason: string | null;
  manualProvenance: OverrideProvenance | null;
};

