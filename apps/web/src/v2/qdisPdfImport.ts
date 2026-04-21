import {
  extractPdfPageText,
  loadPdfRuntime,
  recognizePdfPageWithOcr,
} from './pdfOcrRuntime';

const MAX_SCAN_PAGES = 4;
const OCR_SCALE = 2.2;

export type QdisFieldKey =
  | 'waterUnitPrice'
  | 'wastewaterUnitPrice'
  | 'soldWaterVolume'
  | 'soldWastewaterVolume';

export type QdisFieldMatch = {
  key: QdisFieldKey;
  label: string;
  value: number;
  sourceLine: string;
  pageNumber: number | null;
};

export type QdisImportResult = {
  fileName: string;
  pageNumber: number | null;
  scannedPageCount: number;
  confidence: number | null;
  fields: Partial<Record<QdisFieldKey, number>>;
  matches: QdisFieldMatch[];
  warnings: string[];
  rawText: string;
};

type ParsedQdisValues = Pick<QdisImportResult, 'fields' | 'matches' | 'warnings'>;

type ScanCandidate = {
  text: string;
  confidence: number | null;
  parsed: ParsedQdisValues;
  usedOcr: boolean;
};

const FIELD_LABELS: Record<QdisFieldKey, string> = {
  waterUnitPrice: 'Water unit price',
  wastewaterUnitPrice: 'Wastewater unit price',
  soldWaterVolume: 'Sold water volume',
  soldWastewaterVolume: 'Sold wastewater volume',
};

const PRICE_PATTERN = /(-?\d[\d\s.,]*)\s*(?:\u20ac|eur)?\s*(?:\/|per)?\s*(?:m3|m\u00b3)/i;
const VOLUME_PATTERN = /(-?\d[\d\s.,]*)\s*(?:m3|m\u00b3)/i;

export function parseQdisText(
  text: string,
  pageNumber: number | null,
): ParsedQdisValues {
  const fields: Partial<Record<QdisFieldKey, number>> = {};
  const matches: QdisFieldMatch[] = [];
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const registerMatch = (
    key: QdisFieldKey,
    line: string,
    value: number | null,
  ) => {
    if (value == null || fields[key] != null) {
      return;
    }
    fields[key] = value;
    matches.push({
      key,
      label: FIELD_LABELS[key],
      value,
      sourceLine: line,
      pageNumber,
    });
  };

  for (const line of lines) {
    const normalized = normalizeText(line);
    if (
      fields.wastewaterUnitPrice == null &&
      /(avlopp|spill|wastewater|jatevesi|j\u00e4tevesi)/i.test(normalized)
    ) {
      registerMatch(
        'wastewaterUnitPrice',
        line,
        extractNumber(line, PRICE_PATTERN),
      );
      continue;
    }
    if (
      fields.waterUnitPrice == null &&
      /(vatten|water)/i.test(normalized) &&
      !/(avlopp|spill|wastewater|jatevesi|j\u00e4tevesi)/i.test(normalized)
    ) {
      registerMatch('waterUnitPrice', line, extractNumber(line, PRICE_PATTERN));
      continue;
    }
    if (
      fields.soldWastewaterVolume == null &&
      /(avlopp|spill|wastewater|jatevesi|j\u00e4tevesi)/i.test(normalized)
    ) {
      registerMatch(
        'soldWastewaterVolume',
        line,
        extractNumber(line, VOLUME_PATTERN),
      );
      continue;
    }
    if (
      fields.soldWaterVolume == null &&
      /(vatten|water)/i.test(normalized) &&
      !/(avlopp|spill|wastewater|jatevesi|j\u00e4tevesi)/i.test(normalized)
    ) {
      registerMatch(
        'soldWaterVolume',
        line,
        extractNumber(line, VOLUME_PATTERN),
      );
    }
  }

  if (Object.keys(fields).length === 0) {
    warnings.push(
      'No QDIS prices or volumes were detected from the uploaded PDF text.',
    );
  }

  return { fields, matches, warnings };
}

export function selectPreferredQdisCandidate(options: {
  directText: string;
  ocrText: string;
  pageNumber: number | null;
}): ScanCandidate {
  const directParsed = parseQdisText(options.directText, options.pageNumber);
  const ocrParsed = parseQdisText(options.ocrText, options.pageNumber);
  const directCount = Object.keys(directParsed.fields).length;
  const ocrCount = Object.keys(ocrParsed.fields).length;

  if (ocrCount > directCount) {
    return {
      text: options.ocrText,
      confidence: null,
      parsed: {
        ...ocrParsed,
        warnings: [
          ...ocrParsed.warnings,
          'OCR fallback was used because direct PDF text did not map enough QDIS values.',
        ],
      },
      usedOcr: true,
    };
  }

  return {
    text: options.directText,
    confidence: 100,
    parsed: directParsed,
    usedOcr: false,
  };
}

export async function extractQdisFromPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<QdisImportResult> {
  const { getDocument } = await loadPdfRuntime();
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise;
  const maxPages = Math.min(pdf.numPages, MAX_SCAN_PAGES);
  let bestCandidate: (ScanCandidate & { pageNumber: number }) | null = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    onProgress?.(`Scanning QDIS page ${pageNumber}/${maxPages}...`);
    const page = await pdf.getPage(pageNumber);
    const directText = await extractPdfPageText(page);
    const ocrText = await recognizePdfPageWithOcr({
      page,
      languages: 'swe+eng',
      scale: OCR_SCALE,
    });
    const selected = selectPreferredQdisCandidate({
      directText,
      ocrText: ocrText.text,
      pageNumber,
    });
    const selectedWithConfidence = {
      ...selected,
      confidence: selected.usedOcr ? ocrText.confidence : 100,
      pageNumber,
    };
    if (
      !bestCandidate ||
      Object.keys(selected.parsed.fields).length >
        Object.keys(bestCandidate.parsed.fields).length
    ) {
      bestCandidate = selectedWithConfidence;
    }
    if (Object.keys(selected.parsed.fields).length >= 4) {
      break;
    }
  }

  if (!bestCandidate) {
    throw new Error('No readable QDIS text was found in the uploaded PDF.');
  }
  if (Object.keys(bestCandidate.parsed.fields).length === 0) {
    throw new Error(
      'QDIS PDF import could not detect prices or sold volumes from the uploaded file.',
    );
  }

  return {
    fileName: file.name,
    pageNumber: bestCandidate.pageNumber,
    scannedPageCount: maxPages,
    confidence: bestCandidate.confidence,
    fields: bestCandidate.parsed.fields,
    matches: bestCandidate.parsed.matches,
    warnings: bestCandidate.parsed.warnings,
    rawText: bestCandidate.text,
  };
}

function extractNumber(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  const normalized = match[1]
    .replace(/\s+/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
