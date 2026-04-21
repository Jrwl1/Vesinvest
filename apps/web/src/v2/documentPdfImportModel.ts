import type {
  V2DocumentImportDatasetKind,
  V2DocumentImportProfile,
  V2DocumentImportSourceLine,
} from '../api';
import {
  extractFinancialAmount,
  extractPriceAmount,
  extractVolumeAmount,
  isQdisPriceField,
  mergeCandidateMatches,
  mergeMatches,
  normalizeFinancialImportValue,
  selectPreferredMatches,
  uniqueSourceLines,
} from './documentPdfImportParsing';
import type { QdisImportResult } from './qdisPdfImport';
import type { StatementOcrResult } from './statementOcr';

export type DocumentImportMatchKey =
  | 'liikevaihto'
  | 'aineetJaPalvelut'
  | 'henkilostokulut'
  | 'liiketoiminnanMuutKulut'
  | 'poistot'
  | 'rahoitustuototJaKulut'
  | 'tilikaudenYliJaama'
  | 'waterUnitPrice'
  | 'wastewaterUnitPrice'
  | 'soldWaterVolume'
  | 'soldWastewaterVolume';

type GenericFieldDefinition = {
  key: DocumentImportMatchKey;
  label: string;
  datasetKind: V2DocumentImportDatasetKind;
  patterns: RegExp[];
  extractor: (line: string) => number | null;
};

export type DocumentImportFieldMatch = {
  key: DocumentImportMatchKey;
  label: string;
  value: number;
  datasetKind: V2DocumentImportDatasetKind;
  sourceLine: string;
  pageNumber: number | null;
};

export type DocumentImportPreview = {
  fileName: string;
  pageNumber: number | null;
  scannedPageCount: number;
  confidence: number | null;
  documentProfile: V2DocumentImportProfile;
  datasetKinds: V2DocumentImportDatasetKind[];
  matchedFields: string[];
  warnings: string[];
  sourceLines: V2DocumentImportSourceLine[];
  financials: Partial<
    Record<
      | 'liikevaihto'
      | 'aineetJaPalvelut'
      | 'henkilostokulut'
      | 'liiketoiminnanMuutKulut'
      | 'poistot'
      | 'rahoitustuototJaKulut'
      | 'tilikaudenYliJaama',
      number
    >
  >;
  prices: Partial<Record<'waterUnitPrice' | 'wastewaterUnitPrice', number>>;
  volumes: Partial<Record<'soldWaterVolume' | 'soldWastewaterVolume', number>>;
  matches: DocumentImportFieldMatch[];
  candidateMatches?: DocumentImportFieldMatch[];
  rawText: string;
};

type GenericDocumentParseResult = {
  matches: DocumentImportFieldMatch[];
  warnings: string[];
};

const GENERIC_FIELD_DEFINITIONS: GenericFieldDefinition[] = [
  {
    key: 'liikevaihto',
    label: 'Revenue',
    datasetKind: 'financials',
    patterns: [
      /\bliikevaihto\b/i,
      /\bomsattning\b/i,
      /\brevenue\b/i,
      /\bmyyntituotot\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'aineetJaPalvelut',
    label: 'Materials and services',
    datasetKind: 'financials',
    patterns: [
      /\baineet\s+ja\s+palvelut\b/i,
      /\bmaterials?\s+and\s+services\b/i,
      /\bmaterials?\b/i,
      /\btjanster\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'henkilostokulut',
    label: 'Personnel costs',
    datasetKind: 'financials',
    patterns: [
      /\bhenkilostokulut\b/i,
      /\bpersonalkostnader\b/i,
      /\bpersonnel\b/i,
      /\bwages?\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'liiketoiminnanMuutKulut',
    label: 'Other operating costs',
    datasetKind: 'financials',
    patterns: [
      /\bliiketoiminnan\s+muut\s+kulut\b/i,
      /\bother\s+operating\s+costs\b/i,
      /\bovriga\s+(?:drifts|rorelse)kostnader\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'poistot',
    label: 'Depreciation',
    datasetKind: 'financials',
    patterns: [/\bpoistot\b/i, /\bavskrivningar\b/i, /\bdepreciation\b/i],
    extractor: extractFinancialAmount,
  },
  {
    key: 'rahoitustuototJaKulut',
    label: 'Net finance',
    datasetKind: 'financials',
    patterns: [
      /\brahoitustuotot\s+ja\s+kulut\b/i,
      /\bnet\s+finance\b/i,
      /\bfinansiella\s+intakter\s+och\s+kostnader\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'tilikaudenYliJaama',
    label: 'Year result',
    datasetKind: 'financials',
    patterns: [
      /\btilikauden\s+(?:ylijaama|alijaama)\b/i,
      /\byear\s+result\b/i,
      /\brakenskapsperiodens\s+vinst\b/i,
      /\btulos\b/i,
    ],
    extractor: extractFinancialAmount,
  },
  {
    key: 'waterUnitPrice',
    label: 'Water unit price',
    datasetKind: 'prices',
    patterns: [/\bvesi(?:maksu|hinta)?\b/i, /\bvatten\b/i, /\bwater\b/i],
    extractor: extractPriceAmount,
  },
  {
    key: 'wastewaterUnitPrice',
    label: 'Wastewater unit price',
    datasetKind: 'prices',
    patterns: [
      /\bjatevesi(?:maksu|hinta)?\b/i,
      /\bavlopp\b/i,
      /\bspill\b/i,
      /\bwastewater\b/i,
    ],
    extractor: extractPriceAmount,
  },
  {
    key: 'soldWaterVolume',
    label: 'Sold water volume',
    datasetKind: 'volumes',
    patterns: [
      /\bmyyty\b.*\bvesi\b/i,
      /\bsold\b.*\bwater\b/i,
      /\bvatten(?:mangd|mangden)?\b/i,
      /\bwater\s+volume\b/i,
      /\bvesimaar(a|ä)\b/i,
    ],
    extractor: extractVolumeAmount,
  },
  {
    key: 'soldWastewaterVolume',
    label: 'Sold wastewater volume',
    datasetKind: 'volumes',
    patterns: [
      /\bmyyty\b.*\bjatevesi\b/i,
      /\bsold\b.*\bwastewater\b/i,
      /\bavloppsmangd\b/i,
      /\bwastewater\s+volume\b/i,
      /\bjatevesimaar(a|ä)\b/i,
    ],
    extractor: extractVolumeAmount,
  },
];

export function getDocumentImportCandidateKeys(
  preview: Pick<DocumentImportPreview, 'candidateMatches' | 'matches'>,
): DocumentImportMatchKey[] {
  return unique(
    (preview.candidateMatches ?? preview.matches).map((match) => match.key),
  );
}

export function getDocumentImportSelectedPageNumbers(
  preview: { matches: Array<{ pageNumber: number | null }> },
): number[] {
  return unique(
    preview.matches
      .map((match) => match.pageNumber)
      .filter((pageNumber): pageNumber is number =>
        Number.isFinite(pageNumber ?? null),
      ),
  ).sort((left, right) => left - right);
}

export function requiresDocumentImportConfidenceReview(
  preview: Pick<DocumentImportPreview, 'documentProfile' | 'confidence'>,
): boolean {
  return (
    preview.documentProfile === 'generic_pdf' ||
    preview.documentProfile === 'unknown_pdf' ||
    preview.confidence == null ||
    preview.confidence < 80
  );
}

export function clearDocumentImportMatchSelections(
  preview: DocumentImportPreview,
): DocumentImportPreview {
  return {
    ...preview,
    candidateMatches: preview.candidateMatches ?? preview.matches,
    pageNumber: null,
    matchedFields: [],
    matches: [],
    sourceLines: [],
    financials: {},
    prices: {},
    volumes: {},
  };
}

export function getDocumentImportSelectedSourceLines(
  preview: {
    matches: Array<{ sourceLine: string; pageNumber: number | null }>;
  },
): V2DocumentImportSourceLine[] {
  return buildSourceLines(
    preview.matches.map((match) => ({
      sourceLine: match.sourceLine,
      pageNumber: match.pageNumber,
    })),
  );
}

export function buildDocumentImportPreviewFromStatement(
  result: StatementOcrResult,
): DocumentImportPreview {
  return buildPreviewFromMatches({
    fileName: result.fileName,
    pageNumber: result.pageNumber,
    scannedPageCount: result.scannedPageCount,
    confidence: result.confidence,
    documentProfile: 'statement_pdf',
    matches: result.matches.map((match) => ({
      key: match.key,
      label: match.label,
      value: match.value,
      datasetKind: 'financials',
      sourceLine: match.sourceLine,
      pageNumber: match.pageNumber ?? result.pageNumber,
    })),
    warnings: result.warnings,
    rawText: result.rawText,
  });
}

export function buildDocumentImportPreviewFromQdis(
  result: QdisImportResult,
): DocumentImportPreview {
  return buildPreviewFromMatches({
    fileName: result.fileName,
    pageNumber: result.pageNumber,
    scannedPageCount: result.scannedPageCount,
    confidence: result.confidence,
    documentProfile: 'qdis_pdf',
    matches: result.matches.map((match) => ({
      key: match.key,
      label: match.label,
      value: match.value,
      datasetKind: isQdisPriceField(match.key) ? 'prices' : 'volumes',
      sourceLine: match.sourceLine,
      pageNumber: match.pageNumber ?? result.pageNumber,
    })),
    warnings: result.warnings,
    rawText: result.rawText,
  });
}

export function buildDocumentImportPreviewFromUnknownLayout(params: {
  fileName: string;
  pageNumber: number | null;
  scannedPageCount: number;
  confidence: number | null;
  matches: DocumentImportFieldMatch[];
  warnings: string[];
  rawText: string;
}): DocumentImportPreview {
  const selectedMatches = selectPreferredMatches(params.matches);
  return buildPreviewFromMatches({
    ...params,
    matches: selectedMatches,
    candidateMatches: params.matches,
    documentProfile: 'unknown_pdf',
  });
}

export function applyDocumentImportMatchSelection(params: {
  preview: DocumentImportPreview;
  key: DocumentImportMatchKey;
  selectedMatch: DocumentImportFieldMatch | null;
}): DocumentImportPreview {
  const { preview, key, selectedMatch } = params;
  const candidateMatches = preview.candidateMatches ?? preview.matches;
  const matchesByKey = new Map(
    preview.matches
      .filter((match) => match.key !== key)
      .map((match) => [match.key, match] as const),
  );

  if (selectedMatch != null) {
    matchesByKey.set(key, selectedMatch);
  }

  const orderedKeys = unique(candidateMatches.map((match) => match.key));
  const nextMatches = orderedKeys.flatMap((matchKey) =>
    matchesByKey.has(matchKey) ? [matchesByKey.get(matchKey)!] : [],
  );

  return buildPreviewFromMatches({
    fileName: preview.fileName,
    pageNumber: preview.pageNumber,
    scannedPageCount: preview.scannedPageCount,
    confidence: preview.confidence,
    documentProfile: preview.documentProfile,
    matches: nextMatches,
    candidateMatches,
    warnings: preview.warnings,
    rawText: preview.rawText,
  });
}

export function parseGenericDocumentText(
  text: string,
  pageNumber: number | null,
): GenericDocumentParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const matches: DocumentImportFieldMatch[] = [];

  for (const line of lines) {
    for (const definition of GENERIC_FIELD_DEFINITIONS) {
      if (!definition.patterns.some((pattern) => pattern.test(line))) {
        continue;
      }
      const value = definition.extractor(line);
      if (value == null) {
        continue;
      }
      matches.push({
        key: definition.key,
        label: definition.label,
        value,
        datasetKind: definition.datasetKind,
        sourceLine: line,
        pageNumber,
      });
    }
  }

  return {
    matches,
    warnings: [],
  };
}

export function mergeDocumentImportPreviews(
  previews: DocumentImportPreview[],
): DocumentImportPreview | null {
  if (previews.length === 0) {
    return null;
  }
  const [primary, ...rest] = previews;
  const merged = rest.reduce<DocumentImportPreview>(
    (combined, preview) => ({
      fileName: combined.fileName,
      pageNumber: combined.pageNumber ?? preview.pageNumber,
      scannedPageCount: Math.max(
        combined.scannedPageCount,
        preview.scannedPageCount,
      ),
      confidence:
        combined.confidence == null
          ? preview.confidence
          : preview.confidence == null
            ? combined.confidence
            : Math.max(combined.confidence, preview.confidence),
      documentProfile:
        combined.documentProfile === preview.documentProfile
          ? combined.documentProfile
          : 'generic_pdf',
      datasetKinds: unique([...combined.datasetKinds, ...preview.datasetKinds]),
      matchedFields: unique([...combined.matchedFields, ...preview.matchedFields]),
      warnings: unique([...combined.warnings, ...preview.warnings]),
      sourceLines: uniqueSourceLines([...combined.sourceLines, ...preview.sourceLines]),
      financials: {
        ...combined.financials,
        ...preview.financials,
      },
      prices: {
        ...combined.prices,
        ...preview.prices,
      },
      volumes: {
        ...combined.volumes,
        ...preview.volumes,
      },
      matches: mergeMatches(combined.matches, preview.matches),
      candidateMatches: mergeCandidateMatches(
        combined.candidateMatches ?? combined.matches,
        preview.candidateMatches ?? preview.matches,
      ),
      rawText: [combined.rawText, preview.rawText].filter(Boolean).join('\n\n'),
    }),
    primary,
  );
  const selectedPageNumbers = getDocumentImportSelectedPageNumbers({
    matches: merged.matches,
  });
  return {
    ...merged,
    pageNumber: selectedPageNumbers.length === 1 ? selectedPageNumbers[0] : null,
  };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeWarnings(warnings: string[]): string[] {
  return warnings.map((warning) => warning.trim()).filter((warning) => warning.length > 0);
}

function buildSourceLines(
  matches: Array<{ sourceLine?: string; pageNumber: number | null }>,
): V2DocumentImportSourceLine[] {
  const seen = new Set<string>();
  const lines: V2DocumentImportSourceLine[] = [];
  for (const match of matches) {
    const text = String(match.sourceLine ?? '').trim();
    if (!text) {
      continue;
    }
    const key = `${match.pageNumber ?? '-'}:${text}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push({
      text,
      pageNumber: match.pageNumber,
    });
  }
  return lines;
}

function buildPreviewFromMatches(params: {
  fileName: string;
  pageNumber: number | null;
  scannedPageCount: number;
  confidence: number | null;
  documentProfile: V2DocumentImportProfile;
  matches: DocumentImportFieldMatch[];
  candidateMatches?: DocumentImportFieldMatch[];
  warnings: string[];
  rawText: string;
}): DocumentImportPreview {
  const normalizeMatch = (match: DocumentImportFieldMatch) => ({
    ...match,
    value:
      match.datasetKind === 'financials'
        ? normalizeFinancialImportValue(match.key, match.value)
        : match.value,
  });
  const normalizedMatches = params.matches.map(normalizeMatch);
  const normalizedCandidateMatches = (
    params.candidateMatches ?? params.matches
  ).map(normalizeMatch);
  const financials: DocumentImportPreview['financials'] = {};
  const prices: DocumentImportPreview['prices'] = {};
  const volumes: DocumentImportPreview['volumes'] = {};

  for (const match of normalizedMatches) {
    if (match.datasetKind === 'financials') {
      financials[match.key as keyof typeof financials] = match.value;
    } else if (match.datasetKind === 'prices') {
      prices[match.key as keyof typeof prices] = match.value;
    } else if (match.datasetKind === 'volumes') {
      volumes[match.key as keyof typeof volumes] = match.value;
    }
  }

  const selectedPageNumbers = getDocumentImportSelectedPageNumbers({
    matches: normalizedMatches,
  });
  return {
    fileName: params.fileName,
    pageNumber: selectedPageNumbers.length === 1 ? selectedPageNumbers[0] : null,
    scannedPageCount: params.scannedPageCount,
    confidence: params.confidence,
    documentProfile: params.documentProfile,
    datasetKinds: unique(normalizedMatches.map((match) => match.datasetKind)),
    matchedFields: unique(normalizedMatches.map((match) => match.key)),
    warnings: normalizeWarnings(params.warnings),
    sourceLines: getDocumentImportSelectedSourceLines({
      matches: normalizedMatches,
    }),
    financials,
    prices,
    volumes,
    matches: normalizedMatches,
    candidateMatches: normalizedCandidateMatches,
    rawText: params.rawText,
  };
}
