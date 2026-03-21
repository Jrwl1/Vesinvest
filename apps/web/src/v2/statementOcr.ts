import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import {
  parseStatementText,
  type StatementOcrFieldKey,
  type StatementOcrMatch,
} from './statementOcrParse';

const TESSERACT_ASSET_BASE = '/vendor/tesseract';
const TESSERACT_WORKER_PATH = `${TESSERACT_ASSET_BASE}/worker.min.js`;
const TESSERACT_CORE_PATH = `${TESSERACT_ASSET_BASE}/core`;
const TESSERACT_LANG_PATH = `${TESSERACT_ASSET_BASE}/lang/`;

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

let pdfRuntimePromise: Promise<{
  getDocument: typeof import('pdfjs-dist')['getDocument'];
}> | null = null;
let ocrRuntimePromise: Promise<typeof import('tesseract.js')> | null = null;

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
  const directText = await extractPageText(page);
  const normalizedDirectText = normalizeText(directText);

  if (scoreResultStatementText(normalizedDirectText) >= 2) {
    return {
      pageNumber,
      text: directText,
      confidence: 100,
      score: scoreResultStatementText(normalizedDirectText),
    };
  }

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
  const result = await recognize(canvas, 'swe+eng', {
    workerPath: TESSERACT_WORKER_PATH,
    corePath: TESSERACT_CORE_PATH,
    langPath: TESSERACT_LANG_PATH,
    cacheMethod: 'none',
  });
  const text = result.data.text ?? '';
  const normalizedText = normalizeText(text);

  return {
    pageNumber,
    text,
    confidence:
      typeof result.data.confidence === 'number' ? result.data.confidence : null,
    score: scoreResultStatementText(normalizedText),
  };
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
