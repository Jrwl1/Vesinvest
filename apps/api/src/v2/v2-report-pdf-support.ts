import { DEFAULT_VESINVEST_GROUP_DEFINITIONS } from './vesinvest-contract';
import type {
  BaselineDatasetSource,
  DatasetProvenance,
  ReportSnapshot,
} from './v2-report-pdf.types';

const AUTHORITATIVE_VESINVEST_GROUP_LABELS = new Map(
  DEFAULT_VESINVEST_GROUP_DEFINITIONS.map((group) => [group.key, group.label] as const),
);

export const normalizeYearList = (
  values: Array<number | null | undefined>,
): number[] =>
  [...new Set(
    values.filter((value): value is number => Number.isFinite(value)).map((value) =>
      Math.trunc(value),
    ),
  )].sort((left, right) => left - right);

export const resolveAcceptedBaselineYears = (
  snapshot: ReportSnapshot,
): number[] => {
  const explicitYears = normalizeYearList(snapshot?.acceptedBaselineYears ?? []);
  if (explicitYears.length > 0) {
    return explicitYears;
  }
  return normalizeYearList([
    ...(snapshot?.baselineSourceSummaries ?? []).map((summary) => summary?.year),
    snapshot?.baselineSourceSummary?.year,
  ]);
};

export const formatAcceptedBaselineYears = (snapshot: ReportSnapshot): string => {
  const years = resolveAcceptedBaselineYears(snapshot);
  return years.length > 0 ? years.join(', ') : '-';
};

export const normalizeVesinvestClassLabel = (
  classKey: string | null | undefined,
  fallbackLabel: string | null | undefined,
): string => {
  const normalizedKey = String(classKey ?? '').trim();
  if (normalizedKey.length > 0) {
    const authoritativeLabel =
      AUTHORITATIVE_VESINVEST_GROUP_LABELS.get(normalizedKey);
    if (authoritativeLabel) {
      return authoritativeLabel;
    }
  }
  const normalizedFallback = String(fallbackLabel ?? '').trim();
  if (normalizedFallback.length > 0) {
    return normalizedFallback;
  }
  return normalizedKey || '-';
};

type SupportParams = {
  toPdfText: (value: string) => string;
  normalizeText: (value: string | null | undefined) => string | null;
  toNumber: (value: unknown) => number;
  pdfLocale: string;
};

export function createPdfReportSupport({
  toPdfText,
  normalizeText,
  toNumber,
  pdfLocale,
}: SupportParams) {
  const formatMoney = (value: number) =>
    `${Math.round(value).toLocaleString(pdfLocale)} EUR`;
  const formatPrice = (value: number) =>
    `${value.toLocaleString(pdfLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR/m3`;
  const formatPct = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${value.toLocaleString(pdfLocale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} %`;
  const formatServiceSplit = (value: 'water' | 'wastewater' | 'mixed') => {
    switch (value) {
      case 'water':
        return 'Water';
      case 'wastewater':
        return 'Wastewater';
      default:
        return 'Mixed';
    }
  };
  const formatDepreciationMethod = ({
    method,
    linearYears,
    residualPercent,
  }: {
    method: string;
    linearYears?: number | null;
    residualPercent?: number | null;
  }) => {
    switch (method) {
      case 'straight-line':
        return `Straight-line ${linearYears ?? 0} years`;
      case 'linear':
        return 'Linear';
      case 'residual':
        return `Residual ${residualPercent ?? 0} %`;
      case 'none':
      default:
        return 'No depreciation';
    }
  };
  const formatVolume = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value)
      ? '-'
      : `${Math.round(value).toLocaleString(pdfLocale)} m3`;
  const assumptionLabels: Record<string, string> = {
    inflaatio: 'Inflation',
    energiakerroin: 'Energy factor',
    henkilostokerroin: 'Personnel factor',
    vesimaaran_muutos: 'Volume change',
    hintakorotus: 'Price increase',
    perusmaksuMuutos: 'Base fee change',
    investointikerroin: 'Investment factor',
  };
  const formatAssumptionValue = (key: string, value: number) => {
    if (key === 'investointikerroin') {
      return toNumber(value).toLocaleString(pdfLocale, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      });
    }
    return formatPct(toNumber(value) * 100);
  };

  const collectDocumentImportRefs = (
    provenance: DatasetProvenance,
  ): NonNullable<DatasetProvenance>[] => {
    if (!provenance) {
      return [];
    }
    const refs: NonNullable<DatasetProvenance>[] = [provenance];
    for (const fieldSource of provenance.fieldSources ?? []) {
      if (fieldSource?.provenance) {
        refs.push(fieldSource.provenance);
      }
    }
    return refs.filter((item) => item.kind === 'document_import');
  };

  const collectProvenancesByKind = (
    provenance: DatasetProvenance,
    kind: string,
  ): NonNullable<DatasetProvenance>[] => {
    if (!provenance) {
      return [];
    }
    const refs: NonNullable<DatasetProvenance>[] = [provenance];
    for (const fieldSource of provenance.fieldSources ?? []) {
      if (fieldSource?.provenance) {
        refs.push(fieldSource.provenance);
      }
    }
    return refs.filter((item) => item.kind === kind);
  };

  const formatDocumentPageLabel = (pageNumbers: number[]) => {
    if (pageNumbers.length === 0) return null;
    if (pageNumbers.length === 1) return `p. ${pageNumbers[0]}`;
    return `pp. ${pageNumbers.join(', ')}`;
  };

  const getDocumentImportEvidence = (provenance: DatasetProvenance) => {
    const refs = collectDocumentImportRefs(provenance);
    if (refs.length === 0) {
      return {
        fileName: null as string | null,
        pageLabel: null as string | null,
        sourceLines: [] as string[],
      };
    }
    const fileName =
      refs.map((item) => item.fileName?.trim() ?? '').find((item) => item.length > 0) ??
      null;
    const pageNumbers = [...new Set(
      refs.flatMap((item) => [
        ...(Array.isArray(item.pageNumbers) ? item.pageNumbers : []),
        ...(item.pageNumber != null ? [item.pageNumber] : []),
        ...((item.sourceLines ?? [])
          .map((line) => line.pageNumber)
          .filter((pageNumber): pageNumber is number => pageNumber != null)),
      ]),
    )]
      .filter((pageNumber) => Number.isFinite(pageNumber))
      .sort((left, right) => left - right);
    const sourceLines = [...new Map(
      refs
        .flatMap((item) => item.sourceLines ?? [])
        .map((line) => {
          const text = line.text?.trim();
          if (!text) {
            return null;
          }
          const prefix =
            line.pageNumber != null && Number.isFinite(line.pageNumber)
              ? `p. ${line.pageNumber}: `
              : '';
          const rendered = `${prefix}${text}`;
          return [rendered, rendered] as const;
        })
        .filter((line): line is readonly [string, string] => line != null),
    ).values()].slice(0, 2);
    return {
      fileName,
      pageLabel: formatDocumentPageLabel(pageNumbers),
      sourceLines,
    };
  };

  const getImportedFileNameByKind = (
    provenance: DatasetProvenance,
    kind: string,
    fallback: string,
  ) =>
    collectProvenancesByKind(provenance, kind)
      .map((item) => item.fileName?.trim() ?? '')
      .find((item) => item.length > 0) ?? fallback;

  const formatDatasetSource = (
    dataset: BaselineDatasetSource | undefined,
    fallback: string,
  ) => {
    if (!dataset) return fallback;
    const documentEvidence = getDocumentImportEvidence(dataset.provenance);
    const documentFileName =
      documentEvidence.fileName ?? dataset.provenance?.fileName ?? 'PDF';
    const withDocumentPages = (value: string) =>
      documentEvidence.pageLabel ? `${value} | ${documentEvidence.pageLabel}` : value;
    const hasDocumentImport =
      dataset.provenance?.kind === 'document_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'document_import',
      ) ?? false);
    const hasStatementImport =
      dataset.provenance?.kind === 'statement_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) => item.provenance.kind === 'statement_import',
      ) ?? false);
    const hasWorkbookImport =
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import' ||
      (dataset.provenance?.fieldSources?.some(
        (item) =>
          item.provenance.kind === 'kva_import' ||
          item.provenance.kind === 'excel_import',
      ) ?? false);
    if (hasDocumentImport && hasWorkbookImport) {
      return withDocumentPages(
        `Source document + workbook repair (${documentFileName})`,
      );
    }
    if (hasStatementImport && hasWorkbookImport) {
      return `Statement PDF + workbook repair (${getImportedFileNameByKind(
        dataset.provenance,
        'statement_import',
        'OCR',
      )})`;
    }
    if (hasDocumentImport) {
      return withDocumentPages(`Source document (${documentFileName})`);
    }
    if (dataset.provenance?.kind === 'statement_import') {
      return `Statement PDF (${dataset.provenance.fileName ?? 'OCR'})`;
    }
    if (dataset.provenance?.kind === 'qdis_import') {
      return `QDIS PDF (${dataset.provenance.fileName ?? 'QDIS'})`;
    }
    if (
      dataset.provenance?.kind === 'kva_import' ||
      dataset.provenance?.kind === 'excel_import'
    ) {
      return `Workbook import (${dataset.provenance.fileName ?? 'Excel'})`;
    }
    if (dataset.source === 'manual') {
      return 'Manual review';
    }
    if (dataset.source === 'veeti') {
      return 'VEETI';
    }
    return fallback;
  };

  const formatDatasetEvidenceDetail = (dataset: BaselineDatasetSource | undefined) => {
    if (!dataset) {
      return null;
    }
    const documentEvidence = getDocumentImportEvidence(dataset.provenance);
    const parts = [documentEvidence.pageLabel, ...documentEvidence.sourceLines].filter(
      (value): value is string => Boolean(value),
    );
    return parts.length > 0 ? parts.join(' | ') : null;
  };

  const formatAllocationLines = (
    allocations:
      | Array<{
          year: number;
          totalAmount: number;
        }>
      | null
      | undefined,
  ) => {
    if (!allocations?.length) {
      return [] as string[];
    }
    const entries = [...allocations]
      .sort((left, right) => left.year - right.year)
      .map((allocation) => `${allocation.year}: ${formatMoney(allocation.totalAmount)}`);
    const lines: string[] = [];
    for (let index = 0; index < entries.length; index += 3) {
      lines.push(entries.slice(index, index + 3).join('  |  '));
    }
    return lines;
  };

  return {
    assumptionLabels,
    formatAllocationLines,
    formatAssumptionValue,
    formatDatasetEvidenceDetail,
    formatDatasetSource,
    formatDepreciationMethod,
    formatMoney,
    formatPct,
    formatPrice,
    formatServiceSplit,
    formatVolume,
    normalizeText,
    toPdfText,
  };
}
