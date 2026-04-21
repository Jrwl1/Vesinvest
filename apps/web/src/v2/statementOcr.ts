import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  parseStatementText,
  type StatementOcrFieldKey,
  type StatementOcrMatch,
} from './statementOcrParse';
import {
  extractPdfPageText,
  loadPdfRuntime,
  recognizePdfPageWithOcr,
} from './pdfOcrRuntime';

export type { StatementOcrFieldKey, StatementOcrMatch } from './statementOcrParse';

export type StatementOcrResult = {
  fileName: string;
  pageNumber: number | null;
  scannedPageCount: number;
  confidence: number | null;
  fields: Partial<Record<StatementOcrFieldKey, number>>;
  matches: StatementOcrMatch[];
  warnings: string[];
  rawText: string;
};

type ScanPageResult = {
  pageNumber: number;
  text: string;
  confidence: number | null;
  score: number;
};

const MAX_SCAN_PAGES = 8;
const OCR_SCALE = 2.4;
const RESULT_KEYWORDS = [
  'resultatrakning',
  'omsattning',
  'rakenskapsperiodens vinst',
  'rorelsevinst',
  'finansiella intakter och kostnader',
  'avskrivningar',
];

export async function extractStatementFromPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<StatementOcrResult> {
  const { getDocument } = await loadPdfRuntime();
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const maxPages = Math.min(pdf.numPages, MAX_SCAN_PAGES);
  let bestPage: ScanPageResult | null = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    onProgress?.(`Scanning page ${pageNumber}/${maxPages}...`);
    const scanned = await scanPdfPage(pdf, pageNumber);
    if (!bestPage || scanned.score > bestPage.score) {
      bestPage = scanned;
    }
    if (scanned.score >= 2) {
      break;
    }
  }

  if (!bestPage || bestPage.text.trim().length === 0) {
    throw new Error(
      'No readable OCR text was found in the first pages of the statement PDF.',
    );
  }

  const parsed = parseStatementText(bestPage.text, bestPage.pageNumber);
  const warnings = [...parsed.warnings];
  if (bestPage.score < 2) {
    warnings.push(
      'The result statement page was not detected confidently. Check the imported values before saving.',
    );
  }

  return {
    fileName: file.name,
    pageNumber: bestPage.pageNumber,
    scannedPageCount: maxPages,
    confidence: bestPage.confidence,
    fields: parsed.fields,
    matches: parsed.matches,
    warnings,
    rawText: bestPage.text,
  };
}

async function scanPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<ScanPageResult> {
  const page = await pdf.getPage(pageNumber);
  const directText = await extractPdfPageText(page);
  const normalizedDirectText = normalizeText(directText);

  if (scoreResultStatementText(normalizedDirectText) >= 2) {
    return {
      pageNumber,
      text: directText,
      confidence: 100,
      score: scoreResultStatementText(normalizedDirectText),
    };
  }

  const ocr = await recognizePdfPageWithOcr({
    page,
    languages: 'swe+eng',
    scale: OCR_SCALE,
  });
  const normalizedText = normalizeText(ocr.text);

  return {
    pageNumber,
    text: ocr.text,
    confidence: ocr.confidence,
    score: scoreResultStatementText(normalizedText),
  };
}

function scoreResultStatementText(text: string): number {
  let score = 0;
  for (const keyword of RESULT_KEYWORDS) {
    if (text.includes(keyword)) {
      score += 1;
    }
  }
  return score;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
