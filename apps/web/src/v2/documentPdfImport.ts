import {
  buildDocumentImportPreviewFromQdis,
  buildDocumentImportPreviewFromStatement,
  buildDocumentImportPreviewFromUnknownLayout,
  mergeDocumentImportPreviews,
  parseGenericDocumentText,
  type DocumentImportPreview,
} from './documentPdfImportModel';
import {
  extractPdfPageText,
  loadPdfRuntime,
  recognizePdfPageWithOcr,
} from './pdfOcrRuntime';

const MAX_SCAN_PAGES = 8;
const OCR_SCALE = 2.2;

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

let statementImportModulePromise: Promise<typeof import('./statementOcr')> | null =
  null;
let qdisImportModulePromise: Promise<typeof import('./qdisPdfImport')> | null =
  null;

function loadStatementImportModule() {
  if (!statementImportModulePromise) {
    statementImportModulePromise = import('./statementOcr');
  }
  return statementImportModulePromise;
}

function loadQdisImportModule() {
  if (!qdisImportModulePromise) {
    qdisImportModulePromise = import('./qdisPdfImport');
  }
  return qdisImportModulePromise;
}

export async function extractDocumentFromPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<DocumentImportPreview> {
  const previews: DocumentImportPreview[] = [];
  const errors: string[] = [];

  try {
    onProgress?.('Scanning statement-style financial rows...');
    const { extractStatementFromPdf } = await loadStatementImportModule();
    const statement = await extractStatementFromPdf(file);
    previews.push(buildDocumentImportPreviewFromStatement(statement));
  } catch (error) {
    if (error instanceof Error && error.message.trim().length > 0) {
      errors.push(error.message);
    }
  }

  try {
    onProgress?.('Scanning price and sold-volume rows...');
    const { extractQdisFromPdf } = await loadQdisImportModule();
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
    merged.warnings = [
      ...new Set([
        ...merged.warnings,
        'Generic PDF detection needs manual review before saving.',
      ]),
    ];
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
  merged.warnings = [...new Set([...merged.warnings, ...summary.warnings])];
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
    const directText = await extractPdfPageText(page);
    const directParse = parseGenericDocumentText(directText, pageNumber);

    let selectedText = directText;
    let selectedConfidence: number | null = directText.trim().length > 0 ? 100 : null;
    let selectedParse = directParse;
    let usedOcr = false;

    if (directParse.matches.length < 2 || directText.trim().length === 0) {
      const ocr = await recognizePdfPageWithOcr({
        page,
        languages: 'swe+eng+fin',
        scale: OCR_SCALE,
      });
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

export {
  applyDocumentImportMatchSelection,
  buildDocumentImportPreviewFromQdis,
  buildDocumentImportPreviewFromStatement,
  buildDocumentImportPreviewFromUnknownLayout,
  clearDocumentImportMatchSelections,
  getDocumentImportCandidateKeys,
  getDocumentImportSelectedPageNumbers,
  getDocumentImportSelectedSourceLines,
  mergeDocumentImportPreviews,
  parseGenericDocumentText,
  requiresDocumentImportConfidenceReview
} from './documentPdfImportModel';
export type {
  DocumentImportFieldMatch,
  DocumentImportMatchKey,
  DocumentImportPreview
} from './documentPdfImportModel';
