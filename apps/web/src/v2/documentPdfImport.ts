import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

import type {
  V2DocumentImportDatasetKind,
  V2DocumentImportProfile,
  V2DocumentImportSourceLine,
} from '../api';
import type { QdisFieldKey, QdisImportResult } from './qdisPdfImport';
import { extractQdisFromPdf } from './qdisPdfImport';
import type { StatementOcrFieldKey, StatementOcrResult } from './statementOcr';
import { extractStatementFromPdf } from './statementOcr';

const TESSERACT_ASSET_BASE = '/vendor/tesseract';
const TESSERACT_WORKER_PATH = `${TESSERACT_ASSET_BASE}/worker.min.js`;
const TESSERACT_CORE_PATH = `${TESSERACT_ASSET_BASE}/core`;
const TESSERACT_LANG_PATH = `${TESSERACT_ASSET_BASE}/lang/`;

const MAX_SCAN_PAGES = 8;
const OCR_SCALE = 2.2;

type DocumentImportMatchKey =
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

type GenericDocumentParseResult = {
  matches: DocumentImportFieldMatch[];
  warnings: string[];
};

type GenericPagePreview = {
  preview: DocumentImportPreview;
  score: number;
};

type GenericScanSummary = {
  fileName: string;
  scannedPageCount: number;
  pages: GenericPagePreview[];
  warnings: string[];
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
    patterns: [
      /\bpoistot\b/i,
      /\bavskrivningar\b/i,
      /\bdepreciation\b/i,
    ],
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
    patterns: [
      /\bvesi(?:maksu|hinta)?\b/i,
      /\bvatten\b/i,
      /\bwater\b/i,
    ],
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

let pdfRuntimePromise: Promise<{
  getDocument: typeof import('pdfjs-dist')['getDocument'];
}> | null = null;
let ocrRuntimePromise: Promise<typeof import('tesseract.js')> | null = null;

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
    if (!text) continue;
    const key = `${match.pageNumber ?? '-'}:${text}`;
    if (seen.has(key)) continue;
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
    pageNumber:
      selectedPageNumbers.length === 1 ? selectedPageNumbers[0]! : null,
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
    pageNumber:
      selectedPageNumbers.length === 1 ? selectedPageNumbers[0]! : null,
  };
}

export async function extractDocumentFromPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<DocumentImportPreview> {
  const previews: DocumentImportPreview[] = [];
  const errors: string[] = [];

  try {
    onProgress?.('Scanning statement-style financial rows...');
    const statement = await extractStatementFromPdf(file);
    previews.push(buildDocumentImportPreviewFromStatement(statement));
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      errors.push(error.message);
    }
  }

  try {
    onProgress?.('Scanning price and sold-volume rows...');
    const qdis = await extractQdisFromPdf(file);
    previews.push(buildDocumentImportPreviewFromQdis(qdis));
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      errors.push(error.message);
    }
  }

  try {
    onProgress?.('Scanning unknown-layout source rows...');
    const generic = await extractUnknownLayoutPreview(file);
    if (generic) {
      previews.unshift(generic);
    }
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      errors.push(error.message);
    }
  }

  const merged = mergeDocumentImportPreviews(previews);
  if (!merged) {
    throw new Error(
      errors[0] ??
        'No financial, price, or sold-volume candidates were detected from the uploaded PDF.',
    );
  }

  if (
    merged.documentProfile === 'generic_pdf' ||
    merged.documentProfile === 'unknown_pdf'
  ) {
    merged.warnings = unique([
      ...merged.warnings,
      'Generic PDF detection needs manual review before saving.',
    ]);
  }

  return merged;
}

async function extractUnknownLayoutPreview(
  file: File,
): Promise<DocumentImportPreview | null> {
  const summary = await scanUnknownLayoutDocument(file);
  if (summary.pages.length === 0) {
    return null;
  }

  const orderedPreviews = [...summary.pages]
    .sort((left, right) => left.score - right.score)
    .map((entry) => entry.preview);
  const merged = mergeDocumentImportPreviews(orderedPreviews);
  if (!merged) {
    return null;
  }

  merged.scannedPageCount = summary.scannedPageCount;
  merged.warnings = unique([...merged.warnings, ...summary.warnings]);
  merged.documentProfile = 'unknown_pdf';
  return merged.matches.length > 0 ? merged : null;
}

async function scanUnknownLayoutDocument(file: File): Promise<GenericScanSummary> {
  const { getDocument } = await loadPdfRuntime();
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const scannedPageCount = Math.min(pdf.numPages, MAX_SCAN_PAGES);
  const pages: GenericPagePreview[] = [];
  const warnings: string[] = [];

  for (let pageNumber = 1; pageNumber <= scannedPageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const directText = await extractPageText(page);
    const directParse = parseGenericDocumentText(directText, pageNumber);

    let selectedText = directText;
    let selectedConfidence: number | null = directText.trim().length > 0 ? 100 : null;
    let selectedParse = directParse;
    let usedOcr = false;

    if (directParse.matches.length < 2 || directText.trim().length === 0) {
      const ocr = await extractPageTextWithOcr(page);
      const ocrParse = parseGenericDocumentText(ocr.text, pageNumber);
      if (ocrParse.matches.length > directParse.matches.length) {
        selectedText = ocr.text;
        selectedConfidence = ocr.confidence;
        selectedParse = ocrParse;
        usedOcr = true;
      }
    }

    if (selectedParse.matches.length === 0) {
      continue;
    }

    const preview = buildDocumentImportPreviewFromUnknownLayout({
      fileName: file.name,
      pageNumber,
      scannedPageCount,
      confidence: selectedConfidence,
      matches: selectedParse.matches,
      warnings: selectedParse.warnings,
      rawText: selectedText,
    });
    pages.push({
      preview,
      score: preview.matches.length * 10 + (usedOcr ? 0 : 1),
    });
  }

  return {
    fileName: file.name,
    scannedPageCount,
    pages,
    warnings,
  };
}

async function loadPdfRuntime() {
  if (!pdfRuntimePromise) {
    pdfRuntimePromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, workerModule]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
      return {
        getDocument: pdfjs.getDocument,
      };
    });
  }
  return pdfRuntimePromise;
}

async function loadOcrRuntime() {
  if (!ocrRuntimePromise) {
    ocrRuntimePromise = import('tesseract.js');
  }
  return ocrRuntimePromise;
}

async function extractPageText(page: PDFPageProxy): Promise<string> {
  const textContent = await page.getTextContent();
  return textContent.items
    .map((item) => {
      if ('str' in item) {
        return item.str;
      }
      return '';
    })
    .join('\n');
}

async function extractPageTextWithOcr(
  page: PDFPageProxy,
): Promise<{ text: string; confidence: number | null }> {
  const viewport = page.getViewport({ scale: OCR_SCALE });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  thresholdCanvas(canvas, context);

  const { recognize } = await loadOcrRuntime();
  const result = await recognize(canvas, 'swe+eng+fin', {
    workerPath: TESSERACT_WORKER_PATH,
    corePath: TESSERACT_CORE_PATH,
    langPath: TESSERACT_LANG_PATH,
    cacheMethod: 'none',
  });

  return {
    text: result.data.text ?? '',
    confidence:
      typeof result.data.confidence === 'number' ? result.data.confidence : null,
  };
}

function thresholdCanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
) {
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  for (let index = 0; index < data.length; index += 4) {
    const average = (data[index]! + data[index + 1]! + data[index + 2]!) / 3;
    const next = average > 205 ? 255 : 0;
    data[index] = next;
    data[index + 1] = next;
    data[index + 2] = next;
  }
  context.putImageData(image, 0, 0);
}

function extractFinancialAmount(line: string): number | null {
  const values = extractAllAmounts(line).filter((value) => {
    const absolute = Math.abs(value);
    if (Number.isInteger(absolute) && absolute >= 1900 && absolute <= 2100) {
      return false;
    }
    return true;
  });
  return values[0] ?? null;
}

function extractPriceAmount(line: string): number | null {
  return extractNumberWithPattern(
    line,
    /(-?\d[\d\s.,]*)\s*(?:€|eur)?\s*(?:\/|per)?\s*(?:m3|m³)/i,
  );
}

function extractVolumeAmount(line: string): number | null {
  return extractNumberWithPattern(line, /(-?\d[\d\s.,]*)\s*(?:m3|m³)/i);
}

function extractNumberWithPattern(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  return parseAmountToken(match[1]);
}

function extractAllAmounts(line: string): number[] {
  const tokens =
    line.match(/[+-]?\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{2})|[+-]?\d+(?:[.,]\d{2})/g) ??
    [];
  const values: number[] = [];
  for (const token of tokens) {
    const parsed = parseAmountToken(token);
    if (parsed != null) {
      values.push(parsed);
    }
  }
  return values;
}

function parseAmountToken(token: string): number | null {
  const raw = token.trim();
  if (!raw) return null;
  if (raw.includes('31.12') || raw.includes('1.1')) return null;

  let normalized = raw.replace(/[^\d,.\-\s]/g, '').replace(/\s+/g, '');
  if (!normalized) return null;

  if (normalized.includes(',') && normalized.includes('.')) {
    const decimalSeparator =
      normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
    if (decimalSeparator === ',') {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  if ((normalized.match(/\./g) ?? []).length > 1) {
    const negative = normalized.startsWith('-');
    const unsigned = negative ? normalized.slice(1) : normalized;
    const parts = unsigned.split('.');
    const decimalPart = parts[parts.length - 1] ?? '0';
    normalized = `${negative ? '-' : ''}${parts
      .slice(0, -1)
      .join('')}.${decimalPart}`;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? round2(parsed) : null;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeFinancialImportValue(
  key: DocumentImportMatchKey,
  value: number,
): number {
  if (
    key === 'aineetJaPalvelut' ||
    key === 'henkilostokulut' ||
    key === 'liiketoiminnanMuutKulut' ||
    key === 'poistot'
  ) {
    return round2(Math.abs(value));
  }
  return round2(value);
}

function isQdisPriceField(key: QdisFieldKey): boolean {
  return key === 'waterUnitPrice' || key === 'wastewaterUnitPrice';
}

function uniqueSourceLines(
  sourceLines: V2DocumentImportSourceLine[],
): V2DocumentImportSourceLine[] {
  const seen = new Set<string>();
  return sourceLines.filter((line) => {
    const key = `${line.pageNumber ?? '-'}:${line.text}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mergeMatches(
  left: DocumentImportFieldMatch[],
  right: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const merged = new Map<string, DocumentImportFieldMatch>();
  for (const match of [...left, ...right]) {
    merged.set(match.key, match);
  }
  return [...merged.values()];
}

function mergeCandidateMatches(
  left: DocumentImportFieldMatch[],
  right: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const seen = new Set<string>();
  const merged: DocumentImportFieldMatch[] = [];
  for (const match of [...left, ...right]) {
    const key = [
      match.key,
      match.value,
      match.pageNumber ?? '-',
      match.sourceLine,
    ].join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(match);
  }
  return merged;
}

function selectPreferredMatches(
  matches: DocumentImportFieldMatch[],
): DocumentImportFieldMatch[] {
  const selected = new Map<DocumentImportMatchKey, DocumentImportFieldMatch>();
  for (const match of matches) {
    if (!selected.has(match.key)) {
      selected.set(match.key, match);
    }
  }
  return [...selected.values()];
}
